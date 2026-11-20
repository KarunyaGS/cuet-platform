/** Admin console and reviewer content-review API calls (staff sign in with their own account). */
import { request, type AdmissionFact, type ExamCode, type GovNotice, type RevisionKind } from '../api';

export interface AdminNotice extends GovNotice { status: string; statusNote: string | null; authenticityNote: string | null; autoPublished: boolean; duplicateOfId: string | null }
export interface AdminNoticeList { total: number; notices: AdminNotice[] }
export interface NoticeHistory {
  notice: { id: string; title: string; authority: string; status: string; statusNote: string | null; authenticityNote: string | null; documentUrl: string; sourceUrl: string; revisionKind: RevisionKind | null; revisionOfId: string | null };
  versions: { version: number; title: string; description: string | null; publishedOn: string | null; documentUrl: string; reason: string; detectedAt: string }[];
  events: { action: string; actor: string; from: string | null; to: string | null; note: string | null; at: string }[];
}
export interface Registry {
  notices: { registry: 'NOTICES'; key: string; name: string; url: string; authority: string; dataType: string; reliability: string; updateFrequency: string; lastCheckedOn: string | null; state: string; lastError: string | null }[];
  admissions: AdmissionSourceRow[];
}
export interface AdminProgramme {
  id: string; universitySlug: string; universityName: string; universityType: string | null; programmeName: string; degree: string | null; level: string; academicYear: string; exam: ExamCode;
  lastVerifiedOn: string; status: string; statusNote: string | null; reliability: string; sourceUrl: string | null; sourceTitle: string | null; sourcePage: number | null; sourceLocator: string | null; publishedFacts: number;
}
export interface Outdated { staleAfterDays: number; total: number; items: { type: 'PROGRAMME' | 'FACT' | 'SOURCE'; id: string; label: string; university: string | null; lastVerifiedOn: string | null; reason: string }[] }
export interface AdmissionsOverview { sources: { proposed: number; approved: number; retired: number }; facts: { draft: number; published: number; rejected: number } }
export interface AdmissionSourceRow {
  id: string; universitySlug: string | null; universityName: string | null; url: string; title: string; kind: string; covers: string; format: string; updateFrequency: string | null;
  reliabilityNote: string | null; personalDataRisk: string; recommendation: string; status: string; reviewedBy: string | null; reviewedAt: string | null; lastCheckedOn: string | null; publishedFacts: number; draftFacts: number;
}
export interface NoticeOverview {
  enabled: boolean; intervalMinutes: number; lastSuccessfulFetch: string | null; nextScheduledFetch: string | null;
  collected: number; published: number; newInSevenDays: number; updatedInSevenDays: number; duplicates: number; awaitingVerification: number; failedSources: number;
  sources: { key: string; name: string; url: string; authority: 'NTA' | 'UGC'; lastCheckedAt: string | null; lastSuccessAt: string | null; lastError: string | null; consecutiveFailures: number; nextCheckAt: string | null; found: number; added: number; updated: number; duplicates: number; queued: number }[];
}

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
export interface ContentItem { id: string; title: string; type: string; difficulty: string | null; status: string; verification: string; origin: string; updatedAt: string; bulkApproved?: boolean; paperId: string | null; paperCode: string | null; paper: string | null }
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

export interface SupportRow { id: string; kind: 'CHAT' | 'TICKET'; reference: string | null; category: string | null; categoryLabel: string | null; title: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; lastMessageAt: string; createdAt: string; student: { email: string; name: string }; messages: number; waitingForSupport: boolean }
export interface SupportDetail { thread: Omit<SupportRow, 'messages' | 'waitingForSupport'>; messages: { id: string; from: 'STUDENT' | 'SUPPORT'; body: string; at: string; attachment: { name: string | null; mime: string | null; bytes: number | null } | null }[] }

