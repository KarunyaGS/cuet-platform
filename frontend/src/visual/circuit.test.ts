import { describe, expect, it } from 'vitest';
import {
  APPLY, balanceR, CELL_START, cellCircuit, externalResistance, fitLine, kirchhoff, KIRCH_START, maxPower, millman, PREDICTS, solve, unknownFromBalance, WHEAT_START,
  wheatstone, type CellState, type KirchState, type WheatState,
} from './circuit';

const C = (o: Partial<CellState> = {}): CellState => ({ ...CELL_START, ...o });
const K = (o: Partial<KirchState> = {}): KirchState => ({ ...KIRCH_START, ...o });
const W = (o: Partial<WheatState> = {}): WheatState => ({ ...WHEAT_START, ...o });

describe('modified nodal analysis solver', () => {
  it('a 10 V cell across 2 ohm in series with 3 ohm', () => {
    const s = solve(3, [{ kind: 'V', a: 1, b: 0, value: 10 }, { kind: 'R', a: 1, b: 2, value: 2 }, { kind: 'R', a: 2, b: 0, value: 3 }]);
    expect(s.i[0]).toBeCloseTo(2, 10);
    expect(s.i[1]).toBeCloseTo(2, 10);
    expect(s.v[2]).toBeCloseTo(6, 10);
  });
  it('a cell delivers current out of its + terminal (positive when discharging)', () => {
    const s = solve(2, [{ kind: 'V', a: 1, b: 0, value: 5 }, { kind: 'R', a: 1, b: 0, value: 5 }]);
    expect(s.i[0]).toBeCloseTo(1, 12);
    expect(s.i[1]).toBeCloseTo(1, 12);
  });
  it('current is conserved at a node', () => {
    const els = [{ kind: 'V' as const, a: 1, b: 0, value: 9 }, { kind: 'R' as const, a: 1, b: 2, value: 3 }, { kind: 'R' as const, a: 2, b: 0, value: 6 }, { kind: 'R' as const, a: 2, b: 0, value: 12 }];
    const s = solve(3, els);
    expect(s.i[1]! - s.i[2]! - s.i[3]!).toBeCloseTo(0, 12);
  });
});

describe('a cell with internal resistance', () => {
  it('I = emf/(R + r) and V = emf - I r', () => {
    const r = cellCircuit(C({ emf: 10, r: 1, R1: 4 }));
    expect(r.I).toBeCloseTo(2, 9);
    expect(r.Vt).toBeCloseTo(8, 9);
    expect(r.Vt).toBeCloseTo(10 - r.I * 1, 9);
    expect(r.eff).toBeCloseTo(0.8, 9);
  });
  it('series resistors add, parallel resistors combine as the reciprocal sum', () => {
    expect(externalResistance(C({ R1: 6, R2: 3, mode: 'series' }))).toBe(9);
    expect(externalResistance(C({ R1: 6, R2: 3, mode: 'parallel' }))).toBe(2);
    const par = cellCircuit(C({ emf: 6, r: 0, R1: 6, R2: 3, mode: 'parallel' }));
    expect(par.I).toBeCloseTo(3, 6);
    expect(par.I1).toBeCloseTo(1, 6);
    expect(par.I2).toBeCloseTo(2, 6);
    expect(par.I1 + par.I2).toBeCloseTo(par.I, 6);
    const ser = cellCircuit(C({ emf: 6, r: 0, R1: 6, R2: 3, mode: 'series' }));
    expect(ser.V1 + ser.V2).toBeCloseTo(6, 6);
    expect(ser.I1).toBeCloseTo(ser.I2, 9);
  });
  it('power balance, and the maximum external power is at R = r', () => {
    const r = cellCircuit(C({ emf: 12, r: 3, R1: 3 }));
    expect(r.Pcell).toBeCloseTo(r.Pext + r.Pint, 9);
    expect(r.Pext).toBeCloseTo(maxPower(12, 3), 9);
    for (const R of [1, 2, 4, 6, 9]) expect(cellCircuit(C({ emf: 12, r: 3, R1: R })).Pext).toBeLessThan(r.Pext);
  });
  it('V against I is a straight line with intercept emf and slope -r', () => {
    const rd = [2, 5, 10, 20].map((R) => cellCircuit(C({ emf: 6, r: 2, R1: R })));
    const fit = fitLine(rd.map((x) => x.I), rd.map((x) => x.Vt))!;
    expect(fit.a).toBeCloseTo(6, 6);
    expect(fit.b).toBeCloseTo(-2, 6);
  });
  it('the fit needs two different currents', () => {
    expect(fitLine([1, 1, 1], [2, 3, 4])).toBeNull();
    expect(fitLine([1], [1])).toBeNull();
  });
});

