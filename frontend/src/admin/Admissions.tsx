/** Admin console: admissions information. Sources are approved after opening the page; facts cite an approved source and are published by staff. */
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SectionTitle, StatGroup, inputClass, useLoad } from '../ui';
import { consoleApi, when } from './api';
import { AdminNeedsAttention, AdminProgrammes } from './AdmissionsDirectory';

const REC: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  USE: { label: 'Review: use', tone: 'green' },
  USE_WITH_CARE: { label: 'Review: use with care', tone: 'amber' },
  NOT_VERIFIED: { label: 'Review: not verified', tone: 'zinc' },
  DO_NOT_USE: { label: 'Review: do not use', tone: 'red' },
};
const today = () => new Date().toISOString().slice(0, 10);
const blankFact = { universityName: '', sourceId: '', kind: 'CUTOFF', exam: 'CUET_UG', year: new Date().getFullYear(), programme: '', label: '', valueText: '', valueNumber: '', basis: 'ALLOCATION_SCORE', category: '', round: '', eventDate: '', sourcePage: '', sourceLocator: '', checkedOn: today(), programmeId: '', subjects: '', eventType: '' };

export function AdminAdmissions() {
  const o = useLoad(consoleApi.admissions, []);
  const sources = useLoad(consoleApi.admissionSources, []);
  const facts = useLoad(() => consoleApi.admissionFacts(), []);
  const programmes = useLoad(consoleApi.admissionProgrammes, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [form, setForm] = useState(blankFact);
  const reload = () => (o.reload(), sources.reload(), facts.reload());
  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await work();
      if (done) setMsg(done);
      reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(null);
    }
  };
  if (o.loading && !o.data) return <Loading />;
  if (o.error) return <ErrorBox error={o.error} onRetry={o.reload} />;
  const d = o.data!;
  const approved = (sources.data ?? []).filter((s) => s.status === 'APPROVED');
  const set = (k: keyof typeof blankFact, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const submitFact = () =>
    run(
      'fact',
      () =>
        consoleApi.addAdmissionFact({
          universityName: form.universityName, sourceId: form.sourceId, kind: form.kind, exam: form.exam, year: Number(form.year), programme: form.programme || null, label: form.label,
          valueText: form.valueText || null, valueNumber: form.valueNumber === '' ? null : Number(form.valueNumber), basis: form.kind === 'CUTOFF' ? form.basis : null,
          category: (form.kind === 'EVENT' ? form.eventType : form.category) || null, round: form.round || null, eventDate: form.eventDate || null, sourcePage: form.sourcePage === '' ? null : Number(form.sourcePage),
          sourceLocator: form.sourceLocator || null, checkedOn: form.checkedOn, programmeId: form.programmeId || null,
          subjects: form.kind === 'SUBJECTS' ? form.subjects.split(',').map((x) => x.trim()).filter(Boolean) : null,
        }),
      'Saved as a draft. It is not shown to students until you publish it.',
    );

  return (
    <div>
      <PageHeader
        title="Admissions information"
        subtitle="Nothing reaches students until a source is approved after you open its page, and a fact is published by a person. Candidate names and roll numbers are never stored."
        actions={
          <Button kind="secondary" disabled={busy === 'load'} onClick={() => run('load', consoleApi.loadAdmissionSources, 'Loaded the sources from the review. They are proposed only.')}>
            Load the reviewed sources
          </Button>
        }
      />
      {err && <ErrorBox error={err} />}
      {msg && (
        <div role="status" className="mb-4 rounded-lg border border-correct/30 bg-correct-soft px-4 py-3 text-sm text-correct">
          {msg}
        </div>
      )}
      <StatGroup
        items={[
          { label: 'Sources proposed', value: d.sources.proposed, tone: d.sources.proposed ? 'wrong' : undefined },
          { label: 'Sources approved', value: d.sources.approved },
          { label: 'Facts in draft', value: d.facts.draft, tone: d.facts.draft ? 'wrong' : undefined },
          { label: 'Facts shown to students', value: d.facts.published },
        ]}
      />

      <section className="mt-8" aria-labelledby="adm-src">
        <SectionTitle id="adm-src">Sources</SectionTitle>
        {sources.loading && !sources.data ? (
          <Loading />
        ) : (sources.data ?? []).length === 0 ? (
          <Empty>No source is registered yet. Load the reviewed sources to start.</Empty>
        ) : (
          <ul className="space-y-3">
            {sources.data!.map((s) => (
              <li key={s.id}>
                <Panel className="p-4" >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.status === 'APPROVED' ? 'green' : s.status === 'RETIRED' ? 'red' : 'amber'}>{s.status === 'APPROVED' ? 'Approved' : s.status === 'RETIRED' ? 'Retired' : 'Proposed'}</Badge>
                    <Badge tone={REC[s.recommendation]?.tone ?? 'zinc'}>{REC[s.recommendation]?.label ?? s.recommendation}</Badge>
                    {s.personalDataRisk === 'LISTS_LINKED' && <Badge tone="red" title="This site links to lists of candidates. Link to them; never store them.">Candidate lists linked</Badge>}
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="min-w-0 truncate font-medium text-accent hover:underline">
                      {s.title}
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{s.covers}</p>
                  {s.reliabilityNote && <p className="mt-1 whitespace-pre-line text-sm text-ink-3">{s.reliabilityNote}</p>}
                  <p className="mt-1 text-xs text-ink-3">
                    {s.format} · {s.updateFrequency ?? 'update frequency unknown'}
                    {s.lastCheckedOn ? ` · checked ${s.lastCheckedOn}` : ''}
                    {s.reviewedBy ? ` · by ${s.reviewedBy.replace(/^user:/, '')} ${s.reviewedAt ? when(s.reviewedAt) : ''}` : ''} · {s.publishedFacts} published, {s.draftFacts} draft
                  </p>
                  {s.status !== 'RETIRED' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {s.status === 'PROPOSED' && (
                        <>
                          <input aria-label="Why you are approving it (needed when the review advised against it)" placeholder="Note (what you checked)" className={`${inputClass} h-9 max-w-xs py-0`} value={note[s.id] ?? ''} onChange={(e) => setNote((n) => ({ ...n, [s.id]: e.target.value }))} />
                          <Button size="sm" disabled={busy === s.id} onClick={() => run(s.id, () => consoleApi.decideAdmissionSource(s.id, { action: 'APPROVE', checkedOn: today(), note: note[s.id] || undefined }), 'Approved. Checked today.')}>
                            I opened it and checked it: approve
                          </Button>
                        </>
                      )}
                      <Button size="sm" kind="danger" disabled={busy === s.id} onClick={() => run(s.id, () => consoleApi.decideAdmissionSource(s.id, { action: 'RETIRE' }), 'Retired. Facts that cite it are hidden.')}>
                        Retire
                      </Button>
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="adm-facts">
        <SectionTitle id="adm-facts">Add a fact</SectionTitle>
        {approved.length === 0 ? (
          <Empty>Approve a source first. A fact must cite an approved source.</Empty>
        ) : (
          <Panel className="max-w-3xl p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink">University (as NTA lists it)<input className={`${inputClass} mt-1`} value={form.universityName} onChange={(e) => set('universityName', e.target.value)} /></label>
              <label className="text-sm text-ink">Source
                <select className={`${inputClass} mt-1`} value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                  <option value="">Choose an approved source</option>
                  {approved.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink">Kind
                <select className={`${inputClass} mt-1`} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                  <option value="CUTOFF">Cut-off</option>
                  <option value="EVENT">Dated step</option>
                  <option value="ELIGIBILITY">Eligibility (as printed)</option>
                  <option value="SUBJECTS">Required CUET subjects</option>
                  <option value="PROCEDURE">Admission procedure (as printed)</option>
                  <option value="COUNSELLING">Counselling procedure (as printed)</option>
                </select>
              </label>
              <label className="text-sm text-ink">Exam and year
                <span className="mt-1 flex gap-2">
                  <select className={inputClass} value={form.exam} onChange={(e) => set('exam', e.target.value)}><option value="CUET_UG">CUET UG</option><option value="CUET_PG">CUET PG</option></select>
                  <input className={inputClass} type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
                </span>
              </label>
              <label className="text-sm text-ink sm:col-span-2">What it is (as the source words it)<input className={`${inputClass} mt-1`} value={form.label} onChange={(e) => set('label', e.target.value)} /></label>
              <label className="text-sm text-ink">Programme (a published or draft one)
                <select data-fact-programme className={`${inputClass} mt-1`} value={form.programmeId} onChange={(e) => set('programmeId', e.target.value)}>
                  <option value="">None, or type a name below</option>
                  {(programmes.data ?? []).filter((p) => p.status !== 'REJECTED').map((p) => <option key={p.id} value={p.id}>{p.programmeName} ({p.universityName}, {p.academicYear})</option>)}
                </select>
              </label>
              <label className="text-sm text-ink">Programme name (if none chosen)<input className={`${inputClass} mt-1`} value={form.programme} onChange={(e) => set('programme', e.target.value)} /></label>
              {form.kind === 'CUTOFF' && (
                <>
                  <label className="text-sm text-ink">Figure and what it measures
                    <span className="mt-1 flex gap-2">
                      <input className={inputClass} type="number" step="any" value={form.valueNumber} onChange={(e) => set('valueNumber', e.target.value)} />
                      <select className={inputClass} value={form.basis} onChange={(e) => set('basis', e.target.value)}>
                        <option value="ALLOCATION_SCORE">Allocation score</option><option value="NORMALISED_SCORE">Normalised score</option><option value="PERCENTILE">Percentile</option><option value="MARKS">Marks</option><option value="RANK">Rank</option>
                      </select>
                    </span>
                  </label>
                  <label className="text-sm text-ink">Category<input className={`${inputClass} mt-1`} value={form.category} onChange={(e) => set('category', e.target.value)} /></label>
                  <label className="text-sm text-ink">Round or list<input className={`${inputClass} mt-1`} value={form.round} onChange={(e) => set('round', e.target.value)} /></label>
                </>
              )}
              {form.kind === 'EVENT' && <label className="text-sm text-ink">Type of step<select className={`${inputClass} mt-1`} value={form.eventType} onChange={(e) => set('eventType', e.target.value)}><option value="">Other</option><option value="REGISTRATION_OPENS">Registration opens</option><option value="APPLICATION_DEADLINE">Application deadline</option><option value="COUNSELLING_ROUND">Counselling round</option><option value="ALLOCATION_LIST">Allocation list</option><option value="REPORTING">Reporting</option></select></label>}
              {form.kind === 'EVENT' && <label className="text-sm text-ink">Date<input className={`${inputClass} mt-1`} type="date" value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} /></label>}
              {form.kind === 'SUBJECTS' && <label className="text-sm text-ink sm:col-span-2">The subjects, separated by commas<input data-fact-subjects className={`${inputClass} mt-1`} value={form.subjects} onChange={(e) => set('subjects', e.target.value)} placeholder="English, Mathematics, Economics" /></label>}
              {['ELIGIBILITY', 'SUBJECTS', 'PROCEDURE', 'COUNSELLING'].includes(form.kind) && <label className="text-sm text-ink sm:col-span-2">The text, exactly as printed<textarea data-fact-text className={`${inputClass} mt-1`} rows={3} value={form.valueText} onChange={(e) => set('valueText', e.target.value)} /></label>}
              <label className="text-sm text-ink">Page in the source<input className={`${inputClass} mt-1`} type="number" value={form.sourcePage} onChange={(e) => set('sourcePage', e.target.value)} /></label>
              <label className="text-sm text-ink">Or a locator (table, heading)<input className={`${inputClass} mt-1`} value={form.sourceLocator} onChange={(e) => set('sourceLocator', e.target.value)} /></label>
              <label className="text-sm text-ink">Day you checked it<input className={`${inputClass} mt-1`} type="date" value={form.checkedOn} onChange={(e) => set('checkedOn', e.target.value)} /></label>
            </div>
            <div className="mt-4"><Button disabled={busy === 'fact'} onClick={submitFact}>Save as a draft</Button></div>
          </Panel>
        )}
      </section>

      <section className="mt-10" aria-labelledby="adm-list">
        <SectionTitle id="adm-list">Facts</SectionTitle>
        {facts.loading && !facts.data ? (
          <Loading />
        ) : (facts.data ?? []).length === 0 ? (
          <Empty>No facts yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {facts.data!.map((f) => (
              <li key={f.id}>
                <Panel className="p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={f.status === 'PUBLISHED' ? 'green' : f.status === 'REJECTED' ? 'red' : 'amber'}>{f.status === 'PUBLISHED' ? 'Shown to students' : f.status === 'REJECTED' ? 'Rejected' : 'Draft'}</Badge>
                    <Badge>{f.kind}</Badge>
                    <span className="font-medium text-ink">{f.universityName}</span>
                    <span className="text-ink-2">{f.programme ?? ''} {f.valueNumber !== null ? `${f.valueNumber} (${f.basis})` : ''} {f.eventDate ?? ''}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-ink-2">{f.label}{f.valueText ? `: ${f.valueText}` : ''}</div>
                  <div className="mt-0.5 text-xs text-ink-3">{f.sourceTitle}{f.sourcePage ? `, page ${f.sourcePage}` : f.sourceLocator ? `, ${f.sourceLocator}` : ''} · checked {f.checkedOn}{f.sourceStatus !== 'APPROVED' ? ' · its source is no longer approved' : ''}</div>
                  {f.status === 'DRAFT' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={busy === f.id} onClick={() => run(f.id, () => consoleApi.decideAdmissionFact(f.id, { action: 'PUBLISH' }), 'Published.')}>Publish</Button>
                      <Button size="sm" kind="danger" disabled={busy === f.id} onClick={() => run(f.id, () => consoleApi.decideAdmissionFact(f.id, { action: 'REJECT', reason: 'Not confirmed against the source' }), 'Rejected.')}>Reject</Button>
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AdminProgrammes sources={sources.data ?? []} list={programmes} />
      <AdminNeedsAttention />
    </div>
  );
}
