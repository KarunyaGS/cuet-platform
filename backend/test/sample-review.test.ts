import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { allocate, upperBound95 } from '../src/services/sample-review';

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
  const email = `sample-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Sample Tester' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}

describe('the numbers behind a sample review', () => {
  it('spreads the sample over the groups in proportion, and never more than a group holds', () => {
    expect(allocate([20, 10], 9)).toEqual([6, 3]);
    expect(allocate([20, 10], 10)).toEqual([7, 3]);
    // Every group is represented when there is room for it.
    expect(allocate([100, 1, 1], 10)).toEqual([8, 1, 1]);
    expect(allocate([5, 5, 5, 5], 3)).toHaveLength(4);
    expect(allocate([5, 5, 5, 5], 3).reduce((a, b) => a + b, 0)).toBe(3);
    // A sample bigger than the population is the whole population.
    expect(allocate([3, 2], 50)).toEqual([3, 2]);
    expect(allocate([], 10)).toEqual([]);
    expect(allocate([0, 0], 10)).toEqual([0, 0]);
  });

  it('turns "found k problems in n" into the highest share of problems that is still consistent with it', () => {
    // The "rule of three": none found in 60 means, at 95% confidence, no more than about 5%.
    expect(upperBound95(0, 60)).toBeCloseTo(1 - 0.05 ** (1 / 60), 4);
    expect(upperBound95(0, 60)).toBeGreaterThan(0.048);
    expect(upperBound95(0, 60)).toBeLessThan(0.05);
    // More problems found, higher bound; a bigger sample, lower bound.
    expect(upperBound95(3, 60)).toBeGreaterThan(upperBound95(1, 60));
    expect(upperBound95(0, 120)).toBeLessThan(upperBound95(0, 60));
    // 3 of 60 is 5% found; the honest upper bound is well above that.
    expect(upperBound95(3, 60)).toBeGreaterThan(0.05);
    expect(upperBound95(5, 5)).toBe(1);
  });
});

describe('subject-expert sample review', () => {
  const URL = 'https://cdnbbsr.s3waas.gov.in/test/sample-subject.pdf';
  let paperId = '';
  let topicA = '';
  let topicB = '';
  let all: string[] = [];
  let reviewer: Awaited<ReturnType<typeof person>>;
  let student: Awaited<ReturnType<typeof person>>;
  const make = async (stem: string, k: number, topicId: string) => {
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: paperId, type: 'MCQ_SINGLE', stem, difficulty: 'EASY', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: `Statement ${l} for ${stem}` })),
      answer: { correctOptionPositions: [1 + (k % 4)] },
      explanation: { body: `Statement ${'ABCD'[k % 4]} is correct because this is a made-up test item for the sample review test.` },
      topicNodeIds: [topicId],
    }, ADMIN);
    expect(q.status, JSON.stringify(q.json).slice(0, 200)).toBe(201);
    return q.json.id as string;
  };
  const verification = async () => (await env.DB.prepare('SELECT verification, COUNT(*) AS n FROM questions WHERE test_paper_id = ? GROUP BY verification').bind(paperId).all<{ verification: string; n: number }>()).results;
  const create = (body: Record<string, unknown> = {}) => call('POST', '/api/review/sample-reviews', { testPaperId: paperId, size: 10, ...body }, reviewer.auth);
  const check = (id: string, q: string, body: Record<string, unknown> = { answerCorrect: true, explanationAccurate: true, topicFits: true }) => call('POST', `/api/review/sample-reviews/${id}/items/${q}`, body, reviewer.auth);
  const questionsOf = async (id: string) => ((await call('GET', `/api/review/sample-reviews/${id}`, undefined, reviewer.auth)).json.items as { question: { id: string } }[]).map((i) => i.question.id);

  beforeAll(async () => {
    [reviewer, student] = [await person('REVIEWER'), await person()];
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '907', name: 'Sample Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: URL, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `sample-studies-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '907',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Sample Studies (907)', publisher: 'NTA', url: URL, retrievedAt: '2026-11-18T00:00:00.000Z', sha256: '9'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST_METHOD', metrics: {} },
      nodes: [
        { ref: 'u0', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit A of sample studies', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] },
        { ref: 'u0t0', parentRef: 'u0', kind: 'TOPIC', label: '1', title: 'Topic in unit A', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
        { ref: 'u1', parentRef: null, kind: 'UNIT', label: '2', title: 'Unit B of sample studies', body: null, position: 1, depth: 1, sourcePage: 1, flags: [] },
        { ref: 'u1t0', parentRef: 'u1', kind: 'TOPIC', label: '1', title: 'Topic in unit B', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
      ],
      tables: [], figures: [],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    paperId = imp.json.testPaperId;
    const topic = async (title: string) => (await env.DB.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND title = ?').bind(imp.json.syllabusVersionId, title).first<{ id: string }>())!.id;
    [topicA, topicB] = [await topic('Topic in unit A'), await topic('Topic in unit B')];
    for (let i = 0; i < 20; i++) all.push(await make(`Sample question A${i}: which statement is correct here?`, i, topicA));
    for (let i = 0; i < 10; i++) all.push(await make(`Sample question B${i}: which statement is correct here?`, i, topicB));
  }, 180_000);

  it('can only be used by a signed-in reviewer, never by the admin token or a student', async () => {
    expect((await call('POST', '/api/review/sample-reviews', { testPaperId: paperId }, ADMIN)).status).toBe(401);
    expect((await call('POST', '/api/review/sample-reviews', { testPaperId: paperId }, student.auth)).status).toBe(403);
    expect((await call('GET', '/api/review/sample-reviews')).status).toBe(401);
    expect((await call('GET', '/api/review/sample-reviews', undefined, student.auth)).status).toBe(403);
  });

  it('draws a sample spread over the units in proportion, and the same seed draws the same sample', async () => {
    const a = await create({ seed: 'fixed-seed-1' });
    expect(a.status).toBe(201);
    expect(a.json).toMatchObject({ population: 30, sampleCount: 10, seed: 'fixed-seed-1', method: 'SAMPLE_REVIEW_STRATIFIED_BY_UNIT_v1' });
    const detail = (await call('GET', `/api/review/sample-reviews/${a.json.id}`, undefined, reviewer.auth)).json;
    const byUnit: Record<string, number> = {};
    for (const i of detail.items) byUnit[i.unit] = (byUnit[i.unit] ?? 0) + 1;
    expect(byUnit).toEqual({ 'Unit A of sample studies': 7, 'Unit B of sample studies': 3 });
    // The expert sees the question, the key and the explanation, and nothing has been judged yet.
    const first = detail.items[0];
    expect(first).toMatchObject({ outcome: 'PENDING', answerCorrect: null });
    expect(first.question.options).toHaveLength(4);
    expect(first.question.correctPositions).toHaveLength(1);
    expect(first.question.explanation).toMatch(/made-up test item/);
    // One sample in progress per scope.
    expect((await create()).status).toBe(409);
    const ids = await questionsOf(a.json.id);
    expect((await call('POST', `/api/review/sample-reviews/${a.json.id}/cancel`, { reason: 'Redrawing with the same seed' }, reviewer.auth)).status).toBe(200);
    const b = await create({ seed: 'fixed-seed-1' });
    expect(await questionsOf(b.json.id)).toEqual(ids);
    expect((await call('POST', `/api/review/sample-reviews/${b.json.id}/cancel`, { reason: 'Redrawing with another seed' }, reviewer.auth)).status).toBe(200);
    const c = await create({ seed: 'another-seed' });
    expect(await questionsOf(c.json.id)).not.toEqual(ids);
    await call('POST', `/api/review/sample-reviews/${c.json.id}/cancel`, { reason: 'Test finished with this draw' }, reviewer.auth);
  });

  it('records findings, refuses a problem without a note, and refuses to finish while questions are unchecked', async () => {
    const before = await verification();
    const s = await create({ seed: 'findings' });
    const ids = await questionsOf(s.json.id);
    expect((await check(s.json.id, ids[0]!, { answerCorrect: false, explanationAccurate: true, topicFits: true })).status).toBe(422);
    const bad = await check(s.json.id, ids[0]!, { answerCorrect: false, explanationAccurate: true, topicFits: true, comment: 'The key points at the wrong option.' });
    expect(bad.json).toMatchObject({ outcome: 'NEEDS_CHANGES', pending: 9 });
    expect((await check(s.json.id, 'no-such-question')).status).toBe(404);
    const done = { expertName: 'Dr Test Expert', expertCredentials: 'PhD Physics, 12 years teaching CUET', confirm: true };
    const early = await call('POST', `/api/review/sample-reviews/${s.json.id}/complete`, done, reviewer.auth);
    expect(early.status).toBe(409);
    expect(early.json.error.message).toMatch(/9 questions have not been checked yet/);
    // A student cannot record anything.
    expect((await check(s.json.id, ids[1]!)).status).toBe(200);
    expect((await call('POST', `/api/review/sample-reviews/${s.json.id}/items/${ids[2]}`, { answerCorrect: true, explanationAccurate: true, topicFits: true }, student.auth)).status).toBe(403);
    // Finishing the whole sample: one wrong answer, one wrong topic, eight fine.
    for (const q of ids.slice(2, 9)) expect((await check(s.json.id, q)).status).toBe(200);
    expect((await check(s.json.id, ids[9]!, { answerCorrect: true, explanationAccurate: true, topicFits: false, comment: 'Belongs under the other unit.' })).json.pending).toBe(0);
    // The confirmation and the expert's details are required.
    expect((await call('POST', `/api/review/sample-reviews/${s.json.id}/complete`, { ...done, confirm: false }, reviewer.auth)).status).toBe(400);
    expect((await call('POST', `/api/review/sample-reviews/${s.json.id}/complete`, { ...done, expertCredentials: '' }, reviewer.auth)).status).toBe(400);
    const fin = await call('POST', `/api/review/sample-reviews/${s.json.id}/complete`, done, reviewer.auth);
    expect(fin.status).toBe(200);
    expect(fin.json).toMatchObject({ checked: 10, population: 30, ok: 8, withProblem: 2, wrongAnswer: 1, weakExplanation: 0, wrongTopic: 1 });
    expect(fin.json.upperBoundAnyProblem).toBeGreaterThan(0.2);
    expect(fin.json.statement).toMatch(/^SAMPLE REVIEW, not individual verification of every question\. Dr Test Expert \(PhD Physics, 12 years teaching CUET\) checked 10 of 30 questions/);
    expect(fin.json.statement).toMatch(/The other 20 questions were not checked individually\./);
    // Findings are final once completed.
    expect((await check(s.json.id, ids[0]!)).status).toBe(409);
    // A sample review records findings only: no question's status moved.
    expect(await verification()).toEqual(before);
    const list = (await call('GET', '/api/review/sample-reviews', undefined, reviewer.auth)).json.samples;
    expect(list.find((x: { id: string }) => x.id === s.json.id)).toMatchObject({ status: 'COMPLETED', done: 10, expertName: 'Dr Test Expert' });
    const audit = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE entity_id = ? AND action IN ('SAMPLE_REVIEW_STARTED','SAMPLE_REVIEW_COMPLETED')`).bind(s.json.id).first<{ n: number }>();
    expect(audit?.n).toBe(2);
  });

  it('is shown next to the bulk approval, and the batch keeps a note of it', async () => {
    const none = await call('POST', '/api/review/bulk-approval/preview', { scope: { testPaperId: 'no-such-paper' } }, reviewer.auth);
    expect(none.json.sampleReview).toBeNull();
    const p = await call('POST', '/api/review/bulk-approval/preview', { scope: { testPaperId: paperId } }, reviewer.auth);
    expect(p.status).toBe(200);
    expect(p.json.sampleReview).toMatchObject({ expertName: 'Dr Test Expert', checked: 10, population: 30, withProblem: 2, wrongAnswer: 1, questionsChangedSince: false });
    expect(p.json.sampleReview.statement).toMatch(/not individual verification/);
    // The approval itself is unchanged by the sample, and records which sample stood beside it.
    const ok = await call('POST', '/api/review/bulk-approval/confirm', { scope: { testPaperId: paperId }, snapshotHash: p.json.snapshotHash, typed: p.json.phraseToType, statement: p.json.statement }, reviewer.auth);
    expect(ok.status).toBe(201);
    const batch = await env.DB.prepare('SELECT checks_json FROM bulk_approval_batches WHERE id = ?').bind(ok.json.batchId).first<{ checks_json: string }>();
    expect(JSON.parse(batch!.checks_json).sampleReview).toMatchObject({ expert: 'Dr Test Expert', checked: 10, withProblem: 2 });
    // A sample can also be drawn after the approval: it then covers the bulk-approved questions.
    const after = await create({ seed: 'after-approval' });
    expect(after.json.population).toBe(30);
    await call('POST', `/api/review/sample-reviews/${after.json.id}/cancel`, { reason: 'Test finished with this draw' }, reviewer.auth);
    // Adding a question after the sample was done is noticed.
    await make('Sample question added later: which statement is correct here?', 1, topicA);
    const later = await call('POST', '/api/review/bulk-approval/preview', { scope: { testPaperId: paperId } }, reviewer.auth);
    expect(later.json.sampleReview.questionsChangedSince).toBe(true);
  });
});
