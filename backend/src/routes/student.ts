/**
 * Student API.
 *   /api/auth/*     sign up, sign in, sign out, current user
 *   /api/learn/*    browse exams, subjects, units, topics, learning resources (no sign-in needed)
 *   /api/student/*  practice, mock tests, results and progress (sign-in required)
 * Answers are scored only against stored answer keys. No external AI service is called.
 */
import { Hono } from 'hono';
import { rateLimit } from '../lib/rate-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { invalid, notFound } from '../lib/errors';
import { readJson } from '../lib/http';
import { changePassword, login, loginSchema, logout, passwordSchema, resetPassword, resetPasswordSchema, registerSchema, registerStudent, SESSION_COOKIE, studentAuth, userFromToken } from '../services/accounts';
import { sha256Hex } from '../lib/hash';
import { directorySessionsQuery, listMockPapers, listOfficialLinks, officialDirectory, officialDirectorySessions, officialDocument, officialDocumentFile, startMockPaper, startMockSchema } from '../services/practice-centre';
import { listPastPapers, pastPaperDetail, pastPaperQuery, startPastPaper, startPastPaperSchema } from '../services/past-papers';
import { assertWithinPlan, billingSummary, confirmCheckout, confirmSchema, createOrder, orderSchema, simulatePayment, simulateSchema } from '../services/billing';
import {
  appUrl, emailEnabled, sendWelcomeEmail, emailSettingsSchema, forgotPasswordSchema, getEmailSettings, notifyPasswordChanged, requestPasswordReset, sendVerificationEmail, setEmailSettings, verifyEmail, verifyEmailSchema,
} from '../services/email';
import {
  activitySchema, addBookmark, addPlanItem, BOOKMARK_KINDS, bookmarkSchema, bookmarkState, dailySchema, dashboard, dashboardQuery, deletePlanItem, getGoal, getProfile, goalSchema, listBookmarks,
  listPlan, planItemSchema, planUpdateSchema, profileSchema, recordActivity, removeBookmark, revisionNotes, setGoal, startDailyPractice, updatePlanItem, updateProfile,
} from '../services/student-tools';
import { dismissReminder, dismissSchema, getPreferences, preferencesSchema, recentlyViewed, subjectSummary, reminders, remindersQuery, setPreferences, weeklyQuery, weeklyReport } from '../services/student-portal';
import { deleteOne, editOne, editSchema, listAll, listForSurface, listForSurfaces, saveBatch, saveSchema } from '../services/annotations';
import { cardQuery, cardState, cardSummary, assertDay, createCard, createCardSchema, createQuestionCard, createQuestionCardSchema, deleteCard, importCards, importCardsSchema, listCards, questionCardState, reviewCard, reviewQueue, reviewSchema, topicCards } from '../services/flashcards';
import { pyqDocument, pyqDocumentFile, pyqExamSchema, pyqSubject, pyqTree } from '../services/pyq';
import { chapterBankDocuments } from '../services/native-papers';
import { examPreview, previewQuery, recordViolation, violationSchema } from '../services/exam';
import { chatMessageSchema, createTicket, getChat, listTickets, replySchema, replyTicket, sendChat, storeAttachment, studentAttachment, ticketDetail, ticketSchema, unreadCount, CATEGORIES } from '../services/support';
import { examActive, keeper, paperInScope, scienceOnly, UG_SCIENCE_PAPER_CODES } from '../lib/scope';
import { listExams, listSubjects, searchConcepts, searchSyllabus, mediaObject, paperOutline, resourceDetail, topicDetail } from '../services/learning';
import { answerSchema, getSession, marksSchema, progress, questionCounts, saveAnswer, saveMarks, startSchema, startSession, submitSession } from '../services/practice';

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
  await rateLimit(c.env, c.req, 'register-ip', null, 8, 3600);
  const user = await registerStudent(c.env.DB, await readJson(c, registerSchema));
  const b = base(c);
  if (user.created && b && emailEnabled(c.env)) later(c, sendVerificationEmail(c.env, user.id, b));
  // Same answer for a new and an existing address; the new account's id is not revealed either way.
  return c.json({ id: user.id, email: user.email, displayName: user.displayName }, 201);
});
auth.post('/login', async (c) => {
  const ttl = Number(c.env.SESSION_TTL_HOURS) || 168;
  const input = await readJson(c, loginSchema);
  // Checked before the password is hashed, so a flood costs almost nothing.
  await rateLimit(c.env, c.req, 'login-ip', null, 40, 600);
  await rateLimit(c.env, c.req, 'login-email', input.email, 10, 600);
  const s = await login(c.env.DB, input, ttl);
  setCookie(c, SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'Lax', secure: c.env.APP_ENV !== 'development', path: '/', maxAge: ttl * 3600 });
  return c.json({ user: s.user, expires: s.expires });
});
// A one-time reset link (made by an admin, or emailed once an email service exists) sets a new password.
auth.post('/reset-password', async (c) => {
  await rateLimit(c.env, c.req, 'reset-ip', null, 20, 3600);
  const r = await resetPassword(c.env.DB, await readJson(c, resetPasswordSchema));
  later(c, notifyPasswordChanged(c.env, r.userId));
  return c.json({ reset: true });
});
// Always the same answer, whether or not the address has an account. `available: false` means email is not switched on.
auth.post('/forgot-password', async (c) => {
  const input = await readJson(c, forgotPasswordSchema);
  await rateLimit(c.env, c.req, 'forgot-ip', null, 10, 3600);
  await rateLimit(c.env, c.req, 'forgot-email', input.email, 4, 3600);
  const b = base(c);
  if (!b || !emailEnabled(c.env)) return c.json({ ok: true, available: false });
  later(c, requestPasswordReset(c.env, input.email, b));
  return c.json({ ok: true, available: true });
});
auth.get('/email-status', (c) => c.json({ available: emailEnabled(c.env) && Boolean(base(c)) }));
auth.post('/verify-email', async (c) => {
  await rateLimit(c.env, c.req, 'verify-ip', null, 30, 3600);
  const r = await verifyEmail(c.env.DB, await readJson(c, verifyEmailSchema));
  // A first welcome, once; repeating the confirmation never sends another.
  later(c, sendWelcomeEmail(c.env, r.userId, base(c) ?? undefined));
  return c.json({ verified: r.verified });
});
auth.post('/logout', async (c) => {
  // API clients send the token as a Bearer header; the browser sends the cookie. Either is revoked.
  await logout(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ signedOut: true });
});
auth.get('/me', async (c) => c.json({ user: await userFromToken(c.env.DB, getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '')), preview: preview(c.env) }));

