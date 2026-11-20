import { Annotatable } from '../annotate';
import { SaveForRevision } from '../revision';
import { ArrowLeft, Bookmark, CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api } from '../api';
import { Figure, QuestionStem } from '../question';
import { Rich } from '../rich';
import { BookmarkToggle, useBookmarks } from '../tools';
import { ButtonLink, Empty, ErrorBox, Loading, PageHeader, Segmented, useLoad } from '../ui';

type Filter = 'all' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED' | 'CREDITED';
const FILTERS = new Set<Filter>(['all', 'CORRECT', 'INCORRECT', 'UNATTEMPTED', 'CREDITED']);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Detailed answer explanations live on their own page so the result summary can stay focused on what to do next. */
export function ResultsReviewPage() {
  const { sessionId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryFilter = FILTERS.has(params.get('filter') as Filter) ? params.get('filter') as Filter : 'all';
  const [filter, setFilter] = useState<Filter>(queryFilter);
  const s = useLoad(() => api.session(sessionId), [sessionId]);
  const ids = useMemo(() => (s.data?.questions ?? []).map((q) => q.id), [s.data]);
  const marks = useLoad(() => (ids.length ? api.annotationsFor('QUESTION', ids) : Promise.resolve([])), [ids.join(',')]);
  const bookmarks = useBookmarks('QUESTION', ids);

  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  if (!d.session.result) return <Empty action={<ButtonLink to={d.session.mode === 'PRACTICE' ? `/practice/${sessionId}` : `/exam/${sessionId}`} kind="primary">Continue the test</ButtonLink>}>This test is still in progress. Answer review will be available after you submit.</Empty>;
  const result = d.session.result;
  const shown = d.questions.filter((q) => filter === 'all' || (q.review?.outcome ?? 'UNATTEMPTED') === filter);
  const chooseFilter = (value: Filter) => {
    setFilter(value);
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('filter'); else next.set('filter', value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Answer review"
        subtitle="See what you chose, the correct answer, and why. Use each explanation to decide what to revise next."
        actions={<ButtonLink to={`/results/${sessionId}`} kind="secondary" icon={<ArrowLeft aria-hidden />}>Back to result summary</ButtonLink>}
      />
      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-surface p-4" aria-label="Answer summary">
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Bookmark className="size-5" /></span>
        <p className="min-w-0 flex-1 text-sm text-ink-2"><strong className="text-ink">{result.incorrect ? `${result.incorrect} to learn from` : 'No incorrect answers this time'}</strong> · {result.correct} correct · {result.unattempted} unanswered. {result.incorrect ? 'Start with the mistakes, then revisit the related topic.' : 'Review any answer to reinforce the concept.'}</p>
        {result.incorrect > 0 && <ButtonLink to={`/results/${sessionId}/review?filter=INCORRECT`} kind="secondary">Show incorrect only</ButtonLink>}
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Question explanations</h2>
        <Segmented
          label="Which answers to show"
          value={filter}
          onChange={chooseFilter}
          options={[
            { value: 'all', label: `All (${d.questions.length})` },
            { value: 'INCORRECT', label: `Wrong (${result.incorrect})` },
            { value: 'UNATTEMPTED', label: `Not answered (${result.unattempted})` },
            { value: 'CORRECT', label: `Correct (${result.correct})` },
            ...(result.credited ? [{ value: 'CREDITED' as const, label: `Credited (${result.credited})` }] : []),
          ]}
        />
      </div>
      {marks.error && <ErrorBox error={marks.error} onRetry={marks.reload} />}
      {shown.length === 0 && <Empty>No questions in this group.</Empty>}
      <ol className="space-y-3" data-answer-review-list>
        {shown.map((q) => {
          const rv = q.review!;
          const correct = rv.outcome === 'CORRECT';
          const wrong = rv.outcome === 'INCORRECT';
          const credited = rv.outcome === 'CREDITED';
          return (
            <li key={q.id} className="overflow-hidden rounded-2xl border border-rule bg-surface" data-answer-outcome={rv.outcome ?? 'UNATTEMPTED'}>
              <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
                <span className="num text-sm font-semibold text-ink">Question {q.number}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${correct || credited ? 'bg-correct-soft text-correct' : wrong ? 'bg-wrong-soft text-wrong' : 'bg-paper text-ink-3'}`}>
                  {correct || credited ? <CircleCheck aria-hidden className="size-4" /> : wrong ? <CircleX aria-hidden className="size-4" /> : <CircleMinus aria-hidden className="size-4" />}
                  {correct ? 'Correct' : wrong ? 'Review this concept' : credited ? 'Credited by marking rule' : 'Not answered'} · {signed(rv.score)} marks
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {rv.outcome !== 'UNATTEMPTED' && <SaveForRevision questionId={q.id} compact />}
                  <BookmarkToggle on={bookmarks.marked.has(q.id)} onClick={() => void bookmarks.toggle(q.id)} compact />
                </span>
              </div>
              <Annotatable kind="QUESTION" id={q.id} preload={marks.data ? marks.data.filter((a) => a.surfaceId === q.id) : null} className="px-4 py-4 sm:px-5">
                {q.passage && <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-rule bg-paper p-3 font-serif text-sm leading-relaxed text-ink">{q.passage.title && <div className="mb-1 font-sans font-semibold">{q.passage.title}</div>}{q.passage.body}</div>}
                <QuestionStem stem={q.stem} structure={q.structure} compact />
                {q.type === 'NUMERICAL' && (
                  <dl className="num mt-3 grid gap-1 text-sm">
                    <div className="flex gap-2"><dt className="text-ink-3">Your answer:</dt><dd className={correct ? 'font-medium text-correct' : 'font-medium text-wrong'}>{q.answer?.numericAnswer ?? 'not answered'}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-3">Correct answer:</dt><dd className="font-medium text-ink">{rv.correctNumericAnswer ?? '–'}</dd></div>
                  </dl>
                )}
                {q.options.length > 0 && <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const right = rv.correctOptionPositions?.includes(o.position);
                    const chosen = q.answer?.selectedPositions?.includes(o.position);
                    return <li key={o.position} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${right ? 'border-correct/40 bg-correct-soft text-ink' : chosen ? 'border-wrong/40 bg-wrong-soft text-ink' : 'border-rule text-ink-2'}`}>
                      <span className="font-semibold">{o.label}.</span>
                      <span className="min-w-0 flex-1">{o.mediaAssetId ? <Figure id={o.mediaAssetId} alt={o.alt || o.text} /> : <Rich text={o.text} inline />}</span>
                      {right && <span className="shrink-0 text-xs font-semibold text-correct">Correct answer</span>}
                      {chosen && !right && <span className="shrink-0 text-xs font-semibold text-wrong">Your answer</span>}
                    </li>;
                  })}
                </ul>}
                {rv.explanation ? <div className="mt-4 rounded-xl border-l-2 border-accent bg-paper/70 px-3.5 py-3"><div className="text-xs font-bold uppercase tracking-wider text-accent">Why this answer</div><Rich text={rv.explanation} className="mt-1 text-sm leading-relaxed text-ink" /></div> : <p className="mt-3 text-sm text-ink-3">No written explanation is available for this question yet.</p>}
              </Annotatable>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
