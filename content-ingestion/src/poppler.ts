/**
 * Second text extractor: Poppler's pdftotext. pdf.js returns some Devanagari fonts in visual order
 * ("किव" for "कवि", "िवभ" for "विभ"); pdftotext reads the same fonts in correct logical order.
 * Pages where pdf.js shows that corruption are taken from pdftotext instead. pdftotext is optional:
 * without it, such pages fall back to local OCR.
 */
import { spawnSync } from 'node:child_process';
import type { PdfContent } from './pdf';
import type { SourceLine } from './types';

/** A Devanagari vowel sign i (ि) at the start of a word cannot occur in correctly ordered text. */
const ORPHAN_I = /(?:^|[\s(,;:.\-–"'])ि/g;
const DEVANAGARI_WORD = /[ऀ-ॿ]{2,}/g;

let available: boolean | null = null;
/** Some pdftotext builds exit with code 99 for -v, so check the version text, not the exit code. */
export function popplerAvailable(): boolean {
  if (available === null) {
    const res = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' });
    available = !res.error && /pdftotext version/i.test(`${res.stdout}${res.stderr}`);
  }
  return available;
}

export function popplerPageText(file: string, page: number): string | null {
  const res = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 20_000_000 });
  return res.status === 0 ? res.stdout : null;
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

function agreement(a: string, b: string): number {
  const wa = a.match(DEVANAGARI_WORD) ?? [];
  const wb = new Map<string, number>();
  for (const w of b.match(DEVANAGARI_WORD) ?? []) wb.set(w, (wb.get(w) ?? 0) + 1);
  if (!wa.length) return 100;
  let hit = 0;
  for (const w of wa) {
    const c = wb.get(w) ?? 0;
    if (c > 0) {
      hit++;
      wb.set(w, c - 1);
    }
  }
  return (100 * hit) / wa.length;
}

export interface PopplerDecision {
  page: number;
  devanagariWords: number;
  orphanSignsPdfjs: number;
  orphanSignsPoppler: number | null;
  devanagariAgreementPct: number | null;
  /** pdfjs = keep the text layer (with a review flag for the few broken words). */
  useTextFrom: 'pdfjs' | 'poppler' | 'ocr';
}

/** Above this share of broken words a page's text is not trusted. */
const BROKEN_SHARE = 0.02;

/**
 * Pages whose Devanagari text from pdf.js is in visual order. For each, choose the best source:
 * pdf.js if only an isolated word is affected; pdftotext if it is clean where pdf.js is not; OCR if both are broken.
 */
export function pagesWithBrokenDevanagari(pdf: PdfContent, file: string, skip: number[]): PopplerDecision[] {
  const out: PopplerDecision[] = [];
  for (let page = 1; page <= pdf.pageCount; page++) {
    if (skip.includes(page)) continue;
    const js = pdf.lines.filter((l) => l.page === page).map((l) => l.text).join('\n');
    const words = count(js, DEVANAGARI_WORD);
    if (words < 3) continue;
    const orphanJs = count(js, ORPHAN_I);
    const pop = popplerAvailable() ? popplerPageText(file, page) : null;
    const agree = pop === null ? null : agreement(js, pop);
    if (orphanJs === 0 && (agree === null || agree >= 97)) continue;
    const orphanPop = pop === null ? null : count(pop, ORPHAN_I);
    let useTextFrom: PopplerDecision['useTextFrom'];
    if (orphanJs / words <= BROKEN_SHARE && (agree === null || agree >= 90)) useTextFrom = 'pdfjs';
    else if (orphanPop !== null && orphanPop < orphanJs && orphanPop / words <= BROKEN_SHARE) useTextFrom = 'poppler';
    else useTextFrom = 'ocr';
    out.push({
      page, devanagariWords: words, orphanSignsPdfjs: orphanJs, orphanSignsPoppler: orphanPop,
      devanagariAgreementPct: agree === null ? null : Math.round(agree * 10) / 10, useTextFrom,
    });
  }
  return out;
}

export function popplerLines(file: string, page: number): SourceLine[] {
  const text = popplerPageText(file, page) ?? '';
  return text
    .split('\n')
    .map((t, i) => ({ page, y: i * 12, x: t.length - t.trimStart().length, text: t.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text);
}
