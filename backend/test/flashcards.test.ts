import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { conceptsOf, leadIn } from '../src/services/concepts';
import { addDays, sm2 } from '../src/services/flashcards';

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

const sha = (c: string) => c.repeat(64);

async function seed(tag: string, digest: string) {
  const url = `https://cdnbbsr.s3waas.gov.in/test/cards-${tag}.pdf`;
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: url, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `cards-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
      { ref: 'u2', parentRef: null, kind: 'UNIT', label: '2', title: 'Current Electricity', body: null, position: 1, depth: 1, sourcePage: 2, flags: [] as string[] },
      { ref: 't2', parentRef: 'u2', kind: 'SUBTOPIC', label: null, title: "Ohm's law", body: null, position: 0, depth: 2, sourcePage: 2, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  if (!imp.json.syllabusVersionId) throw new Error(JSON.stringify(imp.json).slice(0, 600));
  const node = async (title: string) => (await env.DB.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND title = ?').bind(imp.json.syllabusVersionId, title).first<{ id: string }>())!.id;
  return { paperId: imp.json.testPaperId as string, unit1: await node('Electrostatics'), topic1: await node("Coulomb's law"), unit2: await node('Current Electricity'), topic2: await node("Ohm's law") };
}

const DEF = (term: string, text: string) => ({ type: 'DEFINITION', body: JSON.stringify({ term, text }) });
const FORMULA = (latex: string, text: string | null) => ({ type: 'FORMULA', body: JSON.stringify({ latex, text }) });
const lessonBlocks = (tag: string) => [
  { type: 'HEADING', body: 'Charge' },
  { type: 'TEXT', body: `(${tag}) A long explanation that is not a concept.` },
  DEF('Electric charge', `(${tag}) The property of matter that causes electric force.`),
  { type: 'HEADING', body: "Coulomb's law" },
  FORMULA('F = k\\frac{q_1 q_2}{r^2}', 'F = force (N); r = distance (m).'),
  { type: 'KEY_POINT', body: `**Superposition principle:** (${tag}) the net force is the vector sum of the individual forces.` },
  { type: 'IMPORTANT_FACT', body: `(${tag}) The charge of an electron is $1.6 \\times 10^{-19}$ C.` },
  { type: 'CONCEPT', body: `**Quantisation:** (${tag}) charge comes in whole multiples of e.` },
  { type: 'CALLOUT', body: 'Exam tip: convert to SI units first.' },
];

async function lesson(nodeId: string, title: string, blocks: { type: string; body: string }[]) {
  const res = await call('POST', '/api/admin/resources', { curriculumNodeId: nodeId, type: 'LESSON', title, origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks }, ADMIN);
  if (res.status !== 201) throw new Error(JSON.stringify(res.json).slice(0, 400));
  return res.json.id as string;
}

type Block = { type: string; position: number; conceptKey: string | null; anchor: string | null; body: string };
const blocksOf = async (id: string) => (await call('GET', `/api/learn/resources/${id}`)).json.blocks as Block[];
const keyOf = (blocks: Block[], type: string) => blocks.find((b) => b.type === type)!.conceptKey!;

async function signIn(email: string) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, displayName: 'Test Student' });
  const res = await call('POST', '/api/auth/login', { email, password: PASSWORD });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

/** Moves a card's due day back, as if that many days had passed. */
const daysPass = (id: string, n: number) => env.DB.prepare('UPDATE flashcards SET due_on = ? WHERE id = ?').bind(addDays(TODAY, -n + 0), id).run();

describe('concept keys', () => {
  it('gives each definition, formula, key point, fact and concept of a lesson its own key; other blocks have none', async () => {
    const s = await seed('keys', '1');
    const id = await lesson(s.topic1, 'Charges (keys)', lessonBlocks('keys'));
    const blocks = await blocksOf(id);
    const withKey = blocks.filter((b) => b.conceptKey);
    expect(withKey.map((b) => b.type)).toEqual(['DEFINITION', 'FORMULA', 'KEY_POINT', 'IMPORTANT_FACT', 'CONCEPT']);
    expect(new Set(withKey.map((b) => b.conceptKey)).size).toBe(5);
    for (const b of withKey) {
      expect(b.conceptKey).toMatch(new RegExp(`^${id}\\.[0-9a-f]{16}$`));
      expect(b.anchor).toBe(`c-${b.conceptKey!.split('.')[1]}`);
    }
    expect(blocks.filter((b) => ['HEADING', 'TEXT', 'CALLOUT'].includes(b.type)).every((b) => b.conceptKey === null && b.anchor === null)).toBe(true);
    // The revision page carries the same keys.
    const notes = (await call('GET', `/api/learn/topics/${s.unit1}/revision`)).json;
    const revision = notes.lessons[0].blocks as Block[];
    expect(revision.find((b) => b.type === 'DEFINITION')!.conceptKey).toBe(keyOf(blocks, 'DEFINITION'));
    expect(revision.find((b) => b.type === 'CALLOUT')!.conceptKey).toBeNull();
  });

  it('keeps keys when the lesson is re-imported, reordered, extended or reworded; only a renamed or rewritten concept gets a new key', async () => {
    const s = await seed('stable', '2');
    const first = await call('PUT', '/api/admin/content/resources/cards.stable.lesson', { curriculumNodeId: s.topic1, type: 'LESSON', title: 'Charges (stable)', origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks: lessonBlocks('stable') }, ADMIN);
    expect(first.json.outcome).toBe('CREATED');
    const id = first.json.id as string;
    const before = await blocksOf(id);
    const rowIds = async () => (await env.DB.prepare('SELECT id FROM content_blocks WHERE resource_id = ? ORDER BY position').bind(id).all<{ id: string }>()).results.map((r) => r.id);
    const rowsBefore = await rowIds();

    // Re-import with: a new paragraph on top, the fact moved up, the definition's explanation and the key point's text reworded,
    // the formula's note changed, and the "Quantisation" concept renamed.
    const b = lessonBlocks('stable');
    const edited = [
      { type: 'TEXT', body: 'A new opening paragraph.' },
      b[6]!,
      b[0]!,
      DEF('Electric charge', 'Reworded: the intrinsic property because of which particles exert electric forces.'),
      b[3]!,
      FORMULA('F = k \\frac{q_1 q_2}{r^2}', 'A longer note about the symbols.'),
      { type: 'KEY_POINT', body: '**Superposition principle:** reworded, each force acts as if the others were absent.' },
      { type: 'CONCEPT', body: '**Quantisation of charge:** (stable) charge comes in whole multiples of e.' },
    ];
    const second = await call('PUT', '/api/admin/content/resources/cards.stable.lesson', { curriculumNodeId: s.topic1, type: 'LESSON', title: 'Charges (stable)', origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks: edited }, ADMIN);
    expect(second.json).toMatchObject({ id, outcome: 'UPDATED' });
    // Every block row was written again with a new row id: row ids cannot identify a concept.
    expect((await rowIds()).some((r) => rowsBefore.includes(r))).toBe(false);
    const after = await blocksOf(id);
    for (const type of ['DEFINITION', 'FORMULA', 'KEY_POINT', 'IMPORTANT_FACT']) expect(keyOf(after, type)).toBe(keyOf(before, type));
    expect(keyOf(after, 'CONCEPT')).not.toBe(keyOf(before, 'CONCEPT'));

    // The very same content again changes nothing.
    const third = await call('PUT', '/api/admin/content/resources/cards.stable.lesson', { curriculumNodeId: s.topic1, type: 'LESSON', title: 'Charges (stable)', origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks: edited }, ADMIN);
    expect(third.json.outcome).toBe('UNCHANGED');
    expect((await blocksOf(id)).map((x) => x.conceptKey)).toEqual(after.map((x) => x.conceptKey));
  });

  it('tells two concepts with the same name apart by their order, and reads a bold lead-in as the name', async () => {
    const c = await conceptsOf('res_x', [
      { position: 1, type: 'FORMULA', body: JSON.stringify({ latex: 'V = IR', text: null }) },
      { position: 2, type: 'FORMULA', body: JSON.stringify({ latex: 'V = IR', text: 'again' }) },
      { position: 3, type: 'KEY_POINT', body: 'A point with no bold name at the start.' },
    ]);
    expect(new Set(c.map((x) => x.key)).size).toBe(3);
    expect(c[0]).toMatchObject({ front: 'Formula', latex: 'V = IR', back: '' });
    expect(c[2]).toMatchObject({ front: 'A point with no bold name at the start.', back: 'A point with no bold name at the start.' });
    expect(leadIn("**Coulomb's law:** the force between two charges varies as the inverse square.")).toEqual({ lead: "Coulomb's law", rest: 'the force between two charges varies as the inverse square.' });
    expect(leadIn('**Only bold**')).toBeNull();
  });
});

describe('bookmark, flashcard and their connection', () => {
  it('bookmarks one concept, turns it into a card in one step, and keeps the two independent', async () => {
    const s = await seed('connect', '3');
    const id = await lesson(s.topic1, 'Charges (connect)', lessonBlocks('connect'));
    const blocks = await blocksOf(id);
    const key = keyOf(blocks, 'DEFINITION');
    const h = await signIn('connect@example.test');

    expect((await call('POST', '/api/student/bookmarks', { kind: 'CONCEPT', entityId: `${id}.0000000000000000` }, h)).status).toBe(404);
    expect((await call('POST', '/api/student/bookmarks', { kind: 'CONCEPT', entityId: key }, h)).status).toBe(201);
    expect((await call('POST', '/api/student/bookmarks', { kind: 'CONCEPT', entityId: key }, h)).status).toBe(201); // twice is harmless
    let saved = (await call('GET', '/api/student/bookmarks', undefined, h)).json;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'CONCEPT', entityId: key, title: 'Electric charge', resourceId: id, lesson: 'Charges (connect)', anchor: blocks.find((b) => b.type === 'DEFINITION')!.anchor, paper: 'Physics', cardId: null });
    expect((await call('GET', `/api/student/bookmarks/state?kind=CONCEPT&ids=${blocks.filter((b) => b.conceptKey).map((b) => b.conceptKey).join(',')}`, undefined, h)).json).toEqual([key]);

    // One step: the card. Its text is the lesson's, and it points back to the lesson and the concept.
    const made = await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, h);
    expect(made.status).toBe(201);
    expect(made.json).toMatchObject({ created: true, card: {
      conceptKey: key, resourceId: id, anchor: saved[0].anchor, lesson: 'Charges (connect)', section: 'Charge', type: 'DEFINITION', paper: 'Physics', paperId: s.paperId,
      chapterId: s.unit1, chapter: 'Electrostatics', front: 'Electric charge', back: '(connect) The property of matter that causes electric force.', dueOn: TODAY, due: true, stage: 'NEW',
    } });
    saved = (await call('GET', '/api/student/bookmarks', undefined, h)).json;
    expect(saved[0].cardId).toBe(made.json.card.id);

    // Removing the bookmark never deletes the card.
    await call('POST', '/api/student/bookmarks/remove', { kind: 'CONCEPT', entityId: key }, h);
    expect((await call('GET', '/api/student/bookmarks', undefined, h)).json).toEqual([]);
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, h)).json.map((c: { id: string }) => c.id)).toEqual([made.json.card.id]);

    // And deleting the card never removes a bookmark.
    await call('POST', '/api/student/bookmarks', { kind: 'CONCEPT', entityId: key }, h);
    expect((await call('DELETE', `/api/student/flashcards/${made.json.card.id}`, undefined, h)).json).toEqual({ deleted: true });
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, h)).json).toEqual([]);
    saved = (await call('GET', '/api/student/bookmarks', undefined, h)).json;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ entityId: key, cardId: null });
  });

  it('a formula card asks with the note and answers with the formula; a named point asks with its name', async () => {
    const s = await seed('faces', '4');
    const id = await lesson(s.topic1, 'Charges (faces)', lessonBlocks('faces'));
    const blocks = await blocksOf(id);
    const h = await signIn('faces@example.test');
    const formula = (await call('POST', '/api/student/flashcards', { conceptKey: keyOf(blocks, 'FORMULA'), day: TODAY }, h)).json.card;
    expect(formula).toMatchObject({ type: 'FORMULA', section: "Coulomb's law", front: 'F = force (N); r = distance (m).', back: '', latex: 'F = k\\frac{q_1 q_2}{r^2}' });
    const point = (await call('POST', '/api/student/flashcards', { conceptKey: keyOf(blocks, 'KEY_POINT'), day: TODAY }, h)).json.card;
    expect(point).toMatchObject({ front: 'Superposition principle', back: '(faces) the net force is the vector sum of the individual forces.', latex: null });
    const fact = (await call('POST', '/api/student/flashcards', { conceptKey: keyOf(blocks, 'IMPORTANT_FACT'), day: TODAY }, h)).json.card;
    expect(fact.front).toBe("Important fact: Coulomb's law");
    expect(fact.back).toContain('The charge of an electron');
  });

  it('keeps a card and a bookmark working after their concept is rewritten in the lesson', async () => {
    const s = await seed('survive', '5');
    const id = await lesson(s.topic1, 'Charges (survive)', lessonBlocks('survive'));
    const key = keyOf(await blocksOf(id), 'IMPORTANT_FACT'); // a fact without a name: its key follows its text
    const h = await signIn('survive@example.test');
    await call('POST', '/api/student/bookmarks', { kind: 'CONCEPT', entityId: key }, h);
    const card = (await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, h)).json.card;
    const blocks = lessonBlocks('survive');
    blocks[6] = { type: 'IMPORTANT_FACT', body: 'A completely rewritten fact.' };
    expect((await call('PUT', `/api/admin/resources/${id}`, { curriculumNodeId: s.topic1, type: 'LESSON', title: 'Charges (survive)', origin: 'AUTHORED', usagePermissionId: 'perm_owned', blocks }, ADMIN)).status).toBe(200);
    expect((await blocksOf(id)).some((b) => b.conceptKey === key)).toBe(false);
    // The card keeps the text it was made with, still links to its lesson, and can still be reviewed.
    const kept = (await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, h)).json;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: card.id, resourceId: id, back: card.back });
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h)).status).toBe(200);
    expect((await call('GET', '/api/student/bookmarks', undefined, h)).json[0]).toMatchObject({ entityId: key, resourceId: id, cardId: card.id });
    // Asking again for that concept returns the existing card; a student without it is told the concept has changed.
    expect((await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, h)).json).toMatchObject({ created: false, card: { id: card.id } });
    const other = await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, await signIn('survive2@example.test'));
    expect(other.status).toBe(404);
    expect(other.json.error.code).toBe('CONCEPT_NOT_FOUND');
  });
});

describe('no duplicate cards', () => {
  it('one card per concept for single cards, lesson imports and topic imports', async () => {
    const s = await seed('dupes', '6');
    const a = await lesson(s.topic1, 'Charges (dupes)', lessonBlocks('dupes'));
    const b = await lesson(s.topic2, 'Current (dupes)', [{ type: 'HEADING', body: "Ohm's law" }, DEF('Resistance', 'Opposition to current.'), FORMULA('V = IR', 'V = potential difference; I = current; R = resistance.')]);
    const h = await signIn('dupes@example.test');
    const key = keyOf(await blocksOf(a), 'DEFINITION');
    const count = async () => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM flashcards f JOIN users u ON u.id = f.user_id WHERE u.email = 'dupes@example.test'`).first<{ n: number }>())!.n;

    const one = await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, h);
    const two = await call('POST', '/api/student/flashcards', { conceptKey: key, day: TODAY }, h);
    expect([one.status, two.status]).toEqual([201, 200]);
    expect(two.json).toMatchObject({ created: false, card: { id: one.json.card.id } });
    expect(await count()).toBe(1);
    // Two requests at the same moment still leave one card.
    const key2 = keyOf(await blocksOf(a), 'FORMULA');
    const both = await Promise.all([call('POST', '/api/student/flashcards', { conceptKey: key2, day: TODAY }, h), call('POST', '/api/student/flashcards', { conceptKey: key2, day: TODAY }, h)]);
    expect(both.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await count()).toBe(2);

    // Only formulas and definitions of the lesson: both already there.
    expect((await call('POST', '/api/student/flashcards/import', { resourceId: a, types: ['FORMULA', 'DEFINITION'], day: TODAY }, h)).json).toMatchObject({ total: 2, added: 0, existing: 2 });
    // The whole lesson: three new, two already there. A second import adds nothing.
    expect((await call('POST', '/api/student/flashcards/import', { resourceId: a, day: TODAY }, h)).json).toMatchObject({ total: 5, added: 3, existing: 2, notAdded: 0 });
    expect((await call('POST', '/api/student/flashcards/import', { resourceId: a, day: TODAY }, h)).json).toMatchObject({ total: 5, added: 0, existing: 5 });
    expect(await count()).toBe(5);
    // A whole unit (its lessons), then again.
    expect((await call('POST', '/api/student/flashcards/import', { nodeId: s.unit2, day: TODAY }, h)).json).toMatchObject({ total: 2, added: 2, existing: 0 });
    expect((await call('POST', '/api/student/flashcards/import', { nodeId: s.unit2, day: TODAY }, h)).json).toMatchObject({ total: 2, added: 0, existing: 2 });
    expect(await count()).toBe(7);
    const keys = (await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, h)).json.map((c: { conceptKey: string }) => c.conceptKey);
    expect(new Set(keys).size).toBe(7);
    // Which concepts of a lesson already have a card.
    const state = (await call('POST', '/api/student/flashcards/state', { keys: (await blocksOf(b)).map((x) => x.conceptKey).filter(Boolean).concat(['junk']) }, h)).json;
    expect(state).toHaveLength(2);

    expect((await call('POST', '/api/student/flashcards/import', { day: TODAY }, h)).status).toBe(400);
    expect((await call('POST', '/api/student/flashcards/import', { resourceId: a, nodeId: s.unit1, day: TODAY }, h)).status).toBe(400);
    expect((await call('POST', '/api/student/flashcards/import', { resourceId: 'nope', day: TODAY }, h)).status).toBe(404);
    expect((await call('POST', '/api/student/flashcards', { conceptKey: 'not a key', day: TODAY }, h)).status).toBe(400);
  });
});

