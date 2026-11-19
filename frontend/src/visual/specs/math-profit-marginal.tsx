/**
 * Chapter lab: Mathematics (319), "Applied Calculus: derivatives, marginal analysis, integration and differential equations",
 * section "Marginal cost and marginal revenue".
 * Model: C(x) = c2 x^2 + c1 x + 500, R(x) = p x - q x^2, MC = dC/dx, MR = dR/dx, P = R - C.
 * Profit is maximum where MR = MC and P'' < 0 (the lesson's rule). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const FIXED = 500;
const C = (c2: number, c1: number, x: number) => c2 * x * x + c1 * x + FIXED;
const R = (p: number, q: number, x: number) => p * x - q * x * x;
const MC = (c2: number, c1: number, x: number) => 2 * c2 * x + c1;
const MR = (p: number, q: number, x: number) => p - 2 * q * x;
const profit = (c2: number, c1: number, p: number, q: number, x: number) => R(p, q, x) - C(c2, c1, x);
const xStar = (c2: number, c1: number, p: number, q: number) => (p - c1) / (2 * (q + c2));
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const XMAX = 100;
const PX = (x: number) => 30 + (x / XMAX) * 350;
const YLO = -20, YHI = 100;
const PY = (y: number) => 205 - ((y - YLO) / (YHI - YLO)) * 175;

export const spec: Spec = {
  id: 'math-profit-marginal',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Applied Calculus',
  afterHeading: 'Marginal cost and marginal revenue',
  title: 'Marginal Cost, Marginal Revenue and Profit Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Set a cost function and a revenue function, slide the output level, and watch marginal cost and marginal revenue cross exactly at the output that maximises profit.',
  can: ['Read MC = dC/dx and MR = dR/dx at any output level', 'See profit rise while MR > MC and fall once MR < MC', 'Record the profit-maximising output for three selling prices and read the slope'],
  minutes: 11,
  vars: [
    { id: 'c2', label: 'Cost coefficient c₂ (C = c₂x² + c₁x + 500)', unit: '', min: 0.05, max: 0.3, step: 0.05, start: 0.1, digits: 2 },
    { id: 'c1', label: 'Cost coefficient c₁', unit: 'Rs/unit', min: 10, max: 30, step: 1, start: 20, digits: 0 },
    { id: 'p', label: 'Revenue coefficient p (R = px − qx²)', unit: 'Rs/unit', min: 40, max: 70, step: 2, start: 50, digits: 0 },
    { id: 'q', label: 'Revenue coefficient q', unit: '', min: 0.3, max: 1, step: 0.1, start: 0.5, digits: 1 },
    { id: 'x', label: 'Output level x', unit: 'units', min: 0, max: 100, step: 1, start: 20, digits: 0 },
  ],
  outs: [
    { id: 'mc', label: 'Marginal cost MC = 2c₂x + c₁', unit: 'Rs', fn: (v) => MC(v.c2!, v.c1!, v.x!), digits: 2 },
    { id: 'mr', label: 'Marginal revenue MR = p − 2qx', unit: 'Rs', fn: (v) => MR(v.p!, v.q!, v.x!), digits: 2 },
    { id: 'gap', label: 'MR − MC', unit: 'Rs', fn: (v) => MR(v.p!, v.q!, v.x!) - MC(v.c2!, v.c1!, v.x!), digits: 2 },
    { id: 'profit', label: 'Profit P(x) = R(x) − C(x)', unit: 'Rs', fn: (v) => profit(v.c2!, v.c1!, v.p!, v.q!, v.x!), digits: 1 },
    { id: 'xs', label: 'Profit-maximising output (MR = MC)', unit: 'units', fn: (v) => xStar(v.c2!, v.c1!, v.p!, v.q!), digits: 2 },
    { id: 'pmax', label: 'Maximum profit P(x*)', unit: 'Rs', fn: (v) => profit(v.c2!, v.c1!, v.p!, v.q!, xStar(v.c2!, v.c1!, v.p!, v.q!)), digits: 1 },
  ],
  graphs: [
    { id: 'profit-x', title: 'Profit against output', x: 'x', y: 'profit' },
    { id: 'gap-x', title: 'MR − MC against output', x: 'x', y: 'gap' },
    { id: 'xs-p', title: 'Profit-maximising output against the price coefficient p', x: 'p', y: 'xs' },
  ],
  sceneAlt: 'Marginal cost (a rising line) and marginal revenue (a falling line) plotted against output. The area between them is green before they cross, where profit is rising, and orange after, where profit is falling. A vertical line marks the profit-maximising output and a dot marks the chosen output.',
  scene: ({ v, o }) => {
    const mcl = (x: number) => MC(v.c2!, v.c1!, x);
    const mrl = (x: number) => MR(v.p!, v.q!, x);
    const xs = Math.min(XMAX, Math.max(0, o.xs!));
    const clampY = (y: number) => Math.max(YLO, Math.min(YHI, y));
    const poly = (f: (x: number) => number) => Array.from({ length: 51 }, (_, i) => `${PX(i * 2).toFixed(1)},${PY(clampY(f(i * 2))).toFixed(1)}`).join(' ');
    const band = (x0: number, x1: number) => {
      if (x1 <= x0) return '';
      const n = 24;
      const top = Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return `${PX(x).toFixed(1)},${PY(clampY(mrl(x))).toFixed(1)}`; });
      const bot = Array.from({ length: n + 1 }, (_, i) => { const x = x1 - ((x1 - x0) * i) / n; return `${PX(x).toFixed(1)},${PY(clampY(mcl(x))).toFixed(1)}`; });
      return [...top, ...bot].join(' ');
    };
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={30} y1={PY(0)} x2={382} y2={PY(0)} stroke="#c9ced6" />
        <line x1={30} y1={20} x2={30} y2={215} stroke="#c9ced6" />
        <polygon points={band(0, xs)} fill="#18443b" fillOpacity={0.16} />
        <polygon points={band(xs, XMAX)} fill="#c45e42" fillOpacity={0.14} />
        <polyline points={poly(mcl)} fill="none" stroke="#2563a8" strokeWidth={2.2} />
        <polyline points={poly(mrl)} fill="none" stroke="#c45e42" strokeWidth={2.2} />
        <line x1={PX(xs)} y1={22} x2={PX(xs)} y2={205} stroke="#18443b" strokeDasharray="4 3" />
        <line x1={PX(v.x!)} y1={22} x2={PX(v.x!)} y2={205} stroke="#7c8595" />
        <circle cx={PX(v.x!)} cy={PY(clampY(o.mc!))} r={4.5} fill="#2563a8" stroke="#fff" strokeWidth={1.5} />
        <circle cx={PX(v.x!)} cy={PY(clampY(o.mr!))} r={4.5} fill="#c45e42" stroke="#fff" strokeWidth={1.5} />
        <text x={34} y={16} fontSize={11}><tspan fill="#2563a8">MC rises</tspan> · <tspan fill="#c45e42">MR falls</tspan> · dashed: x* = {fmt(o.xs!, 1)}</text>
        <text x={34} y={228} fontSize={10}>output x from 0 to 100 · green area: MR &gt; MC, profit rising · orange: MR &lt; MC, profit falling</text>
        <text x={380} y={PY(0) - 3} textAnchor="end">0</text>
      </g>
    );
  },
  discover: [
    'Move the output x. The two dots are MC (blue) and MR (orange): find where they meet.',
    'Watch the profit reading as x passes that crossing: does it rise or fall on each side?',
    'Raise the price coefficient p and see how the crossing point moves.',
  ],
  experiment: [
    'Set x to the profit-maximising output shown in the readout. What is MR − MC there?',
    'Move x a little either side of x*. Does the profit go down on both sides?',
    'Make the cost curve steeper (raise c₂) and see whether the best output rises or falls.',
  ],
  understand: [
    'Marginal cost MC = dC/dx approximates the cost of one more unit; marginal revenue MR = dR/dx the extra revenue from one more unit.',
    'Profit P(x) = R(x) − C(x) rises while MR > MC and falls while MR < MC, so it is greatest where MR = MC.',
    'The condition P″(x) < 0 confirms a maximum: P″ = −2(q + c₂) is negative for these functions.',
    'Marginal quantities are slopes of total quantities: a falling MR means revenue grows more and more slowly with output.',
  ],
  preds: [
    {
      id: 'p1', title: 'Marginal revenue at higher output', prompt: 'For R(x) = 50x − 0.5x², MR = 50 − x. At x = 10, MR = 40. Output is raised to x = 30. What happens to MR?',
      base: { p: 50, q: 0.5, x: 10 }, test: { x: 30 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes zero'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).mr! / outs(base).mr!, [2, 0.5, 1, 0]),
      why: ({ base, test, outs }) => `MR = p − 2qx falls by 2q = 1 for every extra unit. It goes from Rs ${fmt(outs(base).mr!, 0)} at x = 10 to Rs ${fmt(outs(test).mr!, 0)} at x = 30, half as much.`,
    },
    {
      id: 'p2', title: 'MR above MC', prompt: 'At x = 10, MR = 40 is greater than MC = 22. Output is raised from 10 to 20 units. What happens to the profit?',
      base: { x: 10 }, test: { x: 20 }, options: ['It rises, because MR > MC', 'It falls, because MC rises', 'It stays the same', 'It becomes zero'], answer: 0,
      verify: ({ base, test, outs }) => (outs(test).profit! > outs(base).profit! ? 0 : outs(test).profit! < outs(base).profit! ? 1 : 2),
      why: ({ base, test, outs }) => `Each extra unit between 10 and 20 adds more revenue than cost (MR > MC all the way, from MR − MC = ${fmt(outs(base).gap!, 0)} down to ${fmt(outs(test).gap!, 0)}). Profit goes from Rs ${fmt(outs(base).profit!, 0)} to Rs ${fmt(outs(test).profit!, 0)}.`,
    },
    {
      id: 'p3', title: 'Past the best output', prompt: 'The profit-maximising output is x* = 25. Output is raised from 25 to 40 units. What happens to the profit?',
      base: { x: 25 }, test: { x: 40 }, options: ['It rises', 'It falls, because MR < MC beyond 25', 'It stays the same', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).profit! > outs(base).profit! ? 0 : outs(test).profit! < outs(base).profit! ? 1 : 2),
      why: ({ base, test, outs }) => `Beyond x* = ${fmt(outs(base).xs!, 0)} each extra unit costs more than it earns (MR − MC = ${fmt(outs(test).gap!, 0)} at x = 40). Profit goes from Rs ${fmt(outs(base).profit!, 0)} to Rs ${fmt(outs(test).profit!, 0)}.`,
    },
    {
      id: 'p4', title: 'A higher price', prompt: 'The coefficient p in R = px − 0.5x² rises from 50 to 60 (the firm can charge more at each output). What happens to the profit-maximising output x*?',
      base: { p: 50 }, test: { p: 60 }, options: ['It rises', 'It falls', 'It stays the same', 'It becomes zero'], answer: 0,
      verify: ({ base, test, outs }) => (outs(test).xs! > outs(base).xs! ? 0 : outs(test).xs! < outs(base).xs! ? 1 : 2),
      why: ({ base, test, outs }) => `MR = p − 2qx is higher at every output, so it meets MC further to the right: x* goes from ${fmt(outs(base).xs!, 1)} to ${fmt(outs(test).xs!, 1)} units.`,
    },
  ],
  measure: {
    instruction: 'Keep the cost and q fixed. Record the profit-maximising output x* (where MR = MC) for at least three different values of p.',
    vary: 'p',
    record: ['xs', 'pmax'],
    fit: {
      xLabel: 'p (Rs/unit)',
      yLabel: 'profit-maximising output x*',
      x: (v) => v.p!,
      y: (_v, o) => o.xs!,
      interpret: (slope, intercept, v) => `x* against p is a straight line. MR = MC gives x* = (p − c₁)/(2(q + c₂)), so the slope is 1/(2(q + c₂)) = ${fmt(slope, 3)}, which gives q + c₂ = ${fmt(1 / (2 * slope), 2)} (you set ${fmt(v.q! + v.c2!, 2)}). The line crosses zero output at p = ${fmt(-intercept / slope, 1)}, the marginal cost of the first unit c₁ = ${v.c1!}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The total cost is C(x) = 0.1x² + 20x + 500 rupees. The marginal cost at x = 10 is', options: ['Rs 20', 'Rs 22', 'Rs 21', 'Rs 24'], answer: 1,
      why: 'MC = dC/dx = 0.2x + 20. At x = 10 it is 2 + 20 = Rs 22: producing the 11th unit costs about Rs 22 more.',
      verify: () => near(MC(0.1, 20, 10), [20, 22, 21, 24]),
    },
    {
      id: 'q2', q: 'The revenue is R(x) = 50x − 0.5x². The marginal revenue at x = 20 is', options: ['Rs 20', 'Rs 40', 'Rs 50', 'Rs 30'], answer: 3,
      why: 'MR = dR/dx = 50 − x. At x = 20 it is 50 − 20 = Rs 30 (check: R(21) − R(20) = 829.5 − 800 = 29.5, close to 30).',
      verify: () => near(MR(50, 0.5, 20), [20, 40, 50, 30]),
    },
    {
      id: 'q3', q: 'For R(x) = 50x − 0.5x² and C(x) = 0.1x² + 20x + 500, the output that maximises the profit is', options: ['20', '30', '25', '50'], answer: 2,
      why: 'P = R − C = 30x − 0.6x² − 500. P′ = 30 − 1.2x = 0 gives x = 25 (the same as MR = MC: 50 − x = 0.2x + 20). P″ = −1.2 < 0, so it is a maximum.',
      verify: () => near(xStar(0.1, 20, 50, 0.5), [20, 30, 25, 50]),
    },
    {
      id: 'q4', q: 'Profit P(x) = R(x) − C(x) is a maximum at x₀ if MR = MC at x₀ and', options: ['P″(x₀) < 0', 'P″(x₀) > 0', 'P′(x₀) < 0', 'P(x₀) = 0'], answer: 0,
      why: 'MR = MC means P′ = 0 (a critical point); the second derivative test needs P″(x₀) < 0 for a maximum. For the functions of this lab P″ = −2(q + c₂), which is always negative.',
      verify: () => (-2 * (0.5 + 0.1) < 0 ? 0 : 1),
    },
    {
      id: 'q5', q: 'A firm has R(x) = 80x − x² and C(x) = 20x + 100. Its maximum profit (in rupees) is', options: ['600', '700', '900', '800'], answer: 3,
      why: 'P = 60x − x² − 100, P′ = 60 − 2x = 0 gives x = 30 and P″ = −2 < 0. P(30) = 1800 − 900 − 100 = 800.',
      verify: () => { const P = (x: number) => 80 * x - x * x - (20 * x + 100); return near(P(30), [600, 700, 900, 800]); },
    },
  ],
};
