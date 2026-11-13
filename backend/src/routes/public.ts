/**
 * Student-facing endpoints. They read only PUBLISHED, non-demonstration records, never return answer
 * keys before an attempt, and evaluate answers from stored keys with deterministic code (no AI calls).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { readJson } from '../lib/http';
import { evaluateQuestion, evaluateSchema, getQuestionPublic } from '../services/questions';
import { getResource } from '../services/resources';
import { examSchema, getOfficialInfo, listUniversities, universityQuery } from '../services/official-info';
import { handleResendWebhook, unsubscribe, unsubscribeSchema } from '../services/email';
import { gatewayState, handleRazorpayWebhook, listPlans } from '../services/billing';
import { listNotices, noticeQuery } from '../services/gov-notices';

const pub = new Hono<AppEnv>();

pub.get('/questions/:id', async (c) => c.json(await getQuestionPublic(c.get('prisma'), c.req.param('id'))));
pub.post('/questions/:id/evaluate', async (c) => c.json(await evaluateQuestion(c.get('prisma'), c.req.param('id'), await readJson(c, evaluateSchema))));
pub.get('/resources/:id', async (c) => c.json(await getResource(c.get('prisma'), c.req.param('id'), true)));
pub.get('/topics/:id/content', async (c) => {
  const prisma = c.get('prisma');
  const id = c.req.param('id');
  const [resources, questions] = await Promise.all([
    prisma.learningResource.findMany({ where: { curriculumNodeId: id, status: 'PUBLISHED', isDemonstration: false }, select: { id: true, type: true, title: true, language: true } }),
    prisma.question.findMany({ where: { status: 'PUBLISHED', isDemonstration: false, topics: { some: { curriculumNodeId: id } } }, select: { id: true, type: true, difficulty: true }, take: 100 }),
  ]);
  return c.json({ topicId: id, resources, questions });
});

// Government updates: published official notices, the same for everyone. Each links to the exam body's own page and document.
pub.get('/notices', async (c) => c.json(await listNotices(c.env.DB, noticeQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));

// Official exam information pages and participating universities: open to everyone, no sign-in.
pub.get('/info/:exam', async (c) => c.json(await getOfficialInfo(c.env.DB, examSchema.parse(c.req.param('exam')))));
pub.get('/universities', async (c) => c.json(await listUniversities(c.env.DB, universityQuery.parse({ exam: c.req.query('exam'), q: c.req.query('q') || undefined, type: c.req.query('type') || undefined }))));

// Email: one-click stop for study reminders, and delivery events from the standby provider (signature checked).
pub.post('/email/unsubscribe', async (c) => c.json(await unsubscribe(c.env.DB, await readJson(c, unsubscribeSchema))));
pub.post('/email/webhooks/resend', async (c) =>
  c.json(await handleResendWebhook(c.env, { id: c.req.header('svix-id'), timestamp: c.req.header('svix-timestamp'), signature: c.req.header('svix-signature') }, await c.req.text())),
);

// Plans on offer (prices come from the database) and the payment gateway's webhook (signature checked on the raw body).
pub.get('/plans', async (c) => {
  const plans = await listPlans(c.env.DB, true);
  return c.json({ paymentsAvailable: gatewayState(c.env).ready, plans: plans.map(({ id: _id, active: _active, sortOrder: _sort, ...p }) => p) });
});
pub.post('/payments/webhooks/razorpay', async (c) => c.json(await handleRazorpayWebhook(c.env, await c.req.text(), c.req.header('x-razorpay-signature'), c.req.header('x-razorpay-event-id'))));

export default pub;
