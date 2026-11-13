/** Admin console: overview, students, content, staff and roles, activity. Staff sign in with their own account. */
import { Copy, ShieldAlert, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router';
import { ApiError, type ExamCode } from '../api';
import { accuracyTone, Badge, Button, Empty, ErrorBox, inputClass, Loading, Meter, PageHeader, SearchInput, SectionTitle, Segmented, StatGroup, useLoad } from '../ui';
import { actionLabel, consoleApi, VERIFICATION, when, type ActivityItem, type StaffMe } from './api';
import { ContentBrowser } from './ContentBrowser';

const select = 'h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none';
const useStaff = () => useOutletContext<StaffMe>();
const can = (me: StaffMe, p: string) => me.permissions.includes(p);

export function AdminLayout() {
  const me = useLoad(consoleApi.me, []);
  if (me.loading) return <Loading />;
  if (me.error) {
    const denied = me.error instanceof ApiError && (me.error.status === 403 || me.error.status === 401);
    return denied ? (
      <Empty icon={<ShieldAlert />}>This area is for CUET Prep administrators. Your account does not have an admin role.</Empty>
    ) : (
      <ErrorBox error={me.error} onRetry={me.reload} />
    );
  }
  const tab = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`;
  const m = me.data!;
  return (
    <div>
      <nav aria-label="Admin" className="mb-6 flex gap-1 overflow-x-auto border-b border-rule pb-3">
        <NavLink to="/admin" end className={tab}>
          Overview
        </NavLink>
        {can(m, 'users:manage') && (
          <NavLink to="/admin/students" className={tab}>
            Students
          </NavLink>
        )}
        <NavLink to="/admin/content" className={tab}>
          Lessons and questions
        </NavLink>
        <NavLink to="/admin/completion" className={tab}>
          Content completion
        </NavLink>
        {can(m, 'users:manage') && (
          <NavLink to="/admin/staff" className={tab}>
            Reviewers and roles
          </NavLink>
        )}
        <NavLink to="/admin/practice-centre" className={tab}>
          Practice Centre
        </NavLink>
        <NavLink to="/admin/past-papers" className={tab}>
          Previous-year papers
        </NavLink>
        {can(m, 'billing:manage') && (
          <NavLink to="/admin/billing" className={tab}>
            Plans and payments
          </NavLink>
        )}
        {can(m, 'users:manage') && (
          <NavLink to="/admin/email" className={tab}>
            Email
          </NavLink>
        )}
        <NavLink to="/admin/updates" className={tab}>
          Government updates
        </NavLink>
        <NavLink to="/admin/activity" className={tab}>
          Activity
        </NavLink>
      </nav>
      <Outlet context={m} />
    </div>
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <Empty>No activity recorded yet.</Empty>;
  return (
    <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
          <span className="num w-40 shrink-0 text-xs text-ink-3">{when(a.createdAt)}</span>
          <span className="min-w-0 flex-1 text-ink">
            <span className="font-medium">{a.actorName.startsWith('admin:') ? 'Import tools' : a.actorName}</span> <span className="text-ink-2">{actionLabel(a.action).toLowerCase()}</span>
            {a.entityLabel ? <span className="text-ink-2">: {a.entityLabel}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AdminOverview() {
  const o = useLoad(consoleApi.overview, []);
  if (o.loading) return <Loading />;
  if (o.error) return <ErrorBox error={o.error} onRetry={o.reload} />;
  const d = o.data!;
  const c = d.counts;
  const sum = (type: string, pred: (x: { status: string; verification: string }) => boolean) => d.content.filter((x) => x.type === type && pred(x)).reduce((t, x) => t + x.n, 0);
  const row = (type: 'QUESTION' | 'LESSON', label: string) => {
    const total = sum(type, () => true);
    const approved = sum(type, (x) => x.verification === 'VERIFIED');
    return (
      <tr key={type}>
        <td className="px-4 py-2.5 text-ink">{label}</td>
        <td className="num px-4 py-2.5 text-right">{total}</td>
        <td className="num px-4 py-2.5 text-right">{approved}</td>
        <td className="num px-4 py-2.5 text-right">{sum(type, (x) => x.verification === 'NEEDS_CHANGES' || x.verification === 'REJECTED')}</td>
        <td className="num px-4 py-2.5 text-right">{sum(type, (x) => x.status === 'PUBLISHED')}</td>
        <td className="w-36 px-4 py-2.5">
          <Meter value={total ? (100 * approved) / total : 0} tone="correct" label={`${label} approved by a reviewer`} />
        </td>
      </tr>
    );
  };
  return (
    <div>
      <PageHeader title="Admin overview" subtitle="Figures come straight from the database." />
      <div className="mb-10">
        <StatGroup
          items={[
            { label: 'Students', value: c.students ?? 0, hint: `${c.new_accounts_7d ?? 0} new accounts in 7 days` },
            { label: 'Active in 7 days', value: c.active_students_7d ?? 0, hint: `${c.answers_7d ?? 0} answers given` },
            { label: 'Tests submitted', value: c.tests_submitted ?? 0, hint: `${c.tests_submitted_7d ?? 0} in 7 days` },
            { label: 'Reviewer decisions', value: c.human_decisions ?? 0, hint: 'Approvals, change requests and rejections' },
            { label: 'Suspended accounts', value: c.suspended ?? 0, tone: c.suspended ? 'wrong' : undefined },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="ov-content">
          <SectionTitle id="ov-content" action={<Link to="/admin/content" className="font-medium text-accent hover:underline">Manage</Link>}>
            Lessons and questions
          </SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Approved</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Flagged</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Published</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">{[row('LESSON', 'Lessons'), row('QUESTION', 'Questions')]}</tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="ov-syllabus">
          <SectionTitle id="ov-syllabus" action={<Link to="/admin/completion" className="font-medium text-accent hover:underline">By subject</Link>}>
            Syllabus
          </SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-medium">Exam</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Papers</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Machine-checked</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Signed off</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">With questions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {d.syllabus.map((s) => (
                  <tr key={s.exam}>
                    <td className="px-4 py-2.5 text-ink">{s.exam === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'}</td>
                    <td className="num px-4 py-2.5 text-right">{s.papers}</td>
                    <td className="num px-4 py-2.5 text-right">{s.machine_verified}</td>
                    <td className="num px-4 py-2.5 text-right">{s.human_verified}</td>
                    <td className="num px-4 py-2.5 text-right">{s.with_questions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="ov-activity" className="lg:col-span-2">
          <SectionTitle id="ov-activity" action={<Link to="/admin/activity" className="font-medium text-accent hover:underline">All activity</Link>}>
            Recent activity
          </SectionTitle>
          <ActivityList items={d.recentActivity} />
        </section>
      </div>
    </div>
  );
}

export function AdminStudents() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad(() => consoleApi.students({ q: q || undefined, status: status || undefined, page }), [q, status, page]);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25));
  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={list.data ? `${list.data.total} accounts` : undefined}
        actions={
          <>
            <select aria-label="Account status" className={select} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
              <option value="">All accounts</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Suspended</option>
            </select>
            <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search by name or email" label="Search students" />
          </>
        }
      />
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.items.length === 0 ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Roles</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Tests</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last practice</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {list.data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-paper">
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/students/${s.id}`} className="font-medium text-ink hover:text-accent">
                        {s.displayName}
                      </Link>
                      <div className="text-xs text-ink-3">{s.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-2">{s.roles.map((r) => r.charAt(0) + r.slice(1).toLowerCase().replace('_', ' ')).join(', ')}</td>
                    <td className="num px-4 py-2.5 text-right">{s.tests}</td>
                    <td className="num px-4 py-2.5 text-xs text-ink-2">{s.lastPractice ? when(s.lastPractice) : 'Never'}</td>
                    <td className="num px-4 py-2.5 text-xs text-ink-2">{when(s.createdAt)}</td>
                    <td className="px-4 py-2.5">{s.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-ink-2">
          <Button kind="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="num">
            Page {page} of {pages}
          </span>
          <Button kind="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminStudent() {
  const { id = '' } = useParams();
  const me = useStaff();
  const s = useLoad(() => consoleApi.student(id), [id]);
  const [err, setErr] = useState<Error | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  if (s.loading && !s.data) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const run = async (f: () => Promise<unknown>) => {
    setErr(null);
    try {
      await f();
      s.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  const active = d.status === 'ACTIVE';
  return (
    <div>
      <PageHeader
        back={{ to: '/admin/students', label: 'Students' }}
        title={d.displayName}
        subtitle={`${d.email}. Joined ${when(d.createdAt)}. Last sign-in: ${when(d.lastLoginAt)}.`}
        actions={active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}
      />
      {err && <ErrorBox error={err} />}
      <div className="mb-10">
        <StatGroup
          items={[
            { label: 'Tests submitted', value: d.totals.sessions },
            { label: 'Questions answered', value: d.totals.answered },
            { label: 'Accuracy', value: d.totals.accuracy === null ? '–' : `${d.totals.accuracy}%` },
            { label: 'Bookmarks', value: d.bookmarks, hint: `${d.planItems} plan ${d.planItems === 1 ? 'item' : 'items'}` },
            { label: 'Signed-in devices', value: d.openSessions },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="st-subjects">
          <SectionTitle id="st-subjects">Subjects practised</SectionTitle>
          {d.subjects.length === 0 ? (
            <Empty>No practice submitted yet.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {d.subjects.map((x) => (
                <li key={x.code} className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate text-ink">
                    {x.paper} <span className="num text-xs text-ink-3">{x.attempted} answered</span>
                  </span>
                  <Meter value={x.accuracy ?? 0} tone={accuracyTone(x.accuracy)} />
                  <span className="num text-right text-xs text-ink-2">{x.accuracy === null ? '–' : `${x.accuracy}%`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-ink-2">
            {d.preferences?.examCode
              ? `Preparing for ${d.preferences.examCode === 'CUET_UG' ? 'CUET-UG' : 'CUET-PG'}${d.preferences.targetYear ? ` ${d.preferences.targetYear}` : ''}, ${d.preferences.subjects} subjects chosen.`
              : 'Has not chosen an exam or subjects yet.'}
          </p>
        </section>
        <section aria-labelledby="st-sessions">
          <SectionTitle id="st-sessions">Recent sessions</SectionTitle>
          {d.recentSessions.length === 0 ? (
            <Empty>No sessions yet.</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {d.recentSessions.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="num w-36 shrink-0 text-xs text-ink-3">{when(x.started_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {{ PRACTICE: 'Practice', TOPIC_TEST: 'Topic test', MOCK_TEST: 'Mock test' }[x.mode] ?? x.mode}
                    {x.paper ? <span className="text-ink-3">, {x.paper}</span> : null}
                  </span>
                  <span className="num shrink-0 text-ink-2">{x.status === 'SUBMITTED' ? `${x.score} / ${x.max_score}` : 'Unfinished'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="st-account" className="lg:col-span-2">
          <SectionTitle id="st-account">Account actions</SectionTitle>
          <div className="space-y-4 rounded-xl border border-rule bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button kind="secondary" onClick={() => void run(async () => setLink((await consoleApi.resetLink(d.email)).path))}>
                Create a password reset link
              </Button>
              <span className="text-sm text-ink-2">Works once, for one hour. Give it to the student yourself.</span>
            </div>
            {link && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
                <code className="min-w-0 flex-1 break-all text-ink">{window.location.origin + link}</code>
                <Button kind="secondary" size="sm" icon={<Copy aria-hidden />} onClick={() => void navigator.clipboard?.writeText(window.location.origin + link)}>
                  Copy
                </Button>
              </div>
            )}
            {d.id !== me.id && (
              <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
                {active ? (
                  <>
                    <input className={`${inputClass} max-w-sm`} placeholder="Reason for suspending (kept in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-label="Reason for suspending" />
                    <Button kind="danger" icon={<UserRoundX aria-hidden />} onClick={() => window.confirm(`Suspend ${d.displayName}? They will be signed out and cannot sign in until restored.`) && void run(() => consoleApi.setStatus(d.id, 'DISABLED', reason || undefined))}>
                      Suspend account
                    </Button>
                  </>
                ) : (
                  <Button icon={<UserRoundCheck aria-hidden />} onClick={() => void run(() => consoleApi.setStatus(d.id, 'ACTIVE'))}>
                    Restore account
                  </Button>
                )}
                <span className="text-sm text-ink-2">Suspending never deletes the student’s progress.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminContent() {
  const me = useStaff();
  return (
    <div>
      <PageHeader title="Lessons and questions" subtitle="Edit, send for review and publish. Approving the content itself is done by reviewers." />
      <ContentBrowser mode="admin" canWrite={can(me, 'content:write')} canPublish={can(me, 'content:publish')} />
    </div>
  );
}

export function AdminCompletion() {
  const [exam, setExam] = useState<ExamCode>('CUET_UG');
  const [only, setOnly] = useState<'all' | 'started'>('all');
  const cov = useLoad(() => consoleApi.coverage(exam), [exam]);
  const rows = (cov.data ?? []).filter((p) => only === 'all' || p.resourcesLinkedToPaper > 0 || p.questionsLinkedToPaper > 0 || (p.syllabus?.withLearningContent ?? 0) > 0);
  const tot = (cov.data ?? []).reduce((t, p) => ({ points: t.points + (p.syllabus?.learningPoints ?? 0), lessons: t.lessons + (p.syllabus?.withLearningContent ?? 0), qs: t.qs + (p.syllabus?.withQuestions ?? 0), questions: t.questions + p.questionsLinkedToPaper }), { points: 0, lessons: 0, qs: 0, questions: 0 });
  return (
    <div>
      <PageHeader
        title="Content completion"
        subtitle="For each subject: how many syllabus topics have a lesson and questions. A topic counts only when real content is linked to it."
        actions={
          <>
            <Segmented label="Exam" value={exam} onChange={setExam} options={[{ value: 'CUET_UG', label: 'CUET-UG' }, { value: 'CUET_PG', label: 'CUET-PG' }]} />
            <Segmented label="Subjects shown" value={only} onChange={setOnly} options={[{ value: 'all', label: 'All subjects' }, { value: 'started', label: 'With content' }]} />
          </>
        }
      />
      {cov.error && <ErrorBox error={cov.error} onRetry={cov.reload} />}
      {cov.loading && !cov.data && <Loading />}
      {cov.data && (
        <>
          <div className="mb-6">
            <StatGroup
              items={[
                { label: 'Subjects', value: cov.data.length },
                { label: 'Syllabus topics', value: tot.points },
                { label: 'Topics with a lesson', value: tot.lessons, hint: tot.points ? `${Math.round((1000 * tot.lessons) / tot.points) / 10}% of topics` : undefined },
                { label: 'Topics with questions', value: tot.qs, hint: tot.points ? `${Math.round((1000 * tot.qs) / tot.points) / 10}% of topics` : undefined },
                { label: 'Questions', value: tot.questions },
              ]}
            />
          </div>
          {rows.length === 0 ? (
            <Empty>No subject of this exam has lessons or questions yet.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                    <th scope="col" className="px-4 py-2.5 font-medium">Subject</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Syllabus</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Topics</th>
                    <th scope="col" className="w-44 px-4 py-2.5 font-medium">With a lesson</th>
                    <th scope="col" className="w-44 px-4 py-2.5 font-medium">With questions</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Questions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {rows.map((p) => {
                    const s = p.syllabus;
                    const pts = s?.learningPoints ?? 0;
                    const bar = (n: number) => (
                      <span className="flex items-center gap-2">
                        <span className="flex-1">
                          <Meter value={pts ? (100 * n) / pts : 0} tone={pts && n >= pts ? 'correct' : 'accent'} />
                        </span>
                        <span className="num w-14 text-right text-xs text-ink-2">
                          {n} / {pts}
                        </span>
                      </span>
                    );
                    return (
                      <tr key={p.testPaperId}>
                        <td className="px-4 py-2.5 text-ink">
                          {p.name} <span className="num ml-1 text-xs text-ink-3">{p.code}</span>
                        </td>
                        <td className="px-4 py-2.5">{s ? <Badge tone={VERIFICATION[s.verification]?.tone ?? 'zinc'}>{VERIFICATION[s.verification]?.label ?? s.verification}</Badge> : <Badge>Not imported</Badge>}</td>
                        <td className="num px-4 py-2.5 text-right">{pts}</td>
                        <td className="px-4 py-2.5">{bar(s?.withLearningContent ?? 0)}</td>
                        <td className="px-4 py-2.5">{bar(s?.withQuestions ?? 0)}</td>
                        <td className="num px-4 py-2.5 text-right">{p.questionsLinkedToPaper}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AdminStaff() {
  const staff = useLoad(consoleApi.staff, []);
  const asg = useLoad(consoleApi.assignments, []);
  const papers = useLoad(consoleApi.papers, []);
  const [err, setErr] = useState<Error | null>(null);
  const [role, setRole] = useState({ email: '', role: 'REVIEWER' });
  const [a, setA] = useState({ email: '', paperId: '', scope: 'CONTENT' as 'CONTENT' | 'SYLLABUS', note: '' });
  const run = async (f: () => Promise<unknown>, after: () => void = () => undefined) => {
    setErr(null);
    try {
      await f();
      after();
      staff.reload();
      asg.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };
  const reviewers = staff.data?.staff.filter((s) => s.roles.some((r) => r === 'REVIEWER' || r === 'SUPER_ADMIN')) ?? [];
  const field = (label: string, node: ReactNode) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {node}
    </label>
  );
  return (
    <div>
      <PageHeader title="Reviewers and roles" subtitle="Give staff roles, and assign papers to reviewers. Every change is recorded in the activity log." />
      {err && <ErrorBox error={err} />}
      {staff.error && <ErrorBox error={staff.error} onRetry={staff.reload} />}
      {staff.loading && !staff.data && <Loading />}
      {staff.data && (
        <div className="space-y-10">
          <section aria-labelledby="sf-staff">
            <SectionTitle id="sf-staff">Staff</SectionTitle>
            {staff.data.staff.length === 0 ? (
              <Empty>No staff accounts yet. Give a role to an existing account below.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                      <th scope="col" className="px-4 py-2.5 font-medium">Person</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Roles</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Review decisions</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Last sign-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {staff.data.staff.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-ink">{s.displayName}</span>
                          <div className="text-xs text-ink-3">{s.email}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap gap-1.5">
                            {s.roles.map((r) => (
                              <span key={r} className="inline-flex items-center gap-1 rounded-md bg-paper py-0.5 pr-1 pl-2 text-xs text-ink ring-1 ring-rule">
                                {staff.data!.roles.find((x) => x.code === r)?.name ?? r}
                                {r !== 'STUDENT' && (
                                  <button title={`Remove the ${r} role`} aria-label={`Remove the ${r} role from ${s.displayName}`} className="grid size-5 place-items-center rounded text-ink-3 hover:bg-wrong-soft hover:text-wrong" onClick={() => window.confirm(`Remove the ${r} role from ${s.displayName}?`) && void run(() => consoleApi.setRole(s.email, r, false))}>
                                    <Trash2 aria-hidden className="size-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="num px-4 py-2.5 text-right">{s.decisions}</td>
                        <td className="num px-4 py-2.5 text-xs text-ink-2">{when(s.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form
              className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-rule bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => consoleApi.setRole(role.email.trim(), role.role, true), () => setRole({ ...role, email: '' }));
              }}
            >
              {field('Account email (must have signed up already)', <input type="email" required className={`${inputClass} sm:w-72`} value={role.email} onChange={(e) => setRole({ ...role, email: e.target.value })} />)}
              {field(
                'Role',
                <select className={select} value={role.role} onChange={(e) => setRole({ ...role, role: e.target.value })}>
                  {staff.data.roles.filter((r) => !['STUDENT', 'PARENT'].includes(r.code)).map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>,
              )}
              <Button type="submit">Give role</Button>
            </form>
          </section>

          <section aria-labelledby="sf-roles">
            <SectionTitle id="sf-roles">What each role can do</SectionTitle>
            <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-[13px] text-ink-2">
                    <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">People</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {staff.data.roles.map((r) => (
                    <tr key={r.code} className="align-top">
                      <td className="px-4 py-2.5 font-medium text-ink">{r.name}</td>
                      <td className="num px-4 py-2.5 text-right">{r.members}</td>
                      <td className="px-4 py-2.5 text-ink-2">{r.permissions.length ? r.permissions.map((p) => p.replace(':', ': ')).join(', ') : 'Uses the student app only'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="sf-asg">
            <SectionTitle id="sf-asg">Reviewer assignments</SectionTitle>
            {(asg.data ?? []).length === 0 ? (
              <Empty>No papers are assigned yet.</Empty>
            ) : (
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                {asg.data!.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-ink">{x.reviewer.displayName}</span>
                      <span className="text-ink-2">
                        {' '}
                        reviews the {x.scope === 'SYLLABUS' ? 'syllabus' : 'lessons and questions'} of {x.paper.name} ({x.paper.code})
                      </span>
                      {x.note && <span className="block text-xs text-ink-3">{x.note}</span>}
                    </span>
                    <span className="flex w-44 items-center gap-2">
                      <span className="flex-1">
                        <Meter value={x.progress.total ? (100 * x.progress.decided) / x.progress.total : 0} tone={x.progress.total && x.progress.decided >= x.progress.total ? 'correct' : 'accent'} />
                      </span>
                      <span className="num text-xs text-ink-2">
                        {x.progress.decided} / {x.progress.total}
                      </span>
                    </span>
                    <Button kind="ghost" size="sm" icon={<Trash2 aria-hidden />} onClick={() => void run(() => consoleApi.unassign(x.id))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-rule bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => consoleApi.assign({ email: a.email, paperId: a.paperId, scope: a.scope, note: a.note || undefined }), () => setA({ ...a, note: '' }));
              }}
            >
              {field(
                'Reviewer',
                <select required className={select} value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })}>
                  <option value="">Choose a reviewer</option>
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.email}>
                      {r.displayName}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'What to review',
                <select className={select} value={a.scope} onChange={(e) => setA({ ...a, scope: e.target.value as 'CONTENT' | 'SYLLABUS', paperId: '' })}>
                  <option value="CONTENT">Lessons and questions</option>
                  <option value="SYLLABUS">Syllabus</option>
                </select>,
              )}
              {a.scope === 'CONTENT'
                ? field(
                    'Subject',
                    <select required className={`${select} max-w-[16rem]`} value={a.paperId} onChange={(e) => setA({ ...a, paperId: e.target.value })}>
                      <option value="">Choose a subject with content</option>
                      {papers.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.exam === 'CUET_UG' ? 'UG' : 'PG'} {p.code} {p.name}
                        </option>
                      ))}
                    </select>,
                  )
                : field('Paper', <PaperPicker value={a.paperId} onChange={(paperId) => setA({ ...a, paperId })} />)}
              {field('Note (optional)', <input className={`${inputClass} sm:w-56`} value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} maxLength={500} />)}
              <Button type="submit" disabled={!a.email || !a.paperId}>
                Assign
              </Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

/** Any paper of either exam (for syllabus assignments). */
function PaperPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [exam, setExam] = useState<ExamCode>('CUET_UG');
  const cov = useLoad(() => consoleApi.coverage(exam), [exam]);
  return (
    <span className="flex gap-2">
      <select aria-label="Exam" className={select} value={exam} onChange={(e) => (setExam(e.target.value as ExamCode), onChange(''))}>
        <option value="CUET_UG">CUET-UG</option>
        <option value="CUET_PG">CUET-PG</option>
      </select>
      <select required aria-label="Paper" className={`${select} max-w-[16rem]`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{cov.loading ? 'Loading…' : 'Choose a paper'}</option>
        {cov.data?.map((p) => (
          <option key={p.testPaperId} value={p.testPaperId}>
            {p.code} {p.name}
          </option>
        ))}
      </select>
    </span>
  );
}

export function AdminActivity() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const log = useLoad(() => consoleApi.activity({ action: action || undefined, page }), [action, page]);
  const pages = Math.max(1, Math.ceil((log.data?.total ?? 0) / 25));
  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={log.data ? `${log.data.total} recorded actions. The log cannot be edited.` : undefined}
        actions={
          <select aria-label="Kind of action" className={select} value={action} onChange={(e) => (setAction(e.target.value), setPage(1))}>
            <option value="">All actions</option>
            {log.data?.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {actionLabel(a.action)} ({a.n})
              </option>
            ))}
          </select>
        }
      />
      {log.error && <ErrorBox error={log.error} onRetry={log.reload} />}
      {log.loading && !log.data && <Loading />}
      {log.data && <ActivityList items={log.data.items} />}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-ink-2">
          <Button kind="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="num">
            Page {page} of {pages}
          </span>
          <Button kind="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

