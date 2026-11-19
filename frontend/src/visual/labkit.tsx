/**
 * Shared building blocks of the interactive Physics labs (Lens Lab, Diffraction Lab, and the labs to come).
 * Every lab follows the same guided path: Discover, Predict, Experiment, Measure, Analyse, Understand, Apply.
 * What is shared here: styles, the slider, the step bar, the predict-then-test card, the practice-question card,
 * and the "back to lesson" and "save completion" logic. What stays in each lab: its physics, its picture and its measurements.
 * Status of all lab content: Draft - unverified.
 */
import { Check, Circle, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Link, useNavigationType, useSearchParams } from 'react-router';
import { api } from '../api';

export const panel = 'rounded-lg border border-rule bg-surface';
export const btn = 'inline-flex h-9 items-center gap-1.5 rounded-md bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper disabled:opacity-40';
export const btnMain = 'inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-40';

/** True on phone-width screens: scenes get taller and labels larger so they stay readable. */
export function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 639px)');
    if (!mq) return;
    const on = () => setN(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return n;
}

export function Slider({ label, unit, value, min, max, step, onChange, id, shown }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; id: string; shown?: string }) {
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between text-ink">
        {label}
        <span className="num font-semibold">
          {shown ?? value} {unit}
        </span>
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-6 w-full accent-[var(--color-accent)]" />
    </label>
  );
}

export const STEPS = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;

/** Step state: which step is open, which have been visited. */
export function useSteps() {
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState<Record<number, boolean>>({ 0: true });
  const go = (i: number) => {
    setStep(i);
    setSeen((x) => ({ ...x, [i]: true }));
  };
  return { step, seen, go };
}

