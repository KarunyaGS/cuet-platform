/**
 * Chapter lab: Physics, Unit IX, "Energy bands in conductors, semiconductors and insulators".
 * The model: band gap E_g = E_C − E_V; thermal energy k_B T; the longest wavelength that can create an electron-hole pair λ_max = hc/E_g = 1240/E_g nm;
 * and a RELATIVE thermal carrier factor exp(−E_g / 2k_BT) (the standard Boltzmann form for the intrinsic carrier density; the lesson states the
 * idea that E_g compared with k_BT decides conduction, the exponential is the quantitative form of it). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const KB_EV = 1.38e-23 / 1.6e-19; // eV per K, from the lesson's k_B
const HC = 1240; // eV nm

const kT = (T: number) => KB_EV * T;
const factor = (Eg: number, T: number) => Math.exp(-Eg / (2 * kT(T)));
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);
const colour = (nm: number) => (nm < 380 ? '#7c3aed' : nm < 450 ? '#6d28d9' : nm < 495 ? '#2563eb' : nm < 570 ? '#16a34a' : nm < 590 ? '#ca8a04' : nm < 650 ? '#ea580c' : nm <= 780 ? '#b91c1c' : '#7f1d1d');

export const spec: Spec = {
  id: 'phys-energy-bands',
  subject: 'Physics',
  lessonTitleStartsWith: 'Energy bands in conductors',
  afterHeading: 'Energy bands in semiconductors',
  title: 'Energy Band and Band Gap Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Set the band gap, the temperature and the colour of the light. See the valence and conduction bands, how many electrons cross the gap, and whether a photon can create an electron-hole pair.',
  can: ['Widen the gap from silicon to diamond and watch the carriers vanish', 'Compare E_g with k_B T and see why heating helps a semiconductor', 'Fit ln(carrier factor) against 1/T to recover the band gap'],
  minutes: 11,
  vars: [
    { id: 'Eg', label: 'Band gap E_g', unit: 'eV', min: 0.1, max: 6, step: 0.05, start: 1.1, digits: 2 },
    { id: 'T', label: 'Temperature T', unit: 'K', min: 100, max: 800, step: 10, start: 300, digits: 0 },
    { id: 'lam', label: 'Wavelength of the light falling on the solid', unit: 'nm', min: 200, max: 2000, step: 10, start: 600, digits: 0 },
  ],
  outs: [
    { id: 'kT', label: 'Thermal energy k_B T', unit: 'eV', fn: (v) => kT(v.T!), digits: 4 },
    { id: 'ratio', label: 'Gap divided by thermal energy E_g / k_B T', unit: '', fn: (v) => v.Eg! / kT(v.T!), digits: 1 },
    { id: 'frac', label: 'Relative thermal carrier factor exp(−E_g / 2k_BT)', unit: '', fn: (v) => factor(v.Eg!, v.T!), sci: true },
    { id: 'lmax', label: 'Longest wavelength that makes a pair λ_max = hc / E_g', unit: 'nm', fn: (v) => HC / v.Eg!, digits: 0 },
    { id: 'Eph', label: 'Photon energy of the light hc / λ', unit: 'eV', fn: (v) => HC / v.lam!, digits: 3 },
    { id: 'pair', label: 'Photon can create an electron-hole pair (1 = yes, 0 = no)', unit: '', fn: (v) => (HC / v.lam! >= v.Eg! ? 1 : 0), digits: 0 },
    { id: 'cls', label: 'Class by gap (1 = semiconductor, below 3 eV; 2 = insulator)', unit: '', fn: (v) => (v.Eg! < 3 ? 1 : 2), digits: 0 },
  ],
  graphs: [
    { id: 'f-t', title: 'Carrier factor against temperature', x: 'T', y: 'frac', logY: true },
    { id: 'f-eg', title: 'Carrier factor against band gap', x: 'Eg', y: 'frac', logY: true },
    { id: 'l-eg', title: 'Longest absorbed wavelength against band gap', x: 'Eg', y: 'lmax' },
  ],
  sceneAlt: 'An energy band diagram: a filled valence band at the bottom, an empty conduction band at the top and a forbidden gap between them whose height follows the band gap. Dots in the conduction band and open circles in the valence band show thermally created electron-hole pairs, and an arrow shows whether the incident photon is energetic enough to cross the gap.',
  scene: ({ v, o }) => {
    const gap = 16 + v.Eg! * 22;
    const top = 28;
    const cbBottom = top + 36;
    const vbTop = cbBottom + gap;
    const dots = Math.max(0, Math.min(14, Math.round(Math.log10(Math.max(o.frac!, 1e-300)) + 14)));
    const col = colour(v.lam!);
    return (
      <g>
        <rect x={110} y={top} width={180} height={36} fill="#2563a8" opacity={0.15} stroke="#2563a8" />
        <text x={300} y={top + 22} fontSize={11} fill="#2563a8">conduction band</text>
        <rect x={110} y={vbTop} width={180} height={Math.max(10, 222 - vbTop - 6)} fill="#18443b" opacity={0.25} stroke="#18443b" />
        <text x={300} y={vbTop + 18} fontSize={11} fill="#18443b">valence band</text>
        <path d={`M 98 ${cbBottom} V ${vbTop} M 94 ${cbBottom + 5} l 4 -5 l 4 5 M 94 ${vbTop - 5} l 4 5 l 4 -5`} stroke="#c45e42" fill="none" strokeWidth={1.4} />
        <text x={92} y={(cbBottom + vbTop) / 2 + 4} fontSize={11} textAnchor="end" fill="#c45e42">E_g = {fmt(v.Eg!, 2)} eV</text>
        {Array.from({ length: dots }, (_, i) => {
          const x = 125 + ((i * 37) % 150);
          return (
            <g key={i}>
              <circle cx={x} cy={cbBottom - 10 - (i % 3) * 7} r={3.5} fill="#2563a8" />
              <circle cx={x} cy={vbTop + 10 + (i % 3) * 7} r={3.5} fill="#fff" stroke="#18443b" />
            </g>
          );
        })}
        <path d={`M 20 ${vbTop + 14} q 8 -8 16 0 t 16 0 t 16 0`} stroke={col} strokeWidth={2} fill="none" />
        {o.pair! === 1 ? <path d={`M 70 ${vbTop + 10} L 150 ${cbBottom - 12} m -7 1 l 7 -1 l -2 8`} stroke={col} strokeWidth={1.6} fill="none" /> : <path d={`M 70 ${vbTop + 10} L 108 ${vbTop - 3} m -2 -7 l 2 7 l -8 1`} stroke="#7c8595" strokeDasharray="3 3" fill="none" />}
        <text x={200} y={224} fontSize={10} textAnchor="middle" fill="#4d5768">E_g/k_BT = {fmt(o.ratio!, 1)} · photon {fmt(o.Eph!, 2)} eV {o.pair! === 1 ? 'crosses the gap' : 'is too weak to cross the gap'}</text>
      </g>
    );
  },
  discover: [
    'Increase the band gap from 1.1 eV (silicon) to 5.4 eV (diamond). What happens to the number of electrons in the conduction band?',
    'Raise the temperature at a fixed gap. Why do more electrons cross?',
    'Change the wavelength of the light until the photon just reaches the gap energy.',
  ],
  experiment: [
    'Compare E_g with k_BT at room temperature (300 K). For which gaps is E_g/k_BT small enough for thermal excitation?',
    'Find λ_max for 1.1 eV and for 2.4 eV. Which can absorb red light (700 nm)?',
    'Look at the carrier factor graph against T: is it a straight line or a curve?',
  ],
  understand: [
    'The forbidden gap E_g = E_C − E_V is the minimum energy an electron needs to go from the valence band to the conduction band.',
    'Thermal energy k_BT is only about 0.026 eV at 300 K, so a gap of a few eV is almost never crossed by heat alone.',
    'The longest wavelength that can create an electron-hole pair is λ_max = hc/E_g ≈ 1240/E_g(eV) nm.',
    'A semiconductor has a gap below about 3 eV; its carriers increase steeply with temperature, unlike a metal.',
  ],
  preds: [
    {
      id: 'p1', title: 'Silicon to diamond', prompt: 'At 300 K the band gap is changed from 1.1 eV (silicon) to 5.4 eV (diamond). What happens to the number of thermally excited electrons?',
      base: { Eg: 1.1, T: 300 }, test: { Eg: 5.4, T: 300 }, options: ['It falls by a factor of about 5', 'It falls by an enormous factor (about 10³⁶): practically none are left', 'It is unchanged', 'It rises'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).frac! / outs(base).frac!; return r > 1.01 ? 3 : r > 0.99 ? 2 : r < 1e-20 ? 1 : 0; },
      why: ({ base, test, outs }) => `The carrier factor exp(−E_g/2k_BT) depends on E_g/k_BT, which rises from ${fmt(outs(base).ratio!, 1)} to ${fmt(outs(test).ratio!, 1)}. The factor falls from ${fmt(outs(base).frac!, 2, true)} to ${fmt(outs(test).frac!, 2, true)}.`,
    },
    {
      id: 'p2', title: 'Heat the silicon', prompt: 'A silicon crystal (E_g = 1.1 eV) is heated from 300 K to 600 K. What happens to the number of thermally excited electrons?',
      base: { Eg: 1.1, T: 300 }, test: { Eg: 1.1, T: 600 }, options: ['It about doubles', 'It rises by a factor of tens of thousands', 'It rises by about 4 times', 'It falls'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).frac! / outs(base).frac!; return r > 1e3 ? 1 : r < 1 ? 3 : r < 3 ? 0 : 2; },
      why: ({ base, test, outs }) => `k_BT doubles, so E_g/k_BT halves from ${fmt(outs(base).ratio!, 1)} to ${fmt(outs(test).ratio!, 1)}; the exponent changes by about 10 and the factor rises about ${fmt(outs(test).frac! / outs(base).frac!, 0, true)} times.`,
    },
    {
      id: 'p3', title: 'Halve the gap', prompt: 'The band gap of a solid is halved from 2.0 eV to 1.0 eV. What happens to the longest wavelength it can absorb to make a pair?',
      base: { Eg: 2 }, test: { Eg: 1 }, options: ['It halves', 'It doubles', 'It is unchanged', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).lmax! / outs(base).lmax!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `λ_max = hc/E_g, so it is inversely proportional to E_g: ${fmt(outs(base).lmax!, 0)} nm becomes ${fmt(outs(test).lmax!, 0)} nm.`,
    },
    {
      id: 'p4', title: 'Orange light on two solids', prompt: 'Light of wavelength 600 nm (photon energy about 2.07 eV) falls on a solid with E_g = 1.1 eV and then on one with E_g = 2.4 eV. Which can absorb it to create pairs?',
      base: { Eg: 1.1, lam: 600 }, test: { Eg: 2.4, lam: 600 }, options: ['Both', 'Only the 1.1 eV solid', 'Only the 2.4 eV solid', 'Neither'], answer: 1,
      verify: ({ base, test, outs }) => { const b = outs(base).pair!; const t = outs(test).pair!; return b && t ? 0 : b ? 1 : t ? 2 : 3; },
      why: ({ base, test, outs }) => `A pair needs a photon energy of at least E_g. The 600 nm photon carries ${fmt(outs(base).Eph!, 2)} eV: enough for 1.1 eV (pair = ${outs(base).pair}) but not for 2.4 eV (pair = ${outs(test).pair}).`,
    },
  ],
  measure: {
    instruction: 'Keep the band gap fixed (for example silicon, 1.1 eV). Record the carrier factor at three or more different temperatures.',
    vary: 'T',
    record: ['kT', 'ratio', 'frac'],
    fit: {
      xLabel: '1/T (K⁻¹)',
      yLabel: 'ln(carrier factor)',
      x: (v) => 1 / v.T!,
      y: (_v, o) => Math.log(o.frac!),
      interpret: (slope) => `ln(carrier factor) against 1/T is a straight line of negative slope −E_g/(2k_B). So E_g = −2 × slope × k_B = ${fmt(-2 * slope * KB_EV, 3)} eV (k_B = 8.63 × 10⁻⁵ eV/K); compare with the band gap you set.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A semiconductor has a band gap of 1.9 eV. The longest wavelength of light that can create an electron-hole pair in it is about (hc = 1240 eV nm)', options: ['326 nm', '653 nm', '1240 nm', '2356 nm'], answer: 1,
      why: 'λ_max = hc/E_g = 1240/1.9 = 653 nm.',
      verify: () => near(HC / 1.9, [326, 653, 1240, 2356]),
    },
    {
      id: 'q2', q: 'Light of wavelength 800 nm falls on five solids with band gaps 0.67 eV, 1.1 eV, 1.4 eV, 2.4 eV and 3.2 eV. How many of them can absorb it by exciting electrons across the gap?', options: ['2', '4', '3', '5'], answer: 2,
      why: 'The photon energy is 1240/800 = 1.55 eV. Only gaps of 1.55 eV or less can be crossed: 0.67, 1.1 and 1.4 eV, which is 3 solids.',
      verify: () => near([0.67, 1.1, 1.4, 2.4, 3.2].filter((g) => HC / 800 >= g).length, [2, 4, 3, 5]),
    },
    {
      id: 'q3', q: 'Using k_B = 1.38 × 10⁻²³ J/K, the thermal energy k_BT at 600 K is about', options: ['0.026 eV', '0.052 eV', '0.104 eV', '0.0087 eV'], answer: 1,
      why: 'k_BT = 1.38 × 10⁻²³ × 600 / 1.6 × 10⁻¹⁹ = 0.0517 eV, twice the 0.026 eV of room temperature.',
      verify: () => near(kT(600), [0.026, 0.052, 0.104, 0.0087]),
    },
    {
      id: 'q4', q: 'At 300 K (k_BT = 0.0259 eV) the ratio E_g / k_BT for diamond (E_g = 5.4 eV) is about', options: ['21', '2090', '208', '42'], answer: 2,
      why: '5.4/0.0259 = 208. A gap more than 200 times the thermal energy is almost never crossed by thermal excitation, so diamond is an insulator.',
      verify: () => near(5.4 / kT(300), [21, 2090, 208, 42]),
    },
    {
      id: 'q5', q: 'A semiconductor is found to be transparent to light of wavelength longer than 886 nm but to absorb shorter wavelengths. Its band gap is about', options: ['0.7 eV', '1.1 eV', '2.8 eV', '1.4 eV'], answer: 3,
      why: 'The cut-off wavelength is λ_max = hc/E_g, so E_g = 1240/886 = 1.4 eV.',
      verify: () => near(HC / 886, [0.7, 1.1, 2.8, 1.4]),
    },
  ],
};
