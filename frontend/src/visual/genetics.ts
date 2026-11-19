/**
 * Pure logic of the Genetics Lab (CUET-UG Biology, paper 304): crosses with Punnett squares, a seeded offspring
 * simulator, the Hardy-Weinberg principle, and drift, selection, mutation and gene flow over generations.
 * No React and no browser here, so every number the lab shows is recomputed by the unit tests.
 * Status of all lab content: Draft - unverified.
 */

// ---------------------------------------------------------------- seeded random numbers

/** mulberry32: a small deterministic generator. The same seed always gives the same stream of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A different, well-mixed seed for run number k of a base seed (used for repeated runs). */
export const subSeed = (seed: number, k: number) => (Math.imul(seed | 0, 2654435761) + Math.imul(k + 1, 40503) + 97) >>> 0;

// ---------------------------------------------------------------- alleles, genotypes, phenotypes

/** The two alleles of one gene in one individual. */
export type Pair = readonly [string, string];
/** One pair per gene (locus). */
export type Genotype = Pair[];

export interface Locus {
  id: string;
  /** All possible genotypes of this gene, in the order they are listed in the lesson. */
  pairs: Pair[];
  /** Phenotype classes of this gene, in display order. */
  classes: string[];
  phenotype: (p: Pair) => string;
}

export type CrossId = 'mono' | 'di' | 'test' | 'incomplete' | 'abo' | 'sex' | 'bird';

export interface CrossDef {
  id: CrossId;
  label: string;
  blurb: string;
  loci: Locus[];
  /** Allowed genotypes per gene for parent A and parent B. A single choice means that parent is fixed. */
  choicesA: Pair[][];
  choicesB: Pair[][];
  defaultA: Genotype;
  defaultB: Genotype;
  /** Names for the two parents in the interface. */
  nameA: string;
  nameB: string;
}

const tallLocus: Locus = {
  id: 'height',
  pairs: [['T', 'T'], ['T', 't'], ['t', 't']],
  classes: ['Tall', 'Dwarf'],
  phenotype: (p) => (p.includes('T') ? 'Tall' : 'Dwarf'),
};
const shapeLocus: Locus = {
  id: 'shape',
  pairs: [['R', 'R'], ['R', 'r'], ['r', 'r']],
  classes: ['Round', 'Wrinkled'],
  phenotype: (p) => (p.includes('R') ? 'Round' : 'Wrinkled'),
};
const colourLocus: Locus = {
  id: 'colour',
  pairs: [['Y', 'Y'], ['Y', 'y'], ['y', 'y']],
  classes: ['Yellow', 'Green'],
  phenotype: (p) => (p.includes('Y') ? 'Yellow' : 'Green'),
};
const snapLocus: Locus = {
  id: 'flower',
  pairs: [['R', 'R'], ['R', 'r'], ['r', 'r']],
  classes: ['Red', 'Pink', 'White'],
  phenotype: (p) => (p[0] === 'R' && p[1] === 'R' ? 'Red' : p[0] === 'r' && p[1] === 'r' ? 'White' : 'Pink'),
};
const aboLocus: Locus = {
  id: 'abo',
  pairs: [['IA', 'IA'], ['IA', 'i'], ['IB', 'IB'], ['IB', 'i'], ['IA', 'IB'], ['i', 'i']],
  classes: ['A', 'B', 'AB', 'O'],
  phenotype: (p) => {
    const a = p.includes('IA'), b = p.includes('IB');
    return a && b ? 'AB' : a ? 'A' : b ? 'B' : 'O';
  },
};
const sexXY: Locus = { id: 'sexXY', pairs: [['X', 'X'], ['X', 'Y']], classes: ['Female', 'Male'], phenotype: (p) => (p.includes('Y') ? 'Male' : 'Female') };
const sexZW: Locus = { id: 'sexZW', pairs: [['Z', 'Z'], ['Z', 'W']], classes: ['Male', 'Female'], phenotype: (p) => (p.includes('W') ? 'Female' : 'Male') };

const P = (a: string, b: string): Pair => [a, b];

