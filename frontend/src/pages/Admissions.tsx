/** University admissions: browse programmes by university type, CUET subject and year, and read one programme's requirements with their sources. */
import { ArrowRight, CalendarDays, ChevronDown, ExternalLink, Info, SearchX, Sparkles } from 'lucide-react';
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
  const subjectSummary = lines?.length ? lines[0] + (lines.length > 1 ? ` + ${lines.length - 1} alternative${lines.length > 2 ? 's' : ''}` : '') : 'No subject rule in our verified records yet';
  return (
    <li>
      <Panel className="admission-programme-card group relative overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-28px_rgb(24_68_59/0.45)]" data-programme={p.id}>
        <div className="h-1 bg-gradient-to-r from-forest via-[#91a94a] to-lime" />
        <div className="p-3.5 sm:p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              {p.universityType && <Badge>{p.universityType}</Badge>}
              <Badge tone="accent">{examName(p.exam)}</Badge>
              <Badge tone={p.cycle.status === 'PREVIOUS' ? 'amber' : 'zinc'}>{p.cycle.status === 'PREVIOUS' ? p.cycle.label ?? `${p.academicYear} · previous cycle` : `${p.academicYear} cycle`}</Badge>
            </div>
            <h3 className="mt-2.5 text-base font-bold leading-snug tracking-[-0.02em] text-forest">{p.programmeName}</h3>
            <Link to={`/universities/${p.universitySlug}`} className="mt-0.5 inline-flex text-[13px] text-ink-2 hover:text-accent hover:underline">
              {p.universityName}
            </Link>
          </div>
          <div className="mt-3 rounded-xl border border-[#dce5b5] bg-gradient-to-br from-[#f7f9e9] to-[#fffdf4] px-3 py-2.5" data-card-subjects>
            <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-forest/65">CUET subjects</p>
            <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-forest">{subjectSummary}</p>
          </div>
          {(p.nextDeadline || p.lastDeadline) && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ink-3"><CalendarDays aria-hidden className="size-3.5" />{p.nextDeadline ? `${p.nextDeadline.label}: ${dayLabel(p.nextDeadline.date)}` : `Last listed: ${dayLabel(p.lastDeadline!.date)}`}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-2.5">
            <Link to={`/admissions/programmes/${p.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[13px] font-semibold text-lime transition hover:bg-forest-deep" aria-label={`View admission details for ${p.programmeName}`}>
              Programme details <ArrowRight aria-hidden className="size-3.5" />
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
      <section className="admissions-hero relative mb-5 overflow-hidden rounded-[26px] border border-forest/10 bg-forest px-5 py-6 text-white shadow-[0_18px_48px_-30px_rgb(24_68_59/0.65)] sm:px-7 sm:py-7" data-admissions-hero>
        <span aria-hidden className="admissions-hero-orb absolute -right-12 -top-24 size-64 rounded-full border border-white/10 bg-white/[0.04]" />
        <span aria-hidden className="absolute right-20 top-16 size-20 rounded-full border border-lime/20" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-lime"><Sparkles aria-hidden className="size-3.5" />Find your next step</div>
          <h1 className="mt-3 text-[clamp(28px,4vw,42px)] font-bold leading-[1.04] tracking-[-0.045em]">A clearer path to your <span className="font-editorial font-medium italic text-lime">target course.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Compare CUET subject combinations, see what each university has published, and open a programme for sourced admission details.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/80">
            <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5">Official-source references</span>
            <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5">Cycle and date labels</span>
            <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5">No guessed cut-offs</span>
          </div>
        </div>
      </section>
      {targets.data && <MyTargets data={targets.data} reload={targets.reload} />}
      <div className="admissions-filter-panel mb-4 rounded-2xl border border-[#dfe5c8] bg-[#f8f9ef] p-3 sm:p-4" data-programme-filters>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-forest">Find a programme</p>
          <span className="text-[11px] text-ink-3">Filter by course, university or CUET paper</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2" data-programme-count>
            <div><p className="text-lg font-bold tracking-tight text-forest">{total} {total === 1 ? 'programme' : 'programmes'}</p><p className="text-xs text-ink-3">Open a programme to review its full details and source links.</p></div>
            {f.university && <span className="rounded-full bg-[#eaf0d5] px-3 py-1 text-[11px] font-medium text-forest">One university selected</span>}
          </div>
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
          {facts.length && !missing ? `${facts.length} sourced item${facts.length === 1 ? '' : 's'}` : 'Not in our records yet'}
          <ChevronDown aria-hidden className="admission-chevron size-4 shrink-0" />
        </span>
      </summary>
      <div className="border-t border-rule p-3 sm:p-4">
        {facts.length === 0 || missing ? (
          <div className="rounded-xl border border-dashed border-rule-strong bg-paper/70 px-4 py-3 text-sm text-ink-2" data-unavailable>
            {fallback ?? 'We have not added a source-checked detail for this section yet. This does not confirm that the university has not published it.'}{' '}
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
                  {(f.kind === 'SUBJECTS' || f.kind === 'ELIGIBILITY') && parseRule(f.valueText) ? (
                    <>
                      <RuleBreakdown rule={parseRule(f.valueText)!} />
                      <details className="mt-2 rounded-lg border border-rule bg-paper/60 px-3 py-2" data-official-wording>
                        <summary className="cursor-pointer text-xs font-semibold text-ink-2">Read the university’s wording</summary>
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-2">{f.valueText}</p>
                      </details>
                    </>
                  ) : f.kind === 'SUBJECTS' ? (
                    f.subjects && <div className="mt-2 flex flex-wrap gap-1.5">{f.subjects.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}</div>
                  ) : f.valueText ? (
                    f.kind === 'ELIGIBILITY' ? (
                      <details className="mt-2 rounded-lg border border-rule bg-paper/60 px-3 py-2" data-official-wording>
                        <summary className="cursor-pointer text-xs font-semibold text-ink-2">Read the university’s wording</summary>
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-2">{f.valueText}</p>
                      </details>
                    ) : <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{f.valueText}</p>
                  ) : null}
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
  const duHistorical = p.universitySlug === 'university-of-delhi' && p.cycle.status === 'PREVIOUS';
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
      <section className="admission-detail-hero relative mb-5 overflow-hidden rounded-[26px] border border-forest/10 bg-gradient-to-br from-[#173f37] via-forest to-[#315d4c] p-5 text-white shadow-[0_20px_50px_-32px_rgb(24_68_59/0.75)] sm:p-7" data-admission-detail-hero>
        <span aria-hidden className="absolute -right-10 -top-20 size-56 rounded-full border border-white/10 bg-white/[0.035]" />
        <div className="relative">
          <Link to="/admissions" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 transition hover:text-lime"><ArrowRight aria-hidden className="size-3.5 rotate-180" />All programmes</Link>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1">{p.universityType ?? 'University'}</span>
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1">{examName(p.exam)}</span>
            <span className="rounded-full border border-lime/25 bg-lime/10 px-2.5 py-1 text-lime">{p.academicYear} admissions</span>
          </div>
          <h1 className="mt-3 max-w-4xl text-[clamp(27px,4vw,42px)] font-bold leading-[1.05] tracking-[-0.045em]">{p.programmeName}</h1>
          <Link to={`/universities/${p.universitySlug}`} className="mt-2 inline-flex items-center gap-1 text-sm text-white/75 hover:text-lime hover:underline">{p.universityName}<ExternalLink aria-hidden className="size-3" /></Link>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <ReliabilityBadge r={p.reliability} on={p.lastVerifiedOn} cycle={p.cycle} />
            {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1.5 text-white/85 hover:bg-white/15">{p.sourceTitle ?? 'Official source'}{p.sourcePage ? ` · p. ${p.sourcePage}` : ''}<ExternalLink aria-hidden className="size-3" /></a>}
          </div>
        </div>
      </section>
      {p.cycle.status === 'PREVIOUS' && (
        <div role="note" data-previous-cycle-banner className="mb-5 rounded-xl border border-marker/40 bg-marker-soft px-4 py-3 text-sm text-ink">
          <p className="font-semibold">{p.cycle.label}: historical reference only</p>
          <p className="mt-0.5 text-ink-2">This is what {p.universityName} required in its {p.academicYear} admission cycle (CUET UG {p.academicYear.slice(0, 4)}). It is <strong>not confirmed for CUET UG 2027</strong> (2027–28 admissions): the requirements, subjects and dates may change. Check the university's official page when its next bulletin is published.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-admission-overview>
        <div className="admission-overview-tile rounded-2xl border border-[#dce5b5] bg-gradient-to-br from-[#f7f9e9] to-surface p-3.5 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-forest/65">CUET subjects</p><p className="mt-1.5 line-clamp-3 text-sm font-semibold leading-snug text-forest">{subjectSummary}</p><p className="mt-1 text-[10px] text-ink-3">{p.academicYear} cycle</p></div>
        <div className="admission-overview-tile rounded-2xl border border-rule bg-surface p-3.5 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Past cut-offs</p><p className="mt-1.5 text-sm font-semibold text-forest">{d.historicalCutoffs.length ? `${d.historicalCutoffs.length} sourced record${d.historicalCutoffs.length === 1 ? '' : 's'}` : 'No record in our sources'}</p><p className="mt-1 text-[10px] text-ink-3">Historical figures only</p></div>
        <div className="admission-overview-tile rounded-2xl border border-rule bg-surface p-3.5 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Application date</p><p className="mt-1.5 text-sm font-semibold text-forest">{deadlineSummary ? dayLabel(deadlineSummary) : 'Not in our records'}</p><p className="mt-1 text-[10px] text-ink-3">Confirm with university</p></div>
        <div className="admission-overview-tile rounded-2xl border border-rule bg-surface p-3.5 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">CUET exam dates</p>{examDates.length ? <p className="mt-1.5 text-sm font-semibold text-forest">{examDates.map((fact) => fact.eventDate ? `${fact.label}: ${dayLabel(fact.eventDate)}` : fact.label).join(' · ')}</p> : <p className="mt-1.5 text-sm font-semibold text-forest">See NTA notices</p>}<Link to="/updates" className="mt-1 inline-flex text-[10px] font-semibold text-accent hover:underline">Open official updates <ExternalLink aria-hidden className="ml-1 size-3" /></Link></div>
      </div>
      <div className="my-4 rounded-xl border border-[#e4e8c7] bg-[#f8f9ef] px-3.5 py-3 text-xs leading-relaxed text-ink-2"><span className="font-semibold text-forest">What we have and what is missing.</span> Each section below shows all source-checked information we hold. “Not in our records” means we have not added a verified detail; it does not mean the university has not published it. Historical cut-offs show their year and scoring basis and are not current targets.</div>

      <section className="mb-5 rounded-2xl border border-rule bg-surface p-4 sm:p-5" aria-label="Admission information checklist" data-admission-coverage>
        <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">At a glance</p><h2 className="mt-1 text-base font-bold text-forest">Information checklist</h2></div><span className="text-xs text-ink-3">Open a section below to read the source details</span></div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Subject combinations', d.current.subjects.length > 0 || Boolean(parsedSubjectRule)],
            ['Eligibility rules', d.current.eligibility.length > 0],
            ['Application process', d.current.procedure.length > 0 || duHistorical],
            ['Counselling', d.current.counselling.length > 0 || duHistorical],
            ['Application date', deadlines.length > 0],
            ['Past cut-offs', d.historicalCutoffs.length > 0],
          ].map(([label, available]) => <li key={String(label)} className={`rounded-xl border px-2.5 py-2 ${available ? 'border-[#dce5b5] bg-[#f7f9e9]' : 'border-rule bg-paper/55'}`}><span className={`block text-[11px] font-semibold ${available ? 'text-forest' : 'text-ink-2'}`}>{String(label)}</span><span className={`mt-1 block text-[10px] ${available ? 'text-forest/70' : 'text-ink-3'}`}>{available ? (duHistorical && (label === 'Application process' || label === 'Counselling') && !(label === 'Application process' ? d.current.procedure.length : d.current.counselling.length) ? 'Overview above' : 'Source added') : 'Not in records yet'}</span></li>)}
        </ul>
      </section>

      {duHistorical && (
        <details className="admission-disclosure mb-4 overflow-hidden rounded-xl border border-[#dce5b5] bg-[#f8f9ef]" data-du-admission-path>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-forest marker:hidden">
            <span>How DU admissions worked · 2026–27 reference</span><ChevronDown aria-hidden className="admission-chevron size-4 shrink-0" />
          </summary>
          <div className="border-t border-[#dce5b5] px-4 py-3.5">
            <ol className="space-y-2 text-sm leading-relaxed text-ink-2">
              <li><strong className="text-forest">1. Check eligibility.</strong> Choose CUET papers that match the programme and subjects you passed in Class XII.</li>
              <li><strong className="text-forest">2. Apply in DU CSAS separately.</strong> After CUET, submit the DU CSAS (UG) form and enter your programme and college preferences.</li>
              <li><strong className="text-forest">3. Follow each allocation notice.</strong> DU uses CUET scores for merit; Class XII marks are used for minimum eligibility and tie-breaking. Dates and actions vary by the official round schedule.</li>
            </ol>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a href="https://admission.uod.ac.in/userfiles/downloads/2026/17052026_Updated_FAQsUG%202026-final.pdf" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">DU UG FAQ 2026–27 <ExternalLink aria-hidden className="size-3" /></a>
              <a href="https://admission.uod.ac.in/userfiles/downloads/2026/02072026_CSAS-UG-Schedule_compressed.pdf" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Official CSAS schedule <ExternalLink aria-hidden className="size-3" /></a>
            </p>
            <p className="mt-2 text-[11px] text-ink-3">This explains the 2026–27 cycle only. It is not a current-cycle deadline or a prediction of the next process.</p>
          </div>
        </details>
      )}

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
      <Facts title="How to apply" id="pg-proc" facts={d.current.procedure} missing={miss('procedure')} official={official} fallback={duHistorical ? 'A short historical overview is above. Cycle-specific steps and dates are not yet in our source-checked records.' : undefined} />
      <Facts title="Counselling" id="pg-couns" facts={d.current.counselling} missing={miss('counselling')} official={official} fallback={duHistorical ? 'A short historical overview is above. Detailed actions depend on the official round notice and are not yet in our source-checked records.' : undefined} />
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
                  <td className="px-4 py-2.5 text-ink-2">{f.year}, {f.round}{f.label && <span className="mt-0.5 block text-xs text-ink-3">{f.label}</span>}</td>
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
