/** One university: its official admission pages, and the dates, eligibility and cut-offs that have been checked against them. */
import { ExternalLink, Info } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api, type AdmissionFact, type ExamCode } from '../api';
import { ApiError } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel, SectionTitle, useLoad } from '../ui';

const examName = (e: ExamCode) => (e === 'CUET_UG' ? 'CUET (UG)' : 'CUET (PG)');
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const BASIS: Record<string, string> = { ALLOCATION_SCORE: 'allocation score', NORMALISED_SCORE: 'normalised score', PERCENTILE: 'percentile', MARKS: 'marks', RANK: 'rank' };

/** Where a fact comes from: the official page, the place on it, and the day it was checked. Shown with every fact. */
export function Source({ f }: { f: AdmissionFact }) {
  const documentUrl = f.sourceLocator?.match(/https?:\/\/[^\s)]+/)?.[0];
  const locator = f.sourceLocator?.replace(/\s*\([^)]*https?:\/\/[^)]*\)/g, '').trim();
  return (
    <span className="text-xs text-ink-3 [overflow-wrap:anywhere]">
      <a href={f.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-ink-2 hover:text-accent hover:underline">
        {f.sourceTitle}
        <ExternalLink aria-hidden className="size-3" />
      </a>
      {f.sourcePage ? `, page ${f.sourcePage}` : ''}{locator ? `, ${locator}` : ''}. Checked {dayLabel(f.checkedOn)}.
      {documentUrl && <a href={documentUrl} target="_blank" rel="noreferrer noopener" className="ml-2 inline-flex items-center gap-1 font-semibold text-accent hover:underline">Open cited document <ExternalLink aria-hidden className="size-3" /></a>}
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

      <section aria-labelledby="uni-programmes" className="mb-8" data-university-programmes>
        <SectionTitle id="uni-programmes">Programmes</SectionTitle>
        {d.programmes.some((p) => p.cycle?.status === 'PREVIOUS') && (
          <p role="note" data-previous-cycle-list-note className="mb-3 rounded-xl border border-marker/40 bg-marker-soft px-4 py-3 text-sm text-ink">
            <strong>Historical references from the 2026–27 admission cycle.</strong> They are not confirmed for CUET UG 2027.
          </p>
        )}
        {d.programmes.length === 0 ? (
          <Empty>No programme has been published for this university yet.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.programmes.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <Link to={`/admissions/programmes/${p.id}`} className="text-[15px] font-medium text-accent hover:underline">
                  {p.programmeName}
                </Link>
                <span className="ml-2 text-sm text-ink-3">{p.level} · {p.academicYear}</span>
                {p.cycle?.label && <span className="ml-2 text-sm font-medium text-marker" data-previous-cycle>{p.cycle.label}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm"><Link to={`/admissions?university=${d.slug}`} className="font-medium text-accent hover:underline">Browse all programmes</Link></p>
      </section>

      {nothing ? (
        <Empty icon={<Info />}>
          {d.programmes.length > 0
            ? 'No university-wide dates, eligibility or cut-offs have been published yet. Eligibility and the required CUET subjects are published programme by programme, in the list above, as historical 2026–27 references. We publish a figure only after it has been read from an official page and checked by a person.'
            : 'No dates, eligibility or cut-offs have been checked and published for this university yet. We publish a figure only after it has been read from an official page and checked by a person. Until then, use the official pages above.'}
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
                      {f.cycle.status === 'PREVIOUS' && f.cycle.label ? <span data-previous-cycle><Badge tone="amber">{f.cycle.label}</Badge></span> : <Badge>{examName(f.exam)} {f.year}</Badge>}
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
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {f.programme ?? f.label}
                        {f.cycle.status === 'PREVIOUS' && f.cycle.label ? <span data-previous-cycle><Badge tone="amber" title="How the university's earlier admission cycle worked. It is not confirmed for the cycle you are preparing for.">{f.cycle.label}</Badge></span> : <Badge>{examName(f.exam)} {f.year}</Badge>}
                      </div>
                      <blockquote className="mt-1.5 whitespace-pre-line border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">{(f.valueText ?? '').replace(/\s+(?=List B:)/, '\n').replace(/\s+(?=General Aptitude Test:)/, '\n')}</blockquote>
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
