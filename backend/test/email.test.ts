import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { handleCloudflareEmailEvent, sendDailyReminders, sendEmail, setEmailTransportForTests, verifySvixSignature, istDay } from '../src/services/email';
import type { Bindings } from '../src/types';

type Sent = { to: string; subject: string; text: string; html: string; from: string };
let outbox: Sent[] = [];
let failNext = false;
const off = { ...env, EMAIL_FROM: undefined } as unknown as Bindings;
const mail = { ...env, EMAIL_FROM: 'no-reply@send.example.test', PUBLIC_APP_URL: 'https://app.example.test' } as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = mail) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
const linkToken = (m: Sent, page: string) => new RegExp(`https://app\\.example\\.test/${page}#([\\w-]+)`).exec(m.text)?.[1] ?? '';
const PASSWORD = 'correct-horse-battery';
async function signUp(email: string) {
  const r = await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: 'Asha' });
  expect(r.status).toBe(201);
  const s = await call('POST', '/api/auth/login', { email, password: PASSWORD });
  return { id: r.json.id as string, cookie: s.cookie };
}

beforeEach(() => {
  outbox = [];
  failNext = false;
  setEmailTransportForTests(async (_env, m, from) => {
    if (failNext) throw Object.assign(new Error('provider down'), { code: 'E_INTERNAL_SERVER_ERROR' });
    outbox.push({ to: m.to, subject: m.subject, text: m.text, html: m.html, from: from.email });
    return `msg-${outbox.length}-${crypto.randomUUID()}`;
  });
});
afterEach(() => setEmailTransportForTests(null));

describe('email: switched off', () => {
  it('sends nothing and says so while no sender address is configured', async () => {
    const r = await call('POST', '/api/auth/forgot-password', { email: 'nobody@example.test' }, {}, off);
    expect(r.json).toEqual({ ok: true, available: false });
    expect((await call('GET', '/api/auth/email-status', undefined, {}, off)).json).toEqual({ available: false });
    expect(outbox).toHaveLength(0);
  });
});

describe('email: password reset', () => {
  it('emails a one-time link that sets a new password, then tells the owner the password changed', async () => {
    await signUp('reset@example.test');
    outbox = [];
    const r = await call('POST', '/api/auth/forgot-password', { email: 'Reset@Example.test' });
    expect(r.json).toEqual({ ok: true, available: true });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'reset@example.test', from: 'no-reply@send.example.test' });
    const token = linkToken(outbox[0]!, 'reset-password');
    expect(token.length).toBeGreaterThan(20);
    // The link is never stored: only its hash is, and the message row holds no body.
    const stored = await env.DB.prepare("SELECT * FROM email_messages WHERE kind = 'PASSWORD_RESET'").first<Record<string, unknown>>();
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored).toMatchObject({ status: 'SENT', provider: 'test' });

    expect((await call('POST', '/api/auth/reset-password', { token, newPassword: 'a-brand-new-password' })).json).toEqual({ reset: true });
    expect(outbox.at(-1)!.subject).toMatch(/password was changed/i);
    expect((await call('POST', '/api/auth/login', { email: 'reset@example.test', password: 'a-brand-new-password' })).status).toBe(200);
    expect((await call('POST', '/api/auth/reset-password', { token, newPassword: 'another-new-password' })).status).toBe(400);
  });

  it('answers the same for an unknown address and sends nothing', async () => {
    const r = await call('POST', '/api/auth/forgot-password', { email: 'ghost@example.test' });
    expect(r.json).toEqual({ ok: true, available: true });
    expect(outbox).toHaveLength(0);
  });

  it('stops after three reset emails to one address in an hour', async () => {
    await signUp('flood@example.test');
    outbox = [];
    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/forgot-password', { email: 'flood@example.test' });
    expect(outbox.filter((m) => /reset/i.test(m.subject))).toHaveLength(3);
  });
});

