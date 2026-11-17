import { ChevronRight, CreditCard } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, type ExamCode, type Outline, type OutlineNode, type PyqTree, type Subject } from './api';

/**
 * The global, three-level, inline-expanding sidebar.
 *   Level 1: the CUET UG papers.
 *   Level 2: what we have for a paper: Chapter-wise questions, Previous-year papers.
 *   Level 3: the chapters (with their real question counts) or the years of papers.
 * Everything comes from the existing APIs; nothing is invented. Expansion happens in place, under the parent.
 */

const EXAM: ExamCode = 'CUET_UG';
const YEAR = 2026;
const STORE = 'cuet.sidebar.open';

const rowBase = 'relative flex w-full items-center gap-1.5 text-left transition-colors hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04]';
const selectedRow = 'bg-nav-soft text-ink hover:bg-nav-soft before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-nav';

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight aria-hidden className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`} />;
}

function Count({ n }: { n: number }) {
  return <span className="num ml-auto shrink-0 rounded-full bg-ink/[0.06] px-1.5 py-px text-[11px] leading-4 text-ink-3">{n}</span>;
}

/** Chapters of a paper: the content roots of its outline; a section is opened one level so its units are listed. */
export function chaptersOf(nodes: OutlineNode[]): { id: string; title: string; label: string | null; questions: number; ids: Set<string> }[] {
  const kids = new Map<string | null, OutlineNode[]>();
  for (const n of nodes) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n]);
  const sort = (l: OutlineNode[]) => [...l].sort((a, b) => a.position - b.position);
  const subtree = (id: string): OutlineNode[] => (kids.get(id) ?? []).flatMap((c) => [c, ...subtree(c.id)]);
  const roots = sort(kids.get(null) ?? []).filter((r) => r.kind !== 'NOTE');
  const picked = roots.flatMap((r) => (r.kind === 'SECTION' && (kids.get(r.id) ?? []).length > 0 ? sort(kids.get(r.id)!) : [r]));
  return picked.map((n) => {
    const all = [n, ...subtree(n.id)];
    return { id: n.id, title: n.title, label: n.label, questions: all.reduce((s, x) => s + x.questions, 0), ids: new Set(all.map((x) => x.id)) };
  });
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
  const [open, setOpen] = useState<Record<string, boolean>>(loadOpen);

  const toggle = (key: string) =>
    setOpen((o) => {
      const next = { ...o, [key]: !o[key] };
      try {
        sessionStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* storage can be blocked; the sidebar still works */
      }
      return next;
    });
  const expand = useCallback((keys: string[]) => {
    setOpen((o) => {
      if (keys.every((k) => o[k])) return o;
      const next = { ...o, ...Object.fromEntries(keys.map((k) => [k, true])) };
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

  // Follow the page: a subject page opens its subject; a topic page opens the chapter it belongs to.
  const topicId = /^\/topic\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const subjectPaper = /^\/[A-Z_]+\/subject\/([^/]+)/.exec(pathname)?.[1] ?? null;
  useEffect(() => {
    if (subjectPaper) expand([`s:${subjectPaper}`]);
  }, [subjectPaper, expand]);
  const chaptersByPaper = useMemo(() => {
    const m: Record<string, ReturnType<typeof chaptersOf>> = {};
    for (const [id, o] of Object.entries(outlines)) if (typeof o === 'object') m[id] = chaptersOf(o.nodes);
    return m;
  }, [outlines]);
  const current = useMemo(() => {
    if (!topicId) return null;
    for (const [paperId, list] of Object.entries(chaptersByPaper)) {
      const ch = list.find((c) => c.ids.has(topicId));
      if (ch) return { paperId, chapterId: ch.id };
    }
    return null;
  }, [topicId, chaptersByPaper]);
  useEffect(() => {
    if (current) expand([`s:${current.paperId}`, `c:${current.paperId}`]);
  }, [current, expand]);
  // On a topic page whose subject is not loaded yet, look through the papers one by one until it is found.
  useEffect(() => {
    if (!topicId || current || !subjects) return;
    const next = subjects.find((s) => s.available && !outlines[s.paperId]);
    if (next) loadOutline(next.paperId);
  }, [topicId, current, subjects, outlines, loadOutline]);

  const params = new URLSearchParams(search);
  const onPyq = pathname === '/pyq';
  const pyqYear = Number(params.get('year')) || null;
  const pyqSlug = params.get('subject') ?? '';

  if (failed) return <p className="px-4 py-3 text-xs text-ink-3">The subject list could not be loaded. Refresh the page to try again.</p>;
  if (!subjects) return <p className="px-4 py-3 text-xs text-ink-3">Loading subjects…</p>;

  return (
    <ul className="py-1" aria-label="CUET UG subjects">
      {subjects.map((s) => {
        const sKey = `s:${s.paperId}`;
        const isOpen = !!open[sKey];
        const onSubject = pathname === `/${EXAM}/subject/${s.paperId}`;
        const inside = current?.paperId === s.paperId || (onPyq && pyqSlugMatches(pyq, s, pyqSlug));
        return (
          <li key={s.paperId}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                toggle(sKey);
                if (s.available) loadOutline(s.paperId);
              }}
              className={`${rowBase} h-auto min-h-9 px-3 py-1.5 text-[13.5px] ${onSubject ? selectedRow : inside ? 'font-semibold text-ink' : 'text-ink-2'}`}
            >
              <Chevron open={isOpen} />
              <span className="min-w-0 flex-1 leading-snug">{s.name}</span>
            </button>
            {isOpen && (
              <ul className="pb-1">
                {!s.available ? (
                  <li className="py-1.5 pr-3 pl-9 text-xs text-ink-3">The syllabus for this paper is still being checked.</li>
                ) : (
                  <>
                    <Category
                      id={`c:${s.paperId}`}
                      label="Chapter-wise questions"
                      open={!!open[`c:${s.paperId}`]}
                      active={current?.paperId === s.paperId}
                      onToggle={() => toggle(`c:${s.paperId}`)}
                    >
                      <Chapters paperId={s.paperId} outline={outlines[s.paperId]} list={chaptersByPaper[s.paperId]} currentId={current?.paperId === s.paperId ? current.chapterId : null} onNavigate={onNavigate} onRetry={() => setOutlines((o) => { const { [s.paperId]: _drop, ...rest } = o; return rest; })} />
                    </Category>
                    <Category
                      id={`p:${s.paperId}`}
                      label="Previous-year papers"
                      open={!!open[`p:${s.paperId}`]}
                      active={onPyq && pyqSlugMatches(pyq, s, pyqSlug)}
                      onToggle={() => {
                        toggle(`p:${s.paperId}`);
                        loadPyq();
                      }}
                    >
                      <PyqYears subject={s} pyq={pyq} activeYear={onPyq && pyqSlugMatches(pyq, s, pyqSlug) ? pyqYear : null} onNavigate={onNavigate} />
                    </Category>
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

function Category({ label, open, active, onToggle, children }: { id: string; label: string; open: boolean; active: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={onToggle} className={`${rowBase} min-h-8 py-1 pr-3 pl-7 text-[13px] ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>
        <Chevron open={open} />
        <span className="flex-1 leading-snug">{label}</span>
      </button>
      {open && <ul className="pb-0.5">{children}</ul>}
    </li>
  );
}

