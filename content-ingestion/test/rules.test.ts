import { describe, expect, it } from 'vitest';
import { sequenceGaps, validateResult } from '../src/extract';
import { alignedRows, columnSplit, isTableRow } from '../src/layout';
import { legacyFontPages, ocrLanguagesFor, pagesNeedingOcr } from '../src/ocr';
import type { PdfContent, TextLine } from '../src/pdf';
import { buildTree } from '../src/structure';
import type { ExtractedNode, ExtractionResult, SourceLine } from '../src/types';

const line = (text: string, page = 1, extra: Partial<SourceLine> = {}): SourceLine => ({ page, y: 0, x: 0, text, ...extra });

function pdfStub(pages: { chars: number; images?: { coverage: number; sha?: string }[]; pathOps?: number }[]): PdfContent {
  return {
    pageCount: pages.length,
    pageSizes: pages.map(() => ({ width: 595, height: 842 })),
    lines: [],
    streamLines: [],
    textCharsPerPage: pages.map((p) => p.chars),
    pathOpsPerPage: pages.map((p) => p.pathOps ?? 0),
    images: pages.flatMap((p, i) =>
      (p.images ?? []).map((im, k) => ({ page: i + 1, name: `im${k}`, width: 800, height: 800, pageCoverage: im.coverage, y: 0, png: Buffer.alloc(0), sha256: im.sha ?? `sha-${i}-${k}` })),
    ),
  };
}

describe('pagesNeedingOcr', () => {
  it('does not treat a title page with a short header as scanned (the original bug)', () => {
    expect(pagesNeedingOcr(pdfStub([{ chars: 44, images: [{ coverage: 0.22 }] }, { chars: 1800 }]))).toEqual([]);
  });
  it('ignores a background image repeated on every page', () => {
    const bg = { coverage: 0.53, sha: 'background' };
    expect(pagesNeedingOcr(pdfStub([{ chars: 67, images: [bg] }, { chars: 900, images: [bg] }]))).toEqual([]);
  });
  it('OCRs a page whose body is one large scan', () => {
    expect(pagesNeedingOcr(pdfStub([{ chars: 45 }, { chars: 196, images: [{ coverage: 0.5 }] }]))).toEqual([2]);
  });
  it('OCRs a page whose text is drawn as vector outlines', () => {
    expect(pagesNeedingOcr(pdfStub([{ chars: 0, pathOps: 659 }, { chars: 0, pathOps: 12 }]))).toEqual([1]);
  });
});

describe('legacyFontPages', () => {
  const withText = (page: number, text: string): TextLine => ({ page, y: 0, x: 0, text, fontSize: 11, runs: [{ x: 0, width: 100, text }] });
  it('detects Kruti Dev text (Latin letters standing in for Devanagari)', () => {
    const pdf = pdfStub([{ chars: 300 }, { chars: 300 }]);
    pdf.lines = [
      withText(1, 'Unit 1 - Electric charges and fields, conservation of charge, Coulomb law'),
      ...['osnkUr n’kZu dk bfrgkl', 'osnkUrlkj', 'osnkUrifjHkk"kk', 'czãlw=’kkadjHkk";e', 'mifu"kPNkadjHkk";e~', 'Jhen~Hkxon~xhrkHkk";e~'].map((t) => withText(2, t)),
    ];
    expect(legacyFontPages(pdf)).toEqual([2]);
  });
});

describe('table alignment', () => {
  it('needs cells to start at the same x on every row', () => {
    expect(alignedRows([{ x: 50 }, { x: 200 }, { x: 350 }], [{ x: 52 }, { x: 198 }, { x: 355 }])).toBe(true);
    expect(alignedRows([{ x: 50 }, { x: 200 }, { x: 350 }], [{ x: 50 }, { x: 120 }, { x: 290 }])).toBe(false);
  });
});

describe('ocrLanguagesFor', () => {
  it('uses the paper language plus English', () => {
    expect(ocrLanguagesFor({ code: 'LAQP23', name: 'Malayalam', categoryCode: 'LAQP' }).langs).toEqual(['mal', 'eng']);
    expect(ocrLanguagesFor({ code: 'LAQP36', name: 'Telugu', categoryCode: 'LAQP' }).langs).toEqual(['tel', 'eng']);
  });
  it('flags Kashmiri as a script without a model', () => {
    expect(ocrLanguagesFor({ code: 'LAQP17', name: 'Kashmiri', categoryCode: 'LAQP' }).unsupportedScript).toMatch(/Kashmiri/);
  });
});

describe('layout', () => {
  const tl = (y: number, runs: [number, number, string][]): TextLine => ({ page: 1, y, x: runs[0]![0], text: runs.map((r) => r[2]).join(' '), fontSize: 11, runs: runs.map(([x, width, text]) => ({ x, width, text })) });
  it('finds the right-column edge on a two-column page', () => {
    const lines = Array.from({ length: 10 }, (_, i) => tl(100 + i * 14, [[118, 120 + (i % 3) * 20, 'left text'], [304, 100, 'right text']]));
    expect(columnSplit(lines, 597)).toBe(302);
  });
  it('does not mistake integral formulas for a table', () => {
    expect(isTableRow(['∫', ', ∫', ', ∫'])).toBe(false);
    expect(isTableRow(['Unit', 'Topic', 'Marks'])).toBe(true);
  });
});

