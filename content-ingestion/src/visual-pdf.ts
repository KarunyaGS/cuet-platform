/**
 * Builds the downloadable learning PDF for a visual learning pack (prototype: Gravitation).
 *
 * The PDF is typeset from the same content and the same drawings the page uses, so the two cannot drift apart:
 * headings, text and formulas are real text (selectable), and every figure, the mind map and the flowchart are vector
 * drawings, not screenshots. A4, with page numbers. Only CUET Prep's own writing and drawings go in.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import katex from 'katex';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FallScene, fallTime, HeightDepthFigure, InverseSquareFigure, PairScene } from '../../frontend/src/visual/art';
import { FLOW_BOX, FlowDrawing } from '../../frontend/src/visual/flowdraw';
import { FLOW, FLOW_CHECK, FLOW_TITLE, FORMULAS, KEY_POINTS, MIND_MAP, NOTES, QUESTION, QUIZ, SIM, SOURCE, TITLE } from '../../frontend/src/visual/gravitation';
import { flatten, layoutMap, MapDrawing } from '../../frontend/src/visual/mapdraw';

const require = createRequire(import.meta.url);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tex = (t: string, display = false) => katex.renderToString(t, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore', trust: false });
const svg = (el: ReactElement) => renderToStaticMarkup(el);
/** Running text: escaped, with $...$ set as mathematics. */
const inl = (s: string) => s.split('$').map((part, i) => (i % 2 ? tex(part) : esc(part))).join('');
const fileUrl = (p: string) => pathToFileURL(p).href;

function formula(id: keyof typeof FORMULAS): string {
  const f = FORMULAS[id];
  return `<div class="formula"><div class="fname">${esc(f.name)}</div>${tex(f.latex, true)}<table class="sym">${f.symbols.map((s) => `<tr><td class="s">${tex(s.sym)}</td><td>${inl(s.means)}</td></tr>`).join('')}</table></div>`;
}

