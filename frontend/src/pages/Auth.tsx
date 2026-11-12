import { BookOpen, ChartNoAxesColumn, FileCheck2, Timer } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { api, ApiError } from '../api';
import { inputClass, useAuth } from '../ui';

type Mode = 'signin' | 'signup';

const HIGHLIGHTS = [
  { icon: <FileCheck2 />, title: 'Official syllabus', text: 'Every CUET-UG and CUET-PG subject, unit and topic, with the NTA source page.' },
  { icon: <BookOpen />, title: 'Learn and revise', text: 'Lessons, formulas and quick revision notes for each topic.' },
  { icon: <Timer />, title: 'Practise like the exam', text: 'Instant-feedback practice, unit tests and timed mocks with CUET marking.' },
  { icon: <ChartNoAxesColumn />, title: 'Stay on track', text: 'Daily goals, a study planner, bookmarks and progress by subject.' },
];

/** Turns an API or network failure into a message a student can act on. */
function friendly(e: unknown, mode: Mode): { text: string; switchTo?: Mode } {
  if (e instanceof ApiError) {
    if (mode === 'signin' && e.status === 401) return { text: 'The email or password is incorrect. Check them and try again.' };
    if (mode === 'signup' && e.status === 409) return { text: 'An account with this email already exists.', switchTo: 'signin' };
    if (e.status === 400 || e.status === 422) return { text: e.message === 'Request did not pass validation' ? 'Please check the details you entered.' : e.message };
    if (e.status === 429) return { text: 'Too many attempts. Please wait a minute and try again.' };
    if (e.status >= 500) return { text: 'CUET Prep is having a problem right now. Please try again in a moment.' };
    return { text: e.message };
  }
  return { text: 'Could not reach CUET Prep. Check your internet connection and try again.' };
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className={`grid size-8 place-items-center rounded-lg text-xs font-bold tracking-wide ${light ? 'bg-white text-accent' : 'bg-accent text-white'}`}>CU</span>
      <span className="text-lg">CUET Prep</span>
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

const input = inputClass;

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number; disabled?: boolean; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        id={props.id}
        type={show ? 'text' : 'password'}
        required
        minLength={props.minLength}
        maxLength={200}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        disabled={props.disabled}
        className={`${input} pr-16`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-ink-3 hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-controls={props.id}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}

/** The first screen for visitors: a welcome panel with Sign In and Create Account. */
export function AuthPage({ mode }: { mode: Mode }) {
  const location = useLocation();
  const { refresh } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; switchTo?: Mode } | null>(null);
  const signup = mode === 'signup';
  const mismatch = signup && form.confirm.length > 0 && form.password !== form.confirm;
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErr(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (signup && form.password !== form.confirm) return setErr({ text: 'The two passwords do not match.' });
    setBusy(true);
    setErr(null);
    try {
      if (signup) await api.register({ displayName: form.displayName.trim(), email: form.email.trim(), password: form.password });
    } catch (x) {
      setErr(friendly(x, 'signup'));
      setBusy(false);
      return;
    }
    try {
      await api.login({ email: form.email.trim(), password: form.password });
      // The route guard sends the student on (to the page they wanted, or the CUET home) once the session is confirmed.
      const user = await refresh();
      if (!user) {
        setErr({ text: 'You are signed in, but this browser did not keep the session. Allow cookies for this site and try again.' });
        setBusy(false);
      }
    } catch (x) {
      setErr(signup ? { text: 'Your account was created, but signing in failed. Please sign in.', switchTo: 'signin' } : friendly(x, 'signin'));
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <Link
      to={m === 'signin' ? '/signin' : '/signup'}
      replace
      state={location.state}
      role="tab"
      aria-selected={mode === m}
      onClick={() => setErr(null)}
      className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors ${mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="grid grid-cols-1 min-h-dvh bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Welcome panel (large screens) */}
      <aside className="hidden bg-accent text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <Logo light />
        <div className="max-w-md">
          <h2 className="text-[2rem] leading-tight font-semibold">Prepare for CUET from the official syllabus.</h2>
          <p className="mt-3 text-base leading-relaxed text-white/80">One place to learn, practise and track your preparation for CUET-UG and CUET-PG.</p>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3.5">
                <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/12 [&>svg]:size-4">
                  {h.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-white/75">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/75">
          Syllabus content comes from the official NTA documents.{' '}
          <Link to="/cuet" className="font-medium text-white underline underline-offset-2">
            Read official CUET information
          </Link>
        </p>
      </aside>

      {/* Sign in / create account */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[25rem]">
          <div className="mb-8 lg:hidden">
            <Logo />
            <p className="mt-3 text-sm text-ink-2">Prepare for CUET-UG and CUET-PG from the official syllabus: lessons, practice, mock tests and progress.</p>
          </div>

          <h1 className="text-2xl font-semibold text-ink">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{signup ? 'It is free. You will go straight to your CUET home.' : 'Sign in to continue your CUET preparation.'}</p>
          {from && !signup && <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">Please sign in to open that page.</p>}

          <div role="tablist" aria-label="Sign in or create an account" className="mt-6 flex gap-1 rounded-lg bg-ink/5 p-1">
            {tab('signin', 'Sign In')}
            {tab('signup', 'Create Account')}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}>
            {signup && (
              <Field label="Full name">
                <input required maxLength={80} value={form.displayName} onChange={(e) => set('displayName')(e.target.value)} autoComplete="name" disabled={busy} className={input} />
              </Field>
            )}
            <Field label="Email">
              <input required type="email" maxLength={200} value={form.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" inputMode="email" disabled={busy} className={input} />
            </Field>
            <Field label="Password" hint={signup ? 'At least 10 characters.' : undefined}>
              <PasswordInput id={`pw-${mode}`} value={form.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 10 : 1} disabled={busy} />
            </Field>
            {signup && (
              <Field label="Confirm password" hint={mismatch ? <span className="text-wrong">The two passwords do not match.</span> : undefined}>
                <PasswordInput id="pw-confirm" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" minLength={10} disabled={busy} />
              </Field>
            )}

            {err && (
              <div role="alert" className="rounded-lg border border-wrong/25 bg-wrong-soft px-3 py-2 text-sm text-wrong">
                {err.text}
                {err.switchTo && (
                  <Link to={err.switchTo === 'signin' ? '/signin' : '/signup'} replace state={location.state} onClick={() => setErr(null)} className="ml-1 font-semibold underline">
                    {err.switchTo === 'signin' ? 'Sign in instead' : 'Create an account'}
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || mismatch}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? (signup ? 'Creating your account…' : 'Signing in…') : signup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm lg:hidden">
            <Link to="/cuet" className="font-medium text-accent hover:underline">
              Read official CUET-UG and CUET-PG information
            </Link>
          </p>
          <p className="mt-6 text-center text-sm text-ink-2">
            {signup ? 'Already have an account? ' : 'New to CUET Prep? '}
            <Link to={signup ? '/signin' : '/signup'} replace state={location.state} onClick={() => setErr(null)} className="font-semibold text-accent hover:underline">
              {signup ? 'Sign in' : 'Create a free account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
