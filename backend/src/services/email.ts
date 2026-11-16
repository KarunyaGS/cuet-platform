/**
 * Outgoing email: password reset links, address confirmation, account notices and study reminders.
 *
 * Providers, tried in this order:
 *   1. Cloudflare Email Sending, through the `send_email` binding `EMAIL` (no API key).
 *   2. Resend, through its HTTPS API, when the secret RESEND_API_KEY is set (standby).
 * Nothing is sent unless EMAIL_FROM is set. Every attempt is recorded in `email_messages`; the body is never
 * stored, because it can hold a one-time link. Hard bounces and spam complaints put the address in
 * `email_suppressions`, and suppressed addresses are never emailed again.
 */
import { z } from 'zod';
import type { Bindings } from '../types';
import { ApiError } from '../lib/errors';
import { newId, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { reminders } from './student-portal';

export type EmailKind = 'PASSWORD_RESET' | 'VERIFY_EMAIL' | 'ACCOUNT_NOTICE' | 'STUDY_REMINDER' | 'NOTICE_ALERT';
export interface OutgoingEmail {
  to: string;
  userId: string | null;
  kind: EmailKind;
  subject: string;
  text: string;
  html: string;
  /** The same key is sent at most once. */
  dedupeKey?: string;
  headers?: Record<string, string>;
}
type Transport = (env: Bindings, m: OutgoingEmail, from: { email: string; name: string }) => Promise<string>;
interface Provider { name: 'cloudflare' | 'resend' | 'test'; send: Transport }

const cloudflare: Transport = async (env, m, from) => {
  const r = await env.EMAIL!.send({ to: m.to, from, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
  return r.messageId;
};

const resend: Transport = async (env, m, from) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [m.to], subject: m.subject, text: m.text, html: m.html, headers: m.headers }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw Object.assign(new Error(body.message ?? `Resend answered ${res.status}`), { code: `RESEND_${res.status}` });
  return body.id;
};

let testTransport: Transport | null = null;
/** Tests only: replaces every provider with one function, or restores the real ones with `null`. */
export function setEmailTransportForTests(t: Transport | null) {
  testTransport = t;
}

function providers(env: Bindings): Provider[] {
  if (testTransport) return [{ name: 'test', send: testTransport }];
  const out: Provider[] = [];
  if (env.EMAIL) out.push({ name: 'cloudflare', send: cloudflare });
  if (env.RESEND_API_KEY) out.push({ name: 'resend', send: resend });
  return out;
}

/** True when the Worker has a sender address and at least one provider. */
export const emailEnabled = (env: Bindings) => Boolean(env.EMAIL_FROM) && providers(env).length > 0;

/** The public address of the app, used in emailed links. In production it must come from configuration, never from the request. */
export function appUrl(env: Bindings, requestUrl?: string): string {
  if (env.PUBLIC_APP_URL) return env.PUBLIC_APP_URL.replace(/\/+$/, '');
  if (env.APP_ENV === 'development' && requestUrl) return new URL(requestUrl).origin;
  throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', 'Email links are not configured yet');
}

export type SendOutcome = 'SENT' | 'FAILED' | 'SUPPRESSED' | 'NOT_CONFIGURED' | 'DUPLICATE';

/**
 * A failed email is tried again later only for kinds that carry nothing secret, and only while it is still useful. An email
 * with a one-time link (password reset, address confirmation) is never kept or retried: the student asks again.
 */
export const RETRY_POLICY: Partial<Record<EmailKind, { maxAgeMinutes: number }>> = {
  STUDY_REMINDER: { maxAgeMinutes: 6 * 60 },
  NOTICE_ALERT: { maxAgeMinutes: 24 * 60 },
  ACCOUNT_NOTICE: { maxAgeMinutes: 48 * 60 },
};
/** Minutes to wait before retry 1, 2, 3 ...; after the last one the email is given up on. */
export const RETRY_BACKOFF_MINUTES = [5, 30, 120, 720, 1440];
/** A provider answer that will not change by trying again (a rejected address or request), as opposed to an outage or a rate limit. */
const PERMANENT = /RESEND_4(?!08|29)\d\d|E_RECIPIENT_SUPPRESSED|E_VALIDATION|E_SENDER|E_INVALID/i;
const addMinutes = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60_000).toISOString();

