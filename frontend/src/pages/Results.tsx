import { SaveForRevision } from '../revision';
import { Annotatable } from '../annotate';
import { ChartNoAxesColumn, CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { Figure, QuestionStem } from '../question';
import { Rich } from '../rich';
import { SchemeDetails, signed } from '../marking';
import { BookmarkToggle, useBookmarks } from '../tools';
import { ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, Segmented, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const END_TEXT: Record<string, string> = { TAB_HIDDEN: 'you switched to another tab or window', WINDOW_BLUR: 'the examination window lost focus', FULLSCREEN_EXIT: 'you left full-screen mode', RETURN_TIMEOUT: 'you did not return to full-screen mode in time' };
type Filter = 'all' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED' | 'CREDITED';

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
      <Empty action={<ButtonLink to={d.session.mode === 'PRACTICE' ? `/practice/${sessionId}` : `/exam/${sessionId}`} kind="primary">Continue the test</ButtonLink>}>
        This test is still in progress. Your answers so far are saved.
      </Empty>
    );
  }
  const pct = r.maxScore ? Math.round((100 * r.score) / r.maxScore) : 0;
  const m = d.session.marking;
  const shown = d.questions.filter((q) => filter === 'all' || (q.review?.outcome ?? 'UNATTEMPTED') === filter);
  // Attempted = answered (right or wrong). Not answered questions are never counted as wrong, so they stay out of the accuracy.
  const attempted = r.correct + r.incorrect;
  const scheme = d.session.scheme;
  const simulation = scheme?.kind === 'CUET_SIMULATION';
  const accuracy = attempted ? Math.round((1000 * r.correct) / attempted) / 10 : null;

  return (
    <div>
      <PageHeader
        title={`${MODE[d.session.mode]} result`}
        subtitle={`${simulation ? 'CUET-style simulation' : 'Practice score, not a CUET simulation'} · Submitted ${new Date(r.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={
          <ButtonLink to="/progress" icon={<ChartNoAxesColumn aria-hidden />}>
            Topic-wise progress
          </ButtonLink>
        }
      />

      {d.session.exam && (
        <div role="status" data-exam-confirmation className={`mb-5 rounded-xl border px-4 py-3 text-sm ${d.session.endReason?.startsWith('TERMINATED_') ? 'border-wrong/40 bg-wrong-soft text-wrong' : 'border-correct/30 bg-correct-soft text-correct'}`}>
          {d.session.endReason?.startsWith('TERMINATED_') ? (
            <>
              <strong>Your examination was ended: </strong>
              {END_TEXT[d.session.endReason.replace('TERMINATED_', '')] ?? 'a violation of the examination rules'}. The answers you gave up to that point were saved and scored below.
            </>
          ) : d.session.endReason === 'TIME_UP' ? (
            <>
              <strong>Time is up. </strong>Your test was submitted automatically with the answers you had saved.
            </>
          ) : (
            <>
              <strong>Your test has been submitted. </strong>Your answers were recorded and scored.
            </>
          )}
          {d.session.exam.violations.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-ink-2" data-exam-violations>
              {d.session.exam.violations.map((v, k) => (
                <li key={k}>
                  {new Date(v.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}: {END_TEXT[v.type] ?? v.type}
                  {v.action === 'WARNED' ? ' (warning)' : v.action === 'TERMINATED' ? ' (test ended)' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-label="Score" className="result-reveal grid-cols-1 mb-7 grid overflow-hidden rounded-xl border border-rule bg-surface md:grid-cols-[16rem_minmax(0,1fr)]" data-result-reveal>
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
            {pct}% of the maximum
          </div>
          <div className="num mt-1 text-sm text-ink-2" data-accuracy>
            {accuracy === null ? 'Accuracy: no question was answered' : `Accuracy ${accuracy}% = ${r.correct} correct ÷ ${attempted} answered`}
          </div>
        </div>
        <div className="p-5">
          <dl className="num mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6" data-counts>
            {([['Attempted', r.correct + r.incorrect], ['Not attempted', r.unattempted], ['Correct', r.correct], ['Wrong', r.incorrect], ...(r.credited ? [['Credited', r.credited]] : []), ['Marked for review', r.marked]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-rule px-3 py-2">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {r.correct + r.incorrect === 0 && (
            <p className="mb-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-2" data-empty-attempt>
              {r.credited ? 'No question was answered; the score comes only from credited questions.' : 'No question was answered, so the score is 0 and nothing was lost.'}
            </p>
          )}
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
              {r.credited > 0 && (
                <tr>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2 text-ink">
                      <CircleCheck aria-hidden className="size-4 text-correct" />
                      Credited (question dropped or found wrong)
                    </span>
                  </td>
                  <td className="py-2 text-right text-ink-2">
                    {r.credited} × {signed(m.correct)}
                  </td>
                  <td className="py-2 text-right font-semibold text-correct">{signed(r.credited * m.correct)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-rule-strong">
                <td className="py-2 font-semibold text-ink" colSpan={2}>
                  Total
                </td>
                <td className="py-2 text-right font-semibold text-ink">{r.score}</td>
              </tr>
            </tbody>
          </table>
          <p className="num mt-2 text-xs text-ink-3" data-formula>
            {r.correct} × {m.correct} {m.incorrect < 0 ? '−' : '+'} {r.incorrect} × {Math.abs(m.incorrect)}
            {r.credited ? ` + ${r.credited} × ${m.correct} (credited)` : ''} = {r.score}. Maximum {r.maxScore} = {d.questions.length} questions × {m.correct}.
          </p>
          <details className="mt-3 text-sm text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">Marking scheme used</summary>
            <div className="mt-2">
              <SchemeDetails scheme={scheme} />
            </div>
          </details>
        </div>
      </section>

      {d.session.analysis && (
        <section aria-labelledby="analysis" className="result-reveal result-reveal-later mb-7 rounded-xl border border-rule bg-surface p-5" data-analysis>
          <h2 id="analysis" className="text-base font-semibold text-ink">
            Performance analysis
          </h2>
          <p className="mt-1 text-xs text-ink-3">Units come from each question main syllabus topic, so every question is counted once and the rows add up to the totals above. Acc. = right ÷ (right + wrong).</p>
          {d.session.analysis.timeTakenSeconds !== null && (
            <p className="num mt-1 text-sm text-ink-2">
              Time taken: {Math.floor(d.session.analysis.timeTakenSeconds / 60)} min {d.session.analysis.timeTakenSeconds % 60} s
            </p>
          )}
          {([['By unit', d.session.analysis.byUnit.map((u) => ({ key: u.id, label: u.title, ...u }))], ['By difficulty', d.session.analysis.byDifficulty.map((u) => ({ key: u.difficulty, label: u.difficulty.charAt(0) + u.difficulty.slice(1).toLowerCase(), ...u }))]] as const).map(([title, rows]) =>
            rows.length === 0 ? null : (
              <div key={title} className="mt-4 overflow-x-auto">
                <table className="num w-full text-[13px] sm:text-sm">
                  <caption className="mb-1 text-left text-sm font-medium text-ink">{title}</caption>
                  <thead>
                    <tr className="text-left text-ink-3">
                      <th scope="col" className="py-1 pr-3 font-normal">{title === 'By unit' ? 'Unit' : 'Level'}</th>
                      <th scope="col" className="px-1.5 py-1 text-right font-normal sm:px-2">Right</th>
                      <th scope="col" className="px-1.5 py-1 text-right font-normal sm:px-2">Wrong</th>
                      <th scope="col" className="px-1.5 py-1 text-right font-normal sm:px-2">Skipped</th>
                      {r.credited > 0 && <th scope="col" className="px-1.5 py-1 text-right font-normal sm:px-2">Credited</th>}
                      <th scope="col" className="py-1 pl-1.5 text-right font-normal sm:pl-2" title="Right ÷ (right + wrong). Skipped questions are not counted as wrong.">Acc.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {rows.map((u) => (
                      <tr key={u.key}>
                        <th scope="row" className="max-w-[8rem] py-1.5 pr-2 text-left font-normal text-ink sm:max-w-[16rem] sm:pr-3">{u.label}</th>
                        <td className="px-1.5 py-1.5 text-right sm:px-2 text-correct">{u.correct}</td>
                        <td className="px-1.5 py-1.5 text-right sm:px-2 text-wrong">{u.incorrect}</td>
                        <td className="px-1.5 py-1.5 text-right sm:px-2 text-ink-2">{u.unattempted}</td>
                        {r.credited > 0 && <td className="px-1.5 py-1.5 text-right sm:px-2 text-ink-2">{u.credited}</td>}
                        <td className="py-1.5 pl-1.5 text-right font-medium text-ink sm:pl-2">{u.accuracy === null ? '–' : `${u.accuracy}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          )}
        </section>
      )}

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
            ...(r.credited ? [{ value: 'CREDITED' as const, label: `Credited (${r.credited})` }] : []),
          ]}
        />
      </div>
      {shown.length === 0 && <Empty>No questions in this group.</Empty>}
      <ol className="space-y-3">
        {shown.map((q) => {
          const rv = q.review!;
          const ok = rv.outcome === 'CORRECT';
          const bad = rv.outcome === 'INCORRECT';
          const credited = rv.outcome === 'CREDITED';
          return (
            <li key={q.id} className="overflow-hidden rounded-xl border border-rule bg-surface">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-2.5">
                <span className="num text-sm font-semibold text-ink">Question {q.number}</span>
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${ok || credited ? 'text-correct' : bad ? 'text-wrong' : 'text-ink-3'}`}>
                  {ok || credited ? <CircleCheck aria-hidden className="size-4" /> : bad ? <CircleX aria-hidden className="size-4" /> : <CircleMinus aria-hidden className="size-4" />}
                  {ok ? 'Correct' : bad ? 'Wrong' : credited ? 'Credited (question dropped or found wrong)' : 'Not answered'}
                  <span className="num font-normal text-ink-3">({signed(rv.score)})</span>
                </span>
                <span className="ml-auto flex items-center gap-3">
                  {rv.outcome !== 'UNATTEMPTED' && <SaveForRevision questionId={q.id} compact />}
                  <BookmarkToggle on={bookmarks.marked.has(q.id)} onClick={() => void bookmarks.toggle(q.id)} compact />
                </span>
              </div>
              <Annotatable kind="QUESTION" id={q.id} preload={marks.data ? marks.data.filter((a) => a.surfaceId === q.id) : null} className="px-4 py-4">
                {q.passage && (
                  <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-rule bg-paper p-3 font-serif text-sm leading-relaxed text-ink">
                    {q.passage.title && <div className="mb-1 font-sans font-semibold">{q.passage.title}</div>}
                    {q.passage.body}
                  </div>
                )}
                <div data-annot-block="stem">
                  <QuestionStem stem={q.stem} structure={q.structure} compact />
                </div>
                {q.type === 'NUMERICAL' && (
                  <dl className="num mt-3 grid gap-1 text-sm">
                    <div className="flex gap-2"><dt className="text-ink-3">Your answer:</dt><dd className={rv.outcome === 'CORRECT' ? 'font-medium text-correct' : 'font-medium text-wrong'}>{q.answer?.numericAnswer ?? 'not answered'}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-3">Correct answer:</dt><dd className="font-medium text-ink">{rv.correctNumericAnswer ?? '–'}</dd></div>
                  </dl>
                )}
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
                          {o.mediaAssetId ? <Figure id={o.mediaAssetId} alt={o.alt || o.text} /> : <Rich text={o.text} inline />}
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
