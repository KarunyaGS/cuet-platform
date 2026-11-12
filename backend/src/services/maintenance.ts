/**
 * Admin maintenance used by the ingestion CLI (admin token, never a person's decision):
 *  - roles: give or remove a reviewer/editor role for an existing account
 *  - page checks: store the independent visual (OCR) check of each source page
 *  - machine corrections: apply a re-extracted, re-checked row text to a stored row, keeping before/after.
 *    Only rows no person has decided on can be corrected this way; VERIFIED rows are never touched.
 */
import { z } from 'zod';
import { conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';

export const roleSchema = z.object({
  email: z.email().max(200).transform((e) => e.trim().toLowerCase()),
  role: z.enum(['REVIEWER', 'EDITOR', 'CONTENT_ADMIN', 'SUPER_ADMIN']),
  grant: z.boolean().default(true),
});

export async function setRole(db: D1Database, input: z.infer<typeof roleSchema>, actor: string) {
  const user = await db.prepare('SELECT id, display_name FROM users WHERE email = ?').bind(input.email).first<{ id: string; display_name: string }>();
  if (!user) throw notFound('Account (create it first with Sign up)');
  const role = await db.prepare('SELECT id FROM roles WHERE code = ?').bind(input.role).first<{ id: string }>();
  if (!role) throw notFound(`Role ${input.role}`);
  const now = nowIso();
  await db.batch([
    input.grant
      ? db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(user.id, role.id)
      : db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').bind(user.id, role.id),
    db
      .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, input.grant ? 'ROLE_GRANTED' : 'ROLE_REVOKED', 'USER', user.id, JSON.stringify({ role: input.role }), now),
  ]);
  return { userId: user.id, displayName: user.display_name, role: input.role, granted: input.grant };
}

export const pageChecksSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  method: z.string().min(3).max(80),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1),
        status: z.enum(['OK', 'CHECK', 'NO_TEXT', 'SKIPPED']),
        ocrWords: z.number().int().min(0),
        foundWords: z.number().int().min(0),
        foundPct: z.number().min(0).max(100).nullable(),
        missingSample: z.string().max(4000).nullable(),
      }),
    )
    .min(1)
    .max(2000),
});

export async function storePageChecks(db: D1Database, input: z.infer<typeof pageChecksSchema>) {
  const doc = await db.prepare('SELECT id, page_count FROM source_documents WHERE sha256 = ?').bind(input.sha256).first<{ id: string; page_count: number | null }>();
  if (!doc) throw notFound('Source document with this SHA-256 (import it first)');
  if (doc.page_count && input.pages.some((p) => p.page > doc.page_count!)) throw invalid(`The document has ${doc.page_count} pages`);
  const now = nowIso();
  await db.batch(
    input.pages.map((p) =>
      db
        .prepare(
          `INSERT INTO source_page_checks (id, source_document_id, page, method, status, ocr_words, found_words, found_pct, missing_sample, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (source_document_id, page, method) DO UPDATE SET status = excluded.status, ocr_words = excluded.ocr_words,
             found_words = excluded.found_words, found_pct = excluded.found_pct, missing_sample = excluded.missing_sample, created_at = excluded.created_at`,
        )
        .bind(newId('pc'), doc.id, p.page, input.method, p.status, p.ocrWords, p.foundWords, p.foundPct, p.missingSample || null, now),
    ),
  );
  return { sourceDocumentId: doc.id, pages: input.pages.length };
}

export const machineCorrectionSchema = z.object({
  /** The stored values the CLI expects to replace (guards against correcting the wrong row). */
  expect: z.object({ title: z.string().max(1000), body: z.string().max(20000).nullable() }),
  title: z.string().trim().min(1).max(1000),
  body: z.string().max(20000).nullable(),
  reason: z.string().min(10).max(1000),
  method: z.string().min(3).max(120),
  /** The re-check this text passed (same evidence rules as a machine-verified import). */
  metrics: z.record(z.string(), z.unknown()),
});

export async function machineCorrection(db: D1Database, id: string, input: z.infer<typeof machineCorrectionSchema>, actor: string) {
  const cur = await db
    .prepare(
      `SELECT n.id, n.title, n.body, n.label, n.kind, n.verification, v.status AS version_status
       FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?`,
    )
    .bind(id)
    .first<{ id: string; title: string; body: string | null; label: string | null; kind: string; verification: string; version_status: string }>();
  if (!cur) throw notFound('Syllabus row');
  if (cur.version_status === 'PUBLISHED') throw conflict('Published versions are never changed');
  if (cur.verification !== 'MACHINE_VERIFIED' && cur.verification !== 'UNVERIFIED') {
    throw conflict(`A person has decided on this row (${cur.verification}); only a reviewer can change it`);
  }
  if (cur.title !== input.expect.title || cur.body !== input.expect.body) throw conflict('The stored row no longer matches what the correction expects; nothing was changed');
  if (cur.title === input.title && cur.body === input.body) return { id, changed: false };
  const now = nowIso();
  const hash = await sha256Hex(`corrected:${id}:${cur.kind}:${normaliseText(cur.label)}:${normaliseText(input.title)}|${normaliseText(input.body)}`);
  await db.batch([
    db
      .prepare('UPDATE curriculum_nodes SET title = ?, body = ?, content_hash = ?, updated_at = ? WHERE id = ? AND title = ? AND body IS ?')
      .bind(input.title, input.body, hash, now, id, cur.title, cur.body),
    db
      .prepare(
        `INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at)
         SELECT ?, 'CURRICULUM_NODE', ?, 'EDITED', ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
      )
      .bind(
        newId('rev'), id, cur.verification, cur.verification, actor, input.reason,
        JSON.stringify({ before: { title: cur.title, body: cur.body }, after: { title: input.title, body: input.body }, machineCorrection: true }), now,
      ),
    db
      .prepare(`INSERT INTO verification_evidence (id, entity_type, entity_id, level, method, metrics_json, verified_by, created_at) VALUES (?, 'CURRICULUM_NODE', ?, 'MACHINE', ?, ?, ?, ?)`)
      .bind(newId('ver'), id, input.method, JSON.stringify(input.metrics), actor, now),
  ]);
  return { id, changed: true };
}
