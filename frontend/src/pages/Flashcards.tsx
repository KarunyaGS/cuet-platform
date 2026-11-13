import { BookOpen, Check, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, type CardRating, type Flashcard } from '../api';
import { DisplayMath, Rich } from '../rich';
import { Button, ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, StatGroup, useAuth, useLoad } from '../ui';

const PROMPT: Record<string, string> = { DEFINITION: 'Define', FORMULA: 'Recall the formula', KEY_POINT: 'Explain', IMPORTANT_FACT: 'Recall', CONCEPT: 'Explain' };

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const sourceLink = (c: Flashcard) => `/learn/${c.resourceId}#${c.anchor}`;
const scopeQuery = (paperId?: string | null, chapterId?: string | null, nodeId?: string | null, resourceId?: string | null) =>
  resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : paperId ? `?paperId=${encodeURIComponent(paperId)}${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}` : '';

/** Old "/flashcards" addresses lead to My bookmarks, keeping the subject, chapter or topic they named. */
export function OldFlashcardsLink({ to }: { to: string }) {
  const [params] = useSearchParams();
  const q = params.toString();
  return <Navigate to={`${to}${q ? `?${q}` : ''}`} replace />;
}

/** One side of a card. Both sides sit in the same grid cell, so the card keeps one height while it turns. */
function Face({ side, hidden, children }: { side: 'front' | 'back'; hidden: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={hidden}
      data-face={side}
      className={`col-start-1 row-start-1 flex min-h-[16rem] flex-col rounded-2xl border border-rule bg-surface p-6 shadow-sm [backface-visibility:hidden] sm:min-h-[18rem] sm:p-8 ${side === 'back' ? '[transform:rotateY(180deg)]' : ''}`}
    >
      {children}
    </div>
  );
}

interface Step {
  card: Flashcard;
  /** A card marked "Need revision" comes round once more in the same sitting; that second look is not counted. */
  again: boolean;
}

