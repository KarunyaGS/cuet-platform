/**
 * Local OCR for scanned syllabus pages: pdf.js renders a page (via @napi-rs/canvas) and Tesseract
 * (tesseract.js, WebAssembly, running locally) reads it. No external AI service is called; Tesseract's
 * language data files are downloaded once and cached under storage/cache/tessdata.
 *
 * Only pages that are really scanned are OCR'd (see `pagesNeedingOcr`); every other page keeps its
 * original text layer. Each OCR'd page is also saved as a PNG so a person can check the text against it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import type { PdfContent } from './pdf';
import type { SourceLine } from './types';

export interface OcrLanguageChoice {
  langs: string[];
  unsupportedScript?: string;
  basis: string;
}

/**
 * Overrides decided by looking at the rendered pages (evidence noted beside each).
 * `unsupportedScript` marks text for which no Tesseract model exists: that OCR output is not trusted.
 */
const OVERRIDES: Record<string, OcrLanguageChoice> = {
  // Page 2 rendered: Manipuri syllabus is printed in Bengali script, not Meetei Mayek.
  LAQP24: { langs: ['ben', 'eng'], basis: 'page image checked: Bengali script' },
  // Pages 2 rendered: the syllabus text is English, drawn as vector outlines.
  LAQP39: { langs: ['eng'], basis: 'page image checked: English text' },
  LAQP41: { langs: ['eng', 'ita'], basis: 'page image checked: English text' },
  // Pages rendered: Kashmiri in Nastaliq (Perso-Arabic) script. Tesseract has no Kashmiri model.
  LAQP17: { langs: ['urd', 'eng'], unsupportedScript: 'Kashmiri in Nastaliq script (no Tesseract model; Urdu model output kept only as a draft for a human transcriber)', basis: 'page image checked' },
  // Pages rendered: Urdu in Nastaliq script. Tesseract's Urdu model reads it as noise (mean confidence ~47%).
  LAQP37: { langs: ['urd', 'eng'], unsupportedScript: 'Urdu in Nastaliq script (Tesseract output unreadable; kept only as a draft for a human transcriber)', basis: 'page image checked' },
  // Page 2 rendered: Sanskrit in Devanagari.
  ACQP12: { langs: ['san', 'hin', 'eng'], basis: 'page image checked: Devanagari (Sanskrit)' },
};

/** Tesseract model codes by the language a paper is written in (from the official paper name). */
const BY_NAME: [RegExp, string[]][] = [
  [/assamese/i, ['asm']], [/bengali|bangla/i, ['ben']], [/gujarati/i, ['guj']], [/kannada/i, ['kan']], [/malayalam/i, ['mal']],
  [/marathi/i, ['mar']], [/odia|oriya/i, ['ori']], [/punjabi/i, ['pan']], [/tamil/i, ['tam']], [/telugu/i, ['tel']], [/urdu/i, ['urd']],
  [/nepali/i, ['nep']], [/sanskrit|pali|prakrit/i, ['san', 'hin']], [/hindi|patrakarita|prayojanmoolak/i, ['hin']], [/arabic/i, ['ara']], [/persian/i, ['fas']],
  [/french/i, ['fra']], [/german/i, ['deu']], [/hispanic|spanish/i, ['spa']], [/russian/i, ['rus']], [/japanese/i, ['jpn']],
  [/chinese/i, ['chi_sim']], [/korean/i, ['kor']], [/italian/i, ['ita']], [/tibetan|bhutia/i, ['bod']],
  [/pashto/i, ['pus']], [/garo|khasi|kokborok/i, ['eng']],
];

/** Scripts with no Tesseract model: any of their text inside images or scans needs a human transcriber. */
const NO_MODEL: [RegExp, string][] = [
  [/lepcha/i, 'Lepcha script (no Tesseract model)'],
  [/limbu/i, 'Limbu script (no Tesseract model)'],
  [/santali/i, 'Santali in Ol Chiki script (no Tesseract model)'],
];

