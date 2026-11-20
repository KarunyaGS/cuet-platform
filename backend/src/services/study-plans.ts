/**
 * Study plans: the database side of the expert-guided planner.
 *
 * The plan builder (`plan-builder.ts`) is pure. This file gathers what it needs (the syllabus, the student's own activity and results, the labs
 * the screen knows about, verified trends), saves the plan the student accepts, and then looks after it: it notices what the student has done on
 * the platform, adjusts the schedule when a day is missed or finished early, pauses and resumes, and regenerates when the goal changes.
 *
 * The suggestion the builder first made is kept untouched in `study_plans.original_json`. The student's live, customised version is their
 * `study_plan_items`, the same table the weekly planner and the dashboard already read, so the planner, Today and Progress all agree.
 */
import { z } from 'zod';
import { conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import type { Keep } from '../lib/scope';
import { insertRows, nowIso } from '../lib/sql';
import { listSubjects, paperOutline, VISIBLE_CONTENT } from './learning';
import { adaptSchedule, addDay, type AdaptItem, type Change } from './plan-adapt';
import { buildPlan, type BuiltItem, type GoalInput, type LabInfo, type PlanOut, type StudentState, type SubjectInfo, type TopicInfo, type TrendInfo } from './plan-builder';
import { DURATIONS, GENERATOR_VERSION, METHOD_REVIEW, MINUTES_BOUNDS, OBJECTIVES, PATHS, SETTINGS, TEMPLATES, type DurationDays } from './plan-method';

const dayRe = /^\d{4}-\d{2}-\d{2}$/;
const day = z.string().regex(dayRe);
export const PATH_IDS = PATHS.map((p) => p.id) as [string, ...string[]];
export const OBJECTIVE_IDS = OBJECTIVES.map((o) => o.id) as [string, ...string[]];

export const labSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  subject: z.string().max(60),
  lessonTitleStartsWith: z.string().min(3).max(300),
  title: z.string().min(2).max(200),
  minutes: z.number().int().min(5).max(120),
});

export const goalSchema = z.object({
  examCode: z.literal('CUET_UG'),
  path: z.enum(PATH_IDS),
  paperIds: z.array(z.string().max(100)).min(1).max(8),
  objectives: z.array(z.enum(OBJECTIVE_IDS)).max(9).default([]),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  minutesPerDay: z.number().int().min(MINUTES_BOUNDS.min).max(MINUTES_BOUNDS.max).default(MINUTES_BOUNDS.fallback),
  coverage: z.enum(['LIGHT', 'STANDARD', 'FULL']).default('STANDARD'),
  startDay: day,
  /** The practical labs the screen offers (the browser holds that list), so a lab can be suggested beside its chapter. */
  labs: z.array(labSchema).max(200).default([]),
});
export type GoalBody = z.infer<typeof goalSchema>;

