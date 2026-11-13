/**
 * Flashcards and spaced revision.
 *
 * A card belongs to one student and is made from one concept of a lesson (see concepts.ts). Its text is copied from the
 * lesson by the server, never sent by the browser. A student has at most one card per concept: the database refuses a
 * second one, so single cards and bulk imports cannot create duplicates.
 *
 * Bookmarks and cards are separate records that share the concept key. Removing either never touches the other.
 *
 * Scheduling is SM-2. Four ratings are accepted (AGAIN, HARD, GOOD, EASY); the screens currently offer two of them:
 * "Need revision" (AGAIN) and "Know" (GOOD). Days are calendar days in the student's own time zone, sent by the browser
 * and accepted only when within a day of the server's date. No AI calls.
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { CONCEPT_KEY, CONCEPT_TYPES, conceptsOf, conceptsOfResources, resourceOfKey, type Concept, type RawBlock } from './concepts';
import { VISIBLE_CONTENT } from './learning';

export const RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const;
export type Rating = (typeof RATINGS)[number];
const QUALITY: Record<Rating, number> = { AGAIN: 2, HARD: 3, GOOD: 4, EASY: 5 };
const MIN_EASE = 1.3;
/** A card whose next review is three weeks or more away counts as well known. */
const MATURE_DAYS = 21;
const IMPORT_LIMIT = 200;

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const keySchema = z.string().regex(CONCEPT_KEY);
export const createCardSchema = z.object({ conceptKey: keySchema, day: daySchema });
export const importCardsSchema = z
  .object({
    resourceId: z.string().min(1).max(100).optional(),
    nodeId: z.string().min(1).max(100).optional(),
    types: z.array(z.enum(CONCEPT_TYPES)).min(1).max(CONCEPT_TYPES.length).optional(),
    day: daySchema,
  })
  .refine((v) => Boolean(v.resourceId) !== Boolean(v.nodeId), { message: 'Give either a lesson or a topic' });
