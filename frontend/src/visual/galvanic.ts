/**
 * Galvanic cell, Nernst equation and Faraday's laws for the Galvanic Cell and Electrolysis Lab
 * (Chemistry 306, Unit II Electrochemistry). Plain functions, no rendering: the page draws what these return
 * and the tests check them on their own.
 *
 * Conventions (the same as the lesson): standard reduction potentials at 298 K, 1 mol/L ions, gases at 1 bar;
 * E°cell = E°cathode − E°anode; Nernst: E = E° − (0.0592/n) log Q at 298 K; ΔG = −nFE; F = 96500 C/mol.
 * The standard potentials are the usual textbook (NCERT) values and are NOT measured by this lab.
 * Status: Draft - unverified (no subject-expert review yet).
 */
export const F = 96500; // C per mole of electrons (CUET / NCERT value)
export const SLOPE = 0.0592; // 2.303 RT / F at 298 K, in volts
export const R_LOAD = 10; // ohm: the lamp in the external circuit
export const R_INT = 1; // ohm: internal resistance of the cell, used only for the animation speed

export interface Half {
  id: string;
  name: string;
  /** Electrode material as written in cell notation. */
  el: string;
  /** The ion in solution. */
  ion: string;
  /** Electrons in the half-reaction as written (ν ions + ne e⁻ → electrode). */
  ne: number;
  /** Ions in the half-reaction as written. */
  nu: number;
  /** Standard reduction potential at 298 K, volts (textbook value). */
  E0: number;
  gas: boolean;
  /** Solution colour and electrode colour for the picture. */
  liquid: string;
  rod: string;
  reaction: string;
}

export const HALVES: Half[] = [
  { id: 'Mg', name: 'Magnesium', el: 'Mg', ion: 'Mg²⁺', ne: 2, nu: 1, E0: -2.36, gas: false, liquid: '#eaf1f6', rod: '#b9c0c8', reaction: 'Mg²⁺ + 2e⁻ → Mg' },
  { id: 'Al', name: 'Aluminium', el: 'Al', ion: 'Al³⁺', ne: 3, nu: 1, E0: -1.66, gas: false, liquid: '#eaf1f6', rod: '#cfd5db', reaction: 'Al³⁺ + 3e⁻ → Al' },
  { id: 'Zn', name: 'Zinc', el: 'Zn', ion: 'Zn²⁺', ne: 2, nu: 1, E0: -0.76, gas: false, liquid: '#eaf1f6', rod: '#9aa3ad', reaction: 'Zn²⁺ + 2e⁻ → Zn' },
  { id: 'Fe', name: 'Iron', el: 'Fe', ion: 'Fe²⁺', ne: 2, nu: 1, E0: -0.44, gas: false, liquid: '#dcefd9', rod: '#6b7380', reaction: 'Fe²⁺ + 2e⁻ → Fe' },
  { id: 'Ni', name: 'Nickel', el: 'Ni', ion: 'Ni²⁺', ne: 2, nu: 1, E0: -0.25, gas: false, liquid: '#d3ecd0', rod: '#8c969f', reaction: 'Ni²⁺ + 2e⁻ → Ni' },
  { id: 'Sn', name: 'Tin', el: 'Sn', ion: 'Sn²⁺', ne: 2, nu: 1, E0: -0.14, gas: false, liquid: '#eaf1f6', rod: '#aab2bb', reaction: 'Sn²⁺ + 2e⁻ → Sn' },
  { id: 'Pb', name: 'Lead', el: 'Pb', ion: 'Pb²⁺', ne: 2, nu: 1, E0: -0.13, gas: false, liquid: '#eaf1f6', rod: '#5c6470', reaction: 'Pb²⁺ + 2e⁻ → Pb' },
  { id: 'H', name: 'Hydrogen (Pt)', el: 'Pt', ion: 'H⁺', ne: 2, nu: 2, E0: 0.0, gas: true, liquid: '#f4eedb', rod: '#9a9fa6', reaction: '2H⁺ + 2e⁻ → H₂' },
  { id: 'Cu', name: 'Copper', el: 'Cu', ion: 'Cu²⁺', ne: 2, nu: 1, E0: 0.34, gas: false, liquid: '#bcd9f2', rod: '#c9773f', reaction: 'Cu²⁺ + 2e⁻ → Cu' },
  { id: 'Ag', name: 'Silver', el: 'Ag', ion: 'Ag⁺', ne: 1, nu: 1, E0: 0.8, gas: false, liquid: '#eef2f5', rod: '#c8ced6', reaction: 'Ag⁺ + e⁻ → Ag' },
];

