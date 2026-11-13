/**
 * Native CUET Prep documents: turns the content of a paper into a typeset PDF, stores it in our own storage and
 * records it, so students open it in the platform's own viewer.
 *
 * Only content we may reproduce goes in. Today that is our own practice questions (the API refuses anything else).
 * The PDF is typeset by the Chrome installed on this machine (print to PDF); formulas are set with KaTeX. Nothing is
 * sent to any outside service.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import katex from 'katex';

const require = createRequire(import.meta.url);

interface Draft {
  schema: string; key: string; kind: string; exam: string; paperId: string; subjectCode: string; subjectName: string; set: number; title: string; language: string;
  rights: { basis: string; statement: string }; reviewState: 'REVIEWED' | 'UNREVIEWED'; reviewedQuestions: number;
  pattern: { questions: number; durationMinutes: number | null; marksCorrect: number | null; marksIncorrect: number | null; officialQuestionCount: number | null };
  units: { title: string; questions: number }[];
  questions: { number: number; id: string; type: string; unit: string; stem: string; structure: Record<string, unknown> | null; passage: { title: string | null; body: string } | null; options: { position: number; label: string; text: string }[] }[];
  answerKey: { number: number; correct: string[] }[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tex = (t: string, display = false) => katex.renderToString(t, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore', trust: false });

/** The same small text format the app uses: **bold**, *italic*, `code`, $inline maths$. Text is escaped; only KaTeX output is HTML. */
function inline(text: string): string {
  const re = /(\$[^$\n]+?\$)|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)|(`[^`]+?`)/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out += esc(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out += tex(t.slice(1, -1));
    else if (m[2]) out += `<strong>${inline(t.slice(2, -2))}</strong>`;
    else if (m[3]) out += `<em>${inline(t.slice(1, -1))}</em>`;
    else out += `<code>${esc(t.slice(1, -1))}</code>`;
    last = m.index + t.length;
  }
  return out + esc(text.slice(last));
}

/** Paragraphs, "- " and "1. " lists and $$display maths$$. */
export function rich(text: string): string {
  return text
    .split(/(\$\$[\s\S]+?\$\$)/g)
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) return `<div class="display">${tex(part.slice(2, -2).trim(), true)}</div>`;
      return part
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter(Boolean)
        .map((b) => {
          const ls = b.split('\n');
          if (ls.every((l) => /^\s*[-*•]\s+/.test(l))) return `<ul>${ls.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
          if (ls.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${ls.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
          return `<p>${ls.map(inline).join('<br>')}</p>`;
        })
        .join('');
    })
    .join('');
}

