import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import { Logo } from '../Layout';
import { ErrorBox, Loading, buttonClass, useLoad } from '../ui';
import { enterFullscreen } from './ExamGuard';

const RULES = [
  'The test will run in full-screen mode.',
  'Do not switch browser tabs or windows.',
  'Do not exit full-screen mode.',
  'Do not minimise the browser or open other applications over the examination.',
  'Do not use external tools, websites or other assistance during the examination.',
  'Any prohibited attempt to leave the examination environment may result in automatic termination, according to the examination rules.',
];

/**
 * The page every mock test starts from: the exam's details and rules, and the student's agreement. Nothing starts, and full screen is
 * not requested, until the rules are accepted and Start Examination is pressed.
 */
export function ExamInstructionsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') === 'MOCK_TEST' ? 'MOCK_TEST' : 'TOPIC_TEST';
  const nodeId = params.get('nodeId') ?? undefined;
  const paperId = params.get('paperId') ?? undefined;
  const info = useLoad(() => api.examPreview({ mode, nodeId, paperId }), [mode, nodeId, paperId]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setErr(null);
    // Full screen can only be requested from a click, so it is asked for here, before anything else.
    if (!(await enterFullscreen())) {
      setBusy(false);
      setErr('Your browser did not allow full-screen mode. Allow it for this site and press Start Examination again. The examination cannot begin without it.');
      return;
    }
    try {
      const s = await api.startPractice({ mode, nodeId, paperId });
      navigate(`/exam/${s.session.id}`, { replace: true });
    } catch (e) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setBusy(false);
      setErr((e as Error).message || 'The examination could not be started.');
    }
  };

  const d = info.data;
  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  return (
    <div className="min-h-dvh bg-paper" data-exam-instructions>
      <header className="border-b border-rule bg-paper px-5 py-3 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        {info.loading && !d && <Loading />}
        {info.error && <ErrorBox error={info.error} onRetry={info.reload} />}
        {d && (
          <>
            <h1 className="text-xl font-semibold text-ink sm:text-2xl" data-exam-title>
              {d.title}
            </h1>
            <p className="mt-0.5 text-sm text-ink-2">Examination instructions. Read them carefully before you begin.</p>
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-3" data-exam-facts>
              {[
                ['Exam', d.title],
                ['Subject', d.subject ?? '–'],
                ['Duration', `${d.durationMinutes} minutes`],
                ['Total questions', String(d.questions)],
                ['Maximum marks', String(d.maxMarks)],
                ['Marking scheme', `${sign(d.marking.correct)} for a correct answer, ${sign(d.marking.incorrect)} for a wrong answer, 0 if not attempted`],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-4 py-3">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="num mt-0.5 text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <section className="mt-5 rounded-xl border border-rule bg-surface p-5" aria-labelledby="exam-rules">
              <h2 id="exam-rules" className="text-base font-semibold text-ink">
                Examination rules
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink">
                {RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-2">
                Your answers are saved as you go. If you refresh the page you can continue where you were, and the clock keeps running. When the time ends the test is submitted automatically.
              </p>
            </section>

            <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-wrong/40 bg-wrong-soft p-4 text-wrong" data-exam-warning>
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p className="text-[15px] font-semibold">
                Important: Leaving the full-screen examination environment or switching tabs may result in immediate termination of your test.
              </p>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              How this is checked: the browser tells us when you switch tabs, minimise the window, leave full screen or the window loses focus, and every such event is recorded. The first one is a warning with {d.policy.returnSeconds} seconds to return to full screen;
              a second one, or not returning in time, ends the test. A browser cannot see other applications or devices, so the rules above rely on your honesty as in a real examination.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-[15px] text-ink">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-4 accent-accent" data-exam-agree />
              I have read and agree to the examination rules.
            </label>
            {err && (
              <p role="alert" className="mt-3 text-sm text-wrong" data-exam-error>
                {err}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void start()} disabled={!agreed || busy || d.questions === 0} data-exam-start className={`${buttonClass('primary')} disabled:cursor-not-allowed disabled:opacity-50`}>
                {busy ? 'Starting…' : 'Start Examination'}
              </button>
              <button type="button" onClick={() => navigate(-1)} className={buttonClass('ghost')}>
                Go back
              </button>
              {d.questions === 0 && <span className="text-sm text-ink-2">There are no questions for this test yet.</span>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
