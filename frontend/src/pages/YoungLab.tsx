import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, RotateCcw, Zap } from 'lucide-react';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DisplayMath } from '../rich';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useSteps } from '../visual/labkit';
import {
  APPLY, classify, fringeWidth, angularFringeWidth, intensity, LIMITS, nearestOrder, pathOrder, PREDICTS, samplePattern, START, wavelengthRgb, windowHalf, type YoungState,
} from '../visual/young';
import type { CameraApi, CamGoal, Mode, Part, WaveView } from '../visual/young3d/YoungScene';
import { DERIVATION, fullCam, TOURS, topCam, type Cam } from '../visual/young3d/tours';

const YoungScene = lazy(() => import('../visual/young3d/YoungScene'));
const X_PER_M = 4;
const LX = 26;
const mm = (m: number, d = 2) => `${(m * 1000).toFixed(d)} mm`;
const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));

const PARTS: Record<Part, { name: string; text: string }> = {
  laser: { name: 'Laser', text: 'A laser emits light of a single wavelength with a steady phase. That is what makes the two slits coherent. Its colour here follows the wavelength you set.' },
  plate: { name: 'Double-slit plate', text: 'An opaque plate with two narrow slits. Each slit becomes a source of light waves, and because one wavefront reaches both, the two sources are coherent. You can drag the plate along the bench, and click a covered slit to uncover it. The slit separation is drawn larger than life.' },
  screen: { name: 'Observation screen', text: 'The screen shows the real pattern for the numbers you set. The scale along the bottom is in millimetres from the centre. Drag across it to place the probe; drag the amber stand along the bench to change the distance D.' },
  bench: { name: 'Optical bench', text: 'The bench holds everything in line, and its marks show distances in metres from the slit plate. The slit-to-screen distance D is read from them.' },
};

