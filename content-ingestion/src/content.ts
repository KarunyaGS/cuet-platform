/**
 * Content packs: authored learning material and questions for one verified syllabus row each.
 *
 *   content/syllabus/<EXAM>/<code>.json          snapshot of the verified syllabus rows (ids, text, source page)
 *   content/packs/<EXAM>/<code>/<slug>.json       one pack per syllabus row: lesson + diagrams + questions
 *   content/packs/<EXAM>/<code>/diagrams/*.svg    diagrams drawn for those packs
 *
 * `content-validate` refuses anything incomplete, unsafe or duplicated; `content-import` loads valid packs
 * into local D1/R2 as DRAFT / UNVERIFIED, labelled AI_ASSISTED. Nothing here can mark content VERIFIED.
 * Format: docs/content-packs.md
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import katex from 'katex';

export const CONTENT_ROOT = join(import.meta.dirname, '..', '..', 'content');

// ------------------------------------------------------------------ types
export type TextBlockType = 'TEXT' | 'CONCEPT' | 'KEY_POINT' | 'IMPORTANT_FACT' | 'EXAMPLE' | 'CALLOUT';
export type PackBlock =
  | { type: 'HEADING'; text: string }
  | { type: TextBlockType; text: string }
  | { type: 'DEFINITION'; term: string; text: string }
  | { type: 'FORMULA'; latex: string; text?: string }
  | { type: 'TABLE'; caption?: string; columns: string[]; rows: string[][] }
  | { type: 'DIAGRAM'; diagram: string }
  | { type: 'SOLVED_PROBLEM'; problem: string; solution: string; answer: string };

export interface PackQuestion {
  key: string;
  type: 'MCQ_SINGLE' | 'ASSERTION_REASON' | 'MATCH_THE_FOLLOWING' | 'STATEMENT_BASED' | 'DIAGRAM_BASED';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  skill: 'conceptual' | 'numerical' | 'application' | 'analytical';
  stem: string;
  list?: { left: string[]; right: string[] };
  diagram?: string;
  options: string[];
  answer: number;
  explanation: string;
  optionRationale?: Record<string, string>;
  objective: string;
}

export interface Pack {
  schema: 'cuet-content-pack/1';
  exam: 'CUET_UG' | 'CUET_PG';
  year: number;
  paperCode: string;
  origin: 'AI_ASSISTED';
  node: { id: string; title: string };
  lesson: { key: string; title: string; coverage: { phrase: string; section: string }[]; blocks: PackBlock[] };
  diagrams: { key: string; file: string; alt: string; caption: string; description: string }[];
  questions: PackQuestion[];
}

export interface SyllabusSnapshot {
  exam: string;
  year: number;
  paperCode: string;
  paperName: string;
  paperId: string;
  versionId: string;
  versionVerification: string;
  exportedAt: string;
  nodes: { id: string; parentId: string | null; kind: string; label: string | null; title: string; body: string | null; sourcePage: number | null; verification: string; depth: number; position: number }[];
}

export const AR_OPTIONS = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A).',
  'Both (A) and (R) are true but (R) is not the correct explanation of (A).',
  '(A) is true but (R) is false.',
  '(A) is false but (R) is true.',
];

// ------------------------------------------------------------------ helpers
const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\$[^$]*\$/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (s: string) => (s.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const STOP = new Set('the and for with from that this their them its into onto using use used only ideas idea including include elementary facts about qualitative treatment expression simple between due through under along also other such which where what when than then there these those each both some very more most much many have has had been being were was are is be of in on at to by as an or a its it'.split(' '));
const sig = (s: string) => [...new Set((norm(s).match(/[\p{L}]{4,}/gu) ?? []).filter((w) => !STOP.has(w)))];
const PLACEHOLDER = /\b(lorem ipsum|placeholder|todo|tbd|to be added|coming soon|insert (?:diagram|image|figure) here|xxx)\b/i;

/** Every $...$ / $$...$$ in Markdown text must be valid KaTeX. Returns error messages. */
function mathErrors(text: string, where: string): string[] {
  const errs: string[] = [];
  const display = [...text.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => m[1]!);
  const rest = text.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const dollars = (rest.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2) errs.push(`${where}: unbalanced $ in inline maths`);
  const inline = [...rest.matchAll(/(?<!\\)\$([^$]+?)(?<!\\)\$/g)].map((m) => m[1]!);
  for (const tex of [...display, ...inline]) {
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: false, strict: 'ignore' });
    } catch (e) {
      errs.push(`${where}: maths does not render (${(e as Error).message.slice(0, 120)}): ${tex.slice(0, 80)}`);
    }
  }
  return errs;
}

