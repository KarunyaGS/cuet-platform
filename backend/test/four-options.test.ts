import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { auditQuestion, readAssertionReason, readPairs, shapeProblems, type AuditRow } from '../src/services/question-audit';

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
  const email = `four-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Four' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}

const AR = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A).',
  'Both (A) and (R) are true but (R) is not the correct explanation of (A).',
  '(A) is true but (R) is false.',
  '(A) is false but (R) is true.',
];

describe('reading explanations (samples from the real question bank)', () => {
  it('reads match pairings in either style', () => {
    expect(readPairs('So A-III, B-II, C-IV, D-I.')).toEqual({ A: 'III', B: 'II', C: 'IV', D: 'I' });
    expect(readPairs('stable (A-II). The torque is the maximum pE (B-I). Zero but unstable (C-III). pE/2 (D-IV).')).toEqual({ A: 'II', B: 'I', C: 'III', D: 'IV' });
    expect(readPairs('Only A-I and B-II are stated here')).toBeNull();
  });
  it('reads what an assertion-reason explanation says about A and R', () => {
    expect(readAssertionReason('The assertion is true: glass rubbed with silk is positive. The reason is false: protons are bound inside nuclei.')).toBe('TF');
    expect(readAssertionReason('A is false. R is a true statement about electrostatics, but the wires are neutral.')).toBeNull(); // R not stated plainly: no claim
    expect(readAssertionReason('The assertion is true and the reason is true, and the reason does not explain the assertion.')).toBe('TT_NOT_EXPLAINS');
    expect(readAssertionReason('The assertion is true. The reason is true and it explains the assertion.')).toBe('TT_EXPLAINS');
    expect(readAssertionReason('The assertion is false. The reason is true.')).toBe('FT');
  });
});

describe('shape rules', () => {
  const four = ['A', 'B', 'C', 'D'].map((label) => ({ label, text: `Option ${label}` }));
  it('accepts four options A to D with one key, and several keys only for multi-answer', () => {
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four, keys: [3] })).toEqual([]);
    expect(shapeProblems({ type: 'MCQ_MULTI', options: four, keys: [1, 3] })).toEqual([]);
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four, keys: [1, 3] })).toContain('the answer key does not name exactly one correct option');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four, keys: [1, 3] }, { allowMultipleKeys: true })).toEqual([]);
    expect(shapeProblems({ type: 'NUMERICAL', options: [], keys: null })).toEqual([]);
  });
  it('refuses three or five options, wrong labels, wrong order and a key out of range', () => {
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four.slice(0, 3), keys: [1] })).toContain('has 3 options, not four');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: [...four, { label: 'E', text: 'Option E' }], keys: [1] })).toContain('has 5 options, not four');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four.map((o, i) => ({ ...o, label: 'abcd'[i]! })), keys: [1] })).toContain('options are not labelled A, B, C, D in order');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: [four[1]!, four[0]!, four[2]!, four[3]!], keys: [1] })).toContain('options are not labelled A, B, C, D in order');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four, keys: [5] })).toContain('the answer key points to an option that does not exist');
    expect(shapeProblems({ type: 'MCQ_SINGLE', options: four, keys: [] })).toContain('no correct option is given');
  });
});

describe('question audit rules', () => {
  const base = (over: Partial<AuditRow> = {}): AuditRow => ({
    id: 'q1', type: 'MCQ_SINGLE', stem: 'Which of the following is a vector quantity here?', structureJson: null, isDemonstration: false, publicDisplay: 1,
    options: ['A', 'B', 'C', 'D'].map((label, i) => ({ position: i + 1, label, text: `Option ${label}`, mediaAssetId: null })),
    keys: ['[3]'], numericAnswers: [null], explanations: [{ body: 'Option C is the only vector quantity, because it has direction as well as magnitude.', optionRationaleJson: '{"1":"a","2":"b","4":"d"}' }], hasTopic: true, ...over,
  });
  const none = new Set<string>();
  it('passes a consistent question and says which cross-checks it could run', () => {
    expect(auditQuestion(base(), none)).toEqual({ problems: [], crossChecked: ['rationale'] });
  });
  it('catches notes on the wrong options, and an explanation naming a different option than the key', () => {
    expect(auditQuestion(base({ explanations: [{ body: 'Option C is the only vector quantity, because it has direction as well as magnitude.', optionRationaleJson: '{"1":"a","2":"b","3":"c"}' }] }), none).problems).toContain('the explanation has notes on the wrong set of options: they do not match the answer key');
    const r = auditQuestion(base({ explanations: [{ body: 'So option 2 is correct, because it has direction and magnitude.', optionRationaleJson: '{"1":"a","2":"b","4":"d"}' }] }), none);
    expect(r.problems.join('|')).toMatch(/says option 2 is correct, but the answer key says otherwise/);
  });
  it('catches a match key that disagrees with the pairing the explanation states', () => {
    const match = base({
      type: 'MATCH_THE_FOLLOWING',
      options: ['A-I, B-II, C-III, D-IV', 'A-III, B-IV, C-II, D-I', 'A-II, B-III, C-IV, D-I', 'A-III, B-II, C-IV, D-I'].map((text, i) => ({ position: i + 1, label: 'ABCD'[i]!, text, mediaAssetId: null })),
      explanations: [{ body: 'Linear density is per length (III), surface per area (II), volume per volume (IV), dipole moment (I). So A-III, B-II, C-IV, D-I.', optionRationaleJson: '{"1":"a","2":"b","3":"c"}' }],
      keys: ['[4]'],
    });
    expect(auditQuestion(match, none)).toMatchObject({ problems: [], crossChecked: ['rationale', 'match-pairs'] });
    expect(auditQuestion({ ...match, keys: ['[1]'], explanations: [{ ...match.explanations[0]!, optionRationaleJson: '{"2":"b","3":"c","4":"d"}' }] }, none).problems.join('|')).toMatch(/pairs the items differently/);
  });
  it('catches an assertion-reason key that disagrees with what the explanation says', () => {
    const ar = base({
      type: 'ASSERTION_REASON',
      options: AR.map((text, i) => ({ position: i + 1, label: 'ABCD'[i]!, text, mediaAssetId: null })),
      explanations: [{ body: 'The assertion is true: glass rubbed with silk is positive. The reason is false: protons do not move.', optionRationaleJson: '{"1":"a","2":"b","4":"d"}' }],
      keys: ['[3]'],
    });
    expect(auditQuestion(ar, none).problems).toEqual([]);
    expect(auditQuestion({ ...ar, keys: ['[4]'], explanations: [{ ...ar.explanations[0]!, optionRationaleJson: '{"1":"a","2":"b","3":"c"}' }] }, none).problems.join('|')).toMatch(/describes a different assertion-reason option/);
  });
});

describe('four options, end to end', () => {
  const URL = 'https://cdnbbsr.s3waas.gov.in/test/four-subject.pdf';
  let paperId = '';
  let topicId = '';
  let reviewer: Awaited<ReturnType<typeof person>>;
  const body = (over: Record<string, unknown> = {}) => ({
    testPaperId: paperId, type: 'MCQ_SINGLE', stem: `Four options test ${Math.random()}: which statement is correct here?`, difficulty: 'EASY', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false,
    options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: `Statement ${l} ${Math.random()}` })), answer: { correctOptionPositions: [2] },
    explanation: { body: 'Statement B is correct because this is a made-up test item for the four option test.', optionRationale: { '1': 'no', '3': 'no', '4': 'no' } }, topicNodeIds: [topicId], ...over,
  });

  beforeAll(async () => {
    reviewer = await person('REVIEWER');
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '907', name: 'Four Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: URL, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `four-studies-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '907',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Four Studies (907)', publisher: 'NTA', url: URL, retrievedAt: '2026-11-16T00:00:00.000Z', sha256: '7'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST_METHOD', metrics: {} },
      nodes: [
        { ref: 'u0', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit one of four studies', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] },
        { ref: 'u0t0', parentRef: 'u0', kind: 'TOPIC', label: '1', title: 'Topic one of four studies', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
      ],
      tables: [], figures: [],
    }, ADMIN);
    paperId = imp.json.testPaperId;
    topicId = (await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'TOPIC'").bind(imp.json.syllabusVersionId).first<{ id: string }>())!.id;
  }, 60_000);

  it('saves a four-option question and refuses three, five, wrong labels and an out-of-range key', async () => {
    expect((await call('POST', '/api/admin/questions', body(), ADMIN)).status).toBe(201);
    const refuse = async (over: Record<string, unknown>, text: RegExp) => {
      const r = await call('POST', '/api/admin/questions', body(over), ADMIN);
      expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).toMatch(text);
    };
    await refuse({ options: ['A', 'B', 'C'].map((l) => ({ label: l, text: `S ${l}` })) }, /3 options, not four/);
    await refuse({ options: ['A', 'B', 'C', 'D', 'E'].map((l) => ({ label: l, text: `S ${l}` })) }, /Too big|too_big|at most 4|5 options/i);
    await refuse({ options: ['a', 'b', 'c', 'd'].map((l) => ({ label: l, text: `S ${l}` })) }, /labelled A, B, C, D/);
    await refuse({ answer: { correctOptionPositions: [5] } }, /does not exist/);
    await refuse({ answer: { correctOptionPositions: [1, 2] } }, /exactly one correct option/);
  });
  it('still saves numerical and multi-answer questions', async () => {
    expect((await call('POST', '/api/admin/questions', body({ type: 'NUMERICAL', options: [], answer: { numericAnswer: 4.5, numericTolerance: 0.1 } }), ADMIN)).status).toBe(201);
    expect((await call('POST', '/api/admin/questions', body({ type: 'MCQ_MULTI', answer: { correctOptionPositions: [1, 3] } }), ADMIN)).status).toBe(201);
  });
  it('refuses an edit that would leave a question with the wrong number of options', async () => {
    const made = await call('POST', '/api/admin/questions', body(), ADMIN);
    const before = (await call('GET', `/api/admin/questions/${made.json.id}`, undefined, ADMIN)).json;
    const bad = await call('PUT', `/api/admin/questions/${made.json.id}`, body({ options: before.options.slice(0, 3).map((o: { label: string; text: string }) => ({ label: o.label, text: o.text })) }), ADMIN);
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect((await call('GET', `/api/admin/questions/${made.json.id}`, undefined, ADMIN)).json.options).toHaveLength(4);
  });

  it('keeps the database itself to four options: a script cannot add a fifth or mislabel one', async () => {
    const id = (await call('POST', '/api/admin/questions', body(), ADMIN)).json.id as string;
    const insert = (position: number, label: string) =>
      env.DB.prepare("INSERT INTO question_options (id, question_id, position, label, text, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', datetime('now'), datetime('now'))").bind(`opt_t_${position}${label}${Math.random()}`, id, position, label).run();
    await expect(insert(5, 'E')).rejects.toThrow(/four options/);
    await expect(insert(2, 'D')).rejects.toThrow(/four options/);
    await expect(env.DB.prepare("UPDATE question_options SET label = 'E' WHERE question_id = ? AND position = 1").bind(id).run()).rejects.toThrow(/four options/);
    // Editing the text of an option is fine.
    await env.DB.prepare("UPDATE question_options SET text = 'changed' WHERE question_id = ? AND position = 1").bind(id).run();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM question_options WHERE question_id = ?').bind(id).first<{ n: number }>())!.n).toBe(4);
  });

  it('refuses an answer that names a fifth option, and scores a normal one as before', async () => {
    const id = (await call('POST', '/api/admin/questions', body(), ADMIN)).json.id as string;
    expect((await call('POST', `/api/admin/questions/${id}/preview-evaluate`, { selectedPositions: [5] }, ADMIN)).status).toBeGreaterThanOrEqual(400);
    const right = await call('POST', `/api/admin/questions/${id}/preview-evaluate`, { selectedPositions: [2] }, ADMIN);
    expect(right.status).toBe(200);
    expect(JSON.stringify(right.json)).toMatch(/CORRECT/);
  });

  it('audits the bank: finds a bad key, reports the option counts, and the bulk preview leaves it out', async () => {
    const good = (await call('POST', '/api/admin/questions', body(), ADMIN)).json.id as string;
    const bad = (await call('POST', '/api/admin/questions', body({ explanation: { body: 'So option 4 is correct, because this is a made-up item for the audit.', optionRationale: { '1': 'no', '3': 'no', '4': 'no' } } }), ADMIN)).json.id as string;
    const audit = await call('GET', `/api/review/questions/audit?testPaperId=${paperId}`, undefined, reviewer.auth);
    expect(audit.status).toBe(200);
    // Every choice question has four options; the only other count is 0, for the numerical question.
    expect(Object.keys(audit.json.optionCounts).sort()).toEqual(['0', '4']);
    expect(audit.json.failing).toBeGreaterThanOrEqual(1);
    const hit = audit.json.firstFailures.find((f: { id: string }) => f.id === bad);
    expect(hit.problems.join('|')).toMatch(/says option 4 is correct/);
    expect(audit.json.firstFailures.find((f: { id: string }) => f.id === good)).toBeUndefined();
    const prev = (await call('POST', '/api/review/bulk-approval/preview', { scope: { testPaperId: paperId } }, reviewer.auth)).json;
    expect(prev.excluded.map((e: { id: string }) => e.id)).toContain(bad);
    expect(prev.excluded.map((e: { id: string }) => e.id)).not.toContain(good);
    expect((await call('GET', '/api/review/questions/audit', undefined, ADMIN)).status).toBe(401);
  });

  it('reports older questions that predate the rule, without changing them', async () => {
    const id = (await call('POST', '/api/admin/questions', body(), ADMIN)).json.id as string;
    // Simulate legacy data: a fifth option written before the guard existed.
    await env.DB.prepare('DROP TRIGGER question_options_four_options_insert').run();
    try {
      await env.DB.prepare("INSERT INTO question_options (id, question_id, position, label, text, created_at, updated_at) VALUES ('opt_legacy_five', ?, 5, 'E', 'Legacy fifth', datetime('now'), datetime('now'))").bind(id).run();
    } finally {
      await env.DB.prepare(
        `CREATE TRIGGER question_options_four_options_insert BEFORE INSERT ON question_options WHEN NEW.position NOT BETWEEN 1 AND 4 OR NEW.label != substr('ABCD', NEW.position, 1) BEGIN SELECT RAISE(ABORT, 'question_options: a CUET question has four options, positions 1 to 4, labelled A to D'); END`,
      ).run();
    }
    const audit = (await call('GET', `/api/review/questions/audit?testPaperId=${paperId}`, undefined, reviewer.auth)).json;
    expect(audit.optionCounts['5']).toBe(1);
    expect(audit.firstFailures.find((f: { id: string }) => f.id === id).problems).toContain('has 5 options, not four');
    // Reading it still works exactly as before: nothing was rewritten or hidden.
    expect((await call('GET', `/api/admin/questions/${id}`, undefined, ADMIN)).json.options).toHaveLength(5);
  });
});
