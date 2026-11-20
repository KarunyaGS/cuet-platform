/**
 * Chapter lab: Physics, Unit V, "The electromagnetic spectrum and the uses of its bands".
 * The model: c = νλ in vacuum, photon energy E = hc/λ = 1240/λ(nm) eV, the lesson's band boundaries, radar ranging d = ct/2,
 * and the fact that the frequency stays the same in a medium while the wavelength becomes λ/n. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const C = 3e8;
const HC = 1240; // eV nm
// band edges in nm (longest wavelength first), from the lesson table
const EDGES = [1e8, 1e6, 700, 400, 1, 1e-3]; // radio | micro | IR | visible | UV | X | gamma
const NAMES = ['Radio waves', 'Microwaves', 'Infrared', 'Visible light', 'Ultraviolet', 'X-rays', 'Gamma rays'];
const COLS = ['#7c8595', '#9a6b3d', '#b91c1c', '#16a34a', '#6d28d9', '#2563a8', '#c45e42'];
const bandIdx = (nm: number) => {
  let i = 0;
  while (i < EDGES.length && nm <= EDGES[i]!) i++;
  return i; // 0..6
};
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-em-spectrum',
  subject: 'Physics',
  lessonTitleStartsWith: 'The electromagnetic spectrum',
  afterHeading: 'The electromagnetic spectrum',
  title: 'Electromagnetic Spectrum Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Slide the wavelength across twenty powers of ten and see the band, the frequency and the photon energy change. Send the wave into glass, and bounce a radar pulse off a target.',
  can: ['Find which band any wavelength belongs to and whether it is ionising', 'See the frequency stay the same while the wavelength shortens in a medium', 'Fit photon energy against 1/λ to recover hc = 1240 eV nm'],
  minutes: 10,
  vars: [
    { id: 'lam', label: 'Wavelength in vacuum λ', unit: 'nm', min: 1e-4, max: 1e12, step: 1, start: 550, log: true, digits: 2 },
    { id: 'n', label: 'Refractive index of the medium n', unit: '', min: 1, max: 2.5, step: 0.05, start: 1, digits: 2, bounds: { min: 1, max: 10 } },
    { id: 'dist', label: 'Radar target distance d', unit: 'km', min: 1, max: 200, step: 1, start: 30, digits: 0 },
  ],
  outs: [
    { id: 'nu', label: 'Frequency ν = c / λ', unit: 'Hz', fn: (v) => C / (v.lam! * 1e-9), sci: true },
    { id: 'E', label: 'Photon energy E = hc / λ', unit: 'eV', fn: (v) => HC / v.lam!, sci: true },
    { id: 'band', label: 'Band number (1 radio, 2 micro, 3 infrared, 4 visible, 5 UV, 6 X-ray, 7 gamma)', unit: '', fn: (v) => bandIdx(v.lam!) + 1, digits: 0 },
    { id: 'ion', label: 'Ionising? (1 if photon energy is above about 10 eV)', unit: '', fn: (v) => (HC / v.lam! >= 10 ? 1 : 0), digits: 0 },
    { id: 'lamMed', label: 'Wavelength in the medium λ / n', unit: 'nm', fn: (v) => v.lam! / v.n!, sci: true },
    { id: 'vMed', label: 'Speed in the medium c / n', unit: '× 10⁸ m/s', fn: (v) => 3 / v.n!, digits: 2 },
    { id: 'nuMed', label: 'Frequency in the medium v / λ_medium', unit: 'Hz', fn: (v) => (C / v.n!) / ((v.lam! / v.n!) * 1e-9), sci: true },
    { id: 'echo', label: 'Radar echo delay t = 2d / c', unit: 'µs', fn: (v) => ((2 * v.dist! * 1e3) / C) * 1e6, digits: 1 },
  ],
  graphs: [
    { id: 'e-lam', title: 'Photon energy against wavelength', x: 'lam', y: 'E', logX: true, logY: true },
    { id: 'nu-lam', title: 'Frequency against wavelength', x: 'lam', y: 'nu', logX: true, logY: true },
    { id: 'echo-d', title: 'Radar echo delay against target distance', x: 'dist', y: 'echo' },
  ],
  sceneAlt: 'The electromagnetic spectrum on a logarithmic wavelength scale, divided into the seven bands, with a marker at the chosen wavelength. Below it, a wave crosses from vacuum into a medium: the wavelength is shorter by the refractive index while the frequency is unchanged.',
  scene: ({ v, o }) => {
    const x = (nm: number) => 380 - ((Math.log10(nm) + 4) / 16) * 360;
    const bounds = [1e12, ...EDGES, 1e-4];
    const idx = o.band! - 1;
    const px = x(v.lam!);
    const p = 30;
    const pts1: string[] = [];
    const pts2: string[] = [];
    for (let k = 0; k <= 160; k += 2) pts1.push(`${60 + k},${175 - 20 * Math.sin((2 * Math.PI * k) / p)}`);
    for (let k = 0; k <= 160; k += 2) pts2.push(`${220 + k},${175 - 20 * Math.sin((2 * Math.PI * k * v.n!) / p)}`);
    return (
      <g>
        {NAMES.map((nm, i) => {
          const xa = x(bounds[i]!);
          const xb = x(bounds[i + 1]!);
          return (
            <g key={nm}>
              <rect x={xa} y={50} width={xb - xa} height={24} fill={COLS[i]} opacity={i === idx ? 0.9 : 0.35} />
              <text x={(xa + xb) / 2} y={i % 2 ? 94 : 44} fontSize={8.5} textAnchor="middle" fill="#4d5768">{nm}</text>
            </g>
          );
        })}
        <path d={`M ${px} 78 l -5 -9 h 10 z`} fill="#18443b" />
        <text x={200} y={118} fontSize={11} textAnchor="middle" fill="#18443b">{NAMES[idx]} · λ = {fmt(v.lam!, 2, true)} nm · ν = {fmt(o.nu!, 2, true)} Hz</text>
        <text x={200} y={134} fontSize={11} textAnchor="middle" fill={o.ion! ? '#b91c1c' : '#4d5768'}>E = {fmt(o.E!, 2, true)} eV ({o.ion! ? 'ionising' : 'non-ionising'})</text>
        <polyline points={pts1.join(' ')} fill="none" stroke="#c45e42" strokeWidth={1.6} />
        <polyline points={pts2.join(' ')} fill="none" stroke="#2563a8" strokeWidth={1.6} />
        <rect x={210} y={150} width={170} height={50} fill="#2563a8" opacity={0.06} />
        <text x={140} y={212} fontSize={10} textAnchor="middle" fill="#c45e42">vacuum: λ</text>
        <text x={300} y={212} fontSize={10} textAnchor="middle" fill="#2563a8">medium (n = {fmt(v.n!, 2)}): λ/n, same ν</text>
      </g>
    );
  },
  discover: [
    'Slide the wavelength from the radio end to the gamma end. Watch the band, the frequency and the photon energy.',
    'Set the wavelength inside the visible band (400 to 700 nm). What is the photon energy in eV?',
    'Raise the refractive index of the medium. What changes: the speed, the wavelength, the frequency?',
  ],
  experiment: [
    'Make the wavelength ten times smaller. By what factor do the frequency and the photon energy change? Check the log-log graphs.',
    'Find the wavelength at which the photon energy first exceeds about 10 eV. Which band is that?',
    'Double the radar distance and read the echo delay.',
  ],
  understand: [
    'c = νλ: in vacuum every band travels at the same speed, so a higher frequency means a proportionally shorter wavelength.',
    'The photon energy E = hν = hc/λ ≈ 1240/λ(nm) eV, so shorter wavelength means more energetic photons.',
    'Ultraviolet (short part), X-rays and gamma rays have enough energy to ionise atoms; radio, microwaves, infrared and visible light do not.',
    'On entering a medium the frequency stays the same; the speed and the wavelength both fall by the factor n.',
  ],
  preds: [
    {
      id: 'p1', title: 'Ten times the wavelength', prompt: 'A wave in vacuum has its wavelength made ten times longer (550 nm to 5500 nm). What happens to its frequency?',
      base: { lam: 550 }, test: { lam: 5500 }, options: ['It becomes ten times larger', 'It falls to one tenth', 'It stays the same', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).nu! / outs(base).nu!, [10, 0.1, 1, 0.5]),
      why: ({ base, test, outs }) => `c = νλ with c fixed, so ν ∝ 1/λ: ${fmt(outs(base).nu!, 2, true)} Hz becomes ${fmt(outs(test).nu!, 2, true)} Hz.`,
    },
    {
      id: 'p2', title: 'Into glass', prompt: 'Light of 550 nm in vacuum enters glass of refractive index 1.5. What happens to its wavelength?',
      base: { lam: 550, n: 1 }, test: { lam: 550, n: 1.5 }, options: ['It stays the same', 'It falls to two thirds', 'It becomes 1.5 times as long', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).lamMed! / outs(base).lamMed!, [1, 2 / 3, 1.5, 0.5]),
      why: ({ base, test, outs }) => `The speed falls to c/n while the frequency stays at ${fmt(outs(test).nuMed!, 2, true)} Hz, so λ = v/ν falls by n: ${fmt(outs(base).lamMed!, 0)} nm becomes ${fmt(outs(test).lamMed!, 0)} nm.`,
    },
    {
      id: 'p3', title: 'X-ray against green light', prompt: 'Green light of wavelength 500 nm is compared with X-rays of wavelength 0.10 nm. How much larger is the X-ray photon energy?',
      base: { lam: 500 }, test: { lam: 0.1 }, options: ['About 50 times', 'About 5000 times', 'About 500 times', 'About 500 000 times'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).E! / outs(base).E!, [50, 5000, 500, 5e5]),
      why: ({ base, test, outs }) => `E = 1240/λ: ${fmt(outs(base).E!, 2)} eV for green light and ${fmt(outs(test).E!, 0)} eV for the X-ray, a ratio of ${fmt(outs(test).E! / outs(base).E!, 0)}.`,
    },
    {
      id: 'p4', title: 'A farther target', prompt: 'A radar target moves from 30 km to 60 km away. What happens to the echo delay?',
      base: { dist: 30 }, test: { dist: 60 }, options: ['It doubles', 'It halves', 'It is unchanged', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).echo! / outs(base).echo!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `The pulse travels to the target and back: t = 2d/c, proportional to d. ${fmt(outs(base).echo!, 0)} µs becomes ${fmt(outs(test).echo!, 0)} µs.`,
    },
  ],
  measure: {
    instruction: 'Keep the medium as vacuum (n = 1). Record the photon energy for at least three different wavelengths.',
    vary: 'lam',
    record: ['nu', 'E', 'band'],
    fit: {
      xLabel: '1/λ (nm⁻¹)',
      yLabel: 'E (eV)',
      x: (v) => 1 / v.lam!,
      y: (_v, o) => o.E!,
      interpret: (slope) => `E against 1/λ is a straight line through the origin, so E ∝ 1/λ. The slope is hc = ${fmt(slope, 0)} eV nm (the lesson uses hc ≈ 1240 eV nm, which is 6.63 × 10^-34 × 3 × 10^8 expressed in eV nm).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'An electromagnetic wave has a frequency of 6.0 × 10¹⁹ Hz. Using the lesson table, it belongs to the', options: ['Ultraviolet band', 'X-ray band', 'Gamma-ray band', 'Microwave band'], answer: 1,
      why: 'λ = c/ν = 3 × 10⁸ / 6 × 10¹⁹ = 5 × 10⁻¹² m = 5 × 10⁻³ nm, between 10⁻³ nm and 1 nm: X-rays.',
      verify: () => bandIdx((C / 6e19) * 1e9) - 4,
    },
    {
      id: 'q2', q: 'Microwave-oven radiation has a frequency of 2.45 GHz. Its wavelength in air is about', options: ['12.2 cm', '1.22 m', '0.82 cm', '12.2 mm'], answer: 0,
      why: 'λ = c/ν = 3 × 10⁸ / 2.45 × 10⁹ = 0.122 m = 12.2 cm.',
      verify: () => near(C / 2.45e9, [0.122, 1.22, 0.0082, 0.0122]),
    },
    {
      id: 'q3', q: 'The energy of a photon of ultraviolet light of wavelength 300 nm is (hc = 1240 eV nm)', options: ['4.13 eV', '1.24 eV', '12.4 eV', '0.41 eV'], answer: 0,
      why: 'E = hc/λ with hc = 1240 eV nm, so E = 1240/300 = 4.13 eV.',
      verify: () => near(HC / 300, [4.13, 1.24, 12.4, 0.41]),
    },
    {
      id: 'q4', q: 'A radar pulse returns 4.0 × 10⁻⁴ s after it was sent. The target is at a distance of', options: ['120 km', '30 km', '60 km', '240 km'], answer: 2,
      why: 'The pulse covers 2d: d = ct/2 = 3 × 10⁸ × 4.0 × 10⁻⁴ / 2 = 6.0 × 10⁴ m = 60 km.',
      verify: () => near((C * 4e-4) / 2 / 1000, [120, 30, 60, 240]),
    },
    {
      id: 'q5', q: 'Light of wavelength 600 nm in vacuum passes into a transparent solid of refractive index 1.5. Its wavelength in the solid is', options: ['900 nm', '400 nm', '600 nm', '240 nm'], answer: 1,
      why: 'The frequency does not change and the speed falls by n, so λ = 600/1.5 = 400 nm.',
      verify: () => near(600 / 1.5, [900, 400, 600, 240]),
    },
  ],
};
