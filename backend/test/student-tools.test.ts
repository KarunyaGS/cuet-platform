import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };
const PASSWORD = 'correct horse battery';

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}

const sha = (c: string) => c.repeat(64);
const URL_PHY = 'https://cdnbbsr.s3waas.gov.in/test/tools-physics.pdf';

async function seed(tag: string, digest: string) {
  await call('POST', '/api/admin/registry/papers', {
    exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: URL_PHY, listedOnUrl: 'https://cuet.nta.nic.in/' }],
  }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `tools-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url: URL_PHY, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  if (!imp.json.syllabusVersionId) throw new Error(JSON.stringify(imp.json).slice(0, 600));
  const unit = await env.DB.prepare(`SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'UNIT'`).bind(imp.json.syllabusVersionId).first<{ id: string }>();
  const topic = await env.DB.prepare(`SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'SUBTOPIC'`).bind(imp.json.syllabusVersionId).first<{ id: string }>();
  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) Question ${i}: the force between two point charges follows which law?`, difficulty: 'EASY',
      origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
      answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law gives the force between two point charges." }, topicNodeIds: [topic!.id],
    }, ADMIN);
    ids.push(q.json.id);
  }
  return { paperId: imp.json.testPaperId as string, unitId: unit!.id, topicId: topic!.id, questionIds: ids };
}

async function signIn(email: string) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: 'Test Student' });
  const res = await call('POST', '/api/auth/login', { email, password: PASSWORD });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

describe('profile and password', () => {
  it('shows and renames the profile', async () => {
    const h = await signIn('profile@example.test');
    expect((await call('GET', '/api/student/profile')).status).toBe(401);
    expect((await call('GET', '/api/student/profile', undefined, h)).json).toMatchObject({ email: 'profile@example.test', displayName: 'Test Student', testsTaken: 0, bookmarks: 0 });
    expect((await call('PUT', '/api/student/profile', { displayName: '  ' }, h)).status).toBe(400);
    expect((await call('PUT', '/api/student/profile', { displayName: 'Asha' }, h)).json).toMatchObject({ displayName: 'Asha' });
  });

  it('changes the password only with the current one, and signs out other sessions', async () => {
    const h = await signIn('pw@example.test');
    const other = await call('POST', '/api/auth/login', { email: 'pw@example.test', password: PASSWORD });
    const otherH = { ...JSON_H, cookie: other.cookie!.split(';')[0]! };
    expect((await call('POST', '/api/student/password', { currentPassword: 'not my password', newPassword: 'a brand new password' }, h)).status).toBe(400);
    expect((await call('POST', '/api/student/password', { currentPassword: PASSWORD, newPassword: 'short' }, h)).status).toBe(400);
    expect((await call('POST', '/api/student/password', { currentPassword: PASSWORD, newPassword: PASSWORD }, h)).status).toBe(400);
    expect((await call('POST', '/api/student/password', { currentPassword: PASSWORD, newPassword: 'a brand new password' }, h)).json).toEqual({ changed: true });
    expect((await call('GET', '/api/student/profile', undefined, h)).status).toBe(200); // this session stays signed in
    expect((await call('GET', '/api/student/profile', undefined, otherH)).status).toBe(401); // the other one is signed out
    expect((await call('POST', '/api/auth/login', { email: 'pw@example.test', password: PASSWORD })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'pw@example.test', password: 'a brand new password' })).status).toBe(200);
  });
});

