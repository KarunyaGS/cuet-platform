import { CalendarRange, ChartNoAxesColumn, CircleCheck, History } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api';
import { accuracyTone, ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, StatGroup, useLoad } from '../ui';
import { SubjectTable } from './Dashboard';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };

/** Performance built from submitted practice sets and tests: totals, subjects, weak topics, every topic, recent sessions. */
export function ProgressPage() {
  const p = useLoad(api.progress, []);
  if (p.loading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data!;
  return (
    <div>
      <PageHeader title="Progress" subtitle="Built from the practice sets and tests you have submitted." actions={<ButtonLink to="/report" icon={<CalendarRange aria-hidden />}>Weekly report</ButtonLink>} />
      <div className="mb-10">
        <StatGroup
          items={[
            { label: 'Sessions submitted', value: d.totals.sessions },
            { label: 'Questions answered', value: d.totals.answered, hint: d.totals.unattempted ? `${d.totals.unattempted} left unanswered` : undefined },
            { label: 'Accuracy', value: d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%`, hint: `${d.totals.correct} correct, ${d.totals.incorrect} wrong` },
            { label: 'Weak topics', value: d.weakTopics.length, tone: d.weakTopics.length ? 'wrong' : undefined, hint: 'Under 60% after 3 or more attempts' },
          ]}
        />
      </div>

      <section className="mb-10" aria-labelledby="by-subject">
        <SectionTitle id="by-subject">By subject</SectionTitle>
        {d.subjects.length === 0 ? <Empty icon={<ChartNoAxesColumn />}>Submit a practice set or test to see your progress by subject.</Empty> : <SubjectTable subjects={d.subjects} />}
      </section>

      <div className="grid-cols-1 mb-10 grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="weak">
          <SectionTitle id="weak">Weak topics to revise</SectionTitle>
          {d.weakTopics.length === 0 ? (
            <Empty icon={<CircleCheck />}>No weak topics yet. A topic appears here when your accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {d.weakTopics.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <Link to={`/topic/${t.id}`} className="block truncate text-ink hover:text-accent">
                      {t.title}
                    </Link>
                    <span className="num mt-0.5 block text-xs text-ink-3">
                      {t.paper}, {t.correct} of {t.attempted} correct
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm font-semibold text-wrong">{t.accuracy}%</span>
                  <Link to={`/revise/${t.id}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
                    Revise
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="all-topics">
          <SectionTitle id="all-topics">All practised topics</SectionTitle>
          {d.topics.length === 0 ? (
            <Empty>Practise a topic to start building your progress.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {d.topics.map((t) => (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-3 px-4 py-2.5 text-sm">
                  <Link to={`/topic/${t.id}`} className="truncate text-ink hover:text-accent" title={t.title}>
                    {t.title}
                  </Link>
                  <Meter value={t.accuracy} tone={accuracyTone(t.accuracy)} label={`Accuracy in ${t.title}`} />
                  <span className="num text-right text-xs text-ink-2">{t.accuracy}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent">
        <SectionTitle id="recent">Recent sessions</SectionTitle>
        {d.recentSessions.length === 0 ? (
          <Empty icon={<History />}>No sessions yet. Start with a topic practice set or a mock test.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.recentSessions.map((s) => {
              const pct = s.max_score ? Math.round((100 * (s.score ?? 0)) / s.max_score) : null;
              return (
                <li key={s.id}>
                  <Link to={s.status === 'IN_PROGRESS' ? `/practice/${s.id}` : `/results/${s.id}`} className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-paper">
                    <span className="num w-24 shrink-0 text-ink-3">{new Date(s.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {MODE[s.mode] ?? s.mode}
                      {s.paper ? <span className="text-ink-3">, {s.paper}</span> : null}
                    </span>
                    {s.status === 'IN_PROGRESS' ? (
                      <span className="shrink-0 text-sm font-medium text-marker">Unfinished</span>
                    ) : (
                      <span className="num shrink-0 text-right">
                        <span className="font-semibold text-ink">
                          {s.score} / {s.max_score}
                        </span>
                        {pct !== null && <span className="ml-2 text-ink-3">{pct}%</span>}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
