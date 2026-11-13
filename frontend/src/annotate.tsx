/**
 * Highlights and annotations on learning content.
 *
 * `<Annotatable kind id>` wraps a piece of content (a lesson's body, one question). Inside it, every element marked
 * `data-annot-block="<key>"` is a block an annotation can sit on. Marks are drawn on one transparent layer over the
 * content: nothing is inserted into the text, so selection, scrolling and quiz buttons keep working, and the layer
 * takes pointer input only while a drawing tool is in use.
 *
 * Where a mark is, is stored relative to its block: a highlight as the exact text and its place in the block's text;
 * a drawing as points measured in fractions of the block's box. So marks follow their content when the page is
 * resized or reflowed. If the content has changed and a mark cannot be placed, it is kept and flagged, never moved
 * onto other text.
 */
import { ArrowUpRight, Circle, Eraser, Highlighter, Minus, MousePointer2, PenLine, Pencil, Redo2, Square, StickyNote, Trash2, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { api, type Annotation, type AnnotationKind } from './api';
import { useAuth } from './ui';

type Tool = 'off' | 'select' | 'highlight' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'note' | 'eraser';
type Pt = [number, number];
interface HighlightData { start: number; end: number; before: string; after: string }
interface ShapeData { pts: Pt[] }

export const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];
export const INK_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#111827', '#f59e0b', '#a855f7'];
export const KIND_LABEL: Record<AnnotationKind, string> = { HIGHLIGHT: 'Highlight', PEN: 'Pen', RECT: 'Rectangle', ELLIPSE: 'Circle', ARROW: 'Arrow', LINE: 'Line', NOTE: 'Note' };
const newId = () => `an_${crypto.randomUUID().replace(/-/g, '')}`;

