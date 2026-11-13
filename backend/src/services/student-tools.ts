/**
 * Student learning tools: profile, bookmarks, "continue learning" activity, the dashboard, daily goals,
 * the study planner, daily practice and revision notes. Everything is computed from stored data; no AI calls.
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { conceptsOfResources } from './concepts';
import { findConcept } from './flashcards';
import { VISIBLE_CONTENT, VISIBLE_SYLLABUS } from './learning';
import { createSession, progress } from './practice';

// ---------------------------------------------------------------- profile

export const profileSchema = z.object({ displayName: z.string().trim().min(1).max(80) });

export async function getProfile(db: D1Database, userId: string) {
  const u = await db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.created_at, u.last_login_at,
         (SELECT COUNT(*) FROM practice_sessions s WHERE s.user_id = u.id AND s.status = 'SUBMITTED') AS tests_taken,
         (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = u.id) AS bookmarks
       FROM users u WHERE u.id = ?`,
    )
    .bind(userId)
    .first<Record<string, string | number | null>>();
  if (!u) throw notFound('Account');
  return { id: u.id, email: u.email, displayName: u.display_name, memberSince: u.created_at, lastLogin: u.last_login_at, testsTaken: Number(u.tests_taken), bookmarks: Number(u.bookmarks) };
}

export async function updateProfile(db: D1Database, userId: string, input: z.infer<typeof profileSchema>) {
  await db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').bind(input.displayName, nowIso(), userId).run();
  return getProfile(db, userId);
}

// ---------------------------------------------------------------- bookmarks

export const BOOKMARK_KINDS = ['TOPIC', 'LESSON', 'QUESTION', 'REVISION', 'CONCEPT'] as const;
const KINDS = BOOKMARK_KINDS;
export const bookmarkSchema = z.object({ kind: z.enum(KINDS), entityId: z.string().min(1).max(100) });

/** REVISION saves a topic's quick-revision page (the entity is the topic). */
const TABLE = { TOPIC: 'curriculum_nodes', LESSON: 'learning_resources', QUESTION: 'questions', REVISION: 'curriculum_nodes' } as const;

/**
 * CONCEPT saves one definition, formula, key point or fact of a lesson: the entity is its concept key, and its name is
 * kept on the bookmark. A bookmark and a flashcard on the same concept are separate records; neither removes the other.
 */
export async function addBookmark(db: D1Database, userId: string, input: z.infer<typeof bookmarkSchema>, preview = false) {
  let label: string | null = null;
  if (input.kind === 'CONCEPT') {
    const found = await findConcept(db, preview, input.entityId);
    if (!found) throw notFound('Item to bookmark');
    label = found.concept.title;
  } else if (!(await db.prepare(`SELECT 1 FROM ${TABLE[input.kind]} WHERE id = ?`).bind(input.entityId).first())) throw notFound('Item to bookmark');
  await db
    .prepare('INSERT INTO bookmarks (id, user_id, kind, entity_id, label, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, kind, entity_id) DO NOTHING')
    .bind(newId('bm'), userId, input.kind, input.entityId, label, nowIso())
    .run();
  return { bookmarked: true };
}

export async function removeBookmark(db: D1Database, userId: string, input: z.infer<typeof bookmarkSchema>) {
  await db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND kind = ? AND entity_id = ?').bind(userId, input.kind, input.entityId).run();
  return { bookmarked: false };
}

