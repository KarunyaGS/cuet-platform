/**
 * Previous-year papers found on public websites. Year → subject → the papers that exist, each with a destination that
 * was checked to open. A paper whose own host allows it opens in the viewer here; every other paper opens on its
 * source's page. Third-party copies are labelled as such, never as NTA's originals. Dates, shifts and languages are
 * shown only where the source states them.
 */
import { ExternalLink, FileText, KeyRound, ScrollText } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, type PyqDoc } from '../api';
import { Badge, Empty, ErrorBox, Loading, PageHeader, SearchInput, SectionTitle, Segmented, useLoad } from '../ui';
import { PdfViewer } from './OfficialViewer';
import { useState } from 'react';

const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const SECTION: Record<string, string> = { LANGUAGE: 'Languages', DOMAIN: 'Domain subjects', GENERAL: 'General Test' };

function kindBadge(d: PyqDoc) {
  if (d.classification === 'OFFICIAL') return <Badge tone="green">NTA’s own file</Badge>;
  if (d.classification === 'MEMORY_BASED') return <Badge tone="amber">Memory-based, by {d.sourceSite}</Badge>;
  if (d.classification === 'SAMPLE') return <Badge>Sample paper, by {d.sourceSite}</Badge>;
  return <Badge tone="accent">Copy on {d.sourceSite}</Badge>;
}

/** The one action of a paper. It always opens the paper: in the viewer here when the file's host allows it, otherwise on the source's page. */
export function OpenPaper({ d, page, label }: { d: PyqDoc; page?: number | null; label?: string }) {
  const cls = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong';
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

function PaperRow({ d }: { d: PyqDoc }) {
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

export function PyqPage() {
  const [params, setParams] = useSearchParams();
  const tree = useLoad(() => api.pyqTree('CUET_UG'), []);
  const [q, setQ] = useState('');
  const year = Number(params.get('year')) || tree.data?.years[0]?.year || 0;
  const slug = params.get('subject') ?? '';
  const subject = useLoad(() => (year && slug ? api.pyqSubject(year, slug) : Promise.resolve(null)), [year, slug]);
  if (tree.loading && !tree.data) return <Loading />;
  if (tree.error) return <ErrorBox error={tree.error} onRetry={tree.reload} />;
  const t = tree.data!;
  if (t.years.length === 0)
    return (
      <div>
        <PageHeader title="Previous-year papers" back={{ to: '/practice-centre', label: 'Practice Centre' }} />
        <Empty icon={<ScrollText />}>No previous-year papers have been indexed yet.</Empty>
      </div>
    );
  const y = t.years.find((x) => x.year === year) ?? t.years[0]!;
  const shown = y.subjects.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (next: { year?: number; subject?: string | null }) => {
    const p = new URLSearchParams();
    p.set('year', String(next.year ?? y.year));
    if (next.subject) p.set('subject', next.subject);
    setParams(p, { replace: true });
  };
  return (
    <div>
      <PageHeader
        title="Previous-year papers"
        back={{ to: '/practice-centre', label: 'Practice Centre' }}
        subtitle={`CUET (UG) papers found on public websites: ${t.total} documents. Every “Open” opens the paper itself. Only NTA’s own files are official; copies and memory-based papers are labelled.`}
      />
      <div className="mb-6">
        <Segmented label="Year" value={String(y.year)} onChange={(v) => pick({ year: Number(v), subject: null })} options={t.years.map((x) => ({ value: String(x.year), label: `${x.year} (${x.papers})` }))} />
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
            <div className="overflow-hidden rounded-xl border border-rule bg-surface">
              {(['LANGUAGE', 'DOMAIN', 'GENERAL'] as const).map((sec) => {
                const list = shown.filter((s) => (s.section ?? 'DOMAIN') === sec);
                if (!list.length) return null;
                return (
                  <div key={sec} className="border-t border-rule first:border-t-0">
                    <div className="bg-paper/70 px-4 py-1.5 text-xs font-semibold text-ink-2">{SECTION[sec]}</div>
                    <ul>
                      {list.map((s) => (
                        <li key={s.slug}>
                          <button type="button" onClick={() => pick({ subject: s.slug })} aria-pressed={slug === s.slug} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-paper ${slug === s.slug ? 'bg-accent-soft font-semibold text-accent' : 'text-ink'}`}>
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
            <Empty icon={<ScrollText />}>Choose a subject to see its {y.year} papers. Only subjects that have at least one paper are listed.</Empty>
          ) : subject.loading && !subject.data ? (
            <Loading />
          ) : subject.error ? (
            <ErrorBox error={subject.error} onRetry={subject.reload} />
          ) : subject.data ? (
            <>
              <SectionTitle id="pyq-papers">
                {subject.data.subject.name}, {subject.data.year}: question papers ({subject.data.papers.length})
              </SectionTitle>
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
                {subject.data.papers.map((d) => (
                  <PaperRow key={d.id} d={d} />
                ))}
              </ul>

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