describe('revision schedule', () => {
  it('follows SM-2 for Know and Need revision, and accepts the four-rating scale', () => {
    const start = { intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 };
    const g1 = sm2(start, 'GOOD');
    const g2 = sm2(g1, 'GOOD');
    const g3 = sm2(g2, 'GOOD');
    expect([g1.intervalDays, g2.intervalDays, g3.intervalDays]).toEqual([1, 6, 15]);
    expect(g3.ease).toBe(2.5);
    const again = sm2(g3, 'AGAIN');
    expect(again).toMatchObject({ intervalDays: 1, reps: 0, lapses: 1 });
    expect(again.ease).toBeLessThan(2.5);
    expect(sm2(g2, 'HARD').intervalDays).toBeLessThan(sm2(g2, 'GOOD').intervalDays);
    expect(sm2(g2, 'EASY').intervalDays).toBeGreaterThan(sm2(g2, 'GOOD').intervalDays);
    let low = start;
    for (let i = 0; i < 20; i++) low = sm2(low, 'AGAIN');
    expect(low.ease).toBe(1.3); // never below the floor
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('moves a card to its next due day, refuses a second answer the same day, and keeps the queue and counts in step', async () => {
    const s = await seed('schedule', '7');
    const a = await lesson(s.topic1, 'Charges (schedule)', lessonBlocks('schedule'));
    await lesson(s.topic2, 'Current (schedule)', [DEF('Resistance (schedule)', 'Opposition to current.')]);
    const h = await signIn('schedule@example.test');
    await call('POST', '/api/student/flashcards/import', { resourceId: a, day: TODAY }, h);
    await call('POST', '/api/student/flashcards/import', { nodeId: s.unit2, day: TODAY }, h);

    let queue = (await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, h)).json;
    expect(queue.due).toBe(6);
    expect(queue.cards).toHaveLength(6);
    const card = queue.cards[0] as { id: string };

    const r1 = await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h);
    expect(r1.json).toMatchObject({ dueOn: addDays(TODAY, 1), due: false, intervalDays: 1, reps: 1, lastRating: 'GOOD', stage: 'LEARNING' });
    const twice = await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h);
    expect(twice.status).toBe(409);
    expect(twice.json.error.code).toBe('NOT_DUE');

    await daysPass(card.id, 0);
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h)).json).toMatchObject({ dueOn: addDays(TODAY, 6), intervalDays: 6, reps: 2 });
    await daysPass(card.id, 0);
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h)).json).toMatchObject({ dueOn: addDays(TODAY, 15), intervalDays: 15, reps: 3 });
    await daysPass(card.id, 0);
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: TODAY }, h)).json).toMatchObject({ intervalDays: 38, stage: 'KNOWN' });
    await daysPass(card.id, 0);
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'AGAIN', day: TODAY }, h)).json).toMatchObject({ dueOn: addDays(TODAY, 1), intervalDays: 1, reps: 0, lapses: 1, lastRating: 'AGAIN', stage: 'LEARNING' });
    // The wider scale is accepted as it is.
    const other = queue.cards[1] as { id: string };
    expect((await call('POST', `/api/student/flashcards/${other.id}/review`, { rating: 'EASY', day: TODAY }, h)).status).toBe(200);
    await daysPass(other.id, 0);
    expect((await call('POST', `/api/student/flashcards/${other.id}/review`, { rating: 'HARD', day: TODAY }, h)).status).toBe(200);
    expect((await call('POST', `/api/student/flashcards/${other.id}/review`, { rating: 'MAYBE', day: TODAY }, h)).status).toBe(400);
    expect((await call('POST', `/api/student/flashcards/${card.id}/review`, { rating: 'GOOD', day: '2020-01-01' }, h)).status).toBe(422);

    // Queue, summary and dashboard agree: 4 cards still due, 2 reviewed today.
    queue = (await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, h)).json;
    expect(queue.due).toBe(4);
    const summary = (await call('GET', `/api/student/flashcards/summary?day=${TODAY}`, undefined, h)).json;
    expect(summary).toMatchObject({ total: 6, due: 4, reviewedToday: 2, fresh: 4 });
    expect(summary.subjects).toHaveLength(1);
    expect(summary.subjects[0]).toMatchObject({ paperId: s.paperId, paper: 'Physics', total: 6, due: 4 });
    expect(summary.subjects[0].chapters.map((c: { chapter: string; total: number }) => [c.chapter, c.total])).toEqual([['Electrostatics', 5], ['Current Electricity', 1]]);
    const dash = (await call('GET', `/api/student/dashboard?day=${TODAY}&since=${new Date(Date.now() - 3600_000).toISOString()}`, undefined, h)).json;
    expect(dash.flashcards).toEqual({ total: 6, due: 4 });

    // Subject and chapter filters.
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}&chapterId=${s.unit2}`, undefined, h)).json).toHaveLength(1);
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}&paperId=${s.paperId}&due=1`, undefined, h)).json).toHaveLength(4);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}&chapterId=${s.unit2}`, undefined, h)).json.due).toBe(1);
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}&paperId=nope`, undefined, h)).json).toEqual([]);
    const history = await env.DB.prepare('SELECT rating FROM flashcard_reviews WHERE card_id = ? ORDER BY reviewed_at, rowid').bind(card.id).all<{ rating: string }>();
    expect(history.results.map((r) => r.rating)).toEqual(['GOOD', 'GOOD', 'GOOD', 'GOOD', 'AGAIN']);
  });
});

