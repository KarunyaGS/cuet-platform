/**
 * Chapter lab: Physics, Unit VI, "Wavefronts and Huygens' principle: reflection and refraction of plane waves".
 * The model: spherical wavefront radius r = vτ with v = c/n; plane wavefronts crossing a boundary: frequency unchanged, v = c/n, λ = λ1 n1/n2,
 * sin i / sin r = v1/v2 = n2/n1, and the spacing along the surface of the points where successive wavefronts arrive s = λ1/sin i = λ2/sin r. Status: Draft - unverified.
 */
import type { ReactNode } from 'react';
import { fmt } from '../engine/kit';
import type { Spec, Values } from '../engine/types';

const C = 3e8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

const sinR = (v: Values) => (v.n1! * Math.sin(rad(v.i!))) / v.n2!;
const lam2 = (v: Values) => (v.lam1! * v.n1!) / v.n2!;
const nuTHz = (v: Values) => (C / v.n1! / (v.lam1! * 1e-9)) / 1e12;

export const spec: Spec = {
  id: 'phys-wavefronts-huygens',
  subject: 'Physics',
  lessonTitleStartsWith: 'Wavefronts and Huygens',
  afterHeading: 'Refraction of plane waves at a plane surface using wavefronts',
  title: 'Wavefronts and Refraction Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Send plane wavefronts across a boundary between two media. See the wavefronts bunch up in the slower medium, the wavelength change while the frequency stays fixed, and the angle of refraction from Snell\'s law. A flashing lamp shows a spherical wavefront growing as vτ.',
  can: ['Watch the wavelength shrink by n₂/n₁ while the frequency stays the same', 'Read the angle of refraction from the bunched wavefronts', 'Fit sin r against sin i to recover the ratio n₁/n₂'],
  minutes: 11,
  vars: [
    { id: 'lam1', label: 'Wavelength in medium 1, λ₁', unit: 'nm', min: 300, max: 800, step: 10, start: 500, digits: 0 },
    { id: 'n1', label: 'Refractive index of medium 1, n₁', unit: '', min: 1, max: 2.5, step: 0.05, start: 1, digits: 2, bounds: { min: 1, max: 10 } },
    { id: 'n2', label: 'Refractive index of medium 2, n₂', unit: '', min: 1, max: 2.5, step: 0.05, start: 1.5, digits: 2, bounds: { min: 1, max: 10 } },
    { id: 'i', label: 'Angle of incidence i', unit: '°', min: 1, max: 85, step: 1, start: 45, digits: 0, bounds: { min: 0.1, max: 89.5 } },
    { id: 't', label: 'Time after the lamp flash in medium 1, τ', unit: 'ns', min: 1, max: 20, step: 1, start: 5, digits: 0 },
  ],
  outs: [
    { id: 'nu', label: 'Frequency of the wave (same in both media)', unit: 'THz', fn: (v) => nuTHz(v), digits: 1 },
    { id: 'v2', label: 'Speed in medium 2, v₂ = c / n₂', unit: '× 10⁸ m/s', fn: (v) => 3 / v.n2!, digits: 2 },
    { id: 'lam2', label: 'Wavelength in medium 2, λ₂ = λ₁ n₁ / n₂', unit: 'nm', fn: (v) => lam2(v), digits: 1 },
    { id: 'nu2', label: 'Frequency in medium 2 from v₂ / λ₂', unit: 'THz', fn: (v) => (C / v.n2! / (lam2(v) * 1e-9)) / 1e12, digits: 1 },
    { id: 'r', label: 'Angle of refraction r (sin r = n₁ sin i / n₂)', unit: '°', fn: (v) => deg(Math.asin(Math.min(1, sinR(v)))), digits: 1 },
    { id: 'tir', label: 'Total internal reflection (1 = yes)', unit: '', fn: (v) => (sinR(v) >= 1 ? 1 : 0), digits: 0 },
    { id: 'spacing', label: 'Spacing along the surface s = λ₁ / sin i', unit: 'nm', fn: (v) => v.lam1! / Math.sin(rad(v.i!)), digits: 0 },
    { id: 'R', label: 'Radius of the spherical wavefront R = (c/n₁) τ', unit: 'm', fn: (v) => (C / v.n1!) * v.t! * 1e-9, digits: 2 },
  ],
  graphs: [
    { id: 'r-i', title: 'Angle of refraction against angle of incidence', x: 'i', y: 'r' },
    { id: 'l2-n2', title: 'Wavelength in medium 2 against its refractive index', x: 'n2', y: 'lam2' },
    { id: 'r-t', title: 'Spherical wavefront radius against time', x: 't', y: 'R' },
  ],
  sceneAlt: 'Plane wavefronts, drawn as parallel lines, travelling from the upper medium into the lower medium across a horizontal boundary. The line spacing in each medium equals its wavelength, so the lines bunch up in the slower medium, the refracted wavefronts meet the boundary at the same points, and the lines turn towards the normal by Snell\'s law. A small inset shows concentric spherical wavefronts of a lamp growing with time.',
  scene: ({ v, o }) => {
    const Ox = 200;
    const Oy = 125;
    const i = rad(v.i!);
    const r = rad(o.r!);
    const px = 26 / 500; // px per nm
    const l1 = v.lam1! * px;
    const l2 = lam2(v) * px;
    const tir = o.tir! === 1;
    const lines1: ReactNode[] = [];
    const lines2: ReactNode[] = [];
    for (let k = -14; k <= 14; k++) {
      // medium 1: (p - O) . d1 = k l1, d1 = (sin i, cos i), direction along the line e1 = (cos i, -sin i)
      const cx = Ox + k * l1 * Math.sin(i);
      const cy = Oy + k * l1 * Math.cos(i);
      lines1.push(<line key={`a${k}`} x1={cx - 400 * Math.cos(i)} y1={cy + 400 * Math.sin(i)} x2={cx + 400 * Math.cos(i)} y2={cy - 400 * Math.sin(i)} stroke="#c45e42" strokeWidth={1.3} />);
      if (!tir) {
        const bx = Ox + (k * l1) / Math.sin(i);
        lines2.push(<line key={`b${k}`} x1={bx - 400 * Math.cos(r)} y1={Oy + 400 * Math.sin(r)} x2={bx + 400 * Math.cos(r)} y2={Oy - 400 * Math.sin(r)} stroke="#2563a8" strokeWidth={1.3} />);
      }
    }
    const rs = Math.min(40, o.R! * 6);
    return (
      <g>
        <clipPath id="hw-up"><rect x={0} y={5} width={400} height={Oy - 5} /></clipPath>
        <clipPath id="hw-down"><rect x={0} y={Oy} width={400} height={105} /></clipPath>
        <rect x={0} y={Oy} width={400} height={105} fill="#2563a8" opacity={0.07} />
        <g clipPath="url(#hw-up)">{lines1}</g>
        <g clipPath="url(#hw-down)">{lines2}</g>
        <line x1={0} y1={Oy} x2={400} y2={Oy} stroke="#4d5768" strokeWidth={1.4} />
        <path d={`M ${Ox} ${Oy - 70} V ${Oy + 70}`} stroke="#9aa3b2" strokeDasharray="3 3" />
        <rect x={6} y={8} width={110} height={26} fill="#fff" opacity={0.85} />
        <text x={10} y={20} fontSize={10} fill="#c45e42">medium 1: n₁ = {fmt(v.n1!, 2)}, λ₁ = {fmt(v.lam1!, 0)} nm</text>
        <rect x={6} y={203} width={150} height={20} fill="#fff" opacity={0.85} />
        <text x={10} y={217} fontSize={10} fill="#2563a8">medium 2: n₂ = {fmt(v.n2!, 2)}, λ₂ = {fmt(o.lam2!, 0)} nm</text>
        <rect x={290} y={6} width={104} height={80} fill="#fff" opacity={0.9} stroke="#c9ced6" />
        {[1, 2, 3].map((k) => <circle key={k} cx={342} cy={44} r={(rs * k) / 3} fill="none" stroke="#18443b" />)}
        <circle cx={342} cy={44} r={2} fill="#18443b" />
        <text x={342} y={82} fontSize={9} textAnchor="middle" fill="#18443b">R = {fmt(o.R!, 2)} m at {v.t} ns</text>
        <text x={394} y={140} fontSize={11} textAnchor="end" fill={tir ? '#b91c1c' : '#4d5768'}>{tir ? 'no refracted wavefront: total internal reflection' : `i = ${v.i}° → r = ${fmt(o.r!, 1)}°`}</text>
      </g>
    );
  },
  discover: [
    'Raise n₂. What happens to the spacing of the wavefronts in the lower medium and to the angle of refraction?',
    'Check the frequency readouts in the two media: does the frequency change when the wave crosses the boundary?',
    'Make n₂ smaller than n₁ and raise the angle of incidence. What happens to the lower wavefronts?',
  ],
  experiment: [
    'Keep n₁ and n₂ fixed and change i. Compare the spacing along the surface s on the incident side with λ₂ / sin r on the refracted side.',
    'Double n₂ at a fixed i. How do λ₂ and the angle of refraction change?',
    'Double the time after the flash. How does the radius of the spherical wavefront change?',
  ],
  understand: [
    'A wavefront is a surface of constant phase and the rays are perpendicular to it; by Huygens\' principle each point sends out secondary wavelets and the new wavefront is their forward envelope.',
    'On reflection the speed, frequency and wavelength are unchanged and the wavefront leaves at the same angle.',
    'On refraction the frequency is unchanged while v = c/n and λ = λ₁n₁/n₂ change together: wavefronts crowd closer in the slower medium.',
    'sin i / sin r = v₁/v₂ = n₂/n₁ follows because the points where the wavefronts meet the surface are the same on both sides.',
  ],
  preds: [
    {
      id: 'p1', title: 'Enter glass', prompt: 'A wave in a medium of index 1.0 passes into glass of index 1.5. What happens to its wavelength?',
      base: { n1: 1, n2: 1 }, test: { n1: 1, n2: 1.5 }, options: ['It is unchanged', 'It falls to two thirds', 'It becomes 1.5 times as long', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).lam2! / outs(base).lam2!, [1, 2 / 3, 1.5, 0.5]),
      why: ({ base, test, outs }) => `λ₂ = λ₁ n₁/n₂ = λ₁/1.5: ${fmt(outs(base).lam2!, 0)} nm becomes ${fmt(outs(test).lam2!, 0)} nm.`,
    },
    {
      id: 'p2', title: 'The frequency in glass', prompt: 'For the same wave, how does the frequency in glass (n = 1.5) compare with the frequency in the first medium (n = 1.0)?',
      base: { n1: 1, n2: 1 }, test: { n1: 1, n2: 1.5 }, options: ['It halves', 'It rises to 1.5 times', 'It is unchanged', 'It falls to two thirds'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).nu2! / outs(base).nu2!, [0.5, 1.5, 1, 2 / 3]),
      why: ({ base, test, outs }) => `Each wavelet oscillates at the frequency of the wave that started it. The frequency is ${fmt(outs(base).nu!, 1)} THz before and ${fmt(outs(test).nu2!, 1)} THz in the glass; speed and wavelength fall by the same factor.`,
    },
    {
      id: 'p3', title: 'Steeper incidence', prompt: 'The angle of incidence is raised from 30° to 60° with the media fixed. How does the spacing s along the surface of the points where successive wavefronts arrive change?',
      base: { i: 30 }, test: { i: 60 }, options: ['It rises to 1.7 times', 'It falls to 0.58 times', 'It is unchanged', 'It halves'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).spacing! / outs(base).spacing!, [1.732, 0.577, 1, 0.5]),
      why: ({ base, test, outs }) => `s = λ₁/sin i. Steeper incidence puts the wavefront nearer parallel to the surface, so successive wavefronts arrive closer together along it: ${fmt(outs(base).spacing!, 0)} nm becomes ${fmt(outs(test).spacing!, 0)} nm.`,
    },
    {
      id: 'p4', title: 'A flash in a denser medium', prompt: 'A lamp flashes briefly in air (n = 1) and again in a liquid of index 2. How do the radii of the spherical wavefronts compare after the same 5 ns?',
      base: { n1: 1, t: 5 }, test: { n1: 2, t: 5 }, options: ['The same', 'The radius in the liquid is half as large', 'The radius in the liquid is twice as large', 'The radius in the liquid is one quarter'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).R! / outs(base).R!, [1, 0.5, 2, 0.25]),
      why: ({ base, test, outs }) => `R = vτ with v = c/n. The radius is ${fmt(outs(base).R!, 2)} m in air and ${fmt(outs(test).R!, 2)} m in the liquid.`,
    },
  ],
  measure: {
    instruction: 'Keep n₁ = 1.0 and n₂ = 1.5 (a slower second medium). Change the angle of incidence and record the angle of refraction for at least three angles. The graph is sin r against sin i.',
    vary: 'i',
    record: ['r', 'spacing', 'lam2'],
    fit: {
      xLabel: 'sin i',
      yLabel: 'sin r',
      x: (v) => Math.sin(rad(v.i!)),
      y: (_v, o) => Math.sin(rad(o.r!)),
      interpret: (slope, _i, v) => `sin r against sin i is a straight line through the origin, so sin i / sin r is constant (Snell's law). The slope is n₁/n₂ = v₂/v₁ = ${fmt(slope, 3)}, so n₂/n₁ = 1/slope = ${fmt(1 / slope, 3)} (you set ${fmt(v.n2! / v.n1!, 3)}).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Red light of wavelength 650 nm in air enters water of refractive index 1.33. Its wavelength in water is about', options: ['865 nm', '489 nm', '650 nm', '367 nm'], answer: 1,
      why: 'The frequency is unchanged and the speed falls by n, so λ = 650/1.33 = 489 nm.',
      verify: () => near(650 / 1.33, [865, 489, 650, 367]),
    },
    {
      id: 'q2', q: 'The frequency of red light of wavelength 650 nm in air (c = 3.0 × 10⁸ m/s) is about', options: ['4.6 × 10¹⁴ Hz', '4.6 × 10¹⁵ Hz', '3.4 × 10¹⁴ Hz', '6.1 × 10¹⁴ Hz'], answer: 0,
      why: 'ν = c/λ = 3.0 × 10⁸ / 650 × 10⁻⁹ = 4.6 × 10¹⁴ Hz, and it is the same in every medium.',
      verify: () => near(C / 650e-9, [4.6e14, 4.6e15, 3.4e14, 6.1e14]),
    },
    {
      id: 'q3', q: 'A lamp flashes in a transparent medium of refractive index 1.5. The radius of the spherical wavefront 8.0 ns later is about', options: ['2.4 m', '1.6 m', '1.2 m', '0.8 m'], answer: 1,
      why: 'v = c/n = 2.0 × 10⁸ m/s, so R = vτ = 2.0 × 10⁸ × 8.0 × 10⁻⁹ = 1.6 m.',
      verify: () => near((C / 1.5) * 8e-9, [2.4, 1.6, 1.2, 0.8]),
    },
    {
      id: 'q4', q: 'Plane wavefronts in air strike glass of refractive index 1.6 with the rays at 30° to the normal. The refracted rays make an angle of about', options: ['30°', '48.6°', '24.1°', '18.2°'], answer: 3,
      why: 'sin r = sin i / n = 0.5/1.6 = 0.3125, so r = 18.2°. The refracted wavefronts make the same 18.2° with the surface.',
      verify: () => near(deg(Math.asin(Math.sin(rad(30)) / 1.6)), [30, 48.6, 24.1, 18.2]),
    },
    {
      id: 'q5', q: 'Plane wavefronts of wavelength 500 nm in air arrive at a surface with the rays at 45° to the normal. The spacing along the surface of the points where successive wavefronts arrive is about', options: ['500 nm', '1000 nm', '354 nm', '707 nm'], answer: 3,
      why: 'The wavefronts are λ apart perpendicular to themselves, so along the surface the spacing is λ / sin i = 500 / 0.707 = 707 nm.',
      verify: () => near(500 / Math.sin(rad(45)), [500, 1000, 354, 707]),
    },
  ],
};
