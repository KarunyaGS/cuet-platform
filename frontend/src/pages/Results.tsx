import { ArrowRight, ArrowUpRight, BookOpenCheck, ChartNoAxesColumn, CircleCheck, CircleMinus, CircleX, Sparkles, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { SchemeDetails, signed } from '../marking';
import { ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const END_TEXT: Record<string, string> = { TAB_HIDDEN: 'you switched to another tab or window', WINDOW_BLUR: 'the examination window lost focus', FULLSCREEN_EXIT: 'you left full-screen mode', RETURN_TIMEOUT: 'you did not return to full-screen mode in time' };

/** Action-first result summary, with next steps generated from the submitted attempt's real unit and difficulty data. */
export function ResultsPage() {
  const { sessionId = '' } = useParams();
  const s = useLoad(() => api.session(sessionId), [sessionId]);
  const [focusUnitId, setFocusUnitId] = useState<string | null>(null);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const r = d.session.result;
  if (!r) return <Empty action={<ButtonLink to={d.session.mode === 'PRACTICE' ? `/practice/${sessionId}` : `/exam/${sessionId}`} kind="primary">Continue the test</ButtonLink>}>This test is still in progress. Your answers so far are saved.</Empty>;

  const pct = r.maxScore ? Math.round((100 * r.score) / r.maxScore) : 0;
  const marking = d.session.marking;
  const scheme = d.session.scheme;
  const simulation = scheme?.kind === 'CUET_SIMULATION';
  const attempted = r.correct + r.incorrect;
  const accuracy = attempted ? Math.round((1000 * r.correct) / attempted) / 10 : null;
  const units = d.session.analysis?.byUnit ?? [];
  const attemptedUnits = units.filter((u) => u.correct + u.incorrect > 0 && u.accuracy !== null);
  const weakest = [...attemptedUnits].sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))[0];
  const strongest = [...attemptedUnits].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];
  const focusUnit = units.find((u) => u.id === focusUnitId) ?? weakest ?? units[0];
  const focusAttempts = focusUnit ? focusUnit.correct + focusUnit.incorrect : 0;
  const improvementPerWrong = Math.max(0, marking.correct - marking.incorrect);
  const possibleFutureGain = r.incorrect * improvementPerWrong;
  const greeting = pct >= 80 ? 'Excellent momentum' : pct >= 60 ? 'A solid base to build on' : pct >= 40 ? 'You have clear next steps' : 'Let’s turn this attempt into a plan';
  const stats: { Icon: LucideIcon; label: string; value: number; tone: string }[] = [
    { Icon: CircleCheck, label: 'Correct', value: r.correct, tone: 'text-correct' },
    { Icon: CircleX, label: 'Wrong', value: r.incorrect, tone: 'text-wrong' },
    { Icon: CircleMinus, label: 'Not answered', value: r.unattempted, tone: 'text-ink-3' },
    ...(r.credited ? [{ Icon: CircleCheck, label: 'Credited', value: r.credited, tone: 'text-correct' }] : []),
  ];

  return (
    <div className="mx-auto max-w-[76rem]" data-result-summary>
      <PageHeader
        title={`${MODE[d.session.mode]} result`}
        subtitle={`${simulation ? 'CUET-style simulation' : 'Practice score, not a CUET simulation'} · Submitted ${new Date(r.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={<ButtonLink to="/progress" icon={<ChartNoAxesColumn aria-hidden />}>Topic-wise progress</ButtonLink>}
      />

      {d.session.exam && <div role="status" data-exam-confirmation className={`mb-4 rounded-xl border px-4 py-3 text-sm ${d.session.endReason?.startsWith('TERMINATED_') ? 'border-wrong/40 bg-wrong-soft text-wrong' : 'border-correct/30 bg-correct-soft text-correct'}`}>
        {d.session.endReason?.startsWith('TERMINATED_') ? <><strong>Your examination was ended: </strong>{END_TEXT[d.session.endReason.replace('TERMINATED_', '')] ?? 'a violation of the examination rules'}. Your saved answers were scored below.</> : d.session.endReason === 'TIME_UP' ? <><strong>Time is up. </strong>Your saved answers were submitted automatically.</> : <><strong>Your test has been submitted. </strong>Your answers were recorded and scored.</>}
        {d.session.exam.violations.length > 0 && <ul className="mt-2 list-disc pl-5 text-ink-2">{d.session.exam.violations.map((v, k) => <li key={k}>{new Date(v.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}: {END_TEXT[v.type] ?? v.type}{v.action === 'WARNED' ? ' (warning)' : v.action === 'TERMINATED' ? ' (test ended)' : ''}</li>)}</ul>}
      </div>}

      <section aria-label="Score summary" className="result-reveal mb-5 grid overflow-hidden rounded-2xl border border-rule bg-surface md:grid-cols-[minmax(15rem,.8fr)_1.2fr]" data-result-reveal>
        <div className="border-b border-rule bg-gradient-to-br from-[#e8efdf] to-[#f6f2e5] p-5 sm:p-6 md:border-r md:border-b-0">
          <p className="label text-[10px] tracking-[.14em] text-forest">{greeting}</p>
          <div className="num mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight text-forest">{r.score}<span className="text-xl font-medium text-ink-3">/ {r.maxScore}</span></div>
          <div className="mt-3"><Meter value={pct} tone={pct >= 60 ? 'correct' : pct >= 40 ? 'marker' : 'wrong'} label="Score as a percentage of the maximum" /></div>
          <p className="num mt-2 text-sm text-ink-2">{pct}% of maximum marks · {accuracy === null ? 'No answered questions yet' : `${accuracy}% accuracy on ${attempted} answered`}</p>
        </div>
        <div className="p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map(({ Icon, label, value, tone }) => <div key={label} className="flex items-center gap-2.5 rounded-xl border border-rule px-3 py-2.5"><Icon aria-hidden className={`size-4 shrink-0 ${tone}`} /><div><dt className="text-[11px] text-ink-3">{label}</dt><dd className="num text-lg font-semibold text-ink">{value}</dd></div></div>)}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">Accuracy counts only answered questions. Skipped questions are not treated as wrong.</p>
        </div>
      </section>

      <section aria-labelledby="next-moves" className="result-reveal result-reveal-later mb-5 rounded-2xl border border-[#d5ddc8] bg-[#f2f5eb] p-4 sm:p-5" data-study-coaching>
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest text-lime"><Sparkles className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="label text-[9px] tracking-[.15em] text-forest">BASED ON THIS ATTEMPT</p>
            <h2 id="next-moves" className="mt-1 text-lg font-bold tracking-tight text-ink sm:text-xl">Your next best move</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl border border-[#e6cbbd] bg-[#fffaf5] p-4" data-primary-insight>
            <div className="flex items-center gap-2 text-terracotta"><Target aria-hidden className="size-4" /><span className="label text-[9px] tracking-wider">FOCUS NEXT</span></div>
            {focusUnit && focusAttempts > 0 ? <>
              <h3 className="mt-2 text-base font-semibold text-ink">{focusUnit.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">You got {focusUnit.correct} of {focusAttempts} answered right ({focusUnit.accuracy}%). {focusUnit.incorrect > 0 ? 'Review the missed explanations, then retry this unit with a short mixed set.' : 'Keep this unit strong with spaced revision and a short mixed set.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.incorrect > 0 && <ButtonLink to={`/results/${sessionId}/review?filter=INCORRECT`} kind="secondary">Review {r.incorrect} mistakes</ButtonLink>}
                {focusUnit.id !== 'none' && <ButtonLink to={`/revise/${focusUnit.id}`} kind="primary" icon={<BookOpenCheck aria-hidden />}>Revise this unit</ButtonLink>}
              </div>
            </> : r.unattempted > 0 ? <>
              <h3 className="mt-2 text-base font-semibold text-ink">Start with the {r.unattempted} unanswered {r.unattempted === 1 ? 'question' : 'questions'}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">Read the explanations for the questions you skipped, then practise the related topics without a timer.</p>
              <div className="mt-3"><ButtonLink to={`/results/${sessionId}/review?filter=UNATTEMPTED`} kind="secondary">Review unanswered</ButtonLink></div>
            </> : <>
              <h3 className="mt-2 text-base font-semibold text-ink">Build a first data point</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">Try another short set and answer what you can. Your next result will show which topics deserve the most attention.</p>
            </>}
          </article>
          <article className="rounded-xl border border-[#c8ddcf] bg-[#f8fcf7] p-4" data-strength-insight>
            <div className="flex items-center gap-2 text-correct"><TrendingUp aria-hidden className="size-4" /><span className="label text-[9px] tracking-wider">REINFORCE</span></div>
            {strongest ? <>
              <h3 className="mt-2 text-base font-semibold text-ink">{strongest.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">This is your strongest unit at {strongest.accuracy}% ({strongest.correct} of {strongest.correct + strongest.incorrect} answered). Keep it strong with a mixed revision set while you work on weaker areas.</p>
              {strongest.id !== 'none' && <Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline" to={`/topic/${strongest.id}`}>Open unit <ArrowUpRight aria-hidden className="size-4" /></Link>}
            </> : <>
              <h3 className="mt-2 text-base font-semibold text-ink">Keep practising to find your strengths</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">After a few answered questions, we’ll show which units you can confidently maintain and which need more practice.</p>
            </>}
          </article>
        </div>

        {units.length > 0 && <div className="mt-4 rounded-xl border border-rule bg-surface p-4" data-unit-focus>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-ink">Choose a unit to explore</h3><span className="text-xs text-ink-3">Select a row to update the coaching below</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {units.map((u) => {
              const n = u.correct + u.incorrect;
              const selected = (focusUnit?.id ?? units[0]?.id) === u.id;
              return <button key={u.id} type="button" aria-pressed={selected} onClick={() => setFocusUnitId(u.id)} className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-forest bg-[#edf3e8] ring-1 ring-forest/20' : 'border-rule hover:border-forest/40 hover:bg-paper'}`}>
                <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold text-ink">{u.title}</span><span className="num shrink-0 text-xs font-semibold text-forest">{u.accuracy === null ? '—' : `${u.accuracy}%`}</span></span>
                <span className="mt-2 block"><Meter value={u.accuracy ?? 0} tone={u.accuracy !== null && u.accuracy >= 60 ? 'correct' : 'accent'} label={`${u.title} accuracy`} /></span>
                <span className="num mt-1.5 block text-[11px] text-ink-3">{u.correct} right · {u.incorrect} wrong · {u.unattempted} skipped</span>
              </button>;
            })}
          </div>
          {focusUnit && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5" aria-live="polite">
            <p className="text-sm text-ink-2">{focusAttempts > 0 ? focusUnit.accuracy !== null && focusUnit.accuracy < 60 ? <>For <strong>{focusUnit.title}</strong>, revisit the core idea, check your missed answers, and retake a short set.</> : <>For <strong>{focusUnit.title}</strong>, keep accuracy steady with spaced revision and mixed questions.</> : <>You haven’t answered a question in <strong>{focusUnit.title}</strong> yet. Start with its lesson or a short practice set.</>}</p>
            {focusUnit.id !== 'none' && <Link to={`/topic/${focusUnit.id}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-forest hover:underline">Open unit <ArrowRight aria-hidden className="size-4" /></Link>}
          </div>}
        </div>}
      </section>

      {d.session.analysis && <section aria-labelledby="difficulty-title" className="result-reveal result-reveal-later mb-5 rounded-2xl border border-rule bg-surface p-4 sm:p-5" data-difficulty-insights>
        <div className="flex items-start gap-3"><span aria-hidden className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Target className="size-4" /></span><div><h2 id="difficulty-title" className="text-base font-semibold text-ink">How difficulty levels went</h2><p className="mt-0.5 text-xs text-ink-3">Use this to choose the level of your next practice set.</p></div></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{d.session.analysis.byDifficulty.map((level) => {
          const n = level.correct + level.incorrect;
          const name = level.difficulty.charAt(0) + level.difficulty.slice(1).toLowerCase();
          return <article key={level.difficulty} className="rounded-xl border border-rule bg-paper/60 p-3"><div className="flex justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{name}</h3><span className="num text-sm font-semibold text-forest">{level.accuracy === null ? '—' : `${level.accuracy}%`}</span></div><Meter value={level.accuracy ?? 0} tone={level.accuracy !== null && level.accuracy >= 60 ? 'correct' : 'accent'} label={`${name} accuracy`} /><p className="num mt-1.5 text-xs text-ink-3">{level.correct} right · {level.incorrect} wrong · {level.unattempted} skipped</p></article>;
        })}</div>
      </section>}

      <section aria-label="Review answers" className="result-reveal result-reveal-later mb-5 rounded-2xl border border-rule bg-surface p-4 sm:p-5" data-review-actions>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-[#f5e7dd] text-terracotta"><CircleX className="size-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="font-semibold text-ink">Want to see exactly what happened?</h2><p className="mt-0.5 text-sm text-ink-2">Answer explanations open on a separate review screen, so you can focus on learning from each question.</p></div>
          <ButtonLink to={`/results/${sessionId}/review?filter=INCORRECT`} kind="primary">Review wrong answers ({r.incorrect})</ButtonLink>
          <ButtonLink to={`/results/${sessionId}/review`} kind="secondary">Review all answers</ButtonLink>
        </div>
      </section>

      <details className="mb-6 rounded-xl border border-rule bg-surface px-4 py-3 text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold text-ink">How this score was calculated</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="num w-full min-w-[24rem] text-sm"><tbody className="divide-y divide-rule">
            <tr><td className="py-2"><span className="inline-flex items-center gap-2 text-ink"><CircleCheck aria-hidden className="size-4 text-correct" />Correct</span></td><td className="py-2 text-right text-ink-2">{r.correct} × {signed(marking.correct)}</td><td className="py-2 text-right font-semibold text-correct">{signed(r.correct * marking.correct)}</td></tr>
            <tr><td className="py-2"><span className="inline-flex items-center gap-2 text-ink"><CircleX aria-hidden className="size-4 text-wrong" />Wrong</span></td><td className="py-2 text-right text-ink-2">{r.incorrect} × {signed(marking.incorrect)}</td><td className="py-2 text-right font-semibold text-wrong">{signed(r.incorrect * marking.incorrect)}</td></tr>
            <tr><td className="py-2"><span className="inline-flex items-center gap-2 text-ink"><CircleMinus aria-hidden className="size-4 text-ink-3" />Not answered</span></td><td className="py-2 text-right text-ink-2">{r.unattempted} × 0</td><td className="py-2 text-right text-ink-3">0</td></tr>
            {r.credited > 0 && <tr><td className="py-2 text-ink">Credited</td><td className="py-2 text-right text-ink-2">{r.credited} × {signed(marking.correct)}</td><td className="py-2 text-right font-semibold text-correct">{signed(r.credited * marking.correct)}</td></tr>}
            <tr className="border-t-2 border-rule-strong"><td className="py-2 font-semibold text-ink" colSpan={2}>Total</td><td className="py-2 text-right font-semibold text-ink">{r.score}</td></tr>
          </tbody></table>
          <p className="num mt-2 text-xs text-ink-3">{r.correct} × {marking.correct} {marking.incorrect < 0 ? '−' : '+'} {r.incorrect} × {Math.abs(marking.incorrect)}{r.credited ? ` + ${r.credited} × ${marking.correct} credited` : ''} = {r.score}. Maximum {r.maxScore}.</p>
          <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-ink">Marking scheme used</summary><div className="mt-2"><SchemeDetails scheme={scheme} /></div></details>
          {possibleFutureGain > 0 && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-ink-2">For a future attempt, each wrong answer corrected would improve the score by {improvementPerWrong} marks under this scheme. Review the {r.incorrect} missed answer{r.incorrect === 1 ? '' : 's'} before trying again; this is a practice guide, not a predicted result.</p>}
        </div>
      </details>
      {strongest && weakest && strongest.id === weakest.id && <p className="mb-4 text-center text-xs text-ink-3">Your attempted units are close in accuracy; use the unit selector above to choose where you want to focus.</p>}
    </div>
  );
}
