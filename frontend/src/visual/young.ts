/**
 * Young's double-slit physics for the 3D Practical Lab (Physics 322: "Coherent sources and interference of light,
 * Young's double slit experiment and expression for fringe width"). Plain functions, no rendering code: the 3D scene only
 * draws numbers that these functions return, and the tests check them on their own.
 *
 * Two models, both exact within their stated assumptions:
 *  1. Screen pattern (the real apparatus, real numbers): two narrow slits of width a, centres d apart, light of wavelength λ,
 *     screen D away. The path difference at height y is computed exactly, Δ = r₁ − r₂, and the intensity is
 *     I = cos²(πΔ/λ) × sinc²(π a sin θ / λ)   (two-slit interference under a single-slit envelope).
 *  2. Wave field (a magnified teaching model): two coherent line sources emit cylindrical waves ψ = e^{ikr}/√r in the
 *     plane of the bench. The model keeps d/λ small enough that the waves can be seen; its scale is NOT the real apparatus,
 *     but changing λ or d changes the model in exactly the proportion it changes the real pattern.
 * Status: Draft - unverified (no subject-expert review yet).
 */
export interface YoungState {
  /** wavelength in nanometres */
  lambda: number;
  /** slit separation in millimetres */
  d: number;
  /** slit-to-screen distance in metres */
  D: number;
  /** width of each slit in micrometres */
  a: number;
  /** each slit can be covered separately */
  slit1: boolean;
  slit2: boolean;
}

export const LIMITS = {
  lambda: { min: 400, max: 700, step: 10 },
  d: { min: 0.2, max: 1, step: 0.05 },
  D: { min: 0.5, max: 3, step: 0.1 },
};
export const START: YoungState = { lambda: 550, d: 0.5, D: 2, a: 50, slit1: true, slit2: true };

const nm = 1e-9;
const mmU = 1e-3;
const um = 1e-6;

/** Fringe width β = λD/d in metres. */
export const fringeWidth = (s: YoungState) => (s.lambda * nm * s.D) / (s.d * mmU);
/** Angular fringe width λ/d in radians. */
export const angularFringeWidth = (s: YoungState) => (s.lambda * nm) / (s.d * mmU);
/** Position of the n-th bright fringe (small angle): nβ. */
export const brightPosition = (s: YoungState, n: number) => n * fringeWidth(s);
/** Position of the n-th dark fringe counted from the centre, n = 1, 2, 3 ...: (n − ½)β. */
export const darkPosition = (s: YoungState, n: number) => (n - 0.5) * fringeWidth(s);

/** Exact path difference r₁ − r₂ in metres for a screen point at height y (m); slit 1 at −d/2, slit 2 at +d/2. */
export function pathDifference(s: YoungState, y: number): number {
  const d = s.d * mmU;
  return Math.hypot(s.D, y + d / 2) - Math.hypot(s.D, y - d / 2);
}
/** Path difference in wavelengths. A whole number gives a bright fringe, a half-integer a dark fringe. */
export const pathOrder = (s: YoungState, y: number) => pathDifference(s, y) / (s.lambda * nm);

const sinc2 = (b: number) => (Math.abs(b) < 1e-9 ? 1 : (Math.sin(b) / b) ** 2);

/** Envelope of one slit of width a at screen height y, 1 on the axis. */
export function envelope(s: YoungState, y: number): number {
  const sinT = y / Math.hypot(s.D, y);
  return sinc2((Math.PI * s.a * um * sinT) / (s.lambda * nm));
}

/**
 * Relative intensity at screen height y (m). The brightest point of the ordinary two-slit pattern is 1.
 * With one slit covered there is a single beam of a quarter of that peak brightness and no fringes.
 */
export function intensity(s: YoungState, y: number): number {
  if (!s.slit1 && !s.slit2) return 0;
  const env = envelope(s, y);
  if (s.slit1 && s.slit2) return env * Math.cos((Math.PI * pathDifference(s, y)) / (s.lambda * nm)) ** 2;
  return env * 0.25;
}

/** Half-width of the screen window in metres: either the fringes (about 17 of them) or the whole single-slit envelope. */
export function windowHalf(s: YoungState, wide: boolean): number {
  return wide ? (1.6 * s.lambda * nm * s.D) / (s.a * um) : 8.5 * fringeWidth(s);
}

/** Sample the pattern over the window into n points (used to fill the screen texture and the graph). */
export function samplePattern(s: YoungState, half: number, n: number): { y: Float64Array; i: Float64Array } {
  const y = new Float64Array(n);
  const i = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    y[k] = -half + (2 * half * k) / (n - 1);
    i[k] = intensity(s, y[k]!);
  }
  return { y, i };
}

/** Nearest bright-fringe order to height y, from the exact path difference. */
export const nearestOrder = (s: YoungState, y: number) => Math.round(pathOrder(s, y));
/** 'bright' when the two waves are nearly in step, 'dark' when nearly opposite, otherwise 'between'. */
export function classify(s: YoungState, y: number): 'bright' | 'dark' | 'between' {
  const c = Math.cos(Math.PI * pathOrder(s, y)) ** 2;
  return c > 0.9 ? 'bright' : c < 0.1 ? 'dark' : 'between';
}

