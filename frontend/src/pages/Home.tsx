import { ChevronRight, Info, PlayCircle } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api';
import { SectionTitle, useAuth, useLoad } from '../ui';
import { DashboardPage } from './Dashboard';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
/** Home for signed-in students: where they left off, their subjects, and the official exam information. */
export function Home() {
  const dash = useLoad(api.dashboard, []);
  const prefs = useLoad(api.preferences, []);
  const { user } = useAuth();
  const first = user?.displayName.split(/\s+/)[0] ?? '';
  const d = dash.data;
  const resume = d?.inProgress[0];
  const last = d?.continueLearning[0];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem]">
          {greeting()}, {first}
        </h1>
        <p className="mt-1 text-[15px] text-ink-2">Every subject, unit and topic here comes from the official NTA syllabus, with a link to the source page.</p>
      </header>

      {d && (resume || last) && (
        <section aria-label="Continue" className="mb-7 overflow-hidden rounded-xl border border-rule bg-surface p-5">
          <div className="text-sm text-ink-2">{resume ? 'Start from where you left off' : 'Continue where you left off'}</div>
          {resume ? (
            <Link to={`/practice/${resume.id}`} className="group mt-1 flex items-center gap-2 text-lg font-semibold text-ink hover:text-accent">
              <PlayCircle aria-hidden className="size-5 shrink-0 text-accent" />
              <span className="truncate">
                {{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[resume.mode] ?? 'Test'}: {resume.topic ?? resume.paper}
              </span>
            </Link>
          ) : (
            <Link to={last!.kind === 'LESSON_VIEW' ? `/learn/${last!.resourceId}` : `/topic/${last!.nodeId}`} className="mt-1 block text-lg font-semibold text-ink hover:text-accent">
              <span className="line-clamp-2">{last!.title ?? 'Your last topic'}</span>
            </Link>
          )}
          {!resume && last?.paper && <div className="mt-0.5 text-sm text-ink-3">{last.paper}</div>}
        </section>
      )}

      {prefs.data && prefs.data.papers.length > 0 && prefs.data.examCode && (
        <section aria-labelledby="my-subjects" className="mb-7">
          <SectionTitle
            id="my-subjects"
            action={
              <Link to="/profile" className="font-medium text-accent hover:underline">
                Change
              </Link>
            }
          >
            My subjects{prefs.data.targetYear ? `, ${prefs.data.examCode === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'} ${prefs.data.targetYear}` : ''}
          </SectionTitle>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {prefs.data.papers.map((p) => (
              <li key={p.id}>
                <Link to={`/${prefs.data!.examCode}/subject/${p.id}`} className="group flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 transition-colors hover:border-accent/50">
                  <span className="num w-12 shrink-0 text-sm text-ink-3">{p.code}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink group-hover:text-accent">{p.name}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Today" className="mt-9 border-t border-rule pt-7" data-home-today>
        <DashboardPage embedded />
      </section>
    </div>
  );
}
