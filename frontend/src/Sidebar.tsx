import { CalendarRange, ChartPie, ChevronRight, FlaskConical, House } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { bareChapter, useAuth } from './ui';
import { subjectTone } from './subjectColors';
import { api, type ExamCode, type Outline, type OutlineNode, type PyqTree, type Subject } from './api';
import { PreporaSpark } from './brand';

/**
 * The global, three-level, inline-expanding sidebar.
 *   Level 1: the CUET UG papers.
 *   Level 2: what we have for a paper: the Chapter-wise Question Bank, Previous Year Question Paper, Mock Tests (topic-wise practice) and Study Material (Lessons).
 *   Level 3: the chapters (with their real question counts), the years of papers, or the lessons.
 * Everything comes from the existing APIs; nothing is invented. Expansion happens in place, under the parent.
 */

const EXAM: ExamCode = 'CUET_UG';
const YEAR = 2026;
const STORE = 'cuet.sidebar.open';

// The sidebar is forest green: inside it the shared tokens are remapped (see the aside), so inactive labels are muted light green.
const rowBase = 'relative flex w-full items-center gap-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08]';
/** A row that contains the page the student is on (its subject, category or heading): pale lime text, no block. */
const parentRow = 'font-medium text-lime';
const selectedRow = 'bg-lime font-medium !text-forest hover:bg-lime [&_svg]:!text-forest [&_.num]:!text-forest/70';

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`} />;
}

function Count({ n }: { n: number }) {
  return <span className="num ml-auto shrink-0 rounded-full bg-ink/[0.06] px-1.5 py-px text-[11px] leading-4 text-ink-3">{n}</span>;
}

export interface SideItem { id: string; kind: 'group' | 'topic'; title: string; label: string | null; questions: number; resources: number; ids: Set<string> }

/**
 * What the sidebar lists for a paper, in syllabus order: the topics that have questions or a lesson, each group headed by the section or
 * unit it sits under (the heading opens that section's own page). A paper with no questions or lessons yet lists its top-level units instead.
 */
export function chaptersOf(nodes: OutlineNode[]): SideItem[] {
  const kids = new Map<string | null, OutlineNode[]>();
  for (const n of nodes) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n]);
  const sort = (l: OutlineNode[]) => [...l].sort((a, b) => a.position - b.position);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const subtree = (id: string): OutlineNode[] => sort(kids.get(id) ?? []).flatMap((c) => [c, ...subtree(c.id)]);
  const ids = (n: OutlineNode) => new Set([n.id, ...subtree(n.id).map((x) => x.id)]);
  const ordered = sort(kids.get(null) ?? []).flatMap((r) => [r, ...subtree(r.id)]);
  const topics = ordered.filter((n) => n.kind !== 'NOTE' && (n.questions > 0 || n.resources > 0));
  if (topics.length === 0) {
    const roots = sort(kids.get(null) ?? []).filter((r) => r.kind !== 'NOTE');
    const picked = roots.flatMap((r) => (r.kind === 'SECTION' && (kids.get(r.id) ?? []).length > 0 ? sort(kids.get(r.id)!) : [r]));
    return picked.map((n) => ({ id: n.id, kind: 'topic' as const, title: n.title, label: n.label, questions: 0, resources: 0, ids: ids(n) }));
  }
  const items: SideItem[] = [];
  const seen = new Set<string>();
  for (const t of topics) {
    const parent = t.parent_id ? byId.get(t.parent_id) : undefined;
    if (parent && parent.kind !== 'NOTE' && !seen.has(parent.id)) {
      seen.add(parent.id);
      const inside = topics.filter((x) => x.parent_id === parent.id);
      items.push({ id: parent.id, kind: 'group', title: parent.title, label: parent.label, questions: inside.reduce((s, x) => s + x.questions, 0), resources: inside.reduce((s, x) => s + x.resources, 0), ids: ids(parent) });
    }
    items.push({ id: t.id, kind: 'topic', title: t.title, label: t.label, questions: t.questions, resources: t.resources, ids: ids(t) });
  }
  return items;
}

/** One request per kind of data for the whole session, shared by the desktop sidebar and the phone drawer. A failed request is not kept. */
const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}

export type LessonRow = { kind: 'group'; id: string; title: string; label: string | null } | { kind: 'lesson'; id: string; title: string; nodeId: string; groupId: string | null };

/** Study Material for a paper: its lessons in syllabus order, under the section or unit they belong to. Titles come from each topic's own lessons. */
export async function lessonsOf(list: SideItem[]): Promise<LessonRow[]> {
  const rows: LessonRow[] = [];
  let group: SideItem | null = null;
  const withLessons = list.filter((c) => c.kind === 'topic' && c.resources > 0);
  const found = await Promise.all(withLessons.map((c) => once(`topic:${c.id}`, () => api.topic(c.id)).then((t) => t.resources, () => [])));
  const byTopic = new Map(withLessons.map((c, i) => [c.id, found[i]!]));
  let pending: LessonRow | null = null;
  for (const c of list) {
    if (c.kind === 'group') {
      group = c;
      pending = { kind: 'group', id: c.id, title: c.title, label: c.label };
      continue;
    }
    for (const r of byTopic.get(c.id) ?? []) {
      if (pending) {
        rows.push(pending);
        pending = null;
      }
      rows.push({ kind: 'lesson', id: r.id, title: r.title, nodeId: c.id, groupId: group?.id ?? null });
    }
  }
  return rows;
}

const GROUPS = 'cuet.sidebar.chapter';
function loadGroups(): Record<string, string | null> {
  try {
    return JSON.parse(sessionStorage.getItem(GROUPS) ?? '{}') as Record<string, string | null>;
  } catch {
    return {};
  }
}

/** The Mock Tests list of a paper: the topics that have questions, under the headings that still have one. */
export function withQuestions(list: SideItem[]): SideItem[] {
  const out: SideItem[] = [];
  let heading: SideItem | null = null;
  for (const c of list) {
    if (c.kind === 'group') {
      heading = c;
      continue;
    }
    if (c.questions <= 0) continue;
    if (heading) {
      out.push(heading);
      heading = null;
    }
    out.push(c);
  }
  return out;
}

/** What is open after `keys` are opened: one subject at a time, and one category at a time inside a subject. */
function opened(o: Record<string, boolean>, keys: string[]): Record<string, boolean> {
  const next = { ...o };
  for (const k of keys) {
    const kind = k.slice(0, 2);
    const paper = k.slice(2);
    for (const other of Object.keys(next)) {
      if (other === k || !next[other]) continue;
      if (kind === 's:' && other.startsWith('s:')) next[other] = false;
      // the categories of any other subject close with it
      if (kind === 's:' && /^[fcpkm]:/.test(other) && other.slice(2) !== paper) next[other] = false;
      if (/^[fcpkm]:$/.test(kind) && /^[fcpkm]:/.test(other) && other.slice(2) === paper) next[other] = false;
    }
    next[k] = true;
  }
  return next;
}

function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useLocation();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [outlines, setOutlines] = useState<Record<string, Outline | 'loading' | 'error'>>({});
  const [pyq, setPyq] = useState<PyqTree | 'loading' | 'error' | null>(null);
  const [pdfs, setPdfs] = useState<{ id: string; subjectCode: string; nodeId: string; title: string; pages: number | null }[]>([]);
  useEffect(() => {
    once('chapter-pdfs', () => api.chapterPdfs(EXAM)).then(setPdfs, () => setPdfs([]));
  }, []);
  const [open, setOpen] = useState<Record<string, boolean>>(loadOpen);
  /** The chapter that is open inside the Question Bank (`c:`) and inside Study Material (`m:`) of each subject: one at a time. */
  const [groupOpen, setGroupOpen] = useState<Record<string, string | null>>(loadGroups);
  const toggleGroup = useCallback((key: string, id: string) => {
    setGroupOpen((o) => {
      const next = { ...o, [key]: o[key] === id ? null : id };
      try {
        sessionStorage.setItem(GROUPS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggle = (key: string) =>
    setOpen((o) => {
      const next = o[key] ? { ...o, [key]: false } : opened(o, [key]);
      try {
        sessionStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* storage can be blocked; the sidebar still works */
      }
      return next;
    });
  const expand = useCallback((keys: string[]) => {
    setOpen((o) => {
      const next = opened(o, keys);
      if (JSON.stringify(next) === JSON.stringify(o)) return o;
      try {
        sessionStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    once('subjects', () => api.subjects(EXAM, YEAR)).then(
      (s) => setSubjects([...s].sort((a, b) => a.name.localeCompare(b.name))),
      () => setFailed(true),
    );
  }, []);

  const loadOutline = useCallback((paperId: string) => {
    setOutlines((o) => {
      if (o[paperId]) return o;
      once(`outline:${paperId}`, () => api.outline(paperId)).then(
        (d) => setOutlines((x) => ({ ...x, [paperId]: d })),
        () => setOutlines((x) => ({ ...x, [paperId]: 'error' })),
      );
      return { ...o, [paperId]: 'loading' };
    });
  }, []);
  const loadPyq = useCallback(() => {
    setPyq((p) => {
      if (p) return p;
      once('pyq', () => api.pyqTree(EXAM)).then(setPyq, () => setPyq('error'));
      return 'loading';
    });
  }, []);

  // Open what the student already opened: load the outline of every open subject, and the paper index if a papers list is open.
  useEffect(() => {
    if (!subjects) return;
    for (const s of subjects) if (open[`s:${s.paperId}`] && s.available) loadOutline(s.paperId);
    if (subjects.some((s) => open[`p:${s.paperId}`])) loadPyq();
  }, [subjects, open, loadOutline, loadPyq]);

  // Follow the page. The paper and chapter a page belongs to come from the URL (a subject page) or from the topic or lesson the page shows
  // (topic, quick revision and lesson pages), so a direct visit, a refresh, back and forward all open and mark the right subject, category and chapter.
  const subjectPaper = /^\/[A-Z_]+\/subject\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const areaMatch = /^\/[A-Z_]+\/subject\/([^/]+)\/([^/]+)/.exec(pathname);
  const areaRoute = areaMatch ? { paperId: areaMatch[1]!, area: areaMatch[2]! } : null;
  const topicRoute = /^\/(?:topic|revise)\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const pdfRoute = /^\/pyq\/view\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const fullRoute = /^\/mock-tests\/full\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const mockRoute = /^\/mock-tests\/topic\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const lessonRoute = /^\/learn\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const onMock = !!mockRoute;
  const nodeRoute = topicRoute ?? mockRoute;
  const routeKey = nodeRoute ? `t:${nodeRoute}` : lessonRoute ? `l:${lessonRoute}` : null;
  const [ctxNode, setCtxNode] = useState<{ key: string; paperId: string; nodeId: string } | null>(null);
  useEffect(() => {
    if (!routeKey) return;
    let live = true;
    const found = nodeRoute
      ? once(`topic:${nodeRoute}`, () => api.topic(nodeRoute)).then((t) => (t.paper ? { paperId: t.paper.id, nodeId: nodeRoute } : null))
      : once(`resource:${lessonRoute}`, () => api.resource(lessonRoute!)).then((r) => (r.topic ? { paperId: r.topic.paper_id, nodeId: r.topic.id } : null));
    found.then(
      (v) => live && v && setCtxNode({ key: routeKey, ...v }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [routeKey, nodeRoute, lessonRoute]);
  const ctx = ctxNode && ctxNode.key === routeKey ? ctxNode : null;
  useEffect(() => {
    if (subjectPaper) expand([`s:${subjectPaper}`]);
  }, [subjectPaper, expand]);
  useEffect(() => {
    if (!ctx) return;
    expand([`s:${ctx.paperId}`, onMock ? `k:${ctx.paperId}` : `c:${ctx.paperId}`]);
    loadOutline(ctx.paperId);
  }, [ctx, lessonRoute, onMock, expand, loadOutline]);
  const chaptersByPaper = useMemo(() => {
    const m: Record<string, ReturnType<typeof chaptersOf>> = {};
    for (const [id, o] of Object.entries(outlines)) if (typeof o === 'object') m[id] = chaptersOf(o.nodes);
    return m;
  }, [outlines]);
  /** The chapter row to mark as selected, and the section or unit heading above it (marked, not selected). */
  const current = useMemo(() => {
    if (!ctx) return null;
    const list = chaptersByPaper[ctx.paperId];
    const item = list?.find((c) => c.kind === 'topic' && c.ids.has(ctx.nodeId)) ?? list?.find((c) => c.ids.has(ctx.nodeId));
    const group = list?.find((c) => c.kind === 'group' && c.id !== item?.id && c.ids.has(ctx.nodeId));
    return { paperId: ctx.paperId, itemId: item?.id ?? null, groupId: group?.id ?? null, groupSelf: item?.kind === 'group' ? item.id : null };
  }, [ctx, chaptersByPaper]);
  const wantedGroup = current ? current.groupId : null;
  const wantedKey = current ? (onMock ? `k:${current.paperId}` : `c:${current.paperId}`) : null;
  useEffect(() => {
    if (!wantedGroup || !wantedKey) return;
    setGroupOpen((o) => {
      if (o[wantedKey] === wantedGroup) return o;
      const next = { ...o, [wantedKey]: wantedGroup };
      try {
        sessionStorage.setItem(GROUPS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [wantedGroup, wantedKey]);

  const params = new URLSearchParams(search);
  const onPyq = pathname === '/pyq';
  const pyqYear = Number(params.get('year')) || null;
  const pyqSlug = params.get('subject') ?? '';
  const pyqSubject = onPyq && subjects && pyq && typeof pyq === 'object' ? (subjects.find((x) => pyqSlugMatches(pyq, x, pyqSlug)) ?? null) : null;
  useEffect(() => {
    if (onPyq) loadPyq();
  }, [onPyq, loadPyq]);
  useEffect(() => {
    if (fullRoute) expand([`s:${fullRoute}`, `k:${fullRoute}`]);
  }, [fullRoute, expand]);
  const pdfDoc = pdfs.find((d) => d.id === pdfRoute);
  const pdfSubject = pdfDoc && subjects ? (subjects.find((x) => x.code === pdfDoc.subjectCode) ?? null) : null;
  useEffect(() => {
    if (pdfSubject) expand([`s:${pdfSubject.paperId}`, `f:${pdfSubject.paperId}`]);
  }, [pdfSubject, expand]);
  useEffect(() => {
    if (pyqSubject) expand([`s:${pyqSubject.paperId}`, `p:${pyqSubject.paperId}`]);
  }, [pyqSubject, expand]);

  // Bring the selected row into view once per page, when it has appeared (after the list has opened and loaded).
  const listRef = useRef<HTMLUListElement>(null);
  const shownFor = useRef('');
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    const key = `${pathname}${search}`;
    if (row && shownFor.current !== key) {
      shownFor.current = key;
      row.scrollIntoView({ block: 'nearest' });
    }
  });

  if (failed) return <p className="px-4 py-3 text-xs text-ink-3">The subject list could not be loaded. Refresh the page to try again.</p>;
  if (!subjects) return <p className="px-4 py-3 text-xs text-ink-3">Loading subjects…</p>;

  return (
    <ul ref={listRef} className="space-y-px" aria-label="CUET UG subjects">
      {subjects.map((s, subjectIndex) => {
        const sKey = `s:${s.paperId}`;
        const isOpen = !!open[sKey];
        const onSubject = pathname === `/${EXAM}/subject/${s.paperId}`;
        const inside = current?.paperId === s.paperId || pyqSubject?.paperId === s.paperId;
        const hasQuestions = !!chaptersByPaper[s.paperId]?.some((c) => c.kind === 'topic' && c.questions > 0);
        const myPdfs = pdfs.filter((d) => d.subjectCode === s.code);
        return (
          <li key={s.paperId} className="mb-0.5">
            <SplitRow
              to={`/${EXAM}/subject/${s.paperId}`}
              kind="subject"
              label={
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: subjectTone(subjectIndex).dot }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                </span>
              }
              title={s.name}
              open={isOpen}
              state={onSubject ? 'selected' : inside || areaRoute?.paperId === s.paperId ? 'parent' : 'idle'}
              pad="pl-3"
              size="h-11"
              onSelect={() => {
                expand([sKey]);
                setOpen((o) => {
                  const next = { ...o };
                  for (const k of ['f', 'c', 'p', 'k', 'm']) next[`${k}:${s.paperId}`] = false;
                  try {
                    sessionStorage.setItem(STORE, JSON.stringify(next));
                  } catch {
                    /* ignore */
                  }
                  return next;
                });
                if (s.available) loadOutline(s.paperId);
                onNavigate?.();
              }}
              onToggle={() => {
                toggle(sKey);
                if (s.available) loadOutline(s.paperId);
              }}
            />
            {isOpen && (
              <ul className="pb-1">
                {!s.available ? (
                  <li className="py-1.5 pr-3 pl-9 text-xs text-ink-3">The syllabus for this paper is still being checked.</li>
                ) : (
                  <>
                    {myPdfs.length > 0 && (
                      <Category id={`f:${s.paperId}`} to={`/${EXAM}/subject/${s.paperId}/question-bank`} selected={areaRoute?.paperId === s.paperId && areaRoute.area === 'question-bank'} onSelect={onNavigate} label="Chapter-wise Question Bank" open={!!open[`f:${s.paperId}`]} active={pdfRoute !== null && myPdfs.some((d) => d.id === pdfRoute)} onToggle={() => toggle(`f:${s.paperId}`)}>
                        {myPdfs.map((d) => (
                          <li key={d.id}>
                            <Link to={`/pyq/view/${d.id}`} onClick={onNavigate} aria-current={pdfRoute === d.id ? 'page' : undefined} data-kind="chapter-pdf" title={bareChapter(d.title)} className={`${rowBase} h-8 pr-3 pl-9 text-[13px] ${pdfRoute === d.id ? selectedRow : 'text-ink'}`}>
                              <span className="min-w-0 flex-1 truncate">{bareChapter(d.title)}</span>
                              {d.pages ? <span className="num ml-auto shrink-0 text-[11px] text-ink-3">{d.pages} p</span> : null}
                            </Link>
                          </li>
                        ))}
                      </Category>
                    )}
                    <Category
                      id={`c:${s.paperId}`}
                      to={`/${EXAM}/subject/${s.paperId}/study-material`} selected={areaRoute?.paperId === s.paperId && areaRoute.area === 'study-material'} onSelect={onNavigate}
                      label="Study Material"
                      open={!!open[`c:${s.paperId}`]}
                      active={!onMock && current?.paperId === s.paperId}
                      onToggle={() => toggle(`c:${s.paperId}`)}
                    >
                      <Chapters paperId={s.paperId} outline={outlines[s.paperId]} list={chaptersByPaper[s.paperId]} currentId={!onMock && current?.paperId === s.paperId ? current.itemId : null} parentId={!onMock && current?.paperId === s.paperId ? current.groupId : null} openGroup={groupOpen[`c:${s.paperId}`] ?? null} onToggleGroup={(id) => toggleGroup(`c:${s.paperId}`, id)} onNavigate={onNavigate} onRetry={() => setOutlines((o) => { const { [s.paperId]: _drop, ...rest } = o; return rest; })} />
                    </Category>
                    <Category
                      id={`p:${s.paperId}`}
                      to={`/${EXAM}/subject/${s.paperId}/previous-papers`} selected={areaRoute?.paperId === s.paperId && areaRoute.area === 'previous-papers'} onSelect={onNavigate}
                      label="Previous Year Question Paper"
                      open={!!open[`p:${s.paperId}`]}
                      active={pyqSubject?.paperId === s.paperId}
                      onToggle={() => {
                        toggle(`p:${s.paperId}`);
                        loadPyq();
                      }}
                    >
                      <PyqYears subject={s} pyq={pyq} activeYear={pyqSubject?.paperId === s.paperId ? pyqYear : null} onNavigate={onNavigate} />
                    </Category>
                    {hasQuestions && (
                      <Category
                        id={`k:${s.paperId}`}
                        to={`/${EXAM}/subject/${s.paperId}/mock-tests`} selected={areaRoute?.paperId === s.paperId && areaRoute.area === 'mock-tests'} onSelect={onNavigate}
                        label="Practice and Mock Test"
                        open={!!open[`k:${s.paperId}`]}
                        active={(onMock && current?.paperId === s.paperId) || fullRoute === s.paperId}
                        onToggle={() => toggle(`k:${s.paperId}`)}
                      >
                        <li>
                          <Link to={`/mock-tests/full/${s.paperId}`} onClick={onNavigate} aria-current={fullRoute === s.paperId ? 'page' : undefined} data-kind="full-mock" className={`${rowBase} h-8 pr-3 pl-9 text-[13px] ${fullRoute === s.paperId ? selectedRow : 'text-ink'}`}>
                            <span className="min-w-0 flex-1 truncate">Full-length mock</span>
                          </Link>
                        </li>
                        <Chapters paperId={s.paperId} outline={outlines[s.paperId]} list={withQuestions(chaptersByPaper[s.paperId] ?? [])} currentId={onMock && current?.paperId === s.paperId ? current.itemId : null} parentId={onMock && current?.paperId === s.paperId ? current.groupId : null} openGroup={groupOpen[`k:${s.paperId}`] ?? null} onToggleGroup={(id) => toggleGroup(`k:${s.paperId}`, id)} base="/mock-tests/topic" kinds={['mock-group', 'mock-topic']} onNavigate={onNavigate} onRetry={() => undefined} />
                      </Category>
                    )}
                  </>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function pyqSlugMatches(pyq: PyqTree | 'loading' | 'error' | null, s: Subject, slug: string): boolean {
  if (!slug || !pyq || typeof pyq === 'string') return false;
  return pyq.years.some((y) => y.subjects.some((x) => x.slug === slug && x.code === s.code));
}

type RowState = 'selected' | 'parent' | 'idle';

/**
 * A row with two separate actions: the name opens its page (and marks it selected); the chevron at the far right only opens or closes
 * what is under it. Choosing a name never expands its children, and the chevron never navigates.
 */
function SplitRow({ to, label, title, open, state, onSelect, onToggle, pad, kind, size = 'h-8' }: { to: string; label: React.ReactNode; title?: string; open: boolean; state: RowState; onSelect?: () => void; onToggle: () => void; pad: string; kind?: string; size?: string }) {
  return (
    <div className={`${rowBase} ${state === 'selected' ? selectedRow : state === 'parent' ? parentRow : 'text-ink'}`}>
      <Link to={to} onClick={onSelect} aria-current={state === 'selected' ? 'page' : undefined} data-kind={kind} title={title} className={`flex min-h-8 min-w-0 flex-1 items-center py-1.5 pr-1 text-[13px] leading-snug ${pad} ${size === 'h-11' ? 'min-h-11' : ''}`}>
        <span className="min-w-0 flex-1">{label}</span>
      </Link>
      <button type="button" aria-expanded={open} aria-label={open ? 'Collapse' : 'Expand'} onClick={onToggle} className="mr-1 grid size-8 shrink-0 place-items-center rounded-md">
        <ChevronRight aria-hidden className={`size-3.5 transition-transform ${state === 'idle' ? 'text-ink-3' : 'text-accent'} ${open ? 'rotate-90' : ''}`} />
      </button>
    </div>
  );
}

function Category({ label, open, active, selected, to, onSelect, onToggle, children }: { id: string; label: string; open: boolean; active: boolean; selected?: boolean; to: string; onSelect?: () => void; onToggle: () => void; children: React.ReactNode }) {
  return (
    <li>
      <SplitRow to={to} label={label} open={open} state={selected ? 'selected' : active ? 'parent' : 'idle'} onSelect={onSelect} onToggle={onToggle} pad="pl-7" kind="category" />
      {open && <ul className="pb-0.5">{children}</ul>}
    </li>
  );
}

/** A chapter (section or unit) in a list: a row with its own chevron that opens or closes the topics under it. */
function ChapterRow({ kind, label, title, open, state, to, onSelect, onToggle }: { kind: string; label: string | null; title: string; open: boolean; state: RowState; to: string; onSelect?: () => void; onToggle: () => void }) {
  return (
    <SplitRow
      to={to}
      kind={kind}
      title={title}
      open={open}
      state={state}
      onSelect={onSelect}
      onToggle={onToggle}
      pad="pl-9"
      label={
        <>
          {title}
        </>
      }
    />
  );
}

/** Split a flat list (heading, topics, heading, topics...) into its chapters; topics before any heading stand alone. */
function inChapters<T extends { kind: string }, G extends T>(rows: T[], isGroup: (r: T) => r is G): { group: G | null; rest: T[] }[] {
  const out: { group: G | null; rest: T[] }[] = [];
  for (const r of rows) {
    if (isGroup(r)) out.push({ group: r, rest: [] });
    else if (out.length === 0 || out[out.length - 1]!.group === null) {
      if (out.length === 0) out.push({ group: null, rest: [] });
      out[out.length - 1]!.rest.push(r);
    } else out[out.length - 1]!.rest.push(r);
  }
  return out;
}

function Chapters({ paperId, outline, list, currentId, parentId, openGroup, onToggleGroup, base = '/topic', kinds = ['group', 'topic'], onNavigate, onRetry }: { paperId: string; outline: Outline | 'loading' | 'error' | undefined; list: ReturnType<typeof chaptersOf> | undefined; currentId: string | null; parentId: string | null; openGroup: string | null; onToggleGroup: (id: string) => void; base?: string; kinds?: [string, string]; onNavigate?: () => void; onRetry: () => void }) {
  if (!outline || outline === 'loading') return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">Loading…</li>;
  if (outline === 'error')
    return (
      <li className="py-1 pr-3 pl-9 text-xs text-ink-3">
        Could not load.{' '}
        <button type="button" onClick={onRetry} className="underline">
          Try again
        </button>
      </li>
    );
  if (!list || list.length === 0) return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">No chapters are listed yet.</li>;
  const topic = (c: SideItem, indent: string) => (
    <li key={c.id}>
      <Link
        to={`${base}/${c.id}`}
        onClick={onNavigate}
        aria-current={currentId === c.id ? 'page' : undefined}
        data-paper={paperId}
        data-kind={kinds[1]}
        title={c.title}
        className={`${rowBase} h-8 pr-3 text-[13px] ${indent} ${currentId === c.id ? selectedRow : 'text-ink'}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {c.title}
        </span>
        {c.questions > 0 && <Count n={c.questions} />}
      </Link>
    </li>
  );
  return (
    <>
      {inChapters(list, (r): r is SideItem => r.kind === 'group').map(({ group, rest }, i) =>
        group ? (
          <li key={group.id}>
            <ChapterRow kind={kinds[0]} to={`${base}/${group.id}`} label={group.label} title={group.title} open={openGroup === group.id} state={currentId === group.id ? (kinds[0] === 'mock-group' ? 'parent' : 'selected') : parentId === group.id ? 'parent' : 'idle'} onToggle={() => onToggleGroup(group.id)} />
            {openGroup === group.id && (
              <ul>
                {kinds[0] === 'mock-group' && (
                  <li>
                    <Link to={`${base}/${group.id}`} onClick={onNavigate} aria-current={currentId === group.id ? 'page' : undefined} data-kind="mock-chapter-test" className={`${rowBase} h-8 pr-3 pl-12 text-[13px] ${currentId === group.id ? selectedRow : 'text-ink'}`}>
                      <span className="min-w-0 flex-1 truncate">Chapter test</span>
                      {group.questions > 0 && <Count n={group.questions} />}
                    </Link>
                  </li>
                )}
                {rest.map((c) => topic(c, 'pl-12'))}
              </ul>
            )}
          </li>
        ) : (
          rest.map((c) => topic(c, 'pl-9'))
        ),
      )}
    </>
  );
}

