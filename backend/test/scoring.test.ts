import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { buildScheme, evaluateResponse, markingFromRules, scoreAttempt } from '../src/services/scoring';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}

const sha = (c: string) => c.repeat(64).slice(0, 64);
const URL_PHY = 'https://cdnbbsr.s3waas.gov.in/test/student-physics.pdf';

async function seedVerifiedSyllabusWithQuestions(tag: string, digest: string) {
  await call('POST', '/api/admin/registry/papers', {
    exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: URL_PHY, listedOnUrl: 'https://cuet.nta.nic.in/' }],
  }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `student-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url: URL_PHY, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  const topic = await env.DB.prepare(`SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'SUBTOPIC'`).bind(imp.json.syllabusVersionId).first<{ id: string }>();
  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) Sample ${i}: the force between two point charges follows which law?`, difficulty: 'EASY',
      origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
      answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law gives the force between two point charges." }, topicNodeIds: [topic!.id],
    }, ADMIN);
    ids.push(q.json.id);
  }
  return { paperId: imp.json.testPaperId as string, topicId: topic!.id, questionIds: ids };
}

async function signIn(email: string) {
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: 'Test Student' });
  const res = await call('POST', '/api/auth/login', { email, password: 'correct horse battery' });
  const cookie = res.cookie!.split(';')[0]!;
  return { ...JSON_H, cookie };
}

const CUET = { correct: 5, incorrect: -1, unattempted: 0 };
const key = { correctOptionPositions: [2], numericAnswer: null, numericTolerance: null };

