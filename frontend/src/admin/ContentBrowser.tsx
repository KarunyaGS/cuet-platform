/**
 * Lessons and questions: one browser used by the admin content manager (edit, publish, delete) and by
 * reviewers (approve, request changes, reject). The list is on the left, the selected item on the right.
 */
import { ArrowDown, ArrowUp, CircleCheck, FileQuestion, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BlockView } from '../pages/Learn';
import { QuestionStem } from '../question';
import { Rich } from '../rich';
import { Badge, Button, Empty, ErrorBox, inputClass, Loading, SearchInput, Segmented, useLoad } from '../ui';
import { consoleApi, reviewContentApi, STATUS, VERIFICATION, when, type ContentFilter, type ContentItem, type ContentType, type HistoryRow, type LessonFull, type QuestionFull } from './api';

type Mode = 'admin' | 'review';
const select = 'h-9 rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none';
const BLOCK_TYPES = ['HEADING', 'TEXT', 'DEFINITION', 'CONCEPT', 'KEY_POINT', 'IMPORTANT_FACT', 'EXAMPLE', 'FORMULA', 'SOLVED_PROBLEM', 'TABLE', 'CALLOUT', 'OFFICIAL_TEXT', 'DIAGRAM', 'IMAGE', 'VIDEO'];

export function VerificationBadge({ v }: { v: string }) {
  const x = VERIFICATION[v] ?? { label: v, tone: 'zinc' as const };
  return <Badge tone={x.tone}>{x.label}</Badge>;
}

