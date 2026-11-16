import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { housekeeping } from '../src/services/housekeeping';
import type { Bindings } from '../src/types';

// Hardening from the 16 Nov 2026 security audit: rate limits, answer leak, cross-site check, headers, one-time links.
const ADMIN = { 'x-admin-token': 'test-admin-token' };
const limited = { ...env, RATE_LIMIT: 'on' } as unknown as Bindings;
const plain = env as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = plain) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}

describe('rate limits', () => {
  it('stops repeated sign-in guesses for one email, then lets a different email through', async () => {
    const h = { 'cf-connecting-ip': '203.0.113.7' };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await call('POST', '/api/auth/login', { email: 'guess@example.test', password: 'wrong-password' }, h, limited)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    const blocked = await call('POST', '/api/auth/login', { email: 'guess@example.test', password: 'wrong-password' }, h, limited);
    expect(blocked.json.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await call('POST', '/api/auth/login', { email: 'someone-else@example.test', password: 'wrong-password' }, h, limited)).status).toBe(401);
  });

  it('limits sign-ups from one address', async () => {
    const h = { 'cf-connecting-ip': '203.0.113.8' };
    const out: number[] = [];
    for (let i = 0; i < 10; i++) out.push((await call('POST', '/api/auth/register', { email: `rl-${i}-${Date.now()}@example.test`, password: 'correct-horse-battery', displayName: 'RL' }, h, limited)).status);
    expect(out.filter((s) => s === 201).length).toBe(8);
    expect(out.filter((s) => s === 429).length).toBe(2);
  });

  it('is off in the test configuration, so nothing else is throttled', async () => {
    for (let i = 0; i < 15; i++) expect((await call('POST', '/api/auth/login', { email: 'free@example.test', password: 'x' })).status).toBe(401);
  });

  it('the daily clean-up removes old counters and old sessions only', async () => {
    await env.DB.prepare('INSERT INTO rate_limits (key, window, count, expires_at) VALUES (?, 1, 1, 10), (?, 2, 1, 99999999999)').bind('old', 'new').run();
    const r = await housekeeping(env.DB);
    expect(r.rateLimitCounters).toBeGreaterThanOrEqual(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = 'new'").first<{ n: number }>())!.n).toBe(1);
  });
});

describe('answer leak and browser protections', () => {
  it('the public answer-checking endpoint is gone', async () => {
    expect((await call('POST', '/api/public/questions/anything/evaluate', { selectedPositions: [1] })).status).toBe(404);
  });

  it('every API answer carries the standard protection headers; signed-in areas are never cached', async () => {
    const r = await call('GET', '/api/health');
    expect(r.json).toEqual({ ok: true });
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect((await call('GET', '/api/student/me')).headers.get('cache-control')).toBe('no-store');
  });

  it('a changing request that comes from another website is refused; the same site and tools without an Origin pass', async () => {
    const body = { email: 'x@example.test', password: 'whatever' };
    expect((await call('POST', '/api/auth/login', body, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('POST', '/api/auth/login', body, { origin: 'https://evil.example' })).json.error.code).toBe('CROSS_SITE_BLOCKED');
    expect((await call('POST', '/api/auth/login', body, { origin: 'http://localhost' })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', body)).status).toBe(401);
    expect((await call('GET', '/api/health', undefined, { origin: 'https://evil.example' })).status).toBe(200);
  });

  it('a broken JSON body on a staff route is a 400, not a server error', async () => {
    const ctx = createExecutionContext();
    const res = await app.request('/api/admin/past-papers', { method: 'POST', headers: { 'content-type': 'application/json', ...ADMIN }, body: '{not json' }, plain, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBeLessThan(500);
  });
});

describe('one-time links', () => {
  it('two parallel uses of one reset link: exactly one succeeds', async () => {
    const email = `link-${Date.now()}@example.test`;
    const reg = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Link' });
    const made = await call('POST', '/api/admin/users/reset-link', { email }, ADMIN);
    expect(made.status).toBeLessThan(300);
    const token = String(made.json.path).split('#')[1]!;
    const [a, b] = await Promise.all([
      call('POST', '/api/auth/reset-password', { token, newPassword: 'first-new-password' }),
      call('POST', '/api/auth/reset-password', { token, newPassword: 'second-new-password' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(reg.status).toBe(201);
  });
});
