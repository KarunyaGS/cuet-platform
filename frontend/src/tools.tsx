/** Small student tools shared by several pages: bookmarking, adding to the study plan and recording what was opened. */
import { Bookmark, CalendarCheck2, CalendarPlus, X } from 'lucide-react';
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
  return <BookmarkToggle on={marked.has(id)} onClick={() => (user ? toggle(id) : navigate('/signin'))} compact={compact} />;
}

/** The bookmark control itself; pages that show many items load their state once with useBookmarks and pass it in. */
export function BookmarkToggle({ on, onClick, compact = false }: { on: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? 'Remove bookmark' : 'Bookmark this'}
      aria-label={compact ? (on ? 'Remove bookmark' : 'Bookmark this') : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${compact ? 'w-8 justify-center' : 'px-2.5'} ${
        on ? 'bg-marker-soft text-marker ring-1 ring-inset ring-marker/30' : 'bg-surface text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper hover:text-ink'
      }`}
    >
      <Bookmark aria-hidden className="size-4" fill={on ? 'currentColor' : 'none'} />
      {!compact && (on ? 'Bookmarked' : 'Bookmark')}
    </button>
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
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium ring-1 ring-inset transition-colors ${
          state === 'done' ? 'bg-correct-soft text-correct ring-correct/30' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper hover:text-ink'
        }`}
      >
        {state === 'done' ? <CalendarCheck2 aria-hidden className="size-4" /> : <CalendarPlus aria-hidden className="size-4" />}
        {state === 'done' ? 'Added to plan' : 'Add to plan'}
      </button>
    );
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface pr-1 pl-1.5 text-[13px] ring-1 ring-inset ring-accent/40">
      <label className="sr-only" htmlFor={`plan-day-${refId ?? 'x'}`}>
        Day to plan this for
      </label>
      <input id={`plan-day-${refId ?? 'x'}`} type="date" value={day} min={localDay()} onChange={(e) => setDay(e.target.value)} className="rounded-md border border-rule px-1.5 py-0.5 text-[13px] text-ink" />
      <button type="button" onClick={save} disabled={state === 'saving' || !day} className="rounded-md bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-strong disabled:opacity-50">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label="Cancel">
        <X aria-hidden className="size-4" />
      </button>
      {state === 'error' && <span className="px-1 text-wrong">Could not add. Try again.</span>}
    </span>
  );
}
