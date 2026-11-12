import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from './api';
import { useAuth } from './ui';

const nav = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1 text-sm font-medium ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`;

export function Layout() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
            <span className="grid size-6 place-items-center rounded bg-[var(--color-accent)] text-[11px] font-bold text-white">CU</span>
            CUET Prep
          </Link>
          <nav className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Main">
            <NavLink to="/CUET_UG" className={nav}>
              UG
            </NavLink>
            <NavLink to="/CUET_PG" className={nav}>
              PG
            </NavLink>
            {user && (
              <>
                <NavLink to="/dashboard" className={nav}>
                  Today
                </NavLink>
                <NavLink to="/planner" className={nav}>
                  Planner
                </NavLink>
                <NavLink to="/bookmarks" className={`${nav({ isActive: location.pathname === '/bookmarks' })} hidden sm:inline`}>
                  Bookmarks
                </NavLink>
              </>
            )}
            <NavLink to="/progress" className={(a) => `${nav(a)} hidden sm:inline`}>
              Progress
            </NavLink>
            {user?.roles.some((r) => ['REVIEWER', 'EDITOR', 'CONTENT_ADMIN', 'SUPER_ADMIN'].includes(r)) && (
              <NavLink to="/review" className={nav}>
                Review
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user ? (
              <>
                <Link to="/profile" className="hidden rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 sm:inline" title="My profile">
                  {user.displayName}
                </Link>
                <button
                  className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                  onClick={async () => {
                    await api.logout();
                    await refresh();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100">
                  Sign in
                </Link>
                <Link to="/signup" className="rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-5 ${location.pathname.startsWith('/review') ? 'max-w-[96rem]' : 'max-w-6xl'}`}>
        <Outlet />
      </main>
    </div>
  );
}
