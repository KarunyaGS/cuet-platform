/** University admissions: browse programmes by university type, CUET subject and year, and read one programme's requirements with their sources. */
import { ExternalLink, Info, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, ApiError, type AdmissionFact, type ExamCode, type ProgrammeSummary, type Reliability } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SearchInput, SectionTitle, Segmented, inputClass, useLoad } from '../ui';
import { BASIS, Source } from './University';

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const examName = (e: ExamCode) => (e === 'CUET_UG' ? 'CUET (UG)' : 'CUET (PG)');

export function ReliabilityBadge({ r, on }: { r: Reliability; on?: string }) {
  if (r === 'VERIFIED_OFFICIAL') return <Badge tone="green" title="Read from an official page and checked by a person">Verified from an official source{on ? `, ${dayLabel(on)}` : ''}</Badge>;
  if (r === 'OUTDATED') return <Badge tone="amber" title="Not checked recently, or about an earlier admission year. Confirm on the official page.">May be out of date{on ? `, last checked ${dayLabel(on)}` : ''}</Badge>;
  return <Badge tone="zinc">Not verified</Badge>;
}

const NOT_AVAILABLE: Record<string, string> = {
  eligibility: 'Eligibility',
  subjects: 'Required CUET subjects',
  procedure: 'How to apply',
  counselling: 'Counselling',
  deadline: 'Application deadline',
  cutoffs: 'Previous years’ cut-offs',
};

function Card({ p }: { p: ProgrammeSummary }) {
  const d = p.nextDeadline ? `Apply by ${dayLabel(p.nextDeadline.date)}` : p.lastDeadline ? `Deadline was ${dayLabel(p.lastDeadline.date)}` : null;
  return (
    <li>
      <Panel className="p-4" >
        <div data-programme={p.id}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {p.universityType && <Badge>{p.universityType}</Badge>}
            <Badge tone="accent">{examName(p.exam)} · {p.academicYear}</Badge>
            <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} />
          </div>
          <h3 className="mt-2 text-base font-semibold text-ink">
            <Link to={`/admissions/programmes/${p.id}`} className="hover:text-accent">
              {p.programmeName}
            </Link>
          </h3>
          <Link to={`/universities/${p.universitySlug}`} className="text-sm text-ink-2 hover:text-accent hover:underline">
            {p.universityName}
          </Link>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-3">Required CUET subjects</dt>
              <dd className="text-ink">{p.subjects ? p.subjects.join(', ') : <span className="text-ink-3">Not yet available</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Application deadline</dt>
              <dd className="text-ink">{d ?? <span className="text-ink-3">Not yet available</span>}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-3">
            Eligibility {p.known.eligibility ? 'given' : 'not yet available'} · procedure {p.known.procedure ? 'given' : 'not yet available'} · counselling {p.known.counselling ? 'given' : 'not yet available'} · cut-offs {p.known.cutoffs ? 'given' : 'not yet available'}
          </p>
        </div>
      </Panel>
    </li>
  );
}

