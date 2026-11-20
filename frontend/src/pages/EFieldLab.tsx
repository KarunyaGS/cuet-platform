import { Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useScrollTopOnOpen, useNarrow, useSteps, RangeSlider } from '../visual/labkit';
import { clampTo, stepFor, trim, type Range } from '../visual/ranges';
import {
  APPLY, dipoleAxial, dipoleEquatorial, dipoleMoment, dist, distinctDistances, fieldAt, fitK, forceMagnitude, forceOn, K, lineEnd, PREDICTS, START, traceLines,
  WORLD, WORLD_NARROW, type Charge, type Reading, type Scenario, type Vec,
} from '../visual/efield';

const POS = '#b42318';
const NEG = '#2347a8';
const halo = { paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 0.9, strokeLinejoin: 'round' } as const;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 3.6e5 -> "3.60 × 10⁵" */
function sci(x: number, digits = 2): string {
  if (x === 0 || !Number.isFinite(x)) return '0';
  const [m, e] = x.toExponential(digits).split('e');
  const sup = String(Number(e)).replace(/[-0-9]/g, (c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' })[c as '-' | '0']!);
  return `${m} × 10${sup}`;
}
const fN = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x >= 0.01 ? x.toFixed(2) : sci(x, 1)) + ' N';
const qLabel = (q: number) => `${q > 0 ? '+' : '−'}${Math.abs(q)} µC`;

const clone = (c: Charge[]): Charge[] => c.map((x) => ({ ...x }));

function arrow(x1: number, y1: number, x2: number, y2: number, head = 1.1): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${(x2 - head * 1.6 * Math.cos(a + d)).toFixed(2)},${(y2 - head * 1.6 * Math.sin(a + d)).toFixed(2)}`;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} M ${p(0.45)} L ${x2.toFixed(2)} ${y2.toFixed(2)} L ${p(-0.45)}`;
}

