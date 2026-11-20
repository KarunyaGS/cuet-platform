/**
 * Practice sets, topic tests and timed mock exams. Questions come from the stored bank; answers are
 * evaluated only by comparing with stored answer keys under the exam cycle's marking scheme.
 * No external AI service is involved anywhere in this file.
 */
import { OPTION_COUNT } from './question-audit';
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';
import { VISIBLE_CONTENT } from './learning';
import { buildScheme, evaluateResponse, markingFromRules, scoreAttempt, type MarkingScheme, type Outcome, type QuestionType } from './scoring';

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const QUESTION_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'ASSERTION_REASON', 'MATCH_THE_FOLLOWING', 'STATEMENT_BASED', 'PASSAGE_BASED', 'DIAGRAM_BASED', 'NUMERICAL'] as const;

export const startSchema = z
  .object({
    mode: z.enum(['PRACTICE', 'TOPIC_TEST', 'MOCK_TEST']),
    /** Keep exam scoring while allowing a self-paced session. */
    timed: z.boolean().optional(),
    nodeId: z.string().max(100).optional(),
    /** Several chapters or topics of one subject at once (each includes everything under it). */
    nodeIds: z.array(z.string().max(100)).min(1).max(30).optional(),
    paperId: z.string().max(100).optional(),
    count: z.number().int().min(1).max(90).optional(), // D1 allows 100 bound values in one statement
    /** Optional filters for practice sets and topic tests. A full mock paper is never filtered. */
    difficulty: z.array(z.enum(DIFFICULTIES)).min(1).max(3).optional(),
    types: z.array(z.enum(QUESTION_TYPES)).min(1).max(8).optional(),
  })
  .refine((s) => s.nodeId || s.nodeIds || s.paperId, 'Choose a topic or a subject')
  .refine((s) => s.mode !== 'MOCK_TEST' || (!s.difficulty && !s.types && !s.nodeIds), 'A full mock test uses the whole paper; difficulty, type and chapter filters apply to practice sets and topic tests');

export const answerSchema = z.object({
  questionId: z.string().max(100),
  selectedPositions: z.array(z.number().int().min(1).max(OPTION_COUNT)).max(OPTION_COUNT).optional(),
  numericAnswer: z.number().nullable().optional(),
});

interface Rules {
  questionsPerPaper?: number;
  durationMinutes?: number;
  marksCorrect?: number;
  marksIncorrect?: number;
}

const GRACE_SECONDS = 30;

/** The examination rules for mock tests (see exam.ts). Shown to the student and applied by the server. */
export const EXAM_POLICY = { maxIncidents: 2, returnSeconds: 15, mergeSeconds: 4 } as const;
export async function violationsOf(db: D1Database, sessionId: string) {
  const { results } = await db
    .prepare('SELECT type, occurred_at, recorded_at, action FROM exam_violations WHERE session_id = ? ORDER BY recorded_at, id')
    .bind(sessionId)
    .all<{ type: string; occurred_at: string; recorded_at: string; action: string }>();
  return results.map((v) => ({ type: v.type, at: v.occurred_at, recordedAt: v.recorded_at, action: v.action }));
}

interface CycleRow { paper_id: string; rules_json: string | null; year: number; exam_code: string }

export async function paperAndRules(db: D1Database, nodeId?: string, paperId?: string) {
  const row = nodeId
    ? await db.prepare(`SELECT tp.id AS paper_id, ec.rules_json, ec.year, e.code AS exam_code FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers tp ON tp.id = v.test_paper_id JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE n.id = ?`).bind(nodeId).first<CycleRow>()
    : await db.prepare(`SELECT tp.id AS paper_id, ec.rules_json, ec.year, e.code AS exam_code FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.id = ?`).bind(paperId).first<CycleRow>();
  if (!row) throw notFound(nodeId ? 'Topic' : 'Subject');
  return { paperId: row.paper_id, rulesJson: row.rules_json, rules: JSON.parse(row.rules_json ?? '{}') as Rules, year: row.year, examCode: row.exam_code };
}

/** The SQL pieces and bound values that narrow a question search by difficulty and type (placeholders numbered from `first`). */
function filterSql(f: { difficulty?: readonly string[]; types?: readonly string[] }, first: number) {
  const binds: string[] = [];
  const parts: string[] = [];
  let n = first;
  if (f.difficulty?.length) parts.push(`AND q.difficulty IN (${f.difficulty.map((d) => (binds.push(d), `?${n++}`)).join(',')})`);
  if (f.types?.length) parts.push(`AND q.type IN (${f.types.map((t) => (binds.push(t), `?${n++}`)).join(',')})`);
  return { sql: parts.join(' '), binds, next: n };
}