/** Tries each provider in turn. Returns who sent it, or the last error. */
async function deliver(env: Bindings, m: OutgoingEmail, from: { email: string; name: string }): Promise<{ ok: true; provider: string; providerId: string; attempts: number } | { ok: false; error: string; attempts: number }> {
  let attempts = 0;
  let lastError = '';
  for (const p of providers(env)) {
    attempts++;
    try {
      return { ok: true, provider: p.name, providerId: await p.send(env, m, from), attempts };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      lastError = `${p.name}: ${err.code ?? 'ERROR'} ${err.message ?? ''}`.trim();
      console.error('Email send failed', { kind: m.kind, provider: p.name, code: err.code });
    }
  }
  return { ok: false, error: lastError, attempts };
}

export async function sendEmail(env: Bindings, m: OutgoingEmail): Promise<{ status: SendOutcome; id: string | null }> {
  const db = env.DB;
  const to = m.to.trim().toLowerCase();
  const now = nowIso();
  if (m.dedupeKey) {
    const seen = await db.prepare('SELECT id FROM email_messages WHERE dedupe_key = ?').bind(m.dedupeKey).first<{ id: string }>();
    if (seen) return { status: 'DUPLICATE', id: seen.id };
  }
  const id = newId('eml');
  const record = (status: string, provider: string | null, providerId: string | null, attempts: number, error: string | null) =>
    db
      .prepare(
        `INSERT INTO email_messages (id, user_id, to_email, kind, subject, status, provider, provider_message_id, dedupe_key, attempts, last_error, created_at, sent_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (dedupe_key) DO NOTHING`,
      )
      .bind(id, m.userId, to, m.kind, m.subject.slice(0, 200), status, provider, providerId, m.dedupeKey ?? null, attempts, error?.slice(0, 500) ?? null, now, status === 'SENT' ? now : null, now)
      .run();

  if (!emailEnabled(env)) {
    await record('NOT_CONFIGURED', null, null, 0, null);
    return { status: 'NOT_CONFIGURED', id };
  }
  if (await db.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').bind(to).first()) {
    await record('SUPPRESSED', null, null, 0, null);
    return { status: 'SUPPRESSED', id };
  }
  const from = { email: env.EMAIL_FROM!, name: env.EMAIL_FROM_NAME || 'CUET Prep' };
  const r = await deliver(env, { ...m, to }, from);
  if (r.ok) {
    await record('SENT', r.provider, r.providerId, r.attempts, null);
    return { status: 'SENT', id };
  }
  await record('FAILED', null, null, r.attempts, r.error);
  // Keep a harmless email for a later try. The body is erased as soon as it is sent, expires or is given up on.
  const policy = RETRY_POLICY[m.kind];
  if (policy && !PERMANENT.test(r.error)) {
    await db
      .prepare('UPDATE email_messages SET payload_json = ?, next_attempt_at = ?, retry_until = ? WHERE id = ?')
      .bind(JSON.stringify({ subject: m.subject, text: m.text, html: m.html, headers: m.headers ?? null }), addMinutes(now, RETRY_BACKOFF_MINUTES[0]!), addMinutes(now, policy.maxAgeMinutes), id)
      .run();
  }
  return { status: 'FAILED', id };
}

/**
 * Tries failed emails again, oldest due first. Each is retried at 5 minutes, 30 minutes, 2 hours, 12 hours and 24 hours after the
 * failure, while it is still within its kind's useful life, and is then given up on. A suppressed address is never retried.
 * The kept body is erased whenever a message is sent, suppressed, expired or given up on.
 */
