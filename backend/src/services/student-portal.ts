/**
 * Student portal: academic preferences, the weekly performance report, in-app reminders and recently viewed items.
 * Everything is worked out from the student's own records; nothing is generated or invented.
 */
import { z } from 'zod';
import { invalid } from '../lib/errors';
import { nowIso } from '../lib/sql';
import { getGoal } from './student-tools';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------- preferences

export const preferencesSchema = z.object({
  examCode: z.enum(['CUET_UG', 'CUET_PG']).nullable(),
  targetYear: z.number().int().min(2026).max(2035).nullable(),
  paperIds: z.array(z.string().min(1).max(100)).max(10),
});

export async function getPreferences(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT exam_code, target_year, paper_ids_json FROM student_preferences WHERE user_id = ?').bind(userId).first<{ exam_code: string | null; target_year: number | null; paper_ids_json: string }>();
  const ids: string[] = row ? JSON.parse(row.paper_ids_json) : [];
  const papers = ids.length
    ? (await db.prepare(`SELECT id, code, name FROM test_papers WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: string; code: string; name: string }>()).results
    : [];
  return {
    examCode: row?.exam_code ?? null,
    targetYear: row?.target_year ?? null,
    papers: ids.map((id) => papers.find((p) => p.id === id)).filter(Boolean) as { id: string; code: string; name: string }[],
    set: Boolean(row),
  };
}

export async function setPreferences(db: D1Database, userId: string, input: z.infer<typeof preferencesSchema>) {
  const ids = [...new Set(input.paperIds)];
  if (ids.length && !input.examCode) throw invalid('Choose the exam before choosing subjects');
  if (ids.length) {
    const { results } = await db
      .prepare(`SELECT p.id FROM test_papers p JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE e.code = ? AND p.id IN (${ids.map(() => '?').join(',')})`)
      .bind(input.examCode, ...ids)
      .all<{ id: string }>();
    if (results.length !== ids.length) throw invalid('Every subject must be a paper of the chosen exam');
  }
  await db
    .prepare(
      `INSERT INTO student_preferences (user_id, exam_code, target_year, paper_ids_json, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET exam_code = excluded.exam_code, target_year = excluded.target_year, paper_ids_json = excluded.paper_ids_json, updated_at = excluded.updated_at`,
    )
    .bind(userId, input.examCode, input.targetYear, JSON.stringify(ids), nowIso())
    .run();
  return getPreferences(db, userId);
}

// ---------------------------------------------------------------- weekly report

/** start: the local Monday (YYYY-MM-DD); from: that day's local midnight as an instant; tz: minutes east of UTC. */
export const weeklyQuery = z.object({ start: day, from: z.iso.datetime(), tz: z.coerce.number().int().min(-840).max(840) });

export async function weeklyReport(db: D1Database, userId: string, q: z.infer<typeof weeklyQuery>) {
  const from = new Date(q.from);
  const to = new Date(from.getTime() + 7 * 86_400_000).toISOString();
  const prevFrom = new Date(from.getTime() - 7 * 86_400_000).toISOString();
  const mod = `${q.tz >= 0 ? '+' : '-'}${Math.abs(q.tz)} minutes`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(q.start, i));
  const end = days[6]!;
  const ANSWERED = "a.outcome IN ('CORRECT','INCORRECT')";
  const [perDay, lessons, sessions, plan, subjects, weak, prev] = await Promise.all([
    db
      .prepare(`SELECT date(a.answered_at, ?) AS d, COUNT(*) AS n, SUM(a.outcome = 'CORRECT') AS c FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ? AND ${ANSWERED} AND a.answered_at >= ? AND a.answered_at < ? GROUP BY d`)
      .bind(mod, userId, q.from, to)
      .all<{ d: string; n: number; c: number }>(),
    db
      .prepare(`SELECT date(created_at, ?) AS d, COUNT(DISTINCT resource_id) AS n FROM learning_activity WHERE user_id = ? AND kind = 'LESSON_VIEW' AND created_at >= ? AND created_at < ? GROUP BY d`)
      .bind(mod, userId, q.from, to)
      .all<{ d: string; n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n, SUM(mode = 'MOCK_TEST') AS mocks, AVG(CASE WHEN max_score > 0 THEN 100.0 * score / max_score END) AS pct FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED' AND submitted_at >= ? AND submitted_at < ?`)
      .bind(userId, q.from, to)
      .first<{ n: number; mocks: number | null; pct: number | null }>(),
    db.prepare('SELECT COUNT(*) AS total, SUM(done) AS done FROM study_plan_items WHERE user_id = ? AND day BETWEEN ? AND ?').bind(userId, q.start, end).first<{ total: number; done: number | null }>(),
    db
      .prepare(
        `SELECT p.name AS paper, p.code, COUNT(*) AS n, SUM(a.outcome = 'CORRECT') AS c FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id JOIN questions qq ON qq.id = a.question_id JOIN test_papers p ON p.id = qq.test_paper_id
         WHERE s.user_id = ? AND ${ANSWERED} AND a.answered_at >= ? AND a.answered_at < ? GROUP BY p.id ORDER BY n DESC`,
      )
      .bind(userId, q.from, to)
      .all<{ paper: string; code: string; n: number; c: number }>(),
    db
      .prepare(
        `SELECT n.id, n.title, COUNT(*) AS attempted, SUM(a.outcome = 'CORRECT') AS correct FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id JOIN question_topics qt ON qt.question_id = a.question_id JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
         WHERE s.user_id = ? AND ${ANSWERED} AND a.answered_at >= ? AND a.answered_at < ? GROUP BY n.id HAVING attempted >= 3 AND 1.0 * correct / attempted < 0.6 ORDER BY 1.0 * correct / attempted LIMIT 5`,
      )
      .bind(userId, q.from, to)
      .all<{ id: string; title: string; attempted: number; correct: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ?1 AND ${ANSWERED} AND a.answered_at >= ?2 AND a.answered_at < ?3) AS answered,
                (SELECT SUM(a.outcome = 'CORRECT') FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ?1 AND a.answered_at >= ?2 AND a.answered_at < ?3) AS correct,
                (SELECT COUNT(DISTINCT resource_id) FROM learning_activity WHERE user_id = ?1 AND kind = 'LESSON_VIEW' AND created_at >= ?2 AND created_at < ?3) AS lessons,
                (SELECT COUNT(*) FROM practice_sessions WHERE user_id = ?1 AND status = 'SUBMITTED' AND submitted_at >= ?2 AND submitted_at < ?3) AS sessions`,
      )
      .bind(userId, prevFrom, q.from)
      .first<{ answered: number; correct: number | null; lessons: number; sessions: number }>(),
  ]);
  const byDay = days.map((d) => {
    const a = perDay.results.find((r) => r.d === d);
    return { day: d, answered: a?.n ?? 0, correct: a?.c ?? 0, lessons: lessons.results.find((r) => r.d === d)?.n ?? 0 };
  });
  const answered = byDay.reduce((t, d) => t + d.answered, 0);
  const correct = byDay.reduce((t, d) => t + d.correct, 0);
  const pct = (c: number, n: number) => (n ? Math.round((1000 * c) / n) / 10 : null);
  const goal = await getGoal(db, userId);
  return {
    start: q.start,
    end,
    days: byDay,
    totals: {
      answered,
      correct,
      accuracy: pct(correct, answered),
      lessonsOpened: byDay.reduce((t, d) => t + d.lessons, 0),
      sessionsSubmitted: sessions?.n ?? 0,
      mocks: sessions?.mocks ?? 0,
      averageScorePct: sessions?.pct === null || sessions?.pct === undefined ? null : Math.round(sessions.pct * 10) / 10,
      activeDays: byDay.filter((d) => d.answered || d.lessons).length,
      goalDays: byDay.filter((d) => goal.questionsPerDay > 0 && d.answered >= goal.questionsPerDay).length,
      planTotal: plan?.total ?? 0,
      planDone: plan?.done ?? 0,
    },
    previous: { answered: prev?.answered ?? 0, accuracy: pct(prev?.correct ?? 0, prev?.answered ?? 0), lessonsOpened: prev?.lessons ?? 0, sessionsSubmitted: prev?.sessions ?? 0 },
    goal,
    subjects: subjects.results.map((s) => ({ paper: s.paper, code: s.code, answered: s.n, correct: s.c, accuracy: pct(s.c, s.n) })),
    weakTopics: weak.results.map((w) => ({ id: w.id, title: w.title, attempted: w.attempted, correct: w.correct, accuracy: pct(w.correct, w.attempted) })),
  };
}

// ---------------------------------------------------------------- reminders

export const remindersQuery = z.object({ day, since: z.iso.datetime() });
export const dismissSchema = z.object({ key: z.string().min(3).max(200) });
type Reminder = { key: string; kind: 'TEST' | 'PLAN' | 'GOAL' | 'REVISE' | 'NOTICE' | 'SETUP'; title: string; body: string; link: string; external?: boolean };
const MODE: Record<string, string> = { PRACTICE: 'practice set', TOPIC_TEST: 'topic test', MOCK_TEST: 'mock test' };

/** Reminders worked out from the student's own data; dismissed ones stay dismissed after signing in again. */
export async function reminders(db: D1Database, userId: string, q: z.infer<typeof remindersQuery>) {
  const [tests, plan, answered, weak, prefs, dismissed, goal] = await Promise.all([
    db
      .prepare(`SELECT s.id, s.mode, s.started_at, s.duration_seconds, p.name AS paper, n.title AS topic FROM practice_sessions s LEFT JOIN test_papers p ON p.id = s.test_paper_id LEFT JOIN curriculum_nodes n ON n.id = s.curriculum_node_id WHERE s.user_id = ? AND s.status = 'IN_PROGRESS' ORDER BY s.started_at DESC LIMIT 3`)
      .bind(userId)
      .all<{ id: string; mode: string; started_at: string; duration_seconds: number | null; paper: string | null; topic: string | null }>(),
    db.prepare('SELECT COUNT(*) AS n FROM study_plan_items WHERE user_id = ? AND day = ? AND done = 0').bind(userId, q.day).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id WHERE s.user_id = ? AND a.answered_at >= ?`).bind(userId, q.since).first<{ n: number }>(),
    db
      .prepare(`SELECT n.id, n.title, tp.attempted, tp.correct FROM topic_progress tp JOIN curriculum_nodes n ON n.id = tp.curriculum_node_id WHERE tp.user_id = ? AND tp.attempted >= 3 AND 1.0 * tp.correct / tp.attempted < 0.6 ORDER BY 1.0 * tp.correct / tp.attempted LIMIT 1`)
      .bind(userId)
      .first<{ id: string; title: string; attempted: number; correct: number }>(),
    db.prepare('SELECT exam_code FROM student_preferences WHERE user_id = ?').bind(userId).first<{ exam_code: string | null }>(),
    db.prepare('SELECT key FROM reminder_dismissals WHERE user_id = ?').bind(userId).all<{ key: string }>(),
    getGoal(db, userId),
  ]);
  const out: Reminder[] = [];
  const now = Date.now();
  for (const t of tests.results) {
    if (t.duration_seconds !== null && new Date(t.started_at).getTime() + t.duration_seconds * 1000 < now) continue;
    out.push({ key: `test:${t.id}`, kind: 'TEST', title: `Finish your ${MODE[t.mode] ?? 'test'}`, body: `${t.topic ?? t.paper ?? ''}. Your answers so far are saved.`, link: `/practice/${t.id}` });
  }
  if ((plan?.n ?? 0) > 0) out.push({ key: `plan:${q.day}`, kind: 'PLAN', title: `${plan!.n} planned ${plan!.n === 1 ? 'task' : 'tasks'} left today`, body: 'Open the planner to tick them off or move them.', link: '/planner' });
  const left = goal.questionsPerDay - (answered?.n ?? 0);
  if (goal.questionsPerDay > 0 && left > 0) out.push({ key: `goal:${q.day}`, kind: 'GOAL', title: `${left} more ${left === 1 ? 'question' : 'questions'} to reach today’s goal`, body: 'Daily practice picks questions from your weak topics first.', link: '/dashboard' });
  if (weak) out.push({ key: `revise:${weak.id}:${q.day}`, kind: 'REVISE', title: 'Revise a weak topic', body: `${weak.title}: ${weak.correct} of ${weak.attempted} correct so far.`, link: `/revise/${weak.id}` });
  if (!prefs?.exam_code) out.push({ key: 'setup:preferences', kind: 'SETUP', title: 'Choose your exam and subjects', body: 'Your home page and daily practice will then start with your subjects.', link: '/profile' });
  else {
    const since = addDays(q.day, -14);
    const { results } = await db
      .prepare('SELECT id, notice_date, title, url FROM official_notices WHERE exam_code = ? AND notice_date >= ? ORDER BY notice_date DESC LIMIT 3')
      .bind(prefs.exam_code, since)
      .all<{ id: string; notice_date: string; title: string; url: string }>();
    for (const n of results) out.push({ key: `notice:${n.id}`, kind: 'NOTICE', title: `New NTA notice (${n.notice_date})`, body: n.title, link: n.url, external: true });
  }
  const gone = new Set(dismissed.results.map((d) => d.key));
  return out.filter((r) => !gone.has(r.key));
}

