import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { adaptSchedule, type AdaptItem } from '../src/services/plan-adapt';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function signIn(tag: string) {
  const email = `plan-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: 'Plan Student' });
  const ctx = createExecutionContext();
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) }, env, ctx);
  await waitOnExecutionContext(ctx);
  return { 'content-type': 'application/json', cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);
const sha = (c: string) => c.repeat(64).slice(0, 64);

interface Seeded { paperId: string; code: string; topics: { id: string; title: string; lessonId: string }[] }

/** A small real syllabus: two units of three topics, five questions and one lesson on each topic. */
async function seedSubject(code: string, name: string, digest: string): Promise<Seeded> {
  const url = `https://cdnbbsr.s3waas.gov.in/test/plan-${code}.pdf`;
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code, name, categoryCode: 'DOMAIN', officialSyllabusUrl: url, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
  const nodes: unknown[] = [];
  for (let u = 1; u <= 2; u++) {
    nodes.push({ ref: `u${u}`, parentRef: null, kind: 'UNIT', label: String(u), title: `${name} Unit ${u}`, body: null, position: u - 1, depth: 1, sourcePage: 1, flags: [] });
    for (let t = 1; t <= 3; t++) nodes.push({ ref: `u${u}t${t}`, parentRef: `u${u}`, kind: 'SUBTOPIC', label: null, title: `${name} topic ${u}.${t}`, body: null, position: t - 1, depth: 2, sourcePage: 1, flags: [] });
  }
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `plan-test-${code}`, exam: 'CUET_UG', year: 2026, paperCode: code,
    source: { kind: 'OFFICIAL_SYLLABUS', title: `${name} (${code})`, publisher: 'NTA', url, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} }, nodes, tables: [], figures: [],
  }, ADMIN);
  const { results } = await env.DB.prepare(`SELECT n.id, n.title FROM curriculum_nodes n WHERE n.syllabus_version_id = ? AND n.kind = 'SUBTOPIC' ORDER BY n.position, n.title`).bind(imp.json.syllabusVersionId).all<{ id: string; title: string }>();
  const ordered = results.sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }));
  const topics: Seeded['topics'] = [];
  for (const [i, t] of ordered.entries()) {
    await Promise.all(Array.from({ length: 5 }, (_, q) => call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${code}) ${t.title} question ${q + 1}: which statement is correct?`, difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: 'First' }, { label: 'B', text: 'Second' }, { label: 'C', text: 'Third' }, { label: 'D', text: 'Fourth' }],
      answer: { correctOptionPositions: [2] }, explanation: { body: 'The second statement is correct for this question.' }, topicNodeIds: [t.id],
    }, ADMIN)));
    const lessonId = `les_${code}_${i + 1}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO learning_resources (id, curriculum_node_id, type, title, language, origin, usage_permission_id, status, verification, is_demonstration, content_hash, version, created_at, updated_at) VALUES (?, ?, 'LESSON', ?, 'en', 'AUTHORED', 'perm_owned', 'PUBLISHED', 'VERIFIED', 0, ?, 1, ?, ?)`).bind(lessonId, t.id, `${t.title}: lesson`, `h${code}${i}`, new Date().toISOString(), new Date().toISOString()),
      ...[1, 2, 3].map((b) => env.DB.prepare(`INSERT INTO content_blocks (id, resource_id, position, type, body, created_at, updated_at) VALUES (?, ?, ?, 'PARAGRAPH', ?, ?, ?)`).bind(`blk_${lessonId}_${b}`, lessonId, b, `Block ${b} of ${t.title}.`, new Date().toISOString(), new Date().toISOString())),
    ]);
    topics.push({ id: t.id, title: t.title, lessonId });
  }
  return { paperId: imp.json.testPaperId as string, code, topics };
}

const labs = [{ id: 'phys-test-lab', subject: 'Physics', lessonTitleStartsWith: 'Physics topic 1.1', title: 'Test lab', minutes: 20 }];
const goalOf = (paperIds: string[], over: Record<string, unknown> = {}) => ({ examCode: 'CUET_UG', path: 'COMBINED', paperIds, objectives: [], durationDays: 14, minutesPerDay: 120, coverage: 'STANDARD', startDay: TODAY, labs, ...over });

describe('study plans: the whole student journey', () => {
  let PHY: Seeded;
  let CHE: Seeded;
  let student: Record<string, string>;

  beforeAll(async () => {
    PHY = await seedSubject('322', 'Physics', 'a0');
    CHE = await seedSubject('306', 'Chemistry', 'b0');
    student = await signIn('main');
  }, 120_000);

  const plan = async (h = student, asOf = TODAY) => (await call('GET', `/api/student/planner/plans/current?asOf=${asOf}`, undefined, h)).json;
  const create = (body: Record<string, unknown>, h = student, extra: Record<string, unknown> = {}) => call('POST', '/api/student/planner/plans', { ...body, ...extra }, h);
  const rowsOf = async (planId: string) => (await env.DB.prepare('SELECT * FROM study_plan_items WHERE plan_id = ? ORDER BY day, position').bind(planId).all<Record<string, unknown>>()).results;

  it('is for signed-in students only', async () => {
    for (const [m, p] of [['GET', '/api/student/planner/options'], ['POST', '/api/student/planner/preview'], ['GET', `/api/student/planner/plans/current?asOf=${TODAY}`]] as const) expect((await call(m, p)).status).toBe(401);
  });

  it('offers only what the platform really supports, says what it does not offer, and takes subjects from the syllabus', async () => {
    const o = (await call('GET', '/api/student/planner/options', undefined, student)).json;
    expect(o.exams).toEqual([expect.objectContaining({ code: 'CUET_UG', supported: true })]);
    expect(o.notOffered.map((x: { name: string }) => x.name)).toEqual(['CUET (PG)', 'CET']);
    expect(o.subjects.map((s: { code: string }) => s.code)).toEqual(expect.arrayContaining(['322', '306']));
    expect(o.subjects.find((s: { code: string }) => s.code === '322')).toMatchObject({ paperId: PHY.paperId, topics: 6, questions: 30 });
    expect(o.durations.map((d: { days: number }) => d.days)).toEqual([7, 14, 30]);
    expect(o.paths.length).toBe(7);
    expect(o.objectives.length).toBe(9);
    expect(o.methodReview.status).toBe('PENDING_ACADEMIC_REVIEW');
  });

  it('previews a plan without saving anything, deterministically, built from the real syllabus', async () => {
    const a = await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId, CHE.paperId]), student);
    expect(a.status, JSON.stringify(a.json).slice(0, 300)).toBe(200);
    const b = await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId, CHE.paperId]), student);
    expect(b.json.fingerprint).toBe(a.json.fingerprint);
    expect(b.json.plan.items).toEqual(a.json.plan.items);
    const items = a.json.plan.items as { kind: string; refId: string; subjectCode: string; evidence: string; note: string; minutes: number }[];
    const lessonIds = new Set([...PHY.topics, ...CHE.topics].map((t) => t.lessonId));
    const learns = items.filter((i) => i.kind === 'LESSON');
    expect(learns.length).toBeGreaterThan(3);
    expect(learns.every((i) => lessonIds.has(i.refId))).toBe(true); // every learning item is a real lesson of the platform
    expect(items.every((i) => i.note.length > 10 && ['PERSONAL', 'SYLLABUS', 'METHOD', 'VERIFIED_TREND'].includes(i.evidence))).toBe(true);
    expect(a.json.plan.summary.trends.used).toBe(false); // no verified past-paper data here, so no trend is claimed
    expect(a.json.plan.summary.methodReview).toBe('PENDING_ACADEMIC_REVIEW');
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM study_plans').first<{ n: number }>())!.n).toBe(0);
    // an unknown subject is refused; a start date far from today is refused
    expect((await call('POST', '/api/student/planner/preview', goalOf(['paper_nope']), student)).status).toBe(422);
    expect((await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId], { startDay: '2031-01-01' }), student)).status).toBe(422);
  });

  it('a 7-day, 14-day and 30-day plan are different plans, not the same plan stretched', async () => {
    const make = async (days: number) => (await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId, CHE.paperId], { durationDays: days, path: 'COMPLETE_EXAM' }), student)).json.plan;
    const [p7, p14, p30] = [await make(7), await make(14), await make(30)];
    expect(p7.days).toHaveLength(7);
    expect(p30.days).toHaveLength(30);
    const kinds = (p: { items: { kind: string }[] }, k: string) => p.items.filter((i) => i.kind === k).length;
    expect(kinds(p7, 'MOCK')).toBeLessThanOrEqual(kinds(p14, 'MOCK'));
    expect(kinds(p14, 'MOCK')).toBeLessThan(kinds(p30, 'MOCK') + 1);
    expect(kinds(p30, 'CHECKPOINT')).toBeGreaterThan(kinds(p7, 'CHECKPOINT'));
    expect(p7.summary.phases).not.toEqual(p30.summary.phases);
  });

  it('adds the plan to the planner: the suggestion is kept, and the weekly planner and dashboard see the same items', async () => {
    const pv = (await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId, CHE.paperId]), student)).json;
    expect((await create(goalOf([PHY.paperId, CHE.paperId]), student, { fingerprint: 'stale-fingerprint' })).status).toBe(409);
    const made = await create(goalOf([PHY.paperId, CHE.paperId]), student, { fingerprint: pv.fingerprint });
    expect(made.status, JSON.stringify(made.json).slice(0, 300)).toBe(201);
    const cur = await plan();
    expect(cur.plan).toMatchObject({ status: 'ACTIVE', durationDays: 14, startDay: TODAY, minutesPerDay: 120, version: 1 });
    expect(cur.plan.goal).toMatchObject({ path: 'COMBINED', paperIds: [PHY.paperId, CHE.paperId], durationDays: 14 });
    expect(cur.items).toHaveLength(pv.plan.items.length);
    expect(cur.items.every((i: { origin: string; pinned: boolean; moved: boolean }) => i.origin === 'EXPERT' && !i.pinned && !i.moved)).toBe(true);
    const row = (await env.DB.prepare('SELECT original_json FROM study_plans WHERE id = ?').bind(made.json.id).first<{ original_json: string }>())!;
    expect(JSON.parse(row.original_json).items).toHaveLength(pv.plan.items.length);
    // the existing weekly planner and the dashboard read the same rows
    const week = (await call('GET', `/api/student/plan?from=${TODAY}&to=${addDays(TODAY, 6)}`, undefined, student)).json;
    expect(week.length).toBeGreaterThan(0);
    expect(week[0]).toMatchObject({ planId: made.json.id, origin: 'EXPERT' });
    expect(week[0].minutes).toBeGreaterThan(0);
    const dash = (await call('GET', `/api/student/dashboard?day=${TODAY}&since=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`, undefined, student)).json;
    expect(dash.plan.length).toBe(week.filter((w: { day: string }) => w.day === TODAY).length);
    // a second plan needs an explicit decision
    const second = await create(goalOf([PHY.paperId]), student);
    expect(second.status).toBe(409);
    expect(second.json.error.details ?? second.json.error.code).toBeTruthy();
  });

  it('lets the student customise: move, change time, tick, replace, add, remove, restore, reorder, and keeps the original', async () => {
    const h = await signIn('custom');
    const made = await create(goalOf([PHY.paperId, CHE.paperId], { durationDays: 7 }), h);
    expect(made.status).toBe(201);
    const cur = await plan(h);
    const items = cur.items as { id: string; day: string; kind: string; minutes: number; suggestionKey: string; position: number }[];
    const first = items[0]!;
    // move to another day: pinned and marked moved
    const target = addDays(first.day, 2);
    expect((await call('PATCH', `/api/student/plan/${first.id}`, { day: target }, h)).status).toBe(200);
    // change its time
    const second = items.find((i) => i.id !== first.id && i.kind === 'PRACTICE')!;
    await call('PATCH', `/api/student/plan/${second.id}`, { minutes: 45 }, h);
    // tick one
    const third = items.find((i) => i.kind === 'REVISE')!;
    await call('PATCH', `/api/student/plan/${third.id}`, { done: true }, h);
    // replace one with an alternative
    const alt = (await call('GET', `/api/student/planner/items/${first.id}/alternatives`, undefined, h)).json.alternatives as { kind: string; refId: string; title: string; minutes: number }[];
    expect(alt.length).toBeGreaterThan(0);
    const other = alt[0]!;
    expect((await call('PATCH', `/api/student/plan/${second.id}`, { kind: other.kind, refId: other.refId, title: other.title, minutes: other.minutes }, h)).status).toBe(200);
    // add one of the student's own
    const added = await call('POST', '/api/student/plan', { day: target, kind: 'CUSTOM', title: 'Ask my teacher about work and energy', planId: made.json.id, minutes: 15 }, h);
    expect(added.status).toBe(201);
    // remove a suggestion, then restore it
    const doomed = items.find((i) => i.kind === 'REVISE' && i.id !== third.id)!;
    expect((await call('DELETE', `/api/student/plan/${doomed.id}`, undefined, h)).status).toBe(200);
    let after = await plan(h);
    expect(after.removed.map((r: { suggestionKey: string }) => r.suggestionKey)).toContain(doomed.suggestionKey);
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/restore`, { suggestionKey: doomed.suggestionKey }, h)).status).toBe(200);
    after = await plan(h);
    expect(after.removed.map((r: { suggestionKey: string }) => r.suggestionKey)).not.toContain(doomed.suggestionKey);
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/restore`, { suggestionKey: doomed.suggestionKey }, h)).status).toBe(409);
    // reorder a day
    const day = after.items.filter((i: { day: string }) => i.day === target).map((i: { id: string }) => i.id) as string[];
    expect(day.length).toBeGreaterThan(1);
    expect((await call('PUT', `/api/student/planner/plans/${made.json.id}/order`, { day: target, ids: [...day].reverse() }, h)).status).toBe(200);
    expect((await call('PUT', `/api/student/planner/plans/${made.json.id}/order`, { day: target, ids: day.slice(1) }, h)).status).toBe(422);
    after = await plan(h);
    expect(after.items.filter((i: { day: string }) => i.day === target).map((i: { id: string }) => i.id)).toEqual([...day].reverse());
    const moved = after.items.find((i: { id: string }) => i.id === first.id);
    expect(moved).toMatchObject({ day: target, moved: true, pinned: true, originalDay: first.day });
    expect(after.items.find((i: { id: string }) => i.id === third.id)).toMatchObject({ done: true, doneBy: 'STUDENT' });
    expect(after.items.find((i: { id: string }) => i.id === added.json.id)).toMatchObject({ origin: 'STUDENT', title: 'Ask my teacher about work and energy' });
    // the original suggestion is untouched
    const row = (await env.DB.prepare('SELECT original_json FROM study_plans WHERE id = ?').bind(made.json.id).first<{ original_json: string }>())!;
    expect((JSON.parse(row.original_json).items as { date: string; key: string }[]).find((o) => o.date === first.day)).toBeTruthy();
    // another student cannot touch it
    const stranger = await signIn('stranger');
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/adjust`, { asOf: TODAY }, stranger)).status).toBe(404);
    expect((await call('PATCH', `/api/student/plan/${first.id}`, { done: true }, stranger)).status).toBe(404);
  });

  it('adjusts when days are missed: moves what was missed forward within each day\'s time, never moves done or student-moved work, never breaks the order', async () => {
    const h = await signIn('missed');
    const start = addDays(TODAY, -2); // two days already gone
    const made = await create(goalOf([PHY.paperId, CHE.paperId], { durationDays: 14, startDay: start }), h);
    expect(made.status, JSON.stringify(made.json).slice(0, 200)).toBe(201);
    let cur = await plan(h);
    const pastItems = cur.items.filter((i: { day: string }) => i.day < TODAY) as { id: string; day: string; kind: string }[];
    expect(pastItems.length).toBeGreaterThan(2);
    const done = pastItems[0]!;
    const pinned = pastItems[1]!;
    await call('PATCH', `/api/student/plan/${done.id}`, { done: true }, h);
    await call('PATCH', `/api/student/plan/${pinned.id}`, { day: addDays(start, 1) }, h); // the student's own choice (still in the past)
    const res = await call('POST', `/api/student/planner/plans/${made.json.id}/adjust`, { asOf: TODAY }, h);
    expect(res.status).toBe(200);
    expect(res.json.changes.length).toBeGreaterThan(0);
    expect(res.json.changes.every((c: { reason: string }) => c.reason === 'MISSED' || c.reason === 'OVER_TIME' || c.reason === 'PULLED_FORWARD')).toBe(true);
    cur = await plan(h);
    const byId = new Map<string, { day: string; done: boolean; minutes: number; status: string; dependsOn: string | null; suggestionKey: string }>(cur.items.map((i: { id: string }) => [i.id, i]));
    expect(byId.get(done.id)!.day).toBe(done.day); // done work stays where it was
    expect(byId.get(pinned.id)!.day).toBe(addDays(start, 1)); // the student's own move stays
    const stillMissed = cur.items.filter((i: { day: string; done: boolean; pinned: boolean; status: string }) => i.day < TODAY && !i.done && !i.pinned && i.status === 'SCHEDULED');
    expect(stillMissed).toHaveLength(0);
    // each day within its time (a mock test aside), and every follow-up after the work it follows
    for (const d of new Set(cur.items.map((i: { day: string }) => i.day))) {
      const list = cur.items.filter((i: { day: string; status: string }) => i.day === d && i.status === 'SCHEDULED') as { minutes: number; kind: string; pinned: boolean }[];
      if (list.some((i) => i.kind === 'MOCK' || i.pinned)) continue;
      expect(list.reduce((n, i) => n + i.minutes, 0), String(d)).toBeLessThanOrEqual(Math.round(120));
    }
    const byKey = new Map<string, { day: string; done: boolean }>(cur.items.map((i: { suggestionKey: string; day: string; done: boolean }) => [i.suggestionKey, i]));
    for (const i of cur.items as { dependsOn: string | null; day: string; status: string; title: string; done: boolean }[]) {
      const dep = i.dependsOn ? byKey.get(i.dependsOn) : undefined;
      if (dep && i.status === 'SCHEDULED' && !dep.done && !i.done) expect(i.day >= dep.day, i.title).toBe(true);
    }
    expect(cur.events[0].action).toBe('ADJUSTED');
    // a second adjustment with nothing new to do changes nothing
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/adjust`, { asOf: TODAY }, h)).json.changes).toEqual([]);
  });

  it('pulls the next activities forward when work is done ahead of its day', async () => {
    const h = await signIn('early');
    const made = await create(goalOf([PHY.paperId], { durationDays: 7, startDay: TODAY }), h);
    const cur = await plan(h);
    const tomorrow = addDays(TODAY, 1);
    const ahead = cur.items.filter((i: { day: string; kind: string }) => i.day === tomorrow) as { id: string }[];
    expect(ahead.length).toBeGreaterThan(0);
    for (const t of ahead) await call('PATCH', `/api/student/plan/${t.id}`, { done: true }, h); // done early
    const res = await call('POST', `/api/student/planner/plans/${made.json.id}/adjust`, { asOf: TODAY }, h);
    expect(res.json.changes.some((c: { reason: string }) => c.reason === 'PULLED_FORWARD')).toBe(true);
    const after = await plan(h);
    expect(after.items.filter((i: { day: string; done: boolean }) => i.day === tomorrow && !i.done).length).toBeGreaterThan(0);
  });

  it('pauses and resumes without losing days, and a shorter day shifts what no longer fits', async () => {
    const h = await signIn('pause');
    const made = await create(goalOf([PHY.paperId, CHE.paperId], { durationDays: 7, startDay: TODAY }), h);
    const before = await plan(h);
    const endBefore = before.plan.endDay;
    const pausedOn = TODAY;
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/pause`, { asOf: pausedOn }, h)).json.status).toBe('PAUSED');
    expect((await plan(h)).plan.status).toBe('PAUSED');
    expect((await call('POST', `/api/student/planner/plans/${made.json.id}/adjust`, { asOf: TODAY }, h)).status).toBe(409); // a paused plan is not adjusted
    // resume two days "later" (the day is the student's own calendar, close to the server's)
    const later = addDays(TODAY, 2);
    const res = await call('POST', `/api/student/planner/plans/${made.json.id}/resume`, { asOf: later }, h);
    expect(res.json).toMatchObject({ status: 'ACTIVE', shiftedDays: 2 });
    const after = await plan(h, later);
    expect(after.plan.endDay).toBe(addDays(endBefore, 2));
    const firstBefore = before.items.filter((i: { done: boolean }) => !i.done).map((i: { id: string; day: string }) => [i.id, i.day]);
    for (const [id, day] of firstBefore as [string, string][]) expect(after.items.find((i: { id: string }) => i.id === id).day).toBe(addDays(day, 2));
    // less time a day: what no longer fits moves later or is deferred, and is listed, not deleted
    const res2 = await call('PATCH', `/api/student/planner/plans/${made.json.id}`, { minutesPerDay: 40, asOf: later }, h);
    expect(res2.status).toBe(200);
    const cur = await plan(h, later);
    expect(cur.plan.minutesPerDay).toBe(40);
    expect(cur.items.length).toBe(before.items.length); // nothing was deleted
    const todayItems = cur.items.filter((i: { day: string; status: string }) => i.day === later && i.status === 'SCHEDULED') as { minutes: number; pinned: boolean; kind: string }[];
    if (!todayItems.some((i) => i.pinned || i.kind === 'MOCK')) expect(todayItems.reduce((n, i) => n + i.minutes, 0)).toBeLessThanOrEqual(40);
    expect((await call('PATCH', `/api/student/planner/plans/${made.json.id}`, { minutesPerDay: 5, asOf: later }, h)).status).toBe(400);
  });

  it('regenerates when the goal changes: done work, own tasks and own moves stay; the rest is rebuilt; the old suggestion is logged', async () => {
    const h = await signIn('regen');
    const made = await create(goalOf([PHY.paperId, CHE.paperId], { durationDays: 14 }), h);
    const cur = await plan(h);
    const items = cur.items as { id: string; kind: string; day: string }[];
    const doneItem = items[0]!;
    await call('PATCH', `/api/student/plan/${doneItem.id}`, { done: true }, h);
    const mine = (await call('POST', '/api/student/plan', { day: addDays(TODAY, 3), kind: 'CUSTOM', title: 'My own note', planId: made.json.id }, h)).json.id;
    const moved = items.find((i) => i.kind === 'PRACTICE' && i.day > TODAY)!;
    await call('PATCH', `/api/student/plan/${moved.id}`, { day: addDays(moved.day, 1) }, h);
    const res = await call('POST', `/api/student/planner/plans/${made.json.id}/regenerate`, { asOf: TODAY, durationDays: 7, objectives: ['DEEP_CONCEPTS'], paperIds: [PHY.paperId], labs }, h);
    expect(res.status, JSON.stringify(res.json).slice(0, 300)).toBe(200);
    expect(res.json.version).toBe(2);
    const after = await plan(h);
    expect(after.plan).toMatchObject({ version: 2, durationDays: 7 });
    expect(after.plan.goal.paperIds).toEqual([PHY.paperId]);
    const ids = new Set(after.items.map((i: { id: string }) => i.id));
    expect(ids.has(doneItem.id)).toBe(true);
    expect(ids.has(mine)).toBe(true);
    expect(ids.has(moved.id)).toBe(true);
    expect(after.items.some((i: { kind: string }) => i.kind === 'LAB')).toBe(true); // the deep objective now brings a practical lab
    expect(after.items.every((i: { subjectCode: string | null; origin: string; id: string }) => i.origin !== 'EXPERT' || i.subjectCode === '322' || !ids.has(i.id) || i.id === doneItem.id || i.id === moved.id)).toBe(true);
    const ev = (await env.DB.prepare(`SELECT action, detail_json FROM study_plan_events WHERE plan_id = ? AND action = 'REGENERATED'`).bind(made.json.id).first<{ action: string; detail_json: string }>())!;
    expect(JSON.parse(ev.detail_json).from.version).toBe(1);
    // the new original is what the builder just suggested, so "removed" counts only against it
    expect(after.removed.every((r: { suggestionKey: string }) => r.suggestionKey.startsWith('v2.'))).toBe(true);
  });

  it('notices what the student has actually done on the platform, and leaves practice scores alone', async () => {
    const h = await signIn('activity');
    const made = await create(goalOf([PHY.paperId], { durationDays: 7, objectives: ['LEARN_BASICS'], startDay: TODAY }), h);
    const progressBefore = (await call('GET', '/api/student/progress', undefined, h)).json;
    let cur = await plan(h);
    const lesson = cur.items.find((i: { kind: string }) => i.kind === 'LESSON') as { id: string; refId: string };
    expect((await call('POST', '/api/student/activity', { kind: 'LESSON_VIEW', resourceId: lesson.refId }, h)).status).toBe(200);
    cur = await plan(h);
    expect(cur.items.find((i: { id: string }) => i.id === lesson.id)).toMatchObject({ done: true, doneBy: 'ACTIVITY' });
    expect(cur.progress.detected).toBe(1);
    // a practice set on a topic, answered and submitted, completes its practice item
    const practice = cur.items.find((i: { kind: string }) => i.kind === 'PRACTICE') as { id: string; refId: string; targetCount: number };
    const s = (await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: practice.refId, count: 5 }, h)).json;
    for (const q of s.questions as { id: string }[]) await call('POST', `/api/student/practice/${s.session.id}/answers`, { questionId: q.id, selectedPositions: [2] }, h);
    await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    cur = await plan(h);
    expect(cur.items.find((i: { id: string }) => i.id === practice.id)).toMatchObject({ done: true, doneBy: 'ACTIVITY' });
    // progress is exactly what the practice made it: the planner wrote nothing to it
    const progressAfter = (await call('GET', '/api/student/progress', undefined, h)).json;
    expect(progressAfter.totals.sessions).toBe(progressBefore.totals.sessions + 1);
    expect(progressAfter.totals.answered).toBe(5);
    expect(made.status).toBe(201);
  });

  it('personalises from the student\'s own results: weak topics come first, marked as personal evidence', async () => {
    const h = await signIn('weak');
    const topic = PHY.topics[1]!;
    for (let k = 0; k < 2; k++) {
      const s = (await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeId: topic.id, count: 5 }, h)).json;
      for (const q of s.questions as { id: string }[]) await call('POST', `/api/student/practice/${s.session.id}/answers`, { questionId: q.id, selectedPositions: [3] }, h); // wrong
      await call('POST', `/api/student/practice/${s.session.id}/submit`, {}, h);
    }
    await call('POST', '/api/student/activity', { kind: 'TOPIC_VIEW', nodeId: topic.id }, h);
    const pv = (await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId], { objectives: ['WEAK_TOPICS'], durationDays: 7 }), h)).json.plan;
    const first = pv.items[0];
    expect(first).toMatchObject({ refId: topic.id, evidence: 'PERSONAL' });
    expect(first.note).toMatch(/0% over 10 answers/);
    // a student with no results gets an honest message instead of an invented weakness
    const fresh = await signIn('fresh');
    const none = (await call('POST', '/api/student/planner/preview', goalOf([PHY.paperId], { objectives: ['WEAK_TOPICS'], durationDays: 7 }), fresh));
    expect(none.status).toBe(200);
    expect(none.json.plan.items).toEqual([]);
    expect(none.json.plan.warnings.join(' ')).toMatch(/no weak topics are recorded yet|Nothing could be planned/);
    // and it cannot be saved as a plan
    expect((await create(goalOf([PHY.paperId], { objectives: ['WEAK_TOPICS'], durationDays: 7 }), fresh)).status).toBe(422);
  });

  it('replacing a running plan keeps what was done and what the student added, and removes only the suggestions still to come', async () => {
    const h = await signIn('replace');
    const first = await create(goalOf([PHY.paperId], { durationDays: 7 }), h);
    const cur = await plan(h);
    const doneItem = cur.items[0] as { id: string };
    await call('PATCH', `/api/student/plan/${doneItem.id}`, { done: true }, h);
    const own = (await call('POST', '/api/student/plan', { day: addDays(TODAY, 2), kind: 'CUSTOM', title: 'Own task', planId: first.json.id }, h)).json.id;
    const second = await create(goalOf([CHE.paperId], { durationDays: 14 }), h, { replace: true });
    expect(second.status).toBe(201);
    const left = (await env.DB.prepare('SELECT id FROM study_plan_items WHERE plan_id = ?').bind(first.json.id).all<{ id: string }>()).results.map((r) => r.id);
    expect(left).toEqual(expect.arrayContaining([doneItem.id, own]));
    expect(left.length).toBe(2);
    expect((await env.DB.prepare('SELECT status FROM study_plans WHERE id = ?').bind(first.json.id).first<{ status: string }>())!.status).toBe('ARCHIVED');
    expect((await plan(h)).plan.id).toBe(second.json.id);
  });
});

