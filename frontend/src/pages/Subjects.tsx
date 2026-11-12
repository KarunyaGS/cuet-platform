import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, type ExamCode, type Subject } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, useLoad } from '../ui';

const YEAR = 2026;

export function Subjects() {
  const exam = (useParams().exam ?? 'CUET_UG') as ExamCode;
  const subjects = useLoad(() => api.subjects(exam, YEAR), [exam]);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = (subjects.data ?? []).filter((s) => !q || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase()));
    const m = new Map<string, Subject[]>();
    for (const s of list) m.set(s.category.name ?? 'Other', [...(m.get(s.category.name ?? 'Other') ?? []), s]);
    return [...m];
  }, [subjects.data, q]);
  const ready = subjects.data?.filter((s) => s.available).length ?? 0;
  return (
    <div>
      <PageHeader
        title={`${exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'} ${YEAR} subjects`}
        subtitle={subjects.data ? `${subjects.data.length} official papers · ${ready} with a verified syllabus available` : undefined}
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subjects or codes"
            aria-label="Search subjects"
            className="w-56 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
          />
        }
      />
      {subjects.loading && <Loading />}
      {subjects.error && <ErrorBox error={subjects.error} onRetry={subjects.reload} />}
      {subjects.data && groups.length === 0 && <Empty>No subjects match “{q}”.</Empty>}
      <div className="space-y-5">
        {groups.map(([group, list]) => (
          <section key={group}>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</h2>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {list.map((s) => (
                <li key={s.paperId}>
                  {s.available ? (
                    <Link to={`/${exam}/subject/${s.paperId}`} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50">
                      <SubjectRow s={s} />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2 text-zinc-500" title="The official syllabus for this paper is still being verified.">
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

function SubjectRow({ s }: { s: Subject }) {
  return (
    <>
      <span className="num w-14 shrink-0 font-mono text-xs text-zinc-500">{s.code}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
      {s.available ? (
        <>
          <span className="num hidden text-xs text-zinc-500 sm:inline">
            {s.units} units · {s.topics} topics · {s.questions} questions
          </span>
        </>
      ) : (
        <Badge>Syllabus under verification</Badge>
      )}
    </>
  );
}
