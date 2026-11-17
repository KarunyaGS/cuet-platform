/** Admin console: every notice, not only the queue. Approve, reject, flag or withdraw with a reason, and read a notice's full history. */
import { History } from 'lucide-react';
import { useState } from 'react';
import { REVISION_LABEL, NOTICE_CATEGORY, noticeDate } from '../pages/Updates';
import { Badge, Button, Empty, ErrorBox, Loading, Panel, SectionTitle, inputClass, useLoad } from '../ui';
import { consoleApi, when, type AdminNotice } from './api';

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  PUBLISHED: { label: 'Showing', tone: 'green' },
  NEEDS_REVIEW: { label: 'Waiting for a check', tone: 'amber' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'red' },
};
const ACTION: Record<string, string> = { DETECTED: 'Found', CHANGED_AT_SOURCE: 'Changed at the source', AUTO_WITHDRAWN: 'Taken off show by the reader', PUBLISHED: 'Published', REJECTED: 'Rejected', FLAGGED: 'Flagged', WITHDRAWN: 'Withdrawn' };

function History_({ id }: { id: string }) {
  const h = useLoad(() => consoleApi.noticeHistory(id), [id]);
  if (h.loading && !h.data) return <Loading />;
  if (h.error) return <ErrorBox error={h.error} onRetry={h.reload} />;
  const d = h.data!;
  return (
    <div className="mt-3 grid gap-4 rounded-lg bg-paper p-3 text-sm sm:grid-cols-2" data-notice-history>
      <div>
        <h4 className="mb-1 font-semibold text-ink">Versions on the official page</h4>
        <ol className="space-y-2">
          {d.versions.map((v) => (
            <li key={v.version}>
              <span className="font-medium text-ink">Version {v.version}</span> <span className="text-ink-3">{when(v.detectedAt)}</span>
              <div className="text-ink-2">{v.title}</div>
              <div className="text-xs text-ink-3">{v.reason}{v.publishedOn ? ` · dated ${noticeDate(v.publishedOn)}` : ''}</div>
            </li>
          ))}
        </ol>
        {d.notice.authenticityNote && (
          <>
            <h4 className="mt-3 mb-1 font-semibold text-ink">Why it counts as official</h4>
            <p className="text-ink-2">{d.notice.authenticityNote}.</p>
          </>
        )}
      </div>
      <div>
        <h4 className="mb-1 font-semibold text-ink">What happened to it</h4>
        <ol className="space-y-2">
          {d.events.map((e, i) => (
            <li key={i}>
              <span className="font-medium text-ink">{ACTION[e.action] ?? e.action}</span> <span className="text-ink-3">{when(e.at)} · {e.actor.replace(/^user:/, 'staff ').replace(/^system:/, '')}</span>
              {e.note && <div className="text-ink-2">{e.note}</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ n, onDone }: { n: AdminNotice; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<'FLAG' | 'WITHDRAW' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [exam, setExam] = useState<'CUET_UG' | ''>((n.exam as 'CUET_UG' | null) ?? '');
  const st = n.duplicateOfId ? { label: 'Duplicate', tone: 'zinc' as const } : (STATUS[n.status] ?? { label: n.status, tone: 'zinc' as const });
  const act = async (action: 'PUBLISH' | 'REJECT' | 'FLAG' | 'WITHDRAW', withReason = false) => {
    setBusy(true);
    setErr(null);
    try {
      await consoleApi.noticeDecision(n.id, { action, ...(withReason ? { reason: reason.trim() } : {}), ...(action === 'PUBLISH' && n.authority === 'NTA' && exam ? { exam } : {}) });
      setAsking(null);
      setReason('');
      onDone();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="px-4 py-3" data-admin-notice={n.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={st.tone}>{st.label}</Badge>
        <Badge tone={n.authority === 'UGC' ? 'accent' : 'zinc'}>{n.authority}</Badge>
        <Badge>{NOTICE_CATEGORY[n.category] ?? n.category}</Badge>
        {n.revisionKind && <Badge tone="amber">{REVISION_LABEL[n.revisionKind]}{n.revisionOf ? ' of an earlier notice' : ''}</Badge>}
        {n.versionCount > 1 && <Badge>{n.versionCount} versions</Badge>}
        {n.autoPublished && <span className="text-ink-3">published by the reader</span>}
        <span className="num text-ink-3">{noticeDate(n.publishedOn)}</span>
      </div>
      <a href={n.documentUrl} target="_blank" rel="noreferrer noopener" className="mt-1 block text-[15px] text-ink hover:text-accent">
        {n.title}
      </a>
      {n.statusNote && <p className="mt-0.5 text-sm text-ink-2">{n.statusNote}</p>}
      {err && <ErrorBox error={err} />}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {n.status === 'PUBLISHED' && !n.duplicateOfId && (
          <>
            <Button size="sm" kind="secondary" disabled={busy} onClick={() => setAsking('FLAG')}>Flag for a second look</Button>
            <Button size="sm" kind="danger" disabled={busy} onClick={() => setAsking('WITHDRAW')}>Withdraw</Button>
          </>
        )}
        {['NEEDS_REVIEW', 'REJECTED', 'WITHDRAWN'].includes(n.status) && !n.duplicateOfId && (
          <>
            {n.authority === 'NTA' && (
              <select aria-label={`Exam for: ${n.title}`} value={exam} onChange={(e) => setExam(e.target.value as 'CUET_UG' | '')} className="h-8 rounded-lg border border-rule-strong bg-surface px-2 text-sm text-ink">
                <option value="">Choose the exam</option>
                <option value="CUET_UG">CUET (UG)</option>
              </select>
            )}
            <Button size="sm" disabled={busy || (n.authority === 'NTA' && !exam)} onClick={() => act('PUBLISH')}>{n.status === 'NEEDS_REVIEW' ? 'Approve and publish' : 'Publish again'}</Button>
            {n.status === 'NEEDS_REVIEW' && <Button size="sm" kind="danger" disabled={busy} onClick={() => act('REJECT')}>Reject</Button>}
          </>
        )}
        <Button size="sm" kind="ghost" onClick={() => setOpen((o) => !o)} icon={<History aria-hidden />}>{open ? 'Hide history' : 'History'}</Button>
      </div>
      {asking && (
        <div className="mt-2 flex max-w-xl flex-wrap items-center gap-2">
          <input aria-label={asking === 'FLAG' ? 'Why you are flagging it' : 'Why you are withdrawing it'} className={`${inputClass} h-9 flex-1 py-0`} placeholder={asking === 'FLAG' ? 'Why is it flagged?' : 'Why is it withdrawn?'} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" kind={asking === 'FLAG' ? 'secondary' : 'danger'} disabled={busy || reason.trim().length < 5} onClick={() => act(asking, true)}>{asking === 'FLAG' ? 'Flag it' : 'Withdraw it'}</Button>
          <Button size="sm" kind="ghost" onClick={() => setAsking(null)}>Cancel</Button>
        </div>
      )}
      {open && <History_ id={n.id} />}
    </li>
  );
}

/** Every notice, filterable. A flag moves a showing notice back to the queue; a withdrawal takes it off show until someone publishes it again. */
export function NoticeManager() {
  const [status, setStatus] = useState('');
  const [authority, setAuthority] = useState('');
  const [revisions, setRevisions] = useState(false);
  const [q, setQ] = useState('');
  const list = useLoad(() => consoleApi.adminNotices({ status, authority, revisions, q }), [status, authority, revisions, q]);
  const sel = `${inputClass} h-9 w-auto py-0`;
  return (
    <section aria-labelledby="gn-all" className="mt-10" data-notice-manager>
      <SectionTitle id="gn-all">All notices</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input aria-label="Search notices" className={`${inputClass} h-9 w-56 py-0`} placeholder="Search titles" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="PUBLISHED">Showing</option>
          <option value="NEEDS_REVIEW">Waiting for a check</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="DUPLICATE">Duplicates</option>
        </select>
        <select aria-label="Issued by" className={sel} value={authority} onChange={(e) => setAuthority(e.target.value)}>
          <option value="">NTA and UGC</option>
          <option value="NTA">NTA</option>
          <option value="UGC">UGC</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" className="size-4 accent-accent" checked={revisions} onChange={(e) => setRevisions(e.target.checked)} />
          Corrigenda and revisions only
        </label>
      </div>
      {list.loading && !list.data ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : list.data!.notices.length === 0 ? (
        <Empty>No notice matches.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2">{list.data!.total} {list.data!.total === 1 ? 'notice' : 'notices'}{list.data!.total > list.data!.notices.length ? `, showing the newest ${list.data!.notices.length}` : ''}</p>
          <Panel className="overflow-hidden p-0">
            <ul className="divide-y divide-rule">{list.data!.notices.map((n) => <Row key={n.id} n={n} onDone={list.reload} />)}</ul>
          </Panel>
        </>
      )}
    </section>
  );
}
