import { describe, expect, it } from 'vitest';
import {
  alleleFreqFromCounts, APPLY, APPLY_CHECK, buildSquare, canonicalPair, checkMystery, checkP, CROSS_ORDER, CROSSES, deterministicPath, deviation, driftFinals, gametes, genotypeText, hwExpectedCounts,
  hwFreqs, HW_DATASETS, inEquilibrium, linearFit, logLogSlope, MEASURE_CROSS, MEASURE_SIZES, measureRow, meanDeviation, meanDrift, mulberry32, mysteryOptions, mysteryTask, NO_FACTORS, PREDICTS, phenotypeOf,
  raiseOffspring, ratioText, reduceRatio, selectionP, selectionQ, simulateDrift, stepDeterministic, subSeed, tally, type Genotype, type Pair,
} from './genetics';

const P = (a: string, b: string): Pair => [a, b];
const sq = (id: Parameters<typeof buildSquare>[0], A: Genotype, B: Genotype) => buildSquare(id, A, B);
const phenoMap = (s: ReturnType<typeof buildSquare>) => Object.fromEntries(s.phenoLabels.map((l, i) => [l, s.phenoCounts[i]!]));
const genoMap = (s: ReturnType<typeof buildSquare>) => Object.fromEntries(s.genoLabels.map((l, i) => [l, s.genoCounts[i]!]));

describe('seeded generator', () => {
  it('repeats exactly for the same seed and differs for another', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const xs = Array.from({ length: 20 }, () => a()), ys = Array.from({ length: 20 }, () => b()), zs = Array.from({ length: 20 }, () => c());
    expect(xs).toEqual(ys);
    expect(xs).not.toEqual(zs);
  });
  it('stays in [0, 1) and is close to uniform', () => {
    const r = mulberry32(7);
    let sum = 0;
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); sum += x; bins[Math.floor(x * 10)]++; }
    expect(sum / 100000).toBeGreaterThan(0.49);
    expect(sum / 100000).toBeLessThan(0.51);
    for (const b of bins) { expect(b).toBeGreaterThan(9500); expect(b).toBeLessThan(10500); }
  });
  it('sub-seeds are distinct', () => {
    expect(new Set(Array.from({ length: 500 }, (_, k) => subSeed(5, k))).size).toBe(500);
  });
});

describe('gametes', () => {
  it('Tt gives T and t; TT gives T, T; RrYy gives RY, Ry, rY, ry', () => {
    expect(gametes([P('T', 't')])).toEqual([['T'], ['t']]);
    expect(gametes([P('T', 'T')])).toEqual([['T'], ['T']]);
    expect(gametes([P('R', 'r'), P('Y', 'y')])).toEqual([['R', 'Y'], ['R', 'y'], ['r', 'Y'], ['r', 'y']]);
  });
  it('canonical order is the order of the lesson (Tt not tT, I^A i not i I^A)', () => {
    expect(canonicalPair(CROSSES.mono.loci[0]!, 't', 'T')).toEqual(['T', 't']);
    expect(canonicalPair(CROSSES.abo.loci[0]!, 'i', 'IA')).toEqual(['IA', 'i']);
  });
});

describe('monohybrid and test crosses', () => {
  it('Tt x Tt gives 1 TT : 2 Tt : 1 tt and 3 tall : 1 dwarf', () => {
    const s = sq('mono', [P('T', 't')], [P('T', 't')]);
    expect(s.total).toBe(4);
    expect(genoMap(s)).toEqual({ TT: 1, Tt: 2, tt: 1 });
    expect(phenoMap(s)).toEqual({ Tall: 3, Dwarf: 1 });
    expect(ratioText(s.genoCounts)).toBe('1 : 2 : 1');
    expect(ratioText(s.phenoCounts)).toBe('3 : 1');
  });
  it('TT x tt: all Tt and tall; TT x TT all TT; tt x tt all dwarf', () => {
    const f1 = sq('mono', [P('T', 'T')], [P('t', 't')]);
    expect(genoMap(f1)).toEqual({ TT: 0, Tt: 4, tt: 0 });
    expect(phenoMap(f1)).toEqual({ Tall: 4, Dwarf: 0 });
    expect(ratioText(f1.phenoCounts)).toBe('1');
    expect(phenoMap(sq('mono', [P('t', 't')], [P('t', 't')]))).toEqual({ Tall: 0, Dwarf: 4 });
  });
  it('test cross: Tt x tt gives 1 : 1, TT x tt gives all tall', () => {
    const het = sq('test', [P('T', 't')], [P('t', 't')]);
    expect(phenoMap(het)).toEqual({ Tall: 2, Dwarf: 2 });
    expect(ratioText(het.phenoCounts)).toBe('1 : 1');
    expect(ratioText(het.genoCounts)).toBe('1 : 1');
    const hom = sq('test', [P('T', 'T')], [P('t', 't')]);
    expect(phenoMap(hom)).toEqual({ Tall: 4, Dwarf: 0 });
  });
  it('Tt x TT: all tall, genotypes 1 TT : 1 Tt (a back cross to a dominant parent)', () => {
    const s = sq('mono', [P('T', 't')], [P('T', 'T')]);
    expect(phenoMap(s)).toEqual({ Tall: 4, Dwarf: 0 });
    expect(genoMap(s)).toEqual({ TT: 2, Tt: 2, tt: 0 });
  });
  it('every monohybrid cross has 4 cells, and genotype and phenotype counts add up', () => {
    for (const a of CROSSES.mono.choicesA[0]!) for (const b of CROSSES.mono.choicesB[0]!) {
      const s = sq('mono', [a], [b]);
      expect(s.total).toBe(4);
      expect(s.genoCounts.reduce((x, y) => x + y)).toBe(4);
      expect(s.phenoCounts.reduce((x, y) => x + y)).toBe(4);
    }
  });
});

