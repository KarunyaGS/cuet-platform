import { RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import { APPLY, describe, LIMITS, PREDICTS, reading, signedF, solveLens, type LensKind, type LensState, type Reading } from '../visual/lens';

const n1 = (x: number) => (Math.abs(x) < 0.05 ? '0.0' : x.toFixed(1));
const n2 = (x: number) => x.toFixed(2);

/** Scene: 1 unit = 1 cm. The optical centre is at x = 0, y points up. */
const VX = 48;
const VY_WIDE = 17;
const VY_NARROW = 26;
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 0.9, strokeLinejoin: 'round' } as const;

function Scene({ s, onU }: { s: LensState; onU: (u: number) => void }) {
  const narrow = useNarrow();
  const VY = narrow ? VY_NARROW : VY_WIDE;
  const fs = narrow ? 3.7 : 3;
  const [focus, setFocus] = useState(false);
  const r = solveLens(s);
  const f = signedF(s.kind, s.f);
  const u = -s.u;
  const svg = useRef<SVGSVGElement>(null);
  const drag = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const x = ((clientX - b.left) / b.width) * (2 * VX) - VX;
    onU(Math.min(LIMITS.u.max, Math.max(LIMITS.u.min, Math.round(-x * 2) / 2)));
  };
  const tip = { x: u, y: s.h };
  const imageTip = r.v === null ? null : { x: r.v, y: r.hImage! };
  // Where each of the three rays crosses the lens plane (x = 0).
  const crossings: { y: number; cls: string }[] = [{ y: s.h, cls: '#2347a8' }, { y: 0, cls: '#a86100' }];
  if (Math.abs(u + f) > 0.05) crossings.push({ y: (s.h * f) / (u + f), cls: '#1d7a4b' });
  // Direction after the lens: through the image tip, or parallel to the central ray when the image is at infinity.
  const after = (y: number) => {
    if (imageTip) {
      const dx = imageTip.x - 0;
      const dy = imageTip.y - y;
      return { dx, dy };
    }
    return { dx: -u, dy: -s.h };
  };
  // Slope of the refracted ray (dy/dx) taken as light moving to the right.
  const slope = (y: number) => {
    const d = after(y);
    return d.dx === 0 ? 0 : d.dy / d.dx;
  };
  const ext = VX + 4;
  const showImage = imageTip && Math.abs(imageTip.x) < VX - 1 && Math.abs(imageTip.y) < VY - 1;
  const virtual = r.real === false;
  const col = (c: string) => c;
  return (
    <svg
      ref={svg}
      viewBox={`${-VX} ${-VY} ${2 * VX} ${2 * VY}`}
      className="block w-full touch-none select-none bg-surface"
      role="img"
      aria-label={`Lens bench. ${s.kind} lens, focal length ${s.f} centimetres. Object ${s.u} centimetres from the lens. ${describe(r)}`}
      onPointerMove={(e) => e.buttons === 1 && drag(e.clientX)}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
    >
      <g transform="scale(1,-1)">
        {/* principal axis, centimetre ticks */}
        <line x1={-VX} y1={0} x2={VX} y2={0} stroke="#7c8595" strokeWidth={0.25} />
        {Array.from({ length: 9 }, (_, i) => (i - 4) * 10).map((x) => (
          <line key={x} x1={x} y1={-0.6} x2={x} y2={0.6} stroke="#c9ced8" strokeWidth={0.2} />
        ))}
        {/* lens */}
        {s.kind === 'convex' ? (
          <path d={`M 0 ${-VY + 2} Q 3.2 0 0 ${VY - 2} Q -3.2 0 0 ${-VY + 2} Z`} fill="#edf1fa" stroke="#2347a8" strokeWidth={0.4} />
        ) : (
          <path d={`M -2.2 ${-VY + 2} Q 0.6 0 -2.2 ${VY - 2} L 2.2 ${VY - 2} Q -0.6 0 2.2 ${-VY + 2} Z`} fill="#edf1fa" stroke="#2347a8" strokeWidth={0.4} />
        )}
        {/* focal points F and 2F */}
        {[-2 * f, -f, f, 2 * f].map((x, i) => (
          <circle key={i} cx={x} cy={0} r={0.7} fill="#a86100" />
        ))}
        {/* rays before the lens */}
        {crossings.map((c, i) => (
          <line key={`a${i}`} x1={tip.x} y1={tip.y} x2={0} y2={c.y} stroke={col(c.cls)} strokeWidth={0.35} />
        ))}
        {/* rays after the lens */}
        {crossings.map((c, i) => {
          const m = slope(c.y);
          return <line key={`b${i}`} x1={0} y1={c.y} x2={ext} y2={c.y + m * ext} stroke={col(c.cls)} strokeWidth={0.35} />;
        })}
        {/* virtual image: dashed backward extensions */}
        {virtual &&
          imageTip &&
          crossings.map((c, i) => <line key={`c${i}`} x1={0} y1={c.y} x2={imageTip.x} y2={imageTip.y} stroke={col(c.cls)} strokeWidth={0.3} strokeDasharray="1.2 1" />)}
        {/* object: draggable arrow */}
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
          onPointerDown={(e) => drag(e.clientX)}
        >
          <rect x={u - 4} y={-VY} width={8} height={2 * VY} fill="transparent" stroke={focus ? '#2347a8' : 'none'} strokeWidth={0.5} strokeDasharray="1.5 1" rx={1} />
          <line x1={u} y1={0} x2={u} y2={s.h} stroke="#1a2233" strokeWidth={0.7} />
          <path d={`M ${u - 1} ${s.h - 1.6} L ${u} ${s.h} L ${u + 1} ${s.h - 1.6}`} fill="none" stroke="#1a2233" strokeWidth={0.7} />
        </g>
        {/* image */}
        {showImage && imageTip && (
          <g opacity={virtual ? 0.75 : 1} strokeDasharray={virtual ? '1.4 1' : undefined}>
            <line x1={imageTip.x} y1={0} x2={imageTip.x} y2={imageTip.y} stroke="#b42318" strokeWidth={0.7} />
            <path d={`M ${imageTip.x - 1} ${imageTip.y - Math.sign(imageTip.y) * 1.6} L ${imageTip.x} ${imageTip.y} L ${imageTip.x + 1} ${imageTip.y - Math.sign(imageTip.y) * 1.6}`} fill="none" stroke="#b42318" strokeWidth={0.7} strokeDasharray="none" />
          </g>
        )}
      </g>
      {/* labels (outside the flipped group so text is upright) */}
      {[-2 * f, -f, f, 2 * f].map((x, i) => {
        const lab = ['2F', 'F', 'F′', '2F′'][i];
        const k = s.kind === 'convex' ? lab : ['2F′', 'F′', 'F', '2F'][i];
        return (
          <text key={i} x={x} y={5.5} fontSize={fs} textAnchor="middle" fill="#a86100" {...halo}>
            {k}
          </text>
        );
      })}
      <text x={u} y={VY - 1.5} fontSize={fs} textAnchor="middle" fill="#1a2233" {...halo}>
        object (drag)
      </text>
      {imageTip && !showImage && (
        <text x={0} y={-VY + 4} fontSize={fs} textAnchor="middle" fill="#b42318" {...halo}>
          the image is off the bench ({n1(imageTip.x)} cm)
        </text>
      )}
      {showImage && imageTip && (
        <text x={Math.min(VX - 12, Math.max(-VX + 12, imageTip.x))} y={-VY + 4} fontSize={fs} textAnchor="middle" fill="#b42318" {...halo}>
          {virtual ? 'virtual image' : 'real image'}
        </text>
      )}
    </svg>
  );
}

