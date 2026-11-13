/** Admin console and reviewer content-review API calls (staff sign in with their own account). */
import { request, type ExamCode } from '../api';

export interface StaffMe { id: string; email: string; displayName: string; roles: string[]; permissions: string[] }
export interface ActivityItem { id: string; actor: string; actorName: string; action: string; entityType: string; entityId: string; entityLabel: string | null; detail: string | null; createdAt: string }
export interface Overview {
  counts: Record<string, number>;
  content: { type: 'QUESTION' | 'LESSON'; status: string; verification: string; n: number }[];
  syllabus: { exam: ExamCode; papers: number; human_verified: number; machine_verified: number; with_questions: number }[];
  recentActivity: ActivityItem[];
}
export interface StudentRow { id: string; email: string; displayName: string; status: 'ACTIVE' | 'DISABLED'; createdAt: string; lastLoginAt: string | null; roles: string[]; tests: number; lastPractice: string | null }
export interface StudentDetail extends Omit<StudentRow, 'tests' | 'lastPractice'> {
  totals: { sessions: number; answered: number; accuracy: number | null };
  preferences: { examCode: string | null; targetYear: number | null; subjects: number } | null;
  subjects: { paper: string; code: string; attempted: number; correct: number; accuracy: number | null }[];
  recentSessions: { id: string; mode: string; status: string; score: number | null; max_score: number | null; started_at: string; paper: string | null }[];
  bookmarks: number; planItems: number; openSessions: number;
}
export interface StaffList {
  staff: { id: string; email: string; displayName: string; status: string; lastLoginAt: string | null; roles: string[]; decisions: number }[];
  roles: { code: string; name: string; members: number; permissions: string[] }[];
}
export interface Assignment {
  id: string; scope: 'SYLLABUS' | 'CONTENT'; note: string | null; createdAt: string;
  reviewer: { id: string; displayName: string; email: string };
  paper: { id: string; code: string; name: string; exam: ExamCode };
  progress: { total: number; decided: number };
}
export type ContentType = 'QUESTION' | 'LEARNING_RESOURCE';
export interface ContentItem { id: string; title: string; type: string; difficulty: string | null; status: string; verification: string; origin: string; updatedAt: string; paperId: string | null; paperCode: string | null; paper: string | null }
export interface ContentList { total: number; byVerification: { verification: string; n: number }[]; items: ContentItem[] }
export interface ContentFilter { type: ContentType; paperId?: string; verification?: string; status?: string; q?: string; page?: number }
export interface PaperOption { id: string; code: string; name: string; exam: ExamCode }
export interface QuestionFull {
  id: string; testPaperId: string | null; type: string; stem: string; language: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; learningObjective: string | null; passageId: string | null;
  structureJson: string | null; origin: string; usagePermissionId: string; sourceDocumentId: string | null; sourceLocator: string | null; isDemonstration: boolean; status: string; verification: string;
  options: { position: number; label: string; text: string; mediaAssetId: string | null }[];
  answerKey: { correctOptionPositions: string | null; numericAnswer: number | null; numericTolerance: number | null } | null;
  explanations: { body: string; optionRationaleJson: string | null }[];
  topics: { curriculumNode: { id: string; title: string; kind: string; label: string | null } }[];
  passage: { title: string | null; body: string } | null;
  testPaper: { id: string; code: string; name: string } | null;
}
export interface LessonFull {
  id: string; curriculumNodeId: string | null; testPaperId: string | null; type: 'LESSON' | 'NOTE' | 'READING' | 'VIDEO'; title: string; language: string; origin: string; usagePermissionId: string; isDemonstration: boolean;
  status: string; verification: string;
  blocks: { position: number; type: string; body: string; mediaAssetId: string | null; mediaAsset: { altText: string | null; caption: string | null } | null }[];
  curriculumNode: { id: string; title: string } | null;
}
export interface PaperCoverage {
  testPaperId: string; code: string; name: string;
  syllabus: null | { verification: string; unitsImported: number; learningPoints: number; verified: number; machineVerified: number; withLearningContent: number; withQuestions: number; missingLearningContent: number; missingQuestions: number };
  questionsLinkedToPaper: number; resourcesLinkedToPaper: number;
}
export interface ReviewerDashboard {
  content: { type: ContentType; verification: string; n: number }[];
  syllabusRows: { verification: string; n: number }[];
  myDecisions: number;
  myRecent: { id: string; entity_type: string; entity_id: string; action: string; to_status: string | null; comment: string | null; created_at: string }[];
  assignments: Assignment[];
}
export interface HistoryRow { id: string; action: string; from_status: string | null; to_status: string | null; actor: string; actorName?: string; comment: string | null; created_at: string }

