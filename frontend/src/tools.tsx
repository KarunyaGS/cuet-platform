/** Small student tools shared by several pages: bookmarking, adding to the study plan and recording what was opened. */
import { Bookmark, CalendarCheck2, CalendarPlus, GalleryVerticalEnd, X } from 'lucide-react';
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
 * For the concepts shown on a page (single definitions, formulas, key points and facts): which ones the student has
 * saved. Saving a concept makes its flashcard, and that card is the saved item: there is no separate bookmark. Unsaving
 * removes the card; if the card has been revised, the student is asked first, so progress is never lost by a stray tap.
 */
export function useConcepts(keys: string[]) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Map<string, { id: string; reviewed: boolean }>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; kind: 'saved' | 'removed' | 'error' | 'confirm' } | null>(null);
  const joined = keys.join(',');
  const reload = () => {
    if (!user || !keys.length) return;
    api.cardState(keys).then((r) => setSaved(new Map(r.map((x) => [x.conceptKey, { id: x.id, reviewed: x.reviewed }]))), () => undefined);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, joined]);
  const save = async (key: string) => {
    setBusy(key);
    try {
      const r = await api.createCard(key);
      setSaved((m) => new Map(m).set(key, { id: r.card.id, reviewed: r.card.lastReviewedAt !== null }));
      setNote({ key, kind: 'saved' });
    } catch {
      setNote({ key, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const remove = async (key: string, confirmed: boolean) => {
    const card = saved.get(key);
    if (!card) return;
    if (card.reviewed && !confirmed) return setNote({ key, kind: 'confirm' });
    setBusy(key);
    try {
      await api.deleteCard(card.id, confirmed);
      setSaved((m) => {
        const n = new Map(m);
        n.delete(key);
        return n;
      });
      setNote({ key, kind: 'removed' });
    } catch (e) {
      // The card was revised somewhere else in the meantime: ask before removing it.
      if ((e as { code?: string }).code === 'HAS_REVIEW_HISTORY') {
        setSaved((m) => new Map(m).set(key, { ...card, reviewed: true }));
        setNote({ key, kind: 'confirm' });
      } else setNote({ key, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const toggle = (key: string) => {
    if (!user) return navigate('/signin');
    if (busy) return;
    return saved.has(key) ? remove(key, false) : save(key);
  };
  return { saved, busy, note, toggle, confirmRemove: (key: string) => remove(key, true), dismiss: () => setNote(null), reload };
}
export type Concepts = ReturnType<typeof useConcepts>;

/** The control under a concept: the bookmark icon. On = this concept is one of the student's flashcards. */
export function ConceptActions({ id, c }: { id: string; c: Concepts }) {
  const on = c.saved.has(id);
  const note = c.note?.key === id ? c.note.kind : null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5" data-concept-actions>
      {note === 'confirm' ? (
        <span role="alertdialog" aria-label="Remove this saved card?" className="flex flex-wrap items-center justify-end gap-1.5 rounded-lg bg-marker-soft px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-inset ring-marker/30">
          <span>You have revised this card. Removing it also removes its revision progress.</span>
          <button type="button" onClick={() => c.confirmRemove(id)} disabled={c.busy === id} className="rounded-md bg-surface px-2 py-0.5 font-medium text-wrong ring-1 ring-inset ring-wrong/30 hover:bg-wrong-soft disabled:opacity-60">
            Remove card
          </button>
          <button type="button" onClick={c.dismiss} className="rounded-md bg-surface px-2 py-0.5 font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper">
            Keep
          </button>
        </span>
      ) : (
        <span role="status" className="text-[13px] text-ink-2">
          {note === 'saved' && (
            <>
              Saved to{' '}
              <Link to="/bookmarks" className="font-medium text-accent hover:underline">
                My bookmarks
              </Link>
            </>
          )}
          {note === 'removed' && 'Removed from your bookmarks'}
          {note === 'error' && <span className="text-wrong">That did not work. Try again.</span>}
        </span>
      )}
      <button
        type="button"
        onClick={() => c.toggle(id)}
        disabled={c.busy === id}
        aria-pressed={on}
        title={on ? 'Saved to bookmarks. Tap to remove.' : 'Save to bookmarks'}
        aria-label={on ? 'Saved to bookmarks. Remove' : 'Save to bookmarks'}
        className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-60 ${
          on ? 'bg-marker-soft text-marker ring-1 ring-inset ring-marker/30' : 'bg-surface text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper hover:text-ink'
        }`}
      >
        <Bookmark aria-hidden className="size-4" fill={on ? 'currentColor' : 'none'} />
      </button>
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
        Save all for revision
      </button>
      {open && (
        <span role="group" aria-label="What to save for revision" className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface p-1.5 text-[13px] ring-1 ring-inset ring-accent/40">
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
            : `${result.added} ${result.added === 1 ? 'card' : 'cards'} saved${result.existing ? `, ${result.existing} already in your bookmarks` : ''}${result.notAdded ? `. ${result.notAdded} more can be added next time (up to ${result.limit} at once)` : ''}.`}{' '}
          <Link to="/bookmarks" className="font-medium text-accent hover:underline">
            Open My bookmarks
          </Link>
        </span>
      )}
    </span>
  );
}

const countLink = 'group flex min-w-0 flex-1 flex-col px-4 py-3 transition-colors hover:bg-paper';
function Count({ to, label, value, hint, tone }: { to: string; label: string; value: number; hint: string; tone?: boolean }) {
  return (
    <Link to={to} className={countLink}>
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className={`num mt-0.5 text-xl font-semibold ${tone ? 'text-marker' : 'text-ink'}`}>{value}</span>
      <span className="mt-0.5 text-xs text-accent group-hover:underline">{hint}</span>
    </Link>
  );
}

/** Subject page: the student's flashcards from this subject, and how many are due today. Read fresh every time the page opens. */
export function SubjectCards({ paperId }: { paperId: string }) {
  const { user } = useAuth();
  const [d, setD] = useState<{ total: number; due: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    api.cardSummary().then(
      (s) => {
        const mine = s.subjects.find((x) => x.paperId === paperId);
        if (live) setD({ total: mine?.total ?? 0, due: mine?.due ?? 0 });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [user, paperId]);
  if (!user || !d) return null;
  const to = `/bookmarks?paperId=${encodeURIComponent(paperId)}`;
  return (
    <section aria-label="Your saved revision cards from this subject" data-cards="subject" className="mb-6 overflow-hidden rounded-xl border border-rule bg-surface">
      {d.total === 0 ? (
        <p className="flex items-start gap-2.5 px-4 py-3 text-sm text-ink-2">
          <GalleryVerticalEnd aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <span>
            Nothing saved from this subject yet. Open a lesson and tap the bookmark icon under a definition or a formula.{' '}
            <Link to="/bookmarks" className="font-medium text-accent hover:underline">
              My bookmarks
            </Link>
          </span>
        </p>
      ) : (
        <div className="flex divide-x divide-rule">
          <Count to={to} label="Saved for revision" value={d.total} hint="Open in My bookmarks" />
          <Count to={`${to}&show=due`} label="Due today" value={d.due} hint={d.due > 0 ? 'See what is due' : 'Nothing due today'} tone={d.due > 0} />
        </div>
      )}
    </section>
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