const fileUrl = (path: string) => pathToFileURL(path).href;
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The whole paper as one HTML page, ready to be printed to PDF. */
export function paperHtml(d: Draft, images: Map<string, string>, generatedOn: Date): string {
  const katexCss = fileUrl(require.resolve('katex/dist/katex.min.css'));
  const font = (w: number) => fileUrl(require.resolve(`@fontsource/ibm-plex-sans/${w}.css`));
  const p = d.pattern;
  const instructions = [
    `This paper has ${p.questions} questions. Each question has four options, of which one is correct.`,
    p.durationMinutes ? `Suggested time: ${p.durationMinutes} minutes, the time allowed for this subject in CUET (UG).` : null,
    p.marksCorrect && p.marksIncorrect !== null ? `To score it the CUET (UG) way: ${p.marksCorrect} marks for a correct answer, ${p.marksIncorrect} for a wrong answer, 0 for a question left out.` : null,
    'The answer key is on the last page. Attempt the whole paper before you look at it.',
  ].filter(Boolean) as string[];
  const question = (q: Draft['questions'][number]) => {
    const s = q.structure ?? {};
    const left = Array.isArray(s.left) ? (s.left as string[]) : null;
    const right = Array.isArray(s.right) ? (s.right as string[]) : null;
    const img = typeof s.mediaAssetId === 'string' ? images.get(s.mediaAssetId) : null;
    return `<section class="q" data-number="${q.number}">
      <div class="n">${q.number}.</div>
      <div class="body">
        ${q.passage ? `<div class="passage">${q.passage.title ? `<div class="pt">${esc(q.passage.title)}</div>` : ''}${rich(q.passage.body)}</div>` : ''}
        <div class="stem">${rich(q.stem)}</div>
        ${img ? `<div class="fig"><img src="${img}" alt="Figure for question ${q.number}"></div>` : ''}
        ${left && right ? `<table class="match"><thead><tr><th>List-I</th><th>List-II</th></tr></thead><tbody>${Array.from({ length: Math.max(left.length, right.length) }, (_, i) => `<tr><td>${inline(left[i] ?? '')}</td><td>${inline(right[i] ?? '')}</td></tr>`).join('')}</tbody></table>` : ''}
        <ol class="opts">${q.options.map((o) => `<li><span class="l">(${esc(o.label)})</span><span class="t">${inline(o.text)}</span></li>`).join('')}</ol>
      </div>
    </section>`;
  };
  const footer = `CUET Prep · ${d.subjectName} practice paper, set ${d.set} · Written by CUET Prep; not a previous-year paper`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<link rel="stylesheet" href="${katexCss}"><link rel="stylesheet" href="${font(400)}"><link rel="stylesheet" href="${font(600)}">
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm;
    @bottom-left { content: "${footer.replace(/"/g, '\\"')}"; font: 7.5pt "IBM Plex Sans", sans-serif; color: #5b6472; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt "IBM Plex Sans", sans-serif; color: #5b6472; } }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.5 "IBM Plex Sans", "Segoe UI", sans-serif; color: #16202e; margin: 0; }
  header.cover { border-bottom: 2px solid #2347a8; padding-bottom: 10pt; margin-bottom: 12pt; }
  .brand { display: flex; align-items: center; gap: 8pt; font-weight: 600; font-size: 12pt; color: #16202e; }
  .mark { display: inline-grid; place-items: center; width: 22pt; height: 22pt; border-radius: 6pt; background: #2347a8; color: #fff; font-size: 9pt; font-weight: 600; }
  h1 { font-size: 18pt; line-height: 1.25; margin: 10pt 0 2pt; font-weight: 600; }
  .meta { color: #45505f; font-size: 10pt; }
  .box { border: 1px solid #d5dae2; border-radius: 6pt; padding: 8pt 10pt; margin: 8pt 0; break-inside: avoid; }
  .box h2 { font-size: 10.5pt; margin: 0 0 3pt; font-weight: 600; }
  .box ul { margin: 0; padding-left: 14pt; } .box p { margin: 0; }
  .preview { border-color: #e2b25c; background: #fff7e8; }
  .rights { font-size: 9pt; color: #45505f; }
  .q { display: flex; gap: 6pt; margin: 0 0 11pt; break-inside: avoid; }
  .q .n { width: 20pt; flex: none; font-weight: 600; }
  .q .body { flex: 1; min-width: 0; }
  .q p { margin: 0 0 3pt; } .q ul, .q ol { margin: 0 0 3pt; }
  .passage { border-left: 2px solid #d5dae2; padding-left: 8pt; margin-bottom: 5pt; color: #2b3644; } .pt { font-weight: 600; }
  .fig { margin: 5pt 0; } .fig img { max-width: 62%; max-height: 62mm; }
  table.match { border-collapse: collapse; margin: 4pt 0 5pt; font-size: 10pt; }
  table.match th, table.match td { border: 1px solid #c6ccd6; padding: 2.5pt 8pt; text-align: left; vertical-align: top; }
  table.match th { background: #f1f4f8; font-weight: 600; }
  ol.opts { list-style: none; padding: 0; margin: 3pt 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 14pt; }
  ol.opts li { display: flex; gap: 5pt; } ol.opts .l { flex: none; color: #45505f; }
  ol.opts.long { grid-template-columns: 1fr; }
  .display { margin: 3pt 0; }
  code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f1f4f8; padding: 0 2pt; border-radius: 2pt; }
  .key { break-before: page; }
  .key h2 { font-size: 14pt; margin: 0 0 8pt; }
  .key table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  .key td { border: 1px solid #c6ccd6; padding: 3pt 6pt; width: 10%; text-align: center; }
  .key td b { color: #45505f; font-weight: 400; margin-right: 4pt; }
</style></head><body>
<header class="cover">
  <div class="brand"><span class="mark">CU</span> CUET Prep</div>
  <h1>${esc(d.subjectName)} practice paper, set ${d.set}</h1>
  <div class="meta">For CUET (UG), subject code ${esc(d.subjectCode)} · ${d.language} · ${p.questions} questions${p.durationMinutes ? ` · ${p.durationMinutes} minutes` : ''} · Prepared on ${day(generatedOn)}</div>
</header>
${d.reviewState === 'UNREVIEWED' ? `<div class="box preview"><h2>Preview: not yet reviewed</h2><p>${d.reviewedQuestions} of ${p.questions} questions in this paper have been approved by a subject expert. The rest are drafts and may contain errors.</p></div>` : ''}
<div class="box"><h2>Instructions</h2><ul>${instructions.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
<div class="box rights"><p><strong>About this paper.</strong> ${esc(d.rights.statement)} Syllabus coverage: ${d.units.map((u) => `${esc(u.title)} (${u.questions})`).join(', ')}.</p></div>
<main>${d.questions.map(question).join('\n')}</main>
<section class="key"><h2>Answer key</h2>
<table><tbody>${Array.from({ length: Math.ceil(d.answerKey.length / 10) }, (_, r) => `<tr>${d.answerKey.slice(r * 10, r * 10 + 10).map((a) => `<td><b>${a.number}.</b>(${esc(a.correct.join(', '))})</td>`).join('')}</tr>`).join('')}</tbody></table>
<p class="rights" style="margin-top:10pt">${esc(footer)}. © CUET Prep.</p></section>
<script>for (const o of document.querySelectorAll('ol.opts')) if ([...o.children].some((li) => li.textContent.length > 46 || li.querySelector('.katex-display'))) o.classList.add('long');</script>
</body></html>`;
}

function chromePath(): string {
  const found = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome was not found. Set CHROME_PATH to the Chrome program, which typesets the PDF.');
  return found;
}

async function pageCount(pdf: Uint8Array): Promise<number> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
  const n = (await task.promise).numPages;
  await task.destroy();
  return n;
}

/** Builds one practice paper: fetch its content, typeset it, store the PDF, record it. Returns what was made. */
export async function buildNativePaper(opts: { api: string; adminToken: string; paperId: string; set: number; count: number; workDir: string; repo: string }) {
  const admin = { 'x-admin-token': opts.adminToken, 'x-admin-actor': 'native-paper-cli' };
  const res = await fetch(`${opts.api}/api/admin/native-papers/draft?paperId=${encodeURIComponent(opts.paperId)}&count=${opts.count}&set=${opts.set}`, { headers: admin });
  if (!res.ok) throw new Error(`Could not get the paper's content: ${res.status} ${await res.text()}`);
  const draft = (await res.json()) as Draft;
  // Figures are our own media, read from our own storage and placed inside the PDF.
  const images = new Map<string, string>();
  for (const q of draft.questions) {
    const id = q.structure && typeof q.structure.mediaAssetId === 'string' ? q.structure.mediaAssetId : null;
    if (!id || images.has(id)) continue;
    const m = await fetch(`${opts.api}/api/learn/media/${id}`);
    if (!m.ok) throw new Error(`Question ${q.number}: its figure could not be read (${m.status}). The paper is not built with a figure missing.`);
    images.set(id, `data:${(m.headers.get('content-type') ?? 'image/svg+xml').split(';')[0]};base64,${Buffer.from(await m.arrayBuffer()).toString('base64')}`);
  }
  mkdirSync(opts.workDir, { recursive: true });
  const name = `${draft.exam}-${draft.subjectCode}-set-${draft.set}`;
  const htmlPath = join(opts.workDir, `${name}.html`);
  const pdfPath = join(opts.workDir, `${name}.pdf`);
  writeFileSync(htmlPath, paperHtml(draft, images, new Date()), 'utf8');
  execFileSync(chromePath(), ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files', '--virtual-time-budget=8000', `--print-to-pdf=${pdfPath}`, fileUrl(htmlPath)], { stdio: 'ignore', timeout: 120_000 });
  const pdf = readFileSync(pdfPath);
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Chrome did not produce a PDF');
  const pages = await pageCount(pdf);
  // The content that went into the PDF is kept beside the other content packs: it is ours.
  const packDir = join(opts.repo, 'content', 'native-papers');
  mkdirSync(packDir, { recursive: true });
  writeFileSync(join(packDir, `${name}.json`), `${JSON.stringify(draft, null, 1)}\n`, 'utf8');
  const up = await fetch(`${opts.api}/api/admin/files/media`, { method: 'PUT', headers: { ...admin, 'content-type': 'application/pdf' }, body: pdf });
  if (!up.ok) throw new Error(`Could not store the PDF: ${up.status} ${await up.text()}`);
  const stored = (await up.json()) as { r2Key: string; sha256: string; byteSize: number };
  const reg = await fetch(`${opts.api}/api/admin/native-papers`, {
    method: 'POST', headers: { ...admin, 'content-type': 'application/json' },
    body: JSON.stringify({ key: draft.key, exam: draft.exam, subjectCode: draft.subjectCode, subjectName: draft.subjectName, title: draft.title, language: draft.language, r2Key: stored.r2Key, pages, reviewState: draft.reviewState, rights: draft.rights, questionIds: draft.questions.map((q) => q.id) }),
  });
  if (!reg.ok) throw new Error(`Could not record the document: ${reg.status} ${await reg.text()}`);
  const types: Record<string, number> = {};
  for (const q of draft.questions) types[q.type] = (types[q.type] ?? 0) + 1;
  return {
    document: (await reg.json()) as { id: string; key: string; created: boolean },
    title: draft.title, questions: draft.questions.length, byType: types, figures: images.size, formulas: draft.questions.filter((q) => /\$/.test(q.stem + q.options.map((o) => o.text).join(''))).length,
    units: draft.units, reviewState: draft.reviewState, reviewedQuestions: draft.reviewedQuestions, pages, bytes: stored.byteSize, sha256: stored.sha256, r2Key: stored.r2Key, htmlPath, pdfPath,
  };
}
