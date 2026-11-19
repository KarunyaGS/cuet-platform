/**
 * Chapter lab: Biology, "Molecular basis of inheritance", semiconservative replication (Meselson and Stahl) and the replication fork.
 * Model: n generations in 14N give 2^n molecules, always 2 hybrid; each fork copies genome/(2 x origins) base pairs on each strand;
 * the lagging strand is made in Okazaki fragments of a chosen length; time = distance / fork speed (speeds are illustrative).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'gen', label: 'Generations in 14N medium (after 15N)', unit: 'generations', min: 0, max: 6, step: 1, start: 3, digits: 0 },
  { id: 'genome', label: 'Genome length', unit: 'Mb', min: 1, max: 10, step: 0.1, start: 4.6, digits: 1 },
  { id: 'origins', label: 'Origins of replication (each makes two forks)', unit: 'origins', min: 1, max: 10, step: 1, start: 1, digits: 0 },
  { id: 'frag', label: 'Okazaki fragment length', unit: 'bp', min: 500, max: 3000, step: 100, start: 1500, digits: 0 },
  { id: 'speed', label: 'Fork speed (illustrative)', unit: 'bp/s', min: 200, max: 1000, step: 50, start: 500, digits: 0 },
];
const D = (v: Values) => (v.genome! * 1e6) / (2 * v.origins!); // bp copied by one fork on each strand
const outs: OutDef[] = [
  { id: 'mol', label: 'DNA molecules after the generations', unit: 'molecules', fn: (v) => Math.pow(2, v.gen!), digits: 0 },
  { id: 'hyb', label: 'Hybrid (15N/14N) share of the molecules', unit: '%', fn: (v) => (v.gen! === 0 ? 0 : (200 / Math.pow(2, v.gen!))), digits: 1 },
  { id: 'okf', label: 'Okazaki fragments made by one fork', unit: 'fragments', fn: (v) => D(v) / v.frag!, digits: 0 },
  { id: 'okt', label: 'Okazaki fragments for the whole genome', unit: 'fragments', fn: (v) => (v.genome! * 1e6) / v.frag!, digits: 0 },
  { id: 'time', label: 'Time to copy the genome', unit: 'min', fn: (v) => D(v) / v.speed! / 60, digits: 1 },
];

export const spec: Spec = {
  id: 'bio-molecular-basis',
  subject: 'Biology',
  lessonTitleStartsWith: 'Molecular basis of inheritance',
  afterHeading: "Replication of DNA: Meselson and Stahl's experiment",
  title: 'Replication Fork and Meselson-Stahl Lab',
  format: 'Virtual experiment · counting',
  blurb: 'Grow bacteria in heavy nitrogen, move them to light nitrogen and read the density bands generation by generation, then zoom into one replication fork and count its Okazaki fragments.',
  can: ['Show why replication is semiconservative with the caesium chloride bands', 'Count Okazaki fragments on the lagging strand for a chosen fragment length', 'Recover the length copied by a fork from a straight-line fit'],
  minutes: 12,
  vars,
  outs,
  graphs: [
    { id: 'mol', title: 'DNA molecules against generations', x: 'gen', y: 'mol', logY: true },
    { id: 'okf', title: 'Okazaki fragments per fork against fragment length', x: 'frag', y: 'okf' },
    { id: 'time', title: 'Time to copy the genome against number of origins', x: 'origins', y: 'time' },
  ],
  sceneAlt: 'On the left a replication fork: the parental DNA opens, the leading strand is made in one piece and the lagging strand in short Okazaki fragments whose number follows the slider. On the right a centrifuge tube with heavy, hybrid and light DNA bands whose widths follow the generations.',
  scene: ({ v, o }) => {
    const n = Math.max(2, Math.min(10, Math.round(o.okf! / 80)));
    const gen = v.gen!;
    const light = gen === 0 ? 0 : 100 - o.hyb!;
    const heavy = gen === 0 ? 100 : 0;
    const hyb = gen === 0 ? 0 : o.hyb!;
    const band = (y: number, share: number, col: string, lab: string) => (
      <g>
        <rect x={290} y={y} width={60} height={Math.max(0, 3 + (share / 100) * 22)} fill={col} opacity={share > 0 ? 0.9 : 0.1} />
        <text x={354} y={y + 8} fontSize={9} fill="#4d5768">{lab} {fmt(share, 0)}%</text>
      </g>
    );
    return (
      <g>
        <path d="M20 90 L130 112" stroke="#18443b" strokeWidth={3} />
        <path d="M20 134 L130 112" stroke="#18443b" strokeWidth={3} />
        <path d="M130 112 L215 60 H 245" stroke="#7c8595" strokeWidth={3} fill="none" />
        <path d="M130 112 L215 164 H 245" stroke="#7c8595" strokeWidth={3} fill="none" />
        <path d="M130 100 L215 52 H 245" stroke="#c45e42" strokeWidth={3} fill="none" />
        {Array.from({ length: n }, (_, i) => {
          const w = Math.min(34, 200 / n);
          const x = 130 + (i * (230 - 130)) / n;
          return <line key={i} x1={x + 2} x2={x + w - 2} y1={172 + (i % 2) * 6} y2={172 + (i % 2) * 6} stroke="#2563a8" strokeWidth={3} />;
        })}
        <text x={30} y={80} fontSize={10} fill="#18443b">parental DNA</text>
        <text x={200} y={46} fontSize={10} fill="#c45e42">leading strand (continuous)</text>
        <text x={150} y={198} fontSize={10} fill="#2563a8">lagging strand: {fmt(o.okf!, 0)} Okazaki fragments per fork</text>
        <rect x={285} y={22} width={70} height={110} fill="none" stroke="#18443b" rx={8} />
        {band(34, heavy, '#7a2d2d', 'heavy')}
        {band(66, hyb, '#8a6bb8', 'hybrid')}
        {band(98, light, '#d8a24a', 'light')}
        <text x={320} y={146} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.mol!, 0)} molecules</text>
      </g>
    );
  },
  discover: [
    'Move the generations slider. Which band is present at generation 0, at generation 1, and at later generations?',
    'Change the fragment length. How does the number of Okazaki fragments per fork respond?',
    'Add origins of replication. What happens to the time needed to copy the genome?',
  ],
  experiment: [
    'At 1 generation every molecule is hybrid. At 3 generations what share is hybrid, and what share is light?',
    'Keep the genome the same and double the fork speed. Does the number of Okazaki fragments change?',
    'Set the genome to 2 Mb and 4 Mb: how does the total number of Okazaki fragments change?',
  ],
  understand: [
    'Replication is semiconservative: each daughter DNA has one parental and one new strand, so the 15N strands always stay in just two hybrid molecules.',
    'DNA polymerase adds nucleotides only in the 5\' to 3\' direction, so one strand (leading) is continuous and the other (lagging) is made in Okazaki fragments joined by ligase.',
    'The number of Okazaki fragments is the length copied divided by the fragment length.',
    'More origins mean shorter distances per fork, so replication finishes sooner.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Three generations', prompt: 'After the shift from 15N to 14N, the hybrid share of the DNA is read at 1 generation (100 percent) and again at 3 generations. What is it at 3 generations?',
      base: { gen: 1 }, test: { gen: 3 },
      labels: ['50 percent', '12.5 percent', '25 percent', '100 percent'], vals: [50, 12.5, 25, 100], f: (o) => o.hyb!, mode: 'value',
      why: ({ test, outs: oo }) => `After 3 generations there are 8 molecules and the two original heavy strands are in just 2 hybrid molecules: ${fmt(oo(test).hyb!, 1)} percent hybrid, the rest light.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Longer fragments', prompt: 'The Okazaki fragments are made twice as long (1000 bp to 2000 bp). What happens to the number of fragments per fork?',
      base: { frag: 1000 }, test: { frag: 2000 },
      labels: ['It doubles', 'It stays the same', 'It halves', 'It falls to a quarter'], vals: [2, 1, 0.5, 0.25], f: (o) => o.okf!,
      why: ({ base, test, outs: oo }) => `Fragments per fork = length copied ÷ fragment length: ${fmt(oo(base).okf!, 0)} becomes ${fmt(oo(test).okf!, 0)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'A second origin', prompt: 'A genome that had one origin of replication gets two origins (same fork speed). What happens to the time to copy the genome?',
      base: { origins: 1 }, test: { origins: 2 },
      labels: ['It stays the same', 'It doubles', 'It falls to a quarter', 'It halves'], vals: [1, 2, 0.25, 0.5], f: (o) => o.time!,
      why: ({ base, test, outs: oo }) => `Each fork now has half the distance to travel: ${fmt(oo(base).time!, 1)} minutes becomes ${fmt(oo(test).time!, 1)} minutes.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Bigger genome', prompt: 'The genome doubles from 2.3 Mb to 4.6 Mb (one origin, 1500 bp fragments). What happens to the total number of Okazaki fragments?',
      base: { genome: 2.3, origins: 1 }, test: { genome: 4.6 },
      labels: ['It stays the same', 'It becomes four times as large', 'It halves', 'It doubles'], vals: [1, 4, 0.5, 2], f: (o) => o.okt!,
      why: ({ base, test, outs: oo }) => `Total fragments = genome length ÷ fragment length, so doubling the genome doubles the count: ${fmt(oo(base).okt!, 0)} becomes ${fmt(oo(test).okt!, 0)}.`,
    }),
  ],
  measure: {
    instruction: 'Keep the genome, the origins and the fork speed fixed. Record the Okazaki fragments made by one fork for at least three different fragment lengths.',
    vary: 'frag',
    record: ['okf', 'okt', 'time'],
    fit: {
      xLabel: '1 / fragment length (1/bp)',
      yLabel: 'fragments per fork',
      x: (v) => 1 / v.frag!,
      y: (_v, o) => o.okf!,
      interpret: (slope, _i, v) => `Fragments per fork against 1/(fragment length) is a straight line through the origin. The slope is the length one fork copies, ${fmt(slope, 0)} bp; with ${v.origins} origin(s) that means a genome of ${fmt((slope * 2 * v.origins!) / 1e6, 2)} Mb.`,
    },
  },
  questions: [
    mkQ('q1', 'A single 15N/15N DNA molecule is shifted to 14N medium and allowed to replicate for 3 generations. How many of the 8 molecules are light (14N/14N)?', ['2', '6', '4', '8'], [2, 6, 4, 8], () => Math.pow(2, 3) - 2,
      'Two molecules (one with each original strand) are hybrid; the other 8 − 2 = 6 are light.'),
    mkQ('q2', 'E. coli has 4.6 × 10⁶ base pairs and the distance between base pairs is 0.34 nm. What is the length of its DNA if stretched?', ['0.156 mm', '15.6 mm', '1.56 mm', '156 mm'], [0.156, 15.6, 1.56, 156], () => 4.6e6 * 0.34e-9 * 1000,
      'Length = 4.6 × 10⁶ × 0.34 × 10⁻⁹ m = 1.56 × 10⁻³ m = 1.56 mm.'),
    mkQ('q3', 'A replication fork copies 2 300 000 bp and the lagging strand is made in fragments of 1500 bp. About how many Okazaki fragments does that fork make?', ['1533', '230', '15 300', '3067'], [1533, 230, 15300, 3067], () => 2300000 / 1500,
      'Fragments = 2 300 000 ÷ 1500 ≈ 1533.'),
    mkQ('q4', 'After 4 generations in 14N medium, what percentage of the DNA molecules is light (14N/14N)?', ['87.5', '75', '50', '93.75'], [87.5, 75, 50, 93.75], () => (100 * (16 - 2)) / 16,
      '4 generations give 2⁴ = 16 molecules, 2 hybrid and 14 light: 14/16 = 87.5 percent.'),
    mkQ('q5', 'A gene\'s coding region, including the stop codon, is 900 bases long. How many amino acids does its polypeptide have?', ['300', '299', '900', '450'], [300, 299, 900, 450], () => 900 / 3 - 1,
      'Three bases make one codon, so there are 900/3 = 300 codons. The last is a stop codon that codes for no amino acid, so the polypeptide has 299 amino acids.'),
  ],
};
