/**
 * Chapter lab: Geography, "Transport, communication and international trade of India" - balance of trade.
 * Model: balance of trade = exports - imports (deficit if negative); deficit as a percentage of imports; exports and imports each grow at
 * a constant yearly percentage. All values are in "units" as in the lesson's solved problem and are ILLUSTRATIVE, not real trade data.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const grow = (x: number, g: number, t: number) => x * Math.pow(1 + g / 100, t);

export const spec: Spec = {
  id: 'geo-india-trade',
  subject: 'Geography',
  lessonTitleStartsWith: 'Transport, communication and international',
  afterHeading: "International trade: changing pattern of India's foreign trade",
  title: 'Balance of Trade Lab',
  format: 'Calculator · bar model with projection',
  blurb: 'Set the value of exports and imports, read the balance of trade and the deficit as a percentage of imports, then let both grow at different yearly rates and see whether a deficit closes. Values are illustrative units.',
  can: ['Turn a trade deficit into a surplus by raising exports', 'See the deficit as a percentage of imports', 'Record the balance for three export values and fit the imports from the intercept'],
  minutes: 8,
  vars: [
    { id: 'X', label: 'Exports now (illustrative units)', unit: 'units', min: 100, max: 2000, step: 20, start: 540, digits: 0 },
    { id: 'M', label: 'Imports now (illustrative units)', unit: 'units', min: 100, max: 2000, step: 20, start: 720, digits: 0 },
    { id: 'gx', label: 'Yearly growth of exports', unit: '% per year', min: 0, max: 15, step: 1, start: 6, digits: 0, bounds: { min: 0, max: 100 } },
    { id: 'gm', label: 'Yearly growth of imports', unit: '% per year', min: 0, max: 15, step: 1, start: 4, digits: 0, bounds: { min: 0, max: 100 } },
    { id: 't', label: 'Years from now', unit: 'years', min: 0, max: 10, step: 1, start: 5, digits: 0, integer: true, bounds: { min: 0, max: 100 } },
  ],
  outs: [
    { id: 'B', label: 'Balance of trade now = exports − imports', unit: 'units', fn: (v) => v.X! - v.M!, digits: 0 },
    { id: 'Dp', label: 'Deficit as a percentage of imports (negative = surplus)', unit: '%', fn: (v) => ((v.M! - v.X!) / v.M!) * 100, digits: 1 },
    { id: 'Xt', label: 'Exports after the chosen years', unit: 'units', fn: (v) => grow(v.X!, v.gx!, v.t!), digits: 0 },
    { id: 'Mt', label: 'Imports after the chosen years', unit: 'units', fn: (v) => grow(v.M!, v.gm!, v.t!), digits: 0 },
    { id: 'Bt', label: 'Balance of trade after the chosen years', unit: 'units', fn: (v) => grow(v.X!, v.gx!, v.t!) - grow(v.M!, v.gm!, v.t!), digits: 0 },
  ],
  graphs: [
    { id: 'b-x', title: 'Balance of trade against exports', x: 'X', y: 'B' },
    { id: 'dp-m', title: 'Deficit % of imports against imports', x: 'M', y: 'Dp' },
    { id: 'bt-t', title: 'Balance of trade against years', x: 't', y: 'Bt' },
  ],
  sceneAlt: 'Two pairs of bars, exports and imports now and after the chosen years. The gap between each pair is the balance of trade, drawn in red for a deficit and green for a surplus.',
  scene: ({ v, o }) => {
    const top = Math.max(v.X!, v.M!, o.Xt!, o.Mt!, 1);
    const H = (x: number) => (x / top) * 130;
    const bars: [string, number, number, string][] = [
      ['Exports now', v.X!, 40, BLUE],
      ['Imports now', v.M!, 105, ACC],
      [`Exports +${v.t}y`, o.Xt!, 215, BLUE],
      [`Imports +${v.t}y`, o.Mt!, 280, ACC],
    ];
    return (
      <g fontSize={10} textAnchor="middle">
        {bars.map(([n, val, x, col], i) => (
          <g key={n}>
            <rect x={x} y={170 - H(val)} width={50} height={H(val)} fill={col} opacity={i < 2 ? 0.95 : 0.55} />
            <text x={x + 25} y={164 - H(val)} fill={INK}>{fmt(val, 0)}</text>
            <text x={x + 25} y={186} fill={GREY}>{n}</text>
          </g>
        ))}
        <line x1={20} x2={380} y1={170} y2={170} stroke={GREY} />
        <text x={95} y={206} fontSize={12} fontWeight="bold" fill={v.X! >= v.M! ? '#2e8b57' : '#c0392b'}>
          {v.X! >= v.M! ? 'surplus' : 'deficit'} {fmt(Math.abs(o.B!), 0)}
        </text>
        <text x={270} y={206} fontSize={12} fontWeight="bold" fill={o.Bt! >= 0 ? '#2e8b57' : '#c0392b'}>
          {o.Bt! >= 0 ? 'surplus' : 'deficit'} {fmt(Math.abs(o.Bt!), 0)}
        </text>
        <text x={200} y={226} fontSize={9} fill={GREY}>illustrative units, not real trade data</text>
      </g>
    );
  },
  discover: [
    'Raise the exports until they equal the imports. What is the balance of trade then?',
    'With a deficit, move the imports slider up. What happens to the deficit as a percentage of imports?',
    'Give exports a higher growth rate than imports and slide the years from 0 to 10. When does the red gap turn green?',
  ],
  experiment: [
    'Set exports 540 and imports 720. Check the deficit and its percentage of imports against the lesson.',
    'Double both exports and imports. Which readouts double and which stay the same?',
    'Find the growth rates that keep the deficit exactly the same after 10 years.',
  ],
  understand: [
    'Balance of trade = value of exports − value of imports. If imports are larger it is a trade deficit; if exports are larger it is a trade surplus.',
    'The deficit as a percentage of imports = (imports − exports) ÷ imports × 100.',
    'A deficit can close if exports grow faster than imports for long enough.',
    'Trade is based on differences in resources, climate, skills and technology; the pattern of India\'s trade has moved from primary goods towards manufactures and services.',
  ],
  preds: [
    {
      id: 'p1', title: 'Exports catch up', prompt: 'Imports are 720 units and exports 540 units. Exports rise to 720 units. What is the balance of trade?',
      base: { X: 540, M: 720 }, test: { X: 720 }, options: ['A deficit of 180', 'Zero: trade is balanced', 'A surplus of 180', 'A deficit of 90'], answer: 1,
      verify: ({ test, outs }) => closest(outs(test).B!, [-180, 0, 180, -90]),
      why: ({ base, test, outs }) => `Balance = exports − imports. It goes from ${fmt(outs(base).B!, 0)} to ${fmt(outs(test).B!, 0)}: the deficit has disappeared.`,
    },
    {
      id: 'p2', title: 'Growing faster', prompt: 'Exports of 540 grow by 10 % a year and imports of 720 by 5 % a year. After 10 years, what has happened to the deficit?',
      base: { X: 540, M: 720, gx: 10, gm: 5, t: 0 }, test: { t: 10 }, options: ['It widens', 'It stays the same', 'It has turned into a surplus', 'It shrinks but is still a deficit'], answer: 2,
      verify: ({ base, test, outs }) => (outs(test).Bt! > 0 ? 2 : outs(test).Bt! > outs(base).Bt! ? 3 : outs(test).Bt! < outs(base).Bt! ? 0 : 1),
      why: ({ base, test, outs }) => `Exports become ${fmt(outs(test).Xt!, 0)} units and imports ${fmt(outs(test).Mt!, 0)} units, so the balance goes from ${fmt(outs(base).Bt!, 0)} to ${fmt(outs(test).Bt!, 0)}: a surplus.`,
    },
    {
      id: 'p3', title: 'Buying more from abroad', prompt: 'Exports are 540 units and imports rise from 720 to 1,080 units. What is the deficit as a percentage of imports now (it was 25 %)?',
      base: { X: 540, M: 720 }, test: { M: 1080 }, options: ['It stays 25 %', 'It rises to about 33 %', 'It rises to 50 %', 'It rises to 75 %'], answer: 2,
      verify: ({ test, outs }) => closest(outs(test).Dp!, [25, 33, 50, 75]),
      why: ({ base, test, outs }) => `Deficit = 1,080 − 540 = ${fmt(-outs(test).B!, 0)}; as a percentage of imports it is ${fmt(outs(test).Dp!, 0)} % (before: ${fmt(outs(base).Dp!, 0)} %).`,
    },
    {
      id: 'p4', title: 'A bigger economy, the same pattern', prompt: 'Exports and imports both double (540 to 1,080 and 720 to 1,440). What happens to the deficit and to the deficit as a percentage of imports?',
      base: { X: 540, M: 720 }, test: { X: 1080, M: 1440 }, options: ['The deficit doubles but its percentage of imports is unchanged', 'The deficit is unchanged', 'The deficit halves', 'The percentage of imports doubles'], answer: 0,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).B! / outs(base).B! - 2) < 1e-9 && Math.abs(outs(test).Dp! - outs(base).Dp!) < 1e-9 ? 0 : 1),
      why: ({ base, test, outs }) => `The deficit goes from ${fmt(-outs(base).B!, 0)} to ${fmt(-outs(test).B!, 0)}, twice as large, while the percentage of imports stays at ${fmt(outs(test).Dp!, 0)} %.`,
    },
  ],
  measure: {
    instruction: 'Keep the imports fixed. Record the balance of trade for at least three different values of exports.',
    vary: 'X',
    record: ['B', 'Dp'],
    fit: {
      xLabel: 'exports (units)',
      yLabel: 'balance of trade (units)',
      x: (v) => v.X!,
      y: (_v, o) => o.B!,
      interpret: (slope, intercept, v) => `Balance against exports is a straight line with slope ${fmt(slope, 2)} (each extra unit exported adds one unit to the balance). The intercept is minus the imports: ${fmt(intercept, 0)} units, so imports = ${fmt(-intercept, 0)} units (the slider is set to ${v.M}).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A country exports goods worth 540 units and imports goods worth 720 units. Its balance of trade is', options: ['A deficit of 180 units', 'A surplus of 180 units', 'A deficit of 720 units', 'A deficit of 540 units'], answer: 0,
      why: 'Balance = exports − imports = 540 − 720 = −180 units, which is a deficit of 180 units.',
      verify: () => closest(540 - 720, [-180, 180, -720, -540]),
    },
    {
      id: 'q2', q: 'For the same country (exports 540, imports 720) the deficit as a percentage of imports is', options: ['33 %', '18 %', '25 %', '75 %'], answer: 2,
      why: 'Deficit ÷ imports × 100 = 180 ÷ 720 × 100 = 25 %.',
      verify: () => closest((180 / 720) * 100, [33, 18, 25, 75]),
    },
    {
      id: 'q3', q: 'A country exports goods worth 900 units and imports goods worth 600 units. What is its position?', options: ['A trade deficit of 300 units', 'A trade surplus of 300 units', 'A trade surplus of 1,500 units', 'Balanced trade'], answer: 1,
      why: 'Exports − imports = 900 − 600 = +300, so exports are larger and there is a trade surplus of 300 units.',
      verify: () => (900 - 600 > 0 ? 1 : 0),
    },
    {
      id: 'q4', q: 'Exports of 500 units grow by 10 per cent each year. After 2 years the exports are', options: ['600 units', '620 units', '605 units', '700 units'], answer: 2,
      why: 'After one year 500 × 1.10 = 550; after two years 550 × 1.10 = 605 units. (Not 600: the second year\'s growth is on the larger value.)',
      verify: () => closest(grow(500, 10, 2), [600, 620, 605, 700]),
    },
    {
      id: 'q5', q: 'Exports are 800 and imports 1,000 units. Exports rise by 20 per cent and imports stay the same. The deficit becomes', options: ['160 units', '100 units', '40 units', 'zero'], answer: 2,
      why: 'New exports = 800 × 1.2 = 960. Deficit = 1,000 − 960 = 40 units.',
      verify: () => closest(1000 - 800 * 1.2, [160, 100, 40, 0]),
    },
  ],
};
