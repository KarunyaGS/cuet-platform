import { describe, expect, it } from 'vitest';
import {
  APPLY, dipoleAxial, dipoleAxialApprox, dipoleEquatorial, dipoleEquatorialApprox, dipoleMoment, dipoleTorque, distinctDistances, fieldAt, fitK, forceMagnitude, forceOn,
  K, lineCount, lineEnd, pair, PREDICTS, traceLines, WORLD, type Charge, type Reading,
} from './efield';

describe("Coulomb's law", () => {
  it('F = k q1 q2 / r² with the right size', () => {
    expect(forceMagnitude(2, 2, 10)).toBeCloseTo((K * 4e-12) / 0.01, 6);
    expect(forceMagnitude(2, 3, 3)).toBeCloseTo(59.93, 1);
    expect(forceMagnitude(2, 3, 3)).toBeGreaterThan(59);
  });
  it('inverse square: double the distance, one quarter; double a charge, double the force', () => {
    expect(forceMagnitude(2, 3, 20) / forceMagnitude(2, 3, 10)).toBeCloseTo(0.25, 12);
    expect(forceMagnitude(2, 6, 10) / forceMagnitude(2, 3, 10)).toBeCloseTo(2, 12);
    expect(forceMagnitude(-2, 3, 10)).toBeCloseTo(forceMagnitude(2, 3, 10), 12);
  });
  it('like charges repel and unlike charges attract, and the two forces are equal and opposite', () => {
    const like = pair(2, 3, 10);
    const f0 = forceOn(0, like), f1 = forceOn(1, like);
    expect(f0.fx).toBeLessThan(0); // the left charge is pushed left, away from the right one
    expect(f1.fx).toBeGreaterThan(0);
    expect(f0.fx + f1.fx).toBeCloseTo(0, 9);
    expect(Math.abs(f0.fy)).toBeLessThan(1e-9);
    const unlike = pair(2, -3, 10);
    expect(forceOn(0, unlike).fx).toBeGreaterThan(0); // pulled towards the right charge
    expect(forceOn(1, unlike).fx).toBeLessThan(0);
    expect(forceOn(0, unlike).mag).toBeCloseTo(forceOn(0, like).mag, 9);
  });
  it('forces on a pair at an angle point along the line joining them', () => {
    const c: Charge[] = [{ id: 1, x: 20, y: 20, q: 2 }, { id: 2, x: 30, y: 40, q: 2 }];
    const f = forceOn(0, c);
    const ratio = f.fy / f.fx; // away from charge 2: direction (-10, -20)
    expect(ratio).toBeCloseTo(2, 9);
    expect(f.mag).toBeCloseTo(forceMagnitude(2, 2, Math.hypot(10, 20)), 9);
  });
  it('superposition: the force from several charges is the vector sum', () => {
    const c: Charge[] = [{ id: 1, x: 50, y: 30, q: 2 }, { id: 2, x: 30, y: 30, q: 3 }, { id: 3, x: 50, y: 50, q: -4 }];
    const f = forceOn(0, c);
    const a = forceMagnitude(2, 3, 20); // from charge 2, repels to +x
    const b = forceMagnitude(2, 4, 20); // from charge 3, attracts to +y
    expect(f.fx).toBeCloseTo(a, 9);
    expect(f.fy).toBeCloseTo(b, 9);
    expect(f.mag).toBeCloseTo(Math.hypot(a, b), 9);
  });
});

describe('electric field', () => {
  it('a point charge: E = k q / r², pointing away from a positive charge', () => {
    const c: Charge[] = [{ id: 1, x: 50, y: 30, q: 4 }];
    const e = fieldAt(80, 30, c);
    expect(Math.abs(e.mag / 4e5 - 1)).toBeLessThan(0.005); // 9 × 10⁹ rounds k to 4 × 10⁵ N/C
    expect(e.ex).toBeGreaterThan(0);
    const neg = fieldAt(80, 30, [{ id: 1, x: 50, y: 30, q: -4 }]);
    expect(neg.ex).toBeLessThan(0);
  });
  it('the field at the midpoint between equal like charges is zero, and doubles between opposite ones', () => {
    expect(fieldAt(50, 30, pair(3, 3, 30)).mag).toBeLessThan(1e-3);
    const mid = fieldAt(50, 30, pair(3, -3, 30));
    const one = fieldAt(50, 30, [{ id: 1, x: 35, y: 30, q: 3 }]);
    expect(mid.mag).toBeCloseTo(2 * one.mag, 3);
  });
  it('field and force agree: the force on a charge is q × the field of the others', () => {
    const c = pair(2, 3, 10);
    const e = fieldAt(c[0]!.x, c[0]!.y, [c[1]!]);
    expect(forceOn(0, c).fx).toBeCloseTo(2e-6 * e.ex, 9);
  });
});

