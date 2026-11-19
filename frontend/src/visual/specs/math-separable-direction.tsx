/**
 * Chapter lab: Mathematics (319), "Differential equations: order, degree and solving by variable separable method",
 * section "Solving of differential equations with variable separable".
 * Model: dy/dx = k x^n y with n = 0 (dy/dx = ky) or n = 1 (dy/dx = kxy). Separating: dy/y = k x^n dx, so
 * log y = k x^(n+1)/(n+1) + c and the particular solution through (x0, y0) is y = y0 exp(k (x^(n+1) - x0^(n+1))/(n+1)).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const g = (n: number, x: number) => Math.pow(x, n + 1) / (n + 1); // antiderivative of x^n (n = 0 or 1)
const yAt = (k: number, y0: number, x0: number, n: number, x: number) => y0 * Math.exp(k * (g(n, x) - g(n, x0)));
const slope = (k: number, n: number, x: number, y: number) => k * (n === 0 ? 1 : x) * y;
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const PX = (x: number) => 210 + 85 * x;
const PY = (y: number) => 210 - (190 / 6) * y;

export const spec: Spec = {
  id: 'math-separable-direction',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Differential equations: order, degree and solving',
  afterHeading: 'Solving of differential equations with variable separable',
  title: 'Separable Equation and Direction Field Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'See dy/dx = ky and dy/dx = kxy as a field of slope marks, pick the starting point of a particular solution, and check that ln y against x is a straight line whose slope is k.',
  can: ['Read the slope marks of dy/dx = f(x)g(y) and see the solution curve follow them', 'Fix the arbitrary constant with an initial condition y(x₀) = y₀', 'Record ln y for three values of x and recover k from the straight line'],
  minutes: 12,
  vars: [
    { id: 'k', label: 'Constant k in dy/dx = k xⁿ y', unit: '', min: -2, max: 2, step: 0.05, start: 1.1, digits: 2 },
    { id: 'y0', label: 'Initial value y₀ = y(x₀)', unit: '', min: 0.5, max: 4, step: 0.5, start: 2, digits: 1 },
    { id: 'x0', label: 'Starting x₀', unit: '', min: -1, max: 1, step: 0.5, start: 0, digits: 1 },
    { id: 'n', label: 'Equation: n = 0 gives dy/dx = ky, n = 1 gives dy/dx = kxy', unit: '', min: 0, max: 1, step: 1, start: 0, digits: 0 },
    { id: 'x', label: 'Where to read the solution, x', unit: '', min: -2, max: 2, step: 0.25, start: 1, digits: 2 },
  ],
  outs: [
    { id: 's0', label: 'Slope at the starting point dy/dx = k x₀ⁿ y₀', unit: '', fn: (v) => slope(v.k!, v.n!, v.x0!, v.y0!), digits: 3 },
    { id: 'A', label: 'Constant A in y = A·exp(k xⁿ⁺¹/(n+1))', unit: '', fn: (v) => v.y0! * Math.exp(-v.k! * g(v.n!, v.x0!)), digits: 3 },
    { id: 'yx', label: 'Solution y(x) of the particular solution', unit: '', fn: (v) => yAt(v.k!, v.y0!, v.x0!, v.n!, v.x!), digits: 3 },
    { id: 'lny', label: 'ln y(x)', unit: '', fn: (v) => Math.log(yAt(v.k!, v.y0!, v.x0!, v.n!, v.x!)), digits: 3 },
    { id: 'sx', label: 'Slope of the solution at x, dy/dx = k xⁿ y', unit: '', fn: (v) => slope(v.k!, v.n!, v.x!, yAt(v.k!, v.y0!, v.x0!, v.n!, v.x!)), digits: 3 },
  ],
  graphs: [
    { id: 'y-x', title: 'The particular solution y(x)', x: 'x', y: 'yx' },
    { id: 'lny-x', title: 'ln y against x', x: 'x', y: 'lny' },
    { id: 'yx-k', title: 'The value y(x) against the constant k', x: 'k', y: 'yx' },
  ],
  sceneAlt: 'A direction field of short grey slope marks for dy/dx = k xⁿ y over the region x from −2 to 2 and y from 0 to 6, with the particular solution curve drawn through the chosen starting point. The marks and the curve change with k, the equation and the starting point, and the curve always runs along the marks.',
  scene: ({ v, o }) => {
    const k = v.k!, n = v.n!;
    const marks: { x: number; y: number; dx: number; dy: number }[] = [];
    for (let i = 0; i <= 16; i++) {
      for (let j = 0; j <= 12; j++) {
        const x = -2 + i * 0.25;
        const y = 0.25 + j * 0.5;
        const s = slope(k, n, x, y);
        const vx = 85, vy = -s * (190 / 6);
        const L = Math.hypot(vx, vy);
        marks.push({ x: PX(x), y: PY(y), dx: (vx / L) * 7, dy: (vy / L) * 7 });
      }
    }
    const curve = Array.from({ length: 81 }, (_, i) => { const x = -2 + (i * 4) / 80; return `${PX(x).toFixed(1)},${PY(yAt(k, v.y0!, v.x0!, n, x)).toFixed(1)}`; }).join(' ');
    return (
      <g fontSize={10} fill="#4d5768">
        <defs>
          <clipPath id="de-win"><rect x={40} y={14} width={340} height={196} /></clipPath>
        </defs>
        <rect x={40} y={14} width={340} height={196} fill="#fff" stroke="#e5e5e5" />
        <line x1={PX(0)} y1={14} x2={PX(0)} y2={210} stroke="#c9ced6" />
        <g clipPath="url(#de-win)">
          {marks.map((m, i) => <line key={i} x1={m.x - m.dx} y1={m.y - m.dy} x2={m.x + m.dx} y2={m.y + m.dy} stroke="#9aa3b2" strokeWidth={1.3} />)}
          <polyline points={curve} fill="none" stroke="#c45e42" strokeWidth={2.6} />
          <circle cx={PX(v.x0!)} cy={PY(v.y0!)} r={5} fill="#18443b" stroke="#fff" strokeWidth={1.5} />
          <circle cx={PX(v.x!)} cy={PY(o.yx!)} r={4.5} fill="#2563a8" stroke="#fff" strokeWidth={1.5} />
        </g>
        <text x={40} y={226}>x = −2</text>
        <text x={380} y={226} textAnchor="end">x = 2</text>
        <text x={36} y={22} textAnchor="end">6</text>
        <text x={36} y={210} textAnchor="end">0</text>
        <text x={44} y={26} fill="#18443b">dy/dx = {fmt(k, 2)}{n === 1 ? ' x' : ''} y · green: y({fmt(v.x0!, 1)}) = {fmt(v.y0!, 1)} · blue: y({fmt(v.x!, 2)}) = {fmt(o.yx!, 2)}</text>
      </g>
    );
  },
  discover: [
    'Each grey mark shows the slope dy/dx that the equation demands at its point. Change k and see the marks tilt.',
    'The orange curve starts at the green dot and follows the marks. Move the starting point and the value y₀: a different curve of the family appears.',
    'Switch n between 0 (dy/dx = ky) and 1 (dy/dx = kxy) and compare the two families.',
  ],
  experiment: [
    'Make k negative: what happens to the curve as x increases? Which marks changed?',
    'With n = 0, increase x in equal steps and read y(x): is it added to, or multiplied by, a fixed factor each step?',
    'Look at the ln y graph: why is it a straight line for n = 0?',
  ],
  understand: [
    'dy/dx = f(x)g(y) is variable separable: write dy/g(y) = f(x) dx, integrate both sides and add one constant C.',
    'For dy/dx = ky the solution is y = Ae^(kx): growth if k > 0, decay if k < 0, and A is the value at x = 0. Equal steps in x multiply y by the same factor.',
    'The general solution of a first order equation has one arbitrary constant (a family of curves); the initial condition y(x₀) = y₀ fixes it and gives a particular solution.',
    'Taking logarithms, ln y = kx + ln A, so ln y against x is a straight line with slope k.',
  ],
  preds: [
    {
      id: 'p1', title: 'Change the sign of k', prompt: 'For dy/dx = ky with y(0) = 2, the solution at x = 1 is about 5.4 when k = 1. The constant is changed to k = −1. What does y do as x increases?',
      base: { k: 1, y0: 2, x0: 0, n: 0, x: 1 }, test: { k: -1 }, options: ['It grows even faster', 'It decays, falling below 2', 'It stays at 2', 'It becomes negative'], answer: 1,
      verify: ({ test, outs }) => { const y = outs(test).yx!; return y < 0 ? 3 : y < 2 - 1e-9 ? 1 : y > 2 + 1e-9 ? 0 : 2; },
      why: ({ base, test, outs }) => `With k < 0 the slope marks point downward and y = Ae^(kx) decays: y(1) goes from ${fmt(outs(base).yx!, 2)} to ${fmt(outs(test).yx!, 2)}. The exponential never becomes negative.`,
    },
    {
      id: 'p2', title: 'Equal steps in x', prompt: 'For dy/dx = ky with k = 1.1, y = 2 at x = 0 and y ≈ 6 at x = 1. What is y at x = 2?',
      base: { k: 1.1, y0: 2, x0: 0, n: 0, x: 1 }, test: { x: 2 }, options: ['About 10 (6 plus the same 4 again)', 'About 18 (6 multiplied by the same factor 3)', 'About 12 (double)', 'About 6 (no change)'], answer: 1,
      verify: ({ base, test, outs }) => { const y1 = outs(base).yx!, y2 = outs(test).yx!; const y0 = 2; const r1 = y1 / y0, r2 = y2 / y1; return Math.abs(r2 - r1) < 0.02 * r1 ? 1 : Math.abs(y2 - y1 - (y1 - y0)) < 0.5 ? 0 : 2; },
      why: ({ base, test, outs }) => `The solution is y = 2e^(1.1x), so each unit step in x multiplies y by e^1.1 ≈ 3: y goes from ${fmt(outs(base).yx!, 2)} to ${fmt(outs(test).yx!, 2)}. This is the lesson's y(0) = 2, y(1) = 6, y(2) = 18.`,
    },
    {
      id: 'p3', title: 'Double the initial value', prompt: 'With dy/dx = ky and k = 1, the initial value is doubled from y(0) = 1 to y(0) = 2. What happens to the solution y(x) at x = 1?',
      base: { k: 1, y0: 1, x0: 0, n: 0, x: 1 }, test: { y0: 2 }, options: ['It doubles', 'It rises by 1', 'It stays the same', 'It is squared'], answer: 0,
      verify: ({ base, test, outs }) => { const r = outs(test).yx! / outs(base).yx!; return Math.abs(r - 2) < 1e-9 ? 0 : Math.abs(outs(test).yx! - outs(base).yx! - 1) < 1e-9 ? 1 : Math.abs(r - 1) < 1e-9 ? 2 : 3; },
      why: ({ base, test, outs }) => `The constant A = y₀ is a multiplier in y = Ae^(kx), so doubling it doubles y at every x: y(1) goes from ${fmt(outs(base).yx!, 2)} to ${fmt(outs(test).yx!, 2)}.`,
    },
    {
      id: 'p4', title: 'From ky to kxy', prompt: 'For dy/dx = ky with k = 1 and y(0) = 2 the slope at the starting point (0, 2) is 2. The equation is changed to dy/dx = kxy (n = 1). What is the slope at (0, 2) now?',
      base: { k: 1, y0: 2, x0: 0, n: 0, x: 1 }, test: { n: 1 }, options: ['0: the curve starts flat', '4: twice as steep', 'Still 2', '−2'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).s0!, [0, 4, 2, -2]),
      why: ({ base, test, outs }) => `The slope is kxy and x = 0 at the starting point, so it is ${fmt(outs(test).s0!, 1)} (it was ${fmt(outs(base).s0!, 1)}). The solution y = Ce^(kx²/2) has a flat start at x = 0 and then curves upward symmetrically.`,
    },
  ],
  measure: {
    instruction: 'Keep k, y₀, x₀ and n fixed. Record ln y(x) for at least three different values of x (the starting point stays on the curve).',
    vary: 'x',
    record: ['yx', 'lny'],
    fit: {
      xLabel: 'xⁿ⁺¹/(n+1)  (this is x for dy/dx = ky)',
      yLabel: 'ln y',
      x: (v) => g(v.n!, v.x!),
      y: (_v, o) => o.lny!,
      interpret: (slope, intercept, v) => `ln y against ${v.n! === 0 ? 'x' : 'x²/2'} is a straight line, because separating dy/y = k xⁿ dx gives ln y = k·xⁿ⁺¹/(n+1) + ln A. The slope ${fmt(slope, 3)} is k (you set k = ${fmt(v.k!, 2)}) and the intercept ${fmt(intercept, 3)} is ln A, so A = ${fmt(Math.exp(intercept), 3)}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Solve dy/dx = 2xy given y = 1 when x = 0. The value of y when x = 1 is', options: ['2', 'e ≈ 2.72', 'e² ≈ 7.39', '1'], answer: 1,
      why: 'Separate: dy/y = 2x dx, so ln y = x² + c. Using y(0) = 1 gives c = 0 and y = e^(x²). At x = 1, y = e.',
      verify: () => near(yAt(2, 1, 0, 1, 1), [2, Math.E, Math.E ** 2, 1]),
    },
    {
      id: 'q2', q: 'A quantity satisfies dy/dx = ky with y = 2 at x = 0 and y = 6 at x = 1. The value of y at x = 2 is', options: ['12', '24', '18', '10'], answer: 2,
      why: 'y = Ae^(kx) with A = 2 and e^k = 3. At x = 2, y = 2(e^k)² = 2 × 9 = 18. Equal steps in x multiply y by the same factor 3.',
      verify: () => { const k = Math.log(6 / 2); return near(yAt(k, 2, 0, 0, 2), [12, 24, 18, 10]); },
    },
    {
      id: 'q3', q: 'The general solution of dy/dx = xy is', options: ['y = Ce^(x²/2)', 'y = C + x²/2', 'y = Ce^x', 'y = Cx²'], answer: 0,
      why: 'Separate: dy/y = x dx, so ln|y| = x²/2 + c and y = Ce^(x²/2). Check: dy/dx = x·Ce^(x²/2) = xy.',
      verify: () => {
        const cands: ((x: number) => number)[] = [(x) => Math.exp((x * x) / 2), (x) => 1 + (x * x) / 2, (x) => Math.exp(x), (x) => x * x];
        const h = 1e-5, x = 1.3;
        return cands.findIndex((f) => Math.abs((f(x + h) - f(x - h)) / (2 * h) - x * f(x)) < 1e-4);
      },
    },
    {
      id: 'q4', q: 'Which of these differential equations is NOT of the variable separable form?', options: ['dy/dx = e^(x+y)', 'dy/dx = x + y', 'dy/dx = xy', 'dy/dx = y/x'], answer: 1,
      why: 'A separable equation has right-hand side f(x)g(y), a product. e^(x+y) = e^x e^y, xy and y/x are products, but x + y cannot be written as a product of a function of x and a function of y.',
      verify: () => {
        const fs: ((x: number, y: number) => number)[] = [(x, y) => Math.exp(x + y), (x, y) => x + y, (x, y) => x * y, (x, y) => y / x];
        const prodRule = (f: (x: number, y: number) => number) => Math.abs(f(1, 1) * f(2, 3) - f(1, 3) * f(2, 1)) < 1e-9 * Math.max(1, Math.abs(f(1, 1) * f(2, 3)));
        return fs.findIndex((f) => !prodRule(f));
      },
    },
    {
      id: 'q5', q: 'A quantity decays according to dy/dx = ky with y = 8 at x = 0 and y = 4 at x = 1. The value of y at x = 3 is', options: ['2', '0.5', '4', '1'], answer: 3,
      why: 'y = 8e^(kx) with e^k = 4/8 = 1/2. At x = 3, y = 8 × (1/2)³ = 1.',
      verify: () => { const k = Math.log(4 / 8); return near(yAt(k, 8, 0, 0, 3), [2, 0.5, 4, 1]); },
    },
  ],
};
