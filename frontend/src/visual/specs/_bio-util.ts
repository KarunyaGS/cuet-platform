/**
 * Small helpers shared by the Biology chapter labs (no lab lives here). Status: Draft - unverified.
 * `mkPred` and `mkQ` build a prediction or practice question whose keyed answer is the option nearest to the number
 * the model gives, so the key and the model can never disagree (the engine test recomputes the same thing).
 */
import { withValues } from '../engine/kit';
import type { Ctx, OutDef, Outs, PredDef, QuestionDef, Values, VarDef } from '../engine/types';

/** index of the value in `vals` nearest to x (on a log scale when everything is positive, else linear) */
export function nearest(x: number, vals: number[]): number {
  const pos = x > 0 && vals.every((v) => v > 0);
  let best = 0;
  let bd = Infinity;
  vals.forEach((v, i) => {
    const d = pos ? Math.abs(Math.log(x / v)) : Math.abs(x - v);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export const outsOf = (outs: OutDef[], v: Values): Outs => Object.fromEntries(outs.map((o) => [o.id, o.fn(v)]));

interface PredIn {
  id: string;
  title: string;
  prompt: string;
  base: Partial<Values>;
  test: Partial<Values>;
  /** the option texts, in the order shown */
  labels: string[];
  /** the number each option stands for (the answer is the nearest to the model's number) */
  vals: number[];
  /** how the model number is read from the two benches */
  f: (o: Outs) => number;
  mode?: 'ratio' | 'diff' | 'value';
  why: (c: Ctx) => string;
}
export function mkPred(vars: VarDef[], outs: OutDef[], p: PredIn): PredDef {
  const metric = (c: Ctx) => {
    const a = p.f(c.outs(c.base));
    const b = p.f(c.outs(c.test));
    return p.mode === 'diff' ? b - a : p.mode === 'value' ? b : b / a;
  };
  const ctx: Ctx = { base: withValues(vars, p.base), test: withValues(vars, p.base, p.test), outs: (v) => outsOf(outs, v) };
  const verify = (c: Ctx) => nearest(metric(c), p.vals);
  return { id: p.id, title: p.title, prompt: p.prompt, base: p.base, test: p.test, options: p.labels, answer: verify(ctx), verify, why: p.why };
}

export function mkQ(id: string, q: string, labels: string[], vals: number[], compute: () => number, why: string): QuestionDef {
  const verify = () => nearest(compute(), vals);
  return { id, q, options: labels, answer: verify(), why, verify };
}

/** SVG path through points */
export const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
