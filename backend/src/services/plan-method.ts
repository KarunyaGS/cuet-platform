/**
 * The study-plan method: every choice, number and template the plan builder uses, in one place.
 *
 * Nothing here is a fact about the CUET syllabus or about past papers. These are study-method settings (how many days apart to revise, how
 * long a day's checkpoint takes, how a 7-day plan differs from a 30-day plan). They are written by the product team from common study practice
 * and have NOT yet been reviewed by an academic expert, so `METHOD_REVIEW` says so and the student is told. When an academic reviewer has
 * approved them, change `status` to 'APPROVED' and set `reviewedBy`/`reviewedOn`; the screens then drop the "under review" note.
 *
 * What is sourced:
 *  - the order of topics: the official syllabus order held in the curriculum (nothing is reordered or invented);
 *  - the exam pace: 50 questions in 60 minutes, from the NTA exam rules stored for the cycle (1.2 minutes a question);
 *  - the student's own results and activity;
 *  - historical question frequency: only from verified mappings of official past papers, and only when the sample is large enough.
 */

export const GENERATOR_VERSION = 'plan-1';

export const METHOD_REVIEW: { status: 'PENDING_ACADEMIC_REVIEW' | 'APPROVED'; reviewedBy: string | null; reviewedOn: string | null; note: string } = {
  status: 'PENDING_ACADEMIC_REVIEW',
  reviewedBy: null,
  reviewedOn: null,
  note: 'The study method (revision spacing, checkpoint days, session lengths) is a draft written by the product team and has not yet been reviewed by an academic expert. The topics, their order, your results and any past-paper trends are not part of that draft: they come from the syllabus and from verified data.',
};

export const DURATIONS = [
  { days: 7, id: 'WEEKLY', label: 'Weekly plan', blurb: '7 days' },
  { days: 14, id: 'BIWEEKLY', label: 'Biweekly plan', blurb: '14 days' },
  { days: 30, id: 'MONTHLY', label: 'Monthly plan', blurb: '30 days' },
] as const;
export type DurationDays = 7 | 14 | 30;

export const PATHS = [
  { id: 'COMPLETE_EXAM', label: 'Complete preparation', blurb: 'Cover your subjects across the syllabus, with practice and tests', objectives: ['FULL_COVERAGE', 'CHAPTER_PRACTICE', 'MOCK_TESTS'] },
  { id: 'SUBJECT_SPECIFIC', label: 'Subject-specific preparation', blurb: 'One subject, studied properly', objectives: ['DEEP_CONCEPTS', 'CHAPTER_PRACTICE'] },
  { id: 'COMBINED', label: 'Combined subject preparation', blurb: 'Several subjects together, rotated through the days', objectives: ['FULL_COVERAGE', 'CHAPTER_PRACTICE'] },
  { id: 'GENERAL_IMPROVEMENT', label: 'General academic improvement', blurb: 'Strengthen what is weak, keep the rest warm', objectives: ['WEAK_TOPICS', 'CHAPTER_PRACTICE'] },
  { id: 'REVISION_BEFORE_EXAM', label: 'Revision before an examination', blurb: 'Revise what you have studied and sharpen accuracy', objectives: ['REVISE_STUDIED', 'EXAM_ACCURACY', 'MOCK_TESTS'] },
  { id: 'MOCK_READINESS', label: 'Mock-test and examination readiness', blurb: 'Timed practice, full mock tests and review of mistakes', objectives: ['MOCK_TESTS', 'EXAM_ACCURACY'] },
  { id: 'DEEP_UNDERSTANDING', label: 'Build deeper conceptual understanding', blurb: 'Lessons, practical labs and concept checks', objectives: ['DEEP_CONCEPTS', 'LEARN_BASICS'] },
] as const;
export type PathId = (typeof PATHS)[number]['id'];

