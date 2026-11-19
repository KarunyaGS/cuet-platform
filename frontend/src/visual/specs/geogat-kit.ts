/** Small shared helpers for the Geography and General Aptitude Test chapter labs (not a lab itself). Status: Draft - unverified. */
export const INK = '#18443b';
export const ACC = '#c45e42';
export const BLUE = '#2563a8';
export const GREY = '#4d5768';
export const GOLD = '#b8860b';
/** index of the option whose number is closest to x */
export const closest = (x: number, opts: number[]): number => opts.reduce((b, v, i) => (Math.abs(v - x) < Math.abs(opts[b]! - x) ? i : b), 0);
