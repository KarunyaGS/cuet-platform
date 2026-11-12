import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { AddToPlan, BookmarkButton } from '../tools';
import { Button, Empty, ErrorBox, kindLabel, Loading, PageHeader, Segmented, useAuth, useLoad } from '../ui';
import { BlockView } from './Learn';

const ORDER = ['DEFINITION', 'FORMULA', 'KEY_POINT', 'IMPORTANT_FACT', 'CALLOUT'];
const FILTERS: { type: string; label: string }[] = [
  { type: 'ALL', label: 'Everything' },
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
  const [filter, setFilter] = useState<string>('ALL');
  const only = filter === 'ALL' ? null : filter;
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
    <div className="max-w-[44rem]">
      <PageHeader
        back={{ to: `/topic/${d.topic.id}`, label: 'Full topic' }}
        title={<>Quick revision: {d.topic.title}</>}
        subtitle={
          <span>
            {kindLabel(d.topic.kind, d.topic.label) ? `${kindLabel(d.topic.kind, d.topic.label)}, ` : ''}
            {d.topic.paper}. {count} {count === 1 ? 'note' : 'notes'} from {d.lessons.length} {d.lessons.length === 1 ? 'lesson' : 'lessons'}.
          </span>
        }
        actions={
          <>
            <BookmarkButton kind="REVISION" id={d.topic.id} />
            <AddToPlan kind="TOPIC" refId={d.topic.id} title={`Revise: ${d.topic.title}`} />
          </>
        }
      />
      {count === 0 ? (
        <Empty icon={<ListChecks />}>There are no revision notes for this topic yet. Open the full topic for its lessons and questions.</Empty>
      ) : (
        <>
          <div className="mb-6">
            <Segmented label="Show notes of one kind" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.type, label: f.label }))} />
          </div>
          <div className="space-y-10">
            {d.lessons.map((l) => {
              const blocks = l.blocks
                .filter((b) => !only || b.type === only || (only === 'KEY_POINT' && b.type === 'IMPORTANT_FACT'))
                .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.position - b.position);
              if (!blocks.length) return null;
              return (
                <section key={l.resourceId}>
                  <h2 className="mb-3 flex items-baseline justify-between gap-3 text-base font-semibold text-ink">
                    {l.lesson}
                    <Link to={`/learn/${l.resourceId}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
                      Open lesson
                    </Link>
                  </h2>
                  <div className="space-y-3">
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
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-surface p-5">
        <span>
          <span className="block font-semibold text-ink">Revised?</span>
          <span className="block text-sm text-ink-2">Check yourself with 10 questions on this topic.</span>
        </span>
        <Button onClick={practise} disabled={starting}>
          {starting ? 'Starting…' : 'Practise 10 questions'}
        </Button>
      </div>
      {err && <ErrorBox error={err} />}
    </div>
  );
}
