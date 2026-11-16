import { Hono } from 'hono';
import type { AppEnv } from './types';
import { adminAuth } from './lib/auth';
import { errorHandler } from './lib/errors';
import { prismaMiddleware } from './lib/prisma';
import admin from './routes/admin';
import pub from './routes/public';
import review from './routes/review';
import consoleApi from './routes/console';
import { auth, learn, student } from './routes/student';
import { handleCloudflareEmailEvent, sendDailyReminders, retryFailedEmails, sendNoticeAlerts, sendExamCountdowns, sendRevisionReminders } from './services/email';
import { gatewayState, reconcileOrders, sendExpiryNotices } from './services/billing';
import { syncNotices } from './services/gov-notices';
import { housekeeping } from './services/housekeeping';
import { rateLimit } from './lib/rate-limit';

const app = new Hono<AppEnv>();

app.onError(errorHandler);
// Every API answer carries the standard browser protections. A browser request from another website to a changing endpoint is refused
// (the session cookie is SameSite=Lax as well; this is the second lock). Requests without an Origin header (mail programs, servers, tools) pass.
const originOf = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};
app.use('/api/*', async (c, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin) {
      const o = originOf(origin);
      const own = new URL(c.req.url).origin;
      const configured = c.env.PUBLIC_APP_URL ? originOf(c.env.PUBLIC_APP_URL) : null;
      const local = c.env.APP_ENV !== 'production' && o !== null && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
      if (o === null || (o !== own && o !== configured && !local)) return c.json({ error: { code: 'CROSS_SITE_BLOCKED', message: 'This request came from another website and was not accepted' } }, 403);
    }
  }
  await next();
  const h = new Headers(c.res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('x-frame-options', 'DENY');
  h.set('referrer-policy', 'no-referrer');
  h.set('cross-origin-resource-policy', 'same-origin');
  if (c.env.APP_ENV === 'production') h.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  // Answers about a signed-in person are never stored by a browser or a shared cache, unless the route says otherwise.
  if (!h.has('cache-control') && /^\/api\/(auth|student|console|admin|review)\b/.test(new URL(c.req.url).pathname)) h.set('cache-control', 'no-store');
  c.res = new Response(c.res.body, { status: c.res.status, statusText: c.res.statusText, headers: h });
});
app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/health/db', async (c) => {
  await rateLimit(c.env, c.req, 'health-db', null, 30, 60);
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS exams FROM exams').first<{ exams: number }>();
  return c.json({ ok: true, exams: row?.exams ?? 0 });
});
app.use('/api/*', prismaMiddleware);
app.use('/api/admin/*', adminAuth);
app.route('/api/admin', admin);
app.route('/api/public', pub);
app.route('/api/review', review);
app.route('/api/console', consoleApi);
app.route('/api/auth', auth);
app.route('/api/learn', learn);
app.route('/api/student', student);
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));

const DAILY_CRON = '30 13 * * *';

/**
 * Cron Triggers. Every run checks the official notice pages that are due (the job paces itself and does nothing while
 * NOTICE_FETCH is off). The once-a-day run also sends study reminders and looks after payments.
 */
async function scheduled(controller: ScheduledController, env: AppEnv['Bindings'], ctx: ExecutionContext) {
  ctx.waitUntil(syncNotices(env).then((r) => r.ran && console.log('Official notices', JSON.stringify(r)), (e) => console.error('Official notices failed', (e as Error).message)));
  // Every run: failed emails that are due for another try (nothing happens while email is off).
  ctx.waitUntil(retryFailedEmails(env).then((r) => r.due && console.log('Email retries', JSON.stringify(r)), (e) => console.error('Email retries failed', (e as Error).message)));
  if (controller?.cron && controller.cron !== DAILY_CRON) return;
  ctx.waitUntil(housekeeping(env.DB).then((r) => console.log('Housekeeping', JSON.stringify(r)), (e) => console.error('Housekeeping failed', (e as Error).message)));
  ctx.waitUntil(sendDailyReminders(env).then((r) => console.log('Daily reminders', JSON.stringify(r))));
  ctx.waitUntil(sendExamCountdowns(env).then((r) => console.log('Exam countdowns', JSON.stringify(r)), (e) => console.error('Exam countdowns failed', (e as Error).message)));
  ctx.waitUntil(sendRevisionReminders(env).then((r) => console.log('Revision reminders', JSON.stringify(r)), (e) => console.error('Revision reminders failed', (e as Error).message)));
  ctx.waitUntil(sendNoticeAlerts(env).then((r) => console.log('Notice alerts', JSON.stringify(r)), (e) => console.error('Notice alerts failed', (e as Error).message)));
  // Payments: match unpaid orders with the gateway and tell students whose paid access ends soon. Nothing happens while payments are off.
  if (gatewayState(env).ready) {
    ctx.waitUntil(reconcileOrders(env).then((r) => console.log('Payment reconciliation', JSON.stringify(r))));
    ctx.waitUntil(sendExpiryNotices(env).then((r) => console.log('Expiry notices', JSON.stringify(r))));
  }
}

/** Queue consumer: Cloudflare Email Sending delivery events (bounces, complaints, deliveries). */
async function queue(batch: MessageBatch<unknown>, env: AppEnv['Bindings']) {
  for (const message of batch.messages) {
    try {
      await handleCloudflareEmailEvent(env.DB, message.body as Parameters<typeof handleCloudflareEmailEvent>[1]);
      message.ack();
    } catch (e) {
      console.error('Email event failed', (e as Error).message);
      message.retry();
    }
  }
}

export default Object.assign(app, { scheduled, queue });
