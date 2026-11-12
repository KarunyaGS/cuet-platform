import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { AddToPlan, BookmarkButton, useTrackView } from '../tools';
import { Badge, Button, Empty, ErrorBox, kindLabel, Loading, useAuth, useLoad } from '../ui';

/** Topic page: the official syllabus wording with its source page, subtopics, learning material and practice. */
export function TopicPage() {
  const { nodeId = '' } = useParams();
  const t = useLoad(() => api.topic(nodeId), [nodeId]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [err, setErr] = useState<Error | null>(null);
  useTrackView('TOPIC_VIEW', t.data ? nodeId : null);

  const start = async (mode: 'PRACTICE' | 'TOPIC_TEST') => {
    if (!user) return navigate('/signin');
    setErr(null);
    try {
      const s = await api.startPractice({ mode, nodeId });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    }
  };

  if (t.loading) return <Loading />;
  if (t.error) return <ErrorBox error={t.error} onRetry={t.reload} />;
  const d = t.data!;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
          {d.paper && (
            <>
              <Link to={`/${d.paper.exam}`} className="hover:underline">
                {d.paper.exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'}
              </Link>
              <span>/</span>
              <Link to={`/${d.paper.exam}/subject/${d.paper.id}`} className="hover:underline">
                {d.paper.name}
              </Link>
            </>
          )}
          {d.breadcrumb.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <span>/</span>
              <Link to={`/topic/${b.id}`} className="hover:underline">
                {kindLabel(b.kind, b.label) || b.title.slice(0, 30)}
              </Link>
            </span>
          ))}
        </nav>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            {kindLabel(d.topic.kind, d.topic.label) && <span className="text-zinc-500">{kindLabel(d.topic.kind, d.topic.label)} · </span>}
            {d.topic.title}
          </h1>
          <span className="flex flex-wrap gap-1.5">
            <BookmarkButton kind="TOPIC" id={d.topic.id} />
            <AddToPlan kind="TOPIC" refId={d.topic.id} title={d.topic.title} />
          </span>
        </div>

        <section className="mb-4 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Official syllabus text
            {d.source.url && (
              <a href={`${d.source.url}#page=${d.source.page ?? 1}`} target="_blank" rel="noreferrer" className="font-normal normal-case text-[var(--color-accent)] hover:underline">
                NTA PDF, page {d.source.page}
              </a>
            )}
          </div>
          <p className="text-sm leading-relaxed">{d.topic.title}</p>
          {d.topic.body && <p className="mt-1 text-sm leading-relaxed text-zinc-700">{d.topic.body}</p>}
        </section>

        {d.children.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-1.5 text-sm font-semibold">Covered in this {d.topic.kind.toLowerCase()}</h2>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {d.children.map((c) => (
                <li key={c.id}>
                  <Link to={`/topic/${c.id}`} className="flex gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50">
                    <span className="w-12 shrink-0 text-[11px] text-zinc-400">{kindLabel(c.kind, c.label) || '•'}</span>
                    <span className="min-w-0 flex-1">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-1.5 text-sm font-semibold">Learning material</h2>
          {d.resources.length === 0 ? (
            <Empty>No reviewed notes for this topic yet. Learning material is being written and checked by subject experts.</Empty>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {d.resources.map((r) => (
                <li key={r.id}>
                  <Link to={`/learn/${r.id}`} className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:border-[var(--color-accent)]">
                    <div className="flex items-center gap-1.5">
                      <Badge tone="accent">{r.type.toLowerCase()}</Badge>
                    </div>
                    <div className="mt-1 text-sm font-medium">{r.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-16 lg:self-start">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="text-sm font-semibold">Practice</div>
          <p className="num mt-0.5 text-xs text-zinc-500">{d.questionCount} questions linked to this topic and its subtopics</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <Button onClick={() => start('PRACTICE')} disabled={!d.questionCount}>
              Practise with instant feedback
            </Button>
            <Button kind="secondary" onClick={() => start('TOPIC_TEST')} disabled={!d.questionCount}>
              Timed topic test
            </Button>
          </div>
          {!d.questionCount && <p className="mt-2 text-xs text-zinc-500">Questions for this topic are still being written.</p>}
          {err && <ErrorBox error={err} />}
        </div>
        {d.resources.length > 0 && (
          <Link to={`/revise/${d.topic.id}`} className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-[var(--color-accent)]">
            <div className="text-sm font-semibold">Quick revision</div>
            <p className="mt-0.5 text-xs text-zinc-500">Definitions, formulas, key points and exam tips from this topic’s lessons, on one page.</p>
          </Link>
        )}
      </aside>
    </div>
  );
}
