/**
 * Chapter lab: Biology, "Biotechnology applications", plant tissue culture and micropropagation.
 * Model (illustrative curves, standard teaching rule that a high auxin : cytokinin ratio favours roots and a low ratio shoots,
 * the lesson only says the callus is induced to form shoots and roots "by changing the ratio of the hormones"):
 * each subculture, a culture that forms shoots multiplies by m, so the mean multiplication is 1 + p_shoot (m - 1).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { OutDef, Spec, Values, VarDef } from '../engine/types';
import { mkPred, mkQ } from './_bio-util';

const vars: VarDef[] = [
  { id: 'aux', label: 'Auxin in the medium', unit: 'mg/L', min: 0.1, max: 5, step: 0.1, start: 1, digits: 1 },
  { id: 'cyt', label: 'Cytokinin in the medium', unit: 'mg/L', min: 0.1, max: 5, step: 0.1, start: 1, digits: 1 },
  { id: 'm', label: 'Shoots a responding culture gives per subculture', unit: 'shoots', min: 2, max: 8, step: 1, start: 4, digits: 0 },
  { id: 'n', label: 'Subculture cycles', unit: 'cycles', min: 0, max: 8, step: 1, start: 4, digits: 0 },
  { id: 'ex', label: 'Starting explants', unit: 'explants', min: 1, max: 20, step: 1, start: 5, digits: 0 },
];
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const lr = (v: Values) => Math.log10(v.aux! / v.cyt!);
const pShoot = (v: Values) => sig(-4 * (lr(v) + 0.5));
const pRoot = (v: Values) => sig(4 * (lr(v) - 0.5));
const mu = (v: Values) => 1 + pShoot(v) * (v.m! - 1);
const outs: OutDef[] = [
  { id: 'ratio', label: 'Auxin : cytokinin ratio', unit: '', fn: (v) => v.aux! / v.cyt!, digits: 2 },
  { id: 'shoot', label: 'Cultures forming shoots', unit: '%', fn: (v) => 100 * pShoot(v), digits: 0 },
  { id: 'root', label: 'Cultures forming roots', unit: '%', fn: (v) => 100 * pRoot(v), digits: 0 },
  { id: 'callus', label: 'Cultures staying as an unorganised callus', unit: '%', fn: (v) => 100 * Math.max(0, 1 - pShoot(v) - pRoot(v)), digits: 0 },
  { id: 'mu', label: 'Mean multiplication per cycle', unit: '×', fn: mu, digits: 2 },
  { id: 'plants', label: 'Plantlets after the cycles (clones)', unit: 'plantlets', fn: (v) => v.ex! * Math.pow(mu(v), v.n!), digits: 0 },
];

export const spec: Spec = {
  id: 'bio-biotech-applications',
  subject: 'Biology',
  lessonTitleStartsWith: 'Biotechnology applications',
  afterHeading: 'Tissue culture in agriculture',
  title: 'Tissue Culture Bench',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Set the auxin and cytokinin in the culture medium and see whether the explant makes roots, shoots or an unorganised callus, then multiply the plantlets by repeated subculture and count the clones.',
  can: ['See that the hormone ratio, not the amount alone, steers the explant', 'Compute how many identical plantlets micropropagation makes', 'Fit the multiplication per cycle from ln(plantlets) against cycles'],
  minutes: 10,
  vars,
  outs,
  graphs: [
    { id: 'sh', title: 'Shoot-forming cultures against auxin', x: 'aux', y: 'shoot' },
    { id: 'rt', title: 'Root-forming cultures against auxin', x: 'aux', y: 'root' },
    { id: 'pl', title: 'Plantlets against subculture cycles', x: 'n', y: 'plants', logY: true },
  ],
  sceneAlt: 'A culture dish on a sterile medium. A lump of callus sits in the middle; green shoots grow upward and brown roots grow downward, their number following the shoot and root percentages. Two bars show the auxin and cytokinin levels, and the plantlet count is printed below.',
  scene: ({ v, o }) => {
    const shoots = Math.round((o.shoot! / 100) * 10);
    const roots = Math.round((o.root! / 100) * 10);
    const callusR = 12 + (o.callus! / 100) * 26;
    return (
      <g>
        <ellipse cx={200} cy={155} rx={110} ry={34} fill="#d9ecd2" stroke="#18443b" strokeWidth={2} />
        <ellipse cx={200} cy={118} rx={110} ry={34} fill="#eaf4e6" stroke="#18443b" strokeWidth={2} opacity={0.5} />
        <circle cx={200} cy={125} r={callusR} fill="#d8c27a" stroke="#8a6a3a" />
        {Array.from({ length: shoots }, (_, i) => (
          <g key={i}>
            <path d={`M${180 + i * 4.5} 118 Q ${176 + i * 5} ${85 - (i % 3) * 8} ${172 + i * 6} ${62 - (i % 3) * 6}`} stroke="#3f8c3a" strokeWidth={2} fill="none" />
            <ellipse cx={172 + i * 6} cy={62 - (i % 3) * 6} rx={4} ry={2.5} fill="#3f8c3a" />
          </g>
        ))}
        {Array.from({ length: roots }, (_, i) => (
          <path key={i} d={`M${182 + i * 4} 135 Q ${178 + i * 5} 160 ${170 + i * 6} ${178 + (i % 3) * 6}`} stroke="#8a5a2a" strokeWidth={1.6} fill="none" />
        ))}
        <rect x={30} y={60} width={16} height={(v.aux! / 5) * 100} fill="#c45e42" />
        <rect x={54} y={60} width={16} height={(v.cyt! / 5) * 100} fill="#2563a8" />
        <text x={38} y={176} fontSize={9} textAnchor="middle" fill="#c45e42">auxin</text>
        <text x={62} y={188} fontSize={9} textAnchor="middle" fill="#2563a8">cytokinin</text>
        <text x={320} y={50} fontSize={10} textAnchor="middle" fill="#4d5768">ratio {fmt(o.ratio!, 2)}</text>
        <text x={200} y={214} fontSize={11} textAnchor="middle" fill="#18443b">{fmt(o.plants!, 0)} identical plantlets after {v.n} cycles</text>
      </g>
    );
  },
  discover: [
    'Raise the auxin with the cytokinin fixed and watch the dish change from shoots to callus to roots.',
    'Keep the ratio the same but double both amounts. Does the outcome change?',
    'Set the subculture cycles higher and read the number of plantlets.',
  ],
  experiment: [
    'Find an auxin and cytokinin pair that makes mostly shoots, and a pair that makes mostly roots.',
    'With mostly shoots, how many plantlets do 5 explants give after 6 cycles for m = 2, 4 and 8?',
    'What happens to the multiplication when the medium makes only callus or roots?',
  ],
  understand: [
    'Totipotency lets a single plant cell give a whole plant when grown on a medium with sucrose, salts, vitamins and the growth regulators auxin and cytokinin.',
    'Changing the ratio of the two hormones induces the callus to form shoots or roots.',
    'Micropropagation yields thousands of genetically identical plants (somaclones) from one parent; each subculture multiplies them.',
    'Meristem culture gives virus-free plants because the growing tip is usually free of the virus.',
  ],
  preds: [
    mkPred(vars, outs, {
      id: 'p1', title: 'Auxin-rich medium', prompt: 'The medium has equal auxin and cytokinin (1 and 1 mg/L). The auxin is raised to 5 mg/L. About what percentage of the cultures now form roots (model)?',
      base: { aux: 1, cyt: 1 }, test: { aux: 5 },
      labels: ['About 10 percent', 'About 30 percent', 'About 95 percent', 'About 70 percent'], vals: [10, 30, 95, 70], f: (o) => o.root!, mode: 'value',
      why: ({ test, outs: oo }) => `A high auxin : cytokinin ratio (5) favours roots in this model: ${fmt(oo(test).root!, 0)} percent of cultures form roots.`,
    }),
    mkPred(vars, outs, {
      id: 'p2', title: 'Cytokinin-rich medium', prompt: 'The auxin is 0.2 mg/L and the cytokinin 2 mg/L (ratio 0.1). About what percentage of the cultures form shoots (model)?',
      base: { aux: 1, cyt: 1 }, test: { aux: 0.2, cyt: 2 },
      labels: ['About 12 percent', 'About 50 percent', 'About 99 percent', 'About 88 percent'], vals: [12, 50, 99, 88], f: (o) => o.shoot!, mode: 'value',
      why: ({ test, outs: oo }) => `A low auxin : cytokinin ratio (${fmt(oo(test).ratio!, 2)}) favours shoots in this model: ${fmt(oo(test).shoot!, 0)} percent of cultures form shoots.`,
    }),
    mkPred(vars, outs, {
      id: 'p3', title: 'More shoots per culture', prompt: 'On a shoot-favouring medium (auxin 0.2, cytokinin 2) the shoots per responding culture rise from 2 to 4 (4 cycles). By about what factor does the number of plantlets rise?',
      base: { aux: 0.2, cyt: 2, m: 2, n: 4 }, test: { m: 4 },
      labels: ['About 2 times', 'About 4 times', 'About 60 times', 'About 14 times'], vals: [2, 4, 60, 14], f: (o) => o.plants!,
      why: ({ base, test, outs: oo }) => `The multiplication per cycle rises from ${fmt(oo(base).mu!, 2)} to ${fmt(oo(test).mu!, 2)} and it compounds over 4 cycles: ${fmt(oo(base).plants!, 0)} plantlets become ${fmt(oo(test).plants!, 0)}.`,
    }),
    mkPred(vars, outs, {
      id: 'p4', title: 'Four more cycles', prompt: 'On a shoot-favouring medium with m = 2, the culture is subcultured for 6 cycles instead of 2. By about what factor do the plantlets increase?',
      base: { aux: 0.2, cyt: 2, m: 2, n: 2 }, test: { n: 6 },
      labels: ['About 4 times', 'About 100 times', 'About 12 times', 'About 2 times'], vals: [4, 100, 12, 2], f: (o) => o.plants!,
      why: ({ base, test, outs: oo }) => `Each cycle multiplies the number by ${fmt(oo(base).mu!, 2)}, so four more cycles multiply it by ${fmt(Math.pow(oo(base).mu!, 4), 1)}: ${fmt(oo(base).plants!, 0)} becomes ${fmt(oo(test).plants!, 0)}.`,
    }),
  ],
  measure: {
    instruction: 'Choose a medium (auxin and cytokinin) and keep it fixed. Record the plantlets for at least three different numbers of subculture cycles.',
    vary: 'n',
    record: ['plants', 'mu'],
    fit: {
      xLabel: 'subculture cycles n',
      yLabel: 'ln(plantlets)',
      x: (v) => v.n!,
      y: (_v, o) => Math.log(o.plants!),
      interpret: (slope, intercept) => `ln(plantlets) is a straight line in the number of cycles. The slope ln μ = ${fmt(slope, 3)} gives a multiplication of μ = ${fmt(Math.exp(slope), 2)} per cycle, and the intercept gives ${fmt(Math.exp(intercept), 1)} starting explants.`,
    },
  },
  questions: [
    mkQ('q1', 'Five explants are multiplied by 3 at every subculture. How many plantlets are there after 3 subcultures?', ['45', '135', '15', '405'], [45, 135, 15, 405], () => 5 * Math.pow(3, 3),
      'The number triples each cycle: 5 × 3³ = 135 clones, all genetically identical to the parent.'),
    mkQ('q2', 'One shoot gives 5 new shoots in each subculture. How many shoots are there after 4 subcultures?', ['625', '20', '125', '3125'], [625, 20, 125, 3125], () => Math.pow(5, 4),
      'Each cycle multiplies by 5: 5⁴ = 625 shoots, all somaclones of the same parent.'),
    mkQ('q3', 'A medium has 0.5 mg/L auxin and 2.5 mg/L cytokinin. What is the auxin : cytokinin ratio?', ['5', '0.5', '2', '0.2'], [5, 0.5, 2, 0.2], () => 0.5 / 2.5,
      'Ratio = 0.5 ÷ 2.5 = 0.2, a cytokinin-rich medium that favours shoots in the usual teaching model.'),
    mkQ('q4', 'Mature human insulin is made from separately produced chains A (21 amino acids) and B (30 amino acids). How many amino acids does it have?', ['21', '30', '51', '81'], [21, 30, 51, 81], () => 21 + 30,
      'The mature molecule is the A chain plus the B chain joined by disulphide bridges, with no C peptide: 21 + 30 = 51 amino acids.'),
    mkQ('q5', 'The transgenic cow Rosie made 2.4 g of human alpha-lactalbumin per litre of milk. How much protein is in 5 litres?', ['12 g', '2.4 g', '0.48 g', '7.4 g'], [12, 2.4, 0.48, 7.4], () => 2.4 * 5,
      'Amount = concentration × volume = 2.4 g/L × 5 L = 12 g.'),
  ],
};
