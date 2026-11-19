/**
 * Chapter lab: Biology, "Human reproduction", the menstrual cycle and gametogenesis.
 * Model (schematic hormone curves in arbitrary units, timings from the lesson's 28-day table): ovulation at the LH/FSH peak,
 * ovulation day = cycle length - luteal phase; progesterone and the endometrium rise in the luteal phase and collapse at menstruation
 * unless the ovum is fertilised; 4 sperm per primary spermatocyte, 1 ovum per primary oocyte. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ, pathOf } from './_bio-util';

const vars: VarDef[] = [
  { id: 'cycle', label: 'Cycle length', unit: 'days', min: 21, max: 35, step: 1, start: 28, digits: 0 },
  { id: 'luteal', label: 'Luteal phase (ovulation to next menstruation)', unit: 'days', min: 12, max: 16, step: 1, start: 14, digits: 0 },
  { id: 'day', label: 'Day of the cycle you examine', unit: 'day', min: 1, max: 35, step: 1, start: 14, digits: 0 },
  { id: 'fert', label: 'Ovum fertilised and implanted? (0 = no, 1 = yes)', unit: '', min: 0, max: 1, step: 1, start: 0, digits: 0 },
  { id: 'cells', label: 'Primary spermatocytes (and primary oocytes) starting meiosis', unit: 'cells', min: 1, max: 1000, step: 1, start: 100, digits: 0 },
];
const g = (x: number, m: number, s: number) => Math.exp(-(((x - m) / s) ** 2));
const ov = (v: Values) => v.cycle! - v.luteal!;
const dayIn = (v: Values, d: number) => (v.fert! >= 1 && d > v.cycle! ? d : ((d - 1) % v.cycle!) + 1);
export const hormones = (v: Values, d: number) => {
  const dd = dayIn(v, d);
  const o = ov(v);
  const sp = o + 7;
  const held = v.fert! >= 1 && dd > sp;
  const P = held ? 74 + 0.5 * (dd - sp) : 4 + 70 * g(dd, sp, 3.5) + 12 * Math.exp(-(dd - 1) / 2);
  const E = held ? 40 + 0.8 * (dd - sp) : 10 + 70 * g(dd, o - 1, 2.6) + 30 * g(dd, sp, 3.5);
  const LH = 8 + 85 * g(dd, o, 0.9);
  const FSH = 10 + 10 * g(dd, 4, 4) + 40 * g(dd, o, 1.1);
  let thick: number;
  if (held) thick = 10 + 0.3 * (dd - sp);
  else if (dd <= 5) thick = 3 - 0.4 * (dd - 1);
  else if (dd <= o) thick = 1.4 + (4.6 * (dd - 5)) / (o - 5);
  else if (dd <= sp) thick = 6 + (4 * (dd - o)) / 7;
  else if (dd <= v.cycle! - 2) thick = 10;
  else thick = 10 - 2.5 * (dd - (v.cycle! - 2));
  return { P, E, LH, FSH, thick };
};
const outs: OutDef[] = [
  { id: 'ov', label: 'Day of ovulation', unit: 'day', fn: ov, digits: 0 },
  { id: 'LH', label: 'LH on the chosen day', unit: 'a.u.', fn: (v) => hormones(v, v.day!).LH, digits: 0 },
  { id: 'E', label: 'Oestrogen on the chosen day', unit: 'a.u.', fn: (v) => hormones(v, v.day!).E, digits: 0 },
  { id: 'P', label: 'Progesterone on the chosen day', unit: 'a.u.', fn: (v) => hormones(v, v.day!).P, digits: 0 },
  { id: 'thick', label: 'Endometrium thickness on the chosen day', unit: 'mm', fn: (v) => hormones(v, v.day!).thick, digits: 1 },
  { id: 'sperm', label: 'Sperm from the primary spermatocytes (4 each)', unit: 'sperm', fn: (v) => 4 * v.cells!, digits: 0 },
  { id: 'ova', label: 'Ova from the primary oocytes (1 each)', unit: 'ova', fn: (v) => v.cells!, digits: 0 },
];

export const spec: Spec = {
  id: 'bio-human-reproduction',
  subject: 'Biology',
  lessonTitleStartsWith: 'Human reproduction',
  afterHeading: 'Menstrual cycle',
  title: 'Menstrual Cycle and Gametes Lab',
  format: 'Interactive graph · counting',
  blurb: 'Move through the menstrual cycle day by day and read LH, oestrogen, progesterone and the endometrium; change the cycle length, fertilise the ovum, and count the gametes made from primary cells.',
  can: ['Find the day of the LH peak and ovulation from the cycle and luteal lengths', 'See what progesterone and the endometrium do with and without fertilisation', 'Count sperm and ova from the same number of primary cells'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'E', title: 'Oestrogen against day of the cycle', x: 'day', y: 'E' },
    { id: 'P', title: 'Progesterone against day of the cycle', x: 'day', y: 'P' },
    { id: 'thick', title: 'Endometrium thickness against day of the cycle', x: 'day', y: 'thick' },
  ],
  sceneAlt: 'The four hormone curves of one menstrual cycle against the day: LH and FSH with a mid-cycle peak, oestrogen with a pre-ovulation peak and progesterone high in the luteal phase. A vertical line marks the chosen day, and a bar shows the endometrium thickness on that day.',
  scene: ({ v, o }) => {
    const C = Math.max(v.cycle!, v.day!);
    const X = (d: number) => 30 + ((d - 1) / (C - 1)) * 270;
    const Y = (y: number) => 175 - (Math.min(y, 100) / 100) * 140;
    const curve = (k: 'E' | 'P' | 'LH' | 'FSH', col: string) => {
      const pts: [number, number][] = [];
      for (let d = 1; d <= C; d += 0.5) pts.push([X(d), Y(hormones(v, d)[k])]);
      return <path d={pathOf(pts)} fill="none" stroke={col} strokeWidth={1.8} />;
    };
    const th = (o.thick! / 12) * 120;
    return (
      <g>
        <rect x={30} y={35} width={270} height={140} fill="#fff" stroke="#e5e5e5" />
        <rect x={X(1)} y={35} width={X(Math.min(5, C)) - X(1)} height={140} fill="#c45e42" opacity={0.1} />
        {curve('FSH', '#8b5fb8')}
        {curve('LH', '#4a8f3c')}
        {curve('E', '#c45e42')}
        {curve('P', '#2563a8')}
        <line x1={X(v.day!)} x2={X(v.day!)} y1={35} y2={175} stroke="#18443b" strokeDasharray="3 2" />
        <text x={X(v.day!)} y={30} fontSize={10} textAnchor="middle" fill="#18443b">day {v.day}</text>
        <text x={X(o.ov!)} y={Y(95) + 12} fontSize={9} textAnchor="middle" fill="#4a8f3c">ovulation</text>
        <text x={34} y={190} fontSize={9} fill="#c45e42">oestrogen</text>
        <text x={90} y={190} fontSize={9} fill="#2563a8">progesterone</text>
        <text x={160} y={190} fontSize={9} fill="#4a8f3c">LH</text>
        <text x={185} y={190} fontSize={9} fill="#8b5fb8">FSH</text>
        <text x={165} y={206} fontSize={9} textAnchor="middle" fill="#4d5768">{v.fert! >= 1 ? 'fertilised: corpus luteum persists, no menstruation' : 'red band = menstrual phase'}</text>
        <text x={344} y={30} fontSize={9} textAnchor="middle" fill="#4d5768">uterus wall</text>
        <rect x={330} y={175 - th} width={28} height={th} fill="#c45e42" opacity={0.7} />
        <rect x={330} y={55} width={28} height={120} fill="none" stroke="#18443b" />
        <text x={344} y={188} fontSize={9} textAnchor="middle" fill="#4d5768">{fmt(o.thick!, 1)} mm</text>
      </g>
    );
  },
  discover: [
    'Drag the day of the cycle from 1 to 28. Find the day of the LH peak and the oestrogen peak just before it.',
    'Switch fertilisation on and look at days 22 to 28: what happens to progesterone and the endometrium?',
    'Change the cycle length. Which day does ovulation move to when the luteal phase stays the same?',
  ],
  experiment: [
    'Find the day on which the endometrium is thickest. Is that in the follicular or the luteal phase?',
    'Compare progesterone on day 8 and day 22 with no fertilisation.',
    'With 200 primary spermatocytes and 200 primary oocytes, how many sperm and how many ova are formed?',
  ],
  understand: [
    'FSH and oestrogen rise in the follicular phase; an LH surge at about day 14 (with FSH) ruptures the Graafian follicle and releases the ovum.',
    'The empty follicle becomes the corpus luteum, which secretes progesterone to maintain the endometrium; without fertilisation it degenerates and menstruation follows.',
    'If the ovum is fertilised the corpus luteum keeps working, progesterone stays high and the cycle stops during pregnancy.',
    'One primary spermatocyte gives four sperm; one primary oocyte gives one ovum (and polar bodies).',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'A longer cycle', prompt: 'The luteal phase stays at 14 days but the cycle lengthens from 28 to 35 days. How does the day of ovulation (the LH peak) change?',
      base: { cycle: 28 }, test: { cycle: 35 },
      labels: ['It stays at day 14', 'It moves 3.5 days later', 'It moves 7 days later', 'It moves 7 days earlier'], vals: [0, 3.5, 7, -7], f: (o) => o.ov!, mode: 'diff',
      why: ({ base, test, outs: oo }) => `Ovulation falls one luteal phase (14 days) before the next menstruation, so a longer cycle delays it: day ${oo(base).ov} becomes day ${oo(test).ov}. (This fixed-luteal-phase rule is a simplification of the lesson's "middle of the cycle".)`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Pregnancy', prompt: 'Look at day 26 of a 28-day cycle. How does progesterone compare when the ovum has been fertilised and implanted with when it has not?',
      base: { day: 26, fert: 0 }, test: { fert: 1 },
      labels: ['About the same', 'About twice as high', 'Close to zero', 'About six times as high'], vals: [1, 2, 0.05, 6], f: (o) => o.P!,
      why: ({ base, test, outs: oo }) => `Without fertilisation the corpus luteum has degenerated, so progesterone has fallen (${fmt(oo(base).P!, 0)} units). After fertilisation the corpus luteum continues to function and progesterone stays high (${fmt(oo(test).P!, 0)} units).`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'The uterine lining', prompt: 'Compare the endometrium thickness on day 21 (luteal phase) with day 5 (end of menstruation) in a 28-day cycle. How many times thicker is it on day 21?',
      base: { day: 5 }, test: { day: 21 },
      labels: ['About 2 times', 'About 4 times', 'About 14 times', 'About 7 times'], vals: [2, 4, 14, 7], f: (o) => o.thick!,
      why: ({ base, test, outs: oo }) => `Oestrogen rebuilds the endometrium after menstruation and progesterone maintains it in the luteal phase: ${fmt(oo(base).thick!, 1)} mm on day 5 and ${fmt(oo(test).thick!, 1)} mm on day 21.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'The LH surge', prompt: 'LH is read on day 7 and then on day 14 of a 28-day cycle. About how many times higher is it on day 14?',
      base: { day: 7 }, test: { day: 14 },
      labels: ['About the same', 'About 3 times', 'About 30 times', 'About 10 times'], vals: [1, 3, 30, 10], f: (o) => o.LH!,
      why: ({ base, test, outs: oo }) => `Both LH and FSH peak in the middle of the cycle and the LH surge induces rupture of the Graafian follicle: ${fmt(oo(base).LH!, 0)} units on day 7 and ${fmt(oo(test).LH!, 0)} units on day 14.`,
    }),
  ],
  measure: {
    instruction: 'Keep the luteal phase at 14 days. Record the day of ovulation for at least three different cycle lengths.',
    vary: 'cycle',
    record: ['ov', 'P', 'thick'],
    fit: {
      xLabel: 'cycle length (days)',
      yLabel: 'day of ovulation',
      x: (v) => v.cycle!,
      y: (_v, o) => o.ov!,
      interpret: (slope, intercept) => `Day of ovulation against cycle length is a straight line of slope ${fmt(slope, 2)}. The intercept ${fmt(intercept, 1)} is minus the length of the luteal phase, so the luteal phase is ${fmt(-intercept, 1)} days.`,
    },
  },
  questions: [
    mkQ('q1', 'A testis section has 250 primary spermatocytes that complete meiosis. How many sperm can they form?', ['250', '500', '1000', '125'], [250, 500, 1000, 125], () => 250 * 4,
      'A primary spermatocyte divides by meiosis I into 2 secondary spermatocytes and by meiosis II into 4 equal spermatids, which become 4 sperm. 250 × 4 = 1000.'),
    mkQ('q2', 'Five primary oocytes complete meiosis and are all fertilised. How many ova are formed from them in oogenesis?', ['5', '10', '20', '15'], [5, 10, 20, 15], () => 5,
      'Oogenesis divides the cytoplasm unequally: each primary oocyte gives one large ovum and tiny polar bodies, so 5 oocytes give 5 ova (compare 20 sperm from 5 primary spermatocytes).'),
    mkQ('q3', 'A woman has a 35-day cycle with a luteal phase of 14 days. On which day does ovulation occur?', ['14', '17.5', '28', '21'], [14, 17.5, 28, 21], () => 35 - 14,
      'Menstruation follows ovulation by the luteal phase (the corpus luteum lasts about 14 days), so ovulation falls on day 35 − 14 = 21 in this simplified rule.'),
    mkQ('q4', 'In the lesson\'s 28-day cycle the follicular (proliferative) phase is days 6 to 13. How many days long is it?', ['7', '8', '14', '5'], [7, 8, 14, 5], () => 13 - 6 + 1,
      'Days 6 to 13 inclusive are 13 − 6 + 1 = 8 days; during it FSH and oestrogen rise and the endometrium regenerates.'),
    mkQ('q5', 'A zygote divides four times as it travels towards the uterus (2, 4, 8, ...). How many blastomeres does the embryo then have?', ['8', '12', '16', '32'], [8, 12, 16, 32], () => Math.pow(2, 4),
      'Each cleavage doubles the cells: 2, 4, 8, 16. An embryo of 8 to 16 blastomeres is the morula.'),
  ],
};