describe('buildTree', () => {
  it('keeps introductory text word for word instead of dropping it', () => {
    const { nodes } = buildTree(
      [line('Questions from the Language Section will be from the following topics but are not limited to:'), line('1. Reading Comprehension:'), line('a. Factual')],
      '101',
      'English',
    );
    expect(nodes[0]).toMatchObject({ kind: 'NOTE', title: expect.stringContaining('Questions from the Language Section') });
    expect(nodes[1]).toMatchObject({ kind: 'TOPIC', label: '1', parentRef: null });
    expect(nodes[2]).toMatchObject({ kind: 'SUBTOPIC', label: 'a', parentRef: nodes[1]!.ref });
  });
  it('recognises units and numbered topics in Indian scripts', () => {
    const { nodes } = buildTree([line('इकाई 1: भारतीय ज्योतिष'), line('१. परिचय'), line('༡༽ ཆོས་')], 'ACQP99', 'Test');
    expect(nodes.map((n) => n.kind)).toEqual(['UNIT', 'TOPIC', 'TOPIC']);
  });
  it('gives a bare "Section A1" its own label when the next line is a heading', () => {
    const { nodes } = buildTree([line('Section A1'), line('1. Algebra'), line('(i) Matrices')], '319', 'Mathematics');
    expect(nodes[0]).toMatchObject({ kind: 'SECTION', title: 'Section A1' });
    expect(nodes[1]).toMatchObject({ kind: 'TOPIC', title: 'Algebra', parentRef: nodes[0]!.ref });
  });
  it('closes the NTA Note box when the syllabus starts (units are not nested under the Note)', () => {
    const { nodes } = buildTree([line('Note:'), line('i. The Question Paper will have 75 questions.'), line('Unit 1: Solutions')], 'SCQP08', 'Chemistry');
    expect(nodes.map((n) => [n.kind, n.depth])).toEqual([['NOTE', 1], ['ITEM', 2], ['UNIT', 1]]);
  });
  it('reads lowercase "unit:1", Gujarati letter items and Hindi topics numbered without a full stop', () => {
    const { nodes } = buildTree([line('unit:1 ગુજરાતી સાહિત્યનો ઇતિહાસ'), line('(અ) મધ્યકાલીન ગુજરાતી સાહિત્ય'), line('2 हिंदी साहित्य का इतिहास')], 'LAQP13', 'Gujarati');
    expect(nodes.map((n) => [n.kind, n.label])).toEqual([['UNIT', '1'], ['SUBTOPIC', 'અ'], ['TOPIC', '2']]);
  });
  it('drops repeated page headers but keeps page numbers on rows', () => {
    const { nodes } = buildTree([line('Chemistry (SCQP08)', 1), line('Unit 1: Solutions', 1), line('Chemistry (SCQP08)', 2), line('Unit 2: Kinetics', 2)], 'SCQP08', 'Chemistry');
    expect(nodes.map((n) => [n.title, n.sourcePage])).toEqual([['Solutions', 1], ['Kinetics', 2]]);
  });
});

describe('sequenceGaps', () => {
  const node = (label: string, kind: ExtractedNode['kind'] = 'ITEM', parentRef: string | null = 'p'): ExtractedNode => ({ ref: label, parentRef, kind, label, title: label, body: null, position: 0, depth: 2, sourcePage: 1, flags: [] });
  it('reports a missing Roman numeral', () => {
    expect(sequenceGaps([node('i'), node('ii'), node('iv')])).toHaveLength(1);
  });
  it('does not read the letter C as the Roman numeral 100', () => {
    expect(sequenceGaps([node('A', 'SECTION', null), node('B', 'SECTION', null), node('C', 'SECTION', null)])).toEqual([]);
  });
});

describe('validateResult', () => {
  const base = (nodes: ExtractedNode[], issues: string[] = []): ExtractionResult => ({
    paper: { exam: 'CUET_PG', year: 2026, code: 'X', name: 'X', categoryCode: 'LAQP', officialSyllabusUrl: 'https://x', listedOnUrl: 'https://x' },
    status: 'EXTRACTED', reason: null,
    source: { url: 'https://x', listedOnUrl: 'https://x', title: 'x', retrievedAt: '2026-01-01T00:00:00Z', sha256: 'a'.repeat(64), byteSize: 1, pageCount: 2, localFile: 'x' },
    method: 'text_layer', nodes, tables: [], figures: [], documentFlags: [], issues, ocrPages: [], reviewImages: [],
    quality: { lines: 1, unparsedLines: 0, ocrLines: 0, ocrLowConfidenceLines: 0, meanOcrConfidence: null },
  });
  const n = (ref: string, parentRef: string | null, depth: number, sourcePage = 1): ExtractedNode => ({ ref, parentRef, kind: 'TOPIC', label: null, title: ref, body: null, position: 0, depth, sourcePage, flags: [] });
  it('accepts a consistent tree', () => expect(validateResult(base([n('a', null, 1), n('b', 'a', 2)]))).toEqual([]));
  it('rejects a broken parent link, wrong depth and an out-of-range page', () => {
    expect(validateResult(base([n('a', null, 1), n('b', 'zz', 2), n('c', 'a', 3), n('d', null, 1, 9)])).length).toBe(3);
  });
  it('blocks a script with no OCR model instead of importing guesses', () => {
    expect(validateResult(base([n('a', null, 1)], ['UNSUPPORTED_SCRIPT: Kashmiri'])).some((p) => p.startsWith('BLOCK:'))).toBe(true);
  });
});
