import { ExternalLink, FileText, Megaphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api, type ExamCode, type GovNotice, type NoticeCategory } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Segmented, useLoad } from '../ui';

export const NOTICE_CATEGORY: Record<NoticeCategory, string> = {
  ADMIT_CARD: 'Admit card',
  RESULT: 'Result',
  ANSWER_KEY: 'Answer key',
  EXAM_SCHEDULE: 'Exam schedule',
  CITY_INTIMATION: 'Exam city',
  APPLICATION: 'Application',
  SYLLABUS: 'Syllabus and bulletin',
  ADVISORY: 'Advisory',
  GENERAL: 'General',
};
const examName = (e: ExamCode | null) => (e === 'CUET_UG' ? 'CUET (UG)' : e === 'CUET_PG' ? 'CUET (PG)' : '');
export const noticeDate = (day: string | null) => (day ? new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not stated');

/** One notice: what it is, when, and the two ways to the exam body's own copy. Nothing is hosted here. */
export function NoticeRow({ n, compact = false }: { n: GovNotice; compact?: boolean }) {
  return (
    <li className="px-4 py-3.5" data-notice>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <span className="num text-ink-2">{noticeDate(n.publishedOn)}</span>
        <Badge>{NOTICE_CATEGORY[n.category] ?? n.category}</Badge>
        {n.exam && <Badge tone="accent">{examName(n.exam)}</Badge>}
        {n.isNew && <Badge tone="green">New</Badge>}
        {n.isUpdated && <Badge tone="amber">Updated</Badge>}
      </div>
      <a href={n.documentUrl} target="_blank" rel="noreferrer noopener" className={`mt-1 block text-[15px] text-ink hover:text-accent ${compact ? 'line-clamp-2' : ''}`}>
        {n.title}
      </a>
      {!compact && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a href={n.documentUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
            <FileText aria-hidden className="size-4" />
            {n.isPdf ? 'View PDF' : 'Read official notice'}
            {n.description && <span className="font-normal text-ink-3">({n.description.replace(/ document$/, '')})</span>}
          </a>
          <a href={n.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-accent hover:underline">
            <ExternalLink aria-hidden className="size-4" />
            Official page: {n.sourceName}
          </a>
        </div>
      )}
    </li>
  );
}

/** Latest government updates: official CUET notices, read from NTA's own pages on a schedule. */
export function UpdatesPage() {
  const [params, setParams] = useSearchParams();
  const exam = (params.get('exam') === 'CUET_UG' || params.get('exam') === 'CUET_PG' ? params.get('exam') : '') as ExamCode | '';
  const category = (params.get('category') ?? '') as NoticeCategory | '';
  const r = useLoad(() => api.notices({ exam: exam || undefined, category: category || undefined, limit: 60 }), [exam, category]);
  const set = (key: string, value: string) => setParams((p) => (value ? p.set(key, value) : p.delete(key), key === 'exam' && p.delete('category'), p), { replace: true });
  const d = r.data;
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Latest government updates"
        subtitle={
          <>
            Official CUET notices from the National Testing Agency. Every link opens NTA’s own website.
            {d?.lastCheckedAt && <span className="text-ink-3"> Last checked {new Date(d.lastCheckedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</span>}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Exam"
          value={exam}
          onChange={(v) => set('exam', v)}
          options={[
            { value: '', label: 'All' },
            { value: 'CUET_UG', label: 'CUET UG' },
            { value: 'CUET_PG', label: 'CUET PG' },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span>Category</span>
          <select value={category} onChange={(e) => set('category', e.target.value)} className="h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none">
            <option value="">All categories</option>
            {(d?.categories ?? []).map((c) => (
              <option key={c.category} value={c.category}>
                {NOTICE_CATEGORY[c.category] ?? c.category} ({c.count})
              </option>
            ))}
            {category && !(d?.categories ?? []).some((c) => c.category === category) && <option value={category}>{NOTICE_CATEGORY[category] ?? category}</option>}
          </select>
        </label>
      </div>
      {r.loading && !d ? (
        <Loading />
      ) : r.error ? (
        <ErrorBox error={r.error} onRetry={r.reload} />
      ) : d!.notices.length === 0 ? (
        <Empty icon={<Megaphone />}>
          {d!.lastCheckedAt ? 'No official notices match this choice.' : 'Official notices have not been collected yet. They appear here once NTA’s pages have been checked.'}
        </Empty>
      ) : (
        <>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d!.notices.map((n) => (
              <NoticeRow key={n.id} n={n} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Showing {d!.notices.length} of {d!.total}. Dates are the dates stamped on NTA’s files. For anything that affects you, rely on the official notice itself.
          </p>
        </>
      )}
    </div>
  );
}

/** Dashboard: the newest few notices for the student's exam. */
export function LatestUpdates({ exam }: { exam: ExamCode | null }) {
  const r = useLoad(() => api.notices({ exam: exam ?? undefined, limit: 4 }), [exam]);
  if (!r.data || r.data.notices.length === 0) return null;
  return (
    <section aria-labelledby="gov-updates" className="mb-10">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id="gov-updates" className="text-base font-semibold text-ink">
          Latest government updates
        </h2>
        <Link to={`/updates${exam ? `?exam=${exam}` : ''}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
          All updates
        </Link>
      </div>
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {r.data.notices.map((n) => (
          <NoticeRow key={n.id} n={n} compact />
        ))}
      </ul>
    </section>
  );
}