describe('email: confirming the address and reminders', () => {
  it('sends a confirmation link at sign-up; reminders can be turned on only after confirming', async () => {
    const u = await signUp('verify@example.test');
    expect(outbox).toHaveLength(1);
    const auth = { cookie: u.cookie };
    expect((await call('GET', '/api/student/email', undefined, auth)).json).toMatchObject({ emailVerified: false, emailReminders: false, emailAvailable: true });
    expect((await call('PUT', '/api/student/email', { emailReminders: true }, auth)).status).toBe(409);
    expect((await call('POST', '/api/auth/verify-email', { token: 'x'.repeat(30) })).status).toBe(400);
    expect((await call('POST', '/api/auth/verify-email', { token: linkToken(outbox[0]!, 'verify-email') })).json).toEqual({ verified: true });
    expect((await call('GET', '/api/auth/me', undefined, auth)).json.user.emailVerified).toBe(true);
    expect((await call('PUT', '/api/student/email', { emailReminders: true }, auth)).json).toMatchObject({ emailVerified: true, emailReminders: true });

    // Something due today: a daily goal with no questions answered yet.
    expect((await call('PUT', '/api/student/goals', { questionsPerDay: 10, lessonsPerDay: 1 }, auth)).status).toBe(200);
    outbox = [];
    const now = new Date();
    const first = await sendDailyReminders(mail, now);
    expect(first).toMatchObject({ enabled: true, sent: 1 });
    expect(outbox[0]!.to).toBe('verify@example.test');
    expect(outbox[0]!.text).toMatch(/more questions to reach today/);
    // Once a day only.
    expect((await sendDailyReminders(mail, now)).sent).toBe(0);
    expect(outbox).toHaveLength(1);

    // One-click stop from the email, no sign-in.
    const stop = linkToken(outbox[0]!, 'unsubscribe');
    expect((await call('POST', '/api/public/email/unsubscribe', { token: stop })).json).toEqual({ unsubscribed: true });
    expect((await call('GET', '/api/student/email', undefined, auth)).json.emailReminders).toBe(false);
    const tomorrow = new Date(now.getTime() + 86400_000);
    expect(istDay(tomorrow)).not.toBe(istDay(now));
    expect((await sendDailyReminders(mail, tomorrow)).sent).toBe(0);
  });
});

describe('email: delivery failures', () => {
  it('records a failed send without throwing', async () => {
    failNext = true;
    const r = await sendEmail(mail, { to: 'down@example.test', userId: null, kind: 'ACCOUNT_NOTICE', subject: 'Notice', text: 't', html: '<p>t</p>' });
    expect(r.status).toBe('FAILED');
    const row = await env.DB.prepare('SELECT status, attempts, last_error FROM email_messages WHERE id = ?').bind(r.id).first<{ status: string; attempts: number; last_error: string }>();
    expect(row).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(row!.last_error).toContain('E_INTERNAL_SERVER_ERROR');
  });

  it('a hard bounce suppresses the address, turns reminders off and blocks later emails', async () => {
    await signUp('bounce@example.test');
    const sent = await env.DB.prepare("SELECT provider_message_id FROM email_messages WHERE to_email = 'bounce@example.test'").first<{ provider_message_id: string }>();
    const event = (kind: string, bounce?: object) => ({ type: `cf.email.sending.message.${kind}`, payload: { messageId: sent!.provider_message_id, recipient: 'bounce@example.test', bounce } });
    expect(await handleCloudflareEmailEvent(env.DB, event('deferred'))).toEqual({ ignored: true });
    expect(await handleCloudflareEmailEvent(env.DB, event('bounced', { type: 'soft', reason: '451 try later' }))).toEqual({ suppressed: false });
    expect(await handleCloudflareEmailEvent(env.DB, event('bounced', { type: 'hard', reason: '550 5.1.1 User unknown' }))).toEqual({ suppressed: true });
    // A late "delivered" does not hide the bounce.
    await handleCloudflareEmailEvent(env.DB, event('delivered'));
    expect((await env.DB.prepare('SELECT status FROM email_messages WHERE provider_message_id = ?').bind(sent!.provider_message_id).first<{ status: string }>())!.status).toBe('BOUNCED');
    outbox = [];
    await call('POST', '/api/auth/forgot-password', { email: 'bounce@example.test' });
    expect(outbox).toHaveLength(0);
    expect((await env.DB.prepare("SELECT status FROM email_messages WHERE to_email = 'bounce@example.test' AND kind = 'PASSWORD_RESET'").first<{ status: string }>())!.status).toBe('SUPPRESSED');
  });

  it('accepts a standby-provider webhook only with a valid signature', async () => {
    const secretBytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    const withHook = { ...mail, RESEND_WEBHOOK_SECRET: secret } as Bindings;
    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'none', to: ['spam@example.test'] } });
    const id = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)))));
    expect(await verifySvixSignature(secret, { id, timestamp, signature: `v1,${sig}` }, body)).toBe(true);
    expect(await verifySvixSignature(secret, { id, timestamp, signature: `v1,${sig}` }, body + ' ')).toBe(false);
    expect(await verifySvixSignature(secret, { id, timestamp: String(Number(timestamp) - 3600), signature: `v1,${sig}` }, body)).toBe(false);

    const send = (signature: string) => {
      const ctx = createExecutionContext();
      return app.request('/api/public/email/webhooks/resend', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature }, body }, withHook, ctx);
    };
    expect((await send('v1,AAAA')).status).toBe(401);
    expect((await send(`v1,${sig}`)).status).toBe(200);
    expect(await env.DB.prepare("SELECT reason FROM email_suppressions WHERE email = 'spam@example.test'").first()).toEqual({ reason: 'COMPLAINT' });
    // Without the secret configured the endpoint does not exist.
    const ctx = createExecutionContext();
    expect((await app.request('/api/public/email/webhooks/resend', { method: 'POST', body }, mail, ctx)).status).toBe(404);
  });
});
