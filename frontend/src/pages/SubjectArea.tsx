import { ChevronRight, FileText, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, type ExamCode, type PyqTree, type Subject } from '../api';
import { chaptersOf, withQuestions, type SideItem } from '../Sidebar';
import { bareChapter, Empty, ErrorBox, Loading, useLoad } from '../ui';

export const AREAS = [
  { slug: 'question-bank', title: 'Chapter-wise Question Bank', text: 'One PDF of original questions for each chapter, with an answer key.' },
  { slug: 'study-material', title: 'Study Material', text: 'Lessons and practice questions, chapter by chapter and topic by topic.' },
  { slug: 'previous-papers', title: 'Previous Year Question Paper', text: 'Official question papers and answer keys, year by year.' },
  { slug: 'mock-tests', title: 'Practice and Mock Test', text: 'Chapter practice and tests, and the full-length mock, timed like the exam.' },
] as const;

/** The resource categories of one subject, as cards. Shown on the subject page. */
export function AreaCards({ exam, paperId }: { exam: string; paperId: string }) {
  return (
    <ul className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-areas>
      {AREAS.map((a) => (
        <li key={a.slug}>
          <Link to={`/${exam}/subject/${paperId}/${a.slug}`} data-area={a.slug} className="flex h-full items-start gap-3 rounded-xl border border-rule bg-surface p-4 hover:border-accent/40 hover:bg-accent-soft/40">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{a.title}</span>
              <span className="mt-0.5 block text-sm text-ink-2">{a.text}</span>
            </span>
            <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const row = 'flex items-center gap-3 px-4 py-3 text-[15px] text-ink hover:bg-accent-soft/50';
const Count = ({ n, word }: { n: number; word: string }) => <span className="num ml-auto shrink-0 text-sm text-ink-3">{n} {word}</span>;

/**
 * One card per chapter. Every chapter starts closed: a chapter's topics show only when its chevron is pressed (one at a time),
 * and the chapter's name opens the chapter's own page. A chapter with no topics under it is a card on its own.
 */
function ChapterCards({ list, base = '/topic', test = false }: { list: SideItem[]; base?: string; test?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (list.length === 0) return <Empty>Nothing is listed here yet.</Empty>;
  const cards: { head: SideItem; topics: SideItem[] }[] = [];
  for (const c of list) {
    if (c.kind === 'group') cards.push({ head: c, topics: [] });
    else if (cards.length && cards[cards.length - 1]!.head.kind === 'group') cards[cards.length - 1]!.topics.push(c);
    else cards.push({ head: c, topics: [] });
  }
  return (
    <ul className="flex flex-col gap-3" data-chapter-cards>
      {cards.map(({ head, topics }) => {
        const open = openId === head.id;
        return (
          <li key={head.id} className="overflow-hidden rounded-xl border border-rule bg-surface">
            <div className={`flex items-center ${open ? 'border-b border-rule bg-paper' : ''}`}>
              <Link to={`${base}/${head.id}`} data-chapter={head.id} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-accent-soft/50">
                <span className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-ink">{head.title}</span>
                {test ? <span className="shrink-0 text-xs font-medium text-accent">Chapter test</span> : head.questions > 0 ? <span className="num shrink-0 text-xs text-ink-3">{head.questions} questions</span> : null}
              </Link>
              {topics.length > 0 && (
                <button type="button" aria-expanded={open} aria-label={open ? 'Collapse chapter' : 'Expand chapter'} data-chapter-toggle={head.id} onClick={() => setOpenId(open ? null : head.id)} className="mr-2 grid size-9 shrink-0 place-items-center rounded-md hover:bg-ink/5">
                  <ChevronRight aria-hidden className={`size-4 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            {open && topics.length > 0 && (
              <ul className="divide-y divide-rule">
                {topics.map((t) => (
                  <li key={t.id}>
                    <Link to={`${base}/${t.id}`} data-topic={t.id} title={t.title} className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-accent-soft/50">
                      <span className="min-w-0 flex-1 truncate">{t.title.split(':')[0]}</span>
                      {t.questions > 0 ? <span className="num shrink-0 text-xs text-ink-3">{t.questions}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The page of one resource category of a subject: what the sidebar's category heading opens. */
export function SubjectAreaPage() {
  const { paperId = '', exam = 'CUET_UG', area = '' } = useParams();
  const meta = AREAS.find((a) => a.slug === area);
  const subjects = useLoad(() => api.subjects(exam as ExamCode, 2026), [exam]);
  const outline = useLoad(() => api.outline(paperId), [paperId]);
  const pdfs = useLoad(() => api.chapterPdfs(exam as ExamCode), [exam]);
  const pyq = useLoad<PyqTree | null>(() => (area === 'previous-papers' ? api.pyqTree(exam as ExamCode) : Promise.resolve(null)), [area, exam]);
  const subject: Subject | undefined = subjects.data?.find((s) => s.paperId === paperId);

  if (!meta) return <ErrorBox error={new Error('This page does not exist')} />;
  if ((subjects.loading && !subjects.data) || (outline.loading && !outline.data)) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  if (outline.error) return <ErrorBox error={outline.error} onRetry={outline.reload} />;
  const list = chaptersOf(outline.data!.nodes);

  let body: React.ReactNode = null;
  if (area === 'question-bank') {
    const mine = (pdfs.data ?? []).filter((d) => d.subjectCode === subject?.code);
    body = mine.length === 0 ? <Empty>The chapter question banks for this subject are still being prepared.</Empty> : (
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {mine.map((d) => (
          <li key={d.id}>
            <Link to={`/pyq/view/${d.id}`} className={row} data-pdf={d.id}>
              <FileText aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">{bareChapter(d.title)}</span>
              {d.pages ? <span className="num text-sm text-ink-3">{d.pages} pages</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    );
  } else if (area === 'study-material') {
    body = <ChapterCards list={list} />;
  } else if (area === 'mock-tests') {
    body = (
      <>
        <Link to={`/mock-tests/full/${paperId}`} data-full-mock-card className="mb-4 flex items-center gap-3 rounded-xl border border-rule bg-surface p-4 hover:border-accent/40 hover:bg-accent-soft/40">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Timer className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Full-length mock</span>
            <span className="block text-sm text-ink-2">The whole paper under exam conditions, in full screen.</span>
          </span>
          <ChevronRight aria-hidden className="size-4 text-ink-3" />
        </Link>
        <ChapterCards list={withQuestions(list)} base="/mock-tests/topic" test />
      </>
    );
  } else if (area === 'previous-papers') {
    const years = (pyq.data?.years ?? [])
      .map((y) => ({ year: y.year, hit: y.subjects.find((x) => x.code === subject?.code) }))
      .filter((r) => r.hit && r.hit.papers > 0)
      .sort((a, b) => b.year - a.year);
    body = pyq.loading && !pyq.data ? <Loading /> : years.length === 0 ? <Empty>No question papers are listed for this subject yet.</Empty> : (
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {years.map(({ year, hit }) => (
          <li key={year}>
            <Link to={`/pyq?year=${year}&subject=${encodeURIComponent(hit!.slug)}`} className={row} data-year={year}>
              <span className="min-w-0 flex-1">{year}</span>
              <Count n={hit!.papers} word={hit!.papers === 1 ? 'paper' : 'papers'} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div data-subject-area={area}>
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link to={`/${exam}`} className="hover:text-accent">
          CUET UG
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link to={`/${exam}/subject/${paperId}`} className="hover:text-accent">
          {subject?.name ?? 'Subject'}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-medium text-ink-2">
          {meta.title}
        </span>
      </nav>
      <header className="mb-4 border-b border-rule pb-2.5">
        <h1 className="text-lg font-semibold text-ink sm:text-xl">
          {subject?.name}: {meta.title}
        </h1>
        <p className="mt-0.5 text-sm text-ink-2">{meta.text}</p>
      </header>
      {body}
    </div>
  );
}
