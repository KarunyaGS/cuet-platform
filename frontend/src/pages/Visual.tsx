import { BookOpen, ChevronLeft, ChevronRight, Download, GitBranch, Network, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DisplayMath, Rich } from '../rich';
import { Badge, PageHeader } from '../ui';
import { HeightDepthFigure, InverseSquareFigure, LawScene, PairScene, TreeScene } from '../visual/art';
import { Check, Flowchart } from '../visual/Flowchart';
import { FLOW, FLOW_CHECK, FLOW_TITLE, FORMULAS, KEY_POINTS, MIND_MAP, NOTES, QUESTION, QUIZ, SOURCE, STEPS, TITLE } from '../visual/gravitation';
import { MindMap } from '../visual/MindMap';

export const VISUAL_PDF = '/visual/gravitation.pdf';
type View = 'story' | 'map' | 'flow' | 'read';
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'story', label: 'Visual explanation', icon: <Sparkles aria-hidden className="size-4" /> },
  { id: 'map', label: 'Mind map', icon: <Network aria-hidden className="size-4" /> },
  { id: 'flow', label: 'Flowchart', icon: <GitBranch aria-hidden className="size-4" /> },
  { id: 'read', label: 'Read', icon: <BookOpen aria-hidden className="size-4" /> },
];

