/**
 * Daily clean-up of rows that only grow: signed-out and expired sessions, used or expired one-time links, and old rate-limit counters.
 * Nothing a student created (answers, bookmarks, notes, progress) is touched.
 */
import { purgeRateLimits } from '../lib/rate-limit';

const DAYS = 30;

export async function housekeeping(db: D1Database, at = new Date()) {
  const cutoff = new Date(at.getTime() - DAYS * 86400_000).toISOString();
  const run = async (sql: string) => (await db.prepare(sql).bind(cutoff).run()).meta.changes ?? 0;
  return {
    sessions: await run('DELETE FROM user_sessions WHERE (expires_at < ?1) OR (revoked_at IS NOT NULL AND revoked_at < ?1)'),
    resetLinks: await run('DELETE FROM password_reset_tokens WHERE (expires_at < ?1) OR (used_at IS NOT NULL AND used_at < ?1)'),
    confirmationLinks: await run('DELETE FROM email_verification_tokens WHERE (expires_at < ?1) OR (used_at IS NOT NULL AND used_at < ?1)'),
    rateLimitCounters: await purgeRateLimits(db, Math.floor(at.getTime() / 1000)),
  };
}
