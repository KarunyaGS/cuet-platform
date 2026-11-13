import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
async function person(role?: string) {
  const email = `pyq-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Pyq' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}
const source = (digest: string, title: string) => ({ title, publisher: 'Test Board', url: `https://example.test/papers/${digest}.pdf`, retrievedAt: '2026-11-13T00:00:00.000Z', sha256: digest.repeat(64), byteSize: 1000, mimeType: 'application/pdf', pageCount: 3 });
const question = (position: number, key: number, over: Record<string, unknown> = {}) => ({
  position, type: 'MCQ_SINGLE', stem: `Sample ${position}: which option is marked correct in the test key?`, sourcePage: 1 + (position % 3),
  options: ['First', 'Second', 'Third', 'Fourth'].map((t, i) => ({ label: 'ABCD'[i], text: `${t} option of question ${position}` })), correctOptionPositions: [key], officialKey: [key], officialQuestionId: `10000000000${position}`, ...over,
});
/** A made-up 5-question paper (not real exam content). Question 4 was "dropped". */
const pack = (over: Record<string, unknown> = {}) => ({
  schema: 'cuet-past-paper/1', exam: 'CUET_UG', year: 2025, subjectCode: '777', subjectName: 'Sample Studies', examDate: '2025-05-20', shift: 'Shift 1', language: 'en', title: 'Sample Studies, 20 May 2025, Shift 1',
  rules: { questionsInPaper: 5, durationMinutes: 10, marksCorrect: 5, marksIncorrect: -1 }, usagePermission: 'OWNED_ORIGINAL',
  questionPaperSource: source('a', 'Sample question paper'), answerKeySource: source('b', 'Sample final answer key'), keyVersion: 'FINAL',
  questions: [question(1, 2), question(2, 3), question(3, 1), { position: 4, dropped: true, officialQuestionId: '100000000004' }, question(5, 4, { correctOptionPositions: [2, 4], officialKey: [2, 4] })],
  ...over,
});
const verifyAll = async (reviewer: { auth: Record<string, string> }, paperId: string) => {
  const { results } = await env.DB.prepare('SELECT question_id FROM past_paper_questions WHERE past_paper_id = ? AND question_id IS NOT NULL').bind(paperId).all<{ question_id: string }>();
  return call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: results.map((r) => r.question_id), action: 'VERIFIED', checklist: { matchesSource: true } }, reviewer.auth);
};

describe('previous-year papers: import checks', () => {
  it('refuses a paper with a missing question, a key that differs from the official key, or an unknown permission', async () => {
    const bad = pack({ subjectCode: '778', usagePermission: 'NOT_A_PERMISSION', questions: [question(1, 2, { officialKey: [3] }), question(2, 3), question(2, 1), question(5, 9)] });
    const r = await call('POST', '/api/admin/past-papers?dryRun=1', bad, ADMIN);
    expect(r.status).toBe(422);
    const errors = (r.json.error.details.errors as string[]).join(' | ');
    expect(errors).toMatch(/Question 1: the stored key \(2\) differs from the official key \(3\)/);
    expect(errors).toMatch(/Question 2 appears twice/);
    expect(errors).toMatch(/Question 5: the answer key points beyond the options/);
    expect(errors).toMatch(/Missing: 3, 4/);
    expect(errors).toMatch(/"NOT_A_PERMISSION" is not registered/);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM past_papers WHERE subject_code = '778'").first<{ n: number }>())!.n).toBe(0);
  });

  it('a dry run validates without writing; importing twice replaces the draft instead of duplicating', async () => {
    const p = pack({ subjectCode: '779' });
    expect((await call('POST', '/api/admin/past-papers?dryRun=1', p, ADMIN)).json).toMatchObject({ outcome: 'VALID', questions: 4, dropped: 1 });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM past_papers WHERE subject_code = '779'").first<{ n: number }>())!.n).toBe(0);
    const first = await call('POST', '/api/admin/past-papers', p, ADMIN);
    expect(first.json).toMatchObject({ outcome: 'CREATED', questions: 4, dropped: 1 });
    const again = await call('POST', '/api/admin/past-papers', p, ADMIN);
    expect(again.json).toMatchObject({ outcome: 'REPLACED', id: first.json.id });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE external_key LIKE 'pyq:cuet_ug:2025:779:%'").first<{ n: number }>())!.n).toBe(4);
    const q = await env.DB.prepare("SELECT origin, status, verification, test_paper_id, source_locator, source_document_id FROM questions WHERE external_key LIKE 'pyq:cuet_ug:2025:779:%:1'").first<Record<string, unknown>>();
    expect(q).toMatchObject({ origin: 'PAST_PAPER', status: 'DRAFT', verification: 'UNVERIFIED', test_paper_id: null, source_locator: 'Question 1, page 2' });
    expect(q!.source_document_id).toBeTruthy();
  });
});