export async function retryFailedEmails(env: Bindings, at = new Date(), limit = 50) {
  const out = { due: 0, sent: 0, stillFailing: 0, expired: 0, suppressed: 0, gaveUp: 0, skipped: 0 };
  if (!emailEnabled(env)) return { ...out, enabled: false };
  const db = env.DB;
  const now = at.toISOString();
  const { results } = await db
    .prepare(`SELECT id, user_id, to_email, kind, subject, payload_json, retry_count, retry_until, attempts FROM email_messages WHERE status = 'FAILED' AND payload_json IS NOT NULL AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?`)
    .bind(now, limit)
    .all<{ id: string; user_id: string | null; to_email: string; kind: EmailKind; subject: string; payload_json: string; retry_count: number; retry_until: string | null; attempts: number }>();
  out.due = results.length;
  const from = { email: env.EMAIL_FROM!, name: env.EMAIL_FROM_NAME || 'CUET Prep' };
  const wipe = (id: string, error: string | null, status = 'FAILED') =>
    db.prepare('UPDATE email_messages SET status = ?, payload_json = NULL, next_attempt_at = NULL, last_error = COALESCE(?, last_error), updated_at = ? WHERE id = ?').bind(status, error, now, id).run();
  for (const row of results) {
    if (row.retry_until && row.retry_until < now) {
      await wipe(row.id, 'Given up: too old to be useful');
      out.expired++;
      continue;
    }
    if (await db.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').bind(row.to_email).first()) {
      await wipe(row.id, null, 'SUPPRESSED');
      out.suppressed++;
      continue;
    }
    const p = JSON.parse(row.payload_json) as { subject: string; text: string; html: string; headers: Record<string, string> | null };
    const r = await deliver(env, { to: row.to_email, userId: row.user_id, kind: row.kind, subject: p.subject, text: p.text, html: p.html, headers: p.headers ?? undefined }, from);
    if (r.ok) {
      await db
        .prepare(`UPDATE email_messages SET status = 'SENT', provider = ?, provider_message_id = ?, attempts = attempts + ?, retry_count = retry_count + 1, sent_at = ?, payload_json = NULL, next_attempt_at = NULL, updated_at = ? WHERE id = ?`)
        .bind(r.provider, r.providerId, r.attempts, now, now, row.id)
        .run();
      out.sent++;
      continue;
    }
    const retries = row.retry_count + 1;
    if (retries >= RETRY_BACKOFF_MINUTES.length || PERMANENT.test(r.error)) {
      await wipe(row.id, `Given up after ${retries} ${retries === 1 ? 'retry' : 'retries'}: ${r.error}`.slice(0, 500));
      await db.prepare('UPDATE email_messages SET retry_count = ? WHERE id = ?').bind(retries, row.id).run();
      out.gaveUp++;
    } else {
      await db
        .prepare('UPDATE email_messages SET retry_count = ?, attempts = attempts + ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?')
        .bind(retries, r.attempts, r.error.slice(0, 500), addMinutes(now, RETRY_BACKOFF_MINUTES[retries]!), now, row.id)
        .run();
      out.stillFailing++;
    }
  }
  return { ...out, enabled: true };
}

// ---------------------------------------------------------------- templates

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }, footer?: string, links?: { label: string; url: string }[]) {
  const text = [heading, '', ...paragraphs, ...(links ?? []).flatMap((l) => ['', l.label, l.url]), ...(button ? ['', `${button.label}: ${button.url}`] : []), '', footer ?? 'CUET Prep'].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;color:#1c1b19">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:14px;font-weight:bold;letter-spacing:.04em;margin:0 0 20px">CUET Prep</p>
<div style="background:#ffffff;border:1px solid #e3e0d8;border-radius:10px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(p)}</p>`).join('\n')}
${(links ?? []).map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 10px"><a href="${esc(l.url)}" style="color:#1f4fd8">${esc(l.label)}</a></p>`).join('\n')}
${button ? `<p style="margin:20px 0 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#1f4fd8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:11px 18px;border-radius:8px">${esc(button.label)}</a></p>
<p style="font-size:12px;line-height:1.5;color:#6b6860;margin:12px 0 0;word-break:break-all">If the button does not work, copy this address into your browser: ${esc(button.url)}</p>` : ''}
</div>
<p style="font-size:12px;line-height:1.5;color:#6b6860;margin:16px 4px 0">${esc(footer ?? 'You are receiving this because of your CUET Prep account.')}</p>
</div></body></html>`;
  return { text, html };
}

const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);

// ---------------------------------------------------------------- password reset by email

export const forgotPasswordSchema = z.object({ email: z.email().max(200).transform((e) => e.trim().toLowerCase()) });
const RESET_TTL_MINUTES = 60;
const MAX_PER_HOUR = 3;

async function recentCount(db: D1Database, to: string, kind: EmailKind) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM email_messages WHERE to_email = ? AND kind = ? AND created_at >= ?').bind(to, kind, since).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Emails a one-time reset link when the address belongs to an active account. The caller always answers the same
 * way, so nobody can learn from this endpoint whether an address has an account.
 */
export async function requestPasswordReset(env: Bindings, email: string, base: string) {
  const db = env.DB;
  const user = await db.prepare("SELECT id, display_name FROM users WHERE email = ? AND status = 'ACTIVE'").bind(email).first<{ id: string; display_name: string }>();
  if (!user) return;
  if ((await recentCount(db, email, 'PASSWORD_RESET')) >= MAX_PER_HOUR) return;
  const token = randomToken();
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now, user.id),
    db
      .prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_by, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)')
      .bind(newId('prt'), user.id, await sha256Hex(token), new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString(), 'self-service:email', now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), 'self-service:email', 'REQUEST_RESET_LINK', 'USER', user.id, now),
  ]);
  const body = layout(
    'Reset your password',
    [`Hello ${user.display_name},`, 'We received a request to reset the password of your CUET Prep account. The link below works once and expires in one hour.', 'If you did not ask for this, you can ignore this email. Your password stays the same.'],
    { label: 'Choose a new password', url: `${base}/reset-password#${token}` },
  );
  await sendEmail(env, { to: email, userId: user.id, kind: 'PASSWORD_RESET', subject: 'Reset your CUET Prep password', ...body });
}