function Canvas({ charges, probe, sel, onSelect, onMove, onProbe, onChange, onRemove, showLines, showMap, showForces, narrow }: {
  charges: Charge[]; probe: Vec; sel: number | null; onSelect: (id: number | null) => void; onMove: (id: number, p: Vec) => void; onProbe: (p: Vec) => void;
  onChange: (id: number, dq: number) => void; onRemove: (id: number) => void; showLines: boolean; showMap: boolean; showForces: boolean; narrow: boolean;
}) {
  const world = narrow ? WORLD_NARROW : WORLD;
  const fs = narrow ? 3.5 : 2.7;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: 'charge' | 'probe'; id: number } | null>(null);
  const cb = useRef({ onMove, onProbe });
  cb.current = { onMove, onProbe };
  useEffect(() => {
    const point = (e: PointerEvent): Vec | null => {
      const el = svg.current;
      const m = el?.getScreenCTM();
      if (!el || !m) return null;
      const pt = el.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());
      return { x: r1(clamp(p.x, 2, world.w - 2)), y: r1(clamp(p.y, 2, world.h - 2)) };
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = point(e);
      if (!p) return;
      if (d.kind === 'charge') cb.current.onMove(d.id, p);
      else cb.current.onProbe(p);
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [world.w, world.h]);

  const lines = useMemo(() => (showLines ? traceLines(charges, world) : []), [charges, world, showLines]);
  const hasPos = charges.some((c) => c.q > 0);
  const map = useMemo(() => {
    if (!showMap) return [];
    const out: { x: number; y: number; a: number; t: number }[] = [];
    for (let y = 4; y < world.h; y += 5) {
      for (let x = 4; x < world.w; x += 5) {
        if (charges.some((c) => Math.hypot(x - c.x, y - c.y) < 3)) continue;
        const e = fieldAt(x, y, charges);
        if (e.mag < 1) continue;
        const t = clamp((Math.log10(e.mag) - 4) / 3, 0, 1);
        out.push({ x, y, a: Math.atan2(e.ey, e.ex), t });
      }
    }
    return out;
  }, [showMap, charges, world]);
  const forces = charges.map((_, i) => forceOn(i, charges));
  const maxF = Math.max(1e-12, ...forces.map((f) => f.mag));
  const E = fieldAt(probe.x, probe.y, charges);
  const eLen = E.mag > 0 ? 6 + 1.6 * clamp(Math.log10(E.mag) - 3, 0, 5) : 0;
  const rad = (c: Charge) => clamp(1.7 + 0.22 * Math.abs(c.q), 1.8, 3.8);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${world.w} ${world.h}`}
      className="block w-full touch-none select-none bg-surface"
      role="group"
      aria-label={`Electric field canvas. ${charges.length} charges. Drag a charge or the probe, or focus one and use the arrow keys.`}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
      data-efield-canvas
    >
      {Array.from({ length: Math.floor(world.w / 10) + 1 }, (_, i) => i * 10).map((x) => (
        <g key={`x${x}`}>
          <line x1={x} y1={0} x2={x} y2={world.h} stroke="#eef0f3" strokeWidth={0.2} />
          {x % 20 === 0 && (x + 4 < world.w ? <text x={x + 0.6} y={world.h - 0.8} fontSize={fs * 0.8} fill="#9aa3b2">{x}</text> : <text x={x - 0.6} y={world.h - 0.8} fontSize={fs * 0.8} fill="#9aa3b2" textAnchor="end">{x}</text>)}
        </g>
      ))}
      {Array.from({ length: Math.floor(world.h / 10) + 1 }, (_, i) => i * 10).map((y) => <line key={`y${y}`} x1={0} y1={y} x2={world.w} y2={y} stroke="#eef0f3" strokeWidth={0.2} />)}
      <text x={world.w - 1} y={fs * 0.9} fontSize={fs * 0.8} fill="#9aa3b2" textAnchor="end">cm</text>

      {map.map((m, i) => {
        const x2 = m.x + 2.1 * Math.cos(m.a);
        const y2 = m.y + 2.1 * Math.sin(m.a);
        return <path key={i} d={arrow(m.x - 2.1 * Math.cos(m.a), m.y - 2.1 * Math.sin(m.a), x2, y2, 0.7)} stroke="#c2410c" strokeWidth={0.28} fill="none" opacity={0.25 + 0.75 * m.t} />;
      })}

      {lines.map((l, i) => {
        const mid = Math.floor(l.pts.length / 2);
        const a = l.pts[Math.max(0, mid - 1)]!;
        const b = l.pts[mid]!;
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + (hasPos ? 0 : Math.PI);
        const tip = { x: b.x, y: b.y };
        const h = 0.9;
        return (
          <g key={i}>
            <polyline points={l.pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} fill="none" stroke="#5b6474" strokeWidth={0.22} />
            {l.pts.length > 6 && <polygon points={`${tip.x + h * 1.2 * Math.cos(ang)},${tip.y + h * 1.2 * Math.sin(ang)} ${tip.x + h * Math.cos(ang + 2.5)},${tip.y + h * Math.sin(ang + 2.5)} ${tip.x + h * Math.cos(ang - 2.5)},${tip.y + h * Math.sin(ang - 2.5)}`} fill="#5b6474" />}
          </g>
        );
      })}

      {charges.length >= 2 && (
        <g>
          <line x1={charges[0]!.x} y1={charges[0]!.y} x2={charges[1]!.x} y2={charges[1]!.y} stroke="#9aa3b2" strokeWidth={0.25} strokeDasharray="1 1" />
          <text x={(charges[0]!.x + charges[1]!.x) / 2} y={(charges[0]!.y + charges[1]!.y) / 2 + fs * 1.9 + 3} fontSize={fs} textAnchor="middle" fill="#4d5768" {...halo}>
            r = {dist(charges[0]!, charges[1]!).toFixed(1)} cm
          </text>
        </g>
      )}

      {showForces && charges.map((c, i) => {
        const f = forces[i]!;
        if (f.mag < 1e-12) return null;
        const len = 3 + 11 * (f.mag / maxF);
        const ux = f.fx / f.mag, uy = f.fy / f.mag;
        const sx = c.x + ux * (rad(c) + 0.4), sy = c.y + uy * (rad(c) + 0.4);
        const ex = sx + ux * len, ey = sy + uy * len;
        return (
          <g key={`f${c.id}`}>
            <path d={arrow(sx, sy, ex, ey, 0.9)} stroke="#a86100" strokeWidth={0.55} fill="none" strokeLinecap="round" />
            <text x={ex + ux * 1.2} y={ey + uy * 1.2 + 0.9} fontSize={fs} fill="#a86100" textAnchor={ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle'} fontWeight="bold" {...halo}>
              {fN(f.mag)}
            </text>
          </g>
        );
      })}

      {/* the probe */}
      <g
        tabIndex={0}
        role="button"
        aria-label={`Field probe at x ${probe.x}, y ${probe.y} centimetres. The field here is ${sci(E.mag)} newtons per coulomb. Arrow keys move it.`}
        data-probe
        style={{ cursor: 'grab', outline: 'none' }}
        onPointerDown={(e) => { e.stopPropagation(); drag.current = { kind: 'probe', id: 0 }; }}
        onKeyDown={(e) => {
          const d = e.shiftKey ? 5 : 1;
          const dx = e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0;
          const dy = e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0;
          if (!dx && !dy) return;
          e.preventDefault();
          onProbe({ x: r1(clamp(probe.x + dx, 2, world.w - 2)), y: r1(clamp(probe.y + dy, 2, world.h - 2)) });
        }}
      >
        <circle cx={probe.x} cy={probe.y} r={3} fill="transparent" />
        {eLen > 0 && E.mag > 0 && <path d={arrow(probe.x, probe.y, probe.x + (E.ex / E.mag) * eLen, probe.y + (E.ey / E.mag) * eLen, 1)} stroke="#1d7a4b" strokeWidth={0.6} fill="none" strokeLinecap="round" />}
        <circle cx={probe.x} cy={probe.y} r={1.1} fill="#1d7a4b" stroke="#fff" strokeWidth={0.35} />
        <text x={probe.x + (probe.x > world.w * 0.6 ? -1.8 : 1.8)} y={probe.y - 1.6} fontSize={fs} fill="#1d7a4b" fontWeight="bold" textAnchor={probe.x > world.w * 0.6 ? 'end' : 'start'} {...halo}>
          E = {E.mag < 1 ? '0' : sci(E.mag, 1)} N/C
        </text>
      </g>

      {charges.map((c, i) => (
        <g
          key={c.id}
          tabIndex={0}
          role="button"
          aria-label={`Charge ${i + 1}: ${qLabel(c.q)} at x ${c.x}, y ${c.y} centimetres. Arrow keys move it, plus and minus change its size, Delete removes it.`}
          aria-pressed={sel === c.id}
          data-charge={c.id}
          style={{ cursor: 'grab', outline: 'none' }}
          onFocus={() => onSelect(c.id)}
          onPointerDown={(e) => { e.stopPropagation(); onSelect(c.id); drag.current = { kind: 'charge', id: c.id }; }}
          onKeyDown={(e) => {
            const d = e.shiftKey ? 5 : 1;
            const dx = e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0;
            const dy = e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0;
            if (dx || dy) { e.preventDefault(); onMove(c.id, { x: r1(clamp(c.x + dx, 2, world.w - 2)), y: r1(clamp(c.y + dy, 2, world.h - 2)) }); }
            else if (e.key === '+' || e.key === '=') { e.preventDefault(); onChange(c.id, 0.5); }
            else if (e.key === '-' || e.key === '_') { e.preventDefault(); onChange(c.id, -0.5); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(c.id); }
          }}
        >
          <circle cx={c.x} cy={c.y} r={rad(c) + 1.6} fill="transparent" />
          {sel === c.id && <circle cx={c.x} cy={c.y} r={rad(c) + 1.2} fill="none" stroke="#1a2233" strokeWidth={0.35} strokeDasharray="1.2 0.9" />}
          <circle cx={c.x} cy={c.y} r={rad(c)} fill={c.q > 0 ? POS : NEG} stroke="#fff" strokeWidth={0.4} />
          <text x={c.x} y={c.y + fs * 0.36} fontSize={fs * 1.2} fill="#fff" textAnchor="middle" fontWeight="bold">{c.q > 0 ? '+' : '−'}</text>
          <text x={c.x} y={c.y - rad(c) - 1.2} fontSize={fs} fill={c.q > 0 ? POS : NEG} textAnchor="middle" fontWeight="bold" {...halo}>{qLabel(c.q)}</text>
        </g>
      ))}
    </svg>
  );
}

function ForceGraph({ q1, q2, r }: { q1: number; q2: number; r: number }) {
  // log-log: F ∝ 1/r² is a straight line of slope −2
  const lo = 3, hi = 60;
  const X = (v: number) => 36 + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 320;
  const fMax = forceMagnitude(q1, q2, lo), fMin = forceMagnitude(q1, q2, hi);
  const Y = (f: number) => 110 - ((Math.log(f) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin))) * 96;
  const pts = Array.from({ length: 60 }, (_, i) => lo * Math.pow(hi / lo, i / 59)).map((x) => `${X(x).toFixed(1)},${Y(forceMagnitude(q1, q2, x)).toFixed(1)}`).join(' ');
  const rr = clamp(r, lo, hi);
  return (
    <>
    <svg viewBox="0 -6 380 150" className="w-full max-w-lg" role="img" aria-label="Log-log graph of force against distance for the first two charges: a straight line of slope minus two.">
      <rect x={36} y={14} width={320} height={96} fill="#fff" stroke="#e5e5e5" />
      <polyline points={pts} fill="none" stroke="#b42318" strokeWidth={1.8} />
      {[3, 10, 30, 60].map((t) => (
        <g key={t}><line x1={X(t)} y1={110} x2={X(t)} y2={114} stroke="#7c8595" /><text x={X(t)} y={126} fontSize={12} textAnchor="middle" fill="#4d5768">{t}</text></g>
      ))}
      <text x={356} y={137} fontSize={12} textAnchor="end" fill="#4d5768">r (cm), log scale</text>
      <text x={38} y={10} fontSize={12} fill="#4d5768">force F (N), log scale</text>
      <line x1={X(rr)} y1={14} x2={X(rr)} y2={110} stroke="#1a2233" strokeWidth={0.8} strokeDasharray="3 3" />
      <circle cx={X(rr)} cy={Y(forceMagnitude(q1, q2, rr))} r={4} fill="#1a2233" />
    </svg>
    <p className="text-xs text-ink-3">The force runs from {fN(fMax)} at 3 cm to {fN(fMin)} at 60 cm.</p>
    </>
  );
}

function FitGraph({ rows }: { rows: Reading[] }) {
  const { slope, k } = fitK(rows);
  const xs = rows.map((r) => 1 / (r.r * 0.01) ** 2);
  const xm = Math.max(...xs) * 1.15;
  const ym = Math.max(...rows.map((r) => r.F), slope * xm) * 1.1;
  const X = (x: number) => 40 + (x / xm) * 330;
  const Y = (y: number) => 130 - (y / ym) * 108;
  const err = ((k - K) / K) * 100;
  return (
    <div>
      <svg viewBox="0 0 400 165" className="w-full max-w-md" role="img" aria-label="Force against one over r squared: a straight line through the origin.">
        <rect x={40} y={22} width={330} height={108} fill="#fff" stroke="#e5e5e5" />
        <line x1={X(0)} y1={Y(0)} x2={X(xm)} y2={Y(slope * xm)} stroke="#2347a8" strokeWidth={1.2} opacity={0.65} />
        {rows.map((r, i) => <circle key={i} cx={X(xs[i]!)} cy={Y(r.F)} r={3.4} fill="#b42318" />)}
        <text x={370} y={148} fontSize={11} textAnchor="end" fill="#4d5768">1/r² (m⁻²)</text>
        <text x={42} y={16} fontSize={11} fill="#4d5768">force F (N)</text>
        <text x={40} y={160} fontSize={10.5} fill="#7c8595">Line: F = (k q₁q₂) × (1/r²). Dots: your readings.</text>
      </svg>
      <p className="text-[15px] text-ink">
        The dots lie on a straight line through the origin: <em>the force is proportional to 1/r²</em>. The slope is kq₁q₂, which gives <strong className="num">k = {sci(k, 2)} N m² C⁻²</strong> ({Math.abs(err) < 0.05 ? 'matching' : `${err > 0 ? '+' : ''}${err.toFixed(1)} % from`} the accepted 8.99 × 10⁹).
      </p>
    </div>
  );
}

const centre = (c: Charge[]) => ({ x: c.reduce((t, a) => t + a.x, 0) / c.length, y: c.reduce((t, a) => t + a.y, 0) / c.length });

export function EFieldLabPage() {
  const { lessonId, back } = useLabOrigin();
  const narrow = useNarrow();
  const world = narrow ? WORLD_NARROW : WORLD;
  const [charges, setCharges] = useState<Charge[]>(() => clone(START.charges));
  const [probe, setProbe] = useState<Vec>({ ...START.probe });
  const [sel, setSel] = useState<number | null>(1);
  // The student's own range for the size of a charge; the lab's range is -10 to +10 µC.
  const Q_DESIGN: Range = { min: -10, max: 10 };
  const [qRange, setQRange] = useState<Range>(Q_DESIGN);
  const qStep = stepFor(0.5, qRange);
  const [showLines, setShowLines] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [showForces, setShowForces] = useState(true);
  const nextId = useRef(10);
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});

  // opened from a lesson card: start at the top of the lab, not part-way down
  useScrollTopOnOpen();

  // keep everything inside the window when it changes shape (phone <-> desktop)
  useEffect(() => {
    setCharges((cs) => (cs.some((c) => c.y > world.h - 2) ? cs.map((c) => ({ ...c, y: Math.min(c.y, world.h - 2) })) : cs));
    setProbe((p) => (p.y > world.h - 2 ? { ...p, y: world.h - 2 } : p));
  }, [world.h]);

  const setScenario = (s: Scenario) => { setCharges(clone(s.charges)); setProbe({ ...s.probe }); setSel(s.charges[0]?.id ?? null); };
  const move = (id: number, p: Vec) => setCharges((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const change = (id: number, dq: number) => setCharges((cs) => cs.map((c) => {
    if (c.id !== id) return c;
    let q = Number((Math.round((c.q + dq) / qStep) * qStep).toPrecision(10));
    if (q === 0) q = dq > 0 ? qStep : -qStep;
    return { ...c, q: clampTo(q, qRange) };
  }));
  const remove = (id: number) => setCharges((cs) => {
    if (cs.length <= 1) return cs;
    const next = cs.filter((c) => c.id !== id);
    setSel(next[0]?.id ?? null);
    return next;
  });
  const add = (sign: 1 | -1) => setCharges((cs) => {
    if (cs.length >= 5) return cs;
    let best = { x: 50, y: world.h / 2 }, bestD = -1;
    for (let y = 8; y < world.h - 6; y += 6) for (let x = 8; x < world.w - 6; x += 6) {
      const d = Math.min(...cs.map((c) => Math.hypot(c.x - x, c.y - y)), Math.hypot(probe.x - x, probe.y - y));
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    const id = nextId.current++;
    setSel(id);
    return [...cs, { id, x: best.x, y: best.y, q: sign * 2 }];
  });
  const preset = (name: 'opposite' | 'like' | 'dipole' | 'three') => {
    setQRange(Q_DESIGN);
    const cy = world.h / 2;
    const mk = (list: [number, number, number][]): Charge[] => list.map(([x, y, q], i) => ({ id: nextId.current++, x, y, q }));
    if (name === 'opposite') setScenario({ charges: mk([[35, cy, 3], [65, cy, -3]]), probe: { x: 50, y: cy - 16 } });
    if (name === 'like') setScenario({ charges: mk([[35, cy, 3], [65, cy, 3]]), probe: { x: 50, y: cy - 16 } });
    if (name === 'dipole') setScenario({ charges: mk([[45, cy, 4], [55, cy, -4]]), probe: { x: 80, y: cy } });
    if (name === 'three') setScenario({ charges: mk([[30, cy + 8, 3], [70, cy + 8, 3], [50, cy - 14, -4]]), probe: { x: 50, y: cy + 8 } });
  };

  const sc = charges.find((c) => c.id === sel) ?? null;
  const two = charges.length === 2;
  const r = two ? dist(charges[0]!, charges[1]!) : null;
  const F12 = two ? forceMagnitude(charges[0]!.q, charges[1]!.q, r!) : null;
  const E = fieldAt(probe.x, probe.y, charges);
  const net = charges.reduce((t, c) => t + c.q, 0);
  const isDipole = two && charges[0]!.q === -charges[1]!.q;
  const dip = isDipole ? (() => {
    const d = dist(charges[0]!, charges[1]!);
    const c0 = centre(charges);
    const rp = Math.hypot(probe.x - c0.x, probe.y - c0.y);
    return { q: Math.abs(charges[0]!.q), d, p: dipoleMoment(charges[0]!.q, d), rp, axial: dipoleAxial(charges[0]!.q, d, Math.max(rp, d)), equatorial: dipoleEquatorial(charges[0]!.q, d, Math.max(rp, 0.1)) };
  })() : null;

  const distinct = distinctDistances(rows);
  const canFit = distinct >= 3;
  const last = rows[rows.length - 1];
  const sameRows = last ? rows.filter((x) => x.q1 === last.q1 && x.q2 === last.q2) : [];
  const finished = Object.keys(ans).length === APPLY.length;
  const predDone = Object.keys(tested).length === PREDICTS.length;
  const pending = [
    ...(!predDone ? ['test all four predictions'] : []),
    ...(!canFit ? ['record at least three readings at different distances, with the same two charges, in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, predDone, predDone, rows.length >= 3, canFit, true, finished];

  const choosePredict = (i: number) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setPi(i); setScenario(p.base); };
  const record = () => {
    if (!two) return;
    const a = charges[0]!, b = charges[1]!;
    const row: Reading = { r: dist(a, b), q1: a.q, q2: b.q, F: forceMagnitude(a.q, b.q, dist(a, b)) };
    if (rows.some((x) => x.q1 === row.q1 && x.q2 === row.q2 && x.r.toFixed(2) === row.r.toFixed(2))) return;
    setRows((x) => [...x, row]);
  };
  const reset = () => { setQRange(Q_DESIGN); setScenario(START); };
  void centre;

  return (
    <div data-efield-lab>
      <PageHeader
        back={back}
        title="Electric Field Lab: Coulomb’s law and field lines"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Physics · Electrostatics <Badge tone="amber">Draft – unverified</Badge></span>}
      />
      <StepNav step={step} seen={seen} done={done} go={go} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <Canvas charges={charges} probe={probe} sel={sel} onSelect={setSel} onMove={move} onProbe={setProbe} onChange={change} onRemove={remove} showLines={showLines} showMap={showMap} showForces={showForces} narrow={narrow} />
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2" role="group" aria-label="Add or remove charges">
                <button type="button" className={btn} onClick={() => add(1)} disabled={charges.length >= 5} data-add-pos><Plus aria-hidden className="size-4" />Add + charge</button>
                <button type="button" className={btn} onClick={() => add(-1)} disabled={charges.length >= 5} data-add-neg><Minus aria-hidden className="size-4" />Add − charge</button>
                <button type="button" className={btn} onClick={() => sc && remove(sc.id)} disabled={!sc || charges.length <= 1}><Trash2 aria-hidden className="size-4" />Remove selected</button>
                <button type="button" className={btn} onClick={reset}><RotateCcw aria-hidden className="size-4" />Reset</button>
              </div>
              <div className="sm:col-span-2">
                <RangeSlider id="ef-q" label={sc ? `Selected charge (${charges.findIndex((c) => c.id === sc.id) + 1}) size` : 'Select a charge to change its size'} unit="µC" value={sc ? sc.q : 0} min={qRange.min} max={qRange.max} step={qStep} shown={sc ? (sc.q > 0 ? '+' : '−') + trim(Math.abs(sc.q)) : '—'} design={Q_DESIGN} range={qRange} onRange={(r) => { setQRange(r); setCharges((cs) => cs.map((c) => { const q = clampTo(c.q, r); return { ...c, q: q === 0 ? (r.max > 0 ? Math.min(stepFor(0.5, r), r.max) : r.max) : q }; })); }} onChange={(v) => sc && change(sc.id, v - sc.q || (sc.q > 0 ? -0.5 : 0.5))} />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="group" aria-label="Presets">
                <span className="text-sm text-ink-2">Presets:</span>
                {([['opposite', 'Opposite charges'], ['like', 'Like charges'], ['dipole', 'Dipole'], ['three', 'Three charges']] as const).map(([k, l]) => (
                  <button key={k} type="button" className={btn} onClick={() => preset(k)} data-preset={k}>{l}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                {([['Field lines', showLines, setShowLines], ['Field arrows map', showMap, setShowMap], ['Force arrows', showForces, setShowForces]] as const).map(([l, v, set]) => (
                  <label key={l} className="inline-flex items-center gap-1.5 text-sm text-ink"><input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />{l}</label>
                ))}
              </div>
              <p className="text-xs text-ink-3 sm:col-span-2">Drag a charge or the green probe (or focus one and use the arrow keys; + and − change a charge, Delete removes it). Red is positive, blue is negative. Lines run from + to −, and their number is proportional to the charge. Amber arrows are the Coulomb forces. Units: charges in µC, distances in cm; forces in N, fields in N/C.</p>
            </div>
          </div>

          <div className={`${panel} p-3`} aria-live="polite" data-readout>
            <h3 className="text-sm font-semibold text-ink">Measured now</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
              {([
                ['Charges', `${charges.length} · net ${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)} µC`],
                ['Distance between 1 and 2, r', r === null ? '—' : `${r.toFixed(1)} cm`],
                ['Force between 1 and 2, F', F12 === null ? 'use two charges' : fN(F12)],
                ['Kind of force', !two ? '—' : charges[0]!.q * charges[1]!.q > 0 ? 'repulsion' : 'attraction'],
                ['Force on the selected charge', sc ? fN(forceOn(charges.findIndex((c) => c.id === sc.id), charges).mag) : '—'],
                ['Probe field, |E|', `${E.mag < 1 ? '0' : sci(E.mag)} N/C`],
                ['Probe field, components', `(${E.ex < 1 && E.ex > -1 ? '0' : sci(E.ex, 1)}, ${E.ey < 1 && E.ey > -1 ? '0' : sci(E.ey, 1)})`],
                ['Probe field, direction', E.mag < 1 ? '—' : `${((Math.atan2(-E.ey, E.ex) * 180) / Math.PI).toFixed(0)}° from +x`],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-rule py-1"><dt className="text-ink-2">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
              ))}
            </dl>
            {two && <p className="mt-2 text-xs text-ink-3" data-third-law>Newton’s third law: the force on charge 1 is equal and opposite to the force on charge 2 (both {F12 === null ? '' : fN(F12)}).</p>}
            {dip && (
              <div className="mt-2 rounded-md bg-ink/5 p-2 text-sm" data-dipole>
                <strong>Dipole.</strong> p = q d = {dip.q} µC × {dip.d.toFixed(1)} cm = <span className="num">{sci(dip.p, 2)} C m</span> (from − to +). At the probe’s distance ({dip.rp.toFixed(1)} cm from the centre): on-axis field <span className="num">{sci(dip.axial, 2)} N/C</span>, equatorial field <span className="num">{sci(dip.equatorial, 2)} N/C</span>; the axial value is about twice the equatorial one when r is large.
              </div>
            )}
          </div>
          {two && (
            <div className={`${panel} p-3`}>
              <h3 className="text-sm font-semibold text-ink">Force against distance for charges 1 and 2</h3>
              <ForceGraph q1={charges[0]!.q} q2={charges[1]!.q} r={r!} />
              <p className="text-xs text-ink-3">On this log–log graph, F ∝ 1/r² is a straight line of slope −2. The dot is where your charges are now.</p>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">Electric charges push and pull each other, and each charge fills the space around it with an electric field. Play with the charges for a minute.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Drag the + charge towards the − charge. Watch the force arrows and the number change.</li>
                <li>Click “Like charges”. Where do the field lines go? Drag the probe to the middle: what is the field there?</li>
                <li>Switch on the field arrows map and try “Dipole”.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choosePredict} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setScenario(p.test); setTested((x) => ({ ...x, [p.id]: true })); }}
              explain={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; return p.why({ base: p.base, test: p.test }); }}
              onNext={() => choosePredict(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Make two like charges, then two unlike charges. Which way does each force arrow point?</li>
                <li>Double one charge’s size with the slider. What happens to both forces?</li>
                <li>Bring the charges to half the distance. By what factor does the force grow?</li>
                <li>Add a third charge. The force on each is the vector sum of the forces from the others.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Use exactly two charges and keep their sizes fixed. Drag them to at least three different distances and record the force each time.</p>
              <button type="button" className={btnMain} onClick={record} disabled={!two} data-record>Record reading</button>
              {!two && <p className="text-sm text-wrong">Use exactly two charges for this measurement (now {charges.length}).</p>}
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">r (cm)</th><th className="pr-2">q₁ (µC)</th><th className="pr-2">q₂ (µC)</th><th className="pr-2">F (N)</th><th>1/r² (m⁻²)</th></tr></thead>
                    <tbody className="num">{rows.map((x, i) => <tr key={i} className="border-t border-rule"><td className="py-1 pr-2">{x.r.toFixed(1)}</td><td className="pr-2">{x.q1}</td><td className="pr-2">{x.q2}</td><td className="pr-2">{x.F.toFixed(2)}</td><td>{(1 / (x.r * 0.01) ** 2).toFixed(0)}</td></tr>)}</tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>Clear table</button>
                </div>
              )}
              {rows.length >= 3 && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my readings</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canFit ? <FitGraph rows={sameRows} /> : <p className="text-[15px] text-ink">Record at least three readings at different distances, with the same two charges, in the Measure step first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>Coulomb’s law: <span className="num">F = k q₁q₂ / r²</span>. The force is proportional to each charge and to 1/r². Your graph of F against 1/r² was a straight line, and its slope gave k.</li>
                <li>Like charges repel; unlike charges attract. The two forces are equal and opposite.</li>
                <li>With more than two charges, the force on one is the vector sum of the forces from the others (superposition). The same holds for the field: <span className="num">E = Σ kq/r²</span>.</li>
                <li>Field lines start on + charges and end on − charges; they never cross; the more lines, the larger the charge. Between two equal like charges there is a neutral point where E = 0.</li>
                <li>A dipole has p = q d. On its axis E ≈ 2kp/r³; on its equator E ≈ kp/r³ in the opposite direction.</li>
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