describe('dihybrid crosses', () => {
  const RrYy: Genotype = [P('R', 'r'), P('Y', 'y')];
  it('RrYy x RrYy gives 9 : 3 : 3 : 1 and 16 cells', () => {
    const s = sq('di', RrYy, RrYy);
    expect(s.total).toBe(16);
    expect(s.rows).toEqual(['RY', 'Ry', 'rY', 'ry']);
    expect(phenoMap(s)).toEqual({ 'Round, Yellow': 9, 'Round, Green': 3, 'Wrinkled, Yellow': 3, 'Wrinkled, Green': 1 });
    expect(ratioText(s.phenoCounts)).toBe('9 : 3 : 3 : 1');
  });
  it('the genotype ratio is 1 : 2 : 1 : 2 : 4 : 2 : 1 : 2 : 1 (nine genotypes)', () => {
    const s = sq('di', RrYy, RrYy);
    expect(s.genoCounts).toEqual([1, 2, 1, 2, 4, 2, 1, 2, 1]);
    expect(genoMap(s).RrYy).toBe(4);
    expect(genoMap(s).RRYY).toBe(1);
    expect(genoMap(s).rryy).toBe(1);
  });
  it('the dihybrid ratio is the product of two 3 : 1 ratios', () => {
    const s = sq('di', RrYy, RrYy);
    const m = phenoMap(s);
    expect(m['Round, Yellow']).toBe(3 * 3);
    expect(m['Round, Green']).toBe(3 * 1);
    expect(m['Wrinkled, Yellow']).toBe(1 * 3);
    expect(m['Wrinkled, Green']).toBe(1 * 1);
  });
  it('RRYY x rryy gives an all-RrYy round yellow F1', () => {
    const s = sq('di', [P('R', 'R'), P('Y', 'Y')], [P('r', 'r'), P('y', 'y')]);
    expect(phenoMap(s)['Round, Yellow']).toBe(16);
    expect(genoMap(s).RrYy).toBe(16);
  });
  it('dihybrid test cross RrYy x rryy gives 1 : 1 : 1 : 1', () => {
    const s = sq('di', RrYy, [P('r', 'r'), P('y', 'y')]);
    expect(ratioText(s.phenoCounts)).toBe('1 : 1 : 1 : 1');
  });
  it('RrYy x rryy: 400 offspring give 100 of each class', () => {
    const s = sq('di', RrYy, [P('r', 'r'), P('y', 'y')]);
    expect(s.phenoCounts.map((c) => (c / s.total) * 400)).toEqual([100, 100, 100, 100]);
  });
  it('RrYY x RrYy gives round:wrinkled 3:1 and all yellow', () => {
    const s = sq('di', [P('R', 'r'), P('Y', 'Y')], RrYy);
    expect(phenoMap(s)).toEqual({ 'Round, Yellow': 12, 'Round, Green': 0, 'Wrinkled, Yellow': 4, 'Wrinkled, Green': 0 });
    expect(ratioText(s.phenoCounts)).toBe('3 : 1');
  });
});

