import { ChevronDown, ChevronLeft, ListChecks } from 'lucide-react';
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
  const [showAllNotes, setShowAllNotes] = useState(false);
  const only = filter === 'ALL' ? null : filter;
  const concepts = useConcepts((r.data?.lessons ?? []).flatMap((l) => l.blocks.map((b) => b.conceptKey)).filter((k): k is string => Boolean(k)));
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  const revisionLessons = d.lessons.map((lesson) => ({
    ...lesson,
    blocks: lesson.blocks
      .filter((block) => block.type !== 'OFFICIAL_TEXT' && (!only || block.type === only || (only === 'KEY_POINT' && block.type === 'IMPORTANT_FACT')))
      .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.position - b.position),
  })).filter((lesson) => lesson.blocks.length > 0);
  const filteredCount = revisionLessons.reduce((sum, lesson) => sum + lesson.blocks.length, 0);
  const count = d.lessons.reduce((n, l) => n + l.blocks.filter((b) => b.type !== 'OFFICIAL_TEXT').length, 0);
  let remaining = showAllNotes ? filteredCount : Math.min(6, filteredCount);
  return (
    <div className="mx-0 w-full max-w-none" data-revise>
      <header className="mb-5 grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto]" data-revise-header>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-1.5">
            <Link to={`/topic/${d.topic.id}`} aria-label={`Back to ${d.topic.title}`} title={`Back to ${d.topic.title}`} className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent">
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <h1 className="min-w-0 text-[22px] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[25px]" data-revise-title>
              Quick revision <span className="font-normal text-ink-3">/</span> {d.topic.title}
            </h1>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            {kindLabel(d.topic.kind, d.topic.label) ? `${kindLabel(d.topic.kind, d.topic.label)} · ` : ''}
            {d.topic.paper} <span className="mx-1 text-ink-3">·</span> {count} {count === 1 ? 'note' : 'notes'} from {d.lessons.length} {d.lessons.length === 1 ? 'lesson' : 'lessons'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end" data-revise-actions>
          <BookmarkButton kind="REVISION" id={d.topic.id} />
          <AddToPlan kind="TOPIC" refId={d.topic.id} title={`Revise: ${d.topic.title}`} />
          {count > 0 && <AddCards from={{ nodeId: d.topic.id }} onDone={concepts.reload} />}
        </div>
        {count > 0 && (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-rule bg-surface/75 p-2 lg:col-span-2" data-revise-toolbar>
            <span className="px-2 text-[11px] font-semibold text-ink-2">Filter notes</span>
            <div role="tablist" aria-label="Show notes of one kind" className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1" data-revise-filters>
              {FILTERS.map((f) => (
                <button key={f.type} type="button" role="tab" aria-selected={filter === f.type} onClick={() => { setFilter(f.type); setShowAllNotes(false); }} className={`min-h-9 rounded-lg px-3 text-[12px] transition-colors ${filter === f.type ? 'bg-forest font-semibold text-lime shadow-sm' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      {count === 0 ? (
        <Empty icon={<ListChecks />}>There are no revision notes for this topic yet. Open the full topic for its lessons and questions.</Empty>
      ) : filteredCount === 0 ? (
        <Empty icon={<ListChecks />}>No notes match this filter.</Empty>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2" data-revise-note-count>
            <p className="text-[11px] text-ink-3">Showing {showAllNotes ? filteredCount : Math.min(6, filteredCount)} of {filteredCount} {filteredCount === 1 ? 'note' : 'notes'}</p>
            {filteredCount > 6 && <button type="button" aria-expanded={showAllNotes} onClick={() => setShowAllNotes((value) => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-forest transition-colors hover:bg-sage/50">{showAllNotes ? 'Show fewer' : 'Show all notes'}<ChevronDown aria-hidden className={`size-4 transition-transform ${showAllNotes ? 'rotate-180' : ''}`} /></button>}
          </div>
          {revisionLessons.map((l) => {
            const blocks = l.blocks.slice(0, remaining);
            remaining -= blocks.length;
            if (!blocks.length) return null;
            return (
              <section key={l.resourceId}>
                <h2 className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2 text-[14px] font-semibold text-ink">
                  <span className="min-w-0">
                    <span className="line-clamp-1">{l.lesson}</span> <span className="num ml-1 text-[11px] font-normal text-ink-3">{l.blocks.length} notes</span>
                  </span>
                  <Link to={`/learn/${l.resourceId}`} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent-soft">
                    Open lesson
                  </Link>
                </h2>
                <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2" data-revise-notes>
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
