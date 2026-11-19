import { describe, expect, it } from 'vitest';
import {
  angularFringeWidth, APPLY, brightPosition, classify, darkPosition, envelope, fillWaveGrid, fringeWidth, fringeWidthInMedium, intensity, modelMaxOrder,
  modelPathDifference, modelZAtOrder, nearestOrder, pathDifference, pathOrder, PREDICTS, samplePattern, sheetShift, START, waveDisplacement, waveField, waveIntensity, waveModel,
  widthSingle, windowHalf, type YoungState,
} from './young';

const S = (o: Partial<YoungState> = {}): YoungState => ({ ...START, ...o });

describe('fringe geometry', () => {
  it('β = λD/d', () => {
    expect(fringeWidth(S({ lambda: 600, d: 0.5, D: 1.5 }))).toBeCloseTo(1.8e-3, 12);
    expect(fringeWidth(START)).toBeCloseTo(2.2e-3, 12);
    expect(angularFringeWidth(START)).toBeCloseTo(1.1e-3, 12);
  });
  it('scales as λ, D and 1/d', () => {
    const b = fringeWidth(START);
    expect(fringeWidth(S({ d: 1 }))).toBeCloseTo(b / 2, 12);
    expect(fringeWidth(S({ D: 1 }))).toBeCloseTo(b / 2, 12);
    expect(fringeWidth(S({ lambda: 275 }))).toBeCloseTo(b / 2, 12);
  });
  it('bright and dark fringe positions', () => {
    const b = fringeWidth(START);
    expect(brightPosition(START, 10)).toBeCloseTo(10 * b, 12);
    expect(darkPosition(START, 1)).toBeCloseTo(b / 2, 12);
    expect(darkPosition(START, 3)).toBeCloseTo(2.5 * b, 12);
  });
  it('a medium divides the fringe width by μ', () => {
    expect(fringeWidthInMedium(S({ lambda: 600, d: 0.5, D: 2 }), 4 / 3)).toBeCloseTo((fringeWidth(S({ lambda: 600, d: 0.5, D: 2 })) * 3) / 4, 12);
  });
  it('a thin sheet shifts the pattern by (μ − 1)tD/d', () => {
    expect(sheetShift(S({ d: 0.5, D: 1 }), 2e-6, 1.5)).toBeCloseTo(2e-3, 12);
  });
});

describe('exact path difference and intensity', () => {
  it('is zero on the axis and equals d y / D for small angles', () => {
    expect(pathDifference(START, 0)).toBeCloseTo(0, 15);
    const y = 5e-3;
    expect(pathDifference(START, y)).toBeCloseTo((0.5e-3 * y) / 2, 10);
  });
  it('is bright at nβ and dark at (n + ½)β', () => {
    for (const n of [0, 1, 2, 5, 8]) {
      const yb = brightPosition(START, n);
      expect(pathOrder(START, yb)).toBeCloseTo(n, 3);
      expect(classify(START, yb)).toBe('bright');
      expect(nearestOrder(START, yb)).toBe(n);
      const yd = (n + 0.5) * fringeWidth(START);
      expect(classify(START, yd)).toBe('dark');
    }
  });
  it('intensity is maximal at fringes, zero in the dark, and the centre is brightest', () => {
    expect(intensity(START, 0)).toBeCloseTo(1, 12);
    expect(intensity(START, darkPosition(START, 1))).toBeLessThan(1e-3);
    expect(intensity(START, brightPosition(START, 3))).toBeGreaterThan(0.9 * envelope(START, brightPosition(START, 3)));
  });
  it('fringes lie under a single-slit envelope: orders vanish at its minima', () => {
    // d / a = 10: the 10th-order bright fringe falls on the first envelope zero, so it is missing.
    const s = S({ d: 0.5, a: 50 });
    expect(intensity(s, brightPosition(s, 10))).toBeLessThan(1e-3);
    expect(intensity(s, brightPosition(s, 9))).toBeGreaterThan(0.01);
  });
  it('covering a slit removes the fringes and quarters the peak', () => {
    const one = S({ slit2: false });
    expect(intensity(one, 0)).toBeCloseTo(0.25, 12);
    const p = samplePattern(one, windowHalf(one, false), 801);
    let maxima = 0;
    for (let k = 1; k < p.i.length - 1; k++) if (p.i[k]! > p.i[k - 1]! && p.i[k]! >= p.i[k + 1]!) maxima++;
    expect(maxima).toBe(1); // one smooth band, no fringes
    expect(intensity(S({ slit1: false, slit2: false }), 0)).toBe(0);
    expect(widthSingle(START)).toBeCloseTo(44e-3, 9);
  });
  it('the sampled pattern has the expected number of maxima in the fringe window', () => {
    const half = windowHalf(START, false);
    const p = samplePattern(START, half, 4001);
    let peaks = 0;
    for (let k = 1; k < p.i.length - 1; k++) if (p.i[k]! > p.i[k - 1]! && p.i[k]! >= p.i[k + 1]! && p.i[k]! > 1e-3) peaks++;
    expect(peaks).toBe(17); // orders −8 … +8
  });
});

