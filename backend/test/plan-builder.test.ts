import { describe, expect, it } from 'vitest';
import { buildPlan, effectiveObjectives, type GoalInput, type LabInfo, type StudentState, type SubjectInfo, type TrendInfo } from '../src/services/plan-builder';
import { METHOD_REVIEW, SETTINGS } from '../src/services/plan-method';

function subject(code: string, name: string, topics: number, opts: { lessons?: boolean; questions?: number; mock?: number } = {}): SubjectInfo {
  return {
    paperId: `paper_${code}`, code, name, fullMockQuestions: opts.mock ?? 200,
    topics: Array.from({ length: topics }, (_, i) => ({
      nodeId: `${code}_t${i + 1}`, unitNodeId: `${code}_u${Math.floor(i / 3) + 1}`, unitTitle: `${name} Unit ${Math.floor(i / 3) + 1}`, title: `${name} topic ${i + 1}`, order: i,
      lessonIds: opts.lessons === false ? [] : [`${code}_l${i + 1}`], lessonTitles: opts.lessons === false ? [] : [`${name} lesson ${i + 1} (chapter)`], contentBlocks: 10 + (i % 4) * 5, questionCount: opts.questions ?? 40,
    })),
  };
}
const PHY = subject('322', 'Physics', 12);
const CHE = subject('306', 'Chemistry', 10);
const BIO = subject('304', 'Biology', 8);
const EMPTY: StudentState = { topics: {} };
const goal = (over: Partial<GoalInput> = {}): GoalInput => ({ path: 'COMBINED', objectives: [], durationDays: 14, minutesPerDay: 120, coverage: 'STANDARD', startDay: '2026-12-01', ...over });
const by = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, T[]>>((m, x) => ((m[f(x)] ??= []).push(x), m), {});