/** A stable key for a content block, made from its own content (lesson blocks have no id that survives a re-import). */
export function blockKey(type: string, body: string, seen: Map<string, number>): string {
  let h1 = 0xdeadbeef ^ type.length;
  let h2 = 0x41c6ce57 ^ body.length;
  const s = `${type}|${body}`;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const base = `b-${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

// ------------------------------------------------------------------ text ranges

/** The range covering characters [start, end) of a block's text. */
function rangeAt(block: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let at = 0;
  let begun = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n as Text).data.length;
    if (!begun && start < at + len) {
      range.setStart(n, start - at);
      begun = true;
    }
    if (begun && end <= at + len) {
      range.setEnd(n, end - at);
      return range;
    }
    at += len;
  }
  return null;
}

function offsetIn(block: Element, node: Node, offset: number): number {
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(node, offset);
  return pre.toString().length;
}

/** Splits a range into one piece per block it touches: the exact text and where it is in that block. */
function piecesOf(range: Range, blocks: Map<string, HTMLElement>): { key: string; data: HighlightData; quote: string }[] {
  const out: { key: string; data: HighlightData; quote: string }[] = [];
  for (const [key, block] of blocks) {
    if (!range.intersectsNode(block)) continue;
    const r = range.cloneRange();
    if (!block.contains(r.startContainer)) r.setStart(block, 0);
    if (!block.contains(r.endContainer)) r.setEnd(block, block.childNodes.length);
    const quote = r.toString();
    if (!quote.trim()) continue;
    const start = offsetIn(block, r.startContainer, r.startOffset);
    const end = start + quote.length;
    const full = block.textContent ?? '';
    out.push({ key, quote, data: { start, end, before: full.slice(Math.max(0, start - 30), start), after: full.slice(end, end + 30) } });
  }
  return out;
}

/** Where a saved highlight is now. `moved` is set when it was found again at another place. null: it cannot be placed. */
function findHighlight(a: Annotation, blocks: Map<string, HTMLElement>): { range: Range; moved?: { blockKey: string; data: HighlightData } } | null {
  const d = a.data as HighlightData;
  const quote = a.quote ?? '';
  if (!quote) return null;
  const block = blocks.get(a.blockKey);
  if (block) {
    const text = block.textContent ?? '';
    if (text.slice(d.start, d.end) === quote) {
      const range = rangeAt(block, d.start, d.end);
      if (range) return { range };
    }
    // The block's text shifted: the same words, with the same words around them.
    const hits: number[] = [];
    for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) hits.push(i);
    const fits = hits.filter((i) => text.slice(Math.max(0, i - d.before.length), i) === d.before && text.slice(i + quote.length, i + quote.length + d.after.length) === d.after);
    const at = fits.length === 1 ? fits[0] : hits.length === 1 ? hits[0] : undefined;
    if (at !== undefined) {
      const range = rangeAt(block, at, at + quote.length);
      if (range) return { range, moved: { blockKey: a.blockKey, data: { ...d, start: at, end: at + quote.length } } };
    }
  }
  // The block was rewritten or replaced: accept only if these exact words appear once in the whole content.
  if (quote.trim().length < 12) return null;
  let found: { key: string; el: HTMLElement; at: number } | null = null;
  let count = 0;
  for (const [key, el] of blocks) {
    const text = el.textContent ?? '';
    for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) {
      count++;
      found = { key, el, at: i };
    }
  }
  if (count !== 1 || !found) return null;
  const range = rangeAt(found.el, found.at, found.at + quote.length);
  const text = found.el.textContent ?? '';
  return range ? { range, moved: { blockKey: found.key, data: { start: found.at, end: found.at + quote.length, before: text.slice(Math.max(0, found.at - 30), found.at), after: text.slice(found.at + quote.length, found.at + quote.length + 30) } } } : null;
}

interface Box { x: number; y: number; w: number; h: number }

/** The boxes a range covers, relative to the wrapper: one per line, with overlaps (nested inline elements, maths) joined. */
function boxesOf(range: Range, origin: DOMRect): Box[] {
  const raw = [...range.getClientRects()].filter((r) => r.width > 1.5 && r.height > 4).map((r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }));
  raw.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Box[][] = [];
  for (const r of raw) {
    const row = rows.find((g) => {
      const top = Math.max(g[0]!.y, r.y);
      const bottom = Math.min(g[0]!.y + g[0]!.h, r.y + r.h);
      return bottom - top > Math.min(g[0]!.h, r.h) * 0.5;
    });
    if (row) row.push(r);
    else rows.push([r]);
  }
  const out: Box[] = [];
  for (const row of rows) {
    const y = Math.min(...row.map((r) => r.y));
    const bottom = Math.max(...row.map((r) => r.y + r.h));
    row.sort((a, b) => a.x - b.x);
    let cur: Box | null = null;
    for (const r of row) {
      if (cur && r.x <= cur.x + cur.w + 2) cur.w = Math.max(cur.x + cur.w, r.x + r.w) - cur.x;
      else {
        if (cur) out.push(cur);
        cur = { x: r.x, y, w: r.w, h: bottom - y };
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** The text position under a screen point, looking through the drawing layer. */
function caretAt(x: number, y: number, layer: SVGSVGElement | null): { node: Node; offset: number } | null {
  const prev = layer?.style.pointerEvents ?? '';
  if (layer) layer.style.pointerEvents = 'none';
  try {
    const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
    if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(x, y);
      if (p) return { node: p.offsetNode, offset: p.offset };
    }
    const r = doc.caretRangeFromPoint?.(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  } finally {
    if (layer) layer.style.pointerEvents = prev;
  }
}

// ------------------------------------------------------------------ shapes

const bbox = (pts: Pt[]): Box => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

function ShapeView({ kind, pts, color, width, opacity }: { kind: AnnotationKind; pts: Pt[]; color: string; width: number; opacity: number }) {
  if (!pts.length) return null;
  const common = { stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, opacity };
  if (kind === 'PEN') return <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + (pts.length === 1 ? ` l0.1 0` : '')} {...common} />;
  const [a, b] = [pts[0]!, pts[pts.length - 1]!];
  if (kind === 'RECT') {
    const r = bbox([a, b]);
    return <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} {...common} />;
  }
  if (kind === 'ELLIPSE') {
    const r = bbox([a, b]);
    return <ellipse cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} {...common} />;
  }
  if (kind === 'LINE') return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} />;
  // ARROW
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = Math.max(9, width * 3.2);
  const head = [-0.45, 0.45].map((t) => `${(b[0] - len * Math.cos(ang + t)).toFixed(1)},${(b[1] - len * Math.sin(ang + t)).toFixed(1)}`);
  return (
    <g opacity={opacity}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} opacity={1} />
      <polyline points={`${head[0]} ${b[0].toFixed(1)},${b[1].toFixed(1)} ${head[1]}`} {...common} opacity={1} />
    </g>
  );
}

// ------------------------------------------------------------------ the wrapper

const persisted = (a: Annotation) => JSON.stringify([a.kind, a.blockKey, a.data, a.quote, a.note, a.color, a.opacity, a.strokeWidth, a.z, a.orphaned]);

interface Drag {
  mode: 'draw' | 'move' | 'resize' | 'erase' | 'mark';
  id?: string;
  handle?: number;
  start: Pt;
  from?: Pt[];
  box?: Box;
  caret?: { node: Node; offset: number } | null;
  moved: boolean;
}

/**
 * Makes its children annotatable. `preload`: annotations already fetched by the page (a results page loads those of
 * all its questions in one request); undefined means "fetch them here". `strict`: the whole content is always shown
 * (a lesson), so a mark whose block is gone is flagged; for a question, parts appear later (the explanation), so a
 * missing block only means "not shown now".
 */
export function Annotatable({ kind, id, children, preload, strict = kind === 'LESSON', className = '' }: { kind: 'LESSON' | 'QUESTION'; id: string; children: ReactNode; preload?: Annotation[] | null; strict?: boolean; className?: string }) {
  const { user } = useAuth();
  if (!user) return <div className={className}>{children}</div>;
  return (
    <Layer kind={kind} id={id} preload={preload} strict={strict} className={className}>
      {children}
    </Layer>
  );
}

function Layer({ kind, id, children, preload, strict, className }: { kind: 'LESSON' | 'QUESTION'; id: string; children: ReactNode; preload?: Annotation[] | null; strict: boolean; className: string }) {
  const location = useLocation();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [items, setItems] = useState<Annotation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>('off');
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0]!);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]!);
  const [width, setWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; kind: AnnotationKind; pts: Pt[] } | null>(null);
  const [mark, setMark] = useState<Box[] | null>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; id?: string; range?: Range } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [tick, setTick] = useState(0);
  const past = useRef<Annotation[][]>([]);
  const future = useRef<Annotation[][]>([]);
  const [, setHist] = useState(0);
  const saved = useRef<Map<string, string>>(new Map());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const drag = useRef<Drag | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originPath = `${location.pathname}${location.search}`;

  // ---- load
  useEffect(() => {
    let live = true;
    const take = (list: Annotation[]) => {
      if (!live) return;
      saved.current = new Map(list.map((a) => [a.id, persisted(a)]));
      past.current = [];
      future.current = [];
      setItems(list);
      setLoaded(true);
    };
    if (preload !== undefined) {
      if (preload) take(preload);
    } else api.annotations(kind, id).then(take, () => live && setLoaded(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, preload === undefined ? 'fetch' : preload === null ? 'wait' : preload.map((a) => `${a.id}@${a.updatedAt}`).join(',')]);

  // ---- save: one batched request a short while after the last change
  const flush = useCallback(
    async (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const now = itemsRef.current;
      const ups = now.filter((a) => saved.current.get(a.id) !== persisted(a));
      const ids = new Set(now.map((a) => a.id));
      const dels = [...saved.current.keys()].filter((k) => !ids.has(k));
      if (!ups.length && !dels.length) return;
      const body = { surfaceKind: kind, surfaceId: id, originPath, upserts: ups.map((a) => ({ id: a.id, kind: a.kind, blockKey: a.blockKey, data: a.data, quote: a.quote, note: a.note, color: a.color, opacity: a.opacity, strokeWidth: a.strokeWidth, z: a.z, orphaned: a.orphaned })), deletes: dels };
      const snapshot = new Map(now.map((a) => [a.id, persisted(a)]));
      if (keepalive) {
        // Leaving the page: the request must outlive it.
        void fetch('/api/student/annotations', { method: 'PUT', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
        saved.current = snapshot;
        return;
      }
      setStatus('saving');
      try {
        await api.saveAnnotations(body);
        saved.current = snapshot;
        setStatus(itemsRef.current.every((a) => snapshot.get(a.id) === persisted(a)) && itemsRef.current.length === snapshot.size ? 'saved' : 'saving');
      } catch {
        setStatus('error');
      }
    },
    [kind, id, originPath],
  );
  useEffect(() => {
    if (!loaded) return;
    const dirty = items.length !== saved.current.size || items.some((a) => saved.current.get(a.id) !== persisted(a));
    if (!dirty) return;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  }, [items, loaded, flush]);
  useEffect(() => {
    const leave = () => void flush(true);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      void flush(true);
    };
  }, [flush]);

  // ---- history
  const commit = useCallback((next: Annotation[]) => {
    past.current = [...past.current.slice(-49), itemsRef.current];
    future.current = [];
    setItems(next);
    setHist((n) => n + 1);
  }, []);
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(itemsRef.current);
    setItems(prev);
    setSelected(null);
    setHist((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(itemsRef.current);
    setItems(next);
    setSelected(null);
    setHist((n) => n + 1);
  };
  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      commit(itemsRef.current.filter((a) => !ids.includes(a.id)));
      setSelected(null);
      setPopup(null);
      setNoteFor(null);
    },
    [commit],
  );
  const change = useCallback((aid: string, patch: Partial<Annotation>) => commit(itemsRef.current.map((a) => (a.id === aid ? { ...a, ...patch } : a))), [commit]);
  const nextZ = () => itemsRef.current.reduce((m, a) => Math.max(m, a.z), 0) + 1;
  const make = (k: AnnotationKind, key: string, data: unknown, extra: Partial<Annotation> = {}): Annotation => {
    const now = new Date().toISOString();
    return { id: newId(), surfaceKind: kind, surfaceId: id, kind: k, blockKey: key, data, quote: null, note: null, color: k === 'HIGHLIGHT' ? hlColor : inkColor, opacity: k === 'HIGHLIGHT' ? 0.45 : opacity, strokeWidth: width, z: nextZ(), orphaned: false, originPath, createdAt: now, updatedAt: now, ...extra };
  };

  // ---- layout: blocks, and where every mark is now
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((n) => n + 1));
    };
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    const mo = new MutationObserver((list) => list.some((m) => !(m.target as Element).closest?.('[data-annot-ui]')) && bump());
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    void document.fonts?.ready.then(bump);
    window.addEventListener('resize', bump);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', bump);
      cancelAnimationFrame(raf);
    };
  }, []);

  const [geo, setGeo] = useState<{ size: { w: number; h: number }; blocks: Map<string, Box>; hl: Map<string, Box[]>; missing: Set<string> }>({ size: { w: 0, h: 0 }, blocks: new Map(), hl: new Map(), missing: new Set() });
  const blockEls = useCallback(() => {
    const m = new Map<string, HTMLElement>();
    for (const el of wrap.current?.querySelectorAll<HTMLElement>('[data-annot-block]') ?? []) if (!m.has(el.dataset.annotBlock!)) m.set(el.dataset.annotBlock!, el);
    return m;
  }, []);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el || !loaded) return;
    const origin = el.getBoundingClientRect();
    const els = blockEls();
    const blocks = new Map<string, Box>();
    for (const [k, b] of els) {
      const r = b.getBoundingClientRect();
      blocks.set(k, { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
    }
    const hl = new Map<string, Box[]>();
    const missing = new Set<string>();
    const fixes = new Map<string, Partial<Annotation>>();
    for (const a of items) {
      if (a.kind === 'HIGHLIGHT') {
        const found = els.size ? findHighlight(a, els) : null;
        if (found) {
          hl.set(a.id, boxesOf(found.range, origin));
          if (found.moved) fixes.set(a.id, { blockKey: found.moved.blockKey, data: found.moved.data, orphaned: false });
          else if (a.orphaned) fixes.set(a.id, { orphaned: false });
        } else {
          missing.add(a.id);
          // Flag it only when the content is all here and the words are really gone. A block with a closed part (a
          // worked solution not yet opened) is not all here: its highlight is simply not shown until it is opened.
          const own = els.get(a.blockKey);
          const closedPart = Boolean(own?.querySelector('[aria-expanded="false"]'));
          if (els.size && (strict || own) && !closedPart && !a.orphaned) fixes.set(a.id, { orphaned: true });
        }
      } else if (!blocks.has(a.blockKey)) {
        missing.add(a.id);
        if (els.size && strict && !a.orphaned) fixes.set(a.id, { orphaned: true });
      } else if (a.orphaned) fixes.set(a.id, { orphaned: false });
    }
    setGeo({ size: { w: el.clientWidth, h: el.clientHeight }, blocks, hl, missing });
    // Re-anchoring and flags are bookkeeping, not something to undo.
    if (fixes.size) setItems((list) => list.map((a) => (fixes.has(a.id) ? { ...a, ...fixes.get(a.id) } : a)));
  }, [items, tick, loaded, strict, blockEls]);

  const toPx = useCallback((a: { blockKey: string; data: unknown }): Pt[] => {
    const b = geo.blocks.get(a.blockKey);
    if (!b) return [];
    return ((a.data as ShapeData).pts ?? []).map(([fx, fy]) => [b.x + fx * b.w, b.y + fy * b.h] as Pt);
  }, [geo.blocks]);
  /** The block a shape belongs to: the one under its first point, or the nearest one above or below. */
  const anchor = (pts: Pt[]): { key: string; pts: Pt[] } | null => {
    let best: { key: string; d: number } | null = null;
    const [x, y] = pts[0]!;
    for (const [k, b] of geo.blocks) {
      if (b.w < 1 || b.h < 1) continue;
      const inside = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      const d = inside ? -1 / (b.w * b.h + 1) : Math.max(b.y - y, y - (b.y + b.h), 0) + Math.max(b.x - x, x - (b.x + b.w), 0);
      if (!best || d < best.d) best = { key: k, d };
    }
    if (!best) return null;
    const b = geo.blocks.get(best.key)!;
    const r4 = (n: number) => Math.round(n * 10000) / 10000;
    return { key: best.key, pts: pts.map(([px, py]) => [r4((px - b.x) / b.w), r4((py - b.y) / b.h)] as Pt) };
  };

  // ---- pointer work on the layer
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const o = wrap.current!.getBoundingClientRect();
    return [e.clientX - o.left, e.clientY - o.top];
  };
  const drawing = tool === 'pen' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow' || tool === 'line' || tool === 'note';
  const DRAW_KIND: Record<string, AnnotationKind> = { pen: 'PEN', rect: 'RECT', ellipse: 'ELLIPSE', arrow: 'ARROW', line: 'LINE', note: 'NOTE' };

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = local(e);
    const target = e.target as Element;
    const hit = target.closest('[data-annot-id]')?.getAttribute('data-annot-id') ?? null;
    setPopup(null);
    if (tool === 'eraser') {
      drag.current = { mode: 'erase', start: p, moved: false };
      if (hit) remove([hit]);
    } else if (tool === 'highlight') {
      drag.current = { mode: 'mark', start: p, caret: caretAt(e.clientX, e.clientY, svg.current), moved: false };
    } else if (tool === 'select') {
      const handle = target.getAttribute('data-handle');
      if (handle !== null && selected) {
        const a = itemsRef.current.find((x) => x.id === selected)!;
        const from = toPx(a);
        drag.current = { mode: 'resize', id: selected, handle: Number(handle), start: p, from, box: bbox(from), moved: false };
      } else if (hit) {
        setSelected(hit);
        const a = itemsRef.current.find((x) => x.id === hit)!;
        if (a.kind !== 'HIGHLIGHT') drag.current = { mode: 'move', id: hit, start: p, from: toPx(a), moved: false };
        else return;
      } else {
        setSelected(null);
        return;
      }
    } else if (drawing) {
      drag.current = { mode: 'draw', start: p, moved: false };
      setDraft({ kind: DRAW_KIND[tool]!, pts: [p] });
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = local(e);
    if (Math.hypot(p[0] - d.start[0], p[1] - d.start[1]) > 3) d.moved = true;
    if (d.mode === 'erase') {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-annot-id]');
      const hit = el?.getAttribute('data-annot-id');
      if (hit && itemsRef.current.some((a) => a.id === hit)) remove([hit]);
    } else if (d.mode === 'mark') {
      const end = caretAt(e.clientX, e.clientY, svg.current);
      if (d.caret && end && wrap.current) {
        const r = document.createRange();
        try {
          r.setStart(d.caret.node, d.caret.offset);
          r.setEnd(end.node, end.offset);
          if (r.collapsed) {
            r.setStart(end.node, end.offset);
            r.setEnd(d.caret.node, d.caret.offset);
          }
          setMark(boxesOf(r, wrap.current.getBoundingClientRect()));
        } catch {
          /* a point outside any text */
        }
      }
    } else if (d.mode === 'draw') {
      setDraft((cur) => {
        if (!cur) return cur;
        if (cur.kind === 'PEN') {
          const last = cur.pts[cur.pts.length - 1]!;
          return Math.hypot(p[0] - last[0], p[1] - last[1]) < 2 ? cur : { ...cur, pts: [...cur.pts, p] };
        }
        return cur.kind === 'NOTE' ? cur : { ...cur, pts: [cur.pts[0]!, p] };
      });
    } else if (d.mode === 'move' && d.from && d.moved) {
      const a = itemsRef.current.find((x) => x.id === d.id)!;
      setDraft({ id: d.id, kind: a.kind, pts: d.from.map(([x, y]) => [x + p[0] - d.start[0], y + p[1] - d.start[1]] as Pt) });
    } else if (d.mode === 'resize' && d.from && d.box) {
      const a = itemsRef.current.find((x) => x.id === d.id)!;
      if (a.kind === 'LINE' || a.kind === 'ARROW') setDraft({ id: d.id, kind: a.kind, pts: d.from.map((pt, i) => (i === (d.handle === 0 ? 0 : d.from!.length - 1) ? p : pt)) });
      else {
        // The corner opposite the handle stays; every point scales with the box.
        const b = d.box;
        const fx = d.handle === 0 || d.handle === 3 ? b.x + b.w : b.x;
        const fy = d.handle === 0 || d.handle === 1 ? b.y + b.h : b.y;
        const ox = d.handle === 0 || d.handle === 3 ? b.x : b.x + b.w;
        const oy = d.handle === 0 || d.handle === 1 ? b.y : b.y + b.h;
        const sx = b.w > 1 ? (p[0] - fx) / (ox - fx) : 1;
        const sy = b.h > 1 ? (p[1] - fy) / (oy - fy) : 1;
        setDraft({ id: d.id, kind: a.kind, pts: d.from.map(([x, y]) => [fx + (x - fx) * sx, fy + (y - fy) * sy] as Pt) });
      }
    }
  };

  const up = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (d.mode === 'mark') {
      setMark(null);
      const end = caretAt(e.clientX, e.clientY, svg.current);
      if (d.caret && end && d.moved) {
        const r = document.createRange();
        try {
          r.setStart(d.caret.node, d.caret.offset);
          r.setEnd(end.node, end.offset);
          if (r.collapsed) {
            r.setStart(end.node, end.offset);
            r.setEnd(d.caret.node, d.caret.offset);
          }
          addHighlight(r, hlColor);
        } catch {
          /* nothing to mark */
        }
      }
    } else if (d.mode === 'draw' && draft) {
      const pts = draft.kind === 'NOTE' ? [draft.pts[0]!] : draft.pts;
      const big = draft.kind === 'NOTE' || draft.kind === 'PEN' ? true : Math.hypot(pts[pts.length - 1]![0] - pts[0]![0], pts[pts.length - 1]![1] - pts[0]![1]) > 6;
      const at = big ? anchor(pts) : null;
      if (at) {
        const a = make(draft.kind, at.key, { pts: at.pts }, draft.kind === 'NOTE' ? { opacity: 1 } : {});
        commit([...itemsRef.current, a]);
        if (draft.kind === 'NOTE') {
          setNoteFor(a.id);
          setTool('select');
        }
        setSelected(a.id);
      }
    } else if ((d.mode === 'move' || d.mode === 'resize') && draft && d.moved) {
      const at = anchor(draft.pts);
      if (at) change(d.id!, { blockKey: at.key, data: { pts: at.pts }, orphaned: false });
    }
    setDraft(null);
  };

  // ---- highlights from a text range
  const addHighlight = (range: Range, color: string, withNote = false) => {
    const pieces = piecesOf(range, blockEls());
    if (!pieces.length) return;
    const z = nextZ();
    const made = pieces.map((p, i) => make('HIGHLIGHT', p.key, p.data, { quote: p.quote, color, z: z + i }));
    commit([...itemsRef.current, ...made]);
    window.getSelection()?.removeAllRanges();
    setPopup(null);
    if (withNote) setNoteFor(made[0]!.id);
  };

  // ---- with the tool off: selecting text offers the colours; clicking a highlight or a note opens it
  useEffect(() => {
    const el = wrap.current;
    if (!el || tool !== 'off') return;
    const offer = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer) && !range.intersectsNode(el)) return;
      const anchorEl = (range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement) ?? null;
      if (anchorEl?.closest('[data-annot-ui], input, textarea')) return;
      if (!piecesOf(range, blockEls()).length) return;
      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return;
      const o = el.getBoundingClientRect();
      setPopup({ x: Math.min(Math.max(last.right - o.left, 90), o.width - 90), y: last.bottom - o.top + 6, range: range.cloneRange() });
    };
    const onUp = () => setTimeout(offer, 10);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest('[data-annot-ui], button, a, input, select, textarea, label, [role=radio], [role=checkbox]')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const o = el.getBoundingClientRect();
      const x = e.clientX - o.left;
      const y = e.clientY - o.top;
      const hit = [...itemsRef.current].reverse().find((a) => a.kind === 'HIGHLIGHT' && (geoRef.current.hl.get(a.id) ?? []).some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h));
      setPopup(hit ? { x: Math.min(Math.max(x, 90), o.width - 90), y: y + 14, id: hit.id } : null);
    };
    el.addEventListener('mouseup', onUp);
    el.addEventListener('touchend', onUp);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('click', onClick);
    };
  }, [tool, blockEls]);
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // ---- keys
  useEffect(() => {
    if (tool === 'off') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        remove([selected]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') setTool('off');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, selected, remove]);

  // ---- arriving from My bookmarks: go to that mark
  const wanted = location.hash.startsWith('#annot-') ? location.hash.slice(7) : null;
  const arrived = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || arrived.current === wanted || !items.some((a) => a.id === wanted)) return;
    const a = items.find((x) => x.id === wanted)!;
    const box = a.kind === 'HIGHLIGHT' ? geo.hl.get(a.id)?.[0] : geo.blocks.has(a.blockKey) ? bbox(toPx(a)) : undefined;
    if (!box || !wrap.current) return;
    arrived.current = wanted;
    const top = wrap.current.getBoundingClientRect().top + window.scrollY + box.y - window.innerHeight / 3;
    window.scrollTo({ top: Math.max(0, top) });
    setSelected(wanted);
    if (a.kind === 'NOTE' || a.note) setNoteFor(wanted);
  }, [wanted, items, geo, toPx]);

  const sel = items.find((a) => a.id === selected) ?? null;
  const orphans = items.filter((a) => a.orphaned).length;
  const applyColor = (c: string) => {
    if (sel) return change(sel.id, { color: c });
    if (tool === 'highlight') setHlColor(c);
    else setInkColor(c);
  };
  const palette = tool === 'highlight' || sel?.kind === 'HIGHLIGHT' ? HIGHLIGHT_COLORS : INK_COLORS;
  const activeColor = sel ? sel.color : tool === 'highlight' ? hlColor : inkColor;
  const TOOLS: { t: Tool; label: string; icon: ReactNode }[] = [
    { t: 'select', label: 'Select, move and resize', icon: <MousePointer2 aria-hidden /> },
    { t: 'highlight', label: 'Highlighter', icon: <Highlighter aria-hidden /> },
    { t: 'pen', label: 'Pen', icon: <PenLine aria-hidden /> },
    { t: 'rect', label: 'Rectangle', icon: <Square aria-hidden /> },
    { t: 'ellipse', label: 'Circle', icon: <Circle aria-hidden /> },
    { t: 'arrow', label: 'Arrow', icon: <ArrowUpRight aria-hidden /> },
    { t: 'line', label: 'Line', icon: <Minus aria-hidden /> },
    { t: 'note', label: 'Note', icon: <StickyNote aria-hidden /> },
    { t: 'eraser', label: 'Eraser', icon: <Eraser aria-hidden /> },
  ];
  const btn = (on: boolean) => `grid size-8 shrink-0 place-items-center rounded-md [&>svg]:size-4 ${on ? 'bg-accent text-white' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'} disabled:opacity-40`;
  const layerOn = tool !== 'off' && tool !== 'select';
  const noteItem = items.find((a) => a.id === noteFor) ?? null;
  const noteAt = noteItem ? (noteItem.kind === 'HIGHLIGHT' ? geo.hl.get(noteItem.id)?.slice(-1)[0] : geo.blocks.has(noteItem.blockKey) ? bbox(toPx(noteItem)) : undefined) : undefined;
  const sorted = useMemo(() => [...items].sort((a, b) => a.z - b.z), [items]);

  return (
    <div className={className} data-annot-surface={`${kind}:${id}`} data-annot-tool={tool} data-annot-count={items.length} data-annot-status={status}>
      <div data-annot-ui className={`z-30 mb-2 flex flex-wrap items-center gap-1.5 ${tool === 'off' ? 'justify-end' : 'sticky top-16 rounded-xl border border-rule bg-surface p-1.5 shadow-md shadow-ink/5'}`}>
        {tool === 'off' ? (
          <>
            <span role="status" className="text-xs text-ink-3" data-annot-save>
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? '' : items.length ? `${items.length} ${items.length === 1 ? 'annotation' : 'annotations'}` : ''}
            </span>
            {status === 'error' && (
              <button type="button" onClick={() => void flush()} className="text-xs font-medium text-wrong underline">
                Not saved. Try again
              </button>
            )}
            <button type="button" onClick={() => (setTool('highlight'), setPopup(null))} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[13px] font-medium text-ink-2 ring-1 ring-inset ring-rule-strong hover:bg-paper hover:text-ink" data-annot-open>
              <Pencil aria-hidden className="size-4" />
              Annotate
            </button>
          </>
        ) : (
          <>
            <div role="toolbar" aria-label="Annotation tools" className="flex flex-wrap items-center gap-0.5">
              {TOOLS.map((x) => (
                <button key={x.t} type="button" title={x.label} aria-label={x.label} aria-pressed={tool === x.t} data-tool={x.t} onClick={() => (setTool(x.t), x.t !== 'select' && setSelected(null), setNoteFor(null))} className={btn(tool === x.t)}>
                  {x.icon}
                </button>
              ))}
            </div>
            <span className="mx-1 h-6 w-px bg-rule" aria-hidden />
            <div role="group" aria-label="Colour" className="flex items-center gap-1">
              {palette.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={activeColor === c} data-color={c} onClick={() => applyColor(c)} className={`size-6 rounded-full ring-offset-1 ${activeColor === c ? 'ring-2 ring-ink' : 'ring-1 ring-rule-strong'}`} style={{ background: c }} />
              ))}
            </div>
            {/* Always shown, so the toolbar keeps one height and the content under it does not jump between tools. */}
            {(() => {
              const usable = sel ? sel.kind !== 'HIGHLIGHT' && sel.kind !== 'NOTE' : tool !== 'highlight' && tool !== 'eraser' && tool !== 'select' && tool !== 'note';
              return (
              <label className={`flex items-center gap-1 text-xs ${usable ? 'text-ink-2' : 'text-ink-3 opacity-50'}`}>
                Width
                <input type="range" min={1} max={14} step={1} disabled={!usable} value={sel ? sel.strokeWidth : width} data-prop="width" onChange={(e) => (sel ? change(sel.id, { strokeWidth: Number(e.target.value) }) : setWidth(Number(e.target.value)))} className="w-16" />
              </label>
              );
            })()}
            {(() => {
              const usable = sel ? sel.kind !== 'NOTE' : tool !== 'eraser' && tool !== 'select' && tool !== 'note' && tool !== 'highlight';
              return (
              <label className={`flex items-center gap-1 text-xs ${usable ? 'text-ink-2' : 'text-ink-3 opacity-50'}`}>
                Opacity
                <input type="range" min={0.2} max={1} step={0.1} disabled={!usable} value={sel ? sel.opacity : opacity} data-prop="opacity" onChange={(e) => (sel ? change(sel.id, { opacity: Number(e.target.value) }) : setOpacity(Number(e.target.value)))} className="w-16" />
              </label>
              );
            })()}
            <span className="mx-1 h-6 w-px bg-rule" aria-hidden />
            <button type="button" title="Undo" aria-label="Undo" data-act="undo" onClick={undo} disabled={!past.current.length} className={btn(false)}>
              <Undo2 aria-hidden />
            </button>
            <button type="button" title="Redo" aria-label="Redo" data-act="redo" onClick={redo} disabled={!future.current.length} className={btn(false)}>
              <Redo2 aria-hidden />
            </button>
            <button type="button" title="Delete selected" aria-label="Delete selected annotation" data-act="delete" onClick={() => sel && remove([sel.id])} disabled={!sel} className={btn(false)}>
              <Trash2 aria-hidden />
            </button>
            <button type="button" onClick={() => sel && setNoteFor(sel.id)} disabled={!sel || sel.kind === 'NOTE'} className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-ink/5 disabled:opacity-40">
              {sel?.note ? 'Edit note' : 'Add note'}
            </button>
            <span role="status" className="ml-auto text-xs text-ink-3" data-annot-save>
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Not saved' : ''}
            </span>
            {status === 'error' && (
              <button type="button" onClick={() => void flush()} className="text-xs font-medium text-wrong underline">
                Try again
              </button>
            )}
            <button type="button" onClick={() => (setTool('off'), setSelected(null), setNoteFor(null))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-[13px] font-medium text-white" data-annot-done>
              <X aria-hidden className="size-4" />
              Done
            </button>
          </>
        )}
      </div>
      {orphans > 0 && (
        <p data-annot-ui role="status" className="mb-3 rounded-lg border border-marker/30 bg-marker-soft px-3 py-2 text-sm text-ink" data-annot-orphans>
          {orphans} of your annotations could not be placed because this content has changed. {orphans === 1 ? 'It is' : 'They are'} kept in{' '}
          <Link to="/bookmarks?tab=notes" className="font-medium text-accent hover:underline">
            My bookmarks
          </Link>
          .
        </p>
      )}

      <div ref={wrap} className="relative" data-annot-wrap>
        {children}
        <svg
          ref={svg}
          data-annot-layer
          data-annot-ui
          width={geo.size.w}
          height={geo.size.h}
          className="absolute top-0 left-0 z-10 overflow-visible"
          style={{ pointerEvents: layerOn ? 'all' : 'none', touchAction: layerOn ? 'none' : 'auto', cursor: tool === 'eraser' ? 'cell' : tool === 'highlight' ? 'text' : layerOn ? 'crosshair' : 'default' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {sorted.map((a) => {
            const interactive = tool === 'select' || tool === 'eraser';
            if (a.kind === 'HIGHLIGHT') {
              const boxes = geo.hl.get(a.id);
              if (!boxes) return null;
              return (
                <g key={a.id} data-annot-id={a.id} data-annot-kind="HIGHLIGHT" data-color={a.color} style={{ opacity: a.opacity, mixBlendMode: 'multiply', pointerEvents: interactive ? 'all' : 'none', cursor: interactive ? 'pointer' : undefined }}>
                  {boxes.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={a.color} rx={2} />
                  ))}
                  {selected === a.id && boxes.map((b, i) => <rect key={`s${i}`} x={b.x - 1} y={b.y - 1} width={b.w + 2} height={b.h + 2} fill="none" stroke="#111827" strokeWidth={1} strokeDasharray="3 2" />)}
                </g>
              );
            }
            if (geo.missing.has(a.id)) return null;
            const pts = draft?.id === a.id ? draft.pts : toPx(a);
            if (!pts.length) return null;
            if (a.kind === 'NOTE') {
              const [x, y] = pts[0]!;
              return (
                <g key={a.id} data-annot-id={a.id} data-annot-kind="NOTE" data-color={a.color} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => tool !== 'eraser' && (setNoteFor(a.id), setSelected(a.id))}>
                  <rect x={x - 11} y={y - 11} width={22} height={22} rx={4} fill={a.color} stroke={selected === a.id ? '#111827' : 'white'} strokeWidth={1.5} />
                  <path d={`M${x - 5} ${y - 4}h10M${x - 5} ${y}h10M${x - 5} ${y + 4}h6`} stroke="white" strokeWidth={1.6} strokeLinecap="round" />
                </g>
              );
            }
            return (
              <g key={a.id} data-annot-id={a.id} data-annot-kind={a.kind} data-color={a.color} style={{ pointerEvents: interactive ? 'all' : 'none', cursor: tool === 'select' ? 'move' : undefined }}>
                <ShapeView kind={a.kind} pts={pts} color={a.color} width={a.strokeWidth} opacity={a.opacity} />
                {/* a wide, invisible copy, so thin lines are easy to pick */}
                {interactive && <ShapeView kind={a.kind === 'ARROW' ? 'LINE' : a.kind} pts={pts} color="transparent" width={Math.max(16, a.strokeWidth + 12)} opacity={1} />}
              </g>
            );
          })}
          {draft && !draft.id && draft.kind !== 'NOTE' && <ShapeView kind={draft.kind} pts={draft.pts} color={inkColor} width={width} opacity={opacity} />}
          {mark && (
            <g style={{ opacity: 0.45, mixBlendMode: 'multiply' }}>
              {mark.map((b, i) => (
                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={hlColor} rx={2} />
              ))}
            </g>
          )}
          {tool === 'select' &&
            sel &&
            sel.kind !== 'HIGHLIGHT' &&
            sel.kind !== 'NOTE' &&
            (() => {
              const pts = draft?.id === sel.id ? draft.pts : toPx(sel);
              if (!pts.length) return null;
              const b = bbox(pts);
              const ends = sel.kind === 'LINE' || sel.kind === 'ARROW';
              const handles: Pt[] = ends ? [pts[0]!, pts[pts.length - 1]!] : [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
              return (
                <g data-annot-handles>
                  {!ends && <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />}
                  {handles.map(([x, y], i) => (
                    <rect key={i} data-handle={i} x={x - 7} y={y - 7} width={14} height={14} rx={3} fill="white" stroke="#2563eb" strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: ends ? 'grab' : i % 2 ? 'nesw-resize' : 'nwse-resize' }} />
                  ))}
                </g>
              );
            })()}
        </svg>

        {popup && (
          <div data-annot-ui data-annot-popup role="dialog" aria-label={popup.id ? 'Highlight options' : 'Highlight this text'} className="absolute z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-rule bg-surface p-1.5 shadow-lg shadow-ink/10" style={{ left: popup.x, top: popup.y }}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight ${c}`}
                data-color={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (popup.id ? (change(popup.id, { color: c }), setPopup(null)) : popup.range && addHighlight(popup.range, c))}
                className="size-6 rounded-full ring-1 ring-rule-strong"
                style={{ background: c }}
              />
            ))}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (popup.id ? (setNoteFor(popup.id), setPopup(null)) : popup.range && addHighlight(popup.range, hlColor, true))} className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-ink/5" data-popup-note>
              Note
            </button>
            {popup.id && (
              <button type="button" onClick={() => remove([popup.id!])} aria-label="Remove highlight" className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-wrong-soft hover:text-wrong" data-popup-delete>
                <Trash2 aria-hidden className="size-4" />
              </button>
            )}
          </div>
        )}

        {noteItem && noteAt && (
          <NoteBox
            key={noteItem.id}
            x={Math.min(Math.max(noteAt.x, 0), Math.max(0, geo.size.w - 260))}
            y={noteAt.y + noteAt.h + 14}
            text={noteItem.note ?? ''}
            onSave={(t) => (t.trim() || noteItem.kind !== 'NOTE' ? change(noteItem.id, { note: t.trim() || null }) : remove([noteItem.id]), setNoteFor(null))}
            onDelete={() => (noteItem.kind === 'NOTE' ? remove([noteItem.id]) : (change(noteItem.id, { note: null }), setNoteFor(null)))}
            onClose={() => (noteItem.kind === 'NOTE' && !noteItem.note ? remove([noteItem.id]) : setNoteFor(null))}
          />
        )}
      </div>
    </div>
  );
}

function NoteBox({ x, y, text, onSave, onDelete, onClose }: { x: number; y: number; text: string; onSave: (t: string) => void; onDelete: () => void; onClose: () => void }) {
  const [value, setValue] = useState(text);
  return (
    <div data-annot-ui data-annot-note role="dialog" aria-label="Note" className="absolute z-20 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-rule bg-surface p-2.5 shadow-lg shadow-ink/10" style={{ left: x, top: y }}>
      <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} rows={3} placeholder="Write your note" className="w-full resize-y rounded-lg border border-rule-strong bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button type="button" onClick={() => onSave(value)} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white" data-note-save>
          Save note
        </button>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-ink/5">
          Close
        </button>
        {text && (
          <button type="button" onClick={onDelete} className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-wrong hover:bg-wrong-soft">
            Remove note
          </button>
        )}
      </div>
    </div>
  );
}