export function ContentBrowser({ mode, canWrite = false, canPublish = false }: { mode: Mode; canWrite?: boolean; canPublish?: boolean }) {
  const source = mode === 'admin' ? consoleApi : reviewContentApi;
  const [f, setF] = useState<ContentFilter>({ type: 'QUESTION', verification: mode === 'review' ? 'UNVERIFIED' : undefined, page: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const papers = useLoad(source.papers, []);
  const list = useLoad(() => source.content(f), [JSON.stringify(f)]);
  const set = (patch: Partial<ContentFilter>) => {
    setF((x) => ({ ...x, page: 1, ...patch }));
    setSelected(null);
  };
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25));
  const count = (v: string) => list.data?.byVerification.find((b) => b.verification === v)?.n ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Lessons or questions"
          value={f.type}
          onChange={(type: ContentType) => set({ type })}
          options={[
            { value: 'QUESTION', label: 'Questions' },
            { value: 'LEARNING_RESOURCE', label: 'Lessons' },
          ]}
        />
        <select aria-label="Subject" className={select} value={f.paperId ?? ''} onChange={(e) => set({ paperId: e.target.value || undefined })}>
          <option value="">All subjects</option>
          {papers.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.exam === 'CUET_UG' ? 'UG' : 'PG'} {p.code} {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Review status" className={select} value={f.verification ?? ''} onChange={(e) => set({ verification: e.target.value || undefined })}>
          <option value="">Any review status</option>
          {Object.entries(VERIFICATION).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label} ({count(k)})
            </option>
          ))}
        </select>
        {mode === 'admin' && (
          <select aria-label="Publishing status" className={select} value={f.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
            <option value="">Any publishing status</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <SearchInput value={f.q ?? ''} onChange={(q) => set({ q: q || undefined })} placeholder={f.type === 'QUESTION' ? 'Search question text' : 'Search lesson titles'} label="Search" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div>
          {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
          {list.loading && !list.data && <Loading />}
          {list.data && (
            <>
              <p className="mb-2 text-sm text-ink-2">
                {list.data.total} {f.type === 'QUESTION' ? 'questions' : 'lessons'}
              </p>
              {list.data.items.length === 0 ? (
                <Empty icon={<FileQuestion />}>{mode === 'review' ? 'Nothing waiting with these filters.' : 'Nothing matches these filters.'}</Empty>
              ) : (
                <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                  {list.data.items.map((it) => (
                    <Row key={it.id} it={it} on={selected === it.id} onClick={() => setSelected(it.id)} showStatus={mode === 'admin'} />
                  ))}
                </ul>
              )}
              {pages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm text-ink-2">
                  <Button kind="secondary" size="sm" disabled={(f.page ?? 1) <= 1} onClick={() => setF({ ...f, page: (f.page ?? 1) - 1 })}>
                    Previous
                  </Button>
                  <span className="num">
                    Page {f.page ?? 1} of {pages}
                  </span>
                  <Button kind="secondary" size="sm" disabled={(f.page ?? 1) >= pages} onClick={() => setF({ ...f, page: (f.page ?? 1) + 1 })}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="min-w-0">
          {selected ? (
            <Detail key={selected} mode={mode} type={f.type} id={selected} canWrite={canWrite} canPublish={canPublish} onChanged={list.reload} onGone={() => (setSelected(null), list.reload())} />
          ) : (
            <Empty>Choose {f.type === 'QUESTION' ? 'a question' : 'a lesson'} from the list to {mode === 'review' ? 'review it' : 'see it'}.</Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ it, on, onClick, showStatus }: { it: ContentItem; on: boolean; onClick: () => void; showStatus: boolean }) {
  return (
    <li>
      <button onClick={onClick} aria-current={on ? 'true' : undefined} className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-paper'}`}>
        <span className="line-clamp-2 text-sm text-ink">
          <Rich text={it.title} inline />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          <VerificationBadge v={it.verification} />
          {showStatus && <Badge>{STATUS[it.status] ?? it.status}</Badge>}
          <span>
            {it.paper ?? 'No subject'}
            {it.difficulty ? `, ${it.difficulty.toLowerCase()}` : ''}
          </span>
        </span>
      </button>
    </li>
  );
}

function Detail({ mode, type, id, canWrite, canPublish, onChanged, onGone }: { mode: Mode; type: ContentType; id: string; canWrite: boolean; canPublish: boolean; onChanged: () => void; onGone: () => void }) {
  const src = mode === 'admin' ? consoleApi : reviewContentApi;
  const isQ = type === 'QUESTION';
  const item = useLoad<QuestionFull | LessonFull>(() => (isQ ? src.question(id) : src.lesson(id)), [id, type]);
  const hist = useLoad(() => src.history(type, id), [id, type]);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    item.reload();
    hist.reload();
    onChanged();
  };
  const run = async (f: () => Promise<unknown>, gone = false) => {
    setErr(null);
    setBusy(true);
    try {
      await f();
      if (gone) onGone();
      else refresh();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  if (item.loading && !item.data) return <Loading />;
  if (item.error) return <ErrorBox error={item.error} onRetry={item.reload} />;
  const d = item.data!;
  const steps: { action: string; label: string; show: boolean; kind?: 'primary' | 'secondary' | 'danger' }[] = [
    { action: 'SUBMITTED', label: 'Send for review', show: canWrite && d.status === 'DRAFT' },
    { action: 'APPROVED', label: 'Approve for publishing', show: canPublish && d.status === 'IN_REVIEW' },
    { action: 'PUBLISHED', label: 'Publish', show: canPublish && d.status === 'APPROVED', kind: 'primary' },
    { action: 'UNPUBLISHED', label: 'Unpublish', show: canPublish && d.status === 'PUBLISHED' },
    { action: 'ARCHIVED', label: 'Archive', show: canPublish && d.status !== 'ARCHIVED' && d.status !== 'PUBLISHED', kind: 'danger' },
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-rule bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-rule px-5 py-3">
        <VerificationBadge v={d.verification} />
        <Badge>{STATUS[d.status] ?? d.status}</Badge>
        <span className="text-xs text-ink-3">{d.origin === 'AI_ASSISTED' ? 'AI-assisted draft' : d.origin.charAt(0) + d.origin.slice(1).toLowerCase().replace(/_/g, ' ')}</span>
        {mode === 'admin' && canWrite && !editing && (
          <span className="ml-auto flex gap-2">
            <Button kind="secondary" size="sm" icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            {d.status !== 'PUBLISHED' && (
              <Button
                kind="danger"
                size="sm"
                icon={<Trash2 aria-hidden />}
                disabled={busy}
                onClick={() => window.confirm(`Delete this ${isQ ? 'question' : 'lesson'}? This cannot be undone.`) && void run(() => (isQ ? consoleApi.deleteQuestion(id) : consoleApi.deleteLesson(id)), true)}
              >
                Delete
              </Button>
            )}
          </span>
        )}
      </header>
      <div className="px-5 py-5">
        {editing ? (
          isQ ? (
            <QuestionForm q={d as QuestionFull} onCancel={() => setEditing(false)} onSaved={() => (setEditing(false), refresh())} />
          ) : (
            <LessonForm l={d as LessonFull} onCancel={() => setEditing(false)} onSaved={() => (setEditing(false), refresh())} />
          )
        ) : isQ ? (
          <QuestionView q={d as QuestionFull} />
        ) : (
          <LessonView l={d as LessonFull} />
        )}
        {err && <ErrorBox error={err} />}
      </div>

      {!editing && mode === 'admin' && steps.some((s) => s.show) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-5 py-3">
          <span className="mr-1 text-sm text-ink-2">Publishing</span>
          {steps
            .filter((s) => s.show)
            .map((s) => (
              <Button key={s.action} kind={s.kind ?? 'secondary'} size="sm" disabled={busy} onClick={() => void run(() => consoleApi.workflow(type, id, s.action))}>
                {s.label}
              </Button>
            ))}
          {d.status === 'IN_REVIEW' && d.verification !== 'VERIFIED' && <span className="text-xs text-ink-3">A reviewer must approve the content before it can be approved for publishing.</span>}
        </div>
      )}
      {!editing && mode === 'review' && <Decision type={type} id={id} current={d.verification} onDone={refresh} />}

      <History rows={hist.data ?? []} />
    </article>
  );
}

function QuestionView({ q }: { q: QuestionFull }) {
  const key: number[] = q.answerKey?.correctOptionPositions ? JSON.parse(q.answerKey.correctOptionPositions) : [];
  const rationale: Record<string, string> = q.explanations[0]?.optionRationaleJson ? JSON.parse(q.explanations[0].optionRationaleJson) : {};
  let structure: unknown = null;
  try {
    structure = q.structureJson ? JSON.parse(q.structureJson) : null;
  } catch {
    structure = null;
  }
  return (
    <div>
      <div className="mb-3 text-sm text-ink-3">
        {q.testPaper ? `${q.testPaper.name} (${q.testPaper.code})` : 'No subject'}, {q.difficulty.toLowerCase()}, {q.type.replace(/_/g, ' ').toLowerCase()}
      </div>
      {q.passage && <div className="mb-3 max-h-56 overflow-y-auto rounded-lg border border-rule bg-paper p-3 font-serif text-[15px]">{q.passage.body}</div>}
      <QuestionStem stem={q.stem} structure={structure} />
      <ul className="mt-4 space-y-2">
        {q.options.map((o) => {
          const right = key.includes(o.position);
          return (
            <li key={o.position} className={`rounded-lg border px-3 py-2 text-[15px] ${right ? 'border-correct/40 bg-correct-soft' : 'border-rule'}`}>
              <div className="flex items-start gap-2">
                <span className="font-semibold">{o.label}.</span>
                <span className="min-w-0 flex-1">
                  <Rich text={o.text} inline />
                </span>
                {right && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-correct">
                    <CircleCheck aria-hidden className="size-3.5" />
                    Answer key
                  </span>
                )}
              </div>
              {rationale[String(o.position)] && <p className="mt-1 pl-6 text-sm text-ink-2">{rationale[String(o.position)]}</p>}
            </li>
          );
        })}
      </ul>
      {q.answerKey?.numericAnswer !== null && q.answerKey?.numericAnswer !== undefined && (
        <p className="num mt-3 text-sm text-ink">
          Numeric answer: <span className="font-semibold">{q.answerKey.numericAnswer}</span>
          {q.answerKey.numericTolerance ? ` (± ${q.answerKey.numericTolerance})` : ''}
        </p>
      )}
      {q.explanations[0] && (
        <div className="mt-4 border-l-2 border-accent pl-3">
          <div className="text-[13px] font-semibold text-ink-2">Explanation</div>
          <Rich text={q.explanations[0].body} className="mt-0.5 text-[15px] leading-relaxed text-ink" />
        </div>
      )}
      <div className="mt-4 text-sm text-ink-2">
        <span className="font-medium text-ink">Syllabus topic: </span>
        {q.topics.length ? q.topics.map((t) => t.curriculumNode.title).join('; ') : 'Not linked to a topic'}
      </div>
    </div>
  );
}

function LessonView({ l }: { l: LessonFull }) {
  let solved = 0;
  return (
    <div>
      <h2 className="text-xl font-semibold text-ink">{l.title}</h2>
      <div className="mt-1 mb-5 text-sm text-ink-2">
        <span className="font-medium text-ink">Syllabus topic: </span>
        {l.curriculumNode?.title ?? 'Not linked to a topic'}
      </div>
      <div className="max-w-[44rem] space-y-5">
        {l.blocks.map((b) => {
          if (b.type === 'SOLVED_PROBLEM') solved++;
          return <BlockView key={b.position} b={{ position: b.position, type: b.type, body: b.body, media_asset_id: b.mediaAssetId, alt_text: b.mediaAsset?.altText ?? null, caption: b.mediaAsset?.caption ?? null, media_kind: null }} solvedNo={solved} />;
        })}
      </div>
    </div>
  );
}

const CHECKS: Record<ContentType, [string, string][]> = {
  QUESTION: [
    ['answerCorrect', 'The answer key is correct'],
    ['explanationAccurate', 'The explanation is accurate and clear'],
    ['matchesTopic', 'It belongs to the linked syllabus topic'],
  ],
  LEARNING_RESOURCE: [
    ['contentAccurate', 'The content is accurate'],
    ['matchesTopic', 'It covers the linked syllabus topic'],
    ['clearForStudents', 'It is clear for students at this level'],
  ],
};

function Decision({ type, id, current, onDone }: { type: ContentType; id: string; current: string; onDone: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const all = CHECKS[type].every(([k]) => checks[k]);
  const go = async (action: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED') => {
    setErr(null);
    setBusy(true);
    try {
      await reviewContentApi.decide(type, id, action, comment.trim(), action === 'VERIFIED' ? checks : undefined);
      setComment('');
      setChecks({});
      onDone();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-t border-rule px-5 py-4">
      <h3 className="text-sm font-semibold text-ink">Your decision</h3>
      <fieldset className="mt-2 space-y-1.5">
        <legend className="sr-only">What you checked</legend>
        {CHECKS[type].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-accent" checked={Boolean(checks[k])} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm text-ink-2">Comment (needed when you request changes or reject)</span>
        <textarea className={`${inputClass} min-h-20 text-sm`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={4000} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy || !all || current === 'VERIFIED'} onClick={() => void go('VERIFIED')} icon={<CircleCheck aria-hidden />} title={all ? undefined : 'Tick every check first'}>
          Approve
        </Button>
        <Button kind="secondary" disabled={busy || comment.trim().length < 3} onClick={() => void go('CHANGES_REQUESTED')}>
          Request changes
        </Button>
        <Button kind="danger" disabled={busy || comment.trim().length < 3} onClick={() => void go('REJECTED')}>
          Reject
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-3">Requesting changes or rejecting hides this from students at once.</p>
      {err && <ErrorBox error={err} />}
    </div>
  );
}

function History({ rows }: { rows: HistoryRow[] }) {
  if (!rows.length) return <p className="border-t border-rule px-5 py-3 text-xs text-ink-3">No review history yet.</p>;
  return (
    <details className="border-t border-rule">
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink-2 hover:text-ink">Review history ({rows.length})</summary>
      <ul className="divide-y divide-rule border-t border-rule">
        {rows.map((r) => (
          <li key={r.id} className="px-5 py-2.5 text-sm">
            <span className="font-medium text-ink">{r.actorName ?? r.actor}</span>{' '}
            <span className="text-ink-2">
              {r.action.toLowerCase().replace(/_/g, ' ')}
              {r.to_status ? ` → ${r.to_status.toLowerCase().replace(/_/g, ' ')}` : ''}
            </span>
            <span className="num ml-2 text-xs text-ink-3">{when(r.created_at)}</span>
            {r.comment && <p className="mt-0.5 text-ink-2">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------- edit forms (admin)

const label = 'mb-1.5 block text-sm font-medium text-ink';

function QuestionForm({ q, onCancel, onSaved }: { q: QuestionFull; onCancel: () => void; onSaved: () => void }) {
  const [stem, setStem] = useState(q.stem);
  const [difficulty, setDifficulty] = useState(q.difficulty);
  const [options, setOptions] = useState(q.options.map((o) => ({ label: o.label, text: o.text, mediaAssetId: o.mediaAssetId })));
  const [key, setKey] = useState<number[]>(q.answerKey?.correctOptionPositions ? JSON.parse(q.answerKey.correctOptionPositions) : []);
  const [explanation, setExplanation] = useState(q.explanations[0]?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const multi = q.type === 'MCQ_MULTI';
  const save = async () => {
    setErr(null);
    setBusy(true);
    try {
      await consoleApi.saveQuestion(q.id, {
        testPaperId: q.testPaperId, type: q.type, stem, language: q.language, difficulty, learningObjective: q.learningObjective, passageId: q.passageId, structureJson: q.structureJson,
        origin: q.origin, usagePermissionId: q.usagePermissionId, sourceDocumentId: q.sourceDocumentId, sourceLocator: q.sourceLocator, isDemonstration: q.isDemonstration,
        options,
        answer: { correctOptionPositions: q.type === 'NUMERICAL' ? null : key, numericAnswer: q.answerKey?.numericAnswer ?? null, numericTolerance: q.answerKey?.numericTolerance ?? null },
        explanation: { body: explanation, ...(q.explanations[0]?.optionRationaleJson ? { optionRationale: JSON.parse(q.explanations[0].optionRationaleJson) } : {}) },
        topicNodeIds: q.topics.map((t) => t.curriculumNode.id),
      });
      onSaved();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={label}>Question</span>
        <textarea className={`${inputClass} min-h-28`} value={stem} onChange={(e) => setStem(e.target.value)} />
        <span className="mt-1 block text-xs text-ink-3">Maths goes between $ signs, for example $F = ma$.</span>
      </label>
      <label className="block max-w-xs">
        <span className={label}>Difficulty</span>
        <select className={`${select} w-full`} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </label>
      {q.type !== 'NUMERICAL' && (
        <fieldset>
          <legend className={label}>Options (select the correct {multi ? 'answers' : 'answer'})</legend>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name="key"
                  aria-label={`Option ${o.label} is correct`}
                  className="size-4 accent-accent"
                  checked={key.includes(i + 1)}
                  onChange={() => setKey(multi ? (key.includes(i + 1) ? key.filter((k) => k !== i + 1) : [...key, i + 1].sort()) : [i + 1])}
                />
                <span className="w-5 text-sm font-semibold">{o.label}</span>
                <input className={inputClass} value={o.text} onChange={(e) => setOptions(options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} aria-label={`Option ${o.label}`} />
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <label className="block">
        <span className={label}>Explanation</span>
        <textarea className={`${inputClass} min-h-28`} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </label>
      {err && <ErrorBox error={err} />}
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save question'}
        </Button>
        <Button kind="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LessonForm({ l, onCancel, onSaved }: { l: LessonFull; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(l.title);
  const [blocks, setBlocks] = useState(l.blocks.map((b) => ({ type: b.type, body: b.body, mediaAssetId: b.mediaAssetId })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => setErr(null), [blocks, title]);
  const move = (i: number, d: number) => {
    const next = [...blocks];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    setBlocks(next);
  };
  const save = async () => {
    setBusy(true);
    try {
      await consoleApi.saveLesson(l.id, { curriculumNodeId: l.curriculumNodeId, testPaperId: l.testPaperId, type: l.type, title, language: l.language, origin: l.origin, usagePermissionId: l.usagePermissionId, isDemonstration: l.isDemonstration, blocks });
      onSaved();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={label}>Lesson title</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div>
        <div className={label}>Blocks, in reading order</div>
        <ol className="space-y-3">
          {blocks.map((b, i) => (
            <li key={i} className="rounded-lg border border-rule p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="num w-6 text-xs text-ink-3">{i + 1}</span>
                <select aria-label={`Block ${i + 1} type`} className={select} value={b.type} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, type: e.target.value } : x)))}>
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <span className="ml-auto flex gap-1">
                  <Button kind="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp aria-hidden />} title="Move up">
                    <span className="sr-only">Move up</span>
                  </Button>
                  <Button kind="ghost" size="sm" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} icon={<ArrowDown aria-hidden />} title="Move down">
                    <span className="sr-only">Move down</span>
                  </Button>
                  <Button kind="ghost" size="sm" disabled={blocks.length === 1} onClick={() => setBlocks(blocks.filter((_, k) => k !== i))} icon={<Trash2 aria-hidden />} title="Remove block">
                    <span className="sr-only">Remove block</span>
                  </Button>
                </span>
              </div>
              <textarea aria-label={`Block ${i + 1} content`} className={`${inputClass} min-h-24 font-mono text-[13px]`} value={b.body} onChange={(e) => setBlocks(blocks.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} />
            </li>
          ))}
        </ol>
        <div className="mt-3">
          <Button kind="secondary" size="sm" icon={<Plus aria-hidden />} onClick={() => setBlocks([...blocks, { type: 'TEXT', body: '', mediaAssetId: null }])}>
            Add a block
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-3">Definition, formula, table and solved-problem blocks store structured text; keep their format when editing.</p>
      </div>
      {err && <ErrorBox error={err} />}
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save lesson'}
        </Button>
        <Button kind="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
