/**
 * Chapter lab: Mathematics (319), "Applied Algebra: matrices, determinants, inverse and systems of equations",
 * section "Solving simultaneous equations by the matrix method".
 * Model: AX = B with A = [[a, b], [c, d]], B = [6, f]. If |A| != 0 then X = A^-1 B = (1/|A|) (adj A) B; if |A| = 0 the
 * test is (adj A) B: zero matrix means infinitely many solutions, non-zero means none (the lines are parallel).
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const E = 6; // constant of the first equation
type Sol = { det: number; adj1: number; adj2: number; x: number; y: number; unique: boolean };
const solve = (a: number, b: number, c: number, d: number, e: number, f: number): Sol => {
  const det = a * d - b * c;
  const adj1 = d * e - b * f;
  const adj2 = -c * e + a * f;
  const unique = Math.abs(det) > 1e-9;
  return { det, adj1, adj2, unique, x: unique ? adj1 / det : 0, y: unique ? adj2 / det : 0 };
};
/** 0 = unique, 1 = infinitely many, 2 = none */
const kind = (s: Sol) => (s.unique ? 0 : Math.abs(s.adj1) < 1e-9 && Math.abs(s.adj2) < 1e-9 ? 1 : 2);
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const sol = (v: { a?: number; b?: number; c?: number; d?: number; f?: number }) => solve(v.a!, v.b!, v.c!, v.d!, E, v.f!);
const SX = 22;
const SY = 17;
const X = (x: number) => 200 + SX * x;
const Y = (y: number) => 115 - SY * y;
const lineEnds = (a: number, b: number, e: number) => {
  const n = a * a + b * b;
  if (n < 1e-12) return null;
  const px = (a * e) / n;
  const py = (b * e) / n;
  const t = 60;
  return { x1: X(px - b * t), y1: Y(py + a * t), x2: X(px + b * t), y2: Y(py - a * t) };
};

