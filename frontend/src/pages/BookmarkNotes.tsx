import { ChevronDown, ChevronRight, ExternalLink, Highlighter, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { HIGHLIGHT_COLORS, INK_COLORS, KIND_LABEL } from '../annotate';
import { api, type AnnotationEntry } from '../api';
import { Rich } from '../rich';
import { Badge, Empty, ErrorBox, inputClass, Loading, SearchInput, useAuth, useLoad } from '../ui';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
/** Where an annotation was made: its lesson, or the page the question was on. The page scrolls to the mark. */
const place = (a: AnnotationEntry) => (a.resourceId ? `/learn/${a.resourceId}#annot-${a.id}` : a.originPath ? `${a.originPath}#annot-${a.id}` : a.topicId ? `/topic/${a.topicId}` : null);

interface Group<T> { id: string; title: string; position: number; items: T[] }
const group = <T,>(list: Group<T>[], id: string, title: string, position = 9999): Group<T> => {
  let g = list.find((x) => x.id === id);
  if (!g) list.push((g = { id, title, position, items: [] }));
  return g;
};
type Place = Group<AnnotationEntry>;
type Topic = Group<Place>;
type Chapter = Group<Topic>;
type Subject = Group<Chapter>;

/** Subject, then unit or chapter, then topic, then the lesson or question, then the marks made on it. */
function tree(list: AnnotationEntry[]): Subject[] {
  const subjects: Subject[] = [];
  for (const a of list) {
    const s = group(subjects, a.paperId ?? 'none', a.paper ?? 'Other');
    const chTitle = a.unit && a.chapter && a.unit !== a.chapter ? `${a.unit} › ${a.chapter}` : (a.chapter ?? a.unit ?? 'Other');
    const ch = group(s.items, a.chapterId ?? a.unitId ?? 'none', chTitle, a.unitPosition ?? a.chapterPosition ?? 9999);
    const t = group(ch.items, a.topicId ?? 'none', a.topic ?? chTitle);
    const p = group(t.items, a.resourceId ?? a.questionId ?? a.surfaceId, a.resourceId ? (a.lesson ?? 'Lesson') : `Question: ${a.question ?? ''}`);
    p.items.push(a);
  }
  subjects.sort((a, b) => a.title.localeCompare(b.title));
  for (const s of subjects) s.items.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  return subjects;
}

/** The "Highlights and notes" part of My bookmarks: every highlight, drawing and note the student made, by where it is. */
export function BookmarkNotes({ onCount }: { onCount: (n: number) => void }) {
  const { user } = useAuth();
  const loaded = useLoad(api.allAnnotations, [user?.id]);
  const [list, setList] = useState<AnnotationEntry[]>([]);
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => {
    if (loaded.data) {
      setList(loaded.data);
      onCount(loaded.data.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.data]);
  const all = useMemo(() => tree(list), [list]);
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((a) => {
      if (subjectId && (a.paperId ?? 'none') !== subjectId) return false;
      if (chapterId && (a.chapterId ?? a.unitId ?? 'none') !== chapterId) return false;
      if (!words.length) return true;
      const hay = [a.quote, a.note, a.lesson, a.question, a.topic, a.chapter, a.unit, a.paper, KIND_LABEL[a.kind]].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [list, query, subjectId, chapterId]);
  const shown = useMemo(() => tree(filtered), [filtered]);
  if (loaded.loading && !loaded.data) return <Loading />;
  if (loaded.error) return <ErrorBox error={loaded.error} onRetry={loaded.reload} />;

  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const apply = (next: AnnotationEntry[]) => {
    setList(next);
    onCount(next.length);
  };
  const remove = async (a: AnnotationEntry) => {
    setErr(null);
    try {
      await api.deleteAnnotation(a.id);
      apply(list.filter((x) => x.id !== a.id));
    } catch (e) {
      setErr(e as Error);
    }
  };
  const save = async (a: AnnotationEntry, body: { note?: string | null; color?: string }) => {
    setErr(null);
    try {
      const r = await api.editAnnotation(a.id, body);
      apply(list.map((x) => (x.id === a.id ? { ...x, note: r.note, color: r.color } : x)));
      setEditing(null);
    } catch (e) {
      setErr(e as Error);
    }
  };
  const subject = all.find((s) => s.id === subjectId);

  if (list.length === 0)
    return (
      <Empty icon={<Highlighter />}>
        No highlights or notes yet. In a lesson or on a practice question, select some text and pick a colour, or press “Annotate” to use the pen, shapes and notes. Everything you mark is kept here.
      </Empty>
    );
  return (
    <div data-notes-tab>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search highlights and notes" label="Search highlights and notes" />
        <label>
          <span className="sr-only">Subject</span>
          <select value={subjectId} onChange={(e) => (setSubjectId(e.target.value), setChapterId(''))} className={`${inputClass} h-9 w-auto py-0`} data-notes-filter="subject">
            <option value="">All subjects</option>
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Chapter</span>
          <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!subject} className={`${inputClass} h-9 w-auto max-w-[16rem] py-0 disabled:opacity-60`} data-notes-filter="chapter">
            <option value="">{subject ? 'All chapters' : 'Choose a subject first'}</option>
            {(subject?.items ?? []).map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err && <ErrorBox error={err} />}
      {filtered.length === 0 ? (
        <Empty icon={<Highlighter />}>No highlight or note matches.</Empty>
      ) : (
        <div className="space-y-4" data-notes-tree>
          {shown.map((s) => {
            const sOpen = !closed.has(`s:${s.id}`);
            return (
              <section key={s.id} className="overflow-hidden rounded-xl border border-rule bg-surface" data-subject-group={s.title}>
                <button type="button" onClick={() => toggle(`s:${s.id}`)} aria-expanded={sOpen} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-paper">
                  {sOpen ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{s.title}</h2>
                </button>
                {sOpen &&
                  s.items.map((ch) => {
                    const cOpen = !closed.has(`c:${s.id}:${ch.id}`);
                    return (
                      <div key={ch.id} className="border-t border-rule" data-chapter-group={ch.title}>
                        <button type="button" onClick={() => toggle(`c:${s.id}:${ch.id}`)} aria-expanded={cOpen} className="flex w-full items-center gap-2 bg-paper/60 py-2.5 pr-4 pl-6 text-left hover:bg-paper">
                          {cOpen ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                          <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{ch.title}</h3>
                        </button>
                        {cOpen &&
                          ch.items.map((t) =>
                            t.items.map((p) => (
                              <div key={`${t.id}:${p.id}`} className="border-t border-rule" data-place-group={p.title}>
                                <p className="flex flex-wrap items-baseline gap-x-2 px-4 pt-2.5 text-[13px] text-ink-3 sm:pl-12">
                                  {t.title !== ch.title && (
                                    <>
                                      <span className="font-medium text-ink-2">{t.title}</span>
                                      <span aria-hidden>›</span>
                                    </>
                                  )}
                                  <span className="line-clamp-1 font-medium text-ink-2">{p.title.startsWith('Question: ') ? <Rich text={p.title} inline /> : p.title}</span>
                                </p>
                                <ul className="divide-y divide-rule sm:pl-8">
                                  {p.items.map((a) => {
                                    const to = place(a);
                                    return (
                                      <li key={a.id} className="px-4 py-3" data-note-row={a.id} data-kind={a.kind}>
                                        <div className="flex items-start gap-3">
                                          <span aria-hidden className="mt-1 size-4 shrink-0 rounded" style={{ background: a.color }} />
                                          <div className="min-w-0 flex-1">
                                            {a.kind === 'HIGHLIGHT' ? (
                                              <p className="text-[15px] leading-snug text-ink" data-quote>
                                                “{a.quote}”
                                              </p>
                                            ) : (
                                              <p className="text-[15px] text-ink">{a.kind === 'NOTE' ? 'Note' : `Drawing: ${KIND_LABEL[a.kind]}`}</p>
                                            )}
                                            {a.note && editing !== a.id && (
                                              <p className="mt-1 text-sm whitespace-pre-wrap text-ink-2" data-note-text>
                                                {a.note}
                                              </p>
                                            )}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                                              <Badge>{KIND_LABEL[a.kind]}</Badge>
                                              {a.orphaned && <Badge tone="amber">Content changed: not placed</Badge>}
                                              <span>Saved {day(a.createdAt)}</span>
                                            </div>
                                            {editing === a.id && (
                                              <div className="mt-2">
                                                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} aria-label="Note" className="w-full rounded-lg border border-rule-strong bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                  {(a.kind === 'HIGHLIGHT' ? HIGHLIGHT_COLORS : INK_COLORS).map((c) => (
                                                    <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => save(a, { color: c })} className={`size-5 rounded-full ${a.color === c ? 'ring-2 ring-ink ring-offset-1' : 'ring-1 ring-rule-strong'}`} style={{ background: c }} />
                                                  ))}
                                                  <button type="button" onClick={() => save(a, { note: text })} className="ml-2 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white" data-note-save>
                                                    Save
                                                  </button>
                                                  <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-ink/5">
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7 text-[13px]">
                                          {to && (
                                            <Link to={to} className="inline-flex items-center gap-1 font-medium text-accent hover:underline" data-note-open>
                                              <ExternalLink aria-hidden className="size-3.5" />
                                              {a.orphaned ? 'Open the page' : 'Open at its place'}
                                            </Link>
                                          )}
                                          <button type="button" onClick={() => (setEditing(a.id), setText(a.note ?? ''))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink" data-note-edit>
                                            <Pencil aria-hidden className="size-3.5" />
                                            {a.note ? 'Edit' : 'Add a note'}
                                          </button>
                                          <button type="button" onClick={() => remove(a)} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-3 hover:bg-wrong-soft hover:text-wrong" aria-label={`Delete ${KIND_LABEL[a.kind].toLowerCase()}`} data-note-delete>
                                            <Trash2 aria-hidden className="size-3.5" />
                                            Delete
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )),
                          )}
                      </div>
                    );
                  })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
