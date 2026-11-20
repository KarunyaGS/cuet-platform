import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, Children } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps, RangeSlider } from '../visual/labkit';
import { clampTo, stepFor, trim, type Range } from '../visual/ranges';
import {
  APPLY, balanceR, CELL_LIMITS, cellCircuit, fitLine, KIRCH_LIMITS, kirchhoff, maxPower, PREDICTS, START, WHEAT_LIMITS, wheatstone,
  type Arrangement, type CellState, type Exp, type KirchState, type Setup, type WheatState,
} from '../visual/circuit';

const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 0.9, strokeLinejoin: 'round' } as const;
const WIRE = '#8b95a7';
const RES = '#a86100';
const FLOW = '#2347a8';
const HILITE = '#1d7a4b';
const n2 = (x: number) => (Math.abs(x) < 0.0005 ? '0.00' : x.toFixed(2));
const A = (x: number) => `${Math.abs(x) < 0.0005 ? '0.00' : x.toFixed(2)} A`;
const V = (x: number) => `${Math.abs(x) < 0.0005 ? '0.00' : x.toFixed(2)} V`;

interface PNode { name: string; x: number; y: number; v: number }
interface Seg { branch: string; pts: [number, number][]; I: number }
interface BranchInfo { key: string; name: string; I: number; unit: 'A' | 'mA'; dir: string }
interface Board { nodes: PNode[]; segs: Seg[]; branches: BranchInfo[]; draw: ReactNode; fs: number; gain: number }

