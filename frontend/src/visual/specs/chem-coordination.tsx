/**
 * Chapter lab: Chemistry, Unit V "Coordination compounds", section Crystal field theory / colour and magnetism.
 * Model (octahedral): t2g at -0.4 Do, eg at +0.6 Do; high spin if Do < P, low spin if Do > P for d4 to d7;
 * mu = sqrt(n(n+2)) BM; CFSE = -0.4 n(t2g) + 0.6 n(eg) in units of Do; absorbed wavelength lambda = 1e7 / Do (Do in cm^-1).
 * ONLY the ORDER of the spectrochemical series and the idea "higher oxidation state / 4d, 5d metal gives larger Do" are from the lesson;
 * the numerical Do = g (8000 + 900 x position) cm^-1 and P are illustrative round numbers. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { near } from './chem2-kit';

const LIGANDS = ['I⁻', 'Br⁻', 'SCN⁻', 'Cl⁻', 'S²⁻', 'F⁻', 'OH⁻', 'C₂O₄²⁻', 'H₂O', 'NCS⁻', 'edta⁴⁻', 'NH₃', 'en', 'CN⁻', 'CO'];
const deltaOf = (L: number, g: number) => g * (8000 + 900 * L);

interface Fill { t: number; e: number; unp: number; kind: 'high' | 'low' | 'one' }
function fill(nd: number, delta: number, P: number): Fill {
  if (nd <= 3) return { t: nd, e: 0, unp: nd, kind: 'one' };
  if (nd >= 8) return { t: 6, e: nd - 6, unp: nd === 8 ? 2 : nd === 9 ? 1 : 0, kind: 'one' };
  if (delta < P) {
    // high spin: three in t2g, two singly in eg, then pair in t2g
    const e = Math.min(nd - 3, 2);
    const t = nd - e;
    return { t, e, unp: nd <= 5 ? nd : 10 - nd, kind: 'high' };
  }
  // low spin: pair up in t2g before using eg
  const t = Math.min(nd, 6);
  const e = nd - t;
  const unp = nd === 4 ? 2 : nd === 5 ? 1 : nd === 6 ? 0 : 1;
  return { t, e, unp, kind: 'low' };
}
const moment = (n: number) => Math.sqrt(n * (n + 2));
const lamOf = (delta: number) => 1e7 / delta;
const cfseOf = (f: Fill) => -0.4 * f.t + 0.6 * f.e;

/** Complementary-colour hue (degrees) for light of wavelength lam (nm) being absorbed. */
const hueAbsorbed = (lam: number) => {
  const pts: [number, number][] = [[400, 270], [450, 240], [490, 180], [530, 120], [580, 60], [700, 0]];
  const l = Math.min(700, Math.max(400, lam));
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, ha] = pts[i]!;
    const [b, hb] = pts[i + 1]!;
    if (l <= b) return ha + ((l - a) / (b - a)) * (hb - ha);
  }
  return 0;
};

