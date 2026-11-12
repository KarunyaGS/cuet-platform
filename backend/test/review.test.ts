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

async function person(email: string, role?: 'REVIEWER') {
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: email.split('@')[0] });
  if (role) expect((await call('POST', '/api/admin/users/roles', { email, role }, ADMIN)).status).toBe(200);
  const res = await call('POST', '/api/auth/login', { email, password: 'correct horse battery' });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

const sha = (c: string) => c.repeat(64);

/** A paper whose extraction needs review: imported without machine verification (rows UNVERIFIED). */
async function reviewPaper(tag: string, digest: string, nodes = 3) {
  const url = `https://cdnbbsr.s3waas.gov.in/test/review-${tag}.pdf`;
  const code = `R${tag.toUpperCase()}`.slice(0, 10);
  await call('POST', '/api/admin/registry/papers', {
    exam: 'CUET_PG', year: 2026, papers: [{ code, name: `Review ${tag}`, categoryCode: 'SCQP', officialSyllabusUrl: url, listedOnUrl: 'https://exams.nta.nic.in/' }],
  }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `review-test-${tag}`, exam: 'CUET_PG', year: 2026, paperCode: code,
    source: { kind: 'OFFICIAL_SYLLABUS', title: `Review ${tag}`, publisher: 'NTA', url, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 3 },
    extractor: { name: 'test', version: '1', mode: 'ocr' },
    notes: 'Needs human review: test',
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit one', body: null, position: 0, depth: 1, sourcePage: 1, flags: ['heading_inferred_from_formatting'], check: { ok: false, missingOnPage: ['unit'], secondExtractorAgreementPct: 80, flags: ['heading_inferred_from_formatting'] } },
      { ref: 't1', parentRef: 'u1', kind: 'TOPIC', label: null, title: 'First topic', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] },
      { ref: 't2', parentRef: 'u1', kind: 'TOPIC', label: null, title: 'Second topic', body: 'with body', position: 1, depth: 2, sourcePage: 2, flags: ['ocr'] },
    ].slice(0, nodes),
    tables: [], figures: [],
  }, ADMIN);
  expect(imp.status).toBe(200);
  const rows = await env.DB.prepare('SELECT id, title FROM curriculum_nodes WHERE syllabus_version_id = ? ORDER BY depth, position').bind(imp.json.syllabusVersionId).all<{ id: string; title: string }>();
  const id = (t: string) => rows.results.find((r) => r.title === t)!.id;
  return { paperId: imp.json.testPaperId as string, versionId: imp.json.syllabusVersionId as string, id, code };
}

describe('only a signed-in person can verify', () => {
  it('refuses VERIFIED through the admin token and requires reviewer access on /api/review', async () => {
    const p = await reviewPaper('gate', 'b');
    const viaToken = await call('POST', '/api/admin/review', { entityType: 'CURRICULUM_NODE', entityIds: [p.id('First topic')], action: 'VERIFIED' }, ADMIN);
    expect(viaToken.status).toBe(403);
    expect(viaToken.json.error.code).toBe('HUMAN_REVIEW_REQUIRED');
    expect((await call('GET', '/api/review/queue?exam=CUET_PG&year=2026')).status).toBe(401);
    const student = await person('student-gate@example.test');
    expect((await call('GET', '/api/review/queue?exam=CUET_PG&year=2026', undefined, student)).status).toBe(403);
    const row = await env.DB.prepare('SELECT verification FROM curriculum_nodes WHERE id = ?').bind(p.id('First topic')).first<{ verification: string }>();
    expect(row!.verification).toBe('UNVERIFIED');
  });
});

