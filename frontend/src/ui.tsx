import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type User } from './api';

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
    <div className="flex items-center gap-2 py-6 text-sm text-zinc-500" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-zinc-300 border-t-[var(--color-accent)]" />
      {label}…
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const signIn = error instanceof ApiError && error.status === 401;
  return (
    <div className="my-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {error.message}
      {signIn && (
        <Link to="/signin" className="ml-2 font-medium underline">
          Sign in
        </Link>
      )}
      {onRetry && !signIn && (
        <button onClick={onRetry} className="ml-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500">{children}</p>;
}

const tones = {
  zinc: 'bg-zinc-100 text-zinc-700',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
};
export function Badge({ tone = 'zinc', children, title }: { tone?: keyof typeof tones; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Shown on anything that has not been signed off by a person. */
export function PreviewBadge({ what = 'content' }: { what?: string }) {
  return (
    <Badge tone="amber" title={`This ${what} has not yet been reviewed and approved by a subject expert.`}>
      Preview · not reviewed
    </Badge>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function Button({ children, onClick, kind = 'primary', disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; type?: 'button' | 'submit' }) {
  const cls = {
    primary: 'bg-[var(--color-accent)] text-white hover:opacity-90',
    secondary: 'bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

export const kindLabel = (kind: string, label: string | null) =>
  ({ UNIT: 'Unit', CHAPTER: 'Chapter', SECTION: 'Section', PART: 'Part', COURSE: 'Course', TOPIC: 'Topic', SUBTOPIC: '', ITEM: '', NOTE: 'Note' })[kind] + (label ? ` ${label}` : '');

// ---- signed-in user ----
interface AuthState {
  user: User | null;
  preview: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({ user: null, preview: false, ready: false, refresh: async () => undefined });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh'>>({ user: null, preview: false, ready: false });
  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setState({ user: me.user, preview: me.preview, ready: true });
    } catch {
      setState({ user: null, preview: false, ready: true });
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ ...state, refresh }}>{children}</AuthContext.Provider>;
}