/** Shift of the central fringe when a thin sheet (thickness t, refractive index μ) covers one slit: (μ − 1) t D / d. */
export const sheetShift = (s: YoungState, t: number, mu: number) => ((mu - 1) * t * s.D) / (s.d * mmU);

/** Fringe width when the whole apparatus is immersed in a medium of refractive index μ. */
export const fringeWidthInMedium = (s: YoungState, mu: number) => fringeWidth(s) / mu;

// ------------------------------------------------------------------ magnified wave model
export interface WaveModel {
  /** model wavelength and slit separation, in scene units */
  lambda: number;
  d: number;
  k: number;
}
/** Reference values of the teaching model: at 550 nm and 0.5 mm the model has d = 4λ. Changes scale in proportion. */
export const MODEL_LAMBDA0 = 1.5;
export const MODEL_RATIO0 = 4;
export function waveModel(s: YoungState): WaveModel {
  const lambda = (MODEL_LAMBDA0 * s.lambda) / 550;
  const d = MODEL_RATIO0 * MODEL_LAMBDA0 * (s.d / 0.5);
  return { lambda, d, k: (2 * Math.PI) / lambda };
}

/** Complex amplitude (re, im) of the two-source field at (x, z); sources at (0, ±d/2); amplitude of a cylindrical wave ∝ 1/√r. */
export function waveField(m: WaveModel, s: Pick<YoungState, 'slit1' | 'slit2'>, x: number, z: number): { re: number; im: number } {
  let re = 0;
  let im = 0;
  const add = (zs: number) => {
    const r = Math.max(Math.hypot(x, z - zs), 0.25);
    const a = 1 / Math.sqrt(r);
    re += a * Math.cos(m.k * r);
    im += a * Math.sin(m.k * r);
  };
  if (s.slit1) add(-m.d / 2);
  if (s.slit2) add(m.d / 2);
  return { re, im };
}

/** Instantaneous displacement at time t: Re(ψ e^{−iωt}). */
export const waveDisplacement = (f: { re: number; im: number }, phase: number) => f.re * Math.cos(phase) + f.im * Math.sin(phase);
/** Time-averaged intensity |ψ|² / 2. */
export const waveIntensity = (f: { re: number; im: number }) => 0.5 * (f.re * f.re + f.im * f.im);

/** Model path difference from the two sources to the point (x, z). */
export function modelPathDifference(m: WaveModel, x: number, z: number): number {
  return Math.hypot(x, z + m.d / 2) - Math.hypot(x, z - m.d / 2);
}

