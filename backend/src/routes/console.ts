/**
 * Admin console API: for signed-in staff (session cookie + role permissions), unlike /api/admin, which is the
 * shared-token API used by the import tools. Every action is recorded under the person's own account.
 *
 * Access: any of users:manage, content:write or content:publish opens the console; each route then checks its own permission.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { z } from 'zod';
import { ApiError, invalid } from '../lib/errors';
import { staffScope } from '../lib/scope-guard';
import { activeExams } from '../lib/scope';
import { readJson } from '../lib/http';
import { permissionsOf } from '../lib/reviewer';
import { createResetLink, resetLinkSchema, SESSION_COOKIE, userFromToken } from '../services/accounts';
import {
  activity, activityQuery, addAssignment, assignmentSchema, consoleOverview, contentPapers, contentQuery, listAssignments, listContent, listStaff, listStudents, needPermission,
  removeAssignment, setStudentStatus, statusSchema, studentDetail, studentQuery, type Staff,
} from '../services/admin-console';
import { paperCoverage } from '../services/coverage';
import { roleSchema, setRole } from '../services/maintenance';
import { deleteQuestion, getQuestionAdmin, questionInputSchema, updateQuestion } from '../services/questions';
import { deleteResource, getResource, resourceInputSchema, updateResource } from '../services/resources';
import { applyReview, reviewHistory, reviewSchema } from '../services/review';
import { admissionsOverview, createFact, createSource, decideFact, decideSource, factDecisionSchema, factInputSchema, importFacts, importSchema, listFacts, listSources, loadProposedSources, sourceDecisionSchema, sourceInputSchema, createProgramme, decideProgramme, importProgrammes, listProgrammesAdmin, outdatedItems, programmeDecisionSchema, programmeImportSchema, programmeInputSchema } from '../services/admissions';
import {
  createGroup, decideGroup, decideRequirement, groupDecisionSchema, groupDetail, groupInputSchema, listGroups, listRequirements, proposeRequirements, requirementDecisionSchema, requirementDetail, requirementQuery,
  reviseRequirement, revisionSchema, validateAdmissionData,
} from '../services/admission-review';
import { replySchema as supportReplySchema, staffAttachment, staffReply, staffSetStatus, staffStatusSchema, staffThread, staffThreads, staffThreadsQuery } from '../services/support';
import { emailOverview, previewEmail, previewSchema, sendTestEmails } from '../services/email';
import { TEMPLATE_NAMES } from '../services/email-templates';
import { buildMockPaper, linkActionSchema, listMockPapersAdmin, listOfficialLinksAdmin, mockActionSchema, mockPaperAdmin, mockPaperReadiness, setMockPaperStatus, setOfficialLinkStatus } from '../services/practice-centre';
import { listPastPapersAdmin, paperActionSchema, pastPaperQuestionsAdmin, setPastPaperStatus } from '../services/past-papers';
import {
  billingOverview, cancelSchema, cancelSubscription, createPlan, grantAccess, grantSchema, listOrders, listPlans, listSubscriptions, manualRefundSchema, orderDetail, orderQuery, planCreateSchema,
  planInputSchema, reconcileOrders, recordManualRefund, subscriptionQuery, updatePlan,
} from '../services/billing';
import { listTopicMappingQueue, saveTopicMapping, verifiedWeightageReport, weightageDecisionSchema, weightageQueueQuery } from '../services/topic-weightage';

const consoleAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await userFromToken(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in');
  const permissions = await permissionsOf(c.env.DB, user.id);
  if (!['users:manage', 'content:write', 'content:publish'].some((p) => permissions.includes(p))) throw new ApiError(403, 'FORBIDDEN', 'This account does not have admin access');
  c.set('user', { ...user, permissions });
  c.set('actor', `user:${user.id}`);
  await next();
};

import { decideNotice, noticeDecisionSchema, noticeOverview, noticeQueue, syncNotices, adminNotices, adminNoticeQuery, noticeHistory, noticeSourceRegistry } from '../services/gov-notices';
const admin = new Hono<AppEnv>();
admin.use('*', consoleAuth);
admin.use('*', staffScope); // CUET PG is not offered in the console either (visibility only)
// Least privilege (approved 16 Nov 2026): sending email, reading the email log and seeing who reviews what need the account-management
// permission, not just any staff role. Content editors and reviewers keep the content, notice and admissions screens.
admin.use('/email', (c, next) => (needPermission(me(c), 'users:manage', 'see the email log'), next()));
admin.use('/email/*', (c, next) => (needPermission(me(c), 'users:manage', 'preview or send email'), next()));
admin.use('/assignments', (c, next) => (c.req.method === 'GET' ? (needPermission(me(c), 'users:manage', 'see reviewer assignments'), next()) : next()));
const me = (c: { get(k: 'user'): AppEnv['Variables']['user'] }): Staff => {
  const u = c.get('user');
  return { id: u.id, displayName: u.displayName, permissions: u.permissions ?? [] };
};
const query = (c: { req: { query(): Record<string, string> } }) => Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''));

admin.get('/me', (c) => c.json(c.get('user')));
admin.get('/overview', async (c) => c.json(await consoleOverview(c.env.DB)));
// Email health: what was sent in the last 7 days, failures and suppressed addresses (no message bodies are stored).
admin.get('/email', async (c) => {
  needPermission(me(c), 'users:manage', 'see the email log');
  return c.json(await emailOverview(c.env));
});
// Every message, rendered with sample data. Nothing is sent.
admin.get('/email/templates', (c) => {
  needPermission(me(c), 'users:manage', 'preview emails');
  return c.json({ templates: TEMPLATE_NAMES });
});
admin.get('/email/preview/:template', (c) => {
  needPermission(me(c), 'users:manage', 'preview emails');
  const { template } = previewSchema.parse({ template: c.req.param('template') });
  return c.json(previewEmail(c.env, template));
});
// A test to the signed-in staff member's own address only; there is no way to name another recipient.
admin.post('/email/test', async (c) => {
  const staff = me(c);
  needPermission(staff, 'users:manage', 'send test emails');
  const u = c.get('user');
  if (!u) throw invalid('Sign in as yourself to send a test; it goes to your own address');
  const body = await readJson(c, z.object({ templates: z.array(z.enum(TEMPLATE_NAMES)).max(8).optional() }));
  return c.json(await sendTestEmails(c.env, { id: u.id, email: u.email }, body.templates));
});

// Students
admin.get('/students', async (c) => (needPermission(me(c), 'users:manage', 'see student accounts'), c.json(await listStudents(c.env.DB, studentQuery.parse(query(c))))));
admin.get('/students/:id', async (c) => (needPermission(me(c), 'users:manage', 'see student accounts'), c.json(await studentDetail(c.env.DB, c.req.param('id')))));
admin.post('/students/:id/status', async (c) => c.json(await setStudentStatus(c.env.DB, c.req.param('id'), await readJson(c, statusSchema), me(c))));
admin.post('/students/reset-link', async (c) => {
  needPermission(me(c), 'users:manage', 'create password reset links');
  return c.json(await createResetLink(c.env.DB, await readJson(c, resetLinkSchema), c.get('actor')), 201);
});

// Official links: the list, and the publish switch, which needs the linking basis on record (content:publish).
// Government updates: what the scheduled job collected, what is waiting for a check, and a way to run it now.
admin.get('/notices/overview', async (c) => c.json(await noticeOverview(c.env.DB, c.env)));
admin.get('/notices/queue', async (c) => c.json(await noticeQueue(c.env.DB, c.env.ACTIVE_EXAMS ? activeExams(c.env) : undefined)));
// Admissions information: sources are approved by staff after opening the page; facts cite an approved source and are published by staff.
admin.get('/admissions/overview', async (c) => c.json(await admissionsOverview(c.env.DB)));
admin.get('/admissions/sources', async (c) => c.json(await listSources(c.env.DB)));
admin.post('/admissions/sources', async (c) => (needPermission(me(c), 'content:write', 'add admission sources'), c.json(await createSource(c.env.DB, await readJson(c, sourceInputSchema), c.get('actor')), 201)));
admin.post('/admissions/sources/load-reviewed', async (c) => (needPermission(me(c), 'content:write', 'add admission sources'), c.json(await loadProposedSources(c.env.DB, c.get('actor')))));
admin.post('/admissions/sources/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'approve admission sources'), c.json(await decideSource(c.env.DB, c.req.param('id'), await readJson(c, sourceDecisionSchema), c.get('actor')))));
admin.get('/admissions/facts', async (c) => c.json(await listFacts(c.env.DB, { status: c.req.query('status') || undefined, slug: c.req.query('university') || undefined })));
admin.post('/admissions/facts', async (c) => (needPermission(me(c), 'content:write', 'add admission facts'), c.json(await createFact(c.env.DB, await readJson(c, factInputSchema), c.get('actor')), 201)));
admin.post('/admissions/facts/import', async (c) => (needPermission(me(c), 'content:write', 'import admission facts'), c.json(await importFacts(c.env.DB, await readJson(c, importSchema), c.get('actor'), c.req.query('dryRun') === '1'))));
admin.get('/admissions/programmes', async (c) => c.json(await listProgrammesAdmin(c.env.DB, { status: c.req.query('status') || undefined, slug: c.req.query('university') || undefined })));
admin.post('/admissions/programmes', async (c) => (needPermission(me(c), 'content:write', 'add programmes'), c.json(await createProgramme(c.env.DB, await readJson(c, programmeInputSchema), c.get('actor')), 201)));
admin.post('/admissions/programmes/import', async (c) => (needPermission(me(c), 'content:write', 'import programmes'), c.json(await importProgrammes(c.env.DB, await readJson(c, programmeImportSchema), c.get('actor'), c.req.query('dryRun') === '1'))));
admin.post('/admissions/programmes/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'publish programmes'), c.json(await decideProgramme(c.env.DB, c.req.param('id'), await readJson(c, programmeDecisionSchema), c.get('actor')))));
admin.get('/admissions/outdated', async (c) => c.json(await outdatedItems(c.env.DB)));
admin.post('/admissions/facts/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'publish admission facts'), c.json(await decideFact(c.env.DB, c.req.param('id'), await readJson(c, factDecisionSchema), c.get('actor')))));
// Structured subject requirements: the server's reading of each printed rule, reviewed beside the printed text. Nothing here is shown to students
// until a person approves it, and the lists a rule refers to (List A, List B) are published separately from the university's own document.
admin.get('/admissions/requirements', async (c) => c.json(await listRequirements(c.env.DB, requirementQuery.parse(query(c)))));
admin.post('/admissions/requirements/propose', async (c) => (needPermission(me(c), 'content:write', 'read requirements'), c.json(await proposeRequirements(c.env.DB, c.get('actor'), { dryRun: c.req.query('dryRun') === '1' }))));
admin.get('/admissions/requirements/:id', async (c) => c.json(await requirementDetail(c.env.DB, c.req.param('id'))));
admin.post('/admissions/requirements/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'approve or reject requirements'), c.json(await decideRequirement(c.env.DB, c.req.param('id'), await readJson(c, requirementDecisionSchema), c.get('actor')))));
admin.post('/admissions/requirements/:id/revise', async (c) => (needPermission(me(c), 'content:write', 'revise requirements'), c.json(await reviseRequirement(c.env.DB, c.req.param('id'), await readJson(c, revisionSchema), c.get('actor')), 201)));
admin.get('/admissions/groups', async (c) => c.json(await listGroups(c.env.DB, { slug: c.req.query('university') || undefined, status: c.req.query('status') || undefined })));
admin.get('/admissions/groups/:id', async (c) => c.json(await groupDetail(c.env.DB, c.req.param('id'))));
admin.post('/admissions/groups', async (c) => (needPermission(me(c), 'content:write', 'add subject lists'), c.json(await createGroup(c.env.DB, await readJson(c, groupInputSchema), c.get('actor')), 201)));
admin.post('/admissions/groups/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'publish subject lists'), c.json(await decideGroup(c.env.DB, c.req.param('id'), await readJson(c, groupDecisionSchema), c.get('actor')))));
admin.get('/admissions/validation', async (c) => c.json(await validateAdmissionData(c.env.DB)));
admin.post('/notices/fetch', async (c) => (needPermission(me(c), 'content:publish', 'fetch official notices'), c.json(await syncNotices(c.env, { force: true }))));
admin.get('/notices', async (c) => c.json(await adminNotices(c.env.DB, adminNoticeQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))), c.env.ACTIVE_EXAMS ? activeExams(c.env) : undefined)));
admin.get('/notices/:id/history', async (c) => c.json(await noticeHistory(c.env.DB, c.req.param('id'))));
admin.get('/registry', async (c) => c.json({ notices: await noticeSourceRegistry(c.env.DB, c.env), admissions: await listSources(c.env.DB) }));
admin.post('/notices/:id/decision', async (c) => (needPermission(me(c), 'content:publish', 'publish official notices'), c.json(await decideNotice(c.env.DB, c.req.param('id'), await readJson(c, noticeDecisionSchema), c.get('actor')))));
admin.get('/official-papers', async (c) => c.json(await listOfficialLinksAdmin(c.env.DB, c.env.OFFICIAL_IN_APP_VIEWING === 'on')));
admin.post('/official-papers/:id/status', async (c) => (needPermission(me(c), 'content:publish', 'publish official links'), c.json(await setOfficialLinkStatus(c.env.DB, c.req.param('id'), await readJson(c, linkActionSchema), c.get('actor'), c.env.OFFICIAL_IN_APP_VIEWING === 'on'))));
// Our own mock papers: what the blueprint needs, building a draft from approved questions, approval and publishing.
admin.get('/mock-papers', async (c) => c.json(await listMockPapersAdmin(c.env.DB, c.req.query('paperId') || undefined)));
admin.get('/mock-papers/readiness/:paperId', async (c) => c.json(await mockPaperReadiness(c.env.DB, c.req.param('paperId'))));
admin.post('/mock-papers/build/:paperId', async (c) => (needPermission(me(c), 'content:write', 'build mock papers'), c.json(await buildMockPaper(c.env.DB, c.req.param('paperId'), c.get('actor')), 201)));
admin.get('/mock-papers/:id', async (c) => c.json(await mockPaperAdmin(c.env.DB, c.req.param('id'))));
admin.post('/mock-papers/:id/status', async (c) => c.json(await setMockPaperStatus(c.env.DB, c.req.param('id'), await readJson(c, mockActionSchema), me(c))));

// Previous-year papers: what is stored, what blocks publishing, and the publish switch (content:publish).
admin.get('/past-papers', async (c) => c.json(await listPastPapersAdmin(c.env.DB)));
admin.get('/past-papers/:id', async (c) => c.json(await pastPaperQuestionsAdmin(c.env.DB, c.req.param('id'))));
admin.post('/past-papers/:id/status', async (c) => (needPermission(me(c), 'content:publish', 'publish previous-year papers'), c.json(await setPastPaperStatus(c.env.DB, c.req.param('id'), await readJson(c, paperActionSchema), c.get('actor')))));
// Chapter/topic frequency is computed only from high-confidence reviewer-verified mappings to the exact paper-year syllabus.
admin.get('/topic-weightage/queue', async (c) => c.json(await listTopicMappingQueue(c.env.DB, weightageQueueQuery.parse(query(c)))));
admin.post('/topic-weightage/:entryId/decision', async (c) => {
  needPermission(me(c), 'content:write', 'review topic mappings');
  const input = await readJson(c, weightageDecisionSchema);
  if (input.action === 'VERIFY') needPermission(me(c), 'content:publish', 'verify topic mappings');
  return c.json(await saveTopicMapping(c.env.DB, c.req.param('entryId'), input, c.get('actor')));
});
admin.get('/topic-weightage/report', async (c) => c.json(await verifiedWeightageReport(c.env.DB, { exam: c.req.query('exam') || undefined, paperId: c.req.query('paperId') || undefined })));

// Plans, subscriptions and payments (billing:manage). Prices and limits are data, changed here and logged.
const billing = (c: Parameters<typeof me>[0], what: string) => needPermission(me(c), 'billing:manage', what);
admin.get('/billing', async (c) => (billing(c, 'see payments'), c.json(await billingOverview(c.env))));
admin.get('/billing/plans', async (c) => (billing(c, 'see plans'), c.json(await listPlans(c.env.DB, false))));
/**
 * Approved 16 Nov 2026 (decision 4): a paid plan cannot be switched on while students are shown unreviewed content (CONTENT_PREVIEW=true).
 * Turn the preview off (and publish verified content) first.
 */
