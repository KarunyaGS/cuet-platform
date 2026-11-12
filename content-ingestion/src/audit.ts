/**
 * Paper-by-paper audit of the extraction against the original PDFs. Read-only with respect to sources;
 * writes the report to storage/local/audit/. Nothing is ever marked verified here: only people verify.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from './download';
import { readPdf } from './pdf';
import { popplerAvailable, popplerLines, popplerPageText } from './poppler';
import { isNoise } from './structure';
import type { ExtractionResult, Registry } from './types';

const tokens = (s: string) => (s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);

function counter(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Share of `source` words (with repeats) that also appear in `extracted`. */
function coverage(source: Map<string, number>, extracted: Map<string, number>): number | null {
  let total = 0;
  let hit = 0;
  for (const [t, c] of source) {
    total += c;
    hit += Math.min(c, extracted.get(t) ?? 0);
  }
  return total ? Math.round((1000 * hit) / total) / 10 : null;
}


export interface AuditRow {
  exam: string;
  code: string;
  name: string;
  category: string;
  inOfficialList: boolean;
  matchesBulletin: boolean;
  downloaded: boolean;
  sha256: string | null;
  checksumOk: boolean | null;
  pages: number | null;
  method: string | null;
  ocrPages: string;
  meanOcrConfidence: number | null;
  ocrLowConfidenceLines: number;
  status: string;
  reason: string | null;
  rows: number;
  sections: number;
  units: number;
  topics: number;
  subtopics: number;
  items: number;
  notes: number;
  introductoryText: number;
  inferredHeadings: number;
  tables: number;
  figures: number;
  figuresLinkedToTopic: number;
  formulaRows: number;
  wordsInSource: number;
  sourceWordsCapturedPct: number | null;
  pagesBelow90Pct: string;
  pdftotextAgreementPct: number | null;
  duplicateRows: number;
  sequenceGaps: number;
  issues: string;
  humanVerified: number;
  classification: string;
  /** Rows with no page reference (should be 0). */
  untracedRows: number;
  /** Per page: words in the source, share captured, (ocr) if read by OCR. */
  pageReconciliation: string;
}

