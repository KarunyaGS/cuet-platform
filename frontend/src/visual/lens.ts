/**
 * Thin-lens physics and teaching data for the Lens Lab (Physics 322, "Ray optics", thin lenses).
 * Plain data and pure functions, no React: the page and the tests both read this file.
 *
 * Convention (new Cartesian, as in the lesson): distances are measured from the optical centre, positive along the
 * direction of the incident light. A real object on the left has u < 0. A convex lens has f > 0, a concave lens f < 0.
 *     1/v - 1/u = 1/f        m = h'/h = v/u
 * All of the words and numbers here are Prepora's own. Status: Draft - unverified (no subject-expert review yet).
 */
export type LensKind = 'convex' | 'concave';

export interface LensState { kind: LensKind; f: number; u: number; h: number }
export interface LensResult {
  /** Image distance in cm, or null when the object sits at the focus of a convex lens (image at infinity). */
  v: number | null;
  /** Linear magnification, or null at infinity. */
  m: number | null;
  /** Image height in cm (upward positive), or null. */
  hImage: number | null;
  real: boolean | null;
  upright: boolean | null;
  size: 'magnified' | 'diminished' | 'same size' | null;
  power: number;
}

export const LIMITS = {
  f: { min: 5, max: 15, step: 1 },
  u: { min: 4, max: 44, step: 0.5 },
  h: { min: 1, max: 4, step: 0.5 },
};

/** Signed focal length from the lens kind and the size of f. */
export const signedF = (kind: LensKind, f: number) => (kind === 'convex' ? Math.abs(f) : -Math.abs(f));

export function solveLens(s: LensState): LensResult {
  const f = signedF(s.kind, s.f);
  const u = -Math.abs(s.u);
  const power = 100 / f; // dioptre, f in cm
  if (Math.abs(u + f) < 1e-9) return { v: null, m: null, hImage: null, real: null, upright: null, size: null, power };
  const v = (u * f) / (u + f);
  const m = v / u;
  const abs = Math.abs(m);
  return {
    v,
    m,
    hImage: m * s.h,
    real: v > 0,
    upright: m > 0,
    size: Math.abs(abs - 1) < 0.02 ? 'same size' : abs > 1 ? 'magnified' : 'diminished',
    power,
  };
}

/** Bench geometry (all in cm, y up, optical centre at x = 0). The page only draws what this returns. */
export const BENCH = {
  /** Half-width of the bench: the view runs from -x to +x. */
  x: 50,
  /** Half-height of the lens, in cm. A ray that would cross the lens plane beyond this misses the lens. */
  aperture: 9.5,
};

export type RayId = 'parallel' | 'centre' | 'focal';
export interface BenchRay {
  id: RayId;
  /** Height at which the ray meets the lens plane. */
  y0: number;
  /** Slope dy/dx of the ray after the lens (light moving to the right). */
  slope: number;
}
export interface BenchGeometry {
  object: { x: number; y: number };
  /** Image tip, or null when the image is at infinity. */
  image: { x: number; y: number } | null;
  rays: BenchRay[];
  /** Rays left out because they would miss the lens. */
  hidden: RayId[];
}

export function benchGeometry(s: LensState, aperture: number = BENCH.aperture): BenchGeometry {
  const f = signedF(s.kind, s.f);
  const u = -Math.abs(s.u);
  const r = solveLens(s);
  const image = r.v === null ? null : { x: r.v, y: r.hImage! };
  const slopeFrom = (y0: number) => (image ? (image.y - y0) / image.x : s.h / u);
  const candidates: { id: RayId; y0: number | null }[] = [
    { id: 'parallel', y0: s.h },
    { id: 'centre', y0: 0 },
    // The ray aimed at the focus on the object side (convex) or the far side (concave); it leaves parallel to the axis.
    { id: 'focal', y0: Math.abs(u + f) < 1e-9 ? null : (s.h * f) / (u + f) },
  ];
  const rays: BenchRay[] = [];
  const hidden: RayId[] = [];
  for (const c of candidates) {
    if (c.y0 === null) continue; // object at the focus: this ray is the parallel ray again
    if (Math.abs(c.y0) > aperture) hidden.push(c.id);
    else rays.push({ id: c.id, y0: c.y0, slope: slopeFrom(c.y0) });
  }
  return { object: { x: u, y: s.h }, image, rays, hidden };
}

/** How much bench to show for the ranges the student chose: wide enough for the farthest object, tall enough for the tallest. */
export interface BenchView { xr: number; aperture: number }
export function viewFor(uMax: number, hMax: number): BenchView {
  return {
    xr: Math.max(BENCH.x, Math.ceil((uMax * 1.1) / 5) * 5),
    aperture: Math.max(BENCH.aperture, hMax * 1.5),
  };
}

