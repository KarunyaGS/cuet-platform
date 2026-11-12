/**
 * Read a PDF with Mozilla pdf.js (no native dependencies): text lines with page numbers and
 * positions, plus the raster images painted on each page (for figures and for OCR of scans).
 */
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface TextLine {
  page: number;
  y: number; // distance from the top of the page, in PDF points
  x: number; // left edge of the first text run
  text: string;
  /** Text runs on this line, left to right, with their x position (for column and table detection). */
  runs: { x: number; width: number; text: string }[];
  fontSize: number;
}

export interface PageImage {
  page: number;
  name: string;
  width: number;
  height: number;
  /** Share of the page area the image covers (0 to 1), from its transform matrix. */
  pageCoverage: number;
  y: number;
  png: Buffer;
  sha256: string;
}

export interface PdfContent {
  pageCount: number;
  pageSizes: { width: number; height: number }[];
  lines: TextLine[];
  /** Lines in the order the PDF stores its text (usually the author's reading order, column by column). */
  streamLines: TextLine[];
  images: PageImage[];
  textCharsPerPage: number[];
  /** Vector path drawing operations per page (text drawn as outlines shows up as hundreds of these). */
  pathOpsPerPage: number[];
}

type TextItem = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

export async function readPdf(data: Uint8Array, options: { images?: boolean } = {}): Promise<PdfContent> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const lines: TextLine[] = [];
  const streamLines: TextLine[] = [];
  const images: PageImage[] = [];
  const pageSizes: { width: number; height: number }[] = [];
  const textCharsPerPage: number[] = [];
  const pathOpsPerPage: number[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      pageSizes.push({ width: viewport.width, height: viewport.height });
      const content = await page.getTextContent();
      const items = (content.items as TextItem[]).filter((i) => typeof i.str === 'string' && i.str.trim() !== '');
      textCharsPerPage.push(items.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0));
      lines.push(...groupLines(items, p, viewport.height));
      streamLines.push(...groupStream(items, p, viewport.height));
      if (options.images) {
        const found = await pageImages(page, p, viewport.width, viewport.height);
        images.push(...found.images);
        pathOpsPerPage.push(found.pathOps);
      } else pathOpsPerPage.push(0);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { pageCount: doc.numPages, pageSizes, lines, streamLines, images, textCharsPerPage, pathOpsPerPage };
}

/** Lines in content-stream order: consecutive runs on the same baseline form a line. */
function groupStream(items: TextItem[], page: number, pageHeight: number): TextLine[] {
  const out: TextLine[] = [];
  let cur: { x: number; y: number; width: number; size: number; text: string }[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();
    if (text) out.push({ page, y: cur[0]!.y, x: Math.min(...cur.map((r) => r.x)), text, runs: cur.map((r) => ({ x: r.x, width: r.width, text: r.text })), fontSize: Math.max(...cur.map((r) => r.size)) });
    cur = [];
  };
  for (const i of items) {
    const r = { x: i.transform[4] ?? 0, y: pageHeight - (i.transform[5] ?? 0), width: i.width, size: Math.abs(i.transform[3] ?? i.height) || i.height, text: i.str };
    const last = cur.at(-1);
    if (last && (Math.abs(r.y - last.y) > 2.5 || r.x < last.x - 5)) flush();
    cur.push(r);
  }
  flush();
  return out;
}