describe('CUET-UG scoring rules (unit)', () => {
  it('correct +5, wrong -1, unanswered 0', () => {
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [2] }, CUET)).toEqual({ outcome: 'CORRECT', score: 5 });
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [3] }, CUET)).toEqual({ outcome: 'INCORRECT', score: -1 });
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [] }, CUET)).toEqual({ outcome: 'UNATTEMPTED', score: 0 });
    expect(evaluateResponse('MCQ_SINGLE', key, {}, CUET)).toEqual({ outcome: 'UNATTEMPTED', score: 0 });
  });

  it('a key with several correct options: choosing any one of them earns the marks', () => {
    const multi = { ...key, correctOptionPositions: [1, 3] };
    expect(evaluateResponse('MCQ_SINGLE', multi, { selectedPositions: [3] }, CUET).outcome).toBe('CORRECT');
    expect(evaluateResponse('MCQ_SINGLE', multi, { selectedPositions: [1] }, CUET).outcome).toBe('CORRECT');
    expect(evaluateResponse('MCQ_SINGLE', multi, { selectedPositions: [2] }, CUET).outcome).toBe('INCORRECT');
    expect(evaluateResponse('MCQ_SINGLE', multi, { selectedPositions: [1, 3] }, CUET).outcome).toBe('INCORRECT');
  });

  it('multi-select questions: any correct option in a CUET test, the full set in plain practice', () => {
    const multi = { ...key, correctOptionPositions: [1, 3] };
    expect(evaluateResponse('MCQ_MULTI', multi, { selectedPositions: [3] }, CUET, { anyCorrectOption: true }).outcome).toBe('CORRECT');
    expect(evaluateResponse('MCQ_MULTI', multi, { selectedPositions: [1, 3] }, CUET, { anyCorrectOption: true }).outcome).toBe('CORRECT');
    expect(evaluateResponse('MCQ_MULTI', multi, { selectedPositions: [1, 2] }, CUET, { anyCorrectOption: true }).outcome).toBe('INCORRECT');
    expect(evaluateResponse('MCQ_MULTI', multi, { selectedPositions: [3] }, CUET).outcome).toBe('INCORRECT');
    expect(evaluateResponse('MCQ_MULTI', multi, { selectedPositions: [1, 3] }, CUET).outcome).toBe('CORRECT');
  });

  it('a changed answer is scored from the last saved response only', () => {
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [3] }, CUET).score).toBe(-1);
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [2] }, CUET).score).toBe(5);
    expect(evaluateResponse('MCQ_SINGLE', key, { selectedPositions: [] }, CUET).score).toBe(0);
  });

  it('totals: correct x 5 minus incorrect x 1; the maximum comes from the questions in the test', () => {
    const qs = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, dropped: false }));
    const ans = [
      ...[0, 1, 2, 3].map((i) => ({ questionId: `q${i}`, outcome: 'CORRECT' as const })),
      ...[4, 5].map((i) => ({ questionId: `q${i}`, outcome: 'INCORRECT' as const })),
      { questionId: 'q6', outcome: 'UNATTEMPTED' as const },
    ];
    expect(scoreAttempt(qs, ans, CUET)).toEqual({ score: 4 * 5 - 2, maxScore: 50, correct: 4, incorrect: 2, unattempted: 4, credited: 0 });
    expect(scoreAttempt([], [], CUET)).toEqual({ score: 0, maxScore: 0, correct: 0, incorrect: 0, unattempted: 0, credited: 0 });
    expect(scoreAttempt(qs, [], CUET)).toMatchObject({ score: 0, unattempted: 10, maxScore: 50 });
  });

  it('a dropped or wrong question gives +5 to everyone who appeared, whatever they answered', () => {
    const qs = [{ id: 'a', dropped: true }, { id: 'b', dropped: true }, { id: 'c', dropped: true }, { id: 'd', dropped: false }];
    const ans = [{ questionId: 'a', outcome: 'INCORRECT' as const }, { questionId: 'b', outcome: 'CORRECT' as const }, { questionId: 'd', outcome: 'INCORRECT' as const }];
    expect(scoreAttempt(qs, ans, CUET)).toEqual({ score: 15 - 1, maxScore: 20, correct: 0, incorrect: 1, unattempted: 0, credited: 3 });
  });

  it('counts always add up to the number of questions', () => {
    const qs = Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, dropped: i === 6 }));
    const t = scoreAttempt(qs, [{ questionId: 'q0', outcome: 'CORRECT' }, { questionId: 'q1', outcome: 'INCORRECT' }], CUET);
    expect(t.correct + t.incorrect + t.unattempted + t.credited).toBe(7);
  });

  it('there is no silent default marking scheme', () => {
    expect(() => markingFromRules(null)).toThrow(/no marking scheme/);
    expect(() => markingFromRules('{}')).toThrow(/no marking scheme/);
    expect(markingFromRules('{"marksCorrect":5,"marksIncorrect":-1}')).toEqual(CUET);
  });

  it('the scheme keeps its year and source, and says whether it is a CUET simulation or practice', () => {
    const rules = '{"marksCorrect":5,"marksIncorrect":-1,"marksUnattempted":0,"source":"https://example.test/bulletin.pdf"}';
    expect(buildScheme(rules, { kind: 'CUET_SIMULATION', exam: 'CUET_UG', year: 2026 })).toMatchObject({
      kind: 'CUET_SIMULATION', year: 2026, sourceLabel: 'NTA CUET-UG 2026 Information Bulletin', sourceUrl: 'https://example.test/bulletin.pdf', anyCorrectOption: true, creditDroppedQuestions: true,
    });
    expect(buildScheme(rules, { kind: 'PRACTICE', exam: 'CUET_UG', year: 2026 }).anyCorrectOption).toBe(false);
  });
});

