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
      <header className="relative mb-5 overflow-hidden rounded-[22px] border bg-gradient-to-br px-5 py-5 sm:px-6 sm:py-6" data-subject-hero style={{ borderColor: `color-mix(in srgb, ${tone.node} 42%, #c9c5b5)`, backgroundImage: `linear-gradient(125deg, color-mix(in srgb, ${tone.node} 34%, #f7f4e9), color-mix(in srgb, ${tone.node} 12%, #f7f4e9) 58%, color-mix(in srgb, ${tone.node} 24%, #f4e3d8))` }}>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            <div className="label mb-3 flex items-center gap-2 text-[10px] text-terracotta">
              <span className="grid size-8 place-items-center rounded-[11px] bg-forest text-lime shadow-sm"><BookOpenCheck aria-hidden className="size-4" /></span>
              CUET UG · 2026 SUBJECT
            </div>
            <h1 className="text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.02] font-bold tracking-[-0.045em] text-charcoal">{subject.name}<span className="text-terracotta">.</span></h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">Pick up where you left off. Follow a question, find your way through the syllabus, and build a practice set that fits.</p>
          </div>
          <div className="subject-emblem relative z-10 grid size-16 shrink-0 place-items-center rounded-[20px] border-[3px] border-white/80 bg-forest text-lime shadow-[0_10px_22px_-14px_rgb(24_68_59/0.55)] sm:size-[4.5rem]" style={{ backgroundImage: `linear-gradient(145deg, ${tone.node}, #18443b 65%)` }}>
            <BookOpenCheck aria-hidden className="size-7" strokeWidth={1.7} />
          </div>
        </div>
      </header>
      {summary.error ? (
        <ErrorBox error={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]" data-subject-summary>
          <section className="relative flex min-h-[132px] min-w-0 flex-col justify-between overflow-hidden rounded-[20px] border border-[#cbd8ca] bg-gradient-to-br from-[#e4eee4] via-[#edf1e5] to-[#f5e4d7] p-4 shadow-[0_10px_24px_-20px_rgba(24,68,59,0.28)] sm:p-5" data-card="continue">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-forest text-lime"><Clock3 aria-hidden className="size-[17px]" strokeWidth={1.8} /></span>
              <div>
                <p className="label text-[9px] tracking-[0.13em] text-forest">CONTINUE LEARNING</p>
                <p className="mt-0.5 text-[11px] text-ink-2">Pick up where you left off</p>
              </div>
            </div>
            <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
              {last && resume ? (
                <Link to={resume} className="group min-w-0" data-resume={resume}>
                  <span className="line-clamp-2 text-[14px] font-bold leading-snug text-charcoal transition-colors group-hover:text-terracotta sm:text-[15px]" title={last.title ?? 'Continue'}>{last.title ?? 'Continue'}</span>
                </Link>
              ) : (
                <p className="min-w-0 text-[13px] text-ink-2">{!user ? <><Link to="/signin" className="font-semibold text-terracotta hover:underline">Sign in</Link> to resume your learning.</> : summary.loading && !d ? 'Loading your last activity…' : 'Choose a chapter to begin.'}</p>
              )}
              {last && resume && <Link to={resume} aria-label="Continue where you left off" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-3 text-[11px] font-bold text-lime transition-colors hover:bg-forest-deep">Continue <ArrowUpRight aria-hidden className="size-3.5" /></Link>}
            </div>
          </section>

          <section aria-label="Subject progress" className="relative min-h-[132px] overflow-hidden rounded-[20px] border border-[#d8ddca] bg-[#f2f2e7] shadow-[0_10px_24px_-22px_rgba(24,68,59,0.2)]">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75" style={{ backgroundImage: 'radial-gradient(ellipse at 15% 100%, rgb(222 238 144 / 0.25), transparent 58%), radial-gradient(ellipse at 100% 0%, rgb(237 185 158 / 0.22), transparent 55%), radial-gradient(rgb(45 74 62 / 0.11) 0.8px, transparent 1px)', backgroundSize: 'auto, auto, 16px 16px' }} />
            <svg aria-hidden viewBox="0 0 600 132" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
              <defs><linearGradient id="subject-stats-route" x1="0" x2="1"><stop offset="0%" stopColor="#6f8b7e" /><stop offset="100%" stopColor="#c45e42" /></linearGradient></defs>
              <path className="map-flow" d="M145 79 C250 79 350 42 455 42" fill="none" stroke="url(#subject-stats-route)" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
            </svg>
            <div className="relative z-10 grid min-h-[132px] grid-cols-2">
              <div className="flex min-w-0 flex-col items-center px-2 pt-[58px] text-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-white bg-forest text-lime shadow-[0_3px_12px_rgba(24,68,59,0.18)]"><BookOpenCheck aria-hidden className="size-[17px]" /></span>
                <span className="num mt-1 text-[19px] leading-none font-bold tracking-[-0.04em] text-forest">{user ? (d?.lessonsCompleted ?? 0) : '–'}</span>
                <span className="mt-1 text-[10px] font-medium leading-tight text-ink-2">Lessons completed</span>
              </div>
              <div className="flex min-w-0 flex-col items-center px-2 pt-[21px] text-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-white bg-[#f4d9c9] text-terracotta shadow-[0_3px_12px_rgba(137,78,51,0.15)]"><CircleCheckBig aria-hidden className="size-[17px]" /></span>
                <span className="num mt-1 text-[19px] leading-none font-bold tracking-[-0.04em] text-terracotta">{user ? (d?.testsCompleted ?? 0) : '–'}</span>
                <span className="mt-1 text-[10px] font-medium leading-tight text-ink-2">Tests completed</span>
              </div>
            </div>
          </section>
        </div>
      )}
      {subject.questions > 0 && (
        <div className="mt-4">
          <CustomPractice
            paperId={paperId}
            chapters={(outline.data?.nodes ?? []).filter((n) => n.parent_id === null && n.kind !== 'NOTE').map((n) => ({ id: n.id, title: n.title.length > 60 ? `${n.title.slice(0, 58)}…` : n.title }))}
          />
        </div>
      )}
    </div>
  );
}
