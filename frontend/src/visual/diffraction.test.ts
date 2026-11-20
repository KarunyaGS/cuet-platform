import { describe, expect, it } from 'vitest';
import { isVisibleLight, posFromSlitIn, slitFromPosIn, wavelengthRgb, angularWidth, APPLY, curve, farField, fresnelCS, fresnelDistance, fresnelField, fresnelNumber, intensityAt, maxOrder, minimumPosition, posFromSlit, PREDICTS, regime, sig2, slitFromPos, START, widthFormula, widthMeasured, type DiffState } from './diffraction';

const S = (o: Partial<DiffState> = {}): DiffState => ({ ...START, ...o });

describe('Fresnel integrals', () => {
  it('match tabulated values', () => {
    const a = fresnelCS(1);
    expect(a.C).toBeCloseTo(0.7799, 3);
    expect(a.S).toBeCloseTo(0.4383, 3);
    const b = fresnelCS(0.5);
    expect(b.C).toBeCloseTo(0.4923, 3);
    expect(b.S).toBeCloseTo(0.0647, 3);
  });
  it('are odd, start at zero and tend to 1/2', () => {
    expect(fresnelCS(0).C).toBe(0);
    expect(fresnelCS(-2).C).toBeCloseTo(-fresnelCS(2).C, 12);
    expect(Math.abs(fresnelCS(24.99).C - 0.5)).toBeLessThan(1 / (Math.PI * 24.99) + 1e-3); // oscillates about 1/2 with amplitude 1/(πx)
    expect(Math.abs(fresnelCS(30).C - 0.5)).toBeLessThan(0.011);
    expect(Math.abs(fresnelCS(30).S - 0.5)).toBeLessThan(0.011);
  });
  it('are continuous across the table edge', () => {
    expect(Math.abs(fresnelCS(24.999).C - fresnelCS(25.001).C)).toBeLessThan(2e-3);
  });
});

describe('single-slit patterns', () => {
  it('a very wide slit passes about the open beam at the centre', () => {
    const v = fresnelField(S({ a: 2000, D: 0.3 }), 0);
    expect(v).toBeGreaterThan(0.7);
    expect(v).toBeLessThan(1.5);
  });
  it('Fresnel and Fraunhofer agree in the far field (small Fresnel number)', () => {
    const s = S({ a: 50, lambda: 600, D: 3 });
    expect(fresnelNumber(s)).toBeLessThan(0.01);
    const c = curve(s);
    let worst = 0;
    c.i.forEach((v, k) => {
      worst = Math.max(worst, Math.abs(v - c.far![k]!));
    });
    expect(worst).toBeLessThan(0.01);
  });
  it('central peak brightness is the Fresnel number for a narrow slit', () => {
    const s = S({ a: 50, lambda: 600, D: 3 });
    expect(curve(s).peak).toBeCloseTo(fresnelNumber(s), 3);
  });
  it('first minimum falls where a sin θ = λ, and the zero is a true zero', () => {
    const s = S({ a: 100, lambda: 500, D: 2, lens: true, f: 0.5 });
    const y1 = minimumPosition(s, 1)!;
    expect(y1).toBeCloseTo(0.5 * Math.tan(Math.asin(500e-9 / 100e-6)), 9);
    expect(farField(s, y1)).toBeLessThan(1e-12);
    expect(farField(s, 0)).toBe(1);
  });
  it('width = 2λD/a, matches the exact first minima, and the lens replaces D by f', () => {
    const s = S({ a: 200, lambda: 500, D: 1.6 });
    expect(widthFormula(s)).toBeCloseTo(8e-3, 9);
    expect(widthMeasured(s)!).toBeCloseTo(8e-3, 5);
    const l = S({ a: 100, lambda: 600, lens: true, f: 0.5 });
    expect(widthFormula(l)).toBeCloseTo(6e-3, 9);
    expect(angularWidth(S({ a: 100, lambda: 500 }))).toBeCloseTo(1e-2, 9);
  });
  it('width scales as 1/a, with λ and with D', () => {
    const base = widthFormula(S({ a: 100 }));
    expect(widthFormula(S({ a: 50 }))).toBeCloseTo(2 * base, 9);
    expect(widthFormula(S({ a: 100, lambda: 275 }))).toBeCloseTo(base / 2, 9);
    expect(widthFormula(S({ a: 100, D: 1 }))).toBeCloseTo(base / 2, 9);
  });
  it('counts the minima allowed by the slit width', () => {
    const s = S({ a: 4.5, lambda: 1000 });
    expect(maxOrder(s)).toBe(4);
    expect(minimumPosition(s, 4)).not.toBeNull();
    expect(minimumPosition(s, 5)).toBeNull();
  });
  it('secondary maxima are about 4.7 % and 1.6 % of the central peak', () => {
    const s = S({ a: 100, lambda: 500, lens: true, f: 1 });
    const c = curve(s, 8001);
    const half = c.i.length >> 1;
    const find = (lo: number, hi: number) => {
      let m = 0;
      for (let k = half; k < c.y.length; k++) if (c.y[k]! > lo && c.y[k]! < hi) m = Math.max(m, c.i[k]!);
      return m;
    };
    const y1 = minimumPosition(s, 1)!, y2 = minimumPosition(s, 2)!, y3 = minimumPosition(s, 3)!;
    expect(find(y1, y2)).toBeCloseTo(0.0472, 3);
    expect(find(y2, y3)).toBeCloseTo(0.0165, 3);
  });
  it('classifies the regime from the Fresnel number', () => {
    expect(regime(S({ a: 100, D: 2 }))).toBe('far');
    expect(regime(S({ a: 1000, D: 0.3 }))).toBe('near');
    expect(regime(S({ a: 1000, D: 0.3, lens: true, f: 0.5 }))).toBe('far');
    expect(widthMeasured(S({ a: 1000, D: 0.3 }))).toBeNull();
  });
  it('Fresnel distance a²/λ', () => {
    expect(fresnelDistance(S({ a: 2000, lambda: 500 }))).toBeCloseTo(8, 9);
  });
  it('probe: intensity at the n-th minimum is about zero', () => {
    const s = S({ a: 100, lambda: 500, lens: true, f: 0.5 });
    const c = curve(s);
    const y2 = minimumPosition(s, 2)!;
    expect(intensityAt(s, y2, c.peak)).toBeLessThan(1e-10);
  });
});

