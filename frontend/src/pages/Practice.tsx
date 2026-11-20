import { Annotatable } from '../annotate';
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Clock, Flag } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, type Feedback, type PracticeSession, type SessionQuestion } from '../api';
import { QuestionStem } from '../question';
import { Rich } from '../rich';
import { SchemeDetails, marksLine } from '../marking';
import { parseNumericAnswer } from '../numeric';
import { EnlargeButton, mediaSrc } from '../question';
import { BookmarkButton } from '../tools';
import { SaveForRevision } from '../revision';
import { Badge, Button, ErrorBox, Loading, useLoad } from '../ui';
import { ExamGuard } from './ExamGuard';
import { playUiSound, SoundToggle } from '../sound';

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

/** Answer box for a numerical question: type the value, then save it (exam) or check it (practice). */
function NumericAnswer({ question, locked, practice, onSave, onDraft }: { question: SessionQuestion; locked: boolean; practice: boolean; onSave: (value: number | null) => Promise<void>; onDraft: (text: string | null) => void }) {
  const saved = question.answer?.numericAnswer;
  const [text, setText] = useState(saved === null || saved === undefined ? '' : String(saved));
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // Tell the test screen when what is typed differs from what is saved, so leaving the question cannot silently drop it.
  const savedText = saved === null || saved === undefined ? '' : String(saved);
  useEffect(() => {
    onDraft(!practice && !locked && text.trim() !== savedText ? text : null);
    return () => onDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, savedText, practice, locked]);
  const submit = async (clear: boolean) => {
    const value = clear ? null : parseNumericAnswer(text);
    if (!clear && value === null) return setProblem('Enter a number, for example 12, -3.5 or 2e-3.');
    setProblem(null);
    setWorking(true);
    try {
      await onSave(value);
      if (clear) setText('');
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="mt-5" data-numeric-answer>
      <label htmlFor={`num-${question.id}`} className="block text-sm font-medium text-ink">
        Your answer (a number)
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={`num-${question.id}`}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={locked}
          onChange={(e) => {
            setText(e.target.value);
            setProblem(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && !locked && void submit(false)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `num-err-${question.id}` : undefined}
          className="num h-10 w-44 rounded-lg border border-rule bg-surface px-3 text-base text-ink disabled:opacity-60"
        />
        {!locked && (
          <Button kind="secondary" onClick={() => void submit(false)} disabled={working || !text.trim()}>
            {practice ? 'Check answer' : 'Save answer'}
          </Button>
        )}
        {!locked && !practice && saved !== null && saved !== undefined && (
          <Button kind="secondary" onClick={() => void submit(true)} disabled={working}>
            Clear
          </Button>
        )}
      </div>
      {problem && (
        <p id={`num-err-${question.id}`} role="alert" className="mt-1.5 text-sm text-wrong">
          {problem}
        </p>
      )}
      {!practice && saved !== null && saved !== undefined && !problem && <p className="mt-1.5 text-sm text-ink-3">Saved: {saved}</p>}
    </div>
  );
}

export function PracticePage({ exam = false }: { exam?: boolean }) {
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
  const [confirmText, setConfirmText] = useState('');
  // A typed numerical answer that is not saved yet, and the question the student tried to move to meanwhile.
  const [draft, setDraft] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<number | null>(null);
  const [showScheme, setShowScheme] = useState(false);
  useEffect(() => {
    setData(loaded.data);
    // Marks for review are kept on the server, so they come back after a reload or on another device.
    if (loaded.data) setMarked(new Set(loaded.data.session.marked));
  }, [loaded.data]);
  const left = useCountdown(data?.session.status === 'IN_PROGRESS' ? data.session.deadline : null);
  // Leave full screen when the test is over or the page closes (a full-length mock is opened full screen).
  const finished = !!data && data.session.status !== 'IN_PROGRESS';
  useEffect(() => {
    if (finished && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [finished]);
  // Leaving the test screen leaves full screen too. (Deferred a moment so a development-mode remount does not drop it.)
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setTimeout(() => {
        if (!alive.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      }, 100);
    };
  }, []);

  useEffect(() => {
    if (data && data.session.status !== 'IN_PROGRESS') navigate(`/results/${sessionId}`, { replace: true });
    // A mock test only ever runs in the examination screen; practice only ever runs in the normal one.
    else if (data && !exam && data.session.mode !== 'PRACTICE') navigate(`/exam/${sessionId}`, { replace: true });
    else if (data && exam && data.session.mode === 'PRACTICE') navigate(`/practice/${sessionId}`, { replace: true });
  }, [data, navigate, sessionId, exam]);
  useEffect(() => {
    if (left === 0 && data?.session.status === 'IN_PROGRESS') void submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  useEffect(() => {
    if (left === 300 || left === 60) playUiSound('warning');
  }, [left]);
  const qid = data?.questions[i]?.id;
  useEffect(() => {
    if (qid) setVisited((v) => (v.has(qid) ? v : new Set(v).add(qid)));
  }, [qid]);

  const practice = data?.session.mode === 'PRACTICE';
  const examining = exam && !!data && data.session.mode !== 'PRACTICE' && data.session.status === 'IN_PROGRESS';
  const choose = useCallback(
    async (question: SessionQuestion, position: number) => {
      if (practice && feedback[question.id]?.outcome) return; // locked after feedback
      playUiSound('select');
      setErr(null);
      const selected = question.type === 'MCQ_MULTI' ? toggle(question.answer?.selectedPositions ?? [], position) : [position];
      const previous = question.answer;
      setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === question.id ? { ...x, answer: { selectedPositions: selected, numericAnswer: null } } : x)) });
      if (question.type === 'MCQ_MULTI' && practice) return; // multi-select: confirm with the Check button
      try {
        const res = await api.answer(sessionId, { questionId: question.id, selectedPositions: selected });
        if (practice) {
          setFeedback((f) => ({ ...f, [question.id]: res }));
          playUiSound(res.outcome === 'CORRECT' ? 'correct' : res.outcome === 'INCORRECT' ? 'incorrect' : 'select');
        }
      } catch (e) {
        // Not saved: show the question as it really is (the server still has the earlier answer), and say so.
        setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === question.id ? { ...x, answer: previous } : x)) });
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
      if (e.key === 'ArrowRight') goTo(Math.min(data.questions.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') goTo(Math.max(0, i - 1));
      else {
        // CUET questions have four options, A to D (keys 1 to 4 or A to D).
        const k = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : /^[a-d]$/i.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
        const opt = q.options[k];
        if (opt) {
          e.preventDefault();
          void choose(q, opt.position);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i, choose, confirming, draft]);

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

  async function submit(timedOut = false) {
    setBusy(true);
    try {
      await api.submit(sessionId, timedOut);
      playUiSound('complete');
      navigate(`/results/${sessionId}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(false);
      setConfirming(false);
    }
  }
  const answered = (x: SessionQuestion) => Boolean(x.answer?.selectedPositions?.length) || (x.answer?.numericAnswer !== null && x.answer?.numericAnswer !== undefined);
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
  const toggleMark = () => {
    const next = marked.has(q.id) ? new Set([...marked].filter((x) => x !== q.id)) : new Set(marked).add(q.id);
    setMarked(next);
    api.saveMarks(sessionId, [...next]).catch((e: Error) => setErr(e));
  };
  /** Back to "not answered": matters where a wrong answer costs marks. */
  const clearResponse = async () => {
    setErr(null);
    setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === q.id ? { ...x, answer: null } : x)) });
    try {
      await api.answer(sessionId, { questionId: q.id, selectedPositions: [] });
    } catch (e) {
      setErr(e as Error);
    }
  };
  const source = data.session.source;
  const official = source?.kind === 'PAST_PAPER';
  const timeTone = left === null ? '' : left < 60 ? 'bg-wrong-soft text-wrong ring-wrong/30' : left < 300 ? 'bg-marker-soft text-marker ring-marker/30' : 'bg-surface text-ink ring-rule';
  // A practice set ends at once; a test always asks first, because a submitted test cannot be reopened (even when every question is answered).
  const startSubmit = () => {
    if (practice) return void submit();
    if (draft !== null) return void setPendingMove(-1);
    setConfirmText('');
    setConfirming(true);
  };
  /** Moves to another question. A typed numerical answer that is not saved yet is never dropped silently: the student chooses. */
  function goTo(k: number) {
    if (k === i) return;
    if (draft !== null && data) return void setPendingMove(k);
    setI(k);
  }
  const resolveDraft = async (save: boolean) => {
    const target = pendingMove;
    setPendingMove(null);
    if (save) {
      const value = parseNumericAnswer(draft ?? '');
      if (value === null) return setErr(new Error('The number you typed could not be read, so it was not saved. Fix it or clear the box.'));
      try {
        setErr(null);
        await api.answer(sessionId, { questionId: q.id, numericAnswer: value });
        setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === q.id ? { ...x, answer: { selectedPositions: null, numericAnswer: value } } : x)) });
      } catch (e) {
        return setErr(e as Error);
      }
    }
    setDraft(null);
    if (target === -1) { setConfirmText(''); setConfirming(true); }
    else if (target !== null) setI(target);
  };

  return (
    <div className={exam ? 'mx-auto min-h-dvh w-full max-w-none px-3 pb-6 sm:px-5 lg:px-8' : undefined} data-exam-screen={exam ? '' : undefined}>
      {examining && data.session.exam && (
        <ExamGuard sessionId={sessionId} policy={data.session.exam} incidentsSoFar={data.session.exam.incidents} onEnded={() => navigate(`/results/${sessionId}`, { replace: true })} />
      )}
      {/* Test bar */}
      <div className={`sticky ${exam ? 'top-0 -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8' : 'top-14 -mx-4 px-4 sm:-mx-6 sm:px-6'} z-20 mb-4 border-b border-rule bg-paper py-2.5`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              {source?.title ?? MODE[data.session.mode]}
              <Badge tone={official ? 'accent' : exam ? 'amber' : 'green'}>{official ? 'Official previous-year paper' : exam ? 'Examination in progress' : 'Practice questions'}</Badge>
            </div>
            <div className="num text-xs text-ink-3">
              {total} questions · {marksLine({ ...data.session.marking, unattempted: 0 })}
              <button type="button" onClick={() => setShowScheme((v) => !v)} aria-expanded={showScheme} className="ml-2 underline underline-offset-2 hover:text-ink" data-scheme-toggle>
                {showScheme ? 'Hide marking scheme' : 'Marking scheme'}
              </button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="num hidden text-sm text-ink-2 sm:inline">
              {answeredCount} of {total} answered
            </span>
            <SoundToggle compact />
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
        {showScheme && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-rule bg-surface p-3" data-scheme-panel>
            <SchemeDetails scheme={data.session.scheme} compact />
          </div>
        )}
        {left !== null && (left === 300 || left === 60) && (
          <span className="sr-only" aria-live="assertive">
            {left === 60 ? 'One minute left' : 'Five minutes left'}
          </span>
        )}
      </div>

      {!practice && answeredCount === total && (
        <section aria-labelledby="all-answered-title" className="test-complete-callout mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-correct/30 bg-correct-soft p-4 sm:p-5" data-all-answered>
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-correct shadow-sm"><CircleCheck className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="all-answered-title" className="text-base font-bold text-ink sm:text-lg">All questions answered</h2>
            <p className="mt-0.5 text-sm text-ink-2">Your answers are saved. Review them if you like, then finish from the button above or here.</p>
          </div>
          <Button onClick={startSubmit} disabled={busy} data-finish-completed-test>Review and submit</Button>
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem] xl:gap-4">
        <section key={q.id} data-question-card className="min-w-0 overflow-hidden rounded-xl border border-rule bg-surface lg:flex lg:min-h-[min(70dvh,43rem)] lg:flex-col" aria-label={`Question ${q.number} of ${total}`}>
          <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
            <span className="num text-sm font-semibold text-ink">
              Question {q.number} <span className="font-normal text-ink-3">of {total}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge>{q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}</Badge>
              {q.type === 'MCQ_MULTI' && <Badge tone="accent">More than one answer</Badge>}
              {!exam && <BookmarkButton kind="QUESTION" id={q.id} compact />}
            </span>
          </div>
          <Annotatable key={q.id} kind="QUESTION" id={q.id} className="px-4 py-3.5 sm:px-5 lg:flex lg:flex-1 lg:flex-col" off={exam}>
            {q.passage && (
              <div className="mb-3 max-h-64 overflow-y-auto rounded-lg border border-rule bg-paper p-3 font-serif text-[14px] leading-relaxed text-ink">
                {q.passage.title && <div className="mb-1 font-sans font-semibold">{q.passage.title}</div>}
                {q.passage.body}
              </div>
            )}
            <div data-annot-block="stem">
              <QuestionStem stem={q.stem} structure={q.structure} />
            </div>
            <ul className="mt-4 space-y-2 lg:flex lg:flex-1 lg:flex-col lg:justify-evenly" role={q.type === 'MCQ_MULTI' ? 'group' : 'radiogroup'} aria-label="Options">
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
                  <li key={o.position} data-question-option className="relative">
                    <button
                      role={q.type === 'MCQ_MULTI' ? 'checkbox' : 'radio'}
                      aria-checked={chosen}
                      onClick={() => void choose(q, o.position)}
                      className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[14px] text-ink transition-colors ${state}`}
                    >
                      <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold ${dot}`}>
                        {o.label}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5" data-annot-block={`opt-${o.position}`}>
                        {o.mediaAssetId ? (
                          <>
                            <span className="sr-only">{o.text}</span>
                            <img src={mediaSrc(o.mediaAssetId)} alt={o.alt || o.text} loading="lazy" className="max-h-44 w-auto max-w-full rounded border border-rule bg-white p-1" />
                          </>
                        ) : (
                          <Rich text={o.text} inline className="min-w-0" />
                        )}
                      </span>
                      {showResult && right && <CircleCheck aria-label="Correct answer" className="mt-1 size-5 shrink-0 text-correct" />}
                      {showResult && chosen && !right && <CircleX aria-label="Your answer" className="mt-1 size-5 shrink-0 text-wrong" />}
                      {!showResult && <span className="sr-only">Press {String.fromCharCode(65 + k)}</span>}
                    </button>
                    {o.mediaAssetId && (
                      <span className="absolute right-2 bottom-2">
                        <EnlargeButton id={o.mediaAssetId} alt={o.alt || o.text} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {q.type === 'NUMERICAL' && (
              <NumericAnswer
                key={q.id}
                question={q}
                onDraft={setDraft}
                practice={practice}
                locked={practice && Boolean(fb?.outcome)}
                onSave={async (value) => {
                  try {
                    setErr(null);
                    const res = await api.answer(sessionId, { questionId: q.id, numericAnswer: value });
                    setData((d) => d && { ...d, questions: d.questions.map((x) => (x.id === q.id ? { ...x, answer: { selectedPositions: null, numericAnswer: value } } : x)) });
                    if (practice && res.outcome) {
                      setFeedback((f) => ({ ...f, [q.id]: res }));
                      playUiSound(res.outcome === 'CORRECT' ? 'correct' : res.outcome === 'INCORRECT' ? 'incorrect' : 'select');
                    }
                  } catch (e) {
                    setErr(e as Error);
                  }
                }}
              />
            )}
            {practice && q.type === 'MCQ_MULTI' && !fb?.outcome && (
              <div className="mt-4">
                <Button
                  kind="secondary"
                  onClick={async () => {
                    try {
                      const res = await api.answer(sessionId, { questionId: q.id, selectedPositions: q.answer?.selectedPositions ?? [] });
                      setFeedback({ ...feedback, [q.id]: res });
                      playUiSound(res.outcome === 'CORRECT' ? 'correct' : res.outcome === 'INCORRECT' ? 'incorrect' : 'select');
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
              <div aria-live="polite" className={`mt-4 overflow-hidden rounded-2xl border shadow-[0_8px_20px_-18px_rgba(24,68,59,0.25)] ${fb.outcome === 'CORRECT' ? 'border-[#c8dfd1] bg-[#f1f7f1]' : 'border-[#e8c9b8] bg-[#fcf5ee]'}`}>
                <div className={`flex flex-wrap items-center gap-2.5 px-4 py-3 ${fb.outcome === 'CORRECT' ? 'bg-[#e7f1e8]' : 'bg-[#f6e7dc]'}`}>
                  <span className={`grid size-8 place-items-center rounded-full ${fb.outcome === 'CORRECT' ? 'bg-white text-correct' : 'bg-white text-terracotta'}`}>
                    {fb.outcome === 'CORRECT' ? <CircleCheck aria-hidden className="size-[18px]" /> : <CircleX aria-hidden className="size-[18px]" />}
                  </span>
                  <span className={`font-semibold ${fb.outcome === 'CORRECT' ? 'text-forest' : 'text-[#994631]'}`}>{fb.outcome === 'CORRECT' ? 'Correct answer' : fb.outcome === 'INCORRECT' ? 'Not quite' : 'Skipped'}</span>
                  <span className={`num rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold ${fb.outcome === 'CORRECT' ? 'text-correct' : 'text-[#994631]'}`}>{fb.score! > 0 ? '+' : ''}{fb.score} marks</span>
                  <span className="ml-auto hidden text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3 sm:inline">{fb.outcome === 'CORRECT' ? 'Well done' : 'Review the key idea'}</span>
                </div>
                {(fb.explanation || (q.type === 'NUMERICAL' && fb.correctNumericAnswer !== null && fb.correctNumericAnswer !== undefined)) && <div className="px-4 py-3.5 sm:px-5">
                  {q.type === 'NUMERICAL' && fb.correctNumericAnswer !== null && fb.correctNumericAnswer !== undefined && <p className="num mb-2 text-[13px] font-semibold text-forest">Correct answer: {fb.correctNumericAnswer}</p>}
                  {fb.explanation && <div data-annot-block="explanation" className="border-l-2 border-terracotta/50 pl-3"><p className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-3">Explanation</p><Rich text={fb.explanation} className="text-[14px] leading-relaxed text-ink" /></div>}
                </div>}
                {fb.outcome !== 'UNATTEMPTED' && <div className="border-t border-forest/10 px-4 py-2.5"><SaveForRevision questionId={q.id} compact /></div>}
              </div>
            )}
            {err && <ErrorBox error={err} />}
          </Annotatable>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2.5">
            <Button kind="ghost" onClick={() => goTo(Math.max(0, i - 1))} disabled={i === 0} icon={<ChevronLeft aria-hidden />}>
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {!practice && answered(q) && (
                <Button kind="ghost" onClick={() => void clearResponse()}>
                  Clear response
                </Button>
              )}
              {!practice && (
                <Button kind={marked.has(q.id) ? 'secondary' : 'ghost'} onClick={toggleMark} icon={<Flag aria-hidden className={marked.has(q.id) ? 'text-marker' : ''} />}>
                  {marked.has(q.id) ? 'Marked for review' : 'Mark for review'}
                </Button>
              )}
              {!practice && answeredCount === total ? (
                <Button kind="secondary" onClick={startSubmit} disabled={busy} data-review-and-submit>
                  Review and submit
                </Button>
              ) : i === total - 1 && !practice ? (
                <Button kind="secondary" onClick={startSubmit} disabled={busy} data-review-and-submit>
                  Review and submit
                </Button>
              ) : (
                <Button kind="secondary" onClick={() => goTo(Math.min(total - 1, i + 1))} disabled={i === total - 1}>
                  Next
                  <ChevronRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
          {pendingMove !== null && (
            <div role="alertdialog" aria-labelledby="draft-title" className="border-t border-marker/40 bg-marker-soft px-4 py-3 text-sm text-ink" data-unsaved-answer>
              <p id="draft-title" className="font-semibold">You typed an answer that is not saved yet.</p>
              <p className="mt-0.5 text-ink-2">Moving away without saving would lose it.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => void resolveDraft(true)}>{pendingMove === -1 ? 'Save and review' : 'Save and continue'}</Button>
                <Button kind="ghost" onClick={() => void resolveDraft(false)}>Discard it</Button>
                <Button kind="ghost" onClick={() => setPendingMove(null)}>Stay on this question</Button>
              </div>
            </div>
          )}
          {!practice && (
            <p className="border-t border-rule px-4 py-2 text-xs text-ink-3" data-nav-guidance>
              {q.type === 'NUMERICAL' ? 'A typed number is saved with Save answer.' : 'Choosing an option saves it straight away.'} Previous and the question palette let you review answers. {answeredCount === total ? 'All questions are answered: use Review and submit to finish.' : i === total - 1 ? 'This is the last question: Review and submit checks your answers before the test ends.' : 'You can come back to any question from the palette.'}
            </p>
          )}
        </section>

        <aside className={`lg:sticky ${exam ? 'lg:top-24' : 'lg:top-36'} lg:self-start`} aria-label="Question palette">
          <div className="rounded-xl border border-rule bg-surface p-3.5">
            <h2 className="text-sm font-semibold text-ink">Questions</h2>
            <div className="mt-2.5 grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-6">
              {data.questions.map((x, k) => {
                const c = cellOf(x);
                return (
                  <button
                    key={x.id}
                    onClick={() => goTo(k)}
                    aria-label={`Question ${x.number}, ${CELL[c].label.toLowerCase()}`}
                    aria-current={k === i ? 'true' : undefined}
                    className={`num h-8 rounded-lg text-[12px] font-semibold transition-shadow ${CELL[c].cls} ${k === i ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                  >
                    {x.number}
                    {(c === 'marked' || c === 'answered-marked') && <span aria-hidden className="ml-0.5 align-super text-[8px]">⚑</span>}
                    {c === 'answered' && <span aria-hidden className="ml-0.5 align-super text-[8px]">✓</span>}
                  </button>
                );
              })}
            </div>
            <ul className="mt-3 space-y-1 border-t border-rule pt-2.5 text-[12px]">
              {legend.map((k) => (
                <li key={k} className="flex items-center gap-2 text-ink-2">
                  <span aria-hidden className={`size-4 rounded ${CELL[k].cls}`} />
                  <span className="flex-1">{CELL[k].label}</span>
                  <span className="num font-medium text-ink">{counts[k] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 hidden text-xs text-ink-3 lg:block">Keys: A–D choose an option, ← → move between questions.</p>
            {!practice && <p className="mt-2 text-xs text-ink-3">✓ answered · ⚑ marked for review</p>}
          </div>
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-lg rounded-2xl border border-correct/30 bg-surface p-5 shadow-2xl sm:p-7">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-correct-soft text-correct"><CircleCheck className="size-6" /></span>
              <div>
                <h2 id="confirm-title" className="text-xl font-bold text-ink sm:text-2xl">Submit this test?</h2>
                <p className="mt-1 text-sm text-ink-2">{answeredCount === total ? 'All questions are answered. ' : ''}You cannot change answers after submitting.</p>
              </div>
            </div>
            <p className="mt-1 text-sm text-ink-2">{answeredCount === total ? 'All questions are answered. ' : ''}You cannot change answers after submitting.</p>
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
              {data.questions.some((x) => marked.has(x.id) && !answered(x)) && (
                <p className="text-xs text-ink-2">{data.questions.filter((x) => marked.has(x.id) && !answered(x)).length} of the marked questions are still unanswered.</p>
              )}
              <p className="pt-1 text-xs text-ink-3">{marksLine({ ...data.session.marking, unattempted: 0 })}. Unanswered questions cost nothing.</p>
            </dl>
            <label htmlFor="confirm-submit-text" className="mt-5 block text-sm font-semibold text-ink">Type <span className="rounded bg-paper px-1.5 py-0.5 font-mono tracking-wider">SUBMIT</span> to see your result</label>
            <input id="confirm-submit-text" autoFocus autoComplete="off" spellCheck={false} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmText.trim().toUpperCase() === 'SUBMIT' && !busy && void submit()} aria-describedby="confirm-submit-hint" className="mt-2 h-12 w-full rounded-xl border border-rule-strong bg-paper px-3 font-mono text-lg tracking-[0.15em] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            <p id="confirm-submit-hint" className="mt-1 text-xs text-ink-3">This extra confirmation prevents an accidental submission.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button kind="ghost" onClick={() => { setConfirming(false); setConfirmText(''); }} disabled={busy}>
                Keep answering
              </Button>
              <Button onClick={() => void submit()} disabled={busy || confirmText.trim().toUpperCase() !== 'SUBMIT'}>
                {busy ? 'Submitting…' : 'Submit test and view result'}
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
