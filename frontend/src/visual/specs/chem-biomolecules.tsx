/**
 * Chapter lab: Chemistry, Unit X "Biomolecules", section Amino acids (zwitterion, isoelectric point, peptide bond).
 * From the lesson: zwitterion, cation in acid / anion in alkali, isoelectric point (net charge zero), peptide bond rules: n residues give
 * n - 1 peptide bonds, mass = sum of residues - 18 per water lost, molar masses glycine 75 and alanine 89, n! orderings of n different residues.
 * NOT in the lesson (textbook values, to be checked by an expert): the pKa values below and the molar masses of Asp (133) and Lys (146).
 * Net charge = sum over basic groups of 1/(1+10^(pH-pKa)) minus sum over acidic groups of 1/(1+10^(pKa-pH)). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { near } from './chem2-kit';

interface AA { name: string; kind: string; mass: number; acid: number[]; base: number[] }
// acid: pKa of groups that are neutral (COOH) when protonated and -1 when deprotonated; base: pKa of groups that are +1 when protonated (NH3+)
const AAS: AA[] = [
  { name: 'glycine (neutral)', kind: 'neutral', mass: 75, acid: [2.34], base: [9.6] },
  { name: 'alanine (neutral)', kind: 'neutral', mass: 89, acid: [2.34], base: [9.69] },
  { name: 'aspartic acid (acidic)', kind: 'acidic', mass: 133, acid: [1.88, 3.65], base: [9.6] },
  { name: 'lysine (basic)', kind: 'basic', mass: 146, acid: [2.18], base: [8.95, 10.53] },
];
const charge = (a: number, pH: number) => {
  const m = AAS[a]!;
  return m.base.reduce((s, p) => s + 1 / (1 + 10 ** (pH - p)), 0) - m.acid.reduce((s, p) => s + 1 / (1 + 10 ** (p - pH)), 0);
};
const pIOf = (a: number) => { let lo = 0; let hi = 14; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (charge(a, mid) > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
const massOf = (a: number, n: number) => AAS[a]!.mass * n - 18 * (n - 1);
function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1);
}

export const spec: Spec = {
  id: 'chem-biomolecules',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Biomolecules',
  afterHeading: 'Amino acids and their classifications',
  title: 'Amino Acid Charge and Peptide Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Pick a neutral, acidic or basic amino acid, change the pH and watch its net charge, its zwitterion and its isoelectric point. Then join n residues by peptide bonds and see the number of bonds, the water lost and the molar mass.',
  can: ['Find the isoelectric point where the net charge is zero', 'See which way an amino acid moves in an electric field at a given pH', 'Count peptide bonds and compute the molar mass of a peptide'],
  minutes: 10,
  vars: [
    { id: 'a', label: 'Amino acid (0 glycine, 1 alanine, 2 aspartic acid, 3 lysine)', unit: '', min: 0, max: 3, step: 1, start: 0, digits: 0 },
    { id: 'pH', label: 'pH of the solution', unit: '', min: 0, max: 14, step: 0.25, start: 7, digits: 2 },
    { id: 'n', label: 'Amino acid residues in the peptide n', unit: '', min: 1, max: 10, step: 1, start: 3, digits: 0 },
  ],
  outs: [
    { id: 'q', label: 'Net charge of the amino acid', unit: '', fn: (v) => charge(v.a!, v.pH!), digits: 2 },
    { id: 'pI', label: 'Isoelectric point (pH of zero net charge)', unit: '', fn: (v) => pIOf(v.a!), digits: 2 },
    { id: 'bonds', label: 'Peptide bonds = n − 1 (also water molecules lost)', unit: '', fn: (v) => v.n! - 1, digits: 0 },
    { id: 'M', label: 'Molar mass of the peptide = n × M(residue) − 18(n − 1)', unit: 'g/mol', fn: (v) => massOf(v.a!, v.n!), digits: 0 },
    { id: 'seq', label: 'Orderings if the n residues were all different (n!)', unit: '', fn: (v) => fact(v.n!), digits: 0 },
  ],
  graphs: [
    { id: 'q-pH', title: 'Net charge against pH', x: 'pH', y: 'q' },
    { id: 'M-n', title: 'Peptide molar mass against number of residues', x: 'n', y: 'M' },
    { id: 'q-a', title: 'Net charge at this pH for each amino acid', x: 'a', y: 'q' },
  ],
  sceneAlt: 'The amino group and carboxyl group of the chosen amino acid drawn protonated or deprotonated according to the pH, an arrow showing movement towards the cathode, anode or neither, and a chain of n residue beads joined by peptide bonds.',
  scene: ({ v, o }) => {
    const m = AAS[v.a!]!;
    const amino = 1 / (1 + 10 ** (v.pH! - m.base[0]!)) > 0.5;
    const carboxylate = 1 / (1 + 10 ** (m.acid[0]! - v.pH!)) > 0.5;
    const side = m.kind === 'acidic' ? (1 / (1 + 10 ** (m.acid[1]! - v.pH!)) > 0.5 ? '−' : '0') : m.kind === 'basic' ? (1 / (1 + 10 ** (v.pH! - m.base[1]!)) > 0.5 ? '+' : '0') : '';
    const dir = o.q! > 0.15 ? 'toward the cathode (−)' : o.q! < -0.15 ? 'toward the anode (+)' : 'does not move';
    const beads = Math.round(v.n!);
    return (
      <g>
        <text x={200} y={16} fontSize={11} textAnchor="middle" fill="#18443b">{m.name} at pH {fmt(v.pH!, 2)}: net charge {fmt(o.q!, 2)}</text>
        <circle cx={150} cy={70} r={14} fill="#18443b" />
        <text x={150} y={74} fontSize={10} textAnchor="middle" fill="#fff">Cα</text>
        <line x1={136} y1={70} x2={100} y2={70} stroke="#7c8595" strokeWidth={2} />
        <rect x={62} y={58} width={38} height={24} rx={6} fill={amino ? '#2563a8' : '#c9d3dc'} />
        <text x={81} y={74} fontSize={11} textAnchor="middle" fill={amino ? '#fff' : '#18443b'}>{amino ? 'NH₃⁺' : 'NH₂'}</text>
        <line x1={164} y1={70} x2={200} y2={70} stroke="#7c8595" strokeWidth={2} />
        <rect x={200} y={58} width={46} height={24} rx={6} fill={carboxylate ? '#c45e42' : '#c9d3dc'} />
        <text x={223} y={74} fontSize={11} textAnchor="middle" fill={carboxylate ? '#fff' : '#18443b'}>{carboxylate ? 'COO⁻' : 'COOH'}</text>
        {m.kind !== 'neutral' && (
          <g>
            <line x1={150} y1={84} x2={150} y2={110} stroke="#7c8595" strokeWidth={2} />
            <rect x={122} y={110} width={56} height={22} rx={6} fill={side === '−' ? '#c45e42' : side === '+' ? '#2563a8' : '#c9d3dc'} />
            <text x={150} y={125} fontSize={10} textAnchor="middle" fill={side === '0' ? '#18443b' : '#fff'}>{m.kind === 'acidic' ? (side === '−' ? 'R: COO⁻' : 'R: COOH') : side === '+' ? 'R: NH₃⁺' : 'R: NH₂'}</text>
          </g>
        )}
        <path d={o.q! > 0.15 ? 'M 290 70 H 365 m -8 -5 l 8 5 l -8 5' : o.q! < -0.15 ? 'M 365 70 H 290 m 8 -5 l -8 5 l 8 5' : 'M 320 60 v 20 M 335 60 v 20'} stroke="#18443b" strokeWidth={2.2} fill="none" />
        <text x={328} y={50} fontSize={10} textAnchor="middle" fill="#4d5768">electric field</text>
        <text x={328} y={96} fontSize={10} textAnchor="middle" fill="#4d5768">{dir}</text>
        <text x={200} y={160} fontSize={10} textAnchor="middle" fill="#4d5768">peptide of {beads} residue{beads > 1 ? 's' : ''}: {beads - 1} peptide bond{beads === 2 ? '' : 's'}, {fmt(o.M!, 0)} g/mol</text>
        {Array.from({ length: beads }, (_, k) => {
          const x = 200 + (k - (beads - 1) / 2) * 32;
          return (
            <g key={k}>
              {k > 0 && <line x1={x - 32 + 10} y1={188} x2={x - 10} y2={188} stroke="#c45e42" strokeWidth={3} />}
              <circle cx={x} cy={188} r={10} fill="#18443b" />
            </g>
          );
        })}
      </g>
    );
  },
  discover: [
    'Slide the pH from 0 to 14 for glycine. At what pH is the net charge zero, and what does the molecule look like there?',
    'Change to aspartic acid and then lysine. How do their isoelectric points compare with that of glycine?',
    'Raise the number of residues and watch the bonds and the molar mass.',
  ],
  experiment: [
    'Find the pH at which glycine does not move in the electric field and compare it with the isoelectric point reading.',
    'At pH 7 compare the net charge of glycine, aspartic acid and lysine. Why do they differ?',
    'Record the peptide molar mass for three chain lengths and fit a straight line.',
  ],
  understand: [
    'In acid an amino acid is a cation, in alkali an anion; at the isoelectric point its net charge is zero and it does not move in an electric field.',
    'Acidic amino acids (extra COOH) have a low isoelectric point and basic ones (extra amino group) a high one; neutral ones lie near 6.',
    'A peptide of n residues has n − 1 peptide bonds and loses n − 1 molecules of water, so M = n × M(residue) − 18(n − 1).',
    'The sequence matters: n different residues can be ordered in n! ways.',
  ],
  preds: [
    {
      id: 'p1', title: 'From acid to alkali', prompt: 'The pH of a glycine solution is raised from 2 to 12. What happens to its net charge?',
      base: { a: 0, pH: 2 }, test: { pH: 12 }, options: ['It stays positive', 'It goes from positive, through zero near pH 6, to negative', 'It stays zero throughout', 'It goes from negative to positive'], answer: 1,
      verify: ({ base, test, outs }) => (outs(base).q! > 0.3 && outs(test).q! < -0.3 ? 1 : outs(test).q! > 0.3 ? 0 : outs(base).q! < -0.3 ? 3 : 2),
      why: ({ base, test, outs }) => `In acid the −NH₂ group is protonated and the −COOH only partly ionised (cation); in alkali the −NH₃⁺ loses its proton and the carboxylate remains (anion). Net charge goes from ${fmt(outs(base).q!, 2)} to ${fmt(outs(test).q!, 2)}.`,
    },
    {
      id: 'p2', title: 'At the isoelectric point', prompt: 'Glycine solution at pH 3 is adjusted to pH 6 (close to its isoelectric point). What is the net charge at pH 6?',
      base: { a: 0, pH: 3 }, test: { pH: 6 }, options: ['About +1', 'About zero (zwitterion)', 'About −1', 'About −2'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).q! + 3, [4, 3, 2, 1]),
      why: ({ base, test, outs }) => `At the isoelectric point (about pH ${fmt(outs(test).pI!, 2)}) the molecule is the zwitterion R–CH(NH₃⁺)–COO⁻ with equal positive and negative charge. Net charge goes from ${fmt(outs(base).q!, 2)} to ${fmt(outs(test).q!, 2)}.`,
    },
    {
      id: 'p3', title: 'Acidic amino acid at pH 7', prompt: 'At pH 7 glycine is about neutral. Glycine is replaced by aspartic acid (an extra COOH side chain) at the same pH. What is the net charge now?',
      base: { a: 0, pH: 7 }, test: { a: 2 }, options: ['About zero', 'About +1', 'About −1', 'About +2'], answer: 2,
      verify: ({ test, outs }) => near(outs(test).q! + 3, [3, 4, 2, 5]),
      why: ({ base, test, outs }) => `The extra carboxyl group is ionised (COO⁻) at pH 7 because pH is far above its pKa, so the molecule carries one more negative charge. Net charge goes from ${fmt(outs(base).q!, 2)} to ${fmt(outs(test).q!, 2)}; its isoelectric point (${fmt(outs(test).pI!, 2)}) is far below 7.`,
    },
    {
      id: 'p4', title: 'Longer peptide', prompt: 'A peptide of glycine residues grows from 3 to 6 residues. By how much does its molar mass increase?',
      base: { a: 0, n: 3 }, test: { n: 6 }, options: ['It doubles exactly', 'By 171 g/mol (3 × (75 − 18))', 'By 225 g/mol (3 × 75)', 'It does not change'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).M! - outs(base).M!, [outs(base).M!, 171, 225, 0.001]),
      why: ({ base, test, outs }) => `Each extra residue adds its mass minus the 18 g/mol of water lost on forming its peptide bond: 75 − 18 = 57. Mass goes from ${fmt(outs(base).M!, 0)} to ${fmt(outs(test).M!, 0)} g/mol, a rise of ${fmt(outs(test).M! - outs(base).M!, 0)}.`,
    },
  ],
  measure: {
    instruction: 'Choose an amino acid (try glycine). Record the molar mass of the peptide for at least three different numbers of residues n. Plot M against n.',
    vary: 'n',
    record: ['bonds', 'M', 'seq'],
    fit: {
      xLabel: 'residues n',
      yLabel: 'M (g/mol)',
      x: (v) => v.n!,
      y: (_v, o) => o.M!,
      interpret: (slope, intercept, v) =>
        `M = n(M − 18) + 18 is a straight line. The slope ${fmt(slope, 0)} g/mol is the mass of one residue (amino acid mass ${AAS[v.a!]!.mass} minus the water lost: ${AAS[v.a!]!.mass} − 18 = ${AAS[v.a!]!.mass - 18}); the intercept ${fmt(intercept, 0)} is the one water molecule that stays at the ends of the chain.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Molar masses: glycine 75, alanine 89. What is the molar mass of the tripeptide Gly-Ala-Ala?', options: ['217', '235', '253', '203'], answer: 0,
      why: 'Sum of residues = 75 + 89 + 89 = 253. Two peptide bonds lose two water molecules: 253 − 36 = 217 g/mol.',
      verify: () => near(75 + 89 + 89 - 2 * 18, [217, 235, 253, 203]),
    },
    {
      id: 'q2', q: 'A polypeptide is built from 12 amino acids. The number of peptide bonds in it is', options: ['10', '12', '11', '13'], answer: 2,
      why: 'n amino acids joined in a chain make n − 1 peptide bonds: 12 − 1 = 11.',
      verify: () => near(12 - 1, [10, 12, 11, 13]) === 2 ? 2 : 0,
    },
    {
      id: 'q3', q: 'Alanine has pKa(COOH) = 2.34 and pKa(NH₃⁺) = 9.69. Its isoelectric point is about', options: ['5.0', '7.0', '12.0', '6.0'], answer: 3,
      why: 'The zwitterion lies between the two pKa values, so pI = (2.34 + 9.69)/2 = 6.02.',
      verify: () => near(pIOf(1), [5.0, 7.0, 12.0, 6.0]),
    },
    {
      id: 'q4', q: 'How many different tetrapeptides can be formed from four different amino acids, each used once?', options: ['4', '24', '16', '12'], answer: 1,
      why: 'The order matters: 4! = 4 × 3 × 2 × 1 = 24.',
      verify: () => near(fact(4), [4, 24, 16, 12]),
    },
    {
      id: 'q5', q: 'In an electric field at pH 1, glycine (isoelectric point about 6) moves towards', options: ['the anode (+)', 'the cathode (−)', 'neither electrode', 'both electrodes equally'], answer: 1,
      why: 'Far below its isoelectric point glycine is a cation (−NH₃⁺ and mostly protonated −COOH), so it moves towards the negative electrode, the cathode.',
      verify: () => (charge(0, 1) > 0.15 ? 1 : charge(0, 1) < -0.15 ? 0 : 2),
    },
  ],
};
