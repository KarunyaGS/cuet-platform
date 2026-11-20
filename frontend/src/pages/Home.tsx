import { Atom, BookOpen, Calculator, FlaskConical, Globe, Landmark, Languages, Leaf, Sigma, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, localDay, type CurrentPlan, type Dashboard, type Preferences, type Subject } from '../api';
import { computeStreak } from '../streak';
import { subjectTone } from '../subjectColors';
import { Empty, ErrorBox, useAuth, useLoad } from '../ui';
import { DashboardPage } from './Dashboard';

const EXAM = 'CUET_UG' as const;
const YEAR = 2026;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const dateLabel = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(', ', ' · ');

/** An icon that suits the subject's name; any other subject gets a book. */
function subjectIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/biolog|botany|zoology/.test(n)) return Leaf;
  if (/chem/.test(n)) return FlaskConical;
  if (/math/.test(n)) return Sigma;
  if (/phys/.test(n)) return Atom;
  if (/account|business|econom/.test(n)) return Calculator;
  if (/histor|politic|civic|sociolog/.test(n)) return Landmark;
  if (/geograph|general|aptitude/.test(n)) return Globe;
  if (/english|hindi|language|urdu|sanskrit/.test(n)) return Languages;
  return BookOpen;
}

/** Lessons in a subject: the lessons attached to the topics of its outline. Counted once per paper. */
const lessonCache = new Map<string, Promise<number | null>>();
function lessonCount(paperId: string): Promise<number | null> {
  let p = lessonCache.get(paperId);
  if (!p) {
    p = api.outline(paperId).then(
      (o) => o.nodes.reduce((n, x) => n + (x.resources ?? 0), 0),
      () => {
        lessonCache.delete(paperId);
        return null;
      },
    );
    lessonCache.set(paperId, p);
  }
  return p;
}

/**
 * The student's current streak, counted from real activity: consecutive days (ending today, or yesterday if today has not started)
 * on which they answered a question or opened a lesson. Only the last 7 days are looked at, so a full week reads "7+".
 */
function useStreak(userId: string | undefined) {
  const [streak, setStreak] = useState<{ days: number; capped: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const start = new Date();
    start.setDate(start.getDate() - 6);
    api.weeklyReport(localDay(start)).then(
      (r) => live && setStreak(computeStreak(r.days, localDay())),
      () => live && setStreak(null),
    );
    return () => {
      live = false;
    };
  }, [userId]);
  return streak;
}

interface MapSubject {
  paperId: string;
  code: string;
  name: string;
  index: number;
  available: boolean;
  topics: number;
  questions: number;
  attempted: number;
  accuracy: number | null;
  lessons: number | null;
}

interface Recommendation {
  paperId: string;
  title: string;
  body: string;
  action: { kind: 'resume'; sessionId: string; label: string } | { kind: 'daily'; label: string };
  left: number | null;
}

