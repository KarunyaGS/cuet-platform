/**
 * The celebration on My Progress for a milestone reached in the expert study plan.
 *
 * It appears once per milestone: the moment it is on screen the server marks it seen, so a reload or the next visit does not repeat it, and
 * Continue dismisses it. Only the single most meaningful milestone is ever offered. The wording comes from the server and is built from real
 * counts; this component adds no claims of its own.
 */
import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type MilestoneView } from '../../api';
import { playUiSound } from '../../sound';

export function MilestoneCelebration() {
  const [m, setM] = useState<MilestoneView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return; // React may run effects twice in development: ask once
    asked.current = true;
    api.milestones().then(async (r) => {
      if (!r.pending) return;
      setM(r.pending);
      // On screen means seen: mark it now so it cannot come back, then play its sound once (the visit itself followed the student's own click).
      await api.milestoneShown(r.pending.id).then(() => playUiSound('achievement')).catch(() => undefined);
    }).catch(() => undefined); // a celebration is never worth an error on the Progress page
  }, []);

  const close = async () => {
    if (!m || leaving) return;
    setLeaving(true);
    await api.milestoneDismiss(m.id).catch(() => undefined);
    window.setTimeout(() => setM(null), 180);
  };

  useEffect(() => {
    if (!m) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, leaving]);

  if (!m) return null;
  const pct = m.percent ?? Math.round((100 * m.done) / Math.max(1, m.total));
  const ring = 2 * Math.PI * 44;
  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-forest-deep/45 p-4 backdrop-blur-[2px] ${leaving ? 'milestone-out' : 'milestone-backdrop'}`} data-milestone-overlay>
      <div role="dialog" aria-modal="true" aria-labelledby="milestone-title" aria-describedby="milestone-text" data-milestone data-kind={m.kind}
        className={`relative w-full max-w-md overflow-hidden rounded-[24px] border border-line/80 bg-surface px-6 pb-6 pt-8 text-center shadow-[0_30px_70px_-30px_rgb(15_45_38/0.6)] ${leaving ? 'milestone-out' : 'milestone-card'}`}>
        <span aria-hidden className="milestone-glow pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(214_233_117/0.55),transparent_70%)]" />
        <div className="relative mx-auto grid size-28 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-forest/12" />
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" strokeLinecap="round" className="milestone-ring stroke-forest" strokeDasharray={ring} style={{ ['--ring-offset' as string]: ring * (1 - Math.min(100, pct) / 100) }} />
          </svg>
          <div className="relative">
            <p className="num text-[26px] leading-none font-bold tracking-[-0.04em] text-forest" data-milestone-percent>{pct}%</p>
            <p className="mt-1 text-[10px] font-medium text-ink-3">of your plan</p>
          </div>
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#f1f5df] px-3 py-1 text-[11px] font-bold tracking-[0.08em] text-forest uppercase"><Sparkles aria-hidden className="size-3.5" />Milestone reached</p>
        <h2 id="milestone-title" className="mt-3 text-xl font-bold tracking-tight text-forest" data-milestone-heading>{m.heading}</h2>
        <p id="milestone-text" className="mt-2 text-[15px] leading-relaxed text-ink" data-milestone-message>{m.message}</p>
        <p className="num mt-3 text-xs text-ink-2" data-milestone-figure>{m.figure}{m.planTotal ? ` · plan: ${m.planDone} of ${m.planTotal} activities` : ''}</p>
        <button ref={button} type="button" onClick={() => void close()} data-sound="press" data-milestone-continue
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-lime transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
          Continue<ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