export const CROSSES: Record<CrossId, CrossDef> = {
  mono: {
    id: 'mono', label: 'Monohybrid', nameA: 'Parent 1', nameB: 'Parent 2',
    blurb: 'One gene, two alleles: tall (T) is dominant over dwarf (t). Mendel’s law of dominance and law of segregation.',
    loci: [tallLocus], choicesA: [tallLocus.pairs], choicesB: [tallLocus.pairs], defaultA: [P('T', 't')], defaultB: [P('T', 't')],
  },
  di: {
    id: 'di', label: 'Dihybrid', nameA: 'Parent 1', nameB: 'Parent 2',
    blurb: 'Two genes on different chromosomes: round (R) over wrinkled (r) seed, yellow (Y) over green (y). Independent assortment.',
    loci: [shapeLocus, colourLocus], choicesA: [shapeLocus.pairs, colourLocus.pairs], choicesB: [shapeLocus.pairs, colourLocus.pairs], defaultA: [P('R', 'r'), P('Y', 'y')], defaultB: [P('R', 'r'), P('Y', 'y')],
  },
  test: {
    id: 'test', label: 'Test cross', nameA: 'Tall plant, genotype unknown', nameB: 'Dwarf tester',
    blurb: 'A tall plant is crossed with the homozygous recessive dwarf (tt). The offspring show whether the tall parent is TT or Tt.',
    loci: [tallLocus], choicesA: [[P('T', 'T'), P('T', 't')]], choicesB: [[P('t', 't')]], defaultA: [P('T', 't')], defaultB: [P('t', 't')],
  },
  incomplete: {
    id: 'incomplete', label: 'Incomplete dominance', nameA: 'Parent 1', nameB: 'Parent 2',
    blurb: 'Snapdragon (Antirrhinum): neither allele is completely dominant, so Rr is pink, between red RR and white rr.',
    loci: [snapLocus], choicesA: [snapLocus.pairs], choicesB: [snapLocus.pairs], defaultA: [P('R', 'r')], defaultB: [P('R', 'r')],
  },
  abo: {
    id: 'abo', label: 'ABO blood groups', nameA: 'Mother', nameB: 'Father',
    blurb: 'Three alleles I^A, I^B and i (multiple alleles). I^A and I^B are dominant over i and co-dominant with each other.',
    loci: [aboLocus], choicesA: [aboLocus.pairs], choicesB: [aboLocus.pairs], defaultA: [P('IA', 'i')], defaultB: [P('IB', 'i')],
  },
  sex: {
    id: 'sex', label: 'Sex: humans (XX, XY)', nameA: 'Mother', nameB: 'Father',
    blurb: 'In humans the female is XX and the male is XY. The sperm decides the sex of the child.',
    loci: [sexXY], choicesA: [[P('X', 'X')]], choicesB: [[P('X', 'Y')]], defaultA: [P('X', 'X')], defaultB: [P('X', 'Y')],
  },
  bird: {
    id: 'bird', label: 'Sex: birds (ZW, ZZ)', nameA: 'Hen (female)', nameB: 'Cock (male)',
    blurb: 'In birds the female is ZW and the male is ZZ. The egg decides the sex of the chick.',
    loci: [sexZW], choicesA: [[P('Z', 'W')]], choicesB: [[P('Z', 'Z')]], defaultA: [P('Z', 'W')], defaultB: [P('Z', 'Z')],
  },
};
export const CROSS_ORDER: CrossId[] = ['mono', 'di', 'test', 'incomplete', 'abo', 'sex', 'bird'];

/** Plain-text symbol of an allele (the lesson writes the blood-group alleles as I^A, I^B and i). */
export const alleleText = (a: string) => (a === 'IA' ? 'I^A' : a === 'IB' ? 'I^B' : a);
/** Genotype of one gene as text: Tt, or I^A i for blood groups. */
export const pairText = (p: Pair) => (p[0].length > 1 || p[1].length > 1 ? `${alleleText(p[0])} ${alleleText(p[1])}` : `${p[0]}${p[1]}`);
/** Whole genotype as text: RrYy. */
export const genotypeText = (g: Genotype) => g.map(pairText).join('');
const pairKey = (p: Pair) => `${p[0]}|${p[1]}`;
const sameAlleles = (x: Pair, y: Pair) => (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0]);

/** The canonical version of a pair for a locus: the same order as in locus.pairs. */
export function canonicalPair(l: Locus, a: string, b: string): Pair {
  const hit = l.pairs.find((p) => sameAlleles(p, [a, b]));
  if (!hit) throw new Error(`Unknown genotype ${a}${b} for ${l.id}`);
  return hit;
}

