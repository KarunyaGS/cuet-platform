/** Small shared pieces of the study-plan screens: activity icons, evidence labels and date helpers. */
import { BookOpen, ClipboardCheck, FlaskConical, Flag, ListChecks, NotebookPen, RotateCcw, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanEvidence, PlanKind } from '../../api';
import { localDay } from '../../api';

export const shortName = (name: string) => name.split('/')[0]!.trim();

const ICON: Record<PlanKind, ReactNode> = {
  LESSON: <BookOpen aria-hidden />, TOPIC: <BookOpen aria-hidden />, REVISE: <RotateCcw aria-hidden />, PRACTICE: <ListChecks aria-hidden />, LAB: <FlaskConical aria-hidden />,
  CHECKPOINT: <Flag aria-hidden />, MOCK: <Timer aria-hidden />, REVIEW: <ClipboardCheck aria-hidden />, CUSTOM: <NotebookPen aria-hidden />,
};
export const KindIcon = ({ kind }: { kind: PlanKind }) => <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-forest/8 text-forest [&>svg]:size-3.5">{ICON[kind]}</span>;

export const EVIDENCE: Record<PlanEvidence, { label: string; hint: string; cls: string }> = {
  PERSONAL: { label: 'From your results', hint: 'Based on your own answers and activity on the platform', cls: 'bg-[#f6e5db] text-terracotta' },
  SYLLABUS: { label: 'Syllabus order', hint: 'Follows the official syllabus order', cls: 'bg-[#e9eedf] text-forest' },
  METHOD: { label: 'Study method', hint: 'A study-method suggestion (the method is a draft awaiting academic review)', cls: 'bg-paper text-ink-2 ring-1 ring-inset ring-rule' },
  VERIFIED_TREND: { label: 'Verified past-paper trend', hint: 'From verified official past papers. History, not a prediction', cls: 'bg-[#e1ecf5] text-[#1f5d8a]' },
};
export const EvidenceTag = ({ e }: { e: PlanEvidence | null | undefined }) => (e ? <span title={EVIDENCE[e].hint} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${EVIDENCE[e].cls}`}>{EVIDENCE[e].label}</span> : null);

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y!, m! - 1, d! + n));
}
export const dayLabel = (day: string, long = false) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' });
};
export const hours = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`);
