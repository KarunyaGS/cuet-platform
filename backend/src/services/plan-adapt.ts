/**
 * Adjusting a running plan: what moves when the student misses a target, finishes early, or changes the time they have each day.
 *
 * Pure and deterministic. It never touches what a student has done or chosen:
 *  - an item that is done is never moved;
 *  - an item the student moved or edited (`pinned`) is never moved again;
 *  - the student's own days of study are respected: nothing is placed on a day that is already full, and nothing is placed before the
 *    activity it follows.
 * What cannot fit before the plan ends is DEFERRED (kept, listed, and offered back to the student), never deleted.
 */

export interface AdaptItem {
  id: string;
  day: string;
  minutes: number;
  kind: string;
  done: boolean;
  pinned: boolean;
  status: 'SCHEDULED' | 'DEFERRED';
  /** The id of the item this one must come after. */
  dependsOnId: string | null;
  position: number;
}
export interface AdaptPlan { startDay: string; endDay: string; capacityOf: (day: string) => number }
export type Change = { id: string; from: string; to: string; status: 'SCHEDULED' | 'DEFERRED'; reason: 'MISSED' | 'OVER_TIME' | 'PULLED_FORWARD' | 'RESTORED' };

/** How much an item matters when something must give way: smaller is kept longer. */
const KEEP: Record<string, number> = { LESSON: 0, TOPIC: 0, MOCK: 0, CHECKPOINT: 0, PRACTICE: 1, REVIEW: 2, REVISE: 3, LAB: 4, CUSTOM: 2 };
const keep = (kind: string) => KEEP[kind] ?? 2;

export function addDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

export function adaptSchedule(items: AdaptItem[], plan: AdaptPlan, today: string): { items: AdaptItem[]; changes: Change[] } {
  const live = items.map((i) => ({ ...i }));
  const byId = new Map(live.map((i) => [i.id, i]));
  const changes: Change[] = [];
  // An item that moves goes to the end of its new day, in the order it was moved.
  let moved = 1000;
  const record = (i: AdaptItem, from: string, fromStatus: string, reason: Change['reason']) => {
    if (i.day !== from || i.status !== fromStatus) changes.push({ id: i.id, from, to: i.day, status: i.status, reason });
  };
  // An item done before its day was done early: its time is already spent, so it no longer occupies that day.
  const used = (day: string, except?: AdaptItem) => live.filter((x) => x !== except && x.day === day && x.status === 'SCHEDULED' && !(x.done && day > today)).reduce((n, x) => n + x.minutes, 0);
  const room = (day: string, minutes: number, except?: AdaptItem) => plan.capacityOf(day) - used(day, except) >= minutes;
  const earliest = (i: AdaptItem) => {
    const dep = i.dependsOnId ? byId.get(i.dependsOnId) : undefined;
    const after = dep && dep.status === 'SCHEDULED' ? dep.day : today;
    return after > today ? after : today;
  };
  const find = (i: AdaptItem, fromDay: string): string | null => {
    for (let d = fromDay; d <= plan.endDay; d = addDay(d, 1)) if (room(d, i.minutes, i)) return d;
    return null;
  };

  // 1. missed: not done, scheduled before today
  const missed = live
    .filter((i) => !i.done && !i.pinned && i.status === 'SCHEDULED' && i.day < today)
    .sort((a, b) => keep(a.kind) - keep(b.kind) || a.day.localeCompare(b.day) || a.position - b.position || a.id.localeCompare(b.id));
  for (const i of missed) {
    const from = i.day;
    const to = find(i, earliest(i));
    if (to) i.day = to;
    else { i.status = 'DEFERRED'; i.day = plan.endDay; }
    i.position = moved++;
    record(i, from, 'SCHEDULED', 'MISSED');
  }

  // 1b. when work moved later, whatever follows it must not be left on an earlier day
  for (let pass = 0; pass < 6; pass++) {
    let again = false;
    for (const i of live.filter((x) => !x.done && !x.pinned && x.status === 'SCHEDULED' && x.dependsOnId).sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id))) {
      const dep = byId.get(i.dependsOnId!);
      if (!dep || dep.status !== 'SCHEDULED' || dep.done || i.day >= dep.day) continue;
      const from = i.day;
      const to = find(i, dep.day);
      if (to) i.day = to;
      else { i.status = 'DEFERRED'; i.day = plan.endDay; }
      i.position = moved++;
      record(i, from, 'SCHEDULED', 'MISSED');
      again = true;
    }
    if (!again) break;
  }

  // 2. a day with more than its time: the least important unpinned, not-done items move to a later day with room, or are deferred
  for (let d = today > plan.startDay ? today : plan.startDay; d <= plan.endDay; d = addDay(d, 1)) {
    let guard = 0;
    while (used(d) > plan.capacityOf(d) && guard++ < 60) {
      const movable = live
        .filter((x) => x.day === d && x.status === 'SCHEDULED' && !x.done && !x.pinned && x.kind !== 'MOCK')
        .sort((a, b) => keep(b.kind) - keep(a.kind) || b.position - a.position || b.id.localeCompare(a.id));
      const i = movable[0];
      if (!i) break;
      const from = i.day;
      const to = find(i, addDay(d, 1));
      if (to) i.day = to;
      else { i.status = 'DEFERRED'; i.day = plan.endDay; }
      i.position = moved++;
      record(i, from, 'SCHEDULED', 'OVER_TIME');
    }
  }

  // 3. finished early: work done before its day frees that day, so the next activities come forward to fill it
  const first = today > plan.startDay ? today : plan.startDay;
  const eligible = (i: AdaptItem) => i.status === 'SCHEDULED' && !i.done && !i.pinned && i.kind !== 'MOCK' && i.kind !== 'CHECKPOINT';
  for (let d = first; d <= plan.endDay; d = addDay(d, 1)) {
    const freed = live.some((i) => i.day === d && i.done && d > today);
    if (!(freed || (d === today && live.filter((i) => i.day === d && i.status === 'SCHEDULED').length === 0))) continue;
    const later = live.filter((i) => i.day > d && eligible(i)).sort((a, b) => a.day.localeCompare(b.day) || a.position - b.position || a.id.localeCompare(b.id));
    for (const i of later) {
      const dep = i.dependsOnId ? byId.get(i.dependsOnId) : undefined;
      if (dep && !dep.done && !(dep.status === 'SCHEDULED' && dep.day <= d)) continue;
      if (!room(d, i.minutes, i)) continue;
      const from = i.day;
      i.day = d;
      i.position = moved++;
      record(i, from, 'SCHEDULED', 'PULLED_FORWARD');
    }
  }

  // positions inside a day follow their order after the changes
  const days = [...new Set(live.map((i) => i.day))];
  for (const d of days) live.filter((i) => i.day === d).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).forEach((i, k) => { i.position = k; });
  return { items: live, changes };
}
