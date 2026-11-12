// Which papers need (re-)extraction because their OCR pages or OCR languages changed?
// Usage: tsx scripts/ocr-plan.ts   -> prints a table and the list of codes to re-run
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ocrLanguagesFor, pagesNeedingOcr } from '../src/ocr';
import { readPdf } from '../src/pdf';
import type { ExtractionResult, Registry } from '../src/types';

const root = join(import.meta.dirname, '..', '..');
const registry = JSON.parse(readFileSync(join(root, 'content-ingestion', 'registry', 'cuet-2026-official-papers.json'), 'utf8')) as Registry;
const rerun: string[] = [];
const textless: string[] = [];
for (const p of registry.papers) {
  const file = join(root, 'storage', 'cache', 'pdf', p.exam, `${p.code}.pdf`);
  if (!existsSync(file)) {
    rerun.push(`${p.exam}:${p.code}`);
    continue;
  }
  const pdf = await readPdf(new Uint8Array(readFileSync(file)), { images: true });
  pdf.textCharsPerPage.forEach((c, i) => {
    if (c < 20) textless.push(`${p.code} p${i + 1}: chars=${c} images=${pdf.images.filter((im) => im.page === i + 1).length} pathOps=${pdf.pathOpsPerPage[i]}`);
  });
  const pages = pagesNeedingOcr(pdf);
  const langs = pages.length ? ocrLanguagesFor(p).langs.join('+') : '';
  const prevFile = join(root, 'storage', 'local', 'extracted', p.exam, `${p.code}.json`);
  const prev = existsSync(prevFile) ? (JSON.parse(readFileSync(prevFile, 'utf8')) as ExtractionResult) : null;
  const prevLangs = prev?.documentFlags.find((f) => f.startsWith('ocr_languages('))?.slice(14, -1) ?? '';
  const changed = !prev || prev.status !== 'EXTRACTED' || (prev.ocrPages ?? []).join(',') !== pages.join(',') || prevLangs !== langs;
  if (pages.length || changed) console.log(`${p.exam} ${p.code.padEnd(7)} ocrPages=[${pages.join(',')}] langs=${langs || '-'} prev=[${prev?.ocrPages?.join(',') ?? '?'}] ${prevLangs || '-'} ${prev?.status ?? 'none'}${changed ? '  -> RE-RUN' : ''}`);
  if (changed) rerun.push(`${p.exam}:${p.code}`);
}
console.log('\nPages with under 20 characters of text:');
for (const t of textless) console.log('  ' + t);
console.log(`\nRE-RUN (${rerun.length}): ${rerun.join(' ')}`);