function Lessons({ rows, lessonId, parentId, openGroup, onToggleGroup, onNavigate, hideEmpty }: { hideEmpty?: boolean; rows: LessonRow[] | 'loading' | 'error' | undefined; lessonId: string | null; parentId: string | null; openGroup: string | null; onToggleGroup: (id: string) => void; onNavigate?: () => void }) {
  if (!rows || rows === 'loading') return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">Loading…</li>;
  if (rows === 'error') return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">Could not load the lessons.</li>;
  if (rows.length === 0) return hideEmpty ? null : <li className="py-1 pr-3 pl-9 text-xs text-ink-3">No lessons are listed yet.</li>;
  const lesson = (r: Extract<LessonRow, { kind: 'lesson' }>, indent: string) => (
    <li key={r.id}>
      <Link to={`/learn/${r.id}`} onClick={onNavigate} aria-current={lessonId === r.id ? 'page' : undefined} data-kind="lesson" title={r.title} className={`${rowBase} h-8 pr-3 text-[13px] ${indent} ${lessonId === r.id ? selectedRow : 'text-ink'}`}>
        <span className="min-w-0 flex-1 truncate">{r.title}</span>
      </Link>
    </li>
  );
  return (
    <>
      {inChapters(rows, (r): r is Extract<LessonRow, { kind: 'group' }> => r.kind === 'group').map(({ group, rest }) =>
        group ? (
          <li key={`g-${group.id}`}>
            <ChapterRow kind="lesson-group" to={`/topic/${group.id}`} label={group.label} title={group.title} open={openGroup === group.id} state={parentId === group.id ? 'parent' : 'idle'} onToggle={() => onToggleGroup(group.id)} />
            {openGroup === group.id && <ul>{rest.map((r) => (r.kind === 'lesson' ? lesson(r, 'pl-12') : null))}</ul>}
          </li>
        ) : (
          rest.map((r) => (r.kind === 'lesson' ? lesson(r, 'pl-9') : null))
        ),
      )}
    </>
  );
}

