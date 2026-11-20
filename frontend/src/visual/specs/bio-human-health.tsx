/**
 * Chapter lab: Biology, "Human health and disease", acquired immunity: primary and secondary (anamnestic) response, vaccination.
 * Model (illustrative numbers, shape from the lesson): the first exposure gives a LOW response that rises over about 10 days;
 * antibodies then fall with a half-life; a second exposure meets memory cells and gives a much more intense, faster response.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ, pathOf } from './_bio-util';

const K = 2; // titre units per unit of antigen dose in a primary response
const TP1 = 10; // days to the primary peak
const TP2 = 4; // days to the secondary peak (memory cells respond faster)
const vars: VarDef[] = [
  { id: 'dose', label: 'First antigen dose', unit: 'units', min: 1, max: 100, step: 1, start: 20, digits: 0, bounds: { min: 0.001, max: 1000000.0 } },
  { id: 'gap', label: 'Days until the second exposure', unit: 'days', min: 20, max: 200, step: 5, start: 60, digits: 0 },
  { id: 'dose2', label: 'Second antigen dose', unit: 'units', min: 1, max: 100, step: 1, start: 20, digits: 0, bounds: { min: 0.001, max: 1000000.0 } },
  { id: 'boost', label: 'Memory boost of the second response', unit: '×', min: 2, max: 50, step: 1, start: 10, digits: 0 },
  { id: 'half', label: 'Antibody half-life', unit: 'days', min: 10, max: 60, step: 1, start: 25, digits: 0 },
];
/** a response that starts at s, peaks at amplitude a after tp days, then decays with half-life h */
const resp = (t: number, s: number, tp: number, a: number, h: number) => {
  const u = t - s;
  if (u <= 0) return 0;
  return u < tp ? a * Math.sin((Math.PI / 2) * (u / tp)) : a * Math.pow(0.5, (u - tp) / h);
};
const titre = (v: Values, t: number) => resp(t, 0, TP1, K * v.dose!, v.half!) + resp(t, v.gap!, TP2, v.boost! * K * v.dose2!, v.half!);
const outs: OutDef[] = [
  { id: 'peak1', label: 'Primary response peak', unit: 'titre units', fn: (v) => K * v.dose!, digits: 0 },
  { id: 'resid', label: 'Antibody left when the second exposure comes', unit: 'titre units', fn: (v) => resp(v.gap!, 0, TP1, K * v.dose!, v.half!), digits: 1 },
  { id: 'peak2', label: 'Secondary response peak', unit: 'titre units', fn: (v) => titre(v, v.gap! + TP2), digits: 0 },
  { id: 'fold', label: 'Secondary peak ÷ primary peak', unit: '×', fn: (v) => titre(v, v.gap! + TP2) / (K * v.dose!), digits: 1 },
  { id: 'peakday', label: 'Day of the secondary peak', unit: 'day', fn: (v) => v.gap! + TP2, digits: 0 },
];