function svgErrors(svg: string, file: string): string[] {
  const errs: string[] = [];
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) errs.push(`${file}: does not start with <svg>`);
  if (!/viewBox\s*=\s*"[\d.\s-]+"/.test(svg)) errs.push(`${file}: needs a numeric viewBox`);
  if (/<script|<foreignObject|\son\w+\s*=|javascript:|<iframe|<image\b|xlink:href\s*=\s*"(?!#)|href\s*=\s*"(?!#)/i.test(svg)) errs.push(`${file}: scripts, event handlers, embedded images and external links are not allowed`);
  if (svg.length > 200_000) errs.push(`${file}: larger than 200 KB`);
  if ((svg.match(/<text\b/g) ?? []).length < 2) errs.push(`${file}: a diagram needs labels (at least two <text> elements)`);
  if (PLACEHOLDER.test(svg)) errs.push(`${file}: contains placeholder text`);
  return errs;
}

export function packFiles(exam?: string, paper?: string): string[] {
  const root = join(CONTENT_ROOT, 'packs');
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const e of readdirSync(root)) {
    if (exam && e !== exam) continue;
    for (const p of readdirSync(join(root, e))) {
      if (paper && p !== paper) continue;
      const dir = join(root, e, p);
      if (!statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir)) if (f.endsWith('.json')) out.push(join(dir, f));
    }
  }
  return out.sort();
}

export function loadSnapshot(exam: string, paper: string): SyllabusSnapshot {
  const f = join(CONTENT_ROOT, 'syllabus', exam, `${paper}.json`);
  if (!existsSync(f)) throw new Error(`No syllabus snapshot for ${exam} ${paper}: run npm run ingest -- content-snapshot --exam ${exam} --paper ${paper}`);
  return JSON.parse(readFileSync(f, 'utf8')) as SyllabusSnapshot;
}

// ------------------------------------------------------------------ validation
export interface PackReport {
  file: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { lessonWords: number; blocks: number; solved: number; formulas: number; diagrams: number; tables: number; questions: number; byType: Record<string, number>; byDifficulty: Record<string, number> };
}