/** The phenotype of a genotype, e.g. "Round, Yellow". */
export function phenotypeOf(cross: CrossId, g: Genotype): string {
  const def = CROSSES[cross];
  return def.loci.map((l, i) => l.phenotype(g[i]!)).join(', ');
}

/** The gametes of a parent: 2 per gene, combined across genes (2 or 4 gametes), listed with repeats so the square is always 2 x 2 or 4 x 4. */
export function gametes(g: Genotype): string[][] {
  let out: string[][] = [[]];
  for (const p of g) out = out.flatMap((x) => [[...x, p[0]], [...x, p[1]]]);
  return out;
}
export const gameteText = (gm: string[]) => gm.map(alleleText).join(gm.some((a) => a.length > 1) ? ' ' : '');

const cartesian = <T,>(lists: T[][]): T[][] => lists.reduce<T[][]>((acc, list) => acc.flatMap((x) => list.map((y) => [...x, y])), [[]]);

// ---------------------------------------------------------------- the Punnett square

export interface Square {
  cross: CrossId;
  A: Genotype;
  B: Genotype;
  rowGametes: string[][];
  colGametes: string[][];
  rows: string[];
  cols: string[];
  /** Offspring genotype of each cell, row by row. */
  cells: Genotype[];
  cellText: string[];
  cellGeno: number[];
  cellPheno: number[];
  genoLabels: string[];
  phenoLabels: string[];
  genoCounts: number[];
  phenoCounts: number[];
  total: number;
}

export function buildSquare(cross: CrossId, A: Genotype, B: Genotype): Square {
  const def = CROSSES[cross];
  const rowGametes = gametes(A);
  const colGametes = gametes(B);
  const genoClasses = cartesian(def.loci.map((l) => l.pairs.map(pairKey)));
  const genoLabels = cartesian(def.loci.map((l) => l.pairs)).map((g) => genotypeText(g as unknown as Genotype));
  const phenoClasses = cartesian(def.loci.map((l) => l.classes));
  const phenoLabels = phenoClasses.map((c) => c.join(', '));
  const cells: Genotype[] = [];
  for (const r of rowGametes) for (const c of colGametes) cells.push(def.loci.map((l, i) => canonicalPair(l, r[i]!, c[i]!)));
  const cellGeno = cells.map((g) => genoClasses.findIndex((k) => k.join(',') === g.map(pairKey).join(',')));
  const cellPheno = cells.map((g) => phenoLabels.indexOf(phenotypeOf(cross, g)));
  const genoCounts = genoLabels.map((_, i) => cellGeno.filter((x) => x === i).length);
  const phenoCounts = phenoLabels.map((_, i) => cellPheno.filter((x) => x === i).length);
  return {
    cross, A, B, rowGametes, colGametes, rows: rowGametes.map(gameteText), cols: colGametes.map(gameteText),
    cells, cellText: cells.map(genotypeText), cellGeno, cellPheno, genoLabels, phenoLabels, genoCounts, phenoCounts, total: cells.length,
  };
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** Counts reduced to the smallest whole-number ratio (classes with zero count are left out). */
export function reduceRatio(counts: number[]): number[] {
  const nz = counts.filter((c) => c > 0);
  if (nz.length === 0) return [];
  const g = nz.reduce((a, b) => gcd(a, b));
  return nz.map((c) => c / g);
}
export const ratioText = (counts: number[]) => reduceRatio(counts).join(' : ');

/** Expected share of each phenotype class (counts / total). */
export const expectedShares = (sq: Square) => sq.phenoCounts.map((c) => c / sq.total);

// ---------------------------------------------------------------- raising offspring

/** n offspring drawn at random from the Punnett square (each cell is equally likely). Returns the cell number of each. The stream is prefix-stable: the first 10 of 50 are the 10 of 10. */
export function raiseOffspring(sq: Square, n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.min(sq.total - 1, Math.floor(rng() * sq.total)));
  return out;
}
export interface Tally { geno: number[]; pheno: number[]; n: number }
export function tally(sq: Square, drawn: number[]): Tally {
  const geno = sq.genoLabels.map(() => 0), pheno = sq.phenoLabels.map(() => 0);
  for (const c of drawn) { geno[sq.cellGeno[c]!]!++; pheno[sq.cellPheno[c]!]!++; }
  return { geno, pheno, n: drawn.length };
}
/** Total variation distance between the observed phenotype shares and the expected ones: half the sum of |observed - expected|. 0 = perfect, 1 = completely different. */
export function deviation(sq: Square, pheno: number[]): number {
  const n = pheno.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  let s = 0;
  sq.phenoCounts.forEach((c, i) => { s += Math.abs(pheno[i]! / n - c / sq.total); });
  return s / 2;
}
/** Average deviation over many independent runs of n offspring (a smooth curve of the typical deviation). */
export function meanDeviation(sq: Square, n: number, runs: number, seed: number): number {
  let s = 0;
  for (let k = 0; k < runs; k++) s += deviation(sq, tally(sq, raiseOffspring(sq, n, subSeed(seed, k))).pheno);
  return s / runs;
}