/** The revision sitting: today's due cards one at a time. Flip, then say whether you knew it. */
export function FlashcardReviewPage() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  const paperId = params.get('paperId');
  const chapterId = params.get('chapterId');
  const nodeId = params.get('nodeId');
  const resourceId = params.get('resourceId');
  const q = useLoad(() => api.cardQueue({ paperId, chapterId, nodeId, resourceId }), [user?.id, paperId, chapterId, nodeId, resourceId]);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [tally, setTally] = useState({ know: 0, revise: 0 });
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    if (q.data && steps === null) setSteps(q.data.cards.map((card) => ({ card, again: false })));
  }, [q.data, steps]);
  const step = steps?.[at];
  const total = useMemo(() => (steps ?? []).filter((x) => !x.again).length, [steps]);
  const done = useMemo(() => (steps ?? []).slice(0, at).filter((x) => !x.again).length, [steps, at]);

  const answer = useCallback(
    async (rating: CardRating) => {
      if (!step || busy) return;
      setErr(null);
      if (step.again) {
        // Second look in the same sitting: nothing is recorded. Still unsure? It comes round again.
        if (rating === 'AGAIN') setSteps((s) => [...(s ?? []), { card: step.card, again: true }]);
        setFlipped(false);
        setAt((n) => n + 1);
        return;
      }
      setBusy(true);
      try {
        const next = await api.reviewCard(step.card.id, rating);
        setTally((t) => (rating === 'AGAIN' ? { ...t, revise: t.revise + 1 } : { ...t, know: t.know + 1 }));
        setLast(rating === 'AGAIN' ? 'You will see it again in a moment, and tomorrow.' : `Next revision on ${dayLabel(next.dueOn)}.`);
        if (rating === 'AGAIN') setSteps((s) => [...(s ?? []), { card: step.card, again: true }]);
        setFlipped(false);
        setAt((n) => n + 1);
      } catch (e) {
        setErr(e as Error);
      } finally {
        setBusy(false);
      }
    },
    [step, busy],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName) && e.key !== '1' && e.key !== '2') return;
      if (!step) return;
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && e.key === '1') answer('AGAIN');
      else if (flipped && e.key === '2') answer('GOOD');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, flipped, answer]);

  if (ready && !user) return <Navigate to="/signin" replace />;
  if (q.loading || steps === null) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  // From a lesson, "back" returns to it; otherwise to My bookmarks.
  const back = resourceId ? `/learn/${resourceId}` : `/bookmarks${scopeQuery(paperId, chapterId, nodeId)}`;
  const backLabel = resourceId ? 'Back to the lesson' : 'My bookmarks';

  if (steps.length === 0)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={{ to: back, label: backLabel }} title="Revise" />
        <Empty icon={<Check />} action={<ButtonLink to={back}>{backLabel}</ButtonLink>}>
          No saved cards are due today. Cards you save, and cards whose day has come, appear here.
        </Empty>
      </div>
    );

  if (!step)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={{ to: back, label: backLabel }} title="Done for now" subtitle={`You revised ${total} ${total === 1 ? 'card' : 'cards'}.`} />
        <StatGroup
          items={[
            { label: 'Knew', value: tally.know, tone: 'correct' },
            { label: 'Need revision', value: tally.revise, hint: tally.revise ? 'These come back tomorrow' : undefined, tone: tally.revise ? 'wrong' : 'muted' },
          ]}
        />
        {q.data!.due > q.data!.cards.length && <p className="mt-4 text-sm text-ink-2">{q.data!.due - q.data!.cards.length} more cards are due today.</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {q.data!.due > q.data!.cards.length && (
            <Button
              onClick={() => {
                setSteps(null);
                setAt(0);
                setTally({ know: 0, revise: 0 });
                q.reload();
              }}
            >
              Revise more
            </Button>
          )}
          <ButtonLink to={back}>{backLabel}</ButtonLink>
          <ButtonLink to="/dashboard">Today</ButtonLink>
        </div>
      </div>
    );

  const c = step.card;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ to: back, label: backLabel }} title="Revise" subtitle={[c.paper, c.chapter].filter(Boolean).join(', ') || undefined} />
      <div className="mb-4">
        <div className="num mb-1.5 flex items-center justify-between text-sm text-ink-2">
          <span>{step.again ? 'One more look' : `Card ${Math.min(done + 1, total)} of ${total}`}</span>
          {last && <span role="status">{last}</span>}
        </div>
        <Meter value={total ? Math.round((done / total) * 100) : 0} label={`${done} of ${total} cards revised`} />
      </div>

      <div className="[perspective:1400px]">
        <div data-card data-flipped={flipped ? '' : undefined} className={`grid transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
          <Face side="front" hidden={flipped}>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-2">
              <span>{PROMPT[c.type] ?? 'Recall'}</span>
              {c.section && c.type !== 'FORMULA' && <span className="font-normal text-ink-3">{c.section}</span>}
            </div>
            {c.type === 'FORMULA' && c.section && c.front !== `Formula: ${c.section}` ? (
              <div className="my-auto text-center">
                <div className="text-xl leading-snug font-semibold text-ink sm:text-2xl">{c.section}</div>
                <div className="mt-3 text-[15px] leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">Where: </span>
                  <Rich text={c.front} inline />
                </div>
              </div>
            ) : (
              <div className="my-auto text-center text-xl leading-snug font-semibold text-ink sm:text-2xl">
                <Rich text={c.front} />
              </div>
            )}
          </Face>
          <Face side="back" hidden={!flipped}>
            <div className="mb-3 text-[13px] font-semibold text-ink-2">
              <Rich text={c.type === 'FORMULA' ? (c.section ?? 'Formula') : c.front} inline />
            </div>
            <div className="my-auto text-[17px] leading-relaxed text-ink">
              {c.latex && <DisplayMath tex={c.latex} />}
              {c.back && <Rich text={c.back} />}
            </div>
            <Link to={sourceLink(c)} tabIndex={flipped ? 0 : -1} className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline">
              <BookOpen aria-hidden className="size-4 shrink-0" />
              <span className="line-clamp-1">Open in lesson: {c.lesson}</span>
            </Link>
          </Face>
        </div>
      </div>

      {err && <ErrorBox error={err} />}
      <div className="mt-5">
        {!flipped ? (
          <Button onClick={() => setFlipped(true)} icon={<RotateCcw aria-hidden />}>
            Show answer
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => answer('AGAIN')} className="h-12 rounded-xl bg-wrong-soft px-3 text-[15px] font-semibold text-wrong ring-1 ring-inset ring-wrong/30 transition-colors hover:bg-wrong/15 disabled:opacity-60">
              Need revision
            </button>
            <button type="button" disabled={busy} onClick={() => answer('GOOD')} className="h-12 rounded-xl bg-correct-soft px-3 text-[15px] font-semibold text-correct ring-1 ring-inset ring-correct/30 transition-colors hover:bg-correct/15 disabled:opacity-60">
              Know
            </button>
          </div>
        )}
        <p className="mt-3 hidden text-xs text-ink-3 sm:block">{flipped ? 'Keys: 1 for Need revision, 2 for Know.' : 'Key: Space to show the answer.'}</p>
      </div>
    </div>
  );
}