export const reviewSchema = z.object({ rating: z.enum(RATINGS), day: daySchema });
export const cardQuery = z.object({
  day: daySchema,
  paperId: z.string().max(100).optional(),
  chapterId: z.string().max(100).optional(),
  /** A topic: cards from lessons on that topic or anything under it. */
  nodeId: z.string().max(100).optional(),
  due: z.enum(['1']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
export const addDays = (day: string, n: number) => new Date((dayNumber(day) + n) * DAY_MS).toISOString().slice(0, 10);

/** The browser says which calendar day it is for the student. Any time zone is within one day of the server's date. */
export function assertDay(day: string): string {
  const n = dayNumber(day);
  if (!Number.isFinite(n) || Math.abs(n - Math.floor(Date.now() / DAY_MS)) > 1) throw invalid("day must be today's date");
  return day;
}

// ---------------------------------------------------------------- scheduling

export interface Schedule {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

/** SM-2: one review moves a card's schedule. A failed recall returns the card to a one-day interval. */
export function sm2(cur: Schedule, rating: Rating): Schedule {
  const q = QUALITY[rating];
  const ease = Math.max(MIN_EASE, Math.round((cur.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  if (q < 3) return { intervalDays: 1, ease, reps: 0, lapses: cur.lapses + 1 };
  const reps = cur.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.max(cur.intervalDays + 1, Math.round(cur.intervalDays * ease));
  return { intervalDays, ease, reps, lapses: cur.lapses };
}

// ---------------------------------------------------------------- reading lessons

interface LessonRow {
  id: string;
  title: string;
  curriculum_node_id: string | null;
  test_paper_id: string | null;
}

/** The nearest unit or chapter above a topic; else the top of its branch. This is the "chapter" cards are grouped by. */
async function chapterOf(db: D1Database, nodeId: string | null): Promise<string | null> {
  if (!nodeId) return null;
  const { results } = await db
    .prepare(
      `WITH RECURSIVE up(id, parent_id, kind, depth) AS (
         SELECT id, parent_id, kind, 0 FROM curriculum_nodes WHERE id = ?
         UNION ALL SELECT n.id, n.parent_id, n.kind, up.depth + 1 FROM curriculum_nodes n JOIN up ON n.id = up.parent_id WHERE up.depth < 12)
       SELECT id, kind, depth FROM up ORDER BY depth`,
    )
    .bind(nodeId)
    .all<{ id: string; kind: string; depth: number }>();
  if (!results.length) return null;
  return (results.find((r) => r.kind === 'UNIT' || r.kind === 'CHAPTER') ?? results[results.length - 1]!).id;
}

/** A lesson's subject: its own paper, or else the paper of the syllabus its topic belongs to. */
export const LESSON_PAPER = `COALESCE(r.test_paper_id, (SELECT v.test_paper_id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = r.curriculum_node_id))`;

async function visibleLesson(db: D1Database, preview: boolean, resourceId: string): Promise<LessonRow | null> {
  return db
    .prepare(`SELECT r.id, r.title, r.curriculum_node_id, ${LESSON_PAPER} AS test_paper_id FROM learning_resources r WHERE r.id = ?2 AND ${VISIBLE_CONTENT('r')}`)
    .bind(preview ? 1 : 0, resourceId)
    .first<LessonRow>();
}

/** One concept as it stands in its lesson now, or null when the lesson is not visible or no longer has it. */
export async function findConcept(db: D1Database, preview: boolean, key: string): Promise<{ lesson: LessonRow; concept: Concept } | null> {
  if (!CONCEPT_KEY.test(key)) return null;
  const lesson = await visibleLesson(db, preview, resourceOfKey(key));
  if (!lesson) return null;
  const { results } = await db.prepare('SELECT position, type, body FROM content_blocks WHERE resource_id = ?').bind(lesson.id).all<RawBlock>();
  const concept = (await conceptsOf(lesson.id, results)).find((c) => c.key === key);
  return concept ? { lesson, concept } : null;
}

// ---------------------------------------------------------------- cards

const CARD_SELECT = `
  SELECT f.id, f.concept_key, f.resource_id, f.curriculum_node_id, f.chapter_node_id, f.test_paper_id, f.block_type, f.lesson_title, f.section,
    f.front, f.back, f.latex, f.due_on, f.interval_days, f.ease, f.reps, f.lapses, f.last_rating, f.last_reviewed_at, f.created_at,
    tp.name AS paper, ch.title AS chapter
  FROM flashcards f LEFT JOIN test_papers tp ON tp.id = f.test_paper_id LEFT JOIN curriculum_nodes ch ON ch.id = f.chapter_node_id`;

type CardRow = Record<string, string | number | null>;
const cardOut = (r: CardRow, day: string) => ({
  id: r.id as string,
  conceptKey: r.concept_key as string,
  /** Where the card came from: the lesson, and the concept's place in it. */
  resourceId: r.resource_id as string,
  anchor: `c-${String(r.concept_key).slice(String(r.concept_key).lastIndexOf('.') + 1)}`,
  lesson: r.lesson_title as string,
  section: r.section as string | null,
  type: r.block_type as string,
  paperId: r.test_paper_id as string | null,
  paper: r.paper as string | null,
  chapterId: r.chapter_node_id as string | null,
  chapter: r.chapter as string | null,
  front: r.front as string,
  back: r.back as string,
  latex: r.latex as string | null,
  dueOn: r.due_on as string,
  due: String(r.due_on) <= day,
  intervalDays: Number(r.interval_days),
  reps: Number(r.reps),
  lapses: Number(r.lapses),
  lastRating: r.last_rating as string | null,
  lastReviewedAt: r.last_reviewed_at as string | null,
  /** NEW (never reviewed), LEARNING or KNOWN (next review three weeks or more away). */
  stage: r.last_reviewed_at === null ? 'NEW' : Number(r.interval_days) >= MATURE_DAYS ? 'KNOWN' : 'LEARNING',
});

function insertCard(db: D1Database, userId: string, lesson: LessonRow, chapterId: string | null, c: Concept, day: string, now: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO flashcards (id, user_id, concept_key, resource_id, curriculum_node_id, chapter_node_id, test_paper_id, block_type, lesson_title, section, front, back, latex,
         due_on, interval_days, ease, reps, lapses, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, 0, ?, ?)
       ON CONFLICT (user_id, concept_key) DO NOTHING`,
    )
    .bind(newId('fc'), userId, c.key, lesson.id, lesson.curriculum_node_id, chapterId, lesson.test_paper_id, c.type, lesson.title, c.section, c.front, c.back, c.latex, day, now, now);
}

async function cardByKey(db: D1Database, userId: string, key: string, day: string) {
  const r = await db.prepare(`${CARD_SELECT} WHERE f.user_id = ? AND f.concept_key = ?`).bind(userId, key).first<CardRow>();
  return r ? cardOut(r, day) : null;
}

/** Makes one card from a concept. Asking again for the same concept returns the card that already exists. */
export async function createCard(db: D1Database, preview: boolean, userId: string, input: z.infer<typeof createCardSchema>) {
  const day = assertDay(input.day);
  const existing = await cardByKey(db, userId, input.conceptKey, day);
  if (existing) return { created: false, card: existing };
  const found = await findConcept(db, preview, input.conceptKey);
  if (!found) throw new ApiError(404, 'CONCEPT_NOT_FOUND', 'This concept is no longer in its lesson. Open the lesson to see how it reads now.');
  const res = await insertCard(db, userId, found.lesson, await chapterOf(db, found.lesson.curriculum_node_id), found.concept, day, nowIso()).run();
  return { created: (res.meta.changes ?? 0) > 0, card: (await cardByKey(db, userId, input.conceptKey, day))! };
}

/** Adds every concept of a lesson, or of all lessons under a topic, as cards. Concepts that already have a card are left as they are. */
export async function importCards(db: D1Database, preview: boolean, userId: string, input: z.infer<typeof importCardsSchema>) {
  const day = assertDay(input.day);
  let lessons: LessonRow[];
  if (input.resourceId) {
    const one = await visibleLesson(db, preview, input.resourceId);
    if (!one) throw notFound('Lesson');
    lessons = [one];
  } else {
    if (!(await db.prepare('SELECT 1 FROM curriculum_nodes WHERE id = ?').bind(input.nodeId).first())) throw notFound('Topic');
    lessons = (
      await db
        .prepare(
          `WITH RECURSIVE sub(id) AS (SELECT ?2 UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
           SELECT r.id, r.title, r.curriculum_node_id, ${LESSON_PAPER} AS test_paper_id FROM learning_resources r
           WHERE r.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('r')} ORDER BY r.title LIMIT 80`,
        )
        .bind(preview ? 1 : 0, input.nodeId)
        .all<LessonRow>()
    ).results;
  }
  const types = new Set<string>(input.types ?? CONCEPT_TYPES);
  const byLesson = await conceptsOfResources(db, lessons.map((l) => l.id));
  const wanted: { lesson: LessonRow; concept: Concept }[] = [];
  for (const lesson of lessons) for (const concept of byLesson.get(lesson.id) ?? []) if (types.has(concept.type)) wanted.push({ lesson, concept });
  const total = wanted.length;
  // Which of these the student already has.
  const have = new Set<string>();
  for (let i = 0; i < wanted.length; i += 80) {
    const part = wanted.slice(i, i + 80).map((w) => w.concept.key);
    const { results } = await db
      .prepare(`SELECT concept_key FROM flashcards WHERE user_id = ? AND concept_key IN (${part.map(() => '?').join(',')})`)
      .bind(userId, ...part)
      .all<{ concept_key: string }>();
    for (const r of results) have.add(r.concept_key);
  }
  const fresh = wanted.filter((w) => !have.has(w.concept.key));
  const toAdd = fresh.slice(0, IMPORT_LIMIT);
  const chapters = new Map<string | null, string | null>();
  for (const w of toAdd) if (!chapters.has(w.lesson.curriculum_node_id)) chapters.set(w.lesson.curriculum_node_id, await chapterOf(db, w.lesson.curriculum_node_id));
  const now = nowIso();
  let added = 0;
  for (let i = 0; i < toAdd.length; i += 40) {
    const res = await db.batch(toAdd.slice(i, i + 40).map((w) => insertCard(db, userId, w.lesson, chapters.get(w.lesson.curriculum_node_id) ?? null, w.concept, day, now)));
    added += res.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  }
  return { total, added, existing: total - fresh.length, notAdded: fresh.length - toAdd.length, limit: IMPORT_LIMIT };
}

const SUBTREE = '(WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id) SELECT id FROM sub)';

function filters(q: { paperId?: string; chapterId?: string; nodeId?: string }, binds: unknown[]) {
  let sql = '';
  if (q.nodeId) {
    sql += ` AND f.curriculum_node_id IN ${SUBTREE}`;
    binds.push(q.nodeId);
  }
  if (q.paperId) {
    sql += ' AND f.test_paper_id = ?';
    binds.push(q.paperId);
  }
  if (q.chapterId) {
    sql += ' AND f.chapter_node_id = ?';
    binds.push(q.chapterId);
  }
  return sql;
}

/** A student's cards, soonest due first. */
export async function listCards(db: D1Database, userId: string, q: z.infer<typeof cardQuery>) {
  const binds: unknown[] = [userId];
  let where = filters(q, binds);
  if (q.due) {
    where += ' AND f.due_on <= ?';
    binds.push(q.day);
  }
  const { results } = await db.prepare(`${CARD_SELECT} WHERE f.user_id = ? ${where} ORDER BY f.due_on, f.created_at, f.id LIMIT ${q.limit ?? 200}`).bind(...binds).all<CardRow>();
  return results.map((r) => cardOut(r, q.day));
}

/** Today's revision queue: every card due on or before the student's day. */
export async function reviewQueue(db: D1Database, userId: string, q: z.infer<typeof cardQuery>) {
  const day = assertDay(q.day);
  const binds: unknown[] = [userId, day];
  const where = filters(q, binds);
  const limit = q.limit ?? 50;
  const [rows, count] = await Promise.all([
    db.prepare(`${CARD_SELECT} WHERE f.user_id = ? AND f.due_on <= ? ${where} ORDER BY f.due_on, f.created_at, f.id LIMIT ${limit}`).bind(...binds).all<CardRow>(),
    db.prepare(`SELECT COUNT(*) AS n FROM flashcards f WHERE f.user_id = ? AND f.due_on <= ? ${where}`).bind(...binds).first<{ n: number }>(),
  ]);
  return { day, due: count?.n ?? 0, cards: rows.results.map((r) => cardOut(r, day)) };
}

/** Counts for My Flashcards and the dashboard: totals, and cards by subject and chapter. */
export async function cardSummary(db: D1Database, userId: string, day: string) {
  const [groups, today, saved] = await Promise.all([
    db
      .prepare(
        `SELECT f.test_paper_id AS paper_id, tp.name AS paper, f.chapter_node_id AS chapter_id, ch.title AS chapter, ch.position AS chapter_position,
           COUNT(*) AS total, SUM(f.due_on <= ?2) AS due, SUM(f.last_reviewed_at IS NULL) AS fresh, SUM(f.interval_days >= ${MATURE_DAYS}) AS known
         FROM flashcards f LEFT JOIN test_papers tp ON tp.id = f.test_paper_id LEFT JOIN curriculum_nodes ch ON ch.id = f.chapter_node_id
         WHERE f.user_id = ?1 GROUP BY f.test_paper_id, f.chapter_node_id ORDER BY tp.name, ch.position, ch.title`,
      )
      .bind(userId, day)
      .all<Record<string, string | number | null>>(),
    db.prepare('SELECT COUNT(*) AS reviews, COUNT(DISTINCT card_id) AS cards FROM flashcard_reviews WHERE user_id = ? AND day = ?').bind(userId, day).first<{ reviews: number; cards: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ? AND kind = 'CONCEPT'`).bind(userId).first<{ n: number }>(),
  ]);
  const subjects: { paperId: string | null; paper: string; total: number; due: number; known: number; chapters: { chapterId: string | null; chapter: string; total: number; due: number; known: number }[] }[] = [];
  const totals = { total: 0, due: 0, fresh: 0, known: 0 };
  for (const g of groups.results) {
    const n = { total: Number(g.total), due: Number(g.due), fresh: Number(g.fresh), known: Number(g.known) };
    totals.total += n.total;
    totals.due += n.due;
    totals.fresh += n.fresh;
    totals.known += n.known;
    let s = subjects.find((x) => x.paperId === g.paper_id);
    if (!s) subjects.push((s = { paperId: g.paper_id as string | null, paper: (g.paper as string | null) ?? 'Other', total: 0, due: 0, known: 0, chapters: [] }));
    s.total += n.total;
    s.due += n.due;
    s.known += n.known;
    s.chapters.push({ chapterId: g.chapter_id as string | null, chapter: (g.chapter as string | null) ?? 'Other', total: n.total, due: n.due, known: n.known });
  }
  return { day, ...totals, reviewedToday: today?.cards ?? 0, savedConcepts: saved?.n ?? 0, subjects };
}

/** For a topic page: how many concepts its lessons hold, how many of them the student has as cards, and how many are due. */
export async function topicCards(db: D1Database, preview: boolean, userId: string, nodeId: string, day: string) {
  const node = await db
    .prepare('SELECT n.id, n.title, v.test_paper_id AS paper_id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?')
    .bind(nodeId)
    .first<{ id: string; title: string; paper_id: string }>();
  if (!node) throw notFound('Topic');
  const [lessons, mine] = await Promise.all([
    db
      .prepare(`SELECT r.id FROM learning_resources r WHERE r.curriculum_node_id IN ${SUBTREE.replace('?', '?2')} AND ${VISIBLE_CONTENT('r')} LIMIT 80`)
      .bind(preview ? 1 : 0, nodeId)
      .all<{ id: string }>(),
    db
      .prepare(`SELECT COUNT(*) AS cards, COALESCE(SUM(f.due_on <= ?2), 0) AS due FROM flashcards f WHERE f.user_id = ?1 AND f.curriculum_node_id IN ${SUBTREE.replace('?', '?3')}`)
      .bind(userId, day, nodeId)
      .first<{ cards: number; due: number }>(),
  ]);
  const byLesson = await conceptsOfResources(db, lessons.results.map((l) => l.id));
  let concepts = 0;
  for (const list of byLesson.values()) concepts += list.length;
  return { nodeId: node.id, title: node.title, paperId: node.paper_id, day, concepts, cards: mine?.cards ?? 0, due: mine?.due ?? 0 };
}

/** Which of these concepts the student already has a card for. */
export async function cardState(db: D1Database, userId: string, keys: string[]) {
  const out: string[] = [];
  const clean = [...new Set(keys.filter((k) => CONCEPT_KEY.test(k)))].slice(0, 400);
  for (let i = 0; i < clean.length; i += 80) {
    const part = clean.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT concept_key FROM flashcards WHERE user_id = ? AND concept_key IN (${part.map(() => '?').join(',')})`)
      .bind(userId, ...part)
      .all<{ concept_key: string }>();
    out.push(...results.map((r) => r.concept_key));
  }
  return out;
}

/** Records one answer and moves the card to its next due day. A card that is not due is refused, so a double tap cannot count twice. */
export async function reviewCard(db: D1Database, userId: string, id: string, input: z.infer<typeof reviewSchema>) {
  const day = assertDay(input.day);
  const cur = await db
    .prepare('SELECT id, due_on, interval_days, ease, reps, lapses FROM flashcards WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<{ id: string; due_on: string; interval_days: number; ease: number; reps: number; lapses: number }>();
  if (!cur) throw notFound('Flashcard');
  if (cur.due_on > day) throw new ApiError(409, 'NOT_DUE', `This card is next due on ${cur.due_on}`, { dueOn: cur.due_on });
  const next = sm2({ intervalDays: cur.interval_days, ease: cur.ease, reps: cur.reps, lapses: cur.lapses }, input.rating);
  const dueOn = addDays(day, next.intervalDays);
  const now = nowIso();
  const moved = await db
    .prepare(
      `UPDATE flashcards SET due_on = ?, interval_days = ?, ease = ?, reps = ?, lapses = ?, last_rating = ?, last_reviewed_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND due_on = ? AND reps = ?`,
    )
    .bind(dueOn, next.intervalDays, next.ease, next.reps, next.lapses, input.rating, now, now, id, userId, cur.due_on, cur.reps)
    .run();
  if (!(moved.meta.changes ?? 0)) throw new ApiError(409, 'NOT_DUE', 'This card was just reviewed');
  await db
    .prepare('INSERT INTO flashcard_reviews (id, card_id, user_id, rating, day, interval_before, interval_after, ease_after, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('fcr'), id, userId, input.rating, day, cur.interval_days, next.intervalDays, next.ease, now)
    .run();
  const r = await db.prepare(`${CARD_SELECT} WHERE f.id = ? AND f.user_id = ?`).bind(id, userId).first<CardRow>();
  return cardOut(r!, day);
}

/** Removes a card (and its review history). A bookmark on the same concept is not touched. */
export async function deleteCard(db: D1Database, userId: string, id: string) {
  const res = await db.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').bind(id, userId).run();
  if (!(res.meta.changes ?? 0)) throw notFound('Flashcard');
  return { deleted: true };
}