export function StepNav({ step, seen, done, go, names = STEPS }: { step: number; seen: Record<number, boolean>; done: boolean[]; go: (i: number) => void; names?: readonly string[] }) {
  return (
    <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Learning steps">
      {names.map((name, i) => (
        <li key={name}>
          <button type="button" onClick={() => go(i)} aria-current={step === i ? 'step' : undefined} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset ${step === i ? 'bg-accent text-white ring-accent' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper'}`}>
            {seen[i] && done[i] && i > 0 && i !== step ? <Check aria-hidden className="size-3.5 text-correct" /> : <span className="num text-xs opacity-70">{i + 1}</span>}
            {name}
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * A lab opened from a lesson card starts at the top of the page, not wherever the lesson was scrolled to.
 * Only for forward navigation (clicking a link): when the student uses the browser's Back or Forward button
 * (a POP), the position is left alone so the browser's own history behaviour is not broken.
 */
export function useScrollTopOnOpen() {
  const type = useNavigationType();
  useLayoutEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Where the lab was opened from: the lesson and section it belongs to (both optional). */
export function useLabOrigin() {
  const [params] = useSearchParams();
  const lessonId = params.get('lesson');
  const section = params.get('section');
  const back = lessonId ? { to: `/learn/${encodeURIComponent(lessonId)}${section ? `#${encodeURIComponent(section)}` : ''}`, label: 'Back to lesson' } : { to: '/', label: 'Back' };
  return { lessonId, section, back };
}

/** Saves "lab finished" once, through the existing activity API, against the lesson the student came from. */
export function useLabCompletion(finished: boolean, lessonId: string | null) {
  const [saved, setSaved] = useState<'idle' | 'saved' | 'failed'>('idle');
  useEffect(() => {
    if (!finished || !lessonId || saved !== 'idle') return;
    api.activity({ kind: 'LAB_COMPLETE', resourceId: lessonId }).then(() => setSaved('saved'), () => setSaved('failed'));
  }, [finished, lessonId, saved]);
  return saved;
}

const optionClass = (state: '' | 'correct' | 'wrong', picked: boolean) =>
  `flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ring-1 ring-inset ${state === 'correct' ? 'bg-correct-soft ring-correct' : state === 'wrong' ? 'bg-wrong-soft ring-wrong' : picked ? 'bg-accent-soft ring-accent' : 'bg-surface ring-rule-strong hover:bg-paper'}`;
const optionIcon = (state: '' | 'correct' | 'wrong') => (state === 'correct' ? <Check aria-hidden className="size-4 text-correct" /> : state === 'wrong' ? <X aria-hidden className="size-4 text-wrong" /> : <Circle aria-hidden className="size-4 text-ink-3" />);

export interface PredictItem { id: string; title: string; prompt: string; options: string[]; answer: number }

/** Predict, then test: the student commits to an answer first; the lab then runs it and explains with the real numbers. */
export function PredictCard({ items, index, picked, tested, onSelect, onPick, onLock, explain, onNext, onDone }: {
  items: PredictItem[];
  index: number;
  picked: Record<string, number>;
  tested: Record<string, boolean>;
  onSelect: (i: number) => void;
  onPick: (id: string, option: number) => void;
  onLock: (i: number) => void;
  explain: (i: number) => ReactNode;
  onNext: () => void;
  onDone: () => void;
}) {
  const item = items[index] ?? items[0]!;
  const shown = tested[item.id];
  return (
    <section className={`${panel} space-y-3 p-4`}>
      <h2 className="text-lg font-semibold text-ink">Predict, then test</h2>
      <div className="flex flex-wrap gap-1.5">
        {items.map((p, i) => (
          <button key={p.id} type="button" onClick={() => onSelect(i)} aria-pressed={index === i} className={`h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${index === i ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong'}`}>
            {tested[p.id] ? '✓ ' : ''}
            {p.title}
          </button>
        ))}
      </div>
      <p className="text-[15px] font-medium text-ink">{item.prompt}</p>
      <div role="radiogroup" aria-label="Your prediction" className="space-y-1.5">
        {item.options.map((o, i) => {
          const state = shown ? (i === item.answer ? 'correct' : picked[item.id] === i ? 'wrong' : '') : '';
          return (
            <button key={o} type="button" role="radio" aria-checked={picked[item.id] === i} disabled={!!shown} onClick={() => onPick(item.id, i)} className={optionClass(state, picked[item.id] === i)}>
              {optionIcon(state)}
              {o}
            </button>
          );
        })}
      </div>
      {!shown ? (
        <button type="button" className={btnMain} disabled={picked[item.id] === undefined} onClick={() => onLock(index)}>
          Lock in and test it on the bench
        </button>
      ) : (
        <div className="rounded-md bg-accent-soft p-3 text-sm text-ink" aria-live="polite">
          <strong>{picked[item.id] === item.answer ? 'Your prediction matches the bench. ' : 'The bench shows something different. '}</strong>
          {explain(index)}
          <div className="mt-2 flex gap-2">
            {index < items.length - 1 ? (
              <button type="button" className={btn} onClick={onNext}>
                Next prediction
              </button>
            ) : (
              <button type="button" className={btnMain} onClick={onDone}>
                Go to the experiment
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export interface McqItem { id: string; q: string; options: string[]; answer: number; why: string }

/** The practice step: answers lock when chosen, each explanation appears, and finishing saves lab completion. */
export function ApplyCard({ questions, ans, onAnswer, saved, backTo, pending = [] }: { questions: McqItem[]; ans: Record<string, number>; onAnswer: (id: string, option: number) => void; saved: 'idle' | 'saved' | 'failed'; backTo: string | null; pending?: string[] }) {
  const finished = Object.keys(ans).length === questions.length;
  const score = questions.filter((q) => ans[q.id] === q.answer).length;
  return (
    <section className={`${panel} space-y-4 p-4`}>
      <h2 className="text-lg font-semibold text-ink">Apply</h2>
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="space-y-1.5">
          <legend className="text-[15px] font-medium text-ink">
            {qi + 1}. {q.q}
          </legend>
          {q.options.map((o, i) => {
            const got = ans[q.id];
            const state = got === undefined ? '' : i === q.answer ? 'correct' : got === i ? 'wrong' : '';
            return (
              <button key={o} type="button" disabled={got !== undefined} onClick={() => onAnswer(q.id, i)} className={optionClass(state, false)}>
                {optionIcon(state)}
                {o}
              </button>
            );
          })}
          {ans[q.id] !== undefined && <p className="rounded-md bg-accent-soft p-2.5 text-sm text-ink">{q.why}</p>}
        </fieldset>
      ))}
      {finished && (
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          You scored {score} out of {questions.length}.
          {saved === 'saved' && <span className="ml-2 font-normal text-correct">Lab completion saved to your progress.</span>}
          {saved === 'failed' && <span className="ml-2 font-normal text-ink-3">Could not save your progress just now.</span>}
        </p>
      )}
      {finished && pending.length > 0 && (
        <div className="rounded-md bg-marker-soft p-2.5 text-sm text-ink" data-pending role="status">
          <strong>The lab is not complete yet.</strong> To finish it, you still need to: {pending.join('; ')}.
        </div>
      )}
      {finished && backTo && (
        <Link to={backTo} className={btn} data-back-to-lesson>
          Back to lesson
        </Link>
      )}
      <p className="text-xs text-ink-3">These practice questions were written for this lab and are Draft – unverified. They are not part of the question bank.</p>
    </section>
  );
}
