/**
 * Chapter lab: Chemistry, Unit VII "Alcohols, phenols and ethers", acidity of alcohols and phenols, and the Lucas test.
 * Lesson data: pKa about 16 for ethanol, about 10 for phenol; acidity order methanol > 1° > 2° > 3°; p-nitrophenol > phenol > p-cresol;
 * Lucas reagent: tertiary turbid at once, secondary in about 5 minutes, primary no turbidity at room temperature; HI > HBr > HCl.
 * The size of the substituent shift, the +0.3 per alcohol class, the 1 s time for a tertiary alcohol, the 10^5 s "no turbidity" cap and the HX
 * factors are ILLUSTRATIVE (the lesson gives only the orders). Ionisation uses A-/HA = 10^(pH - pKa). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { clamp, near, rnd } from './chem2-kit';

const pKaOf = (type: number, cls: number, sub: number) => (type === 1 ? 10 + (sub < 0 ? 0.3 : -2.8 * sub) : 16 + 0.3 * (cls - 1));
const ratio = (pKa: number, pH: number) => 10 ** (pH - pKa);
const ionPct = (pKa: number, pH: number) => 100 * (ratio(pKa, pH) / (1 + ratio(pKa, pH)));
const HX = [1, 5, 20]; // HCl, HBr, HI (order from the lesson)
const lucas = (type: number, cls: number, hx: number) => (type === 1 ? 1e5 : (cls === 3 ? 1 : cls === 2 ? 300 : 1e5) / HX[hx]!);
const NAMES = ['alcohol (R–OH)', 'phenol'];

export const spec: Spec = {
  id: 'chem-alcohols-phenols',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Alcohols, phenols and ethers',
  afterHeading: 'Chemical properties of phenols including oxidation and reduction',
  title: 'Acidity and Lucas Test Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Compare an alcohol with a phenol in alkali: choose the compound, the ring substituent and the pH, and see how much ionises. Then run the Lucas test on primary, secondary and tertiary alcohols with different hydrogen halides.',
  can: ['See why phenol dissolves in NaOH and ethanol does not', 'Plot log([A⁻]/[HA]) against pH and read pKa from the intercept', 'Link the speed of the Lucas test to the class of the alcohol'],
  minutes: 10,
  vars: [
    { id: 'type', label: 'Compound (0 = alcohol, 1 = phenol)', unit: '', min: 0, max: 1, step: 1, start: 1, digits: 0 },
    { id: 'sub', label: 'Ring substituent on the phenol (−1 = CH₃, 0 = none, 1 to 3 = NO₂ groups)', unit: '', min: -1, max: 3, step: 1, start: 0, digits: 0 },
    { id: 'cls', label: 'Class of the alcohol (1°, 2°, 3°)', unit: '', min: 1, max: 3, step: 1, start: 2, digits: 0 },
    { id: 'pH', label: 'pH of the aqueous medium', unit: '', min: 7, max: 14, step: 0.5, start: 11, digits: 1 },
    { id: 'hx', label: 'Acid in the Lucas reagent (0 = HCl, 1 = HBr, 2 = HI)', unit: '', min: 0, max: 2, step: 1, start: 0, digits: 0 },
  ],
  outs: [
    { id: 'pKa', label: 'pKa of the compound', unit: '', fn: (v) => pKaOf(v.type!, v.cls!, v.sub!), digits: 2 },
    { id: 'rel', label: 'Acid strength relative to ethanol (Ka ÷ Ka of ethanol)', unit: '×', fn: (v) => 10 ** (16 - pKaOf(v.type!, v.cls!, v.sub!)), sci: true },
    { id: 'ratio', label: 'Ratio [A⁻]/[HA] at this pH = 10^(pH − pKa)', unit: '', fn: (v) => ratio(pKaOf(v.type!, v.cls!, v.sub!), v.pH!), sci: true },
    { id: 'ion', label: 'Fraction ionised (dissolved as the anion)', unit: '%', fn: (v) => ionPct(pKaOf(v.type!, v.cls!, v.sub!), v.pH!), digits: 3 },
    { id: 'tl', label: 'Lucas test: time for turbidity (10⁵ s = none at room temperature; alcohols only)', unit: 's', fn: (v) => lucas(v.type!, v.cls!, v.hx!), digits: 0 },
  ],
  graphs: [
    { id: 'ion-pH', title: 'Fraction ionised against pH', x: 'pH', y: 'ion' },
    { id: 'pKa-sub', title: 'pKa of the phenol against ring substituent', x: 'sub', y: 'pKa' },
    { id: 'ion-sub', title: 'Fraction ionised at this pH against ring substituent', x: 'sub', y: 'ion' },
  ],
  sceneAlt: 'A pKa ruler marking ethanol at 16, phenol at 10 and the chosen compound; a flask whose neutral molecules and anions follow the fraction ionised at the chosen pH; and a Lucas test tube that turns cloudy faster for tertiary alcohols.',
  scene: ({ v, o }) => {
    const rand = rnd(11);
    const N = 30;
    const anions = Math.round((o.ion! / 100) * N);
    const pk = clamp(o.pKa!, 0, 16);
    const turbid = o.tl! < 1e4 ? clamp(1 - Math.log10(o.tl!) / 3, 0.15, 1) : 0;
    return (
      <g>
        <rect x={20} y={22} width={360} height={8} fill="#eef1f4" stroke="#e5e5e5" />
        <text x={20} y={16} fontSize={9} fill="#4d5768">pKa 0 (strong acid)</text>
        <text x={380} y={16} fontSize={9} textAnchor="end" fill="#4d5768">16 (very weak)</text>
        {[[16, 'ethanol'], [10, 'phenol']].map(([p, n]) => (
          <g key={String(n)}>
            <line x1={20 + ((p as number) / 16) * 360} y1={20} x2={20 + ((p as number) / 16) * 360} y2={32} stroke="#7c8595" />
            <text x={20 + ((p as number) / 16) * 360} y={44} fontSize={9} textAnchor="middle" fill="#7c8595">{n}</text>
          </g>
        ))}
        <circle cx={20 + (pk / 16) * 360} cy={26} r={6} fill="#c45e42" />
        <text x={20 + (pk / 16) * 360} y={58} fontSize={10} textAnchor="middle" fill="#c45e42">pKa {fmt(o.pKa!, 1)}</text>
        <path d="M 40 80 V 190 Q 40 205 55 205 H 165 Q 180 205 180 190 V 80" fill="none" stroke="#18443b" strokeWidth={2.5} />
        <rect x={42} y={95} width={136} height={108} fill="#cfe3f3" opacity={0.6} />
        {Array.from({ length: N }, (_, k) => {
          const x = 52 + rand() * 116;
          const y = 105 + rand() * 90;
          return k < anions ? <g key={k}><circle cx={x} cy={y} r={5} fill="#2563a8" /><text x={x} y={y + 3} fontSize={8} textAnchor="middle" fill="#fff">−</text></g> : <circle key={k} cx={x} cy={y} r={4.5} fill="#7c8595" />;
        })}
        <text x={110} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">pH {fmt(v.pH!, 1)} · {fmt(o.ion!, 1)} % anion (blue) · grey = neutral</text>
        <rect x={260} y={80} width={36} height={100} rx={7} fill="#fff" stroke="#18443b" strokeWidth={2} />
        <rect x={262} y={96} width={32} height={82} fill="#e8eef3" />
        <rect x={262} y={96} width={32} height={82} fill="#8a8a8a" opacity={turbid * 0.85} />
        <text x={278} y={72} fontSize={10} textAnchor="middle" fill="#18443b">Lucas</text>
        <text x={278} y={196} fontSize={9} textAnchor="middle" fill="#4d5768">{v.type === 1 ? 'phenol: no reaction' : o.tl! < 1e4 ? `turbid after ${o.tl! < 2 ? 'a moment' : `${fmt(o.tl!, 0)} s`}` : 'no turbidity'}</text>
        <text x={278} y={210} fontSize={9} textAnchor="middle" fill="#4d5768">{NAMES[v.type!]}{v.type === 0 ? ` ${v.cls}°` : ''} · {['HCl', 'HBr', 'HI'][v.hx!]}</text>
      </g>
    );
  },
  discover: [
    'Start with phenol at pH 11 and slide the pH up. At which pH is half of it ionised, and how is that related to its pKa?',
    'Switch to an alcohol at the same pH. How much ionises? Why does phenol dissolve in NaOH but ethanol does not?',
    'Add NO₂ groups to the phenol ring and watch the pKa and the fraction ionised.',
  ],
  experiment: [
    'For the Lucas test set the compound to alcohol and compare 1°, 2° and 3°. Which turns turbid first?',
    'Change HCl to HI for a secondary alcohol. What happens to the time?',
    'Set the phenol: does the Lucas test do anything? Why not?',
  ],
  understand: [
    'Ionisation follows [A⁻]/[HA] = 10^(pH − pKa): at pH = pKa the compound is half ionised, and each pH unit above changes the ratio tenfold.',
    'Phenol (pKa about 10) is a far stronger acid than ethanol (pKa about 16) because the phenoxide ion is stabilised by resonance; NO₂ groups raise the acidity further, CH₃ lowers it.',
    'Among alcohols the acidity falls from methanol to primary, secondary and tertiary because the alkyl +I effect destabilises the alkoxide.',
    'Lucas test: the reaction goes through a carbocation, so tertiary is immediate, secondary about five minutes, primary no turbidity at room temperature; phenols do not react because the C–O bond is stronger.',
  ],
  preds: [
    {
      id: 'p1', title: 'Phenol or ethanol in alkali', prompt: 'At pH 12 (a dilute NaOH solution) ethanol is replaced by phenol. How does the fraction ionised change?',
      base: { type: 0, cls: 1, pH: 12 }, test: { type: 1 }, options: ['About the same', 'It rises about ten thousand times (from a tiny trace to almost complete)', 'It falls', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).ion! / outs(base).ion!, [1, 1e4, 0.5, 2]),
      why: ({ base, test, outs }) => `Ethanol (pKa 16) has [A⁻]/[HA] = 10^(12−16) = 10⁻⁴, phenol (pKa 10) has 10^(12−10) = 100. The ionised fraction goes from ${fmt(outs(base).ion!, 4)} % to ${fmt(outs(test).ion!, 1)} %.`,
    },
    {
      id: 'p2', title: 'Add nitro groups', prompt: 'Two NO₂ groups (electron-withdrawing) are placed on the ring of phenol. In this lab each lowers the pKa by 2.8 (illustrative). What is the new pKa?',
      base: { type: 1, sub: 0 }, test: { sub: 2 }, options: ['About 15.6', 'About 4.4', 'It stays 10', 'About −3'], answer: 1,
      verify: ({ test, outs }) => near(outs(test).pKa!, [15.6, 4.4, 10, -3]),
      why: ({ base, test, outs }) => `Electron-withdrawing groups stabilise the phenoxide ion and so make the phenol a stronger acid. pKa goes from ${fmt(outs(base).pKa!, 1)} to ${fmt(outs(test).pKa!, 1)}.`,
    },
    {
      id: 'p3', title: 'Lucas test, primary to tertiary', prompt: 'Butan-1-ol (primary) is replaced by 2-methylpropan-2-ol (tertiary) in the Lucas test with HCl and ZnCl₂ at room temperature. What do you see?',
      base: { type: 0, cls: 1, hx: 0 }, test: { cls: 3 }, options: ['Turbidity only after several hours', 'Turbidity after about five minutes', 'Turbidity at once', 'No change however long you wait'], answer: 2,
      verify: ({ test, outs }) => (outs(test).tl! < 5 ? 2 : outs(test).tl! < 1000 ? 1 : 0),
      why: ({ base, test, outs }) => `The tertiary alcohol forms the most stable carbocation, so it reacts at once (${fmt(outs(test).tl!, 0)} s in this lab), whereas the primary one shows no turbidity at room temperature (${fmt(outs(base).tl!, 0)} s means none).`,
    },
    {
      id: 'p4', title: 'Stronger acid in the Lucas reagent', prompt: 'A secondary alcohol is tested with HI instead of HCl (HI > HBr > HCl in reactivity). What happens to the time before turbidity appears?',
      base: { type: 0, cls: 2, hx: 0 }, test: { hx: 2 }, options: ['It gets longer', 'It gets shorter', 'It does not change', 'Turbidity never appears'], answer: 1,
      verify: ({ base, test, outs }) => (outs(test).tl! < outs(base).tl! * 0.9 ? 1 : outs(test).tl! > outs(base).tl! * 1.1 ? 0 : 2),
      why: ({ base, test, outs }) => `A more reactive hydrogen halide converts the alcohol faster: the time goes from ${fmt(outs(base).tl!, 0)} s to ${fmt(outs(test).tl!, 0)} s (HX factors are illustrative; only the order HI > HBr > HCl is from the lesson).`,
    },
  ],
  measure: {
    instruction: 'Choose the compound and ring substituent, then record the ratio [A⁻]/[HA] at three or more different pH values. Plot log₁₀([A⁻]/[HA]) against pH.',
    vary: 'pH',
    record: ['ratio', 'ion', 'pKa'],
    fit: {
      xLabel: 'pH',
      yLabel: 'log₁₀([A⁻]/[HA])',
      x: (v) => v.pH!,
      y: (_v, o) => Math.log10(o.ratio!),
      interpret: (slope, intercept, v) =>
        `log([A⁻]/[HA]) = pH − pKa is a straight line of slope ${fmt(slope, 2)} (it should be 1). The intercept is −pKa = ${fmt(intercept, 2)}, so pKa = ${fmt(-intercept, 2)}; the half-ionised point is where the line crosses zero, at pH ${fmt(-intercept / slope, 1)}. (Set value: ${fmt(pKaOf(v.type!, v.cls!, v.sub!), 1)}.)`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Ethanol has pKa about 16. In an aqueous solution of pH 13 the ratio [CH₃CH₂O⁻]/[CH₃CH₂OH] is', options: ['10⁻³', '10⁻⁶', '10³', '1'], answer: 0,
      why: 'ratio = 10^(pH − pKa) = 10^(13 − 16) = 10⁻³: ethanol is almost entirely un-ionised, so it does not dissolve as a salt in dilute alkali.',
      verify: () => near(ratio(16, 13), [1e-3, 1e-6, 1e3, 1]),
    },
    {
      id: 'q2', q: 'Phenol (pKa about 10) is in a solution of pH 11. The percentage present as phenoxide ion is about', options: ['9 %', '50 %', '91 %', '99 %'], answer: 2,
      why: 'ratio = 10^(11 − 10) = 10, so the fraction ionised = 10/(10 + 1) = 0.91, about 91 %.',
      verify: () => near(ionPct(10, 11), [9, 50, 91, 99]),
    },
    {
      id: 'q3', q: 'Which of ethanol, phenol, p-cresol and p-nitrophenol is the strongest acid?', options: ['Ethanol', 'p-Cresol', 'Phenol', 'p-Nitrophenol'], answer: 3,
      why: 'The electron-withdrawing NO₂ group stabilises the phenoxide ion, giving the order p-nitrophenol > phenol > p-cresol > ethanol.',
      verify: () => { const p = [pKaOf(0, 1, 0), pKaOf(1, 1, -1), pKaOf(1, 1, 0), pKaOf(1, 1, 1)]; return p.indexOf(Math.min(...p)); },
    },
    {
      id: 'q4', q: 'An alcohol gives turbidity with the Lucas reagent (anhydrous ZnCl₂ + conc. HCl) after about five minutes at room temperature. It is', options: ['primary', 'secondary', 'tertiary', 'phenol'], answer: 1,
      why: 'Tertiary alcohols turn turbid immediately, secondary after about five minutes and primary show no turbidity at room temperature. Phenols do not react.',
      verify: () => { const t = [lucas(0, 1, 0), lucas(0, 2, 0), lucas(0, 3, 0), lucas(1, 1, 0)]; return near(300, t); },
    },
    {
      id: 'q5', q: 'The pKa values of phenol and ethanol are about 10 and 16. Phenol is a stronger acid than ethanol by a factor of about', options: ['6', '10⁶', '60', '1.6'], answer: 1,
      why: 'Ka = 10^(−pKa), so Ka(phenol)/Ka(ethanol) = 10^(16 − 10) = 10⁶.',
      verify: () => near(10 ** (16 - 10), [6, 1e6, 60, 1.6]),
    },
  ],
};
