/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Drawings for the visual learning pack, in a restrained scientific style: shaded objects with light and shadow, thin
 * labelled vectors, rulers and graphs. All are plain SVG drawn here (no pictures from anywhere else) and have no state
 * of their own, so the same drawings serve the page and the printed PDF. Positions in the falling-body scene come from
 * the physics (s = ½gt²), never from an easing curve.
 */
import type { ReactNode } from 'react';
import type { MapNode } from './gravitation';

export const INK = '#1a2233';
export const NAVY = '#1f3b73';
export const TEAL = '#0e7490';
export const SLATE = '#64748b';
export const FORCE = '#b45309';
export const BLUE = NAVY;
export const GREEN = TEAL;
export const AMBER = '#9a6b1f';
export const RED = FORCE;
const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace';

/** A small line drawing centred on (0,0), about 20 units across, for a mind-map idea or a flowchart stage. */
export function Glyph({ name, color = NAVY }: { name: MapNode['icon']; color?: string }) {
  const s = { stroke: color, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'apple':
      // a body falling: its path, an arrowhead and the ground
      return <path d="M0 -9 V5 M-4 1 L0 5 L4 1 M-7 9 H7" {...s} />;
    case 'earth':
      return (
        <g>
          <circle r={8.5} {...s} />
          <path d="M-8.5 0 H8.5 M0 -8.5 C-4.5 -4 -4.5 4 0 8.5 M0 -8.5 C4.5 -4 4.5 4 0 8.5" {...s} strokeWidth={1.1} />
        </g>
      );
    case 'law':
      return (
        <g>
          <circle cx={-6.5} r={3.4} {...s} />
          <circle cx={7.5} r={2.2} {...s} />
          <path d="M-2 0 H4 M2 -2 L4 0 L2 2 M0 -2 L-2 0 L0 2" {...s} strokeWidth={1.1} />
        </g>
      );
    case 'constant':
      return (
        <text textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} fontStyle="italic" fill={color} fontFamily="Georgia, 'Times New Roman', serif">
          G
        </text>
      );
    case 'g':
      return (
        <text textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={600} fontStyle="italic" fill={color} fontFamily="Georgia, 'Times New Roman', serif" y={-1}>
          g
        </text>
      );
    case 'up':
      return <path d="M0 8 V-8 M-4.5 -3.5 L0 -8 L4.5 -3.5 M-8 9 H8" {...s} />;
    case 'down':
      return <path d="M0 -8 V8 M-4.5 3.5 L0 8 L4.5 3.5 M-8 -9 H8" {...s} />;
    case 'moon':
      return (
        <g>
          <circle r={3} {...s} />
          <ellipse rx={9.5} ry={5.5} {...s} strokeWidth={1.1} strokeDasharray="2 2.2" />
          <circle cx={8.6} cy={-2.3} r={1.6} fill={color} />
        </g>
      );
    case 'arrows':
      return <path d="M-9 0 H-2 M-5 -3 L-2 0 L-5 3 M9 0 H2 M5 -3 L2 0 L5 3" {...s} />;
    case 'sum':
      return <path d="M6 -8 H-6 L1 0 L-6 8 H6" {...s} />;
    case 'scale':
      return <path d="M0 -8 V8 M-8 -5 H8 M-8 -5 L-10 2 H-6 Z M8 -5 L6 2 H10 Z M-4 8 H4" {...s} strokeWidth={1.2} />;
    default:
      return <circle r={2.5} fill={color} />;
  }
}