/** Tells the account owner that the password changed (after a reset or a change from the profile page). */
export async function notifyPasswordChanged(env: Bindings, userId: string) {
  const user = await env.DB.prepare('SELECT email, display_name FROM users WHERE id = ?').bind(userId).first<{ email: string; display_name: string }>();
  if (!user) return;
  const body = layout('Your password was changed', [`Hello ${user.display_name},`, 'The password of your CUET Prep account was just changed, and other devices were signed out.', 'If this was not you, reset your password now from the sign-in page and tell the CUET Prep team.']);
  await sendEmail(env, { to: user.email, userId, kind: 'ACCOUNT_NOTICE', subject: 'Your CUET Prep password was changed', ...body });
}

// ---------------------------------------------------------------- confirming an email address

const VERIFY_TTL_HOURS = 48;

export async function sendVerificationEmail(env: Bindings, userId: string, base: string): Promise<{ sent: boolean; reason?: 'ALREADY_VERIFIED' | 'TOO_MANY' | 'NOT_CONFIGURED' | 'FAILED' }> {
  const db = env.DB;
  const user = await db.prepare("SELECT email, display_name, email_verified_at FROM users WHERE id = ? AND status = 'ACTIVE'").bind(userId).first<{ email: string; display_name: string; email_verified_at: string | null }>();
  if (!user) return { sent: false, reason: 'FAILED' };
  if (user.email_verified_at) return { sent: false, reason: 'ALREADY_VERIFIED' };
  if (!emailEnabled(env)) return { sent: false, reason: 'NOT_CONFIGURED' };
  if ((await recentCount(db, user.email, 'VERIFY_EMAIL')) >= MAX_PER_HOUR) return { sent: false, reason: 'TOO_MANY' };
  const token = randomToken();
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now, userId),
    db
      .prepare('INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
      .bind(newId('evt'), userId, await sha256Hex(token), new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000).toISOString(), now),
  ]);
  const body = layout(
    'Confirm your email address',
    [`Hello ${user.display_name},`, 'Please confirm that this address belongs to you. The link works once and expires in 48 hours.', 'If you did not create a CUET Prep account, you can ignore this email.'],
    { label: 'Confirm my email', url: `${base}/verify-email#${token}` },
  );
  const r = await sendEmail(env, { to: user.email, userId, kind: 'VERIFY_EMAIL', subject: 'Confirm your email for CUET Prep', ...body });
  return r.status === 'SENT' ? { sent: true } : { sent: false, reason: 'FAILED' };
}

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export async function verifyEmail(db: D1Database, input: z.infer<typeof verifyEmailSchema>) {
  const now = nowIso();
  const row = await db
    .prepare('SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(await sha256Hex(input.token), now)
    .first<{ id: string; user_id: string }>();
  if (!row) throw new ApiError(400, 'INVALID_VERIFY_LINK', 'This link is not valid. It may have expired or been used already. Sign in and ask for a new one from your profile.');
  await db.batch([
    db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?').bind(now, now, row.user_id),
    db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), `user:${row.user_id}`, 'VERIFY_EMAIL', 'USER', row.user_id, now),
  ]);
  return { verified: true };
}

// ---------------------------------------------------------------- email settings of a student

export const emailSettingsSchema = z
  .object({ emailReminders: z.boolean().optional(), emailNotices: z.boolean().optional() })
  .refine((v) => v.emailReminders !== undefined || v.emailNotices !== undefined, 'Say what to change');

export async function getEmailSettings(env: Bindings, userId: string) {
  const row = await env.DB
    .prepare('SELECT u.email, u.email_verified_at, COALESCE(p.email_reminders, 0) AS email_reminders, COALESCE(p.email_notices, 0) AS email_notices FROM users u LEFT JOIN student_preferences p ON p.user_id = u.id WHERE u.id = ?')
    .bind(userId)
    .first<{ email: string; email_verified_at: string | null; email_reminders: number; email_notices: number }>();
  return { email: row?.email ?? '', emailVerified: Boolean(row?.email_verified_at), emailReminders: Boolean(row?.email_reminders), emailNotices: Boolean(row?.email_notices), emailAvailable: emailEnabled(env) };
}

