/**
 * Chapter lab: Biology, "Biotechnology: principles and processes of recombinant DNA technology", restriction digest, gel and PCR.
 * Model: a 6-bp site occurs once in 4^6 = 4096 bp of random DNA; n cuts of a linear DNA give n+1 fragments; fragments run
 * towards the anode and smaller ones run farther (distance falls by 10 mm per tenfold size, illustrative gel);
 * PCR copies = (1 + e)^n with e = 1 when the primers anneal (50 to 60 degrees C) and e falling outside it (illustrative).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'L', label: 'Length of the DNA to digest', unit: 'kb', min: 5, max: 50, step: 1, start: 20, digits: 0 },
  { id: 'sites', label: 'Restriction sites actually cut', unit: 'sites', min: 0, max: 8, step: 1, start: 3, digits: 0, integer: true },
  { id: 'cycles', label: 'PCR cycles', unit: 'cycles', min: 0, max: 35, step: 1, start: 25, digits: 0, integer: true },
  { id: 'Ta', label: 'Annealing temperature', unit: '°C', min: 40, max: 70, step: 1, start: 55, digits: 0, bounds: { min: 1, max: 120 } },
];
/** fragment sizes (bp) of a linear DNA cut at `sites` places */
export const fragments = (v: Values): number[] => {
  const cuts = Array.from({ length: Math.round(v.sites!) }, (_, i) => (0.17 + 0.618034 * (i + 1)) % 1).sort((a, b) => a - b);
  const edges = [0, ...cuts, 1];
  return edges.slice(1).map((e, i) => (e - edges[i]!) * v.L! * 1000);
};
const eff = (v: Values) => Math.max(0, Math.min(1, v.Ta! > 60 ? 1 - (v.Ta! - 60) / 10 : v.Ta! < 50 ? 1 - (50 - v.Ta!) / 20 : 1));
const dist = (bp: number) => Math.max(0, 10 * (5.5 - Math.log10(bp)));
const outs: OutDef[] = [
  { id: 'frag', label: 'Fragments after the digest', unit: 'fragments', fn: (v) => v.sites! + 1, digits: 0 },
  { id: 'expected', label: 'Sites expected in random DNA (L ÷ 4096 bp)', unit: 'sites', fn: (v) => (v.L! * 1000) / 4096, digits: 1 },
  { id: 'small', label: 'Smallest fragment (runs farthest)', unit: 'bp', fn: (v) => Math.min(...fragments(v)), digits: 0 },
  { id: 'e', label: 'Fraction of strands copied per cycle', unit: '', fn: eff, digits: 2 },
  { id: 'copies', label: 'Copies from one template molecule', unit: 'copies', fn: (v) => Math.pow(1 + eff(v), v.cycles!), sci: true, digits: 2 },
];

