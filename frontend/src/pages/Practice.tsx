import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type Feedback, type PracticeSession, type SessionQuestion } from '../api';
import { Badge, Button, ErrorBox, Loading, PreviewBadge, useLoad } from '../ui';

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
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function PracticePage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLoad(() => api.session(sessionId), [sessionId]);
  const [data, setData] = useState<PracticeSession | null>(null);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setData(loaded.data), [loaded.data]);
  const left = useCountdown(data?.session.status === 'IN_PROGRESS' ? data.session.deadline : null);

  useEffect(() => {
    if (data && data.session.status !== 'IN_PROGRESS') navigate(`/results/${sessionId}`, { replace: true });
  }, [data, navigate, sessionId]);
  useEffect(() => {
    if (left === 0 && data?.session.status === 'IN_PROGRESS') void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (loaded.loading || !data) return loaded.error ? <ErrorBox error={loaded.error} /> : <Loading />;
  const q = data.questions[i]!;
  const practice = data.session.mode === 'PRACTICE';
  const fb = feedback[q.id];

  async function choose(question: SessionQuestion, position: number) {
    if (practice && feedback[question.id]?.outcome) return; // locked after feedback
    setErr(null);
    const selected = question.type === 'MCQ_MULTI'
      ? toggle(question.answer?.selectedPositions ?? [], position)
      : [position];
    setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === question.id ? { ...x, answer: { selectedPositions: selected, numericAnswer: null } } : x)) });
    if (question.type === 'MCQ_MULTI' && practice) return; // multi-select: confirm with the Check button
    try {
      const res = await api.answer(sessionId, { questionId: question.id, selectedPositions: selected });
      if (practice) setFeedback((f) => ({ ...f, [question.id]: res }));
    } catch (e) {
      setErr(e as Error);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      await api.submit(sessionId);
      navigate(`/results/${sessionId}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(false);
    }
  }
  const answeredCount = data.questions.filter((x) => x.answer?.selectedPositions?.length).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
      <section className="min-w-0 rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-sm">
          <span className="font-medium">
            Question {q.number} <span className="text-zinc-400">of {data.questions.length}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Badge>{q.difficulty.toLowerCase()}</Badge>
            {q.origin === 'AI_ASSISTED' && <Badge tone="amber">AI-assisted draft</Badge>}
            {q.preview && <PreviewBadge what="question" />}
          </span>
        </div>
        <div className="px-3 py-3">
          {q.passage && (
            <div className="mb-3 max-h-60 overflow-y-auto rounded-md bg-zinc-50 p-2.5 text-sm leading-relaxed">
              {q.passage.title && <div className="mb-1 font-medium">{q.passage.title}</div>}
              {q.passage.body}
            </div>
          )}
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{q.stem}</p>
          <ul className="mt-3 space-y-1.5" role="radiogroup" aria-label="Options">
            {q.options.map((o) => {
              const chosen = q.answer?.selectedPositions?.includes(o.position);
              const right = fb?.correctOptionPositions?.includes(o.position);
              const state = fb?.outcome ? (right ? 'border-emerald-500 bg-emerald-50' : chosen ? 'border-red-400 bg-red-50' : 'border-zinc-200') : chosen ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-zinc-200 hover:border-zinc-400';
              return (
                <li key={o.position}>
                  <button role="radio" aria-checked={Boolean(chosen)} onClick={() => choose(q, o.position)} className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition ${state}`}>
                    <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full border border-current text-[11px] font-semibold">{o.label}</span>
                    <span>{o.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {practice && q.type === 'MCQ_MULTI' && !fb?.outcome && (
            <div className="mt-2">
              <Button kind="secondary" onClick={async () => setFeedback({ ...feedback, [q.id]: await api.answer(sessionId, { questionId: q.id, selectedPositions: q.answer?.selectedPositions ?? [] }) })}>
                Check answer
              </Button>
            </div>
          )}
          {fb?.outcome && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm ${fb.outcome === 'CORRECT' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
              <div className="font-semibold">
                {fb.outcome === 'CORRECT' ? 'Correct' : fb.outcome === 'INCORRECT' ? 'Not quite' : 'Skipped'} <span className="num font-normal">({fb.score! > 0 ? '+' : ''}{fb.score} marks)</span>
              </div>
              {fb.explanation && <p className="mt-1 whitespace-pre-line text-zinc-800">{fb.explanation}</p>}
            </div>
          )}
          {err && <ErrorBox error={err} />}
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2">
          <Button kind="ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            ← Previous
          </Button>
          {!practice && (
            <button onClick={() => setMarked((m) => new Set(m.has(q.id) ? [...m].filter((x) => x !== q.id) : [...m, q.id]))} className="text-xs text-zinc-600 hover:underline">
              {marked.has(q.id) ? 'Unmark review' : 'Mark for review'}
            </button>
          )}
          <Button kind="ghost" onClick={() => setI(Math.min(data.questions.length - 1, i + 1))} disabled={i === data.questions.length - 1}>
            Next →
          </Button>
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-16 lg:self-start">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[data.session.mode]}</span>
            {left !== null && <span className={`num font-mono text-sm ${left < 60 ? 'text-red-600' : 'text-zinc-700'}`} aria-live="polite">{mmss(left)}</span>}
          </div>
          <p className="num mt-0.5 text-xs text-zinc-500">
            {answeredCount}/{data.questions.length} answered · +{data.session.marking.correct}/{data.session.marking.incorrect} marking
          </p>
          <div className="mt-2 grid grid-cols-8 gap-1" aria-label="Question palette">
            {data.questions.map((x, k) => {
              const done = x.answer?.selectedPositions?.length;
              const f = feedback[x.id]?.outcome;
              const cls = f === 'CORRECT' ? 'bg-emerald-500 text-white' : f === 'INCORRECT' ? 'bg-red-500 text-white' : marked.has(x.id) ? 'bg-amber-400 text-white' : done ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-700';
              return (
                <button key={x.id} onClick={() => setI(k)} aria-label={`Question ${x.number}`} className={`num h-7 rounded text-xs font-medium ${cls} ${k === i ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}>
                  {x.number}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Submitting…' : practice ? 'Finish and see summary' : 'Submit test'}
            </Button>
          </div>
        </div>
        <Link to="/progress" className="block text-xs text-zinc-500 hover:underline">
          View my progress
        </Link>
      </aside>
    </div>
  );
}

const toggle = (list: number[], p: number) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p].sort((a, b) => a - b));
