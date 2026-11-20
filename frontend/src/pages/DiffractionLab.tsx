import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, RangeEditor, RangeSlider, StepNav, useContainerNarrow, useLabCompletion, useLabOrigin, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import { clampTo, digitsFor, stepFor, trim, type Range } from '../visual/ranges';
import {
  angularWidth, APPLY, curve, fresnelDistance, fresnelNumber, intensityAt, LIMITS, maxOrder, minimumPosition, pathOrder, posFromSlit, PREDICTS,
  isVisibleLight, posFromSlitIn, regime, regimeLabel, screenDistance, slitFromPosIn, START, wavelengthRgb, widthFormula, widthMeasured, type DiffState,
} from '../visual/diffraction';

const mm = (m: number, d = 2) => `${(m * 1000).toFixed(d)} mm`;
const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' } as const;

/** A "nice" tick spacing (1, 2 or 5 times a power of ten) giving about six ticks over the given range. */
function niceStep(range: number) {
  const raw = range / 6;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function Pattern({ s, probe, setProbe, showFar }: { s: DiffState; probe: number; setProbe: (f: number) => void; showFar: boolean }) {
  const [box, narrow] = useContainerNarrow<HTMLDivElement>(560);
  const W = narrow ? 360 : 600;
  const H = narrow ? 260 : 240;
  const L = 36;
  const R = W - 14;
  const T = 22;
  const B = H - 40;
  const c = useMemo(() => curve(s), [s]);
  const half = c.half;
  const X = (y: number) => L + ((y + half) / (2 * half)) * (R - L);
  const Y = (i: number) => B - (B - T) * i;
  const reg = regime(s);
  const color = wavelengthRgb(s.lambda);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const w = cv.width;
    const img = ctx.createImageData(w, 1);
    for (let x = 0; x < w; x++) {
      const y = -half + (2 * half * x) / (w - 1);
      const v = Math.pow(Math.max(0, Math.min(1, intensityAt(s, y, c.peak))), 0.55);
      img.data[4 * x] = color[0] * v;
      img.data[4 * x + 1] = color[1] * v;
      img.data[4 * x + 2] = color[2] * v;
      img.data[4 * x + 3] = 255;
    }
    for (let row = 0; row < cv.height; row++) ctx.putImageData(img, 0, row);
  }, [s, c.peak, half, color]);

  const probeY = probe * half;
  const moveTo = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const px = ((clientX - b.left) / b.width) * W;
    setProbe(Math.max(-1, Math.min(1, ((px - L) / (R - L)) * 2 - 1)));
  };

  const step = niceStep(2 * half);
  const ticks: number[] = [];
  for (let t = -Math.floor(half / step) * step; t <= half + 1e-12; t += step) ticks.push(Number(t.toPrecision(10)));
  const nMax = Math.min(maxOrder(s), 8);
  const y1 = minimumPosition(s, 1);
  const showMinima = reg !== 'near';
  const pathAtProbe = pathOrder(s, probeY);
  const fs = narrow ? 11 : 12;

  return (
    <div ref={box}>
      <div className="relative bg-black" style={{ height: 58 }} aria-hidden>
        <canvas ref={canvas} width={540} height={4} className="absolute inset-y-0 h-full" style={{ left: `${(L / W) * 100}%`, width: `${((R - L) / W) * 100}%` }} />
        <span className="absolute left-2 top-1 text-[11px] text-white/70">screen (what you see)</span>
        <span className="absolute inset-y-0 w-px bg-white/80" style={{ left: `${(X(probeY) / W) * 100}%` }} />
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full touch-pan-y select-none bg-surface"
        role="img"
        aria-label={`Intensity pattern on the screen. Slit ${s.a} micrometres, wavelength ${s.lambda} nanometres, screen ${fmt(screenDistance(s))} metres. ${regimeLabel(reg)}.`}
        onPointerDown={(e) => moveTo(e.clientX)}
        onPointerMove={(e) => e.buttons === 1 && moveTo(e.clientX)}
      >
        <rect x={L} y={T} width={R - L} height={B - T} fill="#fff" stroke="#e5e5e5" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={L} y1={Y(v)} x2={R} y2={Y(v)} stroke="#eef0f3" />
            <text x={L - 4} y={Y(v) + 4} fontSize={fs - 1} textAnchor="end" fill="#7c8595">
              {v}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={X(t)} y1={B} x2={X(t)} y2={B + 4} stroke="#7c8595" />
            <text x={X(t)} y={B + 16} fontSize={fs - 1} textAnchor="middle" fill="#4d5768">
              {fmt(t * 1000)}
            </text>
          </g>
        ))}
        <text x={(L + R) / 2} y={H - 6} fontSize={fs} textAnchor="middle" fill="#4d5768">
          position on the screen, y (mm)
        </text>
        <text x={L} y={14} fontSize={fs} fill="#4d5768">
          relative intensity (brightest point = 1)
        </text>
        {showMinima &&
          Array.from({ length: nMax }, (_, k) => k + 1).map((n) => {
            const yn = minimumPosition(s, n);
            if (yn === null || yn >= half) return null;
            return (
              <g key={n}>
                {[-1, 1].map((sg) => (
                  <line key={sg} x1={X(sg * yn)} y1={T} x2={X(sg * yn)} y2={B} stroke="#2347a8" strokeWidth={0.8} strokeDasharray="2 3" opacity={0.55} />
                ))}
                <text x={X(yn)} y={T + 11} fontSize={fs - 1} textAnchor="middle" fill="#2347a8" {...halo}>
                  {n}
                </text>
              </g>
            );
          })}
        {showFar && c.far && <polyline points={c.y.map((y, k) => `${X(y).toFixed(1)},${Y(Math.min(1.05, c.far![k]!)).toFixed(1)}`).join(' ')} fill="none" stroke="#7c8595" strokeWidth={1.4} strokeDasharray="5 4" />}
        <polyline points={c.y.map((y, k) => `${X(y).toFixed(1)},${Y(c.i[k]!).toFixed(1)}`).join(' ')} fill="none" stroke="#b42318" strokeWidth={2} />
        {showMinima && y1 !== null && y1 < half && (
          <g>
            <line x1={X(-y1)} y1={Y(0.5)} x2={X(y1)} y2={Y(0.5)} stroke="#1d7a4b" strokeWidth={1.6} />
            <line x1={X(-y1)} y1={Y(0.5) - 5} x2={X(-y1)} y2={Y(0.5) + 5} stroke="#1d7a4b" strokeWidth={1.6} />
            <line x1={X(y1)} y1={Y(0.5) - 5} x2={X(y1)} y2={Y(0.5) + 5} stroke="#1d7a4b" strokeWidth={1.6} />
            <text x={X(0)} y={Y(0.5) - 7} fontSize={fs} textAnchor="middle" fill="#1d7a4b" fontWeight="bold" {...halo}>
              2λD/a = {mm(widthFormula(s))}
            </text>
          </g>
        )}
        {reg === 'near' && (
          <text x={(L + R) / 2} y={T + 40} fontSize={fs} textAnchor="middle" fill="#a86100" fontWeight="bold" {...halo}>
            near field: the pattern is the slit’s shadow, not a wide band
          </text>
        )}
        {/* probe: draggable and keyboard-operable */}
        <g
          tabIndex={0}
          role="slider"
          aria-label="Probe position on the screen. Left and right arrow keys move it; hold Shift for bigger steps; Home returns it to the centre."
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round(probe * 100)}
          aria-valuetext={`${(probeY * 1000).toFixed(2)} millimetres from the centre. Path difference across the slit ${pathAtProbe.toFixed(2)} wavelengths. Relative intensity ${intensityAt(s, probeY, c.peak).toFixed(3)}`}
          data-probe-handle
          style={{ outline: 'none', cursor: 'ew-resize' }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => {
            const d = e.shiftKey ? 0.05 : 0.01;
            const next = e.key === 'ArrowRight' ? probe + d : e.key === 'ArrowLeft' ? probe - d : e.key === 'Home' ? 0 : e.key === 'End' ? 1 : null;
            if (next === null) return;
            e.preventDefault();
            setProbe(Math.max(-1, Math.min(1, next)));
          }}
        >
          <rect x={X(probeY) - 9} y={T} width={18} height={B - T} fill="transparent" stroke={focus ? '#2347a8' : 'none'} strokeDasharray="3 2" rx={2} />
          <line x1={X(probeY)} y1={T} x2={X(probeY)} y2={B} stroke="#1a2233" strokeWidth={1.4} />
          <circle cx={X(probeY)} cy={Y(Math.min(1, intensityAt(s, probeY, c.peak)))} r={4.5} fill="#1a2233" />
          <text x={Math.max(L + 30, Math.min(R - 30, X(probeY)))} y={B - 6} fontSize={fs - 1} textAnchor="middle" fill="#1a2233" {...halo}>
            probe (drag)
          </text>
        </g>
      </svg>
    </div>
  );
}