export async function setEmailSettings(env: Bindings, userId: string, input: z.infer<typeof emailSettingsSchema>) {
  const cur = await getEmailSettings(env, userId);
  if ((input.emailReminders || input.emailNotices) && !cur.emailVerified) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Confirm your email address first; emails are sent only to a confirmed address');
  const reminders = input.emailReminders ?? cur.emailReminders;
  const notices = input.emailNotices ?? cur.emailNotices;
  const now = nowIso();
  await env.DB
    .prepare(
      `INSERT INTO student_preferences (user_id, paper_ids_json, email_reminders, email_notices, notice_cursor, unsubscribe_token, updated_at) VALUES (?, '[]', ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET email_reminders = excluded.email_reminders, email_notices = excluded.email_notices,
         notice_cursor = CASE WHEN excluded.email_notices = 1 AND student_preferences.email_notices = 0 THEN excluded.notice_cursor ELSE student_preferences.notice_cursor END,
         unsubscribe_token = COALESCE(student_preferences.unsubscribe_token, excluded.unsubscribe_token), updated_at = excluded.updated_at`,
    )
    .bind(userId, reminders ? 1 : 0, notices ? 1 : 0, now, randomToken(), now)
    .run();
  return getEmailSettings(env, userId);
}

export const unsubscribeSchema = z.object({ token: z.string().min(20).max(200), scope: z.enum(['REMINDERS', 'NOTICES', 'ALL']).default('REMINDERS') });

/** One-click stop from a reminder or a notice alert; needs no sign-in. Always answers the same way, whatever the token. */
export async function unsubscribe(db: D1Database, input: z.infer<typeof unsubscribeSchema>) {
  const sets = [...(input.scope !== 'NOTICES' ? ['email_reminders = 0'] : []), ...(input.scope !== 'REMINDERS' ? ['email_notices = 0'] : [])];
  await db.prepare(`UPDATE student_preferences SET ${sets.join(', ')}, updated_at = ? WHERE unsubscribe_token = ?`).bind(nowIso(), input.token).run();
  return { unsubscribed: true };
}

/** RFC 8058 one-click unsubscribe headers, so mail programs can offer an "Unsubscribe" button that works without signing in. */
const unsubscribeHeaders = (base: string, token: string | null, scope: 'REMINDERS' | 'NOTICES'): Record<string, string> =>
  token ? { 'List-Unsubscribe': `<${base}/api/public/email/unsubscribe?token=${token}&scope=${scope}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {};

// ---------------------------------------------------------------- daily study reminders (Cron Trigger)

const REMINDER_KINDS = new Set(['TEST', 'PLAN', 'GOAL', 'REVISE']);
/** The calendar day in India for a moment in time. */
export const istDay = (at: Date) => new Date(at.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * Sends at most one reminder email per student per day, to students who turned reminders on and confirmed their
 * address, and only when they have something open (an unfinished test, planned tasks, a daily goal, a weak topic).
 */
export async function sendDailyReminders(env: Bindings, at = new Date(), limit = 500) {
  const out = { candidates: 0, sent: 0, nothingDue: 0, skipped: 0, failed: 0 };
  if (!emailEnabled(env) || !env.PUBLIC_APP_URL) return { ...out, enabled: false };
  const base = appUrl(env);
  const day = istDay(at);
  const since = new Date(`${day}T00:00:00+05:30`).toISOString();
  const { results } = await env.DB
    .prepare(
      `SELECT u.id, u.email, u.display_name, p.unsubscribe_token FROM student_preferences p JOIN users u ON u.id = p.user_id
       WHERE p.email_reminders = 1 AND u.status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.email = u.email)
         AND NOT EXISTS (SELECT 1 FROM email_messages m WHERE m.dedupe_key = 'reminder:' || u.id || ':' || ?1)
       ORDER BY u.id LIMIT ?2`,
    )
    .bind(day, limit)
    .all<{ id: string; email: string; display_name: string; unsubscribe_token: string | null }>();
  out.candidates = results.length;
  for (const u of results) {
    const due = (await reminders(env.DB, u.id, { day, since })).filter((r) => REMINDER_KINDS.has(r.kind)).slice(0, 4);
    if (!due.length) {
      out.nothingDue++;
      continue;
    }
    const stop = `${base}/unsubscribe#${u.unsubscribe_token ?? ''}`;
    const body = layout(
      'Your study plan for today',
      [`Hello ${u.display_name},`, ...due.map((r) => `• ${r.title}. ${r.body}`)],
      { label: 'Open CUET Prep', url: `${base}/dashboard` },
      `You asked for study reminders by email. To stop them, open ${stop} or turn them off on your profile page.`,
    );
    const r = await sendEmail(env, { to: u.email, userId: u.id, kind: 'STUDY_REMINDER', subject: due[0]!.title, dedupeKey: `reminder:${u.id}:${day}`, headers: unsubscribeHeaders(base, u.unsubscribe_token, 'REMINDERS'), ...body });
    if (r.status === 'SENT') out.sent++;
    else if (r.status === 'FAILED') out.failed++;
    else out.skipped++;
  }
  return { ...out, enabled: true };
}

