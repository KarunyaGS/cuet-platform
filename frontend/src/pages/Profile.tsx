import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { api } from '../api';
import { Button, ErrorBox, Loading, PageHeader, useAuth, useLoad } from '../ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
const input = 'w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none';
const Saved = ({ show, children = 'Saved' }: { show: boolean; children?: React.ReactNode }) => (show ? <span className="text-sm text-emerald-700">{children}</span> : null);

/** Account details, name, password and daily goals. */
export function ProfilePage() {
  const { user, ready, refresh } = useAuth();
  const p = useLoad(api.profile, [user?.id]);
  const g = useLoad(api.goals, [user?.id]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState({ questionsPerDay: 20, lessonsPerDay: 1 });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saved, setSaved] = useState<'' | 'name' | 'goal' | 'pw'>('');
  const [err, setErr] = useState<{ where: string; e: Error } | null>(null);
  useEffect(() => {
    if (p.data) setName(p.data.displayName);
  }, [p.data]);
  useEffect(() => {
    if (g.data) setGoal({ questionsPerDay: g.data.questionsPerDay, lessonsPerDay: g.data.lessonsPerDay });
  }, [g.data]);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (p.loading && !p.data) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data!;

  const run = async (where: 'name' | 'goal' | 'pw', f: () => Promise<unknown>) => {
    setErr(null);
    setSaved('');
    try {
      await f();
      setSaved(where);
    } catch (e) {
      setErr({ where, e: e as Error });
    }
  };
  const errFor = (w: string) => (err?.where === w ? <ErrorBox error={err.e} /> : null);
  const pwMismatch = pw.confirm.length > 0 && pw.newPassword !== pw.confirm;

  return (
    <div className="max-w-2xl">
      <PageHeader title="My profile" subtitle={`Member since ${new Date(d.memberSince).toLocaleDateString()} · ${d.testsTaken} tests and practice sets submitted`} />
      <div className="space-y-4">
        <Section title="Account">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run('name', async () => {
                await api.updateProfile({ displayName: name });
                await refresh();
                p.reload();
              });
            }}
          >
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Email</div>
              <div className="text-sm">{d.email}</div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!name.trim() || name.trim() === d.displayName}>
                Save name
              </Button>
              <Saved show={saved === 'name'} />
            </div>
            {errFor('name')}
          </form>
        </Section>

        <Section title="Daily goals">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run('goal', () => api.setGoals(goal));
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Questions per day</span>
                <input className={input} type="number" min={0} max={500} value={goal.questionsPerDay} onChange={(e) => setGoal({ ...goal, questionsPerDay: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Lessons per day</span>
                <input className={input} type="number" min={0} max={50} value={goal.lessonsPerDay} onChange={(e) => setGoal({ ...goal, lessonsPerDay: Number(e.target.value) })} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">Save goals</Button>
              <Saved show={saved === 'goal'} />
            </div>
            {errFor('goal')}
          </form>
        </Section>

        <Section title="Change password">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwMismatch) return;
              void run('pw', async () => {
                await api.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
                setPw({ currentPassword: '', newPassword: '', confirm: '' });
              });
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Current password</span>
              <input className={input} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">New password (at least 10 characters)</span>
              <input className={input} type="password" autoComplete="new-password" minLength={10} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Repeat new password</span>
              <input className={input} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              {pwMismatch && <span className="mt-1 block text-xs text-red-700">The two new passwords do not match.</span>}
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pwMismatch || pw.newPassword.length < 10 || !pw.currentPassword}>
                Change password
              </Button>
              <Saved show={saved === 'pw'}>Password changed. Other devices have been signed out.</Saved>
            </div>
            {errFor('pw')}
          </form>
        </Section>
      </div>
    </div>
  );
}
