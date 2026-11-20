/**
 * Chapter lab: Chemistry, Unit III "Chemical Kinetics: rates, order, integrated equations and the Arrhenius equation".
 * Model: rate = k [R]^n (n = 0 or 1), zero order [R] = [R]0 - kt, t1/2 = [R]0/2k; first order ln[R] = ln[R]0 - kt, t1/2 = 0.693/k;
 * Arrhenius k = A exp(-Ea/RT) with R = 8.314 J/(mol K), a catalyst lowering Ea. A = 1e13 is an illustrative frequency factor
 * (same number used in both orders). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { near } from './chem2-kit';

const R = 8.314;
const A = 1e13;
const kOf = (EaKJ: number, catKJ: number, T: number) => A * Math.exp(-((EaKJ - catKJ) * 1000) / (R * T));
const tHalf = (n: number, R0: number, k: number) => (n === 0 ? R0 / (2 * k) : Math.LN2 / k);
const t90 = (n: number, R0: number, k: number) => (n === 0 ? (0.9 * R0) / k : Math.LN10 / k);
const conc = (n: number, R0: number, k: number, t: number) => (n === 0 ? Math.max(0, R0 - k * t) : R0 * Math.exp(-k * t));

export const spec: Spec = {
  id: 'chem-kinetics',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Chemical Kinetics',
  afterHeading: 'Arrhenius equation and activation energy',
  title: 'Reaction Rate and Arrhenius Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose zero or first order, the starting concentration, the activation energy, the temperature and a catalyst, and watch the rate constant, the half-life and the concentration curve respond. Then plot ln k against 1/T to recover the activation energy.',
  can: ['Tell zero order from first order by how the half-life depends on [R]₀', 'Raise T and see k climb exponentially, not linearly', 'Fit ln k against 1/T and read Ea from the slope'],
  minutes: 12,
  vars: [
    { id: 'n', label: 'Order of reaction (0 or 1)', unit: '', min: 0, max: 1, step: 1, start: 1, digits: 0, choice: true },
    { id: 'R0', label: 'Initial concentration [R]₀', unit: 'mol/L', min: 0.2, max: 2, step: 0.1, start: 1, digits: 1 },
    { id: 'Ea', label: 'Activation energy Ea (no catalyst)', unit: 'kJ/mol', min: 50, max: 120, step: 5, start: 85, digits: 0 },
    { id: 'cat', label: 'Lowering of Ea by a catalyst', unit: 'kJ/mol', min: 0, max: 40, step: 5, start: 0, digits: 0 },
    { id: 'T', label: 'Temperature T', unit: 'K', min: 280, max: 400, step: 5, start: 310, digits: 0, bounds: { min: 1, max: 5000 } },
  ],
  outs: [
    { id: 'k', label: 'Rate constant k = A e^(−Ea/RT) (mol/L/s if order 0, s⁻¹ if order 1)', unit: '', fn: (v) => kOf(v.Ea!, v.cat!, v.T!), sci: true },
    { id: 'th', label: 'Half-life t½', unit: 's', fn: (v) => tHalf(v.n!, v.R0!, kOf(v.Ea!, v.cat!, v.T!)), digits: 2 },
    { id: 't90', label: 'Time for 90 % to react', unit: 's', fn: (v) => t90(v.n!, v.R0!, kOf(v.Ea!, v.cat!, v.T!)), digits: 2 },
    { id: 'rate0', label: 'Initial rate = k[R]₀ⁿ', unit: 'mol/L/s', fn: (v) => kOf(v.Ea!, v.cat!, v.T!) * v.R0! ** v.n!, sci: true },
    { id: 'frac', label: 'Fraction of molecules with E ≥ Ea: e^(−Ea/RT)', unit: '', fn: (v) => Math.exp(-((v.Ea! - v.cat!) * 1000) / (R * v.T!)), sci: true },
  ],
  graphs: [
    { id: 'k-T', title: 'Rate constant against temperature', x: 'T', y: 'k', logY: true },
    { id: 'rate-R0', title: 'Initial rate against concentration (the rate law)', x: 'R0', y: 'rate0' },
    { id: 'k-Ea', title: 'Rate constant against activation energy', x: 'Ea', y: 'k', logY: true },
  ],
  sceneAlt: 'Left, an energy profile whose barrier height follows the activation energy, with a lower dashed path when a catalyst is used. Right, the concentration of reactant against time for zero or first order, with the half-life marked.',
  scene: ({ v, o }) => {
    const ea = v.Ea! - v.cat!;
    const hOf = (e: number) => 8 + (e / 120) * 100;
    const peak = (h: number) => `M 15 150 C 45 150 55 ${150 - h} 100 ${150 - h} C 140 ${150 - h} 150 160 185 160`;
    const th = o.th!;
    const span = 3 * th;
    const pts = Array.from({ length: 41 }, (_, i) => {
      const t = (span * i) / 40;
      return `${(220 + (170 * i) / 40).toFixed(1)},${(180 - 140 * (conc(v.n!, v.R0!, o.k!, t) / v.R0!)).toFixed(1)}`;
    }).join(' ');
    return (
      <g>
        <text x={100} y={14} fontSize={11} textAnchor="middle" fill="#4d5768">energy profile</text>
        {v.cat! > 0 && <path d={peak(hOf(v.Ea!))} fill="none" stroke="#7c8595" strokeWidth={1.5} strokeDasharray="4 3" />}
        <path d={peak(hOf(ea))} fill="none" stroke="#c45e42" strokeWidth={2.5} />
        <line x1={15} y1={150} x2={100} y2={150} stroke="#18443b" strokeDasharray="2 3" />
        <line x1={95} y1={150} x2={95} y2={150 - hOf(ea)} stroke="#18443b" strokeWidth={1.4} />
        <text x={92} y={150 - hOf(ea) / 2} fontSize={10} textAnchor="end" fill="#18443b">Ea</text>
        <text x={100} y={178} fontSize={10} textAnchor="middle" fill="#4d5768">reactants → products</text>
        <text x={100} y={196} fontSize={11} textAnchor="middle" fill="#18443b">Ea = {fmt(ea, 0)} kJ/mol{v.cat! > 0 ? ' (catalysed)' : ''}</text>
        <rect x={220} y={40} width={170} height={140} fill="#fff" stroke="#e5e5e5" />
        <polyline points={pts} fill="none" stroke="#2563a8" strokeWidth={2.2} />
        <line x1={220 + 170 / 3} y1={180} x2={220 + 170 / 3} y2={110} stroke="#c45e42" strokeDasharray="3 3" />
        <line x1={220} y1={110} x2={220 + 170 / 3} y2={110} stroke="#c45e42" strokeDasharray="3 3" />
        <text x={220 + 170 / 3} y={193} fontSize={10} textAnchor="middle" fill="#c45e42">t½ = {fmt(th, th < 10 ? 2 : 0)} s</text>
        <text x={216} y={46} fontSize={10} textAnchor="end" fill="#4d5768">{fmt(v.R0!, 1)}</text>
        <text x={305} y={30} fontSize={11} textAnchor="middle" fill="#4d5768">[R] against t (0 to 3 t½), order {v.n}</text>
        <text x={305} y={216} fontSize={10} textAnchor="middle" fill="#4d5768">k = {fmt(o.k!, 2, true)}</text>
      </g>
    );
  },
  discover: [
    'Switch the order between 0 and 1 and change [R]₀. Watch the half-life: which order cares about the starting concentration?',
    'Raise the temperature by 10 K. How many times larger does k become?',
    'Add a catalyst by lowering Ea. Which readings change, and does the energy of the reactants and products move?',
  ],
  experiment: [
    'At order 1, double [R]₀. Does the half-life change? Repeat at order 0.',
    'Compare k at 300 K and 310 K for Ea = 60 kJ/mol and for Ea = 100 kJ/mol. Which reaction is more sensitive to temperature?',
    'Lower Ea by 20 kJ/mol with the catalyst slider and read the factor by which k rises at 300 K.',
  ],
  understand: [
    'Zero order: [R] = [R]₀ − kt and t½ = [R]₀/2k, so the half-life is proportional to the starting concentration.',
    'First order: ln[R] = ln[R]₀ − kt and t½ = 0.693/k, independent of the starting concentration.',
    'Arrhenius: k = A e^(−Ea/RT), so ln k = ln A − Ea/RT and a plot of ln k against 1/T has slope −Ea/R.',
    'A catalyst gives a path with a lower Ea; k rises sharply because Ea is in the exponent, while ΔH of the reaction is unchanged.',
  ],
  preds: [
    {
      id: 'p1', title: 'Warm it by 10 K', prompt: 'A reaction with Ea = 60 kJ/mol is warmed from 300 K to 310 K. What happens to the rate constant?',
      base: { Ea: 60, cat: 0, T: 300 }, test: { T: 310 }, options: ['It rises by about 3 percent (310/300)', 'It roughly doubles', 'It rises about 100 times', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).k! / outs(base).k!, [1.03, 2.2, 100, 1]),
      why: ({ base, test, outs }) => `k = A e^(−Ea/RT): a 10 K rise puts T in an exponent. k goes from ${fmt(outs(base).k!, 2, true)} to ${fmt(outs(test).k!, 2, true)}, a factor of ${fmt(outs(test).k! / outs(base).k!, 2)}.`,
    },
    {
      id: 'p2', title: 'First order, double the start', prompt: 'A first order reaction starts with twice the concentration (0.5 to 1.0 mol/L), same temperature. What happens to the half-life?',
      base: { n: 1, R0: 0.5 }, test: { R0: 1 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as long'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).th! / outs(base).th!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `For first order t½ = 0.693/k does not contain [R]₀. t½ is ${fmt(outs(base).th!, 2)} s in both cases (${fmt(outs(test).th!, 2)} s).`,
    },
    {
      id: 'p3', title: 'Zero order, double the start', prompt: 'A zero order reaction starts with twice the concentration (0.5 to 1.0 mol/L). What happens to the half-life?',
      base: { n: 0, R0: 0.5 }, test: { R0: 1 }, options: ['It stays the same', 'It halves', 'It doubles', 'It becomes four times as long'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).th! / outs(base).th!, [1, 0.5, 2, 4]),
      why: ({ base, test, outs }) => `For zero order t½ = [R]₀/2k is proportional to [R]₀. t½ goes from ${fmt(outs(base).th!, 2)} s to ${fmt(outs(test).th!, 2)} s.`,
    },
    {
      id: 'p4', title: 'Add a catalyst', prompt: 'A catalyst lowers the activation energy by 20 kJ/mol at 300 K (Ea 85 kJ/mol to 65 kJ/mol). What happens to k?',
      base: { Ea: 85, cat: 0, T: 300 }, test: { cat: 20 }, options: ['It stays the same', 'It roughly doubles', 'It rises about 3000 times', 'It falls'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).k! / outs(base).k!, [1, 2, 3000, 0.3]),
      why: ({ base, test, outs }) => `The factor is e^(ΔEa/RT) = e^(20000/(8.314 × 300)) ≈ 3 × 10³. k goes from ${fmt(outs(base).k!, 2, true)} to ${fmt(outs(test).k!, 2, true)}.`,
    },
  ],
  measure: {
    instruction: 'Keep the order, Ea and the catalyst fixed. Record the rate constant at three or more different temperatures. Then plot ln k against 1000/T.',
    vary: 'T',
    record: ['k', 'th', 'frac'],
    fit: {
      xLabel: '1000/T (K⁻¹)',
      yLabel: 'ln k',
      x: (v) => 1000 / v.T!,
      y: (_v, o) => Math.log(o.k!),
      interpret: (slope, intercept, v) => {
        const ea = -slope * R; // slope is in units of K^-1 per 1/1000 K; slope*1000 = -Ea/R
        const eaKJ = (ea * 1000) / 1000;
        return `ln k against 1000/T is a straight line, as ln k = ln A − (Ea/R)(1/T). The slope is ${fmt(slope, 2)} (per 10⁻³ K⁻¹), so Ea/R = ${fmt(-slope * 1000, 0)} K and Ea = ${fmt(eaKJ, 1)} kJ/mol; the setting was ${fmt(v.Ea! - v.cat!, 0)} kJ/mol. The intercept ${fmt(intercept, 1)} is ln A (A = 10¹³ here).`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'The rate constant of a reaction is 1.5 × 10⁻³ s⁻¹ at 300 K and 6.0 × 10⁻³ s⁻¹ at 320 K. The activation energy is about (R = 8.314 J/(mol K))', options: ['27.7 kJ/mol', '55.3 kJ/mol', '110.6 kJ/mol', '5.5 kJ/mol'], answer: 1,
      why: 'ln(k2/k1) = (Ea/R)(T2 − T1)/(T1T2). ln 4 = 1.386, so Ea = 8.314 × 1.386 × (300 × 320/20) = 8.314 × 1.386 × 4800 ≈ 5.53 × 10⁴ J/mol = 55.3 kJ/mol.',
      verify: () => near((R * Math.log(4) * (300 * 320)) / 20 / 1000, [27.7, 55.3, 110.6, 5.5]),
    },
    {
      id: 'q2', q: 'A first order reaction has k = 0.0462 min⁻¹. The time for 87.5 percent of the reactant to be used up is', options: ['15 min', '30 min', '60 min', '45 min'], answer: 3,
      why: 't½ = 0.693/0.0462 = 15 min. 87.5 percent used up means 12.5 percent = (1/2)³ left, three half-lives: 3 × 15 = 45 min.',
      verify: () => near(3 * (Math.LN2 / 0.0462), [15, 30, 60, 45]),
    },
    {
      id: 'q3', q: 'A zero order reaction has [R]₀ = 0.80 mol/L and k = 4.0 × 10⁻³ mol/(L s). The time for 75 percent of the reactant to be consumed is', options: ['75 s', '100 s', '150 s', '300 s'], answer: 2,
      why: 'For zero order t = ([R]₀ − [R])/k = (0.75 × 0.80)/(4.0 × 10⁻³) = 0.60/0.0040 = 150 s.',
      verify: () => near((0.75 * 0.8) / 4e-3, [75, 100, 150, 300]),
    },
    {
      id: 'q4', q: 'In the initial rate method, doubling [A] alone quadruples the rate and doubling [B] alone doubles it. The overall order is', options: ['1', '2', '3', '4'], answer: 2,
      why: 'Order in A: 2^x = 4 gives x = 2. Order in B: 2^y = 2 gives y = 1. Overall order = 2 + 1 = 3.',
      verify: () => near(Math.log2(4) + Math.log2(2), [1, 2, 3, 4]),
    },
    {
      id: 'q5', q: 'A plot of ln k against 1/T is a straight line of slope −7200 K. The activation energy is about (R = 8.314 J/(mol K))', options: ['0.86 kJ/mol', '59.9 kJ/mol', '7.2 kJ/mol', '599 kJ/mol'], answer: 1,
      why: 'slope = −Ea/R, so Ea = 7200 × 8.314 = 59 861 J/mol ≈ 59.9 kJ/mol.',
      verify: () => near((7200 * R) / 1000, [0.86, 59.9, 7.2, 599]),
    },
  ],
};
