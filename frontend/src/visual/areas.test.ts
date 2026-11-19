import { describe, expect, it } from 'vitest';
import {
  APPLY, APPLY_VALUES, betweenAreas, convergenceSeries, difference, distinctN, enclosedArea, exactIntegral, findRoots, fitLogLog, FUNCTIONS, getFn, getPair, intersections, PAIRS,
  polyFn, PREDICTS, riemann, riemannError, RULES, sameGroup, signedAreas, slopeNote, strips, textbookSlope, type Reading, type Rule,
} from './areas';

/** Independent check: composite Simpson with many strips (not the lab's own code path). */
function simpson(f: (x: number) => number, a: number, b: number, N = 200000): number {
  const h = (b - a) / N;
  let s = f(a) + f(b);
  for (let i = 1; i < N; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Independent check for integrands with a square-root edge: substitute x = lo + t² so the integrand is smooth. */
function simpsonSqrtEdge(f: (x: number) => number, a: number, b: number): number {
  const T = Math.sqrt(b - a);
  return simpson((t) => f(a + t * t) * 2 * t, 0, T);
}
const tol = (v: number) => 1e-6 * Math.max(1, Math.abs(v));

describe('antiderivatives: F(b) - F(a) matches independent numerical integration', () => {
  const cases: [string, number, number][] = [
    ['x2', 0, 2], ['x2', -2, 3], ['x3', -1, 2], ['x3', 0, 2], ['sin', 0, Math.PI], ['sin', 0, 2 * Math.PI], ['sin', 1, 5], ['exp', 0, 1], ['exp', -2, 2.5],
    ['recip', 1, 3], ['recip', 0.5, 6], ['line', 0, 3], ['line', -1, 2], ['down', -2, 2], ['down', 0, 3], ['poly', -3, 3], ['poly', 0, 2],
  ];
  for (const [id, a, b] of cases) {
    it(`${id} on [${a.toFixed(3)}, ${b.toFixed(3)}]`, () => {
      const fn = getFn(id);
      expect(exactIntegral(fn, a, b)).toBeCloseTo(simpson(fn.f, a, b), 6);
    });
  }
  it('sqrt x, including the infinite slope at 0', () => {
    const fn = getFn('sqrt');
    for (const [a, b] of [[0, 4], [1, 4], [0, 9]] as const) expect(Math.abs(exactIntegral(fn, a, b) - simpsonSqrtEdge(fn.f, a, b))).toBeLessThan(1e-8);
    expect(exactIntegral(fn, 0, 4)).toBeCloseTo(16 / 3, 12);
  });
  it('known values', () => {
    expect(exactIntegral(getFn('x2'), 0, 2)).toBeCloseTo(8 / 3, 12);
    expect(exactIntegral(getFn('x3'), 0, 2)).toBeCloseTo(4, 12);
    expect(exactIntegral(getFn('sin'), 0, Math.PI)).toBeCloseTo(2, 12);
    expect(exactIntegral(getFn('exp'), 0, 1)).toBeCloseTo(Math.E - 1, 12);
    expect(exactIntegral(getFn('recip'), 1, Math.E)).toBeCloseTo(1, 12);
    expect(exactIntegral(getFn('line'), 0, 3)).toBeCloseTo(12, 12);
    expect(exactIntegral(getFn('down'), -2, 2)).toBeCloseTo(32 / 3, 12);
  });
  it('F is really an antiderivative: its slope equals f (central difference), for every function and the custom polynomial', () => {
    const list = [...FUNCTIONS, polyFn([2, -1, 0.5, -0.5])];
    for (const fn of list) {
      for (const t of [0.25, 0.5, 0.75]) {
        const x = Math.max(fn.lo + 0.1, fn.lo + t * (fn.hi - fn.lo)), h = 1e-5;
        expect((fn.F(x + h) - fn.F(x - h)) / (2 * h)).toBeCloseTo(fn.f(x), 5);
      }
    }
  });
  it('every function is defined over its whole handle range, and every preset sits inside it', () => {
    for (const fn of FUNCTIONS) {
      for (const x of [fn.lo, (fn.lo + fn.hi) / 2, fn.hi]) { expect(Number.isFinite(fn.f(x))).toBe(true); expect(Number.isFinite(fn.F(x))).toBe(true); }
      expect(fn.a0).toBeGreaterThanOrEqual(fn.lo); expect(fn.b0).toBeLessThanOrEqual(fn.hi);
      for (const p of fn.presets) { expect(p.a).toBeGreaterThanOrEqual(fn.lo - 1e-12); expect(p.b).toBeLessThanOrEqual(fn.hi + 1e-12); expect(p.a).toBeLessThan(p.b); }
    }
  });
  it('the custom polynomial uses its coefficients: c0 + c1 x + c2 x² + c3 x³ and c0 x + c1 x²/2 + c2 x³/3 + c3 x⁴/4', () => {
    const p = polyFn([1, 2, 3, 4]);
    expect(p.f(2)).toBe(1 + 4 + 12 + 32);
    expect(p.F(2)).toBeCloseTo(2 + 4 + 8 + 16, 12);
    expect(exactIntegral(p, 0, 1)).toBeCloseTo(1 + 1 + 1 + 1, 12);
    expect(polyFn([0, 0, 0, 0]).tex).toBe('f(x)=0');
    expect(polyFn([1, -1, 2, -3]).tex).toBe('f(x)=-3x^3+2x^2-x+1');
  });
});

describe('Riemann sums', () => {
  const f = (x: number) => x * x;
  it('worked values for x² on [0, 2] with 4 strips', () => {
    expect(riemann(f, 0, 2, 4, 'left')).toBeCloseTo(0.5 * (0 + 0.25 + 1 + 2.25), 12); // 1.75
    expect(riemann(f, 0, 2, 4, 'right')).toBeCloseTo(0.5 * (0.25 + 1 + 2.25 + 4), 12); // 3.75
    expect(riemann(f, 0, 2, 4, 'mid')).toBeCloseTo(0.5 * (0.0625 + 0.5625 + 1.5625 + 3.0625), 12); // 2.625
    expect(riemann(f, 0, 2, 4, 'trap')).toBeCloseTo(2.75, 12);
  });
  it('trapezoid = average of left and right, for any function and n', () => {
    for (const fn of FUNCTIONS) for (const n of [1, 3, 10, 57]) {
      const a = Math.max(fn.lo, fn.a0), b = fn.b0;
      expect((riemann(fn.f, a, b, n, 'left') + riemann(fn.f, a, b, n, 'right')) / 2).toBeCloseTo(riemann(fn.f, a, b, n, 'trap'), 10);
    }
  });
  it('a constant is summed exactly by every rule, for every n', () => {
    for (const r of RULES) for (const n of [1, 7, 200]) expect(riemann(() => 3, 1, 4, n, r)).toBeCloseTo(9, 10);
  });
  it('increasing function: left sum < exact < right sum; decreasing: the other way round', () => {
    for (const fn of [getFn('x2'), getFn('exp'), getFn('line'), getFn('sqrt')]) {
      const e = exactIntegral(fn, 0, 2);
      expect(riemann(fn.f, 0, 2, 6, 'left')).toBeLessThan(e);
      expect(riemann(fn.f, 0, 2, 6, 'right')).toBeGreaterThan(e);
    }
    const dec = getFn('recip');
    const e = exactIntegral(dec, 1, 3);
    expect(riemann(dec.f, 1, 3, 6, 'left')).toBeGreaterThan(e);
    expect(riemann(dec.f, 1, 3, 6, 'right')).toBeLessThan(e);
  });
  it('convex function: midpoint under, trapezoid over (x²)', () => {
    expect(riemann(f, 0, 2, 4, 'mid')).toBeLessThan(8 / 3);
    expect(riemann(f, 0, 2, 4, 'trap')).toBeGreaterThan(8 / 3);
    expect(riemannError(getFn('x2'), 0, 2, 4, 'trap')).toBeCloseTo(2.75 - 8 / 3, 12);
  });
  it('midpoint and trapezoid are exact for a straight line, left and right are not', () => {
    const l = getFn('line');
    expect(riemannError(l, 0, 3, 5, 'mid')).toBeCloseTo(0, 12);
    expect(riemannError(l, 0, 3, 5, 'trap')).toBeCloseTo(0, 12);
    expect(Math.abs(riemannError(l, 0, 3, 5, 'left'))).toBeGreaterThan(1);
  });
  it('the sum approaches the exact integral as n grows (limit of a sum), for every rule and function', () => {
    for (const fn of FUNCTIONS) for (const r of RULES) {
      const e = exactIntegral(fn, fn.a0, fn.b0);
      expect(Math.abs(riemann(fn.f, fn.a0, fn.b0, 20000, r) - e)).toBeLessThan(2e-3 * Math.max(1, Math.abs(e)));
    }
  });
  it('strips: widths add up to b - a and heights follow the rule', () => {
    for (const r of RULES) {
      const s = strips(f, 0, 2, 4, r);
      expect(s).toHaveLength(4);
      expect(s[0]!.x0).toBe(0);
      expect(s[3]!.x1).toBeCloseTo(2, 12);
      expect(s.reduce((t, q) => t + (q.x1 - q.x0), 0)).toBeCloseTo(2, 12);
      const area = s.reduce((t, q) => t + ((q.x1 - q.x0) * (q.y0 + q.y1)) / 2, 0);
      expect(area).toBeCloseTo(riemann(f, 0, 2, 4, r), 12);
    }
    expect(strips(f, 0, 2, 4, 'left')[1]!.y0).toBeCloseTo(0.25, 12);
    expect(strips(f, 0, 2, 4, 'right')[1]!.y0).toBeCloseTo(1, 12);
    expect(strips(f, 0, 2, 4, 'mid')[1]!.y0).toBeCloseTo(0.5625, 12);
  });
  it('convergenceSeries has one point for each n from 1 to 200 and matches riemann()', () => {
    const s = convergenceSeries(f, 0, 2, 'mid');
    expect(s).toHaveLength(200);
    expect(s[0]!.n).toBe(1);
    expect(s[199]!.n).toBe(200);
    expect(s[9]!.sum).toBeCloseTo(riemann(f, 0, 2, 10, 'mid'), 12);
  });
});

describe('convergence rates (the slope of log error against log n)', () => {
  const errs = (id: string, a: number, b: number, rule: Rule, ns = [4, 8, 16, 32]) => ns.map((n) => ({ n, err: riemannError(getFn(id), a, b, n, rule) }));
  it('textbook values', () => {
    expect(textbookSlope('left')).toBe(-1);
    expect(textbookSlope('right')).toBe(-1);
    expect(textbookSlope('mid')).toBe(-2);
    expect(textbookSlope('trap')).toBe(-2);
  });
  it('left and right: slope -1 for smooth functions with f(a) ≠ f(b)', () => {
    for (const [id, a, b] of [['x2', 0, 2], ['exp', 0, 1], ['recip', 1, 3], ['x3', 0, 2], ['down', 0, 2], ['line', 0, 3]] as const) {
      for (const r of ['left', 'right'] as const) expect(fitLogLog(errs(id, a, b, r))!.slope).toBeCloseTo(-1, 0);
    }
    // tighter for a clean case
    expect(fitLogLog(errs('x2', 0, 2, 'left'))!.slope).toBeGreaterThan(-1.2);
    expect(fitLogLog(errs('x2', 0, 2, 'left'))!.slope).toBeLessThan(-0.85);
  });
  it('midpoint and trapezoid: slope -2 for smooth functions', () => {
    for (const [id, a, b] of [['x2', 0, 2], ['exp', 0, 1], ['recip', 1, 3], ['x3', 0, 2], ['sin', 0, Math.PI]] as const) {
      for (const r of ['mid', 'trap'] as const) expect(fitLogLog(errs(id, a, b, r))!.slope).toBeCloseTo(-2, 1);
    }
  });
  it('doubling n: the midpoint error becomes about one quarter, the left error about one half', () => {
    const e = (n: number, r: Rule) => Math.abs(riemannError(getFn('exp'), 0, 1, n, r));
    expect(e(16, 'mid') / e(8, 'mid')).toBeCloseTo(0.25, 1);
    expect(e(16, 'left') / e(8, 'left')).toBeCloseTo(0.5, 1);
  });
  it('exceptions the page explains: f(a) = f(b) speeds up left/right; a line is exact; √x at 0 gives -1.5', () => {
    expect(fitLogLog(errs('sin', 0, Math.PI, 'left'))!.slope).toBeCloseTo(-2, 1);
    expect(slopeNote(getFn('sin'), 0, Math.PI, 'left')).toMatch(/f\(a\) = f\(b\)/);
    expect(fitLogLog(errs('line', 0, 3, 'mid'))).toBeNull();
    expect(slopeNote(getFn('line'), 0, 3, 'mid')).toMatch(/exact/);
    expect(slopeNote(polyFn([1, 2, 0, 0]), 0, 2, 'trap')).toMatch(/straight line/);
    expect(slopeNote(polyFn([1, 2, 1, 0]), 0, 2, 'trap')).toBeNull();
    expect(fitLogLog(errs('sqrt', 0, 4, 'mid', [16, 32, 64, 128, 256]))!.slope).toBeCloseTo(-1.5, 1);
    expect(slopeNote(getFn('sqrt'), 0, 4, 'mid')).toMatch(/1\.5/);
    expect(slopeNote(getFn('x2'), 0, 2, 'left')).toBeNull();
  });
  it('fitLogLog recovers a known power law and rejects too little data', () => {
    const pts = [4, 8, 16, 32].map((n) => ({ n, err: 3 * n ** -1.7 }));
    const f = fitLogLog(pts)!;
    expect(f.slope).toBeCloseTo(-1.7, 10);
    expect(Math.exp(f.intercept)).toBeCloseTo(3, 8);
    expect(fitLogLog([{ n: 4, err: 1 }])).toBeNull();
    expect(fitLogLog([{ n: 4, err: 1 }, { n: 4, err: 2 }])).toBeNull();
    expect(fitLogLog([{ n: 4, err: 0 }, { n: 8, err: 0 }])).toBeNull();
  });
  it('error shrinks as n grows for every rule on x²', () => {
    for (const r of RULES) {
      let prev = Infinity;
      for (const n of [2, 4, 8, 16, 32, 64]) { const e = Math.abs(riemannError(getFn('x2'), 0, 2, n, r)); expect(e).toBeLessThan(prev); prev = e; }
    }
  });
});

describe('roots and intersections', () => {
  it('findRoots: sin x on [0.5, 10] has zeros at π, 2π, 3π', () => {
    const r = findRoots(Math.sin, 0.5, 10);
    expect(r).toHaveLength(3);
    [1, 2, 3].forEach((k, i) => expect(r[i]).toBeCloseTo(k * Math.PI, 8));
  });
  it('findRoots: none for x² + 1, and a grid-point zero is found', () => {
    expect(findRoots((x) => x * x + 1, -3, 3)).toHaveLength(0);
    expect(findRoots((x) => x, -1, 1)).toHaveLength(1);
  });
  it('findRoots skips undefined (NaN) stretches', () => {
    expect(findRoots((x) => Math.sqrt(x) - 1, -1, 4)).toEqual([expect.closeTo(1, 8)]);
  });
  const expected: Record<string, number[]> = {
    'par-line': [0, 1], 'par-line2': [0, 2], 'par-par': [-2, 1], 'y2-4x': [0, 4], circle: [0, 1], ellipse: [0, 2],
  };
  for (const p of PAIRS) {
    it(`intersections of ${p.id}: ${p.eq}`, () => {
      const r = intersections(p);
      expect(r).toHaveLength(expected[p.id]!.length);
      expected[p.id]!.forEach((x, i) => {
        expect(r[i]).toBeCloseTo(x, 6);
        expect(p.upper.f(r[i]!)).toBeCloseTo(p.lower.f(r[i]!), 6); // both curves really meet there
      });
    });
  }
  it('every pair has the upper curve above the lower one between the intersections', () => {
    for (const p of PAIRS) {
      const r = intersections(p);
      const mid = (r[0]! + r[1]!) / 2;
      expect(p.upper.f(mid)).toBeGreaterThan(p.lower.f(mid));
    }
  });
  it('every pair has an antiderivative that matches independent integration of upper and lower', () => {
    for (const p of PAIRS) {
      const r = intersections(p);
      const [a, b] = [r[0]!, r[1]!];
      for (const c of [p.upper, p.lower]) {
        const num = p.id === 'y2-4x' && c === p.upper ? simpsonSqrtEdge(c.f, a, b) : p.id === 'circle' || p.id === 'ellipse' ? simpson(c.f, a, b, 400000) : simpson(c.f, a, b);
        expect(Math.abs(c.F(b) - c.F(a) - num)).toBeLessThan(1e-4 * (p.id === 'circle' || p.id === 'ellipse' ? 1 : 1e-2) + 1e-5);
      }
    }
  });
});

describe('area between curves', () => {
  const known: Record<string, number> = {
    'par-line': 1 / 6, 'par-line2': 4 / 3, 'par-par': 9 / 2, 'y2-4x': 8 / 3, circle: Math.PI / 4 - 1 / 2, ellipse: Math.PI / 2 - 1,
  };
  for (const p of PAIRS) {
    it(`${p.id}: enclosed area = ${known[p.id]!.toFixed(5)} (exact), and equals an independent numerical integral of |upper − lower|`, () => {
      const e = enclosedArea(p);
      expect(e.area).toBeCloseTo(known[p.id]!, 9);
      const d = (x: number) => Math.abs(p.upper.f(x) - p.lower.f(x));
      const num = p.id === 'y2-4x' ? simpsonSqrtEdge((x) => p.upper.f(x) - p.lower.f(x), e.x0, e.x1) : p.id === 'circle' || p.id === 'ellipse' ? simpson(d, e.x0, e.x1, 2_000_000) : simpson(d, e.x0, e.x1);
      expect(Math.abs(e.area - num)).toBeLessThan(p.id === 'circle' || p.id === 'ellipse' ? 1e-5 : 1e-7);
    });
  }
  it('the integral of the difference equals the area when upper ≥ lower, and splits at a crossing otherwise', () => {
    const p = getPair('par-line');
    const full = betweenAreas(p, 0, 1);
    expect(full.signed).toBeCloseTo(full.total, 12);
    // limits wider than the region: x² is above x for x > 1, so the signed integral falls while the area rises
    const wide = betweenAreas(p, 0, 2);
    expect(wide.roots).toHaveLength(1);
    expect(wide.roots[0]).toBeCloseTo(1, 6);
    expect(wide.signed).toBeCloseTo(2 - 8 / 3, 10); // ∫(x - x²) from 0 to 2
    expect(wide.total).toBeCloseTo(1 / 6 + (8 / 3 - 1 / 3 - (2 - 1 / 2)), 10); // 1/6 + [∫x² - ∫x from 1 to 2]
    expect(wide.total).toBeGreaterThan(wide.signed);
  });
  it('difference() subtracts both the function and the antiderivative', () => {
    const d = difference(getPair('par-line'));
    expect(d.f(0.5)).toBeCloseTo(0.5 - 0.25, 12);
    expect(d.F(1) - d.F(0)).toBeCloseTo(1 / 6, 12);
  });
});

describe('signed area and total area', () => {
  it('sin x over [0, 2π]: integral 0, area above 2, area below 2, total 4', () => {
    const s = signedAreas(getFn('sin'), 0, 2 * Math.PI);
    expect(s.signed).toBeCloseTo(0, 12);
    expect(s.above).toBeCloseTo(2, 10);
    expect(s.below).toBeCloseTo(2, 10);
    expect(s.total).toBeCloseTo(4, 10);
    expect(s.roots).toHaveLength(1);
    expect(s.roots[0]).toBeCloseTo(Math.PI, 8);
    expect(s.total).toBeCloseTo(simpson((x) => Math.abs(Math.sin(x)), 0, 2 * Math.PI), 6);
  });
  it('sin x over [0, π] is all above the axis', () => {
    const s = signedAreas(getFn('sin'), 0, Math.PI);
    expect(s.below).toBe(0);
    expect(s.signed).toBeCloseTo(2, 12);
    expect(s.total).toBeCloseTo(2, 12);
    expect(s.roots).toHaveLength(0);
  });
  it('symmetry: odd functions give 0 on [−c, c] but positive total area; even functions give twice the half', () => {
    for (const c of [1, 2, 3]) {
      const o = signedAreas(getFn('x3'), -c, c);
      expect(o.signed).toBeCloseTo(0, 12);
      expect(o.total).toBeCloseTo(simpson((x) => Math.abs(x * x * x), -c, c), 6);
      const e = signedAreas(getFn('x2'), -c, c);
      expect(e.signed).toBeCloseTo(2 * exactIntegral(getFn('x2'), 0, c), 12);
    }
    const down = signedAreas(getFn('down'), -3, 3); // 4 − x² is even
    expect(down.signed).toBeCloseTo(2 * exactIntegral(getFn('down'), 0, 3), 12);
    expect(down.roots).toHaveLength(2);
    expect(down.signed).toBeCloseTo(down.above - down.below, 12);
    expect(down.total).toBeCloseTo(simpson((x) => Math.abs(4 - x * x), -3, 3), 6);
  });
  it('total area equals ∫|f| numerically for every function on its default interval and on its widest interval', () => {
    for (const fn of FUNCTIONS) {
      for (const [a, b] of [[fn.a0, fn.b0], [fn.lo, fn.hi]] as const) {
        const s = signedAreas(fn, a, b);
        const num = fn.id === 'sqrt' ? simpsonSqrtEdge((x) => Math.abs(fn.f(x)), a, b) : simpson((x) => Math.abs(fn.f(x)), a, b);
        expect(Math.abs(s.total - num)).toBeLessThan(1e-5 * Math.max(1, num));
        expect(s.signed).toBeCloseTo(exactIntegral(fn, a, b), 9);
        expect(s.above + s.below).toBeCloseTo(s.total, 12);
      }
    }
  });
  it('pieces add up to the signed integral', () => {
    const s = signedAreas(getFn('x3'), -1, 2);
    expect(s.pieces.reduce((t, p) => t + p.value, 0)).toBeCloseTo(exactIntegral(getFn('x3'), -1, 2), 12);
    expect(s.pieces).toHaveLength(2);
  });
});

describe('predictions: each answer is recomputed', () => {
  it('there are four, with four options each, and the answer index is valid', () => {
    expect(PREDICTS).toHaveLength(4);
    for (const p of PREDICTS) { expect(p.options).toHaveLength(4); expect(p.answer).toBeGreaterThanOrEqual(0); expect(p.answer).toBeLessThan(4); expect(p.why(p.test).length).toBeGreaterThan(30); }
  });
  it('a1: doubling n makes the midpoint error about one quarter', () => {
    const p = PREDICTS.find((x) => x.id === 'a1')!;
    const ratio = Math.abs(riemannError(getFn(p.test.fn), p.test.a, p.test.b, 16, 'mid')) / Math.abs(riemannError(getFn(p.base.fn), p.base.a, p.base.b, 8, 'mid'));
    expect(ratio).toBeCloseTo(0.25, 1);
    expect(p.options[p.answer]).toMatch(/quarter/);
    expect(p.test.n).toBe(2 * p.base.n);
    expect(p.test.rule).toBe('mid');
    // an independent check of those errors
    const exactNum = simpson(Math.exp, 0, 1);
    const mid8 = (1 / 8) * Array.from({ length: 8 }, (_, i) => Math.exp((i + 0.5) / 8)).reduce((t, v) => t + v, 0);
    expect(Math.abs(mid8 - exactNum)).toBeCloseTo(Math.abs(riemannError(getFn('exp'), 0, 1, 8, 'mid')), 8);
  });
  it('a2: for an increasing function the right-endpoint sum is the one that overestimates', () => {
    const p = PREDICTS.find((x) => x.id === 'a2')!;
    const fn = getFn('x2');
    const exact = simpson(fn.f, 0, 2);
    expect(riemann(fn.f, 0, 2, 4, 'right')).toBeGreaterThan(exact);
    expect(riemann(fn.f, 0, 2, 4, 'left')).toBeLessThan(exact);
    expect(p.options[p.answer]).toBe('Right-endpoint rectangles');
    expect(p.test.rule).toBe('right');
  });
  it('a3: the integral of x³ from −2 to 2 is 0 (and the total area is 8)', () => {
    const p = PREDICTS.find((x) => x.id === 'a3')!;
    expect(simpson((x) => x ** 3, -2, 2)).toBeCloseTo(0, 8);
    expect(simpson((x) => Math.abs(x) ** 3, -2, 2)).toBeCloseTo(8, 6);
    expect(p.options[p.answer]).toBe('0');
    expect(p.options).toContain('8'); // the tempting wrong answer: the total area
    expect(p.test.mode).toBe('signed');
    expect(p.why(p.test)).toContain('8');
  });
  it('a4: the parabola y = x² and the line y = x enclose 1/6', () => {
    const p = PREDICTS.find((x) => x.id === 'a4')!;
    expect(simpson((x) => x - x * x, 0, 1)).toBeCloseTo(1 / 6, 9);
    expect(p.options[p.answer]).toBe('1/6');
    expect(p.test.a).toBe(0);
    expect(p.test.b).toBe(1);
    expect(betweenAreas(getPair(p.test.pair), p.test.a, p.test.b).total).toBeCloseTo(1 / 6, 10);
  });
  it('every scenario names a real function and pair and stays inside the handle range', () => {
    for (const p of PREDICTS) for (const s of [p.base, p.test]) {
      const fn = getFn(s.fn), pair = getPair(s.pair);
      if (s.mode === 'between') { expect(s.a).toBeGreaterThanOrEqual(pair.lo); expect(s.b).toBeLessThanOrEqual(pair.hi); }
      else { expect(s.a).toBeGreaterThanOrEqual(fn.lo); expect(s.b).toBeLessThanOrEqual(fn.hi); }
      expect(s.a).toBeLessThan(s.b);
      expect(s.n).toBeGreaterThanOrEqual(1); expect(s.n).toBeLessThanOrEqual(200);
    }
  });
});

describe('practice questions: every key is recomputed independently', () => {
  it('five questions, four options each, distinct option values, explanations present, keys spread over positions', () => {
    expect(APPLY).toHaveLength(5);
    for (const q of APPLY) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.why.length).toBeGreaterThan(40);
      const vals = APPLY_VALUES[q.id]!;
      expect(vals).toHaveLength(4);
      expect(new Set(vals.map((v) => v.toFixed(2))).size).toBe(4);
    }
    expect(new Set(APPLY.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
  });
  const keyed = (id: string) => { const q = APPLY.find((x) => x.id === id)!; return APPLY_VALUES[id]![q.answer]!; };
  it('aa1: area under y = x² from 1 to 3', () => {
    expect(keyed('aa1')).toBeCloseTo(simpson((x) => x * x, 1, 3), 7);
    expect(APPLY[0]!.options[APPLY[0]!.answer]).toMatch(/^26\/3/);
  });
  it('aa2: area between y² = 4x and y = x', () => {
    const num = simpsonSqrtEdge((x) => 2 * Math.sqrt(x) - x, 0, 4);
    expect(keyed('aa2')).toBeCloseTo(num, 6);
    expect(APPLY[1]!.options[APPLY[1]!.answer]).toMatch(/^8\/3/);
    // independent check by integrating in y instead: x runs from y²/4 to y, y from 0 to 4
    expect(simpson((y) => y - (y * y) / 4, 0, 4)).toBeCloseTo(8 / 3, 8);
  });
  it('aa3: area of the ellipse x²/9 + y²/4 = 1', () => {
    const quarter = simpson((x) => 2 * Math.sqrt(Math.max(0, 1 - (x * x) / 9)), 0, 3, 2_000_000);
    expect(keyed('aa3')).toBeCloseTo(4 * quarter, 4);
    expect(APPLY[2]!.options[APPLY[2]!.answer]).toBe('6π square units');
  });
  it('aa4: right-endpoint sum of x² on [0, 2] with 4 strips', () => {
    const hand = 0.5 * (0.5 ** 2 + 1 ** 2 + 1.5 ** 2 + 2 ** 2);
    expect(keyed('aa4')).toBeCloseTo(hand, 12);
    expect(riemann((x) => x * x, 0, 2, 4, 'right')).toBeCloseTo(3.75, 12);
    expect(APPLY[3]!.options[APPLY[3]!.answer]).toBe('3.75');
    expect(3.75).toBeGreaterThan(8 / 3);
    // the distractors are the left sum, the exact value to 3 places, and a wrong estimate
    expect(riemann((x) => x * x, 0, 2, 4, 'trap')).toBeCloseTo(2.75, 12);
    expect(8 / 3).toBeCloseTo(2.667, 3);
  });
  it('aa5: total area between sin x and the x-axis from 0 to 2π', () => {
    expect(keyed('aa5')).toBeCloseTo(simpson((x) => Math.abs(Math.sin(x)), 0, 2 * Math.PI), 6);
    expect(simpson(Math.sin, 0, 2 * Math.PI)).toBeCloseTo(0, 8);
    expect(APPLY[4]!.options[APPLY[4]!.answer]).toBe('4');
  });
  it('the value lists line up with the option text', () => {
    const num = (s: string) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]!.split(' ')[0]) : s.includes('π') ? Number(s.split('π')[0]) * Math.PI : Number(s.split(' ')[0]));
    for (const q of APPLY) q.options.forEach((o, i) => expect(num(o)).toBeCloseTo(APPLY_VALUES[q.id]![i]!, 2));
  });
});

describe('readings', () => {
  const row = (n: number, rule: Rule = 'mid', key = 'x2', a = 0, b = 2): Reading => ({ key, fnLabel: 'x²', a, b, rule, n, sum: 1, exact: 1 });
  it('counts distinct n for the same function, interval and rule as the latest reading', () => {
    expect(distinctN([])).toBe(0);
    expect(distinctN([row(4), row(8), row(16)])).toBe(3);
    expect(distinctN([row(4), row(4), row(8)])).toBe(2);
    expect(distinctN([row(4, 'left'), row(8, 'left'), row(16, 'mid')])).toBe(1);
    expect(distinctN([row(4, 'mid', 'x3'), row(8), row(16)])).toBe(2);
    expect(distinctN([row(4, 'mid', 'x2', 0, 1), row(8), row(16)])).toBe(2);
    expect(sameGroup([row(4, 'left'), row(8), row(16)])).toHaveLength(2);
  });
});
