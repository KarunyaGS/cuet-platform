/**
 * Examination mode for mock tests (chapter tests, subject mocks and full-length mocks).
 *
 * What the server decides, and what only the browser can see:
 *  - The browser reports the events it can observe: the page being hidden (a tab switch or a minimised window), the window losing focus,
 *    and the page leaving full screen. It cannot see other applications, a second device or someone helping from outside.
 *  - The server records every report against the student's own attempt and applies the policy below. It does not trust the browser for the
 *    result: scoring, the clock, ownership and the ending of the attempt are all server-side, and an attempt that is ended is always scored
 *    from the answers already saved (work is never discarded).
 *  - A student who blocks the browser's events is not detected. This is a limit of any browser-based exam and is stated to students.
 *
 * Policy: the first incident is a warning, with a short time to return to full screen. A second incident, or failing to return in time,
 * ends the attempt. Incidents reported within a few seconds of one another are one incident (a tab switch also blurs the window).
 */
import { z } from 'zod';
import { conflict } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { VISIBLE_CONTENT } from './learning';
import { EXAM_POLICY, loadSession, paperAndRules, submitSession } from './practice';
import { buildScheme } from './scoring';

export { EXAM_POLICY };
export const VIOLATION_TYPES = ['TAB_HIDDEN', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'RETURN_TIMEOUT'] as const;
export const violationSchema = z.object({ type: z.enum(VIOLATION_TYPES), at: z.string().datetime().optional(), detail: z.string().max(200).optional() });

export const EXAM_MODES = ['TOPIC_TEST', 'MOCK_TEST'];

/** Records one reported incident and applies the policy. Ends and scores the attempt when the policy says so. */
export async function recordViolation(db: D1Database, userId: string, sessionId: string, input: z.infer<typeof violationSchema>) {
  const s = await loadSession(db, userId, sessionId);
  if (!EXAM_MODES.includes(s.mode)) throw conflict('Examination rules apply to mock tests only');
  if (s.status !== 'IN_PROGRESS') return { action: 'IGNORED' as const, incidents: await countIncidents(db, sessionId), ended: true, endReason: (await endReason(db, sessionId)) ?? null, policy: EXAM_POLICY };
  const now = new Date();
  // The browser's own clock is kept as reported, but never trusted beyond a minute either side of the server's.
  const reported = input.at ? new Date(input.at) : now;
  const occurred = Math.abs(reported.getTime() - now.getTime()) < 60_000 ? reported : now;
  const last = await db
    .prepare("SELECT recorded_at FROM exam_violations WHERE session_id = ? AND action IN ('WARNED','TERMINATED') ORDER BY recorded_at DESC LIMIT 1")
    .bind(sessionId)
    .first<{ recorded_at: string }>();
  const merged = Boolean(last) && now.getTime() - new Date(last!.recorded_at).getTime() < EXAM_POLICY.mergeSeconds * 1000 && input.type !== 'RETURN_TIMEOUT';
  const before = await countIncidents(db, sessionId);
  const incidents = merged ? before : before + 1;
  const terminate = !merged && (input.type === 'RETURN_TIMEOUT' || incidents >= EXAM_POLICY.maxIncidents);
  const action = merged ? 'MERGED' : terminate ? 'TERMINATED' : 'WARNED';
  await db
    .prepare('INSERT INTO exam_violations (id, session_id, user_id, type, occurred_at, recorded_at, detail, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('ev'), sessionId, userId, input.type, occurred.toISOString(), nowIso(), input.detail ?? null, action)
    .run();
  if (terminate) {
    // The attempt is scored from what was saved; the reason is kept with it.
    await submitSession(db, userId, sessionId, `TERMINATED_${input.type}`);
    return { action, incidents, ended: true, endReason: `TERMINATED_${input.type}`, policy: EXAM_POLICY };
  }
  return { action, incidents, ended: false, endReason: null, policy: EXAM_POLICY };
}

const countIncidents = async (db: D1Database, sessionId: string) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM exam_violations WHERE session_id = ? AND action IN ('WARNED','TERMINATED')").bind(sessionId).first<{ n: number }>())?.n ?? 0;
const endReason = async (db: D1Database, sessionId: string) => (await db.prepare('SELECT end_reason FROM practice_sessions WHERE id = ?').bind(sessionId).first<{ end_reason: string | null }>())?.end_reason;

export const previewQuery = z.object({ mode: z.enum(['TOPIC_TEST', 'MOCK_TEST']), nodeId: z.string().max(100).optional(), paperId: z.string().max(100).optional(), count: z.coerce.number().int().min(1).max(90).optional() }).refine((s) => s.nodeId || s.paperId, 'Choose a topic or a subject');

/** What the student is told on the instructions screen, worked out the same way the attempt will be built. */
export async function examPreview(db: D1Database, preview: boolean, input: z.infer<typeof previewQuery>) {
  const { paperId, rulesJson, rules, year, examCode } = await paperAndRules(db, input.nodeId, input.paperId);
  // The same scheme the attempt will be scored with (it is stored on the attempt when it starts).
  const marking = buildScheme(rulesJson, { kind: 'CUET_SIMULATION', exam: examCode, year });
  const full = rules.questionsPerPaper ?? 50;
  const want = input.count ?? (input.mode === 'MOCK_TEST' ? full : 15);
  const available = input.nodeId
    ? await db
        .prepare(
          `WITH RECURSIVE sub(id) AS (SELECT ?2 UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
           SELECT COUNT(DISTINCT q.id) AS n FROM questions q JOIN question_topics qt ON qt.question_id = q.id WHERE qt.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('q')}`,
        )
        .bind(preview ? 1 : 0, input.nodeId)
        .first<{ n: number }>()
    : await db
        .prepare(
          `SELECT COUNT(DISTINCT q.id) AS n FROM questions q LEFT JOIN question_topics qt ON qt.question_id = q.id LEFT JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
           LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE (q.test_paper_id = ?2 OR v.test_paper_id = ?2) AND ${VISIBLE_CONTENT('q')}`,
        )
        .bind(preview ? 1 : 0, paperId)
        .first<{ n: number }>();
  const questions = Math.min(want, available?.n ?? 0);
  const paper = await db.prepare('SELECT name FROM test_papers WHERE id = ?').bind(paperId).first<{ name: string }>();
  const node = input.nodeId ? await db.prepare('SELECT title FROM curriculum_nodes WHERE id = ?').bind(input.nodeId).first<{ title: string }>() : null;
  const seconds = Math.ceil((((rules.durationMinutes ?? 60) * 60) / full) * questions);
  return {
    mode: input.mode,
    title: input.mode === 'MOCK_TEST' ? `${paper?.name ?? 'Subject'}: full-length mock test` : `${node?.title ?? 'Chapter'}: mock test`,
    subject: paper?.name ?? null,
    questions,
    durationMinutes: Math.ceil(seconds / 60),
    marking: { correct: marking.correct, incorrect: marking.incorrect },
    scheme: marking,
    // Worked out from the questions this test will actually contain.
    maxMarks: questions * marking.correct,
    policy: EXAM_POLICY,
  };
}