// ---------------------------------------------------------------------------------------------- safety nets
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** 2D view for devices without WebGL: the same physics, drawn flat. */
function Pattern2D({ s, wide, probe }: { s: YoungState; wide: boolean; probe: number }) {
  const half = windowHalf(s, wide);
  const p = useMemo(() => samplePattern(s, half, 500), [s, half]);
  const W = 600, H = 190, L = 34, R = 586, T = 14, B = 160;
  const X = (y: number) => L + ((y + half) / (2 * half)) * (R - L);
  const Y = (i: number) => B - (B - T) * i;
  const c = wavelengthRgb(s.lambda);
  return (
    <div data-fallback-2d className="bg-surface p-3">
      <p className="mb-2 text-sm text-ink-2">This device cannot show the 3D laboratory, so here is the same experiment as a flat picture. All numbers come from the same physics.</p>
      <div className="h-10 w-full rounded" style={{ background: `linear-gradient(90deg, ${Array.from(p.i).filter((_, k) => k % 10 === 0).map((v, k, a) => `rgb(${c.map((x) => Math.round(x * Math.pow(v, 0.55))).join(',')}) ${((k / (a.length - 1)) * 100).toFixed(1)}%`).join(',')})` }} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Intensity against position on the screen">
        <rect x={L} y={T} width={R - L} height={B - T} fill="#fff" stroke="#e5e5e5" />
        <polyline points={Array.from(p.y).map((y, k) => `${X(y).toFixed(1)},${Y(p.i[k]!).toFixed(1)}`).join(' ')} fill="none" stroke="#b42318" strokeWidth={1.6} />
        <line x1={X(probe * half)} y1={T} x2={X(probe * half)} y2={B} stroke="#1a2233" strokeWidth={1.4} />
        <text x={(L + R) / 2} y={182} fontSize={12} textAnchor="middle" fill="#4d5768">position on the screen (mm): window ±{(half * 1000).toFixed(1)}</text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- analysis graph
interface Run { lambda: number; d: number; D: number; measured: number; theory: number }
function FitGraph({ runs }: { runs: Run[] }) {
  const xs = runs.map((r) => 1 / r.d); // mm⁻¹
  const ys = runs.map((r) => r.measured * 1000); // mm
  const slope = xs.reduce((t, x, i) => t + x * ys[i]!, 0) / xs.reduce((t, x) => t + x * x, 0); // mm·mm = λD
  const xm = Math.max(...xs) * 1.15;
  const ym = Math.max(...ys, slope * xm) * 1.1;
  const X = (x: number) => 40 + (x / xm) * 340;
  const Y = (y: number) => 130 - (y / ym) * 110;
  const r0 = runs[0]!;
  const lam = (slope / (r0.D * 1000)) * 1e6; // nm: slope (mm²) / D (mm) = λ in mm → ×1e6 nm
  return (
    <div>
      <svg viewBox="0 0 400 165" className="w-full max-w-md" role="img" aria-label="Fringe width against one over slit separation: a straight line through the origin.">
        <rect x={40} y={20} width={340} height={110} fill="#fff" stroke="#e5e5e5" />
        <line x1={X(0)} y1={Y(0)} x2={X(xm)} y2={Y(slope * xm)} stroke="#2347a8" strokeWidth={1.2} opacity={0.65} />
        {xs.map((x, i) => <circle key={i} cx={X(x)} cy={Y(ys[i]!)} r={3.4} fill="#b42318" />)}
        <text x={380} y={148} fontSize={9} textAnchor="end" fill="#4d5768">1/d (mm⁻¹)</text>
        <text x={42} y={15} fontSize={9} fill="#4d5768">measured fringe width (mm)</text>
        <text x={40} y={160} fontSize={8.5} fill="#7c8595">Line: β = (λD) × (1/d). Dots: your runs.</text>
      </svg>
      <p className="text-[15px] text-ink">
        The dots lie on a straight line through the origin: the fringe width is <em>inversely proportional to the slit separation</em>. The slope is λD, which gives a wavelength of <strong className="num">{lam.toFixed(0)} nm</strong>. You set {r0.lambda} nm.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- page
const STEP_NAMES = ['Predict', 'Configure', 'Run', 'Observe', 'Measure', 'Analyse', 'Apply'] as const;
type Tab = 'learn' | 'practical';
let goalSeq = 1;

export function YoungLabPage() {
  const { lessonId, back } = useLabOrigin();
  const [tab, setTab] = useState<Tab>('learn');
  const [s, setS] = useState<YoungState>(START);
  const [view, setView] = useState<Mode>('apparatus');
  const [plateX, setPlateX] = useState(0);
  const [laserOn, setLaserOn] = useState(true);
  const [wide, setWide] = useState(false);
  const [probe, setProbe] = useState(0.3);
  const [snap, setSnap] = useState(false);
  const [markers, setMarkers] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [count, setCount] = useState(1);
  const [waveView, setWaveView] = useState<WaveView>('both');
  const [surface, setSurface] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<Part | null>(null);
  const [quality, setQuality] = useState<'high' | 'low'>(() => (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'low' : 'high'));
  const [fps, setFps] = useState(0);
  const [webgl] = useState(() => webglAvailable());
  const [force2d, setForce2d] = useState(false);
  const [viewOverride, setViewOverride] = useState<Mode | null>(null);
  const apiRef = useRef<CameraApi | null>(null);

  const screenX = plateX + s.D * X_PER_M;
  const mid = (plateX + screenX) / 2;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const aspectNow = () => (wrapRef.current && wrapRef.current.clientHeight > 0 ? wrapRef.current.clientWidth / wrapRef.current.clientHeight : 1.6);
  const [goal, setGoal] = useState<CamGoal>(() => ({ ...fullCam({ plateX: 0, screenX: START.D * X_PER_M }), id: 0 }));
  const flyTo = useCallback((c: Cam) => setGoal({ ...c, id: goalSeq++ }), []);

  // ---- learning tours
  const [tourId, setTourId] = useState<(typeof TOURS)[number]['id']>('walk');
  const [tourStep, setTourStep] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(true);
  const tour = TOURS.find((t) => t.id === tourId)!;
  const st = tour.steps[Math.min(tourStep, tour.steps.length - 1)]!;
  const learn = tab === 'learn';
  const eff = learn
    ? { view: viewOverride ?? st.mode, slits: { slit1: s.slit1, slit2: s.slit2 }, laser: true, fans: !!st.fans, geometry: !!st.geometry, hotspots: !!st.hotspots, waveView: viewOverride ? waveView : st.waveView ?? ('both' as WaveView), wide: false }
    : { view, slits: { slit1: s.slit1, slit2: s.slit2 }, laser: laserOn, fans: laserOn, geometry: false, hotspots: view === 'wave', waveView, wide };
  const sEff: YoungState = useMemo(() => ({ ...s, slit1: eff.slits.slit1, slit2: eff.slits.slit2 }), [s, eff.slits.slit1, eff.slits.slit2]);
  const half = windowHalf(sEff, eff.wide);

  useEffect(() => {
    if (!learn) return;
    const ctx = { plateX, screenX: plateX + s.D * X_PER_M, aspect: aspectNow() };
    flyTo(st.cam(ctx));
    setS((c) => ({ ...c, slit1: st.slits?.slit1 ?? true, slit2: st.slits?.slit2 ?? true }));
    setViewOverride(null);
    setSelected(st.focus ?? null);
    if (st.probeBeta !== undefined) setProbe(Math.max(-1, Math.min(1, (st.probeBeta * fringeWidth(s)) / windowHalf(s, false))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learn, tourId, tourStep]);
  useEffect(() => {
    if (!learn || !tourPlaying) return;
    const t = window.setTimeout(() => {
      if (tourStep < tour.steps.length - 1) setTourStep((n) => n + 1);
      else setTourPlaying(false);
    }, st.seconds * 1000);
    return () => window.clearTimeout(t);
  }, [learn, tourPlaying, tourStep, tourId, st.seconds, tour.steps.length]);
  const pickTour = (id: (typeof TOURS)[number]['id']) => { setTourId(id); setTourStep(0); setTourPlaying(true); };

  // ---- practical
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [fired, setFired] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const finished = Object.keys(ans).length === APPLY.length;
  const last = runs[runs.length - 1];
  const sameSetup = last ? runs.filter((r) => r.lambda === last.lambda && r.D === last.D) : [];
  const canFit = new Set(sameSetup.map((r) => r.d)).size >= 3;
  // The lab counts as completed only when the whole practical has been done, not just the questions.
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!fired ? ['fire the laser in the Run step'] : []),
    ...(!canFit ? ['save at least three runs with different slit separations (same wavelength and screen distance) in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [Object.keys(tested).length === PREDICTS.length, seen[1] ?? false, fired, seen[3] ?? false, runs.length >= 1, canFit, finished];

  const enterPractical = () => {
    setTab('practical');
    setS(START);
    setView('apparatus');
    setLaserOn(false);
    setFired(false);
    setPlateX(0);
    setMarkers({ a: null, b: null });
    flyTo(fullCam({ plateX: 0, screenX: START.D * X_PER_M, aspect: aspectNow() }));
  };
  const enterLearn = () => { setTab('learn'); setLaserOn(true); };
  const choosePredict = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    setPi(i);
    setS(p.base);
    setLaserOn(true);
  };

  // ---- 3D callbacks
  const onProbe = useCallback((f: number) => {
    if (snap) {
      const y = f * half;
      const n = nearestOrder(sEff, y);
      return setProbe(Math.max(-1, Math.min(1, (n * fringeWidth(sEff)) / half)));
    }
    setProbe(Math.max(-1, Math.min(1, f)));
  }, [snap, half, sEff]);
  const onDrag = useCallback((kind: 'screen' | 'plate', x: number) => {
    setS((cur) => {
      if (kind === 'screen') return { ...cur, D: Math.max(LIMITS.D.min, Math.min(LIMITS.D.max, Number(((x - plateX) / X_PER_M).toFixed(2)))) };
      const sx = plateX + cur.D * X_PER_M;
      const nd = Math.max(LIMITS.D.min, Math.min(LIMITS.D.max, Number(((sx - x) / X_PER_M).toFixed(2))));
      setPlateX(sx - nd * X_PER_M);
      return { ...cur, D: nd };
    });
  }, [plateX]);
  const onToggleSlit = useCallback((w: 1 | 2) => setS((c) => (w === 1 ? { ...c, slit1: !c.slit1 } : { ...c, slit2: !c.slit2 })), []);
  const onUserCamera = useCallback(() => setTourPlaying(false), []);
  const onKey = (e: React.KeyboardEvent) => {
    const a = apiRef.current;
    if (!a) return;
    const k = e.key;
    const d = e.shiftKey ? 0.35 : 0.12;
    if (k === 'ArrowLeft') a.orbit(-d, 0);
    else if (k === 'ArrowRight') a.orbit(d, 0);
    else if (k === 'ArrowUp') a.orbit(0, -d);
    else if (k === 'ArrowDown') a.orbit(0, d);
    else if (k === '+' || k === '=') a.zoom(0.85);
    else if (k === '-' || k === '_') a.zoom(1.18);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __young?: unknown }).__young = { fly: (c: Cam) => flyTo(c), set: (p: Partial<YoungState>) => setS((x) => ({ ...x, ...p })), get api() { return apiRef.current; }, get state() { return { s, plateX, screenX, probe, view: eff.view, fps, quality, tab, tourStep, tourPlaying, markers, laserOn }; } };
  });

  const preset = (name: 'full' | 'screen' | 'top' | 'wave' | 'close') => {
    const ctx = { plateX, screenX, aspect: aspectNow() };
    if (name === 'wave' || name === 'close') {
      if (learn) { setTourPlaying(false); setViewOverride('wave'); }
      if (tab === 'practical') setView('wave');
      flyTo(name === 'wave' ? { pos: [LX * 0.5, 19, 12], target: [LX * 0.5, 0, 0] } : { pos: [7, 8, 8.5], target: [6, 0, 0] });
      return;
    }
    if (learn) { setTourPlaying(false); setViewOverride('apparatus'); }
    if (tab === 'practical') setView('apparatus');
    if (name === 'full') flyTo(fullCam({ plateX, screenX, aspect: aspectNow() }));
    if (name === 'screen') flyTo({ pos: [ctx.screenX - 7.5, 2.6, 4.2], target: [ctx.screenX, 1.5, 0] });
    if (name === 'top') flyTo(topCam(ctx));
  };

  // ---- readouts
  const y = probe * half;
  const beta = fringeWidth(sEff);
  const order = pathOrder(sEff, y);
  const kind = classify(sEff, y);
  const I = intensity(sEff, y);
  const color = wavelengthRgb(s.lambda);
  const pat = useMemo(() => samplePattern(sEff, half, 400), [sEff.lambda, sEff.d, sEff.D, sEff.a, sEff.slit1, sEff.slit2, half]); // eslint-disable-line react-hooks/exhaustive-deps

  const measured = markers.a !== null && markers.b !== null ? Math.abs(markers.b - markers.a) * half / Math.max(1, count) : null;
  const saveRun = () => {
    if (measured === null) return;
    setRuns((r) => (r.some((x) => x.lambda === s.lambda && x.d === s.d && x.D === s.D && Math.abs(x.measured - measured) < 1e-9) ? r : [...r, { lambda: s.lambda, d: s.d, D: s.D, measured, theory: beta }]));
  };
  const showCanvas = webgl && !force2d;

  const scene = (
    <Suspense fallback={<div className="grid h-full place-items-center bg-[#e9edf4] text-sm text-ink-2">Loading the 3D laboratory…</div>}>
      <YoungScene
        s={sEff} mode={eff.view} plateX={plateX} laserOn={eff.laser} wide={eff.wide} probe={probe} markers={learn ? { a: null, b: null } : markers}
        waveView={eff.waveView} surface={surface} playing={playing} speed={speed} selected={selected} onSelect={setSelected} onProbe={onProbe} onDrag={onDrag}
        onToggleSlit={onToggleSlit} goal={goal} quality={quality} onQuality={setQuality} onFps={setFps} onUserCamera={onUserCamera}
        geometry={eff.geometry} fans={eff.fans} hotspots={eff.hotspots} apiRef={apiRef}
      />
    </Suspense>
  );

  return (
    <div data-young-lab>
      <PageHeader
        back={back}
        title="Young’s double-slit: 3D virtual laboratory"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Physics · Optics · Interference <Badge tone="amber">Draft – unverified</Badge> <Badge tone="accent">Prototype</Badge></span>}
      />
      <div role="tablist" aria-label="Lab mode" className="mb-4 inline-flex gap-0.5 rounded-lg bg-ink/5 p-0.5">
        {([['learn', 'Learn: 3 guided sequences'], ['practical', 'Practical experiment']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => (k === 'learn' ? enterLearn() : enterPractical())} className={`h-9 rounded-md px-4 text-sm font-medium ${tab === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div
              className="relative h-[340px] bg-[#e9edf4] sm:h-[460px] lg:h-[520px]"
              tabIndex={0}
              role="application"
              aria-label="3D optical bench. Drag to rotate, scroll or pinch to zoom, right-drag or two fingers to pan. With the keyboard: arrow keys rotate, plus and minus zoom."
              onKeyDown={onKey}
              data-canvas-wrap
              ref={wrapRef}
            >
              {showCanvas ? <SceneBoundary fallback={<Pattern2D s={sEff} wide={eff.wide} probe={probe} />}>{scene}</SceneBoundary> : <Pattern2D s={sEff} wide={eff.wide} probe={probe} />}
              {showCanvas && (
                <>
                  <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
                    {([['full', 'Full apparatus'], ['screen', 'Screen'], ['top', 'Top view'], ['wave', 'Wave view'], ['close', 'Close-up waves']] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => preset(k)} data-preset={k} className="pointer-events-auto h-8 rounded-md bg-white/90 px-2.5 text-[12px] font-medium text-ink shadow-sm ring-1 ring-black/10 hover:bg-white">{l}</button>
                    ))}
                  </div>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-white/90 p-1 shadow-sm ring-1 ring-black/10" role="group" aria-label="Camera controls">
                    <button type="button" aria-label="Rotate left" className="grid size-8 place-items-center rounded hover:bg-ink/5" onClick={() => apiRef.current?.orbit(-0.2, 0)}><ChevronLeft className="size-4" /></button>
                    <button type="button" aria-label="Rotate right" className="grid size-8 place-items-center rounded hover:bg-ink/5" onClick={() => apiRef.current?.orbit(0.2, 0)}><ChevronRight className="size-4" /></button>
                    <button type="button" aria-label="Zoom out" className="grid size-8 place-items-center rounded hover:bg-ink/5" onClick={() => apiRef.current?.zoom(1.2)}><Minus className="size-4" /></button>
                    <button type="button" aria-label="Zoom in" className="grid size-8 place-items-center rounded hover:bg-ink/5" onClick={() => apiRef.current?.zoom(0.83)}><Plus className="size-4" /></button>
                  </div>
                  <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-2 py-1 text-[11px] text-white" data-fps>3D · {fps} fps · {quality}</div>
                  <div className="pointer-events-none absolute bottom-2 right-2 hidden rounded bg-black/45 px-2 py-1 text-[11px] text-white sm:block">drag: rotate · wheel: zoom · right-drag: pan</div>
                </>
              )}
            </div>
            {/* controls */}
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="flex items-center justify-between text-ink">Wavelength λ
                  <span className="num inline-flex items-center gap-1.5 font-semibold"><span aria-hidden className="inline-block size-3.5 rounded-sm ring-1 ring-black/10" style={{ background: `rgb(${color.join(',')})` }} />{s.lambda} nm</span></span>
                <input id="young-l" type="range" {...LIMITS.lambda} value={s.lambda} onChange={(e) => setS({ ...s, lambda: Number(e.target.value) })} className="mt-1 h-6 w-full accent-[var(--color-accent)]" />
              </label>
              <Slider id="young-d" label="Slit separation d" unit="mm" value={s.d} {...LIMITS.d} shown={s.d.toFixed(2)} onChange={(v) => setS({ ...s, d: Number(v.toFixed(2)) })} />
              <Slider id="young-D" label="Screen distance D" unit="m" value={s.D} {...LIMITS.D} shown={s.D.toFixed(2)} onChange={(v) => setS({ ...s, D: Number(v.toFixed(2)) })} />
              <Slider id="young-p" label="Probe position on the screen" unit="mm" value={Math.round(probe * 100)} min={-100} max={100} step={1} shown={(y * 1000).toFixed(2)} onChange={(v) => onProbe(v / 100)} />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button type="button" className={btn} aria-pressed={!s.slit1} onClick={() => onToggleSlit(1)}>{s.slit1 ? 'Cover slit 1' : 'Uncover slit 1'}</button>
                <button type="button" className={btn} aria-pressed={!s.slit2} onClick={() => onToggleSlit(2)}>{s.slit2 ? 'Cover slit 2' : 'Uncover slit 2'}</button>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />Wide view (show the single-slit envelope)</label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />Snap probe to bright fringes</label>
                <button type="button" className={btn} onClick={() => { setS(START); setPlateX(0); setProbe(0.3); setMarkers({ a: null, b: null }); }}><RotateCcw aria-hidden className="size-4" /> Reset</button>
              </div>
              {eff.view === 'wave' && (
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2" data-wave-controls>
                  <div role="group" aria-label="Wave display" className="inline-flex gap-0.5 rounded-md bg-ink/5 p-0.5">
                    {([['waves', 'Waves'], ['intensity', 'Brightness'], ['both', 'Both']] as const).map(([k, l]) => (
                      <button key={k} type="button" aria-pressed={waveView === k} onClick={() => setWaveView(k)} className={`h-8 rounded px-2.5 text-[13px] font-medium ${eff.waveView === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>{l}</button>
                    ))}
                  </div>
                  <button type="button" className={btn} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}{playing ? 'Pause waves' : 'Play waves'}</button>
                  <label className="inline-flex items-center gap-1.5 text-sm text-ink">Speed
                    <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-8 rounded-md border border-rule-strong bg-surface px-1 text-sm"><option value={0.25}>0.25×</option><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={surface} onChange={(e) => setSurface(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />3D surface</label>
                </div>
              )}
            </div>
          </div>

          {selected && (
            <div className={`${panel} p-3 text-sm`} data-part-card role="status">
              <strong className="text-ink">{PARTS[selected].name}.</strong> <span className="text-ink-2">{PARTS[selected].text}</span>
            </div>
          )}

          <div className={`${panel} p-3`} aria-live="polite" data-readout>
            <h3 className="text-sm font-semibold text-ink">Measured now</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
              {([
                ['Fringe width, λD/d', mm(beta)],
                ['Angular fringe width, λ/d', `${angularFringeWidth(s).toFixed(5)} rad`],
                ['Probe position, y', `${(y * 1000).toFixed(2)} mm`],
                ['Path difference at the probe', `${order.toFixed(2)} λ`],
                ['What the probe sees', !(sEff.slit1 && sEff.slit2) ? 'one slit: no fringes' : kind === 'bright' ? `bright (order ${nearestOrder(sEff, y)})` : kind === 'dark' ? 'dark' : 'between'],
                ['Relative intensity at the probe', I.toFixed(3)],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
              ))}
            </dl>
            <svg viewBox="0 0 600 110" className="mt-2 w-full" role="img" aria-label="Intensity against position on the screen with the probe marked">
              <rect x={30} y={8} width={550} height={80} fill="#fff" stroke="#e5e5e5" />
              <polyline points={Array.from(pat.y).map((yy, k) => `${(30 + ((yy + half) / (2 * half)) * 550).toFixed(1)},${(88 - 80 * pat.i[k]!).toFixed(1)}`).join(' ')} fill="none" stroke="#b42318" strokeWidth={1.4} />
              <line x1={30 + (y + half) / (2 * half) * 550} y1={8} x2={30 + (y + half) / (2 * half) * 550} y2={88} stroke="#1a2233" strokeWidth={1.4} />
              <text x={305} y={104} fontSize={11} textAnchor="middle" fill="#4d5768">position on the screen, ±{(half * 1000).toFixed(1)} mm</text>
            </svg>
            <p className="mt-1 text-xs text-ink-3">The screen shows the real pattern for these numbers. The 3D bench draws the slit separation larger than life, and the wave view is a magnified model (its geometry is exact; its wavelength and separation are not to scale).</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {learn ? (
            <section className={`${panel} space-y-3 p-4`} data-tour-panel>
              <h2 className="text-lg font-semibold text-ink">Learn it in 3D</h2>
              <div role="group" aria-label="Choose a sequence" className="flex flex-wrap gap-1.5">
                {TOURS.map((t) => (
                  <button key={t.id} type="button" aria-pressed={tourId === t.id} onClick={() => pickTour(t.id)} data-tour={t.id} className={`h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${tourId === t.id ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong'}`}>{t.title.replace(/^Tour \d: /, (m) => m.slice(0, 7) + ' ')}</button>
                ))}
              </div>
              <p className="text-sm text-ink-2">{tour.blurb}</p>
              <div className="rounded-md bg-accent-soft p-3" aria-live="polite" data-tour-caption>
                <div className="text-xs font-semibold uppercase tracking-wide text-accent">Step {tourStep + 1} of {tour.steps.length}</div>
                <h3 className="mt-0.5 text-base font-semibold text-ink">{st.title}</h3>
                <p className="mt-1 text-[15px] text-ink">{st.text}</p>
              </div>
              {tourId === 'pattern' && (st.derive ?? 0) > 0 && (
                <div className="space-y-2" data-derivation>
                  {DERIVATION.slice(0, st.derive).map((d, i) => (
                    <div key={i} className={`rounded-md border border-rule px-3 py-2 ${i === (st.derive ?? 1) - 1 ? 'bg-surface ring-1 ring-accent' : 'bg-surface/60'}`}>
                      <DisplayMath tex={d.tex} />
                      <p className="text-xs text-ink-2">{d.text}</p>
                    </div>
                  ))}
                  {st.derive === 5 && <p className="num text-sm text-ink">With your settings: β = {mm(beta)} (λ = {s.lambda} nm, D = {s.D.toFixed(2)} m, d = {s.d.toFixed(2)} mm).</p>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sequence controls">
                <button type="button" className={btn} onClick={() => setTourStep((n) => Math.max(0, n - 1))} disabled={tourStep === 0} aria-label="Previous step"><ChevronLeft aria-hidden className="size-4" />Back</button>
                <button type="button" className={btnMain} onClick={() => { if (!tourPlaying && tourStep === tour.steps.length - 1) { setTourStep(0); } setTourPlaying((p) => !p); }} data-tour-play>{tourPlaying ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}{tourPlaying ? 'Pause' : 'Play'}</button>
                <button type="button" className={btn} onClick={() => setTourStep((n) => Math.min(tour.steps.length - 1, n + 1))} disabled={tourStep === tour.steps.length - 1} aria-label="Next step">Next<ChevronRight aria-hidden className="size-4" /></button>
                <button type="button" className={btn} onClick={() => { setTourStep(0); setTourPlaying(true); }} data-tour-replay><RotateCcw aria-hidden className="size-4" />Replay</button>
              </div>
              <p className="text-xs text-ink-3">Grab the 3D view at any time to rotate it: the sequence pauses so you can look around. Press Play to continue. The sliders change the experiment while you watch.</p>
              <button type="button" className={btnMain} onClick={enterPractical}>Do the practical experiment</button>
            </section>
          ) : (
            <>
              <StepNav step={step} seen={seen} done={done} go={go} names={STEP_NAMES} />
              {step === 0 && (
                <PredictCard
                  items={PREDICTS} index={pi} picked={picked} tested={tested}
                  onSelect={choosePredict} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
                  onLock={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setS(p.test); setTested((x) => ({ ...x, [p.id]: true })); }}
                  explain={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; return p.why({ base: p.base, test: p.test }); }}
                  onNext={() => choosePredict(pi + 1)} onDone={() => go(1)}
                />
              )}
              {step === 1 && (
                <section className={`${panel} space-y-2 p-4`}>
                  <h2 className="text-lg font-semibold text-ink">Configure</h2>
                  <p className="text-[15px] text-ink">Set up your own experiment. Choose a wavelength, a slit separation and a screen distance with the sliders, or drag the amber stand along the bench.</p>
                  <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                    <li>Click a part of the bench (laser, plate, screen) to read what it does.</li>
                    <li>Rotate and zoom to look at the slits from different angles.</li>
                    <li>Keep your settings: you will measure the fringe width in a moment.</li>
                  </ul>
                  <button type="button" className={btnMain} onClick={() => go(2)}>Go to the run</button>
                </section>
              )}
              {step === 2 && (
                <section className={`${panel} space-y-2 p-4`}>
                  <h2 className="text-lg font-semibold text-ink">Run</h2>
                  <p className="text-[15px] text-ink">Switch the laser on and let the light reach the slits and the screen.</p>
                  <button type="button" className={btnMain} onClick={() => { setLaserOn(true); setFired(true); }} data-fire disabled={laserOn && fired}><Zap aria-hidden className="size-4" />{laserOn && fired ? 'Laser is on' : 'Fire the laser'}</button>
                  {fired && <button type="button" className={btn} onClick={() => go(3)}>Observe the pattern</button>}
                </section>
              )}
              {step === 3 && (
                <section className={`${panel} space-y-2 p-4`}>
                  <h2 className="text-lg font-semibold text-ink">Observe</h2>
                  <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                    <li>Find the central bright fringe. What is the path difference there?</li>
                    <li>Drag the probe to a dark fringe. What is the path difference now?</li>
                    <li>Press “Wave view” and watch where the waves from the two slits cancel.</li>
                    <li>Cover one slit. What happens to the fringes?</li>
                  </ul>
                  <button type="button" className={btnMain} onClick={() => go(4)}>Now measure</button>
                </section>
              )}
              {step === 4 && (
                <section className={`${panel} space-y-3 p-4`} data-measure>
                  <h2 className="text-lg font-semibold text-ink">Measure the fringe width</h2>
                  <p className="text-[15px] text-ink">Place marker A on one bright fringe and marker B on another. Count how many fringe widths lie between them, enter the number, and the lab works out β.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btn} onClick={() => setMarkers((m) => ({ ...m, a: probe }))} data-mark-a>Marker A here</button>
                    <button type="button" className={btn} onClick={() => setMarkers((m) => ({ ...m, b: probe }))} data-mark-b>Marker B here</button>
                    <button type="button" className={btn} onClick={() => setMarkers({ a: null, b: null })}>Clear</button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-ink">Fringe widths between A and B
                    <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="num h-8 w-16 rounded-md border border-rule-strong px-2" data-count />
                  </label>
                  <div className="rounded-md bg-ink/5 p-2 text-sm" data-measured>
                    {measured === null ? 'Place both markers.' : <>Measured β = |y<sub>B</sub> − y<sub>A</sub>| ÷ {count} = <strong className="num">{mm(measured)}</strong> · theory λD/d = <span className="num">{mm(beta)}</span> · difference <span className="num">{(((measured - beta) / beta) * 100).toFixed(1)} %</span></>}
                  </div>
                  <button type="button" className={btnMain} disabled={measured === null} onClick={saveRun} data-save-run>Save this run to the history</button>
                  {runs.length > 0 && (
                    <div className="overflow-x-auto" data-history>
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">λ (nm)</th><th className="pr-2">d (mm)</th><th className="pr-2">D (m)</th><th className="pr-2">β measured (mm)</th><th>β theory (mm)</th></tr></thead>
                        <tbody className="num">{runs.map((r, i) => <tr key={i} className="border-t border-rule"><td className="py-1 pr-2">{r.lambda}</td><td className="pr-2">{r.d.toFixed(2)}</td><td className="pr-2">{r.D.toFixed(2)}</td><td className="pr-2">{(r.measured * 1000).toFixed(2)}</td><td>{(r.theory * 1000).toFixed(2)}</td></tr>)}</tbody>
                      </table>
                      <button type="button" className={`${btn} mt-2`} onClick={() => setRuns([])}>Clear history</button>
                    </div>
                  )}
                  {runs.length >= 3 && <button type="button" className={btnMain} onClick={() => go(5)}>Analyse my runs</button>}
                  <p className="text-xs text-ink-3">Tip: keep the wavelength and the screen distance fixed and change only the slit separation d for each run.</p>
                </section>
              )}
              {step === 5 && (
                <section className={`${panel} space-y-3 p-4`} data-analyse>
                  <h2 className="text-lg font-semibold text-ink">Analyse</h2>
                  {canFit ? <FitGraph runs={sameSetup} /> : <p className="text-[15px] text-ink">Save at least three runs with different slit separations (same wavelength and screen distance) in the Measure step first.</p>}
                  <button type="button" className={btnMain} onClick={() => go(6)}>Try CUET-style questions</button>
                </section>
              )}
              {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
            </>
          )}
          {webgl && (
            <p className="text-xs text-ink-3">
              Having trouble with the 3D view? <button type="button" className="underline" onClick={() => setForce2d((f) => !f)}>{force2d ? 'Switch back to 3D' : 'Use the flat 2D view'}</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
