import { ChevronRight, Compass, Library, Lightbulb, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, type ExamCode, type SearchResults } from '../api';
import { Badge, buttonClass, Empty, ErrorBox, kindLabel, Loading, PageHeader, SearchInput, SectionTitle, Segmented } from '../ui';

const examName = (e: string) => (e === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG');
const CONCEPT_LABEL: Record<string, string> = { DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Fact', CONCEPT: 'Concept' };

/** Search across subjects and the syllabus: units, sections, topics and subtopics. The query lives in the address, so results can be shared. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const exam = (params.get('exam') ?? '') as ExamCode | '';
  const [text, setText] = useState(q);
  const [state, setState] = useState<{ data: SearchResults | null; loading: boolean; error: Error | null }>({ data: null, loading: false, error: null });

  // Typing updates the address after a short pause.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) setParams((p) => (text.trim() ? p.set('q', text.trim()) : p.delete('q'), p), { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  useEffect(() => {
    if (q.length < 2) return setState({ data: null, loading: false, error: null });
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.search(q, exam).then(
      (data) => live && setState({ data, loading: false, error: null }),
      (error: Error) => live && setState({ data: null, loading: false, error }),
    );
    return () => {
      live = false;
    };
  }, [q, exam]);

  const d = state.data;
  const none = d && !d.subjects.length && !d.topics.length && !d.concepts.length;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Search the syllabus" subtitle="Subjects, units and topics from the official syllabi, and single concepts (definitions, formulas, key points) inside lessons." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 [&>label]:sm:w-full">
          <SearchInput value={text} onChange={setText} placeholder="For example: electric dipole, national income, ethics" label="Search the syllabus" />
        </div>
        <Segmented
          label="Exam"
          value={exam}
          onChange={(v) => setParams((p) => (v ? p.set('exam', v) : p.delete('exam'), p), { replace: true })}
          options={[
            { value: '', label: 'Both exams' },
            { value: 'CUET_UG', label: 'CUET-UG' },
            { value: 'CUET_PG', label: 'CUET-PG' },
          ]}
        />
      </div>

      {q.length < 2 && <Empty icon={<Compass />}>Type at least two letters. Every word you type must appear in the result.</Empty>}
      {state.error && <ErrorBox error={state.error} />}
      {state.loading && !d && <Loading label="Searching" />}
      {none && (
        <Empty icon={<SearchX />}>
          Nothing in the syllabus or the lessons matches “{q}”. Try fewer or shorter words. Syllabi that are still being checked are not searched.
        </Empty>
      )}

      {d && d.subjects.length > 0 && (
        <section className="mb-8" aria-labelledby="sr-subjects">
          <SectionTitle id="sr-subjects">Subjects</SectionTitle>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.subjects.map((s) => {
              const body = (
                <>
                  <Library aria-hidden className="size-[18px] shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-medium ${s.available ? 'text-ink group-hover:text-accent' : 'text-ink-3'}`}>{s.name}</span>
                    <span className="num text-xs text-ink-3">
                      {examName(s.exam)}, paper {s.code}
                    </span>
                  </span>
                  {s.available ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" /> : <Badge>Syllabus being checked</Badge>}
                </>
              );
              return (
                <li key={s.paperId}>
                  {s.available ? (
                    <Link to={`/${s.exam}/subject/${s.paperId}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {d && d.concepts.length > 0 && (
        <section className="mb-8" aria-labelledby="sr-concepts">
          <SectionTitle id="sr-concepts">Concepts in lessons</SectionTitle>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.concepts.map((c) => (
              <li key={c.key}>
                <Link to={`/learn/${c.resourceId}#${c.anchor}`} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper">
                  <Lightbulb aria-hidden className="mt-0.5 size-[18px] shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink group-hover:text-accent">
                      <span className="line-clamp-2">{c.title}</span>
                      <Badge>{CONCEPT_LABEL[c.type] ?? c.type}</Badge>
                    </span>
                    {c.snippet && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{c.snippet}</span>}
                    <span className="mt-1 block text-xs text-ink-3">
                      {examName(c.exam)}, {c.paper}, in “{c.lesson.length > 70 ? `${c.lesson.slice(0, 70)}…` : c.lesson}”
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d && d.topics.length > 0 && (
        <section aria-labelledby="sr-topics">
          <SectionTitle id="sr-topics">In the syllabus</SectionTitle>
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.topics.map((t) => (
              <li key={t.id}>
                <Link to={`/topic/${t.id}`} className="group block px-4 py-3 transition-colors hover:bg-paper">
                  <span className="block text-[15px] text-ink group-hover:text-accent">
                    {kindLabel(t.kind, t.label) && <span className="text-ink-3">{kindLabel(t.kind, t.label)}: </span>}
                    <span className="line-clamp-2 inline">{t.title}</span>
                  </span>
                  {t.snippet && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{t.snippet}</span>}
                  <span className="num mt-1 block text-xs text-ink-3">
                    {examName(t.exam)}, {t.paper} ({t.paperCode})
                    {t.parentTitle ? `, in ${t.parentTitle.length > 60 ? `${t.parentTitle.slice(0, 60)}…` : t.parentTitle}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {d.more && <p className="mt-3 text-sm text-ink-2">Showing the first 40 matches. Add a word to narrow the search.</p>}
        </section>
      )}
    </div>
  );
}

/** Shown for any address the app does not have. */
export function NotFoundPage({ inApp = true }: { inApp?: boolean }) {
  return (
    <div className={inApp ? 'py-10' : 'grid min-h-dvh place-items-center bg-paper px-4'}>
      <div className="mx-auto max-w-md text-center">
        <p className="num text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-[15px] text-ink-2">This address does not match any page of CUET Prep. The link may be old, or the address may have a typing mistake.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/" className={buttonClass('primary')}>
            Go to home
          </Link>
          <Link to="/search" className={buttonClass('secondary')}>
            Search the syllabus
          </Link>
          <Link to="/cuet" className={buttonClass('ghost')}>
            Exam information
          </Link>
        </div>
      </div>
    </div>
  );
}
