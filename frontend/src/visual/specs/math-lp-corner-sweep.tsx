/**
 * Chapter lab: Mathematics (319), "Linear programming: graphical method, feasible region and optimal solution",
 * section "Graphical method of solution for problems in two variables".
 * Model: maximise Z = a x + b y subject to 3x + 5y <= R1, 5x + 2y <= R2, x >= 0, y >= 0 (the lesson's worked problem has
 * R1 = 15, R2 = 10, Z = 5x + 3y). Corner points are found by intersecting the boundary lines, keeping the feasible ones, and
 * Z is evaluated at each corner (corner point theorem). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

type Con = [number, number, number]; // a x + b y <= c
type Pt = [number, number];
const vertices = (cons: Con[]): Pt[] => {
  const all: Con[] = [[-1, 0, 0], [0, -1, 0], ...cons];
  const pts: Pt[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const [a1, b1, c1] = all[i]!;
      const [a2, b2, c2] = all[j]!;
      const d = a1 * b2 - a2 * b1;
      if (Math.abs(d) < 1e-12) continue;
      const x = (c1 * b2 - c2 * b1) / d;
      const y = (a1 * c2 - a2 * c1) / d;
      if (all.every(([a, b, c]) => a * x + b * y <= c + 1e-9) && !pts.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-9)) pts.push([x, y]);
    }
  }
  if (pts.length === 0) return pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
};
const best = (pts: Pt[], a: number, b: number) => pts.reduce((m, p) => (a * p[0] + b * p[1] > a * m[0] + b * m[1] + 1e-9 ? p : m), pts[0]!);
const area = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]!; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const model = (R1: number, R2: number, a: number, b: number) => {
  const pts = vertices([[3, 5, R1], [5, 2, R2]]);
  const o = best(pts, a, b);
  return { pts, o, zmax: a * o[0] + b * o[1] };
};
const near = (r: number, vals: number[]) => vals.reduce((bi, x, i) => (Math.abs(r - x) < Math.abs(r - vals[bi]!) ? i : bi), 0);
const XW = 8, YW = 8;
const PX = (x: number) => 40 + (x / XW) * 340;
const PY = (y: number) => 205 - (y / YW) * 185;
const seg = (a: number, b: number, c: number) => {
  // a x + b y = c, extended far on both sides
  const n = a * a + b * b;
  const px = (a * c) / n, py = (b * c) / n;
  const t = 40;
  return { x1: PX(px - b * t), y1: PY(py + a * t), x2: PX(px + b * t), y2: PY(py - a * t) };
};

export const spec: Spec = {
  id: 'math-lp-corner-sweep',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Linear programming: graphical method',
  afterHeading: 'Graphical method of solution for problems in two variables',
  title: 'Feasible Region and Corner Points Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Move two constraint lines and the objective Z = ax + by. See the feasible polygon, its corner points and the value of Z at each, and sweep the Z-line to the last corner it touches.',
  can: ['Watch the feasible region change shape as the constraint limits move', 'Evaluate Z at every corner and find the optimal corner', 'Record the maximum of Z for three values of a and read the optimal x from the slope'],
  minutes: 13,
  vars: [
    { id: 'R1', label: 'Limit R₁ in 3x + 5y ≤ R₁', unit: '', min: 6, max: 30, step: 1, start: 15, digits: 0 },
    { id: 'R2', label: 'Limit R₂ in 5x + 2y ≤ R₂', unit: '', min: 4, max: 20, step: 1, start: 10, digits: 0 },
    { id: 'a', label: 'Objective coefficient a in Z = ax + by', unit: '', min: 1, max: 8, step: 1, start: 5, digits: 0 },
    { id: 'b', label: 'Objective coefficient b', unit: '', min: 1, max: 8, step: 1, start: 3, digits: 0 },
    { id: 'z', label: 'Level of the sweeping Z-line, Z =', unit: '', min: 0, max: 60, step: 1, start: 8, digits: 0 },
  ],
  outs: [
    { id: 'zmax', label: 'Maximum Z (largest value at a corner)', unit: '', fn: (v) => model(v.R1!, v.R2!, v.a!, v.b!).zmax, digits: 2 },
    { id: 'xo', label: 'Optimal x', unit: '', fn: (v) => model(v.R1!, v.R2!, v.a!, v.b!).o[0], digits: 3 },
    { id: 'yo', label: 'Optimal y', unit: '', fn: (v) => model(v.R1!, v.R2!, v.a!, v.b!).o[1], digits: 3 },
    { id: 'nc', label: 'Number of corner points', unit: '', fn: (v) => model(v.R1!, v.R2!, v.a!, v.b!).pts.length, digits: 0 },
    { id: 'area', label: 'Area of the feasible region', unit: 'sq. units', fn: (v) => area(model(v.R1!, v.R2!, v.a!, v.b!).pts), digits: 2 },
    { id: 'gap', label: 'Zmax − (level of the Z-line); negative: the line is past the region', unit: '', fn: (v) => model(v.R1!, v.R2!, v.a!, v.b!).zmax - v.z!, digits: 2 },
  ],
  graphs: [
    { id: 'zmax-a', title: 'Maximum Z against the coefficient a', x: 'a', y: 'zmax' },
    { id: 'zmax-r2', title: 'Maximum Z against the limit R₂', x: 'R2', y: 'zmax' },
    { id: 'area-r1', title: 'Feasible area against the limit R₁', x: 'R1', y: 'area' },
  ],
  sceneAlt: 'A coordinate grid with the feasible region as a green polygon bounded by the axes and two constraint lines, its corner points marked with the value of Z there, a dashed Z-line that slides with the chosen level, and the optimal corner ringed. The polygon reshapes as the limits move.',
  scene: ({ v, o }) => {
    const m = model(v.R1!, v.R2!, v.a!, v.b!);
    const l1 = seg(3, 5, v.R1!);
    const l2 = seg(5, 2, v.R2!);
    const lz = seg(v.a!, v.b!, v.z!);
    const touches = v.z! <= m.zmax + 1e-9;
    return (
      <g fontSize={10} fill="#4d5768">
        <defs>
          <clipPath id="lp-win"><rect x={40} y={20} width={340} height={185} /></clipPath>
        </defs>
        <rect x={40} y={20} width={340} height={185} fill="#fff" stroke="#e5e5e5" />
        <g clipPath="url(#lp-win)">
          <polygon points={m.pts.map(([x, y]) => `${PX(x)},${PY(y)}`).join(' ')} fill="#18443b" fillOpacity={0.2} stroke="#18443b" strokeWidth={1.5} />
          <line {...l1} stroke="#2563a8" strokeWidth={1.6} />
          <line {...l2} stroke="#c45e42" strokeWidth={1.6} />
          <line {...lz} stroke={touches ? '#18443b' : '#7c8595'} strokeWidth={2} strokeDasharray="6 4" />
        </g>
        {m.pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={PX(x)} cy={PY(y)} r={3.5} fill="#18443b" />
            <text x={PX(x) + 6} y={PY(y) - 5} fontSize={9}>Z={fmt(v.a! * x + v.b! * y, 1)}</text>
          </g>
        ))}
        <circle cx={PX(m.o[0])} cy={PY(m.o[1])} r={8} fill="none" stroke="#c45e42" strokeWidth={2.4} />
        <text x={42} y={14} fontSize={11}><tspan fill="#2563a8">3x + 5y ≤ {v.R1}</tspan> · <tspan fill="#c45e42">5x + 2y ≤ {v.R2}</tspan> · dashed: {v.a}x + {v.b}y = {v.z}</text>
        <text x={42} y={218}>ringed corner: maximum Z = {fmt(o.zmax!, 2)} at ({fmt(o.xo!, 2)}, {fmt(o.yo!, 2)}) · x from 0 to 8, y from 0 to 8</text>
      </g>
    );
  },
  discover: [
    'The green polygon is the feasible region. Move the limits R₁ and R₂ and watch the corner points move; count them.',
    'Every corner shows the value of Z there. Which corner has the largest value, and is it the ringed one?',
    'Slide the level of the Z-line upward. Where is the last point of the region it touches?',
  ],
  experiment: [
    'Set the level of the Z-line to the maximum Z. Does the dashed line just touch the polygon at the ringed corner?',
    'Change a and b: the optimum can jump from one corner to another. Find a change of the objective that does this.',
    'Raise R₁ to its largest value. What happens to the number of corner points, and why?',
  ],
  understand: [
    'Each inequality ax + by ≤ c describes a half-plane; the feasible region is the common part of all the half-planes with x ≥ 0 and y ≥ 0, and it is convex.',
    'Corner point theorem: for a bounded feasible region Z = ax + by has a maximum and a minimum, and each occurs at a corner point, so evaluate Z at every corner and compare.',
    'Sliding the Z-line in the direction in which Z grows, the last point of the region it touches is the optimum; if the Z-line is parallel to a boundary line, a whole edge is optimal.',
    'A constraint that does not cut the region (it lies outside the others) is redundant and adds no corner.',
  ],
  preds: [
    {
      id: 'p1', title: 'Change the objective', prompt: 'For Z = 5x + 3y the best corner of the region is the intersection of the two lines, (1.05, 2.37). The objective is changed to Z = x + 3y. Where is the best corner now?',
      base: { R1: 15, R2: 10, a: 5, b: 3 }, test: { a: 1 }, options: ['Still the intersection of the two lines', 'The corner (0, 3) on the y-axis', 'The corner (2, 0) on the x-axis', 'The origin'], answer: 1,
      verify: ({ test, outs }) => { const o = outs(test); const at = (x: number, y: number) => Math.abs(o.xo! - x) < 1e-9 && Math.abs(o.yo! - y) < 1e-9; return at(0, 3) ? 1 : at(2, 0) ? 2 : at(0, 0) ? 3 : 0; },
      why: ({ base, test, outs }) => `Z = x + 3y has the values 0, 2, 8.16 and 9 at the corners (0, 0), (2, 0), (1.05, 2.37) and (0, 3), so the maximum moves to (0, 3), Z = ${fmt(outs(test).zmax!, 0)} (before: Z = ${fmt(outs(base).zmax!, 2)} at the intersection).`,
    },
    {
      id: 'p2', title: 'Tighten a constraint', prompt: 'The limit R₁ in 3x + 5y ≤ R₁ is lowered from 15 to 6 (Z = 5x + 3y). What happens to the maximum value of Z?',
      base: { R1: 15, R2: 10, a: 5, b: 3 }, test: { R1: 6 }, options: ['It rises', 'It falls', 'It stays the same', 'It becomes 0'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).zmax! > outs(base).zmax! + 1e-9 ? 0 : outs(test).zmax! < outs(base).zmax! - 1e-9 ? 1 : 2),
      why: ({ base, test, outs }) => `A smaller limit shrinks the feasible region (area ${fmt(outs(base).area!, 2)} to ${fmt(outs(test).area!, 2)}), so the best Z cannot rise: it goes from ${fmt(outs(base).zmax!, 2)} to ${fmt(outs(test).zmax!, 2)}.`,
    },
    {
      id: 'p3', title: 'The sweeping Z-line', prompt: 'The maximum of Z = 5x + 3y is 12.37. The Z-line is moved from level Z = 8 to level Z = 15. Does it still touch the feasible region?',
      base: { R1: 15, R2: 10, a: 5, b: 3, z: 8 }, test: { z: 15 }, options: ['Yes, it still crosses the region', 'No: it lies completely beyond the region', 'It touches the region only at the origin', 'It touches the region exactly at the optimum'], answer: 1,
      verify: ({ test, outs }) => { const g = outs(test).gap!; return Math.abs(g) < 1e-9 ? 3 : g < 0 ? 1 : 0; },
      why: ({ base, test, outs }) => `The line Z = 15 is above the largest value of Z on the region (gap ${fmt(outs(test).gap!, 2)}), so it misses the polygon. At Z = 8 the gap was ${fmt(outs(base).gap!, 2)} > 0 and the line crossed it.`,
    },
    {
      id: 'p4', title: 'A redundant constraint', prompt: 'The region has 4 corner points. The limit R₁ is raised from 15 to 30, so the line 3x + 5y = 30 moves far away. How many corner points does the feasible region have now?',
      base: { R1: 15, R2: 10, a: 5, b: 3 }, test: { R1: 30 }, options: ['Still 4', '3: the first constraint no longer touches the region', '5', '2'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).nc!, [4, 3, 5, 2]),
      why: ({ base, test, outs }) => `With R₁ = 30 the region is the triangle (0, 0), (2, 0), (0, 5) cut only by 5x + 2y ≤ 10: the first constraint is redundant. The corner count goes from ${fmt(outs(base).nc!, 0)} to ${fmt(outs(test).nc!, 0)}.`,
    },
  ],
  measure: {
    instruction: 'Keep the constraints and b fixed. Record the maximum value of Z for at least three different values of a (the best corner should stay the same).',
    vary: 'a',
    record: ['zmax', 'xo', 'yo'],
    fit: {
      xLabel: 'coefficient a',
      yLabel: 'maximum Z',
      x: (v) => v.a!,
      y: (_v, o) => o.zmax!,
      interpret: (slope, intercept, v) => `While the best corner stays the same, Zmax = a·x* + b·y* is a straight line in a. The slope ${fmt(slope, 3)} is the x-coordinate of the optimal corner, and the intercept ${fmt(intercept, 2)} is b·y*, which gives y* = ${fmt(intercept / v.b!, 3)}. If your readings bend, the best corner changed between two of them.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Maximise Z = 3x + 4y subject to x + y ≤ 4, x ≥ 0, y ≥ 0. The maximum value of Z is', options: ['12', '16', '14', '20'], answer: 1,
      why: 'The feasible region is the triangle with corners (0, 0), (4, 0) and (0, 4). Z = 0, 12 and 16 at these corners, so the maximum is 16 at (0, 4).',
      verify: () => { const p = vertices([[1, 1, 4]]); const o = best(p, 3, 4); return near(3 * o[0] + 4 * o[1], [12, 16, 14, 20]); },
    },
    {
      id: 'q2', q: 'Maximise Z = 5x + 3y subject to 3x + 5y ≤ 15, 5x + 2y ≤ 10, x ≥ 0, y ≥ 0. The maximum value of Z is', options: ['10', '9', '235/19 ≈ 12.37', '15'], answer: 2,
      why: 'The corners are (0, 0), (2, 0), (20/19, 45/19) and (0, 3). Z = 0, 10, 235/19 ≈ 12.37 and 9. The maximum is at the point where the two lines meet.',
      verify: () => near(model(15, 10, 5, 3).zmax, [10, 9, 235 / 19, 15]),
    },
    {
      id: 'q3', q: 'Maximise Z = 2x + 4y subject to x + 2y ≤ 10, x ≥ 0, y ≥ 0. The maximum value of Z is', options: ['20', '10', '40', '5'], answer: 0,
      why: 'The corners are (0, 0), (10, 0) and (0, 5), with Z = 0, 20 and 20. The Z-line 2x + 4y = 20 is parallel to x + 2y = 10, so every point of that edge gives Z = 20 (infinitely many optimal solutions).',
      verify: () => { const p = vertices([[1, 2, 10]]); const o = best(p, 2, 4); return near(2 * o[0] + 4 * o[1], [20, 10, 40, 5]); },
    },
    {
      id: 'q4', q: 'The feasible region of 3x + 5y ≤ 15, 5x + 2y ≤ 10, x ≥ 0, y ≥ 0 has how many corner points?', options: ['3', '5', '6', '4'], answer: 3,
      why: 'The corners are (0, 0), (2, 0), (20/19, 45/19) and (0, 3): four corner points, a quadrilateral.',
      verify: () => near(vertices([[3, 5, 15], [5, 2, 10]]).length, [3, 5, 6, 4]),
    },
    {
      id: 'q5', q: 'Minimise Z = 4x + 3y subject to x + 2y ≥ 10, 3x + 4y ≤ 24, x ≥ 0, y ≥ 0. The minimum value of Z is', options: ['18', '25', '15', '16'], answer: 2,
      why: 'The corners are (0, 5), (0, 6) and (4, 3), with Z = 15, 18 and 25. The region is bounded, so the smallest value 15 at (0, 5) is the minimum.',
      verify: () => { const p = vertices([[-1, -2, -10], [3, 4, 24]]); const o = best(p, -4, -3); return near(4 * o[0] + 3 * o[1], [18, 25, 15, 16]); },
    },
  ],
};
