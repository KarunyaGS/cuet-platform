/**
 * The student's streak, from real activity: consecutive days ending today (or yesterday, if today has not started yet) on which
 * they answered a question or opened a lesson. Only the days given are looked at, so a full week of activity reads as capped ("7+").
 */
export interface DayActivity { day: string; answered: number; lessons: number }
export function computeStreak(days: DayActivity[], today: string): { days: number; capped: boolean } {
  const list = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const active = (d: DayActivity) => d.answered > 0 || d.lessons > 0;
  let i = list.length - 1;
  if (i >= 0 && list[i]!.day === today && !active(list[i]!)) i--;
  let n = 0;
  while (i >= 0 && active(list[i]!)) {
    n++;
    i--;
  }
  return { days: n, capped: n >= list.length && list.length >= 7 };
}
