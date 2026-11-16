/** Admin console: the source registry. Every official page the platform reads or takes facts from: what it is, how far it is trusted, how often it is read, and when it was last checked. */
import { Badge, Empty, ErrorBox, Loading, PageHeader, SectionTitle, useLoad } from '../ui';
import { consoleApi } from './api';

const NOTICE_STATE: Record<string, { label: string; tone: 'green' | 'red' | 'zinc' }> = {
  OK: { label: 'Read successfully', tone: 'green' },
  FAILING: { label: 'Failing', tone: 'red' },
  NEVER_READ: { label: 'Not read yet', tone: 'zinc' },
};
const REC: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  USE: { label: 'Use', tone: 'green' },
  USE_WITH_CARE: { label: 'Use with care', tone: 'amber' },
  NOT_VERIFIED: { label: 'Not verified', tone: 'zinc' },
  DO_NOT_USE: { label: 'Do not use', tone: 'red' },
};

export function AdminRegistry() {
  const r = useLoad(consoleApi.registry, []);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  return (
    <div>
      <PageHeader title="Source registry" subtitle="Every official page the platform reads or takes information from, in one place. A source that is not approved is never used." />
      <section aria-labelledby="reg-notices" data-registry-notices>
        <SectionTitle id="reg-notices">Notice sources, read automatically</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-ink-2">
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Data type</th>
                <th className="px-4 py-2.5 font-medium">Reliability</th>
                <th className="px-4 py-2.5 font-medium">Update frequency</th>
                <th className="px-4 py-2.5 font-medium">Last checked</th>
                <th className="px-4 py-2.5 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {d.notices.map((s) => (
                <tr key={s.key} className="align-top">
                  <td className="px-4 py-2.5">
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-medium text-ink hover:text-accent">{s.name}</a> <Badge tone={s.authority === 'UGC' ? 'accent' : 'zinc'}>{s.authority}</Badge>
                    <span className="block max-w-[16rem] truncate text-xs text-ink-3">{s.url}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{s.dataType}</td>
                  <td className="px-4 py-2.5 text-ink-2">{s.reliability}</td>
                  <td className="px-4 py-2.5 text-ink-2">{s.updateFrequency}</td>
                  <td className="num px-4 py-2.5 text-ink-2">{s.lastCheckedOn ?? 'Never'}</td>
                  <td className="px-4 py-2.5"><Badge tone={NOTICE_STATE[s.state]?.tone ?? 'zinc'}>{NOTICE_STATE[s.state]?.label ?? s.state}</Badge>{s.lastError && <span className="mt-1 block text-xs text-wrong">{s.lastError}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="reg-adm" className="mt-10" data-registry-admissions>
        <SectionTitle id="reg-adm">Admissions sources, checked by people</SectionTitle>
        {d.admissions.length === 0 ? (
          <Empty>None registered yet. Load the reviewed sources from Admin, Admissions.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-ink-2">
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Data type</th>
                  <th className="px-4 py-2.5 font-medium">Reliability</th>
                  <th className="px-4 py-2.5 font-medium">Update frequency</th>
                  <th className="px-4 py-2.5 font-medium">Last checked</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {d.admissions.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-medium text-ink hover:text-accent">{s.title}</a>
                      <span className="block max-w-[16rem] truncate text-xs text-ink-3">{s.url}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{s.kind.replace(/_/g, ' ').toLowerCase()}, {s.format}</td>
                    <td className="px-4 py-2.5"><Badge tone={REC[s.recommendation]?.tone ?? 'zinc'}>{REC[s.recommendation]?.label ?? s.recommendation}</Badge>{s.personalDataRisk === 'LISTS_LINKED' && <span className="mt-1 block text-xs text-ink-3">Links to candidate lists: never stored</span>}</td>
                    <td className="px-4 py-2.5 text-ink-2">{s.updateFrequency ?? 'Unknown'}</td>
                    <td className="num px-4 py-2.5 text-ink-2">{s.lastCheckedOn ?? 'Never'}</td>
                    <td className="px-4 py-2.5"><Badge tone={s.status === 'APPROVED' ? 'green' : s.status === 'RETIRED' ? 'red' : 'amber'}>{s.status === 'APPROVED' ? 'Approved' : s.status === 'RETIRED' ? 'Retired' : 'Proposed'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
