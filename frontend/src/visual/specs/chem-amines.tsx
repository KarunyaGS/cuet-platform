/**
 * Chapter lab: Chemistry, Unit IX "Amines", section Basic character of amines (and the Hinsberg test).
 * Data: the pKb values quoted in the lesson (aqueous solution): methyl series 3.27 (dimethylamine), 3.38 (methylamine), 4.22 (trimethylamine);
 * ethyl series 3.00 (diethylamine), 3.25 (triethylamine), 3.29 (ethylamine); ammonia 4.75; aniline about 9.4.
 * Model: B + H2O <-> BH+ + OH-, Kb = 10^-pKb, exact solution x^2 + (s + Kb) x - Kb b = 0 for b = c(1-f) base and s = c f ammonium salt.
 * Hinsberg: primary gives a sulfonamide that dissolves in KOH, secondary gives an insoluble one, tertiary does not react (as in the lesson).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { clamp, near } from './chem2-kit';

interface Amine { name: string; pKb: number; deg: 1 | 2 | 3 }
const AM: Amine[] = [
  { name: 'C₆H₅NH₂', pKb: 9.4, deg: 1 },
  { name: 'CH₃NH₂', pKb: 3.38, deg: 1 },
  { name: '(CH₃)₂NH', pKb: 3.27, deg: 2 },
  { name: '(CH₃)₃N', pKb: 4.22, deg: 3 },
  { name: 'C₂H₅NH₂', pKb: 3.29, deg: 1 },
  { name: '(C₂H₅)₂NH', pKb: 3.0, deg: 2 },
  { name: '(C₂H₅)₃N', pKb: 3.25, deg: 3 },
];
const NH3 = 4.75;
/** [OH-] in mol/L: c total amine, f fraction already neutralised by HCl */
const ohOf = (pKb: number, c: number, f: number) => {
  const Kb = 10 ** -pKb;
  const b = c * (1 - f);
  const s = c * f;
  return (-(s + Kb) + Math.sqrt((s + Kb) ** 2 + 4 * Kb * b)) / 2;
};
const pHOf = (pKb: number, c: number, f: number) => 14 + Math.log10(ohOf(pKb, c, f));
const hins = (deg: number) => (deg === 1 ? 2 : deg === 2 ? 1 : 0); // 2 dissolves in KOH, 1 insoluble, 0 no reaction

