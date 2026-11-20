import { Clock3, Timer, X } from 'lucide-react';
import { useEffect } from 'react';

export function TimerChoiceDialog({ open, onClose, onChoose, busy = false, title = 'How would you like to take this test?' }: {
  open: boolean;
  onClose: () => void;
  onChoose: (timed: boolean) => void;
  busy?: boolean;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-forest/35 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }} data-timer-choice-backdrop>
      <section role="dialog" aria-modal="true" aria-labelledby="timer-choice-title" className="timer-choice-card relative my-auto w-full max-w-md overflow-hidden rounded-[24px] border border-white/70 bg-[#fbfaf3] p-5 shadow-[0_28px_80px_rgb(12_39_33/28%)] sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-[#e6f28e]/60 blur-3xl" />
        <button type="button" aria-label="Close timer choice" disabled={busy} onClick={onClose} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-forest/65 transition-colors hover:bg-forest/8 hover:text-forest disabled:opacity-40"><X aria-hidden className="size-4" /></button>
        <span className="relative grid size-11 place-items-center rounded-2xl bg-forest text-lime"><Timer aria-hidden className="size-5" /></span>
        <p className="relative mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-terracotta">Your test, your pace</p>
        <h2 id="timer-choice-title" className="relative mt-1 text-xl font-bold tracking-tight text-forest">{title}</h2>
        <p className="relative mt-1.5 text-sm text-forest/70">Choose before you begin. Your answers and marking stay the same either way.</p>
        <div className="relative mt-5 grid gap-2.5 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => onChoose(true)} className="group rounded-2xl border border-forest bg-forest p-4 text-left text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50">
            <span className="flex items-center justify-between"><Timer aria-hidden className="size-5 text-lime" /><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-lime">Exam pace</span></span>
            <span className="mt-3 block text-sm font-bold">Use timer</span>
            <span className="mt-1 block text-xs leading-relaxed text-white/70">Practise with the test’s time limit.</span>
          </button>
          <button type="button" disabled={busy} onClick={() => onChoose(false)} className="group rounded-2xl border border-[#d9e2ca] bg-white/80 p-4 text-left text-forest transition duration-200 hover:-translate-y-0.5 hover:border-[#b4c777] hover:shadow-lg disabled:opacity-50">
            <span className="flex items-center justify-between"><Clock3 aria-hidden className="size-5 text-terracotta" /><span className="rounded-full bg-[#eff3df] px-2 py-1 text-[10px] font-semibold text-forest">Self-paced</span></span>
            <span className="mt-3 block text-sm font-bold">No timer</span>
            <span className="mt-1 block text-xs leading-relaxed text-forest/65">Take the time you need on each question.</span>
          </button>
        </div>
        {busy && <p role="status" className="relative mt-3 text-center text-xs font-medium text-forest/65">Preparing your test…</p>}
      </section>
    </div>
  );
}
