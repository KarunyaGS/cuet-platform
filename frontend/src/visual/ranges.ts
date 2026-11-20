/**
 * Student-chosen ranges for lab controls. Pure functions, no React: the controls and the tests both use this file.
 * A lab ships a default (design) range for every control. A student may replace it with their own, within sane limits:
 * the new range must be a real interval, must not cross zero when the design range does not (a distance of 0 or a
 * negative focal length would divide by zero or change the physics), and may reach at most REACH times beyond the
 * design range on either side.
 */
export interface Range { min: number; max: number }

/** How far past the design range a student may go (and how close to zero, for always-positive controls). */
export const REACH = 1000;

export interface RangeRules {
  /** the control moves on a log scale: both ends must be above zero */
  log?: boolean;
  /** extra lower floor (for example 1 for a refractive index) */
  floor?: number;
  /** extra upper cap */
  cap?: number;
  /** a count: both ends must be whole numbers */
  integer?: boolean;
}

/** The outer limits for a control, given its design range. */
export function rangeLimits(design: Range, rules: RangeRules = {}): Range {
  const big = Math.max(Math.abs(design.min), Math.abs(design.max));
  let lo: number;
  if (design.min > 0) lo = design.min / REACH;
  else if (design.min === 0) lo = 0;
  else lo = -big * REACH;
  let hi = design.max > 0 ? big * REACH : design.max === 0 ? 0 : -big / REACH;
  if (rules.floor !== undefined) lo = Math.max(lo, rules.floor);
  if (rules.cap !== undefined) hi = Math.min(hi, rules.cap);
  return { min: lo, max: hi };
}

/** null when the range is acceptable, otherwise one short sentence for the student. */
export function validateRange(r: Range, design: Range, rules: RangeRules = {}): string | null {
  if (!Number.isFinite(r.min) || !Number.isFinite(r.max)) return 'Enter a number in both boxes.';
  if (r.min >= r.max) return 'The smallest value must be below the largest.';
  if (rules.integer && (!Number.isInteger(r.min) || !Number.isInteger(r.max))) return 'This is a count, so use whole numbers.';
  const lim = rangeLimits(design, rules);
  if ((design.min > 0 || rules.log) && r.min <= 0) return 'This quantity must stay above zero.';
  if (design.min >= 0 && r.min < lim.min) return `The smallest value cannot go below ${trim(lim.min)}.`;
  if (r.min < lim.min) return `The smallest value cannot go below ${trim(lim.min)}.`;
  if (r.max > lim.max) return `The largest value cannot go above ${trim(lim.max)}.`;
  return null;
}

/** A readable number without floating-point noise. */
export function trim(x: number): string {
  if (!Number.isFinite(x)) return '—';
  if (x !== 0 && (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3)) return x.toExponential(2).replace(/\.?0+e/, 'e').replace('e+', 'e');
  return String(Number(x.toPrecision(6)));
}

export const clampTo = (x: number, r: Range) => Math.min(r.max, Math.max(r.min, x));

/**
 * A slider step for a range: keep the lab's own step while the range stays between 10 and 1000 steps wide,
 * otherwise move it by powers of ten so the slider is neither stuck nor jumpy.
 */
export function stepFor(designStep: number, r: Range): number {
  const span = r.max - r.min;
  let step = designStep;
  let guard = 0;
  while (span / step > 1000 && guard++ < 12) step *= 10;
  while (span / step < 10 && guard++ < 24) step /= 10;
  return Number(step.toPrecision(10));
}

/** Decimals needed to show a value moved in steps of `step` (at least the lab's own digits). */
export function digitsFor(step: number, baseDigits: number): number {
  const s = step.toString();
  const dot = s.indexOf('.');
  const need = dot < 0 ? 0 : s.length - dot - 1;
  return Math.min(8, Math.max(baseDigits, need));
}
