import { CreditCard, FileText, GalleryVerticalEnd, Megaphone, Search, ShieldCheck, Bookmark, CalendarCheck2, Info, CalendarDays, ChartNoAxesColumn, ClipboardCheck, House, LogOut, UserRound, X } from 'lucide-react';
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
function TopLink({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex h-14 items-center px-3 text-sm font-medium transition-colors ${
          isActive ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-ink-2 hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/** Phone tab bar item. */
function TabLink({ to, icon, label, end }: { to: string; icon: ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-ink-3'}`}
    >
      <span aria-hidden className="[&>svg]:size-5">
        {icon}
      </span>
      {label}
    </NavLink>
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
            <Link role="menuitem" to="/bookmarks" className={item}>
              <Bookmark aria-hidden />
              Bookmarks
            </Link>
            <Link role="menuitem" to="/updates" className={item}>
              <Megaphone aria-hidden />
              Government updates
            </Link>
            <Link role="menuitem" to="/flashcards" className={item}>
              <GalleryVerticalEnd aria-hidden />
              My flashcards
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

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className={`mx-auto flex h-14 items-center gap-2 px-4 sm:px-6 ${wide ? 'max-w-[96rem]' : 'max-w-6xl'}`}>
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
                <TopLink to="/dashboard">Today</TopLink>
                <TopLink to="/CUET_UG">CUET-UG</TopLink>
                <TopLink to="/CUET_PG">CUET-PG</TopLink>
                <TopLink to="/practice-centre">Practice</TopLink>
                <span className="hidden lg:contents">
                  <TopLink to="/flashcards">Flashcards</TopLink>
                </span>
                <TopLink to="/planner">Planner</TopLink>
                <TopLink to="/progress">Progress</TopLink>
                <span className="hidden 2xl:contents">
                  <TopLink to="/updates">Updates</TopLink>
                </span>
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
                <NavLink
                  to="/updates"
                  title="Latest government updates"
                  className={({ isActive }) => `grid size-9 place-items-center rounded-full transition-colors 2xl:hidden ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
                >
                  <Megaphone aria-hidden className="size-[18px]" />
                  <span className="sr-only">Latest government updates</span>
                </NavLink>
                <RemindersBell />
                <NavLink
                  to="/bookmarks"
                  title="Bookmarks"
                  className={({ isActive }) => `hidden size-9 place-items-center rounded-full transition-colors md:grid ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
                >
                  <Bookmark aria-hidden className="size-[18px]" />
                  <span className="sr-only">Bookmarks</span>
                </NavLink>
                <UserMenu />
              </div>
            </>
          )}
        </div>
      </header>

      <main id="main" key={path} className={`page-in mx-auto px-4 pt-6 pb-28 sm:px-6 md:pb-12 ${wide ? 'max-w-[96rem]' : 'max-w-6xl'}`}>
        <Outlet />
      </main>

      {!focus && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <TabLink to="/" end icon={<House />} label="Home" />
          <TabLink to="/dashboard" icon={<CalendarCheck2 />} label="Today" />
          <TabLink to="/planner" icon={<CalendarDays />} label="Planner" />
          <TabLink to="/bookmarks" icon={<Bookmark />} label="Saved" />
          <TabLink to="/progress" icon={<ChartNoAxesColumn />} label="Progress" />
        </nav>
      )}
    </div>
  );
}