export function AdmissionsPage() {
  const [params, setParams] = useSearchParams();
  const f = { type: params.get('type') ?? '', subject: params.get('subject') ?? '', year: params.get('year') ?? '', exam: params.get('exam') ?? '', q: params.get('q') ?? '', university: params.get('university') ?? '' };
  const [more, setMore] = useState(0);
  const filters = useLoad(api.admissionFilters, []);
  const list = useLoad(() => api.programmes({ ...f, offset: 0 }), [f.type, f.subject, f.year, f.exam, f.q, f.university]);
  const extra = useLoad(() => (more ? api.programmes({ ...f, offset: more }) : Promise.resolve(null)), [more, f.type, f.subject, f.year, f.exam, f.q, f.university]);
  const set = (k: string, v: string) => {
    setMore(0);
    setParams((p) => (v ? p.set(k, v) : p.delete(k), p), { replace: true });
  };
  const shown = [...(list.data?.programmes ?? []), ...(more ? (extra.data?.programmes ?? []) : [])];
  const total = list.data?.total ?? 0;
  const sel = `${inputClass} h-9 w-auto py-0`;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="University admissions"
        subtitle="Programmes, required CUET subjects, eligibility and cut-offs, each taken from the university’s own pages. We publish a detail only after a person has checked it against the official source, and we say plainly when something is not yet available."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2" data-programme-filters>
        <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Search programme or university" label="Search programmes" />
        <label>
          <span className="sr-only">University type</span>
          <select value={f.type} onChange={(e) => set('type', e.target.value)} className={sel} data-filter="type">
            <option value="">All university types</option>
            {(filters.data?.types ?? []).map((t) => (
              <option key={t.type} value={t.type}>
                {t.type} ({t.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Required CUET subject</span>
          <select value={f.subject} onChange={(e) => set('subject', e.target.value)} className={sel} data-filter="subject">
            <option value="">Any CUET subject</option>
            {(filters.data?.subjects ?? []).map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject} ({s.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Admission year</span>
          <select value={f.year} onChange={(e) => set('year', e.target.value)} className={sel} data-filter="year">
            <option value="">Any year</option>
            {(filters.data?.years ?? []).map((y) => (
              <option key={y.year} value={y.year}>
                {y.year} ({y.count})
              </option>
            ))}
          </select>
        </label>
        <Segmented label="Exam" value={f.exam} onChange={(v) => set('exam', v)} options={[{ value: '', label: 'All' }, { value: 'CUET_UG', label: 'UG' }, { value: 'CUET_PG', label: 'PG' }]} />
      </div>
      {f.university && (
        <p className="mb-3 text-sm text-ink-2">
          Showing the programmes of one university.{' '}
          <button type="button" onClick={() => set('university', '')} className="font-medium text-accent hover:underline">
            Show all
          </button>
        </p>
      )}
      {list.loading && !list.data ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : shown.length === 0 ? (
        <Empty icon={<SearchX />}>
          {Object.values(f).some(Boolean) ? 'No programme matches these choices.' : 'No programme has been published yet.'} The list grows as programmes are read from official pages and checked. Meanwhile, the{' '}
          <Link to="/cuet/ug/universities" className="font-medium text-accent hover:underline">
            list of participating universities
          </Link>{' '}
          links each university’s official page.
        </Empty>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2" data-programme-count>
            {total} {total === 1 ? 'programme' : 'programmes'}
          </p>
          <ul className="space-y-3">{shown.map((p) => <Card key={p.id} p={p} />)}</ul>
          {shown.length < total && (
            <div className="mt-4">
              <Button kind="secondary" onClick={() => setMore(shown.length)} disabled={extra.loading}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
      <p className="mt-6 text-xs text-ink-3">
        Rely on the university’s own notice for anything that affects you. <Link to="/updates" className="text-accent hover:underline">Latest government updates</Link>
      </p>
    </div>
  );
}

function Facts({ title, id, facts, missing, official }: { title: string; id: string; facts: AdmissionFact[]; missing: boolean; official: string | null }) {
  return (
    <section aria-labelledby={id} className="mb-7" data-section={id}>
      <SectionTitle id={id}>{title}</SectionTitle>
      {facts.length === 0 || missing ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-surface/60 px-4 py-3 text-sm text-ink-2" data-unavailable>
          Not yet available. We have not published this for the programme.{' '}
          {official && (
            <a href={official} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">
              Check the university’s official page
            </a>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {facts.map((f) => (
            <li key={f.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{f.kind === 'EVENT' && f.eventDate ? `${dayLabel(f.eventDate)}: ${f.label}` : f.label}</span>
                  <ReliabilityBadge r={f.reliability} on={f.checkedOn} />
                </div>
                {f.valueText && <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">{f.valueText}</blockquote>}
                {f.kind === 'SUBJECTS' && f.subjects && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.subjects.map((s) => (
                      <Badge key={s} tone="accent">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-1.5">
                  <Source f={f} />
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProgrammePage() {
  const { id = '' } = useParams();
  const r = useLoad(() => api.programme(id), [id]);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) {
    return r.error instanceof ApiError && r.error.status === 404 ? (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={{ to: '/admissions', label: 'All programmes' }} title="Programme not found" />
        <Empty>This programme is not published.</Empty>
      </div>
    ) : (
      <ErrorBox error={r.error} onRetry={r.reload} />
    );
  }
  const d = r.data!;
  const p = d.programme;
  const official = d.officialPages[0]?.url ?? p.sourceUrl;
  const miss = (k: string) => d.unavailable.includes(k);
  const deadlines = d.current.dates.filter((f) => f.category === 'APPLICATION_DEADLINE');
  const otherDates = d.current.dates.filter((f) => f.category !== 'APPLICATION_DEADLINE');
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ to: '/admissions', label: 'All programmes' }}
        title={p.programmeName}
        subtitle={
          <>
            <Link to={`/universities/${p.universitySlug}`} className="font-medium text-accent hover:underline">
              {p.universityName}
            </Link>
            {p.universityType ? `, ${p.universityType}` : ''}. {examName(p.exam)}, {p.academicYear} admissions{p.degree ? `, ${p.degree}` : ''}.
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2" data-programme-meta>
        <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} />
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-accent hover:underline">
            Source: {p.sourceTitle}
            {p.sourcePage ? `, page ${p.sourcePage}` : p.sourceLocator ? `, ${p.sourceLocator}` : ''}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-ink">This admission year ({p.academicYear})</h2>
      <Facts title="Required CUET subjects" id="pg-subjects" facts={d.current.subjects} missing={miss('subjects')} official={official} />
      <Facts title="Eligibility, as the university prints it" id="pg-elig" facts={d.current.eligibility} missing={miss('eligibility')} official={official} />
      <Facts title="How to apply" id="pg-proc" facts={d.current.procedure} missing={miss('procedure')} official={official} />
      <Facts title="Counselling" id="pg-couns" facts={d.current.counselling} missing={miss('counselling')} official={official} />
      <Facts title="Application deadline" id="pg-deadline" facts={deadlines} missing={miss('deadline')} official={official} />
      {otherDates.length > 0 && <Facts title="Other important dates" id="pg-dates" facts={otherDates} missing={false} official={official} />}

      <h2 className="mt-10 mb-1 text-lg font-semibold text-ink">Previous years’ cut-offs</h2>
      <p className="mb-3 text-sm text-ink-2">Historical figures the university published for earlier rounds and years. They are shown for reference, are never a prediction for this year, and are kept apart from the information above.</p>
      {d.historicalCutoffs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-surface/60 px-4 py-3 text-sm text-ink-2" data-unavailable>
          Not yet available. No cut-off has been published for this programme. {official && <a href={official} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">Check the university’s official page</a>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-surface" data-historical-cutoffs>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                <th className="px-4 py-2.5 font-medium">Year, list</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 text-right font-medium">Figure</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {d.historicalCutoffs.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="px-4 py-2.5 text-ink-2">{f.year}, {f.round}</td>
                  <td className="px-4 py-2.5 text-ink-2">{f.category}</td>
                  <td className="num px-4 py-2.5 text-right text-ink">
                    {f.valueNumber}
                    <span className="block text-xs font-normal text-ink-3">{BASIS[f.basis ?? ''] ?? f.basis}</span>
                  </td>
                  <td className="px-4 py-2.5"><Source f={f} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="pg-official" className="mt-10">
        <SectionTitle id="pg-official">Official pages</SectionTitle>
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {d.officialPages.map((o) => (
            <li key={o.url} className="px-4 py-3">
              <a href={o.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline">
                {o.title}
                <ExternalLink aria-hidden className="size-4" />
              </a>
              <p className="mt-0.5 text-sm text-ink-2">{o.covers}</p>
              <p className="mt-0.5 text-xs text-ink-3">{o.updateFrequency ?? ''}{o.lastCheckedOn ? ` · Checked ${dayLabel(o.lastCheckedOn)}` : ''}</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 flex items-start gap-2 text-xs text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {d.note}
      </p>
    </div>
  );
}
