/**
 * Chapter lab: Biology, "Organisms and populations", exponential and logistic growth.
 * Model (exactly the lesson's equations): r = b - d; dN/dt = rN; N_t = N0 e^(rt); doubling time = 0.693 / r;
 * dN/dt = rN (K - N)/K with the S-shaped (sigmoid) solution. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { clamp, mkPred, mkQ, pathOf } from './_bio-util';

const vars: VarDef[] = [
  { id: 'N0', label: 'Starting population N₀', unit: 'individuals', min: 1, max: 400, step: 1, start: 10, digits: 0, integer: true },
  { id: 'b', label: 'Birth rate per individual b', unit: 'per unit time', min: 0.3, max: 1, step: 0.05, start: 0.5, digits: 2 },
  { id: 'd', label: 'Death rate per individual d', unit: 'per unit time', min: 0.05, max: 0.3, step: 0.05, start: 0.1, digits: 2 },
  { id: 'K', label: 'Carrying capacity K', unit: 'individuals', min: 400, max: 2000, step: 50, start: 1000, digits: 0 },
  { id: 't', label: 'Time t', unit: 'time units', min: 0, max: 60, step: 1, start: 20, digits: 0 },
];
const r = (v: Values) => v.b! - v.d!;
const nExp = (v: Values, t = v.t!) => v.N0! * Math.exp(r(v) * t);
const nLog = (v: Values, t = v.t!) => v.K! / (1 + ((v.K! - v.N0!) / v.N0!) * Math.exp(-r(v) * t));
const outs: OutDef[] = [
  { id: 'r', label: 'Intrinsic rate of natural increase r = b − d', unit: 'per unit time', fn: r, digits: 2 },
  { id: 'td', label: 'Doubling time 0.693 / r (exponential)', unit: 'time units', fn: (v) => Math.LN2 / r(v), digits: 1 },
  { id: 'nexp', label: 'Exponential growth N = N₀e^(rt) at time t', unit: 'individuals', fn: (v) => nExp(v), digits: 0 },
  { id: 'nlog', label: 'Logistic growth N at time t', unit: 'individuals', fn: (v) => nLog(v), digits: 0 },
  { id: 'rate0', label: 'Logistic growth rate dN/dt at N = N₀', unit: 'individuals per unit time', fn: (v) => (r(v) * v.N0! * (v.K! - v.N0!)) / v.K!, digits: 1 },
  { id: 'thalf', label: 'Time for the logistic curve to reach K/2', unit: 'time units', fn: (v) => Math.max(0, Math.log((v.K! - v.N0!) / v.N0!) / r(v)), digits: 1 },
];

export const spec: Spec = {
  id: 'bio-populations',
  subject: 'Biology',
  lessonTitleStartsWith: 'Organisms and populations',
  afterHeading: 'Population growth: logistic growth',
  title: 'Population Growth Lab',
  format: 'Simulation · graph exploration',
  blurb: 'Set the birth rate, death rate, starting number and carrying capacity, and watch the J-shaped exponential curve and the S-shaped logistic curve grow from the same start.',
  can: ['See why exponential growth cannot go on and logistic growth levels off at K', 'Find where logistic growth is fastest (N = K/2)', 'Recover r from a straight line of ln N against time'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'log', title: 'Logistic growth: N against time', x: 't', y: 'nlog' },
    { id: 'exp', title: 'Exponential growth: N against time (log scale)', x: 't', y: 'nexp', logY: true },
    { id: 'rate', title: 'Logistic growth rate against N₀ (fastest at K/2)', x: 'N0', y: 'rate0' },
  ],
  sceneAlt: 'A graph of population size against time. A red J-shaped exponential curve keeps rising off the top. A blue S-shaped logistic curve levels off at the dashed carrying capacity line K. A marker shows the population at time t on each curve.',
  scene: ({ v }) => {
    const ymax = v.K! * 1.15;
    const X = (t: number) => 40 + (t / 60) * 330;
    const Y = (n: number) => 200 - (clamp(n, 0, ymax) / ymax) * 170;
    const ex: [number, number][] = [];
    const lg: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 2;
      ex.push([X(t), Y(nExp(v, t))]);
      lg.push([X(t), Y(nLog(v, t))]);
    }
    return (
      <g>
        <rect x={40} y={30} width={330} height={170} fill="#fff" stroke="#e5e5e5" />
        <line x1={40} x2={370} y1={Y(v.K!)} y2={Y(v.K!)} stroke="#7c8595" strokeDasharray="5 3" />
        <text x={372} y={Y(v.K!) + 4} fontSize={10} fill="#4d5768">K</text>
        <path d={pathOf(ex)} fill="none" stroke="#c45e42" strokeWidth={2} />
        <path d={pathOf(lg)} fill="none" stroke="#2563a8" strokeWidth={2} />
        <line x1={X(v.t!)} x2={X(v.t!)} y1={30} y2={200} stroke="#18443b" strokeDasharray="2 2" />
        <circle cx={X(v.t!)} cy={Y(nExp(v))} r={4} fill="#c45e42" />
        <circle cx={X(v.t!)} cy={Y(nLog(v))} r={4} fill="#2563a8" />
        <text x={48} y={44} fontSize={10} fill="#c45e42">J: exponential</text>
        <text x={48} y={58} fontSize={10} fill="#2563a8">S: logistic (levels at K)</text>
        <text x={205} y={220} fontSize={10} textAnchor="middle" fill="#4d5768">time</text>
      </g>
    );
  },
  discover: [
    'Set the time to 60 and compare the two curves. Which keeps rising and which levels off?',
    'Raise the birth rate. How do r and the doubling time respond?',
    'Raise the carrying capacity K. Which curve does it change?',
  ],
  experiment: [
    'Make b − d small (0.2) and large (0.9). How long does the S-curve take to reach K/2?',
    'Move the starting number N₀ up toward K/2 and look at the third graph: where is the growth rate largest?',
    'With N₀ equal to K, what is the growth rate?',
  ],
  understand: [
    'Exponential growth dN/dt = rN with r = b − d assumes unlimited food and space and gives a J-shaped curve; the doubling time is 0.693 / r.',
    'Logistic growth dN/dt = rN(K − N)/K is S-shaped: a lag phase, an exponential phase, deceleration and an asymptote at the carrying capacity K.',
    'The logistic growth rate is zero at N = 0 and at N = K and greatest at N = K/2.',
    'Both curves start the same way; they only separate when N becomes a sizeable fraction of K.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Faster births', prompt: 'With death rate 0.1, the birth rate rises from 0.3 to 0.5 per unit time. What happens to the doubling time of the exponential population?',
      base: { b: 0.3, d: 0.1 }, test: { b: 0.5 },
      labels: ['It doubles', 'It stays the same', 'It falls to half', 'It falls to one quarter'], vals: [2, 1, 0.5, 0.25], f: (o) => o.td!,
      why: ({ base, test, outs: oo }) => `r goes from ${fmt(oo(base).r!, 2)} to ${fmt(oo(test).r!, 2)}, twice as large, and the doubling time 0.693/r halves: ${fmt(oo(base).td!, 1)} to ${fmt(oo(test).td!, 1)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Bigger habitat', prompt: 'After a long time (t = 60) the carrying capacity is raised from 500 to 1000. What happens to the logistic population?',
      base: { K: 500, N0: 10, t: 60 }, test: { K: 1000 },
      labels: ['It becomes about 4 times as large', 'It stays about the same', 'It becomes about 10 times as large', 'It becomes about twice as large'], vals: [4, 1, 10, 2], f: (o) => o.nlog!,
      why: ({ base, test, outs: oo }) => `The logistic curve levels off at K, so a doubled K doubles the final size: ${fmt(oo(base).nlog!, 0)} becomes ${fmt(oo(test).nlog!, 0)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'Where growth is fastest', prompt: 'With K = 1000, the growth rate dN/dt at N = 400 (close to K/2) is compared with that at N = 100. How many times faster is it at N = 400?',
      base: { K: 1000, N0: 100 }, test: { N0: 400 },
      labels: ['About 1.2 times', 'About 10 times', 'About 5 times', 'About 2.8 times'], vals: [1.2, 10, 5, 2.8], f: (o) => o.rate0!,
      why: ({ base, test, outs: oo }) => `dN/dt = rN(K − N)/K. At N = 100 it is ${fmt(oo(base).rate0!, 1)}; at N = 400 it is ${fmt(oo(test).rate0!, 1)} (the peak, at N = K/2 = 500, is higher still). Growth rate is largest near K/2.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'At the carrying capacity', prompt: 'K is 400 and r = 0.4. The population is at K/2 = 200, where growth is fastest, and then reaches N = 400 = K. What is the growth rate at N = K?',
      base: { K: 400, N0: 200 }, test: { N0: 400 },
      labels: ['Still its maximum, 40 per unit time', 'Zero', 'Negative, −40 per unit time', 'Twice the maximum, 80'], vals: [40, 0, -40, 80], f: (o) => o.rate0!, mode: 'value',
      why: ({ base, test, outs: oo }) => `The bracket (K − N)/K is zero at N = K, so dN/dt = 0 (it was ${fmt(oo(base).rate0!, 1)} at K/2, the maximum); the result is ${fmt(oo(test).rate0!, 1)}.`,
    }),
  ],
  measure: {
    instruction: 'Look only at the exponential population N = N₀e^(rt). Record N for at least three different times t, then fit a straight line to ln N against t.',
    vary: 't',
    record: ['nexp', 'nlog'],
    fit: {
      xLabel: 'time t',
      yLabel: 'ln N (exponential)',
      x: (v) => v.t!,
      y: (_v, o) => Math.log(o.nexp!),
      interpret: (slope, intercept, v) => `ln N = ln N₀ + r t is a straight line. The slope is r = ${fmt(slope, 3)} per unit time (b − d = ${fmt(r(v), 3)}), so the doubling time is 0.693 ÷ r = ${fmt(Math.LN2 / slope, 1)}; the intercept gives N₀ = ${fmt(Math.exp(intercept), 1)}.`,
    },
  },
  questions: [
    mkQ('q1', 'A population of 500 field mice has 60 births, 30 deaths, 20 immigrants and 10 emigrants in a month. What is the population at the end of the month?', ['540', '530', '560', '580'], [540, 530, 560, 580], () => 500 + (60 + 20) - (30 + 10),
      'N(t+1) = N(t) + [(B + I) − (D + E)] = 500 + (60 + 20) − (30 + 10) = 540.'),
    mkQ('q2', 'A bacterial culture of 1000 cells grows exponentially with r = 0.05 per hour. How many cells after 10 hours?', ['1050', '1500', '2718', '1649'], [1050, 1500, 2718, 1649], () => 1000 * Math.exp(0.05 * 10),
      'N = N₀e^(rt) = 1000 × e^0.5 = 1000 × 1.6487 ≈ 1649 cells.'),
    mkQ('q3', 'A pond supports at most 800 fish (K = 800) and r = 0.2 per month. What is dN/dt when N = 400?', ['80', '40', '30', '160'], [80, 40, 30, 160], () => (0.2 * 400 * (800 - 400)) / 800,
      'dN/dt = rN(K − N)/K = 0.2 × 400 × 0.5 = 40 fish per month.'),
    mkQ('q4', 'A population has r = 0.05 per year and grows without limit. What is its doubling time?', ['6.9 years', '27.7 years', '13.9 years', '20 years'], [6.9, 27.7, 13.9, 20], () => Math.LN2 / 0.05,
      'The doubling time is 0.693 / r = 0.693 / 0.05 = 13.9 years.'),
    mkQ('q5', 'In a logistic population with K = 800, at what population size is the growth rate greatest?', ['200', '800', '600', '400'], [200, 800, 600, 400], () => 800 / 2,
      'dN/dt = rN(K − N)/K is largest at N = K/2 = 400, which is the steepest part of the S-curve; it is zero at N = 0 and N = K.'),
  ],
};