/** Topic ids picked by the student (one `nodeId` or several `nodeIds`); they must all belong to one subject. */
async function pickedNodes(db: D1Database, input: { nodeId?: string; nodeIds?: string[] }) {
  const ids = [...new Set([...(input.nodeIds ?? []), ...(input.nodeId ? [input.nodeId] : [])])];
  if (!ids.length) return ids;
  const { results } = await db
    .prepare(`SELECT n.id, v.test_paper_id AS paper FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .all<{ id: string; paper: string }>();
  if (results.length !== ids.length) throw notFound('Topic');
  if (new Set(results.map((r) => r.paper)).size > 1) throw invalid('Choose chapters of one subject at a time');
  return ids;
}

/** Visible questions matching a topic/subject selection and the filters, as ids (random order) or as counts. */
async function selectQuestions(db: D1Database, preview: boolean, sel: { nodes: string[]; paperId?: string; difficulty?: readonly string[]; types?: readonly string[] }, limit: number | null) {
  const flt = filterSql(sel, sel.nodes.length ? sel.nodes.length + 2 : 3);
  const lim = limit === null ? '' : ` ORDER BY random() LIMIT ${Math.max(1, Math.floor(limit))}`;
  const base = sel.nodes.length
    ? {
        sql: `WITH RECURSIVE sub(id) AS (SELECT id FROM curriculum_nodes WHERE id IN (${sel.nodes.map((_, i) => `?${i + 2}`).join(',')}) UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
           SELECT DISTINCT q.id, q.type, q.difficulty FROM questions q JOIN question_topics qt ON qt.question_id = q.id
           WHERE qt.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('q')} ${flt.sql}`,
        binds: [preview ? 1 : 0, ...sel.nodes, ...flt.binds],
      }
    : {
        sql: `SELECT DISTINCT q.id, q.type, q.difficulty FROM questions q LEFT JOIN question_topics qt ON qt.question_id = q.id LEFT JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
           LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id
           WHERE (q.test_paper_id = ?2 OR v.test_paper_id = ?2) AND ${VISIBLE_CONTENT('q')} ${flt.sql}`,
        binds: [preview ? 1 : 0, sel.paperId ?? '', ...flt.binds],
      };
  const { results } = await db.prepare(base.sql + lim).bind(...base.binds).all<{ id: string; type: string; difficulty: string }>();
  return results;
}

/** How many questions a student can practise for a selection, split by difficulty and type (for the filter panel). */
export async function questionCounts(db: D1Database, preview: boolean, q: { paperId?: string; nodeIds: string[]; difficulty?: string[]; types?: string[] }) {
  if (!q.paperId && !q.nodeIds.length) throw invalid('Choose a topic or a subject');
  const nodes = await pickedNodes(db, { nodeIds: q.nodeIds.length ? q.nodeIds : undefined });
  const rows = await selectQuestions(db, preview, { nodes, paperId: q.paperId }, null);
  const byDifficulty: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const byType: Record<string, number> = {};
  for (const r of rows) {
    byDifficulty[r.difficulty] = (byDifficulty[r.difficulty] ?? 0) + 1;
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }
  const matching = rows.filter((r) => (!q.difficulty?.length || q.difficulty.includes(r.difficulty)) && (!q.types?.length || q.types.includes(r.type))).length;
  return { total: rows.length, matching, byDifficulty, byType };
}

export async function startSession(db: D1Database, preview: boolean, userId: string, input: z.infer<typeof startSchema>) {
  const nodes = await pickedNodes(db, input);
  const { paperId, rulesJson, rules, year, examCode } = await paperAndRules(db, nodes[0], input.paperId);
  const full = rules.questionsPerPaper ?? 50;
  const want = input.count ?? (input.mode === 'MOCK_TEST' ? full : input.mode === 'TOPIC_TEST' ? 15 : 10);
  // Questions linked to the chosen topics and everything under them, or to any topic of the subject, narrowed by the filters.
  const results = await selectQuestions(db, preview, { nodes, paperId: input.paperId, difficulty: input.difficulty, types: input.types }, want);
  if (!results.length) {
    throw new ApiError(404, 'NO_QUESTIONS', input.difficulty || input.types ? 'No questions match these filters. Try more difficulty levels or question types.' : 'No questions are available for this selection yet');
  }
  return createSession(db, userId, { mode: input.mode, paperId, nodeId: nodes[0] ?? null, ids: results.map((r) => r.id), timed: input.timed }, { rulesJson, rules, year, examCode });
}

/**
 * Creates a session over a fixed list of questions of one subject (used by topic/mock tests and daily practice).
 * Timing follows the real exam: the full paper's time scaled to the number of questions; plain practice is untimed.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  s: { mode: 'PRACTICE' | 'TOPIC_TEST' | 'MOCK_TEST'; paperId: string | null; nodeId: string | null; ids: string[]; timed?: boolean },
  known?: { rulesJson: string | null; rules: Rules; year?: number; examCode?: string },
  source?: { kind: 'MOCK_PAPER' | 'PAST_PAPER'; id: string; title: string },
) {
  // The cycle (exam and year) is always looked up; a paper that carries its own recorded rules keeps them.
  // A paper that carries its own recorded rules keeps them; the cycle (exam and year) is looked up when the paper is known.
  const looked = known?.examCode || (known && !s.paperId) ? null : await paperAndRules(db, undefined, s.paperId ?? undefined);
  const { rulesJson, rules } = (known ?? looked)!;
  const cycle = known?.examCode ? { year: known.year ?? null, examCode: known.examCode } : looked ? { year: looked.year, examCode: looked.examCode } : { year: null, examCode: null };
  // The scheme is built once, here, and stored with the attempt. A past paper carries its own recorded rules, so the bulletin link is not claimed for it.
  const scheme = buildScheme(rulesJson, {
    kind: s.mode === 'PRACTICE' ? 'PRACTICE' : 'CUET_SIMULATION', exam: cycle.examCode, year: cycle.year,
    ...(source?.kind === 'PAST_PAPER' ? { sourceLabel: 'Marking as recorded for this previous-year paper', useCycleSource: false } : {}),
  });
  const marking = scheme;
  const full = rules.questionsPerPaper ?? 50;
  const perQuestion = ((rules.durationMinutes ?? 60) * 60) / full;
  const duration = s.mode === 'PRACTICE' || s.timed === false ? null : Math.ceil(perQuestion * s.ids.length);
  const id = newId('ps');
  await db.batch(
    insertRows(db, 'practice_sessions', [{
      id, user_id: userId, mode: s.mode, test_paper_id: s.paperId, curriculum_node_id: s.nodeId, status: 'IN_PROGRESS',
      question_ids_json: JSON.stringify(s.ids), duration_seconds: duration, marks_correct: marking.correct, marks_incorrect: marking.incorrect,
      score: null, max_score: null, correct_count: 0, incorrect_count: 0, unattempted_count: 0, started_at: nowIso(), submitted_at: null,
      marked_json: null, source_json: source ? JSON.stringify(source) : null, scheme_json: JSON.stringify(scheme), credited_count: 0,
    }]),
  );
  return getSession(db, userId, id);
}

/** How a finished attempt went by unit (the top-level syllabus row of each question's topic) and by difficulty, and how long it took. */
async function analyseAttempt(db: D1Database, ids: string[], questions: Record<string, unknown>[], answers: Record<string, unknown>[], dropped: Set<string>, startedAt: unknown, submittedAt: unknown) {
  const mark = new Map(answers.map((a) => [a.question_id as string, String(a.outcome)]));
  for (const d of dropped) mark.set(d, 'CREDITED');
  const topicOf = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT question_id, curriculum_node_id FROM question_topics WHERE is_primary = 1 AND question_id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ question_id: string; curriculum_node_id: string }>();
    for (const r of results) topicOf.set(r.question_id, r.curriculum_node_id);
  }
  const nodeIds = [...new Set(topicOf.values())];
  const rootOf = new Map<string, { id: string; title: string }>();
  for (let i = 0; i < nodeIds.length; i += 80) {
    const part = nodeIds.slice(i, i + 80);
    const { results } = await db
      .prepare(`WITH RECURSIVE up(start_id, id, parent_id, title, depth) AS (
          SELECT n.id, n.id, n.parent_id, n.title, n.depth FROM curriculum_nodes n WHERE n.id IN (${part.map(() => '?').join(',')})
          UNION ALL SELECT up.start_id, p.id, p.parent_id, p.title, p.depth FROM curriculum_nodes p JOIN up ON p.id = up.parent_id)
        SELECT start_id, id, title FROM up WHERE parent_id IS NULL`)
      .bind(...part)
      .all<{ start_id: string; id: string; title: string }>();
    for (const r of results) rootOf.set(r.start_id, { id: r.id, title: r.title });
  }
  type Tally = { correct: number; incorrect: number; unattempted: number; credited: number };
  const blank = (): Tally => ({ correct: 0, incorrect: 0, unattempted: 0, credited: 0 });
  const add = (t: Tally, outcome: string) => void (outcome === 'CORRECT' ? t.correct++ : outcome === 'INCORRECT' ? t.incorrect++ : outcome === 'CREDITED' ? t.credited++ : t.unattempted++);
  const units = new Map<string, Tally & { id: string; title: string }>();
  const levels: Record<string, Tally> = { EASY: blank(), MEDIUM: blank(), HARD: blank() };
  for (const q of questions) {
    const outcome = mark.get(q.id as string) ?? 'UNATTEMPTED';
    add(levels[String(q.difficulty)] ?? (levels[String(q.difficulty)] = blank()), outcome);
    const root = rootOf.get(topicOf.get(q.id as string) ?? '');
    const key = root?.id ?? 'none';
    const u = units.get(key) ?? { id: key, title: root?.title ?? 'Not linked to a syllabus unit', ...blank() };
    add(u, outcome);
    units.set(key, u);
  }
  const seconds = startedAt && submittedAt ? Math.max(0, Math.round((new Date(String(submittedAt)).getTime() - new Date(String(startedAt)).getTime()) / 1000)) : null;
  const rate = (t: Tally) => (t.correct + t.incorrect ? Math.round((100 * t.correct) / (t.correct + t.incorrect)) : null);
  return {
    timeTakenSeconds: seconds,
    byUnit: [...units.values()].map((u) => ({ ...u, accuracy: rate(u) })).sort((a, b) => b.correct + b.incorrect + b.unattempted + b.credited - (a.correct + a.incorrect + a.unattempted + a.credited)),
    byDifficulty: Object.entries(levels).filter(([, t]) => t.correct + t.incorrect + t.unattempted + t.credited > 0).map(([difficulty, t]) => ({ difficulty, ...t, accuracy: rate(t) })),
  };
}

export async function loadSession(db: D1Database, userId: string, id: string) {
  const s = await db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').bind(id, userId).first<Record<string, unknown>>();
  if (!s) throw notFound('Practice session');
  return s as {
    id: string; mode: string; status: string; question_ids_json: string; duration_seconds: number | null; started_at: string;
    marks_correct: number; marks_incorrect: number; score: number | null; max_score: number | null; correct_count: number;
    incorrect_count: number; unattempted_count: number; submitted_at: string | null; test_paper_id: string | null; curriculum_node_id: string | null;
    marked_json: string | null; source_json: string | null; end_reason: string | null; scheme_json: string | null; credited_count: number;
  };
}

/** The scheme stored with an attempt (null for attempts made before schemes were stored). */
export const schemeOf = (s: { scheme_json: string | null }) => (s.scheme_json ? (JSON.parse(s.scheme_json) as MarkingScheme) : null);

const deadline = (s: { started_at: string; duration_seconds: number | null }) =>
  s.duration_seconds === null ? null : new Date(new Date(s.started_at).getTime() + (s.duration_seconds + GRACE_SECONDS) * 1000);

/** Session with its questions. Answer keys and explanations are included only after submission. */
export async function getSession(db: D1Database, userId: string, id: string) {
  let s = await loadSession(db, userId, id);
  const dl = deadline(s);
  if (s.status === 'IN_PROGRESS' && dl && Date.now() > dl.getTime()) {
    await submitSession(db, userId, id, 'TIME_UP');
    s = await loadSession(db, userId, id);
  }
  const ids = JSON.parse(s.question_ids_json) as string[];
  const placeholders = ids.map(() => '?').join(',');
  const [qs, opts, answers] = await Promise.all([
    db.prepare(`SELECT q.id, q.type, q.stem, q.difficulty, q.structure_json, q.origin, q.status, q.verification, p.title AS passage_title, p.body AS passage_body FROM questions q LEFT JOIN passages p ON p.id = q.passage_id WHERE q.id IN (${placeholders})`).bind(...ids).all<Record<string, unknown>>(),
    db.prepare(`SELECT question_id, position, label, text, media_asset_id FROM question_options WHERE question_id IN (${placeholders}) ORDER BY position`).bind(...ids).all<Record<string, unknown>>(),
    db.prepare('SELECT question_id, selected_positions_json, numeric_answer, outcome, score FROM practice_answers WHERE session_id = ?').bind(id).all<Record<string, unknown>>(),
  ]);
  const submitted = s.status !== 'IN_PROGRESS';
  const exam = s.mode !== 'PRACTICE';
  const violations = exam ? await violationsOf(db, id) : [];
  const keys = submitted
    ? await db.prepare(`SELECT a.question_id, a.correct_option_positions, a.numeric_answer, a.key_status, e.body AS explanation, e.option_rationale_json FROM answer_keys a LEFT JOIN explanations e ON e.question_id = a.question_id WHERE a.question_id IN (${placeholders})`).bind(...ids).all<Record<string, unknown>>()
    : { results: [] as Record<string, unknown>[] };
  const byQ = new Map(qs.results.map((q) => [q.id as string, q]));
  // Figures of the questions (stem figure and option images): their descriptions, for the screen's alt text.
  const mediaIds = [...new Set([...qs.results.map((q) => (q.structure_json ? (JSON.parse(q.structure_json as string) as { mediaAssetId?: string }).mediaAssetId : undefined)), ...opts.results.map((o) => o.media_asset_id as string | null)].filter((x): x is string => Boolean(x)))];
  const alts = new Map<string, string>();
  for (let i = 0; i < mediaIds.length; i += 80) {
    const part = mediaIds.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT id, alt_text FROM media_assets WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ id: string; alt_text: string }>();
    for (const r of results) alts.set(r.id, r.alt_text);
  }
  const dropped = new Set(keys.results.filter((k) => k.key_status === 'DROPPED').map((k) => k.question_id as string));
  const analysis = submitted ? await analyseAttempt(db, ids, qs.results, answers.results, dropped, s.started_at, s.submitted_at) : null;
  const scheme = s.scheme_json ? (JSON.parse(s.scheme_json) as MarkingScheme) : null;
  return {
    session: {
      id: s.id, mode: s.mode, status: s.status, startedAt: s.started_at, durationSeconds: s.duration_seconds,
      deadline: dl?.toISOString() ?? null, marking: { correct: s.marks_correct, incorrect: s.marks_incorrect },
      // The scheme kept with this attempt (marks, bulletin year and source, special-case rules). Null only for attempts made before schemes were stored.
      scheme,
      // Questions marked for review (kept on the server, so a reload or another device shows them) and what the attempt is.
      marked: s.marked_json ? (JSON.parse(s.marked_json) as string[]).filter((q) => ids.includes(q)) : [],
      source: s.source_json ? (JSON.parse(s.source_json) as { kind: string; id: string; title: string }) : null,
      // Examination mode (mock tests): why the attempt ended, the rules in force, and what was reported during it.
      endReason: s.end_reason,
      exam: exam ? { ...EXAM_POLICY, incidents: violations.filter((v) => v.action === 'WARNED' || v.action === 'TERMINATED').length, violations } : null,
      result: submitted ? { score: s.score, maxScore: s.max_score, correct: s.correct_count, incorrect: s.incorrect_count, unattempted: s.unattempted_count, credited: s.credited_count, marked: (s.marked_json ? (JSON.parse(s.marked_json) as string[]).filter((q) => ids.includes(q)).length : 0), submittedAt: s.submitted_at } : null,
      analysis,
    },
    questions: ids.filter((qid) => byQ.has(qid)).map((qid, i) => {
      const q = byQ.get(qid)!;
      const a = answers.results.find((x) => x.question_id === qid);
      const k = keys.results.find((x) => x.question_id === qid);
      return {
        number: i + 1, id: qid, type: q.type, stem: q.stem, difficulty: q.difficulty, structure: q.structure_json ? (() => { const st = JSON.parse(q.structure_json as string) as { mediaAssetId?: string }; return st.mediaAssetId ? { ...st, alt: alts.get(st.mediaAssetId) ?? null } : st; })() : null,
        passage: q.passage_body ? { title: q.passage_title, body: q.passage_body } : null, origin: q.origin, preview: q.status !== 'PUBLISHED',
        options: opts.results.filter((o) => o.question_id === qid).map((o) => ({ position: o.position, label: o.label, text: o.text, mediaAssetId: o.media_asset_id, alt: o.media_asset_id ? (alts.get(o.media_asset_id as string) ?? null) : null })),
        answer: a ? { selectedPositions: a.selected_positions_json ? JSON.parse(a.selected_positions_json as string) : null, numericAnswer: a.numeric_answer } : null,
        review: submitted
          ? {
              outcome: dropped.has(qid) ? 'CREDITED' : ((a?.outcome as string) ?? 'UNATTEMPTED'), score: dropped.has(qid) ? s.marks_correct : ((a?.score as number) ?? 0),
              correctOptionPositions: k?.correct_option_positions ? JSON.parse(k.correct_option_positions as string) : null, correctNumericAnswer: k?.numeric_answer ?? null,
              explanation: k?.explanation ?? null, optionRationale: k?.option_rationale_json ? JSON.parse(k.option_rationale_json as string) : null,
            }
          : null,
      };
    }),
  };
}

async function keyFor(db: D1Database, questionId: string) {
  const row = await db
    .prepare('SELECT q.type, a.correct_option_positions, a.numeric_answer, a.numeric_tolerance FROM questions q JOIN answer_keys a ON a.question_id = q.id WHERE q.id = ?')
    .bind(questionId)
    .first<{ type: QuestionType; correct_option_positions: string | null; numeric_answer: number | null; numeric_tolerance: number | null }>();
  if (!row) throw conflict('This question has no answer key');
  return { type: row.type, key: { correctOptionPositions: row.correct_option_positions ? (JSON.parse(row.correct_option_positions) as number[]) : null, numericAnswer: row.numeric_answer, numericTolerance: row.numeric_tolerance } };
}

/** Save (or change) one answer. In plain practice the result and explanation come back at once. */
export async function saveAnswer(db: D1Database, userId: string, sessionId: string, input: z.infer<typeof answerSchema>) {
  const s = await loadSession(db, userId, sessionId);
  if (s.status !== 'IN_PROGRESS') throw conflict('This session has already been submitted');
  const dl = deadline(s);
  if (dl && Date.now() > dl.getTime()) {
    await submitSession(db, userId, sessionId, 'TIME_UP');
    throw conflict('Time is up; the session was submitted');
  }
  if (!(JSON.parse(s.question_ids_json) as string[]).includes(input.questionId)) throw invalid('That question is not part of this session');
  const { type, key } = await keyFor(db, input.questionId);
  const result = evaluateResponse(type, key, input, { correct: s.marks_correct, incorrect: s.marks_incorrect, unattempted: 0 }, { anyCorrectOption: schemeOf(s)?.anyCorrectOption ?? s.mode !== 'PRACTICE' });
  await db
    .prepare(
      `INSERT INTO practice_answers (id, session_id, question_id, selected_positions_json, numeric_answer, outcome, score, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, question_id) DO UPDATE SET selected_positions_json = excluded.selected_positions_json, numeric_answer = excluded.numeric_answer,
         outcome = excluded.outcome, score = excluded.score, answered_at = excluded.answered_at`,
    )
    .bind(newId('pa'), sessionId, input.questionId, input.selectedPositions ? JSON.stringify(input.selectedPositions) : null, input.numericAnswer ?? null, result.outcome, result.score, nowIso())
    .run();
  if (s.mode !== 'PRACTICE') return { saved: true };
  const exp = await db.prepare('SELECT body, option_rationale_json FROM explanations WHERE question_id = ? LIMIT 1').bind(input.questionId).first<{ body: string; option_rationale_json: string | null }>();
  return {
    saved: true, outcome: result.outcome, score: result.score, correctOptionPositions: key.correctOptionPositions, correctNumericAnswer: key.numericAnswer,
    explanation: exp?.body ?? null, optionRationale: exp?.option_rationale_json ? JSON.parse(exp.option_rationale_json) : null, answeredBy: 'stored-answer-key',
  };
}

export const marksSchema = z.object({ questionIds: z.array(z.string().max(100)).max(500) });

/** Saves which questions the student marked for review. Marks never affect the score. */
export async function saveMarks(db: D1Database, userId: string, sessionId: string, input: z.infer<typeof marksSchema>) {
  const s = await loadSession(db, userId, sessionId);
  if (s.status !== 'IN_PROGRESS') throw conflict('This session has already been submitted');
  const ids = new Set(JSON.parse(s.question_ids_json) as string[]);
  const marked = [...new Set(input.questionIds)].filter((q) => ids.has(q));
  await db.prepare('UPDATE practice_sessions SET marked_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(marked), sessionId, userId).run();
  return { marked };
}

/** Score the session once and fold the results into the student's per-topic progress. */
export async function submitSession(db: D1Database, userId: string, sessionId: string, reason = 'SUBMITTED') {
  const s = await loadSession(db, userId, sessionId);
  if (s.status !== 'IN_PROGRESS') return getSession(db, userId, sessionId);
  // A submission that arrives after the time allowed is recorded as the time running out, whoever sent it.
  if (s.duration_seconds !== null) {
    const over = Date.now() >= new Date(s.started_at).getTime() + s.duration_seconds * 1000;
    // 'Time is up' is only accepted from the screen within a few seconds of the real end (clocks differ a little); otherwise it is an ordinary submit.
    const nearEnd = Date.now() >= new Date(s.started_at).getTime() + s.duration_seconds * 1000 - 5000;
    if (over || (reason === 'TIME_UP' && nearEnd)) reason = 'TIME_UP';
    else if (reason === 'TIME_UP' && !nearEnd) reason = 'SUBMITTED';
  }
  const ids = JSON.parse(s.question_ids_json) as string[];
  const placeholders = ids.map(() => '?').join(',');
  const [{ results: answers }, { results: keyRows }, { results: links }] = await Promise.all([
    db.prepare('SELECT question_id, outcome FROM practice_answers WHERE session_id = ?').bind(sessionId).all<{ question_id: string; outcome: Outcome }>(),
    db.prepare(`SELECT question_id FROM answer_keys WHERE key_status = 'DROPPED' AND question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string }>(),
    db.prepare(`SELECT question_id, curriculum_node_id FROM question_topics WHERE question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string; curriculum_node_id: string }>(),
  ]);
  const dropped = new Set(keyRows.map((k) => k.question_id));
  // One function totals the attempt: the same numbers feed the stored result, the result screen and Progress.
  const stored = schemeOf(s);
  const t = scoreAttempt(
    ids.map((id) => ({ id, dropped: dropped.has(id) })),
    answers.map((a) => ({ questionId: a.question_id, outcome: a.outcome })),
    { correct: s.marks_correct, incorrect: s.marks_incorrect, unattempted: stored?.unattempted ?? 0, creditDroppedQuestions: stored?.creditDroppedQuestions ?? true },
  );
  const now = nowIso();
  // Claim the submission first. Only the request that changes the row goes on to record progress, so a second submit (time-up arriving
  // together with a rule-violation ending, a double click, a retry after a reload) can never count the attempt twice.
  const claim = await db
    .prepare(`UPDATE practice_sessions SET status = 'SUBMITTED', score = ?, max_score = ?, correct_count = ?, incorrect_count = ?, unattempted_count = ?, credited_count = ?, submitted_at = ?, end_reason = ? WHERE id = ? AND status = 'IN_PROGRESS'`)
    .bind(t.score, t.maxScore, t.correct, t.incorrect, t.unattempted, t.credited, now, reason, sessionId)
    .run();
  if (!claim.meta.changes) return getSession(db, userId, sessionId);
  const perTopic = new Map<string, { attempted: number; correct: number; incorrect: number }>();
  for (const l of links) {
    const a = answers.find((x) => x.question_id === l.question_id);
    if (!a || a.outcome === 'UNATTEMPTED' || dropped.has(l.question_id)) continue;
    const p = perTopic.get(l.curriculum_node_id) ?? { attempted: 0, correct: 0, incorrect: 0 };
    p.attempted++;
    if (a.outcome === 'CORRECT') p.correct++;
    else p.incorrect++;
    perTopic.set(l.curriculum_node_id, p);
  }
  if (perTopic.size) {
    await db.batch(
      [...perTopic].map(([nodeId, p]) =>
        db
          .prepare(
            `INSERT INTO topic_progress (user_id, curriculum_node_id, attempted, correct, incorrect, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, curriculum_node_id) DO UPDATE SET attempted = attempted + excluded.attempted, correct = correct + excluded.correct,
               incorrect = incorrect + excluded.incorrect, last_attempt_at = excluded.last_attempt_at`,
          )
          .bind(userId, nodeId, p.attempted, p.correct, p.incorrect, now),
      ),
    );
  }
  return getSession(db, userId, sessionId);
}

/**
 * Re-totals an already submitted attempt from its saved answers and the current answer keys. Used when a question is later found wrong or
 * dropped, so everyone who appeared is credited. Answers are not touched; per-topic progress counters are left as they were.
 */
export async function rescoreSession(db: D1Database, sessionId: string) {
  const s = await db.prepare('SELECT * FROM practice_sessions WHERE id = ?').bind(sessionId).first<Awaited<ReturnType<typeof loadSession>>>();
  if (!s || s.status !== 'SUBMITTED') return null;
  const ids = JSON.parse(s.question_ids_json) as string[];
  const placeholders = ids.map(() => '?').join(',');
  const [{ results: answers }, { results: keyRows }] = await Promise.all([
    db.prepare('SELECT question_id, outcome FROM practice_answers WHERE session_id = ?').bind(sessionId).all<{ question_id: string; outcome: Outcome }>(),
    db.prepare(`SELECT question_id FROM answer_keys WHERE key_status = 'DROPPED' AND question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string }>(),
  ]);
  const dropped = new Set(keyRows.map((k) => k.question_id));
  const stored = schemeOf(s);
  const t = scoreAttempt(ids.map((id) => ({ id, dropped: dropped.has(id) })), answers.map((a) => ({ questionId: a.question_id, outcome: a.outcome })), { correct: s.marks_correct, incorrect: s.marks_incorrect, unattempted: stored?.unattempted ?? 0, creditDroppedQuestions: stored?.creditDroppedQuestions ?? true });
  await db.prepare('UPDATE practice_sessions SET score = ?, max_score = ?, correct_count = ?, incorrect_count = ?, unattempted_count = ?, credited_count = ? WHERE id = ?').bind(t.score, t.maxScore, t.correct, t.incorrect, t.unattempted, t.credited, sessionId).run();
  return t;
}

