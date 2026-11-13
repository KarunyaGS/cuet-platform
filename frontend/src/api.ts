/** Thin client for the CUET API. Cookies carry the session; nothing secret lives in the browser. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Fired when an API call says the session is missing or expired; the auth provider re-checks and the route guard redirects. */
export const UNAUTHORIZED_EVENT = 'cuet:unauthorized';

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
  return data as T;
}

export type ExamCode = 'CUET_UG' | 'CUET_PG';
export interface Exam { code: ExamCode; name: string; level: string; year: number; label: string; rules: Record<string, number | string | boolean> }
export interface Subject {
  paperId: string; code: string; name: string; category: { code: string | null; name: string | null };
  available: boolean; preview: boolean; verification: string | null; units: number; sections: number; topics: number; questions: number;
}
export interface OutlineNode { id: string; parent_id: string | null; kind: string; label: string | null; title: string; depth: number; position: number; source_page: number | null; resources: number; questions: number }
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
export interface EmailSettings { email: string; emailVerified: boolean; emailReminders: boolean; emailAvailable: boolean }
export interface SessionQuestion {
  number: number; id: string; type: string; stem: string; difficulty: string; preview: boolean; origin: string;
  passage: { title: string | null; body: string } | null; structure: unknown;
  options: { position: number; label: string; text: string; mediaAssetId: string | null }[];
  answer: { selectedPositions: number[] | null; numericAnswer: number | null } | null;
  review: { outcome: string; score: number; correctOptionPositions: number[] | null; correctNumericAnswer: number | null; explanation: string | null; optionRationale: Record<string, string> | null } | null;
}
export interface PracticeSession {
  session: {
    id: string; mode: 'PRACTICE' | 'TOPIC_TEST' | 'MOCK_TEST'; status: string; startedAt: string; durationSeconds: number | null; deadline: string | null;
    marking: { correct: number; incorrect: number };
    /** Question ids marked for review (kept on the server). */
    marked: string[];
    /** Set when the attempt is a fixed paper: one of our mock papers, or an official previous-year paper. */
    source: { kind: 'MOCK_PAPER' | 'PAST_PAPER'; id: string; title: string } | null;
    result: { score: number; maxScore: number; correct: number; incorrect: number; unattempted: number; submittedAt: string } | null;
  };
  questions: SessionQuestion[];
}
export interface Feedback { outcome?: string; score?: number; correctOptionPositions?: number[] | null; explanation?: string | null; saved: boolean }
export interface Progress {
  totals: { sessions: number; correct: number; incorrect: number; unattempted: number; answered: number; accuracy: number | null };
  topics: { id: string; title: string; kind: string; paper: string; paper_code: string; attempted: number; correct: number; incorrect: number; accuracy: number; last_attempt_at: string }[];
  weakTopics: Progress['topics'];
  recentSessions: { id: string; mode: string; status: string; score: number | null; max_score: number | null; correct_count: number; incorrect_count: number; unattempted_count: number; started_at: string; paper: string | null }[];
  subjects: SubjectProgress[];
}
export interface SubjectProgress { paper: string; paperCode: string; topics: number; attempted: number; correct: number; accuracy: number | null }
export interface Profile { id: string; email: string; displayName: string; memberSince: string; lastLogin: string | null; testsTaken: number; bookmarks: number }
export type BookmarkKind = 'TOPIC' | 'LESSON' | 'QUESTION' | 'REVISION';
export interface Bookmark { id: string; kind: BookmarkKind; entityId: string; title: string; nodeId: string | null; paper: string | null; createdAt: string }
export type CardRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
export interface Flashcard {
  id: string; conceptKey: string; resourceId: string; anchor: string; lesson: string; section: string | null; type: string;
  paperId: string | null; paper: string | null; chapterId: string | null; chapter: string | null;
  front: string; back: string; latex: string | null;
  dueOn: string; due: boolean; intervalDays: number; reps: number; lapses: number; lastRating: CardRating | null; lastReviewedAt: string | null;
  stage: 'NEW' | 'LEARNING' | 'KNOWN';
}
export interface CardSummary {
  day: string; total: number; due: number; fresh: number; known: number; reviewedToday: number;
  subjects: { paperId: string | null; paper: string; total: number; due: number; known: number; chapters: { chapterId: string | null; chapter: string; total: number; due: number; known: number }[] }[];
}
export interface TopicCards { nodeId: string; title: string; paperId: string; day: string; concepts: number; cards: number; due: number }
export interface CardImport { total: number; added: number; existing: number; notAdded: number; limit: number }
export type ConceptType = 'DEFINITION' | 'FORMULA' | 'KEY_POINT' | 'IMPORTANT_FACT' | 'CONCEPT';
export interface Goal { questionsPerDay: number; lessonsPerDay: number; custom: boolean }
export type PlanKind = 'TOPIC' | 'LESSON' | 'PRACTICE' | 'MOCK' | 'CUSTOM';
export interface PlanItem { id: string; day: string; kind: PlanKind; refId: string | null; title: string; done: boolean }
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
  universities: { name: string; type: string; state: string | null; sourceUrl: string }[];
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
  outline: (paperId: string) => request<Outline>('GET', `/api/learn/subjects/${paperId}`),
  topic: (id: string) => request<TopicDetail>('GET', `/api/learn/topics/${id}`),
  resource: (id: string) => request<ResourceDetail>('GET', `/api/learn/resources/${id}`),
  startPractice: (b: { mode: PracticeSession['session']['mode']; nodeId?: string; paperId?: string; count?: number }) => request<PracticeSession>('POST', '/api/student/practice', b),
  session: (id: string) => request<PracticeSession>('GET', `/api/student/practice/${id}`),
  answer: (id: string, b: { questionId: string; selectedPositions?: number[]; numericAnswer?: number | null }) => request<Feedback>('POST', `/api/student/practice/${id}/answers`, b),
  submit: (id: string) => request<PracticeSession>('POST', `/api/student/practice/${id}/submit`),
  progress: () => request<Progress>('GET', '/api/student/progress'),
  dailyPractice: (b: { paperId?: string; count?: number } = {}) => request<PracticeSession>('POST', '/api/student/practice/daily', b),
  dashboard: () => request<Dashboard>('GET', `/api/student/dashboard?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`),
  profile: () => request<Profile>('GET', '/api/student/profile'),
  updateProfile: (b: { displayName: string }) => request<Profile>('PUT', '/api/student/profile', b),
  changePassword: (b: { currentPassword: string; newPassword: string }) => request<{ changed: boolean }>('POST', '/api/student/password', b),
  goals: () => request<Goal>('GET', '/api/student/goals'),
  setGoals: (b: { questionsPerDay: number; lessonsPerDay: number }) => request<Goal>('PUT', '/api/student/goals', b),
  activity: (b: { kind: 'TOPIC_VIEW' | 'LESSON_VIEW'; nodeId?: string; resourceId?: string }) => request<{ recorded: boolean }>('POST', '/api/student/activity', b),
  bookmarks: () => request<Bookmark[]>('GET', '/api/student/bookmarks'),
  bookmarkState: (kind: BookmarkKind, ids: string[]) => request<string[]>('GET', `/api/student/bookmarks/state?kind=${kind}&ids=${ids.map(encodeURIComponent).join(',')}`),
  addBookmark: (b: { kind: BookmarkKind; entityId: string }) => request<{ bookmarked: boolean }>('POST', '/api/student/bookmarks', b),
  removeBookmark: (b: { kind: BookmarkKind; entityId: string }) => request<{ bookmarked: boolean }>('POST', '/api/student/bookmarks/remove', b),
  // Flashcards and revision. The day is the student's own calendar day.
  cards: (f: { paperId?: string | null; chapterId?: string | null; nodeId?: string | null; due?: boolean } = {}) =>
    request<Flashcard[]>('GET', `/api/student/flashcards?day=${localDay()}${f.paperId ? `&paperId=${encodeURIComponent(f.paperId)}` : ''}${f.chapterId ? `&chapterId=${encodeURIComponent(f.chapterId)}` : ''}${f.nodeId ? `&nodeId=${encodeURIComponent(f.nodeId)}` : ''}${f.due ? '&due=1' : ''}`),
  topicCards: (nodeId: string) => request<TopicCards>('GET', `/api/student/flashcards/topic/${encodeURIComponent(nodeId)}?day=${localDay()}`),
  cardSummary: () => request<CardSummary>('GET', `/api/student/flashcards/summary?day=${localDay()}`),
  cardQueue: (f: { paperId?: string | null; chapterId?: string | null; nodeId?: string | null } = {}) =>
    request<{ day: string; due: number; cards: Flashcard[] }>('GET', `/api/student/flashcards/queue?day=${localDay()}&limit=100${f.paperId ? `&paperId=${encodeURIComponent(f.paperId)}` : ''}${f.chapterId ? `&chapterId=${encodeURIComponent(f.chapterId)}` : ''}${f.nodeId ? `&nodeId=${encodeURIComponent(f.nodeId)}` : ''}`),
  cardState: (keys: string[]) => request<{ conceptKey: string; id: string; reviewed: boolean }[]>('POST', '/api/student/flashcards/state', { keys }),
  createCard: (conceptKey: string) => request<{ created: boolean; card: Flashcard }>('POST', '/api/student/flashcards', { conceptKey, day: localDay() }),
  importCards: (from: { resourceId: string } | { nodeId: string }, types?: ConceptType[]) => request<CardImport>('POST', '/api/student/flashcards/import', { ...from, ...(types ? { types } : {}), day: localDay() }),
  reviewCard: (id: string, rating: CardRating) => request<Flashcard>('POST', `/api/student/flashcards/${id}/review`, { rating, day: localDay() }),
  /** A card that has been revised is removed only with `confirm` (the student agreed to lose its progress). */
  deleteCard: (id: string, confirm = false) => request<{ deleted: boolean; reviewsRemoved: number }>('DELETE', `/api/student/flashcards/${id}${confirm ? '?confirm=1' : ''}`),
  plan: (from: string, to: string) => request<PlanItem[]>('GET', `/api/student/plan?from=${from}&to=${to}`),
  addPlan: (b: { day: string; kind: PlanKind; refId?: string | null; title: string }) => request<{ id: string }>('POST', '/api/student/plan', b),
  updatePlan: (id: string, b: { day?: string; title?: string; done?: boolean }) => request<{ id: string }>('PATCH', `/api/student/plan/${id}`, b),
  deletePlan: (id: string) => request<{ deleted: boolean }>('DELETE', `/api/student/plan/${id}`),
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
  setEmailSettings: (b: { emailReminders: boolean }) => request<EmailSettings>('PUT', '/api/student/email', b),
  sendVerification: () => request<{ sent: boolean; reason?: string }>('POST', '/api/student/email/verification'),
  unsubscribe: (token: string) => request<{ unsubscribed: boolean }>('POST', '/api/public/email/unsubscribe', { token }),
  search: (q: string, exam?: ExamCode | '') => request<SearchResults>('GET', `/api/learn/search?q=${encodeURIComponent(q)}${exam ? `&exam=${exam}` : ''}`),
  officialInfo: (exam: ExamCode) => request<OfficialInfo>('GET', `/api/public/info/${exam}`),
  universities: (exam: ExamCode, q?: string, type?: string) =>
    request<UniversityList>('GET', `/api/public/universities?exam=${exam}${q ? `&q=${encodeURIComponent(q)}` : ''}${type ? `&type=${encodeURIComponent(type)}` : ''}`),
};
