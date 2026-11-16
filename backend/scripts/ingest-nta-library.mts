/**
 * LOCAL ONLY. Stores the verified official NTA CUET-UG files in our own storage (R2 binding MEDIA) and records them.
 *   npx tsx scripts/ingest-nta-library.mts <results.json> [--dry-run]
 *
 * For every file that research/nta-ug-library/fetch.py downloaded and checked:
 *  - the ORIGINAL bytes are put in R2 under pyq/official/ug/<year>/<kind>/<name>-<sha8>.pdf (never modified);
 *  - a row in pyq_hosted_files keeps source URL(s), retrieval date, hash, pages, checks and the rights basis (sha256 is unique: no duplicates);
 *  - the matching pyq_documents row gets its r2_key (so the existing viewer and download route serve it), only when it had none;
 *  - a document that fails a check, or carries an explicit copyright mark, is stored but NOT switched on: it is FLAGGED for a person.
 * Existing rows are never overwritten or deleted. A run can be repeated: files already stored are skipped.
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const resultsPath = process.argv[2];
if (!resultsPath) throw new Error('Usage: ingest-nta-library.mts <results.json> [--dry-run]');
const dry = process.argv.includes('--dry-run');
const RIGHTS_BASIS =
  'Management confirmed on 16 Nov 2026 that CUET Prep has permission to download and host NTA question papers and official answer keys. ' +
  'NTA copyright policy (https://cuet.nta.nic.in/copyright-policy/): reproduce accurately, never in a misleading or derogatory context, and acknowledge the source prominently. ' +
  'The permission letter or reference is not in the repository and must be added to the record.';

interface R {
  status: string; isPdf?: boolean; duplicateOf?: string; url: string; origin: string; docId?: string; key?: string; year: number | null; kind: string;
  subjectCode?: string | null; subjectName?: string | null; language?: string | null; title: string; listedOn?: string; expectedPages?: number | null; expectedBytes?: number | null;
  bytes?: number; sha256?: string; pages?: number | null; retrievedAt?: string; http?: number; lastModified?: string | null; file?: string; firstPage?: string;
  printedSubject?: string; printedCode?: string; printedMedium?: string; copyrightMarks?: boolean; classifyAs?: 'QUESTION_PAPER' | 'ANSWER_KEY' | 'NOTICE' | 'MIRROR';
  printedDate?: string; printedShift?: string; printedNameMatches?: boolean; titleOverride?: string; mirrorOf?: string; textOverlapWith?: { url: string; overlap: number };
}
const all = (JSON.parse(readFileSync(resultsPath, 'utf8')) as { results: R[] }).results;

const { env, dispose } = await getPlatformProxy<{ DB: D1Database; MEDIA: R2Bucket }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const today = now.slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const host = (u: string) => new URL(u).host;

const stats = { stored: 0, verified: 0, flagged: 0, skippedExisting: 0, duplicatesNoted: 0, notices: 0, newDocuments: 0, failed: 0 };
const flagged: { url: string; notes: string[] }[] = [];
const primaries = new Map<string, R>();
for (const r of all) if (r.status === 'OK' && r.isPdf && !r.duplicateOf && r.sha256) primaries.set(r.sha256, r);

for (const r of primaries.values()) {
  const kind = r.classifyAs ?? (r.origin === 'index' ? (r.kind as 'QUESTION_PAPER' | 'ANSWER_KEY') : 'NOTICE');
  if (kind === 'NOTICE') { stats.notices++; continue; }
  if (kind === 'MIRROR') { continue; } // the same document as one already stored; its address is kept as an alternate source below
  const exists = await db.prepare('SELECT 1 AS x FROM pyq_hosted_files WHERE sha256 = ?').bind(r.sha256).first();
  if (exists) { stats.skippedExisting++; continue; }
  const notes: string[] = [];
  if (!r.bytes || r.bytes < 1000) notes.push('File is empty or too small');
  if (!r.pages || r.pages < 1) notes.push('Page count could not be read');
  if (r.expectedBytes && r.bytes !== r.expectedBytes) notes.push(`Size differs from the recorded ${r.expectedBytes} bytes (now ${r.bytes})`);
  if (r.expectedPages && r.pages && r.pages !== r.expectedPages) notes.push(`Page count differs from the recorded ${r.expectedPages} (now ${r.pages})`);
  if (kind === 'QUESTION_PAPER' && r.subjectCode) {
    // Identity must be shown by the file itself: its printed subject code, or its printed paper name matching the record.
    if (r.printedCode) {
      if (r.printedCode !== r.subjectCode) notes.push(`MISMATCH: the file prints subject code ${r.printedCode}, the record says ${r.subjectCode}`);
    } else if (r.printedSubject && r.printedNameMatches === false) {
      notes.push(`MISMATCH: the file prints the paper name “${r.printedSubject}”, the record says ${r.subjectName}`);
    } else if (!r.printedSubject) {
      notes.push('IDENTITY_UNVERIFIED: the first pages are scanned images with no readable subject or code. The subject label comes from a third-party listing, and spot checks of similar files showed some labels that do not match their content. A person must confirm which paper this is before it is shown.');
    }
  }
  if (r.textOverlapWith && r.textOverlapWith.overlap >= 0.9 && r.textOverlapWith.overlap < 0.9995) notes.push(`DIFFERS_FROM_HOSTED_KEY: about ${(100 - r.textOverlapWith.overlap * 100).toFixed(1)}% of the text differs from ${r.textOverlapWith.url}; a person must say which version is current`);
  const mismatch = notes.some((n) => /^(MISMATCH|IDENTITY_UNVERIFIED|DIFFERS_FROM_HOSTED_KEY|File is empty|Page count could not)/.test(n));
  const copyright = Boolean(r.copyrightMarks);
  if (copyright) notes.push('The first page carries a copyright, third-party or rights-reserved mark: a person must confirm it may be republished');
  const flag = mismatch || copyright; // flagged files are stored and recorded but NOT switched on
  const year = r.year ?? 0;
  const folder = kind === 'QUESTION_PAPER' ? 'question-paper' : 'answer-key';
  const name = kind === 'QUESTION_PAPER' ? `${r.subjectCode ?? 'paper'}-${slug(r.subjectName ?? r.title)}-${slug(r.language ?? '')}` : slug(r.title).replace(/^$/, 'answer-key');
  const r2Key = `pyq/official/ug/${year}/${folder}/${name}-${r.sha256!.slice(0, 8)}.pdf`;
  if (dry) { console.log(flag ? 'FLAG' : 'OK  ', r2Key, notes.join(' | ')); continue; }

  const bytes = readFileSync(r.file!);
  await env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { sha256: r.sha256!, sourceUrl: r.url, retrievedAt: r.retrievedAt ?? now } });
  const back = await env.MEDIA.head(r2Key);
  if (!back || back.size !== bytes.length) { stats.failed++; console.error('Stored copy does not match', r2Key); continue; }

  // The document row: existing ones are reused, new key documents are added.
  let docId = r.docId ?? null;
  if (!docId) {
    docId = newId('pyq');
    const dupKey = `nta:${kind === 'ANSWER_KEY' ? 'key' : 'paper'}:${r.sha256!.slice(0, 16)}`;
    await db
      .prepare(
        `INSERT INTO pyq_documents (id, key, exam_code, year, kind, classification, official, section, subject_code, subject_name, subject_slug, listed_as, title, exam_date, shift, language, source_site, source_page_url, document_page_url, file_url, file_host, pages, bytes, working, http_status, embeddable, source_claim, note, alternatives_json, sessions_json, replaced_by_key, checked_on, created_at, updated_at, r2_key, review_state, rights_basis)
         VALUES (?, ?, 'CUET_UG', ?, ?, 'OFFICIAL', 1, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, 'NTA', ?, ?, ?, ?, ?, ?, 1, 200, 0, NULL, ?, '[]', NULL, NULL, ?, ?, ?, NULL, NULL, NULL)`,
      )
      .bind(docId, dupKey, r.year, kind, (r.titleOverride ?? r.title).slice(0, 380), r.listedOn ?? r.url, r.listedOn ?? r.url, r.url, host(r.url), r.pages, r.bytes, 'Official NTA answer-key document, hosted by CUET Prep.', today, now, now)
      .run();
    stats.newDocuments++;
  }
  const alternates = all.filter((x) => x.duplicateOf === r.url || x.mirrorOf === r.url || (x.sha256 === r.sha256 && x.url !== r.url)).map((x) => x.url);
  stats.duplicatesNoted += alternates.length;
  const rightsStatus = copyright ? 'FLAGGED' : 'CONFIRMED_BY_MANAGEMENT';
  const verification = flag ? 'FLAGGED' : r.printedCode || r.printedNameMatches ? 'VERIFIED' : 'VERIFIED';
  await db.batch([
    db
      .prepare(
        `INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, pages, r2_key, source_url, alternate_urls_json, retrieved_at, http_status, last_modified, verification, verification_notes_json, printed_subject, printed_code, printed_medium, first_page_excerpt, rights_status, rights_basis, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(newId('hf'), docId, r.sha256, r.bytes, r.pages ?? null, r2Key, r.url, JSON.stringify(alternates), r.retrievedAt ?? now, r.http ?? 200, r.lastModified ?? null, flag ? 'FLAGGED' : 'VERIFIED', JSON.stringify(notes), r.printedSubject ?? null, r.printedCode ?? null, r.printedMedium ?? null, (r.firstPage ?? '').slice(0, 400), rightsStatus, RIGHTS_BASIS, now, now),
    ...(r.docId && r.printedDate ? [db.prepare('UPDATE pyq_documents SET exam_date = COALESCE(exam_date, ?), shift = COALESCE(shift, ?), updated_at = ? WHERE id = ?').bind(r.printedDate, r.printedShift ?? null, now, r.docId)] : []),
    // Switched on (served and shown) only when nothing is flagged; an existing r2_key is never replaced.
    ...(flag
      // A flagged document is not shown to students (the paper listing requires review_state to be empty or REVIEWED). Reversible: clear the state once a person has checked it.
      ? [db.prepare("UPDATE pyq_documents SET review_state = 'IDENTITY_UNVERIFIED', updated_at = ? WHERE id = ? AND review_state IS NULL").bind(now, docId)]
      : [db.prepare('UPDATE pyq_documents SET r2_key = ?, rights_basis = ?, updated_at = ? WHERE id = ? AND r2_key IS NULL').bind(r2Key, 'NTA_PERMISSION_CONFIRMED_BY_MANAGEMENT_2026-11-16', now, docId)]),
  ]);
  stats.stored++;
  if (flag) { stats.flagged++; flagged.push({ url: r.url, notes }); } else stats.verified++;
}
if (!dry) {
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), 'ceo-decision:2026-11-16', 'NTA_LIBRARY_INGESTED', 'PYQ_LIBRARY', 'cuet-ug', JSON.stringify({ stats, flagged }), now)
    .run();
}
console.log(JSON.stringify({ dry, stats, flagged }, null, 1));
await dispose();
