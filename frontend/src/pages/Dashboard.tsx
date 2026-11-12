import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api, type Dashboard } from '../api';
import { Button, Empty, ErrorBox, Loading, PageHeader, useAuth, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };

function Meter({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = goal ? Math.min(100, Math.round((100 * value) / goal)) : 100;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
        {value >= goal && goal > 0 && <span className="normal-case text-emerald-700">Goal reached</span>}
      </div>
      <div className="num text-lg font-semibold">
        {value} <span className="text-sm font-normal text-zinc-500">/ {goal}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-100" aria-hidden>
        <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-[var(--color-accent)]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The signed-in student's home: today's goals, continue learning, today's plan, weak topics and subjects. */
export function DashboardPage() {
  const { user, ready } = useAuth();
  const d = useLoad(api.dashboard, [user?.id]);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (d.loading) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const x: Dashboard = d.data!;

  const daily = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await api.dailyPractice({ count: 10 });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const togglePlan = async (id: string, done: boolean) => {
    await api.updatePlan(id, { done });
    d.reload();
  };

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.displayName ?? ''}`}
        subtitle="Your study for today"
        actions={
          <Button onClick={daily} disabled={busy}>
            {busy ? 'Picking questions…' : 'Daily practice · 10 questions'}
          </Button>
        }
      />
      {err && <ErrorBox error={err} />}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Meter label="Questions today" value={x.today.questionsAnswered} goal={x.today.goal.questionsPerDay} />
        <Meter label="Lessons today" value={x.today.lessonsOpened} goal={x.today.goal.lessonsPerDay} />
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Accuracy</div>
          <div className="num text-lg font-semibold">{x.totals.accuracy === null ? '–' : `${x.totals.accuracy}%`}</div>
          <div className="text-[11px] text-zinc-500">{x.totals.answered} answered in all</div>
        </div>
        <Link to="/bookmarks" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:border-[var(--color-accent)]">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Bookmarks</div>
          <div className="num text-lg font-semibold">{x.bookmarks}</div>
          <div className="text-[11px] text-[var(--color-accent)]">Open →</div>
        </Link>
      </div>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">
        Daily goals can be changed on your{' '}
        <Link to="/profile" className="underline">
          profile
        </Link>
        .
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-1.5 text-sm font-semibold">Continue learning</h2>
          {x.inProgress.length === 0 && x.continueLearning.length === 0 ? (
            <Empty>
              Nothing yet. Pick a subject from{' '}
              <Link to="/CUET_UG" className="underline">
                CUET-UG
              </Link>{' '}
              or{' '}
              <Link to="/CUET_PG" className="underline">
                CUET-PG
              </Link>{' '}
              to start.
            </Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {x.inProgress.map((s) => (
                <li key={s.id}>
                  <Link to={`/practice/${s.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50">
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Unfinished</span>
                    <span className="min-w-0 flex-1 truncate">
                      {MODE[s.mode] ?? s.mode} · {s.topic ?? s.paper ?? ''}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-accent)]">Resume →</span>
                  </Link>
                </li>
              ))}
              {x.continueLearning.map((c) => (
                <li key={`${c.kind}-${c.resourceId ?? c.nodeId}`}>
                  <Link to={c.kind === 'LESSON_VIEW' ? `/learn/${c.resourceId}` : `/topic/${c.nodeId}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50">
                    <span className="w-12 shrink-0 text-[11px] text-zinc-400">{c.kind === 'LESSON_VIEW' ? 'Lesson' : 'Topic'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.title ?? '(no longer available)'}</span>
                      <span className="block text-[11px] text-zinc-500">{c.paper}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Today’s plan</h2>
            <Link to="/planner" className="text-xs text-[var(--color-accent)] hover:underline">
              Open planner →
            </Link>
          </div>
          {x.plan.length === 0 ? (
            <Empty>No plan for today. Use “Add to plan” on any topic or lesson, or open the planner.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {x.plan.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={p.done} onChange={(e) => togglePlan(p.id, e.target.checked)} aria-label={`Mark “${p.title}” done`} className="size-4 accent-[var(--color-accent)]" />
                  <PlanLink kind={p.kind} refId={p.refId} className={`min-w-0 flex-1 truncate ${p.done ? 'text-zinc-400 line-through' : ''}`}>
                    {p.title}
                  </PlanLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1.5 text-sm font-semibold">Weak topics to revise</h2>
          {x.weakTopics.length === 0 ? (
            <Empty>No weak topics yet. A topic shows here when accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {x.weakTopics.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Link to={`/topic/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {t.title}
                  </Link>
                  <Link to={`/revise/${t.id}`} className="shrink-0 text-xs text-[var(--color-accent)] hover:underline">
                    Revise
                  </Link>
                  <span className="num w-10 shrink-0 text-right text-xs text-red-700">{t.accuracy}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Subjects</h2>
            <Link to="/progress" className="text-xs text-[var(--color-accent)] hover:underline">
              Full progress →
            </Link>
          </div>
          {x.subjects.length === 0 ? (
            <Empty>Submit a practice set or test to see subject-wise progress.</Empty>
          ) : (
            <SubjectTable subjects={x.subjects} />
          )}
        </section>
      </div>
    </div>
  );
}

export function SubjectTable({ subjects }: { subjects: Dashboard['subjects'] }) {
  return (
    <table className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm">
      <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
        <tr>
          <th className="px-3 py-1.5 font-medium">Subject</th>
          <th className="px-3 py-1.5 text-right font-medium">Topics</th>
          <th className="px-3 py-1.5 text-right font-medium">Answered</th>
          <th className="px-3 py-1.5 text-right font-medium">Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((s) => (
          <tr key={s.paperCode} className="border-t border-zinc-100">
            <td className="px-3 py-1.5">
              {s.paper} <span className="font-mono text-[11px] text-zinc-400">{s.paperCode}</span>
            </td>
            <td className="num px-3 py-1.5 text-right">{s.topics}</td>
            <td className="num px-3 py-1.5 text-right">{s.attempted}</td>
            <td className={`num px-3 py-1.5 text-right ${s.accuracy !== null && s.accuracy < 60 ? 'text-red-700' : ''}`}>{s.accuracy === null ? '–' : `${s.accuracy}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Links a plan item to what it refers to, when it refers to something. */
export function PlanLink({ kind, refId, className, children }: { kind: string; refId: string | null; className?: string; children: React.ReactNode }) {
  const to = refId ? ({ TOPIC: `/topic/${refId}`, LESSON: `/learn/${refId}` } as Record<string, string>)[kind] : undefined;
  return to ? (
    <Link to={to} className={`${className ?? ''} hover:underline`}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