describe('syllabus review workflow', () => {
  it('shows the queue and workspace with row checks', async () => {
    const p = await reviewPaper('queue', 'c');
    const reviewer = await person('rev-queue@example.test', 'REVIEWER');
    const q = await call('GET', '/api/review/queue?exam=CUET_PG&year=2026', undefined, reviewer);
    const item = q.json.find((x: { code: string }) => x.code === p.code);
    expect(item).toMatchObject({ state: 'NEEDS_REVIEW', rows: { total: 3, pending: 3, guessedHeadings: 1, failingCheck: 1 } });
    const ws = await call('GET', `/api/review/papers/${p.paperId}`, undefined, reviewer);
    expect(ws.json.nodes).toHaveLength(3);
    expect(JSON.parse(ws.json.nodes[0].check_json)).toMatchObject({ ok: false, missingOnPage: ['unit'] });
    expect(ws.json.version.notes).toContain('Needs human review');
  });

  it('edits and moves rows with full history, verifies with a checklist, and signs off only when every row is decided', async () => {
    const p = await reviewPaper('flow', 'd');
    const reviewer = await person('rev-flow@example.test', 'REVIEWER');
    // Edit keeps the old values and the source page.
    const edit = await call('POST', `/api/review/nodes/${p.id('Unit one')}/edit`, { title: 'Unit one: Foundations', reason: 'Title continues on the next line of the PDF' }, reviewer);
    expect(edit.json.changed).toEqual(['title']);
    const hist = await call('GET', `/api/review/history?entityType=CURRICULUM_NODE&entityId=${p.id('Unit one')}`, undefined, reviewer);
    expect(hist.json[0]).toMatchObject({ action: 'EDITED', actorName: 'rev-flow' });
    expect(JSON.parse(hist.json[0].checklist_json).before).toMatchObject({ title: 'Unit one', sourcePage: 1 });
    // Move: indent the second topic under the first, then outdent it back; depths follow.
    expect((await call('POST', `/api/review/nodes/${p.id('Second topic')}/move`, { direction: 'indent' }, reviewer)).json).toMatchObject({ parentId: p.id('First topic'), depth: 3 });
    expect((await call('POST', `/api/review/nodes/${p.id('Second topic')}/move`, { direction: 'outdent' }, reviewer)).json).toMatchObject({ parentId: p.id('Unit one'), depth: 2 });
    // Verify needs a checklist; reject needs a reason.
    const ids = [p.id('Unit one'), p.id('First topic')];
    expect((await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: ids, action: 'VERIFIED' }, reviewer)).status).toBe(422);
    const ok = await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: ids, action: 'VERIFIED', checklist: { matchesSourcePage: true } }, reviewer);
    expect(ok.json.applied).toBe(2);
    const rec = await env.DB.prepare(`SELECT actor FROM review_records WHERE entity_id = ? AND action = 'VERIFIED'`).bind(ids[0]).first<{ actor: string }>();
    expect(rec!.actor).toMatch(/^user:usr_/);
    expect((await call('POST', `/api/review/versions/${p.versionId}/sign-off`, { checklist: { allRowsChecked: true } }, reviewer)).status).toBe(409);
    expect((await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: [p.id('Second topic')], action: 'REJECTED' }, reviewer)).status).toBe(422);
    expect((await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: [p.id('Second topic')], action: 'REJECTED', comment: 'Not in the official PDF' }, reviewer)).status).toBe(200);
    const signed = await call('POST', `/api/review/versions/${p.versionId}/sign-off`, { checklist: { allRowsChecked: true, hierarchyMatchesPdf: true } }, reviewer);
    expect(signed.status).toBe(200);
    const v = await env.DB.prepare('SELECT verification FROM syllabus_versions WHERE id = ?').bind(p.versionId).first<{ verification: string }>();
    expect(v!.verification).toBe('VERIFIED');
    // A later correction re-opens the paper and the row.
    await call('POST', `/api/review/nodes/${p.id('First topic')}/edit`, { body: 'added detail', reason: 'Missed a line' }, reviewer);
    const after = await env.DB.prepare('SELECT v.verification AS vv, n.verification AS nv FROM syllabus_versions v JOIN curriculum_nodes n ON n.syllabus_version_id = v.id WHERE n.id = ?').bind(p.id('First topic')).first<{ vv: string; nv: string }>();
    expect(after).toEqual({ vv: 'UNVERIFIED', nv: 'UNVERIFIED' });
    // Nothing was deleted.
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM curriculum_nodes WHERE syllabus_version_id = ?').bind(p.versionId).first<{ n: number }>();
    expect(count!.n).toBe(3);
  });

  it('needs a second reviewer to verify a manual transcription', async () => {
    const p = await reviewPaper('transcribe', 'e', 0);
    const a = await person('rev-a@example.test', 'REVIEWER');
    const b = await person('rev-b@example.test', 'REVIEWER');
    const added = await call('POST', `/api/review/versions/${p.versionId}/rows`, {
      parentId: null, page: 2, transcription: true, reason: 'Typed from page 2 of the official PDF',
      rows: [
        { ref: 'a', parentRef: null, kind: 'UNIT', label: '1', title: 'اکائی ۱: اردو نثر', body: null },
        { ref: 'b', parentRef: 'a', kind: 'TOPIC', label: null, title: 'داستان', body: null },
      ],
    }, a);
    expect(added.status).toBe(201);
    const ids = added.json.created.map((c: { id: string }) => c.id);
    const row = await env.DB.prepare('SELECT depth, source_page, extraction_flags, authored_by FROM curriculum_nodes WHERE id = ?').bind(ids[1]).first<Record<string, unknown>>();
    expect(row).toMatchObject({ depth: 2, source_page: 2, extraction_flags: 'manual_transcription' });
    const own = await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: ids, action: 'VERIFIED', checklist: { matchesSourcePage: true } }, a);
    expect(own.status).toBe(403);
    expect(own.json.error.code).toBe('SECOND_REVIEWER_REQUIRED');
    expect((await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: ids, action: 'VERIFIED', checklist: { matchesSourcePage: true } }, b)).json.applied).toBe(2);
  });

  it('machine corrections never touch rows a person has decided on', async () => {
    const p = await reviewPaper('machine', 'f');
    const reviewer = await person('rev-machine@example.test', 'REVIEWER');
    await call('POST', '/api/review/decide', { entityType: 'CURRICULUM_NODE', entityIds: [p.id('First topic')], action: 'VERIFIED', checklist: { matchesSourcePage: true } }, reviewer);
    const res = await call('POST', `/api/admin/nodes/${p.id('First topic')}/machine-correction`, {
      expect: { title: 'First topic', body: null }, title: 'First topic changed', body: null, reason: 'Extractor fix test only', method: 'TEST', metrics: {},
    }, ADMIN);
    expect(res.status).toBe(409);
  });
});

