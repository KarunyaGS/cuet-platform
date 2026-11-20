import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Badge, PageHeader } from '../../ui';
import { ApplyCard, btn, btnMain, panel, PredictCard, RangeSlider, Slider, StepNav, useLabCompletion, useLabOrigin, useScrollTopOnOpen, useSteps } from '../labkit';
import { FitGraph, fmt, fromPos, LineGraph, linearFit, startValues, toPos, withValues } from './kit';
import { clampTo, digitsFor, stepFor, type Range } from '../ranges';
import { specById } from './specs';
import type { Outs, Spec, Values, VarDef } from './types';

const computeOuts = (spec: Spec, v: Values): Outs => Object.fromEntries(spec.outs.map((o) => [o.id, o.fn(v)]));
const sweepPoints = 60;

interface Reading { v: Values; o: Outs }

/** One chapter lab, built from its spec. Everything shown is computed live from the spec's model. */
function SpecLabBody({ spec }: { spec: Spec }) {
  const { lessonId, back } = useLabOrigin();
  useScrollTopOnOpen();
  const [v, setV] = useState<Values>(() => startValues(spec.vars));
  // The student's own range for any control. Anything not listed here uses the lab's own range.
  const [ranges, setRanges] = useState<Record<string, Range>>({});
  const evars = useMemo<VarDef[]>(
    () =>
      spec.vars.map((d) => {
        const r = ranges[d.id];
        if (!r) return d;
        const step = d.log ? d.step : d.integer ? Math.max(1, Math.round(stepFor(d.step, r))) : stepFor(d.step, r);
        return { ...d, min: r.min, max: r.max, step, digits: digitsFor(step, d.digits ?? 2) };
      }),
    [spec, ranges],
  );
  const o = useMemo(() => computeOuts(spec, v), [spec, v]);
  // The picture is drawn for values inside the lab's own range, so a wide custom range can never break the drawing.
  // Every number, table and graph still uses the exact values.
  const sv = useMemo<Values>(() => Object.fromEntries(spec.vars.map((d) => [d.id, clampTo(v[d.id]!, { min: d.min, max: d.max })])), [spec, v]);
  const so = useMemo(() => computeOuts(spec, sv), [spec, sv]);
  const sceneCapped = spec.vars.some((d) => sv[d.id] !== v[d.id]);
  const { step, seen, go } = useSteps();
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Reading[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const finished = Object.keys(ans).length === spec.questions.length;
  const distinct = new Set(rows.map((r) => Number((r.v[spec.measure.vary] ?? 0).toPrecision(6)))).size;
  const pending = [
    ...(Object.keys(tested).length < spec.preds.length ? [`test all ${spec.preds.length} predictions`] : []),
    ...(distinct < 3 ? ['record at least three readings with different values of the variable you change in the Measure step'] : []),
  ];
  const saved = useLabCompletion(finished && pending.length === 0, lessonId);
  const done = [true, Object.keys(tested).length === spec.preds.length, true, distinct >= 3, distinct >= 3, true, finished];
  const set = (id: string, x: number) => setV((cur) => ({ ...cur, [id]: x }));
  const choose = (i: number) => {
    const p = spec.preds[i] ?? spec.preds[0]!;
    setPi(i);
    setV(withValues(spec.vars, p.base));
    setRanges({});
  };
  const record = () => {
    const key = Number((v[spec.measure.vary] ?? 0).toPrecision(6));
    if (rows.some((r) => Number((r.v[spec.measure.vary] ?? 0).toPrecision(6)) === key)) return;
    setRows((r) => [...r, { v: { ...v }, o: { ...o } }]);
  };
  const varDef = (id: string) => evars.find((x) => x.id === id)!;
  const outDef = (id: string) => spec.outs.find((x) => x.id === id)!;
  const fit = useMemo(() => {
    const f = spec.measure.fit;
    if (!f || distinct < 3) return null;
    const pts = rows.map((r) => ({ x: f.x(r.v, r.o), y: f.y(r.v, r.o) }));
    return { pts, ...linearFit(pts) };
  }, [rows, spec.measure.fit, distinct]);

  const sweeps = useMemo(
    () =>
      spec.graphs.map((g) => {
        const xv = varDef(g.x);
        const xs = Array.from({ length: sweepPoints }, (_, k) => fromPos(xv, (1000 * k) / (sweepPoints - 1)));
        const yo = outDef(g.y);
        const ys = xs.map((x) => yo.fn({ ...v, [g.x]: x }));
        return { g, xs, ys, xv, yo };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, v, evars],
  );

  return (
    <div data-spec-lab={spec.id}>
      <PageHeader
        back={back}
        title={spec.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {spec.subject} · {spec.format} <Badge tone="amber">Draft – unverified</Badge>
          </span>
        }
      />
      <StepNav step={step} seen={seen} done={done} go={go} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className={`${panel} overflow-hidden`}>
            {spec.scene && (
              // On a phone the 400-wide picture would shrink its labels below a readable size, so it keeps a minimum
              // width and scrolls sideways inside its own card instead of squeezing the text.
              <div className="@container">
                <p className="hidden px-3 pt-2 text-[11px] text-ink-3 @max-[519px]:block">Swipe the picture sideways to see all of it.</p>
                <div className="overflow-x-auto" data-scene-scroll>
                <svg viewBox="0 0 400 230" className="block w-full min-w-[520px] bg-surface" role="img" aria-label={spec.sceneAlt ?? spec.title} data-scene>
                  {spec.scene({ v: sv, o: so })}
                </svg>
                </div>
              </div>
            )}
            <div className="grid gap-x-6 gap-y-3 border-t border-rule px-3 py-3 sm:grid-cols-2">
              {evars.map((d, i) => {
                const design = spec.vars[i]!;
                if (design.choice || !(spec.subject === 'Physics' || spec.subject === 'Chemistry' || spec.subject === 'Biology')) {
                  // a pick from a list, or a subject whose labs keep fixed ranges: the lab's own range only
                  return <Slider key={d.id} id={`spec-${d.id}`} label={d.label} unit={d.unit} value={toPos(d, v[d.id]!)} min={0} max={1000} step={1} shown={fmt(v[d.id]!, d.digits ?? 2)} onChange={(p) => set(d.id, fromPos(d, p))} />;
                }
                return (
                  <RangeSlider
                    key={d.id}
                    id={`spec-${d.id}`}
                    label={d.label}
                    unit={d.unit}
                    value={toPos(d, v[d.id]!)}
                    min={0}
                    max={1000}
                    step={1}
                    shown={fmt(v[d.id]!, d.digits ?? 2)}
                    onChange={(p) => set(d.id, fromPos(d, p))}
                    design={{ min: design.min, max: design.max }}
                    range={{ min: d.min, max: d.max }}
                    rules={{ log: design.log, floor: design.bounds?.min, cap: design.bounds?.max, integer: design.integer }}
                    onRange={(r) => {
                      setRanges((cur) => {
                        const next = { ...cur };
                        if (r.min === design.min && r.max === design.max) delete next[d.id];
                        else next[d.id] = r;
                        return next;
                      });
                      setV((cur) => ({ ...cur, [d.id]: clampTo(cur[d.id]!, r) }));
                    }}
                  />
                );
              })}
              <div className="sm:col-span-2">
                <button type="button" className={btn} onClick={() => {
                    setV(startValues(spec.vars));
                    setRanges({});
                  }}>
                  <RotateCcw aria-hidden className="size-4" /> Reset
                </button>
                {sceneCapped && <p className="mt-2 text-xs text-ink-3">Your values are beyond the range the picture is drawn for, so the picture stops at its edge. All numbers and graphs are exact.</p>}
              </div>
            </div>
          </div>
          <div className={`${panel} p-3`} aria-live="polite" data-readout>
            <h3 className="text-sm font-semibold text-ink">Measured now</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
              {spec.outs.map((d) => (
                <div key={d.id} className="flex items-baseline justify-between gap-2 border-b border-rule py-1">
                  <dt className="text-ink-2">{d.label}</dt>
                  <dd className="num font-semibold text-ink" data-out={d.id}>
                    {fmt(o[d.id]!, d.digits ?? 2, d.sci)} {d.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sweeps.map(({ g, xs, ys, xv, yo }) => (
              <div key={g.id} className={`${panel} p-2`}>
                <LineGraph title={g.title} xs={xs} ys={ys} cx={v[g.x]!} cy={yo.fn(v)} xLabel={xv.unit ? `${xv.label} (${xv.unit})` : xv.label} yLabel={yo.unit ? `${yo.label} (${yo.unit})` : yo.label} logX={g.logX} logY={g.logY} />
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Discover</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                {spec.discover.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <button type="button" className={btnMain} onClick={() => go(1)}>
                Start predicting
              </button>
            </section>
          )}
          {step === 1 && (
            <PredictCard
              items={spec.preds}
              index={pi}
              picked={picked}
              tested={tested}
              onSelect={choose}
              onPick={(id, opt) => setPicked((x) => ({ ...x, [id]: opt }))}
              onLock={(i) => {
                const p = spec.preds[i] ?? spec.preds[0]!;
                setV(withValues(spec.vars, p.base, p.test));
                setRanges({});
                setTested((x) => ({ ...x, [p.id]: true }));
              }}
              explain={(i) => {
                const p = spec.preds[i] ?? spec.preds[0]!;
                return p.why({ base: withValues(spec.vars, p.base), test: withValues(spec.vars, p.base, p.test), outs: (vals) => computeOuts(spec, vals) });
              }}
              onNext={() => choose(pi + 1)}
              onDone={() => go(2)}
            />
          )}
          {step === 2 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Experiment</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                {spec.experiment.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <button type="button" className={btnMain} onClick={() => go(3)}>
                Now measure
              </button>
            </section>
          )}
          {step === 3 && (
            <section className={`${panel} space-y-3 p-4`} data-measure>
              <h2 className="text-lg font-semibold text-ink">Measure</h2>
              <p className="text-[15px] text-ink">{spec.measure.instruction}</p>
              <p className="text-sm text-ink-2">
                Change <strong>{varDef(spec.measure.vary).label}</strong> between readings.
              </p>
              <button type="button" className={btnMain} onClick={record} data-record>
                Record reading
              </button>
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-readings>
                    <thead>
                      <tr className="text-left text-ink-2">
                        <th className="py-1 pr-2">{varDef(spec.measure.vary).label}</th>
                        {spec.measure.record.map((id) => (
                          <th key={id} className="pr-2">
                            {outDef(id).label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="num">
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-rule">
                          <td className="py-1 pr-2">{fmt(r.v[spec.measure.vary]!, varDef(spec.measure.vary).digits ?? 2)}</td>
                          {spec.measure.record.map((id) => (
                            <td key={id} className="pr-2">
                              {fmt(r.o[id]!, outDef(id).digits ?? 2, outDef(id).sci)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className={`${btn} mt-2`} onClick={() => setRows([])}>
                    Clear table
                  </button>
                </div>
              )}
              {distinct >= 3 && (
                <button type="button" className={btnMain} onClick={() => go(4)}>
                  Analyse my readings
                </button>
              )}
            </section>
          )}
          {step === 4 && (
            <section className={`${panel} space-y-3 p-4`} data-analyse>
              <h2 className="text-lg font-semibold text-ink">Analyse</h2>
              {distinct < 3 ? (
                <p className="text-[15px] text-ink">Record at least three readings with different values in the Measure step first.</p>
              ) : fit && spec.measure.fit ? (
                <>
                  <FitGraph pts={fit.pts} fit={fit} xLabel={spec.measure.fit.xLabel} yLabel={spec.measure.fit.yLabel} />
                  <p className="text-[15px] text-ink">{spec.measure.fit.interpret(fit.slope, fit.intercept, rows[rows.length - 1]!.v)}</p>
                  <p className="text-xs text-ink-3">Straight-line fit through your {rows.length} readings: r² = {fit.r2.toFixed(4)}.</p>
                </>
              ) : (
                <p className="text-[15px] text-ink">Your readings are in the table. Compare how each quantity changed as you changed {varDef(spec.measure.vary).label}.</p>
              )}
              <button type="button" className={btnMain} onClick={() => go(5)}>
                Understand
              </button>
            </section>
          )}
          {step === 5 && (
            <section className={`${panel} space-y-2 p-4`}>
              <h2 className="text-lg font-semibold text-ink">Understand</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                {spec.understand.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <button type="button" className={btnMain} onClick={() => go(6)}>
                Try CUET-style questions
              </button>
            </section>
          )}
          {step === 6 && <ApplyCard questions={spec.questions} ans={ans} onAnswer={(id, opt) => setAns((x) => ({ ...x, [id]: opt }))} saved={saved} backTo={lessonId ? back.to : null} pending={pending} />}
        </div>
      </div>
    </div>
  );
}

/** Route /lab/c/:id: the dedicated lab of one chapter. */
export function SpecLabPage() {
  const { id = '' } = useParams();
  const spec = specById(id);
  if (!spec) return <p className="p-6 text-ink-2">This lab does not exist.</p>;
  return <SpecLabBody key={spec.id} spec={spec} />;
}
