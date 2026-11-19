import { Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  APPLY, canFit as canFitRows, conc, electrolysis, electrolyte, ELECTROLYTES, ELEC_LIMITS, electronsFromSlope, electronsLeaveFrom, fmtC, galvanic, HALVES, half, O2, P_MAX, P_MIN, P_STEP, pairKey,
  PREDICTS, readingOf, recover, saltBridge, SLOPE, slopeThroughOrigin, START, fitSet, R_INT, R_LOAD, type CellInput, type CellResult, type ElecInput, type Reading, type Setup,
} from '../visual/galvanic';

const FLOW = '#2347a8';
const CATION = '#b42318';
const WIRE = '#566074';
const HILITE = '#1d7a4b';
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 0.9, strokeLinejoin: 'round' } as const;
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const sgn = (x: number, d = 3) => (Math.abs(x) < 0.5 * 10 ** -d ? (0).toFixed(d) : x.toFixed(d).replace('-', '−'));

type Pt = [number, number];
function polyLen(pts: Pt[]) { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]); return L; }
function along(pts: Pt[], s: number): Pt {
  let rest = s;
  for (let k = 1; k < pts.length; k++) {
    const l = Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]);
    if (rest <= l) { const t = l === 0 ? 0 : rest / l; return [pts[k - 1]![0] + (pts[k]![0] - pts[k - 1]![0]) * t, pts[k - 1]![1] + (pts[k]![1] - pts[k - 1]![1]) * t]; }
    rest -= l;
  }
  return pts[pts.length - 1]!;
}
const d = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');

