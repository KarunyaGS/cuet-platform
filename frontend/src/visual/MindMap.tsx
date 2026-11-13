/** The interactive mind map: fold and open branches, tap an idea to read it, zoom, drag, fit to screen, or use the list view. */
import { ListTree, Maximize, Minus, Network, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { DisplayMath, Rich } from '../rich';
import { Glyph } from './art';
import { FORMULAS, SOURCE, type MapNode } from './gravitation';
import { flatten, layoutMap, MapDrawing } from './mapdraw';

export function IdeaCard({ node, color, onStep }: { node: MapNode; color: string; onStep?: (step: string) => void }) {
  const f = node.formula ? FORMULAS[node.formula] : null;
  return (
    <div className="rounded-lg border border-rule bg-surface p-4" data-idea={node.id} aria-live="polite">
      <div className="flex items-center gap-2.5">
        <svg viewBox="-16 -16 32 32" className="size-9 shrink-0" aria-hidden>
          <rect x={-15} y={-15} width={30} height={30} rx={5} fill="white" stroke={color} strokeWidth={1.3} />
          <Glyph name={node.icon} color={color} />
        </svg>
        <h3 className="text-base font-semibold text-ink">{node.label}</h3>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        <Rich text={node.text} inline />
      </p>
      {f && (
        <div className="mt-3 rounded-lg bg-paper px-3 py-2">
          <DisplayMath tex={f.latex} />
          <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
            {f.symbols.map((s) => (
              <li key={s.sym}>
                <span className="font-medium text-ink">
                  <InlineTex tex={s.sym} />
                </span>
                : <Rich text={s.means} inline />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-3">
        <span>
          Source: {SOURCE.publisher} Class XI Physics, section {node.src.section}, page {node.src.page}
        </span>
        {node.step && onStep && (
          <button type="button" onClick={() => onStep(node.step!)} className="font-medium text-accent hover:underline" data-go-step={node.step}>
            Go to that step
          </button>
        )}
      </div>
    </div>
  );
}

/** A symbol such as m_1 set as mathematics, inline. */
export function InlineTex({ tex }: { tex: string }) {
  return <Rich text={`$${tex}$`} inline />;
}

interface View { x: number; y: number; k: number }

export function MindMap({ root, onStep, startOpen = true }: { root: MapNode; onStep?: (step: string) => void; startOpen?: boolean }) {
  const all = useMemo(() => flatten(root), [root]);
  const [closed, setClosed] = useState<Set<string>>(() => new Set(startOpen ? [] : (root.children ?? []).map((b) => b.id)));
  const [selected, setSelected] = useState<string>(root.id);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const layout = useMemo(() => layoutMap(root, closed), [root, closed]);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean; pinch?: number; k0: number } | null>(null);
  const box = layout.box;
  // Whenever what is showing changes, bring the whole map back into view.
  useEffect(() => setView({ x: 0, y: 0, k: 1 }), [closed]);

  const toggle = (id: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.min(3, Math.max(0.5, v.k * factor)) }));
  const scale = () => (svg.current ? box.w / svg.current.clientWidth : 1);

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, k0: view.k, pinch: pts.length === 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : undefined };
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && d.pinch) {
      const now = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      d.moved = true;
      setView((v) => ({ ...v, k: Math.min(3, Math.max(0.5, d.k0 * (now / d.pinch!))) }));
      return;
    }
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    const s = scale() / view.k;
    setView((v) => ({ ...v, x: d.vx - dx * s, y: d.vy - dy * s }));
  };
  const up = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setTimeout(() => (drag.current = null), 0);
  };
  // A drag must not count as a tap on the idea under the finger.
  const pick = (id: string) => {
    if (drag.current?.moved) return;
    setSelected(id);
  };
  const flip = (id: string) => {
    if (drag.current?.moved) return;
    toggle(id);
  };

  const w = box.w / view.k;
  const h = box.h / view.k;
  const vb = `${box.x + (box.w - w) / 2 + view.x} ${box.y + (box.h - h) / 2 + view.y} ${w} ${h}`;
  const sel = all.find((a) => a.node.id === selected) ?? all[0]!;
  const tool = 'grid size-9 place-items-center rounded-lg bg-surface text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper hover:text-ink [&>svg]:size-4';

  return (
    <div data-mind-map data-mode={mode}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="How to show the ideas" className="inline-flex gap-1 rounded-lg bg-ink/5 p-1">
          {([['map', 'Map', <Network key="m" aria-hidden className="size-4" />], ['list', 'List', <ListTree key="l" aria-hidden className="size-4" />]] as const).map(([m, label, icon]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium ${mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
              {icon}
              {label}
            </button>
          ))}
        </div>
        {mode === 'map' && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Map controls">
            <button type="button" onClick={() => setClosed(new Set())} className="h-9 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper" data-map-open-all>
              Open all
            </button>
            <button type="button" onClick={() => setClosed(new Set((root.children ?? []).filter((b) => b.children?.length).map((b) => b.id)))} className="h-9 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper" data-map-fold-all>
              Fold all
            </button>
            <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Zoom out" className={tool} data-map-zoom="out">
              <Minus aria-hidden />
            </button>
            <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in" className={tool} data-map-zoom="in">
              <Plus aria-hidden />
            </button>
            <button type="button" onClick={() => setView({ x: 0, y: 0, k: 1 })} aria-label="Fit the map to the screen" title="Fit to screen" className={tool} data-map-fit>
              <Maximize aria-hidden />
            </button>
          </div>
        )}
      </div>

      {mode === 'map' ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-white">
          <svg
            ref={svg}
            viewBox={vb}
            data-map-svg
            data-zoom={view.k.toFixed(2)}
            className="block w-full select-none"
            style={{ aspectRatio: `${box.w} / ${box.h}`, maxHeight: '70vh', touchAction: 'none', cursor: 'grab' }}
            role="group"
            aria-label={`Mind map of ${root.label}. Drag to move, use the buttons to zoom.`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          >
            <MapDrawing nodes={layout.nodes} selected={selected} handlers={{ onPick: pick, onToggle: flip }} />
          </svg>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule bg-surface" data-map-list>
          {all.map((a) => (
            <li key={a.node.id} className="border-t border-rule first:border-t-0">
              <button type="button" onClick={() => setSelected(a.node.id)} aria-pressed={selected === a.node.id} className={`flex w-full items-center gap-2.5 py-2.5 pr-4 text-left hover:bg-paper ${selected === a.node.id ? 'bg-accent-soft' : ''}`} style={{ paddingLeft: 16 + a.depth * 22 }}>
                <svg viewBox="-16 -16 32 32" className="size-7 shrink-0" aria-hidden>
                  <rect x={-15} y={-15} width={30} height={30} rx={5} fill="white" stroke={a.color} strokeWidth={1.3} />
                  <Glyph name={a.node.icon} color={a.color} />
                </svg>
                <span className={`text-[15px] text-ink ${a.depth < 2 ? 'font-semibold' : ''}`}>{a.node.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-3">{mode === 'map' ? 'Tap an idea to read it. Tap − or + on a branch to fold or open it. Drag to move the map.' : 'The same ideas as a list. Tap one to read it.'}</p>
      <div className="mt-3">
        <IdeaCard node={sel.node} color={sel.color} onStep={onStep} />
      </div>
    </div>
  );
}