export function ocrLanguagesFor(paper: { code: string; name: string; categoryCode: string }): OcrLanguageChoice {
  const override = OVERRIDES[paper.code];
  if (override) return override;
  for (const [re, why] of NO_MODEL) if (re.test(paper.name)) return { langs: ['eng'], unsupportedScript: why, basis: `paper language (${paper.name})` };
  for (const [re, langs] of BY_NAME) if (re.test(paper.name)) return { langs: [...langs, 'eng'], basis: `paper language (${paper.name})` };
  // Acharya papers are mostly Sanskrit/Hindi in Devanagari.
  if (paper.categoryCode === 'ACQP') return { langs: ['san', 'hin', 'eng'], basis: 'Acharya paper: Devanagari' };
  return { langs: ['eng'], basis: 'default: English' };
}

/**
 * A page is scanned when it has (almost) no text layer but does have images, or when a large image
 * covers it and little text sits on top. A title page with a short text header is NOT scanned.
 */
/**
 * Pages typed in legacy non-Unicode fonts (Kruti Dev for Hindi/Sanskrit, old Gurmukhi fonts for Punjabi):
 * the text layer holds Latin letters such as "osnkUr n’kZu dk bfrgkl" instead of Devanagari. Their give-away
 * is a lowercase letter followed by an uppercase letter or a symbol inside a word, which English text almost
 * never has. Such pages must be read by OCR, not from the text layer.
 */
const LEGACY_WORD = /[A-Za-z~"’';=ãÞ]{3,}/g;
const LEGACY_SIGNATURE = /[a-z][A-Z]|[a-zA-Z][~";=ãÞ][a-zA-Z]|[a-z]’[a-zA-Z]{2}/;

export function legacyFontPages(pdf: PdfContent): number[] {
  const out: number[] = [];
  for (let page = 1; page <= pdf.pageCount; page++) {
    const words = pdf.lines.filter((l) => l.page === page).flatMap((l) => l.text.match(LEGACY_WORD) ?? []);
    const odd = words.filter((w) => LEGACY_SIGNATURE.test(w)).length;
    if (odd >= 5 && odd / Math.max(1, words.length) >= 0.1) out.push(page);
  }
  return out;
}

/** Path operations on a page above which a textless page is treated as text drawn in outlines. */
export const VECTOR_TEXT_PATH_OPS = 100;

export function pagesNeedingOcr(pdf: PdfContent): number[] {
  const out: number[] = [];
  // An image repeated on several pages is a background or watermark, not a scan of page content.
  const pagesBySha = new Map<string, Set<number>>();
  for (const im of pdf.images) (pagesBySha.get(im.sha256) ?? pagesBySha.set(im.sha256, new Set()).get(im.sha256)!).add(im.page);
  pdf.textCharsPerPage.forEach((chars, i) => {
    const page = i + 1;
    const images = pdf.images.filter((im) => im.page === page);
    const uniqueImages = images.filter((im) => (pagesBySha.get(im.sha256)?.size ?? 0) < 2);
    const coverage = images.reduce((s, im) => s + im.pageCoverage, 0);
    // No text layer, but images or many vector shapes on the page: the text is drawn, not typed.
    const noText = chars < 20 && (images.length > 0 || (pdf.pathOpsPerPage[i] ?? 0) >= VECTOR_TEXT_PATH_OPS);
    // Real page scans in these documents cover 42-60% of the page; cover logos cover up to 30%.
    const scannedBody = uniqueImages.some((im) => im.pageCoverage >= 0.4) && chars < 300;
    const pieceImages = chars < 20 && images.length >= 10 && coverage >= 0.05; // text painted as many image pieces
    if (noText || scannedBody || pieceImages) out.push(page);
  });
  return out;
}

type CanvasFactory = { create(w: number, h: number): { canvas: { toBuffer(t: string): Buffer }; context: unknown } };

async function renderWith(doc: pdfjs.PDFDocumentProxy, pageNumber: number, scale: number): Promise<Buffer> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const factory = (doc as unknown as { canvasFactory: CanvasFactory }).canvasFactory;
  const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: context as never, canvas: canvas as never, viewport, background: 'white' }).promise;
  page.cleanup();
  return canvas.toBuffer('image/png');
}

