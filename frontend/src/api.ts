/** Thin client for the CUET API. Cookies carry the session; nothing secret lives in the browser. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Fired when an API call says the session is missing or expired; the auth provider re-checks and the route guard redirects. */
export const UNAUTHORIZED_EVENT = 'cuet:unauthorized';

/** One standard name per subject on every student screen. Display only: subject codes, slugs and ids are never changed. */
const SUBJECT_NAMES: [string, string][] = [
  ['Biology and Biological Studies and Biotechnology and Biochem', 'Biology'],
  ['Biology/ Biological Science/ Biotechnology /Biochemistry', 'Biology'],
  ['Computer Sciences and Informatics Practices', 'Computer Science'],
  ['Computer Science and Informatics Practices', 'Computer Science'],
  ['Computer Science / Information Practices', 'Computer Science'],
  ['Geography and Geology', 'Geography'],
  ['Geography / Geology', 'Geography'],
  ['Core Mathematics and Applied Mathematics', 'Mathematics'],
  ['Mathematics / Applied Mathematics', 'Mathematics'],
];
export function standardSubjectNames<T>(v: T): T {
  if (typeof v === 'string') {
    if (v === 'General Test') return 'General Aptitude Test' as T;
    let s: string = v;
    for (const [from, to] of SUBJECT_NAMES) if (s.includes(from)) s = s.split(from).join(to);
    return s as T;
  }
  if (Array.isArray(v)) return v.map((x) => standardSubjectNames(x)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, standardSubjectNames(x)])) as T;
  return v;
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: { error?: { code?: string; message?: string } } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response. Please try again.');
  }
  if (!res.ok) {
    // Sign-in, sign-up and session checks report 401 themselves; any other 401 means the session has ended.
    if (res.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? `Request failed (${res.status})`);
  }
  return (path.startsWith('/api/admin') ? data : standardSubjectNames(data)) as T;
}

export interface SupportAttachment { key: string; name: string; mime: string; bytes: number }
export interface SupportMessage { id: string; from: 'YOU' | 'SUPPORT'; body: string; at: string; attachment: { name: string | null; mime: string | null; bytes: number | null } | null }
export interface SupportThread { id: string; kind: 'CHAT' | 'TICKET'; reference: string | null; category: string | null; categoryLabel: string | null; title: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; createdAt: string; updatedAt: string; lastMessageAt: string; hasUnreadReply: boolean }
export interface SupportConversation { thread: SupportThread | null; messages: SupportMessage[] }

