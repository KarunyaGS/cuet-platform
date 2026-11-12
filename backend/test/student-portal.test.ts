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
const URL_PHY = 'https://cdnbbsr.s3waas.gov.in/test/portal-physics.pdf';

async function seed(tag: string, digest: string) {
  await call('POST', '/api/admin/registry/papers', {
    exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: URL_PHY, listedOnUrl: 'https://cuet.nta.nic.in/' }],
  }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `portal-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
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
  for (let i = 1; i <= 4; i++) {
    await call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) Question ${i}: the force between two point charges follows which law?`, difficulty: 'EASY',
      origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
      answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law gives the force between two point charges." }, topicNodeIds: [topic!.id],
    }, ADMIN);
  }
  return { paperId: imp.json.testPaperId as string, topicId: topic!.id };
}

async function signIn(email: string, password = PASSWORD) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: 'Test Student' });
  const res = await call('POST', '/api/auth/login', { email, password });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}
const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);

describe('academic preferences', () => {
  it('are saved per student, validated against the chosen exam, and survive signing in again', async () => {
    const s = await seed('prefs', 'a');
    const h = await signIn('prefs@example.test');
    expect((await call('GET', '/api/student/preferences', undefined, h)).json).toEqual({ examCode: null, targetYear: null, papers: [], set: false });
    expect((await call('PUT', '/api/student/preferences', { examCode: null, targetYear: null, paperIds: [s.paperId] }, h)).status).toBe(422);
    expect((await call('PUT', '/api/student/preferences', { examCode: 'CUET_PG', targetYear: 2027, paperIds: [s.paperId] }, h)).status).toBe(422);
    const ok = await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: [s.paperId] }, h);
    expect(ok.json).toMatchObject({ examCode: 'CUET_UG', targetYear: 2027, papers: [{ id: s.paperId, code: '322', name: 'Physics' }], set: true });
    const again = await signIn('prefs@example.test');
    expect((await call('GET', '/api/student/preferences', undefined, again)).json.papers).toHaveLength(1);
    expect((await call('GET', '/api/student/preferences', undefined, await signIn('prefs-other@example.test'))).json.set).toBe(false);
  });

  it('daily practice starts from the first chosen subject when nothing has been opened yet', async () => {
    const s = await seed('prefs-daily', 'b');
    const h = await signIn('prefs-daily@example.test');
    expect((await call('POST', '/api/student/practice/daily', {}, h)).json.error.code).toBe('NO_SUBJECT_YET');
    await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: null, paperIds: [s.paperId] }, h);
    const d = await call('POST', '/api/student/practice/daily', { count: 5 }, h);
    expect(d.status).toBe(201);
    expect(d.json.questions.length).toBeGreaterThan(0);
  });
});

