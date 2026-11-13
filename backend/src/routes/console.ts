/**
 * Admin console API: for signed-in staff (session cookie + role permissions), unlike /api/admin, which is the
 * shared-token API used by the import tools. Every action is recorded under the person's own account.
 *
 * Access: any of users:manage, content:write or content:publish opens the console; each route then checks its own permission.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { ApiError, invalid } from '../lib/errors';
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
import { emailOverview } from '../services/email';
import { buildMockPaper, linkActionSchema, listMockPapersAdmin, listOfficialLinksAdmin, mockActionSchema, mockPaperAdmin, mockPaperReadiness, setMockPaperStatus, setOfficialLinkStatus } from '../services/practice-centre';
import { listPastPapersAdmin, paperActionSchema, pastPaperQuestionsAdmin, setPastPaperStatus } from '../services/past-papers';
import {
  billingOverview, cancelSchema, cancelSubscription, createPlan, grantAccess, grantSchema, listOrders, listPlans, listSubscriptions, manualRefundSchema, orderDetail, orderQuery, planCreateSchema,
  planInputSchema, reconcileOrders, recordManualRefund, subscriptionQuery, updatePlan,
} from '../services/billing';

const consoleAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await userFromToken(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED', 'Please sign in');
  const permissions = await permissionsOf(c.env.DB, user.id);
  if (!['users:manage', 'content:write', 'content:publish'].some((p) => permissions.includes(p))) throw new ApiError(403, 'FORBIDDEN', 'This account does not have admin access');
  c.set('user', { ...user, permissions });
  c.set('actor', `user:${user.id}`);
  await next();
};

const admin = new Hono<AppEnv>();
admin.use('*', consoleAuth);
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

// Students
admin.get('/students', async (c) => (needPermission(me(c), 'users:manage', 'see student accounts'), c.json(await listStudents(c.env.DB, studentQuery.parse(query(c))))));
admin.get('/students/:id', async (c) => (needPermission(me(c), 'users:manage', 'see student accounts'), c.json(await studentDetail(c.env.DB, c.req.param('id')))));
admin.post('/students/:id/status', async (c) => c.json(await setStudentStatus(c.env.DB, c.req.param('id'), await readJson(c, statusSchema), me(c))));
admin.post('/students/reset-link', async (c) => {
  needPermission(me(c), 'users:manage', 'create password reset links');
  return c.json(await createResetLink(c.env.DB, await readJson(c, resetLinkSchema), c.get('actor')), 201);
});

// Official links: the list, and the publish switch, which needs the linking basis on record (content:publish).
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

// Plans, subscriptions and payments (billing:manage). Prices and limits are data, changed here and logged.
const billing = (c: Parameters<typeof me>[0], what: string) => needPermission(me(c), 'billing:manage', what);
admin.get('/billing', async (c) => (billing(c, 'see payments'), c.json(await billingOverview(c.env))));
admin.get('/billing/plans', async (c) => (billing(c, 'see plans'), c.json(await listPlans(c.env.DB, false))));
admin.post('/billing/plans', async (c) => (billing(c, 'create plans'), c.json(await createPlan(c.env.DB, await readJson(c, planCreateSchema), c.get('actor')), 201)));
admin.put('/billing/plans/:id', async (c) => (billing(c, 'change plans and prices'), c.json(await updatePlan(c.env.DB, c.req.param('id'), await readJson(c, planInputSchema), c.get('actor')))));
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
admin.get('/activity', async (c) => c.json(await activity(c.env.DB, activityQuery.parse(query(c)))));
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

export default admin;
