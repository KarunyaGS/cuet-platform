import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/types';

// Concurrency smoke test (in the Workers test runtime, local D1). It proves the app does not error under a burst; the timings it prints
// are local numbers only and say nothing about production speed. A real load test needs a staging deployment (see docs/completion/deployment-and-rollback.md).
const e = env as unknown as Bindings;
async function hit(method: string, path: string, body?: unknown) {
  const ctx = createExecutionContext();
  const t = performance.now();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await res.arrayBuffer();
  await waitOnExecutionContext(ctx);
  return { status: res.status, ms: performance.now() - t };
}
const p = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))]!;

describe('burst of concurrent requests', () => {
  it('250 public reads at once: no server errors', async () => {
    const paths = ['/api/health', '/api/public/plans', '/api/public/notices', '/api/health/db'];
    const r = await Promise.all(Array.from({ length: 250 }, (_, i) => hit('GET', paths[i % paths.length]!)));
    expect(r.filter((x) => x.status >= 500)).toEqual([]);
    console.log(`LOAD public reads: n=250 p50=${Math.round(p(r.map((x) => x.ms), 0.5))}ms p95=${Math.round(p(r.map((x) => x.ms), 0.95))}ms max=${Math.round(Math.max(...r.map((x) => x.ms)))}ms`);
  });

  it('15 sign-ups and 15 sign-ins at once: every one answered, no server errors, no duplicate accounts', async () => {
    const stamp = Date.now();
    const reg = await Promise.all(Array.from({ length: 15 }, (_, i) => hit('POST', '/api/auth/register', { email: `load-${stamp}-${i}@example.test`, password: 'correct-horse-battery', displayName: 'Load' })));
    expect(reg.every((x) => x.status === 201)).toBe(true);
    const log = await Promise.all(Array.from({ length: 15 }, (_, i) => hit('POST', '/api/auth/login', { email: `load-${stamp}-${i}@example.test`, password: 'correct-horse-battery' })));
    expect(log.every((x) => x.status === 200)).toBe(true);
    const same = await Promise.all(Array.from({ length: 6 }, () => hit('POST', '/api/auth/register', { email: `same-${stamp}@example.test`, password: 'correct-horse-battery', displayName: 'Same' })));
    expect(same.filter((x) => x.status === 201).length).toBe(1);
    expect(same.filter((x) => x.status >= 500).length).toBe(0);
    console.log(`LOAD sign-up p95=${Math.round(p(reg.map((x) => x.ms), 0.95))}ms, sign-in p95=${Math.round(p(log.map((x) => x.ms), 0.95))}ms`);
  }, 120_000);
});
