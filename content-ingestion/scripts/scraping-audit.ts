/**
 * Scraping-only audit: collection, extraction, coverage, gaps, OCR, duplicates/mapping, human verification.
 * Reads the official registry, extraction dataset, audit, verification, visual cross-check and the LOCAL D1.
 * Writes storage/local/audit/scraping-audit.csv (one row per paper) and scraping-audit.json. Read-only.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../src/verify';

const repo = join(import.meta.dirname, '..', '..');
const L = join(repo, 'storage', 'local');
const registry = JSON.parse(readFileSync(join(repo, 'content-ingestion', 'registry', 'cuet-2026-official-papers.json'), 'utf8')) as { papers: { exam: string; code: string; name: string }[] };
const audit = new Map((JSON.parse(readFileSync(join(L, 'audit', 'audit.json'), 'utf8')) as { rows: Record<string, unknown>[] }).rows.map((r) => [`${r['exam']}:${r['code']}`, r]));
const verification = new Map((JSON.parse(readFileSync(join(L, 'verification', 'verification.json'), 'utf8')) as { results: { exam: string; code: string; verdict: string; reasons: string[]; metrics: { rows: number; recordsPassing: number } }[] }).results.map((v) => [`${v.exam}:${v.code}`, v]));
const cross = parseCsv(readFileSync(join(L, 'audit', 'visual-crosscheck.csv'), 'utf8'));
const wrangler = join(repo, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const d1 = <T,>(sql: string): T[] => JSON.parse(execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local', '--json', '--command', sql], { cwd: join(repo, 'backend'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 200_000_000 }))[0].results;

// Stored rows of the CURRENT version of each paper (archived versions are history).
const stored = d1<{ exam: string; code: string; kind: string; verification: string; flags: string | null; rows: number }>(
  `SELECT e.code AS exam, p.code, n.kind, n.verification, n.extraction_flags AS flags, COUNT(*) AS rows
   FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers p ON p.id = v.test_paper_id
   JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id
   WHERE v.status != 'ARCHIVED' GROUP BY e.code, p.code, n.kind, n.verification, n.extraction_flags`,
);
const versions = d1<{ exam: string; code: string; verification: string; status: string; signed: number }>(
  `SELECT e.code AS exam, p.code, v.verification, v.status,
     EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'SYLLABUS_VERSION' AND r.entity_id = v.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%') AS signed
   FROM syllabus_versions v JOIN test_papers p ON p.id = v.test_paper_id JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE v.status != 'ARCHIVED'`,
);
const humanRows = d1<{ n: number }>(`SELECT COUNT(*) AS n FROM curriculum_nodes n WHERE n.verification = 'VERIFIED' AND EXISTS (SELECT 1 FROM review_records r WHERE r.entity_type = 'CURRICULUM_NODE' AND r.entity_id = n.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')`)[0]!.n;
const dupes = d1<{ c: number }>(`SELECT COUNT(*) AS c FROM (SELECT 1 FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.status != 'ARCHIVED' GROUP BY n.syllabus_version_id, COALESCE(n.parent_id,''), n.kind, COALESCE(n.label,''), n.title, COALESCE(n.body,'') HAVING COUNT(*) > 1)`)[0]!.c;

const LEVEL: Record<string, string> = { PART: 'section', SECTION: 'section', COURSE: 'section', UNIT: 'unit', CHAPTER: 'unit', TOPIC: 'topic', SUBTOPIC: 'subtopic', ITEM: 'item', NOTE: 'note' };
const out: Record<string, string | number>[] = [];
for (const p of registry.papers) {
  const k = `${p.exam}:${p.code}`;
  const a = audit.get(k) ?? {};
  const v = verification.get(k);
  const f = join(L, 'extracted', p.exam, `${p.code}.json`);
  const x = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as { status: string; ocrPages: number[]; nodes: unknown[]; source?: { pageCount: number } }) : null;
  const rows = stored.filter((s) => s.exam === p.exam && s.code === p.code);
  const sum = (pred: (s: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((t, s) => t + s.rows, 0);
  const pages = cross.filter((c) => c['exam'] === p.exam && c['code'] === p.code);
  const ver = versions.find((s) => s.exam === p.exam && s.code === p.code);
  out.push({
    exam: p.exam, code: p.code, name: p.name,
    collected: a['downloaded'] && a['checksumOk'] ? 'yes' : 'no',
    pages: x?.source?.pageCount ?? Number(a['pages'] ?? 0),
    extraction: x?.status ?? 'NONE',
    machineVerdict: v?.verdict ?? 'NONE',
    storedRows: sum(() => true),
    units: sum((s) => LEVEL[s.kind] === 'unit' || LEVEL[s.kind] === 'section'),
    topics: sum((s) => LEVEL[s.kind] === 'topic'),
    subtopics: sum((s) => LEVEL[s.kind] === 'subtopic'),
    items: sum((s) => LEVEL[s.kind] === 'item'),
    notes: sum((s) => LEVEL[s.kind] === 'note'),
    rowsMachineVerified: sum((s) => s.verification === 'MACHINE_VERIFIED'),
    rowsUnverified: sum((s) => s.verification === 'UNVERIFIED'),
    rowsHumanVerified: sum((s) => s.verification === 'VERIFIED'),
    rowsGuessedHeading: sum((s) => (s.flags ?? '').includes('heading_inferred')),
    rowsHeadingInBody: sum((s) => (s.flags ?? '').includes('heading_found_inside_body')),
    rowsOcr: sum((s) => /(^|,)ocr/.test(s.flags ?? '')),
    sourceWords: Number(a['wordsInSource'] ?? 0),
    sourceWordsCapturedPct: a['sourceWordsCapturedPct'] === null || a['sourceWordsCapturedPct'] === undefined ? '' : Number(a['sourceWordsCapturedPct']),
    ocrPages: (x?.ocrPages ?? []).join(' '),
    visualPagesOk: pages.filter((c) => c['status'] === 'OK').length,
    visualPagesCheck: pages.filter((c) => c['status'] === 'CHECK').length,
    visualPagesNoText: pages.filter((c) => c['status'] === 'NO_TEXT').length,
    visualPagesSkipped: pages.filter((c) => c['status'] === 'SKIPPED').length,
    visualWordsRead: pages.reduce((t, c) => t + Number(c['ocrWords'] || 0), 0),
    visualWordsFound: pages.reduce((t, c) => t + Number(c['foundInExtraction'] || 0), 0),
    sequenceGaps: Number(a['sequenceGaps'] ?? 0),
    humanSignedOff: ver?.signed ? 'yes' : 'no',
    reasons: (v?.reasons ?? []).join('; '),
  });
}
const cols = Object.keys(out[0]!);
writeFileSync(join(L, 'audit', 'scraping-audit.csv'), [cols.join(','), ...out.map((r) => cols.map((c) => `"${String(r[c]).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n');
writeFileSync(join(L, 'audit', 'scraping-audit.json'), JSON.stringify({ at: new Date().toISOString(), humanVerifiedRows: humanRows, exactDuplicateGroups: dupes, papers: out }, null, 1));

// ---- summary
const by = (exam?: string) => out.filter((r) => !exam || r['exam'] === exam);
const n = (rs: typeof out, key: string) => rs.reduce((t, r) => t + Number(r[key] || 0), 0);
for (const exam of ['CUET_UG', 'CUET_PG', undefined]) {
  const rs = by(exam);
  const words = n(rs, 'sourceWords');
  const captured = rs.reduce((t, r) => t + (r['sourceWordsCapturedPct'] === '' ? 0 : (Number(r['sourceWords']) * Number(r['sourceWordsCapturedPct'])) / 100), 0);
  console.log(`\n== ${exam ?? 'ALL'}: ${rs.length} papers`);
  console.log(JSON.stringify({
    collected: rs.filter((r) => r['collected'] === 'yes').length,
    extracted: rs.filter((r) => r['extraction'] === 'EXTRACTED').length,
    blocked: rs.filter((r) => r['extraction'] !== 'EXTRACTED').map((r) => r['code']).join(' ') || 'none',
    verdicts: { MACHINE_VERIFIED: rs.filter((r) => r['machineVerdict'] === 'MACHINE_VERIFIED').length, NEEDS_REVIEW: rs.filter((r) => r['machineVerdict'] === 'NEEDS_REVIEW').length, BLOCKED: rs.filter((r) => r['machineVerdict'] === 'BLOCKED').length },
    pages: n(rs, 'pages'),
    storedRows: n(rs, 'storedRows'), units: n(rs, 'units'), topics: n(rs, 'topics'), subtopics: n(rs, 'subtopics'), items: n(rs, 'items'), notes: n(rs, 'notes'),
    rowsMachineVerified: n(rs, 'rowsMachineVerified'), rowsUnverified: n(rs, 'rowsUnverified'), rowsHumanVerified: n(rs, 'rowsHumanVerified'),
    textLayerWords: words, textLayerWordsCapturedPct: words ? Math.round((1000 * captured) / words) / 10 : null,
    papersBelow100pctCapture: rs.filter((r) => r['sourceWordsCapturedPct'] !== '' && Number(r['sourceWordsCapturedPct']) < 100).map((r) => `${r['code']}:${r['sourceWordsCapturedPct']}%`).join(' ') || 'none',
    visualWordsRead: n(rs, 'visualWordsRead'), visualWordsFound: n(rs, 'visualWordsFound'),
    visualPages: { ok: n(rs, 'visualPagesOk'), check: n(rs, 'visualPagesCheck'), noText: n(rs, 'visualPagesNoText'), skipped: n(rs, 'visualPagesSkipped') },
    papersWithOcrPages: rs.filter((r) => r['ocrPages']).length, ocrPageCount: rs.reduce((t, r) => t + String(r['ocrPages']).split(' ').filter(Boolean).length, 0),
    rowsGuessedHeading: n(rs, 'rowsGuessedHeading'), rowsHeadingInBody: n(rs, 'rowsHeadingInBody'), rowsOcr: n(rs, 'rowsOcr'), papersWithSequenceGaps: rs.filter((r) => Number(r['sequenceGaps']) > 0).length,
    papersSignedOff: rs.filter((r) => r['humanSignedOff'] === 'yes').length,
  }, null, 0));
}
console.log(`\nhuman-verified rows (with a signed-in reviewer's record): ${humanRows}; exact duplicate row groups: ${dupes}`);