describe('each student sees only their own cards', () => {
  it('refuses to list, review or delete another student\'s card, and needs sign-in', async () => {
    const s = await seed('private', '8');
    const id = await lesson(s.topic1, 'Charges (private)', lessonBlocks('private'));
    const a = await signIn('owner@example.test');
    const b = await signIn('other@example.test');
    await call('POST', '/api/student/flashcards/import', { resourceId: id, day: TODAY }, a);
    const mine = (await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, a)).json as { id: string; conceptKey: string }[];
    expect(mine).toHaveLength(5);

    expect((await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, b)).json).toEqual([]);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, b)).json).toMatchObject({ due: 0, cards: [] });
    expect((await call('GET', `/api/student/flashcards/summary?day=${TODAY}`, undefined, b)).json).toMatchObject({ total: 0, due: 0, subjects: [] });
    expect((await call('POST', '/api/student/flashcards/state', { keys: mine.map((c) => c.conceptKey) }, b)).json).toEqual([]);
    expect((await call('POST', `/api/student/flashcards/${mine[0]!.id}/review`, { rating: 'GOOD', day: TODAY }, b)).status).toBe(404);
    expect((await call('DELETE', `/api/student/flashcards/${mine[0]!.id}`, undefined, b)).status).toBe(404);
    // The owner's card is untouched by those attempts.
    expect((await call('GET', `/api/student/flashcards?day=${TODAY}`, undefined, a)).json[0]).toMatchObject({ id: mine[0]!.id, reps: 0, dueOn: TODAY });
    // The same concept gives the other student their own, separate card.
    const theirs = (await call('POST', '/api/student/flashcards', { conceptKey: mine[0]!.conceptKey, day: TODAY }, b)).json;
    expect(theirs.created).toBe(true);
    expect(theirs.card.id).not.toBe(mine[0]!.id);
    await call('POST', `/api/student/flashcards/${theirs.card.id}/review`, { rating: 'GOOD', day: TODAY }, b);
    expect((await call('GET', `/api/student/flashcards/queue?day=${TODAY}`, undefined, a)).json.due).toBe(5);

    for (const [method, path] of [['GET', `/api/student/flashcards?day=${TODAY}`], ['GET', `/api/student/flashcards/queue?day=${TODAY}`], ['GET', `/api/student/flashcards/summary?day=${TODAY}`], ['POST', '/api/student/flashcards'], ['POST', '/api/student/flashcards/import'], ['POST', '/api/student/flashcards/state'], ['POST', `/api/student/flashcards/${mine[0]!.id}/review`], ['DELETE', `/api/student/flashcards/${mine[0]!.id}`]] as const) {
      expect((await call(method, path, method === 'GET' || method === 'DELETE' ? undefined : {})).status).toBe(401);
    }
    // Deleting the account's card removes its review history with it.
    await call('DELETE', `/api/student/flashcards/${theirs.card.id}`, undefined, b);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM flashcard_reviews WHERE card_id = ?').bind(theirs.card.id).first<{ n: number }>())!.n).toBe(0);
  });
});

describe('finding concepts', () => {
  it('search returns single concepts with their lesson and place in it', async () => {
    const s = await seed('search', '9');
    const id = await lesson(s.topic1, 'Charges (search)', lessonBlocks('search'));
    const blocks = await blocksOf(id);
    const res = (await call('GET', '/api/learn/search?q=superposition%20search')).json;
    expect(res.concepts).toHaveLength(1);
    expect(res.concepts[0]).toMatchObject({ key: keyOf(blocks, 'KEY_POINT'), type: 'KEY_POINT', title: 'Superposition principle', resourceId: id, lesson: 'Charges (search)', paper: 'Physics', exam: 'CUET_UG' });
    expect(res.concepts[0].anchor).toBe(blocks.find((b) => b.type === 'KEY_POINT')!.anchor);
    expect((await call('GET', '/api/learn/search?q=superposition%20search&exam=CUET_PG')).json.concepts).toEqual([]);
    expect((await call('GET', '/api/learn/search?q=zzzzqqq')).json.concepts).toEqual([]);
    expect((await call('GET', '/api/learn/search?q=')).json.concepts).toEqual([]);
  });
});