/** The fixed cross of the Measure step: Tt x Tt, expected 3 tall : 1 dwarf. */
export const MEASURE_CROSS = () => buildSquare('mono', [P('T', 't')], [P('T', 't')]);
export const MEASURE_SIZES = [10, 20, 50, 100, 200, 500, 1000, 2000];
export const MEASURE_RUNS = 200;
export interface MeasureRow { n: number; seed: number; tall: number; dwarf: number; observedRatio: string; dev: number; typical: number }
/** One recorded reading: n offspring of Tt x Tt raised with the seed, its deviation, and the typical deviation over many runs. */
export function measureRow(n: number, seed: number): MeasureRow {
  const sq = MEASURE_CROSS();
  const t = tally(sq, raiseOffspring(sq, n, seed));
  const [tall, dwarf] = [t.pheno[0]!, t.pheno[1]!];
  return { n, seed, tall, dwarf, observedRatio: dwarf > 0 ? `${(tall / dwarf).toFixed(2)} : 1` : 'no dwarf', dev: deviation(sq, t.pheno), typical: meanDeviation(sq, n, MEASURE_RUNS, seed + 777) };
}
/** Least-squares slope and intercept of y on x. */
export function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i]! - my); });
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, intercept: my - slope * mx };
}
/** Slope of log10(typical deviation) against log10(n). Theory: about -1/2. */
export function logLogSlope(rows: MeasureRow[]): number {
  return linearFit(rows.map((r) => Math.log10(r.n)), rows.map((r) => Math.log10(r.typical))).slope;
}

// ---------------------------------------------------------------- the mystery parent

export type MysteryKind = 'mono' | 'di';
export interface MysteryTask {
  kind: MysteryKind;
  seed: number;
  /** Genotype of the hidden parent (never shown until the student answers). */
  hidden: Genotype;
  /** What the student is told: the tester parent and the offspring counts. */
  testerText: string;
  phenoLabels: string[];
  observed: number[];
  n: number;
  options: Genotype[];
}
const MYSTERY_N = { mono: 24, di: 48 };

/** Possible genotypes of the dominant-phenotype parent, in a fixed order. */
export const mysteryOptions = (kind: MysteryKind): Genotype[] =>
  kind === 'mono'
    ? [[P('T', 'T')], [P('T', 't')]]
    : [[P('R', 'R'), P('Y', 'Y')], [P('R', 'r'), P('Y', 'Y')], [P('R', 'R'), P('Y', 'y')], [P('R', 'r'), P('Y', 'y')]];

