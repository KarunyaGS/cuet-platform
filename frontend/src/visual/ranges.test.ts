import { describe, expect, it } from 'vitest';
import { clampTo, digitsFor, rangeLimits, REACH, stepFor, validateRange } from './ranges';

const design = { min: 5, max: 15 };

describe('custom ranges', () => {
  it('accepts a wider and a narrower range', () => {
    expect(validateRange({ min: 1, max: 100 }, design)).toBeNull();
    expect(validateRange({ min: 8, max: 9 }, design)).toBeNull();
  });
  it('rejects empty, reversed, equal and non-numeric ranges', () => {
    expect(validateRange({ min: NaN, max: 9 }, design)).not.toBeNull();
    expect(validateRange({ min: 9, max: 9 }, design)).not.toBeNull();
    expect(validateRange({ min: 10, max: 2 }, design)).not.toBeNull();
    expect(validateRange({ min: 1, max: Infinity }, design)).not.toBeNull();
  });
  it('keeps always-positive controls above zero', () => {
    expect(validateRange({ min: 0, max: 10 }, design)).not.toBeNull();
    expect(validateRange({ min: -3, max: 10 }, design)).not.toBeNull();
    expect(validateRange({ min: 0.01, max: 10 }, design)).toBeNull();
  });
  it('limits how far past the design range a student can go', () => {
    expect(rangeLimits(design)).toEqual({ min: 5 / REACH, max: 15 * REACH });
    expect(validateRange({ min: 5, max: 15 * REACH + 1 }, design)).not.toBeNull();
    expect(validateRange({ min: 5 / REACH - 1e-6, max: 10 }, design)).not.toBeNull();
  });
  it('allows a range that crosses zero only when the design range does', () => {
    const signed = { min: -10, max: 10 };
    expect(validateRange({ min: -50, max: 50 }, signed)).toBeNull();
    expect(validateRange({ min: -1e6, max: 5 }, signed)).not.toBeNull();
  });
  it('log controls need a positive range; a floor and a cap are honoured', () => {
    expect(validateRange({ min: 0, max: 5 }, { min: 1, max: 100 }, { log: true })).not.toBeNull();
    expect(validateRange({ min: 1, max: 5 }, { min: 1, max: 3 }, { floor: 1 })).toBeNull();
    expect(validateRange({ min: 0.5, max: 5 }, { min: 1, max: 3 }, { floor: 1 })).not.toBeNull();
    expect(validateRange({ min: 1, max: 5000 }, { min: 1, max: 3 }, { cap: 100 })).not.toBeNull();
  });
  it('clamps a value into a range', () => {
    expect(clampTo(50, { min: 1, max: 10 })).toBe(10);
    expect(clampTo(-5, { min: 1, max: 10 })).toBe(1);
    expect(clampTo(4, { min: 1, max: 10 })).toBe(4);
  });
  it('picks a usable slider step for any range', () => {
    expect(stepFor(1, { min: 5, max: 15 })).toBe(1);
    expect(stepFor(1, { min: 0, max: 1e6 })).toBeGreaterThan(100);
    expect(stepFor(1, { min: 0, max: 1 })).toBeLessThanOrEqual(0.1);
    for (const r of [{ min: 0.001, max: 0.002 }, { min: 1, max: 5000 }, { min: -300, max: 300 }]) {
      const n = (r.max - r.min) / stepFor(1, r);
      expect(n).toBeGreaterThanOrEqual(9.99);
      expect(n).toBeLessThanOrEqual(1000.1);
    }
  });
  it('shows enough decimals for the step', () => {
    expect(digitsFor(1, 0)).toBe(0);
    expect(digitsFor(0.01, 0)).toBe(2);
    expect(digitsFor(0.5, 2)).toBe(2);
  });
});
