import { describe, expect, it } from 'vitest';
import {
  APPLY, canFit, conc, distinctRatios, electrolysis, electronsFromSlope, electronsLeaveFrom, ELECTROLYTES, F, fitLine, fitSet, fmtC, galvanic, HALVES, meter, pairKey,
  PREDICTS, readingOf, recover, saltBridge, slopeThroughOrigin, SLOPE, START, type CellInput, type Reading,
} from './galvanic';

const C = (left: string, right: string, pLeft = 0, pRight = 0): CellInput => ({ left, right, pLeft, pRight });

describe('standard electrode potentials table', () => {
  it('holds the textbook values at 298 K, ordered from the most negative to the most positive', () => {
    const want: Record<string, number> = { Mg: -2.36, Al: -1.66, Zn: -0.76, Fe: -0.44, Ni: -0.25, Sn: -0.14, Pb: -0.13, H: 0, Cu: 0.34, Ag: 0.8 };
    for (const h of HALVES) expect(h.E0).toBe(want[h.id]);
    expect(HALVES.length).toBe(10);
    const e = HALVES.map((h) => h.E0);
    expect([...e].sort((a, b) => a - b)).toEqual(e);
  });
  it('electron counts match the ions', () => {
    const ne: Record<string, number> = { Mg: 2, Al: 3, Zn: 2, Fe: 2, Ni: 2, Sn: 2, Pb: 2, H: 2, Cu: 2, Ag: 1 };
    for (const h of HALVES) expect(h.ne).toBe(ne[h.id]);
  });
});

describe('E°cell and the anode', () => {
  it('Daniell cell: E° = 0.34 − (−0.76) = 1.10 V, Zn is the anode, Cu the cathode, n = 2', () => {
    const r = galvanic(C('Zn', 'Cu'));
    expect(r.E0).toBeCloseTo(1.1, 12);
    expect(r.anode.id).toBe('Zn');
    expect(r.cathode.id).toBe('Cu');
    expect(r.n).toBe(2);
    expect(r.E).toBeCloseTo(1.1, 12);
    expect(r.logQ).toBeCloseTo(0, 12);
    expect(r.reversed).toBe(false);
  });
  it('the chemistry does not depend on which beaker is on the left', () => {
    const a = galvanic(C('Zn', 'Ag', -1, -2));
    const b = galvanic(C('Ag', 'Zn', -2, -1));
    expect(a.anode.id).toBe(b.anode.id);
    expect(a.E).toBeCloseTo(b.E, 12);
    expect(a.anodeSide).toBe('left');
    expect(b.anodeSide).toBe('right');
  });
  it('Zn | Ag: 1.56 V, n = 2', () => {
    const r = galvanic(C('Zn', 'Ag'));
    expect(r.E0).toBeCloseTo(1.56, 12);
    expect(r.n).toBe(2);
  });
  it('n is the least common multiple of the electrons (Al with Ag is 3, Al with Cu is 6, H2 with Ag is 2)', () => {
    expect(galvanic(C('Al', 'Ag')).n).toBe(3);
    expect(galvanic(C('Al', 'Cu')).n).toBe(6);
    expect(galvanic(C('H', 'Ag')).n).toBe(2);
    expect(galvanic(C('Mg', 'Fe')).n).toBe(2);
  });
  it('the electrode with the lower reduction potential is always the anode, for all 45 pairs', () => {
    for (const a of HALVES) for (const b of HALVES) {
      if (a.id === b.id) continue;
      const r = galvanic(C(a.id, b.id));
      expect(r.anode.E0).toBeLessThan(r.cathode.E0);
      expect(r.E0).toBeCloseTo(Math.abs(a.E0 - b.E0), 12);
      expect(r.E0).toBeGreaterThan(0);
      expect(r.dG0).toBeLessThan(0);
      expect(r.K).toBeGreaterThan(1);
    }
  });
});

