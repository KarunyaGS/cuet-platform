import { CircleCheck, KeyRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api';
import { Logo } from '../Layout';
import { buttonClass, inputClass } from '../ui';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-paper px-4 py-10">
      <Link to="/signin" aria-label="CUET Prep sign in" className="mb-10">
        <Logo />
      </Link>
      <main className="w-full max-w-[26rem] rounded-xl border border-rule bg-surface p-6 sm:p-8">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <KeyRound aria-hidden className="size-5 text-accent" />
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

/** Explains how a student gets back into their account while there is no email service. */
export function ForgotPasswordPage() {
  return (
    <Shell title="Forgot your password?">
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2">
        <p>Password reset by email is not available yet.</p>
        <p>
          Ask the CUET Prep team for a <span className="font-medium text-ink">one-time reset link</span>, giving the email address you signed up with. The link works once, for one hour, and
          signs your account out on every device when you use it.
        </p>
        <p>If you remember your password and only want to change it, sign in and use your profile page.</p>
      </div>
      <Link to="/signin" className={`${buttonClass('secondary')} mt-6 w-full`}>
        Back to sign in
      </Link>
    </Shell>
  );
}

/** Opened from a one-time reset link: /reset-password#<token>. The token stays in the address fragment, so it is never sent in a page request. */
export function ResetPasswordPage() {
  const [token] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')));
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const mismatch = pw.confirm.length > 0 && pw.next !== pw.confirm;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch || pw.next.length < 10) return;
    setState('busy');
    setErr(null);
    try {
      await api.resetPassword({ token, newPassword: pw.next });
      setState('done');
      window.history.replaceState(null, '', '/reset-password');
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Could not reach CUET Prep. Check your connection and try again.');
      setState('idle');
    }
  };
  if (state === 'done')
    return (
      <Shell title="Password changed">
        <p className="mt-3 flex items-start gap-2 text-[15px] text-ink-2">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-correct" />
          Your new password is set. You have been signed out everywhere, so sign in again with the new password.
        </p>
        <Link to="/signin" className={`${buttonClass('primary')} mt-6 w-full`}>
          Sign in
        </Link>
      </Shell>
    );
  if (token.length < 20)
    return (
      <Shell title="Reset link missing">
        <p className="mt-3 text-[15px] text-ink-2">This page needs the full one-time link you were given. Copy the whole link into the address bar, or ask for a new link.</p>
        <Link to="/forgot-password" className={`${buttonClass('secondary')} mt-6 w-full`}>
          How to get a reset link
        </Link>
      </Shell>
    );
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">New password</span>
          <input className={inputClass} type="password" autoComplete="new-password" minLength={10} maxLength={200} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <span className="mt-1.5 block text-xs text-ink-3">At least 10 characters.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Repeat new password</span>
          <input className={inputClass} type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          {mismatch && <span className="mt-1.5 block text-xs text-wrong">The two passwords do not match.</span>}
        </label>
        {err && (
          <div role="alert" className="rounded-lg border border-wrong/25 bg-wrong-soft px-3 py-2 text-sm text-wrong">
            {err}
          </div>
        )}
        <button type="submit" disabled={state === 'busy' || mismatch || pw.next.length < 10} className={`${buttonClass('primary')} h-11 w-full`}>
          {state === 'busy' ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </Shell>
  );
}
