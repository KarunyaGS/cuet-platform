import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';

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
  const email = `bulk-${++n}-${Date.now()}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Bulk Tester' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}

describe('bulk management approval of questions', () => {
  const URL = 'https://cdnbbsr.s3waas.gov.in/test/bulk-subject.pdf';
  let paperId = '';
  let topicId = '';
  let good: string[] = [];
  let noExplanation = '';
  let threeOptions = '';
  let twinA = '';
  let reviewer: Awaited<ReturnType<typeof person>>;
  let student: Awaited<ReturnType<typeof person>>;
  const scope = () => ({ testPaperId: paperId });
  const make = async (stem: string, k: number, optionText?: (l: string) => string) => {
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: paperId, type: 'MCQ_SINGLE', stem, difficulty: 'EASY', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: optionText ? optionText(l) : `Statement ${l} for ${stem}` })),
      answer: { correctOptionPositions: [1 + (k % 4)] },
      explanation: { body: `Statement ${'ABCD'[k % 4]} is correct because this is a made-up test item for the bulk approval test.` },
      topicNodeIds: [topicId],
    }, ADMIN);
    expect(q.status, JSON.stringify(q.json).slice(0, 200)).toBe(201);
    return q.json.id as string;
  };
  const row = (id: string) => env.DB.prepare('SELECT status, verification FROM questions WHERE id = ?').bind(id).first<{ status: string; verification: string }>();

  beforeAll(async () => {
    [reviewer, student] = [await person('REVIEWER'), await person()];
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '906', name: 'Bulk Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: URL, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `bulk-studies-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '906',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Bulk Studies (906)', publisher: 'NTA', url: URL, retrievedAt: '2026-11-16T00:00:00.000Z', sha256: '8'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST_METHOD', metrics: {} },
      nodes: [
        { ref: 'u0', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit one of bulk studies', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] },
        { ref: 'u0t0', parentRef: 'u0', kind: 'TOPIC', label: '1', title: 'Topic one of bulk studies', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
      ],
      tables: [], figures: [],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    paperId = imp.json.testPaperId;
    topicId = (await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'TOPIC'").bind(imp.json.syllabusVersionId).first<{ id: string }>())!.id;
    for (let i = 0; i < 8; i++) good.push(await make(`Bulk question number ${i}: which statement is correct here?`, i));
    // Two questions with the same text but different options: allowed, but a person should look.
    twinA = await make('Bulk twin: match each quantity with its unit?', 0);
    good.push(twinA, await make('Bulk twin: match each quantity with its unit?', 1, (l) => `Different ${l} option`));
    // Faulty ones, made by damaging good questions directly.
    noExplanation = await make('Bulk faulty one without explanation, which is correct?', 2);
    await env.DB.prepare('DELETE FROM explanations WHERE question_id = ?').bind(noExplanation).run();
    threeOptions = await make('Bulk faulty one with only three options, which is correct?', 3);
    await env.DB.prepare('DELETE FROM question_options WHERE question_id = ? AND position = 4').bind(threeOptions).run();
  }, 120_000);

  it('can only be opened by a signed-in reviewer, never by the admin token or a student', async () => {
    expect((await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, ADMIN)).status).toBe(401);
    expect((await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, student.auth)).status).toBe(403);
    expect((await call('POST', '/api/review/bulk-approval/preview', { scope: scope() })).status).toBe(401);
  });

  it('previews who is covered, who is left out and why, and what was NOT checked, without changing anything', async () => {
    const r = await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, reviewer.auth);
    expect(r.status).toBe(200);
    expect(r.json.eligibleCount).toBe(10);
    expect(r.json.phraseToType).toBe('APPROVE 10');
    expect(r.json.statement).toMatch(/not an individual review/);
    expect(r.json.notChecked.join(' ')).toMatch(/scientifically correct/);
    expect(r.json.excluded.map((e: { id: string }) => e.id).sort()).toEqual([noExplanation, threeOptions].sort());
    expect(JSON.stringify(r.json.excluded)).toMatch(/explanation is missing/);
    expect(JSON.stringify(r.json.excluded)).toMatch(/3 options, not four/);
    expect(r.json.needsAPersonsEyes).toHaveLength(1);
    expect(r.json.needsAPersonsEyes[0].ids).toHaveLength(2);
    expect(r.json.ids).toBeUndefined();
    for (const id of good) expect((await row(id))!.verification).toBe('UNVERIFIED');
  });

  it('refuses without the exact confirmation, and when the list changed since it was shown', async () => {
    const p = (await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, reviewer.auth)).json;
    const body = { scope: scope(), snapshotHash: p.snapshotHash, typed: p.phraseToType, statement: p.statement };
    expect((await call('POST', '/api/review/bulk-approval/confirm', { ...body, typed: 'approve 10' }, reviewer.auth)).status).toBe(422);
    expect((await call('POST', '/api/review/bulk-approval/confirm', { ...body, statement: 'ok' }, reviewer.auth)).status).toBe(422);
    expect((await call('POST', '/api/review/bulk-approval/confirm', body, ADMIN)).status).toBe(401);
    expect((await call('POST', '/api/review/bulk-approval/confirm', body, student.auth)).status).toBe(403);
    // Someone breaks a question after the approver looked at the list.
    const victim = good[0]!;
    await env.DB.prepare('DELETE FROM explanations WHERE question_id = ?').bind(victim).run();
    const stale = await call('POST', '/api/review/bulk-approval/confirm', body, reviewer.auth);
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe('LIST_CHANGED');
    for (const id of good) expect((await row(id))!.verification).toBe('UNVERIFIED');
    // Put it back so the next test starts clean.
    await env.DB.prepare("INSERT INTO explanations (id, question_id, language, body, status, verification, created_at, updated_at) VALUES (?, ?, 'en', ?, 'DRAFT', 'UNVERIFIED', datetime('now'), datetime('now'))").bind(`exp_restore_${victim}`, victim, 'Statement A is correct because this is a restored made-up test item.').run();
  });

  it('approves as a bulk decision: recorded with approver, date, scope and method, and never as individual review', async () => {
    const p = (await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, reviewer.auth)).json;
    expect(p.eligibleCount).toBe(10);
    const done = await call('POST', '/api/review/bulk-approval/confirm', { scope: scope(), snapshotHash: p.snapshotHash, typed: p.phraseToType, statement: p.statement }, reviewer.auth);
    expect(done.status, JSON.stringify(done.json)).toBe(201);
    expect(done.json).toMatchObject({ requested: 10, applied: 10, skippedBecauseChanged: 0, method: 'BULK_MANAGEMENT_APPROVAL_AFTER_AUTOMATED_FORMAT_CHECKS_v1' });
    for (const id of good) expect((await row(id))!.verification).toBe('VERIFIED');
    expect((await row(noExplanation))!.verification).toBe('UNVERIFIED');
    expect((await row(threeOptions))!.verification).toBe('UNVERIFIED');

    const batch = await env.DB.prepare('SELECT * FROM bulk_approval_batches WHERE id = ?').bind(done.json.batchId).first<Record<string, string | number>>();
    expect(batch).toMatchObject({ approver_id: reviewer.id, approver_name: 'Bulk Tester', question_count: 10, status: 'ACTIVE' });
    expect(String(batch!['approver_roles'])).toMatch(/review/i);
    expect(String(batch!['statement'])).toMatch(/not an individual review/);
    expect(JSON.parse(String(batch!['scope_json']))).toEqual({ testPaperId: paperId });
    expect(batch!['created_at']).toBeTruthy();

    const rec = await env.DB.prepare("SELECT actor, comment, checklist_json FROM review_records WHERE entity_type = 'QUESTION' AND entity_id = ? AND action = 'VERIFIED'").bind(good[1]).first<{ actor: string; comment: string; checklist_json: string }>();
    expect(rec!.actor).toBe(`user:${reviewer.id}`);
    expect(rec!.comment).toMatch(/BULK MANAGEMENT APPROVAL/);
    expect(JSON.parse(rec!.checklist_json)).toMatchObject({ bulkApproval: true, individuallyReviewed: false, batchId: done.json.batchId });
    // Nobody checked each answer, so the answer key is not marked as verified.
    const key = await env.DB.prepare('SELECT verified_by, verified_at FROM answer_keys WHERE question_id = ?').bind(good[1]).first<{ verified_by: string | null; verified_at: string | null }>();
    expect(key).toEqual({ verified_by: null, verified_at: null });

    const sum = (await call('GET', '/api/review/bulk-approval/summary', undefined, reviewer.auth)).json;
    expect(sum.questions).toMatchObject({ bulkApproved: 10, individuallyVerified: 0 });
    expect(sum.batches[0]).toMatchObject({ id: done.json.batchId, approved: 10, stillBulkApproved: 10 });
    // A second run has nothing left to approve.
    const again = (await call('POST', '/api/review/bulk-approval/preview', { scope: scope() }, reviewer.auth)).json;
    expect(again.eligibleCount).toBe(0);
    expect((await call('POST', '/api/review/bulk-approval/confirm', { scope: scope(), snapshotHash: again.snapshotHash, typed: again.phraseToType, statement: again.statement }, reviewer.auth)).status).toBe(409);
  });

  it('keeps individual review separate: confirming one by one makes it individually reviewed, flagging takes it out of the batch', async () => {
    const mine = good[2]!;
    const flagged = good[3]!;
    const ok = await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [mine], action: 'VERIFIED', checklist: { answerCorrect: true } }, reviewer.auth);
    expect(ok.status).toBe(200);
    expect(ok.json.applied).toBe(1);
    const bad = await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [flagged], action: 'CHANGES_REQUESTED', comment: 'Option C is also defensible.' }, reviewer.auth);
    expect(bad.status).toBe(200);
    expect((await row(flagged))!.verification).toBe('NEEDS_CHANGES');
    const states = await env.DB.prepare('SELECT question_id, state FROM bulk_approval_items WHERE question_id IN (?, ?)').bind(mine, flagged).all<{ question_id: string; state: string }>();
    expect(Object.fromEntries(states.results.map((r) => [r.question_id, r.state]))).toEqual({ [mine]: 'SUPERSEDED', [flagged]: 'REVOKED' });
    const sum = (await call('GET', '/api/review/bulk-approval/summary', undefined, reviewer.auth)).json;
    expect(sum.questions).toMatchObject({ individuallyVerified: 1, bulkApproved: 8, flagged: 1 });
  });

  it('can flag, reject or withdraw bulk-approved questions, with a reason, and never touches individually verified ones', async () => {
    expect((await call('POST', '/api/review/bulk-approval/withdraw', { questionIds: [good[4]], action: 'FLAG', reason: 'no' }, reviewer.auth)).status).toBe(400);
    expect((await call('POST', '/api/review/bulk-approval/withdraw', { questionIds: [good[4]], action: 'FLAG', reason: 'Answer disputed' }, student.auth)).status).toBe(403);
    const flag = await call('POST', '/api/review/bulk-approval/withdraw', { questionIds: [good[4]], action: 'FLAG', reason: 'The answer is disputed by a teacher' }, reviewer.auth);
    expect(flag.json).toMatchObject({ applied: 1, to: 'NEEDS_CHANGES' });
    const reject = await call('POST', '/api/review/bulk-approval/withdraw', { questionIds: [good[5]], action: 'REJECT', reason: 'Wrong unit in the explanation' }, reviewer.auth);
    expect(reject.json).toMatchObject({ applied: 1, to: 'REJECTED' });
    expect((await row(good[4]!))!.verification).toBe('NEEDS_CHANGES');
    expect((await row(good[5]!))!.verification).toBe('REJECTED');
    // The one a person verified individually is not bulk-approved any more, so this does nothing to it.
    const skip = await call('POST', '/api/review/bulk-approval/withdraw', { questionIds: [good[2]], action: 'WITHDRAW', reason: 'Trying to withdraw an individual review' }, reviewer.auth);
    expect(skip.json).toMatchObject({ applied: 0, notBulkApproved: [good[2]] });
    expect((await row(good[2]!))!.verification).toBe('VERIFIED');
    // Withdraw the whole batch: what remains goes back to unverified, individual decisions stay.
    const batchId = (await env.DB.prepare('SELECT id FROM bulk_approval_batches').first<{ id: string }>())!.id;
    const all = await call('POST', '/api/review/bulk-approval/withdraw', { batchId, action: 'WITHDRAW', reason: 'Management withdrew the bulk approval' }, reviewer.auth);
    expect(all.json).toMatchObject({ applied: 6, to: 'UNVERIFIED' });
    expect((await row(good[0]!))!.verification).toBe('UNVERIFIED');
    expect((await row(good[2]!))!.verification).toBe('VERIFIED');
    expect((await row(good[4]!))!.verification).toBe('NEEDS_CHANGES');
    const detail = (await call('GET', `/api/review/bulk-approval/batches/${batchId}`, undefined, reviewer.auth)).json;
    expect(detail.batch.status).toBe('REVOKED');
    expect(detail.endedItems.length).toBe(10);
    const sum = (await call('GET', '/api/review/bulk-approval/summary', undefined, reviewer.auth)).json;
    expect(sum.questions).toMatchObject({ bulkApproved: 0, individuallyVerified: 1 });
  });
});
