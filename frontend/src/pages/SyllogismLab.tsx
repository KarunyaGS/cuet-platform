import { Lightbulb, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  analyse, APPLY, checkDiagram, evaluate, FORMS, generateProblem, gradePick, hintFor, inSet, isUniversal, LEVEL_NAME, LESSON_RULES, MENU_WORDS, negate, occupiedMasks, PICK_LABEL, pickFeedback,
  PREDICTS, predictionVerdicts, PRESETS, problemSignature, problemStats, regionMasks, regionName, S, S4_PAIRS, sampleBands, simplestSituation, statementRegions, stmtKey, stmtText, VERDICT_LABEL,
  verdictOf, type Analysis, type ConclusionResult, type Form, type Level, type Pick, type Problem, type Stmt, type Verdict,
} from '../visual/syllogism';

type Tab = 'build' | 'solve' | 'practice';
const TABS: { id: Tab; label: string }[] = [
  { id: 'build', label: 'Venn builder' },
  { id: 'solve', label: 'Syllogism solver' },
  { id: 'practice', label: 'Practice' },
];
const STEP_NAMES = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;
const seg = (on: boolean) => `h-8 flex-1 rounded px-2 text-[13px] font-medium ${on ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`;
const segWrap = 'inline-flex w-full flex-wrap gap-0.5 rounded-md bg-ink/5 p-0.5';
const selectCls = 'h-9 w-full rounded-md border border-rule-strong bg-surface px-2 text-sm text-ink';
const COL = ['#2347a8', '#1d7a4b', '#b45309'];
const FORM_BTN: Record<Form, string> = { all: 'All … are …', no: 'No … is/are …', some: 'Some … are …', somenot: 'Some … are not …' };
const f0 = (x: number) => `${Math.round(x * 100)}%`;

// ------------------------------------------------------------------ the Venn figure

const VB = { w: 420, h: 320 };
interface Circle { cx: number; cy: number; r: number }
const DEFAULT3: Circle[] = [{ cx: 160, cy: 125, r: 80 }, { cx: 260, cy: 125, r: 80 }, { cx: 210, cy: 205, r: 80 }];
const FIXED: Record<number, Circle[]> = {
  3: [{ cx: 160, cy: 125, r: 85 }, { cx: 260, cy: 125, r: 85 }, { cx: 210, cy: 210, r: 85 }],
  2: [{ cx: 160, cy: 160, r: 95 }, { cx: 260, cy: 160, r: 95 }],
};
const R_MIN = 36, R_MAX = 120;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

interface RegionGeo { exists: boolean; ax: number; ay: number }
/** Which of the regions are really drawn (a region exists when some visible area lies in exactly those circles), and a good spot for its label. */
function geometry(circles: Circle[]): Record<number, RegionGeo> {
  const best: Record<number, { count: number; depth: number; x: number; y: number }> = {};
  for (let x = 2; x < VB.w; x += 4) {
    for (let y = 2; y < VB.h; y += 4) {
      let mask = 0, depth = Infinity;
      circles.forEach((c, k) => {
        const d = Math.hypot(x - c.cx, y - c.cy);
        if (d < c.r) mask |= 1 << k;
        depth = Math.min(depth, Math.abs(d - c.r));
      });
      if (!mask) continue;
      const e = (best[mask] ??= { count: 0, depth: -1, x, y });
      e.count++;
      if (depth > e.depth) { e.depth = depth; e.x = x; e.y = y; }
    }
  }
  const out: Record<number, RegionGeo> = {};
  for (const m of regionMasks(circles.length)) { const e = best[m]; out[m] = { exists: !!e && e.count >= 10, ax: e?.x ?? 0, ay: e?.y ?? 0 }; }
  return out;
}
const regionAt = (circles: Circle[], x: number, y: number) => circles.reduce((m, c, k) => (Math.hypot(x - c.cx, y - c.cy) < c.r ? m | (1 << k) : m), 0);

function labelSpot(circles: Circle[], k: number) {
  const mx = circles.reduce((t, c) => t + c.cx, 0) / circles.length, my = circles.reduce((t, c) => t + c.cy, 0) / circles.length;
  const c = circles[k]!;
  let vx = c.cx - mx, vy = c.cy - my;
  const len = Math.hypot(vx, vy);
  if (len < 1) { vx = 0; vy = -1; } else { vx /= len; vy /= len; }
  return { x: clamp(c.cx + vx * (c.r + 16), 46, VB.w - 46), y: clamp(c.cy + vy * (c.r + 16), 16, VB.h - 8), ang: Math.atan2(vy, vx) };
}

interface VennProps {
  circles: Circle[];
  labels: string[];
  emptied?: number[];
  candidates?: number[];
  hint?: number[];
  marks?: number[];
  interactive?: boolean;
  tool?: 'move' | 'x';
  onToggle?: (mask: number) => void;
  onMove?: (k: number, cx: number, cy: number) => void;
  onResize?: (k: number, r: number) => void;
  caption: string;
  narrow?: boolean;
  dataName?: string;
  labelScale?: number;
}

