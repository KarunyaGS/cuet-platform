import { Activity, BookOpen, CalendarPlus, CircleCheck, Layers, Target, Zap } from 'lucide-react';
import { planHref } from '../planLinks';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api, type Dashboard } from '../api';
import { accuracyTone, Button, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, useAuth, useLoad } from '../ui';

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** One goal: count against target with a bar. */
function Goal({ label, value, goal, icon, accent, to }: { label: string; value: number; goal: number; icon: React.ReactNode; accent: string; to?: string }) {
  const reached = goal > 0 && value >= goal;
  const body = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-rule bg-surface p-4 shadow-[0_12px_28px_-25px_rgb(26_34_51/45%)]" data-daily-goal>
      <div aria-hidden className={`pointer-events-none absolute -right-6 -top-8 size-24 rounded-full ${accent} opacity-30 blur-2xl`} />
      <div className="relative flex items-center justify-between gap-3">
        <span className={`grid size-9 place-items-center rounded-xl ${accent} text-forest`}>{icon}</span>
        {reached && <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf5ed] px-2 py-1 text-[10px] font-semibold text-correct"><CircleCheck aria-hidden className="size-3.5" />Reached</span>}
      </div>
      <span className="relative mt-3 block text-xs font-medium text-ink-2">{label}</span>
      <div className="num relative mt-0.5 text-2xl font-semibold tracking-tight text-ink">
        {value}<span className="ml-1 text-sm font-normal text-ink-3">/ {goal}</span>
      </div>
      <div className="relative mt-3">
        <Meter value={goal ? (100 * value) / goal : 0} tone={reached ? 'correct' : 'accent'} label={`${label} against your daily goal`} />
      </div>
      <p className="relative mt-2 text-[11px] text-ink-3">{reached ? 'Daily target met' : `${Math.max(0, goal - value)} to go`}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-transform duration-200 hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

/** The signed-in student's day: goals, where they left off, today's plan, weak topics and subjects. */
/** The page header, or (when Today sits inside the Home page) a section heading that does not add a second page title. */
function TodayHead({ embedded, title, subtitle, actions }: { embedded: boolean; title: string; subtitle: string; actions: React.ReactNode }) {
  if (!embedded) return <PageHeader title={title} subtitle={subtitle} actions={actions} />;
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5" data-today-heading>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <span className="text-sm text-ink-2">{subtitle}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}

export function DashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { user, ready } = useAuth();
  const d = useLoad(api.dashboard, [user?.id]);
  const prefs = useLoad(api.preferences, [user?.id]);
  const [paperId, setPaperId] = useState('');
  const [showAllPlan, setShowAllPlan] = useState(false);
  const [showAllWeak, setShowAllWeak] = useState(false);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user && !embedded) return <Navigate to="/signin" replace />;
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const x: Dashboard = d.data!;
  const selectedSubject = prefs.data?.papers.find((paper) => paper.id === paperId);
  const focusTopics = selectedSubject ? x.weakTopics.filter((topic) => topic.paper_code === selectedSubject.code) : x.weakTopics;

  const daily = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await api.dailyPractice({ count: 10, ...(paperId ? { paperId } : {}) });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const togglePlan = async (id: string, done: boolean) => {
    setErr(null);
    try {
      await api.updatePlan(id, { done });
      d.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  return (
    <div>
      <TodayHead
        embedded={embedded}
        title="Today"
        subtitle={today()}
        actions={
          <>
            {(prefs.data?.papers.length ?? 0) > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <span className="sr-only">Subject for daily practice</span>
                <select value={paperId} onChange={(e) => setPaperId(e.target.value)} className="h-9 max-w-[14rem] rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none">
                  <option value="">Most recent subject</option>
                  {prefs.data!.papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={daily} disabled={busy} icon={<Zap aria-hidden />}>
              {busy ? 'Picking questions…' : 'Daily practice, 10 questions'}
            </Button>
          </>
        }
      />
      {err && <ErrorBox error={err} />}

      <section aria-label="Today's progress" className="mb-7 grid gap-3 sm:grid-cols-3">
        <Goal label="Questions answered" value={x.today.questionsAnswered} goal={x.today.goal.questionsPerDay} icon={<BookOpen aria-hidden className="size-4" />} accent="bg-[#f5ddd2]" />
        <Goal label="Lessons opened" value={x.today.lessonsOpened} goal={x.today.goal.lessonsPerDay} icon={<Layers aria-hidden className="size-4" />} accent="bg-[#e4edb1]" />
        <Link to="/progress" className="block transition-transform duration-200 hover:-translate-y-0.5">
          <div className="relative h-full overflow-hidden rounded-2xl border border-rule bg-surface p-4 shadow-[0_12px_28px_-25px_rgb(26_34_51/45%)]" data-daily-goal>
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-[#d8c8ea] opacity-45 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e9e1f1] text-[#70539a]"><Activity aria-hidden className="size-4" /></span><span className="text-[10px] font-semibold text-ink-3">ALL TIME</span></div>
            <span className="relative mt-3 block text-xs font-medium text-ink-2">Overall accuracy</span>
            <div className="num relative mt-0.5 text-2xl font-semibold tracking-tight text-ink">{x.totals.accuracy === null ? '–' : `${x.totals.accuracy}%`}</div>
            <div className="relative mt-3"><Meter value={x.totals.accuracy ?? 0} tone={accuracyTone(x.totals.accuracy)} label="Overall accuracy" /></div>
            <p className="relative mt-2 text-[11px] text-ink-3">{x.totals.answered} answers · {x.totals.sessions} {x.totals.sessions === 1 ? 'session' : 'sessions'}</p>
          </div>
        </Link>
      </section>


      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.85fr)]" data-today-columns>
        <section aria-labelledby="plan" className="h-full min-w-0 rounded-2xl border border-rule bg-[linear-gradient(145deg,#f5f7e8_0%,#fffaf1_58%,#f2f4e9_100%)] p-4">
          <SectionTitle id="plan" action={<Link to="/planner" className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft">Open planner</Link>}>
            Today’s focus
          </SectionTitle>
          <p className="-mt-2 mb-2.5 text-xs text-ink-2">A few useful steps to keep your day moving.</p>
          {x.plan.length === 0 ? (
            <Empty icon={<CalendarPlus />}>Nothing planned for today. Add a task in your planner or from a lesson.</Empty>
          ) : (
            <>
              <ul className="grid gap-1.5" id="today-plan-list">
                {(showAllPlan ? x.plan : x.plan.slice(0, 3)).map((p, i) => (
                  <li key={p.id} className={`flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${p.done ? 'border-[#dce8c8] bg-[#f0f5e6]' : 'border-white/80 bg-white/75 hover:border-[#dce6b0]'}`}>
                    <input type="checkbox" checked={p.done} onChange={(e) => togglePlan(p.id, e.target.checked)} aria-label={`Mark “${p.title}” done`} className="mt-0.5 size-4 shrink-0 accent-accent" />
                    <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${p.done ? 'bg-[#dfe9ce] text-forest' : 'bg-[#f5e6d5] text-[#a65a3a]'}`}>{String(i + 1).padStart(2, '0')}</span>
                    <PlanLink kind={p.kind} refId={p.refId} className={`min-w-0 flex-1 text-sm leading-snug ${p.done ? 'text-ink-3 line-through' : 'text-ink'}`}>
                      {p.title}
                    </PlanLink>
                  </li>
                ))}
              </ul>
              {x.plan.length > 3 && <button type="button" aria-expanded={showAllPlan} aria-controls="today-plan-list" onClick={() => setShowAllPlan((value) => !value)} className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft">{showAllPlan ? 'Show fewer tasks' : `See all ${x.plan.length} tasks`}</button>}
            </>
          )}
        </section>

        <aside className="grid min-w-0 content-start gap-4">
          <section aria-labelledby="weak" className="rounded-2xl border border-rule bg-surface p-4" data-focus-subject={selectedSubject?.code ?? 'all'}>
            <SectionTitle id="weak" action={focusTopics.length > 2 ? <button type="button" aria-expanded={showAllWeak} aria-controls="weak-topic-list" onClick={() => setShowAllWeak((value) => !value)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent-soft">{showAllWeak ? 'Less' : `+${focusTopics.length - 2}`}</button> : undefined}>{selectedSubject ? `Focus next · ${selectedSubject.name}` : 'Focus next'}</SectionTitle>
            {focusTopics.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#f2f5e8] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e2ecc7] text-forest"><Target aria-hidden className="size-4" /></span><p className="text-xs leading-relaxed text-ink-2">{selectedSubject ? `No weak topics in ${selectedSubject.name} yet. Choose another subject or keep practising.` : 'Keep practising. We’ll surface a topic here when your results show one needs more work.'}</p></div>
            ) : (
              <ul id="weak-topic-list" className="grid gap-2">
                {(showAllWeak ? focusTopics : focusTopics.slice(0, 2)).map((t) => (
                  <li key={t.id} className="rounded-xl bg-[#faf6f1] p-3">
                    <div className="flex items-start justify-between gap-2"><Link to={`/topic/${t.id}`} className="min-w-0 text-sm font-medium leading-snug text-ink hover:text-accent">{t.title}</Link><span className="num shrink-0 rounded-full bg-[#f6e5dc] px-2 py-1 text-[11px] font-bold text-wrong">{t.accuracy}%</span></div>
                    <div className="mt-2 flex items-center gap-3"><span className="flex-1"><Meter value={t.accuracy} tone={accuracyTone(t.accuracy)} /></span><Link to={`/revise/${t.id}`} className="text-xs font-semibold text-accent hover:underline">Revise</Link></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link to={x.flashcards.due > 0 ? '/bookmarks/review' : '/bookmarks'} data-saved-cards className="flex items-center gap-3 rounded-2xl border border-[#e9d7a6] bg-[linear-gradient(110deg,#fcf5dc,#fffaf0)] p-4 transition-transform hover:-translate-y-0.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3e4af] text-[#93651b]"><BookOpen aria-hidden className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink-2">Revision cards</span><span className="num mt-0.5 block text-lg font-bold text-ink">{x.flashcards.due} <span className="text-xs font-medium text-ink-3">due today</span></span></span>
            <span className="shrink-0 text-xs font-semibold text-accent">{x.flashcards.due > 0 ? 'Review →' : 'Open →'}</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function SubjectTable({ subjects }: { subjects: Dashboard['subjects'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-[13px] text-ink-2">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Subject
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Topics
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Answered
            </th>
            <th scope="col" className="w-40 px-4 py-2.5 font-medium">
              Accuracy
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {subjects.map((s) => (
            <tr key={s.paperCode}>
              <td className="px-4 py-2.5 text-ink">
                {s.paper} <span className="num ml-1 text-xs text-ink-3">{s.paperCode}</span>
              </td>
              <td className="num px-4 py-2.5 text-right text-ink-2">{s.topics}</td>
              <td className="num px-4 py-2.5 text-right text-ink-2">{s.attempted}</td>
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="flex-1">
                    <Meter value={s.accuracy ?? 0} tone={accuracyTone(s.accuracy)} />
                  </span>
                  <span className="num w-10 text-right text-xs text-ink-2">{s.accuracy === null ? '–' : `${s.accuracy}%`}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Links a plan item to what it refers to, when it refers to something. */
export function PlanLink({ kind, refId, targetCount, latestSessionId, className, children }: { kind: string; refId: string | null; targetCount?: number | null; latestSessionId?: string | null; className?: string; children: React.ReactNode }) {
  const to = planHref({ kind, refId, targetCount, latestSessionId }) ?? undefined;
  return to ? (
    <Link to={to} className={`${className ?? ''} hover:text-accent`}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
