/**
 * Chapter lab: Biology, "Biodiversity and conservation", the species-area relationship S = C A^Z and what habitat loss does to it.
 * Model (the lesson's equation): log S = log C + Z log A; Z is 0.1 to 0.2 within regions and 0.6 to 1.2 across whole continents.
 * Habitat loss shrinks A, and the species expected in the smaller area are C (A_left)^Z. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ, pathOf } from './_bio-util';

const vars: VarDef[] = [
  { id: 'C', label: 'Intercept C (species in 1 ha)', unit: 'species', min: 5, max: 50, step: 1, start: 15, digits: 0, integer: true },
  { id: 'z', label: 'Slope Z of the log-log line', unit: '', min: 0.1, max: 1.2, step: 0.05, start: 0.2, digits: 2 },
  { id: 'A', label: 'Area explored A', unit: 'ha', min: 1, max: 10000, step: 1, start: 100, log: true, digits: 0 },
  { id: 'lost', label: 'Habitat destroyed', unit: '%', min: 0, max: 90, step: 5, start: 30, digits: 0, bounds: { min: 0, max: 99 } },
];
const S = (v: Values, A = v.A!) => v.C! * Math.pow(A, v.z!);
const left = (v: Values) => v.A! * (1 - v.lost! / 100);
const outs: OutDef[] = [
  { id: 'S', label: 'Species richness S = C·A^Z', unit: 'species', fn: (v) => S(v), digits: 1 },
  { id: 'logS', label: 'log₁₀ S', unit: '', fn: (v) => Math.log10(S(v)), digits: 3 },
  { id: 'Sleft', label: 'Species expected in the remaining habitat', unit: 'species', fn: (v) => S(v, left(v)), digits: 1 },
  { id: 'gone', label: 'Species expected to be lost', unit: 'species', fn: (v) => S(v) - S(v, left(v)), digits: 1 },
  { id: 'pct', label: 'Share of species lost', unit: '%', fn: (v) => 100 * (1 - Math.pow(1 - v.lost! / 100, v.z!)), digits: 1 },
  { id: 'dbl', label: 'Area factor needed to double the species', unit: '×', fn: (v) => Math.pow(2, 1 / v.z!), digits: 1 },
];

export const spec: Spec = {
  id: 'bio-biodiversity',
  subject: 'Biology',
  lessonTitleStartsWith: 'Biodiversity and conservation',
  afterHeading: 'Patterns of biodiversity',
  title: 'Species-Area Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Explore Humboldt\'s species-area relationship: change the area, the slope Z and the intercept C, destroy part of the habitat, and see how many species the smaller area can keep.',
  can: ['See why log S against log A is a straight line', 'Recover Z from your own readings of S at three areas', 'Estimate species lost from habitat loss'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'sa', title: 'Species richness against area (log-log)', x: 'A', y: 'S', logX: true, logY: true },
    { id: 'loss', title: 'Share of species lost against habitat destroyed', x: 'lost', y: 'pct' },
    { id: 'dbl', title: 'Area factor to double the species against Z', x: 'z', y: 'dbl', logY: true },
  ],
  sceneAlt: 'Left, a log-log graph of species richness against area: a straight line whose slope is Z, with a dot at the chosen area and a second dot at the smaller area left after habitat loss. Right, a square of habitat with the destroyed part shaded grey and dots for the species it holds.',
  scene: ({ v, o }) => {
    const x0 = Math.log10(1), x1 = 4;
    const ymin = Math.log10(v.C!), ymax = Math.log10(v.C! * Math.pow(10000, v.z!));
    const X = (A: number) => 40 + ((Math.log10(A) - x0) / (x1 - x0)) * 170;
    const Y = (s: number) => 190 - ((Math.log10(s) - ymin) / (ymax - ymin || 1)) * 140;
    const frac = 1 - v.lost! / 100;
    const dots = Math.round(Math.min(60, o.S!));
    const alive = Math.round(Math.min(60, o.Sleft!));
    return (
      <g>
        <rect x={40} y={50} width={170} height={140} fill="#fff" stroke="#e5e5e5" />
        <path d={pathOf([[X(1), Y(S(v, 1))], [X(10000), Y(S(v, 10000))]])} stroke="#c45e42" strokeWidth={2} fill="none" />
        <circle cx={X(v.A!)} cy={Y(o.S!)} r={4.5} fill="#18443b" />
        <circle cx={X(Math.max(1, left(v)))} cy={Y(Math.max(1e-9, o.Sleft!))} r={4} fill="#7c8595" />
        <text x={125} y={212} fontSize={10} textAnchor="middle" fill="#4d5768">log A (1 to 10 000 ha)</text>
        <text x={44} y={44} fontSize={10} fill="#4d5768">log S · slope Z = {fmt(v.z!, 2)}</text>
        <rect x={240} y={50} width={130} height={130} fill="#cfe8c5" stroke="#18443b" />
        <rect x={240} y={50} width={130 * (1 - frac)} height={130} fill="#9aa0a8" opacity={0.85} />
        {Array.from({ length: dots }, (_, i) => {
          const cx = 248 + ((i * 41) % 116);
          const cy = 58 + ((i * 29) % 116);
          const gone = i >= alive;
          return <circle key={i} cx={cx} cy={cy} r={2.4} fill={gone ? '#7a2d2d' : '#18443b'} opacity={gone ? 0.5 : 1} />;
        })}
        <text x={305} y={200} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.gone!, 0)} of {fmt(o.S!, 0)} species lost (grey)</text>
      </g>
    );
  },
  discover: [
    'Increase the area explored. Species richness rises, but how fast compared with the area?',
    'Raise Z from 0.2 to 0.9: this is the steeper slope found for whole continents.',
    'Destroy half of the habitat. Does half of the species disappear?',
  ],
  experiment: [
    'Take the area from 10 ha to 320 ha with Z = 0.2 and C chosen so that 10 ha hold 40 species: how many species at 320 ha?',
    'Compare the species lost for 50 percent habitat destruction at Z = 0.2 and at Z = 0.9.',
    'By what factor must the area grow to double the species at Z = 0.2? At Z = 0.5?',
  ],
  understand: [
    'Species richness rises with area, but only up to a limit; on log axes the relationship is a straight line, log S = log C + Z log A.',
    'Z is about 0.1 to 0.2 within a region whatever the taxonomic group; across continents it is steeper, 0.6 to 1.2.',
    'Habitat loss and fragmentation, the most important cause of biodiversity loss, shrink the area and so remove species.',
    'Because Z is small, a large change in area gives a small change in species richness (32 times the area gives only twice the species at Z = 0.2).',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: '32 times the area', prompt: 'With Z = 0.2 a forest plot of 10 ha is enlarged to 320 ha (32 times). By what factor does the number of species rise?',
      base: { z: 0.2, A: 10 }, test: { A: 320 },
      labels: ['About 32 times', 'About 6 times', 'About 2 times', 'About 10 times'], vals: [32, 6, 2, 10], f: (o) => o.S!,
      why: ({ base, test, outs: oo }) => `S = C·A^Z, so the factor is 32^0.2 = 2: ${fmt(oo(base).S!, 1)} species become ${fmt(oo(test).S!, 1)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Almost all the habitat gone', prompt: 'With Z = 0.2, 90 percent of the habitat is destroyed. About what percentage of the species is expected to be lost?',
      base: { z: 0.2, lost: 0 }, test: { lost: 90 },
      labels: ['About 90 percent', 'About 10 percent', 'About 37 percent', 'About 63 percent'], vals: [90, 10, 37, 63], f: (o) => o.pct!, mode: 'value',
      why: ({ test, outs: oo }) => `Species left = (0.1)^0.2 = 0.63, so ${fmt(oo(test).pct!, 1)} percent are lost: fewer than the share of the area, because Z is small.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'A steeper slope', prompt: 'Half the habitat is destroyed. The share of species lost is compared for a regional Z = 0.2 and a continental Z = 0.9. About how many times larger is the loss at Z = 0.9?',
      base: { z: 0.2, lost: 50 }, test: { z: 0.9 },
      labels: ['About 1 time (the same)', 'About 2 times', 'About 8 times', 'About 4 times'], vals: [1, 2, 8, 4], f: (o) => o.pct!,
      why: ({ base, test, outs: oo }) => `The loss is 1 − 0.5^Z: ${fmt(oo(base).pct!, 1)} percent at Z = 0.2 and ${fmt(oo(test).pct!, 1)} percent at Z = 0.9.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'A richer region', prompt: 'The intercept C doubles (from 10 to 20 species per hectare) for the same area, Z and habitat loss. What happens to the number of species lost?',
      base: { C: 10 }, test: { C: 20 },
      labels: ['It stays the same', 'It halves', 'It doubles', 'It becomes four times as large'], vals: [1, 0.5, 2, 4], f: (o) => o.gone!,
      why: ({ base, test, outs: oo }) => `Every species count is proportional to C, so ${fmt(oo(base).gone!, 1)} species lost becomes ${fmt(oo(test).gone!, 1)}.`,
    }),
  ],
  measure: {
    instruction: 'Keep C and Z fixed. Record the species richness S for at least three different areas A and fit log S against log A.',
    vary: 'A',
    record: ['S', 'logS'],
    fit: {
      xLabel: 'log₁₀ A',
      yLabel: 'log₁₀ S',
      x: (v) => Math.log10(v.A!),
      y: (_v, o) => o.logS!,
      interpret: (slope, intercept) => `log S = log C + Z log A is a straight line. The slope is Z = ${fmt(slope, 3)} and the intercept log C = ${fmt(intercept, 3)}, so C = ${fmt(Math.pow(10, intercept), 1)} species in one hectare.`,
    },
  },
  questions: [
    mkQ('q1', 'In a forest 10 hectares contain 40 plant species and Z = 0.2. How many species are expected in 320 hectares?', ['160', '80', '320', '120'], [160, 80, 320, 120], () => 40 * Math.pow(32, 0.2),
      'The area grows 32-fold and 32^0.2 = 2^(5×0.2) = 2, so the species double: 40 × 2 = 80.'),
    mkQ('q2', 'Tropical rain forests once covered 14 percent of the land and now cover 6 percent. By what percentage has the forest cover fallen relative to the earlier cover?', ['8 percent', '57.1 percent', '42.9 percent', '233 percent'], [8, 57.1, 42.9, 233], () => (100 * (14 - 6)) / 14,
      'The fall is 14 − 6 = 8 percentage points, which is 8/14 × 100 = 57.1 percent of the earlier cover.'),
    mkQ('q3', 'About 1.5 million species have been described and Robert May estimated 7 million in all. What percentage has been described?', ['50 percent', '10 percent', '21 percent', '75 percent'], [50, 10, 21, 75], () => (100 * 1.5) / 7,
      '1.5 ÷ 7 = 0.214, so about 21 percent of the estimated species have been described.'),
    mkQ('q4', 'Of the 784 species that went extinct in the last 500 years, 338 were vertebrates. What percentage were vertebrates?', ['43 percent', '11 percent', '46 percent', '68 percent'], [43, 11, 46, 68], () => (100 * 338) / 784,
      '338 ÷ 784 × 100 = 43.1 percent (the rest were 359 invertebrates and 87 plants).'),
    mkQ('q5', 'With Z = 0.25, by what factor must the area be multiplied to double the number of species?', ['4', '8', '32', '16'], [4, 8, 32, 16], () => Math.pow(2, 1 / 0.25),
      'S doubles when A^Z = 2, so A must grow by 2^(1/Z) = 2⁴ = 16 times.'),
  ],
};
