/**
 * Chapter lab: Mathematics (319), "Calculus: second derivatives, monotonic functions and maxima-minima", section "Maxima and minima".
 * Model: f(x) = a x^3 + b x^2 + c x + 1 with a > 0. f' = 3a x^2 + 2b x + c, f'' = 6a x + 2b.
 * Critical points: f' = 0. Second derivative test: f'' < 0 local maximum, f'' > 0 local minimum.
 * f increases where f' > 0 and decreases where f' < 0. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const f = (a: number, b: number, c: number, d: number, x: number) => ((a * x + b) * x + c) * x + d;
const f1 = (a: number, b: number, c: number, x: number) => 3 * a * x * x + 2 * b * x + c;
const f2 = (a: number, b: number, x: number) => 6 * a * x + 2 * b;
const disc = (a: number, b: number, c: number) => 4 * b * b - 12 * a * c;
/** critical points [smaller, larger] when there are two (a > 0): the smaller is the local maximum */
const crit = (a: number, b: number, c: number): [number, number] | null => {
  const D = disc(a, b, c);
  return D > 1e-9 ? [(-2 * b - Math.sqrt(D)) / (6 * a), (-2 * b + Math.sqrt(D)) / (6 * a)] : null;
};
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const sgn = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1);
const X0 = -2, X1 = 6;
const PX = (x: number) => 20 + ((x - X0) / (X1 - X0)) * 360;

