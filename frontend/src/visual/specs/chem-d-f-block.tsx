/**
 * Chapter lab: Chemistry, Unit IV "d and f Block Elements", section Magnetic properties (with configurations and the lanthanoid contraction).
 * From the lesson: 3d series outer electrons (Z - 18) with the 4s electrons removed first, so Mn2+ is 3d5, Fe3+ is 3d5, Cu2+ is 3d9, Mn7+ is 3d0;
 * oxidation states of the first series as listed in the lesson table; spin-only mu = sqrt(n(n+2)) BM; d0 and d10 ions have no d-d transition;
 * lanthanoid contraction: Ln3+ radius falls from about 106 pm (La3+) to about 85 pm (Lu3+). The straight line between these two values
 * (1.5 pm per element over 14 steps) is a simplification of the "steady decrease". Free-ion Hund filling is used for the unpaired electrons.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { near } from './chem2-kit';

const SYM = ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn'];
const STATES: number[][] = [[3], [2, 3, 4], [2, 3, 4, 5], [2, 3, 6], [2, 3, 4, 6, 7], [2, 3], [2, 3], [2], [1, 2], [2]];
const LN = ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'];
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰'];
const outer = (z: number) => z - 18; // 4s + 3d electrons of the neutral atom
const dOf = (z: number, ox: number) => Math.max(0, outer(z) - ox);
const unpOf = (nd: number) => (nd <= 5 ? nd : 10 - nd);
const mu = (n: number) => Math.sqrt(n * (n + 2));
const rLn = (k: number) => 106 - ((106 - 85) / 14) * k;

export const spec: Spec = {
  id: 'chem-d-f-block',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'd and f Block Elements',
  afterHeading: 'Magnetic properties',
  title: 'Transition Ion and Lanthanoid Contraction Lab',
  format: 'Virtual experiment · orbital diagram',
  blurb: 'Pick a 3d element and an oxidation state: remove the 4s electrons first, fill the d orbitals, and read off the unpaired electrons, the spin-only magnetic moment and whether a d–d colour is possible. Then walk along the lanthanoids and watch the Ln³⁺ ion shrink.',
  can: ['Write the d configuration of an ion by removing 4s electrons first', 'Compute μ = √(n(n+2)) BM from the unpaired electrons', 'Measure the steady fall of Ln³⁺ radius across the lanthanoids'],
  minutes: 10,
  vars: [
    { id: 'z', label: 'Element of the 3d series (atomic number 21 Sc … 30 Zn)', unit: '', min: 21, max: 30, step: 1, start: 26, digits: 0, choice: true },
    { id: 'ox', label: 'Oxidation state of the ion', unit: '+', min: 1, max: 7, step: 1, start: 3, digits: 0, choice: true },
    { id: 'k', label: 'Lanthanoid position (0 = La, 7 = Gd, 14 = Lu)', unit: '', min: 0, max: 14, step: 1, start: 0, digits: 0, choice: true },
  ],
  outs: [
    { id: 'nd', label: 'd electrons of the ion', unit: '', fn: (v) => dOf(v.z!, v.ox!), digits: 0 },
    { id: 'unp', label: 'Unpaired electrons n (Hund filling)', unit: '', fn: (v) => unpOf(dOf(v.z!, v.ox!)), digits: 0 },
    { id: 'mu', label: 'Spin-only magnetic moment μ = √(n(n+2))', unit: 'BM', fn: (v) => mu(unpOf(dOf(v.z!, v.ox!))), digits: 2 },
    { id: 'listed', label: 'This oxidation state is listed for the element in the lesson (1 = yes, 0 = no)', unit: '', fn: (v) => (STATES[v.z! - 21]!.includes(v.ox!) ? 1 : 0), digits: 0 },
    { id: 'r', label: 'Ln³⁺ ionic radius (La³⁺ 106 pm to Lu³⁺ 85 pm)', unit: 'pm', fn: (v) => rLn(v.k!), digits: 1 },
  ],
  graphs: [
    { id: 'mu-z', title: 'Magnetic moment along the 3d series (same oxidation state)', x: 'z', y: 'mu' },
    { id: 'mu-ox', title: 'Magnetic moment against oxidation state of this element', x: 'ox', y: 'mu' },
    { id: 'r-k', title: 'Ln³⁺ radius along the lanthanoids', x: 'k', y: 'r' },
  ],
  sceneAlt: 'Five d orbital boxes filled with up and down arrows for the chosen ion, a label of its configuration, moment and colour, and on the right a circle for the Ln3+ ion that shrinks along the lanthanoids with dashed outlines for lanthanum and lutetium.',
  scene: ({ v, o }) => {
    const nd = o.nd!;
    const ok = o.listed === 1;
    const colour = nd === 0 || nd === 10 ? 'colourless (no d–d transition)' : 'coloured by d–d transition';
    const rad = (r: number) => (r / 106) * 48;
    return (
      <g>
        <text x={115} y={20} fontSize={12} textAnchor="middle" fill="#18443b">{SYM[v.z! - 21]}{v.ox}+ : 3d{SUP[nd]}</text>
        {[0, 1, 2, 3, 4].map((j) => {
          const up = nd > j;
          const down = nd > j + 5;
          return (
            <g key={j}>
              <rect x={30 + j * 38} y={60} width={32} height={32} fill="#fff" stroke="#18443b" strokeWidth={1.8} />
              {up && <path d={`M ${30 + j * 38 + 10} 88 v -22 m -4 6 l 4 -6 l 4 6`} stroke="#c45e42" strokeWidth={2} fill="none" />}
              {down && <path d={`M ${30 + j * 38 + 22} 64 v 22 m -4 -6 l 4 6 l 4 -6`} stroke="#2563a8" strokeWidth={2} fill="none" />}
            </g>
          );
        })}
        <text x={115} y={112} fontSize={11} textAnchor="middle" fill="#4d5768">n = {o.unp} · μ = {fmt(o.mu!, 2)} BM</text>
        <text x={115} y={130} fontSize={10} textAnchor="middle" fill="#4d5768">{o.unp! > 0 ? 'paramagnetic' : 'diamagnetic'} · {colour}</text>
        <text x={115} y={150} fontSize={10} textAnchor="middle" fill={ok ? '#18443b' : '#c45e42'}>{ok ? 'state listed in the lesson table' : 'state not listed for this element'}</text>
        <text x={115} y={170} fontSize={9} textAnchor="middle" fill="#7c8595">4s electrons are removed before 3d</text>
        <line x1={235} y1={30} x2={235} y2={200} stroke="#e5e5e5" />
        <circle cx={315} cy={115} r={rad(106)} fill="none" stroke="#7c8595" strokeDasharray="3 3" />
        <circle cx={315} cy={115} r={rad(85)} fill="none" stroke="#7c8595" strokeDasharray="3 3" />
        <circle cx={315} cy={115} r={rad(o.r!)} fill="#c45e42" opacity={0.7} />
        <text x={315} y={20} fontSize={11} textAnchor="middle" fill="#18443b">{LN[v.k!]}³⁺ radius {fmt(o.r!, 1)} pm</text>
        <text x={315} y={186} fontSize={9} textAnchor="middle" fill="#7c8595">dashed: La³⁺ 106 pm and Lu³⁺ 85 pm</text>
        <text x={315} y={200} fontSize={9} textAnchor="middle" fill="#7c8595">4f electrons shield poorly</text>
      </g>
    );
  },
  discover: [
    'Select Fe and set the oxidation state to +2 and +3. How do the d count and the moment change?',
    'Set Mn to +7. How many d electrons are left, and what does that mean for the moment and the d–d colour?',
    'Slide the lanthanoid position from La to Lu and read the radius.',
  ],
  experiment: [
    'Keep +2 and move from Sc to Zn: where is the moment greatest, and why?',
    'For copper, compare +1 and +2: which is paramagnetic?',
    'Record the Ln³⁺ radius at three positions and fit a line.',
  ],
  understand: [
    'In an ion the 4s electrons go first: Fe is 3d⁶4s², so Fe²⁺ is 3d⁶ and Fe³⁺ is 3d⁵; Mn⁷⁺ and Sc³⁺ are 3d⁰.',
    'Unpaired d electrons give paramagnetism with μ = √(n(n+2)) BM; d⁰ and d¹⁰ ions are diamagnetic.',
    'A d–d colour needs a partly filled d subshell; d⁰ and d¹⁰ ions are colourless (MnO₄⁻ is purple by charge transfer, not d–d).',
    'The Ln³⁺ radius falls steadily from La to Lu (about 106 to 85 pm) because 4f electrons shield the nucleus poorly: the lanthanoid contraction.',
  ],
  preds: [
    {
      id: 'p1', title: 'Fe²⁺ to Fe³⁺', prompt: 'Iron(II) (3d⁶, 4 unpaired electrons, 4.90 BM) is oxidised to iron(III). What happens to the spin-only magnetic moment?',
      base: { z: 26, ox: 2 }, test: { ox: 3 }, options: ['It falls to 0', 'It rises to 5.92 BM', 'It stays 4.90 BM', 'It rises to 8 BM'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).mu!, [0.01, 5.92, 4.9, 8]),
      why: ({ base, test, outs }) => `Fe³⁺ is 3d⁵: five unpaired electrons, μ = √35 = 5.92 BM. Moment goes from ${fmt(outs(base).mu!, 2)} to ${fmt(outs(test).mu!, 2)} BM.`,
    },
    {
      id: 'p2', title: 'Mn²⁺ to Mn⁷⁺', prompt: 'Manganese goes from the +2 state (3d⁵) to the +7 state, as in permanganate. What is the spin-only moment of the metal centre?',
      base: { z: 25, ox: 2 }, test: { ox: 7 }, options: ['5.92 BM, unchanged', 'Zero: no d electrons remain', '1.73 BM', '8.0 BM'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).mu! + 0.01, [5.92, 0.01, 1.73, 8]),
      why: ({ base, test, outs }) => `All seven outer electrons (4s² 3d⁵) are removed, leaving 3d⁰ with no unpaired electron. μ goes from ${fmt(outs(base).mu!, 2)} to ${fmt(outs(test).mu!, 2)} BM. (MnO₄⁻ is still purple, by charge transfer, not by a d–d transition.)`,
    },
    {
      id: 'p3', title: 'Cu⁺ to Cu²⁺', prompt: 'Copper(I) (3d¹⁰) is oxidised to copper(II). What is the spin-only moment of copper(II)?',
      base: { z: 29, ox: 1 }, test: { ox: 2 }, options: ['0 BM, as before', '1.73 BM (one unpaired electron)', '2.83 BM', '5.92 BM'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).mu!, [0.01, 1.73, 2.83, 5.92]),
      why: ({ base, test, outs }) => `Cu²⁺ is 3d⁹ with one unpaired electron: μ = √3 = 1.73 BM. μ goes from ${fmt(outs(base).mu!, 2)} to ${fmt(outs(test).mu!, 2)} BM; Cu⁺ (d¹⁰) is diamagnetic and colourless.`,
    },
    {
      id: 'p4', title: 'Across the lanthanoids', prompt: 'Going from La³⁺ to Lu³⁺ the 4f subshell is filled. What happens to the ionic radius?',
      base: { k: 0 }, test: { k: 14 }, options: ['It increases by about 20 percent', 'It decreases from about 106 pm to about 85 pm', 'It stays the same', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).r! / outs(base).r!, [1.2, 0.8, 1, 2]),
      why: ({ base, test, outs }) => `4f electrons shield the growing nuclear charge poorly, so the outer electrons are pulled in. The radius goes from ${fmt(outs(base).r!, 0)} pm to ${fmt(outs(test).r!, 0)} pm (lanthanoid contraction).`,
    },
  ],
  measure: {
    instruction: 'Record the Ln³⁺ radius at three or more positions along the lanthanoid series (use the lanthanoid position slider). Plot radius against position.',
    vary: 'k',
    record: ['r', 'mu', 'nd'],
    fit: {
      xLabel: 'lanthanoid position (La = 0)',
      yLabel: 'radius (pm)',
      x: (v) => v.k!,
      y: (_v, o) => o.r!,
      interpret: (slope, intercept) =>
        `The points fall on a straight line of slope ${fmt(slope, 2)} pm per element: each added 4f electron shrinks the ion by about ${fmt(-slope, 1)} pm. The intercept ${fmt(intercept, 0)} pm is the La³⁺ radius, and over the 14 steps to Lu³⁺ the total contraction is ${fmt(-slope * 14, 0)} pm. (The lesson gives only the two end values; the straight line between them is a simplification.)`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The spin-only magnetic moment of Mn³⁺ (Mn is [Ar]3d⁵4s²) is', options: ['2.83 BM', '3.87 BM', '4.90 BM', '5.92 BM'], answer: 2,
      why: 'Mn³⁺ loses the 4s² electrons and one 3d electron: 3d⁴, four unpaired electrons, μ = √(4 × 6) = 4.90 BM.',
      verify: () => near(mu(unpOf(dOf(25, 3))), [2.83, 3.87, 4.9, 5.92]),
    },
    {
      id: 'q2', q: 'How many unpaired electrons does the Co²⁺ ion have (high spin free ion; Co is [Ar]3d⁷4s²)?', options: ['3', '1', '2', '4'], answer: 0,
      why: 'Co²⁺ is 3d⁷: five electrons singly in the five orbitals and two more pairing up, leaving 3 unpaired electrons (μ = 3.87 BM).',
      verify: () => near(unpOf(dOf(27, 2)), [3, 1, 2, 4]),
    },
    {
      id: 'q3', q: 'How many of Sc³⁺, Fe²⁺, Ti⁴⁺, Cu²⁺ and Zn²⁺ are colourless because they have no d–d transition (d⁰ or d¹⁰)?', options: ['1', '2', '3', '4'], answer: 2,
      why: 'Sc³⁺ (3d⁰), Ti⁴⁺ (3d⁰) and Zn²⁺ (3d¹⁰) are colourless; Fe²⁺ (3d⁶) and Cu²⁺ (3d⁹) are coloured.',
      verify: () => near([[21, 3], [26, 2], [22, 4], [29, 2], [30, 2]].filter(([z, o]) => [0, 10].includes(dOf(z!, o!))).length, [1, 2, 3, 4]),
    },
    {
      id: 'q4', q: 'Taking a straight-line contraction from La³⁺ (106 pm) to Lu³⁺ (85 pm) over 14 elements, the radius of Gd³⁺ (the 8th lanthanoid) is about', options: ['85 pm', '106 pm', '100 pm', '95.5 pm'], answer: 3,
      why: 'Each step lowers the radius by (106 − 85)/14 = 1.5 pm. Gd is 7 steps after La: 106 − 7 × 1.5 = 95.5 pm.',
      verify: () => near(rLn(7), [85, 106, 100, 95.5]),
    },
    {
      id: 'q5', q: 'The oxidation state of iron in K₃[Fe(CN)₆] is', options: ['+2', '+3', '+4', '+6'], answer: 1,
      why: 'The complex ion has charge −3 (three K⁺). x + 6(−1) = −3, so x = +3.',
      verify: () => near(-3 - 6 * -1, [2, 3, 4, 6]),
    },
  ],
};
