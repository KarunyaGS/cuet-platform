import { ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { api, localDay, type PlanItem } from '../api';
import { Button, ErrorBox, Loading, Meter, PageHeader, useAuth, useLoad } from '../ui';
import { PlanLink } from './Dashboard';

const KIND_LABEL: Record<string, string> = { TOPIC: 'Topic', LESSON: 'Lesson', PRACTICE: 'Practice', MOCK: 'Mock', CUSTOM: 'Task' };

function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y!, m! - 1, d! + n));
}
function mondayOf(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return addDays(day, -((dt.getDay() + 6) % 7));
}
const label = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** A week-by-week study planner. Items come from "Add to plan" buttons or are typed here. */
export function PlannerPage() {
  const { user, ready } = useAuth();
  const today = localDay();
  const [week, setWeek] = useState(mondayOf(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const plan = useLoad(() => api.plan(days[0]!, days[6]!), [week, user?.id]);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;

  const act = async (f: () => Promise<unknown>) => {
    setErr(null);
    try {
      await f();
      plan.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  const byDay = new Map<string, PlanItem[]>();
  for (const p of plan.data ?? []) byDay.set(p.day, [...(byDay.get(p.day) ?? []), p]);
  const total = plan.data?.length ?? 0;
  const done = plan.data?.filter((p) => p.done).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Study planner"
        subtitle={total ? `${done} of ${total} tasks done this week.` : 'Plan topics, lessons, practice and mocks day by day.'}
        actions={
          <div className="flex items-center gap-1">
            <Button kind="secondary" size="sm" onClick={() => setWeek(addDays(week, -7))} icon={<ChevronLeft aria-hidden />} title="Previous week">
              <span className="sr-only">Previous week</span>
            </Button>
            <Button kind="secondary" size="sm" onClick={() => setWeek(mondayOf(today))} disabled={week === mondayOf(today)}>
              This week
            </Button>
            <Button kind="secondary" size="sm" onClick={() => setWeek(addDays(week, 7))} icon={<ChevronRight aria-hidden />} title="Next week">
              <span className="sr-only">Next week</span>
            </Button>
          </div>
        }
      />
      {total > 0 && (
        <div className="mb-6 max-w-sm">
          <Meter value={(100 * done) / total} tone={done === total ? 'correct' : 'accent'} label="Tasks done this week" />
        </div>
      )}
      {err && <ErrorBox error={err} />}
      {plan.loading && !plan.data ? (
        <Loading />
      ) : plan.error ? (
        <ErrorBox error={plan.error} onRetry={plan.reload} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {days.map((day) => (
            <DayColumn key={day} day={day} today={day === today} past={day < today} items={byDay.get(day) ?? []} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayColumn({ day, today, past, items, act }: { day: string; today: boolean; past: boolean; items: PlanItem[]; act: (f: () => Promise<unknown>) => Promise<void> }) {
  const [title, setTitle] = useState('');
  return (
    <section className={`flex min-h-44 flex-col overflow-hidden rounded-xl border bg-surface ${today ? 'border-accent/60 ring-1 ring-accent/30' : 'border-rule'} ${past ? 'opacity-80' : ''}`}>
      <h2 className={`flex items-baseline justify-between border-b px-3 py-2 text-sm font-semibold ${today ? 'border-accent/20 bg-accent-soft text-accent' : 'border-rule text-ink'}`}>
        {label(day)}
        {today && <span className="text-xs font-medium">Today</span>}
      </h2>
      <ul className="flex-1 divide-y divide-rule">
        {items.map((p) => (
          <li key={p.id} className="group flex items-start gap-2 px-3 py-2 text-sm">
            <input type="checkbox" checked={p.done} onChange={(e) => act(() => api.updatePlan(p.id, { done: e.target.checked }))} aria-label={`Mark “${p.title}” done`} className="mt-0.5 size-4 shrink-0 accent-accent" />
            <span className="min-w-0 flex-1">
              <PlanLink kind={p.kind} refId={p.refId} className={`block leading-snug break-words ${p.done ? 'text-ink-3 line-through' : 'text-ink'}`}>
                {p.title}
              </PlanLink>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-3">{KIND_LABEL[p.kind] ?? p.kind}</span>
            <span className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!p.done && (
                <button type="button" title="Move to the next day" aria-label="Move to the next day" onClick={() => act(() => api.updatePlan(p.id, { day: addDays(day, 1) }))} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink">
                  <ArrowRight aria-hidden className="size-3.5" />
                </button>
              )}
              <button type="button" title="Remove" aria-label="Remove" onClick={() => act(() => api.deletePlan(p.id))} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-wrong-soft hover:text-wrong">
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </span>
              </span>
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-3 text-xs text-ink-3">{past ? 'Nothing was planned.' : 'Nothing planned yet.'}</li>}
      </ul>
      {!past && (
        <form
          className="flex gap-1.5 border-t border-rule p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void act(() => api.addPlan({ day, kind: 'CUSTOM', title: title.trim() })).then(() => setTitle(''));
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" maxLength={200} aria-label={`Add a task on ${label(day)}`} className="h-8 min-w-0 flex-1 rounded-lg border border-rule-strong px-2 text-[13px] placeholder:text-ink-3 focus:border-accent focus:outline-none" />
          <button type="submit" className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white hover:bg-accent-strong disabled:opacity-40" disabled={!title.trim()} aria-label="Add task">
            <Plus aria-hidden className="size-4" />
          </button>
        </form>
      )}
    </section>
  );
}
