import { describe, expect, it } from 'vitest';
import { computeStreak, type DayActivity } from './streak';

const d = (day: string, answered = 0, lessons = 0): DayActivity => ({ day, answered, lessons });
const week = (flags: number[]) => flags.map((f, i) => d(`2026-11-${String(13 + i).padStart(2, '0')}`, f, 0));

describe('streak from real activity', () => {
  it('counts consecutive active days ending today', () => {
    expect(computeStreak(week([0, 0, 0, 5, 2, 1, 3]), '2026-11-19')).toEqual({ days: 4, capped: false });
  });
  it('does not break the streak while today has not started', () => {
    expect(computeStreak(week([0, 0, 1, 1, 1, 1, 0]), '2026-11-19')).toEqual({ days: 4, capped: false });
  });
  it('a gap ends the streak', () => {
    expect(computeStreak(week([1, 1, 1, 0, 1, 1, 1]), '2026-11-19')).toEqual({ days: 3, capped: false });
  });
  it('opening a lesson counts as activity', () => {
    expect(computeStreak([d('2026-11-18'), d('2026-11-19', 0, 2)], '2026-11-19')).toEqual({ days: 1, capped: false });
  });
  it('a full active week reads as capped', () => {
    expect(computeStreak(week([1, 1, 1, 1, 1, 1, 1]), '2026-11-19')).toEqual({ days: 7, capped: true });
  });
  it('no activity is zero, and unsorted input is handled', () => {
    expect(computeStreak(week([0, 0, 0, 0, 0, 0, 0]), '2026-11-19').days).toBe(0);
    expect(computeStreak([d('2026-11-19', 1), d('2026-11-17', 1), d('2026-11-18', 1)], '2026-11-19').days).toBe(3);
  });
});
