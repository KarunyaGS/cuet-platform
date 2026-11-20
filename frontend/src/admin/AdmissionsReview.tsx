/**
 * Admin console: reviewing the server's reading of each university's printed subject rule, the lists (List A, List B) the rules refer to, and
 * the data checks. The printed text is always shown beside the reading, because the reading is only a draft until a person approves it.
 */
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, Panel, SectionTitle, inputClass, useLoad } from '../ui';
import { consoleApi, type AdmissionValidation, type GroupDetailAdmin, type ReqDetail, type ReqIssue, type ReqItem, type ReqRule, type ReviewEvent } from './api';

type Tone = 'green' | 'amber' | 'red' | 'zinc';
const STATUS_TONE: Record<string, Tone> = { APPROVED: 'green', DRAFT: 'amber', NEEDS_UNIVERSITY_CONFIRMATION: 'amber', REJECTED: 'red', SUPERSEDED: 'zinc', PUBLISHED: 'green', WITHDRAWN: 'red' };
const SEVERITY_TONE: Record<string, Tone> = { BLOCKING: 'red', REVIEW: 'amber', INFO: 'zinc', ERROR: 'red', WARNING: 'amber' };
const when = (d: string) => new Date(d.includes('T') ? d : `${d.replace(' ', 'T')}Z`).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

type Req = { kind: string; subject?: { status: string; text: string; paperCode?: string }; group?: string | null; n?: number; of?: { status: string; text: string; paperCode?: string }[]; otherThanNamed?: boolean; text?: string };
const ref = (s: { status: string; text: string; paperCode?: string }) => (s.status === 'MAPPED' ? `${s.text} (${s.paperCode})` : `${s.text} [${s.status.toLowerCase()}]`);
function line(r: Req): string {
  switch (r.kind) {
    case 'SUBJECT': return `${ref(r.subject!)}${r.group ? `, from ${r.group.replace('_', ' ')}` : ''}`;
    case 'ANY_N_OF_GROUP': return `any ${r.n} from ${String(r.group).replace('_', ' ')}${r.otherThanNamed ? ' (other than the one named)' : ''}`;
    case 'ANY_N_OF_SET': return `any ${r.n} of: ${r.of!.map(ref).join(' or ')}`;
    default: return `NOT UNDERSTOOD: "${r.text}"`;
  }
}