describe('scoring end to end', () => {
  const start = async (h: Record<string, string>, seed: { topicId: string }, mode = 'MOCK_TEST', count = 4) => (await call('POST', '/api/student/practice', { mode, nodeId: seed.topicId, count }, h)).json;
  const answer = (h: Record<string, string>, id: string, q: string, pos: number[]) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, selectedPositions: pos }, h);
  const submit = (h: Record<string, string>, id: string) => call('POST', `/api/student/practice/${id}/submit`, {}, h);

  it('stores the scheme (marks, year, source) with the attempt, and labels practice differently', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('score-scheme', 'a');
    const h = await signIn('score-scheme@example.test');
    const mock = await start(h, seed);
    expect(mock.session.scheme).toMatchObject({ kind: 'CUET_SIMULATION', correct: 5, incorrect: -1, unattempted: 0, year: 2026, exam: 'CUET_UG', anyCorrectOption: true, creditDroppedQuestions: true });
    expect(mock.session.scheme.sourceUrl).toContain('cdnbbsr.s3waas.gov.in');
    const prac = await start(h, seed, 'PRACTICE', 2);
    expect(prac.session.scheme).toMatchObject({ kind: 'PRACTICE' });
    const pre = await call('GET', `/api/student/exam/preview?mode=MOCK_TEST&nodeId=${seed.topicId}&count=4`, undefined, h);
    expect(pre.json.scheme).toMatchObject({ year: 2026, correct: 5, incorrect: -1 });
  });

  it('scores a submitted mock exactly as correct x 5 - incorrect x 1 and reports every count', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('score-total', 'b');
    const h = await signIn('score-total@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await answer(h, s.session.id, s.questions[1].id, [1]);
    await answer(h, s.session.id, s.questions[1].id, [3]); // changed answer: still wrong, counted once
    await answer(h, s.session.id, s.questions[2].id, [1]);
    await answer(h, s.session.id, s.questions[2].id, []); // cleared: not attempted
    await call('PUT', `/api/student/practice/${s.session.id}/marks`, { questionIds: [s.questions[0].id, s.questions[3].id] }, h);
    const done = (await submit(h, s.session.id)).json;
    expect(done.session.result).toMatchObject({ score: 4, maxScore: 20, correct: 1, incorrect: 1, unattempted: 2, credited: 0 });
    // a second submit, or a late time-up, leaves the result and the progress untouched
    await submit(h, s.session.id);
    await call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h);
    expect((await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json.session.result).toMatchObject({ score: 4, correct: 1, incorrect: 1 });
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1, incorrect: 1, answered: 2, unattempted: 2, credited: 0, accuracy: 50 });
    expect(prog.topics.find((t: { id: string }) => t.id === seed.topicId)).toMatchObject({ attempted: 2, correct: 1, incorrect: 1 });
  });

  it('simultaneous submissions record the attempt and the topic progress once', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('score-race', 'c');
    const h = await signIn('score-race@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await Promise.all([submit(h, s.session.id), submit(h, s.session.id), submit(h, s.session.id)]);
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1 });
    expect(prog.topics.find((t: { id: string }) => t.id === seed.topicId)).toMatchObject({ attempted: 1, correct: 1 });
  });

  it('a question marked dropped credits +5 to everyone, now and for attempts already submitted', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('score-drop', 'd');
    const h = await signIn('score-drop@example.test');
    const before = await start(h, seed);
    await answer(h, before.session.id, before.questions[0].id, [3]); // wrong
    const first = (await submit(h, before.session.id)).json;
    expect(first.session.result).toMatchObject({ score: -1, incorrect: 1 });
    const target = before.questions[0].id as string;
    expect((await call('POST', `/api/admin/questions/${target}/key-status`, { status: 'DROPPED' }, JSON_H)).status).toBe(401);
    const drop = await call('POST', `/api/admin/questions/${target}/key-status`, { status: 'DROPPED', reason: 'NTA dropped the question' }, ADMIN);
    expect(drop.status).toBe(200);
    expect(drop.json).toMatchObject({ status: 'DROPPED', rescored: 1 });
    const redone = (await call('GET', `/api/student/practice/${before.session.id}`, undefined, h)).json;
    expect(redone.session.result).toMatchObject({ score: 5, maxScore: 20, correct: 0, incorrect: 0, credited: 1, unattempted: 3 });
    expect(redone.questions.find((q: { id: string }) => q.id === target).review).toMatchObject({ outcome: 'CREDITED', score: 5 });
    // a new attempt: credited even when the question is left unanswered
    const fresh = await start(h, seed);
    const done = (await submit(h, fresh.session.id)).json;
    expect(done.session.result).toMatchObject({ score: 5, credited: 1, unattempted: 3 });
    // subject totals add up to the overall totals
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    const sum = prog.subjects.reduce((n: number, x: { attempted: number }) => n + x.attempted, 0);
    expect(sum).toBe(prog.totals.answered);
  });
});

