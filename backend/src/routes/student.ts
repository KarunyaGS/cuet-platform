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
import { login, loginSchema, logout, registerSchema, registerStudent, SESSION_COOKIE, studentAuth, userFromToken } from '../services/accounts';
import { listExams, listSubjects, mediaObject, paperOutline, resourceDetail, topicDetail } from '../services/learning';
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

export const student = new Hono<AppEnv>();
student.use('*', studentAuth);
student.post('/practice', async (c) => c.json(await startSession(c.env.DB, preview(c.env), c.get('user').id, await readJson(c, startSchema)), 201));
student.get('/practice/:id', async (c) => c.json(await getSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.post('/practice/:id/answers', async (c) => c.json(await saveAnswer(c.env.DB, c.get('user').id, c.req.param('id'), await readJson(c, answerSchema))));
student.post('/practice/:id/submit', async (c) => c.json(await submitSession(c.env.DB, c.get('user').id, c.req.param('id'))));
student.get('/progress', async (c) => c.json(await progress(c.env.DB, c.get('user').id)));
