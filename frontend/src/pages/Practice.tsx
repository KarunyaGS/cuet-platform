import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Clock, Flag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, type Feedback, type PracticeSession, type SessionQuestion } from '../api';
import { QuestionStem } from '../question';
import { Rich } from '../rich';
import { BookmarkButton } from '../tools';
import { Badge, Button, ErrorBox, Loading, useLoad } from '../ui';

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - 30_000 - now) / 1000));
}
const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const MODE: Record<string, string> = { PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' };

type Cell = 'current' | 'answered' | 'marked' | 'answered-marked' | 'not-answered' | 'not-visited' | 'correct' | 'incorrect';
const CELL: Record<Exclude<Cell, 'current'>, { cls: string; label: string }> = {
  answered: { cls: 'bg-accent text-white', label: 'Answered' },
  'answered-marked': { cls: 'bg-marker text-white', label: 'Answered, marked' },
  marked: { cls: 'bg-marker-soft text-marker ring-1 ring-inset ring-marker/40', label: 'Marked for review' },
  'not-answered': { cls: 'bg-surface text-wrong ring-1 ring-inset ring-wrong/40', label: 'Not answered' },
  'not-visited': { cls: 'bg-paper text-ink-2 ring-1 ring-inset ring-rule', label: 'Not visited' },
  correct: { cls: 'bg-correct text-white', label: 'Correct' },
  incorrect: { cls: 'bg-wrong text-white', label: 'Wrong' },
};

/** The test screen: distraction-free, with a CBT-style question palette, timer and a check before submitting. */
export function PracticePage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(() => api.session(sessionId), [sessionId]);
  const [data, setData] = useState<PracticeSession | null>(null);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setData(loaded.data), [loaded.data]);
  const left = useCountdown(data?.session.status === 'IN_PROGRESS' ? data.session.deadline : null);

  useEffect(() => {
    if (data && data.session.status !== 'IN_PROGRESS') navigate(`/results/${sessionId}`, { replace: true });
  }, [data, navigate, sessionId]);
  useEffect(() => {
    if (left === 0 && data?.session.status === 'IN_PROGRESS') void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  const qid = data?.questions[i]?.id;
  useEffect(() => {
    if (qid) setVisited((v) => (v.has(qid) ? v : new Set(v).add(qid)));
  }, [qid]);

  const practice = data?.session.mode === 'PRACTICE';
  const choose = useCallback(
    async (question: SessionQuestion, position: number) => {
      if (practice && feedback[question.id]?.outcome) return; // locked after feedback
      setErr(null);
      const selected = question.type === 'MCQ_MULTI' ? toggle(question.answer?.selectedPositions ?? [], position) : [position];
      setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === question.id ? { ...x, answer: { selectedPositions: selected, numericAnswer: null } } : x)) });
      if (question.type === 'MCQ_MULTI' && practice) return; // multi-select: confirm with the Check button
      try {
        const res = await api.answer(sessionId, { questionId: question.id, selectedPositions: selected });
        if (practice) setFeedback((f) => ({ ...f, [question.id]: res }));
      } catch (e) {
        setErr(e as Error);
      }
    },
    [practice, feedback, sessionId],
  );

  // Keyboard: A–D or 1–4 choose an option, arrow keys move between questions.
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || confirming) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const q = data.questions[i];
      if (!q) return;
      if (e.key === 'ArrowRight') setI((k) => Math.min(data.questions.length - 1, k + 1));
      else if (e.key === 'ArrowLeft') setI((k) => Math.max(0, k - 1));
      else {
        const k = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : /^[a-h]$/i.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
        const opt = q.options[k];
        if (opt) {
          e.preventDefault();
          void choose(q, opt.position);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, i, choose, confirming]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  if (loaded.loading || !data) return loaded.error ? <ErrorBox error={loaded.error} /> : <Loading />;
  const q = data.questions[i]!;
  const fb = feedback[q.id];
  const total = data.questions.length;

  async function submit() {
    setBusy(true);
    try {
      await api.submit(sessionId);
      navigate(`/results/${sessionId}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(false);
      setConfirming(false);
    }
  }
  const answered = (x: SessionQuestion) => Boolean(x.answer?.selectedPositions?.length);
  const cellOf = (x: SessionQuestion): Exclude<Cell, 'current'> => {
    const f = feedback[x.id]?.outcome;
    if (practice && f === 'CORRECT') return 'correct';
    if (practice && f === 'INCORRECT') return 'incorrect';
    const a = answered(x);
    if (marked.has(x.id)) return a ? 'answered-marked' : 'marked';
    if (a) return 'answered';
    return visited.has(x.id) ? 'not-answered' : 'not-visited';
  };
  const counts = data.questions.reduce<Record<string, number>>((c, x) => ((c[cellOf(x)] = (c[cellOf(x)] ?? 0) + 1), c), {});
  const answeredCount = data.questions.filter(answered).length;
  const legend = (practice ? (['correct', 'incorrect', 'answered', 'not-visited'] as const) : (['answered', 'not-answered', 'marked', 'answered-marked', 'not-visited'] as const));
  const toggleMark = () => setMarked((m) => (m.has(q.id) ? new Set([...m].filter((x) => x !== q.id)) : new Set(m).add(q.id)));
  const timeTone = left === null ? '' : left < 60 ? 'bg-wrong-soft text-wrong ring-wrong/30' : left < 300 ? 'bg-marker-soft text-marker ring-marker/30' : 'bg-surface text-ink ring-rule';
  const startSubmit = () => (practice || answeredCount === total ? void submit() : setConfirming(true));

  return (
    <div>
      {/* Test bar */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="font-semibold text-ink">{MODE[data.session.mode]}</div>
            <div className="num text-xs text-ink-3">
              {total} questions, marking {data.session.marking.correct > 0 ? '+' : ''}
              {data.session.marking.correct} / {data.session.marking.incorrect < 0 ? '−' : ''}
              {Math.abs(data.session.marking.incorrect)}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="num hidden text-sm text-ink-2 sm:inline">
              {answeredCount} of {total} answered
            </span>
            {left !== null && (
              <span role="timer" aria-label="Time left" className={`num inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${timeTone}`}>
                <Clock aria-hidden className="size-4" />
                {clock(left)}
              </span>
            )}
            <Button onClick={startSubmit} disabled={busy}>
              {busy ? 'Submitting…' : practice ? 'Finish' : 'Submit test'}
            </Button>
          </div>
        </div>
        {left !== null && (left === 300 || left === 60) && (
          <span className="sr-only" aria-live="assertive">
            {left === 60 ? 'One minute left' : 'Five minutes left'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-rule bg-surface" aria-label={`Question ${q.number} of ${total}`}>
          <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
            <span className="num text-sm font-semibold text-ink">
              Question {q.number} <span className="font-normal text-ink-3">of {total}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge>{q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}</Badge>
              {q.type === 'MCQ_MULTI' && <Badge tone="accent">More than one answer</Badge>}
              <BookmarkButton kind="QUESTION" id={q.id} compact />
            </span>
          </div>
          <div className="px-5 py-5">
            {q.passage && (
              <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-rule bg-paper p-4 font-serif text-[15px] leading-relaxed text-ink">
                {q.passage.title && <div className="mb-1 font-sans font-semibold">{q.passage.title}</div>}
                {q.passage.body}
              </div>
            )}
            <QuestionStem stem={q.stem} structure={q.structure} />
            <ul className="mt-5 space-y-2.5" role={q.type === 'MCQ_MULTI' ? 'group' : 'radiogroup'} aria-label="Options">
              {q.options.map((o, k) => {
                const chosen = Boolean(q.answer?.selectedPositions?.includes(o.position));
                const right = fb?.correctOptionPositions?.includes(o.position);
                const showResult = Boolean(fb?.outcome);
                const state = showResult
                  ? right
                    ? 'border-correct bg-correct-soft'
                    : chosen
                      ? 'border-wrong bg-wrong-soft'
                      : 'border-rule opacity-70'
                  : chosen
                    ? 'border-accent bg-accent-soft'
                    : 'border-rule hover:border-rule-strong hover:bg-paper';
                const dot = showResult ? (right ? 'border-correct bg-correct text-white' : chosen ? 'border-wrong bg-wrong text-white' : 'border-rule-strong text-ink-2') : chosen ? 'border-accent bg-accent text-white' : 'border-rule-strong text-ink-2';
                return (
                  <li key={o.position}>
                    <button
                      role={q.type === 'MCQ_MULTI' ? 'checkbox' : 'radio'}
                      aria-checked={chosen}
                      onClick={() => choose(q, o.position)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[15px] text-ink transition-colors ${state}`}
                    >
                      <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full border text-[13px] font-semibold ${dot}`}>
                        {o.label}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <Rich text={o.text} inline className="min-w-0" />
                      </span>
                      {showResult && right && <CircleCheck aria-label="Correct answer" className="mt-1 size-5 shrink-0 text-correct" />}
                      {showResult && chosen && !right && <CircleX aria-label="Your answer" className="mt-1 size-5 shrink-0 text-wrong" />}
                      {!showResult && <span className="sr-only">Press {String.fromCharCode(65 + k)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {practice && q.type === 'MCQ_MULTI' && !fb?.outcome && (
              <div className="mt-4">
                <Button
                  kind="secondary"
                  onClick={async () => {
                    try {
                      setFeedback({ ...feedback, [q.id]: await api.answer(sessionId, { questionId: q.id, selectedPositions: q.answer?.selectedPositions ?? [] }) });
                    } catch (e) {
                      setErr(e as Error);
                    }
                  }}
                >
                  Check answer
                </Button>
              </div>
            )}
            {fb?.outcome && (
              <div aria-live="polite" className={`mt-5 rounded-xl border px-4 py-3 ${fb.outcome === 'CORRECT' ? 'border-correct/30 bg-correct-soft' : 'border-wrong/30 bg-wrong-soft'}`}>
                <div className={`flex items-center gap-2 font-semibold ${fb.outcome === 'CORRECT' ? 'text-correct' : 'text-wrong'}`}>
                  {fb.outcome === 'CORRECT' ? <CircleCheck aria-hidden className="size-5" /> : <CircleX aria-hidden className="size-5" />}
                  {fb.outcome === 'CORRECT' ? 'Correct' : fb.outcome === 'INCORRECT' ? 'Not quite' : 'Skipped'}
                  <span className="num font-normal">
                    ({fb.score! > 0 ? '+' : ''}
                    {fb.score} marks)
                  </span>
                </div>
                {fb.explanation && <Rich text={fb.explanation} className="mt-2 text-[15px] leading-relaxed text-ink" />}
              </div>
            )}
            {err && <ErrorBox error={err} />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-3">
            <Button kind="ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} icon={<ChevronLeft aria-hidden />}>
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {!practice && (
                <Button kind={marked.has(q.id) ? 'secondary' : 'ghost'} onClick={toggleMark} icon={<Flag aria-hidden className={marked.has(q.id) ? 'text-marker' : ''} />}>
                  {marked.has(q.id) ? 'Marked for review' : 'Mark for review'}
                </Button>
              )}
              <Button kind="secondary" onClick={() => setI(Math.min(total - 1, i + 1))} disabled={i === total - 1}>
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-36 lg:self-start" aria-label="Question palette">
          <div className="rounded-xl border border-rule bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">Questions</h2>
            <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
              {data.questions.map((x, k) => {
                const c = cellOf(x);
                return (
                  <button
                    key={x.id}
                    onClick={() => setI(k)}
                    aria-label={`Question ${x.number}, ${CELL[c].label.toLowerCase()}`}
                    aria-current={k === i ? 'true' : undefined}
                    className={`num h-9 rounded-lg text-[13px] font-semibold transition-shadow ${CELL[c].cls} ${k === i ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                  >
                    {x.number}
                  </button>
                );
              })}
            </div>
            <ul className="mt-4 space-y-1.5 border-t border-rule pt-3 text-[13px]">
              {legend.map((k) => (
                <li key={k} className="flex items-center gap-2 text-ink-2">
                  <span aria-hidden className={`size-4 rounded ${CELL[k].cls}`} />
                  <span className="flex-1">{CELL[k].label}</span>
                  <span className="num font-medium text-ink">{counts[k] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 hidden text-xs text-ink-3 lg:block">Keys: A–D choose an option, ← → move between questions.</p>
          </div>
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-sm rounded-xl border border-rule bg-surface p-5 shadow-xl">
            <h2 id="confirm-title" className="text-lg font-semibold text-ink">
              Submit this test?
            </h2>
            <p className="mt-1 text-sm text-ink-2">You cannot change answers after submitting.</p>
            <dl className="num mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Answered</dt>
                <dd className="font-semibold text-ink">{answeredCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Not answered</dt>
                <dd className="font-semibold text-wrong">{total - answeredCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Marked for review</dt>
                <dd className="font-semibold text-marker">{marked.size}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <Button kind="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Keep answering
              </Button>
              <Button onClick={() => void submit()} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit test'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toggle(list: number[], v: number) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort();
}
