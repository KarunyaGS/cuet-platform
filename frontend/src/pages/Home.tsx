import { ChevronRight, GraduationCap, Info, Library, PlayCircle, Settings2 } from 'lucide-react';
import { Link } from 'react-router';
import { api, type Exam } from '../api';
import { ErrorBox, Loading, Meter, SectionTitle, useAuth, useLoad } from '../ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const marks = (n: unknown) => (typeof n === 'number' ? (n < 0 ? `−${Math.abs(n)}` : `+${n}`) : '–');

function ExamCard({ e }: { e: Exam }) {
  const ug = e.level === 'UG';
  const facts: [string, string][] = [
    ['Papers', String(e.rules.papersOffered ?? '–')],
    ['Questions per paper', String(e.rules.questionsPerPaper ?? '–')],
    ['Time per paper', e.rules.durationMinutes ? `${e.rules.durationMinutes} min` : '–'],
    ['Marking', `${marks(e.rules.marksCorrect)} / ${marks(e.rules.marksIncorrect)}`],
  ];
  return (
    <Link to={`/${e.code}`} className="group flex flex-col rounded-xl border border-rule bg-surface p-5 transition-colors hover:border-accent/50 focus-visible:border-accent">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          {ug ? <Library className="size-5" /> : <GraduationCap className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-lg font-semibold text-ink">{e.label}</h3>
            <span className="text-sm text-ink-3">{ug ? 'Undergraduate admissions' : 'Postgraduate admissions'}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{ug ? 'Domain subjects, languages and the General Test.' : 'Subject papers for master’s programmes.'}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="num mt-0.5 text-[15px] font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent">
        Browse subjects
        <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Home for signed-in students: where they left off, today's goal at a glance, and the two exams. */
export function Home() {
  const exams = useLoad(api.exams, []);
  const dash = useLoad(api.dashboard, []);
  const prefs = useLoad(api.preferences, []);
  const { user } = useAuth();
  const first = user?.displayName.split(/\s+/)[0] ?? '';
  const d = dash.data;
  const resume = d?.inProgress[0];
  const last = d?.continueLearning[0];
  const goal = d?.today.goal.questionsPerDay ?? 0;
  const done = d?.today.questionsAnswered ?? 0;
  const sorted = [...(exams.data ?? [])].sort((a, b) => (a.level === 'UG' ? -1 : 1) - (b.level === 'UG' ? -1 : 1));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem]">
          {greeting()}, {first}
        </h1>
        <p className="mt-1 text-[15px] text-ink-2">Every subject, unit and topic here comes from the official NTA syllabus, with a link to the source page.</p>
      </header>

      {d && (resume || last || goal > 0) && (
        <section aria-label="Continue" className="grid-cols-1 mb-7 grid overflow-hidden rounded-xl border border-rule bg-surface md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 p-5">
            <div className="text-sm text-ink-2">{resume ? 'Unfinished test' : last ? 'Continue where you left off' : 'Start today'}</div>
            {resume ? (
              <Link to={`/practice/${resume.id}`} className="group mt-1 flex items-center gap-2 text-lg font-semibold text-ink hover:text-accent">
                <PlayCircle aria-hidden className="size-5 shrink-0 text-accent" />
                <span className="truncate">
                  {{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[resume.mode] ?? 'Test'}: {resume.topic ?? resume.paper}
                </span>
              </Link>
            ) : last ? (
              <Link to={last.kind === 'LESSON_VIEW' ? `/learn/${last.resourceId}` : `/topic/${last.nodeId}`} className="mt-1 block text-lg font-semibold text-ink hover:text-accent">
                <span className="line-clamp-2">{last.title ?? 'Your last topic'}</span>
              </Link>
            ) : (
              <Link to="/dashboard" className="mt-1 block text-lg font-semibold text-ink hover:text-accent">
                Open today’s plan and daily practice
              </Link>
            )}
            {!resume && last?.paper && <div className="mt-0.5 text-sm text-ink-3">{last.paper}</div>}
          </div>
          <Link to="/dashboard" className="flex flex-col justify-center gap-2 border-t border-rule p-5 transition-colors hover:bg-paper md:border-t-0 md:border-l">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">Questions today</span>
              <span className="num font-semibold text-ink">
                {done} <span className="font-normal text-ink-3">of {goal}</span>
              </span>
            </div>
            <Meter value={goal ? (100 * done) / goal : 0} tone={goal && done >= goal ? 'correct' : 'accent'} label="Questions answered today against your goal" />
            <span className="text-sm font-medium text-accent">Open Today</span>
          </Link>
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
      {prefs.data && !prefs.data.set && (
        <Link to="/profile" className="mb-7 flex items-center gap-3 rounded-xl border border-dashed border-rule-strong px-5 py-4 text-sm text-ink-2 hover:border-accent/50 hover:text-ink">
          <Settings2 aria-hidden className="size-5 shrink-0 text-accent" />
          <span>
            <span className="font-medium text-ink">Choose your exam and subjects.</span> Your home page and daily practice will start with them.
          </span>
        </Link>
      )}

      <SectionTitle>Choose an exam</SectionTitle>
      {exams.loading && <Loading />}
      {exams.error && <ErrorBox error={exams.error} onRetry={exams.reload} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sorted.map((e) => (
          <ExamCard key={e.code} e={e} />
        ))}
      </div>
      <Link to="/cuet" className="group mt-6 flex items-center gap-3 rounded-xl border border-rule bg-surface px-5 py-4 transition-colors hover:border-accent/50">
        <Info aria-hidden className="size-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink group-hover:text-accent">Official exam information</span>
          <span className="block text-sm text-ink-2">Eligibility, pattern, dates, notices, admit card, results and participating universities, from NTA sources.</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
      </Link>
    </div>
  );
}
