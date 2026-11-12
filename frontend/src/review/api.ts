/** Reviewer API client (signed-in reviewers only; the session cookie carries identity). */
import { request, type ExamCode } from '../api';

export type QueueState = 'NEEDS_REVIEW' | 'NEEDS_TRANSCRIPTION' | 'TRANSCRIPTION_IN_REVIEW' | 'MACHINE_VERIFIED' | 'HUMAN_VERIFIED' | 'NOT_IMPORTED';
export interface QueueItem {
  paperId: string; code: string; name: string; category: string | null; state: QueueState;
  versionId: string | null; versionNumber: number | null; versionStatus: string | null; versionVerification: string | null;
  reason: string | null;
  rows: { total: number; verified: number; machine: number; pending: number; flagged: number; rejected: number; guessedHeadings: number; failingCheck: number };
  pagesToCheck: number;
  lastActivity: string | null;
}
export interface RowCheck { ok: boolean; missingOnPage: string[]; secondExtractorAgreementPct: number; flags: string[] }
export interface ReviewNode {
  id: string; parent_id: string | null; kind: string; label: string | null; title: string; body: string | null; position: number; depth: number;
  source_page: number | null; extraction_flags: string | null; check_json: string | null; verification: string;
  authored_by: string | null; edited_by: string | null; updated_at: string; last_review: string | null; review_count: number;
}
export interface PageCheck { page: number; method: string; status: string; ocr_words: number; found_words: number; found_pct: number | null; missing_sample: string | null }
export interface Workspace {
  paper: { id: string; code: string; name: string; exam: ExamCode; year: number; job_status: string | null; blocker_reason: string | null; source_url: string | null };
  version: { id: string; version_number: number; status: string; verification: string; notes: string | null; source_id: string | null; source_title: string | null; source_url: string | null; source_sha256: string | null; page_count: number | null } | null;
  nodes: ReviewNode[];
  pageChecks: PageCheck[];
  people: Record<string, string>;
}
export interface HistoryItem { id: string; action: string; from_status: string | null; to_status: string | null; actor: string; actorName: string; comment: string | null; checklist_json: string | null; created_at: string }
export interface Me { id: string; email: string; displayName: string; roles: string[]; permissions: string[] }
export const KINDS = ['PART', 'SECTION', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM', 'NOTE'] as const;
export interface NewRow { ref: string; parentRef: string | null; kind: string; label: string | null; title: string; body: string | null }

export const reviewApi = {
  me: () => request<Me>('GET', '/api/review/me'),
  queue: (exam: ExamCode, year: number) => request<QueueItem[]>('GET', `/api/review/queue?exam=${exam}&year=${year}`),
  paper: (paperId: string) => request<Workspace>('GET', `/api/review/papers/${paperId}`),
  history: (entityType: string, entityId: string) => request<HistoryItem[]>('GET', `/api/review/history?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`),
  edit: (id: string, b: { kind?: string; label?: string | null; title?: string; body?: string | null; sourcePage?: number; reason: string }) =>
    request<{ changed: string[] }>('POST', `/api/review/nodes/${id}/edit`, b),
  move: (id: string, direction: 'up' | 'down' | 'indent' | 'outdent') => request<unknown>('POST', `/api/review/nodes/${id}/move`, { direction }),
  addRows: (versionId: string, b: { parentId: string | null; afterId?: string; page: number; transcription: boolean; reason: string; rows: NewRow[] }) =>
    request<{ created: { ref: string; id: string }[] }>('POST', `/api/review/versions/${versionId}/rows`, b),
  decide: (b: { entityType: string; entityIds: string[]; action: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED'; comment?: string; checklist?: Record<string, boolean> }) =>
    request<{ applied: number; skipped: number }>('POST', '/api/review/decide', b),
  signOff: (versionId: string, b: { comment?: string; checklist: Record<string, boolean> }) => request<unknown>('POST', `/api/review/versions/${versionId}/sign-off`, b),
  sourceUrl: (sourceId: string) => `/api/review/sources/${sourceId}/file`,
};

export const parseCheck = (n: ReviewNode): RowCheck | null => {
  if (!n.check_json) return null;
  try {
    return JSON.parse(n.check_json) as RowCheck;
  } catch {
    return null;
  }
};
export const flagsOf = (n: ReviewNode) => (n.extraction_flags ?? '').split(',').map((f) => f.trim()).filter(Boolean);
