import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { gatewayState, hmacHex, reconcileOrders, sendExpiryNotices, setRazorpayFetchForTests } from '../src/services/billing';
import { setEmailTransportForTests } from '../src/services/email';
import type { Bindings } from '../src/types';

const ADMIN = { 'x-admin-token': 'test-admin-token' };
const mock = env as unknown as Bindings; // wrangler.jsonc (local): PAYMENTS_MODE=mock, APP_ENV=development
const KEY_SECRET = 'test-key-secret';
const HOOK_SECRET = 'test-webhook-secret';
const rzp = { ...env, PAYMENTS_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_abc123', RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: HOOK_SECRET } as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, e: Bindings = mock) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
async function person(role?: string) {
  const email = `bill-${++n}-${Date.now()}@example.test`;
  const password = 'correct-horse-battery';
  const r = await call('POST', '/api/auth/register', { email, password, displayName: 'Bill' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password });
  return { id: r.json.id as string, email, auth: { cookie: s.cookie } };
}
const plan = async (code: string) => (await env.DB.prepare('SELECT * FROM plans WHERE code = ?').bind(code).first<Record<string, unknown>>())!;
const setPlan = (admin: { auth: Record<string, string> }, id: string, over: Record<string, unknown>) =>
  call('PUT', `/api/console/billing/plans/${id}`, { name: '1 month', description: null, pricePaise: 49900, durationDays: 30, active: true, sortOrder: 1, limits: {}, features: ['All mock tests'], ...over }, admin.auth);
const days = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86400_000);

afterEach(() => {
  setRazorpayFetchForTests(null);
  setEmailTransportForTests(null);
});

describe('billing: gateway safety switches', () => {
  it('stays off unless configured, and refuses live keys without approval', () => {
    expect(gatewayState({ ...mock, PAYMENTS_MODE: undefined } as Bindings)).toMatchObject({ mode: 'off', ready: false });
    expect(gatewayState({ ...mock, PAYMENTS_MODE: 'mock', APP_ENV: 'production' } as Bindings).ready).toBe(false);
    expect(gatewayState(rzp)).toMatchObject({ mode: 'test', gateway: 'razorpay', ready: true });
    expect(gatewayState({ ...rzp, RAZORPAY_KEY_ID: 'rzp_live_abc' } as Bindings).ready).toBe(false);
    const live = { ...rzp, PAYMENTS_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_abc' } as Bindings;
    expect(gatewayState(live)).toMatchObject({ ready: false, reason: expect.stringMatching(/not been approved/) });
    expect(gatewayState({ ...live, PAYMENTS_LIVE_APPROVED: 'yes' } as Bindings)).toMatchObject({ mode: 'live', ready: true });
    expect(gatewayState({ ...rzp, RAZORPAY_WEBHOOK_SECRET: undefined } as Bindings).ready).toBe(false);
  });

  it('answers "not available" to an order while payments are off', async () => {
    const s = await person();
    const off = { ...mock, PAYMENTS_MODE: 'off' } as Bindings;
    expect((await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth, off)).json.error.code).toBe('PAYMENTS_OFF');
    expect((await call('GET', '/api/student/billing', undefined, s.auth, off)).json.paymentsAvailable).toBe(false);
  });
});

describe('billing: plans are data', () => {
  it('offers only the free plan until an administrator prices and switches on a paid plan', async () => {
    const admin = await person('SUPER_ADMIN');
    const student = await person();
    const before = await call('GET', '/api/public/plans');
    expect(before.json.plans.map((p: { code: string }) => p.code)).toEqual(['FREE']);
    expect((await call('GET', '/api/console/billing/plans', undefined, student.auth)).status).toBe(403);
    const editor = await person('CONTENT_ADMIN');
    expect((await call('GET', '/api/console/billing/plans', undefined, editor.auth)).status).toBe(403);

    const monthly = await plan('MONTHLY');
    expect((await setPlan(admin, monthly.id as string, { pricePaise: 0 })).status).toBe(422);
    const free = await plan('FREE');
    expect((await setPlan(admin, free.id as string, { pricePaise: 100, durationDays: null })).status).toBe(422);
    expect((await setPlan(admin, monthly.id as string, {})).status).toBe(200);
    const after = await call('GET', '/api/public/plans');
    expect(after.json.plans.find((p: { code: string }) => p.code === 'MONTHLY')).toMatchObject({ pricePaise: 49900, durationDays: 30, features: ['All mock tests'] });
    const log = await env.DB.prepare("SELECT actor, detail_json FROM audit_logs WHERE action = 'UPDATE_PLAN' ORDER BY created_at DESC LIMIT 1").first<{ actor: string; detail_json: string }>();
    expect(log!.actor).toBe(`user:${admin.id}`);
    expect(JSON.parse(log!.detail_json)).toMatchObject({ before: { pricePaise: 0 }, after: { pricePaise: 49900 } });
  });
});