/** A test cross with a hidden parent. The offspring counts are redrawn (from the next sub-seed) until every class the hidden genotype can produce appears at least once, so the answer is always decidable. */
export function mysteryTask(kind: MysteryKind, seed: number): MysteryTask {
  const rng = mulberry32(seed);
  const options = mysteryOptions(kind);
  const hidden = options[Math.min(options.length - 1, Math.floor(rng() * options.length))]!;
  const cross: CrossId = kind === 'mono' ? 'test' : 'di';
  const tester: Genotype = kind === 'mono' ? [P('t', 't')] : [P('r', 'r'), P('y', 'y')];
  const sq = buildSquare(cross, hidden, tester);
  let observed: number[] = [];
  for (let k = 0; k < 200; k++) {
    observed = tally(sq, raiseOffspring(sq, MYSTERY_N[kind], subSeed(seed, k))).pheno;
    if (sq.phenoCounts.every((c, i) => c === 0 || observed[i]! > 0)) break;
  }
  return { kind, seed, hidden, testerText: genotypeText(tester), phenoLabels: sq.phenoLabels, observed, n: MYSTERY_N[kind], options };
}
export function checkMystery(t: MysteryTask, choice: number): { correct: boolean; message: string } {
  const right = genotypeText(t.hidden);
  const chosen = genotypeText(t.options[choice]!);
  const correct = chosen === right;
  const seen = t.phenoLabels.map((l, i) => `${t.observed[i]} ${l.toLowerCase()}`).filter((_, i) => t.observed[i]! > 0).join(', ');
  const why = t.kind === 'mono'
    ? (right === 'TT' ? `Every offspring is tall (${seen}), so no t allele came from the unknown parent: it is TT.` : `About half the offspring are dwarf (${seen}). A dwarf (tt) needs a t from each parent, so the tall parent carries t: it is Tt.`)
    : `The offspring classes (${seen}) show which genes segregate. A gene that gives both forms came from a heterozygote; a gene that gives only the dominant form came from a homozygote. The hidden parent is ${right}.`;
  return { correct, message: correct ? `Correct: ${right}. ${why}` : `Not ${chosen}. The hidden parent was ${right}. ${why}` };
}

// ---------------------------------------------------------------- Hardy-Weinberg

export interface Freqs { AA: number; Aa: number; aa: number }
export const hwFreqs = (p: number): Freqs => ({ AA: p * p, Aa: 2 * p * (1 - p), aa: (1 - p) * (1 - p) });
/** Allele frequency p of A from genotype counts: (2 AA + Aa) / 2N. */
export function alleleFreqFromCounts(c: { AA: number; Aa: number; aa: number }): number {
  const n = c.AA + c.Aa + c.aa;
  return (2 * c.AA + c.Aa) / (2 * n);
}
export const hwExpectedCounts = (c: { AA: number; Aa: number; aa: number }): Freqs => {
  const n = c.AA + c.Aa + c.aa;
  const f = hwFreqs(alleleFreqFromCounts(c));
  return { AA: f.AA * n, Aa: f.Aa * n, aa: f.aa * n };
};
/** True when every observed genotype share is within `tol` of the share expected from the population's own p (Hardy-Weinberg proportions). */
export function inEquilibrium(c: { AA: number; Aa: number; aa: number }, tol = 0.02): boolean {
  const n = c.AA + c.Aa + c.aa;
  const e = hwFreqs(alleleFreqFromCounts(c));
  return Math.abs(c.AA / n - e.AA) <= tol && Math.abs(c.Aa / n - e.Aa) <= tol && Math.abs(c.aa / n - e.aa) <= tol;
}
export interface HwData { id: string; label: string; AA: number; Aa: number; aa: number }
export const HW_DATASETS: HwData[] = [
  { id: 'h1', label: 'Population 1 (1000 plants)', AA: 490, Aa: 420, aa: 90 },
  { id: 'h2', label: 'Population 2 (1000 plants)', AA: 500, Aa: 200, aa: 300 },
  { id: 'h3', label: 'Population 3 (500 moths)', AA: 180, Aa: 240, aa: 80 },
  { id: 'h4', label: 'Population 4 (500 moths)', AA: 250, Aa: 100, aa: 150 },
];
/** Is the student's p right (to within half a hundredth)? */
export const checkP = (d: HwData, guess: number) => Math.abs(guess - alleleFreqFromCounts(d)) <= 0.005;

// ---------------------------------------------------------------- change in allele frequency

/** Selection against the recessive homozygote (fitness AA = Aa = 1, aa = 1 - s): q' = q(1 - s q) / (1 - s q^2). */
export const selectionQ = (q: number, s: number) => (q * (1 - s * q)) / (1 - s * q * q);
export const selectionP = (p: number, s: number) => 1 - selectionQ(1 - p, s);

export interface Factors {
  /** Selection coefficient against aa, 0 to 1. */
  s: number;
  /** Mutation rate A -> a per generation. */
  u: number;
  /** Gene flow: fraction of each generation that are migrants. */
  m: number;
  /** Frequency of A among the migrants. */
  pm: number;
}
export const NO_FACTORS: Factors = { s: 0, u: 0, m: 0, pm: 0.5 };

