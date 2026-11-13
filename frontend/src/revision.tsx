/**
 * Saved revision cards, as they appear in a list: in My bookmarks, and in the "Saved for revision" section of a lesson
 * or a topic. One card per saved definition, formula, key point or fact. The same card everywhere, so marking it in one
 * place shows in the others.
 */
import { BookOpen, Bookmark, ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, type CardRating, type Flashcard } from './api';
import { DisplayMath, Rich } from './rich';
import { Badge, buttonClass, useAuth } from './ui';

export const CARD_TYPE: Record<string, string> = { DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Fact', CONCEPT: 'Concept' };
const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const savedLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const sourceLink = (c: Flashcard) => `/learn/${c.resourceId}#${c.anchor}`;
/** What a card asks: for a formula, its name; otherwise the term or the point itself. */
export const cardTitle = (c: Flashcard) => (c.type === 'FORMULA' && c.section && c.front !== `Formula: ${c.section}` ? c.section : c.front);

export function StatusBadge({ c }: { c: Flashcard }) {
  if (c.status === 'NEED_REVISION') return <Badge tone="red">Need revision</Badge>;
  if (c.status === 'KNOW') return <Badge tone="green">Know</Badge>;
  return <Badge>New</Badge>;
}

/**
 * One saved card. "Show answer" turns it over in place; then the student says Know or Need revision. Removing a card
 * that has been revised asks first. `onChange` gets the card as it now stands, or null when it was removed.
 */
export function CardRow({ card: c, onChange, here = false, grouped = false }: { card: Flashcard; onChange: (next: Flashcard | null) => void; here?: boolean; grouped?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const mark = async (rating: CardRating) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const next = await api.reviewCard(c.id, rating, !c.due);
      onChange(next);
      setMsg({ text: rating === 'AGAIN' ? 'Marked Need revision. It comes back tomorrow.' : next.due ? 'Marked Know.' : `Marked Know. Next revision on ${dayLabel(next.dueOn)}.` });
      setOpen(false);
    } catch {
      setMsg({ text: 'That did not work. Try again.', bad: true });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (confirmed: boolean) => {
    if (c.lastReviewedAt !== null && !confirmed) return setAsking(true);
    setBusy(true);
    try {
      await api.deleteCard(c.id, confirmed);
      onChange(null);
    } catch (e) {
      if ((e as { code?: string }).code === 'HAS_REVIEW_HISTORY') setAsking(true);
      else setMsg({ text: 'Could not remove it. Try again.', bad: true });
    } finally {
      setBusy(false);
    }
  };
  const title = cardTitle(c);
  return (
    <li className="px-4 py-3" data-card-row={c.id} data-status={c.status}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-[12rem] flex-1">
          <div className="text-[15px] leading-snug text-ink">
            <Rich text={title} inline />
          </div>
          {title !== c.front && (
            <div className="mt-0.5 line-clamp-1 text-sm text-ink-2">
              <Rich text={c.front} inline />
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <Badge>{CARD_TYPE[c.type] ?? c.type}</Badge>
            <StatusBadge c={c} />
            <span className={c.due ? 'font-medium text-marker' : ''}>{c.due ? 'Due today' : `Next on ${dayLabel(c.dueOn)}`}</span>
            <span>Saved {savedLabel(c.savedAt)}</span>
          </div>
        </div>
        <button type="button" onClick={() => (setOpen((o) => !o), setMsg(null))} aria-expanded={open} data-flip className={`${buttonClass('secondary', 'sm')} shrink-0`}>
          <RotateCcw aria-hidden className="size-3.5" />
          {open ? 'Hide answer' : 'Show answer'}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-lg bg-paper p-4" data-card-back>
          <div className="text-[15px] leading-relaxed text-ink">
            {c.latex && <DisplayMath tex={c.latex} />}
            {c.back && <Rich text={c.back} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => mark('AGAIN')} className="h-9 rounded-lg bg-wrong-soft px-3 text-sm font-semibold text-wrong ring-1 ring-inset ring-wrong/30 hover:bg-wrong/15 disabled:opacity-60">
              Need revision
            </button>
            <button type="button" disabled={busy} onClick={() => mark('GOOD')} className="h-9 rounded-lg bg-correct-soft px-3 text-sm font-semibold text-correct ring-1 ring-inset ring-correct/30 hover:bg-correct/15 disabled:opacity-60">
              Know
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
        <Link to={sourceLink(c)} className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:underline" data-source>
          <BookOpen aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{here ? 'Go to it in this lesson' : grouped ? 'Open in lesson' : `Open in lesson: ${c.lesson}`}</span>
        </Link>
        {msg && (
          <span role="status" className={msg.bad ? 'text-wrong' : 'text-ink-2'}>
            {msg.text}
          </span>
        )}
        <span className="ml-auto">
          {asking ? (
            <span role="alertdialog" aria-label="Remove this saved card?" className="flex flex-wrap items-center justify-end gap-1.5 text-ink">
              <span>You have revised this card. Removing it also removes its revision progress.</span>
              <button type="button" onClick={() => remove(true)} disabled={busy} className="rounded-md bg-surface px-2 py-0.5 font-medium text-wrong ring-1 ring-inset ring-wrong/30 hover:bg-wrong-soft">
                Remove
              </button>
              <button type="button" onClick={() => setAsking(false)} className="rounded-md bg-surface px-2 py-0.5 font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper">
                Keep
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => remove(false)} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-3 hover:bg-wrong-soft hover:text-wrong" aria-label={`Remove from bookmarks: ${title.slice(0, 60)}`}>
              <Trash2 aria-hidden className="size-3.5" />
              Remove
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

/** Replaces one card in a list with its new state, or drops it when it was removed. */
export const applyChange = (list: Flashcard[], id: string, next: Flashcard | null) => (next ? list.map((c) => (c.id === id ? next : c)) : list.filter((c) => c.id !== id));

/**
 * "Saved for revision" on a lesson or a topic page: the student's saved cards from that lesson (or from every lesson
 * under that topic), revisable right there. `version` changes when the page saves or unsaves something, to reload.
 */
export function SavedForRevision({ scope, version = 0, startOpen = false }: { scope: { resourceId: string } | { nodeId: string }; version?: number; startOpen?: boolean }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [open, setOpen] = useState(startOpen);
  const lesson = 'resourceId' in scope ? scope.resourceId : null;
  const node = 'nodeId' in scope ? scope.nodeId : null;
  useEffect(() => {
    if (!user) return;
    let live = true;
    api.cards(lesson ? { resourceId: lesson, limit: 300 } : { nodeId: node, limit: 300 }).then((r) => live && setCards(r), () => undefined);
    return () => {
      live = false;
    };
  }, [user, lesson, node, version]);
  if (!user || !cards) return null;
  const due = cards.filter((c) => c.due).length;
  const need = cards.filter((c) => c.status === 'NEED_REVISION').length;
  const q = lesson ? `resourceId=${encodeURIComponent(lesson)}` : `nodeId=${encodeURIComponent(node!)}`;
  // Cards needing revision first, then those due today, then the rest.
  const rank = (c: Flashcard) => (c.status === 'NEED_REVISION' ? 0 : c.due ? 1 : 2);
  const sorted = [...cards].sort((a, b) => rank(a) - rank(b));
  return (
    <section aria-labelledby="saved-for-revision" data-saved-for-revision className="overflow-hidden rounded-xl border border-rule bg-surface">
      <div className="px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={cards.length === 0} className="flex w-full items-center gap-2 text-left disabled:cursor-default">
          <Bookmark aria-hidden className="size-[18px] shrink-0 text-accent" />
          <h2 id="saved-for-revision" className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
            Saved for revision
          </h2>
          <span className="num shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-sm text-ink-2" data-saved-count>
            {cards.length}
          </span>
          {cards.length > 0 && (open ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />)}
        </button>
        {cards.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm" data-saved-summary>
            <span className="text-ink-2">
              {due} due today{need > 0 && <span className="text-wrong"> · {need} need revision</span>}
            </span>
            {due > 0 && (
              <Link to={`/bookmarks/review?${q}`} className={buttonClass('primary', 'sm')}>
                Revise {due} due
              </Link>
            )}
          </div>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="border-t border-rule px-4 py-3 text-sm text-ink-2">
          Nothing saved from here yet. Tap the bookmark icon under a definition, a formula or a key point{lesson ? ' below' : ' in a lesson'}. It is saved as a revision card.
        </p>
      ) : (
        open && (
          <>
            <ul className="divide-y divide-rule border-t border-rule">
              {sorted.map((c) => (
                <CardRow key={c.id} card={c} here={Boolean(lesson)} onChange={(next) => setCards((list) => applyChange(list ?? [], c.id, next))} />
              ))}
            </ul>
            <p className="border-t border-rule px-4 py-2.5 text-[13px] text-ink-2">
              The same cards are in{' '}
              <Link to={lesson ? '/bookmarks' : `/bookmarks?${q}`} className="font-medium text-accent hover:underline">
                My bookmarks
              </Link>
              . What you mark here shows there too.
            </p>
          </>
        )
      )}
    </section>
  );
}