export function visualHtml(): string {
  const katexCss = fileUrl(require.resolve('katex/dist/katex.min.css'));
  const font = (w: number) => fileUrl(require.resolve(`@fontsource/ibm-plex-sans/${w}.css`));
  const map = layoutMap(MIND_MAP, new Set());
  const mapSvg = svg(h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${map.box.x} ${map.box.y} ${map.box.w} ${map.box.h}`, style: { fontFamily: '"IBM Plex Sans", sans-serif' } }, h(MapDrawing, { nodes: map.nodes })));
  const flowSvg = svg(h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${FLOW_BOX.w} ${FLOW_BOX.h}`, style: { fontFamily: '"IBM Plex Sans", sans-serif' } }, h(FlowDrawing, { nodes: FLOW, visited: new Set(FLOW.map((n) => n.id)) })));
  const figure = (kind: string) =>
    kind === 'fall' ? svg(h(FallScene, { id: 'pdf-fall', h: 3, s: 3, v: SIM.g * fallTime(3, SIM.g), m: SIM.mass.start, g: SIM.g, released: true, marks: [1, 2, 3, 4, 5, 6, 7].map((k) => 0.5 * SIM.g * (k * 0.1) ** 2) })) : kind === 'pair' ? svg(h(PairScene, { id: 'pdf-pair' })) : kind === 'inverse' ? svg(h(InverseSquareFigure, {})) : svg(h(HeightDepthFigure, {}));
  const caption: Record<string, string> = {
    fall: 'Figure: an apple dropped from 3 m. The dashed outlines show its position every 0.1 s: the gaps grow, because it accelerates. The force F = mg and the acceleration g point towards the earth.',
    pair: 'Figure: the earth pulls the apple and the apple pulls the earth with forces of the same size, along the line joining them. Not to scale.',
    inverse: 'Figure: the force falls as the square of the distance.',
    heightdepth: 'Figure: a body above the surface and a body below it.',
  };
  const sections = NOTES.map(
    (n) => `<section class="topic">
      <h2>${esc(n.heading)}</h2>
      ${n.paragraphs.map((p) => `<p>${inl(p)}</p>`).join('')}
      ${n.points ? `<ul>${n.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${n.figure ? `<figure class="fig ${n.figure}">${figure(n.figure)}<figcaption>${esc(caption[n.figure] ?? '')}</figcaption></figure>` : ''}
      ${n.formula ? formula(n.formula) : ''}
      ${n.heading.startsWith('6.') ? formula('depth') : ''}
      ${n.example ? `<div class="example"><div class="et">${esc(n.example.title)}</div><p>${inl(n.example.body)}</p></div>` : ''}
      <p class="src">Source: ${esc(SOURCE.publisher)} Class XI Physics, section ${esc(n.src.section)}, page ${n.src.page}</p>
    </section>`,
  ).join('');
  const ideas = flatten(MIND_MAP).filter((a) => a.depth > 0).map((a) => `<div class="idea${a.depth === 2 ? ' sub' : ''}" style="border-color:${a.color}"><b>${esc(a.node.label)}</b>${inl(a.node.text)}</div>`).join('');
  const flowSteps = FLOW.filter((n) => n.kind !== 'wrong').map((n) => `<li><b>${esc(n.title)}.</b> ${inl(n.kind === 'decision' ? `${n.ask ?? ''} No: the moon's acceleration is much smaller.` : n.text)}</li>`).join('');
  const check = (q: { question: string; choices: { text: string; correct: boolean; why: string }[] }, i: number) =>
    `<div class="check"><p><b>${i}. ${esc(q.question)}</b></p><ol type="A">${q.choices.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ol></div>`;
  const answer = (q: { choices: { text: string; correct: boolean; why: string }[] }, i: number) => {
    const k = q.choices.findIndex((c) => c.correct);
    return `<p><b>${i}. (${String.fromCharCode(65 + k)})</b> ${esc(q.choices[k]!.why.replace(/^Right\. /, ''))}</p>`;
  };
  const footer = `CUET Prep · ${TITLE}: learning notes · Written by CUET Prep from NCERT Class XI Physics, Chapter 7`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CUET Prep - ${esc(TITLE)} - learning notes</title>
<link rel="stylesheet" href="${katexCss}"><link rel="stylesheet" href="${font(400)}"><link rel="stylesheet" href="${font(600)}">
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm;
    @bottom-left { content: "${footer.replace(/"/g, '\\"')}"; font: 7.5pt "IBM Plex Sans", sans-serif; color: #5b6472; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt "IBM Plex Sans", sans-serif; color: #5b6472; } }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "IBM Plex Sans", "Segoe UI", sans-serif; color: #16202e; margin: 0; }
  header.cover { border-bottom: 2px solid #2347a8; padding-bottom: 10pt; margin-bottom: 12pt; }
  .brand { display: flex; align-items: center; gap: 8pt; font-weight: 600; font-size: 12pt; }
  .mark { display: inline-grid; place-items: center; width: 22pt; height: 22pt; border-radius: 6pt; background: #2347a8; color: #fff; font-size: 9pt; font-weight: 600; }
  h1 { font-size: 22pt; line-height: 1.2; margin: 10pt 0 2pt; font-weight: 600; }
  .lead { font-size: 13pt; color: #2347a8; font-weight: 600; margin: 4pt 0 0; }
  .meta { color: #45505f; font-size: 9.5pt; margin: 4pt 0 0; }
  .notice { border: 1px solid #e3c98a; background: #fff8e8; border-radius: 6pt; padding: 6pt 9pt; font-size: 9pt; margin: 8pt 0 0; }
  h2 { font-size: 13.5pt; margin: 0 0 4pt; font-weight: 600; color: #16202e; break-after: avoid; }
  h2.part { font-size: 15pt; color: #2347a8; border-bottom: 1px solid #d5dae2; padding-bottom: 3pt; margin: 0 0 8pt; }
  p { margin: 0 0 6pt; }
  ul, ol { margin: 0 0 6pt; padding-left: 16pt; }
  li { margin-bottom: 2pt; }
  section.topic { margin-bottom: 14pt; }
  figure.fig { margin: 8pt auto; break-inside: avoid; border: 1px solid #d5dae2; border-radius: 6pt; overflow: hidden; width: 118mm; }
  figure.fig.inverse, figure.fig.heightdepth { width: 132mm; }
  figure.fig svg { display: block; width: 100%; height: auto; }
  figcaption { font-size: 8.5pt; color: #45505f; padding: 4pt 8pt; border-top: 1px solid #d5dae2; background: #fff; }
  .formula { border: 1px solid #d5dae2; border-radius: 6pt; padding: 6pt 10pt; margin: 8pt 0; break-inside: avoid; background: #f7f9fc; }
  .fname { font-size: 9pt; font-weight: 600; color: #45505f; }
  .formula .katex-display { margin: 6pt 0; }
  table.sym { border-collapse: collapse; font-size: 9.5pt; }
  table.sym td { padding: 1.5pt 8pt 1.5pt 0; vertical-align: baseline; }
  table.sym td.s { white-space: nowrap; color: #2347a8; }
  .example { border-left: 3pt solid #2347a8; background: #edf1fa; padding: 6pt 10pt; margin: 8pt 0; break-inside: avoid; }
  .et { font-weight: 600; font-size: 10pt; margin-bottom: 2pt; }
  .example p { margin: 0; }
  .src { font-size: 8pt; color: #5b6472; margin-top: 4pt; }
  .page { break-before: page; }
  .diagram { break-inside: avoid; border: 1px solid #d5dae2; border-radius: 6pt; background: #f8fafd; padding: 4pt; }
  .diagram svg { display: block; width: 100%; height: auto; }
  .diagram.flow { width: 76mm; float: left; margin: 0 10pt 6pt 0; }
  .mapblock { break-inside: avoid; margin-top: 4pt; }
  .ideas { columns: 2; column-gap: 14pt; font-size: 9.5pt; margin-top: 6pt; }
  .idea { break-inside: avoid; margin-bottom: 6pt; padding-left: 7pt; border-left: 3pt solid #2347a8; }
  .idea.sub { margin-left: 10pt; border-left-width: 2pt; }
  .idea b { display: block; }
  .steps { font-size: 9.2pt; }
  .steps li { margin-bottom: 5pt; }
  .keys { border: 1px solid #d5dae2; border-radius: 6pt; padding: 8pt 10pt 4pt; break-inside: avoid; margin-bottom: 12pt; }
  .check { break-inside: avoid; margin-bottom: 6pt; }
  .answers { border-top: 1px solid #d5dae2; margin-top: 10pt; padding-top: 6pt; font-size: 9.5pt; break-inside: avoid; }
  .rights { font-size: 8.5pt; color: #45505f; border-top: 1px solid #d5dae2; margin-top: 12pt; padding-top: 6pt; }
</style></head><body>
<header class="cover">
  <div class="brand"><span class="mark">CU</span>CUET Prep</div>
  <h1>${esc(TITLE)}</h1>
  <p class="lead">${esc(QUESTION)}</p>
  <p class="meta">Physics · Learning notes with a mind map and a flowchart · Written from ${esc(SOURCE.publisher)}, ${esc(SOURCE.book)}, ${esc(SOURCE.chapter)} (${esc(SOURCE.edition)})</p>
  <p class="notice"><b>Preview: not yet reviewed.</b> These notes have not yet been checked by a subject expert. Gravitation is a Class 11 topic and is not in the CUET (UG) Physics syllabus; it is used here to try out this way of learning.</p>
</header>
${sections}
<div class="keys"><h2>Points to remember</h2><ul>${KEY_POINTS.map((p) => `<li>${inl(p)}</li>`).join('')}</ul></div>
<p class="rights">${esc(SOURCE.rights)} Source chapter: ${esc(SOURCE.url)}</p>

<div class="mapblock">
  <h2 class="part">Mind map: ${esc(TITLE)}</h2>
  <div class="diagram map">${mapSvg}</div>
  <p class="src">Each branch is one idea from the notes. Follow a branch outwards for its details. The ideas are listed below.</p>
</div>
<div class="ideas">${ideas}</div>

<div class="page">
  <h2 class="part">Flowchart: ${esc(FLOW_TITLE.toLowerCase())}</h2>
  <div class="diagram flow">${flowSvg}</div>
  <ol class="steps">${flowSteps}</ol>
  <div style="clear: both"></div>
  <h2 style="margin-top: 10pt">Check yourself</h2>
  ${check(QUIZ, 1)}${check(FLOW_CHECK, 2)}
  <div class="answers"><b>Answers</b>${answer(QUIZ, 1)}${answer(FLOW_CHECK, 2)}</div>
</div>
</body></html>`;
}

function chromePath(): string {
  const found = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome was not found. Set CHROME_PATH to the Chrome program, which typesets the PDF.');
  return found;
}

/** Typesets the PDF and puts it where the web app serves it from. Returns the path, the size and the page count. */
export async function buildVisualPdf(opts: { repo: string; workDir: string }) {
  mkdirSync(opts.workDir, { recursive: true });
  const htmlPath = join(opts.workDir, 'gravitation.html');
  const out = join(opts.repo, 'frontend', 'public', 'visual', 'gravitation.pdf');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(htmlPath, visualHtml(), 'utf8');
  execFileSync(chromePath(), ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files', '--virtual-time-budget=8000', `--print-to-pdf=${out}`, fileUrl(htmlPath)], { stdio: 'ignore', timeout: 120_000 });
  const pdf = readFileSync(out);
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Chrome did not produce a PDF');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
  const doc = await task.promise;
  const pages = doc.numPages;
  let text = '';
  for (let i = 1; i <= pages; i++) text += ` ${(await (await doc.getPage(i)).getTextContent()).items.map((x) => ('str' in x ? x.str : '')).join(' ')}`;
  await task.destroy();
  return { path: out, bytes: pdf.length, pages, selectableCharacters: text.replace(/\s+/g, ' ').length };
}