/** Group text runs into lines by baseline (within 2.5 points), left to right. */
function groupLines(items: TextItem[], page: number, pageHeight: number): TextLine[] {
  const runs = items.map((i) => ({
    x: i.transform[4] ?? 0,
    y: pageHeight - (i.transform[5] ?? 0),
    width: i.width,
    size: Math.abs(i.transform[3] ?? i.height) || i.height,
    text: i.str,
  }));
  runs.sort((a, b) => a.y - b.y || a.x - b.x);
  const out: TextLine[] = [];
  let current: typeof runs = [];
  const flush = () => {
    if (!current.length) return;
    current.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = -Infinity;
    for (const r of current) {
      const gap = r.x - prevEnd;
      if (text && gap > r.size * 0.15 && !text.endsWith(' ') && !r.text.startsWith(' ')) text += ' ';
      text += r.text;
      prevEnd = r.x + r.width;
    }
    out.push({
      page,
      y: current[0]!.y,
      x: current[0]!.x,
      text: text.replace(/\s+/g, ' ').trim(),
      runs: current.map((r) => ({ x: r.x, width: r.width, text: r.text })),
      fontSize: Math.max(...current.map((r) => r.size)),
    });
    current = [];
  };
  for (const r of runs) {
    if (current.length && Math.abs(r.y - current[0]!.y) > 2.5) flush();
    current.push(r);
  }
  flush();
  return out.filter((l) => l.text);
}

async function pageImages(page: pdfjs.PDFPageProxy, p: number, pw: number, ph: number): Promise<{ images: PageImage[]; pathOps: number }> {
  const ops = await page.getOperatorList();
  const found: PageImage[] = [];
  let pathOps = 0;
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    if (fn === pdfjs.OPS.constructPath) pathOps++;
    if (fn === pdfjs.OPS.save) stack.push(ctm);
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === pdfjs.OPS.transform) ctm = multiply(ctm, args as number[]);
    else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
      const img = fn === pdfjs.OPS.paintInlineImageXObject ? (args[0] as RawImage) : await getObj(page, String(args[0]));
      if (!img || !img.width || !img.height || !img.data) continue;
      const drawnW = Math.hypot(ctm[0]!, ctm[1]!);
      const drawnH = Math.hypot(ctm[2]!, ctm[3]!);
      const png = encodePng(img);
      if (!png) continue;
      found.push({
        page: p,
        name: fn === pdfjs.OPS.paintInlineImageXObject ? `inline-${i}` : String(args[0]),
        width: img.width,
        height: img.height,
        pageCoverage: Math.min(1, (drawnW * drawnH) / (pw * ph)),
        y: ph - (ctm[5]! + drawnH),
        png,
        sha256: createHash('sha256').update(png).digest('hex'),
      });
    }
  }
  return { images: found, pathOps };
}

interface RawImage {
  width: number;
  height: number;
  kind?: number; // 1 = 1-bit grayscale, 2 = RGB 24-bit, 3 = RGBA 32-bit
  data?: Uint8Array | Uint8ClampedArray;
}

function getObj(page: pdfjs.PDFPageProxy, name: string): Promise<RawImage | null> {
  return new Promise((resolve) => {
    const objs = (name.startsWith('g_') ? page.commonObjs : page.objs) as unknown as { get(n: string, cb: (o: RawImage) => void): void };
    const timer = setTimeout(() => resolve(null), 5000);
    try {
      objs.get(name, (o) => {
        clearTimeout(timer);
        resolve(o);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function multiply(a: number[], b: number[]): number[] {
  const [a0, a1, a2, a3, a4, a5] = a as [number, number, number, number, number, number];
  const [b0, b1, b2, b3, b4, b5] = b as [number, number, number, number, number, number];
  return [b0 * a0 + b1 * a2, b0 * a1 + b1 * a3, b2 * a0 + b3 * a2, b2 * a1 + b3 * a3, b4 * a0 + b5 * a2 + a4, b4 * a1 + b5 * a3 + a5];
}

// ---- Minimal PNG encoder (RGB or RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(img: RawImage): Buffer | null {
  const { width, height, data } = img;
  if (!data) return null;
  let channels: number;
  let pixels: Uint8Array;
  if (img.kind === 3 || data.length === width * height * 4) {
    channels = 4;
    pixels = data as Uint8Array;
  } else if (img.kind === 2 || data.length === width * height * 3) {
    channels = 3;
    pixels = data as Uint8Array;
  } else if (img.kind === 1) {
    // 1 bit per pixel, rows padded to whole bytes; expand to RGB
    channels = 3;
    pixels = new Uint8Array(width * height * 3);
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        pixels.set([v, v, v], (y * width + x) * 3);
      }
  } else return null;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