function PyqYears({ subject, pyq, activeYear, onNavigate, indent = 'pl-9' }: { subject: Subject; pyq: PyqTree | 'loading' | 'error' | null; activeYear: number | null; onNavigate?: () => void; indent?: string }) {
  if (!pyq || pyq === 'loading') return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">Loading…</li>;
  if (pyq === 'error') return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">Could not load the papers.</li>;
  const rows = pyq.years
    .map((y) => ({ year: y.year, hit: y.subjects.find((x) => x.code === subject.code) }))
    .filter((r): r is { year: number; hit: NonNullable<typeof r.hit> } => !!r.hit && r.hit.papers > 0)
    .sort((a, b) => b.year - a.year);
  if (rows.length === 0) return <li className="py-1 pr-3 pl-9 text-xs text-ink-3">No question papers are listed for this paper yet.</li>;
  return (
    <>
      {rows.map(({ year, hit }) => (
        <li key={year}>
          <Link to={`/pyq?year=${year}&subject=${encodeURIComponent(hit.slug)}`} onClick={onNavigate} aria-current={activeYear === year ? 'page' : undefined} className={`${rowBase} h-8 pr-3 ${indent} text-[13px] ${activeYear === year ? selectedRow : 'text-ink'}`}>
            <span className="flex-1">{year}</span>
            <Count n={hit.papers} />
          </Link>
        </li>
      ))}
    </>
  );
}