describe('incomplete dominance and codominance', () => {
  it('Rr x Rr gives 1 red : 2 pink : 1 white, and phenotype ratio = genotype ratio', () => {
    const s = sq('incomplete', [P('R', 'r')], [P('R', 'r')]);
    expect(phenoMap(s)).toEqual({ Red: 1, Pink: 2, White: 1 });
    expect(ratioText(s.phenoCounts)).toBe('1 : 2 : 1');
    expect(s.phenoCounts).toEqual(s.genoCounts);
  });
  it('RR x rr gives all pink; RR x Rr gives 1 red : 1 pink; Rr x rr gives 1 pink : 1 white', () => {
    expect(phenoMap(sq('incomplete', [P('R', 'R')], [P('r', 'r')]))).toEqual({ Red: 0, Pink: 4, White: 0 });
    expect(ratioText(sq('incomplete', [P('R', 'R')], [P('R', 'r')]).phenoCounts)).toBe('1 : 1');
    expect(phenoMap(sq('incomplete', [P('R', 'r')], [P('r', 'r')]))).toEqual({ Red: 0, Pink: 2, White: 2 });
  });
});

describe('ABO blood groups (multiple alleles)', () => {
  it('six genotypes map to four phenotypes exactly as the lesson table says', () => {
    const l = CROSSES.abo.loci[0]!;
    const g = (a: string, b: string) => l.phenotype(canonicalPair(l, a, b));
    expect(g('IA', 'IA')).toBe('A');
    expect(g('IA', 'i')).toBe('A');
    expect(g('IB', 'IB')).toBe('B');
    expect(g('IB', 'i')).toBe('B');
    expect(g('IA', 'IB')).toBe('AB');
    expect(g('i', 'i')).toBe('O');
    expect(l.pairs.length).toBe(6);
    expect(new Set(l.pairs.map((p) => l.phenotype(p))).size).toBe(4);
  });
  it('I^A i x I^B i gives A, B, AB and O in equal numbers (1 : 1 : 1 : 1)', () => {
    const s = sq('abo', [P('IA', 'i')], [P('IB', 'i')]);
    expect(phenoMap(s)).toEqual({ A: 1, B: 1, AB: 1, O: 1 });
  });
  it('the lesson example: A woman (I^A i) x B man (I^B i) gives each group with probability 1/4', () => {
    const s = sq('abo', [P('IA', 'i')], [P('IB', 'i')]);
    expect(s.phenoCounts.map((c) => c / s.total)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
  it('AB x O gives only A and B; AB x AB gives 1 A : 1 AB : ... as 1 I^A I^A : 2 I^A I^B : 1 I^B I^B', () => {
    expect(phenoMap(sq('abo', [P('IA', 'IB')], [P('i', 'i')]))).toEqual({ A: 2, B: 2, AB: 0, O: 0 });
    const ab = sq('abo', [P('IA', 'IB')], [P('IA', 'IB')]);
    expect(phenoMap(ab)).toEqual({ A: 1, B: 1, AB: 2, O: 0 });
  });
  it('O x O gives only O; A (I^A i) x O gives 1 A : 1 O; homozygous A x B gives all AB', () => {
    expect(phenoMap(sq('abo', [P('i', 'i')], [P('i', 'i')]))).toEqual({ A: 0, B: 0, AB: 0, O: 4 });
    expect(ratioText(sq('abo', [P('IA', 'i')], [P('i', 'i')]).phenoCounts)).toBe('1 : 1');
    expect(phenoMap(sq('abo', [P('IA', 'IA')], [P('IB', 'IB')])).AB).toBe(4);
  });
  it('two O parents can never have an A or B child (checked over every pair of parents)', () => {
    const l = CROSSES.abo.loci[0]!;
    for (const a of l.pairs) for (const b of l.pairs) {
      const s = sq('abo', [a], [b]);
      const m = phenoMap(s);
      if (l.phenotype(a) === 'O' && l.phenotype(b) === 'O') expect(m.O).toBe(4);
      expect(s.phenoCounts.reduce((x, y) => x + y)).toBe(4);
      // each child carries one allele from each parent
      s.cells.forEach((c) => { for (const allele of c[0]!) expect([...a, ...b]).toContain(allele); });
    }
  });
});

describe('sex determination', () => {
  it('XX x XY gives 1 girl : 1 boy; ZW x ZZ gives 1 female : 1 male', () => {
    const h = sq('sex', [P('X', 'X')], [P('X', 'Y')]);
    expect(phenoMap(h)).toEqual({ Female: 2, Male: 2 });
    expect(genoMap(h)).toEqual({ XX: 2, XY: 2 });
    const b = sq('bird', [P('Z', 'W')], [P('Z', 'Z')]);
    expect(phenoMap(b)).toEqual({ Female: 2, Male: 2 });
    expect(genoMap(b)).toEqual({ ZZ: 2, ZW: 2 });
  });
  it('in humans the father passes Y to sons; in birds the mother passes W to daughters', () => {
    const h = sq('sex', [P('X', 'X')], [P('X', 'Y')]);
    h.cells.forEach((c, i) => { if (phenotypeOf('sex', c) === 'Male') expect(h.colGametes[i % 2]).toEqual(['Y']); });
    const b = sq('bird', [P('Z', 'W')], [P('Z', 'Z')]);
    b.cells.forEach((c, i) => { if (phenotypeOf('bird', c) === 'Female') expect(b.rowGametes[Math.floor(i / 2)]).toEqual(['W']); });
  });
});

describe('every cross, every parent combination', () => {
  it('the square is always 2^k x 2^k, the counts add up, and the default parents are allowed', () => {
    for (const id of CROSS_ORDER) {
      const def = CROSSES[id];
      const k = def.loci.length;
      for (const a of def.choicesA[0]!) for (const b of def.choicesB[0]!) {
        const s = buildSquare(id, k === 1 ? [a] : [a, def.choicesA[1]![0]!], k === 1 ? [b] : [b, def.choicesB[1]![0]!]);
        expect(s.total).toBe(4 ** k);
        expect(s.genoCounts.reduce((x, y) => x + y)).toBe(s.total);
        expect(s.phenoCounts.reduce((x, y) => x + y)).toBe(s.total);
        expect(s.cellGeno.every((x) => x >= 0)).toBe(true);
        expect(s.cellPheno.every((x) => x >= 0)).toBe(true);
      }
      expect(def.choicesA.length).toBe(k);
      def.defaultA.forEach((p, i) => expect(def.choicesA[i]!.some((c) => c[0] === p[0] && c[1] === p[1])).toBe(true));
      def.defaultB.forEach((p, i) => expect(def.choicesB[i]!.some((c) => c[0] === p[0] && c[1] === p[1])).toBe(true));
    }
  });
  it('ratio helpers', () => {
    expect(reduceRatio([6, 2, 0])).toEqual([3, 1]);
    expect(reduceRatio([0, 0])).toEqual([]);
    expect(ratioText([36, 12, 12, 4])).toBe('9 : 3 : 3 : 1');
    expect(genotypeText([P('R', 'r'), P('Y', 'y')])).toBe('RrYy');
    expect(genotypeText([P('IA', 'i')])).toBe('I^A i');
  });
});

describe('raising offspring with a seed', () => {
  const s = sq('di', [P('R', 'r'), P('Y', 'y')], [P('R', 'r'), P('Y', 'y')]);
  it('is reproducible for a seed, differs for another, and the first 10 of 50 are the 10', () => {
    expect(raiseOffspring(s, 200, 11)).toEqual(raiseOffspring(s, 200, 11));
    expect(raiseOffspring(s, 200, 11)).not.toEqual(raiseOffspring(s, 200, 12));
    expect(raiseOffspring(s, 50, 11).slice(0, 10)).toEqual(raiseOffspring(s, 10, 11));
  });
  it('tallies add up to n and use only genotypes the square allows', () => {
    for (const n of [10, 50, 200, 1000]) {
      const t = tally(s, raiseOffspring(s, n, 3));
      expect(t.pheno.reduce((a, b) => a + b)).toBe(n);
      expect(t.geno.reduce((a, b) => a + b)).toBe(n);
    }
    const tt = sq('mono', [P('T', 'T')], [P('t', 't')]);
    expect(tally(tt, raiseOffspring(tt, 100, 1)).geno).toEqual([0, 100, 0]);
  });
  it('1000 offspring of RrYy x RrYy are close to 9 : 3 : 3 : 1 (many seeds, 6 standard deviations)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const t = tally(s, raiseOffspring(s, 1000, seed));
      s.phenoCounts.forEach((c, i) => {
        const p = c / 16, sd = Math.sqrt(1000 * p * (1 - p));
        expect(Math.abs(t.pheno[i]! - 1000 * p)).toBeLessThan(6 * sd);
      });
    }
  });
  it('average counts over 400 runs of 100 offspring match the expected counts closely', () => {
    const tot = s.phenoLabels.map(() => 0);
    for (let k = 0; k < 400; k++) tally(s, raiseOffspring(s, 100, subSeed(99, k))).pheno.forEach((c, i) => { tot[i]! += c; });
    s.phenoCounts.forEach((c, i) => expect(Math.abs(tot[i]! / 400 - (100 * c) / 16)).toBeLessThan(0.7));
  });
});

describe('small samples deviate more: deviation shrinks as 1/sqrt(n)', () => {
  const m = MEASURE_CROSS();
  it('deviation is 0 for a perfect sample and 1 for the opposite extreme', () => {
    expect(deviation(m, [75, 25])).toBe(0);
    expect(deviation(m, [0, 100])).toBeCloseTo(0.75, 12);
    expect(deviation(m, [3, 1])).toBe(0);
  });
  it('the typical deviation falls as n rises, and matches the exact binomial value', () => {
    const typical = MEASURE_SIZES.map((n) => meanDeviation(m, n, 400, 5));
    for (let i = 1; i < typical.length; i++) expect(typical[i]!).toBeLessThan(typical[i - 1]!);
    // exact expectation of |X/n - 3/4| for X ~ Binomial(n, 3/4)
    const exact = (n: number) => {
      const lgf = [0];
      for (let k = 1; k <= n; k++) lgf.push(lgf[k - 1]! + Math.log(k));
      let e = 0;
      for (let k = 0; k <= n; k++) e += Math.exp(lgf[n]! - lgf[k]! - lgf[n - k]! + k * Math.log(0.75) + (n - k) * Math.log(0.25)) * Math.abs(k / n - 0.75);
      return e;
    };
    MEASURE_SIZES.forEach((n, i) => expect(Math.abs(typical[i]! - exact(n)) / exact(n)).toBeLessThan(0.1));
  });
  it('quadrupling n roughly halves the typical deviation', () => {
    const a = meanDeviation(m, 50, 600, 8), b = meanDeviation(m, 200, 600, 8), c = meanDeviation(m, 800, 600, 8);
    expect(a / b).toBeGreaterThan(1.7);
    expect(a / b).toBeLessThan(2.3);
    expect(b / c).toBeGreaterThan(1.7);
    expect(b / c).toBeLessThan(2.3);
  });
  it('the log-log slope of the recorded readings is about -1/2', () => {
    for (const set of [[10, 100, 1000], [20, 200, 2000], [10, 50, 200, 1000], [10, 20, 50, 100, 200, 500, 1000, 2000]]) {
      const rows = set.map((n) => measureRow(n, 4));
      expect(logLogSlope(rows)).toBeGreaterThan(-0.62);
      expect(logLogSlope(rows)).toBeLessThan(-0.4);
    }
  });
  it('a recorded row is reproducible and its counts add up', () => {
    const r = measureRow(200, 9);
    expect(r).toEqual(measureRow(200, 9));
    expect(r.tall + r.dwarf).toBe(200);
    expect(r.dev).toBeCloseTo(Math.abs(r.tall / 200 - 0.75), 12);
  });
  it('linear fit recovers a known line', () => {
    const f = linearFit([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(f.slope).toBeCloseTo(2, 12);
    expect(f.intercept).toBeCloseTo(1, 12);
  });
});

describe('mystery parent', () => {
  it('the hidden genotype and the counts are reproducible and the counts add up', () => {
    for (const kind of ['mono', 'di'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const t = mysteryTask(kind, seed);
        expect(mysteryTask(kind, seed)).toEqual(t);
        expect(t.observed.reduce((a, b) => a + b)).toBe(t.n);
        expect(t.options.map(genotypeText)).toContain(genotypeText(t.hidden));
      }
    }
  });
  it('every task is decidable: the observed classes identify exactly one option', () => {
    for (const kind of ['mono', 'di'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const t = mysteryTask(kind, seed);
        const cross = kind === 'mono' ? 'test' : 'di';
        const tester: Genotype = kind === 'mono' ? [P('t', 't')] : [P('r', 'r'), P('y', 'y')];
        const consistent = t.options.filter((o) => {
          const s = buildSquare(cross, o, tester);
          return t.observed.every((c, i) => c === 0 || s.phenoCounts[i]! > 0) && s.phenoCounts.every((c, i) => c === 0 || t.observed[i]! > 0);
        });
        expect(consistent.map(genotypeText)).toEqual([genotypeText(t.hidden)]);
      }
    }
  });
  it('all options occur over many seeds, and checkMystery marks only the hidden one correct', () => {
    for (const kind of ['mono', 'di'] as const) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        const t = mysteryTask(kind, seed);
        seen.add(genotypeText(t.hidden));
        t.options.forEach((o, i) => expect(checkMystery(t, i).correct).toBe(genotypeText(o) === genotypeText(t.hidden)));
      }
      expect(seen.size).toBe(mysteryOptions(kind).length);
    }
  });
  it('a homozygous hidden parent gives only tall offspring; a heterozygote gives about half dwarf', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const t = mysteryTask('mono', seed);
      if (genotypeText(t.hidden) === 'TT') expect(t.observed).toEqual([24, 0]);
      else { expect(t.observed[1]).toBeGreaterThan(0); expect(t.observed[0]).toBeGreaterThan(0); }
    }
  });
});

