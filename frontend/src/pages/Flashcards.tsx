import { BookOpen, Check, ChevronDown, ChevronRight, GalleryVerticalEnd, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, type CardRating, type Flashcard } from '../api';
import { DisplayMath, Rich } from '../rich';
import { Badge, Button, ButtonLink, buttonClass, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, Segmented, StatGroup, useAuth, useLoad } from '../ui';

const TYPE: Record<string, string> = { DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Fact', CONCEPT: 'Concept' };
const PROMPT: Record<string, string> = { DEFINITION: 'Define', FORMULA: 'Recall the formula', KEY_POINT: 'Explain', IMPORTANT_FACT: 'Recall', CONCEPT: 'Explain' };

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dueLabel = (c: Flashcard) => (c.due ? (c.stage === 'NEW' ? 'New, due today' : 'Due today') : `Next on ${dayLabel(c.dueOn)}`);
const sourceLink = (c: Flashcard) => `/learn/${c.resourceId}#${c.anchor}`;
const scopeQuery = (paperId?: string | null, chapterId?: string | null, nodeId?: string | null) =>
  nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : paperId ? `?paperId=${encodeURIComponent(paperId)}${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}` : '';
const reviewLink = (paperId?: string | null, chapterId?: string | null, nodeId?: string | null) => `/flashcards/review${scopeQuery(paperId, chapterId, nodeId)}`;

/** My Flashcards: every card the student has made, by subject and chapter, with what is due today. */
export function FlashcardsPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const paperId = params.get('paperId');
  const chapterId = params.get('chapterId');
  // Arriving from a topic page: only that topic's cards.
  const nodeId = params.get('nodeId');
  const [show, setShow] = useState<'ALL' | 'DUE'>(params.get('show') === 'due' ? 'DUE' : 'ALL');
  const summary = useLoad(api.cardSummary, [user?.id]);
  const topic = useLoad(() => (nodeId ? api.topicCards(nodeId) : Promise.resolve(null)), [user?.id, nodeId]);
  const cards = useLoad(() => api.cards({ paperId, chapterId, nodeId, due: show === 'DUE' }), [user?.id, paperId, chapterId, nodeId, show]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (summary.loading && !summary.data) return <Loading />;
  if (summary.error) return <ErrorBox error={summary.error} onRetry={summary.reload} />;
  const s = summary.data!;
  const choose = (p: string | null, ch: string | null) => {
    const next = new URLSearchParams();
    if (p) next.set('paperId', p);
    if (p && ch) next.set('chapterId', ch);
    setParams(next, { replace: true });
  };
  const remove = async (c: Flashcard) => {
    setErr(null);
    try {
      await api.deleteCard(c.id);
      cards.reload();
      summary.reload();
      topic.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  const subject = s.subjects.find((x) => x.paperId === paperId);
  const chapter = subject?.chapters.find((x) => x.chapterId === chapterId);
  const scope = nodeId ? (topic.data ? `Topic: ${topic.data.title}` : 'Topic') : chapter ? chapter.chapter : subject ? subject.paper : 'All subjects';
  const scopeDue = nodeId ? (topic.data?.due ?? 0) : chapter ? chapter.due : subject ? subject.due : s.due;

  return (
    <div>
      <PageHeader
        title="My flashcards"
        subtitle="Cards you made from definitions, formulas and key points. Each card comes back on the day you are likely to need it again."
        actions={
          <>
            <ButtonLink to="/bookmarks?tab=CONCEPT">Saved concepts ({s.savedConcepts})</ButtonLink>
            {s.due > 0 ? (
              <Link to={reviewLink()} className={buttonClass('primary')}>
                Revise {s.due} due {s.due === 1 ? 'card' : 'cards'}
              </Link>
            ) : null}
          </>
        }
      />
      {s.total === 0 ? (
        <Empty
          icon={<GalleryVerticalEnd />}
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/CUET_UG">Browse CUET-UG subjects</ButtonLink>
              <ButtonLink to="/search">Search for a concept</ButtonLink>
            </span>
          }
        >
          You have no flashcards yet. Open a lesson and tap “Make flashcard” under a definition, a formula or a key point, or use “Add to my cards” at the top of a lesson to add them all.
        </Empty>
      ) : (
        <>
          <div className="mb-8">
            <StatGroup
              items={[
                { label: 'Due today', value: s.due, hint: s.due === 0 ? 'Nothing left for today' : 'Ready to revise', tone: s.due === 0 ? 'correct' : undefined },
                { label: 'Revised today', value: s.reviewedToday },
                { label: 'All cards', value: s.total, hint: `${s.fresh} not revised yet` },
                { label: 'Known well', value: s.known, hint: 'Next revision 3 weeks or more away', tone: 'correct' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <section aria-labelledby="fc-subjects">
              <SectionTitle id="fc-subjects">By subject and chapter</SectionTitle>
              <ul className="overflow-hidden rounded-xl border border-rule bg-surface">
                <li>
                  <button type="button" onClick={() => choose(null, null)} aria-pressed={!paperId && !nodeId} className={`flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] transition-colors hover:bg-paper ${!paperId && !nodeId ? 'bg-accent-soft font-semibold text-accent' : 'text-ink'}`}>
                    <span className="min-w-0 flex-1 truncate">All subjects</span>
                    <span className="num text-sm text-ink-2">{s.total}</span>
                  </button>
                </li>
                {s.subjects.map((sub) => {
                  const id = sub.paperId ?? 'none';
                  const expanded = open === id || paperId === sub.paperId;
                  return (
                    <li key={id} className="border-t border-rule">
                      <div className="flex items-stretch">
                        <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} chapters of ${sub.paper}`} onClick={() => setOpen(expanded && open === id ? null : id)} className="grid w-10 shrink-0 place-items-center text-ink-3 hover:bg-paper hover:text-ink">
                          {expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
                        </button>
                        <button type="button" onClick={() => (choose(sub.paperId, null), setOpen(id))} aria-pressed={paperId === sub.paperId && !chapterId} className={`flex min-w-0 flex-1 items-center gap-2 py-3 pr-4 text-left text-[15px] transition-colors hover:bg-paper ${paperId === sub.paperId && !chapterId ? 'font-semibold text-accent' : 'text-ink'}`}>
                          <span className="min-w-0 flex-1 truncate">{sub.paper}</span>
                          {sub.due > 0 && <Badge tone="amber">{sub.due} due</Badge>}
                          <span className="num text-sm text-ink-2">{sub.total}</span>
                        </button>
                      </div>
                      {expanded && (
                        <ul className="border-t border-rule bg-paper/60">
                          {sub.chapters.map((ch) => {
                            const on = paperId === sub.paperId && chapterId === ch.chapterId;
                            return (
                              <li key={ch.chapterId ?? 'none'}>
                                <button type="button" onClick={() => choose(sub.paperId, ch.chapterId)} aria-pressed={on} className={`flex w-full items-center gap-2 py-2.5 pr-4 pl-10 text-left text-sm transition-colors hover:bg-paper ${on ? 'font-semibold text-accent' : 'text-ink-2'}`}>
                                  <span className="min-w-0 flex-1">
                                    <span className="line-clamp-2">{ch.chapter}</span>
                                    <span className="mt-1 block max-w-[10rem]">
                                      <Meter value={ch.total ? Math.round((ch.known / ch.total) * 100) : 0} tone="correct" label={`${ch.known} of ${ch.total} known well`} />
                                    </span>
                                  </span>
                                  {ch.due > 0 && <Badge tone="amber">{ch.due} due</Badge>}
                                  <span className="num text-ink-3">{ch.total}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="fc-cards" className="min-w-0">
              <SectionTitle
                id="fc-cards"
                action={
                  scopeDue > 0 ? (
                    <Link to={reviewLink(paperId, chapterId, nodeId)} className="text-sm font-medium text-accent hover:underline">
                      Revise {scopeDue} due
                    </Link>
                  ) : undefined
                }
              >
                {scope}
              </SectionTitle>
              <div className="mb-4">
                <Segmented label="Which cards to show" value={show} onChange={setShow} options={[{ value: 'ALL', label: 'All cards' }, { value: 'DUE', label: `Due today (${scopeDue})` }]} />
              </div>
              {err && <ErrorBox error={err} />}
              {cards.loading && !cards.data ? (
                <Loading />
              ) : cards.error ? (
                <ErrorBox error={cards.error} onRetry={cards.reload} />
              ) : cards.data!.length === 0 ? (
                <Empty icon={<Check />} action={nodeId && show !== 'DUE' ? <ButtonLink to={`/revise/${nodeId}`}>See this topic’s concepts</ButtonLink> : undefined}>
                  {show === 'DUE' ? 'No cards are due here today.' : nodeId ? 'You have not saved any cards from this topic yet.' : 'No cards here yet.'}
                </Empty>
              ) : (
                <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                  {cards.data!.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
                      <span className="min-w-0 flex-1">
                        {c.type === 'FORMULA' && c.section && c.front !== `Formula: ${c.section}` ? (
                          <>
                            <span className="line-clamp-1 text-[15px] text-ink">{c.section}</span>
                            <span className="mt-0.5 line-clamp-1 text-sm text-ink-2">
                              <Rich text={c.front} inline />
                            </span>
                          </>
                        ) : (
                          <span className="line-clamp-2 text-[15px] text-ink">
                            <Rich text={c.front} inline />
                          </span>
                        )}
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                          <Badge>{TYPE[c.type] ?? c.type}</Badge>
                          <span className={c.due ? 'font-medium text-marker' : ''}>{dueLabel(c)}</span>
                          <Link to={sourceLink(c)} className="inline-flex min-w-0 items-center gap-1 text-accent hover:underline">
                            <BookOpen aria-hidden className="size-3.5 shrink-0" />
                            <span className="truncate">{c.lesson}</span>
                          </Link>
                        </span>
                      </span>
                      <button type="button" onClick={() => remove(c)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-ink-3 transition-colors hover:bg-wrong-soft hover:text-wrong" aria-label={`Remove card: ${c.front.slice(0, 60)}`}>
                        <Trash2 aria-hidden className="size-4" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {cards.data && cards.data.length >= 200 && <p className="mt-3 text-sm text-ink-2">Showing the first 200 cards. Choose a subject or a chapter to see the rest.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
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
  const q = useLoad(() => api.cardQueue({ paperId, chapterId, nodeId }), [user?.id, paperId, chapterId, nodeId]);
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
  const back = `/flashcards${scopeQuery(paperId, chapterId, nodeId)}`;

  if (steps.length === 0)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={{ to: back, label: 'My flashcards' }} title="Revise" />
        <Empty icon={<Check />} action={<ButtonLink to={back}>Back to my flashcards</ButtonLink>}>
          No cards are due today. Cards you add, and cards whose day has come, appear here.
        </Empty>
      </div>
    );

  if (!step)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={{ to: back, label: 'My flashcards' }} title="Done for now" subtitle={`You revised ${total} ${total === 1 ? 'card' : 'cards'}.`} />
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
          <ButtonLink to={back}>My flashcards</ButtonLink>
          <ButtonLink to="/dashboard">Today</ButtonLink>
        </div>
      </div>
    );

  const c = step.card;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ to: back, label: 'My flashcards' }} title="Revise" subtitle={[c.paper, c.chapter].filter(Boolean).join(', ') || undefined} />
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
