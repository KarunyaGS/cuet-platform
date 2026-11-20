/**
 * Where each kind of plan activity opens. One place, used by the planner, the dashboard and the weekly grid, so an activity always leads straight
 * to the real learning, practice, test, lab or review screen.
 */
import type { PlanKind } from './api';
import { LABS } from './visual/labs';

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  LESSON: 'Learn', TOPIC: 'Learn', REVISE: 'Revise', PRACTICE: 'Practise', LAB: 'Lab', CHECKPOINT: 'Checkpoint', MOCK: 'Mock test', REVIEW: 'Review mistakes', CUSTOM: 'Task',
};

export interface PlanLinkInput { kind: string; refId: string | null; targetCount?: number | null; latestSessionId?: string | null }

export function planHref(i: PlanLinkInput): string | null {
  const id = i.refId;
  if (i.kind === 'REVIEW') return i.latestSessionId ? `/results/${i.latestSessionId}` : '/progress';
  if (!id) return null;
  switch (i.kind) {
    case 'LESSON': return `/learn/${id}`;
    case 'TOPIC': return `/topic/${id}`;
    case 'REVISE': return `/revise/${id}`;
    case 'PRACTICE': return `/practice/start?nodeId=${encodeURIComponent(id)}${i.targetCount ? `&count=${i.targetCount}` : ''}`;
    case 'CHECKPOINT': return `/exam/start?mode=TOPIC_TEST&nodeId=${encodeURIComponent(id)}`;
    case 'MOCK': return `/exam/start?mode=MOCK_TEST&paperId=${encodeURIComponent(id)}`;
    case 'LAB': return LABS.find((l) => l.id === id)?.path ?? '/labs';
    default: return null;
  }
}

/** The practical labs the plan builder may suggest, from the same registry the Labs page uses. */
export const planLabs = () =>
  LABS.map((l) => ({ id: l.id, subject: l.subject, lessonTitleStartsWith: l.lessonTitleStartsWith, title: l.title, minutes: Math.min(120, Math.max(5, Math.round(l.minutes ?? 20))) })).filter(
    (l) => /^[a-z0-9][a-z0-9_-]{0,79}$/.test(l.id) && l.lessonTitleStartsWith.length >= 3,
  );
