/** Shared pieces of the public information pages: layout, page list, source labels and fact lists. */
import { ExternalLink, FileText, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import type { ExamCode, OfficialItem } from '../../api';
import { Logo } from '../../Layout';
import { buttonClass, useAuth } from '../../ui';

export const EXAMS: Record<'ug' | 'pg', { code: ExamCode; name: string; level: string; site: string; siteLabel: string }> = {
  ug: { code: 'CUET_UG', name: 'CUET-UG', level: 'Undergraduate', site: 'https://cuet.nta.nic.in/', siteLabel: 'cuet.nta.nic.in' },
  pg: { code: 'CUET_PG', name: 'CUET-PG', level: 'Postgraduate', site: 'https://exams.nta.nic.in/cuet-pg/', siteLabel: 'exams.nta.nic.in/cuet-pg' },
};
export const examSlug = (s: string | undefined) => (s === 'pg' ? 'pg' : s === 'ug' ? 'ug' : null);

/** The information pages for each exam, in reading order. `sections` are the data sections shown on the page. */
export const PAGES: { slug: string; title: string; short: string; sections: string[] }[] = [
  { slug: '', title: 'Overview', short: 'Overview', sections: ['about'] },
  { slug: 'eligibility', title: 'Eligibility', short: 'Eligibility', sections: ['eligibility'] },
  { slug: 'pattern', title: 'Exam pattern and subjects', short: 'Exam pattern', sections: ['pattern', 'subjects'] },
  { slug: 'dates', title: 'Important dates and notices', short: 'Dates and notices', sections: ['dates'] },
  { slug: 'apply', title: 'How to apply and fees', short: 'How to apply', sections: ['application', 'fees'] },
  { slug: 'admit-card', title: 'City slip and admit card', short: 'Admit card', sections: ['admit-card'] },
  { slug: 'exam-day', title: 'On exam day', short: 'Exam day', sections: ['exam-day'] },
  { slug: 'results', title: 'Answer key and results', short: 'Answer key and results', sections: ['answer-key', 'results'] },
  { slug: 'universities', title: 'Participating universities', short: 'Universities', sections: ['universities'] },
  { slug: 'faq', title: 'Frequently asked questions', short: 'FAQs', sections: [] },
  { slug: 'help', title: 'Help and contact', short: 'Help and contact', sections: ['contact'] },
];

/** Where a fact came from, in words a student understands. */
export function sourceLabel(url: string, page: number | null) {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'Source';
  }
  if (/\/Download\/Notice\//i.test(url) || host.endsWith('nta.ac.in')) return 'NTA public notice';
  if (/\.pdf($|\?)/i.test(url)) return `NTA document (PDF)${page ? `, page ${page}` : ''}`;
  if (host === 'cuet.nta.nic.in' || host === 'exams.nta.nic.in') return 'Official CUET website';
  return host;
}
export const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export function FactList({ items }: { items: OfficialItem[] }) {
  return (
    <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
      {items.map((it, i) => (
        <li key={i} className="px-5 py-4">
          <p className="text-[15px] leading-relaxed text-ink">{it.text}</p>
          {it.note && <p className="mt-1.5 border-l-2 border-marker/50 pl-3 text-sm text-ink-2">{it.note}</p>}
          {it.source && (
            <a href={it.source} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-accent">
              <FileText aria-hidden className="size-3.5" />
              {sourceLabel(it.source, it.page)}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Year and freshness, shown on every exam page. */
export function Freshness({ cycle, asOf, site, siteLabel }: { cycle: string; asOf: string; site: string; siteLabel: string }) {
  return (
    <p className="text-sm text-ink-2">
      {cycle} examination cycle. Sources last checked on {longDate(asOf)}. Always confirm on the official website,{' '}
      <a href={site} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
        {siteLabel}
      </a>
      .
    </p>
  );
}

function TopLink({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}>
      {children}
    </NavLink>
  );
}

/** Layout for the public information pages: readable without signing in. */
export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const nav = (
    <>
      <TopLink to="/cuet" end>
        About CUET
      </TopLink>
      <TopLink to="/cuet/ug">CUET-UG</TopLink>
      <TopLink to="/cuet/pg">CUET-PG</TopLink>
    </>
  );
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/cuet" aria-label="CUET Prep information home" className="mr-3">
            <Logo />
          </Link>
          <nav aria-label="Information" className="hidden items-center gap-1 md:flex">
            {nav}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link to="/" className={buttonClass('primary', 'sm')}>
                Open my dashboard
              </Link>
            ) : (
              <>
                <Link to="/signin" className={`${buttonClass('ghost', 'sm')} hidden sm:inline-flex`}>
                  Sign in
                </Link>
                <Link to="/signup" className={buttonClass('primary', 'sm')}>
                  Create account
                </Link>
              </>
            )}
            <button className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-ink/5 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav aria-label="Information" className="flex flex-col gap-1 border-t border-rule px-4 py-3 md:hidden">
            {nav}
            {!user && (
              <Link to="/signin" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-ink/5">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </header>
      <main id="main" key={location.pathname} className="page-in mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-2 sm:px-6">
          CUET Prep is an independent study platform, not the National Testing Agency. Exam information on these pages is taken from NTA’s official documents and notices, with a link
          to each source. NTA’s own websites always take precedence:{' '}
          <a href={EXAMS.ug.site} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {EXAMS.ug.siteLabel}
          </a>{' '}
          and{' '}
          <a href={EXAMS.pg.site} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {EXAMS.pg.siteLabel}
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
