import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prepora.ui-sounds';
const CHANGE_EVENT = 'prepora-ui-sound-change';
let context: AudioContext | null = null;
let memoryEnabled: boolean | null = null;

function enabledFromStorage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? (memoryEnabled ?? true) : saved !== 'off';
  } catch {
    return memoryEnabled ?? true;
  }
}

export function playUiSound(kind: 'tap' | 'select' | 'correct' | 'incorrect' | 'complete' | 'warning' | 'toggle') {
  if (typeof window === 'undefined' || !enabledFromStorage()) return;
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    context ??= new AudioContextClass();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const now = context.currentTime;
    const notes: Record<typeof kind, number[]> = {
      tap: [520], select: [660], correct: [660, 880], incorrect: [260], complete: [587, 740, 988], warning: [440, 330], toggle: [kind === 'toggle' && enabledFromStorage() ? 740 : 300],
    };
    const duration = kind === 'tap' ? 0.035 : kind === 'select' ? 0.05 : kind === 'complete' ? 0.11 : 0.075;
    const volume = kind === 'tap' ? 0.018 : 0.035;
    notes[kind].forEach((frequency, index) => {
      const start = now + index * (kind === 'complete' ? 0.065 : 0.035);
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = kind === 'incorrect' || kind === 'warning' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    });
  } catch {
    // Sound is optional: a blocked or unsupported audio context must never interrupt a student action.
  }
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
        if (!enabled) playUiSound('toggle');
      }}
      className={compact ? 'inline-flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-paper' : 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-paper [&>svg]:size-4 [&>svg]:text-ink-3'}
    >
      <Icon aria-hidden className={compact ? 'size-4' : undefined} />
      {!compact && (enabled ? 'Sound effects on' : 'Sound effects off')}
    </button>
  );
}
