/**
 * Study-plan milestones: the moments worth celebrating on My Progress.
 *
 * Nothing here is invented. Every milestone is calculated from the student's own plan activities (`study_plan_items`) and, for the one
 * "mastery" milestone, from their own practice results (`topic_progress`). A milestone is written once (unique per student and key), shown
 * once, and when several are reached together only the most meaningful one is queued; the rest are kept in the history as SUPERSEDED.
 *
 * Study-plan completion is not admission eligibility, and no wording here says a student is qualified for anything.
 */
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { notFound } from '../lib/errors';

export const PLAN_STEPS = [25, 50, 75, 100] as const;
/** Mastery needs real evidence: at least this many answers on a topic, at this accuracy, on at least this many topics. */
export const MASTERY = { minAnswers: 5, minAccuracy: 0.8, minTopics: 3 } as const;
/** Smallest subject for which "completed 5 of 8 topics" and "learning complete" mean something. */
const MIN_TOPICS_FOR_HALF = 4;
const MIN_LEARN_FOR_DONE = 2;
const MIN_REVISE_FOR_WEEK = 2;

type Kind = 'PLAN_PERCENT' | 'SUBJECT_LEARNED' | 'SUBJECT_HALF' | 'SUBJECT_MASTERY' | 'WEEK_REVISION';
interface Detail { done: number; total: number; percent?: number; threshold?: number; subject?: string; foundation?: boolean; topics?: number; week?: number }
interface Reached { key: string; kind: Kind; subjectCode: string | null; priority: number; detail: Detail }

interface PlanRow { id: string; goal_json: string; evidence_json: string; start_day: string; status: string }
interface ItemRow { kind: string; ref_id: string | null; day: string; done: number; subject_code: string | null; suggestion_key: string | null; depends_on: string | null; status: string }

/** How meaningful a milestone is when several arrive together (higher wins). */
const PRIORITY = { PLAN_100: 100, SUBJECT_MASTERY: 90, PLAN_75: 80, PLAN_50: 70, SUBJECT_LEARNED: 60, PLAN_25: 50, WEEK_REVISION: 40, SUBJECT_HALF: 30 } as const;

