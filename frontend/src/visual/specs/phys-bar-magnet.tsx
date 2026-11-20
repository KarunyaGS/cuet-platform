/**
 * Chapter lab: Physics, Unit III, "The bar magnet as a magnetic dipole".
 * The model: axial field (μ0/4π) 2mr/(r²−l²)², equatorial field (μ0/4π) m/(r²+l²)^(3/2), torque τ = mB sinθ and
 * potential energy U = −mB cosθ in a uniform field. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU4PI = 1e-7;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
// m in A m², r and l in cm -> tesla
const axial = (m: number, r: number, l: number) => (MU4PI * 2 * m * (r * 1e-2)) / ((r * 1e-2) ** 2 - (l * 1e-2) ** 2) ** 2;
const equat = (m: number, r: number, l: number) => (MU4PI * m) / ((r * 1e-2) ** 2 + (l * 1e-2) ** 2) ** 1.5;
const rad = (d: number) => (d * Math.PI) / 180;

export const spec: Spec = {
  id: 'phys-bar-magnet',
  subject: 'Physics',
  lessonTitleStartsWith: 'The bar magnet as a magnetic dipole',
  afterHeading: 'Field of a bar magnet on its axis',
  title: 'Bar Magnet Dipole Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Change the moment and length of a bar magnet and compare its field on the axis and on the equatorial line, then place it in a uniform field and watch the torque and the potential energy follow the angle.',
  can: ['See the axial field stay about twice the equatorial field and both fall as 1/r³', 'Turn the magnet in a uniform field and read torque and energy', 'Recover the magnetic moment from your own axial readings'],
  minutes: 12,
  vars: [
    { id: 'm', label: 'Magnetic moment m', unit: 'A m²', min: 0.5, max: 10, step: 0.5, start: 2, digits: 1 },
    { id: 'r', label: 'Distance from the centre r', unit: 'cm', min: 8, max: 40, step: 1, start: 20, digits: 0 },
    { id: 'l', label: 'Half-length l', unit: 'cm', min: 1, max: 5, step: 0.5, start: 2, digits: 1 },
    { id: 'B', label: 'Uniform field B', unit: 'mT', min: 1, max: 100, step: 1, start: 20, digits: 0 },
    { id: 'th', label: 'Angle θ between m and B', unit: '°', min: 0, max: 180, step: 5, start: 60, digits: 0, bounds: { min: 0, max: 180 } },
  ],
  outs: [
    { id: 'Bax', label: 'Axial field at r', unit: 'µT', fn: (v) => axial(v.m!, v.r!, v.l!) * 1e6, digits: 2 },
    { id: 'Beq', label: 'Equatorial field at r', unit: 'µT', fn: (v) => equat(v.m!, v.r!, v.l!) * 1e6, digits: 2 },
    { id: 'tau', label: 'Torque τ = mB sinθ', unit: 'mN m', fn: (v) => v.m! * v.B! * 1e-3 * Math.sin(rad(v.th!)) * 1e3, digits: 2 },
    { id: 'U', label: 'Potential energy U = −mB cosθ', unit: 'mJ', fn: (v) => -v.m! * v.B! * 1e-3 * Math.cos(rad(v.th!)) * 1e3, digits: 2 },
    { id: 'ratio', label: 'Axial ÷ equatorial field', unit: '', fn: (v) => axial(v.m!, v.r!, v.l!) / equat(v.m!, v.r!, v.l!), digits: 3 },
  ],
  graphs: [
    { id: 'bax-r', title: 'Axial field against distance', x: 'r', y: 'Bax' },
    { id: 'beq-r', title: 'Equatorial field against distance', x: 'r', y: 'Beq' },
    { id: 'tau-th', title: 'Torque against angle', x: 'th', y: 'tau' },
  ],
  sceneAlt: 'A bar magnet with its north pole red and south pole blue, whose length follows l. A point on the axis and a point on the equatorial line move with r and carry arrows sized by the field there. A small magnet at the bottom left turns to the chosen angle in a uniform field.',
  scene: ({ v, o }) => {
    const half = 8 + v.l! * 8;
    const cx = 215, cy = 100;
    const ax = cx + v.r! * 3.7;
    const ey = cy - v.r! * 2.1;
    const la = Math.min(70, 8 + Math.log10(1 + o.Bax!) * 22);
    const le = Math.min(70, 8 + Math.log10(1 + o.Beq!) * 22);
    const nx = 60, ny = 185;
    return (
      <g>
        <rect x={cx - half} y={cy - 11} width={half} height={22} fill="#2563a8" />
        <rect x={cx} y={cy - 11} width={half} height={22} fill="#c45e42" />
        <text x={cx - half / 2} y={cy + 4} fontSize={11} textAnchor="middle" fill="#fff">S</text>
        <text x={cx + half / 2} y={cy + 4} fontSize={11} textAnchor="middle" fill="#fff">N</text>
        <line x1={cx} y1={cy} x2={ax} y2={cy} stroke="#cbd2dc" strokeDasharray="3 3" />
        <line x1={cx} y1={cy} x2={cx} y2={ey} stroke="#cbd2dc" strokeDasharray="3 3" />
        <circle cx={ax} cy={cy} r={4} fill="#18443b" />
        <path d={`M ${ax} ${cy - 12} h ${la} m -6 -4 l 6 4 l -6 4`} stroke="#18443b" strokeWidth={2.2} fill="none" />
        <text x={ax} y={cy + 20} fontSize={10} textAnchor="middle" fill="#4d5768">axial {fmt(o.Bax!, 1)} µT</text>
        <circle cx={cx} cy={ey} r={4} fill="#18443b" />
        <path d={`M ${cx - 12} ${ey} h ${-le} m 6 -4 l -6 4 l 6 4`} stroke="#18443b" strokeWidth={2.2} fill="none" />
        <text x={cx + 8} y={ey + 3} fontSize={10} fill="#4d5768">equatorial {fmt(o.Beq!, 1)} µT</text>
        <line x1={nx - 45} y1={ny + 30} x2={nx + 45} y2={ny + 30} stroke="#9aa3b2" strokeWidth={1.2} />
        <path d={`M ${nx - 45} ${ny + 30} h 90 m -6 -4 l 6 4 l -6 4`} stroke="#9aa3b2" strokeWidth={1.2} fill="none" />
        <text x={nx + 50} y={ny + 34} fontSize={10} fill="#4d5768">B</text>
        <g transform={`translate(${nx} ${ny}) rotate(${-v.th!})`}>
          <rect x={-32} y={-6} width={32} height={12} fill="#2563a8" />
          <rect x={0} y={-6} width={32} height={12} fill="#c45e42" />
        </g>
        <text x={nx} y={ny - 22} fontSize={10} textAnchor="middle" fill="#4d5768">θ = {v.th}° · τ = {fmt(o.tau!, 1)} mN m</text>
      </g>
    );
  },
  discover: [
    'Drag the distance r and read the axial and equatorial fields. Which is larger, and by about what factor?',
    'Make the magnet shorter with l, and watch the ratio of the two fields.',
    'Turn the angle θ. Where is the torque largest, and where is the potential energy lowest?',
  ],
  experiment: [
    'Double r (keep l small). By what factor do both fields fall?',
    'Double the moment m. What happens to both fields and to the torque?',
    'Sweep θ from 0° to 180° and compare the torque graph with the sign of U.',
  ],
  understand: [
    'For a short magnet the axial field is (μ₀/4π)(2m/r³) and the equatorial field is (μ₀/4π)(m/r³): the ratio is 2 and both fall as 1/r³.',
    'The axial field points along m, the equatorial field opposite to m.',
    'In a uniform field the torque is τ = mB sinθ: zero at 0° (stable) and 180° (unstable), largest at 90°.',
    'The potential energy U = −mB cosθ runs from −mB (θ = 0°) to +mB (θ = 180°).',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the distance', prompt: 'You move from 20 cm to 40 cm from the centre of a short bar magnet (half-length 2 cm), along its axis. What happens to the axial field?',
      base: { r: 20 }, test: { r: 40 }, options: ['It halves', 'It falls to 1/4', 'It falls to 1/8', 'It falls to 1/16'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).Bax! / outs(base).Bax!, [0.5, 0.25, 0.125, 0.0625]),
      why: ({ base, test, outs }) => `The axial field of a short dipole is proportional to 1/r³. B goes from ${fmt(outs(base).Bax!, 2)} µT to ${fmt(outs(test).Bax!, 2)} µT, about one eighth.`,
    },
    {
      id: 'p2', title: 'Double the magnetic moment', prompt: 'The magnetic moment is doubled from 2 A m² to 4 A m² at the same distance. What happens to the equatorial field?',
      base: { m: 2 }, test: { m: 4 }, options: ['It halves', 'It stays the same', 'It becomes four times as large', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).Beq! / outs(base).Beq!, [0.5, 1, 4, 2]),
      why: ({ base, test, outs }) => `The field is proportional to m. B goes from ${fmt(outs(base).Beq!, 2)} µT to ${fmt(outs(test).Beq!, 2)} µT.`,
    },
    {
      id: 'p3', title: 'Turn from 30° to 90°', prompt: 'A magnet in a uniform field is turned from θ = 30° to θ = 90°. What happens to the torque on it?',
      base: { th: 30 }, test: { th: 90 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes zero'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).tau! / outs(base).tau!, [2, 0.5, 1, 0]),
      why: ({ base, test, outs }) => `τ = mB sinθ and sin 90° = 1 while sin 30° = 0.5. The torque goes from ${fmt(outs(base).tau!, 2)} mN m to ${fmt(outs(test).tau!, 2)} mN m.`,
    },
    {
      id: 'p4', title: 'Turn it right round', prompt: 'The magnet is turned from θ = 0° (along the field) to θ = 180° (against the field). What happens to its potential energy U = −mB cosθ?',
      base: { th: 0 }, test: { th: 180 }, options: ['It becomes zero', 'It reverses sign but keeps the same size', 'It doubles with the same sign', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).U! / outs(base).U!, [0, -1, 2, 0.5]),
      why: ({ base, test, outs }) => `U goes from ${fmt(outs(base).U!, 2)} mJ (stable) to ${fmt(outs(test).U!, 2)} mJ (unstable): same size, opposite sign, so the work needed is 2mB.`,
    },
  ],
  measure: {
    instruction: 'Keep m and l fixed and record the axial field for at least three different distances r. Plot B (tesla) against 2r/(r² − l²)² (in m⁻³).',
    vary: 'r',
    record: ['Bax', 'Beq'],
    fit: {
      xLabel: '2r/(r²−l²)² (m⁻³)',
      yLabel: 'B axial (tesla)',
      x: (v) => (2 * v.r! * 1e-2) / ((v.r! * 1e-2) ** 2 - (v.l! * 1e-2) ** 2) ** 2,
      y: (_v, o) => o.Bax! * 1e-6,
      interpret: (slope, _i, v) => `B = (μ₀/4π) m · 2r/(r² − l²)², so the line through the origin has slope (μ₀/4π)m = ${fmt(slope, 2, true)}. With μ₀/4π = 10⁻⁷ T m/A this gives m = slope ÷ 10⁻⁷ ≈ ${fmt(slope / 1e-7, 2)} A m² (you set ${v.m} A m²).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A short bar magnet has a magnetic moment of 4 A m². The field on its axis at 50 cm from the centre is (μ₀/4π = 10⁻⁷ T m A⁻¹)', options: ['3.2 µT', '6.4 µT', '12.8 µT', '1.6 µT'], answer: 1,
      why: 'B = (μ₀/4π)(2m/r³) = 10⁻⁷ × 2 × 4/(0.5)³ = 8 × 10⁻⁷/0.125 = 6.4 × 10⁻⁶ T.',
      verify: () => near(((MU4PI * 2 * 4) / 0.5 ** 3) * 1e6, [3.2, 6.4, 12.8, 1.6]),
    },
    {
      id: 'q2', q: 'A short magnet of moment 3 A m² is placed with its centre 40 cm from a point on its equatorial line. The field at that point is about', options: ['9.4 µT', '2.3 µT', '4.7 µT', '47 µT'], answer: 2,
      why: 'B = (μ₀/4π)(m/r³) = 10⁻⁷ × 3/(0.4)³ = 3 × 10⁻⁷/0.064 = 4.7 × 10⁻⁶ T, half the axial value at the same distance.',
      verify: () => near(((MU4PI * 3) / 0.4 ** 3) * 1e6, [9.4, 2.3, 4.7, 47]),
    },
    {
      id: 'q3', q: 'A bar magnet of moment 0.6 A m² is held at 30° to a uniform field of 0.25 T. The torque on it is', options: ['0.075 N m', '0.13 N m', '0.15 N m', '0.0375 N m'], answer: 0,
      why: 'τ = mB sinθ = 0.6 × 0.25 × sin 30° = 0.6 × 0.25 × 0.5 = 0.075 N m.',
      verify: () => near(0.6 * 0.25 * Math.sin(rad(30)), [0.075, 0.13, 0.15, 0.0375]),
    },
    {
      id: 'q4', q: 'A magnet of moment 0.5 A m² in a uniform field of 0.2 T is rotated from θ = 60° to θ = 180°. The work done by the external agent is', options: ['0.20 J', '0.10 J', '0.05 J', '0.15 J'], answer: 3,
      why: 'W = mB(cosθ₁ − cosθ₂) = 0.5 × 0.2 × (cos 60° − cos 180°) = 0.1 × (0.5 + 1) = 0.15 J.',
      verify: () => near(0.5 * 0.2 * (Math.cos(rad(60)) - Math.cos(rad(180))), [0.2, 0.1, 0.05, 0.15]),
    },
    {
      id: 'q5', q: 'A solenoid of 200 turns, area 5 cm² and current 2 A is equivalent to a bar magnet of moment', options: ['0.2 A m²', '2 A m²', '0.02 A m²', '0.4 A m²'], answer: 0,
      why: 'm = NIA = 200 × 2 × (5 × 10⁻⁴ m²) = 0.2 A m².',
      verify: () => near(200 * 2 * 5e-4, [0.2, 2, 0.02, 0.4]),
    },
  ],
};
