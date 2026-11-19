/**
 * Chapter lab: Physics, Unit V, "Displacement current and the Ampère–Maxwell law".
 * The model: a circular parallel plate capacitor (plate radius R, gap d) charged so that V rises at rate dV/dt.
 * C = ε0πR²/d, i_d = ε0 dΦE/dt = C dV/dt (equal to the wire current), B = μ0 i_d r / 2πR² inside the plates (r < R)
 * and μ0 i_d / 2πr outside (r > R). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const EPS0 = 8.854e-12;
const MU0 = 4 * Math.PI * 1e-7;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(x - v) < Math.abs(x - vals[b]!) ? i : b), 0);
// R, r in cm; d in mm; dVdt in V/µs
const cap = (R: number, d: number) => (EPS0 * Math.PI * (R * 1e-2) ** 2) / (d * 1e-3); // F
const idOf = (R: number, d: number, dvdt: number) => cap(R, d) * dvdt * 1e6; // A
const bOf = (R: number, d: number, dvdt: number, r: number) => {
  const i = idOf(R, d, dvdt);
  return r <= R ? (MU0 * i * (r * 1e-2)) / (2 * Math.PI * (R * 1e-2) ** 2) : (MU0 * i) / (2 * Math.PI * (r * 1e-2));
};

export const spec: Spec = {
  id: 'phys-displacement-current',
  subject: 'Physics',
  lessonTitleStartsWith: 'Displacement current and the Amp',
  afterHeading: 'Magnetic field between the plates of a charging capacitor',
  title: 'Displacement Current Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Charge a circular parallel plate capacitor and measure the magnetic field in and around its gap, where no charge moves. See the displacement current match the wire current, and the field grow with r inside the plates and fall as 1/r outside.',
  can: ['See the displacement current in the gap equal C dV/dt in the wires', 'Move a loop of radius r across the plate edge and watch B peak there', 'Recover ε₀ from your own current readings'],
  minutes: 12,
  vars: [
    { id: 'R', label: 'Plate radius R', unit: 'cm', min: 2, max: 10, step: 1, start: 5, digits: 0 },
    { id: 'd', label: 'Plate separation d', unit: 'mm', min: 0.5, max: 5, step: 0.5, start: 2, digits: 1 },
    { id: 'dv', label: 'Rate of voltage rise dV/dt', unit: 'V/µs', min: 1, max: 100, step: 1, start: 10, digits: 0 },
    { id: 'r', label: 'Radius r of the loop (Amperian circle)', unit: 'cm', min: 1, max: 20, step: 1, start: 3, digits: 0 },
  ],
  outs: [
    { id: 'C', label: 'Capacitance C = ε₀πR²/d', unit: 'pF', fn: (v) => cap(v.R!, v.d!) * 1e12, digits: 2 },
    { id: 'id', label: 'Displacement current i_d = C dV/dt', unit: 'mA', fn: (v) => idOf(v.R!, v.d!, v.dv!) * 1e3, digits: 3 },
    { id: 'dE', label: 'Rate of change of E, dE/dt', unit: '×10⁹ V/(m s)', fn: (v) => (v.dv! * 1e6) / (v.d! * 1e-3) / 1e9, digits: 2 },
    { id: 'B', label: 'Magnetic field B at radius r', unit: 'nT', fn: (v) => bOf(v.R!, v.d!, v.dv!, v.r!) * 1e9, digits: 3 },
  ],
  graphs: [
    { id: 'b-r', title: 'Field against loop radius', x: 'r', y: 'B' },
    { id: 'id-dv', title: 'Displacement current against dV/dt', x: 'dv', y: 'id' },
    { id: 'id-d', title: 'Displacement current against plate separation', x: 'd', y: 'id' },
  ],
  sceneAlt: 'Left, the side view of two circular plates whose height follows R and gap follows d, with wire current arrows and electric field arrows in the gap. Right, the end-on view of a plate as a circle of radius R with a concentric loop of radius r, whose field arrow is longest at the plate edge.',
  scene: ({ v, o }) => {
    const hp = 18 + v.R! * 8;
    const gap = 8 + v.d! * 7;
    const lx = 95;
    const arrows = Math.max(2, Math.min(6, Math.round(o.dE! / 4)));
    const ia = 12 + Math.min(34, o.id! * 8);
    const cx = 295, cy = 112, s = 4.4;
    const inside = v.r! <= v.R!;
    const la = Math.max(4, Math.min(36, o.B! * 3));
    return (
      <g>
        <rect x={lx - gap / 2 - 6} y={112 - hp / 2} width={6} height={hp} fill="#18443b" />
        <rect x={lx + gap / 2} y={112 - hp / 2} width={6} height={hp} fill="#18443b" />
        {Array.from({ length: arrows }, (_, i) => {
          const y = 112 - hp / 2 + ((i + 0.5) * hp) / arrows;
          return <path key={i} d={`M ${lx - gap / 2} ${y} h ${gap} m -5 -3 l 5 3 l -5 3`} stroke="#2563a8" strokeWidth={1.4} fill="none" />;
        })}
        <path d={`M ${lx - gap / 2 - 3} ${112 - hp / 2 - 4} V 24 H 25 V 200 H ${lx - gap / 2 - 3} V ${112 + hp / 2}`} fill="none" stroke="#9aa3b2" />
        <path d={`M 25 100 v ${-ia} m -4 6 l 4 -6 l 4 6`} stroke="#c45e42" strokeWidth={2.2} fill="none" />
        <text x={30} y={216} fontSize={10} fill="#4d5768">i = {fmt(o.id!, 2)} mA in the wire</text>
        <text x={lx} y={14} fontSize={10} textAnchor="middle" fill="#2563a8">i_d in the gap = {fmt(o.id!, 2)} mA</text>
        <circle cx={cx} cy={cy} r={v.R! * s} fill="#eaf1fb" stroke="#18443b" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={v.r! * s} fill="none" stroke={inside ? '#c45e42' : '#7a4ea3'} strokeWidth={1.8} strokeDasharray="5 3" />
        <path d={`M ${cx} ${cy - v.r! * s} h ${la} m -6 -4 l 6 4 l -6 4`} stroke={inside ? '#c45e42' : '#7a4ea3'} strokeWidth={2.4} fill="none" />
        <text x={cx} y={cy + 3} fontSize={9} textAnchor="middle" fill="#2563a8">i_d ⊙</text>
        <text x={cx} y={226} fontSize={11} textAnchor="middle" fill="#4d5768">r = {v.r} cm ({inside ? 'inside' : 'outside'} the plates) · B = {fmt(o.B!, 2)} nT</text>
      </g>
    );
  },
  discover: [
    'Raise dV/dt. The wire current and the displacement current rise together: are they equal?',
    'Slide the loop radius r from 1 cm outwards through the plate edge R. Where is B largest?',
    'Change the plate separation d: what does it do to the current for the same dV/dt?',
  ],
  experiment: [
    'With r inside the plates, double r: how does B change? Repeat outside the plates.',
    'Double the plate radius R with r kept inside. Does B change?',
    'Double dV/dt. Which readouts follow?',
  ],
  understand: [
    'In the gap no charge flows, but the electric flux changes, giving a displacement current i_d = ε₀ dΦE/dt = C dV/dt.',
    'i_d equals the conduction current in the wires, so the total current is continuous through the capacitor.',
    'By the Ampère–Maxwell law B = μ₀i_d r/(2πR²) inside the plates (growing linearly with r) and B = μ₀i_d/(2πr) outside (falling as 1/r).',
    'B is largest at the plate edge r = R.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the rate of charging', prompt: 'The voltage across the capacitor is made to rise twice as fast, from 10 V/µs to 20 V/µs. What happens to the displacement current in the gap?',
      base: { dv: 10 }, test: { dv: 20 }, options: ['It halves', 'It doubles', 'It stays the same', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).id! / outs(base).id!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `i_d = C dV/dt is proportional to dV/dt. i_d goes from ${fmt(outs(base).id!, 3)} mA to ${fmt(outs(test).id!, 3)} mA.`,
    },
    {
      id: 'p2', title: 'Inside the plates, double r', prompt: 'A circular loop inside the plates (R = 8 cm) is enlarged from r = 2 cm to r = 4 cm. What happens to the field B on the loop?',
      base: { R: 8, r: 2 }, test: { r: 4 }, options: ['It halves', 'It stays the same', 'It doubles', 'It falls to a quarter'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).B! / outs(base).B!, [0.5, 1, 2, 0.25]),
      why: ({ base, test, outs }) => `Inside, B = μ₀i_d r/(2πR²) is proportional to r. B goes from ${fmt(outs(base).B!, 3)} nT to ${fmt(outs(test).B!, 3)} nT.`,
    },
    {
      id: 'p3', title: 'Outside the plates, double r', prompt: 'A circular loop outside the plates (R = 5 cm) is enlarged from r = 10 cm to r = 20 cm. What happens to the field B on the loop?',
      base: { R: 5, r: 10 }, test: { r: 20 }, options: ['It doubles', 'It falls to a quarter', 'It stays the same', 'It halves'], answer: 3,
      verify: ({ base, test, outs }) => near(outs(test).B! / outs(base).B!, [2, 0.25, 1, 0.5]),
      why: ({ base, test, outs }) => `Outside, the loop encloses the whole i_d, so B = μ₀i_d/(2πr) is proportional to 1/r. B goes from ${fmt(outs(base).B!, 3)} nT to ${fmt(outs(test).B!, 3)} nT.`,
    },
    {
      id: 'p4', title: 'Bigger plates, same loop', prompt: 'With dV/dt and d fixed, the plate radius is doubled from 4 cm to 8 cm while the loop stays at r = 3 cm (inside both). What happens to the field on the loop?',
      base: { R: 4, r: 3 }, test: { R: 8 }, options: ['It becomes four times as large', 'It doubles', 'It stays the same', 'It halves'], answer: 2,
      verify: ({ base, test, outs }) => near(outs(test).B! / outs(base).B!, [4, 2, 1, 0.5]),
      why: ({ base, test, outs }) => `C and i_d grow as R² (i_d: ${fmt(outs(base).id!, 3)} mA to ${fmt(outs(test).id!, 3)} mA), but B = μ₀i_d r/(2πR²) divides by R², so B is unchanged: ${fmt(outs(base).B!, 3)} nT and ${fmt(outs(test).B!, 3)} nT. It is the displacement current density that sets B inside.`,
    },
  ],
  measure: {
    instruction: 'Keep R and d fixed and change the rate of voltage rise dV/dt. Record the displacement current for at least three rates, then plot i_d (ampere) against dV/dt (V/s). The slope is the capacitance.',
    vary: 'dv',
    record: ['id', 'B'],
    fit: {
      xLabel: 'dV/dt (V/s)',
      yLabel: 'i_d (A)',
      x: (v) => v.dv! * 1e6,
      y: (_v, o) => o.id! * 1e-3,
      interpret: (slope, _i, v) => {
        const eps = (slope * v.d! * 1e-3) / (Math.PI * (v.R! * 1e-2) ** 2);
        return `i_d = C·dV/dt, so i_d against dV/dt is a straight line through the origin with slope C = ${fmt(slope * 1e12, 2)} pF. Since C = ε₀πR²/d, ε₀ = slope × d ÷ πR² ≈ ${fmt(eps, 2, true)} F/m (accepted 8.854 × 10^-12).`;
      },
    },
  },
  questions: [
    {
      id: 'q1', q: 'The voltage across a 50 pF parallel plate capacitor rises at 2 × 10⁷ V/s. The displacement current between its plates is', options: ['0.5 mA', '2 mA', '1 mA', '10 mA'], answer: 2,
      why: 'i_d = C dV/dt = (50 × 10⁻¹²)(2 × 10⁷) = 1 × 10⁻³ A = 1 mA, equal to the current in the connecting wires.',
      verify: () => near(50e-12 * 2e7 * 1e3, [0.5, 2, 1, 10]),
    },
    {
      id: 'q2', q: 'A displacement current of 2 mA flows uniformly between circular plates of radius 5 cm. The magnetic field at r = 2 cm from the axis (inside the plates) is', options: ['3.2 nT', '8.0 nT', '1.6 nT', '4.0 nT'], answer: 0,
      why: 'B = μ₀i_d r/(2πR²) = (2 × 10⁻⁷)(2 × 10⁻³)(0.02)/(0.05)² = 3.2 × 10⁻⁹ T = 3.2 nT.',
      verify: () => near(((MU0 * 2e-3 * 0.02) / (2 * Math.PI * 0.05 ** 2)) * 1e9, [3.2, 8.0, 1.6, 4.0]),
    },
    {
      id: 'q3', q: 'For the same plates and current (2 mA, radius 5 cm), the magnetic field at r = 10 cm from the axis (outside the plates) is', options: ['0.4 nT', '40 nT', '4 nT', '1.6 nT'], answer: 2,
      why: 'Outside, B = μ₀i_d/(2πr) = (2 × 10⁻⁷)(2 × 10⁻³)/0.10 = 4 × 10⁻⁹ T = 4 nT.',
      verify: () => near(((MU0 * 2e-3) / (2 * Math.PI * 0.1)) * 1e9, [0.4, 40, 4, 1.6]),
    },
    {
      id: 'q4', q: 'The plates of a capacitor have area 100 cm². A displacement current of 0.885 mA flows between them. The electric field between them is changing at the rate (ε₀ = 8.85 × 10⁻¹² C² N⁻¹ m⁻²)', options: ['1 × 10⁹ V/(m s)', '1 × 10¹¹ V/(m s)', '1 × 10⁸ V/(m s)', '1 × 10¹⁰ V/(m s)'], answer: 3,
      why: 'i_d = ε₀A dE/dt, so dE/dt = i_d/(ε₀A) = (0.885 × 10⁻³)/((8.85 × 10⁻¹²)(1.0 × 10⁻²)) = 1 × 10¹⁰ V m⁻¹ s⁻¹.',
      verify: () => near(0.885e-3 / (8.85e-12 * 1e-2), [1e9, 1e11, 1e8, 1e10]) ,
    },
    {
      id: 'q5', q: 'A 100 pF capacitor is connected to an AC source of peak voltage 10 V and frequency 1 MHz. The peak displacement current in the gap is about', options: ['0.63 mA', '6.3 mA', '63 mA', '1.0 mA'], answer: 1,
      why: 'i_d = ωCV₀ cos ωt, with peak ωCV₀ = (2π × 10⁶)(100 × 10⁻¹²)(10) = 6.3 × 10⁻³ A = 6.3 mA.',
      verify: () => near(2 * Math.PI * 1e6 * 100e-12 * 10 * 1e3, [0.63, 6.3, 63, 1.0]),
    },
  ],
};