describe('Hardy-Weinberg', () => {
  it('p + q = 1 and p^2 + 2pq + q^2 = 1 for every p', () => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100, f = hwFreqs(p);
      expect(f.AA + f.Aa + f.aa).toBeCloseTo(1, 12);
      expect(f.AA).toBeCloseTo(p * p, 12);
      expect(f.aa).toBeCloseTo((1 - p) ** 2, 12);
      expect(f.Aa).toBeLessThanOrEqual(0.5 + 1e-12);
    }
  });
  it('heterozygotes are most frequent (0.5) at p = 0.5', () => {
    expect(hwFreqs(0.5).Aa).toBe(0.5);
    let best = 0, at = 0;
    for (let i = 0; i <= 1000; i++) { const h = hwFreqs(i / 1000).Aa; if (h > best) { best = h; at = i / 1000; } }
    expect(at).toBe(0.5);
  });
  it('lesson examples: aa 0.16 gives q 0.4 and 48 % Aa; 90 aa in 1000 gives 420 Aa', () => {
    const q = Math.sqrt(0.16);
    expect(q).toBeCloseTo(0.4, 12);
    expect(hwFreqs(1 - q).Aa).toBeCloseTo(0.48, 12);
    expect(1000 * hwFreqs(1 - Math.sqrt(90 / 1000)).Aa).toBeCloseTo(420, 8);
  });
  it('p = 0.3 gives heterozygotes 0.42 (prediction 3)', () => {
    expect(hwFreqs(0.3).Aa).toBeCloseTo(0.42, 12);
    expect(PREDICTS[2]!.options[PREDICTS[2]!.answer]).toBe('0.42');
  });
  it('allele frequency from counts, and the four given populations', () => {
    expect(alleleFreqFromCounts({ AA: 490, Aa: 420, aa: 90 })).toBeCloseTo(0.7, 12);
    expect(alleleFreqFromCounts({ AA: 500, Aa: 200, aa: 300 })).toBeCloseTo(0.6, 12);
    expect(alleleFreqFromCounts({ AA: 180, Aa: 240, aa: 80 })).toBeCloseTo(0.6, 12);
    expect(alleleFreqFromCounts({ AA: 250, Aa: 100, aa: 150 })).toBeCloseTo(0.6, 12);
  });
  it('populations 1 and 3 are in equilibrium; 2 and 4 are not (too few heterozygotes)', () => {
    expect(HW_DATASETS.map((d) => inEquilibrium(d))).toEqual([true, false, true, false]);
    const e = hwExpectedCounts(HW_DATASETS[1]!);
    expect(e.AA).toBeCloseTo(360, 8);
    expect(e.Aa).toBeCloseTo(480, 8);
    expect(e.aa).toBeCloseTo(160, 8);
    expect(HW_DATASETS[1]!.Aa).toBeLessThan(e.Aa);
  });
  it('p check accepts the right value to 0.005 and rejects others', () => {
    for (const d of HW_DATASETS) {
      const p = alleleFreqFromCounts(d);
      expect(checkP(d, p)).toBe(true);
      expect(checkP(d, p + 0.004)).toBe(true);
      expect(checkP(d, p + 0.02)).toBe(false);
      expect(checkP(d, 1 - p)).toBe(false);
    }
  });
  it('random mating restores Hardy-Weinberg proportions in one generation', () => {
    // gametes of a non-equilibrium population, then random union
    const c = { AA: 500, Aa: 200, aa: 300 };
    const p = alleleFreqFromCounts(c);
    const next = hwFreqs(p);
    expect(alleleFreqFromCounts({ AA: next.AA * 1000, Aa: next.Aa * 1000, aa: next.aa * 1000 })).toBeCloseTo(p, 12);
  });
});