/** A vector: a thin shaft with a slim head. */
export function Arrow({ x1, y1, x2, y2, color = FORCE, width = 2.2, dashed = false }: { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; dashed?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return null;
  const h = Math.min(len, Math.max(9, width * 4.2));
  const bx = x2 - h * Math.cos(a);
  const by = y2 - h * Math.sin(a);
  const p = (t: number) => `${(bx + h * 0.36 * Math.cos(a + t)).toFixed(1)},${(by + h * 0.36 * Math.sin(a + t)).toFixed(1)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="butt" strokeDasharray={dashed ? '5 4' : undefined} />
      <polygon points={`${x2.toFixed(1)},${y2.toFixed(1)} ${p(Math.PI / 2)} ${p(-Math.PI / 2)}`} fill={color} />
    </g>
  );
}

/** Gradients and filters shared by the scenes. `id` keeps two scenes on one page from sharing definitions. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-apple`} cx="36%" cy="30%" r="78%">
        <stop offset="0" stopColor="#e0685a" />
        <stop offset="0.38" stopColor="#b3261e" />
        <stop offset="0.8" stopColor="#7c1512" />
        <stop offset="1" stopColor="#4a0c0b" />
      </radialGradient>
      <radialGradient id={`${id}-shine`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6f9a52" />
        <stop offset="1" stopColor="#2f5a2c" />
      </linearGradient>
      <linearGradient id={`${id}-bark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7b6450" />
        <stop offset="0.5" stopColor="#5a4636" />
        <stop offset="1" stopColor="#3b2d23" />
      </linearGradient>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9d8e6" />
        <stop offset="0.7" stopColor="#e9eef2" />
        <stop offset="1" stopColor="#f2efe6" />
      </linearGradient>
      <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7d9466" />
        <stop offset="1" stopColor="#4b6140" />
      </linearGradient>
      <radialGradient id={`${id}-earth`} cx="34%" cy="30%" r="80%">
        <stop offset="0" stopColor="#5f95cf" />
        <stop offset="0.45" stopColor="#2a5f9e" />
        <stop offset="1" stopColor="#0b2445" />
      </radialGradient>
      <radialGradient id={`${id}-night`} cx="68%" cy="72%" r="75%">
        <stop offset="0.35" stopColor="#020617" stopOpacity="0.72" />
        <stop offset="1" stopColor="#020617" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-steel`} cx="34%" cy="30%" r="80%">
        <stop offset="0" stopColor="#dbe4ee" />
        <stop offset="0.5" stopColor="#8496ad" />
        <stop offset="1" stopColor="#3d4b60" />
      </radialGradient>
      <filter id={`${id}-far`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id={`${id}-near`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0 H0 V24" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </pattern>
    </defs>
  );
}

/** An apple with a lit side, a shaded side and a highlight; (x, y) is its centre and r its radius. */
export function RealApple({ id, x, y, r, stem = true }: { id: string; x: number; y: number; r: number; stem?: boolean }) {
  const k = r / 20;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d="M0 -15 C-7 -21 -21 -17 -21 -2 C-21 12 -11 21 -2 20 C-1 19.6 1 19.6 2 20 C11 21 21 12 21 -2 C21 -17 7 -21 0 -15Z" fill={`url(#${id}-apple)`} />
      <path d="M-4 -15.5 C-1.5 -13 1.5 -13 4 -15.5" fill="none" stroke="#3b0a09" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      <ellipse cx={-8.5} cy={-5} rx={5} ry={7.5} fill={`url(#${id}-shine)`} transform="rotate(-18 -8.5 -5)" />
      {stem && <path d="M0 -14.5 C0.4 -19 1.6 -22 3.4 -25" fill="none" stroke="#4a3a2a" strokeWidth={2} strokeLinecap="round" />}
    </g>
  );
}

function Leaf({ id, x, y, a, s = 1, blur = false }: { id: string; x: number; y: number; a: number; s?: number; blur?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} filter={blur ? `url(#${id}-near)` : undefined} opacity={blur ? 0.8 : 1}>
      <path d="M0 0 C10 -11 30 -11 42 0 C30 11 10 11 0 0Z" fill={`url(#${id}-leaf)`} />
      <path d="M2 0 H38" stroke="#254822" strokeWidth={0.8} opacity={0.6} />
    </g>
  );
}

