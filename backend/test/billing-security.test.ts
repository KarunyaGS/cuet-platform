import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { hmacHex, setRazorpayFetchForTests } from '../src/services/billing';
import type { Bindings } from '../src/types';

// Payment security tests from the 16 Nov 2026 audit. The Razorpay HTTPS calls are replaced; no real gateway, key or money is involved.
const ADMIN = { 'x-admin-token': 'test-admin-token' };
const mock = env as unknown as Bindings;
const KEY_SECRET = 'test-key-secret';
const HOOK_SECRET = 'test-webhook-secret';
const rzp = { ...env, PAYMENTS_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_abc123', RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: HOOK_SECRET } as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = mock) {
  // Plan changes are made with the content preview off: a paid plan cannot be switched on while students see unreviewed content.
  if (method !== 'GET' && /\/api\/console\/billing\/plans/.test(path) && !(e as unknown as Record<string, string>).KEEP_PREVIEW) e = { ...e, CONTENT_PREVIEW: 'false' } as Bindings;
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
async function person(role?: string) {
  const email = `bsec-${++n}-${Date.now()}@example.test`;
  const password = 'correct-horse-battery';
  const r = await call('POST', '/api/auth/register', { email, password, displayName: 'Bsec' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password });
  return { id: r.json.id as string, email, auth: { cookie: s.cookie } };
}
const plan = async (code: string) => (await env.DB.prepare('SELECT * FROM plans WHERE code = ?').bind(code).first<Record<string, unknown>>())!;
const setPlan = (admin: { auth: Record<string, string> }, id: string, over: Record<string, unknown>) =>
  call('PUT', `/api/console/billing/plans/${id}`, { name: '1 month', description: null, pricePaise: 49900, durationDays: 30, active: true, sortOrder: 1, limits: {}, features: ['All mock tests'], ...over }, admin.auth);
const access = async (who: { auth: Record<string, string> }, e: Bindings = mock) => (await call('GET', '/api/student/billing', undefined, who.auth, e)).json;

let gatewayOrders = 0;
let payments: Record<string, { id: string; order_id: string; status: string; amount: number; method: string }> = {};
const fake = () =>
  setRazorpayFetchForTests(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v1/orders') && init?.method === 'POST') return Response.json({ id: `order_S${++gatewayOrders}${Date.now()}` });
    const pay = /\/v1\/payments\/(.+)$/.exec(url);
    if (pay) return payments[pay[1]!] ? Response.json(payments[pay[1]!]) : Response.json({ error: { code: 'BAD_REQUEST_ERROR' } }, { status: 400 });
    const list = /\/v1\/orders\/(.+)\/payments$/.exec(url);
    if (list) return Response.json({ items: Object.values(payments).filter((p) => p.order_id === list[1]) });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
const hook = async (event: object, opts: { id?: string; secret?: string; signature?: string | null } = {}) => {
  const raw = JSON.stringify(event);
  const headers: Record<string, string> = { 'x-razorpay-event-id': opts.id ?? `evt_${crypto.randomUUID()}` };
  if (opts.signature !== null) headers['x-razorpay-signature'] = opts.signature ?? (await hmacHex(opts.secret ?? HOOK_SECRET, raw));
  return call('POST', '/api/public/payments/webhooks/razorpay', raw, headers, rzp);
};
const order = async (who: { auth: Record<string, string> }, body: Record<string, unknown> = { planCode: 'MONTHLY' }) => (await call('POST', '/api/student/billing/orders', body, who.auth, rzp)).json;
const priced = async () => {
  fake();
  payments = {};
  const admin = await person('SUPER_ADMIN');
  await setPlan(admin, (await plan('MONTHLY')).id as string, {});
  return admin;
};
const captured = (id: string, orderId: string, amount = 49900) => ({ id, order_id: orderId, status: 'captured', amount, method: 'upi' });

afterEach(() => setRazorpayFetchForTests(null));

describe('payment security: who may do what', () => {
  it('needs a sign-in to buy, and keeps one student out of another student\'s orders', async () => {
    await priced();
    expect((await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, {}, rzp)).status).toBe(401);
    const a = await person();
    const b = await person();
    const o = await order(a);
    payments['pay_a00001'] = captured('pay_a00001', o.gatewayOrderId);
    const sig = await hmacHex(KEY_SECRET, `${o.gatewayOrderId}|pay_a00001`);
    // B presents A's genuine payment and signature for A's order: no such order for B.
    expect((await call('POST', `/api/student/billing/orders/${o.orderId}/confirm`, { gatewayPaymentId: 'pay_a00001', signature: sig }, b.auth, rzp)).status).toBe(404);
    expect((await access(b, rzp)).access.paid).toBe(false);
    expect((await access(b, rzp)).payments).toHaveLength(0);
    expect((await access(a, rzp)).payments).toHaveLength(1);
  });

  it('keeps every billing screen of staff behind the billing permission', async () => {
    await priced();
    const student = await person();
    const reviewer = await person('REVIEWER');
    const routes: [string, string, unknown?][] = [
      ['GET', '/api/console/billing'], ['GET', '/api/console/billing/plans'], ['GET', '/api/console/billing/subscriptions'], ['GET', '/api/console/billing/orders'],
      ['POST', '/api/console/billing/subscriptions', { email: 'x@example.test', planCode: 'MONTHLY', days: 5, note: 'nope' }],
      ['POST', '/api/console/billing/reconcile', {}],
    ];
    for (const who of [student, reviewer]) {
      for (const [m, p, b] of routes) expect((await call(m, p, b, who.auth, rzp)).status, `${m} ${p}`).toBe(403);
    }
    for (const [m, p, b] of routes) expect((await call(m, p, b, {}, rzp)).status, `${m} ${p} signed out`).toBe(401);
  });

  it('refuses a webhook with no signature, a wrong one, or while the gateway is the mock one', async () => {
    const admin = await priced();
    const s = await person();
    const o = await order(s);
    const event = { event: 'payment.captured', payload: { payment: { entity: captured('pay_ns0001', o.gatewayOrderId) } } };
    expect((await hook(event, { signature: null })).status).toBe(401);
    expect((await hook(event, { signature: 'f'.repeat(64) })).status).toBe(401);
    expect((await access(s, rzp)).access.paid).toBe(false);
    // In mock mode there is no Razorpay webhook at all.
    const raw = JSON.stringify(event);
    expect((await call('POST', '/api/public/payments/webhooks/razorpay', raw, { 'x-razorpay-signature': await hmacHex(HOOK_SECRET, raw) }, mock)).status).toBe(404);
    expect((await call('POST', '/api/student/billing/orders/ord_none/simulate', { outcome: 'success' }, s.auth, rzp)).status).toBe(404);
    expect(admin.id).toBeTruthy();
  });

  it('cannot be pushed into "live" or "mock" mode by a request: only configuration decides', async () => {
    await priced();
    const s = await person();
    const prodMock = { ...mock, APP_ENV: 'production' } as Bindings;
    const o = (await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY', mode: 'mock', gateway: 'mock' }, s.auth, rzp)).json;
    expect(o.gateway).toBe('razorpay');
    expect((await call('POST', `/api/student/billing/orders/${o.orderId}/simulate`, { outcome: 'success', gateway: 'mock' }, s.auth, prodMock)).status).toBe(404);
    expect((await access(s, rzp)).access.paid).toBe(false);
  });
});

describe('payment security: the browser is never trusted', () => {
  it('ignores an amount or plan details sent by the browser, and gives nothing for a paid-looking confirmation without the gateway\'s own record', async () => {
    await priced();
    const s = await person();
    const o = await order(s, { planCode: 'MONTHLY', amountPaise: 100, pricePaise: 1, durationDays: 3650 } as Record<string, unknown>);
    expect(o.amountPaise).toBe(49900);
    // A made-up payment id, with a correctly computed signature (an attacker who knows nothing of the secret cannot, but even so the gateway has no such payment).
    const sig = await hmacHex(KEY_SECRET, `${o.gatewayOrderId}|pay_madeup1`);
    const r = await call('POST', `/api/student/billing/orders/${o.orderId}/confirm`, { gatewayPaymentId: 'pay_madeup1', signature: sig }, s.auth, rzp);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await access(s, rzp)).access.paid).toBe(false);
  });

  it('refuses a genuine payment that belongs to a different order', async () => {
    await priced();
    const s = await person();
    const first = await order(s);
    payments['pay_o1_001'] = captured('pay_o1_001', first.gatewayOrderId);
    await env.DB.prepare("UPDATE payment_orders SET status = 'FAILED' WHERE id = ?").bind(first.orderId).run();
    const second = await order(s);
    expect(second.orderId).not.toBe(first.orderId);
    const sig = await hmacHex(KEY_SECRET, `${second.gatewayOrderId}|pay_o1_001`);
    const r = await call('POST', `/api/student/billing/orders/${second.orderId}/confirm`, { gatewayPaymentId: 'pay_o1_001', signature: sig }, s.auth, rzp);
    expect(r.status).toBe(400);
    expect((await access(s, rzp)).access.paid).toBe(false);
  });

  it('one payment cannot buy two passes', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    const e = { event: 'payment.captured', payload: { payment: { entity: captured('pay_once01', o.gatewayOrderId) } } };
    await hook(e);
    await hook(e); // delivered again with a different event id
    await hook({ event: 'order.paid', payload: { payment: { entity: captured('pay_once01', o.gatewayOrderId) }, order: { entity: { id: o.gatewayOrderId } } } });
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?').bind(s.id).first<{ n: number }>())!.n).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM payment_transactions WHERE gateway_id = 'pay_once01'").first<{ n: number }>())!.n).toBe(1);
  });
});

