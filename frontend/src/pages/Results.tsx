import { Link, useParams } from 'react-router';
import { api } from '../api';
import { Badge, ErrorBox, Loading, PageHeader, useLoad } from '../ui';

export function ResultsPage() {
  const { sessionId = '' } = useParams();
  const s = useLoad(() => api.session(sessionId), [sessionId]);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const r = d.session.result;
  if (!r) {
    return (
      <p className="text-sm">
        This session is still in progress.{' '}
        <Link to={`/practice/${sessionId}`} className="text-[var(--color-accent)] underline">
          Continue
        </Link>
      </p>
    );
  }
  const pct = r.maxScore ? Math.round((100 * r.score) / r.maxScore) : 0;
  return (
    <div>
      <PageHeader title="Result" subtitle={`${{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[d.session.mode]} · submitted ${new Date(r.submittedAt).toLocaleString()}`} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Score', `${r.score} / ${r.maxScore}`, pct >= 60 ? 'text-emerald-700' : 'text-zinc-900'],
          ['Percent', `${pct}%`, ''],
          ['Correct', r.correct, 'text-emerald-700'],
          ['Incorrect', r.incorrect, 'text-red-700'],
          ['Skipped', r.unattempted, 'text-zinc-500'],
        ].map(([k, v, c]) => (
          <div key={String(k)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{k}</div>
            <div className={`num text-lg font-semibold ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <h2 className="mb-1.5 text-sm font-semibold">Answer review</h2>
      <ol className="space-y-2">
        {d.questions.map((q) => {
          const rv = q.review!;
          const tone = rv.outcome === 'CORRECT' ? 'green' : rv.outcome === 'INCORRECT' ? 'red' : 'zinc';
          return (
            <li key={q.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="num mt-0.5 w-6 shrink-0 text-xs text-zinc-400">{q.number}.</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-sm">{q.stem}</p>
                  <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {q.options.map((o) => {
                      const right = rv.correctOptionPositions?.includes(o.position);
                      const chosen = q.answer?.selectedPositions?.includes(o.position);
                      return (
                        <li key={o.position} className={`rounded px-2 py-1 text-xs ${right ? 'bg-emerald-50 text-emerald-900' : chosen ? 'bg-red-50 text-red-900' : 'text-zinc-600'}`}>
                          <span className="font-semibold">{o.label}.</span> {o.text}
                          {right && ' ✓'}
                          {chosen && !right && ' (your answer)'}
                        </li>
                      );
                    })}
                  </ul>
                  {rv.explanation && <p className="mt-1.5 whitespace-pre-line rounded bg-zinc-50 px-2 py-1.5 text-xs leading-relaxed text-zinc-700">{rv.explanation}</p>}
                </div>
                <Badge tone={tone}>
                  {rv.outcome.toLowerCase()} {rv.score > 0 ? `+${rv.score}` : rv.score}
                </Badge>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 text-sm">
        <Link to="/progress" className="text-[var(--color-accent)] hover:underline">
          See topic-wise progress and weak topics →
        </Link>
      </div>
    </div>
  );
}