/** A 1-2-5 ruler step that gives about nine ticks across `span`. */
export function niceStep(span: number): number {
  const raw = span / 9;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** What the student sees in words for the current setting. */
export function describe(r: LensResult): string {
  if (r.v === null) return 'No image forms: the refracted rays leave parallel, so the image is at infinity.';
  return `${r.real ? 'Real' : 'Virtual'}, ${r.upright ? 'upright' : 'inverted'}, ${r.size}`;
}

/** Lens formula in its other form: focal length from a measured pair (u, v), both signed. */
export const focalFromUV = (u: number, v: number) => (u * v) / (u - v);

export interface Reading { u: number; v: number; invU: number; invV: number; f: number }
export function reading(s: LensState): Reading | null {
  const r = solveLens(s);
  if (r.v === null) return null;
  const u = -Math.abs(s.u);
  return { u, v: r.v, invU: 1 / u, invV: 1 / r.v, f: focalFromUV(u, r.v) };
}

export interface Predict {
  id: string;
  title: string;
  setup: LensState;
  prompt: string;
  options: string[];
  answer: number;
  /** Shown after the student has seen the result. {v} and {m} are filled from the real calculation. */
  why: string;
}
const lensOf = (kind: LensKind, f: number, u: number): LensState => ({ kind, f, u, h: 2 });

export const PREDICTS: Predict[] = [
  {
    id: 'p1',
    title: 'Object at 2f',
    setup: lensOf('convex', 10, 20),
    prompt: 'A convex lens has f = 10 cm. The object is 20 cm away (that is 2f). What is the image like?',
    options: ['Real, inverted, same size', 'Real, inverted, magnified', 'Virtual, upright, magnified', 'Real, upright, diminished'],
    answer: 0,
    why: 'At u = −2f the lens formula gives v = +2f = {v} cm and m = {m}. The image is as far behind the lens as the object is in front, so it is the same size, and the minus sign in m means it is inverted.',
  },
  {
    id: 'p2',
    title: 'Object between f and 2f',
    setup: lensOf('convex', 10, 15),
    prompt: 'Now move the object to 15 cm (between f and 2f). What happens to the image compared with the last one?',
    options: ['Closer to the lens and smaller', 'Farther from the lens and bigger', 'Same place, same size', 'It turns upright'],
    answer: 1,
    why: 'As the object moves in from 2f towards f, the image moves out. Here v = {v} cm and m = {m}: farther than 2f, magnified, still real and inverted.',
  },
  {
    id: 'p3',
    title: 'Object inside f',
    setup: lensOf('convex', 10, 6),
    prompt: 'Move the object to 6 cm, which is inside the focal length. Can the image be caught on a screen?',
    options: ['Yes, a real inverted image', 'No, it is virtual, upright and magnified', 'No image forms at all', 'Yes, but it is diminished'],
    answer: 1,
    why: 'Inside f the rays leave still spreading apart, so they never meet on the right. The lens formula gives v = {v} cm (negative, same side as the object) and m = {m}: a virtual, upright, magnified image. This is a magnifying glass.',
  },
  {
    id: 'p4',
    title: 'A concave lens',
    setup: lensOf('concave', 10, 20),
    prompt: 'Switch to a concave lens (f = −10 cm) with the object at 20 cm. What is the image like?',
    options: ['Real, inverted, diminished', 'Virtual, upright, diminished', 'Virtual, upright, magnified', 'Real, upright, same size'],
    answer: 1,
    why: 'A concave lens always spreads the rays out. For any object distance the image is virtual, upright and diminished. Here v = {v} cm and m = {m}.',
  },
];

export interface Mcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice written for this lab. New items, not the existing question bank. Draft - unverified. */
export const APPLY: Mcq[] = [
  {
    id: 'a1',
    q: 'A convex lens of focal length 20 cm forms a real image at 60 cm from the lens. The object is placed at a distance of',
    options: ['15 cm', '30 cm', '40 cm', '60 cm'],
    answer: 1,
    why: '1/v − 1/u = 1/f gives 1/u = 1/60 − 1/20 = −2/60, so u = −30 cm. The object is 30 cm from the lens.',
  },
  {
    id: 'a2',
    q: 'An object is 10 cm from a concave lens of focal length 15 cm. The image is',
    options: ['6 cm from the lens, virtual, on the object side', '6 cm from the lens, real, on the far side', '30 cm from the lens, virtual', '30 cm from the lens, real'],
    answer: 0,
    why: 'With f = −15 and u = −10, v = uf/(u + f) = (−10)(−15)/(−25) = −6 cm. The negative sign means the image is on the object side, so it is virtual.',
  },
  {
    id: 'a3',
    q: 'A convex lens of focal length 10 cm forms a real image that is twice the size of the object. The object distance is',
    options: ['10 cm', '15 cm', '20 cm', '30 cm'],
    answer: 1,
    why: 'A real image is inverted, so m = −2 and v = −2u. Then 1/v − 1/u = −3/(2u) = 1/10, giving u = −15 cm.',
  },
  {
    id: 'a4',
    q: 'A convex lens forms a real image the same size as the object when the object is 24 cm away. Its focal length is',
    options: ['6 cm', '12 cm', '24 cm', '48 cm'],
    answer: 1,
    why: 'A same-size real image forms only when the object is at 2f, so 2f = 24 cm and f = 12 cm.',
  },
];
