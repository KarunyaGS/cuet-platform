/** Reads what a student typed as a number: plain, decimal or scientific (2.5, -3, 1e-3). Returns null when it is not a number. */
export function parseNumericAnswer(text: string): number | null {
  const t = text.trim().replace(/−/g, '-').replace(/,/g, '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