describe('account recovery', () => {
  it('an admin creates a one-time link; it sets a new password once and signs out every device', async () => {
    const h = await signIn('reset@example.test');
    expect((await call('POST', '/api/admin/users/reset-link', { email: 'reset@example.test' })).status).toBe(401);
    expect((await call('POST', '/api/admin/users/reset-link', { email: 'nobody@example.test' }, ADMIN)).status).toBe(404);
    const link = await call('POST', '/api/admin/users/reset-link', { email: 'reset@example.test' }, ADMIN);
    expect(link.status).toBe(201);
    expect(link.json.path).toMatch(/^\/reset-password#[\w-]{30,}$/);
    const token = link.json.path.split('#')[1];
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM password_reset_tokens WHERE token_hash = ?').bind(token).first()).toEqual({ c: 0 }); // only the hash is stored
    expect((await call('POST', '/api/auth/reset-password', { token, newPassword: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/reset-password', { token, newPassword: 'a brand new password' })).json).toEqual({ reset: true });
    expect((await call('GET', '/api/student/profile', undefined, h)).status).toBe(401); // old session signed out
    expect((await call('POST', '/api/auth/reset-password', { token, newPassword: 'another new password' })).json.error.code).toBe('INVALID_RESET_LINK'); // works once
    expect((await call('POST', '/api/auth/login', { email: 'reset@example.test', password: 'a brand new password' })).status).toBe(200);
  });

  it('a newer link replaces an older one', async () => {
    await signIn('reset2@example.test');
    const first = (await call('POST', '/api/admin/users/reset-link', { email: 'reset2@example.test' }, ADMIN)).json.path.split('#')[1];
    await call('POST', '/api/admin/users/reset-link', { email: 'reset2@example.test' }, ADMIN);
    expect((await call('POST', '/api/auth/reset-password', { token: first, newPassword: 'a brand new password' })).status).toBe(400);
  });
});

describe('weekly report, reminders, recently viewed and saved revision', () => {
  it('builds the week from real answers and lessons, and compares with the week before', async () => {
    const s = await seed('weekly', 'c');
    const h = await signIn('weekly@example.test');
    const p = (await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: s.topicId, count: 4 }, h)).json;
    await call('POST', `/api/student/practice/${p.session.id}/answers`, { questionId: p.questions[0].id, selectedPositions: [2] }, h);
    await call('POST', `/api/student/practice/${p.session.id}/answers`, { questionId: p.questions[1].id, selectedPositions: [1] }, h);
    await call('POST', `/api/student/practice/${p.session.id}/submit`, {}, h);
    const today = dayOf();
    const start = dayOf(new Date(Date.now() - 2 * 86_400_000));
    const from = `${start}T00:00:00.000Z`;
    const r = (await call('GET', `/api/student/report/weekly?start=${start}&from=${encodeURIComponent(from)}&tz=0`, undefined, h)).json;
    expect(r.days).toHaveLength(7);
    expect(r.days.find((d: { day: string }) => d.day === today)).toMatchObject({ answered: 2, correct: 1 });
    expect(r.totals).toMatchObject({ answered: 2, correct: 1, accuracy: 50, sessionsSubmitted: 1, activeDays: 1 });
    expect(r.previous).toMatchObject({ answered: 0, sessionsSubmitted: 0 });
    expect(r.subjects).toEqual([expect.objectContaining({ code: '322', answered: 2, correct: 1 })]);
    expect((await call('GET', '/api/student/report/weekly?start=bad&from=x&tz=0', undefined, h)).status).toBe(400);
  });

  it('works out reminders from the student’s data and keeps dismissals after signing in again', async () => {
    const s = await seed('remind', 'd');
    const h = await signIn('remind@example.test');
    await call('POST', '/api/student/practice', { mode: 'TOPIC_TEST', nodeId: s.topicId }, h);
    await call('POST', '/api/student/plan', { day: dayOf(), kind: 'CUSTOM', title: 'Revise formulas' }, h);
    const q = `day=${dayOf()}&since=${encodeURIComponent(`${dayOf()}T00:00:00.000Z`)}`;
    const list = (await call('GET', `/api/student/reminders?${q}`, undefined, h)).json;
    expect(list.map((r: { kind: string }) => r.kind)).toEqual(['TEST', 'PLAN', 'GOAL', 'SETUP']);
    const goal = list.find((r: { kind: string }) => r.kind === 'GOAL');
    expect(goal.title).toBe('20 more questions to reach today’s goal');
    await call('POST', '/api/student/reminders/dismiss', { key: goal.key }, h);
    const again = await signIn('remind@example.test');
    expect((await call('GET', `/api/student/reminders?${q}`, undefined, again)).json.map((r: { kind: string }) => r.kind)).toEqual(['TEST', 'PLAN', 'SETUP']);
    expect((await call('GET', `/api/student/reminders?${q}`, undefined, await signIn('remind-other@example.test'))).json.map((r: { kind: string }) => r.kind)).toEqual(['GOAL', 'SETUP']);
  });

  it('lists recently viewed items and saves revision pages as bookmarks', async () => {
    const s = await seed('recent', 'e');
    const h = await signIn('recent@example.test');
    expect((await call('GET', '/api/student/recent', undefined, h)).json).toEqual([]);
    await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW', nodeId: s.topicId }, h);
    expect((await call('GET', '/api/student/recent', undefined, h)).json).toEqual([expect.objectContaining({ kind: 'TOPIC_VIEW', nodeId: s.topicId, title: "Coulomb's law", paper: 'Physics' })]);
    expect((await call('POST', '/api/student/bookmarks', { kind: 'REVISION', entityId: s.topicId }, h)).status).toBe(201);
    expect((await call('GET', '/api/student/bookmarks', undefined, h)).json).toEqual([expect.objectContaining({ kind: 'REVISION', title: "Coulomb's law", nodeId: s.topicId })]);
    expect((await call('GET', `/api/student/bookmarks/state?kind=REVISION&ids=${s.topicId}`, undefined, h)).json).toEqual([s.topicId]);
  });
});