export type ExamCode = 'CUET_UG' | 'CUET_PG';
export interface Exam { code: ExamCode; name: string; level: string; year: number; label: string; rules: Record<string, number | string | boolean> }
export interface Subject {
  paperId: string; code: string; name: string; category: { code: string | null; name: string | null };
  available: boolean; preview: boolean; verification: string | null; units: number; sections: number; topics: number; questions: number;
}
export interface OutlineNode { id: string; parent_id: string | null; kind: string; label: string | null; title: string; depth: number; position: number; source_page: number | null; resources: number; questions: number }
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionTypeName = 'MCQ_SINGLE' | 'MCQ_MULTI' | 'ASSERTION_REASON' | 'MATCH_THE_FOLLOWING' | 'STATEMENT_BASED' | 'PASSAGE_BASED' | 'DIAGRAM_BASED' | 'NUMERICAL';
export interface VpaReading { voltage: number; current: number; voltageIndex: number }
export interface VpaReport {
  score: number; maxScore: number; passed: boolean;
  procedure: { score: number; max: number; feedback: string };
  apparatus: { score: number; max: number; feedback: string; connections: string[] };
  measurements: { score: number; max: number; feedback: string; readings: VpaReading[] };
  calculations: { score: number; max: number; feedback: string; expectedResistance: number; submittedResistance: number };
  graph: { score: number; max: number; feedback: string; expectedSlope: number; submittedSlope: number };
  incorrectSteps: string[]; recommendedRevision: string[];
}
export interface VpaAttempt {
  attemptId: string; labId: string; chapterId: string; lessonId: string | null;
  mode: 'GUIDED' | 'INDEPENDENT'; voltageLevels: number[]; status: 'IN_PROGRESS' | 'SUBMITTED';
  readings: VpaReading[]; meterReadings: VpaReading[]; report: VpaReport | null;
}
export interface QuestionCounts { total: number; matching: number; byDifficulty: Record<string, number>; byType: Record<string, number> }
export interface Outline { paper: Record<string, string | number | null>; nodes: OutlineNode[] }
export interface TopicDetail {
  topic: { id: string; kind: string; label: string | null; title: string; body: string | null; sourcePage: number | null; verification: string; preview: boolean };
  paper: { id: string; code: string; name: string; exam: ExamCode } | null;
  source: { title: string | null; url: string | null; page: number | null; pageCount: number | null };
  breadcrumb: { id: string; kind: string; label: string | null; title: string }[];
  children: { id: string; kind: string; label: string | null; title: string; body: string | null; source_page: number | null }[];
  resources: { id: string; type: string; title: string; origin: string; status: string; verification: string }[];
  questionCount: number;
}
export interface StudentTopicWeightage {
  topicId: string; title: string; exam: ExamCode; year: number; subjectCode: string; syllabusVersionId: string; syllabusVersionNumber: number;
  sampleSize: number; paperCount: number; mappedCount: number; frequency: number; mappingCoveragePercent: number; yearCoverage: number[];
  method: string; note: string;
}
export interface Block {
  position: number; type: string; body: string; media_asset_id: string | null; alt_text: string | null; caption: string | null; media_kind: string | null;
  /** Set on a definition, formula, key point, fact or concept: it can be bookmarked and made into a flashcard on its own. */
  conceptKey?: string | null; anchor?: string | null;
}
export interface ResourceDetail {
  resource: { id: string; type: string; title: string; origin: string; verification: string; status: string; preview: boolean; updatedAt?: string };
  topic: { id: string; title: string; kind: string; label: string | null; paper_id: string } | null;
  blocks: Block[];
}
export interface User { id: string; email: string; displayName: string; roles: string[]; emailVerified?: boolean }
export interface Checkout { orderId: string; gateway: 'mock' | 'razorpay'; gatewayOrderId: string | null; amountPaise: number; currency: string; planName: string; durationDays: number; keyId: string | null; status: string }
export interface PlanLimits { mockTests?: number | null; topicTests?: number | null; practiceSets?: number | null }
export interface Access {
  plan: { code: string; name: string; isFree: boolean; features: string[] }; paid: boolean; paidUntil: string | null; usageDays: number;
  limits: { key: string; label: string; limit: number | null; used: number }[];
}
export interface Billing {
  paymentsAvailable: boolean; gateway: 'mock' | 'razorpay' | null; testMode: boolean; access: Access;
  plans: { code: string; name: string; description: string | null; pricePaise: number; currency: string; durationDays: number | null; isFree: boolean; limits: PlanLimits; features: string[] }[];
  payments: { id: string; plan: string; amountPaise: number; currency: string; status: string; reference: string; method: string | null; failureReason: string | null; createdAt: string; paidAt: string | null }[];
  passes: { id: string; plan: string; startsAt: string; endsAt: string; source: string; state: string }[];
}
export interface OfficialLinkItem { id: string; exam: ExamCode; year: number; subjectCode: string | null; subjectName: string | null; session: string | null; kind: 'QUESTION_PAPER' | 'ANSWER_KEY'; available: boolean; url: string | null; title: string; note: string | null; publisher: string; checkedOn: string }
export interface DirectoryYear {
  year: number; papers: number;
  subjects: { code: string; showCode: boolean; name: string; sessions: number; dropped: number; firstDate: string; lastDate: string; papersPublished: number; paperId: string | null }[];
  questionPaper: { status: 'NOT_PUBLISHED' | 'SOME_PUBLISHED'; published: number; note: string | null };
  answerKey: { title: string; publisher: string; checkedOn: string; note: string | null; url: string | null; linkPending: boolean } | null;
}
export interface OfficialDocument {
  id: string; exam: ExamCode; year: number; subjectName: string | null; session: string | null; kind: 'QUESTION_PAPER' | 'ANSWER_KEY'; title: string; publisher: string; checkedOn: string;
  originalUrl: string; viewer: 'DIRECT' | 'PROXY' | 'NEW_TAB'; fileUrl: string | null; reason: string | null;
}
export interface DirectorySession {
  id: string; subjectCode: string; subjectName: string; date: string; shift: string;
  questionPaper: { published: boolean; available: boolean; url: string | null; linkId: string | null; title: string | null; pages: number | null };
  answerKey: { published: boolean; page: number | null; pages: number; title: string | null; url: string | null; linkId: string | null };
  dropped: number;
}
export interface MockPaperCard { id: string; paperId: string; subjectCode: string; subjectName: string; exam: ExamCode; number: number; title: string; questions: number; durationMinutes: number; marksCorrect: number; marksIncorrect: number; difficulty: Record<string, number>; units: number }
export interface PastPaper {
  id: string; exam: ExamCode; year: number; subjectCode: string; subjectName: string; paperId: string | null; examDate: string | null; shift: string | null; language: string; title: string;
  questions: number; dropped: number; questionsInPaper: number; durationMinutes: number; marksCorrect: number; marksIncorrect: number;
}
export interface PastPaperDetail extends PastPaper { source: { title: string; publisher: string; url: string }; answerKey: { title: string; url: string; version: string } | null; permission: string }
export interface EmailSettings { email: string; emailVerified: boolean; emailReminders: boolean; emailNotices: boolean; emailRevision: boolean; examDate: string | null; emailAvailable: boolean }
export interface SessionQuestion {
  number: number; id: string; type: string; stem: string; difficulty: string; preview: boolean; origin: string;
  passage: { title: string | null; body: string } | null; structure: unknown;
  options: { position: number; label: string; text: string; mediaAssetId: string | null; alt?: string | null }[];
  answer: { selectedPositions: number[] | null; numericAnswer: number | null } | null;
  review: { outcome: string; score: number; correctOptionPositions: number[] | null; correctNumericAnswer: number | null; explanation: string | null; optionRationale: Record<string, string> | null } | null;
}
/** The marking scheme kept with an attempt: marks, which bulletin and year it comes from, and the special-case rules. */
export interface MarkingScheme {
  kind: 'CUET_SIMULATION' | 'PRACTICE'; exam: string | null; year: number | null; correct: number; incorrect: number; unattempted: number;
  sourceLabel: string; sourceUrl: string | null; anyCorrectOption: boolean; creditDroppedQuestions: boolean;
}
export interface PracticeSession {
  session: {
    id: string; mode: 'PRACTICE' | 'TOPIC_TEST' | 'MOCK_TEST'; status: string; startedAt: string; durationSeconds: number | null; deadline: string | null;
    marking: { correct: number; incorrect: number };
    /** Null only for attempts made before schemes were stored. */
    scheme: MarkingScheme | null;
    /** Question ids marked for review (kept on the server). */
    marked: string[];
    /** Set when the attempt is a fixed paper: one of our mock papers, or an official previous-year paper. */
    source: { kind: 'MOCK_PAPER' | 'PAST_PAPER'; id: string; title: string } | null;
    result: { score: number; maxScore: number; correct: number; incorrect: number; unattempted: number; credited: number; marked: number; submittedAt: string } | null;
    /** How a finished attempt went by unit and by difficulty, and how long it took. */
    analysis: { timeTakenSeconds: number | null; byUnit: { id: string; title: string; correct: number; incorrect: number; unattempted: number; credited: number; accuracy: number | null }[]; byDifficulty: { difficulty: string; correct: number; incorrect: number; unattempted: number; credited: number; accuracy: number | null }[] } | null;
    /** Why the attempt ended: SUBMITTED, TIME_UP or TERMINATED_<incident>. Null while it is running. */
    endReason: string | null;
    /** Examination mode (mock tests): the rules in force and every incident reported during the attempt. Null for practice. */
    exam: { maxIncidents: number; returnSeconds: number; mergeSeconds: number; incidents: number; violations: { type: string; at: string; recordedAt: string; action: string }[] } | null;
  };
  questions: SessionQuestion[];
}
export interface ExamPreview { mode: 'TOPIC_TEST' | 'MOCK_TEST'; title: string; subject: string | null; questions: number; durationMinutes: number; marking: { correct: number; incorrect: number }; scheme: MarkingScheme; maxMarks: number; policy: { maxIncidents: number; returnSeconds: number; mergeSeconds: number } }
export interface ViolationResult { action: 'WARNED' | 'TERMINATED' | 'MERGED' | 'IGNORED'; incidents: number; ended: boolean; endReason: string | null; policy: ExamPreview['policy'] }
export interface Feedback { outcome?: string; score?: number; correctOptionPositions?: number[] | null; correctNumericAnswer?: number | null; explanation?: string | null; optionRationale?: Record<string, string> | null; saved: boolean }
export interface Progress {
  totals: { sessions: number; correct: number; incorrect: number; unattempted: number; credited: number; answered: number; accuracy: number | null };
  topics: { id: string; title: string; kind: string; paper: string; paper_code: string; attempted: number; correct: number; incorrect: number; accuracy: number; last_attempt_at: string }[];
  weakTopics: Progress['topics'];
  recentSessions: { id: string; mode: string; status: string; score: number | null; max_score: number | null; correct_count: number; incorrect_count: number; unattempted_count: number; started_at: string; paper: string | null }[];
  subjects: SubjectProgress[];
}
export interface SubjectProgress { paper: string; paperCode: string; topics: number; attempted: number; correct: number; accuracy: number | null }
export interface Profile { id: string; email: string; displayName: string; memberSince: string; lastLogin: string | null; testsTaken: number; bookmarks: number }
export type BookmarkKind = 'TOPIC' | 'LESSON' | 'QUESTION' | 'REVISION';
export interface Bookmark { id: string; kind: BookmarkKind; entityId: string; title: string; nodeId: string | null; paper: string | null; createdAt: string }
export type AnnotationKind = 'HIGHLIGHT' | 'PEN' | 'RECT' | 'ELLIPSE' | 'ARROW' | 'LINE' | 'NOTE';
/** A student's own mark on a lesson or a question. `data`: a text range for a highlight, points (fractions of its block) for a drawing. */
export interface Annotation {
  id: string; surfaceKind: 'LESSON' | 'QUESTION'; surfaceId: string; kind: AnnotationKind; blockKey: string; data: unknown; quote: string | null; note: string | null;
  color: string; opacity: number; strokeWidth: number; z: number; orphaned: boolean; originPath: string | null; createdAt: string; updatedAt: string;
}
/** An annotation with where it is, for My bookmarks. */
export interface AnnotationEntry extends Annotation {
  examCode: string | null; paperId: string | null; paper: string | null; unitId: string | null; unit: string | null; unitPosition: number | null;
  chapterId: string | null; chapter: string | null; chapterPosition: number | null; topicId: string | null; topic: string | null;
  resourceId: string | null; lesson: string | null; questionId: string | null; question: string | null;
}
export type CardRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
/** A question card's content, read from the question each time (the card itself stores none of it). */
export interface QuestionCardView {
  type: string; stem: string; difficulty: string; structure: unknown; passage: { title: string | null; body: string } | null;
  options: { position: number; label: string; text: string | null; mediaAssetId: string | null }[];
  correctOptionPositions: number[] | null; correctNumericAnswer: number | null; explanation: string | null; optionRationale: Record<string, string> | null;
  yourAnswer: { selectedPositions: number[] | null; numericAnswer: number | null; outcome: string; answeredAt: string } | null;
}
export interface Flashcard {
  /** CONCEPT: from a lesson. QUESTION: from an attempted practice question. */
  kind: 'CONCEPT' | 'QUESTION'; questionId: string | null; question: QuestionCardView | null;
  id: string; conceptKey: string; resourceId: string; anchor: string; lesson: string; section: string | null; type: string;
  paperId: string | null; paper: string | null; chapterId: string | null; chapter: string | null; chapterPosition: number | null;
  topicId: string | null; topic: string | null; topicPosition: number | null; savedAt: string; status: 'NEW' | 'NEED_REVISION' | 'KNOW';
  front: string; back: string; latex: string | null; mediaAssetId: string | null; draft: boolean;
  dueOn: string; due: boolean; intervalDays: number; reps: number; lapses: number; lastRating: CardRating | null; lastReviewedAt: string | null;
  stage: 'NEW' | 'LEARNING' | 'KNOWN';
}
export interface CardSummary {
  day: string; total: number; due: number; fresh: number; known: number; reviewedToday: number;
  subjects: { paperId: string | null; paper: string; total: number; due: number; known: number; chapters: { chapterId: string | null; chapter: string; total: number; due: number; known: number }[] }[];
}
export interface TopicCards { nodeId: string; title: string; paperId: string; day: string; concepts: number; cards: number; due: number }
export interface CardImport { total: number; added: number; existing: number; notAdded: number; limit: number }
export type ConceptType = 'DEFINITION' | 'FORMULA' | 'KEY_POINT' | 'IMPORTANT_FACT' | 'CONCEPT' | 'FIGURE' | 'COMPARISON';
export interface SheetSection {
  id: string; title: string; practice: { attempted: number; correct: number; accuracy: number } | null;
  definitions: { type: string; body: string }[]; formulas: { type: string; body: string }[]; points: { type: string; body: string }[];
  figures: { mediaAssetId: string; caption: string; alt: string; learn: string | null }[]; tables: { caption: string; columns: string[]; rows: string[][] }[];
}
export interface Sheet { kind: 'CHAPTER' | 'SUBJECT' | 'WEAK'; title: string; paper: string | null; paperId: string | null; draft: boolean; lessons: number; version: string; maxPages: number; sections: SheetSection[]; empty: string | null }
export interface DeckChapter {
  chapterId: string; chapter: string; lessons: number; draft: boolean;
  available: { total: number; definitions: number; formulas: number; concepts: number; figures: number; comparisons: number };
  added: number; due: number; fresh: number; learning: number; known: number; mastery: number; startedPct: number;
}
export interface DeckSubject { paperId: string | null; paper: string; available: number; added: number; due: number; known: number; chapters: DeckChapter[] }
export interface FlashcardDecks { day: string; totals: { available: number; added: number; due: number; known: number }; subjects: DeckSubject[] }
export interface Goal { questionsPerDay: number; lessonsPerDay: number; custom: boolean }
export type PlanKind = 'TOPIC' | 'LESSON' | 'PRACTICE' | 'MOCK' | 'CUSTOM' | 'REVISE' | 'LAB' | 'REVIEW' | 'CHECKPOINT';
export type PlanEvidence = 'PERSONAL' | 'SYLLABUS' | 'METHOD' | 'VERIFIED_TREND';
export interface PlanItem {
  id: string; day: string; kind: PlanKind; refId: string | null; title: string; done: boolean;
  /** Present for items of a generated plan. */
  planId?: string | null; minutes?: number | null; targetCount?: number | null; subjectCode?: string | null; note?: string | null; evidence?: PlanEvidence | null; origin?: string; moved?: boolean; doneBy?: string | null;
}
export interface PlannerOptions {
  exams: { code: 'CUET_UG'; name: string; year: number; supported: boolean }[];
  notOffered: { name: string; reason: string }[];
  subjects: { paperId: string; code: string; name: string; category: string | null; topics: number; questions: number; verified: boolean }[];
  paths: { id: string; label: string; blurb: string; objectives: string[] }[];
  objectives: { id: string; label: string; blurb: string }[];
  durations: { days: 7 | 14 | 30; id: string; label: string; blurb: string; phases: { fromDay: number; toDay: number; focus: string }[] }[];
  defaults: { paperIds: string[]; minutesPerDay: number; minutesBounds: { min: number; max: number } };
  methodReview: { status: string; note: string };
}
export interface PlanGoal { examCode: 'CUET_UG'; path: string; paperIds: string[]; objectives: string[]; durationDays: 7 | 14 | 30; minutesPerDay: number; coverage: 'LIGHT' | 'STANDARD' | 'FULL'; startDay: string }
export interface PlanLab { id: string; subject: string; lessonTitleStartsWith: string; title: string; minutes: number }
export interface BuiltItem { key: string; day: number; date: string; kind: PlanKind; refId: string | null; subjectCode: string | null; title: string; minutes: number; targetCount: number | null; note: string; evidence: PlanEvidence; dependsOn: string | null; position: number }
export interface BuiltPlan {
  items: BuiltItem[];
  days: { day: number; date: string; capacity: number; minutes: number; light: boolean }[];
  warnings: string[];
  summary: {
    durationDays: number; minutesPerDay: number; totalMinutes: number; byKind: Record<string, number>; objectives: string[]; phases: { fromDay: number; toDay: number; focus: string }[]; usedPersonalData: boolean;
    subjects: { code: string; name: string; topicsInSyllabus: number; topicsPlanned: number; minutes: number; sharePercent: number; firstTopic: string | null; lastTopic: string | null; accuracy: number | null; attempted: number; weakTopics: number; notReached: number }[];
    trends: { used: boolean; topics: number; note: string }; methodReview: string;
  };
}
export interface PlanPreview { goal: PlanGoal; plan: BuiltPlan; fingerprint: string; generatorVersion: string; methodReview: { status: string; note: string } }
export interface LivePlanItem extends PlanItem {
  planId: string; origin: 'EXPERT' | 'STUDENT'; originalDay: string | null; pinned: boolean; status: 'SCHEDULED' | 'DEFERRED'; suggestionKey: string | null; dependsOn: string | null; position: number; latestSessionId: string | null; minutes: number | null;
}
export interface CurrentPlan {
  plan: null | {
    id: string; title: string; status: 'ACTIVE' | 'PAUSED'; pausedOn: string | null; startDay: string; endDay: string; durationDays: number; minutesPerDay: number; version: number; goal: PlanGoal; lightDays: string[];
    summary: BuiltPlan['summary']; warnings: string[]; methodReview: { status: string; note: string }; createdAt: string;
  };
  items?: LivePlanItem[];
  removed?: { suggestionKey: string; day: string; kind: PlanKind; title: string; minutes: number }[];
  progress?: {
    totalItems: number; doneItems: number; totalMinutes: number; doneMinutes: number; percent: number; deferred: number; detected: number;
    byDay: { day: string; planned: number; done: number; items: number; doneItems: number }[]; bySubject: { code: string; planned: number; done: number }[]; byKind: { kind: string; planned: number; done: number }[];
  };
  events?: { action: string; note: string | null; detail: unknown; at: string }[];
}
export interface PlanChange { id: string; from: string; to: string; status: string; reason: 'MISSED' | 'OVER_TIME' | 'PULLED_FORWARD' | 'RESTORED'; title: string }
export interface Dashboard {
  continueLearning: { kind: 'TOPIC_VIEW' | 'LESSON_VIEW'; nodeId: string | null; resourceId: string | null; title: string | null; paper: string | null; paperCode: string | null; at: string }[];
  inProgress: { id: string; mode: string; paper: string | null; topic: string | null; startedAt: string }[];
  today: { questionsAnswered: number; lessonsOpened: number; goal: Goal };
  plan: PlanItem[];
  weakTopics: Progress['topics'];
  subjects: SubjectProgress[];
  totals: Progress['totals'];
  bookmarks: number;
  flashcards: { total: number; due: number };
}
export type VisualItem =
  | { kind: 'DIAGRAM'; lessonId: string; lesson: string; position: number; verified: boolean; mediaAssetId: string | null; caption: string; alt: string; description: string | null; learn: string | null }
  | { kind: 'TABLE'; lessonId: string; lesson: string; position: number; verified: boolean; table: { caption: string | null; columns: string[]; rows: string[][] } };
