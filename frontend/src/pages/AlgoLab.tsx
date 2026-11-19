import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  APPLY, applyOp, binarySteps, binaryWorst, BRACKET_STRINGS, checkMiddle, checkStudentSwap, cleanTaskText, codeFor, countSort, expectedAction, linearSteps, MEASURE_LIMITS, measureRow,
  newDS, newTask, nextSwapIndex, OPS, parseArray, PRED_PUSHES, PRED_SORT_ARRAY, PRED_SWAPS_ARRAY, PREDICTS, pythonList, randomDistinct, REVERSE_WORDS, runOps, searchStats,
  SEARCH_CODE, sortedList, sortSteps, STACK_LIMITS, studentPointer, taskAct, LIST_NAME, TASK_TEXT_MAX,
  type DS, type MeasureRow, type Op, type OpResult, type SearchStep, type SortAlg, type Struct, type TaskKind, type TaskState,
} from '../visual/algo';

type Tab = 'stack' | 'sort' | 'search';
const TABS: { id: Tab; label: string }[] = [
  { id: 'stack', label: 'Stack, queue and deque' },
  { id: 'sort', label: 'Sorting' },
  { id: 'search', label: 'Searching' },
];
const STEP_NAMES = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;

const C = { compare: '#d58a00', swap: '#b42318', settled: '#1d7a4b', marked: '#2347a8', plain: '#8b95a7', select: '#6b3fa0' };
const seg = (on: boolean) => `h-8 flex-1 rounded px-2 text-[13px] font-medium ${on ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`;
const segWrap = 'inline-flex w-full gap-0.5 rounded-md bg-ink/5 p-0.5';
const f1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** Animation styles: slide in for a new item, fade out for a removed one. Off for people who ask for less motion. */
const ANIM = `
@keyframes algoIn { from { opacity: 0; transform: translateY(-16px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes algoInX { from { opacity: 0; transform: translateX(22px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes algoOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-26px) scale(.9); } }
@keyframes algoOutX { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(-26px) scale(.9); } }
.algo-in { animation: algoIn .35s ease-out; } .algo-inx { animation: algoInX .35s ease-out; }
.algo-out { animation: algoOut .6s ease-in forwards; pointer-events: none; } .algo-outx { animation: algoOutX .6s ease-in forwards; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .algo-in, .algo-inx, .algo-out, .algo-outx { animation: none; } .algo-out, .algo-outx { opacity: 0; } }
`;

/** Python code, read-only, with the executing line marked. */
function CodeView({ lines, line, label }: { lines: string[]; line: number | null; label: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-ink/5 p-2 text-[12.5px] leading-[1.55] text-ink" aria-label={label} data-code>
      {lines.map((l, i) => (
        <div key={i} data-line={i} aria-current={line === i ? 'true' : undefined} className={`whitespace-pre px-1 ${line === i ? 'rounded bg-accent-soft font-semibold text-accent-strong ring-1 ring-accent' : ''}`}>
          <span className="mr-2 inline-block w-4 select-none text-right text-ink-3">{i + 1}</span>
          {l || ' '}
        </div>
      ))}
    </pre>
  );
}

function Counter({ label, value, id }: { label: string; value: string | number; id?: string }) {
  return (
    <div className="rounded-md bg-ink/5 px-2.5 py-1.5 text-center">
      <div className="text-[11px] text-ink-2">{label}</div>
      <div className="num text-lg font-semibold text-ink" data-counter={id}>{value}</div>
    </div>
  );
}

// ------------------------------------------------------------------ Stack, queue and deque

const OP_LABEL: Record<Op, string> = {
  push: 'push', pop: 'pop', peek: 'peek', isEmpty: 'isEmpty', enqueue: 'enqueue', dequeue: 'dequeue', front: 'front', rear: 'rear',
  insertFront: 'insertFront', insertRear: 'insertRear', deletionFront: 'deletionFront', deletionRear: 'deletionRear',
};
const NEEDS_ITEM: Op[] = ['push', 'enqueue', 'insertFront', 'insertRear'];
const KEY_FOR: Partial<Record<Op, string>> = { push: 'a', enqueue: 'a', insertRear: 'a', insertFront: 'f', pop: 'r', dequeue: 'r', deletionFront: 'r', deletionRear: 'b', peek: 'p', front: 'p' };
const SLOT = 'flex h-11 min-w-[3.25rem] items-center justify-center rounded-md border-2 text-base font-semibold';

function StructureView({ ds, flash, ghost, narrow }: { ds: DS; flash: { kind: 'in' | 'out'; index: number; n: number } | null; ghost: { value: string | number; index: number; n: number } | null; narrow: boolean }) {
  const slots = Array.from({ length: ds.cap }, (_, i) => i);
  const vertical = ds.kind === 'stack';
  void narrow;
  const cell = (i: number) => {
    const v = ds.items[i];
    const filled = v !== undefined;
    const isIn = flash?.kind === 'in' && flash.index === i && filled;
    const anim = isIn ? (vertical ? 'algo-in' : 'algo-inx') : '';
    return (
      <div key={`${i}-${isIn ? flash!.n : 0}`} data-slot={i} className={`${SLOT} ${anim} ${filled ? 'border-[#2347a8] bg-[#e8eefb] text-ink' : 'border-dashed border-rule-strong text-ink-3'} ${vertical ? 'w-28' : ''}`}>
        {filled ? String(v) : ''}
      </div>
    );
  };
  const ghostEl = ghost && (
    <div key={`g${ghost.n}`} aria-hidden className={`${SLOT} ${vertical ? 'algo-out w-28' : 'algo-outx'} absolute border-[#b42318] bg-[#fdeceb] text-ink`} style={vertical ? { left: 0, top: 0 } : { left: `calc(${ghost.index} * 3.75rem)`, top: 0 }}>
      {String(ghost.value)}
    </div>
  );
  if (vertical) {
    const top = ds.items.length - 1;
    return (
      <div className="flex items-start justify-center gap-3 py-3" data-structure="stack">
        <div className="relative flex flex-col gap-1.5" role="img" aria-label={`Stack, bottom to top: ${ds.items.join(', ') || 'empty'}`}>
          {[...slots].reverse().map((i) => (
            <div key={i} className="flex items-center gap-2">
              {cell(i)}
              <span className="w-24 text-[13px] font-semibold text-[#2347a8]">{i === top ? '← top' : ''}{i === 0 && ds.items.length > 0 && top !== 0 ? <span className="text-ink-3 font-medium">bottom</span> : ''}</span>
            </div>
          ))}
          {ghost && <div className="pointer-events-none absolute left-0" style={{ top: `${(ds.cap - 1 - Math.min(ghost.index, ds.cap - 1)) * 3.125}rem` }}>{ghostEl && <div className="relative">{ghostEl}</div>}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto py-3" data-structure={ds.kind}>
      <div className="relative mx-auto flex w-max gap-2 pb-1" role="img" aria-label={`${ds.kind === 'queue' ? 'Queue' : 'Deque'}, front to rear: ${ds.items.join(', ') || 'empty'}`}>
        {slots.map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            {cell(i)}
            <span className="h-4 text-[12.5px] font-semibold text-[#2347a8]">
              {ds.items.length > 0 && i === 0 && i === ds.items.length - 1 ? 'front = rear' : ds.items.length > 0 && i === 0 ? 'front' : ds.items.length > 0 && i === ds.items.length - 1 ? 'rear' : ''}
            </span>
          </div>
        ))}
        {ghost && <div className="pointer-events-none absolute left-0 top-0">{ghostEl}</div>}
      </div>
    </div>
  );
}

