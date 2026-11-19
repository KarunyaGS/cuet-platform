import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DisplayMath, Rich } from '../rich';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  APPLY, betweenAreas, convergenceSeries, distinctN, enclosedArea, exactIntegral, fitLogLog, FUNCTIONS, getFn, getPair, intersections, PAIRS, POLY_DEFAULT, PREDICTS, riemann,
  RULE_COLOUR, RULE_LABEL, RULE_NAME, RULES, sameGroup, signedAreas, slopeNote, START, strips, textbookSlope, type Fn, type Mode, type Pair, type Reading, type Rule, type Setup,
} from '../visual/areas';

const BLUE = '#2347a8';
const RED = '#b42318';
const GREEN = '#1d7a4b';
const AMBER = '#a86100';
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 1, strokeLinejoin: 'round' } as const;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const GAP = 0.1;

/** Numbers for display: short, with a real minus sign. */
function num(x: number, d = 4): string {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  const s = Math.abs(x) >= 1e5 || Math.abs(x) < 1e-3 ? x.toExponential(2) : x.toFixed(d);
  return s.replace(/\.?0+$/, (m) => (m.includes('.') ? '' : m)).replace('-', '−');
}
const lab = (v: number) => (Math.abs(v - Math.PI) < 5e-3 ? 'π' : Math.abs(v - 2 * Math.PI) < 5e-3 ? '2π' : Math.abs(v - Math.PI / 2) < 5e-3 ? 'π/2' : Math.abs(v - Math.E) < 5e-3 ? 'e' : String(r2(v)).replace('-', '−'));

