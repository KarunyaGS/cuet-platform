import { FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LABS, LAB_SUBJECTS, type LabEntry, type LabSubject } from '../visual/labs';
import { PageHeader } from '../ui';

/** One entry per lab (a lab can be linked from several lessons). */
const UNIQUE: LabEntry[] = LABS.filter((l, i) => LABS.findIndex((x) => x.id === l.id) === i);

/**
 * The Practical Labs page: labs are filtered by subject and shown six at a time. Each lab also appears inside its lesson.
 * A subject with no labs says so plainly.
 */
export function LabsPage() {
  const counts = useMemo(() => Object.fromEntries(LAB_SUBJECTS.map((s) => [s, UNIQUE.filter((l) => l.subject === s).length])) as Record<LabSubject, number>, []);
  const [subject, setSubject] = useState<LabSubject>(() => LAB_SUBJECTS.find((s) => counts[s] > 0) ?? 'Physics');
  const [showAll, setShowAll] = useState(false);
  const labs = UNIQUE.filter((l) => l.subject === subject);
  const visibleLabs = showAll ? labs : labs.slice(0, 6);
  return (
    <div data-labs-page>
      <PageHeader
        title="Practical labs"
        subtitle="Hands-on experiments: predict, explore, measure, and apply what you learn."
        actions={(
          <label className="flex items-center rounded-xl border border-line bg-surface px-3 shadow-sm" data-lab-subject-filter>
            <span className="sr-only">Filter labs by subject</span>
            <select aria-label="Filter labs by subject" value={subject} onChange={(event) => { setSubject(event.target.value as LabSubject); setShowAll(false); }} className="h-10 min-w-[11rem] bg-transparent text-[14px] font-semibold text-forest outline-none focus-visible:ring-2 focus-visible:ring-forest/30">
            {LAB_SUBJECTS.map((s) => <option key={s} value={s}>{s} · {counts[s]} {counts[s] === 1 ? 'lab' : 'labs'}</option>)}
            </select>
          </label>
        )}
      />
      {labs.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-[15px] text-mute" data-no-labs>
          No practical lab for {subject} is available yet. It will appear here, and inside its lesson, as soon as it is ready.
        </p>
      ) : (
        <div id="practical-lab-list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleLabs.map((lab) => (
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
      {labs.length > 6 && <div className="mt-5 flex justify-center"><button type="button" aria-expanded={showAll} aria-controls="practical-lab-list" onClick={() => setShowAll((value) => !value)} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-forest transition hover:bg-sage/40">{showAll ? 'Show fewer labs' : `Show all ${labs.length} labs`}</button></div>}
    </div>
  );
}
