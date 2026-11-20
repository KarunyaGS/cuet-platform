/**
 * Chapter lab: Mathematics (319), "Inferential statistics: sampling, central limit theorem and the one-sample t-test",
 * section "Hypothesis testing and the one-sample t-test".
 * Model: H0: mu = 50 against H1: mu != 50 (two-tailed). SE = s / sqrt(n), t = (xbar - 50) / SE, df = n - 1, reject H0 when
 * |t| exceeds the critical value of t for df at the level alpha. Critical values are computed from the t distribution
 * (they reproduce the lesson's table, e.g. 2.306 for df = 8 at 5%). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU0 = 50;
const lgamma = (x: number) => {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; s += c[j]! / y; }
  return -t + Math.log((2.5066282746310005 * s) / x);
};
const betacf = (a: number, b: number, x: number) => {
  const FP = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FP) d = FP;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c; if (Math.abs(c) < FP) c = FP;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP;
    c = 1 + aa / c; if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
};
const ibeta = (x: number, a: number, b: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
};
/** two-tailed probability P(|T| > t) for df = nu */
const twoTail = (t: number, nu: number) => ibeta(nu / (nu + t * t), nu / 2, 0.5);
/** critical value of t for a two-tailed test at level alpha (a fraction) */
const tCrit = (alpha: number, nu: number) => {
  let lo = 0, hi = 200;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (twoTail(m, nu) > alpha) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const pdf = (x: number, nu: number) => Math.exp(lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - ((nu + 1) / 2) * Math.log(1 + (x * x) / nu));
const sOf = (v: { n?: number; s?: number }) => v.s! / Math.sqrt(v.n!);
const tOf = (v: { n?: number; s?: number; xbar?: number }) => (v.xbar! - MU0) / sOf(v);
const crit = (v: { n?: number; al?: number }) => tCrit(v.al! / 100, v.n! - 1);
const near = (r: number, vals: number[]) => vals.reduce((bi, x, i) => (Math.abs(r - x) < Math.abs(r - vals[bi]!) ? i : bi), 0);
const PX = (t: number) => 200 + 30 * t;
const PY = (d: number) => 195 - d * 330;

export const spec: Spec = {
  id: 'math-ttest-sampling',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Inferential statistics',
  afterHeading: 'Hypothesis testing and the one-sample t-test',
  title: 'Standard Error and One-Sample t-Test Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Test H₀: μ = 50 with a sample. Change the sample size, the sample standard deviation, the sample mean and the level of significance, and see the standard error, the t statistic, the critical value and the decision.',
  can: ['See the standard error σ/√n fall as the sample grows', 'Compute t = (x̄ − μ₀)/(s/√n) and compare |t| with the critical value for df = n − 1', 'Record SE for three sample sizes and read s from the slope against 1/√n'],
  minutes: 12,
  vars: [
    { id: 'n', label: 'Sample size n', unit: '', min: 4, max: 40, step: 1, start: 9, digits: 0, choice: true },
    { id: 's', label: 'Sample standard deviation s', unit: '', min: 1, max: 8, step: 0.5, start: 3, digits: 1 },
    { id: 'xbar', label: 'Sample mean x̄ (H₀ says μ = 50)', unit: '', min: 45, max: 55, step: 0.5, start: 52, digits: 1 },
    { id: 'al', label: 'Level of significance α', unit: '%', min: 1, max: 10, step: 1, start: 5, digits: 0, choice: true },
  ],
  outs: [
    { id: 'se', label: 'Standard error SE = s/√n', unit: '', fn: (v) => sOf(v), digits: 3 },
    { id: 't', label: 'Test statistic t = (x̄ − μ₀)/SE', unit: '', fn: (v) => tOf(v), digits: 3 },
    { id: 'df', label: 'Degrees of freedom n − 1', unit: '', fn: (v) => v.n! - 1, digits: 0 },
    { id: 'tc', label: 'Critical value of t (two-tailed)', unit: '', fn: (v) => crit(v), digits: 3 },
    { id: 'margin', label: '|t| − critical value (positive: reject H₀)', unit: '', fn: (v) => Math.abs(tOf(v)) - crit(v), digits: 3 },
    { id: 'rej', label: 'Decision (1 = reject H₀, 0 = do not reject)', unit: '', fn: (v) => (Math.abs(tOf(v)) > crit(v) ? 1 : 0), digits: 0 },
  ],
  graphs: [
    { id: 'se-n', title: 'Standard error against sample size', x: 'n', y: 'se' },
    { id: 'tc-n', title: 'Critical value of t against sample size', x: 'n', y: 'tc' },
    { id: 't-xbar', title: 't statistic against the sample mean', x: 'xbar', y: 't' },
  ],
  sceneAlt: 'The bell-shaped t distribution for n − 1 degrees of freedom, with the two orange tail regions beyond the critical values and a blue line at the observed t. The line falls inside the tails when H0 is rejected, and the tails move and the curve changes shape with n and the level of significance.',
  scene: ({ v, o }) => {
    const nu = v.n! - 1;
    const tc = o.tc!;
    const xs = Array.from({ length: 121 }, (_, i) => -6 + (i * 12) / 120);
    const curve = xs.map((x) => `${PX(x).toFixed(1)},${PY(pdf(x, nu)).toFixed(1)}`).join(' ');
    const tail = (sign: 1 | -1) => {
      const pts: string[] = [];
      const n = 40;
      for (let i = 0; i <= n; i++) { const x = tc + ((6 - tc) * i) / n; pts.push(`${PX(sign * x).toFixed(1)},${PY(pdf(x, nu)).toFixed(1)}`); }
      pts.push(`${PX(sign * 6)},${PY(0)}`, `${PX(sign * tc)},${PY(0)}`);
      return pts.join(' ');
    };
    const tobs = Math.max(-6, Math.min(6, o.t!));
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={20} y1={PY(0)} x2={380} y2={PY(0)} stroke="#7c8595" />
        {tc < 6 && <polygon points={tail(1)} fill="#c45e42" fillOpacity={0.45} />}
        {tc < 6 && <polygon points={tail(-1)} fill="#c45e42" fillOpacity={0.45} />}
        <polyline points={curve} fill="none" stroke="#18443b" strokeWidth={2.2} />
        <line x1={PX(tobs)} y1={PY(0)} x2={PX(tobs)} y2={36} stroke="#2563a8" strokeWidth={2.4} />
        <text x={PX(tobs)} y={30} textAnchor="middle" fontWeight="bold" fill="#2563a8">t = {fmt(o.t!, 2)}</text>
        <text x={PX(-tc)} y={PY(0) + 12} textAnchor="middle">−{fmt(tc, 3)}</text>
        <text x={PX(tc)} y={PY(0) + 12} textAnchor="middle">{fmt(tc, 3)}</text>
        <text x={PX(0)} y={PY(0) + 12} textAnchor="middle">0</text>
        <text x={20} y={14} fontSize={11} fill="#18443b">df = {nu} · orange tails: {v.al}% in total · SE = {fmt(o.se!, 3)}</text>
        <text x={200} y={228} textAnchor="middle" fontSize={12} fontWeight="bold" fill={o.rej! === 1 ? '#c45e42' : '#18443b'}>{o.rej! === 1 ? 'Reject H₀: |t| is beyond the critical value' : 'Do not reject H₀: |t| is inside ±critical value'}</text>
      </g>
    );
  },
  discover: [
    'Raise the sample size n. The standard error falls: by what rule? Look at the graph of SE against n.',
    'Move the sample mean away from 50. The blue line moves into the orange tails: where does the decision change?',
    'Change the level of significance. The tails move; which setting makes rejecting H₀ harder?',
  ],
  experiment: [
    'Set n = 9, s = 3 and x̄ = 52 (the lesson\'s bulbs): confirm t = 2.00 and a critical value 2.306.',
    'Keep x̄ and s the same and raise n. At what n does the decision flip from "do not reject" to "reject"?',
    'Quadruple n and check that the standard error halves.',
  ],
  understand: [
    'The sampling distribution of x̄ has mean μ and standard deviation (standard error) σ/√n; it falls as 1/√n, so n must be multiplied by 4 to halve it.',
    'One-sample t-test: t = (x̄ − μ₀)/(s/√n) with s computed using n − 1, and degrees of freedom df = n − 1.',
    'Reject H₀ when |t| exceeds the critical value for df = n − 1 at the chosen α (two-tailed); compare |t|, not a negative t.',
    'Failing to reject H₀ does not prove H₀ true; the sample only gives insufficient evidence against it. A stricter α (1%) needs a larger |t| to reject.',
  ],
  preds: [
    {
      id: 'p1', title: 'A bigger sample', prompt: 'A sample of 9 has x̄ = 52 and s = 3: t = 2.00 against the critical value 2.306 (do not reject H₀ at 5%). A sample of 16 with the same x̄ and s is tested instead. What is the decision?',
      base: { n: 9, s: 3, xbar: 52, al: 5 }, test: { n: 16 }, options: ['Reject H₀: |t| now exceeds the critical value', 'Do not reject H₀: |t| is still below the critical value', '|t| is unchanged at 2.00', 'H₀ is proved true'], answer: 0,
      verify: ({ base, test, outs }) => (outs(test).rej! === 1 ? 0 : Math.abs(outs(test).t! - outs(base).t!) < 1e-9 ? 2 : 1),
      why: ({ base, test, outs }) => `SE = s/√n falls from ${fmt(outs(base).se!, 2)} to ${fmt(outs(test).se!, 2)}, so t rises from ${fmt(outs(base).t!, 2)} to ${fmt(outs(test).t!, 2)}. The critical value for df = 15 is ${fmt(outs(test).tc!, 3)}, so H₀ is rejected.`,
    },
    {
      id: 'p2', title: 'A stricter level', prompt: 'Eight batteries give x̄ = 52 and s = 2 against μ₀ = 50: t = 2.83. H₀ is rejected at the 5% level (critical value 2.365). The level is changed to 1%. What is the decision now?',
      base: { n: 8, s: 2, xbar: 52, al: 5 }, test: { al: 1 }, options: ['It changes to: do not reject H₀', 'It stays: reject H₀', 'It changes to: H₁ is proved', 'The value of t changes'], answer: 0,
      verify: ({ base, test, outs }) => (outs(base).rej! === 1 && outs(test).rej! === 0 ? 0 : outs(test).rej! === 1 ? 1 : 3),
      why: ({ base, test, outs }) => `t = ${fmt(outs(test).t!, 2)} does not change. The critical value rises from ${fmt(outs(base).tc!, 3)} (5%) to ${fmt(outs(test).tc!, 3)} (1%), and 2.83 is below 3.499, so H₀ is not rejected at 1%.`,
    },
    {
      id: 'p3', title: 'Four times the sample', prompt: 'The sample size is raised from 9 to 36 (same s = 3). What happens to the standard error of the sample mean?',
      base: { n: 9, s: 3, xbar: 52, al: 5 }, test: { n: 36 }, options: ['It halves', 'It falls to a quarter', 'It doubles', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).se! / outs(base).se!, [0.5, 0.25, 2, 1]),
      why: ({ base, test, outs }) => `SE = s/√n and √36 = 2 × √9, so SE falls from ${fmt(outs(base).se!, 2)} to ${fmt(outs(test).se!, 2)}, half as much.`,
    },
    {
      id: 'p4', title: 'The sample mean equals μ₀', prompt: 'The sample mean is moved from 52 to exactly 50, the value in H₀ (n = 9, s = 3). What are t and the decision?',
      base: { n: 9, s: 3, xbar: 52, al: 5 }, test: { xbar: 50 }, options: ['t = 0 and H₀ is not rejected', 't is negative and H₀ is rejected', 't stays 2.00', 't = 0 and H₀ is rejected'], answer: 0,
      verify: ({ test, outs }) => (Math.abs(outs(test).t!) < 1e-9 ? (outs(test).rej! === 0 ? 0 : 3) : outs(test).t! < 0 ? 1 : 2),
      why: ({ base, test, outs }) => `t = (x̄ − 50)/SE goes from ${fmt(outs(base).t!, 2)} to ${fmt(outs(test).t!, 2)}: the sample gives no evidence at all against H₀ (|t| = 0 is far below ${fmt(outs(test).tc!, 3)}).`,
    },
  ],
  measure: {
    instruction: 'Keep s fixed. Record the standard error of the mean for at least three different sample sizes n.',
    vary: 'n',
    record: ['se', 'df', 'tc'],
    fit: {
      xLabel: '1/√n',
      yLabel: 'standard error SE',
      x: (v) => 1 / Math.sqrt(v.n!),
      y: (_v, o) => o.se!,
      interpret: (slope, intercept, v) => `SE against 1/√n is a straight line through the origin (intercept ${fmt(intercept, 3)}): SE = s/√n. The slope ${fmt(slope, 3)} is the standard deviation s = ${fmt(v.s!, 1)} you set. The graph of SE against n itself is curved because SE falls only as 1/√n.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Nine bulbs have mean life 52 and s = 3 (hundred hours). Test H₀: μ = 50 against H₁: μ ≠ 50 at the 5% level (critical value for df = 8 is 2.306). The conclusion is', options: ['Reject H₀ at 5%', 'Do not reject H₀ at 5%', 'Reject H₀ at 1% only', 'H₀ is proved true'], answer: 1,
      why: 't = (52 − 50)/(3/√9) = 2.00 with df = 8. Since 2.00 < 2.306, H₀ is not rejected; this does not prove it true, only that the evidence is insufficient.',
      verify: () => { const v = { n: 9, s: 3, xbar: 52, al: 5 }; return Math.abs(tOf(v)) > crit(v) ? 0 : 1; },
    },
    {
      id: 'q2', q: 'A population has σ = 15. The standard error of the mean of samples of size n = 36 is', options: ['5', '0.42', '15', '2.5'], answer: 3,
      why: 'SE = σ/√n = 15/√36 = 15/6 = 2.5, and the sampling distribution has mean μ and, for n ≥ 30, is approximately normal.',
      verify: () => near(15 / Math.sqrt(36), [5, 0.42, 15, 2.5]),
    },
    {
      id: 'q3', q: 'Eight batteries (x̄ = 25, s = 2, μ₀ = 23) give t = 2.83 with df = 7. The critical values are 2.365 at 5% and 3.499 at 1%. At the 1% level the conclusion is', options: ['Do not reject H₀, since 2.83 < 3.499', 'Reject H₀, since 2.83 > 2.365', 'Reject H₀, since 2.83 > 1', 'The test cannot be done'], answer: 0,
      why: 'At 1% compare |t| = 2.83 with 3.499. Since 2.83 < 3.499, H₀ is not rejected at 1% (although it was rejected at 5%). A smaller α needs stronger evidence.',
      verify: () => { const t = (25 - 23) / (2 / Math.sqrt(8)); return Math.abs(t) > tCrit(0.01, 7) ? 1 : 0; },
    },
    {
      id: 'q4', q: 'The sample size is changed from 36 to a larger value so that the standard error of the mean is halved. The new sample size is', options: ['72', '144', '108', '216'], answer: 1,
      why: 'SE = σ/√n, so halving SE needs √n to double, which means n must be four times as large: 4 × 36 = 144 (the standard error goes from 2.5 to 1.25).',
      verify: () => near(36 * Math.pow((1 / 0.5), 2), [72, 144, 108, 216]),
    },
    {
      id: 'q5', q: 'A sample of 9 observations is used in a one-sample t-test. The degrees of freedom are', options: ['9', '7', '10', '8'], answer: 3,
      why: 'df = n − 1 = 8: once the mean is fixed the nine deviations x − x̄ must add to zero, so only eight of them are free.',
      verify: () => near(9 - 1, [9, 7, 10, 8]),
    },
  ],
};