describe('slider mapping and teaching data', () => {
  it('slit width runs 5 µm to 2000 µm on a log scale and round-trips', () => {
    expect(slitFromPos(0)).toBe(5);
    expect(slitFromPos(100)).toBe(2000);
    for (const a of [5, 10, 100, 1000, 2000]) expect(Math.abs(slitFromPos(posFromSlit(a)) / a - 1)).toBeLessThan(0.06); // one slider step is about 6 %
    expect(sig2(1234)).toBe(1200);
  });
  it('predictions: the keyed answer matches the model', () => {
    const [p1, p2, p3, p4] = PREDICTS as [(typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0]];
    expect(widthFormula(p1.test) / widthFormula(p1.base)).toBeCloseTo(2, 9);
    expect(p1.options[p1.answer]).toBe('It becomes twice as wide');
    expect(widthFormula(p2.test)).toBeLessThan(widthFormula(p2.base));
    expect(p2.options[p2.answer]).toBe('It becomes narrower');
    expect(widthFormula(p3.test) / widthFormula(p3.base)).toBeCloseTo(2, 9);
    expect(p3.options[p3.answer]).toBe('It becomes twice as wide');
    expect(regime(p4.test)).toBe('near');
    expect(fresnelNumber(p4.test)).toBeGreaterThan(1);
    expect(p4.options[p4.answer]).toMatch(/near field/);
    for (const p of PREDICTS) expect(p.why({ base: p.base, test: p.test }).length).toBeGreaterThan(40);
  });
  it('practice answers agree with the model', () => {
    const [a1, a2, a3, a4, a5] = APPLY as [(typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0]];
    expect(widthFormula(S({ a: 200, lambda: 500, D: 1.6 }))).toBeCloseTo(8e-3, 9);
    expect(a1.options[a1.answer]).toBe('8 mm');
    expect(widthFormula(S({ a: 100, lambda: 600, lens: true, f: 0.5 }))).toBeCloseTo(6e-3, 9);
    expect(a2.options[a2.answer]).toBe('6 mm wide');
    expect(maxOrder(S({ a: 4.5, lambda: 1000 })) * 2).toBe(8);
    expect(a3.options[a3.answer]).toBe('8');
    expect(450 / 700).toBeCloseTo(0.643, 3);
    expect(a4.options[a4.answer]).toBe('64 % of its value');
    expect(fresnelDistance(S({ a: 2000, lambda: 500 }))).toBeCloseTo(8, 9);
    expect(a5.options[a5.answer]).toBe('8 m');
    for (const q of APPLY) expect(new Set(q.options).size).toBe(4);
    expect(APPLY.map((q) => q.answer)).toEqual([1, 3, 0, 2, 1]);
  });
});

describe('custom slit-width and wavelength ranges', () => {
  const def = { min: 5, max: 2000 };
  it('the default range keeps the original slider mapping exactly', () => {
    for (let pos = 0; pos <= 100; pos += 5) {
      expect(slitFromPosIn(def, pos)).toBe(slitFromPos(pos));
      expect(posFromSlitIn(def, slitFromPos(pos))).toBe(posFromSlit(slitFromPos(pos)));
    }
  });
  it('a custom range reaches both of its ends', () => {
    for (const r of [{ min: 1, max: 50 }, { min: 90, max: 110 }, { min: 0.5, max: 20000 }]) {
      expect(slitFromPosIn(r, 0)).toBeCloseTo(r.min, 1);
      expect(slitFromPosIn(r, 100) / r.max).toBeGreaterThan(0.98);
      expect(slitFromPosIn(r, 100) / r.max).toBeLessThan(1.02);
    }
  });
  it('a narrow custom range keeps neighbouring slider positions distinct', () => {
    const r = { min: 90, max: 110 };
    const values = new Set(Array.from({ length: 101 }, (_, p) => slitFromPosIn(r, p)));
    expect(values.size).toBeGreaterThan(20);
  });
  it('the pattern is finite at extreme custom values', () => {
    for (const s of [
      { a: 0.5, lambda: 5000, D: 3000, lens: false, f: 0.5 },
      { a: 20000, lambda: 1, D: 0.0003, lens: false, f: 0.5 },
      { a: 100, lambda: 550, D: 2, lens: true, f: 0.0002 },
      { a: 100, lambda: 550, D: 2, lens: true, f: 1000 },
    ] as DiffState[]) {
      const c = curve(s);
      expect(c.i.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(c.half) && c.half > 0).toBe(true);
    }
  });
  it('light outside the visible spectrum is drawn grey, visible light is coloured', () => {
    expect(isVisibleLight(550)).toBe(true);
    expect(isVisibleLight(200)).toBe(false);
    expect(isVisibleLight(1500)).toBe(false);
    expect(wavelengthRgb(1500)).toEqual([150, 150, 150]);
    expect(wavelengthRgb(550)).not.toEqual([150, 150, 150]);
  });
});
