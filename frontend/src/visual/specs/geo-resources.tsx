/**
 * Chapter lab: Geography, "Resources and development" - cropping intensity from net sown area and rainwater harvesting V = A x R x c.
 * Both formulas are the ones given in the lesson. The numbers on the sliders are illustrative, not real statistics. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const gca = (nsa: number, p: number) => nsa * (1 + p / 100);
const ci = (nsa: number, p: number) => (gca(nsa, p) / nsa) * 100;
const harvest = (A: number, R: number, c: number) => A * R * c; // cubic metres

export const spec: Spec = {
  id: 'geo-resources',
  subject: 'Geography',
  lessonTitleStartsWith: 'Resources and development',
  afterHeading: 'Land resources and land use',
  title: 'Cropping Intensity and Rainwater Harvest Lab',
  format: 'Calculator · virtual experiment',
  blurb: 'Change the net sown area and the share of it sown twice to see gross cropped area and cropping intensity, then size a rooftop harvest from roof area, rainfall and runoff coefficient. Numbers are illustrative.',
  can: ['See cropping intensity rise above 100 per cent as land is sown twice', 'Watch the rooftop tank fill as roof area and rainfall change', 'Record harvested volume for three roof areas and fit the runoff coefficient'],
  minutes: 9,
  vars: [
    { id: 'N', label: 'Net sown area (illustrative district)', unit: 'ha', min: 1000, max: 20000, step: 500, start: 8000, digits: 0 },
    { id: 'p', label: 'Share of the net sown area sown more than once', unit: '%', min: 0, max: 100, step: 5, start: 50, digits: 0, bounds: { min: 0, max: 100 } },
    { id: 'A', label: 'Roof area A', unit: 'm²', min: 20, max: 500, step: 10, start: 100, digits: 0 },
    { id: 'R', label: 'Annual rainfall R', unit: 'm', min: 0.2, max: 2, step: 0.1, start: 0.6, digits: 1 },
    { id: 'c', label: 'Runoff coefficient c (fraction not lost)', unit: '', min: 0.3, max: 0.95, step: 0.05, start: 0.8, digits: 2, bounds: { min: 0, max: 1 } },
  ],
  outs: [
    { id: 'G', label: 'Gross cropped area = net sown area + area sown more than once', unit: 'ha', fn: (v) => gca(v.N!, v.p!), digits: 0 },
    { id: 'CI', label: 'Cropping intensity = gross cropped area ÷ net sown area × 100', unit: '%', fn: (v) => ci(v.N!, v.p!), digits: 0 },
    { id: 'M', label: 'Area sown more than once', unit: 'ha', fn: (v) => (v.N! * v.p!) / 100, digits: 0 },
    { id: 'V', label: 'Water harvested V = A × R × c', unit: 'm³', fn: (v) => harvest(v.A!, v.R!, v.c!), digits: 1 },
    { id: 'VL', label: 'Water harvested in litres', unit: 'litres', fn: (v) => harvest(v.A!, v.R!, v.c!) * 1000, digits: 0 },
  ],
  graphs: [
    { id: 'ci-p', title: 'Cropping intensity against the share sown twice', x: 'p', y: 'CI' },
    { id: 'g-n', title: 'Gross cropped area against net sown area', x: 'N', y: 'G' },
    { id: 'v-r', title: 'Water harvested against rainfall', x: 'R', y: 'V' },
  ],
  sceneAlt: 'A grid of twenty field plots, with the number of doubly cropped plots following the share sown twice, and below it a roof, falling rain and a tank whose water level follows the harvested volume.',
  scene: ({ v, o }) => {
    const twice = Math.round(v.p! / 5);
    const drops = Math.max(2, Math.round(v.R! * 8));
    const roofW = 40 + (v.A! / 500) * 90;
    const level = Math.min(1, o.V! / 600);
    return (
      <g fontSize={10} textAnchor="middle">
        <text x={110} y={14} fill={INK} fontWeight="bold">Net sown area (20 plots)</text>
        {Array.from({ length: 20 }, (_, i) => {
          const x = 20 + (i % 5) * 38;
          const y = 22 + Math.floor(i / 5) * 24;
          return (
            <g key={i}>
              <rect x={x} y={y} width={34} height={20} rx={2} fill="#9fd1a8" stroke="#6da878" />
              {i < twice && <rect x={x + 4} y={y + 4} width={26} height={12} rx={2} fill="#2e8b57" />}
            </g>
          );
        })}
        <text x={110} y={128} fill={GREY}>dark inner patch = sown a second time</text>
        <text x={110} y={142} fill={ACC} fontWeight="bold">Cropping intensity {fmt(o.CI!, 0)} %</text>
        <text x={300} y={14} fill={INK} fontWeight="bold">Rooftop harvest</text>
        {Array.from({ length: drops }, (_, i) => <path key={i} d={`M ${230 + (i * 140) / drops + 6} ${24 + (i % 3) * 8} l -2 8`} stroke={BLUE} strokeWidth={1.5} />)}
        <path d={`M ${300 - roofW / 2} 76 L 300 48 L ${300 + roofW / 2} 76 Z`} fill="#b5654a" />
        <rect x={290} y={100} width={20} height={0} />
        <rect x={262} y={96} width={76} height={60} rx={4} fill="#fff" stroke={BLUE} />
        <rect x={263} y={156 - 58 * level} width={74} height={58 * level} fill={BLUE} opacity={0.55} />
        <path d="M 300 76 V 96" stroke={GREY} strokeWidth={2} />
        <text x={300} y={172} fill={BLUE} fontWeight="bold">{fmt(o.V!, 1)} m³ = {fmt(o.VL!, 0)} L</text>
        <text x={110} y={200} fill={GREY}>A = {v.A} m² · R = {fmt(v.R!, 1)} m · c = {fmt(v.c!, 2)}</text>
        <text x={110} y={214} fill={GREY}>net sown {fmt(v.N!, 0)} ha · gross cropped {fmt(o.G!, 0)} ha</text>
      </g>
    );
  },
  discover: [
    'Drag the share sown more than once from 0 to 100 and watch the cropping intensity. What are its smallest and largest values?',
    'Double the net sown area without touching the share. What happens to gross cropped area and to cropping intensity?',
    'Raise the roof area, the rainfall and the runoff coefficient one at a time. Which of them can never push the harvest above A × R?',
  ],
  experiment: [
    'Keep the share at 0 %. What is the cropping intensity, and what does it mean for every hectare?',
    'Fix the rainfall and runoff coefficient and read the harvest for three roof areas.',
    'How much does a leaky roof (lower c) cost you in litres per year for the same rain?',
  ],
  understand: [
    'Gross cropped area = net sown area + area sown more than once. Cropping intensity = gross cropped area ÷ net sown area × 100.',
    'A cropping intensity of 100 % means every hectare is sown once; a higher value means part of the land is cropped more than once in a year.',
    'Cropping intensity depends on the share sown twice, not on how large the district is.',
    'Rainwater harvested V = A × R × c (m³); one cubic metre is 1,000 litres. c is the fraction of rain that is not lost.',
  ],
  preds: [
    {
      id: 'p1', title: 'Sow every hectare twice', prompt: 'In a district, none of the net sown area is sown more than once. Then every hectare of it is sown twice. What does the cropping intensity become?',
      base: { p: 0 }, test: { p: 100 }, options: ['100 %', '150 %', '200 %', '300 %'], answer: 2,
      verify: ({ test, outs }) => closest(outs(test).CI!, [100, 150, 200, 300]),
      why: ({ base, test, outs }) => `Cropping intensity = gross cropped area ÷ net sown area × 100. It rises from ${fmt(outs(base).CI!, 0)} % to ${fmt(outs(test).CI!, 0)} %, because the gross cropped area becomes twice the net sown area.`,
    },
    {
      id: 'p2', title: 'Double the roof', prompt: 'A roof of 100 m² is replaced by one of 200 m² in the same rain, with the same runoff coefficient. What happens to the water harvested?',
      base: { A: 100 }, test: { A: 200 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).V! / outs(base).V!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `V = A × R × c, so V is proportional to A. It goes from ${fmt(outs(base).V!, 1)} m³ to ${fmt(outs(test).V!, 1)} m³.`,
    },
    {
      id: 'p3', title: 'A leakier roof', prompt: 'The runoff coefficient falls from 0.8 to 0.4 because the roof loses more water to leaks and splashing. What happens to the harvest?',
      base: { c: 0.8 }, test: { c: 0.4 }, options: ['It falls to half', 'It falls to one fifth', 'It stays the same', 'It doubles'], answer: 0,
      verify: ({ base, test, outs }) => closest(outs(test).V! / outs(base).V!, [0.5, 0.2, 1, 2]),
      why: ({ base, test, outs }) => `V is proportional to c. The harvest falls from ${fmt(outs(base).V!, 1)} m³ to ${fmt(outs(test).V!, 1)} m³, half as much.`,
    },
    {
      id: 'p4', title: 'A bigger district, the same practice', prompt: 'The net sown area doubles from 8,000 ha to 16,000 ha, with the same share (50 %) sown twice. What happens?',
      base: { N: 8000 }, test: { N: 16000 }, options: ['Cropping intensity doubles', 'Cropping intensity is unchanged but gross cropped area doubles', 'Cropping intensity halves', 'Gross cropped area is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).CI! - outs(base).CI!) < 1e-9 && Math.abs(outs(test).G! / outs(base).G! - 2) < 1e-9 ? 1 : 0),
      why: ({ base, test, outs }) => `Cropping intensity is a ratio, so it stays at ${fmt(outs(test).CI!, 0)} %. Gross cropped area goes from ${fmt(outs(base).G!, 0)} ha to ${fmt(outs(test).G!, 0)} ha.`,
    },
  ],
  measure: {
    instruction: 'Keep the rainfall and runoff coefficient fixed. Record the water harvested for at least three different roof areas.',
    vary: 'A',
    record: ['V', 'VL'],
    fit: {
      xLabel: 'roof area A (m²)',
      yLabel: 'water harvested V (m³)',
      x: (v) => v.A!,
      y: (_v, o) => o.V!,
      interpret: (slope, _i, v) => `V against A is a straight line through the origin. The slope is R × c = ${fmt(slope, 3)} m, so with the rainfall R = ${fmt(v.R!, 1)} m the runoff coefficient is c = slope ÷ R = ${fmt(slope / v.R!, 2)}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A district has a net sown area of 8,000 hectares and a gross cropped area of 12,000 hectares. Its cropping intensity is', options: ['120 %', '150 %', '66.7 %', '200 %'], answer: 1,
      why: 'Cropping intensity = gross cropped area ÷ net sown area × 100 = 12,000 ÷ 8,000 × 100 = 150 %.',
      verify: () => closest((12000 / 8000) * 100, [120, 150, 66.7, 200]),
    },
    {
      id: 'q2', q: 'For the same district (net sown area 8,000 ha, gross cropped area 12,000 ha) the area sown more than once is', options: ['4,000 ha', '2,000 ha', '8,000 ha', '12,000 ha'], answer: 0,
      why: 'Gross cropped area = net sown area + area sown more than once, so the area sown more than once = 12,000 − 8,000 = 4,000 ha.',
      verify: () => closest(12000 - 8000, [4000, 2000, 8000, 12000]),
    },
    {
      id: 'q3', q: 'A roof of 100 m² receives 0.6 m of rain a year and the runoff coefficient is 0.8. How much water can be harvested in a year?', options: ['4,800 litres', '48,000 litres', '60,000 litres', '4,80,000 litres'], answer: 1,
      why: 'V = A × R × c = 100 × 0.6 × 0.8 = 48 m³. One m³ is 1,000 litres, so 48,000 litres.',
      verify: () => closest(harvest(100, 0.6, 0.8) * 1000, [4800, 48000, 60000, 480000]),
    },
    {
      id: 'q4', q: 'A district has a net sown area of 5,000 ha and a cropping intensity of 140 per cent. Its gross cropped area is', options: ['5,140 ha', '6,400 ha', '1,400 ha', '7,000 ha'], answer: 3,
      why: 'Gross cropped area = cropping intensity ÷ 100 × net sown area = 1.40 × 5,000 = 7,000 ha.',
      verify: () => closest(gca(5000, 40), [5140, 6400, 1400, 7000]),
    },
    {
      id: 'q5', q: 'A school roof of 50 m² gets 1.0 m of rain a year and the runoff coefficient is 0.9. Water harvested in a year is about', options: ['4,500 litres', '5,000 litres', '45,000 litres', '55,000 litres'], answer: 2,
      why: 'V = 50 × 1.0 × 0.9 = 45 m³ = 45,000 litres.',
      verify: () => closest(harvest(50, 1.0, 0.9) * 1000, [4500, 5000, 45000, 55000]),
    },
  ],
};
