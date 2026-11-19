/**
 * Coulomb's law and electric-field physics for the Electric Field Lab (Physics 322, Unit 1).
 * Plain functions, no rendering: the page draws what these return and the tests check them on their own.
 *
 * Display units: charges in microcoulombs (µC), positions and distances in centimetres (cm); forces in newtons (N) and
 * fields in N/C. The physics is done in SI: F = k q₁q₂ / r², E = k q / r², with k = 8.99 × 10⁹ N m² C⁻² (vacuum).
 * Directions follow from the positions. Status: Draft - unverified (no subject-expert review yet).
 */
export const K = 8.9875517923e9;

export interface Charge { id: number; x: number; y: number; q: number }
export interface Vec { x: number; y: number }
export interface World { w: number; h: number }

const UC = 1e-6;
const CM = 1e-2;

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Coulomb force magnitude (N) between charges q1 and q2 (µC) a distance r (cm) apart. */
export function forceMagnitude(q1: number, q2: number, r: number): number {
  const rm = r * CM;
  return (K * Math.abs(q1 * UC * q2 * UC)) / (rm * rm);
}

/** The force (N) on charge number `i` due to all the others: the vector sum of Coulomb forces (superposition). */
export function forceOn(i: number, charges: Charge[]): { fx: number; fy: number; mag: number } {
  const me = charges[i]!;
  let fx = 0;
  let fy = 0;
  charges.forEach((o, j) => {
    if (j === i) return;
    const r = dist(me, o);
    if (r < 1e-6) return;
    const mag = forceMagnitude(me.q, o.q, r);
    const sign = Math.sign(me.q * o.q); // like charges repel (away from the other), unlike attract
    fx += (sign * mag * (me.x - o.x)) / r;
    fy += (sign * mag * (me.y - o.y)) / r;
  });
  return { fx, fy, mag: Math.hypot(fx, fy) };
}

/** The electric field (N/C) at (x, y) due to every charge: E = Σ k q r̂ / r². */
export function fieldAt(x: number, y: number, charges: Charge[]): { ex: number; ey: number; mag: number } {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const r = Math.hypot(x - c.x, y - c.y);
    if (r < 1e-3) continue;
    const e = (K * c.q * UC) / (r * CM * r * CM);
    ex += (e * (x - c.x)) / r;
    ey += (e * (y - c.y)) / r;
  }
  return { ex, ey, mag: Math.hypot(ex, ey) };
}

export const LINES_PER_UC = 4;
export const MIN_LINES = 4;
/** How many field lines leave (or enter) a charge: proportional to its size, with a few as a minimum so a small charge is still visible. */
export const lineCount = (q: number) => Math.min(48, Math.max(MIN_LINES, Math.round(Math.abs(q) * LINES_PER_UC)));

export interface FieldLine { from: number; pts: Vec[] }

/** Field lines by stepping along the field. They start on the positive charges and end on negative charges (or leave the window). */
export function traceLines(charges: Charge[], world: World): FieldLine[] {
  const hasPos = charges.some((c) => c.q > 0);
  const starts = charges.filter((c) => (hasPos ? c.q > 0 : c.q < 0));
  const dir = hasPos ? 1 : -1;
  const out: FieldLine[] = [];
  const STEP = 0.5;
  for (const c of starts) {
    const n = lineCount(c.q);
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n;
      let p: Vec = { x: c.x + 1.3 * Math.cos(a), y: c.y + 1.3 * Math.sin(a) };
      const pts: Vec[] = [{ x: c.x + 0.9 * Math.cos(a), y: c.y + 0.9 * Math.sin(a) }, p];
      for (let s = 0; s < 900; s++) {
        const f1 = fieldAt(p.x, p.y, charges);
        if (f1.mag < 1e-9) break;
        const m: Vec = { x: p.x + (dir * STEP * f1.ex) / (2 * f1.mag), y: p.y + (dir * STEP * f1.ey) / (2 * f1.mag) };
        const f2 = fieldAt(m.x, m.y, charges);
        if (f2.mag < 1e-9) break;
        p = { x: p.x + (dir * STEP * f2.ex) / f2.mag, y: p.y + (dir * STEP * f2.ey) / f2.mag };
        pts.push(p);
        if (p.x < -2 || p.y < -2 || p.x > world.w + 2 || p.y > world.h + 2) break;
        // arrived at a charge of the opposite kind: stop on its surface
        const end = charges.find((o) => (hasPos ? o.q < 0 : o.q > 0) && Math.hypot(p.x - o.x, p.y - o.y) < 1.0);
        if (end) break;
      }
      out.push({ from: c.id, pts });
    }
  }
  return out;
}

