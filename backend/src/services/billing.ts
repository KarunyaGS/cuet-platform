/**
 * Plans, paid access and payments.
 *
 * Model: prepaid passes. A student pays once and gets a fixed number of days. Nothing renews by itself and no
 * payment mandate is stored; buying again adds days after the current end date.
 *
 * Money safety:
 *  - Prices, lengths and limits live in the `plans` table and are edited in the admin console, never in code.
 *  - The amount is copied onto the order when it is created and is the only amount ever accepted for it.
 *  - Access is given only after the gateway's signature is verified (checkout or webhook) or after the gateway's
 *    own API confirms a captured payment of the exact amount (reconciliation). The browser is never trusted.
 *  - Every gateway report is stored once (unique ids), so a repeated webhook or a double click cannot pay twice.
 *
 * Gateways: "mock" (local development and tests only, no outside calls) and "razorpay" (test or live keys).
 * Live keys are refused unless PAYMENTS_MODE=live and PAYMENTS_LIVE_APPROVED=yes are both set.
 */
import { z } from 'zod';
import type { Bindings } from '../types';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { sendEmail } from './email';

// ---------------------------------------------------------------- gateway configuration

export type GatewayName = 'mock' | 'razorpay';
export interface GatewayState { mode: 'off' | 'mock' | 'test' | 'live'; gateway: GatewayName | null; ready: boolean; reason: string | null }

export function gatewayState(env: Bindings): GatewayState {
  const mode = (env.PAYMENTS_MODE ?? 'off').toLowerCase();
  const off = (reason: string | null): GatewayState => ({ mode: 'off', gateway: null, ready: false, reason });
  if (mode === 'mock') return env.APP_ENV === 'development' ? { mode: 'mock', gateway: 'mock', ready: true, reason: null } : off('The mock gateway is for local development only');
  if (mode === 'test' || mode === 'live') {
    const id = env.RAZORPAY_KEY_ID ?? '';
    if (!id || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET) return off('Razorpay keys or the webhook secret are not set');
    if (mode === 'test' && !id.startsWith('rzp_test_')) return off('PAYMENTS_MODE is "test" but the key is not a Razorpay test key');
    if (mode === 'live' && !id.startsWith('rzp_live_')) return off('PAYMENTS_MODE is "live" but the key is not a Razorpay live key');
    if (mode === 'live' && env.PAYMENTS_LIVE_APPROVED !== 'yes') return off('Live payments have not been approved (PAYMENTS_LIVE_APPROVED is not "yes")');
    return { mode, gateway: 'razorpay', ready: true, reason: null };
  }
  return off(null);
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}
const sameText = (a: string, b: string) => {
  const x = enc.encode(a);
  const y = enc.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
};

let razorpayFetch: typeof fetch = (...a) => fetch(...a);
/** Tests only: replaces the HTTPS calls to Razorpay. */
export function setRazorpayFetchForTests(f: typeof fetch | null) {
  razorpayFetch = f ?? ((...a) => fetch(...a));
}

async function razorpay<T>(env: Bindings, method: string, path: string, body?: unknown): Promise<T> {
  const res = await razorpayFetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; description?: string } };
  if (!res.ok) throw new ApiError(503, 'GATEWAY_ERROR', `The payment service did not accept the request (${json.error?.code ?? res.status}). Please try again.`);
  return json;
}

// ---------------------------------------------------------------- plans

const LIMIT_KEYS = ['mockTests', 'topicTests', 'practiceSets'] as const;
type LimitKey = (typeof LIMIT_KEYS)[number];
export type Limits = Partial<Record<LimitKey, number | null>>;
const limitsSchema = z.object({ mockTests: z.number().int().min(0).max(100000).nullable().optional(), topicTests: z.number().int().min(0).max(100000).nullable().optional(), practiceSets: z.number().int().min(0).max(100000).nullable().optional() }).strict();

interface PlanRow { id: string; code: string; name: string; description: string | null; price_paise: number; currency: string; duration_days: number | null; is_free: number; active: number; sort_order: number; limits_json: string; features_json: string }
const planOut = (p: PlanRow) => ({
  id: p.id, code: p.code, name: p.name, description: p.description, pricePaise: p.price_paise, currency: p.currency, durationDays: p.duration_days,
  isFree: Boolean(p.is_free), active: Boolean(p.active), sortOrder: p.sort_order, limits: JSON.parse(p.limits_json || '{}') as Limits, features: JSON.parse(p.features_json || '[]') as string[],
});
export type PlanOut = ReturnType<typeof planOut>;

