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

describe('accounts', () => {
  it('registers, signs in with a session cookie and rejects bad passwords', async () => {
    expect((await call('POST', '/api/auth/register', { email: 'a@example.test', password: 'short', displayName: 'A' })).status).toBe(400);
    expect((await call('POST', '/api/auth/register', { email: 'a@example.test', password: 'a long enough password', displayName: 'A' })).status).toBe(201);
    expect((await call('POST', '/api/auth/register', { email: 'a@example.test', password: 'a long enough password', displayName: 'A' })).status).toBe(409);
    expect((await call('POST', '/api/auth/login', { email: 'a@example.test', password: 'wrong password!' })).status).toBe(401);
    const ok = await call('POST', '/api/auth/login', { email: 'A@Example.test', password: 'a long enough password' });
    expect(ok.status).toBe(200);
    expect(ok.cookie).toMatch(/cuet_session=.+HttpOnly/i);
    const me = await call('GET', '/api/auth/me', undefined, { cookie: ok.cookie!.split(';')[0]! });
    expect(me.json.user).toMatchObject({ email: 'a@example.test', roles: ['STUDENT'] });
    // only a hash of the token is stored
    const token = ok.cookie!.split(';')[0]!.split('=')[1]!;
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM user_sessions WHERE token_hash = ?').bind(token).first()).toEqual({ c: 0 });
  });
  it('protects practice and progress routes', async () => {
    expect((await call('GET', '/api/student/progress')).status).toBe(401);
  });
});

describe('browsing verified syllabus', () => {
  it('lists the subject with its units and topics, and shows topic detail with its source page', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('browse', 'a');
    const subjects = (await call('GET', '/api/learn/exams/CUET_UG/subjects?year=2026')).json;
    expect(subjects.find((s: { code: string }) => s.code === '322')).toMatchObject({ available: true, units: 1, topics: 1, questions: 4, preview: true });
    const outline = (await call('GET', `/api/learn/subjects/${seed.paperId}`)).json;
    expect(outline.nodes.map((n: { title: string }) => n.title)).toEqual(['Electrostatics', "Coulomb's law"]);
    const topic = (await call('GET', `/api/learn/topics/${seed.topicId}`)).json;
    expect(topic).toMatchObject({ topic: { title: "Coulomb's law", sourcePage: 1 }, source: { url: URL_PHY, page: 1 }, questionCount: 4 });
    expect(topic.breadcrumb.map((b: { title: string }) => b.title)).toEqual(['Electrostatics']);
  });
});

describe('practice and mock tests', () => {
  it('practice mode returns feedback from the stored key straight away', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('practice', 'b');
    const h = await signIn('p@example.test');
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: seed.topicId }, h);
    expect(s.status).toBe(201);
    expect(s.json.questions[0].review).toBeNull();
    expect(JSON.stringify(s.json)).not.toContain('correctOptionPositions":[');
    const q = s.json.questions[0];
    const a = await call('POST', `/api/student/practice/${s.json.session.id}/answers`, { questionId: q.id, selectedPositions: [2] }, h);
    expect(a.json).toMatchObject({ outcome: 'CORRECT', score: 5, answeredBy: 'stored-answer-key' });
  });

  it('a timed mock hides answers until submission, then scores +5/-1 and records topic progress', async () => {
    const seed = await seedVerifiedSyllabusWithQuestions('mock', 'c');
    const h = await signIn('m@example.test');
    const s = await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: seed.topicId, count: 4 }, h);
    expect(s.json.session.durationSeconds).toBe(288); // 60 min / 50 questions x 4
    const [q1, q2, q3] = s.json.questions;
    expect((await call('POST', `/api/student/practice/${s.json.session.id}/answers`, { questionId: q1.id, selectedPositions: [2] }, h)).json).toEqual({ saved: true });
    await call('POST', `/api/student/practice/${s.json.session.id}/answers`, { questionId: q2.id, selectedPositions: [1] }, h);
    await call('POST', `/api/student/practice/${s.json.session.id}/answers`, { questionId: q3.id, selectedPositions: [3] }, h);
    const done = await call('POST', `/api/student/practice/${s.json.session.id}/submit`, {}, h);
    expect(done.json.session.result).toMatchObject({ score: 5 - 1 - 1, maxScore: 20, correct: 1, incorrect: 2, unattempted: 1 });
    expect(done.json.questions[0].review).toMatchObject({ outcome: 'CORRECT', correctOptionPositions: [2] });
    // submitting twice does not double-count progress
    await call('POST', `/api/student/practice/${s.json.session.id}/submit`, {}, h);
    const prog = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(prog.totals).toMatchObject({ sessions: 1, correct: 1, incorrect: 2, answered: 3, accuracy: 33.3 });
    expect(prog.weakTopics).toEqual([expect.objectContaining({ title: "Coulomb's law", attempted: 3, correct: 1 })]);
    // another student cannot read this session
    const other = await signIn('o@example.test');
    expect((await call('GET', `/api/student/practice/${s.json.session.id}`, undefined, other)).status).toBe(404);
  });
});
