/**
 * Source-to-database traceability and integrity report, read from the LOCAL D1 database.
 * For every stored syllabus row: its relationships, its source PDF (URL, SHA-256, R2 copy), its cited page,
 * a field-by-field match with the extraction dataset, and a check that its words are on that page of the PDF.
 * For every page of every paper: what the database holds for it, or why it holds nothing yet.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from './pdf';
import type { ExtractionResult, Registry } from './types';

const repo = join(import.meta.dirname, '..', '..');
const wranglerBin = [join(repo, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(repo, 'backend', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync)!;

function d1<T = Record<string, unknown>>(sql: string): T[] {
  // CUET_D1_ARGS selects another database, e.g. "--env production --local" for the migration rehearsal.
  const where = (process.env['CUET_D1_ARGS'] ?? '--local').split(' ').filter(Boolean);
  const out = execFileSync(process.execPath, [wranglerBin, 'd1', 'execute', 'DB', ...where, '--json', '--command', sql], {
    cwd: join(repo, 'backend'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 200_000_000,
  });
  return (JSON.parse(out) as { results: T[] }[])[0]!.results;
}

const tokens = (s: string) => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];

export async function runTrace(registry: Registry, paths: { extracted: string; audit: string; verification: string }, api = 'http://127.0.0.1:8787') {
  const checks: { check: string; failures: number; detail: string }[] = [];
  const check = (name: string, rows: unknown[], detail = '') => checks.push({ check: name, failures: rows.length, detail: rows.length ? JSON.stringify(rows.slice(0, 3)) : detail });

  // ---- relationship integrity (SQL) ----
  check('rows whose parent is missing', d1(`SELECT n.id FROM curriculum_nodes n LEFT JOIN curriculum_nodes p ON p.id = n.parent_id WHERE n.parent_id IS NOT NULL AND p.id IS NULL`));
  check('rows whose parent is in another syllabus version', d1(`SELECT n.id FROM curriculum_nodes n JOIN curriculum_nodes p ON p.id = n.parent_id WHERE p.syllabus_version_id != n.syllabus_version_id`));
  check('rows whose depth does not follow their parent', d1(`SELECT n.id FROM curriculum_nodes n JOIN curriculum_nodes p ON p.id = n.parent_id WHERE n.depth != p.depth + 1`));
  check('top-level rows not at depth 1', d1(`SELECT id FROM curriculum_nodes WHERE parent_id IS NULL AND depth != 1`));
  check('rows without a syllabus version', d1(`SELECT n.id FROM curriculum_nodes n LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.id IS NULL`));
  check('syllabus versions without a source document', d1(`SELECT v.id FROM syllabus_versions v LEFT JOIN source_documents d ON d.id = v.source_document_id WHERE d.id IS NULL`));
  check('syllabus versions without a paper', d1(`SELECT v.id FROM syllabus_versions v LEFT JOIN test_papers p ON p.id = v.test_paper_id WHERE p.id IS NULL`));
  check('papers whose subject belongs to another exam', d1(`SELECT p.id FROM test_papers p JOIN subjects s ON s.id = p.subject_id JOIN exam_cycles c ON c.id = p.exam_cycle_id WHERE s.exam_id != c.exam_id`));
  check('rows citing a page outside their PDF', d1(`SELECT n.id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN source_documents d ON d.id = v.source_document_id WHERE n.source_page IS NULL OR n.source_page < 1 OR n.source_page > d.page_count`));
  check('duplicate rows (same parent, kind, label, title, body)', d1(`SELECT syllabus_version_id, COUNT(*) c FROM curriculum_nodes GROUP BY syllabus_version_id, COALESCE(parent_id,''), kind, COALESCE(label,''), title, COALESCE(body,'') HAVING c > 1`));
  check('VERIFIED rows without a signed-in reviewer decision', d1(`SELECT n.id FROM curriculum_nodes n WHERE n.verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'CURRICULUM_NODE' AND r.entity_id = n.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')`));
  check('VERIFIED syllabus versions without a signed-in reviewer sign-off', d1(`SELECT v.id FROM syllabus_versions v WHERE v.verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'SYLLABUS_VERSION' AND r.entity_id = v.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')`));
  check('VERIFIED questions or lessons without a signed-in reviewer decision', [
    ...d1(`SELECT q.id FROM questions q WHERE q.verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'QUESTION' AND r.entity_id = q.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')`),
    ...d1(`SELECT l.id FROM learning_resources l WHERE l.verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'LEARNING_RESOURCE' AND r.entity_id = l.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')`),
  ]);
  check('rows in machine-verified versions whose status changed without a review record', d1(`SELECT n.id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.verification = 'MACHINE_VERIFIED' AND n.verification != 'MACHINE_VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'CURRICULUM_NODE' AND r.entity_id = n.id)`));
  check('rows typed by a person without an author', d1(`SELECT id FROM curriculum_nodes WHERE (extraction_flags LIKE '%manual_transcription%' OR extraction_flags LIKE '%manually_added%') AND authored_by IS NULL`));
  check('AI-assisted questions or lessons not labelled as such', [
    ...d1(`SELECT id FROM questions WHERE origin NOT IN ('AI_ASSISTED','OFFICIAL_SOURCE','OFFICIAL_SAMPLE','PAST_PAPER','LICENSED','AUTHORED','DEMONSTRATION')`),
  ]);
  check('machine-verified versions without evidence', d1(`SELECT v.id FROM syllabus_versions v LEFT JOIN verification_evidence e ON e.entity_id = v.id WHERE v.verification = 'MACHINE_VERIFIED' AND e.id IS NULL`));
  check('published syllabus versions not signed off by a person', d1(`SELECT id FROM syllabus_versions WHERE status = 'PUBLISHED' AND verification != 'VERIFIED'`));

  // ---- source copies in local R2 ----
  const docs = d1<{ id: string; url: string; sha256: string; r2_key: string | null; page_count: number }>(`SELECT id, url, sha256, r2_key, page_count FROM source_documents`);
  const token = process.env['CUET_ADMIN_TOKEN'] ?? /^ADMIN_API_TOKEN\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(join(repo, 'backend', '.dev.vars'), 'utf8'))?.[1];
  const missingR2: string[] = [];
  for (const d of docs) {
    const res = d.r2_key ? await fetch(`${api}/api/admin/files/${d.r2_key}`, { headers: { 'x-admin-token': token ?? '' } }).catch(() => null) : null;
    if (!res?.ok) missingR2.push(d.url);
    else await res.arrayBuffer();
  }
  check('source documents whose PDF copy is missing from local R2', missingR2);

  // ---- every stored row against the extraction dataset and the original PDF page ----
  const rows = d1<{ id: string; paper_code: string; exam: string; kind: string; label: string | null; title: string; body: string | null; source_page: number; depth: number; position: number; verification: string; url: string; sha256: string; r2_key: string; person: number }>(
    `SELECT n.id, p.code AS paper_code, e.code AS exam, n.kind, n.label, n.title, n.body, n.source_page, n.depth, n.position, n.verification, d.url, d.sha256, d.r2_key,
       (n.authored_by IS NOT NULL OR n.edited_by IS NOT NULL) AS person
     FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers p ON p.id = v.test_paper_id
     JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id JOIN source_documents d ON d.id = v.source_document_id`,
  );
  const byPaper = new Map<string, typeof rows>();
  for (const r of rows) byPaper.set(`${r.exam}:${r.paper_code}`, [...(byPaper.get(`${r.exam}:${r.paper_code}`) ?? []), r]);
  const verification = existsSync(join(paths.verification, 'verification.json'))
    ? new Map((JSON.parse(readFileSync(join(paths.verification, 'verification.json'), 'utf8')) as { results: { exam: string; code: string; verdict: string; reasons: string[] }[] }).results.map((v) => [`${v.exam}:${v.code}`, v]))
    : new Map();
  const notInDataset: string[] = [];
  const notOnPage: string[] = [];
  let changedByPeople = 0;
  let reviewRowsFailingPageCheck = 0;
  const countMismatch: string[] = [];
  const pageRows: string[] = ['exam,paper,page,stored_rows,status,source_url,sha256'];
  const paperRows: string[] = ['exam,paper,name,verdict,stored_rows,dataset_rows,pages,source_url,sha256,r2_key,reason'];
  for (const p of registry.papers) {
    const key = `${p.exam}:${p.code}`;
    const stored = byPaper.get(key) ?? [];
    const f = join(paths.extracted, p.exam, `${p.code}.json`);
    const r = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult) : null;
    const v = verification.get(key);
    const pages = r?.source?.pageCount ?? 0;
    if (stored.length && r) {
      const machineRows = stored.filter((s) => !s.person);
      changedByPeople += stored.length - machineRows.length;
      // Rows a person added or corrected are compared with their review history, not the extraction.
      if (machineRows.length === stored.length && stored.length !== new Set(r.nodes.map((n) => `${n.parentRef}|${n.kind}|${n.label}|${n.title}|${n.body}`)).size && stored.length !== r.nodes.length) {
        countMismatch.push(`${p.code}: stored ${stored.length}, dataset ${r.nodes.length}`);
      }
      const dataset = new Set(r.nodes.map((n) => `${n.kind}|${n.label ?? ''}|${n.title}|${n.body ?? ''}|${n.sourcePage}|${n.depth}|${n.position}`));
      const pdf = await readPdf(new Uint8Array(readFileSync(r.source!.localFile)));
      for (const s of stored) {
        if (s.person) continue;
        if (!dataset.has(`${s.kind}|${s.label ?? ''}|${s.title}|${s.body ?? ''}|${s.source_page}|${s.depth}|${s.position}`)) notInDataset.push(`${p.code}:${s.id}`);
        const node = r.nodes.find((n) => n.title === s.title && n.sourcePage === s.source_page && n.kind === s.kind);
        const last = Math.max(s.source_page, node?.endPage ?? s.source_page);
        const pageWords = new Set(tokens(pdf.lines.filter((l) => l.page >= s.source_page && l.page <= last).map((l) => l.text).join(' ')));
        const words = tokens(`${node?.sourceText ?? `${s.label ?? ''} ${s.title}`} ${s.body ?? ''}`);
        if (words.some((w) => !pageWords.has(w))) {
          // Machine-verified rows must pass; review drafts are in review precisely because some do not.
          if (s.verification === 'MACHINE_VERIFIED') notOnPage.push(`${p.code}:${s.id}`);
          else reviewRowsFailingPageCheck++;
        }
      }
    }
    const stored0 = stored[0];
    paperRows.push([p.exam, p.code, `"${p.name.replace(/"/g, '""')}"`, v?.verdict ?? 'NOT_RUN', stored.length, r?.nodes.length ?? 0, pages, stored0?.url ?? p.officialSyllabusUrl, stored0?.sha256 ?? r?.source?.sha256 ?? '', stored0?.r2_key ?? '', `"${(v?.reasons ?? []).join('; ').replace(/"/g, '""')}"`].join(','));
    for (let pg = 1; pg <= pages; pg++) {
      const n = stored.filter((s) => s.source_page === pg).length;
      const status = n ? 'STORED' : v?.verdict === 'MACHINE_VERIFIED' ? 'NO_SYLLABUS_ROWS_ON_PAGE' : v?.verdict ?? 'NOT_RUN';
      pageRows.push([p.exam, p.code, pg, n, status, p.officialSyllabusUrl, r?.source?.sha256 ?? ''].join(','));
    }
  }
  check('stored rows that do not match the extraction dataset field for field', notInDataset);
  check('machine-verified rows whose words are not on their cited page of the original PDF', notOnPage);
  check('papers whose stored row count differs from the dataset', countMismatch);

  mkdirSync(paths.audit, { recursive: true });
  writeFileSync(join(paths.audit, 'traceability-papers.csv'), paperRows.join('\n') + '\n');
  writeFileSync(join(paths.audit, 'traceability-pages.csv'), pageRows.join('\n') + '\n');
  writeFileSync(join(paths.audit, 'integrity-checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), storedRows: rows.length, sourceDocuments: docs.length, changedByPeople, reviewRowsFailingPageCheck, checks }, null, 1));
  console.log(`Stored rows checked: ${rows.length} | source documents: ${docs.length} | rows added or corrected by people: ${changedByPeople} | review-draft rows whose words are not in the PDF text layer (OCR or layout; why they await review): ${reviewRowsFailingPageCheck}`);
  for (const c of checks) console.log(`${c.failures === 0 ? 'PASS' : 'FAIL'}  ${c.check}${c.failures ? ` (${c.failures}) ${c.detail}` : ''}`);
  const pageStatus = new Map<string, number>();
  for (const line of pageRows.slice(1)) {
    const st = line.split(',')[4]!;
    pageStatus.set(st, (pageStatus.get(st) ?? 0) + 1);
  }
  console.log('Pages by status:', JSON.stringify(Object.fromEntries(pageStatus)));
}
