/** Small student tools shared by several pages: bookmarking, adding to the study plan and recording what was opened. */
import { Bookmark, CalendarCheck2, CalendarPlus, Check, GalleryVerticalEnd, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, localDay, type BookmarkKind, type CardImport, type ConceptType, type PlanKind } from './api';
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
    api.bookmarkState(kind, ids.slice(0, 200)).then((r) => setMarked(new Set(r)), () => undefined);
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

/**
 * For the concepts shown on a page (single definitions, formulas, key points and facts): which are bookmarked, which
 * already have a flashcard, and the two one-tap actions. A bookmark and a card are separate; neither removes the other.
 */
export function useConcepts(keys: string[]) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { marked, toggle } = useBookmarks('CONCEPT', keys);
  const [cards, setCards] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const joined = keys.join(',');
  const reload = () => {
    if (!user || !keys.length) return;
    api.cardState(keys).then((r) => setCards(new Set(r)), () => undefined);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, joined]);
  const makeCard = async (key: string) => {
    if (!user) return navigate('/signin');
    if (cards.has(key) || busy) return;
    setBusy(key);
    setFailed(null);
    try {
      await api.createCard(key);
      setCards((c) => new Set(c).add(key));
    } catch {
      setFailed(key);
    } finally {
      setBusy(null);
    }
  };
  return { marked, cards, busy, failed, bookmark: (key: string) => (user ? toggle(key) : navigate('/signin')), makeCard, reload };
}
export type Concepts = ReturnType<typeof useConcepts>;

/** The two small controls under a concept: bookmark it, and make it a flashcard. */
export function ConceptActions({ id, c }: { id: string; c: Concepts }) {
  const has = c.cards.has(id);
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5" data-concept-actions>
      {c.failed === id && <span className="mr-1 text-xs text-wrong">Could not add the card. Try again.</span>}
      <BookmarkToggle on={c.marked.has(id)} onClick={() => c.bookmark(id)} compact />
      {has ? (
        <Link to="/flashcards" title="This is in your flashcards" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-correct-soft px-2.5 text-[13px] font-medium text-correct ring-1 ring-inset ring-correct/30">
          <Check aria-hidden className="size-4" />
          In my cards
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => c.makeCard(id)}
          disabled={c.busy === id}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
        >
          <Plus aria-hidden className="size-4" />
          {c.busy === id ? 'Adding…' : 'Make flashcard'}
        </button>
      )}
    </div>
  );
}

const IMPORT_CHOICES: { label: string; types?: ConceptType[] }[] = [
  { label: 'Everything' },
  { label: 'Formulas', types: ['FORMULA'] },
  { label: 'Definitions', types: ['DEFINITION'] },
  { label: 'Key points and facts', types: ['KEY_POINT', 'IMPORTANT_FACT', 'CONCEPT'] },
];

/** "Add to my cards": turns the formulas, definitions and key points of a lesson (or of every lesson under a topic) into flashcards. */
export function AddCards({ from, onDone }: { from: { resourceId: string } | { nodeId: string }; onDone?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CardImport | null>(null);
  const [failed, setFailed] = useState(false);
  const run = async (types?: ConceptType[]) => {
    setBusy(true);
    setFailed(false);
    try {
      setResult(await api.importCards(from, types));
      setOpen(false);
      onDone?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="relative inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (user ? (setOpen((o) => !o), setResult(null)) : navigate('/signin'))}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong transition-colors hover:bg-paper hover:text-ink"
      >
        <GalleryVerticalEnd aria-hidden className="size-4" />
        Add to my cards
      </button>
      {open && (
        <span role="group" aria-label="What to add as flashcards" className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface p-1.5 text-[13px] ring-1 ring-inset ring-accent/40">
          {IMPORT_CHOICES.map((ch) => (
            <button key={ch.label} type="button" disabled={busy} onClick={() => run(ch.types)} className="rounded-md px-2.5 py-1 font-medium text-ink ring-1 ring-inset ring-rule hover:bg-accent-soft hover:text-accent disabled:opacity-50">
              {ch.label}
            </button>
          ))}
          {failed && <span className="px-1 text-wrong">Could not add. Try again.</span>}
        </span>
      )}
      {result && (
        <span role="status" className="text-[13px] text-ink-2">
          {result.total === 0
            ? 'Nothing of that kind here.'
            : `${result.added} ${result.added === 1 ? 'card' : 'cards'} added${result.existing ? `, ${result.existing} already in your cards` : ''}${result.notAdded ? `. ${result.notAdded} more can be added next time (up to ${result.limit} at once)` : ''}.`}{' '}
          <Link to="/flashcards" className="font-medium text-accent hover:underline">
            Open my flashcards
          </Link>
        </span>
      )}
    </span>
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
