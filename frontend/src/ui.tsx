import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, CircleAlert, Search } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { api, ApiError, UNAUTHORIZED_EVENT, type User } from './api';
import { PreporaSpark } from './brand';
import { playUiSound } from './sound';

/** Load data once per dependency change; exposes loading, error and a reload function. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => setState({ data, error: null, loading: false }),
      (error: Error) => setState({ data: null, error, loading: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 text-sm text-ink-3" role="status">
      <PreporaSpark className="size-5" animated />
      {label}…
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const signIn = error instanceof ApiError && error.status === 401;
  const planLimit = error instanceof ApiError && error.code === 'PLAN_LIMIT';
  return (
    <div className="my-4 flex items-start gap-2.5 rounded-lg border border-wrong/25 bg-wrong-soft px-3.5 py-2.5 text-sm text-wrong" role="alert">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {error.message}
        {signIn && (
          <Link to="/signin" className="ml-2 font-semibold underline underline-offset-2">
            Sign in
          </Link>
        )}
        {planLimit && (
          <Link to="/plans" className="ml-2 font-semibold underline underline-offset-2">
            See plans
          </Link>
        )}
        {onRetry && !signIn && !planLimit && (
          <button onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** What to show when a list has nothing in it: a short explanation and, where possible, the next step. */