interface LogLine { code: string; text: string; ok: boolean }

// ------------------------------------------------------------------ Sorting views

function Bars({ step, student, sel, onPick, narrow }: { step: ReturnType<typeof sortSteps>[number]; student: boolean; sel: number | null; onPick: (i: number) => void; narrow: boolean }) {
  const a = step.a;
  const max = Math.max(...a, 1);
  const seen = new Map<number, number>();
  const ids = a.map((v) => { const c = seen.get(v) ?? 0; seen.set(v, c + 1); return `${v}#${c}`; });
  const h = narrow ? 190 : 210;
  const state = (i: number) => {
    if (!student && step.kind === 'swap' && step.pair?.includes(i)) return 'swap';
    if (!student && step.kind === 'compare' && step.pair?.includes(i)) return 'compare';
    if (step.marked === i) return 'marked';
    if (step.settled.includes(i)) return 'settled';
    return 'plain';
  };
  const colour = (s: string) => (s === 'swap' ? C.swap : s === 'compare' ? C.compare : s === 'marked' ? C.marked : s === 'settled' ? C.settled : C.plain);
  const glyph = (s: string) => (s === 'swap' ? '⇄' : s === 'compare' ? '?' : s === 'marked' ? '◆' : s === 'settled' ? '✓' : '');
  return (
    <div className="relative mx-2 mt-2" style={{ height: h + 44 }} data-bars role="group" aria-label={`List: ${a.join(', ')}`}>
      {a.map((v, i) => {
        const s = state(i);
        return (
          <button
            key={ids[i]}
            type="button"
            data-bar={i}
            data-state={s}
            disabled={!student}
            onClick={() => onPick(i)}
            aria-label={`Position ${i}, value ${v}${s !== 'plain' ? `, ${s}` : ''}${sel === i ? ', selected' : ''}`}
            aria-pressed={student ? sel === i : undefined}
            className="absolute bottom-0 flex flex-col items-center justify-end px-[3px] transition-[left] duration-300 motion-reduce:transition-none disabled:cursor-default"
            style={{ left: `${(i / a.length) * 100}%`, width: `${100 / a.length}%`, height: h + 44 }}
          >
            <span className="num text-[13px] font-semibold text-ink">{v}</span>
            <span className="w-full rounded-t transition-[height] duration-300 motion-reduce:transition-none" style={{ height: Math.max(8, (v / max) * h), background: colour(s), outline: sel === i ? `3px solid ${C.select}` : undefined, outlineOffset: 1 }} />
            <span className="h-4 text-[11px] leading-4 text-ink-2">{glyph(s)}</span>
            <span className="num h-4 text-[11px] leading-4 text-ink-3">{i}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchCells({ list, step, shown, student, onPick, alg }: { list: number[]; step: SearchStep; shown: { low: number; high: number }; student: boolean; onPick: (i: number) => void; alg: 'linear' | 'binary' }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-2 py-3" data-cells role="group" aria-label={`Sorted list: ${list.join(', ')}`}>
      {list.map((v, i) => {
        let s: 'out' | 'in' | 'mid' | 'found' | 'seen' = 'in';
        if (alg === 'binary') {
          if (i < shown.low || i > shown.high) s = 'out';
          if (step.mid === i && step.kind === 'compare') s = 'mid';
        } else {
          if (step.i !== null && i < step.i) s = 'seen';
          if (step.i === i && step.kind === 'compare') s = 'mid';
        }
        if (step.kind === 'found' && step.i === i) s = 'found';
        const marks = [alg === 'binary' && i === shown.low && step.kind !== 'start' ? 'low' : '', alg === 'binary' && step.mid === i && step.kind === 'compare' ? 'mid' : '', alg === 'binary' && i === shown.high && step.kind !== 'start' ? 'high' : ''].filter(Boolean).join('/');
        const marksAtStart = alg === 'binary' && step.kind === 'start' ? (i === 0 ? 'low' : '') + (i === list.length - 1 ? (i === 0 ? '/high' : 'high') : '') : marks;
        return (
          <div key={i} className="flex flex-col items-center">
            <button
              type="button"
              data-cell={i}
              data-state={s}
              disabled={!student}
              onClick={() => onPick(i)}
              aria-label={`Index ${i}, value ${v}${s === 'out' ? ', ruled out' : s === 'seen' ? ', already checked' : s === 'mid' ? ', being compared' : s === 'found' ? ', found' : ''}`}
              className={`num flex h-11 w-11 items-center justify-center rounded-md border-2 text-sm font-semibold disabled:cursor-default ${s === 'out' || s === 'seen' ? 'border-rule bg-ink/5 text-ink-3 line-through' : s === 'mid' ? 'border-[#d58a00] bg-[#fff3df] text-ink' : s === 'found' ? 'border-[#1d7a4b] bg-[#e8f4ee] text-ink' : 'border-rule-strong bg-surface text-ink'}`}
            >
              {v}
            </button>
            <span className="num text-[11px] text-ink-3">{i}</span>
            <span className="h-4 text-[11px] font-semibold text-[#2347a8]">{marksAtStart}</span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Analyse graphs

interface Series { name: string; colour: string; pts: [number, number][]; dash?: boolean }
function Graph({ title, series, ylabel, label }: { title: string; series: Series[]; ylabel: string; label: string }) {
  const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
  const ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const xm = Math.max(...xs, 1), ym = Math.max(...ys, 1) * 1.1;
  const X = (x: number) => 34 + (x / xm) * 150;
  const Y = (y: number) => 78 - (y / ym) * 62;
  return (
    <figure>
      <figcaption className="mb-1 text-sm font-semibold text-ink">{title}</figcaption>
      <svg viewBox="0 0 200 106" className="w-full max-w-md" role="img" aria-label={label} data-graph={title}>
        <rect x={34} y={16} width={150} height={62} fill="#fff" stroke="#e5e5e5" />
        {series.map((s) => (
          <g key={s.name}>
            <polyline points={s.pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke={s.colour} strokeWidth={1.3} strokeDasharray={s.dash ? '3 2' : undefined} />
            {!s.dash && s.pts.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={2.3} fill={s.colour} />)}
          </g>
        ))}
        <text x={184} y={90} fontSize={6.5} textAnchor="end" fill="#4d5768">list size n (max {xm})</text>
        <text x={36} y={11} fontSize={6.5} fill="#4d5768">{ylabel} (max {Math.round(ym / 1.1)})</text>
        {series.map((s, i) => (
          <g key={s.name}>
            <rect x={36 + i * 52} y={95} width={5} height={3} fill={s.colour} />
            <text x={43 + i * 52} y={98.5} fontSize={5.6} fill="#4d5768">{s.name}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

const curve = (xs: number[], f: (n: number) => number): [number, number][] => {
  const hi = Math.max(...xs);
  return Array.from({ length: 41 }, (_, k) => { const n = 1 + ((hi - 1) * k) / 40; return [n, f(n)] as [number, number]; });
};

// ------------------------------------------------------------------ The page

export function AlgoLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [params, setParams] = useSearchParams();
  const startTab = params.get('tab');
  const narrow = useNarrow();
  const [tab, setTabState] = useState<Tab>(startTab === 'sort' || startTab === 'search' || startTab === 'stack' ? startTab : 'stack');
  const setTab = (t: Tab) => {
    setTabState(t);
    setParams((p) => { const q = new URLSearchParams(p); q.set('tab', t); return q; }, { replace: true });
  };
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<MeasureRow[]>([]);
  const [measureN, setMeasureN] = useState(16);
  const [measureNote, setMeasureNote] = useState('');
  const [ans, setAns] = useState<Record<string, number>>({});
  const [announce, setAnnounce] = useState('');

  // ---------- stack, queue, deque
  const [kind, setKind] = useState<Struct>('stack');
  const [cap, setCap] = useState(5);
  const [ds, setDs] = useState<DS>(() => newDS('stack', 5));
  const [itemText, setItemText] = useState('3');
  const [log, setLog] = useState<LogLine[]>([]);
  const [last, setLast] = useState<OpResult | null>(null);
  const [flash, setFlash] = useState<{ kind: 'in' | 'out'; index: number; n: number } | null>(null);
  const [ghost, setGhost] = useState<{ value: string | number; index: number; n: number } | null>(null);
  const nonce = useRef(0);
  const [taskKind, setTaskKind] = useState<TaskKind | null>(null);
  const [task, setTask] = useState<TaskState | null>(null);
  const [taskMsg, setTaskMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [taskText, setTaskText] = useState('');

  const parseItem = (t: string): string | number => (t.trim() !== '' && /^-?\d+$/.test(t.trim()) ? Number(t.trim()) : t.trim());
  const resetStructure = (k: Struct, c: number) => { setDs(newDS(k, c)); setLog([]); setLast(null); setFlash(null); setGhost(null); setAnnounce(`New empty ${k}, capacity ${c}.`); };
  const chooseKind = (k: Struct) => { setKind(k); setTaskKind(null); setTask(null); resetStructure(k, cap); };
  const doOp = (op: Op) => {
    const item = NEEDS_ITEM.includes(op) ? parseItem(itemText) : undefined;
    if (NEEDS_ITEM.includes(op) && (item === '' || item === undefined)) { setAnnounce('Type a value to add first.'); setLast(null); setLog((l) => [{ code: '', text: 'Type a value in the box first.', ok: false }, ...l].slice(0, 7)); return; }
    const r = applyOp(ds, op, item);
    setDs(r.ds);
    setLast(r);
    nonce.current++;
    setFlash(r.changed ? { ...r.changed, n: nonce.current } : null);
    setGhost(r.changed?.kind === 'out' && r.value !== undefined && typeof r.value !== 'boolean' ? { value: r.value, index: r.changed.index, n: nonce.current } : null);
    setLog((l) => [{ code: r.code, text: r.message, ok: r.ok }, ...l].slice(0, 7));
    setAnnounce(`${r.message} The ${kind} now holds ${r.ds.items.length === 0 ? 'nothing' : r.ds.items.join(', ')}.`);
    if (r.ok && NEEDS_ITEM.includes(op) && typeof item === 'number') setItemText(String(item + 1));
  };
  const onBenchKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (taskKind) return;
    const op = OPS[kind].find((o) => KEY_FOR[o] === e.key.toLowerCase());
    if (op) { e.preventDefault(); doOp(op); }
  };
  const startTask = (k: TaskKind, text: string) => {
    const t = newTask(k, cleanTaskText(k, text));
    setTaskKind(k); setTask(t); setTaskText(t.text); setTaskMsg(null);
    setAnnounce(k === 'brackets' ? `Task: is ${t.text} balanced? Read each bracket and push or pop.` : `Task: reverse ${t.text}. Push every letter, then pop them all.`);
  };
  const doTask = (a: 'push' | 'pop' | 'yes' | 'no') => {
    if (!task) return;
    const r = taskAct(task, a);
    setTask(r.task);
    setTaskMsg({ ok: r.correct, text: r.message });
    setAnnounce((r.correct ? 'Correct. ' : 'Not that. ') + r.message);
  };
  const taskDs: DS = task ? { kind: 'stack', cap: Math.max(3, task.text.length), items: task.stack } : ds;

  // ---------- sorting
  const [alg, setAlg] = useState<SortAlg>('bubble');
  const [early, setEarly] = useState(true);
  const [arr, setArr] = useState<number[]>([5, 1, 4, 2, 8]);
  const [arrText, setArrText] = useState('5, 1, 4, 2, 8');
  const [arrErr, setArrErr] = useState('');
  const [sIdx, setSIdx] = useState(0);
  const [sMode, setSMode] = useState<'watch' | 'do'>('watch');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [sel, setSel] = useState<number | null>(null);
  const [fb, setFb] = useState<{ ok: boolean | null; text: string } | null>(null);
  const [miss, setMiss] = useState(0);
  const [seed, setSeed] = useState(1);
  const sSteps = useMemo(() => sortSteps(alg, arr, early), [alg, arr, early]);
  const cur = sSteps[Math.min(sIdx, sSteps.length - 1)]!;
  const sLast = sIdx >= sSteps.length - 1;
  const loadArr = (a: number[]) => { setArr(a); setArrText(a.join(', ')); setArrErr(''); setSIdx(0); setSel(null); setFb(null); setMiss(0); setPlaying(false); };
  const sortReset = () => { setSIdx(0); setSel(null); setFb(null); setMiss(0); setPlaying(false); };
  useEffect(() => {
    if (!playing) return;
    if (sLast) { setPlaying(false); return; }
    const t = setTimeout(() => setSIdx((i) => i + 1), 1150 - speed * 100);
    return () => clearTimeout(t);
  }, [playing, sIdx, sLast, speed]);
  const pickBar = (i: number) => {
    if (sMode !== 'do' || sLast) return;
    if (sel === null) { setSel(i); setAnnounce(`Selected position ${i}, value ${cur.a[i]}. Choose the second bar.`); return; }
    if (sel === i) { setSel(null); return; }
    const r = checkStudentSwap(sSteps, sIdx, sel, i, alg);
    setSel(null);
    setFb({ ok: r.correct, text: r.message });
    setAnnounce((r.correct ? 'Correct next step. ' : 'Not the next step. ') + r.message);
    if (r.correct) setSIdx(nextSwapIndex(sSteps, r.to) < 0 ? sSteps.length - 1 : r.to);
    else setMiss((m) => m + 1);
  };
  const sortHint = () => {
    const k = nextSwapIndex(sSteps, sIdx);
    if (k < 0) return;
    const p = sSteps[k]!.pair!;
    setFb({ ok: null, text: `Hint: the next swap is at positions ${Math.min(...p)} and ${Math.max(...p)}.` });
  };
  const stepSort = (d: number) => {
    const j = Math.max(0, Math.min(sSteps.length - 1, sIdx + d));
    setSIdx(j);
    setAnnounce(sSteps[j]!.text);
  };

  // ---------- searching
  const [sn, setSn] = useState(11);
  const [sseed, setSseed] = useState(3);
  const list = useMemo(() => sortedList(sn, sseed), [sn, sseed]);
  const absentKey = useMemo(() => list.find((v, i) => i > 0 && !list.includes(v + 1)) ?? list[list.length - 1]! + 1, [list]);
  const [keyIdx, setKeyIdx] = useState(-1); // -1: the key is absent
  const key = keyIdx < 0 || keyIdx >= list.length ? absentKey + 1 : list[keyIdx]!;
  const [qAlg, setQAlg] = useState<'linear' | 'binary'>('binary');
  const [qMode, setQMode] = useState<'watch' | 'do'>('watch');
  const [qIdx, setQIdx] = useState(0);
  const [qPlaying, setQPlaying] = useState(false);
  const [qFb, setQFb] = useState<{ ok: boolean | null; text: string } | null>(null);
  const [qMiss, setQMiss] = useState(0);
  const [allKeys, setAllKeys] = useState(false);
  const qSteps = useMemo(() => (qAlg === 'linear' ? linearSteps(list, key) : binarySteps(list, key)), [qAlg, list, key]);
  const qCur = qSteps[Math.min(qIdx, qSteps.length - 1)]!;
  const qLast = qIdx >= qSteps.length - 1;
  const qReset = () => { setQIdx(0); setQFb(null); setQMiss(0); setQPlaying(false); };
  useEffect(() => {
    if (!qPlaying) return;
    if (qLast) { setQPlaying(false); return; }
    const t = setTimeout(() => setQIdx((i) => i + 1), 1150 - speed * 100);
    return () => clearTimeout(t);
  }, [qPlaying, qIdx, qLast, speed]);
  const nextCmp = qSteps[qIdx + 1];
  const shown = (() => {
    if (qAlg === 'linear') return { low: 0, high: list.length - 1 };
    if (qMode === 'do' && nextCmp && (nextCmp.kind === 'compare' || nextCmp.kind === 'notfound') && qCur.kind !== 'found') return { low: nextCmp.low, high: nextCmp.high };
    return { low: qCur.low, high: qCur.high };
  })();
  const pickCell = (c: number) => {
    if (qMode !== 'do' || !nextCmp || nextCmp.kind !== 'compare') return;
    let ok: boolean, text: string;
    if (qAlg === 'binary') { const r = checkMiddle(nextCmp.low, nextCmp.high, c); ok = r.correct; text = r.message; }
    else { ok = c === nextCmp.i; text = ok ? `Correct: linear search checks index ${c} next.` : `Linear search goes in order from index 0: the next element to compare is index ${nextCmp.i}.`; }
    setQFb({ ok, text });
    if (!ok) { setQMiss((m) => m + 1); setAnnounce('Not the next step. ' + text); return; }
    let j = qIdx + 1;
    const after = qSteps[j + 1];
    if (after && (after.kind === 'found' || after.kind === 'notfound')) j++;
    setQIdx(j);
    setQFb({ ok, text: `${text} ${qSteps[qIdx + 1]!.text}` });
    setAnnounce(qSteps[j]!.text);
  };
  const stepSearch = (d: number) => {
    const j = Math.max(0, Math.min(qSteps.length - 1, qIdx + d));
    setQIdx(j);
    setAnnounce(qSteps[j]!.text);
  };
  const statsLin = useMemo(() => searchStats('linear', list), [list]);
  const statsBin = useMemo(() => searchStats('binary', list), [list]);

  // ---------- predictions, measure, completion
  const choose = (i: number) => { setPi(i); };
  const lockPrediction = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    setTab(p.tab);
    if (p.id === 'a2') { setAlg('bubble'); setEarly(false); setSMode('watch'); loadArr(PRED_SORT_ARRAY); const st = sortSteps('bubble', PRED_SORT_ARRAY, false); setSIdx(st.findIndex((s) => s.kind === 'passEnd' && s.pass === 2)); }
    if (p.id === 'a4') { setAlg('selection'); setSMode('watch'); loadArr(PRED_SWAPS_ARRAY); setSIdx(sortSteps('selection', PRED_SWAPS_ARRAY).length - 1); }
    if (p.id === 'a3') { setKind('stack'); setCap(5); setTaskKind(null); setTask(null); const r = runOps(newDS('stack', 5), [...PRED_PUSHES.map((x) => ['push', x] as [Op, number]), ['pop']]); setDs(r.ds); setLast(r.results.at(-1)!); setFlash(null); setGhost(null); setLog(r.results.map((x) => ({ code: x.code, text: x.message, ok: x.ok })).reverse().slice(0, 7)); }
    if (p.id === 'a1') { setQAlg('binary'); setQMode('watch'); setSn(24); setQIdx(0); }
    setTested((x) => ({ ...x, [p.id]: true }));
  };
  const explain = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    if (p.id === 'a1') {
      const a = Array.from({ length: 64 }, (_, k) => k + 1);
      const worst = Math.max(...[...a, 0, 65].map((v) => binarySteps(a, v).at(-1)!.cmp));
      return `Each comparison halves the part still in play: 64, 32, 16, 8, 4, 2, 1. That is 7 looks, which is floor(log₂ 64) + 1 = ${binaryWorst(64)}. The bench ran binary search for every one of the 64 keys and for two absent keys: the largest count was ${worst}. A linear search could need 64.`;
    }
    if (p.id === 'a2') {
      const e = sortSteps('bubble', PRED_SORT_ARRAY, false).filter((s) => s.kind === 'passEnd');
      return `After pass 1 the list is [${e[0]!.a.join(', ')}]: the largest, 9, is already at the end. After pass 2 it is [${e[1]!.a.join(', ')}]: 7 has bubbled up next to it. Each pass fixes one more element at the right end, so two passes fix 7 and 9. The bench is showing the end of pass 2.`;
    }
    if (p.id === 'a3') {
      const r = runOps(newDS('stack', 5), [...PRED_PUSHES.map((x) => ['push', x] as [Op, number]), ['pop']]);
      return `The stack is LIFO: the last item pushed is the first popped. After push 3, 5, 7 the list is [3, 5, 7] and st.pop() removes and returns the last element, ${r.results.at(-1)!.value}. The stack is left holding ${pythonList(r.ds.items)}.`;
    }
    const c = (a: SortAlg) => countSort(a, PRED_SWAPS_ARRAY).swp;
    return `On [${PRED_SWAPS_ARRAY.join(', ')}] bubble sort makes ${c('bubble')} swaps and insertion sort makes ${c('insertion')} shifts (one for every pair that is out of order, 15 pairs). Selection sort makes only ${c('selection')}: it swaps at most once per pass, and each swap can carry an element a long way. That is why it is chosen when moving data is expensive.`;
  };
  const addRow = () => {
    if (rows.some((r) => r.n === measureN)) { setMeasureNote(`You already recorded n = ${measureN}. Choose a different size.`); return; }
    setRows((r) => [...r, measureRow(measureN)].sort((a, b) => a.n - b.n));
    setMeasureNote(`Recorded n = ${measureN}.`);
  };
  const sizes = new Set(rows.map((r) => r.n)).size;
  const canAnalyse = sizes >= 3;
  const finished = Object.keys(ans).length === APPLY.length;
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!canAnalyse ? ['record measured runs at three or more different list sizes in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, seen[2] ?? false, canAnalyse, canAnalyse, seen[5] ?? false, finished];

  const reset = () => {
    if (tab === 'stack') { setTaskKind(null); setTask(null); setItemText('3'); resetStructure(kind, cap); }
    if (tab === 'sort') { sortReset(); setSMode('watch'); setAlg('bubble'); setEarly(true); loadArr([5, 1, 4, 2, 8]); setSpeed(5); }
    if (tab === 'search') { qReset(); setQMode('watch'); setQAlg('binary'); setSn(11); setSseed(3); setKeyIdx(-1); setAllKeys(false); }
  };

  const growth = (() => {
    if (rows.length < 2) return null;
    const a = rows[0]!, b = rows[rows.length - 1]!;
    const k = b.n / a.n;
    return { k, lin: b.linWorst / a.linWorst, binAdd: b.binWorst - a.binWorst, bub: b.bubble / a.bubble, ins: b.insertion / a.insertion, a, b };
  })();
  const opButton = (op: Op) => (
    <button key={op} type="button" className={NEEDS_ITEM.includes(op) ? btnMain : btn} data-op={op} aria-keyshortcuts={KEY_FOR[op]} onClick={() => doOp(op)}>
      {OP_LABEL[op]}
      {KEY_FOR[op] && <kbd className="rounded bg-black/10 px-1 text-[11px] font-normal">{KEY_FOR[op]!.toUpperCase()}</kbd>}
    </button>
  );
  const nm = LIST_NAME[kind];
  const sortCode = codeFor(alg, early);
  const unit = alg === 'insertion' ? 'shifts' : 'swaps';

  return (
    <div data-algo-lab data-tab={tab}>
      <style>{ANIM}</style>
      <PageHeader back={back} title="Data Structures and Algorithms Visualiser" subtitle={<span className="inline-flex flex-wrap items-center gap-2">Computer Science · Stack, queue and deque, sorting, searching <Badge tone="amber">Draft – unverified</Badge></span>} />
      <StepNav step={step} seen={seen} done={done} go={go} names={STEP_NAMES} />
      <p className="sr-only" role="status" aria-live="polite" data-announce>{announce}</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`} onKeyDown={onBenchKey}>
            <div role="tablist" aria-label="Bench" className="flex flex-wrap gap-1 border-b border-rule p-2">
              {TABS.map((t) => (
                <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} data-tab-btn={t.id} onClick={() => setTab(t.id)} className={`h-8 rounded-md px-3 text-[13px] font-medium ${tab === t.id ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'text-ink-2 hover:bg-ink/5'}`}>{t.label}</button>
              ))}
            </div>

            {tab === 'stack' && (
              <div data-bench="stack">
                <div className="grid gap-3 px-3 pt-3 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="text-ink">Structure</span>
                    <div role="group" aria-label="Structure" className={`${segWrap} mt-1`}>
                      {(['stack', 'queue', 'deque'] as Struct[]).map((k) => <button key={k} type="button" aria-pressed={kind === k} data-kind={k} onClick={() => chooseKind(k)} className={seg(kind === k)}>{k === 'stack' ? 'Stack' : k === 'queue' ? 'Queue' : 'Deque'}</button>)}
                    </div>
                  </div>
                  <Slider id="a-cap" label="Capacity (fixed size)" unit="items" value={task ? taskDs.cap : cap} min={STACK_LIMITS.minCap} max={STACK_LIMITS.maxCap} step={1} onChange={(v) => { if (!task) { setCap(v); resetStructure(kind, v); } }} />
                </div>
                <StructureView ds={taskDs} flash={task ? null : flash} ghost={task ? null : ghost} narrow={narrow} />
                <div className="space-y-2 px-3 pb-3">
                  <div className="rounded-md bg-ink/5 p-2.5 font-mono text-[13px] text-ink" data-pylist aria-live="off">
                    <div>{nm} = <strong>{pythonList(taskDs.items)}</strong>  <span className="text-ink-3"># len = {taskDs.items.length}, capacity {taskDs.cap}</span></div>
                    {!task && last && last.code && <div className="mt-0.5">&gt;&gt;&gt; {last.code}{last.value !== undefined ? <span className="text-ink-3">  # returns {String(last.value)}</span> : ''}</div>}
                  </div>
                  {!task ? (
                    <>
                      <div className="flex flex-wrap items-end gap-2" data-ops>
                        {OPS[kind].some((o) => NEEDS_ITEM.includes(o)) && (
                          <label className="text-sm text-ink-2">Value
                            <input data-item-input aria-label="Value to add" className="ml-1 h-9 w-20 rounded-md border border-rule-strong bg-surface px-2 text-ink" maxLength={4} value={itemText} onChange={(e) => setItemText(e.target.value)} />
                          </label>
                        )}
                        {OPS[kind].map(opButton)}
                        <button type="button" className={btn} onClick={reset} data-reset><RotateCcw aria-hidden className="size-4" /> Reset</button>
                      </div>
                      <p className="text-xs text-ink-3">Keyboard: press A to add (push, enqueue or insertRear), R to remove (pop, dequeue or deletionFront){kind === 'deque' ? ', F for insertFront, B for deletionRear' : ''}, P to peek or read the front. Every result is read out by the screen reader.</p>
                      <div className="rounded-md border border-rule p-2 text-sm" aria-live="polite" data-message>
                        {log[0] ? <span className={log[0].ok ? 'text-ink' : 'font-semibold text-wrong'}>{log[0].text}</span> : <span className="text-ink-3">Add a value, then try removing it. Notice which item comes out first.</span>}
                      </div>
                      {log.length > 1 && (
                        <ol className="space-y-0.5 text-xs text-ink-2" data-log aria-label="Earlier operations">
                          {log.slice(1).map((l, i) => <li key={i}><code className="font-mono">{l.code || '…'}</code> {l.ok ? '' : '(refused) '}</li>)}
                        </ol>
                      )}
                    </>
                  ) : null}
                  {kind === 'stack' && (
                    <div className="border-t border-rule pt-2" data-tasks>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">Do it by hand:</span>
                        <button type="button" className={`${btn} ${taskKind === 'brackets' ? 'ring-accent' : ''}`} aria-pressed={taskKind === 'brackets'} data-task-start="brackets" onClick={() => startTask('brackets', BRACKET_STRINGS[0]!)}>Balanced brackets</button>
                        <button type="button" className={btn} aria-pressed={taskKind === 'reverse'} data-task-start="reverse" onClick={() => startTask('reverse', REVERSE_WORDS[0]!)}>Reverse a string</button>
                        {task && <button type="button" className={btn} data-task-exit onClick={() => { setTask(null); setTaskKind(null); setTaskMsg(null); }}>Back to free practice</button>}
                      </div>
                      {task && (
                        <div className="mt-2 space-y-2" data-task={task.kind} data-task-phase={task.phase}>
                          <p className="text-sm text-ink">{task.kind === 'brackets' ? 'Is this expression balanced? Read it left to right. Push each opening bracket; for each closing bracket, pop and check it matches.' : 'Reverse the string with a stack: push every letter in order, then pop until the stack is empty.'}</p>
                          <div className="flex flex-wrap gap-1 font-mono text-lg" aria-label={`String ${task.text}`}>
                            {[...task.text].map((c, i) => <span key={i} data-char={i} className={`min-w-6 rounded px-1 text-center ${i === task.pos && task.phase === 'work' ? 'bg-accent-soft ring-1 ring-accent' : i < task.pos ? 'text-ink-3' : ''}`}>{c}</span>)}
                          </div>
                          {task.kind === 'reverse' && <div className="font-mono text-sm text-ink">Output: <strong data-out>{task.out || '…'}</strong></div>}
                          <div className="flex flex-wrap gap-2">
                            {task.phase === 'verdict' ? (
                              <>
                                <button type="button" className={btnMain} data-task-act="yes" onClick={() => doTask('yes')}>Balanced</button>
                                <button type="button" className={btnMain} data-task-act="no" onClick={() => doTask('no')}>Not balanced</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className={btnMain} data-task-act="push" disabled={task.phase === 'done'} onClick={() => doTask('push')}>push</button>
                                <button type="button" className={btnMain} data-task-act="pop" disabled={task.phase === 'done'} onClick={() => doTask('pop')}>pop</button>
                              </>
                            )}
                            <button type="button" className={btn} data-task-restart onClick={() => startTask(task.kind, task.text)}><RotateCcw aria-hidden className="size-4" /> Restart</button>
                            <button type="button" className={btn} data-task-next onClick={() => { const list2 = task.kind === 'brackets' ? BRACKET_STRINGS : REVERSE_WORDS; startTask(task.kind, list2[(list2.indexOf(task.text) + 1) % list2.length] ?? list2[0]!); }}>Next example</button>
                          </div>
                          <label className="block text-sm text-ink-2">Or type your own (up to {TASK_TEXT_MAX} characters)
                            <input aria-label="Your own string" className="ml-2 h-9 w-40 rounded-md border border-rule-strong bg-surface px-2 font-mono text-ink" value={taskText} maxLength={TASK_TEXT_MAX} onChange={(e) => setTaskText(cleanTaskText(task.kind, e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') startTask(task.kind, taskText); }} />
                            <button type="button" className={`${btn} ml-2`} onClick={() => startTask(task.kind, taskText)}>Use it</button>
                          </label>
                          <div className={`rounded-md border p-2 text-sm ${taskMsg ? (taskMsg.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft') : 'border-rule'}`} aria-live="polite" data-task-message>
                            {taskMsg ? taskMsg.text : 'Press push or pop for the first character.'}
                          </div>
                          <div className="num text-xs text-ink-3" data-task-stats>Correct moves: {task.moves} · Mistakes: {task.mistakes}{task.phase === 'done' && task.kind === 'brackets' ? ` · Result: ${task.balanced ? 'balanced' : 'not balanced'}` : ''}{task.phase === 'done' && task.kind === 'reverse' ? ` · Result: ${task.out}` : ''}</div>
                          {expectedAction(task) === null ? <p className="text-sm font-semibold text-correct">Task finished.</p> : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'sort' && (
              <div data-bench="sort">
                <div className="grid gap-3 px-3 pt-3 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="text-ink">Algorithm</span>
                    <div role="group" aria-label="Algorithm" className={`${segWrap} mt-1`}>
                      {([['bubble', 'Bubble'], ['selection', 'Selection'], ['insertion', 'Insertion']] as [SortAlg, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={alg === k} data-alg={k} onClick={() => { setAlg(k); sortReset(); }} className={seg(alg === k)}>{l}</button>)}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-ink">Who takes the steps?</span>
                    <div role="group" aria-label="Mode" className={`${segWrap} mt-1`}>
                      <button type="button" aria-pressed={sMode === 'watch'} data-smode="watch" onClick={() => { setSMode('watch'); sortReset(); }} className={seg(sMode === 'watch')}>Watch</button>
                      <button type="button" aria-pressed={sMode === 'do'} data-smode="do" onClick={() => { setSMode('do'); sortReset(); }} className={seg(sMode === 'do')}>I do the swaps</button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-sm text-ink-2">List (2 to 12 numbers, 1 to 99)
                        <input aria-label="List to sort" data-arr-input className="ml-2 h-9 w-56 max-w-full rounded-md border border-rule-strong bg-surface px-2 font-mono text-ink" value={arrText} onChange={(e) => setArrText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const r = parseArray(arrText); if (r.ok) loadArr(r.a); else setArrErr(r.why); } }} />
                      </label>
                      <button type="button" className={btn} data-arr-apply onClick={() => { const r = parseArray(arrText); if (r.ok) loadArr(r.a); else setArrErr(r.why); }}>Use this list</button>
                      <button type="button" className={btn} data-arr-random onClick={() => { setSeed((s) => s + 1); loadArr(randomDistinct(7, seed + 10)); }}>Random</button>
                      <button type="button" className={btn} data-arr-sorted onClick={() => loadArr([...arr].sort((a, b) => a - b))}>Already sorted</button>
                      <button type="button" className={btn} data-arr-reversed onClick={() => loadArr([...arr].sort((a, b) => b - a))}>Reversed</button>
                    </div>
                    {arrErr && <p className="mt-1 text-sm font-semibold text-wrong" role="alert">{arrErr}</p>}
                    {alg === 'bubble' && (
                      <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" data-early checked={early} onChange={(e) => { setEarly(e.target.checked); sortReset(); }} className="size-4 accent-[var(--color-accent)]" />
                        Stop early when a pass makes no swap (the version in the lesson)
                      </label>
                    )}
                  </div>
                </div>
                <Bars step={sMode === 'do' ? cur : cur} student={sMode === 'do' && !sLast} sel={sel} onPick={pickBar} narrow={narrow} />
                <p className="px-3 text-xs text-ink-3">{sMode === 'do' ? 'Click (or press Enter on) two bars to swap them. ' : ''}Orange ? = being compared · red ⇄ = just swapped · green ✓ = {alg === 'insertion' ? 'sorted part' : 'in final place'} · blue ◆ = {alg === 'selection' ? 'smallest so far' : alg === 'insertion' ? 'the key' : 'marked'}.</p>
                <div className="space-y-2 px-3 py-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Counter label="Pass" value={cur.pass} id="pass" />
                    <Counter label="Comparisons" value={cur.cmp} id="cmp" />
                    <Counter label={unit === 'swaps' ? 'Swaps' : 'Shifts'} value={cur.swp} id="swp" />
                    <Counter label="Step" value={`${sIdx}/${sSteps.length - 1}`} id="step" />
                  </div>
                  {sMode === 'watch' ? (
                    <div className="flex flex-wrap items-center gap-2" data-sort-controls>
                      <button type="button" className={btn} onClick={() => stepSort(-1)} disabled={sIdx === 0} aria-label="Previous step" data-prev><SkipBack aria-hidden className="size-4" /> Back</button>
                      <button type="button" className={btnMain} onClick={() => stepSort(1)} disabled={sLast} aria-label="Next step" data-next>Next step <SkipForward aria-hidden className="size-4" /></button>
                      <button type="button" className={btn} onClick={() => setPlaying((p) => !p)} disabled={sLast} data-play>{playing ? <><Pause aria-hidden className="size-4" /> Pause</> : <><Play aria-hidden className="size-4" /> Play</>}</button>
                      <button type="button" className={btn} onClick={sortReset} data-sort-restart><RotateCcw aria-hidden className="size-4" /> Restart</button>
                      <div className="min-w-40 flex-1"><Slider id="a-speed" label="Speed" unit="" shown={`${speed}/10`} value={speed} min={1} max={10} step={1} onChange={setSpeed} /></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2" data-sort-controls>
                      <button type="button" className={btn} onClick={sortHint} disabled={sLast} data-hint>Hint</button>
                      <button type="button" className={btn} onClick={sortReset} data-sort-restart><RotateCcw aria-hidden className="size-4" /> Restart</button>
                      <span className="num text-sm text-ink-2" data-miss>Wrong tries: {miss}</span>
                    </div>
                  )}
                  <div className="rounded-md border border-rule p-2 text-sm" aria-live={playing ? 'off' : 'polite'} data-sort-message>
                    {sMode === 'do' && !sLast ? <span className="text-ink">{studentPointer(sSteps, sIdx, alg)}</span> : <span className="text-ink">{cur.text}</span>}
                  </div>
                  {sMode === 'do' && fb && <div className={`rounded-md border p-2 text-sm ${fb.ok === null ? 'border-rule bg-marker-soft' : fb.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-feedback data-ok={String(fb.ok)}>{fb.text}</div>}
                  {sMode === 'do' && sLast && <p className="text-sm font-semibold text-correct" data-student-done>Sorted by you: {cur.cmp} comparisons and {cur.swp} {unit}, {miss} wrong {miss === 1 ? 'try' : 'tries'}.</p>}
                  <CodeView lines={sortCode} line={cur.line} label={`Python code of ${alg} sort`} />
                </div>
              </div>
            )}

            {tab === 'search' && (
              <div data-bench="search">
                <div className="grid gap-3 px-3 pt-3 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="text-ink">Search</span>
                    <div role="group" aria-label="Search" className={`${segWrap} mt-1`}>
                      <button type="button" aria-pressed={qAlg === 'linear'} data-qalg="linear" onClick={() => { setQAlg('linear'); qReset(); }} className={seg(qAlg === 'linear')}>Linear</button>
                      <button type="button" aria-pressed={qAlg === 'binary'} data-qalg="binary" onClick={() => { setQAlg('binary'); qReset(); }} className={seg(qAlg === 'binary')}>Binary</button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-ink">Who takes the steps?</span>
                    <div role="group" aria-label="Mode" className={`${segWrap} mt-1`}>
                      <button type="button" aria-pressed={qMode === 'watch'} data-qmode="watch" onClick={() => { setQMode('watch'); qReset(); }} className={seg(qMode === 'watch')}>Watch</button>
                      <button type="button" aria-pressed={qMode === 'do'} data-qmode="do" onClick={() => { setQMode('do'); qReset(); }} className={seg(qMode === 'do')}>{qAlg === 'binary' ? 'I choose the middle' : 'I choose the next'}</button>
                    </div>
                  </div>
                  <Slider id="a-n" label="List size n" unit="elements" value={sn} min={5} max={24} step={1} onChange={(v) => { setSn(v); setKeyIdx(-1); qReset(); }} />
                  <label className="block text-sm text-ink">Key to find
                    <select aria-label="Key to find" data-key className="mt-1 h-9 w-full rounded-md border border-rule-strong bg-surface px-2" value={keyIdx} onChange={(e) => { setKeyIdx(Number(e.target.value)); qReset(); }}>
                      <option value={-1}>{absentKey + 1} (not in the list)</option>
                      {list.map((v, i) => <option key={i} value={i}>{v} (index {i}{i === 0 ? ', first' : i === list.length - 1 ? ', last' : i === Math.floor((list.length - 1) / 2) ? ', middle' : ''})</option>)}
                    </select>
                  </label>
                  <div className="sm:col-span-2"><button type="button" className={btn} data-new-list onClick={() => { setSseed((s) => s + 1); setKeyIdx(-1); qReset(); }}>New list</button></div>
                </div>
                <SearchCells list={list} step={qCur} shown={shown} student={qMode === 'do' && !qLast} onPick={pickCell} alg={qAlg} />
                <div className="space-y-2 px-3 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Counter label="Comparisons" value={qCur.cmp} id="qcmp" />
                    <Counter label="Worst case for n" value={qAlg === 'linear' ? list.length : binaryWorst(list.length)} id="qworst" />
                    <Counter label="Step" value={`${qIdx}/${qSteps.length - 1}`} id="qstep" />
                  </div>
                  {qMode === 'watch' ? (
                    <div className="flex flex-wrap items-center gap-2" data-search-controls>
                      <button type="button" className={btn} onClick={() => stepSearch(-1)} disabled={qIdx === 0} aria-label="Previous step" data-qprev><SkipBack aria-hidden className="size-4" /> Back</button>
                      <button type="button" className={btnMain} onClick={() => stepSearch(1)} disabled={qLast} aria-label="Next step" data-qnext>Next step <SkipForward aria-hidden className="size-4" /></button>
                      <button type="button" className={btn} onClick={() => setQPlaying((p) => !p)} disabled={qLast} data-qplay>{qPlaying ? <><Pause aria-hidden className="size-4" /> Pause</> : <><Play aria-hidden className="size-4" /> Play</>}</button>
                      <button type="button" className={btn} onClick={qReset} data-qrestart><RotateCcw aria-hidden className="size-4" /> Restart</button>
                      <div className="min-w-40 flex-1"><Slider id="a-qspeed" label="Speed" unit="" shown={`${speed}/10`} value={speed} min={1} max={10} step={1} onChange={setSpeed} /></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2" data-search-controls>
                      <button type="button" className={btn} onClick={qReset} data-qrestart><RotateCcw aria-hidden className="size-4" /> Restart</button>
                      <span className="num text-sm text-ink-2" data-qmiss>Wrong tries: {qMiss}</span>
                    </div>
                  )}
                  <div className="rounded-md border border-rule p-2 text-sm" aria-live={qPlaying ? 'off' : 'polite'} data-search-message>
                    {qMode === 'do' && !qLast ? (qAlg === 'binary' ? `Searching for ${key}. low = ${shown.low} and high = ${shown.high}. Click the element at the middle position.` : `Searching for ${key}. Click the next element linear search compares.`) : qCur.text}
                  </div>
                  {qMode === 'do' && qFb && <div className={`rounded-md border p-2 text-sm ${qFb.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-qfeedback data-ok={String(qFb.ok)}>{qFb.text}</div>}
                  <CodeView lines={SEARCH_CODE[qAlg]} line={qCur.line} label={`Python code of ${qAlg} search`} />
                  <div>
                    <button type="button" className={btn} data-allkeys onClick={() => setAllKeys((x) => !x)} aria-expanded={allKeys}>{allKeys ? 'Hide' : 'Run'} every key on this list</button>
                    {allKeys && (
                      <div className="mt-2 overflow-x-auto" data-allkeys-table>
                        <table className="w-full text-sm">
                          <caption className="mb-1 text-left text-xs text-ink-3">Comparisons over one search for each of the {list.length} keys in the list, and one for a key that is absent.</caption>
                          <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Search</th><th className="pr-2">Best</th><th className="pr-2">Average</th><th className="pr-2">Worst (present)</th><th>Absent key</th></tr></thead>
                          <tbody className="num">
                            <tr className="border-t border-rule"><td className="py-1 pr-2">Linear</td><td className="pr-2">{statsLin.best}</td><td className="pr-2">{f1(statsLin.avg)}</td><td className="pr-2">{statsLin.worst}</td><td>{statsLin.absent}</td></tr>
                            <tr className="border-t border-rule"><td className="py-1 pr-2">Binary</td><td className="pr-2">{statsBin.best}</td><td className="pr-2">{f1(statsBin.avg)}</td><td className="pr-2">{statsBin.worst}</td><td>{statsBin.absent}</td></tr>
                          </tbody>
                        </table>
                        <p className="mt-1 text-xs text-ink-3">For n = {list.length}: linear best 1, average (n + 1)/2 = {f1((list.length + 1) / 2)}, worst n. Binary worst is at most floor(log₂ n) + 1 = {binaryWorst(list.length)}.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">One bench, three tabs. Every number shown is computed by the real algorithm, step by step, so you can check your own dry runs against it.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Stack, queue and deque:</strong> add and remove items and see which one comes out. Fill it up for an overflow, empty it for an underflow.</li>
                <li><strong>Sorting:</strong> step through bubble, selection and insertion sort. Then switch to “I do the swaps” and play the algorithm yourself.</li>
                <li><strong>Searching:</strong> compare linear and binary search on the same sorted list, and count the comparisons.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choose} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={lockPrediction} explain={explain}
              onNext={() => choose(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Stack:</strong> push 1, 2, 3 and pop three times. In what order do they come out? Then do the same on the queue.</li>
                <li><strong>Stack task:</strong> run “Balanced brackets” on <code>([)]</code>. Which closing bracket gives it away?</li>
                <li><strong>Sorting:</strong> sort the same list with each algorithm. Which one is quickest on an already sorted list? On a reversed list?</li>
                <li><strong>Sorting by hand:</strong> choose “I do the swaps” and sort a random list. Use Hint only when you are stuck.</li>
                <li><strong>Searching:</strong> find the first element, the middle element and a key that is absent, with each search.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Choose a list size and run the algorithms on it. The three sorts get the same shuffled list; both searches are run once for every key of a sorted list of that size. Record at least three <em>different</em> sizes, for example 16, 64 and 256.</p>
              <Slider id="m-n" label="List size n" unit="elements" value={measureN} min={MEASURE_LIMITS.min} max={MEASURE_LIMITS.max} step={MEASURE_LIMITS.step} onChange={(v) => { setMeasureN(v); setMeasureNote(''); }} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnMain} onClick={addRow} data-record>Run and record</button>
                {rows.length > 0 && <button type="button" className={btn} onClick={() => { setRows([]); setMeasureNote(''); }}>Clear table</button>}
              </div>
              <p className="text-sm text-ink-2" role="status" data-measure-note>{measureNote} {rows.length > 0 ? `${sizes} size${sizes === 1 ? '' : 's'} recorded.` : ''}</p>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <caption className="mb-1 text-left text-xs text-ink-3">Comparisons counted. Bubble sort here is the lesson’s version with the early stop.</caption>
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">n</th><th className="pr-2">Bubble</th><th className="pr-2">Selection</th><th className="pr-2">Insertion</th><th className="pr-2">Linear avg</th><th className="pr-2">Linear worst</th><th className="pr-2">Binary avg</th><th>Binary worst</th></tr></thead>
                    <tbody className="num">{rows.map((r) => <tr key={r.n} className="border-t border-rule"><td className="py-1 pr-2 font-semibold">{r.n}</td><td className="pr-2">{r.bubble}</td><td className="pr-2">{r.selection}</td><td className="pr-2">{r.insertion}</td><td className="pr-2">{f1(r.linAvg)}</td><td className="pr-2">{r.linWorst}</td><td className="pr-2">{f1(r.binAvg)}</td><td>{r.binWorst}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              {canAnalyse && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my results</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canAnalyse && growth ? (
                <>
                  <Graph
                    title="Searching: comparisons against n" ylabel="comparisons" label="Linear search grows along a straight line with n; binary search grows very slowly, like log n"
                    series={[
                      { name: 'linear worst', colour: C.swap, pts: rows.map((r) => [r.n, r.linWorst]) },
                      { name: 'binary worst', colour: C.marked, pts: rows.map((r) => [r.n, r.binWorst]) },
                      { name: 'log₂ n + 1', colour: C.marked, dash: true, pts: curve(rows.map((r) => r.n), (n) => Math.log2(n) + 1) },
                    ]}
                  />
                  <Graph
                    title="Sorting: comparisons against n" ylabel="comparisons" label="Bubble sort comparisons grow like n squared; insertion sort on random data grows more slowly but also like n squared"
                    series={[
                      { name: 'bubble', colour: C.swap, pts: rows.map((r) => [r.n, r.bubble]) },
                      { name: 'insertion', colour: C.settled, pts: rows.map((r) => [r.n, r.insertion]) },
                      { name: 'n(n−1)/2', colour: C.swap, dash: true, pts: curve(rows.map((r) => r.n), (n) => (n * (n - 1)) / 2) },
                    ]}
                  />
                  <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink" data-growth>
                    <li>From n = {growth.a.n} to n = {growth.b.n} the list became <strong className="num">{f1(growth.k)}</strong> times longer.</li>
                    <li>Linear search worst case grew <strong className="num">{f1(growth.lin)}×</strong>: proportional to n. Binary search worst case grew by only <strong className="num">{growth.binAdd}</strong> comparison{growth.binAdd === 1 ? '' : 's'}: proportional to log₂ n.</li>
                    <li>Bubble sort comparisons grew <strong className="num">{f1(growth.bub)}×</strong>, close to {f1(growth.k)}² = <span className="num">{f1(growth.k * growth.k)}</span>: proportional to n². Insertion sort grew <strong className="num">{f1(growth.ins)}×</strong>: also about n² on random data, but with fewer comparisons than bubble sort ({growth.b.insertion} against {growth.b.bubble} at n = {growth.b.n}).</li>
                    <li>Selection sort always made n(n − 1)/2 comparisons ({growth.b.selection} at n = {growth.b.n}), whatever the order.</li>
                  </ul>
                </>
              ) : <p className="text-[15px] text-ink">Record at least three different list sizes in the Measure step first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>A stack is LIFO: push and pop work at the top (<code>append</code> and <code>pop()</code>). A queue is FIFO: items join at the rear and leave at the front (<code>append</code> and <code>pop(0)</code>). A deque works at both ends.</li>
                <li>Popping or dequeuing from an empty structure is an underflow; pushing into a full fixed-size one is an overflow.</li>
                <li>Bubble sort makes n(n − 1)/2 comparisons unless it stops early; on a sorted list with the early stop it needs only n − 1. Each pass fixes the next largest element at the right end.</li>
                <li>Selection sort always makes n(n − 1)/2 comparisons but at most n − 1 swaps. Insertion sort needs only n − 1 comparisons on a sorted list and the most on a reversed one.</li>
                <li>Linear search needs 1 to n comparisons (average (n + 1)/2). Binary search needs a sorted list and at most floor(log₂ n) + 1 comparisons: doubling n adds one.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>Try CUET-style questions</button>
            </section>
          )}
          {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
          <div><button type="button" className={btn} onClick={reset} data-reset-bottom><RotateCcw aria-hidden className="size-4" /> Reset this bench</button></div>
        </div>
      </div>
    </div>
  );
}