describe('billing: buying a pass (mock gateway)', () => {
  it('gives access once per paid order, keeps the ordered amount, and adds days when bought again', async () => {
    const admin = await person('SUPER_ADMIN');
    const monthly = await plan('MONTHLY');
    await setPlan(admin, monthly.id as string, {});
    const s = await person();
    const sent: string[] = [];
    setEmailTransportForTests(async (_e, m) => (sent.push(m.subject), `m-${sent.length}`));
    const mail = { ...mock, EMAIL_FROM: 'no-reply@send.example.test' } as Bindings;

    const order = await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth);
    expect(order.status).toBe(201);
    expect(order.json).toMatchObject({ gateway: 'mock', amountPaise: 49900, currency: 'INR', keyId: null, status: 'CREATED' });
    // A double click returns the same unpaid order.
    expect((await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth)).json.orderId).toBe(order.json.orderId);
    // The price changes afterwards: the order keeps the amount it was created with.
    await setPlan(admin, monthly.id as string, { pricePaise: 59900 });
    const other = await person();
    expect((await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { outcome: 'success' }, other.auth)).status).toBe(404);

    const paid = await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { outcome: 'success' }, s.auth, mail);
    expect(paid.json.result).toBe('PAID');
    expect(paid.json.access).toMatchObject({ paid: true, plan: { code: 'MONTHLY' } });
    expect(days(paid.json.access.paidUntil)).toBe(30);
    expect(sent).toContain('Payment received for CUET Prep');
    const row = await env.DB.prepare('SELECT status, amount_paise FROM payment_orders WHERE id = ?').bind(order.json.orderId).first();
    expect(row).toEqual({ status: 'PAID', amount_paise: 49900 });
    // A repeated report never gives a second pass.
    expect((await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { outcome: 'success' }, s.auth)).json.result).toBe('ALREADY_PAID');
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?').bind(s.id).first<{ n: number }>())!.n).toBe(1);

    // Buying again adds 30 days after the current end, at the new price.
    const second = await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth);
    expect(second.json.amountPaise).toBe(59900);
    const again = await call('POST', `/api/student/billing/orders/${second.json.orderId}/simulate`, { outcome: 'success' }, s.auth);
    expect(days(again.json.access.paidUntil)).toBe(60);
    const summary = (await call('GET', '/api/student/billing', undefined, s.auth)).json;
    expect(summary.payments.map((p: { status: string; amountPaise: number }) => [p.status, p.amountPaise]).sort()).toEqual([['PAID', 49900], ['PAID', 59900]]);
    expect(summary.passes.map((p: { state: string }) => p.state).sort()).toEqual(['ACTIVE', 'UPCOMING']);
    expect(summary.testMode).toBe(true);
  });

  it('a failed payment gives no access and can be tried again', async () => {
    const admin = await person('SUPER_ADMIN');
    await setPlan(admin, (await plan('MONTHLY')).id as string, {});
    const s = await person();
    const order = await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth);
    const failed = await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { outcome: 'failure' }, s.auth);
    expect(failed.json).toMatchObject({ result: 'FAILED', access: { paid: false, plan: { code: 'FREE' } } });
    const summary = (await call('GET', '/api/student/billing', undefined, s.auth)).json;
    expect(summary.payments[0]).toMatchObject({ status: 'FAILED', failureReason: expect.stringMatching(/declined/) });
    const retry = await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth);
    expect(retry.json.orderId).not.toBe(order.json.orderId);
    expect((await call('POST', `/api/student/billing/orders/${retry.json.orderId}/simulate`, { outcome: 'success' }, s.auth)).json.result).toBe('PAID');
  });

  it('refuses an unknown, free or switched-off plan', async () => {
    const s = await person();
    const admin = await person('SUPER_ADMIN');
    await setPlan(admin, (await plan('MONTHLY')).id as string, { active: false });
    for (const planCode of ['FREE', 'NOPE', 'MONTHLY']) expect((await call('POST', '/api/student/billing/orders', { planCode }, s.auth)).status).toBe(404);
  });
});

