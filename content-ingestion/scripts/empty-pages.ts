// For machine-verified papers: every page with no stored syllabus rows, and the text the PDF has on it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from '../src/pdf';
const L = 'D:/cuet-platform/storage/local';
const v = JSON.parse(readFileSync(join(L, 'verification', 'verification.json'), 'utf8')).results.filter((r: { verdict: string }) => r.verdict === 'MACHINE_VERIFIED');
const out: { exam: string; code: string; name: string; page: number; words: number; text: string; kind: string }[] = [];
for (const r of v) {
  const x = JSON.parse(readFileSync(join(L, 'extracted', r.exam, `${r.code}.json`), 'utf8'));
  const pdf = await readPdf(new Uint8Array(readFileSync(x.source.localFile)));
  const used = new Set<number>(x.nodes.flatMap((n: { sourcePage: number; endPage?: number }) => { const a = []; for (let p = n.sourcePage; p <= (n.endPage ?? n.sourcePage); p++) a.push(p); return a; }));
  for (let p = 1; p <= pdf.pageCount; p++) {
    if (used.has(p)) continue;
    const text = pdf.lines.filter((l) => l.page === p).map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();
    const ws = text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
    const allowed = new Set([...(r.name.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []), r.code.toLowerCase(), 'syllabus', 'cuet', 'ug', 'pg', '2025', '2026', 'for', 'the', 'year', 'common', 'university', 'entrance', 'test', 'subject', 'code', 'page', 'of', 'and']);
    const kind = !ws.length ? 'no text (image/blank)' : ws.every((w) => allowed.has(w)) ? 'title only (cover)' : 'HAS OTHER TEXT';
    out.push({ exam: r.exam, code: r.code, name: r.name, page: p, words: ws.length, text: text.slice(0, 160), kind });
  }
}
writeFileSync(join(L, 'audit', 'machine-verified-empty-pages.json'), JSON.stringify(out, null, 1));
const by: Record<string, number> = {};
for (const o of out) by[o.kind] = (by[o.kind] ?? 0) + 1;
console.log(out.length, 'pages without rows in machine-verified papers:', JSON.stringify(by));
for (const o of out.filter((o) => o.kind === 'HAS OTHER TEXT')) console.log(` ${o.exam} ${o.code} p${o.page} (${o.words}w): ${o.text}`);
