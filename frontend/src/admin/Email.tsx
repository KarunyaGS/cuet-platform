/** Admin console: email health. Shows what was sent in the last 7 days, failures and blocked addresses. No message text is stored or shown. */
import { MailWarning } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, SectionTitle, StatGroup, useLoad } from '../ui';
import { consoleApi, when } from './api';

const KIND: Record<string, string> = { PASSWORD_RESET: 'Password reset', VERIFY_EMAIL: 'Confirm email', ACCOUNT_NOTICE: 'Account notice', STUDY_REMINDER: 'Study reminder', WELCOME: 'Welcome', EXAM_REMINDER: 'Exam countdown', REVISION_REMINDER: 'Revision reminder', NOTICE_ALERT: 'Notice alert' };
const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  SENT: { label: 'Sent', tone: 'green' },
  DELIVERED: { label: 'Delivered', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
  BOUNCED: { label: 'Bounced', tone: 'red' },
  COMPLAINED: { label: 'Marked as spam', tone: 'red' },
  SUPPRESSED: { label: 'Not sent: address blocked', tone: 'amber' },
  NOT_CONFIGURED: { label: 'Not sent: email is off', tone: 'zinc' },
  QUEUED: { label: 'Queued', tone: 'zinc' },
};
const REASON: Record<string, string> = { HARD_BOUNCE: 'Address does not exist', COMPLAINT: 'Marked as spam', MANUAL: 'Blocked by an administrator' };
const PROVIDER: Record<string, string> = { cloudflare: 'Cloudflare Email Sending', resend: 'Resend (standby)' };

const TEMPLATE_LABEL: Record<string, string> = {
  welcome: 'Welcome', verify: 'Confirm your email', reset: 'Reset your password', passwordChanged: 'Password changed', studyReminder: 'Study reminder',
  examCountdown: 'Exam countdown', revisionDue: 'Revision cards due', noticeAlert: 'Official notices',
};