export async function listBookmarks(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT b.id, b.kind, b.entity_id, b.created_at,
         CASE WHEN b.kind IN ('TOPIC','REVISION') THEN n.title WHEN b.kind = 'LESSON' THEN r.title WHEN b.kind = 'CONCEPT' THEN b.label ELSE SUBSTR(q.stem, 1, 180) END AS title,
         COALESCE(n.id, r.curriculum_node_id, rc.curriculum_node_id, (SELECT qt.curriculum_node_id FROM question_topics qt WHERE qt.question_id = q.id LIMIT 1)) AS node_id,
         COALESCE(tp1.name, tp2.name, tp3.name, tp4.name) AS paper,
         CASE WHEN b.kind = 'CONCEPT' THEN SUBSTR(b.entity_id, 1, INSTR(b.entity_id, '.') - 1) END AS resource_id, rc.title AS lesson,
         CASE WHEN b.kind = 'CONCEPT' THEN (SELECT f.id FROM flashcards f WHERE f.user_id = b.user_id AND f.concept_key = b.entity_id) END AS card_id
       FROM bookmarks b
       LEFT JOIN learning_resources rc ON b.kind = 'CONCEPT' AND rc.id = SUBSTR(b.entity_id, 1, INSTR(b.entity_id, '.') - 1) LEFT JOIN test_papers tp4 ON tp4.id = COALESCE(rc.test_paper_id, (SELECT v4.test_paper_id FROM curriculum_nodes n4 JOIN syllabus_versions v4 ON v4.id = n4.syllabus_version_id WHERE n4.id = rc.curriculum_node_id))
       LEFT JOIN curriculum_nodes n ON b.kind IN ('TOPIC','REVISION') AND n.id = b.entity_id
       LEFT JOIN syllabus_versions v1 ON v1.id = n.syllabus_version_id LEFT JOIN test_papers tp1 ON tp1.id = v1.test_paper_id
       LEFT JOIN learning_resources r ON b.kind = 'LESSON' AND r.id = b.entity_id LEFT JOIN test_papers tp2 ON tp2.id = r.test_paper_id
       LEFT JOIN questions q ON b.kind = 'QUESTION' AND q.id = b.entity_id LEFT JOIN test_papers tp3 ON tp3.id = q.test_paper_id
       WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 500`,
    )
    .bind(userId)
    .all<Record<string, string | null>>();
  return results.map((r) => ({
    id: r.id, kind: r.kind, entityId: r.entity_id, title: r.title ?? '(no longer available)', nodeId: r.node_id, paper: r.paper, createdAt: r.created_at,
    // CONCEPT only: its lesson, where it sits in the lesson, and the student's flashcard for it if there is one.
    resourceId: r.resource_id, lesson: r.lesson, anchor: r.kind === 'CONCEPT' ? `c-${String(r.entity_id).slice(String(r.entity_id).lastIndexOf('.') + 1)}` : null, cardId: r.card_id,
  }));
}

export async function bookmarkState(db: D1Database, userId: string, kind: string, ids: string[]) {
  const out: string[] = [];
  // In parts, to stay inside the database's limit of 100 values per statement.
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT entity_id FROM bookmarks WHERE user_id = ? AND kind = ? AND entity_id IN (${part.map(() => '?').join(',')})`)
      .bind(userId, kind, ...part)
      .all<{ entity_id: string }>();
    out.push(...results.map((r) => r.entity_id));
  }
  return out;
}

// ---------------------------------------------------------------- learning activity

export const activitySchema = z.object({ kind: z.enum(['TOPIC_VIEW', 'LESSON_VIEW']), nodeId: z.string().max(100).optional(), resourceId: z.string().max(100).optional() });

