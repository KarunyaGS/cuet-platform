import { ChevronRight, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Button, ErrorBox, Loading, SectionTitle, useAuth, useLoad } from '../ui';
import { TimerChoiceDialog } from './TimerChoiceDialog';

/**
 * Subject → Mock Tests → Full-length mock: the whole paper under exam conditions (the question count, time and marking
 * the exam cycle sets for the subject), started through the same session API as every other test.
 */
export function FullMockPage() {
  const { paperId = '' } = useParams();
  const subjects = useLoad(() => api.subjects('CUET_UG', 2026), []);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy] = useState(false);
  const [err] = useState<Error | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);

  if (subjects.loading && !subjects.data) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  const s = subjects.data?.find((x) => x.paperId === paperId);
  if (!s) return <ErrorBox error={new Error('Subject not found')} />;

  const start = async (timed: boolean) => {
    if (!user) return navigate('/signin');
    // Every mock test begins with the examination instructions; nothing starts until the rules are accepted.
    setTimerOpen(false);
    navigate(`/exam/start?mode=MOCK_TEST&paperId=${encodeURIComponent(paperId)}&timed=${timed ? 'true' : 'false'}`);
  };

  return (
    <div data-full-mock>
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link to="/CUET_UG" className="hover:text-accent">
          CUET UG
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link to={`/CUET_UG/subject/${s.paperId}`} className="hover:text-accent">
          {s.name}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span>Practice and Mock Test</span>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-medium text-ink-2">
          Full-length mock
        </span>
      </nav>
      <header className="mb-4 border-b border-rule pb-2.5">
        <h1 className="max-w-[58rem] text-lg leading-snug font-semibold break-words text-ink sm:text-xl">{s.name}: full-length mock test</h1>
        <p className="num mt-0.5 text-sm text-ink-2">The whole paper · {s.questions} questions in the bank · choose a timer before you begin</p>
      </header>
      <section aria-labelledby="full-mock">
        <SectionTitle id="full-mock">Attempt the full paper</SectionTitle>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-rule bg-surface px-4 py-3.5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Timer className="size-4" />
          </span>
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-[15px] font-medium text-ink">Mixed from every chapter</span>
            <span className="mt-0.5 block text-sm text-ink-2">The question count, time and marking scheme follow the CUET (UG) pattern for this subject. Each attempt draws a fresh mix of questions; your result and a review come at the end.</span>
          </span>
          <Button onClick={() => setTimerOpen(true)} disabled={busy}>
            {busy ? 'Starting…' : 'Start full-length mock'}
          </Button>
        </div>
        {err && <ErrorBox error={err} />}
      </section>
      <TimerChoiceDialog open={timerOpen} onClose={() => setTimerOpen(false)} onChoose={(timed) => void start(timed)} />
    </div>
  );
}