describe('billing: plan limits', () => {
  it('stops at the free plan limit and lifts it for a paid student', async () => {
    const admin = await person('SUPER_ADMIN');
    const free = await plan('FREE');
    // A syllabus with one question, so a session can start.
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '901', name: 'Limits', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/limits.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const paper = await env.DB.prepare("SELECT id FROM test_papers WHERE code = '901'").first<{ id: string }>();
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: paper!.id, type: 'MCQ_SINGLE', stem: 'Limits test: two plus two equals which number?', difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: 'Three' }, { label: 'B', text: 'Four' }], answer: { correctOptionPositions: [2] }, explanation: { body: 'Two plus two is four.' }, topicNodeIds: [],
    }, ADMIN);
    expect(q.status, JSON.stringify(q.json).slice(0, 300)).toBe(201);
    const start = (who: { auth: Record<string, string> }, mode = 'PRACTICE') => call('POST', '/api/student/practice', { mode, paperId: paper!.id, count: 1 }, who.auth);
    const s = await person();
    const probe = await start(s);
    if (probe.status !== 201) return expect.soft(probe.status, 'this test needs a question the student can practise').toBe(201);

    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: { practiceSets: 2 }, features: [] }, admin.auth);
    expect((await start(s)).status).toBe(201);
    const blocked = await start(s);
    expect(blocked.status).toBe(402);
    expect(blocked.json.error).toMatchObject({ code: 'PLAN_LIMIT', message: expect.stringMatching(/2 practice sets every 30 days/) });
    expect((await start(s, 'MOCK_TEST')).status).toBe(201); // a different limit, not set
    const access = (await call('GET', '/api/student/billing', undefined, s.auth)).json.access;
    expect(access.limits.find((l: { key: string }) => l.key === 'practiceSets')).toMatchObject({ limit: 2, used: 2 });

    // An administrator gives 7 days of paid access: the paid plan has no limit.
    await setPlan(admin, (await plan('MONTHLY')).id as string, {});
    const grant = await call('POST', '/api/console/billing/subscriptions', { email: s.email, planCode: 'MONTHLY', days: 7, note: 'Scholarship' }, admin.auth);
    expect(grant.status).toBe(201);
    expect((await start(s)).status).toBe(201);
    // Cancelling the pass brings the limit back.
    expect((await call('POST', `/api/console/billing/subscriptions/${grant.json.id}/cancel`, { reason: 'Test over' }, admin.auth)).json).toEqual({ cancelled: true });
    expect((await start(s)).status).toBe(402);
    await call('PUT', `/api/console/billing/plans/${free.id}`, { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: {}, features: [] }, admin.auth);
  });
});

