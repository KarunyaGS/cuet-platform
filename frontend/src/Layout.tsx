import { BookOpen, ChevronDown, CreditCard, FileText, GalleryVerticalEnd, GraduationCap, Highlighter, Megaphone, PencilLine, Search, ShieldCheck, Bookmark, CalendarCheck2, Info, CalendarDays, ChartNoAxesColumn, ClipboardCheck, House, LogOut, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { RemindersBell } from './reminders';
import { useAuth } from './ui';

const REVIEW_ROLES = ['REVIEWER', 'EDITOR', 'CONTENT_ADMIN', 'SUPER_ADMIN'];

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-[11px] font-bold tracking-wide text-white">
        CU
      </span>
      CUET Prep
    </span>
  );
}

/** Top-bar link: quiet text, with a short accent rule under the current page. */
function TopLink({ to, children, end, active }: { to: string; children: ReactNode; end?: boolean; active?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex h-14 items-center px-3 text-sm font-medium transition-colors ${
          (active ?? isActive) ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-ink-2 hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/** Phone tab bar item. */
function TabLink({ to, icon, label, end, active }: { to: string; icon: ReactNode; label: string; end?: boolean; active?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${(active ?? isActive) ? 'text-accent' : 'text-ink-3'}`}>
      <span aria-hidden className="[&>svg]:size-5">
        {icon}
      </span>
      {label}
    </NavLink>
  );
}

interface MenuItem { to: string; label: string; hint: string; icon: ReactNode }
/** Learn: the two examinations. Each opens its subjects, units, chapters and topics. */
const LEARN: MenuItem[] = [
  { to: '/CUET_UG', label: 'CUET UG', hint: 'Undergraduate: subjects, units and topics', icon: <BookOpen aria-hidden /> },
  { to: '/CUET_PG', label: 'CUET PG', hint: 'Postgraduate: subjects, units and topics', icon: <GraduationCap aria-hidden /> },
];
/** My Learning: everything that is the student's own. Each item opens a page that already exists. */
const MY: MenuItem[] = [
  { to: '/dashboard', label: 'Today', hint: 'What to do next, and what is due', icon: <CalendarCheck2 aria-hidden /> },
  { to: '/bookmarks', label: 'My Bookmarks', hint: 'Everything you saved', icon: <Bookmark aria-hidden /> },
  { to: '/bookmarks?tab=notes', label: 'Highlights and Notes', hint: 'What you marked in lessons and questions', icon: <Highlighter aria-hidden /> },
  { to: '/bookmarks/review', label: 'Revision Cards', hint: 'Revise the cards that are due', icon: <GalleryVerticalEnd aria-hidden /> },
  { to: '/planner', label: 'Study Planner', hint: 'Your plan, day by day', icon: <CalendarDays aria-hidden /> },
  { to: '/progress', label: 'Learning Progress', hint: 'Accuracy, coverage and weak topics', icon: <ChartNoAxesColumn aria-hidden /> },
];
const startsWithAny = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));
/** Which top-level group the current page belongs to, so the header can show where the student is. */
export const navGroup = (path: string): 'home' | 'learn' | 'practice' | 'my' | null =>
  path === '/' ? 'home'
    : startsWithAny(path, ['/CUET_UG', '/CUET_PG', '/topic', '/learn', '/revise', '/visual', '/search']) ? 'learn'
    : startsWithAny(path, ['/practice-centre', '/pyq', '/results', '/past-papers']) ? 'practice'
    : startsWithAny(path, ['/dashboard', '/bookmarks', '/planner', '/progress', '/report', '/flashcards']) ? 'my'
    : null;

/**
 * A menu in the navigation. In the top bar it drops down; in the phone's bottom bar (`up`) it opens upward as a sheet.
 * It closes on a choice, on Escape and on a tap outside, and its items can be reached with the arrow keys.
 */
function NavMenu({ label, items, active, up = false, icon }: { label: string; items: MenuItem[]; active: boolean; up?: boolean; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const links = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
        if (!links.length) return;
        e.preventDefault();
        const at = links.indexOf(document.activeElement as HTMLElement);
        links[(at + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]!.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const here = `${location.pathname}${location.search}`;
  return (
    <div ref={ref} className={up ? 'flex flex-1' : 'relative'} data-nav-menu={label}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          up
            ? `flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${active || open ? 'text-accent' : 'text-ink-3'}`
            : `relative flex h-14 items-center gap-1 px-3 text-sm font-medium transition-colors ${active ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-ink-2 hover:text-ink'}`
        }
      >
        {up && (
          <span aria-hidden className="[&>svg]:size-5">
            {icon}
          </span>
        )}
        {label}
        {!up && <ChevronDown aria-hidden className={`size-3.5 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div role="menu" aria-label={label} className={up ? 'absolute inset-x-0 bottom-full border-t border-rule bg-surface p-2 shadow-[0_-8px_24px_-12px_rgb(26_34_51/0.25)]' : 'absolute left-0 z-40 mt-0 w-72 rounded-xl border border-rule bg-surface p-1.5 shadow-lg shadow-ink/5'}>
          {items.map((it) => (
            <Link key={it.to} role="menuitem" to={it.to} aria-current={here === it.to ? 'page' : undefined} className={`flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-paper focus-visible:bg-paper ${here === it.to ? 'bg-accent-soft' : ''}`}>
              <span className="mt-0.5 shrink-0 text-accent [&>svg]:size-[18px]">{it.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{it.label}</span>
                <span className="block text-xs text-ink-3">{it.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
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
  if (!user) return null;
  const reviewer = user.roles.some((r) => REVIEW_ROLES.includes(r));
  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-paper [&>svg]:size-4 [&>svg]:text-ink-3';
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 text-sm text-ink-2 transition-colors hover:bg-ink/5 lg:pr-3"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials(user.displayName)}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium text-ink lg:inline">{user.displayName}</span>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-rule bg-surface p-1.5 shadow-lg shadow-ink/5">
          <div className="px-2.5 pt-1.5 pb-2.5">
            <div className="truncate text-sm font-semibold text-ink">{user.displayName}</div>
            <div className="truncate text-xs text-ink-3">{user.email}</div>
          </div>
          <div className="border-t border-rule pt-1.5">
            <Link role="menuitem" to="/profile" className={item}>
              <UserRound aria-hidden />
              Profile and goals
            </Link>
            <Link role="menuitem" to="/updates" className={item}>
              <Megaphone aria-hidden />
              Government updates
            </Link>
            <Link role="menuitem" to="/report" className={item}>
              <ChartNoAxesColumn aria-hidden />
              Weekly report
            </Link>
            <Link role="menuitem" to="/practice-centre" className={item}>
              <FileText aria-hidden />
              Practice Centre
            </Link>
            <Link role="menuitem" to="/plans" className={item}>
              <CreditCard aria-hidden />
              Plans and payments
            </Link>
            <Link role="menuitem" to="/cuet" className={item}>
              <Info aria-hidden />
              Official exam information
            </Link>
            {user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'CONTENT_ADMIN') && (
              <Link role="menuitem" to="/admin" className={item}>
                <ShieldCheck aria-hidden />
                Admin console
              </Link>
            )}
            {reviewer && (
              <Link role="menuitem" to="/review" className={item}>
                <ClipboardCheck aria-hidden />
                Review work
              </Link>
            )}
          </div>
          <div className="mt-1.5 border-t border-rule pt-1.5">
            <button role="menuitem" onClick={() => void signOut()} className={item}>
              <LogOut aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const path = location.pathname;
  // Tests run in focus mode: no app navigation, only the way out.
  const focus = path.startsWith('/practice/');
  const wide = path.startsWith('/review') || path.startsWith('/admin');
  const group = navGroup(path);
  // One page container for the whole app: wide enough to use a desktop screen, with the same gutters everywhere.
  const shell = wide ? 'max-w-[96rem]' : 'max-w-[84rem]';

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className={`mx-auto flex h-14 items-center gap-2 px-4 sm:px-6 lg:px-8 ${shell}`}>
          {focus ? (
            <>
              <Logo />
              <Link to="/dashboard" className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-ink/5 hover:text-ink" title="Your answers are saved. Resume this test from the Today page.">
                <X aria-hidden className="size-4" />
                Leave test
              </Link>
            </>
          ) : (
            <>
              <Link to="/" className="mr-4 rounded-lg" aria-label="CUET Prep home">
                <Logo />
              </Link>
              <nav className="hidden items-center md:flex" aria-label="Main">
                <TopLink to="/" end>
                  Home
                </TopLink>
                <NavMenu label="Learn" items={LEARN} active={group === 'learn'} />
                <TopLink to="/practice-centre" active={group === 'practice'}>
                  Practice
                </TopLink>
                <NavMenu label="My Learning" items={MY} active={group === 'my'} />
              </nav>
              <div className="ml-auto flex items-center gap-1">
                <NavLink
                  to="/search"
                  title="Search the syllabus"
                  className={({ isActive }) => `grid size-9 place-items-center rounded-full transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
                >
                  <Search aria-hidden className="size-[18px]" />
                  <span className="sr-only">Search the syllabus</span>
                </NavLink>
                <RemindersBell />
                <NavLink
                  to="/bookmarks"
                  title="My bookmarks"
                  className={({ isActive }) => `grid size-9 place-items-center rounded-full transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
                >
                  <Bookmark aria-hidden className="size-[18px]" />
                  <span className="sr-only">My bookmarks</span>
                </NavLink>
                <UserMenu />
              </div>
            </>
          )}
        </div>
      </header>

      <main id="main" key={path} className={`page-in mx-auto px-4 pt-5 pb-28 sm:px-6 md:pb-12 lg:px-8 ${shell}`}>
        <Outlet />
      </main>

      {!focus && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <TabLink to="/" end icon={<House />} label="Home" />
          <NavMenu up label="Learn" items={LEARN} active={group === 'learn'} icon={<BookOpen />} />
          <TabLink to="/practice-centre" icon={<PencilLine />} label="Practice" active={group === 'practice'} />
          <NavMenu up label="My Learning" items={MY} active={group === 'my'} icon={<UserRound />} />
        </nav>
      )}
    </div>
  );
}
