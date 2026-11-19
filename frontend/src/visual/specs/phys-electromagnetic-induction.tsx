/**
 * Chapter lab: Physics, Unit IV, "Electromagnetic induction: Faraday's laws, Lenz's law, self and mutual induction".
 * The model: a rod of length l sliding at speed v on rails closed by a resistor R in a field B whose normal makes angle θ with the loop.
 * Flux Φ = B l x cosθ, so ε = dΦ/dt = B l v cosθ (Faraday), I = ε/R, the opposing force (Lenz) F = B l I cosθ and P = εI = Fv. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const rad = (d: number) => (d * Math.PI) / 180;
// B tesla, l cm, v m/s, th degrees -> volt
const emf = (B: number, l: number, v: number, th: number) => B * (l * 1e-2) * v * Math.cos(rad(th));

export const spec: Spec = {
  id: 'phys-electromagnetic-induction',
  subject: 'Physics',
  lessonTitleStartsWith: "Electromagnetic induction: Faraday's laws",
  afterHeading: 'Motional emf: a conductor moving in a magnetic field',
  title: 'Motional EMF and Lenz Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Slide a rod along rails in a magnetic field. The flux through the loop grows, an emf appears, a current flows and, by Lenz’s law, a force opposes your push. Change the field, the length, the speed, the resistance and the field angle.',
  can: ['See emf = Blv grow with v, l and B', 'Watch the opposing force and the power you must supply follow Lenz’s law', 'Measure B from the slope of emf against speed'],
  minutes: 12,
  vars: [
    { id: 'B', label: 'Magnetic field B', unit: 'T', min: 0.1, max: 1, step: 0.1, start: 0.4, digits: 1 },
    { id: 'l', label: 'Rod length l', unit: 'cm', min: 5, max: 50, step: 5, start: 20, digits: 0 },
    { id: 'v', label: 'Speed of the rod v', unit: 'm/s', min: 1, max: 10, step: 1, start: 4, digits: 0 },
    { id: 'R', label: 'Circuit resistance R', unit: 'Ω', min: 1, max: 20, step: 1, start: 5, digits: 0 },
    { id: 'th', label: 'Angle of B to the loop normal θ', unit: '°', min: 0, max: 80, step: 10, start: 0, digits: 0 },
  ],
  outs: [
    { id: 'e', label: 'Induced emf ε = Blv cosθ', unit: 'mV', fn: (v) => emf(v.B!, v.l!, v.v!, v.th!) * 1e3, digits: 1 },
    { id: 'I', label: 'Induced current I = ε/R', unit: 'mA', fn: (v) => (emf(v.B!, v.l!, v.v!, v.th!) / v.R!) * 1e3, digits: 2 },
    { id: 'F', label: 'Opposing force (Lenz) F = BIl cosθ', unit: 'mN', fn: (v) => v.B! * (v.l! * 1e-2) * (emf(v.B!, v.l!, v.v!, v.th!) / v.R!) * Math.cos(rad(v.th!)) * 1e3, digits: 3 },
    { id: 'P', label: 'Power supplied, P = εI = Fv', unit: 'mW', fn: (v) => (emf(v.B!, v.l!, v.v!, v.th!) ** 2 / v.R!) * 1e3, digits: 3 },
  ],
  graphs: [
    { id: 'e-v', title: 'Induced emf against speed', x: 'v', y: 'e' },
    { id: 'f-l', title: 'Opposing force against rod length', x: 'l', y: 'F' },
    { id: 'e-th', title: 'Induced emf against field angle', x: 'th', y: 'e' },
  ],
  sceneAlt: 'A rod sliding to the right on two rails closed by a resistor at the left. Crosses show the magnetic field into the page and get denser with B, the rod length follows l, the velocity arrow follows v, the current arrow in the rod follows the induced current, and a leftward force arrow shows the opposing force.',
  scene: ({ v, o }) => {
    const half = 12 + v.l! * 1.5;
    const top = 115 - half, bot = 115 + half;
    const xr = 230;
    const nx = Math.round(3 + v.B! * 8);
    const va = 10 + v.v! * 8;
    const ia = 10 + Math.min(40, o.I! / 4);
    const fa = 8 + Math.min(40, o.F! * 3);
    return (
      <g>
        {Array.from({ length: nx * 4 }, (_, i) => (
          <text key={i} x={60 + ((i % nx) + 0.5) * (290 / nx)} y={40 + (Math.floor(i / nx) + 0.5) * 40} fontSize={9} textAnchor="middle" fill="#2563a8" opacity={0.55}>×</text>
        ))}
        <line x1={60} y1={top} x2={350} y2={top} stroke="#7c8595" strokeWidth={2.5} />
        <line x1={60} y1={bot} x2={350} y2={bot} stroke="#7c8595" strokeWidth={2.5} />
        <line x1={60} y1={top} x2={60} y2={bot} stroke="#7c8595" strokeWidth={2.5} />
        <rect x={52} y={115 - 10} width={16} height={20} fill="#fff" stroke="#18443b" strokeWidth={2} />
        <text x={60} y={119} fontSize={9} textAnchor="middle" fill="#18443b">R</text>
        <rect x={60} y={top} width={xr - 60} height={bot - top} fill="#2563a8" opacity={0.07} />
        <line x1={xr} y1={top - 6} x2={xr} y2={bot + 6} stroke="#c45e42" strokeWidth={5} strokeLinecap="round" />
        <path d={`M ${xr + 12} ${115} h ${va} m -6 -4 l 6 4 l -6 4`} stroke="#18443b" strokeWidth={2.4} fill="none" />
        <text x={xr + 14 + va / 2} y={104} fontSize={10} fill="#18443b">v</text>
        <path d={`M ${xr - 9} ${115 + ia / 2} v ${-ia} m -4 6 l 4 -6 l 4 6`} stroke="#c45e42" strokeWidth={2.2} fill="none" />
        <text x={xr - 14} y={115 + ia / 2 + 12} fontSize={10} textAnchor="end" fill="#c45e42">I</text>
        <path d={`M ${xr - 24} ${135} h ${-fa} m 6 -4 l -6 4 l 6 4`} stroke="#7a4ea3" strokeWidth={2.2} fill="none" />
        <text x={xr - 24 - fa / 2} y={150} fontSize={10} textAnchor="middle" fill="#7a4ea3">F (Lenz)</text>
        <text x={200} y={205} fontSize={12} textAnchor="middle" fill="#18443b">ε = {fmt(o.e!, 1)} mV · I = {fmt(o.I!, 1)} mA</text>
        <text x={200} y={223} fontSize={11} textAnchor="middle" fill="#4d5768">B = {v.B} T · l = {v.l} cm · v = {v.v} m/s · θ = {v.th}°</text>
      </g>
    );
  },
  discover: [
    'Drag the speed v. The emf and the current follow: how exactly?',
    'Lengthen the rod l and watch the opposing force: it grows faster than the emf. Why?',
    'Tilt the field with θ. The flux through the loop changes less: what happens to the emf?',
  ],
  experiment: [
    'Double v. Compare ε, I, F and P before and after.',
    'Double l. By what factor does the force change?',
    'Double R. Which of ε, I, F and P change?',
  ],
  understand: [
    "Faraday's law: ε = dΦ/dt. For the sliding rod Φ = Blx cosθ, so ε = Blv cosθ.",
    'The induced current I = ε/R flows so as to oppose the change in flux (Lenz): the rod feels an opposing force F = BIl cosθ.',
    'Because F ∝ B²l²v/R, the force you supply grows as the square of B and l, and the power supplied P = Fv equals the electrical power εI.',
    'This is conservation of energy: the work you do against Lenz’s force is the energy delivered to the circuit.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the speed', prompt: 'The rod is pushed twice as fast, from 2 m/s to 4 m/s. What happens to the induced emf?',
      base: { v: 2, th: 0 }, test: { v: 4 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).e! / outs(base).e!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `ε = Blv is proportional to v (the flux changes twice as fast). ε goes from ${fmt(outs(base).e!, 1)} mV to ${fmt(outs(test).e!, 1)} mV.`,
    },
    {
      id: 'p2', title: 'Double the length of the rod', prompt: 'A longer rod, double the length (10 cm to 20 cm), moves at the same speed. What happens to the force that opposes its motion?',
      base: { l: 10, th: 0 }, test: { l: 20 }, options: ['It doubles', 'It halves', 'It becomes four times as large', 'It stays the same'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).F! / outs(base).F!, [2, 0.5, 4, 1]),
      why: ({ base, test, outs }) => `Doubling l doubles the emf and the current, and the force on the longer rod doubles again: F = B²l²v/R. F goes from ${fmt(outs(base).F!, 3)} mN to ${fmt(outs(test).F!, 3)} mN.`,
    },
    {
      id: 'p3', title: 'Double the resistance', prompt: 'The resistance of the circuit is doubled from 5 Ω to 10 Ω with the rod moving at the same speed. What happens to the induced current?',
      base: { R: 5 }, test: { R: 10 }, options: ['It doubles', 'It stays the same', 'It becomes four times as large', 'It halves'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).I! / outs(base).I!, [2, 1, 4, 0.5]),
      why: ({ base, test, outs }) => `The emf Blv does not depend on R, so I = ε/R halves. I goes from ${fmt(outs(base).I!, 2)} mA to ${fmt(outs(test).I!, 2)} mA.`,
    },
    {
      id: 'p4', title: 'Tilt the field', prompt: 'The magnetic field is tilted from perpendicular to the loop (θ = 0°) to θ = 60° from the normal. What happens to the induced emf?',
      base: { th: 0 }, test: { th: 60 }, options: ['It doubles', 'It stays the same', 'It becomes zero', 'It halves'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).e! / outs(base).e!, [2, 1, 0, 0.5]),
      why: ({ base, test, outs }) => `Only the component of B along the normal links the loop: ε = Blv cosθ, and cos 60° = 0.5. ε goes from ${fmt(outs(base).e!, 1)} mV to ${fmt(outs(test).e!, 1)} mV.`,
    },
  ],
  measure: {
    instruction: 'Keep B, l and θ fixed and change the speed v. Record the induced emf for at least three speeds, then plot ε (volt) against v (m/s). The slope is Bl cosθ, from which B follows.',
    vary: 'v',
    record: ['e', 'I'],
    fit: {
      xLabel: 'v (m/s)',
      yLabel: 'ε (V)',
      x: (v) => v.v!,
      y: (_v, o) => o.e! * 1e-3,
      interpret: (slope, _i, v) => `ε = (Bl cosθ)v, so ε against v is a straight line through the origin. The slope is Bl cosθ = ${fmt(slope, 4)} V s/m, giving B = slope ÷ (l cosθ) ≈ ${fmt(slope / (v.l! * 1e-2 * Math.cos(rad(v.th!))), 2)} T (you set ${v.B} T).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A straight conductor of length 0.50 m moves at 6.0 m/s perpendicular to a uniform magnetic field of 0.30 T and to its own length. The motional emf across it is', options: ['0.45 V', '1.8 V', '0.90 V', '9.0 V'], answer: 2,
      why: 'ε = Blv = 0.30 × 0.50 × 6.0 = 0.90 V.',
      verify: () => near(emf(0.3, 50, 6, 0), [0.45, 1.8, 0.9, 9.0]),
    },
    {
      id: 'q2', q: 'A coil of 100 turns and area 50 cm² has a magnetic field normal to it that rises from 0.2 T to 0.8 T in 0.30 s. The average induced emf is', options: ['1.0 V', '0.1 V', '10 V', '3.0 V'], answer: 0,
      why: "Faraday's law: ε = N ΔΦ/Δt = N A ΔB/Δt = 100 × (5 × 10⁻³) × 0.6/0.30 = 1.0 V.",
      verify: () => near((100 * 50e-4 * (0.8 - 0.2)) / 0.3, [1.0, 0.1, 10, 3.0]),
    },
    {
      id: 'q3', q: 'A 0.40 m rod slides at 5.0 m/s on rails in a field of 0.50 T. The circuit resistance is 2.5 Ω. The current in the rod is', options: ['2.0 A', '0.8 A', '0.2 A', '0.4 A'], answer: 3,
      why: 'ε = Blv = 0.50 × 0.40 × 5.0 = 1.0 V, so I = ε/R = 1.0/2.5 = 0.4 A.',
      verify: () => near(emf(0.5, 40, 5, 0) / 2.5, [2.0, 0.8, 0.2, 0.4]),
    },
    {
      id: 'q4', q: 'For the same rod and circuit as above (B = 0.50 T, l = 0.40 m, v = 5.0 m/s, R = 2.5 Ω), the force needed to keep the rod moving at constant speed is', options: ['0.08 N', '0.8 N', '0.4 N', '0.2 N'], answer: 0,
      why: 'F = BIl = 0.50 × 0.4 × 0.40 = 0.08 N (equivalently B²l²v/R), the force that balances Lenz’s opposing force.',
      verify: () => near(0.5 * (emf(0.5, 40, 5, 0) / 2.5) * 0.4, [0.08, 0.8, 0.4, 0.2]),
    },
    {
      id: 'q5', q: 'The current in a coil of self-inductance 0.50 H falls uniformly from 2.0 A to zero in 0.10 s. The average induced emf is', options: ['1 V', '10 V', '100 V', '5 V'], answer: 1,
      why: 'ε = L |ΔI/Δt| = 0.50 × 2.0/0.10 = 10 V, in the direction that opposes the fall of the current.',
      verify: () => near(0.5 * (2.0 / 0.1), [1, 10, 100, 5]),
    },
  ],
};
