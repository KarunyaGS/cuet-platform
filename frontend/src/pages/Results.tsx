import { Annotatable } from '../annotate';
import { ChartNoAxesColumn, CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { QuestionStem } from '../question';
import { Rich } from '../rich';
import { BookmarkToggle, useBookmarks } from '../tools';
import { ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, Segmented, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
type Filter = 'all' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';

/** Result of a submitted test: the score, how it was built from the marking scheme, and every answer reviewed. */
export function ResultsPage() {
  const { sessionId = '' } = useParams();
  const s = useLoad(() => api.session(sessionId), [sessionId]);
  const [filter, setFilter] = useState<Filter>('all');
  const ids = useMemo(() => (s.data?.questions ?? []).map((q) => q.id), [s.data]);
  // The student's highlights and drawings on these questions, in one request.
  const marks = useLoad(() => (ids.length ? api.annotationsFor('QUESTION', ids) : Promise.resolve([])), [ids.join(',')]);
  const bookmarks = useBookmarks('QUESTION', ids);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const r = d.session.result;
  if (!r) {
    return (
      <Empty action={<ButtonLink to={`/practice/${sessionId}`} kind="primary">Continue the test</ButtonLink>}>
        This test is still in progress. Your answers so far are saved.
      </Empty>
    );
  }
  const pct = r.maxScore ? Math.round((100 * r.score) / r.maxScore) : 0;
  const m = d.session.marking;
  const shown = d.questions.filter((q) => filter === 'all' || q.review?.outcome === filter || (filter === 'UNATTEMPTED' && q.review?.outcome !== 'CORRECT' && q.review?.outcome !== 'INCORRECT'));
  const attempted = r.correct + r.incorrect;

  return (
    <div>
      <PageHeader
        title={`${MODE[d.session.mode]} result`}
        subtitle={`Submitted ${new Date(r.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={
          <ButtonLink to="/progress" icon={<ChartNoAxesColumn aria-hidden />}>
            Topic-wise progress
          </ButtonLink>
        }
      />

      <section aria-label="Score" className="grid-cols-1 mb-10 grid overflow-hidden rounded-xl border border-rule bg-surface md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="border-b border-rule p-5 md:border-r md:border-b-0">
          <div className="text-sm text-ink-2">Score</div>
          <div className="num mt-1 text-4xl font-semibold text-ink">
            {r.score}
            <span className="text-xl font-normal text-ink-3"> / {r.maxScore}</span>
          </div>
          <div className="mt-3">
            <Meter value={pct} tone={pct >= 60 ? 'correct' : pct >= 40 ? 'marker' : 'wrong'} label="Score as a percentage of the maximum" />
          </div>
          <div className="num mt-2 text-sm text-ink-2">
            {pct}% of the maximum{attempted ? `, ${Math.round((100 * r.correct) / attempted)}% of attempted answers correct` : ''}
          </div>
        </div>
        <div className="p-5">
          <div className="mb-2 text-sm text-ink-2">How the score was worked out</div>
          <table className="num w-full text-sm">
            <tbody className="divide-y divide-rule">
              <tr>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <CircleCheck aria-hidden className="size-4 text-correct" />
                    Correct
                  </span>
                </td>
                <td className="py-2 text-right text-ink-2">
                  {r.correct} × {signed(m.correct)}
                </td>
                <td className="w-20 py-2 text-right font-semibold text-correct">{signed(r.correct * m.correct)}</td>
              </tr>
              <tr>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <CircleX aria-hidden className="size-4 text-wrong" />
                    Wrong
                  </span>
                </td>
                <td className="py-2 text-right text-ink-2">
                  {r.incorrect} × {signed(m.incorrect)}
                </td>
                <td className="py-2 text-right font-semibold text-wrong">{signed(r.incorrect * m.incorrect)}</td>
              </tr>
              <tr>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <CircleMinus aria-hidden className="size-4 text-ink-3" />
                    Not answered
                  </span>
                </td>
                <td className="py-2 text-right text-ink-2">{r.unattempted} × 0</td>
                <td className="py-2 text-right font-semibold text-ink-3">0</td>
              </tr>
              <tr className="border-t-2 border-rule-strong">
                <td className="py-2 font-semibold text-ink" colSpan={2}>
                  Total
                </td>
                <td className="py-2 text-right font-semibold text-ink">{r.score}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Answer review</h2>
        <Segmented
          label="Which answers to show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${d.questions.length})` },
            { value: 'INCORRECT', label: `Wrong (${r.incorrect})` },
            { value: 'UNATTEMPTED', label: `Not answered (${r.unattempted})` },
            { value: 'CORRECT', label: `Correct (${r.correct})` },
          ]}
        />
      </div>
      {shown.length === 0 && <Empty>No questions in this group.</Empty>}
      <ol className="space-y-3">
        {shown.map((q) => {
          const rv = q.review!;
          const ok = rv.outcome === 'CORRECT';
          const bad = rv.outcome === 'INCORRECT';
          return (
            <li key={q.id} className="overflow-hidden rounded-xl border border-rule bg-surface">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-2.5">
                <span className="num text-sm font-semibold text-ink">Question {q.number}</span>
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${ok ? 'text-correct' : bad ? 'text-wrong' : 'text-ink-3'}`}>
                  {ok ? <CircleCheck aria-hidden className="size-4" /> : bad ? <CircleX aria-hidden className="size-4" /> : <CircleMinus aria-hidden className="size-4" />}
                  {ok ? 'Correct' : bad ? 'Wrong' : 'Not answered'}
                  <span className="num font-normal text-ink-3">({signed(rv.score)})</span>
                </span>
                <span className="ml-auto">
                  <BookmarkToggle on={bookmarks.marked.has(q.id)} onClick={() => void bookmarks.toggle(q.id)} compact />
                </span>
              </div>
              <Annotatable kind="QUESTION" id={q.id} preload={marks.data ? marks.data.filter((a) => a.surfaceId === q.id) : null} className="px-4 py-4">
                <div data-annot-block="stem">
                  <QuestionStem stem={q.stem} structure={q.structure} compact />
                </div>
                <ul className="grid-cols-1 mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const right = rv.correctOptionPositions?.includes(o.position);
                    const chosen = q.answer?.selectedPositions?.includes(o.position);
                    return (
                      <li
                        key={o.position}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${right ? 'border-correct/40 bg-correct-soft text-ink' : chosen ? 'border-wrong/40 bg-wrong-soft text-ink' : 'border-rule text-ink-2'}`}
                      >
                        <span className="font-semibold">{o.label}.</span>
                        <span className="min-w-0 flex-1" data-annot-block={`opt-${o.position}`}>
                          <Rich text={o.text} inline />
                        </span>
                        {right && <span className="shrink-0 text-xs font-medium text-correct">Answer</span>}
                        {chosen && !right && <span className="shrink-0 text-xs font-medium text-wrong">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
                {rv.explanation && (
                  <div className="mt-3 border-l-2 border-accent pl-3">
                    <div className="text-[13px] font-semibold text-ink-2">Explanation</div>
                    <div data-annot-block="explanation">
                      <Rich text={rv.explanation} className="mt-0.5 text-sm leading-relaxed text-ink" />
                    </div>
                  </div>
                )}
              </Annotatable>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
