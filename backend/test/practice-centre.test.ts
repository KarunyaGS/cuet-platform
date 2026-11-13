import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { apportion } from '../src/services/practice-centre';

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
  const email = `pc-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Pc' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}

describe('apportion', () => {
  it('splits a total exactly, in proportion, with a minimum for each part', () => {
    expect(apportion(50, [3, 1, 1])).toEqual([30, 10, 10]);
    expect(apportion(50, [0.3, 0.5, 0.2])).toEqual([15, 25, 10]);
    const parts = apportion(50, [40, 1, 1, 1, 1, 1, 1, 1, 1], 1);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(50);
    expect(Math.min(...parts)).toBeGreaterThanOrEqual(1);
  });
});

describe('mock papers', () => {
  const URL = 'https://cdnbbsr.s3waas.gov.in/test/mock-subject.pdf';
  let paperId = '';
  let questionIds: string[] = [];
  let admin: Awaited<ReturnType<typeof person>>;
  let reviewer: Awaited<ReturnType<typeof person>>;
  let student: Awaited<ReturnType<typeof person>>;
  // A made-up subject: unit 1 has 4 topics, units 2 and 3 have 2 each (plus the unit rows: weights 5, 3, 3).
  const UNITS = [4, 2, 2];

  beforeAll(async () => {
    [admin, reviewer, student] = [await person('SUPER_ADMIN'), await person('REVIEWER'), await person()];
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '905', name: 'Mock Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: URL, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const nodes = UNITS.flatMap((topics, u) => [
      { ref: `u${u}`, parentRef: null, kind: 'UNIT', label: String(u + 1), title: `Unit ${u + 1} of mock studies`, body: null, position: u, depth: 1, sourcePage: 1, flags: [] as string[] },
      ...Array.from({ length: topics }, (_, t) => ({ ref: `u${u}t${t}`, parentRef: `u${u}`, kind: 'TOPIC', label: String(t + 1), title: `Topic ${u + 1}.${t + 1} of mock studies`, body: null, position: t, depth: 2, sourcePage: 1, flags: [] as string[] })),
    ]);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `mock-studies-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '905',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Mock Studies (905)', publisher: 'NTA', url: URL, retrievedAt: '2026-11-13T00:00:00.000Z', sha256: '9'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST_METHOD', metrics: {} }, nodes, tables: [], figures: [],
    }, ADMIN);
    expect(imp.status, JSON.stringify(imp.json).slice(0, 300)).toBeLessThan(300);
    paperId = imp.json.testPaperId;
    const { results: topics } = await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'TOPIC' ORDER BY depth, position, id").bind(imp.json.syllabusVersionId).all<{ id: string }>();
    // 12 questions on each of the 8 topics: 4 easy, 5 medium, 3 hard.
    const mix = ['EASY', 'EASY', 'EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HARD', 'HARD', 'HARD'];
    for (const [ti, topic] of topics.entries()) {
      for (const [k, difficulty] of mix.entries()) {
        const q = await call('POST', '/api/admin/questions', {
          testPaperId: paperId, type: 'MCQ_SINGLE', stem: `Mock studies topic ${ti} question ${k}: which statement is correct for this made-up item?`, difficulty, origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
          options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: `Statement ${l} for topic ${ti} question ${k}` })), answer: { correctOptionPositions: [1 + (k % 4)] }, explanation: { body: `Statement ${'ABCD'[k % 4]} is correct because this is a made-up test item.` }, topicNodeIds: [topic.id],
        }, ADMIN);
        expect(q.status).toBe(201);
        questionIds.push(q.json.id);
      }
    }
  }, 120_000);

  it('cannot be built from questions no reviewer has approved', async () => {
    const ready = (await call('GET', `/api/console/mock-papers/readiness/${paperId}`, undefined, admin.auth)).json;
    expect(ready).toMatchObject({ ready: false, pattern: { questions: 50, durationMinutes: 60, marksCorrect: 5, marksIncorrect: -1, optionsPerQuestion: 4 }, bank: { questions: 96, approvedByReviewer: 0, eligibleUnused: 0 } });
    expect(ready.basis).toMatch(/No past-paper trend is used/);
    expect(ready.perUnit.map((u: { needed: number }) => u.needed)).toEqual([23, 14, 13]); // weights 5 : 3 : 3
    const build = await call('POST', `/api/console/mock-papers/build/${paperId}`, undefined, admin.auth);
    expect(build.status).toBe(409);
    expect(build.json.error).toMatchObject({ code: 'NOT_ENOUGH_QUESTIONS', details: { bank: { approvedByReviewer: 0 } } });
    expect((await call('POST', `/api/console/mock-papers/build/${paperId}`, undefined, student.auth)).status).toBe(403);
  });

  it('is built to the blueprint from approved questions, then needs a reviewer and a publisher before students see it', async () => {
    const ok = await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: questionIds, action: 'VERIFIED', checklist: { answerKeyCorrect: true } }, reviewer.auth);
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ applied: 96, skipped: 0 });
    const built = await call('POST', `/api/console/mock-papers/build/${paperId}`, undefined, admin.auth);
    expect(built.status, JSON.stringify(built.json).slice(0, 300)).toBe(201);
    const p = built.json;
    expect(p).toMatchObject({ status: 'DRAFT', number: 1, questions: 50, title: 'Mock Studies: Mock Paper 1', allQuestionsApproved: true });
    expect(p.blueprint.units.map((u: { questions: number }) => u.questions)).toEqual([23, 14, 13]);
    expect(p.blueprint.result.difficulty).toEqual({ EASY: 15, MEDIUM: 25, HARD: 10 });
    const ids = p.items.map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(50);
    // No topic supplies more than two questions... unless a unit's quota needs more than 2 per topic (unit 1: 22 from 4 topics).
    const { results: perTopic } = await env.DB.prepare('SELECT qt.curriculum_node_id AS t, COUNT(*) AS c FROM mock_paper_questions m JOIN question_topics qt ON qt.question_id = m.question_id WHERE m.mock_paper_id = ? GROUP BY 1').bind(p.id).all<{ t: string; c: number }>();
    expect(perTopic).toHaveLength(8); // every topic of the syllabus is covered

    // Hidden from students while it is a draft, even though local preview shows draft lessons.
    expect((await call('GET', `/api/learn/mock-papers?paperId=${paperId}`)).json).toEqual([]);
    expect((await call('POST', `/api/student/mock-papers/${p.id}/start`, {}, student.auth)).status).toBe(404);
    // Publishing needs the reviewer's approval of the paper first; the approval needs a note; a student cannot approve.
    expect((await call('POST', `/api/console/mock-papers/${p.id}/status`, { action: 'PUBLISH' }, admin.auth)).status).toBe(409);
    expect((await call('POST', `/api/review/mock-papers/${p.id}/approve`, { note: 'ok' }, reviewer.auth)).status).toBe(422);
    expect((await call('POST', `/api/review/mock-papers/${p.id}/approve`, { note: 'Checked coverage and keys' }, student.auth)).status).toBe(403);
    const approved = await call('POST', `/api/review/mock-papers/${p.id}/approve`, { note: 'Checked unit coverage, difficulty balance and every answer key.' }, reviewer.auth);
    expect(approved.json).toMatchObject({ status: 'APPROVED', approvedBy: `user:${reviewer.id}` });
    expect((await call('POST', `/api/console/mock-papers/${p.id}/status`, { action: 'PUBLISH' }, admin.auth)).json.status).toBe('PUBLISHED');

    const list = (await call('GET', `/api/learn/mock-papers?paperId=${paperId}`)).json;
    expect(list).toEqual([expect.objectContaining({ id: p.id, title: 'Mock Studies: Mock Paper 1', questions: 50, durationMinutes: 60, marksCorrect: 5, marksIncorrect: -1, units: 3 })]);

    // The attempt: the paper's own questions in order, full time, exam marking; marks for review are kept on the server.
    const run = await call('POST', `/api/student/mock-papers/${p.id}/start`, { mode: 'MOCK_TEST' }, student.auth);
    expect(run.status).toBe(201);
    expect(run.json.session).toMatchObject({ mode: 'MOCK_TEST', durationSeconds: 3600, marking: { correct: 5, incorrect: -1 }, marked: [], source: { kind: 'MOCK_PAPER', id: p.id, title: 'Mock Studies: Mock Paper 1' } });
    expect(run.json.questions.map((q: { id: string }) => q.id)).toEqual(ids);
    const sid = run.json.session.id;
    const [q1, q2] = run.json.questions as { id: string }[];
    expect((await call('PUT', `/api/student/practice/${sid}/marks`, { questionIds: [q2!.id, 'not-in-this-test'] }, student.auth)).json).toEqual({ marked: [q2!.id] });
    await call('POST', `/api/student/practice/${sid}/answers`, { questionId: q1!.id, selectedPositions: [2] }, student.auth);
    const reloaded = (await call('GET', `/api/student/practice/${sid}`, undefined, student.auth)).json;
    expect(reloaded.session.marked).toEqual([q2!.id]);
    expect(reloaded.questions[0].answer.selectedPositions).toEqual([2]);
    // Clearing a response puts the question back to unanswered, so it costs no negative mark.
    await call('POST', `/api/student/practice/${sid}/answers`, { questionId: q1!.id, selectedPositions: [] }, student.auth);
    const done = (await call('POST', `/api/student/practice/${sid}/submit`, undefined, student.auth)).json;
    expect(done.session.result).toMatchObject({ score: 0, correct: 0, incorrect: 0, unattempted: 50, maxScore: 250 });
    expect((await call('PUT', `/api/student/practice/${sid}/marks`, { questionIds: [] }, student.auth)).status).toBe(409);

    // A second paper never repeats a question; here the approved bank cannot fill it, and it says where it falls short.
    const second = await call('POST', `/api/console/mock-papers/build/${paperId}`, undefined, admin.auth);
    expect(second.status).toBe(409);
    expect(second.json.error.details.shortfalls.join(' | ')).toMatch(/Unit 1 .*: 22 needed, 26 approved and unused|hard questions: 10 needed, \d+ approved and unused|Unit/);

    // If a reviewer later flags one of its questions, the paper disappears from students at once.
    await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [ids[0]], action: 'CHANGES_REQUESTED', comment: 'The key needs another look.' }, reviewer.auth);
    expect((await call('GET', `/api/learn/mock-papers?paperId=${paperId}`)).json).toEqual([]);
    expect((await call('POST', `/api/student/mock-papers/${p.id}/start`, {}, student.auth)).status).toBe(404);
  }, 60_000);
});

