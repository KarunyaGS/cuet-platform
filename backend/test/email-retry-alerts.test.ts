import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { RETRY_BACKOFF_MINUTES, retryFailedEmails, sendEmail, sendNoticeAlerts, setEmailTransportForTests } from '../src/services/email';
import type { Bindings } from '../src/types';

type Sent = { to: string; subject: string; text: string; html: string; headers: Record<string, string> | undefined };
let outbox: Sent[] = [];
let mode: 'ok' | 'down' | 'rejected' = 'ok';
const mail = { ...env, EMAIL_FROM: 'no-reply@send.example.test', PUBLIC_APP_URL: 'https://app.example.test' } as unknown as Bindings;
const off = { ...env, EMAIL_FROM: undefined } as unknown as Bindings;
const ADMIN = { 'x-admin-token': 'test-admin-token' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = mail) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
/** A student, signed in, with a confirmed address. */
async function student(verified = true, role?: string) {
  const email = `ra-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Asha' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  if (verified) await env.DB.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").bind(r.json.id).run();
  return { id: r.json.id as string, email, cookie: s.cookie, h: { cookie: s.cookie } };
}
const row = (id: string) => env.DB.prepare('SELECT * FROM email_messages WHERE id = ?').bind(id).first<Record<string, string | number | null>>();
const minutes = (m: number) => new Date(Date.now() + m * 60_000);
/** Notice-alert emails only (a sign-up also sends a "confirm your email" message). */
const alertsTo = (to: string) => outbox.filter((o) => o.to === to && /new official notice/i.test(o.subject));

beforeEach(() => {
  outbox = [];
  mode = 'ok';
  setEmailTransportForTests(async (_env, m) => {
    if (mode === 'down') throw Object.assign(new Error('provider down'), { code: 'E_INTERNAL_SERVER_ERROR' });
    if (mode === 'rejected') throw Object.assign(new Error('invalid recipient'), { code: 'RESEND_422' });
    outbox.push({ to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
    return `msg-${outbox.length}-${crypto.randomUUID()}`;
  });
});
afterEach(() => setEmailTransportForTests(null));

describe('retrying failed emails', () => {
  const reminder = (to: string, key: string) => ({ to, userId: null, kind: 'STUDY_REMINDER' as const, subject: 'Your study plan for today', text: 'Open Prepora to see today.', html: '<p>Open Prepora</p>', dedupeKey: key });

  it('keeps a harmless email that failed, and sends it later with the same words, then erases the kept copy', async () => {
    mode = 'down';
    const r = await sendEmail(mail, reminder('retry-ok@example.test', 'retry-ok-1'));
    expect(r.status).toBe('FAILED');
    let m = (await row(r.id!))!;
    expect(m).toMatchObject({ status: 'FAILED', retry_count: 0 });
    expect(JSON.parse(String(m.payload_json))).toMatchObject({ subject: 'Your study plan for today', text: 'Open Prepora to see today.' });
    const wait = (Date.parse(String(m.next_attempt_at)) - Date.now()) / 60_000;
    expect(wait).toBeGreaterThan(4);
    expect(wait).toBeLessThan(6);
    // Not due yet: nothing is tried.
    expect(await retryFailedEmails(mail, minutes(1))).toMatchObject({ due: 0, sent: 0 });
    // Due, and the provider is back.
    mode = 'ok';
    expect(await retryFailedEmails(mail, minutes(6))).toMatchObject({ due: 1, sent: 1 });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'retry-ok@example.test', subject: 'Your study plan for today', text: 'Open Prepora to see today.' });
    m = (await row(r.id!))!;
    expect(m).toMatchObject({ status: 'SENT', retry_count: 1, payload_json: null, next_attempt_at: null });
    expect(m.sent_at).toBeTruthy();
    // Nothing is sent twice.
    expect(await retryFailedEmails(mail, minutes(60))).toMatchObject({ due: 0 });
    expect(outbox).toHaveLength(1);
  });

  it('waits longer after each failure and gives up after the last retry, erasing the kept copy', async () => {
    mode = 'down';
    // An account notice stays useful for 48 hours, so it can go through every step. (A study reminder is dropped after 6 hours.)
    const r = await sendEmail(mail, { ...reminder('retry-down@example.test', 'retry-down-1'), kind: 'ACCOUNT_NOTICE' });
    let at = 0;
    for (let i = 0; i < RETRY_BACKOFF_MINUTES.length; i++) {
      at += RETRY_BACKOFF_MINUTES[i]! + 1;
      const out = await retryFailedEmails(mail, minutes(at));
      expect(out.due, `round ${i + 1}`).toBe(1);
      const m = (await row(r.id!))!;
      if (i < RETRY_BACKOFF_MINUTES.length - 1) {
        expect(out.stillFailing).toBe(1);
        expect(m.retry_count).toBe(i + 1);
        expect(m.payload_json).not.toBeNull();
        // The next wait is the next backoff step.
        expect(Math.round((Date.parse(String(m.next_attempt_at)) - (Date.now() + at * 60_000)) / 60_000)).toBe(RETRY_BACKOFF_MINUTES[i + 1]);
      } else {
        expect(out.gaveUp).toBe(1);
        expect(m).toMatchObject({ status: 'FAILED', payload_json: null, next_attempt_at: null, retry_count: RETRY_BACKOFF_MINUTES.length });
        expect(String(m.last_error)).toMatch(/Given up after 5 retries/);
      }
    }
    expect(outbox).toHaveLength(0);
    expect(await retryFailedEmails(mail, minutes(at + 5000))).toMatchObject({ due: 0 });
  });

  it('does not send a reminder that is too old to be useful', async () => {
    mode = 'down';
    const r = await sendEmail(mail, reminder('retry-old@example.test', 'retry-old-1'));
    mode = 'ok';
    // A study reminder is useful for 6 hours.
    expect(await retryFailedEmails(mail, minutes(7 * 60))).toMatchObject({ due: 1, expired: 1, sent: 0 });
    expect(outbox).toHaveLength(0);
    expect(await row(r.id!)).toMatchObject({ status: 'FAILED', payload_json: null, next_attempt_at: null });
    expect(String((await row(r.id!))!.last_error)).toMatch(/too old/);
  });

  it('never retries an address that has since bounced, and keeps nothing for a rejected address', async () => {
    mode = 'down';
    const r = await sendEmail(mail, reminder('retry-supp@example.test', 'retry-supp-1'));
    await env.DB.prepare("INSERT INTO email_suppressions (email, reason, created_at) VALUES ('retry-supp@example.test', 'HARD_BOUNCE', datetime('now'))").run();
    mode = 'ok';
    expect(await retryFailedEmails(mail, minutes(6))).toMatchObject({ suppressed: 1, sent: 0 });
    expect(await row(r.id!)).toMatchObject({ status: 'SUPPRESSED', payload_json: null });
    expect(outbox).toHaveLength(0);
    // A permanent answer from the provider (the address or request is refused) is not worth trying again.
    mode = 'rejected';
    const bad = await sendEmail(mail, reminder('retry-bad@example.test', 'retry-bad-1'));
    expect(bad.status).toBe('FAILED');
    expect(await row(bad.id!)).toMatchObject({ status: 'FAILED', payload_json: null, next_attempt_at: null });
  });

  it('never keeps an email with a one-time link: a failed password reset or confirmation leaves nothing to retry', async () => {
    const s = await student(false);
    mode = 'down';
    await call('POST', '/api/auth/forgot-password', { email: s.email });
    await call('POST', '/api/student/email/verification', {}, s.h);
    const rows = (await env.DB.prepare("SELECT kind, status, payload_json, next_attempt_at FROM email_messages WHERE to_email = ? AND status = 'FAILED'").bind(s.email).all<Record<string, string | null>>()).results;
    expect(rows.map((r) => r.kind)).toEqual(expect.arrayContaining(['PASSWORD_RESET', 'VERIFY_EMAIL']));
    expect(rows.every((r) => r.payload_json === null && r.next_attempt_at === null)).toBe(true);
    mode = 'ok';
    const before = outbox.length;
    expect(await retryFailedEmails(mail, minutes(24 * 60))).toMatchObject({ sent: 0 });
    expect(outbox).toHaveLength(before); // nothing went out: there was nothing kept to send
  });

  it('does nothing while email is switched off', async () => {
    expect(await retryFailedEmails(off)).toMatchObject({ enabled: false, due: 0 });
  });
});

describe('emails about new official notices', () => {
  const notice = async (over: Record<string, string | number | null>) => {
    const id = `gn_ra_${Math.random().toString(36).slice(2)}`;
    const v = { id, source_key: 'k', source_name: 'Source', source_url: 'https://example.test/', document_url: `https://nta.ac.in/${id}.pdf`, is_pdf: 1, title: 'A notice', category: 'GENERAL', exam_code: null, published_on: '2026-11-10',
      verification_status: 'PUBLISHED', duplicate_of_id: null, content_hash: id, first_detected_at: minutes(0.5).toISOString(), authority: 'NTA', ...over };
    await env.DB
      .prepare(`INSERT INTO gov_notices (id, source_key, source_name, source_url, document_url, is_pdf, title, category, exam_code, published_on, verification_status, duplicate_of_id, content_hash, first_detected_at, last_checked_at, updated_at, authority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(v.id, v.source_key, v.source_name, v.source_url, v.document_url, v.is_pdf, v.title, v.category, v.exam_code, v.published_on, v.verification_status, v.duplicate_of_id, v.content_hash, v.first_detected_at, v.first_detected_at, v.first_detected_at, v.authority)
      .run();
    return v;
  };
  const clean = () => env.DB.prepare('DELETE FROM gov_notices').run();
  const subscribe = async (exam: 'CUET_UG' | 'CUET_PG' | null = 'CUET_UG') => {
    const s = await student();
    expect((await call('PUT', '/api/student/email', { emailNotices: true }, s.h)).json).toMatchObject({ emailNotices: true, emailReminders: false });
    if (exam) await env.DB.prepare('UPDATE student_preferences SET exam_code = ? WHERE user_id = ?').bind(exam, s.id).run();
    return s;
  };

  it('is off until the student turns it on, and only for a confirmed address', async () => {
    const unconfirmed = await student(false);
    const refused = await call('PUT', '/api/student/email', { emailNotices: true }, unconfirmed.h);
    expect(refused.status).toBe(409);
    expect(refused.json.error.code).toBe('EMAIL_NOT_VERIFIED');
    const s = await student();
    expect((await call('GET', '/api/student/email', undefined, s.h)).json).toMatchObject({ emailNotices: false, emailReminders: false });
    expect((await call('PUT', '/api/student/email', {}, s.h)).status).toBeGreaterThanOrEqual(400);
    // The earlier setting still works on its own and leaves notices alone.
    expect((await call('PUT', '/api/student/email', { emailReminders: true }, s.h)).json).toMatchObject({ emailReminders: true, emailNotices: false });
    expect((await call('PUT', '/api/student/email', { emailNotices: true }, s.h)).json).toMatchObject({ emailReminders: true, emailNotices: true });
  });

  it('sends one email with the notices that are new, relevant and published, each linked to the issuing body\'s own document', async () => {
    await clean();
    const s = await subscribe('CUET_UG');
    const ug = await notice({ title: 'Release of Admit Cards for CUET (UG) 2027', category: 'ADMIT_CARD', exam_code: 'CUET_UG' });
    const ugc = await notice({ title: 'UGC letter regarding: Admission schedule for 2027', category: 'ADMISSION', authority: 'UGC', document_url: 'https://www.ugc.gov.in/pdfnews/1_adm.pdf' });
    await notice({ title: 'Schedule of CUET (PG) 2027 examination', category: 'EXAM_SCHEDULE', exam_code: 'CUET_PG' }); // the other exam
    await notice({ title: 'UGC letter regarding: Kashi Tamil Sangamam', category: 'GENERAL', authority: 'UGC', document_url: 'https://www.ugc.gov.in/pdfnews/2_kts.pdf' }); // not about admissions
    await notice({ title: 'Waiting for a check', category: 'GENERAL', verification_status: 'NEEDS_REVIEW' });
    await notice({ title: 'A duplicate of another notice', category: 'GENERAL', duplicate_of_id: ug.id });
    await notice({ title: 'Found before the student turned alerts on', category: 'GENERAL', first_detected_at: '2020-01-01T00:00:00.000Z' });
    const run = await sendNoticeAlerts(mail, minutes(1));
    expect(run).toMatchObject({ enabled: true });
    expect(run.sent).toBeGreaterThanOrEqual(1);
    const mine = alertsTo(s.email);
    expect(mine).toHaveLength(1);
    const m = mine[0]!;
    expect(m.subject).toBe('2 new official notices');
    expect(m.text).toContain('Release of Admit Cards for CUET (UG) 2027');
    expect(m.text).toContain(ug.document_url);
    expect(m.text).toContain('UGC letter regarding: Admission schedule for 2027');
    expect(m.text).toContain(ugc.document_url);
    for (const left of ['Schedule of CUET (PG)', 'Kashi Tamil', 'Waiting for a check', 'A duplicate', 'Found before']) expect(m.text).not.toContain(left);
    expect(m.text).toMatch(/Rely on the official notice itself/);
    expect(m.html).toContain(`href="${ug.document_url}"`);
    // One click to stop, in the message and in the headers a mail program reads.
    const stop = /https:\/\/app\.example\.test\/unsubscribe\?scope=notices#([\w-]+)/.exec(m.text);
    expect(stop).toBeTruthy();
    expect(m.headers).toMatchObject({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    expect(m.headers!['List-Unsubscribe']).toMatch(new RegExp(`^<https://app\\.example\\.test/api/public/email/unsubscribe\\?token=${stop![1]}&scope=NOTICES>$`));
    // At most one a day, and nothing again for notices already included.
    await sendNoticeAlerts(mail, minutes(2));
    expect(alertsTo(s.email)).toHaveLength(1);
  });

  it('sends nothing when nothing is new, or to a student who has not asked, or whose address is blocked', async () => {
    await clean();
    const quiet = await subscribe('CUET_UG');
    const never = await student();
    const blocked = await subscribe('CUET_UG');
    await env.DB.prepare("INSERT INTO email_suppressions (email, reason, created_at) VALUES (?, 'COMPLAINT', datetime('now'))").bind(blocked.email).run();
    await notice({ title: 'Release of Admit Cards for CUET (UG) 2027', category: 'ADMIT_CARD', exam_code: 'CUET_UG', first_detected_at: '2020-01-01T00:00:00.000Z' });
    await sendNoticeAlerts(mail, minutes(1));
    expect([quiet, never, blocked].flatMap((x) => alertsTo(x.email))).toEqual([]);
  });

  it('limits one email to eight notices and says there are more; a student with no exam chosen gets both exams', async () => {
    await clean();
    const s = await subscribe(null);
    for (let i = 0; i < 10; i++) await notice({ title: `Notice number ${i} for CUET`, category: 'GENERAL', exam_code: i % 2 ? 'CUET_UG' : 'CUET_PG', published_on: `2026-11-${String(10 - (i % 9)).padStart(2, '0')}` });
    await sendNoticeAlerts(mail, minutes(1));
    const m = alertsTo(s.email)[0]!;
    expect(m.subject).toBe('8+ new official notices');
    expect((m.text.match(/Notice number/g) ?? []).length).toBe(8);
    expect(m.text).toMatch(/There are more/);
  });

  it('keeps a failed alert for a retry, and does not lose or repeat it', async () => {
    await clean();
    const s = await subscribe('CUET_UG');
    await notice({ title: 'Release of Admit Cards for CUET (UG) 2027', category: 'ADMIT_CARD', exam_code: 'CUET_UG' });
    mode = 'down';
    await sendNoticeAlerts(mail, minutes(1));
    const kept = (await env.DB.prepare("SELECT id, status, payload_json FROM email_messages WHERE to_email = ? AND kind = 'NOTICE_ALERT'").bind(s.email).first<{ id: string; status: string; payload_json: string }>())!;
    expect(kept.status).toBe('FAILED');
    expect(JSON.parse(kept.payload_json).text).toContain('Release of Admit Cards');
    mode = 'ok';
    await retryFailedEmails(mail, minutes(7));
    expect(alertsTo(s.email)).toHaveLength(1);
    // A later run the same day finds the cursor moved on and the day's email already logged.
    await sendNoticeAlerts(mail, minutes(8));
    expect(alertsTo(s.email)).toHaveLength(1);
  });
  it('in the limited catalogue the digest sends what the site shows: CUET-UG notices and UGC notices about CUET or admissions, not CUET-PG or unrelated UGC notices', async () => {
    await clean();
    const scoped = { ...mail, ACTIVE_EXAMS: 'CUET_UG', CATALOGUE_SCOPE: 'ug-science' } as unknown as Bindings;
    const s = await subscribe(null);
    await notice({ title: 'Release of Admit Cards for CUET (UG) 2027', category: 'ADMIT_CARD', exam_code: 'CUET_UG' });
    await notice({ title: 'Release of Admit Cards for CUET (PG) 2027', category: 'ADMIT_CARD', exam_code: 'CUET_PG' });
    await notice({ title: 'UGC advisory on admission through CUET', category: 'ADVISORY', exam_code: null, authority: 'UGC' });
    await notice({ title: 'UGC advisory on Vigilance Awareness Week', category: 'ADVISORY', exam_code: null, authority: 'UGC' });
    const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM gov_notices').first<{ n: number }>())!.n;
    await sendNoticeAlerts(scoped, minutes(1));
    const text = alertsTo(s.email).map((m) => m.text).join(' | ');
    expect(text).toContain('Admit Cards for CUET (UG)');
    expect(text).toContain('admission through CUET');
    expect(text).not.toContain('CUET (PG)');
    expect(text).not.toContain('Vigilance');
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM gov_notices').first<{ n: number }>())!.n).toBe(before);
  });
});

