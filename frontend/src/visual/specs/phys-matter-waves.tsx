/**
 * Chapter lab: Physics, Unit VII, "Matter waves and the de Broglie relation".
 * The model: λ = h/p with p = √(2mK) and K = qV for a particle accelerated from rest through V (non-relativistic). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const H = 6.63e-34;
const E = 1.6e-19;
const ME = 9.1e-31;

const momentum = (mr: number, q: number, V: number) => Math.sqrt(2 * mr * ME * q * E * V); // kg m/s
const lambdaNm = (mr: number, q: number, V: number) => (H / momentum(mr, q, V)) * 1e9;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-matter-waves',
  subject: 'Physics',
  lessonTitleStartsWith: 'Matter waves and the de Broglie',
  afterHeading: 'de Broglie wavelength of an electron accelerated through a potential difference',
  title: 'de Broglie Wavelength Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Accelerate an electron, a proton or an alpha-like particle through a voltage and see its de Broglie wavelength, momentum and speed, and whether the wave is comparable to the atomic spacing of a crystal.',
  can: ['Raise the voltage fourfold and see the wavelength halve', 'Swap an electron for a heavier particle and see the wavelength collapse', 'Fit λ against 1/√V to recover h from your own readings'],
  minutes: 10,
  vars: [
    { id: 'V', label: 'Accelerating voltage V', unit: 'V', min: 10, max: 5000, step: 1, start: 100, log: true, digits: 0 },
    { id: 'mr', label: 'Mass of the particle in electron masses (m / mₑ)', unit: '', min: 1, max: 8000, step: 1, start: 1, log: true, digits: 0 },
    { id: 'q', label: 'Charge of the particle (in units of e)', unit: 'e', min: 1, max: 2, step: 1, start: 1, digits: 0, choice: true },
    { id: 'd', label: 'Atomic spacing of the crystal d', unit: 'Å', min: 0.5, max: 5, step: 0.1, start: 2, digits: 1 },
  ],
  outs: [
    { id: 'lam', label: 'de Broglie wavelength λ = h / p', unit: 'nm', fn: (v) => lambdaNm(v.mr!, v.q!, v.V!), digits: 4 },
    { id: 'p', label: 'Momentum p = √(2mqV)', unit: '× 10⁻²⁴ kg m/s', fn: (v) => momentum(v.mr!, v.q!, v.V!) * 1e24, digits: 3 },
    { id: 'v', label: 'Speed v = p / m', unit: '× 10⁶ m/s', fn: (v) => (momentum(v.mr!, v.q!, v.V!) / (v.mr! * ME)) / 1e6, digits: 3 },
    { id: 'K', label: 'Kinetic energy K = qV', unit: 'eV', fn: (v) => v.q! * v.V!, digits: 0 },
    { id: 'ratio', label: 'Wavelength divided by the atomic spacing (λ / d)', unit: '', fn: (v) => (lambdaNm(v.mr!, v.q!, v.V!) * 10) / v.d!, digits: 3 },
  ],
  graphs: [
    { id: 'lam-v', title: 'Wavelength against accelerating voltage', x: 'V', y: 'lam', logX: true, logY: true },
    { id: 'lam-m', title: 'Wavelength against particle mass', x: 'mr', y: 'lam', logX: true, logY: true },
    { id: 'ratio-d', title: 'λ / d against atomic spacing', x: 'd', y: 'ratio' },
  ],
  sceneAlt: 'A row of crystal atoms spaced by the chosen atomic spacing, and below it a matter wave whose wavelength is drawn to the same scale. When the wave is as long as the spacing the two rows look alike; for a heavy particle the wave becomes too fine to see.',
  scene: ({ v, o }) => {
    const sx = 28; // px per ångström
    const spacing = v.d! * sx;
    const lamPx = Math.max(2.5, Math.min(320, o.lam! * 10 * sx));
    const n = Math.floor(340 / spacing);
    const pts: string[] = [];
    for (let x = 0; x <= 340; x += 1.5) pts.push(`${(30 + x).toFixed(1)},${(150 - 30 * Math.sin((2 * Math.PI * x) / lamPx)).toFixed(1)}`);
    return (
      <g>
        <text x={30} y={22} fontSize={11} fill="#4d5768">crystal atoms, spacing d = {fmt(v.d!, 1)} Å</text>
        {Array.from({ length: n + 1 }, (_, i) => <circle key={i} cx={30 + i * spacing} cy={50} r={Math.min(9, spacing / 3)} fill="#18443b" opacity={0.8} />)}
        <path d={`M 30 74 H ${30 + spacing}`} stroke="#18443b" strokeWidth={2} />
        <text x={30 + spacing + 6} y={78} fontSize={10} fill="#18443b">d</text>
        <text x={30} y={108} fontSize={11} fill="#4d5768">matter wave of the particle, λ = {fmt(o.lam!, 4)} nm ({fmt(o.lam! * 10, 3)} Å)</text>
        <polyline points={pts.join(' ')} fill="none" stroke="#c45e42" strokeWidth={1.6} />
        <path d={`M 30 190 H ${30 + Math.min(340, lamPx)}`} stroke="#c45e42" strokeWidth={2} />
        <text x={30} y={208} fontSize={10} fill="#c45e42">one wavelength</text>
        <text x={200} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">λ/d = {fmt(o.ratio!, 3)}: {o.ratio! > 0.2 ? 'wave nature can be seen' : 'wave far too short to notice'}</text>
      </g>
    );
  },
  discover: [
    'Drag the voltage up. Does the wavelength grow or shrink, and how fast?',
    'Make the particle heavier (a proton is about 1836 electron masses). What happens to λ at the same voltage?',
    'Narrow the atomic spacing. When does the matter wave become comparable to d?',
  ],
  experiment: [
    'Quadruple the voltage (100 V to 400 V). By what factor does λ change? Check the log-log graph: what is its slope?',
    'Keep the voltage fixed and change the mass. Which power of m does λ follow?',
    'Change the charge from 1e to 2e at the same voltage. How does λ change?',
  ],
  understand: [
    'λ = h/p is the de Broglie relation: a moving particle has a wavelength set only by its momentum.',
    'For a particle accelerated from rest through V, K = qV and p = √(2mqV), so λ = h/√(2mqV): λ ∝ 1/√V.',
    'For an electron, λ ≈ 1.227/√V nm (V in volts): about 0.12 nm at 100 V, close to atomic spacings.',
    'Heavier particles have much shorter wavelengths, so their wave nature is not noticed.',
  ],
  preds: [
    {
      id: 'p1', title: 'Four times the voltage', prompt: 'An electron is accelerated through 100 V and then through 400 V. How does its de Broglie wavelength change?',
      base: { V: 100 }, test: { V: 400 }, options: ['It halves', 'It doubles', 'It becomes one quarter', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).lam! / outs(base).lam!, [0.5, 2, 0.25, 1]),
      why: ({ base, test, outs }) => `λ ∝ 1/√V, so four times the voltage gives half the wavelength: ${fmt(outs(base).lam!, 4)} nm becomes ${fmt(outs(test).lam!, 4)} nm.`,
    },
    {
      id: 'p2', title: 'A proton instead of an electron', prompt: 'A proton (about 1836 times heavier than an electron, same charge) is accelerated through the same voltage as an electron. How does its wavelength compare?',
      base: { mr: 1, V: 100 }, test: { mr: 1836, V: 100 }, options: ['The same', 'About 1/1836 of it', 'About 1/43 of it', 'About 43 times longer'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).lam! / outs(base).lam!, [1, 1 / 1836, 1 / 42.85, 42.85]),
      why: ({ base, test, outs }) => `Same kinetic energy qV, but p = √(2mK) grows as √m, so λ falls as 1/√m: √1836 ≈ 43. λ goes from ${fmt(outs(base).lam!, 4)} nm to ${fmt(outs(test).lam!, 5)} nm.`,
    },
    {
      id: 'p3', title: 'Double the charge', prompt: 'Two particles have the same mass and are accelerated through the same voltage, but the second has twice the charge. How does its wavelength compare?',
      base: { q: 1 }, test: { q: 2 }, options: ['It is twice as long', 'It is half as long', 'It is about 0.71 times as long', 'It is the same'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).lam! / outs(base).lam!, [2, 0.5, 0.7071, 1]),
      why: ({ base, test, outs }) => `K = qV doubles, p = √(2mK) grows by √2, so λ falls by √2. λ goes from ${fmt(outs(base).lam!, 4)} nm to ${fmt(outs(test).lam!, 4)} nm.`,
    },
    {
      id: 'p4', title: 'A tighter crystal', prompt: 'The crystal spacing is halved (4 Å to 2 Å) while the electron beam is unchanged. What happens to the ratio λ / d?',
      base: { d: 4 }, test: { d: 2 }, options: ['It halves', 'It doubles, so the wave nature is easier to see', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).ratio! / outs(base).ratio!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `λ depends only on momentum, so it does not change; d halves, so λ/d doubles, from ${fmt(outs(base).ratio!, 3)} to ${fmt(outs(test).ratio!, 3)}.`,
    },
  ],
  measure: {
    instruction: 'Use an electron (mass 1, charge 1). Record the de Broglie wavelength at three or more accelerating voltages.',
    vary: 'V',
    record: ['lam', 'p', 'K'],
    fit: {
      xLabel: '1/√V (V^-1/2)',
      yLabel: 'λ (nm)',
      x: (v) => 1 / Math.sqrt(v.V!),
      y: (_v, o) => o.lam!,
      interpret: (slope, _i, v) => `λ against 1/√V is a straight line through the origin, so λ ∝ 1/√V. The slope is h/√(2mq) = ${fmt(slope, 3)} nm V^½ (for an electron the lesson quotes 1.227 nm V^½). Then h = slope × √(2mqe) ≈ ${fmt(slope * 1e-9 * Math.sqrt(2 * v.mr! * ME * v.q! * E), 2, true)} J s.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'An electron is accelerated from rest through 400 V. Its de Broglie wavelength is about (use λ = 1.227/√V nm)', options: ['0.0307 nm', '0.0614 nm', '0.123 nm', '0.614 nm'], answer: 1,
      why: 'λ = 1.227/√400 = 1.227/20 = 0.0614 nm.',
      verify: () => near(lambdaNm(1, 1, 400), [0.0307, 0.0614, 0.123, 0.614]),
    },
    {
      id: 'q2', q: 'A proton and an alpha particle (mass 4 times and charge 2 times that of a proton) are accelerated through the same potential difference. The ratio λ(proton) / λ(alpha) is', options: ['1.41', '4', '8', '2.83'], answer: 3,
      why: 'λ = h/√(2mqV), so λ ∝ 1/√(mq). The ratio is √(4 × 2) = √8 = 2.83.',
      verify: () => near(lambdaNm(1, 1, 100) / lambdaNm(4, 2, 100), [1.41, 4, 8, 2.83]),
    },
    {
      id: 'q3', q: 'A ball of mass 0.050 kg moves at 40 m/s. Its de Broglie wavelength is about (h = 6.63 × 10⁻³⁴ J s)', options: ['3.3 × 10⁻³⁴ m', '3.3 × 10⁻³¹ m', '1.7 × 10⁻³⁴ m', '6.6 × 10⁻³⁴ m'], answer: 0,
      why: 'p = mv = 0.050 × 40 = 2.0 kg m/s. λ = h/p = 6.63 × 10⁻³⁴/2.0 = 3.3 × 10⁻³⁴ m, far too small to observe.',
      verify: () => near(H / (0.05 * 40), [3.3e-34, 3.3e-31, 1.7e-34, 6.6e-34]),
    },
    {
      id: 'q4', q: 'To give an electron a de Broglie wavelength of 0.20 nm it must be accelerated, from rest, through about', options: ['75 V', '37.6 V', '150 V', '18.8 V'], answer: 1,
      why: 'λ = 1.227/√V nm, so √V = 1.227/0.20 = 6.14 and V = 37.6 V.',
      verify: () => near((H * H) / (2 * ME * E * (0.2e-9) ** 2), [75, 37.6, 150, 18.8]),
    },
    {
      id: 'q5', q: 'A photon and an electron both have a wavelength of 0.50 nm. The momentum of each is about', options: ['2.7 × 10⁻²⁴ kg m/s', '6.6 × 10⁻²⁵ kg m/s', '1.3 × 10⁻²⁴ kg m/s', '1.3 × 10⁻²⁷ kg m/s'], answer: 2,
      why: 'For both, p = h/λ = 6.63 × 10⁻³⁴ / 0.50 × 10⁻⁹ = 1.3 × 10⁻²⁴ kg m/s. Equal wavelength means equal momentum, though not equal energy.',
      verify: () => near(H / 0.5e-9, [2.7e-24, 6.6e-25, 1.3e-24, 1.3e-27]),
    },
  ],
};
