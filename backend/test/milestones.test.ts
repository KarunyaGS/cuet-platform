import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { MASTERY, milestoneText, reachedMilestones } from '../src/services/milestones';

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function signIn(tag: string) {
  const email = `ms-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: 'Milestone Student' });
  const ctx = createExecutionContext();
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  return { h: { 'content-type': 'application/json', cookie: res.headers.get('set-cookie')!.split(';')[0]! }, userId: user!.id };
}

const now = new Date().toISOString();
async function seedPlan(userId: string, planId: string, objectives: string[], items: { id: string; kind: string; day: string; subject: string; key: string; dep?: string | null; ref?: string | null }[]) {
  await env.DB.prepare(`INSERT INTO study_plans (id, user_id, title, exam_code, duration_days, start_day, end_day, minutes_per_day, goal_json, original_json, evidence_json, generator_version, status, light_days_json, version, created_at, updated_at) VALUES (?, ?, 'Plan', 'CUET_UG', 14, '2026-11-01', '2026-11-14', 120, ?, '{}', ?, 't', 'ACTIVE', '[]', 1, ?, ?)`)
    .bind(planId, userId, JSON.stringify({ objectives }), JSON.stringify({ summary: { subjects: [{ code: 'BIO', name: 'Biology' }, { code: 'MAT', name: 'Mathematics' }] } }), now, now).run();
  await env.DB.batch(items.map((i) => env.DB.prepare(`INSERT INTO study_plan_items (id, user_id, day, kind, ref_id, title, done, created_at, updated_at, plan_id, origin, suggestion_key, depends_on, subject_code, minutes, status) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'PLAN', ?, ?, ?, 20, 'SCHEDULED')`).bind(i.id, userId, i.day, i.kind, i.ref ?? null, `${i.kind} ${i.id}`, now, now, planId, i.key, i.dep ?? null, i.subject)));
}
const tick = (userId: string, ids: string[]) => env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE study_plan_items SET done = 1 WHERE id = ? AND user_id = ?').bind(id, userId)));

/** 8 activities: 4 topics of Biology, each a lesson plus a practice set that depends on it. */
const bio = (n: number) => Array.from({ length: n }, (_, k) => [
  { id: `l${k}`, kind: 'LESSON', day: '2026-11-0' + (k + 1), subject: 'BIO', key: `v1.L${k}` },
  { id: `p${k}`, kind: 'PRACTICE', day: '2026-11-0' + (k + 1), subject: 'BIO', key: `v1.P${k}`, dep: `v1.L${k}`, ref: `node${k}` },
]).flat();

describe('milestone rules (pure)', () => {
  const names = new Map([['BIO', 'Biology']]);
  const row = (id: string, kind: string, day: string, done: boolean, o: Record<string, unknown> = {}) => ({ kind, ref_id: null, day, done: done ? 1 : 0, subject_code: 'BIO', suggestion_key: `k.${id}`, depends_on: null, status: 'SCHEDULED', ...o });
  const reach = (items: ReturnType<typeof row>[], acc = new Map<string, { attempted: number; correct: number }>(), foundation = false) => reachedMilestones({ id: 'p', startDay: '2026-11-01', foundationGoal: foundation, subjectNames: names }, items, acc);

  it('reaches 25, 50, 75 and 100 per cent exactly when that share of the plan is done, never earlier', () => {
    const mk = (done: number) => Array.from({ length: 8 }, (_, i) => row(String(i), 'CUSTOM', '2026-11-02', i < done, { subject_code: null }));
    const steps = (done: number) => reach(mk(done)).filter((r) => r.kind === 'PLAN_PERCENT').map((r) => r.detail.threshold);
    expect(steps(1)).toEqual([]); // 12.5%
    expect(steps(2)).toEqual([25]);
    expect(steps(4)).toEqual([25, 50]);
    expect(steps(5)).toEqual([25, 50]); // 62.5%
    expect(steps(6)).toEqual([25, 50, 75]);
    expect(steps(8)).toEqual([25, 50, 75, 100]);
  });

  it('does not count deferred (unscheduled) activities toward the total', () => {
    const items = [row('a', 'CUSTOM', '2026-11-02', true), row('b', 'CUSTOM', '2026-11-02', false, { status: 'DEFERRED' })];
    expect(reach(items).filter((r) => r.kind === 'PLAN_PERCENT').map((r) => r.detail.threshold)).toEqual([25, 50, 75, 100]);
  });

  it('a topic is complete only when its lesson and the practice that depends on it are done; small subjects get no "half" milestone', () => {
    const topics = (n: number, doneTopics: number) => Array.from({ length: n }, (_, k) => [row(`l${k}`, 'LESSON', '2026-11-02', k < doneTopics), row(`p${k}`, 'PRACTICE', '2026-11-02', k < doneTopics, { depends_on: `k.l${k}`, ref_id: `n${k}` })]).flat();
    expect(reach(topics(3, 3)).some((r) => r.kind === 'SUBJECT_HALF')).toBe(false);
    expect(reach(topics(8, 3)).some((r) => r.kind === 'SUBJECT_HALF')).toBe(false);
    const half = reach(topics(8, 4)).find((r) => r.kind === 'SUBJECT_HALF');
    expect(half?.detail).toMatchObject({ done: 4, total: 8, subject: 'Biology' });
    expect(milestoneText('SUBJECT_HALF', half!.detail).message).toBe("You've completed 4 out of 8 topics in Biology.");
    // lesson opened but its practice not done: not complete
    const items = topics(4, 4).map((i) => (i.kind === 'PRACTICE' && i.suggestion_key === 'k.p0' ? { ...i, done: 0 } : i));
    expect(reach(items).some((r) => r.kind === 'SUBJECT_HALF')).toBe(true); // 3 of 4 complete is still half or more
    expect(reach(items).find((r) => r.kind === 'SUBJECT_HALF')?.detail.done).toBe(3);
  });

  it('"foundation" wording only when the goal is to learn from the basics', () => {
    const items = [row('l1', 'LESSON', '2026-11-02', true), row('l2', 'LESSON', '2026-11-03', true)];
    const f = reach(items, undefined, true).find((r) => r.kind === 'SUBJECT_LEARNED')!;
    const g = reach(items, undefined, false).find((r) => r.kind === 'SUBJECT_LEARNED')!;
    expect(milestoneText(f.kind, f.detail).message).toBe("You've completed the foundation stage for Biology: every topic you planned to learn is done.");
    expect(milestoneText(g.kind, g.detail).message).toBe("You've completed the learning activities planned for Biology.");
    expect(reach([row('l1', 'LESSON', '2026-11-02', true)]).some((r) => r.kind === 'SUBJECT_LEARNED')).toBe(false); // a single lesson is not a stage
  });

  it('mastery needs real practice evidence: enough answers, at least 80%, on enough topics', () => {
    const items = Array.from({ length: 4 }, (_, k) => [row(`l${k}`, 'LESSON', '2026-11-02', true), row(`p${k}`, 'PRACTICE', '2026-11-02', true, { depends_on: `k.l${k}`, ref_id: `n${k}` })]).flat();
    const acc = (a: number, c: number, n = 4) => new Map(Array.from({ length: n }, (_, k) => [`n${k}`, { attempted: a, correct: c }]));
    expect(reach(items).some((r) => r.kind === 'SUBJECT_MASTERY')).toBe(false); // everything done, but no results: never "mastered"
    expect(reach(items, acc(MASTERY.minAnswers - 1, MASTERY.minAnswers - 1)).some((r) => r.kind === 'SUBJECT_MASTERY')).toBe(false); // too few answers
    expect(reach(items, acc(10, 7)).some((r) => r.kind === 'SUBJECT_MASTERY')).toBe(false); // 70%
    expect(reach(items, acc(10, 8, 2)).some((r) => r.kind === 'SUBJECT_MASTERY')).toBe(false); // evidence on only 2 topics
    expect(reach(items, acc(10, 8)).find((r) => r.kind === 'SUBJECT_MASTERY')?.detail).toMatchObject({ subject: 'Biology', topics: 4 });
  });

  it('a week revision goal needs at least two revision sessions in the plan week, all done', () => {
    const rev = (id: string, day: string, done: boolean) => row(id, 'REVISE', day, done, { subject_code: null });
    expect(reach([rev('a', '2026-11-02', true)]).some((r) => r.kind === 'WEEK_REVISION')).toBe(false);
    expect(reach([rev('a', '2026-11-02', true), rev('b', '2026-11-05', false)]).some((r) => r.kind === 'WEEK_REVISION')).toBe(false);
    const w = reach([rev('a', '2026-11-02', true), rev('b', '2026-11-05', true), rev('c', '2026-11-09', false)]).filter((r) => r.kind === 'WEEK_REVISION');
    expect(w.map((r) => r.detail.week)).toEqual([1]);
  });

  it('no wording ever claims eligibility, qualification for admission or an official result', () => {
    const all = [
      ...[25, 50, 75, 100].map((t) => milestoneText('PLAN_PERCENT', { done: 1, total: 4, threshold: t })),
      milestoneText('SUBJECT_LEARNED', { done: 4, total: 4, subject: 'Biology', foundation: true }), milestoneText('SUBJECT_LEARNED', { done: 4, total: 4, subject: 'Biology' }),
      milestoneText('SUBJECT_HALF', { done: 4, total: 8, subject: 'Biology' }), milestoneText('SUBJECT_MASTERY', { done: 4, total: 4, subject: 'Biology', topics: 4 }), milestoneText('WEEK_REVISION', { done: 2, total: 2, week: 1 }),
    ];
    for (const t of all) expect(`${t.heading} ${t.message}`).not.toMatch(/eligib|qualif|admission|admitted|official|university|cut-?off/i);
  });
});

describe('milestone celebrations: queued, shown once, persisted', () => {
  it('is for signed-in students only', async () => {
    expect((await call('GET', '/api/student/milestones')).status).toBe(401);
    expect((await call('POST', '/api/student/milestones/x/dismiss')).status).toBe(401);
  });

  it('a student with no plan has nothing to celebrate', async () => {
    const { h } = await signIn('none');
    expect((await call('GET', '/api/student/milestones', undefined, h)).json).toEqual({ pending: null, history: [] });
  });

  it('queues 25, 50, 75 and 100 per cent one at a time, never shows one twice, and survives reloads', async () => {
    const { h, userId } = await signIn('journey');
    await seedPlan(userId, 'plan_journey', ['CHAPTER_PRACTICE'], Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, kind: 'CUSTOM', day: `2026-11-0${i + 1}`, subject: 'OTHER', key: `v1.C${i}` })));
    const get = async () => (await call('GET', '/api/student/milestones', undefined, h)).json;
    expect((await get()).pending).toBeNull(); // nothing done yet

    await tick(userId, ['c0', 'c1']); // 25%
    let r = await get();
    expect(r.pending).toMatchObject({ kind: 'PLAN_PERCENT', message: "You're building momentum! You've completed 25% of your study goal.", done: 2, total: 8, percent: 25 });
    expect((await get()).pending.id).toBe(r.pending.id); // asking again does not create a second one
    expect((await env.DB.prepare(`SELECT COUNT(*) n FROM plan_milestones WHERE user_id = ?`).bind(userId).first<{ n: number }>())!.n).toBe(1);

    // seen: not queued again, even before Continue is pressed (a reload mid-pop-up must not repeat it)
    expect((await call('POST', `/api/student/milestones/${r.pending.id}/shown`, undefined, h)).status).toBe(200);
    expect((await get()).pending).toBeNull();
    expect((await call('POST', `/api/student/milestones/${r.pending.id}/dismiss`, undefined, h)).json).toEqual({ ok: true });
    expect((await get()).pending).toBeNull();

    await tick(userId, ['c2', 'c3']); // 50%
    r = await get();
    expect(r.pending).toMatchObject({ message: "You're halfway there! You've completed half of your expert study plan. Keep going!", percent: 50 });
    await call('POST', `/api/student/milestones/${r.pending.id}/dismiss`, undefined, h);

    await tick(userId, ['c4', 'c5']); // 75%
    r = await get();
    expect(r.pending.message).toBe("Almost there! You've completed 75% of your preparation goal.");
    await call('POST', `/api/student/milestones/${r.pending.id}/dismiss`, undefined, h);

    await tick(userId, ['c6', 'c7']); // 100%
    r = await get();
    expect(r.pending).toMatchObject({ heading: 'Plan complete', message: "You did it! You've completed your study plan. Your dedication brought you here.", percent: 100 });
    await call('POST', `/api/student/milestones/${r.pending.id}/dismiss`, undefined, h);
    expect((await get()).pending).toBeNull();

    // history: exactly one record per milestone, none duplicated by all those visits
    const hist = (await get()).history;
    expect(hist).toHaveLength(4);
    expect(hist.every((x: { status: string }) => x.status === 'DISMISSED')).toBe(true);
    expect((await env.DB.prepare(`SELECT COUNT(DISTINCT milestone_key) d, COUNT(*) n FROM plan_milestones WHERE user_id = ?`).bind(userId).first<{ d: number; n: number }>())).toEqual({ d: 4, n: 4 });
  });

  it('when several are reached together only the most meaningful is queued; the rest stay in the history', async () => {
    const { h, userId } = await signIn('together');
    await seedPlan(userId, 'plan_together', ['LEARN_BASICS'], bio(4));
    await tick(userId, bio(4).map((i) => i.id)); // 100% of everything at once: 25/50/75/100, learned, half
    const r = (await call('GET', '/api/student/milestones', undefined, h)).json;
    expect(r.pending.kind).toBe('PLAN_PERCENT');
    expect(r.pending.percent).toBe(100);
    const rows = (await env.DB.prepare(`SELECT status, COUNT(*) n FROM plan_milestones WHERE user_id = ? GROUP BY status`).bind(userId).all<{ status: string; n: number }>()).results;
    expect(rows.find((x) => x.status === 'PENDING')?.n).toBe(1);
    expect(rows.find((x) => x.status === 'SUPERSEDED')!.n).toBeGreaterThanOrEqual(5);
    await call('POST', `/api/student/milestones/${r.pending.id}/dismiss`, undefined, h);
    expect((await call('GET', '/api/student/milestones', undefined, h)).json.pending).toBeNull(); // the superseded ones do not come back
  });

  it('records a milestone when a task is ticked, so the moment of reaching it is kept; a later one still appears after an earlier one was dismissed', async () => {
    const { h, userId } = await signIn('tick');
    await seedPlan(userId, 'plan_tick', [], Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, kind: 'CUSTOM', day: `2026-11-0${i + 1}`, subject: 'OTHER', key: `v1.T${i}` })));
    expect((await call('PATCH', '/api/student/plan/t0', { done: true }, h)).status).toBe(200);
    expect((await env.DB.prepare(`SELECT COUNT(*) n FROM plan_milestones WHERE user_id = ? AND status = 'PENDING'`).bind(userId).first<{ n: number }>())!.n).toBe(1); // recorded at the tick, shown later
    const first = (await call('GET', '/api/student/milestones', undefined, h)).json.pending;
    expect(first.percent).toBe(25);
    await call('POST', `/api/student/milestones/${first.id}/dismiss`, undefined, h);
    await call('PATCH', '/api/student/plan/t1', { done: true }, h);
    expect((await call('GET', '/api/student/milestones', undefined, h)).json.pending.percent).toBe(50);
  });

  it('a milestone can only be marked by its owner; unticking a task does not take a reached milestone away', async () => {
    const a = await signIn('owner');
    const b = await signIn('other');
    await seedPlan(a.userId, 'plan_owner', [], [{ id: 'o0', kind: 'CUSTOM', day: '2026-11-01', subject: 'OTHER', key: 'v1.O0' }]);
    await tick(a.userId, ['o0']);
    const m = (await call('GET', '/api/student/milestones', undefined, a.h)).json.pending;
    expect((await call('POST', `/api/student/milestones/${m.id}/dismiss`, undefined, b.h)).status).toBe(404);
    expect((await call('GET', '/api/student/milestones', undefined, b.h)).json).toEqual({ pending: null, history: [] });
    await env.DB.prepare('UPDATE study_plan_items SET done = 0 WHERE id = ?').bind('o0').run();
    expect((await call('GET', '/api/student/milestones', undefined, a.h)).json.history.length).toBeGreaterThan(0);
  });
});
