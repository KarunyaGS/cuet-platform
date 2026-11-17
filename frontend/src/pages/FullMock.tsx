import { ChevronRight, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Button, ErrorBox, Loading, SectionTitle, useAuth, useLoad } from '../ui';

/**
 * Subject → Mock Tests → Full-length mock: the whole paper under exam conditions (the question count, time and marking
 * the exam cycle sets for the subject), started through the same session API as every other test.
 */
export function FullMockPage() {
  const { paperId = '' } = useParams();
  const subjects = useLoad(() => api.subjects('CUET_UG', 2026), []);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  if (subjects.loading && !subjects.data) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  const s = subjects.data?.find((x) => x.paperId === paperId);
  if (!s) return <ErrorBox error={new Error('Subject not found')} />;

  const start = async () => {
    if (!user) return navigate('/signin');
    setErr(null);
    setBusy(true);
    // A full-length mock is an exam: it runs full screen. The browser only allows this from a click, so it is asked for here.
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {
      /* the browser refused (or has no full screen): the test still opens, in focus mode */
    }
    try {
      const r = await api.startPractice({ mode: 'MOCK_TEST', paperId });
      navigate(`/practice/${r.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(false);
    }
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
        <p className="num mt-0.5 text-sm text-ink-2">The whole paper under exam conditions · {s.questions} questions in the bank</p>
      </header>
      <section aria-labelledby="full-mock">
        <SectionTitle id="full-mock">Attempt the full paper</SectionTitle>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-rule bg-surface px-4 py-3.5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Timer className="size-4" />
          </span>
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-[15px] font-medium text-ink">Timed, mixed from every chapter</span>
            <span className="mt-0.5 block text-sm text-ink-2">The question count, time and marking scheme follow the CUET (UG) pattern for this subject. Each attempt draws a fresh mix of questions; your result and a review come at the end.</span>
          </span>
          <Button onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start full-length mock'}
          </Button>
        </div>
        {err && <ErrorBox error={err} />}
      </section>
    </div>
  );
}
