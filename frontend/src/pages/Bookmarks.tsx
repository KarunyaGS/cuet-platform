import { Bookmark as BookmarkIcon, BookOpen, ChevronDown, ChevronRight, CircleHelp, History, Layers, ListChecks, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, type Bookmark, type BookmarkKind, type Flashcard } from '../api';
import { applyChange, CardRow } from '../revision';
import { BookmarkNotes } from './BookmarkNotes';
import { Rich } from '../rich';
import { ButtonLink, buttonClass, Empty, ErrorBox, inputClass, Loading, PageHeader, SearchInput, Segmented, StatGroup, useAuth, useLoad } from '../ui';

const KIND: Record<BookmarkKind, { label: string; icon: React.ReactNode }> = {
  TOPIC: { label: 'Topic', icon: <Layers aria-hidden className="size-[18px]" /> },
  LESSON: { label: 'Lesson', icon: <BookOpen aria-hidden className="size-[18px]" /> },
  QUESTION: { label: 'Question', icon: <CircleHelp aria-hidden className="size-[18px]" /> },
  REVISION: { label: 'Revision notes', icon: <ListChecks aria-hidden className="size-[18px]" /> },
};

function target(b: Bookmark) {
  if (b.kind === 'TOPIC') return `/topic/${b.entityId}`;
  if (b.kind === 'REVISION') return `/revise/${b.entityId}`;
  if (b.kind === 'LESSON') return `/learn/${b.entityId}`;
  return b.nodeId ? `/topic/${b.nodeId}` : null;
}

type Tab = 'CARDS' | 'NOTES' | 'PAGES' | 'RECENT';
type Show = 'ALL' | 'NEED' | 'DUE';

interface Lesson { id: string; title: string; cards: Flashcard[] }
interface Topic { id: string; title: string; position: number; lessons: Lesson[] }
interface Chapter { id: string; title: string; position: number; total: number; topics: Topic[] }
interface Subject { id: string; title: string; total: number; chapters: Chapter[] }

/** Subject, then chapter, then topic, then lesson, then the cards saved from it. */
function tree(cards: Flashcard[]): Subject[] {
  const subjects: Subject[] = [];
  for (const c of cards) {
    const sid = c.paperId ?? 'none';
    let s = subjects.find((x) => x.id === sid);
    if (!s) subjects.push((s = { id: sid, title: c.paper ?? 'Other', total: 0, chapters: [] }));
    const cid = c.chapterId ?? 'none';
    let ch = s.chapters.find((x) => x.id === cid);
    if (!ch) s.chapters.push((ch = { id: cid, title: c.chapter ?? 'Other', position: c.chapterPosition ?? 9999, total: 0, topics: [] }));
    const tid = c.topicId ?? cid;
    let t = ch.topics.find((x) => x.id === tid);
    if (!t) ch.topics.push((t = { id: tid, title: c.topic ?? ch.title, position: c.topicPosition ?? 9999, lessons: [] }));
    let l = t.lessons.find((x) => x.id === c.resourceId);
    if (!l) t.lessons.push((l = { id: c.resourceId, title: c.lesson, cards: [] }));
    l.cards.push(c);
    s.total++;
    ch.total++;
  }
  subjects.sort((a, b) => a.title.localeCompare(b.title));
  for (const s of subjects) {
    s.chapters.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    for (const ch of s.chapters) {
      ch.topics.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
      for (const t of ch.topics) t.lessons.sort((a, b) => a.title.localeCompare(b.title));
    }
  }
  return subjects;
}