describe('re-scoring keeps every total consistent', () => {
  const start = async (h: Record<string, string>, seed: { topicId: string }, mode = 'MOCK_TEST', count = 4) => (await call('POST', '/api/student/practice', { mode, nodeId: seed.topicId, count }, h)).json;
  const answer = (h: Record<string, string>, id: string, q: string, pos: number[]) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, selectedPositions: pos }, h);
  const submit = (h: Record<string, string>, id: string) => call('POST', `/api/student/practice/${id}/submit`, {}, h);
  const progress = async (h: Record<string, string>) => (await call('GET', '/api/student/progress', undefined, h)).json;
  const topicOf = (prog: { topics: { id: string; attempted: number; correct: number; incorrect: number }[] }, id: string) => prog.topics.find((t) => t.id === id);

  it('dropping and restoring a question moves topic, subject and overall totals together', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('rescore-consistency', 'e');
    const h = await signIn('rescore-consistency@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]); // right
    await answer(h, s.session.id, s.questions[1].id, [3]); // wrong
    await answer(h, s.session.id, s.questions[2].id, [3]); // wrong
    await submit(h, s.session.id);
    const before = await progress(h);
    expect(topicOf(before, seed.topicId)).toMatchObject({ attempted: 3, correct: 1, incorrect: 2 });
    expect(before.totals).toMatchObject({ correct: 1, incorrect: 2, answered: 3 });

    // The wrong answer on question 2 is dropped: it no longer counts as an attempt anywhere.
    const target = s.questions[1].id as string;
    expect((await call('POST', `/api/admin/questions/${target}/key-status`, { status: 'DROPPED' }, ADMIN)).json).toMatchObject({ rescored: 1 });
    const dropped = await progress(h);
    expect(topicOf(dropped, seed.topicId)).toMatchObject({ attempted: 2, correct: 1, incorrect: 1 });
    expect(dropped.totals).toMatchObject({ correct: 1, incorrect: 1, answered: 2, credited: 1 });
    expect(dropped.subjects.reduce((n: number, x: { attempted: number }) => n + x.attempted, 0)).toBe(dropped.totals.answered);
    expect(topicOf(dropped, seed.topicId)!.attempted).toBe(dropped.totals.answered); // one topic here, so the rows reconcile exactly

    // Sending the same status again changes nothing.
    await call('POST', `/api/admin/questions/${target}/key-status`, { status: 'DROPPED' }, ADMIN);
    expect(topicOf(await progress(h), seed.topicId)).toMatchObject({ attempted: 2, correct: 1, incorrect: 1 });

    // Restoring puts everything back exactly as it was.
    await call('POST', `/api/admin/questions/${target}/key-status`, { status: 'ACTIVE' }, ADMIN);
    const restored = await progress(h);
    expect(topicOf(restored, seed.topicId)).toMatchObject({ attempted: 3, correct: 1, incorrect: 2 });
    expect(restored.totals).toMatchObject({ correct: 1, incorrect: 2, answered: 3, credited: 0 });
    const result = (await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json.session.result;
    expect(result).toMatchObject({ score: 5 - 1 - 1, correct: 1, incorrect: 2, credited: 0 });
  });

  it('an unanswered dropped question adds credit but leaves topic counters alone', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('rescore-blank', 'f');
    const h = await signIn('rescore-blank@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await submit(h, s.session.id);
    await call('POST', `/api/admin/questions/${s.questions[3].id}/key-status`, { status: 'DROPPED' }, ADMIN);
    const p = await progress(h);
    expect(topicOf(p, seed.topicId)).toMatchObject({ attempted: 1, correct: 1, incorrect: 0 });
    expect((await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json.session.result).toMatchObject({ score: 10, correct: 1, credited: 1, unattempted: 2 });
  });
});

