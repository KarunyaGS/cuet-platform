/**
 * Reviewer sign-in: the same session cookie as students, plus a permission check from user_roles -> role_permissions.
 * Every reviewer action is recorded under `user:<id>`, so each human decision names the person who made it.
 */
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { SESSION_COOKIE, userFromToken } from '../services/accounts';
import { ApiError } from './errors';

export async function permissionsOf(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ?')
    .bind(userId)
    .all<{ code: string }>();
  return results.map((r) => r.code);
}

/** Signed in, and holding at least `curriculum:read` plus one of content:review / curriculum:write. */
export const reviewerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const user = await userFromToken(c.env.DB, token);
  if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in');
  const permissions = await permissionsOf(c.env.DB, user.id);
  if (!permissions.includes('curriculum:read') || !(permissions.includes('content:review') || permissions.includes('curriculum:write'))) {
    throw new ApiError(403, 'FORBIDDEN', 'This account does not have reviewer access');
  }
  c.set('user', { ...user, permissions });
  c.set('actor', `user:${user.id}`);
  await next();
};