function Venn({ circles, labels, emptied = [], candidates = [], hint = [], marks = [], interactive = false, tool = 'move', onToggle, onMove, onResize, caption, narrow = false, dataName, labelScale = 1 }: VennProps) {
  const id = useId().replace(/:/g, '');
  const n = circles.length;
  const geo = useMemo(() => geometry(circles), [circles]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ k: number; kind: 'move' | 'size'; dx: number; dy: number } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const paint = [
    ...emptied.map((m) => ({ m, fill: `url(#${id}-hatch)` })),
    ...candidates.filter((m) => !emptied.includes(m)).map((m) => ({ m, fill: '#f5b50066' })),
    ...hint.map((m) => ({ m, fill: '#6b3fa066' })),
  ].filter((p) => geo[p.m]?.exists);
  const down = (e: ReactPointerEvent<SVGElement>, k: number, kind: 'move' | 'size') => {
    if (!interactive || tool !== 'move') return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = local(e);
    drag.current = { k, kind, dx: kind === 'move' ? circles[k]!.cx - p.x : 0, dy: kind === 'move' ? circles[k]!.cy - p.y : 0 };
  };
  const moveEv = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = local(e);
    if (d.kind === 'move') onMove?.(d.k, clamp(p.x + d.dx, 20, VB.w - 20), clamp(p.y + d.dy, 20, VB.h - 20));
    else { const c = circles[d.k]!; onResize?.(d.k, clamp(Math.hypot(p.x - c.cx, p.y - c.cy), R_MIN, R_MAX)); }
  };
  const up = () => { drag.current = null; };
  const key = (e: ReactKeyboardEvent<SVGElement>, k: number) => {
    const c = circles[k]!;
    const st = e.shiftKey ? 2 : 8;
    const mv = (dx: number, dy: number) => { e.preventDefault(); onMove?.(k, clamp(c.cx + dx, 20, VB.w - 20), clamp(c.cy + dy, 20, VB.h - 20)); };
    if (e.key === 'ArrowLeft') mv(-st, 0);
    else if (e.key === 'ArrowRight') mv(st, 0);
    else if (e.key === 'ArrowUp') mv(0, -st);
    else if (e.key === 'ArrowDown') mv(0, st);
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); onResize?.(k, clamp(c.r + 6, R_MIN, R_MAX)); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); onResize?.(k, clamp(c.r - 6, R_MIN, R_MAX)); }
  };
  const clickSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || tool !== 'x') return;
    const p = local(e);
    const m = regionAt(circles, p.x, p.y);
    if (m > 0 && geo[m]?.exists) onToggle?.(m);
  };
  const handleR = narrow ? 11 : 8;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} className="block w-full select-none rounded-md border border-rule bg-surface" style={{ touchAction: interactive && tool === 'move' ? 'pan-y' : undefined, maxHeight: narrow ? 340 : 400 }} role="group" aria-label={caption} data-venn={dataName} onClick={clickSvg}>
      <style>{`[data-venn-circle]:focus{outline:none;stroke-width:5.5}`}</style>
      <defs>
        <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#e5e7eb" fillOpacity="0.55" /><line x1="0" y1="0" x2="0" y2="7" stroke="#6b7280" strokeWidth="2" /></pattern>
        {circles.map((c, k) => <clipPath key={k} id={`${id}-c${k}`}><circle cx={c.cx} cy={c.cy} r={c.r} /></clipPath>)}
        {[...new Set(paint.map((x) => x.m))].map((m) => (
          <mask key={m} id={`${id}-m${m}`} maskUnits="userSpaceOnUse" x={0} y={0} width={VB.w} height={VB.h}>
            <rect x={0} y={0} width={VB.w} height={VB.h} fill="#fff" />
            {circles.map((c, k) => (inSet(m, k) ? null : <circle key={k} cx={c.cx} cy={c.cy} r={c.r} fill="#000" />))}
          </mask>
        ))}
      </defs>
      {circles.map((c, k) => <circle key={k} cx={c.cx} cy={c.cy} r={c.r} fill={COL[k]} fillOpacity={0.14} />)}
      {paint.map(({ m, fill }, i) => {
        let inner = <rect x={0} y={0} width={VB.w} height={VB.h} fill={fill} mask={`url(#${id}-m${m})`} />;
        for (const k of circles.map((_, j) => j).filter((j) => inSet(m, j)).reverse()) inner = <g clipPath={`url(#${id}-c${k})`}>{inner}</g>;
        return <g key={`${m}-${i}`} data-paint={m} pointerEvents="none">{inner}</g>;
      })}
      {marks.filter((m) => geo[m]?.exists).map((m) => (
        <text key={m} x={geo[m]!.ax} y={geo[m]!.ay} textAnchor="middle" dominantBaseline="central" fontSize={30} fontWeight={800} fill="#111827" stroke="#fff" strokeWidth={4} paintOrder="stroke" pointerEvents="none" data-x={m}>X</text>
      ))}
      {circles.map((c, k) => (
        <circle
          key={k} data-venn-circle={k} cx={c.cx} cy={c.cy} r={c.r} fill="transparent" stroke={COL[k]} strokeWidth={3}
          tabIndex={interactive ? 0 : undefined} role={interactive ? 'button' : undefined}
          aria-label={interactive ? `Circle ${labels[k]}. Arrow keys move it, plus and minus resize it. Centre ${Math.round(c.cx)}, ${Math.round(c.cy)}, radius ${Math.round(c.r)}.` : undefined}
          pointerEvents={interactive && tool === 'move' ? 'all' : 'none'} style={{ cursor: interactive && tool === 'move' ? 'grab' : undefined, touchAction: 'none' }}
          onPointerDown={(e) => down(e, k, 'move')} onPointerMove={moveEv} onPointerUp={up} onPointerCancel={up} onKeyDown={(e) => key(e, k)}
        />
      ))}
      {circles.map((c, k) => {
        const lp = labelSpot(circles, k);
        return <text key={k} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize={(narrow ? 17 : 15) * labelScale} fontWeight={700} fill={COL[k]} stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none" data-venn-label={k}>{labels[k]}</text>;
      })}
      {interactive && tool === 'move' && circles.map((c, k) => {
        const a = labelSpot(circles, k).ang + 1.0;
        const hx = c.cx + Math.cos(a) * c.r, hy = c.cy + Math.sin(a) * c.r;
        return (
          <g key={k} data-resize={k} style={{ cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={(e) => down(e, k, 'size')} onPointerMove={moveEv} onPointerUp={up} onPointerCancel={up}>
            <circle cx={hx} cy={hy} r={handleR + 8} fill="transparent" />
            <circle cx={hx} cy={hy} r={handleR} fill="#fff" stroke={COL[k]} strokeWidth={3} />
          </g>
        );
      })}
    </svg>
  );
}

function Legend() {
  return (
    <p className="text-xs text-ink-3">
      <span className="mr-3 inline-flex items-center gap-1"><svg width="14" height="14" aria-hidden><rect width="14" height="14" fill="#e5e7eb" /><line x1="0" y1="14" x2="14" y2="0" stroke="#6b7280" strokeWidth="2" /></svg> hatched: empty</span>
      <span className="mr-3 inline-flex items-center gap-1"><span aria-hidden className="inline-block size-3.5 bg-[#f5b50099]" /> amber: a member must be in one of these</span>
      <span className="inline-flex items-center gap-1"><strong aria-hidden>X</strong> a member</span>
    </p>
  );
}

// ------------------------------------------------------------------ problem panel (solver and practice)

interface PanelProps {
  problem: Problem;
  picks: Record<number, Pick>;
  onPick: (i: number, p: Pick) => void;
  checked: boolean;
  onCheck: () => void;
  /** Show the proofs even without answers (used after a prediction). */
  showAll?: boolean;
  practice?: boolean;
  hintIdx: number | null;
  onHint?: (i: number) => void;
  narrow: boolean;
  announce: (t: string) => void;
}

