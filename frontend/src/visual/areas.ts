/**
 * Area Under a Curve Lab: the pure mathematics (no React). Everything the page shows is computed here,
 * and every function, rule, solver, prediction and practice answer is re-checked in areas.test.ts against
 * an independent numerical integration. Status of all lab content: Draft - unverified.
 *
 * Syllabus (CUET-UG Mathematics, 319): definite integral as the limit of a sum, the fundamental theorem,
 * area under a curve and between curves (lines, circles, parabolas, ellipses in standard form), signed area, symmetry.
 */

// ------------------------------------------------------------------ functions and antiderivatives
export interface Curve {
  /** the function; NaN where it is not defined */
  f: (x: number) => number;
  /** an antiderivative: F' = f, so that the integral from a to b is F(b) - F(a) */
  F: (x: number) => number;
}

export interface Fn extends Curve {
  id: string;
  /** plain text, e.g. "x²" */
  label: string;
  /** LaTeX of f(x) */
  tex: string;
  /** LaTeX of the antiderivative */
  texF: string;
  /** the range the interval handles can move in */
  lo: number;
  hi: number;
  /** the interval chosen when the function is picked */
  a0: number;
  b0: number;
  /** quick interval choices */
  presets: { label: string; a: number; b: number }[];
}

export const POLY_DEFAULT: number[] = [1, 0, 0.5, 0];

/** c[0] + c[1] x + c[2] x² + c[3] x³ and its antiderivative c0 x + c1 x²/2 + c2 x³/3 + c3 x⁴/4. */
export function polyFn(c: number[] = POLY_DEFAULT): Fn {
  const co = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0];
  const f = (x: number) => co[0]! + co[1]! * x + co[2]! * x * x + co[3]! * x * x * x;
  const F = (x: number) => co[0]! * x + (co[1]! * x * x) / 2 + (co[2]! * x * x * x) / 3 + (co[3]! * x * x * x * x) / 4;
  const term = (v: number, p: string, first: boolean) => (v === 0 ? '' : `${v < 0 ? '-' : first ? '' : '+'}${Math.abs(v) === 1 && p ? '' : String(Math.abs(v))}${p}`);
  const parts = [term(co[3]!, 'x^3', true), term(co[2]!, 'x^2', !co[3]), term(co[1]!, 'x', !co[3] && !co[2]), term(co[0]!, '', !co[3] && !co[2] && !co[1])].join('');
  return {
    id: 'poly', label: 'custom polynomial', tex: `f(x)=${parts || '0'}`, texF: 'F(x)=c_0x+\\tfrac{c_1}{2}x^2+\\tfrac{c_2}{3}x^3+\\tfrac{c_3}{4}x^4',
    f, F, lo: -3, hi: 3, a0: 0, b0: 2, presets: [{ label: '[0, 2]', a: 0, b: 2 }, { label: '[−2, 2]', a: -2, b: 2 }, { label: '[−3, 3]', a: -3, b: 3 }],
  };
}

