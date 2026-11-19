import { ArrowUpRight, BookOpen, ChevronRight, FileText, Timer } from 'lucide-react';
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
  const icons = [FileText, BookOpen, FileText, Timer];
  return (
    <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-areas>
      {AREAS.map((a, index) => {
        const Icon = icons[index] ?? FileText;
        return (
        <li key={a.slug}>
          <Link to={`/${exam}/subject/${paperId}/${a.slug}`} data-area={a.slug} className="group relative flex h-full min-h-[154px] flex-col overflow-hidden rounded-[22px] border border-rule/80 bg-gradient-to-br from-surface to-paper p-4 shadow-[0_12px_30px_-25px_rgb(24_68_59/0.5)] transition duration-300 hover:-translate-y-1 hover:border-forest/25 hover:shadow-[0_22px_38px_-25px_rgb(24_68_59/0.4)]">
            <span aria-hidden className="pointer-events-none absolute -right-8 -bottom-12 size-28 rounded-full border border-forest/10 transition-transform duration-500 group-hover:scale-125" />
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-forest text-lime shadow-sm">
              <Icon className="size-[18px]" />
            </span>
            <span className="relative mt-4 min-w-0 flex-1">
              <span className="block text-[15px] leading-snug font-bold text-forest">{a.title}</span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-2">{a.text}</span>
            </span>
            <span className="relative mt-3 flex items-center gap-1 text-[11px] font-bold text-terracotta">Explore <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
          </Link>
        </li>
      )})}
    </ul>
  );
}

const row = 'flex items-center gap-3 px-4 py-4 text-[14px] text-ink transition-colors hover:bg-[#eef2e4] hover:text-forest';
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
          <li key={head.id} className="group/chapter overflow-hidden rounded-[20px] border border-rule/80 bg-surface shadow-[0_10px_28px_-25px_rgb(24_68_59/0.45)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgb(24_68_59/0.35)]">
            <div className={`flex items-center ${open ? 'border-b border-forest/10 bg-[#eef2e4]' : ''}`}>
              <Link to={`${base}/${head.id}`} data-chapter={head.id} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-[#eef2e4]/70">
                <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-xl ${open ? 'bg-forest text-lime' : 'bg-paper text-forest'}`}><BookOpen className="size-4" /></span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug font-bold text-forest">{head.title}</span>
                {test ? <span className="shrink-0 rounded-full bg-[#f5e3d8] px-2.5 py-1 text-[10px] font-bold text-terracotta">Chapter test</span> : head.questions > 0 ? <span className="num shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10px] font-semibold text-ink-2">{head.questions} questions</span> : null}
              </Link>
              {topics.length > 0 && (
                <button type="button" aria-expanded={open} aria-label={open ? 'Collapse chapter' : 'Expand chapter'} data-chapter-toggle={head.id} onClick={() => setOpenId(open ? null : head.id)} className="mr-2 grid size-9 shrink-0 place-items-center rounded-xl text-forest transition-colors hover:bg-lime">
                  <ChevronRight aria-hidden className={`size-4 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            {open && topics.length > 0 && (
              <ul className="divide-y divide-rule/70 bg-[#fbfaf4]">
                {topics.map((t) => (
                  <li key={t.id}>
                    <Link to={`${base}/${t.id}`} data-topic={t.id} title={t.title} className="flex items-center gap-2 px-4 py-3 text-[13px] text-ink transition-colors hover:bg-[#eef2e4] hover:text-forest">
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
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ink-3">
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
      <header data-subject-hero className="relative mb-5 overflow-hidden rounded-[22px] border border-[#e2dfce] bg-gradient-to-br from-[#edf1e2] via-[#f8f4e9] to-[#f4e5da] px-5 py-5 sm:px-6 sm:py-6">
        <div className="relative max-w-4xl">
          <div className="label mb-3 flex items-center gap-2 text-[10px] text-terracotta"><span className="grid size-8 place-items-center rounded-[11px] bg-forest text-lime"><FileText aria-hidden className="size-4" /></span>{subject?.name ?? 'Your subject'} · CUET UG 2026</div>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.02] font-bold tracking-[-0.045em] text-charcoal">{meta.title}<span className="font-editorial font-medium tracking-[-0.03em] text-terracotta italic">. Find your way.</span></h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">{meta.text}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-forest">Explore the collection at your pace</span>
            {area === 'mock-tests' && <span className="rounded-full bg-[#f4e2d8] px-3 py-1.5 text-[11px] font-semibold text-terracotta">Timed practice</span>}
          </div>
        </div>
      </header>
      {body}
    </div>
  );
}