describe('content pack upserts', () => {
  it('creates once, skips unchanged, updates drafts, and never overwrites reviewed content', async () => {
    const p = await reviewPaper('content', '1', 2);
    const topic = p.id('First topic');
    const q = (stem: string) => ({
      testPaperId: p.paperId, type: 'MCQ_SINGLE', stem, difficulty: 'EASY', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: 'one' }, { label: 'B', text: 'two' }, { label: 'C', text: 'three' }, { label: 'D', text: 'four' }],
      answer: { correctOptionPositions: [2] }, explanation: { body: 'Two is correct because the question asks for it.' }, topicNodeIds: [topic],
    });
    expect((await call('PUT', '/api/admin/content/questions/test-q-1', q('Which number is two in this test?'), ADMIN)).json.outcome).toBe('CREATED');
    expect((await call('PUT', '/api/admin/content/questions/test-q-1', q('Which number is two in this test?'), ADMIN)).json.outcome).toBe('UNCHANGED');
    const upd = await call('PUT', '/api/admin/content/questions/test-q-1', q('Which number is two in this updated test?'), ADMIN);
    expect(upd.json.outcome).toBe('UPDATED');
    const reviewer = await person('rev-content@example.test', 'REVIEWER');
    await call('POST', '/api/review/decide', { entityType: 'QUESTION', entityIds: [upd.json.id], action: 'VERIFIED', checklist: { answerChecked: true } }, reviewer);
    expect((await call('PUT', '/api/admin/content/questions/test-q-1', q('Which number is two, changed after review?'), ADMIN)).json.outcome).toBe('KEPT_REVIEWED');
    const stored = await env.DB.prepare('SELECT stem, verification, origin FROM questions WHERE id = ?').bind(upd.json.id).first<Record<string, string>>();
    expect(stored).toEqual({ stem: 'Which number is two in this updated test?', verification: 'VERIFIED', origin: 'AI_ASSISTED' });
    const lesson = { curriculumNodeId: topic, testPaperId: p.paperId, type: 'LESSON', title: 'Test lesson', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false, blocks: [{ type: 'TEXT', body: 'Some teaching text.' }] };
    expect((await call('PUT', '/api/admin/content/resources/test-lesson-1', lesson, ADMIN)).json.outcome).toBe('CREATED');
    expect((await call('PUT', '/api/admin/content/resources/test-lesson-1', lesson, ADMIN)).json.outcome).toBe('UNCHANGED');
  });
});
