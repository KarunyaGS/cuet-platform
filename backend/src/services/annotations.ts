/**
 * Highlights and annotations: a student's own marks on learning content.
 *
 * An annotation sits on a "surface" (a lesson, or a question) and, inside it, on one content block. A text highlight
 * keeps the exact text selected and where it was in the block; a drawing keeps points as fractions of the block's box.
 * Nothing here reads or changes questions, answers or scores: annotations are a separate layer.
 *
 * The browser makes the id, so a save can be sent again without making a second record. A student's saves can only ever
 * touch that student's rows. The subject, unit, chapter and topic are worked out here from the surface, never taken
 * from the browser.
 */
import { z } from 'zod';
import { invalid, notFound } from '../lib/errors';
import { nowIso } from '../lib/sql';
import { LESSON_PAPER } from './flashcards';

export const SURFACES = ['LESSON', 'QUESTION'] as const;
export const KINDS = ['HIGHLIGHT', 'PEN', 'RECT', 'ELLIPSE', 'ARROW', 'LINE', 'NOTE'] as const;
const PER_SURFACE = 400;

const point = z.tuple([z.number().finite().min(-50).max(50), z.number().finite().min(-50).max(50)]);
const highlightData = z.object({ start: z.number().int().min(0).max(200_000), end: z.number().int().min(1).max(200_000), before: z.string().max(60).default(''), after: z.string().max(60).default('') });
const shapeData = z.object({ pts: z.array(point).min(1).max(1500) });

const itemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  kind: z.enum(KINDS),
  blockKey: z.string().min(1).max(80),
  data: z.unknown(),
  quote: z.string().max(4000).nullish(),
  note: z.string().max(2000).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  opacity: z.number().min(0.1).max(1).default(1),
  strokeWidth: z.number().min(1).max(24).default(3),
  z: z.number().int().min(0).max(100_000).default(0),
  orphaned: z.boolean().default(false),
});
export const saveSchema = z.object({
  surfaceKind: z.enum(SURFACES),
  surfaceId: z.string().min(1).max(100),
  originPath: z.string().regex(/^\/[A-Za-z0-9_\-/.?=&%]*$/).max(300).optional(),
  upserts: z.array(itemSchema).max(200).default([]),
  deletes: z.array(z.string().max(64)).max(400).default([]),
});
export const editSchema = z.object({ note: z.string().max(2000).nullable().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });

interface Context {
  examCode: string | null;
  testPaperId: string | null;
  unitNodeId: string | null;
  chapterNodeId: string | null;
  curriculumNodeId: string | null;
  resourceId: string | null;
  questionId: string | null;
}

const EXAM_OF = `(SELECT e.code FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.id = ?)`;

/** The unit and the chapter above a topic: the nearest UNIT, and the nearest UNIT or CHAPTER (the same grouping flashcards use). */
async function above(db: D1Database, nodeId: string | null): Promise<{ unit: string | null; chapter: string | null }> {
  if (!nodeId) return { unit: null, chapter: null };
  const { results } = await db
    .prepare(
      `WITH RECURSIVE up(id, parent_id, kind, depth) AS (
         SELECT id, parent_id, kind, 0 FROM curriculum_nodes WHERE id = ?
         UNION ALL SELECT n.id, n.parent_id, n.kind, up.depth + 1 FROM curriculum_nodes n JOIN up ON n.id = up.parent_id WHERE up.depth < 12)
       SELECT id, kind, depth FROM up ORDER BY depth`,
    )
    .bind(nodeId)
    .all<{ id: string; kind: string }>();
  if (!results.length) return { unit: null, chapter: null };
  const top = results[results.length - 1]!.id;
  return { unit: (results.find((r) => r.kind === 'UNIT') ?? results[results.length - 1]!).id, chapter: (results.find((r) => r.kind === 'UNIT' || r.kind === 'CHAPTER') ?? { id: top }).id };
}

