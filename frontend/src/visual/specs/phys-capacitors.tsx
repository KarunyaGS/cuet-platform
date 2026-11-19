/**
 * Chapter lab: Physics, Unit I, "Conductors, dielectrics and polarisation, capacitors, their combinations and stored energy".
 * The model: parallel plate capacitor C = ε0 K A / d, Q = C V, U = ½ C V², E = V / d. Status: Draft - unverified.
 * This file is also the worked example for new chapter labs: copy its shape.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const EPS0 = 8.8541878128e-12;
// A in cm², d in mm, K a pure number -> C in pF
const cPF = (A: number, d: number, K: number) => (EPS0 * K * (A * 1e-4)) / (d * 1e-3) * 1e12;

const pick = (r: number, opts: [number, number][]) => opts.reduce((best, [val, idx]) => (Math.abs(Math.log(r / val)) < Math.abs(Math.log(r / opts.find(([, i]) => i === best)![0])) ? idx : best), opts[0]![1]);

export const spec: Spec = {
  id: 'phys-capacitors',
  subject: 'Physics',
  lessonTitleStartsWith: 'Conductors, dielectrics and polarisation',
  afterHeading: 'Parallel plate capacitor without and with a dielectric medium',
  title: 'Parallel Plate Capacitor Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Change the plate area, the gap, the dielectric and the battery voltage of a parallel plate capacitor, and see the capacitance, charge, field and stored energy respond.',
  can: ['Slide the plates apart and watch C fall as 1/d', 'Slip in a dielectric and see C rise by the factor K', 'Record C for three gaps and fit ε0 from your own readings'],
  minutes: 10,
  vars: [
    { id: 'A', label: 'Plate area A', unit: 'cm²', min: 50, max: 500, step: 10, start: 200, digits: 0 },
    { id: 'd', label: 'Plate separation d', unit: 'mm', min: 0.5, max: 10, step: 0.5, start: 2, digits: 1 },
    { id: 'K', label: 'Dielectric constant K', unit: '', min: 1, max: 10, step: 1, start: 1, digits: 0 },
    { id: 'V', label: 'Battery voltage V', unit: 'V', min: 1, max: 24, step: 1, start: 12, digits: 0 },
  ],
  outs: [
    { id: 'C', label: 'Capacitance C = ε₀KA/d', unit: 'pF', fn: (v) => cPF(v.A!, v.d!, v.K!), digits: 1 },
    { id: 'Q', label: 'Charge Q = CV', unit: 'nC', fn: (v) => (cPF(v.A!, v.d!, v.K!) * v.V!) / 1000, digits: 2 },
    { id: 'E', label: 'Field between the plates E = V/d', unit: 'V/m', fn: (v) => (v.V! / (v.d! * 1e-3)), digits: 0 },
    { id: 'U', label: 'Stored energy U = ½CV²', unit: 'nJ', fn: (v) => (0.5 * cPF(v.A!, v.d!, v.K!) * v.V! * v.V!) / 1000, digits: 2 },
  ],
  graphs: [
    { id: 'c-d', title: 'Capacitance against plate separation', x: 'd', y: 'C' },
    { id: 'u-v', title: 'Stored energy against voltage', x: 'V', y: 'U' },
  ],
  sceneAlt: 'Two parallel plates connected to a battery. The gap, the plate length and the dielectric shading follow the sliders, and the number of plus and minus signs follows the stored charge.',
  scene: ({ v, o }) => {
    const gap = 12 + (v.d! / 10) * 70;
    const len = 90 + ((v.A! - 50) / 450) * 190;
    const x0 = 200 - len / 2;
    const top = 115 - gap / 2;
    const bot = 115 + gap / 2;
    const signs = Math.max(2, Math.min(14, Math.round(o.Q! / 1.1)));
    const slabOpacity = (v.K! - 1) / 9;
    const arrows = Math.min(9, Math.max(2, Math.round(o.E! / 2500)));
    return (
      <g>
        <rect x={x0} y={top} width={len} height={gap} fill="#c45e42" opacity={0.08 + 0.55 * slabOpacity} />
        <rect x={x0} y={top - 6} width={len} height={6} fill="#18443b" />
        <rect x={x0} y={bot} width={len} height={6} fill="#18443b" />
        {Array.from({ length: signs }, (_, i) => {
          const x = x0 + ((i + 0.5) * len) / signs;
          return (
            <g key={i} fontSize={13} fontWeight="bold" textAnchor="middle">
              <text x={x} y={top - 9} fill="#c45e42">+</text>
              <text x={x} y={bot + 22} fill="#2563a8">−</text>
            </g>
          );
        })}
        {Array.from({ length: arrows }, (_, i) => {
          const x = x0 + ((i + 0.5) * len) / arrows;
          return <path key={i} d={`M ${x} ${top + 3} L ${x} ${bot - 6} m -3 -4 l 3 4 l 3 -4`} stroke="#18443b" strokeWidth={1.2} fill="none" opacity={0.7} />;
        })}
        <path d={`M ${x0 + len / 2} ${top - 6} V 30 H 60 V 205 H ${x0 + len / 2} V ${bot + 6}`} fill="none" stroke="#7c8595" strokeWidth={1.5} />
        <rect x={52} y={104} width={16} height={22} fill="#fff" stroke="#18443b" strokeWidth={2} />
        <text x={60} y={118} fontSize={10} textAnchor="middle" fill="#18443b">{v.V}V</text>
        <text x={x0 + len + 8} y={118} fontSize={11} fill="#4d5768">d = {fmt(v.d!, 1)} mm</text>
        <text x={200} y={226} fontSize={11} textAnchor="middle" fill="#4d5768">K = {v.K} · A = {v.A} cm²</text>
      </g>
    );
  },
  discover: [
    'Drag the plate separation d. The plates move and the capacitance changes: by how much?',
    'Raise the dielectric constant K and watch the shading in the gap and the stored charge.',
    'Raise the battery voltage and see which quantities change and which do not.',
  ],
  experiment: [
    'Keep A and V fixed. How does C change when d is doubled? Check the graph of C against d.',
    'Keep d fixed. Does C depend on V? Does Q?',
    'The energy graph is a curve, not a line: which power of V is it?',
  ],
  understand: [
    'C = ε₀KA/d depends only on the shape and the medium (A, d, K), not on the battery.',
    'Q = CV: the charge on the plates grows in proportion to the voltage and to C.',
    'The energy U = ½CV² grows as the square of the voltage, so doubling V gives four times the energy.',
    'A dielectric (K > 1) increases C by the factor K for the same plates and gap.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the gap', prompt: 'Move the plates twice as far apart (2 mm to 4 mm), keeping everything else the same. What happens to the capacitance?',
      base: { d: 2 }, test: { d: 4 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => pick(outs(test).C! / outs(base).C!, [[0.5, 0], [2, 1], [1, 2], [4, 3]]),
      why: ({ base, test, outs }) => `C = ε₀KA/d, so C is inversely proportional to d. At d = 2 mm, C = ${fmt(outs(base).C!, 1)} pF; at d = 4 mm, C = ${fmt(outs(test).C!, 1)} pF, half as much.`,
    },
    {
      id: 'p2', title: 'Slip in a dielectric', prompt: 'A slab of dielectric constant K = 4 fills the gap (K goes from 1 to 4). What happens to the capacitance?',
      base: { K: 1 }, test: { K: 4 }, options: ['It halves', 'It becomes four times as large', 'It stays the same', 'It becomes sixteen times as large'], answer: 1,
      verify: ({ base, test, outs }) => pick(outs(test).C! / outs(base).C!, [[0.5, 0], [4, 1], [1, 2], [16, 3]]),
      why: ({ base, test, outs }) => `C is proportional to K. C goes from ${fmt(outs(base).C!, 1)} pF to ${fmt(outs(test).C!, 1)} pF.`,
    },
    {
      id: 'p3', title: 'Double the voltage', prompt: 'The battery voltage is doubled (6 V to 12 V). What happens to the stored energy?',
      base: { V: 6 }, test: { V: 12 }, options: ['It doubles', 'It halves', 'It becomes four times as large', 'It stays the same'], answer: 2,
      verify: ({ base, test, outs }) => pick(outs(test).U! / outs(base).U!, [[2, 0], [0.5, 1], [4, 2], [1, 3]]),
      why: ({ base, test, outs }) => `U = ½CV² grows as V². U goes from ${fmt(outs(base).U!, 2)} nJ to ${fmt(outs(test).U!, 2)} nJ, four times as large (C did not change).`,
    },
    {
      id: 'p4', title: 'Bigger plates, smaller gap', prompt: 'The plate area is doubled and the gap is halved at the same time. What happens to the capacitance?',
      base: { A: 100, d: 4 }, test: { A: 200, d: 2 }, options: ['It doubles', 'It stays the same', 'It halves', 'It becomes four times as large'], answer: 3,
      verify: ({ base, test, outs }) => pick(outs(test).C! / outs(base).C!, [[2, 0], [1, 1], [0.5, 2], [4, 3]]),
      why: ({ base, test, outs }) => `C is proportional to A/d: doubling A doubles C and halving d doubles it again. C goes from ${fmt(outs(base).C!, 1)} pF to ${fmt(outs(test).C!, 1)} pF.`,
    },
  ],
  measure: {
    instruction: 'Keep the plate area, the dielectric and the voltage fixed. Record the capacitance for at least three different plate separations.',
    vary: 'd',
    record: ['C', 'Q'],
    fit: {
      xLabel: '1/d (mm⁻¹)',
      yLabel: 'C (pF)',
      x: (v) => 1 / v.d!,
      y: (_v, o) => o.C!,
      interpret: (slope, _i, v) => {
        const eps = (slope * 1e-12 * 1e-3) / (v.K! * v.A! * 1e-4);
        return `C against 1/d is a straight line through the origin, so C ∝ 1/d. The slope is C·d = ε₀KA = ${fmt(slope, 1)} pF·mm, which gives ε₀ = slope ÷ (K·A) ≈ ${fmt(eps, 2, true)} F/m (the accepted value is 8.85 × 10^-12 F/m).`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'The plates of an air-filled parallel plate capacitor have an area of 100 cm² and are 1 mm apart. Its capacitance is about', options: ['8.85 pF', '88.5 pF', '885 pF', '0.885 pF'], answer: 1,
      why: 'C = ε₀A/d = (8.85 × 10⁻¹² × 1.0 × 10⁻²)/(1.0 × 10⁻³) = 8.85 × 10⁻¹¹ F = 88.5 pF.',
      verify: () => pick(cPF(100, 1, 1), [[8.85, 0], [88.5, 1], [885, 2], [0.885, 3]]),
    },
    {
      id: 'q2', q: 'Two capacitors of 6 µF and 3 µF are connected in series. The equivalent capacitance is', options: ['9 µF', '4.5 µF', '2 µF', '1 µF'], answer: 2,
      why: 'In series 1/C = 1/6 + 1/3 = 1/2, so C = 2 µF.',
      verify: () => pick(1 / (1 / 6 + 1 / 3), [[9, 0], [4.5, 1], [2, 2], [1, 3]]),
    },
    {
      id: 'q3', q: 'A 10 µF capacitor is charged to 20 V. The energy stored in it is', options: ['2 mJ', '4 mJ', '1 mJ', '0.2 mJ'], answer: 0,
      why: 'U = ½CV² = ½ × 10 × 10⁻⁶ × 20² = 2 × 10⁻³ J = 2 mJ.',
      verify: () => pick(0.5 * 10e-6 * 400 * 1000, [[2, 0], [4, 1], [1, 2], [0.2, 3]]),
    },
    {
      id: 'q4', q: 'A parallel plate capacitor is charged and then disconnected from the battery. A slab of dielectric constant K = 5 is then slipped completely into the gap. The potential difference across the plates becomes', options: ['5 times as large', 'unchanged', '1/5 of its value', '25 times as large'], answer: 2,
      why: 'With the battery disconnected the charge Q stays fixed. C becomes 5C, so V = Q/C becomes V/5.',
      verify: () => pick(1 / 5, [[5, 0], [1, 1], [0.2, 2], [25, 3]]),
    },
    {
      id: 'q5', q: 'Three identical 6 µF capacitors are connected in series across a 12 V battery. The charge on each capacitor is', options: ['72 µC', '24 µC', '8 µC', '4 µC'], answer: 1,
      why: 'In series 1/C = 3/6, so C = 2 µF. The same charge flows onto each: Q = CV = 2 × 12 = 24 µC.',
      verify: () => pick(1 / (3 / 6) * 12, [[72, 0], [24, 1], [8, 2], [4, 3]]),
    },
  ],
};
