import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The one place sound is made. Components name an event (`playUiSound('complete')`) or mark an element (`data-sound="nav"`); this file decides
 * how it sounds, whether it may play, and that two sounds never overlap.
 *
 * Rules, all enforced here and nowhere else:
 *  - Sound follows a deliberate activation (a click, Enter or Space on a control, an arrow key on a stepper). There is no hover, focus, scroll,
 *    page-load or timer sound. Results that arrive a moment after a click (a saved message) count; ones that appear on their own do not.
 *  - The examination screen is silent.
 *  - Muted means silent, and the choice is kept in this browser.
 *  - One voice at a time: a new sound cuts the previous one off (with a very short fade), and clicks closer than 45 ms apart are ignored.
 *  - If the browser has not allowed audio yet (no click so far), the sound is skipped, never queued for later.
 *
 * The palette is generated with Web Audio (no audio files), quiet, sine/triangle only, and each sound has its own shape:
 *   nav         a soft rising glide             sidebar, tab bar and top navigation: moving between major sections
 *   press       one short, slightly crisper tap ordinary buttons and primary actions
 *   open        a light, higher glide           cards, links to a lesson or topic, expanding a section ("close" is the same, falling)
 *   add         two quick notes                 adding a study activity
 *   move        a short sideways glide          moving or rescheduling a task
 *   complete    a clear two-note rise           completing a task
 *   success     three rising notes              an action that worked
 *   generate    a four-note rising arpeggio     a study plan being built
 *   achievement a warm, longer arpeggio         a newly earned milestone (once per milestone)
 * Older cues used by practice and support (select, correct, incorrect, warning, toggles, step, notification, progress) are kept.
 */
const STORAGE_KEY = 'prepora.ui-sounds';
const CHANGE_EVENT = 'prepora-ui-sound-change';
export type SoundKind =
  | 'nav' | 'press' | 'open' | 'close' | 'add' | 'move' | 'complete' | 'success' | 'generate' | 'achievement'
  | 'tap' | 'select' | 'correct' | 'incorrect' | 'warning' | 'toggle-on' | 'toggle-off' | 'notification' | 'progress-start' | 'progress-tick' | 'progress-complete' | 'step';
interface Cue { notes: number[]; duration: number; volume: number; wave: OscillatorType; spacing: number; glideTo?: number }

let context: AudioContext | null = null;
let output: GainNode | null = null;
let memoryEnabled: boolean | null = null;
let clickSoundHandled = false;
let lastGestureAt = 0;
let lastStartAt = 0;
let voice: { gain: GainNode; oscillators: OscillatorNode[]; endsAt: number } | null = null;

const CUES: Record<SoundKind, Cue> = {
  nav: { notes: [330], glideTo: 494, duration: 0.085, volume: 0.0085, wave: 'sine', spacing: 0 },
  press: { notes: [520], duration: 0.03, volume: 0.0065, wave: 'triangle', spacing: 0 },
  open: { notes: [740], glideTo: 880, duration: 0.05, volume: 0.0045, wave: 'sine', spacing: 0 },
  close: { notes: [880], glideTo: 700, duration: 0.045, volume: 0.004, wave: 'sine', spacing: 0 },
  add: { notes: [587, 784], duration: 0.055, volume: 0.0075, wave: 'sine', spacing: 0.045 },
  move: { notes: [440], glideTo: 560, duration: 0.06, volume: 0.0065, wave: 'triangle', spacing: 0 },
  complete: { notes: [587, 880], duration: 0.1, volume: 0.011, wave: 'sine', spacing: 0.065 },
  success: { notes: [523, 659, 784], duration: 0.1, volume: 0.01, wave: 'sine', spacing: 0.055 },
  generate: { notes: [392, 494, 587, 784], duration: 0.12, volume: 0.009, wave: 'triangle', spacing: 0.07 },
  achievement: { notes: [523, 659, 784, 1047], duration: 0.38, volume: 0.011, wave: 'sine', spacing: 0.09 },
  tap: { notes: [520], duration: 0.03, volume: 0.0065, wave: 'triangle', spacing: 0 },
  select: { notes: [590], duration: 0.034, volume: 0.007, wave: 'sine', spacing: 0 },
  correct: { notes: [523, 659], duration: 0.075, volume: 0.011, wave: 'sine', spacing: 0.045 },
  incorrect: { notes: [330, 294], duration: 0.07, volume: 0.008, wave: 'sine', spacing: 0.05 },
  warning: { notes: [440, 392], duration: 0.065, volume: 0.007, wave: 'sine', spacing: 0.075 },
  'toggle-on': { notes: [523, 740], duration: 0.045, volume: 0.008, wave: 'sine', spacing: 0.035 },
  'toggle-off': { notes: [740, 523], duration: 0.045, volume: 0.007, wave: 'sine', spacing: 0.035 },
  notification: { notes: [659, 784], duration: 0.08, volume: 0.008, wave: 'sine', spacing: 0.07 },
  'progress-start': { notes: [392, 494], duration: 0.045, volume: 0.006, wave: 'sine', spacing: 0.04 },
  'progress-tick': { notes: [659], duration: 0.018, volume: 0.0025, wave: 'sine', spacing: 0 },
  'progress-complete': { notes: [523, 659, 784], duration: 0.095, volume: 0.01, wave: 'sine', spacing: 0.05 },
  step: { notes: [520], duration: 0.03, volume: 0.006, wave: 'sine', spacing: 0 },
};