describe('refresh, reconnect and time-up', () => {
  const start = async (h: Record<string, string>, seed: { topicId: string }, count = 4) => (await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: seed.topicId, count }, h)).json;
  const answer = (h: Record<string, string>, id: string, q: string, pos: number[]) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, selectedPositions: pos }, h);
  const get = async (h: Record<string, string>, id: string) => (await call('GET', `/api/student/practice/${id}`, undefined, h)).json;

  it('a reload restores saved answers and marks, keeps the same deadline, and shows nothing unsaved as saved', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('refresh', '0');
    const h = await signIn('refresh@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await answer(h, s.session.id, s.questions[1].id, [1]);
    await call('PUT', `/api/student/practice/${s.session.id}/marks`, { questionIds: [s.questions[2].id] }, h);
    // Question 4 was never sent to the server (typed or clicked while offline): it must come back unanswered.
    const first = await get(h, s.session.id);
    await new Promise((r) => setTimeout(r, 1200));
    const again = await get(h, s.session.id);
    expect(again.session.deadline).toBe(first.session.deadline); // the clock never restarts or stretches
    expect(again.session.startedAt).toBe(s.session.startedAt);
    expect(again.questions.map((q: { answer: { selectedPositions: number[] } | null }) => q.answer?.selectedPositions ?? null)).toEqual([[2], [1], null, null]);
    expect(again.session.marked).toEqual([s.questions[2].id]);
    expect(again.questions.every((q: { review: unknown }) => q.review === null)).toBe(true); // keys stay hidden while running
  });

  it('a save that failed is not kept: after a reload the old answer is what the server has', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('refresh-fail', '1');
    const h = await signIn('refresh-fail@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    const bad = await call('POST', `/api/student/practice/${s.session.id}/answers`, { questionId: s.questions[0].id, selectedPositions: [9] }, h); // rejected
    expect(bad.status).toBe(400);
    expect((await get(h, s.session.id)).questions[0].answer.selectedPositions).toEqual([2]);
  });

  it('after the time is up: one submission, saved answers scored, later saves refused, progress counted once', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('timeup', '2');
    const h = await signIn('timeup@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await answer(h, s.session.id, s.questions[1].id, [3]);
    // Move the start back so the allowed time (and the 30 second grace) has passed.
    await env.DB.prepare('UPDATE practice_sessions SET started_at = ? WHERE id = ?').bind(new Date(Date.now() - 3600_000).toISOString(), s.session.id).run();
    // The screen's time-up submit, a duplicate of it, and a reload all arrive together.
    const results = await Promise.all([
      call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h),
      call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h),
      call('GET', `/api/student/practice/${s.session.id}`, undefined, h),
    ]);
    for (const r of results) expect(r.status).toBe(200);
    const done = await get(h, s.session.id);
    expect(done.session).toMatchObject({ status: 'SUBMITTED', endReason: 'TIME_UP', result: { score: 4, correct: 1, incorrect: 1, unattempted: 2 } });
    expect((await answer(h, s.session.id, s.questions[2].id, [2])).status).toBe(409);
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1, incorrect: 1 });
    expect(prog.topics.find((t: { id: string }) => t.id === seed.topicId)).toMatchObject({ attempted: 2 });
  });

  it('time-up arriving together with a manual submit is still one attempt', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('timeup-race', '3');
    const h = await signIn('timeup-race@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]);
    await Promise.all([
      call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h),
      call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h),
    ]);
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1 });
    expect(prog.topics.find((t: { id: string }) => t.id === seed.topicId)).toMatchObject({ attempted: 1, correct: 1 });
    expect((await get(h, s.session.id)).session.endReason).toBe('SUBMITTED'); // far from the end, so an early time-up claim is an ordinary submit
  });
});