describe('magnified wave model', () => {
  const m = waveModel(START);
  it('has d = 4λ at the reference settings and scales in proportion', () => {
    expect(m.d / m.lambda).toBeCloseTo(4, 12);
    const m2 = waveModel(S({ d: 1 }));
    expect(m2.d / m2.lambda).toBeCloseTo(8, 12);
    const m3 = waveModel(S({ lambda: 275 }));
    expect(m3.d / m3.lambda).toBeCloseTo(8, 12);
    expect(m3.lambda).toBeCloseTo(m.lambda / 2, 12);
  });
  it('time-averaged intensity is ½|ψ|² and the displacement stays within ±|ψ|', () => {
    const f = waveField(m, START, 8, 1);
    expect(waveIntensity(f)).toBeCloseTo(0.5 * (f.re ** 2 + f.im ** 2), 12);
    for (const ph of [0, 1, 2, 3, 4, 5]) expect(Math.abs(waveDisplacement(f, ph))).toBeLessThanOrEqual(Math.hypot(f.re, f.im) + 1e-12);
  });
  it('along a far arc the minima fall where the path difference is (n + ½)λ and the maxima where it is nλ', () => {
    const R = 400;
    const arc = (deg: number) => ({ x: R * Math.cos((deg * Math.PI) / 180), z: R * Math.sin((deg * Math.PI) / 180) });
    // scan angle finely and find the local extrema of the intensity
    const vals: { deg: number; I: number; order: number }[] = [];
    for (let deg = 0; deg <= 89; deg += 0.01) {
      const { x, z } = arc(deg);
      vals.push({ deg, I: waveIntensity(waveField(m, START, x, z)), order: modelPathDifference(m, x, z) / m.lambda });
    }
    const maxima: number[] = [];
    const minima: number[] = [];
    for (let k = 1; k < vals.length - 1; k++) {
      if (vals[k]!.I > vals[k - 1]!.I && vals[k]!.I >= vals[k + 1]!.I) maxima.push(vals[k]!.order);
      if (vals[k]!.I < vals[k - 1]!.I && vals[k]!.I <= vals[k + 1]!.I) minima.push(vals[k]!.order);
    }
    for (const o of maxima) expect(Math.abs(o - Math.round(o))).toBeLessThan(0.01);
    for (const o of minima) expect(Math.abs(Math.abs(o) % 1 - 0.5)).toBeLessThan(0.01);
    expect(maxima.length).toBeGreaterThanOrEqual(3); // orders 0 (edge), 1, 2, 3
    expect(modelMaxOrder(m)).toBe(3);
    // with d = 4λ the order-4 maximum would need sinθ = 1: the last one that exists is 3
    expect(Math.max(...maxima)).toBeLessThanOrEqual(4.01);
  });
  it('covering a slit removes interference: intensity is smooth, with no nodal lines', () => {
    const one = { slit1: true, slit2: false };
    const I = (z: number) => waveIntensity(waveField(m, one, 20, z));
    const zs = Array.from({ length: 200 }, (_, k) => -12 + (24 * k) / 199);
    // a single source gives 1/r intensity: strictly decreasing with |z| and never zero
    const vals = zs.map(I);
    expect(Math.min(...vals)).toBeGreaterThan(0);
    const both = (z: number) => waveIntensity(waveField(m, START, 20, z));
    expect(Math.min(...zs.map(both))).toBeLessThan(0.1 * Math.max(...zs.map(both)));
  });
  it('fills a grid with the same numbers the field function returns', () => {
    const nx = 9, nz = 7;
    const out = new Float32Array(4 * nx * nz);
    fillWaveGrid(m, START, nx, nz, 24, 16, out);
    const f = waveField(m, START, (24 * 3) / 8, -16 + (32 * 2) / 6);
    const o = 4 * (2 * nx + 3);
    expect(out[o]).toBeCloseTo(f.re, 5);
    expect(out[o + 1]).toBeCloseTo(f.im, 5);
  });
});

