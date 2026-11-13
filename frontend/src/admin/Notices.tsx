/** Admin console: government updates. What the scheduled job collected from NTA's pages, what failed, and what is waiting for a check. */
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { NOTICE_CATEGORY, noticeDate } from '../pages/Updates';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, SectionTitle, StatGroup, useLoad } from '../ui';
import { consoleApi, when } from './api';

export function AdminNotices() {
  const o = useLoad(consoleApi.noticeOverview, []);
  const q = useLoad(consoleApi.noticeQueue, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [exam, setExam] = useState<Record<string, string>>({});
  if (o.loading && !o.data) return <Loading />;
  if (o.error) return <ErrorBox error={o.error} onRetry={o.reload} />;
  const d = o.data!;
  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await work();
      o.reload();
      q.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <PageHeader
        title="Government updates"
        subtitle="Official CUET notices are read from NTA’s public pages on a schedule. Only titles, dates and official addresses are stored; documents are never copied."
        actions={
          <Button kind="secondary" onClick={() => run('fetch', consoleApi.noticeFetch)} disabled={busy === 'fetch'} icon={<RefreshCw aria-hidden />}>
            {busy === 'fetch' ? 'Checking the official pages…' : 'Check now'}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <Badge tone={d.enabled ? 'green' : 'amber'}>{d.enabled ? 'Scheduled fetching is on' : 'Scheduled fetching is off'}</Badge>
        <span>
          Each page is checked every {d.intervalMinutes >= 60 ? `${Math.round((d.intervalMinutes / 60) * 10) / 10} hours` : `${d.intervalMinutes} minutes`}. A page that fails is tried again sooner.
        </span>
      </div>
      {err && <ErrorBox error={err} />}
      <StatGroup
        items={[
          { label: 'Last successful fetch', value: <span className="text-base">{d.lastSuccessfulFetch ? when(d.lastSuccessfulFetch) : 'Never'}</span> },
          { label: 'Next scheduled fetch', value: <span className="text-base">{d.nextScheduledFetch ? when(d.nextScheduledFetch) : d.enabled ? 'At the next run' : 'Not scheduled'}</span> },
          { label: 'Notifications collected', value: d.collected, hint: `${d.published} shown to students` },
          { label: 'New in 7 days', value: d.newInSevenDays, hint: `${d.updatedInSevenDays} updated` },
          { label: 'Duplicate records', value: d.duplicates, hint: 'Same notice on two official pages' },
          { label: 'Failed source checks', value: d.failedSources, tone: d.failedSources ? 'wrong' : 'correct' },
          { label: 'Awaiting verification', value: d.awaitingVerification, tone: d.awaitingVerification ? 'wrong' : undefined },
        ]}
      />

      <section aria-labelledby="gn-sources" className="mt-8">
        <SectionTitle id="gn-sources">Official sources</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-ink-2">
                <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Last success</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Next check</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Found</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">New</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Duplicates</th>
                <th scope="col" className="px-4 py-2.5 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {d.sources.map((s) => (
                <tr key={s.key} className="align-top">
                  <td className="px-4 py-2.5">
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-medium text-ink hover:text-accent">
                      {s.name}
                    </a>
                    <span className="block max-w-[18rem] truncate text-xs text-ink-3">{s.url}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{s.lastSuccessAt ? when(s.lastSuccessAt) : 'Never'}</td>
                  <td className="px-4 py-2.5 text-ink-2">{s.nextCheckAt ? when(s.nextCheckAt) : 'At the next run'}</td>
                  <td className="num px-4 py-2.5 text-right">{s.found}</td>
                  <td className="num px-4 py-2.5 text-right">{s.added}</td>
                  <td className="num px-4 py-2.5 text-right">{s.duplicates}</td>
                  <td className="px-4 py-2.5">
                    {s.consecutiveFailures > 0 ? (
                      <>
                        <Badge tone="red">Failed {s.consecutiveFailures} {s.consecutiveFailures === 1 ? 'time' : 'times'}</Badge>
                        <span className="mt-1 block max-w-[16rem] text-xs text-wrong">{s.lastError}</span>
                      </>
                    ) : s.lastSuccessAt ? (
                      <Badge tone="green">Working</Badge>
                    ) : (
                      <Badge>Not checked yet</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="gn-queue" className="mt-8">
        <SectionTitle id="gn-queue">Awaiting verification</SectionTitle>
        {q.loading && !q.data ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox error={q.error} onRetry={q.reload} />
        ) : q.data!.length === 0 ? (
          <Empty>Nothing is waiting. A notice comes here when its exam is not certain or its document is not on an official website.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {q.data!.map((n) => (
              <li key={n.id} className="px-4 py-3.5">
                <a href={n.documentUrl} target="_blank" rel="noreferrer noopener" className="text-[15px] text-ink hover:text-accent">
                  {n.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span className="num">{noticeDate(n.publishedOn)}</span>
                  <Badge>{NOTICE_CATEGORY[n.category] ?? n.category}</Badge>
                  <span>{n.sourceName}</span>
                </div>
                <p className="mt-1 text-sm text-ink-2">{n.statusNote}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    <span className="sr-only">Exam for: {n.title}</span>
                    <select value={exam[n.id] ?? n.exam ?? ''} onChange={(e) => setExam((m) => ({ ...m, [n.id]: e.target.value }))} className="h-8 rounded-lg border border-rule-strong bg-surface px-2 text-sm text-ink">
                      <option value="">Choose the exam</option>
                      <option value="CUET_UG">CUET (UG)</option>
                      <option value="CUET_PG">CUET (PG)</option>
                    </select>
                  </label>
                  <Button size="sm" disabled={busy === n.id || !(exam[n.id] ?? n.exam)} onClick={() => run(n.id, () => consoleApi.noticeDecision(n.id, { action: 'PUBLISH', exam: (exam[n.id] ?? n.exam) as 'CUET_UG' | 'CUET_PG' }))}>
                    Publish
                  </Button>
                  <Button size="sm" kind="danger" disabled={busy === n.id} onClick={() => run(n.id, () => consoleApi.noticeDecision(n.id, { action: 'REJECT' }))}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