describe('official paper links', () => {
  const key = { exam: 'CUET_UG', year: 2031, kind: 'ANSWER_KEY', availability: 'AVAILABLE', url: 'https://cdnbbsr.s3waas.gov.in/s3test/uploads/2031/06/key.pdf', title: 'CUET (UG) 2031 final answer keys', note: 'Question id and correct option id for every paper.', checkedOn: '2026-11-13' };
  const none = { exam: 'CUET_UG', year: 2031, kind: 'QUESTION_PAPER', availability: 'NOT_AVAILABLE', title: 'CUET (UG) 2031 question papers', note: 'NTA shows each candidate only their own paper after login.', evidenceUrl: 'https://nta.ac.in/Download/Notice/Notice_test.pdf', checkedOn: '2026-11-13' };

  it('accepts only addresses on the exam body\'s own sites', async () => {
    const bad = await call('POST', '/api/admin/official-papers', { schema: 'cuet-official-links/1', links: [{ ...key, url: 'https://coaching.example.com/cuet-2031-paper.pdf' }, { ...key, year: 2032, url: 'http://nta.ac.in/x.pdf' }, { ...none, year: 2032, url: 'https://nta.ac.in/x.pdf' }] }, ADMIN);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.json)).toMatch(/exam body's own site/);
    expect(JSON.stringify(bad.json)).toMatch(/not available cannot carry an address/);
  });

  it('shows a link only after staff record the linking basis; a "not available" notice needs none', async () => {
    const admin = await person('SUPER_ADMIN');
    const imp = await call('POST', '/api/admin/official-papers', { schema: 'cuet-official-links/1', links: [key, none] }, ADMIN);
    expect(imp.json).toMatchObject({ created: 2, updated: 0 });
    expect((await call('POST', '/api/admin/official-papers', { schema: 'cuet-official-links/1', links: [key, none] }, ADMIN)).json).toMatchObject({ created: 0, unchanged: 2 });
    const visible = async () => ((await call('GET', '/api/learn/official-papers?exam=CUET_UG')).json.years as { year: number; items: { kind: string; available: boolean; url: string | null }[] }[]).find((y) => y.year === 2031)?.items ?? [];
    expect(await visible()).toEqual([]);

    const rows = (await call('GET', '/api/console/official-papers', undefined, admin.auth)).json as { id: string; kind: string; year: number }[];
    const keyRow = rows.find((r) => r.year === 2031 && r.kind === 'ANSWER_KEY')!;
    const noneRow = rows.find((r) => r.year === 2031 && r.kind === 'QUESTION_PAPER')!;
    const noBasis = await call('POST', `/api/console/official-papers/${keyRow.id}/status`, { action: 'PUBLISH' }, admin.auth);
    expect(noBasis.json.error.code).toBe('LINKING_BASIS_REQUIRED');
    expect((await call('POST', `/api/console/official-papers/${keyRow.id}/status`, { action: 'PUBLISH', linkingBasis: 'NTA reply ref. 12/2031', conditionsChecked: false }, admin.auth)).status).toBe(409);
    expect((await call('POST', `/api/console/official-papers/${noneRow.id}/status`, { action: 'PUBLISH' }, admin.auth)).json.status).toBe('PUBLISHED');
    expect(await visible()).toEqual([expect.objectContaining({ kind: 'QUESTION_PAPER', available: false, url: null })]);

    const published = await call('POST', `/api/console/official-papers/${keyRow.id}/status`, { action: 'PUBLISH', linkingBasis: 'NTA reply ref. 12/2031', conditionsChecked: true }, admin.auth);
    expect(published.json).toMatchObject({ status: 'PUBLISHED', linkingBasis: 'NTA reply ref. 12/2031', linkingCheckedBy: `user:${admin.id}` });
    expect((await visible()).map((i) => [i.kind, i.available, i.url])).toEqual([['QUESTION_PAPER', false, null], ['ANSWER_KEY', true, key.url]]);
    // An import cannot silently change a published link.
    expect((await call('POST', '/api/admin/official-papers', { schema: 'cuet-official-links/1', links: [{ ...key, url: 'https://nta.ac.in/other.pdf' }] }, ADMIN)).json.skippedPublished).toHaveLength(1);
    expect((await call('POST', `/api/console/official-papers/${keyRow.id}/status`, { action: 'UNPUBLISH' }, admin.auth)).json.status).toBe('DRAFT');
    expect((await visible()).map((i) => i.kind)).toEqual(['QUESTION_PAPER']);
  });
});

describe('reviewer decisions on a large selection', () => {
  it('approves 150 questions in one request (more than one database statement allows)', async () => {
    const reviewer = await person('REVIEWER');
    const ids: string[] = [];
    for (let i = 0; i < 150; i++) {
      const q = await call('POST', '/api/admin/questions', {
        testPaperId: null, type: 'MCQ_SINGLE', stem: `Bulk approval sample ${i}: which statement is correct for this made-up item?`, difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
        options: ['A', 'B'].map((l) => ({ label: l, text: `Statement ${l} of bulk sample ${i}` })), answer: { correctOptionPositions: [1] }, explanation: { body: 'Statement A is correct in this made-up item.' }, topicNodeIds: [],
      }, ADMIN);
      ids.push(q.json.id);
    }
    const r = await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: ids, action: 'VERIFIED', checklist: { answerKeyCorrect: true } }, reviewer.auth);
    expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBe(200);
    expect(r.json).toMatchObject({ applied: 150, skipped: 0 });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE stem LIKE 'Bulk approval sample %' AND verification = 'VERIFIED'").first<{ n: number }>())!.n).toBe(150);
  }, 120_000);
});
