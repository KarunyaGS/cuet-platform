/**
 * Chapter lab: Biology, "Sexual reproduction in flowering plants", pollen-pistil interaction and double fertilisation.
 * Model: pollen viability halves every `half` minutes (illustrative), compatible viable pollen germinates into tubes,
 * each tube delivers two male gametes to one ovule (syngamy + triple fusion), so seeds = min(ovules, tubes).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { clamp, mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'grains', label: 'Pollen grains landing on the stigma', unit: 'grains', min: 10, max: 500, step: 10, start: 120, digits: 0, integer: true },
  { id: 't', label: 'Time since the pollen was shed', unit: 'min', min: 0, max: 120, step: 5, start: 20, digits: 0 },
  { id: 'half', label: 'Pollen viability half-life', unit: 'min', min: 10, max: 10000, step: 1, start: 60, log: true, digits: 0 },
  { id: 'compat', label: 'Pollen compatible with the pistil', unit: '%', min: 0, max: 100, step: 5, start: 80, digits: 0, bounds: { min: 0, max: 100 } },
  { id: 'ovules', label: 'Ovules in the ovary', unit: 'ovules', min: 1, max: 100, step: 1, start: 20, digits: 0, integer: true },
];
const viable = (v: Values) => 100 * Math.pow(0.5, v.t! / v.half!);
const tubes = (v: Values) => ((v.grains! * viable(v)) / 100) * (v.compat! / 100);
const seeds = (v: Values) => Math.min(v.ovules!, tubes(v));
const outs: OutDef[] = [
  { id: 'viable', label: 'Pollen still viable', unit: '%', fn: viable, digits: 1 },
  { id: 'tubes', label: 'Pollen tubes growing down the style', unit: 'tubes', fn: tubes, digits: 1 },
  { id: 'seeds', label: 'Ovules fertilised (seeds that form)', unit: 'seeds', fn: seeds, digits: 1 },
  { id: 'seedSet', label: 'Seed set (fertilised / ovules)', unit: '%', fn: (v) => (100 * seeds(v)) / v.ovules!, digits: 0 },
  { id: 'gam', label: 'Male gametes used (2 per fertilised ovule)', unit: 'gametes', fn: (v) => 2 * seeds(v), digits: 1 },
];

export const spec: Spec = {
  id: 'bio-sexual-reproduction',
  subject: 'Biology',
  lessonTitleStartsWith: 'Sexual reproduction in flowering plants',
  afterHeading: 'Pollen-pistil interaction',
  title: 'Pollen to Seed Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Land pollen on a stigma, let it age, accept or reject it, and count the pollen tubes and fertilised ovules: seed set follows from pollen number, viability, compatibility and ovule number.',
  can: ['See why pollen that is hours old fails to set seed', 'Find when ovules, not pollen, limit the seed set', 'Fit the pollen viability half-life from your own readings'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'viab', title: 'Pollen viability against time since shedding', x: 't', y: 'viable' },
    { id: 'set', title: 'Seed set against pollen grains landing', x: 'grains', y: 'seedSet' },
    { id: 'tub', title: 'Fertilised ovules against compatible fraction', x: 'compat', y: 'seeds' },
  ],
  sceneAlt: 'A pistil with the stigma at the top, pollen grains on it, pollen tubes running down the style and an ovary below with ovules. Grey grains are dead, green grains are viable, tubes follow the live compatible grains and each fertilised ovule is shaded.',
  scene: ({ v, o }) => {
    const nG = Math.round(clamp(6 + (v.grains! / 500) * 30, 6, 36));
    const live = Math.round((nG * o.viable!) / 100);
    const nT = Math.round(clamp(o.tubes!, 0, 14));
    const nO = Math.min(24, v.ovules!);
    const filled = Math.round((o.seedSet! / 100) * nO);
    return (
      <g>
        <path d="M185 45 Q200 22 215 45" fill="#e9d7a3" stroke="#18443b" />
        <rect x={188} y={45} width={24} height={85} fill="#f2f6e8" stroke="#18443b" />
        <ellipse cx={200} cy={175} rx={85} ry={45} fill="#f2f6e8" stroke="#18443b" strokeWidth={2} />
        {Array.from({ length: nG }, (_, i) => (
          <circle key={i} cx={176 + ((i * 37) % 48)} cy={14 + ((i * 13) % 22)} r={3.4} fill={i < live ? '#4a8f3c' : '#9aa0a8'} />
        ))}
        {Array.from({ length: nT }, (_, i) => (
          <path key={i} d={`M${192 + (i % 8) * 2.2} 46 V ${120 + (i % 3) * 4} L ${150 + ((i * 29) % 100)} ${150 + (i % 3) * 10}`} stroke="#c45e42" strokeWidth={1.3} fill="none" opacity={0.85} />
        ))}
        {Array.from({ length: nO }, (_, i) => {
          const cols = Math.min(nO, 8);
          const cx = 200 - ((cols - 1) * 17) / 2 + (i % cols) * 17;
          const cy = 163 + Math.floor(i / cols) * 17;
          return <ellipse key={i} cx={cx} cy={cy} rx={6} ry={7.5} fill={i < filled ? '#c45e42' : '#fff'} stroke="#18443b" />;
        })}
        <text x={290} y={30} fontSize={11} fill="#4d5768">{live} of {nG} grains viable</text>
        <text x={290} y={46} fontSize={11} fill="#4d5768">{fmt(o.tubes!, 1)} tubes</text>
        <text x={290} y={62} fontSize={11} fill="#4d5768">seed set {fmt(o.seedSet!, 0)}%</text>
        <text x={200} y={226} fontSize={11} textAnchor="middle" fill="#4d5768">filled ovule = fertilised: 1 syngamy + 1 triple fusion</text>
      </g>
    );
  },
  discover: [
    'Drag the time since shedding. Watch the grains turn grey and the pollen tubes disappear.',
    'Slide the pollen half-life: wheat and rice pollen lose viability in about half an hour, Rosaceae pollen lasts months.',
    'Lower the compatible fraction: the pistil rejects pollen and fewer tubes grow.',
  ],
  experiment: [
    'Give the stigma plenty of fresh compatible pollen. How many ovules limit the seed set? Try 1 ovule, as in a grass.',
    'With few ovules, does doubling the pollen change the seed set?',
    'Find the combination of age and half-life where only a quarter of the pollen is viable.',
  ],
  understand: [
    'Pollination does not guarantee fertilisation: only viable, compatible pollen germinates and grows a tube.',
    'Each pollen tube enters one ovule and releases two male gametes: one fuses with the egg (syngamy), the other with the two polar nuclei (triple fusion).',
    'Seed number cannot exceed ovule number, so with excess pollen the ovules become the limit.',
    'Pollen viability falls with time at a rate that depends on the species; pollen can be stored for years in liquid nitrogen.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Old pollen', prompt: 'Pollen with a half-life of 30 minutes (wheat-like) is used 60 minutes after shedding instead of fresh. 80 grains land, all compatible, 100 ovules. What happens to the number of seeds?',
      base: { grains: 80, half: 30, compat: 100, ovules: 100, t: 0 }, test: { t: 60 },
      labels: ['It falls to one half', 'It stays the same', 'It falls to one quarter', 'It falls to one eighth'], vals: [0.5, 1, 0.25, 0.125], f: (o) => o.seeds!,
      why: ({ base, test, outs: oo }) => `Viability halves every 30 minutes, so after 60 minutes only a quarter of the grains are viable. Seeds go from ${fmt(oo(base).seeds!, 1)} to ${fmt(oo(test).seeds!, 1)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'One ovule only', prompt: 'A wind-pollinated flower has ten ovules and receives plenty of fresh compatible pollen (200 grains). It is replaced by a grass-like flower with a single ovule. What is the seed set (percent of ovules fertilised) in the new flower?',
      base: { grains: 200, compat: 100, t: 0, ovules: 10 }, test: { ovules: 1 },
      labels: ['10 percent', '100 percent', '50 percent', '0 percent'], vals: [10, 100, 50, 0], f: (o) => o.seedSet!, mode: 'value',
      why: ({ test, outs: oo }) => `There are 200 tubes for one ovule, so the single ovule is certainly fertilised: seed set = ${fmt(oo(test).seedSet!, 0)} percent. Pollen is in excess, so the ovules are the limit.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'Pistil rejects pollen', prompt: 'The compatible fraction of the pollen falls from 80 percent to 20 percent (50 fresh grains, 50 ovules). What happens to the number of pollen tubes?',
      base: { grains: 50, ovules: 50, t: 0, compat: 80 }, test: { compat: 20 },
      labels: ['It falls to one half', 'It falls to one quarter', 'It stays the same', 'It rises'], vals: [0.5, 0.25, 1, 2], f: (o) => o.tubes!,
      why: ({ base, test, outs: oo }) => `Tubes grow only from compatible viable grains: ${fmt(oo(base).tubes!, 0)} tubes become ${fmt(oo(test).tubes!, 0)}, a quarter as many.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Male gametes needed', prompt: 'With plenty of fresh compatible pollen, the ovary has 5 ovules, then 10 ovules. What happens to the number of male gametes used?',
      base: { grains: 200, compat: 100, t: 0, ovules: 5 }, test: { ovules: 10 },
      labels: ['It stays the same', 'It becomes four times as large', 'It halves', 'It doubles'], vals: [1, 4, 0.5, 2], f: (o) => o.gam!,
      why: ({ base, test, outs: oo }) => `Each fertilised ovule uses two male gametes (syngamy and triple fusion): ${fmt(oo(base).gam!, 0)} become ${fmt(oo(test).gam!, 0)}.`,
    }),
  ],
  measure: {
    instruction: 'Keep the grains, half-life, compatibility and ovules fixed. Record the viable fraction of pollen at three or more different times since shedding.',
    vary: 't',
    record: ['viable', 'tubes', 'seeds'],
    fit: {
      xLabel: 'time t (min)',
      yLabel: 'ln(viable fraction)',
      x: (v) => v.t!,
      y: (_v, o) => Math.log(o.viable! / 100),
      interpret: (slope) => `ln(viable fraction) falls on a straight line with slope −ln 2 ÷ half-life = ${fmt(slope, 4)} per minute, so the half-life is ${fmt(-Math.LN2 / slope, 1)} minutes: viability falls by half each time that interval passes.`,
    },
  },
  questions: [
    mkQ('q1', 'An anther has 50 pollen mother cells in each microsporangium that undergo meiosis. Counting four microsporangia, how many pollen grains can it make?', ['100', '400', '800', '200'], [100, 400, 800, 200], () => 50 * 4 * 4,
      'Each pollen mother cell gives a tetrad of four haploid microspores, and each microspore becomes one pollen grain. 50 PMCs × 4 microsporangia × 4 = 800 pollen grains.'),
    mkQ('q2', 'A flower has 30 ovules and every ovule is fertilised by double fertilisation. How many male gametes were used in all?', ['30', '90', '120', '60'], [30, 90, 120, 60], () => 30 * 2,
      'One tube delivers two male gametes into one embryo sac: one for syngamy and one for triple fusion. 30 ovules × 2 = 60 male gametes.'),
    mkQ('q3', 'Pollen viability halves every 30 minutes. What percentage is viable 90 minutes after release?', ['25', '12.5', '50', '6.25'], [25, 12.5, 50, 6.25], () => 100 * Math.pow(0.5, 90 / 30),
      '90 minutes is three half-lives: 100 → 50 → 25 → 12.5 percent.'),
    mkQ('q4', 'A plant has 2n = 24 chromosomes. How many chromosomes does the primary endosperm nucleus have?', ['36', '12', '48', '24'], [36, 12, 48, 24], () => 3 * 12,
      'Triple fusion joins one male gamete (n = 12) with two polar nuclei (n each), giving 3n = 36 chromosomes.'),
    mkQ('q5', 'The primary endosperm nucleus of a free-nuclear endosperm divides five times without wall formation. How many nuclei are present?', ['10', '16', '64', '32'], [10, 16, 64, 32], () => Math.pow(2, 5),
      'Each division doubles the number of free nuclei: 2⁵ = 32 nuclei, as in the tender coconut water stage.'),
  ],
};