export async function listPlans(db: D1Database, onlyActive: boolean) {
  const { results } = await db.prepare(`SELECT * FROM plans ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY is_free DESC, sort_order, price_paise`).all<PlanRow>();
  return results.map(planOut);
}

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullable(),
  /** Whole paise. ₹499 is 49900. */
  pricePaise: z.number().int().min(0).max(10_000_000),
  durationDays: z.number().int().min(1).max(1100).nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  limits: limitsSchema,
  features: z.array(z.string().trim().min(1).max(120)).max(12),
});
export const planCreateSchema = planInputSchema.extend({ code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Use capital letters, digits and underscores') });

function checkPlanRules(isFree: boolean, input: z.infer<typeof planInputSchema>) {
  if (isFree) {
    if (input.pricePaise !== 0) throw invalid('The free plan has no price');
    if (input.durationDays !== null) throw invalid('The free plan has no end date');
    if (!input.active) throw invalid('The free plan cannot be switched off: every student without paid access is on it');
  } else {
    if (input.durationDays === null) throw invalid('A paid plan needs a length in days');
    if (input.active && input.pricePaise < 100) throw invalid('Set a price of at least ₹1 before offering this plan to students');
  }
}

export async function updatePlan(db: D1Database, id: string, input: z.infer<typeof planInputSchema>, actor: string) {
  const cur = await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first<PlanRow>();
  if (!cur) throw notFound('Plan');
  checkPlanRules(Boolean(cur.is_free), input);
  const now = nowIso();
  await db.batch([
    db
      .prepare('UPDATE plans SET name = ?, description = ?, price_paise = ?, duration_days = ?, active = ?, sort_order = ?, limits_json = ?, features_json = ?, updated_at = ? WHERE id = ?')
      .bind(input.name, input.description, input.pricePaise, input.durationDays, input.active ? 1 : 0, input.sortOrder, JSON.stringify(input.limits), JSON.stringify(input.features), now, id),
    db
      .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, 'UPDATE_PLAN', 'PLAN', id, JSON.stringify({ code: cur.code, before: { pricePaise: cur.price_paise, durationDays: cur.duration_days, active: Boolean(cur.active), limits: JSON.parse(cur.limits_json || '{}') }, after: { pricePaise: input.pricePaise, durationDays: input.durationDays, active: input.active, limits: input.limits } }), now),
  ]);
  return planOut((await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first<PlanRow>())!);
}

export async function createPlan(db: D1Database, input: z.infer<typeof planCreateSchema>, actor: string) {
  checkPlanRules(false, input);
  if (await db.prepare('SELECT 1 FROM plans WHERE code = ?').bind(input.code).first()) throw conflict('A plan with this code already exists');
  const id = newId('plan');
  const now = nowIso();
  await db.batch([
    db
      .prepare('INSERT INTO plans (id, code, name, description, price_paise, currency, duration_days, is_free, active, sort_order, limits_json, features_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.code, input.name, input.description, input.pricePaise, 'INR', input.durationDays, input.active ? 1 : 0, input.sortOrder, JSON.stringify(input.limits), JSON.stringify(input.features), now, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'CREATE_PLAN', 'PLAN', id, JSON.stringify({ code: input.code, pricePaise: input.pricePaise }), now),
  ]);
  return planOut((await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first<PlanRow>())!);
}

// ---------------------------------------------------------------- what a student has access to

const USAGE_DAYS = 30;
const MODE_LIMIT: Record<string, LimitKey> = { MOCK_TEST: 'mockTests', TOPIC_TEST: 'topicTests', PRACTICE: 'practiceSets' };
const LIMIT_LABEL: Record<LimitKey, string> = { mockTests: 'mock tests', topicTests: 'topic tests', practiceSets: 'practice sets' };

export async function currentAccess(db: D1Database, userId: string) {
  const now = nowIso();
  const [paid, free, usage] = await Promise.all([
    db
      .prepare(`SELECT s.id AS subscription_id, s.ends_at, p.* FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.starts_at <= ? AND s.ends_at > ? ORDER BY s.ends_at DESC LIMIT 1`)
      .bind(userId, now, now)
      .first<PlanRow & { subscription_id: string; ends_at: string }>(),
    db.prepare('SELECT * FROM plans WHERE is_free = 1 LIMIT 1').first<PlanRow>(),
    db
      .prepare('SELECT mode, COUNT(*) AS n FROM practice_sessions WHERE user_id = ? AND started_at >= ? GROUP BY mode')
      .bind(userId, new Date(Date.now() - USAGE_DAYS * 86400_000).toISOString())
      .all<{ mode: string; n: number }>(),
  ]);
  // The last day of paid access, counting passes bought ahead that start when the current one ends.
  const until = paid ? await db.prepare(`SELECT MAX(ends_at) AS e FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE' AND ends_at > ?`).bind(userId, now).first<{ e: string | null }>() : null;
  const plan = planOut(paid ?? free!);
  const used: Record<LimitKey, number> = { mockTests: 0, topicTests: 0, practiceSets: 0 };
  for (const u of usage.results) if (MODE_LIMIT[u.mode]) used[MODE_LIMIT[u.mode]!] += u.n;
  return {
    plan: { code: plan.code, name: plan.name, isFree: plan.isFree, features: plan.features },
    paid: Boolean(paid),
    paidUntil: until?.e ?? null,
    usageDays: USAGE_DAYS,
    limits: LIMIT_KEYS.map((k) => ({ key: k, label: LIMIT_LABEL[k], limit: plan.limits[k] ?? null, used: used[k] })),
  };
}

/** Refuses to start a test or practice set when the student's plan limit for the last 30 days is used up. */
export async function assertWithinPlan(db: D1Database, userId: string, mode: string) {
  const key = MODE_LIMIT[mode];
  if (!key) return;
  const access = await currentAccess(db, userId);
  const l = access.limits.find((x) => x.key === key)!;
  if (l.limit !== null && l.used >= l.limit) {
    throw new ApiError(402, 'PLAN_LIMIT', `Your ${access.plan.name} plan includes ${l.limit} ${l.limit === 1 ? l.label.replace(/s$/, '') : l.label} every ${USAGE_DAYS} days, and you have used ${l.limit === 1 ? 'it' : 'them'}.`);
  }
}

// ---------------------------------------------------------------- buying a plan

interface OrderRow { id: string; user_id: string; plan_id: string; amount_paise: number; currency: string; status: string; gateway: string; gateway_order_id: string | null; receipt: string; plan_snapshot_json: string; failure_reason: string | null; created_at: string; paid_at: string | null }
export const orderSchema = z.object({ planCode: z.string().trim().min(2).max(30) });

const checkoutInfo = (env: Bindings, o: OrderRow) => {
  const snap = JSON.parse(o.plan_snapshot_json) as { name: string; durationDays: number };
  return { orderId: o.id, gateway: o.gateway, gatewayOrderId: o.gateway_order_id, amountPaise: o.amount_paise, currency: o.currency, planName: snap.name, durationDays: snap.durationDays, keyId: o.gateway === 'razorpay' ? env.RAZORPAY_KEY_ID ?? null : null, status: o.status };
};

export async function createOrder(env: Bindings, userId: string, input: z.infer<typeof orderSchema>) {
  const g = gatewayState(env);
  if (!g.ready || !g.gateway) throw new ApiError(503, 'PAYMENTS_OFF', 'Online payment is not available yet');
  const db = env.DB;
  const plan = await db.prepare('SELECT * FROM plans WHERE code = ? AND active = 1 AND is_free = 0').bind(input.planCode).first<PlanRow>();
  if (!plan || plan.price_paise < 100 || !plan.duration_days) throw notFound('Plan');
  // A second click within a few minutes returns the same unpaid order instead of creating another.
  const recent = await db
    .prepare(`SELECT * FROM payment_orders WHERE user_id = ? AND plan_id = ? AND amount_paise = ? AND gateway = ? AND status = 'CREATED' AND created_at >= ? ORDER BY created_at DESC LIMIT 1`)
    .bind(userId, plan.id, plan.price_paise, g.gateway, new Date(Date.now() - 20 * 60_000).toISOString())
    .first<OrderRow>();
  if (recent?.gateway_order_id) return checkoutInfo(env, recent);
  const id = newId('ord');
  const receipt = `cuet_${id}`;
  const now = nowIso();
  const snapshot = JSON.stringify({ code: plan.code, name: plan.name, durationDays: plan.duration_days, pricePaise: plan.price_paise, currency: plan.currency });
  await db
    .prepare(`INSERT INTO payment_orders (id, user_id, plan_id, amount_paise, currency, status, gateway, gateway_order_id, receipt, plan_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'CREATED', ?, NULL, ?, ?, ?, ?)`)
    .bind(id, userId, plan.id, plan.price_paise, plan.currency, g.gateway, receipt, snapshot, now, now)
    .run();
  let gatewayOrderId: string;
  try {
    // Only our own order reference goes to the gateway: no name, email or other personal detail.
    gatewayOrderId = g.gateway === 'mock' ? `mock_order_${newId('m').slice(2)}` : (await razorpay<{ id: string }>(env, 'POST', '/orders', { amount: plan.price_paise, currency: plan.currency, receipt, notes: { order: id } })).id;
  } catch (e) {
    await db.prepare(`UPDATE payment_orders SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE id = ?`).bind('The payment service could not create the order', nowIso(), id).run();
    throw e;
  }
  await db.prepare('UPDATE payment_orders SET gateway_order_id = ?, updated_at = ? WHERE id = ?').bind(gatewayOrderId, nowIso(), id).run();
  return checkoutInfo(env, (await db.prepare('SELECT * FROM payment_orders WHERE id = ?').bind(id).first<OrderRow>())!);
}

interface Report { gatewayId: string; status: 'CAPTURED' | 'FAILED' | 'AUTHORIZED'; amountPaise: number; method?: string | null; errorCode?: string | null; errorDescription?: string | null; reportedBy: 'CHECKOUT' | 'WEBHOOK' | 'RECONCILIATION' | 'SIMULATED' }

const recordTx = (db: D1Database, orderId: string, kind: 'PAYMENT' | 'REFUND', r: Omit<Report, 'status'> & { status: string }, now: string) =>
  db
    .prepare(
      `INSERT INTO payment_transactions (id, order_id, kind, gateway_id, status, amount_paise, method, error_code, error_description, reported_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (gateway_id) DO UPDATE SET status = CASE WHEN payment_transactions.status IN ('CAPTURED','REFUNDED') THEN payment_transactions.status ELSE excluded.status END, method = COALESCE(excluded.method, payment_transactions.method), updated_at = excluded.updated_at`,
    )
    .bind(newId('ptx'), orderId, kind, r.gatewayId, r.status, r.amountPaise, r.method ?? null, r.errorCode ?? null, r.errorDescription?.slice(0, 300) ?? null, r.reportedBy, now, now);

/**
 * Applies a verified gateway report to an order. A captured payment of the exact amount marks the order paid and
 * gives access once; anything else is recorded without giving access. Safe to call any number of times.
 */
export async function applyPaymentReport(env: Bindings, order: OrderRow, r: Report): Promise<{ result: 'PAID' | 'ALREADY_PAID' | 'PENDING' | 'FAILED' | 'AMOUNT_MISMATCH' }> {
  const db = env.DB;
  const now = nowIso();
  if (r.status === 'CAPTURED' && r.amountPaise !== order.amount_paise) {
    await db.batch([
      recordTx(db, order.id, 'PAYMENT', { ...r, status: 'FAILED', errorCode: 'AMOUNT_MISMATCH', errorDescription: `Paid ${r.amountPaise}, expected ${order.amount_paise}` }, now),
      db.prepare(`UPDATE payment_orders SET failure_reason = ?, updated_at = ? WHERE id = ? AND status = 'CREATED'`).bind('The amount paid does not match the order. Access was not given; the team has been told.', now, order.id),
    ]);
    console.error('Payment amount mismatch', { order: order.id });
    return { result: 'AMOUNT_MISMATCH' };
  }
  if (r.status !== 'CAPTURED') {
    await db.batch([
      recordTx(db, order.id, 'PAYMENT', r, now),
      ...(r.status === 'FAILED' ? [db.prepare(`UPDATE payment_orders SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE id = ? AND status = 'CREATED'`).bind(r.errorDescription?.slice(0, 300) ?? 'The payment did not go through', now, order.id)] : []),
    ]);
    return { result: r.status === 'FAILED' ? 'FAILED' : 'PENDING' };
  }
  if (order.status === 'PAID') {
    await recordTx(db, order.id, 'PAYMENT', r, now).run();
    return { result: 'ALREADY_PAID' };
  }
  if (order.status === 'REFUNDED') return { result: 'ALREADY_PAID' };
  const snap = JSON.parse(order.plan_snapshot_json) as { name: string; durationDays: number };
  // New days start when the student's current paid access ends, so paying early never loses days.
  const last = await db.prepare(`SELECT MAX(ends_at) AS e FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE' AND ends_at > ?`).bind(order.user_id, now).first<{ e: string | null }>();
  const startsAt = last?.e ?? now;
  const endsAt = new Date(new Date(startsAt).getTime() + snap.durationDays * 86400_000).toISOString();
  const out = await db.batch([
    db.prepare(`UPDATE payment_orders SET status = 'PAID', paid_at = ?, failure_reason = NULL, updated_at = ? WHERE id = ? AND status IN ('CREATED','FAILED','EXPIRED')`).bind(now, now, order.id),
    // Written only if this call is the one that marked the order paid; the unique order id is a second guard.
    db
      .prepare(`INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at, source, order_id, created_by, created_at, updated_at) SELECT ?, ?, ?, 'ACTIVE', ?, ?, 'ORDER', ?, ?, ?, ? WHERE changes() = 1 ON CONFLICT (order_id) DO NOTHING`)
      .bind(newId('sub'), order.user_id, order.plan_id, startsAt, endsAt, order.id, `payment:${order.id}`, now, now),
    recordTx(db, order.id, 'PAYMENT', r, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), `payment:${r.reportedBy.toLowerCase()}`, 'PAYMENT_CAPTURED', 'PAYMENT_ORDER', order.id, JSON.stringify({ amountPaise: r.amountPaise, reportedBy: r.reportedBy }), now),
  ]);
  if ((out[0]!.meta.changes ?? 0) !== 1) return { result: 'ALREADY_PAID' };
  await paymentReceivedEmail(env, order, snap.name, endsAt).catch((e) => console.error('Receipt email failed', (e as Error).message));
  return { result: 'PAID' };
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;
const dateIn = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const plainEmail = (heading: string, lines: string[]) => ({
  text: [heading, '', ...lines, '', 'CUET Prep'].join('\n'),
  html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b19"><p style="font-size:14px;font-weight:bold">CUET Prep</p><h1 style="font-size:20px">${esc(heading)}</h1>${lines.map((l) => `<p style="font-size:15px;line-height:1.55">${esc(l)}</p>`).join('')}</div>`,
});

async function paymentReceivedEmail(env: Bindings, order: OrderRow, planName: string, endsAt: string) {
  const u = await env.DB.prepare('SELECT email, display_name FROM users WHERE id = ?').bind(order.user_id).first<{ email: string; display_name: string }>();
  if (!u) return;
  const body = plainEmail('Payment received', [`Hello ${u.display_name},`, `We received ${rupees(order.amount_paise)} for the ${planName} plan.`, `Your paid access runs until ${dateIn(endsAt)}. It does not renew by itself and no further payment will be taken.`, `Reference: ${order.receipt}`]);
  await sendEmail(env, { to: u.email, userId: order.user_id, kind: 'ACCOUNT_NOTICE', subject: 'Payment received for CUET Prep', dedupeKey: `paid:${order.id}`, ...body });
}

export const confirmSchema = z.object({ gatewayPaymentId: z.string().trim().min(6).max(80), signature: z.string().trim().min(32).max(200) });

/** Called by the browser after Razorpay checkout succeeds. The signature proves the payment belongs to this order. */
export async function confirmCheckout(env: Bindings, userId: string, orderId: string, input: z.infer<typeof confirmSchema>) {
  const order = await env.DB.prepare('SELECT * FROM payment_orders WHERE id = ? AND user_id = ?').bind(orderId, userId).first<OrderRow>();
  if (!order || order.gateway !== 'razorpay' || !order.gateway_order_id) throw notFound('Order');
  if (!gatewayState(env).ready) throw new ApiError(503, 'PAYMENTS_OFF', 'Online payment is not available');
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET!, `${order.gateway_order_id}|${input.gatewayPaymentId}`);
  if (!sameText(expected, input.signature.toLowerCase())) throw new ApiError(400, 'BAD_SIGNATURE', 'The payment could not be verified. If money left your account, it will be matched automatically within a few minutes.');
  // The signature proves the pairing; the gateway's own record gives the status and the amount.
  const p = await razorpay<{ id: string; order_id: string; status: string; amount: number; method?: string }>(env, 'GET', `/payments/${encodeURIComponent(input.gatewayPaymentId)}`);
  if (p.order_id !== order.gateway_order_id) throw new ApiError(400, 'BAD_SIGNATURE', 'The payment does not belong to this order');
  const status = p.status === 'captured' ? 'CAPTURED' : p.status === 'failed' ? 'FAILED' : 'AUTHORIZED';
  const r = await applyPaymentReport(env, order, { gatewayId: p.id, status, amountPaise: p.amount, method: p.method ?? null, reportedBy: 'CHECKOUT' });
  return { ...r, access: await currentAccess(env.DB, userId) };
}

export const simulateSchema = z.object({ outcome: z.enum(['success', 'failure']) });

/** Local development only: stands in for the gateway's payment page. Refused unless the mock gateway is the active one. */
export async function simulatePayment(env: Bindings, userId: string, orderId: string, input: z.infer<typeof simulateSchema>) {
  if (gatewayState(env).gateway !== 'mock') throw notFound('Order');
  const order = await env.DB.prepare(`SELECT * FROM payment_orders WHERE id = ? AND user_id = ? AND gateway = 'mock'`).bind(orderId, userId).first<OrderRow>();
  if (!order) throw notFound('Order');
  const gatewayId = `mock_pay_${newId('m').slice(2)}`;
  const r = await applyPaymentReport(env, order, input.outcome === 'success'
    ? { gatewayId, status: 'CAPTURED', amountPaise: order.amount_paise, method: 'upi', reportedBy: 'SIMULATED' }
    : { gatewayId, status: 'FAILED', amountPaise: order.amount_paise, method: 'upi', errorCode: 'BAD_REQUEST_ERROR', errorDescription: 'Payment was declined by the bank (simulated)', reportedBy: 'SIMULATED' });
  return { ...r, access: await currentAccess(env.DB, userId) };
}

// ---------------------------------------------------------------- webhooks

interface RazorpayEvent {
  event?: string;
  payload?: {
    payment?: { entity?: { id: string; order_id?: string; status?: string; amount?: number; method?: string; error_code?: string; error_description?: string } };
    order?: { entity?: { id: string } };
    refund?: { entity?: { id: string; payment_id?: string; amount?: number; status?: string } };
  };
}

/**
 * Razorpay webhook. The raw body is checked against the X-Razorpay-Signature header (HMAC-SHA256 with the webhook
 * secret) before anything in it is believed. Each event id is processed once.
 */
export async function handleRazorpayWebhook(env: Bindings, rawBody: string, signature: string | undefined, eventId: string | undefined) {
  const db = env.DB;
  if (!env.RAZORPAY_WEBHOOK_SECRET || gatewayState(env).gateway !== 'razorpay') throw notFound('Webhook');
  const valid = Boolean(signature) && sameText(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature!.toLowerCase());
  const id = eventId?.slice(0, 100) || `body:${await hmacHex('event-id', rawBody)}`;
  const log = (type: string, result: string, detail: string | null, gatewayOrderId: string | null) =>
    db
      .prepare(`INSERT INTO payment_events (id, gateway, event_id, type, signature_valid, result, detail, gateway_order_id, received_at) VALUES (?, 'razorpay', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (gateway, event_id) DO NOTHING`)
      .bind(newId('pev'), id, type.slice(0, 60), valid ? 1 : 0, result, detail?.slice(0, 300) ?? null, gatewayOrderId, nowIso())
      .run();
  if (!valid) {
    await log('unverified', 'REJECTED', 'Signature did not match', null);
    throw new ApiError(401, 'BAD_SIGNATURE', 'The webhook signature is not valid');
  }
  const event = JSON.parse(rawBody) as RazorpayEvent;
  const type = event.event ?? 'unknown';
  const pay = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;
  const gatewayOrderId = pay?.order_id ?? event.payload?.order?.entity?.id ?? null;
  const first = await log(type, 'PROCESSED', null, gatewayOrderId);
  if ((first.meta.changes ?? 0) !== 1) return { received: true, result: 'DUPLICATE' };
  const finish = async (result: string, detail: string | null) => {
    await db.prepare(`UPDATE payment_events SET result = ?, detail = ? WHERE gateway = 'razorpay' AND event_id = ?`).bind(result, detail?.slice(0, 300) ?? null, id).run();
    return { received: true, result };
  };
  try {
    if (type === 'refund.processed' && refund?.payment_id) {
      const tx = await db.prepare(`SELECT order_id FROM payment_transactions WHERE gateway_id = ? AND kind = 'PAYMENT'`).bind(refund.payment_id).first<{ order_id: string }>();
      if (!tx) return finish('IGNORED', 'Refund for a payment this platform does not know');
      await applyRefund(db, tx.order_id, { gatewayId: refund.id, amountPaise: refund.amount ?? 0 }, 'payment:webhook');
      return finish('PROCESSED', 'Refund recorded; access ended');
    }
    if (!['payment.captured', 'payment.failed', 'payment.authorized', 'order.paid'].includes(type) || !pay || !gatewayOrderId) return finish('IGNORED', 'Event type not used');
    const order = await db.prepare(`SELECT * FROM payment_orders WHERE gateway_order_id = ? AND gateway = 'razorpay'`).bind(gatewayOrderId).first<OrderRow>();
    if (!order) return finish('IGNORED', 'Order not found');
    const status = type === 'payment.failed' ? 'FAILED' : pay.status === 'captured' || type === 'payment.captured' || type === 'order.paid' ? 'CAPTURED' : 'AUTHORIZED';
    const r = await applyPaymentReport(env, order, { gatewayId: pay.id, status, amountPaise: pay.amount ?? 0, method: pay.method ?? null, errorCode: pay.error_code ?? null, errorDescription: pay.error_description ?? null, reportedBy: 'WEBHOOK' });
    return finish('PROCESSED', r.result);
  } catch (e) {
    // Let the gateway deliver the event again: forget that we saw it.
    await db.prepare(`DELETE FROM payment_events WHERE gateway = 'razorpay' AND event_id = ?`).bind(id).run();
    throw e;
  }
}

/** A refund ends the access that the order gave. Used by the webhook and by an administrator recording a manual refund. */
export async function applyRefund(db: D1Database, orderId: string, refund: { gatewayId: string; amountPaise: number }, actor: string) {
  const now = nowIso();
  await db.batch([
    recordTx(db, orderId, 'REFUND', { gatewayId: refund.gatewayId, status: 'REFUNDED', amountPaise: refund.amountPaise, reportedBy: actor.startsWith('user:') ? 'RECONCILIATION' : 'WEBHOOK' }, now),
    db.prepare(`UPDATE payment_orders SET status = 'REFUNDED', updated_at = ? WHERE id = ? AND status = 'PAID'`).bind(now, orderId),
    db.prepare(`UPDATE subscriptions SET status = 'REFUNDED', updated_at = ? WHERE order_id = ? AND status = 'ACTIVE'`).bind(now, orderId),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'PAYMENT_REFUNDED', 'PAYMENT_ORDER', orderId, JSON.stringify(refund), now),
  ]);
  return { refunded: true };
}

