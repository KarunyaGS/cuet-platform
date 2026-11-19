/**
 * Chapter lab: General Aptitude Test, "General mental ability and numerical ability" - simple and compound interest.
 * Formulas from the lesson: SI = P R T / 100; amount with yearly compounding A = P (1 + R/100)^T; CI = A - P. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const si = (P: number, R: number, T: number) => (P * R * T) / 100;
const amt = (P: number, R: number, T: number) => P * Math.pow(1 + R / 100, T);
const ci = (P: number, R: number, T: number) => amt(P, R, T) - P;

export const spec: Spec = {
  id: 'gat-interest-profit',
  subject: 'General Aptitude Test',
  lessonTitleStartsWith: 'General mental ability and numerical ability',
  afterHeading: 'Profit and loss, simple and compound interest',
  title: 'Simple and Compound Interest Lab',
  format: 'Calculator · growth curves',
  blurb: 'Change the principal, the rate and the time, and compare year-by-year bars of simple and compound interest. See the gap between them open up.',
  can: ['See simple interest grow in equal steps and compound interest in growing steps', 'Find the rate and time at which CI − SI is large', 'Record SI for three times and fit the rate from the slope'],
  minutes: 8,
  vars: [
    { id: 'P', label: 'Principal P', unit: '₹', min: 1000, max: 20000, step: 500, start: 8000, digits: 0 },
    { id: 'R', label: 'Rate R per year', unit: '%', min: 2, max: 20, step: 1, start: 10, digits: 0 },
    { id: 'T', label: 'Time T', unit: 'years', min: 1, max: 10, step: 1, start: 2, digits: 0 },
  ],
  outs: [
    { id: 'SI', label: 'Simple interest = P R T ÷ 100', unit: '₹', fn: (v) => si(v.P!, v.R!, v.T!), digits: 0 },
    { id: 'A', label: 'Amount with compound interest = P (1 + R/100)^T', unit: '₹', fn: (v) => amt(v.P!, v.R!, v.T!), digits: 0 },
    { id: 'CI', label: 'Compound interest = amount − P', unit: '₹', fn: (v) => ci(v.P!, v.R!, v.T!), digits: 0 },
    { id: 'D', label: 'Difference CI − SI', unit: '₹', fn: (v) => ci(v.P!, v.R!, v.T!) - si(v.P!, v.R!, v.T!), digits: 1 },
  ],
  graphs: [
    { id: 'ci-t', title: 'Compound interest against time', x: 'T', y: 'CI' },
    { id: 'd-r', title: 'CI − SI against the rate', x: 'R', y: 'D' },
    { id: 'si-p', title: 'Simple interest against the principal', x: 'P', y: 'SI' },
  ],
  sceneAlt: 'Paired bars for each year up to the chosen time: the blue bar is the simple interest earned so far and the red bar the compound interest earned so far; the red bars pull ahead as the years pass.',
  scene: ({ v, o }) => {
    const T = v.T!;
    const top = Math.max(o.CI!, o.SI!, 1);
    const bw = Math.min(26, 330 / T / 2.3);
    return (
      <g fontSize={10} textAnchor="middle">
        {Array.from({ length: T }, (_, i) => {
          const y = i + 1;
          const x = 36 + (i * 340) / T;
          const hs = (si(v.P!, v.R!, y) / top) * 150;
          const hc = (ci(v.P!, v.R!, y) / top) * 150;
          return (
            <g key={y}>
              <rect x={x} y={180 - hs} width={bw} height={hs} fill={BLUE} />
              <rect x={x + bw + 1} y={180 - hc} width={bw} height={hc} fill={ACC} />
              <text x={x + bw} y={194} fill={GREY}>{y}</text>
            </g>
          );
        })}
        <line x1={30} x2={380} y1={180} y2={180} stroke={GREY} />
        <rect x={40} y={8} width={10} height={10} fill={BLUE} />
        <text x={56} y={17} textAnchor="start" fill={INK}>simple interest ₹{fmt(o.SI!, 0)}</text>
        <rect x={200} y={8} width={10} height={10} fill={ACC} />
        <text x={216} y={17} textAnchor="start" fill={INK}>compound interest ₹{fmt(o.CI!, 0)}</text>
        <text x={200} y={214} fill={INK} fontSize={11}>after {T} year{T > 1 ? 's' : ''}: CI exceeds SI by ₹{fmt(o.D!, 0)}</text>
        <text x={200} y={226} fill={GREY} fontSize={9}>bars show the interest earned up to each year</text>
      </g>
    );
  },
  discover: [
    'Set T = 1 and compare the two bars. Are they the same?',
    'Raise T step by step. Which bar grows by equal steps, and which by larger and larger steps?',
    'Raise the rate with T = 5. How does the gap CI − SI respond?',
  ],
  experiment: [
    'Set P = 8,000, R = 10 %, T = 2 and compare your readouts with the lesson (SI 1,600; CI 1,680).',
    'Double the rate. By what factor does CI − SI change at T = 2?',
    'Record SI for three times with P and R fixed, and read the rate from the slope.',
  ],
  understand: [
    'Simple interest SI = P R T ÷ 100 grows by the same amount every year.',
    'With yearly compounding, the amount is A = P (1 + R/100)^T and CI = A − P: each year\'s interest is earned on the interest already added.',
    'For one year SI and CI are equal; for more years CI is larger and the gap widens.',
    'For two years the difference CI − SI = P (R/100)².',
  ],
  preds: [
    {
      id: 'p1', title: 'Twice as long, simple interest', prompt: 'At 10 % a year on ₹8,000, the time is doubled from 2 to 4 years. What happens to the simple interest?',
      base: { P: 8000, R: 10, T: 2 }, test: { T: 4 }, options: ['It doubles', 'It rises by less than double', 'It more than doubles', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => {
        const r = outs(test).SI! / outs(base).SI!;
        return Math.abs(r - 2) < 1e-9 ? 0 : r < 2 ? 1 : r > 2 ? 2 : 3;
      },
      why: ({ base, test, outs }) => `SI is proportional to T. It goes from ₹${fmt(outs(base).SI!, 0)} to ₹${fmt(outs(test).SI!, 0)}.`,
    },
    {
      id: 'p2', title: 'Twice as long, compound interest', prompt: 'The same ₹8,000 at 10 %: the time is doubled from 2 to 4 years. What happens to the compound interest?',
      base: { P: 8000, R: 10, T: 2 }, test: { T: 4 }, options: ['It doubles exactly', 'It rises by less than double', 'It more than doubles', 'It stays the same'], answer: 2,
      verify: ({ base, test, outs }) => {
        const r = outs(test).CI! / outs(base).CI!;
        return Math.abs(r - 2) < 1e-9 ? 0 : r < 2 ? 1 : r > 2 ? 2 : 3;
      },
      why: ({ base, test, outs }) => `CI goes from ₹${fmt(outs(base).CI!, 0)} to ₹${fmt(outs(test).CI!, 0)}, a factor of ${fmt(outs(test).CI! / outs(base).CI!, 2)}: interest is earned on earlier interest, so it grows faster than the time.`,
    },
    {
      id: 'p3', title: 'Double the rate', prompt: 'For 2 years on ₹8,000, the rate is doubled from 10 % to 20 %. By what factor does the difference CI − SI change?',
      base: { P: 8000, R: 10, T: 2 }, test: { R: 20 }, options: ['2', '4', '3', '8'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).D! / outs(base).D!, [2, 4, 3, 8]),
      why: ({ base, test, outs }) => `For two years CI − SI = P (R/100)², which is proportional to R². It goes from ₹${fmt(outs(base).D!, 0)} to ₹${fmt(outs(test).D!, 0)}.`,
    },
    {
      id: 'p4', title: 'Only one year', prompt: 'For a time of one year (P = ₹8,000, R = 10 %), how do compound interest and simple interest compare?',
      base: { P: 8000, R: 10, T: 3 }, test: { T: 1 }, options: ['CI is larger by one year\'s interest', 'They are equal', 'CI is smaller', 'CI is double'], answer: 1,
      verify: ({ test, outs }) => (Math.abs(outs(test).D!) < 1e-9 ? 1 : outs(test).D! > 0 ? 0 : 2),
      why: ({ base, test, outs }) => `In the first year the interest is earned only on the principal, so SI = CI = ₹${fmt(outs(test).SI!, 0)} and the difference is ${fmt(outs(test).D!, 0)}. At 3 years the difference was ₹${fmt(outs(base).D!, 0)}.`,
    },
  ],
  measure: {
    instruction: 'Keep the principal and the rate fixed. Record the simple interest for at least three different times.',
    vary: 'T',
    record: ['SI', 'CI', 'D'],
    fit: {
      xLabel: 'time T (years)',
      yLabel: 'simple interest (₹)',
      x: (v) => v.T!,
      y: (_v, o) => o.SI!,
      interpret: (slope, _i, v) => `Simple interest against time is a straight line through the origin. The slope is P R ÷ 100 = ₹${fmt(slope, 0)} per year, so R = slope × 100 ÷ P = ${fmt((slope * 100) / v.P!, 1)} % (the slider is set to ${v.R} %).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Find the simple interest on ₹8,000 at 10 % per annum for 2 years.', options: ['₹1,600', '₹1,680', '₹1,800', '₹800'], answer: 0,
      why: 'SI = P R T ÷ 100 = 8,000 × 10 × 2 ÷ 100 = ₹1,600.',
      verify: () => closest(si(8000, 10, 2), [1600, 1680, 1800, 800]),
    },
    {
      id: 'q2', q: 'The amount of ₹8,000 at 10 % per annum for 2 years, compounded yearly, is', options: ['₹9,600', '₹9,680', '₹9,800', '₹1,680'], answer: 1,
      why: 'A = 8,000 × (1.1)² = 8,000 × 1.21 = ₹9,680.',
      verify: () => closest(amt(8000, 10, 2), [9600, 9680, 9800, 1680]),
    },
    {
      id: 'q3', q: 'The difference between the compound interest and the simple interest on ₹8,000 at 10 % per annum for 2 years is', options: ['₹160', '₹80', '₹1,680', '₹1,600'], answer: 1,
      why: 'CI = 1,680 and SI = 1,600, so the difference is ₹80. Check: P (R/100)² = 8,000 × 0.01 = ₹80.',
      verify: () => closest(ci(8000, 10, 2) - si(8000, 10, 2), [160, 80, 1680, 1600]),
    },
    {
      id: 'q4', q: 'The compound interest (yearly) on ₹5,000 at 20 % per annum for 2 years is', options: ['₹2,200', '₹2,000', '₹2,400', '₹7,200'], answer: 0,
      why: 'A = 5,000 × 1.2² = 5,000 × 1.44 = ₹7,200, so CI = 7,200 − 5,000 = ₹2,200 (simple interest would be only ₹2,000).',
      verify: () => closest(ci(5000, 20, 2), [2200, 2000, 2400, 7200]),
    },
    {
      id: 'q5', q: 'The compound interest (yearly) on ₹10,000 at 10 % per annum for 3 years is', options: ['₹3,000', '₹3,300', '₹13,310', '₹3,310'], answer: 3,
      why: 'A = 10,000 × 1.1³ = 10,000 × 1.331 = ₹13,310, so CI = ₹3,310 (not 3,300: the interest of earlier years also earns interest).',
      verify: () => closest(ci(10000, 10, 3), [3000, 3300, 13310, 3310]),
    },
  ],
};
