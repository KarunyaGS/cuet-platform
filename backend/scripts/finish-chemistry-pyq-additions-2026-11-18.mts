/**
 * LOCAL ONLY. Completes the two NTA Chemistry papers added on 18 Nov 2026 and switches on the two NTA files whose identity was confirmed.
 *   npx tsx scripts/finish-chemistry-pyq-additions-2026-11-18.mts [--dry-run]
 *
 * ingest-nta-library.mts stores the file and a bare document row. This fills in the subject, date, shift, language and note the audit
 * recorded (docs/completion/chemistry-pyq-audit-2026-11-18.md), matching a complete existing record, and sets r2_key on the
 * confirmed 2025 and 2026 files so the existing viewer serves them. Only rows whose stored file hash is the audited one are changed.
 */
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const dry = process.argv.includes('--dry-run');
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const out: string[] = [];

const NEW = [
  { sha: '160a9fba460904bf7d006a98d4923091b2a8abef1c03e207bde0b3720a305206', date: '2023-05-22', shift: 'Shift 3', language: 'English + Hindi', note: "NTA's own file, on NTA's website (nta.ac.in/Download/ExamPaper), hosted by Prepora unchanged. Chemistry, 22 May 2023, Shift 3; each question in English and Hindi. Identity confirmed by matching its question ids and first answers to NTA's 2023 revised answer key." },
  { sha: '9299e0fe92680a3c2eda31442a33f4a81e1626abfa7ddcaf570c802c83c82526', date: '2022-08-10', shift: 'Shift 1', language: 'English', note: "NTA's own file, on NTA's website (nta.ac.in/Download/ExamPaper), hosted by Prepora unchanged. Chemistry, 10 Aug 2022, Shift 1, SET 06. NTA published no 2022 answer key, so the identity and date are confirmed from the paper itself but its answers cannot be checked against an official key." },
];
for (const n of NEW) {
  const h = await db.prepare('SELECT document_id FROM pyq_hosted_files WHERE sha256 = ?').bind(n.sha).first<{ document_id: string }>();
  if (!h) { out.push(`${n.sha.slice(0, 8)}: not stored, skipped`); continue; }
  const stmts = [
    db.prepare(`UPDATE pyq_documents SET section = 'DOMAIN', subject_code = '306', subject_name = 'Chemistry', subject_slug = 'chemistry', listed_as = 'Chemistry', exam_date = ?, shift = ?, language = ?, note = ?, updated_at = ? WHERE id = ? AND (subject_code IS NULL OR subject_code = '306')`)
      .bind(n.date, n.shift, n.language, n.note, now, h.document_id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), 'script:chemistry-pyq-additions', 'PYQ_DOCUMENT_COMPLETED', 'PYQ_DOCUMENT', h.document_id, JSON.stringify({ sha256: n.sha, date: n.date, shift: n.shift, language: n.language }), now),
  ];
  if (!dry) await db.batch(stmts);
  out.push(`${h.document_id}: ${n.date} ${n.shift} ${n.language}${dry ? ' (dry run)' : ''}`);
}

// The two NTA files whose identity was confirmed on 18 Nov 2026: serve them (their file is already in storage).
for (const sha of ['d0f47e5081e677a4e45ee261d61d01ff2416e67a9ec06aeb3e7d3ee51feebd47', '80aff78cdba8d74cab5e534fde67f26fd48cab4af5af54a633fcca5e249e2027']) {
  const h = await db.prepare(`SELECT h.document_id, h.r2_key, h.verification, d.r2_key AS doc_key FROM pyq_hosted_files h JOIN pyq_documents d ON d.id = h.document_id WHERE h.sha256 = ?`).bind(sha).first<{ document_id: string; r2_key: string; verification: string; doc_key: string | null }>();
  if (!h) { out.push(`${sha.slice(0, 8)}: not found`); continue; }
  if (h.verification !== 'VERIFIED') { out.push(`${h.document_id}: not verified, not switched on`); continue; }
  if (h.doc_key) { out.push(`${h.document_id}: already served`); continue; }
  const stmts = [
    db.prepare('UPDATE pyq_documents SET r2_key = ?, updated_at = ? WHERE id = ? AND r2_key IS NULL').bind(h.r2_key, now, h.document_id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), 'script:chemistry-pyq-additions', 'PYQ_DOCUMENT_SWITCHED_ON', 'PYQ_DOCUMENT', h.document_id, JSON.stringify({ r2Key: h.r2_key }), now),
  ];
  if (!dry) await db.batch(stmts);
  out.push(`${h.document_id}: switched on${dry ? ' (dry run)' : ''}`);
}
console.log(out.join('\n'));
await dispose();