/** Where a surface sits in the syllabus. Throws when the lesson or question does not exist. */
async function contextOf(db: D1Database, kind: (typeof SURFACES)[number], id: string): Promise<Context> {
  if (kind === 'LESSON') {
    const r = await db.prepare(`SELECT r.id, r.curriculum_node_id, ${LESSON_PAPER} AS paper FROM learning_resources r WHERE r.id = ?`).bind(id).first<{ id: string; curriculum_node_id: string | null; paper: string | null }>();
    if (!r) throw notFound('Lesson');
    const up = await above(db, r.curriculum_node_id);
    const exam = r.paper ? await db.prepare(`SELECT ${EXAM_OF} AS code`).bind(r.paper).first<{ code: string | null }>() : null;
    return { examCode: exam?.code ?? null, testPaperId: r.paper, unitNodeId: up.unit, chapterNodeId: up.chapter, curriculumNodeId: r.curriculum_node_id, resourceId: r.id, questionId: null };
  }
  const q = await db
    .prepare(
      `SELECT q.id, q.test_paper_id, (SELECT t.curriculum_node_id FROM question_topics t WHERE t.question_id = q.id ORDER BY t.is_primary DESC LIMIT 1) AS node
       FROM questions q WHERE q.id = ?`,
    )
    .bind(id)
    .first<{ id: string; test_paper_id: string | null; node: string | null }>();
  if (!q) throw notFound('Question');
  const paper = q.test_paper_id ?? (q.node ? ((await db.prepare('SELECT v.test_paper_id AS p FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?').bind(q.node).first<{ p: string }>())?.p ?? null) : null);
  const up = await above(db, q.node);
  const exam = paper ? await db.prepare(`SELECT ${EXAM_OF} AS code`).bind(paper).first<{ code: string | null }>() : null;
  return { examCode: exam?.code ?? null, testPaperId: paper, unitNodeId: up.unit, chapterNodeId: up.chapter, curriculumNodeId: q.node, resourceId: null, questionId: q.id };
}

