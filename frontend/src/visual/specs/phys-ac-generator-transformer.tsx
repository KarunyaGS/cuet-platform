/**
 * Chapter lab: Physics, Unit IV, "AC generator and transformer".
 * The model: e = NBAω sin ωt with peak e0 = NBAω (coil area 200 cm²), Vrms = e0/√2 feeding an ideal transformer
 * Vs/Vp = Ns/Np = Ip/Is into a 100 Ω load. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const AREA = 0.02; // m²
const LOAD = 100; // ohm
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const e0Of = (N: number, B: number, f: number) => N * B * AREA * 2 * Math.PI * f;
const vp = (N: number, B: number, f: number) => e0Of(N, B, f) / Math.SQRT2;
const vs = (N: number, B: number, f: number, Np: number, Ns: number) => (vp(N, B, f) * Ns) / Np;

export const spec: Spec = {
  id: 'phys-ac-generator-transformer',
  subject: 'Physics',
  lessonTitleStartsWith: 'AC generator and transformer',
  afterHeading: 'Working of a transformer: the turns ratio',
  title: 'AC Generator and Transformer Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Spin a coil in a magnetic field to make an alternating emf, then feed it into a transformer. Change the turns, the field and the speed, and watch the peak emf, the rms voltage, the secondary voltage and the currents respond.',
  can: ['See the peak emf rise with N, B and the rotation frequency', 'Step the voltage up or down with the turns ratio and watch the current go the other way', 'Recover the coil area from your own emf readings'],
  minutes: 12,
  vars: [
    { id: 'N', label: 'Turns in the generator coil N', unit: '', min: 20, max: 200, step: 10, start: 100, digits: 0 },
    { id: 'B', label: 'Magnetic field B', unit: 'T', min: 0.1, max: 1, step: 0.1, start: 0.5, digits: 1 },
    { id: 'f', label: 'Rotation frequency f', unit: 'Hz', min: 10, max: 100, step: 5, start: 50, digits: 0 },
    { id: 'Np', label: 'Primary turns Np', unit: '', min: 100, max: 1000, step: 100, start: 500, digits: 0 },
    { id: 'Ns', label: 'Secondary turns Ns', unit: '', min: 100, max: 2000, step: 100, start: 1000, digits: 0 },
  ],
  outs: [
    { id: 'e0', label: 'Peak emf e₀ = NBAω', unit: 'V', fn: (v) => e0Of(v.N!, v.B!, v.f!), digits: 1 },
    { id: 'Vp', label: 'Primary rms voltage e₀/√2', unit: 'V', fn: (v) => vp(v.N!, v.B!, v.f!), digits: 1 },
    { id: 'Vs', label: 'Secondary rms voltage Vp·Ns/Np', unit: 'V', fn: (v) => vs(v.N!, v.B!, v.f!, v.Np!, v.Ns!), digits: 1 },
    { id: 'Is', label: 'Secondary current into 100 Ω', unit: 'A', fn: (v) => vs(v.N!, v.B!, v.f!, v.Np!, v.Ns!) / LOAD, digits: 3 },
    { id: 'Ip', label: 'Primary current (ideal, Ip = Is·Ns/Np)', unit: 'A', fn: (v) => (vs(v.N!, v.B!, v.f!, v.Np!, v.Ns!) / LOAD) * (v.Ns! / v.Np!), digits: 3 },
  ],
  graphs: [
    { id: 'e0-f', title: 'Peak emf against rotation frequency', x: 'f', y: 'e0' },
    { id: 'vs-ns', title: 'Secondary voltage against secondary turns', x: 'Ns', y: 'Vs' },
    { id: 'ip-ns', title: 'Primary current against secondary turns', x: 'Ns', y: 'Ip' },
  ],
  sceneAlt: 'Left, an emf waveform whose height follows the peak emf and whose number of cycles follows the frequency. Right, a transformer with an iron core, a primary coil and a secondary coil whose numbers of drawn turns follow Np and Ns and whose voltages are labelled.',
  scene: ({ v, o }) => {
    const amp = Math.min(48, (o.e0! / 900) * 48 + 4);
    const cycles = (v.f! * 0.04);
    const pts = Array.from({ length: 121 }, (_, i) => {
      const x = 15 + (i / 120) * 170;
      const y = 80 - amp * Math.sin((i / 120) * cycles * 2 * Math.PI);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const tp = Math.round(v.Np! / 100);
    const ts = Math.round(v.Ns! / 200) + 1;
    return (
      <g>
        <text x={100} y={18} fontSize={11} textAnchor="middle" fill="#4d5768">emf over 40 ms</text>
        <line x1={15} y1={80} x2={185} y2={80} stroke="#cbd2dc" />
        <polyline points={pts} fill="none" stroke="#c45e42" strokeWidth={2} />
        <text x={100} y={150} fontSize={11} textAnchor="middle" fill="#4d5768">e₀ = {fmt(o.e0!, 0)} V · {fmt(v.f!, 0)} Hz</text>
        <text x={100} y={168} fontSize={11} textAnchor="middle" fill="#4d5768">N = {v.N} · B = {v.B} T</text>
        <rect x={235} y={40} width={130} height={140} fill="none" stroke="#7c8595" strokeWidth={10} />
        <rect x={252} y={57} width={96} height={106} fill="#fff" />
        {Array.from({ length: tp }, (_, i) => <line key={i} x1={228} y1={52 + (i * 112) / Math.max(tp, 1)} x2={244} y2={58 + (i * 112) / Math.max(tp, 1)} stroke="#2563a8" strokeWidth={2.2} />)}
        {Array.from({ length: ts }, (_, i) => <line key={i} x1={356} y1={52 + (i * 112) / Math.max(ts, 1)} x2={372} y2={58 + (i * 112) / Math.max(ts, 1)} stroke="#c45e42" strokeWidth={2.2} />)}
        <text x={235} y={198} fontSize={11} textAnchor="middle" fill="#2563a8">Np = {v.Np} · {fmt(o.Vp!, 0)} V</text>
        <text x={398} y={198} fontSize={11} textAnchor="end" fill="#c45e42">Ns = {v.Ns} · {fmt(o.Vs!, 0)} V</text>
        <text x={300} y={220} fontSize={11} textAnchor="middle" fill="#4d5768">{v.Ns! > v.Np! ? 'step-up' : v.Ns! < v.Np! ? 'step-down' : 'one to one'}: Ip = {fmt(o.Ip!, 2)} A, Is = {fmt(o.Is!, 2)} A</text>
      </g>
    );
  },
  discover: [
    'Drag the frequency f. The waveform gets taller and more crowded: which of these changes the peak emf?',
    'Move Ns above and below Np. When is it a step-up transformer, and what happens to the currents?',
    'Compare the primary and secondary currents as the turns ratio changes.',
  ],
  experiment: [
    'Double the rotation frequency. What happens to e₀ and to the rms voltage?',
    'Double Ns with everything else fixed. Compare Vs, Is and Ip before and after.',
    'Which sliders change the secondary voltage but not the turns ratio?',
  ],
  understand: [
    'A coil of N turns and area A rotating at ω in a field B has emf e = NBAω sin ωt, with peak e₀ = NBAω.',
    'The rms value is e₀/√2. The emf is alternating because the flux through the coil changes sign each half turn.',
    'An ideal transformer has Vs/Vp = Ns/Np = Ip/Is: a step-up transformer raises the voltage and lowers the current.',
    'With a fixed resistive load, doubling Ns doubles Vs and Is, and so quadruples the primary current.',
  ],
  preds: [
    {
      id: 'p1', title: 'Spin it twice as fast', prompt: 'The coil is rotated twice as fast, from 25 Hz to 50 Hz, in the same field. What happens to the peak emf?',
      base: { f: 25 }, test: { f: 50 }, options: ['It halves', 'It stays the same', 'It becomes four times as large', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).e0! / outs(base).e0!, [0.5, 1, 4, 2]),
      why: ({ base, test, outs }) => `e₀ = NBAω with ω = 2πf, so e₀ is proportional to f. e₀ goes from ${fmt(outs(base).e0!, 1)} V to ${fmt(outs(test).e0!, 1)} V.`,
    },
    {
      id: 'p2', title: 'Double the turns of the coil', prompt: 'The generator coil has its turns doubled, from 50 to 100, at the same field and speed. What happens to the peak emf?',
      base: { N: 50 }, test: { N: 100 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).e0! / outs(base).e0!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `e₀ is proportional to N. e₀ goes from ${fmt(outs(base).e0!, 1)} V to ${fmt(outs(test).e0!, 1)} V.`,
    },
    {
      id: 'p3', title: 'Double the secondary turns', prompt: 'The secondary turns of the transformer are doubled from 500 to 1000 (primary fixed at 500). What happens to the secondary voltage?',
      base: { Np: 500, Ns: 500 }, test: { Ns: 1000 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Vs! / outs(base).Vs!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `Vs = Vp·Ns/Np is proportional to Ns. Vs goes from ${fmt(outs(base).Vs!, 1)} V to ${fmt(outs(test).Vs!, 1)} V.`,
    },
    {
      id: 'p4', title: 'Double the secondary turns: primary current', prompt: 'The same change (Ns from 500 to 1000, Np = 500) is made with the 100 Ω load connected. What happens to the current drawn by the primary?',
      base: { Np: 500, Ns: 500 }, test: { Ns: 1000 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).Ip! / outs(base).Ip!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `Vs doubles so Is doubles, and Ip = Is·Ns/Np doubles again: ${fmt(outs(base).Ip!, 3)} A to ${fmt(outs(test).Ip!, 3)} A, four times as large.`,
    },
  ],
  measure: {
    instruction: 'Keep N and B fixed and change the rotation frequency f. Record the peak emf for at least three frequencies, then plot e₀ against f. The slope contains the coil area.',
    vary: 'f',
    record: ['e0', 'Vp'],
    fit: {
      xLabel: 'f (Hz)',
      yLabel: 'e₀ (V)',
      x: (v) => v.f!,
      y: (_v, o) => o.e0!,
      interpret: (slope, _i, v) => `e₀ = 2πNBA·f, so e₀ against f is a straight line through the origin with slope 2πNBA = ${fmt(slope, 2)} V s. Then A = slope ÷ (2πNB) ≈ ${fmt((slope / (2 * Math.PI * v.N! * v.B!)) * 1e4, 1)} cm² (the coil area is 200 cm²).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A coil of 100 turns and area 0.05 m² rotates at 50 Hz in a uniform field of 0.40 T. The peak emf produced is', options: ['314 V', '628 V', '1256 V', '100 V'], answer: 1,
      why: 'e₀ = NBAω = 100 × 0.40 × 0.05 × (2π × 50) = 628 V.',
      verify: () => near(100 * 0.4 * 0.05 * 2 * Math.PI * 50, [314, 628, 1256, 100]),
    },
    {
      id: 'q2', q: 'A transformer has 200 turns in the primary and 2000 in the secondary. The primary is connected to 220 V rms. The secondary voltage is', options: ['22 V', '440 V', '2200 V', '4400 V'], answer: 2,
      why: 'Vs = Vp × Ns/Np = 220 × 2000/200 = 2200 V (a step-up transformer).',
      verify: () => near(220 * (2000 / 200), [22, 440, 2200, 4400]),
    },
    {
      id: 'q3', q: 'A step-down transformer with 1000 primary turns is connected to a 4400 V line and must deliver 220 V. The number of secondary turns needed is', options: ['50', '20', '200', '500'], answer: 0,
      why: 'Ns/Np = Vs/Vp, so Ns = 1000 × 220/4400 = 50 turns.',
      verify: () => near(1000 * (220 / 4400), [50, 20, 200, 500]),
    },
    {
      id: 'q4', q: 'An ideal step-up transformer has a turns ratio Ns : Np = 10 : 1. If the primary current is 5 A, the secondary current is', options: ['50 A', '5 A', '0.5 A', '10 A'], answer: 2,
      why: 'For an ideal transformer VpIp = VsIs, so Is = Ip × Np/Ns = 5/10 = 0.5 A: stepping the voltage up steps the current down.',
      verify: () => near(5 * (1 / 10), [50, 5, 0.5, 10]),
    },
    {
      id: 'q5', q: 'Power is sent along a line of fixed resistance. The transmission voltage is raised 10 times while the same power is delivered. The power lost in the line becomes', options: ['1/10 as large', '10 times as large', '1/100 as large', 'unchanged'], answer: 2,
      why: 'The line current I = P/V falls 10 times, and the loss I²R falls 10² = 100 times.',
      verify: () => near((1 / 10) ** 2, [0.1, 10, 0.01, 1]),
    },
  ],
};