const qs = (o: object) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  return p.toString();
};

export const consoleApi = {
  me: () => request<StaffMe>('GET', '/api/console/me'),
  overview: () => request<Overview>('GET', '/api/console/overview'),
  email: () => request<EmailOverview>('GET', '/api/console/email'),
  pastPapers: () => request<AdminPastPaper[]>('GET', '/api/console/past-papers'),
  pastPaper: (id: string) => request<AdminPastPaperQuestions>('GET', `/api/console/past-papers/${id}`),
  pastPaperStatus: (id: string, action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE') => request<AdminPastPaper>('POST', `/api/console/past-papers/${id}/status`, { action }),
  billing: () => request<BillingOverview>('GET', '/api/console/billing'),
  plans: () => request<AdminPlan[]>('GET', '/api/console/billing/plans'),
  updatePlan: (id: string, b: PlanInput) => request<AdminPlan>('PUT', `/api/console/billing/plans/${id}`, b),
  subscriptions: (f: { q?: string; page?: number }) => request<{ total: number; pageSize: number; items: AdminSubscription[] }>('GET', `/api/console/billing/subscriptions?${qs(f)}`),
  grantAccess: (b: { email: string; planCode: string; days: number; note: string }) => request<{ id: string; startsAt: string; endsAt: string; plan: string }>('POST', '/api/console/billing/subscriptions', b),
  cancelSubscription: (id: string, reason: string) => request<{ cancelled: boolean }>('POST', `/api/console/billing/subscriptions/${id}/cancel`, { reason }),
  orders: (f: { q?: string; status?: string; page?: number }) => request<{ total: number; pageSize: number; items: AdminOrder[] }>('GET', `/api/console/billing/orders?${qs(f)}`),
  order: (id: string) => request<AdminOrderDetail>('GET', `/api/console/billing/orders/${id}`),
  reconcileOrder: (id: string) => request<Reconciled>('POST', `/api/console/billing/orders/${id}/reconcile`),
  reconcileAll: () => request<Reconciled>('POST', '/api/console/billing/reconcile'),
  recordRefund: (id: string, b: { gatewayRefundId: string; amountPaise: number }) => request<{ refunded: boolean }>('POST', `/api/console/billing/orders/${id}/refund`, b),
  students: (f: { q?: string; status?: string; page?: number }) => request<{ total: number; items: StudentRow[] }>('GET', `/api/console/students?${qs(f)}`),
  student: (id: string) => request<StudentDetail>('GET', `/api/console/students/${id}`),
  setStatus: (id: string, status: 'ACTIVE' | 'DISABLED', reason?: string) => request<unknown>('POST', `/api/console/students/${id}/status`, { status, reason }),
  resetLink: (email: string) => request<{ path: string; expiresAt: string }>('POST', '/api/console/students/reset-link', { email }),
  staff: () => request<StaffList>('GET', '/api/console/staff'),
  setRole: (email: string, role: string, grant: boolean) => request<unknown>('POST', '/api/console/roles', { email, role, grant }),
  assignments: () => request<Assignment[]>('GET', '/api/console/assignments'),
  assign: (b: { email: string; paperId: string; scope: 'SYLLABUS' | 'CONTENT'; note?: string }) => request<unknown>('POST', '/api/console/assignments', b),
  unassign: (id: string) => request<unknown>('DELETE', `/api/console/assignments/${id}`),
  activity: (f: { action?: string; page?: number }) => request<{ total: number; actions: { action: string; n: number }[]; items: ActivityItem[] }>('GET', `/api/console/activity?${qs(f)}`),
  coverage: (exam: ExamCode) => request<PaperCoverage[]>('GET', `/api/console/coverage?exam=${exam}`),
  content: (f: ContentFilter) => request<ContentList>('GET', `/api/console/content?${qs(f)}`),
  papers: () => request<PaperOption[]>('GET', '/api/console/content/papers'),
  question: (id: string) => request<QuestionFull>('GET', `/api/console/questions/${id}`),
  saveQuestion: (id: string, b: unknown) => request<unknown>('PUT', `/api/console/questions/${id}`, b),
  deleteQuestion: (id: string) => request<unknown>('DELETE', `/api/console/questions/${id}`),
  lesson: (id: string) => request<LessonFull>('GET', `/api/console/resources/${id}`),
  saveLesson: (id: string, b: unknown) => request<unknown>('PUT', `/api/console/resources/${id}`, b),
  deleteLesson: (id: string) => request<unknown>('DELETE', `/api/console/resources/${id}`),
  workflow: (entityType: ContentType, id: string, action: string) => request<unknown>('POST', '/api/console/content/workflow', { entityType, entityIds: [id], action }),
  history: (entityType: ContentType, id: string) => request<HistoryRow[]>('GET', `/api/console/content/history?entityType=${entityType}&entityId=${id}`),
};

export const reviewContentApi = {
  dashboard: () => request<ReviewerDashboard>('GET', '/api/review/dashboard'),
  content: (f: ContentFilter) => request<ContentList>('GET', `/api/review/content?${qs(f)}`),
  papers: () => request<PaperOption[]>('GET', '/api/review/content/papers'),
  question: (id: string) => request<QuestionFull>('GET', `/api/review/content/QUESTION/${id}`),
  lesson: (id: string) => request<LessonFull>('GET', `/api/review/content/LEARNING_RESOURCE/${id}`),
  decide: (entityType: ContentType, id: string, action: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED', comment: string, checklist?: Record<string, boolean>) =>
    request<{ applied: number }>('POST', '/api/review/decide', { entityType, entityIds: [id], action, comment: comment || undefined, checklist }),
  history: (entityType: ContentType, id: string) => request<HistoryRow[]>('GET', `/api/review/history?entityType=${entityType}&entityId=${id}`),
};

export const VERIFICATION: Record<string, { label: string; tone: 'zinc' | 'accent' | 'green' | 'amber' | 'red' }> = {
  UNVERIFIED: { label: 'Not reviewed', tone: 'zinc' },
  MACHINE_VERIFIED: { label: 'Machine-checked', tone: 'accent' },
  VERIFIED: { label: 'Approved by reviewer', tone: 'green' },
  NEEDS_CHANGES: { label: 'Changes requested', tone: 'amber' },
  REJECTED: { label: 'Rejected', tone: 'red' },
};
export const STATUS: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
export const ACTION_LABEL: Record<string, string> = {
  ACCOUNT_SUSPENDED: 'Suspended an account', ACCOUNT_RESTORED: 'Restored an account', ROLE_GRANTED: 'Granted a role', ROLE_REVOKED: 'Removed a role', CREATE_RESET_LINK: 'Created a password reset link',
  RESET_PASSWORD: 'Reset their password', REVIEW_ASSIGNED: 'Assigned a paper to a reviewer', REVIEW_UNASSIGNED: 'Removed a reviewer assignment', IMPORT_OFFICIAL_INFO: 'Imported official exam information',
  DELETE_QUESTION: 'Deleted a question', DELETE_RESOURCE: 'Deleted a lesson',
  CREATE_QUESTION: 'Created a question', UPDATE_QUESTION: 'Edited a question', CREATE_RESOURCE: 'Created a lesson', UPDATE_RESOURCE: 'Edited a lesson', CREATE_MEDIA: 'Added a diagram or image',
  IMPORT_SYLLABUS: 'Imported a syllabus', REGISTER_PAPERS: 'Registered papers', SOURCE_DOCUMENT_ISSUE: 'Recorded a source document issue', SOURCE_FIGURE_STORED: 'Stored a source figure',
  REVIEW_VERIFIED: 'Approved content as reviewer', REVIEW_CHANGES_REQUESTED: 'Requested changes to content', REVIEW_REJECTED: 'Rejected content', REVIEW_SUBMITTED: 'Sent content for review',
  REVIEW_APPROVED: 'Approved content for publishing', REVIEW_PUBLISHED: 'Published content', REVIEW_UNPUBLISHED: 'Unpublished content', REVIEW_ARCHIVED: 'Archived content', EDIT_NODE: 'Edited a syllabus row',
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, ' ');
export interface AdminPlan { id: string; code: string; name: string; description: string | null; pricePaise: number; currency: string; durationDays: number | null; isFree: boolean; active: boolean; sortOrder: number; limits: { mockTests?: number | null; topicTests?: number | null; practiceSets?: number | null }; features: string[] }
export type PlanInput = Omit<AdminPlan, 'id' | 'code' | 'currency' | 'isFree'>;
export interface BillingOverview {
  gateway: { mode: string; gateway: string | null; ready: boolean; reason: string | null }; activeSubscribers: number;
  last30Days: { paidOrders: number; receivedPaise: number; ordersByStatus: { status: string; n: number }[]; webhookResults: { result: string; n: number }[] };
}
export interface AdminSubscription { id: string; status: string; state: string; starts_at: string; ends_at: string; source: string; note: string | null; user_id: string; email: string; display_name: string; plan: string }
export interface AdminOrder { id: string; amount_paise: number; currency: string; status: string; gateway: string; gateway_order_id: string | null; receipt: string; plan: string; failure_reason: string | null; created_at: string; paid_at: string | null; user_id: string; email: string; display_name: string; reports: number }
export interface AdminOrderDetail {
  order: Record<string, string | number | null>;
  reports: { kind: string; gateway_id: string; status: string; amount_paise: number; method: string | null; error_code: string | null; error_description: string | null; reported_by: string; created_at: string }[];
  webhooks: { type: string; signature_valid: number; result: string; detail: string | null; received_at: string }[];
  pass: { id: string; status: string; starts_at: string; ends_at: string } | null;
}
interface Reconciled { checked: number; paid: number; failed: number; expired: number; stillOpen: number; errors: number }
export interface AdminPastPaper {
  id: string; exam: string; year: number; subjectCode: string; subjectName: string; title: string; questions: number; dropped: number; status: string; key: string; keyVersion: string; hasOfficialKey: boolean;
  permission: string; displayAllowed: boolean; sourceUrl: string; verified: number; flagged: number; publishedAt: string | null; blockers: string[];
}
export interface AdminPastPaperQuestions {
  paper: AdminPastPaper;
  questions: { position: number; dropped: boolean; officialQuestionId: string | null; sourcePage: number | null; questionId: string | null; type: string | null; stem: string | null; verification: string | null; options: { position: number; label: string; text: string }[]; key: number[] | null; numericAnswer: number | null; officialKey: number[] | null }[];
}
export interface EmailOverview {
  enabled: boolean; providers: string[]; senderSet: boolean; appUrlSet: boolean;
  last7Days: { kind: string; status: string; n: number }[];
  suppressions: { reason: string; n: number }[];
  recentFailures: { kind: string; status: string; provider: string | null; last_error: string | null; created_at: string }[];
}
export const when = (iso: string | null) => (iso ? new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never');
