/**
 * Chapter lab: Biology, "Reproductive health", population stabilisation, contraception and the safe period.
 * Model: compound growth N = N0 (1 + r)^t starting from India's 350 million in 1947 (the lesson's solved problem);
 * failures of a contraceptive = users x years x (failures per 100 woman-years) / 100; periodic abstinence covers days 10 to 17.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ, pathOf } from './_bio-util';

const N0 = 350; // million, India 1947 (lesson)
const vars: VarDef[] = [
  { id: 'r', label: 'Annual growth rate of the population', unit: '%', min: 0.5, max: 3, step: 0.1, start: 2, digits: 1 },
  { id: 't', label: 'Years (growth horizon and years of method use)', unit: 'years', min: 0, max: 60, step: 1, start: 20, digits: 0 },
  { id: 'women', label: 'Women using the method', unit: 'thousand', min: 1, max: 100, step: 1, start: 10, digits: 0 },
  { id: 'fail', label: 'Failure rate of the method', unit: 'pregnancies per 100 woman-years', min: 0.5, max: 25, step: 0.5, start: 5, digits: 1 },
  { id: 'cycle', label: 'Length of the menstrual cycle', unit: 'days', min: 24, max: 35, step: 1, start: 28, digits: 0 },
];
const pop = (v: Values) => N0 * Math.pow(1 + v.r! / 100, v.t!);
const outs: OutDef[] = [
  { id: 'pop', label: 'Population after t years (from 350 million)', unit: 'million', fn: pop, digits: 0 },
  { id: 'factor', label: 'Factor of increase', unit: '×', fn: (v) => Math.pow(1 + v.r! / 100, v.t!), digits: 2 },
  { id: 'td', label: 'Doubling time ln 2 ÷ ln(1 + r)', unit: 'years', fn: (v) => Math.LN2 / Math.log(1 + v.r! / 100), digits: 1 },
  { id: 'preg', label: 'Pregnancies despite the method', unit: 'pregnancies', fn: (v) => (v.women! * 1000 * v.t! * v.fail!) / 100, digits: 0 },
  { id: 'abst', label: 'Share of the cycle spent in abstinence (days 10 to 17)', unit: '%', fn: (v) => (100 * 8) / v.cycle!, digits: 1 },
];

export const spec: Spec = {
  id: 'bio-reproductive-health',
  subject: 'Biology',
  lessonTitleStartsWith: 'Reproductive health',
  afterHeading: 'Methods of contraception',
  title: 'Population and Contraception Lab',
  format: 'Simulation · graph exploration',
  blurb: 'Grow a population by compound growth from India\'s 350 million in 1947, count the pregnancies a contraceptive method fails to prevent, and see how much of the cycle the safe-period method asks couples to avoid.',
  can: ['Work out growth rate, factor of increase and doubling time', 'Count method failures from women, years and failure rate', 'Recover the growth rate from a straight line of ln N against years'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'pop', title: 'Population against years', x: 't', y: 'pop' },
    { id: 'r', title: 'Population after t years against the growth rate', x: 'r', y: 'pop' },
    { id: 'f', title: 'Pregnancies against the failure rate of the method', x: 'fail', y: 'preg' },
  ],
  sceneAlt: 'Left, a growth curve of population against years from 350 million with a marker at the chosen year. Right, a calendar strip of the menstrual cycle with days 10 to 17 shaded as the days of abstinence, and below it a grid of women in which the red ones show pregnancies despite the contraceptive.',
  scene: ({ v, o }) => {
    const ymax = N0 * Math.pow(1.03, 60);
    const X = (t: number) => 30 + (t / 60) * 150;
    const Y = (n: number) => 120 - ((n - N0) / (ymax - N0)) * 85;
    const pts: [number, number][] = [];
    for (let t = 0; t <= 60; t += 2) pts.push([X(t), Y(N0 * Math.pow(1 + v.r! / 100, t))]);
    const C = v.cycle!;
    const w = 190 / C;
    const red = Math.round(Math.min(1, v.fail! / 100) * 40);
    return (
      <g>
        <rect x={30} y={35} width={150} height={85} fill="#fff" stroke="#e5e5e5" />
        <path d={pathOf(pts)} stroke="#c45e42" strokeWidth={2} fill="none" />
        <circle cx={X(v.t!)} cy={Y(o.pop!)} r={4.5} fill="#18443b" />
        <text x={32} y={30} fontSize={10} fill="#4d5768">population {fmt(o.pop!, 0)} million after {v.t} years</text>
        <text x={105} y={136} fontSize={9} textAnchor="middle" fill="#4d5768">years 0 to 60 (350 million at the start)</text>
        {Array.from({ length: C }, (_, i) => {
          const d = i + 1;
          return <rect key={i} x={200 + i * w * 0.0 + (i * 190) / C} y={50} width={w - 1} height={22} fill={d >= 10 && d <= 17 ? '#c45e42' : '#d9ecd2'} stroke="#fff" />;
        })}
        <text x={295} y={44} fontSize={10} textAnchor="middle" fill="#4d5768">cycle of {C} days: days 10 to 17 avoided</text>
        <text x={200} y={86} fontSize={9} fill="#4d5768">1</text>
        <text x={392} y={86} fontSize={9} textAnchor="end" fill="#4d5768">{C}</text>
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={205 + (i % 10) * 18} cy={110 + Math.floor(i / 10) * 18} r={5.5} fill={i < red ? '#c45e42' : '#18443b'} opacity={i < red ? 0.95 : 0.35} />
        ))}
        <text x={295} y={196} fontSize={10} textAnchor="middle" fill="#4d5768">{v.fail} in every 100 women conceive each year (red)</text>
      </g>
    );
  },
  discover: [
    'Drag the years and the growth rate. How does the population respond to a change of one percentage point?',
    'Change the failure rate. How many pregnancies occur in 10 000 women over 5 years?',
    'Change the cycle length. How big a share of the cycle is avoided in periodic abstinence?',
  ],
  experiment: [
    'Set the rate to 2 percent and find the years in which the population doubles.',
    'Compare two methods: one with 1 failure per 100 woman-years and one with 15. How many extra pregnancies for 20 000 women in 3 years?',
    'Does a longer cycle make the safe-period method easier or harder to follow?',
  ],
  understand: [
    'India\'s population grew from about 350 million in 1947 to 1 billion in 2000, an average compound rate of about 2 percent a year.',
    'At a fixed percentage rate the population doubles in 0.693 ÷ ln(1 + r) years, so small rates still compound.',
    'Contraception is the most effective means of birth control; surgical methods and IUDs have the lowest failure, natural methods the highest.',
    'Periodic abstinence asks the couple to avoid coitus from day 10 to 17 of the cycle, when ovulation is expected and chances of conception are highest.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Halve the growth rate', prompt: 'Over 53 years the growth rate is 1 percent instead of 2 percent. How many times larger than the 2 percent population is the 1 percent population (350 million start)? Pick the closest.',
      base: { t: 53, r: 2 }, test: { r: 1 },
      labels: ['About half as large (0.6 times)', 'About 1.5 times', 'About the same', 'About 0.2 times'], vals: [0.6, 1.5, 1, 0.2], f: (o) => o.pop!,
      why: ({ base, test, outs: oo }) => `1.01^53 = 1.69 against 1.02^53 = 2.86: the population is ${fmt(oo(test).pop!, 0)} million instead of ${fmt(oo(base).pop!, 0)} million, about 0.6 times as large.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'A better method', prompt: 'A contraceptive with 10 failures per 100 woman-years is replaced by one with 5 failures (same women, same years). What happens to the number of pregnancies?',
      base: { fail: 10 }, test: { fail: 5 },
      labels: ['It halves', 'It stays the same', 'It falls to a quarter', 'It doubles'], vals: [0.5, 1, 0.25, 2], f: (o) => o.preg!,
      why: ({ base, test, outs: oo }) => `Pregnancies are proportional to the failure rate: ${fmt(oo(base).preg!, 0)} become ${fmt(oo(test).preg!, 0)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'A longer cycle', prompt: 'The cycle lengthens from 28 to 35 days while the abstinence days stay 10 to 17. What happens to the share of the cycle spent in abstinence?',
      base: { cycle: 28 }, test: { cycle: 35 },
      labels: ['It rises to 1.25 times', 'It stays the same', 'It falls to half', 'It falls to 0.8 times'], vals: [1.25, 1, 0.5, 0.8], f: (o) => o.abst!,
      why: ({ base, test, outs: oo }) => `Eight days make a smaller share of a longer cycle: ${fmt(oo(base).abst!, 1)} percent becomes ${fmt(oo(test).abst!, 1)} percent.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Slower growth, longer doubling', prompt: 'The growth rate falls from 2 percent to 1 percent. About how does the doubling time change?',
      base: { r: 2 }, test: { r: 1 },
      labels: ['It stays the same', 'It becomes 4 times as long', 'It becomes about twice as long', 'It halves'], vals: [1, 4, 2, 0.5], f: (o) => o.td!,
      why: ({ base, test, outs: oo }) => `Doubling time is about 0.693 ÷ r: ${fmt(oo(base).td!, 1)} years becomes ${fmt(oo(test).td!, 1)} years, about twice as long.`,
    }),
  ],
  measure: {
    instruction: 'Keep the growth rate fixed. Record the population at three or more different numbers of years and fit ln N against t.',
    vary: 't',
    record: ['pop', 'factor'],
    fit: {
      xLabel: 'years t',
      yLabel: 'ln(N in million)',
      x: (v) => v.t!,
      y: (_v, o) => Math.log(o.pop!),
      interpret: (slope, intercept) => `ln N = ln N₀ + t ln(1 + r) is a straight line. The slope ${fmt(slope, 4)} gives r = e^slope − 1 = ${fmt(100 * (Math.exp(slope) - 1), 2)} percent per year, and the intercept gives N₀ = ${fmt(Math.exp(intercept), 0)} million.`,
    },
  },
  questions: [
    mkQ('q1', 'India\'s population was about 350 million in 1947 and 1000 million in 2000. What is the average annual compound growth rate over these 53 years?', ['1.0 percent', '2.0 percent', '2.9 percent', '5.4 percent'], [1, 2, 2.9, 5.4], () => 100 * (Math.pow(1000 / 350, 1 / 53) - 1),
      'The factor is 1000/350 = 2.857 and (1 + r)^53 = 2.857, so 1 + r = 1.020 and r ≈ 2.0 percent per year.'),
    mkQ('q2', 'A woman with a 28-day cycle takes the first tablet of a 21-tablet pill packet on day 5. On which day does she take the last tablet?', ['21', '26', '25', '28'], [21, 26, 25, 28], () => 5 + 21 - 1,
      'Counting day 5 as tablet 1, tablet 21 is on day 5 + 21 − 1 = day 25; then 7 days without a pill (menstruation).'),
    mkQ('q3', 'In periodic abstinence a couple avoids coitus from day 10 to day 17 of the cycle, both days included. For how many days?', ['7', '8', '6', '10'], [7, 8, 6, 10], () => 17 - 10 + 1,
      'Days 10 to 17 inclusive are 17 − 10 + 1 = 8 days, around the expected ovulation.'),
    mkQ('q4', 'A population grows at 2 percent per year. About how long does it take to double?', ['35 years', '50 years', '14 years', '70 years'], [35, 50, 14, 70], () => Math.LN2 / Math.log(1.02),
      'Doubling time = ln 2 ÷ ln 1.02 = 0.693 ÷ 0.0198 ≈ 35 years.'),
    mkQ('q5', 'A method has 5 failures per 100 woman-years. How many pregnancies are expected among 400 women using it for 2 years?', ['40', '20', '100', '10'], [40, 20, 100, 10], () => (400 * 2 * 5) / 100,
      '400 women × 2 years = 800 woman-years; 5 per 100 woman-years gives 800 × 5/100 = 40 pregnancies.'),
  ],
};
