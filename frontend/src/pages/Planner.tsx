import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { api, localDay, type PlanItem } from '../api';
import { Button, ErrorBox, Loading, useAuth, useLoad } from '../ui';
import { PlanLink } from './Dashboard';
import { PLAN_KIND_LABEL } from '../planLinks';
import { PlanSection } from './planner/PlanSection';
import { playUiSound } from '../sound';
import { planHref } from '../planLinks';

const KIND_LABEL: Record<string, string> = { ...PLAN_KIND_LABEL, TOPIC: 'Topic', LESSON: 'Lesson', PRACTICE: 'Practice', MOCK: 'Mock' };

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
const weekLabel = (first: string, last: string) => {
  const format = (day: string, options: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, options);
  };
  return `${format(first, { month: 'short', day: 'numeric' })} — ${format(last, { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

/** A week-by-week study planner. Items come from "Add to plan" buttons or are typed here. */
export function PlannerPage() {
  const { user, ready } = useAuth();
  const today = localDay();
  const [week, setWeek] = useState(mondayOf(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const plan = useLoad(() => api.plan(days[0]!, days[6]!), [week, user?.id]);
  const [err, setErr] = useState<Error | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const taskTrigger = useRef<HTMLElement | null>(null);
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
  const todayTasks = byDay.get(today) ?? [];
  const selectedTask = plan.data?.find((item) => item.id === selectedTaskId) ?? null;
  const openTask = (id: string, trigger: HTMLElement) => {
    taskTrigger.current = trigger;
    setSelectedTaskId(id);
  };
  const closeTask = () => {
    setSelectedTaskId(null);
    window.requestAnimationFrame(() => taskTrigger.current?.focus());
  };
  const toggleTaskComplete = async () => {
    if (!selectedTask) return;
    setSavingTask(true);
    setErr(null);
    try {
      await api.updatePlan(selectedTask.id, { done: !selectedTask.done });
      if (!selectedTask.done) playUiSound('complete');
      plan.reload();
      closeTask();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div>
      <header data-planner-hero className="relative mb-6 w-full overflow-hidden rounded-[22px] border border-[#d5df98] bg-[#e8edb8] px-4 py-4 text-forest shadow-[0_12px_28px_-24px_rgb(70_92_38/0.3)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="label inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[10px] tracking-[0.18em] text-forest"><Sparkles aria-hidden className="size-3 text-terracotta" />MAKE ROOM FOR WHAT MATTERS</div>
            <h1 className="mt-3 text-[clamp(27px,3vw,38px)] leading-[1.04] font-bold tracking-[-0.045em]">Your week, <span className="font-editorial font-medium text-terracotta italic">in focus.</span></h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2"><CalendarDays aria-hidden className="size-4 text-forest" />{weekLabel(days[0]!, days[6]!)}<span className="rounded-full border border-forest/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-forest">{todayTasks.length ? `${todayTasks.length} tasks for today` : 'No tasks for today'}</span><span className="hidden text-forest/30 sm:inline">·</span><span className="hidden sm:inline">{total ? `${done} of ${total} tasks complete` : 'A little planning goes a long way'}</span></p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div aria-hidden data-week-widget className="hidden items-center gap-1.5 rounded-[18px] border border-white/80 bg-[#fffaf0]/90 px-3 py-2 shadow-[0_8px_22px_rgb(24_68_59/0.08)] sm:flex">
              <span className="label mr-1 text-[8px] tracking-[0.12em] text-terracotta">WEEK</span>
              {days.map((day) => {
                const dayItems = byDay.get(day) ?? [];
                const dayName = label(day).split(',')[0]?.slice(0, 1);
                return <span key={day} className="grid justify-items-center gap-1"><span className={`grid size-[23px] place-items-center rounded-full text-[9px] font-bold ${day === today ? 'bg-terracotta text-white shadow-[0_3px_8px_rgb(196_94_66/0.28)]' : dayItems.length ? 'bg-forest text-lime' : 'bg-[#edf1d9] text-forest'}`}>{day.slice(-2)}</span><span className={`text-[8px] font-semibold leading-none ${dayItems.length ? 'text-forest' : 'text-ink-3'}`}>{dayName}</span></span>;
              })}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/65 p-1.5 shadow-sm backdrop-blur-sm">
              <Button kind="ghost" size="sm" className="!text-forest hover:!bg-forest/5" onClick={() => setWeek(addDays(week, -7))} icon={<ChevronLeft aria-hidden />} title="Previous week"><span className="sr-only">Previous week</span></Button>
              <Button kind="secondary" size="sm" onClick={() => setWeek(mondayOf(today))} disabled={week === mondayOf(today)} className="!border-0 !bg-forest !text-lime hover:!bg-forest-deep">This week</Button>
              <Button kind="ghost" size="sm" className="!text-forest hover:!bg-forest/5" onClick={() => setWeek(addDays(week, 7))} icon={<ChevronRight aria-hidden />} title="Next week"><span className="sr-only">Next week</span></Button>
            </div>
          </div>
        </div>
        <div className="relative mt-6 flex items-center gap-3 border-t border-forest/15 pt-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forest/20"><div className="planner-progress h-full rounded-full bg-forest shadow-[0_0_14px_rgb(24_68_59/0.28)]" style={{ width: `${total ? (100 * done) / total : 0}%` }} /></div>
          <span className="num min-w-14 rounded-full bg-terracotta px-2.5 py-1 text-right text-[10px] font-bold tracking-wide text-white shadow-sm">{total ? `${Math.round((100 * done) / total)}%` : 'READY'}</span>
        </div>
      </header>
      <PlanSection onChange={plan.reload} />
      {err && <ErrorBox error={err} />}
      {plan.loading && !plan.data ? (
        <Loading />
      ) : plan.error ? (
        <ErrorBox error={plan.error} onRetry={plan.reload} />
      ) : (
        <div id="planner-calendar" data-planner-grid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {days.map((day) => (
            <DayColumn key={day} day={day} today={day === today} past={day < today} items={byDay.get(day) ?? []} act={act} onOpenTask={openTask} />
          ))}
        </div>
      )}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          saving={savingTask}
          error={err}
          onClose={closeTask}
          onToggleComplete={() => void toggleTaskComplete()}
          onMoveToNextDay={async () => {
            try { await api.updatePlan(selectedTask.id, { day: addDays(selectedTask.day, 1) }); plan.reload(); closeTask(); }
            catch (e) { setErr(e as Error); }
          }}
          onRemove={async () => {
            try { await api.deletePlan(selectedTask.id); plan.reload(); closeTask(); }
            catch (e) { setErr(e as Error); }
          }}
        />
      )}
    </div>
  );
}

function TaskDetailDialog({ task, saving, error, onClose, onToggleComplete, onMoveToNextDay, onRemove }: {
  task: PlanItem;
  saving: boolean;
  error: Error | null;
  onClose: () => void;
  onToggleComplete: () => void;
  onMoveToNextDay: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const href = planHref({ kind: task.kind, refId: task.refId, targetCount: task.targetCount });
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Focus and Escape behavior are tied to the task currently shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);
  return (
    <div className="task-dialog-backdrop fixed inset-0 z-[60] grid place-items-center bg-forest-deep/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} data-task-dialog-overlay>
      <section role="dialog" aria-modal="true" aria-labelledby="planner-task-title" aria-describedby="planner-task-meta" className="task-dialog-card relative w-full max-w-md overflow-hidden rounded-[24px] border border-line/80 bg-surface shadow-[0_30px_70px_-30px_rgb(15_45_38/0.6)]" data-task-dialog>
        <div className="h-1.5 bg-gradient-to-r from-forest via-[#91a94a] to-lime" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${task.done ? 'bg-forest text-lime' : 'bg-[#eef3d2] text-forest'}`}>{task.done ? <Check aria-hidden className="size-5" /> : <span className="size-2.5 rounded-full bg-terracotta" />}</span>
            <div className="min-w-0 flex-1">
              <p id="planner-task-meta" className="text-xs font-semibold text-ink-3">{KIND_LABEL[task.kind] ?? task.kind}{task.minutes ? ` · ${task.minutes} min` : ''}{task.targetCount ? ` · ${task.targetCount} questions` : ''}</p>
              <h2 id="planner-task-title" className="mt-1 text-lg leading-snug font-bold text-forest">{task.title}</h2>
            </div>
            <button ref={closeButton} type="button" onClick={onClose} aria-label="Close task details" className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"><X aria-hidden className="size-4" /></button>
          </div>
          {task.note && <p className="mt-4 rounded-xl border border-rule bg-paper/60 px-3.5 py-3 text-sm leading-relaxed text-ink-2">{task.note}</p>}
          {task.planId && <p className="mt-3 text-xs text-ink-3">Suggested for your study plan, based on your selected subjects and progress.</p>}
          {error && <p role="alert" className="mt-3 rounded-lg bg-wrong-soft px-3 py-2 text-sm text-wrong">{error.message}</p>}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button onClick={onToggleComplete} disabled={saving} icon={<Check aria-hidden className="size-4" />}>
              {saving ? 'Saving…' : task.done ? 'Mark as not done' : 'Mark as complete'}
            </Button>
            {href && <PlanLink kind={task.kind} refId={task.refId} targetCount={task.targetCount} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rule px-3 text-sm font-semibold text-forest transition-colors hover:bg-paper">Open activity <ArrowRight aria-hidden className="size-4" /></PlanLink>}
          </div>
          <details className="mt-4 border-t border-rule pt-3">
            <summary className="cursor-pointer text-xs font-medium text-ink-3">More task options</summary>
            {confirmRemove ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                Remove this task from your calendar?
                <button type="button" className="font-semibold text-wrong hover:underline" onClick={() => void onRemove()}>Remove task</button>
                <button type="button" className="font-semibold text-ink-2 hover:underline" onClick={() => setConfirmRemove(false)}>Keep task</button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button type="button" data-sound="move" className="font-semibold text-ink-2 hover:text-accent hover:underline" onClick={() => void onMoveToNextDay()}>Move to next day</button>
                <button type="button" className="font-semibold text-wrong hover:underline" onClick={() => setConfirmRemove(true)}>Remove from calendar</button>
              </div>
            )}
          </details>
        </div>
      </section>
    </div>
  );
}

