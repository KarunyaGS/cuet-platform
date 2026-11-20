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
import { Badge, Button, Empty, ErrorBox, Loading, useAuth, useLoad } from '../ui';
import { OfficialDirectory } from './OfficialDirectory';
import { TimerChoiceDialog } from './TimerChoiceDialog';


function Section({ id, icon, title, label, tone, children, intro }: { id: string; icon: React.ReactNode; title: string; label: string; tone: 'accent' | 'green' | 'amber'; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-5 scroll-mt-20 rounded-[22px] border border-rule bg-surface p-4 shadow-[0_10px_30px_-26px_rgb(24_68_59/0.35)] first:mt-0 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === 'green' ? 'bg-[#eaf0d5] text-forest' : tone === 'amber' ? 'bg-marker-soft text-marker' : 'bg-accent-soft text-accent'} [&>svg]:size-5`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-lg font-bold tracking-tight text-forest">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{intro}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {children}
    </section>
  );
}

export function PracticeCentrePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const exam = 'CUET_UG' as ExamCode; // CUET UG is the only active exam
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
    <div className="mx-auto w-full max-w-[88rem]" data-practice-centre>
      <section className="relative mb-5 overflow-hidden rounded-[26px] bg-gradient-to-br from-forest via-[#245548] to-[#456b51] px-5 py-5 text-white shadow-[0_18px_42px_-28px_rgb(24_68_59/0.62)] sm:px-7 sm:py-6">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-24 size-64 rounded-full border border-white/10 bg-white/[0.035]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl"><span className="inline-flex rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lime">CUET UG · practice space</span><h1 className="mt-3 text-[clamp(27px,3vw,38px)] font-bold leading-tight tracking-[-0.04em]">Practice Centre</h1><p className="mt-1.5 text-sm leading-relaxed text-white/75">Choose past papers, focused practice or a full mock. Set your pace when you begin a test.</p></div>
          <div className="relative flex flex-wrap gap-2 text-center">
            {[
              { label: 'Past papers', value: licensed.data?.papers.length },
              { label: 'Practice subjects', value: withQuestions.length },
              { label: 'Mock tests', value: mocks.data?.length },
            ].filter((x) => x.value !== undefined).map((x) => <div key={x.label} className="min-w-[94px] rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-2"><span className="num block text-lg font-bold text-lime">{x.value}</span><span className="text-[10px] font-medium text-white/70">{x.label}</span></div>)}
          </div>
        </div>
        <nav aria-label="Practice Centre sections" className="relative mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-4">
          {[['pc-pyq', 'Past papers'], ['pc-official', 'Official sessions'], ['pc-practice', 'Practice questions'], ['pc-mock', 'Mock tests']].map(([id, text]) => <a key={id} href={`#${id}`} className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.15] hover:text-white">{text}</a>)}
        </nav>
      </section>

      {exam === 'CUET_UG' && (
        <Section
          id="pc-pyq"
          icon={<ScrollText />}
          title="Previous-year question papers"
          label="Open the papers"
          tone="green"
          intro="CUET (UG) 2022 to 2025 question papers in English that you can open now: choose a year and a subject, then press “Open paper”. NTA’s own files are marked; copies on other websites are labelled with their source."
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
        intro="Questions written by Prepora to the official syllabus, with the answer and an explanation for each. Pick a subject, then a unit or topic. Practise with instant feedback and no timer, or take a timed topic test."
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
        intro="Full papers set by Prepora in the exam's format: the same questions and marking. Choose whether to use the time limit when you begin. Each paper covers every unit of the syllabus and is checked by a subject reviewer before it appears here. They are practice, not predictions of the real paper."
      >
        {mocks.error && <ErrorBox error={mocks.error} onRetry={mocks.reload} />}
        {mocks.loading && !mocks.data && <Loading />}
        {mocks.data && (mocks.data.length === 0 ? <Empty icon={<Timer />}>No mock paper has been published for {examName} yet. A paper appears here only after a reviewer has approved every question in it.</Empty> : <MockList papers={mocks.data} />)}
        {withQuestions.length > 0 && (
          <p className="mt-4 text-sm text-ink-2">
            You can also start a quick test from any subject page and choose whether to use a timer. It mixes practice questions at random and is not a reviewed mock paper.
          </p>
        )}
      </Section>
    </div>
  );
}

function MockList({ papers }: { papers: MockPaperCard[] }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [timerPaper, setTimerPaper] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const start = async (timed: boolean) => {
    const id = timerPaper;
    if (!id) return;
    setTimerPaper(null);
    setBusy(id);
    setErr(null);
    try {
      const s = await api.startMockPaper(id, 'MOCK_TEST', timed);
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy('');
    }
  };
  return (
    <>
      {err && <ErrorBox error={err} />}
      <TimerChoiceDialog open={timerPaper !== null} onClose={() => setTimerPaper(null)} onChoose={(timed) => void start(timed)} busy={busy !== ''} title="Choose your pace for this mock" />
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
              <Button onClick={() => setTimerPaper(p.id)} disabled={busy !== ''} icon={<Timer aria-hidden />}>
                {busy === p.id ? 'Starting…' : 'Start mock test'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
