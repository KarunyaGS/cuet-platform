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