function Readout({ s, probe }: { s: DiffState; probe: number }) {
  const c = useMemo(() => curve(s), [s]);
  const reg = regime(s);
  const F = fresnelNumber(s);
  const wm = widthMeasured(s);
  const yProbe = probe * c.half;
  const rows: [string, string, string][] = [
    ['Slit width', 'a', `${s.a} µm`],
    ['Wavelength', 'λ', `${s.lambda} nm`],
    [s.lens ? 'Lens focal length' : 'Screen distance', s.lens ? 'f' : 'D', `${fmt(screenDistance(s))} m`],
    ['Fresnel number', 'a²/λD', fmt(F)],
    ['Central width, formula', '2λD/a', reg === 'near' ? 'not valid here' : mm(widthFormula(s))],
    ['Central width, from pattern', '2y₁', wm === null ? '—' : mm(wm)],
    ['Angular width', '2λ/a', reg === 'near' ? '—' : `${angularWidth(s).toFixed(4)} rad (${((angularWidth(s) * 180) / Math.PI).toFixed(2)}°)`],
    ['Minima on each side', 'n < a/λ', reg === 'near' ? '—' : String(maxOrder(s))],
    ['Peak brightness vs open beam', '', c.peak < 0.01 ? c.peak.toExponential(1) : c.peak.toFixed(2)],
    ['Fresnel distance', 'a²/λ', `${fmt(fresnelDistance(s))} m`],
  ];
  return (
    <div className={`${panel} p-3`} aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Measured now</h3>
        <Badge tone={reg === 'far' ? 'green' : reg === 'between' ? 'amber' : 'red'}>{regimeLabel(reg)}</Badge>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
        {rows.map(([name, sym, val]) => (
          <div key={name} className="flex items-baseline justify-between gap-2 border-b border-rule py-1">
            <dt className="text-ink-2">
              {name} {sym && <span className="text-ink-3">({sym})</span>}
            </dt>
            <dd className="num font-semibold text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 rounded-md bg-ink/5 p-2 text-sm" data-probe-readout>
        <span className="font-semibold text-ink">Probe: </span>
        <span className="num">y = {(yProbe * 1000).toFixed(2)} mm</span> · <span className="num">a sin θ = {pathOrder(s, yProbe).toFixed(2)} λ</span> · <span className="num">intensity = {intensityAt(s, yProbe, c.peak).toFixed(3)}</span>
      </div>
      <p className="mt-2 text-xs text-ink-3">At the n-th dark band a sin θ = nλ, so the probe reads a whole number there. The formulas 2λD/a and 2λ/a need the far field (Fresnel number well below 1) or a lens.</p>
    </div>
  );
}

interface Row { a: number; lambda: number; dist: number; lens: boolean; w: number }

function FitGraph({ rows }: { rows: Row[] }) {
  // Width of the central maximum against 1/a: a straight line through the origin whose slope is 2 λ D.
  const xs = rows.map((r) => 1000 / r.a); // mm⁻¹
  const ys = rows.map((r) => r.w * 1000); // mm
  const slope = xs.reduce((t, x, i) => t + x * ys[i]!, 0) / xs.reduce((t, x) => t + x * x, 0);
  const xm = Math.max(...xs) * 1.15;
  const ym = Math.max(...ys, slope * xm) * 1.1;
  const X = (x: number) => 40 + (x / xm) * 340;
  const Y = (y: number) => 130 - (y / ym) * 110;
  return (
    <div>
      <svg viewBox="0 0 400 165" className="w-full max-w-md" role="img" aria-label="Graph of central maximum width against one over slit width. Recorded points lie on a straight line through the origin.">
        <rect x={40} y={20} width={340} height={110} fill="#fff" stroke="#e5e5e5" />
        <line x1={X(0)} y1={Y(0)} x2={X(xm)} y2={Y(slope * xm)} stroke="#2347a8" strokeWidth={1.2} opacity={0.65} />
        {xs.map((x, i) => (
          <circle key={i} cx={X(x)} cy={Y(ys[i]!)} r={3.4} fill="#b42318" />
        ))}
        <text x={380} y={148} fontSize={9} textAnchor="end" fill="#4d5768">
          1/a (mm⁻¹)
        </text>
        <text x={42} y={15} fontSize={9} fill="#4d5768">
          width of central maximum (mm)
        </text>
        <text x={40} y={160} fontSize={8.5} fill="#7c8595">
          Line: width = (2λD) × (1/a). Dots: your readings.
        </text>
      </svg>
      <FitText rows={rows} slope={slope} />
    </div>
  );
}

function FitText({ rows, slope }: { rows: Row[]; slope: number }) {
  const r0 = rows[0]!;
  // slope has units mm²: 2 λ D. Divide by 2D (in mm) to get λ in mm, then to nm.
  const lam = (slope / (2 * r0.dist * 1000)) * 1e6;
  return (
    <p className="text-[15px] text-ink">
      The dots lie on a straight line through the origin: the width is <em>inversely proportional to the slit width</em>. The slope of the line is 2λD, which gives a wavelength of <strong className="num">{lam.toFixed(0)} nm</strong>. You set {r0.lambda} nm.
    </p>
  );
}

const startState: DiffState = { ...START };

export function DiffractionLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [s, setS] = useState<DiffState>(startState);
  const [probe, setProbe] = useState(0);
  const [showFar, setShowFar] = useState(false);
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const set = (p: Partial<DiffState>) => setS((x) => ({ ...x, ...p }));
  // The student's own range for any control; a control not listed uses the lab's range.
  const [ranges, setRanges] = useState<Partial<Record<'a' | 'lambda' | 'D' | 'f', Range>>>({});
  const design = { a: { min: 5, max: 2000 }, lambda: LIMITS.lambda, D: LIMITS.D, f: LIMITS.f };
  const rng = (k: 'a' | 'lambda' | 'D' | 'f'): Range => ranges[k] ?? { min: design[k].min, max: design[k].max };
  const stp = (k: 'lambda' | 'D' | 'f') => (ranges[k] ? stepFor(LIMITS[k].step, ranges[k]!) : LIMITS[k].step);
  const changeRange = (k: 'a' | 'lambda' | 'D' | 'f', r: Range) => {
    setRanges((cur) => {
      const next = { ...cur };
      if (r.min === design[k].min && r.max === design[k].max) delete next[k];
      else next[k] = r;
      return next;
    });
    setS((x) => ({ ...x, [k]: clampTo(x[k], r) }));
  };
  const finished = Object.keys(ans).length === APPLY.length;
  const reg = regime(s);
  const last = rows[rows.length - 1];
  const sameSetup = last ? rows.filter((r) => r.lambda === last.lambda && r.dist === last.dist && r.lens === last.lens) : [];
  const distinctWidths = new Set(sameSetup.map((r) => r.a)).size;
  const canFit = distinctWidths >= 3;
  // The lab counts as completed only when the whole practical has been done, not just the questions.
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!canFit ? ['record at least three readings with different slit widths (same colour and screen) in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, Object.keys(tested).length === PREDICTS.length, rows.length >= 3, canFit, true, finished];

  const choosePredict = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    setPi(i);
    setRanges({});
    setS(p.base);
  };
  const record = () => {
    const w = widthMeasured(s);
    if (w === null) return;
    const dist = screenDistance(s);
    if (rows.some((r) => r.a === s.a && r.lambda === s.lambda && r.dist === dist && r.lens === s.lens)) return;
    setRows((x) => [...x, { a: s.a, lambda: s.lambda, dist, lens: s.lens, w }]);
  };

  return (
    <div data-diffraction-lab>
      <PageHeader
        back={back}
        title="Diffraction Lab: light through a single slit"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            Physics · Optics · Single-slit diffraction <Badge tone="amber">Draft – unverified</Badge>
          </span>
        }
      />
      <StepNav step={step} seen={seen} done={done} go={go} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <Pattern s={s} probe={probe} setProbe={setProbe} showFar={showFar} />
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2">
              <RangeSlider id="diff-a" label="Slit width a" unit="µm" value={posFromSlitIn(rng('a'), s.a)} min={LIMITS.aPos.min} max={LIMITS.aPos.max} step={LIMITS.aPos.step} shown={trim(s.a)} onChange={(v) => set({ a: slitFromPosIn(rng('a'), v) })} design={design.a} range={rng('a')} rules={{ log: true, floor: 0.5, cap: 20000 }} onRange={(r) => changeRange('a', r)} />
              <label className="block text-sm">
                <span className="flex items-center justify-between text-ink">
                  Wavelength λ
                  <span className="num inline-flex items-center gap-1.5 font-semibold">
                    <span aria-hidden className="inline-block size-3.5 rounded-sm ring-1 ring-black/10" style={{ background: `rgb(${wavelengthRgb(s.lambda).join(',')})` }} />
                    {s.lambda} nm
                  </span>
                </span>
                <input id="diff-l" type="range" min={rng('lambda').min} max={rng('lambda').max} step={stp('lambda')} value={s.lambda} onChange={(e) => set({ lambda: Number(e.target.value) })} className="mt-1 h-6 w-full accent-[var(--color-accent)]" />
              </label>
              <div className="sm:col-span-2 -mt-2">
                <RangeEditor id="diff-l" unit="nm" design={design.lambda} range={rng('lambda')} rules={{ floor: 1, cap: 100000 }} onRange={(r) => changeRange('lambda', r)} />
                {!isVisibleLight(s.lambda) && <p className="mt-1 text-xs text-ink-3">This wavelength is outside visible light, so the pattern is drawn in grey.</p>}
              </div>
              {s.lens ? (
                <RangeSlider id="diff-f" label="Lens focal length f" unit="m" value={s.f} min={rng('f').min} max={rng('f').max} step={stp('f')} shown={trim(s.f)} onChange={(v) => set({ f: Number(v.toPrecision(6)) })} design={design.f} range={rng('f')} onRange={(r) => changeRange('f', r)} />
              ) : (
                <RangeSlider id="diff-d" label="Screen distance D" unit="m" value={s.D} min={rng('D').min} max={rng('D').max} step={stp('D')} shown={trim(s.D)} onChange={(v) => set({ D: Number(v.toPrecision(6)) })} design={design.D} range={rng('D')} onRange={(r) => changeRange('D', r)} />
              )}
              <div className="text-sm">
                <span className="text-ink">Observe</span>
                <div role="group" aria-label="Observation method" className="mt-1 inline-flex w-full gap-0.5 rounded-md bg-ink/5 p-0.5">
                  {[false, true].map((l) => (
                    <button key={String(l)} type="button" aria-pressed={s.lens === l} onClick={() => set({ lens: l })} className={`h-8 flex-1 rounded px-2 text-[13px] font-medium ${s.lens === l ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>
                      {l ? 'With a lens' : 'Screen only'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button type="button" className={btn} onClick={() => { setS(startState); setProbe(0); setRanges({}); }}>
                  <RotateCcw aria-hidden className="size-4" /> Reset
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={showFar} disabled={s.lens} onChange={(e) => setShowFar(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
                  Show the far-field formula (dashed)
                </label>
              </div>
              <p className="text-xs text-ink-3 sm:col-span-2">Drag the black probe along the pattern (or use the arrow keys when it is focused). Blue dotted lines mark the minima a sin θ = nλ. With a lens the screen sits in its focal plane, which always gives the far-field pattern.</p>
            </div>
          </div>
          <Readout s={s} probe={probe} />
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">Light that passes through a narrow slit does not make a sharp stripe. It spreads out into a pattern of bright and dark bands. Play with the controls for a minute.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Make the slit narrower. Does the bright central band get narrower or wider?</li>
                <li>Change the colour of the light from red to blue.</li>
                <li>Drag the probe to the first dark band and read “a sin θ” in the panel.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>
                Start predicting
              </button>
            </section>
          )}

          {step === 1 && (
            <PredictCard
              items={PREDICTS}
              index={pi}
              picked={picked}
              tested={tested}
              onSelect={choosePredict}
              onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={(i) => {
                const p = PREDICTS[i] ?? PREDICTS[0]!;
                setRanges({});
                setS(p.test);
                setTested((x) => ({ ...x, [p.id]: true }));
              }}
              explain={(i) => {
                const p = PREDICTS[i] ?? PREDICTS[0]!;
                return p.why({ base: p.base, test: p.test });
              }}
              onNext={() => choosePredict(pi + 1)}
              onDone={() => go(2)}
            />
          )}

          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <p className="text-[15px] text-ink">Now explore on your own, one change at a time.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Move the probe to each blue dotted line. What does a sin θ read at the 1st, 2nd and 3rd?</li>
                <li>Widen the slit step by step. When does the central band stop being wide? Watch the Fresnel number.</li>
                <li>Switch on “With a lens”: the screen distance is replaced by the focal length. Does the width follow 2λf/a?</li>
                <li>Turn on the dashed far-field formula and bring the screen close. Where does it stop matching?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>
                Now measure
              </button>
            </section>
          )}

          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Keep the colour and the screen fixed and change only the slit width. Record the width of the central maximum for at least three different slit widths (far field or with a lens).</p>
              <button type="button" className={btnMain} onClick={record} disabled={widthMeasured(s) === null}>
                Record reading
              </button>
              {reg === 'near' && <p className="text-sm text-wrong">This is the near field: there is no wide central maximum to measure. Move the screen farther or use a lens.</p>}
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-2">
                        <th className="py-1 pr-2">a (µm)</th>
                        <th className="pr-2">λ (nm)</th>
                        <th className="pr-2">D or f (m)</th>
                        <th className="pr-2">width (mm)</th>
                        <th>1/a (mm⁻¹)</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {rows.map((x, i) => (
                        <tr key={i} className="border-t border-rule">
                          <td className="py-1 pr-2">{x.a}</td>
                          <td className="pr-2">{x.lambda}</td>
                          <td className="pr-2">{fmt(x.dist)}</td>
                          <td className="pr-2">{(x.w * 1000).toFixed(2)}</td>
                          <td>{(1000 / x.a).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>
                    Clear table
                  </button>
                </div>
              )}
              {rows.length >= 3 && (
                <button type="button" className={btnMain} onClick={() => go(4)}>
                  Analyse my readings
                </button>
              )}
            </section>
          )}

          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canFit ? <FitGraph rows={sameSetup} /> : <p className="text-[15px] text-ink">Record at least three readings with different slit widths, and the same colour and screen, in the Measure step first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>
                Understand
              </button>
            </section>
          )}

          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>
                  Dark bands (minima) occur where <span className="num">a sin θ = nλ</span> (n = 1, 2, 3, …). You found that the probe reads a whole number there. n = 0 is the bright centre.
                </li>
                <li>
                  The central maximum is twice as wide as the others. Its width is <span className="num">2λD/a</span> (or <span className="num">2λf/a</span> with a lens), so a narrower slit or a longer wavelength gives a wider band.
                </li>
                <li>A narrower slit also gives a dimmer pattern, because less light gets through.</li>
                <li>
                  The formulas need the far field, where the Fresnel number <span className="num">a²/λD</span> is much less than 1. Close to a wide slit you only see its shadow, and ray optics works.
                </li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>
                Try CUET-style questions
              </button>
            </section>
          )}

          {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
        </div>
      </div>
    </div>
  );
}
