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

// ---------------------------------------------------------------- machine re-verification of a corrected version

export const machineVerifySchema = z.object({
  method: z.string().min(3).max(120),
  /** How many rows the caller checked; must equal the rows stored, so a different tree is never marked by mistake. */
  expectedRows: z.number().int().min(1).max(5000),
  /** Paper-level evidence (review decision, unconfirmed rows, structure errors, hash of the checked tree). */
  metrics: z.record(z.string(), z.unknown()),
});

/**
 * Marks a corrected (page-image reviewed) version MACHINE_VERIFIED. The decision is taken from what is STORED, not
 * from what the caller says: every row must carry a passing record-level check (its words found on its own PDF page,
 * written at import), and no row may be a transcription, OCR text, unconfirmed text or something a person worked on.
 * Never VERIFIED: that is a signed-in reviewer's decision only.
 */
export async function machineVerifyVersion(db: D1Database, versionId: string, input: z.infer<typeof machineVerifySchema>, actor: string) {
  const v = await db.prepare('SELECT id, status, verification FROM syllabus_versions WHERE id = ?').bind(versionId).first<{ id: string; status: string; verification: string }>();
  if (!v) throw notFound('Syllabus version');
  if (v.verification === 'MACHINE_VERIFIED') return { changed: false };
  if (v.status !== 'DRAFT' || v.verification !== 'UNVERIFIED') throw conflict(`Only an unverified draft can be machine-verified (is ${v.status}/${v.verification})`);
  const { results: rows } = await db
    .prepare('SELECT id, verification, extraction_flags, authored_by, edited_by, check_json FROM curriculum_nodes WHERE syllabus_version_id = ?')
    .bind(versionId)
    .all<{ id: string; verification: string; extraction_flags: string | null; authored_by: string | null; edited_by: string | null; check_json: string | null }>();
  if (!rows.length) throw conflict('This version has no rows; there is nothing to machine-verify');
  if (rows.length !== input.expectedRows) throw conflict(`The stored version has ${rows.length} row(s) but ${input.expectedRows} were checked; nothing was changed`);
  const human = await db
    .prepare(
      `SELECT 1 FROM review_records r WHERE r.actor LIKE 'user:%' AND ((r.entity_type = 'SYLLABUS_VERSION' AND r.entity_id = ?1)
         OR (r.entity_type = 'CURRICULUM_NODE' AND r.entity_id IN (SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ?1))) LIMIT 1`,
    )
    .bind(versionId)
    .first();
  const bad = rows.filter((r) => r.verification !== 'UNVERIFIED' || r.authored_by || r.edited_by || /ai_transcription|text_not_in_sources|(^|,)ocr|heading_inferred/.test(r.extraction_flags ?? ''));
  if (human || bad.length) throw conflict('This version has rows a person worked on, transcriptions, OCR text or unconfirmed text; it cannot be machine-verified', { rows: bad.length });
  const failing = rows.filter((r) => {
    try {
      return (JSON.parse(r.check_json ?? 'null') as { ok?: boolean } | null)?.ok !== true;
    } catch {
      return true;
    }
  });
  if (failing.length) throw conflict(`${failing.length} row(s) have no passing record-level check`, { rows: failing.length });
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE curriculum_nodes SET verification = 'MACHINE_VERIFIED', updated_at = ? WHERE syllabus_version_id = ? AND verification = 'UNVERIFIED'`).bind(now, versionId),
    db.prepare(`UPDATE syllabus_versions SET verification = 'MACHINE_VERIFIED', notes = COALESCE(notes, '') || ?, updated_at = ? WHERE id = ? AND verification = 'UNVERIFIED'`)
      .bind(` Machine-checked by ${input.method}. Not signed off by a person.`, now, versionId),
    db.prepare(`INSERT INTO verification_evidence (id, entity_type, entity_id, level, method, metrics_json, verified_by, created_at) VALUES (?, 'SYLLABUS_VERSION', ?, 'MACHINE', ?, ?, ?, ?)`)
      .bind(newId('ver'), versionId, input.method, JSON.stringify({ ...input.metrics, rows: rows.length }), actor, now),
    db.prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, created_at) VALUES (?, 'SYLLABUS_VERSION', ?, 'EDITED', 'DRAFT/UNVERIFIED', 'DRAFT/MACHINE_VERIFIED', ?, ?, ?)`)
      .bind(newId('rev'), versionId, actor, `Machine check (${input.method}); not a person's decision`, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, 'MACHINE_VERIFY_SYLLABUS_VERSION', 'SYLLABUS_VERSION', versionId, JSON.stringify({ rows: rows.length, method: input.method }), now),
  ]);
  return { changed: true, rows: rows.length };
}

// ---------------------------------------------------------------- additive imports of already-processed data

export const pageTextsSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  pages: z
    .array(z.object({ page: z.number().int().min(1), method: z.enum(['pdfjs', 'pdftotext', 'ocr']), text: z.string().max(200_000), meanConfidence: z.number().min(0).max(100).nullable() }))
    .min(1)
    .max(1000),
});

