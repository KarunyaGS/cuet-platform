/**
 * Previous-year papers found on public websites. Year → subject → the papers that exist, each with a destination that
 * was checked to open. A paper whose own host allows it opens in the viewer here; every other paper opens on its
 * source's page. Third-party copies are labelled as such, never as NTA's originals. Dates, shifts and languages are
 * shown only where the source states them.
 */
import { ExternalLink, FileText, KeyRound, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, type PyqDoc } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, SearchInput, SectionTitle, Segmented, useLoad } from '../ui';
import { PdfViewer } from './OfficialViewer';

const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const SECTION: Record<string, string> = { LANGUAGE: 'Languages', DOMAIN: 'Domain subjects', GENERAL: 'General Test' };
const NOT_STATED = '(not stated)';

export function kindBadge(d: PyqDoc) {
  if (d.classification === 'OFFICIAL') return <Badge tone="green">NTA’s own file</Badge>;
  if (d.classification === 'MEMORY_BASED') return <Badge tone="amber">Memory-based, by {d.sourceSite}</Badge>;
  if (d.classification === 'SAMPLE') return <Badge>Sample paper, by {d.sourceSite}</Badge>;
  return <Badge tone="accent">Copy on {d.sourceSite}</Badge>;
}

/** The one action of a paper. It always opens the paper: in the viewer here when the file's host allows it, otherwise on the source's page. */
export function OpenPaper({ d, page, label, small = false }: { d: PyqDoc; page?: number | null; label?: string; small?: boolean }) {
  const cls = `inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent font-semibold text-white shadow-sm hover:bg-accent-strong ${small ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm'}`;
  const text = label ?? (d.kind === 'ANSWER_KEY' ? 'Open answer key' : 'Open paper');
  if (d.viewer === 'IN_APP')
    return (
      <Link to={`/pyq/view/${d.id}${page ? `?page=${page}` : ''}`} className={cls} data-open="in-app">
        <FileText aria-hidden className="size-4" />
        {text}
      </Link>
    );
  return (
    <a href={`${d.openUrl}${page ? `#page=${page}` : ''}`} target="_blank" rel="noreferrer noopener" className={cls} data-open="source" title={`Opens on ${d.sourceSite}`}>
      {text}
      <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

export function PaperRow({ d }: { d: PyqDoc }) {
  const facts = [d.examDate ? day(d.examDate) : null, d.shift, d.language, d.pages ? `${d.pages} pages` : null].filter(Boolean);
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5" data-paper={d.id}>
      <span className="min-w-0 flex-1 basis-64">
        <span className="flex flex-wrap items-center gap-2">
          {kindBadge(d)}
          {facts.length > 0 && <span className="num text-sm font-medium text-ink">{facts.join(' · ')}</span>}
        </span>
        <span className="mt-1 block text-[15px] text-ink">{d.title}</span>
        {d.note && <span className="mt-0.5 block text-xs text-ink-3">{d.note}</span>}
        <span className="mt-0.5 block text-xs text-ink-3">
          {d.viewer === 'IN_APP' ? `Shown here straight from ${d.sourceSite}’s server.` : `Opens on ${d.sourceSite}’s website in a new tab.`}{' '}
          {d.linkChecked ? `Checked on ${day(d.checkedOn)}.` : 'This link could not be checked automatically.'}{' '}
          <a href={d.sourcePageUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
            Where it is listed
          </a>
        </span>
      </span>
      <OpenPaper d={d} />
    </li>
  );
}

const selectClass = 'h-9 max-w-full rounded-lg border border-rule-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none';

/** A filter over the papers of one subject. Offered only when the papers differ in that respect. */
function Filter({ label, value, values, onChange, show }: { label: string; value: string; values: string[]; onChange: (v: string) => void; show: (v: string) => string }) {
  if (values.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label={label}>
        <option value="">All</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {show(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The paper browser: year, subject, then that subject's papers with filters for source, exam date, shift and language.
 * Used as the page /pyq and inside Practice Centre.
 */
export function PyqBrowser({ year: wantYear, subject: wantSubject, onPick }: { year?: number; subject?: string; onPick?: (year: number, subject: string | null) => void }) {
  const tree = useLoad(() => api.pyqTree('CUET_UG'), []);
  const [pick, setPick] = useState<{ year: number; slug: string }>({ year: wantYear ?? 0, slug: wantSubject ?? '' });
  useEffect(() => {
    if (wantYear !== undefined) setPick({ year: wantYear, slug: wantSubject ?? '' });
  }, [wantYear, wantSubject]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ source: '', date: '', shift: '', language: '' });
  const year = pick.year || tree.data?.years[0]?.year || 0;
  const slug = pick.slug;
  const subject = useLoad(() => (year && slug ? api.pyqSubject(year, slug) : Promise.resolve(null)), [year, slug]);
  const papers = subject.data?.papers ?? [];
  const values = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.map((x) => x ?? NOT_STATED))].sort((a, b) => Number(a === NOT_STATED) - Number(b === NOT_STATED) || a.localeCompare(b));
    return { source: uniq(papers.map((p) => p.sourceSite)), date: uniq(papers.map((p) => p.examDate)), shift: uniq(papers.map((p) => p.shift)), language: uniq(papers.map((p) => p.language)) };
  }, [papers]);
  if (tree.loading && !tree.data) return <Loading />;
  if (tree.error) return <ErrorBox error={tree.error} onRetry={tree.reload} />;
  const t = tree.data!;
  if (t.years.length === 0) return <Empty icon={<ScrollText />}>No previous-year papers have been indexed yet.</Empty>;
  const y = t.years.find((x) => x.year === year) ?? t.years[0]!;
  const shown = y.subjects.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const go = (nextYear: number, nextSlug: string | null) => {
    setPick({ year: nextYear, slug: nextSlug ?? '' });
    setF({ source: '', date: '', shift: '', language: '' });
    onPick?.(nextYear, nextSlug);
  };
  const match = (v: string | null, want: string) => !want || (v ?? NOT_STATED) === want;
  const visible = papers.filter((p) => match(p.sourceSite, f.source) && match(p.examDate, f.date) && match(p.shift, f.shift) && match(p.language, f.language));
  const filtering = Boolean(f.source || f.date || f.shift || f.language);
  return (
    <div data-pyq-browser>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label="Year of the papers" value={String(y.year)} onChange={(v) => go(Number(v), null)} options={t.years.map((x) => ({ value: String(x.year), label: `${x.year} (${x.papers})` }))} />
        <span className="text-sm text-ink-2">
          {y.papers} question papers in {y.subjects.length} subjects for {y.year}.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <section aria-labelledby="pyq-subjects">
          <SectionTitle id="pyq-subjects">Subjects with a paper, {y.year}</SectionTitle>
          <div className="mb-3">
            <SearchInput value={q} onChange={setQ} placeholder="Find a subject" label="Find a subject" />
          </div>
          {shown.length === 0 ? (
            <Empty>No subject matches “{q}”.</Empty>
          ) : (
            <div className="max-h-[34rem] overflow-y-auto rounded-xl border border-rule bg-surface">
              {(['LANGUAGE', 'DOMAIN', 'GENERAL'] as const).map((sec) => {
                const list = shown.filter((s) => (s.section ?? 'DOMAIN') === sec);
                if (!list.length) return null;
                return (
                  <div key={sec} className="border-t border-rule first:border-t-0">
                    <div className="bg-paper/70 px-4 py-1.5 text-xs font-semibold text-ink-2">{SECTION[sec]}</div>
                    <ul>
                      {list.map((s) => (
                        <li key={s.slug}>
                          <button type="button" data-subject={s.slug} onClick={() => go(y.year, s.slug)} aria-pressed={slug === s.slug} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-paper ${slug === s.slug ? 'bg-accent-soft font-semibold text-accent' : 'text-ink'}`}>
                            <span className="min-w-0 flex-1 truncate">{s.name}</span>
                            <span className="num text-sm text-ink-2">{s.papers}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="pyq-papers" className="min-w-0">
          {!slug ? (
            <Empty icon={<ScrollText />}>Choose a subject to see its {y.year} question papers. Each one has an “Open paper” button that opens the paper itself.</Empty>
          ) : subject.loading && !subject.data ? (
            <Loading />
          ) : subject.error ? (
            <ErrorBox error={subject.error} onRetry={subject.reload} />
          ) : subject.data ? (
            <>
              <SectionTitle id="pyq-papers">
                {subject.data.subject.name}, {subject.data.year}: question papers ({filtering ? `${visible.length} of ${papers.length}` : papers.length})
              </SectionTitle>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-pyq-filters>
                <Filter label="Source" value={f.source} values={values.source} onChange={(v) => setF({ ...f, source: v })} show={(v) => v} />
                <Filter label="Exam date" value={f.date} values={values.date} onChange={(v) => setF({ ...f, date: v })} show={(v) => (v === NOT_STATED ? 'Not stated' : day(v))} />
                <Filter label="Shift" value={f.shift} values={values.shift} onChange={(v) => setF({ ...f, shift: v })} show={(v) => (v === NOT_STATED ? 'Not stated' : v)} />
                <Filter label="Language" value={f.language} values={values.language} onChange={(v) => setF({ ...f, language: v })} show={(v) => (v === NOT_STATED ? 'Not stated' : v)} />
                {filtering && (
                  <button type="button" onClick={() => setF({ source: '', date: '', shift: '', language: '' })} className="text-sm font-medium text-accent hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
              {visible.length === 0 ? (
                <Empty>No paper matches these filters.</Empty>
              ) : (
                <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                  {visible.map((d) => (
                    <PaperRow key={d.id} d={d} />
                  ))}
                </ul>
              )}

              <div className="mt-8">
                <SectionTitle>
                  <span className="inline-flex items-center gap-2">
                    <KeyRound aria-hidden className="size-4 text-ink-3" />
                    Answer keys, {subject.data.year}
                  </span>
                </SectionTitle>
                {subject.data.answerKeys.length === 0 ? (
                  <Empty>No answer key was found for {subject.data.year}.</Empty>
                ) : (
                  <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                    {subject.data.answerKeys.map((k) => (
                      <li key={k.id} className="px-4 py-3.5" data-key={k.id}>
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                          <span className="min-w-0 flex-1 basis-64">
                            {kindBadge(k)}
                            <span className="mt-1 block text-[15px] text-ink">{k.title}</span>
                            {k.note && <span className="mt-0.5 block text-xs text-ink-3">{k.note}</span>}
                          </span>
                          <OpenPaper d={k} />
                        </div>
                        {k.sessions.length > 0 && (
                          <div className="mt-3">
                            <div className="mb-1.5 text-xs font-medium text-ink-2">
                              {subject.data!.subject.name} in this key: {k.sessions.length} {k.sessions.length === 1 ? 'session' : 'sessions'}. Open the key at a session’s page:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {k.sessions.map((s, i) => {
                                const text = [s.date ? day(s.date) : 'Date not stated', s.shift].filter(Boolean).join(', ');
                                const cls = 'num inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-xs text-ink ring-1 ring-rule hover:bg-accent-soft hover:text-accent';
                                return k.viewer === 'IN_APP' ? (
                                  <Link key={i} to={`/pyq/view/${k.id}?page=${s.page ?? 1}`} className={cls}>
                                    {text}
                                  </Link>
                                ) : (
                                  <a key={i} href={`${k.openUrl}#page=${s.page ?? 1}`} target="_blank" rel="noreferrer noopener" className={cls}>
                                    {text}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {subject.data.samplePapers.length > 0 && (
                <div className="mt-8">
                  <SectionTitle>Sample papers</SectionTitle>
                  <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                    {subject.data.samplePapers.map((d) => (
                      <PaperRow key={d.id} d={d} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function PyqPage() {
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || undefined;
  return (
    <div>
      <PageHeader
        title="Previous-year question papers"
        back={{ to: '/practice-centre', label: 'Practice Centre' }}
        subtitle="CUET (UG) 2024, 2025 and 2026. Every “Open paper” opens the paper itself. Only files on NTA’s website are NTA’s own; copies on other websites and memory-based papers are labelled."
      />
      <PyqBrowser
        year={year}
        subject={params.get('subject') ?? ''}
        onPick={(y, s) => {
          const p = new URLSearchParams({ year: String(y) });
          if (s) p.set('subject', s);
          setParams(p, { replace: true });
        }}
      />
    </div>
  );
}

/** One paper on its own page: in the viewer when its host allows that, and otherwise one button that opens it on its source. */
export function PyqViewerPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const doc = useLoad(() => api.pyqDocument(id), [id]);
  if (doc.loading && !doc.data) return <Loading />;
  if (doc.error) return <ErrorBox error={doc.error} onRetry={doc.reload} />;
  const d = doc.data!;
  const back = `/pyq?year=${d.year ?? ''}${d.subjectSlug ? `&subject=${d.subjectSlug}` : ''}`;
  return (
    <div>
      <PageHeader title={d.title} back={{ to: back, label: 'Previous-year papers' }} subtitle={[d.year ? `CUET (UG) ${d.year}` : 'CUET (UG)', d.subjectName, d.examDate ? day(d.examDate) : null, d.shift, d.language].filter(Boolean).join(' · ')} />
      <p className="-mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
        {kindBadge(d)}
        <span>
          Source: {d.sourceSite}. {d.note}
        </span>
      </p>
      {d.viewer === 'IN_APP' && d.fileUrl ? (
        <PdfViewer doc={{ fileUrl: d.fileUrl, viewer: 'DIRECT', originalUrl: d.openUrl }} startPage={Math.max(1, Number(params.get('page')) || 1)} site={d.sourceSite} />
      ) : (
        <div className="rounded-xl border border-rule bg-surface p-5">
          <p className="text-[15px] text-ink">
            {d.sourceSite}’s server does not let other websites display this file, so it opens on {d.sourceSite}’s own website.
          </p>
          <div className="mt-4">
            <OpenPaper d={d} label={`Open on ${d.sourceSite}`} />
          </div>
        </div>
      )}
    </div>
  );
}
