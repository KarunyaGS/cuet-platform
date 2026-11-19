import { FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LABS, LAB_SUBJECTS, type LabEntry, type LabSubject } from '../visual/labs';
import { Badge, PageHeader } from '../ui';

/** One entry per lab (a lab can be linked from several lessons). */
const UNIQUE: LabEntry[] = LABS.filter((l, i) => LABS.findIndex((x) => x.id === l.id) === i);

/**
 * The Practical Labs page: every hands-on lab, by subject. Each lab also appears as a card inside the lesson it belongs to.
 * Only labs that exist are listed; a subject with none says so plainly. Status of all lab content: Draft - unverified.
 */
export function LabsPage() {
  const counts = useMemo(() => Object.fromEntries(LAB_SUBJECTS.map((s) => [s, UNIQUE.filter((l) => l.subject === s).length])) as Record<LabSubject, number>, []);
  const [subject, setSubject] = useState<LabSubject>(() => LAB_SUBJECTS.find((s) => counts[s] > 0) ?? 'Physics');
  const labs = UNIQUE.filter((l) => l.subject === subject);
  return (
    <div data-labs-page>
      <PageHeader
        title="Practical labs"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            Hands-on experiments for every subject. Predict, experiment, measure, then answer CUET-style questions. <Badge tone="amber">Draft – unverified</Badge>
          </span>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3" data-lab-subject-filter>
        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2 shadow-sm">
          <span className="text-[12px] font-semibold text-ink-2">Subject</span>
          <select aria-label="Filter labs by subject" value={subject} onChange={(event) => setSubject(event.target.value as LabSubject)} className="h-8 min-w-[11rem] bg-transparent text-[14px] font-semibold text-forest outline-none focus-visible:ring-2 focus-visible:ring-forest/30">
            {LAB_SUBJECTS.map((s) => <option key={s} value={s}>{s} · {counts[s]} {counts[s] === 1 ? 'lab' : 'labs'}</option>)}
          </select>
        </label>
      </div>
      {labs.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-[15px] text-mute" data-no-labs>
          No practical lab for {subject} is available yet. It will appear here, and inside its lesson, as soon as it is ready.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {labs.map((lab) => (
            <article key={lab.id} data-lab-tile={lab.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2">
                <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-forest text-lime">
                  <FlaskConical className="size-[18px]" />
                </span>
                <span className="label text-[10.5px] text-mute">{lab.format}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold tracking-tight text-charcoal">{lab.title}</h2>
              <p className="mt-1 text-[14.5px] leading-snug text-mute">{lab.blurb}</p>
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[13.5px] text-charcoal">
                {lab.can.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                <Link to={lab.path} data-open-lab className="inline-flex h-10 items-center rounded-lg bg-terracotta px-4 text-[13.5px] font-bold text-white hover:bg-terracotta-deep">
                  Open lab
                </Link>
                <span className="text-xs text-mute">About {lab.minutes} minutes</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
