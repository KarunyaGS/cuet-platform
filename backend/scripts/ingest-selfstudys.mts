/**
 * LOCAL ONLY. Stores the SelfStudys CUET-UG PDFs (permission confirmed by management, 16 Nov 2026) in our own storage (R2 binding MEDIA).
 *   npx tsx scripts/ingest-selfstudys.mts <selfstudys-results.json> [--dry-run]
 * Input: research/nta-ug-library/selfstudys.py output. Original bytes are stored unchanged under pyq/thirdparty/selfstudys/<year>/...
 * Identity checks: files with a text layer must print the subject on page 1; scanned files were read page by page by a reviewer
 * (contact sheets, ss_sheets.py): printed subject/date or the first questions had to match the label. Anything else is FLAGGED (stored, hidden).
 * An existing document row (key selfstudys:<id>) gets the stored copy; others are added. Nothing is overwritten or deleted. Repeatable.
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const resultsPath = process.argv[2];
if (!resultsPath) throw new Error('Usage: ingest-selfstudys.mts <results.json> [--dry-run]');
const dry = process.argv.includes('--dry-run');
const RIGHTS_BASIS =
  'Management confirmed on 16 Nov 2026 that Prepora has permission from SelfStudys to use its CUET-UG documents. Hosted unchanged as a labelled third-party copy; ' +
  'the permission letter or reference is not in the repository and must be added to the record.';
const NAME: Record<string, RegExp> = { '322': /physics/i, '306': /chemistry/i, '319': /math/i, '304': /biolog/i, '313': /geograph/i, '308': /computer/i, '501': /general|gat/i };

interface R {
  status: string; isPdf?: boolean; year: number; slug: string; sid: string; docPage: string; listing: string; subjectCode: string; subjectName: string; examDate?: string; shift?: string | null;
  title?: string; fileUrl?: string; bytes?: number; sha256?: string; pages?: number | null; retrievedAt?: string; lastModified?: string | null; file?: string; firstPage?: string; textChars?: number;
}
const rows = (JSON.parse(readFileSync(resultsPath, 'utf8')) as { results: R[] }).results.filter((r) => r.status === 'OK' && r.isPdf && r.sha256);

const { env, dispose } = await getPlatformProxy<{ DB: D1Database; MEDIA: R2Bucket }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const today = now.slice(0, 10);
const stats = { stored: 0, verified: 0, flagged: 0, skippedExisting: 0, newDocuments: 0, answerKeys: 0, failed: 0 };
const flagged: { slug: string; notes: string[] }[] = [];

for (const r of rows) {
  if (await db.prepare('SELECT 1 AS x FROM pyq_hosted_files WHERE sha256 = ?').bind(r.sha256).first()) { stats.skippedExisting++; continue; }
  const textual = (r.textChars ?? 0) >= 500;
  const isKey = (r.pages ?? 99) <= 20 && ((r.textChars ?? 0) < 100 || /answer key/i.test(r.firstPage ?? '')) && /20(24|25)/.test(r.slug) && (r.textChars ?? 0) < 500;
  const notes: string[] = [];
  if (!r.bytes || r.bytes < 1000) notes.push('MISMATCH: file is empty or too small');
  if (textual) {
    if (!NAME[r.subjectCode]!.test(r.firstPage ?? '')) notes.push(`IDENTITY_UNVERIFIED: page 1 does not print the subject (${r.subjectName})`);
    else notes.push('Page 1 text prints the subject and matches the label.');
  } else notes.push('Scanned file with no text layer: the first page was read by a reviewer (an AI assistant, 16 Nov 2026) and its printed subject/date or first questions matched the label. A person has not re-checked it.');
  if (isKey) notes.push('ANSWER_KEY_HELD: a short answer-key file for one subject. Answer keys are listed for the whole year, so it is stored but not shown until a person decides how to present it.');
  const flag = notes.some((n) => /^(MISMATCH|IDENTITY_UNVERIFIED|ANSWER_KEY_HELD)/.test(n));
  const state = notes.some((n) => /^ANSWER_KEY_HELD/.test(n)) ? 'ANSWER_KEY_HELD' : 'IDENTITY_UNVERIFIED';
  const kind = isKey ? 'ANSWER_KEY' : 'QUESTION_PAPER';
  const r2Key = `pyq/thirdparty/selfstudys/${r.year}/${kind === 'ANSWER_KEY' ? 'answer-key' : 'question-paper'}/${r.slug.slice(0, 60)}-${r.sha256!.slice(0, 8)}.pdf`;
  if (dry) { console.log(flag ? 'FLAG' : 'OK  ', kind, r2Key, notes[0]); continue; }

  const bytes = readFileSync(r.file!);
  await env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { sha256: r.sha256!, sourceUrl: r.fileUrl ?? '', retrievedAt: r.retrievedAt ?? now } });
  const back = await env.MEDIA.head(r2Key);
  if (!back || back.size !== bytes.length) { stats.failed++; console.error('Stored copy does not match', r2Key); continue; }

  let doc = await db.prepare('SELECT id FROM pyq_documents WHERE key = ?').bind(`selfstudys:${r.sid}`).first<{ id: string }>();
  if (!doc) {
    const t = await db.prepare("SELECT MAX(subject_slug) AS slug, MAX(subject_name) AS name, MAX(section) AS section FROM pyq_documents WHERE exam_code = 'CUET_UG' AND subject_code = ?").bind(r.subjectCode).first<{ slug: string | null; name: string | null; section: string | null }>();
    const id = newId('pyq');
    await db
      .prepare(
        `INSERT INTO pyq_documents (id, key, exam_code, year, kind, classification, official, section, subject_code, subject_name, subject_slug, listed_as, title, exam_date, shift, language, source_site, source_page_url, document_page_url, file_url, file_host, pages, bytes, working, http_status, embeddable, source_claim, note, alternatives_json, sessions_json, replaced_by_key, checked_on, created_at, updated_at, r2_key, review_state, rights_basis)
         VALUES (?, ?, 'CUET_UG', ?, ?, 'THIRD_PARTY_COPY', 0, ?, ?, ?, ?, NULL, ?, ?, ?, 'English', 'SelfStudys', ?, ?, ?, 'www.selfstudys.com', ?, ?, 1, 200, 0, NULL, ?, '[]', NULL, NULL, ?, ?, ?, NULL, NULL, NULL)`,
      )
      .bind(id, `selfstudys:${r.sid}`, r.year, kind, t?.section ?? null, r.subjectCode, t?.name ?? r.subjectName, t?.slug ?? null, (r.title ?? r.slug).slice(0, 380), r.examDate ?? null, r.shift ?? null, r.listing, r.docPage, r.fileUrl ?? r.docPage, r.pages ?? null, r.bytes, 'Copy of a document on SelfStudys, hosted by Prepora with SelfStudys permission.', today, now, now)
      .run();
    doc = { id };
    stats.newDocuments++;
  }
  if (kind === 'ANSWER_KEY') stats.answerKeys++;
  await db.batch([
    db
      .prepare(
        `INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, pages, r2_key, source_url, alternate_urls_json, retrieved_at, http_status, last_modified, verification, verification_notes_json, printed_subject, printed_code, printed_medium, first_page_excerpt, rights_status, rights_basis, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 200, ?, ?, ?, NULL, NULL, 'English', ?, ?, ?, ?, ?)`,
      )
      .bind(newId('hf'), doc.id, r.sha256, r.bytes, r.pages ?? null, r2Key, r.fileUrl ?? r.docPage, JSON.stringify([r.docPage]), r.retrievedAt ?? now, r.lastModified ?? null, flag ? 'FLAGGED' : 'VERIFIED', JSON.stringify(notes), (r.firstPage ?? '').slice(0, 400), 'CONFIRMED_BY_MANAGEMENT', RIGHTS_BASIS, now, now),
    ...(flag
      ? [db.prepare("UPDATE pyq_documents SET review_state = ?, updated_at = ? WHERE id = ? AND review_state IS NULL").bind(state, now, doc.id)]
      : [db.prepare('UPDATE pyq_documents SET r2_key = ?, rights_basis = ?, kind = ?, updated_at = ? WHERE id = ? AND r2_key IS NULL').bind(r2Key, 'SELFSTUDYS_PERMISSION_CONFIRMED_BY_MANAGEMENT_2026-11-16', kind, now, doc.id)]),
  ]);
  stats.stored++;
  if (flag) { stats.flagged++; flagged.push({ slug: r.slug, notes }); } else stats.verified++;
}
if (!dry) {
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), 'ceo-decision:2026-11-16', 'SELFSTUDYS_LIBRARY_INGESTED', 'PYQ_LIBRARY', 'cuet-ug', JSON.stringify({ stats, flagged }), now)
    .run();
}
console.log(JSON.stringify({ dry, stats, flagged }, null, 1));
await dispose();
