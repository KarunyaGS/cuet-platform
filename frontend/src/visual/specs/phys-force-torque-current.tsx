/**
 * Chapter lab: Physics, Unit III, "Forces on currents, the definition of the ampere, and the current loop as a magnetic dipole".
 * The model: F = B I l sinθ on a straight conductor (l = 20 cm), F/L = μ0 I1 I2 / 2πd between parallel wires, and
 * τ = N I A B sinθ with m = NIA for a coil (N = 20 turns, A = 25 cm²). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU0 = 4 * Math.PI * 1e-7;
const L_WIRE = 0.2; // m
const N_TURNS = 20;
const AREA = 25e-4; // m²
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const rad = (d: number) => (d * Math.PI) / 180;
const force = (B_mT: number, I: number, th: number) => B_mT * 1e-3 * I * L_WIRE * Math.sin(rad(th)); // N
const perLen = (I1: number, I2: number, dcm: number) => (MU0 * I1 * I2) / (2 * Math.PI * dcm * 1e-2); // N/m

export const spec: Spec = {
  id: 'phys-force-torque-current',
  subject: 'Physics',
  lessonTitleStartsWith: 'Forces on currents, the definition of the ampere',
  afterHeading: 'Force between two parallel current-carrying conductors',
  title: 'Forces on Currents Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Tilt a current-carrying wire in a magnetic field, bring two parallel wires closer, and turn a coil in the field. See the force, the force per metre and the torque follow the currents, the distance and the angle.',
  can: ['See F = BIl sinθ vanish when the wire lies along the field', 'Watch the force per metre between wires rise as 1/d', 'Recover μ₀ from your own force-per-length readings'],
  minutes: 12,
  vars: [
    { id: 'I1', label: 'Current I₁ (wire, wire 1, coil)', unit: 'A', min: 1, max: 20, step: 1, start: 10, digits: 0 },
    { id: 'I2', label: 'Current I₂ in the second wire', unit: 'A', min: 1, max: 20, step: 1, start: 10, digits: 0 },
    { id: 'd', label: 'Distance between the wires d', unit: 'cm', min: 1, max: 20, step: 1, start: 5, digits: 0 },
    { id: 'B', label: 'Magnetic field B', unit: 'mT', min: 10, max: 500, step: 10, start: 100, digits: 0 },
    { id: 'th', label: 'Angle θ (wire to B; coil normal to B)', unit: '°', min: 0, max: 90, step: 5, start: 90, digits: 0, bounds: { min: 0, max: 180 } },
  ],
  outs: [
    { id: 'F', label: 'Force on a 20 cm wire, F = BIl sinθ', unit: 'mN', fn: (v) => force(v.B!, v.I1!, v.th!) * 1e3, digits: 2 },
    { id: 'fl', label: 'Force per metre between the wires, μ₀I₁I₂/2πd', unit: 'µN/m', fn: (v) => perLen(v.I1!, v.I2!, v.d!) * 1e6, digits: 1 },
    { id: 'm', label: 'Coil moment m = NIA (20 turns, 25 cm²)', unit: 'A m²', fn: (v) => N_TURNS * v.I1! * AREA, digits: 3 },
    { id: 'tau', label: 'Coil torque τ = NIAB sinθ', unit: 'mN m', fn: (v) => N_TURNS * v.I1! * AREA * v.B! * 1e-3 * Math.sin(rad(v.th!)) * 1e3, digits: 2 },
  ],
  graphs: [
    { id: 'f-th', title: 'Force on the wire against angle', x: 'th', y: 'F' },
    { id: 'fl-d', title: 'Force per metre against separation', x: 'd', y: 'fl' },
    { id: 'tau-i', title: 'Coil torque against current', x: 'I1', y: 'tau' },
  ],
  sceneAlt: 'Three panels. Left, a wire tilted at angle theta to a horizontal field, with a force arrow perpendicular to the wire that shrinks as the wire lines up with the field. Middle, two parallel wires whose spacing and attraction arrows follow d and the currents. Right, a coil edge-on with its normal at angle theta to the field and a torque arc.',
  scene: ({ v, o }) => {
    const th = rad(v.th!);
    const fa = Math.min(45, o.F! * 0.9);
    const gap = 8 + v.d! * 3.6;
    const fl = Math.min(40, 4 + o.fl! / 180);
    return (
      <g>
        <text x={65} y={18} fontSize={10} textAnchor="middle" fill="#4d5768">Wire in a field</text>
        {[40, 75, 110].map((y) => <path key={y} d={`M 15 ${y} h 100 m -6 -3 l 6 3 l -6 3`} stroke="#9aa3b2" strokeWidth={1} fill="none" />)}
        <g transform="translate(65 110)">
          <line x1={-40 * Math.cos(th)} y1={40 * Math.sin(th)} x2={40 * Math.cos(th)} y2={-40 * Math.sin(th)} stroke="#c45e42" strokeWidth={4} />
          <path d={`M 0 0 L ${fa * Math.sin(th)} ${fa * Math.cos(th)} m ${-5} ${-4} l 5 4 l -5 4`} stroke="#18443b" strokeWidth={2.2} fill="none" />
        </g>
        <text x={65} y={190} fontSize={10} textAnchor="middle" fill="#4d5768">F = {fmt(o.F!, 1)} mN</text>
        <text x={200} y={18} fontSize={10} textAnchor="middle" fill="#4d5768">Parallel wires</text>
        <line x1={200 - gap / 2} y1={35} x2={200 - gap / 2} y2={175} stroke="#c45e42" strokeWidth={3} />
        <line x1={200 + gap / 2} y1={35} x2={200 + gap / 2} y2={175} stroke="#c45e42" strokeWidth={3} />
        <path d={`M ${200 - gap / 2 + 3} 105 h ${fl} m -5 -3 l 5 3 l -5 3`} stroke="#18443b" strokeWidth={2} fill="none" />
        <path d={`M ${200 + gap / 2 - 3} 105 h ${-fl} m 5 -3 l -5 3 l 5 3`} stroke="#18443b" strokeWidth={2} fill="none" />
        <text x={200} y={190} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.fl!, 0)} µN/m · d = {v.d} cm</text>
        <text x={335} y={18} fontSize={10} textAnchor="middle" fill="#4d5768">Coil in a field</text>
        <path d="M 290 110 h 90 m -6 -3 l 6 3 l -6 3" stroke="#9aa3b2" strokeWidth={1} fill="none" />
        <g transform={`translate(335 110) rotate(${-v.th! + 90})`}>
          <rect x={-5} y={-35} width={10} height={70} fill="#fbeee8" stroke="#c45e42" strokeWidth={2} />
        </g>
        <path d={`M 335 110 l ${Math.cos(th) * 40} ${-Math.sin(th) * 40}`} stroke="#18443b" strokeWidth={2} fill="none" />
        <text x={335} y={190} fontSize={10} textAnchor="middle" fill="#4d5768">τ = {fmt(o.tau!, 1)} mN m</text>
        <text x={200} y={222} fontSize={11} textAnchor="middle" fill="#4d5768">I₁ = {v.I1} A · I₂ = {v.I2} A · B = {v.B} mT · θ = {v.th}°</text>
      </g>
    );
  },
  discover: [
    'Drag θ to 0°: the wire lies along the field. What happens to the force and to the coil torque?',
    'Move the two wires closer with d. Watch the force per metre and its graph.',
    'Raise I₁: which readouts depend on it and which do not?',
  ],
  experiment: [
    'Keep θ at 90°. Double the field B: what happens to F and to the torque?',
    'Double I₁ and I₂ together. By what factor does the force per metre grow?',
    'Halve the distance d. Compare the force per metre with the earlier value.',
  ],
  understand: [
    'The force on a straight conductor in a uniform field is F = BIl sinθ: largest at 90°, zero along the field.',
    'Two parallel wires carrying currents in the same direction attract, with force per unit length μ₀I₁I₂/2πd.',
    'The ampere is defined from this: 1 A in two long wires 1 m apart gives 2 × 10⁻⁷ N per metre.',
    'A coil of N turns, area A and current I has moment m = NIA and feels torque τ = NIAB sinθ.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the current', prompt: 'The wire is perpendicular to the field (θ = 90°). The current in it is doubled from 5 A to 10 A. What happens to the force?',
      base: { I1: 5, th: 90 }, test: { I1: 10 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).F! / outs(base).F!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `F = BIl sinθ is proportional to I. F goes from ${fmt(outs(base).F!, 2)} mN to ${fmt(outs(test).F!, 2)} mN.`,
    },
    {
      id: 'p2', title: 'Tilt the wire', prompt: 'The wire is turned from 30° to 90° with the field, with the same current. What happens to the force?',
      base: { th: 30 }, test: { th: 90 }, options: ['It halves', 'It stays the same', 'It doubles', 'It becomes zero'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).F! / outs(base).F!, [0.5, 1, 2, 0]),
      why: ({ base, test, outs }) => `sin 90° = 1 and sin 30° = 0.5. F goes from ${fmt(outs(base).F!, 2)} mN to ${fmt(outs(test).F!, 2)} mN.`,
    },
    {
      id: 'p3', title: 'Move the wires apart', prompt: 'Two parallel wires carry fixed currents. The distance between them is doubled from 4 cm to 8 cm. What happens to the force per metre?',
      base: { d: 4 }, test: { d: 8 }, options: ['It doubles', 'It falls to a quarter', 'It halves', 'It stays the same'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).fl! / outs(base).fl!, [2, 0.25, 0.5, 1]),
      why: ({ base, test, outs }) => `F/L = μ₀I₁I₂/2πd is inversely proportional to d. It goes from ${fmt(outs(base).fl!, 1)} µN/m to ${fmt(outs(test).fl!, 1)} µN/m.`,
    },
    {
      id: 'p4', title: 'Double both currents', prompt: 'The currents in both parallel wires are doubled together, from 5 A to 10 A each. What happens to the force per metre?',
      base: { I1: 5, I2: 5 }, test: { I1: 10, I2: 10 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).fl! / outs(base).fl!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `F/L is proportional to the product I₁I₂, so doubling both gives 2 × 2 = 4 times the force. It goes from ${fmt(outs(base).fl!, 1)} µN/m to ${fmt(outs(test).fl!, 1)} µN/m.`,
    },
  ],
  measure: {
    instruction: 'Keep I₁ and I₂ fixed and change the distance d. Record the force per metre for at least three separations, then plot F/L (N/m) against 1/d (m⁻¹).',
    vary: 'd',
    record: ['fl', 'F'],
    fit: {
      xLabel: '1/d (m⁻¹)',
      yLabel: 'F/L (N/m)',
      x: (v) => 1 / (v.d! * 1e-2),
      y: (_v, o) => o.fl! * 1e-6,
      interpret: (slope, _i, v) => `F/L against 1/d is a straight line through the origin: slope = μ₀I₁I₂/2π = ${fmt(slope, 2, true)} N. So μ₀ = 2π × slope ÷ (I₁I₂) ≈ ${fmt((slope * 2 * Math.PI) / (v.I1! * v.I2!), 2, true)} T m/A (accepted 1.257 × 10^-6).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A 40 cm straight wire carries 12 A in a uniform field of 0.25 T, making an angle of 30° with the field. The force on it is', options: ['1.2 N', '0.6 N', '0.3 N', '2.4 N'], answer: 1,
      why: 'F = BIl sinθ = 0.25 × 12 × 0.40 × sin 30° = 0.25 × 12 × 0.40 × 0.5 = 0.6 N.',
      verify: () => near(0.25 * 12 * 0.4 * Math.sin(rad(30)), [1.2, 0.6, 0.3, 2.4]),
    },
    {
      id: 'q2', q: 'Two long parallel wires 5 cm apart carry 15 A and 10 A in the same direction. The force per metre between them is', options: ['6 × 10⁻⁴ N/m, attractive', '6 × 10⁻⁴ N/m, repulsive', '3 × 10⁻⁴ N/m, attractive', '1.2 × 10⁻³ N/m, repulsive'], answer: 0,
      why: 'F/L = μ₀I₁I₂/2πd = (2 × 10⁻⁷)(15)(10)/0.05 = 6 × 10⁻⁴ N/m. Currents in the same direction attract.',
      verify: () => (Math.abs(perLen(15, 10, 5) - 6e-4) < 1e-9 ? 0 : -1),
    },
    {
      id: 'q3', q: 'Two long straight parallel wires 0.5 m apart each carry 1 A. The force per metre of length between them is', options: ['2 × 10⁻⁷ N/m', '1 × 10⁻⁷ N/m', '4 × 10⁻⁷ N/m', '8 × 10⁻⁷ N/m'], answer: 2,
      why: 'F/L = μ₀I₁I₂/2πd = (2 × 10⁻⁷)(1)(1)/0.5 = 4 × 10⁻⁷ N/m. (At d = 1 m it would be the 2 × 10⁻⁷ N/m used to define the ampere.)',
      verify: () => near(perLen(1, 1, 50), [2e-7, 1e-7, 4e-7, 8e-7]),
    },
    {
      id: 'q4', q: 'A coil of 50 turns, each of area 4 cm², carries 2 A. Its plane is parallel to a uniform field of 0.5 T. The torque on it is', options: ['0.04 N m', '0.01 N m', '0 N m', '0.02 N m'], answer: 3,
      why: 'With the plane parallel to the field the normal is at 90° to B, so τ = NIAB sin90° = 50 × 2 × (4 × 10⁻⁴) × 0.5 = 0.02 N m.',
      verify: () => near(50 * 2 * 4e-4 * 0.5 * Math.sin(rad(90)), [0.04, 0.01, 0, 0.02]),
    },
    {
      id: 'q5', q: 'A coil of 100 turns and area 20 cm² carries 0.5 A. Its magnetic dipole moment is', options: ['0.1 A m²', '1 A m²', '0.01 A m²', '0.2 A m²'], answer: 0,
      why: 'm = NIA = 100 × 0.5 × (20 × 10⁻⁴) = 0.1 A m².',
      verify: () => near(100 * 0.5 * 20e-4, [0.1, 1, 0.01, 0.2]),
    },
  ],
};