export interface ChapterVisuals {
  topic: { id: string; title: string; kind: string; label: string | null; paperId: string; paper: string };
  counts: { diagrams: number; tables: number };
  items: VisualItem[];
}

export interface RevisionNotes {
  topic: { id: string; title: string; kind: string; label: string | null; paperId: string; paper: string };
  lessons: { resourceId: string; lesson: string; blocks: { type: string; body: string; position: number; conceptKey: string | null; anchor: string | null }[] }[];
}

export interface OfficialItem { text: string; source: string | null; page: number | null; note: string | null }
export interface OfficialInfo {
  exam: ExamCode; cycle: string; asOf: string;
  sections: { key: string; title: string; items: OfficialItem[] }[];
  notices: { date: string | null; title: string; url: string }[];
  universities: { total: number; byType: { type: string; count: number }[] };
}
export interface UniversityList {
  exam: ExamCode; cycle: string | null; total: number; types: { type: string; count: number }[];
  universities: { name: string; type: string; state: string | null; sourceUrl: string; slug: string; hasAdmissionInfo: boolean }[];
}

export interface Preferences { examCode: ExamCode | null; targetYear: number | null; papers: { id: string; code: string; name: string }[]; set: boolean }
export interface WeeklyReport {
  start: string; end: string;
  days: { day: string; answered: number; correct: number; lessons: number }[];
  totals: { answered: number; correct: number; accuracy: number | null; lessonsOpened: number; sessionsSubmitted: number; mocks: number; averageScorePct: number | null; activeDays: number; goalDays: number; planTotal: number; planDone: number };
  previous: { answered: number; accuracy: number | null; lessonsOpened: number; sessionsSubmitted: number };
  goal: Goal;
  subjects: { paper: string; code: string; answered: number; correct: number; accuracy: number | null }[];
  weakTopics: { id: string; title: string; attempted: number; correct: number; accuracy: number | null }[];
}
export interface Reminder { key: string; kind: 'TEST' | 'PLAN' | 'GOAL' | 'REVISE' | 'NOTICE' | 'SETUP'; title: string; body: string; link: string; external?: boolean }
export interface RecentItem { kind: 'TOPIC_VIEW' | 'LESSON_VIEW'; nodeId: string | null; resourceId: string | null; title: string | null; paper: string | null; at: string }

