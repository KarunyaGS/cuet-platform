// Question-by-question check of a generated CUET Prep paper: every question, option and answer in the PDF
// is compared with the content file it was made from. Writes sample-pdf-verification.csv beside this script.
// Run:  node research/cuet-pyq-2024-2026/verify_sample_pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const name = 'CUET_UG-322-set-1';
const paper = JSON.parse(readFileSync(join(root, 'content', 'native-papers', `${name}.json`), 'utf8'));
const pdfjs = await import(pathToFileURL(join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')).href);
const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(root, '.native-papers', `${name}.pdf`))), useSystemFonts: true, verbosity: 0 });
const doc = await task.promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' '));
const numPages = doc.numPages;
await task.destroy();

const keyAt = pages.findIndex((t) => /Answer key/.test(t));
const body = pages.slice(0, keyAt).join(' ');
const keyText = pages.slice(keyAt).join(' ');

// Plain words of a piece of content: formulas are typeset, so only the words outside them are compared as text.
const words = (s) => String(s ?? '').replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, ' ').replace(/[*_`#]/g, ' ').toLowerCase().match(/[a-z]{3,}/g) ?? [];
const flat = (s) => s.toLowerCase().replace(/[^a-z]+/g, ' ');

// Cut the body into one piece per question, at "N." markers found in order.
const cuts = [];
let from = 0;
for (const q of paper.questions) {
  const first = words(q.passage ?? q.stem).slice(0, 3).join('.{1,40}?');
  const re = new RegExp(`(?:^| )${q.number}\\. `, 'g');
  re.lastIndex = from;
  let m, at = -1;
  while ((m = re.exec(body))) {
    const ahead = flat(body.slice(m.index, m.index + 400));
    if (!first || new RegExp(first).test(ahead)) { at = m.index; break; }
  }
  cuts.push(at);
  if (at >= 0) from = at + 1;
}

const rows = [];
let pass = 0;
paper.questions.forEach((q, i) => {
  const start = cuts[i];
  const end = cuts.slice(i + 1).find((c) => c >= 0) ?? body.length;
  const piece = start >= 0 ? flat(body.slice(start, end)) : '';
  const inOrder = (list) => { let p = 0, hit = 0; for (const w of list) { const k = piece.indexOf(w, p); if (k >= 0) { hit++; p = k + w.length; } } return hit; };
  const stemWords = words([q.passage, q.stem, q.structure ? JSON.stringify(q.structure) : ''].filter(Boolean).join(' '));
  const stemHit = inOrder(words([q.passage, q.stem].filter(Boolean).join(' ')));
  const stemAll = words([q.passage, q.stem].filter(Boolean).join(' ')).length;
  const opts = q.options.map((o) => { const w = words(o.text); return { label: o.label, total: w.length, hit: w.filter((x) => piece.includes(x)).length }; });
  const labels = q.options.every((o) => new RegExp(`\\(${o.label}\\)|(?:^| )${o.label}[.)] `, 'i').test(body.slice(start, end)));
  const want = paper.answerKey.find((a) => a.number === q.number).correct.join(', ');
  const km = keyText.match(new RegExp(`(?:^| )${q.number}[.:]? +\\(?([A-D](?:, ?[A-D])*)\\)?(?= |$)`));
  const got = km ? km[1].replace(/, ?/g, ', ') : '';
  const stemOk = start >= 0 && stemHit === stemAll;
  const optOk = opts.every((o) => o.hit === o.total);
  const keyOk = got === want;
  const ok = stemOk && optOk && labels && keyOk;
  if (ok) pass++;
  rows.push({ number: q.number, question_id: q.id, unit: q.unit, type: q.type, found_in_pdf: start >= 0 ? 'yes' : 'NO', question_words_matched: `${stemHit} of ${stemAll}`, options_in_pdf: q.options.length,
    option_words_matched: opts.map((o) => `${o.label} ${o.hit}/${o.total}`).join('; '), option_labels_present: labels ? 'yes' : 'NO', answer_in_content_file: want, answer_in_pdf_key: got || 'NOT FOUND', result: ok ? 'MATCH' : 'CHECK',
    has_formula: /\$|\\\(/.test(JSON.stringify(q)) ? 'yes (formula compared by eye, not by text)' : 'no' });
  void stemWords;
});
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(join(here, 'sample-pdf-verification.csv'), '﻿' + [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map(esc).join(','))].join('\r\n'));
console.log(`pages ${numPages}; answer key on page ${keyAt + 1}; questions in file ${paper.questions.length}; MATCH ${pass}; CHECK ${rows.length - pass}`);
for (const r of rows.filter((x) => x.result !== 'MATCH')) console.log(JSON.stringify(r));
console.log('with formulas:', rows.filter((r) => r.has_formula.startsWith('yes')).length);
if (process.argv[2]) { const n = Number(process.argv[2]); console.log(body.slice(cuts[n - 1], cuts[n] ?? cuts[n - 1] + 600)); console.log('KEY:', keyText.slice(0, 500)); }
