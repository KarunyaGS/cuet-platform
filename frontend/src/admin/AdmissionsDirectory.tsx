/** Admin console: programmes (publish, reject, withdraw) and the list of information that has gone out of date. */
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, Panel, SectionTitle, inputClass, useLoad } from '../ui';
import { consoleApi, type AdmissionSourceRow, type AdminProgramme } from './api';

const today = () => new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();
const TONE: Record<string, 'green' | 'amber' | 'red' | 'zinc'> = { PUBLISHED: 'green', DRAFT: 'amber', REJECTED: 'red', WITHDRAWN: 'red' };
const REL: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'zinc' }> = {
  VERIFIED_OFFICIAL: { label: 'Verified', tone: 'green' },
  OUTDATED: { label: 'Out of date', tone: 'amber' },
  UNVERIFIED: { label: 'Not verified', tone: 'zinc' },
  SOURCE_NOT_APPROVED: { label: 'Source not approved', tone: 'red' },
};

export function AdminNeedsAttention() {
  const o = useLoad(consoleApi.admissionOutdated, []);
  return (
    <section className="mt-10" aria-labelledby="adm-old" data-outdated>
      <SectionTitle id="adm-old">Needs attention: out of date</SectionTitle>
      {o.loading && !o.data ? (
        <Loading />
      ) : o.error ? (
        <ErrorBox error={o.error} onRetry={o.reload} />
      ) : o.data!.items.length === 0 ? (
        <Empty>Nothing published has gone out of date. Information is marked out of date when it was last checked more than {o.data!.staleAfterDays} days ago, or is about an earlier admission year.</Empty>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {o.data!.items.map((i) => (
            <li key={`${i.type}-${i.id}`} className="px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">{i.type === 'FACT' ? 'Fact' : i.type === 'PROGRAMME' ? 'Programme' : 'Source'}</Badge>
                <span className="text-ink">{i.label}</span>
                {i.university && <span className="text-ink-3">{i.university}</span>}
              </div>
              <div className="text-ink-2">{i.reason}{i.lastVerifiedOn ? ` (last checked ${i.lastVerifiedOn})` : ''}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminProgrammes({ sources, list }: { sources: AdmissionSourceRow[]; list: ReturnType<typeof useLoad<AdminProgramme[]>> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [f, setF] = useState({ universityName: '', sourceId: '', programmeName: '', degree: '', level: 'UG', academicYear: `${year}-${String(year + 1).slice(2)}`, exam: 'CUET_UG', sourcePage: '', sourceLocator: '', lastVerifiedOn: today() });
  const approved = sources.filter((s) => s.status === 'APPROVED');
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const run = async (key: string, work: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await work();
      setMsg(done);
      list.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="mt-10" aria-labelledby="adm-prog" data-programmes>
      <SectionTitle id="adm-prog">Programmes</SectionTitle>
      {err && <ErrorBox error={err} />}
      {msg && <div role="status" className="mb-3 rounded-lg border border-correct/30 bg-correct-soft px-4 py-2.5 text-sm text-correct">{msg}</div>}
      {approved.length === 0 ? (
        <Empty>Approve a source first. A programme must cite an approved source.</Empty>
      ) : (
        <Panel className="mb-5 max-w-3xl p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink">University (as NTA lists it)<input className={`${inputClass} mt-1`} value={f.universityName} onChange={(e) => set('universityName', e.target.value)} /></label>
            <label className="text-sm text-ink">Source
              <select data-prog-source className={`${inputClass} mt-1`} value={f.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                <option value="">Choose an approved source</option>
                {approved.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label className="text-sm text-ink sm:col-span-2">Programme name, as the university writes it<input className={`${inputClass} mt-1`} value={f.programmeName} onChange={(e) => set('programmeName', e.target.value)} /></label>
            <label className="text-sm text-ink">Degree<input className={`${inputClass} mt-1`} value={f.degree} onChange={(e) => set('degree', e.target.value)} placeholder="B.A. (Hons)" /></label>
            <label className="text-sm text-ink">Admission year<input className={`${inputClass} mt-1`} value={f.academicYear} onChange={(e) => set('academicYear', e.target.value)} placeholder="2026-27" /></label>
            <label className="text-sm text-ink">Exam and level
              <span className="mt-1 flex gap-2">
                <select className={inputClass} value={f.exam} onChange={(e) => set('exam', e.target.value)}><option value="CUET_UG">CUET UG</option></select>
                <select className={inputClass} value={f.level} onChange={(e) => set('level', e.target.value)}><option value="UG">UG</option></select>
              </span>
            </label>
            <label className="text-sm text-ink">Page in the source<input data-prog-page className={`${inputClass} mt-1`} type="number" value={f.sourcePage} onChange={(e) => set('sourcePage', e.target.value)} /></label>
            <label className="text-sm text-ink">Or a locator<input className={`${inputClass} mt-1`} value={f.sourceLocator} onChange={(e) => set('sourceLocator', e.target.value)} /></label>
            <label className="text-sm text-ink">Day you checked it<input className={`${inputClass} mt-1`} type="date" value={f.lastVerifiedOn} onChange={(e) => set('lastVerifiedOn', e.target.value)} /></label>
          </div>
          <div className="mt-4">
            <Button
              disabled={busy === 'new'}
              onClick={() =>
                run('new', () => consoleApi.addProgramme({ ...f, degree: f.degree || null, sourcePage: f.sourcePage === '' ? null : Number(f.sourcePage), sourceLocator: f.sourceLocator || null }), 'Saved as a draft. It is not shown to students until you publish it.')
              }
            >
              Save programme as a draft
            </Button>
          </div>
        </Panel>
      )}
      {list.loading && !list.data ? (
        <Loading />
      ) : (list.data ?? []).length === 0 ? (
        <Empty>No programme yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.data!.map((p) => (
            <li key={p.id}>
              <Panel className="p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={TONE[p.status] ?? 'zinc'}>{p.status === 'PUBLISHED' ? 'Shown to students' : p.status === 'DRAFT' ? 'Draft' : p.status === 'WITHDRAWN' ? 'Withdrawn' : 'Rejected'}</Badge>
                  <Badge tone={REL[p.reliability]?.tone ?? 'zinc'}>{REL[p.reliability]?.label ?? p.reliability}</Badge>
                  <span className="font-medium text-ink">{p.programmeName}</span>
                  <span className="text-ink-2">{p.universityName}{p.universityType ? ` (${p.universityType})` : ''} · {p.academicYear} · {p.exam}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink-3">{p.sourceTitle}{p.sourcePage ? `, page ${p.sourcePage}` : p.sourceLocator ? `, ${p.sourceLocator}` : ''} · checked {p.lastVerifiedOn} · {p.publishedFacts} published facts</div>
                {p.statusNote && <div className="mt-0.5 text-xs text-ink-2">{p.statusNote}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {['DRAFT', 'WITHDRAWN'].includes(p.status) && <Button size="sm" disabled={busy === p.id} onClick={() => run(p.id, () => consoleApi.decideProgramme(p.id, { action: 'PUBLISH' }), 'Published.')}>Publish</Button>}
                  {p.status === 'PUBLISHED' && <input aria-label={`Why withdraw ${p.programmeName}`} className={`${inputClass} h-8 w-64 py-0`} placeholder="Why withdraw it?" value={reason[p.id] ?? ''} onChange={(e) => setReason((r) => ({ ...r, [p.id]: e.target.value }))} />}
                  {p.status === 'PUBLISHED' && <Button size="sm" kind="danger" disabled={busy === p.id || (reason[p.id] ?? '').trim().length < 5} onClick={() => run(p.id, () => consoleApi.decideProgramme(p.id, { action: 'WITHDRAW', reason: reason[p.id]!.trim() }), 'Withdrawn.')}>Withdraw</Button>}
                  {p.status === 'DRAFT' && <Button size="sm" kind="danger" disabled={busy === p.id} onClick={() => run(p.id, () => consoleApi.decideProgramme(p.id, { action: 'REJECT', reason: 'Not confirmed against the source' }), 'Rejected.')}>Reject</Button>}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