describe('plan builder: structure and invariants', () => {
  const out = buildPlan(goal(), [PHY, CHE, BIO], EMPTY, []);

  it('is deterministic: the same inputs give exactly the same plan', () => {
    expect(JSON.stringify(buildPlan(goal(), [PHY, CHE, BIO], EMPTY, []))).toBe(JSON.stringify(out));
  });

  it('never puts more on a day than its time, and says so on the day', () => {
    for (const d of out.days) {
      const sum = out.items.filter((i) => i.day === d.day).reduce((n, i) => n + i.minutes, 0);
      expect(sum).toBe(d.minutes);
      expect(sum, `day ${d.day}`).toBeLessThanOrEqual(d.capacity);
    }
  });

  it('puts every follow-up after the learning it follows, and the learning in syllabus order', () => {
    const dayOf = new Map(out.items.map((i) => [i.key, i.day]));
    for (const i of out.items) if (i.dependsOn) expect(i.day, `${i.title} (${i.kind})`).toBeGreaterThanOrEqual(dayOf.get(i.dependsOn)!);
    for (const code of ['322', '306', '304']) {
      const learns = out.items.filter((i) => i.subjectCode === code && (i.kind === 'LESSON' || i.kind === 'TOPIC'));
      const orders = learns.map((i) => Number(i.title.match(/topic (\d+)/)![1]));
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('rotates through the subjects instead of finishing one first', () => {
    const subjectsByDay = Object.values(by(out.items.filter((i) => i.kind === 'LESSON'), (i) => String(i.day))).map((xs) => new Set(xs.map((x) => x.subjectCode)).size);
    expect(Math.max(...subjectsByDay)).toBeGreaterThanOrEqual(1);
    const firstWeek = new Set(out.items.filter((i) => i.day <= 4 && i.kind === 'LESSON').map((i) => i.subjectCode));
    expect(firstWeek.size).toBe(3);
  });

  it('every activity says why it is there and what kind of evidence stands behind it', () => {
    for (const i of out.items) {
      expect(i.note.length).toBeGreaterThan(10);
      expect(['PERSONAL', 'SYLLABUS', 'METHOD', 'VERIFIED_TREND']).toContain(i.evidence);
    }
    expect(out.summary.methodReview).toBe(METHOD_REVIEW.status);
  });

  it('is not an equal split of the syllabus: follow-ups, revision and checkpoints are scheduled', () => {
    expect(out.summary.byKind.PRACTICE).toBeGreaterThan(0);
    expect(out.summary.byKind.REVISE).toBeGreaterThan(0);
    expect(out.summary.byKind.CHECKPOINT).toBeGreaterThan(0);
    const learned = out.summary.subjects.reduce((n, s) => n + s.topicsPlanned, 0);
    expect(learned).toBeLessThan(30); // 30 topics exist; a 14-day plan does not pretend to cover them all
    expect(out.summary.subjects.every((s) => s.notReached >= 0)).toBe(true);
  });
});

describe('plan builder: duration changes the workload', () => {
  const BIGPHY = subject('322', 'Physics', 40);
  const BIGCHE = subject('306', 'Chemistry', 40);
  const g7 = buildPlan(goal({ durationDays: 7, path: 'COMPLETE_EXAM' }), [BIGPHY, BIGCHE], EMPTY, []);
  const g14 = buildPlan(goal({ durationDays: 14, path: 'COMPLETE_EXAM' }), [BIGPHY, BIGCHE], EMPTY, []);
  const g30 = buildPlan(goal({ durationDays: 30, path: 'COMPLETE_EXAM' }), [BIGPHY, BIGCHE], EMPTY, []);
  const learned = (p: typeof g7) => p.items.filter((i) => i.kind === 'LESSON').length;
  it('a 30-day plan covers more than a 14-day plan, which covers more than a 7-day plan', () => {
    expect(learned(g7)).toBeLessThan(learned(g14));
    expect(learned(g14)).toBeLessThan(learned(g30));
  });
  it('uses different checkpoint, mock and revision patterns', () => {
    const cp = (p: typeof g7) => p.items.filter((i) => i.kind === 'CHECKPOINT').map((i) => i.day);
    expect(new Set(cp(g7))).toEqual(new Set([7]));
    expect(cp(g14).every((d) => [7, 14].includes(d))).toBe(true);
    expect(new Set(cp(g30))).toEqual(new Set([7, 14, 21, 28]));
    const mocks = (p: typeof g7) => p.items.filter((i) => i.kind === 'MOCK').map((i) => i.day);
    expect(mocks(g7)).toEqual([6]);
    expect(mocks(g14)).toEqual([10, 13]);
    expect(mocks(g30)).toEqual([16, 23, 29]);
    const revisions = (p: typeof g7) => p.items.filter((i) => i.kind === 'REVISE').length;
    expect(revisions(g30) / learned(g30)).toBeGreaterThan(revisions(g7) / Math.max(1, learned(g7)));
  });
  it('light days hold less, and the 30-day plan has its phases in words', () => {
    expect(g30.days.filter((d) => d.light).map((d) => d.day)).toEqual([7, 14, 21, 28]);
    expect(g30.days.find((d) => d.day === 7)!.capacity).toBe(Math.round(120 * SETTINGS.lightDayFactor));
    expect(g30.summary.phases).toHaveLength(4);
    expect(g7.summary.phases).toHaveLength(2);
  });
  it('a mock test is followed by its review on the next day, and comes with its own paper', () => {
    const mock = g14.items.find((i) => i.kind === 'MOCK')!;
    const review = g14.items.find((i) => i.kind === 'REVIEW' && i.dependsOn === mock.key)!;
    expect(review.day).toBe(mock.day + 1);
    expect(mock.refId).toMatch(/^paper_/);
  });
});

describe('plan builder: objectives', () => {
  const opened = (n: number, code: string): StudentState['topics'] => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${code}_t${i + 1}`, { opened: true, attempted: 0, correct: 0, incorrect: 0, labDone: false }]));
  const state: StudentState = {
    topics: {
      ...opened(4, '322'),
      '322_t2': { opened: true, attempted: 10, correct: 3, incorrect: 7, labDone: false }, // weak: 30%
      '322_t3': { opened: true, attempted: 10, correct: 9, incorrect: 1, labDone: false }, // strong
      '322_t4': { opened: true, attempted: 2, correct: 0, incorrect: 2, labDone: false }, // too few answers to call weak
    },
  };
  const topicsOf = (p: ReturnType<typeof buildPlan>, kinds: string[]) => [...new Set(p.items.filter((i) => kinds.includes(i.kind) && i.subjectCode === '322').map((i) => i.refId))];

  it('pending chapters: only topics not opened yet, in syllabus order', () => {
    const p = buildPlan(goal({ objectives: ['PENDING_CHAPTERS'] }), [PHY], state, []);
    const learns = p.items.filter((i) => i.kind === 'LESSON').map((i) => i.title);
    expect(learns[0]).toBe('Learn: Physics topic 5');
    expect(learns.some((t) => /topic [1-4]$/.test(t))).toBe(false);
  });

  it('revise studied chapters: only topics already opened, the weak one first', () => {
    const p = buildPlan(goal({ objectives: ['REVISE_STUDIED'] }), [PHY], state, []);
    expect(p.items.filter((i) => i.kind === 'LESSON' || i.kind === 'TOPIC')).toHaveLength(0);
    const first = p.items.find((i) => i.kind === 'REVISE')!;
    expect(first.refId).toBe('322_t2');
    expect(first.evidence).toBe('PERSONAL');
    expect(first.note).toMatch(/30% over 10 answers/);
    expect(topicsOf(p, ['REVISE']).every((t) => ['322_t1', '322_t2', '322_t3', '322_t4'].includes(String(t)))).toBe(true);
  });

  it('weak topics: uses the Progress rule (at least 3 answers, under 60%), never a topic that is fine or barely measured', () => {
    const p = buildPlan(goal({ objectives: ['WEAK_TOPICS'] }), [PHY], state, []);
    const practised = topicsOf(p, ['REVISE', 'PRACTICE']);
    expect(practised).toContain('322_t2');
    expect(practised).not.toContain('322_t3');
    expect(p.warnings.join(' ')).not.toMatch(/no weak topics are recorded/);
    const practice = p.items.find((i) => i.kind === 'PRACTICE' && i.refId === '322_t2')!;
    expect(practice.targetCount).toBe(SETTINGS.practiceQuestions.heavy);
    expect(practice.evidence).toBe('PERSONAL');
  });

  it('weak topics with nothing recorded yet says so, and practises opened topics to measure them', () => {
    const p = buildPlan(goal({ objectives: ['WEAK_TOPICS'] }), [PHY], { topics: opened(3, '322') }, []);
    expect(p.warnings.join(' ')).toMatch(/no weak topics are recorded yet/);
    expect(p.items.some((i) => i.kind === 'PRACTICE')).toBe(true);
    const none = buildPlan(goal({ objectives: ['WEAK_TOPICS'] }), [PHY], EMPTY, []);
    expect(none.items).toHaveLength(0);
    expect(none.warnings.join(' ')).toMatch(/Nothing could be planned/);
  });

  it('mock-test readiness: mock tests and review, no new learning', () => {
    const p = buildPlan(goal({ path: 'MOCK_READINESS', durationDays: 14 }), [PHY, CHE], state, []);
    expect(p.items.filter((i) => i.kind === 'LESSON' || i.kind === 'TOPIC')).toHaveLength(0);
    expect(p.items.filter((i) => i.kind === 'MOCK').length).toBeGreaterThan(0);
    expect(p.items.filter((i) => i.kind === 'REVIEW').length).toBeGreaterThan(0);
  });

  it('mock tests are skipped for a subject with too few questions', () => {
    const thin = { ...PHY, fullMockQuestions: 10 };
    const p = buildPlan(goal({ path: 'MOCK_READINESS', durationDays: 14 }), [thin], state, []);
    expect(p.items.filter((i) => i.kind === 'MOCK')).toHaveLength(0);
  });

  it('deep understanding adds a practical lab where the platform has one, and more time per topic', () => {
    const labs: LabInfo[] = [{ id: 'phys-capacitors', subject: 'Physics', lessonTitleStartsWith: 'Physics lesson 1 (', title: 'Capacitors', minutes: 25 }];
    const deep = buildPlan(goal({ objectives: ['DEEP_CONCEPTS'], path: 'SUBJECT_SPECIFIC' }), [PHY], EMPTY, labs);
    const lab = deep.items.find((i) => i.kind === 'LAB')!;
    expect(lab).toMatchObject({ refId: 'phys-capacitors', minutes: 25 });
    expect(deep.items.find((i) => i.key === lab.dependsOn)!.refId).toBe('322_l1');
    const plain = buildPlan(goal({ objectives: ['LEARN_BASICS'] }), [PHY], EMPTY, labs);
    expect(plain.items.some((i) => i.kind === 'LAB')).toBe(false);
    expect(deep.items.find((i) => i.kind === 'LESSON')!.minutes).toBeGreaterThan(plain.items.find((i) => i.kind === 'LESSON')!.minutes);
    // a lab already completed is not suggested again
    const done = buildPlan(goal({ objectives: ['DEEP_CONCEPTS'] }), [PHY], { topics: { '322_t1': { opened: false, attempted: 0, correct: 0, incorrect: 0, labDone: true } } }, labs);
    expect(done.items.some((i) => i.kind === 'LAB')).toBe(false);
  });

  it('a path with no objectives chosen uses that path\'s own objectives; chosen objectives replace them', () => {
    expect(effectiveObjectives('REVISION_BEFORE_EXAM', [])).toEqual(['REVISE_STUDIED', 'EXAM_ACCURACY', 'MOCK_TESTS']);
    expect(effectiveObjectives('REVISION_BEFORE_EXAM', ['WEAK_TOPICS'])).toEqual(['WEAK_TOPICS']);
  });

  it('a topic with no lesson links to the topic page, and one with too few questions gets no practice', () => {
    const bare = subject('999', 'Bare', 3, { lessons: false, questions: 2 });
    const p = buildPlan(goal({ objectives: ['LEARN_BASICS'] }), [bare], EMPTY, []);
    expect(p.items.find((i) => i.title.startsWith('Learn:'))).toMatchObject({ kind: 'TOPIC', refId: '999_t1' });
    expect(p.items.some((i) => i.kind === 'PRACTICE')).toBe(false);
  });
});

describe('plan builder: time shares, evidence and honesty', () => {
  it('gives a little more time to a subject where accuracy is low, never an equal split by rote', () => {
    const state: StudentState = { topics: Object.fromEntries(PHY.topics.slice(0, 6).map((t) => [t.nodeId, { opened: true, attempted: 10, correct: 3, incorrect: 7, labDone: false }])) };
    state.topics = { ...state.topics, ...Object.fromEntries(CHE.topics.slice(0, 6).map((t) => [t.nodeId, { opened: true, attempted: 10, correct: 9, incorrect: 1, labDone: false }])) };
    const p = buildPlan(goal({ durationDays: 30, objectives: ['FULL_COVERAGE'] }), [PHY, CHE], state, []);
    const phy = p.summary.subjects.find((s) => s.code === '322')!;
    const che = p.summary.subjects.find((s) => s.code === '306')!;
    expect(phy.accuracy).toBe(30);
    expect(che.accuracy).toBe(90);
    expect(phy.minutes).toBeGreaterThan(che.minutes);
    expect(p.summary.usedPersonalData).toBe(true);
  });

  it('a verified past-paper trend is shown only with enough verified data, and labelled as history', () => {
    const t: TrendInfo = { nodeId: '322_t1', frequency: 4, sampleSize: 80, paperCount: 3, years: [2024, 2025, 2026] };
    const used = buildPlan(goal({ objectives: ['LEARN_BASICS'] }), [PHY], EMPTY, [], [t]);
    const item = used.items.find((i) => i.refId === '322_l1')!;
    expect(item.evidence).toBe('VERIFIED_TREND');
    expect(item.note).toMatch(/4 of 80 verified questions \(3 papers, 2024, 2025, 2026\).*not a prediction/);
    expect(used.summary.trends.used).toBe(true);
    const thin = buildPlan(goal({ objectives: ['LEARN_BASICS'] }), [PHY], EMPTY, [], [{ ...t, sampleSize: 12 }, { nodeId: '322_t2', frequency: 3, sampleSize: 200, paperCount: 1, years: [2026] }]);
    expect(thin.items.some((i) => i.evidence === 'VERIFIED_TREND')).toBe(false);
    expect(thin.summary.trends.used).toBe(false);
    // an order never changes because of a trend: it is still the syllabus order
    const orders = used.items.filter((i) => i.kind === 'LESSON').map((i) => Number(i.title.match(/(\d+)$/)![1]));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('light coverage practises less and revises less than full coverage', () => {
    const light = buildPlan(goal({ coverage: 'LIGHT', durationDays: 14 }), [PHY], EMPTY, []);
    const full = buildPlan(goal({ coverage: 'FULL', durationDays: 14 }), [PHY], EMPTY, []);
    const q = (p: typeof light) => p.items.filter((i) => i.kind === 'PRACTICE').reduce((n, i) => n + (i.targetCount ?? 0), 0) / Math.max(1, p.items.filter((i) => i.kind === 'PRACTICE').length);
    expect(q(light)).toBeLessThan(q(full));
  });

  it('a subject with no topics is reported, not invented', () => {
    const none: SubjectInfo = { paperId: 'paper_x', code: '000', name: 'Nothing', topics: [], fullMockQuestions: 0 };
    const p = buildPlan(goal(), [PHY, none], EMPTY, []);
    expect(p.warnings.join(' ')).toMatch(/Nothing: the syllabus has no topics/);
    expect(p.items.every((i) => i.subjectCode !== '000')).toBe(true);
  });

  it('a short day still holds the mock test, which is the one item allowed to exceed the day', () => {
    const p = buildPlan(goal({ path: 'MOCK_READINESS', minutesPerDay: 45 }), [PHY], { topics: { '322_t1': { opened: true, attempted: 0, correct: 0, incorrect: 0, labDone: false } } }, []);
    const mock = p.items.find((i) => i.kind === 'MOCK')!;
    expect(mock.minutes).toBe(60);
    for (const d of p.days) if (!p.items.some((i) => i.day === d.day && i.kind === 'MOCK')) expect(d.minutes).toBeLessThanOrEqual(d.capacity);
  });
});
