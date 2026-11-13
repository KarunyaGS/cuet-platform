/**
 * Official previous-year papers: a directory by exam, year, subject and session, read from the exam body's own
 * answer-key files. Every paper that was held is listed with its status. Where the exam body does not publish the
 * question paper, the row says so; nothing is invented and no document is copied here.
 */
import { ChevronDown, ChevronRight, ExternalLink, FileKey, FileX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, type DirectoryYear, type ExamCode } from '../api';
import { Badge, Empty, ErrorBox, Loading, SearchInput, Segmented, useLoad } from '../ui';

const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const longDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const linkClass = 'inline-flex items-center gap-1.5 rounded-lg border border-rule-strong px-2.5 py-1 text-sm font-medium text-accent hover:bg-accent-soft';

export function OfficialDirectory({ exam, practiceSubjects }: { exam: ExamCode; practiceSubjects: Set<string> }) {
  const examName = exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG';
  const dir = useLoad(() => api.officialDirectory(exam), [exam]);
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  useEffect(() => {
    setYear('');
    setOpen('');
    setQ('');
  }, [exam]);
  const y: DirectoryYear | undefined = dir.data?.years.find((x) => String(x.year) === year) ?? dir.data?.years[0];
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (y?.subjects ?? []).filter((s) => words.every((w) => `${s.name} ${s.code}`.toLowerCase().includes(w)));
  }, [y, q]);

  if (dir.loading && !dir.data) return <Loading />;
  if (dir.error) return <ErrorBox error={dir.error} onRetry={dir.reload} />;
  if (!y)
    return (
      <Empty icon={<FileX />}>
        The directory of official {examName} papers has not been loaded yet. NTA does not publish the question papers openly; the list of papers held each year is read from its answer-key files.
      </Empty>
    );
  return (
    <div>
      {dir.data!.years.length > 1 && (
        <div className="mb-4">
          <Segmented label="Year" value={String(y.year)} onChange={(v) => (setYear(v), setOpen(''))} options={dir.data!.years.map((x) => ({ value: String(x.year), label: String(x.year) }))} />
        </div>
      )}

      <div className="rounded-xl border border-rule bg-surface p-4 sm:p-5">
        <h3 className="text-base font-semibold text-ink">
          {examName} {y.year}
        </h3>
        <p className="num mt-0.5 text-sm text-ink-2">
          {y.answerKey ? `${y.papers} papers held in ${y.subjects.length} subjects, as listed in NTA's answer key.` : `${y.papers} papers in ${y.subjects.length} subjects found on NTA's server. The full list of papers held is not available, because no final answer key was found.`}
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-paper p-3">
            <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
              <FileX aria-hidden className="size-4 text-ink-3" />
              Question papers
              {y.questionPaper.status === 'SOME_PUBLISHED' ? <Badge tone="green">{y.questionPaper.published} published by NTA</Badge> : <Badge tone="amber">Not published by NTA</Badge>}
            </dt>
            <dd className="mt-1.5 text-sm text-ink-2">{y.questionPaper.note ?? 'NTA does not publish the question papers openly.'}</dd>
          </div>
          <div className="rounded-lg bg-paper p-3">
            <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
              <FileKey aria-hidden className="size-4 text-ink-3" />
              Official answer key
              {y.answerKey ? <Badge tone="green">Published by NTA</Badge> : <Badge tone="amber">Not found</Badge>}
            </dt>
            {!y.answerKey && <dd className="mt-1.5 text-sm text-ink-2">No final answer key for this year was found on NTA's sites.</dd>}
            {y.answerKey && (
              <dd className="mt-1.5 text-sm text-ink-2">
                <span className="block text-ink">{y.answerKey.title}</span>
                <span className="block">
                  Source: {y.answerKey.publisher}. Checked on {longDay(y.answerKey.checkedOn)}.
                </span>
                {y.answerKey.url ? (
                  <a href={y.answerKey.url} target="_blank" rel="noreferrer" className={`${linkClass} mt-2`}>
                    Open on NTA's site <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                ) : (
                  <span className="mt-1 block text-ink-3">The page of the key for each paper is shown below. A direct link will appear here once NTA's linking condition is met.</span>
                )}
              </dd>
            )}
          </div>
        </dl>
      </div>

      <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Papers by subject</h3>
        <SearchInput value={q} onChange={setQ} placeholder="Subject name or code" label="Find a subject" />
      </div>
      {shown.length === 0 ? (
        <Empty>No subject matches "{q}".</Empty>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {shown.map((s) => {
            const id = `${y.year}:${s.code}`;
            const isOpen = open === id;
            return (
              <li key={id}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-ink/[0.03]">
                  {isOpen ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {s.name} {s.showCode && <span className="font-normal text-ink-2">({s.code})</span>}
                    </span>
                    <span className="block text-sm text-ink-2">{s.firstDate === s.lastDate ? day(s.firstDate) : `${day(s.firstDate)} to ${day(s.lastDate)}`}</span>
                  </span>
                  {s.papersPublished > 0 && <Badge tone="green">Question paper published</Badge>}
                  <span className="num text-sm text-ink-2">
                    {s.sessions} {s.sessions === 1 ? 'paper' : 'papers'}
                  </span>
                </button>
                {isOpen && <Sessions exam={exam} year={y.year} code={s.code} practise={s.paperId && practiceSubjects.has(s.paperId) ? `/${exam}/subject/${s.paperId}` : null} name={s.name} />}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Each row is a paper NTA held, taken from its own answer-key file. CUET Prep stores the date, shift and page number only: no question paper or answer key is copied here.
      </p>
    </div>
  );
}

function Sessions({ exam, year, code, name, practise }: { exam: ExamCode; year: number; code: string; name: string; practise: string | null }) {
  const s = useLoad(() => api.officialSessions(exam, year, code), [exam, year, code]);
  if (s.loading && !s.data) return <div className="px-4 pb-4"><Loading /></div>;
  if (s.error) return <div className="px-4 pb-2"><ErrorBox error={s.error} onRetry={s.reload} /></div>;
  return (
    <div className="border-t border-rule bg-paper/60 px-4 py-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            {name} papers held in {year}
          </caption>
          <thead>
            <tr className="text-left text-ink-2">
              <th scope="col" className="py-2 pr-4 font-medium">Exam date</th>
              <th scope="col" className="py-2 pr-4 font-medium">Shift</th>
              <th scope="col" className="py-2 pr-4 font-medium">Question paper</th>
              <th scope="col" className="py-2 font-medium">Official answer key</th>
            </tr>
          </thead>
          <tbody>
            {s.data!.map((r) => (
              <tr key={r.id} className="border-t border-rule align-top">
                <td className="num py-2.5 pr-4 text-ink">{longDay(r.date)}</td>
                <td className="py-2.5 pr-4 text-ink">{r.shift}</td>
                <td className="py-2.5 pr-4">
                  {r.questionPaper.available && r.questionPaper.url ? (
                    <span>
                      <a href={r.questionPaper.url} target="_blank" rel="noreferrer" className={linkClass}>
                        View paper <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                      <span className="mt-0.5 block text-xs text-ink-2">Opens on NTA's site{r.questionPaper.pages ? ` · ${r.questionPaper.pages} pages` : ''}</span>
                    </span>
                  ) : r.questionPaper.published ? (
                    <span className="text-ink">
                      Published by NTA
                      <span className="mt-0.5 block text-xs text-ink-2">{r.questionPaper.pages ? `${r.questionPaper.pages} pages. ` : ''}The link will appear once NTA's linking condition is met.</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <FileX aria-hidden className="size-4 text-ink-3" />
                      Not published by NTA
                    </span>
                  )}
                </td>
                <td className="py-2.5">
                  {!r.answerKey.published ? (
                    <span className="text-ink-2">Not found on NTA's sites</span>
                  ) : r.answerKey.url ? (
                    <a href={r.answerKey.url} target="_blank" rel="noreferrer" className={linkClass}>
                      View key, page {r.answerKey.page} <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-ink">
                      Published <span className="text-ink-2">· page {r.answerKey.page} of NTA's key file</span>
                    </span>
                  )}
                  {r.dropped > 0 && (
                    <span className="mt-0.5 block text-xs text-ink-2">
                      {r.dropped} {r.dropped === 1 ? 'question' : 'questions'} dropped by NTA
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {practise && (
        <p className="mt-3 text-sm text-ink-2">
          You can also{' '}
          <Link to={practise} className="font-medium text-accent hover:underline">
            practise {name} with our own questions
          </Link>
          .
        </p>
      )}
    </div>
  );
}
