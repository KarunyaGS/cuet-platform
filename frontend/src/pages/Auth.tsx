import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { Button, ErrorBox, useAuth } from '../ui';

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'signup') await api.register(form);
      await api.login({ email: form.email, password: form.password });
      await refresh();
      navigate('/');
    } catch (x) {
      setErr(x as Error);
    } finally {
      setBusy(false);
    }
  };
  const field = 'mt-1 w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm';
  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-sm rounded-lg border border-zinc-200 bg-white p-4">
      <h1 className="text-lg font-semibold">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
      {mode === 'signup' && (
        <label className="mt-3 block text-sm">
          Name
          <input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={field} autoComplete="name" />
        </label>
      )}
      <label className="mt-3 block text-sm">
        Email
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} autoComplete="email" />
      </label>
      <label className="mt-3 block text-sm">
        Password
        <input required type="password" minLength={mode === 'signup' ? 10 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        {mode === 'signup' && <span className="mt-0.5 block text-xs text-zinc-500">At least 10 characters.</span>}
      </label>
      {err && <ErrorBox error={err} />}
      <div className="mt-4 flex items-center justify-between">
        <Button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
        <Link to={mode === 'signup' ? '/signin' : '/signup'} className="text-sm text-zinc-600 hover:underline">
          {mode === 'signup' ? 'I have an account' : 'Create an account'}
        </Link>
      </div>
    </form>
  );
}
