import { BookOpen, ChevronRight, FileText, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, type TopicDetail } from '../api';
import { SavedForRevision } from '../revision';
import { AddToPlan, BookmarkButton, useTrackView } from '../tools';
import { ErrorBox, kindLabel, Loading, SectionTitle, useLoad } from '../ui';

type Related = { id: string; title: string; type: string; from: string | null };

/**
 * Lessons that belong to this page: its own, and for a unit or section the lessons of the topics under it (a unit has none of its own).
 * `null` while they are being fetched.
 */
function useRelated(d: TopicDetail): Related[] | null {
  const [items, setItems] = useState<Related[] | null>(d.resources.length > 0 || d.children.length === 0 ? d.resources.map((r) => ({ id: r.id, title: r.title, type: r.type, from: null })) : null);
  useEffect(() => {
    if (items) return;
    let live = true;
    void Promise.all(
      d.children.map((c) =>
        api.topic(c.id).then(
          (x) => x.resources.map((r) => ({ id: r.id, title: r.title, type: r.type, from: kindLabel(c.kind, c.label) || c.title })),
          () => [] as Related[],
        ),
      ),
    ).then((all) => live && setItems(all.flat()));
    return () => {
      live = false;
    };
  }, [d, items]);
  return items;
}

/** The official NTA syllabus PDF, opened at the page where this topic is listed. Only shown when the topic really has that reference. */
function OfficialPdf({ source }: { source: TopicDetail['source'] }) {
  if (!source.url) return null;
  return (
    <a
      href={`${source.url}#page=${source.page ?? 1}`}
      target="_blank"
      rel="noreferrer noopener"
      data-official-pdf
      title="Opens the official NTA PDF in a new tab"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20 transition-colors hover:bg-accent-soft/60 hover:underline"
    >
      <FileText aria-hidden className="size-3.5" />
      Official NTA PDF{source.page ? `, page ${source.page}` : ''}
    </a>
  );
}

function LessonsList({ items, source }: { items: Related[]; source: TopicDetail['source'] }) {
  return (
    <section aria-labelledby="related" className="min-w-0">
      <SectionTitle id="related">Lessons and related content</SectionTitle>
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {items.map((r) => (
          <li key={r.id} className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors hover:bg-paper">
            <Link to={`/learn/${r.id}`} className="flex min-w-0 flex-1 basis-56 items-center gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <BookOpen className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-snug font-medium text-ink group-hover:text-accent">{r.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{[r.type === 'LESSON' ? 'Lesson' : r.type.charAt(0) + r.type.slice(1).toLowerCase(), r.from].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
            {source.url && !r.from && <OfficialPdf source={source} />}
            <Link to={`/learn/${r.id}`} tabIndex={-1} aria-hidden className="shrink-0">
              <ChevronRight aria-hidden className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoveredList({ d }: { d: TopicDetail }) {
  return (
    <section aria-labelledby="covered" className="min-w-0">
      <SectionTitle id="covered">Covered in this {d.topic.kind.toLowerCase()}</SectionTitle>
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {d.children.map((c) => (
          <li key={c.id}>
            <Link to={`/topic/${c.id}`} className="group flex items-start gap-2.5 px-3.5 py-2 text-[13px] transition-colors hover:bg-paper">
              {kindLabel(c.kind, c.label) && <span className="mt-px w-12 shrink-0 text-xs text-ink-3">{kindLabel(c.kind, c.label)}</span>}
              <span className="line-clamp-2 min-w-0 flex-1 text-ink group-hover:text-accent">{c.title}</span>
              <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The left column: lessons and what the page covers. When both exist they sit side by side on a wide screen
 * (lessons first, as the main thing to open) so nothing is pushed far down the page; on a narrow screen they stack.
 */
function MainColumn({ d }: { d: TopicDetail }) {
  const related = useRelated(d);
  const lessons = related && related.length > 0 ? related : null;
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-4">
        {lessons && <LessonsList items={lessons} source={d.source} />}
        {/* A chapter, or a topic with no lesson of its own: the same official reference, in the same place (the top of the lesson area). */}
        {related !== null && d.source.url && !(lessons && lessons.some((r) => !r.from)) && (
          <div className="flex" data-official-pdf-row>
            <OfficialPdf source={d.source} />
          </div>
        )}
        {related !== null && !lessons && (
          <p className="rounded-lg border border-dashed border-rule-strong px-4 py-3 text-sm text-ink-2">There is no lesson for this topic yet. You can still practise its questions.</p>
        )}
        {/* Only a chapter (a heading with topics under it) lists what the student saved from inside it. A single topic or lesson page does not. */}
        {d.children.length > 0 && <SavedForRevision plain scope={{ nodeId: d.topic.id }} />}
      </div>
    </div>
  );
}

/** Topic page: what the topic covers, its lessons, and practice. */
export function TopicPage() {
  const { nodeId = '' } = useParams();
  const t = useLoad(() => api.topic(nodeId), [nodeId]);
  useTrackView('TOPIC_VIEW', t.data ? nodeId : null);

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
        <div className="min-w-0 max-w-[58rem] flex-1 basis-72">
          <h1 className="text-lg leading-snug font-semibold break-words text-ink sm:text-xl">{d.topic.title}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BookmarkButton kind="TOPIC" id={d.topic.id} />
          <AddToPlan kind="TOPIC" refId={d.topic.id} title={d.topic.title} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6" data-topic-layout>
        <MainColumn key={d.topic.id} d={d} />

        <aside className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start" data-topic-side>
          {d.resources.length > 0 && (
            <Link to={`/revise/${d.topic.id}`} className="group flex items-center gap-2 rounded-lg bg-ink/[0.035] px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.07]">
              <ListChecks aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate group-hover:text-accent">Quick revision</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