describe('overall reaction and cell notation', () => {
  it('writes balanced equations', () => {
    expect(galvanic(C('Zn', 'Cu')).overall).toBe('Zn + Cu²⁺ → Zn²⁺ + Cu');
    expect(galvanic(C('Zn', 'Ag')).overall).toBe('Zn + 2Ag⁺ → Zn²⁺ + 2Ag');
    expect(galvanic(C('Al', 'Cu')).overall).toBe('2Al + 3Cu²⁺ → 2Al³⁺ + 3Cu');
    expect(galvanic(C('H', 'Ag')).overall).toBe('H₂ + 2Ag⁺ → 2H⁺ + 2Ag');
    expect(galvanic(C('Zn', 'H')).overall).toBe('Zn + 2H⁺ → Zn²⁺ + H₂');
  });
  it('puts the anode on the left of the salt bridge double bar', () => {
    expect(galvanic(C('Zn', 'Cu', -2, 0)).notation).toBe('Zn(s) | Zn²⁺(0.01 M) ‖ Cu²⁺(1 M) | Cu(s)');
    expect(galvanic(C('Cu', 'Zn', 0, -2)).notation).toBe('Zn(s) | Zn²⁺(0.01 M) ‖ Cu²⁺(1 M) | Cu(s)');
    expect(galvanic(C('H', 'Cu')).notation).toBe('Pt(s) | H₂(g, 1 bar) | H⁺(1 M) ‖ Cu²⁺(1 M) | Cu(s)');
    expect(galvanic(C('Zn', 'H')).notation).toBe('Zn(s) | Zn²⁺(1 M) ‖ H⁺(1 M) | H₂(g, 1 bar) | Pt(s)');
  });
  it('formats concentrations', () => {
    expect(fmtC(conc(0))).toBe('1');
    expect(fmtC(conc(-3))).toBe('0.001');
    expect(fmtC(conc(0.5))).toBe('3.16');
    expect(fmtC(conc(-1.5))).toBe('0.0316');
  });
});

describe('Nernst equation', () => {
  it('lesson example: Zn(0.01 M) | Cu(0.10 M) gives about 1.13 V', () => {
    const r = galvanic(C('Zn', 'Cu', -2, -1));
    expect(r.Q).toBeCloseTo(0.1, 9);
    expect(r.E).toBeCloseTo(1.1 + 0.0296, 9);
  });
  it('E = E° − (0.0592/n) log Q, computed independently', () => {
    for (const [a, b, pa, pb] of [['Zn', 'Cu', -1, 0.3], ['Ni', 'Ag', -1, -2], ['Al', 'Cu', -2, -0.5], ['H', 'Ag', 0, -1], ['Zn', 'H', -1.5, -2]] as [string, string, number, number][]) {
      const r = galvanic(C(a, b, pa, pb));
      const A = HALVES.find((h) => h.id === r.anode.id)!;
      const K = HALVES.find((h) => h.id === r.cathode.id)!;
      const ca = r.anode.id === a ? pa : pb;
      const cc = r.anode.id === a ? pb : pa;
      const n = r.n;
      const logQ = ((A.nu * n) / A.ne) * ca - ((K.nu * n) / K.ne) * cc; // log10 of 10^p is p
      expect(r.logQ).toBeCloseTo(logQ, 9);
      expect(r.E).toBeCloseTo(K.E0 - A.E0 - (SLOPE / n) * logQ, 9);
    }
  });
  it('lesson Q for Ni | Ag at 0.1 M and 0.01 M is [Ni²⁺]/[Ag⁺]² = 1000', () => {
    const r = galvanic(C('Ni', 'Ag', -1, -2));
    expect(r.Q).toBeCloseTo(1000, 6);
    expect(r.logQ).toBeCloseTo(3, 9);
    expect(r.E).toBeCloseTo(1.05 - 0.0296 * 3, 9);
  });
  it('raising a reactant (cathode ion) raises E, raising a product (anode ion) lowers it', () => {
    expect(galvanic(C('Zn', 'Cu', 0, 0.3)).E).toBeGreaterThan(galvanic(C('Zn', 'Cu', 0, 0)).E);
    expect(galvanic(C('Zn', 'Cu', 0.3, 0)).E).toBeLessThan(galvanic(C('Zn', 'Cu', 0, 0)).E);
  });
  it('a tenfold change of [Cu²⁺] in the Daniell cell shifts E by 0.0296 V', () => {
    expect(galvanic(C('Zn', 'Cu', 0, 0)).E - galvanic(C('Zn', 'Cu', 0, -1)).E).toBeCloseTo(0.0296, 9);
  });
  it('the Zn | H⁺ cell depends on [H⁺]² (a pH meter): a tenfold drop in [H⁺] lowers E by 0.0592 V', () => {
    expect(galvanic(C('Zn', 'H', 0, 0)).E - galvanic(C('Zn', 'H', 0, -1)).E).toBeCloseTo(0.0592, 9);
  });
  it('E is zero exactly at Q = K, and negative beyond (polarity reverses and the other electrode becomes the anode)', () => {
    const r0 = galvanic(C('Sn', 'Pb'));
    expect(r0.logK).toBeCloseTo((2 * 0.01) / 0.0592, 9);
    const pEq = r0.logK; // [Sn2+]/[Pb2+] = K at E = 0
    expect(galvanic(C('Sn', 'Pb', pEq, 0)).E).toBeCloseTo(0, 9);
    const past = galvanic(C('Sn', 'Pb', 0.5, 0));
    expect(past.E).toBeLessThan(0);
    expect(past.reversed).toBe(true);
    expect(past.anodeNow.id).toBe('Pb');
    expect(past.cathodeNow.id).toBe('Sn');
    expect(past.anodeSideNow).toBe('right');
    expect(galvanic(C('Sn', 'Pb', 0, 0)).reversed).toBe(false);
  });
});