type Row = Record<string, string | number | null>;
const out = (r: Row) => ({
  id: r.id as string,
  surfaceKind: r.surface_kind as string,
  surfaceId: r.surface_id as string,
  kind: r.kind as string,
  blockKey: r.block_key as string,
  data: JSON.parse(String(r.data_json)) as unknown,
  quote: r.quote as string | null,
  note: r.note as string | null,
  color: r.color as string,
  opacity: Number(r.opacity),
  strokeWidth: Number(r.stroke_width),
  z: Number(r.z),
  orphaned: Boolean(r.orphaned),
  originPath: r.origin_path as string | null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

/** A student's annotations on one lesson or one question, in drawing order. */
export async function listForSurface(db: D1Database, userId: string, kind: string, id: string) {
  if (!(SURFACES as readonly string[]).includes(kind) || !id) throw invalid('surface must be LESSON or QUESTION, with an id');
  const { results } = await db.prepare('SELECT * FROM annotations WHERE user_id = ? AND surface_kind = ? AND surface_id = ? ORDER BY z, created_at, id').bind(userId, kind, id).all<Row>();
  return results.map(out);
}

/** Several surfaces at once (a results page shows many questions): one request instead of one per question. */
export async function listForSurfaces(db: D1Database, userId: string, kind: string, ids: string[]) {
  if (!(SURFACES as readonly string[]).includes(kind)) throw invalid('surface must be LESSON or QUESTION');
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 240);
  const all: ReturnType<typeof out>[] = [];
  for (let i = 0; i < clean.length; i += 80) {
    const part = clean.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT * FROM annotations WHERE user_id = ? AND surface_kind = ? AND surface_id IN (${part.map(() => '?').join(',')}) ORDER BY z, created_at, id`)
      .bind(userId, kind, ...part)
      .all<Row>();
    all.push(...results.map(out));
  }
  return all;
}

/**
 * One batched save for a surface: new and changed annotations, and removed ones. Sending the same batch twice changes
 * nothing the second time. Only the student's own rows can be written or removed.
 */
export async function saveBatch(db: D1Database, userId: string, input: z.infer<typeof saveSchema>) {
  for (const a of input.upserts) {
    const parsed = a.kind === 'HIGHLIGHT' ? highlightData.safeParse(a.data) : shapeData.safeParse(a.data);
    if (!parsed.success) throw invalid(`Annotation ${a.id}: its position is not valid`);
    a.data = parsed.data;
    if (a.kind === 'HIGHLIGHT') {
      const d = parsed.data as z.infer<typeof highlightData>;
      if (d.end <= d.start || !a.quote) throw invalid(`Annotation ${a.id}: a highlight needs the selected text`);
    }
  }
  const stmts: D1PreparedStatement[] = [];
  if (input.upserts.length) {
    const ctx = await contextOf(db, input.surfaceKind, input.surfaceId);
    const have = await db.prepare('SELECT COUNT(*) AS n FROM annotations WHERE user_id = ? AND surface_kind = ? AND surface_id = ?').bind(userId, input.surfaceKind, input.surfaceId).first<{ n: number }>();
    if ((have?.n ?? 0) + input.upserts.length > PER_SURFACE + 200) throw invalid(`A page can hold up to ${PER_SURFACE} annotations. Remove some first.`);
    const now = nowIso();
    for (const a of input.upserts)
      stmts.push(
        db
          .prepare(
            `INSERT INTO annotations (id, user_id, surface_kind, surface_id, kind, block_key, data_json, quote, note, color, opacity, stroke_width, z, orphaned, origin_path,
               exam_code, test_paper_id, unit_node_id, chapter_node_id, curriculum_node_id, resource_id, question_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET block_key = excluded.block_key, data_json = excluded.data_json, quote = excluded.quote, note = excluded.note, color = excluded.color,
               opacity = excluded.opacity, stroke_width = excluded.stroke_width, z = excluded.z, orphaned = excluded.orphaned, updated_at = excluded.updated_at
             WHERE annotations.user_id = excluded.user_id AND annotations.surface_kind = excluded.surface_kind AND annotations.surface_id = excluded.surface_id`,
          )
          .bind(a.id, userId, input.surfaceKind, input.surfaceId, a.kind, a.blockKey, JSON.stringify(a.data), a.quote ?? null, a.note?.trim() || null, a.color.toLowerCase(), a.opacity, a.strokeWidth, a.z,
            a.orphaned ? 1 : 0, input.originPath ?? null, ctx.examCode, ctx.testPaperId, ctx.unitNodeId, ctx.chapterNodeId, ctx.curriculumNodeId, ctx.resourceId, ctx.questionId, now, now),
      );
  }
  for (const id of input.deletes) stmts.push(db.prepare('DELETE FROM annotations WHERE id = ? AND user_id = ? AND surface_kind = ? AND surface_id = ?').bind(id, userId, input.surfaceKind, input.surfaceId));
  let changed = 0;
  for (let i = 0; i < stmts.length; i += 40) changed += (await db.batch(stmts.slice(i, i + 40))).reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  return { saved: input.upserts.length, removed: input.deletes.length, changed };
}

/** Everything a student has annotated, newest first, with where each one is: for My bookmarks. */
export async function listAll(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT a.*, tp.name AS paper, un.title AS unit, un.position AS unit_position, ch.title AS chapter, ch.position AS chapter_position, tn.title AS topic, lr.title AS lesson,
         substr(q.stem, 1, 160) AS question
       FROM annotations a
         LEFT JOIN test_papers tp ON tp.id = a.test_paper_id LEFT JOIN curriculum_nodes un ON un.id = a.unit_node_id LEFT JOIN curriculum_nodes ch ON ch.id = a.chapter_node_id
         LEFT JOIN curriculum_nodes tn ON tn.id = a.curriculum_node_id LEFT JOIN learning_resources lr ON lr.id = a.resource_id LEFT JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ? ORDER BY a.updated_at DESC, a.id LIMIT 1000`,
    )
    .bind(userId)
    .all<Row>();
  return results.map((r) => ({
    ...out(r),
    examCode: r.exam_code as string | null,
    paperId: r.test_paper_id as string | null,
    paper: r.paper as string | null,
    unitId: r.unit_node_id as string | null,
    unit: r.unit as string | null,
    unitPosition: r.unit_position === null ? null : Number(r.unit_position),
    chapterId: r.chapter_node_id as string | null,
    chapter: r.chapter as string | null,
    chapterPosition: r.chapter_position === null ? null : Number(r.chapter_position),
    topicId: r.curriculum_node_id as string | null,
    topic: r.topic as string | null,
    resourceId: r.resource_id as string | null,
    lesson: r.lesson as string | null,
    questionId: r.question_id as string | null,
    question: r.question as string | null,
  }));
}

/** Changes the note or the colour of one annotation (from My bookmarks). */
export async function editOne(db: D1Database, userId: string, id: string, input: z.infer<typeof editSchema>) {
  const cur = await db.prepare('SELECT id, note, color FROM annotations WHERE id = ? AND user_id = ?').bind(id, userId).first<{ id: string; note: string | null; color: string }>();
  if (!cur) throw notFound('Annotation');
  const note = input.note === undefined ? cur.note : input.note?.trim() || null;
  await db.prepare('UPDATE annotations SET note = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(note, (input.color ?? cur.color).toLowerCase(), nowIso(), id, userId).run();
  return { id, note, color: (input.color ?? cur.color).toLowerCase() };
}

/** Removes one annotation. Nothing else is touched: bookmarks, revision cards and the content stay as they are. */
export async function deleteOne(db: D1Database, userId: string, id: string) {
  const res = await db.prepare('DELETE FROM annotations WHERE id = ? AND user_id = ?').bind(id, userId).run();
  if (!(res.meta.changes ?? 0)) throw notFound('Annotation');
  return { deleted: true };
}