/** Which subject to suggest, and why. Every sentence is built from the student's own numbers; nothing is invented. */
function recommend(subjects: MapSubject[], d: Dashboard, remaining: number | null): Recommendation | null {
  if (subjects.length === 0) return null;
  const goalLeft = Math.max(0, d.today.goal.questionsPerDay - d.today.questionsAnswered);
  const goalLine = goalLeft > 0 ? ` ${goalLeft} more ${goalLeft === 1 ? 'question' : 'questions'} reaches today’s goal.` : ' Today’s goal is already done.';
  const run = d.inProgress[0];
  if (run) {
    const s = subjects.find((x) => x.name === run.paper) ?? null;
    const what = { PRACTICE: 'practice', TOPIC_TEST: 'topic test', MOCK_TEST: 'mock test' }[run.mode] ?? 'test';
    return {
      paperId: s?.paperId ?? subjects[0]!.paperId,
      title: `${run.paper ?? s?.name ?? 'Your'} ${what}`,
      body: remaining !== null ? `You have ${remaining} ${remaining === 1 ? 'question' : 'questions'} left in the session you started${new Date(run.startedAt).toDateString() === new Date().toDateString() ? ' today' : ''}.` : `You have an unfinished ${what}${run.topic ? ` on ${run.topic}` : ''}. Pick it up where you stopped.`,
      action: { kind: 'resume', sessionId: run.id, label: 'Pick up where I left off' },
      left: remaining,
    };
  }
  const tried = subjects.filter((s) => s.attempted > 0 && s.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!);
  if (tried.length > 0) {
    const s = tried[0]!;
    return { paperId: s.paperId, title: `${s.name} practice`, body: `Your accuracy in ${s.name} is ${s.accuracy}% over ${s.attempted} answered ${s.attempted === 1 ? 'question' : 'questions'}, the lowest of your subjects so far.${goalLine}`, action: { kind: 'daily', label: 'Start 10 questions' }, left: null };
  }
  const s = subjects.find((x) => x.available) ?? subjects[0]!;
  return { paperId: s.paperId, title: `${s.name} practice`, body: `You have not answered a question in ${s.name} yet. Ten questions is a good first step.${goalLine}`, action: { kind: 'daily', label: 'Start 10 questions' }, left: null };
}

