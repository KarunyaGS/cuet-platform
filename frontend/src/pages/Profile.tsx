import { CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { api, type ExamCode } from '../api';
import { Button, ErrorBox, inputClass, Loading, PageHeader, useAuth, useLoad } from '../ui';

/** A settings group: title and short description on the left, the form on the right (stacked on phones). */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-rule py-8 first:border-t-0 first:pt-0 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      <div className="rounded-xl border border-rule bg-surface p-5">{children}</div>
    </section>
  );
}
const input = inputClass;
const label = 'mb-1.5 block text-sm font-medium text-ink';
const Saved = ({ show, children = 'Saved' }: { show: boolean; children?: React.ReactNode }) =>
  show ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-correct" role="status">
      <CircleCheck aria-hidden className="size-4" />
      {children}
    </span>
  ) : null;

/** Confirmation of the email address and the study-reminder switch. Hidden while email is not switched on. */
function EmailSection() {
  const { user, refresh } = useAuth();
  const s = useLoad(api.emailSettings, [user?.id]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  if (!s.data || !s.data.emailAvailable) return null;
  const d = s.data;
  const act = async (f: () => Promise<string>) => {
    setBusy(true);
    setErr(null);
    setNote('');
    try {
      setNote(await f());
      s.reload();
      void refresh();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Email" description="Password reset links and account notices go to this address. Study reminders are optional.">
      <div className="space-y-4">
        <div>
          <p className="break-all text-[15px] font-medium text-ink">{d.email}</p>
          <p className={`mt-1 text-sm ${d.emailVerified ? 'text-correct' : 'text-ink-2'}`}>{d.emailVerified ? 'Confirmed' : 'Not confirmed yet. Open the link in the email we sent you.'}</p>
        </div>
        {!d.emailVerified && (
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const r = await api.sendVerification();
                return r.sent ? 'Confirmation email sent. It can take a minute to arrive.' : r.reason === 'TOO_MANY' ? 'We have sent several already. Try again in an hour.' : 'The email could not be sent just now. Try again later.';
              })
            }
          >
            Send the confirmation email again
          </Button>
        )}
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-accent"
            checked={d.emailReminders}
            disabled={busy || !d.emailVerified}
            onChange={(e) => void act(async () => ((await api.setEmailSettings({ emailReminders: e.target.checked })).emailReminders ? 'Reminders are on.' : 'Reminders are off.'))}
          />
          <span>
            <span className="block text-sm font-medium text-ink">Email me a study reminder</span>
            <span className="mt-0.5 block text-sm text-ink-2">At most one a day, in the evening, and only when you have an unfinished test, planned tasks, a daily goal or a weak topic. {d.emailVerified ? '' : 'Confirm your email first.'}</span>
          </span>
        </label>
        {note && (
          <p className="text-sm text-ink-2" role="status">
            {note}
          </p>
        )}
        {err && <ErrorBox error={err} />}
      </div>
    </Section>
  );
}

/** Exam, target year and up to 10 subjects: used for "My subjects" on the home page and daily practice. */
function PreferencesForm() {
  const prefs = useLoad(api.preferences, []);
  const [exam, setExam] = useState<ExamCode | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [err, setErr] = useState<Error | null>(null);
  const subs = useLoad(() => (exam ? api.subjects(exam, 2026) : Promise.resolve([])), [exam]);
  useEffect(() => {
    if (prefs.data) {
      setExam(prefs.data.examCode ?? '');
      setYear(prefs.data.targetYear ?? '');
      setIds(prefs.data.papers.map((p) => p.id));
    }
  }, [prefs.data]);
  if (prefs.loading && !prefs.data) return <Loading />;
  const list = (subs.data ?? []).filter((x) => !q || `${x.name} ${x.code}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => {
    setState('idle');
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 10 ? cur : [...cur, id]));
  };
  const save = async () => {
    setErr(null);
    setState('saving');
    try {
      await api.setPreferences({ examCode: exam || null, targetYear: year === '' ? null : year, paperIds: ids });
      setState('saved');
      prefs.reload();
    } catch (e) {
      setErr(e as Error);
      setState('idle');
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Exam</span>
          <select
            className={input}
            value={exam}
            onChange={(e) => {
              setExam(e.target.value as ExamCode | '');
              setIds([]);
              setState('idle');
            }}
          >
            <option value="">Not chosen yet</option>
            <option value="CUET_UG">CUET-UG (undergraduate)</option>
            <option value="CUET_PG">CUET-PG (postgraduate)</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Year you will take it</span>
          <select className={input} value={year} onChange={(e) => (setYear(e.target.value ? Number(e.target.value) : ''), setState('idle'))}>
            <option value="">Not sure yet</option>
            {[2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {exam && (
        <fieldset>
          <legend className={label}>
            Subjects <span className="font-normal text-ink-3">({ids.length} of up to 10 chosen)</span>
          </legend>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subjects or codes" aria-label="Search subjects" className={`${input} mb-2`} />
          {subs.loading && !subs.data ? (
            <Loading />
          ) : (
            <div className="max-h-72 divide-y divide-rule overflow-y-auto rounded-lg border border-rule">
              {list.map((x) => {
                const on = ids.includes(x.paperId);
                return (
                  <label key={x.paperId} className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${on ? 'bg-accent-soft' : 'hover:bg-paper'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(x.paperId)} disabled={!on && ids.length >= 10} className="size-4 accent-accent" />
                    <span className="num w-14 shrink-0 text-ink-3">{x.code}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{x.name}</span>
                    {!x.available && <span className="shrink-0 text-xs text-ink-3">Syllabus being checked</span>}
                  </label>
                );
              })}
              {list.length === 0 && <p className="px-3 py-3 text-sm text-ink-3">No subjects match.</p>}
            </div>
          )}
        </fieldset>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save exam and subjects'}
        </Button>
        <Saved show={state === 'saved'} />
      </div>
      {err && <ErrorBox error={err} />}
    </div>
  );
}

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
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profile and goals" subtitle={`Member since ${new Date(d.memberSince).toLocaleDateString(undefined, { dateStyle: 'long' })}. ${d.testsTaken} tests and practice sets submitted, ${d.bookmarks} bookmarks.`} />
      <div>
        <Section title="Account" description="Your name appears on your Today page and in the menu.">
          <form
            className="space-y-4"
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
              <div className={label}>Email</div>
              <div className="text-[15px] text-ink-2">{d.email}</div>
            </div>
            <label className="block">
              <span className={label}>Name</span>
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

        <Section title="Exam and subjects" description="What you are preparing for. Your home page and daily practice start with these subjects.">
          <PreferencesForm />
        </Section>

        <Section title="Daily goals" description="Targets for the meters on your Today page. Set what you can keep up every day.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run('goal', () => api.setGoals(goal));
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>Questions per day</span>
                <input className={input} type="number" min={0} max={500} value={goal.questionsPerDay} onChange={(e) => setGoal({ ...goal, questionsPerDay: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className={label}>Lessons per day</span>
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

        <EmailSection />

        <Section title="Password" description="Changing your password signs you out on every other device.">
          <form
            className="space-y-4"
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
              <span className={label}>Current password</span>
              <input className={input} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </label>
            <label className="block">
              <span className={label}>New password</span>
              <input className={input} type="password" autoComplete="new-password" minLength={10} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
              <span className="mt-1.5 block text-xs text-ink-3">At least 10 characters.</span>
            </label>
            <label className="block">
              <span className={label}>Repeat new password</span>
              <input className={input} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              {pwMismatch && <span className="mt-1.5 block text-xs text-wrong">The two new passwords do not match.</span>}
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
