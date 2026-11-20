/**
 * The expert-guided plan area at the top of the Study Planner: the goal questions when there is no plan, the plan itself when there is one.
 * The weekly planner below it reads the same items, so ticking, moving or removing anything shows in both places.
 */
import { useState } from 'react';
import { api, localDay } from '../../api';
import { buttonClass, ErrorBox, Loading, useLoad } from '../../ui';
import { ActivePlan } from './ActivePlan';
import { StudyGoals } from './StudyGoals';

export function PlanSection({ onChange }: { onChange: () => void }) {
  const cur = useLoad(() => api.currentPlan(localDay()), []);
  const [mode, setMode] = useState<'view' | 'new' | 'change'>('view');
  const refresh = () => { cur.reload(); onChange(); };
  if (cur.loading && !cur.data) return <Loading />;
  if (cur.error || !cur.data) return <ErrorBox error={cur.error ?? new Error('Your plan could not be loaded.')} onRetry={cur.reload} />;
  const data = cur.data;
  if (!data.plan) return <StudyGoals onDone={() => { setMode('view'); refresh(); }} />;
  if (mode === 'change') return <StudyGoals regenerateId={data.plan.id} initial={data.plan.goal} onDone={() => { setMode('view'); refresh(); }} onCancel={() => setMode('view')} />;
  if (mode === 'new') return <StudyGoals replacing onDone={() => { setMode('view'); refresh(); }} onCancel={() => setMode('view')} />;
  return (
    <>
      <ActivePlan key={`${data.plan.id}-${data.plan.version}`} data={data} reload={refresh} onChangeGoal={() => setMode('change')} />
      <div className="-mt-3 mb-6 flex justify-end"><button type="button" onClick={() => setMode('new')} data-new-plan className={buttonClass('ghost')}>Start a different plan</button></div>
    </>
  );
}