export function validatePack(file: string, snapshotCache = new Map<string, SyllabusSnapshot>(), seenStems = new Map<string, string>(), seenKeys = new Map<string, string>()): PackReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: PackReport['stats'] = { lessonWords: 0, blocks: 0, solved: 0, formulas: 0, diagrams: 0, tables: 0, questions: 0, byType: {}, byDifficulty: {} };
  let pack: Pack;
  try {
    pack = JSON.parse(readFileSync(file, 'utf8')) as Pack;
  } catch (e) {
    return { file, ok: false, errors: [`not valid JSON: ${(e as Error).message}`], warnings, stats };
  }
  const err = (m: string) => errors.push(m);
  if (pack.schema !== 'cuet-content-pack/1') err('schema must be "cuet-content-pack/1"');
  if (pack.origin !== 'AI_ASSISTED') err('origin must be AI_ASSISTED (it is labelled as such until a subject expert approves it)');
  const snapKey = `${pack.exam}/${pack.paperCode}`;
  let snap = snapshotCache.get(snapKey);
  if (!snap) {
    try {
      snap = loadSnapshot(pack.exam, pack.paperCode);
      snapshotCache.set(snapKey, snap);
    } catch (e) {
      return { file, ok: false, errors: [(e as Error).message], warnings, stats };
    }
  }
  const node = snap.nodes.find((n) => n.id === pack.node?.id);
  if (!node) err(`node.id ${pack.node?.id} is not a verified syllabus row of ${snapKey}`);
  else if (node.verification !== 'MACHINE_VERIFIED' && node.verification !== 'VERIFIED') err(`syllabus row ${node.id} is not verified`);
  const dir = dirname(file);
  const claim = (k: string, what: string) => {
    if (!/^[a-z0-9][a-z0-9._:-]{2,150}$/.test(k)) err(`${what} key "${k}" must be lowercase letters, digits, . _ : -`);
    const prev = seenKeys.get(k);
    if (prev && prev !== file) err(`${what} key "${k}" is also used in ${basename(prev)}`);
    seenKeys.set(k, file);
  };

  // ---- lesson
  const L = pack.lesson;
  if (!L?.key || !L.title || !Array.isArray(L.blocks)) err('lesson needs key, title and blocks');
  else {
    claim(L.key, 'lesson');
    const headings = new Set<string>();
    const diagramKeys = new Set((pack.diagrams ?? []).map((d) => d.key));
    const usedDiagrams = new Set<string>();
    L.blocks.forEach((b, i) => {
      const at = `lesson block ${i + 1} (${b.type})`;
      stats.blocks++;
      const texts: string[] = [];
      switch (b.type) {
        case 'HEADING':
          if (!b.text?.trim()) err(`${at}: empty heading`);
          headings.add(norm(b.text ?? ''));
          texts.push(b.text);
          break;
        case 'DEFINITION':
          if (!b.term?.trim() || !b.text?.trim()) err(`${at}: needs term and text`);
          texts.push(b.term, b.text);
          break;
        case 'FORMULA':
          stats.formulas++;
          try {
            katex.renderToString(b.latex, { throwOnError: true, displayMode: true, strict: 'ignore' });
          } catch (e) {
            err(`${at}: LaTeX does not render (${(e as Error).message.slice(0, 120)})`);
          }
          if (b.text) texts.push(b.text);
          break;
        case 'TABLE':
          stats.tables++;
          if (!Array.isArray(b.columns) || b.columns.length < 2) err(`${at}: needs at least two columns`);
          if (!Array.isArray(b.rows) || b.rows.length < 2) err(`${at}: needs at least two rows`);
          for (const r of b.rows ?? []) if (r.length !== b.columns.length) err(`${at}: a row has ${r.length} cells, expected ${b.columns.length}`);
          texts.push(...(b.columns ?? []), ...(b.rows ?? []).flat(), b.caption ?? '');
          break;
        case 'DIAGRAM':
          stats.diagrams++;
          if (!diagramKeys.has(b.diagram)) err(`${at}: diagram "${b.diagram}" is not declared in diagrams[]`);
          usedDiagrams.add(b.diagram);
          break;
        case 'SOLVED_PROBLEM':
          stats.solved++;
          if (!b.problem?.trim() || !b.solution?.trim() || !b.answer?.trim()) err(`${at}: needs problem, solution and answer`);
          if (words(b.solution ?? '') < 25) err(`${at}: the solution must show the working (at least 25 words)`);
          texts.push(b.problem, b.solution, b.answer);
          break;
        case 'TEXT': case 'CONCEPT': case 'KEY_POINT': case 'IMPORTANT_FACT': case 'EXAMPLE': case 'CALLOUT':
          if (!b.text?.trim()) err(`${at}: empty text`);
          texts.push(b.text);
          break;
        default:
          err(`${at}: unknown block type`);
      }
      for (const t of texts) {
        if (!t) continue;
        stats.lessonWords += words(t);
        errors.push(...mathErrors(t, at));
        if (PLACEHOLDER.test(t)) err(`${at}: contains placeholder text`);
      }
    });
    for (const d of pack.diagrams ?? []) if (!usedDiagrams.has(d.key)) err(`diagram "${d.key}" is declared but not used in the lesson`);
    // Coverage: every concept the syllabus row names must be taught under a heading of this lesson.
    if (!Array.isArray(L.coverage) || !L.coverage.length) err('lesson.coverage must map each syllabus phrase to the heading that teaches it');
    else {
      for (const c of L.coverage) if (!headings.has(norm(c.section))) err(`coverage: section "${c.section}" is not a HEADING in the lesson`);
      if (node) {
        const covered = new Set(sig(L.coverage.map((c) => c.phrase).join(' ')));
        const missing = sig(`${node.title} ${node.body ?? ''}`).filter((w) => !covered.has(w));
        if (missing.length) err(`coverage: these words of the syllabus row are not covered by any phrase: ${missing.join(', ')}`);
      }
    }
    if (stats.lessonWords < 900) err(`lesson has ${stats.lessonWords} words; a complete lesson needs at least 900 (most need 1,500+)`);
    if (stats.solved < 2) err(`lesson needs at least 2 solved problems or worked examples (has ${stats.solved})`);
    if (!L.blocks.some((b) => b.type === 'DEFINITION')) err('lesson needs at least one DEFINITION');
    if (!L.blocks.some((b) => b.type === 'KEY_POINT' || b.type === 'IMPORTANT_FACT')) err('lesson needs KEY_POINT / IMPORTANT_FACT revision points');
    if (!L.blocks.some((b) => b.type === 'CALLOUT')) warnings.push('no CALLOUT (exam tips / common mistakes)');
    if (headings.size < 3) err('lesson needs at least 3 HEADING sections');
  }

  // ---- diagrams
  for (const d of pack.diagrams ?? []) {
    claim(`${L?.key ?? 'x'}.${d.key}`, 'diagram');
    const f = join(dir, d.file);
    if (!d.alt || d.alt.length < 20) err(`diagram ${d.key}: alt text must describe the figure (20+ characters)`);
    if (!d.caption) err(`diagram ${d.key}: needs a caption`);
    if (!existsSync(f)) err(`diagram ${d.key}: file ${d.file} not found`);
    else errors.push(...svgErrors(readFileSync(f, 'utf8'), d.file));
  }

  // ---- questions
  const qs = pack.questions ?? [];
  stats.questions = qs.length;
  if (qs.length < 10) err(`needs at least 10 questions for this syllabus row (has ${qs.length})`);
  const diagramKeys = new Set((pack.diagrams ?? []).map((d) => d.key));
  for (const [i, q] of qs.entries()) {
    const at = `question ${i + 1} (${q.key})`;
    claim(q.key, 'question');
    stats.byType[q.type] = (stats.byType[q.type] ?? 0) + 1;
    stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] ?? 0) + 1;
    if (!['MCQ_SINGLE', 'ASSERTION_REASON', 'MATCH_THE_FOLLOWING', 'STATEMENT_BASED', 'DIAGRAM_BASED'].includes(q.type)) err(`${at}: unknown type`);
    if (!['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty)) err(`${at}: difficulty must be EASY, MEDIUM or HARD`);
    if (!['conceptual', 'numerical', 'application', 'analytical'].includes(q.skill)) err(`${at}: skill must be conceptual, numerical, application or analytical`);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(`${at}: CUET questions have exactly 4 options`);
    else {
      // Compare options with their maths kept: "$2\pi$" and "$4\pi$" are different options.
      const optKey = (o: string) => o.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
      if (new Set(q.options.map(optKey)).size !== 4 && q.type !== 'MATCH_THE_FOLLOWING') err(`${at}: options must all be different`);
      if (q.options.some((o) => !o?.trim())) err(`${at}: empty option`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 1 || q.answer > 4) err(`${at}: answer must be the option number 1-4`);
    if (!q.stem || words(q.stem) < 6) err(`${at}: stem too short`);
    if (!q.explanation || words(q.explanation) < 30) err(`${at}: explanation must explain the answer (30+ words)`);
    if (!q.objective) err(`${at}: needs a learning objective`);
    if (q.type === 'ASSERTION_REASON') {
      if (!/Assertion \(A\)/.test(q.stem) || !/Reason \(R\)/.test(q.stem)) err(`${at}: stem must contain "Assertion (A):" and "Reason (R):"`);
      if (JSON.stringify(q.options) !== JSON.stringify(AR_OPTIONS)) err(`${at}: use the four standard assertion-reason options exactly`);
    }
    if (q.type === 'MATCH_THE_FOLLOWING') {
      if (!q.list || q.list.left?.length < 3 || q.list.left.length !== q.list.right?.length) err(`${at}: needs list.left and list.right of equal length (3+)`);
      if (q.options?.some((o) => !/^[A-D]\s*-\s*[IVX]+(\s*,\s*[A-D]\s*-\s*[IVX]+)+$/.test(o.trim()))) err(`${at}: options must be codes like "A-II, B-IV, C-I, D-III"`);
      if (new Set((q.options ?? []).map((o) => o.replace(/\s/g, ''))).size !== 4) err(`${at}: options must all be different`);
    }
    if (q.type === 'STATEMENT_BASED' && !/(^|\n)\s*(A|1|I)[.)]/m.test(q.stem)) err(`${at}: list the statements (A. B. C. ...) in the stem`);
    if (q.type === 'DIAGRAM_BASED' && (!q.diagram || !diagramKeys.has(q.diagram))) err(`${at}: DIAGRAM_BASED questions must reference a declared diagram`);
    if (q.diagram && !diagramKeys.has(q.diagram)) err(`${at}: diagram "${q.diagram}" is not declared`);
    for (const t of [q.stem, q.explanation, ...(q.options ?? []), ...(q.list?.left ?? []), ...(q.list?.right ?? [])]) {
      if (!t) continue;
      errors.push(...mathErrors(t, at));
      if (PLACEHOLDER.test(t)) err(`${at}: contains placeholder text`);
    }
    const stemKey = norm(q.stem ?? '') + '|' + (q.options ?? []).map(norm).sort().join('|');
    const prev = seenStems.get(stemKey);
    if (prev) err(`${at}: duplicates a question in ${basename(prev)}`);
    seenStems.set(stemKey, file);
  }
  if (qs.length) {
    const share = (d: string) => (stats.byDifficulty[d] ?? 0) / qs.length;
    if (share('EASY') < 0.15 || share('MEDIUM') < 0.25 || share('HARD') < 0.15) err(`difficulty mix ${JSON.stringify(stats.byDifficulty)}: needs at least 15% easy, 25% medium and 15% hard`);
    const answers = qs.map((q) => q.answer);
    for (const a of [1, 2, 3, 4]) if (answers.filter((x) => x === a).length / qs.length > 0.45) warnings.push(`option ${a} is the answer to ${Math.round((100 * answers.filter((x) => x === a).length) / qs.length)}% of questions`);
    const types = Object.keys(stats.byType).length;
    if (types < 3) err(`use at least 3 question formats (has ${types})`);
  }
  return { file, ok: errors.length === 0, errors, warnings, stats };
}