export const OBJECTIVES = [
  { id: 'LEARN_BASICS', label: 'Learn from the basics', blurb: 'New topics in syllabus order, with easy practice' },
  { id: 'DEEP_CONCEPTS', label: 'Understand concepts in depth', blurb: 'More time per topic, practical labs where the platform has one' },
  { id: 'PENDING_CHAPTERS', label: 'Complete pending chapters', blurb: 'Only topics you have not opened yet' },
  { id: 'REVISE_STUDIED', label: 'Revise already studied chapters', blurb: 'Only topics you have already opened' },
  { id: 'WEAK_TOPICS', label: 'Improve weak topics', blurb: 'Topics where your accuracy is low' },
  { id: 'CHAPTER_PRACTICE', label: 'Practise chapter-wise questions', blurb: 'Practice after each chapter' },
  { id: 'EXAM_ACCURACY', label: 'Improve examination accuracy', blurb: 'Timed sets, checkpoints and review of mistakes' },
  { id: 'MOCK_TESTS', label: 'Prepare through mock tests', blurb: 'Full-length mock tests, then review' },
  { id: 'FULL_COVERAGE', label: 'Achieve complete syllabus coverage', blurb: 'Work through the syllabus in order' },
] as const;
export type ObjectiveId = (typeof OBJECTIVES)[number]['id'];

export interface DurationTemplate {
  days: DurationDays;
  /** Days after learning a topic on which to revise it (spaced revision). */
  spacedRevisionAfter: number[];
  /** Days of the plan with a checkpoint test per subject on what has been studied so far. */
  checkpointDays: number[];
  /** Days of the plan for a full-length mock test (only when the goal includes mock tests). */
  mockDays: number[];
  /** Days with less time: consolidation, checkpoint and rest. */
  lightDays: number[];
  /** What each stretch of the plan is for, in words. */
  phases: { fromDay: number; toDay: number; focus: string }[];
}

export const TEMPLATES: Record<DurationDays, DurationTemplate> = {
  7: {
    days: 7,
    spacedRevisionAfter: [2],
    checkpointDays: [7],
    mockDays: [6],
    lightDays: [7],
    phases: [
      { fromDay: 1, toDay: 5, focus: 'Learn and practise the selected topics' },
      { fromDay: 6, toDay: 7, focus: 'Test yourself and consolidate' },
    ],
  },
  14: {
    days: 14,
    spacedRevisionAfter: [2, 6],
    checkpointDays: [7, 14],
    mockDays: [10, 13],
    lightDays: [7, 14],
    phases: [
      { fromDay: 1, toDay: 6, focus: 'Learn the first set of topics and practise them' },
      { fromDay: 7, toDay: 7, focus: 'First checkpoint and a lighter day' },
      { fromDay: 8, toDay: 13, focus: 'Continue, revise and attempt mock tests' },
      { fromDay: 14, toDay: 14, focus: 'Final checkpoint and review' },
    ],
  },
  30: {
    days: 30,
    spacedRevisionAfter: [2, 7, 14],
    checkpointDays: [7, 14, 21, 28],
    mockDays: [16, 23, 29],
    lightDays: [7, 14, 21, 28],
    phases: [
      { fromDay: 1, toDay: 14, focus: 'Build: learn topics in order and practise each' },
      { fromDay: 15, toDay: 21, focus: 'Consolidate: revise, practise and attempt the first mock tests' },
      { fromDay: 22, toDay: 28, focus: 'Sharpen: accuracy, mistakes and timed work' },
      { fromDay: 29, toDay: 30, focus: 'Final mock test and review' },
    ],
  },
};

export const SETTINGS = {
  /** NTA: 50 questions in 60 minutes (stored with the exam cycle), so a question takes about this long. */
  minutesPerQuestion: 1.2,
  learnMinutes: { min: 15, max: 60, fallback: 30, perContentBlock: 0.35, base: 5 },
  deepFactor: 1.25,
  reviseMinutes: 15,
  reviewMinutes: 15,
  mockMinutes: 60,
  lightDayFactor: 0.6,
  /** The least time worth scheduling an activity into. */
  smallestActivity: 10,
  /** Questions for the practice after a topic, by how the plan is set. */
  practiceQuestions: { basic: 8, standard: 10, heavy: 15 },
  checkpointQuestions: 15,
  /** A topic counts as weak by the same rule the Progress page uses: at least this many attempts and accuracy under this percentage. */
  weak: { minAttempts: 3, belowPercent: 60 },
  /** How far a spaced revision may slip when its day is full, before it is dropped and reported. */
  maxSlipDays: 2,
  /** A verified past-paper trend is shown only with at least this many verified-mapped questions in the subject, from this many papers. */
  trendMinSample: 30,
  trendMinPapers: 2,
  /** Subjects where the student's accuracy is low get a little more of the time (at most this much more than an even split). */
  weaknessBoost: 0.5,
} as const;

export const MINUTES_BOUNDS = { min: 30, max: 480, fallback: 120 } as const;
