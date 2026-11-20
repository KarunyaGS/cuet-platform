/**
 * Chapter lab: Physics, Unit V, "Electromagnetic waves: production, characteristics and transverse nature".
 * The model: λ = c/ν, E0 = cB0, average energy density ⟨u⟩ = ½ε0E0², intensity I = ⟨u⟩c = ½cε0E0², radiation pressure I/c (absorbed) or 2I/c (reflected),
 * force on an area A. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const C = 3e8;
const EPS0 = 8.854e-12;

const inten = (E0: number) => 0.5 * C * EPS0 * E0 * E0; // W/m²
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-em-waves',
  subject: 'Physics',
  lessonTitleStartsWith: 'Electromagnetic waves: production',
  afterHeading: 'Energy carried by electromagnetic waves',
  title: 'Electromagnetic Wave Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose the frequency and the electric-field amplitude of a plane wave. See E and B oscillating in phase, the wavelength, the magnetic amplitude, the energy density, the intensity, and the radiation pressure on a surface.',
  can: ['See E0 = cB0 and why B is so small in SI units', 'Double the field amplitude and watch the intensity grow fourfold', 'Fit intensity against E0² to recover ε0 from your own readings'],
  minutes: 11,
  vars: [
    { id: 'nu', label: 'Frequency ν', unit: 'MHz', min: 1, max: 10000, step: 1, start: 40, log: true, digits: 1 },
    { id: 'E0', label: 'Electric-field amplitude E0', unit: 'V/m', min: 5, max: 300, step: 5, start: 60, digits: 0 },
    { id: 'A', label: 'Area of the surface hit by the wave A', unit: 'm²', min: 0.5, max: 5, step: 0.5, start: 2, digits: 1 },
    { id: 'refl', label: 'Surface (0 = absorbs, 1 = reflects)', unit: '', min: 0, max: 1, step: 1, start: 0, digits: 0, choice: true },
  ],
  outs: [
    { id: 'lam', label: 'Wavelength λ = c / ν', unit: 'm', fn: (v) => C / (v.nu! * 1e6), digits: 3 },
    { id: 'B0', label: 'Magnetic-field amplitude B0 = E0 / c', unit: 'nT', fn: (v) => (v.E0! / C) * 1e9, digits: 1 },
    { id: 'u', label: 'Average energy density ½ε0E0²', unit: 'nJ/m³', fn: (v) => 0.5 * EPS0 * v.E0! * v.E0! * 1e9, digits: 2 },
    { id: 'I', label: 'Intensity I = ½ c ε0 E0²', unit: 'W/m²', fn: (v) => inten(v.E0!), digits: 2 },
    { id: 'P', label: 'Radiation pressure (1 + r) I / c', unit: 'nPa', fn: (v) => ((1 + v.refl!) * inten(v.E0!)) / C * 1e9, digits: 2 },
    { id: 'F', label: 'Force on the surface', unit: 'nN', fn: (v) => ((1 + v.refl!) * inten(v.E0!) * v.A!) / C * 1e9, digits: 2 },
  ],
  graphs: [
    { id: 'i-e', title: 'Intensity against electric-field amplitude', x: 'E0', y: 'I' },
    { id: 'b-e', title: 'Magnetic amplitude against electric amplitude', x: 'E0', y: 'B0' },
    { id: 'lam-nu', title: 'Wavelength against frequency', x: 'nu', y: 'lam', logX: true, logY: true },
  ],
  sceneAlt: 'A plane electromagnetic wave travelling to the right: the electric field is drawn as a vertical sine wave and the magnetic field as a sine wave in the perpendicular direction, in phase. The amplitudes follow E0 and B0, the wavelength follows the frequency, and a plate at the right shows the force arrow, doubled when the surface reflects.',
  scene: ({ v, o }) => {
    const ampE = 10 + (38 * (Math.log10(v.E0!) - Math.log10(5))) / (Math.log10(300) - Math.log10(5));
    const ampB = ampE * 0.55;
    const lamPx = 150 - (120 * Math.log10(v.nu!)) / 4;
    const x0 = 30;
    const x1 = 300;
    const y0 = 100;
    const E: string[] = [];
    const B: string[] = [];
    for (let x = 0; x <= x1 - x0; x += 2) {
      const ph = Math.sin((2 * Math.PI * x) / lamPx);
      E.push(`${x0 + x},${y0 - ampE * ph}`);
      B.push(`${x0 + x + ampB * 0.7 * ph},${y0 + ampB * 0.7 * ph}`);
    }
    const fl = 10 + Math.min(45, Math.log10(1 + o.F!) * 22);
    return (
      <g>
        <line x1={x0} y1={y0} x2={x1 + 8} y2={y0} stroke="#c9ced6" />
        <polyline points={E.join(' ')} fill="none" stroke="#c45e42" strokeWidth={2} />
        <polyline points={B.join(' ')} fill="none" stroke="#2563a8" strokeWidth={1.6} strokeDasharray="4 2" />
        <text x={x0} y={30} fontSize={11} fill="#c45e42">E (vertical)  E0 = {v.E0} V/m</text>
        <text x={x0} y={46} fontSize={11} fill="#2563a8">B (perpendicular, in phase)  B0 = {fmt(o.B0!, 1)} nT</text>
        <path d={`M ${x0} 175 H ${x0 + 60} m -6 -4 l 6 4 l -6 4`} stroke="#18443b" fill="none" strokeWidth={1.6} />
        <text x={x0 + 66} y={179} fontSize={10} fill="#18443b">direction E × B</text>
        <rect x={318} y={60} width={10} height={80} fill={v.refl! ? '#9aa3b2' : '#18443b'} />
        <path d={`M 314 100 h ${-fl}`} stroke="#18443b" strokeWidth={0} />
        <path d={`M 340 100 h ${fl} m -6 -4 l 6 4 l -6 4`} stroke="#c45e42" strokeWidth={2} fill="none" />
        <text x={330} y={158} fontSize={9} textAnchor="middle" fill="#4d5768">{v.refl! ? 'reflects' : 'absorbs'}</text>
        <text x={200} y={214} fontSize={11} textAnchor="middle" fill="#4d5768">λ = {fmt(o.lam!, 3)} m · I = {fmt(o.I!, 2)} W/m² · F = {fmt(o.F!, 2)} nN</text>
      </g>
    );
  },
  discover: [
    'Change the electric amplitude E0 and watch B0. What is the ratio E0/B0?',
    'Change the frequency. Which readouts change and which stay the same?',
    'Switch the surface from absorbing to reflecting. What happens to the force?',
  ],
  experiment: [
    'Double E0. Compare the change in B0, the energy density and the intensity.',
    'Make the frequency ten times larger. What happens to the wavelength?',
    'Keep the wave fixed and double the area of the surface. How does the force change?',
  ],
  understand: [
    'An EM wave is E and B oscillating in phase and perpendicular to each other and to the direction E × B; E0 = cB0.',
    'In vacuum c = νλ = 1/√(μ0ε0), the same for every frequency.',
    'The average energy density is ½ε0E0² (half electric, half magnetic) and the intensity is I = ½cε0E0².',
    'The wave carries momentum: radiation pressure is I/c on an absorbing surface and 2I/c on a reflecting one.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the electric field', prompt: 'The electric-field amplitude of a wave is doubled (60 V/m to 120 V/m). What happens to its intensity?',
      base: { E0: 60 }, test: { E0: 120 }, options: ['It doubles', 'It halves', 'It becomes four times as large', 'It is unchanged'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).I! / outs(base).I!, [2, 0.5, 4, 1]),
      why: ({ base, test, outs }) => `I = ½cε0E0² depends on E0². I goes from ${fmt(outs(base).I!, 2)} W/m² to ${fmt(outs(test).I!, 2)} W/m².`,
    },
    {
      id: 'p2', title: 'The magnetic amplitude', prompt: 'With E0 doubled from 60 V/m to 120 V/m, what happens to the magnetic-field amplitude B0?',
      base: { E0: 60 }, test: { E0: 120 }, options: ['It doubles', 'It becomes one quarter', 'It is unchanged', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).B0! / outs(base).B0!, [2, 0.25, 1, 4]),
      why: ({ base, test, outs }) => `E0 = cB0 at every instant, so B0 is proportional to E0: ${fmt(outs(base).B0!, 1)} nT becomes ${fmt(outs(test).B0!, 1)} nT.`,
    },
    {
      id: 'p3', title: 'Ten times the frequency', prompt: 'The frequency of a wave in vacuum is increased tenfold (40 MHz to 400 MHz). What happens to its wavelength?',
      base: { nu: 40 }, test: { nu: 400 }, options: ['It becomes ten times longer', 'It falls to one tenth', 'It is unchanged', 'It falls to one hundredth'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).lam! / outs(base).lam!, [10, 0.1, 1, 0.01]),
      why: ({ base, test, outs }) => `λ = c/ν with c fixed: ${fmt(outs(base).lam!, 2)} m becomes ${fmt(outs(test).lam!, 2)} m.`,
    },
    {
      id: 'p4', title: 'Absorb or reflect', prompt: 'A perfectly absorbing panel is replaced by a perfectly reflecting one of the same area in the same beam. What happens to the force on it?',
      base: { refl: 0 }, test: { refl: 1 }, options: ['It halves', 'It doubles', 'It is unchanged', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).F! / outs(base).F!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `Reflection reverses the momentum, so the surface receives 2U/c instead of U/c. F goes from ${fmt(outs(base).F!, 2)} nN to ${fmt(outs(test).F!, 2)} nN.`,
    },
  ],
  measure: {
    instruction: 'Keep the frequency fixed. Record the intensity of the wave for at least three different electric-field amplitudes.',
    vary: 'E0',
    record: ['B0', 'u', 'I'],
    fit: {
      xLabel: 'E0² (V²/m²)',
      yLabel: 'I (W/m²)',
      x: (v) => v.E0! * v.E0!,
      y: (_v, o) => o.I!,
      interpret: (slope) => `I against E0² is a straight line through the origin, so I ∝ E0². The slope is ½cε0 = ${fmt(slope, 6, true)} W/m² per (V/m)², which gives ε0 = 2 × slope / c ≈ ${fmt((2 * slope) / C, 3, true)} C² N⁻¹ m⁻² (accepted 8.854 × 10^-12).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A plane EM wave in vacuum has an electric-field amplitude of 45 V/m. The amplitude of its magnetic field is', options: ['1.5 × 10⁻⁷ T', '1.35 × 10¹⁰ T', '4.5 × 10⁻⁸ T', '1.5 × 10⁻⁹ T'], answer: 0,
      why: 'B0 = E0/c = 45 / (3 × 10⁸) = 1.5 × 10⁻⁷ T.',
      verify: () => near(45 / C, [1.5e-7, 1.35e10, 4.5e-8, 1.5e-9]),
    },
    {
      id: 'q2', q: 'A plane EM wave has E0 = 100 V/m. Using ε0 = 8.854 × 10⁻¹² and c = 3 × 10⁸ m/s, its intensity is about', options: ['26.5 W/m²', '6.6 W/m²', '13.3 W/m²', '0.133 W/m²'], answer: 2,
      why: 'I = ½ c ε0 E0² = 0.5 × 3 × 10⁸ × 8.854 × 10⁻¹² × 100² = 13.3 W/m².',
      verify: () => near(inten(100), [26.5, 6.6, 13.3, 0.133]),
    },
    {
      id: 'q3', q: 'The electric field of a wave in vacuum is E = E0 sin(kx − ωt) with ω = 1.5 × 10⁹ rad/s. The wave number k is', options: ['0.2 m⁻¹', '5.0 m⁻¹', '0.5 m⁻¹', '50 m⁻¹'], answer: 1,
      why: 'Speed = ω/k = c, so k = ω/c = 1.5 × 10⁹ / 3 × 10⁸ = 5.0 rad/m.',
      verify: () => near(1.5e9 / C, [0.2, 5, 0.5, 50]),
    },
    {
      id: 'q4', q: 'Sunlight of intensity 1000 W/m² falls normally on a perfectly reflecting sheet of area 4.0 m². The force on the sheet is about', options: ['1.3 × 10⁻⁵ N', '8.0 × 10⁻⁶ N', '5.3 × 10⁻⁵ N', '2.7 × 10⁻⁵ N'], answer: 3,
      why: 'For reflection F = 2IA/c = 2 × 1000 × 4.0 / (3 × 10⁸) = 2.7 × 10⁻⁵ N.',
      verify: () => near((2 * 1000 * 4) / C, [1.3e-5, 8e-6, 5.3e-5, 2.7e-5]),
    },
    {
      id: 'q5', q: 'A transparent material has relative permittivity 4.0 and relative permeability 1.0 at the frequency used. The speed of EM waves in it is', options: ['1.5 × 10⁸ m/s', '3.0 × 10⁸ m/s', '7.5 × 10⁷ m/s', '6.0 × 10⁸ m/s'], answer: 0,
      why: 'v = c/√(μr εr) = 3 × 10⁸ / √(1 × 4) = 1.5 × 10⁸ m/s (refractive index 2).',
      verify: () => near(C / Math.sqrt(1 * 4), [1.5e8, 3e8, 7.5e7, 6e8]),
    },
  ],
};