export function validateAll(exam?: string, paper?: string) {
  const cache = new Map<string, SyllabusSnapshot>();
  const stems = new Map<string, string>();
  const keys = new Map<string, string>();
  const reports = packFiles(exam, paper).map((f) => validatePack(f, cache, stems, keys));
  nearDuplicates(reports);
  return reports;
}

/**
 * Reworded copies: questions in the same paper whose stem + options share at least 70% of their words
 * (Jaccard >= 0.7; numbers count, so the same idea with different values scores lower). Reported as warnings
 * for a person to judge: two questions may legitimately test the same idea from different angles.
 */
function nearDuplicates(reports: PackReport[]) {
  const items: { file: string; key: string; paper: string; words: Set<string> }[] = [];
  for (const r of reports) {
    try {
      const p = JSON.parse(readFileSync(r.file, 'utf8')) as Pack;
      for (const q of p.questions ?? []) {
        // Standard assertion-reason options and match codes are shared by design, so they are left out.
        const own = q.type === 'ASSERTION_REASON' ? '' : q.type === 'MATCH_THE_FOLLOWING' ? [...(q.list?.left ?? []), ...(q.list?.right ?? [])].join(' ') : (q.options ?? []).join(' ');
        const text = `${q.stem} ${own}`.normalize('NFKC').toLowerCase();
        items.push({ file: r.file, key: q.key, paper: `${p.exam}/${p.paperCode}`, words: new Set(text.match(/[\p{L}\p{N}]{2,}/gu) ?? []) });
      }
    } catch {
      /* invalid JSON is already reported */
    }
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (a.paper !== b.paper || a.words.size < 6 || b.words.size < 6) continue;
      let inter = 0;
      for (const w of a.words) if (b.words.has(w)) inter++;
      const sim = inter / (a.words.size + b.words.size - inter);
      if (sim >= 0.7) reports.find((r) => r.file === b.file)!.warnings.push(`question ${b.key} is ${Math.round(sim * 100)}% similar to ${a.key} (${basename(a.file)}): check it is not a reworded copy`);
    }
  }
}

