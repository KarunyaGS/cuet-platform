import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  alleleFreqFromCounts, APPLY, buildSquare, checkMystery, checkP, CROSS_ORDER, CROSSES, deterministicPath, deviation, genotypeText, hwExpectedCounts, hwFreqs, HW_DATASETS, inEquilibrium, linearFit, logLogSlope,
  MEASURE_CROSS, MEASURE_SIZES, measureRow, meanDrift, mysteryTask, NO_FACTORS, pairText, PREDICTS, phenotypeOf, raiseOffspring, ratioText, simulateDrift, subSeed, tally,
  type CrossId, type Genotype, type MeasureRow, type Pair,
} from '../visual/genetics';

type Tab = 'cross' | 'hw';
const TABS: { id: Tab; label: string }[] = [
  { id: 'cross', label: 'Crosses' },
  { id: 'hw', label: 'Hardy-Weinberg and drift' },
];
const STEP_NAMES = ['Discover', 'Predict', 'Experiment', 'Measure', 'Analyse', 'Understand', 'Apply'] as const;
const COL = { a: '#2347a8', b: '#b42318', c: '#1d7a4b', d: '#d58a00', e: '#6b3fa0', ink: '#4d5768' };
const REP = [COL.a, COL.b, COL.c, COL.d, COL.e];
const N_BUTTONS = [10, 50, 200, 1000];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const f2 = (x: number) => x.toFixed(2);

/** Allele symbols with the blood-group superscripts: I^A is shown as I with a small A. */
function Sym({ t }: { t: string }) {
  return (
    <>
      {t.split(/(I\^[AB])/).map((s, i) => (/^I\^[AB]$/.test(s) ? <span key={i}>I<sup>{s[2]}</sup></span> : <span key={i}>{s}</span>))}
    </>
  );
}

const seg = (on: boolean) => `h-8 flex-1 rounded px-2 text-[13px] font-medium ${on ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`;
const segWrap = 'inline-flex w-full flex-wrap gap-0.5 rounded-md bg-ink/5 p-0.5';
const input = 'h-9 w-full rounded-md border border-rule-strong bg-surface px-2 text-sm text-ink';

// ------------------------------------------------------------------ charts

function HwBars({ p }: { p: number }) {
  const f = hwFreqs(p);
  const bars = [{ k: 'AA', v: f.AA, c: COL.a, f: 'p²' }, { k: 'Aa', v: f.Aa, c: COL.d, f: '2pq' }, { k: 'aa', v: f.aa, c: COL.b, f: 'q²' }];
  return (
    <svg viewBox="0 0 200 118" className="w-full max-w-md" role="img" aria-label={`Genotype frequencies for p = ${f2(p)}: AA ${f2(f.AA)}, Aa ${f2(f.Aa)}, aa ${f2(f.aa)}`} data-hwbars>
      <rect x={30} y={10} width={160} height={78} fill="#fff" stroke="#e5e5e5" />
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={30} x2={190} y1={88 - t * 78} y2={88 - t * 78} stroke="#eee" />
          <text x={27} y={90.5 - t * 78} fontSize={6.5} textAnchor="end" fill={COL.ink}>{t}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const h = b.v * 78;
        const x = 44 + i * 50;
        return (
          <g key={b.k} data-hwbar={b.k}>
            <rect x={x} y={88 - h} width={34} height={h} fill={b.c} />
            <text x={x + 17} y={88 - h - 3} fontSize={7.5} textAnchor="middle" fontWeight={600} fill="#111">{f2(b.v)}</text>
            <text x={x + 17} y={98} fontSize={7.5} textAnchor="middle" fill="#111">{b.k}</text>
            <text x={x + 17} y={106} fontSize={6.5} textAnchor="middle" fill={COL.ink}>{b.f}</text>
          </g>
        );
      })}
      <text x={190} y={116} fontSize={6} textAnchor="end" fill={COL.ink}>frequency of each genotype</text>
    </svg>
  );
}

function Trajectory({ reps, det, gens, label }: { reps: number[][]; det: number[]; gens: number; label: string }) {
  const X = (t: number) => 30 + (t / gens) * 160;
  const Y = (p: number) => 88 - p * 78;
  const line = (a: number[]) => a.map((p, t) => `${X(t)},${Y(p)}`).join(' ');
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-lg" role="img" aria-label={label} data-trajectory>
      <rect x={30} y={10} width={160} height={78} fill="#fff" stroke="#e5e5e5" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={30} x2={190} y1={Y(t)} y2={Y(t)} stroke="#eee" />
          <text x={27} y={Y(t) + 2.5} fontSize={6.5} textAnchor="end" fill={COL.ink}>{t}</text>
        </g>
      ))}
      <polyline points={line(det)} fill="none" stroke="#111" strokeWidth={1.2} strokeDasharray="3 2" />
      {reps.map((r, i) => <polyline key={i} points={line(r)} fill="none" stroke={REP[i % REP.length]} strokeWidth={1.2} data-rep={i} />)}
      <text x={110} y={99} fontSize={6.5} textAnchor="middle" fill={COL.ink}>generation (0 to {gens})</text>
      <text x={30} y={7} fontSize={6.5} fill={COL.ink}>allele frequency p of A</text>
      <line x1={30} x2={40} y1={106} y2={106} stroke="#111" strokeDasharray="3 2" />
      <text x={43} y={108} fontSize={6} fill={COL.ink}>infinite population (no drift)</text>
      <text x={30} y={104} fontSize={0.1} fill={COL.ink}> </text>
      <text x={190} y={108} fontSize={6} textAnchor="end" fill={COL.ink}>coloured: 5 populations</text>
    </svg>
  );
}

