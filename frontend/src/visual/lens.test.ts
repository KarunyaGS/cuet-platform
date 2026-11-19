import { describe, expect, it } from 'vitest';
import { APPLY, focalFromUV, PREDICTS, reading, solveLens } from './lens';

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
