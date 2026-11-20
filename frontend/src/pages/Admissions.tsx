/** University admissions: browse programmes by university type, CUET subject and year, and read one programme's requirements with their sources. */
import { ChevronDown, ExternalLink, Info, SearchX, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, ApiError, type AdmissionFact, type Cycle, type ExamCode, type Progress, type ProgrammeSummary, type Reliability } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SearchInput, inputClass, useLoad } from '../ui';
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

function Card({ p, targeted, onTarget }: { p: ProgrammeSummary; targeted?: boolean; onTarget?: () => void }) {
  const rule = parseRule(p.ruleText);
  const lines = rule ? ruleLines(rule) : p.subjects;
  const subjectSummary = lines?.length ? lines[0] + (lines.length > 1 ? ` + ${lines.length - 1} alternative${lines.length > 2 ? 's' : ''}` : '') : 'Subject requirements not published';
  return (
    <li>
      <Panel className="p-4 transition-shadow hover:shadow-md">
        <div data-programme={p.id}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {p.universityType && <Badge>{p.universityType}</Badge>}
            <Badge tone="accent">{examName(p.exam)}</Badge>
            <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} cycle={p.cycle} />
          </div>
          <h3 className="mt-2 text-base font-semibold text-ink">{p.programmeName}</h3>
          <Link to={`/universities/${p.universitySlug}`} className="text-sm text-ink-2 hover:text-accent hover:underline">
            {p.universityName}
          </Link>
          <p className="mt-3 truncate text-sm text-ink-2" data-card-subjects><span className="font-medium text-ink">CUET subjects:</span> {subjectSummary}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
            <Link to={`/admissions/programmes/${p.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline" aria-label={`View admission details for ${p.programmeName}`}>
              View admission details <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          {onTarget && <TargetButton programmeId={p.id} targeted={Boolean(targeted)} onChange={onTarget} />}
          </div>
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
  // The programme list stays compact. Eligibility and preparation context load on the detail view.
  const targets = useLoad(api.admissionTargets, []);
  const followed = new Set((targets.data?.targets ?? []).map((t) => t.programmeId));
  const refreshTargets = () => { targets.reload(); };
  const sel = `${inputClass} h-9 w-auto py-0`;
  return (
    <div className="w-full">
      <PageHeader
        title="University admissions"
        subtitle="Find a programme, check its CUET subject requirements, and open its verified admission details."
      />
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
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{shown.map((p) => <Card key={p.id} p={p} targeted={followed.has(p.id)} onTarget={targets.data ? refreshTargets : undefined} />)}</ul>
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
    <details aria-labelledby={id} className="admission-disclosure mb-3 overflow-hidden rounded-xl border border-rule bg-surface" data-section={id}>
      <summary id={id} className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink marker:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-ink-3">
          {facts.length && !missing ? `${facts.length} verified item${facts.length === 1 ? '' : 's'}` : 'Details not yet published'}
          <ChevronDown aria-hidden className="admission-chevron size-4 shrink-0" />
        </span>
      </summary>
      <div className="border-t border-rule p-3 sm:p-4">
        {facts.length === 0 || missing ? (
          <div className="rounded-xl border border-dashed border-rule-strong bg-paper/70 px-4 py-3 text-sm text-ink-2" data-unavailable>
            {fallback ?? 'Not yet available. We have not published this for the programme.'}{' '}
            {official && <a href={official} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">Check the university’s official page</a>}
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
                  {f.kind === 'SUBJECTS' && (parseRule(f.valueText) ? <RuleBreakdown rule={parseRule(f.valueText)!} /> : f.subjects && <div className="mt-2 flex flex-wrap gap-1.5">{f.subjects.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}</div>)}
                  <div className="mt-2"><Source f={f} /></div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function PreporaAdvice({ programmeName, subjects, progress, loading, error }: { programmeName: string; subjects: string[]; progress?: Progress; loading: boolean; error?: Error | null }) {
  const subjectSignals = subjects.map((required) => {
    const score = progress?.subjects.find((subject) => matchesSubject(required, subject.paper));
    const weak = score ? progress?.weakTopics.filter((topic) => matchesSubject(required, topic.paper)).sort((a, b) => a.accuracy - b.accuracy)[0] : undefined;
    return { required, score, weak };
  });
  return (
    <details className="admission-advice my-8 overflow-hidden rounded-2xl border border-[#d9e69a] bg-gradient-to-br from-[#f5f8df] via-[#f8f8e9] to-[#fff8e0]" data-prepora-expert-advice>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/80 text-[#657522]"><Sparkles aria-hidden className="size-4" /></span>
          <span><span className="block text-sm font-semibold text-ink">Prepora expert advice</span><span className="mt-0.5 block text-xs text-ink-2">See how your practice maps to {programmeName}</span></span>
        </span>
        <ChevronDown aria-hidden className="admission-chevron size-4 shrink-0 text-ink-3" />
      </summary>
      <div className="border-t border-[#d9e69a] px-4 py-4 sm:px-5" data-admission-practice-context>
        {loading ? <p className="text-sm text-ink-2">Loading your practice snapshot…</p> : error ? <p className="text-sm text-ink-2">Your practice snapshot is temporarily unavailable. Your programme requirements are still shown above.</p> : subjects.length === 0 ? (
          <p className="text-sm text-ink-2">This programme accepts subject combinations rather than naming every subject. Choose your CUET papers in your profile, then build practice history to get course-specific advice.</p>
        ) : !progress?.subjects.length ? (
          <div className="rounded-xl border border-[#e4e8c7] bg-white/70 p-3.5">
            <p className="text-sm font-semibold text-ink">Your course-specific practice baseline is not available yet.</p>
            <p className="mt-1 text-sm text-ink-2">Complete a few questions in the required CUET subjects. We’ll use your answers to point out topics to revisit.</p>
            <Link to="/practice-centre" className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline">Start subject practice <ExternalLink aria-hidden className="ml-1 size-3.5" /></Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-2">Practice signals below are from your submitted Prepora sets. They are not an official CUET score, cutoff target, eligibility decision or admission prediction.</p>
            <ul className="space-y-2">
              {subjectSignals.map(({ required, score, weak }) => (
                <li key={required} className="rounded-xl border border-[#e4e8c7] bg-white/70 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{required}</span>
                    <span className="text-xs font-medium text-ink-2">{!score ? 'No practice data yet' : score.attempted < 3 ? `${score.attempted} answered · early signal` : `${score.accuracy ?? 0}% accuracy · ${score.attempted} answered`}</span>
                  </div>
                  {!score ? <p className="mt-1 text-xs text-ink-2">Start with a short question set in this subject.</p> : score.attempted < 3 ? <p className="mt-1 text-xs text-ink-2">Try a few more questions before relying on this early result.</p> : weak ? (
                    <p className="mt-1 text-xs text-ink-2">Next focus: <Link to={`/revise/${weak.id}`} className="font-semibold text-accent hover:underline">{weak.title}</Link> ({weak.accuracy}% practice accuracy).</p>
                  ) : score.accuracy !== null && score.accuracy < 75 ? <p className="mt-1 text-xs text-ink-2">Review missed answers, then try a mixed set to strengthen recall across topics.</p> : <p className="mt-1 text-xs text-ink-2">Keep this subject active with mixed-topic practice and review new mistakes.</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#d9e69a] pt-4">
          <Button kind="secondary" disabled data-target-plan-coming-soon>Plan for this programme</Button>
          <span className="max-w-xl text-xs text-ink-2">A target-aware plan can use these subject requirements and your practice gaps. Programme planning will be connected here next.</span>
        </div>
      </div>
    </details>
  );
}

export function ProgrammePage() {
  const { id = '' } = useParams();
  const r = useLoad(() => api.programme(id), [id]);
  const elig = useLoad(() => api.eligibility([id]), [id]);
  const targets = useLoad(api.admissionTargets, []);
  const performance = useLoad(api.progress, []);
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
  const examDates = d.current.dates.filter((f) => /CUET.*(exam|test)|exam date|test date/i.test(f.label));
  const otherDates = d.current.dates.filter((f) => f.category !== 'APPLICATION_DEADLINE' && !examDates.includes(f));
  const parsedSubjectRule = parseRule(p.ruleText) ?? parseRule(d.current.subjects.find((f) => f.valueText)?.valueText) ?? parseRule(d.current.eligibility.find((f) => parseRule(f.valueText))?.valueText);
  const requiredSubjects = parsedSubjectRule
    ? [...new Set(parsedSubjectRule.combos.flatMap((combo) => combo.items.filter((item) => item.named).flatMap((item) => item.text.split(/[\/|]/).map((subject) => subject.trim()).filter(Boolean))))]
    : [...new Set([...((p.subjects ?? [])), ...d.current.subjects.flatMap((fact) => fact.subjects ?? [])])];
  const subjectSummary = parsedSubjectRule ? ruleLines(parsedSubjectRule).join(' · OR · ') : requiredSubjects.length ? requiredSubjects.join(', ') : 'Not yet available';
  const deadlineSummary = deadlines.find((fact) => fact.eventDate)?.eventDate;
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

      <Panel className="mb-4 overflow-hidden p-0" data-admission-overview>
        <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <div className="min-w-0 p-4">
            <p className="text-xs font-medium text-ink-3">Required CUET subjects</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{subjectSummary}</p>
            <p className="mt-1 text-[11px] text-ink-3">{p.academicYear} cycle</p>
          </div>
          <div className="min-w-0 p-4">
            <p className="text-xs font-medium text-ink-3">Published historical cut-offs</p>
            <p className="mt-1 text-sm font-semibold text-ink">{d.historicalCutoffs.length ? `${d.historicalCutoffs.length} source record${d.historicalCutoffs.length === 1 ? '' : 's'}` : 'No verified record yet'}</p>
            <p className="mt-1 text-[11px] text-ink-3">Past figures are not a current-cycle score target.</p>
          </div>
          <div className="min-w-0 p-4">
            <p className="text-xs font-medium text-ink-3">Application deadline</p>
            <p className="mt-1 text-sm font-semibold text-ink">{deadlineSummary ? dayLabel(deadlineSummary) : 'Not verified yet'}</p>
            <p className="mt-1 text-[11px] text-ink-3">University-level date for this cycle</p>
          </div>
          <div className="min-w-0 p-4">
            <p className="text-xs font-medium text-ink-3">CUET exam date & marking scheme</p>
            {examDates.length ? <p className="mt-1 text-sm font-semibold text-ink">{examDates.map((fact) => fact.eventDate ? `${fact.label}: ${dayLabel(fact.eventDate)}` : fact.label).join(' · ')}</p> : <p className="mt-1 text-sm font-semibold text-ink">Check the latest NTA notice</p>}
            <Link to="/updates" className="mt-1 inline-flex text-[11px] font-semibold text-accent hover:underline">Official CUET updates <ExternalLink aria-hidden className="ml-1 size-3" /></Link>
          </div>
        </div>
      </Panel>
      <p className="mb-4 text-xs text-ink-3">When a deadline, exam date, marking rule or cut-off has not been verified for this cycle, we leave it blank rather than estimate it. Historical cut-offs are shown with their year, round and scoring basis.</p>

      <details className="admission-disclosure mb-3 overflow-hidden rounded-xl border border-rule bg-surface" data-section="pg-fit">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink marker:hidden">
          <span>Check whether your CUET subjects fit</span><span className="flex items-center gap-2 text-xs font-normal text-ink-3">Based on your profile<ChevronDown aria-hidden className="admission-chevron size-4" /></span>
        </summary>
        <div className="border-t border-rule p-4">
          <EligibilityLine e={elig.data?.results[0]} />
          {elig.error && <p className="mt-2 text-xs text-ink-3">The subject check is temporarily unavailable. The university’s own requirement is below.</p>}
          {targets.data && <TargetButton programmeId={id} targeted={targets.data.targets.some((t) => t.programmeId === id)} onChange={targets.reload} />}
        </div>
      </details>
      <h2 className="mb-3 mt-6 text-lg font-semibold text-ink">Admission requirements & process</h2>
      {d.current.subjects.length === 0 && d.current.eligibility.some((f) => parseRule(f.valueText)) ? (
        <details className="admission-disclosure mb-3 overflow-hidden rounded-xl border border-rule bg-surface" data-section="pg-subjects">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink marker:hidden">Required CUET subject combinations<ChevronDown aria-hidden className="admission-chevron size-4" /></summary>
          <div className="border-t border-rule p-4"><p className="text-sm text-ink-2">Arranged from the programme-specific eligibility text.</p><RuleBreakdown rule={parseRule(d.current.eligibility.find((f) => parseRule(f.valueText))!.valueText)!} /></div>
        </details>
      ) : (
        <Facts title="Required CUET subjects" id="pg-subjects" facts={d.current.subjects} missing={miss('subjects')} official={official} />
      )}
      <Facts title="Eligibility, as the university prints it" id="pg-elig" facts={d.current.eligibility} missing={miss('eligibility')} official={official} />
      <Facts title="How to apply" id="pg-proc" facts={d.current.procedure} missing={miss('procedure')} official={official} />
      <Facts title="Counselling" id="pg-couns" facts={d.current.counselling} missing={miss('counselling')} official={official} />
      <Facts title="Application deadline" id="pg-deadline" facts={deadlines} missing={miss('deadline')} official={official} />
      {examDates.length > 0 && <Facts title="CUET exam dates" id="pg-exam-dates" facts={examDates} missing={false} official={official} />}
      {otherDates.length > 0 && <Facts title="Other important dates" id="pg-dates" facts={otherDates} missing={false} official={official} />}

      <details className="admission-disclosure mb-5 overflow-hidden rounded-xl border border-rule bg-surface" data-section="pg-cutoffs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink marker:hidden">
          <span>Previous years’ cut-offs</span><span className="flex items-center gap-2 text-xs font-normal text-ink-3">{d.historicalCutoffs.length ? `${d.historicalCutoffs.length} historical records` : 'Not verified yet'}<ChevronDown aria-hidden className="admission-chevron size-4" /></span>
        </summary>
        <div className="border-t border-rule p-4">
        <p className="mb-3 text-sm text-ink-2">Published figures from earlier years and counselling rounds. They are reference points only, not this year’s required score or a guarantee of admission. Compare figures only when the year, category, round and scoring basis match.</p>
        {d.historicalCutoffs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule-strong bg-paper/70 px-4 py-3 text-sm text-ink-2" data-unavailable>
            No cut-off has been verified for this programme yet. {official && <a href={official} target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:underline">Check the university’s official page</a>}
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
        </div>
      </details>

      <PreporaAdvice programmeName={p.programmeName} subjects={requiredSubjects} progress={performance.data ?? undefined} loading={performance.loading} error={performance.error} />

      <details className="admission-disclosure mb-4 overflow-hidden rounded-xl border border-rule bg-surface" data-section="pg-official">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink marker:hidden"><span>Official pages</span><span className="flex items-center gap-2 text-xs font-normal text-ink-3">{d.officialPages.length} sources<ChevronDown aria-hidden className="admission-chevron size-4" /></span></summary>
        <div className="border-t border-rule px-4">
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
        </div>
      </details>
      <p className="mt-6 flex items-start gap-2 text-xs text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {d.note}
      </p>
    </div>
  );
}
