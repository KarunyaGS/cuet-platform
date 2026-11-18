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
const URL_PAPER = 'https://cdnbbsr.s3waas.gov.in/test/formats-studies.pdf';
const OPTS = (t: string) => ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: `${t} option ${l}` }));
const base = { origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false } as const;

describe('numerical, multi-select and passage questions, with difficulty, type and chapter filters', () => {
  let paperId = '';
  let unitA = '';
  let unitB = '';
  let otherPaper = '';
  let otherTopic = '';
  let student: Record<string, string>;
  const ids: Record<string, string> = {};

  const mkQuestion = async (key: string, body: Record<string, unknown>) => {
    const r = await call('POST', '/api/admin/questions', { ...base, ...body }, ADMIN);
    expect(r.status, `${key}: ${JSON.stringify(r.json).slice(0, 300)}`).toBe(201);
    ids[key] = r.json.id;
  };
  const seedPaper = async (code: string, name: string, units: string[]) => {
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code, name, categoryCode: 'DOMAIN', officialSyllabusUrl: `${URL_PAPER}?${code}`, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `formats-${code}-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: code,
      source: { kind: 'OFFICIAL_SYLLABUS', title: `${name} (${code})`, publisher: 'NTA', url: `${URL_PAPER}?${code}`, retrievedAt: '2026-11-18T00:00:00.000Z', sha256: code.repeat(22).slice(0, 64).padEnd(64, '7'), byteSize: 10, mimeType: 'application/pdf', pageCount: 1 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST', metrics: {} },
      nodes: units.map((u, i) => ({ ref: `u${i}`, parentRef: null, kind: 'UNIT', label: String(i + 1), title: u, body: null, position: i, depth: 1, sourcePage: 1, flags: [] as string[] })),
      tables: [], figures: [],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    const nodes = await env.DB.prepare("SELECT id, title FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'UNIT' ORDER BY position").bind(imp.json.syllabusVersionId).all<{ id: string; title: string }>();
    return { paper: imp.json.testPaperId as string, nodes: nodes.results.map((n) => n.id) };
  };

  it('sets up a subject with two chapters and every question format', async () => {
    const main = await seedPaper('907', 'Formats Studies', ['Unit A Counting', 'Unit B Reading']);
    paperId = main.paper;
    [unitA, unitB] = main.nodes as [string, string];
    const other = await seedPaper('908', 'Other Studies', ['Unit Z']);
    otherPaper = other.paper;
    otherTopic = other.nodes[0]!;

    await mkQuestion('num1', { testPaperId: paperId, type: 'NUMERICAL', stem: 'A 2.0 kg trolley moves at 3.0 m/s. What is its kinetic energy in joule?', difficulty: 'MEDIUM', options: [], answer: { numericAnswer: 9, numericTolerance: 0.05 }, explanation: { body: 'Kinetic energy is half m v squared, which is 0.5 x 2.0 x 9.0 = 9.0 J.' }, topicNodeIds: [unitA] });
    await mkQuestion('num2', { testPaperId: paperId, type: 'NUMERICAL', stem: 'How many whole numbers lie between 3.5 and 9.5?', difficulty: 'EASY', options: [], answer: { numericAnswer: 6 }, explanation: { body: 'The whole numbers 4, 5, 6, 7, 8 and 9 lie between them, so there are 6.' }, topicNodeIds: [unitA] });
    await mkQuestion('multi1', { testPaperId: paperId, type: 'MCQ_MULTI', stem: 'Which of the following numbers are prime? Select all that apply.', difficulty: 'HARD', options: [{ label: 'A', text: '7' }, { label: 'B', text: '9' }, { label: 'C', text: '11' }, { label: 'D', text: '15' }], answer: { correctOptionPositions: [1, 3] }, explanation: { body: '7 and 11 have no divisors other than 1 and themselves; 9 and 15 are divisible by 3.' }, topicNodeIds: [unitA] });
    await mkQuestion('single1', { testPaperId: paperId, type: 'MCQ_SINGLE', stem: 'Which one of these is an even number?', difficulty: 'EASY', options: [{ label: 'A', text: '3' }, { label: 'B', text: '5' }, { label: 'C', text: '8' }, { label: 'D', text: '9' }], answer: { correctOptionPositions: [3] }, explanation: { body: 'Only 8 is divisible by 2, so it is the even number.' }, topicNodeIds: [unitB] });

    const passage = await call('POST', '/api/admin/passages', { title: 'The village well', body: 'The village well was dug long ago by the first families who settled by the river. Every morning the women carried water home in clay pots, and the well never ran dry even in the hottest summers. When the new pipeline arrived, the well was almost forgotten, yet the elders still insisted that its water tasted sweeter.', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned' }, ADMIN);
    expect(passage.status).toBe(201);
    expect(passage.json.outcome).toBe('CREATED');
    const again = await call('POST', '/api/admin/passages', { title: 'The village well', body: 'The village well was dug long ago by the first families who settled by the river. Every morning the women carried water home in clay pots, and the well never ran dry even in the hottest summers. When the new pipeline arrived, the well was almost forgotten, yet the elders still insisted that its water tasted sweeter.', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned' }, ADMIN);
    expect(again.json).toMatchObject({ id: passage.json.id, outcome: 'UNCHANGED' });
    await mkQuestion('pas1', { testPaperId: paperId, type: 'PASSAGE_BASED', passageId: passage.json.id, stem: 'According to the passage, why was the well almost forgotten?', difficulty: 'EASY', options: [{ label: 'A', text: 'It ran dry in summer' }, { label: 'B', text: 'A new pipeline arrived' }, { label: 'C', text: 'The river moved away' }, { label: 'D', text: 'The families left the village' }], answer: { correctOptionPositions: [2] }, explanation: { body: 'The passage says the well was almost forgotten when the new pipeline arrived.' }, topicNodeIds: [unitB] });
    await mkQuestion('pas2', { testPaperId: paperId, type: 'PASSAGE_BASED', passageId: passage.json.id, stem: 'What did the elders believe about the well water?', difficulty: 'MEDIUM', options: [{ label: 'A', text: 'It was unsafe to drink' }, { label: 'B', text: 'It tasted sweeter' }, { label: 'C', text: 'It was colder in summer' }, { label: 'D', text: 'It was meant only for the women' }], answer: { correctOptionPositions: [2] }, explanation: { body: 'The elders insisted that the water of the old well tasted sweeter.' }, topicNodeIds: [unitB] });
    await mkQuestion('otherq', { testPaperId: otherPaper, type: 'MCQ_SINGLE', stem: 'Which of these is a primary colour of light?', difficulty: 'EASY', options: OPTS('colour'), answer: { correctOptionPositions: [1] }, explanation: { body: 'Red is one of the three primary colours of light.' }, topicNodeIds: [otherTopic] });

    await call('POST', '/api/auth/register', { email: 'formats@example.test', password: 'correct horse battery', displayName: 'Formats Student' });
    const login = await call('POST', '/api/auth/login', { email: 'formats@example.test', password: 'correct horse battery' });
    student = { ...JSON_H, cookie: login.cookie!.split(';')[0]! };
  });

  it('numerical answers: accepted within the tolerance, wrong outside it, blank is unanswered, text is refused', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, types: ['NUMERICAL'] }, student);
    expect(s.status).toBe(201);
    expect(s.json.questions.map((q: { type: string }) => q.type)).toEqual(['NUMERICAL', 'NUMERICAL'].slice(0, s.json.questions.length));
    expect(s.json.questions).toHaveLength(2);
    expect(s.json.questions.every((q: { options: unknown[] }) => q.options.length === 0)).toBe(true);
    const sid = s.json.session.id as string;
    const energy = ids['num1']!;
    const whole = ids['num2']!;
    const close = await call('POST', `/api/student/practice/${sid}/answers`, { questionId: energy, numericAnswer: 9.04 }, student);
    expect(close.json).toMatchObject({ outcome: 'CORRECT', correctNumericAnswer: 9 });
    expect(close.json.explanation).toMatch(/Kinetic energy/);
    const far = await call('POST', `/api/student/practice/${sid}/answers`, { questionId: whole, numericAnswer: 7 }, student);
    expect(far.json).toMatchObject({ outcome: 'INCORRECT', correctNumericAnswer: 6 });
    const edge = await call('POST', `/api/student/practice/${sid}/answers`, { questionId: energy, numericAnswer: 9.2 }, student);
    expect(edge.json.outcome).toBe('INCORRECT');
    const blank = await call('POST', `/api/student/practice/${sid}/answers`, { questionId: whole, numericAnswer: null }, student);
    expect(blank.json.outcome).toBe('UNATTEMPTED');
    expect((await call('POST', `/api/student/practice/${sid}/answers`, { questionId: whole, numericAnswer: 'six' }, student)).status).toBe(400);
    // Submitting keeps the numeric answers and reports them in the review.
    await call('POST', `/api/student/practice/${sid}/answers`, { questionId: energy, numericAnswer: 9 }, student);
    const done = await call('POST', `/api/student/practice/${sid}/submit`, undefined, student);
    expect(done.json.session.result).toMatchObject({ correct: 1, unattempted: 1 });
    const review = done.json.questions.find((q: { id: string }) => q.id === energy);
    expect(review.answer.numericAnswer).toBe(9);
    expect(review.review).toMatchObject({ outcome: 'CORRECT', correctNumericAnswer: 9 });
  });

  it('multi-select: the full correct set earns the mark; a partial or extra choice does not', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, types: ['MCQ_MULTI'] }, student);
    expect(s.json.questions).toHaveLength(1);
    expect(s.json.questions[0].type).toBe('MCQ_MULTI');
    const sid = s.json.session.id as string;
    const q = ids['multi1']!;
    const ans = (selectedPositions: number[]) => call('POST', `/api/student/practice/${sid}/answers`, { questionId: q, selectedPositions }, student);
    expect((await ans([1])).json.outcome).toBe('INCORRECT');
    expect((await ans([1, 3, 2])).json.outcome).toBe('INCORRECT');
    const ok = await ans([3, 1]);
    expect(ok.json).toMatchObject({ outcome: 'CORRECT', correctOptionPositions: [1, 3] });
  });

  it('passage-based questions carry their passage, which is shared by the questions on it', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, types: ['PASSAGE_BASED'] }, student);
    expect(s.json.questions).toHaveLength(2);
    for (const q of s.json.questions) {
      expect(q.type).toBe('PASSAGE_BASED');
      expect(q.passage).toMatchObject({ title: 'The village well' });
      expect(q.passage.body).toMatch(/new pipeline arrived/);
      expect(q.options).toHaveLength(4);
    }
    const sid = s.json.session.id as string;
    const first = s.json.questions.find((q: { id: string }) => q.id === ids['pas1']);
    const res = await call('POST', `/api/student/practice/${sid}/answers`, { questionId: first.id, selectedPositions: [2] }, student);
    expect(res.json.outcome).toBe('CORRECT');
    const done = await call('POST', `/api/student/practice/${sid}/submit`, undefined, student);
    expect(done.json.questions[0].passage.body).toMatch(/village well/);
  });

  it('difficulty and question-type filters narrow a practice set, and say so when nothing matches', async () => {
    const hard = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, difficulty: ['HARD'] }, student);
    expect(hard.json.questions.map((q: { id: string }) => q.id)).toEqual([ids['multi1']]);
    const easy = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, difficulty: ['EASY'], count: 90 }, student);
    expect(easy.json.questions.every((q: { difficulty: string }) => q.difficulty === 'EASY')).toBe(true);
    expect(easy.json.questions).toHaveLength(3);
    const both = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, difficulty: ['EASY', 'MEDIUM'], types: ['NUMERICAL', 'PASSAGE_BASED'], count: 90 }, student);
    expect(both.json.questions.map((q: { id: string }) => q.id).sort()).toEqual([ids['num1'], ids['num2'], ids['pas1'], ids['pas2']].sort());
    const none = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, difficulty: ['HARD'], types: ['NUMERICAL'] }, student);
    expect(none.status).toBe(404);
    expect(none.json.error.code).toBe('NO_QUESTIONS');
    expect(none.json.error.message).toMatch(/No questions match these filters/);
    expect((await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, difficulty: ['IMPOSSIBLE'] }, student)).status).toBe(400);
    expect((await call('POST', '/api/student/practice', { mode: 'MOCK_TEST', paperId, difficulty: ['EASY'] }, student)).status).toBe(400);
  });

  it('chapter filters: one chapter, several chapters, and never chapters of two subjects', async () => {
    const a = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [unitA], count: 90 }, student);
    expect(a.json.questions.map((q: { id: string }) => q.id).sort()).toEqual([ids['num1'], ids['num2'], ids['multi1']].sort());
    const b = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [unitB], count: 90 }, student);
    expect(b.json.questions).toHaveLength(3);
    const ab = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [unitA, unitB], count: 90 }, student);
    expect(ab.json.questions).toHaveLength(6);
    const filtered = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [unitA, unitB], types: ['MCQ_SINGLE', 'MCQ_MULTI'], count: 90 }, student);
    expect(filtered.json.questions.map((q: { id: string }) => q.id).sort()).toEqual([ids['multi1'], ids['single1']].sort());
    const crossed = await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [unitA, otherTopic] }, student);
    expect(crossed.status).toBe(422);
    expect((await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: ['cn_missing'] }, student)).status).toBe(404);
  });

  it('reports how many questions match, by difficulty and type, before a student starts', async () => {
    const all = await call('GET', `/api/learn/question-counts?paperId=${paperId}`, undefined, student);
    expect(all.json).toMatchObject({ total: 6, matching: 6, byDifficulty: { EASY: 3, MEDIUM: 2, HARD: 1 }, byType: { NUMERICAL: 2, MCQ_MULTI: 1, MCQ_SINGLE: 1, PASSAGE_BASED: 2 } });
    const narrowed = await call('GET', `/api/learn/question-counts?nodeIds=${unitA},${unitB}&difficulty=EASY&types=NUMERICAL,PASSAGE_BASED`, undefined, student);
    expect(narrowed.json).toMatchObject({ total: 6, matching: 2 });
    expect((await call('GET', '/api/learn/question-counts', undefined, student)).status).toBe(422);
  });
  it('a finished test reports how it went by unit and by difficulty, and how long it took', async () => {
    const s = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId, count: 90 }, student);
    const sid = s.json.session.id as string;
    const answer = (key: string, body: Record<string, unknown>) => call('POST', `/api/student/practice/${sid}/answers`, { questionId: ids[key], ...body }, student);
    await answer('num1', { numericAnswer: 9 });        // unit A, medium, correct
    await answer('num2', { numericAnswer: 99 });       // unit A, easy, wrong
    await answer('single1', { selectedPositions: [3] }); // unit B, easy, correct
    await answer('pas1', { selectedPositions: [1] });  // unit B, easy, wrong
    const done = await call('POST', `/api/student/practice/${sid}/submit`, undefined, student);
    const a = done.json.session.analysis;
    expect(a.timeTakenSeconds).toBeGreaterThanOrEqual(0);
    const unit = (title: string) => a.byUnit.find((u: { title: string }) => u.title === title);
    expect(unit('Unit A Counting')).toMatchObject({ correct: 1, incorrect: 1, unattempted: 1, accuracy: 50 });
    expect(unit('Unit B Reading')).toMatchObject({ correct: 1, incorrect: 1, unattempted: 1, accuracy: 50 });
    const level = (d: string) => a.byDifficulty.find((x: { difficulty: string }) => x.difficulty === d);
    expect(level('EASY')).toMatchObject({ correct: 1, incorrect: 2, unattempted: 0 });
    expect(level('MEDIUM')).toMatchObject({ correct: 1, incorrect: 0, unattempted: 1 });
    expect(level('HARD')).toMatchObject({ correct: 0, incorrect: 0, unattempted: 1, accuracy: null });
    const totals = a.byUnit.reduce((n: number, u: { correct: number; incorrect: number; unattempted: number }) => n + u.correct + u.incorrect + u.unattempted, 0);
    expect(totals).toBe(6);
    // A session that is still running has no analysis yet.
    const open = await call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId }, student);
    expect(open.json.session.analysis).toBeNull();
  });
});