const paidLaunchGuard = (c: { env: AppEnv['Bindings'] }, body: { active?: boolean; pricePaise?: number }) => {
  if (body.active && (body.pricePaise ?? 0) > 0 && c.env.CONTENT_PREVIEW === 'true')
    throw new ApiError(409, 'PAID_LAUNCH_BLOCKED', 'A paid plan cannot be switched on while students are shown content that has not been reviewed (content preview is on). Publish verified subject content and turn the preview off first.');
};
admin.post('/billing/plans', async (c) => {
  billing(c, 'create plans');
  const body = await readJson(c, planCreateSchema);
  paidLaunchGuard(c, body);
  return c.json(await createPlan(c.env.DB, body, c.get('actor')), 201);
});
admin.put('/billing/plans/:id', async (c) => {
  billing(c, 'change plans and prices');
  const body = await readJson(c, planInputSchema);
  paidLaunchGuard(c, body);
  return c.json(await updatePlan(c.env.DB, c.req.param('id'), body, c.get('actor')));
});
admin.get('/billing/subscriptions', async (c) => (billing(c, 'see subscriptions'), c.json(await listSubscriptions(c.env.DB, subscriptionQuery.parse(query(c))))));
admin.post('/billing/subscriptions', async (c) => (billing(c, 'give paid access'), c.json(await grantAccess(c.env.DB, await readJson(c, grantSchema), c.get('actor')), 201)));
admin.post('/billing/subscriptions/:id/cancel', async (c) => (billing(c, 'cancel paid access'), c.json(await cancelSubscription(c.env.DB, c.req.param('id'), await readJson(c, cancelSchema), c.get('actor')))));
admin.get('/billing/orders', async (c) => (billing(c, 'see payments'), c.json(await listOrders(c.env.DB, orderQuery.parse(query(c))))));
admin.get('/billing/orders/:id', async (c) => (billing(c, 'see payments'), c.json(await orderDetail(c.env.DB, c.req.param('id')))));
admin.post('/billing/orders/:id/reconcile', async (c) => (billing(c, 'check a payment with the gateway'), c.json(await reconcileOrders(c.env, c.req.param('id')))));
admin.post('/billing/orders/:id/refund', async (c) => (billing(c, 'record refunds'), c.json(await recordManualRefund(c.env.DB, c.req.param('id'), await readJson(c, manualRefundSchema), c.get('actor')))));
admin.post('/billing/reconcile', async (c) => (billing(c, 'check payments with the gateway'), c.json(await reconcileOrders(c.env))));

