/**
 * Chapter lab: Mathematics (319), "Algebra: matrices, determinants, inverse and linear equations", section "Determinants".
 * Model: the 2x2 matrix A = [[a, b], [c, d]] sends the unit square to the parallelogram with columns (a, c) and (b, d).
 * |A| = ad - bc is the signed area of that parallelogram; |kA| = k^2 |A| for a 2x2 matrix; A^-1 exists only if |A| != 0.
 * Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const det = (a: number, b: number, c: number, d: number) => a * d - b * c;
/** area of the image of the unit square by the shoelace formula on its four corners */
const imageArea = (a: number, b: number, c: number, d: number) => {
  const P = [[0, 0], [a, c], [a + b, c + d], [b, d]] as const;
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i]!;
    const [x2, y2] = P[(i + 1) % 4]!;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};
const near = (r: number, vals: number[]) => vals.reduce((best, x, i) => (Math.abs(r - x) < Math.abs(r - vals[best]!) ? i : best), 0);
const S = 12.5;
const X = (x: number) => 200 + S * x;
const Y = (y: number) => 115 - S * y;

export const spec: Spec = {
  id: 'math-matrix-det-area',
  subject: 'Mathematics',
  lessonTitleStartsWith: 'Algebra: matrices, determinants',
  afterHeading: 'Determinants',
  title: 'Determinant as Area Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Change the four entries of a 2 by 2 matrix and watch the unit square turn into a parallelogram whose area is the determinant ad - bc. See the area collapse when the matrix becomes singular.',
  can: ['See |A| = ad - bc as the signed area of the transformed unit square', 'Find the settings that make the matrix singular (area 0, no inverse)', 'Record |kA| for three values of k and recover |A| from the slope of |kA| against k²'],
  minutes: 10,
  vars: [
    { id: 'a', label: 'Entry a (row 1, column 1)', unit: '', min: -4, max: 4, step: 0.5, start: 2, digits: 1 },
    { id: 'b', label: 'Entry b (row 1, column 2)', unit: '', min: -4, max: 4, step: 0.5, start: 3, digits: 1 },
    { id: 'c', label: 'Entry c (row 2, column 1)', unit: '', min: -4, max: 4, step: 0.5, start: 1, digits: 1 },
    { id: 'd', label: 'Entry d (row 2, column 2)', unit: '', min: -4, max: 4, step: 0.5, start: 4, digits: 1 },
    { id: 'k', label: 'Scalar multiplier k (for the matrix kA)', unit: '', min: 0.5, max: 3, step: 0.5, start: 1, digits: 1 },
  ],
  outs: [
    { id: 'det', label: 'Determinant |A| = ad − bc', unit: '', fn: (v) => det(v.a!, v.b!, v.c!, v.d!), digits: 2 },
    { id: 'area', label: 'Area of the transformed unit square', unit: 'sq. units', fn: (v) => imageArea(v.a!, v.b!, v.c!, v.d!), digits: 2 },
    { id: 'detK', label: '|kA| for a 2×2 matrix', unit: '', fn: (v) => v.k! * v.k! * det(v.a!, v.b!, v.c!, v.d!), digits: 2 },
    { id: 'detInv', label: '|A⁻¹| = 1/|A| (0 shown when no inverse exists)', unit: '', fn: (v) => { const D = det(v.a!, v.b!, v.c!, v.d!); return Math.abs(D) < 1e-9 ? 0 : 1 / D; }, digits: 3 },
    { id: 'orient', label: 'Orientation (+1 kept, −1 flipped, 0 collapsed)', unit: '', fn: (v) => Math.sign(det(v.a!, v.b!, v.c!, v.d!)), digits: 0 },
  ],
  graphs: [
    { id: 'det-a', title: 'Determinant against entry a', x: 'a', y: 'det' },
    { id: 'area-d', title: 'Area of the image against entry d', x: 'd', y: 'area' },
    { id: 'detk-k', title: '|kA| against the multiplier k', x: 'k', y: 'detK' },
  ],
  sceneAlt: 'A coordinate grid with the unit square dotted and the parallelogram it becomes under the matrix. The corners follow the four entries; the fill turns red when the determinant is negative and the shape flattens to a line when it is zero.',
  scene: ({ v, o }) => {
    const a = v.a!, b = v.b!, c = v.c!, d = v.d!;
    const pts = [[0, 0], [a, c], [a + b, c + d], [b, d]] as const;
    const neg = o.det! < 0;
    const col = Math.abs(o.det!) < 1e-9 ? '#7c8595' : neg ? '#c45e42' : '#18443b';
    return (
      <g fontSize={10} fill="#4d5768">
        <line x1={10} y1={Y(0)} x2={390} y2={Y(0)} stroke="#c9ced6" />
        <line x1={X(0)} y1={6} x2={X(0)} y2={224} stroke="#c9ced6" />
        <rect x={X(0)} y={Y(1)} width={S} height={S} fill="none" stroke="#7c8595" strokeDasharray="3 2" />
        <polygon points={pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill={col} fillOpacity={0.22} stroke={col} strokeWidth={2} />
        <line x1={X(0)} y1={Y(0)} x2={X(a)} y2={Y(c)} stroke="#2563a8" strokeWidth={2} />
        <line x1={X(0)} y1={Y(0)} x2={X(b)} y2={Y(d)} stroke="#c45e42" strokeWidth={2} />
        <circle cx={X(a)} cy={Y(c)} r={3.5} fill="#2563a8" />
        <circle cx={X(b)} cy={Y(d)} r={3.5} fill="#c45e42" />
        <text x={X(a) + 5} y={Y(c) - 4} fill="#2563a8">column 1 ({fmt(a, 1)}, {fmt(c, 1)})</text>
        <text x={X(b) + 5} y={Y(d) - 4} fill="#c45e42">column 2 ({fmt(b, 1)}, {fmt(d, 1)})</text>
        <text x={12} y={18} fontSize={12} fontWeight="bold" fill="#18443b">area = {fmt(o.area!, 2)} · |A| = {fmt(o.det!, 2)}</text>
        <text x={12} y={32}>{Math.abs(o.det!) < 1e-9 ? 'Singular: the square collapses, no inverse' : neg ? 'Negative: the square is flipped over' : 'Positive: orientation kept'}</text>
      </g>
    );
  },
  discover: [
    'Move entry a. The first column of the matrix is the arrow (a, c): watch the parallelogram stretch and read the determinant.',
    'Try to make the two arrows point along the same line. What happens to the area and to |A|?',
    'Swap the roles of the two columns (exchange a with b and c with d) and see the sign of |A| change.',
  ],
  experiment: [
    'Set b = c = 0. The square becomes a rectangle with sides a and d: check |A| = ad.',
    'Find a setting with |A| = 0. Is the parallelogram a proper shape? Does |A⁻¹| exist?',
    'Change k and compare |kA| with |A|: how does the factor depend on k?',
  ],
  understand: [
    'For a 2×2 matrix, |A| = ad − bc is the signed area of the parallelogram formed by its two columns; the area picture is extra intuition and the exam uses the ad − bc rule.',
    'A is singular when |A| = 0: the columns lie along one line, the area collapses, and A has no inverse. Only a non-singular matrix has an inverse, with |A⁻¹| = 1/|A|.',
    'Interchanging two columns (or rows) changes the sign of the determinant: the parallelogram is flipped over.',
    '|kA| = k²|A| for a 2×2 matrix (k^n|A| for an n×n matrix), not k|A|: scaling both directions multiplies the area by k².',
  ],
  preds: [
    {
      id: 'p1', title: 'Stretch one column', prompt: 'The matrix is [[1, 0], [0, 1]], so |A| = 1. Entry a is changed from 1 to 3 (the first column is stretched three times, nothing else changes). What happens to |A|?',
      base: { a: 1, b: 0, c: 0, d: 1, k: 1 }, test: { a: 3 }, options: ['It stays 1', 'It becomes 3', 'It becomes 9', 'It becomes 0'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).det! / outs(base).det!, [1, 3, 9, 0]),
      why: ({ base, test, outs }) => `Multiplying one column by 3 multiplies the determinant by 3. |A| goes from ${fmt(outs(base).det!, 1)} to ${fmt(outs(test).det!, 1)}, and the image area from ${fmt(outs(base).area!, 1)} to ${fmt(outs(test).area!, 1)}.`,
    },
    {
      id: 'p2', title: 'Swap the two columns', prompt: 'The matrix [[2, 1], [1, 3]] has |A| = 5. Its two columns are exchanged to give [[1, 2], [3, 1]]. What happens to the determinant?',
      base: { a: 2, b: 1, c: 1, d: 3, k: 1 }, test: { a: 1, b: 2, c: 3, d: 1 }, options: ['It stays 5', 'It becomes 0', 'It becomes −5', 'It becomes 25'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).det! / outs(base).det!, [1, 0, -1, 5]),
      why: ({ base, test, outs }) => `Interchanging two columns changes the sign of the determinant: |A| goes from ${fmt(outs(base).det!, 1)} to ${fmt(outs(test).det!, 1)}. The parallelogram is the same size but flipped over (orientation ${fmt(outs(test).orient!, 0)}).`,
    },
    {
      id: 'p3', title: 'Make the columns parallel', prompt: 'The columns are (2, 1) and (4, 3), so |A| = 2. Entry d is lowered from 3 to 2, giving the columns (2, 1) and (4, 2). What happens to the parallelogram?',
      base: { a: 2, b: 4, c: 1, d: 3, k: 1 }, test: { d: 2 }, options: ['Its area doubles', 'Its area collapses to 0 and A is singular', 'Its area stays 2', 'It is flipped over'], answer: 1,
      verify: ({ test, outs }) => (Math.abs(outs(test).area!) < 1e-9 ? 1 : outs(test).orient! < 0 ? 3 : outs(test).area! > 2.5 ? 0 : 2),
      why: ({ base, test, outs }) => `The second column (4, 2) is twice the first (2, 1), so both lie on one line. ad − bc = 2×2 − 4×1 = ${fmt(outs(test).det!, 1)}: the area falls from ${fmt(outs(base).area!, 1)} to ${fmt(outs(test).area!, 1)} and A has no inverse.`,
    },
    {
      id: 'p4', title: 'Scale the whole matrix', prompt: 'The matrix A has |A| = 5. It is replaced by 2A (k goes from 1 to 2). By what factor does the determinant change?',
      base: { k: 1 }, test: { k: 2 }, options: ['2', '8', '4', '1'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).detK! / outs(base).detK!, [2, 8, 4, 1]),
      why: ({ base, test, outs }) => `For a 2×2 matrix |kA| = k²|A|. With k = 2 the factor is 4: |kA| goes from ${fmt(outs(base).detK!, 1)} to ${fmt(outs(test).detK!, 1)}. It is not 2, which would be the wrong rule k|A|.`,
    },
  ],
  measure: {
    instruction: 'Keep the four entries fixed (a matrix with |A| ≠ 0). Record |kA| for at least three different values of the multiplier k.',
    vary: 'k',
    record: ['detK', 'area'],
    fit: {
      xLabel: 'k²',
      yLabel: '|kA|',
      x: (v) => v.k! * v.k!,
      y: (_v, o) => o.detK!,
      interpret: (slope, intercept, v) => `|kA| against k² is a straight line through the origin (intercept ${fmt(intercept, 2)}), as |kA| = k²|A| for a 2×2 matrix. The slope is |A| = ${fmt(slope, 2)}, which matches ad − bc = ${fmt(det(v.a!, v.b!, v.c!, v.d!), 2)} for the entries you used.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'The value of the determinant |A| for A = [[2, 3], [1, 4]] is', options: ['11', '5', '−5', '8'], answer: 1,
      why: '|A| = ad − bc = 2×4 − 3×1 = 8 − 3 = 5. Adding the products (8 + 3 = 11) is the common slip.',
      verify: () => near(det(2, 3, 1, 4), [11, 5, -5, 8]),
    },
    {
      id: 'q2', q: 'The unit square is transformed by the matrix [[3, 1], [2, 4]]. The area of the parallelogram obtained is', options: ['14', '12', '10', '6'], answer: 2,
      why: 'The area is |ad − bc| = |3×4 − 1×2| = 10 square units; the determinant is the area scale factor.',
      verify: () => near(imageArea(3, 1, 2, 4), [14, 12, 10, 6]),
    },
    {
      id: 'q3', q: 'For what value of k is the matrix [[2, 3], [4, k]] singular?', options: ['3', '4', '12', '6'], answer: 3,
      why: 'Singular means |A| = 0: 2k − 3×4 = 0, so k = 6. At k = 6 the second row is twice the first, so the columns are parallel and the area collapses.',
      verify: () => near(12 / 2, [3, 4, 12, 6]),
    },
    {
      id: 'q4', q: 'A and B are 2×2 matrices with |A| = 5 and |B| = −2. The value of |3AB| is', options: ['−30', '−90', '−10', '90'], answer: 1,
      why: '|AB| = |A||B| = −10 and |3M| = 3²|M| = 9|M| for a 2×2 matrix, so |3AB| = −90. Using the factor 3 instead of 9 gives the wrong −30.',
      verify: () => near(9 * (5 * -2), [-30, -90, -10, 90]),
    },
    {
      id: 'q5', q: 'If A is a non-singular 2×2 matrix with |A| = 5, then |A⁻¹| equals', options: ['5', '−5', '−1/5', '1/5'], answer: 3,
      why: 'For an invertible matrix |A⁻¹| = 1/|A| = 1/5, because |A||A⁻¹| = |AA⁻¹| = |I| = 1.',
      verify: () => near(1 / 5, [5, -5, -0.2, 0.2]),
    },
  ],
};
