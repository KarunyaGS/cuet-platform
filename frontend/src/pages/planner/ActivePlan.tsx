/**
 * The plan the student is following: progress, the day-by-day list, and every way to make it their own. The expert suggestion is kept, so each
 * activity says whether it is as recommended, moved, added by the student or noticed from their activity on the platform.
 */
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Info, Pause, Play, Plus, Repeat, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, localDay, type CurrentPlan, type LivePlanItem, type PlanChange, type PlanKind } from '../../api';
import { PLAN_KIND_LABEL, planHref } from '../../planLinks';
import { playUiSound } from '../../sound';
import { Button, ErrorBox } from '../../ui';
import { addDays, dayLabel, EvidenceTag, hours, KindIcon, shortName } from './planUi';

type Plan = NonNullable<CurrentPlan['plan']>;
const REASON: Record<PlanChange['reason'], string> = { MISSED: 'missed, moved to a day with room', OVER_TIME: 'did not fit the day, moved later', PULLED_FORWARD: 'brought forward', RESTORED: 'restored' };

export function ActivePlan({ data, reload, onChangeGoal }: { data: CurrentPlan; reload: () => void; onChangeGoal: () => void }) {
  const plan = data.plan as Plan;
  const items = data.items ?? [];
  const progress = data.progress!;
  const today = localDay();
  const [openDays, setOpenDays] = useState<Set<string>>(new Set([today >= plan.startDay && today <= plan.endDay ? today : plan.startDay]));
  const [changes, setChanges] = useState<PlanChange[] | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  const auto = useRef(false);
  const paused = plan.status === 'PAUSED';
  const dayNumber = Math.min(plan.durationDays, Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${plan.startDay}T00:00:00Z`)) / 86_400_000) + 1));
  const started = today >= plan.startDay;

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
  const adjust = () => run(async () => { const r = await api.adjustPlan(plan.id, today); setChanges(r.changes.length ? r.changes : []); });

  // On opening a running plan, anything missed or done ahead of its day is sorted out for the student, and they are told what moved.
  useEffect(() => {
    if (auto.current || paused) return;
    auto.current = true;
    const missed = items.some((i) => i.status === 'SCHEDULED' && !i.done && !i.pinned && i.day < today);
    const early = items.some((i) => i.done && i.day > today);
    if (missed || early) void adjust();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, LivePlanItem[]>();
    for (const i of items.filter((x) => x.status === 'SCHEDULED')) m.set(i.day, [...(m.get(i.day) ?? []), i]);
    return m;
  }, [items]);
  const dayList = Array.from({ length: plan.durationDays }, (_, k) => addDays(plan.startDay, k)).filter((d) => d <= plan.endDay);
  const extraDays = [...byDay.keys()].filter((d) => !dayList.includes(d)).sort();
  const deferred = items.filter((i) => i.status === 'DEFERRED');
  const maxDay = Math.max(30, ...progress.byDay.map((d) => d.planned));
  const moved = items.filter((i) => i.moved && i.status === 'SCHEDULED').length;
  const addedByMe = items.filter((i) => i.origin === 'STUDENT').length;
  const topicsForRevision = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) if (i.refId && ['REVISE', 'PRACTICE', 'TOPIC'].includes(i.kind)) m.set(i.refId, i.title.replace(/^[A-Za-z ]+: /, ''));
    return [...m];
  }, [items]);

  return (
    <section aria-labelledby="active-title" data-active-plan className="mb-6 overflow-hidden rounded-[22px] border border-rule bg-surface shadow-[0_12px_28px_-24px_rgb(24_68_59/0.35)]">
      <div className="border-b border-rule bg-gradient-to-b from-[#f4f6e6] to-surface px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label text-[10px] tracking-[0.16em] text-terracotta">YOUR EXPERT PLAN{plan.version > 1 ? ` · VERSION ${plan.version}` : ''}</p>
            <h2 id="active-title" className="mt-1 text-lg font-bold tracking-tight text-forest sm:text-xl">{plan.title}</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {dayLabel(plan.startDay)} to {dayLabel(plan.endDay)} · {started ? `day ${dayNumber} of ${plan.durationDays}` : 'starts soon'} · about {hours(plan.minutesPerDay)} a day{paused && <span className="ml-2 rounded-full bg-[#fbf2e3] px-2 py-0.5 text-xs font-semibold text-terracotta" data-paused>Paused</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-plan-actions>
            {!paused && <Button kind="secondary" onClick={() => void adjust()} disabled={busy} icon={<Repeat aria-hidden />}>Adjust my plan</Button>}
            {paused ? <Button onClick={() => void run(async () => { const r = await api.resumePlan(plan.id, today); setChanges([]); if (r.shiftedDays) setChanges([]); })} disabled={busy} icon={<Play aria-hidden />}>Resume</Button>
              : <Button kind="secondary" onClick={() => void run(() => api.pausePlan(plan.id, today))} disabled={busy} icon={<Pause aria-hidden />}>Pause</Button>}
            <Button kind="ghost" onClick={onChangeGoal} icon={<SlidersHorizontal aria-hidden />}>Change goal</Button>
          </div>
        </div>
        <div className="mt-4" data-plan-progress>
          <div className="flex items-baseline justify-between text-xs text-ink-2"><span className="num font-semibold text-forest">{progress.percent}% done</span><span className="num">{progress.doneItems} of {progress.totalItems} activities · {hours(progress.doneMinutes)} of {hours(progress.totalMinutes)}</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-forest/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Plan progress"><div className="plan-bar h-full rounded-full bg-forest" style={{ width: `${progress.percent}%` }} /></div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-6">
        {err && <ErrorBox error={err} />}
        {changes && changes.length > 0 && (
          <div role="status" data-adjusted className="plan-step rounded-xl border border-forest/20 bg-[#f0f5df] px-3 py-2.5 text-sm text-ink">
            <p className="font-semibold text-forest">Your plan was adjusted: {changes.length} {changes.length === 1 ? 'activity' : 'activities'} moved.</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-ink-2">{changes.slice(0, 5).map((c) => <li key={c.id}>{c.title}: {REASON[c.reason]} ({c.status === 'DEFERRED' ? 'could not fit before the plan ends, kept in the list below' : `${dayLabel(c.from)} → ${dayLabel(c.to)}`})</li>)}{changes.length > 5 && <li>and {changes.length - 5} more</li>}</ul>
          </div>
        )}
        {changes && changes.length === 0 && <p role="status" className="text-xs text-ink-3" data-adjusted-none>Your plan is on track: nothing needed to move.</p>}
        {progress.detected > 0 && <p className="text-xs text-ink-2" data-detected><Check aria-hidden className="mr-1 inline size-3.5 text-forest" />{progress.detected} {progress.detected === 1 ? 'activity was' : 'activities were'} ticked off from what you did on the platform.</p>}

        <ProgressView plan={plan} progress={progress} maxDay={maxDay} today={today} />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3" data-customised>
          <span>{moved} moved · {addedByMe} added by you · {data.removed?.length ?? 0} suggestions removed</span>
          <span className="flex items-center gap-1.5">Time each day
            <button type="button" aria-label="Less time each day" className="grid size-6 place-items-center rounded-md border border-rule hover:bg-paper" disabled={busy || plan.minutesPerDay <= 30} onClick={() => void run(async () => { const r = await api.setPlanMinutes(plan.id, plan.minutesPerDay - 15, today); setChanges(r.changes); })}>−</button>
            <span className="num min-w-14 text-center font-semibold text-ink" data-plan-minutes>{hours(plan.minutesPerDay)}</span>
            <button type="button" aria-label="More time each day" className="grid size-6 place-items-center rounded-md border border-rule hover:bg-paper" disabled={busy || plan.minutesPerDay >= 480} onClick={() => void run(async () => { const r = await api.setPlanMinutes(plan.id, plan.minutesPerDay + 15, today); setChanges(r.changes); })}>+</button>
          </span>
        </div>

        <div className="space-y-1.5" data-plan-days>
          {[...dayList, ...extraDays].map((d) => (
            <DayRow key={d} day={d} plan={plan} items={byDay.get(d) ?? []} today={today} open={openDays.has(d)} popId={popId} topics={topicsForRevision}
              onToggle={() => setOpenDays((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; })}
              run={run} setPop={setPopId} />
          ))}
        </div>

        {deferred.length > 0 && (
          <div className="rounded-xl border border-rule bg-paper/60 p-3" data-deferred>
            <p className="text-sm font-semibold text-ink">Not scheduled yet ({deferred.length})</p>
            <p className="text-xs text-ink-2">These did not fit before the plan ends. They are kept, not deleted: place each on a day you choose, or remove it.</p>
            <ul className="mt-2 space-y-1.5">
              {deferred.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <KindIcon kind={i.kind} /><span className="min-w-0 flex-1">{i.title}</span>
                  <input type="date" min={plan.startDay} max={plan.endDay} aria-label={`Place “${i.title}” on a day`} className="h-8 rounded-lg border border-rule bg-surface px-2 text-xs" onChange={(e) => e.target.value && void run(() => api.updatePlan(i.id, { day: e.target.value }))} />
                  <button type="button" aria-label="Remove" className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-wrong-soft hover:text-wrong" onClick={() => void run(() => api.deletePlan(i.id))}><Trash2 aria-hidden className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(data.removed?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-rule bg-paper/60 p-3" data-removed>
            <p className="text-sm font-semibold text-ink">Suggestions you removed ({data.removed!.length})</p>
            <ul className="mt-2 space-y-1.5">
              {data.removed!.slice(0, 8).map((r) => (
                <li key={r.suggestionKey} className="flex items-center gap-2 text-sm"><KindIcon kind={r.kind} /><span className="min-w-0 flex-1 truncate">{r.title} <span className="text-xs text-ink-3">· {dayLabel(r.day)}</span></span>
                  <Button kind="ghost" onClick={() => void run(() => api.restoreSuggestion(plan.id, r.suggestionKey))} icon={<RotateCcw aria-hidden />}>Restore</Button></li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-rule pt-4 text-xs text-ink-3">
          <p className="max-w-2xl"><Info aria-hidden className="mr-1 inline size-3.5" />Suggestions come from the official syllabus order, your own results and a study method. {plan.summary.trends.note} {plan.methodReview.status === 'PENDING_ACADEMIC_REVIEW' && 'The study method is a draft awaiting academic review.'} Practice scores here are for revision and are not official CUET scores.</p>
          {confirmEnd ? (
            <span className="flex items-center gap-2" data-confirm-end>End this plan? What you did stays.<Button kind="secondary" onClick={() => void run(() => api.archivePlan(plan.id, today))} disabled={busy}>End plan</Button><Button kind="ghost" onClick={() => setConfirmEnd(false)}>Keep it</Button></span>
          ) : (
            <Button kind="ghost" onClick={() => setConfirmEnd(true)}>End this plan</Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ProgressView({ plan, progress, maxDay, today }: { plan: Plan; progress: NonNullable<CurrentPlan['progress']>; maxDay: number; today: string }) {
  const names = new Map(plan.summary.subjects.map((s) => [s.code, shortName(s.name)]));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-progress-view>
      <div>
        <p className="text-xs font-semibold text-ink">Each day: planned and done</p>
        <div className="mt-2 flex h-24 items-end gap-[3px] overflow-x-auto pb-1" role="img" aria-label="Minutes planned and done on each day">
          {progress.byDay.map((d, i) => (
            <div key={d.day} title={`${dayLabel(d.day)}: ${d.done} of ${d.planned} min`} className={`flex h-full min-w-[10px] flex-1 flex-col items-center justify-end ${d.day === today ? 'rounded-sm bg-terracotta/10' : ''}`}>
              <div className="relative flex w-full flex-1 items-end"><div className="absolute inset-x-0 bottom-0 rounded-t bg-forest/15" style={{ height: `${(100 * d.planned) / maxDay}%` }} /><div className="plan-bar relative w-full rounded-t bg-forest" style={{ height: `${(100 * d.done) / maxDay}%`, transitionDelay: `${i * 12}ms` }} /></div>
              <span className="num mt-0.5 text-[9px] text-ink-3">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink">By subject</p>
        {progress.bySubject.map((s) => (
          <div key={s.code}>
            <div className="flex justify-between text-[11px] text-ink-2"><span>{names.get(s.code) ?? 'Other'}</span><span className="num">{s.done} / {s.planned} min</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-forest/15"><div className="plan-bar h-full rounded-full bg-forest" style={{ width: `${s.planned ? (100 * s.done) / s.planned : 0}%` }} /></div>
          </div>
        ))}
        <div className="flex flex-wrap gap-1 pt-1">
          {progress.byKind.map((k) => <span key={k.kind} className="num rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-2">{PLAN_KIND_LABEL[k.kind as PlanKind]?.toLowerCase() ?? k.kind} {k.done}/{k.planned}</span>)}
        </div>
      </div>
    </div>
  );
}

function DayRow({ day, plan, items, today, open, popId, topics, onToggle, run, setPop }: { day: string; plan: Plan; items: LivePlanItem[]; today: string; open: boolean; popId: string | null; topics: [string, string][]; onToggle: () => void; run: (w: () => Promise<unknown>) => Promise<void>; setPop: (id: string | null) => void }) {
  const done = items.filter((i) => i.done).length;
  const mins = items.reduce((n, i) => n + (i.minutes ?? 0), 0);
  const light = plan.lightDays.includes(day);
  const [title, setTitle] = useState('');
  const [revise, setRevise] = useState('');
  return (
    <div className={`overflow-hidden rounded-xl border bg-surface ${day === today ? 'border-forest/40 ring-1 ring-forest/20' : 'border-rule'}`} data-plan-day={day}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper/60">
        <span className={`num grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${day === today ? 'bg-terracotta text-white' : 'bg-forest text-lime'}`}>{Number(day.slice(-2))}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{dayLabel(day, true)}{day === today && <span className="ml-1.5 rounded-full bg-lime px-1.5 text-[10px] font-bold text-forest">TODAY</span>}{light && <span className="ml-1.5 rounded-full bg-paper px-1.5 text-[10px] font-medium text-ink-3">lighter day</span>}</span></span>
        <span className="num text-xs text-ink-2">{done}/{items.length} · {hours(mins)}</span>
        <ChevronDown aria-hidden className={`size-4 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="plan-step border-t border-rule/70">
          <ul className="divide-y divide-rule/60">
            {items.length === 0 && <li className="px-3 py-2 text-xs text-ink-3">Nothing planned.</li>}
            {items.map((i, k) => <ItemRow key={i.id} item={i} first={k === 0} last={k === items.length - 1} siblings={items} plan={plan} pop={popId === i.id} run={run} setPop={setPop} />)}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-rule/70 bg-paper/50 p-2.5">
            <form className="flex min-w-0 flex-1 gap-1.5" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void run(() => api.addPlan({ day, kind: 'CUSTOM', title: title.trim(), planId: plan.id, minutes: 20 })).then(() => setTitle('')); }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Add your own task" aria-label={`Add a task on ${dayLabel(day)}`} className="h-8 min-w-0 flex-1 rounded-lg border border-rule bg-surface px-2.5 text-xs" />
              <button type="submit" aria-label="Add task" className="grid size-8 place-items-center rounded-lg bg-forest text-lime"><Plus aria-hidden className="size-4" /></button>
            </form>
            {topics.length > 0 && (
              <select value={revise} onChange={(e) => { const [ref, ...rest] = e.target.value.split('|'); setRevise(''); const t = rest.join('|'); if (ref) void run(() => api.addPlan({ day, kind: 'REVISE', refId: ref, title: `Revise: ${t}`, planId: plan.id, minutes: 15 })); }} aria-label={`Add a revision session on ${dayLabel(day)}`} className="h-8 max-w-[14rem] rounded-lg border border-rule bg-surface px-2 text-xs">
                <option value="">Add a revision session…</option>
                {topics.map(([ref, t]) => <option key={ref} value={`${ref}|${t}`}>{t}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, first, last, siblings, plan, pop, run, setPop }: { item: LivePlanItem; first: boolean; last: boolean; siblings: LivePlanItem[]; plan: Plan; pop: boolean; run: (w: () => Promise<unknown>) => Promise<void>; setPop: (id: string | null) => void }) {
  const [why, setWhy] = useState(false);
  const [alts, setAlts] = useState<Awaited<ReturnType<typeof api.planAlternatives>>['alternatives'] | null>(null);
  const href = planHref(item);
  const label = <span className={item.done ? 'text-ink-3 line-through' : 'text-ink'}>{item.title}</span>;
  const swap = (a: number) => {
    const ids = siblings.map((s) => s.id);
    const j = ids.indexOf(item.id) + a;
    [ids[ids.indexOf(item.id)], ids[j]] = [ids[j]!, ids[ids.indexOf(item.id)]!];
    return run(() => api.reorderPlanDay(plan.id, item.day, ids));
  };
  return (
    <li className={`px-3 py-2 ${pop ? 'plan-pop' : ''} ${item.done ? 'bg-[#f6f9ee]' : ''}`} data-plan-item={item.id} data-kind={item.kind}>
      <div className="flex items-start gap-2.5">
        <label className={`mt-0.5 grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-md border transition-colors ${item.done ? 'border-forest bg-forest text-lime' : 'border-rule-strong bg-surface'}`}>
          <input type="checkbox" checked={item.done} className="peer sr-only" aria-label={`Mark “${item.title}” done`} onChange={(e) => { if (e.target.checked) { playUiSound('complete'); setPop(item.id); window.setTimeout(() => setPop(null), 700); } void run(() => api.updatePlan(item.id, { done: e.target.checked })); }} />
          <Check aria-hidden className="size-3.5 scale-75 opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100" />
        </label>
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            {href ? <Link to={href} className="font-medium hover:text-accent" data-activity-link>{label}</Link> : <span className="font-medium">{label}</span>}
            <span className="num text-xs text-ink-3">{item.minutes ?? '–'} min{item.targetCount ? ` · ${item.targetCount} q` : ''}</span>
            <EvidenceTag e={item.evidence} />
            {item.moved && item.originalDay && <span className="rounded-full bg-[#fbf2e3] px-1.5 py-0.5 text-[10px] font-semibold text-terracotta" data-moved>Moved from {dayLabel(item.originalDay)}</span>}
            {item.origin === 'STUDENT' && <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">Added by you</span>}
            {item.done && item.doneBy === 'ACTIVITY' && <span className="rounded-full bg-[#e9eedf] px-1.5 py-0.5 text-[10px] font-semibold text-forest" data-detected-badge>Done: found in your activity</span>}
          </div>
          {why && item.note && <p className="plan-step mt-1 text-xs text-ink-2" data-why>{item.note}</p>}
          {alts && (
            <ul className="plan-step mt-1.5 space-y-1 rounded-lg border border-rule bg-paper/70 p-2 text-xs" data-alternatives>
              <li className="font-semibold text-ink">Replace with:</li>
              {alts.length === 0 && <li className="text-ink-3">No alternatives for this activity.</li>}
              {alts.map((a) => (
                <li key={`${a.kind}-${a.refId}`}><button type="button" className="text-left text-ink-2 hover:text-accent" onClick={() => void run(() => api.updatePlan(item.id, { kind: a.kind, refId: a.refId, title: a.title, minutes: a.minutes, targetCount: a.targetCount })).then(() => setAlts(null))}>{a.title} <span className="text-ink-3">· {a.minutes} min · {a.reason}</span></button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
          {item.note && <IconBtn label={why ? 'Hide why' : 'Why this?'} onClick={() => setWhy(!why)}><Info aria-hidden className="size-3.5" /></IconBtn>}
          {!first && <IconBtn label="Move up" onClick={() => void swap(-1)}><ArrowUp aria-hidden className="size-3.5" /></IconBtn>}
          {!last && <IconBtn label="Move down" onClick={() => void swap(1)}><ArrowDown aria-hidden className="size-3.5" /></IconBtn>}
          {!item.done && <IconBtn label="Move to the previous day" onClick={() => void run(() => api.updatePlan(item.id, { day: addDays(item.day, -1) }))}><ChevronLeft aria-hidden className="size-3.5" /></IconBtn>}
          {!item.done && <IconBtn label="Move to the next day" onClick={() => void run(() => api.updatePlan(item.id, { day: addDays(item.day, 1) }))}><ChevronRight aria-hidden className="size-3.5" /></IconBtn>}
          {item.kind !== 'CUSTOM' && !item.done && <IconBtn label="Replace this activity" onClick={() => void (alts ? setAlts(null) : api.planAlternatives(item.id).then((r) => setAlts(r.alternatives)))}><Repeat aria-hidden className="size-3.5" /></IconBtn>}
          <IconBtn label="Remove" danger onClick={() => void run(() => api.deletePlan(item.id))}><Trash2 aria-hidden className="size-3.5" /></IconBtn>
        </div>
      </div>
      {!item.done && (
        <div className="ml-[3.1rem] mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
          <span>Time</span>
          <button type="button" aria-label="Less time" className="grid size-5 place-items-center rounded border border-rule hover:bg-paper" onClick={() => void run(() => api.updatePlan(item.id, { minutes: Math.max(5, (item.minutes ?? 20) - 5) }))}>−</button>
          <span className="num">{item.minutes ?? 20} min</span>
          <button type="button" aria-label="More time" className="grid size-5 place-items-center rounded border border-rule hover:bg-paper" onClick={() => void run(() => api.updatePlan(item.id, { minutes: Math.min(240, (item.minutes ?? 20) + 5) }))}>+</button>
          <input type="date" min={plan.startDay} max={plan.endDay} value={item.day} aria-label={`Reschedule “${item.title}”`} className="h-6 rounded border border-rule bg-surface px-1" onChange={(e) => e.target.value && void run(() => api.updatePlan(item.id, { day: e.target.value }))} />
        </div>
      )}
    </li>
  );
}

const IconBtn = ({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) => (
  <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid size-6 place-items-center rounded-md text-ink-3 transition-colors ${danger ? 'hover:bg-wrong-soft hover:text-wrong' : 'hover:bg-paper hover:text-ink'}`}>{children}</button>
);
