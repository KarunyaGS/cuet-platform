/**
 * Chapter lab: Physics, Unit VIII, "Atoms: alpha-particle scattering, Rutherford's nuclear model and the Bohr model of hydrogen".
 * The model: Bohr orbits of a one-electron atom of nuclear charge Z: r_n = 0.529 n²/Z Å, v_n = 2.19×10⁶ Z/n m/s, E_n = −13.6 Z²/n² eV,
 * and a transition from n_i down to n_f giving a photon of energy ΔE and wavelength 1240/ΔE nm. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const A0 = 0.529; // Å
const V1 = 2.19; // 10^6 m/s
const E1 = 13.6; // eV
const HC = 1240; // eV nm

const ni = (nf: number, k: number) => nf + k;
const dE = (Z: number, nf: number, k: number) => E1 * Z * Z * (1 / (nf * nf) - 1 / (ni(nf, k) ** 2));
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);
const colour = (nm: number) => (nm < 380 ? '#7c3aed' : nm < 450 ? '#6d28d9' : nm < 495 ? '#2563eb' : nm < 570 ? '#16a34a' : nm < 590 ? '#ca8a04' : nm < 650 ? '#ea580c' : nm <= 780 ? '#b91c1c' : '#7f1d1d');
const series = (nf: number) => ['', 'Lyman', 'Balmer', 'Paschen', 'Brackett'][nf] ?? '';

export const spec: Spec = {
  id: 'phys-atomic-models',
  subject: 'Physics',
  lessonTitleStartsWith: 'Atoms: alpha-particle scattering',
  afterHeading: 'Hydrogen line spectra',
  title: 'Bohr Model and Hydrogen Spectrum Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose the lower level n_f, how many levels the electron jumps down, and the nuclear charge Z. See the Bohr orbits, the energy levels, and the wavelength and series of the emitted photon.',
  can: ['Watch orbit radius grow as n² and speed fall as 1/n', 'Pick a jump and read off its wavelength and series (Lyman, Balmer, Paschen)', 'Fit 1/λ against (1/n_f² − 1/n_i²) to recover the Rydberg constant'],
  minutes: 12,
  vars: [
    { id: 'nf', label: 'Lower (final) level n_f', unit: '', min: 1, max: 4, step: 1, start: 2, digits: 0 },
    { id: 'k', label: 'Levels above: n_i − n_f', unit: '', min: 1, max: 6, step: 1, start: 2, digits: 0 },
    { id: 'Z', label: 'Nuclear charge Z (1 = H, 2 = He⁺, 3 = Li²⁺)', unit: '', min: 1, max: 3, step: 1, start: 1, digits: 0 },
  ],
  outs: [
    { id: 'ni', label: 'Upper (initial) level n_i', unit: '', fn: (v) => ni(v.nf!, v.k!), digits: 0 },
    { id: 'r', label: 'Radius of the n_i orbit r = 0.529 n²/Z', unit: 'Å', fn: (v) => (A0 * ni(v.nf!, v.k!) ** 2) / v.Z!, digits: 2 },
    { id: 'v', label: 'Speed of the electron in the n_i orbit', unit: '× 10⁶ m/s', fn: (v) => (V1 * v.Z!) / ni(v.nf!, v.k!), digits: 3 },
    { id: 'En', label: 'Energy of the n_i level E = −13.6 Z²/n²', unit: 'eV', fn: (v) => (-E1 * v.Z! * v.Z!) / ni(v.nf!, v.k!) ** 2, digits: 2 },
    { id: 'dE', label: 'Photon energy E_i − E_f', unit: 'eV', fn: (v) => dE(v.Z!, v.nf!, v.k!), digits: 3 },
    { id: 'lam', label: 'Photon wavelength λ = 1240 / ΔE', unit: 'nm', fn: (v) => HC / dE(v.Z!, v.nf!, v.k!), digits: 1 },
    { id: 'lines', label: 'Different lines from a sample excited to n_i', unit: '', fn: (v) => (ni(v.nf!, v.k!) * (ni(v.nf!, v.k!) - 1)) / 2, digits: 0 },
  ],
  graphs: [
    { id: 'lam-k', title: 'Wavelength against the size of the jump', x: 'k', y: 'lam' },
    { id: 'de-k', title: 'Photon energy against the size of the jump', x: 'k', y: 'dE' },
    { id: 'r-z', title: 'Orbit radius against nuclear charge', x: 'Z', y: 'r' },
  ],
  sceneAlt: 'Bohr orbits drawn in true proportion (radius growing as n squared) around a nucleus. The electron sits on the upper orbit and an arrow shows the jump down to the lower orbit, with the emitted photon coloured by its wavelength and labelled with its series.',
  scene: ({ v, o }) => {
    const n1 = o.ni!;
    const scale = 100 / (n1 * n1);
    const cx = 120;
    const cy = 115;
    const nf = v.nf!;
    const col = colour(o.lam!);
    const ang = -0.9;
    const rU = n1 * n1 * scale;
    const rL = nf * nf * scale;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4 + v.Z! * 1.5} fill="#c45e42" />
        <text x={cx} y={cy + 3} fontSize={7} textAnchor="middle" fill="#fff">+{v.Z}e</text>
        {Array.from({ length: n1 }, (_, i) => i + 1).map((n) => (
          <circle key={n} cx={cx} cy={cy} r={Math.max(7, n * n * scale)} fill="none" stroke={n === n1 ? '#18443b' : n === nf ? '#c45e42' : '#c9ced6'} strokeWidth={n === n1 || n === nf ? 1.6 : 1} strokeDasharray={n === nf ? '4 3' : undefined} />
        ))}
        <circle cx={cx + rU * Math.cos(ang)} cy={cy + rU * Math.sin(ang)} r={5} fill="#2563a8" />
        <path d={`M ${cx + rU * Math.cos(ang)} ${cy + rU * Math.sin(ang)} L ${cx + Math.max(7, rL) * Math.cos(ang + 0.5)} ${cy + Math.max(7, rL) * Math.sin(ang + 0.5)}`} stroke="#2563a8" strokeWidth={1.4} strokeDasharray="3 2" fill="none" />
        <path d={`M ${cx + rU * Math.cos(ang)} ${cy + rU * Math.sin(ang)} q 20 -10 40 0 t 40 0 t 40 0 t 40 0`} stroke={col} strokeWidth={2.2} fill="none" transform={`translate(${-cx + cx + 8} ${-14})`} />
        <text x={290} y={cy + 70} fontSize={11} textAnchor="middle" fill="#4d5768">{n1} → {nf}</text>
        <text x={290} y={cy + 86} fontSize={11} textAnchor="middle" fill={col}>{fmt(o.lam!, 1)} nm {series(nf) && v.Z === 1 ? `(${series(nf)})` : ''}</text>
        <text x={200} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">orbit radii drawn in the ratio 1 : 4 : 9 : … (r ∝ n²)</text>
      </g>
    );
  },
  discover: [
    'Increase n_i with the jump slider. What happens to the orbit radius and the electron speed?',
    'Set Z = 1 and n_f = 1, 2, 3 in turn. Which series do you get and in which part of the spectrum (ultraviolet, visible, infrared) does each lie?',
    'Change Z to 2 (He⁺) and compare the energies with hydrogen.',
  ],
  experiment: [
    'Keep n_f = 2 and increase the jump. Do the wavelengths keep getting shorter without limit, or crowd towards a limit?',
    'Double the nuclear charge at the same levels. By how much do the energy levels and ΔE change?',
    'Count the lines when the sample is excited to n_i = 5.',
  ],
  understand: [
    'Bohr orbits: r_n = 0.529 n²/Z Å and v_n = 2.19 × 10⁶ Z/n m/s, so radius grows as n² and speed falls as 1/n.',
    'Energy levels E_n = −13.6 Z²/n² eV: bound states are negative, and the levels crowd together as n grows.',
    'A jump from n_i to n_f emits one photon of energy E_i − E_f, so 1/λ = RZ²(1/n_f² − 1/n_i²).',
    'All lines ending on n_f = 1 are the Lyman series (ultraviolet), n_f = 2 Balmer (visible), n_f = 3 Paschen (infrared).',
  ],
  preds: [
    {
      id: 'p1', title: 'From n = 2 to n = 4: radius', prompt: 'The electron in hydrogen moves from the n = 2 orbit to the n = 4 orbit. By what factor does the orbit radius change?',
      base: { nf: 1, k: 1, Z: 1 }, test: { nf: 1, k: 3, Z: 1 }, options: ['2 times', '4 times', '8 times', '16 times'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).r! / outs(base).r!, [2, 4, 8, 16]),
      why: ({ base, test, outs }) => `r ∝ n², so doubling n multiplies r by 4: ${fmt(outs(base).r!, 2)} Å becomes ${fmt(outs(test).r!, 2)} Å.`,
    },
    {
      id: 'p2', title: 'From n = 2 to n = 4: speed', prompt: 'Over the same change (n = 2 to n = 4), how does the electron speed change?',
      base: { nf: 1, k: 1, Z: 1 }, test: { nf: 1, k: 3, Z: 1 }, options: ['It doubles', 'It halves', 'It becomes one quarter', 'It is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).v! / outs(base).v!, [2, 0.5, 0.25, 1]),
      why: ({ base, test, outs }) => `v ∝ 1/n, so doubling n halves the speed: ${fmt(outs(base).v!, 3)} × 10⁶ m/s becomes ${fmt(outs(test).v!, 3)} × 10⁶ m/s.`,
    },
    {
      id: 'p3', title: 'He⁺ instead of hydrogen', prompt: 'The electron sits in the same level n = 3 of H (Z = 1) and then of He⁺ (Z = 2). How does the magnitude of its energy change?',
      base: { nf: 2, k: 1, Z: 1 }, test: { nf: 2, k: 1, Z: 2 }, options: ['It halves', 'It doubles', 'It becomes four times as large', 'It is the same'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).En! / outs(base).En!, [0.5, 2, 4, 1]),
      why: ({ base, test, outs }) => `E_n = −13.6 Z²/n², so Z = 2 gives Z² = 4 times the energy: ${fmt(outs(base).En!, 2)} eV becomes ${fmt(outs(test).En!, 2)} eV.`,
    },
    {
      id: 'p4', title: 'Lyman to Balmer', prompt: 'A hydrogen atom drops from n = 3 to n = 1 (Lyman) and, in a second case, from n = 3 to n = 2 (Balmer). How does the wavelength of the second photon compare?',
      base: { nf: 1, k: 2, Z: 1 }, test: { nf: 2, k: 1, Z: 1 }, options: ['It is shorter', 'It is about 6 times longer', 'It is the same', 'It is about twice as long'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).lam! / outs(base).lam!; return r < 0.99 ? 0 : r < 1.01 ? 2 : r > 4.5 ? 1 : 3; },
      why: ({ base, test, outs }) => `The 3 → 1 jump releases ${fmt(outs(base).dE!, 2)} eV (λ = ${fmt(outs(base).lam!, 1)} nm); the 3 → 2 jump only ${fmt(outs(test).dE!, 2)} eV (λ = ${fmt(outs(test).lam!, 1)} nm), about ${fmt(outs(test).lam! / outs(base).lam!, 1)} times longer.`,
    },
  ],
  measure: {
    instruction: 'Keep n_f = 2 and Z = 1 (the Balmer series). Record the wavelength for at least three different jumps by changing the levels-above slider.',
    vary: 'k',
    record: ['ni', 'dE', 'lam'],
    fit: {
      xLabel: '1/n_f² − 1/n_i²',
      yLabel: '1/λ (× 10⁷ m⁻¹)',
      x: (v) => 1 / (v.nf! * v.nf!) - 1 / ni(v.nf!, v.k!) ** 2,
      y: (_v, o) => 100 / o.lam!,
      interpret: (slope, _i, v) => `1/λ against (1/n_f² − 1/n_i²) is a straight line through the origin. The slope is RZ² = ${fmt(slope, 4)} × 10⁷ m⁻¹, so the Rydberg constant R = slope / Z² ≈ ${fmt(slope / (v.Z! * v.Z!), 4)} × 10⁷ m⁻¹ (accepted 1.097 × 10⁷ m⁻¹).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The radius of the first Bohr orbit of hydrogen is 0.529 Å. The radius of the n = 4 orbit is', options: ['2.12 Å', '4.23 Å', '8.46 Å', '6.35 Å'], answer: 2,
      why: 'r_n = 0.529 n² Å, so r_4 = 0.529 × 16 = 8.46 Å.',
      verify: () => near(A0 * 16, [2.12, 4.23, 8.46, 6.35]),
    },
    {
      id: 'q2', q: 'The energy of the electron in the n = 5 level of hydrogen is', options: ['−0.54 eV', '−0.85 eV', '−2.72 eV', '−0.27 eV'], answer: 0,
      why: 'E_n = −13.6/n² = −13.6/25 = −0.544 eV.',
      verify: () => near(E1 / 25, [0.54, 0.85, 2.72, 0.27]),
    },
    {
      id: 'q3', q: 'The longest wavelength in the Paschen series of hydrogen (n = 4 to n = 3) is about (hc = 1240 eV nm)', options: ['656 nm', '486 nm', '1875 nm', '1282 nm'], answer: 2,
      why: 'ΔE = 13.6(1/9 − 1/16) = 0.661 eV. λ = 1240/0.661 ≈ 1875 nm, in the infrared.',
      verify: () => near(HC / dE(1, 3, 1), [656, 486, 1875, 1282]),
    },
    {
      id: 'q4', q: 'The ground-state energy of the doubly ionised lithium ion Li²⁺ (Z = 3) is', options: ['−40.8 eV', '−122.4 eV', '−13.6 eV', '−81.6 eV'], answer: 1,
      why: 'E_1 = −13.6 Z² = −13.6 × 9 = −122.4 eV.',
      verify: () => near(E1 * 9, [40.8, 122.4, 13.6, 81.6]),
    },
    {
      id: 'q5', q: 'A sample of hydrogen atoms is excited to the n = 6 level. The maximum number of different spectral lines it can emit is', options: ['15', '10', '21', '12'], answer: 0,
      why: 'The number of lines is n(n − 1)/2 = 6 × 5/2 = 15 (all pairs of levels from 1 to 6).',
      verify: () => near((6 * 5) / 2, [15, 10, 21, 12]),
    },
  ],
};