/** My bookmarks: everything the student saved. Saved definitions, formulas and key points are revision cards. */
export function BookmarksPage() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  // Arriving from a topic page: only that topic's cards.
  const nodeId = params.get('nodeId');
  const loaded = useLoad(() => api.cards({ nodeId, limit: 1000 }), [user?.id, nodeId]);
  const pages = useLoad(api.bookmarks, [user?.id]);
  const recent = useLoad(api.recent, [user?.id]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  useEffect(() => {
    if (loaded.data) setCards(loaded.data);
  }, [loaded.data]);
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'notes' ? 'NOTES' : 'CARDS');
  // Highlights, drawings and notes: a different kind of saved item, in the same place.
  const [noteCount, setNoteCount] = useState<number | null>(null);
  useEffect(() => {
    if (user) api.allAnnotations().then((r) => setNoteCount(r.length), () => undefined);
  }, [user]);
  const [show, setShow] = useState<Show>(params.get('show') === 'due' ? 'DUE' : 'ALL');
  const [query, setQuery] = useState('');
  const subjectId = params.get('paperId') ?? '';
  const chapterId = params.get('chapterId') ?? '';
  // Groups the student has closed (everything starts open, so saved items are never hidden by default).
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<Error | null>(null);

  const all = useMemo(() => tree(cards), [cards]);
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cards.filter((c) => {
      if (subjectId && (c.paperId ?? 'none') !== subjectId) return false;
      if (chapterId && (c.chapterId ?? 'none') !== chapterId) return false;
      if (show === 'NEED' && c.status !== 'NEED_REVISION') return false;
      if (show === 'DUE' && !c.due) return false;
      if (!words.length) return true;
      const text = [c.front, c.back, c.section, c.lesson, c.topic, c.chapter, c.paper, c.latex].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [cards, subjectId, chapterId, show, query]);
  const shown = useMemo(() => tree(filtered), [filtered]);

  if (ready && !user) return <Navigate to="/signin" replace />;
  if (loaded.loading && !loaded.data) return <Loading />;
  if (loaded.error) return <ErrorBox error={loaded.error} onRetry={loaded.reload} />;

  const due = cards.filter((c) => c.due).length;
  const need = cards.filter((c) => c.status === 'NEED_REVISION').length;
  const scopeDue = filtered.filter((c) => c.due).length;
  const choose = (p: string, ch: string) => {
    const next = new URLSearchParams();
    if (nodeId) next.set('nodeId', nodeId);
    if (p) next.set('paperId', p);
    if (p && ch) next.set('chapterId', ch);
    setParams(next, { replace: true });
  };
  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const reviewQuery = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : subjectId && subjectId !== 'none' ? `?paperId=${encodeURIComponent(subjectId)}${chapterId && chapterId !== 'none' ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}` : '';
  const subject = all.find((s) => s.id === subjectId);
  const filtering = Boolean(query.trim() || subjectId || chapterId || show !== 'ALL');
  const savedPages = pages.data ?? [];
  const removePage = async (b: Bookmark) => {
    setErr(null);
    try {
      await api.removeBookmark({ kind: b.kind, entityId: b.entityId });
      pages.reload();
    } catch (e) {
      setErr(e as Error);
    }
  };

  return (
    <div>
      <PageHeader
        title="My bookmarks"
        subtitle="Everything you saved, in one place: revision cards from saved definitions, formulas and key points, and your own highlights and notes."
        actions={
          due > 0 ? (
            <Link to={`/bookmarks/review${reviewQuery}`} className={buttonClass('primary')} data-review>
              Revise {filtering && tab === 'CARDS' ? scopeDue : due} due {(filtering && tab === 'CARDS' ? scopeDue : due) === 1 ? 'card' : 'cards'}
            </Link>
          ) : undefined
        }
      />
      <div className="mb-5">
        <Segmented
          label="What to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'CARDS', label: `Revision cards (${cards.length})` },
            { value: 'NOTES', label: `Highlights and notes${noteCount === null ? '' : ` (${noteCount})`}` },
            { value: 'PAGES', label: `Saved pages (${savedPages.length})` },
            { value: 'RECENT', label: 'Recently viewed' },
          ]}
        />
      </div>
      {err && <ErrorBox error={err} />}

      {tab === 'CARDS' &&
        (cards.length === 0 ? (
          <Empty
            icon={<BookmarkIcon />}
            action={
              <span className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/CUET_UG">Browse CUET-UG subjects</ButtonLink>
                <ButtonLink to="/search">Search for a concept</ButtonLink>
              </span>
            }
          >
            {nodeId ? 'You have not saved anything from this topic yet.' : 'Nothing saved yet.'} Open a lesson and tap the bookmark icon under a definition, a formula or a key point. It appears here as a revision card.
          </Empty>
        ) : (
          <>
            <div className="mb-5 max-w-xl">
              <StatGroup
                items={[
                  { label: 'Saved cards', value: cards.length },
                  { label: 'Due today', value: due, tone: due === 0 ? 'correct' : undefined },
                  { label: 'Need revision', value: need, tone: need ? 'wrong' : 'muted' },
                ]}
              />
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2" data-card-filters>
              <SearchInput value={query} onChange={setQuery} placeholder="Search saved cards" label="Search saved cards" />
              <label>
                <span className="sr-only">Subject</span>
                <select value={subjectId} onChange={(e) => choose(e.target.value, '')} className={`${inputClass} h-9 w-auto py-0`} data-filter="subject">
                  <option value="">All subjects</option>
                  {all.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.total})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Chapter</span>
                <select value={chapterId} onChange={(e) => choose(subjectId, e.target.value)} disabled={!subject} className={`${inputClass} h-9 w-auto max-w-[16rem] py-0 disabled:opacity-60`} data-filter="chapter">
                  <option value="">{subject ? 'All chapters' : 'Choose a subject first'}</option>
                  {(subject?.chapters ?? []).map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title} ({ch.total})
                    </option>
                  ))}
                </select>
              </label>
              <Segmented label="Which cards to show" value={show} onChange={setShow} options={[{ value: 'ALL', label: 'All' }, { value: 'NEED', label: 'Need revision' }, { value: 'DUE', label: 'Due today' }]} />
            </div>
            {nodeId && (
              <p className="mb-4 text-sm text-ink-2">
                Showing cards saved from one topic.{' '}
                <Link to="/bookmarks" className="font-medium text-accent hover:underline">
                  Show all my bookmarks
                </Link>
              </p>
            )}

            {filtered.length === 0 ? (
              <Empty icon={<BookmarkIcon />}>{show === 'DUE' ? 'No saved cards are due here today.' : show === 'NEED' ? 'No cards are marked Need revision here.' : 'No saved card matches.'}</Empty>
            ) : (
              <div className="space-y-4" data-card-tree>
                {shown.map((s) => {
                  const sKey = `s:${s.id}`;
                  const sOpen = !closed.has(sKey);
                  return (
                    <section key={s.id} className="overflow-hidden rounded-xl border border-rule bg-surface" data-subject-group={s.title}>
                      <button type="button" onClick={() => toggle(sKey)} aria-expanded={sOpen} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-paper">
                        {sOpen ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{s.title}</h2>
                        <span className="num text-sm text-ink-2">{s.total}</span>
                      </button>
                      {sOpen &&
                        s.chapters.map((ch) => {
                          const cKey = `c:${s.id}:${ch.id}`;
                          const cOpen = !closed.has(cKey);
                          return (
                            <div key={ch.id} className="border-t border-rule" data-chapter-group={ch.title}>
                              <button type="button" onClick={() => toggle(cKey)} aria-expanded={cOpen} className="flex w-full items-center gap-2 bg-paper/60 py-2.5 pr-4 pl-6 text-left hover:bg-paper">
                                {cOpen ? <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                                <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{ch.title}</h3>
                                <span className="num text-sm text-ink-3">{ch.total}</span>
                              </button>
                              {cOpen &&
                                ch.topics.map((t) => (
                                  <div key={t.id} data-topic-group={t.title}>
                                    {t.lessons.map((l) => (
                                      <div key={l.id} className="border-t border-rule" data-lesson-group={l.title}>
                                        <p className="flex flex-wrap items-baseline gap-x-2 px-4 pt-2.5 text-[13px] text-ink-3 sm:pl-12">
                                          {t.title !== ch.title && (
                                            <>
                                              <Link to={`/topic/${t.id}`} className="font-medium text-ink-2 hover:text-accent">
                                                {t.title}
                                              </Link>
                                              <span aria-hidden>›</span>
                                            </>
                                          )}
                                          <Link to={`/learn/${l.id}`} className="font-medium text-ink-2 hover:text-accent">
                                            {l.title}
                                          </Link>
                                        </p>
                                        <ul className="divide-y divide-rule sm:pl-8">
                                          {l.cards.map((c) => (
                                            <CardRow key={c.id} card={c} grouped onChange={(next) => setCards((list) => applyChange(list, c.id, next))} />
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                            </div>
                          );
                        })}
                    </section>
                  );
                })}
              </div>
            )}
            {cards.length >= 1000 && <p className="mt-3 text-sm text-ink-2">Showing your first 1,000 cards.</p>}
          </>
        ))}

      {tab === 'NOTES' && <BookmarkNotes onCount={setNoteCount} />}

      {tab === 'PAGES' &&
        (pages.loading && !pages.data ? (
          <Loading />
        ) : pages.error ? (
          <ErrorBox error={pages.error} onRetry={pages.reload} />
        ) : savedPages.length === 0 ? (
          <Empty icon={<BookmarkIcon />}>No saved pages yet. Use the Bookmark button at the top of a topic, a lesson or a revision page, or on a practice question, to keep a shortcut to it here.</Empty>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2">Shortcuts to whole topics, lessons, revision pages and practice questions. Removing a shortcut never removes your revision cards.</p>
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
              {savedPages.map((b) => {
                const to = target(b);
                const body = b.kind === 'QUESTION' ? <Rich text={b.title} inline /> : b.title;
                return (
                  <li key={b.id} className="flex items-start gap-3 px-4 py-3.5" data-saved-page={b.kind}>
                    <span className="mt-0.5 shrink-0 text-ink-3">{KIND[b.kind].icon}</span>
                    <span className="min-w-0 flex-1">
                      {to ? (
                        <Link to={to} className="line-clamp-2 text-[15px] text-ink hover:text-accent">
                          {body}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 text-[15px] text-ink">{body}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {KIND[b.kind].label}
                        {b.paper ? `, ${b.paper}` : ''}
                        {b.kind === 'QUESTION' && b.nodeId ? '. Opens the topic it belongs to.' : ''}
                      </span>
                    </span>
                    <button type="button" onClick={() => removePage(b)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-ink-3 transition-colors hover:bg-wrong-soft hover:text-wrong" aria-label={`Remove shortcut: ${typeof b.title === 'string' ? b.title.slice(0, 60) : ''}`}>
                      <Trash2 aria-hidden className="size-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ))}

      {tab === 'RECENT' &&
        (recent.loading && !recent.data ? (
          <Loading />
        ) : recent.error ? (
          <ErrorBox error={recent.error} onRetry={recent.reload} />
        ) : recent.data!.length === 0 ? (
          <Empty icon={<History />}>Nothing opened yet. Lessons and topics you open appear here.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {recent.data!.map((r) => (
              <li key={`${r.kind}-${r.resourceId ?? r.nodeId}`}>
                <Link to={r.kind === 'LESSON_VIEW' ? `/learn/${r.resourceId}` : `/topic/${r.nodeId}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-paper">
                  <span className="mt-0.5 shrink-0 text-ink-3">{r.kind === 'LESSON_VIEW' ? KIND.LESSON.icon : KIND.TOPIC.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] text-ink">{r.title ?? '(no longer available)'}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {r.kind === 'LESSON_VIEW' ? 'Lesson' : 'Topic'}
                      {r.paper ? `, ${r.paper}` : ''}, opened {new Date(r.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
