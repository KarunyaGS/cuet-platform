/**
 * Chapter lab: Physics, Unit VI, "Proving the laws of reflection and refraction with Huygens' principle".
 * The model is the lesson's construction itself: A and C on the boundary, AC given; BC = AC sin i = v1 τ; the wavelet from A has radius AE = v2 τ (refraction)
 * or BC (reflection); sin r = AE/AC; sin i / sin r = v1/v2; AE ≥ AC means no tangent (total internal reflection); sin C = v1/v2. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec, Values } from '../engine/types';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

const BC = (v: Values) => v.AC! * Math.sin(rad(v.i!)); // cm
const tauPs = (v: Values) => (BC(v) * 1e-2) / (v.v1! * 1e8) * 1e12; // ps
const AE = (v: Values) => (v.v2! / v.v1!) * BC(v); // cm
const sinR = (v: Values) => AE(v) / v.AC!;

export const spec: Spec = {
  id: 'phys-huygens-proofs',
  subject: 'Physics',
  lessonTitleStartsWith: 'Proving the laws of reflection',
  afterHeading: "Proof of Snell's law of refraction",
  title: "Huygens' Construction Lab",
  format: 'Virtual experiment · graph exploration',
  blurb: "Build the Huygens construction yourself: choose the angle of incidence, the two wave speeds and the length AC. See BC, the time τ, the wavelet radius AE, the refracted wavefront CE, and total internal reflection when no tangent exists.",
  can: ['Watch AE = v₂τ and BC = v₁τ set the angle of refraction', 'See that reflection gives i = r and refraction gives sin i / sin r = v₁/v₂', 'Fit AE against BC to recover the speed ratio v₂/v₁'],
  minutes: 12,
  vars: [
    { id: 'i', label: 'Angle of incidence i', unit: '°', min: 5, max: 80, step: 1, start: 50, digits: 0 },
    { id: 'v1', label: 'Speed in medium 1, v₁', unit: '× 10⁸ m/s', min: 1, max: 3, step: 0.1, start: 3, digits: 1 },
    { id: 'v2', label: 'Speed in medium 2, v₂', unit: '× 10⁸ m/s', min: 1, max: 3, step: 0.1, start: 2, digits: 1 },
    { id: 'AC', label: 'Length AC along the boundary', unit: 'cm', min: 2, max: 10, step: 0.5, start: 6, digits: 1 },
  ],
  outs: [
    { id: 'BC', label: 'BC = AC sin i = v₁τ', unit: 'cm', fn: (v) => BC(v), digits: 2 },
    { id: 'tau', label: 'Time τ for the wave to go from B to C', unit: 'ps', fn: (v) => tauPs(v), digits: 1 },
    { id: 'AE', label: 'Wavelet radius AE = v₂τ (medium 2)', unit: 'cm', fn: (v) => AE(v), digits: 2 },
    { id: 'rr', label: 'Reflected angle (wavelet of radius BC in medium 1)', unit: '°', fn: (v) => deg(Math.asin(BC(v) / v.AC!)), digits: 1 },
    { id: 'r', label: 'Angle of refraction r (sin r = AE / AC)', unit: '°', fn: (v) => deg(Math.asin(Math.min(1, sinR(v)))), digits: 1 },
    { id: 'tir', label: 'Total internal reflection (1 if AE is not smaller than AC)', unit: '', fn: (v) => (sinR(v) >= 1 ? 1 : 0), digits: 0 },
    { id: 'crit', label: 'Critical angle sin C = v₁/v₂ (90 if v₂ ≤ v₁)', unit: '°', fn: (v) => (v.v2! > v.v1! ? deg(Math.asin(v.v1! / v.v2!)) : 90), digits: 1 },
    { id: 'ratio', label: 'sin i / sin r (= v₁/v₂ when refraction occurs)', unit: '', fn: (v) => Math.sin(rad(v.i!)) / Math.min(1, sinR(v)), digits: 3 },
  ],
  graphs: [
    { id: 'r-i', title: 'Angle of refraction against angle of incidence', x: 'i', y: 'r' },
    { id: 'ae-i', title: 'Wavelet radius AE against angle of incidence', x: 'i', y: 'AE' },
    { id: 'bc-ac', title: 'BC against the length AC', x: 'AC', y: 'BC' },
  ],
  sceneAlt: "The Huygens construction at a boundary between two media. The incident wavefront AB reaches the boundary at C a time τ after A, the wavelet from A has radius AE in the second medium, and the tangent from C to that wavelet is the refracted wavefront CE. A dashed wavelet in medium 1 gives the reflected wavefront. When AE reaches AC there is no tangent and the lab says total internal reflection.",
  scene: ({ v, o }) => {
    const s = 19;
    const Ax = 85;
    const Ay = 120;
    const Cx = Ax + v.AC! * s;
    const i = rad(v.i!);
    const BCpx = o.BC! * s;
    const Bx = Cx - BCpx * Math.sin(i);
    const By = Ay - BCpx * Math.cos(i);
    const AEpx = o.AE! * s;
    const r = rad(o.r!);
    const tir = o.tir! === 1;
    const Ex = Ax + AEpx * Math.sin(r);
    const Ey = Ay + AEpx * Math.cos(r);
    const Rx = Ax + BCpx * Math.sin(i);
    const Ry = Ay - BCpx * Math.cos(i);
    return (
      <g>
        <rect x={10} y={120} width={380} height={105} fill="#2563a8" opacity={0.07} />
        <line x1={10} y1={120} x2={390} y2={120} stroke="#4d5768" strokeWidth={1.4} />
        <text x={14} y={20} fontSize={10} fill="#4d5768">medium 1 (v₁ = {fmt(v.v1!, 1)} × 10⁸ m/s)</text>
        <text x={14} y={218} fontSize={10} fill="#2563a8">medium 2 (v₂ = {fmt(v.v2!, 1)} × 10⁸ m/s)</text>
        <path d={`M ${Ax - 28} ${Ay + 38} L ${Ax - 28} ${Ay - 80}`} stroke="#c9ced6" strokeDasharray="3 3" />
        <line x1={Ax} y1={Ay} x2={Bx} y2={By} stroke="#18443b" strokeWidth={2.4} />
        <line x1={Bx} y1={By} x2={Cx} y2={Ay} stroke="#18443b" strokeDasharray="4 3" />
        <path d={`M ${Bx + (Cx - Bx) * 0.55} ${By + (Ay - By) * 0.55} l ${-5} ${-4} m 5 4 l -6 3`} stroke="#18443b" fill="none" />
        <circle cx={Ax} cy={Ay} r={Math.min(AEpx, 400)} fill="none" stroke="#2563a8" strokeDasharray="5 3" clipPath="none" />
        <circle cx={Ax} cy={Ay} r={BCpx} fill="none" stroke="#c45e42" strokeDasharray="3 3" opacity={0.6} />
        <line x1={Cx} y1={Ay} x2={Rx} y2={Ry} stroke="#c45e42" strokeWidth={1.6} />
        {tir ? null : <line x1={Cx} y1={Ay} x2={Ex} y2={Ey} stroke="#2563a8" strokeWidth={2.4} />}
        <text x={Ax - 6} y={Ay + 12} fontSize={11} textAnchor="end" fill="#18443b">A</text>
        <text x={Cx + 4} y={Ay - 5} fontSize={11} fill="#18443b">C</text>
        <text x={Bx - 12} y={By - 3} fontSize={11} fill="#18443b">B</text>
        {tir ? null : <text x={Ex + 4} y={Ey + 10} fontSize={11} fill="#2563a8">E</text>}
        <text x={Rx + 4} y={Ry - 2} fontSize={11} fill="#c45e42">reflected E′</text>
        <text x={390} y={140} fontSize={11} textAnchor="end" fill={tir ? '#b91c1c' : '#18443b'}>{tir ? 'AE ≥ AC: no tangent, total internal reflection' : `i = ${v.i}° → r = ${fmt(o.r!, 1)}°`}</text>
      </g>
    );
  },
  discover: [
    'Increase the angle of incidence. Watch BC, τ and the wavelet radius AE: which ones grow?',
    'Set v₂ smaller than v₁ and then larger than v₁. Which way does the refracted wavefront turn?',
    'Make v₂ larger than v₁ and keep raising i until the construction fails. What is the angle called?',
  ],
  experiment: [
    'Keep i fixed and change AC. How do BC and AE change, and what stays constant?',
    'Compare the reflected angle with i for several values of i. What do you find?',
    'Compare sin i / sin r with v₁/v₂ for different speeds.',
  ],
  understand: [
    'In time τ the incident wavefront moves BC = v₁τ while the wavelet from A grows to AE = v₂τ in the second medium.',
    'sin i = BC/AC and sin r = AE/AC, so sin i / sin r = v₁/v₂ = n₂/n₁: this is Snell\'s law.',
    'For reflection the wavelet stays in medium 1 with radius BC, giving sin i = sin r and i = r.',
    'When v₂ > v₁ and AE would be larger than AC the tangent does not exist: total internal reflection, with sin C = v₁/v₂.',
  ],
  preds: [
    {
      id: 'p1', title: 'Reflection', prompt: 'In the reflection construction the angle of incidence is doubled from 20° to 40°. By what factor does the reflected angle change?',
      base: { i: 20 }, test: { i: 40 }, options: ['It doubles', 'It halves', 'It stays at 20°', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).rr! / outs(base).rr!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `The reflected wavelet has the same radius BC as the distance travelled by the incident wavefront, so the triangles are congruent and r = i. The reflected angle goes from ${fmt(outs(base).rr!, 1)}° to ${fmt(outs(test).rr!, 1)}°.`,
    },
    {
      id: 'p2', title: 'Into a slower medium', prompt: 'A wavefront in medium 1 (3.0 × 10⁸ m/s) meets medium 2 where the speed is 2.0 × 10⁸ m/s, at i = 60°. How does the refracted ray compare with the incident ray?',
      base: { i: 60, v1: 3, v2: 3 }, test: { i: 60, v1: 3, v2: 2 }, options: ['It bends away from the normal (r > i)', 'It bends towards the normal (r < i)', 'It does not bend (r = i)', 'It is totally reflected'], answer: 1,
      verify: ({ test, outs }) => (outs(test).tir! ? 3 : outs(test).r! > test.i! + 0.05 ? 0 : outs(test).r! < test.i! - 0.05 ? 1 : 2),
      why: ({ test, outs }) => `The wavelet from A grows only to AE = v₂τ, shorter than BC, so sin r = (v₂/v₁) sin i is smaller than sin i: r = ${fmt(outs(test).r!, 1)}° against i = 60°.`,
    },
    {
      id: 'p3', title: 'Into a faster medium', prompt: 'Light goes from a medium of speed 2.0 × 10⁸ m/s to one of 3.0 × 10⁸ m/s. The angle of incidence is raised from 30° to 50°. What happens at 50°?',
      base: { i: 30, v1: 2, v2: 3 }, test: { i: 50, v1: 2, v2: 3 }, options: ['The refracted ray moves a little further from the normal', 'No tangent can be drawn: total internal reflection', 'The refracted angle stays the same', 'The refracted angle falls'], answer: 1,
      verify: ({ test, outs }) => (outs(test).tir! ? 1 : outs(test).r! > outs({ ...test, i: 30 }).r! ? 0 : 2),
      why: ({ base, test, outs }) => `sin r = (v₂/v₁) sin i = 1.5 sin i. At 30° this is ${fmt(1.5 * Math.sin(rad(30)), 2)} (r = ${fmt(outs(base).r!, 1)}°); at 50° it would be ${fmt(1.5 * Math.sin(rad(50)), 2)}, more than 1, so AE is longer than AC and there is no tangent. The critical angle here is ${fmt(outs(test).crit!, 1)}°.`,
    },
    {
      id: 'p4', title: 'Double the speed in medium 2', prompt: 'At i = 40°, v₁ = 3.0 and AC fixed, the speed in medium 2 is doubled from 1.0 to 2.0 (× 10⁸ m/s). What happens to the wavelet radius AE?',
      base: { i: 40, v1: 3, v2: 1 }, test: { i: 40, v1: 3, v2: 2 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).AE! / outs(base).AE!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `AE = v₂τ and τ is fixed by v₁ and AC, so AE is proportional to v₂: ${fmt(outs(base).AE!, 2)} cm becomes ${fmt(outs(test).AE!, 2)} cm.`,
    },
  ],
  measure: {
    instruction: 'Keep the angle of incidence and the two speeds fixed (use v₂ smaller than v₁ so there is no total reflection). Change the length AC and record BC and AE for at least three values.',
    vary: 'AC',
    record: ['BC', 'tau', 'AE'],
    fit: {
      xLabel: 'BC (cm)',
      yLabel: 'AE (cm)',
      x: (_v, o) => o.BC!,
      y: (_v, o) => o.AE!,
      interpret: (slope, _i, v) => `AE against BC is a straight line through the origin, because both are proportional to τ. The slope is AE/BC = v₂/v₁ = ${fmt(slope, 3)}, so v₂ = slope × v₁ = ${fmt(slope * v.v1!, 2)} × 10⁸ m/s (you set ${fmt(v.v2!, 1)}). Equivalently sin i / sin r = 1/slope = ${fmt(1 / slope, 3)} = n₂/n₁.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'In the Huygens construction in air a wavefront strikes a surface with i = 45° and AC = 5.0 cm. The distance BC travelled by the incident wavefront is about', options: ['2.5 cm', '3.5 cm', '5.0 cm', '7.1 cm'], answer: 1,
      why: 'In right triangle ABC, BC = AC sin i = 5.0 × sin 45° = 5.0 × 0.707 = 3.5 cm.',
      verify: () => near(5 * Math.sin(rad(45)), [2.5, 3.5, 5, 7.1]),
    },
    {
      id: 'q2', q: 'For the situation in the previous question the time τ the wavefront takes to travel BC in air (c = 3.0 × 10⁸ m/s) is about', options: ['1.2 × 10⁻¹⁰ s', '1.2 × 10⁻⁹ s', '7.1 × 10⁻¹¹ s', '1.7 × 10⁻¹⁰ s'], answer: 0,
      why: 'τ = BC / v₁ = 3.5 × 10⁻² m / 3.0 × 10⁸ m/s = 1.2 × 10⁻¹⁰ s.',
      verify: () => near((5 * Math.sin(rad(45)) * 1e-2) / 3e8, [1.2e-10, 1.2e-9, 7.1e-11, 1.7e-10]),
    },
    {
      id: 'q3', q: 'Light travels from air (3.0 × 10⁸ m/s) into a medium where its speed is 2.0 × 10⁸ m/s, with i = 45°. The angle of refraction is about', options: ['45°', '35.3°', '28.1°', '19.5°'], answer: 2,
      why: 'sin r = (v₂/v₁) sin i = (2.0/3.0) × 0.707 = 0.471, so r = 28.1°.',
      verify: () => near(deg(Math.asin((2 / 3) * Math.sin(rad(45)))), [45, 35.3, 28.1, 19.5]),
    },
    {
      id: 'q4', q: 'Light in a medium where its speed is 1.8 × 10⁸ m/s meets a boundary with air (3.0 × 10⁸ m/s). The critical angle is about', options: ['53.1°', '41.8°', '60°', '36.9°'], answer: 3,
      why: 'sin C = v₁/v₂ = 1.8/3.0 = 0.60, so C = 36.9°. Beyond this angle AE would exceed AC and the light is totally reflected.',
      verify: () => near(deg(Math.asin(1.8 / 3)), [53.1, 41.8, 60, 36.9]),
    },
    {
      id: 'q5', q: 'In a refraction experiment sin i : sin r = 4 : 3 for light entering a medium from air. The speed of light in the medium is', options: ['2.25 × 10⁸ m/s', '4.0 × 10⁸ m/s', '1.5 × 10⁸ m/s', '3.0 × 10⁸ m/s'], answer: 0,
      why: 'sin i / sin r = v₁/v₂ = 4/3, so v₂ = v₁ × 3/4 = 3.0 × 10⁸ × 0.75 = 2.25 × 10⁸ m/s.',
      verify: () => near(3e8 * (3 / 4), [2.25e8, 4e8, 1.5e8, 3e8]),
    },
  ],
};