describe('previous-year papers: licence and review gates', () => {
  it('a paper under a reference-only permission can be stored but never shown or published', async () => {
    const admin = await person('SUPER_ADMIN');
    const reviewer = await person('REVIEWER');
    const r = await call('POST', '/api/admin/past-papers', pack({ subjectCode: '780', usagePermission: 'NTA_OFFICIAL_REFERENCE', questionPaperSource: source('c', 'Reference paper'), answerKeySource: source('d', 'Reference key') }), ADMIN);
    expect(r.status).toBe(200);
    expect(r.json.warnings.join(' ')).toMatch(/does not allow showing the paper to students/);
    expect((await verifyAll(reviewer, r.json.id)).status).toBe(200);
    const publish = await call('POST', `/api/console/past-papers/${r.json.id}/status`, { action: 'PUBLISH' }, admin.auth);
    expect(publish.status).toBe(409);
    expect(publish.json.error.details.blockers).toEqual([expect.stringMatching(/does not allow showing this paper to students/)]);
    expect((await call('GET', '/api/learn/past-papers?subject=780')).json.papers).toEqual([]);
  });

  it('is hidden until a reviewer has verified every question and a member of staff publishes it', async () => {
    const admin = await person('SUPER_ADMIN');
    const reviewer = await person('REVIEWER');
    const student = await person();
    const p = await call('POST', '/api/admin/past-papers', pack({ subjectCode: '781', questionPaperSource: source('e', 'Paper 781'), answerKeySource: source('f', 'Key 781') }), ADMIN);
    const id = p.json.id as string;

    // Draft: invisible to students even though local preview shows draft lessons, and not startable.
    expect((await call('GET', '/api/learn/past-papers?subject=781')).json.papers).toEqual([]);
    expect((await call('GET', `/api/learn/past-papers/${id}`)).status).toBe(404);
    expect((await call('POST', `/api/student/past-papers/${id}/start`, { mode: 'PRACTICE' }, student.auth)).status).toBe(404);
    // The shared token can import but never publish; staff cannot publish before review.
    expect((await call('POST', `/api/console/past-papers/${id}/status`, { action: 'PUBLISH' }, student.auth)).status).toBe(403);
    const early = await call('POST', `/api/console/past-papers/${id}/status`, { action: 'PUBLISH' }, admin.auth);
    expect(early.json.error).toMatchObject({ code: 'NOT_READY', details: { blockers: ['4 of 4 questions are not yet verified by a reviewer'] } });
    const staffView = (await call('GET', `/api/console/past-papers/${id}`, undefined, admin.auth)).json;
    expect(staffView.questions.map((q: { position: number; dropped: boolean; key: number[] | null; officialKey: number[] | null }) => [q.position, q.dropped, q.key, q.officialKey])).toEqual([[1, false, [2], [2]], [2, false, [3], [3]], [3, false, [1], [1]], [4, true, null, null], [5, false, [2, 4], [2, 4]]]);

    expect((await verifyAll(reviewer, id)).status).toBe(200);
    // Once a reviewer has worked on it, an import cannot overwrite it.
    expect((await call('POST', '/api/admin/past-papers', pack({ subjectCode: '781', questionPaperSource: source('e', 'Paper 781'), answerKeySource: source('f', 'Key 781') }), ADMIN)).status).toBe(409);
    const published = await call('POST', `/api/console/past-papers/${id}/status`, { action: 'PUBLISH' }, admin.auth);
    expect(published.json).toMatchObject({ status: 'PUBLISHED', blockers: [] });

    const list = (await call('GET', '/api/learn/past-papers?exam=CUET_UG&year=2025&subject=781')).json;
    expect(list.papers).toHaveLength(1);
    expect(list.papers[0]).toMatchObject({ subjectCode: '781', year: 2025, questions: 4, dropped: 1, durationMinutes: 10 });
    expect(list.years).toContain(2025);
    expect((await call('GET', '/api/learn/past-papers?year=2024&subject=781')).json.papers).toEqual([]);
    const detail = (await call('GET', `/api/learn/past-papers/${id}`)).json;
    expect(detail).toMatchObject({ source: { publisher: 'Test Board', url: expect.stringMatching(/^https:\/\/example\.test\/papers\/e+\.pdf$/) }, answerKey: { version: 'FINAL' } });

    // Attempted as set: its own order, its own time (10 minutes for 5 questions = 8 for the 4 asked), its own marking.
    const run = await call('POST', `/api/student/past-papers/${id}/start`, { mode: 'MOCK_TEST' }, student.auth);
    expect(run.status).toBe(201);
    expect(run.json.session).toMatchObject({ mode: 'MOCK_TEST', durationSeconds: 480, marking: { correct: 5, incorrect: -1 } });
    const qs = run.json.questions as { id: string; stem: string; review: unknown }[];
    expect(qs.map((q) => q.stem.slice(0, 9))).toEqual(['Sample 1:', 'Sample 2:', 'Sample 3:', 'Sample 5:']);
    expect(qs.every((q) => q.review === null)).toBe(true);
    const answer = (i: number, pos: number) => call('POST', `/api/student/practice/${run.json.session.id}/answers`, { questionId: qs[i]!.id, selectedPositions: [pos] }, student.auth);
    await answer(0, 2); // correct
    await answer(1, 1); // wrong
    await answer(3, 4); // question 5: either accepted option earns the marks
    const done = await call('POST', `/api/student/practice/${run.json.session.id}/submit`, undefined, student.auth);
    expect(done.json.session.result).toMatchObject({ score: 9, maxScore: 20, correct: 2, incorrect: 1, unattempted: 1 });

    // Unpublishing hides it again at once.
    expect((await call('POST', `/api/console/past-papers/${id}/status`, { action: 'UNPUBLISH' }, admin.auth)).json.status).toBe('DRAFT');
    expect((await call('GET', `/api/learn/past-papers/${id}`)).status).toBe(404);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE external_key LIKE 'pyq:cuet_ug:2025:781:%' AND (status = 'PUBLISHED' OR test_paper_id IS NOT NULL)").first<{ n: number }>())!.n).toBe(0);
    const log = await env.DB.prepare("SELECT actor FROM audit_logs WHERE action = 'PUBLISH_PAST_PAPER' AND entity_id = ?").bind(id).first<{ actor: string }>();
    expect(log!.actor).toBe(`user:${admin.id}`);
  });

  it('a paper with a provisional key or without an official key cannot be published', async () => {
    const admin = await person('SUPER_ADMIN');
    const reviewer = await person('REVIEWER');
    const noKey = pack({ subjectCode: '782', questionPaperSource: source('1', 'Paper 782'), answerKeySource: undefined, keyVersion: 'PROVISIONAL', questions: [1, 2, 3, 4, 5].map((i) => question(i, 1, { officialKey: undefined })) });
    const r = await call('POST', '/api/admin/past-papers', noKey, ADMIN);
    expect(r.status).toBe(200);
    await verifyAll(reviewer, r.json.id);
    const publish = await call('POST', `/api/console/past-papers/${r.json.id}/status`, { action: 'PUBLISH' }, admin.auth);
    expect(publish.json.error.details.blockers).toEqual(['No official answer key is recorded', 'The answer key is provisional']);
  });
});