/** The sidebar frame: its own scroll area, with Plans fixed at the bottom. */
function BrandMark() {
  return <PreporaSpark className="size-10" />;
}
export { BrandMark };

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const navRow = 'flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors hover:bg-white/[0.06]';

/** The student's learning space: brand, workspace links, every subject and who is signed in. */
export function Sidebar({ onNavigate, className = '' }: { onNavigate?: () => void; className?: string }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [exam, setExam] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      setExam(null);
      return;
    }
    let live = true;
    api.preferences().then((p) => live && setExam(p.examCode ? `${p.examCode === 'CUET_UG' ? 'CUET UG' : 'CUET PG'}${p.targetYear ? ` · ${p.targetYear}` : ''}` : null), () => undefined);
    return () => {
      live = false;
    };
  }, [user?.id, pathname]);
  const link = (to: string, label: string, icon: React.ReactNode, end = false) => (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `${navRow} ${isActive ? 'bg-lime-bright font-semibold text-forest shadow-[inset_3px_0_0_var(--color-coral-edge)]' : 'text-[var(--color-forest-soft)] hover:text-white'}`}
    >
      <span aria-hidden className="shrink-0 [&>svg]:size-4 [&>svg]:stroke-[1.6]">
        {icon}
      </span>
      {label}
    </NavLink>
  );
  return (
    <aside
      aria-label="Student learning space"
      data-sidebar
      className={`flex-col bg-forest font-display text-[var(--color-forest-soft)] [--color-accent:#e6f28e] [--color-ink-3:#86a594] [--color-ink:#c5d8cb] ${className}`}
      style={{ backgroundImage: 'radial-gradient(120% 55% at 0% 0%, rgb(255 255 255 / 0.07), transparent 60%)' }}
    >
      <div className="shrink-0 px-5 pt-6 pb-9">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-3 rounded-lg" aria-label="Prepora home">
          <BrandMark />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[17px] font-bold tracking-tight text-white" data-brand-name>
              Prepora
            </span>
            <span className="truncate text-[11.5px] text-[var(--color-forest-soft)]">Student learning space</span>
          </span>
        </Link>
      </div>
      <div className="shrink-0 px-3">
        <div className="label px-2 pt-4 pb-2 text-[10.5px] text-[#7f9d8d]">Workspace</div>
        <nav aria-label="Workspace" className="space-y-0.5">
          {link('/', 'Study map', <House />, true)}
          {link('/progress', 'My progress', <ChartPie />)}
          {link('/planner', 'Study planner', <CalendarRange />)}
          {link('/labs', 'Practical labs', <FlaskConical />)}
        </nav>
        <div className="label px-2 pt-6 pb-2 text-[10.5px] text-[#7f9d8d]">Your subjects</div>
      </div>
      <nav aria-label="Subjects" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-color:#2f5d52_transparent] [scrollbar-width:thin]">
        <SidebarNav onNavigate={onNavigate} />
      </nav>
      {user && (
        <Link to="/profile" onClick={onNavigate} className="flex shrink-0 items-center gap-3 border-t border-white/10 px-5 py-3.5 transition-colors hover:bg-white/[0.05]">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ebb9a3] text-[12px] font-bold text-forest">
            {initial(user.displayName)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[12.5px] font-semibold text-white">{user.displayName}</span>
            <span className="label truncate text-[10px] text-[#86a594]">{exam ?? 'Choose your exam'}</span>
          </span>
        </Link>
      )}
    </aside>
  );
}
