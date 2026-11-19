/**
 * Chapter lab: General Aptitude Test, "General mental ability and numerical ability" - number series.
 * Three rules from the lesson: arithmetic (add a constant), geometric (multiply by a constant) and difference-of-differences where the
 * differences themselves double (as in 3, 7, 15, 31: differences 4, 8, 16). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

/** the i-th term (i = 1, 2, ...) */
const term = (k: number, a: number, d: number, i: number) => (k === 1 ? a + (i - 1) * d : k === 2 ? a * Math.pow(d, i - 1) : a + d * (Math.pow(2, i - 1) - 1));
const sumTo = (k: number, a: number, d: number, n: number) => {
  let s = 0;
  for (let i = 1; i <= n; i++) s += term(k, a, d, i);
  return s;
};
const show = (x: number) => (Math.abs(x) >= 1e6 ? x.toExponential(1) : String(Math.round(x * 100) / 100));
const RULE = ['', 'add d each time', 'multiply by d each time', 'differences d, 2d, 4d, ...'];

export const spec: Spec = {
  id: 'gat-number-series',
  subject: 'General Aptitude Test',
  lessonTitleStartsWith: 'General mental ability and numerical ability',
  afterHeading: 'Number and letter series',
  title: 'Number Series Generator',
  format: 'Generator · pattern prediction',
  blurb: 'Pick a rule, a first term and a step, and watch the series grow. Check the differences and ratios between terms, predict the next term, then test yourself.',
  can: ['Switch between arithmetic, geometric and difference-of-differences rules', 'Read the differences and ratio to spot which rule is at work', 'Record the n-th term for three values of n and fit the common difference'],
  minutes: 9,
  vars: [
    { id: 'k', label: 'Rule (1 = add d, 2 = multiply by d, 3 = differences d, 2d, 4d …)', unit: '', min: 1, max: 3, step: 1, start: 1, digits: 0 },
    { id: 'a', label: 'First term a', unit: '', min: 1, max: 20, step: 1, start: 2, digits: 0 },
    { id: 'd', label: 'Step d', unit: '', min: 1, max: 6, step: 1, start: 3, digits: 0 },
    { id: 'n', label: 'Term number n', unit: '', min: 1, max: 20, step: 1, start: 6, digits: 0 },
  ],
  outs: [
    { id: 'tn', label: 'The n-th term', unit: '', fn: (v) => term(v.k!, v.a!, v.d!, v.n!), digits: 0 },
    { id: 'nx', label: 'The next term (term n + 1)', unit: '', fn: (v) => term(v.k!, v.a!, v.d!, v.n! + 1), digits: 0 },
    { id: 'df', label: 'Difference: next term − n-th term', unit: '', fn: (v) => term(v.k!, v.a!, v.d!, v.n! + 1) - term(v.k!, v.a!, v.d!, v.n!), digits: 0 },
    { id: 'rt', label: 'Ratio: next term ÷ n-th term', unit: '', fn: (v) => term(v.k!, v.a!, v.d!, v.n! + 1) / term(v.k!, v.a!, v.d!, v.n!), digits: 3 },
    { id: 'sm', label: 'Sum of the first n terms', unit: '', fn: (v) => sumTo(v.k!, v.a!, v.d!, v.n!), digits: 0 },
  ],
  graphs: [
    { id: 'tn-n', title: 'The n-th term against n', x: 'n', y: 'tn' },
    { id: 'nx-d', title: 'The next term against the step d', x: 'd', y: 'nx' },
    { id: 'sm-a', title: 'Sum of the first n terms against the first term', x: 'a', y: 'sm' },
  ],
  sceneAlt: 'A strip of the first seven boxes of the series with the n-th one highlighted, the differences written between the boxes, and a question mark box for the next term.',
  scene: ({ v, o }) => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((i) => term(v.k!, v.a!, v.d!, i));
    return (
      <g fontSize={10} textAnchor="middle">
        <text x={200} y={18} fontSize={12} fontWeight="bold" fill={INK}>Rule: {RULE[v.k!]}</text>
        {rows.map((t, i) => {
          const x = 12 + i * 54;
          const hi = i + 1 === v.n;
          return (
            <g key={i}>
              <rect x={x} y={34} width={48} height={34} rx={5} fill={hi ? ACC : '#eef1f4'} stroke={hi ? ACC : '#c9ced6'} />
              <text x={x + 24} y={55} fontSize={12} fontWeight="bold" fill={hi ? '#fff' : INK}>{show(t)}</text>
              <text x={x + 24} y={82} fill={GREY} fontSize={9}>t{i + 1}</text>
              {i < 6 && <text x={x + 51} y={102} fill={BLUE}>+{show(rows[i + 1]! - t)}</text>}
              {i < 6 && t !== 0 && <text x={x + 51} y={116} fill={GREY} fontSize={9}>×{fmt(rows[i + 1]! / t, 2)}</text>}
            </g>
          );
        })}
        <text x={30} y={102} fill={BLUE} textAnchor="start" fontSize={9}>diff</text>
        <text x={30} y={116} fill={GREY} textAnchor="start" fontSize={9}>ratio</text>
        <rect x={110} y={140} width={180} height={52} rx={6} fill="#fff" stroke={ACC} strokeWidth={2} />
        <text x={200} y={160} fill={GREY}>term {v.n! + 1} (the next after the n-th) = ?</text>
        <text x={200} y={182} fontSize={16} fontWeight="bold" fill={ACC}>{show(o.nx!)}</text>
        <text x={200} y={216} fill={GREY}>n-th term (term {v.n}) = {show(o.tn!)}</text>
      </g>
    );
  },
  discover: [
    'With rule 1, change d and look at the difference row in the picture. What stays constant?',
    'Switch to rule 2 and look at the ratio row. What stays constant now?',
    'Switch to rule 3 and read the differences d, 2d, 4d: they double. What does the ratio row do?',
  ],
  experiment: [
    'For each rule, cover the answer, predict the next term from the strip, then read it off.',
    'Choose a = 3 and d = 4 with rule 3. Compare with rule 1 for the same a and d: how soon do the two series part company?',
    'With rule 1, find the sum of the first 10 terms and check it against n × (first + last) ÷ 2.',
  ],
  understand: [
    'In an arithmetic series each term is the previous term plus a constant, so the differences are constant.',
    'In a geometric series each term is the previous term multiplied by a constant, so the ratios are constant.',
    'If the differences are not constant, take the differences of the differences: when they form a pattern (4, 8, 16 doubling) the series is solved.',
    'Always test differences first, then ratios, then the difference of the differences.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the common difference', prompt: 'An arithmetic series starts at 5 and adds 2 each time (5, 7, 9, …). What happens to the 7th term if the step is doubled to 4?',
      base: { k: 1, a: 5, d: 2, n: 6 }, test: { d: 4 }, options: ['The next term doubles', 'The next term rises, but by less than double', 'The next term more than doubles', 'The next term is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => {
        const r = outs(test).nx! / outs(base).nx!;
        return Math.abs(r - 2) < 1e-9 ? 0 : r > 2 ? 2 : r > 1 ? 1 : 3;
      },
      why: ({ base, test, outs }) => `The next term is a + n × d. It goes from ${fmt(outs(base).nx!, 0)} to ${fmt(outs(test).nx!, 0)}. Only the part n × d doubles; the first term 5 does not, so the whole term rises by less than double.`,
    },
    {
      id: 'p2', title: 'Add 2 or multiply by 2?', prompt: 'A series starts at 2. With the rule "add 2" the 6th term is 12. The rule is changed to "multiply by 2". What is the 6th term?',
      base: { k: 1, a: 2, d: 2, n: 6 }, test: { k: 2 }, options: ['12', '32', '64', '128'], answer: 2,
      verify: ({ test, outs }) => closest(outs(test).tn!, [12, 32, 64, 128]),
      why: ({ base, test, outs }) => `Geometric: 2, 4, 8, 16, 32, 64. The 6th term is 2 × 2⁵ = ${fmt(outs(test).tn!, 0)}, against ${fmt(outs(base).tn!, 0)} for the arithmetic rule.`,
    },
    {
      id: 'p3', title: 'Same start, different rule', prompt: 'Both series begin 3, 7 and have step d = 4. Rule 1 adds 4 each time (3, 7, 11, 15). Rule 3 uses differences 4, 8, 16, …. What is the term after the 4th under rule 3?',
      base: { k: 1, a: 3, d: 4, n: 4 }, test: { k: 3 }, options: ['47', '55', '63', '71'], answer: 2,
      verify: ({ test, outs }) => closest(outs(test).nx!, [47, 55, 63, 71]),
      why: ({ base, test, outs }) => `Rule 3 gives 3, 7, 15, 31 and then 31 + 32 = ${fmt(outs(test).nx!, 0)}. Rule 1 would have given only ${fmt(outs(base).nx!, 0)}.`,
    },
    {
      id: 'p4', title: 'Twice as many terms', prompt: 'For 1, 2, 3, 4, … the sum of the first 10 terms is 55. If the number of terms is doubled to 20, the sum becomes about',
      base: { k: 1, a: 1, d: 1, n: 10 }, test: { n: 20 }, options: ['twice as large', 'four times as large', 'eight times as large', 'the same'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).sm! / outs(base).sm!, [2, 4, 8, 1]),
      why: ({ base, test, outs }) => `The sum grows with the square of n: it goes from ${fmt(outs(base).sm!, 0)} to ${fmt(outs(test).sm!, 0)}, a factor of ${fmt(outs(test).sm! / outs(base).sm!, 2)}, about four.`,
    },
  ],
  measure: {
    instruction: 'Keep rule 1 (arithmetic) with a fixed first term and step. Record the n-th term for at least three different values of n.',
    vary: 'n',
    record: ['tn', 'nx', 'sm'],
    fit: {
      xLabel: 'term number n',
      yLabel: 'n-th term',
      x: (v) => v.n!,
      y: (_v, o) => o.tn!,
      interpret: (slope, intercept, v) => `The terms of an arithmetic series lie on a straight line against n. The slope is the common difference = ${fmt(slope, 2)} (the slider is set to ${v.d}) and the intercept ${fmt(intercept, 2)} equals a − d, so the first term is a = intercept + slope = ${fmt(intercept + slope, 2)}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Find the next term of the series 2, 5, 8, 11, ?', options: ['13', '14', '15', '16'], answer: 1,
      why: 'The differences are 3, 3, 3, so it is arithmetic with d = 3. The next term is 11 + 3 = 14.',
      verify: () => closest(term(1, 2, 3, 5), [13, 14, 15, 16]),
    },
    {
      id: 'q2', q: 'Find the next term of the series 5, 10, 20, 40, ?', options: ['60', '70', '80', '100'], answer: 2,
      why: 'Each term is multiplied by 2 (geometric). The next term is 40 × 2 = 80.',
      verify: () => closest(term(2, 5, 2, 5), [60, 70, 80, 100]),
    },
    {
      id: 'q3', q: 'Find the next term of the series 3, 7, 15, 31, ?', options: ['63', '62', '64', '47'], answer: 0,
      why: 'The differences are 4, 8, 16 and they double, so the next difference is 32. The next term is 31 + 32 = 63.',
      verify: () => closest(term(3, 3, 4, 5), [63, 62, 64, 47]),
    },
    {
      id: 'q4', q: 'Take A = 1, B = 2, … Z = 26. Which letter comes next in the series C, F, I, L, ?', options: ['N', 'O', 'P', 'Q'], answer: 1,
      why: 'The positions are 3, 6, 9, 12: add 3 each time. The next position is 15, which is the letter O.',
      verify: () => 'NOPQ'.indexOf(String.fromCharCode(64 + term(1, 3, 3, 5))),
    },
    {
      id: 'q5', q: 'Find the next term of the series 2, 3, 5, 9, 17, ?', options: ['25', '31', '33', '35'], answer: 2,
      why: 'The differences are 1, 2, 4, 8, which double. The next difference is 16, so the next term is 17 + 16 = 33.',
      verify: () => closest(term(3, 2, 1, 6), [25, 31, 33, 35]),
    },
  ],
};
