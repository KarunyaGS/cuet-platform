/**
 * Previous-year papers found on public websites. Year → subject → the papers that exist, each with a destination that
 * was checked to open. A paper whose own host allows it opens in the viewer here; every other paper opens on its
 * source's page. Third-party copies are labelled as such, never as NTA's originals. Dates, shifts and languages are
 * shown only where the source states them.
 */
import { ChevronRight, ExternalLink, FileText, KeyRound, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, type PyqDoc } from '../api';
import { bareChapter, Badge, Empty, ErrorBox, Loading, PageHeader, SearchInput, SectionTitle, Segmented, useLoad } from '../ui';
import { PdfViewer } from './OfficialViewer';

const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const SECTION: Record<string, string> = { LANGUAGE: 'Languages', DOMAIN: 'Domain subjects', GENERAL: 'General Aptitude Test' };
const NOT_STATED = '(not stated)';

/**
 * Source names shown to students. AglaSem is not named on screen (owner's decision, 13 November 2026): its papers are
 * labelled as third-party copies, still never as NTA's own, and the link to where each is listed stays.
 */
const UNNAMED = new Set(['AglaSem']);
export const siteName = (site: string) => (UNNAMED.has(site) ? null : site);
const cleanNote = (note: string | null) => note?.replace(/AglaSem(’s|'s)/g, 'the source’s').replace(/(hosted|listed) by AglaSem/g, '$1 on another website').replace(/AglaSem/g, 'another website') ?? null;

export function kindBadge(d: PyqDoc) {
  if (d.classification === 'OFFICIAL' || d.classification === 'THIRD_PARTY_COPY') return null;
  const name = siteName(d.sourceSite);
  if (d.classification === 'CUET_PREP_ORIGINAL') return <Badge tone="accent">Prepora practice paper</Badge>;
  if (d.classification === 'MEMORY_BASED') return <Badge tone="amber">{name ? `Memory-based, by ${name}` : 'Memory-based'}</Badge>;
  return <Badge>{name ? `Sample paper, by ${name}` : 'Sample paper'}</Badge>;
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
    <a href={`${d.openUrl}${page ? `#page=${page}` : ''}`} target="_blank" rel="noreferrer noopener" className={cls} data-open="source" title={`Opens on ${siteName(d.sourceSite) ?? 'the source website'}`}>
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
        {d.note && !d.hosted && <span className="mt-0.5 block text-xs text-ink-3">{cleanNote(d.note)}</span>}
        <span className="mt-0.5 block text-xs text-ink-3">
          {d.native ? null : (
            <>
              {d.linkChecked ? `Checked on ${day(d.checkedOn)}.` : 'This link could not be checked automatically.'}{' '}
              <a href={d.sourcePageUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                Where it is listed
              </a>
            </>
          )}
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
export function PyqBrowser({ year: wantYear, subject: wantSubject, onPick, autoSelect = false }: { year?: number; subject?: string; onPick?: (year: number, subject: string | null) => void; autoSelect?: boolean }) {
  const tree = useLoad(() => api.pyqTree('CUET_UG'), []);
  const [pick, setPick] = useState<{ year: number; slug: string }>({ year: wantYear ?? 0, slug: wantSubject ?? '' });
  useEffect(() => {
    if (wantYear !== undefined) setPick({ year: wantYear, slug: wantSubject ?? '' });
  }, [wantYear, wantSubject]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ source: '', date: '', shift: '' });
  const year = pick.year || tree.data?.years[0]?.year || 0;
  // On the papers page the first subject is opened by default, so the page is never an empty pane beside the list.
  const slug = pick.slug || (autoSelect ? (tree.data?.years.find((x) => x.year === year)?.subjects[0]?.slug ?? '') : '');
  const subject = useLoad(() => (year && slug ? api.pyqSubject(year, slug) : Promise.resolve(null)), [year, slug]);
  const papers = subject.data?.papers ?? [];
  const values = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.map((x) => x ?? NOT_STATED))].sort((a, b) => Number(a === NOT_STATED) - Number(b === NOT_STATED) || a.localeCompare(b));
    return { source: uniq(papers.map((p) => p.sourceSite)), date: uniq(papers.map((p) => p.examDate)), shift: uniq(papers.map((p) => p.shift)) };
  }, [papers]);
  if (tree.loading && !tree.data) return <Loading />;
  if (tree.error) return <ErrorBox error={tree.error} onRetry={tree.reload} />;
  const t = tree.data!;
  if (t.years.length === 0) return <Empty icon={<ScrollText />}>No previous-year papers have been indexed yet.</Empty>;
  const y = t.years.find((x) => x.year === year) ?? t.years[0]!;
  const shown = y.subjects.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const go = (nextYear: number, nextSlug: string | null) => {
    setPick({ year: nextYear, slug: nextSlug ?? '' });
    setF({ source: '', date: '', shift: '' });
    onPick?.(nextYear, nextSlug);
  };
  const match = (v: string | null, want: string) => !want || (v ?? NOT_STATED) === want;
  const visible = papers.filter((p) => match(p.sourceSite, f.source) && match(p.examDate, f.date) && match(p.shift, f.shift));
  const filtering = Boolean(f.source || f.date || f.shift);
  return (
    <div data-pyq-browser>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label="Year of the papers" value={String(y.year)} onChange={(v) => go(Number(v), null)} options={t.years.map((x) => ({ value: String(x.year), label: `${x.year} (${x.papers})` }))} />
        <span className="text-sm text-ink-2">
          {y.papers} English-medium question {y.papers === 1 ? 'paper' : 'papers'} in {y.subjects.length} {y.subjects.length === 1 ? 'subject' : 'subjects'} for {y.year}.
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
            <Empty icon={<ScrollText />}>Choose a subject to see its {y.year} question papers. Only English-medium papers are listed. Each one has an “Open paper” button that opens the paper itself.</Empty>
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
                <Filter label="Source" value={f.source} values={values.source} onChange={(v) => setF({ ...f, source: v })} show={(v) => siteName(v) ?? 'Other website'} />
                <Filter label="Exam date" value={f.date} values={values.date} onChange={(v) => setF({ ...f, date: v })} show={(v) => (v === NOT_STATED ? 'Not stated' : day(v))} />
                <Filter label="Shift" value={f.shift} values={values.shift} onChange={(v) => setF({ ...f, shift: v })} show={(v) => (v === NOT_STATED ? 'Not stated' : v)} />
                {filtering && (
                  <button type="button" onClick={() => setF({ source: '', date: '', shift: '' })} className="text-sm font-medium text-accent hover:underline">
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
                            {k.note && <span className="mt-0.5 block text-xs text-ink-3">{cleanNote(k.note)}</span>}
                          </span>
                          <OpenPaper d={k} />
                        </div>
                        {k.sessions.length > 0 && (
                          <div className="mt-3">
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

              {subject.data.practicePapers.length > 0 && (
                <div className="mt-8" data-practice-papers>
                  <SectionTitle>Prepora practice papers</SectionTitle>
                  <p className="mb-2 text-sm text-ink-2">Written by Prepora for this subject. They are not previous-year papers. Each opens here and can be downloaded.</p>
                  <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                    {subject.data.practicePapers.map((d) => (
                      <PaperRow key={d.id} d={d} />
                    ))}
                  </ul>
                </div>
              )}

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

/**
 * What the sidebar's Subject → Previous Year Question Paper → year selects: that subject's papers for that year, and its answer keys,
 * and nothing else (no year tabs, no list of other subjects). Everything comes from the same paper index the browser uses.
 */
function PyqSelection({ year, slug }: { year: number; slug: string }) {
  const data = useLoad(() => api.pyqSubject(year, slug), [year, slug]);
  const subjects = useLoad(() => api.subjects('CUET_UG', 2026), []);
  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const d = data.data!;
  const paper = subjects.data?.find((x) => x.code === d.subject.code);
  const papers = d.papers;
  return (
    <div data-pyq-selection>
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link to="/CUET_UG" className="hover:text-accent">
          CUET UG
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        {paper ? (
          <Link to={`/CUET_UG/subject/${paper.paperId}`} className="hover:text-accent">
            {d.subject.name}
          </Link>
        ) : (
          <span>{d.subject.name}</span>
        )}
        <ChevronRight aria-hidden className="size-3.5" />
        <span>Previous Year Question Papers</span>
        <ChevronRight aria-hidden className="size-3.5" />
        <span aria-current="page" className="font-medium text-ink-2">
          {d.year}
        </span>
      </nav>
      <header className="mb-4 border-b border-rule pb-2.5">
        <h1 className="text-lg leading-snug font-semibold break-words text-ink sm:text-xl">
          {d.subject.name} – Previous Year Question Papers ({d.year})
        </h1>
      </header>

      <section aria-labelledby="pyq-papers" className="mb-6">
        <SectionTitle id="pyq-papers">Question papers ({papers.length})</SectionTitle>
        {papers.length === 0 ? (
          <Empty icon={<ScrollText />}>
            No question paper is listed for {d.subject.name} in {d.year}.
          </Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {papers.map((p) => {
              const facts = [p.examDate ? day(p.examDate) : null, p.shift, p.language].filter(Boolean);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-paper={p.id}>
                  <span className="min-w-0 flex-1 basis-64">
                    <span className="block text-[15px] leading-snug font-medium text-ink">{p.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                      {facts.length > 0 && <span className="num">{facts.join(' · ')}</span>}
                      {kindBadge(p)}
                      
                    </span>
                  </span>
                  <OpenPaper d={p} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="pyq-keys">
        <SectionTitle id="pyq-keys">
          <span className="inline-flex items-center gap-2">
            <KeyRound aria-hidden className="size-4 text-ink-3" />
            Answer keys ({d.answerKeys.length})
          </span>
        </SectionTitle>
        {d.answerKeys.length === 0 ? (
          <Empty>
            No answer key is listed for {d.subject.name} in {d.year}.
          </Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {d.answerKeys.map((k) => (
              <li key={k.id} className="px-4 py-3" data-key={k.id}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-0 flex-1 basis-64">
                    <span className="block text-[15px] leading-snug font-medium text-ink">{k.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">{kindBadge(k)}</span>
                  </span>
                  <OpenPaper d={k} />
                </div>
                {k.sessions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {k.sessions.map((x, i) => {
                      const text = [x.date ? day(x.date) : 'Date not stated', x.shift].filter(Boolean).join(', ');
                      const cls = 'num inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-xs text-ink ring-1 ring-rule hover:bg-accent-soft hover:text-accent';
                      return k.viewer === 'IN_APP' ? (
                        <Link key={i} to={`/pyq/view/${k.id}?page=${x.page ?? 1}`} className={cls}>
                          {text}
                        </Link>
                      ) : (
                        <a key={i} href={`${k.openUrl}#page=${x.page ?? 1}`} target="_blank" rel="noreferrer noopener" className={cls}>
                          {text}
                        </a>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PyqPage() {
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || undefined;
  const slug = params.get('subject') ?? '';
  // A year and a subject (what the sidebar links to) show exactly that selection; without them the full browser stays available.
  if (year && slug) return <PyqSelection year={year} slug={slug} />;
  return (
    <div>
      <PageHeader
        title="Previous-year question papers"
        back={{ to: '/practice-centre', label: 'Practice Centre' }}
        subtitle="CUET (UG) previous-year question papers and answer keys. NTA’s own files and the copies we have permission to host open in the viewer and can be downloaded here. Copies are labelled with their source; any copy we do not host opens on its source."
      />
      <PyqBrowser
        autoSelect
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
  const back = d.year ? `/pyq?year=${d.year}${d.subjectSlug ? `&subject=${d.subjectSlug}` : ''}` : '/practice-centre';
  const isBank = /question bank: /i.test(d.title);
  return (
    <div>
      {isBank ? (
        <PageHeader title={bareChapter(d.title.replace(/^.*?question bank: [^,]*, /i, ''))} subtitle={[d.subjectName, 'Chapter-wise Question Bank'].filter(Boolean).join(' · ')} />
      ) : (
        <PageHeader title={d.title} back={{ to: back, label: 'Previous-year papers' }} subtitle={[d.native ? 'For CUET (UG)' : d.year ? `CUET (UG) ${d.year}` : 'CUET (UG)', d.subjectName, d.examDate ? day(d.examDate) : null, d.shift, d.language].filter(Boolean).join(' · ')} />
      )}
      {d.viewer === 'IN_APP' && d.fileUrl ? (
        <PdfViewer doc={{ fileUrl: d.fileUrl, viewer: 'DIRECT', originalUrl: d.openUrl }} startPage={Math.max(1, Number(params.get('page')) || 1)} site={siteName(d.sourceSite) ?? 'the source'} downloadUrl={d.downloadUrl} />
      ) : (
        <div className="rounded-xl border border-rule bg-surface p-5">
          <p className="text-[15px] text-ink">
            {siteName(d.sourceSite) ? `${siteName(d.sourceSite)}’s server does not let other websites display this file, so it opens on ${siteName(d.sourceSite)}’s own website.` : 'The website that holds this file does not let other websites display it, so it opens there.'}
          </p>
          <div className="mt-4">
            <OpenPaper d={d} label={siteName(d.sourceSite) ? `Open on ${siteName(d.sourceSite)}` : 'Open paper'} />
          </div>
        </div>
      )}
    </div>
  );
}
