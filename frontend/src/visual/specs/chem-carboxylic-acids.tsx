/**
 * Chapter lab: Chemistry, Unit VIII "Aldehydes, ketones and carboxylic acids", section Chemical properties of carboxylic acids (acidity).
 * Data: the pKa values quoted in the lesson (methanoic 3.75, benzoic 4.19, ethanoic 4.76, fluoroethanoic 2.66, chloroethanoic 2.86,
 * phenol about 10, ethanol about 16) and Ka = 10^-pKa. Model: exact charge balance [H+] + [Na+] = [A-] + [OH-] with [A-] = c Ka/(Ka + [H+]),
 * [Na+] = c f after a fraction f of the acid has been neutralised by NaOH, Kw = 1e-14. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { clamp, near } from './chem2-kit';

interface Acid { name: string; pKa: number }
const AC: Acid[] = [
  { name: 'HCOOH methanoic', pKa: 3.75 },
  { name: 'C₆H₅COOH benzoic', pKa: 4.19 },
  { name: 'CH₃COOH ethanoic', pKa: 4.76 },
  { name: 'FCH₂COOH', pKa: 2.66 },
  { name: 'ClCH₂COOH', pKa: 2.86 },
  { name: 'phenol', pKa: 10 },
  { name: 'ethanol', pKa: 16 },
];
const KW = 1e-14;
const hOf = (pKa: number, c: number, f: number) => {
  const Ka = 10 ** -pKa;
  const g = (lh: number) => { const h = 10 ** lh; return h + c * f - (c * Ka) / (Ka + h) - KW / h; };
  let lo = -14;
  let hi = 1;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (g(mid) > 0) hi = mid; else lo = mid; }
  return 10 ** ((lo + hi) / 2);
};
const pHOf = (pKa: number, c: number, f: number) => -Math.log10(hOf(pKa, c, f));
const ionOf = (pKa: number, c: number, f: number) => { const Ka = 10 ** -pKa; const h = hOf(pKa, c, f); return (100 * Ka) / (Ka + h); };

export const spec: Spec = {
  id: 'chem-carboxylic-acids',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Aldehydes, ketones and carboxylic acids',
  afterHeading: 'Chemical properties of carboxylic acids',
  title: 'Acid Strength and Titration Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose a carboxylic acid (or phenol or ethanol for comparison) from the lesson, set its concentration and how much NaOH has neutralised it, and watch the pH, the ionisation and the titration curve respond. At half neutralisation read off the pKa.',
  can: ['See how −I substituents (F, Cl) and +I groups change the pKa and the pH', 'Compare carboxylic acids with phenol and ethanol on one scale', 'Plot pH against log([A⁻]/[HA]) and read the pKa from the intercept'],
  minutes: 10,
  vars: [
    { id: 'a', label: 'Acid (0 HCOOH, 1 C₆H₅COOH, 2 CH₃COOH, 3 FCH₂COOH, 4 ClCH₂COOH, 5 phenol, 6 ethanol)', unit: '', min: 0, max: 6, step: 1, start: 2, digits: 0, choice: true },
    { id: 'c', label: 'Total concentration c', unit: 'mol/L', min: 0.001, max: 1, step: 0.001, start: 0.1, log: true, digits: 3 },
    { id: 'f', label: 'Fraction of the acid neutralised by NaOH', unit: '', min: 0.05, max: 0.95, step: 0.05, start: 0.05, digits: 2, bounds: { min: 0.001, max: 0.99 } },
  ],
  outs: [
    { id: 'pKa', label: 'pKa (lesson value)', unit: '', fn: (v) => AC[v.a!]!.pKa, digits: 2 },
    { id: 'Ka', label: 'Ka = 10^(−pKa)', unit: '', fn: (v) => 10 ** -AC[v.a!]!.pKa, sci: true },
    { id: 'rel', label: 'Strength relative to ethanoic acid (Ka ÷ 1.74 × 10⁻⁵)', unit: '×', fn: (v) => 10 ** (4.76 - AC[v.a!]!.pKa), sci: true },
    { id: 'pH', label: 'pH of the mixture', unit: '', fn: (v) => pHOf(AC[v.a!]!.pKa, v.c!, v.f!), digits: 2 },
    { id: 'ion', label: 'Present as anion A⁻ (of the total acid)', unit: '%', fn: (v) => ionOf(AC[v.a!]!.pKa, v.c!, v.f!), digits: 2 },
  ],
  graphs: [
    { id: 'pH-f', title: 'pH against fraction neutralised (titration curve)', x: 'f', y: 'pH' },
    { id: 'pH-c', title: 'pH against concentration', x: 'c', y: 'pH', logX: true },
    { id: 'pH-a', title: 'pH along the list of acids', x: 'a', y: 'pH' },
  ],
  sceneAlt: 'A titration curve of pH against fraction neutralised for the chosen acid, with a marker at the current fraction and a dotted line at its pKa, and a column of dots whose blue anion share follows the percentage ionised.',
  scene: ({ v, o }) => {
    const pk = AC[v.a!]!.pKa;
    const X = (f: number) => 40 + ((f - 0.05) / 0.9) * 200;
    const Y = (ph: number) => 190 - (clamp(ph, 0, 14) / 14) * 160;
    const pts = Array.from({ length: 19 }, (_, i) => { const f = 0.05 + i * 0.05; return `${X(f).toFixed(1)},${Y(pHOf(pk, v.c!, f)).toFixed(1)}`; }).join(' ');
    const N = 40;
    const an = Math.round((o.ion! / 100) * N);
    return (
      <g>
        <rect x={40} y={30} width={200} height={160} fill="#fff" stroke="#e5e5e5" />
        <line x1={40} y1={Y(pk)} x2={240} y2={Y(pk)} stroke="#7c8595" strokeDasharray="3 3" />
        <text x={242} y={Y(pk) + 3} fontSize={9} fill="#7c8595">pKa {pk}</text>
        <polyline points={pts} fill="none" stroke="#c45e42" strokeWidth={2.2} />
        <circle cx={X(v.f!)} cy={Y(o.pH!)} r={5} fill="#18443b" stroke="#fff" strokeWidth={1.5} />
        <text x={40} y={204} fontSize={9} fill="#4d5768">0.05</text>
        <text x={240} y={204} fontSize={9} textAnchor="end" fill="#4d5768">0.95</text>
        <text x={140} y={216} fontSize={10} textAnchor="middle" fill="#4d5768">fraction neutralised by NaOH</text>
        <text x={34} y={36} fontSize={9} textAnchor="end" fill="#4d5768">14</text>
        <text x={34} y={190} fontSize={9} textAnchor="end" fill="#4d5768">0</text>
        <text x={140} y={20} fontSize={11} textAnchor="middle" fill="#18443b">{AC[v.a!]!.name} · pH {fmt(o.pH!, 2)}</text>
        {Array.from({ length: N }, (_, k) => {
          const x = 290 + (k % 8) * 12;
          const y = 50 + Math.floor(k / 8) * 14;
          return <circle key={k} cx={x} cy={y} r={4.5} fill={k < an ? '#2563a8' : '#7c8595'} />;
        })}
        <text x={335} y={134} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.ion!, 1)} % anion A⁻ (blue)</text>
        <text x={335} y={148} fontSize={10} textAnchor="middle" fill="#4d5768">grey = HA</text>
      </g>
    );
  },
  discover: [
    'Step through the seven acids at the same concentration. Which gives the lowest pH, and how does the order compare with the pKa values?',
    'Slide the neutralised fraction to 0.50. How does the pH compare with the pKa of the acid?',
    'Compare FCH₂COOH, ClCH₂COOH and CH₃COOH: what do the −I and +I effects do to the pKa?',
  ],
  experiment: [
    'Set ethanoic acid and add NaOH from 5 to 95 percent. Where is the steepest change in pH, and where is pH = pKa?',
    'Dilute methanoic acid from 1 to 0.001 mol/L. How does the pH and the percentage ionised change?',
    'Select phenol and then ethanol: compare their pH with that of the carboxylic acids at the same fraction neutralised.',
  ],
  understand: [
    'Carboxylic acids are weak acids (Ka = 10^(−pKa)) but far stronger than phenol (about 10) and ethanol (about 16).',
    'Electron-withdrawing groups (F, Cl) stabilise the carboxylate and lower the pKa (FCH₂COOH 2.66, ClCH₂COOH 2.86 against CH₃COOH 4.76); alkyl groups do the opposite.',
    'When half of an acid has been neutralised, [A⁻] = [HA] and the pH equals the pKa.',
    'A weak acid ionises more when diluted: its percentage ionisation rises as the concentration falls.',
  ],
  preds: [
    {
      id: 'p1', title: 'Chlorine on the α-carbon', prompt: 'A 0.10 mol/L solution of ethanoic acid (pH 2.9, with 5 percent of it neutralised) is replaced by chloroethanoic acid at the same concentration and neutralisation. What happens to the pH?',
      base: { a: 2, c: 0.1, f: 0.05 }, test: { a: 4 }, options: ['It rises', 'It falls by about 1 unit or more', 'It does not change', 'It becomes 7'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).pH! < outs(base).pH! - 0.5 ? 1 : outs(test).pH! > outs(base).pH! + 0.5 ? 0 : 2),
      why: ({ base, test, outs }) => `Chlorine withdraws electrons (−I effect), stabilising the carboxylate, so Ka is larger (pKa 2.86 against 4.76). The pH goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}.`,
    },
    {
      id: 'p2', title: 'Methanoic against ethanoic', prompt: 'How many times larger is the acid dissociation constant of methanoic acid (pKa 3.75) than that of ethanoic acid (pKa 4.76)?',
      base: { a: 2 }, test: { a: 0 }, options: ['About 1.3 times', 'About 10 times', 'About 100 times', 'It is smaller'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).rel!, [1.3, 10, 100, 0.1]),
      why: ({ base, test, outs }) => `Ka = 10^(−pKa), so the ratio is 10^(4.76 − 3.75) = 10^1.01. The model gives ${fmt(outs(base).rel!, 1)} for ethanoic acid and ${fmt(outs(test).rel!, 1)} for methanoic acid. Methanoic acid has no electron-releasing alkyl group.`,
    },
    {
      id: 'p3', title: 'Half neutralised', prompt: 'Ethanoic acid (0.10 mol/L) is half neutralised by NaOH (fraction from 0.05 to 0.50). What is the pH at 0.50?',
      base: { a: 2, c: 0.1, f: 0.05 }, test: { f: 0.5 }, options: ['Exactly 7', 'About 4.8, equal to the pKa', 'About 2.9, unchanged', 'About 9.2'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).pH!, [7, 4.76, 2.9, 9.2]),
      why: ({ base, test, outs }) => `At half neutralisation [A⁻] = [HA], so pH = pKa + log 1 = pKa. The pH goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}.`,
    },
    {
      id: 'p4', title: 'Phenol in place of ethanoic acid', prompt: 'At half neutralisation by NaOH (0.50), ethanoic acid is replaced by phenol (pKa about 10) at the same concentration. How does the pH change?',
      base: { a: 2, c: 0.1, f: 0.5 }, test: { a: 5 }, options: ['It rises by about 5.2 units', 'It rises by 1 unit', 'It falls by about 5.2 units', 'It does not change'], answer: 0,
      verify: ({ base, test, outs }) => { const d = outs(test).pH! - outs(base).pH!; return d > 4.5 ? 0 : d > 0.5 ? 1 : d < -4.5 ? 2 : 3; },
      why: ({ base, test, outs }) => `At the half-neutralisation point pH = pKa, so the pH changes by the difference in pKa, 10 − 4.76 = 5.24. It goes from ${fmt(outs(base).pH!, 2)} to ${fmt(outs(test).pH!, 2)}. Phenol is a much weaker acid.`,
    },
  ],
  measure: {
    instruction: 'Keep the acid and concentration fixed (try 0.10 mol/L). Record the pH for at least three fractions neutralised. Plot pH against log₁₀(f/(1−f)).',
    vary: 'f',
    record: ['pH', 'ion', 'pKa'],
    fit: {
      xLabel: 'log₁₀( f / (1 − f) )',
      yLabel: 'pH',
      x: (v) => Math.log10(v.f! / (1 - v.f!)),
      y: (_v, o) => o.pH!,
      interpret: (slope, intercept, v) =>
        `pH = pKa + log([A⁻]/[HA]), and [A⁻]/[HA] = f/(1 − f), so pH against log(f/(1−f)) is a straight line of slope close to 1 (yours is ${fmt(slope, 2)}). The intercept is the pH at f = 0.5, which is the pKa: ${fmt(intercept, 2)} (lesson value ${AC[v.a!]!.pKa}). The small differences come from the H⁺ already present in the solution.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Fluoroethanoic acid has pKa 2.66 and ethanoic acid 4.76. Fluoroethanoic acid is the stronger acid, by a factor of about', options: ['2', '126', '13', '1.8'], answer: 1,
      why: 'Ka(F)/Ka(ethanoic) = 10^(4.76 − 2.66) = 10^2.10 ≈ 126. The −I effect of fluorine stabilises the carboxylate ion.',
      verify: () => near(10 ** (4.76 - 2.66), [2, 126, 13, 1.8]),
    },
    {
      id: 'q2', q: 'The pH of a 0.010 mol/L solution of methanoic acid (pKa 3.75) is closest to', options: ['2.0', '3.47', '2.90', '5.75'], answer: 2,
      why: 'Ka = 1.78 × 10⁻⁴. Solving x²/(0.010 − x) = Ka gives [H⁺] = 1.25 × 10⁻³ mol/L, so pH = 2.90. (The shortcut pH = ½(pKa + pc) = ½(3.75 + 2) = 2.88 is close; a pH above the pKa of 3.75 would need the acid to be more than half neutralised.)',
      verify: () => near(pHOf(3.75, 0.01, 0), [2.0, 3.47, 2.9, 5.75]),
    },
    {
      id: 'q3', q: 'Which is the strongest acid among phenol, ethanol, ethanoic acid and benzoic acid?', options: ['Benzoic acid', 'Ethanoic acid', 'Phenol', 'Ethanol'], answer: 0,
      why: 'pKa: benzoic 4.19 < ethanoic 4.76 < phenol about 10 < ethanol about 16. The smallest pKa is the strongest acid.',
      verify: () => { const p = [AC[1]!.pKa, AC[2]!.pKa, AC[5]!.pKa, AC[6]!.pKa]; return p.indexOf(Math.min(...p)); },
    },
    {
      id: 'q4', q: 'Ethanoic acid (pKa 4.76) is exactly half neutralised by NaOH. The pH is about', options: ['2.88', '7.00', '4.76', '9.24'], answer: 2,
      why: 'At half neutralisation [CH₃COO⁻] = [CH₃COOH], so pH = pKa + log 1 = 4.76.',
      verify: () => near(pHOf(4.76, 0.1, 0.5), [2.88, 7, 4.76, 9.24]),
    },
    {
      id: 'q5', q: 'Benzoic acid (pKa 4.19) compared with ethanoic acid (pKa 4.76) is stronger by a factor of about', options: ['0.27', '3.7', '37', '1.0'], answer: 1,
      why: 'Ka(benzoic)/Ka(ethanoic) = 10^(4.76 − 4.19) = 10^0.57 ≈ 3.7. The sp² carbon of the phenyl group is electron-withdrawing compared with an alkyl carbon.',
      verify: () => near(10 ** (4.76 - 4.19), [0.27, 3.7, 37, 1.0]),
    },
  ],
};
