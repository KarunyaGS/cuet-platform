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
async function signIn(email: string, role?: string) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: email.split('@')[0] });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const res = await call('POST', '/api/auth/login', { email, password: PASSWORD });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}
const URL_PHY = 'https://cdnbbsr.s3waas.gov.in/test/console-physics.pdf';
async function seed(tag: string, digest: string) {
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: URL_PHY, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `console-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url: URL_PHY, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: digest.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  const topic = await env.DB.prepare(`SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'SUBTOPIC'`).bind(imp.json.syllabusVersionId).first<{ id: string }>();
  const q = await call('POST', '/api/admin/questions', {
    testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) The force between two point charges follows which law?`, difficulty: 'EASY',
    origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
    options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }],
    answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law gives the force between two point charges." }, topicNodeIds: [topic!.id],
  }, ADMIN);
  const lesson = await call('POST', '/api/admin/resources', { curriculumNodeId: topic!.id, type: 'LESSON', title: `(${tag}) Coulomb's law`, origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks: [{ type: 'TEXT', body: 'Like charges repel.' }] }, ADMIN);
  return { paperId: imp.json.testPaperId as string, questionId: q.json.id as string, lessonId: lesson.json.id as string };
}

describe('admin console access', () => {
  it('is closed to visitors, students and reviewers; open to admins by their own sign-in', async () => {
    expect((await call('GET', '/api/console/overview')).status).toBe(401);
    expect((await call('GET', '/api/console/overview', undefined, await signIn('stu@example.test'))).status).toBe(403);
    expect((await call('GET', '/api/console/overview', undefined, await signIn('rev@example.test', 'REVIEWER'))).status).toBe(403);
    const a = await signIn('boss@example.test', 'SUPER_ADMIN');
    const ov = await call('GET', '/api/console/overview', undefined, a);
    expect(ov.status).toBe(200);
    expect(ov.json.counts).toMatchObject({ students: 3, suspended: 0, human_decisions: 0 });
    // a content admin can manage content but not accounts
    const ca = await signIn('content@example.test', 'CONTENT_ADMIN');
    expect((await call('GET', '/api/console/content?type=QUESTION', undefined, ca)).status).toBe(200);
    expect((await call('GET', '/api/console/students', undefined, ca)).status).toBe(403);
  });
});

