/**
 * Chapter lab: Mathematics (319), "Simple probability: events, rules, conditional probability, independence and the step to
 * probability distributions", section "Total probability and Bayes theorem".
 * Model: E1 and E2 partition the sample space; A is another event.
 * P(A) = P(E1)P(A|E1) + P(E2)P(A|E2); P(E1|A) = P(E1)P(A|E1) / P(A); P(E1 u A) = P(E1) + P(A) - P(E1 and A).
 * A and E1 are independent exactly when P(A|E1) = P(A). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const total = (pe: number, a1: number, a2: number) => pe * a1 + (1 - pe) * a2;
const bayes = (pe: number, a1: number, a2: number) => { const t = total(pe, a1, a2); return t < 1e-12 ? 0 : (pe * a1) / t; };
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const X0 = 50, W = 300, Y0 = 40, H = 150;

export const spec: Spec = {
  id: 'math-bayes-total-probability',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Simple probability',
  afterHeading: 'Total probability and Bayes theorem',
  title: 'Total Probability and Bayes Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Split the sample space into two causes E₁ and E₂, set the chance that each produces the event A, and see the total probability P(A), the reversed probability P(E₁|A) and the independence test respond.',
  can: ['Build P(A) by adding the two branches of the probability tree', 'Reverse the conditioning with Bayes theorem and see how the prior P(E₁) matters', 'Find when A and E₁ are independent, so that P(A|E₁) = P(A)'],
  minutes: 11,
  vars: [
    { id: 'pe', label: 'Prior probability P(E₁)', unit: '', min: 0.05, max: 0.95, step: 0.05, start: 0.5, digits: 2, bounds: { min: 0.001, max: 0.999 } },
    { id: 'a1', label: 'Conditional P(A | E₁)', unit: '', min: 0, max: 1, step: 0.05, start: 0.6, digits: 2, bounds: { min: 0, max: 1 } },
    { id: 'a2', label: 'Conditional P(A | E₂)', unit: '', min: 0, max: 1, step: 0.05, start: 0.2, digits: 2, bounds: { min: 0, max: 1 } },
  ],
  outs: [
    { id: 'pA', label: 'Total probability P(A)', unit: '', fn: (v) => total(v.pe!, v.a1!, v.a2!), digits: 4 },
    { id: 'j1', label: 'P(E₁ and A) = P(E₁)P(A|E₁)', unit: '', fn: (v) => v.pe! * v.a1!, digits: 4 },
    { id: 'post', label: 'Bayes: P(E₁ | A)', unit: '', fn: (v) => bayes(v.pe!, v.a1!, v.a2!), digits: 4 },
    { id: 'post2', label: 'Bayes: P(E₂ | A)', unit: '', fn: (v) => { const t = total(v.pe!, v.a1!, v.a2!); return t < 1e-12 ? 0 : ((1 - v.pe!) * v.a2!) / t; }, digits: 4 },
    { id: 'union', label: 'P(E₁ or A) = P(E₁) + P(A) − P(E₁ and A)', unit: '', fn: (v) => v.pe! + total(v.pe!, v.a1!, v.a2!) - v.pe! * v.a1!, digits: 4 },
    { id: 'dep', label: 'P(A|E₁) − P(A) (0 means A and E₁ are independent)', unit: '', fn: (v) => v.a1! - total(v.pe!, v.a1!, v.a2!), digits: 4 },
  ],
  graphs: [
    { id: 'pa-pe', title: 'Total probability P(A) against the prior P(E₁)', x: 'pe', y: 'pA' },
    { id: 'post-pe', title: 'Bayes P(E₁|A) against the prior P(E₁)', x: 'pe', y: 'post' },
    { id: 'post-a2', title: 'Bayes P(E₁|A) against P(A|E₂)', x: 'a2', y: 'post' },
  ],
  sceneAlt: 'A unit square split into two columns, E1 on the left with width P(E1) and E2 on the right. In each column the shaded part from the bottom has height P(A given that column), so the orange total area is P(A) and the dark share inside E1 is P(E1 and A). The picture reshapes as the three sliders move.',
  scene: ({ v, o }) => {
    const w1 = W * v.pe!;
    const h1 = H * v.a1!, h2 = H * v.a2!;
    return (
      <g fontSize={10} fill="#4d5768">
        <rect x={X0} y={Y0} width={W} height={H} fill="#fff" stroke="#7c8595" />
        <line x1={X0 + w1} y1={Y0 - 6} x2={X0 + w1} y2={Y0 + H + 6} stroke="#7c8595" />
        <rect x={X0} y={Y0 + H - h1} width={w1} height={h1} fill="#18443b" fillOpacity={0.8} />
        <rect x={X0 + w1} y={Y0 + H - h2} width={W - w1} height={h2} fill="#c45e42" fillOpacity={0.7} />
        <text x={X0 + w1 / 2} y={Y0 - 10} textAnchor="middle" fill="#18443b" fontWeight="bold">E₁: {fmt(v.pe!, 2)}</text>
        <text x={X0 + w1 + (W - w1) / 2} y={Y0 - 10} textAnchor="middle" fill="#c45e42" fontWeight="bold">E₂: {fmt(1 - v.pe!, 2)}</text>
        {h1 > 12 && w1 > 40 && <text x={X0 + w1 / 2} y={Y0 + H - h1 / 2 + 4} textAnchor="middle" fill="#fff">{fmt(o.j1!, 3)}</text>}
        {h2 > 12 && W - w1 > 40 && <text x={X0 + w1 + (W - w1) / 2} y={Y0 + H - h2 / 2 + 4} textAnchor="middle" fill="#fff">{fmt((1 - v.pe!) * v.a2!, 3)}</text>}
        <text x={X0} y={Y0 + H + 18}>height of shading = P(A | cause) · area = P(A and cause)</text>
        <text x={200} y={Y0 + H + 36} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#18443b">P(A) = {fmt(o.pA!, 3)} · P(E₁|A) = {fmt(o.post!, 3)} (green share of the shaded area)</text>
      </g>
    );
  },
  discover: [
    'Move the prior P(E₁): the dividing line slides, and the shaded total area P(A) changes. By how much per step?',
    'The green part of the shaded area is the share of A that comes from E₁. Read it as P(E₁ | A).',
    'Set P(A|E₁) equal to P(A|E₂) and watch the independence reading.',
  ],
  experiment: [
    'Keep P(A|E₁) = 0.6 and P(A|E₂) = 0.2 and move P(E₁) from 0.05 to 0.95. How does the reversed probability P(E₁|A) change compared with P(A)?',
    'Make P(A|E₂) = 0. What does Bayes theorem give for P(E₁|A)?',
    'Find a setting with P(A|E₁) = P(A). What is P(E₁|A) then?',
  ],
  understand: [
    'Total probability: P(A) = P(E₁)P(A|E₁) + P(E₂)P(A|E₂). Multiply along each branch and add the branches that end in A.',
    'Bayes theorem reverses the conditioning: P(E₁|A) = P(E₁)P(A|E₁)/P(A); the prior P(E₁) matters, not just the likelihood P(A|E₁).',
    'A and E₁ are independent when P(A|E₁) = P(A), equivalently P(E₁ and A) = P(E₁)P(A); then knowing A does not change the probability of E₁.',
    'The union rule: P(E₁ or A) = P(E₁) + P(A) − P(E₁ and A), because the overlap is counted twice.',
  ],
  preds: [
    {
      id: 'p1', title: 'A likelier first cause', prompt: 'A bag is chosen at random (P(E₁) = 0.5): bag 1 gives red with 0.6, bag 2 with 0.2, and P(E₁ | red) = 0.75. If bag 1 is chosen with probability 0.8 instead, what happens to P(E₁ | red)?',
      base: { pe: 0.5, a1: 0.6, a2: 0.2 }, test: { pe: 0.8 }, options: ['It rises above 0.75', 'It falls below 0.75', 'It stays 0.75', 'It becomes 0.5'], answer: 0,
      verify: ({ base, test, outs }) => { const b = outs(base).post!, t = outs(test).post!; return t > b + 1e-9 ? 0 : t < b - 1e-9 ? 1 : 2; },
      why: ({ base, test, outs }) => `P(E₁|A) = P(E₁)P(A|E₁)/P(A). With the larger prior it goes from ${fmt(outs(base).post!, 3)} to ${fmt(outs(test).post!, 3)}: a red ball is even more likely to have come from the bag that is chosen more often.`,
    },
    {
      id: 'p2', title: 'A does not depend on the cause', prompt: 'Bag 2 now gives red with the same probability 0.6 as bag 1 (P(A|E₂) raised from 0.2 to 0.6). Given a red ball, what is P(E₁ | red)?',
      base: { pe: 0.5, a1: 0.6, a2: 0.2 }, test: { a2: 0.6 }, options: ['0.5, the prior: the colour tells nothing', '0.75 as before', '1', '0'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).post!, [0.5, 0.75, 1, 0]),
      why: ({ base, test, outs }) => `P(A) = 0.6 = P(A|E₁), so A and E₁ are independent (dependence reading ${fmt(outs(test).dep!, 2)}). P(E₁|A) goes from ${fmt(outs(base).post!, 2)} to ${fmt(outs(test).post!, 2)}, which is just the prior P(E₁).`,
    },
    {
      id: 'p3', title: 'A surer first cause', prompt: 'P(A|E₁) is raised from 0.6 to 0.9 (P(E₁) = 0.5, P(A|E₂) = 0.2). What happens to P(A) and to P(E₁|A)?',
      base: { pe: 0.5, a1: 0.6, a2: 0.2 }, test: { a1: 0.9 }, options: ['Both rise', 'P(A) rises and P(E₁|A) falls', 'P(A) is unchanged', 'Both fall'], answer: 0,
      verify: ({ base, test, outs }) => { const a = outs(test).pA! - outs(base).pA!, b = outs(test).post! - outs(base).post!; return a > 0 && b > 0 ? 0 : a > 0 ? 1 : Math.abs(a) < 1e-9 ? 2 : 3; },
      why: ({ base, test, outs }) => `P(A) = 0.5 × P(A|E₁) + 0.5 × 0.2 goes from ${fmt(outs(base).pA!, 2)} to ${fmt(outs(test).pA!, 2)}, and the share from E₁ goes from ${fmt(outs(base).post!, 3)} to ${fmt(outs(test).post!, 3)}.`,
    },
    {
      id: 'p4', title: 'A only through E₁', prompt: 'Bag 2 can never give red (P(A|E₂) lowered from 0.2 to 0). A red ball is drawn. What is P(E₁ | red)?',
      base: { pe: 0.5, a1: 0.6, a2: 0.2 }, test: { a2: 0 }, options: ['1: it must have come from bag 1', '0.5', '0.75 as before', '0'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).post!, [1, 0.5, 0.75, 0]),
      why: ({ base, test, outs }) => `P(E₁|A) = 0.5 × 0.6/(0.5 × 0.6 + 0) = ${fmt(outs(test).post!, 2)}. It goes from ${fmt(outs(base).post!, 2)} to ${fmt(outs(test).post!, 2)}: all the shaded area now lies in the E₁ column.`,
    },
  ],
  measure: {
    instruction: 'Keep the two conditional probabilities fixed. Record the total probability P(A) for at least three different priors P(E₁).',
    vary: 'pe',
    record: ['pA', 'post'],
    fit: {
      xLabel: 'P(E₁)',
      yLabel: 'P(A)',
      x: (v) => v.pe!,
      y: (_v, o) => o.pA!,
      interpret: (slope, intercept, v) => `P(A) = P(E₁)P(A|E₁) + (1 − P(E₁))P(A|E₂) is a straight line in P(E₁). Its slope ${fmt(slope, 3)} is P(A|E₁) − P(A|E₂) = ${fmt(v.a1! - v.a2!, 2)} and its intercept ${fmt(intercept, 3)} is P(A|E₂) = ${fmt(v.a2!, 2)}, the value when E₂ is certain.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Bag A has 3 red and 2 blue balls; bag B has 1 red and 4 blue balls. A bag is chosen at random and a ball is drawn. The probability that it is red is', options: ['3/10', '2/5', '1/2', '3/5'], answer: 1,
      why: 'P(red) = ½ × 3/5 + ½ × 1/5 = 3/10 + 1/10 = 4/10 = 2/5.',
      verify: () => near(total(0.5, 3 / 5, 1 / 5), [3 / 10, 2 / 5, 1 / 2, 3 / 5]),
    },
    {
      id: 'q2', q: 'In the same experiment the ball drawn is red. The probability that it came from bag A is', options: ['1/2', '2/3', '3/5', '3/4'], answer: 3,
      why: 'By Bayes theorem P(A | red) = (½ × 3/5)/(2/5) = (3/10)/(4/10) = 3/4.',
      verify: () => near(bayes(0.5, 3 / 5, 1 / 5), [1 / 2, 2 / 3, 3 / 5, 3 / 4]),
    },
    {
      id: 'q3', q: 'Machine 1 makes 60% of the items and 2% of them are defective; machine 2 makes 40% and 5% of them are defective. An item is chosen at random. The probability that it is defective is', options: ['0.032', '0.07', '0.035', '0.02'], answer: 0,
      why: 'P(D) = 0.6 × 0.02 + 0.4 × 0.05 = 0.012 + 0.020 = 0.032.',
      verify: () => near(total(0.6, 0.02, 0.05), [0.032, 0.07, 0.035, 0.02]),
    },
    {
      id: 'q4', q: 'The chosen item of the previous question is found to be defective. The probability that it was made by machine 1 is', options: ['0.6', '0.4', '0.375', '0.5'], answer: 2,
      why: 'P(M₁ | D) = (0.6 × 0.02)/0.032 = 0.012/0.032 = 0.375, less than the prior 0.6 because machine 2 is more likely to produce defectives.',
      verify: () => near(bayes(0.6, 0.02, 0.05), [0.6, 0.4, 0.375, 0.5]),
    },
    {
      id: 'q5', q: 'Two persons shoot at a target independently and hit it with probability 0.6 and 0.5. The probability that the target is hit by at least one of them is', options: ['1.1', '0.3', '0.9', '0.8'], answer: 3,
      why: 'P(A or B) = P(A) + P(B) − P(A)P(B) = 0.6 + 0.5 − 0.3 = 0.8; equivalently 1 − (0.4)(0.5) = 0.8.',
      verify: () => near(0.6 + 0.5 - 0.6 * 0.5, [1.1, 0.3, 0.9, 0.8]),
    },
  ],
};