export const SCENE = { w: 720, h: 460, appleX: 330, topY: 104, groundY: 404, appleR: 15, rulerX: 470 };
/** Fall time from height h, and how many pixels one metre takes in the scene. */
export const fallTime = (h: number, g: number) => Math.sqrt((2 * h) / g);
export const pxPerMetre = (h: number) => (SCENE.groundY - SCENE.appleR - SCENE.topY) / h;
const LEAVES: [number, number, number, number, boolean][] = [[120, 60, -150, 1.1, true], [176, 50, -30, 1, true], [238, 40, -165, 1.15, true], [300, 34, -20, 0.95, true], [150, 82, 160, 0.95, false], [222, 66, -40, 1, false], [274, 56, 170, 0.9, false], [318, 62, -28, 0.85, false], [356, 60, 12, 0.8, false], [92, 74, -120, 1, false]];

/**
 * The falling-body scene: an apple on a branch, the ground below, a ruler in metres, and the vectors.
 * `s` is the distance fallen in metres; everything drawn follows from it and from h, m, g and v.
 */
export function FallScene({ id = 'fs', h, s, v = 0, m, g, released, vectors = true, marks = [], caption }: { id?: string; h: number; s: number; v?: number; m: number; g: number; released: boolean; vectors?: boolean; marks?: number[]; caption?: string }) {
  const { w, appleX: ax, topY, groundY, appleR: R, rulerX } = SCENE;
  const ppm = pxPerMetre(h);
  const ay = topY + s * ppm;
  const near = 1 - Math.min(1, (groundY - R - ay) / (groundY - R - topY));
  const force = m * g;
  const fLen = 26 + force * 22;
  const ticks = Array.from({ length: Math.floor(h * 2) + 1 }, (_, i) => i * 0.5);
  return (
    <svg viewBox={`0 0 ${w} ${SCENE.h}`} className="block h-auto w-full" role="img" aria-label={caption ?? `An apple ${released ? `has fallen ${s.toFixed(2)} metres from` : 'hangs from'} a branch ${h} metres above the ground. A ruler shows the distance in metres. Arrows show the gravitational force and the acceleration, both pointing down towards the earth.`} data-fall-scene>
      <Defs id={id} />
      <rect width={w} height={SCENE.h} fill={`url(#${id}-sky)`} />
      {/* far trees, out of focus */}
      <g filter={`url(#${id}-far)`} opacity={0.55}>
        <ellipse cx={120} cy={330} rx={150} ry={70} fill="#7f9a78" />
        <ellipse cx={420} cy={345} rx={190} ry={60} fill="#8ba483" />
        <ellipse cx={650} cy={335} rx={120} ry={64} fill="#7f9a78" />
      </g>
      <path d={`M0 ${groundY} H${w} V${SCENE.h} H0Z`} fill={`url(#${id}-ground)`} />
      <path d={`M0 ${groundY} H${w}`} stroke="#3f5236" strokeWidth={1} />
      {/* trunk and branch */}
      <path d={`M-10 ${SCENE.h} C10 320 6 200 24 96 L92 84 C86 200 96 320 122 ${SCENE.h}Z`} fill={`url(#${id}-bark)`} />
      <path d="M60 96 C150 70 250 60 362 74" fill="none" stroke="#5a4636" strokeWidth={15} strokeLinecap="round" />
      <path d="M210 68 C250 52 300 44 352 46" fill="none" stroke="#5a4636" strokeWidth={6} strokeLinecap="round" />
      <path d="M60 92 C150 67 250 57 362 71" fill="none" stroke="#9a8571" strokeWidth={1.2} opacity={0.6} />
      {LEAVES.map(([lx, ly, la, ls, lb], i) => (
        <Leaf key={i} id={id} x={lx} y={ly} a={la} s={ls} blur={lb} />
      ))}
      {/* the stalk stays on the branch */}
      <path d={`M${ax} 74 C${ax + 0.6} 80 ${ax + 0.2} 84 ${ax} ${topY - R + 2}`} fill="none" stroke="#4a3a2a" strokeWidth={2} strokeLinecap="round" opacity={released ? 0.55 : 1} />

      {/* ruler: distance below the branch, in metres */}
      <g fontFamily={MONO} fontSize={11} fill={INK}>
        <line x1={rulerX} y1={topY} x2={rulerX} y2={groundY - R} stroke={INK} strokeWidth={1} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={rulerX} x2={rulerX + (Number.isInteger(t) ? 9 : 5)} y1={topY + t * ppm} y2={topY + t * ppm} stroke={INK} strokeWidth={1} />
            {Number.isInteger(t) && (
              <text x={rulerX + 13} y={topY + t * ppm + 4}>
                {t} m
              </text>
            )}
          </g>
        ))}
        <text x={rulerX + 4} y={topY - 12} textAnchor="middle" fontSize={10.5} fill={SLATE}>
          distance fallen, s
        </text>
        <line x1={ax + R + 4} x2={rulerX - 3} y1={ay} y2={ay} stroke={SLATE} strokeWidth={0.8} strokeDasharray="3 3" />
      </g>

      {/* positions at equal time steps */}
      {marks.map((ms, i) => (
        <circle key={i} cx={ax} cy={topY + ms * ppm} r={R - 1} fill="none" stroke="#7c1512" strokeWidth={1} strokeDasharray="2.5 2.5" opacity={0.55} data-mark />
      ))}

      {/* shadow on the ground: sharper and darker as the apple nears it */}
      <ellipse cx={ax + 6} cy={groundY + 3} rx={R * (2 - near)} ry={3.2 + 1.2 * near} fill="#1b2a17" opacity={0.12 + 0.3 * near} filter={`url(#${id}-soft)`} />
      <g data-apple data-s={s.toFixed(4)}>
        <RealApple id={id} x={ax} y={ay} r={R} stem={false} />
      </g>

      {vectors && (
        <g fontFamily={MONO} fontSize={11.5} data-vectors>
          <g data-vector="force" data-newtons={force.toFixed(2)}>
            <Arrow x1={ax} y1={ay} x2={ax} y2={ay + fLen} color={FORCE} width={2.4} />
            <text x={ax + 12} y={ay + fLen - 4} fill={FORCE} fontWeight={600}>
              F = mg = {force.toFixed(2)} N
            </text>
          </g>
          <g data-vector="g">
            <Arrow x1={ax - 42} y1={ay - 8} x2={ax - 42} y2={ay + 40} color={NAVY} width={2} />
            <text x={ax - 50} y={ay + 20} textAnchor="end" fill={NAVY} fontWeight={600}>
              g = {g.toFixed(1)} m s⁻²
            </text>
          </g>
          {v > 0.05 && (
            <g data-vector="v">
              <Arrow x1={ax + 34} y1={ay - 26} x2={ax + 34} y2={ay - 26 + Math.min(110, v * 11)} color={TEAL} width={2} />
              <text x={ax + 42} y={ay - 16} fill={TEAL} fontWeight={600}>
                v = {v.toFixed(2)} m s⁻¹
              </text>
            </g>
          )}
        </g>
      )}
      <text x={w - 12} y={groundY + 34} textAnchor="end" fontFamily={MONO} fontSize={10.5} fill="#e7efe2">
        towards the centre of the earth ↓
      </text>
    </svg>
  );
}

