import { BookOpen, ChevronLeft, ChevronRight, Download, GitBranch, Network, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DisplayMath, Rich } from '../rich';
import { Badge, PageHeader } from '../ui';
import { FallScene, fallTime, HeightDepthFigure, InverseSquareFigure, LawScene, PairScene, Plot, TEAL } from '../visual/art';
import { Check, Flowchart } from '../visual/Flowchart';
import { FLOW, FLOW_CHECK, FLOW_TITLE, FORMULAS, KEY_POINTS, MIND_MAP, NOTES, QUESTION, QUIZ, SIM, SOURCE, STEPS, TITLE } from '../visual/gravitation';
import { MindMap } from '../visual/MindMap';

export const VISUAL_PDF = '/visual/gravitation.pdf';
type View = 'story' | 'map' | 'flow' | 'read';
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'story', label: 'Visual explanation', icon: <Sparkles aria-hidden className="size-4" /> },
  { id: 'map', label: 'Mind map', icon: <Network aria-hidden className="size-4" /> },
  { id: 'flow', label: 'Flowchart', icon: <GitBranch aria-hidden className="size-4" /> },
  { id: 'read', label: 'Notes', icon: <BookOpen aria-hidden className="size-4" /> },
];
const panel = 'rounded-lg border border-rule bg-surface';
const toolBtn = 'inline-flex h-9 items-center gap-1.5 rounded-md bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper disabled:opacity-40';