/** A previous-year paper, sample paper or answer key found on a public website. openUrl always opens the paper itself. */
export interface PyqDoc {
  id: string; kind: 'QUESTION_PAPER' | 'ANSWER_KEY' | 'SAMPLE_PAPER' | 'PRACTICE_PAPER'; classification: 'OFFICIAL' | 'THIRD_PARTY_COPY' | 'MEMORY_BASED' | 'SAMPLE' | 'CUET_PREP_ORIGINAL'; official: boolean; year: number | null;
  subjectCode: string | null; subjectName: string | null; subjectSlug: string | null; section: string | null; title: string; listedAs: string | null;
  examDate: string | null; shift: string | null; language: string | null; pages: number | null; sourceSite: string; sourcePageUrl: string; note: string | null; checkedOn: string; linkChecked: boolean;
  viewer: 'IN_APP' | 'SOURCE'; fileUrl: string | null; openUrl: string; alternatives: { site: string; url: string | null; title: string }[];
  /** A document Prepora generated and keeps in its own storage: it opens in the viewer here and can be downloaded. */
  native: boolean; downloadUrl: string | null; unreviewed: boolean;
  /** NTA's original file address, kept as the record of where a hosted official document came from. */
  originalUrl: string | null;
  /** Set when Prepora hosts the file: its hash, retrieval date and checks. */
  hosted: { sha256: string; bytes: number; pages: number | null; sourceUrl: string; retrievedAt: string; verification: string; rightsStatus: string } | null;
}
export interface PyqTree {
  exam: ExamCode; total: number; checkedOn: string | null;
  years: { year: number; papers: number; answerKeys: number; subjects: { slug: string; code: string | null; name: string; section: string | null; papers: number; samplePapers: number }[] }[];
}
export interface PyqSubject {
  exam: ExamCode; year: number; subject: { slug: string; code: string | null; name: string; section: string | null };
  papers: PyqDoc[]; answerKeys: (PyqDoc & { sessions: { date: string | null; shift: string | null; page: number | null }[] })[]; samplePapers: PyqDoc[]; practicePapers: PyqDoc[];
}
export type NoticeCategory = 'ADMIT_CARD' | 'RESULT' | 'ANSWER_KEY' | 'EXAM_SCHEDULE' | 'CITY_INTIMATION' | 'APPLICATION' | 'SYLLABUS' | 'ADMISSION' | 'SCHOLARSHIP' | 'REGULATION' | 'ADVISORY' | 'GENERAL';
/** Who issued a notice: the National Testing Agency or the University Grants Commission. */
export type NoticeAuthority = 'NTA' | 'UGC';
/** One published admissions fact, with where it came from. */
export interface AdmissionFact {
  id: string; universitySlug: string; universityName: string; kind: 'EVENT' | 'ELIGIBILITY' | 'SUBJECTS' | 'PROCEDURE' | 'COUNSELLING' | 'CUTOFF'; exam: ExamCode; year: number; programme: string | null; label: string;
  valueText: string | null; valueNumber: number | null; basis: string | null; category: string | null; round: string | null; eventDate: string | null; sourcePage: number | null;
  sourceLocator: string | null; checkedOn: string; status: string; sourceUrl: string; sourceTitle: string; sourceStatus: string; rejectReason: string | null;
  programmeId: string | null; subjects: string[] | null; reliability: Reliability; reviewFlag: string | null; cycle: Cycle;
}
/** `PREVIOUS` means the information is about an admission cycle before the one students are preparing for. */
export interface Cycle { status: 'PREVIOUS' | 'CURRENT' | 'FUTURE'; label: string | null }
export type EligibilityVerdict = 'MEETS' | 'DOES_NOT_MEET' | 'CANNOT_TELL';
export interface EligibilityOut {
  programmeId: string;
  available: boolean;
  unavailable: { code: string; message: string } | null;
  result: null | {
    verdict: EligibilityVerdict;
    combinations: { label: string; state: 'SATISFIED' | 'NOT_SATISFIED' | 'UNKNOWN'; missing: string[]; unknownBecause: string[] }[];
    matched: string | null;
    additionalRequirements: string[];
    reasons: string[];
  };
  basis: null | { academicYear: string; cycle: Cycle; checkedOn: string; sourceUrl: string; sourceTitle: string; sourcePage: number | null; requirementVersion: number; approvedAt: string | null; reliability: Reliability };
  papersUsed: string[];
  caveats: string[];
}
export interface TargetsOut {
  papers: string[];
  limit: number;
  targets: {
    programmeId: string; programmeName: string; university: string; universitySlug: string; academicYear: string; exam: string; addedAt: string; note: string | null; available: boolean;
    information: { cycle: Cycle; stale: boolean; lastVerifiedOn: string; message: string | null };
    eligibility: EligibilityOut;
  }[];
}
export type Reliability = 'VERIFIED_OFFICIAL' | 'OUTDATED' | 'UNVERIFIED' | 'SOURCE_NOT_APPROVED';
export interface ProgrammeSummary {
  id: string; universitySlug: string; universityName: string; universityType: string | null; programmeName: string; degree: string | null; level: string; academicYear: string; exam: ExamCode;
  lastVerifiedOn: string; reliability: Reliability; sourceUrl: string | null; sourceTitle: string | null; cycle: Cycle;
  subjects: string[] | null; ruleText: string | null; nextDeadline: { date: string; label: string } | null; lastDeadline: { date: string; label: string } | null;
  known: { eligibility: boolean; subjects: boolean; procedure: boolean; counselling: boolean; deadline: boolean; cutoffs: boolean };
}
export interface ProgrammeList { total: number; programmes: ProgrammeSummary[] }
export interface AdmissionFilters { types: { type: string; count: number }[]; years: { year: string; count: number }[]; subjects: { subject: string; count: number }[] }
export interface ProgrammeDetail {
  programme: ProgrammeSummary & { sourcePage: number | null; sourceLocator: string | null };
  current: { eligibility: AdmissionFact[]; subjects: AdmissionFact[]; procedure: AdmissionFact[]; counselling: AdmissionFact[]; dates: AdmissionFact[] };
  unavailable: string[]; historicalCutoffs: AdmissionFact[];
  officialPages: { url: string; title: string; kind: string; covers: string; format: string; updateFrequency: string | null; lastCheckedOn: string | null }[]; note: string;
}
export interface UniversityAdmissions {
  slug: string; name: string; listedBy: { exam: ExamCode; cycle: string; type: string; sourceUrl: string }[];
  officialPages: { url: string; title: string; kind: string; covers: string; format: string; updateFrequency: string | null; lastCheckedOn: string | null }[];
  programmes: { id: string; programmeName: string; degree: string | null; level: string; academicYear: string; exam: ExamCode; cycle: Cycle }[];
  dates: AdmissionFact[]; eligibility: AdmissionFact[]; cutoffs: AdmissionFact[]; note: string;
}
/** An official notice. sourceUrl and documentUrl are the exam body's own addresses; nothing is hosted by Prepora. */
export interface GovNotice {
  id: string; title: string; description: string | null; category: NoticeCategory; authority: NoticeAuthority; exam: ExamCode | null; examYear: number | null; publishedOn: string | null;
  sourceName: string; sourceUrl: string; documentUrl: string; isPdf: boolean; isNew: boolean; isUpdated: boolean; firstDetectedAt: string; lastCheckedAt: string;
  versionCount: number; revisionKind: RevisionKind | null; revisionOfId: string | null;
  /** The notice this one corrects, and the published notices that correct this one. */
  revisionOf: { id: string; title: string } | null; revisions: { id: string; title: string; kind: RevisionKind | null; publishedOn: string | null }[];
}
export type RevisionKind = 'CORRIGENDUM' | 'ADDENDUM' | 'EXTENSION' | 'RESCHEDULED' | 'AMENDMENT' | 'REVISED';
export interface NoticeDetail { notice: GovNotice; versions: { version: number; title: string; publishedOn: string | null; reason: string; detectedAt: string }[] }
export interface NoticeList { total: number; lastCheckedAt: string | null; categories: { category: NoticeCategory; count: number }[]; notices: GovNotice[] }