function ProblemPanel({ problem, picks, onPick, checked, onCheck, showAll, practice, hintIdx, onHint, narrow, announce }: PanelProps) {
  const an = useMemo(() => analyse(problem.labels, problem.statements), [problem]);
  const results = useMemo(() => problem.conclusions.map((c) => evaluate(an, c)), [an, problem]);
  const n = problem.labels.length;
  const circles = FIXED[n]!;
  const emptied = useMemo(() => [...new Set(problem.statements.filter(isUniversal).flatMap((s) => statementRegions(s, n)))], [problem, n]);
  const cand = useMemo(() => [...new Set(problem.statements.filter((s) => !isUniversal(s)).flatMap((s) => statementRegions(s, n)))], [problem, n]);
  const hint = hintIdx !== null && !checked ? hintFor(an, problem.conclusions[hintIdx]!) : null;
  const reveal = checked || !!showAll;
  const answered = problem.conclusions.every((_, i) => picks[i] !== undefined);
  const right = results.filter((r, i) => picks[i] !== undefined && gradePick(r.verdict, picks[i]!)).length;
  const sitCount = an.models.length;
  return (
    <div className="space-y-3 p-3" data-problem={problem.id}>
      <div>
        <h3 className="text-sm font-semibold text-ink">Statements</h3>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[15px] text-ink" data-statements>
          {problem.statements.map((s, i) => <li key={i}>{stmtText(s, problem.labels)}.</li>)}
        </ol>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-1">
          <Venn circles={circles} labels={problem.labels} emptied={emptied} candidates={cand} hint={hint?.regions} caption={`Venn diagram of the statements: ${problem.statements.map((s) => stmtText(s, problem.labels)).join('; ')}. Regions the statements empty are hatched.`} narrow={narrow} dataName="problem" labelScale={1.25} />
          <Legend />
        </div>
        <div className="space-y-3">
          {problem.conclusions.map((c, i) => {
            const r = results[i]!;
            const pick = picks[i];
            const ok = pick !== undefined && gradePick(r.verdict, pick);
            return (
              <fieldset key={i} className="space-y-1.5" data-conclusion={i} data-verdict={reveal ? r.verdict : undefined}>
                <legend className="text-[15px] font-medium text-ink">{['I', 'II', 'III', 'IV'][i]}. {stmtText(c, problem.labels)}.</legend>
                <div role="radiogroup" aria-label={`Your answer for conclusion ${['I', 'II', 'III', 'IV'][i]}`} className={segWrap}>
                  {(['follows', 'notfollow', 'possible'] as Pick[]).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={pick === p} data-pick={p} disabled={checked} onClick={() => onPick(i, p)} className={`${seg(pick === p)} ${checked && pick === p ? (ok ? 'ring-2 ring-correct' : 'ring-2 ring-wrong') : ''}`}>{PICK_LABEL[p]}</button>
                  ))}
                </div>
                {practice && !checked && (
                  <div>
                    <button type="button" className={btn} data-hint={i} onClick={() => onHint?.(i)}><Lightbulb aria-hidden className="size-4" /> Hint</button>
                    {hintIdx === i && hint && <p className="mt-1 rounded-md bg-marker-soft p-2 text-sm text-ink" role="status" data-hint-text>{hint.text}</p>}
                  </div>
                )}
                {reveal && <Proof r={r} problem={problem} an={an} pick={pick} ok={ok} narrow={narrow} />}
              </fieldset>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!checked && !showAll && (
          <button type="button" className={btnMain} disabled={!answered} data-check onClick={() => { onCheck(); const rr = results.filter((x, i) => gradePick(x.verdict, picks[i]!)).length; announce(`Checked: ${rr} of ${results.length} right. The lab compared your answers with all ${sitCount} situations that fit the statements.`); }}>Check my answers</button>
        )}
        {!checked && !showAll && !answered && <span className="text-sm text-ink-3">Choose an answer for every conclusion.</span>}
      </div>
      {reveal && (
        <div className="rounded-md border border-rule bg-paper p-2.5 text-sm text-ink" role="status" data-summary>
          {checked && !showAll && <strong className="num" data-score>{right} of {results.length} right. </strong>}
          The lab tried all {an.space} ways of marking the {(1 << n) - 1} regions as empty or occupied. <strong className="num">{sitCount}</strong> of them fit these statements (each is one possible Venn picture). A conclusion follows only if it is true in all {sitCount}.
        </div>
      )}
    </div>
  );
}

function Proof({ r, problem, an, pick, ok, narrow }: { r: ConclusionResult; problem: Problem; an: Analysis; pick: Pick | undefined; ok: boolean; narrow: boolean }) {
  const n = problem.labels.length;
  const circles = FIXED[n]!;
  const emptied = [...new Set(problem.statements.filter(isUniversal).flatMap((s) => statementRegions(s, n)))];
  const pic = (situation: number, cap: string) => (
    <figure className="w-full max-w-[220px]" data-picture={cap}>
      <Venn circles={circles} labels={problem.labels} emptied={emptied} marks={occupiedMasks(situation, n)} caption={`${cap}. X marks regions with a member: ${occupiedMasks(situation, n).map((m) => regionName(m, problem.labels, n)).join('; ')}.`} narrow={narrow} dataName="proof" labelScale={1.5} />
      <figcaption className="mt-0.5 text-xs text-ink-2">{cap}</figcaption>
    </figure>
  );
  return (
    <div className={`space-y-1.5 rounded-md border p-2.5 text-sm ${pick === undefined ? 'border-rule bg-paper' : ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} data-proof aria-live="polite">
      <p className="font-semibold text-ink">
        {pick !== undefined && (ok ? 'Right. ' : 'Not quite. ')}
        {VERDICT_LABEL[r.verdict]}: true in <span className="num">{r.trueIn}</span> of <span className="num">{r.total}</span> pictures.
      </p>
      {pick !== undefined && <p className="text-ink">{pickFeedback(r, pick)}</p>}
      <ul className="list-disc space-y-0.5 pl-5 text-ink" data-argument>
        {r.argument.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <div className="flex flex-wrap gap-3">
        {r.counter !== null && pic(r.counter, 'A picture where it is false (counter-example)')}
        {r.verdict === 'possible' && r.witness !== null && pic(r.witness, 'A picture where it is true')}
        {r.verdict === 'follows' && r.witness !== null && pic(r.witness, 'One of the pictures: it holds here, and in every other')}
      </div>
      <span className="sr-only">{an.models.length} situations checked.</span>
    </div>
  );
}

// ------------------------------------------------------------------ tab 1: the Venn builder

function BuilderTab({ narrow, announce }: { narrow: boolean; announce: (t: string) => void }) {
  const [labels, setLabels] = useState<string[]>(['A', 'B', 'C']);
  const [circles, setCircles] = useState<Circle[]>(DEFAULT3);
  const [stmts, setStmts] = useState<Stmt[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [tool, setTool] = useState<'move' | 'x'>('move');
  const [focus, setFocus] = useState<number | null>(null);
  const [draft, setDraft] = useState<Stmt>(S('all', 0, 1));
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [conc, setConc] = useState<Stmt>(S('all', 0, 2));
  const [note, setNote] = useState('');
  const an = useMemo(() => analyse(labels, stmts), [labels, stmts]);
  const geo = useMemo(() => geometry(circles), [circles]);
  const live = marks.filter((m) => geo[m]?.exists);
  const missing = regionMasks(3).filter((m) => !geo[m]?.exists);
  const emptied = useMemo(() => [...new Set(stmts.filter(isUniversal).flatMap((s) => statementRegions(s, 3)))], [stmts]);
  const candidates = useMemo(() => {
    if (focus !== null && stmts[focus] && !isUniversal(stmts[focus]!)) return statementRegions(stmts[focus]!, 3);
    return [...new Set(stmts.filter((s) => !isUniversal(s) && !statementRegions(s, 3).some((r) => live.includes(r))).flatMap((s) => statementRegions(s, 3)))];
  }, [stmts, focus, live]);
  const dirty = () => setResult(null);
  const addStatement = () => {
    if (draft.a === draft.b) { setNote('Choose two different circles.'); return; }
    if (stmts.length >= 4) { setNote('Four statements is the most the builder holds. Remove one first.'); return; }
    if (stmts.some((s) => stmtKey(s) === stmtKey(draft) && s.form === draft.form)) { setNote('That statement is already there.'); return; }
    const next = [...stmts, draft];
    setStmts(next); dirty(); setNote('');
    const a = analyse(labels, next);
    announce(a.consistent ? `Added: ${stmtText(draft, labels)}. ${a.models.length} situations fit.` : a.message);
  };
  const removeStatement = (i: number) => { setStmts((s) => s.filter((_, j) => j !== i)); setFocus(null); dirty(); announce('Statement removed.'); };
  const toggle = (m: number) => { setMarks((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m])); dirty(); };
  const check = () => {
    const r = checkDiagram(labels, stmts, live);
    setResult({ ok: r.ok, lines: r.ok ? [`Consistent: your X marks (${live.length}) fit every statement. It is one of the ${an.models.length} situations the lab found.`] : r.problems });
    announce(r.ok ? 'Your diagram is consistent with all the statements.' : `Your diagram is not consistent. ${r.problems[0]}`);
  };
  const drawable = regionMasks(3).filter((m) => geo[m]?.exists);
  const solution = () => {
    if (!an.consistent) { setNote(an.message); return; }
    const m = simplestSituation(an, drawable);
    if (m === null) { setNote('Some regions are missing from your drawing, so no valid diagram can be drawn. Overlap the circles until all seven regions show.'); return; }
    setMarks(occupiedMasks(m, 3)); setResult(null); setNote('');
    announce(`A valid diagram with ${occupiedMasks(m, 3).length} X marks has been placed.`);
  };
  const setLabel = (k: number, w: string) => setLabels((l) => l.map((x, i) => (i === k ? w : x)));
  const concResult = an.consistent ? evaluate(an, conc) : null;
  const showPicture = (m: number | null) => { if (m === null) return; setMarks(occupiedMasks(m, 3)); setResult(null); announce('A picture has been placed on the diagram.'); };
  const setCircle = (k: number, patch: Partial<Circle>) => { setCircles((cs) => cs.map((c, i) => (i === k ? { ...c, ...patch } : c))); dirty(); };
  const options = (k: number) => ['ABC'[k]!, ...MENU_WORDS];
  return (
    <div className="space-y-3 p-3" data-bench="build">
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((k) => (
          <label key={k} className="block text-sm text-ink">
            <span style={{ color: COL[k] }} className="font-semibold">Circle {'ABC'[k]}</span> is called
            <select aria-label={`Name of circle ${'ABC'[k]}`} data-label-select={k} className={`${selectCls} mt-1`} value={labels[k]} onChange={(e) => setLabel(k, e.target.value)}>
              {options(k).map((w) => <option key={w} value={w} disabled={labels.some((x, j) => j !== k && x === w)}>{w}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div role="group" aria-label="Tool" className={segWrap}>
        <button type="button" aria-pressed={tool === 'move'} data-tool="move" onClick={() => setTool('move')} className={seg(tool === 'move')}>Move and resize circles</button>
        <button type="button" aria-pressed={tool === 'x'} data-tool="x" onClick={() => setTool('x')} className={seg(tool === 'x')}>Place X marks</button>
      </div>
      <p className="text-xs text-ink-3">{tool === 'move' ? 'Drag a circle to move it, drag its white dot to resize it, or focus it and use the arrow keys and + / −.' : 'Click or tap a region to put an X in it, and again to remove it. The region buttons below do the same from the keyboard.'}</p>
      <Venn circles={circles} labels={labels} emptied={emptied} candidates={candidates} marks={live} interactive tool={tool} onToggle={toggle} onMove={(k, cx, cy) => setCircle(k, { cx, cy })} onResize={(k, r) => setCircle(k, { r })} caption={`Venn builder with circles ${labels.join(', ')}. ${stmts.length} statements. ${live.length} X marks.`} narrow={narrow} dataName="builder" />
      <Legend />
      {missing.length > 0 && <p className="rounded-md bg-marker-soft p-2 text-sm text-ink" role="status" data-missing>These regions are not drawn yet: {missing.map((m) => regionName(m, labels, 3)).join('; ')}. Overlap the circles so that all seven regions appear.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((k) => <Slider key={k} id={`size-${k}`} label={`Size of ${labels[k]}`} unit="" shown={`${Math.round(circles[k]!.r)}`} value={Math.round(circles[k]!.r)} min={R_MIN} max={R_MAX} step={2} onChange={(r) => setCircle(k, { r })} />)}
      </div>
      <button type="button" className={btn} data-reset-circles onClick={() => { setCircles(DEFAULT3); setResult(null); }}><RotateCcw aria-hidden className="size-4" /> Put the circles back</button>

      <div className="space-y-2 border-t border-rule pt-3" data-statement-builder>
        <h3 className="text-sm font-semibold text-ink">Statements</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="text-sm"><span className="text-ink">First circle</span>
            <div role="group" aria-label="First circle of the statement" className={`${segWrap} mt-1`}>{[0, 1, 2].map((k) => <button key={k} type="button" aria-pressed={draft.a === k} data-first={k} onClick={() => setDraft({ ...draft, a: k })} className={seg(draft.a === k)}>{labels[k]}</button>)}</div></div>
          <div className="text-sm sm:col-span-1"><span className="text-ink">Statement type</span>
            <div role="group" aria-label="Statement type" className={`${segWrap} mt-1`}>{FORMS.map((f) => <button key={f} type="button" aria-pressed={draft.form === f} data-form={f} onClick={() => setDraft({ ...draft, form: f })} className={seg(draft.form === f)}>{FORM_BTN[f]}</button>)}</div></div>
          <div className="text-sm"><span className="text-ink">Second circle</span>
            <div role="group" aria-label="Second circle of the statement" className={`${segWrap} mt-1`}>{[0, 1, 2].map((k) => <button key={k} type="button" aria-pressed={draft.b === k} data-second={k} onClick={() => setDraft({ ...draft, b: k })} className={seg(draft.b === k)}>{labels[k]}</button>)}</div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnMain} data-add onClick={addStatement}>Add: {stmtText(draft, labels)}</button>
          <button type="button" className={btn} data-example onClick={() => { setLabels(['dogs', 'animals', 'pets']); setStmts([S('all', 0, 1), S('some', 1, 2)]); setMarks([]); setFocus(null); setResult(null); setNote(''); announce('Example loaded: All dogs are animals. Some animals are pets.'); }}>Try an example</button>
          {stmts.length > 0 && <button type="button" className={btn} data-clear-statements onClick={() => { setStmts([]); setMarks([]); setFocus(null); setResult(null); }}><Trash2 aria-hidden className="size-4" /> Clear all</button>}
        </div>
        {note && <p className="text-sm text-wrong" role="alert" data-note>{note}</p>}
        {stmts.length > 0 && (
          <ol className="space-y-1.5" data-statement-list>
            {stmts.map((s, i) => {
              const rs = statementRegions(s, 3);
              return (
                <li key={`${stmtKey(s)}-${s.form}-${i}`} className="rounded-md border border-rule p-2 text-sm" data-statement={i}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-ink">{i + 1}. {stmtText(s, labels)}</strong>
                    <button type="button" className={btn} aria-pressed={focus === i} onClick={() => setFocus(focus === i ? null : i)} data-focus={i}>{focus === i ? 'Hide on diagram' : 'Show on diagram'}</button>
                    <button type="button" className={btn} aria-label={`Remove statement ${i + 1}`} data-remove={i} onClick={() => removeStatement(i)}>Remove</button>
                  </div>
                  <p className="mt-1 text-ink-2">{isUniversal(s) ? `Empties ${rs.length === 1 ? 'this region' : 'these regions'}: ` : 'Needs an X in one of these regions: '}{rs.map((r) => regionName(r, labels, 3)).join('; ')}.</p>
                </li>
              );
            })}
          </ol>
        )}
        <p className="rounded-md border border-rule bg-paper p-2 text-sm text-ink" role="status" data-situations>
          {stmts.length === 0 ? 'Add a statement to see how it changes the diagram.' : an.consistent ? <><strong className="num">{an.models.length}</strong> of the {an.space} ways to fill the regions fit these statements.</> : <span className="text-wrong">{an.message}</span>}
        </p>
      </div>

      <div className="space-y-2 border-t border-rule pt-3" data-regions>
        <h3 className="text-sm font-semibold text-ink">Regions and X marks</h3>
        <p className="text-xs text-ink-3">Put at least one X in the regions that must have a member, and none in the empty ones. Then check.</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {regionMasks(3).map((m) => {
            const exists = geo[m]?.exists;
            const on = live.includes(m);
            const isEmpty = emptied.includes(m);
            return (
              <button key={m} type="button" data-region={m} aria-pressed={on} disabled={!exists} onClick={() => toggle(m)} className={`flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm ring-1 ring-inset disabled:opacity-40 ${on ? 'bg-accent-soft ring-accent' : 'bg-surface ring-rule-strong hover:bg-paper'}`}>
                <span>{regionName(m, labels, 3)}</span>
                <span className="num text-xs text-ink-2">{!exists ? 'not drawn' : on ? 'X placed' : isEmpty ? 'empty' : 'open'}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnMain} data-check-diagram onClick={check}>Check my diagram</button>
          <button type="button" className={btn} data-solution onClick={solution}>Show a valid diagram</button>
          <button type="button" className={btn} data-clear-marks onClick={() => { setMarks([]); setResult(null); }}>Clear X marks</button>
        </div>
        {result && (
          <div className={`rounded-md border p-2 text-sm ${result.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} role="status" data-result data-ok={String(result.ok)}>
            {result.ok ? <strong>Consistent. </strong> : <strong>Not consistent yet.</strong>}
            <ul className="list-disc pl-5">{result.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-rule pt-3" data-tester>
        <h3 className="text-sm font-semibold text-ink">Does this conclusion follow?</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-sm text-ink">First circle<select aria-label="Conclusion first circle" data-conc-a className={`${selectCls} mt-1`} value={conc.a} onChange={(e) => setConc({ ...conc, a: Number(e.target.value) })}>{[0, 1, 2].map((k) => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
          <label className="block text-sm text-ink">Type<select aria-label="Conclusion type" data-conc-form className={`${selectCls} mt-1`} value={conc.form} onChange={(e) => setConc({ ...conc, form: e.target.value as Form })}>{FORMS.map((f) => <option key={f} value={f}>{FORM_BTN[f]}</option>)}</select></label>
          <label className="block text-sm text-ink">Second circle<select aria-label="Conclusion second circle" data-conc-b className={`${selectCls} mt-1`} value={conc.b} onChange={(e) => setConc({ ...conc, b: Number(e.target.value) })}>{[0, 1, 2].map((k) => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
        </div>
        {conc.a === conc.b ? <p className="text-sm text-ink-3">Choose two different circles.</p> : concResult ? (
          <div className="rounded-md border border-rule bg-paper p-2 text-sm text-ink" role="status" data-conc-result data-verdict={concResult.verdict}>
            <strong>“{stmtText(conc, labels)}”: {VERDICT_LABEL[concResult.verdict]}.</strong> True in <span className="num">{concResult.trueIn}</span> of <span className="num">{concResult.total}</span> pictures.
            <ul className="mt-1 list-disc pl-5">{concResult.argument.map((l, i) => <li key={i}>{l}</li>)}</ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {concResult.counter !== null && <button type="button" className={btn} data-show-counter onClick={() => showPicture(concResult.counter)}>Draw a picture where it is false</button>}
              {concResult.witness !== null && <button type="button" className={btn} data-show-witness onClick={() => showPicture(concResult.witness)}>Draw a picture where it is true</button>}
            </div>
          </div>
        ) : <p className="text-sm text-ink-3">{stmts.length ? an.message : 'Add statements first.'}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ tabs 2 and 3

interface Incoming { nonce: number; problem: Problem; showAll: boolean }

function SolverTab({ narrow, announce, incoming }: { narrow: boolean; announce: (t: string) => void; incoming: Incoming | null }) {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const [custom, setCustom] = useState<Incoming | null>(null);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [checked, setChecked] = useState(false);
  const lastNonce = useRef(0);
  useEffect(() => {
    if (incoming && incoming.nonce !== lastNonce.current) { lastNonce.current = incoming.nonce; setCustom(incoming); setPicks({}); setChecked(false); }
  }, [incoming]);
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const problem: Problem = custom ? custom.problem : { id: `preset-${preset.id}`, seed: 0, level: 1, labels: preset.labels, statements: preset.statements, conclusions: preset.conclusions };
  const pickPreset = (id: string) => { setPresetId(id); setCustom(null); setPicks({}); setChecked(false); };
  return (
    <div data-bench="solve">
      <div className="space-y-2 px-3 pt-3">
        <div role="group" aria-label="Problem" className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.id} type="button" aria-pressed={!custom && presetId === p.id} data-preset={p.id} onClick={() => pickPreset(p.id)} className={`h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${!custom && presetId === p.id ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong'}`}>{p.title}</button>)}
        </div>
        <p className="text-sm text-ink-2">{custom ? 'Shown from your prediction. Pick another problem to solve one yourself.' : preset.note}</p>
        <p className="text-xs text-ink-3"><strong>Follows</strong>: true in every picture. <strong>Does not follow</strong>: false in at least one picture. <strong>Possible</strong>: true in some pictures and false in others (so it also does not follow).</p>
      </div>
      <ProblemPanel problem={problem} picks={picks} onPick={(i, p) => setPicks((x) => ({ ...x, [i]: p }))} checked={checked} onCheck={() => setChecked(true)} showAll={!!custom?.showAll} hintIdx={null} narrow={narrow} announce={announce} />
    </div>
  );
}

export interface PracticeRow { key: string; seed: number; level: Level; situations: number; follows: number; possible: number; impossible: number; right: number; total: number; allRight: boolean; hints: number }

function PracticeTab({ narrow, announce, onRecord, recorded }: { narrow: boolean; announce: (t: string) => void; onRecord: (r: PracticeRow, note: string) => void; recorded: PracticeRow[] }) {
  const [level, setLevel] = useState<Level>(1);
  const [seed, setSeed] = useState(101);
  const [seedText, setSeedText] = useState('101');
  const problem = useMemo(() => generateProblem(seed, level), [seed, level]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [checked, setChecked] = useState(false);
  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const [hints, setHints] = useState(0);
  const [session, setSession] = useState({ right: 0, total: 0 });
  const fresh = (s: number, l: Level) => { setSeed(s); setSeedText(String(s)); setLevel(l); setPicks({}); setChecked(false); setHintIdx(null); setHints(0); };
  const an = useMemo(() => analyse(problem.labels, problem.statements), [problem]);
  const check = () => {
    const st = problemStats(problem);
    const ok = problem.conclusions.map((c, i) => gradePick(verdictOf(an, c), picks[i]!));
    const right = ok.filter(Boolean).length;
    setChecked(true);
    setSession((s) => ({ right: s.right + right, total: s.total + ok.length }));
    const row: PracticeRow = { key: `${level}:${seed}`, seed, level, situations: st.situations, follows: st.follows, possible: st.possible, impossible: st.impossible, right, total: ok.length, allRight: right === ok.length, hints };
    onRecord(row, problemSignature(problem));
  };
  const hasRow = recorded.some((r) => r.key === `${level}:${seed}`);
  return (
    <div data-bench="practice">
      <div className="grid gap-2 px-3 pt-3 sm:grid-cols-[1fr_auto]">
        <div className="text-sm"><span className="text-ink">Level</span>
          <div role="group" aria-label="Level" className={`${segWrap} mt-1`}>
            {([1, 2, 3] as Level[]).map((l) => <button key={l} type="button" aria-pressed={level === l} data-level={l} onClick={() => fresh(seed, l)} className={seg(level === l)}>{LEVEL_NAME[l]}</button>)}
          </div>
        </div>
        <label className="block text-sm text-ink">Seed (same seed, same problem)
          <span className="mt-1 flex gap-1.5">
            <input data-seed aria-label="Seed" inputMode="numeric" className="h-9 w-24 rounded-md border border-rule-strong bg-surface px-2 text-ink" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number(seedText); if (seedText && v >= 1) fresh(v, level); } }} />
            <button type="button" className={btn} data-go-seed onClick={() => { const v = Number(seedText); if (seedText && v >= 1) fresh(v, level); }}>Open</button>
            <button type="button" className={btnMain} data-next onClick={() => fresh(seed + 1, level)}>New problem</button>
          </span>
        </label>
      </div>
      <p className="px-3 pt-2 text-sm text-ink-2" data-session>Seed <span className="num">{seed}</span> · {LEVEL_NAME[level]} · This visit: <strong className="num">{session.right}</strong> of <span className="num">{session.total}</span> conclusions right{recorded.length > 0 ? ` · ${recorded.length} problem${recorded.length === 1 ? '' : 's'} recorded` : ''}.</p>
      <ProblemPanel problem={problem} picks={picks} onPick={(i, p) => setPicks((x) => ({ ...x, [i]: p }))} checked={checked} onCheck={check} practice hintIdx={hintIdx} onHint={(i) => { setHintIdx(i); setHints((h) => h + 1); announce(hintFor(an, problem.conclusions[i]!).text); }} narrow={narrow} announce={announce} />
      {checked && (
        <div className="space-y-2 px-3 pb-3">
          <p className="text-sm text-ink-2" role="status" data-recorded>{hasRow ? 'This problem is recorded in your Measure table (your first check counts).' : 'This problem was not recorded again.'}</p>
          <button type="button" className={btnMain} data-next-after onClick={() => fresh(seed + 1, level)}>Next problem</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ analysis chart

function Chart({ rows }: { rows: PracticeRow[] }) {
  const max = Math.max(...rows.map((r) => r.situations), 1);
  const W = 330, H = 150, bw = Math.min(46, (W - 50) / rows.length - 8);
  const y = (v: number) => 118 - (v / max) * 92;
  return (
    <figure>
      <figcaption className="mb-1 text-sm font-semibold text-ink">Situations that fit each problem you solved</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={`Bar chart. ${rows.map((r) => `Seed ${r.seed}: ${r.situations} situations, ${r.possible} conclusions only possible, ${r.allRight ? 'first answers all right' : 'some first answers wrong'}`).join('. ')}`} data-chart>
        <line x1={34} y1={118} x2={W - 4} y2={118} stroke="#9ca3af" />
        <line x1={34} y1={14} x2={34} y2={118} stroke="#9ca3af" />
        <text x={32} y={22} fontSize={8} textAnchor="end" fill="#4d5768">{max}</text>
        <text x={32} y={118} fontSize={8} textAnchor="end" fill="#4d5768">0</text>
        {rows.map((r, i) => {
          const x = 44 + i * ((W - 54) / rows.length);
          return (
            <g key={r.key}>
              <rect x={x} y={y(r.situations)} width={bw} height={118 - y(r.situations)} fill={r.allRight ? '#1d7a4b' : '#b42318'} />
              <text x={x + bw / 2} y={y(r.situations) - 3} fontSize={9} textAnchor="middle" fill="#111827" fontWeight={700}>{r.situations}</text>
              <text x={x + bw / 2} y={130} fontSize={7.5} textAnchor="middle" fill="#4d5768">seed {r.seed}</text>
              <text x={x + bw / 2} y={140} fontSize={7.5} textAnchor="middle" fill="#4d5768">{r.possible} possible</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-ink-3">Bar height: number of Venn situations that fit. Green: all first answers right. Red: at least one first answer wrong.</p>
    </figure>
  );
}

// ------------------------------------------------------------------ the page

export function SyllogismLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [params, setParams] = useSearchParams();
  const startTab = params.get('tab');
  const narrow = useNarrow();
  const [tab, setTabState] = useState<Tab>(startTab === 'solve' || startTab === 'practice' || startTab === 'build' ? startTab : 'build');
  const setTab = (t: Tab) => {
    setTabState(t);
    setParams((p) => { const q = new URLSearchParams(p); q.set('tab', t); return q; }, { replace: true });
  };
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<PracticeRow[]>([]);
  const [sigs, setSigs] = useState<string[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [announce, setAnnounce] = useState('');
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const nonce = useRef(0);
  const say = (t: string) => setAnnounce(t);

  const recordRow = (r: PracticeRow, sig: string) => {
    if (rows.some((x) => x.key === r.key) || sigs.includes(sig)) return;
    setRows((x) => [...x, r].sort((a, b) => a.seed - b.seed));
    setSigs((s) => [...s, sig]);
  };
  const distinct = new Set(rows.map((r) => r.seed)).size;
  const canAnalyse = distinct >= 3;
  const finished = Object.keys(ans).length === APPLY.length;
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!canAnalyse ? [`solve at least three different generated problems (different seeds) in the Practice tab and check them (${distinct} so far)`] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, seen[2] ?? false, canAnalyse, canAnalyse, seen[5] ?? false, finished];

  const lockPrediction = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    const pair = p.kind === 'statements' ? S4_PAIRS[p.answer]! : p.statements;
    nonce.current++;
    setIncoming({ nonce: nonce.current, showAll: true, problem: { id: `pred-${p.id}`, seed: 0, level: 1, labels: p.labels, statements: pair, conclusions: p.conclusions } });
    setTab('solve');
    setTested((x) => ({ ...x, [p.id]: true }));
  };
  const explain = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    const vs = predictionVerdicts(p);
    if (p.kind === 'statements') {
      const parts = S4_PAIRS.map((pair, k) => {
        const an = analyse(p.labels, pair);
        const r = evaluate(an, p.conclusions[0]!);
        return `${pair.map((s) => stmtText(s, p.labels)).join(' and ')}: ${VERDICT_LABEL[vs[k]!].toLowerCase()} (true in ${r.trueIn} of ${r.total} pictures)`;
      });
      return `The bench checked every picture for each pair. ${parts.join('; ')}. A possibility needs a mix of pictures where “Some A are C” is true and pictures where it is false. The solver tab now shows the winning pair with its proof.`;
    }
    const an = analyse(p.labels, p.statements);
    if (p.kind === 'verdict') {
      const r = evaluate(an, p.conclusions[0]!);
      return `The bench found ${r.total} pictures that fit the statements. “${stmtText(p.conclusions[0]!, p.labels)}” is true in ${r.trueIn} of them: ${VERDICT_LABEL[r.verdict].toLowerCase()}. ${r.verdict === 'possible' ? 'Do not reverse an “All” statement: the circles may be equal, but they may also not be.' : ''}`;
    }
    const lines = p.conclusions.map((c, k) => `“${stmtText(c, p.labels)}”: ${vs[k]}`).join('; ');
    return `The bench found ${an.models.length} pictures that fit. ${lines}. Only “${p.options[p.answer]}” is true in every one of them: the member that is in A and B cannot be in C, because no B is C.`;
  };
  const reset = () => { setResetKey((k) => k + 1); setIncoming(null); setAnnounce('Bench reset.'); };
  const bandRows = useMemo(() => (step === 4 && canAnalyse ? sampleBands(150) : []), [step, canAnalyse]);
  const best = rows.length ? [...rows].sort((a, b) => b.situations - a.situations) : [];
  const hidden = (t: Tab) => (tab === t ? '' : 'hidden');

  return (
    <div data-syllogism-lab data-tab={tab}>
      <PageHeader back={back} title="Venn Diagram and Syllogism Lab" subtitle={<span className="inline-flex flex-wrap items-center gap-2">General Aptitude Test · Logical and analytical reasoning <Badge tone="amber">Draft – unverified</Badge></span>} />
      <StepNav step={step} seen={seen} done={done} go={go} names={STEP_NAMES} />
      <p className="sr-only" role="status" aria-live="polite" data-announce>{announce}</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div role="tablist" aria-label="Bench" className="flex flex-wrap gap-1 border-b border-rule p-2">
              {TABS.map((t) => (
                <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} data-tab-btn={t.id} onClick={() => setTab(t.id)} className={`h-8 rounded-md px-3 text-[13px] font-medium ${tab === t.id ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'text-ink-2 hover:bg-ink/5'}`}>{t.label}</button>
              ))}
            </div>
            <div className={hidden('build')} role="tabpanel" aria-label="Venn builder"><BuilderTab key={`b${resetKey}`} narrow={narrow} announce={say} /></div>
            <div className={hidden('solve')} role="tabpanel" aria-label="Syllogism solver"><SolverTab key={`s${resetKey}`} narrow={narrow} announce={say} incoming={incoming} /></div>
            <div className={hidden('practice')} role="tabpanel" aria-label="Practice"><PracticeTab key={`p${resetKey}`} narrow={narrow} announce={say} onRecord={recordRow} recorded={rows} /></div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">A syllogism question gives statements and asks which conclusions follow. The lesson’s rule: a conclusion follows only if it is true in <strong>every</strong> Venn picture that fits the statements. This lab draws all the pictures for you.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Venn builder:</strong> drag and resize three circles, add statements from the four types, and place X marks to make a picture that fits. The lab checks it.</li>
                <li><strong>Syllogism solver:</strong> give your verdict on each conclusion. The lab then tries every picture and shows a counter-example, or the shortest argument.</li>
                <li><strong>Practice:</strong> endless generated problems at three levels, with a hint that points to the region to check.</li>
              </ul>
              <p className="text-sm text-ink-2">Conventions used (the lesson’s): “Some” means at least one and possibly all. Every circle named in a statement has at least one member. Ignore what you know about the real world.</p>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard items={PREDICTS} index={pi} picked={picked} tested={tested} onSelect={setPi} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))} onLock={lockPrediction} explain={explain} onNext={() => setPi(pi + 1)} onDone={() => go(2)} />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Builder:</strong> press “Try an example”, then place X marks until “Check my diagram” says consistent. Then put an X in a hatched region and read why it fails.</li>
                <li><strong>Builder:</strong> add “No A is B” and move circle A away from B. Do the regions still exist? Which statements empty the regions?</li>
                <li><strong>Solver:</strong> open “Two particular statements” and guess each conclusion before checking. How many pictures fit?</li>
                <li><strong>Solver:</strong> open “Some means at least one”. Why is “All dogs are pets” only possible?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">In the Practice tab, solve at least <strong>three different generated problems</strong> (different seeds). Each problem you check is recorded here automatically, with whether your first answers were right and how many Venn situations fit.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnMain} data-open-practice onClick={() => setTab('practice')}>Open the Practice tab</button>
                {rows.length > 0 && <button type="button" className={btn} onClick={() => { setRows([]); setSigs([]); }}>Clear table</button>}
              </div>
              <p className="text-sm text-ink-2" role="status" data-measure-note>{distinct} different problem{distinct === 1 ? '' : 's'} recorded{canAnalyse ? '. Enough to analyse.' : ` (need 3).`}</p>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <caption className="mb-1 text-left text-xs text-ink-3">Your first check of each problem.</caption>
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Seed</th><th className="pr-2">Level</th><th className="pr-2">Situations</th><th className="pr-2">Follow</th><th className="pr-2">Possible</th><th className="pr-2">Cannot</th><th className="pr-2">Right</th><th>First answers</th></tr></thead>
                    <tbody className="num">{rows.map((r) => <tr key={r.key} className="border-t border-rule"><td className="py-1 pr-2 font-semibold">{r.seed}</td><td className="pr-2">{LEVEL_NAME[r.level]}</td><td className="pr-2">{r.situations}</td><td className="pr-2">{r.follows}</td><td className="pr-2">{r.possible}</td><td className="pr-2">{r.impossible}</td><td className="pr-2">{r.right}/{r.total}</td><td>{r.allRight ? 'all right' : 'some wrong'}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              {canAnalyse && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my results</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canAnalyse ? (
                <>
                  <Chart rows={rows} />
                  <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink" data-findings>
                    <li>You solved <strong className="num">{rows.length}</strong> problems and had all first answers right in <strong className="num">{rows.filter((r) => r.allRight).length}</strong> of them ({f0(rows.filter((r) => r.allRight).length / rows.length)}).</li>
                    <li>The problem with the most pictures (<strong className="num">{best[0]!.situations}</strong>, seed {best[0]!.seed}) had <strong className="num">{best[0]!.possible}</strong> of {best[0]!.follows + best[0]!.possible + best[0]!.impossible} conclusions that were only possible. The one with the fewest (<strong className="num">{best.at(-1)!.situations}</strong>, seed {best.at(-1)!.seed}) had <strong className="num">{best.at(-1)!.possible}</strong>.</li>
                  </ul>
                  <div className="overflow-x-auto" data-bands>
                    <table className="w-full text-sm">
                      <caption className="mb-1 text-left text-xs text-ink-3">The lab checked 450 generated problems (150 seeds, three levels).</caption>
                      <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Situations that fit</th><th className="pr-2">Problems</th><th className="pr-2">Conclusions only possible</th><th>Conclusions that follow</th></tr></thead>
                      <tbody className="num">{bandRows.map((b) => <tr key={b.label} className="border-t border-rule"><td className="py-1 pr-2">{b.label}</td><td className="pr-2">{b.problems}</td><td className="pr-2 font-semibold">{f0(b.possibleShare)}</td><td>{f0(b.followsShare)}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <p className="text-[15px] text-ink" data-why><strong>Why.</strong> Each statement removes some ways of filling the regions. With few statements, many pictures fit, so a conclusion is likely to be true in some and false in others: it is only <em>possible</em>. With more or stronger statements, fewer pictures fit, and more conclusions are true in all of them: they <em>follow</em>. That is why “All” and “No” statements (which empty regions) lead to conclusions much more often than “Some” statements (which only say one region has a member).</p>
                </>
              ) : <p className="text-[15px] text-ink">Solve and check three different generated problems in the Practice tab first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-3 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>A conclusion <strong>follows</strong> only if it is true in <strong>every</strong> picture that fits the statements. If you can draw one picture where it fails, it does not follow.</li>
                <li><strong>Possible</strong> is not the same as follows: it is true in some pictures and false in others.</li>
                <li>“Some” means at least one, and possibly all. So “Some A are B” does not tell you whether all A are B, or whether some A are not B.</li>
                <li>In the lesson’s convention every circle named in a statement has at least one member. That is why “All A are B” can be reversed to “Some B are A”, but never to “All B are A”.</li>
                <li>Two “Some” statements give no conclusion about the two outer circles, and two negative statements give none either.</li>
              </ul>
              <div className="overflow-x-auto" data-rules>
                <table className="w-full text-sm">
                  <caption className="mb-1 text-left text-xs text-ink-3">The lesson’s rules, each re-checked by the lab over every picture.</caption>
                  <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Rule</th><th>Checked</th></tr></thead>
                  <tbody>{LESSON_RULES.map((r) => { const v: Verdict = verdictOf(analyse(r.labels, r.statements), r.conclusion); return <tr key={r.id} className="border-t border-rule align-top"><td className="py-1 pr-2 text-ink">{r.rule}<div className="text-xs text-ink-3">{r.statements.map((s) => stmtText(s, r.labels)).join('. ')}. So “{stmtText(r.conclusion, r.labels)}”.</div></td><td className="num whitespace-nowrap">{VERDICT_LABEL[v].split(' (')[0]}</td></tr>; })}</tbody>
                </table>
              </div>
              <p className="text-xs text-ink-3">A statement “All A are B” is the opposite of “Some A are not B”, and “No A is B” is the opposite of “Some A are B”: exactly one of each pair is true in every picture ({stmtText(negate(S('all', 0, 1)), ['A', 'B'])}).</p>
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
