/** Admin console: students' chats and tickets. Staff read, reply and set a ticket's status; every reply is stored under their own account. */
import { useState, type FormEvent } from 'react';
import { Badge, Button, Empty, ErrorBox, inputClass, Loading, PageHeader, SearchInput, Segmented, useLoad } from '../ui';
import { consoleApi, when, type SupportRow } from './api';

const TONE: Record<string, 'amber' | 'accent' | 'green'> = { OPEN: 'amber', IN_PROGRESS: 'accent', RESOLVED: 'green' };
const LABEL: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };

function Thread({ id, onChanged }: { id: string; onChanged: () => void }) {
  const d = useLoad(() => consoleApi.supportThread(id), [id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const t = d.data!.thread;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setText('');
      d.reload();
      onChanged();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) void act(() => consoleApi.supportReply(id, text.trim()));
  };
  return (
    <div className="rounded-xl border border-rule bg-surface" data-support-thread={id}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{t.kind === 'CHAT' ? 'Chat' : `${t.reference}: ${t.title}`}</div>
          <div className="text-sm text-ink-2">
            {t.student.name} · {t.student.email}
            {t.categoryLabel ? ` · ${t.categoryLabel}` : ''}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Status
          <select value={t.status} disabled={busy} onChange={(e) => void act(() => consoleApi.supportStatus(id, e.target.value))} className={`${inputClass} h-9 w-auto text-sm`} aria-label="Status">
            {Object.entries(LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="max-h-[28rem] space-y-3 overflow-y-auto px-4 py-3">
        {d.data!.messages.map((m) => (
          <li key={m.id} className={`flex flex-col ${m.from === 'SUPPORT' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.from === 'SUPPORT' ? 'bg-accent text-white' : 'bg-paper text-ink'}`}>
              {m.body}
              {m.attachment && (
                <a href={`/api/console/support/attachments/${m.id}`} target="_blank" rel="noreferrer" className="mt-1 block underline">
                  Attachment: {m.attachment.name}
                </a>
              )}
            </div>
            <span className="mt-0.5 text-xs text-ink-3">
              {m.from === 'SUPPORT' ? 'Support' : t.student.name} · {when(m.at)}
            </span>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="flex gap-2 border-t border-rule p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Reply to the student" aria-label="Reply" className={`${inputClass} min-h-10 flex-1 text-sm`} />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Sending…' : 'Reply'}
        </Button>
      </form>
      {err && <ErrorBox error={err} />}
    </div>
  );
}

export function AdminSupport() {
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useLoad(() => consoleApi.supportThreads({ status, kind, q }), [status, kind, q]);
  return (
    <div>
      <PageHeader title="Support" subtitle="Chats and tickets from students. A reply appears in the student's own conversation; nothing is sent automatically." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'OPEN', label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'RESOLVED', label: 'Resolved' },
          ]}
        />
        <Segmented
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: '', label: 'Chats and tickets' },
            { value: 'TICKET', label: 'Tickets' },
            { value: 'CHAT', label: 'Chats' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Reference, title or student" label="Search support requests" />
      </div>
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <Empty>No support requests match.</Empty>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className="divide-y divide-rule self-start overflow-hidden rounded-xl border border-rule bg-surface">
          {(list.data ?? []).map((r: SupportRow) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r.id)} aria-current={open === r.id ? 'true' : undefined} data-support-row={r.id} className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-paper ${open === r.id ? 'bg-accent-soft' : ''}`}>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.kind === 'CHAT' ? `Chat: ${r.student.name}` : `${r.reference} ${r.title}`}</span>
                  <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                </span>
                <span className="text-xs text-ink-3">
                  {r.student.email} · {when(r.lastMessageAt)}
                  {r.waitingForSupport ? ' · waiting for support' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {open ? <Thread id={open} onChanged={list.reload} /> : <Empty>Choose a request to read and answer it.</Empty>}
      </div>
    </div>
  );
}
