import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api, type Bookmark, type BookmarkKind } from '../api';
import { Rich } from '../rich';
import { Empty, ErrorBox, Loading, PageHeader, useAuth, useLoad } from '../ui';

const TABS: { kind: BookmarkKind | 'ALL'; label: string }[] = [
  { kind: 'ALL', label: 'All' },
  { kind: 'TOPIC', label: 'Topics' },
  { kind: 'LESSON', label: 'Lessons' },
  { kind: 'QUESTION', label: 'Questions' },
];

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
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const all = list.data!;
  const shown = tab === 'ALL' ? all : all.filter((b) => b.kind === tab);
  const remove = async (b: Bookmark) => {
    await api.removeBookmark({ kind: b.kind, entityId: b.entityId });
    list.reload();
  };
  return (
    <div>
      <PageHeader title="Bookmarks" subtitle="Topics, lessons and questions you saved to come back to" />
      <div className="mb-3 flex gap-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={tab === t.kind}
            onClick={() => setTab(t.kind)}
            className={`rounded-md px-2.5 py-1 text-sm font-medium ${tab === t.kind ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
          >
            {t.label} <span className="num text-xs opacity-70">{t.kind === 'ALL' ? all.length : all.filter((b) => b.kind === t.kind).length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty>Nothing here yet. Use the bookmark button on a topic, a lesson or a practice question.</Empty>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {shown.map((b) => {
            const to = target(b);
            const body = b.kind === 'QUESTION' ? <Rich text={b.title} inline className="text-sm" /> : b.title;
            return (
              <li key={b.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="mt-0.5 w-16 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{b.kind.toLowerCase()}</span>
                <span className="min-w-0 flex-1">
                  {to ? (
                    <Link to={to} className="block hover:underline">
                      {body}
                    </Link>
                  ) : (
                    <span className="block">{body}</span>
                  )}
                  <span className="text-[11px] text-zinc-500">
                    {b.paper ?? ''}
                    {b.kind === 'QUESTION' && b.nodeId ? ' · opens the topic it belongs to' : ''}
                  </span>
                </span>
                <button type="button" onClick={() => remove(b)} className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-700">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
