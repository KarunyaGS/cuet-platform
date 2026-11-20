/**
 * The study-plan builder: a pure, deterministic function from (goal, syllabus, the student's own results, labs, verified trends) to a plan.
 *
 * No database, no clock, no randomness, no outside service: the same inputs always give the same plan. Everything it knows comes in as
 * arguments, which is also what makes it testable.
 *
 * How a plan is made (all numbers are in `plan-method.ts`):
 *  1. The student's objectives decide which topics are worked on: topics not yet opened (in the official syllabus order, which is the only
 *     prerequisite order the platform holds), topics already opened (for revision), and weak topics (the Progress page's own rule).
 *  2. The days' time is shared between the chosen subjects, with a little more for a subject where the student's accuracy is lower.
 *  3. Each day is filled in a fixed order: a mock test on mock days, checkpoints on checkpoint days, the follow-ups that are due (practice after
 *     learning, spaced revision, review of mistakes), then the next learning, rotating between subjects by who is furthest behind their share.
 *  4. A follow-up never comes before the learning it follows, a day never holds more than its time (a mock test aside), and anything that
 *     cannot fit is reported, not silently dropped.
 *  5. Every activity says why it is there and what kind of evidence stands behind it: the student's own results, the syllabus order, the study
 *     method, or a verified past-paper trend. A trend is shown only when the verified sample is large enough.
 */
import { DURATIONS, METHOD_REVIEW, OBJECTIVES, PATHS, SETTINGS, TEMPLATES, type DurationDays, type ObjectiveId, type PathId } from './plan-method';

// ---------------------------------------------------------------- inputs

export interface TopicInfo {
  nodeId: string;
  unitNodeId: string | null;
  unitTitle: string | null;
  title: string;
  /** Position in the official syllabus order within the subject (0 is first). */
  order: number;
  lessonIds: string[];
  lessonTitles: string[];
  contentBlocks: number;
  questionCount: number;
}
export interface SubjectInfo { paperId: string; code: string; name: string; topics: TopicInfo[]; fullMockQuestions: number }
export interface TopicState { opened: boolean; attempted: number; correct: number; incorrect: number; labDone: boolean }
export interface StudentState { topics: Record<string, TopicState> }
export interface LabInfo { id: string; subject: string; lessonTitleStartsWith: string; title: string; minutes: number }
export interface TrendInfo { nodeId: string; frequency: number; sampleSize: number; paperCount: number; years: number[] }
export type Coverage = 'LIGHT' | 'STANDARD' | 'FULL';
export interface GoalInput {
  path: PathId;
  objectives: ObjectiveId[];
  durationDays: DurationDays;
  minutesPerDay: number;
  coverage: Coverage;
  /** Local date of day 1, YYYY-MM-DD. */
  startDay: string;
}

// ---------------------------------------------------------------- outputs

export type ItemKind = 'LESSON' | 'TOPIC' | 'REVISE' | 'PRACTICE' | 'LAB' | 'CHECKPOINT' | 'MOCK' | 'REVIEW';
export type Evidence = 'PERSONAL' | 'SYLLABUS' | 'METHOD' | 'VERIFIED_TREND';
export interface BuiltItem {
  key: string;
  day: number;
  date: string;
  kind: ItemKind;
  /** TOPIC and REVISE and PRACTICE and CHECKPOINT: a syllabus node. LESSON: a lesson. MOCK and REVIEW: a paper. LAB: a lab id. */
  refId: string | null;
  subjectCode: string | null;
  title: string;
  minutes: number;
  targetCount: number | null;
  note: string;
  evidence: Evidence;
  dependsOn: string | null;
  position: number;
}
export interface DayInfo { day: number; date: string; capacity: number; minutes: number; light: boolean }
export interface SubjectSummary {
  code: string; name: string; topicsInSyllabus: number; topicsPlanned: number; minutes: number; sharePercent: number;
  firstTopic: string | null; lastTopic: string | null; accuracy: number | null; attempted: number; weakTopics: number; notReached: number;
}
export interface PlanOut {
  items: BuiltItem[];
  days: DayInfo[];
  summary: {
    durationDays: DurationDays; minutesPerDay: number; totalMinutes: number; byKind: Record<string, number>; subjects: SubjectSummary[];
    objectives: ObjectiveId[]; phases: { fromDay: number; toDay: number; focus: string }[]; usedPersonalData: boolean;
    trends: { used: boolean; topics: number; note: string };
    methodReview: typeof METHOD_REVIEW.status;
  };
  warnings: string[];
}

