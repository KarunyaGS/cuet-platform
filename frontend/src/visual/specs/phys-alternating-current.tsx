/**
 * Chapter lab: Physics, Unit IV, "Alternating currents: rms values, reactance, impedance, LCR circuits, resonance and power".
 * The model: series LCR circuit with XL = ωL, XC = 1/ωC, Z = √(R² + (XL − XC)²), Irms = Vrms/Z, tanφ = (XL − XC)/R,
 * P = Vrms Irms cosφ, resonance f0 = 1/2π√LC. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const w = (f: number) => 2 * Math.PI * f;
// L in mH, C in µF, R in ohm, f in Hz
const xl = (L: number, f: number) => w(f) * L * 1e-3;
const xc = (C: number, f: number) => 1 / (w(f) * C * 1e-6);
const zOf = (R: number, L: number, C: number, f: number) => Math.hypot(R, xl(L, f) - xc(C, f));
const phiOf = (R: number, L: number, C: number, f: number) => (Math.atan2(xl(L, f) - xc(C, f), R) * 180) / Math.PI;

export const spec: Spec = {
  id: 'phys-alternating-current',
  subject: 'Physics',
  lessonTitleStartsWith: 'Alternating currents: rms values',
  afterHeading: 'Resonance in a series LCR circuit',
  title: 'Series LCR Circuit and Resonance Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Drive a series L, C and R from an AC source. Change the frequency and watch the phasor diagram open and close, the impedance dip, the current peak at resonance and the power follow.',
  can: ['See XL rise and XC fall with frequency and meet at resonance', 'Watch the phasors VL and VC cancel at resonance', 'Recover the inductance from the slope of XL against f'],
  minutes: 14,
  vars: [
    { id: 'R', label: 'Resistance R', unit: 'Ω', min: 5, max: 100, step: 5, start: 30, digits: 0 },
    { id: 'L', label: 'Inductance L', unit: 'mH', min: 10, max: 500, step: 10, start: 100, digits: 0 },
    { id: 'C', label: 'Capacitance C', unit: 'µF', min: 5, max: 100, step: 5, start: 25, digits: 0 },
    { id: 'f', label: 'Source frequency f', unit: 'Hz', min: 20, max: 500, step: 5, start: 50, digits: 0 },
    { id: 'V', label: 'Source rms voltage V', unit: 'V', min: 10, max: 240, step: 10, start: 100, digits: 0 },
  ],
  outs: [
    { id: 'XL', label: 'Inductive reactance XL = ωL', unit: 'Ω', fn: (v) => xl(v.L!, v.f!), digits: 1 },
    { id: 'XC', label: 'Capacitive reactance XC = 1/ωC', unit: 'Ω', fn: (v) => xc(v.C!, v.f!), digits: 1 },
    { id: 'Z', label: 'Impedance Z', unit: 'Ω', fn: (v) => zOf(v.R!, v.L!, v.C!, v.f!), digits: 1 },
    { id: 'I', label: 'rms current I = V/Z', unit: 'A', fn: (v) => v.V! / zOf(v.R!, v.L!, v.C!, v.f!), digits: 3 },
    { id: 'phi', label: 'Phase angle φ (current lags when +)', unit: '°', fn: (v) => phiOf(v.R!, v.L!, v.C!, v.f!), digits: 1 },
    { id: 'P', label: 'Average power P = VI cosφ', unit: 'W', fn: (v) => (v.V! * v.V! * v.R!) / zOf(v.R!, v.L!, v.C!, v.f!) ** 2, digits: 2 },
    { id: 'f0', label: 'Resonant frequency f₀ = 1/2π√LC', unit: 'Hz', fn: (v) => 1 / (2 * Math.PI * Math.sqrt(v.L! * 1e-3 * v.C! * 1e-6)), digits: 1 },
  ],
  graphs: [
    { id: 'i-f', title: 'Current against frequency (resonance curve)', x: 'f', y: 'I' },
    { id: 'z-f', title: 'Impedance against frequency', x: 'f', y: 'Z' },
    { id: 'phi-f', title: 'Phase angle against frequency', x: 'f', y: 'phi' },
  ],
  sceneAlt: 'A phasor diagram with the current along the horizontal axis. The voltage across the resistor lies along it, the inductor phasor points up, the capacitor phasor points down, and the source voltage is their vector sum. Their lengths and the angle phi follow the sliders.',
  scene: ({ v, o }) => {
    const I = o.I!;
    const vr = I * v.R!, vl = I * o.XL!, vc = I * o.XC!;
    const s = 78 / Math.max(vr, vl, vc, v.V!);
    const ox = 60, oy = 118;
    const arrow = (x1: number, y1: number, x2: number, y2: number, col: string, w2 = 2.4) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const hx = (d: number) => x2 - 7 * Math.cos(a + d);
      const hy = (d: number) => y2 - 7 * Math.sin(a + d);
      return <g stroke={col} strokeWidth={w2} fill="none"><line x1={x1} y1={y1} x2={x2} y2={y2} /><path d={`M ${hx(0.4)} ${hy(0.4)} L ${x2} ${y2} L ${hx(-0.4)} ${hy(-0.4)}`} /></g>;
    };
    const net = vl - vc;
    return (
      <g>
        <line x1={ox - 20} y1={oy} x2={380} y2={oy} stroke="#e1e5ea" />
        {arrow(ox, oy, ox + vr * s, oy, '#18443b', 2.6)}
        {arrow(ox + vr * s, oy, ox + vr * s, oy - vl * s, '#2563a8')}
        {arrow(ox + vr * s, oy - vl * s, ox + vr * s, oy - vl * s + vc * s, '#c45e42')}
        {arrow(ox, oy, ox + vr * s, oy - net * s, '#7a4ea3', 2.2)}
        <text x={ox + 10} y={oy + 16} fontSize={10} fill="#18443b">VR = IR = {fmt(vr, 1)} V (along I)</text>
        <text x={ox + vr * s + 48} y={oy - (vl * s) / 2} fontSize={10} fill="#2563a8">VL {fmt(vl, 0)}</text>
        <text x={ox + vr * s + 48} y={oy - vl * s + (vc * s) / 2 + 3} fontSize={10} fill="#c45e42">VC {fmt(vc, 0)}</text>
        <text x={ox} y={oy - net * s - 8} fontSize={10} fill="#7a4ea3">V = {v.V} V</text>
        <text x={200} y={206} fontSize={12} textAnchor="middle" fill="#18443b">Z = {fmt(o.Z!, 1)} Ω · φ = {fmt(o.phi!, 1)}° · I = {fmt(o.I!, 2)} A</text>
        <text x={200} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">f = {v.f} Hz, resonance at {fmt(o.f0!, 1)} Hz{Math.abs(v.f! - o.f0!) < 5 ? ' (at resonance)' : ''}</text>
      </g>
    );
  },
  discover: [
    'Sweep the frequency f. Watch the phasor diagram: when do the blue VL and the orange VC cancel?',
    'On the current graph, find the peak and compare its position with f₀.',
    'Raise R and see how the peak and the impedance minimum change.',
  ],
  experiment: [
    'Set f close to f₀. What is Z compared with R, and what is the phase angle?',
    'Double the frequency from 50 Hz: how do XL and XC change?',
    'At resonance, can VL be larger than the source voltage V? Look at the phasor lengths.',
  ],
  understand: [
    'XL = ωL grows with frequency, XC = 1/ωC falls with it, and Z = √(R² + (XL − XC)²).',
    'The current is I = V/Z and lags the voltage by φ with tanφ = (XL − XC)/R (it leads when XC is larger).',
    'At resonance XL = XC, so Z = R is a minimum, the current is a maximum and φ = 0, at f₀ = 1/(2π√LC).',
    'The average power is P = VI cosφ; only the resistor dissipates energy.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the frequency: inductor', prompt: 'The source frequency is doubled from 50 Hz to 100 Hz. What happens to the inductive reactance XL?',
      base: { f: 50 }, test: { f: 100 }, options: ['It halves', 'It stays the same', 'It doubles', 'It becomes four times as large'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).XL! / outs(base).XL!, [0.5, 1, 2, 4]),
      why: ({ base, test, outs }) => `XL = ωL = 2πfL is proportional to f. XL goes from ${fmt(outs(base).XL!, 1)} Ω to ${fmt(outs(test).XL!, 1)} Ω.`,
    },
    {
      id: 'p2', title: 'Double the capacitance', prompt: 'The capacitance is doubled from 20 µF to 40 µF at the same frequency. What happens to the capacitive reactance XC?',
      base: { C: 20 }, test: { C: 40 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).XC! / outs(base).XC!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `XC = 1/ωC is inversely proportional to C. XC goes from ${fmt(outs(base).XC!, 1)} Ω to ${fmt(outs(test).XC!, 1)} Ω.`,
    },
    {
      id: 'p3', title: 'Tune to resonance', prompt: 'With L = 100 mH, C = 25 µF and R = 30 Ω, the frequency is raised from 50 Hz to 100 Hz, close to f₀. What happens to the current?',
      base: { R: 30, L: 100, C: 25, f: 50 }, test: { f: 100 }, options: ['It more than triples', 'It halves', 'It stays the same', 'It doubles'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).I! / outs(base).I!, [3.35, 0.5, 1, 2]),
      why: ({ base, test, outs }) => `Near resonance XL − XC almost vanishes and Z drops towards R. Z goes from ${fmt(outs(base).Z!, 1)} Ω to ${fmt(outs(test).Z!, 1)} Ω, so I goes from ${fmt(outs(base).I!, 3)} A to ${fmt(outs(test).I!, 3)} A.`,
    },
    {
      id: 'p4', title: 'Phase at resonance', prompt: 'In the same circuit at 50 Hz the current leads the voltage by about 73° (XC > XL). At 100 Hz, near resonance, what is the phase angle?',
      base: { R: 30, L: 100, C: 25, f: 50 }, test: { f: 100 }, options: ['Almost zero, voltage and current nearly in phase', 'Still about −73°', 'About +45°', 'About +90°'], answer: 0,
      verify: ({ test, outs }) => near(outs(test).phi!, [0, -72.6, 45, 90]),
      why: ({ base, test, outs }) => `tanφ = (XL − XC)/R. φ goes from ${fmt(outs(base).phi!, 1)}° to ${fmt(outs(test).phi!, 1)}°: at resonance XL = XC and the circuit behaves like a pure resistor.`,
    },
  ],
  measure: {
    instruction: 'Keep L fixed and change the frequency f. Record the inductive reactance XL for at least three frequencies, then plot XL against f. The slope contains the inductance.',
    vary: 'f',
    record: ['XL', 'XC', 'I'],
    fit: {
      xLabel: 'f (Hz)',
      yLabel: 'XL (Ω)',
      x: (v) => v.f!,
      y: (_v, o) => o.XL!,
      interpret: (slope, _i, v) => `XL = 2πL·f, so XL against f is a straight line through the origin. The slope is 2πL = ${fmt(slope, 3)} Ω s, giving L = slope ÷ 2π ≈ ${fmt((slope / (2 * Math.PI)) * 1e3, 1)} mH (you set ${v.L} mH).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'An ideal inductor of 0.20 H is connected to a 50 Hz AC source. Its inductive reactance is', options: ['31.4 Ω', '125.7 Ω', '6.28 Ω', '62.8 Ω'], answer: 3,
      why: 'XL = 2πfL = 2π × 50 × 0.20 = 62.8 Ω.',
      verify: () => near(2 * Math.PI * 50 * 0.2, [31.4, 125.7, 6.28, 62.8]),
    },
    {
      id: 'q2', q: 'A 25 µF capacitor is connected to a 100 Hz AC source. Its capacitive reactance is', options: ['63.7 Ω', '6.37 Ω', '15.7 Ω', '637 Ω'], answer: 0,
      why: 'XC = 1/(2πfC) = 1/(2π × 100 × 25 × 10⁻⁶) = 63.7 Ω.',
      verify: () => near(1 / (2 * Math.PI * 100 * 25e-6), [63.7, 6.37, 15.7, 637]),
    },
    {
      id: 'q3', q: 'A series circuit has R = 40 Ω, XL = 80 Ω and XC = 50 Ω. Its impedance is', options: ['70 Ω', '50 Ω', '170 Ω', '30 Ω'], answer: 1,
      why: 'Z = √(R² + (XL − XC)²) = √(40² + 30²) = 50 Ω.',
      verify: () => near(Math.hypot(40, 80 - 50), [70, 50, 170, 30]),
    },
    {
      id: 'q4', q: 'A series LC circuit has L = 50 mH and C = 20 µF. Its resonant frequency is about', options: ['318 Hz', '1000 Hz', '50 Hz', '159 Hz'], answer: 3,
      why: 'f₀ = 1/(2π√LC) = 1/(2π√(0.050 × 20 × 10⁻⁶)) = 1/(2π × 10⁻³) ≈ 159 Hz.',
      verify: () => near(1 / (2 * Math.PI * Math.sqrt(0.05 * 20e-6)), [318, 1000, 50, 159]),
    },
    {
      id: 'q5', q: 'A circuit with R = 30 Ω and XL = 40 Ω in series is connected to a 220 V rms source. The average power consumed is about', options: ['581 W', '968 W', '1936 W', '387 W'], answer: 0,
      why: 'Z = √(30² + 40²) = 50 Ω, I = 220/50 = 4.4 A, and P = I²R = 4.4² × 30 = 581 W (equivalently VI cosφ with cosφ = 0.6).',
      verify: () => near((4.4 ** 2) * 30, [581, 968, 1936, 387]) === 0 && Math.abs((220 * (220 / 50) * (30 / 50)) - 4.4 ** 2 * 30) < 1e-9 ? 0 : -1,
    },
  ],
};