export const spec: Spec = {
  id: 'chem-coordination',
  subject: 'Chemistry',
  lessonTitleStartsWith: 'Coordination compounds',
  afterHeading: 'Colour, magnetic properties and spectrochemical series',
  title: 'Crystal Field Splitting Lab',
  format: 'Virtual experiment · energy-level diagram',
  blurb: 'Choose the number of d electrons, a ligand from the spectrochemical series, the metal and the pairing energy. See the d orbitals split, the electrons fill high spin or low spin, and read off the unpaired electrons, the magnetic moment, the CFSE and the colour.',
  can: ['Decide high spin or low spin by comparing Δo with P', 'Count unpaired electrons and compute μ = √(n(n+2))', 'Convert the splitting to the absorbed wavelength and the colour you see'],
  minutes: 12,
  vars: [
    { id: 'nd', label: 'd electrons of the metal ion', unit: '', min: 0, max: 10, step: 1, start: 6, digits: 0, choice: true },
    { id: 'L', label: 'Ligand position in the spectrochemical series (0 = I⁻ … 8 = H₂O … 11 = NH₃ … 14 = CO)', unit: '', min: 0, max: 14, step: 1, start: 8, digits: 0, choice: true },
    { id: 'g', label: 'Metal factor (larger for higher oxidation state, 4d and 5d metals)', unit: '', min: 1, max: 1.5, step: 0.1, start: 1, digits: 1 },
    { id: 'P', label: 'Pairing energy P (illustrative)', unit: 'cm⁻¹', min: 10000, max: 30000, step: 1000, start: 17000, digits: 0 },
  ],
  outs: [
    { id: 'delta', label: 'Splitting Δo (illustrative scale)', unit: 'cm⁻¹', fn: (v) => deltaOf(v.L!, v.g!), digits: 0 },
    { id: 'unp', label: 'Unpaired electrons n', unit: '', fn: (v) => fill(v.nd!, deltaOf(v.L!, v.g!), v.P!).unp, digits: 0 },
    { id: 'mu', label: 'Spin-only magnetic moment μ = √(n(n+2))', unit: 'BM', fn: (v) => moment(fill(v.nd!, deltaOf(v.L!, v.g!), v.P!).unp), digits: 2 },
    { id: 'cfse', label: 'CFSE = −0.4 n(t₂g) + 0.6 n(e_g)', unit: 'Δo', fn: (v) => cfseOf(fill(v.nd!, deltaOf(v.L!, v.g!), v.P!)), digits: 1 },
    { id: 'lam', label: 'Wavelength absorbed λ = 10⁷/Δo', unit: 'nm', fn: (v) => lamOf(deltaOf(v.L!, v.g!)), digits: 0 },
  ],
  graphs: [
    { id: 'mu-P', title: 'Magnetic moment against pairing energy', x: 'P', y: 'mu' },
    { id: 'mu-L', title: 'Magnetic moment along the spectrochemical series', x: 'L', y: 'mu' },
    { id: 'lam-L', title: 'Absorbed wavelength along the spectrochemical series', x: 'L', y: 'lam' },
  ],
  sceneAlt: 'Octahedral crystal field energy-level diagram: three lower t2g levels and two upper eg levels whose gap follows the ligand and metal, filled with up and down arrows for the chosen number of d electrons, plus a colour swatch of the complementary colour seen.',
  scene: ({ v, o }) => {
    const f = fill(v.nd!, o.delta!, v.P!);
    const gap = 30 + ((o.delta! - 8000) / (30900 - 8000)) * 110; // px between t2g and eg
    const yMid = 130;
    const yT = yMid + 0.4 * gap;
    const yE = yMid - 0.6 * gap;
    const orb = (x: number, y: number, up: boolean, down: boolean, key: string) => (
      <g key={key}>
        <line x1={x} y1={y} x2={x + 34} y2={y} stroke="#18443b" strokeWidth={2.5} />
        {up && <path d={`M ${x + 11} ${y - 2} v -16 m -3 5 l 3 -5 l 3 5`} stroke="#c45e42" strokeWidth={1.8} fill="none" />}
        {down && <path d={`M ${x + 23} ${y - 18} v 16 m -3 -5 l 3 5 l 3 -5`} stroke="#2563a8" strokeWidth={1.8} fill="none" />}
      </g>
    );
    const colourless = v.nd === 0 || v.nd === 10;
    const hue = hueAbsorbed(o.lam!);
    const visible = o.lam! >= 400 && o.lam! <= 700;
    const swatch = colourless || !visible ? '#f4f4f4' : `hsl(${(hue + 180) % 360} 65% 55%)`;
    return (
      <g>
        <line x1={30} y1={yMid} x2={80} y2={yMid} stroke="#7c8595" strokeDasharray="3 3" />
        <text x={31} y={yMid - 4} fontSize={9} textAnchor="start" fill="#7c8595">average</text>
        {[0, 1].map((j) => orb(110 + j * 40, yE, f.e > j, f.e > j + 2, `e${j}`))}
        {[0, 1, 2].map((j) => orb(90 + j * 40, yT, f.t > j, f.t > j + 3, `t${j}`))}
        <text x={235} y={yE - 2} fontSize={10} fill="#4d5768">e_g (+0.6 Δo)</text>
        <text x={235} y={yT - 2} fontSize={10} fill="#4d5768">t₂g (−0.4 Δo)</text>
        <path d={`M 80 ${yE} V ${yT} m -3 -6 l 3 6 l 3 -6`} stroke="#18443b" strokeWidth={1.2} fill="none" />
        <text x={76} y={(yE + yT) / 2} fontSize={10} textAnchor="end" fill="#18443b">Δo</text>
        <text x={185} y={20} fontSize={11} textAnchor="middle" fill="#18443b">d{v.nd} · {LIGANDS[v.L!]} · {f.kind === 'one' ? 'one arrangement possible' : f.kind === 'high' ? 'high spin (Δo < P)' : 'low spin (Δo > P)'}</text>
        <rect x={320} y={50} width={60} height={60} rx={8} fill={swatch} stroke="#18443b" />
        <text x={350} y={125} fontSize={10} textAnchor="middle" fill="#4d5768">{colourless ? 'colourless' : visible ? 'colour seen' : 'absorbs out of the visible'}</text>
        <text x={350} y={138} fontSize={10} textAnchor="middle" fill="#4d5768">absorbs {fmt(o.lam!, 0)} nm</text>
        <text x={200} y={222} fontSize={11} textAnchor="middle" fill="#4d5768">n = {o.unp} · μ = {fmt(o.mu!, 2)} BM · CFSE = {fmt(o.cfse!, 1)} Δo</text>
      </g>
    );
  },
  discover: [
    'Set 6 d electrons and slide the ligand from I⁻ to CO. At which ligand does the number of unpaired electrons suddenly change?',
    'Now raise the pairing energy P with a strong field ligand. What happens to the spin state?',
    'Move along the series and watch the absorbed wavelength and the colour swatch. Which way does the wavelength go as Δo grows?',
  ],
  experiment: [
    'Count the unpaired electrons for d1 to d3: does the ligand matter? Repeat for d4 to d7 and for d8 to d10.',
    'For d6, find the position in the series where μ drops from 4.90 BM to 0 for P = 17 000 cm⁻¹.',
    'Set 0 or 10 d electrons: why does the swatch go colourless?',
  ],
  understand: [
    'In an octahedral field t₂g is lowered by 0.4Δo and e_g raised by 0.6Δo; high spin occurs when Δo < P and low spin when Δo > P, only for d4 to d7.',
    'μ = √(n(n+2)) BM; the number of unpaired electrons tells whether a ligand acted as strong or weak field.',
    'CFSE = −0.4 n(t₂g) + 0.6 n(e_g) in units of Δo (plus the pairing cost when extra pairs form).',
    'Colour comes from a d–d transition of energy Δo = hc/λ; d⁰ and d¹⁰ complexes have no d–d transition and are colourless.',
  ],
  preds: [
    {
      id: 'p1', title: 'Weak to strong field, d6', prompt: 'A d⁶ octahedral ion has H₂O as ligand (weak field here, high spin, μ = 4.90 BM). Replace H₂O by NH₃, higher in the spectrochemical series. What happens to the magnetic moment (P = 17 000 cm⁻¹)?',
      base: { nd: 6, L: 8, g: 1, P: 17000 }, test: { L: 11 }, options: ['It stays 4.90 BM', 'It falls to 0: the complex becomes diamagnetic', 'It falls to 2.83 BM', 'It rises to 5.92 BM'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).mu! + 0.01, [outs(base).mu! + 0.01, 0.01, 2.83, 5.92]),
      why: ({ base, test, outs }) => `Δo goes from ${fmt(outs(base).delta!, 0)} to ${fmt(outs(test).delta!, 0)} cm⁻¹, passing P = 17 000, so the six electrons pair up in t₂g (t₂g⁶, low spin). Unpaired electrons go from ${outs(base).unp} to ${outs(test).unp}, μ from ${fmt(outs(base).mu!, 2)} to ${fmt(outs(test).mu!, 2)} BM.`,
    },
    {
      id: 'p2', title: 'Fill t₂g', prompt: 'The number of d electrons goes from 1 to 3 (all go into the lower t₂g set). What happens to the CFSE, in units of Δo?',
      base: { nd: 1 }, test: { nd: 3 }, options: ['It stays the same', 'It doubles', 'It becomes three times as large (more negative)', 'It becomes positive'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).cfse! / outs(base).cfse!, [1, 2, 3, -1]),
      why: ({ base, test, outs }) => `Each t₂g electron contributes −0.4 Δo. CFSE goes from ${fmt(outs(base).cfse!, 1)} Δo to ${fmt(outs(test).cfse!, 1)} Δo.`,
    },
    {
      id: 'p3', title: 'Along the series', prompt: 'A ligand at position 3 (Cl⁻) is replaced by one at position 13 (CN⁻), a stronger field ligand, on the same metal. What happens to the wavelength of light absorbed?',
      base: { L: 3, g: 1.3 }, test: { L: 13 }, options: ['It gets longer', 'It gets shorter', 'It does not change', 'It exactly doubles'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).lam! / outs(base).lam!; return r < 0.98 ? 1 : r > 1.02 ? (r > 1.9 && r < 2.1 ? 3 : 0) : 2; },
      why: ({ base, test, outs }) => `A bigger Δo needs a more energetic photon: λ = 10⁷/Δo. λ goes from ${fmt(outs(base).lam!, 0)} nm to ${fmt(outs(test).lam!, 0)} nm.`,
    },
    {
      id: 'p4', title: 'Lower the pairing energy', prompt: 'A d⁵ ion in a weak field (high spin, 5 unpaired electrons, 5.92 BM) has its pairing energy lowered below Δo (P from 17 000 to 10 000 cm⁻¹). What happens to the magnetic moment?',
      base: { nd: 5, L: 8, g: 1, P: 17000 }, test: { P: 10000 }, options: ['It stays 5.92 BM', 'It falls to 1.73 BM (one unpaired electron)', 'It falls to 0', 'It rises'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).mu!, [outs(base).mu!, 1.73, 0.01, 7]),
      why: ({ base, test, outs }) => `With P < Δo it costs less to pair electrons in t₂g than to put them in e_g, so the complex becomes low spin: ${outs(base).unp} unpaired electrons become ${outs(test).unp}, μ from ${fmt(outs(base).mu!, 2)} to ${fmt(outs(test).mu!, 2)} BM.`,
    },
  ],
  measure: {
    instruction: 'Keep the metal, d electrons and P fixed. Move the ligand along the series and record Δo and the absorbed wavelength for at least three ligands. Then test the relation between them.',
    vary: 'L',
    record: ['delta', 'lam', 'mu'],
    fit: {
      xLabel: '1000/λ (nm⁻¹)',
      yLabel: 'Δo (cm⁻¹)',
      x: (_v, o) => 1000 / o.lam!,
      y: (_v, o) => o.delta!,
      interpret: (slope, intercept) =>
        `Δo against 1/λ is a straight line through the origin (intercept ${fmt(intercept, 0)}), because Δo = hc/λ. The slope is ${fmt(slope, 0)} cm⁻¹ per 10⁻³ nm⁻¹, i.e. 1/λ in cm⁻¹ = 10⁷/(λ in nm): a splitting of 20 000 cm⁻¹ absorbs 500 nm light, as in the lesson's [Ti(H₂O)₆]³⁺ example.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The spin-only magnetic moment of the high spin octahedral ion [Fe(H₂O)₆]³⁺ (Fe³⁺ is d⁵) is', options: ['1.73 BM', '3.87 BM', '4.90 BM', '5.92 BM'], answer: 3,
      why: 'Weak field, high spin: t₂g³ e_g², five unpaired electrons. μ = √(5 × 7) = √35 = 5.92 BM.',
      verify: () => near(moment(fill(5, 10000, 17000).unp), [1.73, 3.87, 4.9, 5.92]),
    },
    {
      id: 'q2', q: 'The CFSE of an octahedral Ni²⁺ (d⁸, t₂g⁶ e_g²) complex, ignoring pairing energy, is', options: ['−2.4 Δo', '−1.2 Δo', '−0.6 Δo', '+1.2 Δo'], answer: 1,
      why: 'CFSE = −0.4(6) + 0.6(2) = −2.4 + 1.2 = −1.2 Δo. Only one arrangement is possible for d⁸.',
      verify: () => near(cfseOf(fill(8, 1, 1)), [-2.4, -1.2, -0.6, 1.2]),
    },
    {
      id: 'q3', q: 'A complex has an octahedral splitting of 16 000 cm⁻¹. The wavelength of light it absorbs is', options: ['400 nm', '500 nm', '625 nm', '750 nm'], answer: 2,
      why: 'λ = 1/(16 000 cm⁻¹) = 6.25 × 10⁻⁵ cm = 6.25 × 10⁻⁷ m = 625 nm (orange-red).',
      verify: () => near(lamOf(16000), [400, 500, 625, 750]),
    },
    {
      id: 'q4', q: 'Co²⁺ (d⁷) forms a strong field octahedral complex (low spin, t₂g⁶ e_g¹). Its spin-only magnetic moment is', options: ['3.87 BM', '1.73 BM', '0 BM', '2.83 BM'], answer: 1,
      why: 'Low spin d⁷ has one unpaired electron in e_g: μ = √(1 × 3) = 1.73 BM. (High spin would have 3 unpaired electrons, 3.87 BM.)',
      verify: () => near(moment(fill(7, 30000, 17000).unp), [3.87, 1.73, 0.01, 2.83]),
    },
    {
      id: 'q5', q: 'How many of the ions Sc³⁺, Ti³⁺, Zn²⁺, Cu⁺ and V³⁺ form colourless octahedral aqueous complexes (no d–d transition)?', options: ['1', '2', '3', '4'], answer: 2,
      why: 'Sc³⁺ is d⁰; Zn²⁺ and Cu⁺ are d¹⁰: three have no d–d transition. Ti³⁺ (d¹) and V³⁺ (d²) are coloured.',
      verify: () => near([0, 1, 10, 10, 2].filter((n) => n === 0 || n === 10).length, [1, 2, 3, 4]),
    },
  ],
};
