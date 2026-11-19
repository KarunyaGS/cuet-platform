/**
 * Chapter lab: Physics, Unit III, "The moving coil galvanometer, its current sensitivity, and conversion into an ammeter and a voltmeter".
 * The model: NBA I = kφ so φ = (NBA/k) I; current sensitivity φ/I = NBA/k; full-scale current from a 30° deflection; shunt S = Ig G/(I − Ig)
 * for an ammeter; series resistance R = V/Ig − G for a voltmeter (V = 5 V). Coil area 4 cm², coil resistance G = 50 Ω. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const AREA = 4e-4; // m²
const G = 50; // ohm
const FS = Math.PI / 6; // full scale deflection, 30 degrees
const VRANGE = 5; // volt
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
const deg = (r: number) => (r * 180) / Math.PI;
// k in 1e-7 N m/rad, I in µA
const perAmp = (N: number, B: number, k: number) => (N * B * AREA) / (k * 1e-7); // rad per ampere
const phi = (N: number, B: number, k: number, I: number) => perAmp(N, B, k) * I * 1e-6; // rad
const igFull = (N: number, B: number, k: number) => FS / perAmp(N, B, k); // ampere
const shunt = (Ig: number, Irange: number) => (Ig * G) / (Irange - Ig); // ohm

export const spec: Spec = {
  id: 'phys-moving-coil-galvanometer',
  subject: 'Physics',
  lessonTitleStartsWith: 'The moving coil galvanometer',
  afterHeading: 'Current sensitivity and voltage sensitivity',
  title: 'Moving Coil Galvanometer Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Build a moving coil galvanometer from its turns, field and spring, send a small current through it and watch the needle deflect. Then see the shunt and the series resistor needed to make it an ammeter or a voltmeter.',
  can: ['See the deflection grow in proportion to the current', 'Compare the effect of N, B and the spring constant k on sensitivity', 'Find the spring constant of the suspension from your own readings'],
  minutes: 12,
  vars: [
    { id: 'N', label: 'Turns in the coil N', unit: '', min: 20, max: 100, step: 10, start: 50, digits: 0 },
    { id: 'B', label: 'Radial field B', unit: 'T', min: 0.05, max: 0.4, step: 0.05, start: 0.2, digits: 2 },
    { id: 'k', label: 'Torsion constant k of the spring', unit: '×10⁻⁷ N m/rad', min: 5, max: 50, step: 5, start: 20, digits: 0 },
    { id: 'I', label: 'Current I through the coil', unit: 'µA', min: 1, max: 100, step: 1, start: 30, digits: 0 },
    { id: 'Ir', label: 'Ammeter range I', unit: 'A', min: 0.1, max: 5, step: 0.1, start: 1, digits: 1 },
  ],
  outs: [
    { id: 'phi', label: 'Deflection φ = NBAI/k', unit: '°', fn: (v) => deg(phi(v.N!, v.B!, v.k!, v.I!)), digits: 2 },
    { id: 'Si', label: 'Current sensitivity φ/I = NBA/k', unit: '°/µA', fn: (v) => deg(perAmp(v.N!, v.B!, v.k!)) * 1e-6, digits: 4 },
    { id: 'Ig', label: 'Full-scale current Ig (30° deflection)', unit: 'µA', fn: (v) => igFull(v.N!, v.B!, v.k!) * 1e6, digits: 1 },
    { id: 'S', label: 'Shunt for the ammeter range, S = IgG/(I − Ig)', unit: 'mΩ', fn: (v) => shunt(igFull(v.N!, v.B!, v.k!), v.Ir!) * 1e3, digits: 3 },
    { id: 'Rs', label: 'Series resistor for 5 V voltmeter, V/Ig − G', unit: 'kΩ', fn: (v) => (VRANGE / igFull(v.N!, v.B!, v.k!) - G) * 1e-3, digits: 2 },
  ],
  graphs: [
    { id: 'phi-i', title: 'Deflection against current', x: 'I', y: 'phi' },
    { id: 'si-n', title: 'Current sensitivity against turns', x: 'N', y: 'Si' },
    { id: 's-ir', title: 'Shunt resistance against ammeter range', x: 'Ir', y: 'S' },
  ],
  sceneAlt: 'A dial with a needle between the poles of a magnet. The needle angle follows the current and the sensitivity, the number of coil turns drawn follows N, the field lines get denser with B, and a spring with fewer coils appears stiffer as k grows.',
  scene: ({ v, o }) => {
    const a = Math.max(-62, Math.min(62, o.phi!));
    const turns = Math.round(v.N! / 15);
    const lines = Math.round(v.B! * 20);
    const cx = 200, cy = 170;
    return (
      <g>
        <path d={`M ${cx - 105} ${cy} A 105 105 0 0 1 ${cx + 105} ${cy}`} fill="none" stroke="#cbd2dc" strokeWidth={2} />
        {Array.from({ length: 13 }, (_, i) => {
          const t = ((-60 + i * 10) * Math.PI) / 180;
          return <line key={i} x1={cx + Math.sin(t) * 98} y1={cy - Math.cos(t) * 98} x2={cx + Math.sin(t) * 106} y2={cy - Math.cos(t) * 106} stroke="#7c8595" strokeWidth={i % 3 === 0 ? 2 : 1} />;
        })}
        <line x1={cx} y1={cy} x2={cx + Math.sin((a * Math.PI) / 180) * 92} y2={cy - Math.cos((a * Math.PI) / 180) * 92} stroke="#c45e42" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={6} fill="#18443b" />
        <rect x={20} y={110} width={60} height={50} fill="#2563a8" /><text x={50} y={140} fontSize={14} textAnchor="middle" fill="#fff">N</text>
        <rect x={320} y={110} width={60} height={50} fill="#c45e42" /><text x={350} y={140} fontSize={14} textAnchor="middle" fill="#fff">S</text>
        {Array.from({ length: lines }, (_, i) => <path key={i} d={`M 80 ${112 + (i * 46) / Math.max(1, lines - 1)} H 320`} stroke="#2563a8" strokeWidth={1} opacity={0.35} />)}
        <rect x={140} y={112} width={120} height={46} fill="none" stroke="#18443b" strokeWidth={1} opacity={0.0} />
        {Array.from({ length: turns }, (_, i) => <rect key={i} x={152 + i} y={118 + i * 0.5} width={96 - 2 * i} height={34 - i} fill="none" stroke="#18443b" strokeWidth={1.2} opacity={0.75} />)}
        <path d={`M ${cx} ${cy + 8} ${Array.from({ length: Math.max(3, Math.round(12 - v.k! / 5)) }, (_, i) => `l ${i % 2 ? -7 : 7} 3.4`).join(' ')}`} stroke="#7c8595" strokeWidth={1.4} fill="none" />
        <text x={cx} y={30} fontSize={12} textAnchor="middle" fill="#18443b">φ = {fmt(o.phi!, 1)}° · Ig = {fmt(o.Ig!, 0)} µA</text>
        <text x={cx} y={48} fontSize={11} textAnchor="middle" fill="#4d5768">N = {v.N} · B = {v.B} T · k = {v.k}×10⁻⁷ N m/rad</text>
        <text x={cx} y={224} fontSize={11} textAnchor="middle" fill="#4d5768">Shunt for {v.Ir} A: {fmt(o.S!, 2)} mΩ · series for 5 V: {fmt(o.Rs!, 1)} kΩ</text>
      </g>
    );
  },
  discover: [
    'Drag the current I. The needle swings: is the deflection proportional to the current?',
    'Change N, B and the spring constant k one at a time and note which make the galvanometer more sensitive.',
    'Raise the ammeter range and watch the shunt resistance shrink.',
  ],
  experiment: [
    'Double B at fixed current. What happens to the deflection and to the full-scale current?',
    'Double k. Is the galvanometer more or less sensitive?',
    'Move the ammeter range from 1 A to 2 A. How does the shunt change?',
  ],
  understand: [
    'The magnetic torque NBAI balances the spring torque kφ, so φ = (NBA/k)I.',
    'The current sensitivity φ/I = NBA/k grows with N, B and A and falls with a stiffer spring.',
    'An ammeter is made by adding a small shunt in parallel: S = IgG/(I − Ig).',
    'A voltmeter is made by adding a large resistance in series: R = V/Ig − G.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the field', prompt: 'The radial magnetic field is doubled from 0.1 T to 0.2 T with the same current. What happens to the deflection?',
      base: { B: 0.1 }, test: { B: 0.2 }, options: ['It halves', 'It stays the same', 'It doubles', 'It becomes four times as large'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).phi! / outs(base).phi!, [0.5, 1, 2, 4]),
      why: ({ base, test, outs }) => `φ = NBAI/k is proportional to B. φ goes from ${fmt(outs(base).phi!, 2)}° to ${fmt(outs(test).phi!, 2)}°.`,
    },
    {
      id: 'p2', title: 'A stiffer spring', prompt: 'The torsion constant of the spring is doubled from 10 to 20 (×10⁻⁷ N m/rad). What happens to the deflection for the same current?',
      base: { k: 10 }, test: { k: 20 }, options: ['It doubles', 'It halves', 'It stays the same', 'It falls to a quarter'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).phi! / outs(base).phi!, [2, 0.5, 1, 0.25]),
      why: ({ base, test, outs }) => `φ is inversely proportional to k. φ goes from ${fmt(outs(base).phi!, 2)}° to ${fmt(outs(test).phi!, 2)}°.`,
    },
    {
      id: 'p3', title: 'More turns', prompt: 'The number of turns in the coil is doubled from 30 to 60. What happens to the current sensitivity φ/I?',
      base: { N: 30 }, test: { N: 60 }, options: ['It halves', 'It stays the same', 'It becomes four times as large', 'It doubles'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).Si! / outs(base).Si!, [0.5, 1, 4, 2]),
      why: ({ base, test, outs }) => `φ/I = NBA/k is proportional to N. It goes from ${fmt(outs(base).Si!, 4)} °/µA to ${fmt(outs(test).Si!, 4)} °/µA.`,
    },
    {
      id: 'p4', title: 'Double the ammeter range', prompt: 'The galvanometer is turned into an ammeter. The range is doubled from 1 A to 2 A. What happens to the shunt resistance needed?',
      base: { Ir: 1 }, test: { Ir: 2 }, options: ['It doubles', 'It stays the same', 'It becomes four times as large', 'It becomes half as large'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).S! / outs(base).S!, [2, 1, 4, 0.5]),
      why: ({ base, test, outs }) => `S = IgG/(I − Ig) ≈ IgG/I, since Ig is tiny. S goes from ${fmt(outs(base).S!, 3)} mΩ to ${fmt(outs(test).S!, 3)} mΩ.`,
    },
  ],
  measure: {
    instruction: 'Keep N, B and k fixed and change the current I. Record the deflection for at least three currents, then plot φ (degrees) against I (µA). The slope is the current sensitivity, which lets you find the spring constant.',
    vary: 'I',
    record: ['phi', 'Ig'],
    fit: {
      xLabel: 'I (µA)',
      yLabel: 'φ (degrees)',
      x: (v) => v.I!,
      y: (_v, o) => o.phi!,
      interpret: (slope, _i, v) => {
        const perA = ((slope * Math.PI) / 180) * 1e6;
        const k = (v.N! * v.B! * AREA) / perA;
        return `φ against I is a straight line through the origin. The slope is the current sensitivity ${fmt(slope, 4)} °/µA, i.e. NBA/k = ${fmt(perA, 0)} rad/A. Then k = NBA ÷ (slope) ≈ ${fmt(k * 1e7, 1)} × 10⁻⁷ N m/rad (you set ${v.k}).`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'A galvanometer coil has 50 turns of area 2.0 cm² in a field of 0.40 T. The spring constant is 2.0 × 10⁻⁶ N m/rad. For a current of 100 µA the deflection is', options: ['0.1 rad', '0.2 rad', '0.4 rad', '2 rad'], answer: 1,
      why: 'φ = NBAI/k = (50)(0.40)(2.0 × 10⁻⁴)(1.0 × 10⁻⁴)/(2.0 × 10⁻⁶) = 0.2 rad.',
      verify: () => near((50 * 0.4 * 2e-4 * 1e-4) / 2e-6, [0.1, 0.2, 0.4, 2]),
    },
    {
      id: 'q2', q: 'A galvanometer of resistance 100 Ω gives full-scale deflection for 2 mA. To convert it into an ammeter reading up to 1 A, the shunt needed is about', options: ['0.1 Ω', '2 Ω', '0.2 Ω', '20 Ω'], answer: 2,
      why: 'S = IgG/(I − Ig) = (2 × 10⁻³)(100)/(1 − 0.002) = 0.2/0.998 ≈ 0.2 Ω, in parallel with the galvanometer.',
      verify: () => near((2e-3 * 100) / (1 - 2e-3), [0.1, 2, 0.2, 20]),
    },
    {
      id: 'q3', q: 'A galvanometer of resistance 60 Ω shows full scale for 3 mA. The resistance that must be put in series to make a voltmeter reading up to 3 V is', options: ['940 Ω', '1000 Ω', '60 Ω', '9.4 Ω'], answer: 0,
      why: 'R = V/Ig − G = 3/(3 × 10⁻³) − 60 = 1000 − 60 = 940 Ω.',
      verify: () => near(3 / 3e-3 - 60, [940, 1000, 60, 9.4]),
    },
    {
      id: 'q4', q: 'The number of turns of a galvanometer coil is doubled (the wire is thinner, so its resistance also doubles). The current sensitivity and the voltage sensitivity become, respectively,', options: ['unchanged and doubled', 'doubled and unchanged', 'doubled and doubled', 'doubled and halved'], answer: 1,
      why: 'Current sensitivity NBA/k is proportional to N, so it doubles. Voltage sensitivity NBA/(kG) has G doubling as well, so the ratio N/G is unchanged.',
      verify: () => (Math.abs(2 / 1 - 2) < 1e-12 && Math.abs(2 / 2 - 1) < 1e-12 ? 1 : -1),
    },
    {
      id: 'q5', q: 'A coil of 30 turns and area 5 cm² in a radial field of 0.10 T hangs on a spring of torsion constant 1.5 × 10⁻⁷ N m/rad. Its current sensitivity is', options: ['10³ rad/A', '10⁵ rad/A', '10² rad/A', '10⁴ rad/A'], answer: 3,
      why: 'φ/I = NBA/k = (30)(0.10)(5 × 10⁻⁴)/(1.5 × 10⁻⁷) = 1.0 × 10⁴ rad/A (0.01 rad per µA).',
      verify: () => near((30 * 0.1 * 5e-4) / 1.5e-7, [1e3, 1e5, 1e2, 1e4]),
    },
  ],
};