export const spec: Spec = {
  id: 'chem-amines',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Amines',
  afterHeading: 'Basic character of amines',
  title: 'Amine Basicity and Hinsberg Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Pick an amine from the lesson (aniline, methyl and ethyl amines of all three degrees), set its concentration and how much acid has been added, and see its pKb, the pH of the solution, how much ionises and what the Hinsberg test would show.',
  can: ['Rank amines by pKb and see why aniline is far weaker than ammonia', 'Watch the pH of an amine solution against concentration and added acid', 'Predict the Hinsberg result for primary, secondary and tertiary amines'],
  minutes: 10,
  vars: [
    { id: 'a', label: 'Amine (0 PhNH₂, 1 CH₃NH₂, 2 (CH₃)₂NH, 3 (CH₃)₃N, 4 C₂H₅NH₂, 5 (C₂H₅)₂NH, 6 (C₂H₅)₃N)', unit: '', min: 0, max: 6, step: 1, start: 1, digits: 0 },
    { id: 'c', label: 'Total amine concentration c', unit: 'mol/L', min: 0.01, max: 1, step: 0.01, start: 0.1, log: true, digits: 2 },
    { id: 'f', label: 'Fraction of the amine neutralised by HCl', unit: '', min: 0, max: 0.9, step: 0.05, start: 0, digits: 2 },
  ],
  outs: [
    { id: 'pKb', label: 'pKb of the amine (lesson data, in water)', unit: '', fn: (v) => AM[v.a!]!.pKb, digits: 2 },
    { id: 'oh', label: '[OH⁻] from the exact equilibrium', unit: 'mol/L', fn: (v) => ohOf(AM[v.a!]!.pKb, v.c!, v.f!), sci: true },
    { id: 'pH', label: 'pH of the solution', unit: '', fn: (v) => pHOf(AM[v.a!]!.pKb, v.c!, v.f!), digits: 2 },
    { id: 'ion', label: 'Amine ionised, [BH⁺] from water ÷ free base', unit: '%', fn: (v) => (100 * ohOf(AM[v.a!]!.pKb, v.c!, v.f!)) / (v.c! * (1 - v.f!)), digits: 2 },
    { id: 'rank', label: 'Strength rank among the seven amines (1 = strongest)', unit: '', fn: (v) => 1 + AM.filter((x) => x.pKb < AM[v.a!]!.pKb).length, digits: 0 },
    { id: 'hins', label: 'Hinsberg result (2 = sulfonamide dissolves in KOH, 1 = insoluble, 0 = no reaction)', unit: '', fn: (v) => hins(AM[v.a!]!.deg), digits: 0 },
  ],
  graphs: [
    { id: 'pH-c', title: 'pH of the amine solution against concentration', x: 'c', y: 'pH', logX: true },
    { id: 'pH-f', title: 'pH against fraction neutralised by HCl', x: 'f', y: 'pH' },
    { id: 'pKb-a', title: 'pKb along the list of amines', x: 'a', y: 'pKb' },
  ],
  sceneAlt: 'Horizontal bars of basic strength for the seven amines and ammonia, the chosen amine highlighted, a pH scale with a marker for the solution, and a test tube showing what the Hinsberg test gives for that amine.',
  scene: ({ v, o }) => {
    const rows = [...AM.map((m, i) => ({ n: m.name, p: m.pKb, i })), { n: 'NH₃ (ref.)', p: NH3, i: -1 }];
    const tube = o.hins === 2 ? { fill: '#cfe3f3', lay: false, lab: 'clear solution: dissolves in KOH' } : o.hins === 1 ? { fill: '#cfe3f3', lay: true, lab: 'insoluble oily layer' } : { fill: '#cfe3f3', lay: true, lab: 'no reaction: amine layer' };
    return (
      <g>
        <text x={115} y={12} fontSize={10} textAnchor="middle" fill="#4d5768">bar length = 10 − pKb (longer = stronger base)</text>
        {rows.map((r, k) => (
          <g key={k}>
            <text x={68} y={30 + k * 22} fontSize={9} textAnchor="end" fill={r.i === v.a ? '#c45e42' : '#4d5768'}>{r.n}</text>
            <rect x={72} y={21 + k * 22} width={Math.max(2, (10 - r.p) * 20)} height={12} fill={r.i === v.a ? '#c45e42' : r.i === -1 ? '#c9d3dc' : '#18443b'} opacity={r.i === v.a ? 1 : 0.55} />
            <text x={76 + Math.max(2, (10 - r.p) * 20)} y={31 + k * 22} fontSize={9} fill="#4d5768">{r.p}</text>
          </g>
        ))}
        <rect x={300} y={40} width={34} height={90} rx={6} fill="#fff" stroke="#18443b" strokeWidth={2} />
        <rect x={302} y={70} width={30} height={58} fill={tube.fill} />
        {tube.lay && <rect x={302} y={70} width={30} height={14} fill="#e0b25c" opacity={0.85} />}
        <text x={317} y={30} fontSize={10} textAnchor="middle" fill="#18443b">+ C₆H₅SO₂Cl, KOH</text>
        <text x={317} y={146} fontSize={9} textAnchor="middle" fill="#4d5768">{tube.lab}</text>
        <rect x={250} y={178} width={140} height={10} fill="#eef1f4" stroke="#e5e5e5" />
        <circle cx={250 + (clamp(o.pH!, 0, 14) / 14) * 140} cy={183} r={6} fill="#c45e42" />
        <text x={250} y={202} fontSize={9} fill="#4d5768">pH 0</text>
        <text x={390} y={202} fontSize={9} textAnchor="end" fill="#4d5768">14</text>
        <text x={320} y={170} fontSize={11} textAnchor="middle" fill="#18443b">pH = {fmt(o.pH!, 2)}</text>
        <text x={320} y={220} fontSize={10} textAnchor="middle" fill="#4d5768">{AM[v.a!]!.name} · pKb {AM[v.a!]!.pKb}</text>
      </g>
    );
  },
  discover: [
    'Step through the seven amines and read the pKb and the pH. Which is the strongest base in water? Which the weakest, and by how much?',
    'Compare (CH₃)₂NH with (CH₃)₃N. The tertiary amine has more alkyl groups but is the weaker base: why?',
    'Add acid with the neutralised fraction slider. What happens to the pH, and does it fall to 7?',
  ],
  experiment: [
    'Dilute methylamine from 1 mol/L to 0.01 mol/L. Does the pH fall by 1 for each tenfold dilution?',
    'Watch the percentage ionised as you dilute: why does it rise?',
    'Check the Hinsberg result for a primary, a secondary and a tertiary amine.',
  ],
  understand: [
    'A smaller pKb means a larger Kb and a stronger base; aliphatic amines are stronger bases than NH₃ (pKb 4.75), aniline is much weaker (pKb about 9.4) because its lone pair is delocalised into the ring.',
    'In water the order is not simply tertiary > secondary > primary: solvation and steric hindrance lower the tertiary amines (e.g. (CH₃)₂NH 3.27, CH₃NH₂ 3.38, (CH₃)₃N 4.22).',
    'A weak base is only slightly ionised: [OH⁻] = √(Kb c) roughly, so a tenfold dilution changes the pH by about 0.5, not 1.',
    'Hinsberg test: primary gives an alkali-soluble sulfonamide, secondary an insoluble one, tertiary does not react.',
  ],
  preds: [
    {
      id: 'p1', title: 'Methylamine to aniline', prompt: 'A 0.10 mol/L solution of methylamine (pKb 3.38, pH about 11.8) is replaced by 0.10 mol/L aniline (pKb 9.4). What is the pH of the aniline solution?',
      base: { a: 1, c: 0.1, f: 0 }, test: { a: 0 }, options: ['About 11.8, the same', 'About 8.8', 'Exactly 7', 'Below 4'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).pH!, [11.8, 8.8, 7, 3.5]),
      why: ({ base, test, outs }) => `Aniline's lone pair is delocalised into the ring, so Kb is about a million times smaller (pKb 9.4). pH goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}; it is still basic, slightly above 7.`,
    },
    {
      id: 'p2', title: 'Secondary to tertiary', prompt: 'Dimethylamine ((CH₃)₂NH, pKb 3.27) is replaced by trimethylamine ((CH₃)₃N, pKb 4.22), both at 0.10 mol/L. What happens to the pH?',
      base: { a: 2, c: 0.1, f: 0 }, test: { a: 3 }, options: ['It rises, because there are three +I groups', 'It falls, because the tertiary ion is poorly solvated and crowded', 'It does not change', 'It becomes 7'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).pH! < outs(base).pH! - 0.1 ? 1 : outs(test).pH! > outs(base).pH! + 0.1 ? 0 : 2),
      why: ({ base, test, outs }) => `In water the trimethylammonium ion has only one N–H for hydrogen bonding and is crowded, so (CH₃)₃N is the weaker base. pH goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}.`,
    },
    {
      id: 'p3', title: 'Dilute tenfold', prompt: 'A methylamine solution is diluted from 0.10 mol/L to 0.010 mol/L. What happens to the pH?',
      base: { a: 1, c: 0.1, f: 0 }, test: { c: 0.01 }, options: ['It falls by 1.0', 'It falls by about 0.5', 'It does not change', 'It rises'], answer: 1,
      verify: ({ base, test, outs }) => { const d = outs(base).pH! - outs(test).pH!; return d > 0.8 ? 0 : d > 0.2 ? 1 : d < -0.1 ? 3 : 2; },
      why: ({ base, test, outs }) => `[OH⁻] ≈ √(Kb c), so a tenfold dilution cuts [OH⁻] by about √10 = 3.2, not 10 (the amine ionises more as it is diluted). pH goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}.`,
    },
    {
      id: 'p4', title: 'Hinsberg test', prompt: 'A secondary amine ((CH₃)₂NH) gives an alkali-insoluble sulfonamide. A primary amine (CH₃NH₂) is tested instead. What is seen after adding KOH?',
      base: { a: 2 }, test: { a: 1 }, options: ['The sulfonamide stays insoluble', 'The sulfonamide dissolves (acidic N–H remains)', 'No reaction at all', 'A gas is evolved'], answer: 1,
      verify: ({ test, outs }) => (outs(test).hins === 2 ? 1 : outs(test).hins === 1 ? 0 : 2),
      why: ({ base, test, outs }) => `The primary sulfonamide RNH–SO₂C₆H₅ still has an N–H made acidic by the SO₂ group, so it dissolves in KOH (code ${outs(test).hins}); the secondary one has no N–H (code ${outs(base).hins}), so it stays insoluble.`,
    },
  ],
  measure: {
    instruction: 'Keep the amine fixed with no acid added. Record [OH⁻] for at least three concentrations. Plot [OH⁻][BH⁺] against the free base concentration to recover Kb.',
    vary: 'c',
    record: ['oh', 'pH', 'ion'],
    fit: {
      xLabel: '[B] at equilibrium (mol/L)',
      yLabel: '[OH⁻][BH⁺] (mol²/L²)',
      x: (v, o) => v.c! * (1 - v.f!) - o.oh!,
      y: (v, o) => o.oh! * (v.c! * v.f! + o.oh!),
      interpret: (slope, _i, v) =>
        `Kb = [BH⁺][OH⁻]/[B], so [OH⁻][BH⁺] against [B] is a straight line through the origin whose slope is Kb. Your slope is ${fmt(slope, 2, true)}, so pKb = −log Kb = ${fmt(-Math.log10(slope), 2)}; the tabulated value for ${AM[v.a!]!.name} is ${AM[v.a!]!.pKb}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Dimethylamine has pKb = 3.27. The pH of a 0.020 mol/L aqueous solution is closest to', options: ['10.5', '11.5', '12.3', '9.5'], answer: 1,
      why: 'Kb = 10⁻³·²⁷ = 5.4 × 10⁻⁴. Solving x²/(0.020 − x) = Kb gives [OH⁻] = 3.0 × 10⁻³ mol/L, pOH = 2.52, pH = 14 − 2.52 = 11.5.',
      verify: () => near(pHOf(3.27, 0.02, 0), [10.5, 11.5, 12.3, 9.5]),
    },
    {
      id: 'q2', q: 'Of aniline, ammonia, trimethylamine and dimethylamine, the strongest base in aqueous solution is', options: ['C₆H₅NH₂', 'NH₃', '(CH₃)₃N', '(CH₃)₂NH'], answer: 3,
      why: 'pKb: dimethylamine 3.27 < trimethylamine 4.22 < ammonia 4.75 < aniline 9.4. The smallest pKb is the strongest base.',
      verify: () => { const p = [AM[0]!.pKb, NH3, AM[3]!.pKb, AM[2]!.pKb]; return p.indexOf(Math.min(...p)); },
    },
    {
      id: 'q3', q: 'An amine gives a foul-smelling isocyanide with chloroform and alcoholic KOH, and after reaction with benzenesulfonyl chloride the product dissolves in aqueous KOH. The amine is', options: ['primary', 'secondary', 'tertiary', 'a quaternary ammonium salt'], answer: 0,
      why: 'Only a primary amine gives the carbylamine test, and only a primary amine gives a sulfonamide with an acidic N–H that dissolves in alkali.',
      verify: () => (hins(1) === 2 ? 0 : -1),
    },
    {
      id: 'q4', q: 'The pKb of trimethylamine is 4.22. Its Kb is', options: ['6.0 × 10⁻⁴', '4.2 × 10⁻⁵', '6.0 × 10⁻⁵', '1.7 × 10⁴'], answer: 2,
      why: 'Kb = 10^(−pKb) = 10^(−4.22) = 6.0 × 10⁻⁵.',
      verify: () => near(10 ** -4.22, [6.0e-4, 4.2e-5, 6.0e-5, 1.7e4]),
    },
    {
      id: 'q5', q: 'Aniline has pKb = 9.4. The hydroxide ion concentration in a 0.050 mol/L aqueous solution is about', options: ['2.0 × 10⁻¹¹ mol/L', '4.5 × 10⁻⁶ mol/L', '4.5 × 10⁻³ mol/L', '1.4 × 10⁻⁵ mol/L'], answer: 1,
      why: 'Kb = 10⁻⁹·⁴ = 4.0 × 10⁻¹⁰. [OH⁻] ≈ √(Kb c) = √(4.0 × 10⁻¹⁰ × 0.050) = √(2.0 × 10⁻¹¹) = 4.5 × 10⁻⁶ mol/L.',
      verify: () => near(ohOf(9.4, 0.05, 0), [2.0e-11, 4.5e-6, 4.5e-3, 1.4e-5]),
    },
  ],
};