// ---------------------------------------------------------------- reconciliation and housekeeping

/**
 * Asks the gateway about unpaid orders, in case a student paid but neither the browser nor the webhook reached us.
 * Orders still unpaid after a day are closed as EXPIRED (a later payment report can still reopen and pay them).
 */
export async function reconcileOrders(env: Bindings, onlyOrderId?: string) {
  const db = env.DB;
  const out = { checked: 0, paid: 0, failed: 0, expired: 0, stillOpen: 0, errors: 0 };
  const g = gatewayState(env);
  const { results } = onlyOrderId
    ? await db.prepare('SELECT * FROM payment_orders WHERE id = ?').bind(onlyOrderId).all<OrderRow>()
    : await db.prepare(`SELECT * FROM payment_orders WHERE status = 'CREATED' AND created_at <= ? ORDER BY created_at LIMIT 100`).bind(new Date(Date.now() - 2 * 60_000).toISOString()).all<OrderRow>();
  for (const o of results) {
    out.checked++;
    let settled = o.status !== 'CREATED';
    if (!settled && o.gateway === 'razorpay' && o.gateway_order_id && g.gateway === 'razorpay') {
      try {
        const list = await razorpay<{ items: { id: string; status: string; amount: number; method?: string; error_code?: string; error_description?: string }[] }>(env, 'GET', `/orders/${encodeURIComponent(o.gateway_order_id)}/payments`);
        const captured = list.items.find((p) => p.status === 'captured');
        if (captured) {
          const r = await applyPaymentReport(env, o, { gatewayId: captured.id, status: 'CAPTURED', amountPaise: captured.amount, method: captured.method ?? null, reportedBy: 'RECONCILIATION' });
          if (r.result === 'PAID') out.paid++;
          settled = true;
        } else if (list.items.length && list.items.every((p) => p.status === 'failed')) {
          const f = list.items.at(-1)!;
          await applyPaymentReport(env, o, { gatewayId: f.id, status: 'FAILED', amountPaise: f.amount, method: f.method ?? null, errorCode: f.error_code ?? null, errorDescription: f.error_description ?? null, reportedBy: 'RECONCILIATION' });
          out.failed++;
          settled = true;
        }
      } catch {
        out.errors++;
        continue;
      }
    }
    if (!settled) {
      if (Date.now() - new Date(o.created_at).getTime() > 86400_000) {
        await db.prepare(`UPDATE payment_orders SET status = 'EXPIRED', failure_reason = 'No payment was made', updated_at = ? WHERE id = ? AND status = 'CREATED'`).bind(nowIso(), o.id).run();
        out.expired++;
      } else out.stillOpen++;
    }
  }
  return out;
}

