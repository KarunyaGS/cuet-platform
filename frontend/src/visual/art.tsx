/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Drawings for the visual learning pack: small icons, the story scenes and the figures used in the notes and the PDF.
 * All are plain SVG drawn here (no pictures from anywhere else), with no state of their own, so the same drawings
 * serve the page and the printed PDF.
 */
import type { ReactNode } from 'react';
import type { MapNode } from './gravitation';

export const INK = '#1a2233';
export const BLUE = '#2347a8';
export const GREEN = '#1d7a4b';
export const AMBER = '#a86100';
export const RED = '#c2362b';

/** A small drawing centred on (0,0), about 20 units across, for a mind-map node or a flowchart stage. */
export function Glyph({ name, color = 'white' }: { name: MapNode['icon']; color?: string }) {
  const s = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'apple':
      return (
        <g>
          <path d="M0 -4 C-9 -10 -11 4 -5 9 C-2 11 2 11 5 9 C11 4 9 -10 0 -4Z" fill={color} stroke="none" />
          <path d="M0 -4 C0 -8 2 -10 4 -11" {...s} />
        </g>
      );
    case 'earth':
      return (
        <g>
          <circle r={9} {...s} />
          <path d="M-9 0 H9 M0 -9 C-5 -4 -5 4 0 9 M0 -9 C5 -4 5 4 0 9" {...s} strokeWidth={1.3} />
        </g>
      );
    case 'law':
      return (
        <g>
          <circle cx={-7} r={4} fill={color} />
          <circle cx={8} r={2.6} fill={color} />
          <path d="M-2 0 H4" {...s} />
          <path d="M2 -2 L4 0 L2 2 M-0 -2 L-2 0 L0 2" {...s} strokeWidth={1.3} />
        </g>
      );
    case 'constant':
      return (
        <text textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fontStyle="italic" fill={color} fontFamily="Georgia, serif">
          G
        </text>
      );
    case 'g':
      return (
        <text textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fontStyle="italic" fill={color} fontFamily="Georgia, serif" y={-1}>
          g
        </text>
      );
    case 'up':
      return <path d="M0 8 V-8 M-5 -3 L0 -8 L5 -3 M-8 9 H8" {...s} />;
    case 'down':
      return <path d="M0 -8 V8 M-5 3 L0 8 L5 3 M-8 -9 H8" {...s} />;
    case 'moon':
      return (
        <g>
          <circle r={3.4} fill={color} />
          <ellipse rx={10} ry={6} {...s} strokeWidth={1.3} strokeDasharray="2 2.2" />
          <circle cx={9} cy={-2.4} r={1.9} fill={color} />
        </g>
      );
    case 'arrows':
      return <path d="M-9 0 H-2 M-5 -3 L-2 0 L-5 3 M9 0 H2 M5 -3 L2 0 L5 3" {...s} />;
    case 'sum':
      return <path d="M6 -8 H-6 L1 0 L-6 8 H6" {...s} />;
    case 'scale':
      return <path d="M0 -8 V8 M-8 -5 H8 M-8 -5 L-10 2 H-6 Z M8 -5 L6 2 H10 Z M-4 8 H4" {...s} strokeWidth={1.4} />;
    default:
      return <circle r={3} fill={color} />;
  }
}

