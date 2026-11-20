/**
 * Chapter lab: General Aptitude Test, "General science and environment literacy at NCERT Class 9-12 level" - energy flow and the ten per cent law.
 * Model: energy at consumer level n = producer energy x (transfer fraction)^n; the lesson takes 10 per cent per step.
 * Producer energy values are illustrative. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const level = (E0: number, eta: number, n: number) => E0 * Math.pow(eta / 100, n);
const LEVELS = ['Producers', 'Primary consumers', 'Secondary consumers', 'Tertiary consumers', 'Quaternary consumers', '5th consumers'];

export const spec: Spec = {
  id: 'gat-ecosystem-energy',
  subject: 'General Aptitude Test',
  lessonTitleStartsWith: 'General science and environment literacy',
  afterHeading: 'Ecosystems and energy flow',
  title: 'Food Chain Energy Lab',
  format: 'Virtual experiment · energy pyramid',
  blurb: 'Store energy in the producers, pick how much passes to the next level, and watch the energy pyramid shrink step by step. See why food chains are short.',
  can: ['Apply the ten per cent law to a food chain', 'Change the transfer percentage and see the energy at each level', 'Record primary-consumer energy for three producer values and fit the transfer fraction'],
  minutes: 8,
  vars: [
    { id: 'E', label: 'Energy stored by the producers (illustrative)', unit: 'J', min: 1000, max: 100000, step: 1, start: 20000, log: true, digits: 0 },
    { id: 'e', label: 'Share of energy passed to the next level', unit: '%', min: 5, max: 20, step: 1, start: 10, digits: 0, bounds: { min: 0.1, max: 100 } },
    { id: 'n', label: 'Consumer level examined (1 = primary consumers)', unit: '', min: 1, max: 5, step: 1, start: 3, digits: 0, choice: true },
  ],
  outs: [
    { id: 'E1', label: 'Energy at the primary consumers', unit: 'J', fn: (v) => level(v.E!, v.e!, 1), digits: 1 },
    { id: 'E2', label: 'Energy at the secondary consumers', unit: 'J', fn: (v) => level(v.E!, v.e!, 2), digits: 2 },
    { id: 'E3', label: 'Energy at the tertiary consumers', unit: 'J', fn: (v) => level(v.E!, v.e!, 3), digits: 3 },
    { id: 'En', label: 'Energy at the chosen consumer level', unit: 'J', fn: (v) => level(v.E!, v.e!, v.n!), digits: 3 },
    { id: 'Pc', label: 'Share of the producers\' energy reaching that level', unit: '%', fn: (v) => 100 * Math.pow(v.e! / 100, v.n!), digits: 4 },
    { id: 'Lo', label: 'Energy lost (as heat) before that level', unit: 'J', fn: (v) => v.E! - level(v.E!, v.e!, v.n!), digits: 0 },
  ],
  graphs: [
    { id: 'en-n', title: 'Energy at the chosen level against the level', x: 'n', y: 'En', logY: true },
    { id: 'e2-e', title: 'Secondary-consumer energy against the transfer percentage', x: 'e', y: 'E2' },
    { id: 'e1-e0', title: 'Primary-consumer energy against producer energy', x: 'E', y: 'E1', logX: true, logY: true },
  ],
  sceneAlt: 'An energy pyramid of six horizontal bars from producers to fifth consumers. Each bar is narrower than the one below, the chosen level is highlighted, and the energy in joules is written on each.',
  scene: ({ v, o }) => {
    return (
      <g fontSize={10} textAnchor="middle">
        {LEVELS.map((name, i) => {
          const E = level(v.E!, v.e!, i);
          const w = Math.max(6, Math.min(300, 40 + Math.log10(Math.max(E, 1e-3) / 1) * 52 - 40));
          const y = 12 + (5 - i) * 32;
          const hi = i === v.n;
          return (
            <g key={name}>
              <rect x={200 - w / 2} y={y} width={w} height={26} rx={3} fill={hi ? ACC : i === 0 ? '#6aa84f' : BLUE} opacity={hi ? 1 : 0.7} />
              <text x={200} y={y + 17} fill={w > 150 ? '#fff' : INK} fontWeight="bold" dy={0}>{w > 150 ? `${name}: ${fmt(E, E >= 100 ? 0 : 2)} J` : ''}</text>
              {w <= 150 && <text x={200 + w / 2 + 6} y={y + 17} textAnchor="start" fill={INK}>{name.replace(' consumers', '')}: {fmt(E, E >= 100 ? 0 : E >= 1 ? 1 : 3)} J</text>}
            </g>
          );
        })}
        <text x={200} y={226} fill={GREY} fontSize={9}>bar width follows the logarithm of the energy · {fmt(o.Pc!, 3)} % of producer energy reaches level {v.n}</text>
      </g>
    );
  },
  discover: [
    'Slide the consumer level from 1 to 5 and watch the energy in the picture. By what factor does each step shrink it at 10 %?',
    'Raise the transfer share from 10 % to 20 %. Which level changes by the largest factor?',
    'With the producer energy at 1,000 J, at which level does the energy fall below 1 J?',
  ],
  experiment: [
    'Set producers to 20,000 J and transfer 10 %. Read the energy at levels 1, 2 and 3 and compare with the lesson.',
    'Fix level 3 and find the producer energy needed to give 100 J at the tertiary consumers.',
    'Hold the transfer at 10 % and find the largest number of consumer levels that still receive at least 1 J from 20,000 J.',
  ],
  understand: [
    'Energy enters an ecosystem as sunlight, is captured by producers and passes to consumers; decomposers recycle dead matter.',
    'At each step only about 10 per cent of the energy passes to the next trophic level (the ten per cent law); the rest is lost as heat in respiration.',
    'Energy at level n = producer energy × (transfer fraction)ⁿ, so it falls geometrically with each step.',
    'Because energy drops so fast, food chains are short, usually four or five levels.',
  ],
  preds: [
    {
      id: 'p1', title: 'Twice the producer energy', prompt: 'A grassland\'s producers store 20,000 J. If they stored 40,000 J instead (10 % transfer), what happens to the energy at the tertiary consumers?',
      base: { E: 20000, e: 10 }, test: { E: 40000 }, options: ['It doubles', 'It stays the same', 'It halves', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => closest(outs(test).E3! / outs(base).E3!, [2, 1, 0.5, 4]),
      why: ({ base, test, outs }) => `Energy at any level is proportional to the producer energy. At the tertiary consumers it goes from ${fmt(outs(base).E3!, 1)} J to ${fmt(outs(test).E3!, 1)} J.`,
    },
    {
      id: 'p2', title: 'A more efficient transfer', prompt: 'The share passed on at each step is raised from 10 % to 20 %. What happens to the energy at the secondary consumers (two steps)?',
      base: { E: 20000, e: 10 }, test: { e: 20 }, options: ['It doubles', 'It becomes four times as large', 'It becomes ten times as large', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).E2! / outs(base).E2!, [2, 4, 10, 1]),
      why: ({ base, test, outs }) => `Two steps means the fraction is applied twice: (0.2)² ÷ (0.1)² = 4. The energy goes from ${fmt(outs(base).E2!, 0)} J to ${fmt(outs(test).E2!, 0)} J.`,
    },
    {
      id: 'p3', title: 'Further up the chain', prompt: 'Compare the energy at the primary consumers (level 1) with the energy at the tertiary consumers (level 3) at 10 % transfer. The tertiary consumers have',
      base: { n: 1 }, test: { n: 3 }, options: ['one tenth as much', 'one thousandth as much', 'one hundredth as much', 'one fifth as much'], answer: 2,
      verify: ({ base, test, outs }) => closest(outs(test).En! / outs(base).En!, [0.1, 0.001, 0.01, 0.2]),
      why: ({ base, test, outs }) => `Two more steps, each keeping 10 %: 0.1 × 0.1 = 0.01. The energy goes from ${fmt(outs(base).En!, 1)} J to ${fmt(outs(test).En!, 2)} J.`,
    },
    {
      id: 'p4', title: 'Half the transfer', prompt: 'The share passed on falls from 10 % to 5 %. What happens to the energy at the secondary consumers?',
      base: { E: 20000, e: 10 }, test: { e: 5 }, options: ['It halves', 'It is unchanged', 'It falls to one tenth', 'It falls to one quarter'], answer: 3,
      verify: ({ base, test, outs }) => closest(outs(test).E2! / outs(base).E2!, [0.5, 1, 0.1, 0.25]),
      why: ({ base, test, outs }) => `Two steps: (0.05)² ÷ (0.10)² = 0.25. The energy goes from ${fmt(outs(base).E2!, 0)} J to ${fmt(outs(test).E2!, 1)} J.`,
    },
  ],
  measure: {
    instruction: 'Keep the transfer share at 10 %. Record the energy at the primary consumers for at least three different producer energies.',
    vary: 'E',
    record: ['E1', 'E2', 'E3'],
    fit: {
      xLabel: 'producer energy (J)',
      yLabel: 'primary-consumer energy (J)',
      x: (v) => v.E!,
      y: (_v, o) => o.E1!,
      interpret: (slope, _i, v) => `Primary-consumer energy against producer energy is a straight line through the origin. The slope is the fraction passed on = ${fmt(slope, 3)}, that is ${fmt(slope * 100, 1)} % (the slider is set to ${v.e} %).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A grassland ecosystem\'s producers store 20,000 J of energy. By the ten per cent law, the energy that reaches the tertiary consumers is', options: ['2,000 J', '200 J', '20 J', '2 J'], answer: 2,
      why: 'Primary consumers 2,000 J, secondary consumers 200 J, tertiary consumers 20 J (each step is 10 % of the one before).',
      verify: () => closest(level(20000, 10, 3), [2000, 200, 20, 2]),
    },
    {
      id: 'q2', q: 'Herbivores (primary consumers) in a pond store 500 J. By the ten per cent law the producers must have stored', options: ['5,000 J', '50 J', '500 J', '50,000 J'], answer: 0,
      why: 'Primary consumers receive 10 % of the producers\' energy, so producers = 500 ÷ 0.10 = 5,000 J.',
      verify: () => closest(500 / 0.1, [5000, 50, 500, 50000]),
    },
    {
      id: 'q3', q: 'Producers store 1,000,000 J. By the ten per cent law the energy that reaches the fourth consumers (four steps) is', options: ['100 J', '1,000 J', '10,000 J', '10 J'], answer: 0,
      why: 'Four steps multiply the energy by 0.1⁴ = 0.0001, so 1,000,000 × 0.0001 = 100 J.',
      verify: () => closest(level(1000000, 10, 4), [100, 1000, 10000, 10]),
    },
    {
      id: 'q4', q: 'What percentage of the producers\' energy reaches the tertiary consumers (three steps at 10 % each)?', options: ['10 %', '1 %', '0.1 %', '0.01 %'], answer: 2,
      why: '0.1 × 0.1 × 0.1 = 0.001 = 0.1 %.',
      verify: () => closest(100 * Math.pow(0.1, 3), [10, 1, 0.1, 0.01]),
    },
    {
      id: 'q5', q: 'Producers store 100,000 J. How much of it does not reach the tertiary consumers by the ten per cent law?', options: ['10,000 J', '90,000 J', '99,000 J', '99,900 J'], answer: 3,
      why: 'Tertiary consumers receive 100,000 × 0.001 = 100 J, so 100,000 − 100 = 99,900 J does not reach them (lost as heat in respiration at the steps).',
      verify: () => closest(100000 - level(100000, 10, 3), [10000, 90000, 99000, 99900]),
    },
  ],
};
