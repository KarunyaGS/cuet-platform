import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { ApiError } from './errors';

const encoder = new TextEncoder();

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(value));
}

/** Constant-time comparison of two secrets (compares their SHA-256 digests). */
export async function secretsMatch(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * Admin API guard for local development: a shared token in `x-admin-token`
 * (or `Authorization: Bearer`). Production needs real user sign-in (e.g. Cloudflare Access);
 * see docs/security.md.
 */
export const adminAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.env.ADMIN_API_TOKEN;
  if (!expected) {
    throw new ApiError(503, 'ADMIN_NOT_CONFIGURED', 'ADMIN_API_TOKEN is not set. Copy backend/.dev.vars.example to backend/.dev.vars.');
  }
  const header = c.req.header('x-admin-token') ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!header || !(await secretsMatch(header, expected))) {
    throw new ApiError(401, 'UNAUTHORISED', 'A valid admin token is required');
  }
  const actorHeader = (c.req.header('x-admin-actor') ?? 'local-admin').replace(/[^\w@.\-]/g, '').slice(0, 80);
  c.set('actor', `admin:${actorHeader || 'local-admin'}`);
  await next();
};