const NAV_ZONES = 'nav[aria-label="Workspace"], nav[aria-label="Subjects"], nav[aria-label="Main"], [data-sound-zone="nav"]';
const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary';

/** Which sound a deliberate click on this element should make, or null for none. Pure: reads only the element and its ancestors. */
export function soundForElement(target: Element | null): SoundKind | null {
  if (!target || target.closest('[data-no-sound], [data-exam-screen]')) return null;
  const marked = target.closest<HTMLElement>('[data-sound]');
  if (marked) return marked.dataset.sound === 'none' ? null : (marked.dataset.sound as SoundKind);
  if (target.closest('[data-ui-sound-stepper]')) return 'step';
  const control = target.closest<HTMLElement>(CONTROL);
  if (!control || isDisabled(control)) return null;
  if (control.closest(NAV_ZONES) && control.matches('a[href]')) return 'nav';
  if (control.closest('summary, [aria-expanded]')) return null; // decided after the click, once the new state is known
  if (control.matches('a[href]')) return 'open';
  if (control.matches('input[type="checkbox"], input[type="radio"], select')) return null;
  return 'press';
}

/** Adds the deliberate-click sounds. Nothing listens for hover, focus, scroll or load. */
export function installGlobalUiSounds() {
  if (typeof document === 'undefined' || (window as unknown as { __uiSoundsInstalled?: boolean }).__uiSoundsInstalled) return;
  (window as unknown as { __uiSoundsInstalled?: boolean }).__uiSoundsInstalled = true;

  // Browsers only allow audio after a real gesture: wake the audio engine on the first one.
  const unlock = () => {
    lastGestureAt = performance.now();
    if (!enabledFromStorage()) return;
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', () => { lastGestureAt = performance.now(); }, { capture: true });

  // `click` is also what Enter and Space on a button or link produce, so keyboard activation is covered here, once.
  document.addEventListener('click', (event) => {
    clickSoundHandled = false;
    const target = event.target as Element | null;
    lastGestureAt = performance.now();
    // After the click's own effects (a section opening, a state change) have happened, so the sound matches what the click did.
    const kind = soundForElement(target); // decided now: the control may disable itself or disappear as a result of the click
    window.setTimeout(() => {
      if (clickSoundHandled || !target) return;
      if (kind) return playUiSound(kind);
      if (target.closest('[data-no-sound], [data-exam-screen]')) return;
      const toggle = target.closest<HTMLElement>('summary, [aria-expanded]');
      if (toggle && !isDisabled(toggle)) {
        const open = toggle.tagName === 'SUMMARY' ? Boolean(toggle.closest('details')?.open) : toggle.getAttribute('aria-expanded') === 'true';
        playUiSound(open ? 'open' : 'close');
      }
    }, 0);
  }, true);

  // Native controls give state-aware feedback. Text entry and range sliders stay silent.
  document.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!input || input.closest('[data-no-sound], [data-exam-screen]')) return;
    queueMicrotask(() => {
      if (clickSoundHandled) return;
      const marked = input.closest<HTMLElement>('[data-sound]');
      if (marked) return playUiSound((marked.dataset.sound as SoundKind) ?? 'press');
      if (input instanceof HTMLInputElement && input.type === 'checkbox') playUiSound(input.checked ? 'toggle-on' : 'toggle-off');
      else if (input instanceof HTMLInputElement && input.type === 'radio' && input.checked) playUiSound('select');
      else if (input instanceof HTMLSelectElement) playUiSound('select');
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.matches('[data-ui-sound-stepper]')) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') playUiSound('step');
  }, true);

  // Messages and progress marked for sound: only when they appear because of something the student just did (within 2.5 s of a click or key).
  const recent = () => performance.now() - lastGestureAt < 2500;
  const observed = new WeakMap<Element, string>();
  const progressState = new WeakMap<Element, string>();
  const playNotice = (el: Element) => {
    const kind = el.getAttribute('data-ui-sound-notification');
    const signature = `${kind}:${el.textContent ?? ''}`;
    if (observed.get(el) === signature) return;
    observed.set(el, signature);
    if (!recent()) return;
    if (kind === 'success' || kind === 'info') playUiSound('notification');
    else if (kind === 'warning' || kind === 'error') playUiSound('warning');
  };
  const inspect = (node: Node) => {
    const el = node instanceof Element ? node : node.parentElement;
    if (!el) return;
    const notice = el.matches('[data-ui-sound-notification]') ? el : el.closest('[data-ui-sound-notification]');
    if (notice) playNotice(notice);
    if (node instanceof Element) node.querySelectorAll('[data-ui-sound-notification]').forEach(playNotice);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(inspect);
      else if (record.type === 'characterData') inspect(record.target);
      else if (record.type === 'attributes' && record.target instanceof Element) {
        const el = record.target;
        if (el.matches('[data-ui-sound-notification]')) playNotice(el);
        if (el.matches('[data-ui-sound-progress]')) {
          const state = el.getAttribute('data-ui-sound-progress');
          if (progressState.get(el) === state) continue;
          progressState.set(el, state ?? '');
          if (!recent()) continue;
          if (state === 'start') playUiSound('progress-start');
          else if (state === 'complete') playUiSound('progress-complete');
          else if (state === 'tick') playUiSound('progress-tick');
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-ui-sound-notification', 'data-ui-sound-progress'] });
}

function isDisabled(el: HTMLElement) {
  return (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';
}

function enabledFromStorage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? (memoryEnabled ?? true) : saved !== 'off';
  } catch {
    return memoryEnabled ?? true;
  }
}

function getContext() {
  try {
    if (typeof window === 'undefined' || !window.AudioContext) return null;
    context ??= new window.AudioContext();
    if (!output) {
      output = context.createGain();
      output.gain.value = 0.58;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 12;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.12;
      output.connect(limiter);
      limiter.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch {
    return null;
  }
}

/** True on the examination screen, which is always silent. */
const inExam = () => typeof document !== 'undefined' && !!document.querySelector('[data-exam-screen]');

/** Plays one named sound, if sound is on, the page may make sound, and the previous sound can give way. */
export function playUiSound(kind: SoundKind, options: { pitch?: number } = {}) {
  clickSoundHandled = true;
  if (typeof window === 'undefined') return;
  const trace = (window as unknown as { __uiSoundTrace?: string[] }).__uiSoundTrace;
  if (!enabledFromStorage() || inExam()) return;
  const ctx = getContext();
  if (!ctx || !output) return;
  const nowMs = performance.now();
  if (nowMs - lastStartAt < 45) return; // rapid clicks: one sound, not a pile of them
  lastStartAt = nowMs;
  const cue = CUES[kind];
  const semitone = (hz: number) => hz * 2 ** (Math.max(-7, Math.min(7, options.pitch ?? 0)) / 12);
  const play = () => {
    // One voice: fade the previous sound out over a few milliseconds so nothing overlaps or clicks.
    if (voice && voice.endsAt > ctx.currentTime) {
      voice.gain.gain.cancelScheduledValues(ctx.currentTime);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, ctx.currentTime);
      voice.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.012);
      for (const o of voice.oscillators) {
        try { o.stop(ctx.currentTime + 0.02); } catch { /* already stopped */ }
      }
    }
    const start = ctx.currentTime + 0.003;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(output!);
    const oscillators: OscillatorNode[] = [];
    cue.notes.forEach((frequency, n) => {
      const at = start + n * cue.spacing;
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, at);
      osc.type = cue.wave;
      osc.frequency.setValueAtTime(kind === 'step' ? semitone(frequency) : frequency, at);
      if (cue.glideTo) osc.frequency.exponentialRampToValueAtTime(cue.glideTo, at + cue.duration);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(cue.volume, at + Math.min(0.012, cue.duration * 0.3));
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + cue.duration);
      osc.connect(filter);
      filter.connect(envelope);
      envelope.connect(bus);
      osc.start(at);
      osc.stop(at + cue.duration + 0.006);
      oscillators.push(osc);
    });
    voice = { gain: bus, oscillators, endsAt: start + (cue.notes.length - 1) * cue.spacing + cue.duration + 0.01 };
    trace?.push(kind);
  };
  // Audio not yet allowed by the browser (no click so far): try to wake it; if it will not wake, stay silent rather than playing late.
  if (ctx.state === 'running') play();
  else void ctx.resume().then(() => { if (ctx.state === 'running') play(); }).catch(() => undefined);
}

