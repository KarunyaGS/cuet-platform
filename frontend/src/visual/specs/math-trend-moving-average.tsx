/**
 * Chapter lab: Mathematics (319), "Time based data: time series, components, secular trend and methods of measuring trend",
 * section "Methods of measuring trend".
 * Model: eleven yearly values y = 50 + b0 x + C cos(2 pi x / 5) + I n(x), x = -5..5 measured from the middle year (so sum x = 0),
 * i.e. trend + cyclical + irregular. Least squares (lesson): a = sum y / n, b = sum xy / sum x^2; moving average of period m;
 * semi-averages: slope = difference of the two half-means / distance between their mid-points. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const XS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const NOISE = [0.6, -0.9, 0.3, 0.8, -0.5, 0.2, -0.7, 0.9, -0.4, 0.5, -0.8];
const LEVEL = 50;
const series = (b0: number, C: number, I: number) => XS.map((x, i) => LEVEL + b0 * x + C * Math.cos((2 * Math.PI * x) / 5) + I * NOISE[i]!);
/** least squares with the origin at the middle year: a = sum y / n, b = sum xy / sum x^2 */
const ls = (ys: number[]) => {
  const n = ys.length;
  const xs = Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
  const a = ys.reduce((s, y) => s + y, 0) / n;
  const b = ys.reduce((s, y, i) => s + xs[i]! * y, 0) / xs.reduce((s, x) => s + x * x, 0);
  return { a, b };
};
/** moving average (odd period m) placed against the middle of each group */
const movAvg = (ys: number[], m: number) => Array.from({ length: ys.length - m + 1 }, (_, i) => ys.slice(i, i + m).reduce((s, y) => s + y, 0) / m);
const mean = (xs: number[]) => xs.reduce((s, y) => s + y, 0) / xs.length;
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const maMid = (ys: number[], m: number) => mean(ys.slice(5 - (m - 1) / 2, 5 + (m - 1) / 2 + 1));
const PX = (x: number) => 30 + ((x + 5) / 15) * 350;