describe('field lines', () => {
  it('the number of lines is proportional to the charge', () => {
    expect(lineCount(8) / lineCount(4)).toBe(2);
    expect(lineCount(12) / lineCount(6)).toBe(2);
    expect(lineCount(0.5)).toBe(4); // small charges keep a few lines to stay visible
  });
  it('lines start on positive charges only and a dipole\'s lines end on the negative charge', () => {
    const c = pair(4, -4, 30);
    const lines = traceLines(c, WORLD);
    expect(lines.length).toBe(lineCount(4));
    expect(lines.every((l) => l.from === 1)).toBe(true);
    const ends = lines.map((l) => lineEnd(l, c));
    expect(ends.filter((e) => e === 2).length).toBeGreaterThanOrEqual(Math.floor(lines.length / 2)); // most lines end on −q; the rest leave the window
    // the first point of each line is next to the positive charge
    lines.forEach((l) => expect(Math.hypot(l.pts[0]!.x - c[0]!.x, l.pts[0]!.y - c[0]!.y)).toBeLessThan(1.2));
  });
  it('equal like charges: lines never cross the neutral point between them', () => {
    const c = pair(4, 4, 30);
    const lines = traceLines(c, WORLD);
    const crossing = lines.some((l) => l.pts.some((p, i) => i > 0 && Math.abs(p.x - 50) < 0.3 && Math.abs(p.y - 30) < 1.5));
    expect(crossing).toBe(false);
  });
  it('with only negative charges the lines run into them, from far away (traced backwards)', () => {
    const lines = traceLines([{ id: 1, x: 50, y: 30, q: -3 }], WORLD);
    expect(lines.length).toBe(lineCount(3));
  });
});

describe('dipole', () => {
  it('p = q d', () => {
    expect(dipoleMoment(2, 1)).toBeCloseTo(2e-8, 20);
  });
  it('far away the exact fields approach 2kp/r³ (axis) and kp/r³ (equator), with a ratio of 2', () => {
    const p = dipoleMoment(2, 1);
    const r = 100; // 100 cm, far compared with 1 cm
    expect(dipoleAxial(2, 1, r) / dipoleAxialApprox(p, r)).toBeCloseTo(1, 3);
    expect(dipoleEquatorial(2, 1, r) / dipoleEquatorialApprox(p, r)).toBeCloseTo(1, 3);
    expect(dipoleAxial(2, 1, r) / dipoleEquatorial(2, 1, r)).toBeCloseTo(2, 2);
  });
  it('torque in a uniform field: τ = pE sin θ', () => {
    expect(dipoleTorque(2e-8, 1000, Math.PI / 2)).toBeCloseTo(2e-5, 12);
    expect(dipoleTorque(2e-8, 1000, 0)).toBeCloseTo(0, 15);
  });
});

describe('measuring k', () => {
  const rows = (rs: number[], noise = 0): Reading[] => rs.map((r, i) => ({ r, q1: 2, q2: 3, F: forceMagnitude(2, 3, r) * (1 + noise * (i % 2 ? 1 : -1)) }));
  it('F against 1/r² is a straight line through the origin and gives k', () => {
    const f = fitK(rows([8, 12, 16, 24]));
    expect(f.k / K).toBeCloseTo(1, 9);
  });
  it('a few percent of reading error still gives k to within a few percent', () => {
    const f = fitK(rows([8, 12, 16, 24], 0.03));
    expect(Math.abs(f.k / K - 1)).toBeLessThan(0.04);
  });
  it('counts distinct distances for the same pair of charges', () => {
    expect(distinctDistances(rows([8, 12, 16]))).toBe(3);
    expect(distinctDistances([...rows([8, 12]), { r: 12, q1: 2, q2: 3, F: 1 }])).toBe(2);
    expect(distinctDistances([...rows([8, 12, 16]), { r: 20, q1: 5, q2: 3, F: 1 }])).toBe(1);
    expect(distinctDistances([])).toBe(0);
  });
});

describe('teaching data', () => {
  it('prediction answers match the physics', () => {
    const [p1, p2, p3, p4] = PREDICTS as [(typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0]];
    const F = (s: (typeof p1)['base']) => forceOn(0, s.charges).mag;
    expect(F(p1.test) / F(p1.base)).toBeCloseTo(0.25, 12);
    expect(p1.options[p1.answer]).toBe('It becomes one quarter');
    expect(F(p2.test) / F(p2.base)).toBeCloseTo(2, 12);
    expect(p2.options[p2.answer]).toBe('It doubles');
    expect(forceOn(0, p3.test.charges).fx).toBeGreaterThan(0); // attracted towards the right-hand charge
    expect(p3.options[p3.answer]).toBe('They attract each other');
    expect(fieldAt(p4.test.probe.x, p4.test.probe.y, p4.test.charges).mag).toBeLessThan(1e-3);
    expect(p4.options[p4.answer]).toBe('Zero');
    for (const p of PREDICTS) expect(p.why({ base: p.base, test: p.test }).length).toBeGreaterThan(60);
  });
  it('practice answers agree with the formulas', () => {
    const [a1, a2, a3, a4, a5] = APPLY as [(typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0]];
    expect(Math.round(forceMagnitude(2, 3, 3))).toBe(60);
    expect(a1.options[a1.answer]).toBe('60 N');
    expect((2 * 1) / 9).toBeCloseTo(forceMagnitude(2 * 2, 3, 30) / forceMagnitude(2, 3, 10), 12);
    expect(a2.options[a2.answer]).toBe('2F/9');
    expect(fieldAt(80, 30, [{ id: 1, x: 50, y: 30, q: 4 }]).mag / 1e5).toBeCloseTo(4, 0);
    expect(a3.options[a3.answer]).toBe('4 × 10⁵ N/C');
    expect(dipoleMoment(2, 1)).toBeCloseTo(2e-8, 20);
    expect(a4.options[a4.answer]).toBe('2 × 10⁻⁸ C m');
    expect(dipoleAxialApprox(1, 50) / dipoleEquatorialApprox(1, 50)).toBeCloseTo(2, 12);
    expect(a5.options[a5.answer]).toBe('2');
    for (const q of APPLY) expect(new Set(q.options).size).toBe(4);
    expect(APPLY.map((q) => q.answer)).toEqual([1, 3, 0, 2, 1]);
  });
});