// ------------------------------------------------------------------ SVG preview (for authors to look at their diagram)
export async function renderSvg(svgFile: string, pngFile: string, width = 900) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const img = await loadImage(readFileSync(svgFile));
  const scale = width / img.width;
  const canvas = createCanvas(width, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  mkdirSync(dirname(pngFile), { recursive: true });
  writeFileSync(pngFile, canvas.toBuffer('image/png'));
  return { width: canvas.width, height: canvas.height };
}

// ------------------------------------------------------------------ snapshot + import (through the local admin API)
async function call(api: string, token: string, method: string, path: string, body?: unknown, contentType = 'application/json') {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'x-admin-token': token, 'x-admin-actor': 'content-cli', 'content-type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : (body as NonNullable<RequestInit['body']>),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as Record<string, unknown>;
}

export async function snapshot(api: string, token: string, exam: string, year: number, paper: string) {
  const list = await call(api, token, 'GET', `/api/admin/papers?exam=${exam}&year=${year}&q=${encodeURIComponent(paper)}&pageSize=50`);
  const item = (list['items'] as { id: string; code: string; name: string; syllabusVersions: { id: string; verification: string }[] }[]).find((p) => p.code === paper);
  if (!item) throw new Error(`Paper ${exam} ${paper} not found`);
  const v = item.syllabusVersions[0];
  if (!v || !['MACHINE_VERIFIED', 'VERIFIED'].includes(v.verification)) throw new Error(`${exam} ${paper} has no verified syllabus version yet (latest: ${v?.verification ?? 'none'}); content is written only for verified syllabus`);
  const data = await call(api, token, 'GET', `/api/admin/syllabus-versions/${v.id}/nodes`);
  const nodes = (data['nodes'] as SyllabusSnapshot['nodes']).filter((n) => n.verification === 'MACHINE_VERIFIED' || n.verification === 'VERIFIED');
  const snap: SyllabusSnapshot = {
    exam, year, paperCode: paper, paperName: item.name, paperId: item.id, versionId: v.id, versionVerification: v.verification, exportedAt: new Date().toISOString(),
    nodes: nodes.map(({ id, parentId, kind, label, title, body, sourcePage, verification, depth, position }) => ({ id, parentId, kind, label, title, body, sourcePage, verification, depth, position })),
  };
  const f = join(CONTENT_ROOT, 'syllabus', exam, `${paper}.json`);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(snap, null, 1) + '\n');
  return { file: f, rows: snap.nodes.length };
}