export interface SearchResults {
  query: string; more: boolean;
  subjects: { paperId: string; code: string; name: string; exam: ExamCode; available: boolean }[];
  topics: { id: string; kind: string; label: string | null; title: string; snippet: string | null; parentTitle: string | null; paperId: string; paperCode: string; paper: string; exam: ExamCode }[];
  /** Single definitions, formulas, key points and facts inside lessons. */
  concepts: { key: string; anchor: string; type: ConceptType; title: string; snippet: string; resourceId: string; lesson: string; paperId: string; paper: string; exam: ExamCode }[];
}

/** The student's local calendar day (YYYY-MM-DD) and the moment it started, for "today" counts. */
export function localDay(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};


export const api = {
  me: () => request<{ user: User | null; preview: boolean }>('GET', '/api/auth/me'),
  register: (b: { email: string; password: string; displayName: string }) => request<User>('POST', '/api/auth/register', b),
  login: (b: { email: string; password: string }) => request<{ user: User }>('POST', '/api/auth/login', b),
  logout: () => request<unknown>('POST', '/api/auth/logout'),
  exams: () => request<Exam[]>('GET', '/api/learn/exams'),
  subjects: (exam: ExamCode, year: number) => request<Subject[]>('GET', `/api/learn/exams/${exam}/subjects?year=${year}`),
  questionCounts: (q: { paperId?: string; nodeIds?: string[]; difficulty?: Difficulty[]; types?: QuestionTypeName[] }) => request<QuestionCounts>('GET', `/api/learn/question-counts?${new URLSearchParams({ ...(q.paperId ? { paperId: q.paperId } : {}), ...(q.nodeIds?.length ? { nodeIds: q.nodeIds.join(',') } : {}), ...(q.difficulty?.length ? { difficulty: q.difficulty.join(',') } : {}), ...(q.types?.length ? { types: q.types.join(',') } : {}) })}`),
  outline: (paperId: string) => request<Outline>('GET', `/api/learn/subjects/${paperId}`),
  topic: (id: string) => request<TopicDetail>('GET', `/api/learn/topics/${id}`),
  topicWeightage: (id: string) => request<StudentTopicWeightage>('GET', `/api/learn/topics/${id}/weightage`),
  resource: (id: string) => request<ResourceDetail>('GET', `/api/learn/resources/${id}`),
  startPractice: (b: { mode: PracticeSession['session']['mode']; nodeId?: string; nodeIds?: string[]; paperId?: string; count?: number; difficulty?: Difficulty[]; types?: QuestionTypeName[] }) => request<PracticeSession>('POST', '/api/student/practice', b),
  session: (id: string) => request<PracticeSession>('GET', `/api/student/practice/${id}`),
  answer: (id: string, b: { questionId: string; selectedPositions?: number[]; numericAnswer?: number | null }) => request<Feedback>('POST', `/api/student/practice/${id}/answers`, b),
  examPreview: (q: { mode: 'TOPIC_TEST' | 'MOCK_TEST'; nodeId?: string; paperId?: string }) => request<ExamPreview>('GET', `/api/student/exam/preview?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`),
  reportViolation: (id: string, b: { type: 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'RETURN_TIMEOUT'; at?: string }) => request<ViolationResult>('POST', `/api/student/practice/${id}/violations`, b),
  submit: (id: string, timedOut = false) => request<PracticeSession>('POST', `/api/student/practice/${id}/submit`, { timedOut }),
  progress: () => request<Progress>('GET', '/api/student/progress'),
  dailyPractice: (b: { paperId?: string; count?: number } = {}) => request<PracticeSession>('POST', '/api/student/practice/daily', b),
  dashboard: () => request<Dashboard>('GET', `/api/student/dashboard?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`),
  profile: () => request<Profile>('GET', '/api/student/profile'),
  updateProfile: (b: { displayName: string }) => request<Profile>('PUT', '/api/student/profile', b),
  changePassword: (b: { currentPassword: string; newPassword: string }) => request<{ changed: boolean }>('POST', '/api/student/password', b),
  goals: () => request<Goal>('GET', '/api/student/goals'),
  setGoals: (b: { questionsPerDay: number; lessonsPerDay: number }) => request<Goal>('PUT', '/api/student/goals', b),
  activity: (b: { kind: 'TOPIC_VIEW' | 'LESSON_VIEW' | 'LAB_COMPLETE'; nodeId?: string; resourceId?: string }) => request<{ recorded: boolean }>('POST', '/api/student/activity', b),
  startVpa: (b: { labId?: 'ohms-law'; chapterId?: 'physics-current-electricity-ohms-law'; mode: 'GUIDED' | 'INDEPENDENT'; lessonId?: string }) => request<VpaAttempt>('POST', '/api/student/vpa/attempts', b),
  vpaAttempt: (id: string) => request<VpaAttempt>('GET', `/api/student/vpa/attempts/${encodeURIComponent(id)}`),
  measureVpa: (id: string, b: { wires: string[]; voltageIndex: number }) => request<{ valid: boolean; message?: string; reading?: VpaReading; alreadyRecorded?: boolean }>('POST', `/api/student/vpa/attempts/${encodeURIComponent(id)}/measure`, b),
  recordVpaObservation: (id: string, b: { wires: string[]; voltageIndex: number; observedVoltage: number; observedCurrent: number }) => request<{ recorded: boolean; message?: string; reading?: VpaReading }>('POST', `/api/student/vpa/attempts/${encodeURIComponent(id)}/observations`, b),
  submitVpa: (id: string, b: { wires: string[]; formula: 'V_OVER_I' | 'I_OVER_V' | 'V_TIMES_I'; calculatedResistance: number; graphShape: 'LINEAR_ORIGIN' | 'LINEAR_OFFSET' | 'CURVED' | 'NO_RELATION'; graphSlope: number }) => request<{ report: VpaReport; progressRecorded: boolean }>('POST', `/api/student/vpa/attempts/${encodeURIComponent(id)}/submit`, b),
  bookmarks: () => request<Bookmark[]>('GET', '/api/student/bookmarks'),
  bookmarkState: (kind: BookmarkKind, ids: string[]) => request<string[]>('GET', `/api/student/bookmarks/state?kind=${kind}&ids=${ids.map(encodeURIComponent).join(',')}`),
  addBookmark: (b: { kind: BookmarkKind; entityId: string }) => request<{ bookmarked: boolean }>('POST', '/api/student/bookmarks', b),
  removeBookmark: (b: { kind: BookmarkKind; entityId: string }) => request<{ bookmarked: boolean }>('POST', '/api/student/bookmarks/remove', b),
  // Highlights and annotations.
  annotations: (kind: 'LESSON' | 'QUESTION', id: string) => request<Annotation[]>('GET', `/api/student/annotations?surface=${kind}&id=${encodeURIComponent(id)}`),
  annotationsFor: (kind: 'LESSON' | 'QUESTION', ids: string[]) => request<Annotation[]>('GET', `/api/student/annotations?surface=${kind}&ids=${ids.map(encodeURIComponent).join(',')}`),
  allAnnotations: () => request<AnnotationEntry[]>('GET', '/api/student/annotations'),
  saveAnnotations: (body: { surfaceKind: string; surfaceId: string; originPath?: string; upserts: unknown[]; deletes: string[] }) => request<{ saved: number; removed: number; changed: number }>('PUT', '/api/student/annotations', body),
  editAnnotation: (id: string, body: { note?: string | null; color?: string }) => request<{ id: string; note: string | null; color: string }>('PATCH', `/api/student/annotations/${encodeURIComponent(id)}`, body),
  deleteAnnotation: (id: string) => request<{ deleted: boolean }>('DELETE', `/api/student/annotations/${encodeURIComponent(id)}`),
  // Flashcards and revision. The day is the student's own calendar day.
  cards: (f: { paperId?: string | null; chapterId?: string | null; nodeId?: string | null; resourceId?: string | null; due?: boolean; limit?: number } = {}) =>
    request<Flashcard[]>('GET', `/api/student/flashcards?day=${localDay()}${f.resourceId ? `&resourceId=${encodeURIComponent(f.resourceId)}` : ''}${f.limit ? `&limit=${f.limit}` : ''}${f.paperId ? `&paperId=${encodeURIComponent(f.paperId)}` : ''}${f.chapterId ? `&chapterId=${encodeURIComponent(f.chapterId)}` : ''}${f.nodeId ? `&nodeId=${encodeURIComponent(f.nodeId)}` : ''}${f.due ? '&due=1' : ''}`),
  topicCards: (nodeId: string) => request<TopicCards>('GET', `/api/student/flashcards/topic/${encodeURIComponent(nodeId)}?day=${localDay()}`),
  cardSummary: () => request<CardSummary>('GET', `/api/student/flashcards/summary?day=${localDay()}`),
  cardQueue: (f: { paperId?: string | null; chapterId?: string | null; nodeId?: string | null; resourceId?: string | null } = {}) =>
    request<{ day: string; due: number; cards: Flashcard[] }>('GET', `/api/student/flashcards/queue?day=${localDay()}&limit=100${f.resourceId ? `&resourceId=${encodeURIComponent(f.resourceId)}` : ''}${f.paperId ? `&paperId=${encodeURIComponent(f.paperId)}` : ''}${f.chapterId ? `&chapterId=${encodeURIComponent(f.chapterId)}` : ''}${f.nodeId ? `&nodeId=${encodeURIComponent(f.nodeId)}` : ''}`),
  cardState: (keys: string[]) => request<{ conceptKey: string; id: string; reviewed: boolean }[]>('POST', '/api/student/flashcards/state', { keys }),
  /** Saves an attempted practice question as a revision card. Refused (NOT_ATTEMPTED) until the student has answered it and seen the result. */
  createQuestionCard: (questionId: string) => request<{ created: boolean; card: Flashcard }>('POST', '/api/student/flashcards/questions', { questionId, day: localDay() }),
  questionCardState: (ids: string[]) => request<{ questionId: string; id: string; reviewed: boolean }[]>('POST', '/api/student/flashcards/questions/state', { ids }),
  createCard: (conceptKey: string) => request<{ created: boolean; card: Flashcard }>('POST', '/api/student/flashcards', { conceptKey, day: localDay() }),
  chapterSheet: (nodeId: string) => request<Sheet>('GET', `/api/learn/topics/${nodeId}/sheet`),
  subjectSheet: (paperId: string) => request<Sheet>('GET', `/api/learn/subjects/${paperId}/last-day-sheet`),
  weakSheet: (paperId?: string) => request<Sheet>('GET', `/api/student/sheets/weak${paperId ? `?paperId=${paperId}` : ''}`),
  flashcardDecks: () => request<FlashcardDecks>('GET', `/api/student/flashcards/decks?day=${localDay()}`),
  importCards: (from: { resourceId: string } | { nodeId: string }, types?: ConceptType[]) => request<CardImport>('POST', '/api/student/flashcards/import', { ...from, ...(types ? { types } : {}), day: localDay() }),
  /** `early`: marked from a list before the card's due day. */
  reviewCard: (id: string, rating: CardRating, early = false) => request<Flashcard>('POST', `/api/student/flashcards/${id}/review`, { rating, day: localDay(), ...(early ? { early: true } : {}) }),
  /** A card that has been revised is removed only with `confirm` (the student agreed to lose its progress). */
  deleteCard: (id: string, confirm = false) => request<{ deleted: boolean; reviewsRemoved: number }>('DELETE', `/api/student/flashcards/${id}${confirm ? '?confirm=1' : ''}`),
  plan: (from: string, to: string) => request<PlanItem[]>('GET', `/api/student/plan?from=${from}&to=${to}`),
  addPlan: (b: { day: string; kind: PlanKind; refId?: string | null; title: string; planId?: string | null; minutes?: number | null; targetCount?: number | null; subjectCode?: string | null }) => request<{ id: string }>('POST', '/api/student/plan', b),
  updatePlan: (id: string, b: { day?: string; title?: string; done?: boolean; minutes?: number | null; position?: number; kind?: PlanKind; refId?: string | null; targetCount?: number | null }) => request<{ id: string }>('PATCH', `/api/student/plan/${id}`, b),
  plannerOptions: () => request<PlannerOptions>('GET', '/api/student/planner/options'),
  previewPlan: (b: PlanGoal & { labs: PlanLab[] }) => request<PlanPreview>('POST', '/api/student/planner/preview', b),
  createPlan: (b: PlanGoal & { labs: PlanLab[]; replace?: boolean; fingerprint?: string }) => request<{ id: string }>('POST', '/api/student/planner/plans', b),
  currentPlan: (asOf: string) => request<CurrentPlan>('GET', `/api/student/planner/plans/current?asOf=${asOf}`),
  adjustPlan: (id: string, asOf: string) => request<{ changes: PlanChange[] }>('POST', `/api/student/planner/plans/${id}/adjust`, { asOf }),
  pausePlan: (id: string, asOf: string) => request<{ status: string }>('POST', `/api/student/planner/plans/${id}/pause`, { asOf }),
  resumePlan: (id: string, asOf: string) => request<{ status: string; shiftedDays: number }>('POST', `/api/student/planner/plans/${id}/resume`, { asOf }),
  archivePlan: (id: string, asOf: string) => request<{ status: string }>('POST', `/api/student/planner/plans/${id}/archive`, { asOf }),
  setPlanMinutes: (id: string, minutesPerDay: number, asOf: string) => request<{ changes: PlanChange[] }>('PATCH', `/api/student/planner/plans/${id}`, { minutesPerDay, asOf }),
  regeneratePlan: (id: string, b: Partial<PlanGoal> & { asOf: string; labs: PlanLab[] }) => request<{ id: string; version: number }>('POST', `/api/student/planner/plans/${id}/regenerate`, b),
  restoreSuggestion: (id: string, suggestionKey: string) => request<{ restored: boolean }>('POST', `/api/student/planner/plans/${id}/restore`, { suggestionKey }),
  reorderPlanDay: (id: string, day: string, ids: string[]) => request<{ ordered: boolean }>('PUT', `/api/student/planner/plans/${id}/order`, { day, ids }),
  planAlternatives: (itemId: string) => request<{ alternatives: { kind: PlanKind; refId: string | null; title: string; minutes: number; targetCount: number | null; reason: string }[] }>('GET', `/api/student/planner/items/${itemId}/alternatives`),
  deletePlan: (id: string) => request<{ deleted: boolean }>('DELETE', `/api/student/plan/${id}`),
  visuals: (nodeId: string) => request<ChapterVisuals>('GET', `/api/learn/topics/${nodeId}/visuals`),
  revision: (nodeId: string) => request<RevisionNotes>('GET', `/api/learn/topics/${nodeId}/revision`),
  preferences: () => request<Preferences>('GET', '/api/student/preferences'),
  setPreferences: (b: { examCode: ExamCode | null; targetYear: number | null; paperIds: string[] }) => request<Preferences>('PUT', '/api/student/preferences', b),
  weeklyReport: (start: string) => {
    const [y, m, d] = start.split('-').map(Number);
    const from = new Date(y!, m! - 1, d!).toISOString();
    return request<WeeklyReport>('GET', `/api/student/report/weekly?start=${start}&from=${encodeURIComponent(from)}&tz=${-new Date(y!, m! - 1, d!).getTimezoneOffset()}`);
  },
  reminders: () => request<Reminder[]>('GET', `/api/student/reminders?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`),
  dismissReminder: (key: string) => request<{ dismissed: boolean }>('POST', '/api/student/reminders/dismiss', { key }),
  recent: () => request<RecentItem[]>('GET', '/api/student/recent'),
  supportCategories: () => request<{ code: string; label: string }[]>('GET', '/api/student/support/categories'),
  supportUnread: () => request<{ unread: number }>('GET', '/api/student/support/unread'),
  supportChat: () => request<SupportConversation>('GET', '/api/student/support/chat'),
  supportSend: (b: { body: string; attachment?: SupportAttachment }) => request<SupportConversation>('POST', '/api/student/support/chat/messages', b),
  supportTickets: () => request<SupportThread[]>('GET', '/api/student/support/tickets'),
  supportRaise: (b: { category: string; title: string; description: string; attachment?: SupportAttachment }) => request<SupportConversation & { thread: SupportThread }>('POST', '/api/student/support/tickets', b),
  supportTicket: (id: string) => request<SupportConversation & { thread: SupportThread }>('GET', `/api/student/support/tickets/${id}`),
  supportReply: (id: string, b: { body: string; attachment?: SupportAttachment }) => request<SupportConversation & { thread: SupportThread }>('POST', `/api/student/support/tickets/${id}/messages`, b),
  supportUpload: async (file: File): Promise<SupportAttachment> => {
    const res = await fetch('/api/student/support/attachments', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': file.type, 'x-filename': encodeURIComponent(file.name) }, body: file });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'The file could not be attached');
    return data as SupportAttachment;
  },
  subjectSummary: (paperId: string) => request<{ last: { kind: 'TOPIC_VIEW' | 'LESSON_VIEW'; nodeId: string | null; resourceId: string | null; title: string | null; at: string } | null; lessonsCompleted: number; testsCompleted: number }>('GET', `/api/student/subject-summary/${paperId}`),
  resetPassword: (b: { token: string; newPassword: string }) => request<{ reset: boolean }>('POST', '/api/auth/reset-password', b),
  pastPapers: (f: { exam?: ExamCode; year?: number; subject?: string }) =>
    request<{ total: number; years: number[]; subjects: { code: string; name: string }[]; papers: PastPaper[] }>('GET', `/api/learn/past-papers?${new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()}`),
  officialDirectory: (exam: ExamCode) => request<{ exam: ExamCode; years: DirectoryYear[] }>('GET', `/api/learn/official-directory?exam=${exam}`),
  officialSessions: (exam: ExamCode, year: number, subject: string) => request<DirectorySession[]>('GET', `/api/learn/official-directory/sessions?exam=${exam}&year=${year}&subject=${encodeURIComponent(subject)}`),
  officialDocument: (id: string) => request<OfficialDocument>('GET', `/api/learn/official-documents/${id}`),
  officialPapers: (exam: ExamCode) => request<{ exam: ExamCode; years: { year: number; items: OfficialLinkItem[] }[] }>('GET', `/api/learn/official-papers?exam=${exam}`),
  mockPapers: (exam: ExamCode) => request<MockPaperCard[]>('GET', `/api/learn/mock-papers?exam=${exam}`),
  startMockPaper: (id: string, mode: 'PRACTICE' | 'MOCK_TEST') => request<PracticeSession>('POST', `/api/student/mock-papers/${id}/start`, { mode }),
  saveMarks: (id: string, questionIds: string[]) => request<{ marked: string[] }>('PUT', `/api/student/practice/${id}/marks`, { questionIds }),
  pastPaper: (id: string) => request<PastPaperDetail>('GET', `/api/learn/past-papers/${id}`),
  startPastPaper: (id: string, mode: 'PRACTICE' | 'MOCK_TEST') => request<PracticeSession>('POST', `/api/student/past-papers/${id}/start`, { mode }),
  billing: () => request<Billing>('GET', '/api/student/billing'),
  createOrder: (planCode: string) => request<Checkout>('POST', '/api/student/billing/orders', { planCode }),
  confirmOrder: (id: string, b: { gatewayPaymentId: string; signature: string }) => request<{ result: string; access: Access }>('POST', `/api/student/billing/orders/${id}/confirm`, b),
  simulatePayment: (id: string, outcome: 'success' | 'failure') => request<{ result: string; access: Access }>('POST', `/api/student/billing/orders/${id}/simulate`, { outcome }),
  emailStatus: () => request<{ available: boolean }>('GET', '/api/auth/email-status'),
  forgotPassword: (email: string) => request<{ ok: boolean; available: boolean }>('POST', '/api/auth/forgot-password', { email }),
  verifyEmail: (token: string) => request<{ verified: boolean }>('POST', '/api/auth/verify-email', { token }),
  emailSettings: () => request<EmailSettings>('GET', '/api/student/email'),
  setEmailSettings: (b: { emailReminders?: boolean; emailNotices?: boolean; emailRevision?: boolean; examDate?: string | null }) => request<EmailSettings>('PUT', '/api/student/email', b),
  sendVerification: () => request<{ sent: boolean; reason?: string }>('POST', '/api/student/email/verification'),
  unsubscribe: (token: string, scope: 'REMINDERS' | 'NOTICES' | 'ALL' = 'REMINDERS') => request<{ unsubscribed: boolean }>('POST', '/api/public/email/unsubscribe', { token, scope }),
  chapterPdfs: (exam: ExamCode) => request<{ id: string; subjectCode: string; nodeId: string; title: string; pages: number | null; reviewState: string | null }[]>('GET', `/api/learn/question-bank-pdfs?exam=${exam}`),
  pyqTree: (exam: ExamCode) => request<PyqTree>('GET', `/api/learn/pyq?exam=${exam}`),
  pyqSubject: (year: number, slug: string) => request<PyqSubject>('GET', `/api/learn/pyq/${year}/${encodeURIComponent(slug)}`),
  pyqDocument: (id: string) => request<PyqDoc & { exam: ExamCode }>('GET', `/api/learn/pyq/documents/${encodeURIComponent(id)}`),
  notices: (f: { exam?: ExamCode; category?: NoticeCategory; authority?: NoticeAuthority; limit?: number } = {}) =>
    request<NoticeList>('GET', `/api/public/notices?limit=${f.limit ?? 30}${f.exam ? `&exam=${f.exam}` : ''}${f.category ? `&category=${f.category}` : ''}${f.authority ? `&authority=${f.authority}` : ''}`),
  search: (q: string, exam?: ExamCode | '') => request<SearchResults>('GET', `/api/learn/search?q=${encodeURIComponent(q)}${exam ? `&exam=${exam}` : ''}`),
  officialInfo: (exam: ExamCode) => request<OfficialInfo>('GET', `/api/public/info/${exam}`),
  noticeDetail: (id: string) => request<NoticeDetail>('GET', `/api/public/notices/${encodeURIComponent(id)}`),
  admissionFilters: () => request<AdmissionFilters>('GET', '/api/public/admissions/filters'),
  programmes: (f: { type?: string; university?: string; subject?: string; exam?: string; year?: string; q?: string; offset?: number } = {}) => {
    const qs = new URLSearchParams({ limit: '30', ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== 0).map(([k, v]) => [k, String(v)])) });
    return request<ProgrammeList>('GET', `/api/public/admissions/programmes?${qs}`);
  },
  programme: (id: string) => request<ProgrammeDetail>('GET', `/api/public/admissions/programmes/${encodeURIComponent(id)}`),
  /** Minimum subject eligibility from approved, published rules only. Papers are CUET paper codes; without them the subjects chosen in the profile are used. */
  eligibility: (ids: string[], papers: string[] = []) => request<{ papers: string[]; results: EligibilityOut[] }>('GET', `/api/student/admissions/eligibility?ids=${ids.map(encodeURIComponent).join(',')}${papers.length ? `&papers=${papers.join(',')}` : ''}`),
  admissionTargets: () => request<TargetsOut>('GET', '/api/student/admissions/targets'),
  addAdmissionTarget: (programmeId: string, note?: string) => request<{ added: boolean }>('POST', '/api/student/admissions/targets', { programmeId, ...(note ? { note } : {}) }),
  removeAdmissionTarget: (programmeId: string) => request<{ removed: boolean }>('DELETE', `/api/student/admissions/targets/${encodeURIComponent(programmeId)}`),
  universityAdmissions: (slug: string) => request<UniversityAdmissions>('GET', `/api/public/admissions/universities/${encodeURIComponent(slug)}`),
  universities: (exam: ExamCode, q?: string, type?: string) =>
    request<UniversityList>('GET', `/api/public/universities?exam=${exam}${q ? `&q=${encodeURIComponent(q)}` : ''}${type ? `&type=${encodeURIComponent(type)}` : ''}`),
};
