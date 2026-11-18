/** Bulk management approval of questions. A bulk decision, recorded as one, never as individual review. */
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError, request } from '../api';
import { when } from '../admin/api';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, SectionTitle, StatGroup, inputClass, useLoad } from '../ui';

interface Preview {
  method: string;
  totalQuestions: number;
  currentlyByVerification: Record<string, number>;
  eligibleCount: number;
  eligibleByType: Record<string, number>;
  correctAnswerSpread: Record<string, number>;
  excluded: { id: string; reasons: string[]; stem: string }[];
  needsAPersonsEyes: { note: string; ids: string[] }[];
  alreadyIndividuallyVerified: number;
  alreadyBulkApproved: number;
  checks: string[];
  notChecked: string[];
  statement: string;
  phraseToType: string;
  snapshotHash: string;
  sampleReview: { id: string; expertName: string; expertCredentials: string; completedAt: string; checked: number; population: number; withProblem: number; wrongAnswer: number; statement: string; questionsChangedSince: boolean } | null;
}
interface Summary {
  questions: { total: number; unverified: number; bulkApproved: number; individuallyVerified: number; flagged: number; rejected: number };
  batches: { id: string; approver: string; approverRoles: string; approved: number; stillBulkApproved: number; withdrawnOrFlagged: number; laterVerifiedIndividually: number; status: string; at: string }[];
}

const api = {
  summary: () => request<Summary>('GET', '/api/review/bulk-approval/summary'),
  preview: () => request<Preview>('POST', '/api/review/bulk-approval/preview', { scope: {} }),
  confirm: (p: Preview, typed: string) =>
    request<{ batchId: string; requested: number; applied: number; skippedBecauseChanged: number }>('POST', '/api/review/bulk-approval/confirm', { scope: {}, snapshotHash: p.snapshotHash, typed, statement: p.statement }),
  withdraw: (b: { batchId?: string; questionIds?: string[]; action: 'FLAG' | 'REJECT' | 'WITHDRAW'; reason: string }) =>
    request<{ applied: number; to: string; notBulkApproved: string[] }>('POST', '/api/review/bulk-approval/withdraw', b),
};

