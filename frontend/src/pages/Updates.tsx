import { ExternalLink, FileText, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, type ExamCode, type GovNotice, type NoticeAuthority, type NoticeCategory, type RevisionKind } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Segmented, useLoad } from '../ui';

export const NOTICE_CATEGORY: Record<NoticeCategory, string> = {
  ADMIT_CARD: 'Admit card',
  RESULT: 'Result',
  ANSWER_KEY: 'Answer key',
  EXAM_SCHEDULE: 'Exam schedule',
  CITY_INTIMATION: 'Exam city',
  APPLICATION: 'Application',
  SYLLABUS: 'Syllabus and bulletin',
  ADMISSION: 'Admission',
  SCHOLARSHIP: 'Scholarship',
  REGULATION: 'Regulation',
  ADVISORY: 'Advisory',
  GENERAL: 'General',
};
export const REVISION_LABEL: Record<RevisionKind, string> = { CORRIGENDUM: 'Corrigendum', ADDENDUM: 'Addendum', EXTENSION: 'Extension', RESCHEDULED: 'Rescheduled', AMENDMENT: 'Amendment', REVISED: 'Revised' };

/** The versions the official page has shown for a notice, loaded when the student asks. */
function Versions({ id }: { id: string }) {
  const r = useLoad(() => api.noticeDetail(id), [id]);
  if (r.loading && !r.data) return <p className="mt-2 text-sm text-ink-3">Loading the history…</p>;
  if (r.error) return <p className="mt-2 text-sm text-wrong">The history could not be loaded.</p>;
  return (
    <ol className="mt-2 space-y-1.5 rounded-lg bg-paper p-3 text-sm" data-notice-versions>
      {r.data!.versions.map((v) => (
        <li key={v.version}>
          <span className="font-medium text-ink">Version {v.version}</span> <span className="text-ink-3">seen {new Date(v.detectedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <div className="text-ink-2">{v.title}</div>
          <div className="text-xs text-ink-3">{v.reason}</div>
        </li>
      ))}
    </ol>
  );
}

const examName = (e: ExamCode | null) => (e === 'CUET_UG' ? 'CUET (UG)' : e === 'CUET_PG' ? 'CUET (PG)' : '');
export const noticeDate = (day: string | null) => (day ? new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not stated');

/** One notice: who issued it, what it is, when, and the two ways to the issuing body's own copy. Nothing is hosted here. */
export function NoticeRow({ n, compact = false }: { n: GovNotice; compact?: boolean }) {
  const [history, setHistory] = useState(false);
  return (
    <li className="px-4 py-3.5" data-notice>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <span className="num text-ink-2">{noticeDate(n.publishedOn)}</span>
        <Badge tone={n.authority === 'UGC' ? 'accent' : 'zinc'} title={n.authority === 'UGC' ? 'University Grants Commission' : 'National Testing Agency'}>{n.authority}</Badge>
        <Badge>{NOTICE_CATEGORY[n.category] ?? n.category}</Badge>
        {n.exam && <Badge tone="accent">{examName(n.exam)}</Badge>}
        {n.revisionKind && <Badge tone="amber" title="This notice corrects, extends or replaces an earlier one">{REVISION_LABEL[n.revisionKind]}</Badge>}
        {n.isNew && <Badge tone="green">New</Badge>}
        {n.isUpdated && <Badge tone="amber">Updated</Badge>}
      </div>
      <a href={n.documentUrl} target="_blank" rel="noreferrer noopener" className={`mt-1 block text-[15px] text-ink hover:text-accent ${compact ? 'line-clamp-2' : ''}`}>
        {n.title}
      </a>
      {n.revisionOf && <p className="mt-1 text-sm text-ink-2" data-revision-of>{REVISION_LABEL[n.revisionKind ?? 'REVISED']} to an earlier notice: {n.revisionOf.title}</p>}
      {n.revisions.length > 0 && (
        <p className="mt-1 text-sm text-marker" data-revised-by>
          Later changed by: {n.revisions.map((r) => `${r.kind ? REVISION_LABEL[r.kind] : 'Revision'}${r.publishedOn ? `, ${noticeDate(r.publishedOn)}` : ''}`).join('; ')}. Read the later notice too.
        </p>
      )}
      {!compact && n.versionCount > 1 && (
        <div className="mt-1">
          <button type="button" onClick={() => setHistory((h) => !h)} aria-expanded={history} className="text-sm font-medium text-accent hover:underline" data-notice-history-toggle>
            {history ? 'Hide' : 'Show'} the history ({n.versionCount} versions)
          </button>
          {history && <Versions id={n.id} />}
        </div>
      )}
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

/** Latest government updates: official notices from NTA and UGC, read from their own pages on a schedule. */
export function UpdatesPage() {
  const [params, setParams] = useSearchParams();
  const exam = (params.get('exam') === 'CUET_UG' || params.get('exam') === 'CUET_PG' ? params.get('exam') : '') as ExamCode | '';
  const category = (params.get('category') ?? '') as NoticeCategory | '';
  const authority = (params.get('authority') === 'NTA' || params.get('authority') === 'UGC' ? params.get('authority') : '') as NoticeAuthority | '';
  const r = useLoad(() => api.notices({ exam: exam || undefined, category: category || undefined, authority: authority || undefined, limit: 60 }), [exam, category, authority]);
  const set = (key: string, value: string) => setParams((p) => (value ? p.set(key, value) : p.delete(key), (key === 'exam' || key === 'authority') && p.delete('category'), key === 'authority' && value === 'UGC' && p.delete('exam'), p), { replace: true });
  const d = r.data;
  return (
    <div className="w-full">
      <PageHeader
        title="Latest government updates"
        subtitle={
          <>
            Official notices from the National Testing Agency (NTA) and the University Grants Commission (UGC). Every link opens the issuing body’s own website.
            {d?.lastCheckedAt && <span className="text-ink-3"> Last checked {new Date(d.lastCheckedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</span>}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Issued by"
          value={authority}
          onChange={(v) => set('authority', v)}
          options={[
            { value: '', label: 'NTA and UGC' },
            { value: 'NTA', label: 'NTA' },
            { value: 'UGC', label: 'UGC' },
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
          {d!.lastCheckedAt ? 'No official notices match this choice.' : 'Official notices have not been collected yet. They appear here once the official pages have been checked.'}
        </Empty>
      ) : (
        <>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d!.notices.map((n) => (
              <NoticeRow key={n.id} n={n} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Showing {d!.notices.length} of {d!.total}. NTA dates are stamped on its files; UGC dates are printed next to each notice on its page. For anything that affects you, rely on the official notice itself.
          </p>
        </>
      )}
    </div>
  );
}

/** Dashboard: the newest few notices for the student's exam. */
export function LatestUpdates({ exam }: { exam: ExamCode | null }) {
  const r = useLoad(() => api.notices({ exam: exam ?? undefined, limit: 4 }), [exam]);
  // Always shown (also when there is nothing new) so that the full page stays one tap away from Today.
  if (!r.data) return null;
  return (
    <section aria-labelledby="gov-updates" className="mb-7">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id="gov-updates" className="text-base font-semibold text-ink">
          Latest government updates
        </h2>
        <Link to={`/updates${exam ? `?exam=${exam}` : ''}`} className="shrink-0 text-sm font-medium text-accent hover:underline">
          All updates
        </Link>
      </div>
      {r.data.notices.length === 0 ? (
        <p className="rounded-xl border border-rule bg-surface px-5 py-4 text-sm text-ink-2">No new official updates right now.</p>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {r.data.notices.map((n) => (
            <NoticeRow key={n.id} n={n} compact />
          ))}
        </ul>
      )}
    </section>
  );
}
