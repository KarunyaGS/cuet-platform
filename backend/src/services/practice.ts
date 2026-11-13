/**
 * Practice sets, topic tests and timed mock exams. Questions come from the stored bank; answers are
 * evaluated only by comparing with stored answer keys under the exam cycle's marking scheme.
 * No external AI service is involved anywhere in this file.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';
import { VISIBLE_CONTENT } from './learning';
import { evaluateResponse, markingFromRules, type QuestionType } from './scoring';

export const startSchema = z
  .object({
    mode: z.enum(['PRACTICE', 'TOPIC_TEST', 'MOCK_TEST']),
    nodeId: z.string().max(100).optional(),
    paperId: z.string().max(100).optional(),
    count: z.number().int().min(1).max(200).optional(),
  })
  .refine((s) => s.nodeId || s.paperId, 'Choose a topic or a subject');

export const answerSchema = z.object({
  questionId: z.string().max(100),
  selectedPositions: z.array(z.number().int().min(1)).max(10).optional(),
  numericAnswer: z.number().nullable().optional(),
});

interface Rules {
  questionsPerPaper?: number;
  durationMinutes?: number;
  marksCorrect?: number;
  marksIncorrect?: number;
}

const GRACE_SECONDS = 30;

async function paperAndRules(db: D1Database, nodeId?: string, paperId?: string) {
  const row = nodeId
    ? await db.prepare(`SELECT tp.id AS paper_id, ec.rules_json FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers tp ON tp.id = v.test_paper_id JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id WHERE n.id = ?`).bind(nodeId).first<{ paper_id: string; rules_json: string | null }>()
    : await db.prepare(`SELECT tp.id AS paper_id, ec.rules_json FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id WHERE tp.id = ?`).bind(paperId).first<{ paper_id: string; rules_json: string | null }>();
  if (!row) throw notFound(nodeId ? 'Topic' : 'Subject');
  return { paperId: row.paper_id, rulesJson: row.rules_json, rules: JSON.parse(row.rules_json ?? '{}') as Rules };
}

export async function startSession(db: D1Database, preview: boolean, userId: string, input: z.infer<typeof startSchema>) {
  const { paperId, rulesJson, rules } = await paperAndRules(db, input.nodeId, input.paperId);
  const marking = markingFromRules(rulesJson);
  const full = rules.questionsPerPaper ?? 50;
  const want = input.count ?? (input.mode === 'MOCK_TEST' ? full : input.mode === 'TOPIC_TEST' ? 15 : 10);
  // Questions linked to the topic and everything under it, or to any topic of the subject.
  const { results } = input.nodeId
    ? await db
        .prepare(
          `WITH RECURSIVE sub(id) AS (SELECT ?2 UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
           SELECT DISTINCT q.id FROM questions q JOIN question_topics qt ON qt.question_id = q.id
           WHERE qt.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('q')} ORDER BY random() LIMIT ?3`,
        )
        .bind(preview ? 1 : 0, input.nodeId, want)
        .all<{ id: string }>()
    : await db
        .prepare(
          `SELECT DISTINCT q.id FROM questions q LEFT JOIN question_topics qt ON qt.question_id = q.id LEFT JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
           LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id
           WHERE (q.test_paper_id = ?2 OR v.test_paper_id = ?2) AND ${VISIBLE_CONTENT('q')} ORDER BY random() LIMIT ?3`,
        )
        .bind(preview ? 1 : 0, paperId, want)
        .all<{ id: string }>();
  if (!results.length) throw new ApiError(404, 'NO_QUESTIONS', 'No questions are available for this selection yet');
  return createSession(db, userId, { mode: input.mode, paperId, nodeId: input.nodeId ?? null, ids: results.map((r) => r.id) }, { rulesJson, rules });
}

/**
 * Creates a session over a fixed list of questions of one subject (used by topic/mock tests and daily practice).
 * Timing follows the real exam: the full paper's time scaled to the number of questions; plain practice is untimed.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  s: { mode: 'PRACTICE' | 'TOPIC_TEST' | 'MOCK_TEST'; paperId: string | null; nodeId: string | null; ids: string[] },
  known?: { rulesJson: string | null; rules: Rules },
) {
  const { rulesJson, rules } = known ?? (await paperAndRules(db, undefined, s.paperId ?? undefined));
  const marking = markingFromRules(rulesJson);
  const full = rules.questionsPerPaper ?? 50;
  const perQuestion = ((rules.durationMinutes ?? 60) * 60) / full;
  const duration = s.mode === 'PRACTICE' ? null : Math.ceil(perQuestion * s.ids.length);
  const id = newId('ps');
  await db.batch(
    insertRows(db, 'practice_sessions', [{
      id, user_id: userId, mode: s.mode, test_paper_id: s.paperId, curriculum_node_id: s.nodeId, status: 'IN_PROGRESS',
      question_ids_json: JSON.stringify(s.ids), duration_seconds: duration, marks_correct: marking.correct, marks_incorrect: marking.incorrect,
      score: null, max_score: null, correct_count: 0, incorrect_count: 0, unattempted_count: 0, started_at: nowIso(), submitted_at: null,
    }]),
  );
  return getSession(db, userId, id);
}

async function loadSession(db: D1Database, userId: string, id: string) {
  const s = await db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').bind(id, userId).first<Record<string, unknown>>();
  if (!s) throw notFound('Practice session');
  return s as {
    id: string; mode: string; status: string; question_ids_json: string; duration_seconds: number | null; started_at: string;
    marks_correct: number; marks_incorrect: number; score: number | null; max_score: number | null; correct_count: number;
    incorrect_count: number; unattempted_count: number; submitted_at: string | null; test_paper_id: string | null; curriculum_node_id: string | null;
  };
}

const deadline = (s: { started_at: string; duration_seconds: number | null }) =>
  s.duration_seconds === null ? null : new Date(new Date(s.started_at).getTime() + (s.duration_seconds + GRACE_SECONDS) * 1000);

/** Session with its questions. Answer keys and explanations are included only after submission. */
export async function getSession(db: D1Database, userId: string, id: string) {
  let s = await loadSession(db, userId, id);
  const dl = deadline(s);
  if (s.status === 'IN_PROGRESS' && dl && Date.now() > dl.getTime()) {
    await submitSession(db, userId, id);
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
  const keys = submitted
    ? await db.prepare(`SELECT a.question_id, a.correct_option_positions, a.numeric_answer, e.body AS explanation, e.option_rationale_json FROM answer_keys a LEFT JOIN explanations e ON e.question_id = a.question_id WHERE a.question_id IN (${placeholders})`).bind(...ids).all<Record<string, unknown>>()
    : { results: [] as Record<string, unknown>[] };
  const byQ = new Map(qs.results.map((q) => [q.id as string, q]));
  return {
    session: {
      id: s.id, mode: s.mode, status: s.status, startedAt: s.started_at, durationSeconds: s.duration_seconds,
      deadline: dl?.toISOString() ?? null, marking: { correct: s.marks_correct, incorrect: s.marks_incorrect },
      result: submitted ? { score: s.score, maxScore: s.max_score, correct: s.correct_count, incorrect: s.incorrect_count, unattempted: s.unattempted_count, submittedAt: s.submitted_at } : null,
    },
    questions: ids.filter((qid) => byQ.has(qid)).map((qid, i) => {
      const q = byQ.get(qid)!;
      const a = answers.results.find((x) => x.question_id === qid);
      const k = keys.results.find((x) => x.question_id === qid);
      return {
        number: i + 1, id: qid, type: q.type, stem: q.stem, difficulty: q.difficulty, structure: q.structure_json ? JSON.parse(q.structure_json as string) : null,
        passage: q.passage_body ? { title: q.passage_title, body: q.passage_body } : null, origin: q.origin, preview: q.status !== 'PUBLISHED',
        options: opts.results.filter((o) => o.question_id === qid).map((o) => ({ position: o.position, label: o.label, text: o.text, mediaAssetId: o.media_asset_id })),
        answer: a ? { selectedPositions: a.selected_positions_json ? JSON.parse(a.selected_positions_json as string) : null, numericAnswer: a.numeric_answer } : null,
        review: submitted
          ? {
              outcome: (a?.outcome as string) ?? 'UNATTEMPTED', score: (a?.score as number) ?? 0,
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
    await submitSession(db, userId, sessionId);
    throw conflict('Time is up; the session was submitted');
  }
  if (!(JSON.parse(s.question_ids_json) as string[]).includes(input.questionId)) throw invalid('That question is not part of this session');
  const { type, key } = await keyFor(db, input.questionId);
  const result = evaluateResponse(type, key, input, { correct: s.marks_correct, incorrect: s.marks_incorrect, unattempted: 0 });
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

/** Score the session once and fold the results into the student's per-topic progress. */
export async function submitSession(db: D1Database, userId: string, sessionId: string) {
  const s = await loadSession(db, userId, sessionId);
  if (s.status !== 'IN_PROGRESS') return getSession(db, userId, sessionId);
  const ids = JSON.parse(s.question_ids_json) as string[];
  const { results: answers } = await db.prepare('SELECT question_id, outcome, score FROM practice_answers WHERE session_id = ?').bind(sessionId).all<{ question_id: string; outcome: string; score: number }>();
  const correct = answers.filter((a) => a.outcome === 'CORRECT').length;
  const incorrect = answers.filter((a) => a.outcome === 'INCORRECT').length;
  const score = answers.reduce((n, a) => n + a.score, 0);
  const now = nowIso();
  const placeholders = ids.map(() => '?').join(',');
  const { results: links } = await db.prepare(`SELECT question_id, curriculum_node_id FROM question_topics WHERE question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string; curriculum_node_id: string }>();
  const perTopic = new Map<string, { attempted: number; correct: number; incorrect: number }>();
  for (const l of links) {
    const a = answers.find((x) => x.question_id === l.question_id);
    if (!a || a.outcome === 'UNATTEMPTED') continue;
    const t = perTopic.get(l.curriculum_node_id) ?? { attempted: 0, correct: 0, incorrect: 0 };
    t.attempted++;
    if (a.outcome === 'CORRECT') t.correct++;
    else t.incorrect++;
    perTopic.set(l.curriculum_node_id, t);
  }
  await db.batch([
    db
      .prepare(`UPDATE practice_sessions SET status = 'SUBMITTED', score = ?, max_score = ?, correct_count = ?, incorrect_count = ?, unattempted_count = ?, submitted_at = ? WHERE id = ? AND status = 'IN_PROGRESS'`)
      .bind(score, ids.length * s.marks_correct, correct, incorrect, ids.length - correct - incorrect, now, sessionId),
    ...[...perTopic].map(([nodeId, t]) =>
      db
        .prepare(
          `INSERT INTO topic_progress (user_id, curriculum_node_id, attempted, correct, incorrect, last_attempt_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, curriculum_node_id) DO UPDATE SET attempted = attempted + excluded.attempted, correct = correct + excluded.correct,
             incorrect = incorrect + excluded.incorrect, last_attempt_at = excluded.last_attempt_at`,
        )
        .bind(userId, nodeId, t.attempted, t.correct, t.incorrect, now),
    ),
  ]);
  return getSession(db, userId, sessionId);
}

/** Overall progress, per-topic accuracy and weak topics (accuracy under 60% after at least 3 attempts). */
export async function progress(db: D1Database, userId: string) {
  const [totals, topics, recent] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS sessions, COALESCE(SUM(correct_count),0) AS correct, COALESCE(SUM(incorrect_count),0) AS incorrect, COALESCE(SUM(unattempted_count),0) AS unattempted FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED'`).bind(userId).first<Record<string, number>>(),
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
  ]);
  const bySubject = new Map<string, { paper: string; paperCode: string; topics: number; attempted: number; correct: number }>();
  for (const t of topics.results) {
    const k = String(t.paper_code);
    const cur = bySubject.get(k) ?? { paper: String(t.paper), paperCode: k, topics: 0, attempted: 0, correct: 0 };
    cur.topics++;
    cur.attempted += Number(t.attempted);
    cur.correct += Number(t.correct);
    bySubject.set(k, cur);
  }
  const subjects = [...bySubject.values()]
    .map((x) => ({ ...x, accuracy: x.attempted ? Math.round((1000 * x.correct) / x.attempted) / 10 : null }))
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
