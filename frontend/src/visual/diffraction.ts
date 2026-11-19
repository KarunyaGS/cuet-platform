/**
 * Single-slit diffraction physics and teaching data for the Diffraction Lab (Physics 322, "Diffraction due to a single slit").
 * Plain data and pure functions, no React.
 *
 * Two models are used and they agree where they should:
 *  - Fraunhofer (far field, or a lens with the screen in its focal plane):  I(θ) = I0 (sin β / β)²,  β = π a sin θ / λ
 *  - Fresnel (any distance, paraxial): the slit's amplitude is the difference of two Fresnel integrals.
 *    For small Fresnel number F = a² / (λ D) it reduces to the Fraunhofer pattern; for F of 1 or more it is the near-field pattern.
 * Status: Draft - unverified (no subject-expert review yet).
 */
export interface DiffState {
  /** slit width in micrometres */
  a: number;
  /** wavelength in nanometres */
  lambda: number;
  /** slit-to-screen distance in metres (used when lens is false) */
  D: number;
  /** observe with a converging lens placed after the slit, screen in its focal plane */
  lens: boolean;
  /** focal length in metres (used when lens is true) */
  f: number;
}

export const LIMITS = {
  /** slit-width slider position 0..100 maps to 5 µm .. 2000 µm on a log scale */
  aPos: { min: 0, max: 100, step: 1 },
  lambda: { min: 400, max: 700, step: 10 },
  D: { min: 0.3, max: 3, step: 0.1 },
  f: { min: 0.2, max: 1, step: 0.05 },
};

/** Round to two significant figures, so the slit width reads as a clean number. */
export const sig2 = (x: number) => Number(x.toPrecision(2));
export const slitFromPos = (pos: number) => sig2(5 * Math.pow(400, pos / 100));
export const posFromSlit = (a: number) => Math.round((100 * Math.log(a / 5)) / Math.log(400));

// ---------------------------------------------------------------- Fresnel integrals
// C(x) = ∫0^x cos(πt²/2) dt, S(x) = ∫0^x sin(πt²/2) dt. Tabulated once, interpolated, and asymptotic beyond the table.
const H = 0.005;
const XMAX = 25;
let TABLE: { C: Float64Array; S: Float64Array } | null = null;

function table() {
  if (TABLE) return TABLE;
  const n = Math.round(XMAX / H);
  const C = new Float64Array(n + 1);
  const S = new Float64Array(n + 1);
  const fc = (t: number) => Math.cos((Math.PI * t * t) / 2);
  const fs = (t: number) => Math.sin((Math.PI * t * t) / 2);
  for (let i = 0; i < n; i++) {
    const t = i * H;
    C[i + 1] = C[i]! + (H / 6) * (fc(t) + 4 * fc(t + H / 2) + fc(t + H));
    S[i + 1] = S[i]! + (H / 6) * (fs(t) + 4 * fs(t + H / 2) + fs(t + H));
  }
  TABLE = { C, S };
  return TABLE;
}

export function fresnelCS(x: number): { C: number; S: number } {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax >= XMAX) {
    const p = (Math.PI * ax * ax) / 2;
    return { C: sign * (0.5 + Math.sin(p) / (Math.PI * ax)), S: sign * (0.5 - Math.cos(p) / (Math.PI * ax)) };
  }
  const { C, S } = table();
  const u = ax / H;
  const i = Math.floor(u);
  const w = u - i;
  return { C: sign * (C[i]! * (1 - w) + C[i + 1]! * w), S: sign * (S[i]! * (1 - w) + S[i + 1]! * w) };
}

// ---------------------------------------------------------------- patterns
const um = 1e-6;
const nm = 1e-9;

/** Distance from slit (or lens) to the screen actually in use, in metres. */
export const screenDistance = (s: DiffState) => (s.lens ? s.f : s.D);