describe('selection against aa', () => {
  it('matches hand-computed values: q = 0.5, s = 1 gives 1/3; q = 0.5, s = 0.5 gives 0.5 * 0.75 / 0.875 = 3/7', () => {
    expect(selectionQ(0.5, 1)).toBeCloseTo(1 / 3, 12);
    expect(selectionQ(0.5, 0.5)).toBeCloseTo(3 / 7, 12);
    expect(selectionQ(0.2, 0.1)).toBeCloseTo((0.2 * (1 - 0.02)) / (1 - 0.1 * 0.04), 12);
    expect(selectionP(0.5, 1)).toBeCloseTo(2 / 3, 12);
  });
  it('agrees with the genotype-level calculation of fitness-weighted frequencies', () => {
    for (const [q, s] of [[0.5, 0.3], [0.1, 0.8], [0.9, 0.05], [0.33, 1]] as const) {
      const p = 1 - q;
      const w = p * p + 2 * p * q + q * q * (1 - s);
      const aa = (q * q * (1 - s)) / w, Aa = (2 * p * q) / w;
      expect(selectionQ(q, s)).toBeCloseTo(aa + Aa / 2, 12);
    }
  });
  it('s = 0 changes nothing; q = 0 and q = 1 stay put; for s > 0 q goes down', () => {
    expect(selectionQ(0.37, 0)).toBeCloseTo(0.37, 12);
    expect(selectionQ(0, 0.5)).toBe(0);
    expect(selectionQ(1, 0.5)).toBe(1);
    for (let q = 0.05; q < 1; q += 0.05) expect(selectionQ(q, 0.4)).toBeLessThan(q);
  });
  it('s = 1: q follows q_t = q0 / (1 + t q0), the classic result for a lethal recessive', () => {
    let q = 0.5;
    for (let t = 1; t <= 20; t++) { q = selectionQ(q, 1); expect(q).toBeCloseTo(0.5 / (1 + t * 0.5), 10); }
  });
  it('a deterministic path with selection falls steadily toward p = 1 and never leaves [0, 1]', () => {
    const path = deterministicPath(0.5, 100, { ...NO_FACTORS, s: 0.5 });
    expect(path.length).toBe(101);
    for (let i = 1; i < path.length; i++) { expect(path[i]!).toBeGreaterThan(path[i - 1]!); expect(path[i]!).toBeLessThanOrEqual(1); }
    expect(path[100]!).toBeGreaterThan(0.95);
  });
});