/** Every message, drawn with sample data at desktop and phone width, and a test send to the signed-in staff member only. */
function Templates({ canSend }: { canSend: boolean }) {
  const list = useLoad(consoleApi.emailTemplates, []);
  const [name, setName] = useState('welcome');
  const [wide, setWide] = useState(true);
  const prev = useLoad(() => consoleApi.emailPreview(name), [name]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (only?: string[]) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await consoleApi.emailTest(only);
      setMsg(`Sent ${r.results.filter((x) => x.status === 'SENT').length} of ${r.results.length} to ${r.to}.${r.results.some((x) => x.status !== 'SENT') ? ` Not sent: ${r.results.filter((x) => x.status !== 'SENT').map((x) => `${TEMPLATE_LABEL[x.template] ?? x.template} (${x.status.toLowerCase().replace(/_/g, ' ')})`).join(', ')}.` : ''}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="em-tpl" className="mt-10" data-email-templates>
      <SectionTitle id="em-tpl">Preview every message</SectionTitle>
      <p className="mb-3 max-w-2xl text-sm text-ink-2">These use made-up sample data. Nothing is sent when you preview. A test goes only to your own address, marked [Test].</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(list.data?.templates ?? []).map((t) => (
          <button key={t} type="button" aria-pressed={name === t} onClick={() => setName(t)} className={`rounded-full border px-3 py-1 text-sm ${name === t ? 'border-accent bg-accent-soft text-accent' : 'border-rule text-ink-2 hover:text-ink'}`}>
            {TEMPLATE_LABEL[t] ?? t}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Button kind={wide ? 'primary' : 'secondary'} size="sm" onClick={() => setWide(true)}>Desktop width</Button>
        <Button kind={!wide ? 'primary' : 'secondary'} size="sm" onClick={() => setWide(false)}>Phone width</Button>
        {canSend && <Button size="sm" kind="secondary" disabled={busy} onClick={() => void send([name])}>Send this test to me</Button>}
        {canSend && <Button size="sm" kind="secondary" disabled={busy} onClick={() => void send()}>Send all tests to me</Button>}
      </div>
      {msg && <div role="status" className="mb-3 rounded-lg border border-correct/30 bg-correct-soft px-4 py-2.5 text-sm text-correct">{msg}</div>}
      {err && <ErrorBox error={err} />}
      {prev.error ? <ErrorBox error={prev.error} onRetry={prev.reload} /> : prev.data && (
        <div className="overflow-x-auto rounded-xl border border-rule bg-paper p-3">
          <p className="mb-2 text-sm text-ink-2">Subject: <span className="font-medium text-ink">{prev.data.subject}</span></p>
          <iframe title={`Preview of ${TEMPLATE_LABEL[name] ?? name}`} sandbox="" srcDoc={prev.data.html} data-preview-frame style={{ width: wide ? 640 : 390, height: 560, border: '1px solid var(--rule, #ddd)', background: '#fff' }} />
        </div>
      )}
    </section>
  );
}

export function AdminEmail() {
  const e = useLoad(consoleApi.email, []);
  if (e.loading && !e.data) return <Loading />;
  if (e.error) return <ErrorBox error={e.error} onRetry={e.reload} />;
  const d = e.data!;
  const count = (statuses: string[]) => d.last7Days.filter((r) => statuses.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const kinds = [...new Set(d.last7Days.map((r) => r.kind))];
  const statuses = Object.keys(STATUS).filter((s) => d.last7Days.some((r) => r.status === s));
  const blocked = d.suppressions.reduce((a, r) => a + r.n, 0);
  return (
    <div>
      <PageHeader title="Email" subtitle="Password resets, address confirmations, account notices, study reminders and notice alerts. Message text is never kept, except briefly for a failed reminder, notice or account email that is waiting to be tried again." />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <Badge tone={d.enabled ? 'green' : 'amber'}>{d.enabled ? 'Email is on' : 'Email is off'}</Badge>
        {d.providers.map((p) => (
          <Badge key={p} tone="zinc">
            {PROVIDER[p] ?? p}
          </Badge>
        ))}
        {!d.senderSet && <span>No sender address is set.</span>}
        {!d.appUrlSet && <span>The public address of the app is not set, so reminder emails are not sent.</span>}
      </div>
      <section aria-labelledby="em-ready" className="mb-8" data-readiness>
        <SectionTitle id="em-ready">Ready to switch on?</SectionTitle>
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {d.readiness.map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Badge tone={r.ok ? 'green' : 'amber'}>{r.ok ? 'Done' : 'To do'}</Badge>
              <span className="text-ink">{r.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <Badge tone="zinc">Check by hand</Badge>
            <span className="text-ink-2">The sending domain's DNS records (SPF, bounce MX, DKIM, DMARC). Run <code>node backend/scripts/check-email-dns.mjs your-domain</code>, then send one real email to an inbox you own.</span>
          </li>
        </ul>
      </section>
      <StatGroup
        items={[
          { label: 'Waiting for a retry', value: d.retries.waiting, hint: `${d.retries.recoveredLast7Days} recovered, ${d.retries.gaveUpLast7Days} given up (7 days)` },
          { label: 'Asked for study reminders', value: d.optedIn.studyReminders },
          { label: 'Asked for notice emails', value: d.optedIn.noticeAlerts },
          { label: 'Asked for revision reminders', value: d.optedIn.revisionReminders },
          { label: 'Entered an exam date', value: d.optedIn.examDatesEntered },
        ]}
      />
      <div className="mt-6" />
      <StatGroup
        items={[
          { label: 'Sent, last 7 days', value: count(['SENT', 'DELIVERED']) },
          { label: 'Failed or bounced', value: count(['FAILED', 'BOUNCED', 'COMPLAINED']) },
          { label: 'Not sent', value: count(['SUPPRESSED', 'NOT_CONFIGURED']), hint: 'Address blocked, or email off' },
          { label: 'Blocked addresses', value: blocked },
        ]}
      />

      <section aria-labelledby="em-kinds" className="mt-8">
        <SectionTitle id="em-kinds">Last 7 days by type</SectionTitle>
        {kinds.length === 0 ? (
          <Empty>No email in the last 7 days.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  {statuses.map((s) => (
                    <th key={s} scope="col" className="px-4 py-2.5 text-right font-medium">
                      {STATUS[s]!.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kinds.map((k) => (
                  <tr key={k} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">
                      {KIND[k] ?? k}
                    </th>
                    {statuses.map((s) => (
                      <td key={s} className="num px-4 py-2.5 text-right text-ink">
                        {d.last7Days.find((r) => r.kind === k && r.status === s)?.n ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="em-fail" className="mt-8">
        <SectionTitle id="em-fail">Recent problems</SectionTitle>
        {d.recentFailures.length === 0 ? (
          <Empty icon={<MailWarning />}>No failed, bounced or spam-marked email.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {d.recentFailures.map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <Badge tone={STATUS[f.status]?.tone ?? 'zinc'}>{STATUS[f.status]?.label ?? f.status}</Badge>
                <span className="font-medium text-ink">{KIND[f.kind] ?? f.kind}</span>
                <span className="text-ink-2">{when(f.created_at)}</span>
                {f.last_error && <span className="w-full break-words text-ink-2">{f.last_error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="em-block" className="mt-8">
        <SectionTitle id="em-block">Blocked addresses</SectionTitle>
        {blocked === 0 ? (
          <Empty>No address is blocked.</Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {d.suppressions.map((s) => (
              <li key={s.reason} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink">{REASON[s.reason] ?? s.reason}</span>
                <span className="num font-medium text-ink">{s.n}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink-2">A blocked address gets no more email. This protects the sender's reputation with mail providers.</p>
      </section>
      <Templates canSend />
    </div>
  );
}