describe('model screen solver', () => {
  const m = waveModel(START);
  it('finds the heights where the path difference is nλ or (n + ½)λ', () => {
    for (const o of [0.5, 1]) {
      const z = modelZAtOrder(m, 26, o, 10)!;
      expect(z).not.toBeNull();
      expect(modelPathDifference(m, 26, z) / m.lambda).toBeCloseTo(o, 9);
    }
  });
  it('the order-1 bright point has more intensity than the neighbouring order-½ dark point', () => {
    const zb = modelZAtOrder(m, 26, 1, 10)!;
    const zd = modelZAtOrder(m, 26, 0.5, 10)!;
    expect(waveIntensity(waveField(m, START, 26, zb))).toBeGreaterThan(4 * waveIntensity(waveField(m, START, 26, zd)));
  });
  it('centre is order 0 and an order that does not fit returns null', () => {
    expect(modelZAtOrder(m, 26, 0, 10)).toBe(0);
    expect(modelZAtOrder(m, 26, 30, 10)).toBeNull();
    expect(modelZAtOrder(m, 26, 2, 10)).toBeNull(); // the model screen is only +-10 wide: order 2 lies beyond it
  });
  it('the model grows more orders when d/λ grows', () => {
    expect(modelMaxOrder(waveModel(S({ d: 1 })))).toBeGreaterThan(modelMaxOrder(waveModel(START)));
  });
});

describe('teaching data', () => {
  it('prediction answers match the physics', () => {
    const [p1, p2, p3, p4] = PREDICTS as [(typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0]];
    expect(fringeWidth(p1.test) / fringeWidth(p1.base)).toBeCloseTo(0.5, 12);
    expect(p1.options[p1.answer]).toBe('They become half as wide');
    expect(fringeWidth(p2.test)).toBeLessThan(fringeWidth(p2.base));
    expect(p2.options[p2.answer]).toBe('They become narrower');
    expect(fringeWidth(p3.test) / fringeWidth(p3.base)).toBeCloseTo(2, 12);
    expect(p3.options[p3.answer]).toBe('It doubles');
    expect(intensity(p4.test, 0) / intensity(p4.base, 0)).toBeCloseTo(0.25, 12);
    expect(p4.options[p4.answer]).toMatch(/No fringes/);
    for (const p of PREDICTS) expect(p.why({ base: p.base, test: p.test }).length).toBeGreaterThan(60);
  });
  it('practice answers agree with the model', () => {
    const [a1, a2, a3, a4, a5] = APPLY as [(typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0]];
    expect(fringeWidth(S({ lambda: 600, d: 0.5, D: 1.5 }))).toBeCloseTo(1.8e-3, 12);
    expect(a1.options[a1.answer]).toBe('1.8 mm');
    expect(brightPosition(S({ lambda: 500, d: 0.25, D: 1 }), 10)).toBeCloseTo(20e-3, 12);
    expect(a2.options[a2.answer]).toBe('20 mm');
    expect(2.4 / (4 / 3)).toBeCloseTo(1.8, 12);
    expect(a3.options[a3.answer]).toBe('1.8 mm');
    expect(pathOrder(START, darkPosition(START, 3))).toBeCloseTo(2.5, 3);
    expect(a4.options[a4.answer]).toBe('2.5 λ');
    expect(sheetShift(S({ d: 0.5, D: 1 }), 2e-6, 1.5)).toBeCloseTo(2e-3, 12);
    expect(a5.options[a5.answer]).toBe('2 mm');
    for (const q of APPLY) expect(new Set(q.options).size).toBe(4);
    expect(APPLY.map((q) => q.answer)).toEqual([1, 3, 2, 0, 1]);
  });
});
