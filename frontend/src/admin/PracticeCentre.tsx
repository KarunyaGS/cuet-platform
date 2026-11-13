/** Admin console: links to official documents, and our own mock papers (blueprint, build, approval, publishing). */
import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, inputClass, Loading, PageHeader, SectionTitle, Segmented, useLoad } from '../ui';
import { consoleApi, when, type AdminMockPaper, type AdminOfficialLink, type StaffMe } from './api';
import { useOutletContext } from 'react-router';

const STATUS: Record<string, { label: string; tone: 'green' | 'zinc' | 'red' | 'accent' }> = { PUBLISHED: { label: 'Published', tone: 'green' }, APPROVED: { label: 'Approved by reviewer', tone: 'accent' }, DRAFT: { label: 'Draft', tone: 'zinc' }, ARCHIVED: { label: 'Archived', tone: 'red' } };
const select = 'h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none';

export function AdminPracticeCentre() {
  const [tab, setTab] = useState<'mock' | 'links'>('mock');
  return (
    <div>
      <PageHeader title="Practice Centre" subtitle="Our own mock papers and the links to official documents. Neither reaches students without the checks shown here." />
      <div className="mb-5">
        <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: 'mock', label: 'Mock papers' }, { value: 'links', label: 'Official links' }]} />
      </div>
      {tab === 'mock' ? <MockPapers /> : <OfficialLinks />}
    </div>
  );
}

