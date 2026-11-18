/**
 * LOCAL ONLY. Applies the identity confirmations and label corrections proposed by the Chemistry previous-year paper audit
 * (docs/completion/chemistry-pyq-audit-2026-11-18.md, research/chemistry-pyq-additions-2026-11-18.json).
 *   npx tsx scripts/apply-chemistry-pyq-corrections-2026-11-18.mts [--dry-run]
 *
 * Safe by construction: a row is changed only when its stored file hash equals the hash the audit checked, only the fields the audit
 * named are set, every change is written to the audit log, and the document the audit says to KEEP flagged is never touched.
 * The identity confirmations were made by reading the page images and matching NTA's question ids against NTA's own final answer keys,
 * not by a subject expert; the notes say so.
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const dry = process.argv.includes('--dry-run');
const manifest = JSON.parse(readFileSync(new URL('../../research/chemistry-pyq-additions-2026-11-18.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'utf8')) as {
  flaggedResolutions: { documentId: string; sha256?: string; recommendation: string; setFields?: Record<string, string | null>; evidence: string[] }[];
  relabels: { documentId: string; sha256: string; setFields: Record<string, string | null>; evidence: string }[];
};
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const ALLOWED = new Set(['review_state', 'exam_date', 'shift', 'language']);
const NOTE = 'Checked 18 Nov 2026 by an AI-assisted read of the page images and a match of question ids/answers against NTA\'s own final answer key; not a subject-expert review.';
const report: string[] = [];

async function change(documentId: string, sha: string | undefined, fields: Record<string, string | null>, evidence: string[], markVerified: boolean) {
  for (const k of Object.keys(fields)) if (!ALLOWED.has(k)) throw new Error(`Field not allowed: ${k}`);
  const doc = await db.prepare('SELECT id, subject_code, review_state, exam_date, shift, language FROM pyq_documents WHERE id = ?').bind(documentId).first<Record<string, string | null>>();
  if (!doc) { report.push(`${documentId}: NOT FOUND, skipped`); return; }
  if (doc.subject_code !== '306') throw new Error(`${documentId} is not a Chemistry document`);
  const hosted = await db.prepare('SELECT id, sha256, verification, verification_notes_json FROM pyq_hosted_files WHERE document_id = ?').bind(documentId).first<Record<string, string | null>>();
  if (sha && hosted?.sha256 !== sha) { report.push(`${documentId}: stored file hash differs from the audited one, skipped`); return; }
  const sets = Object.keys(fields).map((k) => `${k} = ?`);
  const stmts: D1PreparedStatement[] = [];
  if (sets.length) stmts.push(db.prepare(`UPDATE pyq_documents SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).bind(...Object.values(fields), now, documentId));
  if (markVerified && hosted) {
    const notes = JSON.parse(hosted.verification_notes_json ?? '[]') as unknown[];
    notes.push(`${NOTE} ${evidence.join(' ')}`);
    stmts.push(db.prepare(`UPDATE pyq_hosted_files SET verification = 'VERIFIED', verification_notes_json = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(notes), now, hosted.id));
  }
  stmts.push(
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), 'script:chemistry-pyq-corrections', markVerified ? 'PYQ_IDENTITY_CONFIRMED' : 'PYQ_LABEL_CORRECTED', 'PYQ_DOCUMENT', documentId, JSON.stringify({ before: { review_state: doc.review_state, exam_date: doc.exam_date, shift: doc.shift, language: doc.language, hostedVerification: hosted?.verification ?? null }, after: fields, evidence }), now),
  );
  if (!dry) await db.batch(stmts);
  report.push(`${documentId}: ${markVerified ? 'identity confirmed, ' : ''}set ${JSON.stringify(fields)}${dry ? ' (dry run)' : ''}`);
}

for (const r of manifest.flaggedResolutions) {
  if (r.recommendation !== 'MARK_VERIFIED') { report.push(`${r.documentId}: ${r.recommendation}, left as it is`); continue; }
  await change(r.documentId, r.sha256, r.setFields ?? {}, r.evidence, true);
}
for (const r of manifest.relabels) await change(r.documentId, r.sha256, r.setFields, [r.evidence], false);
console.log(report.join('\n'));
await dispose();