export function setUiSoundsEnabled(enabled: boolean) {
  memoryEnabled = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Keep the current page usable when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useUiSounds() {
  const [enabled, setEnabled] = useState(enabledFromStorage);
  useEffect(() => {
    const refresh = () => setEnabled(enabledFromStorage());
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
  }, []);
  return enabled;
}

export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const enabled = useUiSounds();
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      role={compact ? undefined : 'switch'}
      aria-label={enabled ? 'Turn sound effects off' : 'Turn sound effects on'}
      aria-checked={compact ? undefined : enabled}
      aria-pressed={compact ? enabled : undefined}
      title={enabled ? 'Sound effects on' : 'Sound effects off'}
      onClick={() => {
        setUiSoundsEnabled(!enabled);
        if (!enabled) playUiSound('toggle-on');
      }}
      data-no-sound
      className={compact ? 'inline-flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-paper' : `inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${enabled ? 'border-forest/15 bg-[#eef3d8] text-forest hover:bg-[#e5edc7]' : 'border-rule bg-paper text-ink-2 hover:bg-[#f0eee5]'}`}
    >
      <Icon aria-hidden className={compact ? 'size-4' : undefined} />
      {!compact && (enabled ? 'Sound effects on' : 'Sound effects off')}
    </button>
  );
}
