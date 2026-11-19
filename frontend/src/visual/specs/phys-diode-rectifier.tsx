/**
 * Chapter lab: Physics, Unit IX, "Application of the junction diode: the diode as a rectifier".
 * The model: ideal diodes. Half-wave: V_dc = V_m/π, ripple frequency f, PIV = V_m. Centre-tap full-wave: V_dc = 2V_m/π, ripple 2f, PIV = 2V_m.
 * With a filter capacitor C across the load R_L the output is simulated numerically: the diode charges C to the input when the input
 * exceeds the capacitor voltage, and C discharges through R_L (time constant R_L C) otherwise. Status: Draft - unverified.
 */
import { fmt } from '../engine/kit';
import type { Spec, Values } from '../engine/types';

type Sim = { avg: number; min: number; max: number; wave: { t: number; vin: number; vout: number }[] };
const cache = new Map<string, Sim>();

/** Steady-state output over one input period (after settling). t in seconds. */
function simulate(Vrms: number, full: number, C_uF: number, RL: number, f: number): Sim {
  const key = `${Vrms}|${full}|${C_uF}|${RL}|${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const Vm = Math.SQRT2 * Vrms;
  const T = 1 / f;
  const N = 400;
  const dt = T / N;
  const tau = (RL * C_uF * 1e-6) || 0;
  let vc = 0;
  let sum = 0;
  let mn = Infinity;
  let mx = -Infinity;
  const wave: Sim['wave'] = [];
  const periods = 8;
  for (let k = 0; k < periods * N; k++) {
    const t = k * dt;
    const vin = Vm * Math.sin(2 * Math.PI * f * t);
    const rect = full ? Math.abs(vin) : Math.max(vin, 0);
    if (C_uF <= 0) vc = rect;
    else if (rect >= vc) vc = rect;
    else vc *= Math.exp(-dt / tau);
    if (k >= (periods - 1) * N) {
      sum += vc;
      mn = Math.min(mn, vc);
      mx = Math.max(mx, vc);
      wave.push({ t: t - (periods - 1) * T, vin, vout: vc });
    }
  }
  const res = { avg: sum / N, min: mn, max: mx, wave };
  if (cache.size > 400) cache.clear();
  cache.set(key, res);
  return res;
}
const S = (v: Values) => simulate(v.Vrms!, v.full!, v.C!, v.RL!, v.f!);
const Vm = (v: Values) => Math.SQRT2 * v.Vrms!;
const near = (x: number, vals: number[]) => vals.reduce((b, v, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(x / vals[b]!)) ? i : b), 0);

export const spec: Spec = {
  id: 'phys-diode-rectifier',
  subject: 'Physics',
  lessonTitleStartsWith: 'Application of the junction diode',
  afterHeading: 'Filtering the rectified output',
  title: 'Rectifier and Filter Lab',
  format: 'Virtual experiment · graph exploration',
  blurb: 'Build a half-wave or centre-tap full-wave rectifier, add a filter capacitor and a load, and watch the output waveform, the mean voltage, the ripple frequency and the ripple change.',
  can: ['Switch between half-wave and full-wave and see the ripple frequency double', 'Add a capacitor and watch the ripple shrink as R_L C grows', 'Measure V_dc against V_m and recover π'],
  minutes: 12,
  vars: [
    { id: 'Vrms', label: 'Secondary voltage (rms; each half for full-wave)', unit: 'V', min: 6, max: 24, step: 1, start: 12, digits: 0 },
    { id: 'full', label: 'Rectifier type (0 = half-wave, 1 = full-wave)', unit: '', min: 0, max: 1, step: 1, start: 1, digits: 0 },
    { id: 'C', label: 'Filter capacitor C (0 = no filter)', unit: 'µF', min: 0, max: 2200, step: 10, start: 100, digits: 0 },
    { id: 'RL', label: 'Load resistance R_L', unit: 'Ω', min: 200, max: 5000, step: 100, start: 1000, digits: 0 },
    { id: 'f', label: 'Input frequency f', unit: 'Hz', min: 50, max: 200, step: 10, start: 50, digits: 0 },
  ],
  outs: [
    { id: 'Vm', label: 'Peak voltage V_m = √2 V_rms', unit: 'V', fn: (v) => Vm(v), digits: 2 },
    { id: 'Vdc0', label: 'Mean output without filter (V_m/π or 2V_m/π)', unit: 'V', fn: (v) => (Vm(v) * (v.full! ? 2 : 1)) / Math.PI, digits: 2 },
    { id: 'Vdc', label: 'Mean output V_dc with the chosen filter', unit: 'V', fn: (v) => S(v).avg, digits: 2 },
    { id: 'ripple', label: 'Peak-to-peak ripple', unit: 'V', fn: (v) => S(v).max - S(v).min, digits: 3 },
    { id: 'Idc', label: 'Mean load current I_dc = V_dc / R_L', unit: 'mA', fn: (v) => (S(v).avg / v.RL!) * 1000, digits: 2 },
    { id: 'fr', label: 'Ripple frequency', unit: 'Hz', fn: (v) => (v.full! ? 2 * v.f! : v.f!), digits: 0 },
    { id: 'PIV', label: 'Peak inverse voltage across a diode', unit: 'V', fn: (v) => (v.full! ? 2 : 1) * Vm(v), digits: 1 },
    { id: 'tau', label: 'Time constant R_L C', unit: 'ms', fn: (v) => (v.RL! * v.C!) / 1000, digits: 1 },
  ],
  graphs: [
    { id: 'vdc-c', title: 'Mean output against filter capacitance', x: 'C', y: 'Vdc' },
    { id: 'rip-c', title: 'Ripple against filter capacitance', x: 'C', y: 'ripple' },
    { id: 'vdc-v', title: 'Unfiltered mean output against secondary voltage', x: 'Vrms', y: 'Vdc0' },
  ],
  sceneAlt: 'An oscilloscope-style picture over two input cycles: the dashed grey line is the AC input and the solid line is the rectifier output. Without a filter the output is half or full sine pulses; with a capacitor it is held up between pulses and the ripple follows the capacitance and the load.',
  scene: ({ v }) => {
    const s = S(v);
    const x0 = 40;
    const w = 330;
    const y0 = 130; // zero line
    const sc = 80 / 34; // px per volt (fixed so amplitudes can be compared)
    const T = 1 / v.f!;
    const cycles = 2;
    const pt = (t: number, volts: number) => `${(x0 + (t / (cycles * T)) * w).toFixed(1)},${(y0 - volts * sc).toFixed(1)}`;
    const mk = (key: 'vin' | 'vout') => Array.from({ length: cycles }, (_, c) => s.wave.map((p) => pt(p.t + c * T, p[key])).join(' ')).join(' ');
    return (
      <g>
        <line x1={x0} y1={y0} x2={x0 + w} y2={y0} stroke="#c9ced6" />
        <line x1={x0} y1={20} x2={x0} y2={y0 + 90} stroke="#c9ced6" />
        <text x={x0 - 4} y={24} fontSize={9} textAnchor="end" fill="#4d5768">+{fmt(Vm(v), 1)} V</text>
        <polyline points={mk('vin')} fill="none" stroke="#9aa3b2" strokeWidth={1.2} strokeDasharray="4 3" />
        <polyline points={mk('vout')} fill="none" stroke="#c45e42" strokeWidth={2} />
        <line x1={x0} y1={y0 - s.avg * sc} x2={x0 + w} y2={y0 - s.avg * sc} stroke="#18443b" strokeDasharray="2 3" />
        <text x={x0 + w} y={y0 - s.avg * sc - 4} fontSize={10} textAnchor="end" fill="#18443b">V_dc = {fmt(s.avg, 2)} V</text>
        <text x={200} y={222} fontSize={11} textAnchor="middle" fill="#4d5768">{v.full ? 'full-wave' : 'half-wave'} · ripple {fmt(v.full ? 2 * v.f! : v.f!, 0)} Hz · R_L C = {fmt((v.RL! * v.C!) / 1000, 1)} ms vs period {fmt(1000 / (v.full ? 2 * v.f! : v.f!), 1)} ms</text>
      </g>
    );
  },
  discover: [
    'Set the capacitor to 0. Compare the output of the half-wave and the full-wave rectifier: how many pulses per input cycle?',
    'Add a capacitor. What happens to the output between the pulses?',
    'Change the load resistance and the capacitance. Which settings give a flat output?',
  ],
  experiment: [
    'With no filter, find V_dc for half-wave and for full-wave at the same voltage. What is their ratio?',
    'Keep the full-wave circuit and increase C step by step. How does the ripple change and why?',
    'Make the load heavier (smaller R_L). What happens to the ripple?',
  ],
  understand: [
    'An ideal half-wave rectifier gives V_dc = V_m/π with ripple frequency f; a centre-tap full-wave rectifier gives 2V_m/π with ripple 2f.',
    'The peak inverse voltage is V_m for the half-wave circuit and 2V_m for the centre-tap full-wave circuit.',
    'A filter capacitor charges to about V_m and discharges slowly through R_L; the ripple is small when R_L C is much larger than the ripple period.',
    'Larger C, larger R_L and a higher ripple frequency all reduce the ripple.',
  ],
  preds: [
    {
      id: 'p1', title: 'Half-wave to full-wave: mean output', prompt: 'With no filter, the half-wave rectifier is replaced by a full-wave one with the same secondary voltage (each half). What happens to the mean output voltage?',
      base: { full: 0, C: 0 }, test: { full: 1, C: 0 }, options: ['It doubles', 'It halves', 'It stays the same', 'It is multiplied by π'], answer: 0,
      verify: ({ base, test, outs }) => near(outs(test).Vdc! / outs(base).Vdc!, [2, 0.5, 1, Math.PI]),
      why: ({ base, test, outs }) => `V_dc = V_m/π becomes 2V_m/π. The mean goes from ${fmt(outs(base).Vdc!, 2)} V to ${fmt(outs(test).Vdc!, 2)} V.`,
    },
    {
      id: 'p2', title: 'Half-wave to full-wave: ripple frequency', prompt: 'On 50 Hz mains the rectifier is changed from half-wave to full-wave. What happens to the ripple frequency?',
      base: { full: 0, f: 50 }, test: { full: 1, f: 50 }, options: ['It halves', 'It doubles', 'It stays 50 Hz', 'It becomes four times as large'], answer: 1,
      verify: ({ base, test, outs }) => near(outs(test).fr! / outs(base).fr!, [0.5, 2, 1, 4]),
      why: ({ base, test, outs }) => `A full-wave rectifier gives one pulse per half-cycle, so the ripple is 2f. It goes from ${fmt(outs(base).fr!, 0)} Hz to ${fmt(outs(test).fr!, 0)} Hz.`,
    },
    {
      id: 'p3', title: 'Ten times the capacitance', prompt: 'A full-wave rectifier with a 100 µF filter capacitor is fitted instead with a 1000 µF capacitor (same load). What happens to the ripple?',
      base: { full: 1, C: 100 }, test: { full: 1, C: 1000 }, options: ['It rises', 'It falls to about one tenth', 'It falls to half', 'It is unchanged'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).ripple! / outs(base).ripple!; return r > 1.01 ? 0 : r > 0.9 ? 3 : r < 0.2 ? 1 : 2; },
      why: ({ base, test, outs }) => `The capacitor discharges for a time of about the ripple period, so the voltage droop is roughly proportional to 1/(R_L C). The ripple goes from ${fmt(outs(base).ripple!, 3)} V to ${fmt(outs(test).ripple!, 3)} V.`,
    },
    {
      id: 'p4', title: 'A heavier load', prompt: 'With a 470 µF filter, the load resistance is reduced from 2000 Ω to 500 Ω (a heavier load, four times the current). What happens to the ripple?',
      base: { full: 1, C: 470, RL: 2000 }, test: { full: 1, C: 470, RL: 500 }, options: ['It falls', 'It rises to about four times as large', 'It is unchanged', 'It rises to about twice as large'], answer: 1,
      verify: ({ base, test, outs }) => { const r = outs(test).ripple! / outs(base).ripple!; return r < 0.99 ? 0 : r < 1.01 ? 2 : r > 3 ? 1 : 3; },
      why: ({ base, test, outs }) => `R_L C falls by a factor of 4, so the capacitor discharges four times faster. The ripple goes from ${fmt(outs(base).ripple!, 3)} V to ${fmt(outs(test).ripple!, 3)} V.`,
    },
  ],
  measure: {
    instruction: 'Set the filter capacitor to 0 (no filter) and keep the rectifier type fixed. Record the mean output voltage for at least three different secondary voltages.',
    vary: 'Vrms',
    record: ['Vm', 'Vdc', 'Idc'],
    fit: {
      xLabel: 'V_m (V)',
      yLabel: 'V_dc (V)',
      x: (_v, o) => o.Vm!,
      y: (_v, o) => o.Vdc!,
      interpret: (slope, _i, v) => v.C! === 0
        ? `V_dc against V_m is a straight line through the origin. The slope is ${fmt(slope, 4)}, which equals ${v.full ? '2/π' : '1/π'} for an ideal ${v.full ? 'full-wave' : 'half-wave'} rectifier. So π ≈ ${fmt((v.full ? 2 : 1) / slope, 3)}.`
        : `V_dc against V_m is a straight line through the origin with slope ${fmt(slope, 4)}. With a filter capacitor (C = ${v.C} µF) the mean is close to V_m, so the slope is near 1; set C = 0 to compare with the unfiltered value ${v.full ? '2/π' : '1/π'} = ${fmt((v.full ? 2 : 1) / Math.PI, 4)}.`,
    },
  },
  questions: [
    {
      id: 'q1', q: 'A full-wave rectifier is connected to a 60 Hz supply. The ripple frequency of its output is', options: ['60 Hz', '120 Hz', '30 Hz', '240 Hz'], answer: 1,
      why: 'A full-wave rectifier gives one pulse per half-cycle, so the output frequency is 2f = 120 Hz.',
      verify: () => near(2 * 60, [60, 120, 30, 240]),
    },
    {
      id: 'q2', q: 'The secondary of a transformer gives 18 V rms to an ideal half-wave rectifier. The mean (dc) output voltage is about', options: ['11.5 V', '18.0 V', '8.10 V', '5.73 V'], answer: 2,
      why: 'V_m = √2 × 18 = 25.5 V. V_dc = V_m/π = 25.5/3.14 = 8.10 V.',
      verify: () => near((Math.SQRT2 * 18) / Math.PI, [11.5, 18, 8.1, 5.73]),
    },
    {
      id: 'q3', q: 'In a centre-tap full-wave rectifier each half of the secondary gives 15 V rms. The peak inverse voltage across a non-conducting diode is about', options: ['21.2 V', '42.4 V', '30.0 V', '13.5 V'], answer: 1,
      why: 'V_m = √2 × 15 = 21.2 V for each half. The PIV of the centre-tap circuit is 2V_m = 42.4 V.',
      verify: () => near(2 * Math.SQRT2 * 15, [21.2, 42.4, 30, 13.5]),
    },
    {
      id: 'q4', q: 'A load of 2.0 kΩ has a 100 µF capacitor connected across it as a filter. The discharge time constant R_L C is', options: ['2.0 s', '0.02 ms', '20 s', '0.2 s'], answer: 3,
      why: 'R_L C = 2000 Ω × 100 × 10⁻⁶ F = 0.2 s, much larger than the 10 ms ripple period of a 50 Hz full-wave rectifier, so the filter works well.',
      verify: () => near(2000 * 100e-6, [2, 0.00002, 20, 0.2]),
    },
    {
      id: 'q5', q: 'The mean output of an ideal full-wave rectifier is 6.37 V. The peak voltage of each half of the secondary is', options: ['10.0 V', '20.0 V', '6.37 V', '12.7 V'], answer: 0,
      why: 'V_dc = 2V_m/π, so V_m = πV_dc/2 = 3.14 × 6.37/2 = 10.0 V.',
      verify: () => near((Math.PI * 6.37) / 2, [10, 20, 6.37, 12.7]),
    },
  ],
};
