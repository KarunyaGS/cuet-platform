import { Link } from 'react-router';
import { api } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, useLoad } from '../ui';

function Bar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-100" aria-hidden>
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function ProgressPage() {
  const p = useLoad(api.progress, []);
  if (p.loading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data!;
  return (
    <div>
      <PageHeader title="My progress" subtitle="Built from your submitted practice sets and tests" />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Sessions', d.totals.sessions],
          ['Questions answered', d.totals.answered],
          ['Accuracy', d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%`],
          ['Weak topics', d.weakTopics.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{k}</div>
            <div className="num text-lg font-semibold">{String(v)}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-1.5 text-sm font-semibold">Weak topics to revise</h2>
          {d.weakTopics.length === 0 ? (
            <Empty>No weak topics yet. A topic appears here when your accuracy is under 60% after at least 3 attempts.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {d.weakTopics.map((t) => (
                <li key={t.id} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Link to={`/topic/${t.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {t.title}
                    </Link>
                    <span className="num shrink-0 text-xs text-red-700">{t.accuracy}%</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {t.paper} · {t.correct}/{t.attempted} correct
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-1.5 text-sm font-semibold">All practised topics</h2>
          {d.topics.length === 0 ? (
            <Empty>Practise a topic to start building your progress.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {d.topics.map((t) => (
                <li key={t.id} className="grid grid-cols-[1fr_5rem_3rem] items-center gap-2 px-3 py-1.5 text-sm">
                  <Link to={`/topic/${t.id}`} className="truncate hover:underline">
                    {t.title}
                  </Link>
                  <Bar value={t.accuracy} />
                  <span className="num text-right text-xs">{t.accuracy}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-4">
        <h2 className="mb-1.5 text-sm font-semibold">Recent sessions</h2>
        {d.recentSessions.length === 0 ? (
          <Empty>No sessions yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {d.recentSessions.map((s) => (
              <li key={s.id}>
                <Link to={s.status === 'IN_PROGRESS' ? `/practice/${s.id}` : `/results/${s.id}`} className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-zinc-50">
                  <span className="w-24 shrink-0 text-xs text-zinc-500">{new Date(s.started_at).toLocaleDateString()}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[s.mode] ?? s.mode} · {s.paper ?? ''}
                  </span>
                  <span className="num shrink-0 text-xs">{s.status === 'IN_PROGRESS' ? 'in progress' : `${s.score} / ${s.max_score}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
