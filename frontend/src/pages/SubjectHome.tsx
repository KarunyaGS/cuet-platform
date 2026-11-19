import { ArrowUpRight, BookOpenCheck, CircleCheckBig, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api, type ExamCode } from '../api';
import { ErrorBox, Loading, useAuth, useLoad } from '../ui';
import { subjectTone } from '../subjectColors';
import { CustomPractice } from './CustomPractice';
import { NotFoundPage } from './Search';

/**
 * The page a subject opens on: only where the student left off, the lessons they have finished and the tests they have finished.
 * Everything else about the subject (question bank, study material, papers, mock tests) lives in the sidebar.
 */
export function SubjectPage() {
  const { paperId = '', exam = 'CUET_UG' } = useParams();
  const { user } = useAuth();
  const subjects = useLoad(() => api.subjects(exam as ExamCode, 2026), [exam]);
  const summary = useLoad(() => (user ? api.subjectSummary(paperId) : Promise.resolve(null)), [paperId, user?.id]);
  const outline = useLoad(() => api.outline(paperId), [paperId]);
  if (subjects.loading && !subjects.data) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  const subject = subjects.data?.find((s) => s.paperId === paperId);
  if (!subject) return <NotFoundPage />;
  const d = summary.data;
  const last = d?.last ?? null;
  const resume = last ? (last.kind === 'LESSON_VIEW' && last.resourceId ? `/learn/${last.resourceId}` : last.nodeId ? `/topic/${last.nodeId}` : null) : null;
  const tone = subjectTone(Math.max(0, subjects.data?.findIndex((s) => s.paperId === paperId) ?? 0));

  return (
    <div data-subject-home>
      <header className="relative mb-6 overflow-hidden rounded-[22px] border bg-gradient-to-br px-5 py-5 sm:px-6 sm:py-6" data-subject-hero style={{ borderColor: `color-mix(in srgb, ${tone.node} 42%, #c9c5b5)`, backgroundImage: `linear-gradient(125deg, color-mix(in srgb, ${tone.node} 34%, #f7f4e9), color-mix(in srgb, ${tone.node} 12%, #f7f4e9) 58%, color-mix(in srgb, ${tone.node} 24%, #f4e3d8))` }}>
        <div className="relative z-10 grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 max-w-3xl">
            <div className="label mb-3 flex items-center gap-2 text-[10px] text-terracotta">
              <span className="grid size-8 place-items-center rounded-[11px] bg-forest text-lime shadow-sm"><BookOpenCheck aria-hidden className="size-4" /></span>
              CUET UG · 2026 SUBJECT
            </div>
            <h1 className="text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.02] font-bold tracking-[-0.045em] text-charcoal">{subject.name}<span className="text-terracotta">.</span></h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">Pick up where you left off. Follow a question, find your way through the syllabus, and build a practice set that fits.</p>
          </div>
          {summary.error ? <ErrorBox error={summary.error} onRetry={summary.reload} /> : (
          <div aria-label="Subject progress" data-subject-summary className="relative mx-auto grid min-h-[132px] w-full max-w-[20rem] grid-cols-2 items-start border-l border-terracotta/20 lg:pl-5">
            <svg aria-hidden viewBox="0 0 300 142" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
              <path className="map-flow" d="M95 34 H205" fill="none" stroke="#8e765f" strokeWidth="2.5" strokeDasharray="3 5" strokeLinecap="round" />
            </svg>
            <span className="label absolute top-0 left-1/2 -translate-x-1/2 text-[8px] tracking-[0.15em] text-ink-3">YOUR PROGRESS</span>
            <div className="relative z-10 mt-[14px] flex min-w-0 flex-col items-center px-1 text-center">
              <span className="grid size-11 place-items-center rounded-full border-2 border-white/90 bg-forest text-lime shadow-sm"><BookOpenCheck aria-hidden className="size-[18px]" /></span>
              <span className="num mt-1.5 text-[25px] leading-none font-bold tracking-[-0.04em] text-forest">{user ? (d?.lessonsCompleted ?? 0) : '–'}</span>
              <span className="mt-1 text-[11px] font-semibold leading-tight text-ink-2">Lessons completed</span>
            </div>
            <div className="relative z-10 mt-[14px] flex min-w-0 flex-col items-center px-1 text-center">
              <span className="grid size-11 place-items-center rounded-full border-2 border-white/90 bg-[#f4d9c9] text-terracotta shadow-sm"><CircleCheckBig aria-hidden className="size-[18px]" /></span>
              <span className="num mt-1.5 text-[25px] leading-none font-bold tracking-[-0.04em] text-terracotta">{user ? (d?.testsCompleted ?? 0) : '–'}</span>
              <span className="mt-1 text-[11px] font-semibold leading-tight text-ink-2">Tests completed</span>
            </div>
          </div>
          )}
        </div>
      </header>
      <div className={`mb-4 grid items-start gap-3 ${subject.questions > 0 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <section className="relative flex min-h-[116px] min-w-0 flex-col justify-between overflow-hidden rounded-[20px] border border-[#cbd8ca] bg-gradient-to-br from-[#e4eee4] via-[#edf1e5] to-[#f5e4d7] px-4 py-3 shadow-[0_10px_24px_-20px_rgba(24,68,59,0.28)] sm:px-5" data-card="continue">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-forest text-lime"><Clock3 aria-hidden className="size-[17px]" strokeWidth={1.8} /></span>
              <div>
                <p className="label text-[10px] tracking-[0.13em] text-forest">CONTINUE LEARNING</p>
                <p className="mt-0.5 text-[12px] text-ink-2">Pick up where you left off</p>
              </div>
            </div>
            <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
              {last && resume ? (
                <Link to={resume} className="group min-w-0" data-resume={resume}>
                  <span className="line-clamp-2 text-[15px] font-bold leading-snug text-charcoal transition-colors group-hover:text-terracotta sm:text-[17px]" title={last.title ?? 'Continue'}>{last.title ?? 'Continue'}</span>
                </Link>
              ) : (
                <p className="min-w-0 text-[13px] text-ink-2">{!user ? <><Link to="/signin" className="font-semibold text-terracotta hover:underline">Sign in</Link> to resume your learning.</> : summary.loading && !d ? 'Loading your last activity…' : 'Choose a chapter to begin.'}</p>
              )}
              {last && resume && <Link to={resume} aria-label="Continue where you left off" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12px] font-bold text-lime transition-colors hover:bg-forest-deep">Continue <ArrowUpRight aria-hidden className="size-3.5" /></Link>}
            </div>
          </section>
      {subject.questions > 0 && (
        <div className="min-w-0">
          <CustomPractice
            paperId={paperId}
            chapters={(outline.data?.nodes ?? []).filter((n) => n.parent_id === null && n.kind !== 'NOTE').map((n) => ({ id: n.id, title: n.title.length > 60 ? `${n.title.slice(0, 58)}…` : n.title }))}
          />
        </div>
      )}
      </div>
    </div>
  );
}