export const spec: Spec = {
  id: 'math-cubic-extrema',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Calculus: second derivatives',
  afterHeading: 'Maxima and minima',
  title: 'Cubic, Slope and Turning Points Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Shape a cubic f(x) = ax³ + bx² + cx + 1 with three sliders, drag a tangent along it, and watch f′ and f″ decide where the curve rises, falls, and turns at a maximum or minimum.',
  can: ['Find the critical points where f′ = 0 and classify them with the sign of f″', 'See the curve rise where f′ > 0 and fall where f′ < 0', 'Record f″ at three points and read a and b from a straight line'],
  minutes: 12,
  vars: [
    { id: 'a', label: 'Coefficient a of x³', unit: '', min: 0.5, max: 3, step: 0.5, start: 2, digits: 1 },
    { id: 'b', label: 'Coefficient b of x²', unit: '', min: -20, max: 5, step: 1, start: -15, digits: 0 },
    { id: 'c', label: 'Coefficient c of x', unit: '', min: -10, max: 60, step: 1, start: 36, digits: 0 },
    { id: 'x0', label: 'Tangent point x', unit: '', min: -2, max: 6, step: 0.25, start: 2.5, digits: 2 },
  ],
  outs: [
    { id: 'fx', label: 'f(x) at the tangent point', unit: '', fn: (v) => f(v.a!, v.b!, v.c!, 1, v.x0!), digits: 2 },
    { id: 'd1', label: 'Slope f′(x) = 3ax² + 2bx + c', unit: '', fn: (v) => f1(v.a!, v.b!, v.c!, v.x0!), digits: 2 },
    { id: 'd2', label: 'Second derivative f″(x) = 6ax + 2b', unit: '', fn: (v) => f2(v.a!, v.b!, v.x0!), digits: 2 },
    { id: 'ncrit', label: 'Number of critical points (f′ = 0)', unit: '', fn: (v) => { const D = disc(v.a!, v.b!, v.c!); return D > 1e-9 ? 2 : Math.abs(D) <= 1e-9 ? 1 : 0; }, digits: 0 },
    { id: 'fmax', label: 'Local maximum value (0 if none)', unit: '', fn: (v) => { const c = crit(v.a!, v.b!, v.c!); return c ? f(v.a!, v.b!, v.c!, 1, c[0]) : 0; }, digits: 2 },
    { id: 'fmin', label: 'Local minimum value (0 if none)', unit: '', fn: (v) => { const c = crit(v.a!, v.b!, v.c!); return c ? f(v.a!, v.b!, v.c!, 1, c[1]) : 0; }, digits: 2 },
  ],
  graphs: [
    { id: 'f-x', title: 'The function f(x)', x: 'x0', y: 'fx' },
    { id: 'd1-x', title: 'The first derivative f′(x)', x: 'x0', y: 'd1' },
    { id: 'd2-x', title: 'The second derivative f″(x)', x: 'x0', y: 'd2' },
  ],
  sceneAlt: 'The graph of the cubic f(x) with the stretches where it rises drawn in green and the stretches where it falls drawn in orange. The two turning points are marked, and a tangent line with its slope sits at the chosen point and moves when you change x.',
  scene: ({ v, o }) => {
    const a = v.a!, b = v.b!, c = v.c!;
    const xs = Array.from({ length: 121 }, (_, i) => X0 + (i * (X1 - X0)) / 120);
    const ys = xs.map((x) => f(a, b, c, 1, x));
    const cr = crit(a, b, c);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (cr) {
      const fm = f(a, b, c, 1, cr[0]), fn = f(a, b, c, 1, cr[1]);
      const span = Math.abs(fm - fn) + 4;
      lo = Math.max(lo, Math.min(fm, fn) - 0.9 * span);
      hi = Math.min(hi, Math.max(fm, fn) + 0.9 * span);
    }
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    const PY = (y: number) => 215 - ((y - lo) / (hi - lo)) * 195;
    const segs: { pts: string; up: boolean }[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const up = f1(a, b, c, (xs[i]! + xs[i + 1]!) / 2) >= 0;
      segs.push({ pts: `${PX(xs[i]!).toFixed(1)},${PY(ys[i]!).toFixed(1)} ${PX(xs[i + 1]!).toFixed(1)},${PY(ys[i + 1]!).toFixed(1)}`, up });
    }
    const m = o.d1!;
    const xt = v.x0!, yt = o.fx!;
    const tx1 = xt - 1.2, tx2 = xt + 1.2;
    return (
      <g fontSize={10} fill="#4d5768">
        <defs>
          <clipPath id="cub-win"><rect x={14} y={8} width={372} height={216} /></clipPath>
        </defs>
        <line x1={14} y1={PY(0)} x2={386} y2={PY(0)} stroke="#c9ced6" />
        <line x1={PX(0)} y1={8} x2={PX(0)} y2={224} stroke="#c9ced6" />
        <g clipPath="url(#cub-win)">
          {segs.map((s, i) => <polyline key={i} points={s.pts} fill="none" stroke={s.up ? '#18443b' : '#c45e42'} strokeWidth={2.4} />)}
          <line x1={PX(tx1)} y1={PY(yt - m * 1.2)} x2={PX(tx2)} y2={PY(yt + m * 1.2)} stroke="#2563a8" strokeWidth={1.8} />
          {cr && <circle cx={PX(cr[0])} cy={PY(f(a, b, c, 1, cr[0]))} r={5} fill="#fff" stroke="#c45e42" strokeWidth={2.2} />}
          {cr && <circle cx={PX(cr[1])} cy={PY(f(a, b, c, 1, cr[1]))} r={5} fill="#fff" stroke="#18443b" strokeWidth={2.2} />}
          <circle cx={PX(xt)} cy={PY(yt)} r={4.5} fill="#2563a8" stroke="#fff" strokeWidth={1.5} />
        </g>
        <text x={18} y={20} fontSize={11} fill="#18443b">green: f′ &gt; 0, rising · orange: f′ &lt; 0, falling</text>
        <text x={18} y={34} fontSize={11}>tangent at x = {fmt(xt, 2)}: slope f′ = {fmt(m, 2)}, f″ = {fmt(o.d2!, 2)}</text>
        <text x={382} y={220} textAnchor="end">{cr ? 'ringed points: local maximum (orange) and local minimum (green)' : 'no critical points: f is monotonic'}</text>
      </g>
    );
  },
  discover: [
    'Drag the tangent point x along the curve. The blue tangent tilts: read the slope f′ and watch where it is zero.',
    'The curve turns green where f′ is positive and orange where it is negative. What happens to the colour at a turning point?',
    'Read f″ at a turning point on each side: how is its sign linked to a maximum or a minimum?',
  ],
  experiment: [
    'Put the tangent at each ringed turning point in turn: the slope should be 0 and f″ should be negative at the maximum, positive at the minimum.',
    'Increase the coefficient c until the two turning points merge and then disappear. What is the number of critical points then?',
    'The f″ graph is a straight line: where does it cross zero, and what does the curve do there?',
  ],
  understand: [
    'f is increasing where f′ ≥ 0 and decreasing where f′ ≤ 0; the critical points f′ = 0 are the boundaries between the intervals.',
    'First derivative test: f′ changing from + to − gives a local maximum, − to + a local minimum, no change of sign gives neither.',
    'Second derivative test: at a critical point f″ < 0 means a local maximum and f″ > 0 a local minimum; f″ = 0 means the test fails.',
    'A local maximum value can be smaller than a local minimum value of the same function; and a cubic may have no critical points at all.',
  ],
  preds: [
    {
      id: 'p1', title: 'Between the critical points', prompt: 'For f(x) = 2x³ − 15x² + 36x + 1 the slope at x = 1 is f′ = 12 (rising). The tangent point is moved to x = 2.5, between the critical points x = 2 and x = 3. What is the curve doing there?',
      base: { a: 2, b: -15, c: 36, x0: 1 }, test: { x0: 2.5 }, options: ['Still increasing', 'Decreasing (f′ < 0)', 'Flat (f′ = 0)', 'f′ does not exist'], answer: 1,
      verify: ({ test, outs }) => { const s = sgn(outs(test).d1!); return s > 0 ? 0 : s < 0 ? 1 : 2; },
      why: ({ base, test, outs }) => `f′(x) = 6(x − 2)(x − 3) is negative between 2 and 3. The slope goes from ${fmt(outs(base).d1!, 1)} at x = 1 to ${fmt(outs(test).d1!, 2)} at x = 2.5, so f is decreasing on (2, 3).`,
    },
    {
      id: 'p2', title: 'The second critical point', prompt: 'For the same cubic, f″(2) = −6 (local maximum). The tangent point moves to the other critical point x = 3, where f′ = 0 again. What does the sign of f″ show there?',
      base: { a: 2, b: -15, c: 36, x0: 2 }, test: { x0: 3 }, options: ['f″ < 0: a local maximum again', 'f″ > 0: a local minimum', 'f″ = 0: the test fails', 'f′ is not zero there'], answer: 1,
      verify: ({ test, outs }) => { const o = outs(test); if (Math.abs(o.d1!) > 1e-9) return 3; const s = sgn(o.d2!); return s < 0 ? 0 : s > 0 ? 1 : 2; },
      why: ({ base, test, outs }) => `f″(x) = 12x − 30. At x = 2 it is ${fmt(outs(base).d2!, 0)} (maximum, value f = ${fmt(outs(base).fx!, 0)}); at x = 3 it is ${fmt(outs(test).d2!, 0)} > 0 with f′ = ${fmt(outs(test).d1!, 0)}, so x = 3 is a local minimum with f = ${fmt(outs(test).fx!, 0)}. The maximum value 29 is larger than the minimum value 28 here.`,
    },
    {
      id: 'p3', title: 'Raise the coefficient c', prompt: 'The cubic has two critical points (c = 36). The coefficient c is raised to 60 (a = 2, b = −15). How many critical points are there now?',
      base: { a: 2, b: -15, c: 36, x0: 2.5 }, test: { c: 60 }, options: ['Still two', 'None: f is increasing everywhere', 'Exactly one', 'Three'], answer: 1,
      verify: ({ test, outs }) => { const n = outs(test).ncrit!; return n === 2 ? 0 : n === 0 ? 1 : n === 1 ? 2 : 3; },
      why: ({ base, test, outs }) => `f′ = 6x² − 30x + c has discriminant 900 − 24c, which is negative for c = 60, so f′ is never zero. The count goes from ${fmt(outs(base).ncrit!, 0)} to ${fmt(outs(test).ncrit!, 0)}: f′ > 0 everywhere and f is increasing on the whole line.`,
    },
    {
      id: 'p4', title: 'A larger a', prompt: 'With b = −15 the second derivative at x = 3 is f″ = 18a − 30. When a is raised from 1 to 3, what happens to f″ at x = 3?',
      base: { a: 1, b: -15, c: 36, x0: 3 }, test: { a: 3 }, options: ['It changes from negative to positive', 'It stays negative', 'It becomes 0', 'It doubles and stays negative'], answer: 0,
      verify: ({ base, test, outs }) => { const b = outs(base).d2!, t = outs(test).d2!; return b < 0 && t > 0 ? 0 : b < 0 && t < 0 ? (Math.abs(t / b - 2) < 1e-9 ? 3 : 1) : 2; },
      why: ({ base, test, outs }) => `f″(3) = 6a·3 + 2b = 18a − 30. It goes from ${fmt(outs(base).d2!, 0)} (curve bending downward) to ${fmt(outs(test).d2!, 0)} (bending upward): the sign of f″ decides whether a critical point there would be a maximum or a minimum.`,
    },
  ],
  measure: {
    instruction: 'Keep a, b and c fixed. Record the second derivative f″(x) for at least three different positions of the tangent point x.',
    vary: 'x0',
    record: ['d1', 'd2'],
    fit: {
      xLabel: 'x',
      yLabel: 'f″(x)',
      x: (v) => v.x0!,
      y: (_v, o) => o.d2!,
      interpret: (slope, intercept, v) => `f″(x) against x is a straight line, because f″ = 6ax + 2b. The slope ${fmt(slope, 2)} is 6a, so a = ${fmt(slope / 6, 2)}; the intercept ${fmt(intercept, 2)} is 2b, so b = ${fmt(intercept / 2, 2)} (you set a = ${v.a!}, b = ${v.b!}). The line crosses zero at x = −b/(3a), where the bending changes direction.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The local maximum value of f(x) = x³ − 3x is', options: ['2', '−2', '0', '1'], answer: 0,
      why: 'f′ = 3x² − 3 = 0 gives x = ±1 and f″ = 6x. At x = −1, f″ = −6 < 0, a local maximum, and f(−1) = −1 + 3 = 2.',
      verify: () => { const c = crit(1, 0, -3)!; return near(f(1, 0, -3, 0, c[0]), [2, -2, 0, 1]); },
    },
    {
      id: 'q2', q: 'The local minimum value of f(x) = 2x³ − 15x² + 36x + 1 is', options: ['29', '27', '28', '26'], answer: 2,
      why: 'f′ = 6(x − 2)(x − 3) = 0 gives x = 2, 3 and f″ = 12x − 30. f″(3) = 6 > 0, so the local minimum is f(3) = 54 − 135 + 108 + 1 = 28 (the local maximum is f(2) = 29).',
      verify: () => { const c = crit(2, -15, 36)!; return near(f(2, -15, 36, 1, c[1]), [29, 27, 28, 26]); },
    },
    {
      id: 'q3', q: 'The function f(x) = 2x³ − 9x² + 12x + 5 is decreasing in the interval', options: ['(−∞, 1)', '(1, 2)', '(2, ∞)', '(0, 3)'], answer: 1,
      why: 'f′ = 6x² − 18x + 12 = 6(x − 1)(x − 2), which is negative only for 1 < x < 2. So f is increasing on (−∞, 1) and (2, ∞) and decreasing on (1, 2).',
      verify: () => {
        const fp = (x: number) => f1(2, -9, 12, x);
        const cands: [number, number][] = [[-5, 0.9], [1.1, 1.9], [2.1, 6], [0.1, 2.9]];
        return cands.findIndex(([lo, hi]) => [0, 0.25, 0.5, 0.75, 1].every((t) => fp(lo + t * (hi - lo)) < 0));
      },
    },
    {
      id: 'q4', q: 'The function f(x) = x³ − 3x² + 3x − 5 has how many local maxima or minima?', options: ['1', '2', '0', '3'], answer: 2,
      why: 'f′ = 3x² − 6x + 3 = 3(x − 1)² ≥ 0 for all x and it is zero only at x = 1, where it does not change sign. f is increasing on the whole real line, so there is no local maximum or minimum.',
      verify: () => { const c = crit(1, -3, 3); return c ? (c.length === 2 ? 1 : 0) : 2; },
    },
    {
      id: 'q5', q: 'The absolute minimum value of f(x) = x³ − 3x² on the closed interval [−2, 3] is', options: ['−4', '0', '−8', '−20'], answer: 3,
      why: 'f′ = 3x(x − 2), so the critical points are 0 and 2. Compare f(−2) = −20, f(0) = 0, f(2) = −4 and f(3) = 0: the smallest value is −20, at an end point.',
      verify: () => { const g = (x: number) => x ** 3 - 3 * x ** 2; return near(Math.min(g(-2), g(0), g(2), g(3)), [-4, 0, -8, -20]); },
    },
  ],
};
