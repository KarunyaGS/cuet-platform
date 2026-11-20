import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { api, localDay, type PlanItem } from '../api';
import { Button, ErrorBox, Loading, Meter, useAuth, useLoad } from '../ui';
import { PlanLink } from './Dashboard';
import { PLAN_KIND_LABEL } from '../planLinks';
import { PlanSection } from './planner/PlanSection';
import { playUiSound } from '../sound';

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
      <header data-planner-hero className="relative mb-6 w-full overflow-hidden rounded-[22px] border border-[#d5df98] bg-[#e8edb8] px-4 py-4 text-forest shadow-[0_12px_28px_-24px_rgb(70_92_38/0.3)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="label inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[10px] tracking-[0.18em] text-forest"><Sparkles aria-hidden className="size-3 text-terracotta" />MAKE ROOM FOR WHAT MATTERS</div>
            <h1 className="mt-3 text-[clamp(27px,3vw,38px)] leading-[1.04] font-bold tracking-[-0.045em]">Your week, <span className="font-editorial font-medium text-terracotta italic">in focus.</span></h1>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2"><CalendarDays aria-hidden className="size-4 text-forest" />{weekLabel(days[0]!, days[6]!)}<span className="hidden text-forest/30 sm:inline">·</span><span className="hidden sm:inline">{total ? `${done} of ${total} tasks complete` : 'A little planning goes a long way'}</span></p>
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
            <DayColumn key={day} day={day} today={day === today} past={day < today} items={byDay.get(day) ?? []} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayColumn({ day, today, past, items, act }: { day: string; today: boolean; past: boolean; items: PlanItem[]; act: (f: () => Promise<unknown>) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [weekday, date] = label(day).split(', ');
  const dayNumber = Number(day.slice(-2));
  return (
    <section data-planner-day className={`group/day flex min-h-[148px] flex-col overflow-hidden rounded-[20px] border transition duration-300 ${today ? 'is-today border-forest/20 bg-gradient-to-b from-[#f0f5df] to-surface shadow-[0_15px_36px_-27px_rgb(24_68_59/0.6)] ring-1 ring-lime' : 'border-rule/80 bg-surface shadow-[0_12px_30px_-26px_rgb(24_68_59/0.4)]'} ${past ? 'opacity-75' : ''}`}>
      <h2 className={`flex items-center gap-3 border-b px-3 py-2.5 ${today ? 'border-forest/10' : 'border-rule/70'}`}>
        <span className={`grid size-11 shrink-0 place-items-center rounded-[15px] text-lg font-bold tracking-tight transition-transform duration-300 group-hover/day:-rotate-6 group-hover/day:scale-105 ${today ? 'bg-forest text-lime shadow-[0_6px_14px_rgb(24_68_59/0.2)]' : 'bg-paper text-forest'}`}>{dayNumber}</span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-forest">{weekday}</span><span className="mt-0.5 block text-[11px] font-normal text-ink-3">{date}</span></span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${today ? 'bg-lime text-forest' : 'bg-paper text-ink-3'}`}>{today ? 'TODAY' : `${items.length} ${items.length === 1 ? 'TASK' : 'TASKS'}`}</span>
      </h2>
      <ul className="flex-1 space-y-1.5 p-2">
        {items.map((p) => (
          <li key={p.id} data-plan-item data-expert-plan={p.planId ? 'true' : undefined} className={`group flex items-start gap-2 rounded-[12px] border p-2 text-[12px] transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${p.planId ? 'border-[#d5df98] bg-[#fbfced]' : 'border-rule/60 bg-white/80'} ${p.done ? 'border-forest/10 bg-[#f0f3e8]/70' : 'hover:border-forest/20'}`}>
            <label className={`mt-0.5 grid size-[17px] shrink-0 cursor-pointer place-items-center rounded-md border transition-colors ${p.done ? 'border-forest bg-forest text-lime' : 'border-rule-strong bg-surface text-transparent hover:border-forest'}`}>
              <input type="checkbox" checked={p.done} onChange={(e) => { if (e.target.checked) playUiSound('complete'); void act(() => api.updatePlan(p.id, { done: e.target.checked })); }} aria-label={`Mark “${p.title}” done`} className="peer sr-only" />
              <Check aria-hidden className="size-3.5 scale-75 transition-transform peer-checked:scale-100" />
            </label>
            <span className="min-w-0 flex-1">
              <PlanLink kind={p.kind} refId={p.refId} targetCount={p.targetCount} className={`block leading-snug break-words ${p.done ? 'text-ink-3 line-through' : 'text-ink'}`}>
                {p.title}
              </PlanLink>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.kind === 'PRACTICE' || p.kind === 'MOCK' ? 'bg-[#f6e5db] text-terracotta' : 'bg-[#e9eedf] text-forest'}`}>{KIND_LABEL[p.kind] ?? p.kind}</span>
                {p.planId && <span className="rounded-full bg-[#f1f4d9] px-1.5 py-0.5 text-[9px] font-semibold text-forest">Study plan</span>}
            <span className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!p.done && (
                <button type="button" title="Move to the next day" data-sound="move" aria-label="Move to the next day" onClick={() => act(() => api.updatePlan(p.id, { day: addDays(day, 1) }))} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink">
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
        {items.length === 0 && <li className="flex min-h-8 items-center justify-between rounded-lg px-1.5 py-1 text-[10px] text-ink-3"><span>Nothing planned</span><span className="rounded-full bg-paper px-2 py-0.5 font-medium">0 tasks</span></li>}
      </ul>
      {!past && (
        <form
          className="flex gap-1.5 border-t border-rule/70 bg-paper/55 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            playUiSound('add');
            void act(() => api.addPlan({ day, kind: 'CUSTOM', title: title.trim() })).then(() => setTitle(''));
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" maxLength={200} aria-label={`Add a task on ${label(day)}`} className="h-9 min-w-0 flex-1 rounded-xl border border-rule bg-surface px-2.5 text-[12px] placeholder:text-ink-3 focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime" />
          <button type="submit" className="grid size-9 shrink-0 place-items-center rounded-xl bg-forest text-lime shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-forest-deep disabled:opacity-40" disabled={!title.trim()} aria-label="Add task">
            <Plus aria-hidden className="size-4" />
          </button>
        </form>
      )}
    </section>
  );
}
