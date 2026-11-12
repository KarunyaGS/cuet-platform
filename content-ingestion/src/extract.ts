/**
 * EXTRACT -> NORMALISE -> VALIDATE for one official syllabus PDF.
 * - Text pages: pdf.js text layer with layout handling (two columns, tables) and embedded figures.
 * - Scanned pages only: local OCR (Tesseract) with per-line confidence and a saved page image for review.
 * Original wording is kept. Every node carries the page it starts on and the page its text ends on.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { downloadPdf } from './download';
import { arrangePages } from './layout';
import { legacyFontPages, ocrImagePngs, ocrPages, pagesNeedingOcr, type ImageText } from './ocr';
import { pagesWithBrokenDevanagari, popplerLines } from './poppler';
import { readPdf, type PageImage } from './pdf';
import { ANCHOR_PREFIX, buildTree, isNoise } from './structure';
import type { ExtractedFigure, ExtractedNode, ExtractionResult, OfficialPaper, SourceLine } from './types';

export interface ExtractOptions {
  cacheDir: string; // storage/cache
  figuresDir: string; // storage/local/figures
  reviewDir: string; // storage/local/review-pages
  refresh?: boolean;
  /** Pages the independent visual check found the text layer wrong on (words missing): read them by OCR instead. */
  forceOcrPages?: number[];
}

const MIN_FIGURE_SIDE = 80;
/** Private-use and replacement characters: symbols the PDF font did not map to Unicode. */
const LOST_SYMBOL = /[-�]/;
const BULLET_PUA = /^[]/;
/** Mathematical alphanumerics, operators and integral/summation signs. */
const FORMULA = /[\u{1D400}-\u{1D7FF}∀-⋿∫∑√]/u;