function Issues({ issues, resolutions }: { issues: ReqIssue[]; resolutions?: ReqRule['resolutions'] }) {
  return (
    <>
      {issues.length === 0 && <p className="text-xs text-ink-3">No open questions.</p>}
      <ul className="space-y-1">
        {issues.map((i, k) => (
          <li key={`${i.code}-${k}`} className="flex flex-wrap items-start gap-1.5 text-xs text-ink-2">
            <Badge tone={SEVERITY_TONE[i.severity]}>{i.severity.toLowerCase()}</Badge>
            <span className="font-mono text-[11px] text-ink-3">{i.code}</span>
            <span className="min-w-0 flex-1">{i.message}</span>
          </li>
        ))}
      </ul>
      {resolutions && Object.keys(resolutions).length > 0 && (
        <div className="mt-2 border-t border-rule pt-2">
          <p className="text-xs font-semibold text-ink">Answered by a reviewer</p>
          <ul className="mt-1 space-y-1 text-xs text-ink-2">
            {Object.entries(resolutions).map(([code, r]) => (
              <li key={code}>
                <span className="font-mono text-[11px] text-ink-3">{code}</span>: {r.note}
                {r.sourceUrl && <> (<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline">confirmation</a>)</>}
                <span className="text-ink-3"> — {r.by}, {when(r.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function History({ events }: { events: ReviewEvent[] }) {
  return (
    <ol className="space-y-1.5 text-xs" data-history>
      {events.map((e, i) => {
        const snap = e.snapshot && typeof e.snapshot === 'object' ? (e.snapshot as Record<string, unknown>) : null;
        return (
          <li key={i} className="rounded-lg border border-rule bg-paper/60 px-2.5 py-1.5">
            <span className="font-semibold text-ink">{e.action.replace(/_/g, ' ').toLowerCase()}</span>
            {e.from_status && e.to_status && <span className="text-ink-3"> · {e.from_status} → {e.to_status}</span>}
            <span className="text-ink-3"> · {e.actor} · {when(e.created_at)}</span>
            {e.note && <p className="mt-0.5 text-ink-2">{e.note}</p>}
            {snap && snap.sourceUrl ? (
              <p className="mt-0.5 text-[11px] text-ink-3">
                Source then: {String(snap.sourceUrl)}{snap.sourcePage ? `, page ${String(snap.sourcePage)}` : ''}, admission year {String(snap.academicYear ?? '')}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function RequirementDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const d = useLoad(() => consoleApi.requirement(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState('');
  const [resJson, setResJson] = useState('{}');
  if (d.loading && !d.data) return <Loading />;
  if (d.error || !d.data) return <ErrorBox error={d.error ?? new Error('Not found')} onRetry={d.reload} />;
  const r: ReqDetail = d.data;
  const open = ['DRAFT', 'NEEDS_UNIVERSITY_CONFIRMATION'].includes(r.status);
  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await work();
      setNote('');
      setEditing(false);
      d.reload();
      onChanged();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(null);
    }
  };
  const decide = (action: 'APPROVE' | 'REJECT' | 'NEEDS_UNIVERSITY_CONFIRMATION' | 'REOPEN') => run(action, () => consoleApi.decideRequirement(id, { action, note }));
  const startEdit = () => {
    setJson(JSON.stringify(r.rule.combinations.map((c) => ({ label: c.label, requirements: c.requirements, effective: c.effective })), null, 1));
    setResJson('{}');
    setEditing(true);
  };
  const saveRevision = () =>
    run('revise', async () => {
      let combinations: unknown;
      let resolutions: unknown;
      try { combinations = JSON.parse(json); resolutions = JSON.parse(resJson); } catch { throw new Error('The edit is not valid JSON'); }
      await consoleApi.reviseRequirement(id, { combinations, extraTests: r.rule.extraTests, resolutions, note });
    });
  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2" data-requirement-detail={id}>
      <section aria-label="Printed by the university" className="min-w-0">
        <h4 className="text-sm font-semibold text-ink">What the university printed</h4>
        <p className="mt-0.5 text-xs text-ink-3 [overflow-wrap:anywhere]">
          <a href={r.source.sourceUrl} target="_blank" rel="noreferrer" className="underline">{r.source.sourceTitle}</a>
          {r.source.sourcePage ? `, page ${r.source.sourcePage}` : ''} · admission year {r.source.academicYear} · last verified {r.source.lastVerifiedOn}
        </p>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-paper p-3 text-xs leading-relaxed text-ink [overflow-wrap:anywhere]" data-printed-text>{r.printedText}</pre>
        {r.printedTextChanged && <p role="alert" className="mt-2 text-xs font-semibold text-wrong">The printed text has changed since this was read. Read the rules again before approving.</p>}
        {r.factFlagged && <p role="alert" className="mt-2 text-xs font-semibold text-wrong">The printed text carries a review flag: {r.factFlag}</p>}
      </section>
      <section aria-label="Read by the server" className="min-w-0">
        <h4 className="text-sm font-semibold text-ink">How the server read it <span className="font-normal text-ink-3">(draft until approved)</span></h4>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <Badge tone={STATUS_TONE[r.status]}>{r.status.replace(/_/g, ' ').toLowerCase()}</Badge>
          <Badge>version {r.version}</Badge>
          <Badge>{r.origin === 'PARSER' ? 'read by the server' : 'edited by a reviewer'}</Badge>
          <Badge>{r.family.replace(/_/g, ' ').toLowerCase()}</Badge>
        </div>
        <ol className="mt-2 space-y-2" data-parsed>
          {r.rule.combinations.map((c) => (
            <li key={c.label} className="rounded-lg border border-rule bg-surface p-2.5 text-xs text-ink">
              <p className="font-semibold">{c.label}</p>
              <ul className="mt-1 list-disc pl-4 text-ink-2">
                {(c.effective as Req[]).map((q, i) => <li key={i}>{line(q)}</li>)}
              </ul>
            </li>
          ))}
        </ol>
        {r.rule.extraTests.length > 0 && <p className="mt-2 text-xs text-ink-2">Also set by the university (not CUET papers): {r.rule.extraTests.map((t) => t.kind.replace(/_/g, ' ').toLowerCase()).join(', ')}</p>}
        {r.rule.groupsNeeded.length > 0 && <p className="mt-2 text-xs text-ink-3">Needs the university's {r.rule.groupsNeeded.map((g) => g.replace('_', ' ')).join(' and ')} to be published before students can be shown a result.</p>}
        <div className="mt-3"><Issues issues={r.openIssues} resolutions={r.rule.resolutions} /></div>
        {r.approvalBlockers.length > 0 && open && <p className="mt-2 text-xs font-semibold text-ink">Cannot be approved yet: {r.approvalBlockers.length} question{r.approvalBlockers.length === 1 ? '' : 's'} still open.</p>}
      </section>

      <section className="lg:col-span-2" aria-label="Decision">
        {err && <ErrorBox error={err} />}
        <label className="block text-xs font-medium text-ink">
          Reviewer note (required: what you checked, or what you changed and why)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputClass} mt-1 w-full`} data-review-note />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {open && <Button onClick={() => void decide('APPROVE')} disabled={!r.canApprove || note.trim().length < 5 || busy !== null} data-action="approve">{busy === 'APPROVE' ? 'Approving…' : 'Approve'}</Button>}
          {open && <Button kind="secondary" onClick={() => void decide('REJECT')} disabled={note.trim().length < 5 || busy !== null}>Reject</Button>}
          {r.status === 'DRAFT' && <Button kind="secondary" onClick={() => void decide('NEEDS_UNIVERSITY_CONFIRMATION')} disabled={note.trim().length < 5 || busy !== null}>Ask the university</Button>}
          {r.status === 'APPROVED' && <Button kind="secondary" onClick={() => void decide('REJECT')} disabled={note.trim().length < 5 || busy !== null}>Withdraw approval</Button>}
          {['REJECTED', 'NEEDS_UNIVERSITY_CONFIRMATION'].includes(r.status) && <Button kind="ghost" onClick={() => void decide('REOPEN')} disabled={note.trim().length < 5 || busy !== null}>Reopen as draft</Button>}
          {r.status !== 'SUPERSEDED' && <Button kind="ghost" onClick={startEdit}>Revise the reading</Button>}
        </div>
        {editing && (
          <div className="mt-3 space-y-2 rounded-lg border border-rule bg-paper p-3" data-revise>
            <p className="text-xs text-ink-2">Edit the combinations (JSON). A revision is saved as a new draft version; the old version stays in the history. Problems in the structure cannot be answered with a note: change the reading itself.</p>
            <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={12} className={`${inputClass} w-full font-mono text-xs`} aria-label="Combinations" />
            <label className="block text-xs font-medium text-ink">
              Answers to open questions from the text, by code, for example {'{"ALL_OR_ANY_NOT_STATED":{"note":"...","sourceUrl":"https://..."}}'}
              <textarea value={resJson} onChange={(e) => setResJson(e.target.value)} rows={3} className={`${inputClass} mt-1 w-full font-mono text-xs`} />
            </label>
            <div className="flex gap-2">
              <Button onClick={saveRevision} disabled={note.trim().length < 5 || busy !== null}>{busy === 'revise' ? 'Saving…' : 'Save as a new draft version'}</Button>
              <Button kind="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </section>
      <section className="lg:col-span-2" aria-label="History">
        <h4 className="mb-1.5 text-sm font-semibold text-ink">History</h4>
        <History events={r.history} />
      </section>
    </div>
  );
}

export function AdminRequirementsReview() {
  const [status, setStatus] = useState('');
  const [university, setUniversity] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const list = useLoad(() => consoleApi.requirements({ status, university }), [status, university]);
  const read = async (dryRun: boolean) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await consoleApi.readRequirements(dryRun);
      setMsg(`${dryRun ? 'Would read' : 'Read'} ${r.examined} programmes: ${r.created} new or changed, ${r.unchanged} unchanged, ${r.noPrintedRule} without a printed rule. ${dryRun ? 'Nothing was saved.' : 'Saved as drafts.'}`);
      if (!dryRun) list.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-10" aria-labelledby="req-review" data-requirements-review>
      <SectionTitle id="req-review">Subject requirements: review</SectionTitle>
      <p className="mb-3 max-w-3xl text-sm text-ink-2">
        The server reads each university's printed subject rule into combinations. A reading is a draft: check it against the printed text, then approve, reject, ask the university, or revise it. Only an approved reading, whose text is still published and has no open flag, is ever used for a student's result.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} h-9 w-auto py-0`} aria-label="Status">
          <option value="">Current versions</option>
          {['DRAFT', 'NEEDS_UNIVERSITY_CONFIRMATION', 'APPROVED', 'REJECTED', 'SUPERSEDED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
        </select>
        <select value={university} onChange={(e) => setUniversity(e.target.value)} className={`${inputClass} h-9 w-auto py-0`} aria-label="University">
          <option value="">All universities</option>
          <option value="university-of-delhi">University of Delhi</option>
          <option value="banaras-hindu-university">Banaras Hindu University</option>
          <option value="jawaharlal-nehru-university">JNU</option>
        </select>
        <Button kind="secondary" onClick={() => void read(true)} disabled={busy}>Check what would change</Button>
        <Button kind="secondary" onClick={() => void read(false)} disabled={busy}>Read the rules again (saves drafts)</Button>
        {list.data && <span className="text-xs text-ink-3">{Object.entries(list.data.byStatus).map(([k, v]) => `${v} ${k.replace(/_/g, ' ').toLowerCase()}`).join(' · ')}</span>}
      </div>
      {msg && <p role="status" className="mb-2 text-sm text-correct">{msg}</p>}
      {err && <ErrorBox error={err} />}
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.data!.items.length === 0 ? <Empty>No requirements read yet. Use "Read the rules again".</Empty> : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {list.data!.items.map((r: ReqItem) => (
            <li key={r.id} className="px-4 py-3" data-requirement={r.id}>
              <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id} className="flex w-full flex-wrap items-center gap-2 text-left text-sm">
                <span className="min-w-0 flex-1 font-medium text-ink">{r.programme.name}</span>
                <span className="text-xs text-ink-3">{r.programme.university}</span>
                <Badge tone={STATUS_TONE[r.status]}>{r.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                {r.approvalBlockers.length > 0 && <Badge tone="amber">{r.approvalBlockers.length} open</Badge>}
                {r.factFlagged && <Badge tone="red">flagged</Badge>}
                {r.printedTextChanged && <Badge tone="red">text changed</Badge>}
              </button>
              {openId === r.id && <RequirementDetail id={r.id} onChanged={list.reload} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GroupPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const d = useLoad(() => consoleApi.admissionGroup(id), [id]);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  if (d.loading && !d.data) return <Loading />;
  if (d.error || !d.data) return <ErrorBox error={d.error ?? new Error('Not found')} onRetry={d.reload} />;
  const g: GroupDetailAdmin = d.data;
  const decide = async (action: 'PUBLISH' | 'REJECT' | 'WITHDRAW') => {
    setBusy(true);
    setErr(null);
    try {
      await consoleApi.decideGroup(id, { action, note, confirmMembers: confirm });
      setNote('');
      d.reload();
      onChanged();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-3" data-group-detail={id}>
      <p className="text-xs text-ink-3 [overflow-wrap:anywhere]">
        <a href={g.source_url} target="_blank" rel="noreferrer" className="underline">{g.source_title}</a>
        {g.source_page ? `, page ${g.source_page}` : ''} · {g.source_locator} · checked {g.checked_on}
      </p>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-ink-3"><th className="py-1 font-normal">As printed</th><th className="font-normal">NTA paper</th><th className="font-normal">Match</th></tr></thead>
        <tbody className="divide-y divide-rule">
          {g.members.map((m) => (
            <tr key={m.id}>
              <td className="py-1 pr-2 text-ink">{m.printed_name}</td>
              <td className="pr-2 text-ink-2">{m.paper_code ?? 'none'}</td>
              <td className="text-ink-2">
                {m.mapping_status === 'NEEDS_CONFIRMATION' && g.status === 'DRAFT' ? (
                  <label className="flex items-start gap-1.5">
                    <input type="checkbox" checked={confirm.includes(m.id)} onChange={(e) => setConfirm((c) => (e.target.checked ? [...c, m.id] : c.filter((x) => x !== m.id)))} className="mt-0.5" />
                    <span>I checked: confirm as paper {m.paper_code}. <span className="text-ink-3">{m.note}</span></span>
                  </label>
                ) : (
                  <span>{m.mapping_status.replace(/_/g, ' ').toLowerCase()}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <ErrorBox error={err} />}
      {['DRAFT', 'PUBLISHED'].includes(g.status) && (
        <>
          <label className="block text-xs font-medium text-ink">Reviewer note (what you checked against the university's document)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputClass} mt-1 w-full`} />
          </label>
          <div className="flex flex-wrap gap-2">
            {g.status === 'DRAFT' && <Button onClick={() => void decide('PUBLISH')} disabled={busy || note.trim().length < 5}>Publish this list</Button>}
            {g.status === 'DRAFT' && <Button kind="secondary" onClick={() => void decide('REJECT')} disabled={busy || note.trim().length < 5}>Reject</Button>}
            {g.status === 'PUBLISHED' && <Button kind="secondary" onClick={() => void decide('WITHDRAW')} disabled={busy || note.trim().length < 5}>Withdraw</Button>}
          </div>
        </>
      )}
      <History events={g.history} />
    </div>
  );
}

export function AdminGroups() {
  const list = useLoad(consoleApi.admissionGroups, []);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className="mt-10" aria-labelledby="grp-review" data-groups-review>
      <SectionTitle id="grp-review">Subject lists the rules refer to (List A, List B)</SectionTitle>
      <p className="mb-3 max-w-3xl text-sm text-ink-2">Rules such as "any three subjects from List B" can only be checked once the university's own list is published here, entered exactly as printed with its page, and each entry matched to an NTA paper by a person.</p>
      {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.data!.length === 0 ? <Empty>No list has been entered.</Empty> : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
          {list.data!.map((g) => (
            <li key={g.id} className="px-4 py-3">
              <button type="button" onClick={() => setOpenId(openId === g.id ? null : g.id)} aria-expanded={openId === g.id} className="flex w-full flex-wrap items-center gap-2 text-left text-sm">
                <span className="min-w-0 flex-1 font-medium text-ink">{g.title}</span>
                <span className="text-xs text-ink-3">{g.university_slug} · {g.academic_year} · v{g.version} · {g.members} entries</span>
                <Badge tone={STATUS_TONE[g.status]}>{g.status.toLowerCase()}</Badge>
                {g.needs_attention > 0 && <Badge tone="amber">{g.needs_attention} to check</Badge>}
              </button>
              {openId === g.id && <GroupPanel id={g.id} onChanged={list.reload} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminAdmissionChecks() {
  const [v, setV] = useState<AdmissionValidation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try { setV(await consoleApi.admissionValidation()); } catch (e) { setErr(e as Error); } finally { setBusy(false); }
  };
  return (
    <section className="mt-10 mb-10" aria-labelledby="adm-checks" data-admission-checks>
      <SectionTitle id="adm-checks">Data checks: universities, programmes, campuses, requirements</SectionTitle>
      <p className="mb-3 max-w-3xl text-sm text-ink-2">Looks for records a student could be misled by (errors) and for gaps (warnings and notes). It changes nothing.</p>
      <Button kind="secondary" onClick={() => void run()} disabled={busy}>{busy ? 'Checking…' : 'Run the checks'}</Button>
      {err && <ErrorBox error={err} />}
      {v && (
        <Panel className="mt-3 p-3">
          <p className="text-sm text-ink" data-check-summary>
            {v.summary.programmes} programmes, {v.summary.requirements} requirements, {v.summary.groups} lists: <strong>{v.summary.ERROR} errors</strong>, {v.summary.WARNING} warnings, {v.summary.INFO} notes.
          </p>
          <ul className="mt-2 max-h-80 space-y-1 overflow-auto text-xs">
            {v.findings.filter((f) => f.severity !== 'INFO').concat(v.findings.filter((f) => f.severity === 'INFO').slice(0, 15)).slice(0, 120).map((f, i) => (
              <li key={i} className="flex flex-wrap gap-1.5 text-ink-2">
                <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity.toLowerCase()}</Badge>
                <span className="text-ink-3">{f.level.toLowerCase()}</span>
                <span className="font-medium text-ink">{f.label}</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </section>
  );
}
