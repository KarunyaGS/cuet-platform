import { describe, expect, it } from 'vitest';
import { APPLY, BENCH, benchGeometry, niceStep, viewFor, focalFromUV, LIMITS, PREDICTS, reading, solveLens, type LensKind } from './lens';

const near = (a: number | null, b: number) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThan(1e-9);
};

describe('thin lens physics', () => {
  it('convex lens, object at 2f: real, inverted, same size, image at 2f', () => {
    const r = solveLens({ kind: 'convex', f: 10, u: 20, h: 2 });
    near(r.v, 20); near(r.m, -1);
    expect(r).toMatchObject({ real: true, upright: false, size: 'same size' });
  });
  it('convex lens between f and 2f: real, inverted, magnified, beyond 2f', () => {
    const r = solveLens({ kind: 'convex', f: 10, u: 15, h: 2 });
    near(r.v, 30); near(r.m, -2);
    expect(r.size).toBe('magnified');
  });
  it('convex lens inside f: virtual, upright, magnified', () => {
    const r = solveLens({ kind: 'convex', f: 10, u: 6, h: 2 });
    near(r.v, -15); near(r.m, 2.5);
    expect(r).toMatchObject({ real: false, upright: true, size: 'magnified' });
  });
  it('object at the focus: image at infinity', () => {
    expect(solveLens({ kind: 'convex', f: 10, u: 10, h: 2 }).v).toBeNull();
  });
  it('concave lens: always virtual, upright, diminished', () => {
    for (const u of [4, 10, 20, 44]) {
      const r = solveLens({ kind: 'concave', f: 10, u, h: 2 });
      expect(r).toMatchObject({ real: false, upright: true, size: 'diminished' });
    }
  });
  it('power in dioptres', () => {
    expect(solveLens({ kind: 'convex', f: 20, u: 30, h: 2 }).power).toBeCloseTo(5);
    expect(solveLens({ kind: 'concave', f: 25, u: 30, h: 2 }).power).toBeCloseTo(-4);
  });
  it('a recorded reading returns the lens focal length', () => {
    const rd = reading({ kind: 'convex', f: 12, u: 30, h: 2 })!;
    expect(rd.f).toBeCloseTo(12);
    expect(rd.invV - rd.invU).toBeCloseTo(1 / 12);
    expect(focalFromUV(-30, 20)).toBeCloseTo(12);
  });
});

describe('teaching data', () => {
  it('every prediction has a valid answer that matches the physics', () => {
    const expected = ['Real, inverted, same size', 'Farther from the lens and bigger', 'No, it is virtual, upright and magnified', 'Virtual, upright, diminished'];
    PREDICTS.forEach((p, i) => {
      expect(p.options[p.answer]).toBe(expected[i]);
      expect(p.options.length).toBe(4);
    });
    expect(solveLens(PREDICTS[1]!.setup).v!).toBeGreaterThan(2 * 10);
  });
  it('the practice answers agree with the lens formula', () => {
    // a1: f=20, real image at 60 cm -> u = 30
    expect(solveLens({ kind: 'convex', f: 20, u: 30, h: 1 }).v).toBeCloseTo(60);
    // a2: concave f=15, u=10 -> v = -6
    expect(solveLens({ kind: 'concave', f: 15, u: 10, h: 1 }).v).toBeCloseTo(-6);
    // a3: f=10, u=15 -> m = -2
    expect(solveLens({ kind: 'convex', f: 10, u: 15, h: 1 }).m).toBeCloseTo(-2);
    // a4: f=12, u=24 -> same size
    expect(solveLens({ kind: 'convex', f: 12, u: 24, h: 1 }).size).toBe('same size');
    const answers = APPLY.map((q) => q.options[q.answer]);
    expect(answers).toEqual(['30 cm', '6 cm from the lens, virtual, on the object side', '15 cm', '12 cm']);
  });
});

