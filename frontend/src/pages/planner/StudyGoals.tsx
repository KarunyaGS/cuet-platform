/**
 * "Your Study Goals, Your Expert Plan": the guided way into a study plan. The student says what they are preparing for, which subjects, what they
 * want to achieve and for how long; the server builds the plan from the syllabus, their own results and the study method; they look it over and
 * add it to their planner. Everything shown comes from the platform's own configuration: nothing is a hard-coded list of subjects or exams.
 */
import { Check, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, localDay, type BuiltItem, type PlanGoal, type PlanPreview, type PlannerOptions } from '../../api';
import { playUiSound } from '../../sound';
import { Button, buttonClass, ErrorBox, Loading, useLoad } from '../../ui';
import { PLAN_KIND_LABEL, planLabs } from '../../planLinks';
import { dayLabel, EvidenceTag, hours, KindIcon, shortName } from './planUi';

const STEPS = ['Goal', 'Subjects', 'Focus', 'Time'] as const;
const BUILD_STEPS = ['Reading the syllabus order', 'Checking your results and activity', 'Balancing the days between your subjects', 'Placing practice, revision and tests'];

type Phase = 'choose' | 'building' | 'preview' | 'saved';
interface Props {
  /** Set when a plan is already running: saving a new one then replaces it (after a clear warning). */
  replacing?: boolean;
  /** Set when the student is changing the goal of the plan they are following. */
  regenerateId?: string | null;
  initial?: PlanGoal | null;
  onDone: () => void;
  onCancel?: () => void;
}