describe('Gibbs energy and the equilibrium constant', () => {
  it('Daniell cell: ΔG° = −2 × 96500 × 1.10 = −212.3 kJ/mol; log K = 2 × 1.10/0.0592', () => {
    const r = galvanic(C('Zn', 'Cu'));
    expect(r.dG0).toBeCloseTo(-212.3, 9);
    expect(r.dG).toBeCloseTo(r.dG0, 9);
    expect(r.logK).toBeCloseTo(2.2 / 0.0592, 9);
    expect(r.logK).toBeCloseTo(37.16, 2);
  });
  it('ΔG = −nFE at non-standard concentrations, and ΔG = ΔG° + 2.303RT log Q (to the precision of 0.0592)', () => {
    const r = galvanic(C('Zn', 'Cu', -2, -1));
    expect(r.dG).toBeCloseTo((-2 * F * r.E) / 1000, 9);
    expect(r.dG).toBeCloseTo(r.dG0 + (SLOPE * 2 * F * r.logQ) / 2 / 1000, 6);
  });
  it('ΔG < 0 when E > 0, ΔG > 0 when E < 0', () => {
    expect(galvanic(C('Sn', 'Pb', 0, 0)).dG).toBeLessThan(0);
    expect(galvanic(C('Sn', 'Pb', 0.5, 0)).dG).toBeGreaterThan(0);
  });
  it('K for Fe | Cu is 10^(2 × 0.78/0.0592)', () => {
    expect(galvanic(C('Fe', 'Cu')).logK).toBeCloseTo(1.56 / 0.0592, 9);
  });
});

describe('electron flow, salt bridge and current', () => {
  it('electrons leave the anode; anions go to the anode compartment, cations to the cathode compartment', () => {
    const r = galvanic(C('Zn', 'Cu'));
    expect(electronsLeaveFrom(r)).toBe('left');
    expect(saltBridge(r)).toEqual({ anionsToward: 'left', cationsToward: 'right' });
    const s = galvanic(C('Cu', 'Zn'));
    expect(electronsLeaveFrom(s)).toBe('right');
    expect(saltBridge(s)).toEqual({ anionsToward: 'right', cationsToward: 'left' });
  });
  it('everything swaps after the polarity reverses', () => {
    const r = galvanic(C('Sn', 'Pb', 0.5, 0));
    expect(electronsLeaveFrom(r)).toBe('right');
    expect(saltBridge(r).anionsToward).toBe('right');
  });
  it('the current through the lamp follows the voltage: I = |E|/(10 + 1) ohm, zero at equilibrium', () => {
    expect(galvanic(C('Zn', 'Cu')).I).toBeCloseTo(0.1, 9);
    expect(galvanic(C('Sn', 'Pb', galvanic(C('Sn', 'Pb')).logK, 0)).I).toBeCloseTo(0, 9);
    expect(galvanic(C('Mg', 'Ag')).I).toBeGreaterThan(galvanic(C('Zn', 'Cu')).I);
  });
});

