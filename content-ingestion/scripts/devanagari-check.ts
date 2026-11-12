// For pages with Devanagari: how broken is the text from pdf.js vs pdftotext? Usage: tsx scripts/devanagari-check.ts CODE...
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from '../src/pdf';
import { popplerPageText } from '../src/poppler';

const root = join(import.meta.dirname, '..', '..');
const ORPHAN = /(?:^|[\s(,;:.\-–"'])ि/g;
const WORD = /[ऀ-ॿ]{2,}/g;
for (const code of process.argv.slice(2)) {
  const exam = /^\d+$/.test(code) ? 'CUET_UG' : 'CUET_PG';
  const file = join(root, 'storage', 'cache', 'pdf', exam, `${code}.pdf`);
  const pdf = await readPdf(new Uint8Array(readFileSync(file)));
  for (let p = 1; p <= pdf.pageCount; p++) {
    const js = pdf.lines.filter((l) => l.page === p).map((l) => l.text).join('\n');
    const words = (js.match(WORD) ?? []).length;
    if (words < 3) continue;
    const pop = popplerPageText(file, p) ?? '';
    console.log(`${code} p${p}: devanagari words pdfjs=${words} poppler=${(pop.match(WORD) ?? []).length} | orphan ि pdfjs=${(js.match(ORPHAN) ?? []).length} poppler=${(pop.match(ORPHAN) ?? []).length}`);
  }
}
