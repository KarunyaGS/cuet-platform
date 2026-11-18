import { describe, expect, it } from 'vitest';
import { parseNumericAnswer } from './numeric';

describe('numerical answer input', () => {
  it('reads plain, decimal, negative and scientific numbers', () => {
    expect(parseNumericAnswer('12')).toBe(12);
    expect(parseNumericAnswer(' 3.5 ')).toBe(3.5);
    expect(parseNumericAnswer('-0.25')).toBe(-0.25);
    expect(parseNumericAnswer('+7')).toBe(7);
    expect(parseNumericAnswer('.5')).toBe(0.5);
    expect(parseNumericAnswer('2e-3')).toBeCloseTo(0.002);
    expect(parseNumericAnswer('1.5E3')).toBe(1500);
  });
  it('accepts a decimal comma and the typographic minus sign', () => {
    expect(parseNumericAnswer('2,5')).toBe(2.5);
    expect(parseNumericAnswer('−3')).toBe(-3);
  });
  it('refuses anything that is not one number', () => {
    for (const bad of ['', ' ', 'abc', '12abc', '1 2', '--3', '1e', '3/4', 'Infinity', 'NaN', '1.2.3', '0x10']) expect(parseNumericAnswer(bad), bad).toBeNull();
  });
});
