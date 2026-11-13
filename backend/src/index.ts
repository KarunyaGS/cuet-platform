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
import { handleCloudflareEmailEvent, sendDailyReminders } from './services/email';
import { gatewayState, reconcileOrders, sendExpiryNotices } from './services/billing';
import { syncNotices } from './services/gov-notices';

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
  if (controller?.cron && controller.cron !== DAILY_CRON) return;
  ctx.waitUntil(sendDailyReminders(env).then((r) => console.log('Daily reminders', JSON.stringify(r))));
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