describe('Measure and Analyse: E against log Q is a straight line', () => {
  const rows = (cs: [number, number][], l = 'Zn', r = 'Cu') => cs.map(([a, b]) => readingOf(C(l, r, a, b)));
  it('a voltmeter reads to the millivolt', () => {
    expect(meter(1.13962)).toBe(1.14);
    expect(meter(1.1296)).toBe(1.13);
    expect(meter(-0.0004)).toBe(-0);
  });
  it('slope −0.0592/n and intercept E° are recovered for the Daniell cell (n = 2)', () => {
    const rd = rows([[0, 0], [-1, 0], [-2, -1], [0, -2], [-3, 0], [0.3, -1]]);
    const rec = recover(rd)!;
    expect(rec.slope).toBeCloseTo(-0.0296, 3);
    expect(rec.E0).toBeCloseTo(1.1, 2);
    expect(rec.n).toBeCloseTo(2, 1);
    expect(rec.nRounded).toBe(2);
    expect(rec.r2).toBeGreaterThan(0.9999);
  });
  it('recovers n for every kind of cell: Ag (1 electron per ion with Zn: n = 2), Al | Cu (n = 6), Zn | H⁺ (n = 2)', () => {
    for (const [l, r, n, E0] of [['Zn', 'Ag', 2, 1.56], ['Al', 'Cu', 6, 2.0], ['Zn', 'H', 2, 0.76], ['Fe', 'Cu', 2, 0.78], ['Mg', 'Ni', 2, 2.11]] as [string, string, number, number][]) {
      const rec = recover(rows([[0, 0], [-1, 0], [0, -1], [-2, -1], [-1, -2], [-3, 0], [0.4, -3]], l, r))!;
      expect(rec.nRounded).toBe(n);
      expect(rec.n).toBeGreaterThan(n - 0.25);
      expect(rec.n).toBeLessThan(n + 0.25);
      expect(rec.E0).toBeCloseTo(E0, 2);
    }
  });
  it('log Q in a reading is for the designed reaction', () => {
    const x = readingOf(C('Cu', 'Zn', -1, -2)); // Cu 0.1 M, Zn 0.01 M
    expect(x.logQ).toBeCloseTo(-2 - -1, 9); // [Zn]/[Cu] = 0.01/0.1
    expect(x.key).toBe(pairKey('Zn', 'Cu'));
    expect(x.n).toBe(2);
  });
  it('needs three different concentration ratios; a repeated ratio does not count', () => {
    const same = rows([[0, 0], [0, 0], [-1, -1]]); // log Q = 0 every time
    expect(distinctRatios(same)).toBe(1);
    expect(canFit(same)).toBe(false);
    expect(canFit(rows([[0, 0], [0, -1]]))).toBe(false);
    expect(canFit(rows([[0, 0], [0, -1], [0, -2]]))).toBe(true);
    // different ratios but different cells do not combine
    const mixed: Reading[] = [...rows([[0, 0], [0, -1]]), ...rows([[0, 0]], 'Zn', 'Ag')];
    expect(canFit(mixed)).toBe(false);
  });
  it('fits the cell with the most readings', () => {
    const mixed: Reading[] = [...rows([[0, 0]], 'Zn', 'Ag'), ...rows([[0, 0], [0, -1], [0, -2]])];
    expect(fitSet(mixed).length).toBe(3);
    expect(fitSet(mixed)[0]!.key).toBe(pairKey('Zn', 'Cu'));
  });
  it('line fit: exact line, and null for a single x value', () => {
    const f = fitLine([0, 1, 2, 3], [5, 3, 1, -1])!;
    expect(f.slope).toBeCloseTo(-2, 12);
    expect(f.intercept).toBeCloseTo(5, 12);
    expect(f.r2).toBeCloseTo(1, 12);
    expect(fitLine([1, 1], [2, 3])).toBeNull();
    expect(recover(rows([[0, 0]]))).toBeNull();
  });
});

