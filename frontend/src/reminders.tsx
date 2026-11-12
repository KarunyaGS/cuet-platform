/** Header bell: reminders worked out from the student's own data (tests, plan, goal, weak topics, NTA notices). */
import { Bell, BookOpen, CalendarDays, ExternalLink, Megaphone, PlayCircle, Settings2, Target, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, type Reminder } from './api';

const ICON: Record<Reminder['kind'], React.ReactNode> = {
  TEST: <PlayCircle className="text-marker" />,
  PLAN: <CalendarDays className="text-accent" />,
  GOAL: <Target className="text-accent" />,
  REVISE: <BookOpen className="text-wrong" />,
  NOTICE: <Megaphone className="text-accent" />,
  SETUP: <Settings2 className="text-ink-3" />,
};

export function RemindersBell() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const load = useCallback(() => {
    api.reminders().then(setItems, () => undefined);
  }, []);
  useEffect(() => {
    load();
    setOpen(false);
  }, [location.pathname, load]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const dismiss = async (key: string) => {
    setItems((x) => x.filter((r) => r.key !== key));
    await api.dismissReminder(key).catch(load);
  };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Reminders"
        className={`relative grid size-9 place-items-center rounded-full transition-colors ${open ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
      >
        <Bell aria-hidden className="size-[18px]" />
        {items.length > 0 && (
          <span className="num absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-wrong px-1 text-[10px] leading-4 font-semibold text-white">{items.length}</span>
        )}
        <span className="sr-only">{items.length ? `${items.length} reminders` : 'No reminders'}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Reminders" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-rule bg-surface shadow-lg shadow-ink/5">
          <div className="border-b border-rule px-4 py-3 text-sm font-semibold text-ink">Reminders</div>
          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-2">You are all caught up.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-rule overflow-y-auto">
              {items.map((r) => {
                const body = (
                  <>
                    <span aria-hidden className="mt-0.5 shrink-0 [&>svg]:size-4">
                      {ICON[r.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{r.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{r.body}</span>
                    </span>
                    {r.external && <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />}
                  </>
                );
                return (
                  <li key={r.key} className="group flex items-start gap-1 pr-2 hover:bg-paper">
                    {r.external ? (
                      <a href={r.link} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4">
                        {body}
                      </a>
                    ) : (
                      <Link to={r.link} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4">
                        {body}
                      </Link>
                    )}
                    <button onClick={() => void dismiss(r.key)} className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label={`Dismiss: ${r.title}`}>
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
