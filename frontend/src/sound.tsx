import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prepora.ui-sounds';
const CHANGE_EVENT = 'prepora-ui-sound-change';
type SoundKind = 'tap' | 'hover' | 'select' | 'correct' | 'incorrect' | 'complete' | 'warning' | 'toggle' | 'toggle-on' | 'toggle-off' | 'notification' | 'progress-start' | 'progress-tick' | 'progress-complete' | 'step';
let context: AudioContext | null = null;
let output: GainNode | null = null;
let memoryEnabled: boolean | null = null;
let clickSoundHandled = false;
let lastHoverAt = 0;
const lastCueAt = new Map<SoundKind, number>();

/** Adds restrained, semantic UI sounds. Hover is deliberately quieter than an action cue. */
export function installGlobalUiSounds() {
  if (typeof document === 'undefined' || (window as unknown as { __uiSoundsInstalled?: boolean }).__uiSoundsInstalled) return;
  (window as unknown as { __uiSoundsInstalled?: boolean }).__uiSoundsInstalled = true;

  // Audio contexts are unlocked only after a real user gesture, per browser autoplay rules.
  const unlock = () => {
    if (!enabledFromStorage()) return;
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
  };
  document.addEventListener('pointerdown', unlock, { capture: true, once: true });
  document.addEventListener('keydown', unlock, { capture: true, once: true });

  document.addEventListener('click', (event) => {
    clickSoundHandled = false;
    const target = event.target as Element | null;
    queueMicrotask(() => {
      if (clickSoundHandled || !target || target.closest('[data-no-sound]')) return;
      const stepper = target.closest<HTMLElement>('[data-ui-sound-stepper]');
      if (stepper) {
        const direction = stepper.dataset.uiSoundStepper;
        playUiSound('step', { pitch: direction === 'down' ? -2 : 2 });
        return;
      }
      const toggle = target.closest('[data-ui-sound-toggle], summary, [aria-expanded], [aria-pressed]') as HTMLElement | null;
      if (toggle) {
        const state = toggle.getAttribute('data-ui-sound-toggle') ?? (toggle.tagName === 'SUMMARY' ? String(Boolean(toggle.closest('details')?.open)) : toggle.getAttribute('aria-expanded') ?? toggle.getAttribute('aria-pressed'));
        playUiSound(state === 'false' ? 'toggle-off' : 'toggle-on');
        return;
      }
      const control = target.closest<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="menuitem"], input[type="checkbox"], input[type="radio"], select');
      if (!control || isDisabled(control) || control.matches('input[type="checkbox"], input[type="radio"], select')) return;
      playUiSound('tap');
    });
  }, true);

  // Native controls get state-aware feedback. Text entry and range sliders are intentionally silent.
  document.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!input || input.closest('[data-no-sound]')) return;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') playUiSound(input.checked ? 'toggle-on' : 'toggle-off');
    else if (input instanceof HTMLInputElement && input.type === 'radio' && input.checked) playUiSound('select');
    else if (input instanceof HTMLSelectElement) playUiSound('select');
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const target = event.target as Element | null;
    const toggle = target?.closest<HTMLElement>('[data-ui-sound-toggle]');
    if (toggle && (event.key === 'Enter' || event.key === ' ')) {
      playUiSound(toggle.dataset.uiSoundToggle === 'false' ? 'toggle-off' : 'toggle-on');
      return;
    }
    const input = target instanceof HTMLInputElement ? target : null;
    if (!input?.matches('[data-ui-sound-stepper]')) return;
    if (event.key === 'ArrowUp') playUiSound('step', { pitch: 2 });
    else if (event.key === 'ArrowDown') playUiSound('step', { pitch: -2 });
  }, true);

  // One quiet tick on entering a useful control, including keyboard focus. Do not tick while moving among its children.
  const hover = (event: Event) => {
    const target = event.target as Element | null;
    if (!target || target.closest('[data-no-sound], canvas')) return;
    const control = target.closest<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, input[type="checkbox"], input[type="radio"], select');
    if (!control || isDisabled(control) || (event instanceof PointerEvent && control.contains(event.relatedTarget as Node | null))) return;
    const now = performance.now();
    if (now - lastHoverAt < 95) return;
    lastHoverAt = now;
    playUiSound('hover');
  };
  document.addEventListener('pointerover', hover, true);
  document.addEventListener('focusin', hover, true);

  // Only explicitly marked messages and live progress get async cues; ordinary loading/status text stays silent.
  const observed = new WeakMap<Element, string>();
  const progressState = new WeakMap<Element, string>();
  const playNotice = (el: Element) => {
    const kind = el.getAttribute('data-ui-sound-notification');
    const signature = `${kind}:${el.textContent ?? ''}`;
    if (observed.get(el) === signature) return;
    observed.set(el, signature);
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

/** Small original Web Audio cues, inspired by current UI sound design patterns rather than copied audio assets. */
export function playUiSound(kind: SoundKind, options: { pitch?: number } = {}) {
  if (kind !== 'hover') clickSoundHandled = true;
  if (typeof window === 'undefined' || !enabledFromStorage()) return;
  const ctx = getContext();
  if (!ctx || !output) return;
  const nowMs = performance.now();
  const minGap = kind === 'hover' || kind === 'progress-tick' ? 85 : 32;
  if (nowMs - (lastCueAt.get(kind) ?? 0) < minGap) return;
  lastCueAt.set(kind, nowMs);

  const start = ctx.currentTime + 0.003;
  const pitchShift = Math.max(-7, Math.min(7, options.pitch ?? 0));
  const semitone = (hz: number) => hz * 2 ** (pitchShift / 12);
  const cues: Record<SoundKind, { notes: number[]; duration: number; volume: number; wave: OscillatorType; spacing: number }> = {
    tap: { notes: [620], duration: 0.026, volume: 0.006, wave: 'sine', spacing: 0 },
    hover: { notes: [930], duration: 0.014, volume: 0.0022, wave: 'sine', spacing: 0 },
    select: { notes: [590], duration: 0.034, volume: 0.007, wave: 'sine', spacing: 0 },
    correct: { notes: [523, 659], duration: 0.075, volume: 0.011, wave: 'sine', spacing: 0.045 },
    incorrect: { notes: [330, 294], duration: 0.07, volume: 0.008, wave: 'sine', spacing: 0.05 },
    complete: { notes: [523, 659, 784], duration: 0.11, volume: 0.012, wave: 'sine', spacing: 0.055 },
    warning: { notes: [440, 392], duration: 0.065, volume: 0.007, wave: 'sine', spacing: 0.075 },
    toggle: { notes: [659, 523], duration: 0.05, volume: 0.008, wave: 'sine', spacing: 0.035 },
    'toggle-on': { notes: [523, 740], duration: 0.045, volume: 0.008, wave: 'sine', spacing: 0.035 },
    'toggle-off': { notes: [740, 523], duration: 0.045, volume: 0.007, wave: 'sine', spacing: 0.035 },
    notification: { notes: [659, 784], duration: 0.08, volume: 0.008, wave: 'sine', spacing: 0.07 },
    'progress-start': { notes: [392, 494], duration: 0.045, volume: 0.006, wave: 'sine', spacing: 0.04 },
    'progress-tick': { notes: [659], duration: 0.018, volume: 0.0025, wave: 'sine', spacing: 0 },
    'progress-complete': { notes: [523, 659, 784], duration: 0.095, volume: 0.01, wave: 'sine', spacing: 0.05 },
    step: { notes: [semitone(520)], duration: 0.03, volume: 0.006, wave: 'sine', spacing: 0 },
  };
  const cue = cues[kind];

  cue.notes.forEach((frequency, i) => {
    const at = start + i * cue.spacing;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, at);
    osc.type = cue.wave;
    osc.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(cue.volume, at + Math.min(0.008, cue.duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + cue.duration);
    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(output!);
    osc.start(at);
    osc.stop(at + cue.duration + 0.006);
  });
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
      role={compact ? undefined : 'menuitemcheckbox'}
      aria-label={enabled ? 'Turn sound effects off' : 'Turn sound effects on'}
      aria-checked={compact ? undefined : enabled}
      aria-pressed={compact ? enabled : undefined}
      title={enabled ? 'Sound effects on' : 'Sound effects off'}
      onClick={() => {
        setUiSoundsEnabled(!enabled);
        if (!enabled) playUiSound('toggle-on');
      }}
      data-no-sound
      className={compact ? 'inline-flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-paper' : 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-paper [&>svg]:size-4 [&>svg]:text-ink-3'}
    >
      <Icon aria-hidden className={compact ? 'size-4' : undefined} />
      {!compact && (enabled ? 'Sound effects on' : 'Sound effects off')}
    </button>
  );
}
