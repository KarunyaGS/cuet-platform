/** Admin console: plans and prices, paid access, payments. Every change here is logged under the administrator's account. */
import { useState, type FormEvent } from 'react';
import { Badge, Button, Empty, ErrorBox, inputClass, Loading, PageHeader, SearchInput, SectionTitle, Segmented, StatGroup, useLoad } from '../ui';
import { rupees } from '../pages/Plans';
import { consoleApi, when, type AdminOrder, type AdminPlan, type AdminSubscription } from './api';

const label = 'mb-1 block text-sm font-medium text-ink';
const small = `${inputClass} h-9 text-sm`;
const LIMITS: [keyof AdminPlan['limits'], string][] = [['mockTests', 'Mock tests'], ['topicTests', 'Topic tests'], ['practiceSets', 'Practice sets']];
const ORDER_TONE: Record<string, 'green' | 'amber' | 'red' | 'zinc'> = { PAID: 'green', FAILED: 'red', REFUNDED: 'amber', CREATED: 'zinc', EXPIRED: 'zinc' };
const ORDER_LABEL: Record<string, string> = { PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded', CREATED: 'Waiting for payment', EXPIRED: 'Not completed' };
const STATE_TONE: Record<string, 'green' | 'amber' | 'red' | 'zinc' | 'accent'> = { ACTIVE: 'green', UPCOMING: 'accent', EXPIRED: 'zinc', CANCELLED: 'red', REFUNDED: 'amber' };
const STATE_LABEL: Record<string, string> = { ACTIVE: 'Active', UPCOMING: 'Starts later', EXPIRED: 'Ended', CANCELLED: 'Cancelled', REFUNDED: 'Refunded' };
const MODE: Record<string, string> = { off: 'Payments are off', mock: 'Built-in test gateway (local only, no money)', test: 'Razorpay test mode (no money)', live: 'Razorpay LIVE: real money' };

export function AdminBilling() {
  const [tab, setTab] = useState<'plans' | 'access' | 'payments'>('plans');
  const o = useLoad(consoleApi.billing, []);
  return (
    <div>
      <PageHeader title="Plans and payments" subtitle="Prices, plan lengths and limits are set here, not in code. One payment gives a fixed number of days; nothing renews by itself." />
      {o.error && <ErrorBox error={o.error} onRetry={o.reload} />}
      {o.data && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <Badge tone={o.data.gateway.mode === 'live' ? 'red' : o.data.gateway.ready ? 'amber' : 'zinc'}>{MODE[o.data.gateway.mode] ?? o.data.gateway.mode}</Badge>
            {o.data.gateway.reason && <span>{o.data.gateway.reason}.</span>}
          </div>
          <StatGroup
            items={[
              { label: 'Students with paid access', value: o.data.activeSubscribers },
              { label: 'Received, last 30 days', value: rupees(o.data.last30Days.receivedPaise) },
              { label: 'Paid orders, last 30 days', value: o.data.last30Days.paidOrders },
              { label: 'Failed, last 30 days', value: o.data.last30Days.ordersByStatus.find((s) => s.status === 'FAILED')?.n ?? 0 },
            ]}
          />
        </>
      )}
      <div className="mt-6 mb-5">
        <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: 'plans', label: 'Plans and prices' }, { value: 'access', label: 'Paid access' }, { value: 'payments', label: 'Payments' }]} />
      </div>
      {tab === 'plans' && <Plans />}
      {tab === 'access' && <Access onChange={o.reload} />}
      {tab === 'payments' && <Payments onChange={o.reload} />}
    </div>
  );
}

function Plans() {
  const plans = useLoad(consoleApi.plans, []);
  if (plans.loading && !plans.data) return <Loading />;
  if (plans.error) return <ErrorBox error={plans.error} onRetry={plans.reload} />;
  return (
    <div className="space-y-4">
      {plans.data!.map((p) => (
        <PlanForm key={p.id} plan={p} onSaved={plans.reload} />
      ))}
      <p className="text-sm text-ink-2">A price change applies to new orders only. Orders already created keep the amount they were created with.</p>
    </div>
  );
}

