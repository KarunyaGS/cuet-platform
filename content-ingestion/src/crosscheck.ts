/**
 * Independent visual cross-check: render every page of every paper, read it with OCR, and measure how
 * many of the confidently-read words are present in the extracted rows. This does not depend on the PDF
 * text layer at all, so it catches content the extraction could not see (text in images, text drawn as
 * shapes, unusual fonts). Pages whose readable words are largely missing are listed for review.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker, type Worker } from 'tesseract.js';
import { ocrLanguagesFor } from './ocr';
import { isNoise } from './structure';
import type { ExtractionResult, Registry } from './types';

const norm = (s: string) => s.normalize('NFKC').toLowerCase();
const words = (s: string) => norm(s).match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? [];

export interface CrosscheckRow {
  exam: string;
  code: string;
  page: number;
  ocrWords: number;
  foundInExtraction: number;
  pct: number | null;
  missingSample: string;
  status: 'OK' | 'CHECK' | 'NO_TEXT' | 'SKIPPED';
}

type CanvasFactory = { create(w: number, h: number): { canvas: { toBuffer(t: string): Buffer }; context: unknown } };

export async function runCrosscheck(registry: Registry, paths: { extracted: string; audit: string; cache: string }, threshold = 85): Promise<CrosscheckRow[]> {
  const rows: CrosscheckRow[] = [];
  const workers = new Map<string, Worker>();
  const workerFor = async (langs: string[]) => {
    const key = langs.join('+');
    if (!workers.has(key)) workers.set(key, await createWorker(langs, 1, { cachePath: join(paths.cache, 'tessdata'), logger: () => undefined, errorHandler: () => undefined }));
    return workers.get(key)!;
  };
  try {
    for (const p of registry.papers) {
      const f = join(paths.extracted, p.exam, `${p.code}.json`);
      if (!existsSync(f)) continue;
      const r = JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult;
      if (!r.source) continue;
      const extracted = new Set(words([...r.nodes.map((n) => `${n.sourceText ?? n.title} ${n.body ?? ''}`), ...r.tables.flatMap((t) => t.rows.flat())].join(' ')));
      const worker = await workerFor(ocrLanguagesFor(p).langs);
      const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(r.source.localFile)), verbosity: 0 });
      const doc = await task.promise;
      try {
        for (let pg = 1; pg <= doc.numPages; pg++) {
          if (r.status !== 'EXTRACTED') {
            rows.push({ exam: p.exam, code: p.code, page: pg, ocrWords: 0, foundInExtraction: 0, pct: null, missingSample: '', status: 'SKIPPED' });
            continue;
          }
          const page = await doc.getPage(pg);
          const viewport = page.getViewport({ scale: 2 });
          const factory = (doc as unknown as { canvasFactory: CanvasFactory }).canvasFactory;
          const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: context as never, canvas: canvas as never, viewport, background: 'white' }).promise;
          page.cleanup();
          const { data } = await worker.recognize(canvas.toBuffer('image/png'), {}, { blocks: true, text: false });
          const seen: string[] = [];
          for (const block of data.blocks ?? [])
            for (const para of block.paragraphs)
              for (const line of para.lines) {
                if (line.confidence < 80 || isNoise(line.text, p.code, p.name)) continue;
                for (const w of line.words) if (w.confidence >= 85) seen.push(...words(w.text));
              }
          const found = seen.filter((w) => extracted.has(w));
          const missing = [...new Set(seen.filter((w) => !extracted.has(w)))];
          const pct = seen.length ? Math.round((1000 * found.length) / seen.length) / 10 : null;
          rows.push({
            exam: p.exam, code: p.code, page: pg, ocrWords: seen.length, foundInExtraction: found.length, pct,
            missingSample: missing.slice(0, 12).join(' '),
            status: seen.length < 5 ? 'NO_TEXT' : (pct ?? 0) >= threshold ? 'OK' : 'CHECK',
          });
        }
      } finally {
        await task.destroy();
      }
      process.stdout.write(`.${p.code}`);
    }
  } finally {
    for (const w of workers.values()) await w.terminate();
  }
  mkdirSync(paths.audit, { recursive: true });
  const cols = ['exam', 'code', 'page', 'ocrWords', 'foundInExtraction', 'pct', 'status', 'missingSample'] as const;
  writeFileSync(
    join(paths.audit, 'visual-crosscheck.csv'),
    [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n',
  );
  return rows;
}

export function printCrosscheck(rows: CrosscheckRow[]) {
  console.log('');
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const rs = rows.filter((r) => r.exam === exam);
    const by = (s: string) => rs.filter((r) => r.status === s).length;
    const ocrWords = rs.reduce((n, r) => n + r.ocrWords, 0);
    const found = rs.reduce((n, r) => n + r.foundInExtraction, 0);
    console.log(`${exam}: pages ${rs.length} | OK ${by('OK')} | CHECK ${by('CHECK')} | no readable text ${by('NO_TEXT')} | skipped (blocked papers) ${by('SKIPPED')} | words read independently ${ocrWords}, found in extraction ${found} (${ocrWords ? Math.round((1000 * found) / ocrWords) / 10 : '-'}%)`);
    for (const r of rs.filter((x) => x.status === 'CHECK')) console.log(`   CHECK ${r.code} p${r.page}: ${r.pct}% of ${r.ocrWords} words | missing e.g. ${r.missingSample.slice(0, 100)}`);
  }
}
