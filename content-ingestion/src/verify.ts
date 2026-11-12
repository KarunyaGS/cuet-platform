/**
 * Evidence-based machine verification. A paper is MACHINE_VERIFIED only when ALL of these hold:
 *  1. It was extracted from the PDF text layer (no OCR pages, no fallback extractor pages).
 *  2. Record level: every word of every row is found on that row's own page(s) in the pdf.js text,
 *     and at least 98% in Poppler's independently extracted text of the same pages.
 *  3. Document level: 100% of the source words are captured in the rows.
 *  4. Visual level: the independent OCR re-read of every page found nothing missing (status OK or NO_TEXT).
 *  5. No review flags: no guessed headings, headings inside text, numbering gaps, formulas, lost symbols,
 *     duplicate rows or figure/image questions.
 * MACHINE_VERIFIED is not human verification. Publishing still requires a person's approval.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from './pdf';
import { popplerPageText } from './poppler';
import type { ExtractionResult, Registry } from './types';

export type PaperVerdict = 'MACHINE_VERIFIED' | 'NEEDS_REVIEW' | 'BLOCKED';

export interface RecordCheck {
  ref: string;
  words: number;
  missingOnPagePdfjs: string[];
  popplerAgreementPct: number;
  flags: string[];
  ok: boolean;
}

export interface PaperVerification {
  exam: string;
  code: string;
  name: string;
  verdict: PaperVerdict;
  reasons: string[];
  metrics: {
    rows: number;
    recordsPassing: number;
    sourceWordsCapturedPct: number | null;
    crosscheckPages: { ok: number; check: number; noText: number; missing: number };
    pages: number;
  };
  records: RecordCheck[];
}

const BLOCKING_FLAGS = ['heading_inferred_from_formatting', 'heading_found_inside_body', 'symbols_lost_in_pdf_text', 'formula_text_check_layout', 'ocr'];
const tokens = (s: string) => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head!.length).map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i]!])));
}

export async function runVerification(registry: Registry, paths: { extracted: string; audit: string; out: string }): Promise<PaperVerification[]> {
  const auditFile = join(paths.audit, 'audit.json');
  const crossFile = join(paths.audit, 'visual-crosscheck.csv');
  if (!existsSync(auditFile)) throw new Error('Run the audit first: npm run ingest -- audit');
  const audit = new Map((JSON.parse(readFileSync(auditFile, 'utf8')) as { rows: { exam: string; code: string; sourceWordsCapturedPct: number | null; duplicateRows: number }[] }).rows.map((r) => [`${r.exam}:${r.code}`, r]));
  const cross = existsSync(crossFile) ? parseCsv(readFileSync(crossFile, 'utf8')) : null;
  const results: PaperVerification[] = [];

  for (const p of registry.papers) {
    const f = join(paths.extracted, p.exam, `${p.code}.json`);
    const r = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult) : null;
    const reasons: string[] = [];
    const a = audit.get(`${p.exam}:${p.code}`);
    const pagesCross = cross?.filter((c) => c.exam === p.exam && c.code === p.code) ?? [];
    const crossStats = {
      ok: pagesCross.filter((c) => c.status === 'OK').length,
      check: pagesCross.filter((c) => c.status === 'CHECK').length,
      noText: pagesCross.filter((c) => c.status === 'NO_TEXT').length,
      missing: (r?.source?.pageCount ?? 0) - pagesCross.length,
    };
    if (!r || r.status !== 'EXTRACTED' || !r.source) {
      results.push({
        exam: p.exam, code: p.code, name: p.name, verdict: 'BLOCKED', reasons: [r?.reason ?? 'not extracted'],
        metrics: { rows: r?.nodes.length ?? 0, recordsPassing: 0, sourceWordsCapturedPct: null, crosscheckPages: crossStats, pages: r?.source?.pageCount ?? 0 },
        records: [],
      });
      continue;
    }

    // Record level: each row against its own page(s), in both extractors.
    const pdf = await readPdf(new Uint8Array(readFileSync(r.source.localFile)));
    const jsPage = new Map<number, Map<string, number>>();
    const popPage = new Map<number, Set<string>>();
    for (let pg = 1; pg <= pdf.pageCount; pg++) {
      const m = new Map<string, number>();
      for (const t of tokens(pdf.lines.filter((l) => l.page === pg).map((l) => l.text).join(' '))) m.set(t, (m.get(t) ?? 0) + 1);
      jsPage.set(pg, m);
      popPage.set(pg, new Set(tokens(popplerPageText(r.source.localFile, pg) ?? '')));
    }
    const records: RecordCheck[] = r.nodes.map((n) => {
      const first = n.sourcePage ?? 1;
      const last = Math.max(first, n.endPage ?? first);
      const pages = Array.from({ length: last - first + 1 }, (_, i) => first + i);
      const words = tokens(`${n.sourceText ?? `${n.label ?? ''} ${n.title}`} ${n.body ?? ''}`);
      const onPage = new Set(pages.flatMap((pg) => [...(jsPage.get(pg)?.keys() ?? [])]));
      const popWords = new Set(pages.flatMap((pg) => [...(popPage.get(pg) ?? [])]));
      const missing = [...new Set(words.filter((w) => !onPage.has(w)))];
      const agree = words.length ? (100 * words.filter((w) => popWords.has(w)).length) / words.length : 100;
      const flags = n.flags.filter((fl) => BLOCKING_FLAGS.some((b) => fl === b || fl.startsWith(`${b}_`) || fl.startsWith(`${b}(`)));
      return { ref: n.ref, words: words.length, missingOnPagePdfjs: missing, popplerAgreementPct: Math.round(agree * 10) / 10, flags, ok: missing.length === 0 && agree >= 98 && flags.length === 0 };
    });

    if (r.method !== 'text_layer' || r.ocrPages.length || (r.popplerPages ?? []).length) reasons.push(`text not from a clean text layer (method ${r.method}${r.ocrPages.length ? `, OCR pages ${r.ocrPages.join(',')}` : ''}${(r.popplerPages ?? []).length ? `, pdftotext pages ${r.popplerPages!.join(',')}` : ''})`);
    const failing = records.filter((x) => !x.ok);
    if (failing.length) reasons.push(`${failing.length} of ${records.length} rows fail the record-level check (${[...new Set(failing.flatMap((x) => (x.flags.length ? x.flags.map((fl) => fl.split('(')[0]!) : x.missingOnPagePdfjs.length ? ['words not on cited page'] : ['second extractor disagrees'])))].join(', ')})`);
    if (!a || (a.sourceWordsCapturedPct ?? 0) < 100) reasons.push(`source words captured ${a?.sourceWordsCapturedPct ?? 'unknown'}% (needs 100%)`);
    if ((a?.duplicateRows ?? 0) > 0) reasons.push(`${a!.duplicateRows} duplicate row(s)`);
    const reviewIssues = r.issues.filter((i) => !i.startsWith('SOURCE_ISSUE'));
    if (reviewIssues.length) reasons.push(`review flags: ${[...new Set(reviewIssues.map((i) => i.split(':')[0]))].join(', ')}`);
    if (!cross) reasons.push('visual cross-check not run');
    else if (crossStats.check || crossStats.missing) reasons.push(`visual cross-check: ${crossStats.check} page(s) to check, ${crossStats.missing} page(s) not checked`);
    // Pages with Indian-script (or other non-Latin) text must be positively confirmed by the visual check:
    // both text extractors can be wrong in the same way for such fonts, so "no readable text" is not enough.
    for (let pg = 1; pg <= pdf.pageCount; pg++) {
      const nonLatin = (pdf.lines.filter((l) => l.page === pg).map((l) => l.text).join(' ').match(/[ऀ-෿؀-ۿༀ-࿿]/g) ?? []).length;
      const status = pagesCross.find((c) => Number(c.page) === pg)?.status;
      if (nonLatin >= 20 && status !== 'OK') reasons.push(`page ${pg}: non-Latin text not independently confirmed by the visual check (${status ?? 'not checked'})`);
    }

    results.push({
      exam: p.exam, code: p.code, name: p.name, verdict: reasons.length ? 'NEEDS_REVIEW' : 'MACHINE_VERIFIED', reasons,
      metrics: { rows: r.nodes.length, recordsPassing: records.length - failing.length, sourceWordsCapturedPct: a?.sourceWordsCapturedPct ?? null, crosscheckPages: crossStats, pages: pdf.pageCount },
      records,
    });
  }

  mkdirSync(paths.out, { recursive: true });
  writeFileSync(join(paths.out, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', results }, null, 1));
  // Review queue: every row of every paper that is not machine-verified, with its own status.
  const queue = results
    .filter((v) => v.verdict !== 'MACHINE_VERIFIED')
    .flatMap((v) => (v.records.length ? v.records : [{ ref: '-', words: 0, missingOnPagePdfjs: [], popplerAgreementPct: 0, flags: [], ok: false }]).map((rc) => ({ ...rc, exam: v.exam, code: v.code, paperVerdict: v.verdict })));
  const cols = ['exam', 'code', 'paperVerdict', 'ref', 'ok', 'words', 'popplerAgreementPct', 'flags', 'missingOnPagePdfjs'] as const;
  writeFileSync(
    join(paths.out, 'review-queue.csv'),
    [cols.join(','), ...queue.map((q) => cols.map((c) => `"${String(Array.isArray(q[c]) ? (q[c] as string[]).join(' ') : q[c]).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n',
  );
  return results;
}

export function printVerification(results: PaperVerification[]) {
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const rs = results.filter((r) => r.exam === exam);
    const by = (v: PaperVerdict) => rs.filter((r) => r.verdict === v);
    console.log(`\n${exam}: ${rs.length} papers | MACHINE_VERIFIED ${by('MACHINE_VERIFIED').length} | NEEDS_REVIEW ${by('NEEDS_REVIEW').length} | BLOCKED ${by('BLOCKED').length}`);
    console.log(`  rows in verified papers: ${by('MACHINE_VERIFIED').reduce((s, r) => s + r.metrics.rows, 0)} | rows awaiting review: ${by('NEEDS_REVIEW').reduce((s, r) => s + r.metrics.rows, 0)}`);
    const reasonCount = new Map<string, number>();
    for (const r of by('NEEDS_REVIEW')) for (const why of r.reasons) reasonCount.set(why.replace(/\d+/g, 'N').slice(0, 70), (reasonCount.get(why.replace(/\d+/g, 'N').slice(0, 70)) ?? 0) + 1);
    for (const [why, n] of [...reasonCount].sort((x, y) => y[1] - x[1]).slice(0, 10)) console.log(`   ${n} x ${why}`);
  }
}