export const consoleApi = {
  supportThreads: (q: { status?: string; kind?: string; q?: string }) => request<SupportRow[]>('GET', `/api/console/support/threads?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`),
  supportThread: (id: string) => request<SupportDetail>('GET', `/api/console/support/threads/${id}`),
  supportReply: (id: string, body: string) => request<SupportDetail>('POST', `/api/console/support/threads/${id}/messages`, { body }),
  supportStatus: (id: string, status: string) => request<SupportDetail>('PUT', `/api/console/support/threads/${id}/status`, { status }),
  me: () => request<StaffMe>('GET', '/api/console/me'),
  overview: () => request<Overview>('GET', '/api/console/overview'),
  email: () => request<EmailOverview>('GET', '/api/console/email'),
  emailTemplates: () => request<{ templates: string[] }>('GET', '/api/console/email/templates'),
  emailPreview: (t: string) => request<{ subject: string; html: string; text: string }>('GET', `/api/console/email/preview/${t}`),
  emailTest: (templates?: string[]) => request<{ to: string; results: { template: string; status: string }[] }>('POST', '/api/console/email/test', templates ? { templates } : {}),
  noticeOverview: () => request<NoticeOverview>('GET', '/api/console/notices/overview'),
  noticeQueue: () => request<(GovNotice & { statusNote: string | null })[]>('GET', '/api/console/notices/queue'),
  noticeFetch: () => request<{ ran: boolean }>('POST', '/api/console/notices/fetch', {}),
  admissions: () => request<AdmissionsOverview>('GET', '/api/console/admissions/overview'),
  admissionSources: () => request<AdmissionSourceRow[]>('GET', '/api/console/admissions/sources'),
  loadAdmissionSources: () => request<{ added: number; total: number }>('POST', '/api/console/admissions/sources/load-reviewed', {}),
  decideAdmissionSource: (id: string, b: { action: 'APPROVE' | 'RETIRE'; checkedOn?: string; note?: string }) => request<unknown>('POST', `/api/console/admissions/sources/${id}/decision`, b),
  admissionFacts: (status?: string) => request<AdmissionFact[]>('GET', `/api/console/admissions/facts${status ? `?status=${status}` : ''}`),
  addAdmissionFact: (b: unknown) => request<{ id: string }>('POST', '/api/console/admissions/facts', b),
  decideAdmissionFact: (id: string, b: { action: 'PUBLISH' | 'REJECT'; reason?: string }) => request<unknown>('POST', `/api/console/admissions/facts/${id}/decision`, b),
  adminNotices: (f: { status?: string; authority?: string; revisions?: boolean; q?: string; offset?: number } = {}) => {
    const qs = new URLSearchParams({ limit: '30', ...Object.fromEntries(Object.entries({ ...f, revisions: f.revisions ? '1' : '' }).filter(([, v]) => v !== undefined && v !== '' && v !== 0).map(([k, v]) => [k, String(v)])) });
    return request<AdminNoticeList>('GET', `/api/console/notices?${qs}`);
  },
  noticeHistory: (id: string) => request<NoticeHistory>('GET', `/api/console/notices/${id}/history`),
  registry: () => request<Registry>('GET', '/api/console/registry'),
  admissionProgrammes: () => request<AdminProgramme[]>('GET', '/api/console/admissions/programmes'),
  addProgramme: (b: unknown) => request<{ id: string }>('POST', '/api/console/admissions/programmes', b),
  decideProgramme: (id: string, b: { action: 'PUBLISH' | 'REJECT' | 'WITHDRAW'; reason?: string }) => request<unknown>('POST', `/api/console/admissions/programmes/${id}/decision`, b),
  admissionOutdated: () => request<Outdated>('GET', '/api/console/admissions/outdated'),
  requirements: (q: { status?: string; university?: string; q?: string; all?: boolean; offset?: number } = {}) =>
    request<ReqList>('GET', `/api/console/admissions/requirements?${new URLSearchParams({ limit: '40', ...Object.fromEntries(Object.entries({ ...q, all: q.all ? '1' : '' }).filter(([, v]) => v !== undefined && v !== '' && v !== 0).map(([k, v]) => [k, String(v)])) })}`),
  requirement: (id: string) => request<ReqDetail>('GET', `/api/console/admissions/requirements/${id}`),
  readRequirements: (dryRun: boolean) => request<{ examined: number; created: number; unchanged: number; noPrintedRule: number; superseded: number; byStatus: Record<string, number>; dryRun: boolean }>('POST', `/api/console/admissions/requirements/propose${dryRun ? '?dryRun=1' : ''}`, {}),
  decideRequirement: (id: string, b: { action: 'APPROVE' | 'REJECT' | 'NEEDS_UNIVERSITY_CONFIRMATION' | 'REOPEN'; note: string }) => request<ReqDetail>('POST', `/api/console/admissions/requirements/${id}/decision`, b),
  reviseRequirement: (id: string, b: unknown) => request<ReqDetail>('POST', `/api/console/admissions/requirements/${id}/revise`, b),
  admissionGroups: () => request<GroupRow[]>('GET', '/api/console/admissions/groups'),
  admissionGroup: (id: string) => request<GroupDetailAdmin>('GET', `/api/console/admissions/groups/${id}`),
  decideGroup: (id: string, b: { action: 'PUBLISH' | 'REJECT' | 'WITHDRAW'; note: string; confirmMembers?: string[] }) => request<GroupDetailAdmin>('POST', `/api/console/admissions/groups/${id}/decision`, b),
  admissionValidation: () => request<AdmissionValidation>('GET', '/api/console/admissions/validation'),
  noticeDecision: (id: string, b: { action: 'PUBLISH' | 'REJECT' | 'FLAG' | 'WITHDRAW'; exam?: 'CUET_UG'; reason?: string }) => request<{ id: string; status: string }>('POST', `/api/console/notices/${id}/decision`, b),
  officialLinks: () => request<AdminOfficialLink[]>('GET', '/api/console/official-papers'),
  officialLinkStatus: (id: string, b: { action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'ALLOW_IN_APP' | 'DISALLOW_IN_APP'; linkingBasis?: string; embedBasis?: string; conditionsChecked?: boolean }) => request<AdminOfficialLink>('POST', `/api/console/official-papers/${id}/status`, b),
  mockReadiness: (paperId: string) => request<MockReadiness>('GET', `/api/console/mock-papers/readiness/${paperId}`),
  mockPapers: (paperId: string) => request<AdminMockPaper[]>('GET', `/api/console/mock-papers?paperId=${paperId}`),
  mockPaper: (id: string) => request<AdminMockPaper & { items: { position: number; id: string; type: string; difficulty: string; verification: string; stem: string; unit_label: string | null; unit_title: string | null }[] }>('GET', `/api/console/mock-papers/${id}`),
  buildMock: (paperId: string) => request<AdminMockPaper>('POST', `/api/console/mock-papers/build/${paperId}`),
  mockStatus: (id: string, action: 'APPROVE' | 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE', note?: string) => request<AdminMockPaper>('POST', `/api/console/mock-papers/${id}/status`, { action, note }),
  pastPapers: () => request<AdminPastPaper[]>('GET', '/api/console/past-papers'),
  pastPaper: (id: string) => request<AdminPastPaperQuestions>('GET', `/api/console/past-papers/${id}`),
  pastPaperStatus: (id: string, action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE') => request<AdminPastPaper>('POST', `/api/console/past-papers/${id}/status`, { action }),
  topicMappingQueue: (f: { paperId?: string; page?: number; pageSize?: number }) => request<TopicMappingQueue>('GET', `/api/console/topic-weightage/queue?${qs(f)}`),
  saveTopicMapping: (entryId: string, b: { action: 'SUGGEST' | 'VERIFY' | 'UNRESOLVED' | 'REJECT'; curriculumNodeId?: string | null; confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null; method?: 'MANUAL' | 'AI_ASSISTED'; evidenceNote?: string | null; sourceChecked?: boolean }) => request<unknown>('POST', `/api/console/topic-weightage/${entryId}/decision`, b),
  topicWeightageReport: (f: { exam?: string; paperId?: string }) => request<WeightageReport[]>('GET', `/api/console/topic-weightage/report?${qs(f)}`),
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
export interface AdminPlan { id: string; code: string; name: string; description: string | null; pricePaise: number; currency: string; durationDays: number | null; isFree: boolean; active: boolean; sortOrder: number; limits: { mockTests?: number | null; topicTests?: number | null; practiceSets?: number | null; revisionCards?: number | null; bookmarks?: number | null; }; features: string[] }
export type PlanInput = Omit<AdminPlan, 'id' | 'code' | 'currency' | 'isFree'>;
export interface BillingOverview {
  gateway: { mode: string; gateway: string | null; ready: boolean; reason: string | null }; activeSubscribers: number;
  needsAttention: { orderId: string; receipt: string; expectedPaise: number; paidPaise: number; gatewayPaymentId: string; at: string }[];
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
export interface TopicMappingQueue {
  page: number; pageSize: number; total: number; pages: number;
  items: {
    entryId: string; position: number; officialQuestionId: string | null; sourcePage: number | null; paperId: string;
    exam: string; year: number; subjectCode: string; subjectName: string; paperTitle: string; paperStatus: string; keyVersion: string;
    sourceUrl: string | null; questionId: string; stem: string; origin: string; questionVerification: string; sourceLocator: string | null;
    exactTestPaperId: string | null; syllabusVersionId: string | null; syllabusVersionNumber: number | null; syllabusStatus: string | null; syllabusVerification: string | null;
    mapping: { id: string; nodeId: string | null; status: string; confidence: string | null; method: string; evidenceNote: string | null; title: string | null; kind: string | null } | null;
    syllabusUrl: string | null; topics: { id: string; title: string; kind: string; depth: number; path: string; sourcePage: number | null }[]; historyCount: number;
  }[];
}
export interface WeightageReport {
  exam: string; year: number; subjectCode: string; subjectName: string; testPaperId: string; syllabusVersionId: string; syllabusVersionNumber: number;
  sampleSize: number; mappedCount: number; paperCount: number; mappingCoveragePercent: number; yearCoverage: number[];
  sourcePapers: { title: string; year: number; examDate: string | null; shift: string | null; subjectCode: string; sourceUrl: string }[];
  topics: { id: string; title: string; kind: string; questionCount: number; percentOfPaperSample: number | null }[];
}
export interface AdminOfficialLink { id: string; exam: string; year: number; subjectCode: string | null; subjectName: string | null; session: string | null; kind: string; available: boolean; url: string | null; title: string; note: string | null; checkedOn: string; status: string; key: string; linkingBasis: string | null; linkingCheckedBy: string | null; publishedAt: string | null; embedBasis: string | null; viewerMode: 'DIRECT' | 'PROXY' | 'NEW_TAB' | null; inAppViewing: boolean }
export interface MockBlueprint { basis: string; pattern: { questions: number; durationMinutes: number; marksCorrect: number; marksIncorrect: number; optionsPerQuestion: number }; units: { id: string; label: string | null; title: string; syllabusRows: number; questions: number }[]; result: { difficulty: Record<string, number>; formats: Record<string, number>; topicsCovered: number } }
export interface AdminMockPaper { id: string; paperId: string; subjectCode: string; subjectName: string; exam: string; number: number; title: string; status: string; questions: number; allQuestionsApproved: boolean; blueprint: MockBlueprint; approvedBy: string | null; approvedAt: string | null; approvalNote: string | null; publishedAt: string | null }
export interface MockReadiness {
  subject: { paperId: string; code: string; name: string; exam: string; year: number }; pattern: MockBlueprint['pattern']; basis: string;
  bank: { questions: number; approvedByReviewer: number; notMatchingOptionCount: number; eligibleUnused: number };
  perUnit: { id: string; label: string | null; title: string; syllabusRows: number; needed: number; available: number }[]; perDifficulty: { difficulty: string; needed: number; available: number }[]; ready: boolean; shortfalls: string[];
}
export interface EmailOverview {
  enabled: boolean; providers: string[]; senderSet: boolean; appUrlSet: boolean;
  last7Days: { kind: string; status: string; n: number }[];
  suppressions: { reason: string; n: number }[];
  recentFailures: { kind: string; status: string; provider: string | null; last_error: string | null; created_at: string }[];
  retries: { waiting: number; gaveUpLast7Days: number; recoveredLast7Days: number };
  optedIn: { studyReminders: number; noticeAlerts: number; revisionReminders: number; examDatesEntered: number };
  readiness: { key: string; label: string; ok: boolean }[];
}
export const when = (iso: string | null) => (iso ? new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never');

export interface ReqIssue { code: string; severity: 'BLOCKING' | 'REVIEW' | 'INFO'; message: string; text?: string }
export interface ReqRule {
  family: string; status: string; evaluable: boolean; groupsNeeded: string[];
  combinations: { label: string; requirements: unknown[]; effective: unknown[] }[];
  extraTests: { kind: string; text: string }[];
  resolutions?: Record<string, { note: string; sourceUrl?: string; by: string; at: string }>;
}
export interface ReqItem {
  id: string; version: number; status: string; origin: string; family: string; parserVersion: string;
  programme: { id: string; name: string; university: string; universitySlug: string; status: string; degree: string | null; campus: string | null };
  source: { sourceUrl: string; sourceTitle: string; sourceStatus: string; sourcePage: number | null; sourceLocator: string | null; academicYear: string; examCode: string; lastVerifiedOn: string; factId: string | null; factStatus: string | null };
  printedText: string; printedTextChanged: boolean; factFlagged: boolean; factFlag: string | null;
  rule: ReqRule; openIssues: ReqIssue[]; approvalBlockers: ReqIssue[]; canApprove: boolean;
  reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null; createdBy: string; createdAt: string;
}
export interface ReviewEvent { action: string; actor: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string; snapshot: unknown }
export interface ReqDetail extends ReqItem { history: ReviewEvent[]; versions: { id: string; version: number; status: string; origin: string }[] }
export interface ReqList { total: number; byStatus: Record<string, number>; items: ReqItem[] }
export interface GroupRow { id: string; university_slug: string; group_code: string; title: string; academic_year: string; exam_code: string; version: number; status: string; source_page: number | null; checked_on: string; members: number; needs_attention: number }
export interface GroupDetailAdmin {
  id: string; university_slug: string; group_code: string; title: string; academic_year: string; version: number; status: string; source_url: string; source_title: string; source_page: number | null; source_locator: string | null; checked_on: string;
  members: { id: string; position: number; printed_name: string; paper_code: string | null; mapping_status: string; note: string | null }[];
  history: ReviewEvent[];
}
export interface AdmissionValidation { summary: Record<string, number>; findings: { level: string; severity: 'ERROR' | 'WARNING' | 'INFO'; id: string; label: string; message: string }[] }
