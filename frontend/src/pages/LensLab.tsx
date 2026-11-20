import { RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import { APPLY, BENCH, benchGeometry, describe, LIMITS, PREDICTS, reading, signedF, solveLens, type LensKind, type LensState, type Reading } from '../visual/lens';

const n1 = (x: number) => (Math.abs(x) < 0.05 ? '0.0' : x.toFixed(1));
const n2 = (x: number) => x.toFixed(2);
const START: LensState = { kind: 'convex', f: 10, u: 25, h: 2 };

const RAY_COLOUR = { parallel: '#2347a8', centre: '#a86100', focal: '#1d7a4b' } as const;
const RAY_NAME = { parallel: 'Parallel to the axis', centre: 'Through the centre', focal: 'Through the focus' } as const;
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3, strokeLinejoin: 'round' } as const;
const ink = '#1a2233';

/** Width of an element in CSS pixels, kept up to date as the layout changes. */
function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * The bench. Distances along the axis are drawn to scale (1 unit = 1 cm, 100 cm across). Heights are drawn with one
 * vertical stretch (shown on screen) so small objects stay visible; a stretch keeps every straight line straight,
 * so the rays, the image and the focal points stay exactly aligned. Text and strokes are sized in screen pixels.
 */
function Scene({ s, onU, onStretch }: { s: LensState; onU: (u: number) => void; onStretch: (k: number) => void }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [focus, setFocus] = useState(false);
  const clipId = useId();

  const compact = width > 0 && width < 520;
  const KY = compact ? 3 : 2; // vertical stretch
  const H = compact ? 30 : 22; // half-height of the drawing area, in units
  useEffect(() => onStretch(KY), [KY, onStretch]);
  const XR = BENCH.x;
  const ppu = (width || 640) / (2 * XR); // pixels per unit
  const px = (p: number) => p / ppu; // pixels to units
  const fs = px(compact ? 12 : 12.5);
  const stripY = H + px(16);
  const vbH = 2 * H + px(compact ? 50 : 52);
  const vb = { x: -XR, y: -H - px(4), w: 2 * XR, h: vbH };

  const r = solveLens(s);
  const f = signedF(s.kind, s.f);
  const g = useMemo(() => benchGeometry(s), [s]);
  const virtual = r.real === false;
  const Y = (y: number) => -y * KY;
  const xr = (x: number) => x;
  const imgInView = g.image !== null && Math.abs(g.image.x) <= XR - 2 && Math.abs(Y(g.image.y)) <= H - 1;
  const A = Y(BENCH.aperture); // negative: top of the lens
  const lensW = px(7);

  const drag = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const x = ((clientX - b.left) / b.width) * vb.w + vb.x;
    onU(Math.min(LIMITS.u.max, Math.max(LIMITS.u.min, Math.round(-x * 2) / 2)));
  };

  const arrow = (x: number, tipY: number, colour: string, dashed: boolean) => {
    const dir = Math.sign(tipY) || 1;
    const len = Math.abs(tipY);
    const head = Math.min(px(10), len * 0.55);
    const half = head * 0.45;
    return (
      <g stroke={colour} strokeWidth={2.2} vectorEffect="non-scaling-stroke">
        <line x1={x} y1={0} x2={x} y2={tipY - dir * head * 0.6} strokeDasharray={dashed ? '5 3' : undefined} vectorEffect="non-scaling-stroke" />
        <path d={`M ${x - half} ${tipY - dir * head} L ${x} ${tipY} L ${x + half} ${tipY - dir * head} Z`} fill={colour} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </g>
    );
  };

  // The marked points, symmetric about the lens, named by side so they read the same for both lens types.
  const marks = [
    { x: -2 * s.f, label: '2F₁' },
    { x: -s.f, label: 'F₁' },
    { x: s.f, label: 'F₂' },
    { x: 2 * s.f, label: '2F₂' },
  ];
  const ticks = [-40, -30, -20, -10, 0, 10, 20, 30, 40];

  const status = g.image === null ? 'No image: rays leave parallel' : `${r.real ? 'Real' : 'Virtual'} image`;
  const off = g.image !== null && !imgInView;

  return (
    <div ref={box} className="w-full">
      <svg
        ref={svg}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ touchAction: 'pan-y' }}
        className="block w-full select-none bg-surface"
        role="img"
        aria-label={`Lens bench. ${s.kind} lens, focal length ${s.f} centimetres. Object ${s.u} centimetres from the lens. ${describe(r)}`}
        onPointerMove={(e) => dragging.current && drag(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={-XR} y={-H} width={2 * XR} height={2 * H} />
          </clipPath>
        </defs>
        <rect x={-XR} y={-H} width={2 * XR} height={2 * H} fill="#fbfcfe" stroke="#e3e6ee" strokeWidth={1} vectorEffect="non-scaling-stroke" />

        <g clipPath={`url(#${clipId})`}>
          {/* principal axis */}
          <line x1={-XR} y1={0} x2={XR} y2={0} stroke="#7c8595" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          {/* faint guides from each marked point down to its label */}
          {marks.map((m) => (
            <line key={m.label} x1={m.x} y1={0} x2={m.x} y2={H} stroke="#e8d3b0" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ))}

          {/* lens */}
          {s.kind === 'convex' ? (
            <path d={`M 0 ${-A} Q ${lensW} 0 0 ${A} Q ${-lensW} 0 0 ${-A} Z`} fill="#e6edfb" stroke="#2347a8" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          ) : (
            <path d={`M ${-lensW} ${-A} Q ${lensW * 0.1} 0 ${-lensW} ${A} L ${lensW} ${A} Q ${-lensW * 0.1} 0 ${lensW} ${-A} Z`} fill="#e6edfb" stroke="#2347a8" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          )}
          {/* arrowheads on the lens tips mark the kind at a glance */}

          {/* rays before the lens */}
          {g.rays.map((ray) => (
            <line key={`a${ray.id}`} x1={xr(g.object.x)} y1={Y(g.object.y)} x2={0} y2={Y(ray.y0)} stroke={RAY_COLOUR[ray.id]} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          ))}
          {/* rays after the lens, drawn to the edge of the bench */}
          {g.rays.map((ray) => (
            <line key={`b${ray.id}`} x1={0} y1={Y(ray.y0)} x2={XR} y2={Y(ray.y0 + ray.slope * XR)} stroke={RAY_COLOUR[ray.id]} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          ))}
          {/* a virtual image: dashed backward extensions to where the rays seem to come from */}
          {virtual &&
            g.image &&
            g.rays.map((ray) => <line key={`c${ray.id}`} x1={0} y1={Y(ray.y0)} x2={g.image!.x} y2={Y(g.image!.y)} stroke={RAY_COLOUR[ray.id]} strokeWidth={1.3} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />)}

          {/* image */}
          {g.image && imgInView && arrow(g.image.x, Y(g.image.y), '#b42318', virtual)}

          {/* focal points on the axis */}
          {marks.map((m) => (
            <circle key={m.label} cx={m.x} cy={0} r={px(3.2)} fill="#a86100" />
          ))}

          {/* object: draggable */}
          <g
            style={{ cursor: 'ew-resize', outline: 'none' }}
            tabIndex={0}
            role="slider"
            aria-label="Object distance from the lens. Left and right arrow keys move it; hold Shift for bigger steps."
            aria-orientation="horizontal"
            aria-valuemin={LIMITS.u.min}
            aria-valuemax={LIMITS.u.max}
            aria-valuenow={s.u}
            aria-valuetext={`${s.u} centimetres from the lens. ${describe(r)}`}
            data-object-handle
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : LIMITS.u.step;
              const next = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? s.u + step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? s.u - step : e.key === 'Home' ? LIMITS.u.min : e.key === 'End' ? LIMITS.u.max : null;
              if (next === null) return;
              e.preventDefault();
              onU(Math.min(LIMITS.u.max, Math.max(LIMITS.u.min, next)));
            }}
            onPointerDown={(e) => {
              dragging.current = true;
              svg.current?.setPointerCapture?.(e.pointerId);
              drag(e.clientX);
            }}
          >
            <rect x={g.object.x - px(14)} y={-H} width={px(28)} height={2 * H} fill="transparent" stroke={focus ? '#2347a8' : 'none'} strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
            {arrow(g.object.x, Y(g.object.y), ink, false)}
          </g>
        </g>

        {/* labels: outside the clip so they are never cut */}
        <text x={xr(g.object.x)} y={Y(g.object.y) - px(7)} fontSize={fs} textAnchor="middle" fill={ink} {...halo} strokeWidth={px(3)}>
          Object
        </text>
        {g.image && imgInView && (
          <text x={g.image.x} y={Y(g.image.y) + (g.image.y >= 0 ? -px(7) : px(15))} fontSize={fs} textAnchor="middle" fill="#b42318" {...halo} strokeWidth={px(3)}>
            Image
          </text>
        )}
        <text x={-XR + px(8)} y={-H + px(17)} fontSize={fs} fill={off ? '#b42318' : '#4d5768'} fontWeight={600} {...halo} strokeWidth={px(3)}>
          {off ? `${status} is outside the view (v = ${n1(g.image!.x)} cm)` : status}
        </text>

        {/* label strip under the plot: marked points, then the ruler in cm */}
        {marks.map((m) => (
          <text key={m.label} x={m.x} y={stripY} fontSize={fs} textAnchor="middle" fill="#a86100" fontWeight={600}>
            {m.label}
          </text>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={t} y1={H} x2={t} y2={H + px(4)} stroke="#9aa3b2" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={t} y={H + px(34)} fontSize={fs * 0.9} textAnchor="middle" fill="#7c8595">
              {t === 0 ? '0 cm' : t}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const Legend = ({ hidden, stretch }: { hidden: string[]; stretch: number }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-rule px-3 py-2 text-xs text-ink-2" aria-label="Ray key">
    {(Object.keys(RAY_NAME) as (keyof typeof RAY_NAME)[]).map((k) => (
      <li key={k} className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: RAY_COLOUR[k] }} />
        {RAY_NAME[k]}
      </li>
    ))}
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className="w-4 border-t-2 border-dashed border-ink-3" />
      Dashed = virtual
    </li>
    <li className="text-ink-3">Distances to scale · heights ×{stretch}</li>
    {hidden.length > 0 && <li className="text-ink-3">The ray “{RAY_NAME[hidden[0] as keyof typeof RAY_NAME]?.toLowerCase()}” would miss the lens, so it is not drawn.</li>}
  </ul>
);

function Results({ s }: { s: LensState }) {
  const r = solveLens(s);
  const f = signedF(s.kind, s.f);
  const main: [string, string, string][] = [
    ['Image distance', 'v', r.v === null ? '∞' : `${n1(r.v)} cm`],
    ['Magnification', 'm', r.m === null ? '∞' : n2(r.m)],
    ['Image height', "h′", r.hImage === null ? '∞' : `${n1(r.hImage)} cm`],
  ];
  return (
    <section className={`${panel} p-3`} aria-live="polite" aria-label="Results">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Results</h2>
        <Badge tone={r.real === null ? 'zinc' : r.real ? 'green' : 'amber'}>{describe(r)}</Badge>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {main.map(([name, sym, val]) => (
          <div key={name} className="rounded-md bg-paper px-2 py-1.5">
            <dt className="text-[11px] leading-tight text-ink-2">
              {name} <span className="text-ink-3">({sym})</span>
            </dt>
            <dd className="num text-base font-semibold text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-2">More values and sign convention</summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {(
            [
              ['Object distance (u)', `${n1(-s.u)} cm`],
              ['Focal length (f)', `${n1(f)} cm`],
              ['Power (P = 1/f)', `${n1(r.power)} D`],
              ['Object height (h)', `${n1(s.h)} cm`],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1">
              <dt className="text-ink-2">{k}</dt>
              <dd className="num font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-3">New Cartesian signs: u is negative for a real object. A negative v means the image is on the object side (virtual). Negative m means inverted.</p>
      </details>
    </section>
  );
}

function Graph({ rows, f }: { rows: Reading[]; f: number }) {
  // 1/v against 1/u: the lens formula says all points lie on a straight line of slope 1 and intercept 1/f.
  const lim = 0.5;
  const X = (x: number) => 20 + ((x + lim) / (2 * lim)) * 160;
  const Y = (y: number) => 110 - ((y + lim) / (2 * lim)) * 100;
  const c = 1 / f;
  const clip = useId();
  return (
    <svg viewBox="0 0 200 125" className="w-full max-w-md" role="img" aria-label="Graph of 1 over v against 1 over u. Recorded points lie on a straight line of slope 1.">
      <defs>
        <clipPath id={clip}>
          <rect x={20} y={10} width={160} height={100} />
        </clipPath>
      </defs>
      <rect x={20} y={10} width={160} height={100} fill="#fff" stroke="#e5e5e5" />
      <line x1={X(0)} y1={10} x2={X(0)} y2={110} stroke="#c9ced8" strokeWidth={0.6} />
      <line x1={20} y1={Y(0)} x2={180} y2={Y(0)} stroke="#c9ced8" strokeWidth={0.6} />
      <line clipPath={`url(#${clip})`} x1={X(-lim)} y1={Y(-lim + c)} x2={X(lim)} y2={Y(lim + c)} stroke="#2347a8" strokeWidth={1} opacity={0.6} />
      {rows.map((r, i) => (
        <circle key={i} cx={X(r.invU)} cy={Y(r.invV)} r={2.6} fill="#b42318" />
      ))}
      <text x={178} y={Y(0) - 2} fontSize={7} fill="#4d5768" textAnchor="end">
        1/u
      </text>
      <text x={X(0) + 3} y={18} fontSize={7} fill="#4d5768">
        1/v
      </text>
      <text x={24} y={121} fontSize={6.5} fill="#7c8595">
        Line: 1/v = 1/u + 1/f. Dots: your readings (cm⁻¹).
      </text>
    </svg>
  );
}

interface Row extends Reading {
  predicted: number | null;
  image: string;
}

export function LensLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [s, setS] = useState<LensState>(START);
  const [stretch, setStretch] = useState(2);
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [guess, setGuess] = useState('');
  const [ans, setAns] = useState<Record<string, number>>({});
  const set = (p: Partial<LensState>) => setS((x) => ({ ...x, ...p }));
  const r = solveLens(s);
  const geo = useMemo(() => benchGeometry(s), [s]);
  const meanF = useMemo(() => (rows.length ? rows.reduce((a, x) => a + x.f, 0) / rows.length : null), [rows]);
  const finished = Object.keys(ans).length === APPLY.length;
  // The lab counts as completed only when the whole practical has been done, not just the questions.
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(rows.length < 3 ? ['record at least three readings in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const fill = (i: number) => {
    const setup = (PREDICTS[i] ?? PREDICTS[0]!).setup;
    const sol = solveLens(setup);
    return (PREDICTS[i] ?? PREDICTS[0]!).why.replace('{v}', sol.v === null ? '∞' : n1(sol.v)).replace('{m}', n2(sol.m ?? 0));
  };
  const done = [true, Object.keys(tested).length === PREDICTS.length, Object.keys(tested).length === PREDICTS.length, rows.length >= 3, rows.length >= 3 && meanF !== null, true, Object.keys(ans).length === APPLY.length];

  const choosePredict = (i: number) => {
    setPi(i);
    setS((PREDICTS[i] ?? PREDICTS[0]!).setup);
  };
  const guessNum = guess.trim() === '' ? null : Number(guess);
  const record = () => {
    const rd = reading(s);
    if (!rd) return;
    if (rows.some((x) => Math.abs(x.u - rd.u) < 0.01 && x.f === rd.f)) return;
    setRows((x) => [...x, { ...rd, predicted: guessNum !== null && Number.isFinite(guessNum) ? guessNum : null, image: describe(r) }]);
    setGuess('');
  };

  return (
    <div data-lens-lab>
      <PageHeader
        back={back}
        title="Lens Lab: image formation by a thin lens"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            Aim: see how the image changes as the object moves. <Badge tone="amber">Draft – unverified</Badge>
          </span>
        }
      />

      <StepNav step={step} seen={seen} done={done} go={go} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <section className={`${panel} overflow-hidden`} aria-label="Simulation">
            <Scene s={s} onU={(u) => set({ u })} onStretch={setStretch} />
            <Legend hidden={geo.hidden} stretch={stretch} />
          </section>

          <section className={`${panel} p-3`} aria-label="Experiment controls">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm sm:max-w-xs">
                <span className="text-ink">Lens</span>
                <div role="group" aria-label="Lens type" className="mt-1 inline-flex w-full gap-0.5 rounded-md bg-ink/5 p-0.5">
                  {(['convex', 'concave'] as LensKind[]).map((k) => (
                    <button key={k} type="button" aria-pressed={s.kind === k} onClick={() => set({ kind: k })} className={`h-8 flex-1 rounded px-3 text-[13px] font-medium capitalize ${s.kind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className={btn} onClick={() => setS(START)}>
                <RotateCcw aria-hidden className="size-4" /> Reset
              </button>
            </div>
            <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-3">
              <Slider id="lens-u" label="Object distance |u|" unit="cm" value={s.u} {...LIMITS.u} onChange={(v) => set({ u: v })} />
              <Slider id="lens-f" label="Focal length |f|" unit="cm" value={s.f} {...LIMITS.f} onChange={(v) => set({ f: v })} />
              <Slider id="lens-h" label="Object height h" unit="cm" value={s.h} {...LIMITS.h} onChange={(v) => set({ h: v })} />
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <Results s={s} />

          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">A lens bends light so that rays from one point of an object meet again at one point: the image. Play with the bench for a minute.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Drag the object towards the lens. Watch the image move and change size.</li>
                <li>Find the object position where the image flips to the other side of the lens.</li>
                <li>Switch to a concave lens and try the same.</li>
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
                setS((PREDICTS[i] ?? PREDICTS[0]!).setup);
                setTested((x) => ({ ...x, [(PREDICTS[i] ?? PREDICTS[0]!).id]: true }));
              }}
              explain={fill}
              onNext={() => choosePredict(pi + 1)}
              onDone={() => go(2)}
            />
          )}

          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <p className="text-[15px] text-ink">Take a convex lens of any focal length. Move the object slowly from far away towards the lens and watch the image distance and the magnification in Results.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Where is the object when m = −1? How does that compare with f?</li>
                <li>What happens to v as |u| gets closer to f from the far side? And just inside f?</li>
                <li>Does a concave lens ever give a real image?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>
                Now measure
              </button>
            </section>
          )}

          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Put the object at different distances (at least three). Predict v first, then record the reading. This is the u–v method used in the practical.</p>
              <label className="block text-sm text-ink">
                Your prediction of v (cm), optional
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="e.g. 16.7, or −15 for a virtual image"
                  className="mt-1 block h-9 w-full rounded-md bg-surface px-3 text-sm ring-1 ring-inset ring-rule-strong"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btnMain} onClick={record} disabled={r.v === null}>
                  Record reading
                </button>
                {rows.length > 0 && (
                  <button type="button" className={btn} onClick={() => setRows([])}>
                    Clear table
                  </button>
                )}
              </div>
              {r.v === null && <p className="text-sm text-wrong">The image is at infinity here. Move the object away from the focus.</p>}
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Recorded readings</caption>
                    <thead>
                      <tr className="text-left text-ink-2">
                        <th className="py-1 pr-2">u (cm)</th>
                        <th className="pr-2">v (cm)</th>
                        <th className="pr-2">Your v</th>
                        <th className="pr-2">f (cm)</th>
                        <th className="pr-2">Image</th>
                        <th>
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {rows.map((x, i) => (
                        <tr key={i} className="border-t border-rule align-top">
                          <td className="py-1 pr-2">{n1(x.u)}</td>
                          <td className="pr-2">{n1(x.v)}</td>
                          <td className="pr-2">{x.predicted === null ? '–' : `${n1(x.predicted)} (${x.predicted - x.v >= 0 ? '+' : ''}${n1(x.predicted - x.v)})`}</td>
                          <td className="pr-2">{n1(x.f)}</td>
                          <td className="pr-2 font-sans text-xs text-ink-2">{x.image}</td>
                          <td>
                            <button type="button" aria-label={`Remove reading ${i + 1}`} className="grid size-6 place-items-center rounded text-ink-3 hover:bg-paper" onClick={() => setRows((a) => a.filter((_, j) => j !== i))}>
                              <X aria-hidden className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              {rows.length < 3 ? (
                <p className="text-[15px] text-ink">Record at least three readings in the Measure step first.</p>
              ) : (
                <>
                  <Graph rows={rows} f={meanF!} />
                  <p className="text-[15px] text-ink">
                    Every reading gives almost the same value of f: mean <strong className="num">{n1(meanF!)} cm</strong>. All dots lie on one straight line of slope 1: <em>1/v − 1/u is the same number each time</em>, and that number is 1/f.
                  </p>
                </>
              )}
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
                  The thin lens formula <span className="num">1/v − 1/u = 1/f</span> links where the object is to where the image forms. You checked it with your own readings.
                </li>
                <li>A convex lens gives a real, inverted image when the object is beyond f. The image grows as the object comes closer, and is the same size at 2f.</li>
                <li>Inside f, a convex lens gives a virtual, upright, magnified image. That is how a magnifying glass works.</li>
                <li>A concave lens always gives a virtual, upright, diminished image.</li>
                <li>
                  Magnification <span className="num">m = v/u</span>: its sign tells you upright (+) or inverted (−), and its size tells you bigger or smaller.
                </li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>
                Try CUET-style questions
              </button>
            </section>
          )}

          {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}

          <details className={`${panel} p-3 text-sm`}>
            <summary className="cursor-pointer font-medium text-ink">Theory and how to use the bench</summary>
            <div className="mt-2 space-y-2 text-ink-2">
              <p>
                Thin lens formula: <span className="num text-ink">1/v − 1/u = 1/f</span>. Magnification: <span className="num text-ink">m = v/u = h′/h</span>.
              </p>
              <p>Three rays locate the image: one parallel to the axis (then through the far focus), one through the centre (straight on), and one aimed at the near focus (then parallel to the axis). Where they meet, or seem to meet, is the image.</p>
              <p>Distances along the axis are to scale. Heights are stretched by the factor shown at the bottom right of the bench, so the object stays visible.</p>
              <p>Drag the black arrow, use the arrow keys when it is focused (Shift for bigger steps), or use the sliders.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