const dayNumber = (start: string, day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

/** Pure: which milestones the current state of a plan has reached. */
export function reachedMilestones(plan: { id: string; startDay: string; foundationGoal: boolean; subjectNames: Map<string, string> }, items: ItemRow[], topicAccuracy: Map<string, { attempted: number; correct: number }>): Reached[] {
  const out: Reached[] = [];
  const sched = items.filter((i) => i.status === 'SCHEDULED');
  const done = sched.filter((i) => i.done);
  if (sched.length) {
    for (const t of PLAN_STEPS) {
      if (done.length * 100 >= t * sched.length) out.push({ key: `plan:${plan.id}:pct:${t}`, kind: 'PLAN_PERCENT', subjectCode: null, priority: PRIORITY[`PLAN_${t}`], detail: { done: done.length, total: sched.length, percent: Math.floor((100 * done.length) / sched.length), threshold: t } });
    }
  }
  // A topic is "completed" when its learning activity is done and everything that depends on it (its practice set) is done too.
  const learn = sched.filter((i) => i.kind === 'LESSON' || i.kind === 'TOPIC');
  for (const code of new Set(learn.map((i) => i.subject_code ?? ''))) {
    if (!code) continue;
    const name = plan.subjectNames.get(code) ?? code;
    const mine = learn.filter((i) => i.subject_code === code);
    const topics = mine.map((l) => {
      const followUps = sched.filter((x) => x.depends_on && x.depends_on === l.suggestion_key && x.kind === 'PRACTICE');
      return { learn: l, followUps, complete: Boolean(l.done) && followUps.every((f) => f.done) };
    });
    const complete = topics.filter((t) => t.complete).length;
    const allLearned = mine.length >= MIN_LEARN_FOR_DONE && mine.every((l) => l.done);
    if (allLearned) out.push({ key: `plan:${plan.id}:subject:${code}:learned`, kind: 'SUBJECT_LEARNED', subjectCode: code, priority: PRIORITY.SUBJECT_LEARNED, detail: { done: mine.length, total: mine.length, subject: name, foundation: plan.foundationGoal } });
    if (topics.length >= MIN_TOPICS_FOR_HALF && complete * 2 >= topics.length) out.push({ key: `plan:${plan.id}:subject:${code}:half`, kind: 'SUBJECT_HALF', subjectCode: code, priority: PRIORITY.SUBJECT_HALF, detail: { done: complete, total: topics.length, subject: name } });
    // Mastery: the whole subject is complete AND the student's own answers show strong accuracy on the topics they practised.
    if (complete === topics.length && topics.length >= MIN_TOPICS_FOR_HALF) {
      const evidence = topics.flatMap((t) => t.followUps.map((f) => (f.ref_id ? topicAccuracy.get(f.ref_id) : undefined))).filter((a): a is { attempted: number; correct: number } => !!a && a.attempted >= MASTERY.minAnswers);
      if (evidence.length >= MASTERY.minTopics && evidence.every((a) => a.correct / a.attempted >= MASTERY.minAccuracy)) {
        out.push({ key: `plan:${plan.id}:subject:${code}:mastery`, kind: 'SUBJECT_MASTERY', subjectCode: code, priority: PRIORITY.SUBJECT_MASTERY, detail: { done: complete, total: topics.length, subject: name, topics: evidence.length } });
      }
    }
  }
  // Revision goal of a plan week: every revision session scheduled in that week is done.
  const weeks = new Set(sched.filter((i) => i.kind === 'REVISE').map((i) => Math.ceil(dayNumber(plan.startDay, i.day) / 7)));
  for (const w of weeks) {
    const rev = sched.filter((i) => i.kind === 'REVISE' && Math.ceil(dayNumber(plan.startDay, i.day) / 7) === w);
    if (rev.length >= MIN_REVISE_FOR_WEEK && rev.every((i) => i.done)) out.push({ key: `plan:${plan.id}:week:${w}:revision`, kind: 'WEEK_REVISION', subjectCode: null, priority: PRIORITY.WEEK_REVISION, detail: { done: rev.length, total: rev.length, week: w } });
  }
  return out;
}

/** The words the student sees. Built only from counts and names that were calculated; never claims eligibility, admission or an official result. */
export function milestoneText(kind: string, d: Detail): { heading: string; message: string; figure: string } {
  const figure = `${d.done} of ${d.total} activities done`;
  switch (kind) {
    case 'PLAN_PERCENT': {
      const t = d.threshold ?? 0;
      const message = t === 25 ? "You're building momentum! You've completed 25% of your study goal."
        : t === 50 ? "You're halfway there! You've completed half of your expert study plan. Keep going!"
        : t === 75 ? "Almost there! You've completed 75% of your preparation goal."
        : "You did it! You've completed your study plan. Your dedication brought you here.";
      return { heading: t === 100 ? 'Plan complete' : t === 50 ? 'Halfway there' : t === 75 ? 'Almost there' : 'Building momentum', message, figure };
    }
    case 'SUBJECT_LEARNED':
      return { heading: `${d.subject}: learning complete`, message: d.foundation ? `You've completed the foundation stage for ${d.subject}: every topic you planned to learn is done.` : `You've completed the learning activities planned for ${d.subject}.`, figure: `${d.done} of ${d.total} topics learned` };
    case 'SUBJECT_HALF':
      return { heading: `${d.subject}: halfway`, message: `You've completed ${d.done} out of ${d.total} topics in ${d.subject}.`, figure: `${d.done} of ${d.total} topics` };
    case 'SUBJECT_MASTERY':
      return { heading: `${d.subject}: strong results`, message: `You've mastered the topics in your ${d.subject} plan: you finished every one, and your own practice answers are at 80% or better on the ${d.topics} topics you practised.`, figure: `${d.done} of ${d.total} topics, 80%+ accuracy` };
    case 'WEEK_REVISION':
      return { heading: 'Revision goal complete', message: `Your revision goal for week ${d.week ?? 1} of your plan is complete.`, figure: `${d.done} of ${d.total} revision sessions` };
    default:
      return { heading: 'Milestone reached', message: 'You reached a milestone in your study plan.', figure };
  }
}

interface MilestoneRow { id: string; plan_id: string; kind: string; subject_code: string | null; detail_json: string; status: string; reached_at: string }

const view = (m: MilestoneRow, plan: { done: number; total: number } | null) => {
  const detail = JSON.parse(m.detail_json) as Detail;
  const text = milestoneText(m.kind, detail);
  return { id: m.id, kind: m.kind, subjectCode: m.subject_code, ...text, done: detail.done, total: detail.total, percent: plan && plan.total ? Math.floor((100 * plan.done) / plan.total) : null, planDone: plan?.done ?? null, planTotal: plan?.total ?? null, reachedAt: m.reached_at };
};

/** Records any milestone newly reached and queues the single most meaningful unseen one. Safe to call as often as you like: it never duplicates. */
export async function detectMilestones(db: D1Database, userId: string) {
  const plan = await db.prepare(`SELECT id, goal_json, evidence_json, start_day, status FROM study_plans WHERE user_id = ? AND status IN ('ACTIVE','PAUSED','COMPLETED') ORDER BY created_at DESC LIMIT 1`).bind(userId).first<PlanRow>();
  if (!plan) return { planId: null as string | null, done: 0, total: 0 };
  const items = (await db.prepare('SELECT kind, ref_id, day, done, subject_code, suggestion_key, depends_on, status FROM study_plan_items WHERE plan_id = ? AND user_id = ?').bind(plan.id, userId).all<ItemRow>()).results;
  const sched = items.filter((i) => i.status === 'SCHEDULED');
  const totals = { planId: plan.id as string | null, done: sched.filter((i) => i.done).length, total: sched.length };
  const goal = JSON.parse(plan.goal_json) as { objectives?: string[] };
  const summary = (JSON.parse(plan.evidence_json) as { summary?: { subjects?: { code: string; name: string }[] } }).summary;
  const subjectNames = new Map((summary?.subjects ?? []).map((s) => [s.code, s.name]));
  const practiceNodes = [...new Set(items.filter((i) => i.kind === 'PRACTICE' && i.ref_id).map((i) => i.ref_id!))];
  const accuracy = new Map<string, { attempted: number; correct: number }>();
  for (let k = 0; k < practiceNodes.length; k += 50) {
    const chunk = practiceNodes.slice(k, k + 50);
    const rows = (await db.prepare(`SELECT curriculum_node_id AS id, attempted, correct FROM topic_progress WHERE user_id = ? AND curriculum_node_id IN (${chunk.map(() => '?').join(',')})`).bind(userId, ...chunk).all<{ id: string; attempted: number; correct: number }>()).results;
    for (const r of rows) accuracy.set(r.id, { attempted: r.attempted, correct: r.correct });
  }
  const reached = reachedMilestones({ id: plan.id, startDay: plan.start_day, foundationGoal: (goal.objectives ?? []).includes('LEARN_BASICS'), subjectNames }, items, accuracy);
  const known = new Set((await db.prepare('SELECT milestone_key FROM plan_milestones WHERE user_id = ? AND plan_id = ?').bind(userId, plan.id).all<{ milestone_key: string }>()).results.map((r) => r.milestone_key));
  const fresh = reached.filter((r) => !known.has(r.key));
  const now = nowIso();
  if (fresh.length) {
    await db.batch(fresh.map((r) => db.prepare(`INSERT OR IGNORE INTO plan_milestones (id, user_id, plan_id, milestone_key, kind, subject_code, priority, detail_json, status, reached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`).bind(newId('ms'), userId, plan.id, r.key, r.kind, r.subjectCode, r.priority, JSON.stringify(r.detail), now)));
    // Reached together (or while another is still waiting): keep the most meaningful, newest first; the others stay in the history.
    const pending = (await db.prepare(`SELECT id FROM plan_milestones WHERE user_id = ? AND status = 'PENDING' ORDER BY priority DESC, reached_at DESC, id DESC`).bind(userId).all<{ id: string }>()).results;
    if (pending.length > 1) await db.batch(pending.slice(1).map((p) => db.prepare(`UPDATE plan_milestones SET status = 'SUPERSEDED' WHERE id = ? AND user_id = ?`).bind(p.id, userId)));
  }
  return totals;
}

/** What My Progress asks for: the one celebration waiting, if any, plus how far the plan has come. */
export async function pendingMilestone(db: D1Database, userId: string) {
  const totals = await detectMilestones(db, userId);
  const m = await db.prepare(`SELECT id, plan_id, kind, subject_code, detail_json, status, reached_at FROM plan_milestones WHERE user_id = ? AND status = 'PENDING' ORDER BY priority DESC, reached_at DESC LIMIT 1`).bind(userId).first<MilestoneRow>();
  const hist = (await db.prepare(`SELECT id, plan_id, kind, subject_code, detail_json, status, reached_at FROM plan_milestones WHERE user_id = ? ORDER BY reached_at DESC, priority DESC LIMIT 12`).bind(userId).all<MilestoneRow>()).results;
  const plan = totals.planId ? { done: totals.done, total: totals.total } : null;
  return { pending: m ? view(m, plan) : null, history: hist.map((h) => ({ ...view(h, plan), status: h.status })) };
}

/** The student has seen it (it is on screen) or dismissed it with Continue. Either way it is not queued again. */
export async function markMilestone(db: D1Database, userId: string, id: string, action: 'SHOWN' | 'DISMISSED') {
  const now = nowIso();
  const r = action === 'SHOWN'
    ? await db.prepare(`UPDATE plan_milestones SET status = 'SHOWN', shown_at = ? WHERE id = ? AND user_id = ? AND status = 'PENDING'`).bind(now, id, userId).run()
    : await db.prepare(`UPDATE plan_milestones SET status = 'DISMISSED', dismissed_at = ?, shown_at = COALESCE(shown_at, ?) WHERE id = ? AND user_id = ? AND status IN ('PENDING','SHOWN')`).bind(now, now, id, userId).run();
  if (!r.meta.changes) {
    const exists = await db.prepare('SELECT status FROM plan_milestones WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (!exists) throw notFound('Milestone');
  }
  return { ok: true };
}
