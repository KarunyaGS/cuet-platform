/** Admin console: previous-year papers. Shows what is stored, what still blocks publishing, and each question beside the official key. */
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, useLoad } from '../ui';
import { consoleApi, when, type AdminPastPaper } from './api';

const STATUS: Record<string, { label: string; tone: 'green' | 'zinc' | 'red' }> = { PUBLISHED: { label: 'Published', tone: 'green' }, DRAFT: { label: 'Draft', tone: 'zinc' }, ARCHIVED: { label: 'Archived', tone: 'red' } };

export function AdminPastPapers() {
  const list = useLoad(consoleApi.pastPapers, []);
  const [open, setOpen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const act = async (p: AdminPastPaper, action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE') => {
    if (action !== 'PUBLISH' && !window.confirm(action === 'ARCHIVE' ? `Archive "${p.title}"? Students will no longer see it.` : `Unpublish "${p.title}"? Students will no longer see it.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await consoleApi.pastPaperStatus(p.id, action);
      list.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader
        title="Previous-year papers"
        subtitle="A paper reaches students only when its permission allows display, the final official key is recorded, and a reviewer has verified every question. Papers are added with the import tool."
      />
      {err && <ErrorBox error={err} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.length === 0 ? (
          <Empty>No previous-year paper has been imported. Nothing is imported without a source that permits it.</Empty>
        ) : (
          <ul className="space-y-3">
            {list.data.map((p) => (
              <li key={p.id} className="rounded-xl border border-rule bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{p.title}</span>
                    <span className="block text-ink-2">
                      {p.exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG'} {p.year} · {p.subjectName} ({p.subjectCode}) · {p.questions} questions{p.dropped ? `, ${p.dropped} dropped` : ''} · {p.verified} verified
                      {p.flagged ? `, ${p.flagged} flagged` : ''}
                    </span>
                    <span className="block text-ink-3">
                      Permission: {p.permission}
                      {p.publishedAt ? ` · published ${when(p.publishedAt)}` : ''}
                    </span>
                  </span>
                  <Badge tone={STATUS[p.status]?.tone ?? 'zinc'}>{STATUS[p.status]?.label ?? p.status}</Badge>
                  <Button kind="secondary" size="sm" onClick={() => setOpen(open === p.id ? '' : p.id)}>
                    {open === p.id ? 'Hide questions' : 'Questions and keys'}
                  </Button>
                  {p.status === 'DRAFT' && (
                    <Button size="sm" disabled={busy || p.blockers.length > 0} title={p.blockers.length ? 'See what is still needed below' : undefined} onClick={() => void act(p, 'PUBLISH')}>
                      Publish
                    </Button>
                  )}
                  {p.status === 'PUBLISHED' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(p, 'UNPUBLISH')}>
                      Unpublish
                    </Button>
                  )}
                  {p.status === 'DRAFT' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(p, 'ARCHIVE')}>
                      Archive
                    </Button>
                  )}
                </div>
                {p.status === 'DRAFT' && p.blockers.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-2">
                    {p.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {open === p.id && <Questions id={p.id} />}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function Questions({ id }: { id: string }) {
  const d = useLoad(() => consoleApi.pastPaper(id), [id]);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} />;
  return (
    <ol className="mt-3 space-y-2 rounded-lg bg-paper p-3">
      {d.data!.questions.map((q) => (
        <li key={q.position} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="num font-medium text-ink">Q{q.position}</span>
            {q.dropped ? (
              <span className="text-ink-2">Dropped by the exam body; not stored.</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-ink">{q.stem}</span>
                <Badge tone={q.verification === 'VERIFIED' ? 'green' : q.verification === 'UNVERIFIED' ? 'zinc' : 'red'}>{q.verification === 'VERIFIED' ? 'Verified' : q.verification === 'UNVERIFIED' ? 'Not verified' : 'Flagged'}</Badge>
              </>
            )}
          </div>
          {!q.dropped && (
            <p className="mt-0.5 text-xs text-ink-2">
              Page {q.sourcePage ?? '?'} · stored key {q.key ? q.options.filter((o) => q.key!.includes(o.position)).map((o) => o.label).join(', ') : String(q.numericAnswer)} · official key{' '}
              {q.officialKey ? q.options.filter((o) => q.officialKey!.includes(o.position)).map((o) => o.label).join(', ') : 'not recorded'}
              {q.officialQuestionId ? ` · official id ${q.officialQuestionId}` : ''}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
