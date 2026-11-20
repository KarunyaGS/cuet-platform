/** A compact summary for an expert plan. Its activities live in the weekly planner calendar below. */
import { Check, ChevronDown, Info, Pause, Play, Repeat, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, localDay, type CurrentPlan, type PlanChange } from '../../api';
import { playUiSound } from '../../sound';
import { Button, ErrorBox } from '../../ui';
import { dayLabel, hours, shortName } from './planUi';

type Plan = NonNullable<CurrentPlan['plan']>;

export function ActivePlan({ data, reload, onChangeGoal, onNewPlan }: { data: CurrentPlan; reload: () => void; onChangeGoal: () => void; onNewPlan: () => void }) {
  const plan = data.plan as Plan;
  const progress = data.progress!;
  const today = localDay();
  const [changes, setChanges] = useState<PlanChange[] | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const auto = useRef(false);
  const paused = plan.status === 'PAUSED';
  const subjects = plan.summary.subjects.map((s) => shortName(s.name));
  const deferred = (data.items ?? []).filter((item) => item.status === 'DEFERRED');
  const moved = (data.items ?? []).filter((item) => item.moved && item.status === 'SCHEDULED').length;
  const addedByMe = (data.items ?? []).filter((item) => item.origin === 'STUDENT').length;

  const run = async (work: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await work();
      reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const adjust = () => run(async () => {
    const result = await api.adjustPlan(plan.id, today);
    setChanges(result.changes);
  });

  useEffect(() => {
    if (auto.current || paused) return;
    auto.current = true;
    const items = data.items ?? [];
    const missed = items.some((item) => item.status === 'SCHEDULED' && !item.done && !item.pinned && item.day < today);
    const early = items.some((item) => item.done && item.day > today);
    if (missed || early) void adjust();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="active-title" data-active-plan className="mb-4 overflow-hidden rounded-2xl border border-[#d5df98] bg-surface shadow-[0_10px_26px_-22px_rgb(24_68_59/0.35)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef3d2] text-forest"><Sparkles aria-hidden className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="label text-[9px] tracking-[0.15em] text-terracotta">YOUR EXPERT PLAN</p>
            {paused && <span className="rounded-full bg-[#fbf2e3] px-2 py-0.5 text-[10px] font-semibold text-terracotta" data-paused>Paused</span>}
          </div>
          <h2 id="active-title" className="truncate text-sm font-bold text-forest">{plan.title}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-2">{subjects.join(' · ')} <span className="text-ink-3">·</span> {hours(plan.minutesPerDay)} a day <span className="text-ink-3">·</span> through {dayLabel(plan.endDay)}</p>
        </div>
        <div className="flex min-w-[9rem] flex-1 items-center gap-2 sm:max-w-48" data-plan-progress>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-forest/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Expert plan progress">
            <div className="plan-bar h-full rounded-full bg-forest" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="num text-xs font-semibold text-forest">{progress.percent}%</span>
          <span className="sr-only">{progress.doneItems} of {progress.totalItems} activities complete</span>
        </div>
        <a href="#planner-calendar" className="rounded-lg px-2.5 py-2 text-xs font-semibold text-accent hover:bg-accent-soft">See calendar</a>
        <Button kind="ghost" size="sm" onClick={onChangeGoal} icon={<SlidersHorizontal aria-hidden />}>Change goal</Button>
      </div>
      <details className="border-t border-rule/70" data-plan-options>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-xs text-ink-2 marker:hidden sm:px-5">
          <span>Plan settings <span className="text-ink-3">· {progress.doneItems}/{progress.totalItems} done{moved ? ` · ${moved} moved` : ''}{addedByMe ? ` · ${addedByMe} added by you` : ''}</span></span>
          <ChevronDown aria-hidden className="size-4 text-ink-3 transition-transform [details[open]_&]:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t border-rule/70 bg-paper/35 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div>
            <p className="text-xs font-semibold text-ink">Daily study time</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" aria-label="Less time each day" className="grid size-8 place-items-center rounded-lg border border-rule bg-surface text-ink hover:bg-paper" disabled={busy || plan.minutesPerDay <= 30} onClick={() => void run(async () => { const result = await api.setPlanMinutes(plan.id, plan.minutesPerDay - 15, today); setChanges(result.changes); })}>−</button>
              <span className="num min-w-16 text-center text-sm font-semibold text-forest">{hours(plan.minutesPerDay)}</span>
              <button type="button" aria-label="More time each day" className="grid size-8 place-items-center rounded-lg border border-rule bg-surface text-ink hover:bg-paper" disabled={busy || plan.minutesPerDay >= 480} onClick={() => void run(async () => { const result = await api.setPlanMinutes(plan.id, plan.minutesPerDay + 15, today); setChanges(result.changes); })}>+</button>
              <Button kind="ghost" size="sm" onClick={() => void adjust()} disabled={busy} icon={<Repeat aria-hidden />}>Adjust schedule</Button>
            </div>
            <p className="mt-2 text-[11px] text-ink-3">The weekly calendar below is the day-by-day plan. Check off tasks there as you complete them.</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {paused ? <Button size="sm" onClick={() => void run(async () => { const result = await api.resumePlan(plan.id, today); if (result.shiftedDays) setChanges([]); })} disabled={busy} icon={<Play aria-hidden />}>Resume plan</Button>
              : <Button kind="secondary" size="sm" onClick={() => void run(() => api.pausePlan(plan.id, today))} disabled={busy} icon={<Pause aria-hidden />}>Pause plan</Button>}
            {confirmEnd ? (
              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2" data-confirm-end>End this plan? Completed work stays.<Button size="sm" onClick={() => void run(() => api.archivePlan(plan.id, today))} disabled={busy}>End plan</Button><Button kind="ghost" size="sm" onClick={() => setConfirmEnd(false)}>Keep plan</Button></span>
            ) : <Button kind="ghost" size="sm" onClick={() => setConfirmEnd(true)} icon={<Trash2 aria-hidden />}>End plan</Button>}
            <Button kind="ghost" size="sm" onClick={onNewPlan}>Start a different plan</Button>
          </div>
          {deferred.length > 0 && (
            <div className="sm:col-span-2" data-deferred>
              <p className="text-xs font-semibold text-ink">Not scheduled yet ({deferred.length})</p>
              <ul className="mt-2 space-y-1.5">
                {deferred.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="min-w-0 flex-1">{item.title}</span><input type="date" min={plan.startDay} max={plan.endDay} aria-label={`Place “${item.title}” on a day`} className="h-8 rounded-lg border border-rule bg-surface px-2" onChange={(e) => e.target.value && void run(() => api.updatePlan(item.id, { day: e.target.value }))} /><button type="button" aria-label={`Remove ${item.title}`} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-wrong-soft hover:text-wrong" onClick={() => void run(() => api.deletePlan(item.id))}><Trash2 aria-hidden className="size-3.5" /></button></li>)}
              </ul>
            </div>
          )}
          {(data.removed?.length ?? 0) > 0 && (
            <div className="sm:col-span-2" data-removed>
              <p className="text-xs font-semibold text-ink">Removed suggestions ({data.removed!.length})</p>
              <ul className="mt-2 space-y-1.5">
                {data.removed!.slice(0, 6).map((item) => <li key={item.suggestionKey} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{item.title} · {dayLabel(item.day)}</span><button type="button" className="font-semibold text-accent hover:underline" onClick={() => void run(() => api.restoreSuggestion(plan.id, item.suggestionKey))}>Restore</button></li>)}
              </ul>
            </div>
          )}
          {changes && <div role="status" className="text-xs text-ink-2 sm:col-span-2" data-adjusted>{changes.length ? <><Check aria-hidden className="mr-1 inline size-3.5 text-forest" />{changes.length} schedule change{changes.length === 1 ? '' : 's'} made. Check the calendar for updated tasks.</> : 'Your schedule is on track; nothing needed to move.'}</div>}
          <p className="text-[11px] text-ink-3 sm:col-span-2"><Info aria-hidden className="mr-1 inline size-3.5" />Suggestions use your selected subjects, progress and syllabus order. CUET results and cut-offs are not predicted.</p>
        </div>
      </details>
      {err && <div className="px-4 pb-3 sm:px-5"><ErrorBox error={err} /></div>}
    </section>
  );
}