// ---------------------------------------------------------------- emails about new official notices

/** UGC letters are mostly about institutions, so only these categories are worth an email to a student. NTA notices are all sent. */
const UGC_ALERT_CATEGORIES = ['ADMISSION', 'REGULATION', 'ADVISORY'];
const ALERT_MAX_ITEMS = 8;

/**
 * At most one email a day to a student who turned notice alerts on and confirmed their address. It lists official NTA notices for the
 * student's exam (both exams if none is chosen), and the UGC notices about admissions, regulations and advisories, that were detected
 * after the student turned alerts on or after their last alert. Every item links to the issuing body's own document.
 */
export async function sendNoticeAlerts(env: Bindings, at = new Date(), limit = 500) {
  const out = { candidates: 0, sent: 0, nothingNew: 0, skipped: 0, failed: 0 };
  if (!emailEnabled(env) || !env.PUBLIC_APP_URL) return { ...out, enabled: false };
  const base = appUrl(env);
  const day = istDay(at);
  const now = at.toISOString();
  const { results } = await env.DB
    .prepare(
      `SELECT u.id, u.email, u.display_name, p.unsubscribe_token, p.notice_cursor, p.exam_code FROM student_preferences p JOIN users u ON u.id = p.user_id
       WHERE p.email_notices = 1 AND u.status = 'ACTIVE' AND u.email_verified_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.email = u.email)
         AND NOT EXISTS (SELECT 1 FROM email_messages m WHERE m.dedupe_key = 'notices:' || u.id || ':' || ?1)
       ORDER BY u.id LIMIT ?2`,
    )
    .bind(day, limit)
    .all<{ id: string; email: string; display_name: string; unsubscribe_token: string | null; notice_cursor: string | null; exam_code: string | null }>();
  out.candidates = results.length;
  const ugcIn = UGC_ALERT_CATEGORIES.map(() => '?').join(',');
  for (const u of results) {
    const cursor = u.notice_cursor ?? now;
    const { results: found } = await env.DB
      .prepare(
        `SELECT title, document_url, published_on, authority FROM gov_notices
         WHERE verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL AND first_detected_at > ?1 AND first_detected_at <= ?2
           AND ((authority = 'NTA' AND (?3 IS NULL OR exam_code IS NULL OR exam_code = ?3)) OR (authority = 'UGC' AND category IN (${ugcIn.replace(/\?/g, () => '?')})))
         ORDER BY published_on DESC, first_detected_at DESC LIMIT ${ALERT_MAX_ITEMS + 1}`,
      )
      .bind(cursor, now, u.exam_code, ...UGC_ALERT_CATEGORIES)
      .all<{ title: string; document_url: string; published_on: string | null; authority: string }>();
    if (!found.length) {
      out.nothingNew++;
      await env.DB.prepare('UPDATE student_preferences SET notice_cursor = ? WHERE user_id = ?').bind(now, u.id).run();
      continue;
    }
    const shown = found.slice(0, ALERT_MAX_ITEMS);
    const more = found.length > ALERT_MAX_ITEMS;
    const stop = `${base}/unsubscribe?scope=notices#${u.unsubscribe_token ?? ''}`;
    const body = layout(
      shown.length === 1 ? 'A new official notice' : 'New official notices',
      [`Hello ${u.display_name},`, 'These were published on the official websites of the National Testing Agency (NTA) and the University Grants Commission (UGC). Each link opens the notice itself on the official site.', ...(more ? ['There are more; open the updates page to see all of them.'] : [])],
      { label: 'All government updates', url: `${base}/updates` },
      `You asked for emails about new official notices. Rely on the official notice itself for anything that affects you. To stop these emails, open ${stop} or turn them off on your profile page.`,
      shown.map((n) => ({ label: `${n.authority}${n.published_on ? `, ${n.published_on}` : ''}: ${n.title}`, url: n.document_url })),
    );
    const r = await sendEmail(env, {
      to: u.email, userId: u.id, kind: 'NOTICE_ALERT', subject: shown.length === 1 ? `New official notice: ${shown[0]!.title}`.slice(0, 120) : `${shown.length}${more ? '+' : ''} new official notices`,
      dedupeKey: `notices:${u.id}:${day}`, headers: unsubscribeHeaders(base, u.unsubscribe_token, 'NOTICES'), ...body,
    });
    // A failed alert is kept for a later try, so the student's cursor moves on; one that could not be sent at all (not set up, suppressed) leaves it where it was.
    if (r.status === 'SENT' || r.status === 'FAILED') await env.DB.prepare('UPDATE student_preferences SET notice_cursor = ? WHERE user_id = ?').bind(now, u.id).run();
    if (r.status === 'SENT') out.sent++;
    else if (r.status === 'FAILED') out.failed++;
    else out.skipped++;
  }
  return { ...out, enabled: true };
}