/** Fresnel number a² / (λ D). Far field when much less than 1; near field when 1 or more. */
export function fresnelNumber(s: DiffState): number {
  const a = s.a * um;
  return (a * a) / (s.lambda * nm * screenDistance(s));
}
export type Regime = 'far' | 'between' | 'near';
export function regime(s: DiffState): Regime {
  if (s.lens) return 'far';
  const F = fresnelNumber(s);
  return F < 0.05 ? 'far' : F < 1 ? 'between' : 'near';
}
export const regimeLabel = (r: Regime) => (r === 'far' ? 'Far field (Fraunhofer)' : r === 'between' ? 'In between' : 'Near field (Fresnel)');

/** Fresnel distance a² / λ in metres. */
export const fresnelDistance = (s: DiffState) => (s.a * um) ** 2 / (s.lambda * nm);

/** (sin β / β)², with the limit 1 at β = 0. */
export const sinc2 = (b: number) => (Math.abs(b) < 1e-9 ? 1 : (Math.sin(b) / b) ** 2);

/** Fraunhofer intensity at height y (m) on the screen, relative to the central peak (= 1). */
export function farField(s: DiffState, y: number): number {
  const d = screenDistance(s);
  const sinT = y / Math.hypot(y, d);
  return sinc2((Math.PI * s.a * um * sinT) / (s.lambda * nm));
}

/** Fresnel intensity at height y (m), relative to the open beam (no slit = 1). Valid for any distance in the paraxial regime. */
export function fresnelField(s: DiffState, y: number): number {
  const a = s.a * um;
  const k = Math.sqrt(2 / (s.lambda * nm * screenDistance(s)));
  const v1 = (-a / 2 - y) * k;
  const v2 = (a / 2 - y) * k;
  const p = fresnelCS(v1);
  const q = fresnelCS(v2);
  return 0.5 * ((q.C - p.C) ** 2 + (q.S - p.S) ** 2);
}

/** Half-width of the screen window to draw, in metres. */
export function windowHalf(s: DiffState): number {
  const a = s.a * um;
  return Math.max((4.6 * s.lambda * nm * screenDistance(s)) / a, 1.9 * a);
}

export interface Curve {
  y: number[];
  /** intensity normalised so the maximum of the drawn curve is 1 */
  i: number[];
  /** intensity of the Fraunhofer formula on the same scale as `i` (for the dashed overlay), or null */
  far: number[] | null;
  /** brightest point of the pattern relative to the open beam (no slit = 1) */
  peak: number;
  half: number;
}

export function curve(s: DiffState, n = 401): Curve {
  const half = windowHalf(s);
  const y: number[] = [];
  const raw: number[] = [];
  for (let k = 0; k < n; k++) {
    const yy = -half + (2 * half * k) / (n - 1);
    y.push(yy);
    raw.push(s.lens ? farField(s, yy) * fresnelNumberPeak(s) : fresnelField(s, yy));
  }
  const peak = Math.max(...raw);
  const i = raw.map((v) => v / peak);
  let far: number[] | null = null;
  if (!s.lens) {
    const F = fresnelNumber(s);
    far = y.map((yy) => (farField(s, yy) * F) / peak);
  }
  return { y, i, far, peak, half };
}

/** Peak brightness of a Fraunhofer pattern relative to the open beam: a² / (λ f), valid for a² ≪ λ f. */
const fresnelNumberPeak = (s: DiffState) => fresnelNumber(s);

/** Position of the n-th minimum on the screen (m), from a sin θ = n λ, or null if it cannot exist (n λ > a). */
export function minimumPosition(s: DiffState, n: number): number | null {
  const sinT = (n * s.lambda * nm) / (s.a * um);
  if (sinT >= 1) return null;
  return screenDistance(s) * Math.tan(Math.asin(sinT));
}

/** Largest n for which a sin θ = n λ has a solution with θ < 90°. */
export function maxOrder(s: DiffState): number {
  const r = (s.a * um) / (s.lambda * nm);
  return Math.ceil(r) - 1;
}