function FormulaCard({ id }: { id: keyof typeof FORMULAS }) {
  const f = FORMULAS[id];
  const [on, setOn] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-rule bg-surface p-4" data-formula={id}>
      <div className="text-[13px] font-semibold text-ink-2">{f.name}</div>
      <DisplayMath tex={f.latex} />
      <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
        {f.symbols.map((s) => (
          <li key={s.sym}>
            <button type="button" onClick={() => setOn(on === s.sym ? null : s.sym)} aria-pressed={on === s.sym} className={`flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${on === s.sym ? 'bg-accent-soft ring-1 ring-inset ring-accent/40' : 'bg-paper hover:bg-accent-soft'}`}>
              <span className="shrink-0 font-semibold text-accent">
                <Rich text={`$${s.sym}$`} inline />
              </span>
              <span className="text-ink">
                <Rich text={s.means} inline />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCALE = [1, 2, 3, 4];
function Lab() {
  const [m1, setM1] = useState(1);
  const [m2, setM2] = useState(1);
  const [r, setR] = useState(1);
  const f = (m1 * m2) / (r * r);
  const frac = (x: number) => {
    for (const d of [1, 2, 3, 4, 8, 9, 16]) if (Math.abs(x * d - Math.round(x * d)) < 1e-9) return d === 1 ? String(Math.round(x)) : `${Math.round(x * d)}/${d}`;
    return x.toFixed(2);
  };
  const Pick = ({ label, value, set, id }: { label: string; value: number; set: (n: number) => void; id: string }) => (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-sm text-ink">{label}</span>
      <div className="inline-flex gap-1 rounded-lg bg-ink/5 p-1">
        {SCALE.map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => set(n)} data-lab={`${id}-${n}`} className={`h-8 w-9 rounded-md text-sm font-semibold ${value === n ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
            ×{n}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div data-lab>
      <div className="overflow-hidden rounded-xl border border-rule">
        <LawScene m1={m1} m2={m2} r={r} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Pick label="Mass m₁" value={m1} set={setM1} id="m1" />
          <Pick label="Mass m₂" value={m2} set={setM2} id="m2" />
          <Pick label="Distance r" value={r} set={setR} id="r" />
        </div>
        <div className="rounded-xl bg-accent-soft p-3" role="status" data-lab-result={f.toFixed(4)}>
          <div className="text-sm text-ink-2">Force, compared with the start</div>
          <div className="num mt-0.5 text-2xl font-semibold text-accent">{frac(f)} × F</div>
          <p className="mt-1 text-sm text-ink">
            {m1 * m2} ÷ {r}² = {frac(f)}. {r > 1 ? `At ${r} times the distance the force is divided by ${r * r}.` : 'Now make the distance larger and watch the arrows.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Story({ at, setAt }: { at: number; setAt: (n: number) => void }) {
  const step = STEPS[at]!;
  // Step 2 plays in two parts: the fall, then what it shows. Step 3 reveals its three ideas one at a time.
  const [fallen, setFallen] = useState(false);
  // While the apple is put back on its branch it must jump there, not drift up.
  const [snap, setSnap] = useState(false);
  const [reveal, setReveal] = useState(1);
  useEffect(() => {
    setFallen(false);
    setReveal(1);
    if (step.scene !== 'fall') return;
    const t = setTimeout(() => setFallen(true), 350);
    return () => clearTimeout(t);
  }, [at, step.scene]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' && at < STEPS.length - 1) setAt(at + 1);
      if (e.key === 'ArrowLeft' && at > 0) setAt(at - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, setAt]);
  const scene = step.scene;
  return (
    <div data-story data-step={step.id}>
      <ol className="mb-4 flex items-center gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1">
            <button type="button" onClick={() => setAt(i)} aria-current={i === at ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.title}`} data-step-dot={s.id} className="group block w-full py-1.5">
              <span className={`block h-1.5 rounded-full transition-colors ${i < at ? 'bg-accent' : i === at ? 'bg-marker' : 'bg-rule-strong group-hover:bg-ink-3'}`} />
              <span className={`mt-1 hidden truncate text-xs sm:block ${i === at ? 'font-semibold text-ink' : 'text-ink-3'}`}>
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div key={step.id} className="vl-fade grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {(scene === 'tree' || scene === 'fall') && (
            <div className="overflow-hidden rounded-xl border border-rule">
              <TreeScene fallen={scene === 'fall' && fallen} showForce={scene === 'fall' && fallen} showMarks={scene === 'fall' && fallen} still={snap} />
            </div>
          )}
          {scene === 'pair' && (
            <div className="overflow-hidden rounded-xl border border-rule">
              <PairScene reveal={reveal} />
            </div>
          )}
          {scene === 'law' && <Lab />}
          {scene === 'quiz' && (
            <div className="overflow-hidden rounded-xl border border-rule">
              <PairScene reveal={0} />
            </div>
          )}
          {scene === 'recap' && <MindMap root={MIND_MAP} onStep={(id) => setAt(STEPS.findIndex((s) => s.id === id))} />}
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-marker">
            Step {at + 1} of {STEPS.length}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-ink">{scene === 'tree' ? QUESTION : step.title}</h2>
          {scene === 'pair' ? (
            <ol className="mt-3 space-y-2.5">
              {step.lines.map((l, i) => (
                <li key={i} className={`rounded-lg border px-3 py-2 text-[15px] leading-relaxed transition-opacity duration-500 ${i < reveal ? 'border-rule bg-surface text-ink' : 'border-dashed border-rule text-transparent select-none'}`} aria-hidden={i >= reveal} data-reveal={i < reveal ? 'shown' : 'hidden'}>
                  {l}
                </li>
              ))}
            </ol>
          ) : (
            step.lines.map((l, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed text-ink">
                <Rich text={l} inline />
              </p>
            ))
          )}
          {scene === 'fall' && (
            <button type="button" onClick={() => (setSnap(true), setFallen(false), setTimeout(() => (setSnap(false), setFallen(true)), 120))} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper" data-replay>
              <RotateCcw aria-hidden className="size-4" />
              Watch the fall again
            </button>
          )}
          {scene === 'pair' && reveal < step.lines.length && (
            <button type="button" onClick={() => setReveal(reveal + 1)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-semibold text-accent ring-1 ring-inset ring-accent/40 hover:bg-accent-soft" data-reveal-next>
              Show the next idea
              <ChevronRight aria-hidden className="size-4" />
            </button>
          )}
          {step.formula && (
            <div className="mt-4">
              <FormulaCard id={step.formula} />
            </div>
          )}
          {scene === 'law' && (
            <div className="mt-3">
              <FormulaCard id="g" />
            </div>
          )}
          {scene === 'quiz' && (
            <div className="mt-3">
              <Check name="story" question={QUIZ.question} choices={QUIZ.choices} />
            </div>
          )}
          <p className="mt-4 text-[13px] text-ink-3">
            Source: {SOURCE.publisher} Class XI Physics, {step.src.map((s) => `section ${s.section}, page ${s.page}`).join('; ')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <button type="button" onClick={() => setAt(at - 1)} disabled={at === 0} className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper disabled:opacity-40" data-story-back>
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </button>
        {at < STEPS.length - 1 ? (
          <button type="button" onClick={() => setAt(at + 1)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-strong" data-story-next>
            {at === 0 ? <Play aria-hidden className="size-4" /> : null}
            {at === 0 ? 'Start' : 'Next'}
            {at > 0 && <ChevronRight aria-hidden className="size-4" />}
          </button>
        ) : (
          <button type="button" onClick={() => setAt(0)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper" data-story-restart>
            <RotateCcw aria-hidden className="size-4" />
            Start again
          </button>
        )}
        <span className="ml-auto hidden text-xs text-ink-3 sm:block">Keys: ← and → move between steps.</span>
      </div>
    </div>
  );
}

function ReadNotes() {
  return (
    <article className="max-w-[46rem]" data-notes>
      {NOTES.map((n) => (
        <section key={n.heading} className="mb-8">
          <h2 className="text-lg font-semibold text-ink">{n.heading}</h2>
          {n.paragraphs.map((p, i) => (
            <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink">
              <Rich text={p} inline />
            </p>
          ))}
          {n.points && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink">
              {n.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {n.figure && (
            <figure className="mt-3 overflow-hidden rounded-xl border border-rule">
              {n.figure === 'fall' ? <TreeScene fallen showForce showMarks still /> : n.figure === 'pair' ? <PairScene /> : n.figure === 'inverse' ? <InverseSquareFigure /> : <HeightDepthFigure />}
            </figure>
          )}
          {n.formula && (
            <div className="mt-3">
              <FormulaCard id={n.formula} />
            </div>
          )}
          {n.heading.startsWith('6.') && (
            <div className="mt-3">
              <FormulaCard id="depth" />
            </div>
          )}
          {n.example && (
            <div className="mt-3 rounded-xl border-l-4 border-accent bg-accent-soft px-4 py-3">
              <div className="text-sm font-semibold text-ink">{n.example.title}</div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">
                <Rich text={n.example.body} inline />
              </p>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-3">
            Source: {SOURCE.publisher} Class XI Physics, section {n.src.section}, page {n.src.page}
          </p>
        </section>
      ))}
      <section className="mb-8 rounded-xl border border-rule bg-surface p-4">
        <h2 className="text-lg font-semibold text-ink">Points to remember</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink">
          {KEY_POINTS.map((p) => (
            <li key={p}>
              <Rich text={p} inline />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** The visual learning prototype for one Physics topic: a guided story, a mind map, a flowchart, the notes, and a PDF. */
export function VisualPage() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'story') as View;
  const at = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('step') ?? 1) - 1 || 0));
  const set = (next: Record<string, string>) => setParams(next, { replace: true });
  return (
    <div data-visual-page>
      <PageHeader
        back={{ to: '/CUET_UG', label: 'CUET-UG subjects' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {TITLE}
            <Badge tone="accent">Visual learning prototype</Badge>
            <Badge tone="amber">Preview: not yet reviewed</Badge>
          </span>
        }
        subtitle="Physics. See how it works step by step, explore the ideas as a map, follow the reasoning as a flowchart, or read the notes."
        actions={
          <a href={VISUAL_PDF} download="CUET Prep - Gravitation - learning notes.pdf" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-accent ring-1 ring-inset ring-rule-strong hover:bg-accent-soft" data-download-pdf>
            <Download aria-hidden className="size-4" />
            Download PDF
          </a>
        }
      />
      <div role="tablist" aria-label="Ways to learn this topic" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-ink/5 p-1">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} data-view={v.id} onClick={() => set(v.id === 'story' ? {} : { view: v.id })} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${view === v.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {view === 'story' && <Story at={at} setAt={(n) => set(n === 0 ? {} : { step: String(n + 1) })} />}
      {view === 'map' && <MindMap root={MIND_MAP} onStep={(id) => set({ step: String(STEPS.findIndex((s) => s.id === id) + 1) })} />}
      {view === 'flow' && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-ink">{FLOW_TITLE}</h2>
          <Flowchart nodes={FLOW} title={FLOW_TITLE} check={FLOW_CHECK} />
        </>
      )}
      {view === 'read' && <ReadNotes />}

      <footer className="mt-10 rounded-xl border border-rule bg-surface p-4 text-[13px] leading-relaxed text-ink-2" data-visual-source>
        <p>
          <span className="font-semibold text-ink">Where this comes from.</span> Written by CUET Prep from {SOURCE.publisher}, <i>{SOURCE.book}</i>, {SOURCE.chapter} ({SOURCE.edition}), sections {SOURCE.sectionsUsed.map((s) => s.split(' ')[0] ?? '').filter((s) => /^\d/.test(s)).join(', ')} and the Summary.{' '}
          <a href={SOURCE.url} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">
            Open the chapter on NCERT’s website
          </a>
          .
        </p>
        <p className="mt-1">{SOURCE.rights}</p>
        <p className="mt-1">
          Gravitation is a Class 11 topic. It is not in the CUET (UG) Physics syllabus; it is used here to try out this way of learning.{' '}
          <Link to="/CUET_UG" className="font-medium text-accent hover:underline">
            Back to subjects
          </Link>
        </p>
      </footer>
    </div>
  );
}
