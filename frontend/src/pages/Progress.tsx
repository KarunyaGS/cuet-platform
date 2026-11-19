import { ArrowUpRight, ChartNoAxesColumn, ChevronDown, CircleCheck, ClipboardList, FileCheck2, History, Notebook, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useState } from 'react';
import { api } from '../api';
import { subjectTone } from '../subjectColors';
import { accuracyTone, Empty, ErrorBox, Loading, Meter, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const MODE_ICON: Record<string, { Icon: typeof Timer; tint: string }> = {
  PRACTICE: { Icon: Timer, tint: 'bg-[#e4ecd9] text-forest' },
  TOPIC_TEST: { Icon: FileCheck2, tint: 'bg-[#e4ecd9] text-forest' },
  MOCK_TEST: { Icon: ClipboardList, tint: 'bg-[#f3dfd6] text-terracotta' },
};

/** Shared elevated surface, with enough contrast to separate long lists from the canvas. */
const card = 'rounded-[20px] border border-line/80 bg-surface shadow-[0_12px_32px_-24px_rgb(24_68_59/0.36)]';
const sectionHead = 'mb-3 flex flex-wrap items-baseline justify-between gap-3';
const h2 = 'text-[15px] leading-tight font-bold tracking-[-0.01em] text-charcoal';

function StatCard({ label, value, hint, tone, bar, barTone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; bar?: number | null; barTone: string }) {
  return (
    <div data-reveal className="progress-stat flex min-w-0 flex-col justify-center px-3 py-3 sm:px-4 sm:py-3.5">
      <dt className="truncate text-[11px] font-medium text-ink-2">{label}</dt>
      <dd className={`num mt-1.5 text-[25px] leading-none font-bold tracking-[-0.04em] ${tone ?? 'text-forest'}`}>{value}</dd>
      <dd className="mt-1 min-h-3.5 truncate text-[10px] text-ink-3">{hint}</dd>
      {bar !== undefined && bar !== null && (
        <dd className="mt-2 h-1 overflow-hidden rounded-full bg-forest/10" aria-hidden>
          <div className={`progress-fill h-full rounded-full ${barTone}`} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </dd>
      )}
    </div>
  );
}

/** Performance built from submitted practice sets and tests: totals, subjects, weak topics, every topic, recent sessions. */
export function ProgressPage() {
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const p = useLoad(api.progress, []);
  if (p.loading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data!;
  const asked = d.totals.answered + d.totals.unattempted;
  const accuracy = d.totals.accuracy ?? 0;
  const renderSession = (s: (typeof d.recentSessions)[number]) => {
    const pct = s.max_score ? Math.round((100 * (s.score ?? 0)) / s.max_score) : null;
    const m = MODE_ICON[s.mode] ?? MODE_ICON.PRACTICE!;
    return (
      <li key={s.id}>
        <Link to={s.status === 'IN_PROGRESS' ? `/practice/${s.id}` : `/results/${s.id}`} className="flex items-center gap-4 px-[14px] py-[11px] text-[12.5px] transition-colors hover:bg-sage/40">
          <span className="w-[4.5rem] shrink-0 font-label text-[11.5px] tracking-[0.04em] text-mute">{new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span aria-hidden className={`grid size-[30px] shrink-0 place-items-center rounded-[9px] ${m.tint}`}><m.Icon className="size-3.5" /></span>
          <span className="min-w-0 flex-1 truncate text-charcoal">{MODE[s.mode] ?? s.mode}{s.paper ? <span className="text-mute"> · {s.paper}</span> : null}</span>
          {s.status === 'IN_PROGRESS' ? (
            <span className="shrink-0 rounded-full bg-[#f5e6d0] px-2.5 py-1 text-[10.5px] font-bold text-marker">Unfinished</span>
          ) : (
            <span className="num shrink-0 rounded-full bg-[#e4ecd9] px-2.5 py-1 text-[10.5px] font-bold text-forest">{s.score} / {s.max_score}{pct !== null && <span className="ml-1.5 font-medium text-mute">{pct}%</span>}</span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <div data-home data-progress className="mx-auto max-w-[84rem]">
      <header data-progress-hero className="relative mb-6 overflow-hidden rounded-[20px] border border-[#e6c1a8] bg-gradient-to-br from-[#f3d9c7] via-[#f5e4d6] to-[#f7eddc] px-5 py-4 text-forest shadow-[0_12px_28px_-24px_rgb(137_78_51/0.24)] sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0 max-w-3xl">
            <div className="label inline-flex items-center gap-2 rounded-full border border-[#dfc0a9] bg-white/70 px-3 py-1 text-[9px] tracking-[0.16em] text-forest"><span className="size-1.5 rounded-full bg-terracotta" />Your learning, at a glance</div>
            <h1 className="mt-2.5 text-[clamp(27px,3.1vw,38px)] leading-[1.04] font-bold tracking-[-0.045em] text-forest">
              <span className="font-editorial font-medium italic tracking-[-0.03em] text-forest">Progress</span> <span className="font-editorial font-medium italic tracking-[-0.03em] text-terracotta">that adds up.</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-2">Built from the practice sets and tests you have submitted.</p>
          </div>
          <div className="progress-actions-widget flex w-full flex-col gap-2 rounded-[16px] border border-[#e4c8b2] bg-white/75 p-3 sm:w-auto sm:min-w-[14rem]">
            <div className="progress-score-widget flex items-center gap-3 px-1 py-1">
              <div className="relative grid size-12 shrink-0 place-items-center">
                <svg aria-hidden viewBox="0 0 64 64" className="progress-score-ring size-full -rotate-90">
                  <circle cx="32" cy="32" r="25" fill="none" stroke="rgb(24 68 59 / 0.12)" strokeWidth="5" />
                  <circle cx="32" cy="32" r="25" fill="none" stroke="#c45e42" strokeLinecap="round" strokeWidth="5" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - accuracy} />
                </svg>
                <span className="num absolute text-[13px] font-bold text-forest">{accuracy}%</span>
              </div>
              <div className="min-w-0">
                <span className="label block text-[9px] tracking-[0.14em] text-forest">OVERALL ACCURACY</span>
                <span className="mt-1 block text-[11px] font-medium text-ink-2">{d.totals.correct} correct answers</span>
              </div>
            </div>
            <Link to="/report" className="group inline-flex h-9 items-center justify-between gap-2 rounded-lg bg-forest px-3 text-[11px] font-bold text-lime shadow-sm transition duration-200 hover:bg-forest-deep">
              <Notebook aria-hidden className="size-4" />
              Weekly report
              <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-line/80 bg-surface sm:grid-cols-4 sm:divide-x sm:divide-line [&>div:nth-child(odd)]:border-r [&>div:nth-child(odd)]:border-line [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(-n+2)]:border-line sm:[&>div:nth-child(odd)]:border-r-0 sm:[&>div:nth-child(-n+2)]:border-b-0">
        <StatCard label="Sessions submitted" value={d.totals.sessions} barTone="bg-[#5f8a68]" />
        <StatCard
          label="Questions answered"
          value={d.totals.answered}
          hint={d.totals.unattempted ? `${d.totals.unattempted} left unanswered` : undefined}
          bar={asked ? (100 * d.totals.answered) / asked : null}
          barTone="bg-[#5f8a68]"
        />
        <StatCard
          label="Accuracy"
          value={d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%`}
          tone="text-terracotta"
          hint={`${d.totals.correct} correct, ${d.totals.incorrect} wrong`}
          bar={d.totals.accuracy}
          barTone="bg-terracotta"
        />
        <StatCard label="Weak topics" value={d.weakTopics.length} tone={d.weakTopics.length ? 'text-terracotta' : 'text-forest'} hint="Under 60% accuracy" barTone="bg-terracotta" />
      </dl>

      <section data-reveal className="mb-6" aria-labelledby="by-subject">
        <div className={sectionHead}>
          <h2 id="by-subject" className={`${h2} text-[17px]`}>
            By subject
          </h2>
        </div>
        {d.subjects.length === 0 ? (
          <Empty icon={<ChartNoAxesColumn />}>Submit a practice set or test to see your progress by subject.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line/80 bg-surface divide-y divide-line">
            {d.subjects.map((s, i) => (
              <li key={s.paperCode} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-3 py-3 sm:flex sm:px-4">
                <span className="flex min-w-0 items-center gap-3 sm:w-[24%]">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[11px]" style={{ background: subjectTone(i).node }}>
                    <span className="size-3 rounded-full border-[2px] border-charcoal/70" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-charcoal">{s.paper}</span>
                    <span className="num block text-[10px] text-mute">{s.paperCode}</span>
                  </span>
                </span>
                <span className="order-3 col-span-2 min-w-0 sm:order-none sm:flex-1">
                  <span className="flex items-baseline justify-between gap-3 text-[10px] text-mute">
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
                <span className="num ml-auto shrink-0 text-[11px] font-bold text-terracotta sm:w-24 sm:text-right">{s.accuracy === null ? '–' : `${s.accuracy}% accuracy`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-8 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <section data-reveal aria-labelledby="weak" className="flex min-w-0 flex-col">
          <div className={sectionHead}>
            <h2 id="weak" className={h2}>
              Weak topics to revise
            </h2>
            {d.weakTopics.length > 0 && (
              <Link to="/sheets/weak" className="inline-flex items-center gap-1 text-right text-[11px] font-semibold text-terracotta hover:underline">
                Revision sheet <ArrowUpRight aria-hidden className="size-3 shrink-0" />
              </Link>
            )}
          </div>
          {d.weakTopics.length === 0 ? (
            <Empty icon={<CircleCheck />}>No weak topics yet. A topic appears here when your accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="flex-1 space-y-2">
              {d.weakTopics.map((t) => (
                <li key={t.id} className="overflow-hidden rounded-xl border border-[#ecd2c6] border-l-[3px] border-l-terracotta bg-[#fbefe8] px-3.5 py-3">
                  <div className="label text-[9px] tracking-[0.15em] text-terracotta">{t.paper} · WEAK TOPIC</div>
                  <Link to={`/topic/${t.id}`} className="mt-1.5 block text-[13px] leading-snug font-medium text-charcoal hover:text-terracotta">
                    {t.title}
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5 text-[10px] text-mute">
                      <span className="w-[72px] shrink-0">
                        <Meter value={t.accuracy} tone="accent" label={`Accuracy in ${t.title}`} />
                      </span>
                      <span className="num">
                        {t.correct} of {t.attempted} correct · {t.accuracy}%
                      </span>
                    </div>
                    <Link to={`/revise/${t.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg bg-lime px-3 text-[11px] font-bold text-charcoal transition-colors hover:brightness-95">
                      Revise <ArrowUpRight aria-hidden className="size-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section data-reveal aria-labelledby="all-topics" className="flex min-w-0 flex-col">
          <div className={sectionHead}>
            <h2 id="all-topics" className={h2}>
              All practised topics
            </h2>
            {d.topics.length > 1 && <button type="button" aria-expanded={showAllTopics} aria-controls="all-practised-topics" onClick={() => setShowAllTopics((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-forest transition-colors hover:bg-sage/60"><span>{showAllTopics ? 'Show less' : `${d.topics.length} topics`}</span><ChevronDown aria-hidden className={`size-3.5 transition-transform duration-200 ${showAllTopics ? 'rotate-180' : ''}`} /></button>}
          </div>
          {d.topics.length === 0 ? (
            <Empty>Practise a topic to start building your progress.</Empty>
          ) : (
            <ul id="all-practised-topics" className={`${card} flex-1 divide-y divide-line overflow-hidden`} tabIndex={showAllTopics ? 0 : -1} aria-label="All practised topics">
              {(showAllTopics ? d.topics : d.topics.slice(0, 1)).map((t) => (
                <li key={t.id} className="flex min-h-[94px] flex-col justify-center gap-3 px-3.5 py-3">
                  <Link to={`/topic/${t.id}`} className="line-clamp-2 text-[12px] leading-snug text-charcoal hover:text-terracotta" title={t.title}>{t.title}</Link>
                  <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3">
                    <Meter value={t.accuracy} tone={accuracyTone(t.accuracy)} label={`Accuracy in ${t.title}`} />
                    <span className={`num text-right text-[11px] font-bold ${t.accuracy >= 75 ? 'text-correct' : t.accuracy >= 60 ? 'text-marker' : 'text-terracotta'}`}>{t.accuracy}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section data-reveal aria-labelledby="recent">
        <div className={sectionHead}>
          <h2 id="recent" className={`${h2} text-[17px]`}>
            Recent sessions
          </h2>
          <div className="flex items-center gap-3">
            {d.recentSessions.length > 2 && <button type="button" aria-expanded={showAllSessions} aria-controls="recent-session-history" onClick={() => setShowAllSessions((value) => !value)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-terracotta transition-colors hover:bg-accent-soft/70"><span>{showAllSessions ? 'Show less' : 'View all'}</span><ChevronDown aria-hidden className={`size-3.5 transition-transform duration-200 ${showAllSessions ? 'rotate-180' : ''}`} /></button>}
          </div>
        </div>
        {d.recentSessions.length === 0 ? (
          <Empty icon={<History />}>No sessions yet. Start with a topic practice set or a mock test.</Empty>
        ) : (
          <div className={`${card} overflow-hidden`}>
            <ul className="divide-y divide-line">{d.recentSessions.slice(0, 2).map(renderSession)}</ul>
            {d.recentSessions.length > 2 && <div id="recent-session-history" aria-hidden={!showAllSessions} inert={!showAllSessions} className={`grid transition-[grid-template-rows] duration-300 ease-out ${showAllSessions ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="min-h-0 overflow-hidden"><ul className="divide-y divide-line">{d.recentSessions.slice(2).map(renderSession)}</ul></div></div>}
          </div>
        )}
      </section>
      <p className="label mt-7 text-[10px] tracking-[0.16em] text-mute">Small steps add up · keep your own pace</p>
    </div>
  );
}
