/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Flowchart drawing, in standard notation: a process is a box, a decision is a diamond, the result is a rounded
 * terminal. Stages are numbered and joined by straight connectors. No state here: the interactive flowchart and the
 * PDF both use it.
 */
import { Glyph, INK, NAVY, SLATE } from './art';
import type { FlowNode } from './gravitation';

export const FLOW_BOX = { w: 480, h: 632 };
const C = { done: NAVY, todo: '#cbd5e1', now: '#b45309', wrong: '#b42318', result: NAVY };
const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace';
const half = (n: FlowNode) => (n.kind === 'decision' ? { w: 122, h: 50 } : n.kind === 'wrong' ? { w: 88, h: 30 } : { w: 118, h: 28 });

const edgePath = (a: FlowNode, b: FlowNode, back = false) => {
  const ha = half(a);
  const hb = half(b);
  if (back) {
    // from the top of the wrong turn, up and back into the decision's upper right side
    const x = b.x + 66;
    const y = b.y - hb.h * (1 - 66 / hb.w);
    return `M${a.x} ${a.y - ha.h} V${b.y - 78} H${x} V${y - 2}`;
  }
  if (a.y === b.y) return `M${a.x + ha.w} ${a.y} H${b.x - hb.w - 2}`;
  return `M${a.x} ${a.y + ha.h} V${b.y - hb.h - 2}`;
};

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

export function FlowDrawing({ nodes, current, visited, onPick }: { nodes: FlowNode[]; current?: string | null; visited: Set<string>; onPick?: (id: string) => void }) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const edges: { from: FlowNode; to: FlowNode; tag?: string; back?: boolean }[] = [];
  for (const n of nodes) {
    if (n.kind === 'wrong' && n.next) edges.push({ from: n, to: by.get(n.next)!, back: true });
    else if (n.next) edges.push({ from: n, to: by.get(n.next)! });
    if (n.yes) edges.push({ from: n, to: by.get(n.yes)!, tag: 'Yes' });
    if (n.no) edges.push({ from: n, to: by.get(n.no)!, tag: 'No' });
  }
  const stages = nodes.filter((n) => n.kind !== 'wrong');
  return (
    <g>
      <defs>
        <marker id="vl-flow-head" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9Z" fill="context-stroke" />
        </marker>
      </defs>
      {edges.map((e) => {
        const walked = visited.has(e.from.id) && visited.has(e.to.id) && !e.back;
        const active = current === e.to.id && walked;
        const colour = e.back ? C.wrong : walked ? C.done : C.todo;
        const hf = half(e.from);
        return (
          <g key={`${e.from.id}-${e.to.id}`} data-flow-edge={`${e.from.id}-${e.to.id}`} data-walked={walked ? '' : undefined}>
            <path d={edgePath(e.from, e.to, e.back)} fill="none" stroke={colour} strokeWidth={walked ? 2 : 1.4} strokeDasharray={e.back ? '4 4' : active ? '6 4' : undefined} markerEnd="url(#vl-flow-head)" className={active ? 'vl-flow' : undefined} style={{ transition: 'stroke 0.4s' }} />
            {e.tag && (
              <text x={e.from.y === e.to.y ? e.from.x + hf.w + 12 : e.from.x + 9} y={e.from.y === e.to.y ? e.from.y - 7 : e.from.y + hf.h + 17} fontFamily={MONO} fontSize={11.5} fontWeight={600} fill={INK}>
                {e.tag}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const now = current === n.id;
        const seen = visited.has(n.id);
        const picture = !onPick;
        const colour = n.kind === 'wrong' ? C.wrong : now ? C.now : seen || picture ? C.done : C.todo;
        const can = Boolean(onPick) && seen;
        const h = half(n);
        const lines = wrap(n.label, n.kind === 'decision' ? 16 : n.kind === 'wrong' ? 22 : 24);
        const fill = n.kind === 'result' ? (seen || picture ? NAVY : 'white') : now ? '#fff7ed' : seen && n.kind !== 'wrong' ? '#f1f5fb' : 'white';
        const ink = n.kind === 'result' && (seen || picture) ? 'white' : seen || picture || now ? INK : SLATE;
        const index = stages.indexOf(n);
        const textX = n.kind === 'decision' || n.kind === 'wrong' ? 0 : -h.w + 44;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            data-flow-node={n.id}
            data-state={now ? 'current' : seen ? 'visited' : 'ahead'}
            role={can ? 'button' : undefined}
            tabIndex={can ? 0 : undefined}
            aria-label={can ? `${n.label}${now ? ', current stage' : ''}` : undefined}
            aria-current={now ? 'step' : undefined}
            onClick={can ? () => onPick!(n.id) : undefined}
            onKeyDown={can ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick!(n.id)) : undefined}
            style={{ cursor: can ? 'pointer' : 'default', outline: 'none' }}
            className={can ? 'vl-node' : undefined}
          >
            {n.kind === 'decision' ? (
              <path d={`M0 ${-h.h} L${h.w} 0 L0 ${h.h} L${-h.w} 0Z`} fill={fill} stroke={colour} strokeWidth={now ? 2.4 : 1.5} style={{ transition: 'stroke 0.4s, fill 0.4s' }} />
            ) : (
              <rect x={-h.w} y={-h.h} width={h.w * 2} height={h.h * 2} rx={n.kind === 'result' ? h.h : 5} fill={fill} stroke={colour} strokeWidth={now ? 2.4 : 1.5} strokeDasharray={n.kind === 'wrong' ? '5 4' : undefined} style={{ transition: 'stroke 0.4s, fill 0.4s' }} />
            )}
            {now && n.kind !== 'decision' && <rect x={-h.w - 5} y={-h.h - 5} width={h.w * 2 + 10} height={h.h * 2 + 10} rx={n.kind === 'result' ? h.h + 5 : 8} fill="none" stroke={C.now} strokeWidth={1.2} className="vl-pulse" />}
            {now && n.kind === 'decision' && <path d={`M0 ${-h.h - 7} L${h.w + 9} 0 L0 ${h.h + 7} L${-h.w - 9} 0Z`} fill="none" stroke={C.now} strokeWidth={1.2} className="vl-pulse" />}
            {n.kind !== 'decision' && n.kind !== 'wrong' && (
              <>
                <g transform={`translate(${-h.w + 22} 0) scale(0.95)`}>
                  <Glyph name={n.icon} color={n.kind === 'result' && (seen || picture) ? 'white' : colour === C.todo ? SLATE : colour} />
                </g>
                {n.kind === 'stage' && index >= 0 && (
                  <text x={h.w - 8} y={-h.h + 13} textAnchor="end" fontFamily={MONO} fontSize={9.5} fill={SLATE}>
                    {String(index + 1).padStart(2, '0')}
                  </text>
                )}
              </>
            )}
            {lines.map((l, i) => (
              <text key={i} x={textX} y={(i - (lines.length - 1) / 2) * 15 + 4.5} textAnchor={textX === 0 ? 'middle' : 'start'} fontSize={n.kind === 'wrong' ? 12 : 13} fontWeight={now || n.kind === 'result' ? 600 : 500} fill={n.kind === 'wrong' ? C.wrong : ink}>
                {l}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}