const md = (o: unknown) => JSON.stringify(o);

export async function importPacks(api: string, token: string, exam?: string, paper?: string) {
  const reports = validateAll(exam, paper);
  const bad = reports.filter((r) => !r.ok);
  const out = { packs: 0, invalid: bad.length, lessons: {} as Record<string, number>, questions: {} as Record<string, number>, media: {} as Record<string, number> };
  const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  for (const rep of reports.filter((r) => r.ok)) {
    const pack = JSON.parse(readFileSync(rep.file, 'utf8')) as Pack;
    const snap = loadSnapshot(pack.exam, pack.paperCode);
    const mediaIds = new Map<string, string>();
    for (const d of pack.diagrams) {
      const bytes = readFileSync(join(dirname(rep.file), d.file));
      const svg = bytes.toString('utf8');
      const vb = /viewBox\s*=\s*"\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
      const stored = await call(api, token, 'PUT', '/api/admin/files/media', bytes, 'image/svg+xml');
      const r = await call(api, token, 'PUT', `/api/admin/content/media/${pack.lesson.key}.${d.key}`, {
        kind: 'DIAGRAM', r2Key: stored['r2Key'], sha256: createHash('sha256').update(bytes).digest('hex'), mimeType: 'image/svg+xml', byteSize: bytes.length,
        width: vb ? Math.round(Number(vb[1])) : null, height: vb ? Math.round(Number(vb[2])) : null,
        altText: d.alt, caption: d.caption, longDescription: d.description || null, curriculumNodeId: pack.node.id,
        origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', attribution: 'AI-assisted diagram drawn for this platform; awaiting subject-expert review',
      });
      mediaIds.set(d.key, String(r['id']));
      bump(out.media, String(r['outcome']));
    }
    const blocks = pack.lesson.blocks.map((b) => {
      switch (b.type) {
        case 'HEADING': return { type: 'HEADING', body: b.text };
        case 'DEFINITION': return { type: 'DEFINITION', body: md({ term: b.term, text: b.text }) };
        case 'FORMULA': return { type: 'FORMULA', body: md({ latex: b.latex, text: b.text ?? null }) };
        case 'TABLE': return { type: 'TABLE', body: md({ caption: b.caption ?? null, columns: b.columns, rows: b.rows }) };
        case 'SOLVED_PROBLEM': return { type: 'SOLVED_PROBLEM', body: md({ problem: b.problem, solution: b.solution, answer: b.answer }) };
        case 'DIAGRAM': {
          const d = pack.diagrams.find((x) => x.key === b.diagram)!;
          return { type: 'DIAGRAM', body: d.caption, mediaAssetId: mediaIds.get(b.diagram) };
        }
        default: return { type: b.type, body: b.text };
      }
    });
    const node = snap.nodes.find((n) => n.id === pack.node.id)!;
    const official = { type: 'OFFICIAL_TEXT', body: md({ text: [node.title, node.body].filter(Boolean).join(' '), page: node.sourcePage, paper: `${snap.paperName} (${snap.paperCode})` }) };
    const res = await call(api, token, 'PUT', `/api/admin/content/resources/${pack.lesson.key}`, {
      curriculumNodeId: pack.node.id, testPaperId: snap.paperId, type: 'LESSON', title: pack.lesson.title, language: 'en', origin: 'AI_ASSISTED',
      usagePermissionId: 'perm_owned', isDemonstration: false, blocks: [official, ...blocks],
    });
    bump(out.lessons, String(res['outcome']));
    for (const q of pack.questions) {
      const stem = q.type === 'MATCH_THE_FOLLOWING' && q.list ? q.stem : q.stem;
      const r = await call(api, token, 'PUT', `/api/admin/content/questions/${q.key}`, {
        testPaperId: snap.paperId, type: q.type, stem, language: 'en', difficulty: q.difficulty, learningObjective: `[${q.skill}] ${q.objective}`,
        structureJson: q.list || q.diagram ? JSON.stringify({ ...(q.list ? { left: q.list.left, right: q.list.right } : {}), ...(q.diagram ? { mediaAssetId: mediaIds.get(q.diagram) } : {}) }) : null,
        origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false,
        options: q.options.map((text, i) => ({ label: String.fromCharCode(65 + i), text })),
        answer: { correctOptionPositions: [q.answer] },
        explanation: { body: q.explanation, ...(q.optionRationale ? { optionRationale: q.optionRationale } : {}) },
        topicNodeIds: [pack.node.id],
      });
      bump(out.questions, String(r['outcome']));
    }
    out.packs++;
  }
  return { ...out, invalidFiles: bad.map((b) => `${basename(b.file)}: ${b.errors.slice(0, 3).join(' | ')}`) };
}
