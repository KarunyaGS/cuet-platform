import { CircleCheck, KeyRound, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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

/** Asks for the account's email and sends a one-time reset link. While email is not switched on, explains the manual route. */
export function ForgotPasswordPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.emailStatus().then((r) => setAvailable(r.available), () => setAvailable(false));
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy');
    setErr(null);
    try {
      const r = await api.forgotPassword(email.trim());
      if (r.available) setState('sent');
      else {
        setAvailable(false);
        setState('idle');
      }
    } catch (x) {
      setErr(x instanceof ApiError && x.status === 400 ? 'Enter a valid email address.' : 'Could not reach CUET Prep. Check your connection and try again.');
      setState('idle');
    }
  };
  if (state === 'sent')
    return (
      <Shell title="Check your email">
        <p className="mt-3 flex items-start gap-2 text-[15px] leading-relaxed text-ink-2">
          <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
          <span>
            If an account uses <span className="font-medium text-ink">{email.trim()}</span>, a reset link is on its way. It works once and expires in one hour. Look in the spam folder if you do not see it.
          </span>
        </p>
        <Link to="/signin" className={`${buttonClass('secondary')} mt-6 w-full`}>
          Back to sign in
        </Link>
      </Shell>
    );
  if (available === false)
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
  return (
    <Shell title="Forgot your password?">
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Enter the email address you signed up with. We will send a link to choose a new password.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
          <input className={inputClass} type="email" autoComplete="email" inputMode="email" maxLength={200} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {err && (
          <div role="alert" className="rounded-lg border border-wrong/25 bg-wrong-soft px-3 py-2 text-sm text-wrong">
            {err}
          </div>
        )}
        <button type="submit" disabled={state === 'busy' || available === null} className={`${buttonClass('primary')} h-11 w-full`}>
          {state === 'busy' ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <Link to="/signin" className="mt-4 block text-center text-sm text-accent hover:underline">
        Back to sign in
      </Link>
    </Shell>
  );
}

/** A page that uses a one-time token from the address fragment as soon as it opens (confirm an email, stop reminders). */
function TokenPage({ run, titles, done, failed }: { run: (token: string) => Promise<unknown>; titles: { busy: string; done: string; failed: string }; done: string; failed: string }) {
  const [token] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')));
  const [state, setState] = useState<'busy' | 'done' | 'failed'>(token.length < 20 ? 'failed' : 'busy');
  const [message, setMessage] = useState(failed);
  const started = useRef(false);
  useEffect(() => {
    if (token.length < 20 || started.current) return;
    started.current = true;
    run(token).then(
      () => {
        setState('done');
        window.history.replaceState(null, '', window.location.pathname);
      },
      (x) => {
        if (x instanceof ApiError && x.status === 400) setMessage(x.message);
        setState('failed');
      },
    );
  }, [token, run]);
  return (
    <Shell title={titles[state]}>
      <p className="mt-3 flex items-start gap-2 text-[15px] leading-relaxed text-ink-2" role="status">
        {state === 'done' && <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-correct" />}
        <span>{state === 'busy' ? 'One moment…' : state === 'done' ? done : message}</span>
      </p>
      <Link to="/" className={`${buttonClass(state === 'done' ? 'primary' : 'secondary')} mt-6 w-full`}>
        Open CUET Prep
      </Link>
    </Shell>
  );
}

const confirmEmail = (token: string) => api.verifyEmail(token);
const stopReminders = (token: string) => api.unsubscribe(token);

/** Opened from the confirmation email: /verify-email#<token>. */
export function VerifyEmailPage() {
  return (
    <TokenPage
      run={confirmEmail}
      titles={{ busy: 'Confirming your email', done: 'Email confirmed', failed: 'Link not valid' }}
      done="Thank you. Your email address is confirmed."
      failed="This page needs the full link from the confirmation email. Sign in and ask for a new one from your profile."
    />
  );
}

/** Opened from a reminder email: /unsubscribe#<token>. No sign-in needed. */
export function UnsubscribePage() {
  return (
    <TokenPage
      run={stopReminders}
      titles={{ busy: 'Stopping reminder emails', done: 'Reminder emails stopped', failed: 'Link not valid' }}
      done="You will not get study reminders by email any more. You can turn them on again from your profile. Emails about your account, such as password resets, are still sent."
      failed="This page needs the full link from a reminder email. You can also turn reminders off on your profile page."
    />
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
