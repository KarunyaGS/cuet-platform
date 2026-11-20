/**
 * Chapter lab: Physics, Unit III, "Magnetic field, Oersted's experiment and the Biot–Savart law (circular current loop)".
 * The model: field on the axis of a coil B = μ0 N I R² / 2(R²+x²)^(3/2), at its centre μ0 N I / 2R, and at the centre of a semicircle μ0 I / 4R.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU0 = 4 * Math.PI * 1e-7;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
// I in A, R and x in cm, N turns -> tesla
const axisB = (N: number, I: number, R: number, x: number) => (MU0 * N * I * (R * 1e-2) ** 2) / (2 * ((R * 1e-2) ** 2 + (x * 1e-2) ** 2) ** 1.5);
const centreB = (N: number, I: number, R: number) => (MU0 * N * I) / (2 * R * 1e-2);

export const spec: Spec = {
  id: 'phys-biot-savart-law',
  subject: 'Physics',
  lessonTitleStartsWith: "Magnetic field, Oersted's experiment",
  afterHeading: 'Magnetic field on the axis of a circular current loop',
  title: 'Circular Current Loop Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Change the current, radius and turns of a circular coil and slide a point along its axis. See how the Biot–Savart field is strongest at the centre and falls as 1/x³ far away.',
  can: ['Slide along the axis and see B fall from its centre value', 'Compare centre fields of different radii and numbers of turns', 'Measure μ₀ from the slope of B against I'],
  minutes: 12,
  vars: [
    { id: 'I', label: 'Current I', unit: 'A', min: 1, max: 10, step: 0.5, start: 4, digits: 1 },
    { id: 'R', label: 'Coil radius R', unit: 'cm', min: 2, max: 15, step: 1, start: 5, digits: 0 },
    { id: 'x', label: 'Distance along the axis x', unit: 'cm', min: 0, max: 30, step: 1, start: 5, digits: 0 },
    { id: 'N', label: 'Number of turns N', unit: '', min: 1, max: 50, step: 1, start: 10, digits: 0, integer: true },
  ],
  outs: [
    { id: 'Bx', label: 'Field on the axis at x', unit: 'µT', fn: (v) => axisB(v.N!, v.I!, v.R!, v.x!) * 1e6, digits: 2 },
    { id: 'B0', label: 'Field at the centre, μ₀NI/2R', unit: 'µT', fn: (v) => centreB(v.N!, v.I!, v.R!) * 1e6, digits: 2 },
    { id: 'ratio', label: 'Field at x ÷ field at centre', unit: '', fn: (v) => axisB(v.N!, v.I!, v.R!, v.x!) / centreB(v.N!, v.I!, v.R!), digits: 3 },
    { id: 'Bsemi', label: 'Centre of a semicircle of this R, μ₀I/4R', unit: 'µT', fn: (v) => ((MU0 * v.I!) / (4 * v.R! * 1e-2)) * 1e6, digits: 2 },
  ],
  graphs: [
    { id: 'bx-x', title: 'Axis field against distance', x: 'x', y: 'Bx' },
    { id: 'bx-i', title: 'Axis field against current', x: 'I', y: 'Bx' },
    { id: 'b0-r', title: 'Centre field against radius', x: 'R', y: 'B0' },
  ],
  sceneAlt: 'A circular coil seen edge-on, with its radius, current direction and turns following the sliders. Arrows along the axis show the field at several distances, getting shorter away from the coil, and the chosen point is marked.',
  scene: ({ v, o }) => {
    const x0 = 60, cy = 115, sx = 7.5, sr = 5;
    const half = v.R! * sr;
    const turns = Math.min(6, Math.max(1, Math.round(v.N! / 8)));
    const pts = [0, 4, 8, 12, 16, 20, 25, 30];
    const maxB = axisB(v.N!, v.I!, v.R!, 0);
    return (
      <g>
        <line x1={x0 - 30} y1={cy} x2={x0 + 30 * sx + 10} y2={cy} stroke="#cbd2dc" strokeWidth={1.2} />
        {Array.from({ length: turns }, (_, i) => (
          <ellipse key={i} cx={x0 - 4 + i * 4} cy={cy} rx={7} ry={half} fill="none" stroke="#c45e42" strokeWidth={2.2} />
        ))}
        <path d={`M ${x0} ${cy - half} l -7 -2 m 7 2 l -2 7`} stroke="#c45e42" strokeWidth={1.6} fill="none" />
        {pts.map((p) => {
          const b = axisB(v.N!, v.I!, v.R!, p) / maxB;
          return <path key={p} d={`M ${x0 + p * sx} ${cy - 22} h ${Math.max(2, b * 46)} m -5 -3 l 5 3 l -5 3`} stroke="#2563a8" strokeWidth={1.6} fill="none" opacity={0.85} />;
        })}
        <circle cx={x0 + v.x! * sx} cy={cy} r={5} fill="#18443b" stroke="#fff" strokeWidth={1.5} />
        <text x={x0 + v.x! * sx} y={cy + 20} fontSize={11} textAnchor="middle" fill="#18443b">P</text>
        <text x={200} y={206} fontSize={12} textAnchor="middle" fill="#18443b">B(P) = {fmt(o.Bx!, 2)} µT · {fmt(o.ratio!, 3)} of the centre value</text>
        <text x={200} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">R = {v.R} cm · N = {v.N} · I = {v.I} A · x = {v.x} cm</text>
      </g>
    );
  },
  discover: [
    'Slide x from 0 outwards. The arrows along the axis shrink: where is the field largest?',
    'Change the radius R with x = 0. How does the centre field respond?',
    'Increase the number of turns N and the current I: which readouts change?',
  ],
  experiment: [
    'Double the current at fixed x. What happens to B at the point?',
    'Set x = R and compare the field with its centre value. Is it half?',
    'Put x well beyond the coil radius and double x: how many times smaller is B?',
  ],
  understand: [
    'From the Biot–Savart law the axis field of a coil is B = μ₀NIR²/2(R² + x²)^(3/2); it is strongest at the centre.',
    'At the centre B = μ₀NI/2R: proportional to N and I, inversely proportional to R.',
    'Far from the coil (x ≫ R) the field falls as 1/x³, like a dipole.',
    'At the centre of a semicircular arc the field is μ₀I/4R, half that of the full loop.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the current', prompt: 'The current in the coil is doubled from 3 A to 6 A. What happens to the field at the point on the axis?',
      base: { I: 3 }, test: { I: 6 }, options: ['It halves', 'It doubles', 'It becomes four times as large', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Bx! / outs(base).Bx!, [0.5, 2, 4, 1]),
      why: ({ base, test, outs }) => `B is proportional to I. B goes from ${fmt(outs(base).Bx!, 2)} µT to ${fmt(outs(test).Bx!, 2)} µT.`,
    },
    {
      id: 'p2', title: 'Double the radius', prompt: 'At the centre of the coil (x = 0) the radius is doubled from 4 cm to 8 cm, with the same current and turns. What happens to the field?',
      base: { x: 0, R: 4 }, test: { R: 8 }, options: ['It doubles', 'It becomes four times as large', 'It stays the same', 'It halves'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).Bx! / outs(base).Bx!, [2, 4, 1, 0.5]),
      why: ({ base, test, outs }) => `B = μ₀NI/2R at the centre is inversely proportional to R. B goes from ${fmt(outs(base).Bx!, 2)} µT to ${fmt(outs(test).Bx!, 2)} µT.`,
    },
    {
      id: 'p3', title: 'Move out to x = R', prompt: 'A point starts at the centre (x = 0) of a coil of radius 6 cm and moves along the axis to x = 6 cm. How does the field compare with the centre value?',
      base: { R: 6, x: 0 }, test: { x: 6 }, options: ['It halves', 'It falls to about 0.35 of the centre value', 'It falls to one quarter', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Bx! / outs(base).Bx!, [0.5, 0.354, 0.25, 1]),
      why: ({ base, test, outs }) => `B(x)/B(0) = (R²/(R² + x²))^(3/2) = 2^(−3/2) = 0.354 at x = R. B goes from ${fmt(outs(base).Bx!, 2)} µT to ${fmt(outs(test).Bx!, 2)} µT.`,
    },
    {
      id: 'p4', title: 'Double the number of turns', prompt: 'The number of turns of the coil is doubled from 10 to 20 (same I, R and x). What happens to the field on the axis?',
      base: { N: 10 }, test: { N: 20 }, options: ['It stays the same', 'It halves', 'It doubles', 'It becomes four times as large'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).Bx! / outs(base).Bx!, [1, 0.5, 2, 4]),
      why: ({ base, test, outs }) => `Each turn adds its own field, so B is proportional to N. B goes from ${fmt(outs(base).Bx!, 2)} µT to ${fmt(outs(test).Bx!, 2)} µT.`,
    },
  ],
  measure: {
    instruction: 'Keep the coil (R, N) and the point (x) fixed and change the current I. Record the axis field for at least three currents, then plot B (tesla) against I.',
    vary: 'I',
    record: ['Bx', 'B0'],
    fit: {
      xLabel: 'I (A)',
      yLabel: 'B on the axis (tesla)',
      x: (v) => v.I!,
      y: (_v, o) => o.Bx! * 1e-6,
      interpret: (slope, _i, v) => {
        const geom = (v.N! * (v.R! * 1e-2) ** 2) / (2 * ((v.R! * 1e-2) ** 2 + (v.x! * 1e-2) ** 2) ** 1.5);
        return `B against I is a straight line through the origin, because B = μ₀·[NR²/2(R²+x²)^(3/2)]·I. The slope is ${fmt(slope, 2, true)} T/A, and dividing by the geometry factor ${fmt(geom, 2)} m⁻¹ gives μ₀ ≈ ${fmt(slope / geom, 2, true)} T m/A (accepted 1.257 × 10^-6).`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'A circular coil of 20 turns and radius 8 cm carries 3 A. The magnetic field at its centre is (μ₀ = 4π × 10⁻⁷ T m A⁻¹)', options: ['235 µT', '942 µT', '471 µT', '47 µT'], answer: 2,
      why: 'B = μ₀NI/2R = (4π × 10⁻⁷)(20)(3)/(2 × 0.08) = 4.71 × 10⁻⁴ T = 471 µT.',
      verify: () => near(centreB(20, 3, 8) * 1e6, [235, 942, 471, 47]),
    },
    {
      id: 'q2', q: 'A single circular loop of radius 6 cm carries 5 A. The field on its axis at 8 cm from the centre is', options: ['11.3 µT', '52 µT', '5.7 µT', '32.7 µT'], answer: 0,
      why: 'B = μ₀IR²/2(R²+x²)^(3/2) = (4π × 10⁻⁷)(5)(0.06)²/(2 × (0.10)³) = 1.13 × 10⁻⁵ T = 11.3 µT.',
      verify: () => near(axisB(1, 5, 6, 8) * 1e6, [11.3, 52, 5.7, 32.7]),
    },
    {
      id: 'q3', q: 'A current of 4 A flows along a wire bent into a semicircle of radius 10 cm. The field at its centre is', options: ['25 µT', '6.3 µT', '3.1 µT', '12.6 µT'], answer: 3,
      why: 'For a semicircle B = μ₀I/4R = (4π × 10⁻⁷)(4)/(4 × 0.10) = 1.26 × 10⁻⁵ T = 12.6 µT.',
      verify: () => near(((MU0 * 4) / (4 * 0.1)) * 1e6, [25, 6.3, 3.1, 12.6]),
    },
    {
      id: 'q4', q: 'Far from a small circular loop (x much larger than its radius), the distance along the axis is doubled. The axial field becomes', options: ['1/2', '1/4', '1/16', '1/8'], answer: 3,
      why: 'For x ≫ R, B ≈ μ₀NIR²/2x³ ∝ 1/x³, so doubling x divides B by 2³ = 8.',
      verify: () => near(axisB(1, 1, 1, 100) / axisB(1, 1, 1, 50), [0.5, 0.25, 0.0625, 0.125]),
    },
    {
      id: 'q5', q: 'A wire carrying current I is first bent into one circular turn of radius R, then into two turns of radius R/2 with the same current. The field at the centre becomes', options: ['the same', '2 times as large', '4 times as large', '8 times as large'], answer: 2,
      why: 'B = μ₀NI/2R. N doubles and R halves, so B becomes 2 × 2 = 4 times as large.',
      verify: () => near(centreB(2, 1, 5) / centreB(1, 1, 10), [1, 2, 4, 8]),
    },
  ],
};