function Readout({ s }: { s: LensState }) {
  const r = solveLens(s);
  const f = signedF(s.kind, s.f);
  const rows: [string, string, string][] = [
    ['Object distance', 'u', `${n1(-s.u)} cm`],
    ['Focal length', 'f', `${n1(f)} cm`],
    ['Image distance', 'v', r.v === null ? '∞' : `${n1(r.v)} cm`],
    ['Magnification', 'm = v/u', r.m === null ? '∞' : n2(r.m)],
    ['Image height', "h′", r.hImage === null ? '∞' : `${n1(r.hImage)} cm`],
    ['Power', 'P = 1/f', `${n1(r.power)} D`],
  ];
  return (
    <div className={`${panel} p-3`} aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Measured now</h3>
        <Badge tone={r.real === null ? 'zinc' : r.real ? 'green' : 'amber'}>{describe(r)}</Badge>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {rows.map(([name, sym, val]) => (
          <div key={name} className="flex items-baseline justify-between gap-2 border-b border-rule py-1">
            <dt className="text-ink-2">
              {name} <span className="text-ink-3">({sym})</span>
            </dt>
            <dd className="num font-semibold text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-3">Signs follow the Cartesian convention: u is negative for a real object. A negative v means the image is on the object side.</p>
    </div>
  );
}

function Graph({ rows, f }: { rows: Reading[]; f: number }) {
  // 1/v against 1/u: the lens formula says all points lie on a straight line of slope 1 and intercept 1/f.
  const lim = 0.3;
  const X = (x: number) => 20 + ((x + lim) / (2 * lim)) * 160;
  const Y = (y: number) => 110 - ((y + lim) / (2 * lim)) * 100;
  const c = 1 / f;
  return (
    <svg viewBox="0 0 200 125" className="w-full max-w-md" role="img" aria-label="Graph of 1 over v against 1 over u. Recorded points lie on a straight line of slope 1.">
      <rect x={20} y={10} width={160} height={100} fill="#fff" stroke="#e5e5e5" />
      <line x1={X(0)} y1={10} x2={X(0)} y2={110} stroke="#c9ced8" strokeWidth={0.6} />
      <line x1={20} y1={Y(0)} x2={180} y2={Y(0)} stroke="#c9ced8" strokeWidth={0.6} />
      <line x1={X(-lim)} y1={Y(-lim + c)} x2={X(lim)} y2={Y(lim + c)} stroke="#2347a8" strokeWidth={1} opacity={0.6} />
      {rows.map((r, i) => (
        <circle key={i} cx={X(Math.max(-lim, Math.min(lim, r.invU)))} cy={Y(Math.max(-lim, Math.min(lim, r.invV)))} r={2.6} fill="#b42318" />
      ))}
      <text x={182} y={Y(0) - 2} fontSize={7} fill="#4d5768" textAnchor="end">
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

export function LensLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [s, setS] = useState<LensState>({ kind: 'convex', f: 10, u: 25, h: 2 });
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const set = (p: Partial<LensState>) => setS((x) => ({ ...x, ...p }));
  const r = solveLens(s);
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
  const record = () => {
    const rd = reading(s);
    if (rd && !rows.some((x) => Math.abs(x.u - rd.u) < 0.01 && x.f === rd.f)) setRows((x) => [...x, rd]);
  };

  return (
    <div data-lens-lab>
      <PageHeader
        back={back}
        title="Lens Lab: image formation by a thin lens"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            Physics · Ray optics · Thin lenses <Badge tone="amber">Draft – unverified</Badge>
          </span>
        }
      />

      <StepNav step={step} seen={seen} done={done} go={go} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <Scene s={s} onU={(u) => set({ u })} />
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-3">
              <div className="text-sm">
                <span className="text-ink">Lens</span>
                <div role="group" aria-label="Lens type" className="mt-1 inline-flex w-full gap-0.5 rounded-md bg-ink/5 p-0.5">
                  {(['convex', 'concave'] as LensKind[]).map((k) => (
                    <button key={k} type="button" aria-pressed={s.kind === k} onClick={() => set({ kind: k })} className={`h-8 flex-1 rounded px-2 text-[13px] font-medium capitalize ${s.kind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <Slider id="lens-f" label="Focal length |f|" unit="cm" value={s.f} {...LIMITS.f} onChange={(v) => set({ f: v })} />
              <Slider id="lens-u" label="Object distance |u|" unit="cm" value={s.u} {...LIMITS.u} onChange={(v) => set({ u: v })} />
              <Slider id="lens-h" label="Object height h" unit="cm" value={s.h} {...LIMITS.h} onChange={(v) => set({ h: v })} />
              <div className="flex items-end gap-2 sm:col-span-2">
                <button type="button" className={btn} onClick={() => setS({ kind: 'convex', f: 10, u: 25, h: 2 })}>
                  <RotateCcw aria-hidden className="size-4" /> Reset
                </button>
                <p className="text-xs text-ink-3">Drag the black arrow along the axis, or use the sliders. Blue, amber and green are the three principal rays. Dashed lines are virtual.</p>
              </div>
            </div>
          </div>
          <Readout s={s} />
        </div>

        <div className="min-w-0 space-y-4">
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
              <p className="text-[15px] text-ink">Take a convex lens of any focal length. Move the object slowly from far away towards the lens and watch the image distance and the magnification in the “Measured now” panel.</p>
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
              <p className="text-[15px] text-ink">Put the object at different distances (at least three) and record a reading each time. This is the u–v method used in the practical.</p>
              <button type="button" className={btnMain} onClick={record} disabled={r.v === null}>
                Record reading
              </button>
              {r.v === null && <p className="text-sm text-wrong">The image is at infinity here. Move the object away from the focus.</p>}
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-2">
                        <th className="py-1 pr-2">u (cm)</th>
                        <th className="pr-2">v (cm)</th>
                        <th className="pr-2">1/v − 1/u</th>
                        <th>f = uv/(u − v)</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {rows.map((x, i) => (
                        <tr key={i} className="border-t border-rule">
                          <td className="py-1 pr-2">{n1(x.u)}</td>
                          <td className="pr-2">{n1(x.v)}</td>
                          <td className="pr-2">{n2(x.invV - x.invU)}</td>
                          <td>{n1(x.f)}</td>
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
              {rows.length < 3 ? (
                <p className="text-[15px] text-ink">Record at least three readings in the Measure step first.</p>
              ) : (
                <>
                  <Graph rows={rows} f={signedF(s.kind, s.f)} />
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
                <li>
                  A convex lens gives a real, inverted image when the object is beyond f. The image grows as the object comes closer, and is the same size at 2f.
                </li>
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
        </div>
      </div>
    </div>
  );
}
