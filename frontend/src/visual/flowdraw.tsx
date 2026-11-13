/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Flowchart drawing: stages as round illustrated stops, a decision as a diamond, the result as a ringed badge.
 * No state here: the interactive flowchart and the PDF both use it.
 */
import { Glyph, INK } from './art';
import type { FlowNode } from './gravitation';

export const FLOW_BOX = { w: 560, h: 780 };
const C = { done: '#2347a8', todo: '#c9ced8', now: '#a86100', wrong: '#b42318', result: '#1d7a4b' };

const edgePath = (a: FlowNode, b: FlowNode, back = false) => {
  if (back) return `M${a.x} ${a.y - 34} C${a.x} ${a.y - 96} ${b.x + 70} ${b.y - 96} ${b.x + 44} ${b.y - 30}`;
  if (a.y === b.y) return `M${a.x + 46} ${a.y} H${b.x - 36}`;
  return `M${a.x} ${a.y + (a.kind === 'decision' ? 46 : 34)} V${b.y - (b.kind === 'decision' ? 46 : b.kind === 'result' ? 42 : 34)}`;
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
  return (
    <g>
      <defs>
        <marker id="vl-flow-head" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10Z" fill="context-stroke" />
        </marker>
      </defs>
      {edges.map((e) => {
        const walked = visited.has(e.from.id) && visited.has(e.to.id) && !e.back;
        const colour = e.back ? C.wrong : walked ? C.done : C.todo;
        return (
          <g key={`${e.from.id}-${e.to.id}`} data-flow-edge={`${e.from.id}-${e.to.id}`} data-walked={walked ? '' : undefined}>
            <path d={edgePath(e.from, e.to, e.back)} fill="none" stroke={colour} strokeWidth={walked ? 4 : 2.5} strokeDasharray={e.back ? '5 5' : undefined} markerEnd="url(#vl-flow-head)" style={{ transition: 'stroke 0.5s, stroke-width 0.5s' }} />
            {e.tag && (
              <text x={e.from.y === e.to.y ? (e.from.x + e.to.x) / 2 + 4 : e.from.x + 12} y={e.from.y === e.to.y ? e.from.y - 9 : (e.from.y + e.to.y) / 2 + 12} fontSize={13} fontWeight={700} fill={INK} textAnchor={e.from.y === e.to.y ? 'middle' : 'start'}>
                {e.tag}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const now = current === n.id;
        const seen = visited.has(n.id);
        const colour = n.kind === 'wrong' ? C.wrong : n.kind === 'result' ? C.result : now ? C.now : seen ? C.done : C.todo;
        const can = Boolean(onPick) && seen;
        const lines = n.label.length > 22 ? [n.label.slice(0, n.label.lastIndexOf(' ', 22)), n.label.slice(n.label.lastIndexOf(' ', 22) + 1)] : [n.label];
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
            style={{ cursor: can ? 'pointer' : 'default', outline: 'none', opacity: seen || !onPick ? 1 : 0.55, transition: 'opacity 0.5s' }}
            className={can ? 'vl-node' : undefined}
          >
            {now && <circle r={n.kind === 'decision' ? 58 : 46} fill="none" stroke={C.now} strokeWidth={3} opacity={0.35} className="vl-pulse" />}
            {n.kind === 'decision' ? (
              <path d="M0 -46 L52 0 L0 46 L-52 0Z" fill="white" stroke={colour} strokeWidth={3.5} style={{ transition: 'stroke 0.5s' }} />
            ) : n.kind === 'result' ? (
              <>
                <circle r={42} fill="white" stroke={colour} strokeWidth={3} />
                <circle r={33} fill={seen || !onPick ? colour : C.todo} style={{ transition: 'fill 0.5s' }} />
              </>
            ) : (
              <circle r={34} fill={n.kind === 'wrong' ? 'white' : colour} stroke={colour} strokeWidth={3} strokeDasharray={n.kind === 'wrong' ? '5 4' : undefined} style={{ transition: 'fill 0.5s, stroke 0.5s' }} />
            )}
            <g transform="scale(1.5)">
              <Glyph name={n.icon} color={n.kind === 'decision' || n.kind === 'wrong' ? colour : 'white'} />
            </g>
            {lines.map((l, i) => (
              <text key={i} x={n.kind === 'wrong' ? 0 : n.kind === 'decision' ? -64 : 62} y={n.kind === 'wrong' ? 56 + i * 16 : (i - (lines.length - 1) / 2) * 17 + 5} textAnchor={n.kind === 'wrong' ? 'middle' : n.kind === 'decision' ? 'end' : 'start'} fontSize={14} fontWeight={now ? 700 : 600} fill={INK}>
                {l}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}