function PlanForm({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const [f, setF] = useState({
    name: plan.name, description: plan.description ?? '', price: plan.pricePaise ? String(plan.pricePaise / 100) : '', days: plan.durationDays === null ? '' : String(plan.durationDays), active: plan.active,
    sortOrder: plan.sortOrder, features: plan.features.join('\n'),
    limits: Object.fromEntries(LIMITS.map(([k]) => [k, plan.limits[k] === null || plan.limits[k] === undefined ? '' : String(plan.limits[k])])) as Record<string, string>,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const price = Math.round(Number(f.price || 0) * 100);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      await consoleApi.updatePlan(plan.id, {
        name: f.name.trim(), description: f.description.trim() || null, pricePaise: plan.isFree ? 0 : price, durationDays: plan.isFree ? null : Number(f.days) || null, active: plan.isFree ? true : f.active, sortOrder: f.sortOrder,
        limits: Object.fromEntries(LIMITS.map(([k]) => [k, f.limits[k] === '' ? null : Number(f.limits[k])])),
        features: f.features.split('\n').map((x) => x.trim()).filter(Boolean),
      });
      setSaved(true);
      onSaved();
    } catch (x) {
      setErr(x as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-rule bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
        <Badge>{plan.code}</Badge>
        {plan.isFree ? <Badge tone="accent">Every student without paid access</Badge> : <Badge tone={plan.active ? 'green' : 'zinc'}>{plan.active ? 'On offer' : 'Not on offer'}</Badge>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className={label}>Name</span>
          <input className={small} value={f.name} maxLength={60} required onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        {!plan.isFree && (
          <>
            <label className="block">
              <span className={label}>Price (₹)</span>
              <input className={small} type="number" inputMode="decimal" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </label>
            <label className="block">
              <span className={label}>Length (days)</span>
              <input className={small} type="number" inputMode="numeric" min={1} max={1100} required value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
            </label>
          </>
        )}
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className={label}>Short description</span>
          <input className={small} value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        {LIMITS.map(([k, text]) => (
          <label key={k} className="block">
            <span className={label}>{text} per 30 days</span>
            <input className={small} type="number" inputMode="numeric" min={0} placeholder="No limit" value={f.limits[k]} onChange={(e) => setF({ ...f, limits: { ...f.limits, [k]: e.target.value } })} />
          </label>
        ))}
        {!plan.isFree && (
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className={label}>What students get (one line each)</span>
            <textarea className={`${inputClass} min-h-20 text-sm`} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
          </label>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {!plan.isFree && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-accent" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Offer this plan to students
          </label>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-correct">
            Saved
          </span>
        )}
      </div>
      {err && <ErrorBox error={err} />}
    </form>
  );
}

function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-sm text-ink-2">
      <Button kind="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="num">
        Page {page} of {pages}
      </span>
      <Button kind="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

function Access({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad(() => consoleApi.subscriptions({ q, page }), [q, page]);
  const plans = useLoad(consoleApi.plans, []);
  const [g, setG] = useState({ email: '', planCode: '', days: '30', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [done, setDone] = useState('');
  const paid = (plans.data ?? []).filter((p) => !p.isFree);
  const act = async (f: () => Promise<string>) => {
    setBusy(true);
    setErr(null);
    setDone('');
    try {
      setDone(await f());
      list.reload();
      onChange();
    } catch (x) {
      setErr(x as Error);
    } finally {
      setBusy(false);
    }
  };
  const cancel = (s: AdminSubscription) => {
    const reason = window.prompt(`End ${s.display_name}'s paid access now? Give the reason (it is logged).`);
    if (reason && reason.trim().length >= 3) void act(async () => (await consoleApi.cancelSubscription(s.id, reason.trim()), 'Access ended.'));
  };
  return (
    <div>
      <form
        className="mb-6 rounded-xl border border-rule bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const r = await consoleApi.grantAccess({ email: g.email.trim(), planCode: g.planCode || paid[0]?.code || '', days: Number(g.days), note: g.note.trim() });
            setG({ ...g, email: '', note: '' });
            return `Access given until ${when(r.endsAt)}.`;
          });
        }}
      >
        <h3 className="text-base font-semibold text-ink">Give paid access without a payment</h3>
        <p className="mt-1 text-sm text-ink-2">For a scholarship, a correction or a goodwill extension. The reason is logged under your account.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={label}>Student email</span>
            <input className={small} type="email" required value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />
          </label>
          <label className="block">
            <span className={label}>Plan</span>
            <select className={small} value={g.planCode || paid[0]?.code || ''} onChange={(e) => setG({ ...g, planCode: e.target.value })}>
              {paid.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Days</span>
            <input className={small} type="number" min={1} max={1100} required value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} />
          </label>
          <label className="block">
            <span className={label}>Reason</span>
            <input className={small} required minLength={3} maxLength={300} value={g.note} onChange={(e) => setG({ ...g, note: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={busy || paid.length === 0}>
            Give access
          </Button>
          {done && (
            <span role="status" className="text-sm text-correct">
              {done}
            </span>
          )}
        </div>
        {err && <ErrorBox error={err} />}
      </form>
      <SectionTitle id="acc-list" action={<SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Email or name" label="Search paid access" />}>
        Paid access
      </SectionTitle>
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.items.length === 0 ? (
          <Empty>No paid access yet.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {list.data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{s.display_name}</span>
                  <span className="block break-all text-ink-2">{s.email}</span>
                </span>
                <span className="text-ink-2">
                  {s.plan} · {when(s.starts_at)} to {when(s.ends_at)}
                  {s.source === 'ADMIN_GRANT' ? ` · given by staff${s.note ? `: ${s.note}` : ''}` : ' · paid'}
                </span>
                <Badge tone={STATE_TONE[s.state] ?? 'zinc'}>{STATE_LABEL[s.state] ?? s.state}</Badge>
                {(s.state === 'ACTIVE' || s.state === 'UPCOMING') && (
                  <Button kind="secondary" size="sm" disabled={busy} onClick={() => cancel(s)}>
                    End access
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
      {list.data && <Pager page={page} total={list.data.total} size={list.data.pageSize} onPage={setPage} />}
    </div>
  );
}

function Payments({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad(() => consoleApi.orders({ q, status, page }), [q, status, page]);
  const [open, setOpen] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  const act = async (f: () => Promise<string>) => {
    setBusy(true);
    setErr(null);
    setMsg('');
    try {
      setMsg(await f());
      list.reload();
      onChange();
    } catch (x) {
      setErr(x as Error);
    } finally {
      setBusy(false);
    }
  };
  const check = (o: AdminOrder) =>
    act(async () => {
      const r = await consoleApi.reconcileOrder(o.id);
      return r.paid ? 'The gateway confirms the payment. Access was given.' : r.failed ? 'The gateway reports the payment failed.' : r.expired ? 'No payment was made; the order is closed.' : 'No completed payment found for this order yet.';
    });
  const refund = (o: AdminOrder) => {
    const id = window.prompt('Refund id from the gateway dashboard (the refund must already be made there):');
    if (!id || id.trim().length < 4) return;
    void act(async () => (await consoleApi.recordRefund(o.id, { gatewayRefundId: id.trim(), amountPaise: o.amount_paise }), 'Refund recorded. The access from this payment has ended.'));
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Email or reference" label="Search payments" />
        <select aria-label="Status" className="h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">All payments</option>
          {Object.entries(ORDER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(async () => ((r) => `Checked ${r.checked} waiting order(s): ${r.paid} paid, ${r.expired} closed.`)(await consoleApi.reconcileAll()))}>
          Check waiting orders with the gateway
        </Button>
      </div>
      {msg && (
        <p role="status" className="mb-3 text-sm text-ink-2">
          {msg}
        </p>
      )}
      {err && <ErrorBox error={err} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.items.length === 0 ? (
          <Empty>No payments match.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {list.data.items.map((o) => (
              <li key={o.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {o.plan} · <span className="num">{rupees(o.amount_paise)}</span>
                    </span>
                    <span className="block break-all text-ink-2">
                      {o.email} · {when(o.paid_at ?? o.created_at)}
                    </span>
                  </span>
                  <Badge tone={ORDER_TONE[o.status] ?? 'zinc'}>{ORDER_LABEL[o.status] ?? o.status}</Badge>
                  <Button kind="secondary" size="sm" onClick={() => setOpen(open === o.id ? '' : o.id)}>
                    {open === o.id ? 'Hide details' : 'Details'}
                  </Button>
                  {(o.status === 'CREATED' || o.status === 'FAILED' || o.status === 'EXPIRED') && o.gateway !== 'mock' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => void check(o)}>
                      Check with gateway
                    </Button>
                  )}
                  {o.status === 'PAID' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => refund(o)}>
                      Record a refund
                    </Button>
                  )}
                </div>
                {o.status === 'FAILED' && o.failure_reason && <p className="mt-1 text-ink-2">{o.failure_reason}</p>}
                {open === o.id && <OrderDetail id={o.id} />}
              </li>
            ))}
          </ul>
        ))}
      {list.data && <Pager page={page} total={list.data.total} size={list.data.pageSize} onPage={setPage} />}
    </div>
  );
}

function OrderDetail({ id }: { id: string }) {
  const d = useLoad(() => consoleApi.order(id), [id]);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} />;
  const x = d.data!;
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-paper p-3 text-xs text-ink-2">
      <p className="break-all">
        Reference {String(x.order['receipt'])} · gateway {String(x.order['gateway'])} · gateway order {String(x.order['gateway_order_id'] ?? 'none')}
      </p>
      <p className="font-medium text-ink">What the gateway reported</p>
      {x.reports.length === 0 ? (
        <p>Nothing yet.</p>
      ) : (
        <ul className="space-y-1">
          {x.reports.map((r) => (
            <li key={r.gateway_id} className="break-all">
              {when(r.created_at)}: {r.kind === 'REFUND' ? 'refund' : 'payment'} {r.gateway_id}, {r.status.toLowerCase()}, {rupees(r.amount_paise)}
              {r.method ? `, ${r.method}` : ''}, reported by {r.reported_by.toLowerCase()}
              {r.error_description ? ` (${r.error_description})` : ''}
            </li>
          ))}
        </ul>
      )}
      {x.webhooks.length > 0 && (
        <>
          <p className="font-medium text-ink">Webhooks received</p>
          <ul className="space-y-1">
            {x.webhooks.map((w, i) => (
              <li key={i}>
                {when(w.received_at)}: {w.type}, {w.result.toLowerCase()}
                {w.detail ? ` (${w.detail})` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      {x.pass && (
        <p>
          Access given: {when(x.pass.starts_at)} to {when(x.pass.ends_at)} ({x.pass.status.toLowerCase()})
        </p>
      )}
    </div>
  );
}
