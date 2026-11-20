/**
 * Chapter lab: Chemistry, Unit VI "Haloalkanes and haloarenes", section Mechanism of SN1 and SN2 reactions.
 * Rate laws from the lesson: SN2 rate = k2[RX][Nu]; SN1 rate = k1[RX]. Reactivity ORDERS from the lesson (SN2: CH3X > 1° > 2° > 3°;
 * SN1: 3° > 2° > 1° > CH3X; SN1 favoured by polar protic, SN2 by polar aprotic solvent; leaving group I > Br > Cl).
 * The relative numbers below are ILLUSTRATIVE (not measured values), chosen only to respect those orders.
 * Stereochemistry as in the lesson: SN2 = complete inversion, SN1 = racemisation (half retained, half inverted). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { near } from './chem2-kit';

const K2_SUB = [30, 1, 0.02, 0.0002]; // CH3X, 1°, 2°, 3°  (SN2: steric hindrance)
const K1_SUB = [1e-5, 1e-4, 0.01, 10]; // CH3X, 1°, 2°, 3°  (SN1: carbocation stability)
const LG = [1, 10, 30]; // Cl, Br, I (both mechanisms)
const CLASS = ['CH₃X (methyl)', 'primary (1°)', 'secondary (2°)', 'tertiary (3°)'];
const rSN2 = (c: number, rx: number, nu: number, s: number, lg: number) => K2_SUB[c]! * (s === 1 ? 10 : 1) * LG[lg]! * rx * nu;
const rSN1 = (c: number, rx: number, s: number, lg: number) => K1_SUB[c]! * (s === 0 ? 10 : 1) * LG[lg]! * rx;
const shareSN2 = (a: number, b: number) => a / (a + b);

export const spec: Spec = {
  id: 'chem-sn1-sn2',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Haloalkanes and haloarenes',
  afterHeading: 'Mechanism of SN1 and SN2 reactions',
  title: 'SN1 and SN2 Mechanism Lab',
  format: 'Virtual experiment · mechanism chooser',
  blurb: 'Change the class of the haloalkane, the halide and nucleophile concentrations, the leaving group and the solvent. The lab computes the SN1 and SN2 rates from their rate laws, tells you which mechanism wins, and what happens to the stereochemistry of the product.',
  can: ['See that SN2 rate depends on [Nu] and SN1 rate does not', 'Find which substrate class and solvent push the reaction towards SN1 or SN2', 'Read inversion against racemisation from the mechanism share'],
  minutes: 12,
  vars: [
    { id: 'c', label: 'Haloalkane class (0 = CH₃X, 1 = 1°, 2 = 2°, 3 = 3°)', unit: '', min: 0, max: 3, step: 1, start: 2, digits: 0, choice: true },
    { id: 'rx', label: 'Concentration [RX]', unit: 'mol/L', min: 0.05, max: 1, step: 0.05, start: 0.1, digits: 2 },
    { id: 'nu', label: 'Concentration of nucleophile [Nu⁻]', unit: 'mol/L', min: 0.1, max: 2, step: 0.1, start: 0.2, digits: 1 },
    { id: 's', label: 'Solvent (0 = polar protic, 1 = polar aprotic)', unit: '', min: 0, max: 1, step: 1, start: 1, digits: 0, choice: true },
    { id: 'lg', label: 'Leaving group (0 = Cl, 1 = Br, 2 = I)', unit: '', min: 0, max: 2, step: 1, start: 1, digits: 0, choice: true },
  ],
  outs: [
    { id: 'r1', label: 'SN1 rate = k₁[RX] (relative units)', unit: '', fn: (v) => rSN1(v.c!, v.rx!, v.s!, v.lg!), sci: true },
    { id: 'r2', label: 'SN2 rate = k₂[RX][Nu⁻] (relative units)', unit: '', fn: (v) => rSN2(v.c!, v.rx!, v.nu!, v.s!, v.lg!), sci: true },
    { id: 'rt', label: 'Total rate', unit: '', fn: (v) => rSN1(v.c!, v.rx!, v.s!, v.lg!) + rSN2(v.c!, v.rx!, v.nu!, v.s!, v.lg!), sci: true },
    { id: 'p2', label: 'Share of reaction by SN2', unit: '%', fn: (v) => 100 * shareSN2(rSN2(v.c!, v.rx!, v.nu!, v.s!, v.lg!), rSN1(v.c!, v.rx!, v.s!, v.lg!)), digits: 1 },
    { id: 'inv', label: 'Product with inverted configuration (optically pure RX)', unit: '%', fn: (v) => { const x = shareSN2(rSN2(v.c!, v.rx!, v.nu!, v.s!, v.lg!), rSN1(v.c!, v.rx!, v.s!, v.lg!)); return 100 * (x + (1 - x) / 2); }, digits: 1 },
  ],
  graphs: [
    { id: 'r2-nu', title: 'SN2 rate against nucleophile concentration', x: 'nu', y: 'r2' },
    { id: 'p2-c', title: 'Share of SN2 against class of haloalkane', x: 'c', y: 'p2' },
    { id: 'rt-rx', title: 'Total rate against haloalkane concentration', x: 'rx', y: 'rt' },
  ],
  sceneAlt: 'A haloalkane carbon with the number of bulky alkyl groups following the chosen class, an incoming nucleophile arrow, and two energy profiles: one hump for SN2 and two humps with a carbocation for SN1, drawn bolder for the mechanism that dominates.',
  scene: ({ v, o }) => {
    const sn2 = o.p2! >= 50;
    const groups = [0, 1, 2].map((j) => ({ big: j < v.c!, x: 62 + (j - 1) * 0, y: 60 + j * 38 }));
    return (
      <g>
        <text x={95} y={14} fontSize={11} textAnchor="middle" fill="#4d5768">{CLASS[v.c!]}</text>
        <circle cx={95} cy={110} r={11} fill="#18443b" />
        <text x={95} y={114} fontSize={10} textAnchor="middle" fill="#fff">C</text>
        {groups.map((g, j) => (
          <g key={j}>
            <line x1={95} y1={110} x2={g.x - 4 + 8} y2={g.y + 22} stroke="#7c8595" strokeWidth={2} />
            <circle cx={g.x} cy={g.y + 22} r={g.big ? 14 : 6} fill={g.big ? '#c9d3dc' : '#e8ecf0'} stroke="#7c8595" />
            <text x={g.x} y={g.y + 25} fontSize={9} textAnchor="middle" fill="#4d5768">{g.big ? 'R' : 'H'}</text>
          </g>
        ))}
        <line x1={106} y1={110} x2={140} y2={110} stroke="#7c8595" strokeWidth={2} />
        <circle cx={150} cy={110} r={11} fill="#c45e42" />
        <text x={150} y={114} fontSize={9} textAnchor="middle" fill="#fff">{['Cl', 'Br', 'I'][v.lg!]}</text>
        <path d="M 20 110 H 80 m -8 -5 l 8 5 l -8 5" stroke="#2563a8" strokeWidth={2} fill="none" opacity={0.25 + 0.75 * (o.p2! / 100)} />
        <text x={28} y={102} fontSize={10} fill="#2563a8">Nu⁻</text>
        <text x={95} y={206} fontSize={10} textAnchor="middle" fill="#4d5768">{v.s ? 'polar aprotic solvent' : 'polar protic solvent'}</text>
        <path d="M 205 190 C 225 190 235 120 255 120 C 275 120 285 190 305 190 H 380" fill="none" stroke="#2563a8" strokeWidth={sn2 ? 3.2 : 1.2} opacity={sn2 ? 1 : 0.5} />
        <text x={255} y={112} fontSize={10} textAnchor="middle" fill="#2563a8">SN2: one step</text>
        <path d="M 205 150 C 215 150 225 70 240 70 C 255 70 262 118 272 118 C 282 118 292 90 310 90 C 325 90 330 168 345 168 H 385" fill="none" stroke="#c45e42" strokeWidth={sn2 ? 1.2 : 3.2} opacity={sn2 ? 0.5 : 1} />
        <text x={272} y={132} fontSize={10} textAnchor="middle" fill="#c45e42">R⁺ carbocation</text>
        <text x={290} y={62} fontSize={10} textAnchor="middle" fill="#c45e42">SN1: two steps</text>
        <text x={290} y={18} fontSize={11} textAnchor="middle" fill="#18443b">{sn2 ? 'SN2 dominates' : 'SN1 dominates'} ({fmt(sn2 ? o.p2! : 100 - o.p2!, 0)} %)</text>
        <text x={290} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.inv!, 0)} % inverted · {fmt(100 - o.inv!, 0)} % retained</text>
      </g>
    );
  },
  discover: [
    'Move the class from CH₃X to tertiary. Which mechanism takes over, and where does it flip?',
    'Raise the nucleophile concentration. Which rate responds and which does not?',
    'Switch the solvent between polar protic and polar aprotic for a secondary halide.',
  ],
  experiment: [
    'With a tertiary halide, double [Nu⁻]. Does the total rate change? Repeat with a primary halide in the aprotic solvent.',
    'Swap Cl for I as the leaving group. What happens to both rates?',
    'Read the product with inverted configuration for primary and for tertiary halides.',
  ],
  understand: [
    'SN2: rate = k[RX][Nu⁻], one step, backside attack, complete inversion; favoured for CH₃X and primary halides and by polar aprotic solvents.',
    'SN1: rate = k[RX], two steps through a planar carbocation, racemisation; favoured for tertiary halides and by polar protic solvents.',
    'A better leaving group (I > Br > Cl) speeds up both mechanisms.',
    'Secondary halides can use either route, so the nucleophile concentration and the solvent decide.',
  ],
  preds: [
    {
      id: 'p1', title: 'Primary halide, more nucleophile', prompt: 'A primary haloalkane reacts in a polar aprotic solvent. The nucleophile concentration is doubled (0.2 to 0.4 mol/L). What happens to the overall rate?',
      base: { c: 1, s: 1, nu: 0.2 }, test: { nu: 0.4 }, options: ['It stays the same', 'It roughly doubles', 'It becomes four times as large', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).rt! / outs(base).rt!, [1, 2, 4, 0.5]),
      why: ({ base, test, outs }) => `A primary halide reacts by SN2 (${fmt(outs(base).p2!, 1)} % SN2), and rate = k[RX][Nu⁻] is proportional to [Nu⁻]. The total rate goes from ${fmt(outs(base).rt!, 2, true)} to ${fmt(outs(test).rt!, 2, true)}.`,
    },
    {
      id: 'p2', title: 'Tertiary halide, more nucleophile', prompt: 'A tertiary haloalkane reacts in a polar protic solvent. The nucleophile concentration is doubled (0.2 to 0.4 mol/L). What happens to the overall rate?',
      base: { c: 3, s: 0, nu: 0.2 }, test: { nu: 0.4 }, options: ['It doubles', 'It stays (almost exactly) the same', 'It halves', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).rt! / outs(base).rt!, [2, 1, 0.5, 4]),
      why: ({ base, test, outs }) => `A tertiary halide reacts by SN1 (${fmt(100 - outs(base).p2!, 3)} % SN1), whose rate k[RX] does not contain [Nu⁻]. The total rate goes from ${fmt(outs(base).rt!, 3, true)} to ${fmt(outs(test).rt!, 3, true)}.`,
    },
    {
      id: 'p3', title: 'Change the solvent', prompt: 'A secondary haloalkane changes from a polar protic solvent to a polar aprotic solvent (same concentrations). What happens to the share of the reaction going by SN2?',
      base: { c: 2, s: 0 }, test: { s: 1 }, options: ['It stays small', 'It rises strongly', 'It falls to zero', 'It stays at exactly 50 percent'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).p2! > outs(base).p2! + 30 ? 1 : outs(test).p2! < outs(base).p2! - 30 ? 2 : Math.abs(outs(test).p2! - 50) < 0.5 && Math.abs(outs(base).p2! - 50) < 0.5 ? 3 : 0),
      why: ({ base, test, outs }) => `Protic solvents favour SN1 (stabilise the carbocation), aprotic solvents favour SN2. The SN2 share goes from ${fmt(outs(base).p2!, 1)} % to ${fmt(outs(test).p2!, 1)} %.`,
    },
    {
      id: 'p4', title: 'Stereochemistry', prompt: 'An optically pure chiral primary halide is replaced by an optically pure chiral tertiary halide (both with the same concentrations, polar solvent). What happens to the percentage of product with inverted configuration?',
      base: { c: 1, s: 1 }, test: { c: 3, s: 0 }, options: ['It stays near 100 %', 'It falls to about 50 % (racemic mixture)', 'It falls to 0 %', 'It rises above 100 %'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).inv! / outs(base).inv!, [1, 0.5, 0.0001, 1.5]),
      why: ({ base, test, outs }) => `SN2 gives complete inversion; SN1 gives a racemic mixture (half inverted, half retained). Inverted product goes from ${fmt(outs(base).inv!, 1)} % to ${fmt(outs(test).inv!, 1)} %.`,
    },
  ],
  measure: {
    instruction: 'Keep the class, solvent and leaving group fixed (try a secondary halide in the aprotic solvent). Record the total rate for at least three nucleophile concentrations.',
    vary: 'nu',
    record: ['r1', 'r2', 'rt', 'p2'],
    fit: {
      xLabel: '[Nu⁻] (mol/L)',
      yLabel: 'total rate (relative units)',
      x: (v) => v.nu!,
      y: (_v, o) => o.rt!,
      interpret: (slope, intercept, v) =>
        `Total rate = k₁[RX] + k₂[RX][Nu⁻] is a straight line in [Nu⁻]. The intercept ${fmt(intercept, 2, true)} is the SN1 part (it does not depend on [Nu⁻]), so k₁ = intercept ÷ [RX] = ${fmt(intercept / v.rx!, 2, true)}. The slope ${fmt(slope, 2, true)} is the SN2 part, so k₂ = slope ÷ [RX] = ${fmt(slope / v.rx!, 2, true)} (relative units).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'For an SN2 reaction, [RBr] is changed from 0.10 M to 0.30 M and [OH⁻] from 0.10 M to 0.40 M. The rate changes by a factor of', options: ['3', '4', '12', '7'], answer: 2,
      why: 'Rate = k[RBr][OH⁻], so the factor is (0.30/0.10) × (0.40/0.10) = 3 × 4 = 12.',
      verify: () => near((0.3 / 0.1) * (0.4 / 0.1), [3, 4, 12, 7]),
    },
    {
      id: 'q2', q: 'For the SN1 hydrolysis of tert-butyl bromide, [RBr] is raised from 0.10 M to 0.40 M and [OH⁻] is doubled. The rate changes by a factor of', options: ['2', '4', '8', '16'], answer: 1,
      why: 'Rate = k[RBr] only. The factor is 0.40/0.10 = 4; the nucleophile concentration does not appear in the rate law.',
      verify: () => near(0.4 / 0.1, [2, 4, 8, 16]),
    },
    {
      id: 'q3', q: 'Optically pure (R)-2-bromobutane gives a product that is 85 percent inverted and 15 percent retained (mixed SN1 and SN2). The optical purity of the product is', options: ['15 %', '70 %', '85 %', '30 %'], answer: 1,
      why: 'The 15 percent retained cancels 15 percent of the inverted product (racemic part). Excess = 85 − 15 = 70 percent of the inverted enantiomer.',
      verify: () => near(85 - 15, [15, 70, 85, 30]),
    },
    {
      id: 'q4', q: 'Among CH₃Br, CH₃CH₂Br, (CH₃)₂CHBr and (CH₃)₃CBr, the fastest in an SN2 reaction is', options: ['CH₃Br', 'CH₃CH₂Br', '(CH₃)₂CHBr', '(CH₃)₃CBr'], answer: 0,
      why: 'SN2 reactivity falls with crowding at the carbon: CH₃X > primary > secondary > tertiary, so CH₃Br is fastest.',
      verify: () => K2_SUB.indexOf(Math.max(...K2_SUB)),
    },
    {
      id: 'q5', q: 'A molecule has three different stereocentres and no meso form. The maximum number of stereoisomers is', options: ['3', '6', '8', '9'], answer: 2,
      why: 'Number of stereoisomers = 2ⁿ = 2³ = 8.',
      verify: () => near(2 ** 3, [3, 6, 8, 9]),
    },
  ],
};