/** Daily: tells students whose paid access ends within three days, once per pass, unless they already bought more. */
export async function sendExpiryNotices(env: Bindings, at = new Date()) {
  const now = at.toISOString();
  const soon = new Date(at.getTime() + 3 * 86400_000).toISOString();
  const { results } = await env.DB
    .prepare(
      `SELECT s.id, s.ends_at, u.id AS user_id, u.email, u.display_name, p.name AS plan FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'ACTIVE' AND s.ends_at > ?1 AND s.ends_at <= ?2 AND u.status = 'ACTIVE'
         AND NOT EXISTS (SELECT 1 FROM subscriptions later WHERE later.user_id = s.user_id AND later.status = 'ACTIVE' AND later.ends_at > s.ends_at)
       LIMIT 500`,
    )
    .bind(now, soon)
    .all<{ id: string; ends_at: string; user_id: string; email: string; display_name: string; plan: string }>();
  let sent = 0;
  for (const s of results) {
    const body = plainEmail('Your paid access ends soon', [`Hello ${s.display_name},`, `Your ${s.plan} plan ends on ${dateIn(s.ends_at)}.`, 'Nothing renews by itself and no payment will be taken. If you want to continue, open the Plans page in CUET Prep. New days are added after your current end date.']);
    const r = await sendEmail(env, { to: s.email, userId: s.user_id, kind: 'ACCOUNT_NOTICE', subject: 'Your CUET Prep plan ends soon', dedupeKey: `sub-ending:${s.id}`, ...body });
    if (r.status === 'SENT') sent++;
  }
  return { ending: results.length, sent };
}

