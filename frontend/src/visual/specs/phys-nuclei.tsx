/**
 * Chapter lab: Physics, Unit VIII, "Nuclei: composition, size, nuclear force, mass defect, binding energy, fission and fusion".
 * The model: R = R0 A^(1/3) with R0 = 1.2 fm; mass defect and binding energy E_b = ΔM × 931.5 MeV; E_bn = E_b / A;
 * energy released when a nucleus splits into fragments of a given binding energy per nucleon: Q = A (E_bn(fragments) − E_bn(parent)).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const R0 = 1.2; // fm
const MEV_PER_U = 931.5;
const U_KG = 1.660539; // 10^-27 kg

const radius = (A: number) => R0 * Math.cbrt(A);
const ebn = (x: number) => x * MEV_PER_U;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-nuclei',
  subject: 'Physics',
  lessonTitleStartsWith: 'Nuclei: composition',
  afterHeading: 'Binding energy per nucleon and its variation with mass number',
  title: 'Nuclear Size and Binding Energy Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose a mass number, a mass defect and the binding energy per nucleon of the fragments. See the nuclear radius R = R0 A^(1/3), the binding energy from the mass defect, and the energy released when a heavy nucleus splits.',
  can: ['Grow the nucleus and watch R follow the cube root of A', 'Turn a mass defect in u into binding energy in MeV', 'Fit R against A^(1/3) to recover the constant R0'],
  minutes: 11,
  vars: [
    { id: 'A', label: 'Mass number A', unit: '', min: 4, max: 240, step: 1, start: 236, digits: 0 },
    { id: 'x', label: 'Mass defect per nucleon ΔM / A', unit: 'u', min: 0.005, max: 0.0095, step: 0.0001, start: 0.0082, digits: 4 },
    { id: 'frag', label: 'Binding energy per nucleon of the fragments', unit: 'MeV', min: 7, max: 9, step: 0.1, start: 8.4, digits: 1 },
  ],
  outs: [
    { id: 'R', label: 'Nuclear radius R = R0 A^(1/3)', unit: 'fm', fn: (v) => radius(v.A!), digits: 2 },
    { id: 'dM', label: 'Mass defect ΔM', unit: 'u', fn: (v) => v.x! * v.A!, digits: 4 },
    { id: 'Eb', label: 'Binding energy E_b = ΔM × 931.5', unit: 'MeV', fn: (v) => v.x! * v.A! * MEV_PER_U, digits: 1 },
    { id: 'Ebn', label: 'Binding energy per nucleon E_b / A', unit: 'MeV', fn: (v) => ebn(v.x!), digits: 2 },
    { id: 'Q', label: 'Energy released if it splits into fragments Q = A (E_frag − E_bn)', unit: 'MeV', fn: (v) => v.A! * (v.frag! - ebn(v.x!)), digits: 1 },
    { id: 'm', label: 'Mass of the nucleus (about A × 1 u)', unit: '× 10⁻²⁷ kg', fn: (v) => v.A! * U_KG, digits: 1 },
  ],
  graphs: [
    { id: 'r-a', title: 'Nuclear radius against mass number', x: 'A', y: 'R' },
    { id: 'eb-a', title: 'Total binding energy against mass number', x: 'A', y: 'Eb' },
    { id: 'q-f', title: 'Energy released against the fragments\' binding energy per nucleon', x: 'frag', y: 'Q' },
  ],
  sceneAlt: 'A nucleus drawn as a sphere of protons and neutrons whose radius follows A to the one third, with a bar underneath showing the binding energy per nucleon against the 8.8 MeV peak, and a label for the energy released on splitting.',
  scene: ({ v, o }) => {
    const rpx = o.R! * 11;
    const n = Math.min(v.A!, 90);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const bar = Math.min(1, o.Ebn! / 10);
    return (
      <g>
        <circle cx={110} cy={95} r={rpx} fill="#18443b" opacity={0.08} stroke="#18443b" />
        {Array.from({ length: n }, (_, i) => {
          const rr = (Math.sqrt((i + 0.5) / n) * rpx) * 0.92;
          return <circle key={i} cx={110 + rr * Math.cos(i * golden)} cy={95 + rr * Math.sin(i * golden)} r={Math.max(2.2, Math.min(5, 90 / Math.sqrt(n)))} fill={i % 2 ? '#c45e42' : '#2563a8'} opacity={0.85} />;
        })}
        <text x={110} y={95 + rpx + 16} fontSize={11} textAnchor="middle" fill="#4d5768">R = {fmt(o.R!, 2)} fm · A = {v.A}</text>
        <text x={250} y={40} fontSize={11} fill="#c45e42">● proton  <tspan fill="#2563a8">● neutron</tspan></text>
        <text x={250} y={70} fontSize={11} fill="#4d5768">E_b = {fmt(o.Eb!, 0)} MeV</text>
        <text x={250} y={86} fontSize={11} fill="#4d5768">ΔM = {fmt(o.dM!, 3)} u</text>
        <rect x={215} y={150} width={170} height={12} fill="#fff" stroke="#c9ced6" />
        <rect x={215} y={150} width={170 * bar} height={12} fill="#18443b" />
        <line x1={215 + 170 * 0.88} y1={145} x2={215 + 170 * 0.88} y2={167} stroke="#c45e42" />
        <text x={215 + 170 * 0.88} y={178} fontSize={9} textAnchor="middle" fill="#c45e42">8.8 (Fe peak)</text>
        <text x={300} y={146} fontSize={11} textAnchor="middle" fill="#4d5768">E_b/A = {fmt(o.Ebn!, 2)} MeV</text>
        <text x={300} y={204} fontSize={11} textAnchor="middle" fill={o.Q! > 0 ? '#18443b' : '#b91c1c'}>{o.Q! > 0 ? `splitting releases ${fmt(o.Q!, 0)} MeV` : `splitting would need ${fmt(-o.Q!, 0)} MeV`}</text>
      </g>
    );
  },
  discover: [
    'Increase the mass number A. How does the radius change: in proportion to A, or more slowly?',
    'Change the mass defect per nucleon. Which readouts follow it?',
    'Raise the binding energy of the fragments above that of the parent. What happens to Q?',
  ],
  experiment: [
    'Multiply A by 8. By what factor does R change? Check the R against A graph.',
    'Keep ΔM/A fixed and double A: what happens to the total binding energy and to the binding energy per nucleon?',
    'Find the fragment binding energy at which Q becomes zero.',
  ],
  understand: [
    'R = R0 A^(1/3) with R0 = 1.2 fm: volume is proportional to A, so every nucleus has the same density.',
    'Binding energy E_b = ΔM c² = ΔM × 931.5 MeV per u of mass defect.',
    'The binding energy per nucleon E_b/A measures how tightly the nucleus is bound; it peaks near 8.8 MeV at A = 56.',
    'Energy is released when the products have a larger binding energy per nucleon than the starting nucleus (fission of heavy, fusion of light nuclei).',
  ],
  preds: [
    {
      id: 'p1', title: 'Eight times the nucleons', prompt: 'A nucleus of mass number 27 is compared with one of mass number 216 (8 times as many nucleons). How does the radius compare?',
      base: { A: 27 }, test: { A: 216 }, options: ['It doubles', 'It becomes 8 times as large', 'It becomes 4 times as large', 'It becomes 2.8 times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).R! / outs(base).R!, [2, 8, 4, 2.83]),
      why: ({ base, test, outs }) => `R ∝ A^(1/3) and 8^(1/3) = 2. R goes from ${fmt(outs(base).R!, 2)} fm to ${fmt(outs(test).R!, 2)} fm.`,
    },
    {
      id: 'p2', title: 'Twice the nucleons, same tightness', prompt: 'Two nuclei have the same binding energy per nucleon but one has twice the mass number (60 and 120). How do their total binding energies compare?',
      base: { A: 60 }, test: { A: 120 }, options: ['Equal', 'The larger one has twice the binding energy', 'The larger one has four times the binding energy', 'The larger one has half'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Eb! / outs(base).Eb!, [1, 2, 4, 0.5]),
      why: ({ base, test, outs }) => `E_b = (E_b/A) × A, so with the same E_b/A the total doubles: ${fmt(outs(base).Eb!, 0)} MeV becomes ${fmt(outs(test).Eb!, 0)} MeV.`,
    },
    {
      id: 'p3', title: 'Tighter fragments', prompt: 'A nucleus with A = 236 and E_b/A = 7.6 MeV splits into fragments bound at 8.0 MeV per nucleon, and in a second case at 8.6 MeV per nucleon. How does the energy released compare?',
      base: { A: 236, x: 0.0082, frag: 8 }, test: { A: 236, x: 0.0082, frag: 8.6 }, options: ['It is unchanged', 'It becomes about 2.6 times as large', 'It rises by only about 7%', 'It falls'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).Q! / outs(base).Q!; return r < 0.99 ? 3 : r < 1.01 ? 0 : r < 1.2 ? 2 : 1; },
      why: ({ base, test, outs }) => `Q = A (E_frag − E_bn): the gain per nucleon is the difference, not the fragment value itself. Q goes from ${fmt(outs(base).Q!, 0)} MeV to ${fmt(outs(test).Q!, 0)} MeV.`,
    },
    {
      id: 'p4', title: 'A more tightly bound parent', prompt: 'For A = 236 the mass defect per nucleon rises from 0.0075 u to 0.0085 u while the fragments stay at 8.5 MeV per nucleon. What happens to the energy released?',
      base: { A: 236, x: 0.0075, frag: 8.5 }, test: { A: 236, x: 0.0085, frag: 8.5 }, options: ['It rises', 'It falls', 'It stays the same', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).Q! / outs(base).Q!; return r < 0.99 ? 1 : r < 1.01 ? 2 : r > 1.8 ? 3 : 0; },
      why: ({ base, test, outs }) => `A parent that is already more tightly bound has less to gain: E_bn goes from ${fmt(outs(base).Ebn!, 2)} to ${fmt(outs(test).Ebn!, 2)} MeV, so Q falls from ${fmt(outs(base).Q!, 0)} MeV to ${fmt(outs(test).Q!, 0)} MeV.`,
    },
  ],
  measure: {
    instruction: 'Change only the mass number A and record the nuclear radius for at least three different values.',
    vary: 'A',
    record: ['R', 'm', 'Eb'],
    fit: {
      xLabel: 'A^(1/3)',
      yLabel: 'R (fm)',
      x: (v) => Math.cbrt(v.A!),
      y: (_v, o) => o.R!,
      interpret: (slope, intercept) => `R against A^(1/3) is a straight line through the origin (intercept ${fmt(intercept, 3)} fm), so R ∝ A^(1/3). The slope is the constant R0 = ${fmt(slope, 2)} fm (the lesson uses 1.2 fm). Equal density for all nuclei follows because volume ∝ R³ ∝ A.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Using R = 1.2 A^(1/3) fm, the radius of a copper-64 nucleus is', options: ['3.6 fm', '4.8 fm', '6.0 fm', '7.7 fm'], answer: 1,
      why: 'The cube root of 64 is 4, so R = 1.2 × 4 = 4.8 fm.',
      verify: () => near(radius(64), [3.6, 4.8, 6.0, 7.7]),
    },
    {
      id: 'q2', q: 'A nucleus has a mass defect of 0.020 u. Using 1 u = 931.5 MeV/c², its binding energy is about', options: ['37.3 MeV', '1.86 MeV', '18.6 MeV', '9.3 MeV'], answer: 2,
      why: 'E_b = ΔM × 931.5 = 0.020 × 931.5 = 18.6 MeV.',
      verify: () => near(0.02 * MEV_PER_U, [37.3, 1.86, 18.6, 9.3]),
    },
    {
      id: 'q3', q: 'A nucleus of mass number 40 has a total binding energy of 342 MeV. Its binding energy per nucleon is about', options: ['8.55 MeV', '342 MeV', '13.7 MeV', '4.28 MeV'], answer: 0,
      why: 'E_b/A = 342/40 = 8.55 MeV per nucleon.',
      verify: () => near(342 / 40, [8.55, 342, 13.7, 4.28]),
    },
    {
      id: 'q4', q: 'The mass numbers of two nuclei are 8 and 216. The ratio of their radii (larger to smaller) is', options: ['27', '3', '6', '9'], answer: 1,
      why: 'R ∝ A^(1/3), so the ratio is (216/8)^(1/3) = 27^(1/3) = 3.',
      verify: () => near(radius(216) / radius(8), [27, 3, 6, 9]),
    },
    {
      id: 'q5', q: 'In a nuclear reaction the total mass of the products is 0.0186 u less than the total mass of the reactants. The energy released is about', options: ['173 MeV', '8.65 MeV', '17.3 MeV', '1.73 MeV'], answer: 2,
      why: 'Q = Δm × 931.5 MeV/u = 0.0186 × 931.5 = 17.3 MeV.',
      verify: () => near(0.0186 * MEV_PER_U, [173, 8.65, 17.3, 1.73]),
    },
  ],
};
