import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ApiError, type ExamCode } from '../api';
import { Badge, ErrorBox, Loading, useLoad } from '../ui';
import { reviewApi, type QueueItem, type QueueState } from './api';

export const STATE: Record<QueueState, { label: string; tone: 'amber' | 'red' | 'accent' | 'green' | 'zinc'; hint: string }> = {
  NEEDS_REVIEW: { label: 'Needs review', tone: 'amber', hint: 'Automatic checks failed or were not possible; a person must compare every row with the PDF' },
  NEEDS_TRANSCRIPTION: { label: 'Needs transcription', tone: 'red', hint: 'No machine extraction possible; type the syllabus from the page images' },
  TRANSCRIPTION_IN_REVIEW: { label: 'Transcribed · check', tone: 'amber', hint: 'Typed by a person; a second reviewer must verify it' },
  MACHINE_VERIFIED: { label: 'Machine-verified', tone: 'accent', hint: 'Passed every automatic check; not yet signed off by a person' },
  HUMAN_VERIFIED: { label: 'Human-verified', tone: 'green', hint: 'Every row decided and the paper signed off by a reviewer' },
  NOT_IMPORTED: { label: 'Not imported', tone: 'zinc', hint: 'No syllabus version stored yet' },
};
const ORDER: QueueState[] = ['NEEDS_TRANSCRIPTION', 'NEEDS_REVIEW', 'TRANSCRIPTION_IN_REVIEW', 'MACHINE_VERIFIED', 'HUMAN_VERIFIED', 'NOT_IMPORTED'];

export function ProgressBar({ r }: { r: QueueItem['rows'] }) {
  const t = Math.max(1, r.total);
  const seg = (n: number, cls: string, title: string) => (n ? <span className={cls} style={{ width: `${(100 * n) / t}%` }} title={`${n} ${title}`} /> : null);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-200" aria-label={`${r.verified} of ${r.total} rows verified by a person`}>
      {seg(r.verified, 'bg-emerald-500', 'verified by a person')}
      {seg(r.rejected, 'bg-zinc-400', 'rejected')}
      {seg(r.machine, 'bg-[var(--color-accent)]/60', 'machine-verified')}
      {seg(r.flagged, 'bg-amber-400', 'flagged')}
    </div>
  );
}

export function ReviewQueue() {
  const [exam, setExam] = useState<ExamCode>('CUET_PG');
  const [state, setState] = useState<QueueState | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const data = useLoad(() => reviewApi.queue(exam, 2026), [exam]);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of data.data ?? []) c.set(i.state, (c.get(i.state) ?? 0) + 1);
    return c;
  }, [data.data]);
  const totals = useMemo(() => {
    const d = data.data ?? [];
    return { rows: d.reduce((s, i) => s + i.rows.total, 0), human: d.reduce((s, i) => s + i.rows.verified, 0), signed: d.filter((i) => i.state === 'HUMAN_VERIFIED').length };
  }, [data.data]);
  if (data.error instanceof ApiError && (data.error.status === 401 || data.error.status === 403)) {
    return (
      <div className="max-w-lg rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <h1 className="mb-1 text-base font-semibold">Reviewer access needed</h1>
        <p className="text-zinc-600">{data.error.status === 401 ? 'Sign in with a reviewer account to review syllabi.' : 'Your account does not have the reviewer role. Ask an administrator to grant it.'}</p>
        {data.error.status === 401 && <Link to="/signin" className="mt-2 inline-block font-medium text-[var(--color-accent)] underline">Sign in</Link>}
      </div>
    );
  }
  const items = (data.data ?? [])
    .filter((i) => state === 'ALL' || i.state === state)
    .filter((i) => !q || `${i.code} ${i.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.code.localeCompare(b.code));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Syllabus review</h1>
          <p className="text-sm text-zinc-500">
            Compare each extracted syllabus with its official PDF. {totals.human.toLocaleString()} of {totals.rows.toLocaleString()} rows verified by a person · {totals.signed} papers signed off.
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-zinc-100 p-0.5 text-sm">
          {(['CUET_UG', 'CUET_PG'] as const).map((e) => (
            <button key={e} onClick={() => setExam(e)} className={`rounded px-2.5 py-1 font-medium ${exam === e ? 'bg-white shadow-sm' : 'text-zinc-600'}`}>{e.replace('_', '-')}</button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setState('ALL')} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${state === 'ALL' ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-700 ring-zinc-300'}`}>All {data.data?.length ?? ''}</button>
        {ORDER.filter((s) => counts.get(s)).map((s) => (
          <button key={s} title={STATE[s].hint} onClick={() => setState(s)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${state === s ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-700 ring-zinc-300'}`}>
            {STATE[s].label} {counts.get(s)}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or subject" className="ml-auto w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm" />
      </div>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorBox error={data.error} onRetry={data.reload} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-1.5">Paper</th>
                <th className="px-2 py-1.5">State</th>
                <th className="w-40 px-2 py-1.5">Rows</th>
                <th className="hidden px-2 py-1.5 md:table-cell">Attention</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.paperId} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-1.5">
                    <Link to={`/review/paper/${i.paperId}`} className="font-medium hover:text-[var(--color-accent)]">
                      <span className="mr-1.5 font-mono text-xs text-zinc-500">{i.code}</span>
                      {i.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5"><Badge tone={STATE[i.state].tone} title={STATE[i.state].hint}>{STATE[i.state].label}</Badge></td>
                  <td className="px-2 py-1.5">
                    <ProgressBar r={i.rows} />
                    <div className="num mt-0.5 text-[11px] text-zinc-500">{i.rows.verified}/{i.rows.total} verified{i.rows.flagged ? ` · ${i.rows.flagged} flagged` : ''}</div>
                  </td>
                  <td className="hidden px-2 py-1.5 text-xs text-zinc-600 md:table-cell">
                    {[
                      i.rows.guessedHeadings ? `${i.rows.guessedHeadings} guessed headings` : '',
                      i.rows.failingCheck ? `${i.rows.failingCheck} rows fail checks` : '',
                      i.pagesToCheck ? `${i.pagesToCheck} pages: OCR mismatch` : '',
                      i.state === 'NEEDS_TRANSCRIPTION' ? 'type from page images' : '',
                    ].filter(Boolean).join(' · ') || <span className="text-zinc-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p className="px-3 py-4 text-sm text-zinc-500">No papers match.</p>}
        </div>
      )}
    </div>
  );
}