export const half = (id: string): Half => HALVES.find((h) => h.id === id) ?? HALVES[0]!;

/** Concentration slider: the exponent p in c = 10^p mol/L. */
export const P_MIN = -3;
export const P_MAX = 0.5;
export const P_STEP = 0.1;
export const conc = (p: number) => Math.pow(10, p);
export const fmtC = (c: number) => String(+c.toPrecision(3));

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

export interface CellInput { left: string; right: string; pLeft: number; pRight: number }

export interface CellResult {
  /** The electrode that is the anode when the cell is built (lower E°) and the cathode. "Designed" orientation. */
  anode: Half;
  cathode: Half;
  anodeSide: 'left' | 'right';
  /** Concentrations (mol/L) of the anode and cathode ions. */
  cAnode: number;
  cCathode: number;
  n: number;
  E0: number;
  /** log10 Q and Q, written for the designed reaction (anode ion in the numerator). */
  logQ: number;
  Q: number;
  /** Signed cell potential for the designed orientation (negative: the reaction runs backwards). */
  E: number;
  /** True when E < 0: the polarity has reversed and the other electrode is now the anode. */
  reversed: boolean;
  /** The electrodes as they behave right now. */
  anodeNow: Half;
  cathodeNow: Half;
  anodeSideNow: 'left' | 'right';
  dG0: number; // kJ/mol of reaction
  dG: number;
  logK: number;
  K: number;
  /** Current through the 10 ohm lamp in amperes (magnitude). */
  I: number;
  notation: string;
  overall: string;
}

const sub = (h: Half, c: number) => `${h.ion}(${fmtC(c)} M)`;
function notationOf(a: Half, ca: number, c: Half, cc: number): string {
  const L = a.gas ? `Pt(s) | H₂(g, 1 bar) | ${sub(a, ca)}` : `${a.el}(s) | ${sub(a, ca)}`;
  const R = c.gas ? `${sub(c, cc)} | H₂(g, 1 bar) | Pt(s)` : `${sub(c, cc)} | ${c.el}(s)`;
  return `${L} ‖ ${R}`;
}
function overallOf(a: Half, c: Half, n: number): string {
  const ma = n / a.ne;
  const mc = n / c.ne;
  const k = (m: number) => (m === 1 ? '' : String(m));
  const ionA = (m: number) => `${k(m * a.nu)}${a.ion}`;
  const ionC = (m: number) => `${k(m * c.nu)}${c.ion}`;
  const left = `${a.gas ? `${k(ma)}H₂` : `${k(ma)}${a.el}`} + ${ionC(mc)}`;
  const right = `${ionA(ma)} + ${c.gas ? `${k(mc)}H₂` : `${k(mc)}${c.el}`}`;
  return `${left} → ${right}`;
}

/** Everything about a galvanic cell made from two different half-cells at the chosen concentrations (298 K). */
export function galvanic(input: CellInput): CellResult {
  const l = half(input.left);
  const r = half(input.right);
  const leftIsAnode = l.E0 < r.E0 || (l.E0 === r.E0 && l.id < r.id);
  const anode = leftIsAnode ? l : r;
  const cathode = leftIsAnode ? r : l;
  const cAnode = conc(leftIsAnode ? input.pLeft : input.pRight);
  const cCathode = conc(leftIsAnode ? input.pRight : input.pLeft);
  const n = lcm(anode.ne, cathode.ne);
  const E0 = cathode.E0 - anode.E0;
  // Q = [anode ion]^(ν·n/ne) / [cathode ion]^(ν·n/ne); the exponent is the ion's coefficient in the balanced equation
  const ea = (anode.nu * n) / anode.ne;
  const ec = (cathode.nu * n) / cathode.ne;
  const logQ = ea * Math.log10(cAnode) - ec * Math.log10(cCathode);
  const E = E0 - (SLOPE / n) * logQ;
  const reversed = E < 0;
  const logK = (n * E0) / SLOPE;
  const anodeSide = leftIsAnode ? 'left' : 'right';
  return {
    anode, cathode, anodeSide, cAnode, cCathode, n, E0, logQ, Q: Math.pow(10, logQ), E, reversed,
    anodeNow: reversed ? cathode : anode,
    cathodeNow: reversed ? anode : cathode,
    anodeSideNow: reversed ? (anodeSide === 'left' ? 'right' : 'left') : anodeSide,
    dG0: (-n * F * E0) / 1000,
    dG: (-n * F * E) / 1000,
    logK,
    K: Math.pow(10, logK),
    I: Math.abs(E) / (R_LOAD + R_INT),
    notation: reversed ? notationOf(cathode, cCathode, anode, cAnode) : notationOf(anode, cAnode, cathode, cCathode),
    overall: overallOf(anode, cathode, n),
  };
}