// ---------------------------------------------------------------- delivery events

type Delivery = 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED';

/** Records what happened to a sent email; a hard bounce or a spam complaint suppresses the address. */
export async function recordDeliveryEvent(db: D1Database, e: { providerMessageId: string | null; recipient: string | null; status: Delivery; hardBounce?: boolean; detail?: string }) {
  const now = nowIso();
  const recipient = e.recipient?.trim().toLowerCase() ?? null;
  const statements: D1PreparedStatement[] = [];
  if (e.providerMessageId) {
    // A later "delivered" never hides a bounce or complaint already recorded.
    statements.push(
      db
        .prepare(`UPDATE email_messages SET status = ?, last_error = COALESCE(?, last_error), updated_at = ? WHERE provider_message_id = ? AND (? != 'DELIVERED' OR status = 'SENT')`)
        .bind(e.status, e.detail?.slice(0, 500) ?? null, now, e.providerMessageId, e.status),
    );
  }
  const suppress = e.status === 'COMPLAINED' || (e.status === 'BOUNCED' && e.hardBounce);
  if (suppress && recipient) {
    statements.push(
      db.prepare('INSERT INTO email_suppressions (email, reason, detail, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING').bind(recipient, e.status === 'COMPLAINED' ? 'COMPLAINT' : 'HARD_BOUNCE', e.detail?.slice(0, 500) ?? null, now),
      db.prepare('UPDATE student_preferences SET email_reminders = 0, updated_at = ? WHERE user_id IN (SELECT id FROM users WHERE email = ?)').bind(now, recipient),
    );
  }
  if (statements.length) await db.batch(statements);
  return { suppressed: Boolean(suppress && recipient) };
}

interface CloudflareEmailEvent {
  type?: string;
  payload?: { messageId?: string; recipient?: string; bounce?: { type?: string; reason?: string }; delivery?: { smtpResponse?: string } };
}

