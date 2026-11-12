/** Thin client for the CUET API. Cookies carry the session; nothing secret lives in the browser. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export type ExamCode = 'CUET_UG' | 'CUET_PG';
export interface Exam { code: ExamCode; name: string; level: string; year: number; label: string; rules: Record<string, number | string | boolean> }
export interface Subject {
  paperId: string; code: string; name: string; category: { code: string | null; name: string | null };
  available: boolean; preview: boolean; verification: string | null; units: number; topics: number; questions: number;
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
export interface Block { position: number; type: string; body: string; media_asset_id: string | null; alt_text: string | null; caption: string | null; media_kind: string | null }
export interface ResourceDetail { resource: { id: string; type: string; title: string; origin: string; verification: string; status: string; preview: boolean }; blocks: Block[] }
export interface User { id: string; email: string; displayName: string; roles: string[] }
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
}

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
};
