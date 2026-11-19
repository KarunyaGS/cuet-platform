/**
 * Chapter lab: Mathematics (319), "Probability distributions: random variables, expectation, variance, binomial, Poisson and normal
 * distributions", section "Binomial distribution".
 * Model: X ~ B(n, p): P(X = r) = nCr p^r q^(n-r), mean np, variance npq, sigma = sqrt(npq), q = 1 - p.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const choose = (n: number, r: number) => {
  if (r < 0 || r > n) return 0;
  let c = 1;
  for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i;
  return c;
};
const pmf = (n: number, p: number, r: number) => (r < 0 || r > n ? 0 : choose(n, r) * Math.pow(p, r) * Math.pow(1 - p, n - r));
const cdf = (n: number, p: number, r: number) => {
  let s = 0;
  for (let i = 0; i <= Math.min(r, n); i++) s += pmf(n, p, i);
  return s;
};
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const RMAX = 20;

export const spec: Spec = {
  id: 'math-binomial-bars',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Probability distributions: random variables',
  afterHeading: 'Binomial distribution',
  title: 'Binomial Distribution Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose the number of trials n and the success probability p and watch the bars of the binomial distribution, its mean np, its variance npq and the probability of at most r successes.',
  can: ['See how n and p reshape the bars P(X = r) of a binomial distribution', 'Read the mean np and the variance npq and see that the variance is smaller than the mean', 'Record the mean for three values of n and read p from the slope'],
  minutes: 10,
  vars: [
    { id: 'n', label: 'Number of trials n', unit: '', min: 1, max: 20, step: 1, start: 4, digits: 0 },
    { id: 'p', label: 'Probability of success p', unit: '', min: 0.05, max: 0.95, step: 0.05, start: 0.5, digits: 2 },
    { id: 'r', label: 'Number of successes r (counted as n if larger)', unit: '', min: 0, max: 20, step: 1, start: 2, digits: 0 },
  ],
  outs: [
    { id: 'pr', label: 'P(X = r) = ⁿCr pʳ qⁿ⁻ʳ', unit: '', fn: (v) => pmf(v.n!, v.p!, Math.min(v.r!, v.n!)), digits: 4 },
    { id: 'cdf', label: 'P(X ≤ r)', unit: '', fn: (v) => cdf(v.n!, v.p!, Math.min(v.r!, v.n!)), digits: 4 },
    { id: 'mean', label: 'Mean μ = np', unit: '', fn: (v) => v.n! * v.p!, digits: 2 },
    { id: 'var', label: 'Variance σ² = npq', unit: '', fn: (v) => v.n! * v.p! * (1 - v.p!), digits: 3 },
    { id: 'sd', label: 'Standard deviation σ = √(npq)', unit: '', fn: (v) => Math.sqrt(v.n! * v.p! * (1 - v.p!)), digits: 3 },
    { id: 'ge1', label: 'P(X ≥ 1) = 1 − qⁿ', unit: '', fn: (v) => 1 - pmf(v.n!, v.p!, 0), digits: 4 },
  ],
  graphs: [
    { id: 'cdf-p', title: 'P(X ≤ r) against the success probability p', x: 'p', y: 'cdf' },
    { id: 'var-p', title: 'Variance npq against p', x: 'p', y: 'var' },
    { id: 'ge1-n', title: 'P(X ≥ 1) against the number of trials n', x: 'n', y: 'ge1' },
  ],
  sceneAlt: 'A bar chart of the binomial probabilities P(X = r) for r = 0 up to 20. Bars up to the chosen r are orange and the bar at r is dark; a vertical line marks the mean np. The bars move right as n and p grow.',
  scene: ({ v, o }) => {
    const n = v.n!, p = v.p!;
    const rr = Math.min(v.r!, n);
    const probs = Array.from({ length: RMAX + 1 }, (_, r) => pmf(n, p, r));
    const top = Math.max(...probs);
    const bw = 360 / (RMAX + 1);
    const H = 140;
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={20} y1={185} x2={380} y2={185} stroke="#7c8595" />
        {probs.map((pr, r) => {
          if (r > n) return <text key={r} x={20 + bw * (r + 0.5)} y={198} fontSize={8} textAnchor="middle" opacity={0.35}>{r}</text>;
          const h = (pr / top) * H;
          return (
            <g key={r}>
              <rect x={20 + bw * r + 1.5} y={185 - h} width={bw - 3} height={Math.max(h, 0.5)} fill={r === rr ? '#18443b' : r < rr ? '#c45e42' : '#9db3d6'} />
              <text x={20 + bw * (r + 0.5)} y={198} fontSize={8} textAnchor="middle">{r}</text>
            </g>
          );
        })}
        <line x1={20 + bw * (o.mean! + 0.5)} y1={40} x2={20 + bw * (o.mean! + 0.5)} y2={185} stroke="#2563a8" strokeDasharray="4 3" strokeWidth={1.6} />
        <text x={20 + bw * (o.mean! + 0.5) + 4} y={52} fill="#2563a8">mean np = {fmt(o.mean!, 2)}</text>
        <text x={20} y={16} fontSize={12} fontWeight="bold" fill="#18443b">B({n}, {fmt(p, 2)}): P(X = {rr}) = {fmt(o.pr!, 4)} · P(X ≤ {rr}) = {fmt(o.cdf!, 4)}</text>
        <text x={20} y={30}>orange bars: X ≤ r · dark bar: X = r · tallest bar scaled to the box ({fmt(top, 3)})</text>
        <text x={200} y={222} textAnchor="middle">number of successes r</text>
      </g>
    );
  },
  discover: [
    'Raise n and watch the bars spread to the right and the mean line move. How does the mean relate to n and p?',
    'Move p towards 0.05 and towards 0.95. Which way are the bars skewed in each case?',
    'Move r and read P(X ≤ r): which bars does it add up?',
  ],
  experiment: [
    'Set p = 0.5 and then 0.9 for the same n. Compare the variance npq: when is it largest?',
    'Check that the variance is always smaller than the mean, as the lesson says.',
    'For n = 5 and p = 0.2 read P(X ≥ 1). How does it compare with 1 − (0.8)⁵?',
  ],
  understand: [
    'For X ~ B(n, p): P(X = r) = ⁿCr pʳ qⁿ⁻ʳ with q = 1 − p, mean np, variance npq and standard deviation √(npq).',
    'The variance npq is always less than the mean np because q < 1; it is largest for p = 0.5.',
    '"At least one" is easiest through the complement: P(X ≥ 1) = 1 − P(X = 0) = 1 − qⁿ.',
    'The binomial model needs a fixed number of independent trials with the same p; drawing without replacement from a small lot breaks independence.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the trials', prompt: 'A coin is tossed 4 times (n = 4, p = 0.5, mean 2). It is now tossed 8 times. What happens to the mean number of heads?',
      base: { n: 4, p: 0.5, r: 2 }, test: { n: 8 }, options: ['It doubles', 'It stays the same', 'It halves', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).mean! / outs(base).mean!, [2, 1, 0.5, 4]),
      why: ({ base, test, outs }) => `The mean is np, proportional to n. It goes from ${fmt(outs(base).mean!, 1)} to ${fmt(outs(test).mean!, 1)}.`,
    },
    {
      id: 'p2', title: 'A very likely success', prompt: 'With n = 10 the success probability is raised from p = 0.5 to p = 0.9. What happens to the variance npq?',
      base: { n: 10, p: 0.5, r: 5 }, test: { p: 0.9 }, options: ['It rises, because the mean rises', 'It falls, because q becomes small', 'It stays the same', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).var! > outs(base).var! ? 0 : outs(test).var! < outs(base).var! ? 1 : 2),
      why: ({ base, test, outs }) => `The variance npq goes from ${fmt(outs(base).var!, 2)} to ${fmt(outs(test).var!, 2)}. Nearly every trial succeeds, so the results are bunched near n and the spread is small; the variance is largest at p = 0.5.`,
    },
    {
      id: 'p3', title: 'More bulbs in the box', prompt: 'Each bulb is defective with probability 0.2. A box of 5 bulbs has P(at least one defective) = 0.672. The box is changed to 10 bulbs. What happens to this probability?',
      base: { n: 5, p: 0.2, r: 1 }, test: { n: 10 }, options: ['It rises towards 1', 'It falls', 'It stays 0.672', 'It becomes exactly 1'], answer: 0,
      verify: ({ base, test, outs }) => { const a = outs(base).ge1!, b = outs(test).ge1!; return b > a && b < 1 - 1e-12 ? 0 : b < a ? 1 : Math.abs(b - 1) < 1e-12 ? 3 : 2; },
      why: ({ base, test, outs }) => `P(X ≥ 1) = 1 − (0.8)ⁿ. It goes from ${fmt(outs(base).ge1!, 4)} to ${fmt(outs(test).ge1!, 4)}: it approaches 1 but never reaches it.`,
    },
    {
      id: 'p4', title: 'Success probability 0.2 or 0.8', prompt: 'With n = 10 and p = 0.2 the mean is 2 and the tallest bar is near r = 2. The probability is changed to p = 0.8. Where is the mean (and the tallest bar) now?',
      base: { n: 10, p: 0.2, r: 2 }, test: { p: 0.8 }, options: ['Near r = 8', 'Still near r = 2', 'Near r = 5', 'At r = 10 exactly'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).mean!, [8, 2, 5, 10]),
      why: ({ base, test, outs }) => `The mean np goes from ${fmt(outs(base).mean!, 1)} to ${fmt(outs(test).mean!, 1)}. The picture is mirrored: p = 0.8 skews the bars to the left (a long tail towards small r) while p = 0.2 skewed them to the right.`,
    },
  ],
  measure: {
    instruction: 'Keep p fixed. Record the mean number of successes for at least three different numbers of trials n.',
    vary: 'n',
    record: ['mean', 'var'],
    fit: {
      xLabel: 'number of trials n',
      yLabel: 'mean np',
      x: (v) => v.n!,
      y: (_v, o) => o.mean!,
      interpret: (slope, intercept, v) => `The mean grows in proportion to n: a straight line through the origin (intercept ${fmt(intercept, 2)}). The slope is the success probability p = ${fmt(slope, 3)}, which matches the p = ${fmt(v.p!, 2)} you set.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A fair coin is tossed 4 times. The probability of getting exactly 2 heads is', options: ['1/2', '3/8', '1/4', '5/16'], answer: 1,
      why: 'X ~ B(4, ½): P(X = 2) = ⁴C₂ (½)² (½)² = 6/16 = 3/8.',
      verify: () => near(pmf(4, 0.5, 2), [1 / 2, 3 / 8, 1 / 4, 5 / 16]),
    },
    {
      id: 'q2', q: 'For the number of heads in 4 tosses of a fair coin, the mean and the variance are', options: ['2 and 2', '1 and 2', '2 and 1', '4 and 1'], answer: 2,
      why: 'Mean = np = 4 × ½ = 2 and variance = npq = 4 × ½ × ½ = 1. The variance is smaller than the mean because q < 1.',
      verify: () => ['2 and 2', '1 and 2', '2 and 1', '4 and 1'].indexOf(`${4 * 0.5} and ${4 * 0.5 * 0.5}`),
    },
    {
      id: 'q3', q: 'The probability that a bulb is defective is 0.2. In a box of 5 bulbs the probability that at least one is defective is', options: ['0.2', '0.32768', '0.8', '0.67232'], answer: 3,
      why: 'X ~ B(5, 0.2). P(X ≥ 1) = 1 − P(X = 0) = 1 − (0.8)⁵ = 1 − 0.32768 = 0.67232.',
      verify: () => near(1 - pmf(5, 0.2, 0), [0.2, 0.32768, 0.8, 0.67232]),
    },
    {
      id: 'q4', q: 'A binomial variable has mean 6 and variance 2.4. The number of trials n is', options: ['12', '10', '15', '8'], answer: 1,
      why: 'np = 6 and npq = 2.4, so q = 2.4/6 = 0.4 and p = 0.6. Then n = 6/0.6 = 10.',
      verify: () => { const mean = 6, v = 2.4; const q = v / mean; return near(mean / (1 - q), [12, 10, 15, 8]); },
    },
    {
      id: 'q5', q: 'A fair die is thrown 3 times. The probability of getting exactly one six is', options: ['0.5787', '0.1389', '0.3472', '0.4'], answer: 2,
      why: 'X ~ B(3, 1/6): P(X = 1) = ³C₁ (1/6)(5/6)² = 75/216 ≈ 0.3472.',
      verify: () => near(pmf(3, 1 / 6, 1), [0.5787, 0.1389, 0.3472, 0.4]),
    },
  ],
};