const other = (side: 'left' | 'right') => (side === 'left' ? 'right' : 'left');

/** Where the salt-bridge ions go: anions towards the anode compartment (it gains cations), cations towards the cathode compartment. */
export const saltBridge = (r: CellResult) => ({ anionsToward: r.anodeSideNow, cationsToward: other(r.anodeSideNow) });

/** Electrons leave the anode, run through the wire and enter the cathode. Returns the side they leave from. */
export const electronsLeaveFrom = (r: CellResult) => r.anodeSideNow;

// ------------------------------------------------------------------ the Measure and Analyse steps
export interface Reading { key: string; logQ: number; E: number; n: number; E0: number }

/** A voltmeter reads to the nearest millivolt. */
export const meter = (E: number) => Math.round(E * 1000) / 1000;
export const pairKey = (a: string, b: string) => [a, b].sort().join('+');

export function readingOf(input: CellInput): Reading {
  const r = galvanic(input);
  return { key: pairKey(input.left, input.right), logQ: Math.round(r.logQ * 1000) / 1000, E: meter(r.E), n: r.n, E0: r.E0 };
}

export interface Line { slope: number; intercept: number; r2: number }

/** Least-squares straight line y = intercept + slope x. Needs two different x values. */
export function fitLine(x: number[], y: number[]): Line | null {
  const m = x.length;
  if (m < 2 || y.length !== m) return null;
  const mx = x.reduce((a, b) => a + b, 0) / m;
  const my = y.reduce((a, b) => a + b, 0) / m;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < m; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); syy += (y[i]! - my) ** 2; }
  if (sxx < 1e-12) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy < 1e-15 ? 1 : (sxy * sxy) / (sxx * syy) };
}

/** The readings of the cell that has the most of them (ties: the most recent), as one set to fit. */
export function fitSet(rows: Reading[]): Reading[] {
  const by = new Map<string, Reading[]>();
  for (const r of rows) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  let best: Reading[] = [];
  for (const g of by.values()) if (g.length >= best.length) best = g;
  return best;
}
export const distinctRatios = (rows: Reading[]) => new Set(rows.map((r) => r.logQ.toFixed(3))).size;
export const canFit = (rows: Reading[]) => distinctRatios(fitSet(rows)) >= 3;

export interface Recovered { slope: number; intercept: number; r2: number; n: number; nRounded: number; E0: number }
/** Fit Ecell against log Q: slope = −0.0592/n and intercept = E°. */
export function recover(rows: Reading[]): Recovered | null {
  const set = fitSet(rows);
  const f = fitLine(set.map((r) => r.logQ), set.map((r) => r.E));
  if (!f || distinctRatios(set) < 2 || f.slope >= 0) return null;
  const n = -SLOPE / f.slope;
  return { ...f, n, nRounded: Math.round(n), E0: f.intercept };
}