describe('bookmarks, goals and the planner', () => {
  it('bookmarks a topic and a question, lists them with titles and removes them', async () => {
    const s = await seed('bookmarks', 'd');
    const h = await signIn('bm@example.test');
    expect((await call('POST', '/api/student/bookmarks', { kind: 'TOPIC', entityId: 'nope' }, h)).status).toBe(404);
    expect((await call('POST', '/api/student/bookmarks', { kind: 'TOPIC', entityId: s.topicId }, h)).status).toBe(201);
    expect((await call('POST', '/api/student/bookmarks', { kind: 'TOPIC', entityId: s.topicId }, h)).status).toBe(201); // twice is harmless
    await call('POST', '/api/student/bookmarks', { kind: 'QUESTION', entityId: s.questionIds[0] }, h);
    const list = (await call('GET', '/api/student/bookmarks', undefined, h)).json;
    expect(list).toHaveLength(2);
    expect(list.find((b: { kind: string }) => b.kind === 'TOPIC')).toMatchObject({ title: "Coulomb's law", nodeId: s.topicId, paper: 'Physics' });
    expect(list.find((b: { kind: string }) => b.kind === 'QUESTION')).toMatchObject({ nodeId: s.topicId, paper: 'Physics' });
    expect((await call('GET', `/api/student/bookmarks/state?kind=QUESTION&ids=${s.questionIds.join(',')}`, undefined, h)).json).toEqual([s.questionIds[0]]);
    expect((await call('GET', '/api/student/bookmarks/state?kind=BAD&ids=x', undefined, h)).status).toBe(422);
    await call('POST', '/api/student/bookmarks/remove', { kind: 'TOPIC', entityId: s.topicId }, h);
    expect((await call('GET', '/api/student/bookmarks', undefined, h)).json).toHaveLength(1);
    // another student sees none of them
    expect((await call('GET', '/api/student/bookmarks', undefined, await signIn('bm2@example.test'))).json).toEqual([]);
  });

  it('keeps daily goals with sensible defaults', async () => {
    const h = await signIn('goal@example.test');
    expect((await call('GET', '/api/student/goals', undefined, h)).json).toEqual({ questionsPerDay: 20, lessonsPerDay: 1, custom: false });
    expect((await call('PUT', '/api/student/goals', { questionsPerDay: -1, lessonsPerDay: 1 }, h)).status).toBe(400);
    expect((await call('PUT', '/api/student/goals', { questionsPerDay: 40, lessonsPerDay: 2 }, h)).json).toEqual({ questionsPerDay: 40, lessonsPerDay: 2, custom: true });
  });

  it('adds, completes, moves and deletes plan items, only for their owner', async () => {
    const h = await signIn('plan@example.test');
    expect((await call('POST', '/api/student/plan', { day: '12-11-2026', kind: 'CUSTOM', title: 'x' }, h)).status).toBe(400);
    const a = (await call('POST', '/api/student/plan', { day: '2026-11-12', kind: 'CUSTOM', title: 'Revise Coulomb' }, h)).json;
    await call('POST', '/api/student/plan', { day: '2026-11-14', kind: 'MOCK', title: 'Physics mock' }, h);
    expect((await call('GET', '/api/student/plan?from=2026-11-12&to=2026-11-13', undefined, h)).json).toEqual([
      { id: a.id, day: '2026-11-12', kind: 'CUSTOM', refId: null, title: 'Revise Coulomb', done: false },
    ]);
    expect((await call('GET', '/api/student/plan?from=bad&to=2026-11-13', undefined, h)).status).toBe(400);
    await call('PATCH', `/api/student/plan/${a.id}`, { done: true, day: '2026-11-13' }, h);
    expect((await call('GET', '/api/student/plan?from=2026-11-13&to=2026-11-13', undefined, h)).json[0]).toMatchObject({ id: a.id, done: true });
    const other = await signIn('plan2@example.test');
    expect((await call('PATCH', `/api/student/plan/${a.id}`, { done: false }, other)).status).toBe(404);
    expect((await call('DELETE', `/api/student/plan/${a.id}`, undefined, other)).status).toBe(404);
    expect((await call('DELETE', `/api/student/plan/${a.id}`, undefined, h)).json).toEqual({ deleted: true });
    expect((await call('GET', '/api/student/plan?from=2026-11-01&to=2026-11-30', undefined, h)).json).toHaveLength(1);
  });
});