export const spec: Spec = {
  id: 'math-applied-system-lines',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Applied Algebra: matrices',
  afterHeading: 'Solving simultaneous equations by the matrix method',
  title: 'Two Equations, Two Lines Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Write two linear equations as AX = B and see them as two lines. Change the coefficients and read |A|, the solution X = A⁻¹B and the test (adj A)B that separates one solution, none and infinitely many.',
  can: ['See the solution of AX = B as the crossing point of two lines', 'Make |A| = 0 and use (adj A)B to tell parallel lines from the same line', 'Record y against f and read an entry of A⁻¹ from the slope'],
  minutes: 12,
  vars: [
    { id: 'a', label: 'Coefficient a of x in equation 1', unit: '', min: -4, max: 4, step: 0.5, start: 1, digits: 1 },
    { id: 'b', label: 'Coefficient b of y in equation 1', unit: '', min: -4, max: 4, step: 0.5, start: 1, digits: 1 },
    { id: 'c', label: 'Coefficient c of x in equation 2', unit: '', min: -4, max: 4, step: 0.5, start: 2, digits: 1 },
    { id: 'd', label: 'Coefficient d of y in equation 2', unit: '', min: -4, max: 4, step: 0.5, start: -1, digits: 1 },
    { id: 'f', label: 'Constant f of equation 2', unit: '', min: -15, max: 15, step: 1, start: 3, digits: 0 },
  ],
  outs: [
    { id: 'det', label: 'Determinant |A| = ad − bc', unit: '', fn: (v) => sol(v).det, digits: 2 },
    { id: 'x', label: 'Solution x = (adj A B)₁ / |A| (0 if |A| = 0)', unit: '', fn: (v) => sol(v).x, digits: 2 },
    { id: 'y', label: 'Solution y = (adj A B)₂ / |A| (0 if |A| = 0)', unit: '', fn: (v) => sol(v).y, digits: 2 },
    { id: 'adjB', label: 'Size of (adj A)B = |d·6 − b·f| + |−c·6 + a·f|', unit: '', fn: (v) => { const s = sol(v); return Math.abs(s.adj1) + Math.abs(s.adj2); }, digits: 1 },
    { id: 'inv22', label: 'Entry a/|A| of A⁻¹ (0 if no inverse)', unit: '', fn: (v) => { const s = sol(v); return s.unique ? v.a! / s.det : 0; }, digits: 3 },
  ],
  graphs: [
    { id: 'x-f', title: 'Solution x against the constant f', x: 'f', y: 'x' },
    { id: 'y-f', title: 'Solution y against the constant f', x: 'f', y: 'y' },
    { id: 'det-d', title: 'Determinant against coefficient d', x: 'd', y: 'det' },
  ],
  sceneAlt: 'Two straight lines on a coordinate grid, equation 1 in green and equation 2 in orange, both redrawn as the coefficients change. A dot marks the crossing point when |A| is not zero; with |A| = 0 the lines are parallel or lie on top of each other.',
  scene: ({ v, o }) => {
    const l1 = lineEnds(v.a!, v.b!, E);
    const l2 = lineEnds(v.c!, v.d!, v.f!);
    const s = sol(v);
    const k = kind(s);
    const inside = s.unique && Math.abs(s.x) <= 8.5 && Math.abs(s.y) <= 6.5;
    return (
      <g fontSize={10} fill="#4d5768">
        <defs>
          <clipPath id="sys-win"><rect x={12} y={40} width={376} height={184} /></clipPath>
        </defs>
        <line x1={12} y1={Y(0)} x2={388} y2={Y(0)} stroke="#c9ced6" />
        <line x1={X(0)} y1={40} x2={X(0)} y2={224} stroke="#c9ced6" />
        <g clipPath="url(#sys-win)">
          {l1 && <line {...l1} stroke="#18443b" strokeWidth={2.2} />}
          {l2 && <line {...l2} stroke="#c45e42" strokeWidth={2.2} strokeDasharray={k === 1 ? '6 3' : undefined} />}
          {inside && <circle cx={X(s.x)} cy={Y(s.y)} r={5} fill="#2563a8" stroke="#fff" strokeWidth={1.5} />}
        </g>
        <text x={12} y={14} fontSize={11} fill="#18443b">{fmt(v.a!, 1)}x {v.b! < 0 ? '−' : '+'} {fmt(Math.abs(v.b!), 1)}y = {E}</text>
        <text x={12} y={28} fontSize={11} fill="#c45e42">{fmt(v.c!, 1)}x {v.d! < 0 ? '−' : '+'} {fmt(Math.abs(v.d!), 1)}y = {fmt(v.f!, 0)}</text>
        <text x={388} y={14} fontSize={12} fontWeight="bold" textAnchor="end" fill="#18443b">|A| = {fmt(o.det!, 2)}</text>
        <text x={388} y={28} textAnchor="end">{k === 0 ? `one solution (${fmt(s.x, 2)}, ${fmt(s.y, 2)})${inside ? '' : ' (off the grid)'}` : k === 1 ? '(adj A)B = O: same line, infinitely many' : '(adj A)B ≠ O: parallel, no solution'}</text>
      </g>
    );
  },
  discover: [
    'Move the constant f of equation 2. One line slides parallel to itself; follow the crossing point and the readings of x and y.',
    'Change the coefficient d until |A| becomes exactly 0. What happens to the two lines?',
    'With |A| = 0, change f and watch the size of (adj A)B: when is it zero?',
  ],
  experiment: [
    'Set the coefficients to 1, 1, 2, 2 so that |A| = 0. Slide f from 0 up to 15: for which f do the lines coincide, and what does (adj A)B show then?',
    'Return to a non-zero |A| and move f: do x and y change in proportion to f? Check the two graphs.',
    'Bring |A| close to 0 (but not 0): how far away does the crossing point go?',
  ],
  understand: [
    'Write the equations as AX = B. If |A| ≠ 0 the system is consistent with a unique solution X = A⁻¹B = (1/|A|)(adj A)B: the lines cross once.',
    'If |A| = 0, compute (adj A)B. A zero matrix means infinitely many solutions (the same line); a non-zero matrix means no solution (parallel lines).',
    'For a 2×2 matrix adj A = [[d, −b], [−c, a]]; the solution changes in proportion to the constants because X = A⁻¹B is linear in B.',
    'Always substitute the answer back into every equation to catch a sign slip.',
  ],
  preds: [
    {
      id: 'p1', title: 'Slide the second line', prompt: 'x + y = 6 and 2x − y = f cross at (3, 3) when f = 3. The constant f is raised from 3 to 6 (the second line moves parallel to itself). What happens to the crossing point?',
      base: { a: 1, b: 1, c: 2, d: -1, f: 3 }, test: { f: 6 }, options: ['Both x and y increase', 'x increases and y decreases', 'x decreases and y increases', 'Neither changes'], answer: 1,
      verify: ({ base, test, outs }) => { const dx = outs(test).x! - outs(base).x!; const dy = outs(test).y! - outs(base).y!; return Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9 ? 3 : dx > 0 && dy > 0 ? 0 : dx > 0 ? 1 : 2; },
      why: ({ base, test, outs }) => `X = A⁻¹B with |A| = ${fmt(outs(base).det!, 0)}. The crossing point moves from (${fmt(outs(base).x!, 2)}, ${fmt(outs(base).y!, 2)}) to (${fmt(outs(test).x!, 2)}, ${fmt(outs(test).y!, 2)}): x increases and y decreases.`,
    },
    {
      id: 'p2', title: 'Parallel lines meet the same line', prompt: 'x + y = 6 and 2x + 2y = f. For f = 3 the lines are parallel and do not meet. If f is raised to 12, what happens?',
      base: { a: 1, b: 1, c: 2, d: 2, f: 3 }, test: { f: 12 }, options: ['Still no solution', 'Infinitely many solutions (the same line)', 'Exactly one solution', 'Exactly two solutions'], answer: 1,
      verify: ({ test, outs }) => { const s = outs(test); return Math.abs(s.det!) > 1e-9 ? 2 : s.adjB! < 1e-9 ? 1 : 0; },
      why: ({ base, test, outs }) => `|A| = ${fmt(outs(test).det!, 0)} in both cases. (adj A)B has size ${fmt(outs(base).adjB!, 1)} at f = 3 (not zero: parallel, no solution) and ${fmt(outs(test).adjB!, 1)} at f = 12 (the zero matrix: 2x + 2y = 12 is the same line as x + y = 6).`,
    },
    {
      id: 'p3', title: 'Almost parallel', prompt: 'With x + y = 6 and 2x + dy = 3, the coefficient d goes from −1 (|A| = −3) to 1.5 (|A| = −0.5). The lines become almost parallel. What happens to the crossing point?',
      base: { a: 1, b: 1, c: 2, d: -1, f: 3 }, test: { d: 1.5 }, options: ['It moves much further from the origin', 'It moves to the origin', 'It stays where it was', 'It disappears because |A| becomes 0'], answer: 0,
      verify: ({ base, test, outs }) => { const r = Math.hypot(outs(test).x!, outs(test).y!) / Math.hypot(outs(base).x!, outs(base).y!); return Math.abs(outs(test).det!) < 1e-9 ? 3 : r > 3 ? 0 : r < 0.1 ? 1 : 2; },
      why: ({ base, test, outs }) => `Dividing by a small |A| makes X large: the point goes from (${fmt(outs(base).x!, 1)}, ${fmt(outs(base).y!, 1)}) to (${fmt(outs(test).x!, 1)}, ${fmt(outs(test).y!, 1)}). It disappears only when |A| is exactly 0.`,
    },
    {
      id: 'p4', title: 'Multiply the second equation', prompt: 'Equation 2 is multiplied by 2: 2x − y = 3 becomes 4x − 2y = 6. What happens to the solution and to |A|?',
      base: { a: 1, b: 1, c: 2, d: -1, f: 3 }, test: { c: 4, d: -2, f: 6 }, options: ['The solution is unchanged and |A| doubles', 'The solution doubles', 'The solution halves', 'The lines become parallel'], answer: 0,
      verify: ({ base, test, outs }) => { const a = outs(base), b = outs(test); const same = Math.abs(a.x! - b.x!) < 1e-9 && Math.abs(a.y! - b.y!) < 1e-9; return same && Math.abs(b.det! / a.det! - 2) < 1e-9 ? 0 : Math.abs(b.x! - 2 * a.x!) < 1e-9 ? 1 : Math.abs(b.x! - a.x! / 2) < 1e-9 ? 2 : 3; },
      why: ({ base, test, outs }) => `Multiplying an equation by 2 gives the same line, so the crossing point stays (${fmt(outs(test).x!, 1)}, ${fmt(outs(test).y!, 1)}). Only |A| changes, from ${fmt(outs(base).det!, 0)} to ${fmt(outs(test).det!, 0)}, and (adj A)B doubles with it.`,
    },
  ],
  measure: {
    instruction: 'Keep the four coefficients fixed with |A| ≠ 0. Record the solution y for at least three different values of the constant f.',
    vary: 'f',
    record: ['x', 'y'],
    fit: {
      xLabel: 'f',
      yLabel: 'y',
      x: (v) => v.f!,
      y: (_v, o) => o.y!,
      interpret: (slope, intercept, v) => `y against f is a straight line, because X = A⁻¹B is linear in the constants. Its slope ${fmt(slope, 3)} equals the entry a/|A| of A⁻¹ = ${fmt(v.a! / (v.a! * v.d! - v.b! * v.c!), 3)}, and its intercept ${fmt(intercept, 2)} is −c·6/|A|, the part of y that comes from equation 1.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Solve by the matrix method: x + y = 6 and 2x − y = 3. The value of x is', options: ['2', '3', '4', '1'], answer: 1,
      why: 'A = [[1, 1], [2, −1]], |A| = −1 − 2 = −3, adj A = [[−1, −1], [−2, 1]]. X = (1/−3)(adj A)B with B = (6, 3) gives x = (−6 − 3)/−3 = 3 and y = (−12 + 3)/−3 = 3.',
      verify: () => near(solve(1, 1, 2, -1, 6, 3).x, [2, 3, 4, 1]),
    },
    {
      id: 'q2', q: 'For 2x + y = 5 and 4x + 2y = 10, |A| = 0 and (adj A)B is the zero matrix. The system has', options: ['a unique solution', 'no solution', 'infinitely many solutions', 'exactly two solutions'], answer: 2,
      why: '|A| = 4 − 4 = 0. (adj A)B = [[2, −1], [−4, 2]](5, 10) = (10 − 10, −20 + 20) = (0, 0), the zero matrix, so the two equations describe the same line: infinitely many solutions.',
      verify: () => kind(solve(2, 1, 4, 2, 5, 10)) === 1 ? 2 : kind(solve(2, 1, 4, 2, 5, 10)) === 2 ? 1 : 0,
    },
    {
      id: 'q3', q: 'For x + 2y = 4 and 2x + 4y = 7, |A| = 0. Computing (adj A)B gives (2, −1), which is not the zero matrix. The system has', options: ['a unique solution', 'infinitely many solutions', 'exactly two solutions', 'no solution'], answer: 3,
      why: '|A| = 4 − 4 = 0 and (adj A)B = [[4, −2], [−2, 1]](4, 7) = (16 − 14, −8 + 7) = (2, −1) ≠ 0, so the lines are parallel and distinct: the system is inconsistent.',
      verify: () => { const k = kind(solve(1, 2, 2, 4, 4, 7)); return k === 0 ? 0 : k === 1 ? 1 : 3; },
    },
    {
      id: 'q4', q: 'A = [[2, 3], [1, 4]] and the equations are 2x + 3y = 8 and x + 4y = 9. Using X = A⁻¹B, the value of x + y is', options: ['3', '2', '5', '4'], answer: 0,
      why: '|A| = 8 − 3 = 5 and adj A = [[4, −3], [−1, 2]]. X = (1/5)(adj A)(8, 9) = (1/5)(32 − 27, −8 + 18) = (1, 2). So x + y = 3.',
      verify: () => { const s = solve(2, 3, 1, 4, 8, 9); return near(s.x + s.y, [3, 2, 5, 4]); },
    },
    {
      id: 'q5', q: 'The equations 2x + ky = 4 and x + 3y = 5 have a unique solution for every value of k except k =', options: ['3', '2', '6', '−6'], answer: 2,
      why: 'A = [[2, k], [1, 3]] has |A| = 6 − k. The unique solution X = A⁻¹B exists unless |A| = 0, that is k = 6.',
      verify: () => near(6, [3, 2, 6, -6]),
    },
  ],
};
