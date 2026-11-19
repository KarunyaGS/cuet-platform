/**
 * The three animated learning sequences of the Young's double-slit lab. Each step says where the camera goes, what is
 * shown, and what the student is told. The student can pause, step, replay, and grab the camera at any time.
 */
import { LX, type Mode, type Part, type WaveView } from './YoungScene';

export interface TourCtx { plateX: number; screenX: number; /** width / height of the 3D view, so the framing fits narrow phone screens too */ aspect?: number }
export type Cam = { pos: [number, number, number]; target: [number, number, number] };
export interface TourStep {
  title: string;
  text: string;
  mode: Mode;
  cam: (c: TourCtx) => Cam;
  focus?: Part;
  slits?: { slit1: boolean; slit2: boolean };
  waveView?: WaveView;
  fans?: boolean;
  geometry?: boolean;
  hotspots?: boolean;
  /** move the probe to this many fringe widths from the centre */
  probeBeta?: number;
  /** how many lines of the derivation to show */
  derive?: number;
  seconds: number;
}
export interface Tour { id: 'walk' | 'waves' | 'pattern'; title: string; blurb: string; steps: TourStep[] }

const mid = (c: TourCtx) => (c.plateX + c.screenX) / 2;
const FOV_TAN = Math.tan((45 * Math.PI) / 360);
/** Distance at which a w × h box (in scene units) fills a view of the given aspect ratio. */
export const fitDistance = (w: number, h: number, aspect: number) => Math.max(h / 2 / FOV_TAN, w / 2 / (FOV_TAN * aspect));
/** The whole bench from the laser to the screen, framed to fit the view at any distance D and on any screen shape. */
export function fullCam(c: TourCtx): Cam {
  const x0 = c.plateX - 8.5 - 1.6; // laser, with its body
  const x1 = c.screenX + 0.8; // screen frame
  const dist = fitDistance(x1 - x0 + 2.2, 7.5, c.aspect ?? 1.6) * 1.06;
  const el = 0.42;
  const tx = (x0 + x1) / 2;
  return { pos: [tx, 1.2 + dist * Math.sin(el), dist * Math.cos(el)], target: [tx, 1.2, 0] };
}
/** Looking straight down the bench, fitted the same way. */
export function topCam(c: TourCtx): Cam {
  const x0 = c.plateX - 8.5 - 1.6;
  const x1 = c.screenX + 0.8;
  const dist = fitDistance(x1 - x0 + 2.2, 7.2, c.aspect ?? 1.6) * 1.06;
  const tx = (x0 + x1) / 2;
  return { pos: [tx, dist, 0.01], target: [tx, 0, 0] };
}
const full = fullCam;
const laserCam = (c: TourCtx): Cam => ({ pos: [c.plateX - 4.5, 3.2, 5.5], target: [c.plateX - 8.5, 1.5, 0] });
const plateCam = (c: TourCtx): Cam => ({ pos: [c.plateX - 5.5, 3.2, 5.5], target: [c.plateX, 1.5, 0] });
const spreadCam = (c: TourCtx): Cam => ({ pos: [mid(c), 13, 8], target: [mid(c), 1.2, 0] });
const screenCam = (c: TourCtx): Cam => ({ pos: [c.screenX - 7.5, 2.6, 4.2], target: [c.screenX, 1.5, 0] });
const waveCam = (): Cam => ({ pos: [LX * 0.5, 19, 12], target: [LX * 0.5, 0, 0] });
const waveNear = (): Cam => ({ pos: [7, 8, 8.5], target: [6, 0, 0] });
const waveScreen = (): Cam => ({ pos: [LX - 7, 7, 9], target: [LX, 1.5, 0] });
const BOTH = { slit1: true, slit2: true };

export const DERIVATION: { tex: string; text: string }[] = [
  { tex: '\\Delta = S_2P - S_1P', text: 'Waves from the two slits travel different distances to a point P on the screen. The difference is the path difference Δ.' },
  { tex: '\\Delta \\approx \\frac{d\\,y}{D}', text: 'For a screen far away (D much larger than d and y), simple geometry gives Δ ≈ d·y/D, where y is the height of P above the centre.' },
  { tex: '\\Delta = n\\lambda \\;\\Rightarrow\\; y_n = \\frac{n\\lambda D}{d}', text: 'The waves arrive in step and add when Δ is a whole number of wavelengths. These points are the bright fringes (n = 0, ±1, ±2, …).' },
  { tex: '\\Delta = \\left(n+\\tfrac12\\right)\\lambda \\;\\Rightarrow\\; y_n = \\left(n+\\tfrac12\\right)\\frac{\\lambda D}{d}', text: 'The waves arrive opposite and cancel when Δ is an odd number of half wavelengths. These points are the dark fringes.' },
  { tex: '\\beta = y_{n+1} - y_n = \\frac{\\lambda D}{d}', text: 'Neighbouring bright fringes are one fringe width β apart. All fringes have the same width, and β ∝ λ, β ∝ D and β ∝ 1/d.' },
];

