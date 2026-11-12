import { BookOpen, ChevronRight, FileText, ListChecks, PencilLine, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { AddToPlan, BookmarkButton, useTrackView } from '../tools';
import { Button, Empty, ErrorBox, kindLabel, Loading, SectionTitle, useAuth, useLoad } from '../ui';

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
  const kl = kindLabel(d.topic.kind, d.topic.label);
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        {d.paper && (
          <>
            <Link to={`/${d.paper.exam}`} className="hover:text-accent">
              {d.paper.exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
            <Link to={`/${d.paper.exam}/subject/${d.paper.id}`} className="hover:text-accent">
              {d.paper.name}
            </Link>
          </>
        )}
        {d.breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3.5" />
            <Link to={`/topic/${b.id}`} className="hover:text-accent">
              {kindLabel(b.kind, b.label) || (b.title.length > 30 ? `${b.title.slice(0, 30)}…` : b.title)}
            </Link>
          </span>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <header className="mb-6">
            {kl && <div className="text-sm text-ink-3">{kl}</div>}
            <h1 className="text-2xl font-semibold text-ink">{d.topic.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <BookmarkButton kind="TOPIC" id={d.topic.id} />
              <AddToPlan kind="TOPIC" refId={d.topic.id} title={d.topic.title} />
            </div>
          </header>

          <section aria-label="Official syllabus text" className="mb-8 border-l-2 border-accent bg-surface py-3 pr-4 pl-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-ink-2">Official syllabus text</span>
              {d.source.url && (
                <a href={`${d.source.url}#page=${d.source.page ?? 1}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  <FileText aria-hidden className="size-4" />
                  NTA PDF, page {d.source.page}
                </a>
              )}
            </div>
            <p className="font-serif text-[15px] leading-relaxed text-ink">{d.topic.title}</p>
            {d.topic.body && <p className="mt-1 font-serif text-[15px] leading-relaxed text-ink-2">{d.topic.body}</p>}
          </section>

          {d.children.length > 0 && (
            <section className="mb-8" aria-labelledby="covered">
              <SectionTitle id="covered">Covered in this {d.topic.kind.toLowerCase()}</SectionTitle>
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                {d.children.map((c) => (
                  <li key={c.id}>
                    <Link to={`/topic/${c.id}`} className="group flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-paper">
                      {kindLabel(c.kind, c.label) && <span className="mt-px w-14 shrink-0 text-xs text-ink-3">{kindLabel(c.kind, c.label)}</span>}
                      <span className="min-w-0 flex-1 text-ink group-hover:text-accent">{c.title}</span>
                      <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="material">
            <SectionTitle id="material">Learning material</SectionTitle>
            {d.resources.length === 0 ? (
              <Empty icon={<BookOpen />}>There is no lesson for this topic yet. You can still practise its questions.</Empty>
            ) : (
              <ul className="space-y-2">
                {d.resources.map((r) => (
                  <li key={r.id}>
                    <Link to={`/learn/${r.id}`} className="group flex items-center gap-3.5 rounded-xl border border-rule bg-surface px-4 py-3.5 transition-colors hover:border-accent/50">
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                        <BookOpen className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-ink-3">{r.type === 'LESSON' ? 'Lesson' : r.type.charAt(0) + r.type.slice(1).toLowerCase()}</span>
                        <span className="block font-medium text-ink group-hover:text-accent">{r.title}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-rule bg-surface p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <PencilLine aria-hidden className="size-[18px] text-accent" />
              Practise this topic
            </h2>
            <p className="num mt-1 text-sm text-ink-2">
              {d.questionCount} {d.questionCount === 1 ? 'question' : 'questions'} on this topic and its subtopics.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => start('PRACTICE')} disabled={!d.questionCount}>
                Practise with instant feedback
              </Button>
              <Button kind="secondary" onClick={() => start('TOPIC_TEST')} disabled={!d.questionCount} icon={<Timer aria-hidden />}>
                Timed topic test
              </Button>
            </div>
            {!d.questionCount && <p className="mt-3 text-sm text-ink-3">Questions for this topic are still being written.</p>}
            {err && <ErrorBox error={err} />}
          </div>
          {d.resources.length > 0 && (
            <Link to={`/revise/${d.topic.id}`} className="group flex items-start gap-3 rounded-xl border border-rule bg-surface p-5 transition-colors hover:border-accent/50">
              <ListChecks aria-hidden className="mt-0.5 size-[18px] shrink-0 text-accent" />
              <span>
                <span className="block font-semibold text-ink group-hover:text-accent">Quick revision</span>
                <span className="mt-0.5 block text-sm text-ink-2">Definitions, formulas, key points and exam tips from this topic’s lessons on one page.</span>
              </span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