// ---------------------------------------------------------------- date helpers (no clock)

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return t.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- helpers

const WORK_MODES = ['NEW', 'REVISE', 'WEAK', 'PRACTISE'] as const;
type Mode = (typeof WORK_MODES)[number];
interface Work { topic: TopicInfo; mode: Mode }
interface Flags { learnNew: boolean; reviseStudied: boolean; weak: boolean; deep: boolean; mock: boolean; accuracy: boolean; practiceHeavy: boolean; basics: boolean; practiceOnly: boolean }

export function effectiveObjectives(path: PathId, chosen: ObjectiveId[]): ObjectiveId[] {
  const known = new Set<string>(OBJECTIVES.map((o) => o.id));
  const picked = [...new Set(chosen)].filter((o) => known.has(o)) as ObjectiveId[];
  if (picked.length) return OBJECTIVES.map((o) => o.id).filter((o) => picked.includes(o));
  const p = PATHS.find((x) => x.id === path);
  return (p?.objectives ?? ['FULL_COVERAGE']) as ObjectiveId[];
}

function flagsOf(objectives: ObjectiveId[]): Flags {
  const has = (o: ObjectiveId) => objectives.includes(o);
  const learnNew = has('LEARN_BASICS') || has('DEEP_CONCEPTS') || has('PENDING_CHAPTERS') || has('FULL_COVERAGE');
  const reviseStudied = has('REVISE_STUDIED') || has('FULL_COVERAGE');
  const weak = has('WEAK_TOPICS');
  const practiceOnly = !learnNew && !reviseStudied && !weak && (has('MOCK_TESTS') || has('EXAM_ACCURACY')) && !has('CHAPTER_PRACTICE');
  return {
    // With only chapter practice chosen, new topics are still learned before they are practised.
    learnNew: learnNew || (!reviseStudied && !weak && !practiceOnly),
    reviseStudied, weak, deep: has('DEEP_CONCEPTS'), mock: has('MOCK_TESTS'), accuracy: has('EXAM_ACCURACY'),
    practiceHeavy: has('CHAPTER_PRACTICE') || has('EXAM_ACCURACY'), basics: has('LEARN_BASICS'), practiceOnly,
  };
}

const accuracyOf = (s: TopicState | undefined) => (s && s.attempted > 0 ? (100 * s.correct) / s.attempted : null);
const isWeak = (s: TopicState | undefined) => Boolean(s && s.attempted >= SETTINGS.weak.minAttempts && (100 * s.correct) / s.attempted < SETTINGS.weak.belowPercent);

function learnMinutes(t: TopicInfo, deep: boolean): number {
  const L = SETTINGS.learnMinutes;
  const base = t.contentBlocks > 0 ? Math.round(L.base + t.contentBlocks * L.perContentBlock) : L.fallback;
  const clamped = Math.min(L.max, Math.max(L.min, base));
  return Math.round(clamped * (deep ? SETTINGS.deepFactor : 1));
}
const practiceMinutes = (n: number) => Math.ceil(n * SETTINGS.minutesPerQuestion);

function labFor(topic: TopicInfo, subjectName: string, labs: LabInfo[]): LabInfo | null {
  const subject = subjectName.toLowerCase();
  return labs.find((l) => subject.startsWith(l.subject.toLowerCase()) && topic.lessonTitles.some((t) => t.startsWith(l.lessonTitleStartsWith))) ?? null;
}

// ---------------------------------------------------------------- the builder