/** One generation of the non-random forces, applied in the order selection, mutation, gene flow. Population assumed infinite (no drift). */
export function stepDeterministic(p: number, f: Factors): number {
  const p1 = f.s > 0 ? selectionP(p, f.s) : p;
  const p2 = p1 * (1 - f.u);
  return (1 - f.m) * p2 + f.m * f.pm;
}
/** The allele frequency of an infinite population over g generations (g + 1 values, the first is p0). */
export function deterministicPath(p0: number, gens: number, f: Factors): number[] {
  const out = [p0];
  for (let t = 0; t < gens; t++) out.push(stepDeterministic(out[t]!, f));
  return out;
}
/** Number of A alleles in a draw of 2N gametes: Binomial(2N, p) using one random number per gamete. */
function binomialDraw(trials: number, p: number, rng: () => number): number {
  let k = 0;
  for (let i = 0; i < trials; i++) if (rng() < p) k++;
  return k;
}
export interface DriftOptions { p0: number; N: number; gens: number; seed: number; factors?: Factors }
/** A finite population of N diploid individuals: each generation the forces act, then 2N alleles are sampled (genetic drift). Returns g + 1 values of p. */
export function simulateDrift(o: DriftOptions): number[] {
  const rng = mulberry32(o.seed);
  const f = o.factors ?? NO_FACTORS;
  const out = [o.p0];
  let p = o.p0;
  for (let t = 0; t < o.gens; t++) {
    const expected = stepDeterministic(p, f);
    p = binomialDraw(2 * o.N, expected, rng) / (2 * o.N);
    out.push(p);
  }
  return out;
}
/** Final allele frequency of `runs` independent populations. */
export function driftFinals(p0: number, N: number, gens: number, runs: number, seed: number, factors?: Factors): number[] {
  return Array.from({ length: runs }, (_, k) => simulateDrift({ p0, N, gens, seed: subSeed(seed, k), factors }).at(-1)!);
}
/** Average distance of the final frequency from the starting frequency. */
export const meanDrift = (p0: number, N: number, gens: number, runs: number, seed: number) =>
  driftFinals(p0, N, gens, runs, seed).reduce((s, p) => s + Math.abs(p - p0), 0) / runs;

// ---------------------------------------------------------------- predictions and practice questions

export interface GenPredict {
  id: string;
  title: string;
  /** Which bench the test shows. */
  tab: 'cross' | 'hw';
  prompt: string;
  options: string[];
  answer: number;
}
export const PREDICTS: GenPredict[] = [
  { id: 'g1', title: 'Dihybrid F2', tab: 'cross', prompt: 'Two plants heterozygous for seed shape and seed colour (RrYy x RrYy) are crossed. What is the phenotypic ratio of the offspring (F2)?', options: ['3 : 1', '9 : 3 : 3 : 1', '1 : 2 : 1', '1 : 1 : 1 : 1'], answer: 1 },
  { id: 'g2', title: 'Test cross', tab: 'cross', prompt: 'A heterozygous tall pea plant (Tt) is test-crossed with a dwarf plant (tt). What proportion of the offspring is tall?', options: ['1/4', '1/2', '3/4', 'All of them'], answer: 1 },
  { id: 'g3', title: 'Heterozygotes in a population', tab: 'hw', prompt: 'A large randomly mating population is in Hardy-Weinberg equilibrium and the frequency of allele A is p = 0.3. What is the frequency of heterozygotes (Aa)?', options: ['0.09', '0.21', '0.42', '0.49'], answer: 2 },
  { id: 'g4', title: 'Small population', tab: 'hw', prompt: 'Two populations start with p = 0.5 and nothing but chance acts on them: one has 10 individuals, the other 1000. After 50 generations, which allele frequency has usually wandered further from 0.5?', options: ['The population of 10', 'The population of 1000', 'Both the same', 'Neither: p stays 0.5 in both'], answer: 0 },
];