const PI = Math.PI;
export const FUNCTIONS: Fn[] = [
  { id: 'x2', label: 'x²', tex: 'f(x)=x^2', texF: 'F(x)=\\dfrac{x^3}{3}', f: (x) => x * x, F: (x) => (x * x * x) / 3, lo: -2.5, hi: 2.5, a0: 0, b0: 2, presets: [{ label: '[0, 2]', a: 0, b: 2 }, { label: '[0, 1]', a: 0, b: 1 }, { label: '[−2, 2]', a: -2, b: 2 }] },
  { id: 'x3', label: 'x³', tex: 'f(x)=x^3', texF: 'F(x)=\\dfrac{x^4}{4}', f: (x) => x * x * x, F: (x) => (x * x * x * x) / 4, lo: -2.5, hi: 2.5, a0: 0, b0: 2, presets: [{ label: '[0, 2]', a: 0, b: 2 }, { label: '[−2, 2]', a: -2, b: 2 }, { label: '[−1, 2]', a: -1, b: 2 }] },
  { id: 'sin', label: 'sin x', tex: 'f(x)=\\sin x', texF: 'F(x)=-\\cos x', f: Math.sin, F: (x) => -Math.cos(x), lo: -0.5, hi: 7, a0: 0, b0: PI, presets: [{ label: '[0, π]', a: 0, b: PI }, { label: '[0, 2π]', a: 0, b: 2 * PI }, { label: '[0, π/2]', a: 0, b: PI / 2 }] },
  { id: 'exp', label: 'eˣ', tex: 'f(x)=e^x', texF: 'F(x)=e^x', f: Math.exp, F: Math.exp, lo: -2, hi: 2.5, a0: 0, b0: 1, presets: [{ label: '[0, 1]', a: 0, b: 1 }, { label: '[−1, 1]', a: -1, b: 1 }, { label: '[0, 2]', a: 0, b: 2 }] },
  { id: 'recip', label: '1/x', tex: 'f(x)=\\dfrac1x', texF: 'F(x)=\\ln x', f: (x) => 1 / x, F: Math.log, lo: 0.5, hi: 6, a0: 1, b0: 3, presets: [{ label: '[1, 3]', a: 1, b: 3 }, { label: '[1, e]', a: 1, b: Math.E }, { label: '[1, 4]', a: 1, b: 4 }] },
  { id: 'line', label: '2x + 1', tex: 'f(x)=2x+1', texF: 'F(x)=x^2+x', f: (x) => 2 * x + 1, F: (x) => x * x + x, lo: -1.5, hi: 4.5, a0: 0, b0: 3, presets: [{ label: '[0, 3]', a: 0, b: 3 }, { label: '[1, 4]', a: 1, b: 4 }, { label: '[−1, 2]', a: -1, b: 2 }] },
  { id: 'sqrt', label: '√x', tex: 'f(x)=\\sqrt{x}', texF: 'F(x)=\\dfrac23x^{3/2}', f: (x) => (x > -1e-12 ? Math.sqrt(Math.max(0, x)) : NaN), F: (x) => (x > -1e-12 ? (2 / 3) * Math.max(0, x) ** 1.5 : NaN), lo: 0, hi: 9, a0: 0, b0: 4, presets: [{ label: '[0, 4]', a: 0, b: 4 }, { label: '[1, 4]', a: 1, b: 4 }, { label: '[0, 9]', a: 0, b: 9 }] },
  { id: 'down', label: '4 − x²', tex: 'f(x)=4-x^2', texF: 'F(x)=4x-\\dfrac{x^3}{3}', f: (x) => 4 - x * x, F: (x) => 4 * x - (x * x * x) / 3, lo: -3, hi: 3, a0: -2, b0: 2, presets: [{ label: '[−2, 2]', a: -2, b: 2 }, { label: '[0, 2]', a: 0, b: 2 }, { label: '[−3, 3]', a: -3, b: 3 }] },
  polyFn(),
];

export function getFn(id: string, coeffs: number[] = POLY_DEFAULT): Fn {
  return id === 'poly' ? polyFn(coeffs) : FUNCTIONS.find((x) => x.id === id) ?? FUNCTIONS[0]!;
}

/** The definite integral from the fundamental theorem: F(b) - F(a). */
export const exactIntegral = (c: Curve, a: number, b: number) => c.F(b) - c.F(a);

// ------------------------------------------------------------------ Riemann sums
export type Rule = 'left' | 'right' | 'mid' | 'trap';
export const RULES: Rule[] = ['left', 'right', 'mid', 'trap'];
export const RULE_LABEL: Record<Rule, string> = { left: 'Left endpoints', right: 'Right endpoints', mid: 'Midpoints', trap: 'Trapezoids' };
/** The rule's name used inside a sentence: "the midpoint rule". */
export const RULE_NAME: Record<Rule, string> = { left: 'left-endpoint', right: 'right-endpoint', mid: 'midpoint', trap: 'trapezoid' };
export const RULE_COLOUR: Record<Rule, string> = { left: '#2347a8', right: '#b42318', mid: '#1d7a4b', trap: '#a86100' };