function niceStep(span: number): number {
  const raw = span / 6;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
const ticks = (lo: number, hi: number) => {
  const st = niceStep(hi - lo);
  const out: number[] = [];
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(Math.round(v / st) * st);
  return out;
};

/** A curve as an SVG path, broken wherever it is undefined. */
function curvePath(f: (x: number) => number, x0: number, x1: number, X: (v: number) => number, Y: (v: number) => number, N = 240): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    const y = f(x);
    if (!Number.isFinite(y)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${X(x).toFixed(2)} ${Y(clamp(y, -1e6, 1e6)).toFixed(2)} `;
    pen = true;
  }
  return d;
}
/** The points of f over [x0, x1] where it is defined. */
const samples = (f: (x: number) => number, x0: number, x1: number, N = 80) =>
  Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N).map((x) => ({ x, y: f(x) })).filter((p) => Number.isFinite(p.y));

const W = 120;

interface CanvasProps {
  mode: Mode; fn: Fn; pair: Pair; a: number; b: number; n: number; rule: Rule; narrow: boolean;
  onA: (v: number) => void; onB: (v: number) => void;
}

function Canvas({ mode, fn, pair, a, b, n, rule, narrow, onA, onB }: CanvasProps) {
  const H = narrow ? 92 : 68;
  const fs = narrow ? 4.4 : 3.1;
  const L = 10, R = W - 4, T = 5, B = H - 9;
  const lo = mode === 'between' ? pair.lo : fn.lo;
  const hi = mode === 'between' ? pair.hi : fn.hi;
  const pad = (hi - lo) * 0.03;
  const vx0 = lo - pad, vx1 = hi + pad;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<'a' | 'b' | null>(null);
  const live = useRef({ a, b, lo, hi, onA, onB, vx0, vx1 });
  live.current = { a, b, lo, hi, onA, onB, vx0, vx1 };
  const X = (v: number) => L + ((v - vx0) / (vx1 - vx0)) * (R - L);

  // vertical range from the curves themselves
  const curves = mode === 'between' ? [pair.upper.f, pair.lower.f] : [fn.f];
  const { ymin, ymax } = useMemo(() => {
    let mn = 0, mx = 0;
    for (const f of curves) for (const p of samples(f, vx0, vx1, 200)) { mn = Math.min(mn, p.y); mx = Math.max(mx, p.y); }
    if (mx - mn < 1e-9) mx = mn + 1;
    const padY = (mx - mn) * 0.1;
    return { ymin: mn < 0 ? mn - padY : 0, ymax: mx + padY };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fn, pair, vx0, vx1]);
  const Y = (v: number) => B - ((v - ymin) / (ymax - ymin)) * (B - T);
  const y0 = Y(0);

  useEffect(() => {
    const toX = (e: PointerEvent): number | null => {
      const el = svg.current;
      const m = el?.getScreenCTM();
      if (!el || !m) return null;
      const pt = el.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());
      const s = live.current;
      return s.vx0 + ((p.x - L) / (R - L)) * (s.vx1 - s.vx0);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const x = toX(e);
      if (x === null) return;
      const s = live.current;
      if (d === 'a') s.onA(r2(clamp(x, s.lo, s.b - GAP)));
      else s.onB(r2(clamp(x, s.a + GAP, s.hi)));
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [L, R]);

  const fill = (pts: { x: number; y: number }[], c: string, key: string) =>
    pts.length > 1 ? <polygon key={key} points={pts.map((p) => `${X(p.x).toFixed(2)},${clamp(Y(p.y), T, B).toFixed(2)}`).join(' ')} fill={c} opacity={0.3} /> : null;

  // shading for each mode
  const shade: React.ReactNode[] = [];
  if (mode === 'riemann') {
    const ss = strips(fn.f, a, b, n, rule);
    const outline = n <= 60;
    ss.forEach((s, i) => {
      const yy = (s.y0 + s.y1) / 2;
      const c = yy >= 0 ? BLUE : RED;
      const common = { fill: c, fillOpacity: 0.28, stroke: outline ? c : 'none', strokeWidth: 0.25 };
      if (rule === 'trap') shade.push(<polygon key={i} points={`${X(s.x0)},${y0} ${X(s.x0)},${clamp(Y(s.y0), T, B)} ${X(s.x1)},${clamp(Y(s.y1), T, B)} ${X(s.x1)},${y0}`} {...common} />);
      else {
        const top = clamp(Y(Math.max(0, s.y0)), T, B), bot = clamp(Y(Math.min(0, s.y0)), T, B);
        shade.push(<rect key={i} x={X(s.x0)} y={top} width={Math.max(0.05, X(s.x1) - X(s.x0))} height={Math.max(0, bot - top)} {...common} />);
      }
    });
  } else if (mode === 'signed') {
    for (const [i, p] of signedAreas(fn, a, b).pieces.entries()) {
      const pts = samples(fn.f, p.x0, p.x1, 60);
      shade.push(fill([{ x: p.x0, y: 0 }, ...pts, { x: p.x1, y: 0 }], p.value >= 0 ? BLUE : RED, `s${i}`));
    }
  } else {
    for (const [i, p] of betweenAreas(pair, a, b).pieces.entries()) {
      const up = samples(pair.upper.f, p.x0, p.x1, 60), dn = samples(pair.lower.f, p.x0, p.x1, 60).reverse();
      shade.push(fill([...up, ...dn], p.value >= 0 ? GREEN : AMBER, `b${i}`));
    }
  }

  const roots = mode === 'between' ? intersections(pair) : [];
  const hx = (which: 'a' | 'b', v: number) => {
    const key = (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.5 : 0.1;
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
      if (!d) return;
      e.preventDefault();
      if (which === 'a') onA(r2(clamp(a + d, lo, b - GAP)));
      else onB(r2(clamp(b + d, a + GAP, hi)));
    };
    const name = which === 'a' ? 'lower limit a' : 'upper limit b';
    return (
      <g
        key={which} tabIndex={0} role="slider" data-handle={which} aria-label={`Interval handle, ${name}`} aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={v} aria-valuetext={`${name} equals ${lab(v)}`}
        style={{ cursor: 'ew-resize', outline: 'none' }} onKeyDown={key}
        onPointerDown={(e) => { e.stopPropagation(); drag.current = which; }}
      >
        <line x1={X(v)} y1={T} x2={X(v)} y2={B} stroke="#1a2233" strokeWidth={0.35} strokeDasharray="1.4 1" />
        <circle cx={X(v)} cy={y0} r={narrow ? 8 : 6} fill="transparent" />
        <circle cx={X(v)} cy={y0} r={2.2} fill="#1a2233" stroke="#fff" strokeWidth={0.5} className="area-handle" />
        <text x={X(v)} y={B + fs * 2.3} fontSize={fs} fontWeight="bold" textAnchor="middle" fill="#1a2233">{which} = {lab(v)}</text>
      </g>
    );
  };

  return (
    <svg
      ref={svg} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none bg-surface" role="group" data-area-canvas
      aria-label={`Graph. ${mode === 'between' ? `${pair.upper.name} and ${pair.lower.name}` : `y = ${fn.label}`}, from ${lab(a)} to ${lab(b)}. Drag the two handles, or focus one and use the arrow keys.`}
    >
      <defs><clipPath id="area-clip"><rect x={L} y={T} width={R - L} height={B - T} /></clipPath></defs>
      <rect x={L} y={T} width={R - L} height={B - T} fill="#fff" stroke="#e5e5e5" strokeWidth={0.3} />
      {ticks(vx0, vx1).map((t) => (
        <g key={`x${t}`}><line x1={X(t)} y1={T} x2={X(t)} y2={B} stroke="#eef0f3" strokeWidth={0.25} /><text x={X(t)} y={B + fs * 1.05} fontSize={fs * 0.85} textAnchor="middle" fill="#7c8595">{String(r2(t)).replace('-', '−')}</text></g>
      ))}
      {ticks(ymin, ymax).map((t) => (
        <g key={`y${t}`}><line x1={L} y1={Y(t)} x2={R} y2={Y(t)} stroke="#eef0f3" strokeWidth={0.25} /><text x={L - 1} y={Y(t) + fs * 0.3} fontSize={fs * 0.85} textAnchor="end" fill="#7c8595">{String(r2(t)).replace('-', '−')}</text></g>
      ))}
      <g clipPath="url(#area-clip)">
        <line x1={L} y1={y0} x2={R} y2={y0} stroke="#4d5768" strokeWidth={0.5} />
        {shade}
        {mode === 'between' ? (
          <>
            <path d={curvePath(pair.upper.f, vx0, vx1, X, Y)} fill="none" stroke={GREEN} strokeWidth={0.8} />
            <path d={curvePath(pair.lower.f, vx0, vx1, X, Y)} fill="none" stroke={AMBER} strokeWidth={0.8} />
          </>
        ) : (
          <path d={curvePath(fn.f, vx0, vx1, X, Y)} fill="none" stroke="#1a2233" strokeWidth={0.8} />
        )}
      </g>
      {roots.map((r) => {
        const y = pair.upper.f(r);
        return (
          <g key={`r${r}`} data-root={r.toFixed(3)}>
            <circle cx={X(r)} cy={Y(y)} r={1.5} fill="#fff" stroke="#1a2233" strokeWidth={0.5} />
            <text x={X(r)} y={Y(y) - 2.4} fontSize={fs * 0.9} textAnchor="middle" fill="#1a2233" {...halo}>({lab(r)}, {lab(y)})</text>
          </g>
        );
      })}
      {mode === 'between' && (
        <g fontSize={fs * 0.95} fontWeight="bold">
          <text x={R - 1} y={T + fs * 1.2} textAnchor="end" fill={GREEN} {...halo}>{pair.upper.name}</text>
          <text x={R - 1} y={T + fs * 2.5} textAnchor="end" fill={AMBER} {...halo}>{pair.lower.name}</text>
        </g>
      )}
      {mode !== 'between' && <text x={R - 1} y={T + fs * 1.2} textAnchor="end" fontSize={fs * 0.95} fontWeight="bold" fill="#1a2233" {...halo}>y = {fn.label}</text>}
      {hx('a', a)}
      {hx('b', b)}
    </svg>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className={`${panel} p-3`}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
      <p className="text-xs text-ink-3">{note}</p>
    </div>
  );
}

/** Sum against n for the four rules, with the exact value as a horizontal line. */
function SumGraph({ fn, a, b, n }: { fn: Fn; a: number; b: number; n: number }) {
  const exact = exactIntegral(fn, a, b);
  const data = useMemo(() => RULES.map((r) => ({ r, s: convergenceSeries(fn.f, a, b, r, 200) })), [fn, a, b]);
  const span = Math.max(Math.abs(exact) * 0.5, 0.5);
  const lo = exact - span, hi = exact + span;
  const X = (v: number) => 34 + ((v - 1) / 199) * 330;
  const Y = (v: number) => 122 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * 104;
  return (
    <svg viewBox="0 0 400 150" className="w-full max-w-lg" role="img" aria-label="Riemann sum against the number of strips for the four rules, settling on the exact value." data-sum-graph>
      <rect x={34} y={18} width={330} height={104} fill="#fff" stroke="#e5e5e5" />
      {data.map(({ r, s }) => <polyline key={r} points={s.map((p) => `${X(p.n).toFixed(1)},${Y(p.sum).toFixed(1)}`).join(' ')} fill="none" stroke={RULE_COLOUR[r]} strokeWidth={1.3} />)}
      <line x1={34} x2={364} y1={Y(exact)} y2={Y(exact)} stroke="#1a2233" strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={362} y={Y(exact) - 3} fontSize={9} textAnchor="end" fill="#1a2233" {...halo} strokeWidth={2}>exact = {num(exact)}</text>
      <line x1={X(n)} x2={X(n)} y1={18} y2={122} stroke="#7c8595" strokeWidth={0.8} strokeDasharray="2 3" />
      {[1, 50, 100, 150, 200].map((t) => <text key={t} x={X(t)} y={134} fontSize={9} textAnchor="middle" fill="#4d5768">{t}</text>)}
      <text x={364} y={146} fontSize={9} textAnchor="end" fill="#4d5768">number of strips n</text>
      <text x={34} y={12} fontSize={9} fill="#4d5768">sum (the vertical axis is cut off at ±50% of the exact value)</text>
    </svg>
  );
}

/** |error| against n on log-log axes for the four rules. */
function ErrGraph({ fn, a, b, n, rule }: { fn: Fn; a: number; b: number; n: number; rule: Rule }) {
  const exact = exactIntegral(fn, a, b);
  const ns = useMemo(() => Array.from({ length: 40 }, (_, i) => Math.round(Math.pow(200, i / 39))).filter((v, i, arr) => arr.indexOf(v) === i), []);
  const data = useMemo(() => RULES.map((r) => ({ r, pts: ns.map((k) => ({ n: k, e: Math.abs(riemann(fn.f, a, b, k, r) - exact) })).filter((p) => p.e > 1e-12) })), [fn, a, b, ns, exact]);
  const all = data.flatMap((d) => d.pts.map((p) => p.e));
  if (all.length < 2) return <p className="text-sm text-ink-2">Every rule is exact here, so there is no error to plot.</p>;
  const eLo = Math.log10(Math.min(...all)) - 0.2, eHi = Math.log10(Math.max(...all)) + 0.2;
  const X = (v: number) => 34 + (Math.log10(v) / Math.log10(200)) * 330;
  const Y = (e: number) => 122 - ((Math.log10(e) - eLo) / (eHi - eLo)) * 104;
  const cur = Math.abs(riemann(fn.f, a, b, n, rule) - exact);
  return (
    <svg viewBox="0 0 400 150" className="w-full max-w-lg" role="img" aria-label="Error against the number of strips on log-log axes. Left and right fall with slope minus one, midpoint and trapezoid with slope minus two." data-err-graph>
      <rect x={34} y={18} width={330} height={104} fill="#fff" stroke="#e5e5e5" />
      {data.map(({ r, pts }) => pts.length > 1 && <polyline key={r} points={pts.map((p) => `${X(p.n).toFixed(1)},${Y(p.e).toFixed(1)}`).join(' ')} fill="none" stroke={RULE_COLOUR[r]} strokeWidth={1.3} />)}
      {cur > 1e-12 && <circle cx={X(n)} cy={Y(cur)} r={3.6} fill={RULE_COLOUR[rule]} stroke="#fff" strokeWidth={1} />}
      {[1, 10, 100, 200].map((t) => <text key={t} x={X(t)} y={134} fontSize={9} textAnchor="middle" fill="#4d5768">{t}</text>)}
      <text x={364} y={146} fontSize={9} textAnchor="end" fill="#4d5768">n (log scale)</text>
      <text x={34} y={12} fontSize={9} fill="#4d5768">|error| (log scale): {num(Math.pow(10, eHi - 0.2), 3)} at the top, {num(Math.pow(10, eLo + 0.2), 3)} at the bottom</text>
    </svg>
  );
}

function Legend() {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {RULES.map((r) => <span key={r} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5" style={{ background: RULE_COLOUR[r] }} />{RULE_LABEL[r]}</span>)}
    </p>
  );
}

/** Student's own readings: log error against log n with the fitted line. */
function FitGraph({ rows, fn, a, b }: { rows: Reading[]; fn: Fn; a: number; b: number }) {
  const pts = rows.map((r) => ({ n: r.n, err: r.sum - r.exact }));
  const fit = fitLogLog(pts);
  const rule = rows[0]!.rule;
  const note = slopeNote(fn, a, b, rule);
  if (!fit) return <p className="text-[15px] text-ink">{note ?? 'These readings have zero error, so there is no log-log slope to fit.'}</p>;
  const ok = pts.filter((p) => Math.abs(p.err) > 1e-12);
  const xs = ok.map((p) => Math.log10(p.n)), ys = ok.map((p) => Math.log10(Math.abs(p.err)));
  const x0 = Math.min(...xs) - 0.1, x1 = Math.max(...xs) + 0.1;
  const y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
  const X = (v: number) => 40 + ((v - x0) / (x1 - x0)) * 320;
  const Y = (v: number) => 122 - ((v - y0) / (y1 - y0)) * 100;
  const line = (lx: number) => (fit.intercept + fit.slope * Math.log(10 ** lx)) / Math.LN10;
  const tb = textbookSlope(rule);
  return (
    <div data-fit>
      <svg viewBox="0 0 400 150" className="w-full max-w-md" role="img" aria-label="Log of the error against log of n for your readings, with the best straight line.">
        <rect x={40} y={22} width={320} height={100} fill="#fff" stroke="#e5e5e5" />
        <line x1={X(x0)} y1={Y(line(x0))} x2={X(x1)} y2={Y(line(x1))} stroke={BLUE} strokeWidth={1.2} opacity={0.7} />
        {ok.map((p, i) => <circle key={i} cx={X(xs[i]!)} cy={Y(ys[i]!)} r={3.6} fill={RED} />)}
        {ok.map((p, i) => <text key={`t${i}`} x={X(xs[i]!)} y={134} fontSize={9} textAnchor="middle" fill="#4d5768">{p.n}</text>)}
        <text x={360} y={146} fontSize={9} textAnchor="end" fill="#4d5768">n (log scale)</text>
        <text x={42} y={16} fontSize={9} fill="#4d5768">|error| (log scale). Line: slope {fit.slope.toFixed(2)}</text>
      </svg>
      <p className="text-[15px] text-ink">
        The dots lie close to a straight line on the log-log graph, so the error behaves like a power of n. Its fitted slope is <strong className="num" data-slope>{fit.slope.toFixed(2).replace('-', '−')}</strong>; the textbook value for the {RULE_NAME[rule]} rule is <span className="num">{tb < 0 ? '−' : ''}{Math.abs(tb)}</span>.
      </p>
      {note && <p className="mt-1 text-sm text-ink-2">{note}</p>}
    </div>
  );
}

export function AreaLabPage() {
  const { lessonId, back } = useLabOrigin();
  const [params] = useSearchParams();
  const narrow = useNarrow();
  const first = params.get('mode');
  const [mode, setMode] = useState<Mode>(first === 'between' || first === 'signed' ? first : 'riemann');
  const [fnId, setFnId] = useState('x2');
  const [coeffs, setCoeffs] = useState<number[]>(POLY_DEFAULT);
  const [pairId, setPairId] = useState('par-line');
  const [fnIv, setFnIv] = useState<{ a: number; b: number }>({ a: START.a, b: START.b });
  const snap = (p: Pair) => { const r = intersections(p); return { a: r[0]!, b: r[r.length - 1]! }; };
  const [pairIv, setPairIv] = useState(() => snap(getPair('par-line')));
  const [n, setN] = useState(8);
  const [rule, setRule] = useState<Rule>('left');
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});

  useScrollTopOnOpen();

  const fn = useMemo(() => getFn(fnId, coeffs), [fnId, coeffs]);
  const pair = getPair(pairId);
  const iv = mode === 'between' ? pairIv : fnIv;
  const { a, b } = iv;
  const setA = (v: number) => (mode === 'between' ? setPairIv((x) => ({ ...x, a: v })) : setFnIv((x) => ({ ...x, a: v })));
  const setB = (v: number) => (mode === 'between' ? setPairIv((x) => ({ ...x, b: v })) : setFnIv((x) => ({ ...x, b: v })));
  const lo = mode === 'between' ? pair.lo : fn.lo;
  const hi = mode === 'between' ? pair.hi : fn.hi;

  const chooseFn = (f: Fn) => { setFnId(f.id); setFnIv({ a: f.a0, b: f.b0 }); };
  const choosePair = (p: Pair) => { setPairId(p.id); setPairIv(snap(p)); };
  const apply = (s: Setup) => {
    setMode(s.mode); setN(s.n); setRule(s.rule);
    if (s.mode === 'between') { setPairId(s.pair); setPairIv({ a: s.a, b: s.b }); }
    else { setFnId(s.fn); setFnIv({ a: s.a, b: s.b }); }
  };
  const reset = () => { setMode('riemann'); setFnId('x2'); setCoeffs(POLY_DEFAULT); setFnIv({ a: START.a, b: START.b }); setPairId('par-line'); setPairIv(snap(getPair('par-line'))); setN(START.n); setRule(START.rule); };

  // numbers shown
  const exact = exactIntegral(fn, a, b);
  const sum = riemann(fn.f, a, b, n, rule);
  const err = sum - exact;
  const sa = useMemo(() => (mode === 'signed' ? signedAreas(fn, a, b) : null), [mode, fn, a, b]);
  const ba = useMemo(() => (mode === 'between' ? betweenAreas(pair, a, b) : null), [mode, pair, a, b]);
  const roots = useMemo(() => intersections(pair), [pair]);
  const encl = useMemo(() => enclosedArea(pair), [pair]);

  const group = sameGroup(rows);
  const nDistinct = distinctN(rows);
  const canFit = nDistinct >= 3;
  const finished = Object.keys(ans).length === APPLY.length;
  const predDone = Object.keys(tested).length === PREDICTS.length;
  const pending = [
    ...(!predDone ? ['test all four predictions'] : []),
    ...(!canFit ? ['record at least three readings with different numbers of strips n, for the same function, interval and rule, in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, predDone, predDone, rows.length >= 3, canFit, true, finished];

  const choosePredict = (i: number) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setPi(i); apply(p.base); };
  const record = () => {
    if (mode !== 'riemann') return;
    const key = fn.id === 'poly' ? `poly:${coeffs.join(',')}` : fn.id;
    if (rows.some((r) => r.key === key && r.a === a && r.b === b && r.rule === rule && r.n === n)) return;
    setRows((x) => [...x, { key, fnLabel: fn.id === 'poly' ? fn.tex.replace('f(x)=', '') : fn.label, a, b, rule, n, sum, exact }]);
  };

  const modeBtn = (m: Mode, label: string) => (
    <button key={m} type="button" aria-pressed={mode === m} data-mode={m} onClick={() => setMode(m)} className={`h-9 rounded-md px-3 text-sm font-medium ring-1 ring-inset ${mode === m ? 'bg-accent text-white ring-accent' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper'}`}>{label}</button>
  );
  const chip = (on: boolean) => `h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${on ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper'}`;
  const gl = group.length ? group[0]! : null;

  return (
    <div data-area-lab>
      <PageHeader
        back={back}
        title="Area Under a Curve Lab: sums, integrals and area between curves"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Mathematics · Integrals and their applications <Badge tone="amber">Draft – unverified</Badge></span>}
      />
      <StepNav step={step} seen={seen} done={done} go={go} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2" role="group" aria-label="What to explore">
              {modeBtn('riemann', 'Riemann sums')}
              {modeBtn('between', 'Area between curves')}
              {modeBtn('signed', 'Signed area')}
            </div>
            <Canvas mode={mode} fn={fn} pair={pair} a={a} b={b} n={n} rule={rule} narrow={narrow} onA={setA} onB={setB} />
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2">
              {mode !== 'between' ? (
                <div className="sm:col-span-2" role="group" aria-label="Choose a function">
                  <div className="flex flex-wrap gap-1.5">
                    {FUNCTIONS.map((f) => <button key={f.id} type="button" aria-pressed={fnId === f.id} data-fn={f.id} onClick={() => chooseFn(f)} className={chip(fnId === f.id)}>{f.id === 'poly' ? 'custom' : f.label}</button>)}
                  </div>
                  {fnId === 'poly' && (
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2" data-poly>
                      {['c₀ (constant)', 'c₁ (x)', 'c₂ (x²)', 'c₃ (x³)'].map((l, i) => (
                        <Slider key={l} id={`ar-c${i}`} label={l} unit="" value={coeffs[i] ?? 0} min={-3} max={3} step={0.5} onChange={(v) => setCoeffs((c) => c.map((x, j) => (j === i ? v : x)))} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sm:col-span-2" role="group" aria-label="Choose a pair of curves">
                  <div className="flex flex-wrap gap-1.5">
                    {PAIRS.map((p) => <button key={p.id} type="button" aria-pressed={pairId === p.id} data-pair={p.id} onClick={() => choosePair(p)} className={chip(pairId === p.id)}>{p.eq.split(' (')[0]!.replace(' and ', ', ')}</button>)}
                  </div>
                </div>
              )}
              <Slider id="ar-a" label="Lower limit a" unit="" value={a} min={lo} max={r2(b - GAP)} step={0.01} shown={lab(a)} onChange={(v) => setA(clamp(v, lo, b - GAP))} />
              <Slider id="ar-b" label="Upper limit b" unit="" value={b} min={r2(a + GAP)} max={hi} step={0.01} shown={lab(b)} onChange={(v) => setB(clamp(v, a + GAP, hi))} />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="group" aria-label="Interval choices">
                <span className="text-sm text-ink-2">Interval:</span>
                {mode === 'between'
                  ? <button type="button" className={btn} onClick={() => setPairIv(snap(pair))} data-snap>Snap to the intersections</button>
                  : fn.presets.map((p) => <button key={p.label} type="button" className={btn} onClick={() => setFnIv({ a: p.a, b: p.b })} data-preset={p.label}>{p.label}</button>)}
                <button type="button" className={btn} onClick={reset}><RotateCcw aria-hidden className="size-4" />Reset</button>
              </div>
              {mode === 'riemann' && (
                <>
                  <div className="sm:col-span-2"><Slider id="ar-n" label="Number of strips n" unit="" value={n} min={1} max={200} step={1} onChange={setN} /></div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2" role="group" aria-label="Sum rule">
                    {RULES.map((r) => <button key={r} type="button" aria-pressed={rule === r} data-rule={r} onClick={() => setRule(r)} className={chip(rule === r)}>{RULE_LABEL[r]}</button>)}
                  </div>
                </>
              )}
              <p className="text-xs text-ink-3 sm:col-span-2">Drag the two round handles on the x-axis (or focus one and use the arrow keys; Shift moves further), or use the sliders. Blue is area above the axis, red is below it. x and y are in plain units.</p>
            </div>
          </div>

          <div className={`${panel} p-3`} aria-live="polite" data-readout>
            <h3 className="text-sm font-semibold text-ink">Measured now</h3>
            {mode === 'riemann' && (
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                {([
                  ['Rule', RULE_LABEL[rule]], ['Strips n, width h', `${n}, ${num((b - a) / n)}`], ['Riemann sum', num(sum)], ['Exact integral F(b) − F(a)', num(exact)],
                  ['Error (sum − exact)', num(err)], ['Relative error', Math.abs(exact) < 1e-12 ? '—' : `${num((Math.abs(err) / Math.abs(exact)) * 100, 3)} %`],
                  ['Sum is', Math.abs(err) < 1e-9 ? 'exact' : err > 0 ? 'too large' : 'too small'],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
            )}
            {mode === 'signed' && sa && (
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                {([
                  ['Integral of f (signed)', num(sa.signed)], ['Area above the axis', num(sa.above)], ['Area below the axis', num(sa.below)], ['Total area, integral of |f|', num(sa.total)],
                  ['f crosses zero at', sa.roots.length ? sa.roots.map(lab).join(', ') : 'nowhere inside'],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
            )}
            {mode === 'between' && ba && (
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                {([
                  ['The curves meet at x =', roots.map(lab).join(' and ')], ['Region between the meeting points', `from ${lab(encl.x0)} to ${lab(encl.x1)}`],
                  ['Integral of (upper − lower) over [a, b]', num(ba.signed)], ['Area between the curves over [a, b]', num(ba.total)], ['Area of the enclosed region', num(encl.area)],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
            )}
            {mode !== 'between' && <div className="mt-2 text-sm text-ink"><DisplayMath tex={`${fn.tex}\\qquad ${fn.id === 'poly' ? '' : fn.texF}`} /></div>}
            {mode === 'between' && <p className="mt-2 text-sm text-ink-2">{pair.eq}. The shaded region is the integral of (upper − lower), where the green curve is the upper one. Any part where the curves swap places is shaded amber and counts as area, but its integral is negative.</p>}
            {mode === 'signed' && sa && Math.abs(sa.signed) < 1e-9 && sa.total > 1e-6 && <p className="mt-2 rounded-md bg-ink/5 p-2 text-sm" data-cancel>The integral is 0 but the total area is {num(sa.total)}: the part above the axis cancels the part below it.</p>}
          </div>

          {mode === 'riemann' && (
            <>
              <Panel title="The sum settles on the exact value as n grows" note="Each line is one rule, from n = 1 to n = 200. The dashed line is the exact integral from the antiderivative; the dotted line marks your n.">
                <SumGraph fn={fn} a={a} b={b} n={n} />
                <Legend />
              </Panel>
              <Panel title="The error shrinks as n grows" note="Log-log axes. Left and right sums fall along a line of slope −1, midpoint and trapezoid along a line of slope −2 (twice as steep) for smooth functions. The dot is your current n.">
                <ErrGraph fn={fn} a={a} b={b} n={n} rule={rule} />
                <Legend />
              </Panel>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <Rich text="The definite integral $\int_a^b f(x)\,dx$ is the limit of a sum of thin strips. The fundamental theorem says it equals $F(b)-F(a)$, where $F'=f$. Play with it for a minute." />
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Drag the slider for n from 1 up to 200. Watch the rectangles fill the area and the sum approach the exact value.</li>
                <li>Switch between the four rules. Which ones sit below the curve, and which above?</li>
                <li>Open “Area between curves” and “Signed area” and move the two handles.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choosePredict} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; apply(p.test); setTested((x) => ({ ...x, [p.id]: true })); }}
              explain={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; return p.why(p.test); }}
              onNext={() => choosePredict(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Pick 1/x on [1, 3] and then eˣ. Which rule is closest at n = 10 each time?</li>
                <li>Try the straight line 2x + 1 with the midpoint and trapezoid rules. What is the error?</li>
                <li>Choose sin x on [0, 2π] in “Signed area”. Why is the integral 0 when the total area is 4?</li>
                <li>In “Area between curves”, move a handle outside the intersections. Does the shaded region keep the right area?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Stay on “Riemann sums” with one function, one interval and one rule. Record the sum for n = 4, 8, 16 and 32 (at least three different n).</p>
              {mode !== 'riemann' && <button type="button" className={btn} onClick={() => setMode('riemann')}>Switch to Riemann sums</button>}
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Set n">
                <span className="text-sm text-ink-2">Set n:</span>
                {[4, 8, 16, 32].map((k) => <button key={k} type="button" className={chip(n === k)} onClick={() => setN(k)} data-n={k}>{k}</button>)}
              </div>
              <p className="text-sm text-ink-2">Now: {fn.id === 'poly' ? 'custom polynomial' : fn.label} on [{lab(a)}, {lab(b)}], {RULE_NAME[rule]} rule, n = {n}.</p>
              <button type="button" className={btnMain} onClick={record} disabled={mode !== 'riemann'} data-record>Record reading</button>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">f</th><th className="pr-2">[a, b]</th><th className="pr-2">rule</th><th className="pr-2">n</th><th className="pr-2">sum</th><th>error</th></tr></thead>
                    <tbody className="num">{rows.map((x, i) => <tr key={i} className="border-t border-rule"><td className="py-1 pr-2">{x.fnLabel}</td><td className="pr-2">[{lab(x.a)}, {lab(x.b)}]</td><td className="pr-2">{RULE_LABEL[x.rule].split(' ')[0]}</td><td className="pr-2">{x.n}</td><td className="pr-2">{num(x.sum, 5)}</td><td>{num(x.sum - x.exact, 5)}</td></tr>)}</tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>Clear table</button>
                </div>
              )}
              {nDistinct >= 3 && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my readings</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canFit && gl ? (
                <>
                  <p className="text-[15px] text-ink">Error = sum − exact, for your {group.length} readings of {gl.fnLabel} on [{lab(gl.a)}, {lab(gl.b)}] with the {RULE_NAME[gl.rule]} rule.</p>
                  <FitGraph rows={group} fn={getFn(gl.key.startsWith('poly') ? 'poly' : gl.key, gl.key.startsWith('poly') ? gl.key.slice(5).split(',').map(Number) : undefined)} a={gl.a} b={gl.b} />
                </>
              ) : (
                <p className="text-[15px] text-ink">Record at least three readings with different n, for the same function, interval and rule, in the Measure step first.</p>
              )}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li><Rich inline text="The definite integral is the limit of the sums $\sum f(x_i)\,\Delta x$ as the strips get thinner: $\int_a^b f(x)\,dx=\lim_{n\to\infty}\sum f(x_i)\,\Delta x$." /></li>
                <li><Rich inline text="The fundamental theorem gives the exact value without any limit: $\int_a^b f(x)\,dx=F(b)-F(a)$. The graph of the sums settled on exactly this number." /></li>
                <li>The left and right sums are off by roughly one strip, so their error is about proportional to 1/n (slope −1). The midpoint and trapezoid rules cancel most of that, so their error is about proportional to 1/n² (slope −2): doubling n divides it by 4.</li>
                <li>On an increasing function the left sum is too small and the right sum too large; on a decreasing function it is the other way round.</li>
                <li><Rich inline text="Area between curves: find where they meet, then integrate (upper − lower): $\int_a^b [f(x)-g(x)]\,dx$. Area is never negative; if the curves swap places, split the interval at the crossing." /></li>
                <li><Rich inline text="Signed area: area below the axis counts negative in $\int f$. Total area is $\int |f|$: split at the zeros of $f$ and add the absolute values. For an odd function on $[-c,c]$ the integral is 0; for an even function it is $2\int_0^c f$." /></li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>Try CUET-style questions</button>
            </section>
          )}
          {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
        </div>
      </div>
    </div>
  );
}
