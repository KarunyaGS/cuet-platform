import { useState } from 'react';
import { Navigate } from 'react-router';
import { api, localDay, type PlanItem } from '../api';
import { Button, ErrorBox, Loading, PageHeader, useAuth, useLoad } from '../ui';
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
        subtitle={total ? `${done} of ${total} done this week` : 'Plan topics, lessons, practice and mocks day by day'}
        actions={
          <>
            <Button kind="secondary" onClick={() => setWeek(addDays(week, -7))}>
              ← Previous
            </Button>
            <Button kind="secondary" onClick={() => setWeek(mondayOf(today))} disabled={week === mondayOf(today)}>
              This week
            </Button>
            <Button kind="secondary" onClick={() => setWeek(addDays(week, 7))}>
              Next →
            </Button>
          </>
        }
      />
      {err && <ErrorBox error={err} />}
      {plan.loading && !plan.data ? (
        <Loading />
      ) : plan.error ? (
        <ErrorBox error={plan.error} onRetry={plan.reload} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
    <section className={`flex min-h-40 flex-col rounded-lg border bg-white ${today ? 'border-[var(--color-accent)]' : 'border-zinc-200'}`}>
      <h2 className={`border-b px-2.5 py-1.5 text-xs font-semibold ${today ? 'border-[var(--color-accent)]/30 text-[var(--color-accent)]' : 'border-zinc-100 text-zinc-600'}`}>
        {label(day)}
        {today && ' · today'}
      </h2>
      <ul className="flex-1 divide-y divide-zinc-50">
        {items.map((p) => (
          <li key={p.id} className="group flex items-start gap-1.5 px-2 py-1.5 text-sm">
            <input type="checkbox" checked={p.done} onChange={(e) => act(() => api.updatePlan(p.id, { done: e.target.checked }))} aria-label={`Mark “${p.title}” done`} className="mt-0.5 size-3.5 shrink-0 accent-[var(--color-accent)]" />
            <span className="min-w-0 flex-1">
              <PlanLink kind={p.kind} refId={p.refId} className={`block break-words leading-snug ${p.done ? 'text-zinc-400 line-through' : ''}`}>
                {p.title}
              </PlanLink>
              <span className="text-[10px] uppercase tracking-wide text-zinc-400">{KIND_LABEL[p.kind] ?? p.kind}</span>
            </span>
            <span className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100">
              {!p.done && (
                <button type="button" title="Move to the next day" aria-label="Move to the next day" onClick={() => act(() => api.updatePlan(p.id, { day: addDays(day, 1) }))} className="rounded px-1 text-xs text-zinc-500 hover:bg-zinc-100">
                  →
                </button>
              )}
              <button type="button" title="Remove" aria-label="Remove" onClick={() => act(() => api.deletePlan(p.id))} className="rounded px-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-700">
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      {!past && (
        <form
          className="flex gap-1 border-t border-zinc-100 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void act(() => api.addPlan({ day, kind: 'CUSTOM', title: title.trim() })).then(() => setTitle(''));
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" maxLength={200} aria-label={`Add a task on ${label(day)}`} className="min-w-0 flex-1 rounded border border-zinc-200 px-1.5 py-0.5 text-xs" />
          <button type="submit" className="rounded bg-zinc-900 px-1.5 text-xs font-medium text-white disabled:opacity-40" disabled={!title.trim()}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}