export async function runAudit(registry: Registry, paths: { extracted: string; audit: string; checks: string; cache: string }): Promise<AuditRow[]> {
  const checks = existsSync(paths.checks) ? (JSON.parse(readFileSync(paths.checks, 'utf8')) as { checks: { exam: string; matches: boolean; notInBulletin: string[] }[] }).checks : [];
  const shaCount = new Map<string, string[]>();
  const rows: AuditRow[] = [];
  const pageDetail = new Map<string, string>();
  for (const p of registry.papers) {
    const f = join(paths.extracted, p.exam, `${p.code}.json`);
    const r = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult) : null;
    const check = checks.find((c) => c.exam === p.exam);
    const base = {
      exam: p.exam, code: p.code, name: p.name, category: p.categoryCode, inOfficialList: true,
      matchesBulletin: Boolean(check?.matches && !check.notInBulletin.includes(p.code)),
    };
    if (!r || !r.source) {
      rows.push({
        ...base, downloaded: false, sha256: null, checksumOk: null, pages: null, method: null, ocrPages: '', meanOcrConfidence: null,
        ocrLowConfidenceLines: 0, status: r?.status ?? 'NOT RUN', reason: r?.reason ?? 'not extracted yet', rows: 0, sections: 0, units: 0, topics: 0,
        subtopics: 0, items: 0, notes: 0, introductoryText: 0, inferredHeadings: 0, tables: 0, figures: 0, figuresLinkedToTopic: 0, formulaRows: 0,
        wordsInSource: 0, sourceWordsCapturedPct: null, pagesBelow90Pct: '', pdftotextAgreementPct: null, duplicateRows: 0, sequenceGaps: 0,
        issues: '', humanVerified: 0, classification: 'D - NOT DOWNLOADED OR NOT EXTRACTED', untracedRows: 0, pageReconciliation: '',
      });
      continue;
    }
    const data = new Uint8Array(readFileSync(r.source.localFile));
    const checksumOk = sha256(data) === r.source.sha256;
    (shaCount.get(r.source.sha256) ?? shaCount.set(r.source.sha256, []).get(r.source.sha256)!).push(p.code);

    // Source words: PDF text layer for text pages; OCR'd pages are compared with the OCR text itself (inside the nodes).
    const pdf = await readPdf(data);
    const popplerPages = r.popplerPages ?? [];
    const sourceLines = [
      ...pdf.lines.filter((l) => !r.ocrPages.includes(l.page) && !popplerPages.includes(l.page)),
      ...popplerPages.flatMap((pg) => popplerLines(r.source!.localFile, pg)),
    ].filter((l) => !isNoise(l.text, p.code, p.name));
    const extractedText = [
      ...r.nodes.map((n) => `${n.sourceText ?? `${n.label ?? ''} ${n.title}`} ${n.body ?? ''}`),
      ...r.tables.flatMap((t) => t.rows.map((row) => row.join(' '))),
    ].join(' ');
    const extractedWords = counter(tokens(extractedText));
    // OCR'd pages are reconciled against their raw OCR text (noise lines removed the same way).
    const ocrSource = (r.ocrText ?? []).flatMap((o) => o.text.split('\n').filter((t) => !isNoise(t, p.code, p.name)).map((t) => ({ page: o.page, text: t })));
    const allSource = [...sourceLines.map((l) => ({ page: l.page, text: l.text })), ...ocrSource];
    const sourceWords = counter(tokens(allSource.map((l) => l.text).join(' ')));
    const pct = coverage(sourceWords, extractedWords);
    const lowPages: string[] = [];
    const perPage: string[] = [];
    for (let pg = 1; pg <= pdf.pageCount; pg++) {
      const w = counter(tokens(allSource.filter((l) => l.page === pg).map((l) => l.text).join(' ')));
      const n = [...w.values()].reduce((a, b) => a + b, 0);
      const c = coverage(w, extractedWords);
      perPage.push(`p${pg}:${n}w:${c ?? '-'}%${r.ocrPages.includes(pg) ? '(ocr)' : ''}`);
      if (c !== null && c < 90 && n >= 8) lowPages.push(`p${pg}:${c}%`);
    }
    pageDetail.set(`${p.exam}:${p.code}`, perPage.join(' '));
    // Independent check on the pages read with pdf.js: do Poppler and pdf.js see the same words?
    const pdfjsPages = Array.from({ length: pdf.pageCount }, (_, i) => i + 1).filter((pg) => !r.ocrPages.includes(pg) && !popplerPages.includes(pg));
    const popplerWords = pdfjsPages.length ? counter(tokens(pdfjsPages.map((pg) => popplerPageText(r.source!.localFile, pg) ?? '').join(' '))) : null;
    const pdfjsWords = counter(tokens(pdf.lines.filter((l) => pdfjsPages.includes(l.page)).map((l) => l.text).join(' ')));
    const agreement = popplerWords && popplerAvailable() ? coverage(popplerWords, pdfjsWords) : null;

    const kinds = new Map<string, number>();
    for (const n of r.nodes) kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1);
    const dupKeys = counter(r.nodes.map((n) => `${n.parentRef}|${n.kind}|${n.label}|${n.title.toLowerCase()}|${(n.body ?? '').toLowerCase()}`));
    const duplicates = [...dupKeys.values()].reduce((s, c) => s + (c > 1 ? c - 1 : 0), 0);
    const seqGaps = r.issues.filter((i) => i.startsWith('SEQUENCE_GAP')).length;
    const reviewFlags = r.issues.filter((i) => !i.startsWith('FORMULAS'));

    let classification: string;
    if (r.status !== 'EXTRACTED') classification = `C - NOT EXTRACTED (${r.status})`;
    else if (!checksumOk) classification = 'D - CHECKSUM MISMATCH';
    else if ((pct ?? 0) >= 98 && reviewFlags.length === 0 && duplicates === 0 && lowPages.length === 0)
      classification = 'B1 - EXTRACTED, MACHINE CHECKS PASSED, HUMAN VALIDATION PENDING';
    else classification = 'B2 - EXTRACTED, REVIEW FLAGS PRESENT, HUMAN VALIDATION PENDING';

    rows.push({
      ...base, downloaded: true, sha256: r.source.sha256, checksumOk, pages: pdf.pageCount, method: r.method, ocrPages: r.ocrPages.join(','),
      meanOcrConfidence: r.quality.meanOcrConfidence, ocrLowConfidenceLines: r.quality.ocrLowConfidenceLines, status: r.status, reason: r.reason,
      rows: r.nodes.length, sections: (kinds.get('SECTION') ?? 0) + (kinds.get('PART') ?? 0) + (kinds.get('COURSE') ?? 0),
      units: (kinds.get('UNIT') ?? 0) + (kinds.get('CHAPTER') ?? 0), topics: kinds.get('TOPIC') ?? 0, subtopics: kinds.get('SUBTOPIC') ?? 0,
      items: kinds.get('ITEM') ?? 0, notes: kinds.get('NOTE') ?? 0, introductoryText: r.nodes.filter((n) => n.flags.includes('introductory_text')).length,
      inferredHeadings: r.nodes.filter((n) => n.flags.includes('heading_inferred_from_formatting')).length, tables: r.tables.length, figures: r.figures.length,
      figuresLinkedToTopic: r.figures.filter((fg) => fg.nodeRef).length, formulaRows: r.nodes.filter((n) => n.flags.includes('formula_text_check_layout')).length,
      wordsInSource: [...sourceWords.values()].reduce((a, b) => a + b, 0), sourceWordsCapturedPct: pct, pagesBelow90Pct: lowPages.join(' '),
      pdftotextAgreementPct: agreement, duplicateRows: duplicates, sequenceGaps: seqGaps, issues: r.issues.join(' | '), humanVerified: 0, classification,
      untracedRows: r.nodes.filter((n) => n.sourcePage === null).length,
      pageReconciliation: pageDetail.get(`${p.exam}:${p.code}`) ?? '',
    });
  }
  // The same PDF published for two different papers would be a source problem worth knowing about.
  for (const [sha, codes] of shaCount) if (codes.length > 1) for (const row of rows.filter((x) => x.sha256 === sha)) row.issues += ` | SAME_PDF_AS: ${codes.join(',')}`;
  // Known problems in the official documents themselves (recorded by people, with evidence).
  const sourceIssuesFile = join(paths.checks, '..', 'source-issues.json');
  if (existsSync(sourceIssuesFile)) {
    const known = (JSON.parse(readFileSync(sourceIssuesFile, 'utf8')) as { issues: { exam: string; code: string; issue: string }[] }).issues;
    for (const k of known) {
      const codes = k.code.includes('-') && /^\d+-\d+$/.test(k.code)
        ? rows.filter((r) => r.exam === k.exam && Number(r.code) >= Number(k.code.split('-')[0]) && Number(r.code) <= Number(k.code.split('-')[1])).map((r) => r.code)
        : k.code.split(',');
      for (const row of rows.filter((r) => r.exam === k.exam && codes.includes(r.code))) row.issues += ` | SOURCE_ISSUE: ${k.issue}`;
    }
  }

  mkdirSync(paths.audit, { recursive: true });
  // Human-readable report: one line per paper.
  const md = [
    `# CUET syllabus extraction audit`,
    ``,
    `Audited: ${new Date().toISOString()}. Every row is machine-extracted and UNVERIFIED until a person checks it.`,
    ``,
    `| Exam | Code | Paper | Pages | Method | OCR pages | Mean OCR % | Rows | Units | Topics | Subtopics+items | Words captured % | Pages <90% | Seq. gaps | Status |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
    ...rows.map((r) =>
      `| ${r.exam} | ${r.code} | ${r.name.replace(/\|/g, '/')} | ${r.pages ?? '-'} | ${r.method ?? '-'} | ${r.ocrPages || '-'} | ${r.meanOcrConfidence ?? '-'} | ${r.rows} | ${r.units} | ${r.topics} | ${r.subtopics + r.items} | ${r.sourceWordsCapturedPct ?? '-'} | ${r.pagesBelow90Pct || '-'} | ${r.sequenceGaps} | ${r.classification}${r.reason ? ` (${r.reason.slice(0, 80)})` : ''} |`,
    ),
  ];
  writeFileSync(join(paths.audit, 'audit.md'), md.join('\n') + '\n');
  writeFileSync(join(paths.audit, 'audit.json'), JSON.stringify({ auditedAt: new Date().toISOString(), rows }, null, 1));
  const cols = Object.keys(rows[0] ?? {}) as (keyof AuditRow)[];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  writeFileSync(join(paths.audit, 'audit.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
  return rows;
}

export function printAuditSummary(rows: AuditRow[]) {
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const rs = rows.filter((r) => r.exam === exam);
    const sum = (k: keyof AuditRow) => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const pcts = rs.map((r) => r.sourceWordsCapturedPct).filter((x): x is number => x !== null).sort((a, b) => a - b);
    const agree = rs.map((r) => r.pdftotextAgreementPct).filter((x): x is number => x !== null).sort((a, b) => a - b);
    const cls = new Map<string, number>();
    for (const r of rs) cls.set(r.classification, (cls.get(r.classification) ?? 0) + 1);
    console.log(`\n${exam}: ${rs.length} official papers | matches bulletin ${rs.filter((r) => r.matchesBulletin).length} | downloaded ${rs.filter((r) => r.downloaded).length} | checksum ok ${rs.filter((r) => r.checksumOk).length} | extracted ${rs.filter((r) => r.status === 'EXTRACTED').length}`);
    console.log(`  method: text ${rs.filter((r) => r.method === 'text_layer').length}, text+ocr ${rs.filter((r) => r.method === 'text_layer+ocr').length}, ocr ${rs.filter((r) => r.method === 'ocr').length}`);
    console.log(`  rows ${sum('rows')}: sections ${sum('sections')}, units/chapters ${sum('units')}, topics ${sum('topics')}, subtopics ${sum('subtopics')}, items ${sum('items')}, notes ${sum('notes')} (introductory ${sum('introductoryText')}); inferred headings ${sum('inferredHeadings')}`);
    console.log(`  tables ${sum('tables')} | figures ${sum('figures')} (linked ${sum('figuresLinkedToTopic')}) | formula rows ${sum('formulaRows')} | duplicates ${sum('duplicateRows')} | sequence gaps ${sum('sequenceGaps')}`);
    if (pcts.length) console.log(`  source words captured: min ${pcts[0]}% median ${pcts[Math.floor(pcts.length / 2)]}% | >=99%: ${pcts.filter((x) => x >= 99).length}, 98-99%: ${pcts.filter((x) => x >= 98 && x < 99).length}, <98%: ${pcts.filter((x) => x < 98).length}`);
    if (agree.length) console.log(`  pdf.js vs pdftotext word agreement: min ${agree[0]}% median ${agree[Math.floor(agree.length / 2)]}%`);
    console.log(`  papers with pages under 90% captured: ${rs.filter((r) => r.pagesBelow90Pct).length}`);
    const pageCells = rs.flatMap((r) => r.pageReconciliation.split(' ').filter(Boolean));
    const withWords = pageCells.filter((c) => !/:0w:/.test(c));
    const fullyCaptured = withWords.filter((c) => Number(/:([\d.]+)%/.exec(c)?.[1] ?? 0) >= 90);
    console.log(`  pages: ${sum('pages')} in PDFs | ${withWords.length} with syllabus words | ${fullyCaptured.length} with >=90% of their words captured | ${pageCells.filter((c) => c.endsWith('(ocr)')).length} read by OCR`);
    const ocrDocs = rs.filter((r) => r.meanOcrConfidence !== null);
    if (ocrDocs.length) console.log(`  OCR documents ${ocrDocs.length}: mean Tesseract confidence ${ocrDocs.map((r) => `${r.code}=${r.meanOcrConfidence}`).join(' ')}`);
    console.log(`  rows without a page reference: ${sum('untracedRows')}`);
    for (const [k, v] of cls) console.log(`  ${v} x ${k}`);
  }
}