export const spec: Spec = {
  id: 'bio-human-health',
  subject: 'Biology',
  lessonTitleStartsWith: 'Human health and disease',
  afterHeading: 'Vaccination and immunisation',
  title: 'Primary and Secondary Response Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Meet an antigen twice and watch the antibody titre: a slow, low primary response, then a fast, intense secondary response because memory cells remember the first meeting.',
  can: ['See why a vaccine is protective: it creates memory cells', 'Show that the second response is faster and much larger', 'Fit the antibody half-life from your own readings'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'p2b', title: 'Secondary peak against memory boost', x: 'boost', y: 'peak2' },
    { id: 'res', title: 'Antibody left at the second exposure against the gap', x: 'gap', y: 'resid' },
    { id: 'p1d', title: 'Primary peak against the first dose', x: 'dose', y: 'peak1' },
  ],
  sceneAlt: 'A curve of antibody titre against days. A low, slow first hump follows the first exposure; a second, taller and faster peak follows the second exposure. Marks show both exposures, and the curve changes with the doses, the memory boost and the gap.',
  scene: ({ v, o }) => {
    const T = v.gap! + 50;
    const ymax = Math.max(o.peak2!, o.peak1!) * 1.1;
    const X = (t: number) => 28 + (t / T) * 350;
    const Y = (y: number) => 195 - (y / ymax) * 165;
    const pts: [number, number][] = [];
    const first: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * T;
      pts.push([X(t), Y(titre(v, t))]);
      first.push([X(t), Y(resp(t, 0, TP1, K * v.dose!, v.half!))]);
    }
    return (
      <g>
        <rect x={28} y={30} width={350} height={165} fill="#fff" stroke="#e5e5e5" />
        <path d={pathOf(first)} fill="none" stroke="#7c8595" strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={pathOf(pts)} fill="none" stroke="#c45e42" strokeWidth={2} />
        <line x1={X(0)} x2={X(0)} y1={30} y2={195} stroke="#18443b" strokeDasharray="2 2" />
        <line x1={X(v.gap!)} x2={X(v.gap!)} y1={30} y2={195} stroke="#18443b" strokeDasharray="2 2" />
        <text x={X(0) + 3} y={42} fontSize={10} fill="#18443b">1st exposure</text>
        <text x={X(v.gap!) + 3} y={42} fontSize={10} fill="#18443b">2nd exposure</text>
        <text x={X(o.peakday!)} y={Y(o.peak2!) - 4} fontSize={10} textAnchor="middle" fill="#c45e42">{fmt(o.peak2!, 0)}</text>
        <text x={203} y={216} fontSize={10} textAnchor="middle" fill="#4d5768">days (grey dashed = response if met only once)</text>
        <text x={12} y={115} fontSize={10} fill="#4d5768" transform="rotate(-90 12 115)" textAnchor="middle">antibody titre</text>
      </g>
    );
  },
  discover: [
    'Move the days until the second exposure. The first response fades by half every half-life: watch the antibody left at the second exposure.',
    'Raise the memory boost. The second peak climbs and arrives sooner than the first.',
    'Change the first dose: the primary response is low and scales with the dose.',
  ],
  experiment: [
    'Set the memory boost to 2 and then 40. How does the ratio of secondary to primary peak change?',
    'Lengthen the gap. Does the second peak still beat the first? Is it as high as before?',
    'Shorten the antibody half-life. What is left when the second exposure arrives?',
  ],
  understand: [
    'Acquired immunity is pathogen-specific and has memory: the primary response is of low intensity, the secondary (anamnestic) response is highly intensified.',
    'A vaccine works on this principle: it gives memory B and T cells, so a real infection meets a rapid, massive antibody response.',
    'Passive immunity (ready-made antibodies) acts at once but leaves no memory in the receiver, so it has no boost.',
    'Antibodies are proteins of four chains (H2L2) made by B cells: the humoral immune response.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Stronger memory', prompt: 'The memory boost rises from 5 to 20 (everything else at the start values). What happens to the secondary peak?',
      base: { boost: 5 }, test: { boost: 20 },
      labels: ['It stays about the same', 'It becomes about 8 times as large', 'It becomes about 2 times as large', 'It becomes about 4 times as large'], vals: [1, 8, 2, 4], f: (o) => o.peak2!,
      why: ({ base, test, outs: oo }) => `The secondary peak is mostly the memory response (boost × dose), so a fourfold boost gives about four times the peak: ${fmt(oo(base).peak2!, 0)} becomes ${fmt(oo(test).peak2!, 0)} units.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'A long wait', prompt: 'The second exposure comes after 120 days instead of 40 days (half-life 25 days). How much first-response antibody is left when it arrives?',
      base: { gap: 40 }, test: { gap: 120 },
      labels: ['About twice as much', 'About the same', 'About half as much', 'About one tenth as much'], vals: [2, 1, 0.5, 0.1], f: (o) => o.resid!,
      why: ({ base, test, outs: oo }) => `Antibody halves every 25 days after the peak, so 80 more days is more than three halvings: ${fmt(oo(base).resid!, 1)} units falls to ${fmt(oo(test).resid!, 1)} units.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'Bigger first dose', prompt: 'The first antigen dose is doubled from 10 to 20 units. What happens to the primary response peak?',
      base: { dose: 10 }, test: { dose: 20 },
      labels: ['It doubles', 'It stays the same', 'It becomes four times as large', 'It halves'], vals: [2, 1, 4, 0.5], f: (o) => o.peak1!,
      why: ({ base, test, outs: oo }) => `In this model the primary peak is proportional to the dose: ${fmt(oo(base).peak1!, 0)} becomes ${fmt(oo(test).peak1!, 0)} units.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Short-lived antibodies', prompt: 'The antibody half-life changes from 10 days to 50 days. 60 days after the first exposure, how does the antibody still present compare?',
      base: { half: 10 }, test: { half: 50 },
      labels: ['About 2 times as much', 'About 4 times as much', 'About 8 times as much', 'About 16 times as much'], vals: [2, 4, 8, 16], f: (o) => o.resid!,
      why: ({ base, test, outs: oo }) => `After the peak (10 days) there are 50 days left: 5 half-lives at 10 days against 1 at 50 days. The residual goes from ${fmt(oo(base).resid!, 2)} to ${fmt(oo(test).resid!, 2)} units, 16 times as much.`,
    }),
  ],
  measure: {
    instruction: 'Keep the doses, the boost and the half-life fixed. Record the antibody left at the second exposure for at least three different gaps.',
    vary: 'gap',
    record: ['resid', 'peak2', 'fold'],
    fit: {
      xLabel: 'gap between exposures (days)',
      yLabel: 'ln(antibody left)',
      x: (v) => v.gap!,
      y: (_v, o) => Math.log(o.resid!),
      interpret: (slope) => `ln(antibody left) falls on a straight line with slope −ln 2 ÷ half-life = ${fmt(slope, 4)} per day, so the antibody half-life is ${fmt(-Math.LN2 / slope, 1)} days.`,
    },
  },
  questions: [
    mkQ('q1', 'A first exposure gives a peak titre of 40 units. The secondary response to the same antigen is 10 times more intense. What is its peak (ignoring antibody left over)?', ['100 units', '400 units', '4 units', '40 units'], [100, 400, 4, 40], () => 40 * 10,
      'The secondary (anamnestic) response is highly intensified because memory B cells respond: 40 × 10 = 400 units.'),
    mkQ('q2', 'An antibody titre of 80 units has a half-life of 25 days. What titre remains after 75 days?', ['40 units', '20 units', '5 units', '10 units'], [40, 20, 5, 10], () => 80 * Math.pow(0.5, 75 / 25),
      '75 days is three half-lives: 80 → 40 → 20 → 10 units.'),
    mkQ('q3', 'Three antibody molecules each have two heavy and two light chains (H2L2). How many polypeptide chains are there altogether?', ['6', '8', '12', '9'], [6, 8, 12, 9], () => 3 * 4,
      'One antibody has 2 heavy + 2 light = 4 chains, so three molecules have 12 chains.'),
    mkQ('q4', 'The antibody titre in a person falls from 160 units to 20 units without a new exposure. How many half-lives have passed?', ['2', '4', '8', '3'], [2, 4, 8, 3], () => Math.log2(160 / 20),
      '160 → 80 → 40 → 20 is three halvings, so 3 half-lives have passed.'),
    mkQ('q5', 'Readymade antivenom antibodies give 200 units of protection at once. With a half-life of 20 days and no memory cells, how much protection is left after 40 days?', ['100 units', '50 units', '200 units', '25 units'], [100, 50, 200, 25], () => 200 * Math.pow(0.5, 40 / 20),
      'Passive immunity acts at once but leaves no memory, so the antibodies simply decay: after two half-lives 200 → 100 → 50 units.'),
  ],
};
