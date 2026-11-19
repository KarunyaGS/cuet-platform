/**
 * Chapter lab: Physics, Unit IX, "Intrinsic and extrinsic semiconductors, the p-n junction and the junction diode".
 * The model: a diode in series with a resistor R and a battery E. The diode follows the ideal-diode (Shockley) form
 * I = I_s (exp(V_d / V_T) − 1) with V_T = k_B T / e, which reproduces the lesson's picture (tiny reverse saturation current,
 * sharp forward knee near 0.7 V for silicon, dynamic resistance r_d = ΔV/ΔI falling as current rises); the circuit is solved from E = IR + V_d.
 * Barrier V_barrier = V_0 − V_d (V_0 = 0.7 V). Doping: n_e ≈ N_D, n_h ≈ n_i²/N_D with n_i = 1.5×10¹⁶ m⁻³ (silicon, 300 K).
 * The Shockley equation itself is not in the lesson text: an expert should confirm it is acceptable as a model. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec, Values } from '../engine/types';

const KB = 1.38e-23;
const Q = 1.6e-19;
const V0 = 0.7;
const NI = 1.5e16;

const vt = (T: number) => (KB * T) / Q;
const solveVd = (E: number, R: number, T: number, IsFA: number) => {
  const VT = vt(T);
  const Is = IsFA * 1e-15;
  let lo = -Math.abs(E) - 2;
  let hi = 1.5;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    const f = (E - mid) / R - Is * (Math.exp(mid / VT) - 1);
    if (f > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const Vd = (v: Values) => solveVd(v.E!, v.R!, v.T!, v.Is!);
const Iamp = (v: Values) => (v.E! - Vd(v)) / v.R!;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-semiconductors-pn-diode',
  subject: 'Physics',
  lessonTitleStartsWith: 'Intrinsic and extrinsic semiconductors',
  afterHeading: 'I-V characteristics of a junction diode',
  title: 'p-n Junction Diode Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Put a silicon diode in series with a battery and a resistor. Reverse the battery, change the resistor and the temperature, dope the crystal, and watch the current, the junction voltage, the barrier and the dynamic resistance respond.',
  can: ['Flip the battery and see the current collapse to the tiny reverse saturation current', 'See that the forward voltage stays near 0.7 V while the current changes a lot', 'Fit ln I against V to recover the thermal voltage k_BT/e'],
  minutes: 13,
  vars: [
    { id: 'E', label: 'Battery voltage E (negative = reverse bias)', unit: 'V', min: -10, max: 10, step: 0.5, start: 5, digits: 1 },
    { id: 'R', label: 'Series resistor R', unit: 'Ω', min: 100, max: 2000, step: 10, start: 430, digits: 0 },
    { id: 'T', label: 'Temperature T', unit: 'K', min: 250, max: 400, step: 5, start: 300, digits: 0 },
    { id: 'Is', label: 'Reverse saturation current I_s', unit: 'fA', min: 1, max: 100000, step: 1, start: 10, log: true, digits: 0 },
    { id: 'ND', label: 'Donor density N_D in the n-side', unit: 'm⁻³', min: 1e20, max: 1e24, step: 1, start: 1e22, log: true, digits: 0 },
  ],
  outs: [
    { id: 'Vd', label: 'Voltage across the diode V', unit: 'V', fn: (v) => Vd(v), digits: 3 },
    { id: 'I', label: 'Current in the circuit I = (E − V)/R', unit: 'mA', fn: (v) => Iamp(v) * 1000, digits: 3 },
    { id: 'rd', label: 'Dynamic resistance r_d = ΔV/ΔI = V_T/(I + I_s)', unit: 'Ω', fn: (v) => Math.min(1e12, vt(v.T!) / (v.Is! * 1e-15 * Math.exp(Vd(v) / vt(v.T!)))), digits: 1 },
    { id: 'Vbar', label: 'Barrier at the junction V0 − V (V0 = 0.7 V)', unit: 'V', fn: (v) => V0 - Vd(v), digits: 2 },
    { id: 'VT', label: 'Thermal voltage V_T = k_BT/e', unit: 'mV', fn: (v) => vt(v.T!) * 1000, digits: 2 },
    { id: 'ne', label: 'Electron density in the n-side n_e ≈ N_D', unit: 'm⁻³', fn: (v) => v.ND!, sci: true },
    { id: 'nh', label: 'Hole density in the n-side n_h = n_i²/N_D', unit: 'm⁻³', fn: (v) => (NI * NI) / v.ND!, sci: true },
  ],
  graphs: [
    { id: 'i-e', title: 'Current against battery voltage (I-V of the circuit)', x: 'E', y: 'I' },
    { id: 'b-e', title: 'Junction barrier against battery voltage', x: 'E', y: 'Vbar' },
    { id: 'nh-nd', title: 'Hole density against donor density', x: 'ND', y: 'nh', logX: true, logY: true },
  ],
  sceneAlt: 'A p-n junction with a battery: the p-side on the left holds holes and the n-side on the right holds electrons, with the depletion layer between them. The depletion layer narrows and charge carriers cross when the battery is forward, and the layer widens with almost no crossing in reverse; the potential barrier is drawn below as a step whose height follows V0 minus the diode voltage.',
  scene: ({ v, o }) => {
    const w = Math.max(12, Math.min(150, 34 * Math.sqrt(Math.max(o.Vbar!, 0.02) / 0.7)));
    const xm = 200;
    const forward = o.I! > 0.01;
    const cross = forward ? Math.max(1, Math.min(8, Math.round(Math.log10(o.I! * 1000) * 1.6))) : 0;
    const barPx = Math.max(2, Math.min(60, o.Vbar! * 12));
    return (
      <g>
        <rect x={60} y={40} width={xm - w / 2 - 60} height={70} fill="#c45e42" opacity={0.12} stroke="#c45e42" />
        <rect x={xm + w / 2} y={40} width={340 - xm - w / 2} height={70} fill="#2563a8" opacity={0.12} stroke="#2563a8" />
        <rect x={xm - w / 2} y={40} width={w} height={70} fill="#9aa3b2" opacity={0.3} />
        <text x={85} y={36} fontSize={11} fill="#c45e42">p-type (holes ○)</text>
        <text x={255} y={36} fontSize={11} fill="#2563a8">n-type (electrons ●)</text>
        {[0, 1, 2, 3].map((i) => <circle key={`h${i}`} cx={75 + (i % 2) * 28} cy={58 + i * 15} r={4} fill="#fff" stroke="#c45e42" />)}
        {[0, 1, 2, 3].map((i) => <circle key={`e${i}`} cx={330 - (i % 2) * 28} cy={58 + i * 15} r={4} fill="#2563a8" />)}
        {Array.from({ length: cross }, (_, i) => <circle key={`x${i}`} cx={xm - w / 2 + (i * w) / Math.max(1, cross)} cy={52 + (i % 4) * 16} r={3.5} fill="#2563a8" />)}
        <path d={`M 60 125 V 160 H 150`} stroke="#7c8595" fill="none" />
        <path d={`M 340 125 V 160 H 250`} stroke="#7c8595" fill="none" />
        <path d="M 190 150 V 170 M 210 156 V 164" stroke="#18443b" strokeWidth={2.4} />
        <text x={200} y={184} fontSize={10} textAnchor="middle" fill="#18443b">battery E = {fmt(v.E!, 1)} V ({v.E! >= 0 ? 'forward' : 'reverse'}) · R = {v.R} Ω</text>
        <polyline points={`60,205 ${xm - w / 2},205 ${xm - w / 2},${205 - barPx} ${xm + w / 2},${205 - barPx} ${xm + w / 2},205 340,205`} fill="none" stroke="#18443b" strokeWidth={1.6} />
        <text x={xm} y={224} fontSize={10} textAnchor="middle" fill="#4d5768">barrier {fmt(o.Vbar!, 2)} V · I = {fmt(o.I!, 3)} mA</text>
      </g>
    );
  },
  discover: [
    'With a forward battery of 5 V, read the voltage across the diode. Then change the resistor: does the diode voltage change much?',
    'Reverse the battery (negative E). What is the size of the current now?',
    'Change the donor density. Which carrier is the majority carrier on the n-side and what happens to the minority carriers?',
  ],
  experiment: [
    'Sweep the battery from −10 V to +10 V and study the current graph. Where is the knee?',
    'Change R at a fixed forward battery. How do the current and the dynamic resistance r_d change?',
    'Raise the temperature. How does the thermal voltage V_T change, and what does that do to the forward voltage?',
  ],
  understand: [
    'Forward bias lowers the barrier to V0 − V, the depletion layer narrows and a large current flows once V passes the threshold (about 0.7 V for silicon).',
    'Reverse bias raises the barrier to V0 + V; only the tiny reverse saturation current of minority carriers flows.',
    'The I-V curve is not a straight line, so the dynamic resistance r_d = ΔV/ΔI differs at each point: small in forward, huge in reverse.',
    'In a doped crystal n_e n_h = n_i²: raising the majority density N_D lowers the minority density n_i²/N_D.',
  ],
  preds: [
    {
      id: 'p1', title: 'Reverse the battery', prompt: 'A silicon diode carries a current with a 5 V forward battery and 430 Ω. The battery is reversed (E = −5 V). What happens to the current?',
      base: { E: 5 }, test: { E: -5 }, options: ['It reverses and stays about the same size', 'It almost vanishes: only a tiny reverse current flows', 'It doubles', 'It is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).I!) < 1e-3 * Math.abs(outs(base).I!) ? 1 : outs(test).I! < 0 && Math.abs(Math.abs(outs(test).I! / outs(base).I!) - 1) < 0.1 ? 0 : outs(test).I! > outs(base).I! ? 2 : 3),
      why: ({ base, test, outs }) => `Reverse bias raises the barrier and only minority carriers drift across. The current falls from ${fmt(outs(base).I!, 2)} mA to ${fmt(outs(test).I!, 8, true)} mA.`,
    },
    {
      id: 'p2', title: 'A bigger forward battery', prompt: 'With R = 430 Ω, the forward battery is raised from 3 V to 6 V. What happens to the voltage across the diode?',
      base: { E: 3, R: 430 }, test: { E: 6, R: 430 }, options: ['It doubles to about 1.4 V', 'It stays close to 0.7 V', 'It halves', 'It rises to about 3 V'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).Vd! / outs(base).Vd!; return Math.abs(r - 1) < 0.1 ? 1 : r > 1.8 ? 0 : r < 0.6 ? 2 : 3; },
      why: ({ base, test, outs }) => `The current rises steeply for a tiny rise in V (an exponential curve), so V stays near the knee: ${fmt(outs(base).Vd!, 3)} V becomes ${fmt(outs(test).Vd!, 3)} V while the current goes from ${fmt(outs(base).I!, 1)} mA to ${fmt(outs(test).I!, 1)} mA.`,
    },
    {
      id: 'p3', title: 'More forward current', prompt: 'The series resistor is reduced from 1000 Ω to 250 Ω at E = 5 V, so the forward current rises about four times. What happens to the dynamic resistance r_d?',
      base: { E: 5, R: 1000 }, test: { E: 5, R: 250 }, options: ['It rises', 'It falls to about a quarter', 'It is unchanged', 'It doubles'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).rd! / outs(base).rd!; return r > 1.1 ? 0 : r < 0.4 ? 1 : Math.abs(r - 1) < 0.05 ? 2 : 3; },
      why: ({ base, test, outs }) => `r_d = V_T/I, so it falls as the current rises: ${fmt(outs(base).rd!, 1)} Ω at ${fmt(outs(base).I!, 1)} mA and ${fmt(outs(test).rd!, 1)} Ω at ${fmt(outs(test).I!, 1)} mA.`,
    },
    {
      id: 'p4', title: 'Dope ten times heavier', prompt: 'The donor density in the n-side is raised tenfold (10²¹ to 10²² m⁻³). What happens to the density of holes there?',
      base: { ND: 1e21 }, test: { ND: 1e22 }, options: ['It rises tenfold', 'It falls to one tenth', 'It is unchanged', 'It falls to one hundredth'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).nh! / outs(base).nh!, [10, 0.1, 1, 0.01]),
      why: ({ base, test, outs }) => `n_e n_h = n_i² is fixed, so more electrons means fewer holes: n_h goes from ${fmt(outs(base).nh!, 2, true)} m⁻³ to ${fmt(outs(test).nh!, 2, true)} m⁻³.`,
    },
  ],
  measure: {
    instruction: 'Keep the battery at a forward value (E = 5 V) and change the series resistor. Record the diode voltage and current for at least three resistor values. The graph is ln I against V.',
    vary: 'R',
    record: ['Vd', 'I', 'rd'],
    fit: {
      xLabel: 'Diode voltage V (V)',
      yLabel: 'ln(I / 1 A)',
      x: (_v, o) => o.Vd!,
      y: (_v, o) => Math.log(Math.max(o.I! * 1e-3, 1e-30)),
      interpret: (slope, intercept, v) => `ln I against V is a straight line for forward readings, so the current grows exponentially with the voltage. The slope is e/(k_BT) = ${fmt(slope, 2)} V⁻¹, so V_T = ${fmt(1000 / slope, 2)} mV and k_B = e/(slope × T) ≈ ${fmt(Q / (slope * v.T!), 2, true)} J/K (accepted 1.38 × 10^-23). The intercept gives I_s = ${fmt(Math.exp(intercept) * 1e15, 1)} fA (you set ${fmt(v.Is!, 1)} fA).`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A silicon diode (forward drop 0.7 V) is connected forward biased in series with a 200 Ω resistor and a 3.0 V battery. The current is', options: ['15 mA', '11.5 mA', '3.5 mA', '23 mA'], answer: 1,
      why: 'The resistor has (3.0 − 0.7) = 2.3 V across it, so I = 2.3/200 = 11.5 mA.',
      verify: () => near((3 - 0.7) / 200 * 1000, [15, 11.5, 3.5, 23]),
    },
    {
      id: 'q2', q: 'The forward current of a diode rises from 8 mA to 28 mA when the voltage across it rises from 0.70 V to 0.75 V. The dynamic resistance in this range is', options: ['25 Ω', '0.4 Ω', '250 Ω', '2.5 Ω'], answer: 3,
      why: 'r_d = ΔV/ΔI = 0.05 V / (20 × 10⁻³ A) = 2.5 Ω.',
      verify: () => near(0.05 / 0.02, [25, 0.4, 250, 2.5]),
    },
    {
      id: 'q3', q: 'The barrier potential of an unbiased junction is 0.6 V and the depletion layer is 0.3 µm wide. The average electric field in it is about', options: ['2 × 10⁵ V/m', '2 × 10⁶ V/m', '2 × 10⁷ V/m', '1.8 × 10⁻⁷ V/m'], answer: 1,
      why: 'E ≈ V0/d = 0.6/(0.3 × 10⁻⁶) = 2 × 10⁶ V/m.',
      verify: () => near(0.6 / 0.3e-6, [2e5, 2e6, 2e7, 1.8e-7]),
    },
    {
      id: 'q4', q: 'Silicon (n_i = 1.5 × 10¹⁶ m⁻³) is doped with donors at N_D = 5 × 10²² m⁻³. The hole density is about', options: ['4.5 × 10⁹ m⁻³', '3.0 × 10⁻⁷ m⁻³', '5.0 × 10²² m⁻³', '1.5 × 10¹⁶ m⁻³'], answer: 0,
      why: 'n_h = n_i²/N_D = (1.5 × 10¹⁶)² / (5 × 10²²) = 2.25 × 10³² / 5 × 10²² = 4.5 × 10⁹ m⁻³.',
      verify: () => near((NI * NI) / 5e22, [4.5e9, 3e-7, 5e22, 1.5e16]),
    },
    {
      id: 'q5', q: 'A silicon junction has a barrier potential of 0.7 V. A reverse bias of 3.0 V is applied. The barrier across the junction becomes', options: ['2.3 V', '3.0 V', '3.7 V', '0.7 V'], answer: 2,
      why: 'In reverse bias the barrier is V0 + V = 0.7 + 3.0 = 3.7 V (in forward bias it would be V0 − V).',
      verify: () => near(V0 + 3.0, [2.3, 3.0, 3.7, 0.7]),
    },
  ],
};
