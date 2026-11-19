import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, PageHeader } from '../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, Slider, StepNav, useLabCompletion, useLabOrigin, useNarrow, useScrollTopOnOpen, useSteps } from '../visual/labkit';
import {
  AGE_GROUPS, APPLY, checkDensity, classify, DENSITY_KINDS, densities, densityMeaning, DIMENSION_NAME, distinctReadings, earlierMeansBigger, farmersOf, gainIfRaised, getRegion, GOALPOSTS, hdi,
  hdiVsIncome, HDI_START, makeReading, PRED_CULT_AFTER, PRED_PROFILE, PRED_PYRAMID, PRED_YEARS, PREDICTS, predictFacts, PRESETS, PROFILES, pyramid, REGIONS, SHAPE_NAME, SHAPE_STAGE,
  simulateTransition, stageAt, stageBands, stageYear, STAGE_TEXT, summarise, TRANSITION_DEFAULT, whyShape, type Dimension, type HdiInput, type Pyramid, type Reading, type Shape, type Tab,
  type TransitionRun, type Verdict,
} from '../visual/population';

const BLUE = '#2347a8';
const RED = '#b42318';
const GREEN = '#1d7a4b';
const AMBER = '#a86100';
const ROSE = '#b4235f';
const GRID = '#d6d1c3';
const INK = '#55645c';
const BAND = { 1: '#f1efe6', 2: '#fff0d0', 3: '#e3f1e8' } as const;
const CURVES = [BLUE, RED, GREEN, AMBER, ROSE, '#6b21a8'];

const grp = (v: number) => Math.round(v).toLocaleString('en-IN');
const r1 = (v: number) => (Math.round(v * 10) / 10).toString();
const f1 = (v: number) => v.toFixed(1);
const f3 = (v: number) => v.toFixed(3);
function niceCeil(x: number): number {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
const roundGni = (g: number) => (g >= 1000 ? Math.round(g / 10) * 10 : Math.round(g));
const TABS: { id: Tab; label: string }[] = [
  { id: 'density', label: 'Density calculators' },
  { id: 'transition', label: 'Demographic transition' },
  { id: 'pyramid', label: 'Pyramid builder' },
  { id: 'hdi', label: 'Human Development Index' },
];
const chip = (on: boolean) => `h-8 rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset ${on ? 'bg-accent-soft text-accent ring-accent' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper'}`;

// ------------------------------------------------------------------ charts
function Frame({ w, h, label, children }: { w: number; h: number; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block w-full select-none" style={{ fontSize: 12 }}>
      {children}
    </svg>
  );
}

function RatesChart({ run, year, narrow }: { run: TransitionRun; year: number; narrow: boolean }) {
  const W = narrow ? 360 : 560;
  const H = narrow ? 260 : 220;
  const L = 36, R = 10, T = 22, B = 30;
  const n = run.year.length;
  const X = (t: number) => L + (t / n) * (W - L - R);
  const Y = (v: number) => T + (1 - Math.min(v, 50) / 50) * (H - T - B);
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const gap = `${run.birth.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}${run.death.map((_, i) => `L${X(n - 1 - i).toFixed(1)},${Y(run.death[n - 1 - i]!).toFixed(1)}`).join('')}Z`;
  const bands = stageBands(run);
  const i = Math.min(year, n - 1);
  return (
    <Frame w={W} h={H} label={`Birth rate and death rate per 1000 over ${n} years. At year ${i} the birth rate is ${f1(run.birth[i]!)} and the death rate is ${f1(run.death[i]!)}.`}>
      {bands.map((b) => (
        <g key={b.from}>
          <rect x={X(b.from)} y={T} width={X(b.to) - X(b.from)} height={H - T - B} fill={BAND[b.stage]} />
          {X(b.to) - X(b.from) > 54 && <text x={(X(b.from) + X(b.to)) / 2} y={T - 7} textAnchor="middle" fill={INK} fontWeight={600}>Stage {b.stage}</text>}
        </g>
      ))}
      {[0, 10, 20, 30, 40, 50].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeWidth={0.7} />
          <text x={L - 5} y={Y(v) + 4} textAnchor="end" fill={INK}>{v}</text>
        </g>
      ))}
      {[0, 50, 100, 150, 200].filter((t) => t <= n).map((t) => <text key={t} x={X(t)} y={H - B + 15} textAnchor="middle" fill={INK}>{t}</text>)}
      <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fill={INK}>years from the start</text>
      <text x={4} y={11} fill={INK} fontSize={11}>per 1000 per year</text>
      <path d={gap} fill={AMBER} fillOpacity={0.22} />
      <path d={line(run.birth)} fill="none" stroke={BLUE} strokeWidth={2.4} />
      <path d={line(run.death)} fill="none" stroke={RED} strokeWidth={2.4} />
      <line x1={X(i)} x2={X(i)} y1={T} y2={H - B} stroke="#202c28" strokeWidth={1.2} strokeDasharray="4 3" />
      <circle cx={X(i)} cy={Y(run.birth[i]!)} r={4} fill={BLUE} stroke="#fff" strokeWidth={1.2} />
      <circle cx={X(i)} cy={Y(run.death[i]!)} r={4} fill={RED} stroke="#fff" strokeWidth={1.2} />
    </Frame>
  );
}