describe('Kirchhoff rules', () => {
  it('junction rule and both loop rules sum to zero', () => {
    for (const s of [K(), K({ e2: -6 }), K({ e1: 0, e2: 9, R1: 2, R3: 7 })]) {
      const r = kirchhoff(s);
      expect(r.junction).toBeCloseTo(0, 9);
      expect(r.loopLeft).toBeCloseTo(0, 9);
      expect(r.loopRight).toBeCloseTo(0, 9);
    }
  });
  it('agrees with the closed-form (Millman) junction voltage', () => {
    const s = K();
    expect(kirchhoff(s).VAB).toBeCloseTo(millman(s), 9);
    expect(millman(s)).toBeCloseTo(46 / 9, 9);
    expect(kirchhoff(s).I2).toBeCloseTo(46 / 54, 9);
  });
  it('a reversed cell changes its branch current, and equal cells can leave a branch with none', () => {
    expect(kirchhoff(K({ e2: -8 })).I3).toBeLessThan(kirchhoff(K({ e2: 4 })).I3);
    expect(kirchhoff(K({ e1: 12, e2: 6, R1: 6, R2: 6, R3: 6 })).I3).toBeCloseTo(0, 9);
  });
});

describe('Wheatstone bridge', () => {
  it('balances when P/Q = R/S: galvanometer current is zero', () => {
    const r = wheatstone(W({ P: 10, Q: 20, R: 30, S: 60 }));
    expect(r.balanced).toBe(true);
    expect(Math.abs(r.Ig)).toBeLessThan(1e-12);
    expect(unknownFromBalance(30, 10, 20)).toBe(60);
    expect(balanceR(W({ P: 100, Q: 100, S: 250 }))).toBe(250);
  });
  it('is unbalanced otherwise, and the sign of the current shows which way to turn R', () => {
    const lo = wheatstone(W({ R: 100 }));
    const hi = wheatstone(W({ R: 400 }));
    expect(lo.balanced).toBe(false);
    expect(Math.sign(lo.Ig)).toBe(-Math.sign(hi.Ig));
    expect(Math.abs(wheatstone(W({ R: 250 })).Ig)).toBeLessThan(1e-12);
  });
  it('battery current equals the sum of the two arm currents', () => {
    const r = wheatstone(W({ R: 123 }));
    expect(r.Ib).toBeCloseTo(r.IP + r.IR, 12);
    expect(r.IP - r.IQ).toBeCloseTo(r.Ig, 12);
  });
  it('the balance does not depend on the battery or the galvanometer resistance', () => {
    for (const o of [{ emf: 2 }, { emf: 12 }, { Rg: 5 }, { Rg: 500 }]) expect(Math.abs(wheatstone(W({ R: 250, ...o })).Ig)).toBeLessThan(1e-12);
  });
});

describe('teaching data', () => {
  it('prediction answers agree with the model', () => {
    const [c1, c2, k1, w1] = PREDICTS as [(typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0], (typeof PREDICTS)[0]];
    expect(cellCircuit(c1.base.cell).Vt).toBeCloseTo(3, 6);
    expect(cellCircuit(c1.test.cell).Vt).toBeCloseTo(4.8, 6);
    expect(c1.options[c1.answer]).toBe('It rises, closer to the emf');
    expect(cellCircuit(c2.test.cell).I / cellCircuit(c2.base.cell).I).toBeCloseTo(2, 6);
    expect(c2.options[c2.answer]).toBe('It doubles');
    expect(kirchhoff(k1.test.kirch).I3).toBeCloseTo(0, 9);
    expect(k1.options[k1.answer]).toBe('0 A');
    expect(Math.abs(wheatstone(w1.test.wheat).Ig)).toBeLessThan(1e-12);
    expect(Math.abs(wheatstone(w1.base.wheat).Ig)).toBeGreaterThan(1e-4);
    expect(w1.options[w1.answer]).toBe('250 Ω');
    for (const p of PREDICTS) expect(p.why({ base: p.base, test: p.test }).length).toBeGreaterThan(80);
  });
  it('practice answers agree with the model', () => {
    const [a1, a2, a3, a4, a5] = APPLY as [(typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0], (typeof APPLY)[0]];
    expect(cellCircuit(C({ emf: 10, r: 1, R1: 4 })).I).toBeCloseTo(2, 9);
    expect(a1.options[a1.answer]).toBe('2 A');
    // a cell of emf 6 V and r = 2 ohm delivering 1 A: pick the external resistance that gives 1 A (R = 4 ohm)
    const two = cellCircuit(C({ emf: 6, r: 2, R1: 4 }));
    expect(two.I).toBeCloseTo(1, 9);
    expect(two.Vt).toBeCloseTo(4, 9);
    expect(a2.options[a2.answer]).toBe('4 V');
    expect(unknownFromBalance(30, 10, 20)).toBe(60);
    expect(a3.options[a3.answer]).toBe('60 Ω');
    expect(maxPower(12, 3)).toBe(12);
    expect(a4.options[a4.answer]).toBe('3 Ω');
    expect(3 + 5 - 2).toBe(6);
    expect(a5.options[a5.answer]).toBe('6 A out of the junction');
    for (const q of APPLY) expect(new Set(q.options).size).toBe(4);
    expect(APPLY.map((q) => q.answer)).toEqual([1, 3, 0, 2, 1]);
  });
});