export const learn = new Hono<AppEnv>();
// Students see only the active exams and papers (lib/scope.ts). Nothing is hidden from administrators or removed from the database.
learn.get('/exams', async (c) => {
  const exams = (await listExams(c.env.DB)).filter((x) => examActive(c.env, x.code));
  if (!scienceOnly(c.env)) return c.json(exams);
  // The cards say how many papers students can open here, not NTA's figure for the whole exam (37).
  const marks = UG_SCIENCE_PAPER_CODES.map(() => '?').join(',');
  const out = [];
  for (const x of exams) {
    const n = x.code === 'CUET_UG' ? (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE e.code = 'CUET_UG' AND ec.year = ? AND tp.code IN (${marks})`).bind(x.year, ...UG_SCIENCE_PAPER_CODES).first<{ n: number }>())?.n ?? 0 : 0;
    out.push({ ...x, rules: { ...x.rules, papersOffered: n, catalogue: 'science', papersOfferedByNta: x.rules.papersOffered ?? null } });
  }
  return c.json(out);
});
learn.get('/exams/:exam/subjects', async (c) => {
  const exam = c.req.param('exam');
  const year = Number(c.req.query('year'));
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!Number.isInteger(year)) throw invalid('year is required');
  if (!examActive(c.env, exam)) throw notFound('Exam');
  return c.json(await listSubjects(c.env.DB, preview(c.env), exam, year, keeper(c.env)));
});
learn.get('/subjects/:paperId', async (c) => {
  const out = await paperOutline(c.env.DB, preview(c.env), c.req.param('paperId'));
  if (!paperInScope(c.env, String(out.paper.exam), String(out.paper.code))) throw notFound('Subject');
  return c.json(out);
});
learn.get('/topics/:nodeId', async (c) => c.json(await topicDetail(c.env.DB, preview(c.env), c.req.param('nodeId'))));
learn.get('/resources/:id', async (c) => c.json(await resourceDetail(c.env.DB, preview(c.env), c.req.param('id'))));
learn.get('/media/:id', async (c) => mediaObject(c.env.DB, c.env.MEDIA, preview(c.env), c.req.param('id')));
// Practice Centre: links to official documents (published, with a recorded linking basis) and our own published mock papers.
learn.get('/official-papers', async (c) => {
  const exam = c.req.query('exam');
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!examActive(c.env, exam)) throw notFound('Exam');
  const links = await listOfficialLinks(c.env.DB, exam);
  return c.json({ ...links, years: links.years.map((y) => ({ ...y, items: y.items.filter((i) => paperInScope(c.env, exam, (i.subjectCode as string | null) ?? null)) })).filter((y) => y.items.length) });
});
// The directory of papers actually held (subject, date, shift), from the exam body's own answer key.
learn.get('/official-directory', async (c) => {
  const exam = c.req.query('exam');
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!examActive(c.env, exam)) throw notFound('Exam');
  const dir = await officialDirectory(c.env.DB, exam);
  return c.json({ ...dir, years: dir.years.map((y) => { const subjects = y.subjects.filter((x) => paperInScope(c.env, exam, x.code)); return { ...y, subjects, papers: subjects.reduce((n, x) => n + x.sessions, 0) }; }).filter((y) => y.subjects.length) });
});
learn.get('/official-directory/sessions', async (c) => {
  const q = directorySessionsQuery.parse(c.req.query());
  if (!paperInScope(c.env, q.exam, q.subject)) throw notFound('Subject');
  return c.json(await officialDirectorySessions(c.env.DB, q));
});
// One published official document, for the in-app viewer (how it may be shown, and where the file comes from).
learn.get('/official-documents/:id', async (c) => c.json(await officialDocument(c.env.DB, c.req.param('id'), inApp(c.env))));
learn.get('/mock-papers', async (c) => c.json((await listMockPapers(c.env.DB, { exam: c.req.query('exam') || undefined, paperId: c.req.query('paperId') || undefined })).filter((m) => paperInScope(c.env, String(m.exam), String(m.subjectCode)))));
// Previous-year papers: only published papers whose licence allows display are ever listed here.
learn.get('/past-papers', async (c) => {
  const r = await listPastPapers(c.env.DB, pastPaperQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))));
  return c.json({ ...r, papers: r.papers.filter((p) => paperInScope(c.env, String(p.exam), String(p.subjectCode))), subjects: r.subjects.filter((x) => scienceOnly(c.env) ? UG_SCIENCE_PAPER_CODES.includes(String(x.code)) : true) });
});
learn.get('/past-papers/:id', async (c) => c.json(await pastPaperDetail(c.env.DB, c.req.param('id'))));
learn.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  const exam = c.req.query('exam');
  if (exam && exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (exam && !examActive(c.env, exam)) return c.json({ query: q, subjects: [], topics: [], more: false, concepts: [] });
  const keep = keeper(c.env);
  const [syllabus, concepts] = await Promise.all([searchSyllabus(c.env.DB, preview(c.env), q, exam || undefined, keep), searchConcepts(c.env.DB, preview(c.env), q, exam || undefined, keep)]);
  return c.json({ ...syllabus, concepts });
});
// Previous-year papers found on public websites: years and subjects that have a paper, a subject's papers, and one paper.
// Students see English-medium papers only; PYQ_ENGLISH_HINDI adds NTA's bilingual English + Hindi papers, labelled as such.
const pyqScope = (env: AppEnv['Bindings']) => ({ inApp: env.PYQ_IN_APP_VIEWING === 'on', englishHindi: env.PYQ_ENGLISH_HINDI === 'on', preview: env.CONTENT_PREVIEW === 'true' });
learn.get('/question-bank-pdfs', async (c) => c.json(await chapterBankDocuments(c.env.DB, pyqExamSchema.parse(c.req.query('exam') ?? 'CUET_UG'))));
learn.get('/pyq', async (c) => {
  const exam = pyqExamSchema.parse(c.req.query('exam') ?? 'CUET_UG');
  if (!examActive(c.env, exam)) throw notFound('Exam');
  const t = await pyqTree(c.env.DB, exam, pyqScope(c.env).englishHindi, pyqScope(c.env).preview);
  return c.json({ ...t, years: t.years.map((y) => { const subjects = y.subjects.filter((x) => (x.code !== null || !scienceOnly(c.env)) && paperInScope(c.env, exam, x.code)); return { ...y, subjects, papers: subjects.reduce((n, x) => n + x.papers, 0) }; }).filter((y) => y.subjects.length) });
});
// A Prepora document's own file, from our storage (byte ranges for the viewer; ?download=1 to save it).
learn.get('/pyq/documents/:id/file', async (c) => pyqDocumentFile(c.env.DB, c.env.MEDIA, c.req.param('id'), pyqScope(c.env), c.req.header('range'), c.req.query('download') === '1'));
learn.get('/pyq/documents/:id', async (c) => c.json(await pyqDocument(c.env.DB, c.req.param('id'), pyqScope(c.env))));
learn.get('/pyq/:year/:slug', async (c) => {
  const year = Number(c.req.param('year'));
  if (!Number.isInteger(year)) throw invalid('year must be a number');
  const exam = pyqExamSchema.parse(c.req.query('exam') ?? 'CUET_UG');
  if (!examActive(c.env, exam)) throw notFound('Exam');
  const r = await pyqSubject(c.env.DB, exam, year, c.req.param('slug'), pyqScope(c.env));
  if ((r.subject.code === null && scienceOnly(c.env)) || !paperInScope(c.env, exam, r.subject.code)) throw notFound('Papers for this subject and year');
  return c.json(r);
});
learn.get('/question-counts', async (c) =>
  c.json(await questionCounts(c.env.DB, preview(c.env), { paperId: c.req.query('paperId') || undefined, nodeIds: (c.req.query('nodeIds') ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30), difficulty: (c.req.query('difficulty') ?? '').split(',').filter(Boolean), types: (c.req.query('types') ?? '').split(',').filter(Boolean) })),
);
learn.get('/topics/:nodeId/revision', async (c) => c.json(await revisionNotes(c.env.DB, preview(c.env), c.req.param('nodeId'))));

export const student = new Hono<AppEnv>();
student.use('*', studentAuth);
student.post('/practice', async (c) => {
  const input = await readJson(c, startSchema);
  await assertWithinPlan(c.env.DB, c.get('user').id, input.mode);
  return c.json(await startSession(c.env.DB, preview(c.env), c.get('user').id, input), 201);
});
student.get('/exam/preview', async (c) => c.json(await examPreview(c.env.DB, preview(c.env), previewQuery.parse(c.req.query()))));
student.post('/practice/:id/violations', async (c) => {
  await rateLimit(c.env, c.req, 'exam-violation', c.get('user').id, 60, 3600);
  return c.json(await recordViolation(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, violationSchema)));
});
student.get('/practice/:id', async (c) => c.json(await getSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.post('/practice/:id/answers', async (c) => c.json(await saveAnswer(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, answerSchema))));
student.put('/practice/:id/marks', async (c) => c.json(await saveMarks(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, marksSchema))));
student.post('/practice/:id/submit', async (c) => {
  // The test screen says when it is submitting because the clock ran out; the server checks that against its own clock.
  const body = (await c.req.json().catch(() => null)) as { timedOut?: boolean } | null;
  return c.json(await submitSession(c.env.DB, c.get('user').id, c.req.param('id'), body?.timedOut === true ? 'TIME_UP' : 'SUBMITTED'));
});
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
student.post('/billing/orders', async (c) => (await rateLimit(c.env, c.req, 'order-user', c.get('user').id, 12, 3600), c.json(await createOrder(c.env, c.get('user').id, await readJson(c, orderSchema)), 201)));
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
  await rateLimit(c.env, c.req, 'verification-user', c.get('user').id, 8, 3600);
  const b = base(c);
  if (!b) return c.json({ sent: false, reason: 'NOT_CONFIGURED' });
  return c.json(await sendVerificationEmail(c.env, c.get('user').id, b));
});

// Dashboard, goals, activity
student.get('/dashboard', async (c) => c.json(await dashboard(c.env.DB, preview(c.env), c.get('user').id, dashboardQuery.parse({ day: c.req.query('day'), since: c.req.query('since') }))));
student.get('/goals', async (c) => c.json(await getGoal(c.env.DB, c.get('user').id)));
student.put('/goals', async (c) => c.json(await setGoal(c.env.DB, c.get('user').id, await readJson(c, goalSchema))));
student.post('/activity', async (c) => c.json(await recordActivity(c.env.DB, c.get('user').id, await readJson(c, activitySchema))));

// Bookmarks
student.get('/bookmarks', async (c) => c.json(await listBookmarks(c.env.DB, c.get('user').id)));
student.get('/bookmarks/state', async (c) => {
  const kind = c.req.query('kind') ?? '';
  if (!(BOOKMARK_KINDS as readonly string[]).includes(kind)) throw invalid('kind must be TOPIC, LESSON, QUESTION or REVISION');
  return c.json(await bookmarkState(c.env.DB, c.get('user').id, kind, (c.req.query('ids') ?? '').split(',').filter(Boolean).slice(0, 200)));
});
student.post('/bookmarks', async (c) => c.json(await addBookmark(c.env.DB, c.get('user').id, await readJson(c, bookmarkSchema)), 201));
student.post('/bookmarks/remove', async (c) => c.json(await removeBookmark(c.env.DB, c.get('user').id, await readJson(c, bookmarkSchema))));

// Highlights and annotations: the student's own marks on lessons and questions. They never touch content, answers or scores.
student.get('/annotations', async (c) => {
  const kind = c.req.query('surface');
  if (!kind) return c.json(await listAll(c.env.DB, c.get('user').id));
  const ids = (c.req.query('ids') ?? '').split(',').filter(Boolean);
  return c.json(ids.length ? await listForSurfaces(c.env.DB, c.get('user').id, kind, ids) : await listForSurface(c.env.DB, c.get('user').id, kind, c.req.query('id') ?? ''));
});
student.put('/annotations', async (c) => c.json(await saveBatch(c.env.DB, c.get('user').id, await readJson(c, saveSchema))));
student.patch('/annotations/:id', async (c) => c.json(await editOne(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, editSchema))));
student.delete('/annotations/:id', async (c) => c.json(await deleteOne(c.env.DB, c.get('user').id, c.req.param('id'))));

// Flashcards and spaced revision. Every card belongs to the signed-in student; card text is copied from the lesson by the server.
const cardFilters = (c: { req: { query(name: string): string | undefined } }) =>
  cardQuery.parse(Object.fromEntries(['day', 'paperId', 'chapterId', 'nodeId', 'resourceId', 'due', 'limit'].map((k) => [k, c.req.query(k) || undefined])));
student.get('/flashcards', async (c) => c.json(await listCards(c.env.DB, preview(c.env), c.get('user').id, cardFilters(c))));
student.get('/flashcards/summary', async (c) => c.json(await cardSummary(c.env.DB, preview(c.env), c.get('user').id, assertDay(cardFilters(c).day))));
student.get('/flashcards/topic/:nodeId', async (c) => c.json(await topicCards(c.env.DB, preview(c.env), c.get('user').id, c.req.param('nodeId'), assertDay(cardFilters(c).day))));
student.get('/flashcards/queue', async (c) => c.json(await reviewQueue(c.env.DB, preview(c.env), c.get('user').id, cardFilters(c))));
student.post('/flashcards/state', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { keys?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === 'string') : [];
  return c.json(await cardState(c.env.DB, c.get('user').id, keys));
});
student.post('/flashcards', async (c) => {
  const r = await createCard(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, createCardSchema));
  return c.json(r, r.created ? 201 : 200);
});
// Revision cards from attempted practice questions: a card exists only after the student has answered and seen the result.
student.post('/flashcards/questions', async (c) => {
  const r = await createQuestionCard(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, createQuestionCardSchema));
  return c.json(r, r.created ? 201 : 200);
});
student.post('/flashcards/questions/state', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((k): k is string => typeof k === 'string') : [];
  return c.json(await questionCardState(c.env.DB, c.get('user').id, ids));
});
student.post('/flashcards/import', async (c) => c.json(await importCards(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, importCardsSchema))));
student.post('/flashcards/:id/review', async (c) => c.json(await reviewCard(c.env.DB, preview(c.env), c.get('user').id, c.req.param('id'), await readJson(c, reviewSchema))));
// A card that has been revised is removed only with confirm=1, so review progress is never lost by a stray tap.
student.delete('/flashcards/:id', async (c) => c.json(await deleteCard(c.env.DB, c.get('user').id, c.req.param('id'), c.req.query('confirm') === '1')));

// Preferences, weekly report, reminders, recently viewed
student.get('/preferences', async (c) => c.json(await getPreferences(c.env.DB, c.get('user').id)));
student.put('/preferences', async (c) => c.json(await setPreferences(c.env.DB, c.get('user').id, await readJson(c, preferencesSchema))));
student.get('/report/weekly', async (c) => c.json(await weeklyReport(c.env.DB, c.get('user').id, weeklyQuery.parse({ start: c.req.query('start'), from: c.req.query('from'), tz: c.req.query('tz') }))));
student.get('/reminders', async (c) => c.json(await reminders(c.env.DB, c.get('user').id, remindersQuery.parse({ day: c.req.query('day'), since: c.req.query('since') }))));
student.post('/reminders/dismiss', async (c) => c.json(await dismissReminder(c.env.DB, c.get('user').id, await readJson(c, dismissSchema))));
student.get('/recent', async (c) => c.json(await recentlyViewed(c.env.DB, c.get('user').id)));
// ---- help and support: the student's own chat and tickets (every query is scoped to the signed-in student)
student.get('/support/categories', (c) => c.json(CATEGORIES));
student.get('/support/unread', async (c) => c.json(await unreadCount(c.env.DB, c.get('user').id)));
student.get('/support/chat', async (c) => c.json(await getChat(c.env.DB, c.get('user').id)));
student.post('/support/chat/messages', async (c) => {
  await rateLimit(c.env, c.req, 'support-message', c.get('user').id, 40, 3600);
  return c.json(await sendChat(c.env.DB, c.env.MEDIA, c.get('user').id, await readJson(c, chatMessageSchema)), 201);
});
student.get('/support/tickets', async (c) => c.json(await listTickets(c.env.DB, c.get('user').id)));
student.post('/support/tickets', async (c) => {
  await rateLimit(c.env, c.req, 'support-ticket', c.get('user').id, 10, 3600);
  return c.json(await createTicket(c.env.DB, c.env.MEDIA, c.get('user').id, await readJson(c, ticketSchema)), 201);
});
student.get('/support/tickets/:id', async (c) => c.json(await ticketDetail(c.env.DB, c.get('user').id, c.req.param('id'))));
student.post('/support/tickets/:id/messages', async (c) => {
  await rateLimit(c.env, c.req, 'support-message', c.get('user').id, 40, 3600);
  return c.json(await replyTicket(c.env.DB, c.env.MEDIA, c.get('user').id, c.req.param('id'), await readJson(c, replySchema)), 201);
});
student.post('/support/attachments', async (c) => {
  await rateLimit(c.env, c.req, 'support-upload', c.get('user').id, 20, 3600);
  const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim();
  const name = decodeURIComponent(c.req.header('x-filename') ?? '');
  return c.json(await storeAttachment(c.env.MEDIA, c.get('user').id, await c.req.arrayBuffer(), type, name), 201);
});
student.get('/support/attachments/:messageId', async (c) => studentAttachment(c.env.DB, c.env.MEDIA, c.get('user').id, c.req.param('messageId')));
student.get('/subject-summary/:paperId', async (c) => c.json(await subjectSummary(c.env.DB, c.get('user').id, c.req.param('paperId'))));

// Study planner
student.get('/plan', async (c) => c.json(await listPlan(c.env.DB, c.get('user').id, c.req.query('from') ?? '', c.req.query('to') ?? '')));
student.post('/plan', async (c) => c.json(await addPlanItem(c.env.DB, c.get('user').id, await readJson(c, planItemSchema)), 201));
student.patch('/plan/:id', async (c) => c.json(await updatePlanItem(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, planUpdateSchema))));
student.delete('/plan/:id', async (c) => c.json(await deletePlanItem(c.env.DB, c.get('user').id, c.req.param('id'))));
