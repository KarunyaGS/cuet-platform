import { ArrowUpRight, ChevronRight, FileText, ListChecks, Shapes, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, type OutlineNode } from '../api';
import { NotFoundPage } from './Search';
import { Button, Empty, ErrorBox, kindLabel, Loading, useAuth, useLoad } from '../ui';
import { SubjectCards } from '../tools';
import { AreaCards } from './SubjectArea';

/** Subject page: units on the left, the selected unit's topics and subtopics on the right. */
export function SubjectSyllabusPage() {
  const { paperId = '', exam = 'CUET_UG' } = useParams();
  const outline = useLoad(() => api.outline(paperId), [paperId]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unitId, setUnitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const { roots, childrenOf } = useMemo(() => {
    const nodes = outline.data?.nodes ?? [];
    const childrenOf = new Map<string | null, OutlineNode[]>();
    for (const n of nodes) childrenOf.set(n.parent_id, [...(childrenOf.get(n.parent_id) ?? []), n]);
    for (const list of childrenOf.values()) list.sort((a, b) => a.position - b.position);
    return { roots: childrenOf.get(null) ?? [], childrenOf };
  }, [outline.data]);
  // The syllabus itself, without the "Note" box (question-paper instructions). A NOTE row with nothing under it is a
  // cover-page title picked up by extraction, so it is not shown.
  const contentRoots = roots.filter((r) => r.kind !== 'NOTE');
  const notes = roots.filter((r) => r.kind === 'NOTE' && (childrenOf.get(r.id) ?? []).length > 0);
  // Many official syllabi list topics directly with no units: show those as one list, not as "units".
  const flat = contentRoots.length > 0 && contentRoots.every((r) => !(childrenOf.get(r.id) ?? []).length);
  const groupWord = contentRoots.some((r) => r.kind === 'UNIT' || r.kind === 'CHAPTER') ? 'Units' : contentRoots.some((r) => ['PART', 'SECTION', 'COURSE'].includes(r.kind)) ? 'Sections' : 'Topics';
  const activeId = unitId ?? contentRoots[0]?.id ?? null;
  const active = contentRoots.find((r) => r.id === activeId);
  const testWord = active && (active.kind === 'UNIT' || active.kind === 'CHAPTER') ? 'Unit test' : active && ['PART', 'SECTION', 'COURSE'].includes(active.kind) ? 'Section test' : 'Topic test';
  const countQuestions = (id: string): number => (childrenOf.get(id) ?? []).reduce((n, c) => n + c.questions + countQuestions(c.id), 0);

  const startMock = async (unit?: string) => {
    if (!user) return navigate('/signin');
    setBusy(true);
    setErr(null);
    try {
      const s = await api.startPractice(unit ? { mode: 'TOPIC_TEST', nodeId: unit } : { mode: 'MOCK_TEST', paperId });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };

  if (exam !== 'CUET_UG') return <NotFoundPage />;
  if (outline.loading) return <Loading />;
  if (outline.error instanceof ApiError && outline.error.status === 404) return <NotFoundPage />;
  if (outline.error) return <ErrorBox error={outline.error} onRetry={outline.reload} />;
  const p = outline.data!.paper;
  const examName = exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG';
  const unitQuestions = active ? countQuestions(active.id) + active.questions : 0;
  return (
    <div data-subject-syllabus>
      <header data-subject-hero className="relative mb-5 overflow-hidden rounded-[22px] border border-[#dce4cd] bg-gradient-to-br from-[#e8eedc] via-[#f7f4e9] to-[#f4e3d8] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-3xl">
            <Link to={`/${exam}`} className="label mb-4 inline-flex items-center gap-2 text-[10px] text-terracotta hover:underline"><ChevronRight aria-hidden className="size-3 rotate-180" />{examName} · ALL SUBJECTS</Link>
            <h1 className="text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.02] font-bold tracking-[-0.045em] text-charcoal">{String(p.name)}<span className="font-editorial font-medium tracking-[-0.03em] text-terracotta italic">. Find your way.</span></h1>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{p.source_url ? <a href={String(p.source_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-forest hover:text-terracotta"><FileText aria-hidden className="size-4" />Official NTA syllabus · {String(p.page_count)} pages <ArrowUpRight className="size-3.5" /></a> : 'The official syllabus PDF is not yet available.'}</p>
            <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-forest">{String(p.code)}</span><span className="rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-forest">{String(p.question_count ?? '—')} questions</span><span className="rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-forest">{String(p.duration_minutes ?? '—')} min</span></div>
          </div>
          <div className="relative z-10">
            <Button onClick={() => startMock()} disabled={busy || !p.version_id} icon={<Timer aria-hidden />} className="!h-11 !rounded-xl !bg-forest !px-4 !text-lime !shadow-[0_10px_24px_rgb(24_68_59/0.2)] hover:!bg-forest-deep">
              {busy ? 'Starting…' : 'Start full mock'}
            </Button>
          </div>
        </div>
      </header>
      {err && <ErrorBox error={err} />}
      <p data-sheet-links className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
        <Link to={`/sheets/subject/${paperId}`} className="text-accent hover:underline">Last-day revision sheet (3 pages)</Link>
        <Link to={`/sheets/weak?paperId=${paperId}`} className="text-accent hover:underline">My weak-topic sheet</Link>
      </p>
      <AreaCards exam={exam} paperId={paperId} />
      <SubjectCards paperId={paperId} />
      {p.name === 'Physics' && (
        <section aria-labelledby="visual-learning" data-visual-entry className="mb-6 overflow-hidden rounded-xl border border-rule bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3">
            <h2 id="visual-learning" className="text-base font-semibold text-ink">
              Visual learning
            </h2>
            <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">Prototype</span>
            <span className="text-sm text-ink-2">One topic to try: Gravitation (a Class 11 topic, not in this syllabus)</span>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {[
              ['/visual/gravitation', 'Visual explanation'],
              ['/visual/gravitation?view=map', 'Mind map'],
              ['/visual/gravitation?view=flow', 'Flowchart'],
              ['/visual/gravitation?view=read', 'Read the notes'],
            ].map(([to, label]) => (
              <Link key={to} to={to!} className="inline-flex h-9 items-center rounded-lg bg-surface px-3 text-sm font-medium text-accent ring-1 ring-inset ring-rule-strong hover:bg-accent-soft">
                {label}
              </Link>
            ))}
            <a href="/visual/gravitation.pdf" download="Prepora - Gravitation - learning notes.pdf" className="inline-flex h-9 items-center rounded-lg bg-surface px-3 text-sm font-medium text-accent ring-1 ring-inset ring-rule-strong hover:bg-accent-soft">
              Download PDF
            </a>
          </div>
        </section>
      )}
      {notes.length > 0 && (
        <details className="mb-6 rounded-xl border border-rule bg-surface">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink-2 hover:text-ink">About the question paper</summary>
          <ul className="list-disc space-y-1 px-10 pb-4 text-sm text-ink-2">
            {notes.flatMap((n) => childrenOf.get(n.id) ?? []).map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </details>
      )}
      {contentRoots.length === 0 ? (
        <Empty>The syllabus topics for this paper are still being checked. Please come back soon.</Empty>
      ) : flat ? (
        <section className="overflow-hidden rounded-xl border border-rule bg-surface" aria-labelledby="flat-title">
          <div className="border-b border-rule px-5 py-4">
            <h2 id="flat-title" className="text-lg font-semibold text-ink">
              Syllabus
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">
              The official syllabus lists {contentRoots.length} {groupWord === 'Topics' ? (contentRoots.length === 1 ? 'topic' : 'topics') : contentRoots.length === 1 ? groupWord.toLowerCase().slice(0, -1) : groupWord.toLowerCase()}
              {groupWord === 'Topics' ? ' directly, without units' : ', with no further topics under them'}.
            </p>
          </div>
          <Tree nodes={contentRoots} childrenOf={childrenOf} />
        </section>
      ) : roots.length === 0 ? (
        <Empty>The syllabus for this paper is still being checked. Please come back soon.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label={groupWord} className="md:sticky md:top-20 md:self-start">
            <h2 className="mb-2 px-3 text-sm font-medium text-ink-2">{groupWord}</h2>
            <ul className="space-y-0.5">
              {contentRoots.map((r) => {
                const on = r.id === activeId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setUnitId(r.id)}
                      aria-current={on ? 'true' : undefined}
                      className={`w-full rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors ${on ? 'border-accent bg-accent-soft text-ink' : 'border-transparent text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
                    >
                      {kindLabel(r.kind, r.label) && <span className={`block text-xs ${on ? 'text-accent' : 'text-ink-3'}`}>{kindLabel(r.kind, r.label)}</span>}
                      <span className={`line-clamp-2 ${on ? 'font-medium' : ''}`}>{r.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <section className="min-w-0 overflow-hidden rounded-xl border border-rule bg-surface" aria-label="Topics in this unit">
            {active && (
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                <div className="min-w-0">
                  {kindLabel(active.kind, active.label) && <div className="text-sm text-ink-3">{kindLabel(active.kind, active.label)}</div>}
                  <Link to={`/topic/${active.id}`} className="text-lg font-semibold text-ink hover:text-accent">
                    {active.title}
                  </Link>
                  <div className="num mt-1 text-sm text-ink-3">
                    Syllabus page {active.source_page}, {unitQuestions} {unitQuestions === 1 ? 'question' : 'questions'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/revise/${active.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-ink/5 hover:text-ink">
                    <ListChecks aria-hidden className="size-4" />
                    Revise
                  </Link>
                  <Link to={`/sheets/chapter/${active.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-ink/5 hover:text-ink">
                    <ListChecks aria-hidden className="size-4" />
                    Sheet
                  </Link>
                  <Link to={`/visuals/${active.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-ink/5 hover:text-ink">
                    <Shapes aria-hidden className="size-4" />
                    Figures
                  </Link>
                  {unitQuestions > 0 && (
                    <Button kind="secondary" size="sm" onClick={() => startMock(active.id)} disabled={busy} icon={<Timer aria-hidden />}>
                      {testWord}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <Tree nodes={childrenOf.get(activeId) ?? []} childrenOf={childrenOf} />
            {(childrenOf.get(activeId) ?? []).length === 0 && <p className="px-5 py-4 text-sm text-ink-3">The official syllabus lists no further topics under this heading.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function Tree({ nodes, childrenOf, depth = 0 }: { nodes: OutlineNode[]; childrenOf: Map<string | null, OutlineNode[]>; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={depth ? 'ml-6 border-l border-rule' : 'divide-y divide-rule'}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link to={`/topic/${n.id}`} className="group flex items-start gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-paper">
            {kindLabel(n.kind, n.label) ? <span className="mt-px w-14 shrink-0 text-xs text-ink-3">{kindLabel(n.kind, n.label)}</span> : null}
            <span className="min-w-0 flex-1 text-ink group-hover:text-accent">{n.title}</span>
            {(n.resources > 0 || n.questions > 0) && (
              <span className="num flex shrink-0 gap-2 text-xs text-ink-3">
                {n.resources > 0 && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-accent">{n.resources === 1 ? 'Lesson' : `${n.resources} lessons`}</span>}
                {n.questions > 0 && <span className="rounded-md bg-paper px-1.5 py-0.5 ring-1 ring-rule">{n.questions} Q</span>}
              </span>
            )}
            <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <Tree nodes={childrenOf.get(n.id) ?? []} childrenOf={childrenOf} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}
