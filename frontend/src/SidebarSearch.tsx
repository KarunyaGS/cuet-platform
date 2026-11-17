/** A small search box at the top of the sidebar. Typing replaces the subject list with matching subjects, topics and lesson concepts. */
import { Lightbulb, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type SearchResults } from './api';

const CONCEPT: Record<string, string> = { DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Fact', CONCEPT: 'Concept' };
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function SidebarSearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim().length >= 2) onSubmit();
      }}
      className="relative"
    >
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search subjects, topics, concepts"
        aria-label="Search the syllabus"
        data-sidebar-search
        className="h-8 w-full rounded-lg border border-rule bg-paper pr-7 pl-8 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-3 hover:bg-ink/5 hover:text-ink">
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </form>
  );
}

/** The matches, shown in place of the subject list while the student is searching. Each result is one compact row. */
export function SidebarSearchResults({ query, onPick }: { query: string; onPick: () => void }) {
  const navigate = useNavigate();
  const [state, setState] = useState<{ data: SearchResults | null; loading: boolean; error: boolean }>({ data: null, loading: false, error: false });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    const t = setTimeout(() => {
      api.search(query, 'CUET_UG').then(
        (data) => live && setState({ data, loading: false, error: false }),
        () => live && setState({ data: null, loading: false, error: true }),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);
  const d = state.data;
  const none = d && !d.subjects.length && !d.topics.length && !d.concepts.length;
  const row = 'group flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors hover:bg-ink/[0.04]';
  const head = 'px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase';
  return (
    <div data-sidebar-results aria-live="polite">
      {state.loading && !d && <p className="px-2.5 py-2 text-xs text-ink-3">Searching…</p>}
      {state.error && <p className="px-2.5 py-2 text-xs text-wrong">Search is not available right now.</p>}
      {none && <p className="px-2.5 py-2 text-xs text-ink-2">Nothing matches “{query}”. Try fewer or shorter words.</p>}
      {d && d.subjects.length > 0 && (
        <section>
          <h3 className={head}>Subjects</h3>
          <ul>
            {d.subjects.slice(0, 4).map((s) => (
              <li key={s.paperId}>
                <Link to={`/${s.exam}/subject/${s.paperId}`} onClick={onPick} className={row}>
                  <span className="min-w-0 flex-1 truncate text-ink group-hover:text-accent">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d && d.topics.length > 0 && (
        <section>
          <h3 className={head}>Topics</h3>
          <ul>
            {d.topics.slice(0, 7).map((t) => (
              <li key={t.id}>
                <Link to={`/topic/${t.id}`} onClick={onPick} className={row} data-search-topic={t.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink group-hover:text-accent">{clip(t.title.split(':')[0]!, 60)}</span>
                    <span className="block truncate text-[11px] text-ink-3">{t.paper}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d && d.concepts.length > 0 && (
        <section>
          <h3 className={head}>In lessons</h3>
          <ul>
            {d.concepts.slice(0, 5).map((c) => (
              <li key={c.key}>
                <Link to={`/learn/${c.resourceId}#${c.anchor}`} onClick={onPick} className={row}>
                  <Lightbulb aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink group-hover:text-accent">{clip(c.title, 60)}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {CONCEPT[c.type] ?? c.type} · {c.paper}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d && !none && (
        <button
          type="button"
          onClick={() => {
            onPick();
            navigate(`/search?q=${encodeURIComponent(query)}`);
          }}
          className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-accent hover:bg-accent-soft"
        >
          See all results
        </button>
      )}
    </div>
  );
}
