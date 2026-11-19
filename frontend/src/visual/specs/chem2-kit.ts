/** Small shared helpers for the Chemistry chapter labs (answer-key recomputation only). Not a spec. */

/** Index of the option whose number is closest (relative difference) to x. */
export const near = (x: number, opts: number[]): number => {
  let best = 0;
  let bs = Infinity;
  opts.forEach((o, i) => {
    const s = Math.abs(x - o) / (Math.abs(x) + Math.abs(o) + 1e-12);
    if (s < bs) { bs = s; best = i; }
  });
  return best;
};

/** Deterministic pseudo-random sequence in [0,1) so a drawn scene is stable between renders. */
export const rnd = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