export function Empty({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#cbd5bd] bg-gradient-to-br from-[#eef2e4] to-surface px-4 py-4 text-sm leading-relaxed text-ink-2">
      {icon && <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-forest text-lime [&>svg]:size-[18px]">{icon}</span>}
      <div className="min-w-0">
        <div>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

const tones = {
  zinc: 'bg-paper text-ink-2 ring-1 ring-rule',
  accent: 'bg-accent-soft text-accent',
  amber: 'bg-marker-soft text-marker',
  green: 'bg-correct-soft text-correct',
  red: 'bg-wrong-soft text-wrong',
};
export function Badge({ tone = 'zinc', children, title }: { tone?: keyof typeof tones; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Shown on anything that has not been signed off by a person. */
export function PreviewBadge(_props: { what?: string }) {
  // The "Preview, not reviewed" label is no longer shown to students. Review status is still kept on every question and document.
  return null;
}

/** Page title block: title, one line of context, actions on the right, and an optional way back. */
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="mb-5" data-page-header>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2.5">
        <div className="flex min-w-0 max-w-[60rem] items-start gap-1.5">
          {back && <Link to={back.to} aria-label={back.label} title={back.label} className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent"><ChevronLeft aria-hidden className="size-5" /></Link>}
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(1.7rem,2.4vw,2.35rem)] leading-[1.08] font-bold tracking-[-0.04em] text-ink">{title}</h1>
            {subtitle && <div className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-2">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A section heading inside a page, with an optional link or action on the right. */
export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-[16px] font-semibold tracking-[-0.02em] text-forest">
        {children}
      </h2>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  );
}

/** The one surface style: white, hairline border, small radius. Use for groups of related content, not for every block. */
export function Panel({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'ul' | 'ol' | 'aside' }) {
  return <As className={`rounded-2xl border border-rule bg-surface shadow-[0_8px_22px_rgba(31,56,46,0.045)] ${className}`}>{children}</As>;
}

/** Several key numbers in one panel, separated by hairlines rather than boxed one by one. */
export function StatGroup({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'correct' | 'wrong' | 'muted' }[] }) {
  const tone = { correct: 'text-correct', wrong: 'text-wrong', muted: 'text-ink-3' };
  return (
    <dl className="grid grid-cols-2 divide-rule rounded-2xl border border-rule bg-surface shadow-[0_8px_22px_rgba(31,56,46,0.045)] sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] sm:divide-x [&>div:nth-child(n+3)]:border-t [&>div:nth-child(n+3)]:border-rule sm:[&>div:nth-child(n+3)]:border-t-0">
      {items.map((s) => (
        <div key={s.label} className="px-4 py-3.5">
          <dt className="text-[13px] text-ink-2">{s.label}</dt>
          <dd className={`num mt-1 text-[1.35rem] font-bold tracking-tight ${s.tone ? tone[s.tone] : 'text-forest'}`}>{s.value}</dd>
          {s.hint && <dd className="mt-0.5 text-xs text-ink-3">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A thin progress bar. Tone follows meaning: accent for goals, green/amber/red for accuracy. */
export function Meter({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'correct' | 'marker' | 'wrong'; label?: string }) {
  const bg = { accent: 'bg-accent', correct: 'bg-correct', marker: 'bg-marker', wrong: 'bg-wrong' }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule/70" role={label ? 'progressbar' : undefined} aria-label={label} aria-valuenow={label ? Math.round(pct) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
export const accuracyTone = (v: number | null) => (v === null ? 'accent' : v >= 75 ? 'correct' : v >= 60 ? 'marker' : 'wrong') as 'accent' | 'correct' | 'marker' | 'wrong';

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonKinds: Record<ButtonKind, string> = {
  primary: 'bg-forest text-lime shadow-[0_5px_14px_rgb(24_68_59/0.18)] hover:bg-forest-deep hover:shadow-[0_8px_20px_rgb(24_68_59/0.24)]',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink',
  danger: 'bg-surface text-wrong ring-1 ring-inset ring-wrong/30 hover:bg-wrong-soft',
};
const buttonSizes = { sm: 'h-8 gap-1.5 px-2.5 text-[13px]', md: 'h-9 gap-2 px-3.5 text-sm' };
export const buttonClass = (kind: ButtonKind = 'primary', size: 'sm' | 'md' = 'md') =>
  `inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4 ${buttonSizes[size]} ${buttonKinds[kind]}`;

export function Button({
  children,
  onClick,
  kind = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  icon,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: ButtonKind;
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  icon?: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button type={type} onClick={() => { playUiSound('tap'); onClick?.(); }} disabled={disabled} title={title} className={`${buttonClass(kind, size)} ${className}`}>
      {icon}
      {children}
    </button>
  );
}

/** A link that looks like a button (for navigation, not actions). */
export function ButtonLink({ to, children, kind = 'secondary', size = 'md', icon }: { to: string; children: ReactNode; kind?: ButtonKind; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <Link to={to} onClick={() => playUiSound('tap')} className={buttonClass(kind, size)}>
      {icon}
      {children}
    </Link>
  );
}

/** Segmented control for switching views within a page. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-ink/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text input with a search icon. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-rule-strong bg-surface pr-3 pl-9 text-sm placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
      />
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-rule-strong bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:bg-paper';

export const kindLabel = (kind: string, label: string | null) =>
  ({ UNIT: 'Unit', CHAPTER: 'Chapter', SECTION: 'Section', PART: 'Part', COURSE: 'Course', TOPIC: 'Topic', SUBTOPIC: '', ITEM: '', NOTE: 'Note' })[kind] + (label ? ` ${label}` : '');

// ---- signed-in user ----
interface AuthState {
  user: User | null;
  preview: boolean;
  ready: boolean;
  /** True right after the student chose "Sign out" (so the next sign-in starts fresh, not on the old page). */
  signedOut: boolean;
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({ user: null, preview: false, ready: false, signedOut: false, refresh: async () => null, signOut: async () => undefined });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh' | 'signOut'>>({ user: null, preview: false, ready: false, signedOut: false });
  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setState((s) => ({ user: me.user, preview: me.preview, ready: true, signedOut: me.user ? false : s.signedOut }));
      return me.user;
    } catch {
      setState((s) => ({ user: null, preview: false, ready: true, signedOut: s.signedOut }));
      return null;
    }
  }, []);
  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setState((s) => ({ ...s, user: null, ready: true, signedOut: true }));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // Any API call answered "not signed in" (expired or revoked session) re-checks the session; the route guard then sends the student to sign in.
  useEffect(() => {
    const onUnauthorized = () => void refresh();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [refresh]);
  return <AuthContext.Provider value={{ ...state, refresh, signOut }}>{children}</AuthContext.Provider>;
}

function FullPageLoading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loading />
    </div>
  );
}

/** Pages for signed-in students only. Signed-out visitors go to the sign-in page and come back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, signedOut } = useAuth();
  const location = useLocation();
  if (!ready) return <FullPageLoading />;
  if (!user) {
    const from = location.pathname === '/' || signedOut ? undefined : `${location.pathname}${location.search}`;
    return <Navigate to="/signin" replace state={from ? { from } : undefined} />;
  }
  return <>{children}</>;
}

/** Sign-in and sign-up pages: a student who is already signed in goes straight to where they were heading. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullPageLoading />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />;
  }
  return <>{children}</>;
}

/** A chapter name without its numbering ("VI Reproduction" -> "Reproduction", "3 Optics" -> "Optics"). */
export const bareChapter = (t: string): string => t.replace(/^(?:[IVXLC]+|[A-Z]\d?|\d+)\s+(?=[A-Za-z(])/, '');