/** Linear width of the central maximum in metres: the textbook formula 2 λ D / a (small angle). */
export const widthFormula = (s: DiffState) => (2 * s.lambda * nm * screenDistance(s)) / (s.a * um);

/** The same width from the exact first-minimum positions, or null if there is no first minimum or the pattern is near-field. */
export function widthMeasured(s: DiffState): number | null {
  if (regime(s) === 'near') return null;
  const y1 = minimumPosition(s, 1);
  return y1 === null ? null : 2 * y1;
}

/** Angular width of the central maximum in radians (small angle): 2 λ / a. */
export const angularWidth = (s: DiffState) => (2 * s.lambda * nm) / (s.a * um);

/** Relative intensity at probe height y (m), normalised like `curve().i`. */
export function intensityAt(s: DiffState, y: number, peak: number): number {
  return (s.lens ? farField(s, y) * fresnelNumberPeak(s) : fresnelField(s, y)) / peak;
}

/** a sin θ / λ at height y: this equals n at the n-th minimum. */
export function pathOrder(s: DiffState, y: number): number {
  const sinT = y / Math.hypot(y, screenDistance(s));
  return (s.a * um * sinT) / (s.lambda * nm);
}

/** Approximate sRGB colour of light of the given wavelength (nm). */
export function wavelengthRgb(l: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = (440 - l) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = (510 - l) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = (645 - l) / 65; }
  else { r = 1; }
  const f = l < 420 ? 0.3 + (0.7 * (l - 400)) / 20 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
  const c = (x: number) => Math.round(255 * Math.pow(Math.max(0, x * f), 0.8));
  return [c(r), c(g), c(b)];
}

// ---------------------------------------------------------------- teaching data
export const START: DiffState = { a: 100, lambda: 550, D: 2, lens: false, f: 0.5 };

export interface Predict {
  id: string;
  title: string;
  prompt: string;
  base: DiffState;
  test: DiffState;
  options: string[];
  answer: number;
  /** builds the explanation from the real numbers of the base and test patterns */
  why: (b: { base: DiffState; test: DiffState }) => string;
}
const mm = (m: number) => `${(m * 1000).toFixed(m * 1000 < 10 ? 2 : 1)} mm`;