/** Step 3: the earth and the apple attract each other with equal and opposite forces along the line joining them. */
export function PairScene({ id = 'ps', reveal = 3 }: { id?: string; reveal?: number }) {
  const cx = 360;
  const cy = 300;
  const r = 104;
  const fade = (n: number) => ({ opacity: reveal >= n ? 1 : 0, transition: 'opacity 0.5s' });
  return (
    <svg viewBox="0 0 720 460" className="block h-auto w-full" role="img" aria-label="The earth and an apple above it. A vector on the apple points to the earth. An equal vector at the earth's centre points to the apple. A dashed line joins the apple and the centre of the earth.">
      <Defs id={id} />
      <rect width={720} height={460} fill="#0b1220" />
      <rect width={720} height={460} fill={`url(#${id}-grid)`} color="#1c2a44" />
      <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke="#7fb2e8" strokeWidth={5} opacity={0.22} filter={`url(#${id}-soft)`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-earth)`} />
      <g opacity={0.3} fill="#b9d3a6">
        <path d={`M${cx - 62} ${cy - 46} c18 -22 50 -26 64 -12 c10 12 -8 22 -16 36 c-8 14 -30 16 -42 2 c-8 -10 -12 -18 -6 -26Z`} />
        <path d={`M${cx + 22} ${cy - 8} c20 -12 46 2 48 24 c2 20 -16 42 -34 46 c-14 2 -18 -16 -14 -30 c4 -14 -10 -30 0 -40Z`} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-night)`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9cc3ee" strokeWidth={0.8} opacity={0.6} />

      <line x1={cx} y1={86} x2={cx} y2={cy} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" style={fade(3)} />
      <g style={fade(3)}>
        <circle cx={cx} cy={cy} r={3.2} fill="#f8fafc" />
        <text x={cx + 12} y={cy + 18} fontFamily={MONO} fontSize={11.5} fill="#cbd5e1">
          centre of the earth
        </text>
        <text x={cx - 12} y={186} fontFamily={MONO} fontSize={11.5} fill="#cbd5e1" textAnchor="end">
          line joining the two bodies
        </text>
      </g>
      <RealApple id={id} x={cx} y={70} r={13} />
      <g style={fade(1)} data-force="on-apple" fontFamily={MONO} fontSize={12}>
        <Arrow x1={cx} y1={86} x2={cx} y2={150} color="#fb923c" width={2.6} />
        <text x={cx + 14} y={116} fill="#fdba74" fontWeight={600}>
          F : earth attracts the apple
        </text>
      </g>
      <g style={fade(2)} data-force="on-earth" fontFamily={MONO} fontSize={12}>
        <Arrow x1={cx} y1={cy - 4} x2={cx} y2={cy - 68} color="#5eead4" width={2.6} />
        <text x={cx - 14} y={cy - 40} fill="#99f6e4" fontWeight={600} textAnchor="end">
          −F : apple attracts the earth
        </text>
        <text x={cx - 14} y={cy - 24} fill="#cbd5e1" textAnchor="end" fontSize={11}>
          same magnitude, opposite direction
        </text>
      </g>
      <text x={706} y={446} fontFamily={MONO} fontSize={10.5} fill="#94a3b8" textAnchor="end">
        schematic, not to scale
      </text>
    </svg>
  );
}