/** A zig-zag resistor drawn along the straight line between two points. */
function zig(x1: number, y1: number, x2: number, y2: number, amp = 2.2, teeth = 6, margin = 0.2): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const s = len * margin, e = len * (1 - margin);
  let d = `M ${x1} ${y1} L ${(x1 + ux * s).toFixed(2)} ${(y1 + uy * s).toFixed(2)}`;
  for (let k = 0; k < teeth; k++) {
    const t = s + ((e - s) * (k + 0.5)) / teeth;
    const sg = k % 2 === 0 ? 1 : -1;
    d += ` L ${(x1 + ux * t + nx * amp * sg).toFixed(2)} ${(y1 + uy * t + ny * amp * sg).toFixed(2)}`;
  }
  return d + ` L ${(x1 + ux * e).toFixed(2)} ${(y1 + uy * e).toFixed(2)} L ${x2} ${y2}`;
}
const line = (pts: [number, number][]) => pts.map((p, k) => `${k ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
/**
 * A label on the board (120 units wide). A long number (a student's own range can make one) is moved inward just far
 * enough that the whole label stays on the board instead of being cut off at the edge.
 */
const BOARD_W = 120;
const T = ({ x, y, children, fs, anchor = 'middle', fill = '#1a2233', bold = false }: { x: number; y: number; children: ReactNode; fs: number; anchor?: 'start' | 'middle' | 'end'; fill?: string; bold?: boolean }) => {
  const w = Children.toArray(children).join('').length * fs * (bold ? 0.62 : 0.56);
  const lo = anchor === 'start' ? 0.8 : anchor === 'middle' ? w / 2 + 0.8 : w + 0.8;
  const hi = anchor === 'start' ? BOARD_W - 0.8 - w : anchor === 'middle' ? BOARD_W - 0.8 - w / 2 : BOARD_W - 0.8;
  const ax = hi < lo ? lo : Math.min(hi, Math.max(lo, x));
  return (
    <text x={ax} y={y} fontSize={fs} textAnchor={anchor} fill={fill} fontWeight={bold ? 700 : 400} {...halo}>{children}</text>
  );
};
/** A cell: the long plate is positive. `up` puts the + plate on top. */
const CellSymbol = ({ x, y, up = true, label, fs, right = false }: { x: number; y: number; up?: boolean; label: string; fs: number; right?: boolean }) => (
  <g>
    <line x1={x - 5.5} y1={up ? y - 2.5 : y + 2.5} x2={x + 5.5} y2={up ? y - 2.5 : y + 2.5} stroke="#1a2233" strokeWidth={0.9} />
    <line x1={x - 3} y1={up ? y + 2.5 : y - 2.5} x2={x + 3} y2={up ? y + 2.5 : y - 2.5} stroke="#1a2233" strokeWidth={2.2} />
    <text x={right ? x - 8 : x + 8} y={up ? y - 1.4 : y + 4.8} fontSize={fs * 0.9} fill="#b42318" textAnchor={right ? 'end' : 'start'} {...halo}>+</text>
    <T x={right ? x + 9 : x - 8} y={y + 1.2} fs={fs} anchor={right ? 'start' : 'end'}>{label}</T>
  </g>
);

// ---------------------------------------------------------------------------------------------- boards
function cellBoard(c: CellState, fs: number): Board {
  const r = cellCircuit(c);
  const v = r.nodes;
  const series = c.mode === 'series';
  const par = c.mode === 'parallel';
  const nodes: PNode[] = [
    { name: 'G (cell −)', x: 14, y: 62, v: v[0]! },
    { name: 'X (inside the cell)', x: 14, y: 30, v: v[1]! },
    { name: 'P (cell +)', x: 14, y: 12, v: v[2]! },
  ];
  const segs: Seg[] = [
    { branch: 'cell', pts: [[14, 62], [14, 46], [14, 30]], I: r.I },
    { branch: 'cell', pts: [[14, 30], [14, 12]], I: r.I },
  ];
  let ext: ReactNode;
  const branches: BranchInfo[] = [{ key: 'cell', name: 'the cell (and the wire from it)', I: r.I, unit: 'A', dir: 'out of the + terminal, around the circuit' }];
  if (c.mode === 'single') {
    segs.push({ branch: 'cell', pts: [[14, 12], [90, 12]], I: r.I }, { branch: 'R1', pts: [[90, 12], [90, 34]], I: r.I1 }, { branch: 'R1', pts: [[90, 34], [90, 40]], I: r.I1 }, { branch: 'R1', pts: [[90, 40], [90, 62]], I: r.I1 }, { branch: 'cell', pts: [[90, 62], [14, 62]], I: r.I });
    ext = (
      <g>
        <path d={zig(90, 22, 90, 52)} fill="none" stroke={RES} strokeWidth={0.9} />
        <T x={97} y={37} fs={fs} anchor="start">R = {c.R1} Ω</T>
        <T x={97} y={37 + fs * 1.2} fs={fs} anchor="start" fill="#4d5768">{V(r.V1)}</T>
      </g>
    );
    branches.push({ key: 'R1', name: 'the resistor R', I: r.I1, unit: 'A', dir: 'down through R' });
  } else if (series) {
    nodes.push({ name: 'M (between R₁ and R₂)', x: 100, y: 12, v: v[3]! });
    segs.push({ branch: 'R1', pts: [[14, 12], [100, 12]], I: r.I1 }, { branch: 'R2', pts: [[100, 12], [100, 62]], I: r.I2 }, { branch: 'R2', pts: [[100, 62], [14, 62]], I: r.I2 });
    ext = (
      <g>
        <path d={zig(34, 12, 78, 12, 2.2, 8)} fill="none" stroke={RES} strokeWidth={0.9} />
        <T x={56} y={4.5} fs={fs}>R₁ = {c.R1} Ω · {V(r.V1)}</T>
        <path d={zig(100, 24, 100, 52)} fill="none" stroke={RES} strokeWidth={0.9} />
        <T x={106} y={36} fs={fs} anchor="start">R₂ = {c.R2} Ω</T>
        <T x={106} y={36 + fs * 1.2} fs={fs} anchor="start" fill="#4d5768">{V(r.V2)}</T>
      </g>
    );
    branches.push({ key: 'R1', name: 'R₁', I: r.I1, unit: 'A', dir: 'along the top wire' }, { key: 'R2', name: 'R₂', I: r.I2, unit: 'A', dir: 'down through R₂' });
  } else if (par) {
    segs.push({ branch: 'cell', pts: [[14, 12], [64, 12]], I: r.I }, { branch: 'R1', pts: [[64, 12], [64, 62]], I: r.I1 }, { branch: 'R2', pts: [[64, 12], [100, 12]], I: r.I2 }, { branch: 'R2', pts: [[100, 12], [100, 62]], I: r.I2 }, { branch: 'cell', pts: [[100, 62], [14, 62]], I: r.I });
    ext = (
      <g>
        <path d={zig(64, 24, 64, 52)} fill="none" stroke={RES} strokeWidth={0.9} />
        <T x={70} y={34} fs={fs} anchor="start">R₁ = {c.R1} Ω</T>
        <T x={70} y={34 + fs * 1.2} fs={fs} anchor="start" fill="#4d5768">{A(r.I1)}</T>
        <path d={zig(100, 24, 100, 52)} fill="none" stroke={RES} strokeWidth={0.9} />
        <T x={106} y={34} fs={fs} anchor="start">R₂ = {c.R2} Ω</T>
        <T x={106} y={34 + fs * 1.2} fs={fs} anchor="start" fill="#4d5768">{A(r.I2)}</T>
      </g>
    );
    branches.push({ key: 'R1', name: 'R₁', I: r.I1, unit: 'A', dir: 'down through R₁' }, { key: 'R2', name: 'R₂', I: r.I2, unit: 'A', dir: 'down through R₂' });
  }
  const draw = (
    <g>
      <rect x={6} y={25} width={16} height={23} rx={3} fill="none" stroke="#b3bccb" strokeDasharray="1.4 1.4" strokeWidth={0.5} />
      <CellSymbol x={14} y={38} label={`ε = ${c.emf} V`} fs={fs} right />
      <path d={zig(14, 30, 14, 12, 1.8, 4, 0.12)} fill="none" stroke={RES} strokeWidth={0.8} strokeDasharray="0" />
      <T x={20} y={22} fs={fs * 0.9} anchor="start">r = {c.r} Ω</T>
      {ext}
    </g>
  );
  return { nodes: [...nodes], segs, branches, draw, fs, gain: 1 };
}

function kirchBoard(k: KirchState, fs: number): Board {
  const r = kirchhoff(k);
  const v = r.nodes;
  const nodes: PNode[] = [
    { name: 'A (top junction)', x: 60, y: 12, v: v[1]! },
    { name: 'B (bottom junction)', x: 60, y: 62, v: v[0]! },
    { name: 'C (+ of cell 1)', x: 22, y: 38, v: v[2]! },
    { name: 'D (+ of cell 2)', x: 98, y: 38, v: v[3]! },
  ];
  const segs: Seg[] = [
    { branch: 'I1', pts: [[60, 62], [22, 62]], I: r.I1 }, { branch: 'I1', pts: [[22, 62], [22, 12]], I: r.I1 }, { branch: 'I1', pts: [[22, 12], [60, 12]], I: r.I1 },
    { branch: 'I3', pts: [[60, 62], [98, 62]], I: r.I3 }, { branch: 'I3', pts: [[98, 62], [98, 12]], I: r.I3 }, { branch: 'I3', pts: [[98, 12], [60, 12]], I: r.I3 },
    { branch: 'I2', pts: [[60, 12], [60, 62]], I: r.I2 },
  ];
  const draw = (
    <g>
      <CellSymbol x={22} y={48} up={k.e1 >= 0} label={`ε₁ = ${k.e1} V`} fs={fs} right />
      <path d={zig(22, 34, 22, 18)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={28} y={27} fs={fs} anchor="start">R₁ = {k.R1} Ω</T>
      <path d={zig(60, 20, 60, 54)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={66} y={38} fs={fs} anchor="start">R₂ = {k.R2} Ω</T>
      <CellSymbol x={98} y={48} up={k.e2 >= 0} label={`ε₂ = ${k.e2} V`} fs={fs} />
      <path d={zig(98, 34, 98, 18)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={104} y={27} fs={fs} anchor="start">R₃ = {k.R3} Ω</T>
      <T x={22} y={71} fs={fs} fill="#1d7a4b" bold>I₁ = {n2(r.I1)} A ↑</T>
      <T x={60} y={71} fs={fs} fill="#1d7a4b" bold>I₂ = {n2(r.I2)} A ↓</T>
      <T x={98} y={71} fs={fs} fill="#1d7a4b" bold>I₃ = {n2(r.I3)} A ↑</T>
    </g>
  );
  return {
    nodes, segs, draw, fs, gain: 1,
    branches: [
      { key: 'I1', name: 'left branch (cell 1, R₁)', I: r.I1, unit: 'A', dir: 'up (a negative value means down)' },
      { key: 'I2', name: 'middle branch (R₂)', I: r.I2, unit: 'A', dir: 'down (a negative value means up)' },
      { key: 'I3', name: 'right branch (cell 2, R₃)', I: r.I3, unit: 'A', dir: 'up (a negative value means down)' },
    ],
  };
}

function wheatBoard(w: WheatState, fs: number): Board {
  const r = wheatstone(w);
  const v = r.nodes;
  const A_: [number, number] = [22, 28], B: [number, number] = [60, 8], C: [number, number] = [98, 28], D: [number, number] = [60, 48];
  const nodes: PNode[] = [
    { name: 'A (left corner)', x: A_[0], y: A_[1], v: v[1]! },
    { name: 'B (top corner)', x: B[0], y: B[1], v: v[2]! },
    { name: 'C (right corner)', x: C[0], y: C[1], v: v[0]! },
    { name: 'D (bottom corner)', x: D[0], y: D[1], v: v[3]! },
  ];
  const segs: Seg[] = [
    { branch: 'P', pts: [A_, B], I: r.IP }, { branch: 'Q', pts: [B, C], I: r.IQ }, { branch: 'R', pts: [A_, D], I: r.IR }, { branch: 'S', pts: [D, C], I: r.IS },
    { branch: 'G', pts: [B, D], I: r.Ig },
    { branch: 'Ib', pts: [[47, 60], [22, 60], A_], I: r.Ib }, { branch: 'Ib', pts: [C, [98, 60], [52, 60]], I: r.Ib },
  ];
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const gm = mid(B, D);
  const draw = (
    <g>
      <path d={zig(A_[0], A_[1], B[0], B[1], 2, 6, 0.25)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={30} y={11} fs={fs} anchor="end">P = {w.P} Ω</T>
      <path d={zig(B[0], B[1], C[0], C[1], 2, 6, 0.25)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={90} y={11} fs={fs} anchor="start">Q = {w.Q} Ω</T>
      <path d={zig(A_[0], A_[1], D[0], D[1], 2, 6, 0.25)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={26} y={51} fs={fs} anchor="start">R = {w.R} Ω</T>
      <path d={zig(D[0], D[1], C[0], C[1], 2, 6, 0.25)} fill="none" stroke={RES} strokeWidth={0.9} />
      <T x={94} y={51} fs={fs} anchor="end">S = {w.S} Ω</T>
      <circle cx={gm[0]} cy={gm[1]} r={5} fill="#fff" stroke="#1a2233" strokeWidth={0.8} />
      <text x={gm[0]} y={gm[1] + 1.5} fontSize={fs * 1.1} textAnchor="middle" fill="#1a2233" fontWeight={700}>G</text>
      <T x={gm[0] + 7} y={gm[1] - 4} fs={fs * 0.9} anchor="start" fill={r.balanced ? HILITE : '#b42318'} bold>{r.balanced ? 'null: 0.00 mA' : `${(r.Ig * 1000).toFixed(2)} mA`}</T>
      <path d={line([[22, 60], [47, 60]])} stroke={WIRE} strokeWidth={0.7} fill="none" />
      <line x1={47} y1={54.5} x2={47} y2={65.5} stroke="#1a2233" strokeWidth={0.9} />
      <line x1={52} y1={57} x2={52} y2={63} stroke="#1a2233" strokeWidth={2.2} />
      <text x={43} y={58} fontSize={fs * 0.9} fill="#b42318" textAnchor="end" {...halo}>+</text>
      <path d={line([[52, 60], [98, 60]])} stroke={WIRE} strokeWidth={0.7} fill="none" />
      <T x={50} y={69} fs={fs}>ε = {w.emf} V</T>
    </g>
  );
  return {
    nodes, segs, draw, fs, gain: 25,
    branches: [
      { key: 'G', name: 'the galvanometer', I: r.Ig * 1000, unit: 'mA', dir: 'from B to D (negative: D to B)' },
      { key: 'P', name: 'arm P', I: r.IP * 1000, unit: 'mA', dir: 'from A to B' },
      { key: 'Q', name: 'arm Q', I: r.IQ * 1000, unit: 'mA', dir: 'from B to C' },
      { key: 'R', name: 'arm R', I: r.IR * 1000, unit: 'mA', dir: 'from A to D' },
      { key: 'S', name: 'arm S', I: r.IS * 1000, unit: 'mA', dir: 'from D to C' },
      { key: 'Ib', name: 'the battery', I: r.Ib * 1000, unit: 'mA', dir: 'out of the + terminal' },
    ],
  };
}

// ---------------------------------------------------------------------------------------------- the live board
function polyLen(pts: [number, number][]) { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]); return L; }
function along(pts: [number, number][], s: number): [number, number] {
  let rest = s;
  for (let k = 1; k < pts.length; k++) {
    const l = Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]);
    if (rest <= l) { const t = l === 0 ? 0 : rest / l; return [pts[k - 1]![0] + (pts[k]![0] - pts[k - 1]![0]) * t, pts[k - 1]![1] + (pts[k]![1] - pts[k - 1]![1]) * t]; }
    rest -= l;
  }
  return pts[pts.length - 1]!;
}
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function BoardView({ board, probes, setProbes, branch }: { board: Board; probes: [number, number]; setProbes: (p: [number, number]) => void; branch: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [, tick] = useState(0);
  const offsets = useRef<number[]>([]);
  const live = useRef(board.segs);
  live.current = board.segs;
  const gainRef = useRef(board.gain);
  gainRef.current = board.gain;
  const [drag, setDrag] = useState<{ which: 0 | 1; x: number; y: number } | null>(null);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      live.current.forEach((s, k) => { offsets.current[k] = (offsets.current[k] ?? 0) + Math.sign(s.I) * Math.min(45, 12 * Math.pow(Math.abs(s.I) * gainRef.current, 0.6)) * dt; });
      acc += dt;
      if (acc > 0.033) { acc = 0; tick((n) => (n + 1) % 1000000); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const toWorld = (cx: number, cy: number): [number, number] => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const m = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return [m.x, m.y];
  };
  const nearest = (x: number, y: number) => board.nodes.reduce((b, n, k) => (Math.hypot(n.x - x, n.y - y) < Math.hypot(board.nodes[b]!.x - x, board.nodes[b]!.y - y) ? k : b), 0);
  const fs = board.fs;
  const probeAt = (which: 0 | 1) => {
    if (drag && drag.which === which) return { x: drag.x, y: drag.y };
    const n = board.nodes[Math.min(probes[which], board.nodes.length - 1)]!;
    return { x: n.x + (which === 0 ? -3.2 : 3.2), y: n.y - 3.4 };
  };
  return (
    <svg ref={svg} viewBox="0 0 120 74" className="block w-full touch-none select-none bg-surface" role="img" data-board aria-label="Circuit board with live current flow, voltmeter probes and node labels">
      {/* wires */}
      {board.segs.map((s, k) => <path key={`w${k}`} d={line(s.pts)} fill="none" stroke={s.branch === branch ? HILITE : WIRE} strokeWidth={s.branch === branch ? 1.5 : 0.8} strokeLinejoin="round" />)}
      {board.draw}
      {/* moving charge: conventional current, speed grows with the current */}
      {board.segs.map((s, k) => {
        if (Math.abs(s.I) < 1e-6) return null;
        const L = polyLen(s.pts);
        const n = Math.max(1, Math.floor(L / 6));
        const off = offsets.current[k] ?? 0;
        return Array.from({ length: n }, (_, j) => {
          const t = (((off + (j * L) / n) % L) + L) % L;
          const [x, y] = along(s.pts, t);
          return <circle key={`d${k}-${j}`} cx={x} cy={y} r={0.95} fill={FLOW} />;
        });
      })}
      {/* nodes */}
      {board.nodes.map((n) => (
        <g key={n.name}>
          <circle cx={n.x} cy={n.y} r={1.7} fill="#fff" stroke="#1a2233" strokeWidth={0.6} />
          <T x={n.x + (n.x < 40 ? -3 : 3)} y={n.y + (n.y < 20 ? -2.5 : 5)} fs={fs * 0.95} anchor={n.x < 40 ? 'end' : 'start'} fill="#4d5768">{n.name.split(' ')[0]}</T>
          <title>{`${n.name}: ${n.v.toFixed(3)} V`}</title>
        </g>
      ))}
      {/* voltmeter probes: drag a probe onto any node, or focus it and use the arrow keys */}
      {([0, 1] as const).map((w) => {
        const p = probeAt(w);
        return (
          <g
            key={w}
            tabIndex={0}
            role="slider"
            data-probe={w === 0 ? 'plus' : 'minus'}
            aria-label={`Voltmeter ${w === 0 ? 'positive' : 'negative'} probe. Left and right arrow keys move it to the next node.`}
            aria-valuemin={0}
            aria-valuemax={board.nodes.length - 1}
            aria-valuenow={Math.min(probes[w], board.nodes.length - 1)}
            aria-valuetext={`on node ${board.nodes[Math.min(probes[w], board.nodes.length - 1)]!.name}`}
            style={{ cursor: 'grab', outline: 'none' }}
            onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const [x, y] = toWorld(e.clientX, e.clientY); setDrag({ which: w, x, y }); }}
            onPointerMove={(e) => { if (drag?.which === w) { const [x, y] = toWorld(e.clientX, e.clientY); setDrag({ which: w, x, y }); } }}
            onPointerUp={(e) => { if (drag?.which === w) { const [x, y] = toWorld(e.clientX, e.clientY); const k = nearest(x, y); const next: [number, number] = [...probes]; next[w] = k; setProbes(next); setDrag(null); } }}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next: [number, number] = [...probes];
              next[w] = (probes[w] + d + board.nodes.length) % board.nodes.length;
              setProbes(next);
            }}
          >
            <circle cx={p.x} cy={p.y} r={5.5} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={2.7} fill={w === 0 ? '#b42318' : '#1a2233'} stroke="#fff" strokeWidth={0.5} />
            <text x={p.x} y={p.y + 1.2} fontSize={3.4} textAnchor="middle" fill="#fff" fontWeight={700}>{w === 0 ? '+' : '−'}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------- graphs
function CellGraph({ c, readings }: { c: CellState; readings: Reading[] }) {
  const r = cellCircuit(c);
  const Imax = c.r > 0 ? c.emf / c.r : 12;
  const xm = Math.max(Imax, r.I * 1.3, 1) * 1.05;
  const ym = c.emf * 1.15;
  const X = (x: number) => 30 + (x / xm) * 160;
  const Y = (y: number) => 78 - (y / ym) * 64;
  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-md" role="img" aria-label="Terminal voltage against current for the cell, with the present operating point and your recorded readings">
      <rect x={30} y={14} width={160} height={64} fill="#fff" stroke="#e5e5e5" />
      <line x1={X(0)} y1={Y(c.emf)} x2={X(Math.min(xm, Imax))} y2={Y(Math.max(0, c.emf - Math.min(xm, Imax) * c.r))} stroke="#7c8595" strokeWidth={1} strokeDasharray="3 2" />
      {readings.map((q, i) => <circle key={i} cx={X(q.I)} cy={Y(q.V)} r={2.6} fill="#b42318" />)}
      <circle cx={X(r.I)} cy={Y(r.Vt)} r={3.4} fill="none" stroke="#2347a8" strokeWidth={1.4} />
      <text x={190} y={92} fontSize={7} textAnchor="end" fill="#4d5768">current I (A)</text>
      <text x={32} y={10} fontSize={7} fill="#4d5768">terminal voltage V (V)</text>
      <text x={28} y={Y(c.emf) + 2} fontSize={6.5} textAnchor="end" fill="#7c8595">ε</text>
      <text x={32} y={97} fontSize={6.2} fill="#7c8595">Dashed: V = ε − I r. Ring: now. Dots: your readings.</text>
    </svg>
  );
}
function WheatGraph({ w, lo, hi }: { w: WheatState; lo: number; hi: number }) {
  const pts: string[] = [];
  let mx = 0;
  const vals = Array.from({ length: 100 }, (_, k) => { const R = lo + (k * (hi - lo)) / 99; const I = wheatstone({ ...w, R }).Ig * 1000; mx = Math.max(mx, Math.abs(I)); return { R, I }; });
  const X = (R: number) => 30 + ((R - lo) / (hi - lo)) * 160;
  const Y = (I: number) => 46 - (I / (mx || 1)) * 30;
  vals.forEach((q) => pts.push(`${X(q.R).toFixed(1)},${Y(q.I).toFixed(1)}`));
  const now = wheatstone(w).Ig * 1000;
  const bal = balanceR(w);
  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-md" role="img" aria-label="Galvanometer current against R: it crosses zero where the bridge balances">
      <rect x={30} y={14} width={160} height={64} fill="#fff" stroke="#e5e5e5" />
      <line x1={30} y1={46} x2={190} y2={46} stroke="#c9ced8" />
      <polyline points={pts.join(' ')} fill="none" stroke="#b42318" strokeWidth={1.3} />
      {bal >= lo && bal <= hi && <line x1={X(bal)} y1={14} x2={X(bal)} y2={78} stroke="#1d7a4b" strokeDasharray="2 2" />}
      <circle cx={X(Math.min(hi, Math.max(lo, w.R)))} cy={Y(now)} r={3.2} fill="none" stroke="#2347a8" strokeWidth={1.4} />
      <text x={190} y={92} fontSize={7} textAnchor="end" fill="#4d5768">R (Ω)</text>
      <text x={30} y={87} fontSize={6.5} fill="#7c8595">{trim(lo)}</text>
      <text x={190} y={87} fontSize={6.5} textAnchor="end" fill="#7c8595">{trim(hi)}</text>
      <text x={32} y={10} fontSize={7} fill="#4d5768">galvanometer current (mA)</text>
      <text x={32} y={97} fontSize={6.2} fill="#7c8595">Zero crossing: the bridge balances. Ring: now.</text>
    </svg>
  );
}
function FitGraph({ rows }: { rows: Reading[] }) {
  const fit = fitLine(rows.map((r) => r.I), rows.map((r) => r.V))!;
  const xm = Math.max(...rows.map((r) => r.I)) * 1.2;
  const ym = Math.max(fit.a, ...rows.map((r) => r.V)) * 1.15;
  const X = (x: number) => 30 + (x / xm) * 160;
  const Y = (y: number) => 78 - (y / ym) * 64;
  const r0 = rows[0]!;
  const eps = fit.a, rr = -fit.b;
  return (
    <div>
      <svg viewBox="0 0 200 100" className="w-full max-w-md" role="img" aria-label="Your readings of terminal voltage against current lie on a straight line">
        <rect x={30} y={14} width={160} height={64} fill="#fff" stroke="#e5e5e5" />
        <line x1={X(0)} y1={Y(fit.a)} x2={X(xm)} y2={Y(fit.a + fit.b * xm)} stroke="#2347a8" strokeWidth={1.2} opacity={0.7} />
        {rows.map((r, i) => <circle key={i} cx={X(r.I)} cy={Y(r.V)} r={2.8} fill="#b42318" />)}
        <circle cx={X(0)} cy={Y(fit.a)} r={2.6} fill="none" stroke="#1d7a4b" strokeWidth={1.3} />
        <text x={190} y={92} fontSize={7} textAnchor="end" fill="#4d5768">current I (A)</text>
        <text x={32} y={10} fontSize={7} fill="#4d5768">terminal voltage V (V)</text>
        <text x={32} y={97} fontSize={6.2} fill="#7c8595">Line: V = ε − I r. Green ring: the intercept.</text>
      </svg>
      <p className="text-[15px] text-ink" data-fit>
        The readings lie on a straight line. The intercept on the voltage axis is the emf, <strong className="num">ε = {eps.toFixed(2)} V</strong>, and the slope is −r, so the internal resistance is <strong className="num">r = {rr.toFixed(2)} Ω</strong>. You set ε = {r0.emf} V and r = {r0.r} Ω.
      </p>
    </div>
  );
}

interface Reading { emf: number; r: number; R: number; I: number; V: number }

const STEP_NAMES = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;
const EXPS: { id: Exp; label: string }[] = [
  { id: 'cell', label: 'Cell and resistors' },
  { id: 'kirch', label: 'Kirchhoff’s rules' },
  { id: 'wheat', label: 'Wheatstone bridge' },
];

export function CircuitLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [params] = useSearchParams();
  const startExp = (params.get('exp') as Exp) || 'cell';
  const narrow = useNarrow();
  const [setup, setSetup] = useState<Setup>({ ...START, exp: EXPS.some((e) => e.id === startExp) ? startExp : 'cell' });
  const [probes, setProbes] = useState<[number, number]>([2, 0]);
  const [branch, setBranch] = useState('');
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const set = (p: Partial<Setup>) => setSetup((s) => ({ ...s, ...p }));
  // The student's own range for any control, by control id; a control not listed uses the lab's range.
  const [ranges, setRanges] = useState<Record<string, Range>>({});
  const wheatR = ranges['w-R'] ?? { min: WHEAT_LIMITS.R.min, max: WHEAT_LIMITS.R.max };
  const rs = (id: string, label: string, unit: string, value: number, design: { min: number; max: number; step: number }, apply: (v: number) => void) => {
    const r = ranges[id] ?? { min: design.min, max: design.max };
    const step = ranges[id] ? stepFor(design.step, r) : design.step;
    return (
      <RangeSlider
        key={id}
        id={id}
        label={label}
        unit={unit}
        value={value}
        min={r.min}
        max={r.max}
        step={step}
        shown={trim(value)}
        onChange={(v) => apply(Number(v.toPrecision(8)))}
        design={{ min: design.min, max: design.max }}
        range={r}
        onRange={(nr) => {
          setRanges((cur) => {
            const next = { ...cur };
            if (nr.min === design.min && nr.max === design.max) delete next[id];
            else next[id] = nr;
            return next;
          });
          apply(clampTo(value, nr));
        }}
      />
    );
  };
  const fs = narrow ? 4.1 : 3.3;
  const board = useMemo(() => (setup.exp === 'cell' ? cellBoard(setup.cell, fs) : setup.exp === 'kirch' ? kirchBoard(setup.kirch, fs) : wheatBoard(setup.wheat, fs)), [setup, fs]);
  const pr: [number, number] = [Math.min(probes[0], board.nodes.length - 1), Math.min(probes[1], board.nodes.length - 1)];
  const vPlus = board.nodes[pr[0]]!, vMinus = board.nodes[pr[1]]!;
  const br = board.branches.find((b) => b.key === branch) ?? board.branches[0]!;
  const cr = cellCircuit(setup.cell);
  const kr = kirchhoff(setup.kirch);
  const wr = wheatstone(setup.wheat);
  const finished = Object.keys(ans).length === APPLY.length;
  const last = rows[rows.length - 1];
  const sameSetup = last ? rows.filter((r) => r.emf === last.emf && r.r === last.r) : [];
  const canFit = new Set(sameSetup.map((r) => r.I.toFixed(9))).size >= 3;
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!canFit ? ['record at least three readings at different external resistances, with the same ε and r, in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, seen[2] ?? false, rows.length >= 3, canFit, seen[5] ?? false, finished];

  const choose = (i: number) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setPi(i); setRanges({}); setSetup(p.base); setBranch(''); };
  const record = () => {
    if (setup.exp !== 'cell') return;
    const rd: Reading = { emf: setup.cell.emf, r: setup.cell.r, R: cr.Rext, I: cr.I, V: cr.Vt };
    if (rows.some((x) => x.emf === rd.emf && x.r === rd.r && Math.abs(x.I - rd.I) < 1e-9)) return;
    setRows((x) => [...x, rd]);
  };
  const reset = () => { setRanges({}); setSetup((s) => ({ ...START, exp: s.exp })); setProbes([2, 0]); setBranch(''); };
  const sw = (exp: Exp) => { set({ exp }); setProbes([exp === 'cell' ? 2 : 0, exp === 'cell' ? 0 : 1]); setBranch(''); };
  const setCell = (p: Partial<CellState>) => setSetup((s) => ({ ...s, cell: { ...s.cell, ...p } }));
  const setKirch = (p: Partial<KirchState>) => setSetup((s) => ({ ...s, kirch: { ...s.kirch, ...p } }));
  const setWheat = (p: Partial<WheatState>) => setSetup((s) => ({ ...s, wheat: { ...s.wheat, ...p } }));
  const dv = vPlus.v - vMinus.v;

  return (
    <div data-circuit-lab data-exp={setup.exp}>
      <PageHeader back={back} title="Circuit Bench: cells, Kirchhoff’s rules and the Wheatstone bridge" subtitle={<span className="inline-flex flex-wrap items-center gap-2">Physics · Current electricity <Badge tone="amber">Draft – unverified</Badge></span>} actions={<Link to={`/lab/vpa/ohms-law${lessonId ? `?lesson=${encodeURIComponent(lessonId)}` : ''}`} className="inline-flex h-9 items-center rounded-lg bg-[#174d43] px-3.5 text-sm font-semibold text-[#e7f078] hover:bg-[#103d36]">Try Ohm’s law assessment</Link>} />
      <StepNav step={step} seen={seen} done={done} go={go} names={STEP_NAMES} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div role="tablist" aria-label="Experiment" className="flex flex-wrap gap-1 border-b border-rule p-2">
              {EXPS.map((e) => (
                <button key={e.id} role="tab" type="button" aria-selected={setup.exp === e.id} data-exp-tab={e.id} onClick={() => sw(e.id)} className={`h-8 rounded-md px-3 text-[13px] font-medium ${setup.exp === e.id ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'text-ink-2 hover:bg-ink/5'}`}>{e.label}</button>
              ))}
            </div>
            <BoardView board={board} probes={pr} setProbes={setProbes} branch={br.key} />
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2" data-controls>
              {setup.exp === 'cell' && (
                <>
                  {rs('c-emf', 'Emf ε', 'V', setup.cell.emf, CELL_LIMITS.emf, (v) => setCell({ emf: v }))}
                  {rs('c-r', 'Internal resistance r', 'Ω', setup.cell.r, CELL_LIMITS.r, (v) => setCell({ r: v }))}
                  {rs('c-R1', 'Resistor R₁', 'Ω', setup.cell.R1, CELL_LIMITS.R, (v) => setCell({ R1: v }))}
                  <div className="text-sm">
                    <span className="text-ink">Add a second resistor</span>
                    <div role="group" aria-label="Second resistor" className="mt-1 inline-flex w-full gap-0.5 rounded-md bg-ink/5 p-0.5">
                      {([['single', 'None'], ['series', 'In series'], ['parallel', 'In parallel']] as [Arrangement, string][]).map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={setup.cell.mode === k} data-mode={k} onClick={() => setCell({ mode: k })} className={`h-8 flex-1 rounded px-2 text-[13px] font-medium ${setup.cell.mode === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {setup.cell.mode !== 'single' && rs('c-R2', 'Resistor R₂', 'Ω', setup.cell.R2, CELL_LIMITS.R, (v) => setCell({ R2: v }))}
                </>
              )}
              {setup.exp === 'kirch' && (
                <>
                  {rs('k-e1', 'Cell 1, ε₁', 'V', setup.kirch.e1, KIRCH_LIMITS.e, (v) => setKirch({ e1: v }))}
                  {rs('k-e2', 'Cell 2, ε₂ (negative = reversed)', 'V', setup.kirch.e2, KIRCH_LIMITS.e, (v) => setKirch({ e2: v }))}
                  {rs('k-R1', 'R₁', 'Ω', setup.kirch.R1, KIRCH_LIMITS.R, (v) => setKirch({ R1: v }))}
                  {rs('k-R2', 'R₂', 'Ω', setup.kirch.R2, KIRCH_LIMITS.R, (v) => setKirch({ R2: v }))}
                  {rs('k-R3', 'R₃', 'Ω', setup.kirch.R3, KIRCH_LIMITS.R, (v) => setKirch({ R3: v }))}
                </>
              )}
              {setup.exp === 'wheat' && (
                <>
                  {rs('w-R', 'Variable resistor R (decade box)', 'Ω', setup.wheat.R, { ...WHEAT_LIMITS.R, step: 5 }, (v) => setWheat({ R: v }))}
                  {rs('w-S', 'Unknown resistor S', 'Ω', setup.wheat.S, WHEAT_LIMITS.ratio, (v) => setWheat({ S: v }))}
                  {rs('w-P', 'Ratio arm P', 'Ω', setup.wheat.P, WHEAT_LIMITS.ratio, (v) => setWheat({ P: v }))}
                  {rs('w-Q', 'Ratio arm Q', 'Ω', setup.wheat.Q, WHEAT_LIMITS.ratio, (v) => setWheat({ Q: v }))}
                  {rs('w-emf', 'Battery emf ε', 'V', setup.wheat.emf, { min: 1, max: 12, step: 0.5 }, (v) => setWheat({ emf: v }))}
                </>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button type="button" className={btn} onClick={reset} data-reset><RotateCcw aria-hidden className="size-4" /> Reset</button>
                <p className="text-xs text-ink-3">Blue dots are moving charge: they flow faster when the current is larger. The green wire is the branch the ammeter is reading. Drag the red (+) and black (−) voltmeter probes onto any two nodes, or focus a probe and press the arrow keys.</p>
              </div>
            </div>
          </div>

          <div className={`${panel} p-3`} aria-live="polite" data-readout>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-ink/5 p-2.5 text-sm" data-voltmeter>
                <div className="font-semibold text-ink">Voltmeter</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <label className="text-ink-2">+ on
                    <select aria-label="Positive probe node" data-sel="plus" className="ml-1 h-8 rounded-md border border-rule-strong bg-surface px-1" value={pr[0]} onChange={(e) => setProbes([Number(e.target.value), pr[1]])}>
                      {board.nodes.map((n, k) => <option key={n.name} value={k}>{n.name.split(' ')[0]}</option>)}
                    </select></label>
                  <label className="text-ink-2">− on
                    <select aria-label="Negative probe node" data-sel="minus" className="ml-1 h-8 rounded-md border border-rule-strong bg-surface px-1" value={pr[1]} onChange={(e) => setProbes([pr[0], Number(e.target.value)])}>
                      {board.nodes.map((n, k) => <option key={n.name} value={k}>{n.name.split(' ')[0]}</option>)}
                    </select></label>
                </div>
                <div className="num mt-1 text-[15px] font-semibold text-ink" data-voltmeter-reading>V = {n2(dv)} V</div>
              </div>
              <div className="rounded-md bg-ink/5 p-2.5 text-sm" data-ammeter>
                <div className="font-semibold text-ink">Ammeter</div>
                <label className="mt-1 block text-ink-2">Read the current in
                  <select aria-label="Branch for the ammeter" data-sel="branch" className="ml-1 h-8 max-w-full rounded-md border border-rule-strong bg-surface px-1" value={br.key} onChange={(e) => setBranch(e.target.value)}>
                    {board.branches.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                  </select></label>
                <div className="num mt-1 text-[15px] font-semibold text-ink" data-ammeter-reading>I = {Math.abs(br.I) < 0.0005 ? '0.00' : br.I.toFixed(2)} {br.unit}</div>
                <div className="text-xs text-ink-3">{br.dir}</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
              {(setup.exp === 'cell'
                ? [
                    ['Total external resistance', `${cr.Rext.toFixed(2)} Ω`],
                    ['Current from the cell, I', A(cr.I)],
                    ['Terminal voltage, V = ε − I r', V(cr.Vt)],
                    ['Volts lost inside the cell, I r', V(cr.I * setup.cell.r)],
                    ['Power in the external circuit', `${cr.Pext.toFixed(2)} W`],
                    ['Power wasted inside the cell', `${cr.Pint.toFixed(2)} W`],
                    ['Efficiency', `${(cr.eff * 100).toFixed(0)} %`],
                    ['Most power is drawn when R =', `${setup.cell.r} Ω (${setup.cell.r > 0 ? maxPower(setup.cell.emf, setup.cell.r).toFixed(1) : '–'} W)`],
                  ]
                : setup.exp === 'kirch'
                  ? [
                      ['Current in the left branch, I₁', A(kr.I1)],
                      ['Current in the middle branch, I₂', A(kr.I2)],
                      ['Current in the right branch, I₃', A(kr.I3)],
                      ['Voltage of A above B', V(kr.VAB)],
                      ['Junction rule: I₁ + I₃ − I₂', A(kr.junction)],
                      ['Left loop: ε₁ − I₁R₁ − I₂R₂', V(kr.loopLeft)],
                      ['Right loop: ε₂ − I₃R₃ − I₂R₂', V(kr.loopRight)],
                    ]
                  : [
                      ['Galvanometer current', `${(wr.Ig * 1000).toFixed(3)} mA`],
                      ['P / Q', (setup.wheat.P / setup.wheat.Q).toFixed(3)],
                      ['R / S', (setup.wheat.R / setup.wheat.S).toFixed(3)],
                      ['Bridge', wr.balanced ? 'balanced (P/Q = R/S)' : 'not balanced'],
                      ['Battery current', `${(wr.Ib * 1000).toFixed(2)} mA`],
                      ['R that would balance it', `${balanceR(setup.wheat).toFixed(1)} Ω`],
                    ]).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-3">{setup.exp === 'cell' ? <CellGraph c={setup.cell} readings={rows} /> : setup.exp === 'wheat' ? <WheatGraph w={setup.wheat} lo={wheatR.min} hi={wheatR.max} /> : <p className="text-xs text-ink-3">Check Kirchhoff’s rules: the three sums above stay at zero for every setting. Try reversing cell 2 with a negative ε₂.</p>}</div>
            <p className="mt-2 text-xs text-ink-3">Currents are conventional (from + round the circuit to −). Values are exact for ideal wires and meters.</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">This bench has three experiments. Each is a real circuit solved live, so every meter reading is what the physics says.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>On “Cell and resistors”, raise R₁ and watch the terminal voltage and the moving charge.</li>
                <li>Add a second resistor in series, then in parallel. Which one draws more current?</li>
                <li>Drag the voltmeter probes onto different nodes.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choose} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setRanges({}); setSetup(p.test); setBranch(''); setTested((x) => ({ ...x, [p.id]: true })); }}
              explain={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; return p.why({ base: p.base, test: p.test }); }}
              onNext={() => choose(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Cell:</strong> set ε = 12 V and r = 3 Ω and change R₁. For which R₁ is the external power largest? Compare it with r.</li>
                <li><strong>Cell:</strong> set R₁ = 1 Ω. How big is the terminal voltage compared with ε? Why?</li>
                <li><strong>Kirchhoff:</strong> read all three currents. Do I₁ + I₃ and I₂ agree at the junction? Reverse cell 2 and look again.</li>
                <li><strong>Wheatstone:</strong> with P = Q, move R until the galvanometer reads zero. How does R compare with S? Then change the battery emf: does the balance move?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => { sw('cell'); go(3); }}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Keep the emf and the internal resistance fixed on “Cell and resistors”. Change the external resistance and record the current and the terminal voltage for at least three different values of R₁.</p>
              <div className="flex flex-wrap gap-2">
                {setup.exp !== 'cell' && <button type="button" className={btn} onClick={() => sw('cell')}>Go to “Cell and resistors”</button>}
                <button type="button" className={btnMain} onClick={record} disabled={setup.exp !== 'cell'} data-record>Record reading</button>
              </div>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">ε (V)</th><th className="pr-2">r (Ω)</th><th className="pr-2">R (Ω)</th><th className="pr-2">I (A)</th><th>V (V)</th></tr></thead>
                    <tbody className="num">{rows.map((x, i) => <tr key={i} className="border-t border-rule"><td className="py-1 pr-2">{x.emf}</td><td className="pr-2">{x.r}</td><td className="pr-2">{x.R.toFixed(1)}</td><td className="pr-2">{x.I.toFixed(3)}</td><td>{x.V.toFixed(3)}</td></tr>)}</tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>Clear table</button>
                </div>
              )}
              {canFit && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my readings</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canFit ? <FitGraph rows={sameSetup} /> : <p className="text-[15px] text-ink">Record at least three readings at different external resistances (same ε and r) in the Measure step first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>A real cell loses voltage inside itself: <span className="num">V = ε − I r</span>. The more current it delivers, the lower the terminal voltage, and the line of V against I has slope −r.</li>
                <li>Resistors in series add, <span className="num">R = R₁ + R₂</span>; in parallel the reciprocals add, so the total is smaller than either.</li>
                <li>Kirchhoff’s junction rule says the currents into a junction sum to zero (charge is conserved). The loop rule says the potential changes round any closed loop sum to zero (energy is conserved).</li>
                <li>A Wheatstone bridge is balanced when <span className="num">P/Q = R/S</span>: no current flows in the galvanometer, whatever the battery or the galvanometer resistance.</li>
                <li>A cell delivers the most power to an external resistor equal to its internal resistance, <span className="num">R = r</span>.</li>
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