// Staff, roles and reviewer assignments
admin.get('/staff', async (c) => (needPermission(me(c), 'users:manage', 'see staff and roles'), c.json(await listStaff(c.env.DB))));
admin.post('/roles', async (c) => {
  needPermission(me(c), 'users:manage', 'change roles');
  const body = await readJson(c, roleSchema);
  if (!body.grant && body.role === 'SUPER_ADMIN' && body.email === c.get('user').email) throw invalid('You cannot remove your own super administrator role');
  return c.json(await setRole(c.env.DB, body, c.get('actor')));
});
admin.get('/assignments', async (c) => c.json(await listAssignments(c.env.DB)));
admin.post('/assignments', async (c) => c.json(await addAssignment(c.env.DB, await readJson(c, assignmentSchema), me(c)), 201));
admin.delete('/assignments/:id', async (c) => c.json(await removeAssignment(c.env.DB, c.req.param('id'), me(c))));

// Reports
admin.get('/activity', async (c) => (needPermission(me(c), 'users:manage', 'see the activity feed'), c.json(await activity(c.env.DB, activityQuery.parse(query(c))))));
admin.get('/coverage', async (c) => {
  const exam = c.req.query('exam');
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  return c.json(await paperCoverage(c.env.DB, exam, Number(c.req.query('year')) || 2026));
});