/** Step 4: two bodies whose masses and separation the student sets; the vectors show the force on each. */
export function LawScene({ id = 'ls', m1, m2, r }: { id?: string; m1: number; m2: number; r: number }) {
  const f = (m1 * m2) / (r * r);
  const x1 = 150;
  const x2 = x1 + 70 + r * 100;
  const rad = (m: number) => 14 + 8 * Math.cbrt(m);
  const len = Math.min(170, 12 + 38 * Math.sqrt(f));
  const y = 150;
  return (
    <svg viewBox="0 0 720 300" className="block h-auto w-full" role="img" aria-label={`Two bodies ${r} units apart with masses ${m1} and ${m2} units. Each is attracted towards the other with a force ${f.toFixed(2)} times the starting force.`}>
      <Defs id={id} />
      <rect width={720} height={300} fill="#f8fafc" />
      <rect width={720} height={300} fill={`url(#${id}-grid)`} color="#e2e8f0" />
      <g fontFamily={MONO} fontSize={12} fill={INK}>
        <line x1={x1} y1={y + 78} x2={x2} y2={y + 78} stroke={INK} strokeWidth={1} />
        <path d={`M${x1} ${y + 72} v12 M${x2} ${y + 72} v12`} stroke={INK} strokeWidth={1} />
        <line x1={x1} y1={y} x2={x1} y2={y + 72} stroke={SLATE} strokeWidth={0.7} strokeDasharray="3 3" />
        <line x1={x2} y1={y} x2={x2} y2={y + 72} stroke={SLATE} strokeWidth={0.7} strokeDasharray="3 3" />
        <text x={(x1 + x2) / 2} y={y + 98} textAnchor="middle">
          r = {r} r₀
        </text>
        <text x={x1} y={y - rad(m1) - 12} textAnchor="middle">
          m₁ = {m1} m₀
        </text>
        <text x={x2} y={y - rad(m2) - 12} textAnchor="middle">
          m₂ = {m2} m₀
        </text>
        <text x={16} y={24} fill={SLATE}>
          F = G m₁ m₂ / r²
        </text>
      </g>
      <ellipse cx={x1 + 4} cy={y + rad(m1) + 5} rx={rad(m1) * 0.9} ry={3} fill="#0f172a" opacity={0.14} filter={`url(#${id}-soft)`} />
      <ellipse cx={x2 + 4} cy={y + rad(m2) + 5} rx={rad(m2) * 0.9} ry={3} fill="#0f172a" opacity={0.14} filter={`url(#${id}-soft)`} />
      <circle cx={x1} cy={y} r={rad(m1)} fill={`url(#${id}-steel)`} stroke="#334155" strokeWidth={0.8} />
      <circle cx={x2} cy={y} r={rad(m2)} fill={`url(#${id}-steel)`} stroke="#334155" strokeWidth={0.8} />
      <g data-law-arrows data-force={f.toFixed(3)}>
        <Arrow x1={x1} y1={y} x2={x1 + len} y2={y} color={FORCE} width={2.6} />
        <Arrow x1={x2} y1={y} x2={x2 - len} y2={y} color={FORCE} width={2.6} />
      </g>
    </svg>
  );
}

