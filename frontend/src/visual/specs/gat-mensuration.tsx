/**
 * Chapter lab: General Aptitude Test, "Basic mathematics for reasoning" - mensuration of a cylinder and the scaling laws of length, area and volume.
 * Formulas as in the lesson (pi = 22/7, as the lesson allows when the radius is a multiple of 7): V = pi r^2 h, curved surface = 2 pi r h.
 * Total surface 2 pi r (r + h) is the standard extension. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';
import { ACC, BLUE, GREY, INK, closest } from './geogat-kit';

const PI = 22 / 7;
const vol = (r: number, h: number) => PI * r * r * h;
const csa = (r: number, h: number) => 2 * PI * r * h;
const tsa = (r: number, h: number) => 2 * PI * r * (r + h);

export const spec: Spec = {
  id: 'gat-mensuration',
  subject: 'General Aptitude Test',
  lessonTitleStartsWith: 'Basic mathematics for reasoning',
  afterHeading: 'Mensuration: perimeter, area and volume',
  title: 'Cylinder Mensuration Lab',
  format: 'Virtual experiment · scaling laws',
  blurb: 'Change the radius and height of a cylinder and a scale factor, and see the base area, volume, curved and total surface respond, and why doubling a size multiplies length, area and volume by 2, 4 and 8.',
  can: ['See volume grow as r² but only as h', 'Scale every dimension by k and watch area go as k² and volume as k³', 'Record volume for three heights and fit the radius from the slope'],
  minutes: 9,
  vars: [
    { id: 'r', label: 'Base radius r', unit: 'cm', min: 1, max: 14, step: 1, start: 7, digits: 0 },
    { id: 'h', label: 'Height h', unit: 'cm', min: 1, max: 30, step: 1, start: 10, digits: 0 },
    { id: 'k', label: 'Scale factor k (all lengths multiplied by k)', unit: '', min: 1, max: 4, step: 0.5, start: 1, digits: 1 },
  ],
  outs: [
    { id: 'B', label: 'Base area π r²', unit: 'cm²', fn: (v) => PI * v.r! * v.r!, digits: 1 },
    { id: 'V', label: 'Volume π r² h', unit: 'cm³', fn: (v) => vol(v.r!, v.h!), digits: 0 },
    { id: 'C', label: 'Curved surface area 2 π r h', unit: 'cm²', fn: (v) => csa(v.r!, v.h!), digits: 0 },
    { id: 'T', label: 'Total surface area 2 π r (r + h)', unit: 'cm²', fn: (v) => tsa(v.r!, v.h!), digits: 0 },
    { id: 'Vk', label: 'Volume after scaling by k', unit: 'cm³', fn: (v) => vol(v.r!, v.h!) * Math.pow(v.k!, 3), digits: 0 },
    { id: 'Tk', label: 'Total surface after scaling by k', unit: 'cm²', fn: (v) => tsa(v.r!, v.h!) * v.k! * v.k!, digits: 0 },
  ],
  graphs: [
    { id: 'v-r', title: 'Volume against radius', x: 'r', y: 'V' },
    { id: 'v-h', title: 'Volume against height', x: 'h', y: 'V' },
    { id: 'vk-k', title: 'Volume after scaling against the scale factor', x: 'k', y: 'Vk' },
  ],
  sceneAlt: 'A cylinder whose width follows the radius and whose height follows the height slider, and three bars on the right showing that lengths grow as k, areas as k squared and volumes as k cubed.',
  scene: ({ v, o }) => {
    const rx = 8 + v.r! * 5;
    const ry = rx * 0.3;
    const hp = 20 + v.h! * 4.5;
    const cx = 100;
    const base = 187;
    const top = base - hp;
    const k = v.k!;
    const ks = [k, k * k, k * k * k];
    return (
      <g fontSize={10}>
        <path d={`M ${cx - rx} ${top} V ${base} A ${rx} ${ry} 0 0 0 ${cx + rx} ${base} V ${top}`} fill="#cfe3dc" stroke={INK} strokeWidth={1.5} />
        <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill="#e9f3ef" stroke={INK} strokeWidth={1.5} />
        <line x1={cx} y1={top} x2={cx + rx} y2={top} stroke={ACC} strokeWidth={2} />
        <text x={cx + rx / 2} y={top - ry - 3} textAnchor="middle" fill={ACC} fontWeight="bold">r = {v.r}</text>
        <line x1={cx + rx + 8} y1={top} x2={cx + rx + 8} y2={base} stroke={BLUE} strokeWidth={2} />
        <text x={cx + rx + 12} y={(top + base) / 2} fill={BLUE} fontWeight="bold">h = {v.h}</text>
        <text x={cx} y={226} textAnchor="middle" fill={INK}>V = {fmt(o.V!, 0)} cm³</text>
        <text x={290} y={22} textAnchor="middle" fill={INK} fontWeight="bold">Scale factor k = {fmt(k, 1)}</text>
        {['length × k', 'area × k²', 'volume × k³'].map((n, i) => (
          <g key={n}>
            <rect x={225} y={40 + i * 44} width={Math.max(4, (ks[i]! / 64) * 160)} height={24} fill={[BLUE, ACC, INK][i]} opacity={0.85} />
            <text x={225} y={36 + i * 44} fill={GREY}>{n}</text>
            <text x={232 + Math.max(4, (ks[i]! / 64) * 160)} y={57 + i * 44} fill={INK} fontWeight="bold">{fmt(ks[i]!, 2)}</text>
          </g>
        ))}
        <text x={290} y={190} textAnchor="middle" fill={GREY} fontSize={9}>after scaling: V = {fmt(o.Vk!, 0)} cm³</text>
        <text x={290} y={204} textAnchor="middle" fill={GREY} fontSize={9}>surface = {fmt(o.Tk!, 0)} cm² (π = 22/7)</text>
      </g>
    );
  },
  discover: [
    'Set the radius to 7 and the height to 10. Compare the volume with the lesson value (1,540 cm³).',
    'Double the radius, then double the height instead. Which change multiplies the volume by more?',
    'Raise the scale factor from 1 to 2 and read the three bars: length, area and volume.',
  ],
  experiment: [
    'Keep the radius fixed and read the volume for three heights. What kind of line is it?',
    'Keep the height fixed and read the volume for three radii. Is the graph a straight line?',
    'Find a pair (r, h) with the same volume as r = 7, h = 10 but a different radius.',
  ],
  understand: [
    'Volume = π r² h, so it is proportional to h but to the square of r.',
    'Curved surface area = 2 π r h is proportional to r and to h.',
    'If every length is multiplied by k, areas are multiplied by k² and volumes by k³.',
    'Keep the units straight: lengths in cm, areas in cm², volumes in cm³ (use π = 22/7 when the radius is a multiple of 7).',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the radius', prompt: 'A cylinder has r = 7 cm and h = 10 cm. The radius is doubled to 14 cm and h stays 10 cm. What happens to the volume?',
      base: { r: 7, h: 10 }, test: { r: 14 }, options: ['It doubles', 'It becomes four times as large', 'It becomes eight times as large', 'It stays the same'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).V! / outs(base).V!, [2, 4, 8, 1]),
      why: ({ base, test, outs }) => `V = π r² h, so V is proportional to r². The volume goes from ${fmt(outs(base).V!, 0)} cm³ to ${fmt(outs(test).V!, 0)} cm³.`,
    },
    {
      id: 'p2', title: 'Double the height', prompt: 'The height of a cylinder is doubled (10 cm to 20 cm) with the same radius. What happens to the volume and to the curved surface area?',
      base: { r: 7, h: 10 }, test: { h: 20 }, options: ['Both double', 'Volume doubles, curved surface stays the same', 'Both become four times as large', 'Neither changes'], answer: 0,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).V! / outs(base).V! - 2) < 1e-9 && Math.abs(outs(test).C! / outs(base).C! - 2) < 1e-9 ? 0 : 1),
      why: ({ base, test, outs }) => `Both formulas contain h only once, so both double: V from ${fmt(outs(base).V!, 0)} to ${fmt(outs(test).V!, 0)} cm³ and the curved surface from ${fmt(outs(base).C!, 0)} to ${fmt(outs(test).C!, 0)} cm².`,
    },
    {
      id: 'p3', title: 'Scale everything by 2', prompt: 'Every length of the cylinder (r = 7, h = 10) is multiplied by 2. By what factor does the volume increase?',
      base: { r: 7, h: 10, k: 1 }, test: { k: 2 }, options: ['2', '4', '6', '8'], answer: 3,
      verify: ({ base, test, outs }) => closest(outs(test).Vk! / outs(base).Vk!, [2, 4, 6, 8]),
      why: ({ base, test, outs }) => `Volume scales as k³. With k = 2 the volume goes from ${fmt(outs(base).Vk!, 0)} cm³ to ${fmt(outs(test).Vk!, 0)} cm³; the total surface (k²) rises only fourfold, from ${fmt(outs(base).Tk!, 0)} to ${fmt(outs(test).Tk!, 0)} cm².`,
    },
    {
      id: 'p4', title: 'Fatter and shorter', prompt: 'The radius is doubled (7 to 14 cm) and, at the same time, the height is halved (10 to 5 cm). What happens to the volume?',
      base: { r: 7, h: 10 }, test: { r: 14, h: 5 }, options: ['It is unchanged', 'It doubles', 'It halves', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => closest(outs(test).V! / outs(base).V!, [1, 2, 0.5, 4]),
      why: ({ base, test, outs }) => `r² gives a factor 4 and h a factor ½, so V is multiplied by 2: from ${fmt(outs(base).V!, 0)} to ${fmt(outs(test).V!, 0)} cm³.`,
    },
  ],
  measure: {
    instruction: 'Keep the radius fixed. Record the volume of the cylinder for at least three different heights.',
    vary: 'h',
    record: ['V', 'C', 'T'],
    fit: {
      xLabel: 'height h (cm)',
      yLabel: 'volume (cm³)',
      x: (v) => v.h!,
      y: (_v, o) => o.V!,
      interpret: (slope, _i, v) => `Volume against height is a straight line through the origin. The slope is the base area π r² = ${fmt(slope, 1)} cm², so r = √(slope ÷ π) = ${fmt(Math.sqrt(slope / PI), 2)} cm (the slider is set to ${v.r} cm).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A cylinder has base radius 7 cm and height 10 cm. Taking π = 22/7, its volume is', options: ['440 cm³', '1,540 cm³', '154 cm³', '3,080 cm³'], answer: 1,
      why: 'V = π r² h = (22/7) × 7 × 7 × 10 = 22 × 7 × 10 = 1,540 cm³.',
      verify: () => closest(vol(7, 10), [440, 1540, 154, 3080]),
    },
    {
      id: 'q2', q: 'For the same cylinder (r = 7 cm, h = 10 cm), the curved surface area is', options: ['440 cm²', '220 cm²', '1,540 cm²', '880 cm²'], answer: 0,
      why: 'Curved surface area = 2 π r h = 2 × (22/7) × 7 × 10 = 440 cm².',
      verify: () => closest(csa(7, 10), [440, 220, 1540, 880]),
    },
    {
      id: 'q3', q: 'The length of a rectangle is 3 times its breadth and its perimeter is 64 cm. Its area is', options: ['64 cm²', '128 cm²', '192 cm²', '256 cm²'], answer: 2,
      why: 'Perimeter = 2(3b + b) = 8b = 64, so b = 8 cm and the length is 24 cm. Area = 24 × 8 = 192 cm².',
      verify: () => {
        const b = 64 / 8;
        return closest(3 * b * b, [64, 128, 192, 256]);
      },
    },
    {
      id: 'q4', q: 'A cylinder has base radius 14 cm and height 5 cm. Taking π = 22/7, its volume is', options: ['3,080 cm³', '1,540 cm³', '6,160 cm³', '770 cm³'], answer: 0,
      why: 'V = (22/7) × 14 × 14 × 5 = 22 × 2 × 14 × 5 = 3,080 cm³.',
      verify: () => closest(vol(14, 5), [3080, 1540, 6160, 770]),
    },
    {
      id: 'q5', q: 'Every dimension of a solid is multiplied by 3. Its total surface area is multiplied by', options: ['3', '6', '9', '27'], answer: 2,
      why: 'Areas scale as the square of the scale factor: 3² = 9. (Volumes would be multiplied by 27.)',
      verify: () => closest(tsa(7, 10) * 9 / tsa(7, 10), [3, 6, 9, 27]),
    },
  ],
};
