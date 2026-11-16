/**
 * A small fixed-window rate limiter kept in D1 (`rate_limits`). It exists because the Worker has no built-in throttle: without it, sign-in,
 * sign-up, password reset and order creation can be hit without limit (each sign-in also costs a PBKDF2 run).
 *
 * `subject` is what is being limited (an email address, a user id); when it is null the caller's IP address (`cf-connecting-ip`) is used.
 * Only a short hash of it is stored, never the address itself. Setting `RATE_LIMIT=off` (done in the local development configuration only,
 * so that tests and local work are not throttled) switches the limiter off; leaving it unset keeps it ON.
 */
import type { Bindings } from '../types';
import { ApiError } from './errors';
import { sha256Hex } from './hash';

export async function rateLimit(env: Bindings, req: { header(name: string): string | undefined }, name: string, subject: string | null, limit: number, windowSeconds: number): Promise<void> {
  if (env.RATE_LIMIT === 'off') return;
  const who = (subject ?? req.header('cf-connecting-ip') ?? 'no-ip').toLowerCase();
  const key = `${name}:${(await sha256Hex(who)).slice(0, 24)}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / windowSeconds);
  const row = await env.DB
    .prepare('INSERT INTO rate_limits (key, window, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT (key, window) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(key, window, (window + 1) * windowSeconds + 60)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > limit) {
    const retryAfterSeconds = Math.max(1, (window + 1) * windowSeconds - nowSeconds);
    throw new ApiError(429, 'RATE_LIMITED', `Too many attempts. Please wait ${retryAfterSeconds >= 120 ? `${Math.ceil(retryAfterSeconds / 60)} minutes` : `${retryAfterSeconds} seconds`} and try again.`, { retryAfterSeconds });
  }
}

/** Removes counters whose window has passed. */
export async function purgeRateLimits(db: D1Database, nowSeconds = Math.floor(Date.now() / 1000)) {
  const r = await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowSeconds).run();
  return r.meta.changes ?? 0;
}