/** One Cloudflare Email Sending event from the Queues subscription. */
export async function handleCloudflareEmailEvent(db: D1Database, event: CloudflareEmailEvent) {
  const kind = (event.type ?? '').replace('cf.email.sending.message.', '');
  const status: Delivery | null = kind === 'delivered' ? 'DELIVERED' : kind === 'bounced' ? 'BOUNCED' : kind === 'complained' ? 'COMPLAINED' : kind === 'failed' || kind === 'rejected' ? 'FAILED' : null;
  if (!status) return { ignored: true };
  const p = event.payload ?? {};
  return recordDeliveryEvent(db, { providerMessageId: p.messageId ?? null, recipient: p.recipient ?? null, status, hardBounce: p.bounce?.type === 'hard', detail: p.bounce?.reason ?? p.delivery?.smtpResponse });
}

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Resend webhooks are signed with Svix: HMAC-SHA256 over "<id>.<timestamp>.<raw body>", key = base64 part of the secret. */
export async function verifySvixSignature(secret: string, headers: { id?: string; timestamp?: string; signature?: string }, rawBody: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = await crypto.subtle.importKey('raw', fromB64(secret.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${rawBody}`)));
  for (const part of headers.signature.split(' ')) {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) continue;
    let given: Uint8Array;
    try {
      given = fromB64(value);
    } catch {
      continue;
    }
    if (given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export async function handleResendWebhook(env: Bindings, headers: { id?: string; timestamp?: string; signature?: string }, rawBody: string) {
  if (!env.RESEND_WEBHOOK_SECRET) throw new ApiError(404, 'NOT_FOUND', 'Not found');
  if (!(await verifySvixSignature(env.RESEND_WEBHOOK_SECRET, headers, rawBody))) throw new ApiError(401, 'BAD_SIGNATURE', 'The webhook signature is not valid');
  const event = JSON.parse(rawBody) as { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string; message?: string } } };
  const status: Delivery | null = event.type === 'email.delivered' ? 'DELIVERED' : event.type === 'email.bounced' ? 'BOUNCED' : event.type === 'email.complained' ? 'COMPLAINED' : event.type === 'email.failed' ? 'FAILED' : null;
  if (!status) return { ignored: true };
  return recordDeliveryEvent(env.DB, {
    providerMessageId: event.data?.email_id ?? null, recipient: event.data?.to?.[0] ?? null, status,
    hardBounce: (event.data?.bounce?.type ?? '').toLowerCase() === 'permanent', detail: event.data?.bounce?.message,
  });
}

// ---------------------------------------------------------------- admin overview

export async function emailOverview(env: Bindings) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [byStatus, suppressed, recentFailures, retry, optedIn] = await Promise.all([
    env.DB.prepare('SELECT kind, status, COUNT(*) AS n FROM email_messages WHERE created_at >= ? GROUP BY kind, status ORDER BY kind, status').bind(since).all<{ kind: string; status: string; n: number }>(),
    env.DB.prepare('SELECT reason, COUNT(*) AS n FROM email_suppressions GROUP BY reason').all<{ reason: string; n: number }>(),
    env.DB.prepare(`SELECT kind, status, provider, last_error, created_at FROM email_messages WHERE status IN ('FAILED','BOUNCED','COMPLAINED') ORDER BY created_at DESC LIMIT 20`).all(),
    env.DB
      .prepare(`SELECT COALESCE(SUM(status = 'FAILED' AND payload_json IS NOT NULL), 0) AS waiting, COALESCE(SUM(status = 'FAILED' AND payload_json IS NULL AND retry_count > 0 AND updated_at >= ?1), 0) AS gave_up, COALESCE(SUM(status = 'SENT' AND retry_count > 0 AND updated_at >= ?1), 0) AS recovered FROM email_messages`)
      .bind(since)
      .first<{ waiting: number; gave_up: number; recovered: number }>(),
    env.DB.prepare(`SELECT COALESCE(SUM(email_reminders), 0) AS reminders, COALESCE(SUM(email_notices), 0) AS notices FROM student_preferences`).first<{ reminders: number; notices: number }>(),
  ]);
  const provs = providers(env).map((p) => p.name);
  return {
    enabled: emailEnabled(env),
    providers: providers(env).map((p) => p.name),
    senderSet: Boolean(env.EMAIL_FROM),
    appUrlSet: Boolean(env.PUBLIC_APP_URL),
    last7Days: byStatus.results,
    suppressions: suppressed.results,
    recentFailures: recentFailures.results,
    retries: { waiting: Number(retry?.waiting ?? 0), gaveUpLast7Days: Number(retry?.gave_up ?? 0), recoveredLast7Days: Number(retry?.recovered ?? 0) },
    optedIn: { studyReminders: Number(optedIn?.reminders ?? 0), noticeAlerts: Number(optedIn?.notices ?? 0) },
    // What the Worker can see for itself. Whether the sending domain's DNS records are verified cannot be seen from here:
    // run `node backend/scripts/check-email-dns.mjs <domain>` (see docs/email-domain-setup.md).
    readiness: [
      { key: 'sender', label: 'Sender address (EMAIL_FROM) is set', ok: Boolean(env.EMAIL_FROM) },
      { key: 'appUrl', label: 'Public address of the app (PUBLIC_APP_URL) is set, so emailed links are correct', ok: Boolean(env.PUBLIC_APP_URL) },
      { key: 'provider', label: 'A sending provider is connected (Cloudflare Email binding, or a Resend key)', ok: provs.length > 0 },
      { key: 'standby', label: 'A standby provider is connected (Resend)', ok: provs.includes('cloudflare') && provs.includes('resend') },
      { key: 'resendWebhook', label: 'Resend delivery events are verified (RESEND_WEBHOOK_SECRET)', ok: Boolean(env.RESEND_WEBHOOK_SECRET) || !env.RESEND_API_KEY },
    ],
  };
}
