import type { VarDef, Values } from './types';

export const startValues = (vars: VarDef[]): Values => Object.fromEntries(vars.map((v) => [v.id, v.start]));
export const withValues = (vars: VarDef[], ...layers: Partial<Values>[]): Values => Object.assign(startValues(vars), ...layers);

/** Slider position (0..1000) <-> value, linear or logarithmic. */
export const toPos = (v: VarDef, x: number) => Math.round(1000 * (v.log ? (Math.log(x) - Math.log(v.min)) / (Math.log(v.max) - Math.log(v.min)) : (x - v.min) / (v.max - v.min)));
export const fromPos = (v: VarDef, p: number) => {
  const t = p / 1000;
  if (v.log) return Number(Math.exp(Math.log(v.min) + t * (Math.log(v.max) - Math.log(v.min))).toPrecision(3));
  const x = Math.round((v.min + t * (v.max - v.min)) / v.step) * v.step;
  return Number(Math.min(v.max, Math.max(v.min, x)).toFixed(10));
};

export function fmt(x: number, digits = 2, sci = false): string {
  if (!Number.isFinite(x)) return '—';
  if (sci || (x !== 0 && (Math.abs(x) >= 1e5 || Math.abs(x) < 1e-3))) {
    const [m, e] = x.toExponential(2).split('e');
    return `${m} × 10^${Number(e)}`;
  }
  return x.toFixed(digits);
}

/** The straight line y = slope x + intercept that best fits the points (least squares). */
export function linearFit(pts: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  const slope = d === 0 ? 0 : (n * sxy - sx * sy) / d;
  const intercept = (sy - slope * sx) / n;
  const my = sy / n;
  const ssTot = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const ssRes = pts.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

const show = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : String(Number(v.toPrecision(3))));

/** A small line graph: the curve of one output against one swept variable, with the current setting marked. */
/** Axis titles must fit their axis: a long title is cut with an ellipsis (the full text stays in the tooltip). */
const fitText = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

export function LineGraph({ title, xs, ys, cx, cy, xLabel, yLabel, logX, logY }: { title: string; xs: number[]; ys: number[]; cx: number; cy: number; xLabel: string; yLabel: string; logX?: boolean; logY?: boolean }) {
  const W = 360, H = 190, L = 50, R = 12, T = 14, B = 36;
  const tx = (x: number) => (logX ? Math.log(x) : x);
  const ty = (y: number) => (logY ? Math.log(y) : y);
  const pts = xs.map((x, i) => ({ x: tx(x), y: ty(ys[i]!) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return null;
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y));
  let y1 = Math.max(...pts.map((p) => p.y));
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.06;
  // quantities that cannot be negative keep a zero baseline instead of a padded axis below zero
  y0 = y0 >= 0 && !logY ? Math.max(0, y0 - pad) : y0 - pad;
  y1 += pad;
  const X = (x: number) => L + ((tx(x) - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y: number) => H - B - ((ty(y) - y0) / (y1 - y0)) * (H - T - B);
  // Only points that can be drawn; a value that is infinite or undefined splits the curve instead of breaking it.
  const runs: string[][] = [[]];
  xs.forEach((x, i) => {
    const px = X(x);
    const py = Y(ys[i]!);
    if (Number.isFinite(px) && Number.isFinite(py)) runs[runs.length - 1]!.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    else if (runs[runs.length - 1]!.length) runs.push([]);
  });
  const rawY = (t: number) => (logY ? Math.exp(t) : t);
  const rawX = (t: number) => (logX ? Math.exp(t) : t);
  return (
    <figure className="m-0" data-graph>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: ${yLabel} against ${xLabel}`}>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#fff" stroke="#e5e5e5" />
        {runs.map((run, k) => (
          <polyline key={k} points={run.join(' ')} fill="none" stroke="#c45e42" strokeWidth={2} />
        ))}
        {Number.isFinite(X(cx)) && Number.isFinite(Y(cy)) && <circle cx={X(cx)} cy={Y(cy)} r={4.5} fill="#18443b" stroke="#fff" strokeWidth={1.5} />}
        <text x={L - 4} y={T + 8} fontSize={10} textAnchor="end" fill="#4d5768">{show(rawY(y1))}</text>
        <text x={L - 4} y={H - B} fontSize={10} textAnchor="end" fill="#4d5768">{show(rawY(y0))}</text>
        <text x={L} y={H - B + 12} fontSize={10} fill="#4d5768">{show(rawX(x0))}</text>
        <text x={W - R} y={H - B + 12} fontSize={10} textAnchor="end" fill="#4d5768">{show(rawX(x1))}</text>
        <text x={(L + W - R) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="#4d5768"><title>{xLabel}</title>{fitText(xLabel, 62)}</text>
        <text x={11} y={(T + H - B) / 2} fontSize={11} fill="#4d5768" textAnchor="middle" transform={`rotate(-90 11 ${(T + H - B) / 2})`}><title>{yLabel}</title>{fitText(yLabel, 30)}</text>
      </svg>
      <figcaption className="text-center text-xs text-ink-2">{title}</figcaption>
    </figure>
  );
}

/** The scatter of recorded readings with the fitted line. */
export function FitGraph({ pts, fit, xLabel, yLabel }: { pts: { x: number; y: number }[]; fit: { slope: number; intercept: number }; xLabel: string; yLabel: string }) {
  const W = 360, H = 200, L = 50, R = 14, T = 14, B = 36;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(0, ...xs);
  const x1 = Math.max(...xs) * 1.08 || 1;
  const yLine = (x: number) => fit.slope * x + fit.intercept;
  const y0 = Math.min(0, ...ys, yLine(x0));
  let y1 = Math.max(...ys, yLine(x1)) * 1.08;
  if (y1 <= y0) y1 = y0 + 1;
  const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const Y = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={`${yLabel} against ${xLabel}: your readings and the fitted straight line`} data-fit-graph>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#fff" stroke="#e5e5e5" />
      <line x1={X(x0)} y1={Y(yLine(x0))} x2={X(x1)} y2={Y(yLine(x1))} stroke="#18443b" strokeWidth={1.4} opacity={0.7} />
      {pts.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={4} fill="#c45e42" />)}
      <text x={L - 4} y={T + 8} fontSize={10} textAnchor="end" fill="#4d5768">{show(y1)}</text>
      <text x={L - 4} y={H - B} fontSize={10} textAnchor="end" fill="#4d5768">{show(y0)}</text>
      <text x={L} y={H - B + 12} fontSize={10} fill="#4d5768">{show(x0)}</text>
      <text x={W - R} y={H - B + 12} fontSize={10} textAnchor="end" fill="#4d5768">{show(x1)}</text>
      <text x={(L + W - R) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="#4d5768"><title>{xLabel}</title>{fitText(xLabel, 62)}</text>
      <text x={11} y={(T + H - B) / 2} fontSize={11} fill="#4d5768" textAnchor="middle" transform={`rotate(-90 11 ${(T + H - B) / 2})`}><title>{yLabel}</title>{fitText(yLabel, 30)}</text>
    </svg>
  );
}
