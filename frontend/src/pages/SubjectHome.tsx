import { BookOpenCheck, CircleCheckBig, History } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api, type ExamCode } from '../api';
import { ErrorBox, Loading, useAuth, useLoad } from '../ui';
import { NotFoundPage } from './Search';

/**
 * The page a subject opens on: only where the student left off, the lessons they have finished and the tests they have finished.
 * Everything else about the subject (question bank, study material, papers, mock tests) lives in the sidebar.
 */
export function SubjectPage() {
  const { paperId = '', exam = 'CUET_UG' } = useParams();
  const { user } = useAuth();
  const subjects = useLoad(() => api.subjects(exam as ExamCode, 2026), [exam]);
  const summary = useLoad(() => (user ? api.subjectSummary(paperId) : Promise.resolve(null)), [paperId, user?.id]);
  if (subjects.loading && !subjects.data) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  const subject = subjects.data?.find((s) => s.paperId === paperId);
  if (!subject) return <NotFoundPage />;
  const d = summary.data;
  const last = d?.last ?? null;
  const resume = last ? (last.kind === 'LESSON_VIEW' && last.resourceId ? `/learn/${last.resourceId}` : last.nodeId ? `/topic/${last.nodeId}` : null) : null;

  return (
    <div data-subject-home>
      <header className="mb-5">
        <h1 className="text-[1.375rem] leading-snug font-semibold text-ink sm:text-2xl">{subject.name}</h1>
      </header>
      {summary.error ? (
        <ErrorBox error={summary.error} onRetry={summary.reload} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          <li className="rounded-xl border border-rule bg-surface p-5 md:col-span-2" data-card="continue">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <History aria-hidden className="size-4 text-accent" />
              Continue where you left off
            </div>
            {!user ? (
              <p className="mt-2 text-[15px] text-ink-2">
                <Link to="/signin" className="font-medium text-accent hover:underline">
                  Sign in
                </Link>{' '}
                to pick up where you stopped.
              </p>
            ) : summary.loading && !d ? (
              <p className="mt-2 text-[15px] text-ink-3">Loading…</p>
            ) : last && resume ? (
              <Link to={resume} className="mt-2 block text-lg font-semibold text-ink hover:text-accent" data-resume={resume}>
                {last.title ?? 'Continue'}
              </Link>
            ) : (
              <p className="mt-2 text-[15px] text-ink-2">Nothing opened yet. Pick a chapter from the sidebar to begin.</p>
            )}
          </li>
          <li className="rounded-xl border border-rule bg-surface p-5 md:col-span-1" data-card="lessons">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <BookOpenCheck aria-hidden className="size-4 text-accent" />
              Lessons completed
            </div>
            <div className="num mt-2 text-3xl font-semibold text-ink">{user ? (d?.lessonsCompleted ?? 0) : '–'}</div>
          </li>
          <li className="rounded-xl border border-rule bg-surface p-5 md:col-span-1" data-card="tests">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <CircleCheckBig aria-hidden className="size-4 text-accent" />
              Tests completed
            </div>
            <div className="num mt-2 text-3xl font-semibold text-ink">{user ? (d?.testsCompleted ?? 0) : '–'}</div>
          </li>
        </ul>
      )}
    </div>
  );
}