describe('payment security: late and out-of-order events', () => {
  it('a "failed" report that arrives after the payment was captured does not take the access away', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_late01', o.gatewayOrderId) } } });
    await hook({ event: 'payment.failed', payload: { payment: { entity: { ...captured('pay_late01', o.gatewayOrderId), status: 'failed', error_description: 'late and wrong' } } } });
    const b = await access(s, rzp);
    expect(b.access.paid).toBe(true);
    expect(b.payments[0].status).toBe('PAID');
  });

  it('a payment captured after the order was closed as expired still gives the access, once', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    await env.DB.prepare("UPDATE payment_orders SET status = 'EXPIRED' WHERE id = ?").bind(o.orderId).run();
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_exp001', o.gatewayOrderId) } } });
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_exp001', o.gatewayOrderId) } } });
    expect((await access(s, rzp)).access.paid).toBe(true);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?').bind(s.id).first<{ n: number }>())!.n).toBe(1);
  });

  it('a refund event that arrives before the payment event does not break anything, and the payment is then still recorded', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    const early = await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_early', payment_id: 'pay_unknownyet', amount: 49900, status: 'processed' } } } });
    expect(early.json.result).toBe('IGNORED');
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_unknownyet', o.gatewayOrderId) } } });
    expect((await access(s, rzp)).access.paid).toBe(true);
  });
});

