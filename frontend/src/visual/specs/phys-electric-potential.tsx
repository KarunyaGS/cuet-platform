/**
 * Chapter lab: Physics, Unit I, "Electric potential, equipotential surfaces and electrostatic potential energy".
 * The model: V = kq/r from a point charge, superposition of a second charge on the same line (potentials add as signed numbers),
 * E = kq/r², W = q₀V, U = kq₁q₂/r₁₂. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const K = 9e9;
const D = 20; // distance between the two charges, cm
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
// q, q2 in nC; r in cm (distance of P from charge q along the line to q2, which is D cm from q)
const volts = (q: number, q2: number, r: number) => K * ((q * 1e-9) / (r * 1e-2) + (q2 * 1e-9) / ((D - r) * 1e-2));
const field = (q: number, q2: number, r: number) => K * ((q * 1e-9) / (r * 1e-2) ** 2 - (q2 * 1e-9) / ((D - r) * 1e-2) ** 2);

export const spec: Spec = {
  id: 'phys-electric-potential',
  subject: 'Physics',
  lessonTitleStartsWith: 'Electric potential, equipotential surfaces',
  afterHeading: 'Potential due to a point charge',
  title: 'Potential of Point Charges Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Place a point P on the line between two charges and see the potential add up as a signed number, the field fall faster than the potential, and the work to bring a test charge in from infinity.',
  can: ['See V fall as 1/r while E falls as 1/r²', 'Cancel the potential at a point with an equal and opposite charge', 'Measure the charge from the slope of V against 1/r'],
  minutes: 10,
  vars: [
    { id: 'q', label: 'Charge q (at the origin)', unit: 'nC', min: 1, max: 20, step: 1, start: 4, digits: 0 },
    { id: 'r', label: 'Distance of P from q', unit: 'cm', min: 2, max: 18, step: 1, start: 9, digits: 0 },
    { id: 'q0', label: 'Test charge q₀', unit: 'nC', min: 1, max: 10, step: 1, start: 2, digits: 0 },
    { id: 'q2', label: 'Second charge (fixed 20 cm from q)', unit: 'nC', min: -10, max: 10, step: 1, start: 0, digits: 0 },
  ],
  outs: [
    { id: 'V', label: 'Potential at P, V = Σ kq/r', unit: 'V', fn: (v) => volts(v.q!, v.q2!, v.r!), digits: 1 },
    { id: 'E', label: 'Field at P (along the line)', unit: 'V/m', fn: (v) => field(v.q!, v.q2!, v.r!), digits: 0 },
    { id: 'W', label: 'Work to bring q₀ from infinity, W = q₀V', unit: 'µJ', fn: (v) => v.q0! * 1e-9 * volts(v.q!, v.q2!, v.r!) * 1e6, digits: 3 },
    { id: 'U', label: 'Energy of the two charges, U = kq₁q₂/r₁₂', unit: 'µJ', fn: (v) => ((K * v.q! * v.q2! * 1e-18) / (D * 1e-2)) * 1e6, digits: 3 },
  ],
  graphs: [
    { id: 'v-r', title: 'Potential against distance', x: 'r', y: 'V' },
    { id: 'e-r', title: 'Field against distance', x: 'r', y: 'E' },
    { id: 'w-q0', title: 'Work against test charge', x: 'q0', y: 'W' },
  ],
  sceneAlt: 'Two charges on a line 20 cm apart with a point P between them. The charge circles grow with the charge, the dashed equipotential circle through P moves with the distance, and the green arrow shows the size and direction of the field at P.',
  scene: ({ v, o }) => {
    const x1 = 50, x2 = 350;
    const px = x1 + (v.r! / D) * (x2 - x1);
    const rad = (n: number) => 8 + Math.abs(n) * 1.6;
    const col = (n: number) => (n > 0 ? '#c45e42' : n < 0 ? '#2563a8' : '#9aa3b2');
    const arrow = Math.max(-110, Math.min(110, o.E! / 400));
    const s = arrow >= 0 ? 1 : -1;
    return (
      <g>
        <line x1={x1} y1={115} x2={x2} y2={115} stroke="#cbd2dc" strokeWidth={1.5} />
        <circle cx={x1} cy={115} r={Math.max(4, (v.r! / D) * (x2 - x1))} fill="none" stroke="#c45e42" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        <circle cx={x1} cy={115} r={rad(v.q!)} fill={col(v.q!)} />
        <text x={x1} y={119} fontSize={11} textAnchor="middle" fill="#fff">+</text>
        <circle cx={x2} cy={115} r={rad(v.q2!)} fill={col(v.q2!)} />
        <text x={x2} y={119} fontSize={11} textAnchor="middle" fill="#fff">{v.q2! > 0 ? '+' : v.q2! < 0 ? '−' : ''}</text>
        <circle cx={px} cy={115} r={5} fill="#18443b" stroke="#fff" strokeWidth={1.5} />
        <text x={px} y={100} fontSize={12} textAnchor="middle" fill="#18443b">P</text>
        <path d={`M ${px} 150 h ${arrow} m ${-6 * s} -4 l ${6 * s} 4 l ${-6 * s} 4`} stroke="#18443b" strokeWidth={2.5} fill="none" />
        <text x={px} y={172} fontSize={11} textAnchor="middle" fill="#4d5768">E = {fmt(o.E!, 0)} V/m</text>
        <text x={200} y={205} fontSize={12} textAnchor="middle" fill="#18443b">V(P) = {fmt(o.V!, 1)} V</text>
        <text x={200} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">r = {v.r} cm from q · {D - v.r!} cm from the second charge</text>
      </g>
    );
  },
  discover: [
    'Drag the distance r with the second charge at 0. The potential falls as you move away: by what factor when r doubles?',
    'Compare the two graphs: the field curve falls much faster than the potential curve.',
    'Set the second charge to a negative value and watch the potential at P: it is a signed sum, not a vector sum.',
  ],
  experiment: [
    'With the second charge at 0, double r. Compare the change in V with the change in E.',
    'Double the test charge q₀. Does V at P change? Does the work W change?',
    'Make the second charge equal and opposite to q and put P at the middle (r = 10 cm). What is V there? Is E also zero?',
  ],
  understand: [
    'V = kq/r for a point charge: it falls as 1/r, and it is a scalar, so the sign of q is kept.',
    'The field E = kq/r² falls faster (1/r²), and V = E × r for a single point charge.',
    'Potentials from several charges are added as ordinary signed numbers: V = Σ kqᵢ/rᵢ.',
    'The work to bring a charge q₀ from infinity is W = q₀V, and the energy of two charges is U = kq₁q₂/r₁₂.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the distance: potential', prompt: 'Only the charge q is present. Move P from 5 cm to 10 cm from it. What happens to the potential at P?',
      base: { q2: 0, r: 5 }, test: { r: 10 }, options: ['It halves', 'It doubles', 'It falls to a quarter', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).V! / outs(base).V!, [0.5, 2, 0.25, 1]),
      why: ({ base, test, outs }) => `V = kq/r is inversely proportional to r. V goes from ${fmt(outs(base).V!, 1)} V to ${fmt(outs(test).V!, 1)} V, half as much.`,
    },
    {
      id: 'p2', title: 'Double the distance: field', prompt: 'Only the charge q is present. Move P from 4 cm to 8 cm from it. What happens to the field at P?',
      base: { q2: 0, r: 4 }, test: { r: 8 }, options: ['It halves', 'It falls to a quarter', 'It doubles', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).E! / outs(base).E!, [0.5, 0.25, 2, 1]),
      why: ({ base, test, outs }) => `E = kq/r² falls as the square of the distance. E goes from ${fmt(outs(base).E!, 0)} V/m to ${fmt(outs(test).E!, 0)} V/m, one quarter.`,
    },
    {
      id: 'p3', title: 'Double the test charge', prompt: 'The test charge brought in from infinity is doubled from 2 nC to 4 nC, with P and the source unchanged. What happens to the work needed?',
      base: { q0: 2 }, test: { q0: 4 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).W! / outs(base).W!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `W = q₀V, and V at P belongs to P, not to the test charge. W goes from ${fmt(outs(base).W!, 3)} µJ to ${fmt(outs(test).W!, 3)} µJ.`,
    },
    {
      id: 'p4', title: 'Equal and opposite charges', prompt: 'P is exactly midway (r = 10 cm) between q = 4 nC and a second charge. The second charge is changed from 0 to −4 nC. What happens to the potential at P?',
      base: { q: 4, q2: 0, r: 10 }, test: { q2: -4 }, options: ['It doubles', 'It becomes zero', 'It halves', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).V! / outs(base).V!, [2, 0, 0.5, 1]),
      why: ({ base, test, outs }) => `Potentials add as signed numbers: +kq/r and −kq/r cancel. V goes from ${fmt(outs(base).V!, 1)} V to ${fmt(outs(test).V!, 1)} V, although the field at P is not zero (${fmt(outs(test).E!, 0)} V/m).`,
    },
  ],
  measure: {
    instruction: 'Set the second charge to 0 and keep q fixed. Record the potential at P for at least three different distances r, then plot V against 1/r.',
    vary: 'r',
    record: ['V', 'E'],
    fit: {
      xLabel: '1/r (m⁻¹)',
      yLabel: 'V (volt)',
      x: (v) => 1 / (v.r! * 1e-2),
      y: (_v, o) => o.V!,
      interpret: (slope, _i, v) => `For one point charge, V against 1/r is a straight line through the origin. The slope is kq = ${fmt(slope, 1)} V m, so q = slope ÷ k ≈ ${fmt((slope / K) * 1e9, 2)} nC (the charge you set is ${v.q} nC; keep the second charge at 0 for a clean line).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Find the potential at a point 30 cm from a point charge of +10 nC (k = 9 × 10⁹ N m² C⁻²).', options: ['100 V', '300 V', '900 V', '30 V'], answer: 1,
      why: 'V = kq/r = (9 × 10⁹)(10 × 10⁻⁹)/0.30 = 90/0.30 = 300 V.',
      verify: () => near((K * 10e-9) / 0.3, [100, 300, 900, 30]),
    },
    {
      id: 'q2', q: 'The potential at a point is 450 V and the field there is 1500 V/m. The point is at what distance from the single point charge producing them?', options: ['0.15 m', '0.45 m', '0.30 m', '3.0 m'], answer: 2,
      why: 'For a point charge V = E × r, so r = V/E = 450/1500 = 0.30 m.',
      verify: () => near(450 / 1500, [0.15, 0.45, 0.3, 3.0]),
    },
    {
      id: 'q3', q: 'Two point charges of +2 µC and +3 µC are 60 cm apart in air. The electrostatic potential energy of the pair is', options: ['0.9 J', '0.009 J', '0.054 J', '0.09 J'], answer: 3,
      why: 'U = kq₁q₂/r = (9 × 10⁹)(2 × 10⁻⁶)(3 × 10⁻⁶)/0.60 = 0.054/0.60 = 0.09 J, positive because the charges repel.',
      verify: () => near((K * 2e-6 * 3e-6) / 0.6, [0.9, 0.009, 0.054, 0.09]),
    },
    {
      id: 'q4', q: 'Charges +5 nC and −5 nC are 20 cm apart. The electric potential at the midpoint of the line joining them is', options: ['0 V', '900 V', '−900 V', '450 V'], answer: 0,
      why: 'Potentials add as scalars with sign: kq/r at 10 cm is +450 V and −450 V for the two charges, so V = 0 (while the field there is not zero).',
      verify: () => near(volts(5, -5, 10), [0, 900, -900, 450]),
    },
    {
      id: 'q5', q: 'How much work is needed to bring a charge of 5 µC from infinity to a point where the potential is 40 V?', options: ['8 µJ', '0.2 µJ', '200 µJ', '2 mJ'], answer: 2,
      why: 'W = qV = (5 × 10⁻⁶ C)(40 V) = 2 × 10⁻⁴ J = 200 µJ.',
      verify: () => near(5e-6 * 40 * 1e6, [8, 0.2, 200, 2000]),
    },
  ],
};