function DayColumn({ day, today, past, items, act, onOpenTask }: { day: string; today: boolean; past: boolean; items: PlanItem[]; act: (f: () => Promise<unknown>) => Promise<void>; onOpenTask: (id: string, trigger: HTMLElement) => void }) {
  const [title, setTitle] = useState('');
  const [weekday, date] = label(day).split(', ');
  const dayNumber = Number(day.slice(-2));
  return (
    <section data-planner-day data-today={today ? '' : undefined} className={`group/day flex min-h-[148px] flex-col overflow-hidden rounded-[20px] border transition duration-300 ${today ? 'planner-today-arrive is-today border-forest/25 bg-gradient-to-b from-[#f0f5df] to-surface shadow-[0_18px_40px_-26px_rgb(24_68_59/0.55)] ring-2 ring-lime' : 'border-rule/80 bg-surface shadow-[0_12px_30px_-26px_rgb(24_68_59/0.4)]'} ${past ? 'opacity-75' : ''}`}>
      <h2 className={`flex items-center gap-3 border-b px-3 py-2.5 ${today ? 'border-forest/10' : 'border-rule/70'}`}>
        <span className={`grid size-11 shrink-0 place-items-center rounded-[15px] text-lg font-bold tracking-tight transition-transform duration-300 group-hover/day:-rotate-6 group-hover/day:scale-105 ${today ? 'bg-forest text-lime shadow-[0_6px_14px_rgb(24_68_59/0.2)]' : 'bg-paper text-forest'}`}>{dayNumber}</span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-forest">{weekday}</span><span className="mt-0.5 block text-[11px] font-normal text-ink-3">{date}</span></span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${today ? 'bg-lime text-forest' : 'bg-paper text-ink-3'}`}>{today ? items.length ? `TODAY · ${items.length} TASKS` : 'TODAY' : `${items.length} ${items.length === 1 ? 'TASK' : 'TASKS'}`}</span>
      </h2>
      <ul className="flex-1 space-y-1.5 p-2">
        {items.map((p, index) => (
          <li key={p.id} data-plan-item data-expert-plan={p.planId ? 'true' : undefined}>
            <button type="button" onClick={(event) => onOpenTask(p.id, event.currentTarget)} aria-label={`Open task ${index + 1}: ${p.title}${p.done ? ', completed' : ''}`} data-sound="open" aria-haspopup="dialog" className={`group/task flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${p.done ? 'border-forest/15 bg-[#f0f3e8]/75 text-ink-3' : p.planId ? 'border-[#d5df98] bg-[#fbfced] text-ink hover:border-forest/25' : 'border-rule/60 bg-white/80 text-ink hover:border-forest/20'}`} data-task-trigger>
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${p.done ? 'bg-forest text-lime' : 'bg-paper text-forest group-hover/task:bg-lime'}`}>{p.done ? <Check aria-hidden className="size-4" /> : index + 1}</span>
              <span className="min-w-0 flex-1 text-xs font-semibold">Task {index + 1}</span>
              {p.done && <span className="text-[10px] font-medium text-forest">Done</span>}
              <ArrowRight aria-hidden className="size-3.5 shrink-0 text-ink-3 transition-transform group-hover/task:translate-x-0.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="flex min-h-8 items-center justify-between rounded-lg px-1.5 py-1 text-[10px] text-ink-3"><span>Nothing planned</span><span className="rounded-full bg-paper px-2 py-0.5 font-medium">0 tasks</span></li>}
      </ul>
      {!past && (
        <form
          className="flex gap-1.5 border-t border-rule/70 bg-paper/55 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void act(() => api.addPlan({ day, kind: 'CUSTOM', title: title.trim() })).then(() => setTitle(''));
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" maxLength={200} aria-label={`Add a task on ${label(day)}`} className="h-9 min-w-0 flex-1 rounded-xl border border-rule bg-surface px-2.5 text-[12px] placeholder:text-ink-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime" />
          <button type="submit" data-sound="add" className="grid size-9 shrink-0 place-items-center rounded-xl bg-forest text-lime shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-forest-deep disabled:opacity-40" disabled={!title.trim()} aria-label="Add task">
            <Plus aria-hidden className="size-4" />
          </button>
        </form>
      )}
    </section>
  );
}