describe('student management', () => {
  it('lists and searches accounts, shows one student, suspends and restores with an audit trail', async () => {
    const a = await signIn('boss2@example.test', 'SUPER_ADMIN');
    const s = await signIn('asha@example.test');
    const list = (await call('GET', '/api/console/students?q=asha', undefined, a)).json;
    expect(list).toMatchObject({ total: 1, items: [{ email: 'asha@example.test', status: 'ACTIVE', roles: ['STUDENT'], tests: 0 }] });
    const id = list.items[0].id;
    expect((await call('GET', `/api/console/students/${id}`, undefined, a)).json).toMatchObject({ email: 'asha@example.test', totals: { sessions: 0, answered: 0, accuracy: null }, openSessions: 1 });
    expect((await call('POST', `/api/console/students/${id}/status`, { status: 'DISABLED', reason: 'Test' }, a)).json).toEqual({ id, status: 'DISABLED' });
    expect((await call('GET', '/api/student/profile', undefined, s)).status).toBe(401); // signed out at once
    expect((await call('POST', '/api/auth/login', { email: 'asha@example.test', password: PASSWORD })).status).toBe(401);
    await call('POST', `/api/console/students/${id}/status`, { status: 'ACTIVE' }, a);
    expect((await call('POST', '/api/auth/login', { email: 'asha@example.test', password: PASSWORD })).status).toBe(200);
    const log = (await call('GET', '/api/console/activity?action=ACCOUNT_SUSPENDED', undefined, a)).json;
    expect(log.items[0]).toMatchObject({ action: 'ACCOUNT_SUSPENDED', entityLabel: 'asha@example.test', actorName: 'boss2' });
    const me = (await call('GET', '/api/console/me', undefined, a)).json;
    expect((await call('POST', `/api/console/students/${me.id}/status`, { status: 'DISABLED' }, a)).status).toBe(422);
    const link = await call('POST', '/api/console/students/reset-link', { email: 'asha@example.test' }, a);
    expect(link.status).toBe(201);
    expect(link.json.path).toMatch(/^\/reset-password#/);
  });
});

describe('roles, assignments and content review', () => {
  it('admin grants a reviewer role and assigns a paper; the reviewer reviews a question and a lesson', async () => {
    const s = await seed('review', 'a');
    const a = await signIn('boss3@example.test', 'SUPER_ADMIN');
    await signIn('newrev@example.test');
    expect((await call('POST', '/api/console/assignments', { email: 'newrev@example.test', paperId: s.paperId, scope: 'CONTENT' }, a)).status).toBe(422); // not a reviewer yet
    expect((await call('POST', '/api/console/roles', { email: 'newrev@example.test', role: 'REVIEWER' }, a)).json).toMatchObject({ role: 'REVIEWER', granted: true });
    expect((await call('POST', '/api/console/roles', { email: 'boss3@example.test', role: 'SUPER_ADMIN', grant: false }, a)).status).toBe(422);
    expect((await call('POST', '/api/console/assignments', { email: 'newrev@example.test', paperId: s.paperId, scope: 'CONTENT', note: 'Unit 1 first' }, a)).status).toBe(201);
    const staff = (await call('GET', '/api/console/staff', undefined, a)).json;
    expect(staff.staff.map((x: { email: string }) => x.email)).toContain('newrev@example.test');
    expect(staff.roles.find((r: { code: string }) => r.code === 'REVIEWER').permissions).toContain('content:review');

    const r = { ...JSON_H, cookie: (await call('POST', '/api/auth/login', { email: 'newrev@example.test', password: PASSWORD })).cookie!.split(';')[0]! };
    const dash = (await call('GET', '/api/review/dashboard', undefined, r)).json;
    expect(dash.assignments).toEqual([expect.objectContaining({ scope: 'CONTENT', note: 'Unit 1 first', paper: expect.objectContaining({ code: '322' }), progress: { total: 2, decided: 0 } })]);
    const qs = (await call('GET', `/api/review/content?type=QUESTION&paperId=${s.paperId}&verification=UNVERIFIED`, undefined, r)).json;
    expect(qs).toMatchObject({ total: 1, items: [{ id: s.questionId, paperCode: '322', verification: 'UNVERIFIED' }] });
    const q = (await call('GET', `/api/review/content/QUESTION/${s.questionId}`, undefined, r)).json;
    expect(q.answerKey).toBeTruthy(); // reviewers see the key and the explanation
    expect((await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [s.questionId], action: 'VERIFIED' }, r)).status).toBe(422); // must confirm what was checked
    expect((await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [s.questionId], action: 'VERIFIED', checklist: { answerCorrect: true } }, r)).json).toMatchObject({ applied: 1 });
    expect((await call('POST', '/api/review/decide', { entityType: 'LEARNING_RESOURCE', entityIds: [s.lessonId], action: 'CHANGES_REQUESTED', comment: 'Add the formula.' }, r)).json).toMatchObject({ applied: 1 });
    expect((await call('GET', `/api/review/content?type=LEARNING_RESOURCE&verification=NEEDS_CHANGES`, undefined, r)).json.items[0]).toMatchObject({ id: s.lessonId });
    const hist = (await call('GET', `/api/review/history?entityType=LEARNING_RESOURCE&entityId=${s.lessonId}`, undefined, r)).json;
    expect(hist[0]).toMatchObject({ comment: 'Add the formula.', actorName: 'newrev' });
    const after = (await call('GET', '/api/review/dashboard', undefined, r)).json;
    expect(after.myDecisions).toBe(2);
    expect(after.assignments[0].progress).toEqual({ total: 2, decided: 2 });
    // the flagged lesson is hidden from students at once; the admin sees one human decision more
    expect((await call('GET', `/api/learn/resources/${s.lessonId}`)).status).toBe(404);
    expect((await call('GET', '/api/console/overview', undefined, a)).json.counts.human_decisions).toBe(2);
    // admin workflow: verified question can be submitted, approved and published; verification itself cannot be set here
    expect((await call('POST', '/api/console/content/workflow', { entityType: 'QUESTION', entityIds: [s.questionId], action: 'VERIFIED' }, a)).status).toBe(422);
    for (const action of ['SUBMITTED', 'APPROVED', 'PUBLISHED']) expect((await call('POST', '/api/console/content/workflow', { entityType: 'QUESTION', entityIds: [s.questionId], action }, a)).status).toBe(200);
    expect((await call('GET', `/api/console/content?type=QUESTION&status=PUBLISHED`, undefined, a)).json.total).toBe(1);
    // students and reviewers cannot use the admin workflow
    expect((await call('POST', '/api/console/content/workflow', { entityType: 'QUESTION', entityIds: [s.questionId], action: 'UNPUBLISHED' }, r)).status).toBe(403);
  });
});