export const PREDICTS: Predict[] = [
  {
    id: 'p1',
    title: 'Narrower slit',
    prompt: 'The slit is 100 µm wide. Make it half as wide (50 µm), keeping everything else the same. What happens to the central bright band?',
    base: { ...START, a: 100 },
    test: { ...START, a: 50 },
    options: ['It becomes twice as wide', 'It becomes half as wide', 'It stays the same width', 'It disappears'],
    answer: 0,
    why: ({ base, test }) =>
      `The width of the central maximum is 2λD/a, so it is inversely proportional to a. At 100 µm it is ${mm(widthFormula(base))}; at 50 µm it is ${mm(widthFormula(test))}. A narrower slit spreads the light more, so the band is wider (and dimmer).`,
  },
  {
    id: 'p2',
    title: 'Red to blue',
    prompt: 'Change the light from red (700 nm) to blue (450 nm), keeping the slit and screen the same. What happens to the central band?',
    base: { ...START, a: 100, lambda: 700 },
    test: { ...START, a: 100, lambda: 450 },
    options: ['It becomes wider', 'It becomes narrower', 'It stays the same width', 'It moves sideways'],
    answer: 1,
    why: ({ base, test }) =>
      `Width is proportional to λ. For red it is ${mm(widthFormula(base))}, and for blue it is ${mm(widthFormula(test))}, about ${(test.lambda / base.lambda).toFixed(2)} times as wide. This is why white light gives a pattern with coloured edges: red spreads the most.`,
  },
  {
    id: 'p3',
    title: 'Screen twice as far',
    prompt: 'Move the screen from 1.0 m to 2.0 m. What happens to the central band?',
    base: { ...START, a: 100, D: 1 },
    test: { ...START, a: 100, D: 2 },
    options: ['It stays the same', 'It becomes half as wide', 'It becomes twice as wide', 'It becomes four times as wide'],
    answer: 2,
    why: ({ base, test }) =>
      `The light leaves the slit at a fixed angle, so the band grows in proportion to distance: 2λD/a. At 1.0 m the width is ${mm(widthFormula(base))}; at 2.0 m it is ${mm(widthFormula(test))}. The angular width 2λ/a does not change.`,
  },
  {
    id: 'p4',
    title: 'Screen very close',
    prompt: 'Now make the slit wide (1 mm) and bring the screen very close (0.3 m). Does the formula 2λD/a still describe the pattern?',
    base: { ...START, a: 1000, D: 2 },
    test: { ...START, a: 1000, D: 0.3 },
    options: ['Yes, it always works', 'No: the screen is in the near field and the pattern is just the shadow of the slit with fringes at its edges', 'No: the pattern disappears completely', 'Yes, but the band is dimmer'],
    answer: 1,
    why: ({ test }) =>
      `The Fresnel number a²/(λD) is ${fresnelNumber(test).toFixed(1)}, much greater than 1, so this is the near field. The formula would give ${mm(widthFormula(test))}, far smaller than the slit itself, which is meaningless. What you see is the geometrical shadow (about the slit's width) with weak fringes at its edges. The formula 2λD/a needs a far-field screen, a²/(λD) ≪ 1, or a lens.`,
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'a1',
    q: 'Light of wavelength 500 nm falls on a slit of width 0.20 mm. The central maximum on a screen 1.6 m away has a width of',
    options: ['4 mm', '8 mm', '16 mm', '2 mm'],
    answer: 1,
    why: 'Width = 2λD/a = (2 × 5.0 × 10⁻⁷ × 1.6)/(2.0 × 10⁻⁴) = 8.0 × 10⁻³ m = 8 mm.',
  },
  {
    id: 'a2',
    q: 'A lens of focal length 0.50 m is placed after a slit of width 0.10 mm, lit by light of wavelength 600 nm. In the focal plane the central maximum is',
    options: ['3 mm wide', '12 mm wide', '1.2 mm wide', '6 mm wide'],
    answer: 3,
    why: 'With a lens, D is replaced by f. Width = 2λf/a = (2 × 6.0 × 10⁻⁷ × 0.50)/(1.0 × 10⁻⁴) = 6.0 × 10⁻³ m = 6 mm.',
  },
  {
    id: 'a3',
    q: 'A slit of width 4.5 λ is used. The total number of dark minima that can appear on the screen is',
    options: ['8', '9', '4', '5'],
    answer: 0,
    why: 'A minimum needs a sin θ = nλ with sin θ below 1, so n must be less than a/λ = 4.5. That gives n = 1, 2, 3, 4 on each side, so 8 minima in all.',
  },
  {
    id: 'a4',
    q: 'Red light (700 nm) is replaced by blue light (450 nm) in a single-slit experiment, everything else unchanged. The width of the central maximum becomes about',
    options: ['156 % of its value', '100 % of its value', '64 % of its value', '43 % of its value'],
    answer: 2,
    why: 'Width is proportional to λ. The ratio is 450/700 = 0.64, so the central maximum shrinks to about 64 % of its red value.',
  },
  {
    id: 'a5',
    q: 'Ray optics describes a beam of width 2.0 mm and wavelength 500 nm well only up to a distance of about',
    options: ['4 m', '8 m', '1 m', '0.25 m'],
    answer: 1,
    why: 'Ray optics holds for distances much less than the Fresnel distance a²/λ = (2.0 × 10⁻³)²/(5.0 × 10⁻⁷) = 8 m. Beyond this the beam spreads noticeably by diffraction.',
  },
];
