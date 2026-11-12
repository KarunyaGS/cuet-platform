import { Bookmark as BookmarkIcon, BookOpen, CircleHelp, Layers, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api, type Bookmark, type BookmarkKind } from '../api';
import { Rich } from '../rich';
import { Empty, ErrorBox, Loading, PageHeader, Segmented, useAuth, useLoad } from '../ui';

const KIND: Record<BookmarkKind, { label: string; icon: React.ReactNode }> = {
  TOPIC: { label: 'Topic', icon: <Layers aria-hidden className="size-[18px]" /> },
  LESSON: { label: 'Lesson', icon: <BookOpen aria-hidden className="size-[18px]" /> },
  QUESTION: { label: 'Question', icon: <CircleHelp aria-hidden className="size-[18px]" /> },
};

function target(b: Bookmark) {
  if (b.kind === 'TOPIC') return `/topic/${b.entityId}`;
  if (b.kind === 'LESSON') return `/learn/${b.entityId}`;
  return b.nodeId ? `/topic/${b.nodeId}` : null;
}

/** Everything the student has bookmarked: topics, lessons and questions to come back to. */
export function BookmarksPage() {
  const { user, ready } = useAuth();
  const list = useLoad(api.bookmarks, [user?.id]);
  const [tab, setTab] = useState<BookmarkKind | 'ALL'>('ALL');
  const [err, setErr] = useState<Error | null>(null);
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
  return (
    <div>
      <PageHeader title="Bookmarks" subtitle="Topics, lessons and questions you saved to come back to." />
      <div className="mb-5">
        <Segmented
          label="Which bookmarks to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ALL', label: `All (${all.length})` },
            { value: 'TOPIC', label: `Topics (${count('TOPIC')})` },
            { value: 'LESSON', label: `Lessons (${count('LESSON')})` },
            { value: 'QUESTION', label: `Questions (${count('QUESTION')})` },
          ]}
        />
      </div>
      {err && <ErrorBox error={err} />}
      {shown.length === 0 ? (
        <Empty icon={<BookmarkIcon />}>Nothing saved here yet. Use the bookmark button on a topic, a lesson or a practice question.</Empty>
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
                  </span>
                </span>
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