export function StudyGoals({ replacing = false, regenerateId = null, initial = null, onDone, onCancel }: Props) {
  const options = useLoad(api.plannerOptions, []);
  const [step, setStep] = useState(0);
  const [path, setPath] = useState(initial?.path ?? '');
  const [paperIds, setPaperIds] = useState<string[]>(initial?.paperIds ?? []);
  const [objectives, setObjectives] = useState<string[]>(initial?.objectives ?? []);
  const [days, setDays] = useState<7 | 14 | 30>(initial?.durationDays ?? 14);
  const [minutes, setMinutes] = useState(initial?.minutesPerDay ?? 120);
  const [coverage, setCoverage] = useState<PlanGoal['coverage']>(initial?.coverage ?? 'STANDARD');
  const [phase, setPhase] = useState<Phase>('choose');
  const [built, setBuilt] = useState(0);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const o = options.data;
  const chosen = paperIds;

  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, [step, phase]);

  if (options.loading && !o) return <Loading />;
  if (options.error || !o) return <ErrorBox error={options.error ?? new Error('The planner options could not be loaded.')} onRetry={options.reload} />;

  const pathInfo = o.paths.find((p) => p.id === path);
  const canNext = step === 0 ? Boolean(path) : step === 1 ? chosen.length > 0 : true;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const goal = (): PlanGoal => ({ examCode: 'CUET_UG', path, paperIds: chosen, objectives, durationDays: days, minutesPerDay: minutes, coverage, startDay: localDay() });

  const build = async () => {
    setErr(null);
    setPhase('building');
    setBuilt(0);
    const tick = window.setInterval(() => setBuilt((b) => Math.min(BUILD_STEPS.length, b + 1)), 420);
    try {
      const [pv] = await Promise.all([api.previewPlan({ ...goal(), labs: planLabs() }), new Promise((r) => window.setTimeout(r, 1700))]);
      setPreview(pv);
      setPhase('preview');
      playUiSound('generate');
    } catch (e) {
      setErr(e as Error);
      setPhase('choose');
    } finally {
      window.clearInterval(tick);
    }
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    setErr(null);
    try {
      if (regenerateId) await api.regeneratePlan(regenerateId, { asOf: localDay(), path, paperIds: chosen, objectives, durationDays: days, minutesPerDay: minutes, coverage, labs: planLabs() });
      else await api.createPlan({ ...preview.goal, labs: planLabs(), fingerprint: preview.fingerprint, replace: replacing });
      playUiSound('success');
      setPhase('saved');
      window.setTimeout(onDone, 1100);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="goals-title" data-study-goals className="mb-6 overflow-hidden rounded-[22px] border border-rule bg-surface shadow-[0_12px_28px_-24px_rgb(24_68_59/0.35)]">
      <div className="border-b border-rule bg-gradient-to-b from-[#f4f6e6] to-surface px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="goals-title" className="flex items-center gap-2 text-lg font-bold tracking-tight text-forest sm:text-xl"><Sparkles aria-hidden className="size-4 text-terracotta" />{regenerateId ? 'Change your goal' : 'Your Study Goals, Your Expert Plan'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">{regenerateId ? 'Tell us what changed. Work you have done and tasks you added stay; the days still to come are re-planned.' : 'Tell us what you want to focus on. We’ll suggest a structured study plan to help you reach your goal.'}</p>
          </div>
          {onCancel && phase !== 'saved' && <Button kind="ghost" onClick={onCancel}>Cancel</Button>}
        </div>
        {phase === 'choose' && (
          <ol className="mt-4 flex flex-wrap gap-2" aria-label="Steps" data-wizard-steps>
            {STEPS.map((s, i) => (
              <li key={s}>
                <button type="button" onClick={() => i <= step && setStep(i)} disabled={i > step} aria-current={i === step ? 'step' : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${i === step ? 'bg-forest text-lime' : i < step ? 'bg-[#e9eedf] text-forest hover:bg-[#dfe7cf]' : 'bg-paper text-ink-3'}`}>
                  <span className="grid size-4 place-items-center rounded-full bg-white/20 text-[10px]">{i < step ? <Check aria-hidden className="size-3" /> : i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div ref={panel} tabIndex={-1} className="plan-step px-4 py-5 outline-none sm:px-6" key={`${phase}-${step}`} data-phase={phase} data-step={step}>
        {err && <div className="mb-4"><ErrorBox error={err} /></div>}

        {phase === 'choose' && step === 0 && (
          <div>
            <h3 className="text-base font-semibold text-ink">What would you like to achieve this week?</h3>
            <p className="mt-0.5 text-sm text-ink-2">What are you preparing for? <span className="text-ink-3">Exam: {o.exams.map((e) => e.name).join(', ')}.</span></p>
            <div role="radiogroup" aria-label="Preparation goal" className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {o.paths.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={path === p.id} onClick={() => { setPath(p.id); playUiSound('select'); }} data-path={p.id}
                  className={`plan-card rounded-xl border p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${path === p.id ? 'border-forest bg-[#f0f5df] shadow-sm ring-1 ring-forest/30' : 'border-rule bg-surface'}`}>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">{p.label}{path === p.id && <Check aria-hidden className="size-4 text-forest" />}</span>
                  <span className="mt-0.5 block text-xs text-ink-2">{p.blurb}</span>
                </button>
              ))}
            </div>
            {o.notOffered.length > 0 && <p className="mt-3 text-xs text-ink-3" data-not-offered>Not offered yet: {o.notOffered.map((n) => n.reason).join(' ')}</p>}
          </div>
        )}

        {phase === 'choose' && step === 1 && (
          <div>
            <h3 className="text-base font-semibold text-ink">Which subjects do you want to focus on?</h3>
            <p className="mt-0.5 text-sm text-ink-2">Choose one, several or all. The list is the subjects on the platform, with the topics and questions each has.</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Subjects" data-subjects>
              {o.subjects.map((s) => {
                const on = chosen.includes(s.paperId);
                return (
                  <button key={s.paperId} type="button" aria-pressed={on} onClick={() => { setPaperIds(toggle(chosen, s.paperId)); playUiSound('select'); }} data-subject={s.code}
                    className={`plan-card rounded-xl border px-3 py-2 text-left transition duration-200 hover:-translate-y-0.5 ${on ? 'border-forest bg-[#f0f5df] ring-1 ring-forest/30' : 'border-rule bg-surface'}`}>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">{on && <Check aria-hidden className="size-3.5 text-forest" />}{shortName(s.name)}</span>
                    <span className="num block text-[11px] text-ink-3">{s.topics} topics · {s.questions} questions</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button type="button" className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2 hover:bg-[#e9eedf]" onClick={() => setPaperIds(o.subjects.map((s) => s.paperId))}>All subjects</button>
              {o.defaults.paperIds.length > 0 && <button type="button" className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2 hover:bg-[#e9eedf]" onClick={() => setPaperIds(o.defaults.paperIds)}>My profile subjects</button>}
              <button type="button" className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2 hover:bg-[#e9eedf]" onClick={() => setPaperIds([])}>Clear</button>
              <span className="self-center text-ink-3">{chosen.length} selected</span>
            </div>
          </div>
        )}

        {phase === 'choose' && step === 2 && (
          <div>
            <h3 className="text-base font-semibold text-ink">What is your learning objective?</h3>
            <p className="mt-0.5 text-sm text-ink-2">Pick any that apply. {pathInfo && <>If you pick none, the plan uses what suits <strong className="font-semibold">{pathInfo.label.toLowerCase()}</strong>: {pathInfo.objectives.map((id) => o.objectives.find((x) => x.id === id)?.label.toLowerCase()).filter(Boolean).join(', ')}.</>}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Learning objectives" data-objectives>
              {o.objectives.map((x) => {
                const on = objectives.includes(x.id);
                return (
                  <button key={x.id} type="button" aria-pressed={on} onClick={() => { setObjectives(toggle(objectives, x.id)); playUiSound('select'); }} data-objective={x.id}
                    className={`plan-card rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 ${on ? 'border-forest bg-[#f0f5df] ring-1 ring-forest/30' : 'border-rule bg-surface'}`}>
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">{x.label}{on && <Check aria-hidden className="size-4 text-forest" />}</span>
                    <span className="mt-0.5 block text-xs text-ink-2">{x.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'choose' && step === 3 && (
          <div>
            <h3 className="text-base font-semibold text-ink">How long do you want to follow this plan?</h3>
            <div role="radiogroup" aria-label="Plan length" className="mt-3 grid gap-2.5 sm:grid-cols-3" data-durations>
              {o.durations.map((d) => (
                <button key={d.days} type="button" role="radio" aria-checked={days === d.days} onClick={() => { setDays(d.days); playUiSound('select'); }} data-days={d.days}
                  className={`plan-card rounded-xl border p-3.5 text-left transition duration-200 hover:-translate-y-0.5 ${days === d.days ? 'border-forest bg-[#f0f5df] ring-1 ring-forest/30' : 'border-rule bg-surface'}`}>
                  <span className="flex items-center justify-between text-sm font-semibold text-ink">{d.label}<span className="num text-xs font-medium text-ink-3">{d.blurb}</span></span>
                  <span className="mt-1 block text-xs text-ink-2">{d.phases.map((p) => p.focus).slice(0, 2).join(' · ')}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="mins" className="text-sm font-semibold text-ink">Time each day: <span className="num text-forest" data-minutes>{hours(minutes)}</span></label>
                <input id="mins" type="range" min={o.defaults.minutesBounds.min} max={300} step={15} value={Math.min(300, minutes)} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-2 w-full accent-[#18443b]" />
                <div className="mt-1 flex gap-1.5 text-[11px]">
                  {[60, 90, 120, 180].map((m) => <button key={m} type="button" onClick={() => setMinutes(m)} className={`rounded-full px-2 py-0.5 ${minutes === m ? 'bg-forest text-lime' : 'bg-paper text-ink-2 hover:bg-[#e9eedf]'}`}>{hours(m)}</button>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">How much to cover</p>
                <div role="radiogroup" aria-label="Coverage" className="mt-2 flex gap-1.5">
                  {([['LIGHT', 'Lighter'], ['STANDARD', 'Balanced'], ['FULL', 'Fuller']] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={coverage === v} onClick={() => setCoverage(v)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${coverage === v ? 'border-forest bg-[#f0f5df] text-forest' : 'border-rule text-ink-2'}`}>{l}</button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-ink-3">Lighter: fewer practice questions and one revision after each topic. Fuller: more practice per topic.</p>
              </div>
            </div>
          </div>
        )}

        {phase === 'choose' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
            <Button kind="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} icon={<ChevronLeft aria-hidden />}>Back</Button>
            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext} data-next className={buttonClass('primary')}>Next<ChevronRight aria-hidden /></button>
            ) : (
              <button type="button" onClick={() => void build()} disabled={!canNext || chosen.length === 0} data-build className={buttonClass('primary')}><Sparkles aria-hidden />Build my plan</button>
            )}
          </div>
        )}

        {phase === 'building' && (
          <div className="py-4" role="status" aria-live="polite" data-building>
            <p className="text-base font-semibold text-ink">Designing your plan…</p>
            <ul className="mt-3 space-y-2">
              {BUILD_STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${i <= built ? 'opacity-100' : 'opacity-30'}`}>
                  <span className={`grid size-5 place-items-center rounded-full ${i < built ? 'bg-forest text-lime' : 'bg-paper text-ink-3'}`}>{i < built ? <Check aria-hidden className="size-3" /> : <span className="plan-dot size-1.5 rounded-full bg-forest" />}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'preview' && preview && (
          <PlanPreviewView
            preview={preview} options={o} saving={saving} replacing={replacing && !regenerateId} regenerate={Boolean(regenerateId)}
            onBack={() => { setPhase('choose'); setStep(3); }} onSave={() => void save()}
          />
        )}

        {phase === 'saved' && (
          <div className="grid place-items-center py-8 text-center" role="status" data-saved>
            <span className="plan-pop grid size-14 place-items-center rounded-full bg-forest text-lime"><Check aria-hidden className="size-7" /></span>
            <p className="mt-3 text-base font-semibold text-ink">{regenerateId ? 'Your plan is updated' : 'Added to your planner'}</p>
            <p className="text-sm text-ink-2">Your first activities are ready.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PlanPreviewView({ preview, options, saving, replacing, regenerate, onBack, onSave }: { preview: PlanPreview; options: PlannerOptions; saving: boolean; replacing: boolean; regenerate: boolean; onBack: () => void; onSave: () => void }) {
  const { plan } = preview;
  const [open, setOpen] = useState<number | null>(1);
  const byDay = useMemo(() => {
    const m = new Map<number, BuiltItem[]>();
    for (const i of plan.items) m.set(i.day, [...(m.get(i.day) ?? []), i]);
    return m;
  }, [plan]);
  const s = plan.summary;
  return (
    <div data-preview>
      <h3 className="text-base font-semibold text-ink">Your plan: {options.durations.find((d) => d.days === s.durationDays)?.label.toLowerCase()}, about {hours(s.minutesPerDay)} a day</h3>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {s.subjects.map((x) => (
          <div key={x.code} className="rounded-xl border border-rule bg-paper/60 p-3 text-xs" data-plan-subject={x.code}>
            <div className="text-sm font-semibold text-ink">{shortName(x.name)} <span className="num font-normal text-ink-3">{x.sharePercent}% of the time</span></div>
            <div className="mt-1 text-ink-2">{x.topicsPlanned} of {x.topicsInSyllabus} topics{x.firstTopic ? `, from “${x.firstTopic}”` : ''}</div>
            {x.accuracy !== null && <div className="mt-0.5 text-ink-3">Your accuracy so far: {x.accuracy}% over {x.attempted} answers</div>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3" data-evidence-note>
        Built from the official syllabus order{s.usedPersonalData ? ', your own results and activity' : ''} and a study method. {s.trends.note} {preview.methodReview.status === 'PENDING_ACADEMIC_REVIEW' && <span>The study method is a draft awaiting academic review.</span>}
      </p>
      {plan.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-ink-2" data-warnings>{plan.warnings.map((w) => <li key={w} className="rounded-lg bg-[#fbf2e3] px-2.5 py-1.5">{w}</li>)}</ul>}

      <div className="mt-4 space-y-1.5" data-preview-days>
        {plan.days.map((d) => {
          const items = byDay.get(d.day) ?? [];
          const phase = s.phases.find((p) => d.day >= p.fromDay && d.day <= p.toDay);
          const isOpen = open === d.day;
          return (
            <div key={d.day} className="overflow-hidden rounded-xl border border-rule bg-surface">
              <button type="button" onClick={() => setOpen(isOpen ? null : d.day)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper/60" data-preview-day={d.day}>
                <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-forest text-xs font-bold text-lime">{d.day}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{dayLabel(d.date, true)}{d.light && <span className="ml-1.5 rounded-full bg-paper px-1.5 text-[10px] font-medium text-ink-3">lighter day</span>}</span><span className="block truncate text-[11px] text-ink-3">{phase?.focus}</span></span>
                <span className="num text-xs text-ink-2">{items.length} {items.length === 1 ? 'activity' : 'activities'} · {hours(d.minutes)}</span>
                <ChevronDown aria-hidden className={`size-4 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ul className="plan-step divide-y divide-rule/70 border-t border-rule/70">
                  {items.length === 0 && <li className="px-3 py-2 text-xs text-ink-3">Rest day: nothing planned.</li>}
                  {items.map((i) => (
                    <li key={i.key} className="flex gap-2.5 px-3 py-2">
                      <KindIcon kind={i.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink"><span className="font-medium">{i.title}</span><span className="num text-xs text-ink-3">{i.minutes} min{i.targetCount ? ` · ${i.targetCount} questions` : ''}</span><EvidenceTag e={i.evidence} /></div>
                        <p className="mt-0.5 text-xs text-ink-2">{i.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-3">{Object.entries(s.byKind).map(([k, n]) => `${n} ${PLAN_KIND_LABEL[k as keyof typeof PLAN_KIND_LABEL]?.toLowerCase() ?? k}`).join(' · ')} · {hours(s.totalMinutes)} in all. You can change anything after you add it.</p>
      {replacing && <p role="note" className="mt-3 rounded-lg bg-[#fbf2e3] px-3 py-2 text-xs text-ink-2" data-replace-note>You already have a plan running. Adding this one ends it: what you have done and tasks you added stay, and its suggestions still to come are removed.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
        <Button kind="ghost" onClick={onBack} icon={<ChevronLeft aria-hidden />}>Change my choices</Button>
        <button type="button" onClick={onSave} disabled={saving || plan.items.length === 0} data-save-plan className={buttonClass('primary')}>{saving ? 'Saving…' : regenerate ? 'Update my plan' : replacing ? 'Replace my plan' : 'Add to my planner'}</button>
      </div>
    </div>
  );
}