describe('dashboard, daily practice and revision notes', () => {
  it('tracks continue-learning, today’s answers and subject progress', async () => {
    const s = await seed('dashboard', 'e');
    const h = await signIn('dash@example.test');
    expect((await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW' }, h)).status).toBe(422);
    expect((await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW', nodeId: s.topicId }, h)).json).toEqual({ recorded: true });
    expect((await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW', nodeId: s.topicId }, h)).json).toEqual({ recorded: false }); // throttled
    const since = new Date(Date.now() - 60_000).toISOString();
    const day = new Date().toISOString().slice(0, 10);
    const mock = (await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: s.topicId, count: 4 }, h)).json;
    await call('POST', `/api/student/practice/${mock.session.id}/answers`, { questionId: mock.questions[0].id, selectedPositions: [2] }, h);
    await call('POST', `/api/student/practice/${mock.session.id}/answers`, { questionId: mock.questions[1].id, selectedPositions: [1] }, h);
    let d = (await call('GET', `/api/student/dashboard?day=${day}&since=${encodeURIComponent(since)}`, undefined, h)).json;
    expect(d.continueLearning[0]).toMatchObject({ kind: 'TOPIC_VIEW', nodeId: s.topicId, title: "Coulomb's law", paper: 'Physics' });
    expect(d.inProgress.map((x: { id: string }) => x.id)).toEqual([mock.session.id]);
    expect(d.today).toMatchObject({ questionsAnswered: 2, lessonsOpened: 0, goal: { questionsPerDay: 20 } });
    await call('POST', `/api/student/practice/${mock.session.id}/submit`, {}, h);
    d = (await call('GET', `/api/student/dashboard?day=${day}&since=${encodeURIComponent(since)}`, undefined, h)).json;
    expect(d.inProgress).toEqual([]);
    expect(d.subjects).toEqual([expect.objectContaining({ paper: 'Physics', paperCode: '322', attempted: 2, correct: 1, accuracy: 50 })]);
    expect((await call('GET', '/api/student/dashboard?day=x&since=y', undefined, h)).status).toBe(400);
  });

  it('daily practice picks questions from the last subject and skips ones answered correctly in the last 3 days', async () => {
    const s = await seed('daily', 'f');
    const h = await signIn('daily@example.test');
    expect((await call('POST', '/api/student/practice/daily', {}, h)).json.error.code).toBe('NO_SUBJECT_YET');
    await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW', nodeId: s.topicId }, h);
    const first = await call('POST', '/api/student/practice/daily', { count: 5 }, h);
    expect(first.status).toBe(201);
    expect(first.json.session).toMatchObject({ mode: 'PRACTICE', durationSeconds: null });
    expect(first.json.questions.length).toBeGreaterThanOrEqual(4);
    const q = first.json.questions[0];
    expect((await call('POST', `/api/student/practice/${first.json.session.id}/answers`, { questionId: q.id, selectedPositions: [2] }, h)).json.outcome).toBe('CORRECT');
    const again = (await call('POST', '/api/student/practice/daily', { paperId: s.paperId, count: 5 }, h)).json;
    expect(again.questions.map((x: { id: string }) => x.id)).not.toContain(q.id);
  });

  it('revision notes collect definitions, formulas and key points from lessons under a unit', async () => {
    const s = await seed('revision', '9');
    const lesson = await call('POST', '/api/admin/resources', {
      curriculumNodeId: s.topicId, type: 'LESSON', title: "Coulomb's law", origin: 'AUTHORED', usagePermissionId: 'perm_owned',
      blocks: [
        { type: 'TEXT', body: 'A long explanation that is not part of the revision notes.' },
        { type: 'DEFINITION', body: 'Electric charge is the property of matter that causes electric force.' },
        { type: 'FORMULA', body: 'F = k q_1 q_2 / r^2' },
      ],
    }, ADMIN);
    expect(lesson.status).toBe(201);
    const notes = (await call('GET', `/api/learn/topics/${s.unitId}/revision`)).json;
    expect(notes.topic).toMatchObject({ id: s.unitId, title: 'Electrostatics', paper: 'Physics' });
    expect(notes.lessons).toHaveLength(1);
    expect(notes.lessons[0].blocks.map((b: { type: string }) => b.type)).toEqual(['DEFINITION', 'FORMULA']);
    expect((await call('GET', '/api/learn/topics/nope/revision')).status).toBe(404);
  });
});
