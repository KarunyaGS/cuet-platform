import { LatestUpdates } from './Updates';
import { BookOpen, CalendarPlus, CalendarRange, CircleCheck, Layers, PlayCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api, type Dashboard } from '../api';
import { accuracyTone, Button, ButtonLink, Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, useAuth, useLoad } from '../ui';

const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };
const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** One goal: count against target with a bar. */
function Goal({ label, value, goal, to }: { label: string; value: number; goal: number; to?: string }) {
  const reached = goal > 0 && value >= goal;
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-2">{label}</span>
        {reached && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-correct">
            <CircleCheck aria-hidden className="size-3.5" />
            Goal reached
          </span>
        )}
      </div>
      <div className="num mt-1 text-2xl font-semibold text-ink">
        {value} <span className="text-base font-normal text-ink-3">/ {goal}</span>
      </div>
      <div className="mt-2.5">
        <Meter value={goal ? (100 * value) / goal : 0} tone={reached ? 'correct' : 'accent'} label={`${label} against your daily goal`} />
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="block px-5 py-4 transition-colors hover:bg-paper">
      {body}
    </Link>
  ) : (
    <div className="px-5 py-4">{body}</div>
  );
}

const row = 'flex items-center gap-3 px-4 py-3 text-sm';

/** The signed-in student's day: goals, where they left off, today's plan, weak topics and subjects. */
export function DashboardPage() {
  const { user, ready } = useAuth();
  const d = useLoad(api.dashboard, [user?.id]);
  const prefs = useLoad(api.preferences, [user?.id]);
  const [paperId, setPaperId] = useState('');
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const x: Dashboard = d.data!;

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
  const nothingYet = x.inProgress.length === 0 && x.continueLearning.length === 0;

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={today()}
        actions={
          <>
            <ButtonLink to="/report" icon={<CalendarRange aria-hidden />}>
              Weekly report
            </ButtonLink>
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

      <section aria-label="Today's goals" className="grid-cols-1 mb-2 grid divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Goal label="Questions answered" value={x.today.questionsAnswered} goal={x.today.goal.questionsPerDay} />
        <Goal label="Lessons opened" value={x.today.lessonsOpened} goal={x.today.goal.lessonsPerDay} />
        <Link to="/progress" className="block px-5 py-4 transition-colors hover:bg-paper">
          <span className="text-sm text-ink-2">Overall accuracy</span>
          <div className="num mt-1 text-2xl font-semibold text-ink">{x.totals.accuracy === null ? '–' : `${x.totals.accuracy}%`}</div>
          <div className="mt-1.5 text-xs text-ink-3">
            {x.totals.answered} answered in {x.totals.sessions} submitted {x.totals.sessions === 1 ? 'session' : 'sessions'}
          </div>
        </Link>
      </section>
      <p className="mb-10 text-xs text-ink-3">
        Change your daily goals on your{' '}
        <Link to="/profile" className="underline underline-offset-2 hover:text-accent">
          profile
        </Link>
        .
      </p>

      <section aria-label="Revision" className="mb-10 overflow-hidden rounded-xl border border-rule bg-surface">
        <Link to={x.flashcards.due > 0 ? '/bookmarks/review' : '/bookmarks'} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
          <span className="min-w-0 flex-1">
            <span className="text-sm text-ink-2">Saved cards due today</span>
            <span className={`num mt-1 block text-2xl font-semibold ${x.flashcards.due > 0 ? 'text-marker' : 'text-ink'}`}>{x.flashcards.due}</span>
            <span className="mt-1.5 block text-xs text-ink-3">
              {x.flashcards.total === 0 ? 'Tap the bookmark icon under a definition or a formula in any lesson to save it for revision' : x.flashcards.due > 0 ? `of ${x.flashcards.total} cards in all` : `All ${x.flashcards.total} cards are up to date`}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-accent">{x.flashcards.due > 0 ? 'Revise now' : 'My bookmarks'}</span>
        </Link>
      </section>

      <LatestUpdates exam={prefs.data?.examCode ?? null} />

      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="continue">
          <SectionTitle id="continue">Continue learning</SectionTitle>
          {nothingYet ? (
            <Empty icon={<BookOpen />}>
              Nothing here yet. Choose a subject from{' '}
              <Link to="/CUET_UG" className="font-medium text-accent hover:underline">
                CUET-UG
              </Link>{' '}
              or{' '}
              <Link to="/CUET_PG" className="font-medium text-accent hover:underline">
                CUET-PG
              </Link>{' '}
              and open a topic.
            </Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {x.inProgress.map((s) => (
                <li key={s.id}>
                  <Link to={`/practice/${s.id}`} className={`${row} transition-colors hover:bg-paper`}>
                    <PlayCircle aria-hidden className="size-[18px] shrink-0 text-marker" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {MODE[s.mode] ?? s.mode}: {s.topic ?? s.paper ?? ''}
                      </span>
                      <span className="block text-xs text-marker">Unfinished, your answers are saved</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-accent">Resume</span>
                  </Link>
                </li>
              ))}
              {x.continueLearning.map((c) => (
                <li key={`${c.kind}-${c.resourceId ?? c.nodeId}`}>
                  <Link to={c.kind === 'LESSON_VIEW' ? `/learn/${c.resourceId}` : `/topic/${c.nodeId}`} className={`${row} transition-colors hover:bg-paper`}>
                    {c.kind === 'LESSON_VIEW' ? <BookOpen aria-hidden className="size-[18px] shrink-0 text-ink-3" /> : <Layers aria-hidden className="size-[18px] shrink-0 text-ink-3" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{c.title ?? '(no longer available)'}</span>
                      <span className="block text-xs text-ink-3">
                        {c.kind === 'LESSON_VIEW' ? 'Lesson' : 'Topic'}
                        {c.paper ? `, ${c.paper}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="plan">
          <SectionTitle
            id="plan"
            action={
              <Link to="/planner" className="font-medium text-accent hover:underline">
                Open planner
              </Link>
            }
          >
            Today’s plan
          </SectionTitle>
          {x.plan.length === 0 ? (
            <Empty icon={<CalendarPlus />}>Nothing planned for today. Use “Add to plan” on any topic or lesson, or add tasks in the planner.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {x.plan.map((p) => (
                <li key={p.id} className={row}>
                  <input type="checkbox" checked={p.done} onChange={(e) => togglePlan(p.id, e.target.checked)} aria-label={`Mark “${p.title}” done`} className="size-4 shrink-0 accent-accent" />
                  <PlanLink kind={p.kind} refId={p.refId} className={`min-w-0 flex-1 truncate ${p.done ? 'text-ink-3 line-through' : 'text-ink'}`}>
                    {p.title}
                  </PlanLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="weak">
          <SectionTitle id="weak">Weak topics to revise</SectionTitle>
          {x.weakTopics.length === 0 ? (
            <Empty icon={<CircleCheck />}>No weak topics yet. A topic appears here when your accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {x.weakTopics.map((t) => (
                <li key={t.id} className={row}>
                  <span className="min-w-0 flex-1">
                    <Link to={`/topic/${t.id}`} className="block truncate text-ink hover:text-accent">
                      {t.title}
                    </Link>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="w-28">
                        <Meter value={t.accuracy} tone={accuracyTone(t.accuracy)} />
                      </span>
                      <span className="num text-xs text-wrong">{t.accuracy}%</span>
                    </span>
                  </span>
                  <Link to={`/revise/${t.id}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
                    Revise
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="subjects">
          <SectionTitle
            id="subjects"
            action={
              <Link to="/progress" className="font-medium text-accent hover:underline">
                Full progress
              </Link>
            }
          >
            Subjects
          </SectionTitle>
          {x.subjects.length === 0 ? <Empty>Submit a practice set or test to see your progress by subject.</Empty> : <SubjectTable subjects={x.subjects} />}
        </section>
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
export function PlanLink({ kind, refId, className, children }: { kind: string; refId: string | null; className?: string; children: React.ReactNode }) {
  const to = refId ? ({ TOPIC: `/topic/${refId}`, LESSON: `/learn/${refId}` } as Record<string, string>)[kind] : undefined;
  return to ? (
    <Link to={to} className={`${className ?? ''} hover:text-accent`}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
