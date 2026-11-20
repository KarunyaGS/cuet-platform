/**
 * Chapter lab: Mathematics (319), "Numbers and quantification: modular arithmetic, mixtures, boats, pipes, races and inequalities",
 * section "Allegation and mixture".
 * Model: q_cheaper : q_dearer = (p_dearer - m) : (m - p_cheaper) for a mixture of mean price m; cost of mixture = q1 p1 + q2 p2.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const ratio = (p1: number, p2: number, m: number) => (p2 - m) / (m - p1);
const qCheap = (p1: number, p2: number, m: number, T: number) => (T * (p2 - m)) / (p2 - p1);
const qDear = (p1: number, p2: number, m: number, T: number) => (T * (m - p1)) / (p2 - p1);
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const PX = (p: number) => 30 + ((p - 20) / 80) * 340; // price 20..100 -> x

export const spec: Spec = {
  id: 'math-allegation-mixture',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Numbers and quantification',
  afterHeading: 'Allegation and mixture',
  title: 'Rule of Allegation Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Mix a cheaper and a dearer item to reach a required mean price. Move the three prices and see the ratio change as a balance, and check the cost of the mixture.',
  can: ['Balance the cheaper and dearer quantities about the mean price like a seesaw', 'Predict how the ratio changes when a price or the target mean moves', 'Record the cost of the mixture for three total quantities and read the mean price from the slope'],
  minutes: 9,
  vars: [
    { id: 'p1', label: 'Cheaper price', unit: 'Rs/kg', min: 20, max: 45, step: 1, start: 40, digits: 0, choice: true },
    { id: 'p2', label: 'Dearer price', unit: 'Rs/kg', min: 55, max: 100, step: 1, start: 55, digits: 0, choice: true },
    { id: 'm', label: 'Required mean price m of the mixture', unit: 'Rs/kg', min: 46, max: 54, step: 1, start: 46, digits: 0, choice: true },
    { id: 'T', label: 'Total quantity of the mixture', unit: 'kg', min: 5, max: 50, step: 5, start: 5, digits: 0 },
  ],
  outs: [
    { id: 'r', label: 'Ratio cheaper : dearer = (p₂ − m) : (m − p₁), shown as a number', unit: '', fn: (v) => ratio(v.p1!, v.p2!, v.m!), digits: 2 },
    { id: 'qc', label: 'Quantity of the cheaper item', unit: 'kg', fn: (v) => qCheap(v.p1!, v.p2!, v.m!, v.T!), digits: 2 },
    { id: 'qd', label: 'Quantity of the dearer item', unit: 'kg', fn: (v) => qDear(v.p1!, v.p2!, v.m!, v.T!), digits: 2 },
    { id: 'cost', label: 'Cost of the mixture = q₁p₁ + q₂p₂', unit: 'Rs', fn: (v) => qCheap(v.p1!, v.p2!, v.m!, v.T!) * v.p1! + qDear(v.p1!, v.p2!, v.m!, v.T!) * v.p2!, digits: 1 },
    { id: 'mean', label: 'Mean price = cost ÷ total quantity', unit: 'Rs/kg', fn: (v) => (qCheap(v.p1!, v.p2!, v.m!, v.T!) * v.p1! + qDear(v.p1!, v.p2!, v.m!, v.T!) * v.p2!) / v.T!, digits: 2 },
  ],
  graphs: [
    { id: 'r-m', title: 'Ratio cheaper : dearer against the mean price', x: 'm', y: 'r' },
    { id: 'qc-m', title: 'Cheaper quantity against the mean price', x: 'm', y: 'qc' },
    { id: 'cost-t', title: 'Cost of the mixture against its total quantity', x: 'T', y: 'cost' },
  ],
  sceneAlt: 'A price line from Rs 20 to Rs 100 with a triangle (the fulcrum) at the required mean price. A block for the cheaper item hangs at its price and a block for the dearer item at its price; their heights follow the two quantities and the distances to the fulcrum follow the differences in the rule of allegation.',
  scene: ({ v, o }) => {
    const x1 = PX(v.p1!), x2 = PX(v.p2!), xm = PX(v.m!);
    const h1 = 8 + (o.qc! / 50) * 85;
    const h2 = 8 + (o.qd! / 50) * 85;
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={20} y1={150} x2={380} y2={150} stroke="#7c8595" strokeWidth={2} />
        <polygon points={`${xm - 9},170 ${xm + 9},170 ${xm},151`} fill="#18443b" />
        <rect x={x1 - 14} y={150 - h1} width={28} height={h1} fill="#2563a8" fillOpacity={0.7} />
        <rect x={x2 - 14} y={150 - h2} width={28} height={h2} fill="#c45e42" fillOpacity={0.75} />
        <text x={x1} y={150 - h1 - 4} textAnchor="middle" fill="#2563a8">{fmt(o.qc!, 1)} kg</text>
        <text x={x2} y={150 - h2 - 4} textAnchor="middle" fill="#c45e42">{fmt(o.qd!, 1)} kg</text>
        <text x={x1} y={164} textAnchor="middle">Rs {v.p1}</text>
        <text x={x2} y={164} textAnchor="middle">Rs {v.p2}</text>
        <text x={xm} y={186} textAnchor="middle" fontWeight="bold" fill="#18443b">mean Rs {v.m}</text>
        <path d={`M ${x1} 196 H ${xm}`} stroke="#c45e42" strokeWidth={1.5} />
        <path d={`M ${xm} 196 H ${x2}`} stroke="#2563a8" strokeWidth={1.5} />
        <text x={(x1 + xm) / 2} y={210} textAnchor="middle" fill="#c45e42">m − p₁ = {v.m! - v.p1!}</text>
        <text x={(xm + x2) / 2} y={210} textAnchor="middle" fill="#2563a8">p₂ − m = {v.p2! - v.m!}</text>
        <text x={200} y={26} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#18443b">cheaper : dearer = {v.p2! - v.m!} : {v.m! - v.p1!} = {fmt(o.r!, 2)}</text>
        <text x={200} y={42} textAnchor="middle">the cheaper item gets the difference on the dearer side</text>
      </g>
    );
  },
  discover: [
    'Move the required mean price m towards the cheaper price. Which block grows, and why?',
    'Read the two distances under the seesaw: they are the two terms of the ratio, taken crosswise.',
    'Change the total quantity and see what changes (the quantities) and what does not (the ratio).',
  ],
  experiment: [
    'Set m exactly halfway between the two prices. What ratio do you get?',
    'Raise the dearer price while keeping m fixed. Does the mixture need more or less of the cheaper item?',
    'Check that the cost divided by the total quantity always returns the mean price m.',
  ],
  understand: [
    'The cheaper item\'s quantity goes with the difference on the dearer side: cheaper : dearer = (p_dearer − m) : (m − p_cheaper), valid when p_cheaper < m < p_dearer.',
    'The mean price is the balance point: the mean is closer to the price of the item used in larger quantity.',
    'The mean price of a mixture of q₁ and q₂ units is (q₁p₁ + q₂p₂)/(q₁ + q₂); for equal quantities it is the simple average of p₁ and p₂.',
    'The ratio does not depend on the total quantity; only the two quantities themselves scale with it.',
  ],
  preds: [
    {
      id: 'p1', title: 'Raise the target price', prompt: 'Rice at Rs 40 and Rs 55 is mixed to give Rs 46 per kg (ratio 3 : 2). The required mean price is raised to Rs 50. What happens to the ratio cheaper : dearer?',
      base: { p1: 40, p2: 55, m: 46, T: 5 }, test: { m: 50 }, options: ['It rises above 3 : 2', 'It falls to 1 : 2', 'It stays 3 : 2', 'It becomes 1 : 1'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).r!; return Math.abs(r - outs(base).r!) < 1e-9 ? 2 : r > outs(base).r! ? 0 : Math.abs(r - 1) < 1e-9 ? 3 : 1; },
      why: ({ base, test, outs }) => `(55 − 50) : (50 − 40) = 5 : 10 = 1 : 2. The ratio falls from ${fmt(outs(base).r!, 2)} to ${fmt(outs(test).r!, 2)}: a dearer mixture needs less of the cheaper rice.`,
    },
    {
      id: 'p2', title: 'A much dearer second item', prompt: 'The cheaper rice costs Rs 40 and the mean price stays at Rs 46. The dearer rice now costs Rs 70 instead of Rs 55. What happens to the ratio cheaper : dearer?',
      base: { p1: 40, p2: 55, m: 46, T: 5 }, test: { p2: 70 }, options: ['It rises to 4 : 1', 'It falls to 1 : 4', 'It stays 3 : 2', 'It becomes 1 : 1'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).r!, [4, 0.25, 1.5, 1]),
      why: ({ base, test, outs }) => `(70 − 46) : (46 − 40) = 24 : 6 = 4 : 1. The ratio rises from ${fmt(outs(base).r!, 2)} to ${fmt(outs(test).r!, 2)}: because the dearer rice is so expensive, only a little of it can be added without passing the mean.`,
    },
    {
      id: 'p3', title: 'Double the batch', prompt: 'The mixture is made in a batch of 5 kg (3 kg cheaper, 2 kg dearer). The batch is doubled to 10 kg at the same prices. What happens?',
      base: { p1: 40, p2: 55, m: 46, T: 5 }, test: { T: 10 }, options: ['Both quantities double and the ratio stays 3 : 2', 'The ratio doubles to 3 : 1', 'Both quantities stay the same', 'Only the dearer quantity doubles'], answer: 0,
      verify: ({ base, test, outs }) => { const b = outs(base), t = outs(test); return Math.abs(t.qc! / b.qc! - 2) < 1e-9 && Math.abs(t.qd! / b.qd! - 2) < 1e-9 && Math.abs(t.r! - b.r!) < 1e-9 ? 0 : 1; },
      why: ({ base, test, outs }) => `The ratio ${fmt(outs(base).r!, 2)} is fixed by the three prices. The cheaper quantity goes from ${fmt(outs(base).qc!, 1)} kg to ${fmt(outs(test).qc!, 1)} kg and the dearer from ${fmt(outs(base).qd!, 1)} kg to ${fmt(outs(test).qd!, 1)} kg.`,
    },
    {
      id: 'p4', title: 'The simple average', prompt: 'Rice at Rs 44 and Rs 56 is mixed. The required mean price moves from Rs 46 to Rs 50, the simple average of the two prices. What happens to the ratio cheaper : dearer?',
      base: { p1: 44, p2: 56, m: 46, T: 5 }, test: { m: 50 }, options: ['It becomes 1 : 1 (equal quantities)', 'It becomes 2 : 1', 'It becomes 1 : 2', 'It stays 5 : 1'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).r!, [1, 2, 0.5, 5]),
      why: ({ base, test, outs }) => `(56 − 50) : (50 − 44) = 6 : 6 = 1 : 1. The ratio falls from ${fmt(outs(base).r!, 2)} to ${fmt(outs(test).r!, 2)}: with equal quantities the mean price is the simple average of the two prices.`,
    },
  ],
  measure: {
    instruction: 'Keep the three prices fixed. Record the cost of the mixture for at least three different total quantities.',
    vary: 'T',
    record: ['qc', 'qd', 'cost'],
    fit: {
      xLabel: 'total quantity T (kg)',
      yLabel: 'cost of the mixture (Rs)',
      x: (v) => v.T!,
      y: (_v, o) => o.cost!,
      interpret: (slope, intercept, v) => `The cost grows in proportion to the quantity: a straight line through the origin (intercept ${fmt(intercept, 2)}). The slope, Rs ${fmt(slope, 2)} per kg, is the mean price of the mixture, and it equals the required mean price m = Rs ${v.m!} you set.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Rice at Rs 40 per kg and Rs 55 per kg is mixed to get a mixture worth Rs 46 per kg. The ratio in which the cheaper and the dearer rice are mixed is', options: ['2 : 3', '3 : 2', '5 : 3', '1 : 1'], answer: 1,
      why: 'Cheaper : dearer = (55 − 46) : (46 − 40) = 9 : 6 = 3 : 2. Check: 3 kg at 40 and 2 kg at 55 cost 230 for 5 kg, which is Rs 46 per kg.',
      verify: () => near(ratio(40, 55, 46), [2 / 3, 3 / 2, 5 / 3, 1]),
    },
    {
      id: 'q2', q: 'Tea at Rs 60 per kg and Rs 80 per kg is mixed in the ratio 2 : 3. The price per kg of the mixture is', options: ['Rs 72', 'Rs 70', 'Rs 74', 'Rs 68'], answer: 0,
      why: 'Mean price = (2 × 60 + 3 × 80)/(2 + 3) = 360/5 = Rs 72. It lies closer to 80 because more of the dearer tea is used.',
      verify: () => near((2 * 60 + 3 * 80) / 5, [72, 70, 74, 68]),
    },
    {
      id: 'q3', q: 'In what ratio must sugar at Rs 42 per kg be mixed with sugar at Rs 48 per kg to get a mixture worth Rs 45 per kg?', options: ['1 : 2', '2 : 1', '1 : 1', '3 : 2'], answer: 2,
      why: 'Cheaper : dearer = (48 − 45) : (45 − 42) = 3 : 3 = 1 : 1. Rs 45 is the simple average of 42 and 48, so equal quantities are needed.',
      verify: () => near(ratio(42, 48, 45), [0.5, 2, 1, 1.5]),
    },
    {
      id: 'q4', q: 'Two solutions of 20% and 50% alcohol are mixed to get a solution of 30% alcohol. The ratio of the 20% solution to the 50% solution is', options: ['1 : 2', '3 : 2', '2 : 1', '2 : 3'], answer: 2,
      why: 'The same rule applies to strengths: (50 − 30) : (30 − 20) = 20 : 10 = 2 : 1. The 30% mixture is closer to 20%, so more of the weaker solution is used.',
      verify: () => near(ratio(20, 50, 30), [0.5, 1.5, 2, 2 / 3]),
    },
    {
      id: 'q5', q: '5 kg of rice at Rs 40 per kg is mixed with 3 kg of rice at Rs 56 per kg. The mean price of the mixture per kg is', options: ['Rs 48', 'Rs 47', 'Rs 50', 'Rs 46'], answer: 3,
      why: 'Total cost = 5 × 40 + 3 × 56 = 200 + 168 = 368 for 8 kg, so the mean price is 368/8 = Rs 46 per kg.',
      verify: () => near((5 * 40 + 3 * 56) / 8, [48, 47, 50, 46]),
    },
  ],
};