export const TOURS: Tour[] = [
  {
    id: 'walk',
    title: 'Tour 1: the apparatus',
    blurb: 'Walk along the optical bench from the laser to the screen and meet the two coherent sources.',
    steps: [
      { title: 'The whole experiment', text: 'This is Young’s double-slit experiment on an optical bench: a laser, a plate with two narrow slits, and a screen. Distances along the bench are marked in metres.', mode: 'apparatus', cam: full, seconds: 6 },
      { title: 'The laser', text: 'The laser gives monochromatic light: one wavelength, one colour, with a steady phase. That is what makes the interference pattern stable and visible.', mode: 'apparatus', cam: laserCam, focus: 'laser', seconds: 7 },
      { title: 'Two slits, two coherent sources', text: 'The same wavefront reaches both slits at the same instant, so S₁ and S₂ vibrate in step. Two sources with a constant phase difference are called coherent. (The slit separation is drawn larger than life so that you can see it.)', mode: 'apparatus', cam: plateCam, focus: 'plate', seconds: 9 },
      { title: 'Light spreads from both slits', text: 'Each narrow slit spreads the light out by diffraction, so the two beams overlap on the screen. Where they overlap, the waves add: that is superposition.', mode: 'apparatus', cam: spreadCam, fans: true, seconds: 8 },
      { title: 'The pattern on the screen', text: 'Alternating bright and dark fringes appear. The scale at the bottom is in millimetres, so you can measure the fringe width yourself. Drag across the screen to place the probe.', mode: 'apparatus', cam: screenCam, focus: 'screen', fans: true, probeBeta: 1, seconds: 8 },
    ],
  },
  {
    id: 'waves',
    title: 'Tour 2: waves and interference',
    blurb: 'Watch the waves from each slit travel out, overlap, and add or cancel.',
    steps: [
      { title: 'One source', text: 'Cover S₂: only S₁ is open. Circular waves spread out from it. Red and blue are the two directions of the wave’s displacement: crests and troughs. (This is a magnified teaching model: the wavelength and slit separation are not to scale.)', mode: 'wave', cam: waveCam, slits: { slit1: true, slit2: false }, waveView: 'waves', seconds: 8 },
      { title: 'The other source', text: 'Now only S₂ is open. The same circular waves spread out from its position. Each source alone gives a smooth pattern with no fringes.', mode: 'wave', cam: waveCam, slits: { slit1: false, slit2: true }, waveView: 'waves', seconds: 7 },
      { title: 'Both sources: superposition', text: 'With both open, the two sets of waves overlap and add. Along some lines crest meets crest and the surface rises and falls strongly; along others crest meets trough and the surface stays flat.', mode: 'wave', cam: waveNear, slits: BOTH, waveView: 'waves', seconds: 9 },
      { title: 'Constructive and destructive', text: 'Yellow points are where the path difference is a whole number of wavelengths (constructive: bright). Blue points are where it is an odd number of half wavelengths (destructive: dark). Along the middle, Δ = 0.', mode: 'wave', cam: waveCam, slits: BOTH, waveView: 'waves', hotspots: true, seconds: 9 },
      { title: 'Average brightness', text: 'Averaging over one cycle shows where the light is bright and dark. These lines fan out from the slits, each along a fixed angle: the bright ones where Δ = nλ, the dark ones where Δ = (n + ½)λ.', mode: 'wave', cam: waveCam, slits: BOTH, waveView: 'both', hotspots: true, seconds: 9 },
      { title: 'The pattern on the screen', text: 'The intensity along the far edge is the pattern a screen would show: a row of bright fringes with dark gaps. The yellow ribbon draws its height.', mode: 'wave', cam: waveScreen, slits: BOTH, waveView: 'intensity', hotspots: true, seconds: 8 },
    ],
  },
  {
    id: 'pattern',
    title: 'Tour 3: how the fringes form',
    blurb: 'Follow the two paths to a point on the screen and derive the fringe width.',
    steps: [
      { title: 'Two paths to one point', text: 'Pick a point P on the screen. Light reaches it from S₁ and from S₂ along two paths of different length. The coloured lines show them.', mode: 'apparatus', cam: spreadCam, fans: true, geometry: true, probeBeta: 1.25, derive: 1, seconds: 8 },
      { title: 'The path difference', text: 'With the screen far away, the extra distance is small and simple geometry gives Δ ≈ d·y/D.', mode: 'apparatus', cam: spreadCam, fans: true, geometry: true, probeBeta: 1.25, derive: 2, seconds: 8 },
      { title: 'A bright fringe', text: 'Move P to the first bright fringe: Δ equals one wavelength, so the waves arrive in step. Solving Δ = nλ gives the positions of all bright fringes.', mode: 'apparatus', cam: screenCam, fans: true, geometry: true, probeBeta: 1, derive: 3, seconds: 9 },
      { title: 'A dark fringe', text: 'Halfway between, Δ is half a wavelength: the waves arrive opposite and cancel, leaving a dark fringe.', mode: 'apparatus', cam: screenCam, fans: true, geometry: true, probeBeta: 0.5, derive: 4, seconds: 8 },
      { title: 'The fringe width', text: 'The distance between two neighbouring bright fringes is β = λD/d. Change the wavelength, slit separation or screen distance with the sliders and watch β follow.', mode: 'apparatus', cam: screenCam, fans: true, geometry: true, probeBeta: 2, derive: 5, seconds: 10 },
    ],
  },
];
