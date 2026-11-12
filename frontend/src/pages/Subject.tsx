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
  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {String(p.name)} <span className="font-mono text-sm font-normal text-zinc-500">{String(p.code)}</span>
          </span>
        }
        subtitle={
          <span>
            <Link to={`/${exam}`} className="hover:underline">
              {exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'}
            </Link>{' '}
            · Official syllabus:{' '}
            {p.source_url ? (
              <a href={String(p.source_url)} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                NTA PDF ({String(p.page_count)} pages)
              </a>
            ) : (
              'not yet available'
            )}
          </span>
        }
        actions={
          <Button onClick={() => startMock()} disabled={busy || !p.version_id}>
            {busy ? 'Starting…' : `Mock test · ${String(p.question_count ?? '')} Q / ${String(p.duration_minutes ?? '')} min`}
          </Button>
        }
      />
      {err && <ErrorBox error={err} />}
      {roots.length === 0 ? (
        <Empty>The syllabus for this paper is still being verified.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <nav aria-label="Units" className="md:sticky md:top-16 md:self-start">
            <ul className="space-y-0.5">
              {roots.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setUnitId(r.id)}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${r.id === activeId ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'}`}
                  >
                    <span className={`block text-[11px] ${r.id === activeId ? 'text-zinc-300' : 'text-zinc-500'}`}>{kindLabel(r.kind, r.label)}</span>
                    <span className="line-clamp-2">{r.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <section className="min-w-0 rounded-lg border border-zinc-200 bg-white">
            {active && (
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
                <Link to={`/topic/${active.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {kindLabel(active.kind, active.label)} · {active.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="num text-xs text-zinc-500">
                    p. {active.source_page} · {countQuestions(active.id) + active.questions} questions
                  </span>
                  {countQuestions(active.id) + active.questions > 0 && (
                    <Button kind="secondary" onClick={() => startMock(active.id)} disabled={busy}>
                      Unit test
                    </Button>
                  )}
                </span>
              </div>
            )}
            <Tree nodes={childrenOf.get(activeId) ?? []} childrenOf={childrenOf} />
            {(childrenOf.get(activeId) ?? []).length === 0 && <p className="px-3 py-3 text-sm text-zinc-500">This unit has no listed subtopics in the official syllabus.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function Tree({ nodes, childrenOf, depth = 0 }: { nodes: OutlineNode[]; childrenOf: Map<string | null, OutlineNode[]>; depth?: number }) {
  if (!nodes.length) return null;
  return (
    <ul className={depth ? 'ml-4 border-l border-zinc-100' : 'divide-y divide-zinc-50'}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link to={`/topic/${n.id}`} className="flex items-start gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50">
            <span className="mt-0.5 w-12 shrink-0 text-[11px] text-zinc-400">{kindLabel(n.kind, n.label) || '•'}</span>
            <span className="min-w-0 flex-1">{n.title}</span>
            {(n.resources > 0 || n.questions > 0) && (
              <span className="num shrink-0 text-[11px] text-zinc-500">
                {n.resources ? `${n.resources} notes` : ''}
                {n.resources && n.questions ? ' · ' : ''}
                {n.questions ? `${n.questions} Q` : ''}
              </span>
            )}
          </Link>
          <Tree nodes={childrenOf.get(n.id) ?? []} childrenOf={childrenOf} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}
