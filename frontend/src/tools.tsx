/** Small student tools shared by several pages: bookmarking, adding to the study plan and recording what was opened. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, localDay, type BookmarkKind, type PlanKind } from './api';
import { useAuth } from './ui';

/** Remembers that a topic or lesson was opened, for "continue learning". Silent and signed-in only. */
export function useTrackView(kind: 'TOPIC_VIEW' | 'LESSON_VIEW', id: string | null | undefined) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || !id) return;
    api.activity(kind === 'LESSON_VIEW' ? { kind, resourceId: id } : { kind, nodeId: id }).catch(() => undefined);
  }, [user, kind, id]);
}

/** Loads which of the given items are bookmarked and lets the page toggle them. */
export function useBookmarks(kind: BookmarkKind, ids: string[]) {
  const { user } = useAuth();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const key = ids.join(',');
  useEffect(() => {
    if (!user || !ids.length) return;
    api.bookmarkState(kind, ids.slice(0, 100)).then((r) => setMarked(new Set(r)), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, kind, key]);
  const toggle = async (id: string) => {
    const on = !marked.has(id);
    setMarked((m) => {
      const n = new Set(m);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    try {
      await (on ? api.addBookmark({ kind, entityId: id }) : api.removeBookmark({ kind, entityId: id }));
    } catch {
      setMarked((m) => {
        const n = new Set(m);
        if (on) n.delete(id);
        else n.add(id);
        return n;
      });
    }
  };
  return { marked, toggle };
}

export function BookmarkButton({ kind, id, compact = false }: { kind: BookmarkKind; id: string; compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { marked, toggle } = useBookmarks(kind, [id]);
  const on = marked.has(id);
  return (
    <button
      type="button"
      onClick={() => (user ? toggle(id) : navigate('/signin'))}
      aria-pressed={on}
      title={on ? 'Remove bookmark' : 'Bookmark this'}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 transition ${
        on ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50'
      }`}
    >
      <BookmarkIcon filled={on} />
      {!compact && (on ? 'Bookmarked' : 'Bookmark')}
    </button>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M4 2.5h8v11l-4-3-4 3z" strokeLinejoin="round" />
    </svg>
  );
}

/** "Add to plan": pick a day, the item goes into the study planner. */
export function AddToPlan({ kind, refId, title }: { kind: PlanKind; refId: string | null; title: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(localDay());
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const save = async () => {
    setState('saving');
    try {
      await api.addPlan({ day, kind, refId, title: title.slice(0, 200) });
      setState('done');
      setOpen(false);
    } catch {
      setState('error');
    }
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => (user ? (setOpen(true), setState('idle')) : navigate('/signin'))}
        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50"
      >
        {state === 'done' ? '✓ Added to plan' : '+ Add to plan'}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-xs ring-1 ring-zinc-300">
      <label className="sr-only" htmlFor={`plan-day-${refId ?? 'x'}`}>
        Day
      </label>
      <input id={`plan-day-${refId ?? 'x'}`} type="date" value={day} min={localDay()} onChange={(e) => setDay(e.target.value)} className="rounded border border-zinc-200 px-1 py-0.5 text-xs" />
      <button type="button" onClick={save} disabled={state === 'saving' || !day} className="rounded bg-[var(--color-accent)] px-2 py-0.5 font-medium text-white disabled:opacity-50">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-zinc-500 hover:text-zinc-800" aria-label="Cancel">
        ✕
      </button>
      {state === 'error' && <span className="text-red-700">Could not add</span>}
    </span>
  );
}