describe('mutation and gene flow (one step, infinite population)', () => {
  it('mutation A to a at rate u: p goes from 0.8 to 0.8 (1 - 0.01) = 0.792', () => {
    expect(stepDeterministic(0.8, { ...NO_FACTORS, u: 0.01 })).toBeCloseTo(0.792, 12);
  });
  it('gene flow: p = (1 - m) p + m pm; with p = 0.9, m = 0.1, pm = 0.5 gives 0.86', () => {
    expect(stepDeterministic(0.9, { ...NO_FACTORS, m: 0.1, pm: 0.5 })).toBeCloseTo(0.86, 12);
  });
  it('gene flow drives a population to the source frequency; no factors changes nothing (Hardy-Weinberg)', () => {
    const f = { ...NO_FACTORS, m: 0.2, pm: 0.3 };
    expect(deterministicPath(0.9, 200, f).at(-1)!).toBeCloseTo(0.3, 6);
    expect(deterministicPath(0.37, 50, NO_FACTORS).every((p) => p === 0.37)).toBe(true);
  });
});

describe('genetic drift', () => {
  it('is reproducible for a seed and different for another', () => {
    const o = { p0: 0.5, N: 20, gens: 60, seed: 5 };
    expect(simulateDrift(o)).toEqual(simulateDrift(o));
    expect(simulateDrift(o)).not.toEqual(simulateDrift({ ...o, seed: 6 }));
    expect(simulateDrift(o).length).toBe(61);
    expect(simulateDrift(o)[0]).toBe(0.5);
  });
  it('p is a multiple of 1/(2N) and stays in [0, 1]; fixation (0 or 1) is absorbing without other forces', () => {
    const path = simulateDrift({ p0: 0.5, N: 5, gens: 300, seed: 2 });
    for (const p of path) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); expect(Math.abs(p * 10 - Math.round(p * 10))).toBeLessThan(1e-9); }
    const fixedAt = path.findIndex((p) => p === 0 || p === 1);
    expect(fixedAt).toBeGreaterThan(-1);
    for (const p of path.slice(fixedAt)) expect(p).toBe(path[fixedAt]);
  });
  it('the mean allele frequency over many populations stays at p0 (no force pushes it)', () => {
    const f = driftFinals(0.3, 50, 40, 600, 1);
    const mean = f.reduce((a, b) => a + b) / f.length;
    expect(Math.abs(mean - 0.3)).toBeLessThan(0.025);
  });
  it('the variance after t generations matches p0 q0 (1 - (1 - 1/2N)^t)', () => {
    for (const [N, t] of [[10, 10], [25, 20], [100, 30]] as const) {
      const f = driftFinals(0.5, N, t, 1500, 3);
      const mean = f.reduce((a, b) => a + b) / f.length;
      const v = f.reduce((a, b) => a + (b - mean) ** 2, 0) / f.length;
      const theory = 0.25 * (1 - (1 - 1 / (2 * N)) ** t);
      expect(Math.abs(v - theory) / theory).toBeLessThan(0.15);
    }
  });
  it('small populations drift further than large ones (prediction 4)', () => {
    const small = meanDrift(0.5, 10, 50, 300, 7), large = meanDrift(0.5, 1000, 50, 300, 7);
    expect(small).toBeGreaterThan(0.2);
    expect(large).toBeLessThan(0.09);
    expect(small).toBeGreaterThan(3 * large);
    expect(PREDICTS[3]!.options[PREDICTS[3]!.answer]).toBe('The population of 10');
  });
  it('a large population with selection follows the deterministic curve closely', () => {
    const f = { ...NO_FACTORS, s: 0.5 };
    const det = deterministicPath(0.5, 30, f);
    const sim = simulateDrift({ p0: 0.5, N: 20000, gens: 30, seed: 4, factors: f });
    for (let t = 0; t <= 30; t += 5) expect(Math.abs(sim[t]! - det[t]!)).toBeLessThan(0.02);
  });
  it('selection speeds the loss of the recessive in a small population too (average over runs)', () => {
    const noSel = driftFinals(0.5, 200, 60, 200, 11).reduce((a, b) => a + b) / 200;
    const sel = driftFinals(0.5, 200, 60, 200, 11, { ...NO_FACTORS, s: 0.5 }).reduce((a, b) => a + b) / 200;
    expect(sel).toBeGreaterThan(noSel + 0.2);
  });
});