export function BulkApproval() {
  const summary = useLoad(api.summary, []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [typed, setTyped] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [withdrawFor, setWithdrawFor] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  if (summary.loading) return <Loading />;
  if (summary.error) {
    const denied = summary.error instanceof ApiError && (summary.error.status === 403 || summary.error.status === 401);
    return denied ? <Empty>Your account does not have the reviewer role. Ask an administrator to give it to you.</Empty> : <ErrorBox error={summary.error} onRetry={summary.reload} />;
  }
  const s = summary.data!;

  return (
    <div>
      <PageHeader
        title="Bulk approval of questions"
        subtitle="One management decision for many questions. It is recorded as a bulk decision, with who approved it, when, and on what basis. It is not individual review."
      />
      <div className="mb-8">
        <StatGroup
          items={[
            { label: 'Questions', value: s.questions.total },
            { label: 'Not yet approved', value: s.questions.unverified },
            { label: 'Approved in bulk', value: s.questions.bulkApproved, hint: 'by management decision' },
            { label: 'Reviewed individually', value: s.questions.individuallyVerified, hint: 'checked one by one' },
            { label: 'Flagged or rejected', value: s.questions.flagged + s.questions.rejected, tone: s.questions.flagged + s.questions.rejected ? 'wrong' : 'muted' },
          ]}
        />
      </div>

      {done && (
        <div className="mb-6 rounded-lg border border-correct/30 bg-correct-soft px-4 py-3 text-sm text-correct" role="status">
          {done}
        </div>
      )}
      {error && <div className="mb-6"><ErrorBox error={error} /></div>}

      <SectionTitle>1. See what would be approved</SectionTitle>
      <p className="mb-3 max-w-2xl text-sm text-ink-2">
        Only unverified questions that pass the automated format checks are included. Nothing changes until you confirm in step 2.
      </p>
      <div className="mb-8">
        <Button
          disabled={busy}
          onClick={() =>
            run(async () => {
              setDone(null);
              setTyped('');
              setAgreed(false);
              setPreview(await api.preview());
            })
          }
        >
          {preview ? 'Refresh the list' : 'Show what would be approved'}
        </Button>
      </div>

      {preview && (
        <>
          <Panel className="mb-6 p-5">
            <h3 className="mb-2 text-base font-semibold text-ink">{preview.eligibleCount} questions are eligible</h3>
            <p className="mb-3 text-sm text-ink-2">
              {Object.entries(preview.eligibleByType).map(([t, n]) => `${n} ${t.replace(/_/g, ' ').toLowerCase()}`).join(', ')}. Correct answers by position:{' '}
              {Object.entries(preview.correctAnswerSpread).map(([l, n]) => `${l} ${n}`).join(', ')}.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 text-sm font-semibold text-ink">Checked automatically</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{preview.checks.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-wrong">Not checked by anyone</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{preview.notChecked.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            </div>
          </Panel>

          <Panel className="mb-6 p-5">
            <h3 className="mb-2 text-base font-semibold text-ink">Subject-expert sample review</h3>
            {preview.sampleReview ? (
              <>
                <p className="text-sm leading-6 text-ink-2">{preview.sampleReview.statement}</p>
                {preview.sampleReview.questionsChangedSince && (
                  <p className="mt-2 text-sm text-wrong">The questions have changed since this sample was drawn, so it no longer describes all of them. Consider drawing a new sample.</p>
                )}
                <p className="mt-2 text-sm"><Link className="text-accent hover:underline" to={`/review/sample/${preview.sampleReview.id}`}>See the sample and what was found</Link></p>
              </>
            ) : (
              <p className="text-sm text-ink-2">
                No subject expert has checked a sample of these questions yet. You can approve without one, but then nobody has checked even a sample of the answers. <Link className="text-accent hover:underline" to="/review/sample">Start a sample review</Link>.
              </p>
            )}
          </Panel>

          {preview.excluded.length > 0 && (
            <Panel className="mb-6 p-5">
              <h3 className="mb-2 text-base font-semibold text-ink">{preview.excluded.length} left out, for these reasons</h3>
              <ul className="space-y-2 text-sm">
                {preview.excluded.map((e) => (
                  <li key={e.id}>
                    <span className="text-ink">{e.stem}</span>
                    <div className="text-ink-2">{e.reasons.join('; ')}</div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {preview.needsAPersonsEyes.length > 0 && (
            <Panel className="mb-6 p-5">
              <h3 className="mb-2 text-base font-semibold text-ink">A person should look at these before approving</h3>
              {preview.needsAPersonsEyes.map((n) => (
                <p key={n.ids.join()} className="text-sm text-ink-2">{n.note} ({n.ids.length} questions)</p>
              ))}
            </Panel>
          )}

          <SectionTitle>2. Confirm</SectionTitle>
          {preview.eligibleCount === 0 ? (
            <Empty>Nothing to approve.</Empty>
          ) : (
            <Panel className="mb-10 max-w-2xl p-5">
              <p className="mb-4 rounded-lg bg-paper px-3 py-3 text-sm leading-6 text-ink">{preview.statement}</p>
              <label className="mb-4 flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I have read this statement and I am making this decision myself.</span>
              </label>
              <label className="mb-4 block text-sm text-ink">
                Type <b>{preview.phraseToType}</b> to confirm
                <input className={`${inputClass} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              <Button
                disabled={busy || !agreed || typed.trim() !== preview.phraseToType}
                onClick={() =>
                  run(async () => {
                    const r = await api.confirm(preview, typed.trim());
                    setDone(`Approved ${r.applied} of ${r.requested} questions as a bulk management decision (batch ${r.batchId}).${r.skippedBecauseChanged ? ` ${r.skippedBecauseChanged} changed meanwhile and were skipped.` : ''}`);
                    setPreview(null);
                    summary.reload();
                  })
                }
              >
                Approve {preview.eligibleCount} questions in bulk
              </Button>
            </Panel>
          )}
        </>
      )}

      <SectionTitle>Approvals made</SectionTitle>
      {s.batches.length === 0 ? (
        <Empty>No bulk approval has been made yet.</Empty>
      ) : (
        <div className="space-y-3">
          {s.batches.map((b) => (
            <Panel key={b.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={b.status === 'ACTIVE' ? 'green' : 'red'}>{b.status === 'ACTIVE' ? 'In force' : 'Withdrawn'}</Badge>
                <span className="text-sm font-medium text-ink">{b.approved} questions</span>
                <span className="text-sm text-ink-2">approved by {b.approver} ({b.approverRoles}) on {when(b.at)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-2">
                Still bulk-approved: {b.stillBulkApproved}. Flagged or withdrawn since: {b.withdrawnOrFlagged}. Later reviewed individually: {b.laterVerifiedIndividually}.
              </p>
              {b.stillBulkApproved > 0 && (
                <div className="mt-3">
                  {withdrawFor === b.id ? (
                    <div className="max-w-xl">
                      <label className="block text-sm text-ink">
                        Why is the approval being withdrawn?
                        <input className={`${inputClass} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
                      </label>
                      <div className="mt-2 flex gap-2">
                        <Button
                          kind="danger"
                          size="sm"
                          disabled={busy || reason.trim().length < 5}
                          onClick={() =>
                            run(async () => {
                              const r = await api.withdraw({ batchId: b.id, action: 'WITHDRAW', reason: reason.trim() });
                              setDone(`Withdrew approval from ${r.applied} questions. They are unverified again.`);
                              setWithdrawFor(null);
                              setReason('');
                              summary.reload();
                            })
                          }
                        >
                          Withdraw the remaining {b.stillBulkApproved}
                        </Button>
                        <Button kind="ghost" size="sm" onClick={() => setWithdrawFor(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button kind="secondary" size="sm" onClick={() => setWithdrawFor(b.id)}>Withdraw this approval</Button>
                  )}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
      <p className="mt-6 max-w-2xl text-sm text-ink-2">
        To flag, correct or reject a single question, open it under Lessons and questions and use the usual decision buttons. It leaves the bulk approval automatically.
      </p>
    </div>
  );
}