/** Where each subject sits on the study map: a gentle wave left to right (wide), or a winding column (narrow). Percent of the map. */
function place(n: number, tall: boolean): { x: number; y: number }[] {
  if (tall) return Array.from({ length: n }, (_, i) => ({ x: i % 2 === 0 ? 27 : 73, y: ((i + 0.5) / n) * 100 }));
  if (n === 1) return [{ x: 50, y: 52 }];
  const wave = [56, 26, 58, 30, 60, 28, 52];
  return Array.from({ length: n }, (_, i) => ({ x: 10 + (80 * i) / (n - 1), y: wave[i % wave.length]! - (i >= 7 ? 6 : 0) }));
}
/** A smooth curve through the points (Catmull-Rom turned into cubic Beziers). */
function curve(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const BLOBS = ['38% 42% 40% 44% / 42% 38% 44% 40%', '44% 36% 46% 38% / 38% 46% 36% 44%', '40% 44% 36% 42% / 44% 40% 42% 36%', '36% 46% 42% 38% / 46% 36% 40% 44%'];

function MapNodes({ subjects, pts, tall, pick, left }: { subjects: MapSubject[]; pts: { x: number; y: number }[]; tall: boolean; pick: string | null; left: number | null }) {
  return (
    <>
      {subjects.map((s, i) => {
        const here = s.paperId === pick;
        const size = here ? (tall ? 68 : 82) : tall ? 56 : 64;
        const Icon = subjectIcon(s.name);
        const tone = subjectTone(s.index);
        const meta = !s.available ? 'Being checked' : here && left !== null ? `Continue · ${left} left` : here ? 'Recommended' : s.lessons === null ? `${s.topics} topics` : `${s.lessons} ${s.lessons === 1 ? 'lesson' : 'lessons'}`;
        return (
          <Link key={s.paperId} to={`/${EXAM}/subject/${s.paperId}`} data-map-node={s.name} aria-label={`${s.name}: ${meta}${s.attempted ? `, ${s.attempted} answered` : ''}`} className="group absolute size-0" style={{ left: `${pts[i]!.x}%`, top: `${pts[i]!.y}%` }}>
            <span
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center transition-transform duration-200 group-hover:scale-105 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-forest ${here ? 'bg-forest text-lime shadow-[0_0_0_4px_#e6f28e,0_14px_28px_-10px_rgb(24_68_59/0.55)]' : 'text-charcoal/80 shadow-[0_0_0_3px_rgb(255_255_255/0.75),0_10px_22px_-12px_rgb(32_44_40/0.45)]'}`}
              style={{ width: size, height: size, borderRadius: BLOBS[i % BLOBS.length], background: here ? undefined : tone.node }}
            >
              <Icon aria-hidden className={here ? 'size-[26px]' : 'size-[22px]'} strokeWidth={1.6} />
            </span>
            <span className="absolute left-1/2 w-32 -translate-x-1/2 text-center leading-tight" style={{ top: size / 2 + 10 }}>
              <span className={`block text-[14.5px] font-semibold ${here ? 'text-forest' : 'text-charcoal'}`}>{s.name}</span>
              <span className="mt-1 block text-[11.5px] text-mute">{meta}</span>
              {s.attempted > 0 && (
                <span className="mt-0.5 block text-[11px] text-mute/80">
                  {s.attempted} answered{s.accuracy !== null ? ` · ${s.accuracy}%` : ''}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </>
  );
}

type MilestonePeriod = 'day' | 'week' | 'month';
function dateShift(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + n, 12);
  return localDay(date);
}
function milestoneRange(period: MilestonePeriod, today: string) {
  if (period === 'day') return { from: today, to: today, label: 'Today' };
  const [year, month, date] = today.split('-').map(Number);
  const weekday = new Date(year!, month! - 1, date!, 12).getDay();
  if (period === 'week') {
    const from = dateShift(today, -((weekday + 6) % 7));
    return { from, to: dateShift(from, 6), label: 'This week' };
  }
  const from = localDay(new Date(year!, month! - 1, 1, 12));
  return { from, to: localDay(new Date(year!, month!, 0, 12)), label: 'This month' };
}
function pointOnMilestonePath(percent: number) {
  const t = percent <= 50 ? percent / 50 : (percent - 50) / 50;
  const p = percent <= 50 ? [[18, 92], [110, 18], [220, 18], [360, 65]] : [[360, 65], [500, 112], [600, 95], [702, 24]];
  const u = 1 - t;
  const x = u ** 3 * p[0]![0]! + 3 * u ** 2 * t * p[1]![0]! + 3 * u * t ** 2 * p[2]![0]! + t ** 3 * p[3]![0]!;
  const y = u ** 3 * p[0]![1]! + 3 * u ** 2 * t * p[1]![1]! + 3 * u * t ** 2 * p[2]![1]! + t ** 3 * p[3]![1]!;
  return { x, y };
}
function StudyMilestone({ currentPlan }: { currentPlan: CurrentPlan | null }) {
  const [period, setPeriod] = useState<MilestonePeriod>('day');
  const today = localDay();
  const range = milestoneRange(period, today);
  const tasks = (currentPlan?.items ?? []).filter((item) => item.origin === 'EXPERT' && item.status === 'SCHEDULED' && item.day >= range.from && item.day <= range.to);
  const done = tasks.filter((item) => item.done).length;
  const total = tasks.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const reached = percent >= 100 ? 'Milestone reached' : percent >= 75 ? 'Almost there' : percent >= 50 ? 'Halfway there' : percent >= 25 ? 'First steps done' : 'Ready when you are';
  const marker = pointOnMilestonePath(percent);
  return (
    <div className="study-milestone-panel relative isolate mt-6 w-full overflow-hidden rounded-[22px] border border-forest/10 px-4 py-4 shadow-[0_18px_36px_-30px_rgb(32_44_40/0.42)] sm:px-6 sm:py-5" style={{ backgroundImage: 'radial-gradient(24% 80% at 8% 100%, rgb(230 242 142 / 0.48), transparent 100%), radial-gradient(24% 70% at 38% 0%, rgb(244 168 78 / 0.18), transparent 100%), radial-gradient(26% 82% at 72% 100%, rgb(94 165 145 / 0.18), transparent 100%), radial-gradient(24% 78% at 100% 0%, rgb(153 124 190 / 0.20), transparent 100%), linear-gradient(120deg, #f4f7e9 0%, #f9f1e8 53%, #eff5eb 100%)' }} data-study-milestone data-period={period}>
      <span aria-hidden className="study-milestone-sheen" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label text-[10px] tracking-[0.15em] text-forest/60">YOUR EXPERT-PLAN MILESTONE</p>
          <h3 className="mt-1 text-lg font-bold text-forest">{range.label} · {reached}</h3>
        </div>
        <div role="tablist" aria-label="Milestone period" className="flex items-center gap-1">
          {(['day', 'week', 'month'] as const).map((key) => <button key={key} type="button" role="tab" aria-selected={period === key} onClick={() => setPeriod(key)} className={`study-milestone-tab rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${period === key ? 'is-active bg-forest text-lime' : 'text-forest/65 hover:bg-forest/5 hover:text-forest'}`}>{key === 'day' ? 'Today' : key === 'week' ? 'Week' : 'Month'}</button>)}
        </div>
      </div>
      <div className="mt-2">
        <svg viewBox="0 0 720 126" className="study-milestone-graphic block h-[118px] w-full overflow-visible sm:h-[142px] lg:h-[156px]" role="img" aria-label={`${done} of ${total} expert-plan tasks completed, ${percent}%`}>
          <defs><linearGradient id="studyMilestoneTrail" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#97a849" /><stop offset="100%" stopColor="#e5ef86" /></linearGradient><linearGradient id="studyMilestoneBrand" x1="10" y1="5" x2="38" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#F2D76E" /><stop offset=".56" stopColor="#F4A84E" /><stop offset="1" stopColor="#E97545" /></linearGradient><radialGradient id="studyMilestoneGlow"><stop stopColor="#eff8a8" stopOpacity=".9" /><stop offset="1" stopColor="#eff8a8" stopOpacity="0" /></radialGradient></defs>
          <path className="study-milestone-route" d="M18 92 C110 18 220 18 360 65 C500 112 600 95 702 24" pathLength="100" fill="none" stroke="#8da293" strokeOpacity=".38" strokeWidth="5" strokeLinecap="round" />
          <path className="study-milestone-flow" d="M18 92 C110 18 220 18 360 65 C500 112 600 95 702 24" pathLength="100" fill="none" stroke="#fffdf3" strokeOpacity=".82" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />
          <path className="study-milestone-trail" d="M18 92 C110 18 220 18 360 65 C500 112 600 95 702 24" pathLength="100" fill="none" stroke="url(#studyMilestoneTrail)" strokeWidth="6" strokeLinecap="round" style={{ strokeDasharray: `${percent} 100` }} />
          {[25, 50, 75, 100].map((mark) => {
            const p = pointOnMilestonePath(mark);
            if (mark === 100) return (
              <g key={mark} transform={`translate(${p.x} ${p.y})`} data-milestone-mark={mark} className={`study-milestone-trophy ${percent >= 100 ? 'is-achieved' : ''}`}>
                <title>{percent >= 100 ? 'Milestone 1 achieved' : 'Milestone 1: complete all tasks'}</title>
                <circle className="study-milestone-trophy-halo" r="18" fill="#efa84f" fillOpacity=".16" stroke="#efa84f" strokeOpacity=".45" />
                <circle r="13" fill="url(#studyMilestoneBrand)" stroke="#fffdf3" strokeWidth="2.5" />
                <g className="study-milestone-trophy-icon" fill="none" stroke="#1b4a3f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M-4.5-5h9v4.2c0 3-2 4.8-4.5 4.8S-4.5 2.2-4.5-.8V-5Zm0 2h-2.2v1.6c0 1.8 1.1 2.8 3.1 3.1m8-4.7h2.2v1.6c0 1.8-1.1 2.8-3.1 3.1M0 4v2.3m-3 1.2h6" /></g>
              </g>
            );
            const color = mark === 25 ? '#e97855' : mark === 50 ? '#9878bf' : '#3f9c8b';
            return <g key={mark} transform={`translate(${p.x} ${p.y})`} data-milestone-mark={mark}><circle className="study-milestone-halo" r="17" fill={color} fillOpacity=".15" stroke={color} strokeOpacity=".5" /><circle className={percent >= mark ? 'study-milestone-checkpoint is-reached' : 'study-milestone-checkpoint'} r="12" fill={color} stroke="#fffdf3" strokeWidth="2.5" /><text y="3.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fffdf3">{mark / 25}</text></g>;
          })}
          <circle className="study-milestone-glow" cx={marker.x} cy={marker.y} r="25" fill="url(#studyMilestoneGlow)" />
          <g className="study-milestone-marker" transform={`translate(${marker.x} ${marker.y})`}><circle r="13" fill="#1b4a3f" stroke="#e6f28e" strokeWidth="3" /><g className="study-milestone-brand" transform="scale(.45) translate(-24 -24)"><path d="M24 2.5C27.2 14.2 33.8 20.8 45.5 24 33.8 27.2 27.2 33.8 24 45.5 20.8 33.8 14.2 27.2 2.5 24 14.2 20.8 20.8 14.2 24 2.5Z" fill="url(#studyMilestoneBrand)" /><path d="M24 8.5C26.4 17.6 30.4 21.6 39.5 24 30.4 26.4 26.4 30.4 24 39.5 21.6 30.4 17.6 26.4 8.5 24 17.6 21.6 21.6 17.6 24 8.5Z" fill="#FFD777" fillOpacity=".48" /></g></g>
        </svg>
      </div>
      <div className="-mt-1 mb-2 grid grid-cols-4 gap-1 text-center" role="group" aria-label="Milestone checkpoints">
        {[
          { name: 'Milestone 1', value: '25%', color: '#e97855' },
          { name: 'Milestone 2', value: '50%', color: '#9878bf' },
          { name: 'Milestone 3', value: '75%', color: '#3f9c8b' },
          { name: 'Milestone 4', value: 'Finish', color: '#d18b31' },
        ].map((item) => <div key={item.name} className="flex flex-col items-center gap-0.5"><span className="text-[10px] font-bold leading-tight sm:text-[11px]" style={{ color: item.color }}>{item.name}</span><span className="text-[9px] font-medium leading-tight text-forest/55 sm:text-[10px]">{item.value}</span></div>)}
      </div>
      <div className="mt-[-2px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <p className="font-semibold text-forest"><span className="study-milestone-count num inline-block text-xl">{done}/{total}</span> {total === 1 ? 'task' : 'tasks'} complete <span className="mx-1 text-forest/35">·</span>{percent}%</p>
        <Link to="/planner" className="inline-flex items-center gap-1 font-semibold text-terracotta-deep hover:underline">View expert plan <ArrowUpRight aria-hidden className="size-3.5" /></Link>
      </div>
    </div>
  );
}

function StudyMap({ subjects, pick, left, count, prefs }: { subjects: MapSubject[]; pick: string | null; left: number | null; count: number; prefs: Preferences | null }) {
  const wide = place(subjects.length, false);
  const tall = place(subjects.length, true);
  const tallHeight = subjects.length * 124 + 70;
  const path = (pts: { x: number; y: number }[]) => (
    <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path className="map-flow" d={curve(pts)} fill="none" stroke="#6f8b7e" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" opacity="0.85" />
    </svg>
  );
  return (
    <section aria-labelledby="study-map" className="relative overflow-hidden rounded-[22px] bg-sage shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_24px_40px_-32px_rgb(32_44_40/0.35)]" data-study-map>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(28% 34% at 12% 92%, rgb(230 242 142 / 0.85), transparent 70%), radial-gradient(26% 30% at 60% 22%, rgb(216 205 230 / 0.55), transparent 70%), radial-gradient(24% 28% at 96% 96%, rgb(236 187 165 / 0.55), transparent 70%), radial-gradient(rgb(32 44 40 / 0.13) 1px, transparent 1.3px)', backgroundSize: 'auto, auto, auto, 18px 18px' }} />
      <div className="relative flex items-start justify-between gap-4 px-6 pt-6 sm:px-7">
        <div>
          <h2 id="study-map" className="text-[19px] font-bold tracking-tight text-charcoal">
            Your study map
          </h2>
          <p className="mt-1.5 font-label text-[11px] tracking-[0] text-mute sm:text-[11.5px] sm:tracking-[0.02em]">
            {count} {count === 1 ? 'subject' : 'subjects'} · follow your curiosity
          </p>
        </div>
        <div className="text-right">
          <div className="label text-[10.5px] text-mute">{prefs?.examCode ? `${prefs.examCode === 'CUET_UG' ? 'CUET UG' : 'CUET PG'}${prefs.targetYear ? ` · ${prefs.targetYear}` : ''}` : 'CUET UG'}</div>
          <Link to="/profile" className="mt-1.5 inline-block whitespace-nowrap text-[12px] font-medium text-terracotta-deep underline-offset-2 hover:underline">
            Change subjects
          </Link>
        </div>
      </div>
      {subjects.length === 0 ? (
        <div className="relative px-6 pt-8 pb-8 sm:px-7">
          <Empty>No subjects to show yet. Choose your subjects in your profile and they will appear here.</Empty>
        </div>
      ) : (
        <>
          {/* Wide: a wave across the map. */}
          <div className="relative mx-auto hidden h-[22rem] max-w-[60rem] sm:block md:h-[21rem] xl:h-[20rem]">
            {path(wide)}
            <div className="absolute inset-x-[2%] inset-y-0">
              <MapNodes subjects={subjects} pts={wide} tall={false} pick={pick} left={left} />
            </div>
            <span aria-hidden className="absolute bottom-[26%] left-[27%] text-[18px] text-terracotta">✳</span>
            <span aria-hidden className="absolute right-[10%] bottom-[16%] text-[13px] text-[#d0a35a]">✳</span>
          </div>
          {/* Narrow: a column that winds down the map. */}
          <div className="relative mx-auto mt-2 sm:hidden" style={{ height: tallHeight }}>
            {path(tall)}
            <MapNodes subjects={subjects} pts={tall} tall pick={pick} left={left} />
          </div>
          <p aria-hidden className="label pointer-events-none relative mr-8 mb-4 hidden -rotate-[3deg] text-right text-[10px] tracking-[0.18em] text-mute/70 sm:block">
            Your own pace · your own path
          </p>
        </>
      )}
    </section>
  );
}

function PracticeCard({ rec, subject, none, onStart, busy, error }: { rec: Recommendation | null; subject: MapSubject | null; none: boolean; onStart: () => void; busy: boolean; error: Error | null }) {
  const Icon = subjectIcon(subject?.name ?? '');
  return (
    <section aria-labelledby="practice-card" className="relative flex min-h-[17rem] flex-col overflow-hidden rounded-[22px] bg-terracotta p-6 text-white shadow-[0_24px_40px_-26px_rgb(196_94_66/0.75)] sm:p-7" data-recommended style={{ backgroundImage: 'linear-gradient(160deg, rgb(255 255 255 / 0.07), transparent 45%)' }}>
      <div aria-hidden className="pointer-events-none absolute -right-24 top-[22%] size-[21rem] rounded-full border border-white/[0.12] bg-white/[0.035]" />
      <div aria-hidden className="pointer-events-none absolute -right-14 top-[32%] size-[15rem] rounded-full border border-white/[0.14] bg-white/[0.03]" />
      <div aria-hidden className="pointer-events-none absolute -right-4 top-[42%] size-[9rem] rounded-full border border-white/[0.16]" />
      <div className="label relative text-[11px] text-white/80">A good place to begin</div>
      {rec ? (
        <>
          <span aria-hidden className="relative mt-5 grid size-12 place-items-center bg-lime text-forest" style={{ borderRadius: '42% 36% 44% 38% / 38% 44% 36% 42%' }}>
            <Icon className="size-[22px]" strokeWidth={1.7} />
          </span>
          <h2 id="practice-card" className="relative mt-4 text-[24px] leading-[1.05] font-bold tracking-[-0.03em] text-white">
            {rec.title}
          </h2>
          <p className="relative mt-2.5 max-w-[26ch] text-[12.5px] leading-[1.5] text-white/85">{rec.body}</p>
          <div className="relative mt-auto pt-8">
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-black/15 px-3 py-2 text-[12.5px] text-white">
                {error.message}
              </p>
            )}
            {rec.action.kind === 'resume' ? (
              <Link to={`/practice/${rec.action.sessionId}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime px-4 text-[13.5px] font-bold text-forest transition-transform hover:-translate-y-px">
                {rec.action.label}
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <button type="button" onClick={onStart} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime px-4 text-[13.5px] font-bold text-forest transition-transform hover:-translate-y-px disabled:opacity-70">
                {busy ? 'Picking questions…' : rec.action.label}
                <ArrowUpRight aria-hidden className="size-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 id="practice-card" className="relative mt-6 text-[26px] leading-[1.1] font-bold tracking-[-0.03em] text-white">
            {none ? 'Choose your subjects' : 'Nothing to suggest yet'}
          </h2>
          <p className="relative mt-3 max-w-[26ch] text-[13.5px] leading-[1.5] text-white/85">{none ? 'Pick the subjects you study and Prepora will suggest where to practise next.' : 'Your recommendation will appear once your progress has loaded.'}</p>
          {none && (
            <div className="relative mt-auto pt-8">
              <Link to="/profile" className="inline-flex h-10 items-center gap-2 rounded-lg bg-lime px-4 text-[13.5px] font-bold text-forest">
                Choose subjects
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Home for signed-in students: a study map of their subjects, a practice suggestion, and the day's details beneath. */
export function Home() {
  const dash = useLoad(api.dashboard, []);
  const prefs = useLoad(api.preferences, []);
  const currentPlan = useLoad(() => api.currentPlan(localDay()), []);
  const subjectsLoad = useLoad(() => api.subjects(EXAM, YEAR), []);
  const { user } = useAuth();
  const navigate = useNavigate();
  const first = user?.displayName.split(/\s+/)[0] ?? '';
  const d = dash.data;
  const last = d?.continueLearning[0];
  const streak = useStreak(user?.id);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<Error | null>(null);

  // The same alphabetical order as the sidebar, so a subject keeps its colour everywhere.
  const all = useMemo(() => [...(subjectsLoad.data ?? [])].sort((a: Subject, b: Subject) => a.name.localeCompare(b.name)), [subjectsLoad.data]);
  const [lessons, setLessons] = useState<Record<string, number | null>>({});
  useEffect(() => {
    let live = true;
    for (const s of all) if (s.available) void lessonCount(s.paperId).then((n) => live && setLessons((x) => (x[s.paperId] === n ? x : { ...x, [s.paperId]: n })));
    return () => {
      live = false;
    };
  }, [all]);

  const chosen = prefs.data?.papers.length ? new Set(prefs.data.papers.map((p) => p.id)) : null;
  const mapSubjects: MapSubject[] = useMemo(
    () =>
      all
        .map((s, index) => ({ s, index }))
        .filter(({ s }) => !chosen || chosen.has(s.paperId))
        .map(({ s, index }) => {
          const p = d?.subjects.find((x) => x.paperCode === s.code);
          return { paperId: s.paperId, code: s.code, name: s.name, index, available: s.available, topics: s.topics, questions: s.questions, attempted: p?.attempted ?? 0, accuracy: p?.accuracy ?? null, lessons: lessons[s.paperId] ?? null };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, prefs.data, d, lessons],
  );

  // Questions still unanswered in the session the student left open, when there is one.
  const runId = d?.inProgress[0]?.id;
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    setRemaining(null);
    if (!runId) return;
    let live = true;
    api.session(runId).then(
      (s) => live && setRemaining(s.questions.filter((q) => !q.answer || (q.answer.selectedPositions === null && q.answer.numericAnswer === null)).length),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [runId]);

  const rec = d ? recommend(mapSubjects, d, remaining) : null;
  const recSubject = rec ? (mapSubjects.find((s) => s.paperId === rec.paperId) ?? null) : null;

  const start = async () => {
    if (!rec) return;
    setBusy(true);
    setStartError(null);
    try {
      const s = await api.dailyPractice({ count: 10, paperId: rec.paperId });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setStartError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  // Keep the full catalogue off-screen until preferences arrive. Otherwise the map briefly
  // renders every subject while the saved selection is still loading, then jumps to the subset.
  const loading = (dash.loading && !d) || (subjectsLoad.loading && !subjectsLoad.data) || (prefs.loading && !prefs.data);
  const failure = dash.error ?? subjectsLoad.error ?? prefs.error;

  return (
    <div data-home className="mx-auto max-w-[84rem]">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pt-0">
        <div className="min-w-0">
          <div className="label text-[15px]! font-medium tracking-[0.16em] text-terracotta sm:text-[17px]!" data-date>
            {dateLabel()}
          </div>
          <h1 className="mt-3 text-[clamp(36px,4.1vw,62px)] leading-[0.98] font-bold tracking-[-0.045em] text-charcoal">
            Follow a question.
            <span className="block pb-1 font-editorial text-[1.06em] leading-[1.02] font-medium tracking-[-0.02em] text-terracotta italic">Find your way.</span>
          </h1>
          <p className="mt-3 max-w-[40rem] text-[13.5px] leading-snug text-mute">
            {greeting()}
            {first ? `, ${first}` : ''}. Choose a path, then take it one question at a time.
          </p>
        </div>
        {streak && (
          <div className="flex items-center gap-3 border-l border-line py-1.5 pl-4 sm:mb-2" data-streak>
            <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-terracotta text-[16px] leading-none font-bold text-white num">{streak.capped ? `${streak.days}+` : String(streak.days).padStart(2, '0')}</span>
            <span className="flex flex-col justify-center gap-1 leading-none">
              <span className="label block text-[10.5px] leading-none text-mute">Your streak</span>
              <span className="block text-[13px] leading-none font-bold text-charcoal">{streak.days === 1 ? 'day' : 'days'} in a row</span>
            </span>
          </div>
        )}
      </header>

      {failure ? (
        <div className="mt-8">
          <ErrorBox error={failure} onRetry={() => (dash.error ? dash.reload() : subjectsLoad.error ? subjectsLoad.reload() : prefs.reload())} />
        </div>
      ) : loading ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2.06fr)_minmax(0,1fr)]" role="status" aria-label="Loading your study map">
          <div className="h-[28rem] animate-pulse rounded-[22px] bg-sage/70" />
          <div className="h-[28rem] animate-pulse rounded-[22px] bg-terracotta/40" />
        </div>
      ) : (
        <div className="mt-6 grid items-stretch gap-5 xl:grid-cols-[minmax(0,2.06fr)_minmax(0,1fr)]">
          <StudyMap subjects={mapSubjects} pick={rec?.paperId ?? null} left={rec?.left ?? null} count={mapSubjects.length} prefs={prefs.data} />
          <PracticeCard rec={rec} subject={recSubject} none={mapSubjects.length === 0} onStart={start} busy={busy} error={startError} />
        </div>
      )}

      {!failure && !loading && <StudyMilestone currentPlan={currentPlan.data ?? null} />}

      {last && (
        <p className="mt-6 text-[13.5px] text-mute" data-last-opened>
          <span className="label mr-3 text-[10.5px]">Last opened</span>
          <Link to={last.kind === 'LESSON_VIEW' ? `/learn/${last.resourceId}` : `/topic/${last.nodeId}`} className="font-semibold text-charcoal underline-offset-2 hover:text-terracotta-deep hover:underline">
            {last.title ?? 'Your last topic'}
          </Link>
          {last.paper && <span> · {last.paper}</span>}
        </p>
      )}

      <section aria-label="Today" className="mt-8 border-t border-line pt-8" data-home-today>
        <DashboardPage embedded />
      </section>
    </div>
  );
}