/** Height z (0 ≤ z ≤ zMax) on the model screen at distance x where the path difference equals `order` wavelengths, or null if there is none. */
export function modelZAtOrder(m: WaveModel, x: number, order: number, zMax: number): number | null {
  if (order === 0) return 0;
  const f = (z: number) => modelPathDifference(m, x, z) / m.lambda - order;
  let lo = 0;
  let hi = zMax;
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Largest order that can exist in the model: n < d/λ. */
export const modelMaxOrder = (m: WaveModel) => Math.ceil(m.d / m.lambda) - 1;

/** Fill a (re, im) grid for the wave texture: nx × nz samples over x ∈ [0, lx], z ∈ [−hz, hz]. Row-major, z fastest across a row. */
export function fillWaveGrid(m: WaveModel, s: Pick<YoungState, 'slit1' | 'slit2'>, nx: number, nz: number, lx: number, hz: number, out: Float32Array) {
  for (let j = 0; j < nz; j++) {
    const z = -hz + (2 * hz * j) / (nz - 1);
    for (let i = 0; i < nx; i++) {
      const x = (lx * i) / (nx - 1);
      const f = waveField(m, s, x, z);
      const o = 4 * (j * nx + i);
      out[o] = f.re;
      out[o + 1] = f.im;
      out[o + 2] = 0;
      out[o + 3] = 1;
    }
  }
}

// ------------------------------------------------------------------ colour
/** Approximate sRGB colour of light of the given wavelength (nm). */
/** True for wavelengths the eye can see; outside this the colour is shown neutral grey. */
export const isVisibleLight = (l: number) => l >= 395 && l <= 760;

export function wavelengthRgb(l: number): [number, number, number] {
  if (!isVisibleLight(l)) return [150, 150, 150];
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

// ------------------------------------------------------------------ teaching data
export interface Predict {
  id: string;
  title: string;
  prompt: string;
  base: YoungState;
  test: YoungState;
  options: string[];
  answer: number;
  why: (b: { base: YoungState; test: YoungState }) => string;
}
const mm = (m: number) => `${(m * 1000).toFixed(m * 1000 < 10 ? 2 : 1)} mm`;

export const PREDICTS: Predict[] = [
  {
    id: 'y1',
    title: 'Slits twice as far apart',
    prompt: 'The slits are 0.50 mm apart. Move them to 1.00 mm apart, keeping everything else the same. What happens to the width of the fringes?',
    base: { ...START },
    test: { ...START, d: 1 },
    options: ['They become twice as wide', 'They become half as wide', 'They stay the same', 'They disappear'],
    answer: 1,
    why: ({ base, test }) => `The fringe width is β = λD/d, so it is inversely proportional to d. At d = 0.50 mm, β = ${mm(fringeWidth(base))}; at d = 1.00 mm, β = ${mm(fringeWidth(test))}. Slits that are farther apart make finer fringes.`,
  },
  {
    id: 'y2',
    title: 'Red to blue light',
    prompt: 'Change the laser from red (700 nm) to blue (450 nm), keeping the slits and screen the same. What happens to the fringes?',
    base: { ...START, lambda: 700 },
    test: { ...START, lambda: 450 },
    options: ['They become wider', 'They become narrower', 'They stay the same width', 'They move to one side'],
    answer: 1,
    why: ({ base, test }) => `β is proportional to λ. For red β = ${mm(fringeWidth(base))}; for blue β = ${mm(fringeWidth(test))}, which is ${(test.lambda / base.lambda).toFixed(2)} times as wide. Blue light has the shorter wavelength, so its fringes are closer together.`,
  },
  {
    id: 'y3',
    title: 'Screen twice as far',
    prompt: 'Move the screen from 1.0 m to 2.0 m from the slits. What happens to the fringe width?',
    base: { ...START, D: 1 },
    test: { ...START, D: 2 },
    options: ['It stays the same', 'It halves', 'It doubles', 'It becomes four times as wide'],
    answer: 2,
    why: ({ base, test }) => `The two beams leave the slits at fixed angles, so the pattern grows in proportion to the distance: β = λD/d. At D = 1.0 m, β = ${mm(fringeWidth(base))}; at D = 2.0 m, β = ${mm(fringeWidth(test))}. The angular width λ/d does not change.`,
  },
  {
    id: 'y4',
    title: 'Cover one slit',
    prompt: 'Cover one of the two slits. What do you see on the screen?',
    base: { ...START },
    test: { ...START, slit2: false },
    options: ['The same fringes, but dimmer', 'No fringes: a single broad band, dimmer than before', 'Twice as many fringes', 'The screen goes completely dark'],
    answer: 1,
    why: ({ test }) => `Fringes need two coherent beams that overlap. With one slit covered there is nothing to interfere with, so you see only the diffraction band of a single slit (about ${mm(widthSingle(test))} wide at the first minima) and its peak brightness is a quarter of the two-slit peak: no light is "lost", the brightest fringes simply need both beams.`,
  },
];

/** Linear width of the single-slit central maximum, 2λD/a (m). */
export const widthSingle = (s: YoungState) => (2 * s.lambda * nm * s.D) / (s.a * um);

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'ya1',
    q: 'In Young’s experiment the slits are 0.50 mm apart, the screen is 1.5 m away and the wavelength is 600 nm. The fringe width is',
    options: ['0.9 mm', '1.8 mm', '3.6 mm', '0.45 mm'],
    answer: 1,
    why: 'β = λD/d = (6.0 × 10⁻⁷ × 1.5)/(5.0 × 10⁻⁴) = 1.8 × 10⁻³ m = 1.8 mm.',
  },
  {
    id: 'ya2',
    q: 'With λ = 500 nm, d = 0.25 mm and D = 1.0 m, the distance of the 10th bright fringe from the central fringe is',
    options: ['5 mm', '10 mm', '2 mm', '20 mm'],
    answer: 3,
    why: 'β = λD/d = (5.0 × 10⁻⁷ × 1.0)/(2.5 × 10⁻⁴) = 2.0 mm. The n-th bright fringe is at nβ, so the 10th is at 20 mm.',
  },
  {
    id: 'ya3',
    q: 'The fringe width in air is 2.4 mm. The whole apparatus is immersed in water of refractive index 4/3. The fringe width becomes',
    options: ['3.2 mm', '2.4 mm', '1.8 mm', '1.0 mm'],
    answer: 2,
    why: 'In a medium of index μ the wavelength becomes λ/μ, so β becomes β/μ = 2.4 mm ÷ (4/3) = 1.8 mm.',
  },
  {
    id: 'ya4',
    q: 'A point on the screen is the third dark fringe counted from the central bright fringe. The path difference of the two waves there is',
    options: ['2.5 λ', '3 λ', '3.5 λ', '1.5 λ'],
    answer: 0,
    why: 'Dark fringes need a path difference of (n − ½)λ. The first dark fringe is at λ/2 and the third at 2.5λ.',
  },
  {
    id: 'ya5',
    q: 'A thin transparent sheet of thickness 2.0 µm and refractive index 1.5 covers one slit. With d = 0.50 mm and D = 1.0 m, the central bright fringe shifts by',
    options: ['1 mm', '2 mm', '4 mm', '0.5 mm'],
    answer: 1,
    why: 'The sheet adds an optical path (μ − 1)t = 0.5 × 2.0 µm = 1.0 µm. The pattern shifts by (μ − 1)tD/d = (1.0 × 10⁻⁶ × 1.0)/(5.0 × 10⁻⁴) = 2.0 × 10⁻³ m = 2 mm.',
  },
];