describe('bench geometry', () => {
  const yAt = (g: ReturnType<typeof benchGeometry>, i: number, x: number) => g.rays[i]!.y0 + g.rays[i]!.slope * x;
  it('every drawn ray, after the lens, passes through the image tip (real and virtual, both lenses)', () => {
    for (const kind of ['convex', 'concave'] as LensKind[]) {
      for (let f = LIMITS.f.min; f <= LIMITS.f.max; f += 2) {
        for (let u = LIMITS.u.min; u <= LIMITS.u.max; u += 2) {
          for (const h of [1, 2.5, 4]) {
            const g = benchGeometry({ kind, f, u, h });
            if (!g.image) continue;
            expect(g.rays.length).toBeGreaterThanOrEqual(2);
            g.rays.forEach((_, i) => expect(yAt(g, i, g.image!.x)).toBeCloseTo(g.image!.y, 6));
          }
        }
      }
    }
  });
  it('the focal ray leaves parallel to the principal axis', () => {
    const g = benchGeometry({ kind: 'convex', f: 10, u: 25, h: 2 });
    expect(g.rays.find((r) => r.id === 'focal')!.slope).toBeCloseTo(0, 9);
    const c = benchGeometry({ kind: 'concave', f: 10, u: 25, h: 2 });
    expect(c.rays.find((r) => r.id === 'focal')!.slope).toBeCloseTo(0, 9);
  });
  it('the central ray is undeviated and the parallel ray starts at the object height', () => {
    const g = benchGeometry({ kind: 'convex', f: 10, u: 25, h: 3 });
    const centre = g.rays.find((r) => r.id === 'centre')!;
    expect(centre.y0).toBe(0);
    expect(centre.slope).toBeCloseTo(g.object.y / g.object.x, 9);
    expect(g.rays.find((r) => r.id === 'parallel')!.y0).toBe(3);
  });
  it('object at the focus: image at infinity, all refracted rays parallel to each other', () => {
    const g = benchGeometry({ kind: 'convex', f: 10, u: 10, h: 2 });
    expect(g.image).toBeNull();
    expect(g.rays.map((r) => r.id)).toEqual(['parallel', 'centre']);
    expect(g.rays[0]!.slope).toBeCloseTo(g.rays[1]!.slope, 9);
  });
  it('just inside and just outside the focus: image far away, on opposite sides', () => {
    const out = benchGeometry({ kind: 'convex', f: 10, u: 10.5, h: 2 });
    const inn = benchGeometry({ kind: 'convex', f: 10, u: 9.5, h: 2 });
    expect(out.image!.x).toBeCloseTo(210, 6);
    expect(inn.image!.x).toBeCloseTo(-190, 6);
  });
  it('a ray that would miss the lens is hidden, never clamped', () => {
    const g = benchGeometry({ kind: 'convex', f: 5, u: 5.5, h: 2 });
    expect(g.hidden).toContain('focal');
    g.rays.forEach((r) => expect(Math.abs(r.y0)).toBeLessThanOrEqual(BENCH.aperture));
  });
  it('every control limit keeps the object on the bench', () => {
    expect(LIMITS.u.max).toBeLessThan(BENCH.x);
    expect(LIMITS.h.max).toBeLessThanOrEqual(BENCH.aperture);
  });
});

describe('bench view for custom ranges', () => {
  it('the default ranges give the original 50 cm bench', () => {
    expect(viewFor(LIMITS.u.max, LIMITS.h.max)).toEqual({ xr: 50, aperture: BENCH.aperture });
  });
  it('a longer object range widens the bench; a taller one raises the lens', () => {
    expect(viewFor(200, 4).xr).toBeGreaterThanOrEqual(200 * 1.1);
    expect(viewFor(44, 30).aperture).toBeGreaterThanOrEqual(30);
  });
  it('the farthest and tallest object always fit', () => {
    for (const [u, h] of [[44, 4], [1, 1], [500, 20], [44000, 3]] as const) {
      const v = viewFor(u, h);
      expect(v.xr).toBeGreaterThan(u);
      expect(v.aperture).toBeGreaterThanOrEqual(h);
    }
  });
  it('ruler steps are 1-2-5 and give a sensible tick count', () => {
    for (const span of [100, 220, 400, 1000, 88000]) {
      const st = niceStep(span);
      expect(/^[125]0*$/.test(String(st).replace('.', '').replace(/^0+/, '')) || [1, 2, 5].includes(Number(String(st).replace(/0+$/, '')))).toBe(true);
      expect(span / st).toBeGreaterThanOrEqual(5);
      expect(span / st).toBeLessThanOrEqual(20);
    }
  });
  it('a wide aperture keeps rays that a narrow lens would hide', () => {
    const s = { kind: 'convex' as LensKind, f: 5, u: 5.5, h: 2 };
    expect(benchGeometry(s).hidden).toContain('focal');
    expect(benchGeometry(s, 40).hidden).toEqual([]);
  });
});
