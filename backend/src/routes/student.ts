/**
 * Student API.
 *   /api/auth/*     sign up, sign in, sign out, current user
 *   /api/learn/*    browse exams, subjects, units, topics, learning resources (no sign-in needed)
 *   /api/student/*  practice, mock tests, results and progress (sign-in required)
 * Answers are scored only against stored answer keys. No external AI service is called.
 */
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { invalid } from '../lib/errors';
import { readJson } from '../lib/http';
import { changePassword, login, loginSchema, logout, passwordSchema, resetPassword, resetPasswordSchema, registerSchema, registerStudent, SESSION_COOKIE, studentAuth, userFromToken } from '../services/accounts';
import { sha256Hex } from '../lib/hash';
import {
  activitySchema, addBookmark, addPlanItem, bookmarkSchema, bookmarkState, dailySchema, dashboard, dashboardQuery, deletePlanItem, getGoal, getProfile, goalSchema, listBookmarks,
  listPlan, planItemSchema, planUpdateSchema, profileSchema, recordActivity, removeBookmark, revisionNotes, setGoal, startDailyPractice, updatePlanItem, updateProfile,
} from '../services/student-tools';
import { dismissReminder, dismissSchema, getPreferences, preferencesSchema, recentlyViewed, reminders, remindersQuery, setPreferences, weeklyQuery, weeklyReport } from '../services/student-portal';
import { listExams, listSubjects, searchSyllabus, mediaObject, paperOutline, resourceDetail, topicDetail } from '../services/learning';
import { answerSchema, getSession, progress, saveAnswer, startSchema, startSession, submitSession } from '../services/practice';

const preview = (env: AppEnv['Bindings']) => env.CONTENT_PREVIEW === 'true';

export const auth = new Hono<AppEnv>();
auth.post('/register', async (c) => c.json(await registerStudent(c.env.DB, await readJson(c, registerSchema)), 201));
auth.post('/login', async (c) => {
  const ttl = Number(c.env.SESSION_TTL_HOURS) || 168;
  const s = await login(c.env.DB, await readJson(c, loginSchema), ttl);
  setCookie(c, SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'Lax', secure: c.env.APP_ENV !== 'development', path: '/', maxAge: ttl * 3600 });
  return c.json({ user: s.user, expires: s.expires });
});
// A one-time reset link (made by an admin, or emailed once an email service exists) sets a new password.
auth.post('/reset-password', async (c) => c.json(await resetPassword(c.env.DB, await readJson(c, resetPasswordSchema))));
auth.post('/logout', async (c) => {
  await logout(c.env.DB, getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ signedOut: true });
});
auth.get('/me', async (c) => c.json({ user: await userFromToken(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '')), preview: preview(c.env) }));

export const learn = new Hono<AppEnv>();
learn.get('/exams', async (c) => c.json(await listExams(c.env.DB)));
learn.get('/exams/:exam/subjects', async (c) => {
  const exam = c.req.param('exam');
  const year = Number(c.req.query('year'));
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!Number.isInteger(year)) throw invalid('year is required');
  return c.json(await listSubjects(c.env.DB, preview(c.env), exam, year));
});
learn.get('/subjects/:paperId', async (c) => c.json(await paperOutline(c.env.DB, preview(c.env), c.req.param('paperId'))));
learn.get('/topics/:nodeId', async (c) => c.json(await topicDetail(c.env.DB, preview(c.env), c.req.param('nodeId'))));
learn.get('/resources/:id', async (c) => c.json(await resourceDetail(c.env.DB, preview(c.env), c.req.param('id'))));
learn.get('/media/:id', async (c) => mediaObject(c.env.DB, c.env.MEDIA, preview(c.env), c.req.param('id')));
learn.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const exam = c.req.query('exam');
  if (exam && exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  return c.json(await searchSyllabus(c.env.DB, preview(c.env), q, exam || undefined));
});
learn.get('/topics/:nodeId/revision', async (c) => c.json(await revisionNotes(c.env.DB, preview(c.env), c.req.param('nodeId'))));

