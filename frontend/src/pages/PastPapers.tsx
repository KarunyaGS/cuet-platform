/** Previous-year papers: browse by exam, year and subject, then attempt a paper as it was set or as untimed practice. */
import { ExternalLink, FileText, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, type ExamCode, type PastPaper } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Segmented, useLoad } from '../ui';

const select = 'h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none';
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null);
const when = (p: PastPaper) => [day(p.examDate), p.shift].filter(Boolean).join(', ');
const marks = (p: PastPaper) => `+${p.marksCorrect} for a correct answer, ${p.marksIncorrect} for a wrong one`;

export function PastPapersPage() {
  const [params, setParams] = useSearchParams();
  const exam = (params.get('exam') === 'CUET_PG' ? 'CUET_PG' : 'CUET_UG') as ExamCode;
  const year = params.get('year') ?? '';
  const subject = params.get('subject') ?? '';
  const list = useLoad(() => api.pastPapers({ exam, year: year ? Number(year) : undefined, subject: subject || undefined }), [exam, year, subject]);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === 'exam') (next.delete('year'), next.delete('subject'));
    setParams(next, { replace: true });
  };
  return (
    <div>
      <PageHeader title="Official previous-year papers" subtitle="Official papers from earlier years, with the official answer key. Attempt one under exam conditions, or practise without a timer." back={{ to: `/practice-centre?exam=${exam}`, label: 'Practice Centre' }} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented label="Exam" value={exam} onChange={(v) => set('exam', v)} options={[{ value: 'CUET_UG', label: 'CUET-UG' }, { value: 'CUET_PG', label: 'CUET-PG' }]} />
        {list.data && list.data.years.length > 0 && (
          <>
            <select aria-label="Year" className={select} value={year} onChange={(e) => set('year', e.target.value)}>
              <option value="">All years</option>
              {list.data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select aria-label="Subject" className={select} value={subject} onChange={(e) => set('subject', e.target.value)}>
              <option value="">All subjects</option>
              {list.data.subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.papers.length === 0 ? (
          <Empty icon={<FileText />}>
            {list.data.total === 0
              ? 'Previous-year papers are not available yet. A paper appears here only after its source allows it to be shown and a reviewer has checked every question against the official paper.'
              : 'No paper matches these filters.'}
          </Empty>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {list.data.papers.map((p) => (
              <li key={p.id}>
                <Link to={`/past-papers/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-ink/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {p.subjectName} <span className="font-normal text-ink-2">({p.subjectCode})</span>
                    </span>
                    <span className="block text-sm text-ink-2">{[p.year, when(p)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="num text-sm text-ink-2">
                    {p.questions} questions · {p.durationMinutes} min
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export function PastPaperPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const d = useLoad(() => api.pastPaper(id), [id]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  const p = d.data!;
  const start = async (mode: 'PRACTICE' | 'MOCK_TEST') => {
    setBusy(mode);
    setErr(null);
    try {
      const s = await api.startPastPaper(id, mode);
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy('');
    }
  };
  const asked = Math.ceil((p.durationMinutes * p.questions) / p.questionsInPaper);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={p.title} subtitle={[p.exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG', p.year, when(p)].filter(Boolean).join(' · ')} back={{ to: `/past-papers?exam=${p.exam}`, label: 'Official previous-year papers' }} />
      <p className="-mt-3 mb-4">
        <Badge tone="accent">Official previous-year paper</Badge>
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-rule bg-surface p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-2">Questions</dt>
          <dd className="num mt-0.5 font-medium text-ink">{p.questions}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Time</dt>
          <dd className="num mt-0.5 font-medium text-ink">{asked} minutes</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-ink-2">Marking</dt>
          <dd className="mt-0.5 font-medium text-ink">{marks(p)}</dd>
        </div>
      </dl>
      {p.dropped > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          The exam body dropped {p.dropped} of the paper's {p.questionsInPaper} questions. {p.dropped === 1 ? 'It is' : 'They are'} left out here, and the time is reduced to match.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => void start('MOCK_TEST')} disabled={busy !== ''} icon={<Timer aria-hidden />}>
          {busy === 'MOCK_TEST' ? 'Starting…' : `Attempt under exam conditions (${asked} min)`}
        </Button>
        <Button kind="secondary" onClick={() => void start('PRACTICE')} disabled={busy !== ''}>
          {busy === 'PRACTICE' ? 'Starting…' : 'Practise without a timer'}
        </Button>
      </div>
      {err && <ErrorBox error={err} />}
      <section aria-labelledby="pp-source" className="mt-8 rounded-xl border border-rule bg-surface p-5 text-sm">
        <h2 id="pp-source" className="text-base font-semibold text-ink">
          Source
        </h2>
        <p className="mt-2 text-ink-2">
          Questions: {p.source.title}, {p.source.publisher}.{' '}
          <a href={p.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Open the official paper <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </p>
        {p.answerKey && (
          <p className="mt-1.5 text-ink-2">
            Answers: {p.answerKey.title} (final answer key).{' '}
            <a href={p.answerKey.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Open the official key <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </p>
        )}
        <p className="mt-1.5 text-ink-3">Shown under: {p.permission}.</p>
      </section>
    </div>
  );
}