describe('the adjuster (pure)', () => {
  const plan = { startDay: '2026-12-01', endDay: '2026-12-07', capacityOf: () => 60 };
  const it_ = (id: string, day: string, minutes: number, over: Partial<AdaptItem> = {}): AdaptItem => ({ id, day, minutes, kind: 'LESSON', done: false, pinned: false, status: 'SCHEDULED', dependsOnId: null, position: 0, ...over });

  it('moves a missed item to the first day with room, in order of importance', () => {
    const { items, changes } = adaptSchedule([it_('a', '2026-12-01', 30, { kind: 'REVISE' }), it_('b', '2026-12-01', 30, { kind: 'LESSON', position: 1 }), it_('c', '2026-12-03', 40)], plan, '2026-12-03');
    // 12-03 already holds 40 of its 60 minutes, so neither 30-minute item fits there; both go to 12-04, the lesson placed first
    expect(items.find((i) => i.id === 'b')!.day).toBe('2026-12-04');
    expect(items.find((i) => i.id === 'a')!.day).toBe('2026-12-04');
    expect(items.find((i) => i.id === 'b')!.position).toBeLessThan(items.find((i) => i.id === 'a')!.position);
    expect(changes.map((c) => c.reason)).toEqual(['MISSED', 'MISSED']);
  });
  it('never moves done or pinned work, and defers what cannot fit before the end', () => {
    const full = [it_('d', '2026-12-01', 30, { done: true }), it_('p', '2026-12-01', 30, { pinned: true }), ...['3', '4', '5', '6', '7'].map((n) => it_(`x${n}`, `2026-12-0${n}`, 60)), it_('m', '2026-12-02', 30)];
    const { items } = adaptSchedule(full, plan, '2026-12-03');
    expect(items.find((i) => i.id === 'd')!.day).toBe('2026-12-01');
    expect(items.find((i) => i.id === 'p')!.day).toBe('2026-12-01');
    const m = items.find((i) => i.id === 'm')!;
    expect(m.status).toBe('DEFERRED');
    expect(m.day).toBe('2026-12-07');
  });
  it('keeps a follow-up after the work it follows', () => {
    const { items } = adaptSchedule([it_('learn', '2026-12-01', 30), it_('practice', '2026-12-02', 20, { kind: 'PRACTICE', dependsOnId: 'learn' })], plan, '2026-12-04');
    const l = items.find((i) => i.id === 'learn')!.day;
    const p = items.find((i) => i.id === 'practice')!.day;
    expect(p >= l).toBe(true);
  });
});
