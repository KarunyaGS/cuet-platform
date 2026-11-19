/**
 * Chapter lab: Chemistry, Unit I "Solutions: concentration, Raoult's law and colligative properties".
 * Model: dT_b = i Kb m, dT_f = i Kf m, pi = i C R T (C ~ m for a dilute aqueous solution), relative lowering ~ x(solute),
 * i = 1 + alpha (n - 1). Kb, Kf and R are the textbook values quoted in the lesson. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { clamp, near, rnd } from './chem2-kit';

const KB = [0.52, 2.53]; // K kg/mol: water, benzene
const KF = [1.86, 5.12];
const M1 = [18, 78]; // g/mol of the solvent
const R = 0.083; // L bar / (K mol)
const iOf = (n: number, a: number) => 1 + a * (n - 1);
const dTb = (m: number, i: number, s: number) => i * KB[s]! * m;
const dTf = (m: number, i: number, s: number) => i * KF[s]! * m;
const piBar = (m: number, i: number, T: number) => i * m * R * T;
const relLow = (m: number, i: number, s: number) => (i * m) / (i * m + 1000 / M1[s]!);

export const spec: Spec = {
  id: 'chem-solutions',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Solutions: concentration',
  afterHeading: "Abnormal molar masses and the van't Hoff factor",
  title: 'Colligative Properties Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: "Dissolve a solute in water or benzene, choose how many ions it gives and how far it dissociates, and watch the boiling point elevation, freezing point depression, osmotic pressure and vapour pressure lowering respond to the number of particles.",
  can: ['See that the colligative effects depend on particles, not on what they are', "Raise the van't Hoff factor by dissociation and watch every effect rise together", 'Plot ΔTb against molality and recover Kb from your own readings'],
  minutes: 10,
  vars: [
    { id: 'm', label: 'Molality m', unit: 'mol/kg', min: 0.05, max: 2, step: 0.05, start: 0.5, digits: 2 },
    { id: 'n', label: 'Ions per formula unit n', unit: '', min: 1, max: 3, step: 1, start: 2, digits: 0 },
    { id: 'a', label: 'Degree of dissociation α', unit: '', min: 0, max: 1, step: 0.05, start: 1, digits: 2 },
    { id: 's', label: 'Solvent (0 = water, 1 = benzene)', unit: '', min: 0, max: 1, step: 1, start: 0, digits: 0 },
    { id: 'T', label: 'Temperature T', unit: 'K', min: 273, max: 323, step: 5, start: 298, digits: 0 },
  ],
  outs: [
    { id: 'i', label: "van't Hoff factor i = 1 + α(n − 1)", unit: '', fn: (v) => iOf(v.n!, v.a!), digits: 2 },
    { id: 'dTb', label: 'Boiling point elevation ΔTb = i Kb m', unit: 'K', fn: (v) => dTb(v.m!, iOf(v.n!, v.a!), v.s!), digits: 3 },
    { id: 'dTf', label: 'Freezing point depression ΔTf = i Kf m', unit: 'K', fn: (v) => dTf(v.m!, iOf(v.n!, v.a!), v.s!), digits: 3 },
    { id: 'pi', label: 'Osmotic pressure π = iCRT (water, C ≈ m)', unit: 'bar', fn: (v) => piBar(v.m!, iOf(v.n!, v.a!), v.T!), digits: 2 },
    { id: 'rl', label: 'Relative lowering Δp/p° ≈ x(solute)', unit: '', fn: (v) => relLow(v.m!, iOf(v.n!, v.a!), v.s!), digits: 4 },
  ],
  graphs: [
    { id: 'tb-m', title: 'Boiling point elevation against molality', x: 'm', y: 'dTb' },
    { id: 'pi-a', title: 'Osmotic pressure against degree of dissociation', x: 'a', y: 'pi' },
    { id: 'tf-n', title: 'Freezing point depression against ions per formula unit', x: 'n', y: 'dTf' },
  ],
  sceneAlt: 'A beaker of solution. The number of grey molecules and small coloured ions follows the molality, the dissociation and the number of ions, and three bars on the right show the boiling point rise, the freezing point fall and the osmotic pressure.',
  scene: ({ v, o }) => {
    const rand = rnd(7);
    const units = Math.round(v.m! * 9);
    const whole = Math.round(units * (1 - v.a!));
    const split = units - whole;
    const dots: { x: number; y: number; r: number; c: string }[] = [];
    const pos = () => ({ x: 40 + rand() * 110, y: 80 + rand() * 105 });
    for (let k = 0; k < whole; k++) dots.push({ ...pos(), r: 5, c: '#7c8595' });
    for (let k = 0; k < split; k++) {
      const p = pos();
      for (let j = 0; j < v.n!; j++) dots.push({ x: clamp(p.x + (j - 1) * 7, 36, 154), y: clamp(p.y + (j % 2) * 6, 76, 190), r: 3.2, c: j % 2 ? '#2563a8' : '#c45e42' });
    }
    const bar = (x: number, f: number, label: string, col: string, val: string) => (
      <g key={label}>
        <rect x={x} y={40} width={26} height={140} fill="#fff" stroke="#e5e5e5" />
        <rect x={x} y={180 - 140 * clamp(f, 0.01, 1)} width={26} height={140 * clamp(f, 0.01, 1)} fill={col} opacity={0.85} />
        <text x={x + 13} y={196} fontSize={10} textAnchor="middle" fill="#4d5768">{label}</text>
        <text x={x + 13} y={34} fontSize={9} textAnchor="middle" fill="#18443b">{val}</text>
      </g>
    );
    return (
      <g>
        <path d="M 28 60 V 200 Q 28 208 36 208 H 154 Q 162 208 162 200 V 60" fill="none" stroke="#18443b" strokeWidth={2.5} />
        <rect x={30} y={72} width={130} height={134} fill={v.s! ? '#f0d9b0' : '#cfe3f3'} opacity={0.6} />
        {dots.map((d, k) => <circle key={k} cx={d.x} cy={d.y} r={d.r} fill={d.c} />)}
        <text x={95} y={226} fontSize={11} textAnchor="middle" fill="#4d5768">{v.s! ? 'benzene' : 'water'} · {dots.length} particles drawn</text>
        {bar(215, o.dTb! / 15.3, 'ΔTb', '#c45e42', `${fmt(o.dTb!, 2)} K`)}
        {bar(265, o.dTf! / 30.8, 'ΔTf', '#2563a8', `${fmt(o.dTf!, 2)} K`)}
        {bar(315, o.pi! / 165, 'π', '#18443b', `${fmt(o.pi!, 1)} bar`)}
        <text x={290} y={14} fontSize={11} textAnchor="middle" fill="#4d5768">i = {fmt(o.i!, 2)}</text>
      </g>
    );
  },
  discover: [
    'Drag the molality and watch the number of particles in the beaker and the three bars.',
    'Set α to 0, then raise it to 1 with n = 2. Particles split into ions: which readings change, and by how much?',
    'Switch the solvent from water to benzene. Which readings change and which stay the same?',
  ],
  experiment: [
    'Keep α = 0 and double the molality. Does ΔTb double? Check the straight line on the first graph.',
    'With m fixed, compare n = 1, 2 and 3 at α = 1. How does ΔTf scale with the number of ions?',
    'Raise the temperature from 273 K to 323 K. Which of the readings depends on T?',
  ],
  understand: [
    'A colligative property depends on the number of dissolved particles, not on their nature: ΔTb = i Kb m, ΔTf = i Kf m, π = iCRT.',
    "Dissociation makes i larger than 1 (i = 1 + α(n − 1)); association such as dimerisation makes i smaller than 1.",
    'Kb and Kf belong to the solvent (water: Kb = 0.52 and Kf = 1.86 K kg/mol; benzene: Kb = 2.53 and Kf = 5.12), so the same molality gives different shifts in different solvents.',
    'Only osmotic pressure depends on temperature in these formulas, which is why it is used for proteins and polymers.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the molality', prompt: 'A non-electrolyte solution in water has its molality doubled (0.5 to 1.0 mol/kg). What happens to the boiling point elevation?',
      base: { m: 0.5, n: 1, a: 0 }, test: { m: 1 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).dTb! / outs(base).dTb!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `ΔTb = Kb m, so it is proportional to m. ΔTb goes from ${fmt(outs(base).dTb!, 3)} K to ${fmt(outs(test).dTb!, 3)} K.`,
    },
    {
      id: 'p2', title: 'Water to benzene', prompt: 'The same 0.5 mol/kg non-electrolyte solution is made in benzene instead of water. How does the freezing point depression change? (Kf: water 1.86, benzene 5.12 K kg/mol)',
      base: { n: 1, a: 0, s: 0 }, test: { s: 1 }, options: ['It stays the same', 'It becomes about 2.75 times as large', 'It becomes about 2.75 times smaller', 'It becomes exactly twice as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).dTf! / outs(base).dTf!, [1, 2.75, 1 / 2.75, 2]),
      why: ({ base, test, outs }) => `ΔTf = Kf m and Kf belongs to the solvent. ΔTf goes from ${fmt(outs(base).dTf!, 3)} K in water to ${fmt(outs(test).dTf!, 3)} K in benzene, the ratio 5.12/1.86 ≈ 2.75.`,
    },
    {
      id: 'p3', title: 'Let it dissociate', prompt: 'A solute that can give 2 ions per formula unit goes from no dissociation (α = 0) to complete dissociation (α = 1) at the same molality. What happens to the osmotic pressure?',
      base: { n: 2, a: 0 }, test: { a: 1 }, options: ['It stays the same', 'It halves', 'It becomes four times as large', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).pi! / outs(base).pi!, [1, 0.5, 4, 2]),
      why: ({ base, test, outs }) => `i = 1 + α(n − 1) goes from ${fmt(outs(base).i!, 2)} to ${fmt(outs(test).i!, 2)}, and π is proportional to i. π goes from ${fmt(outs(base).pi!, 2)} bar to ${fmt(outs(test).pi!, 2)} bar.`,
    },
    {
      id: 'p4', title: 'Warm the solution', prompt: 'An aqueous solution is warmed from 278 K to 318 K. What happens to its osmotic pressure?',
      base: { T: 278 }, test: { T: 318 }, options: ['It doubles', 'It rises by roughly 14 percent', 'It falls', 'It does not change'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).pi! / outs(base).pi!, [2, 1.14, 0.88, 1]),
      why: ({ base, test, outs }) => `π = iCRT is proportional to the absolute temperature. π goes from ${fmt(outs(base).pi!, 2)} bar to ${fmt(outs(test).pi!, 2)} bar, a ratio of 318/278 ≈ 1.14 (it does not double: T is in kelvin).`,
    },
  ],
  measure: {
    instruction: 'Keep the solvent, the ions and α fixed. Record the boiling point elevation for at least three different molalities.',
    vary: 'm',
    record: ['dTb', 'dTf', 'i'],
    fit: {
      xLabel: 'molality m (mol/kg)',
      yLabel: 'ΔTb (K)',
      x: (v) => v.m!,
      y: (_v, o) => o.dTb!,
      interpret: (slope, _i, v) => {
        const i = iOf(v.n!, v.a!);
        return `ΔTb against m is a straight line through the origin, so ΔTb ∝ m. The slope is i·Kb = ${fmt(slope, 3)} K kg/mol. With i = ${fmt(i, 2)} this gives Kb = slope ÷ i ≈ ${fmt(slope / i, 2)} K kg/mol, the textbook value for ${v.s! ? 'benzene (2.53)' : 'water (0.52)'}.`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'Calculate the boiling point elevation when 12 g of urea (molar mass 60 g/mol) is dissolved in 250 g of water (Kb = 0.52 K kg/mol).', options: ['0.21 K', '0.42 K', '0.83 K', '0.10 K'], answer: 1,
      why: 'Moles of urea = 12/60 = 0.20 mol; molality = 0.20/0.250 = 0.80 mol/kg; ΔTb = 0.52 × 0.80 = 0.416 K ≈ 0.42 K.',
      verify: () => near(0.52 * (12 / 60 / 0.25), [0.21, 0.42, 0.83, 0.1]),
    },
    {
      id: 'q2', q: 'A non-volatile non-electrolyte, 3.0 g, dissolved in 75 g of benzene lowers its freezing point by 0.512 K (Kf = 5.12 K kg/mol). Its molar mass is', options: ['200 g/mol', '100 g/mol', '800 g/mol', '400 g/mol'], answer: 3,
      why: 'M = Kf × w2 × 1000/(ΔTf × w1) = 5.12 × 3.0 × 1000/(0.512 × 75) = 15360/38.4 = 400 g/mol.',
      verify: () => near((5.12 * 3 * 1000) / (0.512 * 75), [200, 100, 800, 400]),
    },
    {
      id: 'q3', q: 'A 0.10 molal aqueous solution of calcium chloride (assume complete dissociation) has a freezing point depression of (Kf = 1.86 K kg/mol)', options: ['0.186 K', '0.372 K', '0.558 K', '0.930 K'], answer: 2,
      why: 'CaCl₂ gives 3 ions, so i = 3. ΔTf = i Kf m = 3 × 1.86 × 0.10 = 0.558 K.',
      verify: () => near(iOf(3, 1) * 1.86 * 0.1, [0.186, 0.372, 0.558, 0.93]),
    },
    {
      id: 'q4', q: 'The osmotic pressure of a 0.050 M glucose solution at 300 K is (R = 0.083 L bar/(K mol))', options: ['0.62 bar', '2.49 bar', '12.45 bar', '1.245 bar'], answer: 3,
      why: 'π = CRT = 0.050 × 0.083 × 300 = 1.245 bar. Glucose does not dissociate, so i = 1.',
      verify: () => near(piBar(0.05, 1, 300), [0.62, 2.49, 12.45, 1.245]),
    },
    {
      id: 'q5', q: "Ethanoic acid dimerises in benzene with a degree of association of 0.60. Its van't Hoff factor is", options: ['0.40', '0.70', '1.30', '1.60'], answer: 1,
      why: 'For dimerisation i = 1 − α/2 = 1 − 0.30 = 0.70. A value below 1 means association, so the observed molar mass is higher than the formula value.',
      verify: () => near(1 - 0.6 / 2, [0.4, 0.7, 1.3, 1.6]),
    },
  ],
};
