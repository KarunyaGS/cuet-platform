import { ChevronLeft, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { AddCards, AddToPlan, BookmarkButton, ConceptActions, useConcepts } from '../tools';
import { Empty, ErrorBox, kindLabel, Loading, useLoad } from '../ui';
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
  const [filter, setFilter] = useState<string>('ALL');
  const only = filter === 'ALL' ? null : filter;
  const concepts = useConcepts((r.data?.lessons ?? []).flatMap((l) => l.blocks.map((b) => b.conceptKey)).filter((k): k is string => Boolean(k)));
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  const count = d.lessons.reduce((n, l) => n + l.blocks.length, 0);
  return (
    <div data-revise>
      <header className="mb-4">
        <Link to={`/topic/${d.topic.id}`} className="mb-0.5 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-accent">
          <ChevronLeft aria-hidden className="size-4" />
          Full topic
        </Link>
        <h1 className="text-base leading-snug font-semibold text-ink sm:text-lg lg:text-xl" data-revise-title>
          Quick revision: {d.topic.title}
        </h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {kindLabel(d.topic.kind, d.topic.label) ? `${kindLabel(d.topic.kind, d.topic.label)}, ` : ''}
          {d.topic.paper}. {count} {count === 1 ? 'note' : 'notes'} from {d.lessons.length} {d.lessons.length === 1 ? 'lesson' : 'lessons'}.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-revise-toolbar>
          <div className="flex flex-wrap items-center gap-2" data-revise-actions>
            <BookmarkButton kind="REVISION" id={d.topic.id} />
            <AddToPlan kind="TOPIC" refId={d.topic.id} title={`Revise: ${d.topic.title}`} />
            {count > 0 && <AddCards from={{ nodeId: d.topic.id }} onDone={concepts.reload} />}
          </div>
          {count > 0 && (
            <div role="tablist" aria-label="Show notes of one kind" className="ml-auto flex flex-wrap items-center justify-end gap-0.5" data-revise-filters>
              {FILTERS.map((f) => (
                <button
                  key={f.type}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.type}
                  onClick={() => setFilter(f.type)}
                  className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${filter === f.type ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-ink/5'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {count === 0 ? (
        <Empty icon={<ListChecks />}>There are no revision notes for this topic yet. Open the full topic for its lessons and questions.</Empty>
      ) : (
        <div className="space-y-6">
          {d.lessons.map((l) => {
            const blocks = l.blocks
              .filter((b) => !only || b.type === only || (only === 'KEY_POINT' && b.type === 'IMPORTANT_FACT'))
              .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.position - b.position);
            if (!blocks.length) return null;
            return (
              <section key={l.resourceId}>
                <h2 className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2 text-base font-semibold text-ink">
                  <span className="min-w-0">
                    {l.lesson} <span className="num ml-1 text-sm font-normal text-ink-3">{blocks.length}</span>
                  </span>
                  <Link to={`/learn/${l.resourceId}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
                    Open lesson
                  </Link>
                </h2>
                {/* Two columns on a wide screen: short notes are easy to scan side by side. A note never splits across columns. */}
                <div className="gap-x-6 lg:columns-2" data-revise-notes>
                  {blocks.map((b) => (
                    <div key={b.position} className="mb-3 min-w-0 max-w-full overflow-x-auto break-inside-avoid">
                      <BlockView b={{ ...b, media_asset_id: null, alt_text: null, caption: null, media_kind: null }} solvedNo={0} />
                      {b.conceptKey && <ConceptActions id={b.conceptKey} c={concepts} />}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