/** A distance that grows with time at the given speed (units per second): drives every moving dot. Static if the student prefers reduced motion. */
function useFlow(speed: number) {
  const phase = useRef(0);
  const sp = useRef(speed);
  sp.current = speed;
  const [, tick] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      phase.current += sp.current * dt;
      acc += dt;
      if (acc > 0.033) { acc = 0; tick((n) => (n + 1) % 1000000); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return phase.current;
}

function Dots({ pts, off, n, color, r = 1.1, sign, reverse }: { pts: Pt[]; off: number; n: number; color: string; r?: number; sign?: string; reverse?: boolean }) {
  const L = polyLen(pts);
  return (
    <g>
      {Array.from({ length: n }, (_, j) => {
        const raw = off + (j * L) / n;
        const t = (((reverse ? L - (raw % L) : raw) % L) + L) % L;
        const [x, y] = along(pts, t);
        return (
          <g key={j}>
            <circle cx={x} cy={y} r={r} fill={color} />
            {sign && <text x={x} y={y + 0.9} fontSize={2.2} textAnchor="middle" fill="#fff" fontWeight={700}>{sign}</text>}
          </g>
        );
      })}
    </g>
  );
}

const T = ({ x, y, fs, children, anchor = 'middle', fill = '#1a2233', bold }: { x: number; y: number; fs: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; fill?: string; bold?: boolean }) => (
  <text x={x} y={y} fontSize={fs} textAnchor={anchor} fill={fill} fontWeight={bold ? 700 : 400} {...halo}>{children}</text>
);

// ---------------------------------------------------------------------------------------------- the galvanic cell picture
const LX = 18, RX = 102;

function CellScene({ input, res, reveal, closed, fs }: { input: CellInput; res: CellResult; reveal: boolean; closed: boolean; fs: number }) {
  const speed = closed && res.I > 1e-4 ? Math.min(40, 5 + 60 * res.I) : 0;
  const off = useFlow(speed);
  const L = half(input.left), R = half(input.right);
  const aX = res.anodeSideNow === 'left' ? LX : RX;
  const cX = res.anodeSideNow === 'left' ? RX : LX;
  const wire: Pt[] = [[aX, 22], [aX, 14], [cX, 14], [cX, 22]];
  const sb = saltBridge(res);
  // anions travel to the anode compartment, cations to the cathode compartment
  const toLeft: Pt[] = [[37, 50], [37, 29], [83, 29], [83, 50]];
  const anionPath = sb.anionsToward === 'left' ? [...toLeft].reverse() : toLeft;
  const toRightC: Pt[] = [[39, 50], [39, 31], [81, 31], [81, 50]];
  const cationPath = sb.cationsToward === 'left' ? [...toRightC].reverse() : toRightC;
  const side = (h: typeof L, x: number, p: number, which: 'left' | 'right') => {
    const isAnode = res.anodeSideNow === which;
    const sign = isAnode ? '−' : '+';
    return (
      <g key={which}>
        <rect x={x - 19} y={40} width={38} height={30} fill={h.liquid} opacity={0.55 + 0.3 * ((p - P_MIN) / (P_MAX - P_MIN))} />
        <path d={`M ${x - 19} 30 V 70 H ${x + 19} V 30`} fill="none" stroke="#7c8595" strokeWidth={0.7} />
        <rect x={x - 2} y={20} width={4} height={44} fill={h.rod} stroke="#4d5768" strokeWidth={0.4} />
        {h.gas && Array.from({ length: 4 }, (_, k) => <circle key={k} cx={x + 3.5 + (k % 2) * 2} cy={60 - ((off * 0.5 + k * 6) % 20)} r={0.8} fill="#fff" stroke="#7c8595" strokeWidth={0.3} />)}
        {reveal && <T x={x + (which === 'left' ? -7 : 7)} y={19} fs={fs * 1.1} bold fill={isAnode ? '#b42318' : '#1d7a4b'}>{isAnode ? '−' : '+'}</T>}
        <T x={which === 'left' ? 2 : 118} anchor={which === 'left' ? 'start' : 'end'} y={77} fs={fs} bold fill={reveal ? (isAnode ? '#b42318' : '#1d7a4b') : '#4d5768'}>{reveal ? (isAnode ? 'Anode (oxidation)' : 'Cathode (reduction)') : 'anode or cathode?'}</T>
        <T x={which === 'left' ? 2 : 118} anchor={which === 'left' ? 'start' : 'end'} y={77 + fs * 1.25} fs={fs * 0.95}>{h.gas ? 'Pt | H₂ (1 bar)' : h.el} · {h.ion} {fmtC(conc(p))} M</T>
        {reveal && <title>{`${isAnode ? 'Anode' : 'Cathode'}, ${sign}`}</title>}
      </g>
    );
  };
  return (
    <svg viewBox="0 -7 120 92" className="block w-full select-none bg-surface" role="img" data-cell-scene aria-label={`Galvanic cell: ${L.el} half-cell on the left, ${R.el} half-cell on the right, joined by a salt bridge, a lamp and a voltmeter`}>
      {side(L, LX + 1, input.pLeft, 'left')}
      {side(R, RX - 1, input.pRight, 'right')}
      {/* salt bridge */}
      <path d="M 38 52 V 30 H 82 V 52" fill="none" stroke="#c4ccd6" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 38 52 V 30 H 82 V 52" fill="none" stroke="#f3f5f8" strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" />
      <T x={60} y={26.5} fs={fs * 0.9} fill="#4d5768">salt bridge (KNO₃)</T>
      {reveal && speed > 0 && (
        <g data-salt-ions data-anions-toward={sb.anionsToward}>
          <Dots pts={anionPath} off={off * 0.7} n={5} color={FLOW} sign="−" r={1.25} />
          <Dots pts={cationPath} off={off * 0.7} n={5} color={CATION} sign="+" r={1.25} />
        </g>
      )}
      {/* wires: lamp circuit and voltmeter branch */}
      <path d={d([[LX, 22], [LX, 14], [56, 14]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      <path d={d([[64, 14], [RX, 14], [RX, 22]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      <path d={d([[LX, 14], [LX, 2], [54, 2]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      <path d={d([[66, 2], [RX, 2], [RX, 14]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      {!closed && <><circle cx={LX + 14} cy={14} r={1} fill="#fff" stroke={WIRE} strokeWidth={0.5} /><T x={LX + 14} y={11.5} fs={fs * 0.9} fill="#4d5768">switch open</T></>}
      {reveal && speed > 0 && <g data-electrons><Dots pts={wire} off={off} n={8} color={FLOW} r={1} /></g>}
      <circle cx={60} cy={14} r={4} fill="#fff" stroke="#1a2233" strokeWidth={0.7} />
      <path d="M 57.2 11.2 L 62.8 16.8 M 62.8 11.2 L 57.2 16.8" stroke={speed > 0 ? '#e0a100' : '#7c8595'} strokeWidth={0.6} />
      <T x={60} y={21} fs={fs * 0.9} fill="#4d5768">{closed ? `${(res.I * 1000).toFixed(0)} mA` : '0 mA'} lamp</T>
      <circle cx={60} cy={2} r={5.6} fill="#fff" stroke="#1a2233" strokeWidth={0.8} />
      <text x={60} y={4.4} fontSize={6.2} textAnchor="middle" fill="#1a2233" fontWeight={700}>V</text>
      <g data-voltmeter-reading><T x={68} y={3.6} fs={fs} bold anchor="start">{`${sgn(res.E, 3)} V`}</T></g>
      {reveal && speed > 0 && <T x={40} y={12} fs={fs * 0.9} fill={FLOW}>{`e⁻ ${res.anodeSideNow === 'left' ? '→' : '←'}`}</T>}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------- the electrolysis picture
function ElecScene({ input, frac, fs }: { input: ElecInput; frac: number; fs: number }) {
  const e = electrolyte(input.id);
  const r = electrolysis(input);
  const speed = 5 + 8 * input.I;
  const off = useFlow(speed);
  const mass = r.mass * frac;
  const thick = 0.5 + 3.5 * Math.min(1, mass / (e.id === 'water' ? 1e9 : 2.5));
  const CX = 46, AX = 74;
  const deposit = e.id === 'cu' ? '#c9773f' : e.id === 'ag' ? '#dfe4ea' : null;
  const bubble = (x: number, k: number, col = '#fff') => <circle key={`${x}-${k}`} cx={x + ((k * 3) % 5) - 2} cy={62 - ((off * 0.8 + k * 7) % 24)} r={0.9} fill={col} stroke="#7c8595" strokeWidth={0.3} />;
  return (
    <svg viewBox="0 -7 120 92" className="block w-full select-none bg-surface" role="img" data-elec-scene aria-label={`Electrolysis of ${e.name} between two platinum electrodes with a battery and a balance reading the cathode mass`}>
      <rect x={27} y={40} width={66} height={30} fill={e.liquid} opacity={0.7} />
      <path d="M 27 30 V 70 H 93 V 30" fill="none" stroke="#7c8595" strokeWidth={0.7} />
      {/* ions drifting: cations to the cathode (left), anions to the anode (right) */}
      <g data-elec-ions>
        <Dots pts={[[AX - 6, 52], [CX + 6, 52]]} off={off * 0.5} n={3} color={CATION} sign="+" r={1.25} />
        <Dots pts={[[CX + 6, 60], [AX - 6, 60]]} off={off * 0.5} n={3} color={FLOW} sign="−" r={1.25} />
      </g>
      <rect x={CX - 2} y={20} width={4} height={44} fill="#9a9fa6" stroke="#4d5768" strokeWidth={0.4} />
      {deposit && frac > 0 && <rect x={CX - 2 - thick} y={46} width={4 + 2 * thick} height={18} fill={deposit} stroke="#4d5768" strokeWidth={0.3} data-deposit />}
      <rect x={AX - 2} y={20} width={4} height={44} fill="#9a9fa6" stroke="#4d5768" strokeWidth={0.4} />
      {frac > 0 && [0, 1, 2, 3].map((k) => bubble(AX + 3, k))}
      {e.id === 'water' && frac > 0 && [0, 1, 2, 3, 4].map((k) => bubble(CX - 3, k))}
      {/* battery: long thin plate = +, short thick plate = − */}
      <path d={d([[CX, 20], [CX, 6], [55, 6]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      <path d={d([[65, 6], [AX, 6], [AX, 20]])} fill="none" stroke={WIRE} strokeWidth={0.8} />
      <line x1={55} y1={2.5} x2={55} y2={9.5} stroke="#1a2233" strokeWidth={2.2} />
      <line x1={65} y1={0.5} x2={65} y2={11.5} stroke="#1a2233" strokeWidth={0.9} />
      <T x={52} y={4.5} fs={fs} fill="#2347a8" bold>−</T>
      <T x={68} y={4.5} fs={fs} fill="#b42318" bold>+</T>
      <T x={60} y={-3.5} fs={fs * 0.95}>{input.I} A</T>
      <T x={CX} y={77} fs={fs} bold fill="#2347a8">Cathode (−)</T>
      <T x={AX} y={77} fs={fs} bold fill="#b42318">Anode (+)</T>
      <T x={CX} y={77 + fs * 1.25} fs={fs * 0.95}>{e.id === 'water' ? 'H₂ bubbles' : `${e.product} deposits`}</T>
      <T x={AX} y={77 + fs * 1.25} fs={fs * 0.95}>O₂ bubbles</T>
      {/* the balance */}
      <rect x={1} y={55} width={23} height={16} rx={1.5} fill="#e6eaf0" stroke="#4d5768" strokeWidth={0.5} />
      <rect x={3} y={57} width={19} height={6.5} rx={0.8} fill="#1a2233" />
      <text x={12.5} y={62.2} fontSize={3.5} textAnchor="middle" fill="#9be59b" fontWeight={700} data-balance-reading>{mass.toFixed(3)} g</text>
      <T x={12.5} y={68.5} fs={fs * 0.85} fill="#4d5768">balance</T>
      <T x={12.5} y={52} fs={fs * 0.85} fill="#4d5768">{e.id === 'water' ? 'H₂ liberated' : 'cathode gain'}</T>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------- graphs
function FitGraph({ rows }: { rows: Reading[] }) {
  const set = fitSet(rows);
  const rec = recover(set)!;
  const xs = set.map((p) => p.logQ);
  const lo = Math.min(...xs, 0) - 0.5, hi = Math.max(...xs, 0) + 0.5;
  const ys = set.map((p) => p.E);
  const yl = Math.min(...ys, rec.E0) - 0.06, yh = Math.max(...ys, rec.E0) + 0.06;
  const X = (x: number) => 34 + ((x - lo) / (hi - lo)) * 156;
  const Y = (y: number) => 82 - ((y - yl) / (yh - yl)) * 66;
  const ticks = [lo, (lo + hi) / 2, hi];
  const n0 = set[0]!.n;
  return (
    <div className="space-y-2" data-fit-block>
      <svg viewBox="0 0 200 104" className="w-full max-w-md" role="img" aria-label="Cell potential against log Q for your readings, with the fitted straight line">
        <line x1={34} y1={82} x2={192} y2={82} stroke="#7c8595" strokeWidth={0.5} />
        <line x1={34} y1={12} x2={34} y2={82} stroke="#7c8595" strokeWidth={0.5} />
        {ticks.map((t) => <text key={t} x={X(t)} y={90} fontSize={5.5} textAnchor="middle" fill="#4d5768">{t.toFixed(1)}</text>)}
        {[yl + 0.06, (yl + yh) / 2, yh - 0.06].map((t) => <text key={t} x={31} y={Y(t) + 2} fontSize={5.5} textAnchor="end" fill="#4d5768">{t.toFixed(2)}</text>)}
        <line x1={X(lo)} y1={Y(rec.intercept + rec.slope * lo)} x2={X(hi)} y2={Y(rec.intercept + rec.slope * hi)} stroke={HILITE} strokeWidth={1} />
        <circle cx={X(0)} cy={Y(rec.intercept)} r={2.6} fill="none" stroke={HILITE} strokeWidth={0.8} />
        {set.map((p, i) => <circle key={i} cx={X(p.logQ)} cy={Y(p.E)} r={2.2} fill="#2347a8" />)}
        <text x={113} y={100} fontSize={6} textAnchor="middle" fill="#4d5768">log Q</text>
        <text x={36} y={9} fontSize={6} fill="#4d5768">Ecell (V)</text>
        <text x={190} y={22} fontSize={5.4} textAnchor="end" fill="#7c8595">Green ring: log Q = 0, the intercept.</text>
      </svg>
      <p className="text-[15px] text-ink" data-fit>
        Your {set.length} readings lie on a straight line (r² = {rec.r2.toFixed(4)}). Slope = <strong className="num">{rec.slope.toFixed(4).replace('-', '−')} V</strong>, so −0.0592/slope gives <strong className="num">n = {rec.n.toFixed(2)}</strong>, a whole number: <strong>n = {rec.nRounded}</strong>. The intercept, the value of Ecell at log Q = 0, is <strong className="num">E° = {rec.intercept.toFixed(3)} V</strong>. The table says E° = {sgn(set[0]!.E0, 2)} V and n = {n0}.
      </p>
    </div>
  );
}

interface ElecPoint { id: string; Q: number; m: number }
function ChargeGraph({ input, frac, points }: { input: ElecInput; frac: number; points: ElecPoint[] }) {
  const e = electrolyte(input.id);
  const r = electrolysis(input);
  const mine = points.filter((p) => p.id === input.id);
  const xmax = Math.max(r.Q, ...mine.map((p) => p.Q), 1000) * 1.15;
  const ymax = r.perCoulomb * xmax;
  const X = (q: number) => 34 + (q / xmax) * 156;
  const Y = (m: number) => 82 - (m / ymax) * 66;
  return (
    <svg viewBox="0 0 200 104" className="w-full max-w-md" role="img" data-charge-graph aria-label="Mass against charge passed: a straight line through the origin">
      <line x1={34} y1={82} x2={192} y2={82} stroke="#7c8595" strokeWidth={0.5} />
      <line x1={34} y1={12} x2={34} y2={82} stroke="#7c8595" strokeWidth={0.5} />
      {[0, 0.5, 1].map((f) => <text key={f} x={X(f * xmax)} y={90} fontSize={5.5} textAnchor="middle" fill="#4d5768">{(f * xmax).toFixed(0)}</text>)}
      {[0.5, 1].map((f) => <text key={f} x={31} y={Y(f * ymax) + 2} fontSize={5.5} textAnchor="end" fill="#4d5768">{(f * ymax).toFixed(2)}</text>)}
      <line x1={X(0)} y1={Y(0)} x2={X(xmax)} y2={Y(ymax)} stroke={HILITE} strokeWidth={1} />
      {mine.map((p, i) => <circle key={i} cx={X(p.Q)} cy={Y(p.m)} r={2.2} fill="#2347a8" />)}
      <circle cx={X(r.Q * frac)} cy={Y(r.mass * frac)} r={2.8} fill="#e0a100" stroke="#fff" strokeWidth={0.6} data-live-point />
      <text x={113} y={100} fontSize={6} textAnchor="middle" fill="#4d5768">charge Q = I t (C)</text>
      <text x={36} y={9} fontSize={6} fill="#4d5768">mass (g), {e.id === 'water' ? 'H₂' : e.product}</text>
      <text x={190} y={22} fontSize={5.4} textAnchor="end" fill="#7c8595">Slope = M/(nF) = {(r.perCoulomb * 1000).toFixed(4)} mg per C</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------- the page
interface Row extends Reading { cAnode: number; cCathode: number; anodeIon: string; cathodeIon: string }

const STEP_NAMES = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;
const roundP = (v: number) => Math.round(v * 10) / 10;

function Calc({ res }: { res: CellResult }) {
  const A = res.anode, C = res.cathode;
  return (
    <div className="space-y-1 rounded-md bg-ink/5 p-2.5 text-sm text-ink" data-calc>
      <div><span className="text-ink-2">Cell reaction: </span><span className="num font-semibold">{res.overall}</span> <span className="text-ink-3">(n = {res.n})</span></div>
      <div><span className="text-ink-2">E°cell = E°cathode − E°anode = </span><span className="num">{sgn(C.E0, 2)} − ({sgn(A.E0, 2)}) = <strong>{res.E0.toFixed(2)} V</strong></span></div>
      <div><span className="text-ink-2">Q = </span><span className="num">{fmtC(res.Q)}</span> <span className="text-ink-3">(log Q = {sgn(res.logQ, 3)})</span></div>
      <div><span className="text-ink-2">Ecell = E° − (0.0592/{res.n}) log Q = </span><span className="num">{res.E0.toFixed(2)} − {(SLOPE / res.n).toFixed(4)} × ({sgn(res.logQ, 3)}) = <strong data-ecell>{sgn(res.E, 3)} V</strong></span></div>
      <div><span className="text-ink-2">ΔG° = −nFE° = </span><span className="num"><strong>{res.dG0.toFixed(1).replace('-', '−')} kJ/mol</strong></span> <span className="text-ink-2"> · ΔG = </span><span className="num">{res.dG.toFixed(1).replace('-', '−')} kJ/mol</span></div>
      <div><span className="text-ink-2">log K = nE°/0.0592 = </span><span className="num"><strong>{res.logK.toFixed(2)}</strong> (K = {res.K < 1e5 ? res.K.toFixed(2) : res.K.toExponential(2).replace('e+', ' × 10^')})</span></div>
    </div>
  );
}

export function GalvanicLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const narrow = useNarrow();
  const fs = narrow ? 4.2 : 3.4;
  const [setup, setSetup] = useState<Setup>(START);
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [identified, setIdentified] = useState<string[]>([]);
  const [wrongTry, setWrongTry] = useState(false);
  const [closed, setClosed] = useState(true);
  const [dupe, setDupe] = useState(false);
  const [frac, setFrac] = useState(1);
  const [running, setRunning] = useState(false);
  const [points, setPoints] = useState<ElecPoint[]>([]);

  const cell = setup.cell;
  const res = useMemo(() => galvanic(cell), [cell]);
  const er = useMemo(() => electrolysis(setup.elec), [setup.elec]);
  const el = electrolyte(setup.elec.id);
  const key = pairKey(cell.left, cell.right);
  const known = identified.includes(key);
  const set = (p: Partial<Setup>) => setSetup((s) => ({ ...s, ...p }));
  const setCell = (p: Partial<CellInput>) => { setSetup((s) => ({ ...s, cell: { ...s.cell, ...p } })); setWrongTry(false); setDupe(false); };
  const setElec = (p: Partial<ElecInput>) => { setSetup((s) => ({ ...s, elec: { ...s.elec, ...p } })); setRunning(false); setFrac(1); };

  // the "Run" button plays the electrolysis over about three seconds
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let done = false;
      setFrac((f) => { const nf = Math.min(1, f + dt / 3); done = nf >= 1; return nf; });
      if (done) setRunning(false); else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const readings: Reading[] = rows;
  const fit = canFitRows(readings);
  const finished = Object.keys(ans).length === APPLY.length;
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!fit ? ['record at least three readings of one cell at different concentration ratios (different log Q) in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, seen[2] ?? false, rows.length >= 3, fit, seen[5] ?? false, finished];

  const choose = (i: number) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setPi(i); setSetup(p.base); setRunning(false); setFrac(1); };
  const lock = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    setSetup(p.test);
    setRunning(false);
    setFrac(1);
    setTested((x) => ({ ...x, [p.id]: true }));
    if (p.test.mode === 'cell') setIdentified((k) => (k.includes(pairKey(p.test.cell.left, p.test.cell.right)) ? k : [...k, pairKey(p.test.cell.left, p.test.cell.right)]));
  };
  const guess = (side: 'left' | 'right') => {
    if (side === res.anodeSide) { setIdentified((k) => [...k, key]); setWrongTry(false); } else setWrongTry(true);
  };
  const record = () => {
    if (!known) return;
    const rd = readingOf(cell);
    if (rows.some((x) => x.key === rd.key && x.logQ === rd.logQ)) { setDupe(true); return; }
    setDupe(false);
    setRows((x) => [...x, { ...rd, cAnode: res.cAnode, cCathode: res.cCathode, anodeIon: res.anode.ion, cathodeIon: res.cathode.ion }]);
  };
  const reset = () => { setSetup((s) => ({ ...START, mode: s.mode })); setWrongTry(false); setDupe(false); setClosed(true); setRunning(false); setFrac(1); };
  const pickHalf = (side: 'left' | 'right', id: string) => {
    const other = side === 'left' ? cell.right : cell.left;
    const mine = side === 'left' ? cell.left : cell.right;
    const patch: Partial<CellInput> = side === 'left' ? { left: id } : { right: id };
    if (id === other) Object.assign(patch, side === 'left' ? { right: mine } : { left: mine });
    setCell(patch);
  };
  const recordMass = () => {
    if (points.some((p) => p.id === setup.elec.id && Math.abs(p.Q - er.Q) < 1e-9)) return;
    setPoints((x) => [...x, { id: setup.elec.id, Q: er.Q, m: er.mass }]);
  };
  const mine = points.filter((p) => p.id === setup.elec.id);
  const slope = mine.length >= 2 ? slopeThroughOrigin(mine.map((p) => p.Q), mine.map((p) => p.m)) : null;
  const sb = saltBridge(res);

  const cellMode = setup.mode === 'cell';

  return (
    <div data-galvanic-lab data-mode={setup.mode}>
      <PageHeader back={back} title="Galvanic Cell and Electrolysis Lab: build a cell, apply Nernst and Faraday" subtitle={<span className="inline-flex flex-wrap items-center gap-2">Chemistry · Electrochemistry <Badge tone="amber">Draft – unverified</Badge></span>} />
      <StepNav step={step} seen={seen} done={done} go={go} names={STEP_NAMES} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div role="tablist" aria-label="Experiment" className="flex flex-wrap gap-1 border-b border-rule p-2">
              {([['cell', 'Galvanic cell'], ['elec', 'Electrolysis']] as const).map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={setup.mode === id} data-mode-tab={id} onClick={() => set({ mode: id })} className={`h-8 rounded-md px-3 text-[13px] font-medium ${setup.mode === id ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'text-ink-2 hover:bg-ink/5'}`}>{label}</button>
              ))}
            </div>
            {cellMode ? <CellScene input={cell} res={res} reveal={known} closed={closed} fs={fs} /> : <ElecScene input={setup.elec} frac={frac} fs={fs} />}

            {cellMode ? (
              <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2" data-controls>
                {(['left', 'right'] as const).map((side) => {
                  const h = half(side === 'left' ? cell.left : cell.right);
                  const p = side === 'left' ? cell.pLeft : cell.pRight;
                  return (
                    <div key={side} className="space-y-2">
                      <label className="block text-sm text-ink">{side === 'left' ? 'Left half-cell' : 'Right half-cell'}
                        <select aria-label={`${side} electrode`} data-sel={side} className="ml-2 h-8 rounded-md border border-rule-strong bg-surface px-1" value={h.id} onChange={(e) => pickHalf(side, e.target.value)}>
                          {HALVES.map((o) => <option key={o.id} value={o.id}>{o.el === 'Pt' ? 'Pt | H₂ | H⁺' : `${o.el} | ${o.ion}`}  (E° {o.E0 >= 0 ? '+' : '−'}{Math.abs(o.E0).toFixed(2)} V)</option>)}
                        </select>
                      </label>
                      <Slider id={`p-${side}`} label={`[${h.ion}]`} unit="mol/L" value={p} min={P_MIN} max={P_MAX} step={P_STEP} shown={fmtC(conc(p))} onChange={(v) => setCell(side === 'left' ? { pLeft: roundP(v) } : { pRight: roundP(v) })} />
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <button type="button" className={btn} onClick={() => setClosed((c) => !c)} aria-pressed={closed} data-switch>Switch: {closed ? 'closed' : 'open'}</button>
                  <button type="button" className={btn} onClick={reset} data-reset><RotateCcw aria-hidden className="size-4" /> Reset</button>
                  <p className="basis-full text-xs text-ink-3">The sliders set each ion concentration from 0.001 to about 3 mol/L (steps of a tenth in log). The voltmeter is ideal: it reads the cell’s emf and draws no current. The lamp ({R_LOAD} Ω, with {R_INT} Ω inside the cell) shows the current; the dots move faster when it is larger.</p>
                </div>
                {!known && (
                  <div className="rounded-md bg-marker-soft p-3 text-sm text-ink sm:col-span-2" data-identify role="group" aria-label="Identify the anode">
                    <p className="font-semibold">Before you read this cell: which electrode is the anode (oxidation)?</p>
                    <p className="mt-0.5 text-ink-2">Compare the two E° values in the lists above, then choose. The labels, the electron flow and the salt-bridge ions appear once you are right.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(['left', 'right'] as const).map((s) => (
                        <button key={s} type="button" className={btnMain} data-guess={s} onClick={() => guess(s)}>{s === 'left' ? `Left: ${half(cell.left).el === 'Pt' ? 'Pt | H₂' : half(cell.left).el}` : `Right: ${half(cell.right).el === 'Pt' ? 'Pt | H₂' : half(cell.right).el}`}</button>
                      ))}
                    </div>
                    {wrongTry && <p className="mt-2 font-medium text-wrong" role="alert" data-wrong>Not that one. Oxidation happens at the anode, and the half-cell with the lower (more negative) reduction potential is the one that loses electrons. Check the two E° values and try again.</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2" data-controls>
                <div className="sm:col-span-2">
                  <div role="group" aria-label="Electrolyte" className="inline-flex w-full flex-wrap gap-0.5 rounded-md bg-ink/5 p-0.5">
                    {ELECTROLYTES.map((x) => (
                      <button key={x.id} type="button" aria-pressed={setup.elec.id === x.id} data-elyte={x.id} onClick={() => setElec({ id: x.id })} className={`h-8 flex-1 rounded px-2 text-[13px] font-medium ${setup.elec.id === x.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>{x.id === 'cu' ? 'CuSO₄' : x.id === 'ag' ? 'AgNO₃' : 'Acidified water'}</button>
                    ))}
                  </div>
                </div>
                <Slider id="e-I" label="Current I" unit="A" value={setup.elec.I} {...ELEC_LIMITS.I} onChange={(v) => setElec({ I: v })} />
                <Slider id="e-t" label="Time t" unit="s" value={setup.elec.t} {...ELEC_LIMITS.t} onChange={(v) => setElec({ t: v })} />
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <button type="button" className={btnMain} onClick={() => { setFrac(0); setRunning(true); }} data-run><Play aria-hidden className="size-4" /> Run the electrolysis</button>
                  <button type="button" className={btn} onClick={recordMass} data-record-mass>Record this mass</button>
                  <button type="button" className={btn} onClick={reset} data-reset><RotateCcw aria-hidden className="size-4" /> Reset</button>
                  <p className="basis-full text-xs text-ink-3">Platinum electrodes, so the anode product is oxygen. The balance shows the mass gained by the cathode (or the hydrogen liberated, computed) as the charge passes. Press Run to see it build up, or move a slider to jump to the final value.</p>
                </div>
              </div>
            )}
          </div>

          <div className={`${panel} space-y-3 p-3`} aria-live="polite" data-readout>
            {cellMode ? (
              known ? (
                <>
                  <div className="num rounded-md bg-ink/5 p-2.5 text-[15px] font-semibold text-ink" data-notation>{res.notation}</div>
                  <Calc res={res} />
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                    {[
                      [res.reversed ? 'Anode now (polarity has reversed)' : 'Anode (−), oxidation', `${res.anodeNow.el === 'Pt' ? 'H₂ on Pt' : res.anodeNow.el} (${res.anodeSideNow})`],
                      ['Cathode (+), reduction', `${res.cathodeNow.el === 'Pt' ? 'H⁺ on Pt' : res.cathodeNow.el} (${res.anodeSideNow === 'left' ? 'right' : 'left'})`],
                      ['Electrons in the wire', closed && res.I > 1e-4 ? `from the ${electronsLeaveFrom(res)} electrode to the ${electronsLeaveFrom(res) === 'left' ? 'right' : 'left'}` : 'no net flow'],
                      ['Salt-bridge anions move to', closed && res.I > 1e-4 ? `the ${sb.anionsToward} (anode) half-cell` : 'no net flow'],
                      ['Salt-bridge cations move to', closed && res.I > 1e-4 ? `the ${sb.cationsToward} (cathode) half-cell` : 'no net flow'],
                      ['Current through the lamp', closed ? `${(res.I * 1000).toFixed(1)} mA` : '0 (switch open)'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num text-right font-semibold text-ink">{v}</dd></div>
                    ))}
                  </dl>
                  {res.reversed && <p className="rounded-md bg-marker-soft p-2 text-sm text-ink" data-reversed>Ecell has gone negative: Q is now larger than K, so the reaction runs the other way and the other electrode has become the anode.</p>}
                  {Math.abs(res.E) < 0.002 && <p className="rounded-md bg-accent-soft p-2 text-sm text-ink">Ecell is almost zero: the cell is close to equilibrium (Q ≈ K = {res.K.toFixed(2)}), ΔG ≈ 0 and almost no current flows.</p>}
                </>
              ) : (
                <p className="text-sm text-ink-2">Identify the anode above to see the cell notation, E°cell, the Nernst calculation, ΔG° and K for this pair.</p>
              )
            ) : (
              <>
                <div className="rounded-md bg-ink/5 p-2.5 text-sm text-ink" data-elec-calc>
                  <div><span className="text-ink-2">Electrolyte: </span><strong>{el.name}</strong>, platinum electrodes</div>
                  <div><span className="text-ink-2">Cathode (−): </span><span className="num">{el.cathodeEq}</span> <span className="text-ink-2"> · Anode (+): </span><span className="num">{el.anodeEq}</span></div>
                  <div><span className="text-ink-2">Charge Q = I t = </span><span className="num">{setup.elec.I} × {setup.elec.t} = <strong>{er.Q.toFixed(0)} C</strong></span> <span className="text-ink-2"> = </span><span className="num">{er.molE.toFixed(4)} mol e⁻</span></div>
                  <div><span className="text-ink-2">w = M Q/(nF) = </span><span className="num">{el.M} × {er.Q.toFixed(0)} / ({el.ne} × 96500) = <strong data-mass>{er.mass.toFixed(3)} g</strong> {el.id === 'water' ? 'of hydrogen' : el.product}</span></div>
                  <div><span className="text-ink-2">Oxygen at the anode: </span><span className="num">{O2.M} × {er.Q.toFixed(0)} / ({O2.ne} × 96500) = {er.massO2.toFixed(3)} g</span></div>
                </div>
                <ChargeGraph input={setup.elec} frac={frac} points={points} />
                {mine.length > 0 && (
                  <p className="text-sm text-ink" data-elec-fit>
                    {mine.length} recorded point{mine.length === 1 ? '' : 's'} for this electrolyte.
                    {slope !== null && <> Line through the origin: slope = <span className="num">{(slope * 1000).toFixed(4)} mg per C</span>, so n = M/(slope × F) = <strong className="num">{electronsFromSlope(slope, el.M).toFixed(2)}</strong> electrons per {el.id === 'water' ? 'H₂' : el.product} unit.</>}
                    {' '}<button type="button" className={btn} onClick={() => setPoints((x) => x.filter((p) => p.id !== setup.elec.id))}>Clear points</button>
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-ink-3">Standard reduction potentials are the usual textbook values at 298 K, 1 mol/L ions and 1 bar gases (NCERT table); they are not measured here. Nernst uses 0.0592 V and Faraday’s constant is taken as 96500 C/mol. All content is Draft – unverified.</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">A galvanic cell turns a spontaneous redox reaction into electrical energy. Build one here from two half-cells, then pass a current the other way and watch electrolysis deposit a metal.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Pick two half-cells and an ion concentration for each. First say which electrode is the anode: the picture only opens up when you are right.</li>
                <li>Read E°cell, the Nernst Ecell, ΔG° and K. Then watch the electrons and the salt-bridge ions move.</li>
                <li>On the Electrolysis tab choose a current and a time and weigh what is deposited.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choose} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={lock}
              explain={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; return p.why({ base: p.base, test: p.test }); }}
              onNext={() => choose(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Build:</strong> choose Zn and Cu. Name the anode. Then swap the two sides with the lists: does the chemistry change?</li>
                <li><strong>Nernst:</strong> slide [Cu²⁺] down by a factor of 10 and note the change in Ecell. Slide [Zn²⁺] down instead. Which one raises Ecell?</li>
                <li><strong>Reversal:</strong> choose Sn and Pb. Raise [Sn²⁺] until the voltmeter passes zero and see the electrons turn round.</li>
                <li><strong>Other pairs:</strong> try Mg with Ag, or Pt | H₂ with Cu. How does E°cell compare with the difference of the two E° values?</li>
                <li><strong>Electrolysis:</strong> deposit copper, then silver, with the same current and time. Which gives the bigger mass, and why?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => { set({ mode: 'cell' }); go(3); }}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Keep one pair of electrodes on the Galvanic cell tab. Change the concentrations and record Ecell for at least three <strong>different concentration ratios</strong> (different Q). The same ratio twice does not count. Try Q below 1, Q = 1 and Q above 1.</p>
              <div className="flex flex-wrap items-center gap-2">
                {!cellMode && <button type="button" className={btn} onClick={() => set({ mode: 'cell' })}>Go to the galvanic cell</button>}
                <button type="button" className={btnMain} onClick={record} disabled={!cellMode || !known} data-record>Record reading</button>
                {!known && cellMode && <span className="text-sm text-ink-2">Identify the anode first.</span>}
              </div>
              {dupe && <p className="text-sm font-medium text-wrong" role="alert">That concentration ratio is already in the table. Change a concentration first.</p>}
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Cell</th><th className="pr-2">[anode ion]</th><th className="pr-2">[cathode ion]</th><th className="pr-2">log Q</th><th>Ecell (V)</th></tr></thead>
                    <tbody className="num">{rows.map((x, i) => <tr key={i} className="border-t border-rule"><td className="py-1 pr-2">{x.key.replace('+', ' & ')}</td><td className="pr-2">{fmtC(x.cAnode)}</td><td className="pr-2">{fmtC(x.cCathode)}</td><td className="pr-2">{sgn(x.logQ, 3)}</td><td>{sgn(x.E, 3)}</td></tr>)}</tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => { setRows([]); setDupe(false); }}>Clear table</button>
                </div>
              )}
              {fit && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my readings</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {fit ? <FitGraph rows={readings} /> : <p className="text-[15px] text-ink">Record at least three readings of one cell at different concentration ratios in the Measure step first.</p>}
              {fit && <p className="text-sm text-ink-2">The Nernst equation is a straight line in disguise: Ecell = E° − (0.0592/n) × log Q. Plotted against log Q, the slope gives the number of electrons and the intercept gives E°.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>The anode is where oxidation happens, the cathode where reduction happens. In a galvanic cell the anode is negative; electrons run from it through the wire to the cathode.</li>
                <li><span className="num">E°cell = E°cathode − E°anode</span>, both written as reduction potentials. A positive value means the reaction is spontaneous as written.</li>
                <li>The salt bridge completes the circuit and keeps both solutions neutral: anions move towards the anode compartment, cations towards the cathode compartment.</li>
                <li><span className="num">Ecell = E° − (0.0592/n) log Q</span> at 298 K. A reactant at higher concentration raises Ecell; a product at higher concentration lowers it. At Q = K, Ecell = 0 and the cell is “dead”.</li>
                <li><span className="num">ΔG° = −nFE°</span> and <span className="num">log K = nE°/0.0592</span>: a larger E° means a more negative ΔG° and a far larger K.</li>
                <li><span className="num">w = M I t/(nF)</span>: mass is proportional to charge (first law), and the same charge deposits masses proportional to M/n (second law).</li>
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