export async function renderPagePng(data: Uint8Array, pageNumber: number, scale = 1.5): Promise<Buffer> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 });
  try {
    return await renderWith(await task.promise, pageNumber, scale);
  } finally {
    await task.destroy();
  }
}

export interface ImageText {
  lines: { text: string; y: number; confidence: number }[];
  words: number;
  meanConfidence: number;
}

/**
 * OCR embedded images (syllabus text is sometimes pasted into a PDF as a picture). Returns the text
 * found in each image so the caller can tell text images from real diagrams.
 */
export async function ocrImagePngs(
  images: { key: string; png: Buffer }[], paper: { code: string; name: string; categoryCode: string }, cacheDir: string,
): Promise<{ results: Map<string, ImageText>; langs: string[]; unsupportedScript?: string }> {
  const cfg = ocrLanguagesFor(paper);
  const results = new Map<string, ImageText>();
  if (!images.length) return { results, langs: cfg.langs };
  mkdirSync(cacheDir, { recursive: true });
  const worker = await createWorker(cfg.langs, 1, { cachePath: cacheDir, logger: () => undefined, errorHandler: () => undefined });
  try {
    for (const im of images) {
      const { data } = await worker.recognize(im.png, {}, { blocks: true, text: false });
      const lines: ImageText['lines'] = [];
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            const text = line.text.replace(/\s+/g, ' ').trim();
            if (text) lines.push({ text, y: line.bbox.y0, confidence: line.confidence });
          }
      lines.sort((a, b) => a.y - b.y);
      const words = lines.reduce((n, l) => n + l.text.split(' ').filter((w) => /[\p{L}\p{N}]{2,}/u.test(w)).length, 0);
      const meanConfidence = lines.length ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0;
      results.set(im.key, { lines, words, meanConfidence });
    }
  } finally {
    await worker.terminate();
  }
  return { results, langs: cfg.langs, ...(cfg.unsupportedScript ? { unsupportedScript: cfg.unsupportedScript } : {}) };
}

export interface OcrPage {
  page: number;
  lines: SourceLine[];
  meanConfidence: number;
  reviewImage: string;
}

export async function ocrPages(
  data: Uint8Array, pages: number[], paper: { code: string; name: string; categoryCode: string }, dirs: { cache: string; review: string }, scale = 3,
): Promise<{ pages: OcrPage[]; langs: string[]; basis: string; unsupportedScript?: string }> {
  const cfg = ocrLanguagesFor(paper);
  const paperCode = paper.code;
  mkdirSync(dirs.cache, { recursive: true });
  mkdirSync(dirs.review, { recursive: true });
  const worker = await createWorker(cfg.langs, 1, { cachePath: dirs.cache, logger: () => undefined, errorHandler: () => undefined });
  const task = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 });
  const out: OcrPage[] = [];
  try {
    const doc = await task.promise;
    for (const p of pages) {
      const png = await renderWith(doc, p, scale);
      const reviewImage = join(dirs.review, `${paperCode}-page${p}.png`);
      writeFileSync(reviewImage, await renderWith(doc, p, 1.5));
      const { data: result } = await worker.recognize(png, {}, { blocks: true, text: false });
      const lines: SourceLine[] = [];
      for (const block of result.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            const text = line.text.replace(/\s+/g, ' ').trim();
            if (text) lines.push({ page: p, y: line.bbox.y0 / scale, x: line.bbox.x0 / scale, text, ocrConfidence: line.confidence });
          }
      lines.sort((a, b) => a.y - b.y || a.x - b.x);
      const meanConfidence = lines.length ? lines.reduce((s, l) => s + (l.ocrConfidence ?? 0), 0) / lines.length : 0;
      out.push({ page: p, lines, meanConfidence, reviewImage });
    }
  } finally {
    await task.destroy();
    await worker.terminate();
  }
  return { pages: out, langs: cfg.langs, basis: cfg.basis, ...(cfg.unsupportedScript ? { unsupportedScript: cfg.unsupportedScript } : {}) };
}