interface Pending { item: Omit<BuiltItem, 'day' | 'date' | 'position'>; due: number; slip: number; priority: number; subjectIndex: number }

export function buildPlan(goal: GoalInput, subjects: SubjectInfo[], state: StudentState, labs: LabInfo[], trends: TrendInfo[] = []): PlanOut {
  const tpl = TEMPLATES[goal.durationDays];
  const days = goal.durationDays;
  const objectives = effectiveObjectives(goal.path, goal.objectives);
  const flags = flagsOf(objectives);
  const warnings: string[] = [];
  const trendByNode = new Map(trends.map((t) => [t.nodeId, t]));
  const practiceQ = Math.max(5, Math.round((flags.basics ? SETTINGS.practiceQuestions.basic : flags.practiceHeavy ? SETTINGS.practiceQuestions.heavy : SETTINGS.practiceQuestions.standard) * (goal.coverage === 'LIGHT' ? 0.6 : goal.coverage === 'FULL' ? 1.5 : 1)));
  const revisionDays = goal.coverage === 'LIGHT' ? tpl.spacedRevisionAfter.slice(0, 1) : tpl.spacedRevisionAfter;

  const dayInfos: DayInfo[] = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const light = tpl.lightDays.includes(day);
    return { day, date: addDays(goal.startDay, i), capacity: Math.round(goal.minutesPerDay * (light ? SETTINGS.lightDayFactor : 1)), minutes: 0, light };
  });

  // Per-subject queues of work, in a fixed order.
  const subj = subjects.map((s, index) => {
    const topics = [...s.topics].sort((a, b) => a.order - b.order || a.nodeId.localeCompare(b.nodeId));
    const st = (t: TopicInfo) => state.topics[t.nodeId];
    const weak = topics.filter((t) => isWeak(st(t))).sort((a, b) => (accuracyOf(st(a)) ?? 0) - (accuracyOf(st(b)) ?? 0) || a.order - b.order);
    const unopened = topics.filter((t) => !st(t)?.opened);
    const opened = topics.filter((t) => st(t)?.opened);
    const attempted = topics.reduce((n, t) => n + (st(t)?.attempted ?? 0), 0);
    const correct = topics.reduce((n, t) => n + (st(t)?.correct ?? 0), 0);
    const accuracy = attempted >= 10 ? Math.round((1000 * correct) / attempted) / 10 : null;

    const weakSet = new Set(weak.map((t) => t.nodeId));
    const primary: Work[] = [];
    if (flags.learnNew) primary.push(...unopened.map((t) => ({ topic: t, mode: 'NEW' as const })));
    if (flags.reviseStudied) {
      const sorted = [...opened].sort((a, b) => Number(weakSet.has(b.nodeId)) - Number(weakSet.has(a.nodeId)) || (accuracyOf(st(a)) ?? 50) - (accuracyOf(st(b)) ?? 50) || a.order - b.order);
      primary.push(...sorted.map((t) => ({ topic: t, mode: 'REVISE' as const })));
    }
    if (flags.practiceOnly) {
      const sorted = [...opened, ...unopened].sort((a, b) => Number(weakSet.has(b.nodeId)) - Number(weakSet.has(a.nodeId)) || (accuracyOf(st(a)) ?? 50) - (accuracyOf(st(b)) ?? 50) || a.order - b.order);
      primary.push(...sorted.map((t) => ({ topic: t, mode: 'PRACTISE' as const })));
    }
    let weakList: Work[] = flags.weak ? weak.map((t) => ({ topic: t, mode: 'WEAK' as const })) : [];
    // A weak-topics goal with no weak topics yet: practise the opened topics that have not been measured, so the next plan has something to go on.
    if (flags.weak && weakList.length === 0) {
      const unmeasured = opened.filter((t) => (st(t)?.attempted ?? 0) < SETTINGS.weak.minAttempts);
      weakList = unmeasured.map((t) => ({ topic: t, mode: 'PRACTISE' as const }));
      warnings.push(`${s.name}: no weak topics are recorded yet (a topic counts as weak after at least ${SETTINGS.weak.minAttempts} answers under ${SETTINGS.weak.belowPercent}%), so the plan practises topics you have opened but not yet measured.`);
    }
    // Weak topics first, then every third place; the rest in syllabus order.
    const queue: Work[] = [];
    const seen = new Set<string>();
    const take = (w: Work | undefined) => { if (w && !seen.has(w.topic.nodeId)) { seen.add(w.topic.nodeId); queue.push(w); } };
    const wl = [...weakList];
    const pl = [...primary];
    let n = 0;
    while (wl.length || pl.length) {
      const fromWeak = wl.length && (n % 3 === 0 || pl.length === 0);
      take(fromWeak ? wl.shift() : pl.shift());
      n++;
    }
    return { info: s, index, topics, queue, accuracy, attempted, weakCount: weak.length, st };
  });

  const items: BuiltItem[] = [];
  const pending: Pending[] = [];
  const studied: { subject: number; topic: TopicInfo }[] = [];
  const planned = new Map<string, Set<string>>();
  const minutesBySubject = subjects.map(() => 0);
  let keySeq = 0;
  const key = (kind: string, code: string, ref: string | null) => `${kind}:${code}:${ref ?? '-'}:${++keySeq}`;
  const dropped: string[] = [];

  // Time shares: even, with a little more for a subject where accuracy is low.
  const weights = subj.map((s) => 1 + (s.accuracy === null ? 0 : SETTINGS.weaknessBoost * (1 - s.accuracy / 100)));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  let cumulative = 0;
  let mockCursor = 0;
  const remainingOf = (d: number) => dayInfos[d - 1]!.capacity - dayInfos[d - 1]!.minutes;
  const place = (d: number, it: Omit<BuiltItem, 'day' | 'date' | 'position'>, allowOver = false): boolean => {
    const info = dayInfos[d - 1];
    if (!info) return false;
    if (!allowOver && it.minutes > info.capacity - info.minutes) return false;
    info.minutes += it.minutes;
    items.push({ ...it, day: d, date: info.date, position: items.filter((x) => x.day === d).length });
    const idx = it.subjectCode ? subj.findIndex((s) => s.info.code === it.subjectCode) : -1;
    if (idx >= 0) minutesBySubject[idx]! += it.minutes;
    return true;
  };
  const markPlanned = (code: string, topic: TopicInfo) => {
    const set = planned.get(code) ?? new Set<string>();
    set.add(topic.nodeId);
    planned.set(code, set);
  };

  /** Schedules the work that follows a topic's main activity: practice, lab, and spaced revision. */
  function followUps(s: (typeof subj)[number], w: Work, mainKey: string, d: number) {
    const code = s.info.code;
    const t = w.topic;
    const common = { subjectCode: code, dependsOn: mainKey, targetCount: null as number | null };
    const weakTopic = w.mode === 'WEAK' || isWeak(s.st(t));
    const qn = weakTopic ? Math.max(practiceQ, SETTINGS.practiceQuestions.heavy) : practiceQ;
    if (t.questionCount >= 5) {
      const n = Math.min(qn, t.questionCount);
      pending.push({
        due: d, slip: 0, priority: 2, subjectIndex: s.index,
        item: { ...common, key: key('PRACTICE', code, t.nodeId), kind: 'PRACTICE', refId: t.nodeId, title: `Practise: ${t.title}`, minutes: practiceMinutes(n), targetCount: n,
          note: weakTopic ? `Your accuracy here is ${Math.round(accuracyOf(s.st(t)) ?? 0)}% over ${s.st(t)?.attempted ?? 0} answers: more practice, then review the explanations.` : 'Practice straight after learning helps you find what did not stick.', evidence: weakTopic ? 'PERSONAL' : 'METHOD' },
      });
    }
    if (flags.deep && w.mode === 'NEW') {
      const lab = labFor(t, s.info.name, labs);
      if (lab && !s.st(t)?.labDone) {
        pending.push({
          due: d, slip: 0, priority: 1, subjectIndex: s.index,
          item: { ...common, key: key('LAB', code, lab.id), kind: 'LAB', refId: lab.id, title: `Practical lab: ${lab.title}`, minutes: lab.minutes, note: 'A hands-on lab for this chapter, for a deeper understanding of the concept.', evidence: 'SYLLABUS' },
        });
      }
    }
    for (const gap of revisionDays) {
      const due = d + gap;
      if (due > days) { dropped.push(`${t.title} (day ${due})`); continue; }
      pending.push({
        due, slip: 0, priority: 3, subjectIndex: s.index,
        item: { ...common, key: key('REVISE', code, t.nodeId), kind: 'REVISE', refId: t.nodeId, title: `Revise: ${t.title}`, minutes: SETTINGS.reviseMinutes,
          note: `Revision ${gap} days after ${w.mode === 'NEW' ? 'learning' : 'the first session'}: spaced revision helps what you learn stay with you.`, evidence: 'METHOD' },
      });
    }
  }

  function trendNote(t: TopicInfo): { text: string; evidence: Evidence } | null {
    const tr = trendByNode.get(t.nodeId);
    if (!tr || tr.frequency < 1 || tr.sampleSize < SETTINGS.trendMinSample || tr.paperCount < SETTINGS.trendMinPapers) return null;
    return { text: ` Verified past-paper trend: ${tr.frequency} of ${tr.sampleSize} verified questions (${tr.paperCount} papers, ${tr.years.join(', ')}) were on this topic. This is history, not a prediction.`, evidence: 'VERIFIED_TREND' };
  }

  /** The next piece of new work for a subject on day d, if it fits. Returns the minutes used, or 0. */
  function startWork(s: (typeof subj)[number], d: number): number {
    const w = s.queue[0];
    if (!w) return 0;
    const t = w.topic;
    const code = s.info.code;
    const trend = trendNote(t);
    let minutes: number;
    let item: Omit<BuiltItem, 'day' | 'date' | 'position'>;
    if (w.mode === 'NEW') {
      minutes = learnMinutes(t, flags.deep);
      const lesson = t.lessonIds[0] ?? null;
      item = {
        key: key(lesson ? 'LESSON' : 'TOPIC', code, lesson ?? t.nodeId), kind: lesson ? 'LESSON' : 'TOPIC', refId: lesson ?? t.nodeId, subjectCode: code, title: `Learn: ${t.title}`, minutes, targetCount: null,
        note: `Next unopened topic in the official ${s.info.name} syllabus order${t.unitTitle ? ` (${t.unitTitle})` : ''}.${trend?.text ?? ''}`, evidence: trend ? 'VERIFIED_TREND' : 'SYLLABUS', dependsOn: null,
      };
    } else if (w.mode === 'PRACTISE') {
      const n = Math.min(Math.max(practiceQ, SETTINGS.practiceQuestions.heavy), t.questionCount);
      if (t.questionCount < 5) { s.queue.shift(); return startWork(s, d); }
      minutes = practiceMinutes(n);
      const acc = accuracyOf(s.st(t));
      item = {
        key: key('PRACTICE', code, t.nodeId), kind: 'PRACTICE', refId: t.nodeId, subjectCode: code, title: `Practise: ${t.title}`, minutes, targetCount: n,
        note: acc === null ? 'You have not answered questions on this topic yet: a first set shows where you stand.' : `Your accuracy here is ${Math.round(acc)}% over ${s.st(t)?.attempted ?? 0} answers.${trend?.text ?? ''}`, evidence: trend ? 'VERIFIED_TREND' : acc === null ? 'METHOD' : 'PERSONAL', dependsOn: null,
      };
    } else {
      minutes = Math.round(SETTINGS.reviseMinutes * (flags.deep ? 1.33 : 1));
      const acc = accuracyOf(s.st(t));
      const weakNow = w.mode === 'WEAK' || isWeak(s.st(t));
      item = {
        key: key('REVISE', code, t.nodeId), kind: 'REVISE', refId: t.nodeId, subjectCode: code, title: `Revise: ${t.title}`, minutes, targetCount: null,
        note: weakNow ? `A weak topic: your accuracy is ${Math.round(acc ?? 0)}% over ${s.st(t)?.attempted ?? 0} answers.${trend?.text ?? ''}` : `You have already opened this topic; revising it keeps it fresh.${trend?.text ?? ''}`,
        evidence: weakNow ? 'PERSONAL' : trend ? 'VERIFIED_TREND' : 'METHOD', dependsOn: null,
      };
    }
    if (!place(d, item)) return 0;
    s.queue.shift();
    markPlanned(code, t);
    studied.push({ subject: s.index, topic: t });
    followUps(s, w, item.key, d);
    return minutes;
  }

  /** Places the follow-ups due on or before day d, in a fixed order; what does not fit slips to the next day or is reported. */
  function drainDue(d: number) {
    const due = pending.filter((p) => p.due <= d).sort((a, b) => a.priority - b.priority || a.subjectIndex - b.subjectIndex || a.item.key.localeCompare(b.item.key, 'en', { numeric: true }));
    for (const p of due) {
      pending.splice(pending.indexOf(p), 1);
      if (place(d, p.item)) continue;
      if (p.slip < SETTINGS.maxSlipDays && d < days) pending.push({ ...p, due: d + 1, slip: p.slip + 1 });
      else dropped.push(`${p.item.title} (day ${p.due})`);
    }
  }

  for (let d = 1; d <= days; d++) {
    const info = dayInfos[d - 1]!;
    cumulative += info.capacity;

    // 1. a full-length mock test on mock days (it needs its 60 minutes, so it may exceed a short day)
    if (flags.mock && tpl.mockDays.includes(d)) {
      for (let tries = 0; tries < subj.length; tries++) {
        const s = subj[mockCursor++ % subj.length]!;
        if (s.info.fullMockQuestions < 30) continue;
        const k = key('MOCK', s.info.code, s.info.paperId);
        place(d, { key: k, kind: 'MOCK', refId: s.info.paperId, subjectCode: s.info.code, title: `Full-length mock test: ${s.info.name}`, minutes: SETTINGS.mockMinutes, targetCount: 50, note: 'Timed like the real paper (50 questions, 60 minutes, +5 / −1). Do it in one sitting.', evidence: 'METHOD', dependsOn: null }, true);
        pending.push({ due: d + 1, slip: 0, priority: 0, subjectIndex: s.index, item: { key: key('REVIEW', s.info.code, s.info.paperId), kind: 'REVIEW', refId: s.info.paperId, subjectCode: s.info.code, title: `Review your mock-test mistakes: ${s.info.name}`, minutes: SETTINGS.reviewMinutes + 5, targetCount: null, note: 'Go through every wrong or skipped answer and its explanation while it is fresh.', evidence: 'METHOD', dependsOn: k } });
        break;
      }
    }

    // 2. checkpoints: a chapter test per subject on what has been studied so far
    const cadence = flags.accuracy && d % 3 === 0 && d < days;
    if (tpl.checkpointDays.includes(d) || cadence) {
      for (const s of subj) {
        const last = [...studied].reverse().find((x) => x.subject === s.index);
        if (!last) continue;
        const n = Math.min(SETTINGS.checkpointQuestions, Math.max(5, last.topic.questionCount));
        if (last.topic.questionCount < 5) continue;
        const k = key('CHECKPOINT', s.info.code, last.topic.unitNodeId ?? last.topic.nodeId);
        const ok = place(d, { key: k, kind: 'CHECKPOINT', refId: last.topic.unitNodeId ?? last.topic.nodeId, subjectCode: s.info.code, title: `Checkpoint: ${last.topic.unitTitle ?? last.topic.title}`, minutes: practiceMinutes(n), targetCount: n, note: `A short timed test on what you have studied so far in ${s.info.name}.`, evidence: 'METHOD', dependsOn: null });
        if (ok && flags.accuracy && d < days) {
          pending.push({ due: d + 1, slip: 0, priority: 0, subjectIndex: s.index, item: { key: key('REVIEW', s.info.code, last.topic.unitNodeId ?? last.topic.nodeId), kind: 'REVIEW', refId: s.info.paperId, subjectCode: s.info.code, title: `Review your checkpoint mistakes: ${s.info.name}`, minutes: SETTINGS.reviewMinutes, targetCount: null, note: 'Read the explanations for what you missed before moving on.', evidence: 'METHOD', dependsOn: k } });
        }
      }
    }

    // 3. follow-ups that are due today (a day that is full pushes them to the next day, up to the allowed slip)
    drainDue(d);

    // 4. new work, rotating by who is furthest behind their share of the time
    for (let guard = 0; guard < 40; guard++) {
      if (remainingOf(d) < SETTINGS.smallestActivity) break;
      const order = subj
        .map((s) => ({ s, deficit: (weights[s.index]! / weightSum) * cumulative - minutesBySubject[s.index]! }))
        .filter((x) => x.s.queue.length > 0)
        .sort((a, b) => b.deficit - a.deficit || a.s.index - b.s.index);
      let used = 0;
      for (const { s } of order) {
        used = startWork(s, d);
        if (used) break;
      }
      if (!used) break;
      // the practice, lab and revision that follow this piece of work may belong to today as well
      drainDue(d);
    }
  }

  // Anything still pending after the last day, or never placed
  for (const p of pending) dropped.push(`${p.item.title} (day ${p.due})`);
  if (dropped.length) warnings.push(`${dropped.length} follow-up ${dropped.length === 1 ? 'activity does' : 'activities do'} not fit in this plan (for example revision that would fall after the last day): ${dropped.slice(0, 4).join('; ')}${dropped.length > 4 ? '…' : ''}.`);

  items.sort((a, b) => a.day - b.day || a.position - b.position);
  items.forEach((it, i, all) => { it.position = all.slice(0, i).filter((x) => x.day === it.day).length; });

  const totalMinutes = items.reduce((n, i) => n + i.minutes, 0);
  const byKind: Record<string, number> = {};
  for (const i of items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
  const subjectSummaries: SubjectSummary[] = subj.map((s) => {
    const set = planned.get(s.info.code) ?? new Set<string>();
    const order = s.topics.filter((t) => set.has(t.nodeId));
    const minutes = minutesBySubject[s.index]!;
    if (s.topics.length === 0) warnings.push(`${s.info.name}: the syllabus has no topics on the platform yet, so nothing can be planned for it.`);
    return {
      code: s.info.code, name: s.info.name, topicsInSyllabus: s.topics.length, topicsPlanned: set.size, minutes, sharePercent: totalMinutes ? Math.round((1000 * minutes) / totalMinutes) / 10 : 0,
      firstTopic: order[0]?.title ?? null, lastTopic: order.at(-1)?.title ?? null, accuracy: s.accuracy, attempted: s.attempted, weakTopics: s.weakCount,
      notReached: Math.max(0, s.topics.filter((t) => (flags.learnNew ? !s.st(t)?.opened : true)).length - set.size),
    };
  });
  if (!items.length) warnings.push('Nothing could be planned from the selected subjects and goals.');
  const trendTopics = items.filter((i) => i.evidence === 'VERIFIED_TREND').length;
  return {
    items, days: dayInfos, warnings,
    summary: {
      durationDays: goal.durationDays, minutesPerDay: goal.minutesPerDay, totalMinutes, byKind, subjects: subjectSummaries, objectives, phases: tpl.phases,
      usedPersonalData: items.some((i) => i.evidence === 'PERSONAL') || subj.some((s) => s.attempted > 0 || s.topics.some((t) => s.st(t)?.opened)),
      trends: { used: trendTopics > 0, topics: trendTopics, note: trendTopics ? 'Some topics carry a past-paper trend from verified data. It describes past papers and does not predict future ones.' : 'No verified past-paper trend is used: there is not enough verified data for these topics yet.' },
      methodReview: METHOD_REVIEW.status,
    },
  };
}

export { DURATIONS };
