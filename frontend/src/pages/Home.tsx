import { Link } from 'react-router';
import { api } from '../api';
import { ErrorBox, Loading, useAuth, useLoad } from '../ui';

export function Home() {
  const exams = useLoad(api.exams, []);
  const { user } = useAuth();
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Prepare for CUET from the official syllabus</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Every subject, unit and topic comes from the official NTA syllabus documents, with a link to the source page. Practise, take timed mocks
          and track weak topics. Answers are checked against stored answer keys.
        </p>
      </div>
      {user && (
        <Link to="/dashboard" className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-4 py-3 text-sm hover:border-[var(--color-accent)]">
          <span>
            <span className="font-semibold">Welcome back, {user.displayName}.</span> Continue where you left off, see today’s plan and start daily practice.
          </span>
          <span className="shrink-0 font-medium text-[var(--color-accent)]">Open today →</span>
        </Link>
      )}
      {exams.loading && <Loading />}
      {exams.error && <ErrorBox error={exams.error} onRetry={exams.reload} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {exams.data?.map((e) => (
          <Link key={e.code} to={`/${e.code}`} className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-[var(--color-accent)]">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-semibold">{e.label}</span>
              <span className="text-xs text-zinc-500">{e.level === 'UG' ? 'Undergraduate' : 'Postgraduate'}</span>
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              {[
                ['Papers', e.rules.papersOffered],
                ['Questions', e.rules.questionsPerPaper],
                ['Minutes', e.rules.durationMinutes],
                ['Marking', `+${e.rules.marksCorrect}/${e.rules.marksIncorrect}`],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded bg-zinc-50 py-1.5">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="num font-semibold text-zinc-900">{String(v ?? '-')}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 text-sm font-medium text-[var(--color-accent)] group-hover:underline">Browse subjects →</div>
          </Link>
        ))}
      </div>
      {!user && (
        <p className="mt-4 text-sm text-zinc-600">
          <Link to="/signup" className="font-medium text-[var(--color-accent)] underline">
            Create a free account
          </Link>{' '}
          to practise questions and track progress.
        </p>
      )}
    </div>
  );
}
