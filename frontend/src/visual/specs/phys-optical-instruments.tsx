/**
 * Chapter lab: Physics, Unit VI, "Optical instruments: microscopes and astronomical telescopes and their magnifying powers".
 * The model (the lesson's formulas, D = 25 cm): compound microscope in normal adjustment m = (L/fo)(D/fe);
 * refracting telescope in normal adjustment m = fo/fe with lens separation fo + fe, and with the final image at the near point
 * m = (fo/fe)(1 + fe/D) with |ue| = fe D/(fe + D). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const D = 25; // cm
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-optical-instruments',
  subject: 'Physics',
  lessonTitleStartsWith: 'Optical instruments',
  afterHeading: 'Compound microscope',
  title: 'Microscope and Telescope Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Choose the focal lengths of the objective and eyepiece of a compound microscope and of an astronomical telescope. See the magnifying powers, the tube length and the lens separations change, with the final image at infinity or at the near point.',
  can: ['Shorten the objective and watch the microscope magnification climb', 'See that a telescope magnifies as fo/fe and that its tube is fo + fe long', 'Fit m against L to recover the near point D = 25 cm'],
  minutes: 12,
  vars: [
    { id: 'fo', label: 'Microscope objective focal length fo', unit: 'cm', min: 0.4, max: 4, step: 0.1, start: 1.5, digits: 1 },
    { id: 'fe', label: 'Microscope eyepiece focal length fe', unit: 'cm', min: 1, max: 8, step: 0.5, start: 3, digits: 1 },
    { id: 'L', label: 'Microscope tube length L', unit: 'cm', min: 8, max: 25, step: 1, start: 15, digits: 0 },
    { id: 'F', label: 'Telescope objective focal length F', unit: 'cm', min: 50, max: 300, step: 10, start: 120, digits: 0 },
    { id: 'ft', label: 'Telescope eyepiece focal length', unit: 'cm', min: 2, max: 10, step: 0.5, start: 4, digits: 1 },
  ],
  outs: [
    { id: 'mo', label: 'Objective magnification L / fo', unit: '', fn: (v) => v.L! / v.fo!, digits: 1 },
    { id: 'me', label: 'Eyepiece magnifying power D / fe', unit: '', fn: (v) => D / v.fe!, digits: 1 },
    { id: 'mm', label: 'Microscope magnifying power (L/fo)(D/fe)', unit: '', fn: (v) => (v.L! / v.fo!) * (D / v.fe!), digits: 0 },
    { id: 'mt', label: 'Telescope magnifying power fo/fe (final image at infinity)', unit: '', fn: (v) => v.F! / v.ft!, digits: 1 },
    { id: 'lt', label: 'Telescope lens separation fo + fe (normal adjustment)', unit: 'cm', fn: (v) => v.F! + v.ft!, digits: 1 },
    { id: 'mtn', label: 'Telescope magnifying power, final image at 25 cm', unit: '', fn: (v) => (v.F! / v.ft!) * (1 + v.ft! / D), digits: 1 },
    { id: 'ltn', label: 'Telescope lens separation, final image at 25 cm', unit: 'cm', fn: (v) => v.F! + (v.ft! * D) / (v.ft! + D), digits: 1 },
  ],
  graphs: [
    { id: 'mm-fo', title: 'Microscope magnifying power against objective focal length', x: 'fo', y: 'mm' },
    { id: 'mm-l', title: 'Microscope magnifying power against tube length', x: 'L', y: 'mm' },
    { id: 'mt-f', title: 'Telescope magnifying power against objective focal length', x: 'F', y: 'mt' },
  ],
  sceneAlt: 'Top: a compound microscope with an objective, an eyepiece and a tube whose length L follows the slider, an object and the enlarged intermediate image whose height follows L/fo. Bottom: an astronomical telescope with two lenses separated by fo + fe, and rays leaving the eyepiece at a steeper angle than they entered, in the ratio fo/fe.',
  scene: ({ v, o }) => {
    const s = 8;
    const x0 = 60;
    const xe = x0 + (v.L! + v.fo! + v.fe!) * s;
    const yM = 52;
    const ih = Math.min(34, 5 * o.mo!);
    const xt0 = 60;
    const s2 = 0.85;
    const xte = xt0 + (v.F! + v.ft!) * s2;
    const yT = 160;
    const alpha = 0.04;
    const beta = Math.min(0.7, alpha * o.mt!);
    const lens = (x: number, y: number, h: number, key: string) => (
      <g key={key}>
        <path d={`M ${x} ${y - h} V ${y + h}`} stroke="#18443b" strokeWidth={2} />
        <path d={`M ${x - 4} ${y - h + 5} l 4 -5 l 4 5 M ${x - 4} ${y + h - 5} l 4 5 l 4 -5`} stroke="#18443b" fill="none" strokeWidth={1.4} />
      </g>
    );
    return (
      <g>
        <text x={8} y={14} fontSize={10} fill="#4d5768">compound microscope · L = {v.L} cm · m = {fmt(o.mm!, 0)}</text>
        {lens(x0, yM, 22, 'ob')}
        {lens(xe, yM, 22, 'ey')}
        <rect x={x0 + v.fo! * s} y={yM - 24} width={v.L! * s} height={4} fill="#c45e42" opacity={0.7} />
        <text x={x0 + (v.fo! + v.L! / 2) * s} y={yM - 28} fontSize={9} textAnchor="middle" fill="#c45e42">tube length L</text>
        <path d={`M ${x0 - 28} ${yM} v -7 m -3 3 l 3 -3 l 3 3`} stroke="#2563a8" strokeWidth={1.6} fill="none" />
        <path d={`M ${x0 + (v.fo! + v.L!) * s} ${yM} v ${ih} m -3 -4 l 3 4 l 3 -4`} stroke="#c45e42" strokeWidth={1.8} fill="none" />
        <circle cx={x0 + v.fo! * s} cy={yM} r={2} fill="#18443b" />
        <circle cx={xe - v.fe! * s} cy={yM} r={2} fill="#18443b" />
        <text x={8} y={118} fontSize={10} fill="#4d5768">astronomical telescope · fo + fe = {fmt(o.lt!, 0)} cm · m = {fmt(o.mt!, 1)}</text>
        {lens(xt0, yT, 26, 'to')}
        {lens(xte, yT, 12, 'te')}
        {[-12, 12].map((h) => (
          <g key={h}>
            <path d={`M 10 ${yT + h - 10 * 0} L ${xt0} ${yT + h}`} stroke="#9aa3b2" strokeWidth={1} />
            <path d={`M ${xt0} ${yT + h} L ${xt0 + v.F! * s2} ${yT + 4 * Math.sign(h) * -0.2}`} stroke="#2563a8" strokeWidth={1} />
          </g>
        ))}
        <path d={`M ${xt0 + v.F! * s2} ${yT} L ${xte} ${yT - 6} L ${xte + 70} ${yT - 6 - 70 * Math.tan(beta)}`} stroke="#c45e42" strokeWidth={1.4} fill="none" />
        <path d={`M ${xt0 + v.F! * s2} ${yT} L ${xte} ${yT + 6} L ${xte + 70} ${yT + 6 - 70 * Math.tan(beta)}`} stroke="#c45e42" strokeWidth={1.4} fill="none" />
        <text x={200} y={222} fontSize={10} textAnchor="middle" fill="#4d5768">ray angle in {fmt(alpha * 57.3, 1)}° → out {fmt((Math.atan(beta) * 180) / Math.PI, 1)}° (m = fo/fe)</text>
      </g>
    );
  },
  discover: [
    'Shorten the objective focal length of the microscope. Which readouts change?',
    'Lengthen the telescope objective and shorten its eyepiece. What happens to the magnifying power and the tube length?',
    'Compare the telescope magnifying power with the image at infinity and with the image at the near point (25 cm).',
  ],
  experiment: [
    'Halve fo and then fe. How does the microscope magnifying power respond to each?',
    'Increase the tube length L at a fixed fo and fe. How does m change?',
    'Change the telescope eyepiece from 4 cm to 2 cm. By what factor does the magnifying power change?',
  ],
  understand: [
    'A compound microscope in normal adjustment has m = (L/fo)(D/fe) with D = 25 cm: the objective must have the short focal length.',
    'A refracting telescope has m = fo/fe, with the objective of long focal length; the lenses are fo + fe apart.',
    'With the final image at the near point the magnifying power is slightly larger and the tube slightly shorter.',
    'If the two lenses of a telescope are interchanged, m becomes fe/fo, less than 1: the instrument diminishes.',
  ],
  preds: [
    {
      id: 'p1', title: 'Halve the objective focal length', prompt: 'In a compound microscope the objective focal length is halved (3.0 cm to 1.5 cm), with fe and L unchanged. What happens to the magnifying power?',
      base: { fo: 3, fe: 3, L: 15 }, test: { fo: 1.5, fe: 3, L: 15 }, options: ['It doubles', 'It halves', 'It is unchanged', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).mm! / outs(base).mm!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `m = (L/fo)(D/fe) is inversely proportional to fo: ${fmt(outs(base).mm!, 0)} becomes ${fmt(outs(test).mm!, 0)}.`,
    },
    {
      id: 'p2', title: 'A longer eyepiece', prompt: 'The eyepiece focal length of the microscope is doubled (3 cm to 6 cm). What happens to the magnifying power?',
      base: { fo: 1.5, fe: 3, L: 15 }, test: { fo: 1.5, fe: 6, L: 15 }, options: ['It doubles', 'It halves', 'It is unchanged', 'It falls to one quarter'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).mm! / outs(base).mm!, [2, 0.5, 1, 0.25]),
      why: ({ base, test, outs }) => `The eyepiece factor D/fe halves: ${fmt(outs(base).mm!, 0)} becomes ${fmt(outs(test).mm!, 0)}.`,
    },
    {
      id: 'p3', title: 'A shorter telescope eyepiece', prompt: 'A telescope has an objective of 120 cm. Its eyepiece focal length is changed from 4 cm to 2 cm. What happens to the magnifying power in normal adjustment?',
      base: { F: 120, ft: 4 }, test: { F: 120, ft: 2 }, options: ['It halves', 'It doubles', 'It is unchanged', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).mt! / outs(base).mt!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `The telescope magnifying power is m = fo/fe, inversely proportional to fe: ${fmt(outs(base).mt!, 1)} becomes ${fmt(outs(test).mt!, 1)}.`,
    },
    {
      id: 'p4', title: 'The length of the telescope', prompt: 'The eyepiece focal length of a telescope with a 120 cm objective is doubled (4 cm to 8 cm). What happens to the distance between the lenses in normal adjustment?',
      base: { F: 120, ft: 4 }, test: { F: 120, ft: 8 }, options: ['It doubles', 'It rises slightly, from 124 cm to 128 cm', 'It halves', 'It is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).lt! / outs(base).lt!; return r > 1.5 ? 0 : r > 1.005 ? 1 : r < 0.7 ? 2 : 3; },
      why: ({ base, test, outs }) => `The separation is fo + fe, dominated by the long objective: ${fmt(outs(base).lt!, 0)} cm becomes ${fmt(outs(test).lt!, 0)} cm.`,
    },
  ],
  measure: {
    instruction: 'Keep the two microscope focal lengths fixed and change the tube length L. Record the magnifying power for at least three values of L.',
    vary: 'L',
    record: ['mo', 'me', 'mm'],
    fit: {
      xLabel: 'L (cm)',
      yLabel: 'm',
      x: (v) => v.L!,
      y: (_v, o) => o.mm!,
      interpret: (slope, _i, v) => `m against L is a straight line through the origin: m = (D/(fo fe)) L. The slope is ${fmt(slope, 3)} per cm, so D = slope × fo × fe = ${fmt(slope * v.fo! * v.fe!, 1)} cm (the least distance of distinct vision is 25 cm).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A compound microscope has an objective of focal length 1.0 cm, an eyepiece of focal length 2.5 cm and a tube length of 12 cm. Its magnifying power in normal adjustment (D = 25 cm) is about', options: ['120', '48', '300', '12'], answer: 0,
      why: 'm = (L/fo)(D/fe) = (12/1.0)(25/2.5) = 12 × 10 = 120.',
      verify: () => near((12 / 1) * (D / 2.5), [120, 48, 300, 12]),
    },
    {
      id: 'q2', q: 'An astronomical telescope has an objective of focal length 100 cm and an eyepiece of focal length 2.5 cm. Its magnifying power in normal adjustment is', options: ['100', '2.5', '40', '250'], answer: 2,
      why: 'In normal adjustment m = fo/fe = 100/2.5 = 40 (the angle subtended by the image is 40 times that of the object).',
      verify: () => near(100 / 2.5, [100, 2.5, 40, 250]),
    },
    {
      id: 'q3', q: 'A telescope has an objective of focal length 80 cm and an eyepiece of focal length 5.0 cm. In normal adjustment the distance between the lenses is', options: ['80 cm', '85 cm', '75 cm', '400 cm'], answer: 1,
      why: 'In normal adjustment the lens separation is fo + fe = 80 + 5.0 = 85 cm.',
      verify: () => near(80 + 5, [80, 85, 75, 400]),
    },
    {
      id: 'q4', q: 'A telescope has fo = 90 cm and fe = 3.0 cm. Its magnifying power when the final image is formed at the near point (25 cm) is about', options: ['30', '27', '90', '33.6'], answer: 3,
      why: 'm = (fo/fe)(1 + fe/D) = (90/3.0)(1 + 3.0/25) = 30 × 1.12 = 33.6.',
      verify: () => near((90 / 3) * (1 + 3 / D), [30, 27, 90, 33.6]),
    },
    {
      id: 'q5', q: 'The Moon (diameter 3.48 × 10⁶ m) is 3.84 × 10⁸ m away. The objective of a telescope has a focal length of 8.0 m. The diameter of the image formed by the objective is about', options: ['7.3 cm', '3.6 cm', '14.5 cm', '0.73 cm'], answer: 0,
      why: 'The image lies at the focus and subtends the same angle as the Moon: d = F × (3.48 × 10⁶ / 3.84 × 10⁸) = 8.0 × 9.06 × 10⁻³ = 0.0725 m = 7.3 cm.',
      verify: () => near(8 * (3.48e6 / 3.84e8) * 100, [7.3, 3.6, 14.5, 0.73]),
    },
  ],
};
