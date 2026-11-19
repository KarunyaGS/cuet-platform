/**
 * Circuit physics for the Circuit Bench lab (Physics 322, Unit 2: cells, Ohm's law, internal resistance, Kirchhoff's rules and the
 * Wheatstone bridge). Plain functions, no rendering: the page only draws what these return, and the tests check them on their own.
 *
 * One general solver (modified nodal analysis) serves all three experiments, so the numbers a student reads from a meter are the
 * same ones the closed-form textbook formulas give; the tests check both against each other.
 * Status: Draft - unverified (no subject-expert review yet).
 */

// ------------------------------------------------------------------ solver
/** A resistor between nodes a and b (value in ohm), or an ideal cell with its + terminal at a and − terminal at b (value in volt). */
export interface Element { kind: 'R' | 'V'; a: number; b: number; value: number }
export interface Solution {
  /** node voltages in volt, node 0 is the 0 V reference */
  v: number[];
  /** R: current from a to b. V: current the cell delivers out of its + terminal into the circuit. */
  i: number[];
}

/** Modified nodal analysis with Gaussian elimination and partial pivoting. Node 0 is ground. */
export function solve(nNodes: number, els: Element[]): Solution {
  const vs = els.map((e, k) => ({ e, k })).filter((x) => x.e.kind === 'V');
  const n = nNodes - 1 + vs.length;
  const A: number[][] = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  const row = (node: number) => node - 1;
  for (const e of els) {
    if (e.kind !== 'R') continue;
    const g = 1 / e.value;
    if (e.a > 0) A[row(e.a)]![row(e.a)]! += g;
    if (e.b > 0) A[row(e.b)]![row(e.b)]! += g;
    if (e.a > 0 && e.b > 0) {
      A[row(e.a)]![row(e.b)]! -= g;
      A[row(e.b)]![row(e.a)]! -= g;
    }
  }
  vs.forEach((s, j) => {
    const c = nNodes - 1 + j; // extra unknown: current through the cell from + to − inside the cell
    if (s.e.a > 0) { A[row(s.e.a)]![c]! += 1; A[c]![row(s.e.a)]! += 1; }
    if (s.e.b > 0) { A[row(s.e.b)]![c]! -= 1; A[c]![row(s.e.b)]! -= 1; }
    A[c]![n] = s.e.value;
  });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    [A[c], A[p]] = [A[p]!, A[c]!];
    const d = A[c]![c]!;
    for (let r = c + 1; r < n; r++) {
      const f = A[r]![c]! / d;
      if (f !== 0) for (let k = c; k <= n; k++) A[r]![k]! -= f * A[c]![k]!;
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = A[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= A[r]![k]! * x[k];
    x[r] = s / A[r]![r]!;
  }
  const v = [0, ...x.slice(0, nNodes - 1)];
  const i = els.map((e) => (e.kind === 'R' ? (v[e.a]! - v[e.b]!) / e.value : 0));
  vs.forEach((s, j) => { i[s.k] = -x[nNodes - 1 + j]; });
  return { v, i };
}

// ------------------------------------------------------------------ experiment 1: a cell and resistors
export type Arrangement = 'single' | 'series' | 'parallel';
export interface CellState { emf: number; r: number; R1: number; R2: number; mode: Arrangement }
export const CELL_START: CellState = { emf: 6, r: 1, R1: 5, R2: 5, mode: 'single' };
export const CELL_LIMITS = { emf: { min: 1, max: 12, step: 0.5 }, r: { min: 0, max: 5, step: 0.5 }, R: { min: 1, max: 50, step: 1 } };

export interface CellResult {
  /** current delivered by the cell */
  I: number;
  /** terminal voltage V = ε − I r */
  Vt: number;
  /** equivalent resistance of the external circuit */
  Rext: number;
  I1: number;
  I2: number;
  V1: number;
  V2: number;
  /** powers in watt */
  Pext: number;
  Pint: number;
  Pcell: number;
  /** efficiency, external power over total power */
  eff: number;
  /** node voltages: 0 = cell −, 1 = inside the cell, 2 = cell +, 3 = joint between series resistors */
  nodes: number[];
}

export const externalResistance = (s: CellState) => (s.mode === 'single' ? s.R1 : s.mode === 'series' ? s.R1 + s.R2 : (s.R1 * s.R2) / (s.R1 + s.R2));

export function cellCircuit(s: CellState): CellResult {
  const els: Element[] = [
    { kind: 'V', a: 1, b: 0, value: s.emf },
    // no internal resistance: a 0 V link keeps the algebra exact (no tiny-resistor round-off)
    s.r > 0 ? { kind: 'R', a: 1, b: 2, value: s.r } : { kind: 'V', a: 1, b: 2, value: 0 },
  ];
  if (s.mode === 'single') els.push({ kind: 'R', a: 2, b: 0, value: s.R1 });
  else if (s.mode === 'series') els.push({ kind: 'R', a: 2, b: 3, value: s.R1 }, { kind: 'R', a: 3, b: 0, value: s.R2 });
  else els.push({ kind: 'R', a: 2, b: 0, value: s.R1 }, { kind: 'R', a: 2, b: 0, value: s.R2 });
  const sol = solve(s.mode === 'series' ? 4 : 3, els);
  const I = sol.i[0]!;
  const Vt = sol.v[2]! - sol.v[0]!;
  const ia = sol.i[2]!;
  const ib = s.mode === 'single' ? 0 : sol.i[3]!;
  const V1 = s.mode === 'series' ? ia * s.R1 : ia * s.R1;
  const V2 = s.mode === 'single' ? 0 : ib * s.R2;
  const Pext = I * Vt;
  const Pint = I * I * s.r;
  return { I, Vt, Rext: externalResistance(s), I1: ia, I2: ib, V1, V2, Pext, Pint, Pcell: s.emf * I, eff: s.emf * I === 0 ? 0 : Pext / (s.emf * I), nodes: [sol.v[0]!, sol.v[1]!, sol.v[2]!, sol.v[3] ?? 0] };
}

/** Least-squares line y = a + b x. Returns null for fewer than two distinct x values. */
export function fitLine(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((t, x) => t + x, 0) / n;
  const my = ys.reduce((t, y) => t + y, 0) / n;
  const sxx = xs.reduce((t, x) => t + (x - mx) ** 2, 0);
  if (sxx < 1e-12) return null;
  const b = xs.reduce((t, x, k) => t + (x - mx) * (ys[k]! - my), 0) / sxx;
  return { a: my - b * mx, b };
}

/** External resistance that draws the most power from a cell: R = r. */
export const maxPowerResistance = (r: number) => r;
export const maxPower = (emf: number, r: number) => (emf * emf) / (4 * r);

export interface Reading { R: number; I: number; V: number }

/** Ohm's-law meter model shared with Virtual Practical Assessment: meter resolution is 0.01 A. */
export function ohmsLawReading(voltage: number, resistance: number): { voltage: number; current: number; resistance: number } {
  if (!Number.isFinite(voltage) || !Number.isFinite(resistance) || voltage < 0 || resistance <= 0) throw new RangeError('Voltage must be non-negative and resistance must be positive');
  return { voltage, current: Math.round((voltage / resistance) * 100) / 100, resistance };
}

// ------------------------------------------------------------------ experiment 2: Kirchhoff's rules (two cells, three branches)
export interface KirchState { e1: number; e2: number; R1: number; R2: number; R3: number }
export const KIRCH_START: KirchState = { e1: 10, e2: 4, R1: 4, R2: 6, R3: 3 };
export const KIRCH_LIMITS = { e: { min: -12, max: 12, step: 0.5 }, R: { min: 1, max: 20, step: 1 } };
export interface KirchResult {
  /** branch currents in ampere: I1 up through cell 1 and R1, I3 up through cell 2 and R3, I2 down through R2 */
  I1: number;
  I2: number;
  I3: number;
  /** potential of the top junction A above the bottom junction B */
  VAB: number;
  /** sum of currents entering junction A minus leaving: zero by the junction rule */
  junction: number;
  /** left and right loop sums of potential changes: zero by the loop rule */
  loopLeft: number;
  loopRight: number;
  /** node voltages: 0 = B, 1 = A, 2 = + of cell 1, 3 = + of cell 2 */
  nodes: number[];
}
export function kirchhoff(s: KirchState): KirchResult {
  const sol = solve(4, [
    { kind: 'V', a: 2, b: 0, value: s.e1 },
    { kind: 'R', a: 2, b: 1, value: s.R1 },
    { kind: 'R', a: 1, b: 0, value: s.R2 },
    { kind: 'V', a: 3, b: 0, value: s.e2 },
    { kind: 'R', a: 3, b: 1, value: s.R3 },
  ]);
  const I1 = sol.i[1]!, I2 = sol.i[2]!, I3 = sol.i[4]!;
  return { I1, I2, I3, VAB: sol.v[1]!, junction: I1 + I3 - I2, loopLeft: s.e1 - I1 * s.R1 - I2 * s.R2, loopRight: s.e2 - I3 * s.R3 - I2 * s.R2, nodes: sol.v };
}
/** Closed form for the same circuit (Millman): V_AB = (ε₁/R₁ + ε₂/R₃) / (1/R₁ + 1/R₂ + 1/R₃). */
export const millman = (s: KirchState) => (s.e1 / s.R1 + s.e2 / s.R3) / (1 / s.R1 + 1 / s.R2 + 1 / s.R3);

// ------------------------------------------------------------------ experiment 3: the Wheatstone bridge
export interface WheatState { emf: number; P: number; Q: number; R: number; S: number; Rg: number }
export const WHEAT_START: WheatState = { emf: 6, P: 100, Q: 100, R: 200, S: 250, Rg: 50 };
export const WHEAT_LIMITS = { R: { min: 10, max: 1000, step: 10 }, ratio: { min: 10, max: 1000, step: 10 } };
export interface WheatResult {
  /** galvanometer current in ampere, from B to D */
  Ig: number;
  balanced: boolean;
  /** battery current */
  Ib: number;
  /** arm currents: P (A to B), Q (B to C), R (A to D), S (D to C) */
  IP: number;
  IQ: number;
  IR: number;
  IS: number;
  /** node voltages: 0 = C, 1 = A, 2 = B, 3 = D */
  nodes: number[];
}
export function wheatstone(s: WheatState): WheatResult {
  const sol = solve(4, [
    { kind: 'V', a: 1, b: 0, value: s.emf },
    { kind: 'R', a: 1, b: 2, value: s.P },
    { kind: 'R', a: 2, b: 0, value: s.Q },
    { kind: 'R', a: 1, b: 3, value: s.R },
    { kind: 'R', a: 3, b: 0, value: s.S },
    { kind: 'R', a: 2, b: 3, value: s.Rg },
  ]);
  const Ig = sol.i[5]!;
  return { Ig, balanced: Math.abs(s.P * s.S - s.Q * s.R) < 1e-9 * Math.max(1, s.P * s.S), Ib: sol.i[0]!, IP: sol.i[1]!, IQ: sol.i[2]!, IR: sol.i[3]!, IS: sol.i[4]!, nodes: sol.v };
}
/** The value of R that balances the bridge: P/Q = R/S, so R = S P / Q. */
export const balanceR = (s: WheatState) => (s.S * s.P) / s.Q;
/** The unknown S found from a balance: S = R Q / P. */
export const unknownFromBalance = (R: number, P: number, Q: number) => (R * Q) / P;

// ------------------------------------------------------------------ the bench state and the teaching data
export type Exp = 'cell' | 'kirch' | 'wheat';
export interface Setup { exp: Exp; cell: CellState; kirch: KirchState; wheat: WheatState }
export const START: Setup = { exp: 'cell', cell: CELL_START, kirch: KIRCH_START, wheat: WHEAT_START };

export interface Predict {
  id: string;
  title: string;
  prompt: string;
  base: Setup;
  test: Setup;
  options: string[];
  answer: number;
  why: (b: { base: Setup; test: Setup }) => string;
}
const f2 = (x: number) => x.toFixed(2);
const cell = (o: Partial<CellState>): Setup => ({ ...START, exp: 'cell', cell: { ...CELL_START, ...o } });

export const PREDICTS: Predict[] = [
  {
    id: 'c1',
    title: 'More external resistance',
    prompt: 'A 6 V cell with internal resistance 2 Ω drives a 2 Ω resistor. Change the external resistor to 8 Ω. What happens to the voltage across the cell’s terminals?',
    base: cell({ emf: 6, r: 2, R1: 2 }),
    test: cell({ emf: 6, r: 2, R1: 8 }),
    options: ['It falls', 'It rises, closer to the emf', 'It stays the same', 'It becomes zero'],
    answer: 1,
    why: ({ base, test }) => `The terminal voltage is V = ε − I r. With 2 Ω outside the current is ${f2(cellCircuit(base.cell).I)} A and V = ${f2(cellCircuit(base.cell).Vt)} V. With 8 Ω outside the current drops to ${f2(cellCircuit(test.cell).I)} A, less voltage is lost inside the cell, and V rises to ${f2(cellCircuit(test.cell).Vt)} V.`,
  },
  {
    id: 'c2',
    title: 'A second resistor in parallel',
    prompt: 'An ideal 6 V cell (no internal resistance) drives one 6 Ω resistor. Add an identical 6 Ω resistor in parallel. What happens to the current drawn from the cell?',
    base: cell({ emf: 6, r: 0, R1: 6, R2: 6, mode: 'single' }),
    test: cell({ emf: 6, r: 0, R1: 6, R2: 6, mode: 'parallel' }),
    options: ['It halves', 'It stays the same', 'It doubles', 'It becomes four times as large'],
    answer: 2,
    why: ({ base, test }) => `Two equal resistors in parallel have half the resistance of one (6 Ω and 6 Ω give 3 Ω), and the cell’s voltage is the same, so the current is I = V/R: from ${f2(cellCircuit(base.cell).I)} A to ${f2(cellCircuit(test.cell).I)} A. Each resistor still carries ${f2(cellCircuit(test.cell).I1)} A: the extra path adds to the current instead of sharing it.`,
  },
  {
    id: 'k1',
    title: 'Kirchhoff: a branch with no current',
    prompt: 'Two cells (12 V and 6 V) feed a junction through three equal 6 Ω resistors. How much current flows in the branch with the 6 V cell?',
    base: { ...START, exp: 'kirch', kirch: { e1: 12, e2: 6, R1: 6, R2: 6, R3: 6 } },
    test: { ...START, exp: 'kirch', kirch: { e1: 12, e2: 6, R1: 6, R2: 6, R3: 6 } },
    options: ['0.5 A', '2 A', '1 A', '0 A'],
    answer: 3,
    why: ({ test }) => { const r = kirchhoff(test.kirch); return `The loop rule gives V_AB = ${f2(r.VAB)} V at the junction. The 6 V cell exactly matches it, so there is no voltage across its resistor: I₃ = ${f2(r.I3)} A. The junction rule still holds: I₁ + I₃ = I₂ = ${f2(r.I2)} A, all of it coming from the 12 V cell.`; },
  },
  {
    id: 'w1',
    title: 'Balance the bridge',
    prompt: 'In a Wheatstone bridge P = Q = 100 Ω and the unknown resistor S = 250 Ω. Which value of R makes the galvanometer read zero?',
    base: { ...START, exp: 'wheat', wheat: { ...WHEAT_START, P: 100, Q: 100, R: 100, S: 250 } },
    test: { ...START, exp: 'wheat', wheat: { ...WHEAT_START, P: 100, Q: 100, R: 250, S: 250 } },
    options: ['100 Ω', '125 Ω', '250 Ω', '25 000 Ω'],
    answer: 2,
    why: ({ base, test }) => `The bridge balances when P/Q = R/S. With P = Q the ratio is 1, so R must equal S = 250 Ω. At R = 100 Ω the galvanometer carries ${(wheatstone(base.wheat).Ig * 1e3).toFixed(2)} mA; at R = 250 Ω it carries ${(Math.abs(wheatstone(test.wheat).Ig) * 1e3).toFixed(2)} mA.`,
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'ca1',
    q: 'A cell of emf 10 V and internal resistance 1 Ω is connected to a 4 Ω resistor. The current in the circuit is',
    options: ['2.5 A', '2 A', '2.5 V', '10 A'],
    answer: 1,
    why: 'I = ε/(R + r) = 10/(4 + 1) = 2 A. The 2.5 A option divides by R alone and forgets the internal resistance.',
  },
  {
    id: 'ca2',
    q: 'A cell of emf 6 V and internal resistance 2 Ω delivers a current of 1 A. The potential difference across its terminals is',
    options: ['6 V', '8 V', '2 V', '4 V'],
    answer: 3,
    why: 'V = ε − I r = 6 − (1)(2) = 4 V. The terminal voltage is lower than the emf while the cell delivers current.',
  },
  {
    id: 'ca3',
    q: 'In a balanced Wheatstone bridge P = 10 Ω, Q = 20 Ω and R = 30 Ω. The unknown resistance S is',
    options: ['60 Ω', '15 Ω', '5 Ω', '20 Ω'],
    answer: 0,
    why: 'At balance P/Q = R/S, so S = R Q/P = (30 × 20)/10 = 60 Ω.',
  },
  {
    id: 'ca4',
    q: 'A cell of emf 12 V has an internal resistance of 3 Ω. The external resistance for which it delivers the maximum power to the external circuit is',
    options: ['6 Ω', '1.5 Ω', '3 Ω', '4 Ω'],
    answer: 2,
    why: 'The power in the external resistor is largest when R = r. Here that is 3 Ω, and the maximum power is ε²/(4r) = 144/12 = 12 W.',
  },
  {
    id: 'ca5',
    q: 'Currents of 3 A and 5 A flow into a junction, and 2 A flows out along one wire. The current in the only other wire at the junction is',
    options: ['10 A into the junction', '6 A out of the junction', '6 A into the junction', '0 A'],
    answer: 1,
    why: 'Kirchhoff’s junction rule: the sum of currents entering equals the sum leaving. 3 + 5 = 8 A enters and 2 A leaves, so the remaining 6 A must leave the junction.',
  },
];