describe('payment security: usage and expiry', () => {
  it('a pass that ends in the middle of a test does not stop that test, and no new limited test can start after it', async () => {
    const admin = await priced();
    const free = await plan('FREE');
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '902', name: 'Expiry', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/expiry.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const paper = await env.DB.prepare("SELECT id FROM test_papers WHERE code = '902'").first<{ id: string }>();
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: paper!.id, type: 'MCQ_SINGLE', stem: 'Expiry test: three plus three equals which number?', difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: 'Five' }, { label: 'B', text: 'Six' }, { label: 'C', text: 'Seven' }, { label: 'D', text: 'Eight' }], answer: { correctOptionPositions: [1] }, explanation: { body: 'Three plus three is six.' }, topicNodeIds: [],
    }, ADMIN);
    expect(q.status).toBe(201);
    const s = await person();
    const start = () => call('POST', '/api/student/practice', { mode: 'PRACTICE', paperId: paper!.id, count: 1 }, s.auth);
    const probe = await start();
    if (probe.status !== 201) return expect.soft(probe.status, 'needs a question the student can practise').toBe(201);
    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: { practiceSets: 1 }, features: [] }, admin.auth);
    // Free limit (1) is already used by the probe. A paid pass lifts it.
    const grant = await call('POST', '/api/console/billing/subscriptions', { email: s.email, planCode: 'MONTHLY', days: 1, note: 'Expiry test' }, admin.auth);
    expect(grant.status).toBe(201);
    const live = await start();
    expect(live.status).toBe(201);
    const sid = live.json.session?.id ?? live.json.id;
    // The pass ends while the test is open.
    await env.DB.prepare("UPDATE subscriptions SET ends_at = ? WHERE id = ?").bind(new Date(Date.now() - 60_000).toISOString(), grant.json.id).run();
    expect((await access(s)).access.paid).toBe(false);
    const get = await call('GET', `/api/student/practice/${sid}`, undefined, s.auth);
    expect(get.status).toBe(200);
    const submit = await call('POST', `/api/student/practice/${sid}/submit`, {}, s.auth);
    expect(submit.status, JSON.stringify(submit.json).slice(0, 200)).toBe(200);
    // A new limited test is refused.
    const after = await start();
    expect(after.status).toBe(402);
    expect(after.json.error.code).toBe('PLAN_LIMIT');
    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: {}, features: [] }, admin.auth);
  });
});