// Lessons and questions
admin.get('/content', async (c) => c.json(await listContent(c.env.DB, contentQuery.parse(query(c)))));
admin.get('/content/papers', async (c) => c.json(await contentPapers(c.env.DB)));
admin.get('/questions/:id', async (c) => c.json(await getQuestionAdmin(c.get('prisma'), c.req.param('id'))));
admin.put('/questions/:id', async (c) => (needPermission(me(c), 'content:write', 'edit questions'), c.json(await updateQuestion(c.env.DB, c.req.param('id'), await readJson(c, questionInputSchema), c.get('actor')))));
admin.delete('/questions/:id', async (c) => (needPermission(me(c), 'content:write', 'delete questions'), c.json(await deleteQuestion(c.env.DB, c.req.param('id'), c.get('actor')))));
admin.get('/resources/:id', async (c) => c.json(await getResource(c.get('prisma'), c.req.param('id'))));
admin.put('/resources/:id', async (c) => (needPermission(me(c), 'content:write', 'edit lessons'), c.json(await updateResource(c.env.DB, c.req.param('id'), await readJson(c, resourceInputSchema), c.get('actor')))));
admin.delete('/resources/:id', async (c) => (needPermission(me(c), 'content:write', 'delete lessons'), c.json(await deleteResource(c.env.DB, c.req.param('id'), c.get('actor')))));
/** Workflow steps (submit, approve, publish, unpublish, archive). Verifying is a reviewer decision, made on the review screens. */
admin.post('/content/workflow', async (c) => {
  const body = await readJson(c, reviewSchema);
  if (['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED'].includes(body.action)) throw invalid('Verification decisions are made on the reviewer screens');
  needPermission(me(c), body.action === 'SUBMITTED' ? 'content:write' : 'content:publish', 'change the publishing status');
  return c.json(await applyReview(c.env.DB, body, c.get('actor')));
});
admin.get('/content/history', async (c) => c.json(await reviewHistory(c.env.DB, c.req.query('entityType') ?? '', c.req.query('entityId') ?? '')));

// Support: reading and answering students. Needs the account-management permission (the same one that guards the student list).
admin.use('/support', (c, next) => (needPermission(me(c), 'users:manage', 'handle support requests'), next()));
admin.use('/support/*', (c, next) => (needPermission(me(c), 'users:manage', 'handle support requests'), next()));
admin.get('/support/threads', async (c) => c.json(await staffThreads(c.env.DB, staffThreadsQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));
admin.get('/support/threads/:id', async (c) => c.json(await staffThread(c.env.DB, c.req.param('id'))));
admin.post('/support/threads/:id/messages', async (c) => {
  const input = await readJson(c, supportReplySchema.pick({ body: true }));
  return c.json(await staffReply(c.env.DB, me(c).id, c.req.param('id'), input), 201);
});
admin.put('/support/threads/:id/status', async (c) => c.json(await staffSetStatus(c.env.DB, c.req.param('id'), (await readJson(c, staffStatusSchema)).status)));
admin.get('/support/attachments/:messageId', async (c) => staffAttachment(c.env.DB, c.env.MEDIA, c.req.param('messageId')));

export default admin;