describe('stopping emails', () => {
  it('stops only what the link says, in one click and without signing in; an unknown token changes nothing and answers the same', async () => {
    const s = await student();
    await call('PUT', '/api/student/email', { emailReminders: true }, s.h);
    await call('PUT', '/api/student/email', { emailNotices: true }, s.h);
    const token = (await env.DB.prepare('SELECT unsubscribe_token AS t FROM student_preferences WHERE user_id = ?').bind(s.id).first<{ t: string }>())!.t;
    // As a mail program does it: a POST to the header address, token in the query string.
    const one = await call('POST', `/api/public/email/unsubscribe?token=${token}&scope=notices`, undefined, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(one.json).toEqual({ unsubscribed: true });
    expect((await call('GET', '/api/student/email', undefined, s.h)).json).toMatchObject({ emailNotices: false, emailReminders: true });
    // The page posts JSON; the old form (no scope) still stops reminders only.
    expect((await call('POST', '/api/public/email/unsubscribe', { token })).json).toEqual({ unsubscribed: true });
    expect((await call('GET', '/api/student/email', undefined, s.h)).json).toMatchObject({ emailNotices: false, emailReminders: false });
    await call('PUT', '/api/student/email', { emailReminders: true, emailNotices: true }, s.h);
    expect((await call('POST', '/api/public/email/unsubscribe', { token, scope: 'ALL' })).json).toEqual({ unsubscribed: true });
    expect((await call('GET', '/api/student/email', undefined, s.h)).json).toMatchObject({ emailNotices: false, emailReminders: false });
    const unknown = await call('POST', '/api/public/email/unsubscribe?token=this-token-does-not-exist-anywhere&scope=notices');
    expect(unknown.json).toEqual({ unsubscribed: true });
  });
});

describe('what staff can see', () => {
  it('shows what is set up, what is waiting for a retry, and who has asked for which emails', async () => {
    const staff = await student(true, 'SUPER_ADMIN');
    mode = 'down';
    await sendEmail(mail, { to: 'overview@example.test', userId: null, kind: 'STUDY_REMINDER', subject: 'x', text: 'x', html: '<p>x</p>', dedupeKey: 'overview-1' });
    const o = (await call('GET', '/api/console/email', undefined, staff.h)).json;
    expect(o.retries.waiting).toBeGreaterThanOrEqual(1);
    expect(o.optedIn).toMatchObject({ studyReminders: expect.any(Number), noticeAlerts: expect.any(Number) });
    const by = Object.fromEntries(o.readiness.map((r: { key: string; ok: boolean }) => [r.key, r.ok]));
    // The test setup sets a sender and an app address and one (test) provider, but no standby.
    expect(by).toMatchObject({ sender: true, appUrl: true, provider: true, standby: false, resendWebhook: true });
    // And with email off, the same list says what is missing.
    const offView = (await call('GET', '/api/console/email', undefined, staff.h, off)).json;
    expect(Object.fromEntries(offView.readiness.map((r: { key: string; ok: boolean }) => [r.key, r.ok]))).toMatchObject({ sender: false });
    mode = 'ok';
  });
});
