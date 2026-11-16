/** One university: its official admission pages, and the dates, eligibility and cut-offs that have been checked against them. */
import { ExternalLink, Info } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api, type AdmissionFact, type ExamCode } from '../api';
import { ApiError } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel, SectionTitle, useLoad } from '../ui';

const examName = (e: ExamCode) => (e === 'CUET_UG' ? 'CUET (UG)' : 'CUET (PG)');
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const BASIS: Record<string, string> = { ALLOCATION_SCORE: 'allocation score', NORMALISED_SCORE: 'normalised score', PERCENTILE: 'percentile', MARKS: 'marks', RANK: 'rank' };

/** Where a fact comes from: the official page, the place on it, and the day it was checked. Shown with every fact. */
function Source({ f }: { f: AdmissionFact }) {
  return (
    <span className="text-xs text-ink-3">
      <a href={f.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-ink-2 hover:text-accent hover:underline">
        {f.sourceTitle}
        <ExternalLink aria-hidden className="size-3" />
      </a>
      {f.sourcePage ? `, page ${f.sourcePage}` : f.sourceLocator ? `, ${f.sourceLocator}` : ''}. Checked {dayLabel(f.checkedOn)}.
    </span>
  );
}

export function UniversityPage() {
  const { slug = '' } = useParams();
  const r = useLoad(() => api.universityAdmissions(slug), [slug]);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) {
    return r.error instanceof ApiError && r.error.status === 404 ? (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={{ to: '/cuet/ug/universities', label: 'Back to the university list' }} title="University not found" />
        <Empty>We do not have a page for this university.</Empty>
      </div>
    ) : (
      <ErrorBox error={r.error} onRetry={r.reload} />
    );
  }
  const d = r.data!;
  const nothing = d.dates.length + d.eligibility.length + d.cutoffs.length === 0;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ to: '/cuet/ug/universities', label: 'Back to the university list' }}
        title={d.name}
        subtitle={
          d.listedBy.length ? (
            <>
              Listed by NTA for {d.listedBy.map((l) => `${examName(l.exam)} ${l.cycle}`).join(' and ')} as: {[...new Set(d.listedBy.map((l) => l.type))].join(', ')}.
            </>
          ) : undefined
        }
      />

      <section aria-labelledby="uni-official" className="mb-8">
        <SectionTitle id="uni-official">Official admission pages</SectionTitle>
        {d.officialPages.length === 0 ? (
          <Empty>We have not yet checked an official admission page for this university. Look for its admission page on the university’s own website.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.officialPages.map((p) => (
              <li key={p.url} className="px-4 py-3">
                <a href={p.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
                  {p.title}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
                <p className="mt-0.5 text-sm text-ink-2">{p.covers}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {p.format === 'PDF' ? 'Mostly PDF files. ' : ''}
                  {p.updateFrequency ? `${p.updateFrequency}. ` : ''}
                  {p.lastCheckedOn ? `Checked ${dayLabel(p.lastCheckedOn)}.` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {nothing ? (
        <Empty icon={<Info />}>
          No dates, eligibility or cut-offs have been checked and published for this university yet. We publish a figure only after it has been read from an official page and checked by a person. Until then, use the official pages above.
        </Empty>
      ) : (
        <>
          {d.dates.length > 0 && (
            <section aria-labelledby="uni-dates" className="mb-8" data-admissions-dates>
              <SectionTitle id="uni-dates">Important dates</SectionTitle>
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                {d.dates.map((f) => (
                  <li key={f.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num font-semibold text-ink">{f.eventDate ? dayLabel(f.eventDate) : ''}</span>
                      <Badge>{examName(f.exam)} {f.year}</Badge>
                    </div>
                    <div className="mt-0.5 text-[15px] text-ink">{f.label}</div>
                    <Source f={f} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.eligibility.length > 0 && (
            <section aria-labelledby="uni-elig" className="mb-8" data-admissions-eligibility>
              <SectionTitle id="uni-elig">Eligibility, as the university prints it</SectionTitle>
              <ul className="space-y-3">
                {d.eligibility.map((f) => (
                  <li key={f.id}>
                    <Panel className="p-4">
                      <div className="text-sm font-semibold text-ink">
                        {f.programme ?? f.label} <Badge>{examName(f.exam)} {f.year}</Badge>
                      </div>
                      <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">{f.valueText}</blockquote>
                      <div className="mt-1.5">
                        <Source f={f} />
                      </div>
                    </Panel>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.cutoffs.length > 0 && (
            <section aria-labelledby="uni-cut" className="mb-8" data-admissions-cutoffs>
              <SectionTitle id="uni-cut">Published cut-offs</SectionTitle>
              <p className="mb-2 text-sm text-ink-2">Each figure is what the university published, with what the number measures. Figures measured differently cannot be compared.</p>
              <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                      <th className="px-4 py-2.5 font-medium">Programme</th>
                      <th className="px-4 py-2.5 font-medium">Year, list</th>
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-4 py-2.5 text-right font-medium">Figure</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {d.cutoffs.map((f) => (
                      <tr key={f.id} className="align-top">
                        <td className="px-4 py-2.5 text-ink">{f.programme}</td>
                        <td className="px-4 py-2.5 text-ink-2">
                          {f.year}, {f.round}
                        </td>
                        <td className="px-4 py-2.5 text-ink-2">{f.category}</td>
                        <td className="num px-4 py-2.5 text-right text-ink">
                          {f.valueNumber}
                          <span className="block text-xs font-normal text-ink-3">{BASIS[f.basis ?? ''] ?? f.basis}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Source f={f} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-ink-3">
        {d.note} <Link to="/updates" className="text-accent hover:underline">Latest government updates</Link>
      </p>
    </div>
  );
}
