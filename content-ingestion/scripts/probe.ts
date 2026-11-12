// Quick look at PDFs: text characters per page and images per page. Usage: tsx scripts/probe.ts <file.pdf>...
import { readFileSync } from 'node:fs';
import { readPdf } from '../src/pdf';

for (const file of process.argv.slice(2)) {
  const pdf = await readPdf(readFileSync(file), { images: true });
  const imgs = pdf.images.map((i) => `p${i.page}:${i.width}x${i.height}@${i.pageCoverage.toFixed(2)}`).join(' ');
  console.log(`${file.split(/[\\/]/).pop()} pages=${pdf.pageCount} textChars=${pdf.textCharsPerPage.join('/')} images=${pdf.images.length} ${imgs.slice(0, 160)}`);
  const sample = pdf.lines.slice(0, 3).map((l) => l.text.slice(0, 60)).join(' | ');
  if (sample) console.log('   text sample:', sample);
}
