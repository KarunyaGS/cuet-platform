import { Bookmark as BookmarkIcon, BookOpen, Check, CircleHelp, History, Layers, Lightbulb, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, type Bookmark, type BookmarkKind } from '../api';
import { Rich } from '../rich';
import { ButtonLink, Empty, ErrorBox, Loading, PageHeader, Segmented, useAuth, useLoad } from '../ui';

const KIND: Record<BookmarkKind, { label: string; icon: React.ReactNode }> = {
  TOPIC: { label: 'Topic', icon: <Layers aria-hidden className="size-[18px]" /> },
  LESSON: { label: 'Lesson', icon: <BookOpen aria-hidden className="size-[18px]" /> },
  QUESTION: { label: 'Question', icon: <CircleHelp aria-hidden className="size-[18px]" /> },
  REVISION: { label: 'Revision notes', icon: <ListChecks aria-hidden className="size-[18px]" /> },
  CONCEPT: { label: 'Concept', icon: <Lightbulb aria-hidden className="size-[18px]" /> },
};

function target(b: Bookmark) {
  if (b.kind === 'TOPIC') return `/topic/${b.entityId}`;
  if (b.kind === 'REVISION') return `/revise/${b.entityId}`;
  if (b.kind === 'LESSON') return `/learn/${b.entityId}`;
  if (b.kind === 'CONCEPT') return b.lesson && b.resourceId ? `/learn/${b.resourceId}#${b.anchor}` : null;
  return b.nodeId ? `/topic/${b.nodeId}` : null;
}

type Tab = BookmarkKind | 'ALL' | 'RECENT';

/** Saved items (topics, lessons, questions, revision notes) and recently viewed lessons and topics. */
export function BookmarksPage() {
  const { user, ready } = useAuth();
  const list = useLoad(api.bookmarks, [user?.id]);
  const recent = useLoad(api.recent, [user?.id]);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'CONCEPT' ? 'CONCEPT' : 'ALL');
  const [err, setErr] = useState<Error | null>(null);
  const [making, setMaking] = useState<string | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const all = list.data!;
  const shown = tab === 'ALL' ? all : all.filter((b) => b.kind === tab);
  const count = (k: BookmarkKind) => all.filter((b) => b.kind === k).length;
  const remove = async (b: Bookmark) => {
    setErr(null);
    try {
      await api.removeBookmark({ kind: b.kind, entityId: b.entityId });
      list.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  // One step from a saved concept to its flashcard. The bookmark stays; the two are separate.
  const makeCard = async (b: Bookmark) => {
    setErr(null);
    setMaking(b.id);
    try {
      await api.createCard(b.entityId);
      list.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setMaking(null);
    }
  };
  return (
    <div>
      <PageHeader
        title="Saved and recent"
        subtitle="Concepts, topics, lessons, questions and revision notes you saved, and what you opened recently."
        actions={<ButtonLink to="/flashcards">My flashcards</ButtonLink>}
      />
      <div className="mb-5">
        <Segmented
          label="Which items to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ALL', label: `All saved (${all.length})` },
            { value: 'CONCEPT', label: `Concepts (${count('CONCEPT')})` },
            { value: 'TOPIC', label: `Topics (${count('TOPIC')})` },
            { value: 'LESSON', label: `Lessons (${count('LESSON')})` },
            { value: 'REVISION', label: `Revision notes (${count('REVISION')})` },
            { value: 'QUESTION', label: `Questions (${count('QUESTION')})` },
            { value: 'RECENT', label: 'Recently viewed' },
          ]}
        />
      </div>
      {err && <ErrorBox error={err} />}

      {tab === 'RECENT' ? (
        recent.loading && !recent.data ? (
          <Loading />
        ) : recent.error ? (
          <ErrorBox error={recent.error} onRetry={recent.reload} />
        ) : recent.data!.length === 0 ? (
          <Empty icon={<History />}>Nothing opened yet. Lessons and topics you open appear here.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {recent.data!.map((r) => (
              <li key={`${r.kind}-${r.resourceId ?? r.nodeId}`}>
                <Link to={r.kind === 'LESSON_VIEW' ? `/learn/${r.resourceId}` : `/topic/${r.nodeId}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-paper">
                  <span className="mt-0.5 shrink-0 text-ink-3">{r.kind === 'LESSON_VIEW' ? KIND.LESSON.icon : KIND.TOPIC.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] text-ink">{r.title ?? '(no longer available)'}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {r.kind === 'LESSON_VIEW' ? 'Lesson' : 'Topic'}
                      {r.paper ? `, ${r.paper}` : ''}, opened {new Date(r.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <Empty icon={<BookmarkIcon />}>
          {tab === 'CONCEPT'
            ? 'No concepts saved yet. In a lesson, use the bookmark button under a definition, a formula or a key point.'
            : 'Nothing saved here yet. Use the bookmark button on a topic, a lesson, a concept, a revision page or a practice question.'}
        </Empty>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {shown.map((b) => {
            const to = target(b);
            const body = b.kind === 'QUESTION' ? <Rich text={b.title} inline /> : b.title;
            return (
              <li key={b.id} className="group flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 shrink-0 text-ink-3">{KIND[b.kind].icon}</span>
                <span className="min-w-0 flex-1">
                  {to ? (
                    <Link to={to} className="line-clamp-2 text-[15px] text-ink hover:text-accent">
                      {body}
                    </Link>
                  ) : (
                    <span className="line-clamp-2 text-[15px] text-ink">{body}</span>
                  )}
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {KIND[b.kind].label}
                    {b.paper ? `, ${b.paper}` : ''}
                    {b.kind === 'QUESTION' && b.nodeId ? '. Opens the topic it belongs to.' : ''}
                    {b.kind === 'CONCEPT' ? (b.lesson ? `, in “${b.lesson}”` : '. Its lesson is no longer available.') : ''}
                  </span>
                </span>
                {b.kind === 'CONCEPT' &&
                  (b.cardId ? (
                    <Link to="/flashcards" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-correct-soft px-2.5 text-[13px] font-medium text-correct ring-1 ring-inset ring-correct/30">
                      <Check aria-hidden className="size-4" />
                      <span className="hidden sm:inline">In my cards</span>
                      <span className="sr-only sm:hidden">In my cards</span>
                    </Link>
                  ) : b.lesson ? (
                    <button
                      type="button"
                      onClick={() => makeCard(b)}
                      disabled={making === b.id}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
                    >
                      <Plus aria-hidden className="size-4" />
                      {making === b.id ? 'Adding…' : 'Make flashcard'}
                    </button>
                  ) : null)}
                <button
                  type="button"
                  onClick={() => remove(b)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-ink-3 transition-colors hover:bg-wrong-soft hover:text-wrong"
                  aria-label={`Remove bookmark: ${typeof b.title === 'string' ? b.title.slice(0, 60) : ''}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