/** Inserts page texts that are not stored yet. Existing rows are never changed. */
export async function storePageTexts(db: D1Database, input: z.infer<typeof pageTextsSchema>) {
  const doc = await db.prepare('SELECT id, page_count FROM source_documents WHERE sha256 = ?').bind(input.sha256).first<{ id: string; page_count: number | null }>();
  if (!doc) throw notFound('Source document with this SHA-256');
  if (doc.page_count && input.pages.some((p) => p.page > doc.page_count!)) throw invalid(`The document has ${doc.page_count} pages`);
  const now = nowIso();
  const res = await db.batch(
    input.pages.map((p) =>
      db
        .prepare('INSERT INTO source_page_texts (id, source_document_id, page, method, text, mean_confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (source_document_id, page, method) DO NOTHING')
        .bind(newId('ptx'), doc.id, p.page, p.method, p.text, p.meanConfidence, now),
    ),
  );
  const inserted = res.reduce((t, r) => t + (r.meta.changes ?? 0), 0);
  return { inserted, alreadyStored: input.pages.length - inserted };
}

export const sourceIssueSchema = z.object({
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  code: z.string().min(1).max(20),
  issue: z.string().min(10).max(4000),
  evidence: z.string().max(4000).nullable(),
  key: z.string().regex(/^[a-z0-9:_-]{3,120}$/),
});

/** Records a problem found in an official document itself (not an extraction error). Insert-only, idempotent by key. */
export async function storeSourceIssue(db: D1Database, input: z.infer<typeof sourceIssueSchema>, actor: string) {
  const doc = await db
    .prepare(
      `SELECT d.id FROM source_documents d JOIN syllabus_versions v ON v.source_document_id = d.id JOIN test_papers p ON p.id = v.test_paper_id
       JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE e.code = ? AND p.code = ? LIMIT 1`,
    )
    .bind(input.exam, input.code)
    .first<{ id: string }>();
  if (!doc) throw notFound(`Source document of ${input.exam} ${input.code}`);
  const res = await db
    .prepare('INSERT OR IGNORE INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(`aud_srcissue_${input.key}`, actor, 'SOURCE_DOCUMENT_ISSUE', 'SOURCE_DOCUMENT', doc.id, JSON.stringify({ exam: input.exam, code: input.code, issue: input.issue, evidence: input.evidence }), nowIso())
    .run();
  return { sourceDocumentId: doc.id, inserted: (res.meta.changes ?? 0) > 0 };
}

export const sourceFigureSchema = z.object({
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  page: z.number().int().min(1),
  nodeId: z.string().max(100).nullable(),
  r2Key: z.string().regex(/^media\/[0-9a-f]{64}\.(png|jpg|webp)$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altText: z.string().min(10).max(1000),
  caption: z.string().max(1000).nullable(),
});

/** A figure cut out of an official PDF page, stored with its document, page and syllabus row. Insert-only by sha256. */
export async function storeSourceFigure(db: D1Database, bucket: R2Bucket, input: z.infer<typeof sourceFigureSchema>, actor: string) {
  if (!(await bucket.head(input.r2Key))) throw invalid('Upload the image first (PUT /api/admin/files/media)');
  const doc = await db.prepare('SELECT id, page_count FROM source_documents WHERE sha256 = ?').bind(input.documentSha256).first<{ id: string; page_count: number | null }>();
  if (!doc) throw notFound('Source document');
  if (doc.page_count && input.page > doc.page_count) throw invalid(`The document has ${doc.page_count} pages`);
  if (input.nodeId && !(await db.prepare('SELECT 1 FROM curriculum_nodes WHERE id = ?').bind(input.nodeId).first())) throw invalid('Syllabus row not found');
  const now = nowIso();
  const id = newId('med');
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO media_assets (id, kind, r2_key, external_url, mime_type, byte_size, sha256, width, height, duration_seconds, alt_text, caption, long_description,
         language, attribution, usage_permission_id, source_document_id, source_page, curriculum_node_id, origin, external_key, status, verification, created_at, updated_at)
       VALUES (?, 'IMAGE', ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, 'und', 'National Testing Agency (NTA), official syllabus PDF', 'perm_nta_reference', ?, ?, ?, 'OFFICIAL_SOURCE', ?, 'DRAFT', 'UNVERIFIED', ?, ?)`,
    )
    .bind(id, input.r2Key, input.mimeType, input.byteSize, input.sha256, input.width, input.height, input.altText, input.caption, doc.id, input.page, input.nodeId, `source-figure:${input.sha256}`, now, now)
    .run();
  if (res.meta.changes) {
    await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'SOURCE_FIGURE_STORED', 'MEDIA_ASSET', id, now).run();
  }
  return { inserted: (res.meta.changes ?? 0) > 0 };
}
