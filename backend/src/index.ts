import { Hono } from 'hono';
import type { AppEnv } from './types';
import { adminAuth } from './lib/auth';
import { errorHandler } from './lib/errors';
import { prismaMiddleware } from './lib/prisma';
import admin from './routes/admin';
import pub from './routes/public';
import review from './routes/review';
import { auth, learn, student } from './routes/student';

const app = new Hono<AppEnv>();

app.onError(errorHandler);
app.get('/api/health', (c) => c.json({ ok: true, env: c.env.APP_ENV }));
app.get('/api/health/db', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS exams FROM exams').first<{ exams: number }>();
  return c.json({ ok: true, exams: row?.exams ?? 0 });
});
app.use('/api/*', prismaMiddleware);
app.use('/api/admin/*', adminAuth);
app.route('/api/admin', admin);
app.route('/api/public', pub);
app.route('/api/review', review);
app.route('/api/auth', auth);
app.route('/api/learn', learn);
app.route('/api/student', student);
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));

export default app;