describe('billing: Razorpay (test keys, HTTPS calls replaced)', () => {
  const gatewayOrders: Record<string, unknown>[] = [];
  let payments: Record<string, { id: string; order_id: string; status: string; amount: number; method: string }> = {};
  const fakeRazorpay = () =>
    setRazorpayFetchForTests(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).authorization).toBe(`Basic ${btoa(`rzp_test_abc123:${KEY_SECRET}`)}`);
      if (url.endsWith('/v1/orders') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        gatewayOrders.push(body);
        return Response.json({ id: `order_T${gatewayOrders.length}${Date.now()}` });
      }
      const pay = /\/v1\/payments\/(.+)$/.exec(url);
      if (pay) return payments[pay[1]!] ? Response.json(payments[pay[1]!]) : Response.json({ error: { code: 'BAD_REQUEST_ERROR' } }, { status: 400 });
      const list = /\/v1\/orders\/(.+)\/payments$/.exec(url);
      if (list) return Response.json({ items: Object.values(payments).filter((p) => p.order_id === list[1]) });
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    });
  const hook = async (event: object, opts: { id?: string; secret?: string } = {}) => {
    const raw = JSON.stringify(event);
    return call('POST', '/api/public/payments/webhooks/razorpay', raw, { 'x-razorpay-signature': await hmacHex(opts.secret ?? HOOK_SECRET, raw), 'x-razorpay-event-id': opts.id ?? `evt_${crypto.randomUUID()}` }, rzp);
  };
  const ready = async () => {
    fakeRazorpay();
    payments = {};
    const admin = await person('SUPER_ADMIN');
    await setPlan(admin, (await plan('MONTHLY')).id as string, {});
    const s = await person();
    const order = (await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, s.auth, rzp)).json;
    return { admin, s, order };
  };

  it('creates the gateway order without personal data and confirms checkout only with a valid signature', async () => {
    const { s, order } = await ready();
    expect(order).toMatchObject({ gateway: 'razorpay', keyId: 'rzp_test_abc123', amountPaise: 49900 });
    const sentToGateway = gatewayOrders.at(-1)!;
    expect(sentToGateway).toMatchObject({ amount: 49900, currency: 'INR', receipt: expect.stringMatching(/^cuet_ord_/) });
    expect(JSON.stringify(sentToGateway)).not.toContain(s.email);
    payments['pay_100001'] = { id: 'pay_100001', order_id: order.gatewayOrderId, status: 'captured', amount: 49900, method: 'upi' };
    const bad = await call('POST', `/api/student/billing/orders/${order.orderId}/confirm`, { gatewayPaymentId: 'pay_100001', signature: 'a'.repeat(64) }, s.auth, rzp);
    expect(bad.json.error.code).toBe('BAD_SIGNATURE');
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.access.paid).toBe(false);
    const signature = await hmacHex(KEY_SECRET, `${order.gatewayOrderId}|pay_100001`);
    const good = await call('POST', `/api/student/billing/orders/${order.orderId}/confirm`, { gatewayPaymentId: 'pay_100001', signature }, s.auth, rzp);
    expect(good.json).toMatchObject({ result: 'PAID', access: { paid: true } });
    // The webhook for the same payment arrives afterwards: nothing is added.
    expect((await hook({ event: 'payment.captured', payload: { payment: { entity: payments['pay_100001'] } } })).json).toMatchObject({ result: 'PROCESSED' });
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?').bind(s.id).first<{ n: number }>())!.n).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM payment_transactions WHERE gateway_id = 'pay_100001'").first<{ n: number }>())!.n).toBe(1);
  });

  it('believes a webhook only when its signature matches, and processes each event once', async () => {
    const { s, order } = await ready();
    const entity = { id: 'pay_w00001', order_id: order.gatewayOrderId, status: 'captured', amount: 49900, method: 'card' };
    const forged = await hook({ event: 'payment.captured', payload: { payment: { entity } } }, { secret: 'wrong-secret' });
    expect(forged.status).toBe(401);
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.access.paid).toBe(false);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM payment_events WHERE result = 'REJECTED'").first<{ n: number }>())!.n).toBeGreaterThan(0);

    const first = await hook({ event: 'payment.captured', payload: { payment: { entity } } }, { id: 'evt_same' });
    expect(first.json).toEqual({ received: true, result: 'PROCESSED' });
    expect((await hook({ event: 'payment.captured', payload: { payment: { entity } } }, { id: 'evt_same' })).json.result).toBe('DUPLICATE');
    const summary = (await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json;
    expect(summary.access.paid).toBe(true);
    expect(summary.payments[0]).toMatchObject({ status: 'PAID', method: 'card' });
    expect((await hook({ event: 'invoice.paid', payload: {} })).json.result).toBe('IGNORED');
  });

  it('gives no access when the amount paid differs from the order', async () => {
    const { s, order } = await ready();
    const r = await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_low001', order_id: order.gatewayOrderId, status: 'captured', amount: 100, method: 'upi' } } } });
    expect(r.json).toMatchObject({ result: 'PROCESSED' });
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.access.paid).toBe(false);
    expect(await env.DB.prepare("SELECT status, error_code FROM payment_transactions WHERE gateway_id = 'pay_low001'").first()).toEqual({ status: 'FAILED', error_code: 'AMOUNT_MISMATCH' });
  });

  it('records a failed payment, then a refund ends the access a later payment gave', async () => {
    const { s, order, admin } = await ready();
    await hook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f00001', order_id: order.gatewayOrderId, status: 'failed', amount: 49900, method: 'upi', error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment failed at the bank' } } } });
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.payments[0]).toMatchObject({ status: 'FAILED', failureReason: 'Payment failed at the bank' });
    // The student pays successfully on a second attempt for the same order.
    await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_ok0001', order_id: order.gatewayOrderId, status: 'captured', amount: 49900, method: 'upi' } } } });
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.access.paid).toBe(true);
    const detail = (await call('GET', `/api/console/billing/orders/${order.orderId}`, undefined, admin.auth, rzp)).json;
    expect(detail.reports.map((r: { status: string }) => r.status).sort()).toEqual(['CAPTURED', 'FAILED']);
    expect(detail.webhooks.length).toBe(2);
    await hook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_ok0001', amount: 49900, status: 'processed' } } } });
    const after = (await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json;
    expect(after.access.paid).toBe(false);
    expect(after.payments[0].status).toBe('REFUNDED');
    expect(after.passes[0].state).toBe('REFUNDED');
  });

  it('reconciliation finds a payment that neither the browser nor a webhook reported, and closes stale orders', async () => {
    const { s, order } = await ready();
    payments['pay_lost01'] = { id: 'pay_lost01', order_id: order.gatewayOrderId, status: 'captured', amount: 49900, method: 'netbanking' };
    await env.DB.prepare("UPDATE payment_orders SET created_at = ? WHERE id = ?").bind(new Date(Date.now() - 10 * 60_000).toISOString(), order.orderId).run();
    const stale = await person();
    const old = (await call('POST', '/api/student/billing/orders', { planCode: 'MONTHLY' }, stale.auth, rzp)).json;
    await env.DB.prepare("UPDATE payment_orders SET created_at = ? WHERE id = ?").bind(new Date(Date.now() - 2 * 86400_000).toISOString(), old.orderId).run();
    const r = await reconcileOrders(rzp);
    expect(r).toMatchObject({ paid: 1, expired: 1, errors: 0 });
    expect((await call('GET', '/api/student/billing', undefined, s.auth, rzp)).json.access.paid).toBe(true);
    expect((await env.DB.prepare('SELECT status FROM payment_orders WHERE id = ?').bind(old.orderId).first<{ status: string }>())!.status).toBe('EXPIRED');
    expect((await reconcileOrders(rzp)).paid).toBe(0);
  });
});

describe('billing: expiry notices', () => {
  it('tells a student once that paid access ends within three days', async () => {
    const admin = await person('SUPER_ADMIN');
    await setPlan(admin, (await plan('MONTHLY')).id as string, {});
    const s = await person();
    await call('POST', '/api/console/billing/subscriptions', { email: s.email, planCode: 'MONTHLY', days: 2, note: 'Short pass' }, admin.auth);
    const sent: string[] = [];
    setEmailTransportForTests(async (_e, m) => (sent.push(`${m.to}|${m.subject}`), `x-${sent.length}`));
    const mail = { ...mock, EMAIL_FROM: 'no-reply@send.example.test' } as Bindings;
    await sendExpiryNotices(mail);
    await sendExpiryNotices(mail);
    expect(sent.filter((x) => x === `${s.email}|Your CUET Prep plan ends soon`)).toHaveLength(1);
  });
});
