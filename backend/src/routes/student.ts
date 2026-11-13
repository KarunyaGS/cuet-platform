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
import { directorySessionsQuery, listMockPapers, listOfficialLinks, officialDirectory, officialDirectorySessions, officialDocument, officialDocumentFile, startMockPaper, startMockSchema } from '../services/practice-centre';
import { listPastPapers, pastPaperDetail, pastPaperQuery, startPastPaper, startPastPaperSchema } from '../services/past-papers';
import { assertWithinPlan, billingSummary, confirmCheckout, confirmSchema, createOrder, orderSchema, simulatePayment, simulateSchema } from '../services/billing';
import {
  appUrl, emailEnabled, emailSettingsSchema, forgotPasswordSchema, getEmailSettings, notifyPasswordChanged, requestPasswordReset, sendVerificationEmail, setEmailSettings, verifyEmail, verifyEmailSchema,
} from '../services/email';
import {
  activitySchema, addBookmark, addPlanItem, bookmarkSchema, bookmarkState, dailySchema, dashboard, dashboardQuery, deletePlanItem, getGoal, getProfile, goalSchema, listBookmarks,
  listPlan, planItemSchema, planUpdateSchema, profileSchema, recordActivity, removeBookmark, revisionNotes, setGoal, startDailyPractice, updatePlanItem, updateProfile,
} from '../services/student-tools';
import { dismissReminder, dismissSchema, getPreferences, preferencesSchema, recentlyViewed, reminders, remindersQuery, setPreferences, weeklyQuery, weeklyReport } from '../services/student-portal';
import { listExams, listSubjects, searchSyllabus, mediaObject, paperOutline, resourceDetail, topicDetail } from '../services/learning';
import { answerSchema, getSession, marksSchema, progress, saveAnswer, saveMarks, startSchema, startSession, submitSession } from '../services/practice';

const preview = (env: AppEnv['Bindings']) => env.CONTENT_PREVIEW === 'true';
const inApp = (env: AppEnv['Bindings']) => env.OFFICIAL_IN_APP_VIEWING === 'on';
/** Runs email work after the response is sent, so the answer never waits for (or reveals) the send. A failed send is recorded, never thrown. */
const later = (c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }, work: Promise<unknown>) => {
  const safe = work.catch((e) => console.error('Email task failed', (e as Error).message));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    /* no execution context (some tests): the work still runs */
  }
  return safe;
};
const base = (c: { env: AppEnv['Bindings']; req: { url: string } }) => {
  try {
    return appUrl(c.env, c.req.url);
  } catch {
    return null;
  }
};