export const student = new Hono<AppEnv>();
student.use('*', studentAuth);
student.post('/practice', async (c) => c.json(await startSession(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, startSchema)), 201));
student.get('/practice/:id', async (c) => c.json(await getSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.post('/practice/:id/answers', async (c) => c.json(await saveAnswer(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, answerSchema))));
student.post('/practice/:id/submit', async (c) => c.json(await submitSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.get('/progress', async (c) => c.json(await progress(c.env.DB, c.get('user').id)));
student.post('/practice/daily', async (c) => c.json(await startDailyPractice(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, dailySchema)), 201));

// Profile and password
student.get('/profile', async (c) => c.json(await getProfile(c.env.DB, c.get('user').id)));
student.put('/profile', async (c) => c.json(await updateProfile(c.env.DB, c.get('user').id, await readJson(c, profileSchema))));
student.post('/password', async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return c.json(await changePassword(c.env.DB, c.get('user').id, await readJson(c, passwordSchema), token ? await sha256Hex(token) : null));
});

// Dashboard, goals, activity
student.get('/dashboard', async (c) => c.json(await dashboard(c.env.DB, c.get('user').id, dashboardQuery.parse({ day: c.req.query('day'), since: c.req.query('since') }))));
student.get('/goals', async (c) => c.json(await getGoal(c.env.DB, c.get('user').id)));
student.put('/goals', async (c) => c.json(await setGoal(c.env.DB, c.get('user').id, await readJson(c, goalSchema))));
student.post('/activity', async (c) => c.json(await recordActivity(c.env.DB, c.get('user').id, await readJson(c, activitySchema))));

// Bookmarks
student.get('/bookmarks', async (c) => c.json(await listBookmarks(c.env.DB, c.get('user').id)));
student.get('/bookmarks/state', async (c) => {
  const kind = c.req.query('kind') ?? '';
  if (!['TOPIC', 'LESSON', 'QUESTION', 'REVISION'].includes(kind)) throw invalid('kind must be TOPIC, LESSON, QUESTION or REVISION');
  return c.json(await bookmarkState(c.env.DB, c.get('user').id, kind, (c.req.query('ids') ?? '').split(',').filter(Boolean).slice(0, 100)));
});
student.post('/bookmarks', async (c) => c.json(await addBookmark(c.env.DB, c.get('user').id, await readJson(c, bookmarkSchema)), 201));
student.post('/bookmarks/remove', async (c) => c.json(await removeBookmark(c.env.DB, c.get('user').id, await readJson(c, bookmarkSchema))));

// Preferences, weekly report, reminders, recently viewed
student.get('/preferences', async (c) => c.json(await getPreferences(c.env.DB, c.get('user').id)));
student.put('/preferences', async (c) => c.json(await setPreferences(c.env.DB, c.get('user').id, await readJson(c, preferencesSchema))));
student.get('/report/weekly', async (c) => c.json(await weeklyReport(c.env.DB, c.get('user').id, weeklyQuery.parse({ start: c.req.query('start'), from: c.req.query('from'), tz: c.req.query('tz') }))));
student.get('/reminders', async (c) => c.json(await reminders(c.env.DB, c.get('user').id, remindersQuery.parse({ day: c.req.query('day'), since: c.req.query('since') }))));
student.post('/reminders/dismiss', async (c) => c.json(await dismissReminder(c.env.DB, c.get('user').id, await readJson(c, dismissSchema))));
student.get('/recent', async (c) => c.json(await recentlyViewed(c.env.DB, c.get('user').id)));

// Study planner
student.get('/plan', async (c) => c.json(await listPlan(c.env.DB, c.get('user').id, c.req.query('from') ?? '', c.req.query('to') ?? '')));
student.post('/plan', async (c) => c.json(await addPlanItem(c.env.DB, c.get('user').id, await readJson(c, planItemSchema)), 201));
student.patch('/plan/:id', async (c) => c.json(await updatePlanItem(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, planUpdateSchema))));
student.delete('/plan/:id', async (c) => c.json(await deletePlanItem(c.env.DB, c.get('user').id, c.req.param('id'))));
