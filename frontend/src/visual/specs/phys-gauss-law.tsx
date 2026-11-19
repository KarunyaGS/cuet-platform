/**
 * Chapter lab: Physics, Unit I, "Electric flux and Gauss's theorem: fields of a long wire, an infinite sheet and a thin spherical shell".
 * The model: thin spherical shell (E = kq/r² outside, 0 inside, flux q_enc/ε0 through a concentric Gaussian sphere) and a long
 * straight wire (E = 2kλ/r = λ/2πε0r). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const K = 9e9;
const EPS0 = 8.85e-12;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
// q in nC, R and r in cm, lambda in nC/m
const eShell = (q: number, R: number, r: number) => (r >= R ? (K * q * 1e-9) / (r * 1e-2) ** 2 : 0);
const flux = (q: number, R: number, r: number) => (r >= R ? (q * 1e-9) / EPS0 : 0);
const eWire = (lam: number, r: number) => (2 * K * lam * 1e-9) / (r * 1e-2);

export const spec: Spec = {
  id: 'phys-gauss-law',
  subject: 'Physics',
  lessonTitleStartsWith: "Electric flux and Gauss's theorem",
  afterHeading: 'Field of a uniformly charged thin spherical shell',
  title: "Gauss's Law Lab: Shell and Wire",
  format: 'Virtual experiment · graph exploration',
  blurb: 'Grow a Gaussian sphere around a charged shell and a coaxial distance from a long wire. See the field switch off inside the shell, fall as 1/r² outside it and as 1/r near a wire, while the flux depends only on the charge enclosed.',
  can: ['Move the Gaussian sphere across the shell and watch E and the flux jump', 'Compare the 1/r² shell field with the 1/r wire field', 'Recover the linear charge density of a wire from your own readings'],
  minutes: 10,
  vars: [
    { id: 'q', label: 'Shell charge q', unit: 'nC', min: 1, max: 20, step: 1, start: 4, digits: 0 },
    { id: 'R', label: 'Shell radius R', unit: 'cm', min: 2, max: 20, step: 1, start: 10, digits: 0 },
    { id: 'r', label: 'Gaussian radius / distance r', unit: 'cm', min: 1, max: 40, step: 1, start: 20, digits: 0 },
    { id: 'lam', label: 'Wire charge density λ', unit: 'nC/m', min: 1, max: 20, step: 1, start: 5, digits: 0 },
  ],
  outs: [
    { id: 'Es', label: 'Shell field at r', unit: 'V/m', fn: (v) => eShell(v.q!, v.R!, v.r!), digits: 1 },
    { id: 'Phi', label: 'Flux through the Gaussian sphere, q_enc/ε₀', unit: 'N m²/C', fn: (v) => flux(v.q!, v.R!, v.r!), digits: 1 },
    { id: 'sig', label: 'Shell surface density σ = q/4πR²', unit: 'nC/m²', fn: (v) => (v.q! * 1) / (4 * Math.PI * (v.R! * 1e-2) ** 2), digits: 2 },
    { id: 'Ew', label: 'Long wire field at r, 2kλ/r', unit: 'V/m', fn: (v) => eWire(v.lam!, v.r!), digits: 1 },
  ],
  graphs: [
    { id: 'es-r', title: 'Shell field against r', x: 'r', y: 'Es' },
    { id: 'phi-r', title: 'Flux through the Gaussian sphere against r', x: 'r', y: 'Phi' },
    { id: 'ew-r', title: 'Wire field against r', x: 'r', y: 'Ew' },
  ],
  sceneAlt: 'A charged spherical shell drawn as a circle with a dashed Gaussian sphere around it. The shell and Gaussian radii follow the sliders, field arrows appear only outside the shell and shrink with distance, and nothing is drawn inside.',
  scene: ({ v, o }) => {
    const cx = 130, cy = 115, s = 2.1;
    const Rp = v.R! * s, rp = v.r! * s;
    const outside = v.r! >= v.R!;
    const n = 8;
    const len = Math.min(34, 6 + Math.sqrt(o.Es!) * 0.5);
    return (
      <g>
        <circle cx={cx} cy={cy} r={rp} fill="none" stroke="#2563a8" strokeWidth={1.4} strokeDasharray="5 4" />
        <circle cx={cx} cy={cy} r={Rp} fill="#fbeee8" stroke="#c45e42" strokeWidth={3} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI;
          return <text key={i} x={cx + Math.cos(a) * (Rp - 8)} y={cy + Math.sin(a) * (Rp - 8) + 4} fontSize={10} textAnchor="middle" fill="#c45e42">+</text>;
        })}
        {outside && Array.from({ length: n }, (_, i) => {
          const a = (i / n) * 2 * Math.PI;
          const x0 = cx + Math.cos(a) * rp, y0 = cy + Math.sin(a) * rp;
          const x1 = cx + Math.cos(a) * (rp + len), y1 = cy + Math.sin(a) * (rp + len);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#18443b" strokeWidth={1.8} />;
        })}
        <text x={cx} y={cy + 4} fontSize={11} textAnchor="middle" fill="#18443b">{outside ? '' : 'E = 0'}</text>
        <text x={310} y={80} fontSize={11} textAnchor="middle" fill="#4d5768">{outside ? 'Gaussian sphere encloses q' : 'encloses no charge'}</text>
        <text x={310} y={100} fontSize={12} textAnchor="middle" fill="#18443b">Φ = {fmt(o.Phi!, 0)} N m²/C</text>
        <text x={310} y={140} fontSize={11} textAnchor="middle" fill="#4d5768">E(shell) = {fmt(o.Es!, 1)} V/m</text>
        <text x={310} y={160} fontSize={11} textAnchor="middle" fill="#4d5768">E(wire) = {fmt(o.Ew!, 1)} V/m</text>
        <text x={200} y={226} fontSize={11} textAnchor="middle" fill="#4d5768">R = {v.R} cm · r = {v.r} cm · q = {v.q} nC</text>
      </g>
    );
  },
  discover: [
    'Drag r from small to large. When the Gaussian sphere crosses the shell radius R, what happens to the field and the flux?',
    'Inside the shell, change the shell charge. Does the field there change?',
    'Look at the shell field graph and the wire field graph side by side: which curve falls faster?',
  ],
  experiment: [
    'Put r outside the shell and double r. How many times smaller is the shell field? Compare with the wire field.',
    'Keep r outside the shell and change R only. Does the field at r change? Does the flux?',
    'Double the shell charge. How do the flux and the field respond?',
  ],
  understand: [
    "Gauss's law: the total flux through a closed surface is q_enc/ε₀. Only the charge inside counts, so the flux does not change when r changes outside the shell.",
    'Outside a charged shell the field is kq/r², as if all the charge were at the centre; inside it is zero.',
    'A long wire gives E = λ/(2πε₀r) = 2kλ/r, which falls as 1/r, more slowly than the shell field.',
    'The field jumps by σ/ε₀ on crossing the charged surface.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the distance from the shell', prompt: 'Outside the shell (R = 5 cm), move the observation point from r = 10 cm to r = 20 cm. What happens to the field?',
      base: { R: 5, r: 10 }, test: { r: 20 }, options: ['It halves', 'It falls to a quarter', 'It doubles', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).Es! / outs(base).Es!, [0.5, 0.25, 2, 1]),
      why: ({ base, test, outs }) => `Outside the shell E = kq/r², an inverse-square law. E goes from ${fmt(outs(base).Es!, 1)} V/m to ${fmt(outs(test).Es!, 1)} V/m, one quarter.`,
    },
    {
      id: 'p2', title: 'Charge more, look inside', prompt: 'The point is inside the shell (r = 6 cm, R = 15 cm). The shell charge is doubled from 4 nC to 8 nC. What happens to the field at the point?',
      base: { q: 4, R: 15, r: 6 }, test: { q: 8 }, options: ['It doubles', 'It stays zero', 'It halves', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).Es!) < 1e-12 ? 1 : near(outs(test).Es! / outs(base).Es!, [2, 0, 0.5, 4])),
      why: ({ outs, test }) => `A Gaussian sphere inside the shell encloses no charge, so the flux and the field are zero (E = ${fmt(outs(test).Es!, 1)} V/m) whatever the shell charge.`,
    },
    {
      id: 'p3', title: 'Bigger Gaussian sphere', prompt: 'The shell has R = 10 cm. The Gaussian sphere around it grows from r = 15 cm to r = 30 cm. What happens to the total flux through it?',
      base: { R: 10, r: 15 }, test: { r: 30 }, options: ['It falls to a quarter', 'It halves', 'It stays the same', 'It doubles'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).Phi! / outs(base).Phi!, [0.25, 0.5, 1, 2]),
      why: ({ base, test, outs }) => `The field falls as 1/r² but the area grows as r², so the flux stays at q/ε₀: ${fmt(outs(base).Phi!, 1)} N m²/C before and ${fmt(outs(test).Phi!, 1)} N m²/C after.`,
    },
    {
      id: 'p4', title: 'Double the distance from a wire', prompt: 'For the long charged wire, the distance r is doubled from 5 cm to 10 cm. What happens to the field?',
      base: { r: 5 }, test: { r: 10 }, options: ['It halves', 'It falls to a quarter', 'It doubles', 'It stays the same'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).Ew! / outs(base).Ew!, [0.5, 0.25, 2, 1]),
      why: ({ base, test, outs }) => `E = 2kλ/r for a long wire falls as 1/r only. E goes from ${fmt(outs(base).Ew!, 1)} V/m to ${fmt(outs(test).Ew!, 1)} V/m.`,
    },
  ],
  measure: {
    instruction: 'Record the long wire field for at least three different distances r (keep λ fixed), then plot E against 1/r. The slope gives the charge per unit length.',
    vary: 'r',
    record: ['Ew', 'Es'],
    fit: {
      xLabel: '1/r (m⁻¹)',
      yLabel: 'E (V/m)',
      x: (v) => 1 / (v.r! * 1e-2),
      y: (_v, o) => o.Ew!,
      interpret: (slope, _i, v) => `For a long wire E = 2kλ/r, so E against 1/r is a straight line through the origin with slope 2kλ = ${fmt(slope, 1)} V. Then λ = slope ÷ 2k ≈ ${fmt((slope / (2 * K)) * 1e9, 2)} nC/m (you set ${v.lam} nC/m).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A closed surface encloses a net charge of 8.85 nC. The total electric flux through it is (ε₀ = 8.85 × 10⁻¹² C² N⁻¹ m⁻²)', options: ['10 N m²/C', '100 N m²/C', '8850 N m²/C', '1000 N m²/C'], answer: 3,
      why: 'Φ = q/ε₀ = (8.85 × 10⁻⁹)/(8.85 × 10⁻¹²) = 1000 N m² C⁻¹, whatever the shape of the surface.',
      verify: () => near((8.85e-9) / EPS0, [10, 100, 8850, 1000]),
    },
    {
      id: 'q2', q: 'A long straight wire carries 2 nC per metre. The electric field 6 cm from it is', options: ['300 V/m', '600 V/m', '1200 V/m', '60 V/m'], answer: 1,
      why: 'E = 2kλ/r = 2(9 × 10⁹)(2 × 10⁻⁹)/0.06 = 36/0.06 = 600 V/m.',
      verify: () => near(eWire(2, 6), [300, 600, 1200, 60]),
    },
    {
      id: 'q3', q: 'A thin infinite sheet carries a surface charge density of 8.85 nC/m². The field near it, on either side, is', options: ['1000 N/C', '250 N/C', '500 N/C', '8850 N/C'], answer: 2,
      why: 'For a single sheet E = σ/2ε₀ = (8.85 × 10⁻⁹)/(2 × 8.85 × 10⁻¹²) = 500 N/C on each side, independent of the distance.',
      verify: () => near(8.85e-9 / (2 * EPS0), [1000, 250, 500, 8850]),
    },
    {
      id: 'q4', q: 'A thin spherical shell of radius 15 cm carries 3 nC. The field at 30 cm from its centre, and at 5 cm from its centre, are respectively', options: ['300 N/C and 0', '300 N/C and 1200 N/C', '1200 N/C and 0', '0 and 300 N/C'], answer: 0,
      why: 'Outside: E = kq/r² = (9 × 10⁹)(3 × 10⁻⁹)/0.09 = 300 N/C. Inside the shell the field is zero.',
      verify: () => (Math.abs(eShell(3, 15, 30) - 300) < 1e-6 && eShell(3, 15, 5) === 0 ? 0 : -1),
    },
    {
      id: 'q5', q: 'A point charge of 2.0 nC sits at one corner of a cube. The flux through the cube is (ε₀ = 8.85 × 10⁻¹² C² N⁻¹ m⁻²)', options: ['226 N m²/C', '56.5 N m²/C', '14.1 N m²/C', '28.2 N m²/C'], answer: 3,
      why: 'Eight identical cubes meet at the corner and together enclose the charge, so the cube gets one eighth: q/8ε₀ = (2 × 10⁻⁹)/(8 × 8.85 × 10⁻¹²) ≈ 28.2 N m²/C.',
      verify: () => near(2e-9 / (8 * EPS0), [226, 56.5, 14.1, 28.2]),
    },
  ],
};
