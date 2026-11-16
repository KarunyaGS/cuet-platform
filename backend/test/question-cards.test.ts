import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };
const TODAY = new Date().toISOString().slice(0, 10);

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}
async function signIn(email: string) {
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: 'Card Student' });
  const res = await call('POST', '/api/auth/login', { email, password: 'correct horse battery' });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

describe('revision cards from attempted practice questions', () => {
  const URL = 'https://cdnbbsr.s3waas.gov.in/test/qcards-subject.pdf';
  let paperId = '';
  let topicId = '';
  let unitId = '';
  let qIds: string[] = [];
  let alice: Record<string, string>;
  let bob: Record<string, string>;
  const cards = async (h: Record<string, string>, q = '') => (await call('GET', `/api/student/flashcards?day=${TODAY}${q}`, undefined, h)).json as Array<Record<string, any>>;
  const makeCard = (h: Record<string, string>, questionId: string) => call('POST', '/api/student/flashcards/questions', { questionId, day: TODAY }, h);
  const answer = (h: Record<string, string>, sessionId: string, questionId: string, selectedPositions: number[]) => call('POST', `/api/student/practice/${sessionId}/answers`, { questionId, selectedPositions }, h);

  beforeAll(async () => {
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '908', name: 'Card Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: URL, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `qcards-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '908',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Card Studies (908)', publisher: 'NTA', url: URL, retrievedAt: '2026-11-16T00:00:00.000Z', sha256: '6'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
      nodes: [
        { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit of card studies', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] },
        { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: 'Topic of card studies', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
      ],
      tables: [], figures: [],
    }, ADMIN);
    paperId = imp.json.testPaperId;
    topicId = (await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'SUBTOPIC'").bind(imp.json.syllabusVersionId).first<{ id: string }>())!.id;
    unitId = (await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'UNIT'").bind(imp.json.syllabusVersionId).first<{ id: string }>())!.id;
    for (let i = 1; i <= 4; i++) {
      const q = await call('POST', '/api/admin/questions', {
        testPaperId: paperId, type: 'MCQ_SINGLE', stem: `(cards) Sample ${i}: the force between two point charges follows which law?`, difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
        options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
        answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law gives the force between two point charges.", optionRationale: { '1': 'Ohm: current.', '3': 'Hooke: springs.', '4': 'Snell: light.' } }, topicNodeIds: [topicId],
      }, ADMIN);
      expect(q.status).toBe(201);
      qIds.push(q.json.id);
    }
    [alice, bob] = [await signIn('alice-cards@example.test'), await signIn('bob-cards@example.test')];
  }, 60_000);

  it('needs an attempt first: nothing is saved, and the answer is not given out, for a question not yet answered', async () => {
    const r = await makeCard(alice, qIds[0]!);
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('NOT_ATTEMPTED');
    expect(JSON.stringify(r.json)).not.toMatch(/Coulomb's law gives/);
    expect(await cards(alice)).toEqual([]);
    expect((await call('POST', '/api/student/flashcards/questions', { questionId: 'q_missing', day: TODAY }, alice)).status).toBe(404);
  });

  it('after answering in practice, saves one card that points at the question and copies nothing', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: topicId }, alice);
    const q = s.json.questions.find((x: { id: string }) => x.id === qIds[0]) ?? s.json.questions[0];
    const qid = q.id as string;
    expect((await answer(alice, s.json.session.id, qid, [1])).json).toMatchObject({ outcome: 'INCORRECT', correctOptionPositions: [2] });
    const made = await makeCard(alice, qid);
    expect(made.status).toBe(201);
    expect(made.json.created).toBe(true);
    const card = made.json.card;
    expect(card).toMatchObject({ kind: 'QUESTION', questionId: qid, status: 'NEW', due: true, paperId, stage: 'NEW' });
    // Front: the question and its four options. Back: the answer, the explanation, and what the student answered.
    expect(card.question.options.map((o: { label: string }) => o.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(card.question).toMatchObject({ correctOptionPositions: [2], explanation: "Coulomb's law gives the force between two point charges.", yourAnswer: { selectedPositions: [1], outcome: 'INCORRECT' } });
    expect(card.question.optionRationale).toMatchObject({ '1': 'Ohm: current.' });
    expect(card.front).toBe(card.question.stem);
    // Nothing of the question is stored on the card.
    const row = await env.DB.prepare('SELECT question_id, front, back, latex FROM flashcards WHERE id = ?').bind(card.id).first<Record<string, string | null>>();
    expect(row).toEqual({ question_id: qid, front: '', back: '', latex: null });
    // Same grouping as lesson cards, so it shows in My bookmarks by subject and chapter.
    expect(card.chapterId).toBe(unitId);
    expect(card.topicId).toBe(topicId);
  });

  it('never makes a second card for the same question, however it is asked', async () => {
    const qid = (await env.DB.prepare('SELECT question_id AS q FROM flashcards WHERE user_id = (SELECT id FROM users WHERE email = ?)').bind('alice-cards@example.test').first<{ q: string }>())!.q;
    const again = await makeCard(alice, qid);
    expect(again.status).toBe(200);
    expect(again.json.created).toBe(false);
    const both = await Promise.all([makeCard(alice, qid), makeCard(alice, qid), makeCard(alice, qid)]);
    expect(both.every((r) => r.status === 200 && r.json.created === false)).toBe(true);
    expect((await cards(alice)).filter((c) => c.kind === 'QUESTION')).toHaveLength(1);
    // Answering the same question again in another session also leaves one card, and the card shows the newest answer.
    const s2 = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: topicId }, alice);
    expect((await answer(alice, s2.json.session.id, qid, [2])).json).toMatchObject({ outcome: 'CORRECT' });
    const list = (await cards(alice)).filter((c) => c.kind === 'QUESTION');
    expect(list).toHaveLength(1);
    expect(list[0]!.question.yourAnswer).toMatchObject({ selectedPositions: [2], outcome: 'CORRECT' });
    expect(await call('POST', '/api/student/flashcards/questions/state', { ids: [qid, qIds[3]] }, alice).then((r) => r.json)).toEqual([{ questionId: qid, id: list[0]!.id, reviewed: false }]);
  });

  it('is one student\'s own: another student has not attempted it, and cannot see or review it', async () => {
    const mine = (await cards(alice))[0]!;
    expect((await makeCard(bob, mine.questionId)).status).toBe(409);
    expect(await cards(bob)).toEqual([]);
    expect((await call('POST', `/api/student/flashcards/${mine.id}/review`, { rating: 'GOOD', day: TODAY }, bob)).status).toBe(404);
    expect((await call('DELETE', `/api/student/flashcards/${mine.id}`, undefined, bob)).status).toBe(404);
  });

  it('does not count an answer whose result has not been shown: a running timed test, or a cleared answer', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', nodeId: topicId, count: 4 }, bob);
    const qid = s.json.questions[1].id as string;
    await answer(bob, s.json.session.id, qid, [2]);
    const early = await makeCard(bob, qid);
    expect(early.status).toBe(409);
    expect(early.json.error.code).toBe('NOT_ATTEMPTED');
    // A cleared answer is saved as an empty selection: not an attempt.
    await answer(bob, s.json.session.id, qid, []);
    expect((await makeCard(bob, qid)).status).toBe(409);
    await answer(bob, s.json.session.id, qid, [3]);
    // The key is shown only after the test is submitted. From then the question can be saved.
    await call('POST', `/api/student/practice/${s.json.session.id}/submit`, {}, bob);
    const after = await makeCard(bob, qid);
    expect(after.status).toBe(201);
    expect(after.json.card.question.yourAnswer).toMatchObject({ selectedPositions: [3], outcome: 'INCORRECT' });
  });

  it('is revised like any other card: Know and Need revision move the schedule, and it is counted with the rest', async () => {
    const card = (await cards(alice)).find((c) => c.kind === 'QUESTION')!;
    expect(card.due).toBe(true);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, alice)).json).toMatchObject({ due: 1, cards: [{ id: card.id, kind: 'QUESTION' }] });
    const summary = (await call('GET', `/api/student/flashcards/summary?day=${TODAY}`, undefined, alice)).json;
    expect(summary).toMatchObject({ total: 1, due: 1, fresh: 1 });
    expect(summary.subjects[0]).toMatchObject({ paperId, total: 1, chapters: [{ chapterId: unitId, total: 1 }] });
    expect((await call('GET', `/api/student/dashboard?day=${TODAY}&since=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`, undefined, alice)).json.flashcards).toEqual({ total: 1, due: 1 });
    const need = await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'AGAIN', day: TODAY }, alice);
    expect(need.json).toMatchObject({ status: 'NEED_REVISION', lapses: 1 });
    expect(need.json.question.correctOptionPositions).toEqual([2]);
    expect(need.json.dueOn > TODAY).toBe(true);
    // Not due again today, so a second tap is refused rather than counted twice.
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, alice)).status).toBe(409);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, alice)).json.due).toBe(0);
    // Filters used by My bookmarks find it by subject, chapter and topic.
    expect(await cards(alice, `&paperId=${paperId}&chapterId=${unitId}`)).toHaveLength(1);
    expect(await cards(alice, `&nodeId=${topicId}`)).toHaveLength(1);
    // Marking a question card early (from the list) works the same as for lesson cards.
    const know = await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY, early: true }, alice);
    expect(know.json).toMatchObject({ status: 'KNOW' });
  });

  it('shows the question as it stands now: a corrected question is corrected on every card, with no stale copy', async () => {
    const card = (await cards(alice))[0]!;
    const edited = await call('PUT', `/api/admin/questions/${card.questionId}`, {
      testPaperId: paperId, type: 'MCQ_SINGLE', stem: '(cards) Reworded: which law gives the force between two point charges?', difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
      answer: { correctOptionPositions: [2] }, explanation: { body: 'Corrected explanation: the inverse-square law of Coulomb.' }, topicNodeIds: [topicId],
    }, ADMIN);
    expect(edited.status, JSON.stringify(edited.json).slice(0, 300)).toBe(200);
    const now = (await cards(alice))[0]!;
    expect(now.id).toBe(card.id);
    expect(now.question.stem).toMatch(/Reworded/);
    expect(now.question.explanation).toMatch(/Corrected explanation/);
    expect(now.front).toBe(now.question.stem);
    expect((await env.DB.prepare('SELECT front, back FROM flashcards WHERE id = ?').bind(card.id).first())).toEqual({ front: '', back: '' });
  });

  it('hides a card while its question is withdrawn, and brings it back when the question is available again', async () => {
    const card = (await cards(alice))[0]!;
    await env.DB.prepare("UPDATE questions SET verification = 'NEEDS_CHANGES' WHERE id = ?").bind(card.questionId).run();
    expect(await cards(alice)).toEqual([]);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, alice)).json).toMatchObject({ due: 0, cards: [] });
    expect((await call('GET', `/api/student/flashcards/summary?day=${TODAY}`, undefined, alice)).json.total).toBe(0);
    expect((await call('GET', `/api/student/dashboard?day=${TODAY}&since=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`, undefined, alice)).json.flashcards).toEqual({ total: 0, due: 0 });
    await env.DB.prepare("UPDATE questions SET verification = 'UNVERIFIED' WHERE id = ?").bind(card.questionId).run();
    expect(await cards(alice)).toHaveLength(1);
  });

  it('removes only the card: the question, the answer record and the student\'s other cards stay', async () => {
    const card = (await cards(alice))[0]!;
    // It has been revised, so removing it needs a confirmation (the same rule as lesson cards).
    const refused = await call('DELETE', `/api/student/flashcards/${card.id}`, undefined, alice);
    expect(refused.status).toBe(409);
    expect((await call('DELETE', `/api/student/flashcards/${card.id}?confirm=1`, undefined, alice)).json).toMatchObject({ deleted: true });
    expect(await cards(alice)).toEqual([]);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM questions WHERE id = ?').bind(card.questionId).first<{ n: number }>())!.n).toBe(1);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM practice_answers WHERE question_id = ?').bind(card.questionId).first<{ n: number }>())!.n).toBeGreaterThan(0);
    // It can be saved again, as a fresh card.
    expect((await makeCard(alice, card.questionId)).json.created).toBe(true);
  });

  it('keeps lesson cards exactly as they were: topic counts are about lesson concepts only', async () => {
    const topic = (await call('GET', `/api/student/flashcards/topic/${topicId}?day=${TODAY}`, undefined, alice)).json;
    expect(topic).toMatchObject({ concepts: 0, cards: 0 });
  });
});