/** The sum of n strips of width h = (b - a)/n with the chosen rule. */
export function riemann(f: (x: number) => number, a: number, b: number, n: number, rule: Rule): number {
  const h = (b - a) / n;
  let s = 0;
  if (rule === 'trap') {
    s = 0.5 * (f(a) + f(b));
    for (let i = 1; i < n; i++) s += f(a + i * h);
  } else {
    for (let i = 0; i < n; i++) s += f(a + (rule === 'left' ? i : rule === 'right' ? i + 1 : i + 0.5) * h);
  }
  return s * h;
}

/** One strip, for drawing: its x-range and the heights at its two edges (a trapezoid) or one height (a rectangle). */
export interface Strip { x0: number; x1: number; y0: number; y1: number }
export function strips(f: (x: number) => number, a: number, b: number, n: number, rule: Rule): Strip[] {
  const h = (b - a) / n;
  return Array.from({ length: n }, (_, i) => {
    const x0 = a + i * h, x1 = a + (i + 1) * h;
    if (rule === 'trap') return { x0, x1, y0: f(x0), y1: f(x1) };
    const y = f(rule === 'left' ? x0 : rule === 'right' ? x1 : (x0 + x1) / 2);
    return { x0, x1, y0: y, y1: y };
  });
}

export const riemannError = (c: Curve, a: number, b: number, n: number, rule: Rule) => riemann(c.f, a, b, n, rule) - exactIntegral(c, a, b);

/** sum(n) for n = 1..nMax, for the convergence graph. */
export function convergenceSeries(f: (x: number) => number, a: number, b: number, rule: Rule, nMax = 200): { n: number; sum: number }[] {
  return Array.from({ length: nMax }, (_, i) => ({ n: i + 1, sum: riemann(f, a, b, i + 1, rule) }));
}