/** Where a line ends: the id of the charge it reached, or null if it left the window. */
export function lineEnd(line: FieldLine, charges: Charge[]): number | null {
  const p = line.pts[line.pts.length - 1]!;
  const hit = charges.find((c) => c.id !== line.from && Math.hypot(p.x - c.x, p.y - c.y) < 1.2);
  return hit ? hit.id : null;
}

// ------------------------------------------------------------------ dipole
/** Dipole moment p = q d in C m, from the charge size (µC) and separation (cm). */
export const dipoleMoment = (q: number, d: number) => Math.abs(q) * UC * (d * CM);
/** Exact field (N/C) on the axis of a dipole, r cm from its centre (pointing along p, i.e. from − to +). */
export function dipoleAxial(q: number, d: number, r: number): number {
  const a = (r - d / 2) * CM;
  const b = (r + d / 2) * CM;
  return K * Math.abs(q) * UC * (1 / (a * a) - 1 / (b * b));
}
/** Exact field (N/C) on the equatorial line of a dipole, r cm from its centre (pointing opposite to p). */
export function dipoleEquatorial(q: number, d: number, r: number): number {
  return (K * Math.abs(q) * UC * (d * CM)) / Math.pow((r * CM) ** 2 + (d * CM) ** 2 / 4, 1.5);
}
/** Short-dipole approximations: 2kp/r³ on the axis, kp/r³ on the equator. */
export const dipoleAxialApprox = (p: number, r: number) => (2 * K * p) / Math.pow(r * CM, 3);
export const dipoleEquatorialApprox = (p: number, r: number) => (K * p) / Math.pow(r * CM, 3);
/** Torque on a dipole in a uniform field: τ = p E sin θ. */
export const dipoleTorque = (p: number, E: number, thetaRad: number) => p * E * Math.sin(thetaRad);

// ------------------------------------------------------------------ measuring
export interface Reading { r: number; q1: number; q2: number; F: number }
/** Least-squares line F = s × (1/r²) through the origin, and the value of k it gives: k = s / (q1 q2). */
export function fitK(rows: Reading[]): { slope: number; k: number } {
  const xs = rows.map((r) => 1 / (r.r * CM) ** 2);
  const slope = xs.reduce((t, x, i) => t + x * rows[i]!.F, 0) / xs.reduce((t, x) => t + x * x, 0);
  const q = Math.abs(rows[0]!.q1 * UC * rows[0]!.q2 * UC);
  return { slope, k: slope / q };
}

/** The number of distinct distances measured with the same pair of charges. */
export function distinctDistances(rows: Reading[]): number {
  if (!rows.length) return 0;
  const last = rows[rows.length - 1]!;
  return new Set(rows.filter((r) => r.q1 === last.q1 && r.q2 === last.q2).map((r) => r.r.toFixed(2))).size;
}

// ------------------------------------------------------------------ teaching data
export interface Scenario { charges: Charge[]; probe: Vec }
export const WORLD: World = { w: 100, h: 60 };
export const WORLD_NARROW: World = { w: 100, h: 78 };

/** Two charges on a horizontal line, r cm apart, centred in the window. */
export const pair = (q1: number, q2: number, r: number, y = 30): Charge[] => [
  { id: 1, x: 50 - r / 2, y, q: q1 },
  { id: 2, x: 50 + r / 2, y, q: q2 },
];
export const START: Scenario = { charges: pair(3, -3, 30), probe: { x: 50, y: 14 } };

export interface Predict {
  id: string;
  title: string;
  prompt: string;
  base: Scenario;
  test: Scenario;
  options: string[];
  answer: number;
  why: (b: { base: Scenario; test: Scenario }) => string;
}
const N = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + ' N';
const f12 = (s: Scenario) => forceOn(0, s.charges).mag;

