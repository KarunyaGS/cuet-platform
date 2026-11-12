// Print the raw text runs of lines containing a phrase. Usage: tsx scripts/debug-line.ts <file.pdf> <page> <phrase>
import { readFileSync } from 'node:fs';
import { readPdf } from '../src/pdf';

const [file, page, phrase] = process.argv.slice(2);
const pdf = await readPdf(new Uint8Array(readFileSync(file!)));
console.log('page width', pdf.pageSizes[Number(page) - 1]);
for (const l of pdf.lines.filter((x) => x.page === Number(page) && x.text.includes(phrase!))) {
  console.log(`y=${l.y.toFixed(1)} "${l.text}"`);
  for (const r of l.runs) console.log(`   x=${r.x.toFixed(1)} w=${r.width.toFixed(1)} ${JSON.stringify(r.text)}`);
}