/** Overall progress, per-topic accuracy and weak topics (accuracy under 60% after at least 3 attempts). */
export async function progress(db: D1Database, userId: string) {
  const [totals, topics, recent, subjectRows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS sessions, COALESCE(SUM(correct_count),0) AS correct, COALESCE(SUM(incorrect_count),0) AS incorrect, COALESCE(SUM(unattempted_count),0) AS unattempted, COALESCE(SUM(credited_count),0) AS credited FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED'`).bind(userId).first<Record<string, number>>(),
    db
      .prepare(
        `SELECT tp.curriculum_node_id AS id, n.title, n.kind, p.name AS paper, p.code AS paper_code, tp.attempted, tp.correct, tp.incorrect,
           ROUND(100.0 * tp.correct / tp.attempted, 1) AS accuracy, tp.last_attempt_at
         FROM topic_progress tp JOIN curriculum_nodes n ON n.id = tp.curriculum_node_id JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers p ON p.id = v.test_paper_id
         WHERE tp.user_id = ? ORDER BY accuracy ASC, tp.attempted DESC`,
      )
      .bind(userId)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT ps.id, ps.mode, ps.status, ps.score, ps.max_score, ps.correct_count, ps.incorrect_count, ps.unattempted_count, ps.started_at, ps.submitted_at, p.name AS paper FROM practice_sessions ps LEFT JOIN test_papers p ON p.id = ps.test_paper_id WHERE ps.user_id = ? ORDER BY ps.started_at DESC LIMIT 20`).bind(userId).all(),
    db.prepare(`SELECT p.code, p.name AS paper, SUM(ps.correct_count) AS correct, SUM(ps.incorrect_count) AS incorrect FROM practice_sessions ps JOIN test_papers p ON p.id = ps.test_paper_id WHERE ps.user_id = ? AND ps.status = 'SUBMITTED' GROUP BY p.id, p.code, p.name`).bind(userId).all<Record<string, unknown>>(),
  ]);
  // Subject totals come from the submitted attempts themselves (each question counted once), so they add up to the overall totals.
  // The topic table is a per-topic view: a question linked to two topics appears under both, so it is never summed for a subject.
  const topicsPerSubject = new Map<string, number>();
  for (const t of topics.results) topicsPerSubject.set(String(t.paper_code), (topicsPerSubject.get(String(t.paper_code)) ?? 0) + 1);
  const subjects = subjectRows.results
    .map((r) => {
      const attempted = Number(r.correct) + Number(r.incorrect);
      return { paper: String(r.paper), paperCode: String(r.code), topics: topicsPerSubject.get(String(r.code)) ?? 0, attempted, correct: Number(r.correct), accuracy: attempted ? Math.round((1000 * Number(r.correct)) / attempted) / 10 : null };
    })
    .filter((x) => x.attempted > 0)
    .sort((x, y) => y.attempted - x.attempted);
  const answered = (totals?.correct ?? 0) + (totals?.incorrect ?? 0);
  return {
    totals: { ...totals, answered, accuracy: answered ? Math.round((1000 * (totals?.correct ?? 0)) / answered) / 10 : null },
    topics: topics.results,
    weakTopics: topics.results.filter((t) => Number(t.attempted) >= 3 && Number(t.accuracy) < 60),
    recentSessions: recent.results,
    subjects,
  };
}
