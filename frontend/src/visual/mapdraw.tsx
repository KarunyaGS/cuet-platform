/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Mind map: where each idea goes, and how it is drawn. No state here: the interactive map and the PDF both use it.
 * The centre is in the middle; main branches go right and left, each in its own colour; their ideas fan out beyond.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { Glyph, INK } from './art';
import type { MapNode } from './gravitation';

export const BRANCH_COLORS = ['#2347a8', '#1d7a4b', '#a86100', '#8b3fa8', '#0f766e', '#b42318'];
const ROW = 62;
const BRANCH_X = 250;
const LEAF_X = 520;

export interface Placed { node: MapNode; x: number; y: number; depth: number; side: 1 | -1; color: string; parent: Placed | null; hidden: number }

/** Positions for every idea that is showing. `closed` holds the ids of branches the student has folded. */
export function layoutMap(root: MapNode, closed: Set<string>): { nodes: Placed[]; box: { x: number; y: number; w: number; h: number } } {
  const branches = root.children ?? [];
  const half = Math.ceil(branches.length / 2);
  const centre: Placed = { node: root, x: 0, y: 0, depth: 0, side: 1, color: INK, parent: null, hidden: 0 };
  const nodes: Placed[] = [centre];
  for (const side of [1, -1] as const) {
    const mine = side === 1 ? branches.slice(0, half) : branches.slice(half);
    const rows = (b: MapNode) => (closed.has(b.id) ? 1 : Math.max(1, b.children?.length ?? 0));
    const total = mine.reduce((n, b) => n + rows(b), 0) + Math.max(0, mine.length - 1) * 0.5;
    let at = -((total - 1) * ROW) / 2;
    for (const b of mine) {
      const n = rows(b);
      const kids = closed.has(b.id) ? [] : (b.children ?? []);
      const color = BRANCH_COLORS[branches.indexOf(b) % BRANCH_COLORS.length]!;
      const placed: Placed = { node: b, x: side * BRANCH_X, y: at + ((n - 1) * ROW) / 2, depth: 1, side, color, parent: centre, hidden: closed.has(b.id) ? (b.children?.length ?? 0) : 0 };
      nodes.push(placed);
      kids.forEach((k, i) => nodes.push({ node: k, x: side * LEAF_X, y: at + i * ROW, depth: 2, side, color, parent: placed, hidden: 0 }));
      at += (n + 0.5) * ROW;
    }
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const pad = { x: 190, y: 80 };
  const x = Math.min(...xs) - pad.x;
  const y = Math.min(...ys) - pad.y;
  return { nodes, box: { x, y, w: Math.max(...xs) + pad.x - x, h: Math.max(...ys) + pad.y - y } };
}

const wrap = (label: string, max: number): string[] => {
  const out: string[] = [];
  let line = '';
  for (const w of label.split(' ')) {
    if (line && (line + ' ' + w).length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
};

export interface MapHandlers { onPick?: (id: string) => void; onToggle?: (id: string) => void }

/** The drawing: curved, coloured branches and the ideas on them. With handlers it is interactive; without, it is a picture. */
export function MapDrawing({ nodes, selected, handlers }: { nodes: Placed[]; selected?: string | null; handlers?: MapHandlers }) {
  const live = Boolean(handlers?.onPick);
  const key = (id: string, hasKids: boolean) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlers?.onPick?.(id);
    } else if (hasKids && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      handlers?.onToggle?.(id);
    }
  };
  const interactive = (p: Placed, children: ReactNode) =>
    live ? (
      <g key={p.node.id} role="button" tabIndex={0} aria-pressed={selected === p.node.id} aria-label={`${p.node.label}${p.node.children?.length ? `, ${p.hidden ? 'folded' : 'open'}, ${p.node.children.length} ideas` : ''}`} data-map-node={p.node.id} data-depth={p.depth} onClick={() => handlers?.onPick?.(p.node.id)} onKeyDown={key(p.node.id, Boolean(p.node.children?.length) && p.depth > 0)} style={{ cursor: 'pointer', outline: 'none' }} className="vl-node">
        {children}
      </g>
    ) : (
      <g key={p.node.id}>{children}</g>
    );
  return (
    <g fontFamily="inherit">
      {nodes.filter((p) => p.parent).map((p) => {
        const a = p.parent!;
        const x1 = a.x + (p.depth === 1 ? p.side * 58 : p.side * 104);
        const x2 = p.x - p.side * (p.depth === 1 ? 104 : 20);
        const mid = (x1 + x2) / 2;
        return <path key={`e-${p.node.id}`} d={`M${x1} ${a.y} C${mid} ${a.y} ${mid} ${p.y} ${x2} ${p.y}`} fill="none" stroke={p.color} strokeWidth={p.depth === 1 ? 5 : 2.6} strokeLinecap="round" opacity={0.9} />;
      })}
      {nodes.map((p) => {
        const on = selected === p.node.id;
        if (p.depth === 0)
          return interactive(
            p,
            <>
              <circle r={66} fill={on ? '#1b3888' : '#2347a8'} stroke={on ? '#ffd866' : 'white'} strokeWidth={on ? 5 : 4} />
              <g transform="translate(0 -14) scale(2)">
                <Glyph name={p.node.icon} />
              </g>
              <text y={30} textAnchor="middle" fontSize={17} fontWeight={700} fill="white">
                {p.node.label}
              </text>
            </>,
          );
        const lines = wrap(p.node.label, p.depth === 1 ? 18 : 22);
        if (p.depth === 1) {
          const kids = p.node.children?.length ?? 0;
          return (
            <g key={`b-${p.node.id}`} transform={`translate(${p.x} ${p.y})`}>
              {interactive(
                p,
                <>
                  <rect x={-104} y={-26} width={208} height={52} rx={26} fill={on ? p.color : 'white'} stroke={p.color} strokeWidth={on ? 3 : 2.5} />
                  <circle cx={-78} r={19} fill={on ? 'white' : p.color} />
                  <g transform="translate(-78 0)">
                    <Glyph name={p.node.icon} color={on ? p.color : 'white'} />
                  </g>
                  {lines.map((l, i) => (
                    <text key={i} x={-52} y={(i - (lines.length - 1) / 2) * 16 + 5} fontSize={14} fontWeight={600} fill={on ? 'white' : INK}>
                      {l}
                    </text>
                  ))}
                </>,
              )}
              {kids > 0 && live && (
                <g role="button" tabIndex={0} aria-label={p.hidden ? `Open ${p.node.label}: ${kids} ideas` : `Fold ${p.node.label}`} data-map-toggle={p.node.id} onClick={() => handlers?.onToggle?.(p.node.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handlers?.onToggle?.(p.node.id))} transform={`translate(${p.side * 118} 0)`} style={{ cursor: 'pointer', outline: 'none' }} className="vl-node">
                  <circle r={13} fill="white" stroke={p.color} strokeWidth={2} />
                  <text textAnchor="middle" y={4.5} fontSize={p.hidden ? 12 : 16} fontWeight={700} fill={p.color}>
                    {p.hidden ? `+${p.hidden}` : '−'}
                  </text>
                </g>
              )}
            </g>
          );
        }
        // An idea on a branch: a small round badge and its words on a coloured underline. No box.
        const w = Math.max(...lines.map((l) => l.length)) * 7.2 + 34;
        return (
          <g key={`l-${p.node.id}`} transform={`translate(${p.x} ${p.y})`}>
            {interactive(
              p,
              <>
                <rect x={p.side === 1 ? -22 : -w + 22} y={-24} width={w} height={48} rx={10} fill={on ? `${p.color}22` : 'transparent'} />
                <circle r={15} fill={p.color} stroke={on ? '#ffd866' : 'none'} strokeWidth={3} />
                <Glyph name={p.node.icon} />
                {lines.map((l, i) => (
                  <text key={i} x={p.side * 24} y={(i - (lines.length - 1) / 2) * 15 + 4} fontSize={13} fontWeight={on ? 700 : 500} fill={INK} textAnchor={p.side === 1 ? 'start' : 'end'}>
                    {l}
                  </text>
                ))}
                <line x1={p.side * 22} x2={p.side * (w - 14)} y1={lines.length > 1 ? 22 : 13} y2={lines.length > 1 ? 22 : 13} stroke={p.color} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
              </>,
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Every idea in the map, flat, with its branch colour: for the list view and for looking one up by id. */
export function flatten(root: MapNode): { node: MapNode; depth: number; color: string; parent: MapNode | null }[] {
  const out: { node: MapNode; depth: number; color: string; parent: MapNode | null }[] = [{ node: root, depth: 0, color: '#2347a8', parent: null }];
  (root.children ?? []).forEach((b, i) => {
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length]!;
    out.push({ node: b, depth: 1, color, parent: root });
    for (const k of b.children ?? []) out.push({ node: k, depth: 2, color, parent: b });
  });
  return out;
}
