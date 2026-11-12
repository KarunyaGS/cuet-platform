// Render PDF pages to PNG for human review. Usage: tsx scripts/render-page.ts <file.pdf> <page> <out.png> [scale]
import { readFileSync, writeFileSync } from 'node:fs';
import { renderPagePng } from '../src/ocr';

const [file, page, out, scale] = process.argv.slice(2);
if (!file || !page || !out) throw new Error('Usage: tsx scripts/render-page.ts <file.pdf> <page> <out.png> [scale]');
writeFileSync(out, await renderPagePng(new Uint8Array(readFileSync(file)), Number(page), Number(scale ?? 1.5)));
console.log('wrote', out);