function FormulaCard({ id }: { id: keyof typeof FORMULAS }) {
  const f = FORMULAS[id];
  const [on, setOn] = useState<string | null>(null);
  return (
    <div className={`${panel} p-3.5`} data-formula={id}>
      <div className="text-[13px] font-semibold text-ink-2">{f.name}</div>
      <DisplayMath tex={f.latex} />
      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
        {f.symbols.map((s) => (
          <li key={s.sym}>
            <button type="button" onClick={() => setOn(on === s.sym ? null : s.sym)} aria-pressed={on === s.sym} className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm ${on === s.sym ? 'bg-accent-soft ring-1 ring-inset ring-accent/40' : 'hover:bg-paper'}`}>
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

type SimStatus = 'ready' | 'running' | 'paused' | 'landed';
interface Run { h: number; m: number; time: number; speed: number }

/**
 * The falling-body simulation. The apple's position is worked out from s = ½gt² at every frame, in real time (or in
 * slow motion), so what is seen is what the equations say. The student sets the height and the mass, and can pause,
 * resume and reset.
 */
function Simulation({ lines, sources }: { lines: string[]; sources: string }) {
  const g = SIM.g;
  const [h, setH] = useState(SIM.height.start);
  const [m, setM] = useState(SIM.mass.start);
  const [speed, setSpeed] = useState(0.5);
  const [t, setT] = useState(0);
  const [status, setStatus] = useState<SimStatus>('ready');
  const [runs, setRuns] = useState<Run[]>([]);
  const T = fallTime(h, g);
  const tRef = useRef(0);
  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = tRef.current + ((now - last) / 1000) * speed;
      last = now;
      if (next >= T) {
        tRef.current = T;
        setT(T);
        setStatus('landed');
        setRuns((r) => [{ h, m, time: T, speed: g * T }, ...r].slice(0, 4));
        return;
      }
      tRef.current = next;
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, speed, T, g, h, m]);
  const reset = () => {
    tRef.current = 0;
    setT(0);
    setStatus('ready');
  };
  const main = () => {
    if (status === 'running') return setStatus('paused');
    if (status === 'landed') {
      tRef.current = 0;
      setT(0);
    }
    setStatus('running');
  };
  const s = Math.min(h, 0.5 * g * t * t);
  const v = g * t;
  const marks = Array.from({ length: Math.floor(t / SIM.markEvery + 1e-9) }, (_, i) => 0.5 * g * ((i + 1) * SIM.markEvery) ** 2).filter((x) => x < h - 0.02);
  const set = (fn: () => void) => {
    fn();
    reset();
  };
  const n2 = (x: number) => x.toFixed(2);
  const rows: { q: string; eq: string; value: string; name: string }[] = [
    { q: 'Time', eq: 't', value: `${n2(t)} s`, name: 't' },
    { q: 'Speed', eq: `v = gt = ${g} × ${n2(t)}`, value: `${n2(v)} m s⁻¹`, name: 'v' },
    { q: 'Distance fallen', eq: `s = ½gt² = ½ × ${g} × ${n2(t)}²`, value: `${n2(s)} m`, name: 's' },
    { q: 'Gravitational force', eq: `F = mg = ${n2(m)} × ${g}`, value: `${n2(m * g)} N`, name: 'F' },
  ];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" data-sim data-status={status} data-t={t.toFixed(4)} data-s={s.toFixed(4)} data-fall-time={T.toFixed(4)}>
      <div className="min-w-0">
        <div className={`${panel} overflow-hidden`}>
          <FallScene h={h} s={s} v={status === 'ready' ? 0 : v} m={m} g={g} released={status !== 'ready'} marks={marks} />
          <div className="flex flex-wrap items-center gap-2 border-t border-rule px-3 py-2.5" role="toolbar" aria-label="Simulation controls">
            <button type="button" onClick={main} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-strong" data-sim-main>
              {status === 'running' ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              {status === 'ready' ? 'Release the apple' : status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Run again'}
            </button>
            <button type="button" onClick={reset} disabled={status === 'ready'} className={toolBtn} data-sim-reset>
              <RotateCcw aria-hidden className="size-4" />
              Reset
            </button>
            <div role="group" aria-label="Playback speed" className="ml-auto inline-flex gap-0.5 rounded-md bg-ink/5 p-0.5">
              {SIM.speeds.map((x) => (
                <button key={x.value} type="button" aria-pressed={speed === x.value} onClick={() => setSpeed(x.value)} data-sim-speed={x.value} className={`h-8 rounded px-2.5 text-[13px] font-medium ${speed === x.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-2 border-t border-rule px-3 py-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="flex items-baseline justify-between text-ink">
                Height of the branch, h <span className="num font-semibold">{h.toFixed(1)} m</span>
              </span>
              <input type="range" min={SIM.height.min} max={SIM.height.max} step={SIM.height.step} value={h} onChange={(e) => set(() => setH(Number(e.target.value)))} className="mt-1 w-full accent-[var(--color-accent)]" data-sim-h />
            </label>
            <label className="block text-sm">
              <span className="flex items-baseline justify-between text-ink">
                Mass of the apple, m <span className="num font-semibold">{m.toFixed(2)} kg</span>
              </span>
              <input type="range" min={SIM.mass.min} max={SIM.mass.max} step={SIM.mass.step} value={m} onChange={(e) => set(() => setM(Number(e.target.value)))} className="mt-1 w-full accent-[var(--color-accent)]" data-sim-m />
            </label>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Dashed outlines mark the apple’s position every {SIM.markEvery} s. Air resistance is not included. g is taken as {g} m s⁻².
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Gravity in action</h2>
          {lines.map((l, i) => (
            <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink">
              <Rich text={l} inline />
            </p>
          ))}
        </div>
        <div className={`${panel} overflow-hidden`} data-sim-values>
          <div className="border-b border-rule bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink-2">The simulation and its equations</div>
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-rule last:border-b-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-ink-2">
                    {r.q}
                  </th>
                  <td className="num px-2 py-1.5 font-mono text-[12.5px] text-ink">{r.eq}</td>
                  <td className="num px-3 py-1.5 text-right font-semibold text-ink" data-value={r.name}>
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`${panel} overflow-hidden`}>
            <Plot name="s" title="Distance fallen" xLabel="time t (s)" yLabel="s (m)" xMax={T} yMax={h} fn={(x) => 0.5 * g * x * x} at={t} />
          </div>
          <div className={`${panel} overflow-hidden`}>
            <Plot name="v" title="Speed" xLabel="time t (s)" yLabel="v (m/s)" xMax={T} yMax={g * T} fn={(x) => g * x} at={t} color={TEAL} />
          </div>
        </div>
        {status === 'landed' && (
          <p role="status" className="rounded-lg border border-correct/30 bg-correct-soft px-3 py-2 text-sm text-ink" data-sim-result>
            The apple reached the ground after <b>{n2(T)} s</b>, moving at <b>{n2(g * T)} m s⁻¹</b>. Now change the mass and run it again: the time does not change, because g does not depend on the mass of the falling body.
          </p>
        )}
        {runs.length > 0 && (
          <div className={`${panel} overflow-hidden`} data-sim-runs>
            <div className="border-b border-rule bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink-2">Your runs</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-3 py-1 font-medium">Height</th>
                  <th className="px-2 py-1 font-medium">Mass</th>
                  <th className="px-2 py-1 font-medium">Force</th>
                  <th className="px-3 py-1 text-right font-medium">Time to fall</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={i} className="border-t border-rule" data-sim-run>
                    <td className="num px-3 py-1">{r.h.toFixed(1)} m</td>
                    <td className="num px-2 py-1">{r.m.toFixed(2)} kg</td>
                    <td className="num px-2 py-1">{n2(r.m * g)} N</td>
                    <td className="num px-3 py-1 text-right font-semibold">{n2(r.time)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[13px] text-ink-3">
          {SIM.equationsNote} {sources}
        </p>
      </div>
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
    <div role="group" aria-label={label} className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink">{label}</span>
      <div className="inline-flex gap-0.5 rounded-md bg-ink/5 p-0.5">
        {SCALE.map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => set(n)} data-lab={`${id}-${n}`} className={`h-8 w-9 rounded text-sm font-medium ${value === n ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
            ×{n}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div data-lab>
      <div className={`${panel} overflow-hidden`}>
        <LawScene m1={m1} m2={m2} r={r} />
        <div className="grid gap-x-6 gap-y-2 border-t border-rule px-3 py-3 sm:grid-cols-3">
          <Pick label="Mass m₁" value={m1} set={setM1} id="m1" />
          <Pick label="Mass m₂" value={m2} set={setM2} id="m2" />
          <Pick label="Separation r" value={r} set={setR} id="r" />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
        <div className={`${panel} p-3`} role="status" data-lab-result={f.toFixed(4)}>
          <div className="text-[13px] text-ink-2">Force, compared with the starting force F₀</div>
          <div className="num mt-0.5 text-2xl font-semibold text-ink">{frac(f)} × F₀</div>
          <p className="mt-1 text-sm text-ink">
            m₁m₂ / r² = {m1 * m2} ÷ {r}² = {frac(f)}. {r > 1 ? `At ${r} times the separation the force is divided by ${r * r}.` : 'Increase the separation and watch the vectors and the graph.'}
          </p>
        </div>
        <div className={`${panel} overflow-hidden`}>
          <Plot name="f" title="Force against separation" xLabel="r (in r₀)" yLabel="F (in F₀)" from={1} xMax={4} yMax={Math.max(1, m1 * m2)} fn={(x) => (m1 * m2) / (x * x)} at={r} />
        </div>
      </div>
    </div>
  );
}

function Story({ at, setAt }: { at: number; setAt: (n: number) => void }) {
  const step = STEPS[at]!;
  // Step 3 reveals its three ideas one at a time.
  const [reveal, setReveal] = useState(1);
  useEffect(() => setReveal(1), [at]);
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
  const sources = `Source: ${SOURCE.publisher} Class XI Physics, ${step.src.map((s) => `section ${s.section}, page ${s.page}`).join('; ')}.`;
  return (
    <div data-story data-step={step.id}>
      <ol className="mb-4 flex items-center gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1">
            <button type="button" onClick={() => setAt(i)} aria-current={i === at ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.title}`} data-step-dot={s.id} className="group block w-full py-1">
              <span className={`block h-1 rounded-full transition-colors ${i < at ? 'bg-accent' : i === at ? 'bg-ink' : 'bg-rule-strong group-hover:bg-ink-3'}`} />
              <span className={`mt-1 hidden truncate text-xs sm:block ${i === at ? 'font-semibold text-ink' : 'text-ink-3'}`}>
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {scene === 'fall' ? (
        <div key={step.id} className="vl-fade">
          <Simulation lines={step.lines} sources={sources} />
        </div>
      ) : (
        <div key={step.id} className="vl-fade grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {scene === 'tree' && (
              <div className={`${panel} overflow-hidden`}>
                <FallScene id="intro" h={SIM.height.start} s={0} m={SIM.mass.start} g={SIM.g} released={false} vectors={false} caption="An apple hangs from the branch of a tree, three metres above the ground." />
              </div>
            )}
            {(scene === 'pair' || scene === 'quiz') && (
              <div className={`${panel} overflow-hidden`}>
                <PairScene reveal={scene === 'quiz' ? 0 : reveal} />
              </div>
            )}
            {scene === 'law' && <Lab />}
            {scene === 'recap' && <MindMap root={MIND_MAP} onStep={(id) => setAt(STEPS.findIndex((s) => s.id === id))} />}
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{scene === 'tree' ? QUESTION : step.title}</h2>
            {scene === 'pair' ? (
              <ol className="mt-3 space-y-2">
                {step.lines.map((l, i) => (
                  <li key={i} className={`rounded-md border px-3 py-2 text-[15px] leading-relaxed transition-opacity duration-500 ${i < reveal ? 'border-rule bg-surface text-ink' : 'border-dashed border-rule text-transparent select-none'}`} aria-hidden={i >= reveal} data-reveal={i < reveal ? 'shown' : 'hidden'}>
                    {l}
                  </li>
                ))}
              </ol>
            ) : (
              step.lines.map((l, i) => (
                <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink">
                  <Rich text={l} inline />
                </p>
              ))
            )}
            {scene === 'pair' && reveal < step.lines.length && (
              <button type="button" onClick={() => setReveal(reveal + 1)} className={`${toolBtn} mt-3`} data-reveal-next>
                Show the next idea
                <ChevronRight aria-hidden className="size-4" />
              </button>
            )}
            {step.formula && (
              <div className="mt-3">
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
            <p className="mt-3 text-[13px] text-ink-3">{sources}</p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <button type="button" onClick={() => setAt(at - 1)} disabled={at === 0} className={toolBtn} data-story-back>
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </button>
        {at < STEPS.length - 1 ? (
          <button type="button" onClick={() => setAt(at + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong" data-story-next>
            {at === 0 ? 'Start' : 'Next'}
            <ChevronRight aria-hidden className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={() => setAt(0)} className={toolBtn} data-story-restart>
            <RotateCcw aria-hidden className="size-4" />
            Start again
          </button>
        )}
        <span className="ml-auto text-xs text-ink-3">
          Step {at + 1} of {STEPS.length}
          <span className="hidden sm:inline"> · keys ← → move between steps</span>
        </span>
      </div>
    </div>
  );
}

function ReadNotes() {
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,48rem)_minmax(0,19rem)] lg:justify-center" data-notes-layout>
      <article className="min-w-0" data-notes>
        {NOTES.map((n) => (
          <section key={n.heading} className="mb-7" id={`note-${n.heading.split('.')[0]}`}>
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
              <figure className={`${panel} mt-3 overflow-hidden`}>
                {n.figure === 'fall' ? (
                  <FallScene id="note-fall" h={3} s={3} v={SIM.g * fallTime(3, SIM.g)} m={SIM.mass.start} g={SIM.g} released marks={[1, 2, 3, 4, 5, 6, 7].map((k) => 0.5 * SIM.g * (k * 0.1) ** 2)} />
                ) : n.figure === 'pair' ? (
                  <PairScene id="note-pair" />
                ) : n.figure === 'inverse' ? (
                  <InverseSquareFigure />
                ) : (
                  <HeightDepthFigure />
                )}
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
              <div className="mt-3 rounded-md border-l-2 border-accent bg-accent-soft px-4 py-3">
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
      </article>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start" data-notes-side>
        <div className={`${panel} p-4`} data-pdf-panel>
          <h2 className="text-base font-semibold text-ink">Download these notes</h2>
          <p className="mt-1 text-sm text-ink-2">A4 PDF, 6 pages: the notes, the figures, the mind map, the flowchart and two checks with answers. The text can be selected and searched.</p>
          <a href={VISUAL_PDF} download="CUET Prep - Gravitation - learning notes.pdf" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-strong" data-download-notes>
            <Download aria-hidden className="size-4" />
            Download PDF
          </a>
          <a href={VISUAL_PDF} target="_blank" rel="noreferrer" className="ml-2 text-sm font-medium text-accent hover:underline">
            Open in a new tab
          </a>
        </div>
        <nav aria-label="In these notes" className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold text-ink">In these notes</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {NOTES.map((n) => (
              <li key={n.heading}>
                <a href={`#note-${n.heading.split('.')[0]}`} className="text-ink-2 hover:text-accent">
                  {n.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold text-ink">Points to remember</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-ink">
            {KEY_POINTS.map((p) => (
              <li key={p}>
                <Rich text={p} inline />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/** The visual learning prototype for one Physics topic: a guided simulation, a mind map, a flowchart, the notes, and a PDF. */
export function VisualPage() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'story') as View;
  const at = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('step') ?? 1) - 1 || 0));
  const set = (next: Record<string, string>) => setParams(next, { replace: true });
  return (
    <div data-visual-page>
      <PageHeader
        back={{ to: '/CUET_UG', label: 'CUET UG subjects' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {TITLE}
            <Badge>Prototype</Badge>
            <Badge tone="amber">Not yet reviewed</Badge>
          </span>
        }
        subtitle="Physics. A simulation, a concept map, the chain of reasoning, and the notes."
        actions={
          <a href={VISUAL_PDF} download="CUET Prep - Gravitation - learning notes.pdf" className={toolBtn} data-download-pdf>
            <Download aria-hidden className="size-4" />
            Download PDF
          </a>
        }
      />
      <div role="tablist" aria-label="Ways to learn this topic" className="mb-4 flex gap-0 overflow-x-auto border-b border-rule">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} data-view={v.id} onClick={() => set(v.id === 'story' ? {} : { view: v.id })} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap ${view === v.id ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}>
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

      <footer className="mt-8 border-t border-rule pt-3 text-[13px] leading-relaxed text-ink-2" data-visual-source>
        <p>
          <span className="font-semibold text-ink">Where this comes from.</span> Written by CUET Prep from {SOURCE.publisher}, <i>{SOURCE.book}</i>, {SOURCE.chapter} ({SOURCE.edition}), sections {SOURCE.sectionsUsed.map((s) => s.split(' ')[0] ?? '').filter((s) => /^\d/.test(s)).join(', ')} and the Summary.{' '}
          <a href={SOURCE.url} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">
            Open the chapter on NCERT’s website
          </a>
          . {SOURCE.rights}
        </p>
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