export async function extractPaper(paper: OfficialPaper, opts: ExtractOptions): Promise<ExtractionResult> {
  const empty = {
    paper, source: null, method: null, nodes: [], tables: [], figures: [], documentFlags: [], issues: [], ocrPages: [], reviewImages: [],
    quality: { lines: 0, unparsedLines: 0, ocrLines: 0, ocrLowConfidenceLines: 0, meanOcrConfidence: null },
  } satisfies Omit<ExtractionResult, 'status' | 'reason'>;
  let dl;
  try {
    dl = await downloadPdf(paper.officialSyllabusUrl, join(opts.cacheDir, 'pdf', paper.exam, `${paper.code}.pdf`), opts.refresh);
  } catch (e) {
    return { ...empty, status: 'FAILED', reason: `Download failed: ${(e as Error).message}` };
  }
  const exam = paper.exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG';
  const pdf = await readPdf(dl.data, { images: true });
  const source = {
    url: paper.officialSyllabusUrl, listedOnUrl: paper.listedOnUrl, title: `${exam} ${paper.year} syllabus: ${paper.name} (${paper.code})`,
    retrievedAt: dl.retrievedAt, sha256: dl.sha256, byteSize: dl.data.byteLength, pageCount: pdf.pageCount, localFile: dl.localFile,
  };
  const documentFlags: string[] = [];
  const issues: string[] = [];

  // 1. Which pages are scanned, or typed in a legacy font? Which pages have Devanagari that pdf.js puts in
  //    visual order? Everything else keeps its own pdf.js text layer.
  const legacy = legacyFontPages(pdf);
  const imageOrLegacy = [...new Set([...pagesNeedingOcr(pdf), ...legacy])];
  const devanagari = pagesWithBrokenDevanagari(pdf, dl.localFile, imageOrLegacy);
  const popplerPages = devanagari.filter((d) => d.useTextFrom === 'poppler').map((d) => d.page);
  const forced = (opts.forceOcrPages ?? []).filter((p) => p >= 1 && p <= pdf.pageCount);
  const scanned = [...new Set([...imageOrLegacy, ...devanagari.filter((d) => d.useTextFrom === 'ocr').map((d) => d.page), ...forced])].sort((a, b) => a - b);
  if (forced.length) documentFlags.push(`visual_check_pages_read_by_ocr(${forced.join(',')})`);
  if (legacy.length) documentFlags.push(`legacy_font_pages_read_by_ocr(${legacy.join(',')})`);
  if (devanagari.length)
    documentFlags.push(`devanagari_visual_order_in_pdfjs(${devanagari.map((d) => `p${d.page}:${d.orphanSignsPdfjs}/${d.devanagariWords}->${d.useTextFrom}`).join(',')})`);
  for (const d of devanagari.filter((x) => x.useTextFrom === 'pdfjs'))
    issues.push(`DEVANAGARI_ORDER: page ${d.page} has ${d.orphanSignsPdfjs} word(s) with the vowel sign ि misplaced; text kept, check those words against the PDF`);
  const textLines = pdf.lines.filter((l) => !scanned.includes(l.page) && !popplerPages.includes(l.page));
  const arranged = arrangePages(textLines, pdf.streamLines.filter((l) => !scanned.includes(l.page) && !popplerPages.includes(l.page)), pdf.pageSizes.map((s) => s.width));
  if (arranged.twoColumnPages.length) documentFlags.push(`two_column_pages_reordered(${arranged.twoColumnPages.join(',')})`);
  // Table anchors are positions in the pdf.js lines, so insert them before merging other sources in.
  const pdfjsLines: SourceLine[] = [...arranged.lines];
  const tablesRaw = arranged.tables;
  for (let k = tablesRaw.length - 1; k >= 0; k--) {
    const t = tablesRaw[k]!;
    pdfjsLines.splice(t.afterLineIndex + 1, 0, { page: t.page, y: 0, x: 0, text: `${ANCHOR_PREFIX}table:${k}` });
  }
  // Stable sort by page keeps each page's own line order.
  let lines: SourceLine[] = [...pdfjsLines, ...popplerPages.flatMap((p) => popplerLines(dl.localFile, p))].sort((a, b) => a.page - b.page);

  // 2. OCR only the scanned pages, then merge them back in page order.
  let ocrStats = { lines: 0, low: 0, mean: null as number | null };
  const reviewImages: string[] = [];
  const ocrText: NonNullable<ExtractionResult['ocrText']> = [];
  if (scanned.length) {
    let ocr;
    try {
      ocr = await ocrPages(dl.data, scanned, paper, { cache: join(opts.cacheDir, 'tessdata'), review: opts.reviewDir });
    } catch (e) {
      return { ...empty, source, status: 'BLOCKED', reason: `OCR failed on pages ${scanned.join(',')}: ${(e as Error).message}`, ocrPages: scanned };
    }
    documentFlags.push(`ocr_pages(${scanned.join(',')})`, `ocr_languages(${ocr.langs.join('+')})`, `ocr_language_basis(${ocr.basis})`);
    if (ocr.unsupportedScript) issues.push(`UNSUPPORTED_SCRIPT: ${ocr.unsupportedScript}. OCR text must be transcribed by a person from the page images.`);
    const ocrLines = ocr.pages.flatMap((p) => p.lines);
    reviewImages.push(...ocr.pages.map((p) => p.reviewImage));
    for (const p of ocr.pages) ocrText.push({ page: p.page, meanConfidence: Math.round(p.meanConfidence * 10) / 10, text: p.lines.map((l) => l.text).join('\n') });
    const confs = ocrLines.map((l) => l.ocrConfidence ?? 0);
    ocrStats = { lines: ocrLines.length, low: confs.filter((c) => c < 75).length, mean: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null };
    lines = [...lines, ...ocrLines].sort((a, b) => a.page - b.page || 0);
    // keep the original order within each page (stable sort above preserves it)
    for (const p of ocr.pages) if (p.lines.length === 0) issues.push(`OCR_EMPTY_PAGE: page ${p.page} produced no text`);
    if (ocrStats.low) issues.push(`OCR_LOW_CONFIDENCE: ${ocrStats.low} of ${ocrStats.lines} OCR lines below 75% confidence`);
    documentFlags.push('figures_on_scanned_pages_not_separated');
  }
  const pagesWithText = pdf.textCharsPerPage.map((c, i) => (c > 0 || scanned.includes(i + 1) ? i + 1 : 0)).filter(Boolean);
  const noTextPages = pdf.textCharsPerPage.map((c, i) => (c === 0 && !scanned.includes(i + 1) ? i + 1 : 0)).filter(Boolean);
  if (noTextPages.length) documentFlags.push(`pages_without_text(${noTextPages.join(',')})`);

  // 3. Figures from text pages: big enough, not a background repeated across pages, and on a page that
  //    carries syllabus text (cover-page banners and logos are decoration, not syllabus figures).
  const pagesBySha = new Map<string, Set<number>>();
  for (const im of pdf.images) (pagesBySha.get(im.sha256) ?? pagesBySha.set(im.sha256, new Set()).get(im.sha256)!).add(im.page);
  // Backgrounds are sometimes re-encoded per page (different bytes, same size): group by size as well.
  for (const im of pdf.images) {
    if (im.pageCoverage < 0.3) continue;
    const key = `size:${im.width}x${im.height}`;
    (pagesBySha.get(key) ?? pagesBySha.set(key, new Set()).get(key)!).add(im.page);
  }
  const repeated = (im: PageImage) => (pagesBySha.get(im.sha256)?.size ?? 0) >= 2 || (im.pageCoverage >= 0.3 && (pagesBySha.get(`size:${im.width}x${im.height}`)?.size ?? 0) >= 2);
  const STRUCTURAL = new Set(['PART', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM']);
  const isStructural = (n: ExtractedNode) => STRUCTURAL.has(n.kind) || (n.kind === 'SECTION' && !n.flags.includes('heading_inferred_from_formatting'));
  // Title page: page 1 of a multi-page document whose own text has no syllabus headings (cover banners, logos).
  const page1 = buildTree(lines.filter((l) => l.page === 1 && !l.text.startsWith(ANCHOR_PREFIX)), paper.code, paper.name);
  const titlePage = pdf.pageCount > 1 && !page1.nodes.some(isStructural) ? 1 : null;
  const contentImages: PageImage[] = pdf.images.filter(
    (im) => !scanned.includes(im.page) && im.page !== titlePage && !repeated(im) &&
      Math.min(im.width, im.height) >= MIN_FIGURE_SIDE && im.pageCoverage >= 0.005 && im.pageCoverage < 0.9,
  );
  const decorative = pdf.images.filter((im) => !contentImages.includes(im) && !scanned.includes(im.page)).length;
  if (decorative) documentFlags.push(`decorative_images_skipped(${decorative})`);

  // Every content image is read by OCR: syllabus text pasted in as a picture becomes syllabus lines;
  // images with (almost) no text stay figures; text that cannot be read blocks the paper for a person.
  const figureCandidates: PageImage[] = [];
  const textImages: { im: PageImage; text: ImageText }[] = [];
  if (contentImages.length) {
    const read = await ocrImagePngs(contentImages.map((im, i) => ({ key: String(i), png: im.png })), paper, join(opts.cacheDir, 'tessdata'));
    contentImages.forEach((im, i) => {
      const t = read.results.get(String(i));
      if (t && t.words >= 5 && t.meanConfidence >= 55 && !read.unsupportedScript) textImages.push({ im, text: t });
      else {
        // Text-like but unreadable, or any substantial image in a paper whose script has no OCR model.
        const substantial = im.width >= 200 && im.height >= 100;
        if ((t && t.words >= 5) || (read.unsupportedScript && substantial)) {
          const file = join(opts.reviewDir, `${paper.code}-page${im.page}-image${i + 1}.png`);
          mkdirSync(opts.reviewDir, { recursive: true });
          writeFileSync(file, im.png);
          reviewImages.push(file);
          issues.push(
            `CONTENT_IMAGE_UNREADABLE: page ${im.page} has an image that may hold syllabus text OCR cannot read (${t?.words ?? 0} words, mean confidence ${Math.round(t?.meanConfidence ?? 0)}%, models ${read.langs.join('+')}${read.unsupportedScript ? `; ${read.unsupportedScript}` : ''}). Needs human transcription from ${file}`,
          );
        }
        figureCandidates.push(im);
      }
    });
    if (textImages.length) documentFlags.push(`text_images_read_by_ocr(${textImages.map((t) => `p${t.im.page}`).join(',')})`);
  }
  // Insert text-image lines where each image sits (last image first, so earlier positions stay valid).
  for (const { im, text } of [...textImages].sort((a, b) => b.im.page - a.im.page || b.im.y - a.im.y)) {
    let at = -1;
    lines.forEach((l, idx) => {
      if (!l.text.startsWith(ANCHOR_PREFIX) && (l.page < im.page || (l.page === im.page && l.y <= im.y))) at = idx;
    });
    lines.splice(at + 1, 0, ...text.lines.map((l, j) => ({ page: im.page, y: im.y + j * 0.01, x: 0, text: l.text, ocrConfidence: l.confidence })));
    ocrText.push({ page: im.page, meanConfidence: Math.round(text.meanConfidence * 10) / 10, text: text.lines.map((l) => l.text).join('\n') });
  }
  for (let k = figureCandidates.length - 1; k >= 0; k--) {
    const f = figureCandidates[k]!;
    let at = -1;
    lines.forEach((l, idx) => {
      if (!l.text.startsWith(ANCHOR_PREFIX) && (l.page < f.page || (l.page === f.page && l.y <= f.y))) at = idx;
    });
    lines.splice(at + 1, 0, { page: f.page, y: f.y, x: 0, text: `${ANCHOR_PREFIX}figure:${k}` });
  }

  // 4. Structure.
  const tree = buildTree(lines, paper.code, paper.name);
  const tables = tablesRaw.map((t, k) => ({ nodeRef: tree.anchors.get(`table:${k}`) ?? null, page: t.page, rows: t.rows }));
  mkdirSync(opts.figuresDir, { recursive: true });
  // A syllabus figure sits on a page with real syllabus headings, not on a title page with only the paper name.
  const syllabusPages = new Set(
    tree.nodes
      .filter(isStructural)
      .flatMap((n) => Array.from({ length: (n.endPage ?? n.sourcePage ?? 0) - (n.sourcePage ?? 0) + 1 }, (_, i) => (n.sourcePage ?? 0) + i)),
  );
  const titlePageImages = figureCandidates.filter((f) => !syllabusPages.has(f.page)).length;
  if (titlePageImages) documentFlags.push(`title_page_images_skipped(${titlePageImages})`);
  const figures: ExtractedFigure[] = figureCandidates.flatMap((f, k) => {
    if (!syllabusPages.has(f.page)) return [];
    const localFile = join(opts.figuresDir, `${f.sha256}.png`);
    if (!existsSync(localFile)) writeFileSync(localFile, f.png);
    return [{ nodeRef: tree.anchors.get(`figure:${k}`) ?? null, page: f.page, sha256: f.sha256, width: f.width, height: f.height, localFile, byteSize: f.png.byteLength }];
  });

  // 5. Review checks.
  issues.push(...sequenceGaps(tree.nodes));
  for (const f of figures) issues.push(`FIGURE_REVIEW: page ${f.page} image ${f.width}x${f.height} kept as a figure (OCR found no readable text); confirm it is a diagram, not text`);
  // Structure swallowed into running text: a body that contains its own "Unit 4", "Chapter 2", "Module 3".
  const swallowed = tree.nodes.filter((n) => /(?:^|\s)(?:Unit|UNIT|unit|Chapter|CHAPTER|Module|MODULE|इकाई|অধ্যায়)\s*[-:–.]?\s*(?:\d+|[IVX]+)\b/u.test(n.body ?? ''));
  for (const n of swallowed) n.flags.push('heading_found_inside_body');
  if (swallowed.length) issues.push(`HEADING_IN_BODY: ${swallowed.length} row(s) contain what looks like a unit/chapter heading inside their text; the hierarchy there needs review (pages ${[...new Set(swallowed.map((n) => n.sourcePage))].join(',')})`);
  const lost = tree.nodes.filter((n) => LOST_SYMBOL.test((n.title + ' ' + (n.body ?? '')).replace(BULLET_PUA, '')));
  for (const n of lost) n.flags.push('symbols_lost_in_pdf_text');
  if (lost.length) issues.push(`SYMBOLS_LOST: ${lost.length} row(s) contain characters the PDF font did not map (often formulas): ${lost.map((n) => `p${n.sourcePage}`).join(',')}`);
  const formulaRows = tree.nodes.filter((n) => FORMULA.test(n.title + ' ' + (n.body ?? '')));
  for (const n of formulaRows) n.flags.push('formula_text_check_layout');
  if (formulaRows.length) issues.push(`FORMULAS: ${formulaRows.length} row(s) contain mathematical notation; symbols kept as Unicode, but fractions/superscript layout must be checked against the PDF`);
  const covered = new Set<number>();
  for (const n of tree.nodes) for (let p = n.sourcePage ?? 0; p <= (n.endPage ?? n.sourcePage ?? 0); p++) covered.add(p);
  const pagesWithoutRows = pagesWithText.filter((p) => !covered.has(p) && p !== 1);
  if (pagesWithoutRows.length) issues.push(`PAGES_WITHOUT_ROWS: ${pagesWithoutRows.join(',')}`);

  const result: ExtractionResult = {
    paper, status: 'EXTRACTED', reason: null, source, method: scanned.length === 0 ? 'text_layer' : scanned.length === pdf.pageCount ? 'ocr' : 'text_layer+ocr',
    nodes: tree.nodes, tables, figures, documentFlags, issues, ocrPages: scanned, popplerPages, reviewImages, ocrText,
    quality: {
      lines: lines.filter((l) => !l.text.startsWith(ANCHOR_PREFIX)).length,
      unparsedLines: tree.unparsedLines,
      ocrLines: ocrStats.lines,
      ocrLowConfidenceLines: ocrStats.low,
      meanOcrConfidence: ocrStats.mean === null ? null : Math.round(ocrStats.mean * 10) / 10,
    },
  };
  const problems = validateResult(result);
  if (problems.length) return { ...result, status: problems.some((p) => p.startsWith('BLOCK:')) ? 'BLOCKED' : 'FAILED', reason: problems.join('; ') };
  return result;
}

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function labelNumber(label: string | null): number | null {
  if (!label) return null;
  const l = label.trim();
  if (/^\d+$/.test(l)) return Number(l);
  if (/^[ivxlc]+$/i.test(l)) {
    const s = l.toLowerCase();
    let total = 0;
    for (let i = 0; i < s.length; i++) {
      const v = ROMAN_VALUES[s[i]!]!;
      const next = ROMAN_VALUES[s[i + 1] ?? ''] ?? 0;
      total += v < next ? -v : v;
    }
    return total;
  }
  if (/^[a-z]$/i.test(l)) return l.toLowerCase().charCodeAt(0) - 96;
  return null;
}

/** Numbered siblings should count up by one: "(i), (ii), (iv)" means "(iii)" went missing. */
export function sequenceGaps(nodes: ExtractedNode[]): string[] {
  const issues: string[] = [];
  const groups = new Map<string, ExtractedNode[]>();
  for (const n of nodes) {
    if (!n.label || !/^(\d+|[ivxlc]+|[a-z])$/i.test(n.label.trim())) continue;
    const key = `${n.parentRef ?? 'root'}|${n.kind}|${/^\d+$/.test(n.label) ? 'num' : 'letters'}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(n);
  }
  for (const [key, all] of groups) {
    // Letters: Roman numerals if any sibling is a multi-letter numeral (ii, iv, ...), otherwise a, b, c.
    // In a mixed list such as (b), (c), (iii), only the numerals are compared with each other.
    const roman = key.endsWith('letters') && all.some((n) => /^[ivxlc]{2,}$/i.test(n.label!.trim()));
    const list = roman ? all.filter((n) => /^[ivxlc]+$/i.test(n.label!.trim()) && (n.label!.trim().length > 1 || /^[ivx]$/i.test(n.label!.trim()))) : all;
    const value = (label: string) => {
      const l = label.trim();
      if (/^\d+$/.test(l)) return Number(l);
      return roman ? labelNumber(l)! : l.toLowerCase().charCodeAt(0) - 96;
    };
    if (list.length >= 2 && value(list[0]!.label!) > 1 && !key.endsWith('letters'))
      issues.push(`SEQUENCE_START: ${list[0]!.kind} numbering starts at "${list[0]!.label}" on page ${list[0]!.sourcePage} (item 1 may be missing or misread)`);
    for (let i = 1; i < list.length; i++) {
      const prev = value(list[i - 1]!.label!);
      const cur = value(list[i]!.label!);
      if (cur > prev && cur !== prev + 1) issues.push(`SEQUENCE_GAP: ${list[i]!.kind} "${list[i - 1]!.label}" is followed by "${list[i]!.label}" on page ${list[i]!.sourcePage}`);
    }
  }
  return issues;
}

/** Hard checks before anything may be imported. Returns a list of problems (empty = valid). */
export function validateResult(r: ExtractionResult): string[] {
  const problems: string[] = [];
  if (!r.source) problems.push('No source document');
  if (r.nodes.length === 0) problems.push('BLOCK: no syllabus headings or items could be identified');
  const refs = new Map<string, number>();
  for (const n of r.nodes) {
    if (refs.has(n.ref)) problems.push(`duplicate ref ${n.ref}`);
    if (n.parentRef) {
      const d = refs.get(n.parentRef);
      if (d === undefined) problems.push(`${n.ref}: parent ${n.parentRef} missing or later`);
      else if (n.depth !== d + 1) problems.push(`${n.ref}: depth ${n.depth} does not follow parent depth ${d}`);
    } else if (n.depth !== 1) problems.push(`${n.ref}: top-level node must have depth 1`);
    if (!n.title.trim()) problems.push(`${n.ref}: empty title`);
    if (n.title.length > 1000 || (n.body?.length ?? 0) > 20000) problems.push(`${n.ref}: text longer than the import limit`);
    if (r.source && n.sourcePage !== null && (n.sourcePage < 1 || n.sourcePage > r.source.pageCount)) problems.push(`${n.ref}: page out of range`);
    refs.set(n.ref, n.depth);
  }
  if (r.quality.ocrLines > 0 && (r.quality.meanOcrConfidence ?? 0) < 40) {
    problems.push(`BLOCK: OCR confidence too low to use (mean ${r.quality.meanOcrConfidence}%); needs human transcription from the page images`);
  }
  if (r.issues.some((i) => i.startsWith('UNSUPPORTED_SCRIPT'))) {
    problems.push('BLOCK: script has no OCR model; needs human transcription from the page images');
  }
  if (r.issues.some((i) => i.startsWith('CONTENT_IMAGE_UNREADABLE'))) {
    problems.push('BLOCK: part of the syllabus is text inside an image that OCR cannot read; needs human transcription');
  }
  return problems;
}