/** Records an opened topic or lesson (at most once per item every 10 minutes). */
export async function recordActivity(db: D1Database, userId: string, input: z.infer<typeof activitySchema>) {
  const target = input.kind === 'LESSON_VIEW' ? input.resourceId : input.nodeId;
  if (!target) throw invalid('Say which topic or lesson was opened');
  const ctx =
    input.kind === 'LESSON_VIEW'
      ? await db.prepare('SELECT r.curriculum_node_id AS node_id, COALESCE(r.test_paper_id, v.test_paper_id) AS paper_id FROM learning_resources r LEFT JOIN curriculum_nodes n ON n.id = r.curriculum_node_id LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE r.id = ?').bind(target).first<{ node_id: string | null; paper_id: string | null }>()
      : await db.prepare('SELECT n.id AS node_id, v.test_paper_id AS paper_id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?').bind(target).first<{ node_id: string | null; paper_id: string | null }>();
  if (!ctx) throw notFound(input.kind === 'LESSON_VIEW' ? 'Lesson' : 'Topic');
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const recent = await db
    .prepare(`SELECT 1 FROM learning_activity WHERE user_id = ? AND kind = ? AND ${input.kind === 'LESSON_VIEW' ? 'resource_id' : 'curriculum_node_id'} = ? AND created_at > ?`)
    .bind(userId, input.kind, target, since)
    .first();
  if (recent) return { recorded: false };
  await db
    .prepare('INSERT INTO learning_activity (id, user_id, kind, curriculum_node_id, resource_id, test_paper_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('act'), userId, input.kind, ctx.node_id, input.kind === 'LESSON_VIEW' ? target : null, ctx.paper_id, nowIso())
    .run();
  return { recorded: true };
}

// ---------------------------------------------------------------- goals

export const goalSchema = z.object({ questionsPerDay: z.number().int().min(0).max(500), lessonsPerDay: z.number().int().min(0).max(50) });

export async function getGoal(db: D1Database, userId: string) {
  const g = await db.prepare('SELECT questions_per_day, lessons_per_day FROM daily_goals WHERE user_id = ?').bind(userId).first<{ questions_per_day: number; lessons_per_day: number }>();
  return { questionsPerDay: g?.questions_per_day ?? 20, lessonsPerDay: g?.lessons_per_day ?? 1, custom: Boolean(g) };
}

export async function setGoal(db: D1Database, userId: string, input: z.infer<typeof goalSchema>) {
  await db
    .prepare(`INSERT INTO daily_goals (user_id, questions_per_day, lessons_per_day, updated_at) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id) DO UPDATE SET questions_per_day = excluded.questions_per_day, lessons_per_day = excluded.lessons_per_day, updated_at = excluded.updated_at`)
    .bind(userId, input.questionsPerDay, input.lessonsPerDay, nowIso())
    .run();
  return getGoal(db, userId);
}

// ---------------------------------------------------------------- planner

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const planItemSchema = z.object({
  day: daySchema,
  kind: z.enum(['TOPIC', 'LESSON', 'PRACTICE', 'MOCK', 'CUSTOM']),
  refId: z.string().max(100).nullable().optional(),
  title: z.string().trim().min(1).max(200),
});
export const planUpdateSchema = z.object({ day: daySchema.optional(), title: z.string().trim().min(1).max(200).optional(), done: z.boolean().optional() });

export async function listPlan(db: D1Database, userId: string, from: string, to: string) {
  daySchema.parse(from);
  daySchema.parse(to);
  const { results } = await db
    .prepare('SELECT id, day, kind, ref_id, title, done FROM study_plan_items WHERE user_id = ? AND day BETWEEN ? AND ? ORDER BY day, created_at')
    .bind(userId, from, to)
    .all<{ id: string; day: string; kind: string; ref_id: string | null; title: string; done: number }>();
  return results.map((r) => ({ id: r.id, day: r.day, kind: r.kind, refId: r.ref_id, title: r.title, done: Boolean(r.done) }));
}

export async function addPlanItem(db: D1Database, userId: string, input: z.infer<typeof planItemSchema>) {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM study_plan_items WHERE user_id = ? AND day = ?').bind(userId, input.day).first<{ n: number }>();
  if ((count?.n ?? 0) >= 30) throw invalid('A day can hold at most 30 plan items');
  const id = newId('plan');
  const now = nowIso();
  await db
    .prepare('INSERT INTO study_plan_items (id, user_id, day, kind, ref_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
    .bind(id, userId, input.day, input.kind, input.refId ?? null, input.title, now, now)
    .run();
  return { id };
}

export async function updatePlanItem(db: D1Database, userId: string, id: string, input: z.infer<typeof planUpdateSchema>) {
  const cur = await db.prepare('SELECT day, title, done FROM study_plan_items WHERE id = ? AND user_id = ?').bind(id, userId).first<{ day: string; title: string; done: number }>();
  if (!cur) throw notFound('Plan item');
  await db
    .prepare('UPDATE study_plan_items SET day = ?, title = ?, done = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(input.day ?? cur.day, input.title ?? cur.title, input.done === undefined ? cur.done : input.done ? 1 : 0, nowIso(), id, userId)
    .run();
  return { id };
}

export async function deletePlanItem(db: D1Database, userId: string, id: string) {
  const res = await db.prepare('DELETE FROM study_plan_items WHERE id = ? AND user_id = ?').bind(id, userId).run();
  if (!res.meta.changes) throw notFound('Plan item');
  return { deleted: true };
}

// ---------------------------------------------------------------- dashboard

export const dashboardQuery = z.object({ day: daySchema, since: z.iso.datetime() });

export async function dashboard(db: D1Database, userId: string, q: z.infer<typeof dashboardQuery>) {
  const [continueRows, inProgress, answeredToday, lessonsToday, goal, plan, prog, bookmarks, cards] = await Promise.all([
    db
      .prepare(
        `SELECT a.kind, a.curriculum_node_id AS node_id, a.resource_id, MAX(a.created_at) AS at, n.title AS topic, r.title AS lesson, p.name AS paper, p.code AS paper_code
         FROM learning_activity a LEFT JOIN curriculum_nodes n ON n.id = a.curriculum_node_id LEFT JOIN learning_resources r ON r.id = a.resource_id
         LEFT JOIN test_papers p ON p.id = a.test_paper_id
         WHERE a.user_id = ? GROUP BY a.kind, COALESCE(a.resource_id, a.curriculum_node_id) ORDER BY at DESC LIMIT 6`,
      )
      .bind(userId)
      .all<Record<string, string | null>>(),
    db
      .prepare(`SELECT s.id, s.mode, s.started_at, s.duration_seconds, p.name AS paper, n.title AS topic FROM practice_sessions s LEFT JOIN test_papers p ON p.id = s.test_paper_id LEFT JOIN curriculum_nodes n ON n.id = s.curriculum_node_id WHERE s.user_id = ? AND s.status = 'IN_PROGRESS' ORDER BY s.started_at DESC LIMIT 5`)
      .bind(userId)
      .all<Record<string, string | number | null>>(),
    db.prepare(`SELECT COUNT(*) AS n FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ? AND a.answered_at >= ?`).bind(userId, q.since).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(DISTINCT resource_id) AS n FROM learning_activity WHERE user_id = ? AND kind = 'LESSON_VIEW' AND created_at >= ?`).bind(userId, q.since).first<{ n: number }>(),
    getGoal(db, userId),
    listPlan(db, userId, q.day, q.day),
    progress(db, userId),
    db.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?').bind(userId).first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(due_on <= ?2), 0) AS due, (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?1 AND kind = 'CONCEPT') AS concepts FROM flashcards WHERE user_id = ?1`)
      .bind(userId, q.day)
      .first<{ total: number; due: number; concepts: number }>(),
  ]);
  const now = Date.now();
  return {
    continueLearning: continueRows.results.map((r) => ({ kind: r.kind, nodeId: r.node_id, resourceId: r.resource_id, title: r.lesson ?? r.topic, paper: r.paper, paperCode: r.paper_code, at: r.at })),
    inProgress: inProgress.results
      .filter((s) => s.duration_seconds === null || new Date(String(s.started_at)).getTime() + Number(s.duration_seconds) * 1000 > now)
      .map((s) => ({ id: s.id, mode: s.mode, paper: s.paper, topic: s.topic, startedAt: s.started_at })),
    today: { questionsAnswered: answeredToday?.n ?? 0, lessonsOpened: lessonsToday?.n ?? 0, goal },
    plan,
    weakTopics: prog.weakTopics.slice(0, 5),
    subjects: prog.subjects,
    totals: prog.totals,
    bookmarks: bookmarks?.n ?? 0,
    savedConcepts: cards?.concepts ?? 0,
    flashcards: { total: cards?.total ?? 0, due: cards?.due ?? 0 },
  };
}

// ---------------------------------------------------------------- daily practice

export const dailySchema = z.object({ paperId: z.string().max(100).optional(), count: z.number().int().min(5).max(30).default(10) });

/** Ten questions from one subject: weak topics first, then topics not yet practised, then the rest. Untimed, instant feedback. */
export async function startDailyPractice(db: D1Database, preview: boolean, userId: string, input: z.infer<typeof dailySchema>) {
  const paperId =
    input.paperId ??
    (
      await db
        .prepare(
          `SELECT paper_id FROM (
             SELECT test_paper_id AS paper_id, started_at AS at FROM practice_sessions WHERE user_id = ?1 AND test_paper_id IS NOT NULL
             UNION ALL SELECT test_paper_id, created_at FROM learning_activity WHERE user_id = ?1 AND test_paper_id IS NOT NULL)
           ORDER BY at DESC LIMIT 1`,
        )
        .bind(userId)
        .first<{ paper_id: string }>()
    )?.paper_id;
  const chosen =
    paperId ??
    JSON.parse((await db.prepare('SELECT paper_ids_json FROM student_preferences WHERE user_id = ?').bind(userId).first<{ paper_ids_json: string }>())?.paper_ids_json ?? '[]')[0];
  if (!chosen) throw new ApiError(404, 'NO_SUBJECT_YET', 'Choose your subjects on your profile, or open a subject first, then daily practice can pick questions for you');
  const { results } = await db
    .prepare(
      `SELECT q.id,
         MIN(CASE WHEN tp.attempted >= 3 AND 1.0 * tp.correct / tp.attempted < 0.6 THEN 0 WHEN tp.attempted IS NULL THEN 1 ELSE 2 END) AS bucket
       FROM questions q JOIN question_topics qt ON qt.question_id = q.id JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
       JOIN syllabus_versions v ON v.id = n.syllabus_version_id
       LEFT JOIN topic_progress tp ON tp.user_id = ?3 AND tp.curriculum_node_id = qt.curriculum_node_id
       WHERE v.test_paper_id = ?2 AND ${VISIBLE_CONTENT('q')}
         AND q.id NOT IN (SELECT a.question_id FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ?3 AND a.outcome = 'CORRECT' AND a.answered_at > datetime('now', '-3 days'))
       GROUP BY q.id ORDER BY bucket, random() LIMIT ?4`,
    )
    .bind(preview ? 1 : 0, chosen, userId, input.count)
    .all<{ id: string }>();
  if (!results.length) throw new ApiError(404, 'NO_QUESTIONS', 'No practice questions are available for this subject yet');
  return createSession(db, userId, { mode: 'PRACTICE', paperId: chosen, nodeId: null, ids: results.map((r) => r.id) });
}

// ---------------------------------------------------------------- revision notes

/** The revision essentials of a topic and everything under it: definitions, formulas, key points, facts, exam tips. */
export async function revisionNotes(db: D1Database, preview: boolean, nodeId: string) {
  const node = await db
    .prepare(`SELECT n.id, n.title, n.kind, n.label, tp.id AS paper_id, tp.name AS paper FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers tp ON tp.id = v.test_paper_id WHERE n.id = ?2 AND ${VISIBLE_SYLLABUS('v')}`)
    .bind(preview ? 1 : 0, nodeId)
    .first<Record<string, string | null>>();
  if (!node) throw notFound('Topic');
  const { results } = await db
    .prepare(
      `WITH RECURSIVE sub(id) AS (SELECT ?2 UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
       SELECT r.id AS resource_id, r.title AS lesson, b.position, b.type, b.body
       FROM learning_resources r JOIN content_blocks b ON b.resource_id = r.id
       WHERE r.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('r')}
         AND b.type IN ('DEFINITION','FORMULA','KEY_POINT','IMPORTANT_FACT','CALLOUT')
       ORDER BY r.title, b.position`,
    )
    .bind(preview ? 1 : 0, nodeId)
    .all<{ resource_id: string; lesson: string; position: number; type: string; body: string }>();
  const concepts = await conceptsOfResources(db, results.map((r) => r.resource_id));
  const lessons = new Map<string, { resourceId: string; lesson: string; blocks: { type: string; body: string; position: number; conceptKey: string | null; anchor: string | null }[] }>();
  for (const r of results) {
    if (!lessons.has(r.resource_id)) lessons.set(r.resource_id, { resourceId: r.resource_id, lesson: r.lesson, blocks: [] });
    const c = concepts.get(r.resource_id)?.find((x) => x.position === r.position);
    lessons.get(r.resource_id)!.blocks.push({ type: r.type, body: r.body, position: r.position, conceptKey: c?.key ?? null, anchor: c?.anchor ?? null });
  }
  return { topic: { id: node.id, title: node.title, kind: node.kind, label: node.label, paperId: node.paper_id, paper: node.paper }, lessons: [...lessons.values()] };
}
