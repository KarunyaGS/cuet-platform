/**
 * Chapter lab: Biology, "Ecosystem", productivity, the ten per cent law and the pyramid of energy.
 * Model (the lesson's chain): PAR = 50 per cent of incident radiation; producers capture a few per cent of PAR (GPP);
 * NPP = GPP - R; each step passes on about 10 per cent (Lindeman), E(n+1) = E(n) x efficiency. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'rad', label: 'Incident solar radiation', unit: 'kJ m⁻² day⁻¹', min: 1000, max: 8000, step: 250, start: 4000, digits: 0 },
  { id: 'cap', label: 'Share of PAR captured by producers', unit: '%', min: 1, max: 10, step: 0.5, start: 2, digits: 1, bounds: { min: 0.01, max: 100 } },
  { id: 'resp', label: 'Share of GPP used in the plants\' respiration', unit: '%', min: 10, max: 70, step: 5, start: 40, digits: 0, bounds: { min: 0, max: 100 } },
  { id: 'eff', label: 'Energy passed to the next trophic level', unit: '%', min: 5, max: 20, step: 1, start: 10, digits: 0, bounds: { min: 0.1, max: 100 } },
  { id: 'n', label: 'Trophic level examined (1 = producers)', unit: 'level', min: 1, max: 5, step: 1, start: 3, digits: 0, choice: true },
];
const PAR = 0.5;
const gpp = (v: Values) => v.rad! * PAR * (v.cap! / 100);
const level = (v: Values, k: number) => gpp(v) * Math.pow(v.eff! / 100, k - 1);
const outs: OutDef[] = [
  { id: 'gpp', label: 'Energy captured by producers (GPP)', unit: 'kJ m⁻² day⁻¹', fn: gpp, digits: 1 },
  { id: 'npp', label: 'Net primary productivity NPP = GPP − R', unit: 'kJ m⁻² day⁻¹', fn: (v) => gpp(v) * (1 - v.resp! / 100), digits: 1 },
  { id: 'En', label: 'Energy at the chosen trophic level', unit: 'kJ m⁻² day⁻¹', fn: (v) => level(v, v.n!), digits: 3 },
  { id: 'E4', label: 'Energy at the fourth level (secondary carnivores)', unit: 'kJ m⁻² day⁻¹', fn: (v) => level(v, 4), digits: 4 },
  { id: 'pct', label: 'Share of the sunlight that reaches the chosen level', unit: '%', fn: (v) => (100 * level(v, v.n!)) / v.rad!, digits: 4 },
];
const names = ['Producers', 'Herbivores', 'Primary carnivores', 'Secondary carnivores', 'Top carnivores'];

export const spec: Spec = {
  id: 'bio-ecosystem',
  subject: 'Biology',
  lessonTitleStartsWith: 'Ecosystem',
  afterHeading: 'Ecological pyramids: energy, biomass and number',
  title: 'Energy Flow and Pyramid Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Start from sunlight, trace what the producers capture and what each trophic level receives under the ten per cent law, and watch the pyramid of energy narrow as the transfer efficiency changes.',
  can: ['Follow solar energy through PAR, GPP and NPP', 'See why a food chain has only a few levels', 'Fit the transfer efficiency from log(energy) against trophic level'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'En', title: 'Energy against trophic level', x: 'n', y: 'En', logY: true },
    { id: 'E4', title: 'Energy at the fourth level against transfer efficiency', x: 'eff', y: 'E4' },
    { id: 'gpp', title: 'Producers\' GPP against the share of PAR captured', x: 'cap', y: 'gpp' },
  ],
  sceneAlt: 'A pyramid of energy with five stacked bars from producers at the base to top carnivores at the apex. The bar widths shrink by the transfer efficiency at each step, the level you are examining is highlighted, and the energy of each level is written beside it.',
  scene: ({ v }) => {
    const e = v.eff! / 100;
    return (
      <g>
        {[1, 2, 3, 4, 5].map((k) => {
          const w = 20 + 250 * Math.pow(e, (k - 1) * 0.6);
          const y = 190 - k * 34;
          const on = k === v.n;
          return (
            <g key={k}>
              <rect x={150 - w / 2} y={y} width={w} height={30} fill={on ? '#c45e42' : '#4a8f3c'} opacity={on ? 0.9 : 0.55} stroke="#18443b" />
              <text x={396} y={y + 18} fontSize={9.5} textAnchor="end" fill="#4d5768">{names[k - 1]}: {fmt(level(v, k), 3)}</text>
            </g>
          );
        })}
        <text x={10} y={14} fontSize={10} fill="#4d5768">sunlight {fmt(v.rad!, 0)} → PAR {fmt(v.rad! * 0.5, 0)} → GPP {fmt(gpp(v), 1)} (kJ m⁻² day⁻¹)</text>
        <text x={150} y={226} fontSize={10} textAnchor="middle" fill="#4d5768">each step keeps {fmt(v.eff!, 0)} percent: pyramid of energy is always upright</text>
      </g>
    );
  },
  discover: [
    'Move the trophic level from 1 to 5 and watch the energy fall at each step.',
    'Change the transfer efficiency. Which level changes most: the second or the fifth?',
    'Raise the respiration share and read the NPP.',
  ],
  experiment: [
    'With the ten per cent law, how many times less energy does the third level have than the first?',
    'How much does the fourth-level energy change when the efficiency goes from 10 to 20 percent?',
    'Why can the pyramid of energy never be inverted even when the pyramid of biomass is?',
  ],
  understand: [
    'GPP is the rate of organic matter produced in photosynthesis; NPP = GPP − R is what remains for consumers.',
    'Only less than 50 per cent of sunlight is photosynthetically active and plants capture 2 to 10 per cent of that.',
    'By Lindeman\'s ten per cent law about 10 per cent of the energy passes on at each step, so energy falls tenfold per level.',
    'The pyramid of energy is always upright because energy is lost at every step; the pyramid of biomass can be inverted in the sea.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'More efficient transfer', prompt: 'The transfer efficiency between trophic levels rises from 10 percent to 20 percent. How does the energy at the fourth level change?',
      base: { eff: 10 }, test: { eff: 20 },
      labels: ['It becomes 2 times as large', 'It stays the same', 'It becomes 8 times as large', 'It becomes 4 times as large'], vals: [2, 1, 8, 4], f: (o) => o.E4!,
      why: ({ base, test, outs: oo }) => `The fourth level is three transfers from the producers, so it scales as efficiency cubed: (20/10)³ = 8. ${fmt(oo(base).E4!, 4)} becomes ${fmt(oo(test).E4!, 4)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'More respiration', prompt: 'The plants use 60 percent of their GPP in respiration instead of 40 percent. How does the NPP change?',
      base: { resp: 40 }, test: { resp: 60 },
      labels: ['It halves', 'It falls to about two thirds', 'It stays the same', 'It rises by half'], vals: [0.5, 0.667, 1, 1.5], f: (o) => o.npp!,
      why: ({ base, test, outs: oo }) => `NPP = GPP − R: from 60 percent of GPP to 40 percent. ${fmt(oo(base).npp!, 1)} becomes ${fmt(oo(test).npp!, 1)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'Two levels up', prompt: 'With the ten per cent law, the energy of the second level (herbivores) is compared with that of the fourth level (secondary carnivores). How many times less energy has the fourth level?',
      base: { n: 2, eff: 10 }, test: { n: 4 },
      labels: ['10 times less', '100 times less', '1000 times less', '4 times less'], vals: [0.1, 0.01, 0.001, 0.25], f: (o) => o.En!,
      why: ({ base, test, outs: oo }) => `Each step keeps 10 percent, so two steps keep 1 percent: ${fmt(oo(base).En!, 2)} becomes ${fmt(oo(test).En!, 4)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'A brighter day', prompt: 'The incident solar radiation doubles from 2000 to 4000 kJ m⁻² day⁻¹ (everything else the same). What happens to the energy at the second level?',
      base: { rad: 2000, n: 2 }, test: { rad: 4000 },
      labels: ['It doubles', 'It stays the same', 'It becomes four times as large', 'It falls to half'], vals: [2, 1, 4, 0.5], f: (o) => o.En!,
      why: ({ base, test, outs: oo }) => `The captured energy is proportional to the sunlight and every level is a fixed share of it: ${fmt(oo(base).En!, 2)} becomes ${fmt(oo(test).En!, 2)}.`,
    }),
  ],
  measure: {
    instruction: 'Keep the sunlight, capture and efficiency fixed. Record the energy at three or more different trophic levels.',
    vary: 'n',
    record: ['En', 'pct'],
    fit: {
      xLabel: 'trophic level n',
      yLabel: 'log₁₀(energy)',
      x: (v) => v.n!,
      y: (_v, o) => Math.log10(o.En!),
      interpret: (slope, _i, v) => `log₁₀(energy) against level is a straight line. The slope is log₁₀(efficiency) = ${fmt(slope, 3)}, so each step passes on ${fmt(100 * Math.pow(10, slope), 1)} percent (the slider says ${fmt(v.eff!, 0)} percent). Energy falls by a constant factor per level.`,
    },
  },
  questions: [
    mkQ('q1', 'A grassland receives 4000 kJ m⁻² day⁻¹; 50 percent is PAR and the producers capture 2 percent of the PAR. With the ten per cent law, how much energy reaches the primary carnivores?', ['40 kJ', '4 kJ', '0.4 kJ', '0.04 kJ'], [40, 4, 0.4, 0.04], () => 4000 * 0.5 * 0.02 * 0.1 * 0.1,
      'PAR = 2000; producers capture 40; herbivores get 4; primary carnivores get 0.4 kJ m⁻² day⁻¹.'),
    mkQ('q2', 'A grassland has GPP = 1000 g m⁻² yr⁻¹ and plants lose 400 g m⁻² yr⁻¹ in respiration. Herbivores consume 20 percent of the NPP. How much do they eat?', ['200', '120', '80', '600'], [200, 120, 80, 600], () => (1000 - 400) * 0.2,
      'NPP = GPP − R = 600. Herbivores eat 20 percent of that: 0.2 × 600 = 120 g m⁻² yr⁻¹.'),
    mkQ('q3', 'Producers have a biomass of 10 000 kg per hectare and 10 percent passes on at each step. What is the biomass of the fourth trophic level?', ['100 kg', '1 kg', '10 kg', '1000 kg'], [100, 1, 10, 1000], () => 10000 * Math.pow(0.1, 3),
      'Level 2 = 1000, level 3 = 100, level 4 = 10 kg: three steps of 10 percent each.'),
    mkQ('q4', 'The first trophic level of a pond holds 20 000 kcal m⁻² yr⁻¹. Using the ten per cent law, how much does the fourth level hold?', ['20 kcal', '2 kcal', '200 kcal', '2000 kcal'], [20, 2, 200, 2000], () => 20000 * Math.pow(0.1, 3),
      'Three transfers multiply by 0.1³ = 0.001: 20 000 × 0.001 = 20 kcal m⁻² yr⁻¹.'),
    mkQ('q5', 'The PAR reaching a field is 2000 kJ m⁻² day⁻¹ and the plants capture 5 percent of it. What is the GPP?', ['100', '10', '200', '1000'], [100, 10, 200, 1000], () => 2000 * 0.05,
      'GPP = 5 percent of PAR = 0.05 × 2000 = 100 kJ m⁻² day⁻¹.'),
  ],
};
