/** University admissions: browse programmes by university type, CUET subject and year, and read one programme's requirements with their sources. */
import { ExternalLink, Info, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, ApiError, type AdmissionFact, type Cycle, type EligibilityOut, type ExamCode, type Progress, type ProgrammeSummary, type Reliability } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SearchInput, SectionTitle, inputClass, useLoad } from '../ui';
import { BASIS, Source } from './University';
import { parseRule, ruleLines, type Rule } from '../subject-rule';
import { EligibilityLine, MyTargets, TargetButton } from './AdmissionEligibility';

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const examName = (e: ExamCode) => (e === 'CUET_UG' ? 'CUET (UG)' : 'CUET (PG)');

export function ReliabilityBadge({ r, on, cycle }: { r: Reliability; on?: string; cycle?: Cycle }) {
  // Information about an earlier admission cycle is never shown as simply "verified": the cycle comes first.
  if (cycle?.status === 'PREVIOUS' && cycle.label) return <span data-previous-cycle><Badge tone="amber" title="How the university's earlier admission cycle worked. It is not confirmed eligibility, requirements or deadlines for the cycle you are preparing for.">{cycle.label}</Badge></span>;
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

function matchesSubject(required: string, paper: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const names = required.split(/[\/|]/).map(normalize).filter(Boolean);
  const actual = normalize(paper);
  return names.some((name) => name === actual || name.startsWith(`${actual} `) || actual.startsWith(`${name} `));
}

function Card({ p, progress, eligibility, targeted, onTarget }: { p: ProgrammeSummary; progress?: Progress; eligibility?: EligibilityOut; targeted?: boolean; onTarget?: () => void }) {
  const d = p.nextDeadline ? `Apply by ${dayLabel(p.nextDeadline.date)}` : p.lastDeadline ? `Deadline was ${dayLabel(p.lastDeadline.date)}` : null;
  const subjectPerformance = (p.subjects ?? []).flatMap((required) => {
    const result = progress?.subjects.find((subject) => matchesSubject(required, subject.paper));
    return result ? [{ required, ...result }] : [];
  });
  return (
    <li>
      <Panel className="p-4" >
        <div data-programme={p.id}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {p.universityType && <Badge>{p.universityType}</Badge>}
            <Badge tone="accent">{examName(p.exam)} · {p.academicYear}</Badge>
            <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} cycle={p.cycle} />
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
              <dd className="text-ink" data-card-subjects>
                {(() => {
                  const rule = parseRule(p.ruleText);
                  if (rule) {
                    const l = ruleLines(rule);
                    return l.length === 1 ? l[0] : (
                      <>
                        <span className="text-ink-2">Choose one:</span>
                        <ul className="list-disc pl-4">{l.slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
                      </>
                    );
                  }
                  return p.subjects ? p.subjects.join(', ') : p.known.eligibility ? <span className="text-ink-2">See the eligibility on the programme page</span> : <span className="text-ink-3">Not yet available</span>;
                })()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Application deadline</dt>
              <dd className="text-ink">{d ?? <span className="text-ink-3">Not yet available</span>}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-3">
            Eligibility {p.known.eligibility ? 'given' : 'not yet available'} · procedure {p.known.procedure ? 'given' : 'not yet available'} · counselling {p.known.counselling ? 'given' : 'not yet available'} · cut-offs {p.known.cutoffs ? 'given' : 'not yet available'}
          </p>
          {subjectPerformance.length > 0 && (
            <div className="mt-3 rounded-lg border border-rule bg-paper/70 px-3 py-2.5" data-admission-practice-context>
              <p className="text-xs font-semibold text-ink">Your practice context for listed subjects</p>
              <ul className="mt-1 space-y-1 text-xs text-ink-2">
                {subjectPerformance.map((s) => (
                  <li key={`${p.id}-${s.paperCode}`}>
                    {s.paper}: {s.accuracy === null ? 'no accuracy yet' : `${s.accuracy}% accuracy`} across {s.attempted} answered questions
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-ink-3">Practice history is a revision signal, not an official CUET score, eligibility decision or admission prediction.</p>
            </div>
          )}
          <EligibilityLine e={eligibility} />
          {onTarget && <TargetButton programmeId={p.id} targeted={Boolean(targeted)} onChange={onTarget} />}
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
  const performance = useLoad(api.progress, []);
  const list = useLoad(() => api.programmes({ ...f, offset: 0 }), [f.type, f.subject, f.year, f.exam, f.q, f.university]);
  const extra = useLoad(() => (more ? api.programmes({ ...f, offset: more }) : Promise.resolve(null)), [more, f.type, f.subject, f.year, f.exam, f.q, f.university]);
  const set = (k: string, v: string) => {
    setMore(0);
    setParams((p) => (v ? p.set(k, v) : p.delete(k), p), { replace: true });
  };
  const shown = [...(list.data?.programmes ?? []), ...(more ? (extra.data?.programmes ?? []) : [])];
  const total = list.data?.total ?? 0;
  // Minimum subject eligibility (only from rules a person has checked) and the programmes the student follows.
  const idKey = shown.map((x) => x.id).join(',');
  const elig = useLoad(() => (idKey ? api.eligibility(idKey.split(',')) : Promise.resolve(null)), [idKey]);
  const targets = useLoad(api.admissionTargets, []);
  const eligOf = new Map((elig.data?.results ?? []).map((e) => [e.programmeId, e]));
  const followed = new Set((targets.data?.targets ?? []).map((t) => t.programmeId));
  const refreshTargets = () => { targets.reload(); };
  const sel = `${inputClass} h-9 w-auto py-0`;
  return (
    <div className="w-full">
      <PageHeader
        title="University admissions"
        subtitle="Programmes, required CUET subjects, eligibility and cut-offs, each taken from the university’s own pages. We publish a detail only after a person has checked it against the official source, and we say plainly when something is not yet available."
      />
      <Panel className="mb-4 border-accent/20 bg-accent-soft/30 p-4" data-admission-guidance>
        <h2 className="text-sm font-semibold text-ink">Connect your preparation to programme requirements</h2>
        <p className="mt-1 text-sm text-ink-2">
          Published programme cards can show your practice accuracy for required CUET subjects when you have attempted questions in those subjects. Use it to decide what to revise; it does not estimate your CUET result or admission chance.
        </p>
        <p className="mt-1 text-xs text-ink-3">Historical cutoff records are not yet available in the published dataset, so no A/B/C competitiveness label is shown. The available programme records are clearly marked by admission cycle.</p>
        {performance.error && <p className="mt-2 text-xs text-ink-3">Practice context is temporarily unavailable. Programme information is still available.</p>}
        {!performance.error && performance.data?.subjects.length === 0 && !performance.loading && (
          <p className="mt-2 text-xs text-ink-3">Submit a practice set to see subject-level context here. <Link to="/progress" className="font-medium text-accent hover:underline">Open your progress</Link>.</p>
        )}
      </Panel>
      {targets.data && <MyTargets data={targets.data} reload={targets.reload} />}
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
          {shown.some((p) => p.cycle.status === 'PREVIOUS') && (
            <div role="note" data-previous-cycle-list-note className="mb-4 rounded-xl border border-marker/40 bg-marker-soft px-4 py-3 text-sm text-ink">
              <p className="font-semibold">Historical references from the 2026–27 admission cycle</p>
              <p className="mt-0.5 text-ink-2">Every programme on this page shows what the university required for CUET UG 2026. <strong>None of it is confirmed for CUET UG 2027.</strong> Check the university's official page for the current cycle.</p>
            </div>
          )}
          <p className="mb-3 text-sm text-ink-2" data-programme-count>
            {total} {total === 1 ? 'programme' : 'programmes'}
          </p>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{shown.map((p) => <Card key={p.id} p={p} progress={performance.data ?? undefined} eligibility={eligOf.get(p.id)} targeted={followed.has(p.id)} onTarget={targets.data ? refreshTargets : undefined} />)}</ul>
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

/** The subjects a student must take, laid out from the university's own wording: named subjects, languages, how many other subjects, and any separate test. */
function RuleBreakdown({ rule }: { rule: Rule }) {
  const generic = rule.combos.some((c) => c.items.some((i) => !i.named));
  return (
    <div className="mt-3 rounded-lg bg-paper p-3" data-subject-rule>
      <p className="text-sm font-medium text-ink">{rule.combos.length > 1 ? 'Take any ONE of these combinations:' : 'Take ALL of these:'}</p>
      <ul className="mt-2 space-y-2">
        {rule.combos.map((c) => (
          <li key={c.label} className="flex flex-wrap items-center gap-1.5" data-rule-combination>
            {rule.combos.length > 1 && <span className="mr-1 text-xs font-semibold text-ink-3">{c.label}</span>}
            {c.items.map((i, k) => (
              <span key={`${i.text}-${k}`} className="inline-flex items-center gap-1.5">
                {k > 0 && <span aria-hidden className="text-ink-3">+</span>}
                <Badge tone={i.named ? 'accent' : 'zinc'}>{i.text}</Badge>
              </span>
            ))}
          </li>
        ))}
      </ul>
      {rule.extraTest && <p className="mt-2 text-sm text-ink" data-extra-test>Also required: {rule.extraTest}.</p>}
      {generic && <p className="mt-2 text-xs text-ink-3">List A means the languages the university accepts and List B the domain subjects it accepts, as defined in its own bulletin. Which ones you may choose is decided by the university, not by us.</p>}
    </div>
  );
}

function Facts({ title, id, facts, missing, official, fallback }: { title: string; id: string; facts: AdmissionFact[]; missing: boolean; official: string | null; fallback?: string }) {
  return (
    <section aria-labelledby={id} className="mb-7" data-section={id}>
      <SectionTitle id={id}>{title}</SectionTitle>
      {facts.length === 0 || missing ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-surface/60 px-4 py-3 text-sm text-ink-2" data-unavailable>
          {fallback ?? 'Not yet available. We have not published this for the programme.'}{' '}
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
                  <ReliabilityBadge r={f.reliability} on={f.checkedOn} cycle={f.cycle} />
                </div>
                {f.valueText && <blockquote className="mt-1.5 whitespace-pre-line border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">{f.valueText.replace(/\s+(?=Combination [IVX]+\s*:)/g, '\n').replace(/\s+(?=(?:OR|AND)\s)/g, '\n').replace(/\s+(?=Merit will be)/g, '\n').replace(/\s+(?=Candidates? must appear in any one language)/g, '\n')}</blockquote>}
                {f.kind === 'SUBJECTS' && (parseRule(f.valueText) ? <RuleBreakdown rule={parseRule(f.valueText)!} /> : f.subjects && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.subjects.map((s) => (
                      <Badge key={s} tone="accent">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ))}
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
  const elig = useLoad(() => api.eligibility([id]), [id]);
  const targets = useLoad(api.admissionTargets, []);
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
    <div className="w-full">
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
      {p.cycle.status === 'PREVIOUS' && (
        <div role="note" data-previous-cycle-banner className="mb-5 rounded-xl border border-marker/40 bg-marker-soft px-4 py-3 text-sm text-ink">
          <p className="font-semibold">{p.cycle.label}: historical reference only</p>
          <p className="mt-0.5 text-ink-2">This is what {p.universityName} required in its {p.academicYear} admission cycle (CUET UG {p.academicYear.slice(0, 4)}). It is <strong>not confirmed for CUET UG 2027</strong> (2027–28 admissions): the requirements, subjects and dates may change. Check the university's official page when its next bulletin is published.</p>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2 [overflow-wrap:anywhere]" data-programme-meta>
        <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} cycle={p.cycle} />
        {p.sourceUrl && (
          <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-accent hover:underline">
            Source: {p.sourceTitle}
            {p.sourcePage ? `, page ${p.sourcePage}` : ''}{p.sourceLocator ? `, ${p.sourceLocator}` : ''}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        )}
      </div>

      <section aria-labelledby="pg-fit" className="mb-6" data-section="pg-fit">
        <SectionTitle id="pg-fit">Do my subjects meet this?</SectionTitle>
        <EligibilityLine e={elig.data?.results[0]} />
        {elig.error && <p className="mt-2 text-xs text-ink-3">The subject check is temporarily unavailable. The university's own requirement is below.</p>}
        {targets.data && <TargetButton programmeId={id} targeted={targets.data.targets.some((t) => t.programmeId === id)} onChange={targets.reload} />}
      </section>
      <h2 className="mb-3 text-lg font-semibold text-ink">{p.cycle.status === 'PREVIOUS' ? `Historical reference: the ${p.academicYear} admission cycle` : `This admission year (${p.academicYear})`}</h2>
      {d.current.subjects.length === 0 && d.current.eligibility.some((f) => parseRule(f.valueText)) ? (
        <section aria-labelledby="pg-subjects" className="mb-7" data-section="pg-subjects">
          <SectionTitle id="pg-subjects">Required CUET subjects</SectionTitle>
          <Panel className="p-4">
            <p className="text-sm text-ink-2">Laid out from the programme-specific eligibility printed below.</p>
            <RuleBreakdown rule={parseRule(d.current.eligibility.find((f) => parseRule(f.valueText))!.valueText)!} />
          </Panel>
        </section>
      ) : (
        <Facts title="Required CUET subjects" id="pg-subjects" facts={d.current.subjects} missing={miss('subjects')} official={official} />
      )}
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