describe('predictions', () => {
  it('prediction 1 (RrYy x RrYy): 9 : 3 : 3 : 1', () => {
    const s = sq('di', [P('R', 'r'), P('Y', 'y')], [P('R', 'r'), P('Y', 'y')]);
    expect(PREDICTS[0]!.options[PREDICTS[0]!.answer]).toBe(ratioText(s.phenoCounts).replace(/ : /g, ' : '));
  });
  it('prediction 2 (Tt x tt): half are tall', () => {
    const s = sq('test', [P('T', 't')], [P('t', 't')]);
    const tall = s.phenoCounts[0]! / s.total;
    expect(tall).toBe(0.5);
    expect(PREDICTS[1]!.options[PREDICTS[1]!.answer]).toBe('1/2');
  });
  it('every prediction has four options and an answer in range, and the others are wrong', () => {
    for (const p of PREDICTS) { expect(p.options.length).toBe(4); expect(p.answer).toBeGreaterThanOrEqual(0); expect(p.answer).toBeLessThan(4); expect(new Set(p.options).size).toBe(4); }
    expect(PREDICTS.length).toBe(4);
    expect(hwFreqs(0.3).Aa).not.toBeCloseTo(0.21, 3);
  });
});

describe('practice questions', () => {
  it('there are five, each with unique ids, options and a reasoned explanation', () => {
    expect(APPLY.length).toBe(5);
    expect(new Set(APPLY.map((q) => q.id)).size).toBe(5);
    for (const q of APPLY) { expect(new Set(q.options).size).toBe(q.options.length); expect(q.answer).toBeLessThan(q.options.length); expect(q.why.length).toBeGreaterThan(60); }
  });
  it('the keyed answer equals the answer computed by the model, for every question', () => {
    expect(APPLY_CHECK.length).toBe(APPLY.length);
    APPLY.forEach((q, i) => expect(q.options[q.answer]).toBe(APPLY_CHECK[i]!()));
  });
  it('the distractors are really wrong', () => {
    // Q1: 25, 200 and 300 would be 1/16, 1/2 and 3/4 of 400
    const sq1 = sq('di', [P('R', 'r'), P('Y', 'y')], [P('r', 'r'), P('y', 'y')]);
    const share = sq1.phenoCounts[1]! / sq1.total;
    expect(share * 400).toBe(100);
    expect([25, 200, 300]).not.toContain(share * 400);
    // Q4: 16 = p q, 48 = 2pq at q = .4, 64 = p^2
    const q = 0.2;
    expect(Math.round(100 * 2 * (1 - q) * q)).toBe(32);
    expect(Math.round(100 * (1 - q) * q)).toBe(16);
    expect(Math.round(100 * (1 - q) ** 2)).toBe(64);
    // Q2: AB and O never appear
    const ab = sq('abo', [P('IA', 'IB')], [P('i', 'i')]);
    expect(ab.phenoCounts[2]).toBe(0);
    expect(ab.phenoCounts[3]).toBe(0);
  });
});
