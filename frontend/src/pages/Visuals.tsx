import { ChevronLeft, Copy, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, type VisualItem } from '../api';
import { Figure } from '../question';
import { Badge, Button, Empty, ErrorBox, kindLabel, Loading, useLoad } from '../ui';
import { TableBlock } from './Learn';

const FILTERS: { id: 'ALL' | 'DIAGRAM' | 'TABLE'; label: string }[] = [
  { id: 'ALL', label: 'Everything' },
  { id: 'DIAGRAM', label: 'Diagrams' },
  { id: 'TABLE', label: 'Tables' },
];

/** A table as tab-separated text, for pasting into notes or a spreadsheet. */
const tableText = (t: { columns: string[]; rows: string[][] }) => [t.columns, ...t.rows].map((r) => r.join('\t')).join('\n');

function CopyTable({ item }: { item: Extract<VisualItem, { kind: 'TABLE' }> }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      kind="secondary"
      size="sm"
      icon={<Copy aria-hidden />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(tableText(item.table));
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* the browser refused clipboard access; nothing else to do */
        }
      }}
    >
      {done ? 'Copied' : 'Copy table'}
    </Button>
  );
}

/**
 * Diagrams and tables for a chapter or topic: every figure and table from its lessons on one page, to look at again before a test.
 * The content is the lessons' own, so it carries the lessons' review state; nothing here is marked as verified unless the lesson is.
 */
export function VisualsPage() {
  const { nodeId = '' } = useParams();
  const r = useLoad(() => api.visuals(nodeId), [nodeId]);
  const [filter, setFilter] = useState<'ALL' | 'DIAGRAM' | 'TABLE'>('ALL');
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  const shown = d.items.filter((i) => filter === 'ALL' || i.kind === filter);
  const lessons = [...new Set(shown.map((i) => i.lessonId))].map((id) => ({ id, title: shown.find((i) => i.lessonId === id)!.lesson, verified: shown.filter((i) => i.lessonId === id).every((i) => i.verified), items: shown.filter((i) => i.lessonId === id) }));
  const allVerified = d.items.length > 0 && d.items.every((i) => i.verified);
  return (
    <div className="w-full min-w-0" data-visuals data-print-sheet>
      <header className="mb-4">
        <div className="flex min-w-0 items-start gap-1.5">
          <Link to={`/topic/${d.topic.id}`} aria-label={`Back to ${d.topic.title}`} title={`Back to ${d.topic.title}`} className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent" data-no-print>
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="text-base leading-snug font-semibold text-ink sm:text-lg lg:text-xl">Diagrams and tables: {d.topic.title}</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-2">
          {kindLabel(d.topic.kind, d.topic.label) ? `${kindLabel(d.topic.kind, d.topic.label)}, ` : ''}
          {d.topic.paper}. {d.counts.diagrams} {d.counts.diagrams === 1 ? 'diagram' : 'diagrams'} and {d.counts.tables} {d.counts.tables === 1 ? 'table' : 'tables'}.
          {!allVerified && d.items.length > 0 && (
            <>
              {' '}
              <Badge tone="amber" title="These figures and tables come from lessons that a subject expert has not yet reviewed.">
                Draft - unverified
              </Badge>
            </>
          )}
        </p>
        {d.items.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-no-print>
            <div role="tablist" aria-label="Show diagrams or tables" className="flex flex-wrap items-center gap-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`h-8 rounded-lg px-3 text-[13px] font-medium ${filter === f.id ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-ink/5'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button kind="secondary" size="sm" icon={<Printer aria-hidden />} onClick={() => window.print()}>
              Print this page
            </Button>
          </div>
        )}
      </header>

      {d.items.length === 0 ? (
        <Empty>No diagrams or tables have been added to the lessons of this topic yet.</Empty>
      ) : (
        <div className="space-y-8">
          {lessons.map((l) => (
            <section key={l.id} aria-labelledby={`vl-${l.id}`}>
              <h2 id={`vl-${l.id}`} className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[15px] font-semibold text-ink">
                <span>{l.title}</span>
                <Link to={`/learn/${l.id}`} className="text-[13px] font-medium text-accent hover:underline" data-no-print>
                  Open lesson
                </Link>
              </h2>
              <div className="space-y-5">
                {l.items.map((it) =>
                  it.kind === 'DIAGRAM' ? (
                    <figure key={`${l.id}-${it.position}`} className="rounded-xl border border-rule bg-surface p-3" data-visual="diagram">
                      {it.mediaAssetId && <Figure id={it.mediaAssetId} alt={it.alt} className="w-full border-0 p-0" />}
                      {it.caption && <figcaption className="mt-2 text-center text-sm font-medium text-ink">{it.caption}</figcaption>}
                      {it.learn && (
                        <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink">
                          <strong className="font-semibold">What to learn: </strong>
                          {it.learn}
                        </p>
                      )}
                      {!it.learn && it.description && <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">{it.description}</p>}
                    </figure>
                  ) : (
                    <div key={`${l.id}-${it.position}`} data-visual="table">
                      <TableBlock body={JSON.stringify(it.table)} />
                      <div className="mt-1.5 flex justify-end" data-no-print>
                        <CopyTable item={it} />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
