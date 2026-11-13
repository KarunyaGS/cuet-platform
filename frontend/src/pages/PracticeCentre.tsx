/**
 * Practice Centre: one place for the three kinds of practice.
 *  1. Official previous-year papers: links to the exam body's own documents, and licensed papers when there are any.
 *  2. Practice questions: our own questions, by subject and topic.
 *  3. Mock tests: our own full papers, under exam conditions.
 * Official material and our own material are always labelled apart.
 */
import { PyqBrowser } from './Pyq';
import { Landmark, PencilLine, ScrollText, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, type ExamCode, type MockPaperCard } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Segmented, useAuth, useLoad } from '../ui';
import { OfficialDirectory } from './OfficialDirectory';


function Section({ id, icon, title, label, tone, children, intro }: { id: string; icon: React.ReactNode; title: string; label: string; tone: 'accent' | 'green' | 'amber'; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="text-ink-3 [&>svg]:size-5">
          {icon}
        </span>
        <h2 id={id} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-ink-2">{intro}</p>
      {children}
    </section>
  );
}

export function PracticeCentrePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const exam = (params.get('exam') === 'CUET_PG' ? 'CUET_PG' : 'CUET_UG') as ExamCode;
  const examName = exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG';
  // Which year and subject the paper browser shows; the sessions list below can send the student to a subject's papers.
  const [pyq, setPyq] = useState<{ year?: number; subject: string }>({ subject: '' });
  const licensed = useLoad(() => api.pastPapers({ exam }), [exam]);
  const mocks = useLoad(() => api.mockPapers(exam), [exam]);
  const subjects = useLoad(() => api.subjects(exam, 2026), [exam]);
  const prefs = useLoad(api.preferences, [user?.id]);
  const mine = new Set((prefs.data?.papers ?? []).map((p) => p.id));
  const withQuestions = (subjects.data ?? []).filter((s) => s.available && s.questions > 0).sort((a, b) => Number(mine.has(b.paperId)) - Number(mine.has(a.paperId)) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Practice Centre" subtitle="Previous-year question papers, official answer keys, our own practice questions and full mock tests, in one place. Each is labelled so you always know which is which." />
      <div className="mb-8">
        <Segmented label="Exam" value={exam} onChange={(v) => setParams({ exam: v }, { replace: true })} options={[{ value: 'CUET_UG', label: 'CUET-UG' }, { value: 'CUET_PG', label: 'CUET-PG' }]} />
      </div>

      {exam === 'CUET_UG' && (
        <Section
          id="pc-pyq"
          icon={<ScrollText />}
          title="Previous-year question papers"
          label="Open the papers"
          tone="green"
          intro="CUET (UG) 2024, 2025 and 2026 question papers in English that you can open now: choose a year and a subject, then press “Open paper”. NTA’s own files are marked; copies on other websites are labelled with their source."
        >
          <PyqBrowser year={pyq.year} subject={pyq.subject} onPick={(year, subject) => setPyq({ year, subject: subject ?? '' })} />
        </Section>
      )}

      <Section
        id="pc-official"
        icon={<Landmark />}
        title={exam === 'CUET_UG' ? 'Exam sessions and official answer keys' : 'Official previous-year papers'}
        label="Official"
        tone="accent"
        intro={`Every ${examName} paper the National Testing Agency held, by year, subject, date and shift, with its official answer key${exam === 'CUET_UG' ? ' and the question papers that can be opened for it' : ' and the status of its question paper'}.`}
      >
        {licensed.error && <ErrorBox error={licensed.error} onRetry={licensed.reload} />}
        {licensed.data && licensed.data.papers.length > 0 && (
          <div className="mb-4 rounded-xl border border-rule bg-surface p-4">
            <p className="text-sm text-ink">
              <span className="font-medium">{licensed.data.papers.length} official {licensed.data.papers.length === 1 ? 'paper' : 'papers'}</span> can be attempted here, with the official answer key.
            </p>
            <Link to={`/past-papers?exam=${exam}`} className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
              Browse by year and subject
            </Link>
          </div>
        )}
        <OfficialDirectory
          exam={exam}
          practiceSubjects={new Set(withQuestions.map((x) => x.paperId))}
          onOpenPapers={(year, subject) => {
            setPyq({ year, subject });
            document.getElementById('pc-pyq')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      </Section>

      <Section
        id="pc-practice"
        icon={<PencilLine />}
        title="Practice questions"
        label="Our own questions, not official papers"
        tone="green"
        intro="Questions written by CUET Prep to the official syllabus, with the answer and an explanation for each. Pick a subject, then a unit or topic. Practise with instant feedback and no timer, or take a timed topic test."
      >
        {subjects.error && <ErrorBox error={subjects.error} onRetry={subjects.reload} />}
        {subjects.loading && !subjects.data && <Loading />}
        {subjects.data &&
          (withQuestions.length === 0 ? (
            <Empty>Practice questions for {examName} are not available yet.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {withQuestions.map((s) => (
                <li key={s.paperId}>
                  <Link to={`/${exam}/subject/${s.paperId}`} className="block rounded-xl border border-rule bg-surface p-4 hover:border-accent/50">
                    <span className="block font-medium text-ink">
                      {s.name} <span className="font-normal text-ink-2">({s.code})</span>
                    </span>
                    <span className="num mt-1 block text-sm text-ink-2">
                      {s.questions} practice questions{mine.has(s.paperId) ? ' · your subject' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </Section>

      <Section
        id="pc-mock"
        icon={<Timer />}
        title="Mock tests"
        label="Our own papers, not official papers"
        tone="amber"
        intro="Full papers set by CUET Prep in the exam's format: the same number of questions, time and marking. Each paper covers every unit of the syllabus and is checked by a subject reviewer before it appears here. They are practice, not predictions of the real paper."
      >
        {mocks.error && <ErrorBox error={mocks.error} onRetry={mocks.reload} />}
        {mocks.loading && !mocks.data && <Loading />}
        {mocks.data && (mocks.data.length === 0 ? <Empty icon={<Timer />}>No mock paper has been published for {examName} yet. A paper appears here only after a reviewer has approved every question in it.</Empty> : <MockList papers={mocks.data} />)}
        {withQuestions.length > 0 && (
          <p className="mt-4 text-sm text-ink-2">
            You can also start a quick timed test from any subject page. It mixes practice questions at random and is not a reviewed mock paper.
          </p>
        )}
      </Section>
    </div>
  );
}

function MockList({ papers }: { papers: MockPaperCard[] }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  const start = async (id: string, mode: 'MOCK_TEST' | 'PRACTICE') => {
    setBusy(id + mode);
    setErr(null);
    try {
      const s = await api.startMockPaper(id, mode);
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy('');
    }
  };
  return (
    <>
      {err && <ErrorBox error={err} />}
      <ul className="grid gap-3 lg:grid-cols-2">
        {papers.map((p) => (
          <li key={p.id} className="rounded-xl border border-rule bg-surface p-4">
            <h3 className="font-medium text-ink">{p.title}</h3>
            <p className="num mt-1 text-sm text-ink-2">
              {p.questions} questions · {p.durationMinutes} minutes · +{p.marksCorrect} / {p.marksIncorrect} · all {p.units} units
            </p>
            <p className="num mt-0.5 text-sm text-ink-2">
              {p.difficulty['EASY'] ?? 0} easy, {p.difficulty['MEDIUM'] ?? 0} medium, {p.difficulty['HARD'] ?? 0} hard
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void start(p.id, 'MOCK_TEST')} disabled={busy !== ''} icon={<Timer aria-hidden />}>
                {busy === p.id + 'MOCK_TEST' ? 'Starting…' : 'Start timed test'}
              </Button>
              <Button kind="secondary" onClick={() => void start(p.id, 'PRACTICE')} disabled={busy !== ''}>
                {busy === p.id + 'PRACTICE' ? 'Starting…' : 'Practise without a timer'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