interface PopSeries { run: TransitionRun; color: string; label: string }
function PopChart({ series, year, narrow }: { series: PopSeries[]; year?: number; narrow: boolean }) {
  const W = narrow ? 360 : 560;
  const H = narrow ? 230 : 200;
  const L = 42, R = 10, T = 22, B = 30;
  const n = series[0]!.run.pop.length - 1;
  const top = niceCeil(Math.max(...series.map((s) => Math.max(...s.run.pop))) * 1.02);
  const X = (t: number) => L + (t / n) * (W - L - R);
  const Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const s0 = series[0]!;
  const i = year === undefined ? undefined : Math.min(year, n);
  return (
    <Frame w={W} h={H} label={`Total population over ${n} years, in millions (illustrative). ${series.map((s) => `${s.label}: ${f1(s.run.pop[n]!)} million at the end`).join('; ')}.`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeWidth={0.7} />
          <text x={L - 5} y={Y(v) + 4} textAnchor="end" fill={INK}>{r1(v)}</text>
        </g>
      ))}
      {[0, 50, 100, 150, 200].filter((t) => t <= n).map((t) => <text key={t} x={X(t)} y={H - B + 15} textAnchor="middle" fill={INK}>{t}</text>)}
      <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fill={INK}>years from the start</text>
      <text x={4} y={11} fill={INK} fontSize={11}>millions of people (illustrative)</text>
      {series.map((s) => <path key={s.label} d={s.run.pop.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth={2.4} />)}
      {i !== undefined && (
        <g>
          <line x1={X(i)} x2={X(i)} y1={T} y2={H - B} stroke="#202c28" strokeWidth={1.2} strokeDasharray="4 3" />
          <circle cx={X(i)} cy={Y(s0.run.pop[i]!)} r={4.5} fill={s0.color} stroke="#fff" strokeWidth={1.2} />
        </g>
      )}
    </Frame>
  );
}

function PyramidSvg({ p, narrow, small = false }: { p: Pyramid; narrow: boolean; small?: boolean }) {
  const W = small ? 220 : narrow ? 360 : 560;
  const H = small ? 190 : narrow ? 330 : 340;
  const gapMid = small ? 0 : 44;
  const T = 8, B = 30;
  const cx = W / 2;
  const side = (W - gapMid) / 2 - (small ? 8 : 14);
  const MAX = 13;
  const rows = AGE_GROUPS.length;
  const rh = (H - T - B) / rows;
  const bw = (v: number) => (v / MAX) * side;
  const labelRows = small ? [] : AGE_GROUPS.map((_, k) => k);
  return (
    <Frame w={W} h={H} label={`Age-sex pyramid: ${f1(p.children)} per cent aged 0 to 14, ${f1(p.working)} per cent aged 15 to 59, ${f1(p.aged)} per cent aged 60 and above. Males on the left, females on the right.`}>
      {AGE_GROUPS.map((_, k) => {
        const y = T + (rows - 1 - k) * rh;
        return (
          <g key={k}>
            <rect x={cx - gapMid / 2 - bw(p.male[k]!)} y={y + 1} width={bw(p.male[k]!)} height={rh - 2} fill={BLUE} fillOpacity={0.85} />
            <rect x={cx + gapMid / 2} y={y + 1} width={bw(p.female[k]!)} height={rh - 2} fill={ROSE} fillOpacity={0.85} />
            {labelRows.includes(k) && <text x={cx} y={y + rh / 2 + 4} textAnchor="middle" fill={INK} fontSize={10.5}>{AGE_GROUPS[k]}</text>}
          </g>
        );
      })}
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <text x={cx - gapMid / 2 - bw(v)} y={H - B + 14} textAnchor="middle" fill={INK} fontSize={11}>{v}</text>
          {v > 0 && <text x={cx + gapMid / 2 + bw(v)} y={H - B + 14} textAnchor="middle" fill={INK} fontSize={11}>{v}</text>}
        </g>
      ))}
      <text x={cx - gapMid / 2 - side / 2} y={H - 3} textAnchor="middle" fill={BLUE} fontWeight={600} fontSize={11}>{small ? 'Males' : 'Males (% of population)'}</text>
      <text x={cx + gapMid / 2 + side / 2} y={H - 3} textAnchor="middle" fill={ROSE} fontWeight={600} fontSize={11}>Females</text>
    </Frame>
  );
}

function IncomeChart({ base, narrow }: { base: HdiInput; narrow: boolean }) {
  const W = narrow ? 360 : 560;
  const H = narrow ? 210 : 190;
  const L = 36, R = 12, T = 12, B = 34;
  const pts = useMemo(() => hdiVsIncome(base, 80), [base.life, base.eys, base.mys]); // eslint-disable-line react-hooks/exhaustive-deps
  const X = (g: number) => L + (g / GOALPOSTS.gni.max) * (W - L - R);
  const Y = (v: number) => T + (1 - v) * (H - T - B);
  const here = hdi(base).hdi;
  return (
    <Frame w={W} h={H} label={`HDI against income per person with health and education fixed. The curve rises steeply at low income and flattens at high income. Now: income ${grp(base.gni)}, HDI ${f3(here)}.`}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeWidth={0.7} />
          <text x={L - 5} y={Y(v) + 4} textAnchor="end" fill={INK}>{v}</text>
        </g>
      ))}
      {[0, 25000, 50000, 75000].map((g) => <text key={g} x={X(g)} y={H - B + 15} textAnchor={g === 0 ? 'start' : g === 75000 ? 'end' : 'middle'} fill={INK}>{grp(g)}</text>)}
      <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fill={INK}>income per person (PPP $), health and education fixed</text>
      <path d={pts.map((q, k) => `${k ? 'L' : 'M'}${X(q.gni).toFixed(1)},${Y(q.hdi).toFixed(1)}`).join('')} fill="none" stroke={GREEN} strokeWidth={2.4} />
      <line x1={X(base.gni)} x2={X(base.gni)} y1={Y(here)} y2={H - B} stroke="#202c28" strokeWidth={1} strokeDasharray="4 3" />
      <circle cx={X(base.gni)} cy={Y(here)} r={5} fill={AMBER} stroke="#fff" strokeWidth={1.4} />
    </Frame>
  );
}

