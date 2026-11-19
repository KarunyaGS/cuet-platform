/**
 * Chapter lab: Geography, "Transport, communication and trade" (world) - why each mode of transport wins over a different distance.
 * Model: cost per tonne = terminal (fixed) cost + cost per km x distance. The lesson says roads give door-to-door service over short distances,
 * railways carry heavy goods over long distances, water is cheapest for bulky goods and air is fastest and costliest.
 * All rupee figures are ILLUSTRATIVE, chosen only to show the shape of the idea; they are not real freight rates. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GOLD, GREY, INK, closest } from './geogat-kit';

const T_ROAD = 100, T_AIR = 1500, C_WATER = 0.8, C_AIR = 8;
const road = (D: number, cr: number) => T_ROAD + cr * D;
const rail = (D: number, tr: number, cl: number) => tr + cl * D;
const water = (D: number, tw: number) => tw + C_WATER * D;
const air = (D: number) => T_AIR + C_AIR * D;
const cheapest = (D: number, cr: number, tr: number, cl: number, tw: number) => {
  const c = [road(D, cr), rail(D, tr, cl), water(D, tw), air(D)];
  return c.indexOf(Math.min(...c)) + 1;
};
const NAMES = ['Road', 'Rail', 'Water', 'Air'];

export const spec: Spec = {
  id: 'geo-transport-cost',
  subject: 'Geography',
  lessonTitleStartsWith: 'Transport, communication and trade',
  afterHeading: 'Water transport: inland waterways and ocean routes',
  title: 'Distance and Cost of Transport Lab',
  format: 'Graph exploration · cost model',
  blurb: 'Every mode of transport has a fixed terminal cost and a cost per kilometre. Slide the distance and the costs, find the cheapest mode and the break-even distance between road and rail. Rupee figures are illustrative.',
  can: ['See why road wins short trips and water wins long, bulky ones', 'Find the break-even distance at which rail overtakes road', 'Record rail cost for three distances and fit the cost per km'],
  minutes: 10,
  vars: [
    { id: 'D', label: 'Distance of the haul', unit: 'km', min: 50, max: 3000, step: 50, start: 800, digits: 0 },
    { id: 'cr', label: 'Road cost per km (illustrative)', unit: '₹/tonne/km', min: 4, max: 6, step: 0.5, start: 5, digits: 1 },
    { id: 'tr', label: 'Rail terminal cost (loading, unloading, illustrative)', unit: '₹/tonne', min: 200, max: 800, step: 50, start: 400, digits: 0 },
    { id: 'cl', label: 'Rail cost per km (illustrative)', unit: '₹/tonne/km', min: 1, max: 3, step: 0.5, start: 2, digits: 1 },
    { id: 'tw', label: 'Water terminal (port) cost (illustrative)', unit: '₹/tonne', min: 400, max: 1500, step: 100, start: 900, digits: 0 },
  ],
  outs: [
    { id: 'Cr', label: 'Cost by road', unit: '₹/tonne', fn: (v) => road(v.D!, v.cr!), digits: 0 },
    { id: 'Cl', label: 'Cost by rail', unit: '₹/tonne', fn: (v) => rail(v.D!, v.tr!, v.cl!), digits: 0 },
    { id: 'Cw', label: 'Cost by water', unit: '₹/tonne', fn: (v) => water(v.D!, v.tw!), digits: 0 },
    { id: 'Ca', label: 'Cost by air (fixed at 1,500 + 8 per km)', unit: '₹/tonne', fn: (v) => air(v.D!), digits: 0 },
    { id: 'B', label: 'Cheapest mode (1 road, 2 rail, 3 water, 4 air)', unit: '', fn: (v) => cheapest(v.D!, v.cr!, v.tr!, v.cl!, v.tw!), digits: 0 },
    { id: 'BE', label: 'Break-even distance, road against rail', unit: 'km', fn: (v) => (v.tr! - T_ROAD) / (v.cr! - v.cl!), digits: 0 },
  ],
  graphs: [
    { id: 'cr-d', title: 'Road cost against distance', x: 'D', y: 'Cr' },
    { id: 'cl-d', title: 'Rail cost against distance', x: 'D', y: 'Cl' },
    { id: 'b-d', title: 'Cheapest mode against distance', x: 'D', y: 'B' },
  ],
  sceneAlt: 'A chart of total cost against distance with one line for each of road, rail, water and air. The lines tilt and shift with the cost sliders and a vertical marker shows the chosen distance and the cheapest mode there.',
  scene: ({ v, o }) => {
    const X = (d: number) => 45 + (d / 3000) * 335;
    const Y = (c: number) => 190 - (Math.min(c, 12000) / 12000) * 165;
    const lines: [string, string, (d: number) => number][] = [
      ['Road', ACC, (d) => road(d, v.cr!)],
      ['Rail', INK, (d) => rail(d, v.tr!, v.cl!)],
      ['Water', BLUE, (d) => water(d, v.tw!)],
      ['Air', GOLD, (d) => air(d)],
    ];
    const best = o.B! - 1;
    return (
      <g fontSize={10}>
        <rect x={45} y={25} width={335} height={165} fill="#fff" stroke="#e5e5e5" />
        {lines.map(([n, col, f]) => (
          <g key={n}>
            <polyline points={[0, 750, 1500, 2250, 3000].map((d) => `${X(d).toFixed(1)},${Y(f(d)).toFixed(1)}`).join(' ')} fill="none" stroke={col} strokeWidth={n === NAMES[best] ? 3.5 : 1.8} />
            <circle cx={X(v.D!)} cy={Y(f(v.D!))} r={3.5} fill={col} />
          </g>
        ))}
        <line x1={X(v.D!)} x2={X(v.D!)} y1={25} y2={190} stroke={GREY} strokeDasharray="3 3" />
        <text x={45} y={204} fill={GREY}>0</text>
        <text x={380} y={204} textAnchor="end" fill={GREY}>3000 km</text>
        <text x={42} y={30} textAnchor="end" fill={GREY}>12000</text>
        {lines.map(([n, col], i) => (
          <text key={n} x={52 + i * 62} y={40} fill={col} fontWeight="bold">{n}</text>
        ))}
        <text x={200} y={222} textAnchor="middle" fill={INK} fontSize={11}>At {fmt(v.D!, 0)} km the cheapest is {NAMES[best]} (₹{fmt(Math.min(o.Cr!, o.Cl!, o.Cw!, o.Ca!), 0)}/tonne)</text>
      </g>
    );
  },
  discover: [
    'Start at 50 km and slide the distance up to 3,000 km. Which mode is cheapest at each end?',
    'Raise the rail terminal cost and watch the break-even distance between road and rail move.',
    'Look at the four cost lines in the picture: which has the highest starting value and which the lowest slope?',
  ],
  experiment: [
    'Find the distance at which rail first becomes cheaper than road. Does it match the break-even readout?',
    'Raise the port cost of water transport. At what distance does water still beat rail?',
    'Is air ever the cheapest mode for these settings? What kind of goods does the lesson say it suits?',
  ],
  understand: [
    'Total cost = terminal cost + cost per km × distance. A mode with a high terminal cost and a low cost per km wins over long distances.',
    'Roads give door-to-door service with little terminal cost, so they suit short and medium hauls.',
    'Railways and then waterways have lower costs per km, so they win for heavy, bulky goods over long distances.',
    'Air transport is the fastest but the costliest per km; it suits high-value, urgent and perishable goods.',
  ],
  preds: [
    {
      id: 'p1', title: 'From a short haul to a long one', prompt: 'A load goes 50 km, and then another load goes 1,500 km (illustrative costs: the sliders at their starting values). Which mode is cheapest in each case?',
      base: { D: 50 }, test: { D: 1500 }, options: ['Road for 50 km, rail for 1,500 km', 'Road for 50 km, water for 1,500 km', 'Rail for 50 km, water for 1,500 km', 'Rail for 50 km, road for 1,500 km'], answer: 1,
      verify: ({ base, test, outs }) => ['Road-Rail', 'Road-Water', 'Rail-Water', 'Rail-Road'].indexOf(`${NAMES[outs(base).B! - 1]}-${NAMES[outs(test).B! - 1]}`),
      why: ({ base, test, outs }) => `At 50 km the road costs ₹${fmt(outs(base).Cr!, 0)} against ₹${fmt(outs(base).Cl!, 0)} for rail, so the road is cheapest. At 1,500 km water costs ₹${fmt(outs(test).Cw!, 0)}, rail ₹${fmt(outs(test).Cl!, 0)} and road ₹${fmt(outs(test).Cr!, 0)}: water has the lowest cost per km, so it wins once the long distance pays off its port cost.`,
    },
    {
      id: 'p2', title: 'Dearer rail terminals', prompt: 'The rail terminal cost doubles from ₹400 to ₹800 per tonne. What happens to the break-even distance between road and rail?',
      base: { tr: 400 }, test: { tr: 800 }, options: ['It rises, so road stays cheaper for longer', 'It falls, so rail wins sooner', 'It does not change', 'Road and rail never break even'], answer: 0,
      verify: ({ base, test, outs }) => (outs(test).BE! > outs(base).BE! ? 0 : outs(test).BE! < outs(base).BE! ? 1 : 2),
      why: ({ base, test, outs }) => `Break-even distance = (rail terminal − road terminal) ÷ (road cost per km − rail cost per km). It rises from ${fmt(outs(base).BE!, 0)} km to ${fmt(outs(test).BE!, 0)} km because rail has to recover a bigger fixed cost.`,
    },
    {
      id: 'p3', title: 'Cheaper road freight', prompt: 'The road cost per km falls from 5 to 4 (₹ per tonne per km). What happens to the rail cost and the road cost for the same haul?',
      base: { cr: 5 }, test: { cr: 4 }, options: ['The rail cost falls', 'Both fall', 'The rail cost is unchanged and the road cost falls', 'The rail cost rises'], answer: 2,
      verify: ({ base, test, outs }) => (outs(test).Cl! === outs(base).Cl! && outs(test).Cr! < outs(base).Cr! ? 2 : outs(test).Cl! < outs(base).Cl! ? 1 : 3),
      why: ({ base, test, outs }) => `The rail line does not contain the road cost per km. Road falls from ₹${fmt(outs(base).Cr!, 0)} to ₹${fmt(outs(test).Cr!, 0)} while rail stays at ₹${fmt(outs(test).Cl!, 0)}.`,
    },
    {
      id: 'p4', title: 'Twice the distance', prompt: 'A rail haul is doubled from 400 km to 800 km. What happens to its total cost per tonne?',
      base: { D: 400 }, test: { D: 800 }, options: ['It doubles exactly', 'It more than doubles', 'It does not change', 'It less than doubles, because the terminal cost is paid only once'], answer: 3,
      verify: ({ base, test, outs }) => (outs(test).Cl! / outs(base).Cl! < 2 - 1e-9 && outs(test).Cl! > outs(base).Cl! ? 3 : outs(test).Cl! / outs(base).Cl! > 2 ? 1 : 0),
      why: ({ base, test, outs }) => `Cost = terminal + per-km × distance. The terminal cost does not grow with distance, so cost rises from ₹${fmt(outs(base).Cl!, 0)} to ₹${fmt(outs(test).Cl!, 0)}, which is a factor of ${fmt(outs(test).Cl! / outs(base).Cl!, 2)}, less than 2.`,
    },
  ],
  measure: {
    instruction: 'Keep the rail settings fixed. Record the cost of rail transport for at least three different distances.',
    vary: 'D',
    record: ['Cl', 'Cr', 'Cw'],
    fit: {
      xLabel: 'distance (km)',
      yLabel: 'rail cost (₹ per tonne)',
      x: (v) => v.D!,
      y: (_v, o) => o.Cl!,
      interpret: (slope, intercept) => `Rail cost against distance is a straight line. The slope is the cost per km = ₹${fmt(slope, 2)} per tonne per km, and the intercept is the terminal cost = ₹${fmt(intercept, 0)} per tonne, paid even for a zero-km haul.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A road costs ₹100 to start and ₹6 per km; a railway costs ₹500 to start and ₹2 per km (per tonne, illustrative). At what distance do they cost the same?', options: ['50 km', '100 km', '200 km', '400 km'], answer: 1,
      why: 'Set 100 + 6D = 500 + 2D. So 4D = 400 and D = 100 km. Beyond this distance the railway is cheaper.',
      verify: () => closest((500 - 100) / (6 - 2), [50, 100, 200, 400]),
    },
    {
      id: 'q2', q: 'A ship can go round the Cape of Good Hope (21,000 km) or through the Suez Canal (12,000 km), sailing at 20 km per hour. About how many days does the canal route save?', options: ['9.4 days', '18.75 days', '37.5 days', '450 days'], answer: 1,
      why: 'Distance saved = 21,000 − 12,000 = 9,000 km. Time saved = 9,000 ÷ 20 = 450 hours = 450 ÷ 24 = 18.75 days.',
      verify: () => closest((21000 - 12000) / 20 / 24, [9.4, 18.75, 37.5, 450]),
    },
    {
      id: 'q3', q: 'A country has an area of 2,000,000 sq km and 100,000 km of railway line. If its area were halved with the same track, its railway density per 100 sq km would be', options: ['2.5', '5', '20', '10'], answer: 3,
      why: 'Density = length ÷ area. For the halved area: 100,000 ÷ 1,000,000 = 0.1 km per sq km = 10 km per 100 sq km (it is 5 for the full area).',
      verify: () => closest((100000 / 1000000) * 100, [2.5, 5, 20, 10]),
    },
    {
      id: 'q4', q: 'The cost by rail is ₹400 as a terminal cost plus ₹2 per tonne per km. The cost of sending one tonne 300 km by rail is', options: ['₹1,000', '₹600', '₹1,400', '₹2,000'], answer: 0,
      why: 'Cost = 400 + 2 × 300 = ₹1,000 per tonne.',
      verify: () => closest(rail(300, 400, 2), [1000, 600, 1400, 2000]),
    },
    {
      id: 'q5', q: 'With the lab at its starting settings (road 5 per km, rail terminal 400 and 2 per km, water terminal 900) a bulky load travels 2,000 km. Which mode is cheapest?', options: ['Road', 'Rail', 'Water', 'Air'], answer: 2,
      why: 'Road 100 + 5 × 2000 = 10,100; rail 400 + 2 × 2000 = 4,400; water 900 + 0.8 × 2000 = 2,500; air 1,500 + 8 × 2000 = 17,500. Water is cheapest.',
      verify: () => cheapest(2000, 5, 400, 2, 900) - 1,
    },
  ],
};