export const spec: Spec = {
  id: 'bio-biotechnology-principles',
  subject: 'Biology',
  lessonTitleStartsWith: 'Biotechnology: principles and processes',
  afterHeading: 'Amplification of gene by PCR',
  title: 'Digest, Gel and PCR Bench',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Cut DNA with a restriction enzyme and run the fragments on a gel, then amplify a target by PCR: set the number of cuts, the cycles and the annealing temperature and read the result.',
  can: ['Predict how many fragments a digest gives and where they run on a gel', 'See copies grow as 2^n and what breaks it', 'Fit the doubling per cycle from log(copies) against cycles'],
  minutes: 12,
  vars,
  outs,
  graphs: [
    { id: 'cp', title: 'Copies against PCR cycles', x: 'cycles', y: 'copies', logY: true },
    { id: 'ta', title: 'Copying efficiency against annealing temperature', x: 'Ta', y: 'e' },
    { id: 'fr', title: 'Smallest fragment against the number of cuts', x: 'sites', y: 'small', logY: true },
  ],
  sceneAlt: 'An agarose gel seen from above. Lane one is a size ladder, lane two shows the digest bands, whose number and position follow the cuts, and lane three shows the PCR product band whose brightness follows the number of copies.',
  scene: ({ v, o }) => {
    const sizes = fragments(v);
    const ladder = [10000, 5000, 2000, 1000, 500, 250];
    const lane = (x: number, bands: number[], op: (b: number) => number) =>
      bands.map((b, i) => <rect key={i} x={x} y={52 + dist(b) * 3.6 - 2} width={64} height={5} fill="#f0a35e" opacity={op(b)} />);
    const bright = Math.min(1, Math.log10(Math.max(1, o.copies!)) / 9);
    return (
      <g>
        <rect x={40} y={20} width={320} height={190} fill="#1e2a36" rx={4} />
        {[0, 1, 2].map((i) => <rect key={i} x={62 + i * 100} y={26} width={64} height={7} fill="#0e1620" />)}
        <path d="M30 20 V 214" stroke="#c45e42" strokeWidth={2} />
        <text x={14} y={30} fontSize={10} fill="#c45e42">−</text>
        <text x={14} y={210} fontSize={10} fill="#c45e42">+</text>
        {lane(62, ladder, () => 0.9)}
        {lane(162, sizes, () => 0.95)}
        <rect x={262} y={52 + dist(500) * 3.6 - 2} width={64} height={5} fill="#f0a35e" opacity={0.05 + 0.95 * bright} />
        <text x={94} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">ladder</text>
        <text x={194} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">{o.frag} fragments</text>
        <text x={294} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">PCR: {fmt(o.copies!, 1, true)}</text>
        {ladder.map((b, i) => <text key={i} x={56} y={52 + dist(b) * 3.6 + 3} fontSize={8} textAnchor="end" fill="#aab2bd">{b >= 1000 ? b / 1000 + 'k' : b}</text>)}
      </g>
    );
  },
  discover: [
    'Add restriction sites. The number of bands on the gel is always one more than the number of cuts, and the smaller pieces run farther toward the anode.',
    'Raise the number of PCR cycles. Read the product band brightness and the copies.',
    'Move the annealing temperature out of the 50 to 60 degree range: the primers no longer bind well.',
  ],
  experiment: [
    'Keep the temperature at 55 degrees. How many cycles does it take to make a thousand copies? A million?',
    'At 65 degrees, how much does the copy number fall compared with 55 degrees at the same cycles?',
    'With random DNA a 6-base site occurs once in 4096 bp. How many sites are expected in 20 kb? Does that match your slider?',
  ],
  understand: [
    'A restriction enzyme cuts only at its palindromic recognition sequence; a 6-bp site occurs on average once in 4^6 = 4096 bp.',
    'DNA is negatively charged, so the fragments run to the anode and smaller ones travel farther through the gel.',
    'Each PCR cycle (denaturation about 94 degrees, annealing 50 to 60 degrees, extension) doubles the DNA, so one molecule gives 2^n copies.',
    'Primers that cannot anneal stop the doubling: the amplification is exponential only while every cycle copies the strands.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Ten more cycles', prompt: 'The PCR is run for 30 cycles instead of 20 (annealing at 55 degrees). By about what factor does the number of copies rise?',
      base: { cycles: 20, Ta: 55 }, test: { cycles: 30 },
      labels: ['About 100 times', 'About a million times', 'About 10 times', 'About 1000 times'], vals: [100, 1e6, 10, 1000], f: (o) => o.copies!,
      why: ({ base, test, outs: oo }) => `Ten more doublings multiply the copies by 2^10 = 1024: ${fmt(oo(base).copies!, 2, true)} becomes ${fmt(oo(test).copies!, 2, true)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Annealing too warm', prompt: 'The annealing temperature is raised from 55 to 65 degrees (25 cycles). What happens to the copies made?',
      base: { cycles: 25, Ta: 55 }, test: { Ta: 65 },
      labels: ['They stay about the same', 'They fall to about one half', 'They fall to about one thousandth', 'They fall to about one millionth'], vals: [1, 0.5, 0.001, 1e-6], f: (o) => o.copies!,
      why: ({ base, test, outs: oo }) => `At 65 degrees the primers anneal poorly, so each cycle copies only about half the strands: copies go from ${fmt(oo(base).copies!, 2, true)} to ${fmt(oo(test).copies!, 2, true)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'More cuts', prompt: 'The enzyme now cuts the linear DNA at 6 sites instead of 3. How does the number of fragments change?',
      base: { sites: 3 }, test: { sites: 6 },
      labels: ['It rises by 6', 'It rises by 4', 'It rises by 3', 'It stays the same'], vals: [6, 4, 3, 0], f: (o) => o.frag!, mode: 'diff',
      why: ({ base, test, outs: oo }) => `A linear DNA cut at n sites gives n + 1 fragments: ${oo(base).frag} becomes ${oo(test).frag}, three more.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Longer DNA', prompt: 'A random DNA twice as long (10 kb to 20 kb) is digested. How does the number of sites expected from the 4096 bp rule change?',
      base: { L: 10 }, test: { L: 20 },
      labels: ['It halves', 'It stays the same', 'It becomes four times as large', 'It doubles'], vals: [0.5, 1, 4, 2], f: (o) => o.expected!,
      why: ({ base, test, outs: oo }) => `A site occurs once per 4096 bp on average, so the expected number is proportional to length: ${fmt(oo(base).expected!, 1)} becomes ${fmt(oo(test).expected!, 1)}.`,
    }),
  ],
  measure: {
    instruction: 'Keep the temperature at 55 degrees (the primers anneal). Record the copies from one template for at least three different numbers of cycles.',
    vary: 'cycles',
    record: ['copies', 'e'],
    fit: {
      xLabel: 'cycles n',
      yLabel: 'log₂(copies)',
      x: (v) => v.cycles!,
      y: (_v, o) => Math.log2(o.copies!),
      interpret: (slope, intercept) => `log₂(copies) against n is a straight line. The slope is ${fmt(slope, 2)} doublings per cycle (copies = 2^n when the slope is 1; the fraction copied per cycle is 2^slope − 1 = ${fmt(Math.pow(2, slope) - 1, 2)}) and the intercept ${fmt(intercept, 2)} is log₂ of the starting number of molecules (1 molecule gives 0).`,
    },
  },
  questions: [
    mkQ('q1', 'How many EcoRI (six-base) recognition sites are expected on average in 20 480 bp of random DNA?', ['5', '4', '20', '50'], [5, 4, 20, 50], () => 20480 / 4096,
      'A six-base site has 4^6 = 4096 possible sequences, so it occurs once in 4096 bp on average. 20 480 ÷ 4096 = 5 sites.'),
    mkQ('q2', 'One DNA molecule is amplified for 30 PCR cycles. About how many copies are made?', ['6.0 × 10²', '1.0 × 10⁶', '1.1 × 10⁹', '3.0 × 10¹'], [600, 1e6, 1.07e9, 30], () => Math.pow(2, 30),
      'The DNA doubles each cycle, so one molecule gives 2^n copies: 2^30 ≈ 1.07 × 10⁹.'),
    mkQ('q3', 'A circular plasmid has three EcoRI sites and is cut at all of them. How many fragments result?', ['4', '2', '3', '6'], [4, 2, 3, 6], () => 3,
      'A circle cut at n places gives n fragments (a linear molecule would give n + 1), so 3 sites give 3 fragments.'),
    mkQ('q4', 'On a gel the distance run falls by 10 mm for every tenfold increase in fragment size. How much farther does a 1000 bp fragment run than a 10 000 bp fragment?', ['5 mm', '20 mm', '10 mm', '30 mm'], [5, 20, 10, 30], () => dist(1000) - dist(10000),
      'Smaller fragments move farther. 10 000 bp is ten times 1000 bp, so the 1000 bp fragment runs 10 mm farther.'),
    mkQ('q5', 'From one starting molecule, what is the smallest number of whole PCR cycles that gives at least 1000 copies?', ['8', '12', '100', '10'], [8, 12, 100, 10], () => Math.ceil(Math.log2(1000)),
      '2^9 = 512 is too few and 2^10 = 1024 is at least 1000, so 10 cycles are needed.'),
  ],
};
