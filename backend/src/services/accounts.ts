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

export async function logout(db: D1Database, token: string | undefined) {
  if (token) await db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').bind(nowIso(), await sha256Hex(token)).run();
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export async function userFromToken(db: D1Database, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.status, GROUP_CONCAT(r.code) AS roles FROM user_sessions s
       JOIN users u ON u.id = s.user_id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? GROUP BY u.id`,
    )
    .bind(await sha256Hex(token), nowIso())
    .first<{ id: string; email: string; display_name: string; status: string; roles: string | null }>();
  if (!row || row.status !== 'ACTIVE') return null;
  return { id: row.id, email: row.email, displayName: row.display_name, roles: (row.roles ?? '').split(',').filter(Boolean) };
}

/** Requires a signed-in student (cookie, or `Authorization: Bearer <token>` for API clients). */
export const studentAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const user = await userFromToken(c.env.DB, token);
  if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in');
  c.set('user', user);
  await next();
};
