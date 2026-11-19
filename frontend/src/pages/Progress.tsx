import { ArrowUpRight, ChartNoAxesColumn, CircleCheck, ClipboardList, FileCheck2, History, Notebook, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { subjectTone } from '../subjectColors';
import { accuracyTone, Empty, ErrorBox, Loading, Meter, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const MODE_ICON: Record<string, { Icon: typeof Timer; tint: string }> = {
  PRACTICE: { Icon: Timer, tint: 'bg-[#e4ecd9] text-forest' },
  TOPIC_TEST: { Icon: FileCheck2, tint: 'bg-[#e4ecd9] text-forest' },
  MOCK_TEST: { Icon: ClipboardList, tint: 'bg-[#f3dfd6] text-terracotta' },
};

/** The one card surface on this page: near-white, hairline, soft radius. */
const card = 'rounded-[18px] border border-line bg-[#fefdf8] shadow-[0_1px_0_rgba(32,44,40,0.02)]';
const sectionHead = 'mb-3 flex flex-wrap items-baseline justify-between gap-3';
const h2 = 'text-[15px] leading-tight font-bold tracking-[-0.01em] text-charcoal';

function StatCard({ label, value, hint, tone, bar, barTone, wash }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; bar?: number | null; barTone: string; wash: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[18px] border border-line px-[18px] pt-[18px] pb-4 ${wash}`}>
      <span aria-hidden className="pointer-events-none absolute -right-7 -bottom-16 size-32 rounded-full border-[14px] border-charcoal/[0.035]" />
      <dt className="text-[12.5px] text-mute">{label}</dt>
      <dd className={`num mt-2 text-[30px] leading-none font-bold tracking-[-0.03em] ${tone ?? 'text-forest'}`}>{value}</dd>
      <dd className="mt-1.5 min-h-4 text-[11.5px] text-mute">{hint}</dd>
      {bar !== undefined && bar !== null && (
        <dd className="mt-3 h-1 overflow-hidden rounded-full bg-charcoal/10" aria-hidden>
          <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </dd>
      )}
    </div>
  );
}

/** Performance built from submitted practice sets and tests: totals, subjects, weak topics, every topic, recent sessions. */
export function ProgressPage() {
  const p = useLoad(api.progress, []);
  if (p.loading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data!;
  const asked = d.totals.answered + d.totals.unattempted;
  return (
    <div data-home data-progress className="mx-auto max-w-[84rem]">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="label text-[11.5px] tracking-[0.2em] text-terracotta">Your learning, at a glance</div>
          <h1 className="mt-3 text-[clamp(32px,3.1vw,48px)] leading-[1.02] font-bold tracking-[-0.045em] text-charcoal">
            Progress <span className="font-editorial font-medium tracking-[-0.02em] text-terracotta italic">that adds up.</span>
          </h1>
          <p className="mt-3 text-[13.5px] text-mute">Built from the practice sets and tests you have submitted.</p>
        </div>
        <Link to="/report" className="mb-1 inline-flex h-[46px] items-center gap-2.5 rounded-[12px] bg-forest px-5 text-[13px] font-bold text-white transition-colors hover:bg-forest-deep">
          <Notebook aria-hidden className="size-3.5 text-lime" />
          Weekly report
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </header>

      <dl className="mt-5 mb-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Sessions submitted" value={d.totals.sessions} wash="bg-gradient-to-br from-[#eef2e3] to-[#fbfaf3]" barTone="bg-[#5f8a68]" />
        <StatCard
          label="Questions answered"
          value={d.totals.answered}
          hint={d.totals.unattempted ? `${d.totals.unattempted} left unanswered` : undefined}
          bar={asked ? (100 * d.totals.answered) / asked : null}
          barTone="bg-[#5f8a68]"
          wash="bg-gradient-to-br from-[#e8f0dd] to-[#fbfaf3]"
        />
        <StatCard
          label="Accuracy"
          value={d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%`}
          tone="text-terracotta"
          hint={`${d.totals.correct} correct, ${d.totals.incorrect} wrong`}
          bar={d.totals.accuracy}
          barTone="bg-terracotta"
          wash="bg-gradient-to-br from-[#f8e6dc] to-[#fbf7f0]"
        />
        <StatCard label="Weak topics" value={d.weakTopics.length} tone={d.weakTopics.length ? 'text-terracotta' : 'text-forest'} hint="Under 60% after 3 or more attempts" barTone="bg-terracotta" wash="bg-gradient-to-br from-[#ece8f2] to-[#fbf9f4]" />
      </dl>

      <section className="mb-7" aria-labelledby="by-subject">
        <div className={sectionHead}>
          <h2 id="by-subject" className={`${h2} text-[17px]`}>
            By subject
          </h2>
          <span className="label text-[10.5px] text-mute">Practice breakdown</span>
        </div>
        {d.subjects.length === 0 ? (
          <Empty icon={<ChartNoAxesColumn />}>Submit a practice set or test to see your progress by subject.</Empty>
        ) : (
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {d.subjects.map((s, i) => (
              <li key={s.paperCode} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 px-[18px] py-4 sm:flex">
                <span className="flex min-w-0 items-center gap-4 sm:w-[24%]">
                  <span aria-hidden className="grid size-[44px] shrink-0 place-items-center rounded-[13px]" style={{ background: subjectTone(i).node }}>
                    <span className="size-3.5 rounded-full border-[3px] border-charcoal/70" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-bold text-charcoal">{s.paper}</span>
                    <span className="num block text-[11.5px] text-mute">{s.paperCode}</span>
                  </span>
                </span>
                <span className="order-3 col-span-2 min-w-0 sm:order-none sm:flex-1">
                  <span className="flex items-baseline justify-between gap-3 text-[11.5px] text-mute">
                    <span>
                      Topics <b className="num text-[12px] text-charcoal">{s.topics}</b>
                    </span>
                    <span>
                      Answered <b className="num text-[12px] text-charcoal">{s.attempted}</b>
                    </span>
                  </span>
                  <span className="mt-1.5 block">
                    <Meter value={s.accuracy ?? 0} tone="accent" label={`Accuracy in ${s.paper}`} />
                  </span>
                </span>
                <span className="num ml-auto shrink-0 text-[12.5px] font-bold text-terracotta sm:w-24 sm:text-right">{s.accuracy === null ? '–' : `${s.accuracy}% accuracy`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-7 grid grid-cols-1 gap-x-4 gap-y-7 lg:grid-cols-2">
        <section aria-labelledby="weak">
          <div className={sectionHead}>
            <h2 id="weak" className={h2}>
              Weak topics to revise
            </h2>
            {d.weakTopics.length > 0 && (
              <Link to="/sheets/weak" className="inline-flex items-center gap-1 text-right text-[11.5px] font-bold text-terracotta hover:underline">
                Make a revision sheet from these topics <ArrowUpRight aria-hidden className="size-3 shrink-0" />
              </Link>
            )}
          </div>
          {d.weakTopics.length === 0 ? (
            <Empty icon={<CircleCheck />}>No weak topics yet. A topic appears here when your accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="space-y-3">
              {d.weakTopics.map((t) => (
                <li key={t.id} className="relative overflow-hidden rounded-[18px] border border-[#ecd2c6] border-l-[3px] border-l-terracotta bg-gradient-to-br from-[#fbe9e0] to-[#fdf6ef] px-[18px] pt-4 pb-4">
                  <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full border border-terracotta/10" />
                  <div className="label text-[10.5px] tracking-[0.18em] text-terracotta">{t.paper} · Build confidence</div>
                  <Link to={`/topic/${t.id}`} className="mt-3.5 block text-[14px] leading-snug text-charcoal hover:text-terracotta">
                    {t.title}
                  </Link>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3 text-[11.5px] text-mute">
                      <span className="w-[86px] shrink-0">
                        <Meter value={t.accuracy} tone="accent" label={`Accuracy in ${t.title}`} />
                      </span>
                      <span className="num">
                        {t.correct} of {t.attempted} correct · {t.accuracy}%
                      </span>
                    </div>
                    <Link to={`/revise/${t.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-lime px-3.5 text-[12.5px] font-bold text-charcoal transition-colors hover:brightness-95">
                      Revise topic <ArrowUpRight aria-hidden className="size-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="all-topics">
          <div className={sectionHead}>
            <h2 id="all-topics" className={h2}>
              All practised topics
            </h2>
            <span className="num text-[11.5px] font-bold text-charcoal">{d.topics.length === 1 ? '1 topic' : `${d.topics.length} topics`}</span>
          </div>
          {d.topics.length === 0 ? (
            <Empty>Practise a topic to start building your progress.</Empty>
          ) : (
            <ul className={`${card} max-h-[30rem] divide-y divide-line overflow-y-auto`} tabIndex={0} aria-label="All practised topics">
              {d.topics.map((t) => (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.75rem] items-center gap-4 px-[14px] py-3.5 text-[12.5px]">
                  <Link to={`/topic/${t.id}`} className="truncate text-charcoal hover:text-terracotta" title={t.title}>
                    {t.title}
                  </Link>
                  <Meter value={t.accuracy} tone={accuracyTone(t.accuracy)} label={`Accuracy in ${t.title}`} />
                  <span className={`num text-right text-[12px] font-bold ${t.accuracy >= 75 ? 'text-correct' : t.accuracy >= 60 ? 'text-marker' : 'text-terracotta'}`}>{t.accuracy}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent">
        <div className={sectionHead}>
          <h2 id="recent" className={`${h2} text-[17px]`}>
            Recent sessions
          </h2>
          <span className="label text-[10.5px] text-mute">Latest activity</span>
        </div>
        {d.recentSessions.length === 0 ? (
          <Empty icon={<History />}>No sessions yet. Start with a topic practice set or a mock test.</Empty>
        ) : (
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {d.recentSessions.map((s) => {
              const pct = s.max_score ? Math.round((100 * (s.score ?? 0)) / s.max_score) : null;
              const m = MODE_ICON[s.mode] ?? MODE_ICON.PRACTICE!;
              return (
                <li key={s.id}>
                  <Link to={s.status === 'IN_PROGRESS' ? `/practice/${s.id}` : `/results/${s.id}`} className="flex items-center gap-4 px-[14px] py-[11px] text-[12.5px] transition-colors hover:bg-sage/40">
                    <span className="w-[4.5rem] shrink-0 font-label text-[11.5px] tracking-[0.04em] text-mute">{new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span aria-hidden className={`grid size-[30px] shrink-0 place-items-center rounded-[9px] ${m.tint}`}>
                      <m.Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-charcoal">
                      {MODE[s.mode] ?? s.mode}
                      {s.paper ? <span className="text-mute"> · {s.paper}</span> : null}
                    </span>
                    {s.status === 'IN_PROGRESS' ? (
                      <span className="shrink-0 rounded-full bg-[#f5e6d0] px-2.5 py-1 text-[10.5px] font-bold text-marker">Unfinished</span>
                    ) : (
                      <span className="num shrink-0 rounded-full bg-[#e4ecd9] px-2.5 py-1 text-[10.5px] font-bold text-forest">
                        {s.score} / {s.max_score}
                        {pct !== null && <span className="ml-1.5 font-medium text-mute">{pct}%</span>}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="label mt-7 text-[10px] tracking-[0.16em] text-mute">Small steps add up · keep your own pace</p>
    </div>
  );
}