// ------------------------------------------------------------------ electrolysis and Faraday's laws
export interface Electrolyte {
  id: 'cu' | 'ag' | 'water';
  name: string;
  /** What is deposited or liberated at the cathode (platinum electrodes). */
  product: string;
  M: number; // g/mol of the product
  ne: number; // electrons per formula unit of product at the cathode
  cathodeEq: string;
  anodeEq: string;
  liquid: string;
  cation: string;
  anion: string;
}
export const O2 = { M: 32, ne: 4 };
export const ELECTROLYTES: Electrolyte[] = [
  { id: 'cu', name: 'Copper(II) sulphate, CuSO₄(aq)', product: 'copper', M: 63.5, ne: 2, cathodeEq: 'Cu²⁺ + 2e⁻ → Cu', anodeEq: '2H₂O → O₂ + 4H⁺ + 4e⁻', liquid: '#bcd9f2', cation: 'Cu²⁺', anion: 'SO₄²⁻' },
  { id: 'ag', name: 'Silver nitrate, AgNO₃(aq)', product: 'silver', M: 108, ne: 1, cathodeEq: 'Ag⁺ + e⁻ → Ag', anodeEq: '2H₂O → O₂ + 4H⁺ + 4e⁻', liquid: '#eef2f5', cation: 'Ag⁺', anion: 'NO₃⁻' },
  { id: 'water', name: 'Acidified water, dilute H₂SO₄(aq)', product: 'hydrogen gas', M: 2, ne: 2, cathodeEq: '2H⁺ + 2e⁻ → H₂', anodeEq: '2H₂O → O₂ + 4H⁺ + 4e⁻', liquid: '#f4eedb', cation: 'H⁺', anion: 'SO₄²⁻' },
];
export const electrolyte = (id: string) => ELECTROLYTES.find((e) => e.id === id) ?? ELECTROLYTES[0]!;

export interface ElecInput { id: string; I: number; t: number }
export const ELEC_LIMITS = { I: { min: 0.5, max: 5, step: 0.5 }, t: { min: 60, max: 3600, step: 5 } };

export interface ElecResult {
  Q: number; // coulombs
  molE: number; // mol of electrons
  molCathode: number;
  /** Mass at the cathode (g): w = M I t / (n F). */
  mass: number;
  /** Oxygen at the anode (g). */
  massO2: number;
  /** Mass per coulomb, M/(nF) in g/C (the slope of the mass against charge graph). */
  perCoulomb: number;
}
export function electrolysis(input: ElecInput): ElecResult {
  const e = electrolyte(input.id);
  const Q = input.I * input.t;
  const perCoulomb = e.M / (e.ne * F);
  return { Q, molE: Q / F, molCathode: Q / (e.ne * F), mass: perCoulomb * Q, massO2: (O2.M * Q) / (O2.ne * F), perCoulomb };
}

/** Least-squares line m = k Q through the origin (the balance reads zero when no charge has passed). */
export function slopeThroughOrigin(Q: number[], m: number[]): number | null {
  let sxx = 0, sxy = 0;
  for (let i = 0; i < Q.length; i++) { sxx += Q[i]! * Q[i]!; sxy += Q[i]! * m[i]!; }
  return sxx > 0 ? sxy / sxx : null;
}
/** The number of electrons per product unit that a measured slope implies: n = M / (slope F). */
export const electronsFromSlope = (slope: number, M: number) => M / (slope * F);

// ------------------------------------------------------------------ the bench state and the teaching data
export interface Setup { mode: 'cell' | 'elec'; cell: CellInput; elec: ElecInput }
export const START: Setup = { mode: 'cell', cell: { left: 'Zn', right: 'Cu', pLeft: 0, pRight: 0 }, elec: { id: 'cu', I: 2, t: 965 } };

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
const cellSetup = (o: Partial<CellInput>): Setup => ({ ...START, mode: 'cell', cell: { ...START.cell, ...o } });
const elecSetup = (o: Partial<ElecInput>): Setup => ({ ...START, mode: 'elec', elec: { ...START.elec, ...o } });
const v3 = (x: number) => (Math.abs(x) < 0.0005 ? '0.000' : x.toFixed(3));
const v2 = (x: number) => x.toFixed(2);