export interface GenMcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice questions written for this lab. Every key is recomputed by the tests (see APPLY_CHECK). Draft - unverified. */
export const APPLY: GenMcq[] = [
  {
    id: 'q1',
    q: 'A pea plant heterozygous for seed shape and colour (RrYy) is test-crossed with a plant that is wrinkled and green (rryy). Among 400 offspring, how many are expected to be round and green?',
    options: ['25', '100', '200', '300'],
    answer: 1,
    why: 'RrYy makes four kinds of gamete (RY, Ry, rY, ry) in equal numbers and rryy makes only ry. So the offspring are in the ratio 1 round yellow : 1 round green : 1 wrinkled yellow : 1 wrinkled green. Round green (Rryy) is 1/4 of 400 = 100.',
  },
  {
    id: 'q2',
    q: 'A man of blood group AB marries a woman of blood group O. Which blood groups are possible in their children?',
    options: ['A and B only', 'AB and O only', 'A, B, AB and O', 'O only'],
    answer: 0,
    why: 'The man is I^A I^B and the woman is ii. Each child gets I^A or I^B from the father and i from the mother, so the children are I^A i (group A) or I^B i (group B), 1 : 1. Groups AB and O cannot appear.',
  },
  {
    id: 'q3',
    q: 'A red-flowered snapdragon (RR) is crossed with a pink-flowered one (Rr), where Rr is intermediate. What is the phenotypic ratio of the offspring?',
    options: ['1 red : 1 pink', '1 red : 2 pink : 1 white', '3 red : 1 pink', 'All pink'],
    answer: 0,
    why: 'RR makes only R gametes and Rr makes R and r equally. The offspring are RR (red) and Rr (pink) in the ratio 1 : 1. There is no white, because white needs rr.',
  },
  {
    id: 'q4',
    q: 'In a population in Hardy-Weinberg equilibrium, 4 per cent of the individuals show the recessive trait. What per cent of the population are heterozygous carriers?',
    options: ['16%', '32%', '48%', '64%'],
    answer: 1,
    why: 'q² = 0.04, so q = 0.2 and p = 1 - 0.2 = 0.8. Carriers are 2pq = 2 x 0.8 x 0.2 = 0.32, that is 32 per cent. (The 16 per cent option is only p·q, the 64 per cent option is p².)',
  },
  {
    id: 'q5',
    q: 'In a bird species the female is ZW and the male is ZZ. In the cross ZW x ZZ, what fraction of the chicks is expected to be female, and which parent decides the sex of a chick?',
    options: ['1/2 female; the hen (the egg decides)', '1/2 female; the cock (the sperm decides)', 'All female; the hen', 'All male; the cock'],
    answer: 0,
    why: 'The hen makes two kinds of egg, Z and W; the cock makes only Z sperm. A Z egg gives a ZZ male and a W egg gives a ZW female, so half the chicks are female. The egg decides the sex, the opposite of humans where the sperm decides.',
  },
];

/** The correct option text of every practice question, computed from the genetics model rather than typed in. */
export const APPLY_CHECK: (() => string)[] = [
  () => {
    const sq = buildSquare('di', [P('R', 'r'), P('Y', 'y')], [P('r', 'r'), P('y', 'y')]);
    return String((sq.phenoCounts[sq.phenoLabels.indexOf('Round, Green')]! / sq.total) * 400);
  },
  () => {
    const sq = buildSquare('abo', [P('IA', 'IB')], [P('i', 'i')]);
    const set = sq.phenoLabels.filter((_, i) => sq.phenoCounts[i]! > 0).sort();
    return set.join(' and ') + ' only';
  },
  () => {
    const sq = buildSquare('incomplete', [P('R', 'R')], [P('R', 'r')]);
    return sq.phenoLabels.map((l, i) => [l, sq.phenoCounts[i]!] as const).filter((x) => x[1] > 0).map((x) => `${reduceRatio(sq.phenoCounts)[sq.phenoLabels.filter((_, i) => sq.phenoCounts[i]! > 0).indexOf(x[0])]} ${x[0].toLowerCase()}`).join(' : ');
  },
  () => {
    const q = Math.sqrt(0.04);
    return `${Math.round(hwFreqs(1 - q).Aa * 100)}%`;
  },
  () => {
    const sq = buildSquare('bird', [P('Z', 'W')], [P('Z', 'Z')]);
    const female = sq.phenoCounts[sq.phenoLabels.indexOf('Female')]! / sq.total;
    return female === 0.5 ? '1/2 female; the hen (the egg decides)' : 'other';
  },
];
