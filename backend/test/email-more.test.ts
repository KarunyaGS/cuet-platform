import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { sendEmail, sendExamCountdowns, sendRevisionReminders, setEmailTransportForTests } from '../src/services/email';
import { TEMPLATE_NAMES, sampleEmail, templates } from '../src/services/email-templates';
import type { Bindings } from '../src/types';

type Sent = { to: string; subject: string; text: string; html: string; headers: Record<string, string> | undefined };
let outbox: Sent[] = [];
const mail = { ...env, EMAIL_FROM: 'no-reply@send.example.test', PUBLIC_APP_URL: 'https://app.example.test' } as unknown as Bindings;
const off = { ...env, EMAIL_FROM: undefined } as unknown as Bindings;
const ADMIN = { 'x-admin-token': 'test-admin-token' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = mail) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...(e.PUBLIC_APP_URL ? { origin: 'https://app.example.test' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
async function student(opts: { verified?: boolean; role?: string; name?: string } = {}) {
  const email = `more-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: opts.name ?? 'Asha' });
  if (opts.role) await call('POST', '/api/admin/users/roles', { email, role: opts.role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  if (opts.verified !== false) await env.DB.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").bind(r.json.id).run();
  return { id: r.json.id as string, email, h: { cookie: s.cookie } };
}
const istDay = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
const to = (email: string) => outbox.filter((o) => o.to === email);

beforeEach(() => {
  outbox = [];
  setEmailTransportForTests(async (_e, m) => {
    outbox.push({ to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
    return `msg-${outbox.length}-${crypto.randomUUID()}`;
  });
});
afterEach(() => setEmailTransportForTests(null));

const setPrefs = async (id: string, sql: string, ...b: unknown[]) => {
  await env.DB.prepare("INSERT OR IGNORE INTO student_preferences (user_id, paper_ids_json, updated_at, unsubscribe_token) VALUES (?, '[]', datetime('now'), ?)").bind(id, `tok-${id}-${'x'.repeat(24)}`).run();
  await env.DB.prepare(`UPDATE student_preferences SET ${sql} WHERE user_id = ?`).bind(...b, id).run();
};

describe('welcome email', () => {
  it('is sent once, only after the address is confirmed, and a repeat confirmation sends no second one', async () => {
    const s = await student({ verified: false, name: 'Meera' });
    expect(to(s.email).map((m) => m.subject)).toEqual(['Confirm your email for Prepora']);
    const token = /verify-email#([\w-]+)/.exec(to(s.email)[0]!.text)![1]!;
    expect((await call('POST', '/api/auth/verify-email', { token })).json).toEqual({ verified: true });
    const welcome = to(s.email).filter((m) => m.subject === 'Welcome to Prepora');
    expect(welcome).toHaveLength(1);
    expect(welcome[0]!.text).toContain('Hello Meera,');
    expect(welcome[0]!.text).toContain('https://app.example.test/dashboard');
    // The same link cannot be used again, so no second welcome; the duplicate key also holds if it is asked for directly.
    expect((await call('POST', '/api/auth/verify-email', { token })).status).toBe(400);
    const { sendWelcomeEmail } = await import('../src/services/email');
    await sendWelcomeEmail(mail, s.id, 'https://app.example.test');
    expect(to(s.email).filter((m) => m.subject === 'Welcome to Prepora')).toHaveLength(1);
  });

  it('is never sent to an unconfirmed address', async () => {
    const s = await student({ verified: false });
    const { sendWelcomeEmail } = await import('../src/services/email');
    await sendWelcomeEmail(mail, s.id, 'https://app.example.test');
    expect(to(s.email).some((m) => m.subject === 'Welcome to Prepora')).toBe(false);
  });
});

describe('profile settings for the new emails', () => {
  it('saves the exam date and the revision switch, and refuses a past, far, impossible or unconfirmed request', async () => {
    const s = await student();
    const day = istDay(40);
    const ok = await call('PUT', '/api/student/email', { examDate: day, emailRevision: true }, s.h);
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ examDate: day, emailRevision: true, emailReminders: false });
    expect((await call('PUT', '/api/student/email', { examDate: null }, s.h)).json.examDate).toBeNull();
    expect((await call('PUT', '/api/student/email', { examDate: istDay(-2) }, s.h)).status).toBe(422);
    expect((await call('PUT', '/api/student/email', { examDate: istDay(1500) }, s.h)).status).toBe(422);
    expect((await call('PUT', '/api/student/email', { examDate: '2027-02-30' }, s.h)).status).toBe(400);
    expect((await call('PUT', '/api/student/email', { examDate: 'next May' }, s.h)).status).toBe(400);
    const raw = await student({ verified: false });
    expect((await call('PUT', '/api/student/email', { emailRevision: true }, raw.h)).status).toBe(409);
  });
});

describe('exam countdown', () => {
  const ready = async (days: number, reminders = true) => {
    const s = await student({ name: 'Ravi' });
    await setPrefs(s.id, 'email_reminders = ?, exam_date = ?', reminders ? 1 : 0, istDay(days));
    return s;
  };

  it('goes out on exactly 30, 7 and 1 days before, once each, and on no other day', async () => {
    const out: Record<number, number> = {};
    for (const d of [31, 30, 29, 8, 7, 6, 2, 1, 0]) {
      outbox = [];
      const s = await ready(d);
      await sendExamCountdowns(mail);
      out[d] = to(s.email).filter((m) => /to your exam|exam is tomorrow/.test(m.subject)).length;
      // a second run the same day sends nothing more
      await sendExamCountdowns(mail);
      expect(to(s.email).filter((m) => /to your exam|exam is tomorrow/.test(m.subject)).length).toBe(out[d]);
    }
    expect(out).toEqual({ 31: 0, 30: 1, 29: 0, 8: 0, 7: 1, 6: 0, 2: 0, 1: 1, 0: 0 });
  });

  it('says the date is the student’s own, names the date, and carries an unsubscribe link and header', async () => {
    const s = await ready(7);
    await sendExamCountdowns(mail);
    const m = to(s.email).find((x) => x.subject === '7 days to your exam')!;
    expect(m.text).toContain('Hello Ravi,');
    expect(m.text).toContain('the date you entered');
    expect(m.text).toMatch(/unsubscribe#tok-/);
    expect(m.headers?.['List-Unsubscribe']).toContain('scope=REMINDERS');
    expect(m.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('is not sent without the reminders switch, to an unconfirmed address, to a suppressed address, or while email is off', async () => {
    const a = await ready(7, false);
    const b = await student({ verified: false });
    await setPrefs(b.id, 'email_reminders = 1, exam_date = ?', istDay(7));
    const c = await ready(7);
    await env.DB.prepare("INSERT INTO email_suppressions (email, reason, created_at) VALUES (?, 'HARD_BOUNCE', datetime('now'))").bind(c.email).run();
    await sendExamCountdowns(mail);
    expect([a, b, c].map((s) => to(s.email).filter((m) => /exam/.test(m.subject)).length)).toEqual([0, 0, 0]);
    const d = await ready(7);
    outbox = [];
    expect(await sendExamCountdowns(off)).toMatchObject({ enabled: false, sent: 0 });
    expect(to(d.email)).toHaveLength(0);
  });

  it('stops after the student unsubscribes from reminders', async () => {
    const s = await ready(7);
    await call('POST', '/api/public/email/unsubscribe', { token: `tok-${s.id}-${'x'.repeat(24)}`, scope: 'REMINDERS' });
    await sendExamCountdowns(mail);
    expect(to(s.email).filter((m) => /exam/.test(m.subject))).toHaveLength(0);
  });
});

describe('revision reminders', () => {
  const card = (userId: string, due: string, questionId: string | null = null) =>
    env.DB.prepare(
      `INSERT INTO flashcards (id, user_id, concept_key, resource_id, block_type, lesson_title, front, back, due_on, question_id, created_at, updated_at) VALUES (?, ?, ?, 'res', 'DEFINITION', 'Lesson', 'Front', 'Back', ?, ?, datetime('now'), datetime('now'))`,
    ).bind(`fc_${crypto.randomUUID()}`, userId, `ck-${crypto.randomUUID()}`, due, questionId).run();

  it('counts only due cards, sends once a day, and links to the revision page', async () => {
    const s = await student({ name: 'Tara' });
    await setPrefs(s.id, 'email_revision = 1');
    await card(s.id, istDay(0));
    await card(s.id, istDay(-3));
    await card(s.id, istDay(5));
    await sendRevisionReminders(mail);
    await sendRevisionReminders(mail);
    const m = to(s.email).filter((x) => /to revise today/.test(x.subject));
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('2 cards to revise today');
    expect(m[0]!.text).toContain('https://app.example.test/bookmarks/review');
    expect(m[0]!.headers?.['List-Unsubscribe']).toBeTruthy();
  });

  it('sends nothing when no card is due yet, or when the student has no cards', async () => {
    const none = await student();
    await setPrefs(none.id, 'email_revision = 1');
    await card(none.id, istDay(4));
    const empty = await student();
    await setPrefs(empty.id, 'email_revision = 1');
    const r = await sendRevisionReminders(mail);
    expect(to(none.email).filter((x) => /revise/.test(x.subject))).toHaveLength(0);
    expect(to(empty.email).filter((x) => /revise/.test(x.subject))).toHaveLength(0);
    expect(r.nothingDue).toBeGreaterThanOrEqual(2);
  });

  it('needs its own switch: study reminders alone do not turn it on, and a reminders unsubscribe turns it off', async () => {
    const a = await student();
    await setPrefs(a.id, 'email_reminders = 1, email_revision = 0');
    await card(a.id, istDay(0));
    const b = await student();
    await setPrefs(b.id, 'email_revision = 1');
    await card(b.id, istDay(0));
    await call('POST', '/api/public/email/unsubscribe', { token: `tok-${b.id}-${'x'.repeat(24)}`, scope: 'REMINDERS' });
    await sendRevisionReminders(mail);
    expect(to(a.email).filter((x) => /revise/.test(x.subject))).toHaveLength(0);
    expect(to(b.email).filter((x) => /revise/.test(x.subject))).toHaveLength(0);
    expect((await env.DB.prepare('SELECT email_revision FROM student_preferences WHERE user_id = ?').bind(b.id).first<{ email_revision: number }>())!.email_revision).toBe(0);
  });
});

describe('templates', () => {
  it('every message has a plain-text part, a button or link that works as text, and nothing from a student is run as HTML', async () => {
    for (const name of TEMPLATE_NAMES) {
      const m = sampleEmail(name, 'https://app.example.test');
      expect(m.subject.length, name).toBeGreaterThan(3);
      expect(m.text, name).toContain('Hello Asha,');
      if (name !== 'passwordChanged') expect(m.text, name).toMatch(/https:\/\//);
      expect(m.html, name).toContain('<!doctype html>');
      expect(m.html, name).toContain('max-width:520px');
      expect(m.html, name).not.toMatch(/<script|javascript:/i);
    }
    const evil = templates.welcome('<img src=x onerror=alert(1)>', 'https://app.example.test');
    expect(evil.html).not.toContain('<img');
    expect(evil.html).toContain('&lt;img');
  });

  it('every reminder-type message tells the student how to stop it', () => {
    for (const name of ['studyReminder', 'examCountdown', 'revisionDue', 'noticeAlert'] as const) {
      const m = sampleEmail(name, 'https://app.example.test');
      expect(m.text, name).toMatch(/To stop (them|these emails), open https:\/\/app\.example\.test\/unsubscribe/);
    }
  });

  it('never states a date, price or result that was not given to it', () => {
    const m = templates.examCountdown('Asha', 30, '20 May 2027', 'https://app.example.test', 'x');
    expect(m.text).toContain('20 May 2027');
    expect(m.text).toContain('official date is on the NTA website');
  });
});

describe('staff preview and test sending', () => {
  it('previews every template without sending, for staff only', async () => {
    const staff = await student({ role: 'SUPER_ADMIN' });
    const list = await call('GET', '/api/console/email/templates', undefined, staff.h);
    expect(list.json.templates).toEqual([...TEMPLATE_NAMES]);
    outbox = [];
    for (const t of TEMPLATE_NAMES) {
      const r = await call('GET', `/api/console/email/preview/${t}`, undefined, staff.h);
      expect(r.status, t).toBe(200);
      expect(r.json.html).toContain('<!doctype html>');
    }
    expect(outbox).toHaveLength(0);
    expect((await call('GET', '/api/console/email/preview/not-a-template', undefined, staff.h)).status).toBe(400);
    const plain = await student();
    expect((await call('GET', '/api/console/email/preview/welcome', undefined, plain.h)).status).toBe(403);
  });

  it('sends a test only to the signed-in staff member’s own address, marked as a test, with no way to name anyone else', async () => {
    const staff = await student({ role: 'SUPER_ADMIN' });
    const other = await student();
    outbox = [];
    const r = await call('POST', '/api/console/email/test', { templates: ['welcome', 'examCountdown'], to: other.email }, staff.h);
    expect(r.status).toBe(200);
    expect(r.json.to).toBe(staff.email);
    expect(outbox.map((m) => m.to)).toEqual([staff.email, staff.email]);
    expect(outbox.every((m) => m.subject.startsWith('[Test] '))).toBe(true);
    expect(outbox[0]!.text).toContain('This is a test message with sample data.');
    expect(to(other.email)).toHaveLength(0);
    const plain = await student();
    expect((await call('POST', '/api/console/email/test', {}, plain.h)).status).toBe(403);
    expect((await call('POST', '/api/console/email/test', {}, ADMIN)).status).toBe(401);
  });

  it('caps test emails per hour, and refuses while email is off', async () => {
    const staff = await student({ role: 'SUPER_ADMIN' });
    for (let i = 0; i < 3; i++) expect((await call('POST', '/api/console/email/test', {}, staff.h)).status).toBe(200);
    expect((await call('POST', '/api/console/email/test', {}, staff.h)).status).toBe(409);
    const off2 = await student({ role: 'SUPER_ADMIN' });
    const r = await call('POST', '/api/console/email/test', {}, off2.h, off);
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('EMAIL_NOT_CONFIGURED');
  });
});

describe('delivery and failures stay visible to staff', () => {
  it('the overview counts the new kinds, the new opt-ins and failed sends', async () => {
    const staff = await student({ role: 'SUPER_ADMIN' });
    const s = await student();
    await setPrefs(s.id, 'email_reminders = 1, email_revision = 1, exam_date = ?', istDay(7));
    await sendExamCountdowns(mail);
    setEmailTransportForTests(async () => {
      throw Object.assign(new Error('provider down'), { code: 'E_INTERNAL_SERVER_ERROR' });
    });
    const f = await sendEmail(mail, { to: 'down@example.test', userId: null, kind: 'REVISION_REMINDER', subject: 'x', text: 'x', html: '<p>x</p>', dedupeKey: `dn-${Date.now()}` });
    expect(f.status).toBe('FAILED');
    const o = await call('GET', '/api/console/email', undefined, staff.h);
    expect(o.json.optedIn.revisionReminders).toBeGreaterThanOrEqual(1);
    expect(o.json.optedIn.examDatesEntered).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(o.json.last7Days)).toContain('EXAM_REMINDER');
    expect(o.json.recentFailures.some((x: { kind: string }) => x.kind === 'REVISION_REMINDER')).toBe(true);
    expect(o.json.retries.waiting).toBeGreaterThanOrEqual(1);
  });
});
