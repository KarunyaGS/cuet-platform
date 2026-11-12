import { ChevronRight, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, type ExamCode, type Subject } from '../api';
import { NotFoundPage } from './Search';
import { Badge, Empty, ErrorBox, Loading, PageHeader, SearchInput, Segmented, useLoad } from '../ui';

const YEAR = 2026;

/** All official papers of one exam, grouped by category, with the ones that can be opened first-class. */
export function Subjects() {
  const exam = (useParams().exam ?? 'CUET_UG') as ExamCode;
  const known = exam === 'CUET_UG' || exam === 'CUET_PG';
  const subjects = useLoad(() => (known ? api.subjects(exam, YEAR) : Promise.resolve([])), [exam]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'ready'>('all');
  const groups = useMemo(() => {
    const list = (subjects.data ?? [])
      .filter((s) => show === 'all' || s.available)
      .filter((s) => !q || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase()));
    const m = new Map<string, Subject[]>();
    for (const s of list) m.set(s.category.name ?? 'Other', [...(m.get(s.category.name ?? 'Other') ?? []), s]);
    return [...m];
  }, [subjects.data, q, show]);
  const ready = subjects.data?.filter((s) => s.available).length ?? 0;
  if (!known) return <NotFoundPage />;
  const name = exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG';
  return (
    <div>
      <PageHeader
        title={`${name} ${YEAR} subjects`}
        subtitle={subjects.data ? `${subjects.data.length} official papers. ${ready} have a checked syllabus you can study now.` : undefined}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Search by subject or code" label="Search subjects" />}
      />
      {subjects.data && (
        <div className="mb-6">
          <Segmented
            label="Which subjects to show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'all', label: `All papers (${subjects.data.length})` },
              { value: 'ready', label: `Ready to study (${ready})` },
            ]}
          />
        </div>
      )}
      {subjects.loading && <Loading />}
      {subjects.error && <ErrorBox error={subjects.error} onRetry={subjects.reload} />}
      {subjects.data && groups.length === 0 && <Empty icon={<SearchX />}>No subjects match “{q}”. Try a shorter word or the paper code.</Empty>}
      <div className="space-y-8">
        {groups.map(([group, list]) => (
          <section key={group} aria-labelledby={`g-${group}`}>
            <h2 id={`g-${group}`} className="mb-2.5 flex items-baseline gap-2 text-base font-semibold text-ink">
              {group}
              <span className="num text-sm font-normal text-ink-3">{list.length}</span>
            </h2>
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {list.map((s) => (
                <li key={s.paperId}>
                  {s.available ? (
                    <Link to={`/${exam}/subject/${s.paperId}`} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-paper">
                      <SubjectRow s={s} />
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 px-4 py-3" title="The official syllabus for this paper is still being checked.">
                      <SubjectRow s={s} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** The syllabus shape in words, exactly as stored: units, sections and topics, leaving out what the syllabus does not have. */
function structure(s: Subject) {
  const parts = [
    s.units ? `${s.units} ${s.units === 1 ? 'unit' : 'units'}` : '',
    s.sections ? `${s.sections} ${s.sections === 1 ? 'section' : 'sections'}` : '',
    s.topics ? `${s.topics} ${s.topics === 1 ? 'topic' : 'topics'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No topics listed yet';
}

function SubjectRow({ s }: { s: Subject }) {
  return (
    <>
      <span className={`num w-16 shrink-0 text-sm ${s.available ? 'text-ink-3' : 'text-ink-3/70'}`}>{s.code}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-medium ${s.available ? 'text-ink group-hover:text-accent' : 'text-ink-3'}`}>{s.name}</span>
        {s.available && (
          <span className="num mt-0.5 block text-xs text-ink-3 sm:hidden">
            {structure(s)}
            {s.questions ? `, ${s.questions} questions` : ''}
          </span>
        )}
      </span>
      {s.available ? (
        <span className="num hidden shrink-0 gap-5 text-sm text-ink-2 sm:flex">
          <span className="w-44 text-right">{structure(s)}</span>
          <span className="w-28 text-right">{s.questions ? <><span className="font-medium text-ink">{s.questions}</span> questions</> : <span className="text-ink-3">No questions yet</span>}</span>
        </span>
      ) : (
        <Badge>Syllabus being checked</Badge>
      )}
    </>
  );
}