describe('payment audit: refund rules approved on 16 Nov 2026, and behaviour still to change', () => {
  it('APPROVED RULE: refunding the first of two stacked passes moves the second up, so there is no gap', async () => {
    await priced();
    const s = await person();
    const a = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_stk_a1', a.gatewayOrderId) } } });
    const b = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_stk_b1', b.gatewayOrderId) } } });
    expect((await access(s, rzp)).passes.map((p: { state: string }) => p.state).sort()).toEqual(['ACTIVE', 'UPCOMING']);
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_stk1', payment_id: 'pay_stk_a1', amount: 49900, status: 'processed' } } } });
    const r = await access(s, rzp);
    expect(r.access.paid).toBe(true);
    expect(r.passes.map((p: { state: string }) => p.state).sort()).toEqual(['ACTIVE', 'REFUNDED']);
    // The second pass keeps its full 30 days, starting now.
    const sub = await env.DB.prepare(`SELECT starts_at, ends_at FROM subscriptions WHERE status = 'ACTIVE' AND user_id = (SELECT user_id FROM payment_orders WHERE id = ?)`).bind(b.orderId).first<{ starts_at: string; ends_at: string }>();
    expect(Math.round((Date.parse(sub!.ends_at) - Date.parse(sub!.starts_at)) / 86400000)).toBe(30);
    expect(Date.parse(sub!.starts_at)).toBeLessThan(Date.now() + 60_000);
  });

  it('APPROVED RULE: a partial refund shortens the pass in proportion, and the order stays paid', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_part01', o.gatewayOrderId) } } });
    const day = async () => (await env.DB.prepare('SELECT starts_at, ends_at FROM subscriptions WHERE order_id = ?').bind(o.orderId).first<{ starts_at: string; ends_at: string }>())!;
    const days = async () => { const d = await day(); return (Date.parse(d.ends_at) - Date.parse(d.starts_at)) / 86400000; };
    expect(Math.round(await days())).toBe(30);
    // 10 000 of 49 900 paise refunded: about 20% of 30 days = 6 days lost.
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_part', payment_id: 'pay_part01', amount: 10000, status: 'processed' } } } });
    expect((await access(s, rzp)).access.paid).toBe(true);
    expect(Math.round(await days())).toBe(24);
    expect((await env.DB.prepare('SELECT status FROM payment_orders WHERE id = ?').bind(o.orderId).first<{ status: string }>())!.status).toBe('PAID');
    // The same refund event again changes nothing; a second refund adds up (total 20 000 = about 40%: 18 days left).
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_part', payment_id: 'pay_part01', amount: 10000, status: 'processed' } } } });
    expect(Math.round(await days())).toBe(24);
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_part2', payment_id: 'pay_part01', amount: 10000, status: 'processed' } } } });
    expect(Math.round(await days())).toBe(18);
    // The rest of the price refunded: the pass is revoked.
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_part3', payment_id: 'pay_part01', amount: 29900, status: 'processed' } } } });
    expect((await access(s, rzp)).access.paid).toBe(false);
    expect((await env.DB.prepare('SELECT status FROM payment_orders WHERE id = ?').bind(o.orderId).first<{ status: string }>())!.status).toBe('REFUNDED');
  });

  it('APPROVED RULE: refunding a duplicate payment leaves the valid pass alone', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_dup_1', o.gatewayOrderId) } } });
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_dup_2', o.gatewayOrderId) } } });
    const before = await env.DB.prepare('SELECT starts_at, ends_at, status FROM subscriptions WHERE order_id = ?').bind(o.orderId).first();
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_dup', payment_id: 'pay_dup_2', amount: 49900, status: 'processed' } } } });
    expect(await env.DB.prepare('SELECT starts_at, ends_at, status FROM subscriptions WHERE order_id = ?').bind(o.orderId).first()).toEqual(before);
    expect((await access(s, rzp)).access.paid).toBe(true);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'DUPLICATE_PAYMENT_REFUNDED' AND entity_id = ?`).bind(o.orderId).first<{ n: number }>())!.n).toBe(1);
  });

  it('KNOWN LIMITATION: an amount mismatch is recorded but only a log line tells staff', async () => {
    await priced();
    const admin = await person('SUPER_ADMIN');
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_mm0001', o.gatewayOrderId, 100) } } });
    const detail = (await call('GET', `/api/console/billing/orders/${o.orderId}`, undefined, admin.auth, rzp)).json;
    expect(detail.reports.some((r: { error_code: string | null }) => r.error_code === 'AMOUNT_MISMATCH')).toBe(true);
    expect((await access(s, rzp)).access.paid).toBe(false);
  });
});

describe('payment audit: fixes made in the sprint', () => {
  it('a wrong-amount payment is listed for staff on the billing overview, until the order is paid', async () => {
    await priced();
    const admin = await person('SUPER_ADMIN');
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_mm0002', o.gatewayOrderId, 100) } } });
    const ov = (await call('GET', '/api/console/billing', undefined, admin.auth, rzp)).json;
    expect(ov.needsAttention.find((m: { gatewayPaymentId: string }) => m.gatewayPaymentId === 'pay_mm0002')).toMatchObject({ expectedPaise: 49900, paidPaise: 100 });
    // the right payment arrives later: the order is paid and leaves the list
    await hook({ event: 'payment.captured', payload: { payment: { entity: captured('pay_mm0003', o.gatewayOrderId) } } });
    const after = (await call('GET', '/api/console/billing', undefined, admin.auth, rzp)).json;
    expect(after.needsAttention.some((m: { gatewayPaymentId: string }) => m.gatewayPaymentId === 'pay_mm0002')).toBe(false);
  });

  it('reconciliation also recovers a payment that was captured on an order already marked failed', async () => {
    await priced();
    const s = await person();
    const o = await order(s);
    await hook({ event: 'payment.failed', payload: { payment: { entity: { ...captured('pay_try001', o.gatewayOrderId), status: 'failed', error_description: 'bank declined' } } } });
    expect((await access(s, rzp)).payments[0].status).toBe('FAILED');
    // the student's second attempt succeeded at the gateway, but neither the browser nor a webhook told us
    payments['pay_try002'] = captured('pay_try002', o.gatewayOrderId);
    const { reconcileOrders } = await import('../src/services/billing');
    expect((await reconcileOrders(rzp)).paid).toBeGreaterThanOrEqual(1);
    expect((await access(s, rzp)).access.paid).toBe(true);
    // a failed order the gateway knows nothing more about stays failed, and is not counted as failed again
    const t = await person();
    const o2 = await order(t);
    await hook({ event: 'payment.failed', payload: { payment: { entity: { ...captured('pay_try003', o2.gatewayOrderId), status: 'failed' } } } });
    const r2 = await reconcileOrders(rzp);
    expect(r2.failed).toBe(0);
    expect((await access(t, rzp)).payments[0].status).toBe('FAILED');
  });
});

describe('approved decisions, 16 Nov 2026: totals, roles and launch guard', () => {
  it('bookmark and revision-card totals stop at the plan limit; what the student already holds is never removed', async () => {
    const admin = await person('SUPER_ADMIN');
    const free = await plan('FREE');
    const s = await person();
    const topics = (await env.DB.prepare('SELECT id FROM curriculum_nodes LIMIT 3').all<{ id: string }>()).results;
    if (topics.length < 3) return;
    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: { bookmarks: 2 }, features: [] }, admin.auth);
    const add = (id: string) => call('POST', '/api/student/bookmarks', { kind: 'TOPIC', entityId: id }, s.auth);
    expect((await add(topics[0]!.id)).status).toBe(200);
    expect((await add(topics[0]!.id)).status).toBe(200); // the same one again is not a new item
    expect((await add(topics[1]!.id)).status).toBe(200);
    const over = await add(topics[2]!.id);
    expect(over.status).toBe(402);
    expect(over.json.error.code).toBe('PLAN_LIMIT');
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?').bind(s.id).first<{ n: number }>())!.n).toBe(2);
    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: {}, features: [] }, admin.auth);
  });

  it('a content editor cannot read the email log or the reviewer assignments; an administrator can', async () => {
    const editor = await person('CONTENT_ADMIN');
    const admin = await person('SUPER_ADMIN');
    expect((await call('GET', '/api/console/email', undefined, editor.auth)).status).toBe(403);
    expect((await call('GET', '/api/console/assignments', undefined, editor.auth)).status).toBe(403);
    expect((await call('GET', '/api/console/email', undefined, admin.auth)).status).toBe(200);
    expect((await call('GET', '/api/console/assignments', undefined, admin.auth)).status).toBe(200);
  });

  it('a paid plan cannot be switched on while students see unreviewed content (preview on)', async () => {
    const admin = await person('SUPER_ADMIN');
    const monthly = await plan('MONTHLY');
    const on = { ...env, CONTENT_PREVIEW: 'true', KEEP_PREVIEW: '1' } as unknown as Bindings;
    const body = { name: '1 month', description: null, pricePaise: 14900, durationDays: 30, active: true, sortOrder: 1, limits: {}, features: [] };
    const blocked = await call('PUT', `/api/console/billing/plans/${monthly.id}`, body, admin.auth, on);
    expect(blocked.status).toBe(409);
    expect(blocked.json.error.code).toBe('PAID_LAUNCH_BLOCKED');
    expect((await call('PUT', `/api/console/billing/plans/${monthly.id}`, { ...body, active: false }, admin.auth, on)).status).toBe(200);
  });
});