/** Least-squares line of ln|error| against ln n. Points with zero error cannot be put on a log scale and are skipped. */
export function fitLogLog(points: { n: number; err: number }[]): { slope: number; intercept: number; used: number } | null {
  const p = points.filter((q) => Math.abs(q.err) > 1e-12 && q.n > 0).map((q) => ({ x: Math.log(q.n), y: Math.log(Math.abs(q.err)) }));
  if (p.length < 2) return null;
  const mx = p.reduce((t, q) => t + q.x, 0) / p.length, my = p.reduce((t, q) => t + q.y, 0) / p.length;
  const sxx = p.reduce((t, q) => t + (q.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = p.reduce((t, q) => t + (q.x - mx) * (q.y - my), 0) / sxx;
  return { slope, intercept: my - slope * mx, used: p.length };
}

/** The textbook slope of log error against log n: -1 for left and right, -2 for midpoint and trapezoid. */
export const textbookSlope = (rule: Rule) => (rule === 'left' || rule === 'right' ? -1 : -2);

/** A plain explanation when a particular function and interval do not follow the textbook slope (or give zero error). */
export function slopeNote(fn: Fn, a: number, b: number, rule: Rule): string | null {
  if (fn.id === 'line' && (rule === 'mid' || rule === 'trap')) return 'For a straight line the midpoint and trapezoid rules are exact, so the error is zero and there is no slope to fit.';
  if (fn.id === 'poly' && (rule === 'mid' || rule === 'trap')) {
    const d2 = (x: number) => fn.f(x - 1) + fn.f(x + 1) - 2 * fn.f(x);
    if (Math.abs(d2(0)) < 1e-12 && Math.abs(d2(1)) < 1e-12 && Math.abs(d2(-1)) < 1e-12) return 'This polynomial is a straight line, so the midpoint and trapezoid rules are exact.';
  }
  if ((rule === 'left' || rule === 'right') && Math.abs(fn.f(b) - fn.f(a)) < 1e-9) return 'Here f(a) = f(b), so the leading error cancels and the left and right sums converge faster than 1/n.';
  if (fn.id === 'sqrt' && a < 1e-9 && (rule === 'mid' || rule === 'trap')) return '√x has an infinitely steep graph at 0, so these rules converge with error proportional to n to the power −1.5 here, not −2.';
  if (fn.id === 'sin' && Math.abs(b - a - 2 * PI) < 1e-6 && rule === 'trap') return 'sin x over a whole period is a special case: the trapezoid rule converges extremely fast.';
  return null;
}

// ------------------------------------------------------------------ roots, intersections, signed and total area
/**
 * The zeros of h on [lo, hi]: sign changes found on a fine grid and refined by bisection, plus grid points that are
 * zero to within 1e-9. A touching (double) root may be missed. `extra` adds sample points (e.g. the ends of a curve's domain).
 */
export function findRoots(h: (x: number) => number, lo: number, hi: number, extra: number[] = [], N = 4000): number[] {
  const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
  for (const e of extra) if (e > lo && e < hi) xs.push(e);
  xs.sort((p, q) => p - q);
  const tol = (3 * (hi - lo)) / N;
  const found: { x: number; exact: boolean }[] = [];
  const push = (x: number, exact: boolean) => {
    const i = found.findIndex((r) => Math.abs(r.x - x) < tol);
    if (i < 0) found.push({ x, exact });
    else if (exact && !found[i]!.exact) found[i] = { x, exact };
  };
  let prev: { x: number; v: number } | null = null;
  for (const x of xs) {
    const v = h(x);
    if (!Number.isFinite(v)) { prev = null; continue; }
    if (Math.abs(v) < 1e-9) push(x, false);
    else if (prev && prev.v * v < 0) {
      let p = prev.x, q = x, vp = prev.v;
      for (let k = 0; k < 80; k++) {
        const m = (p + q) / 2, vm = h(m);
        if (!Number.isFinite(vm)) break;
        if (vp * vm <= 0) q = m; else { p = m; vp = vm; }
      }
      push((p + q) / 2, true);
    }
    prev = { x, v };
  }
  const roots = found.map((r) => r.x);
  return roots.sort((p, q) => p - q);
}

export interface Piece { x0: number; x1: number; value: number }
export interface SignedAreas {
  /** the definite integral, with area below the axis counted negative */
  signed: number;
  /** area above the axis */
  above: number;
  /** area below the axis, as a positive number */
  below: number;
  /** total area = integral of |f| = above + below */
  total: number;
  /** where f crosses zero inside (a, b) */
  roots: number[];
  pieces: Piece[];
}

/** Splits [a, b] at the zeros of f and adds the pieces with their signs (exact, from the antiderivative). */
export function signedAreas(c: Curve, a: number, b: number, extra: number[] = []): SignedAreas {
  const roots = findRoots(c.f, a, b, extra).filter((r) => r > a + 1e-7 && r < b - 1e-7);
  const cuts = [a, ...roots, b];
  const pieces: Piece[] = [];
  let above = 0, below = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const v = exactIntegral(c, cuts[i]!, cuts[i + 1]!);
    pieces.push({ x0: cuts[i]!, x1: cuts[i + 1]!, value: v });
    if (v >= 0) above += v; else below += -v;
  }
  return { signed: above - below, above, below, total: above + below, roots, pieces };
}

// ------------------------------------------------------------------ area between two curves
export interface PairCurve extends Curve { name: string }
export interface Pair {
  id: string;
  title: string;
  /** plain-text equations */
  eq: string;
  upper: PairCurve;
  lower: PairCurve;
  /** the range the limits can move in */
  lo: number;
  hi: number;
  /** points where the curves stop being defined (circle and ellipse ends) */
  edges: number[];
  /** what the syllabus calls it */
  topic: string;
}

const halfCircle = (x: number) => (Math.abs(x) <= 1 + 1e-12 ? Math.sqrt(Math.max(0, 1 - x * x)) : NaN);
const halfCircleF = (x: number) => (Math.abs(x) <= 1 + 1e-12 ? 0.5 * (x * Math.sqrt(Math.max(0, 1 - x * x)) + Math.asin(Math.max(-1, Math.min(1, x)))) : NaN);
const halfEllipse = (x: number) => (Math.abs(x) <= 2 + 1e-12 ? Math.sqrt(Math.max(0, 1 - (x * x) / 4)) : NaN); // x²/4 + y² = 1
const halfEllipseF = (x: number) => (Math.abs(x) <= 2 + 1e-12 ? 2 * halfCircleF(x / 2) : NaN);

export const PAIRS: Pair[] = [
  { id: 'par-line', title: 'Parabola and a line', eq: 'y = x² and y = x', topic: 'parabola and line', upper: { name: 'y = x', f: (x) => x, F: (x) => (x * x) / 2 }, lower: { name: 'y = x²', f: (x) => x * x, F: (x) => (x * x * x) / 3 }, lo: -0.5, hi: 2, edges: [] },
  { id: 'par-line2', title: 'Parabola and a steeper line', eq: 'y = x² and y = 2x', topic: 'parabola and line', upper: { name: 'y = 2x', f: (x) => 2 * x, F: (x) => x * x }, lower: { name: 'y = x²', f: (x) => x * x, F: (x) => (x * x * x) / 3 }, lo: -0.5, hi: 3, edges: [] },
  { id: 'par-par', title: 'Downward parabola and a line', eq: 'y = 4 − x² and y = x + 2', topic: 'parabola and line', upper: { name: 'y = 4 − x²', f: (x) => 4 - x * x, F: (x) => 4 * x - (x * x * x) / 3 }, lower: { name: 'y = x + 2', f: (x) => x + 2, F: (x) => (x * x) / 2 + 2 * x }, lo: -3, hi: 2, edges: [] },
  { id: 'y2-4x', title: 'Parabola y² = 4x and the line y = x', eq: 'y = 2√x (upper half of y² = 4x) and y = x', topic: 'parabola and line', upper: { name: 'y = 2√x', f: (x) => (x > -1e-12 ? 2 * Math.sqrt(Math.max(0, x)) : NaN), F: (x) => (x > -1e-12 ? (4 / 3) * Math.max(0, x) ** 1.5 : NaN) }, lower: { name: 'y = x', f: (x) => x, F: (x) => (x * x) / 2 }, lo: 0, hi: 5, edges: [0] },
  { id: 'circle', title: 'Circle x² + y² = 1 and the line x + y = 1', eq: 'y = √(1 − x²) (upper half of the circle) and y = 1 − x', topic: 'circle and line', upper: { name: 'y = √(1 − x²)', f: halfCircle, F: halfCircleF }, lower: { name: 'y = 1 − x', f: (x) => 1 - x, F: (x) => x - (x * x) / 2 }, lo: 0, hi: 1, edges: [-1, 1] },
  { id: 'ellipse', title: 'Ellipse x²/4 + y² = 1 and the line x + 2y = 2', eq: 'y = √(1 − x²/4) (upper half of the ellipse) and y = 1 − x/2', topic: 'ellipse and line', upper: { name: 'y = √(1 − x²/4)', f: halfEllipse, F: halfEllipseF }, lower: { name: 'y = 1 − x/2', f: (x) => 1 - x / 2, F: (x) => x - (x * x) / 4 }, lo: 0, hi: 2, edges: [-2, 2] },
];

export const getPair = (id: string) => PAIRS.find((p) => p.id === id) ?? PAIRS[0]!;

/** upper - lower, as a curve of its own (with its own antiderivative). */
export const difference = (p: Pair): Curve => ({ f: (x) => p.upper.f(x) - p.lower.f(x), F: (x) => p.upper.F(x) - p.lower.F(x) });

/** Where the two curves meet (their x-values), looking from p.lo to p.hi, widened a little so end points are not missed. */
export function intersections(p: Pair): number[] {
  const d = difference(p);
  const span = p.hi - p.lo;
  return findRoots(d.f, p.lo - 0.001 * span, p.hi + 0.001 * span, p.edges).map((r) => Math.round(r * 1e9) / 1e9);
}

/** ∫(upper − lower) between the limits (signed) and the true area ∫|upper − lower|, splitting at any crossing. */
export function betweenAreas(p: Pair, a: number, b: number): SignedAreas {
  return signedAreas(difference(p), a, b, p.edges);
}

/** The area between the curves from the first to the last intersection. */
export function enclosedArea(p: Pair): { x0: number; x1: number; area: number } {
  const r = intersections(p);
  const x0 = r[0]!, x1 = r[r.length - 1]!;
  return { x0, x1, area: betweenAreas(p, x0, x1).total };
}

// ------------------------------------------------------------------ the lab state, predictions and practice
export type Mode = 'riemann' | 'between' | 'signed';
export interface Setup { mode: Mode; fn: string; pair: string; a: number; b: number; n: number; rule: Rule }

export const START: Setup = { mode: 'riemann', fn: 'x2', pair: 'par-line', a: 0, b: 2, n: 8, rule: 'left' };

export interface Predict {
  id: string;
  title: string;
  prompt: string;
  base: Setup;
  test: Setup;
  options: string[];
  answer: number;
  why: (t: Setup) => string;
}

const f4 = (x: number) => {
  if (Math.abs(x) < 1e-9) return '0';
  if (Math.abs(x) < 0.01) return x.toExponential(2);
  const t = Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(4);
  return t.includes('.') ? t.replace(/\.?0+$/, '') : t;
};
const midErr = (id: string, a: number, b: number, n: number) => Math.abs(riemannError(getFn(id), a, b, n, 'mid'));

export const PREDICTS: Predict[] = [
  {
    id: 'a1',
    title: 'Double the strips',
    prompt: 'You estimate the area under y = eˣ from 0 to 1 with the midpoint rule using 8 strips, then use 16 strips. What happens to the size of the error?',
    base: { mode: 'riemann', fn: 'exp', pair: 'par-line', a: 0, b: 1, n: 8, rule: 'mid' },
    test: { mode: 'riemann', fn: 'exp', pair: 'par-line', a: 0, b: 1, n: 16, rule: 'mid' },
    options: ['It stays about the same', 'It halves', 'It becomes about one quarter', 'It becomes about one eighth'],
    answer: 2,
    why: () => `The midpoint error is ${f4(midErr('exp', 0, 1, 8))} with 8 strips and ${f4(midErr('exp', 0, 1, 16))} with 16: the ratio is ${(midErr('exp', 0, 1, 8) / midErr('exp', 0, 1, 16)).toFixed(2)}. For a smooth function the midpoint error is proportional to 1/n², so doubling n divides it by 4.`,
  },
  {
    id: 'a2',
    title: 'Which rule overestimates?',
    prompt: 'f(x) = x² is increasing on [0, 2]. With 4 strips, which rectangle rule gives a sum that is larger than the true area?',
    base: { mode: 'riemann', fn: 'x2', pair: 'par-line', a: 0, b: 2, n: 4, rule: 'left' },
    test: { mode: 'riemann', fn: 'x2', pair: 'par-line', a: 0, b: 2, n: 4, rule: 'right' },
    options: ['Left-endpoint rectangles', 'Right-endpoint rectangles', 'Both of them', 'Neither: both are exact'],
    answer: 1,
    why: () => `The exact area is ${f4(exactIntegral(getFn('x2'), 0, 2))}. On an increasing function the left rectangles sit under the curve (sum ${f4(riemann(getFn('x2').f, 0, 2, 4, 'left'))}, too small) and the right rectangles stick out above it (sum ${f4(riemann(getFn('x2').f, 0, 2, 4, 'right'))}, too large).`,
  },
  {
    id: 'a3',
    title: 'An odd function',
    prompt: 'What is the value of the definite integral of x³ from −2 to 2?',
    base: { mode: 'riemann', fn: 'x3', pair: 'par-line', a: 0, b: 2, n: 8, rule: 'mid' },
    test: { mode: 'signed', fn: 'x3', pair: 'par-line', a: -2, b: 2, n: 8, rule: 'mid' },
    options: ['0', '4', '8', '16'],
    answer: 0,
    why: () => {
      const s = signedAreas(getFn('x3'), -2, 2);
      return `x³ is an odd function: f(−x) = −f(x). The area above the axis (${f4(s.above)}) cancels the area below it (${f4(s.below)}), so the integral is ${f4(s.signed)}. The total area is not zero: it is ${f4(s.total)}.`;
    },
  },
  {
    id: 'a4',
    title: 'Area between curves',
    prompt: 'The parabola y = x² and the line y = x meet at two points and enclose a region. What is its area?',
    base: { mode: 'between', fn: 'x2', pair: 'par-line', a: -0.5, b: 2, n: 8, rule: 'mid' },
    test: { mode: 'between', fn: 'x2', pair: 'par-line', a: 0, b: 1, n: 8, rule: 'mid' },
    options: ['1/6', '1/3', '1/2', '5/6'],
    answer: 0,
    why: () => {
      const e = enclosedArea(getPair('par-line'));
      return `They meet where x² = x, at x = ${f4(e.x0)} and x = ${f4(e.x1)}. Between them the line is above the parabola, so the area is the integral of (x − x²) = [x²/2 − x³/3] from 0 to 1 = ${f4(e.area)}, which is 1/6.`;
    },
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'aa1',
    q: 'The area of the region bounded by the curve y = x², the x-axis and the lines x = 1 and x = 3 is',
    options: ['26/3 square units', '8 square units', '28/3 square units', '9 square units'],
    answer: 0,
    why: 'Area = ∫ from 1 to 3 of x² dx = [x³/3] from 1 to 3 = 27/3 − 1/3 = 26/3.',
  },
  {
    id: 'aa2',
    q: 'The area enclosed between the parabola y² = 4x and the line y = x is',
    options: ['16/3 square units', '4/3 square units', '4 square units', '8/3 square units'],
    answer: 3,
    why: 'They meet where x² = 4x, at x = 0 and x = 4. Between them the parabola is above the line, so Area = ∫ from 0 to 4 of (2√x − x) dx = [(4/3)x^(3/2) − x²/2] from 0 to 4 = 32/3 − 8 = 8/3.',
  },
  {
    id: 'aa3',
    q: 'The area enclosed by the ellipse x²/9 + y²/4 = 1 is',
    options: ['12π square units', '6π square units', '3π square units', '9π square units'],
    answer: 1,
    why: 'By symmetry the area is 4 × (the area in the first quadrant) = 4 ∫ from 0 to 3 of (2/3)√(9 − x²) dx = 6π. This agrees with the standard result πab = π × 3 × 2 = 6π.',
  },
  {
    id: 'aa4',
    q: 'The integral of x² from 0 to 2 is estimated with 4 equal strips using the right end of each strip. The estimate is',
    options: ['2.75', '2.667', '3.75', '3'],
    answer: 2,
    why: 'Each strip is 0.5 wide, and the right ends are x = 0.5, 1, 1.5, 2. Sum = 0.5 × (0.25 + 1 + 2.25 + 4) = 0.5 × 7.5 = 3.75. This is above the exact value 8/3 = 2.667 because x² is increasing.',
  },
  {
    id: 'aa5',
    q: 'The total area between the curve y = sin x and the x-axis from x = 0 to x = 2π is',
    options: ['0', '2', '8', '4'],
    answer: 3,
    why: 'The integral of sin x from 0 to 2π is 0 because the part above the axis (+2) cancels the part below (−2). The total area is the sum of the two areas: 2 × ∫ from 0 to π of sin x dx = 2 × 2 = 4.',
  },
];

/** The number each option stands for, so the tests can check the keyed option against an independent calculation. */
export const APPLY_VALUES: Record<string, number[]> = {
  aa1: [26 / 3, 8, 28 / 3, 9],
  aa2: [16 / 3, 4 / 3, 4, 8 / 3],
  aa3: [12 * PI, 6 * PI, 3 * PI, 9 * PI],
  aa4: [2.75, 2.667, 3.75, 3],
  aa5: [0, 2, 8, 4],
};

// ------------------------------------------------------------------ readings (Measure)
export interface Reading { key: string; fnLabel: string; a: number; b: number; rule: Rule; n: number; sum: number; exact: number }

/** Readings of the same function, interval and rule as the most recent one: these can be fitted together. */
export function sameGroup(rows: Reading[]): Reading[] {
  const last = rows[rows.length - 1];
  return last ? rows.filter((r) => r.key === last.key && r.rule === last.rule && r.a === last.a && r.b === last.b) : [];
}
/** How many different n were recorded for that group. */
export const distinctN = (rows: Reading[]) => new Set(sameGroup(rows).map((r) => r.n)).size;