function MockPapers() {
  const me = useOutletContext<StaffMe>();
  const subjects = useLoad(consoleApi.papers, []);
  const [paperId, setPaperId] = useState('');
  const current = paperId || subjects.data?.[0]?.id || '';
  const ready = useLoad(() => (current ? consoleApi.mockReadiness(current) : Promise.resolve(null)), [current]);
  const list = useLoad(() => (current ? consoleApi.mockPapers(current) : Promise.resolve([])), [current]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [open, setOpen] = useState('');
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      list.reload();
      ready.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const approve = (p: AdminMockPaper) => {
    const note = window.prompt('What did you check? (coverage of every unit, balance of difficulty, every answer key). The note is kept with the paper.');
    if (note && note.trim().length >= 10) void act(() => consoleApi.mockStatus(p.id, 'APPROVE', note.trim()));
  };
  if (subjects.loading && !subjects.data) return <Loading />;
  if (subjects.error) return <ErrorBox error={subjects.error} onRetry={subjects.reload} />;
  if (!subjects.data!.length) return <Empty>No subject has questions yet.</Empty>;
  const r = ready.data;
  return (
    <div>
      <label className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        Subject
        <select className={select} value={current} onChange={(e) => setPaperId(e.target.value)}>
          {subjects.data!.map((s) => (
            <option key={s.id} value={s.id}>
              {s.exam === 'CUET_PG' ? 'PG' : 'UG'} {s.code} {s.name}
            </option>
          ))}
        </select>
      </label>
      {err && <ErrorBox error={err} />}
      {ready.error && <ErrorBox error={ready.error} onRetry={ready.reload} />}
      {r && (
        <section aria-labelledby="mk-blueprint" className="rounded-xl border border-rule bg-surface p-5 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h3 id="mk-blueprint" className="text-base font-semibold text-ink">
              Blueprint for a {r.subject.name} paper
            </h3>
            <Badge tone={r.ready ? 'green' : 'amber'}>{r.ready ? 'A paper can be built' : 'Not enough approved questions'}</Badge>
          </div>
          <p className="mt-2 text-ink-2">
            {r.pattern.questions} questions, {r.pattern.durationMinutes} minutes, +{r.pattern.marksCorrect} / {r.pattern.marksIncorrect}, {r.pattern.optionsPerQuestion} options per question. {r.basis}
          </p>
          <p className="num mt-2 text-ink">
            Question bank: {r.bank.questions} questions, <span className="font-medium">{r.bank.approvedByReviewer} approved by a reviewer</span>, {r.bank.eligibleUnused} approved and not yet used in a paper
            {r.bank.notMatchingOptionCount ? `, ${r.bank.notMatchingOptionCount} with a different number of options` : ''}.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-ink-2">
                  <th scope="col" className="py-2 pr-4 font-medium">Syllabus unit</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Syllabus rows</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Questions needed</th>
                  <th scope="col" className="py-2 text-right font-medium">Approved and unused</th>
                </tr>
              </thead>
              <tbody>
                {r.perUnit.map((u) => (
                  <tr key={u.id} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
                      {u.label ? `${u.label}. ` : ''}
                      {u.title}
                    </th>
                    <td className="num py-2 pr-4 text-right text-ink-2">{u.syllabusRows}</td>
                    <td className="num py-2 pr-4 text-right text-ink">{u.needed}</td>
                    <td className={`num py-2 text-right font-medium ${u.available < u.needed ? 'text-wrong' : 'text-correct'}`}>{u.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="num mt-3 text-ink-2">
            Difficulty mix: {r.perDifficulty.map((d) => `${d.needed} ${d.difficulty.toLowerCase()} (${d.available} available)`).join(', ')}. This mix is our own choice, not a measured exam trend.
          </p>
          <div className="mt-4">
            <Button disabled={busy || !r.ready} onClick={() => void act(() => consoleApi.buildMock(current))}>
              Build the next mock paper
            </Button>
          </div>
        </section>
      )}
      <section aria-labelledby="mk-list" className="mt-8">
        <SectionTitle id="mk-list">Mock papers for this subject</SectionTitle>
        {list.loading && !list.data && <Loading />}
        {list.data &&
          (list.data.length === 0 ? (
            <Empty>No mock paper has been built for this subject.</Empty>
          ) : (
            <ul className="space-y-3">
              {list.data.map((p) => (
                <li key={p.id} className="rounded-xl border border-rule bg-surface p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">{p.title}</span>
                      <span className="num block text-ink-2">
                        {p.questions} questions · {p.blueprint.result.difficulty['EASY'] ?? 0} easy, {p.blueprint.result.difficulty['MEDIUM'] ?? 0} medium, {p.blueprint.result.difficulty['HARD'] ?? 0} hard · {p.blueprint.result.topicsCovered} topics
                      </span>
                      {p.approvedAt && <span className="block text-ink-3">Approved {when(p.approvedAt)}: {p.approvalNote}</span>}
                      {!p.allQuestionsApproved && <span className="block text-wrong">A question in this paper is no longer approved. Students cannot see the paper.</span>}
                    </span>
                    <Badge tone={STATUS[p.status]?.tone ?? 'zinc'}>{STATUS[p.status]?.label ?? p.status}</Badge>
                    <Button kind="secondary" size="sm" onClick={() => setOpen(open === p.id ? '' : p.id)}>
                      {open === p.id ? 'Hide questions' : 'Questions'}
                    </Button>
                    {p.status === 'DRAFT' && me.permissions.includes('content:review') && (
                      <Button size="sm" disabled={busy || !p.allQuestionsApproved} onClick={() => approve(p)}>
                        Approve as reviewer
                      </Button>
                    )}
                    {p.status === 'APPROVED' && (
                      <Button size="sm" disabled={busy || !p.allQuestionsApproved} onClick={() => void act(() => consoleApi.mockStatus(p.id, 'PUBLISH'))}>
                        Publish
                      </Button>
                    )}
                    {p.status === 'PUBLISHED' && (
                      <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(() => consoleApi.mockStatus(p.id, 'UNPUBLISH'))}>
                        Unpublish
                      </Button>
                    )}
                    {p.status === 'DRAFT' && (
                      <Button kind="secondary" size="sm" disabled={busy} onClick={() => window.confirm('Archive this draft? Its questions become free for another paper.') && void act(() => consoleApi.mockStatus(p.id, 'ARCHIVE'))}>
                        Archive
                      </Button>
                    )}
                  </div>
                  {p.status === 'DRAFT' && <p className="mt-2 text-ink-2">Next: a reviewer reads the whole paper and approves it. Then it can be published.</p>}
                  {open === p.id && <MockQuestions id={p.id} />}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

function MockQuestions({ id }: { id: string }) {
  const d = useLoad(() => consoleApi.mockPaper(id), [id]);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox error={d.error} />;
  return (
    <ol className="mt-3 space-y-1.5 rounded-lg bg-paper p-3 text-sm">
      {d.data!.items.map((q) => (
        <li key={q.position} className="flex flex-wrap items-baseline gap-x-2">
          <span className="num font-medium text-ink">Q{q.position}</span>
          <span className="min-w-0 flex-1 text-ink">{q.stem}</span>
          <span className="text-xs text-ink-3">
            Unit {q.unit_label ?? ''} · {q.difficulty.toLowerCase()} · {q.verification === 'VERIFIED' ? 'approved' : 'NOT approved'}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OfficialLinks() {
  const list = useLoad(consoleApi.officialLinks, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [basis, setBasis] = useState<{ id: string; text: string; checked: boolean } | null>(null);
  const [embed, setEmbed] = useState<{ id: string; text: string; checked: boolean } | null>(null);
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      setBasis(null);
      setEmbed(null);
      list.reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const publish = (l: AdminOfficialLink) => (l.available ? setBasis({ id: l.id, text: '', checked: false }) : void act(() => consoleApi.officialLinkStatus(l.id, { action: 'PUBLISH' })));
  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ink-2">
        Only an address is stored; no document is copied or hosted. NTA's site says prior permission is required before another site links to it, so a link is shown to students only after you record that linking permission is confirmed. Documents open on NTA's own website: showing them inside CUET Prep is switched off until NTA grants permission to display them. A "not available" notice has no link and can be published as it is.
      </p>
      {err && <ErrorBox error={err} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data &&
        (list.data.length === 0 ? (
          <Empty>No official link has been added. Links are added with the import tool from content/official-papers/links.json.</Empty>
        ) : (
          <ul className="space-y-3">
            {list.data.map((l) => (
              <li key={l.id} className="rounded-xl border border-rule bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{l.title}</span>
                    <span className="block text-ink-2">
                      {l.exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG'} {l.year} · {l.kind === 'ANSWER_KEY' ? 'Answer key' : 'Question papers'} · {l.subjectName ?? 'All subjects'} · {l.available ? 'link' : 'not available'}
                    </span>
                    {l.url && <span className="block break-all text-ink-3">{l.url}</span>}
                    {l.note && <span className="block text-ink-2">{l.note}</span>}
                    {l.linkingBasis && <span className="block text-ink-3">Linking basis: {l.linkingBasis}</span>}
                    {l.status === 'PUBLISHED' && l.viewerMode && (
                      <span className="block text-ink-3">
                        {!l.inAppViewing ? "Opens on NTA's website only. Viewing inside CUET Prep is switched off until NTA grants permission." : l.viewerMode === 'DIRECT' ? "Shown inside CUET Prep: NTA's server allows other sites to read this file." : l.viewerMode === 'PROXY' ? `Shown inside CUET Prep. Permission on record: ${l.embedBasis}` : "Opens on NTA's site only: NTA's server does not allow this file to be shown on other sites."}
                      </span>
                    )}
                  </span>
                  <Badge tone={STATUS[l.status]?.tone ?? 'zinc'}>{STATUS[l.status]?.label ?? l.status}</Badge>
                  {l.status === 'DRAFT' && (
                    <Button size="sm" disabled={busy} onClick={() => publish(l)}>
                      Publish
                    </Button>
                  )}
                  {l.status === 'PUBLISHED' && l.inAppViewing && l.viewerMode === 'NEW_TAB' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => setEmbed({ id: l.id, text: '', checked: false })}>
                      Allow viewing inside CUET Prep
                    </Button>
                  )}
                  {l.status === 'PUBLISHED' && l.viewerMode === 'PROXY' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(() => consoleApi.officialLinkStatus(l.id, { action: 'DISALLOW_IN_APP' }))}>
                      Stop in-app viewing
                    </Button>
                  )}
                  {l.status === 'PUBLISHED' && (
                    <Button kind="secondary" size="sm" disabled={busy} onClick={() => void act(() => consoleApi.officialLinkStatus(l.id, { action: 'UNPUBLISH' }))}>
                      Unpublish
                    </Button>
                  )}
                </div>
                {embed?.id === l.id && (
                  <form
                    className="mt-3 space-y-3 rounded-lg bg-paper p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(() => consoleApi.officialLinkStatus(l.id, { action: 'ALLOW_IN_APP', embedBasis: embed.text.trim(), conditionsChecked: embed.checked }));
                    }}
                  >
                    <p className="text-ink-2">
                      NTA's server does not allow this file to be shown on other sites. To show it inside CUET Prep the file has to pass through our server, which NTA's copyright policy allows only with NTA's permission.
                    </p>
                    <label className="block">
                      <span className="mb-1 block font-medium text-ink">NTA's permission (reference and date)</span>
                      <input className={`${inputClass} h-9 text-sm`} required minLength={10} maxLength={500} value={embed.text} onChange={(e) => setEmbed({ ...embed, text: e.target.value })} />
                    </label>
                    <label className="flex items-start gap-2 text-ink">
                      <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={embed.checked} onChange={(e) => setEmbed({ ...embed, checked: e.target.checked })} />
                      We hold NTA's permission to show this document inside CUET Prep.
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={busy || !embed.checked || embed.text.trim().length < 10}>
                        Allow in-app viewing
                      </Button>
                      <Button kind="secondary" size="sm" onClick={() => setEmbed(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
                {basis?.id === l.id && (
                  <form
                    className="mt-3 space-y-3 rounded-lg bg-paper p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(() => consoleApi.officialLinkStatus(l.id, { action: 'PUBLISH', linkingBasis: basis.text.trim(), conditionsChecked: basis.checked }));
                    }}
                  >
                    <label className="block">
                      <span className="mb-1 block font-medium text-ink">Why is linking allowed?</span>
                      <input className={`${inputClass} h-9 text-sm`} required minLength={10} maxLength={500} placeholder="For example: NTA reply, reference and date" value={basis.text} onChange={(e) => setBasis({ ...basis, text: e.target.value })} />
                    </label>
                    <label className="flex items-start gap-2 text-ink">
                      <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={basis.checked} onChange={(e) => setBasis({ ...basis, checked: e.target.checked })} />I have read the site's linking conditions.
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={busy || !basis.checked || basis.text.trim().length < 10}>
                        Publish the link
                      </Button>
                      <Button kind="secondary" size="sm" onClick={() => setBasis(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
