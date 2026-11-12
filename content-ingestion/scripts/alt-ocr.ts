// Alternative OCR for pages no regular model reads well (Urdu/Kashmiri Nastaliq). Renders each page at 3x and runs
// Tesseract with the Urdu and Persian (Perso-Arabic) models. The output is a READING AID for the page-image review:
// it is never stored as syllabus text by itself. Writes `altOcr` into the paper's syllabus-review input.json.
// Usage: tsx scripts/alt-ocr.ts CUET_PG:LAQP17 CUET_PG:LAQP37
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWorker } from 'tesseract.js';
import { renderPagePng } from '../src/ocr';

const repo = join(import.meta.dirname, '..', '..');
const cache = join(repo, 'storage', 'cache', 'tessdata');
for (const arg of process.argv.slice(2)) {
  const [exam, code] = arg.split(':') as [string, string];
  const x = JSON.parse(readFileSync(join(repo, 'storage', 'local', 'extracted', exam, `${code}.json`), 'utf8'));
  const inputFile = join(repo, 'storage', 'local', 'syllabus-review', exam, code, 'input.json');
  const input = JSON.parse(readFileSync(inputFile, 'utf8'));
  const data = new Uint8Array(readFileSync(x.source.localFile));
  for (const langs of ['urd', 'fas']) {
    const worker = await createWorker(langs, 1, { cachePath: cache, logger: () => undefined, errorHandler: () => undefined });
    for (const pg of input.pages) {
      const png = await renderPagePng(data, pg.page, 3);
      const { data: r } = await worker.recognize(png);
      pg.altOcr = { ...(pg.altOcr ?? {}), [langs]: { meanConfidence: Math.round(r.confidence * 10) / 10, text: r.text } };
      console.log(`${code} p${pg.page} ${langs}: confidence ${Math.round(r.confidence)}%, ${r.text.trim().split(/\s+/).length} words`);
    }
    await worker.terminate();
  }
  writeFileSync(inputFile, JSON.stringify(input, null, 1));
}
