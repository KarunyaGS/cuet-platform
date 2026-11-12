import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { AddToPlan, BookmarkButton } from '../tools';
import { Button, Empty, ErrorBox, kindLabel, Loading, PageHeader, useAuth, useLoad } from '../ui';
import { BlockView } from './Learn';

const ORDER = ['DEFINITION', 'FORMULA', 'KEY_POINT', 'IMPORTANT_FACT', 'CALLOUT'];
const FILTERS: { type: string | null; label: string }[] = [
  { type: null, label: 'Everything' },
  { type: 'DEFINITION', label: 'Definitions' },
  { type: 'FORMULA', label: 'Formulas' },
  { type: 'KEY_POINT', label: 'Key points' },
  { type: 'CALLOUT', label: 'Exam tips' },
];

/** Quick revision: the definitions, formulas, key points, facts and exam tips from every lesson under a topic. */
export function RevisePage() {
  const { nodeId = '' } = useParams();
  const r = useLoad(() => api.revision(nodeId), [nodeId]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [only, setOnly] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  const count = d.lessons.reduce((n, l) => n + l.blocks.length, 0);
  const practise = async () => {
    if (!user) return navigate('/signin');
    setStarting(true);
    setErr(null);
    try {
      const s = await api.startPractice({ mode: 'PRACTICE', nodeId, count: 10 });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setStarting(false);
    }
  };
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={
          <>
            Revise: {kindLabel(d.topic.kind, d.topic.label) && <span className="text-zinc-500">{kindLabel(d.topic.kind, d.topic.label)} · </span>}
            {d.topic.title}
          </>
        }
        subtitle={
          <span>
            {d.topic.paper} ·{' '}
            <Link to={`/topic/${d.topic.id}`} className="text-[var(--color-accent)] hover:underline">
              Open the full topic
            </Link>
          </span>
        }
        actions={
          <>
            <BookmarkButton kind="TOPIC" id={d.topic.id} />
            <AddToPlan kind="TOPIC" refId={d.topic.id} title={`Revise: ${d.topic.title}`} />
          </>
        }
      />
      {count === 0 ? (
        <Empty>There are no revision notes for this topic yet. Open the full topic for its lessons and questions.</Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setOnly(f.type)}
                aria-pressed={only === f.type}
                className={`rounded-md px-2.5 py-1 text-sm font-medium ${only === f.type ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="space-y-5">
            {d.lessons.map((l) => {
              const blocks = l.blocks
                .filter((b) => !only || b.type === only || (only === 'KEY_POINT' && b.type === 'IMPORTANT_FACT'))
                .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.position - b.position);
              if (!blocks.length) return null;
              return (
                <section key={l.resourceId}>
                  <h2 className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold">
                    {l.lesson}
                    <Link to={`/learn/${l.resourceId}`} className="shrink-0 text-xs font-normal text-[var(--color-accent)] hover:underline">
                      Full lesson →
                    </Link>
                  </h2>
                  <div className="space-y-2">
                    {blocks.map((b) => (
                      <BlockView key={b.position} b={{ ...b, media_asset_id: null, alt_text: null, caption: null, media_kind: null }} solvedNo={0} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      <div className="mt-6 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
        <span className="text-sm text-zinc-600">Revised? Check yourself with 10 questions.</span>
        <Button onClick={practise} disabled={starting}>
          {starting ? 'Starting…' : 'Practise 10 questions'}
        </Button>
      </div>
      {err && <ErrorBox error={err} />}
    </div>
  );
}
