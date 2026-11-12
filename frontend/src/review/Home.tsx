/** Reviewer area: dashboard (assignments, counts, own decisions) and the lesson/question review screen. */
import { ClipboardList } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { ApiError } from '../api';
import { reviewContentApi, VERIFICATION, when } from '../admin/api';
import { ContentBrowser } from '../admin/ContentBrowser';
import { Empty, ErrorBox, Loading, Meter, PageHeader, SectionTitle, StatGroup, useLoad } from '../ui';

export function ReviewLayout() {
  const tab = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`;
  return (
    <div>
      <nav aria-label="Review" className="mb-6 flex gap-1 overflow-x-auto border-b border-rule pb-3">
        <NavLink to="/review" end className={tab}>
          My review work
        </NavLink>
        <NavLink to="/review/syllabus" className={tab}>
          Syllabus
        </NavLink>
        <NavLink to="/review/content" className={tab}>
          Lessons and questions
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

export function ReviewDashboard() {
  const d = useLoad(reviewContentApi.dashboard, []);
  if (d.loading) return <Loading />;
  if (d.error) {
    const denied = d.error instanceof ApiError && (d.error.status === 403 || d.error.status === 401);
    return denied ? <Empty>Your account does not have the reviewer role. Ask an administrator to give it to you.</Empty> : <ErrorBox error={d.error} onRetry={d.reload} />;
  }
  const x = d.data!;
  const n = (type: string, v: string) => x.content.find((c) => c.type === type && c.verification === v)?.n ?? 0;
  const waiting = (type: string) => n(type, 'UNVERIFIED') + n(type, 'MACHINE_VERIFIED');
  const rows = (v: string) => x.syllabusRows.find((r) => r.verification === v)?.n ?? 0;
  return (
    <div>
      <PageHeader title="My review work" subtitle="Nothing is approved until a reviewer decides it." />
      <div className="mb-10">
        <StatGroup
          items={[
            { label: 'Questions waiting', value: waiting('QUESTION'), hint: `${n('QUESTION', 'VERIFIED')} approved` },
            { label: 'Lessons waiting', value: waiting('LEARNING_RESOURCE'), hint: `${n('LEARNING_RESOURCE', 'VERIFIED')} approved` },
            { label: 'Syllabus rows waiting', value: rows('UNVERIFIED') + rows('MACHINE_VERIFIED'), hint: `${rows('VERIFIED')} approved` },
            { label: 'My decisions', value: x.myDecisions },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="rv-asg">
          <SectionTitle id="rv-asg">Assigned to me</SectionTitle>
          {x.assignments.length === 0 ? (
            <Empty icon={<ClipboardList />}>No papers are assigned to you. You can still review anything in the Syllabus and Lessons and questions tabs.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {x.assignments.map((a) => (
                <li key={a.id}>
                  <Link to={a.scope === 'SYLLABUS' ? `/review/paper/${a.paper.id}` : '/review/content'} className="block px-4 py-3 transition-colors hover:bg-paper">
                    <span className="block text-sm font-medium text-ink">
                      {a.paper.name} <span className="num text-xs font-normal text-ink-3">{a.paper.code}</span>
                    </span>
                    <span className="block text-xs text-ink-2">{a.scope === 'SYLLABUS' ? 'Syllabus' : 'Lessons and questions'}{a.note ? `. ${a.note}` : ''}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className="flex-1">
                        <Meter value={a.progress.total ? (100 * a.progress.decided) / a.progress.total : 0} tone={a.progress.total && a.progress.decided >= a.progress.total ? 'correct' : 'accent'} label="Items decided" />
                      </span>
                      <span className="num text-xs text-ink-2">
                        {a.progress.decided} of {a.progress.total} decided
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="rv-recent">
          <SectionTitle id="rv-recent">My recent decisions</SectionTitle>
          {x.myRecent.length === 0 ? (
            <Empty>You have not recorded a decision yet.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {x.myRecent.map((r) => (
                <li key={r.id} className="px-4 py-2.5 text-sm">
                  <span className="text-ink">
                    {{ CURRICULUM_NODE: 'Syllabus row', QUESTION: 'Question', LEARNING_RESOURCE: 'Lesson', SYLLABUS_VERSION: 'Syllabus' }[r.entity_type] ?? r.entity_type}:{' '}
                    <span className="font-medium">{VERIFICATION[r.to_status ?? '']?.label ?? r.action.toLowerCase().replace(/_/g, ' ')}</span>
                  </span>
                  <span className="num ml-2 text-xs text-ink-3">{when(r.created_at)}</span>
                  {r.comment && <p className="text-ink-2">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function ReviewContent() {
  return (
    <div>
      <PageHeader title="Review lessons and questions" subtitle="Check each item against the syllabus topic, then approve it, request changes or reject it." />
      <ContentBrowser mode="review" />
    </div>
  );
}
