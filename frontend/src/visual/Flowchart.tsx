/** The interactive flowchart: walk the stages forward and back, choose at the decision, then answer a short check. */
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { DisplayMath, Rich } from '../rich';
import { FLOW_BOX, FlowDrawing } from './flowdraw';
import { FORMULAS, SOURCE, type Choice, type FlowNode } from './gravitation';
import { InlineTex } from './MindMap';

export function Check({ question, choices, name }: { question: string; choices: Choice[]; name: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = picked === null ? null : choices[picked]!;
  return (
    <fieldset className="rounded-xl border border-rule bg-surface p-4" data-check={name} data-answered={chosen ? (chosen.correct ? 'right' : 'wrong') : undefined}>
      <legend className="px-1 text-[15px] font-semibold text-ink">{question}</legend>
      <div className="mt-1 space-y-2">
        {choices.map((c, i) => {
          const on = picked === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(i)}
              className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[15px] text-ink transition-colors ${on ? (c.correct ? 'border-correct bg-correct-soft' : 'border-wrong bg-wrong-soft') : 'border-rule hover:border-rule-strong hover:bg-paper'}`}
            >
              <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${on ? (c.correct ? 'border-correct bg-correct text-white' : 'border-wrong bg-wrong text-white') : 'border-rule-strong text-ink-2'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span>{c.text}</span>
            </button>
          );
        })}
      </div>
      {chosen && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${chosen.correct ? 'bg-correct-soft text-ink' : 'bg-wrong-soft text-ink'}`} data-check-feedback>
          <span className={`font-semibold ${chosen.correct ? 'text-correct' : 'text-wrong'}`}>{chosen.correct ? 'Correct. ' : 'Not yet. '}</span>
          {chosen.why.replace(/^(Right|Not this|Not quite)\.\s+/, '')}
          {!chosen.correct && ' Try another answer.'}
        </p>
      )}
    </fieldset>
  );
}

export function Flowchart({ nodes, title, check }: { nodes: FlowNode[]; title: string; check: { question: string; choices: Choice[] } }) {
  const [trail, setTrail] = useState<string[]>([nodes[0]!.id]);
  const current = nodes.find((n) => n.id === trail[trail.length - 1])!;
  const visited = new Set(trail);
  const go = (id: string) => setTrail((t) => (t.includes(id) ? t.slice(0, t.indexOf(id) + 1) : [...t, id]));
  const back = () => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
  const f = current.formula ? FORMULAS[current.formula] : null;
  const stages = nodes.filter((n) => n.kind !== 'wrong');
  const done = current.kind === 'result';
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]" data-flowchart data-current={current.id}>
      <div className="overflow-hidden rounded-xl border border-rule bg-[#f8fafd]">
        <svg viewBox={`0 0 ${FLOW_BOX.w} ${FLOW_BOX.h}`} className="block h-auto w-full" role="group" aria-label={`Flowchart: ${title}. ${stages.length} stages. You are at: ${current.label}.`}>
          <FlowDrawing nodes={nodes} current={current.id} visited={visited} onPick={go} />
        </svg>
      </div>
      <div className="min-w-0">
        <div key={current.id} className="vl-fade rounded-xl border border-rule bg-surface p-4" data-flow-panel aria-live="polite">
          <h3 className="text-base font-semibold text-ink">{current.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            <Rich text={current.kind === 'decision' ? current.ask : current.text} inline />
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
          {current.kind === 'decision' && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your answer">
              <button type="button" onClick={() => go(current.yes!)} className="h-10 rounded-lg bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper" data-decide="yes">
                Yes, the same
              </button>
              <button type="button" onClick={() => go(current.no!)} className="h-10 rounded-lg bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper" data-decide="no">
                No, it is weaker
              </button>
            </div>
          )}
          <p className="mt-3 text-[13px] text-ink-3">
            Source: {SOURCE.publisher} Class XI Physics, section {current.src.section}, page {current.src.page}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={back} disabled={trail.length < 2} className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper disabled:opacity-40" data-flow-back>
            <ChevronLeft aria-hidden className="size-4" />
            Back
          </button>
          {current.kind !== 'decision' && !done && (
            <button type="button" onClick={() => go(current.next!)} className="inline-flex h-10 items-center gap-1 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong" data-flow-next>
              {current.kind === 'wrong' ? 'Choose again' : 'Next'}
              <ChevronRight aria-hidden className="size-4" />
            </button>
          )}
          {done && (
            <button type="button" onClick={() => setTrail([nodes[0]!.id])} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper" data-flow-restart>
              <RotateCcw aria-hidden className="size-4" />
              Start again
            </button>
          )}
          <span className="ml-auto text-sm text-ink-2">{current.kind === 'wrong' ? 'A wrong turn' : `Stage ${stages.findIndex((n) => n.id === current.id) + 1} of ${stages.length}`}</span>
        </div>
        {done && (
          <div className="mt-4">
            <Check name="flow" question={check.question} choices={check.choices} />
          </div>
        )}
      </div>
    </div>
  );
}