describe("Faraday's laws", () => {
  it('lesson example: 5.0 A for 965 s deposits 1.59 g of Cu', () => {
    const r = electrolysis({ id: 'cu', I: 5, t: 965 });
    expect(r.Q).toBe(4825);
    expect(r.molE).toBeCloseTo(0.05, 12);
    expect(r.molCathode).toBeCloseTo(0.025, 12);
    expect(r.mass).toBeCloseTo(1.5875, 9);
    expect(r.mass.toFixed(2)).toBe('1.59');
  });
  it('w = M I t / (n F) for each electrolyte', () => {
    for (const e of ELECTROLYTES) {
      const r = electrolysis({ id: e.id, I: 3, t: 600 });
      expect(r.mass).toBeCloseTo((e.M * 3 * 600) / (e.ne * 96500), 12);
    }
    expect(electrolysis({ id: 'ag', I: 1, t: 965 }).mass).toBeCloseTo(1.08, 9);
    expect(electrolysis({ id: 'water', I: 1, t: 965 }).mass).toBeCloseTo(0.01, 12);
  });
  it('first law: doubling the charge doubles the mass (current or time)', () => {
    const base = electrolysis({ id: 'cu', I: 1, t: 1930 });
    expect(electrolysis({ id: 'cu', I: 2, t: 1930 }).mass / base.mass).toBeCloseTo(2, 12);
    expect(electrolysis({ id: 'cu', I: 1, t: 3860 }).mass / base.mass).toBeCloseTo(2, 12);
  });
  it('second law: the same charge gives masses in the ratio of the equivalent masses (M/n)', () => {
    const cu = electrolysis({ id: 'cu', I: 2, t: 500 }).mass;
    const ag = electrolysis({ id: 'ag', I: 2, t: 500 }).mass;
    expect(cu / ag).toBeCloseTo(63.5 / 2 / 108, 12);
  });
  it('oxygen at the anode: 4 electrons per O₂, so the oxygen mass is 8 g per 96500 C', () => {
    expect(electrolysis({ id: 'cu', I: 1, t: 96500 }).massO2).toBeCloseTo(8, 9);
    expect(electrolysis({ id: 'water', I: 1, t: 96500 }).mass).toBeCloseTo(1, 9);
  });
  it('mass against charge is a straight line through the origin, and its slope gives n', () => {
    const Q = [500, 1500, 3000, 4500];
    const m = Q.map((q) => electrolysis({ id: 'cu', I: 1, t: q }).mass);
    const k = slopeThroughOrigin(Q, m)!;
    expect(k).toBeCloseTo(63.5 / (2 * 96500), 12);
    expect(electronsFromSlope(k, 63.5)).toBeCloseTo(2, 9);
    const mAg = Q.map((q) => electrolysis({ id: 'ag', I: 1, t: q }).mass);
    expect(electronsFromSlope(slopeThroughOrigin(Q, mAg)!, 108)).toBeCloseTo(1, 9);
    expect(slopeThroughOrigin([], [])).toBeNull();
  });
});