export async function dismissReminder(db: D1Database, userId: string, input: z.infer<typeof dismissSchema>) {
  await db.prepare('INSERT INTO reminder_dismissals (user_id, key, dismissed_at) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO NOTHING').bind(userId, input.key, nowIso()).run();
  return { dismissed: true };
}

// ---------------------------------------------------------------- recently viewed

export async function recentlyViewed(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT a.kind, a.curriculum_node_id AS node_id, a.resource_id, MAX(a.created_at) AS at, n.title AS topic, r.title AS lesson, p.name AS paper
       FROM learning_activity a LEFT JOIN curriculum_nodes n ON n.id = a.curriculum_node_id LEFT JOIN learning_resources r ON r.id = a.resource_id LEFT JOIN test_papers p ON p.id = a.test_paper_id
       WHERE a.user_id = ? GROUP BY a.kind, COALESCE(a.resource_id, a.curriculum_node_id) ORDER BY at DESC LIMIT 40`,
    )
    .bind(userId)
    .all<Record<string, string | null>>();
  return results.map((r) => ({ kind: r.kind as 'TOPIC_VIEW' | 'LESSON_VIEW', nodeId: r.node_id, resourceId: r.resource_id, title: r.lesson ?? r.topic, paper: r.paper, at: r.at }));
}