// ---------------------------------------------------------------- a student's billing page

export async function billingSummary(env: Bindings, userId: string) {
  const db = env.DB;
  const [access, plans, orders, subs] = await Promise.all([
    currentAccess(db, userId),
    listPlans(db, true),
    db
      .prepare(
        `SELECT o.id, o.amount_paise, o.currency, o.status, o.receipt, o.plan_snapshot_json, o.failure_reason, o.created_at, o.paid_at,
           (SELECT t.method FROM payment_transactions t WHERE t.order_id = o.id AND t.kind = 'PAYMENT' ORDER BY t.updated_at DESC LIMIT 1) AS method
         FROM payment_orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50`,
      )
      .bind(userId)
      .all<{ id: string; amount_paise: number; currency: string; status: string; receipt: string; plan_snapshot_json: string; failure_reason: string | null; created_at: string; paid_at: string | null; method: string | null }>(),
    db.prepare(`SELECT s.id, s.status, s.starts_at, s.ends_at, s.source, p.name AS plan FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? ORDER BY s.starts_at DESC LIMIT 50`).bind(userId).all<{ id: string; status: string; starts_at: string; ends_at: string; source: string; plan: string }>(),
  ]);
  const g = gatewayState(env);
  const now = nowIso();
  return {
    paymentsAvailable: g.ready,
    gateway: g.gateway,
    testMode: g.mode === 'mock' || g.mode === 'test',
    access,
    plans: plans.map((p) => ({ code: p.code, name: p.name, description: p.description, pricePaise: p.pricePaise, currency: p.currency, durationDays: p.durationDays, isFree: p.isFree, limits: p.limits, features: p.features })),
    payments: orders.results.map((o) => ({ id: o.id, plan: (JSON.parse(o.plan_snapshot_json) as { name: string }).name, amountPaise: o.amount_paise, currency: o.currency, status: o.status, reference: o.receipt, method: o.method, failureReason: o.failure_reason, createdAt: o.created_at, paidAt: o.paid_at })),
    passes: subs.results.map((s) => ({ id: s.id, plan: s.plan, startsAt: s.starts_at, endsAt: s.ends_at, source: s.source, state: s.status !== 'ACTIVE' ? s.status : s.ends_at <= now ? 'EXPIRED' : s.starts_at > now ? 'UPCOMING' : 'ACTIVE' })),
  };
}

