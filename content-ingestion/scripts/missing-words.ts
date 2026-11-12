// Show source lines whose words did not reach the extracted rows. Usage: tsx scripts/missing-words.ts <EXAM> <CODE>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from '../src/pdf';
import { isNoise } from '../src/structure';
import type { ExtractionResult } from '../src/types';

const [exam, code] = process.argv.slice(2);
const root = join(import.meta.dirname, '..', '..');
const r = JSON.parse(readFileSync(join(root, 'storage', 'local', 'extracted', exam!, `${code}.json`), 'utf8')) as ExtractionResult;
const pdf = await readPdf(new Uint8Array(readFileSync(r.source!.localFile)));
const tok = (s: string) => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
const extracted = new Map<string, number>();
for (const t of tok([...r.nodes.map((n) => `${n.label ?? ''} ${n.title} ${n.body ?? ''}`), ...r.tables.flatMap((t) => t.rows.flat())].join(' '))) extracted.set(t, (extracted.get(t) ?? 0) + 1);
for (const l of pdf.lines) {
  if (r.ocrPages.includes(l.page)) continue;
  const noise = isNoise(l.text, r.paper.code, r.paper.name);
  const missing = tok(l.text).filter((t) => {
    const c = extracted.get(t) ?? 0;
    if (c > 0) extracted.set(t, c - 1);
    return c === 0;
  });
  if (missing.length && !noise) console.log(`p${l.page} MISSING [${missing.join(' ')}] in: ${l.text.slice(0, 110)}`);
}
