import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, localDay } from '../api';
import { accuracyTone, Button, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, useLoad } from '../ui';

const mondayOf = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(y!, m! - 1, dd!);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return localDay(t);
};
const shift = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number);
  return localDay(new Date(y!, m! - 1, dd! + n));
};
const short = (d: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y!, m! - 1, dd!).toLocaleDateString(undefined, opts);
};

function Delta({ now, before, unit = '' }: { now: number | null; before: number | null; unit?: string }) {
  if (now === null || before === null) return <span className="text-xs text-ink-3">No earlier data</span>;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-3">
        <Minus aria-hidden className="size-3.5" />
        Same as last week
      </span>
    );
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? 'text-correct' : 'text-wrong'}`}>
      {up ? <TrendingUp aria-hidden className="size-3.5" /> : <TrendingDown aria-hidden className="size-3.5" />}
      {up ? '+' : '−'}
      {Math.abs(diff)}
      {unit} vs last week
    </span>
  );
}

/** Weekly performance report: worked out from the student's answers, lessons, tests and plan for one week. */
export function ReportPage() {
  const thisWeek = mondayOf(localDay());
  const [week, setWeek] = useState(thisWeek);
  const r = useLoad(() => api.weeklyReport(week), [week]);
  const d = r.data;
  const max = Math.max(1, ...(d?.days.map((x) => x.answered) ?? [1]), d?.goal.questionsPerDay ?? 0);
  return (
    <div>
      <PageHeader
        back={{ to: '/progress', label: 'Progress' }}
        title="Weekly report"
        subtitle={`${short(week, { day: 'numeric', month: 'long' })} to ${short(shift(week, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-1">
            <Button kind="secondary" size="sm" onClick={() => setWeek(shift(week, -7))} icon={<ChevronLeft aria-hidden />} title="Previous week">
              <span className="sr-only">Previous week</span>
            </Button>
            <Button kind="secondary" size="sm" onClick={() => setWeek(thisWeek)} disabled={week === thisWeek}>
              This week
            </Button>
            <Button kind="secondary" size="sm" onClick={() => setWeek(shift(week, 7))} disabled={week >= thisWeek} icon={<ChevronRight aria-hidden />} title="Next week">
              <span className="sr-only">Next week</span>
            </Button>
          </div>
        }
      />
      {r.loading && !d && <Loading />}
      {r.error && <ErrorBox error={r.error} onRetry={r.reload} />}
      {d && (
        <>
          <section aria-label="This week in numbers" className="mb-10 grid grid-cols-2 divide-rule overflow-hidden rounded-xl border border-rule bg-surface lg:grid-cols-4 lg:divide-x [&>div:nth-child(n+3)]:border-t [&>div:nth-child(n+3)]:border-rule lg:[&>div:nth-child(n+3)]:border-t-0">
            <div className="px-5 py-4">
              <div className="text-sm text-ink-2">Questions answered</div>
              <div className="num mt-1 text-2xl font-semibold text-ink">{d.totals.answered}</div>
              <Delta now={d.totals.answered} before={d.previous.answered} />
            </div>
            <div className="px-5 py-4">
              <div className="text-sm text-ink-2">Accuracy</div>
              <div className="num mt-1 text-2xl font-semibold text-ink">{d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%`}</div>
              <Delta now={d.totals.accuracy} before={d.previous.accuracy} unit=" points" />
            </div>
            <div className="px-5 py-4">
              <div className="text-sm text-ink-2">Lessons opened</div>
              <div className="num mt-1 text-2xl font-semibold text-ink">{d.totals.lessonsOpened}</div>
              <Delta now={d.totals.lessonsOpened} before={d.previous.lessonsOpened} />
            </div>
            <div className="px-5 py-4">
              <div className="text-sm text-ink-2">Tests submitted</div>
              <div className="num mt-1 text-2xl font-semibold text-ink">{d.totals.sessionsSubmitted}</div>
              <span className="text-xs text-ink-3">{d.totals.averageScorePct === null ? 'No scores yet' : `Average score ${d.totals.averageScorePct}%`}</span>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section aria-labelledby="by-day">
              <SectionTitle id="by-day">Day by day</SectionTitle>
              <div className="relative rounded-xl border border-rule bg-surface p-5">
                <div className="relative flex h-44 items-end gap-3" aria-hidden>
                  {d.goal.questionsPerDay > 0 && (
                    <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3/60" style={{ bottom: `${(100 * d.goal.questionsPerDay) / max}%` }}>
                      <span className="absolute -top-5 right-0 bg-surface px-1 text-[11px] text-ink-3">Goal {d.goal.questionsPerDay}</span>
                    </div>
                  )}
                  {d.days.map((x) => (
                    <div key={x.day} className="flex h-full flex-1 flex-col justify-end">
                      <div className="num mb-1 text-center text-[11px] text-ink-2">{x.answered || ''}</div>
                      <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${(100 * x.answered) / max}%` }}>
                        <div className="bg-wrong/35" style={{ height: `${x.answered ? (100 * (x.answered - x.correct)) / x.answered : 0}%` }} />
                        <div className="flex-1 bg-correct" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-3 border-t border-rule pt-2">
                  {d.days.map((x) => (
                    <div key={x.day} className={`flex-1 text-center text-xs ${x.day === localDay() ? 'font-semibold text-accent' : 'text-ink-3'}`}>
                      {short(x.day, { weekday: 'short' })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-3 rounded-sm bg-correct" />
                    Correct
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-3 rounded-sm bg-wrong/35" />
                    Wrong
                  </span>
                  <span>
                    Goal met on {d.totals.goalDays} of 7 days. Active on {d.totals.activeDays} days.
                  </span>
                </div>
                <div className="sr-only">
                <table>
                  <caption>Questions answered each day</caption>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Answered</th>
                      <th>Correct</th>
                      <th>Lessons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.days.map((x) => (
                      <tr key={x.day}>
                        <td>{short(x.day, { weekday: 'long', day: 'numeric', month: 'long' })}</td>
                        <td>{x.answered}</td>
                        <td>{x.correct}</td>
                        <td>{x.lessons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              {d.totals.planTotal > 0 && (
                <div className="mt-4 rounded-xl border border-rule bg-surface p-5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-2">Study plan</span>
                    <span className="num font-semibold text-ink">
                      {d.totals.planDone} of {d.totals.planTotal} tasks done
                    </span>
                  </div>
                  <div className="mt-2">
                    <Meter value={(100 * d.totals.planDone) / d.totals.planTotal} tone={d.totals.planDone === d.totals.planTotal ? 'correct' : 'accent'} label="Planned tasks done this week" />
                  </div>
                </div>
              )}
            </section>

            <div className="space-y-10">
              <section aria-labelledby="w-subjects">
                <SectionTitle id="w-subjects">Subjects</SectionTitle>
                {d.subjects.length === 0 ? (
                  <Empty>No questions answered in this week.</Empty>
                ) : (
                  <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                    {d.subjects.map((s) => (
                      <li key={s.code} className="grid grid-cols-[minmax(0,1fr)_5rem_3rem] items-center gap-3 px-4 py-3 text-sm">
                        <span className="truncate text-ink">
                          {s.paper} <span className="num text-xs text-ink-3">{s.answered} answered</span>
                        </span>
                        <Meter value={s.accuracy ?? 0} tone={accuracyTone(s.accuracy)} />
                        <span className="num text-right text-xs text-ink-2">{s.accuracy === null ? '–' : `${s.accuracy}%`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-labelledby="w-weak">
                <SectionTitle id="w-weak">Topics to revise</SectionTitle>
                {d.weakTopics.length === 0 ? (
                  <Empty>No weak topics this week. A topic shows here when this week’s accuracy is under 60% after at least 3 answers.</Empty>
                ) : (
                  <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                    {d.weakTopics.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{t.title}</span>
                          <span className="num text-xs text-ink-3">
                            {t.correct} of {t.attempted} correct
                          </span>
                        </span>
                        <Link to={`/revise/${t.id}`} className="shrink-0 font-medium text-accent hover:underline">
                          Revise
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