// ---------------------------------------------------------------- administrators

const page = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) });
export const subscriptionQuery = page.extend({ q: z.string().trim().max(100).optional(), state: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED']).optional() });
export const orderQuery = page.extend({ q: z.string().trim().max(100).optional(), status: z.enum(['CREATED', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED']).optional() });
const PAGE = 25;

export async function billingOverview(env: Bindings) {
  const db = env.DB;
  const now = nowIso();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [active, money, open, events] = await Promise.all([
    db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions WHERE status = 'ACTIVE' AND starts_at <= ? AND ends_at > ?`).bind(now, now).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(amount_paise), 0) AS paise FROM payment_orders WHERE status = 'PAID' AND paid_at >= ?`).bind(since).first<{ orders: number; paise: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS n FROM payment_orders WHERE created_at >= ? GROUP BY status`).bind(since).all<{ status: string; n: number }>(),
    db.prepare(`SELECT result, COUNT(*) AS n FROM payment_events WHERE received_at >= ? GROUP BY result`).bind(since).all<{ result: string; n: number }>(),
  ]);
  return { gateway: gatewayState(env), activeSubscribers: active?.n ?? 0, last30Days: { paidOrders: money?.orders ?? 0, receivedPaise: money?.paise ?? 0, ordersByStatus: open.results, webhookResults: events.results } };
}

export async function listSubscriptions(db: D1Database, f: z.infer<typeof subscriptionQuery>) {
  const now = nowIso();
  const where = ['1 = 1'];
  const params: (string | number)[] = [];
  if (f.q) (where.push("(u.email LIKE '%' || ? || '%' OR u.display_name LIKE '%' || ? || '%')"), params.push(f.q, f.q));
  if (f.state === 'ACTIVE') (where.push("s.status = 'ACTIVE' AND s.ends_at > ?"), params.push(now));
  else if (f.state === 'EXPIRED') (where.push("s.status = 'ACTIVE' AND s.ends_at <= ?"), params.push(now));
  else if (f.state) (where.push('s.status = ?'), params.push(f.state));
  const base = `FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id WHERE ${where.join(' AND ')}`;
  const [total, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...params).first<{ n: number }>(),
    db.prepare(`SELECT s.id, s.status, s.starts_at, s.ends_at, s.source, s.note, s.created_by, s.order_id, u.id AS user_id, u.email, u.display_name, p.name AS plan ${base} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`).bind(...params, PAGE, (f.page - 1) * PAGE).all<Record<string, string | null>>(),
  ]);
  return { total: total?.n ?? 0, pageSize: PAGE, items: rows.results.map((r) => ({ ...r, state: r['status'] !== 'ACTIVE' ? r['status'] : (r['ends_at'] as string) <= now ? 'EXPIRED' : (r['starts_at'] as string) > now ? 'UPCOMING' : 'ACTIVE' })) };
}

export async function listOrders(db: D1Database, f: z.infer<typeof orderQuery>) {
  const where = ['1 = 1'];
  const params: (string | number)[] = [];
  if (f.q) (where.push("(u.email LIKE '%' || ? || '%' OR o.receipt LIKE '%' || ? || '%' OR o.gateway_order_id LIKE '%' || ? || '%')"), params.push(f.q, f.q, f.q));
  if (f.status) (where.push('o.status = ?'), params.push(f.status));
  const base = `FROM payment_orders o JOIN users u ON u.id = o.user_id WHERE ${where.join(' AND ')}`;
  const [total, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...params).first<{ n: number }>(),
    db
      .prepare(
        `SELECT o.id, o.amount_paise, o.currency, o.status, o.gateway, o.gateway_order_id, o.receipt, o.plan_snapshot_json, o.failure_reason, o.created_at, o.paid_at, u.id AS user_id, u.email, u.display_name,
           (SELECT COUNT(*) FROM payment_transactions t WHERE t.order_id = o.id) AS reports ${base} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE, (f.page - 1) * PAGE)
      .all<Record<string, string | number | null>>(),
  ]);
  return { total: total?.n ?? 0, pageSize: PAGE, items: rows.results.map(({ plan_snapshot_json, ...r }) => ({ ...r, plan: (JSON.parse(plan_snapshot_json as string) as { name: string }).name })) };
}

export async function orderDetail(db: D1Database, id: string) {
  const o = await db.prepare('SELECT o.*, u.email, u.display_name FROM payment_orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?').bind(id).first<Record<string, unknown>>();
  if (!o) throw notFound('Order');
  const [tx, ev, sub] = await Promise.all([
    db.prepare('SELECT kind, gateway_id, status, amount_paise, method, error_code, error_description, reported_by, created_at FROM payment_transactions WHERE order_id = ? ORDER BY created_at').bind(id).all(),
    o['gateway_order_id'] ? db.prepare('SELECT type, signature_valid, result, detail, received_at FROM payment_events WHERE gateway_order_id = ? ORDER BY received_at').bind(o['gateway_order_id']).all() : Promise.resolve({ results: [] }),
    db.prepare('SELECT id, status, starts_at, ends_at FROM subscriptions WHERE order_id = ?').bind(id).first(),
  ]);
  return { order: o, reports: tx.results, webhooks: ev.results, pass: sub };
}

export const grantSchema = z.object({ email: z.email().max(200).transform((e) => e.trim().toLowerCase()), planCode: z.string().trim().min(2).max(30), days: z.number().int().min(1).max(1100), note: z.string().trim().min(3).max(300) });

/** Gives paid access without a payment (a scholarship, a correction, a goodwill extension). Always recorded with a reason. */
export async function grantAccess(db: D1Database, input: z.infer<typeof grantSchema>, actor: string) {
  const [user, plan] = await Promise.all([
    db.prepare("SELECT id FROM users WHERE email = ? AND status = 'ACTIVE'").bind(input.email).first<{ id: string }>(),
    db.prepare('SELECT id, name FROM plans WHERE code = ? AND is_free = 0').bind(input.planCode).first<{ id: string; name: string }>(),
  ]);
  if (!user) throw notFound('Active account with this email');
  if (!plan) throw notFound('Paid plan');
  const now = nowIso();
  const last = await db.prepare(`SELECT MAX(ends_at) AS e FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE' AND ends_at > ?`).bind(user.id, now).first<{ e: string | null }>();
  const startsAt = last?.e ?? now;
  const endsAt = new Date(new Date(startsAt).getTime() + input.days * 86400_000).toISOString();
  const id = newId('sub');
  await db.batch([
    db.prepare(`INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at, source, order_id, created_by, note, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'ADMIN_GRANT', NULL, ?, ?, ?, ?)`).bind(id, user.id, plan.id, startsAt, endsAt, actor, input.note, now, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'GRANT_ACCESS', 'SUBSCRIPTION', id, JSON.stringify({ user: user.id, plan: input.planCode, days: input.days, note: input.note }), now),
  ]);
  return { id, startsAt, endsAt, plan: plan.name };
}

export const cancelSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export async function cancelSubscription(db: D1Database, id: string, input: z.infer<typeof cancelSchema>, actor: string) {
  const now = nowIso();
  const out = await db.batch([
    db.prepare(`UPDATE subscriptions SET status = 'CANCELLED', note = COALESCE(note || ' | ', '') || ?, updated_at = ? WHERE id = ? AND status = 'ACTIVE'`).bind(`Cancelled: ${input.reason}`, now, id),
    db.prepare(`INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) SELECT ?, ?, 'CANCEL_ACCESS', 'SUBSCRIPTION', ?, ?, ? WHERE changes() = 1`).bind(newId('aud'), actor, id, JSON.stringify({ reason: input.reason }), now),
  ]);
  if ((out[0]!.meta.changes ?? 0) !== 1) throw conflict('This pass is not active, so there is nothing to cancel');
  return { cancelled: true };
}

export const manualRefundSchema = z.object({ gatewayRefundId: z.string().trim().min(4).max(80), amountPaise: z.number().int().min(1).max(10_000_000) });

/** Records a refund that was made in the gateway's own dashboard, and ends the access the order gave. */
export async function recordManualRefund(db: D1Database, orderId: string, input: z.infer<typeof manualRefundSchema>, actor: string) {
  const o = await db.prepare('SELECT status, amount_paise FROM payment_orders WHERE id = ?').bind(orderId).first<{ status: string; amount_paise: number }>();
  if (!o) throw notFound('Order');
  if (o.status !== 'PAID') throw conflict('Only a paid order can be refunded');
  if (input.amountPaise > o.amount_paise) throw invalid('A refund cannot be larger than the payment');
  return applyRefund(db, orderId, { gatewayId: input.gatewayRefundId, amountPaise: input.amountPaise }, actor);
}
