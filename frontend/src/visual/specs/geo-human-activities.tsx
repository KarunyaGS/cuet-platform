/**
 * Chapter lab: Geography, "Human Activities: primary to quaternary" - the workforce split across the four sectors.
 * Model: primary and secondary shares are set; the rest of the workers are tertiary and quaternary (as in the lesson's solved problem);
 * q is the quaternary share of that rest. All shares are illustrative, not statistics of any real country. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GOLD, GREY, INK, closest } from './geogat-kit';

const rest = (p: number, s: number) => 100 - p - s;
const nP = (W: number, p: number) => (W * p) / 100;
const nS = (W: number, s: number) => (W * s) / 100;
const nTQ = (W: number, p: number, s: number) => (W * rest(p, s)) / 100;
const nQ = (W: number, p: number, s: number, q: number) => (nTQ(W, p, s) * q) / 100;

export const spec: Spec = {
  id: 'geo-human-activities',
  subject: 'Geography',
  lessonTitleStartsWith: 'Human Activities',
  afterHeading: 'Economic activities and their four sectors',
  title: 'Workforce by Sector Lab',
  format: 'Calculator · stacked-bar model',
  blurb: 'Share a country\'s workers among the primary, secondary, tertiary and quaternary sectors and see how the number in each sector and in services responds. Shares are illustrative.',
  can: ['Move workers out of the primary sector and watch services grow', 'Split the service workers between tertiary and quaternary', 'Record primary workers for three workforce sizes and fit the primary share'],
  minutes: 8,
  vars: [
    { id: 'W', label: 'Total workers (illustrative country)', unit: 'million', min: 10, max: 200, step: 10, start: 80, digits: 0 },
    { id: 'p', label: 'Share in primary activities', unit: '%', min: 5, max: 70, step: 5, start: 35, digits: 0 },
    { id: 's', label: 'Share in secondary activities', unit: '%', min: 5, max: 30, step: 5, start: 25, digits: 0 },
    { id: 'q', label: 'Quaternary share of the remaining (tertiary + quaternary) workers', unit: '%', min: 0, max: 50, step: 5, start: 20, digits: 0 },
  ],
  outs: [
    { id: 'P', label: 'Primary workers', unit: 'million', fn: (v) => nP(v.W!, v.p!), digits: 1 },
    { id: 'S', label: 'Secondary workers', unit: 'million', fn: (v) => nS(v.W!, v.s!), digits: 1 },
    { id: 'TQ', label: 'Tertiary + quaternary workers together', unit: 'million', fn: (v) => nTQ(v.W!, v.p!, v.s!), digits: 1 },
    { id: 'Q', label: 'Quaternary (knowledge) workers', unit: 'million', fn: (v) => nQ(v.W!, v.p!, v.s!, v.q!), digits: 1 },
    { id: 'T', label: 'Tertiary (service) workers', unit: 'million', fn: (v) => nTQ(v.W!, v.p!, v.s!) - nQ(v.W!, v.p!, v.s!, v.q!), digits: 1 },
    { id: 'R', label: 'Share of workers in tertiary + quaternary', unit: '%', fn: (v) => rest(v.p!, v.s!), digits: 0 },
  ],
  graphs: [
    { id: 'r-p', title: 'Service and knowledge share against the primary share', x: 'p', y: 'R' },
    { id: 'tq-w', title: 'Tertiary + quaternary workers against total workers', x: 'W', y: 'TQ' },
    { id: 'q-q', title: 'Quaternary workers against the quaternary share', x: 'q', y: 'Q' },
  ],
  sceneAlt: 'One long bar split into primary, secondary, tertiary and quaternary parts whose widths follow the shares, with the worker count of each sector written under it.',
  scene: ({ v, o }) => {
    const shares = [v.p!, v.s!, rest(v.p!, v.s!) * (1 - v.q! / 100), rest(v.p!, v.s!) * (v.q! / 100)];
    const names = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'];
    const nums = [o.P!, o.S!, o.T!, o.Q!];
    const cols = ['#7fbf7f', '#c9a227', BLUE, ACC];
    let x = 20;
    return (
      <g fontSize={10} textAnchor="middle">
        <text x={200} y={20} fontSize={12} fontWeight="bold" fill={INK}>{fmt(v.W!, 0)} million workers = 100 %</text>
        {shares.map((s, i) => {
          const w = (s / 100) * 360;
          const cx = x + w / 2;
          const r = (
            <g key={i}>
              <rect x={x} y={34} width={w} height={44} fill={cols[i]} stroke="#fff" />
              {w > 28 && <text x={cx} y={61} fill="#fff" fontWeight="bold">{fmt(s, 0)}%</text>}
            </g>
          );
          x += w;
          return r;
        })}
        {names.map((n, i) => (
          <g key={n}>
            <rect x={30 + i * 90} y={110} width={12} height={12} fill={cols[i]} />
            <text x={62 + i * 90} y={120} textAnchor="start" fill={INK}>{n}</text>
            <text x={30 + i * 90} y={142} textAnchor="start" fill={GREY}>{fmt(nums[i]!, 1)} million</text>
          </g>
        ))}
        <text x={200} y={178} fontSize={11} fill={GOLD}>primary + secondary = {fmt(v.p! + v.s!, 0)} % of workers</text>
        <text x={200} y={198} fontSize={11} fill={INK}>tertiary + quaternary = {fmt(o.R!, 0)} % = {fmt(o.TQ!, 1)} million</text>
        <text x={200} y={218} fontSize={9} fill={GREY}>illustrative shares, not real statistics</text>
      </g>
    );
  },
  discover: [
    'Drag the primary share down from 70 % to 5 %. What happens to the share in tertiary and quaternary activities?',
    'Raise the quaternary share of the service workers. Does the total in tertiary + quaternary change?',
    'Double the total workers without touching any share. Which numbers double and which stay the same?',
  ],
  experiment: [
    'Set primary 35 % and secondary 25 %. How many of 80 million workers are in tertiary and quaternary together?',
    'Hold the shares fixed and find the number of primary workers for three different workforce sizes.',
    'Which of the four sectors does the knowledge-based share q alone control?',
  ],
  understand: [
    'Primary activities extract from nature, secondary ones manufacture, tertiary ones provide services and quaternary ones deal with knowledge and information.',
    'As an economy develops, the share of workers in primary activities falls and the share in tertiary and quaternary activities rises.',
    'The shares of the four sectors always add to 100 %: tertiary + quaternary = 100 − primary − secondary.',
    'A country with a very high primary share is usually at a lower level of economic development.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the workforce', prompt: 'The workforce of a country doubles from 80 million to 160 million, with the sector shares unchanged. What happens to the number of primary workers?',
      base: { W: 80 }, test: { W: 160 }, options: ['It doubles', 'It stays the same', 'It halves', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => closest(outs(test).P! / outs(base).P!, [2, 1, 0.5, 4]),
      why: ({ base, test, outs }) => `Primary workers = total × primary share. They go from ${fmt(outs(base).P!, 1)} million to ${fmt(outs(test).P!, 1)} million.`,
    },
    {
      id: 'p2', title: 'Development shifts the workforce', prompt: 'A country with 35 % primary and 25 % secondary workers develops until only 15 % are primary and secondary stays 25 %. What share is then in tertiary and quaternary together?',
      base: { p: 35, s: 25 }, test: { p: 15 }, options: ['40 %', '50 %', '60 %', '75 %'], answer: 2,
      verify: ({ test, outs }) => closest(outs(test).R!, [40, 50, 60, 75]),
      why: ({ base, test, outs }) => `Tertiary + quaternary = 100 − primary − secondary. It rises from ${fmt(outs(base).R!, 0)} % to ${fmt(outs(test).R!, 0)} %.`,
    },
    {
      id: 'p3', title: 'More knowledge workers', prompt: 'With the primary and secondary shares fixed, the quaternary share of the service workers rises from 10 % to 40 %. What happens to the number of tertiary + quaternary workers together?',
      base: { q: 10 }, test: { q: 40 }, options: ['It rises', 'It falls', 'It stays the same, but the split changes', 'It doubles'], answer: 2,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).TQ! - outs(base).TQ!) < 1e-9 && outs(test).Q! > outs(base).Q! ? 2 : 0),
      why: ({ base, test, outs }) => `The total of the two sectors stays ${fmt(outs(test).TQ!, 1)} million because it depends only on the primary and secondary shares. Quaternary workers rise from ${fmt(outs(base).Q!, 1)} to ${fmt(outs(test).Q!, 1)} million and tertiary workers fall by the same amount.`,
    },
    {
      id: 'p4', title: 'Industrialising', prompt: 'A country moves its secondary share from 10 % to 30 % (primary stays 35 %). What happens to the share in tertiary + quaternary?',
      base: { s: 10 }, test: { s: 30 }, options: ['It rises by 20 points', 'It falls by 20 points', 'It does not change', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).R! - outs(base).R!, [20, -20, 0, outs(base).R!]),
      why: ({ base, test, outs }) => `The shares add to 100 %. With primary fixed, more secondary workers leave less for the rest: tertiary + quaternary go from ${fmt(outs(base).R!, 0)} % to ${fmt(outs(test).R!, 0)} %.`,
    },
  ],
  measure: {
    instruction: 'Keep all the shares fixed. Record the number of primary workers for at least three different totals of workers.',
    vary: 'W',
    record: ['P', 'S', 'TQ'],
    fit: {
      xLabel: 'total workers (million)',
      yLabel: 'primary workers (million)',
      x: (v) => v.W!,
      y: (_v, o) => o.P!,
      interpret: (slope, _i, v) => `Primary workers against total workers is a straight line through the origin. The slope is the primary share = ${fmt(slope, 3)} = ${fmt(slope * 100, 1)} % (the slider is set to ${v.p} %).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A country has 80 million workers. 35 per cent are in primary and 25 per cent in secondary activities; the rest are in tertiary and quaternary activities. How many million workers are in tertiary and quaternary together?', options: ['28 million', '20 million', '32 million', '48 million'], answer: 2,
      why: '100 − 35 − 25 = 40 %, and 40 % of 80 million = 32 million. Check: 28 + 20 + 32 = 80.',
      verify: () => closest(nTQ(80, 35, 25), [28, 20, 32, 48]),
    },
    {
      id: 'q2', q: 'In a village of 600 workers, 45 per cent work in primary activities. After mechanisation the number of primary workers falls by 20 per cent of its earlier value and the total stays 600. The new primary share is', options: ['25 %', '36 %', '45 %', '20 %'], answer: 1,
      why: 'Primary workers: 0.45 × 600 = 270. A 20 % fall removes 54, leaving 216. New share = 216 ÷ 600 = 36 %.',
      verify: () => closest(((600 * 0.45 * 0.8) / 600) * 100, [25, 36, 45, 20]),
    },
    {
      id: 'q3', q: 'Of 120 million workers, 10 per cent are in primary and 30 per cent in secondary activities. How many million are in tertiary and quaternary together?', options: ['36', '48', '72', '84'], answer: 2,
      why: '100 − 10 − 30 = 60 %, and 60 % of 120 million = 72 million.',
      verify: () => closest(nTQ(120, 10, 30), [36, 48, 72, 84]),
    },
    {
      id: 'q4', q: 'A country has 200 million workers: 20 per cent primary and 20 per cent secondary. A quarter of the remaining workers are in knowledge-based (quaternary) activities. How many million quaternary workers are there?', options: ['100', '30', '50', '15'], answer: 1,
      why: 'Remaining workers = 60 % of 200 = 120 million. A quarter of 120 million is 30 million.',
      verify: () => closest(nQ(200, 20, 20, 25), [100, 30, 50, 15]),
    },
    {
      id: 'q5', q: 'A country with 100 million workers cuts its primary share from 60 % to 20 %. How many million workers have left primary activities for other sectors?', options: ['20', '60', '30', '40'], answer: 3,
      why: 'Primary workers fall from 60 million to 20 million, so 40 million moved to secondary, tertiary and quaternary activities.',
      verify: () => closest(nP(100, 60) - nP(100, 20), [20, 60, 30, 40]),
    },
  ],
};
