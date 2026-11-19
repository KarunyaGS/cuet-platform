/**
 * Chapter lab: Physics, Unit III, "Magnetic properties of materials: magnetisation, dia-, para- and ferromagnetism, and the effect of temperature".
 * The model: H = nI in a long solenoid, M = χH, B = μ0(H + M) = μ0 μr H with μr = 1 + χ, Curie's law χ = C/T (Tc = 0)
 * and the Curie–Weiss law χ = C/(T − Tc) above the Curie temperature. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const MU0 = 4 * Math.PI * 1e-7;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const chiOf = (Cm: number, T: number, Tc: number) => (Cm * 1e-3) / (T - Tc); // Cm in 10^-3 K

export const spec: Spec = {
  id: 'phys-magnetic-materials',
  subject: 'Physics',
  lessonTitleStartsWith: 'Magnetic properties of materials',
  afterHeading: 'Effect of temperature on magnetic properties',
  title: 'Magnetisation and Temperature Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Fill a long solenoid with a paramagnetic or Curie–Weiss material. Change the current, the temperature and the Curie temperature and watch H, χ, M and the field B respond, with the atomic moments lining up in the picture.',
  can: ['See χ fall as 1/T for a paramagnet', 'Watch χ grow as the temperature falls towards the Curie temperature', 'Recover the Curie constant from the slope of χ against 1/(T − Tc)'],
  minutes: 12,
  vars: [
    { id: 'n', label: 'Solenoid turns per metre n', unit: 'turns/m', min: 500, max: 5000, step: 500, start: 2000, digits: 0 },
    { id: 'I', label: 'Current I', unit: 'A', min: 0.5, max: 10, step: 0.5, start: 3, digits: 1 },
    { id: 'T', label: 'Temperature T', unit: 'K', min: 300, max: 1500, step: 50, start: 400, digits: 0 },
    { id: 'Tc', label: 'Curie temperature Tc (0 for a paramagnet)', unit: 'K', min: 0, max: 250, step: 25, start: 0, digits: 0 },
    { id: 'C', label: 'Curie constant C', unit: '×10⁻³ K', min: 1, max: 500, step: 1, start: 7, digits: 0 },
  ],
  outs: [
    { id: 'H', label: 'Magnetic intensity H = nI', unit: 'A/m', fn: (v) => v.n! * v.I!, digits: 0 },
    { id: 'chi', label: 'Susceptibility χ = C/(T − Tc)', unit: '', fn: (v) => chiOf(v.C!, v.T!, v.Tc!), digits: 3, sci: true },
    { id: 'M', label: 'Magnetisation M = χH', unit: 'A/m', fn: (v) => chiOf(v.C!, v.T!, v.Tc!) * v.n! * v.I!, digits: 2 },
    { id: 'B', label: 'Field inside B = μ₀(H + M)', unit: 'mT', fn: (v) => MU0 * (v.n! * v.I! + chiOf(v.C!, v.T!, v.Tc!) * v.n! * v.I!) * 1e3, digits: 4 },
    { id: 'dB', label: 'Extra field from the material μ₀M', unit: 'µT', fn: (v) => MU0 * chiOf(v.C!, v.T!, v.Tc!) * v.n! * v.I! * 1e6, digits: 3 },
  ],
  graphs: [
    { id: 'chi-t', title: 'Susceptibility against temperature', x: 'T', y: 'chi' },
    { id: 'm-i', title: 'Magnetisation against current', x: 'I', y: 'M' },
    { id: 'chi-tc', title: 'Susceptibility against Curie temperature', x: 'Tc', y: 'chi' },
  ],
  sceneAlt: 'A solenoid cross-section filled with small atomic arrows. The arrows turn from random directions towards the field as the susceptibility rises, schematic and exaggerated, and a bar shows the field B inside with its extra part from the material.',
  scene: ({ v, o }) => {
    const f = Math.min(0.97, o.chi! / (o.chi! + 0.002));
    const cols = 8, rows = 5;
    const rnd = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const coil = Math.max(4, Math.min(9, Math.round(v.n! / 600)));
    return (
      <g>
        <rect x={20} y={25} width={250} height={160} fill="#f7f9fb" stroke="#cbd2dc" />
        {Array.from({ length: coil }, (_, i) => <line key={i} x1={20 + (i + 0.5) * (250 / coil)} y1={18} x2={20 + (i + 0.5) * (250 / coil)} y2={192} stroke="#c45e42" strokeWidth={1.3} opacity={0.55} />)}
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = 20 + ((i % cols) + 0.5) * (250 / cols);
          const y = 25 + (Math.floor(i / cols) + 0.5) * (160 / rows);
          const ang = (1 - f) * (rnd(i + 1) * 360 - 180);
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${ang})`}>
              <path d="M -9 0 h 18 m -5 -3.5 l 5 3.5 l -5 3.5" stroke="#2563a8" strokeWidth={1.8} fill="none" />
            </g>
          );
        })}
        <text x={145} y={207} fontSize={11} textAnchor="middle" fill="#4d5768">atomic moments (alignment exaggerated) · T = {v.T} K</text>
        <text x={340} y={40} fontSize={11} textAnchor="middle" fill="#4d5768">B inside</text>
        <rect x={325} y={50} width={30} height={140} fill="#fff" stroke="#cbd2dc" />
        <rect x={325} y={190 - (o.H! * MU0 * 1e3 / 70) * 140} width={30} height={(o.H! * MU0 * 1e3 / 70) * 140} fill="#2563a8" opacity={0.8} />
        <rect x={325} y={190 - (o.B! / 70) * 140} width={30} height={Math.max(1.5, ((o.B! - o.H! * MU0 * 1e3) / 70) * 140)} fill="#c45e42" />
        <text x={340} y={208} fontSize={10} textAnchor="middle" fill="#4d5768">{fmt(o.B!, 3)} mT</text>
        <text x={340} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">χ = {fmt(o.chi!, 2, true)}</text>
      </g>
    );
  },
  discover: [
    'Raise the temperature with Tc = 0. How does χ change, and what happens to the atomic arrows?',
    'Now raise Tc towards the temperature: what happens to χ and to the field B?',
    'Change the current. Which of H, M and B follow it, and how?',
  ],
  experiment: [
    'Double T (Tc = 0). By what factor does χ change? Check the χ–T graph.',
    'Set Tc = 200 K and lower T from 400 K to 300 K: by what factor does χ change?',
    'Double the current: compare the changes in H, M and the extra field.',
  ],
  understand: [
    'In a long solenoid H = nI depends only on the free current; the material adds the magnetisation M = χH.',
    'B = μ₀(H + M) = μ₀(1 + χ)H = μ₀μᵣH, so a positive χ strengthens the field a little (paramagnet) and a very large χ strengthens it a lot (ferromagnet).',
    "Curie's law for a paramagnet: χ = C/T, so heating weakens the magnetisation.",
    'Above the Curie temperature a ferromagnet obeys χ = C/(T − Tc): χ grows as T falls towards Tc.',
  ],
  preds: [
    {
      id: 'p1', title: 'Heat a paramagnet', prompt: "A paramagnetic sample (Tc = 0) follows Curie's law. Its temperature is doubled from 300 K to 600 K. What happens to the susceptibility?",
      base: { Tc: 0, T: 300 }, test: { T: 600 }, options: ['It doubles', 'It halves', 'It stays the same', 'It falls to a quarter'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).chi! / outs(base).chi!, [2, 0.5, 1, 0.25]),
      why: ({ base, test, outs }) => `χ = C/T is inversely proportional to T. χ goes from ${fmt(outs(base).chi!, 2, true)} to ${fmt(outs(test).chi!, 2, true)}.`,
    },
    {
      id: 'p2', title: 'Double the current', prompt: 'The current in the solenoid is doubled from 2 A to 4 A with the same material at the same temperature. What happens to the magnetisation M?',
      base: { I: 2 }, test: { I: 4 }, options: ['It halves', 'It stays the same', 'It becomes four times as large', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).M! / outs(base).M!, [0.5, 1, 4, 2]),
      why: ({ base, test, outs }) => `M = χH and H = nI doubles while χ does not change. M goes from ${fmt(outs(base).M!, 2)} A/m to ${fmt(outs(test).M!, 2)} A/m.`,
    },
    {
      id: 'p3', title: 'Cool towards the Curie temperature', prompt: 'A ferromagnet with Tc = 200 K is above its Curie temperature. It is cooled from 400 K to 300 K. What happens to χ = C/(T − Tc)?',
      base: { Tc: 200, T: 400 }, test: { T: 300 }, options: ['It halves', 'It stays the same', 'It increases by a third', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).chi! / outs(base).chi!, [0.5, 1, 1.333, 2]),
      why: ({ base, test, outs }) => `T − Tc falls from 200 K to 100 K, so χ doubles: ${fmt(outs(base).chi!, 2, true)} to ${fmt(outs(test).chi!, 2, true)}.`,
    },
    {
      id: 'p4', title: 'Double the Curie constant', prompt: 'A different substance has twice the Curie constant (C from 5 to 10, in units of 10⁻³ K) at the same temperature. What happens to its susceptibility?',
      base: { C: 5 }, test: { C: 10 }, options: ['It stays the same', 'It falls to a quarter', 'It halves', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).chi! / outs(base).chi!, [1, 0.25, 0.5, 2]),
      why: ({ base, test, outs }) => `χ = C/(T − Tc) is proportional to C. χ goes from ${fmt(outs(base).chi!, 2, true)} to ${fmt(outs(test).chi!, 2, true)}.`,
    },
  ],
  measure: {
    instruction: 'Keep Tc and C fixed and change the temperature T. Record χ for at least three temperatures, then plot χ against 1/(T − Tc). The slope is the Curie constant.',
    vary: 'T',
    record: ['chi', 'M'],
    fit: {
      xLabel: '1/(T − Tc) (K⁻¹)',
      yLabel: 'χ',
      x: (v) => 1 / (v.T! - v.Tc!),
      y: (_v, o) => o.chi!,
      interpret: (slope, _i, v) => `χ = C/(T − Tc) gives a straight line through the origin when plotted against 1/(T − Tc). The slope is the Curie constant C = ${fmt(slope * 1e3, 2)} × 10⁻³ K (you set ${v.C} × 10⁻³ K).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A long solenoid has 1500 turns per metre and carries 2 A. The magnetic intensity H inside it is', options: ['300 A/m', '3000 A/m', '1500 A/m', '750 A/m'], answer: 1,
      why: 'H = nI = 1500 × 2 = 3000 A/m, whatever material fills the solenoid.',
      verify: () => near(1500 * 2, [300, 3000, 1500, 750]),
    },
    {
      id: 'q2', q: "A paramagnetic substance has susceptibility 2.4 × 10⁻⁴ at 300 K. According to Curie's law its susceptibility at 400 K is", options: ['3.2 × 10⁻⁴', '1.8 × 10⁻⁴', '2.4 × 10⁻⁴', '0.6 × 10⁻⁴'], answer: 1,
      why: "Curie's law χ ∝ 1/T, so χ(400 K) = 2.4 × 10⁻⁴ × 300/400 = 1.8 × 10⁻⁴.",
      verify: () => near(2.4e-4 * (300 / 400), [3.2e-4, 1.8e-4, 2.4e-4, 0.6e-4]),
    },
    {
      id: 'q3', q: 'A material of susceptibility 5 × 10⁻⁴ is placed in a magnetic intensity H = 4000 A/m. Its magnetisation is', options: ['8 A/m', '0.2 A/m', '20 A/m', '2 A/m'], answer: 3,
      why: 'M = χH = (5 × 10⁻⁴)(4000) = 2 A/m.',
      verify: () => near(5e-4 * 4000, [8, 0.2, 20, 2]),
    },
    {
      id: 'q4', q: 'Iron (Curie temperature 1043 K) is cooled from 1243 K to 1143 K, both above Tc. Its susceptibility χ = C/(T − Tc) becomes', options: ['2 times as large', 'half as large', 'unchanged', '1.5 times as large'], answer: 0,
      why: 'T − Tc falls from 200 K to 100 K, so χ doubles. Below Tc the iron would become ferromagnetic.',
      verify: () => near(chiOf(1, 1143, 1043) / chiOf(1, 1243, 1043), [2, 0.5, 1, 1.5]),
    },
    {
      id: 'q5', q: 'A ferromagnetic rod of relative permeability 2000 fills a long solenoid of 500 turns per metre carrying 0.40 A. The field inside is about (μ₀ = 4π × 10⁻⁷ T m A⁻¹)', options: ['0.50 T', '0.050 T', '0.25 T', '1.0 T'], answer: 0,
      why: 'B = μ₀μᵣnI = (4π × 10⁻⁷)(2000)(500)(0.40) = 0.50 T, 2000 times the field without the rod.',
      verify: () => near(MU0 * 2000 * 500 * 0.4, [0.5, 0.05, 0.25, 1.0]),
    },
  ],
};