export const PREDICTS: Predict[] = [
  {
    id: 'g1',
    title: 'Which is the anode?',
    prompt: 'A zinc half-cell and a silver half-cell (both 1 M) are joined by a salt bridge. Which electrode is the anode?',
    base: cellSetup({ left: 'Zn', right: 'Ag', pLeft: 0, pRight: 0 }),
    test: cellSetup({ left: 'Zn', right: 'Ag', pLeft: 0, pRight: 0 }),
    options: [
      'Zinc: it is oxidised, because its E° (−0.76 V) is the lower one',
      'Silver: it has the larger E°, so it loses electrons',
      'It depends on which beaker is placed on the left',
      'Neither: a cell has no anode until current flows',
    ],
    answer: 0,
    why: ({ test }) => { const r = galvanic(test.cell); return `Oxidation happens at the anode, and the metal with the lower reduction potential is the one that is oxidised. Zn (−0.76 V) is oxidised and Ag⁺ (+0.80 V) is reduced, so E°cell = 0.80 − (−0.76) = ${v2(r.E0)} V. Zinc is the anode (negative), silver the cathode (positive), and electrons flow from Zn to Ag through the wire. Which beaker is on the left makes no difference to the chemistry.`; },
  },
  {
    id: 'g2',
    title: 'Raise [Cu²⁺]',
    prompt: 'In the Daniell cell [Zn²⁺] = 1.0 M and [Cu²⁺] = 0.1 M. Now [Cu²⁺] is raised to 1.0 M. What happens to Ecell?',
    base: cellSetup({ left: 'Zn', right: 'Cu', pLeft: 0, pRight: -1 }),
    test: cellSetup({ left: 'Zn', right: 'Cu', pLeft: 0, pRight: 0 }),
    options: ['Ecell falls by about 0.03 V', 'Ecell does not change: only E° matters', 'Ecell rises by about 0.03 V', 'Ecell rises by about 0.30 V'],
    answer: 2,
    why: ({ base, test }) => `Cu²⁺ is a reactant, so more of it pushes the reaction forward and Q = [Zn²⁺]/[Cu²⁺] gets smaller. At 0.1 M, log Q = ${galvanic(base.cell).logQ.toFixed(0)} and E = 1.10 − (0.0592/2)(1) = ${v3(galvanic(base.cell).E)} V. At 1.0 M, log Q = 0 and E = E° = ${v3(galvanic(test.cell).E)} V: a rise of ${v3(galvanic(test.cell).E - galvanic(base.cell).E)} V, which is 0.0592/2 per tenfold change.`,
  },
  {
    id: 'g3',
    title: 'Ecell reaches zero',
    prompt: 'A tin | lead cell has E°cell of only 0.01 V. Keeping [Pb²⁺] at 1 M, the Sn²⁺ concentration is raised until the voltmeter reads about zero. What does that mean for the cell?',
    base: cellSetup({ left: 'Sn', right: 'Pb', pLeft: 0, pRight: 0 }),
    test: cellSetup({ left: 'Sn', right: 'Pb', pLeft: 0.3, pRight: 0 }),
    options: ['It is fully charged and can give its maximum current', 'It has reached equilibrium: Q = K, ΔG = 0 and no net current flows', 'Both electrodes have dissolved completely', 'It is still working, but the electrodes have swapped roles'],
    answer: 1,
    why: ({ base, test }) => { const b = galvanic(base.cell); const t = galvanic(test.cell); return `Ecell = 0 means ΔG = −nFE = 0: the reaction has no tendency to go either way, so Q = K and no net current flows (a "dead" battery). Here E° = ${v2(b.E0)} V and n = 2, so K = 10^(nE°/0.0592) = 10^${b.logK.toFixed(2)} = ${b.K.toFixed(1)}. At [Sn²⁺] = ${fmtC(t.cAnode)} M, Q = ${t.Q.toFixed(2)} and the voltmeter reads ${(t.E * 1000).toFixed(1)} mV, almost at equilibrium. Raise [Sn²⁺] further and the voltage turns negative: the reaction would run the other way. The Daniell cell only gets there at Q = 10^${galvanic(START.cell).logK.toFixed(0)}.`; },
  },
  {
    id: 'g4',
    title: 'Double the current',
    prompt: 'Copper is deposited from CuSO₄ solution by 1 A for 1930 s. The same experiment is repeated with 2 A for the same 1930 s. How does the mass of copper deposited change?',
    base: elecSetup({ id: 'cu', I: 1, t: 1930 }),
    test: elecSetup({ id: 'cu', I: 2, t: 1930 }),
    options: ['It stays the same: the time is the same', 'It becomes four times as large', 'It doubles', 'It halves'],
    answer: 2,
    why: ({ base, test }) => `Faraday's first law: mass is proportional to the charge Q = I t. At 1 A the charge is ${electrolysis(base.elec).Q.toFixed(0)} C and w = M Q/(nF) = 63.5 × ${electrolysis(base.elec).Q.toFixed(0)}/(2 × 96500) = ${electrolysis(base.elec).mass.toFixed(3)} g. At 2 A the charge is ${electrolysis(test.elec).Q.toFixed(0)} C and the mass is ${electrolysis(test.elec).mass.toFixed(3)} g: exactly double.`,
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'ga1',
    q: 'For the cell Zn | Zn²⁺ ‖ Ag⁺ | Ag, E°(Zn²⁺/Zn) = −0.76 V and E°(Ag⁺/Ag) = +0.80 V. The standard cell potential E°cell is',
    options: ['0.04 V', '1.56 V', '−1.56 V', '0.84 V'],
    answer: 1,
    why: 'Silver is reduced (cathode) and zinc is oxidised (anode): E°cell = E°cathode − E°anode = 0.80 − (−0.76) = 1.56 V. The value 0.04 V adds the potentials instead of subtracting.',
  },
  {
    id: 'ga2',
    q: 'At 298 K, Ni | Ni²⁺(0.1 M) ‖ Ag⁺(0.01 M) | Ag has E°cell = 1.05 V. Using E = E° − (0.0592/n) log Q, Ecell is about',
    options: ['0.96 V', '1.05 V', '1.14 V', '0.87 V'],
    answer: 0,
    why: 'The reaction is Ni + 2Ag⁺ → Ni²⁺ + 2Ag, so n = 2 and Q = [Ni²⁺]/[Ag⁺]² = 0.1/(0.01)² = 1000, log Q = 3. E = 1.05 − (0.0592/2)(3) = 0.96 V. Using n = 1 would give 0.87 V.',
  },
  {
    id: 'ga3',
    q: 'For Fe | Fe²⁺ ‖ Cu²⁺ | Cu, E°(Fe²⁺/Fe) = −0.44 V and E°(Cu²⁺/Cu) = +0.34 V. The standard Gibbs energy change of the cell reaction, ΔG° (F = 96500 C mol⁻¹), is',
    options: ['+150.5 kJ mol⁻¹', '−75.3 kJ mol⁻¹', '−150.5 kJ mol⁻¹', '−301.1 kJ mol⁻¹'],
    answer: 2,
    why: 'E°cell = 0.34 − (−0.44) = 0.78 V and n = 2. ΔG° = −nFE° = −2 × 96500 × 0.78 = −150 540 J = −150.5 kJ mol⁻¹. The sign is negative because E° is positive (the reaction is spontaneous).',
  },
  {
    id: 'ga4',
    q: 'The same current is passed in series through CuSO₄ and AgNO₃ solutions (platinum electrodes) and 1.08 g of silver is deposited. The mass of copper deposited is (Cu = 63.5, Ag = 108 g mol⁻¹)',
    options: ['0.64 g', '1.08 g', '0.16 g', '0.32 g'],
    answer: 3,
    why: '1.08 g of Ag is 0.01 mol, so 0.01 mol of electrons passed (Ag⁺ + e⁻ → Ag). Cu²⁺ + 2e⁻ → Cu needs 2 mol of electrons per mole, so 0.005 mol of Cu is deposited: 0.005 × 63.5 = 0.3175 g, about 0.32 g (Faraday’s second law).',
  },
  {
    id: 'ga5',
    q: 'In the standard cell Mg | Mg²⁺ ‖ Cu²⁺ | Cu, which statement is correct?',
    options: [
      'Electrons flow from Cu to Mg in the wire, and anions in the salt bridge move towards the Cu half-cell',
      'Electrons flow from Mg to Cu in the wire, and anions in the salt bridge move towards the Mg half-cell',
      'Electrons flow from Mg to Cu in the wire, and anions in the salt bridge move towards the Cu half-cell',
      'Mg is the cathode because its reduction potential is more negative',
    ],
    answer: 1,
    why: 'Mg (−2.36 V) is oxidised, so it is the anode and electrons leave it for the Cu cathode. Mg²⁺ ions build up in the anode compartment, so anions from the salt bridge move into it (and cations move into the Cu compartment) to keep both solutions neutral.',
  },
];