/** An arrow from (x1,y1) to (x2,y2) with a filled head. */
export function Arrow({ x1, y1, x2, y2, color = RED, width = 4, dashed = false }: { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; dashed?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.max(10, width * 3);
  const bx = x2 - h * Math.cos(a);
  const by = y2 - h * Math.sin(a);
  const p = (t: number) => `${(bx + (h / 2) * Math.cos(a + t)).toFixed(1)},${(by + (h / 2) * Math.sin(a + t)).toFixed(1)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dashed ? '6 5' : undefined} />
      <polygon points={`${x2.toFixed(1)},${y2.toFixed(1)} ${p(Math.PI / 2)} ${p(-Math.PI / 2)}`} fill={color} />
    </g>
  );
}

export function Apple({ x, y, r = 13, opacity = 1 }: { x: number; y: number; r?: number; opacity?: number }) {
  const k = r / 13;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={opacity}>
      <path d="M0 -6 C-13 -15 -17 5 -8 13 C-3 17 3 17 8 13 C17 5 13 -15 0 -6Z" fill="#d93a2f" />
      <path d="M-7 -3 C-9 1 -8 6 -5 9" stroke="#f4a39c" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M0 -6 C0 -11 2 -14 5 -16" stroke="#5b3a1e" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M3 -13 C8 -17 13 -15 14 -11 C10 -9 5 -10 3 -13Z" fill="#3f9a57" />
    </g>
  );
}

function Tree({ children }: { children?: ReactNode }) {
  return (
    <g>
      <path d="M196 338 C204 290 200 250 206 205 L238 205 C240 250 240 292 252 338Z" fill="#7a5230" />
      <path d="M222 240 C250 226 276 214 300 196" stroke="#7a5230" strokeWidth={9} fill="none" strokeLinecap="round" />
      <g fill="#3f9a57">
        <circle cx={150} cy={170} r={62} />
        <circle cx={226} cy={120} r={76} />
        <circle cx={305} cy={160} r={60} />
        <circle cx={200} cy={196} r={50} />
        <circle cx={268} cy={196} r={44} />
      </g>
      <g fill="#58b06e" opacity={0.7}>
        <circle cx={205} cy={100} r={40} />
        <circle cx={140} cy={155} r={30} />
        <circle cx={300} cy={140} r={28} />
      </g>
      <Apple x={150} y={196} r={9} />
      <Apple x={236} y={150} r={9} />
      <Apple x={196} y={96} r={8} />
      {children}
    </g>
  );
}

function Sky() {
  return (
    <g>
      <defs>
        <linearGradient id="vl-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#cfe6fb" />
          <stop offset="1" stopColor="#f3f9ff" />
        </linearGradient>
      </defs>
      <rect width={640} height={400} fill="url(#vl-sky)" />
      <circle cx={560} cy={64} r={30} fill="#ffd866" />
      <g fill="white" opacity={0.9}>
        <ellipse cx={450} cy={86} rx={44} ry={14} />
        <ellipse cx={478} cy={76} rx={28} ry={12} />
        <ellipse cx={86} cy={58} rx={40} ry={12} />
      </g>
      <path d="M0 330 C140 312 300 322 420 326 C520 330 600 318 640 322 V400 H0Z" fill="#8fce83" />
      <path d="M0 352 C200 338 420 350 640 342 V400 H0Z" fill="#74bb69" />
    </g>
  );
}

const HANG = { x: 318, y: 212 };
const GROUND = 322;
/** Positions of a falling body at equal time steps: the gaps grow, because it accelerates. */
export const FALL_MARKS = [0, 1, 4, 9, 16].map((n) => HANG.y + ((GROUND - HANG.y) * n) / 16);

/** Scene for step 1 and step 2: the tree, the apple, and (when `fallen`) the fall with its force arrow. */
export function TreeScene({ fallen, showForce, showMarks, still = false }: { fallen: boolean; showForce: boolean; showMarks: boolean; still?: boolean }) {
  const y = fallen ? GROUND : HANG.y;
  return (
    <svg viewBox="0 0 640 400" className="block h-auto w-full" role="img" aria-label={fallen ? 'An apple falls from the tree straight down to the ground. An arrow shows the gravitational force pointing towards the earth.' : 'An apple hangs from a branch of a tree.'}>
      <Sky />
      <Tree />
      {showMarks && (
        <g data-fall-marks>
          {FALL_MARKS.slice(0, 4).map((my, i) => (
            <g key={i}>
              <Apple x={HANG.x} y={my} r={11} opacity={0.28} />
              <line x1={HANG.x + 20} x2={HANG.x + 30} y1={my} y2={my} stroke={INK} strokeWidth={1} opacity={0.5} />
            </g>
          ))}
          <text x={HANG.x + 36} y={HANG.y + 4} fontSize={12} fill={INK}>
            equal time steps:
          </text>
          <text x={HANG.x + 36} y={HANG.y + 19} fontSize={12} fill={INK}>
            the gaps grow
          </text>
        </g>
      )}
      <g data-hero-apple data-fallen={fallen ? '' : undefined} style={{ transform: `translateY(${y - HANG.y}px)`, transition: still ? 'none' : 'transform 1.15s cubic-bezier(0.5, 0, 1, 0.55)' }}>
        <Apple x={HANG.x} y={HANG.y} r={14} />
      </g>
      {showForce && (
        <g data-force-arrow style={{ transition: 'opacity 0.5s', opacity: 1 }}>
          <Arrow x1={438} y1={214} x2={438} y2={306} />
          <text x={452} y={250} fontSize={14} fontWeight={600} fill={RED}>
            gravitational force
          </text>
          <text x={452} y={268} fontSize={13} fill={INK}>
            towards the earth
          </text>
        </g>
      )}
    </svg>
  );
}

function Earth({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#3b82c4" />
      <g fill="#58b06e" transform={`translate(${cx} ${cy}) scale(${r / 90})`}>
        <path d="M-58 -44 C-40 -66 -8 -70 6 -56 C16 -44 -2 -34 -10 -20 C-18 -6 -40 -4 -52 -18 C-60 -28 -64 -36 -58 -44Z" />
        <path d="M20 -10 C40 -22 66 -8 68 14 C70 34 52 56 34 60 C20 62 16 44 20 30 C24 16 10 0 20 -10Z" />
        <path d="M-48 30 C-34 22 -14 30 -12 46 C-10 60 -28 70 -40 64 C-52 58 -58 40 -48 30Z" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f5d94" strokeWidth={2} />
    </g>
  );
}

/** Scene for step 3: the earth and the apple pull each other with equal and opposite forces, along the joining line. */
export function PairScene({ reveal = 3 }: { reveal?: number }) {
  return (
    <svg viewBox="0 0 640 400" className="block h-auto w-full" role="img" aria-label="The earth and an apple above it. An arrow on the apple points to the earth. An equal arrow at the earth's centre points to the apple. A dashed line joins the apple and the centre of the earth.">
      <rect width={640} height={400} fill="#101a33" />
      {[[60, 50], [130, 120], [520, 60], [580, 180], [90, 300], [470, 330], [560, 290], [300, 30], [200, 60], [40, 190]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.3 : 2} fill="white" opacity={0.8} />
      ))}
      <Earth cx={320} cy={278} r={92} />
      <line x1={320} y1={74} x2={320} y2={278} stroke="white" strokeWidth={1.5} strokeDasharray="5 5" opacity={reveal >= 3 ? 0.85 : 0} style={{ transition: 'opacity 0.6s' }} />
      <circle cx={320} cy={278} r={4} fill="white" opacity={reveal >= 3 ? 1 : 0} style={{ transition: 'opacity 0.6s' }} />
      <Apple x={320} y={62} r={15} />
      <g opacity={reveal >= 1 ? 1 : 0} style={{ transition: 'opacity 0.6s' }} data-force="on-apple">
        <Arrow x1={320} y1={84} x2={320} y2={150} color="#ff6b5e" width={5} />
        <text x={336} y={112} fontSize={14} fontWeight={600} fill="#ffb3ab">
          earth pulls the apple
        </text>
        <text x={336} y={130} fontSize={13} fill="white" opacity={0.85}>
          force F
        </text>
      </g>
      <g opacity={reveal >= 2 ? 1 : 0} style={{ transition: 'opacity 0.6s' }} data-force="on-earth">
        <Arrow x1={320} y1={274} x2={320} y2={208} color="#ffd866" width={5} />
        <text x={220} y={232} fontSize={14} fontWeight={600} fill="#ffe9a6" textAnchor="end">
          apple pulls the earth
        </text>
        <text x={220} y={250} fontSize={13} fill="white" opacity={0.85} textAnchor="end">
          force −F, the same size
        </text>
      </g>
      <text x={336} y={292} fontSize={12.5} fill="white" opacity={reveal >= 3 ? 0.9 : 0} style={{ transition: 'opacity 0.6s' }}>
        centre of the earth
      </text>
      <text x={624} y={386} fontSize={11} fill="white" opacity={0.6} textAnchor="end">
        not to scale
      </text>
    </svg>
  );
}

/** Scene for step 4: two bodies whose masses and distance the student sets; the arrows show the size of the force. */
export function LawScene({ m1, m2, r }: { m1: number; m2: number; r: number }) {
  const f = (m1 * m2) / (r * r);
  const x1 = 140;
  const x2 = x1 + 90 + r * 90;
  const rad = (m: number) => 16 + 9 * Math.cbrt(m);
  const len = Math.min(150, 14 + 34 * Math.sqrt(f));
  const y = 170;
  return (
    <svg viewBox="0 0 640 330" className="block h-auto w-full" role="img" aria-label={`Two bodies ${r} units apart with masses ${m1} and ${m2} units. Each is pulled towards the other with a force ${f.toFixed(2)} times the starting force.`}>
      <rect width={640} height={330} fill="#f4f7fd" />
      <line x1={x1} y1={y + 74} x2={x2} y2={y + 74} stroke={INK} strokeWidth={1.2} />
      <path d={`M${x1} ${y + 68} v12 M${x2} ${y + 68} v12`} stroke={INK} strokeWidth={1.2} />
      <text x={(x1 + x2) / 2} y={y + 94} fontSize={14} textAnchor="middle" fill={INK} fontStyle="italic">
        r = {r}
      </text>
      <g style={{ transition: 'all 0.35s' }}>
        <circle cx={x1} cy={y} r={rad(m1)} fill={BLUE} style={{ transition: 'r 0.35s' }} />
        <text x={x1} y={y - rad(m1) - 10} fontSize={14} textAnchor="middle" fill={INK} fontStyle="italic">
          m₁ = {m1}
        </text>
      </g>
      <g style={{ transform: `translateX(${x2 - 320}px)`, transition: 'transform 0.35s' }}>
        <circle cx={320} cy={y} r={rad(m2)} fill={GREEN} style={{ transition: 'r 0.35s' }} />
        <text x={320} y={y - rad(m2) - 10} fontSize={14} textAnchor="middle" fill={INK} fontStyle="italic">
          m₂ = {m2}
        </text>
      </g>
      <g data-law-arrows data-force={f.toFixed(3)}>
        <Arrow x1={x1} y1={y} x2={x1 + len} y2={y} color={RED} width={5} />
        <Arrow x1={x2} y1={y} x2={x2 - len} y2={y} color={RED} width={5} />
      </g>
      <text x={320} y={34} fontSize={15} textAnchor="middle" fill={INK}>
        Each body is pulled towards the other with the same force
      </text>
    </svg>
  );
}

/** Figures for the notes and the PDF. */
export function InverseSquareFigure() {
  const rows = [1, 2, 3];
  return (
    <svg viewBox="0 0 640 230" className="block h-auto w-full" role="img" aria-label="Three pairs of bodies at distances r, 2r and 3r. The force is F, one quarter of F and one ninth of F.">
      <rect width={640} height={230} fill="#f4f7fd" />
      {rows.map((n, i) => {
        const y = 48 + i * 66;
        const x1 = 70;
        const x2 = x1 + n * 120;
        const len = 96 / (n * n) + 8;
        return (
          <g key={n}>
            <circle cx={x1} cy={y} r={15} fill={BLUE} />
            <circle cx={x2} cy={y} r={15} fill={GREEN} />
            <Arrow x1={x1} y1={y} x2={x1 + len} y2={y} width={4} />
            <Arrow x1={x2} y1={y} x2={x2 - len} y2={y} width={4} />
            <text x={470} y={y + 5} fontSize={14} fill={INK}>
              distance {n === 1 ? 'r' : `${n}r`}: force {n === 1 ? 'F' : `F / ${n * n}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HeightDepthFigure() {
  return (
    <svg viewBox="0 0 640 300" className="block h-auto w-full" role="img" aria-label="The earth with one body at a height h above the surface and one at a depth d below it. Both are at a distance from the centre different from the radius.">
      <rect width={640} height={300} fill="#f4f7fd" />
      <circle cx={230} cy={170} r={104} fill="#cfe1f4" stroke="#1f5d94" strokeWidth={2} />
      <circle cx={230} cy={170} r={64} fill="#a9c8ea" stroke="#1f5d94" strokeWidth={1.2} strokeDasharray="5 4" />
      <circle cx={230} cy={170} r={3.5} fill={INK} />
      <line x1={230} y1={170} x2={303} y2={96} stroke={INK} strokeWidth={1.2} />
      <text x={258} y={126} fontSize={13} fill={INK} fontStyle="italic">
        R
      </text>
      <text x={268} y={130} fontSize={9} fill={INK}>
        E
      </text>
      <circle cx={230} cy={26} r={6} fill={RED} />
      <line x1={230} y1={32} x2={230} y2={66} stroke={INK} strokeWidth={1.2} />
      <text x={240} y={52} fontSize={13} fill={INK} fontStyle="italic">
        h
      </text>
      <circle cx={230} cy={106} r={6} fill={AMBER} />
      <line x1={222} y1={66} x2={222} y2={106} stroke={INK} strokeWidth={1.2} />
      <text x={206} y={90} fontSize={13} fill={INK} fontStyle="italic">
        d
      </text>
      <g fontSize={13.5} fill={INK}>
        <circle cx={392} cy={70} r={6} fill={RED} />
        <text x={406} y={75}>at height h: further from the centre</text>
        <text x={406} y={94}>g is smaller than at the surface</text>
        <circle cx={392} cy={150} r={6} fill={AMBER} />
        <text x={406} y={155}>at depth d: only the inner sphere</text>
        <text x={406} y={174}>below it attracts it</text>
        <text x={406} y={193}>g is smaller here too</text>
      </g>
    </svg>
  );
}