describe('teaching data', () => {
  it('prediction 1: Zn is the anode against Ag and E° = 1.56 V', () => {
    const p = PREDICTS[0]!;
    const r = galvanic(p.test.cell);
    expect(r.anode.id).toBe('Zn');
    expect(r.E0).toBeCloseTo(1.56, 9);
    expect(p.options[p.answer]).toMatch(/^Zinc/);
    // the wrong answers would make Ag the anode, which the model never does
    expect(r.cathode.id).toBe('Ag');
  });
  it('prediction 2: raising [Cu²⁺] from 0.1 M to 1.0 M raises E by 0.0296 V', () => {
    const p = PREDICTS[1]!;
    const d = galvanic(p.test.cell).E - galvanic(p.base.cell).E;
    expect(d).toBeCloseTo(0.0296, 9);
    expect(p.options[p.answer]).toBe('Ecell rises by about 0.03 V');
    expect(galvanic(p.base.cell).E).toBeCloseTo(1.0704, 9);
  });
  it('prediction 3: near zero for Sn | Pb at [Sn²⁺] = 2 M, equilibrium is Q = K = 2.18', () => {
    const p = PREDICTS[2]!;
    const t = galvanic(p.test.cell);
    expect(Math.abs(t.E)).toBeLessThan(0.002);
    expect(t.E).toBeGreaterThan(0);
    expect(galvanic(p.base.cell).K).toBeCloseTo(Math.pow(10, 0.2 / 0.592), 9);
    expect(galvanic(p.base.cell).K).toBeCloseTo(2.18, 2);
    expect(t.Q).toBeLessThan(galvanic(p.base.cell).K);
    expect(p.options[p.answer]).toBe('It has reached equilibrium: Q = K, ΔG = 0 and no net current flows');
  });
  it('prediction 4: double the current, double the mass (0.635 g to 1.270 g)', () => {
    const p = PREDICTS[3]!;
    const a = electrolysis(p.base.elec).mass;
    const b = electrolysis(p.test.elec).mass;
    expect(a).toBeCloseTo(0.635, 9);
    expect(b).toBeCloseTo(1.27, 9);
    expect(b / a).toBeCloseTo(2, 12);
    expect(p.options[p.answer]).toBe('It doubles');
  });
  it('every prediction has four options, matching modes for the experiment, and an explanation', () => {
    expect(PREDICTS.length).toBe(4);
    for (const p of PREDICTS) {
      expect(p.options.length).toBe(4);
      expect(new Set(p.options).size).toBe(4);
      expect(p.base.mode).toBe(p.test.mode);
      expect(p.why({ base: p.base, test: p.test }).length).toBeGreaterThan(100);
    }
    expect(PREDICTS.map((p) => p.answer)).toEqual([0, 2, 1, 2]);
  });
  it('practice 1: E°cell of Zn | Ag is 1.56 V (not 0.04 V)', () => {
    expect(galvanic(C('Zn', 'Ag')).E0).toBeCloseTo(1.56, 9);
    expect(0.8 + -0.76).toBeCloseTo(0.04, 9);
    expect(APPLY[0]!.options[APPLY[0]!.answer]).toBe('1.56 V');
  });
  it('practice 2: Ni(0.1 M) | Ag(0.01 M) gives 0.96 V; n = 1 would give 0.87 V', () => {
    const r = galvanic(C('Ni', 'Ag', -1, -2));
    expect(r.E0).toBeCloseTo(1.05, 9);
    expect(r.E).toBeCloseTo(0.9612, 9);
    expect(r.E.toFixed(2)).toBe('0.96');
    expect(1.05 - 0.0592 * 3).toBeCloseTo(0.8724, 9);
    expect(APPLY[1]!.options[APPLY[1]!.answer]).toBe('0.96 V');
  });
  it('practice 3: Fe | Cu has ΔG° = −150.5 kJ/mol', () => {
    const r = galvanic(C('Fe', 'Cu'));
    expect(r.E0).toBeCloseTo(0.78, 9);
    expect(r.dG0).toBeCloseTo(-150.54, 9);
    expect(r.dG0.toFixed(1)).toBe('-150.5');
    expect((r.dG0 / 2).toFixed(1)).toBe('-75.3');
    expect((r.dG0 * 2).toFixed(1)).toBe('-301.1');
    expect(APPLY[2]!.options[APPLY[2]!.answer]).toBe('−150.5 kJ mol⁻¹');
  });
  it('practice 4: 1.08 g of silver and copper in series gives 0.3175 g of copper', () => {
    const ag = electrolysis({ id: 'ag', I: 1, t: 965 });
    expect(ag.mass).toBeCloseTo(1.08, 9);
    const cu = electrolysis({ id: 'cu', I: 1, t: 965 });
    expect(cu.mass).toBeCloseTo(0.31750, 9);
    expect(cu.mass.toFixed(2)).toBe('0.32');
    expect(APPLY[3]!.options[APPLY[3]!.answer]).toBe('0.32 g');
  });
  it('practice 5: in Mg | Cu electrons leave Mg and anions go to the Mg half-cell', () => {
    const r = galvanic(C('Mg', 'Cu'));
    expect(r.anode.id).toBe('Mg');
    expect(electronsLeaveFrom(r)).toBe('left');
    expect(saltBridge(r).anionsToward).toBe(r.anodeSide);
    expect(APPLY[4]!.options[APPLY[4]!.answer]).toMatch(/^Electrons flow from Mg to Cu in the wire, and anions in the salt bridge move towards the Mg half-cell$/);
  });
  it('five new practice questions with four distinct options each and spread-out keys', () => {
    expect(APPLY.length).toBe(5);
    for (const q of APPLY) { expect(new Set(q.options).size).toBe(4); expect(q.why.length).toBeGreaterThan(60); }
    expect(APPLY.map((q) => q.answer)).toEqual([1, 0, 2, 3, 1]);
  });
  it('start state is the Daniell cell at standard conditions', () => {
    expect(galvanic(START.cell).E).toBeCloseTo(1.1, 12);
  });
});