/** Log-log plot of deviation against n. */
function DeviationPlot({ rows, fit }: { rows: MeasureRow[]; fit: { slope: number; intercept: number } }) {
  const xs = rows.map((r) => Math.log10(r.n));
  const lo = Math.floor(Math.min(...xs) * 2) / 2, hi = Math.ceil(Math.max(...xs) * 2) / 2;
  const ysAll = rows.flatMap((r) => [Math.log10(r.typical), ...(r.dev > 0 ? [Math.log10(r.dev)] : [])]);
  const yLo = Math.floor(Math.min(...ysAll) * 2) / 2 - 0.25, yHi = Math.ceil(Math.max(...ysAll) * 2) / 2 + 0.25;
  const X = (x: number) => 34 + ((x - lo) / (hi - lo || 1)) * 150;
  const Y = (y: number) => 80 - ((y - yLo) / (yHi - yLo || 1)) * 62;
  const y0 = Math.log10(rows[0]!.typical);
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-md" role="img" aria-label="Log-log graph of the deviation from the expected ratio against the number of offspring; the points fall along a line of slope about minus one half" data-devplot>
      <rect x={34} y={18} width={150} height={62} fill="#fff" stroke="#e5e5e5" />
      {rows.map((r) => (
        <g key={r.n}>
          <line x1={X(Math.log10(r.n))} x2={X(Math.log10(r.n))} y1={80} y2={82} stroke={COL.ink} />
          <text x={X(Math.log10(r.n))} y={89} fontSize={6.2} textAnchor="middle" fill={COL.ink}>{r.n}</text>
        </g>
      ))}
      <line x1={X(lo)} y1={Y(y0 - 0.5 * (lo - xs[0]!))} x2={X(hi)} y2={Y(y0 - 0.5 * (hi - xs[0]!))} stroke="#111" strokeDasharray="3 2" strokeWidth={0.9} />
      <line x1={X(lo)} y1={Y(fit.intercept + fit.slope * lo)} x2={X(hi)} y2={Y(fit.intercept + fit.slope * hi)} stroke={COL.a} strokeWidth={1.2} />
      {rows.map((r) => <circle key={`t${r.n}`} cx={X(Math.log10(r.n))} cy={Y(Math.log10(r.typical))} r={2.6} fill={COL.a} />)}
      {rows.map((r) => (r.dev > 0 ? <circle key={`s${r.n}`} cx={X(Math.log10(r.n))} cy={Y(Math.log10(r.dev))} r={2.6} fill="#fff" stroke={COL.b} strokeWidth={1.2} /> : null))}
      <text x={184} y={98} fontSize={6.5} textAnchor="end" fill={COL.ink}>number of offspring n (log scale)</text>
      <text x={36} y={13} fontSize={6.5} fill={COL.ink}>deviation from expected (log scale)</text>
      <circle cx={38} cy={106} r={2.2} fill={COL.a} /><text x={43} y={108} fontSize={5.2} fill={COL.ink}>typical (200 runs)</text>
      <circle cx={98} cy={106} r={2.2} fill="#fff" stroke={COL.b} /><text x={103} y={108} fontSize={5.6} fill={COL.ink}>your one run</text>
      <line x1={146} x2={154} y1={106} y2={106} stroke="#111" strokeDasharray="3 2" /><text x={156} y={108} fontSize={5.6} fill={COL.ink}>slope −½</text>
    </svg>
  );
}

// ------------------------------------------------------------------ the page