export const spec: Spec = {
  id: 'math-trend-moving-average',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Time based data',
  afterHeading: 'Methods of measuring trend',
  title: 'Trend, Moving Average and Forecast Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Generate eleven years of data from a trend, a five-year cycle and random bumps. Fit the least-squares line, smooth with a moving average, compare with semi-averages and forecast ahead.',
  can: ['Fit y = a + bx by least squares with the origin at the middle year', 'See a moving average of the right period remove a cycle, and count the values it loses', 'Record forecasts for three horizons and read the trend slope b from a straight line'],
  minutes: 13,
  vars: [
    { id: 'b0', label: 'True trend: change per year', unit: 'units/yr', min: -2, max: 6, step: 0.5, start: 3, digits: 1 },
    { id: 'C', label: 'Cyclical swing (5-year cycle) amplitude', unit: 'units', min: 0, max: 10, step: 1, start: 5, digits: 0 },
    { id: 'I', label: 'Irregular (random) bumps size', unit: 'units', min: 0, max: 6, step: 1, start: 2, digits: 0 },
    { id: 'm', label: 'Period of the moving average', unit: 'years', min: 3, max: 7, step: 2, start: 3, digits: 0 },
    { id: 'h', label: 'Forecast: years beyond the last year', unit: 'years', min: 1, max: 5, step: 1, start: 1, digits: 0 },
  ],
  outs: [
    { id: 'b', label: 'Least-squares slope b = Σxy/Σx²', unit: 'units/yr', fn: (v) => ls(series(v.b0!, v.C!, v.I!)).b, digits: 3 },
    { id: 'a', label: 'Trend value at the middle year a = Σy/n', unit: '', fn: (v) => ls(series(v.b0!, v.C!, v.I!)).a, digits: 2 },
    { id: 'fc', label: 'Forecast a + b(5 + h)', unit: '', fn: (v) => { const r = ls(series(v.b0!, v.C!, v.I!)); return r.a + r.b * (5 + v.h!); }, digits: 2 },
    { id: 'ma', label: 'Moving average at the middle year', unit: '', fn: (v) => maMid(series(v.b0!, v.C!, v.I!), v.m!), digits: 2 },
    { id: 'maErr', label: 'Moving average minus true trend (50) at the middle year', unit: '', fn: (v) => maMid(series(v.b0!, v.C!, v.I!), v.m!) - LEVEL, digits: 2 },
    { id: 'semi', label: 'Semi-average slope (second half mean − first half mean) ÷ 6', unit: 'units/yr', fn: (v) => { const y = series(v.b0!, v.C!, v.I!); return (mean(y.slice(6)) - mean(y.slice(0, 5))) / 6; }, digits: 3 },
    { id: 'lost', label: 'Trend values lost by the moving average (m − 1)', unit: '', fn: (v) => v.m! - 1, digits: 0 },
  ],
  graphs: [
    { id: 'fc-h', title: 'Forecast against the years ahead', x: 'h', y: 'fc' },
    { id: 'b-b0', title: 'Least-squares slope against the true trend', x: 'b0', y: 'b' },
    { id: 'err-m', title: 'Moving-average error against its period', x: 'm', y: 'maErr' },
  ],
  sceneAlt: 'Eleven yearly values drawn as dots joined by a grey line, the least-squares trend line in green extended to a forecast point, and the moving average in orange. The values change with the trend, the cycle and the bumps, and the orange line smooths them more as the period grows.',
  scene: ({ v, o }) => {
    const ys = series(v.b0!, v.C!, v.I!);
    const r = ls(ys);
    const m = v.m!;
    const ma = movAvg(ys, m);
    const fcx = 5 + v.h!;
    const all = [...ys, o.fc!, r.a + r.b * -5];
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 2;
    lo -= pad; hi += pad;
    const PY = (y: number) => 205 - ((y - lo) / (hi - lo)) * 175;
    const half = (m - 1) / 2;
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={30} y1={205} x2={382} y2={205} stroke="#c9ced6" />
        <line x1={PX(5)} y1={26} x2={PX(5)} y2={205} stroke="#e5e5e5" strokeDasharray="3 3" />
        <line x1={PX(-5)} y1={PY(r.a + r.b * -5)} x2={PX(fcx)} y2={PY(r.a + r.b * fcx)} stroke="#18443b" strokeWidth={2} />
        <polyline points={ys.map((y, i) => `${PX(XS[i]!)},${PY(y)}`).join(' ')} fill="none" stroke="#9aa3b2" strokeWidth={1.3} />
        {ys.map((y, i) => <circle key={i} cx={PX(XS[i]!)} cy={PY(y)} r={3} fill="#4d5768" />)}
        <polyline points={ma.map((y, i) => `${PX(XS[i + half]!)},${PY(y)}`).join(' ')} fill="none" stroke="#c45e42" strokeWidth={2.4} />
        {ma.map((y, i) => <circle key={i} cx={PX(XS[i + half]!)} cy={PY(y)} r={2.6} fill="#c45e42" />)}
        <circle cx={PX(fcx)} cy={PY(o.fc!)} r={5} fill="#fff" stroke="#18443b" strokeWidth={2.2} />
        <text x={PX(fcx) - 6} y={PY(o.fc!) - 8} textAnchor="end" fill="#18443b">forecast {fmt(o.fc!, 1)}</text>
        <text x={30} y={16} fontSize={11}><tspan fill="#4d5768">dots: data</tspan> · <tspan fill="#18443b">green: least-squares y = {fmt(r.a, 1)} + {fmt(r.b, 2)}x</tspan> · <tspan fill="#c45e42">orange: {m}-year moving average</tspan></text>
        <text x={30} y={30}>{`only ${ma.length} averages from 11 years (m − 1 = ${m - 1} lost at the ends)`}</text>
        <text x={PX(0)} y={218} textAnchor="middle">middle year (x = 0)</text>
        <text x={PX(5)} y={218} textAnchor="middle">last year</text>
      </g>
    );
  },
  discover: [
    'Raise the cycle amplitude and watch the data swing around the green least-squares line.',
    'Change the period of the moving average. Which period makes the orange line the smoothest, and how many points does it lose?',
    'Move the forecast horizon h: the open green circle slides along the least-squares line.',
  ],
  experiment: [
    'Set the irregular bumps to 0 and the cycle to 6. Compare the moving average error for periods 3, 5 and 7.',
    'Compare the least-squares slope with the semi-average slope for the same data. Which one is steadier when the cycle is large?',
    'Set the cycle and bumps to 0: the least-squares line should pass through every point.',
  ],
  understand: [
    'Least squares with time measured from the middle year (Σx = 0): a = Σy/n is the trend at the middle year and b = Σxy/Σx² is the annual change; always state the origin and unit of x.',
    'A moving average of period m smooths short-term movements, but it loses m − 1 values in total (half at each end) and cannot forecast; a period equal to the length of a cycle averages it out.',
    'The semi-average method joins the two half-means placed at the middle of each half: slope = difference of the means ÷ distance between mid-points.',
    'A forecast puts a future x into the trend equation; it is reliable only if the past pattern continues.',
  ],
  preds: [
    {
      id: 'p1', title: 'Match the cycle', prompt: 'The data have a 5-year cycle of size 5 and no random bumps. The moving average at the middle year (true trend 50) is off by 2.7 with a 3-year period. The period is changed to 5 years. What happens to the error?',
      base: { b0: 3, C: 5, I: 0, m: 3, h: 1 }, test: { m: 5 }, options: ['It falls to about 0: the cycle is averaged out', 'It grows larger', 'It does not change', 'It becomes negative'], answer: 0,
      verify: ({ base, test, outs }) => { const e0 = Math.abs(outs(base).maErr!), e1 = Math.abs(outs(test).maErr!); return e1 < 1e-9 ? 0 : e1 > e0 ? 1 : Math.abs(e1 - e0) < 1e-9 ? 2 : 3; },
      why: ({ base, test, outs }) => `A moving average whose period equals the length of the cycle adds one full wave, which sums to zero. The error goes from ${fmt(outs(base).maErr!, 2)} to ${fmt(outs(test).maErr!, 2)}.`,
    },
    {
      id: 'p2', title: 'Look further ahead', prompt: 'The least-squares trend rises by about 3 per year. The forecast is moved from 1 year to 3 years beyond the last year. By how much does the forecast change?',
      base: { b0: 3, C: 5, I: 2, m: 3, h: 1 }, test: { h: 3 }, options: ['By twice the annual change b', 'By the annual change b', 'It does not change', 'By minus twice b'], answer: 0,
      verify: ({ base, test, outs }) => near((outs(test).fc! - outs(base).fc!) / outs(base).b!, [2, 1, 0, -2]),
      why: ({ base, test, outs }) => `The forecast a + b(5 + h) moves by b for each extra year. It goes from ${fmt(outs(base).fc!, 1)} to ${fmt(outs(test).fc!, 1)}, a change of ${fmt(outs(test).fc! - outs(base).fc!, 1)} = 2 × ${fmt(outs(base).b!, 2)}.`,
    },
    {
      id: 'p3', title: 'Steeper true trend', prompt: 'The true trend is raised from 2 to 5 units per year (the cycle and the bumps stay as they are). How does the least-squares slope b change?',
      base: { b0: 2, C: 5, I: 2, m: 3, h: 1 }, test: { b0: 5 }, options: ['It rises by 3', 'It stays the same', 'It rises by 5', 'It falls'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).b! - outs(base).b!, [3, 0, 5, -3]),
      why: ({ base, test, outs }) => `Least squares is linear in the data, so adding 3 units per year to the trend adds exactly 3 to b: ${fmt(outs(base).b!, 3)} becomes ${fmt(outs(test).b!, 3)}.`,
    },
    {
      id: 'p4', title: 'A longer moving average', prompt: 'The moving average period is lengthened from 3 to 7 years for the eleven yearly values. How many trend values are lost in total?',
      base: { m: 3 }, test: { m: 7 }, options: ['6 values lost', '2 values lost', '7 values lost', 'None lost'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).lost!, [6, 2, 7, 0]),
      why: ({ base, test, outs }) => `A moving average of period m loses m − 1 values. For m = 3 it loses ${fmt(outs(base).lost!, 0)}; for m = 7 it loses ${fmt(outs(test).lost!, 0)}, leaving only ${11 - outs(test).lost!} averages from the 11 years.`,
    },
  ],
  measure: {
    instruction: 'Keep the data fixed. Record the least-squares forecast for at least three different numbers of years ahead h.',
    vary: 'h',
    record: ['fc', 'b'],
    fit: {
      xLabel: 'years ahead h',
      yLabel: 'forecast',
      x: (v) => v.h!,
      y: (_v, o) => o.fc!,
      interpret: (slope, intercept, v) => `The forecast a + b(5 + h) is a straight line in h. Its slope ${fmt(slope, 3)} is the annual change b of the trend line, and its intercept ${fmt(intercept, 2)} is a + 5b, the trend value at the last year. The true trend you built in was ${fmt(v.b0!, 1)} per year; the difference comes from the cycle and the bumps.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The yearly output (thousand units) of a firm from 2017 to 2022 is 20, 24, 28, 32, 36, 40. By the method of semi-averages the slope of the trend (thousand units per year) is', options: ['3', '4', '12', '6'], answer: 1,
      why: 'The half-means are (20 + 24 + 28)/3 = 24 at 2018 and (32 + 36 + 40)/3 = 36 at 2021. Slope = (36 − 24)/(2021 − 2018) = 12/3 = 4.',
      verify: () => { const y = [20, 24, 28, 32, 36, 40]; return near((mean(y.slice(3)) - mean(y.slice(0, 3))) / 3, [3, 4, 12, 6]); },
    },
    {
      id: 'q2', q: 'The 3-yearly moving averages of the series 5, 7, 9, 8, 11, 13, 12 are 7, 8, ?, 10.67, 12. The missing third value is', options: ['8', '9', '9.33', '10'], answer: 2,
      why: 'The third group is 9, 8, 11: (9 + 8 + 11)/3 = 28/3 ≈ 9.33, placed against the fourth observation. Seven values give only five averages.',
      verify: () => near(movAvg([5, 7, 9, 8, 11, 13, 12], 3)[2]!, [8, 9, 9.33, 10]),
    },
    {
      id: 'q3', q: 'The sales (Rs lakh) in 2018 to 2022 are 10, 14, 16, 20, 25. The least-squares line with origin 2020 is y = 17 + 3.6x. The trend value for 2023 is', options: ['27.8', '25.0', '30.5', '24.2'], answer: 0,
      why: 'With x = −2, −1, 0, 1, 2: a = Σy/n = 85/5 = 17 and b = Σxy/Σx² = 36/10 = 3.6. For 2023, x = 3, so y = 17 + 3.6 × 3 = 27.8.',
      verify: () => { const r = ls([10, 14, 16, 20, 25]); return near(r.a + r.b * 3, [27.8, 25, 30.5, 24.2]); },
    },
    {
      id: 'q4', q: 'A 5-yearly moving average is calculated for a series of 12 yearly values. The number of moving-average values obtained is', options: ['12', '7', '8', '10'], answer: 2,
      why: 'A moving average of period m loses m − 1 values: 12 − (5 − 1) = 8 averages (two lost at each end).',
      verify: () => near(movAvg(Array.from({ length: 12 }, (_, i) => i), 5).length, [12, 7, 8, 10]),
    },
    {
      id: 'q5', q: 'The first centred 4-yearly moving average of the series 8, 12, 14, 18, 20, 26 is', options: ['13', '15.5', '16', '14.5'], answer: 3,
      why: 'The first two 4-yearly totals are 52 and 64. The centred total 116 divided by 2 × 4 = 8 gives 14.5, placed against the 3rd year.',
      verify: () => { const y = [8, 12, 14, 18, 20, 26]; const t1 = y.slice(0, 4).reduce((s, v) => s + v, 0), t2 = y.slice(1, 5).reduce((s, v) => s + v, 0); return near((t1 + t2) / 8, [13, 15.5, 16, 14.5]); },
    },
  ],
};