export const auth = new Hono<AppEnv>();
auth.post('/register', async (c) => {
  const user = await registerStudent(c.env.DB, await readJson(c, registerSchema));
  const b = base(c);
  if (b && emailEnabled(c.env)) later(c, sendVerificationEmail(c.env, user.id, b));
  return c.json(user, 201);
});
auth.post('/login', async (c) => {
  const ttl = Number(c.env.SESSION_TTL_HOURS) || 168;
  const s = await login(c.env.DB, await readJson(c, loginSchema), ttl);
  setCookie(c, SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'Lax', secure: c.env.APP_ENV !== 'development', path: '/', maxAge: ttl * 3600 });
  return c.json({ user: s.user, expires: s.expires });
});
// A one-time reset link (made by an admin, or emailed once an email service exists) sets a new password.
auth.post('/reset-password', async (c) => {
  const r = await resetPassword(c.env.DB, await readJson(c, resetPasswordSchema));
  later(c, notifyPasswordChanged(c.env, r.userId));
  return c.json({ reset: true });
});
// Always the same answer, whether or not the address has an account. `available: false` means email is not switched on.
auth.post('/forgot-password', async (c) => {
  const input = await readJson(c, forgotPasswordSchema);
  const b = base(c);
  if (!b || !emailEnabled(c.env)) return c.json({ ok: true, available: false });
  later(c, requestPasswordReset(c.env, input.email, b));
  return c.json({ ok: true, available: true });
});
auth.get('/email-status', (c) => c.json({ available: emailEnabled(c.env) && Boolean(base(c)) }));
auth.post('/verify-email', async (c) => c.json(await verifyEmail(c.env.DB, await readJson(c, verifyEmailSchema))));
auth.post('/logout', async (c) => {
  // API clients send the token as a Bearer header; the browser sends the cookie. Either is revoked.
  await logout(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, ''));
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
// Practice Centre: links to official documents (published, with a recorded linking basis) and our own published mock papers.
learn.get('/official-papers', async (c) => {
  const exam = c.req.query('exam');
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  return c.json(await listOfficialLinks(c.env.DB, exam));
});
// The directory of papers actually held (subject, date, shift), from the exam body's own answer key.
learn.get('/official-directory', async (c) => {
  const exam = c.req.query('exam');
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  return c.json(await officialDirectory(c.env.DB, exam));
});
learn.get('/official-directory/sessions', async (c) => c.json(await officialDirectorySessions(c.env.DB, directorySessionsQuery.parse(c.req.query()))));
// One published official document, for the in-app viewer (how it may be shown, and where the file comes from).
learn.get('/official-documents/:id', async (c) => c.json(await officialDocument(c.env.DB, c.req.param('id'), inApp(c.env))));
learn.get('/mock-papers', async (c) => c.json(await listMockPapers(c.env.DB, { exam: c.req.query('exam') || undefined, paperId: c.req.query('paperId') || undefined })));
// Previous-year papers: only published papers whose licence allows display are ever listed here.
learn.get('/past-papers', async (c) => c.json(await listPastPapers(c.env.DB, pastPaperQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));
learn.get('/past-papers/:id', async (c) => c.json(await pastPaperDetail(c.env.DB, c.req.param('id'))));
learn.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const exam = c.req.query('exam');
  if (exam && exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  return c.json(await searchSyllabus(c.env.DB, preview(c.env), q, exam || undefined));
});
learn.get('/topics/:nodeId/revision', async (c) => c.json(await revisionNotes(c.env.DB, preview(c.env), c.req.param('nodeId'))));

export const student = new Hono<AppEnv>();
student.use('*', studentAuth);
student.post('/practice', async (c) => {
  const input = await readJson(c, startSchema);
  await assertWithinPlan(c.env.DB, c.get('user').id, input.mode);
  return c.json(await startSession(c.env.DB, preview(c.env), c.get('user').id, input), 201);
});
student.get('/practice/:id', async (c) => c.json(await getSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.post('/practice/:id/answers', async (c) => c.json(await saveAnswer(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, answerSchema))));
student.put('/practice/:id/marks', async (c) => c.json(await saveMarks(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, marksSchema))));
student.post('/practice/:id/submit', async (c) => c.json(await submitSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.get('/progress', async (c) => c.json(await progress(c.env.DB, c.get('user').id)));
student.post('/practice/daily', async (c) => {
  await assertWithinPlan(c.env.DB, c.get('user').id, 'PRACTICE');
  return c.json(await startDailyPractice(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, dailySchema)), 201);
});

// Pass-through of an official document for the in-app viewer: signed-in students only, nothing stored, and only where the exam body's permission is on record.
student.get('/official-documents/:id/file', async (c) => officialDocumentFile(c.env.DB, c.req.param('id'), c.req.header('range'), inApp(c.env)));

// Our own mock papers: a fixed paper, timed like the exam or untimed. Plan limits apply.
student.post('/mock-papers/:id/start', async (c) => {
  const input = await readJson(c, startMockSchema);
  await assertWithinPlan(c.env.DB, c.get('user').id, input.mode);
  return c.json(await startMockPaper(c.env.DB, c.get('user').id, c.req.param('id'), input), 201);
});

// Previous-year papers: attempt one as it was set (timed) or as untimed practice. Plan limits apply as for any test.
student.post('/past-papers/:id/start', async (c) => {
  const input = await readJson(c, startPastPaperSchema);
  await assertWithinPlan(c.env.DB, c.get('user').id, input.mode);
  return c.json(await startPastPaper(c.env.DB, c.get('user').id, c.req.param('id'), input), 201);
});

// Plans and payments: the student's plan, what it includes, buying a pass and payment history
student.get('/billing', async (c) => c.json(await billingSummary(c.env, c.get('user').id)));
student.post('/billing/orders', async (c) => c.json(await createOrder(c.env, c.get('user').id, await readJson(c, orderSchema)), 201));
student.post('/billing/orders/:id/confirm', async (c) => c.json(await confirmCheckout(c.env, c.get('user').id, c.req.param('id'), await readJson(c, confirmSchema))));
// Local development only (mock gateway): stands in for the gateway's payment page.
student.post('/billing/orders/:id/simulate', async (c) => c.json(await simulatePayment(c.env, c.get('user').id, c.req.param('id'), await readJson(c, simulateSchema))));

// Profile and password
student.get('/profile', async (c) => c.json(await getProfile(c.env.DB, c.get('user').id)));
student.put('/profile', async (c) => c.json(await updateProfile(c.env.DB, c.get('user').id, await readJson(c, profileSchema))));
student.post('/password', async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const r = await changePassword(c.env.DB, c.get('user').id, await readJson(c, passwordSchema), token ? await sha256Hex(token) : null);
  later(c, notifyPasswordChanged(c.env, c.get('user').id));
  return c.json(r);
});

// Email: confirmation of the address and study reminders
student.get('/email', async (c) => c.json(await getEmailSettings(c.env, c.get('user').id)));
student.put('/email', async (c) => c.json(await setEmailSettings(c.env, c.get('user').id, await readJson(c, emailSettingsSchema))));
student.post('/email/verification', async (c) => {
  const b = base(c);
  if (!b) return c.json({ sent: false, reason: 'NOT_CONFIGURED' });
  return c.json(await sendVerificationEmail(c.env, c.get('user').id, b));
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