describe('time limit and grace period: the server decides', () => {
  const start = async (h: Record<string, string>, seed: { topicId: string }) => (await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: seed.topicId, count: 4 }, h)).json;
  const answer = (h: Record<string, string>, id: string, q: string, pos: number[]) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, selectedPositions: pos }, h);
  const get = async (h: Record<string, string>, id: string) => (await call('GET', `/api/student/practice/${id}`, undefined, h)).json;
  /** Pretends the attempt began `secondsAgo` seconds ago. The only clock that counts is the server's. */
  const startedAgo = (id: string, secondsAgo: number) => env.DB.prepare('UPDATE practice_sessions SET started_at = ? WHERE id = ?').bind(new Date(Date.now() - secondsAgo * 1000).toISOString(), id).run();

  it('shows the real end of the test: the deadline is the start plus the time allowed plus the 30 second grace', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-shape', '4');
    const h = await signIn('grace-shape@example.test');
    const s = await start(h, seed);
    const allowed = s.session.durationSeconds as number;
    expect(allowed).toBe(288); // 4 questions of a 50 question, 60 minute paper
    expect(new Date(s.session.deadline).getTime() - new Date(s.session.startedAt).getTime()).toBe((allowed + 30) * 1000);
  });

  it('before the end: answers and a manual submit are accepted and the attempt is an ordinary submit', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-before', '5');
    const h = await signIn('grace-before@example.test');
    const s = await start(h, seed);
    await startedAgo(s.session.id, 288 - 10); // 10 seconds left
    expect((await answer(h, s.session.id, s.questions[0].id, [2])).status).toBe(200);
    const done = await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    expect(done.json.session).toMatchObject({ status: 'SUBMITTED', endReason: 'SUBMITTED', result: { correct: 1, score: 5 } });
  });

  it('a time-up claim made well before the end is refused as time-up (it is an ordinary submit)', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-early', '6');
    const h = await signIn('grace-early@example.test');
    const s = await start(h, seed);
    await startedAgo(s.session.id, 288 - 60);
    const done = await call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h);
    expect(done.json.session.endReason).toBe('SUBMITTED');
  });

  it('a time-up claim within a few seconds of the end is accepted as time-up', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-near', '7');
    const h = await signIn('grace-near@example.test');
    const s = await start(h, seed);
    await startedAgo(s.session.id, 288 - 3);
    expect((await call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h)).json.session.endReason).toBe('TIME_UP');
  });

  it('just after the end, inside the grace: a late answer is still saved (the documented 30 second allowance), and the attempt ends as time-up', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-inside', '8');
    const h = await signIn('grace-inside@example.test');
    const s = await start(h, seed);
    await startedAgo(s.session.id, 288 + 10);
    expect((await answer(h, s.session.id, s.questions[0].id, [2])).status).toBe(200); // accepted: 10 s past the end, inside the 30 s grace
    const done = await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h); // a plain submit this late is recorded as the time running out
    expect(done.json.session).toMatchObject({ status: 'SUBMITTED', endReason: 'TIME_UP', result: { correct: 1 } });
  });

  it('after the grace: the late answer is refused, the attempt is submitted as time-up with only what was saved, and nothing counts twice', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-after', '9');
    const h = await signIn('grace-after@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, [2]); // saved in time
    await startedAgo(s.session.id, 288 + 45);
    const late = await answer(h, s.session.id, s.questions[1].id, [2]);
    expect(late.status).toBe(409);
    const done = await get(h, s.session.id);
    expect(done.session).toMatchObject({ status: 'SUBMITTED', endReason: 'TIME_UP', result: { correct: 1, incorrect: 0, unattempted: 3, score: 5 } });
    expect(done.questions[1].answer).toBeNull(); // the late answer was never stored
    // Repeats and claims from the screen change nothing.
    await Promise.all([1, 2, 3].map(() => call('POST', `/api/student/practice/${s.session.id}/submit`, { timedOut: true }, h)));
    await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    expect((await get(h, s.session.id)).session.result).toMatchObject({ correct: 1, score: 5 });
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1, answered: 1 });
    expect(prog.topics.find((t: { id: string }) => t.id === seed.topicId)).toMatchObject({ attempted: 1, correct: 1 });
  });

  it('the browser cannot move the clock: marks and answers never change the start or the deadline', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('grace-clock', 'a1');
    const h = await signIn('grace-clock@example.test');
    const s = await start(h, seed);
    const sent = await call('POST', `/api/student/practice/${s.session.id}/answers`, { questionId: s.questions[0].id, selectedPositions: [2], startedAt: '2030-01-01T00:00:00.000Z', deadline: '2030-01-01T00:00:00.000Z' }, h);
    expect(sent.status).toBe(200);
    const after = await get(h, s.session.id);
    expect(after.session.startedAt).toBe(s.session.startedAt);
    expect(after.session.deadline).toBe(s.session.deadline);
  });
});

