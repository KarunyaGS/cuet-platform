import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}

const sha = (c: string) => c.repeat(64);
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


describe('examination mode', () => {
  const start = async (h: Record<string, string>, seed: { topicId: string }, mode = 'MOCK_TEST', count = 4) => (await call('POST', '/api/student/practice', { mode, nodeId: seed.topicId, count }, h)).json;
  const report = (h: Record<string, string>, id: string, type: string) => call('POST', `/api/student/practice/${id}/violations`, { type }, h);
  const answer = (h: Record<string, string>, id: string, q: string, pos: number) => call('POST', `/api/student/practice/${id}/answers`, { questionId: q, selectedPositions: [pos] }, h);

  it('tells the student the rules before the test: title, subject, time, questions, marks', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-pre', '1');
    const h = await signIn('exam-pre@example.test');
    const p = await call('GET', `/api/student/exam/preview?mode=MOCK_TEST&nodeId=${seed.topicId}&count=4`, undefined, h);
    expect(p.status).toBe(200);
    expect(p.json).toMatchObject({ mode: 'MOCK_TEST', subject: 'Physics', questions: 4, durationMinutes: 5, marking: { correct: 5, incorrect: -1 }, maxMarks: 20, policy: { maxIncidents: 2, returnSeconds: 15 } });
    expect((await call('GET', '/api/student/exam/preview?mode=PRACTICE&nodeId=x', undefined, h)).status).toBe(400);
    expect((await call('GET', `/api/student/exam/preview?mode=MOCK_TEST&nodeId=${seed.topicId}`)).status).toBe(401);
  });

  it('first incident warns and is recorded; the attempt carries on with its answers', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-warn', '2');
    const h = await signIn('exam-warn@example.test');
    const s = await start(h, seed);
    expect(s.session.exam).toMatchObject({ maxIncidents: 2, returnSeconds: 15, incidents: 0, violations: [] });
    await answer(h, s.session.id, s.questions[0].id, 2);
    const r = await report(h, s.session.id, 'TAB_HIDDEN');
    expect(r.json).toMatchObject({ action: 'WARNED', incidents: 1, ended: false });
    const again = await call('GET', `/api/student/practice/${s.session.id}`, undefined, h);
    expect(again.json.session).toMatchObject({ status: 'IN_PROGRESS', endReason: null, exam: { incidents: 1, violations: [expect.objectContaining({ type: 'TAB_HIDDEN', action: 'WARNED' })] } });
    expect(again.json.questions[0].answer.selectedPositions).toEqual([2]);
  });

  it('a second incident ends the attempt, scores the saved answers and records the reason', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-end', '3');
    const h = await signIn('exam-end@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, 2);
    await answer(h, s.session.id, s.questions[1].id, 1);
    expect((await report(h, s.session.id, 'FULLSCREEN_EXIT')).json.action).toBe('WARNED');
    await new Promise((r) => setTimeout(r, 4200)); // incidents closer than a few seconds are one incident
    const second = await report(h, s.session.id, 'TAB_HIDDEN');
    expect(second.json).toMatchObject({ action: 'TERMINATED', incidents: 2, ended: true, endReason: 'TERMINATED_TAB_HIDDEN' });
    const done = (await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json;
    expect(done.session).toMatchObject({ status: 'SUBMITTED', endReason: 'TERMINATED_TAB_HIDDEN', result: { score: 5 - 1, correct: 1, incorrect: 1, unattempted: 2 } });
    expect(done.session.exam.violations.map((v: { action: string }) => v.action)).toEqual(['WARNED', 'TERMINATED']);
    // nothing more can be changed, and a second submit does not double-count
    expect((await answer(h, s.session.id, s.questions[2].id, 2)).status).toBe(409);
    await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    expect((await call('GET', '/api/student/progress', undefined, h)).json.totals).toMatchObject({ sessions: 1, answered: 2 });
  });

  it('a tab switch that also blurs the window counts once', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-merge', '4');
    const h = await signIn('exam-merge@example.test');
    const s = await start(h, seed);
    expect((await report(h, s.session.id, 'TAB_HIDDEN')).json).toMatchObject({ action: 'WARNED', incidents: 1 });
    expect((await report(h, s.session.id, 'WINDOW_BLUR')).json).toMatchObject({ action: 'MERGED', incidents: 1, ended: false });
  });

  it('not returning to full screen in time ends the attempt at once', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-timeout', '5');
    const h = await signIn('exam-timeout@example.test');
    const s = await start(h, seed);
    await report(h, s.session.id, 'FULLSCREEN_EXIT');
    const r = await report(h, s.session.id, 'RETURN_TIMEOUT');
    expect(r.json).toMatchObject({ action: 'TERMINATED', ended: true, endReason: 'TERMINATED_RETURN_TIMEOUT' });
  });

  it('chapter tests follow the same rules; practice does not', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-topic', '6');
    const h = await signIn('exam-topic@example.test');
    const t = await start(h, seed, 'TOPIC_TEST', 3);
    expect((await report(h, t.session.id, 'TAB_HIDDEN')).json.action).toBe('WARNED');
    const p = await start(h, seed, 'PRACTICE', 3);
    expect(p.session.exam).toBeNull();
    expect((await report(h, p.session.id, 'TAB_HIDDEN')).status).toBe(409);
  });

  it('only the owner can report on an attempt; reports after the end change nothing', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-own', '7');
    const h = await signIn('exam-own@example.test');
    const other = await signIn('exam-other@example.test');
    const s = await start(h, seed);
    expect((await report(other, s.session.id, 'TAB_HIDDEN')).status).toBe(404);
    expect((await call('POST', `/api/student/practice/${s.session.id}/violations`, { type: 'TAB_HIDDEN' })).status).toBe(401);
    expect((await call('POST', `/api/student/practice/${s.session.id}/violations`, { type: 'NOT_A_TYPE' }, h)).status).toBe(400);
    await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    const late = await report(h, s.session.id, 'TAB_HIDDEN');
    expect(late.json).toMatchObject({ action: 'IGNORED', ended: true });
    expect((await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json.session).toMatchObject({ endReason: 'SUBMITTED' });
  });

  it('time running out ends and scores the attempt on the server, with the reason TIME_UP', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-time', '8');
    const h = await signIn('exam-time@example.test');
    const s = await start(h, seed);
    await answer(h, s.session.id, s.questions[0].id, 2);
    await env.DB.prepare('UPDATE practice_sessions SET started_at = ? WHERE id = ?').bind(new Date(Date.now() - 3600_000).toISOString(), s.session.id).run();
    const after = (await call('GET', `/api/student/practice/${s.session.id}`, undefined, h)).json;
    expect(after.session).toMatchObject({ status: 'SUBMITTED', endReason: 'TIME_UP', result: { score: 5, correct: 1 } });
  });
  it('a time-up submission is accepted as such only at the real end of the time', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('exam-up', '9');
    const h = await signIn('exam-up@example.test');
    const early = await start(h, seed);
    await call('POST', `/api/student/practice/${early.session.id}/submit`, { timedOut: true }, h);
    expect((await call('GET', `/api/student/practice/${early.session.id}`, undefined, h)).json.session.endReason).toBe('SUBMITTED');
    const late = await start(h, seed);
    await env.DB.prepare('UPDATE practice_sessions SET started_at = ? WHERE id = ?').bind(new Date(Date.now() - 290_000).toISOString(), late.session.id).run();
    await call('POST', `/api/student/practice/${late.session.id}/submit`, { timedOut: true }, h);
    expect((await call('GET', `/api/student/practice/${late.session.id}`, undefined, h)).json.session.endReason).toBe('TIME_UP');
  });
});
