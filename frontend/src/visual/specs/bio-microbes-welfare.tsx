/**
 * Chapter lab: Biology, "Microbes in human welfare", secondary (biological) sewage treatment and the fall of BOD.
 * Model: aerobic microbes in flocs oxidise the organic matter, so BOD(t) = BOD0 e^(-kt); the rate constant k rises with the
 * activated sludge returned as inoculum, with temperature and with aeration (all three coefficients are illustrative).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'bod0', label: 'BOD of the effluent entering the aeration tank', unit: 'mg/L', min: 100, max: 600, step: 10, start: 300, digits: 0 },
  { id: 't', label: 'Time in the aeration tank', unit: 'h', min: 0, max: 12, step: 0.5, start: 8, digits: 1 },
  { id: 'floc', label: 'Activated sludge returned as inoculum', unit: '%', min: 1, max: 20, step: 1, start: 5, digits: 0 },
  { id: 'T', label: 'Temperature', unit: '°C', min: 10, max: 35, step: 1, start: 25, digits: 0 },
  { id: 'air', label: 'Air supply (1 = fully aerated)', unit: '', min: 0.1, max: 1, step: 0.1, start: 1, digits: 1 },
];
const k = (v: Values) => 0.2 * (0.5 + v.floc! / 10) * Math.pow(1.07, v.T! - 20) * v.air!;
const bod = (v: Values) => v.bod0! * Math.exp(-k(v) * v.t!);
const outs: OutDef[] = [
  { id: 'k', label: 'Rate constant k of BOD removal', unit: 'per hour', fn: k, digits: 3 },
  { id: 'bod', label: 'BOD of the effluent leaving', unit: 'mg/L', fn: bod, digits: 1 },
  { id: 'red', label: 'Reduction in BOD', unit: '%', fn: (v) => (100 * (v.bod0! - bod(v))) / v.bod0!, digits: 1 },
  { id: 'removed', label: 'BOD removed', unit: 'mg/L', fn: (v) => v.bod0! - bod(v), digits: 1 },
  { id: 't90', label: 'Time for a 90 per cent reduction (ln 10 ÷ k)', unit: 'h', fn: (v) => Math.LN10 / k(v), digits: 1 },
];

export const spec: Spec = {
  id: 'bio-microbes-welfare',
  subject: 'Biology',
  lessonTitleStartsWith: 'Microbes in human welfare',
  afterHeading: 'Microbes in sewage treatment',
  title: 'Sewage Treatment Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Run the aeration tank of a sewage plant: set the incoming BOD, the time, the activated sludge returned, the temperature and the air supply, and watch the BOD of the effluent fall.',
  can: ['See why aeration and flocs are needed to bring BOD down', 'Calculate the percentage reduction in BOD', 'Fit the rate constant of BOD removal from ln(BOD) against time'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'bod', title: 'BOD of the effluent against time in the tank', x: 't', y: 'bod' },
    { id: 'red', title: 'BOD reduction against activated sludge returned', x: 'floc', y: 'red' },
    { id: 'tmp', title: 'BOD reduction against temperature', x: 'T', y: 'red' },
  ],
  sceneAlt: 'An aeration tank. The liquid is darker when the BOD is high, rising bubbles show the air supply, brown flocs of microbes multiply with the sludge returned and the time, and a gauge reads the BOD leaving the tank.',
  scene: ({ v, o }) => {
    const dark = Math.min(1, o.bod! / 600);
    const bubbles = Math.round(v.air! * 22);
    const flocs = Math.round(6 + v.floc! * 1.3 + v.t! * 1.2);
    return (
      <g>
        <rect x={60} y={50} width={200} height={150} fill="#fff" stroke="#18443b" strokeWidth={2} />
        <rect x={62} y={70} width={196} height={128} fill="#6b4a2a" opacity={0.15 + 0.7 * dark} />
        {Array.from({ length: bubbles }, (_, i) => <circle key={i} cx={70 + ((i * 53) % 180)} cy={190 - ((i * 37) % 110)} r={2 + (i % 3)} fill="#fff" stroke="#2563a8" opacity={0.8} />)}
        {Array.from({ length: flocs }, (_, i) => <ellipse key={i} cx={72 + ((i * 41) % 176)} cy={90 + ((i * 29) % 100)} rx={5 + (i % 3)} ry={3.5} fill="#8a6a3a" opacity={0.85} />)}
        <path d="M20 85 H 60" stroke="#7c8595" strokeWidth={4} />
        <path d="M260 85 H 300" stroke="#7c8595" strokeWidth={4} />
        <text x={20} y={75} fontSize={10} fill="#4d5768">in: {fmt(v.bod0!, 0)}</text>
        <text x={262} y={75} fontSize={10} fill="#4d5768">out: {fmt(o.bod!, 0)}</text>
        <text x={310} y={95} fontSize={11} fill="#c45e42">−{fmt(o.red!, 0)}%</text>
        <text x={160} y={216} fontSize={10} textAnchor="middle" fill="#4d5768">BOD in mg/L · flocs = aerobic bacteria and fungal filaments</text>
        <text x={160} y={40} fontSize={11} textAnchor="middle" fill="#18443b">secondary treatment: aeration tank</text>
      </g>
    );
  },
  discover: [
    'Drag the time in the tank from 0 to 12 hours and watch the liquid clear and the BOD fall.',
    'Cut the air supply. Why does the BOD stay high?',
    'Return more activated sludge as inoculum and see what the flocs do to the rate.',
  ],
  experiment: [
    'With the starting values, how many hours does a 90 percent reduction need?',
    'How does cooling the tank by 10 degrees change the rate constant?',
    'Check the lesson example: starting at 300 mg/L, find settings that bring the BOD to about 24 mg/L (a 92 percent reduction).',
  ],
  understand: [
    'BOD (biochemical oxygen demand) measures the organic matter that microbes can oxidise; the aerobic microbes in the flocs consume it and BOD falls greatly in secondary treatment.',
    'Primary treatment is physical (filtration and sedimentation); the biological fall in BOD happens only in the aerated tank.',
    'The settled flocs are the activated sludge: a small part is returned as inoculum, the rest goes to anaerobic digesters.',
    'Removal is exponential: a constant fraction of the remaining BOD is oxidised per hour.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'More inoculum', prompt: 'The activated sludge returned as inoculum rises from 5 to 20 percent. By what factor does the rate constant of BOD removal rise (this model)?',
      base: { floc: 5 }, test: { floc: 20 },
      labels: ['About 1.5 times', 'About 4 times', 'About 2.5 times', 'About 1 time (no change)'], vals: [1.5, 4, 2.5, 1], f: (o) => o.k!,
      why: ({ base, test, outs: oo }) => `More flocs mean more microbes oxidising the organic matter: k goes from ${fmt(oo(base).k!, 3)} to ${fmt(oo(test).k!, 3)} per hour.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'A cold tank', prompt: 'The tank is cooled from 25 to 15 degrees C. What happens to the rate constant of BOD removal?',
      base: { T: 25 }, test: { T: 15 },
      labels: ['It doubles', 'It halves', 'It stays the same', 'It falls to one tenth'], vals: [2, 0.5, 1, 0.1], f: (o) => o.k!,
      why: ({ base, test, outs: oo }) => `Microbial activity slows when it is cold: k goes from ${fmt(oo(base).k!, 3)} to ${fmt(oo(test).k!, 3)} per hour.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'Switch the air down', prompt: 'The air supply falls from 1 to 0.2 (8 hours in the tank). By what factor does the BOD of the effluent leaving the tank change?',
      base: { air: 1, t: 8 }, test: { air: 0.2 },
      labels: ['About 6 times higher', 'About 2 times higher', 'About the same', 'About 6 times lower'], vals: [6, 2, 1, 1 / 6], f: (o) => o.bod!,
      why: ({ base, test, outs: oo }) => `Decomposition here is aerobic, so with little oxygen the microbes work slowly: the outflow BOD rises from ${fmt(oo(base).bod!, 1)} to ${fmt(oo(test).bod!, 1)} mg/L.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Twice as long', prompt: 'The effluent stays 8 hours in the tank instead of 4 hours. By what factor does the BOD leaving the tank change?',
      base: { t: 4 }, test: { t: 8 },
      labels: ['It halves', 'It falls to about one third', 'It falls to one tenth', 'It falls to a quarter'], vals: [0.5, 0.33, 0.1, 0.25], f: (o) => o.bod!,
      why: ({ base, test, outs: oo }) => `BOD(t) = BOD₀ e^(−kt), so doubling the time squares the surviving fraction: ${fmt(oo(base).bod!, 1)} becomes ${fmt(oo(test).bod!, 1)} mg/L.`,
    }),
  ],
  measure: {
    instruction: 'Keep everything but the time fixed. Record the BOD of the effluent at three or more different times in the tank.',
    vary: 't',
    record: ['bod', 'red', 'removed'],
    fit: {
      xLabel: 'time t (h)',
      yLabel: 'ln(BOD)',
      x: (v) => v.t!,
      y: (_v, o) => Math.log(o.bod!),
      interpret: (slope, intercept) => `ln(BOD) falls on a straight line. The slope is −k = ${fmt(slope, 3)} per hour, so the rate constant is ${fmt(-slope, 3)} per hour, and the intercept gives the incoming BOD, e^${fmt(intercept, 2)} = ${fmt(Math.exp(intercept), 0)} mg/L.`,
    },
  },
  questions: [
    mkQ('q1', 'A sewage sample entering the aeration tank has a BOD of 300 mg/L. After secondary treatment the BOD is 24 mg/L. What is the percentage reduction?', ['8 percent', '92 percent', '276 percent', '82 percent'], [8, 92, 276, 82], () => (100 * (300 - 24)) / 300,
      'Reduction = 300 − 24 = 276 mg/L, which is 276/300 × 100 = 92 percent, mostly in the aeration tank.'),
    mkQ('q2', 'In an aeration tank the BOD halves every 2 hours. Starting at 400 mg/L, what is the BOD after 6 hours?', ['50', '100', '200', '25'], [50, 100, 200, 25], () => 400 * Math.pow(0.5, 3),
      '6 hours is three halvings: 400 → 200 → 100 → 50 mg/L.'),
    mkQ('q3', 'The rate constant of BOD removal is 0.23 per hour. About how long does a 90 percent reduction take?', ['4.6 h', '2.3 h', '23 h', '10 h'], [4.6, 2.3, 23, 10], () => Math.LN10 / 0.23,
      'ln(BOD₀/BOD) = kt with BOD₀/BOD = 10: t = 2.303/0.23 ≈ 10 hours.'),
    mkQ('q4', '1000 L of effluent have their BOD cut from 300 to 24 mg/L. How many grams of BOD are removed?', ['24 g', '2760 g', '300 g', '276 g'], [24, 2760, 300, 276], () => ((300 - 24) * 1000) / 1000,
      '276 mg/L × 1000 L = 276 000 mg = 276 g of oxygen-demanding organic matter removed.'),
    mkQ('q5', 'A tank removes organic matter at k = 0.3 per hour. What fraction of the BOD is left after 5 hours?', ['0.78', '0.22', '0.05', '0.50'], [0.78, 0.22, 0.05, 0.5], () => Math.exp(-0.3 * 5),
      'Fraction left = e^(−kt) = e^(−1.5) = 0.22.'),
  ],
};