describe('numerical answers', () => {
  async function seedWithNumeric(tag: string, digest: string) {
    const seed = await seedVerifiedSyllabusWithQuestions(tag, digest);
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: seed.paperId, type: 'NUMERICAL', stem: `(${tag}) A 2.0 kg trolley moves at 3.0 m/s. What is its kinetic energy in joule?`, difficulty: 'MEDIUM',
      origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false, options: [],
      answer: { numericAnswer: 9, numericTolerance: 0.05 }, explanation: { body: 'Kinetic energy is half m v squared, which is 0.5 x 2.0 x 9.0 = 9.0 J.' }, topicNodeIds: [seed.topicId],
    }, ADMIN);
    expect(q.status).toBe(201);
    return { ...seed, numericId: q.json.id as string };
  }
  const start = async (h: Record<string, string>, seed: { topicId: string }) => (await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: seed.topicId, count: 5 }, h)).json;
  const num = (h: Record<string, string>, id: string, q: string, v: number | null) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, numericAnswer: v }, h);
  const get = async (h: Record<string, string>, id: string) => (await call('GET', `/api/student/practice/${id}`, undefined, h)).json;

  it('a saved number survives a reload; an unsent one does not exist on the server; clearing puts it back to not answered', async () => {
    const seed = await seedWithNumeric('num-persist', 'b1');
    const h = await signIn('num-persist@example.test');
    const s = await start(h, seed);
    const q = s.questions.find((x: { id: string }) => x.id === seed.numericId);
    expect(q.type).toBe('NUMERICAL');
    expect(q.options).toEqual([]);
    expect(q.answer).toBeNull(); // nothing typed has been saved
    expect((await num(h, s.session.id, seed.numericId, 8.7)).status).toBe(200);
    expect((await get(h, s.session.id)).questions.find((x: { id: string }) => x.id === seed.numericId).answer).toMatchObject({ numericAnswer: 8.7 });
    expect((await num(h, s.session.id, seed.numericId, null)).status).toBe(200); // Clear
    expect((await get(h, s.session.id)).questions.find((x: { id: string }) => x.id === seed.numericId).answer?.numericAnswer ?? null).toBeNull();
  });

  it('is scored with its tolerance: inside is +5, outside is -1, cleared is 0, and the last saved value is the one that counts', async () => {
    const seed = await seedWithNumeric('num-score', 'c1');
    const h = await signIn('num-score@example.test');
    const s = await start(h, seed);
    await num(h, s.session.id, seed.numericId, 9.04); // inside 9 +/- 0.05
    await num(h, s.session.id, seed.numericId, 9.2); // changed: outside
    const done = (await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h)).json;
    expect(done.session.result).toMatchObject({ incorrect: 1, correct: 0, score: -1 });
    const review = done.questions.find((x: { id: string }) => x.id === seed.numericId).review;
    expect(review).toMatchObject({ outcome: 'INCORRECT', score: -1, correctNumericAnswer: 9 });

    const s2 = await start(h, seed);
    await num(h, s2.session.id, seed.numericId, 9.04);
    expect((await call('POST', `/api/student/practice/${s2.session.id}/submit`, {}, h)).json.session.result).toMatchObject({ correct: 1, incorrect: 0, score: 5 });

    const s3 = await start(h, seed);
    await num(h, s3.session.id, seed.numericId, 3);
    await num(h, s3.session.id, seed.numericId, null);
    expect((await call('POST', `/api/student/practice/${s3.session.id}/submit`, {}, h)).json.session.result).toMatchObject({ correct: 0, incorrect: 0, score: 0 });
  });
});