/** A small graph: axes with units, the whole curve drawn faintly, the part reached so far drawn boldly, and the present point. */
export function Plot({ title, xLabel, yLabel, xMax, yMax, fn, at, color = NAVY, from = 0, name }: { title: string; xLabel: string; yLabel: string; xMax: number; yMax: number; fn: (x: number) => number; at: number; color?: string; from?: number; name: string }) {
  const W = 300;
  const H = 176;
  const L = 44;
  const B = 34;
  const T = 22;
  const R = 12;
  const px = (x: number) => L + ((x - from) / (xMax - from)) * (W - L - R);
  const py = (y: number) => H - B - (Math.min(y, yMax) / yMax) * (H - B - T);
  const path = (to: number) => {
    const n = 48;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n;
      d += `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(fn(x)).toFixed(1)} `;
    }
    return d;
  };
  const nice = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
  const here = Math.min(Math.max(at, from), xMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Graph: ${title}. Now at ${xLabel} ${nice(here)}, ${yLabel} ${nice(fn(here))}.`} data-plot={name} data-at={here.toFixed(3)}>
      <rect width={W} height={H} fill="white" />
      <g fontFamily={MONO} fontSize={9.5} fill={SLATE}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={py(yMax * k)} y2={py(yMax * k)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={L - 5} y={py(yMax * k) + 3} textAnchor="end">
              {nice(yMax * k)}
            </text>
            <line y1={T} y2={H - B} x1={px(from + (xMax - from) * k)} x2={px(from + (xMax - from) * k)} stroke="#eef2f7" strokeWidth={1} />
            <text y={H - B + 12} x={px(from + (xMax - from) * k)} textAnchor="middle">
              {nice(from + (xMax - from) * k)}
            </text>
          </g>
        ))}
        <text x={L - 5} y={H - B + 12} textAnchor="end">
          {nice(from)}
        </text>
        <text x={(L + W - R) / 2} y={H - 5} textAnchor="middle" fill={INK}>
          {xLabel}
        </text>
        <text x={10} y={(T + H - B) / 2} textAnchor="middle" fill={INK} transform={`rotate(-90 10 ${(T + H - B) / 2})`}>
          {yLabel}
        </text>
        <text x={L} y={13} fill={INK} fontSize={10.5} fontWeight={600}>
          {title}
        </text>
      </g>
      <path d={`M${L} ${T} V${H - B} H${W - R}`} fill="none" stroke={INK} strokeWidth={1} />
      <path d={path(xMax)} fill="none" stroke={color} strokeWidth={1.2} opacity={0.3} strokeDasharray="3 3" />
      {here > from && <path d={path(here)} fill="none" stroke={color} strokeWidth={2.2} />}
      <circle cx={px(here)} cy={py(fn(here))} r={4} fill="white" stroke={color} strokeWidth={2} />
    </svg>
  );
}

/** Figures for the notes and the PDF. */
export function InverseSquareFigure({ id = 'isf' }: { id?: string }) {
  const rows = [1, 2, 3];
  return (
    <svg viewBox="0 0 720 240" className="block h-auto w-full" role="img" aria-label="Three pairs of bodies at separations r, 2r and 3r. The force is F, one quarter of F and one ninth of F.">
      <Defs id={id} />
      <rect width={720} height={240} fill="#f8fafc" />
      <rect width={720} height={240} fill={`url(#${id}-grid)`} color="#e2e8f0" />
      {rows.map((n, i) => {
        const y = 48 + i * 70;
        const x1 = 70;
        const x2 = x1 + n * 130;
        const len = 100 / (n * n) + 8;
        return (
          <g key={n}>
            <circle cx={x1} cy={y} r={14} fill={`url(#${id}-steel)`} stroke="#334155" strokeWidth={0.8} />
            <circle cx={x2} cy={y} r={14} fill={`url(#${id}-steel)`} stroke="#334155" strokeWidth={0.8} />
            <Arrow x1={x1} y1={y} x2={x1 + len} y2={y} />
            <Arrow x1={x2} y1={y} x2={x2 - len} y2={y} />
            <text x={520} y={y + 4} fontFamily={MONO} fontSize={12.5} fill={INK}>
              separation {n === 1 ? 'r' : `${n}r`} : force {n === 1 ? 'F' : `F / ${n * n}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HeightDepthFigure({ id = 'hdf' }: { id?: string }) {
  const cx = 220;
  const cy = 176;
  return (
    <svg viewBox="0 0 720 320" className="block h-auto w-full" role="img" aria-label="A section through the earth with one body at a height h above the surface and one at a depth d below it.">
      <Defs id={id} />
      <rect width={720} height={320} fill="#f8fafc" />
      <rect width={720} height={320} fill={`url(#${id}-grid)`} color="#e2e8f0" />
      <circle cx={cx} cy={cy} r={110} fill="#dbe7f3" stroke={NAVY} strokeWidth={1.4} />
      <circle cx={cx} cy={cy} r={68} fill="#b9cfe6" stroke={NAVY} strokeWidth={1} strokeDasharray="5 4" />
      <circle cx={cx} cy={cy} r={3} fill={INK} />
      <g fontFamily={MONO} fontSize={12} fill={INK}>
        <line x1={cx} y1={cy} x2={cx + 78} y2={cy - 78} stroke={INK} strokeWidth={1} />
        <text x={cx + 30} y={cy - 44}>
          radius
        </text>
        <circle cx={cx} cy={26} r={5} fill={FORCE} />
        <path d={`M${cx} 31 V${cy - 110}`} stroke={INK} strokeWidth={1} />
        <text x={cx + 9} y={52}>
          h
        </text>
        <circle cx={cx} cy={cy - 68} r={5} fill={TEAL} />
        <path d={`M${cx - 9} ${cy - 110} V${cy - 68}`} stroke={INK} strokeWidth={1} />
        <text x={cx - 24} y={cy - 84}>
          d
        </text>
        <circle cx={410} cy={84} r={5} fill={FORCE} />
        <text x={424} y={88}>
          height h: further from the centre,
        </text>
        <text x={424} y={106}>
          so g is smaller than at the surface
        </text>
        <circle cx={410} cy={170} r={5} fill={TEAL} />
        <text x={424} y={174}>
          depth d: only the inner sphere
        </text>
        <text x={424} y={192}>
          (dashed) attracts the body,
        </text>
        <text x={424} y={210}>
          so g is smaller here too
        </text>
      </g>
    </svg>
  );
}

/** A caption strip under a drawing. */
export function Caption({ children }: { children: ReactNode }) {
  return <figcaption className="border-t border-rule bg-surface px-3 py-1.5 text-xs text-ink-2">{children}</figcaption>;
}
