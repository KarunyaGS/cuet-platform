import { BookOpen, ChevronRight, FileText, ListChecks, PencilLine, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type TopicDetail } from '../api';
import { SavedForRevision } from '../revision';
import { AddToPlan, BookmarkButton, useTrackView } from '../tools';
import { Button, ErrorBox, kindLabel, Loading, SectionTitle, useAuth, useLoad } from '../ui';

type Related = { id: string; title: string; type: string; from: string | null };

/**
 * Lessons that belong to this page: its own, and for a unit or section the lessons of the topics under it (a unit has none of its own).
 * Nothing is shown when there are none, so the column simply ends with the content above it.
 */
function RelatedContent({ d }: { d: TopicDetail }) {
  const [items, setItems] = useState<Related[] | null>(d.resources.length > 0 || d.children.length === 0 ? d.resources.map((r) => ({ id: r.id, title: r.title, type: r.type, from: null })) : null);
  useEffect(() => {
    if (items) return;
    let live = true;
    void Promise.all(
      d.children.map((c) =>
        api.topic(c.id).then(
          (x) => x.resources.map((r) => ({ id: r.id, title: r.title, type: r.type, from: [c.label, c.title].filter(Boolean).join(' ') })),
          () => [] as Related[],
        ),
      ),
    ).then((all) => live && setItems(all.flat()));
    return () => {
      live = false;
    };
  }, [d, items]);
  if (!items || items.length === 0) return null;
  return (
    <section aria-labelledby="related" className="mb-6">
      <SectionTitle id="related">Lessons and related content</SectionTitle>
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {items.map((r) => (
          <li key={r.id}>
            <Link to={`/learn/${r.id}`} className="group flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-paper">
              <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink group-hover:text-accent">{r.title}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{[r.type === 'LESSON' ? 'Lesson' : r.type.charAt(0) + r.type.slice(1).toLowerCase(), r.from].filter(Boolean).join(' · ')}</span>
              </span>
              <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Topic page: the official syllabus wording with its source page, subtopics, their lessons and practice. */
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
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-3">
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
        {kl && (
          <span className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3.5" />
            <span aria-current="page" className="font-medium text-ink-2">
              {kl}
            </span>
          </span>
        )}
      </nav>

      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule pb-2.5" data-topic-header>
        <h1 className="min-w-0 max-w-[58rem] flex-1 basis-72 text-lg leading-snug font-semibold break-words text-ink sm:text-xl">{d.topic.title}</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BookmarkButton kind="TOPIC" id={d.topic.id} />
          <AddToPlan kind="TOPIC" refId={d.topic.id} title={d.topic.title} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8" data-topic-layout>
        <div className="min-w-0">
          <section aria-label="Official syllabus text" className="mb-6 rounded-xl border border-rule border-l-2 border-l-accent bg-surface px-4 py-3">
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
            <section className="mb-6" aria-labelledby="covered">
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

          <RelatedContent key={d.topic.id} d={d} />
        </div>

        <aside className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start" data-topic-side>
          <div className="rounded-lg bg-ink/[0.035] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <PencilLine aria-hidden className="size-4 text-accent" />
                Practise this topic
              </h2>
              <span className="num text-xs text-ink-3">
                {d.questionCount} {d.questionCount === 1 ? 'question' : 'questions'}
              </span>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <Button size="sm" onClick={() => start('PRACTICE')} disabled={!d.questionCount}>
                Practise with instant feedback
              </Button>
              <Button size="sm" kind="secondary" onClick={() => start('TOPIC_TEST')} disabled={!d.questionCount} icon={<Timer aria-hidden />}>
                Timed topic test
              </Button>
            </div>
            {!d.questionCount && <p className="mt-2 text-xs text-ink-3">Questions for this topic are still being written.</p>}
            {err && <ErrorBox error={err} />}
          </div>
          {d.resources.length > 0 && (
            <Link to={`/revise/${d.topic.id}`} className="group flex items-center gap-2 rounded-lg bg-ink/[0.035] px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.07]">
              <ListChecks aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate group-hover:text-accent">Quick revision</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
            </Link>
          )}
          <SavedForRevision compact scope={{ nodeId: d.topic.id }} />
        </aside>
      </div>
    </div>
  );
}