export const PREDICTS: Predict[] = [
  {
    id: 'e1',
    title: 'Double the distance',
    prompt: 'Two charges of +2 µC and +3 µC are 10 cm apart. Move them to 20 cm apart. What happens to the force between them?',
    base: { charges: pair(2, 3, 10), probe: { x: 50, y: 14 } },
    test: { charges: pair(2, 3, 20), probe: { x: 50, y: 14 } },
    options: ['It halves', 'It becomes one quarter', 'It doubles', 'It stays the same'],
    answer: 1,
    why: ({ base, test }) => `Coulomb's law gives F ∝ 1/r². At 10 cm the force is ${N(f12(base))}; at 20 cm it is ${N(f12(test))}, which is ${(f12(test) / f12(base)).toFixed(2)} of the first value: doubling the distance makes the force one quarter.`,
  },
  {
    id: 'e2',
    title: 'Double one charge',
    prompt: 'Two charges, +2 µC and +3 µC, are 10 cm apart. Double the second charge to +6 µC. What happens to the force on each charge?',
    base: { charges: pair(2, 3, 10), probe: { x: 50, y: 14 } },
    test: { charges: pair(2, 6, 10), probe: { x: 50, y: 14 } },
    options: ['It stays the same', 'It doubles', 'It becomes four times as large', 'It halves'],
    answer: 1,
    why: ({ base, test }) => `F ∝ q₁q₂, so doubling one charge doubles the force. It goes from ${N(f12(base))} to ${N(f12(test))}. By Newton's third law the force on the other charge is equal and opposite, and it doubles too.`,
  },
  {
    id: 'e3',
    title: 'Opposite charges',
    prompt: 'Now make the second charge negative (−3 µC), keeping +2 µC and the 10 cm gap. What do the charges do?',
    base: { charges: pair(2, 3, 10), probe: { x: 50, y: 14 } },
    test: { charges: pair(2, -3, 10), probe: { x: 50, y: 14 } },
    options: ['They repel each other', 'They attract each other', 'There is no force', 'Only the positive charge feels a force'],
    answer: 1,
    why: ({ test }) => `Unlike charges attract. Each force arrow now points towards the other charge. The size is unchanged, ${N(f12(test))}, because it depends on |q₁q₂|, and the two forces are equal and opposite.`,
  },
  {
    id: 'e4',
    title: 'Midway between equal charges',
    prompt: 'Two equal charges of +3 µC sit 30 cm apart. What is the electric field at the point exactly halfway between them?',
    base: { charges: pair(3, 3, 30), probe: { x: 50, y: 40 } },
    test: { charges: pair(3, 3, 30), probe: { x: 50, y: 30 } },
    options: ['Zero', 'Twice the field of one charge', 'The field of one charge', 'It points towards one of the charges'],
    answer: 0,
    why: ({ test }) => `Each charge makes a field of the same size at the midpoint, but in opposite directions, so they cancel by superposition. The probe reads ${fieldAt(test.probe.x, test.probe.y, test.charges).mag.toExponential(1)} N/C: zero (it is the neutral point between like charges).`,
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'ea1',
    q: 'Two point charges of 2 µC and 3 µC are placed 3 cm apart in vacuum. The force between them is',
    options: ['6 N', '60 N', '600 N', '0.6 N'],
    answer: 1,
    why: 'F = kq₁q₂/r² = (9 × 10⁹ × 2 × 10⁻⁶ × 3 × 10⁻⁶)/(3 × 10⁻²)² = (5.4 × 10⁻²)/(9 × 10⁻⁴) = 60 N.',
  },
  {
    id: 'ea2',
    q: 'The force between two point charges is F. One charge is doubled and the distance between them is tripled. The new force is',
    options: ['9F/2', 'F/9', '2F/3', '2F/9'],
    answer: 3,
    why: 'F ∝ q₁q₂/r². Doubling one charge multiplies F by 2, and tripling r divides it by 9, so the new force is 2F/9.',
  },
  {
    id: 'ea3',
    q: 'The electric field at a distance of 30 cm from a point charge of 4 µC in vacuum is',
    options: ['4 × 10⁵ N/C', '1.2 × 10⁵ N/C', '8 × 10⁵ N/C', '4 × 10⁶ N/C'],
    answer: 0,
    why: 'E = kq/r² = (9 × 10⁹ × 4 × 10⁻⁶)/(0.30)² = (3.6 × 10⁴)/(9 × 10⁻²) = 4 × 10⁵ N/C.',
  },
  {
    id: 'ea4',
    q: 'A dipole has charges +2 µC and −2 µC separated by 1 cm. Its dipole moment is',
    options: ['2 × 10⁻⁶ C m', '4 × 10⁻⁸ C m', '2 × 10⁻⁸ C m', '2 × 10⁻¹⁰ C m'],
    answer: 2,
    why: 'p = q × d = (2 × 10⁻⁶ C) × (1 × 10⁻² m) = 2 × 10⁻⁸ C m, pointing from the negative to the positive charge.',
  },
  {
    id: 'ea5',
    q: 'For a short dipole, the ratio of the field on its axis to the field on its equatorial line, at the same large distance r from the centre, is',
    options: ['1', '2', '1/2', '4'],
    answer: 1,
    why: 'On the axis E = 2kp/r³ (along p). On the equator E = kp/r³ (opposite to p). The ratio is 2.',
  },
];
