/**
 * Student and parent accounts: password sign-in with PBKDF2-SHA256 (Web Crypto), server-side sessions
 * stored as SHA-256 hashes of random tokens, delivered in an HttpOnly cookie.
 */
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { ApiError, conflict } from '../lib/errors';
import { newId, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';

export const SESSION_COOKIE = 'cuet_session';
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return b64(bits);
}

export const registerSchema = z.object({
  email: z.email().max(200).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  displayName: z.string().trim().min(1).max(80),
});
export const loginSchema = z.object({ email: z.email().max(200).transform((e) => e.trim().toLowerCase()), password: z.string().min(1).max(200) });

export async function registerStudent(db: D1Database, input: z.infer<typeof registerSchema>) {
  const exists = await db.prepare('SELECT id FROM users WHERE email = ?').bind(input.email).first();
  if (exists) throw conflict('An account with this email already exists');
  const id = newId('usr');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(input.password, salt, ITERATIONS);
  const now = nowIso();
  await db.batch([
    db.prepare(`INSERT INTO users (id, email, display_name, status, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?)`).bind(id, input.email, input.displayName, now, now),
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, 'role_student'),
    db.prepare('INSERT INTO user_credentials (user_id, password_hash, salt, iterations, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, hash, b64(salt), ITERATIONS, now),
  ]);
  return { id, email: input.email, displayName: input.displayName };
}

/** Same response time whether or not the email exists. */
export async function login(db: D1Database, input: z.infer<typeof loginSchema>, ttlHours: number) {
  const row = await db
    .prepare(`SELECT u.id, u.email, u.display_name, u.status, c.password_hash, c.salt, c.iterations FROM users u JOIN user_credentials c ON c.user_id = u.id WHERE u.email = ?`)
    .bind(input.email)
    .first<{ id: string; email: string; display_name: string; status: string; password_hash: string; salt: string; iterations: number }>();
  const salt = row ? fromB64(row.salt) : crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(input.password, salt, row?.iterations ?? ITERATIONS);
  const ok = row && row.status === 'ACTIVE' && crypto.subtle.timingSafeEqual(fromB64(hash), fromB64(row.password_hash));
  if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
  const expires = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  await db.batch([
    db.prepare('INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId('ses'), row.id, await sha256Hex(token), expires, nowIso()),
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').bind(nowIso(), nowIso(), row.id),
  ]);
  return { token, expires, user: { id: row.id, email: row.email, displayName: row.display_name } };
}

export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(10, 'Use at least 10 characters').max(200) });

/** Changes the password after checking the current one; signs out every other session of the account. */
export async function changePassword(db: D1Database, userId: string, input: z.infer<typeof passwordSchema>, keepTokenHash: string | null) {
  const row = await db.prepare('SELECT password_hash, salt, iterations FROM user_credentials WHERE user_id = ?').bind(userId).first<{ password_hash: string; salt: string; iterations: number }>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Account not found');
  const check = await pbkdf2(input.currentPassword, fromB64(row.salt), row.iterations);
  if (!crypto.subtle.timingSafeEqual(fromB64(check), fromB64(row.password_hash))) throw new ApiError(400, 'WRONG_PASSWORD', 'The current password is incorrect');
  if (input.currentPassword === input.newPassword) throw new ApiError(400, 'SAME_PASSWORD', 'Choose a password different from the current one');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(input.newPassword, salt, ITERATIONS);
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE user_credentials SET password_hash = ?, salt = ?, iterations = ?, updated_at = ? WHERE user_id = ?').bind(hash, b64(salt), ITERATIONS, now, userId),
    db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND token_hash IS NOT ?').bind(now, userId, keepTokenHash),
  ]);
  return { changed: true };
}

export const resetLinkSchema = z.object({ email: z.email().max(200).transform((e) => e.trim().toLowerCase()) });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), newPassword: z.string().min(10, 'Use at least 10 characters').max(200) });
const RESET_TTL_MINUTES = 60;

/**
 * Creates a one-time password reset link for an account (only the token's hash is stored). Used by an admin
 * helping a student; when an email service is added, the same link is what gets emailed.
 */
export async function createResetLink(db: D1Database, input: z.infer<typeof resetLinkSchema>, createdBy: string) {
  const user = await db.prepare("SELECT id FROM users WHERE email = ? AND status = 'ACTIVE'").bind(input.email).first<{ id: string }>();
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'No active account uses this email');
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();
  const now = nowIso();
  await db.batch([
    // Older unused links for the account stop working when a new one is made.
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now, user.id),
    db.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_by, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)').bind(newId('prt'), user.id, await sha256Hex(token), expiresAt, createdBy, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), createdBy, 'CREATE_RESET_LINK', 'USER', user.id, now),
  ]);
  return { path: `/reset-password#${token}`, expiresAt };
}

/** Sets a new password with a valid reset link, marks the link used and signs the account out everywhere. */
export async function resetPassword(db: D1Database, input: z.infer<typeof resetPasswordSchema>) {
  const now = nowIso();
  const row = await db
    .prepare('SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(await sha256Hex(input.token), now)
    .first<{ id: string; user_id: string }>();
  if (!row) throw new ApiError(400, 'INVALID_RESET_LINK', 'This reset link is not valid. It may have expired or been used already. Ask for a new link.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(input.newPassword, salt, ITERATIONS);
  await db.batch([
    db.prepare('UPDATE user_credentials SET password_hash = ?, salt = ?, iterations = ?, updated_at = ? WHERE user_id = ?').bind(hash, b64(salt), ITERATIONS, now, row.user_id),
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
    db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, row.user_id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), `user:${row.user_id}`, 'RESET_PASSWORD', 'USER', row.user_id, now),
  ]);
  return { reset: true, userId: row.user_id };
}

export async function logout(db: D1Database, token: string | undefined) {
  if (token) await db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').bind(nowIso(), await sha256Hex(token)).run();
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  emailVerified?: boolean;
}

export async function userFromToken(db: D1Database, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.status, u.email_verified_at, GROUP_CONCAT(r.code) AS roles FROM user_sessions s
       JOIN users u ON u.id = s.user_id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? GROUP BY u.id`,
    )
    .bind(await sha256Hex(token), nowIso())
    .first<{ id: string; email: string; display_name: string; status: string; email_verified_at: string | null; roles: string | null }>();
  if (!row || row.status !== 'ACTIVE') return null;
  return { id: row.id, email: row.email, displayName: row.display_name, roles: (row.roles ?? '').split(',').filter(Boolean), emailVerified: Boolean(row.email_verified_at) };
}

/** Requires a signed-in student (cookie, or `Authorization: Bearer <token>` for API clients). */
export const studentAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const user = await userFromToken(c.env.DB, token);
  if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in');
  c.set('user', user);
  await next();
};
