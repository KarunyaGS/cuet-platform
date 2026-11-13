import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };
const PASSWORD = 'correct horse battery';
const TODAY = new Date().toISOString().slice(0, 10);

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}

async function seed(tag: string, digest: string) {
  const url = `https://cdnbbsr.s3waas.gov.in/test/annot-${tag}.pdf`;
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: url, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `annot-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: digest.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  if (!imp.json.syllabusVersionId) throw new Error(JSON.stringify(imp.json).slice(0, 600));
  const node = async (title: string) => (await env.DB.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND title = ?').bind(imp.json.syllabusVersionId, title).first<{ id: string }>())!.id;
  const unit = await node('Electrostatics');
  const topic = await node("Coulomb's law");
  const lesson = await call('POST', '/api/admin/resources', {
    curriculumNodeId: topic, type: 'LESSON', title: `Coulomb's law (${tag})`, origin: 'AUTHORED', usagePermissionId: 'perm_owned',
    blocks: [{ type: 'TEXT', body: 'Like charges repel and unlike charges attract.' }, { type: 'DEFINITION', body: JSON.stringify({ term: 'Electric charge', text: 'The property of matter that causes electric force.' }) }],
  }, ADMIN);
  const q = await call('POST', '/api/admin/questions', {
    testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) The force between two point charges follows which law?`, difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned',
    isDemonstration: false, options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }], answer: { correctOptionPositions: [2] },
    explanation: { body: "Coulomb's law gives the force between two point charges." }, topicNodeIds: [topic],
  }, ADMIN);
  if (lesson.status !== 201 || !q.json.id) throw new Error(JSON.stringify([lesson.json, q.json]).slice(0, 600));
  return { paperId: imp.json.testPaperId as string, unit, topic, lessonId: lesson.json.id as string, questionId: q.json.id as string };
}

async function signIn(email: string) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: 'Test Student' });
  const res = await call('POST', '/api/auth/login', { email, password: PASSWORD });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

const highlight = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'HIGHLIGHT', blockKey: 'b-1a2b3c', data: { start: 5, end: 18, before: 'Like ', after: ' and unlike' }, quote: 'charges repel', color: '#FDE047', opacity: 0.45, strokeWidth: 3, z: 1, ...over,
});
const rect = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'RECT', blockKey: 'b-1a2b3c', data: { pts: [[0.1, 0.2], [0.6, 0.9]] }, color: '#ef4444', opacity: 1, strokeWidth: 4, z: 2, ...over });
const pen = (id: string) => ({ id, kind: 'PEN', blockKey: 'b-1a2b3c', data: { pts: [[0.1, 0.1], [0.15, 0.2], [0.2, 0.15], [0.3, 0.4]] }, color: '#2563eb', opacity: 0.8, strokeWidth: 6, z: 3 });

describe('highlights and annotations', () => {
  it('saves a highlight, a rectangle and a pen stroke on a lesson, with what was selected, where, and how it looks; and gives them back exactly', async () => {
    const s = await seed('a1', 'a');
    const me = await signIn('annot-1@example.com');
    expect((await call('PUT', '/api/student/annotations', { surfaceKind: 'LESSON', surfaceId: s.lessonId, upserts: [highlight('hl-aaaaaaa1')] })).status).toBe(401);
    const save = await call('PUT', '/api/student/annotations', { surfaceKind: 'LESSON', surfaceId: s.lessonId, originPath: `/learn/${s.lessonId}`, upserts: [highlight('hl-aaaaaaa1'), rect('rc-aaaaaaa1'), pen('pn-aaaaaaa1')] }, me);
    expect(save.json).toMatchObject({ saved: 3, removed: 0, changed: 3 });
    const list = (await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, me)).json;
    expect(list.map((a: { id: string }) => a.id)).toEqual(['hl-aaaaaaa1', 'rc-aaaaaaa1', 'pn-aaaaaaa1']);
    expect(list[0]).toMatchObject({ kind: 'HIGHLIGHT', blockKey: 'b-1a2b3c', quote: 'charges repel', data: { start: 5, end: 18, before: 'Like ', after: ' and unlike' }, color: '#fde047', opacity: 0.45, orphaned: false, originPath: `/learn/${s.lessonId}` });
    expect(list[1]).toMatchObject({ kind: 'RECT', data: { pts: [[0.1, 0.2], [0.6, 0.9]] }, color: '#ef4444', strokeWidth: 4, z: 2 });
    expect(list[2]).toMatchObject({ kind: 'PEN', opacity: 0.8, strokeWidth: 6 });
    expect(list[2].data.pts).toHaveLength(4);
    // The server works out where the lesson sits; the browser does not say.
    const row = await env.DB.prepare('SELECT exam_code, test_paper_id, unit_node_id, chapter_node_id, curriculum_node_id, resource_id, question_id FROM annotations WHERE id = ?').bind('hl-aaaaaaa1').first();
    expect(row).toEqual({ exam_code: 'CUET_UG', test_paper_id: s.paperId, unit_node_id: s.unit, chapter_node_id: s.unit, curriculum_node_id: s.topic, resource_id: s.lessonId, question_id: null });
  });

  it('moving, resizing, recolouring and re-sending change the same record; nothing is duplicated; removing takes only what was named', async () => {
    const s = await seed('a2', 'b');
    const me = await signIn('annot-2@example.com');
    const base = { surfaceKind: 'LESSON', surfaceId: s.lessonId };
    await call('PUT', '/api/student/annotations', { ...base, upserts: [highlight('hl-bbbbbbb1'), rect('rc-bbbbbbb1')] }, me);
    // The same batch again (a retry after a lost reply): still two records.
    await call('PUT', '/api/student/annotations', { ...base, upserts: [highlight('hl-bbbbbbb1'), rect('rc-bbbbbbb1')] }, me);
    // Dragged and resized, new colour.
    await call('PUT', '/api/student/annotations', { ...base, upserts: [rect('rc-bbbbbbb1', { data: { pts: [[0.3, 0.3], [0.9, 1.4]] }, color: '#16a34a', strokeWidth: 8 })] }, me);
    let list = (await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, me)).json;
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ id: 'rc-bbbbbbb1', data: { pts: [[0.3, 0.3], [0.9, 1.4]] }, color: '#16a34a', strokeWidth: 8 });
    expect(Date.parse(list[1].updatedAt)).toBeGreaterThanOrEqual(Date.parse(list[1].createdAt));
    await call('PUT', '/api/student/annotations', { ...base, deletes: ['rc-bbbbbbb1'] }, me);
    list = (await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, me)).json;
    expect(list.map((a: { id: string }) => a.id)).toEqual(['hl-bbbbbbb1']);
    // Bad input is refused whole.
    expect((await call('PUT', '/api/student/annotations', { ...base, upserts: [highlight('hl-bbbbbbb2', { quote: '' })] }, me)).status).toBe(422);
    expect((await call('PUT', '/api/student/annotations', { ...base, upserts: [rect('rc-bbbbbbb2', { data: { pts: [] } })] }, me)).status).toBe(422);
    expect((await call('PUT', '/api/student/annotations', { ...base, upserts: [rect('rc-bbbbbbb2', { color: 'red' })] }, me)).status).toBe(400);
    expect((await call('PUT', '/api/student/annotations', { surfaceKind: 'LESSON', surfaceId: 'no-such-lesson', upserts: [rect('rc-bbbbbbb3')] }, me)).status).toBe(404);
    expect((await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, me)).json).toHaveLength(1);
  });

  it('annotating a question changes nothing about the question, its answer or scoring, and shows wherever that question is opened', async () => {
    const s = await seed('a3', 'c');
    const me = await signIn('annot-3@example.com');
    const before = await env.DB.prepare('SELECT q.stem, q.content_hash, q.version, q.updated_at, (SELECT correct_option_positions FROM answer_keys WHERE question_id = q.id) AS answer, (SELECT group_concat(text, \'|\') FROM question_options WHERE question_id = q.id) AS options FROM questions q WHERE q.id = ?').bind(s.questionId).first();
    const save = await call('PUT', '/api/student/annotations', {
      surfaceKind: 'QUESTION', surfaceId: s.questionId, originPath: '/practice/sess_1',
      upserts: [highlight('hl-ccccccc1', { blockKey: 'stem', quote: 'two point charges', data: { start: 23, end: 40, before: 'between ', after: ' follows' } }), highlight('hl-ccccccc2', { blockKey: 'opt-2', quote: "Coulomb's law", data: { start: 0, end: 13 } }), rect('rc-ccccccc1', { blockKey: 'stem' })],
    }, me);
    expect(save.json.changed).toBe(3);
    const after = await env.DB.prepare('SELECT q.stem, q.content_hash, q.version, q.updated_at, (SELECT correct_option_positions FROM answer_keys WHERE question_id = q.id) AS answer, (SELECT group_concat(text, \'|\') FROM question_options WHERE question_id = q.id) AS options FROM questions q WHERE q.id = ?').bind(s.questionId).first();
    expect(after).toEqual(before);
    const many = (await call('GET', `/api/student/annotations?surface=QUESTION&ids=${s.questionId},q_other`, undefined, me)).json;
    expect(many.map((a: { blockKey: string }) => a.blockKey).sort()).toEqual(['opt-2', 'stem', 'stem']);
    const row = await env.DB.prepare('SELECT exam_code, test_paper_id, unit_node_id, curriculum_node_id, resource_id, question_id FROM annotations WHERE id = ?').bind('hl-ccccccc1').first();
    expect(row).toEqual({ exam_code: 'CUET_UG', test_paper_id: s.paperId, unit_node_id: s.unit, curriculum_node_id: s.topic, resource_id: null, question_id: s.questionId });
    // No answer is exposed by the annotation API.
    expect(JSON.stringify(many)).not.toContain('correctOptionPositions');
  });

  it('keeps each student\'s annotations to that student: another account cannot read, change, overwrite or remove them', async () => {
    const s = await seed('a4', 'd');
    const me = await signIn('annot-4a@example.com');
    const other = await signIn('annot-4b@example.com');
    const base = { surfaceKind: 'LESSON', surfaceId: s.lessonId };
    await call('PUT', '/api/student/annotations', { ...base, upserts: [highlight('hl-ddddddd1', { note: 'mine' })] }, me);
    expect((await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, other)).json).toEqual([]);
    expect((await call('GET', '/api/student/annotations', undefined, other)).json).toEqual([]);
    // The other student sends the same id: it must not overwrite, and they get no record of their own from it.
    const clash = await call('PUT', '/api/student/annotations', { ...base, upserts: [highlight('hl-ddddddd1', { note: 'theirs', color: '#000000' })] }, other);
    expect(clash.json.changed).toBe(0);
    expect((await call('PUT', '/api/student/annotations', { ...base, deletes: ['hl-ddddddd1'] }, other)).json.changed).toBe(0);
    expect((await call('PATCH', '/api/student/annotations/hl-ddddddd1', { note: 'hacked' }, other)).status).toBe(404);
    expect((await call('DELETE', '/api/student/annotations/hl-ddddddd1', undefined, other)).status).toBe(404);
    const mine = (await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`, undefined, me)).json;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ note: 'mine', color: '#fde047' });
    expect((await call('GET', `/api/student/annotations?surface=LESSON&id=${s.lessonId}`)).status).toBe(401);
  });

  it('lists everything for My bookmarks with subject, unit, chapter, topic and lesson; a new sign-in reads the same; note edits and removal leave bookmarks and cards alone', async () => {
    const s = await seed('a5', 'e');
    const me = await signIn('annot-5@example.com');
    const blocks = (await call('GET', `/api/learn/resources/${s.lessonId}`)).json.blocks as { conceptKey: string | null }[];
    const key = blocks.find((b) => b.conceptKey)!.conceptKey!;
    const card = await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, me);
    await call('POST', '/api/student/bookmarks', { kind: 'LESSON', entityId: s.lessonId }, me);
    await call('PUT', '/api/student/annotations', { surfaceKind: 'LESSON', surfaceId: s.lessonId, originPath: `/learn/${s.lessonId}`, upserts: [highlight('hl-eeeeeee1'), rect('rc-eeeeeee1', { orphaned: true })] }, me);
    await call('PUT', '/api/student/annotations', { surfaceKind: 'QUESTION', surfaceId: s.questionId, originPath: '/results/sess_9', upserts: [highlight('hl-eeeeeee2', { blockKey: 'stem' })] }, me);
    const again = await signIn('annot-5@example.com');
    const all = (await call('GET', '/api/student/annotations', undefined, again)).json;
    expect(all).toHaveLength(3);
    const lessonOne = all.find((a: { id: string }) => a.id === 'hl-eeeeeee1');
    expect(lessonOne).toMatchObject({ paper: 'Physics', unit: 'Electrostatics', chapter: 'Electrostatics', topic: "Coulomb's law", lesson: "Coulomb's law (a5)", examCode: 'CUET_UG', originPath: `/learn/${s.lessonId}`, quote: 'charges repel' });
    expect(all.find((a: { id: string }) => a.id === 'rc-eeeeeee1').orphaned).toBe(true);
    expect(all.find((a: { id: string }) => a.id === 'hl-eeeeeee2')).toMatchObject({ questionId: s.questionId, topic: "Coulomb's law", originPath: '/results/sess_9' });
    expect(all.find((a: { id: string }) => a.id === 'hl-eeeeeee2').question).toContain('The force between two point charges');
    // Edit a note, then remove the highlight: the revision card and the page bookmark are untouched.
    expect((await call('PATCH', '/api/student/annotations/hl-eeeeeee1', { note: '  remember this  ', color: '#86EFAC' }, me)).json).toEqual({ id: 'hl-eeeeeee1', note: 'remember this', color: '#86efac' });
    expect((await call('DELETE', '/api/student/annotations/hl-eeeeeee1', undefined, me)).json).toEqual({ deleted: true });
    expect((await call('GET', '/api/student/annotations', undefined, me)).json).toHaveLength(2);
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, me)).json.map((c: { id: string }) => c.id)).toEqual([card.json.card.id]);
    expect((await call('GET', '/api/student/bookmarks', undefined, me)).json).toHaveLength(1);
    // And removing a card leaves the remaining annotations.
    await call('DELETE', `/api/student/flashcards/${card.json.card.id}`, undefined, me);
    expect((await call('GET', '/api/student/annotations', undefined, me)).json).toHaveLength(2);
  });
});
