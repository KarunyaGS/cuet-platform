import { ChevronRight, FileText, ListChecks, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type OutlineNode } from '../api';
import { Button, Empty, ErrorBox, kindLabel, Loading, PageHeader, useAuth, useLoad } from '../ui';

/** Subject page: units on the left, the selected unit's topics and subtopics on the right. */
export function SubjectPage() {
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
  const activeId = unitId ?? roots.find((r) => r.kind !== 'NOTE')?.id ?? roots[0]?.id ?? null;
  const active = roots.find((r) => r.id === activeId);
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

  if (outline.loading) return <Loading />;
  if (outline.error) return <ErrorBox error={outline.error} onRetry={outline.reload} />;
  const p = outline.data!.paper;
  const examName = exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG';
  const unitQuestions = active ? countQuestions(active.id) + active.questions : 0;
  return (
    <div>
      <PageHeader
        back={{ to: `/${exam}`, label: `${examName} subjects` }}
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            {String(p.name)} <span className="num text-base font-normal text-ink-3">{String(p.code)}</span>
          </span>
        }
        subtitle={
          p.source_url ? (
            <a href={String(p.source_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
              <FileText aria-hidden className="size-4" />
              Official NTA syllabus PDF, {String(p.page_count)} pages
            </a>
          ) : (
            'The official syllabus PDF is not yet available.'
          )
        }
        actions={
          <Button onClick={() => startMock()} disabled={busy || !p.version_id} icon={<Timer aria-hidden />}>
            {busy ? 'Starting…' : `Full mock test, ${String(p.question_count ?? '')} questions in ${String(p.duration_minutes ?? '')} min`}
          </Button>
        }
      />
      {err && <ErrorBox error={err} />}
      {roots.length === 0 ? (
        <Empty>The syllabus for this paper is still being checked. Please come back soon.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label="Units" className="md:sticky md:top-20 md:self-start">
            <h2 className="mb-2 px-3 text-sm font-medium text-ink-2">Units</h2>
            <ul className="space-y-0.5">
              {roots.map((r) => {
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
                  {unitQuestions > 0 && (
                    <Button kind="secondary" size="sm" onClick={() => startMock(active.id)} disabled={busy} icon={<Timer aria-hidden />}>
                      Unit test
                    </Button>
                  )}
                </div>
              </div>
            )}
            <Tree nodes={childrenOf.get(activeId) ?? []} childrenOf={childrenOf} />
            {(childrenOf.get(activeId) ?? []).length === 0 && <p className="px-5 py-4 text-sm text-ink-3">This unit has no listed subtopics in the official syllabus.</p>}
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
