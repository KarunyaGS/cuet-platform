/**
 * Student side of admission requirements: the minimum-subject-eligibility line, the "follow this programme" button, and the list of followed
 * programmes. Nothing here predicts an admission: it compares the CUET subjects a student plans to take with the university's published subject
 * rule, and only when that rule has been checked by a person. Otherwise it says plainly why no result is shown.
 */
import { Target, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, type EligibilityOut, type TargetsOut } from '../api';
import { Badge, Button, Panel } from '../ui';

const VERDICT: Record<string, { label: string; tone: 'green' | 'amber' | 'zinc' }> = {
  MEETS: { label: 'Your subjects meet the published rule', tone: 'green' },
  DOES_NOT_MEET: { label: 'Your subjects do not meet the published rule', tone: 'amber' },
  CANNOT_TELL: { label: 'Cannot be judged yet', tone: 'zinc' },
};

/** What a student needs to know about the result: the verdict, what is missing, and the limits. */
export function EligibilityLine({ e }: { e: EligibilityOut | undefined }) {
  if (!e) return null;
  if (!e.available || !e.result) {
    return (
      <div className="mt-3 rounded-lg border border-rule bg-paper/70 px-3 py-2.5" data-eligibility-unavailable={e.unavailable?.code}>
        <p className="text-xs font-semibold text-ink">Subject check not available</p>
        <p className="mt-0.5 text-xs text-ink-2">{e.unavailable?.message}</p>
      </div>
    );
  }
  const v = VERDICT[e.result.verdict]!;
  const missing = e.result.combinations.filter((c) => c.state === 'NOT_SATISFIED' && c.missing.length);
  return (
    <div className="mt-3 rounded-lg border border-rule bg-paper/70 px-3 py-2.5" data-eligibility={e.result.verdict}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={v.tone}>{v.label}</Badge>
        {e.basis && <span className="text-[11px] text-ink-3">{e.basis.academicYear} rules{e.basis.cycle.status === 'PREVIOUS' ? ' (previous cycle)' : ''}</span>}
      </div>
      {e.result.verdict === 'MEETS' && <p className="mt-1 text-xs text-ink-2">The CUET subjects you plan to take satisfy {e.result.matched}.</p>}
      {e.result.verdict === 'DOES_NOT_MEET' && (
        <div className="mt-1 text-xs text-ink-2">
          <p>None of the published combinations is satisfied. What each one still needs:</p>
          <ul className="mt-1 list-disc pl-4">
            {missing.map((c) => (
              <li key={c.label}>
                {c.label}: {c.missing.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {e.result.verdict === 'CANNOT_TELL' && <p className="mt-1 text-xs text-ink-2">{e.result.reasons.join(' ')}</p>}
      <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-3">
        {e.caveats.map((c) => (
          <li key={c}>{c}</li>
        ))}
        {e.basis && (
          <li>
            Source: <a href={e.basis.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{e.basis.sourceTitle}</a>
            {e.basis.sourcePage ? `, page ${e.basis.sourcePage}` : ''}; checked {e.basis.checkedOn}.
          </li>
        )}
      </ul>
    </div>
  );
}

export function TargetButton({ programmeId, targeted, onChange }: { programmeId: string; targeted: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      await (targeted ? api.removeAdmissionTarget(programmeId) : api.addAdmissionTarget(programmeId));
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-target-control>
      <Button kind={targeted ? 'secondary' : 'ghost'} onClick={() => void toggle()} disabled={busy} icon={<Target aria-hidden />}>
        {targeted ? 'Following this programme' : 'Follow this programme'}
      </Button>
      {targeted && <span className="text-xs text-ink-3">Listed under My target programmes</span>}
      {err && <span role="alert" className="text-xs text-wrong">{err}</span>}
    </div>
  );
}

/** The programmes the student follows, each with what is known, what is old and what is missing. */
export function MyTargets({ data, reload }: { data: TargetsOut; reload: () => void }) {
  if (data.targets.length === 0) return null;
  return (
    <div data-my-targets>
    <Panel className="mb-4 p-4">
      <h2 className="text-sm font-semibold text-ink">My target programmes ({data.targets.length} of {data.limit})</h2>
      <p className="mt-1 text-xs text-ink-3">
        {data.papers.length ? 'Compared with the CUET subjects chosen in your profile.' : <>Choose the CUET subjects you plan to take in <Link to="/profile" className="text-accent hover:underline">your profile</Link> to see how they compare.</>}
      </p>
      <ul className="mt-3 space-y-3">
        {data.targets.map((t) => (
          <li key={t.programmeId} className="rounded-lg border border-rule bg-surface p-3" data-target={t.programmeId}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to={`/admissions/programmes/${t.programmeId}`} className="text-sm font-semibold text-ink hover:text-accent">{t.programmeName}</Link>
                <div className="text-xs text-ink-2">{t.university} · {t.academicYear}</div>
              </div>
              <Button kind="ghost" onClick={() => void api.removeAdmissionTarget(t.programmeId).then(reload)} icon={<X aria-hidden />}>
                Remove
              </Button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {t.information.cycle.label && <Badge tone="amber">{t.information.cycle.label}</Badge>}
              {t.information.stale && <Badge tone="amber">Last checked {t.information.lastVerifiedOn}: may be out of date</Badge>}
              {!t.available && <Badge tone="red">No longer published</Badge>}
            </div>
            {t.information.message && <p className="mt-1 text-xs text-ink-2">{t.information.message}</p>}
            {t.available && <EligibilityLine e={t.eligibility} />}
          </li>
        ))}
      </ul>
    </Panel>
    </div>
  );
}
