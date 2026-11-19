/**
 * Chapter lab: Physics, Unit III, "Ampere's circuital law, the long straight wire, the solenoid and the force on a moving charge".
 * The model: B = μ0 I / 2πr for a long straight wire, B = μ0 n I inside a long solenoid, and a proton fired across that
 * solenoid field moving on a circle of radius r = mv/qB with period T = 2πm/qB. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU0 = 4 * Math.PI * 1e-7;
const MP = 1.67e-27;
const QE = 1.6e-19;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const bWire = (I: number, rcm: number) => (MU0 * I) / (2 * Math.PI * rcm * 1e-2); // tesla
const bSol = (n: number, I: number) => MU0 * n * I; // tesla
const radius = (v5: number, B: number) => (MP * v5 * 1e5) / (QE * B); // metre
const period = (B: number) => (2 * Math.PI * MP) / (QE * B); // second

export const spec: Spec = {
  id: 'phys-amperes-law',
  subject: 'Physics',
  lessonTitleStartsWith: "Ampere's circuital law",
  afterHeading: 'Field of an infinitely long straight wire',
  title: "Ampere's Law Lab: Wire, Solenoid and Moving Charge",
  format: 'Virtual experiment · graph exploration',
  blurb: 'Compare the field of a long straight wire (falling as 1/r) with the uniform field inside a solenoid (set by n and I), then fire a proton across the solenoid field and watch it circle with radius mv/qB.',
  can: ['See B around a wire fall as 1/r', 'Raise n or I and watch the solenoid field and the proton circle respond', 'Measure μ₀ from the slope of B against nI'],
  minutes: 12,
  vars: [
    { id: 'I', label: 'Current I', unit: 'A', min: 1, max: 20, step: 1, start: 5, digits: 0 },
    { id: 'r', label: 'Distance from the wire r', unit: 'cm', min: 1, max: 20, step: 1, start: 5, digits: 0 },
    { id: 'n', label: 'Solenoid turns per metre n', unit: 'turns/m', min: 500, max: 10000, step: 500, start: 5000, digits: 0 },
    { id: 'v', label: 'Proton speed v', unit: '×10⁵ m/s', min: 1, max: 10, step: 1, start: 2, digits: 0 },
  ],
  outs: [
    { id: 'Bw', label: 'Wire field B = μ₀I/2πr', unit: 'µT', fn: (v) => bWire(v.I!, v.r!) * 1e6, digits: 1 },
    { id: 'Bs', label: 'Solenoid field B = μ₀nI', unit: 'mT', fn: (v) => bSol(v.n!, v.I!) * 1e3, digits: 2 },
    { id: 'R', label: 'Proton circle radius R = mv/qB', unit: 'cm', fn: (v) => radius(v.v!, bSol(v.n!, v.I!)) * 100, digits: 2 },
    { id: 'T', label: 'Time for one circle T = 2πm/qB', unit: 'µs', fn: (v) => period(bSol(v.n!, v.I!)) * 1e6, digits: 3 },
  ],
  graphs: [
    { id: 'bw-r', title: 'Wire field against distance', x: 'r', y: 'Bw' },
    { id: 'bs-n', title: 'Solenoid field against turns per metre', x: 'n', y: 'Bs' },
    { id: 'r-v', title: 'Proton radius against speed', x: 'v', y: 'R' },
  ],
  sceneAlt: 'Left, the cross-section of a straight wire with a circular field line through the chosen distance. Right, the solenoid field into the page shown by crosses whose number grows with B, and a proton path whose radius follows the speed and the field.',
  scene: ({ v, o }) => {
    const wx = 95, wy = 105;
    const ring = 10 + v.r! * 4;
    const sx = 295, sy = 105;
    const nx = Math.max(3, Math.min(9, Math.round(o.Bs! / 8)));
    const Rpx = Math.max(6, Math.min(70, o.R! * 4));
    const arr = 6 + Math.min(22, o.Bw! / 4);
    return (
      <g>
        <circle cx={wx} cy={wy} r={ring} fill="none" stroke="#2563a8" strokeWidth={1.5} strokeDasharray="4 3" />
        <circle cx={wx} cy={wy} r={7} fill="#c45e42" />
        <text x={wx} y={wy + 4} fontSize={11} textAnchor="middle" fill="#fff">I</text>
        <path d={`M ${wx} ${wy - ring} h ${arr} m -6 -4 l 6 4 l -6 4`} stroke="#18443b" strokeWidth={2.4} fill="none" />
        <text x={wx} y={200} fontSize={11} textAnchor="middle" fill="#4d5768">B = {fmt(o.Bw!, 1)} µT at {v.r} cm</text>
        <rect x={sx - 85} y={sy - 85} width={170} height={170} fill="#f7f9fb" stroke="#cbd2dc" />
        {Array.from({ length: nx * nx }, (_, i) => {
          const gx = sx - 85 + ((i % nx) + 0.5) * (170 / nx);
          const gy = sy - 85 + (Math.floor(i / nx) + 0.5) * (170 / nx);
          return <text key={i} x={gx} y={gy + 3} fontSize={9} textAnchor="middle" fill="#2563a8">×</text>;
        })}
        <circle cx={sx} cy={sy} r={Rpx} fill="none" stroke="#c45e42" strokeWidth={2} />
        <circle cx={sx + Rpx} cy={sy} r={4} fill="#c45e42" />
        <text x={sx} y={sy + 98} fontSize={11} textAnchor="middle" fill="#4d5768">B = {fmt(o.Bs!, 2)} mT · R = {fmt(o.R!, 2)} cm</text>
        <text x={95} y={20} fontSize={11} textAnchor="middle" fill="#4d5768">Straight wire (out of the page)</text>
        <text x={295} y={14} fontSize={11} textAnchor="middle" fill="#4d5768">Proton in the solenoid field</text>
      </g>
    );
  },
  discover: [
    'Move the distance r from the wire. Watch the field circle and the readout: how does B change when r doubles?',
    'Raise the turns per metre n. The solenoid field and the proton radius both respond: which way?',
    'Raise the proton speed: does the radius change? Does the time for one circle change?',
  ],
  experiment: [
    'Double the distance from the wire. Compare B with its earlier value.',
    'Double the current. Which of the wire field, the solenoid field and the proton radius change, and how?',
    'Double the proton speed. Compare the radius and the period.',
  ],
  understand: [
    "Ampère's law ∮B·dl = μ₀I gives B = μ₀I/2πr outside a long wire: it falls as 1/r.",
    'Inside a long solenoid B = μ₀nI is uniform, set by turns per metre and current only.',
    'A charge moving perpendicular to B moves on a circle of radius R = mv/qB because the magnetic force does no work.',
    'The time for one circle T = 2πm/qB does not depend on the speed.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the distance from the wire', prompt: 'You move from 4 cm to 8 cm from a long straight wire carrying the same current. What happens to the field?',
      base: { r: 4 }, test: { r: 8 }, options: ['It halves', 'It falls to a quarter', 'It doubles', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).Bw! / outs(base).Bw!, [0.5, 0.25, 2, 1]),
      why: ({ base, test, outs }) => `B = μ₀I/2πr is proportional to 1/r. B goes from ${fmt(outs(base).Bw!, 1)} µT to ${fmt(outs(test).Bw!, 1)} µT.`,
    },
    {
      id: 'p2', title: 'Double the turns per metre', prompt: 'The turns per metre of the solenoid are doubled from 3000 to 6000 at the same current. What happens to the field inside?',
      base: { n: 3000 }, test: { n: 6000 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Bs! / outs(base).Bs!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `B = μ₀nI is proportional to n. B goes from ${fmt(outs(base).Bs!, 2)} mT to ${fmt(outs(test).Bs!, 2)} mT.`,
    },
    {
      id: 'p3', title: 'Double the proton speed', prompt: 'The proton speed is doubled from 2 × 10⁵ m/s to 4 × 10⁵ m/s in the same field. What happens to the radius of its circle?',
      base: { v: 2 }, test: { v: 4 }, options: ['It halves', 'It stays the same', 'It doubles', 'It becomes four times as large'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).R! / outs(base).R!, [0.5, 1, 2, 4]),
      why: ({ base, test, outs }) => `R = mv/qB is proportional to v. R goes from ${fmt(outs(base).R!, 2)} cm to ${fmt(outs(test).R!, 2)} cm.`,
    },
    {
      id: 'p4', title: 'Double the speed: time per circle', prompt: 'With the same speed change (2 to 4 × 10⁵ m/s), what happens to the time the proton takes for one full circle?',
      base: { v: 2 }, test: { v: 4 }, options: ['It doubles', 'It halves', 'It becomes four times as large', 'It stays the same'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).T! / outs(base).T!, [2, 0.5, 4, 1]),
      why: ({ base, test, outs }) => `A faster proton travels a bigger circle, in the same time: T = 2πm/qB does not contain v. T is ${fmt(outs(base).T!, 3)} µs before and ${fmt(outs(test).T!, 3)} µs after.`,
    },
  ],
  measure: {
    instruction: 'Keep n fixed and change the current I. Record the solenoid field B for at least three currents, then plot B (in tesla) against nI (in A/m).',
    vary: 'I',
    record: ['Bs', 'Bw'],
    fit: {
      xLabel: 'nI (A/m)',
      yLabel: 'B (tesla)',
      x: (v) => v.n! * v.I!,
      y: (_v, o) => o.Bs! * 1e-3,
      interpret: (slope) => `B against nI is a straight line through the origin because B = μ₀nI. The slope is μ₀ = ${fmt(slope * 1e7, 3)} × 10⁻⁷ T m/A (the accepted value is 4π × 10⁻⁷ = 12.57 × 10⁻⁷ T m/A).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A long straight wire carries a current of 25 A. The magnetic field at a distance of 10 cm from it is (μ₀ = 4π × 10⁻⁷ T m A⁻¹)', options: ['5 µT', '25 µT', '100 µT', '50 µT'], answer: 3,
      why: 'B = μ₀I/2πr = (2 × 10⁻⁷)(25)/0.10 = 5 × 10⁻⁵ T = 50 µT.',
      verify: () => near(bWire(25, 10) * 1e6, [5, 25, 100, 50]),
    },
    {
      id: 'q2', q: 'A long solenoid has 2000 turns spread uniformly over 0.50 m and carries 3.0 A. The field inside it is', options: ['15.1 mT', '7.5 mT', '1.5 mT', '30 mT'], answer: 0,
      why: 'n = 2000/0.50 = 4000 turns/m. B = μ₀nI = (4π × 10⁻⁷)(4000)(3.0) = 1.51 × 10⁻² T = 15.1 mT.',
      verify: () => near(bSol(4000, 3) * 1e3, [15.1, 7.5, 1.5, 30]),
    },
    {
      id: 'q3', q: 'A proton (m = 1.67 × 10⁻²⁷ kg) moves at 3 × 10⁶ m/s perpendicular to a uniform field of 0.50 T. The radius of its circular path is', options: ['0.63 cm', '3.1 cm', '63 cm', '6.3 cm'], answer: 3,
      why: 'R = mv/qB = (1.67 × 10⁻²⁷)(3 × 10⁶)/((1.6 × 10⁻¹⁹)(0.50)) = 0.0626 m ≈ 6.3 cm.',
      verify: () => near(((MP * 3e6) / (QE * 0.5)) * 100, [0.63, 3.1, 63, 6.3]),
    },
    {
      id: 'q4', q: 'A long straight wire carries a current I and the field at distance r is B. If the current is doubled and the distance is also doubled, the field becomes', options: ['B/2', '2B', 'B', '4B'], answer: 2,
      why: 'B ∝ I/r. Doubling both leaves I/r unchanged, so the field is still B.',
      verify: () => near(bWire(10, 8) / bWire(5, 4), [0.5, 2, 1, 4]),
    },
    {
      id: 'q5', q: 'A proton circles in a uniform magnetic field of 0.20 T. The time taken for one revolution is (m = 1.67 × 10⁻²⁷ kg, q = 1.6 × 10⁻¹⁹ C)', options: ['3.3 µs', '0.033 µs', '0.33 µs', '1.6 µs'], answer: 2,
      why: 'T = 2πm/qB = 2π(1.67 × 10⁻²⁷)/((1.6 × 10⁻¹⁹)(0.20)) = 3.28 × 10⁻⁷ s ≈ 0.33 µs, whatever the speed.',
      verify: () => near(period(0.2) * 1e6, [3.3, 0.033, 0.33, 1.6]),
    },
  ],
};
