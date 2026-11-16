/**
 * Student-facing endpoints. They read only PUBLISHED, non-demonstration records, never return answer
 * keys before an attempt, and evaluate answers from stored keys with deterministic code (no AI calls).
 */
import { admissionFilters, programmeDetail, programmeQuery, programmesList, universityPage } from '../services/admissions';
import { Hono } from 'hono';
import { rateLimit } from '../lib/rate-limit';
import type { AppEnv } from '../types';
import { readJson } from '../lib/http';
import { getQuestionPublic } from '../services/questions';
import { getResource } from '../services/resources';
import { examSchema, getOfficialInfo, listUniversities, universityQuery } from '../services/official-info';
import { handleResendWebhook, unsubscribe, unsubscribeSchema } from '../services/email';
import { gatewayState, handleRazorpayWebhook, listPlans } from '../services/billing';
import { listNotices, noticeQuery, publicNoticeDetail } from '../services/gov-notices';

const pub = new Hono<AppEnv>();

pub.get('/questions/:id', async (c) => c.json(await getQuestionPublic(c.get('prisma'), c.req.param('id'))));
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
pub.get('/notices/:id', async (c) => c.json(await publicNoticeDetail(c.env.DB, c.req.param('id'))));
pub.get('/notices', async (c) => c.json(await listNotices(c.env.DB, noticeQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));

// Official exam information pages and participating universities: open to everyone, no sign-in.
pub.get('/info/:exam', async (c) => c.json(await getOfficialInfo(c.env.DB, examSchema.parse(c.req.param('exam')))));
// One university's admission page: its official pages and every published, sourced fact. Open to everyone.
pub.get('/admissions/filters', async (c) => c.json(await admissionFilters(c.env.DB)));
pub.get('/admissions/programmes', async (c) => c.json(await programmesList(c.env.DB, programmeQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));
pub.get('/admissions/programmes/:id', async (c) => c.json(await programmeDetail(c.env.DB, c.req.param('id'))));
pub.get('/admissions/universities/:slug', async (c) => c.json(await universityPage(c.env.DB, c.req.param('slug'))));
pub.get('/universities', async (c) => c.json(await listUniversities(c.env.DB, universityQuery.parse({ exam: c.req.query('exam'), q: c.req.query('q') || undefined, type: c.req.query('type') || undefined }))));

// Email: one-click stop for study reminders, and delivery events from the standby provider (signature checked).
// One-click unsubscribe. A mail program posts to the address in the List-Unsubscribe header (token in the query string, form body);
// the unsubscribe page posts JSON. Either way the answer is the same, whatever the token.
pub.post('/email/unsubscribe', async (c) => {
  await rateLimit(c.env, c.req, 'unsubscribe-ip', null, 60, 3600);
  const token = c.req.query('token');
  const input = token ? unsubscribeSchema.parse({ token, scope: (c.req.query('scope') ?? 'reminders').toUpperCase() }) : await readJson(c, unsubscribeSchema);
  return c.json(await unsubscribe(c.env.DB, input));
});
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
