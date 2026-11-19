/**
 * Quick revision sheets: a one-page sheet for a chapter, a three-page last-day sheet for a subject, and a sheet of a student's own weak
 * topics. Nothing is stored. Each sheet is picked, on request, from the lessons as they stand now (so it follows any change to a lesson)
 * with the existing revision notes and chapter visuals. A sheet is a draft until every lesson it uses is verified. No AI calls.
 */
import { sha256Hex, normaliseText } from '../lib/hash';
import { comparisonTable } from './concepts';
import { paperOutline, VISIBLE_CONTENT } from './learning';
import { progress } from './practice';
import { chapterVisuals, revisionNotes } from './student-tools';

type Note = { type: string; body: string };
export interface SheetFigure { mediaAssetId: string; caption: string; alt: string; learn: string | null }
export interface SheetTable { caption: string; columns: string[]; rows: string[][] }
export interface SheetSection {
  id: string; title: string;
  /** Present on a weak-topic sheet: the student's own practice result for this topic. */
  practice: { attempted: number; correct: number; accuracy: number } | null;
  definitions: Note[]; formulas: Note[]; points: Note[]; figures: SheetFigure[]; tables: SheetTable[];
}
export interface Sheet {
  kind: 'CHAPTER' | 'SUBJECT' | 'WEAK';
  title: string; paper: string | null; paperId: string | null;
  /** Always true until every lesson used is verified. */
  draft: boolean; lessons: number; version: string; maxPages: number; sections: SheetSection[]; empty: string | null;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')} ...`);
const strip = (t: string) => t.replace(/\s+/g, ' ').trim();
const SUMMARY = /revision|summary|recap|checklist|strategy|to remember|formula sheet/i;

interface Limits { defs: number; formulas: number; points: number; figures: number; tables: number; chars: number }
const CHAPTER: Limits = { defs: 6, formulas: 8, points: 6, figures: 2, tables: 1, chars: 260 };

/** The essentials of one topic or chapter, without repeating anything. */
async function pick(db: D1Database, preview: boolean, nodeId: string, lim: Limits) {
  const [notes, vis] = await Promise.all([revisionNotes(db, preview, nodeId), lim.figures || lim.tables ? chapterVisuals(db, preview, nodeId) : null]);
  const seen = new Set<string>();
  const fresh = (b: Note) => {
    const k = normaliseText(b.body);
    if (!b.body.trim() || seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  const all = notes.lessons.flatMap((l) => l.blocks);
  const short = (b: { type: string; body: string }): Note => {
    if (b.body.startsWith('{') || b.body.startsWith('[')) {
      try {
        const value: unknown = JSON.parse(b.body);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const fields = value as Record<string, unknown>;
          if (b.type === 'DEFINITION' && typeof fields.term === 'string' && typeof fields.text === 'string') {
            return { type: b.type, body: JSON.stringify({ term: strip(fields.term), text: clip(strip(fields.text), lim.chars) }) };
          }
          if (b.type === 'FORMULA' && typeof fields.latex === 'string') {
            return { type: b.type, body: JSON.stringify({ latex: fields.latex, text: typeof fields.text === 'string' ? clip(strip(fields.text), lim.chars) : null }) };
          }
          if (typeof fields.text === 'string') return { type: b.type, body: clip(strip(fields.text), lim.chars) };
          return { type: b.type, body: JSON.stringify(value) };
        }
        return { type: b.type, body: JSON.stringify(value) };
      } catch {
        // Older notes may contain malformed JSON; fall back to a readable plain-text excerpt.
      }
    }
    return { type: b.type, body: clip(strip(b.body), lim.chars) };
  };
  const defs = all.filter((b) => b.type === 'DEFINITION' && fresh(b)).slice(0, lim.defs).map(short);
  const formulas = all.filter((b) => b.type === 'FORMULA' && fresh(b)).slice(0, lim.formulas).map(short);
  const points = all
    .filter((b) => (b.type === 'KEY_POINT' || b.type === 'IMPORTANT_FACT') && b.body.length < 600 && !SUMMARY.test(b.body.slice(0, 40)) && fresh(b))
    .slice(0, lim.points)
    .map(short);
  const figures: SheetFigure[] = [];
  const tables: SheetTable[] = [];
  for (const i of vis?.items ?? []) {
    if (i.kind === 'DIAGRAM' && i.mediaAssetId && figures.length < lim.figures && i.learn) figures.push({ mediaAssetId: i.mediaAssetId, caption: i.caption, alt: i.alt, learn: clip(i.learn, 200) });
    if (i.kind === 'TABLE' && tables.length < lim.tables) {
      const t = comparisonTable(JSON.stringify(i.table));
      if (t && t.columns.length <= 4) tables.push({ caption: t.caption, columns: t.columns, rows: t.rows.slice(0, 5).map((r) => [r.label, ...r.values].map((c) => clip(c, 90))) });
    }
  }
  return { notes, defs, formulas, points, figures, tables };
}

async function lessonState(db: D1Database, preview: boolean, nodeIds: string[]) {
  if (!nodeIds.length) return { lessons: 0, verified: true, stamp: '' };
  const { results } = await db
    .prepare(
      `WITH RECURSIVE sub(id) AS (SELECT value FROM json_each(?2) UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
       SELECT r.id, r.version, r.verification FROM learning_resources r WHERE r.type = 'LESSON' AND r.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('r')} ORDER BY r.id`,
    )
    .bind(preview ? 1 : 0, JSON.stringify(nodeIds))
    .all<{ id: string; version: number; verification: string }>();
  return { lessons: results.length, verified: results.length > 0 && results.every((r) => r.verification === 'VERIFIED'), stamp: results.map((r) => `${r.id}:${r.version}`).join(',') };
}

async function finish(db: D1Database, preview: boolean, s: Omit<Sheet, 'draft' | 'lessons' | 'version'>, scope: string[]): Promise<Sheet> {
  const st = await lessonState(db, preview, scope);
  const version = (await sha256Hex(`${st.stamp}|${JSON.stringify(s.sections)}`)).slice(0, 8);
  return { ...s, draft: !st.verified, lessons: st.lessons, version };
}

/** One page for one chapter (or topic): definitions, formulas, key points, up to two figures and a comparison table. */
export async function chapterSheet(db: D1Database, preview: boolean, nodeId: string): Promise<Sheet> {
  const p = await pick(db, preview, nodeId, CHAPTER);
  const t = p.notes.topic;
  const empty = p.defs.length + p.formulas.length + p.points.length + p.figures.length + p.tables.length === 0 ? 'This chapter has no lessons to make a sheet from yet.' : null;
  return finish(db, preview, {
    kind: 'CHAPTER', title: String(t.title), paper: t.paper as string | null, paperId: t.paperId as string | null, maxPages: 1, empty,
    sections: [{ id: String(t.id), title: String(t.title), practice: null, definitions: p.defs, formulas: p.formulas, points: p.points, figures: p.figures, tables: p.tables }],
  }, [nodeId]);
}

/** Up to three pages for a subject: the most important definitions, formulas and points of every chapter, in syllabus order. */
export async function subjectSheet(db: D1Database, preview: boolean, paperId: string): Promise<Sheet> {
  const outline = await paperOutline(db, preview, paperId);
  const paper = { id: String(outline.paper.id), name: String(outline.paper.name) };
  const units = (outline.nodes as { id: string; parent_id: string | null; kind: string; title: string }[]).filter((n) => n.parent_id === null && n.kind !== 'NOTE');
  const probe = await Promise.all(units.map(async (u) => ({ u, p: await pick(db, preview, u.id, { defs: 3, formulas: 4, points: 3, figures: 0, tables: 0, chars: 150 }) })));
  const live = probe.filter((x) => x.p.defs.length + x.p.formulas.length + x.p.points.length > 0);
  // About 100 short items fit in three pages; every chapter gets a fair share of them.
  const share = Math.max(3, Math.min(10, Math.floor(100 / Math.max(1, live.length))));
  const sections: SheetSection[] = live.map(({ u, p }) => {
    const defs = p.defs.slice(0, Math.ceil(share * 0.35));
    const formulas = p.formulas.slice(0, Math.ceil(share * 0.4));
    const points = p.points.slice(0, Math.max(1, share - defs.length - formulas.length));
    return { id: u.id, title: u.title, practice: null, definitions: defs, formulas, points, figures: [], tables: [] };
  });
  return finish(db, preview, {
    kind: 'SUBJECT', title: `${paper.name}: last-day revision`, paper: paper.name, paperId, maxPages: 3, sections,
    empty: sections.length ? null : 'This subject has no lessons to make a sheet from yet.',
  }, live.map((x) => x.u.id));
}

/** A sheet from the student's own practice: topics with at least 3 answers and under 60% correct, weakest first. Nothing is invented. */
export async function weakSheet(db: D1Database, preview: boolean, userId: string, paperId?: string): Promise<Sheet> {
  const prog = await progress(db, userId);
  const weak = (prog.weakTopics as { id: string; title: string; paper: string; paper_code: string; attempted: number; correct: number; accuracy: number }[]).slice(0, 8);
  const paperRow = paperId ? await db.prepare('SELECT code, name FROM test_papers WHERE id = ?').bind(paperId).first<{ code: string; name: string }>() : null;
  const chosen = paperRow ? weak.filter((w) => w.paper_code === paperRow.code) : weak;
  const sections: SheetSection[] = [];
  for (const w of chosen) {
    let p;
    try {
      p = await pick(db, preview, w.id, { defs: 3, formulas: 4, points: 3, figures: 1, tables: 1, chars: 220 });
    } catch {
      continue; // a topic whose lessons are not visible is left out
    }
    if (p.defs.length + p.formulas.length + p.points.length + p.figures.length + p.tables.length === 0) continue;
    sections.push({ id: w.id, title: `${w.title} (${w.paper})`, practice: { attempted: Number(w.attempted), correct: Number(w.correct), accuracy: Number(w.accuracy) }, definitions: p.defs, formulas: p.formulas, points: p.points, figures: p.figures, tables: p.tables });
  }
  const empty = chosen.length === 0
    ? 'No weak topics yet. A topic appears here once you have answered at least 3 questions on it and got under 60% right.'
    : sections.length === 0 ? 'Your weak topics have no lessons to make a sheet from yet.' : null;
  return finish(db, preview, { kind: 'WEAK', title: paperRow ? `${paperRow.name}: my weak topics` : 'My weak topics', paper: paperRow?.name ?? null, paperId: paperId ?? null, maxPages: 3, sections, empty }, sections.map((s) => s.id));
}
