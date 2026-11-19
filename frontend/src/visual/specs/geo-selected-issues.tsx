/**
 * Chapter lab: Geography, "Geographical perspective on selected issues and problems" - urban solid waste and the waste hierarchy.
 * Model: waste per day = people x kg per person per day; part is compostable; some of the rest is recycled; what remains is dumped.
 * The per-person figures and shares are ILLUSTRATIVE, not statistics of any real city. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GOLD, GREY, INK, closest } from './geogat-kit';

const total = (Pm: number, w: number) => Pm * 1000 * w; // tonnes/day: Pm million people x 1e6 x w kg / 1000
const compost = (Pm: number, w: number, c: number) => (total(Pm, w) * c) / 100;
const noncomp = (Pm: number, w: number, c: number) => total(Pm, w) - compost(Pm, w, c);
const recycled = (Pm: number, w: number, c: number, r: number) => (noncomp(Pm, w, c) * r) / 100;
const dumped = (Pm: number, w: number, c: number, r: number) => noncomp(Pm, w, c) - recycled(Pm, w, c, r);

export const spec: Spec = {
  id: 'geo-selected-issues',
  subject: 'Geography',
  lessonTitleStartsWith: 'Geographical perspective on selected issues',
  afterHeading: 'Urban waste disposal',
  title: 'City Waste and the 3 Rs Lab',
  format: 'Calculator · stacked-bar model',
  blurb: 'Give a city a population, a waste amount per person, a compostable share and a recycling rate, and see how many tonnes a day are composted, recycled or dumped. All values are illustrative.',
  can: ['See how reducing waste at the source shrinks the dump', 'Raise recycling and watch the dumped share fall', 'Record total waste for three populations and fit the waste per person'],
  minutes: 8,
  vars: [
    { id: 'P', label: 'Population of the city (illustrative)', unit: 'million', min: 0.5, max: 20, step: 0.5, start: 2, digits: 1 },
    { id: 'w', label: 'Solid waste per person per day', unit: 'kg', min: 0.1, max: 1.0, step: 0.05, start: 0.5, digits: 2 },
    { id: 'c', label: 'Compostable share of the waste', unit: '%', min: 20, max: 80, step: 5, start: 60, digits: 0 },
    { id: 'r', label: 'Share of the non-compostable waste that is recycled', unit: '%', min: 0, max: 80, step: 5, start: 0, digits: 0 },
  ],
  outs: [
    { id: 'T', label: 'Total solid waste', unit: 'tonnes/day', fn: (v) => total(v.P!, v.w!), digits: 0 },
    { id: 'C', label: 'Compostable waste', unit: 'tonnes/day', fn: (v) => compost(v.P!, v.w!, v.c!), digits: 0 },
    { id: 'R', label: 'Recycled waste', unit: 'tonnes/day', fn: (v) => recycled(v.P!, v.w!, v.c!, v.r!), digits: 0 },
    { id: 'D', label: 'Waste left to be dumped', unit: 'tonnes/day', fn: (v) => dumped(v.P!, v.w!, v.c!, v.r!), digits: 0 },
    { id: 'Y', label: 'Waste dumped in a year', unit: 'thousand tonnes', fn: (v) => (dumped(v.P!, v.w!, v.c!, v.r!) * 365) / 1000, digits: 0 },
  ],
  graphs: [
    { id: 't-p', title: 'Total waste against population', x: 'P', y: 'T' },
    { id: 'd-w', title: 'Waste dumped against waste per person', x: 'w', y: 'D' },
    { id: 'd-r', title: 'Waste dumped against the recycled share', x: 'r', y: 'D' },
  ],
  sceneAlt: 'A tall bar standing for the total daily waste, split into compost, recycled and dumped parts that change with the sliders, next to rows of small people icons that follow the population.',
  scene: ({ v, o }) => {
    const top = Math.max(total(20, 1), 1);
    const scale = 150 / Math.max(o.T!, top * 0.12);
    const parts: [string, number, string][] = [
      ['Compost', o.C!, '#6aa84f'],
      ['Recycled', o.R!, BLUE],
      ['Dumped', o.D!, ACC],
    ];
    let y = 190;
    const people = Math.max(1, Math.round(v.P! * 1.5));
    return (
      <g fontSize={10}>
        {parts.map(([n, val, col]) => {
          const h = val * scale;
          y -= h;
          return (
            <g key={n}>
              <rect x={60} y={y} width={80} height={h} fill={col} stroke="#fff" />
              {h > 12 && <text x={100} y={y + h / 2 + 3} textAnchor="middle" fill="#fff" fontWeight="bold">{n}</text>}
            </g>
          );
        })}
        <text x={100} y={206} textAnchor="middle" fill={INK} fontWeight="bold">{fmt(o.T!, 0)} tonnes/day</text>
        {parts.map(([n, val, col], i) => (
          <g key={n}>
            <rect x={170} y={30 + i * 22} width={12} height={12} fill={col} />
            <text x={188} y={40 + i * 22} fill={INK}>{n}: {fmt(val, 0)} t/day</text>
          </g>
        ))}
        <text x={170} y={110} fill={GOLD} fontWeight="bold">Reduce first, then reuse, recycle</text>
        {Array.from({ length: people }, (_, i) => (
          <g key={i} transform={`translate(${172 + (i % 15) * 14} ${130 + Math.floor(i / 15) * 22})`}>
            <circle cx={5} cy={3} r={3} fill={GREY} />
            <path d="M 0 14 v -6 h 10 v 6 z" fill={GREY} />
          </g>
        ))}
        <text x={172} y={216} fill={GREY} fontSize={9}>one icon = about 0.67 million people (illustrative)</text>
      </g>
    );
  },
  discover: [
    'Raise the population and the waste per person: which readout grows fastest?',
    'Turn the recycling slider up from 0. Which two readouts move?',
    'Drop the waste per person to its lowest value. How does that compare with raising recycling to 80 %?',
  ],
  experiment: [
    'Check the lesson: a city of 2 million people makes 0.5 kg per person per day, 60 % compostable. How many tonnes a day in total and compostable?',
    'Record the total waste for three populations and read the waste per person from the slope.',
    'Which of the three Rs changes the dump most for the same effort: halving the waste per person or recycling half of the rest?',
  ],
  understand: [
    'Total waste = number of people × waste per person; the amount per person rises with income, and fast urban growth makes collection and disposal difficult.',
    'The waste hierarchy is reduce, reuse, recycle: reducing waste at its source is the best option and disposal is the last resort.',
    'Open dumping pollutes land, air and groundwater, and leachate from a dump contaminates water.',
    'Compostable (biodegradable) waste can be composted; recycling takes part of what is left; only the remainder has to be dumped.',
  ],
  preds: [
    {
      id: 'p1', title: 'A city twice as large', prompt: 'A city grows from 2 million to 4 million people with the same waste per person. What happens to the waste dumped each day?',
      base: { P: 2 }, test: { P: 4 }, options: ['It doubles', 'It stays the same', 'It halves', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => closest(outs(test).D! / outs(base).D!, [2, 1, 0.5, 4]),
      why: ({ base, test, outs }) => `Waste is proportional to population. Dumped waste goes from ${fmt(outs(base).D!, 0)} to ${fmt(outs(test).D!, 0)} tonnes a day.`,
    },
    {
      id: 'p2', title: 'Reduce at the source', prompt: 'A campaign halves the waste per person from 0.6 kg to 0.3 kg a day (recycling stays at 0). What happens to the waste dumped?',
      base: { w: 0.6 }, test: { w: 0.3 }, options: ['It falls to a quarter', 'It stays the same', 'It falls to half', 'It falls to zero'], answer: 2,
      verify: ({ base, test, outs }) => closest(outs(test).D! / outs(base).D!, [0.25, 1, 0.5, 0]),
      why: ({ base, test, outs }) => `Dumped waste is proportional to waste per person. It falls from ${fmt(outs(base).D!, 0)} to ${fmt(outs(test).D!, 0)} tonnes a day.`,
    },
    {
      id: 'p3', title: 'Start recycling', prompt: 'A city (2 million people, 0.5 kg each, 60 % compostable) starts recycling 50 % of its non-compostable waste, up from 0 %. What happens to the waste dumped?',
      base: { r: 0 }, test: { r: 50 }, options: ['It falls by 50 per cent of the non-compostable waste, to half of before', 'It falls to zero', 'It does not change', 'It falls by 50 per cent of the total waste'], answer: 0,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).D! / outs(base).D! - 0.5) < 1e-9 ? 0 : outs(test).D! === 0 ? 1 : outs(test).D! === outs(base).D! ? 2 : 3),
      why: ({ base, test, outs }) => `Recycling takes half of the non-compostable part. Dumped waste falls from ${fmt(outs(base).D!, 0)} to ${fmt(outs(test).D!, 0)} tonnes a day. Compost (${fmt(outs(test).C!, 0)} t) is unaffected, so the dump does not fall to zero.`,
    },
    {
      id: 'p4', title: 'A more food-heavy waste stream', prompt: 'With no recycling, the compostable share falls from 60 % to 20 % (more plastic and packaging). What happens to the waste to be dumped?',
      base: { c: 60, r: 0 }, test: { c: 20 }, options: ['It stays the same', 'It falls to half', 'It doubles', 'It becomes three times as large'], answer: 2,
      verify: ({ base, test, outs }) => closest(outs(test).D! / outs(base).D!, [1, 0.5, 2, 3]),
      why: ({ base, test, outs }) => `The non-compostable share rises from 40 % to 80 % of the waste, so with no recycling the dump grows from ${fmt(outs(base).D!, 0)} to ${fmt(outs(test).D!, 0)} tonnes a day.`,
    },
  ],
  measure: {
    instruction: 'Keep the waste per person and the shares fixed. Record the total solid waste for at least three different populations.',
    vary: 'P',
    record: ['T', 'C', 'D'],
    fit: {
      xLabel: 'population (million)',
      yLabel: 'total waste (tonnes per day)',
      x: (v) => v.P!,
      y: (_v, o) => o.T!,
      interpret: (slope, _i, v) => `Total waste against population is a straight line through the origin. The slope is ${fmt(slope, 1)} tonnes per day per million people, which is ${fmt(slope / 1000, 3)} kg per person per day (the slider is set to ${fmt(v.w!, 2)} kg).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A city of 2 million people produces 0.5 kg of solid waste per person per day. How many tonnes of waste does it generate per day?', options: ['100 tonnes', '500 tonnes', '10,000 tonnes', '1,000 tonnes'], answer: 3,
      why: '2,000,000 × 0.5 kg = 1,000,000 kg = 1,000 tonnes a day.',
      verify: () => closest(total(2, 0.5), [100, 500, 10000, 1000]),
    },
    {
      id: 'q2', q: 'If 60 per cent of that waste (1,000 tonnes a day) is compostable, the compostable part is', options: ['400 tonnes a day', '600 tonnes a day', '60 tonnes a day', '6,000 tonnes a day'], answer: 1,
      why: '60 % of 1,000 tonnes = 600 tonnes a day.',
      verify: () => closest(compost(2, 0.5, 60), [400, 600, 60, 6000]),
    },
    {
      id: 'q3', q: 'A country has a population of 1,250 million, of whom 400 million live in urban areas. Its level of urbanisation is', options: ['40 %', '25.6 %', '32 %', '3.1 %'], answer: 2,
      why: 'Level of urbanisation = urban population ÷ total population × 100 = 400 ÷ 1,250 × 100 = 32 %.',
      verify: () => closest((400 / 1250) * 100, [40, 25.6, 32, 3.1]),
    },
    {
      id: 'q4', q: 'In the same country the urban population grows by 10 per cent while the total stays the same. The level of urbanisation becomes', options: ['35.2 %', '42 %', '32 %', '33 %'], answer: 0,
      why: 'Urban population = 400 × 1.10 = 440 million. 440 ÷ 1,250 × 100 = 35.2 %.',
      verify: () => closest(((400 * 1.1) / 1250) * 100, [35.2, 42, 32, 33]),
    },
    {
      id: 'q5', q: 'Of a district of 5,000 sq km, 18 per cent is degraded land. Afforestation and soil conservation restore one fifth of the degraded land. The area still degraded is', options: ['900 sq km', '180 sq km', '720 sq km', '820 sq km'], answer: 2,
      why: 'Degraded area = 0.18 × 5,000 = 900 sq km. One fifth restored = 180 sq km, leaving 900 − 180 = 720 sq km.',
      verify: () => closest(0.18 * 5000 * (1 - 1 / 5), [900, 180, 720, 820]),
    },
  ],
};
