/**
 * Chapter lab: Geography, "Human settlements: rural and urban" - the Census tests for an urban place and the six size classes.
 * Model: density = population / area; census town = population >= 5,000 AND density >= 400 per km2 AND >= 75 per cent male main workers
 * in non-agricultural work; a statutory town is urban by legal status alone. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const dens = (P: number, A: number) => P / A;
const tests = (P: number, A: number, N: number) => (P >= 5000 ? 1 : 0) + (dens(P, A) >= 400 ? 1 : 0) + (N >= 75 ? 1 : 0);
const urban = (P: number, A: number, N: number, S: number) => (S >= 1 || tests(P, A, N) === 3 ? 1 : 0);
const cls = (P: number) => (P >= 100000 ? 1 : P >= 50000 ? 2 : P >= 20000 ? 3 : P >= 10000 ? 4 : P >= 5000 ? 5 : 6);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export const spec: Spec = {
  id: 'geo-settlements',
  subject: 'Geography',
  lessonTitleStartsWith: 'Human settlements',
  afterHeading: 'Urban settlements: types and classification by size',
  title: 'Census Town Test Bench',
  format: 'Virtual experiment · classification model',
  blurb: 'Set the population, area, non-farm workers and legal status of a place and watch the three Census tests, the size class and the verdict urban or rural respond.',
  can: ['Change the area and see density cross the 400 per km² line', 'Move a place up and down the six size classes', 'Record density for three populations and fit the area from your own readings'],
  minutes: 9,
  vars: [
    { id: 'P', label: 'Population of the place', unit: 'persons', min: 1000, max: 2000000, step: 1, start: 7500, log: true, digits: 0 },
    { id: 'A', label: 'Area of the place', unit: 'km²', min: 1, max: 200, step: 1, start: 15, digits: 0 },
    { id: 'N', label: 'Male main workers in non-agricultural work', unit: '%', min: 0, max: 100, step: 5, start: 80, digits: 0, bounds: { min: 0, max: 100 } },
    { id: 'S', label: 'Has a municipality, corporation or cantonment board (1 = yes)', unit: '', min: 0, max: 1, step: 1, start: 0, digits: 0, choice: true },
  ],
  outs: [
    { id: 'D', label: 'Density = population ÷ area', unit: 'persons/km²', fn: (v) => dens(v.P!, v.A!), digits: 0 },
    { id: 'T', label: 'Census-town tests passed (of 3)', unit: '', fn: (v) => tests(v.P!, v.A!, v.N!), digits: 0 },
    { id: 'U', label: 'Urban by the Census (1 = yes, 0 = no)', unit: '', fn: (v) => urban(v.P!, v.A!, v.N!, v.S!), digits: 0 },
    { id: 'K', label: 'Size class number by population (1 = Class I … 6 = Class VI)', unit: '', fn: (v) => cls(v.P!), digits: 0 },
    { id: 'L', label: 'Population in lakh', unit: 'lakh', fn: (v) => v.P! / 1e5, digits: 2 },
  ],
  graphs: [
    { id: 'k-p', title: 'Size class number against population', x: 'P', y: 'K', logX: true },
    { id: 'd-a', title: 'Density against area', x: 'A', y: 'D' },
    { id: 't-n', title: 'Tests passed against the non-farm worker share', x: 'N', y: 'T' },
  ],
  sceneAlt: 'Six size-class boxes with the current class lit, three Census test lamps that turn green or red, rows of houses whose number follows the density, and a verdict line saying urban or rural.',
  scene: ({ v, o }) => {
    const k = o.K!;
    const ok = [v.P! >= 5000, o.D! >= 400, v.N! >= 75];
    const lab = [`pop ${fmt(v.P!, 0)}`, `dens ${fmt(o.D!, 0)}`, `non-farm ${v.N}%`];
    const need = ['≥ 5,000', '≥ 400', '≥ 75%'];
    const houses = Math.max(2, Math.min(40, Math.round(o.D! / 60)));
    const verdict = v.S! >= 1 ? 'URBAN: statutory town' : o.T! === 3 ? 'URBAN: census town' : 'NOT urban by the Census';
    return (
      <g fontSize={10} textAnchor="middle">
        {[6, 5, 4, 3, 2, 1].map((c, i) => (
          <g key={c}>
            <rect x={14 + i * 63} y={10} width={58} height={30} rx={4} fill={c === k ? ACC : '#eef1f4'} stroke={c === k ? ACC : '#c9ced6'} />
            <text x={43 + i * 63} y={29} fill={c === k ? '#fff' : GREY} fontWeight={c === k ? 'bold' : 'normal'}>Class {ROMAN[c]}</text>
          </g>
        ))}
        {ok.map((g, i) => (
          <g key={i}>
            <circle cx={55 + i * 145} cy={72} r={14} fill={g ? '#2e8b57' : '#c0392b'} />
            <text x={55 + i * 145} y={77} fill="#fff" fontSize={14} fontWeight="bold">{g ? '✓' : '✗'}</text>
            <text x={55 + i * 145} y={100} fill={INK}>{lab[i]}</text>
            <text x={55 + i * 145} y={112} fill={GREY}>needs {need[i]}</text>
          </g>
        ))}
        <rect x={14} y={124} width={372} height={70} rx={4} fill="#f6f8f6" stroke="#dfe5e1" />
        {Array.from({ length: houses }, (_, i) => {
          const cols = 20;
          const x = 24 + (i % cols) * 18;
          const y = 134 + Math.floor(i / cols) * 28;
          return <path key={i} d={`M ${x} ${y + 14} v -8 l 7 -6 l 7 6 v 8 z`} fill={BLUE} opacity={0.75} />;
        })}
        <text x={200} y={216} fontSize={13} fontWeight="bold" fill={o.U! ? '#2e8b57' : '#c0392b'}>{verdict}</text>
        <text x={200} y={228} fontSize={9} fill={GREY}>houses drawn in proportion to density (illustrative)</text>
      </g>
    );
  },
  discover: [
    'Drag the population slider and watch the size class box that is lit. Where does Class V change to Class IV?',
    'Shrink the area of a place: density rises and the second lamp turns green. At what area does that happen for 7,500 people?',
    'Switch the municipality slider on for a place that fails the tests. What does the verdict say?',
  ],
  experiment: [
    'Fix the area at 15 km² and non-farm workers at 80 %. What is the smallest population that passes all three tests?',
    'Fix the population at 7,500 and find the largest area for which density stays at or above 400.',
    'Keep every test failing but switch the municipality on: which route to being urban is this?',
  ],
  understand: [
    'A census town must pass all three tests together: population at least 5,000, density at least 400 per km² and at least 75 % of male main workers in non-agricultural work.',
    'A statutory town is urban by legal status alone (municipality, corporation, cantonment board or notified town area committee), whatever the tests say.',
    'Class numbers run backwards: Class I (1,00,000 or more) is the largest and Class VI (below 5,000) the smallest.',
    'Density is population divided by area, so for fixed population it falls as the area grows.',
  ],
  preds: [
    {
      id: 'p1', title: 'Spread the same people over more land', prompt: 'A place has 7,500 people, 80 % non-farm workers and no municipality. Its area grows from 15 km² to 30 km² with the same people. What happens to its Census status?',
      base: { P: 7500, A: 15, N: 80, S: 0 }, test: { A: 30 },
      options: ['It stays a census town', 'It stops being a census town because density falls below 400', 'It becomes a Class IV town', 'It becomes a statutory town'], answer: 1,
      verify: ({ base, test, outs }) => (outs(base).U === 1 && outs(test).U === 0 && outs(test).D! < 400 ? 1 : outs(test).U === 1 ? 0 : 3),
      why: ({ base, test, outs }) => `Density = population ÷ area. At 15 km² it is ${fmt(outs(base).D!, 0)} per km², so all three tests pass. At 30 km² it is ${fmt(outs(test).D!, 0)} per km², below 400, so only ${outs(test).T} tests pass and the place is not a census town.`,
    },
    {
      id: 'p2', title: 'Cross the 5,000 line', prompt: 'A town grows from 4,500 to 5,500 people (area 5 km², 90 % non-farm workers). By how many size classes does it move?',
      base: { P: 4500, A: 5, N: 90, S: 0 }, test: { P: 5500 },
      options: ['One class up, from Class VI to Class V', 'One class down, from Class V to Class VI', 'It stays in the same class', 'Two classes up'], answer: 0,
      verify: ({ base, test, outs }) => closest(outs(base).K! - outs(test).K!, [1, -1, 0, 2]),
      why: ({ base, test, outs }) => `Class VI is below 5,000 people and Class V is 5,000 to 9,999. The place moves from Class ${ROMAN[outs(base).K!]} to Class ${ROMAN[outs(test).K!]}, one class up (the number falls by one).`,
    },
    {
      id: 'p3', title: 'Declare a municipality', prompt: 'A place with 3,000 people in 20 km² and 30 % non-farm workers fails all three tests. A municipality is now set up for it. Is it urban?',
      base: { P: 3000, A: 20, N: 30, S: 0 }, test: { S: 1 },
      options: ['No, it still fails the three tests', 'Yes, it is a statutory town by its legal status', 'Only after its density passes 400', 'Only after its population reaches 5,000'], answer: 1,
      verify: ({ base, test, outs }) => (outs(base).U === 0 && outs(test).U === 1 && outs(test).T === 0 ? 1 : 0),
      why: ({ test, outs }) => `The tests passed stay at ${outs(test).T}, yet the verdict becomes urban. A statutory town needs only the legal status (municipality, corporation, cantonment board or notified town area committee); the three tests are for census towns.`,
    },
    {
      id: 'p4', title: 'Farmers return to the land', prompt: 'A town of 20,000 people in 20 km² has 80 % non-farm male workers. The share falls to 60 %. It has no municipality. What happens?',
      base: { P: 20000, A: 20, N: 80, S: 0 }, test: { N: 60 },
      options: ['It stays a census town', 'It is no longer a census town because only two tests are passed', 'It falls to Class V', 'Its density falls below 400'], answer: 1,
      verify: ({ base, test, outs }) => (outs(base).U === 1 && outs(test).U === 0 && outs(test).T === 2 ? 1 : 0),
      why: ({ base, test, outs }) => `Tests passed fall from ${outs(base).T} to ${outs(test).T}. The size class and the density do not depend on the work share (density stays ${fmt(outs(test).D!, 0)}). All three tests must pass together, so the place is no longer a census town.`,
    },
  ],
  measure: {
    instruction: 'Keep the area, the work share and the municipality setting fixed. Record the density for at least three different populations.',
    vary: 'P',
    record: ['D', 'T', 'K'],
    fit: {
      xLabel: 'population (persons)',
      yLabel: 'density (persons per km²)',
      x: (v) => v.P!,
      y: (_v, o) => o.D!,
      interpret: (slope, _i, v) => `Density against population is a straight line through the origin. The slope is 1 ÷ area = ${fmt(slope, 4)} per km², so the area is 1 ÷ slope = ${fmt(1 / slope, 1)} km² (the slider is set to ${v.A} km²).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A settlement has 7,500 people living in 15 km². 80 per cent of its male main workers are in non-agricultural work and it has no municipality. Is it a census town?',
      options: ['Yes, it passes all three tests', 'No, its density is below 400', 'No, its population is below 5,000', 'No, because it has no municipality'], answer: 0,
      why: 'Population 7,500 is at least 5,000. Density = 7,500 ÷ 15 = 500 per km², at least 400. 80 % is at least 75 %. All three tests pass, so it is a census town; a municipality is only needed for a statutory town.',
      verify: () => (tests(7500, 15, 80) === 3 ? 0 : 1),
    },
    {
      id: 'q2', q: 'A town has a population of 85,000. To which size class does it belong?', options: ['Class I', 'Class II', 'Class III', 'Class IV'], answer: 1,
      why: 'Class II covers 50,000 to 99,999 people. Class I begins at 1,00,000.',
      verify: () => cls(85000) - 1,
    },
    {
      id: 'q3', q: 'A place has 6,000 people in 20 km² and 90 per cent of its male main workers are in non-agricultural work. It has no municipality. Why is it not a census town?',
      options: ['Its population is below 5,000', 'Its density is 300 per km², below 400', 'Too few of its workers are non-farm workers', 'It is a Class IV town'], answer: 1,
      why: 'Population 6,000 passes and the work share 90 % passes, but density = 6,000 ÷ 20 = 300 per km², below 400. Failing one test is enough to fail.',
      verify: () => (dens(6000, 20) < 400 && 6000 >= 5000 && 90 >= 75 ? 1 : 0),
    },
    {
      id: 'q4', q: 'A city has a population of 12 lakh. Which description is correct?', options: ['A Class II town', 'A Class I city but not a million-plus city', 'A Class I million-plus (metropolitan) city', 'A Class VI settlement'], answer: 2,
      why: '12 lakh = 12,00,000, at least 1,00,000, so it is Class I (a city), and at least 10,00,000, so it is a million-plus city.',
      verify: () => (cls(1200000) === 1 && 1200000 >= 1e6 ? 2 : 1),
    },
    {
      id: 'q5', q: 'A town has 18,500 people. Its size class is', options: ['Class IV', 'Class III', 'Class V', 'Class II'], answer: 0,
      why: 'Class IV covers 10,000 to 19,999 people. Class III starts at 20,000.',
      verify: () => closest(cls(18500), [4, 3, 5, 2]),
    },
  ],
};
