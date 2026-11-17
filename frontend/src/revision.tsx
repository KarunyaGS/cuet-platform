/**
 * Saved revision cards, as they appear in a list: in My bookmarks, and in the "Saved for revision" section of a lesson
 * or a topic. One card per saved definition, formula, key point or fact. The same card everywhere, so marking it in one
 * place shows in the others.
 */
import { BookOpen, Bookmark, Check, ChevronDown, ChevronRight, CircleCheck, CircleX, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, type CardRating, type Flashcard } from './api';
import { QuestionStem } from './question';
import { DisplayMath, Rich } from './rich';
import { Badge, buttonClass, useAuth } from './ui';

export const CARD_TYPE: Record<string, string> = { QUESTION: 'Question', DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Fact', CONCEPT: 'Concept' };
const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const savedLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const sourceLink = (c: Flashcard) => (c.kind === 'QUESTION' ? (c.topicId ? `/topic/${c.topicId}` : '/') : `/learn/${c.resourceId}#${c.anchor}`);
/** The link under a card: a lesson card goes back to its lesson, a question card to its topic. */
export const sourceLabel = (c: Flashcard, here: boolean, grouped: boolean) => (c.kind === 'QUESTION' ? 'Open the topic' : here ? 'Go to it in this lesson' : grouped ? 'Open in lesson' : `Open in lesson: ${c.lesson}`);
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
          <div className={`text-[15px] leading-snug text-ink ${c.kind === 'QUESTION' ? 'line-clamp-3' : ''}`}>
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
          {c.kind === 'QUESTION' && c.question ? (
            <QuestionBack card={c} />
          ) : (
            <div className="text-[15px] leading-relaxed text-ink">
              {c.latex && <DisplayMath tex={c.latex} />}
              {c.back && <Rich text={c.back} />}
            </div>
          )}
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
        <Link to={sourceLink(c)} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:underline" data-source>
          <BookOpen aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{sourceLabel(c, here, grouped)}</span>
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
export function SavedForRevision({ scope, version = 0, startOpen = false, compact = false, plain = false }: { scope: { resourceId: string } | { nodeId: string }; version?: number; startOpen?: boolean; compact?: boolean; plain?: boolean }) {
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
  // A chapter page: just the student's saved cards from the whole chapter, listed in the page. No count, no fold-away, no "revise" button.
  if (plain) {
    if (cards.length === 0) return null;
    return (
      <section aria-labelledby="saved-for-revision" data-saved-for-revision>
        <h2 id="saved-for-revision" className="text-sm font-semibold text-ink">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-saved-toggle className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 hover:bg-ink/5">
            Saved for revision
            {open ? <ChevronDown aria-hidden className="size-4 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 text-ink-3" />}
          </button>
        </h2>
        {open && (
          <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {sorted.map((c) => (
              <CardRow key={c.id} card={c} here={false} onChange={(next) => setCards((list) => applyChange(list ?? [], c.id, next))} />
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section aria-labelledby="saved-for-revision" data-saved-for-revision className={compact ? 'overflow-hidden rounded-lg bg-ink/[0.035]' : 'overflow-hidden rounded-xl border border-rule bg-surface'}>
      <div className={compact ? 'px-3 py-2' : 'px-4 py-3'}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={cards.length === 0} className="flex w-full items-center gap-2 text-left disabled:cursor-default">
          <Bookmark aria-hidden className={compact ? 'size-4 shrink-0 text-accent' : 'size-[18px] shrink-0 text-accent'} />
          <h2 id="saved-for-revision" className={compact ? 'min-w-0 flex-1 truncate text-[13px] font-medium text-ink' : 'min-w-0 flex-1 truncate text-base font-semibold text-ink'}>
            Saved for revision
          </h2>
          <span className={compact ? 'num shrink-0 rounded-full bg-ink/[0.07] px-1.5 text-xs leading-5 text-ink-2' : 'num shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-sm text-ink-2'} data-saved-count>
            {cards.length}
          </span>
          {cards.length > 0 && (open ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />)}
        </button>
        {cards.length > 0 && (compact ? due > 0 || need > 0 : true) && (
          <div className={compact ? 'mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs' : 'mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm'} data-saved-summary>
            <span className="text-ink-2">
              {(!compact || due > 0) && <>{due} due today</>}
              {need > 0 && <span className="text-wrong">{!compact || due > 0 ? ' · ' : ''}{need} need revision</span>}
            </span>
            {due > 0 && (
              <Link to={`/bookmarks/review?${q}`} className={compact ? 'text-xs font-medium text-accent hover:underline' : buttonClass('primary', 'sm')}>
                Revise {due} due
              </Link>
            )}
          </div>
        )}
      </div>
      {cards.length === 0 ? (
        compact ? null : <p className="border-t border-rule px-4 py-3 text-sm text-ink-2">
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

// ---------------------------------------------------------------- cards made from practice questions

const answerLabel = (c: Flashcard, positions: number[] | null | undefined) => (c.question!.options.filter((o) => positions?.includes(o.position)).map((o) => o.label).join(', ') || 'none');

/** The front of a question card: the question and its four options, with nothing given away. */
export function QuestionFront({ card: c }: { card: Flashcard }) {
  const q = c.question!;
  return (
    <div data-question-front className="text-left">
      {q.passage && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-rule bg-paper p-3 font-serif text-sm leading-relaxed text-ink">
          {q.passage.title && <div className="mb-1 font-sans font-semibold">{q.passage.title}</div>}
          {q.passage.body}
        </div>
      )}
      <QuestionStem stem={q.stem} structure={q.structure} compact />
      <ul className="mt-3 space-y-1.5">
        {q.options.map((o) => (
          <li key={o.position} className="flex items-start gap-2 rounded-lg border border-rule px-3 py-2 text-sm text-ink">
            <span className="font-semibold">{o.label}.</span>
            <span className="min-w-0 flex-1">
              <Rich text={o.text ?? ''} inline />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The back of a question card: the correct answer, the explanation, and what the student answered last time. */
export function QuestionBack({ card: c }: { card: Flashcard }) {
  const q = c.question!;
  const mine = q.yourAnswer;
  return (
    <div data-question-back className="text-left text-[15px] text-ink">
      <QuestionStem stem={q.stem} structure={q.structure} compact />
      <ul className="mt-3 space-y-1.5">
        {q.options.map((o) => {
          const right = q.correctOptionPositions?.includes(o.position);
          const chosen = mine?.selectedPositions?.includes(o.position);
          return (
            <li key={o.position} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${right ? 'border-correct/40 bg-correct-soft' : chosen ? 'border-wrong/40 bg-wrong-soft' : 'border-rule text-ink-2'}`}>
              <span className="font-semibold">{o.label}.</span>
              <span className="min-w-0 flex-1">
                <Rich text={o.text ?? ''} inline />
              </span>
              {right && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-correct"><CircleCheck aria-hidden className="size-4" />Answer</span>}
              {chosen && !right && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-wrong"><CircleX aria-hidden className="size-4" />Your answer</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-ink-2" data-your-answer>
        <span className="font-medium text-ink">Correct answer: </span>
        {answerLabel(c, q.correctOptionPositions)}
        {mine && (
          <>
            <span className="mx-1.5 text-ink-3">·</span>
            <span className="font-medium text-ink">Your answer last time: </span>
            {answerLabel(c, mine.selectedPositions)}
            <span className={mine.outcome === 'CORRECT' ? ' text-correct' : ' text-wrong'}> ({mine.outcome === 'CORRECT' ? 'correct' : 'not correct'})</span>
          </>
        )}
      </p>
      {q.explanation && (
        <div className="mt-3 border-l-2 border-accent pl-3">
          <div className="text-[13px] font-semibold text-ink-2">Explanation</div>
          <Rich text={q.explanation} className="mt-0.5 text-sm leading-relaxed text-ink" />
        </div>
      )}
    </div>
  );
}

/**
 * "Save for revision" under an answered practice question. It makes a revision card in My bookmarks. It is offered only after
 * the answer has been given and its result shown, and the server refuses it otherwise.
 */
export function SaveForRevision({ questionId, compact = false }: { questionId: string; compact?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<'unknown' | 'idle' | 'busy' | 'saved'>('unknown');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    api.questionCardState([questionId]).then(
      (r) => live && setState(r.length ? 'saved' : 'idle'),
      () => live && setState('idle'),
    );
    return () => {
      live = false;
    };
  }, [user, questionId]);
  if (!user || state === 'unknown') return null;
  const save = async () => {
    setState('busy');
    setMsg(null);
    try {
      await api.createQuestionCard(questionId);
      setState('saved');
    } catch (e) {
      setState('idle');
      setMsg((e as { code?: string }).code === 'NOT_ATTEMPTED' ? 'Answer the question first, then you can save it.' : 'That did not work. Try again.');
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-save-for-revision={state}>
      {state === 'saved' ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-correct" role="status">
          <Check aria-hidden className="size-4" />
          Saved for revision
          <Link to="/bookmarks" className="font-medium text-accent hover:underline">
            See it in My bookmarks
          </Link>
        </span>
      ) : (
        <button type="button" onClick={save} disabled={state === 'busy'} className={buttonClass('secondary', compact ? 'sm' : 'md')}>
          <Bookmark aria-hidden />
          Save for revision
        </button>
      )}
      {msg && (
        <span role="status" className="text-sm text-wrong">
          {msg}
        </span>
      )}
    </span>
  );
}
