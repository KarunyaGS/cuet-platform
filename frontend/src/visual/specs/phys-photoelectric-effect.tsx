/**
 * Chapter lab: Physics, Unit VII, "Dual nature of radiation and the photoelectric effect".
 * The model: Einstein's equation K_max = hν − φ0 = eV0, saturation current from the photon rate and a fixed 1% quantum efficiency,
 * and a schematic photocurrent-voltage curve (the shape is drawn from the lesson's qualitative description). Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec } from '../engine/types';

const H = 6.63e-34; // J s
const E = 1.6e-19; // C
const ME = 9.1e-31; // kg
const HE = H / E; // V s
const QE = 0.01; // one photon in 100 ejects an electron
const V_SAT = 2; // volts above V0 at which the collector gathers every electron (schematic)

const kmax = (nu14: number, phi: number) => Math.max(0, HE * nu14 * 1e14 - phi); // eV
const isat = (nu14: number, P: number, phi: number) => (kmax(nu14, phi) > 0 ? ((P * 1e-3 * QE) / (H * nu14 * 1e14)) * E * 1e6 : 0); // µA
const current = (nu14: number, P: number, phi: number, V: number) => {
  const k = kmax(nu14, phi);
  if (k <= 0) return 0;
  const x = Math.min(1, Math.max(0, (V + k) / (k + V_SAT)));
  return isat(nu14, P, phi) * x * x * (3 - 2 * x);
};
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);
const colour = (nm: number) => (nm < 380 ? '#7c3aed' : nm < 450 ? '#6d28d9' : nm < 495 ? '#2563eb' : nm < 570 ? '#16a34a' : nm < 590 ? '#ca8a04' : nm < 650 ? '#ea580c' : nm <= 780 ? '#b91c1c' : '#7f1d1d');

export const spec: Spec = {
  id: 'phys-photoelectric-effect',
  subject: 'Physics',
  lessonTitleStartsWith: 'Dual nature of radiation and the photoelectric effect',
  afterHeading: "Einstein's photoelectric equation",
  title: 'Photoelectric Effect Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: "Shine light of any frequency and intensity on a metal. Change the work function and the collector voltage, and watch the photocurrent, the stopping potential and the electron energy respond to Einstein's equation.",
  can: ['Raise the frequency and watch the stopping potential climb as hν − φ0', 'Double the intensity and see the saturation current double but the stopping potential stay put', 'Fit V0 against ν from your own readings to recover h/e and the work function'],
  minutes: 12,
  vars: [
    { id: 'nu', label: 'Frequency ν of the light', unit: '× 10¹⁴ Hz', min: 4.5, max: 15, step: 0.25, start: 8, digits: 2 },
    { id: 'P', label: 'Light power on the emitter', unit: 'mW', min: 0.5, max: 5, step: 0.5, start: 1, digits: 1 },
    { id: 'phi', label: 'Work function φ0 of the metal', unit: 'eV', min: 1.9, max: 4.7, step: 0.1, start: 2.3, digits: 1 },
    { id: 'V', label: 'Collector potential V', unit: 'V', min: -4, max: 4, step: 0.1, start: 1, digits: 1 },
  ],
  outs: [
    { id: 'Eph', label: 'Photon energy hν', unit: 'eV', fn: (v) => HE * v.nu! * 1e14, digits: 2 },
    { id: 'K', label: 'Maximum kinetic energy K_max = hν − φ0', unit: 'eV', fn: (v) => kmax(v.nu!, v.phi!), digits: 2 },
    { id: 'V0', label: 'Stopping potential V0 = K_max / e', unit: 'V', fn: (v) => kmax(v.nu!, v.phi!), digits: 2 },
    { id: 'vmax', label: 'Maximum speed of photoelectrons', unit: '× 10⁵ m/s', fn: (v) => Math.sqrt((2 * kmax(v.nu!, v.phi!) * E) / ME) / 1e5, digits: 2 },
    { id: 'nu0', label: 'Threshold frequency ν0 = φ0 / h', unit: '× 10¹⁴ Hz', fn: (v) => v.phi! / HE / 1e14, digits: 2 },
    { id: 'Isat', label: 'Saturation current (1% quantum efficiency)', unit: 'µA', fn: (v) => isat(v.nu!, v.P!, v.phi!), digits: 2 },
    { id: 'i', label: 'Photocurrent at the chosen collector potential', unit: 'µA', fn: (v) => current(v.nu!, v.P!, v.phi!, v.V!), digits: 2 },
  ],
  graphs: [
    { id: 'i-v', title: 'Photocurrent against collector potential (schematic shape)', x: 'V', y: 'i' },
    { id: 'v0-nu', title: 'Stopping potential against frequency', x: 'nu', y: 'V0' },
    { id: 'isat-p', title: 'Saturation current against light power', x: 'P', y: 'Isat' },
  ],
  sceneAlt: 'A photocell: light falls on the emitter plate on the left. The photon colour follows the frequency, the number of photons follows the power, electrons leave the emitter only above the threshold frequency and their arrows lengthen with their kinetic energy, and a collector potential is marked on the right plate.',
  scene: ({ v, o }) => {
    const nm = (3e8 / (v.nu! * 1e14)) * 1e9;
    const col = colour(nm);
    const photons = Math.round(v.P! * 2);
    const emit = o.K! > 0;
    const electrons = emit ? Math.max(2, Math.min(9, Math.round(o.Isat! * 2))) : 0;
    const reach = emit && v.V! >= -o.V0!;
    const len = 15 + o.K! * 24;
    return (
      <g>
        <rect x={70} y={55} width={10} height={130} fill={emit ? '#18443b' : '#7c8595'} />
        <rect x={320} y={55} width={10} height={130} fill="#c45e42" />
        <text x={75} y={196} fontSize={10} textAnchor="middle" fill="#4d5768">emitter</text>
        <text x={325} y={48} fontSize={11} textAnchor="middle" fill="#4d5768">collector {v.V! >= 0 ? '+' : ''}{fmt(v.V!, 1)} V</text>
        {Array.from({ length: photons }, (_, i) => {
          const y = 62 + (i * 116) / Math.max(1, photons - 1);
          return <path key={i} d={`M 5 ${y - 30} q 8 -6 16 0 t 16 0 t 16 0 L 70 ${y}`} stroke={col} strokeWidth={1.6} fill="none" />;
        })}
        {Array.from({ length: electrons }, (_, i) => {
          const y = 70 + (i * 105) / Math.max(1, electrons - 1);
          const x = 84;
          return (
            <g key={i}>
              <circle cx={reach ? x + len : x + Math.min(len, 14)} cy={y} r={3.5} fill="#2563a8" />
              <path d={reach ? `M ${x} ${y} H ${x + len - 4}` : `M ${x} ${y} h ${Math.min(len, 14)}`} stroke="#2563a8" strokeWidth={1.2} fill="none" />
            </g>
          );
        })}
        <text x={200} y={205} fontSize={11} textAnchor="middle" fill="#4d5768">λ = {fmt(nm, 0)} nm · hν = {fmt(o.Eph!, 2)} eV · φ0 = {fmt(v.phi!, 1)} eV</text>
        <text x={200} y={222} fontSize={11} textAnchor="middle" fill={emit ? '#18443b' : '#b91c1c'}>{emit ? (reach ? `electrons reach the collector (i = ${fmt(o.i!, 2)} µA)` : 'V is below −V0: the electrons are turned back') : 'ν is below ν0: no electrons are emitted'}</text>
      </g>
    );
  },
  discover: [
    'Raise the frequency. Find the value at which electrons first appear: what is it called and how does it depend on the metal?',
    'Double the light power. Which readouts change and which stay the same?',
    'Make the collector potential negative until the photocurrent just reaches zero: that is the stopping potential.',
  ],
  experiment: [
    'Keep the power fixed and sweep the frequency. How does the stopping potential change? Look at the V0 against ν graph.',
    'Keep the frequency fixed and change the power. Compare the saturation current and the stopping potential.',
    'Change the metal (φ0) at a fixed frequency. How do the threshold frequency and the maximum kinetic energy change?',
  ],
  understand: [
    "Einstein's equation: one photon gives all its energy hν to one electron, so K_max = hν − φ0 = eV0.",
    'The graph of V0 against ν is a straight line with slope h/e and intercept −φ0/e, the same slope for every metal.',
    'Intensity controls how many electrons are emitted (saturation current), not how energetic they are.',
    'Below the threshold frequency ν0 = φ0/h no electrons are emitted, however intense the light.',
  ],
  preds: [
    {
      id: 'p1', title: 'Double the intensity', prompt: 'The same light (ν above threshold) is made twice as intense by doubling its power. What happens to the saturation current?',
      base: { P: 1 }, test: { P: 2 }, options: ['It doubles', 'It halves', 'It stays the same', 'It becomes four times as large'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).Isat! / outs(base).Isat!, [2, 0.5, 1, 4]),
      why: ({ base, test, outs }) => `The number of photons per second doubles, so the number of photoelectrons per second doubles. Isat goes from ${fmt(outs(base).Isat!, 2)} µA to ${fmt(outs(test).Isat!, 2)} µA.`,
    },
    {
      id: 'p2', title: 'Same light, more power: stopping potential', prompt: 'The light power is doubled again at the same frequency. What happens to the stopping potential V0?',
      base: { P: 1 }, test: { P: 2 }, options: ['It doubles', 'It halves', 'It stays the same', 'It falls to zero'], answer: 2,
      verify: ({ base, test, outs }) => (Math.abs(outs(test).V0! - outs(base).V0!) < 1e-9 ? 2 : outs(test).V0! > outs(base).V0! ? 0 : outs(test).V0! > 0 ? 1 : 3),
      why: ({ base, test, outs }) => `K_max = hν − φ0 contains no intensity. V0 stays ${fmt(outs(base).V0!, 2)} V (it is ${fmt(outs(test).V0!, 2)} V after the change); only the number of electrons grows.`,
    },
    {
      id: 'p3', title: 'Raise the frequency', prompt: 'With φ0 = 2.0 eV the frequency is raised from 8 × 10¹⁴ Hz to 12 × 10¹⁴ Hz (1.5 times). By what factor does the stopping potential change?',
      base: { nu: 8, phi: 2 }, test: { nu: 12, phi: 2 }, options: ['About 1.5 times (in proportion to ν)', 'About 2.3 times (more than in proportion)', 'It stays the same', 'It falls'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).V0! / outs(base).V0!; return r < 0.99 ? 3 : r < 1.01 ? 2 : r > 1.9 ? 1 : 0; },
      why: ({ base, test, outs }) => `V0 = (h/e)ν − φ0/e, a straight line that does not pass through the origin, so it is not proportional to ν. V0 goes from ${fmt(outs(base).V0!, 2)} V to ${fmt(outs(test).V0!, 2)} V, a rise by a factor of ${fmt(outs(test).V0! / outs(base).V0!, 2)}.`,
    },
    {
      id: 'p4', title: 'A metal with a high work function', prompt: 'Light of 8 × 10¹⁴ Hz (photon energy 3.3 eV) falls on potassium (φ0 = 2.3 eV) and then on zinc (φ0 = 4.3 eV). What happens with zinc?',
      base: { nu: 8, phi: 2.3 }, test: { nu: 8, phi: 4.3 }, options: ['The photocurrent doubles', 'No photoelectrons are emitted', 'The stopping potential rises', 'The saturation current is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => (outs(base).K! > 0 && outs(test).K! === 0 ? 1 : outs(test).Isat! > outs(base).Isat! ? 0 : outs(test).V0! > outs(base).V0! ? 2 : 3),
      why: ({ base, test, outs }) => `Each photon carries ${fmt(outs(test).Eph!, 2)} eV, less than the 4.3 eV needed to leave zinc, so K_max would be negative: no emission at all. With potassium K_max = ${fmt(outs(base).K!, 2)} eV.`,
    },
  ],
  measure: {
    instruction: 'Keep the power and the metal fixed. Record the stopping potential for at least three frequencies, all above the threshold frequency of the metal (see ν0 in the readouts).',
    vary: 'nu',
    record: ['Eph', 'V0', 'Isat'],
    fit: {
      xLabel: 'ν (× 10¹⁴ Hz)',
      yLabel: 'V0 (V)',
      x: (v) => v.nu!,
      y: (_v, o) => o.V0!,
      interpret: (slope, intercept) => `V0 against ν is a straight line (above threshold). Its slope is h/e = ${fmt(slope * 1e-14, 2, true)} V s, so h = slope × e ≈ ${fmt(slope * 1e-14 * E, 2, true)} J s (accepted 6.63 × 10^-34). The V0 intercept ${fmt(intercept, 2)} V gives φ0 = ${fmt(-intercept, 2)} eV, and the ν-intercept gives ν0 = ${fmt(-intercept / slope, 2)} × 10¹⁴ Hz.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'Light of wavelength 300 nm falls on a metal of work function 2.8 eV. Using hc = 1240 eV nm, the maximum kinetic energy of the photoelectrons is about', options: ['0.53 eV', '1.33 eV', '2.80 eV', '4.13 eV'], answer: 1,
      why: 'Photon energy = 1240/300 = 4.13 eV. K_max = hν − φ0 = 4.13 − 2.80 = 1.33 eV.',
      verify: () => near(1240 / 300 - 2.8, [0.53, 1.33, 2.8, 4.13]),
    },
    {
      id: 'q2', q: 'The work function of a metal is 2.0 eV. The longest wavelength of light that can eject photoelectrons from it is', options: ['310 nm', '500 nm', '1240 nm', '620 nm'], answer: 3,
      why: 'λ0 = hc/φ0 = 1240 eV nm / 2.0 eV = 620 nm. Longer wavelengths have less energy than φ0.',
      verify: () => near(1240 / 2.0, [310, 500, 1240, 620]),
    },
    {
      id: 'q3', q: 'A monochromatic source of wavelength 600 nm emits 5.0 mW of light. The number of photons it emits per second is about (h = 6.63 × 10⁻³⁴ J s, c = 3 × 10⁸ m/s)', options: ['1.5 × 10¹⁶', '1.5 × 10¹³', '3.0 × 10¹⁶', '7.5 × 10¹⁵'], answer: 0,
      why: 'Photon energy = hc/λ = 6.63 × 10⁻³⁴ × 3 × 10⁸ / 600 × 10⁻⁹ = 3.3 × 10⁻¹⁹ J. N = P/(hν) = 5.0 × 10⁻³ / 3.3 × 10⁻¹⁹ ≈ 1.5 × 10¹⁶ per second.',
      verify: () => near(5e-3 / ((H * 3e8) / 600e-9), [1.5e16, 1.5e13, 3e16, 7.5e15]),
    },
    {
      id: 'q4', q: 'For a metal, light of frequency 2ν0 gives photoelectrons of maximum kinetic energy K1, and light of frequency 4ν0 gives K2. The ratio K2 / K1 is', options: ['2', '4', '3', '1.5'], answer: 2,
      why: 'φ0 = hν0. K1 = h(2ν0) − hν0 = hν0 and K2 = h(4ν0) − hν0 = 3hν0, so K2/K1 = 3.',
      verify: () => near((4 - 1) / (2 - 1), [2, 4, 3, 1.5]),
    },
    {
      id: 'q5', q: "In a photoelectric experiment the stopping potential is 0.50 V for light of frequency 6.0 × 10¹⁴ Hz and 1.50 V for 8.4 × 10¹⁴ Hz. The value of Planck's constant obtained is about", options: ['2.5 × 10⁻³⁴ J s', '6.7 × 10⁻³⁴ J s', '1.2 × 10⁻³³ J s', '4.2 × 10⁻¹⁵ J s'], answer: 1,
      why: 'The slope of V0 against ν is h/e = (1.50 − 0.50)/(8.4 × 10¹⁴ − 6.0 × 10¹⁴) = 4.17 × 10⁻¹⁵ V s. So h = 4.17 × 10⁻¹⁵ × 1.6 × 10⁻¹⁹ = 6.7 × 10⁻³⁴ J s.',
      verify: () => near(((1.5 - 0.5) / 2.4e14) * E, [2.5e-34, 6.7e-34, 1.2e-33, 4.2e-15]),
    },
  ],
};