function Bar({ label, value, scale, shown, color, note, undef }: { label: string; value: number | null; scale: number; shown: string; color: string; note?: string; undef?: string }) {
  const over = value !== null && value > scale;
  const w = value === null ? 0 : Math.min(100, (value / scale) * 100);
  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{label}</span>
        <span className="num font-semibold text-ink">{value === null ? (undef ?? 'not defined') : shown}</span>
      </div>
      <div className="mt-1 h-3.5 overflow-hidden rounded bg-paper ring-1 ring-inset ring-rule" role="presentation">
        <div className="h-full rounded" style={{ width: `${w}%`, background: color }} />
      </div>
      {(over || note) && <div className="mt-0.5 text-xs text-ink-3">{over ? 'off the scale of this bar; ' : ''}{note}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ the page
const VERDICT_TEXT: Record<Verdict, string> = {
  right: 'Correct.',
  close: 'Close. Check your rounding: use the exact division.',
  wrong: 'Not yet. Check which numbers go on the top and the bottom.',
  empty: 'Type a number first.',
  undefined: 'This density is not defined here: the cultivated area is zero, so you cannot divide by it.',
};

export function PopulationLabPage() {
  const { lessonId, back } = useLabOrigin();
  const [params] = useSearchParams();
  const narrow = useNarrow();
  const first = params.get('tab');
  const [tab, setTab] = useState<Tab>(first === 'transition' || first === 'pyramid' || first === 'hdi' ? first : 'density');
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});

  // density
  const [regionId, setRegionId] = useState('A');
  const region = getRegion(regionId);
  const [cult, setCult] = useState(region.cultivated);
  const [pop, setPop] = useState(region.pop);
  const [entry, setEntry] = useState<Record<string, string>>({ arithmetic: '', physiological: '', agricultural: '' });
  const [checked, setChecked] = useState<Record<string, { v: Verdict; sig: string }>>({});
  // transition
  const [tp, setTp] = useState({ deathMid: TRANSITION_DEFAULT.deathMid, lag: TRANSITION_DEFAULT.lag, birthHigh: TRANSITION_DEFAULT.birthHigh });
  const [year, setYear] = useState(30);
  // pyramid
  const [tfr, setTfr] = useState(2.1);
  const [e0, setE0] = useState(76);
  const [pyMode, setPyMode] = useState<'build' | 'read'>('build');
  const [readAns, setReadAns] = useState<Record<string, Shape>>({});
  // hdi
  const [hl, setHl] = useState({ life: HDI_START.life, eys: HDI_START.eys, mys: HDI_START.mys, lg: Math.log10(HDI_START.gni) });
  const [profile, setProfile] = useState<string | null>(null);

  useScrollTopOnOpen();

  const farmers = farmersOf(region, pop);
  const dens = densities(pop, region.area, cult, farmers);
  const sig = `${regionId}|${pop}|${cult}`;
  const params2 = { ...TRANSITION_DEFAULT, ...tp };
  const run = useMemo(() => simulateTransition({ ...TRANSITION_DEFAULT, ...tp }), [tp.deathMid, tp.lag, tp.birthHigh]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = summarise(run);
  const yi = Math.min(year, run.year.length - 1);
  const stageNow = stageAt(run.birth[yi]!, run.death[yi]!);
  const py = useMemo(() => pyramid(tfr, e0), [tfr, e0]);
  const shape = classify(py);
  const hin: HdiInput = { life: hl.life, eys: hl.eys, mys: hl.mys, gni: roundGni(Math.pow(10, hl.lg)) };
  const hr = hdi(hin);
  const dimVal: Record<Dimension, number> = { health: hr.health, education: hr.education, income: hr.income };

  const baseScale = (() => {
    const b = densities(region.pop * 2, region.area, region.cultivated * 0.25, farmersOf(region, region.pop * 2));
    return niceCeil(Math.max(b.physiological ?? 1, 1) * 0.6);
  })();

  const pickRegion = (id: string) => {
    const r = getRegion(id);
    setRegionId(id); setCult(r.cultivated); setPop(r.pop); setChecked({});
  };
  const resetAll = () => {
    pickRegion('A'); setEntry({ arithmetic: '', physiological: '', agricultural: '' });
    setTp({ deathMid: TRANSITION_DEFAULT.deathMid, lag: TRANSITION_DEFAULT.lag, birthHigh: TRANSITION_DEFAULT.birthHigh }); setYear(30);
    setTfr(2.1); setE0(76); setHl({ life: HDI_START.life, eys: HDI_START.eys, mys: HDI_START.mys, lg: Math.log10(HDI_START.gni) }); setProfile(null); setReadAns({});
  };
  const setHdiInput = (x: HdiInput) => setHl({ life: x.life, eys: x.eys, mys: x.mys, lg: Math.log10(x.gni) });

  const apply = (id: string, which: 'base' | 'test') => {
    if (id === 'dens') { pickRegion('A'); if (which === 'test') setCult(PRED_CULT_AFTER); setTab('density'); }
    else if (id === 'trans') { setTp({ deathMid: TRANSITION_DEFAULT.deathMid, lag: TRANSITION_DEFAULT.lag, birthHigh: TRANSITION_DEFAULT.birthHigh }); setYear(which === 'base' ? PRED_YEARS.before : PRED_YEARS.after); setTab('transition'); }
    else if (id === 'pyr') { const s = which === 'base' ? PRED_PYRAMID.start : PRED_PYRAMID.stage2; setTfr(s.tfr); setE0(s.e0); setPyMode('build'); setTab('pyramid'); }
    else { setHdiInput(which === 'base' ? HDI_START : PRED_PROFILE.input); setProfile(which === 'base' ? null : PRED_PROFILE.id); setTab('hdi'); }
  };
  const choosePredict = (i: number) => { const p = PREDICTS[i] ?? PREDICTS[0]!; setPi(i); apply(p.id, 'base'); };

  const nDistinct = distinctReadings(rows);
  const canFit = nDistinct >= 3;
  const predDone = Object.keys(tested).length === PREDICTS.length;
  const finished = Object.keys(ans).length === APPLY.length;
  const pending = [
    ...(!predDone ? ['test all four predictions'] : []),
    ...(!canFit ? ['record at least three readings at different settings (for example different years for the fall of the death rate) in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, predDone, predDone, rows.length >= 3, canFit, true, finished];

  const goStep = (i: number) => { if (i === 3 || i === 4) setTab('transition'); go(i); };
  const record = () => {
    const r = makeReading(params2);
    if (rows.some((x) => x.key === r.key)) return;
    setRows((x) => [...x, r]);
  };
  const facts = predictFacts();

  const explain = (i: number) => {
    const p = PREDICTS[i] ?? PREDICTS[0]!;
    if (p.id === 'dens') {
      return `Before: arithmetic ${facts.before.arithmetic}, physiological ${facts.before.physiological}, agricultural ${facts.before.agricultural} per km². After the flood: arithmetic ${facts.after.arithmetic}, physiological ${facts.after.physiological}, agricultural ${facts.after.agricultural}. Total population and total area did not change, so the arithmetic density cannot change; the two densities that divide by cultivated area rise because the same people share less farmland.`;
    }
    if (p.id === 'trans') {
      return `In year ${PRED_YEARS.before} the rates are ${f1(run.birth[PRED_YEARS.before]!)} births and ${f1(facts.deathBefore)} deaths per 1000, so natural increase is only ${f1(facts.niBefore)}. By year ${PRED_YEARS.after} the death rate has fallen to ${f1(facts.deathAfter)} while the birth rate is still ${f1(facts.birthAfter)}: natural increase is ${f1(facts.niAfter)} per 1000, about ${(facts.niAfter / 10).toFixed(1)} per cent a year. The gap widens: that is stage 2.`;
    }
    if (p.id === 'pyr') {
      return `With ${PRED_PYRAMID.stage2.tfr} children per woman and a life expectancy of ${PRED_PYRAMID.stage2.e0} years, ${f1(facts.pyr.children)} per cent of the population is under 15 and only ${f1(facts.pyr.aged)} per cent is 60 or older. The base is much wider than the bars above it: an expanding pyramid.`;
    }
    return `Profile P: health index ${f3(facts.h.health)}, education index ${f3(facts.h.education)}, income index ${f3(facts.h.income)}. Education is the lowest, so it holds the HDI (${f3(facts.h.hdi)}) back, even though people live long. A geometric mean is pulled down most by its weakest part.`;
  };

  const sl = (id: string, label: string, unit: string, value: number, min: number, max: number, stepv: number, onChange: (v: number) => void, shown?: string) => (
    <Slider id={id} label={label} unit={unit} value={value} min={min} max={max} step={stepv} onChange={onChange} shown={shown} />
  );

  // ---- the four bench tabs
  const densityTab = (
    <div className="space-y-3 px-3 py-3" data-tab-panel="density">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an illustrative region">
        {REGIONS.map((r) => <button key={r.id} type="button" aria-pressed={regionId === r.id} data-region={r.id} onClick={() => pickRegion(r.id)} className={chip(regionId === r.id)}>{r.id}</button>)}
      </div>
      <p className="text-sm text-ink"><strong>{region.name}.</strong> {region.note} <span className="text-ink-3">(Illustrative numbers, made up for practice.)</span></p>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {sl('pl-cult', 'Net cultivated area', 'km²', cult, 0, region.area, Math.max(1, region.area / 100), setCult, grp(cult))}
        {sl('pl-pop', 'Population', '', pop, Math.round(region.pop * 0.25), region.pop * 2, Math.max(1, Math.round(region.pop / 100)), setPop, grp(pop))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4" data-region-data>
        {([['Total area', `${grp(region.area)} km²`], ['Net cultivated area', `${grp(cult)} km²`], ['Population', grp(pop)], ['Agricultural population', grp(farmers)]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-ink-3">{k}</dt><dd className="num font-semibold text-ink">{v}</dd></div>
        ))}
      </dl>
      <div className="space-y-2" aria-live="polite" data-bars>
        {DENSITY_KINDS.map((k, i) => {
          const v = dens[k.id];
          return <Bar key={k.id} label={k.name} value={v} scale={baseScale} shown={`${v === null ? '' : r1(v)} per km²`} color={[BLUE, GREEN, AMBER][i]!} undef="not defined: no cultivated land" />;
        })}
      </div>
      <p className="text-xs text-ink-3">The bars show the three densities now, on one fixed scale for this region (0 to {grp(baseScale)} per km²). Slide the cultivated area down to zero: the densities that divide by it stop existing.</p>
    </div>
  );

  const transitionTab = (
    <div className="space-y-3 px-3 py-3" data-tab-panel="transition">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {sl('pl-dmid', 'Year the death rate falls', '', tp.deathMid, 20, 120, 5, (v) => setTp((x) => ({ ...x, deathMid: v })), `year ${tp.deathMid}`)}
        {sl('pl-lag', 'Birth rate falls this many years later', 'years', tp.lag, 0, 80, 5, (v) => setTp((x) => ({ ...x, lag: v })))}
        {sl('pl-bhigh', 'Birth rate at the start', 'per 1000', tp.birthHigh, 30, 50, 1, (v) => setTp((x) => ({ ...x, birthHigh: v })))}
        {sl('pl-year', 'Look at year', '', yi, 0, run.year.length - 1, 1, setYear)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jump to a stage">
        <span className="text-sm text-ink-2">Go to stage:</span>
        {([1, 2, 3] as const).map((s) => {
          const yr = stageYear(run, s);
          return <button key={s} type="button" disabled={yr === null} data-stage-jump={s} onClick={() => yr !== null && setYear(yr)} className={`${chip(stageNow === s)} disabled:opacity-40`}>Stage {s}</button>;
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium" data-rate-legend>
        <li style={{ color: BLUE }}>● birth rate</li>
        <li style={{ color: RED }}>● death rate</li>
        <li style={{ color: AMBER }}>▒ shaded gap: natural increase</li>
      </ul>
      <RatesChart run={run} year={yi} narrow={narrow} />
      <PopChart series={[{ run, color: GREEN, label: 'this run' }]} year={yi} narrow={narrow} />
      <div className="rounded-md bg-accent-soft p-3 text-sm text-ink" aria-live="polite" data-stage-card>
        <strong>Year {yi}: {STAGE_TEXT[stageNow].name}.</strong> Birth rate {f1(run.birth[yi]!)} and death rate {f1(run.death[yi]!)} per 1000, so natural increase is {f1(run.ni[yi]!)} per 1000 ({(run.ni[yi]! / 10).toFixed(2)} per cent a year). {STAGE_TEXT[stageNow].text}
      </div>
      <p className="text-xs text-ink-3">The population (millions, illustrative, starting at 10) is worked out one year at a time: P(next year) = P × (1 + (birth rate − death rate) / 1000). Migration is left out. The stage names use teaching thresholds (death rate of 25 or more per 1000 is stage 1; a gap of 10 or more is stage 2), not official definitions.</p>
    </div>
  );

  const pyramidTab = (
    <div className="space-y-3 px-3 py-3" data-tab-panel="pyramid">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pyramid activity">
        <button type="button" aria-pressed={pyMode === 'build'} data-py="build" onClick={() => setPyMode('build')} className={chip(pyMode === 'build')}>Build a pyramid</button>
        <button type="button" aria-pressed={pyMode === 'read'} data-py="read" onClick={() => setPyMode('read')} className={chip(pyMode === 'read')}>Read this pyramid</button>
      </div>
      {pyMode === 'build' ? (
        <>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {sl('pl-tfr', 'Children per woman (fertility)', '', tfr, 1, 7, 0.1, (v) => setTfr(Math.round(v * 10) / 10), tfr.toFixed(1))}
            {sl('pl-e0', 'Life expectancy at birth (mortality)', 'years', e0, 35, 85, 1, setE0)}
          </div>
          <PyramidSvg p={py} narrow={narrow} />
          <div className="rounded-md bg-accent-soft p-3 text-sm text-ink" aria-live="polite" data-shape-card>
            <strong data-shape>{SHAPE_NAME[shape]} pyramid.</strong> {SHAPE_STAGE[shape]}
            <div className="num mt-1">Children (0 to 14): {f1(py.children)}% · working age (15 to 59): {f1(py.working)}% · aged (60 and above): {f1(py.aged)}%</div>
          </div>
          <p className="text-xs text-ink-3">An illustrative model: the pyramid a population would settle into with these two numbers and no migration. Bars are per cent of the whole population; the oldest bar is 80 to 84 (older ages are left out). These are made-up shapes, not any real country.</p>
        </>
      ) : (
        <div className="space-y-3" data-read>
          <p className="text-sm text-ink">Look at each illustrative pyramid and say which shape it is.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((pr) => {
              const p = pyramid(pr.tfr, pr.e0);
              const a = readAns[pr.id];
              return (
                <div key={pr.id} className={`${panel} p-2`} data-preset={pr.id}>
                  <h3 className="text-sm font-semibold text-ink">{pr.name}</h3>
                  <PyramidSvg p={p} narrow small />
                  <div className="mt-1 flex flex-col gap-1" role="group" aria-label={`Shape of ${pr.name}`}>
                    {(['expanding', 'constant', 'declining'] as Shape[]).map((s) => {
                      const state = a === undefined ? '' : s === pr.answer ? 'correct' : a === s ? 'wrong' : '';
                      return (
                        <button key={s} type="button" disabled={a !== undefined} data-read-answer={s} onClick={() => setReadAns((x) => ({ ...x, [pr.id]: s }))} className={`h-8 rounded-md px-2 text-left text-[13px] ring-1 ring-inset ${state === 'correct' ? 'bg-correct-soft ring-correct' : state === 'wrong' ? 'bg-wrong-soft ring-wrong' : 'bg-surface ring-rule-strong hover:bg-paper'}`}>{SHAPE_NAME[s]}</button>
                      );
                    })}
                  </div>
                  {a !== undefined && <p className="mt-1.5 text-xs text-ink" data-read-why><strong>{a === pr.answer ? 'Right. ' : `It is ${pr.answer}. `}</strong>{whyShape(pr.answer, p)} {SHAPE_STAGE[pr.answer]}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const hdiTab = (
    <div className="space-y-3 px-3 py-3" data-tab-panel="hdi">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Illustrative profiles">
        <span className="text-sm text-ink-2">Try a profile:</span>
        {PROFILES.map((p) => <button key={p.id} type="button" aria-pressed={profile === p.id} data-profile={p.id} onClick={() => { setHdiInput(p.input); setProfile(p.id); }} className={chip(profile === p.id)}>{p.name}</button>)}
        <button type="button" className={chip(profile === null)} onClick={() => { setHdiInput(HDI_START); setProfile(null); }}>Start values</button>
      </div>
      {profile && <p className="text-sm text-ink">{PROFILES.find((p) => p.id === profile)?.note} <span className="text-ink-3">(Illustrative, not a real country.)</span></p>}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {sl('pl-le', 'Life expectancy at birth', 'years', hl.life, 30, 85, 1, (v) => { setHl((x) => ({ ...x, life: v })); setProfile(null); })}
        {sl('pl-inc', 'Income per person (PPP $)', '', hl.lg, 2, Math.log10(GOALPOSTS.gni.max), 0.01, (v) => { setHl((x) => ({ ...x, lg: v })); setProfile(null); }, grp(hin.gni))}
        {sl('pl-eys', 'Expected years of schooling', 'years', hl.eys, 0, 18, 0.5, (v) => { setHl((x) => ({ ...x, eys: v })); setProfile(null); })}
        {sl('pl-mys', 'Mean years of schooling', 'years', hl.mys, 0, 15, 0.5, (v) => { setHl((x) => ({ ...x, mys: v })); setProfile(null); })}
      </div>
      <div className="space-y-2" aria-live="polite" data-hdi-bars>
        {(['health', 'education', 'income'] as Dimension[]).map((d) => (
          <Bar key={d} label={DIMENSION_NAME[d]} value={dimVal[d]} scale={1} shown={f3(dimVal[d])} color={hr.limiting === d ? AMBER : BLUE} note={hr.limiting === d ? 'the lowest index: it holds the HDI back' : undefined} />
        ))}
        <Bar label="Human Development Index (geometric mean)" value={hr.hdi} scale={1} shown={f3(hr.hdi)} color={GREEN} />
      </div>
      <IncomeChart base={hin} narrow={narrow} />
      <div className="rounded-md bg-accent-soft p-3 text-sm text-ink" data-hdi-card>
        <strong>HDI = ({f3(hr.health)} × {f3(hr.education)} × {f3(hr.income)})<sup>1/3</sup> = {f3(hr.hdi)}.</strong> The limiting dimension is {DIMENSION_NAME[hr.limiting].split(' (')[0]!.toLowerCase()}. Raising it by 0.1 would add {f3(gainIfRaised(hr, hr.limiting))} to the HDI; raising the strongest one by 0.1 would add only {f3(gainIfRaised(hr, (['health', 'education', 'income'] as Dimension[]).reduce((a, b) => (dimVal[b] > dimVal[a] ? b : a))))}.
      </div>
      <p className="text-xs text-ink-3">Method (UNDP, Human Development Report technical notes; to be verified by a subject expert). Each dimension index = (actual − minimum) / (maximum − minimum), kept between 0 and 1. Goalposts: life expectancy 20 to 85 years; expected years of schooling 0 to 18; mean years of schooling 0 to 15 (the education index is the average of those two indices); income per person 100 to 75,000 PPP dollars, using the natural logarithm of income. HDI = the geometric mean of the three indices. The lesson’s worked example uses 25 to 85 years, an older range, so its numbers differ.</p>
    </div>
  );

  const readout = (
    <div className={`${panel} p-3`} aria-live="polite" data-readout>
      <h3 className="text-sm font-semibold text-ink">Measured now</h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2 num">
        {tab === 'density' && ([
          ['Arithmetic density', dens.arithmetic === null ? 'not defined' : `${r1(dens.arithmetic)} per km²`],
          ['Physiological density', dens.physiological === null ? 'not defined' : `${r1(dens.physiological)} per km²`],
          ['Agricultural density', dens.agricultural === null ? 'not defined' : `${r1(dens.agricultural)} per km²`],
          ['Cultivated share of area', `${((cult / region.area) * 100).toFixed(0)}%`],
        ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
        {tab === 'transition' && ([
          ['Natural increase now', `${f1(run.ni[yi]!)} per 1000`],
          ['Stage now', `Stage ${stageNow}`],
          ['Peak natural increase', `${f1(sum.peakNI)} per 1000 in year ${sum.peakYear}`],
          ['Population at the end', `${f1(sum.finalPop)} million (${f1(sum.multiple)} times)`],
        ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
        {tab === 'pyramid' && ([
          ['Shape', SHAPE_NAME[shape]],
          ['Base ratio (0 to 4 ÷ 15 to 19)', (((py.male[0]! + py.female[0]!) / (py.male[3]! + py.female[3]!))).toFixed(2)],
          ['Growth rate of this population', `${(py.r * 100).toFixed(2)}% a year`],
          ['Children · aged', `${f1(py.children)}% · ${f1(py.aged)}%`],
        ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
        {tab === 'hdi' && ([
          ['Health · education · income', `${f3(hr.health)} · ${f3(hr.education)} · ${f3(hr.income)}`],
          ['HDI', f3(hr.hdi)],
          ['Limiting dimension', DIMENSION_NAME[hr.limiting].split(' (')[0]!],
          ['Income', `${grp(hin.gni)} PPP $`],
        ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
      </dl>
    </div>
  );

  const calculator = tab === 'density' && (
    <section className={`${panel} space-y-3 p-3`} data-calc>
      <h3 className="text-sm font-semibold text-ink">Your calculation, step by step</h3>
      <p className="text-xs text-ink-3">Use the numbers in the table above (they follow the sliders). Give each answer in persons per km².</p>
      {DENSITY_KINDS.map((k, i) => {
        const c = checked[k.id];
        const shownVerdict = c && c.sig === sig ? c.v : null;
        return (
          <div key={k.id} className="space-y-1.5" data-step={k.id}>
            <label className="block text-sm font-medium text-ink" htmlFor={`pl-in-${k.id}`}>Step {i + 1}: {k.name} = {k.formula}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id={`pl-in-${k.id}`} inputMode="decimal" autoComplete="off" value={entry[k.id]} onChange={(e) => { const v = e.target.value; setEntry((x) => ({ ...x, [k.id]: v })); setChecked((x) => { const y = { ...x }; delete y[k.id]; return y; }); }} className="h-9 w-40 rounded-md bg-surface px-2.5 text-sm ring-1 ring-inset ring-rule-strong" placeholder="your answer" />
              <button type="button" className={btnMain} data-check={k.id} onClick={() => setChecked((x) => ({ ...x, [k.id]: { v: checkDensity(entry[k.id] ?? '', dens[k.id]), sig } }))}>Check</button>
              {shownVerdict && <span className={`text-sm font-medium ${shownVerdict === 'right' ? 'text-correct' : 'text-wrong'}`} data-verdict={shownVerdict} role="status">{VERDICT_TEXT[shownVerdict]}</span>}
            </div>
            {shownVerdict === 'right' && <p className="rounded-md bg-accent-soft p-2.5 text-sm text-ink" data-meaning>{densityMeaning(k.id, dens, region.area, cult)}</p>}
            {(shownVerdict === 'wrong' || shownVerdict === 'close') && <p className="text-xs text-ink-3">Hint: {k.formula}. {k.id === 'agricultural' ? 'Only the people who work in agriculture are counted on top.' : ''}</p>}
          </div>
        );
      })}
    </section>
  );

  return (
    <div data-population-lab>
      <PageHeader
        back={back}
        title="Population and Human Development Lab"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Geography · People: density, population change, the demographic transition, pyramids and the HDI <Badge tone="amber">Draft – unverified</Badge></span>}
      />
      <StepNav step={step} seen={seen} done={done} go={goStep} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2" role="group" aria-label="What to explore">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-pressed={tab === t.id} data-tab={t.id} onClick={() => setTab(t.id)} className={`h-9 rounded-md px-3 text-sm font-medium ring-1 ring-inset ${tab === t.id ? 'bg-accent text-white ring-accent' : 'bg-surface text-ink-2 ring-rule-strong hover:bg-paper'}`}>{t.label}</button>
              ))}
              <button type="button" className={`${btn} ml-auto`} onClick={resetAll} data-reset><RotateCcw aria-hidden className="size-4" />Reset</button>
            </div>
            {tab === 'density' && densityTab}
            {tab === 'transition' && transitionTab}
            {tab === 'pyramid' && pyramidTab}
            {tab === 'hdi' && hdiTab}
          </div>
          {readout}
          {calculator}
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <p className="text-[15px] text-ink">Four small experiments on the ideas of the lessons on people. All regions, populations and profiles here are <strong>illustrative</strong>: they are made up for practice and are not real statistics.</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li><strong>Density calculators:</strong> work out arithmetic, physiological and agricultural density for a region and see what each one tells a geographer. Slide the cultivated area and watch them move.</li>
                <li><strong>Demographic transition:</strong> choose when the death rate and the birth rate fall, and watch the natural increase gap and the population.</li>
                <li><strong>Pyramid builder:</strong> change fertility and life expectancy and see the pyramid change between expanding, constant and declining; then read three pyramids.</li>
                <li><strong>Human Development Index:</strong> set health, education and income and see which one holds the HDI back.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>Start predicting</button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={PREDICTS} index={pi} picked={picked} tested={tested}
              onSelect={choosePredict} onPick={(id, o) => setPicked((x) => ({ ...x, [id]: o }))}
              onLock={(i) => { const p = PREDICTS[i] ?? PREDICTS[0]!; apply(p.id, 'test'); setTested((x) => ({ ...x, [p.id]: true })); }}
              explain={explain}
              onNext={() => choosePredict(pi + 1)} onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                <li>Density: pick Region D (the urban belt). Which density is highest, and which is lowest? What does that say about where its people work?</li>
                <li>Density: pick Region C and slide the cultivated area to zero. Which densities disappear?</li>
                <li>Transition: move “Year the death rate falls” from 40 to 100. What happens to the year of the peak and to the final population?</li>
                <li>Transition: set “Birth rate falls this many years later” to 0. How does the population curve change?</li>
                <li>Pyramid: slide the number of children per woman from 6 down to 1.2 at a life expectancy of 70. Where does the shape change?</li>
                <li>HDI: try Profiles P, Q and R. Which dimension limits each, and what happens to the HDI if you raise only the strong dimension?</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => goStep(3)}>Now measure</button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">In the demographic transition bench, record the peak natural increase and the final population for at least three different settings, for example when the death rate falls in year 30, 60 and 90.</p>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Set the year the death rate falls">
                <span className="text-sm text-ink-2">Death rate falls in year:</span>
                {[30, 60, 90].map((m) => <button key={m} type="button" className={chip(tp.deathMid === m)} data-dmid={m} onClick={() => setTp((x) => ({ ...x, deathMid: m }))}>{m}</button>)}
              </div>
              <p className="text-sm text-ink-2">Now: death rate falls in year {tp.deathMid}, birth rate {tp.lag} years later, starting birth rate {tp.birthHigh} per 1000. Peak natural increase {f1(sum.peakNI)} per 1000 in year {sum.peakYear}; population at the end {f1(sum.finalPop)} million.</p>
              <button type="button" className={btnMain} onClick={record} data-record>Record reading</button>
              {rows.length > 0 && (
                <div className="overflow-x-auto" data-history>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-2"><th className="py-1 pr-2">Death falls</th><th className="pr-2">Lag</th><th className="pr-2">Birth rate</th><th className="pr-2">Peak NI</th><th>Final pop.</th></tr></thead>
                    <tbody className="num">{rows.map((x) => <tr key={x.key} className="border-t border-rule"><td className="py-1 pr-2">year {x.deathMid}</td><td className="pr-2">{x.lag}</td><td className="pr-2">{x.birthHigh}</td><td className="pr-2">{f1(x.peakNI)} (yr {x.peakYear})</td><td>{f1(x.finalPop)} m</td></tr>)}</tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>Clear table</button>
                </div>
              )}
              {canFit && <button type="button" className={btnMain} onClick={() => goStep(4)}>Analyse my readings</button>}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {canFit ? (
                <>
                  <p className="text-[15px] text-ink">Total population against time for your {rows.length} readings (millions, illustrative).</p>
                  <PopChart series={rows.map((r, k) => ({ run: simulateTransition({ ...TRANSITION_DEFAULT, deathMid: r.deathMid, lag: r.lag, birthHigh: r.birthHigh }), color: CURVES[k % CURVES.length]!, label: `death rate falls in year ${r.deathMid}` }))} narrow={narrow} />
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink" data-legend>
                    {rows.map((r, k) => <li key={r.key} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-1 w-5 rounded" style={{ background: CURVES[k % CURVES.length] }} />death rate falls in year {r.deathMid}, lag {r.lag}, birth {r.birthHigh}</li>)}
                  </ul>
                  <p className="rounded-md bg-accent-soft p-2.5 text-sm text-ink" data-finding>
                    {earlierMeansBigger(rows) === true
                      ? 'In your readings, the earlier the death rate falls (with the birth rate unchanged), the larger the final population: the gap between births and deaths stays open for longer. '
                      : earlierMeansBigger(rows) === false
                        ? 'In your readings the order is not simply earlier = bigger, so more than one setting changed. Compare readings where only the year of the death-rate fall differs. '
                        : 'Your readings change more than one setting at once, so compare the curves one pair at a time. '}
                    The peak natural increase is the widest gap between the two rate curves.
                  </p>
                </>
              ) : (
                <p className="text-[15px] text-ink">Record at least three readings at different settings in the Measure step first.</p>
              )}
              <button type="button" className={btnMain} onClick={() => goStep(5)}>Understand</button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                <li>Arithmetic density = total population ÷ total area. Physiological density = total population ÷ net cultivated area, the pressure of all people on farmland. Agricultural density = agricultural population ÷ net cultivated area, the pressure from those who depend on farming.</li>
                <li>When cultivated land is lost and the people stay, arithmetic density does not change but physiological and agricultural density rise.</li>
                <li>Natural increase = birth rate − death rate (per 1000). Actual growth also adds in-migrants and subtracts out-migrants. A rate of 15 per 1000 is 1.5 per cent a year.</li>
                <li>Demographic transition: stage 1 has a high birth rate and a high death rate (slow growth); in stage 2 the death rate falls first while the birth rate stays high (rapid growth); in stage 3 the birth rate falls too and growth is slow or stable. The earlier the death rate falls, and the longer the birth rate lags behind it, the larger the population grows.</li>
                <li>Pyramids: a broad base (many children) is an expanding population, roughly equal widths a constant one, a narrow base and wide middle a declining and ageing one.</li>
                <li>HDI: three dimension indices from fixed minimum and maximum values (goalposts), combined by a geometric mean, so a weak dimension pulls the HDI down. The income index uses a logarithm, so each extra dollar counts for less at a high income.</li>
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>Try CUET-style questions</button>
            </section>
          )}
          {step === 6 && <ApplyCard questions={APPLY} ans={ans} onAnswer={(id, o) => setAns((x) => ({ ...x, [id]: o }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
        </div>
      </div>
    </div>
  );
}