/** A day from the browser (the student's own calendar) must be close to the server's, so a wrong clock cannot place a plan years away. */
function checkDay(d: string, label = 'day') {
  const t = Date.parse(`${d}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== d) throw invalid(`The ${label} is not a real date`);
  if (Math.abs(t - Date.now()) > 3 * 86_400_000) throw invalid(`The ${label} must be today's date on your calendar`);
}

export interface PlanContext { preview: boolean; keep: Keep }

// ---------------------------------------------------------------- options

export async function plannerOptions(db: D1Database, ctx: PlanContext, userId: string, year: number) {
  const subjects = (await listSubjects(db, ctx.preview, 'CUET_UG', year, ctx.keep)) as unknown as {
    paperId: string; code: string; name: string; category: { code: string | null; name: string | null }; topics: number; questions: number; units: number; verification: string | null;
  }[];
  const prefs = await db.prepare('SELECT paper_ids_json FROM student_preferences WHERE user_id = ?').bind(userId).first<{ paper_ids_json: string }>();
  const mine: string[] = prefs ? JSON.parse(prefs.paper_ids_json) : [];
  // A subject can be planned if its syllabus has topics, or at least units (some syllabi stop at chapters).
  const withContent = subjects.filter((s) => (Number(s.topics) || 0) + (Number(s.units) || 0) > 0 && Number(s.questions) > 0);
  return {
    exams: [{ code: 'CUET_UG', name: 'CUET (UG)', year, supported: true }],
    // What is not offered is said, not hidden or pretended.
    notOffered: [
      { name: 'CUET (PG)', reason: 'CUET (PG) is not offered on the platform yet.' },
      { name: 'CET', reason: 'No CET syllabus or question bank is on the platform yet.' },
    ],
    subjects: withContent.map((s) => ({ paperId: s.paperId, code: s.code, name: s.name, category: s.category?.name ?? null, topics: Number(s.topics) > 0 ? Number(s.topics) : Number(s.units), questions: s.questions, verified: s.verification === 'VERIFIED' })),
    paths: PATHS.map((p) => ({ id: p.id, label: p.label, blurb: p.blurb, objectives: p.objectives })),
    objectives: OBJECTIVES.map((o) => ({ id: o.id, label: o.label, blurb: o.blurb })),
    durations: DURATIONS.map((d) => ({ days: d.days, id: d.id, label: d.label, blurb: d.blurb, phases: TEMPLATES[d.days].phases })),
    defaults: { paperIds: mine.filter((id) => withContent.some((s) => s.paperId === id)), minutesPerDay: MINUTES_BOUNDS.fallback, minutesBounds: { min: MINUTES_BOUNDS.min, max: MINUTES_BOUNDS.max } },
    methodReview: METHOD_REVIEW,
  };
}

// ---------------------------------------------------------------- gathering what the builder needs

interface OutlineNode { id: string; parent_id: string | null; kind: string; title: string; depth: number; position: number; resources: number; questions: number }

async function topicsOf(db: D1Database, ctx: PlanContext, paperId: string, tree: { subtreeQuestions: Map<string, number> } | null = null): Promise<{ topics: (TopicInfo & { subtree: string[] })[]; questions: number }> {
  const outline = (await paperOutline(db, ctx.preview, paperId)) as unknown as { nodes: OutlineNode[]; paper: Record<string, unknown> };
  const nodes = outline.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, OutlineNode[]>();
  for (const n of nodes) if (n.parent_id) children.set(n.parent_id, [...(children.get(n.parent_id) ?? []), n]);
  // Rows inside a note box (question-paper instructions) are not syllabus content.
  const inNote = (n: OutlineNode): boolean => { for (let p: OutlineNode | undefined = n; p; p = p.parent_id ? byId.get(p.parent_id) : undefined) if (p.kind === 'NOTE') return true; return false; };
  const usable = nodes.filter((n) => !inNote(n));
  const subtree = (n: OutlineNode): OutlineNode[] => [n, ...(children.get(n.id) ?? []).flatMap(subtree)];
  const pathKey = (n: OutlineNode): number[] => { const k: number[] = []; for (let p: OutlineNode | undefined = n; p; p = p.parent_id ? byId.get(p.parent_id) : undefined) k.unshift(Number(p.position)); return k; };
  const unitOf = (n: OutlineNode): OutlineNode => { for (let p: OutlineNode | undefined = n; p; p = p.parent_id ? byId.get(p.parent_id) : undefined) if (['UNIT', 'CHAPTER'].includes(p.kind)) return p; return n; };
  const lessonBearing = usable.filter((n) => Number(n.resources) > 0);
  // A syllabus that stops at units (chapters) has no smaller topics: the unit itself is the thing to study.
  const leaves = usable.filter((n) => ['UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM'].includes(n.kind) && !(children.get(n.id) ?? []).length);
  const chosen = (lessonBearing.length ? lessonBearing : leaves).filter((n) => subtree(n).reduce((s, x) => s + Number(x.questions), 0) > 0 || Number(n.resources) > 0);
  chosen.sort((a, b) => { const ka = pathKey(a); const kb = pathKey(b); for (let i = 0; i < Math.max(ka.length, kb.length); i++) { const d = (ka[i] ?? -1) - (kb[i] ?? -1); if (d) return d; } return a.id.localeCompare(b.id); });
  const lessons = new Map<string, { id: string; title: string; blocks: number }[]>();
  for (let i = 0; i < chosen.length; i += 70) {
    const part = chosen.slice(i, i + 70);
    const { results } = await db
      .prepare(
        `SELECT r.id, r.curriculum_node_id AS node_id, r.title, (SELECT COUNT(*) FROM content_blocks b WHERE b.resource_id = r.id) AS blocks
         FROM learning_resources r WHERE r.type = 'LESSON' AND r.curriculum_node_id IN (${part.map((_, k) => `?${k + 2}`).join(',')}) AND ${VISIBLE_CONTENT('r')} ORDER BY r.title`,
      )
      .bind(ctx.preview ? 1 : 0, ...part.map((n) => n.id))
      .all<{ id: string; node_id: string; title: string; blocks: number }>();
    for (const r of results) lessons.set(r.node_id, [...(lessons.get(r.node_id) ?? []), { id: r.id, title: r.title, blocks: Number(r.blocks) }]);
  }
  void tree;
  const topics = chosen.map((n, order) => {
    const ls = lessons.get(n.id) ?? [];
    const unit = unitOf(n);
    const sub = subtree(n);
    return {
      nodeId: n.id, unitNodeId: unit.id, unitTitle: unit.id === n.id ? null : unit.title, title: n.title, order, lessonIds: ls.map((l) => l.id), lessonTitles: ls.map((l) => l.title),
      contentBlocks: ls.reduce((s, l) => s + l.blocks, 0), questionCount: sub.reduce((s, x) => s + Number(x.questions), 0), subtree: sub.map((x) => x.id),
    };
  });
  return { topics, questions: 0 };
}

async function studentState(db: D1Database, userId: string, topics: (TopicInfo & { subtree: string[] })[]): Promise<StudentState['topics']> {
  const [progress, viewed, labs] = await Promise.all([
    db.prepare('SELECT curriculum_node_id AS id, attempted, correct, incorrect FROM topic_progress WHERE user_id = ?').bind(userId).all<{ id: string; attempted: number; correct: number; incorrect: number }>(),
    db.prepare(`SELECT DISTINCT curriculum_node_id AS id FROM learning_activity WHERE user_id = ? AND kind IN ('TOPIC_VIEW','LESSON_VIEW') AND curriculum_node_id IS NOT NULL`).bind(userId).all<{ id: string }>(),
    db.prepare(`SELECT DISTINCT curriculum_node_id AS id FROM learning_activity WHERE user_id = ? AND kind = 'LAB_COMPLETE' AND curriculum_node_id IS NOT NULL`).bind(userId).all<{ id: string }>(),
  ]);
  const prog = new Map(progress.results.map((r) => [r.id, r]));
  const opened = new Set(viewed.results.map((r) => r.id));
  const labDone = new Set(labs.results.map((r) => r.id));
  const out: StudentState['topics'] = {};
  for (const t of topics) {
    let attempted = 0, correct = 0, incorrect = 0;
    for (const id of t.subtree) { const p = prog.get(id); if (p) { attempted += Number(p.attempted); correct += Number(p.correct); incorrect += Number(p.incorrect); } }
    out[t.nodeId] = { opened: opened.has(t.nodeId), attempted, correct, incorrect, labDone: labDone.has(t.nodeId) };
  }
  return out;
}

/** Verified past-paper frequency per topic, with the subject's verified sample. Absent tables or too little data give no trend at all. */
async function verifiedTrends(db: D1Database, subjects: { paperId: string; topics: (TopicInfo & { subtree: string[] })[] }[]): Promise<TrendInfo[]> {
  const out: TrendInfo[] = [];
  for (const s of subjects) {
    const ids = s.topics.flatMap((t) => t.subtree);
    if (!ids.length) continue;
    try {
      const { results } = await db
        .prepare(
          `SELECT m.curriculum_node_id AS node_id, COUNT(DISTINCT m.past_paper_question_id) AS freq, pp.id AS paper, pp.year AS year
           FROM paper_topic_mappings m JOIN past_paper_questions pq ON pq.id = m.past_paper_question_id JOIN past_papers pp ON pp.id = pq.past_paper_id
           WHERE m.status = 'VERIFIED' AND pp.status = 'PUBLISHED' AND pp.key_version = 'FINAL' AND m.curriculum_node_id IN (${ids.slice(0, 90).map(() => '?').join(',')})
           GROUP BY m.curriculum_node_id, pp.id, pp.year`,
        )
        .bind(...ids.slice(0, 90))
        .all<{ node_id: string; freq: number; paper: string; year: number }>();
      const papers = new Set(results.map((r) => r.paper));
      const years = [...new Set(results.map((r) => r.year))].sort();
      const sample = results.reduce((n, r) => n + Number(r.freq), 0);
      for (const t of s.topics) {
        const f = results.filter((r) => t.subtree.includes(r.node_id)).reduce((n, r) => n + Number(r.freq), 0);
        if (f > 0) out.push({ nodeId: t.nodeId, frequency: f, sampleSize: sample, paperCount: papers.size, years });
      }
    } catch {
      /* the mapping tables are not on this database: there is simply no verified trend */
    }
  }
  return out;
}

export interface Generated { goal: Omit<GoalBody, 'labs'>; out: PlanOut; subjects: (SubjectInfo & { subtree?: unknown })[]; topicsByPaper: Map<string, (TopicInfo & { subtree: string[] })[]> }

export async function generatePlan(db: D1Database, ctx: PlanContext, userId: string, body: GoalBody, year: number): Promise<Generated> {
  checkDay(body.startDay, 'start day');
  const listed = (await listSubjects(db, ctx.preview, 'CUET_UG', year, ctx.keep)) as unknown as { paperId: string; code: string; name: string; questions: number }[];
  const chosen = [...new Set(body.paperIds)];
  const subjects: SubjectInfo[] = [];
  const state: StudentState = { topics: {} };
  const topicsByPaper = new Map<string, (TopicInfo & { subtree: string[] })[]>();
  for (const id of chosen) {
    const row = listed.find((s) => s.paperId === id);
    if (!row) throw invalid('One of the chosen subjects is not available for planning');
    const { topics } = await topicsOf(db, ctx, id);
    topicsByPaper.set(id, topics);
    Object.assign(state.topics, await studentState(db, userId, topics));
    subjects.push({ paperId: id, code: row.code, name: row.name, topics: topics.map(({ subtree, ...t }) => t), fullMockQuestions: Number(row.questions ?? 0) });
  }
  const labs: LabInfo[] = body.labs;
  const trends = await verifiedTrends(db, chosen.map((id) => ({ paperId: id, topics: topicsByPaper.get(id)! })));
  const { labs: _labs, examCode: _exam, paperIds: _ids, ...rest } = body;
  const goal: GoalInput = { path: body.path as GoalInput['path'], objectives: body.objectives as GoalInput['objectives'], durationDays: body.durationDays as DurationDays, minutesPerDay: body.minutesPerDay, coverage: body.coverage, startDay: body.startDay };
  void rest;
  const out = buildPlan(goal, subjects, state, labs, trends);
  return { goal: { examCode: 'CUET_UG', path: body.path, paperIds: chosen, objectives: body.objectives, durationDays: body.durationDays, minutesPerDay: body.minutesPerDay, coverage: body.coverage, startDay: body.startDay }, out, subjects, topicsByPaper };
}

const fingerprintOf = async (g: Generated) => {
  const data = new TextEncoder().encode(JSON.stringify([GENERATOR_VERSION, g.goal, g.out.items.map((i) => [i.day, i.kind, i.refId, i.minutes])]));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export async function previewPlan(db: D1Database, ctx: PlanContext, userId: string, body: GoalBody, year: number) {
  const g = await generatePlan(db, ctx, userId, body, year);
  return { goal: g.goal, plan: g.out, fingerprint: await fingerprintOf(g), generatorVersion: GENERATOR_VERSION, methodReview: METHOD_REVIEW };
}

// ---------------------------------------------------------------- saving

interface PlanRow {
  id: string; user_id: string; title: string; exam_code: string; duration_days: number; start_day: string; end_day: string; minutes_per_day: number; goal_json: string; original_json: string;
  evidence_json: string; generator_version: string; status: string; paused_on: string | null; light_days_json: string; version: number; created_at: string; updated_at: string;
}
const prefixKey = (v: number, k: string | null) => (k ? `v${v}.${k}` : null);

function itemRows(userId: string, planId: string, version: number, items: BuiltItem[], now: string) {
  return items.map((i) => ({
    id: newId('plan'), user_id: userId, day: i.date, kind: i.kind, ref_id: i.refId, title: i.title, done: 0, plan_id: planId, origin: 'EXPERT', original_day: i.date,
    suggestion_key: prefixKey(version, i.key), depends_on: prefixKey(version, i.dependsOn), subject_code: i.subjectCode, minutes: i.minutes, target_count: i.targetCount, note: i.note, evidence: i.evidence,
    position: i.position, pinned: 0, status: 'SCHEDULED', created_at: now, updated_at: now,
  }));
}
const titleFor = (g: Generated) => {
  const names = g.out.summary.subjects.map((s) => s.name.split('/')[0]!.trim());
  const d = DURATIONS.find((x) => x.days === g.goal.durationDays)!;
  return `${d.label}: ${names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')}`;
};

async function batchAll(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
}

const event = (db: D1Database, planId: string, action: string, note: string | null, detail: unknown) =>
  db.prepare('INSERT INTO study_plan_events (id, plan_id, action, note, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('spe'), planId, action, note, detail === null ? null : JSON.stringify(detail), nowIso());

export async function createPlan(db: D1Database, ctx: PlanContext, userId: string, body: GoalBody, year: number, opts: { replace: boolean; fingerprint?: string }) {
  const g = await generatePlan(db, ctx, userId, body, year);
  if (!g.out.items.length) throw invalid(g.out.warnings.join(' ') || 'Nothing could be planned from these choices');
  if (opts.fingerprint && opts.fingerprint !== (await fingerprintOf(g))) throw conflict('Your progress or the syllabus changed since this plan was shown. Review the updated plan and add it again.');
  const active = await db.prepare(`SELECT id FROM study_plans WHERE user_id = ? AND status IN ('ACTIVE','PAUSED')`).bind(userId).all<{ id: string }>();
  if (active.results.length && !opts.replace) throw conflict('You already have a plan running. Choose to replace it, or finish it first.', { code: 'PLAN_ACTIVE' });
  const id = newId('splan');
  const now = nowIso();
  const lastDay = addDay(body.startDay, body.durationDays - 1);
  const stmts: D1PreparedStatement[] = [];
  const today = body.startDay;
  for (const a of active.results) {
    // The old plan ends. What was done and what the student added stay; its suggestions still to come are removed.
    stmts.push(db.prepare(`DELETE FROM study_plan_items WHERE plan_id = ? AND done = 0 AND origin = 'EXPERT' AND day >= ?`).bind(a.id, today));
    stmts.push(db.prepare(`UPDATE study_plans SET status = 'ARCHIVED', updated_at = ? WHERE id = ?`).bind(now, a.id));
    stmts.push(event(db, a.id, 'REPLACED', 'Replaced by a new plan', { by: id }));
  }
  stmts.push(
    db
      .prepare(
        `INSERT INTO study_plans (id, user_id, title, exam_code, duration_days, start_day, end_day, minutes_per_day, goal_json, original_json, evidence_json, generator_version, status, light_days_json, version, created_at, updated_at)
         VALUES (?, ?, ?, 'CUET_UG', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 1, ?, ?)`,
      )
      .bind(id, userId, titleFor(g), body.durationDays, body.startDay, lastDay, body.minutesPerDay, JSON.stringify(g.goal), JSON.stringify({ items: g.out.items, days: g.out.days, version: 1 }),
        JSON.stringify({ summary: g.out.summary, warnings: g.out.warnings, methodReview: METHOD_REVIEW }), GENERATOR_VERSION, JSON.stringify(TEMPLATES[body.durationDays].lightDays), now, now),
    ...insertRows(db, 'study_plan_items', itemRows(userId, id, 1, g.out.items, now)),
    event(db, id, 'CREATED', null, { goal: g.goal, items: g.out.items.length }),
  );
  await batchAll(db, stmts);
  return { id };
}

// ---------------------------------------------------------------- reading a plan, and noticing what the student has done

interface ItemRow {
  id: string; day: string; kind: string; ref_id: string | null; title: string; done: number; plan_id: string | null; origin: string; original_day: string | null; suggestion_key: string | null; depends_on: string | null;
  subject_code: string | null; minutes: number | null; target_count: number | null; note: string | null; evidence: string | null; position: number; pinned: number; status: string; done_by: string | null; created_at: string;
}

/** Ticks off the activities the student has already done on the platform (a lesson opened, a practice set submitted, a mock test taken, a lab finished). */
async function syncWithActivity(db: D1Database, userId: string, plan: PlanRow, items: ItemRow[]) {
  const open = items.filter((i) => !i.done && i.status === 'SCHEDULED');
  if (!open.length) return 0;
  const since = plan.created_at;
  const ticks: string[] = [];
  const ids = (xs: ItemRow[]) => xs.map((x) => x.ref_id).filter((x): x is string => Boolean(x));
  const lessons = ids(open.filter((i) => i.kind === 'LESSON'));
  const topics = ids(open.filter((i) => i.kind === 'TOPIC'));
  const seenLessons = new Set<string>();
  const seenTopics = new Set<string>();
  if (lessons.length) {
    const { results } = await db.prepare(`SELECT DISTINCT resource_id AS id FROM learning_activity WHERE user_id = ? AND kind = 'LESSON_VIEW' AND created_at >= ? AND resource_id IN (${lessons.map(() => '?').join(',')})`).bind(userId, since, ...lessons).all<{ id: string }>();
    for (const r of results) seenLessons.add(r.id);
  }
  if (topics.length) {
    const { results } = await db.prepare(`SELECT DISTINCT curriculum_node_id AS id FROM learning_activity WHERE user_id = ? AND kind = 'TOPIC_VIEW' AND created_at >= ? AND curriculum_node_id IN (${topics.map(() => '?').join(',')})`).bind(userId, since, ...topics).all<{ id: string }>();
    for (const r of results) seenTopics.add(r.id);
  }
  const byKey = new Map(items.map((i) => [i.suggestion_key, i]));
  for (const i of open) {
    if (i.kind === 'LESSON' && i.ref_id && seenLessons.has(i.ref_id)) ticks.push(i.id);
    else if (i.kind === 'TOPIC' && i.ref_id && seenTopics.has(i.ref_id)) ticks.push(i.id);
    else if (i.kind === 'LAB') {
      const lesson = i.depends_on ? byKey.get(i.depends_on) : undefined;
      if (lesson?.kind === 'LESSON' && lesson.ref_id) {
        const r = await db.prepare(`SELECT 1 AS ok FROM learning_activity WHERE user_id = ? AND kind = 'LAB_COMPLETE' AND resource_id = ? AND created_at >= ? LIMIT 1`).bind(userId, lesson.ref_id, since).first();
        if (r) ticks.push(i.id);
      }
    } else if ((i.kind === 'PRACTICE' || i.kind === 'CHECKPOINT') && i.ref_id) {
      const need = Math.max(3, Math.ceil((i.target_count ?? 10) * 0.6));
      const r = await db
        .prepare(
          `SELECT COUNT(a.id) AS n FROM practice_sessions s JOIN practice_answers a ON a.session_id = s.id WHERE s.user_id = ? AND s.status = 'SUBMITTED' AND s.curriculum_node_id = ? AND s.started_at >= ? AND s.mode IN ('PRACTICE','TOPIC_TEST') GROUP BY s.id ORDER BY n DESC LIMIT 1`,
        )
        .bind(userId, i.ref_id, since)
        .first<{ n: number }>();
      if (r && Number(r.n) >= need) ticks.push(i.id);
    } else if (i.kind === 'MOCK' && i.ref_id) {
      const r = await db.prepare(`SELECT 1 AS ok FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED' AND mode = 'MOCK_TEST' AND test_paper_id = ? AND started_at >= ? LIMIT 1`).bind(userId, i.ref_id, since).first();
      if (r) ticks.push(i.id);
    }
  }
  if (!ticks.length) return 0;
  const now = nowIso();
  await batchAll(db, ticks.map((id) => db.prepare(`UPDATE study_plan_items SET done = 1, done_by = 'ACTIVITY', done_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`).bind(now, now, id, userId)));
  return ticks.length;
}

const viewItem = (i: ItemRow, latestSession: Map<string, string>) => ({
  id: i.id, day: i.day, kind: i.kind, refId: i.ref_id, title: i.title, done: Boolean(i.done), doneBy: i.done_by, origin: i.origin, originalDay: i.original_day, subjectCode: i.subject_code, minutes: i.minutes,
  targetCount: i.target_count, note: i.note, evidence: i.evidence, position: i.position, pinned: Boolean(i.pinned), status: i.status, suggestionKey: i.suggestion_key, dependsOn: i.depends_on,
  moved: Boolean(i.original_day && i.original_day !== i.day), latestSessionId: i.kind === 'REVIEW' && i.ref_id ? latestSession.get(i.ref_id) ?? null : null,
});

export async function currentPlan(db: D1Database, userId: string, asOf: string) {
  checkDay(asOf, 'day');
  const plan = await db.prepare(`SELECT * FROM study_plans WHERE user_id = ? AND status IN ('ACTIVE','PAUSED') ORDER BY created_at DESC LIMIT 1`).bind(userId).first<PlanRow>();
  if (!plan) return { plan: null };
  const load = async () => (await db.prepare('SELECT * FROM study_plan_items WHERE plan_id = ? AND user_id = ? ORDER BY day, position, created_at').bind(plan.id, userId).all<ItemRow>()).results;
  let items = await load();
  if (plan.status === 'ACTIVE' && (await syncWithActivity(db, userId, plan, items))) items = await load();
  const reviewPapers = [...new Set(items.filter((i) => i.kind === 'REVIEW' && i.ref_id).map((i) => i.ref_id!))];
  const latest = new Map<string, string>();
  for (const p of reviewPapers) {
    const r = await db.prepare(`SELECT id FROM practice_sessions WHERE user_id = ? AND test_paper_id = ? AND status = 'SUBMITTED' ORDER BY submitted_at DESC LIMIT 1`).bind(userId, p).first<{ id: string }>();
    if (r) latest.set(p, r.id);
  }
  const original = JSON.parse(plan.original_json) as { items: BuiltItem[]; days: { day: number; date: string; capacity: number }[]; version: number };
  const evidence = JSON.parse(plan.evidence_json) as { summary: PlanOut['summary']; warnings: string[]; methodReview: typeof METHOD_REVIEW };
  const liveKeys = new Set(items.map((i) => i.suggestion_key));
  const removed = original.items.filter((o) => !liveKeys.has(prefixKey(plan.version, o.key))).map((o) => ({ suggestionKey: prefixKey(plan.version, o.key)!, day: o.date, kind: o.kind, title: o.title, minutes: o.minutes }));
  const events = (await db.prepare('SELECT action, note, detail_json, created_at FROM study_plan_events WHERE plan_id = ? ORDER BY created_at DESC LIMIT 8').bind(plan.id).all<{ action: string; note: string | null; detail_json: string | null; created_at: string }>()).results;
  const sched = items.filter((i) => i.status === 'SCHEDULED');
  const doneItems = sched.filter((i) => i.done);
  const sum = (xs: ItemRow[]) => xs.reduce((n, i) => n + (i.minutes ?? 0), 0);
  const dayList = [...new Set(sched.map((i) => i.day))].sort();
  const perDay = dayList.map((d) => ({ day: d, planned: sum(sched.filter((i) => i.day === d)), done: sum(doneItems.filter((i) => i.day === d)), items: sched.filter((i) => i.day === d).length, doneItems: doneItems.filter((i) => i.day === d).length }));
  return {
    plan: {
      id: plan.id, title: plan.title, status: plan.status, pausedOn: plan.paused_on, startDay: plan.start_day, endDay: plan.end_day, durationDays: plan.duration_days, minutesPerDay: plan.minutes_per_day,
      version: plan.version, goal: JSON.parse(plan.goal_json) as Record<string, unknown>, lightDays: (JSON.parse(plan.light_days_json) as number[]).map((n) => addDay(plan.start_day, n - 1)),
      summary: evidence.summary, warnings: evidence.warnings, methodReview: METHOD_REVIEW, createdAt: plan.created_at,
    },
    items: items.map((i) => viewItem(i, latest)),
    removed,
    progress: {
      totalItems: sched.length, doneItems: doneItems.length, totalMinutes: sum(sched), doneMinutes: sum(doneItems),
      percent: sched.length ? Math.round((100 * doneItems.length) / sched.length) : 0,
      byDay: perDay,
      bySubject: [...new Set(sched.map((i) => i.subject_code ?? 'other'))].map((c) => ({ code: c, planned: sum(sched.filter((i) => (i.subject_code ?? 'other') === c)), done: sum(doneItems.filter((i) => (i.subject_code ?? 'other') === c)) })),
      byKind: [...new Set(sched.map((i) => i.kind))].map((k) => ({ kind: k, planned: sched.filter((i) => i.kind === k).length, done: doneItems.filter((i) => i.kind === k).length })),
      deferred: items.filter((i) => i.status === 'DEFERRED').length,
      detected: items.filter((i) => i.done_by === 'ACTIVITY').length,
    },
    events: events.map((e) => ({ action: e.action, note: e.note, detail: e.detail_json ? JSON.parse(e.detail_json) : null, at: e.created_at })),
  };
}

// ---------------------------------------------------------------- keeping the plan on track

async function ownPlan(db: D1Database, userId: string, id: string) {
  const plan = await db.prepare('SELECT * FROM study_plans WHERE id = ? AND user_id = ?').bind(id, userId).first<PlanRow>();
  if (!plan) throw notFound('Plan');
  return plan;
}

function capacityFn(plan: PlanRow) {
  const light = new Set((JSON.parse(plan.light_days_json) as number[]).map((n) => addDay(plan.start_day, n - 1)));
  return (d: string) => Math.round(plan.minutes_per_day * (light.has(d) ? SETTINGS.lightDayFactor : 1));
}

export async function adjustPlan(db: D1Database, userId: string, planId: string, asOf: string, reason: string = 'ADJUSTED') {
  checkDay(asOf, 'day');
  const plan = await ownPlan(db, userId, planId);
  if (plan.status !== 'ACTIVE') throw conflict('Only a running plan can be adjusted');
  const rows = (await db.prepare('SELECT * FROM study_plan_items WHERE plan_id = ? AND user_id = ?').bind(planId, userId).all<ItemRow>()).results;
  if (await syncWithActivity(db, userId, plan, rows)) return adjustPlan(db, userId, planId, asOf, reason);
  const idByKey = new Map(rows.map((r) => [r.suggestion_key, r.id]));
  const adapt: AdaptItem[] = rows.map((r) => ({ id: r.id, day: r.day, minutes: r.minutes ?? 20, kind: r.kind, done: Boolean(r.done), pinned: Boolean(r.pinned), status: r.status === 'DEFERRED' ? 'DEFERRED' : 'SCHEDULED', dependsOnId: r.depends_on ? idByKey.get(r.depends_on) ?? null : null, position: r.position }));
  const { items, changes } = adaptSchedule(adapt, { startDay: plan.start_day, endDay: plan.end_day, capacityOf: capacityFn(plan) }, asOf);
  if (!changes.length) return { changes: [] as (Change & { title: string })[] };
  const now = nowIso();
  const stmts = items.filter((i) => { const o = adapt.find((a) => a.id === i.id)!; return o.day !== i.day || o.status !== i.status || o.position !== i.position; })
    .map((i) => db.prepare('UPDATE study_plan_items SET day = ?, status = ?, position = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(i.day, i.status, i.position, now, i.id, userId));
  const title = new Map(rows.map((r) => [r.id, r.title]));
  const detail = changes.map((c) => ({ ...c, title: title.get(c.id) ?? '' }));
  stmts.push(event(db, planId, reason, `${changes.length} ${changes.length === 1 ? 'activity' : 'activities'} moved`, detail));
  await batchAll(db, stmts);
  return { changes: detail };
}

export async function setPlanStatus(db: D1Database, userId: string, planId: string, action: 'PAUSE' | 'RESUME' | 'ARCHIVE', asOf: string) {
  checkDay(asOf, 'day');
  const plan = await ownPlan(db, userId, planId);
  const now = nowIso();
  if (action === 'PAUSE') {
    if (plan.status !== 'ACTIVE') throw conflict('Only a running plan can be paused');
    await batchAll(db, [db.prepare(`UPDATE study_plans SET status = 'PAUSED', paused_on = ?, updated_at = ? WHERE id = ?`).bind(asOf, now, planId), event(db, planId, 'PAUSED', null, { on: asOf })]);
    return { status: 'PAUSED' };
  }
  if (action === 'RESUME') {
    if (plan.status !== 'PAUSED') throw conflict('Only a paused plan can be resumed');
    const pausedOn = plan.paused_on ?? asOf;
    const shift = Math.max(0, Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${pausedOn}T00:00:00Z`)) / 86_400_000));
    const rows = (await db.prepare(`SELECT id, day FROM study_plan_items WHERE plan_id = ? AND user_id = ? AND done = 0 AND day >= ?`).bind(planId, userId, pausedOn).all<{ id: string; day: string }>()).results;
    const stmts = rows.map((r) => db.prepare('UPDATE study_plan_items SET day = ?, updated_at = ? WHERE id = ?').bind(addDay(r.day, shift), now, r.id));
    // The days the plan did not run for are not lost: every remaining day moves later by the same number of days.
    stmts.push(db.prepare(`UPDATE study_plans SET status = 'ACTIVE', paused_on = NULL, end_day = ?, updated_at = ? WHERE id = ?`).bind(addDay(plan.end_day, shift), now, planId), event(db, planId, 'RESUMED', `${shift} ${shift === 1 ? 'day' : 'days'} paused`, { shift, from: pausedOn, on: asOf }));
    await batchAll(db, stmts);
    return { status: 'ACTIVE', shiftedDays: shift };
  }
  await batchAll(db, [db.prepare(`UPDATE study_plans SET status = 'ARCHIVED', updated_at = ? WHERE id = ?`).bind(now, planId), event(db, planId, 'ARCHIVED', null, null)]);
  return { status: 'ARCHIVED' };
}

export const settingsSchema = z.object({ minutesPerDay: z.number().int().min(MINUTES_BOUNDS.min).max(MINUTES_BOUNDS.max), asOf: day });
export async function updateSettings(db: D1Database, userId: string, planId: string, input: z.infer<typeof settingsSchema>) {
  const plan = await ownPlan(db, userId, planId);
  if (plan.status === 'ARCHIVED') throw conflict('This plan has ended');
  const goal = JSON.parse(plan.goal_json) as Record<string, unknown>;
  goal.minutesPerDay = input.minutesPerDay;
  await batchAll(db, [db.prepare('UPDATE study_plans SET minutes_per_day = ?, goal_json = ?, updated_at = ? WHERE id = ?').bind(input.minutesPerDay, JSON.stringify(goal), nowIso(), planId), event(db, planId, 'TIME_CHANGED', `${plan.minutes_per_day} → ${input.minutesPerDay} minutes a day`, null)]);
  return plan.status === 'ACTIVE' ? adjustPlan(db, userId, planId, input.asOf, 'TIME_CHANGED_ADJUSTED') : { changes: [] };
}

export const regenerateSchema = z.object({
  asOf: day,
  path: z.enum(PATH_IDS).optional(),
  paperIds: z.array(z.string().max(100)).min(1).max(8).optional(),
  objectives: z.array(z.enum(OBJECTIVE_IDS)).max(9).optional(),
  durationDays: z.union([z.literal(7), z.literal(14), z.literal(30)]).optional(),
  minutesPerDay: z.number().int().min(MINUTES_BOUNDS.min).max(MINUTES_BOUNDS.max).optional(),
  coverage: z.enum(['LIGHT', 'STANDARD', 'FULL']).optional(),
  labs: z.array(labSchema).max(200).default([]),
});

/** New suggestions for the days still to come, from the same plan: done work, the student's own tasks and their own moves stay as they are. */
export async function regeneratePlan(db: D1Database, ctx: PlanContext, userId: string, planId: string, input: z.infer<typeof regenerateSchema>, year: number) {
  checkDay(input.asOf, 'day');
  const plan = await ownPlan(db, userId, planId);
  if (!['ACTIVE', 'PAUSED'].includes(plan.status)) throw conflict('Only a running plan can be regenerated');
  const old = JSON.parse(plan.goal_json) as Omit<GoalBody, 'labs'>;
  const startDay = input.asOf > plan.start_day ? input.asOf : plan.start_day;
  const merged: GoalBody = {
    ...old, labs: input.labs, startDay,
    path: input.path ?? old.path, paperIds: input.paperIds ?? old.paperIds, objectives: input.objectives ?? old.objectives, durationDays: input.durationDays ?? old.durationDays,
    minutesPerDay: input.minutesPerDay ?? old.minutesPerDay, coverage: input.coverage ?? old.coverage,
  };
  const g = await generatePlan(db, ctx, userId, merged, year);
  if (!g.out.items.length) throw invalid(g.out.warnings.join(' ') || 'Nothing could be planned from these choices');
  const version = plan.version + 1;
  const now = nowIso();
  const lastDay = addDay(startDay, merged.durationDays - 1);
  const stmts = [
    // The suggestions still to come (not done, not touched by the student) give way to the new ones.
    db.prepare(`DELETE FROM study_plan_items WHERE plan_id = ? AND user_id = ? AND origin = 'EXPERT' AND done = 0 AND pinned = 0 AND day >= ?`).bind(planId, userId, startDay),
    db
      .prepare(`UPDATE study_plans SET goal_json = ?, original_json = ?, evidence_json = ?, duration_days = ?, start_day = ?, end_day = ?, minutes_per_day = ?, version = ?, light_days_json = ?, status = 'ACTIVE', paused_on = NULL, generator_version = ?, title = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(g.goal), JSON.stringify({ items: g.out.items, days: g.out.days, version }), JSON.stringify({ summary: g.out.summary, warnings: g.out.warnings, methodReview: METHOD_REVIEW }), merged.durationDays,
        plan.start_day < startDay ? plan.start_day : startDay, lastDay, merged.minutesPerDay, version, JSON.stringify(TEMPLATES[merged.durationDays].lightDays), GENERATOR_VERSION, titleFor(g), now, planId),
    ...insertRows(db, 'study_plan_items', itemRows(userId, planId, version, g.out.items, now)),
    event(db, planId, 'REGENERATED', 'New suggestions for the days to come', { from: { goal: old, version: plan.version }, to: { goal: g.goal, version }, items: g.out.items.length }),
  ];
  await batchAll(db, stmts);
  return { id: planId, version };
}

export const restoreSchema = z.object({ suggestionKey: z.string().max(120) });
/** Puts a suggestion the student removed back, on its original day. */
export async function restoreSuggestion(db: D1Database, userId: string, planId: string, input: z.infer<typeof restoreSchema>) {
  const plan = await ownPlan(db, userId, planId);
  const original = JSON.parse(plan.original_json) as { items: BuiltItem[] };
  const found = original.items.find((o) => prefixKey(plan.version, o.key) === input.suggestionKey);
  if (!found) throw notFound('Suggestion');
  const exists = await db.prepare('SELECT id FROM study_plan_items WHERE plan_id = ? AND suggestion_key = ?').bind(planId, input.suggestionKey).first();
  if (exists) throw conflict('That suggestion is already in your plan');
  const now = nowIso();
  const day = found.date < plan.start_day ? plan.start_day : found.date;
  await db.batch([
    ...insertRows(db, 'study_plan_items', itemRows(userId, planId, plan.version, [{ ...found, date: day }], now)),
    event(db, planId, 'RESTORED', found.title, { key: input.suggestionKey }),
  ]);
  return { restored: true };
}

export const orderSchema = z.object({ day, ids: z.array(z.string().max(100)).min(1).max(40) });
export async function reorderDay(db: D1Database, userId: string, planId: string, input: z.infer<typeof orderSchema>) {
  await ownPlan(db, userId, planId);
  const { results } = await db.prepare('SELECT id FROM study_plan_items WHERE plan_id = ? AND user_id = ? AND day = ?').bind(planId, userId, input.day).all<{ id: string }>();
  const have = new Set(results.map((r) => r.id));
  if (input.ids.length !== have.size || !input.ids.every((id) => have.has(id))) throw invalid('Send every task of that day, once each');
  const now = nowIso();
  await batchAll(db, input.ids.map((id, i) => db.prepare('UPDATE study_plan_items SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(i, now, id, userId)));
  return { ordered: true };
}

/** Other ways to spend the same slot: the same topic in another form, or the next topics in the syllabus order that the plan has not reached. */
export async function alternatives(db: D1Database, ctx: PlanContext, userId: string, itemId: string, year: number) {
  const item = await db.prepare('SELECT * FROM study_plan_items WHERE id = ? AND user_id = ?').bind(itemId, userId).first<ItemRow>();
  if (!item) throw notFound('Plan item');
  if (!item.plan_id || !item.subject_code) return { alternatives: [] };
  const listed = (await listSubjects(db, ctx.preview, 'CUET_UG', year, ctx.keep)) as unknown as { paperId: string; code: string }[];
  const paper = listed.find((s) => s.code === item.subject_code);
  if (!paper) return { alternatives: [] };
  const { topics } = await topicsOf(db, ctx, paper.paperId);
  const used = new Set((await db.prepare('SELECT ref_id FROM study_plan_items WHERE plan_id = ? AND user_id = ?').bind(item.plan_id, userId).all<{ ref_id: string | null }>()).results.map((r) => r.ref_id));
  const current = topics.find((t) => t.nodeId === item.ref_id || t.lessonIds.includes(item.ref_id ?? ''));
  const out: { kind: string; refId: string | null; title: string; minutes: number; targetCount: number | null; reason: string }[] = [];
  if (current) {
    if (current.questionCount >= 5) out.push({ kind: 'PRACTICE', refId: current.nodeId, title: `Practise: ${current.title}`, minutes: Math.ceil(10 * SETTINGS.minutesPerQuestion), targetCount: 10, reason: 'Questions on the same topic' });
    out.push({ kind: 'REVISE', refId: current.nodeId, title: `Revise: ${current.title}`, minutes: SETTINGS.reviseMinutes, targetCount: null, reason: 'A short revision of the same topic' });
    if (current.lessonIds[0]) out.push({ kind: 'LESSON', refId: current.lessonIds[0], title: `Learn: ${current.title}`, minutes: 30, targetCount: null, reason: 'The lesson for the same topic' });
  }
  for (const t of topics.filter((x) => !used.has(x.nodeId) && !x.lessonIds.some((l) => used.has(l)) && x !== current).slice(0, 3)) {
    out.push({ kind: t.lessonIds[0] ? 'LESSON' : 'TOPIC', refId: t.lessonIds[0] ?? t.nodeId, title: `Learn: ${t.title}`, minutes: 30, targetCount: null, reason: 'The next topic in the syllabus order that this plan has not reached' });
  }
  return { alternatives: out.filter((a) => a.refId !== item.ref_id || a.kind !== item.kind).slice(0, 8) };
}