function Chapters({ paperId, outline, list, currentId, onNavigate, onRetry }: { paperId: string; outline: Outline | 'loading' | 'error' | undefined; list: ReturnType<typeof chaptersOf> | undefined; currentId: string | null; onNavigate?: () => void; onRetry: () => void }) {
  if (!outline || outline === 'loading') return <li className="py-1 pr-3 pl-12 text-xs text-ink-3">Loading…</li>;
  if (outline === 'error')
    return (
      <li className="py-1 pr-3 pl-12 text-xs text-ink-3">
        Could not load.{' '}
        <button type="button" onClick={onRetry} className="underline">
          Try again
        </button>
      </li>
    );
  if (!list || list.length === 0) return <li className="py-1 pr-3 pl-12 text-xs text-ink-3">No chapters are listed yet.</li>;
  return (
    <>
      {list.map((c) => (
        <li key={c.id}>
          <Link to={`/topic/${c.id}`} onClick={onNavigate} aria-current={currentId === c.id ? 'page' : undefined} data-paper={paperId} className={`${rowBase} min-h-7 py-1 pr-3 pl-12 text-[12.5px] ${currentId === c.id ? selectedRow : 'text-ink-2'}`}>
            <span className="min-w-0 flex-1 leading-snug">
              {c.label ? <span className="text-ink-3">{c.label} </span> : null}
              {c.title}
            </span>
            {c.questions > 0 && <Count n={c.questions} />}
          </Link>
        </li>
      ))}
    </>
  );
}

function PyqYears({ subject, pyq, activeYear, onNavigate }: { subject: Subject; pyq: PyqTree | 'loading' | 'error' | null; activeYear: number | null; onNavigate?: () => void }) {
  if (!pyq || pyq === 'loading') return <li className="py-1 pr-3 pl-12 text-xs text-ink-3">Loading…</li>;
  if (pyq === 'error') return <li className="py-1 pr-3 pl-12 text-xs text-ink-3">Could not load the papers.</li>;
  const rows = pyq.years
    .map((y) => ({ year: y.year, hit: y.subjects.find((x) => x.code === subject.code) }))
    .filter((r): r is { year: number; hit: NonNullable<typeof r.hit> } => !!r.hit && r.hit.papers > 0)
    .sort((a, b) => b.year - a.year);
  if (rows.length === 0) return <li className="py-1 pr-3 pl-12 text-xs text-ink-3">No question papers are listed for this paper yet.</li>;
  return (
    <>
      {rows.map(({ year, hit }) => (
        <li key={year}>
          <Link to={`/pyq?year=${year}&subject=${encodeURIComponent(hit.slug)}`} onClick={onNavigate} aria-current={activeYear === year ? 'page' : undefined} className={`${rowBase} min-h-7 py-1 pr-3 pl-12 text-[12.5px] ${activeYear === year ? selectedRow : 'text-ink-2'}`}>
            <span className="flex-1">{year}</span>
            <Count n={hit.papers} />
          </Link>
        </li>
      ))}
    </>
  );
}

/** The sidebar frame: its own scroll area, with Plans fixed at the bottom. */
export function Sidebar({ onNavigate, className = '' }: { onNavigate?: () => void; className?: string }) {
  const { pathname } = useLocation();
  return (
    <aside aria-label="Subjects" className={`flex-col border-r border-rule bg-surface ${className}`}>
      <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">CUET UG</div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        <SidebarNav onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-rule">
        <Link to="/plans" onClick={onNavigate} aria-current={pathname === '/plans' ? 'page' : undefined} className={`${rowBase} h-10 px-3 text-[13.5px] ${pathname === '/plans' ? selectedRow : 'text-ink-2'}`}>
          <CreditCard aria-hidden className="size-4 text-ink-3" />
          Plans
        </Link>
      </div>
    </aside>
  );
}
