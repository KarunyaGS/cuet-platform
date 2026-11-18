/** Subject-expert sample review: a repeatable sample of questions, checked one by one. Findings only; no question's status changes. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, request } from '../api';
import { when } from '../admin/api';
import { QuestionStem } from '../question';
import { Rich } from '../rich';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SectionTitle, StatGroup, inputClass, useLoad } from '../ui';

interface Result {
  checked: number;
  population: number;
  ok: number;
  withProblem: number;
  wrongAnswer: number;
  weakExplanation: number;
  wrongTopic: number;
  upperBoundAnyProblem: number;
  upperBoundWrongAnswer: number;
  statement: string;
}
interface SampleRow {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  population: number;
  sampleCount: number;
  done: number;
  startedBy: string;
  startedAt: string;
  expertName: string | null;
  completedAt: string | null;
  result: Result | null;
}
interface Question {
  id: string;
  type: string;
  stem: string;
  structure: unknown;
  options: { position: number; label: string; text: string | null }[];
  correctPositions: number[] | null;
  numericAnswer: number | null;
  explanation: string | null;
  optionRationale: Record<string, string> | null;
  topic: string | null;
  verification: string;
}
interface Item {
  position: number;
  unit: string;
  outcome: 'PENDING' | 'CORRECT' | 'NEEDS_CHANGES';
  answerCorrect: boolean | null;
  explanationAccurate: boolean | null;
  topicFits: boolean | null;
  comment: string | null;
  question: Question;
}
interface Detail {
  id: string;
  seed: string;
  method: string;
  status: SampleRow['status'];
  population: number;
  sampleCount: number;
  startedBy: string;
  startedAt: string;
  expertName: string | null;
  expertCredentials: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  result: Result | null;
  items: Item[];
}

const api = {
  list: () => request<{ samples: SampleRow[] }>('GET', '/api/review/sample-reviews'),
  detail: (id: string) => request<Detail>('GET', `/api/review/sample-reviews/${id}`),
  create: (size: number) => request<{ id: string }>('POST', '/api/review/sample-reviews', { size }),
  record: (id: string, q: string, b: { answerCorrect: boolean; explanationAccurate: boolean; topicFits: boolean; comment?: string }) =>
    request<{ outcome: string; pending: number }>('POST', `/api/review/sample-reviews/${id}/items/${q}`, b),
  complete: (id: string, b: { expertName: string; expertCredentials: string }) => request<Result>('POST', `/api/review/sample-reviews/${id}/complete`, { ...b, confirm: true }),
  cancel: (id: string, reason: string) => request<{ cancelled: boolean }>('POST', `/api/review/sample-reviews/${id}/cancel`, { reason }),
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const STATUS = { IN_PROGRESS: ['In progress', 'amber'], COMPLETED: ['Completed', 'green'], CANCELLED: ['Cancelled', 'zinc'] } as const;

const denied = (e: Error) => e instanceof ApiError && (e.status === 403 || e.status === 401);

export function SampleReviewList() {
  const list = useLoad(api.list, []);
  const nav = useNavigate();
  const [size, setSize] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (list.loading) return <Loading />;
  if (list.error) return denied(list.error) ? <Empty>Your account does not have the reviewer role. Ask an administrator to give it to you.</Empty> : <ErrorBox error={list.error} onRetry={list.reload} />;
  return (
    <div>
      <PageHeader
        title="Subject-expert sample review"
        subtitle="A representative sample of questions is drawn and a subject expert checks each one: is the answer right, is the explanation accurate, does it belong to its topic. It is a sample. It never changes a question's status and it is never individual verification of the others."
      />
      <Panel className="mb-8 max-w-2xl p-5">
        <h3 className="mb-2 text-base font-semibold text-ink">Start a sample review</h3>
        <p className="mb-3 text-sm text-ink-2">
          The sample is spread over the syllabus units in proportion to how many questions each has, and the draw is repeatable (its seed is recorded), so nobody picks the questions by hand.
        </p>
        <label className="mb-3 block text-sm text-ink">
          How many questions will the expert check? (10 to 200; about 60 is usual)
          <input className={`${inputClass} mt-1 w-28`} type="number" min={10} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        {error && <div className="mb-3"><ErrorBox error={error} /></div>}
        <Button
          disabled={busy || !Number.isInteger(size) || size < 10 || size > 200}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              nav(`/review/sample/${(await api.create(size)).id}`);
            } catch (e) {
              setError(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          Draw the sample
        </Button>
      </Panel>
      <SectionTitle>Sample reviews</SectionTitle>
      {list.data!.samples.length === 0 ? (
        <Empty>No sample review has been started yet.</Empty>
      ) : (
        <div className="space-y-3">
          {list.data!.samples.map((s) => (
            <Panel key={s.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS[s.status][1]}>{STATUS[s.status][0]}</Badge>
                <Link className="text-sm font-medium text-accent hover:underline" to={`/review/sample/${s.id}`}>
                  {s.sampleCount} of {s.population} questions
                </Link>
                <span className="text-sm text-ink-2">started by {s.startedBy} on {when(s.startedAt)}</span>
              </div>
              {s.status === 'IN_PROGRESS' && <p className="mt-1 text-sm text-ink-2">{s.done} of {s.sampleCount} checked so far.</p>}
              {s.result && <p className="mt-2 text-sm leading-6 text-ink-2">{s.result.statement}</p>}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      <div className="flex gap-2">
        <Button kind={value === true ? 'primary' : 'secondary'} size="sm" onClick={() => onChange(true)}>Yes</Button>
        <Button kind={value === false ? 'danger' : 'secondary'} size="sm" onClick={() => onChange(false)}>No, there is a problem</Button>
      </div>
    </fieldset>
  );
}

export function SampleReviewPage() {
  const { id = '' } = useParams();
  const d = useLoad(() => api.detail(id), [id]);
  const [at, setAt] = useState<number | null>(null);
  const [form, setForm] = useState<{ answerCorrect: boolean | null; explanationAccurate: boolean | null; topicFits: boolean | null; comment: string }>({ answerCorrect: null, explanationAccurate: null, topicFits: null, comment: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [expert, setExpert] = useState({ name: '', credentials: '' });
  const [sure, setSure] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const data = d.data;
  // Start at the first question that has not been checked yet.
  useEffect(() => {
    if (data && at === null) setAt(Math.max(0, data.items.findIndex((i) => i.outcome === 'PENDING')));
  }, [data, at]);
  // Show what was already recorded for the question on screen.
  useEffect(() => {
    const it = data && at !== null ? data.items[at] : null;
    if (it) setForm({ answerCorrect: it.answerCorrect, explanationAccurate: it.explanationAccurate, topicFits: it.topicFits, comment: it.comment ?? '' });
  }, [data, at]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  if (d.loading && !data) return <Loading />;
  if (d.error) return denied(d.error) ? <Empty>Your account does not have the reviewer role.</Empty> : <ErrorBox error={d.error} onRetry={d.reload} />;
  const s = data!;
  const pending = s.items.filter((i) => i.outcome === 'PENDING').length;
  const it = at !== null ? s.items[at] : undefined;
  const q = it?.question;

  return (
    <div>
      <PageHeader
        back={{ to: '/review/sample', label: 'All sample reviews' }}
        title={`Sample review: ${s.sampleCount} of ${s.population} questions`}
        subtitle={`Started by ${s.startedBy} on ${when(s.startedAt)}. Draw seed: ${s.seed}. This is a sample; it does not verify the other questions.`}
        actions={<Badge tone={STATUS[s.status][1]}>{STATUS[s.status][0]}</Badge>}
      />
      {error && <div className="mb-4"><ErrorBox error={error} /></div>}

      {s.status === 'COMPLETED' && s.result && (
        <>
          <div className="mb-4">
            <StatGroup
              items={[
                { label: 'Checked', value: `${s.result.checked} of ${s.result.population}` },
                { label: 'No problem', value: s.result.ok, tone: 'correct' },
                { label: 'With a problem', value: s.result.withProblem, tone: s.result.withProblem ? 'wrong' : 'muted' },
                { label: 'Wrong answer key', value: s.result.wrongAnswer, tone: s.result.wrongAnswer ? 'wrong' : 'muted' },
                { label: 'Likely at most', value: pct(s.result.upperBoundAnyProblem), hint: 'with a problem, 95% confidence' },
              ]}
            />
          </div>
          <Panel className="mb-6 p-5">
            <p className="text-sm leading-6 text-ink">{s.result.statement}</p>
            <p className="mt-2 text-sm text-ink-2">Expert: {s.expertName}, {s.expertCredentials}. Recorded {when(s.completedAt ?? '')}.</p>
          </Panel>
          <SectionTitle>Problems found</SectionTitle>
          {s.items.filter((i) => i.outcome === 'NEEDS_CHANGES').length === 0 ? (
            <Empty>No problem was found in the sample.</Empty>
          ) : (
            <div className="space-y-3">
              {s.items.filter((i) => i.outcome === 'NEEDS_CHANGES').map((i) => (
                <Panel key={i.question.id} className="p-4">
                  <div className="mb-1 flex flex-wrap gap-2">
                    {i.answerCorrect === false && <Badge tone="red">Wrong answer key</Badge>}
                    {i.explanationAccurate === false && <Badge tone="red">Explanation inaccurate</Badge>}
                    {i.topicFits === false && <Badge tone="red">Wrong topic</Badge>}
                    <span className="text-xs text-ink-3">Question {i.position}, {i.unit}</span>
                  </div>
                  <QuestionStem stem={i.question.stem} structure={i.question.structure} compact />
                  <p className="mt-2 text-sm text-ink-2">Expert's note: {i.comment}</p>
                </Panel>
              ))}
              <p className="text-sm text-ink-2">To correct or flag one of these, open it under <Link className="text-accent hover:underline" to="/review/content">Lessons and questions</Link>. Other questions may have the same kind of fault; the sample only shows how common it is.</p>
            </div>
          )}
        </>
      )}

      {s.status === 'CANCELLED' && <Empty>This sample review was cancelled: {s.cancelReason}</Empty>}

      {s.status === 'IN_PROGRESS' && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Questions in the sample">
            {s.items.map((i, k) => (
              <button
                key={i.position}
                type="button"
                onClick={() => setAt(k)}
                className={`size-8 rounded-md border text-xs font-medium ${k === at ? 'border-accent ring-2 ring-accent/40' : 'border-rule'} ${i.outcome === 'PENDING' ? 'bg-surface text-ink-2' : i.outcome === 'CORRECT' ? 'bg-correct-soft text-correct' : 'bg-wrong-soft text-wrong'}`}
                title={`Question ${i.position}: ${i.outcome === 'PENDING' ? 'not checked' : i.outcome === 'CORRECT' ? 'no problem' : 'problem found'}`}
              >
                {i.position}
              </button>
            ))}
          </div>
          <p className="mb-4 text-sm text-ink-2">{s.sampleCount - pending} of {s.sampleCount} checked.</p>

          {it && q && (
            <Panel className="mb-6 max-w-3xl p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span>Question {it.position} of {s.sampleCount}</span>
                <span>Unit: {it.unit}</span>
                {q.topic && <span>Topic: {q.topic}</span>}
              </div>
              <QuestionStem stem={q.stem} structure={q.structure} />
              {q.options.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o) => {
                    const right = q.correctPositions?.includes(o.position);
                    return (
                      <li key={o.position} className={`rounded-lg border px-3 py-2 text-sm ${right ? 'border-correct/40 bg-correct-soft' : 'border-rule'}`}>
                        <span className="mr-2 font-semibold">{o.label}.</span>
                        <Rich text={o.text} inline />
                        {right && <span className="ml-2 text-xs font-semibold text-correct">answer key</span>}
                        {q.optionRationale?.[o.label] && <div className="mt-1 text-[13px] text-ink-2"><Rich text={q.optionRationale[o.label]} inline /></div>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {q.numericAnswer !== null && <p className="mt-3 text-sm text-ink">Answer key: <b>{q.numericAnswer}</b></p>}
              <div className="mt-4 rounded-lg bg-paper px-3 py-3">
                <h4 className="mb-1 text-sm font-semibold text-ink">Explanation given to students</h4>
                <Rich text={q.explanation} className="text-[15px] leading-relaxed text-ink" />
              </div>

              <div className="mt-5 border-t border-rule pt-4">
                <YesNo label="Is the answer key correct?" value={form.answerCorrect} onChange={(v) => setForm({ ...form, answerCorrect: v })} />
                <YesNo label="Is the explanation accurate and clear?" value={form.explanationAccurate} onChange={(v) => setForm({ ...form, explanationAccurate: v })} />
                <YesNo label="Does the question belong under this topic?" value={form.topicFits} onChange={(v) => setForm({ ...form, topicFits: v })} />
                <label className="mb-3 block text-sm text-ink">
                  Note {form.answerCorrect === false || form.explanationAccurate === false || form.topicFits === false ? '(required: say what is wrong)' : '(optional)'}
                  <textarea className={`${inputClass} mt-1 min-h-20`} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || form.answerCorrect === null || form.explanationAccurate === null || form.topicFits === null}
                    onClick={() =>
                      run(async () => {
                        await api.record(s.id, q.id, { answerCorrect: form.answerCorrect!, explanationAccurate: form.explanationAccurate!, topicFits: form.topicFits!, comment: form.comment.trim() || undefined });
                        const next = s.items.findIndex((x, k) => k > (at ?? 0) && x.outcome === 'PENDING');
                        await d.reload();
                        setAt(next >= 0 ? next : at);
                      })
                    }
                  >
                    Save{(at ?? 0) < s.items.length - 1 ? ' and go to the next' : ''}
                  </Button>
                  <Button kind="ghost" disabled={(at ?? 0) === 0} onClick={() => setAt((at ?? 0) - 1)}>Previous</Button>
                  <Button kind="ghost" disabled={(at ?? 0) >= s.items.length - 1} onClick={() => setAt((at ?? 0) + 1)}>Skip</Button>
                </div>
              </div>
            </Panel>
          )}

          <SectionTitle>Finish the review</SectionTitle>
          {pending > 0 ? (
            <Empty>{pending} question{pending === 1 ? '' : 's'} still to check. The review can be completed once every question in the sample has been checked.</Empty>
          ) : (
            <Panel className="mb-6 max-w-2xl p-5">
              <p className="mb-3 text-sm text-ink-2">Name the subject expert who did the checking, and their credentials. This is recorded with the result.</p>
              <label className="mb-3 block text-sm text-ink">
                Expert's name
                <input className={`${inputClass} mt-1`} value={expert.name} onChange={(e) => setExpert({ ...expert, name: e.target.value })} />
              </label>
              <label className="mb-3 block text-sm text-ink">
                Credentials (for example: subject, degree, years of teaching)
                <input className={`${inputClass} mt-1`} value={expert.credentials} onChange={(e) => setExpert({ ...expert, credentials: e.target.value })} />
              </label>
              <label className="mb-4 flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" className="mt-1" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                <span>These findings are the expert's own. I understand this is a sample review and not verification of every question.</span>
              </label>
              <Button
                disabled={busy || !sure || expert.name.trim().length < 2 || expert.credentials.trim().length < 5}
                onClick={() => run(async () => { await api.complete(s.id, { expertName: expert.name.trim(), expertCredentials: expert.credentials.trim() }); await d.reload(); })}
              >
                Complete the sample review
              </Button>
            </Panel>
          )}

          <div className="mt-8 max-w-xl">
            {cancelling ? (
              <>
                <label className="block text-sm text-ink">
                  Why is this sample review being cancelled?
                  <input className={`${inputClass} mt-1`} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </label>
                <div className="mt-2 flex gap-2">
                  <Button kind="danger" size="sm" disabled={busy || cancelReason.trim().length < 5} onClick={() => run(async () => { await api.cancel(s.id, cancelReason.trim()); await d.reload(); })}>Cancel the sample review</Button>
                  <Button kind="ghost" size="sm" onClick={() => setCancelling(false)}>Keep it</Button>
                </div>
              </>
            ) : (
              <Button kind="ghost" size="sm" onClick={() => setCancelling(true)}>Cancel this sample review</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
