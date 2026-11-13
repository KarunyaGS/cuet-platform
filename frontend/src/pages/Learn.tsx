import { BookMarked, ChevronDown, ChevronLeft, Lightbulb, ListChecks, Sigma, Target } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api, type Block } from '../api';
import { DisplayMath, parseBody, Rich } from '../rich';
import { Annotatable, blockKey } from '../annotate';
import { SavedForRevision } from '../revision';
import { AddCards, AddToPlan, BookmarkButton, ConceptActions, useConcepts, useTrackView } from '../tools';
import { Button, ErrorBox, Loading, useAuth, useLoad } from '../ui';

/**
 * Lesson blocks. Colour is used for meaning only: blue = definitions and concepts, green = what to remember,
 * amber = exam tips and examples. Everything else stays on the page, not in a box.
 */
const tone: Record<string, { label: string; rule: string; icon: ReactNode }> = {
  CONCEPT: { label: 'Concept', rule: 'border-accent', icon: <Lightbulb /> },
  KEY_POINT: { label: 'Key point', rule: 'border-correct', icon: <Target /> },
  IMPORTANT_FACT: { label: 'Remember', rule: 'border-correct', icon: <Target /> },
  EXAMPLE: { label: 'Example', rule: 'border-marker', icon: <ListChecks /> },
  CALLOUT: { label: 'Exam tip', rule: 'border-marker', icon: <Lightbulb /> },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Callout({ label, rule, icon, children }: { label: string; rule: string; icon: ReactNode; children: ReactNode }) {
  return (
    <aside className={`rounded-r-lg border-l-[3px] bg-surface py-3 pr-4 pl-4 ${rule}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 [&>svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="text-[15px] leading-relaxed text-ink">{children}</div>
    </aside>
  );
}

function TableBlock({ body }: { body: string }) {
  const j = parseBody<{ caption?: string | null; columns: string[]; rows: string[][] } | string[][]>(body);
  if (!j) return <Rich text={body} />;
  const columns = Array.isArray(j) ? (j[0] ?? []) : j.columns;
  const rows = Array.isArray(j) ? j.slice(1) : j.rows;
  const caption = Array.isArray(j) ? null : j.caption;
  return (
    <figure className="overflow-x-auto rounded-lg border border-rule bg-surface font-sans">
      {caption && <figcaption className="border-b border-rule px-4 py-2 text-[13px] font-medium text-ink-2">{caption}</figcaption>}
      <table className="w-full text-left text-sm">
        <thead className="bg-paper">
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className="px-4 py-2 font-semibold text-ink">
                <Rich text={c} inline />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, k) => (
                <td key={k} className="px-4 py-2 text-ink">
                  <Rich text={c} inline />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Solved({ body, n }: { body: string; n: number }) {
  const [open, setOpen] = useState(false);
  const j = parseBody<{ problem: string; solution: string; answer: string }>(body);
  if (!j)
    return (
      <Callout label="Solved problem" rule="border-marker" icon={<ListChecks />}>
        <Rich text={body} />
      </Callout>
    );
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-surface font-sans">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-marker-soft text-xs font-semibold text-marker" aria-label={`Worked problem ${n}`}>
          {n}
        </span>
        <div className="min-w-0 flex-1 text-[15px] text-ink">
          <Rich text={j.problem} />
        </div>
      </div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-1.5 border-t border-rule px-4 py-2 text-left text-sm font-medium text-accent hover:bg-paper">
        <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide worked solution' : 'Show worked solution'}
      </button>
      {open && (
        <div className="space-y-3 border-t border-rule bg-paper px-4 py-3 text-[15px] text-ink">
          <Rich text={j.solution} />
          <div className="rounded-md border border-correct/30 bg-correct-soft px-3 py-2">
            <span className="font-semibold text-correct">Answer: </span>
            <Rich text={j.answer} inline />
          </div>
        </div>
      )}
    </div>
  );
}

export function BlockView({ b, solvedNo }: { b: Block; solvedNo: number }) {
  switch (b.type) {
    case 'HEADING':
      return (
        <h2 id={slug(b.body)} className="scroll-mt-24 pt-4 font-sans text-xl font-semibold text-ink">
          {b.body}
        </h2>
      );
    case 'TEXT':
      return <Rich text={b.body} className="prose-lesson text-ink" />;
    case 'TABLE':
      return <TableBlock body={b.body} />;
    case 'SOLVED_PROBLEM':
      return <Solved body={b.body} n={solvedNo} />;
    case 'DEFINITION': {
      const j = parseBody<{ term: string; text: string }>(b.body);
      return (
        <Callout label="Definition" rule="border-accent" icon={<BookMarked />}>
          {j ? <Rich text={`**${j.term}**: ${j.text}`} /> : <Rich text={b.body} />}
        </Callout>
      );
    }
    case 'FORMULA': {
      const j = parseBody<{ latex: string; text: string | null }>(b.body);
      return (
        <figure className="rounded-lg border border-rule bg-surface px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
            <Sigma aria-hidden className="size-3.5" />
            Formula
          </div>
          {j ? <DisplayMath tex={j.latex} /> : <pre className="font-mono text-sm whitespace-pre-wrap">{b.body}</pre>}
          {j?.text && <Rich text={j.text} className="mt-1 text-sm text-ink-2" />}
        </figure>
      );
    }
    case 'DIAGRAM':
    case 'IMAGE': {
      const src = b.media_asset_id ? `/api/learn/media/${b.media_asset_id}` : b.body;
      return (
        <figure className="rounded-lg border border-rule bg-surface p-3">
          <img src={src} alt={b.alt_text ?? ''} loading="lazy" className="mx-auto max-h-[28rem] w-full object-contain" />
          {(b.caption ?? (b.media_asset_id ? b.body : '')) && <figcaption className="mt-2 text-center font-sans text-[13px] text-ink-2">{b.caption ?? (b.media_asset_id ? b.body : '')}</figcaption>}
        </figure>
      );
    }
    case 'OFFICIAL_TEXT': {
      const j = parseBody<{ text: string; page: number | null; paper: string }>(b.body);
      return (
        <blockquote className="border-l-2 border-rule-strong py-1 pl-4">
          <div className="mb-0.5 text-[13px] font-medium text-ink-2">Official syllabus{j?.page ? `, page ${j.page}` : ''}</div>
          <p className="font-serif text-[15px] text-ink">{j ? j.text : b.body}</p>
        </blockquote>
      );
    }
    default: {
      const t = tone[b.type] ?? { label: b.type, rule: 'border-rule-strong', icon: <Lightbulb /> };
      return (
        <Callout label={t.label} rule={t.rule} icon={t.icon}>
          <Rich text={b.body} />
        </Callout>
      );
    }
  }
}

/** Highlights the table-of-contents entry for the section being read. */
function useCurrentHeading(ids: string[]) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (!ids.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);
  return current;
}

export function LearnPage() {
  const { resourceId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const r = useLoad(() => api.resource(resourceId), [resourceId]);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  useTrackView('LESSON_VIEW', r.data ? resourceId : null);
  const toc = useMemo(() => (r.data?.blocks ?? []).filter((b) => b.type === 'HEADING').map((b) => b.body), [r.data]);
  const conceptKeys = useMemo(() => (r.data?.blocks ?? []).map((b) => b.conceptKey).filter((k): k is string => Boolean(k)), [r.data]);
  const concepts = useConcepts(conceptKeys);
  // Arriving from a flashcard, a bookmark or search: go to that concept and mark it for a moment.
  const { hash } = useLocation();
  const wanted = hash.startsWith('#c-') ? hash.slice(1) : null;
  const found = wanted ? (r.data?.blocks ?? []).some((b) => b.anchor === wanted) : false;
  useEffect(() => {
    if (!found || !wanted) return;
    const el = document.getElementById(wanted);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.setAttribute('data-arrived', '');
    const t = setTimeout(() => el.removeAttribute('data-arrived'), 2500);
    return () => clearTimeout(t);
  }, [found, wanted]);
  const tocIds = useMemo(() => toc.map(slug), [toc]);
  const current = useCurrentHeading(tocIds);
  const minutes = useMemo(() => {
    const words = (r.data?.blocks ?? []).reduce((n, b) => n + b.body.split(/\s+/).length, 0);
    return Math.max(1, Math.round(words / 180));
  }, [r.data]);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  let solved = 0;
  const practise = async () => {
    if (!d.topic) return;
    if (!user) return navigate('/signin');
    setStarting(true);
    setErr(null);
    try {
      const s = await api.startPractice({ mode: 'PRACTICE', nodeId: d.topic.id, count: 10 });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setStarting(false);
    }
  };
  const seenKeys = new Map<string, number>();
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,50rem)_minmax(0,20rem)] lg:justify-center xl:gap-x-14" data-lesson-layout>
      {/* The title first on every screen; on a wide screen it spans the text and the side rail. */}
      <header className="border-b border-rule pb-4 lg:col-span-2" data-lesson-header>
          {d.topic && (
            <Link to={`/topic/${d.topic.id}`} className="inline-flex max-w-full items-center gap-1 text-sm text-ink-2 hover:text-accent">
              <ChevronLeft aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{d.topic.title}</span>
            </Link>
          )}
          <h1 className="mt-2 text-[1.75rem] leading-tight font-semibold text-ink">{d.resource.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="num text-sm text-ink-3">Lesson, about {minutes} min read</span>
            <span className="flex flex-wrap gap-2 sm:ml-auto">
              <BookmarkButton kind="LESSON" id={d.resource.id} />
              <AddToPlan kind="LESSON" refId={d.resource.id} title={d.resource.title} />
              {conceptKeys.length > 0 && <AddCards from={{ resourceId: d.resource.id }} onDone={concepts.reload} />}
            </span>
          </div>
      </header>
      {/* The side column: saved cards and the contents list. On a phone it sits between the title and the text. */}
      <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-2 lg:self-start" data-lesson-rail>
        {conceptKeys.length > 0 && <SavedForRevision scope={{ resourceId: d.resource.id }} version={concepts.saved.size} />}
      {toc.length > 0 && (
        <nav aria-label="On this page" className="hidden lg:block">
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">On this page</div>
            <ol className="space-y-0.5 border-l border-rule text-sm">
              {toc.map((h, i) => {
                const on = current === tocIds[i];
                return (
                  <li key={h}>
                    <a href={`#${tocIds[i]}`} aria-current={on ? 'location' : undefined} className={`-ml-px block border-l-2 py-1 pl-3 transition-colors ${on ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`}>
                      {h}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>
      )}
      </aside>
      <article className="min-w-0 lg:col-start-1 lg:row-start-2">
        {wanted && !found && (
          <p role="status" className="mb-6 rounded-lg border border-marker/30 bg-marker-soft px-4 py-3 text-sm text-ink">
            The concept you saved has been updated in this lesson since then. The lesson below shows how it reads now.
          </p>
        )}
        <Annotatable kind="LESSON" id={d.resource.id}>
          <div className="space-y-5">
            {d.blocks.map((b) => {
              if (b.type === 'SOLVED_PROBLEM') solved++;
              // Each block carries a key made from its own content, so a highlight or a drawing stays with it.
              const k = blockKey(b.type, b.body, seenKeys);
              if (b.conceptKey && b.anchor)
                return (
                  <div key={b.position} id={b.anchor} className="scroll-mt-24 rounded-lg transition-shadow duration-700 data-[arrived]:shadow-[0_0_0_3px_var(--color-accent)]">
                    <div data-annot-block={k}>
                      <BlockView b={b} solvedNo={solved} />
                    </div>
                    <ConceptActions id={b.conceptKey} c={concepts} />
                  </div>
                );
              return (
                <div key={b.position} data-annot-block={k}>
                  <BlockView b={b} solvedNo={solved} />
                </div>
              );
            })}
          </div>
        </Annotatable>
        {d.topic && (
          <div className="mt-10 rounded-xl border border-rule bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-ink">Finished reading?</div>
                <div className="text-sm text-ink-2">Check what you learnt with 10 questions on this topic.</div>
              </div>
              <Button onClick={practise} disabled={starting}>
                {starting ? 'Starting…' : 'Practise 10 questions'}
              </Button>
            </div>
            {err && <ErrorBox error={err} />}
          </div>
        )}
      </article>
    </div>
  );
}