export function GeneticsLabPage() {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [params, setParams] = useSearchParams();
  const startTab = params.get('tab');
  const [tab, setTabState] = useState<Tab>(startTab === 'hw' ? 'hw' : 'cross');
  const setTab = (t: Tab) => {
    setTabState(t);
    setParams((p) => { const q = new URLSearchParams(p); q.set('tab', t); return q; }, { replace: true });
  };
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [ans, setAns] = useState<Record<string, number>>({});
  const [announce, setAnnounce] = useState('');

  // ---------- crosses
  const [cross, setCross] = useState<CrossId>('mono');
  const def = CROSSES[cross];
  const [gA, setGA] = useState<Genotype>(def.defaultA);
  const [gB, setGB] = useState<Genotype>(def.defaultB);
  const sq = useMemo(() => buildSquare(cross, gA, gB), [cross, gA, gB]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selCell, setSelCell] = useState<number | null>(null);
  const [cellMsg, setCellMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [seed, setSeedState] = useState(7);
  const [ranN, setRanN] = useState<number | null>(null);
  const [history, setHistory] = useState<{ n: number; dev: number }[]>([]);
  const clearRun = () => { setRanN(null); setHistory([]); };
  const clearCells = () => { setRevealed({}); setSelCell(null); setCellMsg(null); };
  const setSeed = (s: number) => { setSeedState(s); clearRun(); };
  const chooseCross = (id: CrossId) => { setCross(id); setGA(CROSSES[id].defaultA); setGB(CROSSES[id].defaultB); clearCells(); clearRun(); setAnnounce(`${CROSSES[id].label} cross chosen.`); };
  const setLocus = (which: 'A' | 'B', i: number, text: string) => {
    const choice = (which === 'A' ? def.choicesA : def.choicesB)[i]!.find((c) => pairText(c) === text);
    if (!choice) return;
    (which === 'A' ? setGA : setGB)((g) => g.map((p, k) => (k === i ? choice : p)));
    clearCells(); clearRun();
  };
  const run = useMemo(() => (ranN === null ? null : { n: ranN, drawn: raiseOffspring(sq, ranN, seed) }), [sq, ranN, seed]);
  const runTally = useMemo(() => (run ? tally(sq, run.drawn) : null), [sq, run]);
  const raise = (n: number) => {
    const t = tally(sq, raiseOffspring(sq, n, seed));
    setRanN(n);
    const dev = deviation(sq, t.pheno);
    setHistory((h) => [...h.filter((x) => x.n !== n), { n, dev }].sort((a, b) => a.n - b.n));
    setAnnounce(`Raised ${n} offspring with seed ${seed}. Deviation from the expected ratio ${pct(dev)}.`);
  };
  const genoOptions = sq.genoLabels.filter((_, i) => sq.genoCounts[i]! > 0);
  const pickGenotype = (label: string) => {
    if (selCell === null) return;
    const right = sq.cellText[selCell]!;
    const r = Math.floor(selCell / sq.cols.length), c = selCell % sq.cols.length;
    if (label === right) {
      setRevealed((x) => ({ ...x, [selCell]: true }));
      setCellMsg({ ok: true, text: `Correct: ${right}. This zygote gets the gamete ${sq.rows[r]} from one parent and ${sq.cols[c]} from the other, and the phenotype is ${phenotypeOf(cross, sq.cells[selCell]!).toLowerCase()}.` });
    } else {
      setCellMsg({ ok: false, text: `Not ${label}. Join the gamete at the left of this row (${sq.rows[r]}) to the gamete at the top of this column (${sq.cols[c]}). Try again.` });
    }
    setAnnounce('Checked your prediction for the cell.');
  };
  const revealAll = () => { const all: Record<number, boolean> = {}; sq.cells.forEach((_, i) => { all[i] = true; }); setRevealed(all); setCellMsg(null); };
  const allShown = sq.cells.every((_, i) => revealed[i]);

  // ---------- mystery parent
  const [mKind, setMKind] = useState<'mono' | 'di'>('mono');
  const [mSeed, setMSeed] = useState(3);
  const mTask = useMemo(() => mysteryTask(mKind, mSeed), [mKind, mSeed]);
  const [mRes, setMRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [mTries, setMTries] = useState(0);
  const answerMystery = (i: number) => {
    const r = checkMystery(mTask, i);
    setMRes({ ok: r.correct, text: r.message });
    setMTries((t) => t + 1);
    setAnnounce(r.correct ? 'Correct.' : 'Not that genotype.');
  };
  const newMystery = (kind: 'mono' | 'di', s: number) => { setMKind(kind); setMSeed(s); setMRes(null); setMTries(0); };

  // ---------- Hardy-Weinberg and drift
  const [p, setP] = useState(0.5);
  const [N, setN] = useState(50);
  const [gens, setGens] = useState(60);
  const [s, setS] = useState(0);
  const [u, setU] = useState(0);
  const [m, setM] = useState(0);
  const [hseed, setHseed] = useState(11);
  const factors = useMemo(() => ({ ...NO_FACTORS, s, u, m, pm: 0.5 }), [s, u, m]);
  const reps = useMemo(() => Array.from({ length: 5 }, (_, k) => simulateDrift({ p0: p, N, gens, seed: subSeed(hseed, k), factors })), [p, N, gens, hseed, factors]);
  const det = useMemo(() => deterministicPath(p, gens, factors), [p, gens, factors]);
  const hw = hwFreqs(p);
  const [dsIdx, setDsIdx] = useState(0);
  const ds = HW_DATASETS[dsIdx]!;
  const [pText, setPText] = useState('');
  const [pRes, setPRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [eqRes, setEqRes] = useState<{ ok: boolean; text: string } | null>(null);
  const chooseDs = (i: number) => { setDsIdx(i); setPText(''); setPRes(null); setEqRes(null); };
  const checkPGuess = () => {
    const g = Number(pText.replace(',', '.'));
    if (pText.trim() === '' || !Number.isFinite(g) || g < 0 || g > 1) { setPRes({ ok: false, text: 'Type p as a number between 0 and 1, for example 0.65.' }); return; }
    const right = alleleFreqFromCounts(ds);
    if (checkP(ds, g)) setPRes({ ok: true, text: `Correct: p = (2 × ${ds.AA} + ${ds.Aa}) / (2 × ${ds.AA + ds.Aa + ds.aa}) = ${f2(right)}, so q = ${f2(1 - right)}.` });
    else if (Math.abs(g - (1 - right)) <= 0.005) setPRes({ ok: false, text: `That is q, the frequency of a. p is the frequency of A: count 2 for each AA, 1 for each Aa, divide by 2N.` });
    else setPRes({ ok: false, text: 'Not yet. Count the A alleles: 2 in each AA and 1 in each Aa, then divide by the total number of alleles, 2N.' });
    setEqRes(null);
  };
  const answerEq = (yes: boolean) => {
    const eq = inEquilibrium(ds);
    const e = hwExpectedCounts(ds);
    const text = `With p = ${f2(alleleFreqFromCounts(ds))} the Hardy-Weinberg expectation is ${Math.round(e.AA)} AA, ${Math.round(e.Aa)} Aa and ${Math.round(e.aa)} aa; observed ${ds.AA}, ${ds.Aa} and ${ds.aa}. ` +
      (eq ? 'They match, so the population is in Hardy-Weinberg equilibrium.' : `They do not match (there are ${ds.Aa < e.Aa ? 'too few' : 'too many'} heterozygotes), so the population is not in equilibrium: something such as non-random mating, selection or migration is acting.`);
    setEqRes({ ok: yes === eq, text: (yes === eq ? 'Correct. ' : 'Not quite. ') + text });
  };

  // ---------- predictions
  const [driftCmp, setDriftCmp] = useState<{ small: number; large: number } | null>(null);
  const lockPrediction = (i: number) => {
    const pr = PREDICTS[i] ?? PREDICTS[0]!;
    if (pr.id === 'g1') { setTab('cross'); chooseCross('di'); revealAll2('di'); }
    if (pr.id === 'g2') { setTab('cross'); chooseCross('test'); revealAll2('test'); }
    if (pr.id === 'g3') { setTab('hw'); setP(0.3); }
    if (pr.id === 'g4') { setTab('hw'); setP(0.5); setN(10); setGens(50); setS(0); setU(0); setM(0); setDriftCmp({ small: meanDrift(0.5, 10, 50, 100, 1), large: meanDrift(0.5, 1000, 50, 100, 1) }); }
    setTested((x) => ({ ...x, [pr.id]: true }));
  };
  /** Reveal the whole square of the default cross after the state change has settled. */
  const revealAll2 = (id: CrossId) => {
    const d = CROSSES[id];
    const sqq = buildSquare(id, d.defaultA, d.defaultB);
    const all: Record<number, boolean> = {};
    sqq.cells.forEach((_, i) => { all[i] = true; });
    setRevealed(all);
  };
  const explain = (i: number) => {
    const pr = PREDICTS[i] ?? PREDICTS[0]!;
    if (pr.id === 'g1') {
      const x = buildSquare('di', [['R', 'r'], ['Y', 'y']], [['R', 'r'], ['Y', 'y']]);
      return `Each parent makes four gametes (RY, Ry, rY, ry) so the square has 16 cells: ${x.phenoLabels.map((l, k) => `${x.phenoCounts[k]} ${l.toLowerCase()}`).join(', ')}. That is ${ratioText(x.phenoCounts)}. It is two 3 : 1 ratios multiplied together, because the genes assort independently.`;
    }
    if (pr.id === 'g2') {
      const x = buildSquare('test', [['T', 't']], [['t', 't']]);
      return `Tt makes T and t gametes, tt makes only t. The four cells are ${x.cellText.join(', ')}: ${x.phenoCounts[0]} tall and ${x.phenoCounts[1]} dwarf, a 1 : 1 ratio, so half the offspring are tall. A TT plant would give all tall.`;
    }
    if (pr.id === 'g3') {
      const f = hwFreqs(0.3);
      return `q = 1 − 0.3 = 0.7. Then p² = ${f2(f.AA)}, 2pq = 2 × 0.3 × 0.7 = ${f2(f.Aa)} and q² = ${f2(f.aa)}. The three add up to ${f2(f.AA + f.Aa + f.aa)}.`;
    }
    return `Drift is chance, and chance matters most in a small sample of alleles. Over 100 simulated populations, the average distance from p = 0.5 after 50 generations was ${driftCmp ? f2(driftCmp.small) : '...'} for N = 10 and only ${driftCmp ? f2(driftCmp.large) : '...'} for N = 1000. The bench shows five populations of 10: they wander and some reach 0 or 1 (fixation).`;
  };

  // ---------- measure and analyse
  const [rows, setRows] = useState<MeasureRow[]>([]);
  const [mn, setMn] = useState(10);
  const [mseed, setMseed] = useState(7);
  const [note, setNote] = useState('');
  const addRow = () => {
    if (rows.some((r) => r.n === mn)) { setNote(`You already recorded n = ${mn}. Choose a different sample size.`); return; }
    setRows((r) => [...r, measureRow(mn, mseed)].sort((a, b) => a.n - b.n));
    setNote(`Recorded n = ${mn} with seed ${mseed}.`);
  };
  const sizes = new Set(rows.map((r) => r.n)).size;
  const canAnalyse = sizes >= 3;
  const fit = canAnalyse ? linearFit(rows.map((r) => Math.log10(r.n)), rows.map((r) => Math.log10(r.typical))) : null;
  const slope = canAnalyse ? logLogSlope(rows) : 0;
  const finished = Object.keys(ans).length === APPLY.length;
  const pending = [
    ...(Object.keys(tested).length < PREDICTS.length ? ['test all four predictions'] : []),
    ...(!canAnalyse ? ['record the offspring ratio at three or more different sample sizes n in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === PREDICTS.length, seen[2] ?? false, canAnalyse, canAnalyse, seen[5] ?? false, finished];

  const reset = () => {
    if (tab === 'cross') { chooseCross('mono'); setSeedState(7); setMKind('mono'); setMSeed(3); setMRes(null); setMTries(0); }
    else { setP(0.5); setN(50); setGens(60); setS(0); setU(0); setM(0); setHseed(11); chooseDs(0); }
  };

  const measureSq = MEASURE_CROSS();
  const lastRow = rows[rows.length - 1];

  return (
    <div data-genetics-lab data-tab={tab}>
      <PageHeader back={back} title="Genetics Lab: crosses and Hardy-Weinberg" subtitle={<span className="inline-flex flex-wrap items-center gap-2">Biology · Principles of inheritance and variation; Evolution <Badge tone="amber">Draft – unverified</Badge></span>} />
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

            {tab === 'cross' && (
              <div data-bench="cross" className="space-y-4 p-3">
                <div>
                  <span className="text-sm text-ink">Cross</span>
                  <div role="group" aria-label="Cross type" className={`${segWrap} mt-1`}>
                    {CROSS_ORDER.map((id) => <button key={id} type="button" aria-pressed={cross === id} data-cross={id} onClick={() => chooseCross(id)} className={seg(cross === id)}>{CROSSES[id].label}</button>)}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-2"><Sym t={def.blurb} /></p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(['A', 'B'] as const).map((which) => {
                    const g = which === 'A' ? gA : gB;
                    const choices = which === 'A' ? def.choicesA : def.choicesB;
                    return (
                      <div key={which} className="rounded-md border border-rule p-2.5">
                        <div className="text-sm font-semibold text-ink">{which === 'A' ? def.nameA : def.nameB}</div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {choices.map((opts, i) => opts.length === 1 ? (
                            <span key={i} className="num inline-flex h-9 items-center rounded-md bg-ink/5 px-3 text-sm font-semibold text-ink" data-fixed={`${which}${i}`}><Sym t={pairText(opts[0] as Pair)} /></span>
                          ) : (
                            <select key={i} aria-label={`${which === 'A' ? def.nameA : def.nameB}, genotype${choices.length > 1 ? ` of gene ${i + 1}` : ''}`} data-parent={`${which}${i}`} className={`${input} num w-auto min-w-24`} value={pairText(g[i]!)} onChange={(e) => setLocus(which, i, e.target.value)}>
                              {opts.map((o) => <option key={pairText(o)} value={pairText(o)}>{pairText(o)}</option>)}
                            </select>
                          ))}
                        </div>
                        <div className="mt-1.5 text-xs text-ink-2">Phenotype: {phenotypeOf(cross, g)}. Gametes: <span className="num font-semibold" data-gametes={which}>{(which === 'A' ? sq.rows : sq.cols).map((x, gi) => <span key={gi}><Sym t={x} />{' '}</span>)}</span></div>
                      </div>
                    );
                  })}
                </div>

                <section aria-label="Punnett square" data-punnett>
                  <h3 className="text-[15px] font-semibold text-ink">Punnett square</h3>
                  <p className="text-sm text-ink-2">Predict first: tap a box, then choose the genotype you think it holds. Wrong answers are explained and the box stays hidden.</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="border-separate border-spacing-1 text-center" data-square>
                      <thead>
                        <tr>
                          <th className="p-0" />
                          {sq.cols.map((c, j) => <th key={j} scope="col" className="num px-1 text-sm font-semibold text-[#b42318]"><Sym t={c} /></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sq.rows.map((r, i) => (
                          <tr key={i}>
                            <th scope="row" className="num pr-1 text-sm font-semibold text-[#2347a8]"><Sym t={r} /></th>
                            {sq.cols.map((_, j) => {
                              const k = i * sq.cols.length + j;
                              const open = !!revealed[k];
                              return (
                                <td key={j} className="p-0">
                                  <button type="button" data-cell={k} data-open={String(open)} aria-pressed={selCell === k} aria-label={open ? `Row ${sq.rows[i]}, column ${sq.cols[j]}: ${sq.cellText[k]}, ${phenotypeOf(cross, sq.cells[k]!)}` : `Row ${sq.rows[i]}, column ${sq.cols[j]}: hidden, tap to predict`}
                                    onClick={() => { if (!open) { setSelCell(k); setCellMsg(null); } }}
                                    className={`num flex ${sq.cols.length > 2 ? 'h-14 w-[3.9rem] sm:w-[4.6rem]' : 'h-16 w-[5.2rem]'} flex-col items-center justify-center rounded-md border-2 text-[13px] font-semibold leading-tight ${open ? 'border-[#1d7a4b] bg-[#e8f4ee] text-ink' : selCell === k ? 'border-[#6b3fa0] bg-accent-soft text-ink' : 'border-dashed border-rule-strong bg-surface text-ink-3'}`}>
                                    {open ? (<><span><Sym t={sq.cellText[k]!} /></span><span className="mt-0.5 text-[10.5px] font-normal text-ink-2">{phenotypeOf(cross, sq.cells[k]!)}</span></>) : '?'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selCell !== null && !revealed[selCell] && (
                    <div className="mt-2" role="group" aria-label="Genotype of the chosen box" data-options>
                      <div className="mb-1 text-sm text-ink">What genotype is box {selCell + 1}?</div>
                      <div className="flex flex-wrap gap-1.5">
                        {genoOptions.map((o) => <button key={o} type="button" data-opt={o} onClick={() => pickGenotype(o)} className={`${btn} num`}><Sym t={o} /></button>)}
                      </div>
                    </div>
                  )}
                  {cellMsg && <div className={`mt-2 rounded-md border p-2 text-sm ${cellMsg.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-cell-msg data-ok={String(cellMsg.ok)}>{cellMsg.text}</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!allShown && <button type="button" className={btn} data-reveal-all onClick={revealAll}>Reveal every box</button>}
                    {Object.keys(revealed).length > 0 && <button type="button" className={btn} onClick={clearCells}>Hide the boxes again</button>}
                  </div>
                  {allShown && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2" data-ratios>
                      <div>
                        <h4 className="text-sm font-semibold text-ink">Genotypes: <span className="num" data-geno-ratio>{ratioText(sq.genoCounts)}</span></h4>
                        <ul className="num mt-1 text-sm text-ink">
                          {sq.genoLabels.map((l, i) => sq.genoCounts[i]! > 0 && <li key={l}><Sym t={l} />: {sq.genoCounts[i]} of {sq.total} ({pct(sq.genoCounts[i]! / sq.total)})</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-ink">Phenotypes: <span className="num" data-pheno-ratio>{ratioText(sq.phenoCounts)}</span></h4>
                        <ul className="num mt-1 text-sm text-ink">
                          {sq.phenoLabels.map((l, i) => sq.phenoCounts[i]! > 0 && <li key={l}>{l}: {sq.phenoCounts[i]} of {sq.total} ({pct(sq.phenoCounts[i]! / sq.total)})</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </section>

                <section aria-label="Raise offspring" data-raise className="border-t border-rule pt-3">
                  <h3 className="text-[15px] font-semibold text-ink">Raise offspring</h3>
                  <p className="text-sm text-ink-2">Each offspring gets a gamete from each parent at random. The same seed always gives the same offspring, so you can repeat a run exactly.</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="block text-sm text-ink">Seed
                      <input type="number" inputMode="numeric" min={1} max={99999} aria-label="Random seed" data-seed className={`${input} num mt-1 w-28`} value={seed} onChange={(e) => { const v = Math.floor(Number(e.target.value)); if (Number.isFinite(v) && v >= 1 && v <= 99999) setSeed(v); }} />
                    </label>
                    <button type="button" className={btn} data-new-seed onClick={() => setSeed(((seed * 31 + 17) % 9973) + 1)}>New seed</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Number of offspring">
                    {N_BUTTONS.map((n) => <button key={n} type="button" data-raise-n={n} aria-pressed={ranN === n} className={ranN === n ? btnMain : btn} onClick={() => raise(n)}>Raise {n}</button>)}
                  </div>
                  {run && runTally && (
                    <div className="mt-3 space-y-2" data-run>
                      <p className="text-sm text-ink" aria-live="polite">{run.n} offspring, seed <span className="num font-semibold" data-run-seed>{seed}</span>. Expected phenotype ratio <span className="num font-semibold">{ratioText(sq.phenoCounts)}</span>; observed counts <span className="num font-semibold" data-observed>{sq.phenoLabels.map((_, i) => runTally.pheno[i]!).filter((_, i) => sq.phenoCounts[i]! > 0).join(' : ')}</span>.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Phenotype</th><th className="pr-2">Expected</th><th className="pr-2">Observed</th><th className="min-w-24">Share</th></tr></thead>
                          <tbody className="num">
                            {sq.phenoLabels.map((l, i) => sq.phenoCounts[i]! > 0 && (
                              <tr key={l} className="border-t border-rule">
                                <td className="py-1 pr-2">{l}</td>
                                <td className="pr-2" data-expected={l}>{((run.n * sq.phenoCounts[i]!) / sq.total).toFixed(1)}</td>
                                <td className="pr-2 font-semibold" data-obs={l}>{runTally.pheno[i]}</td>
                                <td><div className="h-2.5 rounded bg-ink/10"><div className="h-2.5 rounded" style={{ width: `${(runTally.pheno[i]! / run.n) * 100}%`, background: COL.a }} /></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-sm text-ink">Deviation from the expected ratio: <strong className="num" data-dev>{pct(deviation(sq, runTally.pheno))}</strong> <span className="text-ink-3">(half the sum of the gaps between observed and expected shares)</span></p>
                      {run.n <= 50 && <p className="num break-words text-xs text-ink-2" data-first>First offspring: {run.drawn.slice(0, 24).map((c) => sq.cellText[c]).join(', ')}{run.n > 24 ? ', …' : ''}</p>}
                    </div>
                  )}
                  {history.length > 1 && (
                    <p className="mt-2 text-sm text-ink" data-history-line>As n grew: {history.map((h) => `n = ${h.n}: ${pct(h.dev)}`).join(' → ')}. Small samples can stray far from the ratio; big ones stay close.</p>
                  )}
                </section>

                <section aria-label="Mystery parent" data-mystery className="border-t border-rule pt-3">
                  <h3 className="text-[15px] font-semibold text-ink">Mystery parent</h3>
                  <p className="text-sm text-ink-2">One parent shows the dominant traits but its genotype is hidden. It was crossed with a tester <span className="num font-semibold">{mTask.testerText}</span>. Read the offspring counts and decide its genotype (test-cross reasoning).</p>
                  <div role="group" aria-label="Mystery kind" className={`${segWrap} mt-2 max-w-sm`}>
                    <button type="button" aria-pressed={mKind === 'mono'} data-mkind="mono" onClick={() => newMystery('mono', mSeed)} className={seg(mKind === 'mono')}>One gene</button>
                    <button type="button" aria-pressed={mKind === 'di'} data-mkind="di" onClick={() => newMystery('di', mSeed)} className={seg(mKind === 'di')}>Two genes</button>
                  </div>
                  <div className="mt-2 rounded-md bg-ink/5 p-2.5 text-sm text-ink" data-mystery-data>
                    <strong className="num">{mTask.n} offspring:</strong>{' '}
                    {mTask.phenoLabels.map((l, i) => <span key={l} className="num mr-3 inline-block">{mTask.observed[i]} {l.toLowerCase()}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Genotype of the hidden parent">
                    {mTask.options.map((o, i) => <button key={genotypeText(o)} type="button" data-guess={genotypeText(o)} className={`${btn} num`} onClick={() => answerMystery(i)}>{genotypeText(o)}</button>)}
                    <button type="button" className={btn} data-new-mystery onClick={() => newMystery(mKind, mSeed + 1)}>New mystery</button>
                  </div>
                  {mRes && <div className={`mt-2 rounded-md border p-2 text-sm ${mRes.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-mystery-msg data-ok={String(mRes.ok)}>{mRes.text}</div>}
                  <p className="mt-1 text-xs text-ink-3" data-tries>Tries on this mystery: {mTries}</p>
                </section>
              </div>
            )}

            {tab === 'hw' && (
              <div data-bench="hw" className="space-y-4 p-3">
                <section aria-label="Hardy-Weinberg proportions" data-hw>
                  <h3 className="text-[15px] font-semibold text-ink">Hardy-Weinberg proportions</h3>
                  <p className="text-sm text-ink-2">Two alleles, A and a, with frequencies p and q = 1 − p. In a large randomly mating population with no other forces, the genotypes are p² + 2pq + q² = 1.</p>
                  <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    <Slider id="hw-p" label="p (frequency of A)" unit="" value={p} min={0} max={1} step={0.01} onChange={setP} shown={f2(p)} />
                    <div className="num flex items-end pb-1 text-sm text-ink" data-q>q = 1 − p = <strong className="ml-1">{f2(1 - p)}</strong></div>
                  </div>
                  <HwBars p={p} />
                  <p className="num text-sm text-ink" data-hw-sum>p² + 2pq + q² = {f2(hw.AA)} + {f2(hw.Aa)} + {f2(hw.aa)} = {f2(hw.AA + hw.Aa + hw.aa)}. In {N} individuals: {Math.round(hw.AA * N)} AA, {Math.round(hw.Aa * N)} Aa, {Math.round(hw.aa * N)} aa.</p>
                </section>

                <section aria-label="Drift and selection" data-drift className="border-t border-rule pt-3">
                  <h3 className="text-[15px] font-semibold text-ink">Change over generations</h3>
                  <p className="text-sm text-ink-2">Five populations start at the same p. Each generation the forces act, then N individuals (2N alleles) are chosen by chance: that sampling is genetic drift. The dashed line is an infinite population, where only the forces you switch on matter.</p>
                  <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    <Slider id="hw-n" label="Population size N" unit="individuals" value={N} min={10} max={1000} step={10} onChange={setN} />
                    <Slider id="hw-g" label="Generations" unit="" value={gens} min={10} max={200} step={10} onChange={setGens} />
                    <Slider id="hw-s" label="Selection against aa (s)" unit="" value={s} min={0} max={1} step={0.05} onChange={setS} shown={f2(s)} />
                    <Slider id="hw-u" label="Mutation A → a per generation" unit="" value={u} min={0} max={0.02} step={0.001} onChange={setU} shown={u.toFixed(3)} />
                    <Slider id="hw-m" label="Gene flow: migrants (their p = 0.5)" unit="" value={m} min={0} max={0.2} step={0.01} onChange={setM} shown={f2(m)} />
                    <div className="flex items-end gap-2">
                      <label className="block text-sm text-ink">Seed
                        <input type="number" inputMode="numeric" min={1} max={99999} aria-label="Random seed for the populations" data-hseed className={`${input} num mt-1 w-28`} value={hseed} onChange={(e) => { const v = Math.floor(Number(e.target.value)); if (Number.isFinite(v) && v >= 1 && v <= 99999) setHseed(v); }} />
                      </label>
                      <button type="button" className={btn} data-new-hseed onClick={() => setHseed(((hseed * 31 + 17) % 9973) + 1)}>New seed</button>
                    </div>
                  </div>
                  <Trajectory reps={reps} det={det} gens={gens} label={`Allele frequency over ${gens} generations in five populations of ${N} individuals starting at p = ${f2(p)}; final values ${reps.map((r) => f2(r.at(-1)!)).join(', ')}`} />
                  <p className="num text-sm text-ink" data-finals>After {gens} generations (N = {N}): {reps.map((r, i) => <span key={i} className="mr-2 inline-block font-semibold" style={{ color: REP[i] }}>{f2(r.at(-1)!)}{r.at(-1) === 0 || r.at(-1) === 1 ? ' (fixed)' : ''}</span>)} <span className="text-ink-3">· infinite population: {f2(det.at(-1)!)}</span></p>
                  <p className="text-xs text-ink-3">Selection uses fitness AA = Aa = 1 and aa = 1 − s, so q′ = q(1 − sq) / (1 − sq²). Order each generation: selection, then mutation, then gene flow, then drift.</p>
                </section>

                <section aria-label="Is the population in equilibrium?" data-equilibrium className="border-t border-rule pt-3">
                  <h3 className="text-[15px] font-semibold text-ink">Is this population in equilibrium?</h3>
                  <div role="group" aria-label="Population" className={`${segWrap}`}>
                    {HW_DATASETS.map((d, i) => <button key={d.id} type="button" aria-pressed={dsIdx === i} data-ds={i} onClick={() => chooseDs(i)} className={seg(dsIdx === i)}>{i + 1}</button>)}
                  </div>
                  <p className="mt-2 text-sm text-ink">{ds.label}: <span className="num font-semibold" data-ds-counts>{ds.AA} AA, {ds.Aa} Aa, {ds.aa} aa</span>.</p>
                  <div className="mt-1 flex flex-wrap items-end gap-2">
                    <label className="block text-sm text-ink">Your p (frequency of A)
                      <input type="text" inputMode="decimal" aria-label="Your value of p" data-p-input className={`${input} num mt-1 w-28`} value={pText} placeholder="0.00" onChange={(e) => setPText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') checkPGuess(); }} />
                    </label>
                    <button type="button" className={btnMain} data-p-check onClick={checkPGuess}>Check p</button>
                  </div>
                  {pRes && <div className={`mt-2 rounded-md border p-2 text-sm ${pRes.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-p-msg data-ok={String(pRes.ok)}>{pRes.text}</div>}
                  {pRes?.ok && (
                    <div className="mt-2">
                      <div className="text-sm text-ink">With this p, is the population in Hardy-Weinberg equilibrium?</div>
                      <div className="mt-1 flex gap-2">
                        <button type="button" className={btn} data-eq="yes" onClick={() => answerEq(true)}>Yes, in equilibrium</button>
                        <button type="button" className={btn} data-eq="no" onClick={() => answerEq(false)}>No, not in equilibrium</button>
                      </div>
                      {eqRes && <div className={`mt-2 rounded-md border p-2 text-sm ${eqRes.ok ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft'}`} aria-live="polite" data-eq-msg data-ok={String(eqRes.ok)}>{eqRes.text}</div>}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">One bench, two tabs. Every ratio and frequency is computed by the real genetics model, and every random draw uses a seed you can see and repeat.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Crosses:</strong> choose a cross, set the parents, predict the boxes of the Punnett square, then raise offspring and see how close they come to the expected ratio.</li>
                <li><strong>Mystery parent:</strong> read the offspring of a test cross and decide the hidden genotype.</li>
                <li><strong>Hardy-Weinberg and drift:</strong> change p, the population size and the forces of evolution and watch the allele frequency change over generations.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={setPi} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={lockPrediction} explain={explain}
              onNext={() => setPi(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Punnett square:</strong> choose a cross and predict every box before you reveal it.</li>
                <li><strong>Raise offspring:</strong> raise 10, 50, 200 and 1000 with the same seed. How far is the observed ratio from the expected one each time?</li>
                <li><strong>Incomplete dominance and ABO:</strong> compare the genotype ratio with the phenotype ratio. Which crosses make them equal?</li>
                <li><strong>Mystery parent:</strong> solve a one-gene and a two-gene mystery.</li>
                <li><strong>Hardy-Weinberg:</strong> set p = 0.5, then try N = 10 and N = 1000. Switch on selection against aa.</li>
                <li><strong>Equilibrium:</strong> work out p for each of the four populations and decide which are in equilibrium.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">Cross <span className="num font-semibold">Tt × Tt</span> (expected {ratioText(measureSq.phenoCounts)} tall to dwarf). Raise a sample of n offspring and record the ratio. Record at least three <em>different</em> sample sizes, for example 10, 100 and 1000.</p>
              <div role="group" aria-label="Sample size" className="flex flex-wrap gap-1.5">
                {MEASURE_SIZES.map((n) => <button key={n} type="button" data-mn={n} aria-pressed={mn === n} onClick={() => { setMn(n); setNote(''); }} className={`h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${mn === n ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong'}`}>{n}</button>)}
              </div>
              <label className="block text-sm text-ink">Seed
                <input type="number" inputMode="numeric" min={1} max={99999} aria-label="Seed for the measurement" data-mseed className={`${input} num mt-1 w-28`} value={mseed} onChange={(e) => { const v = Math.floor(Number(e.target.value)); if (Number.isFinite(v) && v >= 1 && v <= 99999) setMseed(v); }} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnMain} onClick={addRow} data-record>Raise {mn} and record</button>
                {rows.length > 0 && <button type="button" className={btn} onClick={() => { setRows([]); setNote(''); }}>Clear table</button>}
              </div>
              <p className="text-sm text-ink-2" role="status" data-measure-note>{note} {rows.length > 0 ? `${sizes} size${sizes === 1 ? '' : 's'} recorded.` : ''}</p>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <caption className="mb-1 text-left text-xs text-ink-3">Deviation = half the sum of the gaps between observed and expected shares. “Typical” is the average over 200 repeated runs with other seeds.</caption>
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">n</th><th className="pr-2">Tall</th><th className="pr-2">Dwarf</th><th className="pr-2">Tall : dwarf</th><th className="pr-2">Deviation</th><th>Typical</th></tr></thead>
                    <tbody className="num">{rows.map((r) => <tr key={r.n} className="border-t border-rule"><td className="py-1 pr-2 font-semibold">{r.n}</td><td className="pr-2">{r.tall}</td><td className="pr-2">{r.dwarf}</td><td className="pr-2">{r.observedRatio}</td><td className="pr-2">{pct(r.dev)}</td><td>{pct(r.typical)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              {canAnalyse && <button type="button" className={btnMain} onClick={() => go(4)}>Analyse my results</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canAnalyse && fit && lastRow ? (
                <>
                  <DeviationPlot rows={rows} fit={fit} />
                  <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink" data-growth>
                    <li>From n = {rows[0]!.n} to n = {lastRow.n} the sample grew <strong className="num">{(lastRow.n / rows[0]!.n).toFixed(0)}</strong> times and the typical deviation fell from <strong className="num">{pct(rows[0]!.typical)}</strong> to <strong className="num">{pct(lastRow.typical)}</strong>, a drop of <strong className="num">{(rows[0]!.typical / lastRow.typical).toFixed(1)}</strong> times.</li>
                    <li>If the deviation shrinks as 1/√n, a sample {(lastRow.n / rows[0]!.n).toFixed(0)} times bigger gives a deviation √{(lastRow.n / rows[0]!.n).toFixed(0)} = <strong className="num">{Math.sqrt(lastRow.n / rows[0]!.n).toFixed(1)}</strong> times smaller. The measured drop is close.</li>
                    <li>The slope of the line on the log-log graph is <strong className="num" data-slope>{slope.toFixed(2)}</strong>, close to −0.5: <em>deviation ∝ n<sup>−1/2</sup></em>. To halve the deviation you need four times as many offspring.</li>
                    <li>Your single runs (open circles) scatter around the line: one small sample can be lucky or unlucky. That is why Mendel counted hundreds of plants.</li>
                  </ul>
                </>
              ) : <p className="text-[15px] text-ink">Record at least three different sample sizes in the Measure step first.</p>}
              <button type="button" className={btnMain} onClick={() => go(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>Each parent passes one allele of each gene, chosen at random, so every box of a Punnett square is equally likely. Tt × Tt gives 1 TT : 2 Tt : 1 tt (genotypes) and 3 tall : 1 dwarf (phenotypes).</li>
                <li>A test cross (unknown × tt) shows the unknown genotype: all dominant means homozygous, 1 : 1 means heterozygous.</li>
                <li>RrYy × RrYy gives 9 : 3 : 3 : 1, two independent 3 : 1 ratios multiplied. The genotype ratio is different (nine genotypes).</li>
                <li>In incomplete dominance the heterozygote is intermediate, so the phenotype ratio 1 : 2 : 1 equals the genotype ratio. In co-dominance (I<sup>A</sup>I<sup>B</sup>, group AB) both alleles show. ABO has three alleles, six genotypes and four phenotypes.</li>
                <li>Humans: the sperm (X or Y) decides sex, 1 : 1. Birds: the egg (Z or W) decides sex.</li>
                <li>Ratios are expectations. In a small sample chance gives a big deviation, which shrinks as 1/√n.</li>
                <li>Hardy-Weinberg: p + q = 1 and p² + 2pq + q² = 1. The frequencies stay constant only if mating is random, the population is large and there is no mutation, migration or selection. Any change in allele frequency means evolution.</li>
                <li>Genetic drift is chance change in allele frequency and is strong in small populations (the founder effect is one case). Selection against aa lowers q. Mutation and gene flow also change p.</li>
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
