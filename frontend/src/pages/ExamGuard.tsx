/**
 * Examination monitoring for a running mock test. It watches only what a web page can really see:
 *   - the page being hidden (another tab, a minimised window),
 *   - the window losing focus,
 *   - the page leaving full-screen mode.
 * It cannot see other applications, other devices or a person helping from outside, and it says so on the instructions screen.
 * Every report goes to the server, which keeps the record and decides what happens (a warning, or the end of the attempt).
 * The question and the answers are never touched here: the warning is drawn over the test, so nothing is lost.
 */
import { AlertTriangle, Maximize } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { buttonClass } from '../ui';

type Phase = 'resume' | 'running' | 'warning' | 'ended';
type Incident = 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'RETURN_TIMEOUT';

export const INCIDENT_TEXT: Record<string, string> = {
  TAB_HIDDEN: 'you switched to another tab or window',
  WINDOW_BLUR: 'the examination window lost focus',
  FULLSCREEN_EXIT: 'you left full-screen mode',
  RETURN_TIMEOUT: 'you did not return to full-screen mode in time',
};

export const enterFullscreen = async () => {
  if (document.fullscreenElement) return true;
  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
};

export function ExamGuard({ sessionId, policy, incidentsSoFar, onEnded }: { sessionId: string; policy: { returnSeconds: number; maxIncidents: number }; incidentsSoFar: number; onEnded: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => (document.fullscreenElement ? 'running' : 'resume'));
  const [info, setInfo] = useState<{ type: Incident; at: Date; deadline: number } | null>(null);
  const [incidents, setIncidents] = useState(incidentsSoFar);
  const [reason, setReason] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [denied, setDenied] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timeoutSent = useRef(false);

  const finish = useCallback((endReason: string | null) => {
    setReason(endReason);
    setPhase('ended');
  }, []);

  const report = useCallback(
    async (type: Incident) => {
      if (phaseRef.current === 'ended' || phaseRef.current === 'resume') return;
      const at = new Date();
      try {
        const r = await api.reportViolation(sessionId, { type, at: at.toISOString() });
        setIncidents(r.incidents);
        if (r.ended) return finish(r.endReason ?? `TERMINATED_${type}`);
        if (r.action === 'MERGED' || r.action === 'IGNORED') return;
        setInfo({ type, at, deadline: Date.now() + policy.returnSeconds * 1000 });
        timeoutSent.current = false;
        setPhase('warning');
      } catch {
        // The server could not be reached: warn the student anyway. The server applies the policy as soon as a report gets through.
        setInfo((p) => p ?? { type, at, deadline: Date.now() + policy.returnSeconds * 1000 });
        setPhase('warning');
      }
    },
    [sessionId, policy.returnSeconds, finish],
  );

  // What the browser can see.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'warning') return;
    const onVisibility = () => {
      if (document.hidden) void report('TAB_HIDDEN');
    };
    const onBlur = () => {
      setTimeout(() => {
        if (!document.hidden && !document.hasFocus() && phaseRef.current !== 'ended') void report('WINDOW_BLUR');
      }, 250);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) void report('FULLSCREEN_EXIT');
      else if (phaseRef.current === 'warning') {
        setPhase('running');
        setInfo(null);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [phase, report]);

  // Entering full screen from the "resume" screen (after a refresh) starts the watch; it is not a violation.
  useEffect(() => {
    const onFullscreen = () => {
      if (document.fullscreenElement && phaseRef.current === 'resume') setPhase('running');
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  // Time allowed to come back after a warning. Checked on a clock and again when the page becomes visible, because a hidden tab's timers slow down.
  useEffect(() => {
    if (phase !== 'warning' || !info) return;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() >= info.deadline && !document.fullscreenElement && !timeoutSent.current) {
        timeoutSent.current = true;
        void report('RETURN_TIMEOUT');
      }
    };
    const t = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase, info, report]);

  // A refresh or closing the tab asks for confirmation while the test runs.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (phaseRef.current !== 'ended') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // After the attempt has been ended: show why, then go to the result.
  useEffect(() => {
    if (phase !== 'ended') return;
    const t = setTimeout(onEnded, 12000);
    return () => clearTimeout(t);
  }, [phase, onEnded]);

  const inFullscreen = !!document.fullscreenElement && !document.hidden;
  const back = async () => {
    // Back in the examination already (a tab switch that left full screen alone): just carry on. Otherwise full screen is needed first.
    if (phaseRef.current === 'warning' && inFullscreen) {
      setPhase('running');
      setInfo(null);
      return;
    }
    setDenied(!(await enterFullscreen()));
  };
  const secondsLeft = info ? Math.max(0, Math.ceil((info.deadline - now) / 1000)) : 0;
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const card = 'w-full max-w-md rounded-2xl border bg-surface p-6 shadow-2xl';
  return (
    <>
      {incidents > 0 && phase !== 'ended' && (
        <div data-exam-warnings className="fixed bottom-3 left-3 z-40 rounded-lg bg-wrong px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          Warning {Math.min(incidents, policy.maxIncidents)} of {policy.maxIncidents} recorded
        </div>
      )}
      {phase === 'resume' && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="exam-resume" data-exam-overlay="resume">
          <div className={`${card} border-rule`}>
            <div className="flex items-center gap-2 text-accent">
              <Maximize aria-hidden className="size-5" />
              <h2 id="exam-resume" className="text-lg font-semibold text-ink">
                Examination in progress
              </h2>
            </div>
            <p className="mt-2 text-sm text-ink-2">Your examination is running and the clock has not stopped. Enter full-screen mode to continue. Your answers so far are saved.</p>
            {denied && <p className="mt-2 text-sm text-wrong">The browser did not allow full screen. Allow it for this site and try again.</p>}
            <button type="button" className={`${buttonClass('primary')} mt-4 w-full justify-center`} onClick={() => void back()} data-exam-resume>
              Enter full screen and continue
            </button>
          </div>
        </div>
      )}
      {phase === 'warning' && info && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-wrong/60 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="exam-warning" data-exam-overlay="warning">
          <div className={`${card} border-wrong`}>
            <div className="flex items-center gap-2 text-wrong">
              <AlertTriangle aria-hidden className="size-6" />
              <h2 id="exam-warning" className="text-lg font-semibold">
                Warning: you left the examination environment
              </h2>
            </div>
            <p className="mt-2 text-sm text-ink">
              This was recorded at {time(info.at)}: {INCIDENT_TEXT[info.type]}. This is warning {Math.min(incidents, policy.maxIncidents)} of {policy.maxIncidents}.
            </p>
            <p className="mt-2 text-sm font-semibold text-wrong" data-exam-countdown>
              {inFullscreen ? 'You are back in the examination. Another violation will end your test automatically.' : `Return to full-screen mode within ${secondsLeft} ${secondsLeft === 1 ? 'second' : 'seconds'}, or your test will end automatically. Another violation also ends it.`}
            </p>
            <p className="mt-2 text-xs text-ink-2">Your answers are saved. Nothing has been lost.</p>
            {denied && <p className="mt-2 text-sm text-wrong">The browser did not allow full screen. Allow it for this site and try again.</p>}
            <button type="button" className={`${buttonClass('primary')} mt-4 w-full justify-center`} onClick={() => void back()} data-exam-return>
              {inFullscreen ? 'Continue examination' : 'Return to full screen'}
            </button>
          </div>
        </div>
      )}
      {phase === 'ended' && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="exam-ended" data-exam-overlay="ended">
          <div className={`${card} border-wrong`}>
            <h2 id="exam-ended" className="text-lg font-semibold text-wrong">
              Your examination has been ended
            </h2>
            <p className="mt-2 text-sm text-ink">
              Reason: {reason?.startsWith('TERMINATED_') ? INCIDENT_TEXT[reason.replace('TERMINATED_', '')] ?? 'a violation of the examination rules' : 'a violation of the examination rules'}.
            </p>
            <p className="mt-2 text-sm text-ink-2">The answers you gave up to this point were saved and scored. You can review them on the result page.</p>
            <button type="button" className={`${buttonClass('primary')} mt-4 w-full justify-center`} onClick={onEnded} data-exam-view-result>
              View my result
            </button>
          </div>
        </div>
      )}
    </>
  );
}
