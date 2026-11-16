import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { handleCloudflareEmailEvent, recordDeliveryEvent, sendEmail, setEmailTransportForTests } from '../src/services/email';
import type { Bindings } from '../src/types';

// Gaps found in the 16 Nov 2026 email audit: spam complaints, "failed" provider events, the one-click POST that mail programs send,
// and a repeated send with the same duplicate key. No real transport is ever used: every send goes to the test function below.
type Sent = { to: string; subject: string; headers: Record<string, string> | undefined };
let outbox: Sent[] = [];
const mail = { ...env, EMAIL_FROM: 'no-reply@send.example.test', PUBLIC_APP_URL: 'https://app.example.test' } as unknown as Bindings;

async function call(method: string, path: string, body?: BodyInit | null, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body }, mail, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
const json = (b: unknown) => JSON.stringify(b);
const JH = { 'content-type': 'application/json' };
let n = 0;
async function student() {
  const email = `aud-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', json({ email, password: 'correct-horse-battery', displayName: 'Asha' }), JH);
  await env.DB.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").bind(r.json.id).run();
  await env.DB.prepare("INSERT OR IGNORE INTO student_preferences (user_id, paper_ids_json, updated_at, unsubscribe_token, email_reminders, email_notices, email_revision) VALUES (?, '[]', datetime('now'), ?, 1, 1, 1)").bind(r.json.id, `tok-${r.json.id}-${'y'.repeat(24)}`).run();
  await env.DB.prepare('UPDATE student_preferences SET email_reminders = 1, email_notices = 1, email_revision = 1 WHERE user_id = ?').bind(r.json.id).run();
  return { id: r.json.id as string, email, token: `tok-${r.json.id}-${'y'.repeat(24)}` };
}
const prefs = (id: string) => env.DB.prepare('SELECT email_reminders, email_notices, email_revision FROM student_preferences WHERE user_id = ?').bind(id).first<{ email_reminders: number; email_notices: number; email_revision: number }>();

beforeEach(() => {
  outbox = [];
  setEmailTransportForTests(async (_e, m) => {
    outbox.push({ to: m.to, subject: m.subject, headers: m.headers });
    return `msg-${outbox.length}-${crypto.randomUUID()}`;
  });
});
afterEach(() => setEmailTransportForTests(null));

describe('email audit: provider events', () => {
  it('a spam complaint blocks the address and turns the reminders off, like a hard bounce', async () => {
    const s = await student();
    const sent = await sendEmail(mail, { to: s.email, userId: s.id, kind: 'ACCOUNT_NOTICE', subject: 'Notice', text: 't', html: '<p>t</p>', dedupeKey: `aud-c-${s.id}` });
    const row = await env.DB.prepare('SELECT provider_message_id FROM email_messages WHERE id = ?').bind(sent.id).first<{ provider_message_id: string }>();
    const r = await handleCloudflareEmailEvent(env.DB, { type: 'cf.email.sending.message.complained', payload: { messageId: row!.provider_message_id, recipient: s.email } });
    expect(r).toEqual({ suppressed: true });
    expect((await env.DB.prepare('SELECT status FROM email_messages WHERE id = ?').bind(sent.id).first<{ status: string }>())!.status).toBe('COMPLAINED');
    expect((await env.DB.prepare('SELECT reason FROM email_suppressions WHERE email = ?').bind(s.email).first<{ reason: string }>())!.reason).toBe('COMPLAINT');
    expect((await prefs(s.id))!.email_reminders).toBe(0);
    outbox = [];
    expect((await sendEmail(mail, { to: s.email, userId: s.id, kind: 'ACCOUNT_NOTICE', subject: 'Again', text: 't', html: '<p>t</p>' })).status).toBe('SUPPRESSED');
    expect(outbox).toHaveLength(0);
  });

  it('a provider "failed" or "rejected" event marks the message failed and does not block the address', async () => {
    const s = await student();
    const sent = await sendEmail(mail, { to: s.email, userId: s.id, kind: 'ACCOUNT_NOTICE', subject: 'Notice', text: 't', html: '<p>t</p>', dedupeKey: `aud-f-${s.id}` });
    const pid = (await env.DB.prepare('SELECT provider_message_id FROM email_messages WHERE id = ?').bind(sent.id).first<{ provider_message_id: string }>())!.provider_message_id;
    expect(await handleCloudflareEmailEvent(env.DB, { type: 'cf.email.sending.message.failed', payload: { messageId: pid, recipient: s.email } })).toEqual({ suppressed: false });
    expect((await env.DB.prepare('SELECT status FROM email_messages WHERE id = ?').bind(sent.id).first<{ status: string }>())!.status).toBe('FAILED');
    expect(await env.DB.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').bind(s.email).first()).toBeNull();
    expect(await recordDeliveryEvent(env.DB, { providerMessageId: null, recipient: s.email, status: 'FAILED' })).toEqual({ suppressed: false });
  });

  it('an event for a message the platform never sent changes nothing', async () => {
    const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM email_suppressions').first<{ n: number }>())!.n;
    expect(await handleCloudflareEmailEvent(env.DB, { type: 'cf.email.sending.message.delivered', payload: { messageId: 'unknown-id', recipient: 'nobody@example.test' } })).toEqual({ suppressed: false });
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM email_suppressions').first<{ n: number }>())!.n).toBe(before);
  });
});

describe('email audit: unsubscribe and duplicates', () => {
  it('the one-click POST that mail programs send (token in the address, form body) stops the emails without signing in', async () => {
    const s = await student();
    const r = await call('POST', `/api/public/email/unsubscribe?token=${s.token}&scope=REMINDERS`, 'List-Unsubscribe=One-Click', { 'content-type': 'application/x-www-form-urlencoded' });
    expect(r.status).toBe(200);
    expect(await prefs(s.id)).toEqual({ email_reminders: 0, email_notices: 1, email_revision: 0 });
    // the same click again, and a wrong token, both answer the same and change nothing more
    expect((await call('POST', `/api/public/email/unsubscribe?token=${s.token}&scope=REMINDERS`, 'List-Unsubscribe=One-Click', { 'content-type': 'application/x-www-form-urlencoded' })).json).toEqual(r.json);
    expect((await call('POST', `/api/public/email/unsubscribe?token=${'z'.repeat(40)}&scope=ALL`, 'List-Unsubscribe=One-Click', { 'content-type': 'application/x-www-form-urlencoded' })).json).toEqual(r.json);
    expect(await prefs(s.id)).toEqual({ email_reminders: 0, email_notices: 1, email_revision: 0 });
  });

  it('the same duplicate key sends once, whatever the kind or the recipient asks for later', async () => {
    const s = await student();
    const m = { to: s.email, userId: s.id, kind: 'ACCOUNT_NOTICE' as const, subject: 'Once', text: 't', html: '<p>t</p>', dedupeKey: `aud-d-${s.id}` };
    expect((await sendEmail(mail, m)).status).toBe('SENT');
    expect((await sendEmail(mail, m)).status).toBe('DUPLICATE');
    expect((await sendEmail(mail, { ...m, kind: 'WELCOME' })).status).toBe('DUPLICATE');
    expect(outbox.filter((o) => o.subject === 'Once')).toHaveLength(1);
  });
});
