/** Plans and payments: the student's current plan and usage, plans on offer, buying a pass, and payment history. */
import { BadgeCheck, CircleCheck, FlaskConical, ReceiptText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type Billing, type Checkout } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, useAuth, useLoad } from '../ui';

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const length = (days: number | null) => (days === null ? '' : days % 365 === 0 ? `${days / 365 === 1 ? '12 months' : `${days / 365} years`}` : days % 30 === 0 ? `${days / 30} ${days === 30 ? 'month' : 'months'}` : `${days} days`);
const LIMIT_ONE: Record<string, string> = { mockTests: 'mock test', topicTests: 'topic test', practiceSets: 'practice set' };
const limitWords = (k: string, v: number) => (LIMIT_ONE[k] ? `${LIMIT_ONE[k]}${v === 1 ? '' : 's'}` : k);
const PAY_STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  PAID: { label: 'Paid', tone: 'green' }, CREATED: { label: 'Not completed', tone: 'zinc' }, FAILED: { label: 'Failed', tone: 'red' }, EXPIRED: { label: 'Not completed', tone: 'zinc' }, REFUNDED: { label: 'Refunded', tone: 'amber' },
};
const PASS_STATE: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' | 'accent' }> = {
  ACTIVE: { label: 'Active', tone: 'green' }, UPCOMING: { label: 'Starts later', tone: 'accent' }, EXPIRED: { label: 'Ended', tone: 'zinc' }, CANCELLED: { label: 'Cancelled', tone: 'red' }, REFUNDED: { label: 'Refunded', tone: 'amber' },
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, handler: (r: { error?: { description?: string } }) => void): void };
  }
}

/** Loads the gateway's checkout script once, only when a student actually starts a payment. */
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The payment page could not be loaded. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

export function PlansPage() {
  const { user } = useAuth();
  const b = useLoad(api.billing, [user?.id]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [mock, setMock] = useState<Checkout | null>(null);
  if (b.loading && !b.data) return <Loading />;
  if (b.error) return <ErrorBox error={b.error} onRetry={b.reload} />;
  const d: Billing = b.data!;
  const paidPlans = d.plans.filter((p) => !p.isFree);
  const free = d.plans.find((p) => p.isFree);

  const finish = (result: string) => {
    setMock(null);
    if (result === 'PAID' || result === 'ALREADY_PAID') setNotice({ ok: true, text: 'Payment received. Your paid access is active.' });
    else if (result === 'PENDING') setNotice({ ok: true, text: 'Your payment is being confirmed by the bank. This page updates when it is done; no need to pay again.' });
    else setNotice({ ok: false, text: 'The payment did not go through and no access was given. If money left your account, the bank returns it automatically. You can try again.' });
    b.reload();
  };

  const buy = async (planCode: string) => {
    setBusy(planCode);
    setErr(null);
    setNotice(null);
    try {
      const order = await api.createOrder(planCode);
      if (order.gateway === 'mock') return setMock(order);
      await loadRazorpay();
      const rz = new window.Razorpay!({
        key: order.keyId,
        order_id: order.gatewayOrderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'CUET Prep',
        description: `${order.planName} plan`,
        prefill: { email: user?.email },
        handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
          api.confirmOrder(order.orderId, { gatewayPaymentId: r.razorpay_payment_id, signature: r.razorpay_signature }).then(
            (x) => finish(x.result),
            (e: Error) => {
              setErr(e);
              b.reload();
            },
          );
        },
        modal: { ondismiss: () => b.reload() },
      });
      rz.on('payment.failed', () => finish('FAILED'));
      rz.open();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Plans and payments" subtitle="One payment gives access for a fixed time. Nothing renews by itself and no further payment is taken." />
      {d.testMode && d.paymentsAvailable && (
        <p className="mb-5 flex items-start gap-2 rounded-lg border border-marker/30 bg-marker-soft px-3.5 py-2.5 text-sm text-marker">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
          Test mode: payments here are practice runs. No money is taken.
        </p>
      )}
      {notice && (
        <p role="status" className={`mb-5 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${notice.ok ? 'border-correct/30 bg-correct-soft text-correct' : 'border-wrong/25 bg-wrong-soft text-wrong'}`}>
          {notice.ok && <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />}
          {notice.text}
        </p>
      )}
      {err && <ErrorBox error={err} />}

      <section aria-labelledby="pl-current" className="rounded-xl border border-rule bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pl-current" className="text-base font-semibold text-ink">
            Your plan: {d.access.plan.name}
          </h2>
          {d.access.paid && d.access.paidUntil ? <Badge tone="green">Paid until {date(d.access.paidUntil)}</Badge> : <Badge>Free</Badge>}
        </div>
        {d.access.limits.some((l) => l.limit !== null) ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {d.access.limits
              .filter((l) => l.limit !== null)
              .map((l) => (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-2 first-letter:uppercase">{l.label}</span>
                    <span className="num font-medium text-ink">
                      {Math.min(l.used, l.limit!)} of {l.limit}
                    </span>
                  </div>
                  <Meter value={l.limit ? (100 * l.used) / l.limit : 100} tone={l.used >= l.limit! ? 'wrong' : 'accent'} label={`${l.label} used in the last ${d.access.usageDays} days`} />
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">{d.access.paid ? 'Your plan has no limits on tests or practice.' : 'There are no limits on tests or practice at the moment.'}</p>
        )}
        {d.access.limits.some((l) => l.limit !== null) && <p className="mt-3 text-xs text-ink-3">Counted over the last {d.access.usageDays} days.</p>}
      </section>

      <section aria-labelledby="pl-plans" className="mt-8">
        <SectionTitle id="pl-plans">Plans</SectionTitle>
        {paidPlans.length === 0 ? (
          <Empty>Paid plans are not on offer yet. Everything that is open today stays open on the free plan.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paidPlans.map((p) => (
              <li key={p.code} className="flex flex-col rounded-xl border border-rule bg-surface p-5">
                <h3 className="text-base font-semibold text-ink">{p.name}</h3>
                <p className="mt-2">
                  <span className="num text-2xl font-semibold text-ink">{rupees(p.pricePaise)}</span>{' '}
                  <span className="text-sm text-ink-2">for {length(p.durationDays)}</span>
                </p>
                {p.description && <p className="mt-2 text-sm text-ink-2">{p.description}</p>}
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                  {Object.entries(p.limits)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => (
                      <li key={k} className="flex items-start gap-2 text-ink-2">
                        <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                        {v} {limitWords(k, v as number)} every 30 days
                      </li>
                    ))}
                </ul>
                <div className="mt-4">
                  {d.paymentsAvailable ? (
                    <Button onClick={() => void buy(p.code)} disabled={busy !== ''}>
                      {busy === p.code ? 'Opening payment…' : d.access.paid ? `Add ${length(p.durationDays)}` : `Pay ${rupees(p.pricePaise)}`}
                    </Button>
                  ) : (
                    <p className="text-sm text-ink-2">Online payment is not available yet.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {free && paidPlans.length > 0 && Object.values(free.limits).some((v) => v !== null && v !== undefined) && (
          <p className="mt-3 text-sm text-ink-2">
            The free plan includes{' '}
            {Object.entries(free.limits)
              .filter(([, v]) => v !== null && v !== undefined)
              .map(([k, v]) => `${v} ${limitWords(k, v as number)}`)
              .join(', ')}{' '}
            every 30 days.
          </p>
        )}
        {d.access.paid && paidPlans.length > 0 && <p className="mt-3 text-sm text-ink-2">If you buy again, the new days start when your current access ends. You do not lose any days.</p>}
      </section>

      <section aria-labelledby="pl-passes" className="mt-8">
        <SectionTitle id="pl-passes">Your access</SectionTitle>
        {d.passes.length === 0 ? (
          <Empty>You have not had paid access yet.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {d.passes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium text-ink">{p.plan}</span>
                <span className="text-ink-2">
                  {date(p.startsAt)} to {date(p.endsAt)}
                  {p.source === 'ADMIN_GRANT' ? ' · given by the CUET Prep team' : ''}
                </span>
                <Badge tone={PASS_STATE[p.state]?.tone ?? 'zinc'}>{PASS_STATE[p.state]?.label ?? p.state}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pl-history" className="mt-8">
        <SectionTitle id="pl-history">Payment history</SectionTitle>
        {d.payments.length === 0 ? (
          <Empty icon={<ReceiptText />}>No payments yet.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {d.payments.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-ink">
                    {p.plan} · <span className="num">{rupees(p.amountPaise)}</span>
                  </span>
                  <span className="text-ink-2">
                    {date(p.paidAt ?? p.createdAt)}
                    {p.method ? ` · ${p.method.toUpperCase()}` : ''}
                  </span>
                  <Badge tone={PAY_STATUS[p.status]?.tone ?? 'zinc'}>{PAY_STATUS[p.status]?.label ?? p.status}</Badge>
                </div>
                {p.status === 'FAILED' && p.failureReason && <p className="mt-1 text-ink-2">{p.failureReason}</p>}
                <p className="mt-1 break-all text-xs text-ink-3">Reference {p.reference}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mock && <MockPayment order={mock} onDone={finish} onClose={() => (setMock(null), b.reload())} onError={setErr} />}
    </div>
  );
}

/** Local development only: stands in for the gateway's payment page, so the whole flow can be tried without real money. */
function MockPayment({ order, onDone, onClose, onError }: { order: Checkout; onDone: (result: string) => void; onClose: () => void; onError: (e: Error) => void }) {
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const go = async (outcome: 'success' | 'failure') => {
    setBusy(true);
    try {
      onDone((await api.simulatePayment(order.orderId, outcome)).result);
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error('Could not reach CUET Prep. Check your connection and try again.'));
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="mock-title">
      <div className="w-full max-w-sm rounded-xl border border-rule bg-surface p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="mock-title" className="text-base font-semibold text-ink">
            Test payment
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-2 hover:bg-ink/5">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {order.planName} plan, <span className="num font-medium text-ink">{rupees(order.amountPaise)}</span>. This is the built-in test gateway: no money is taken. Choose how the payment should end.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button ref={first} type="button" disabled={busy} onClick={() => void go('success')} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">
            Payment succeeds
          </button>
          <Button kind="secondary" disabled={busy} onClick={() => void go('failure')}>
            Payment fails
          </Button>
        </div>
      </div>
    </div>
  );
}
