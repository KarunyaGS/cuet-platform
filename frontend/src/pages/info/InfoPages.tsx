import { Bell, ChevronDown, ChevronRight, CircleAlert, ExternalLink, GraduationCap, Library, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import { api, type OfficialInfo } from '../../api';
import { Empty, ErrorBox, Loading, SearchInput, SectionTitle, useLoad } from '../../ui';
import { EXAMS, examSlug, FactList, Freshness, PAGES, sourceLabel } from './shared';

const section = (d: OfficialInfo, key: string) => d.sections.find((s) => s.key === key);

/** /cuet: what CUET-UG is, and the latest official notices. */
export function InfoHub() {
  const ug = useLoad(() => api.officialInfo('CUET_UG'), []);
  const notices = [...(ug.data?.notices.map((n) => ({ ...n, exam: 'CUET-UG' })) ?? [])]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 6);
  return (
    <div>
      <header className="mb-10 max-w-3xl">
        <h1 className="text-[2rem] leading-tight font-semibold text-ink">About CUET</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2">
          The Common University Entrance Test is conducted by the National Testing Agency (NTA). This section covers CUET-UG, the exam for undergraduate admission. Everything below is taken from NTA’s official documents and notices, with a link to each source.
        </p>
      </header>
      <div className="mb-12 grid grid-cols-1 gap-5">
        {(['ug'] as const).map((k) => {
          const d = ug;
          const e = EXAMS[k];
          return (
            <section key={k} className="flex flex-col rounded-xl border border-rule bg-surface p-6" aria-labelledby={`hub-${k}`}>
              <div className="flex items-start gap-3.5">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  {k === 'ug' ? <Library className="size-5" /> : <GraduationCap className="size-5" />}
                </span>
                <div>
                  <h2 id={`hub-${k}`} className="text-xl font-semibold text-ink">
                    {e.name}
                  </h2>
                  <div className="text-sm text-ink-3">
                    {e.level} admissions{d.data ? `, ${d.data.cycle} cycle` : ''}
                  </div>
                </div>
              </div>
              {d.loading && <Loading />}
              {d.error && <ErrorBox error={d.error} onRetry={d.reload} />}
              {d.data && (
                <>
                  <ul className="mt-5 space-y-3">
                    {(section(d.data, 'about')?.items ?? []).slice(0, 3).map((it, i) => (
                      <li key={i} className="text-[15px] leading-relaxed text-ink">
                        {it.text}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-rule pt-4 text-sm">
                    {PAGES.slice(1).map((p) => (
                      <Link key={p.slug} to={`/cuet/${k}/${p.slug}`} className="flex items-center gap-1 py-1 text-ink-2 hover:text-accent">
                        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                        {p.short}
                      </Link>
                    ))}
                  </div>
                  <Link to={`/cuet/${k}`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                    All {e.name} information
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </>
              )}
            </section>
          );
        })}
      </div>
      <section aria-labelledby="latest">
        <SectionTitle id="latest">Latest official notices</SectionTitle>
        {notices.length === 0 ? (
          ug.loading ? <Loading /> : <Empty icon={<Bell />}>No notices recorded yet.</Empty>
        ) : (
          <NoticeList notices={notices} />
        )}
      </section>
    </div>
  );
}

function NoticeList({ notices }: { notices: { date: string | null; title: string; url: string; exam?: string }[] }) {
  return (
    <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
      {notices.map((n) => (
        <li key={n.url}>
          <a href={n.url} target="_blank" rel="noreferrer" className="group flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-paper">
            <span className="num w-24 shrink-0 pt-0.5 text-sm text-ink-3">{n.date ? new Date(`${n.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Undated'}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink group-hover:text-accent">{n.title}</span>
              {n.exam && <span className="text-xs text-ink-3">{n.exam}</span>}
            </span>
            <ExternalLink aria-hidden className="mt-1 size-4 shrink-0 text-ink-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

const FAQ: { q: string; key: string; page: string }[] = [
  { q: 'Who can take the exam?', key: 'eligibility', page: 'eligibility' },
  { q: 'How many questions are there, and how is it marked?', key: 'pattern', page: 'pattern' },
  { q: 'Which subjects can I choose?', key: 'subjects', page: 'pattern' },
  { q: 'How do I apply?', key: 'application', page: 'apply' },
  { q: 'How much is the application fee?', key: 'fees', page: 'apply' },
  { q: 'When is the exam?', key: 'dates', page: 'dates' },
  { q: 'When and how do I get my admit card?', key: 'admit-card', page: 'admit-card' },
  { q: 'What should I carry and expect on exam day?', key: 'exam-day', page: 'exam-day' },
  { q: 'How can I challenge the answer key?', key: 'answer-key', page: 'results' },
  { q: 'How are results and scores published?', key: 'results', page: 'results' },
  { q: 'Which universities use the scores?', key: 'universities', page: 'universities' },
  { q: 'Whom can I contact for help?', key: 'contact', page: 'help' },
];

/** /cuet/ug and /cuet/pg, and each information page under them. */
export function ExamInfo() {
  const { exam, page = '' } = useParams();
  const k = examSlug(exam);
  if (exam === 'pg') return <Navigate to={`/cuet/ug${page ? `/${page}` : ''}`} replace />;
  const code = k ? EXAMS[k].code : 'CUET_UG';
  const d = useLoad(() => api.officialInfo(code), [code]);
  if (!k) return <Navigate to="/cuet" replace />;
  const meta = PAGES.find((p) => p.slug === page);
  if (!meta) return <Navigate to={`/cuet/${k}`} replace />;
  const e = EXAMS[k];
  const gaps = d.data && section(d.data, 'not-yet-published');

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label={`${e.name} information`} className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex items-center gap-2 px-3">
          <span className="text-base font-semibold text-ink">{e.name}</span>
        </div>
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible">
          {PAGES.map((p) => (
            <li key={p.slug} className="shrink-0">
              <NavLink
                to={`/cuet/${k}${p.slug ? `/${p.slug}` : ''}`}
                end
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors lg:whitespace-normal ${isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`
                }
              >
                {p.short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 flex-1">
        <header className="mb-8">
          <div className="text-sm text-ink-3">{e.name}</div>
          <h1 className="text-[1.75rem] leading-tight font-semibold text-ink">{meta.slug ? meta.title : `${e.name} ${d.data?.cycle ?? ''}`.trim()}</h1>
          <div className="mt-2">{d.data && <Freshness cycle={d.data.cycle} asOf={d.data.asOf} site={e.site} siteLabel={e.siteLabel} />}</div>
        </header>
        {d.loading && <Loading />}
        {d.error && <ErrorBox error={d.error} onRetry={d.reload} />}
        {d.data && (
          <div className="space-y-10">
            {meta.slug === 'faq' ? (
              <Faq d={d.data} k={k} />
            ) : (
              meta.sections.map((key) => {
                const s = section(d.data!, key);
                if (!s) return null;
                if (meta.slug === 'universities') return (
                  <details key={key} className="group mb-5 overflow-hidden rounded-2xl border border-rule bg-surface">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-forest marker:hidden hover:bg-paper sm:px-5">
                      <span>About NTA’s university list</span><span className="text-xs font-medium text-ink-3">{s.items.length} source notes <ChevronDown aria-hidden className="ml-1 inline size-4 transition-transform group-open:rotate-180" /></span>
                    </summary>
                    <div className="border-t border-rule p-3 sm:p-4"><FactList items={s.items} /></div>
                  </details>
                );
                return <section key={key} aria-labelledby={`s-${key}`}>{(meta.sections.length > 1 || meta.slug === '') && <SectionTitle id={`s-${key}`}>{s.title}</SectionTitle>}<FactList items={s.items} /></section>;
              })
            )}

            {meta.slug === '' && (
              <section aria-labelledby="pages">
                <SectionTitle id="pages">Everything about {e.name}</SectionTitle>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PAGES.slice(1).map((p) => (
                    <li key={p.slug}>
                      <Link to={`/cuet/${k}/${p.slug}`} className="group flex items-center justify-between rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] text-ink transition-colors hover:border-accent/50">
                        <span className="group-hover:text-accent">{p.title}</span>
                        <ChevronRight aria-hidden className="size-4 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(meta.slug === 'dates' || meta.slug === '') && (
              <section aria-labelledby="notices">
                <SectionTitle id="notices">{meta.slug === '' ? 'Latest notices' : 'Official notices'}</SectionTitle>
                {d.data.notices.length ? <NoticeList notices={meta.slug === '' ? d.data.notices.slice(0, 5) : d.data.notices} /> : <Empty icon={<Bell />}>No notices recorded yet.</Empty>}
                {meta.slug === '' && d.data.notices.length > 5 && (
                  <Link to={`/cuet/${k}/dates`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    All {d.data.notices.length} notices
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                )}
              </section>
            )}

            {(meta.slug === 'dates' || meta.slug === '') && gaps && gaps.items.length > 0 && (
              <section aria-labelledby="gaps" className="rounded-xl border border-marker/30 bg-marker-soft p-5">
                <h2 id="gaps" className="flex items-center gap-2 text-base font-semibold text-marker">
                  <CircleAlert aria-hidden className="size-5" />
                  {gaps.title}
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
                  {gaps.items.map((it, i) => (
                    <li key={i}>{it.text}</li>
                  ))}
                </ul>
              </section>
            )}

            {meta.slug === 'universities' && <UniversityBrowser k={k} />}
          </div>
        )}
      </article>
    </div>
  );
}

function Faq({ d, k }: { d: OfficialInfo; k: 'ug' | 'pg' }) {
  return (
    <section aria-label="Questions">
      <p className="mb-5 text-[15px] text-ink-2">Common questions, answered with NTA’s own statements. Each answer links to its source and to the full page.</p>
      <div className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
        {FAQ.map((f) => {
          const s = section(d, f.key);
          if (!s || !s.items.length) return null;
          return (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-ink hover:bg-paper [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 px-5 pb-5">
                {s.items.slice(0, 4).map((it, i) => (
                  <div key={i}>
                    <p className="text-[15px] leading-relaxed text-ink">{it.text}</p>
                    {it.source && (
                      <a href={it.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-accent">
                        {sourceLabel(it.source, it.page)}
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    )}
                  </div>
                ))}
                <Link to={`/cuet/${k}/${f.page}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  Read the full page
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** Search and filter the participating universities, exactly as NTA lists them. */
function UniversityBrowser({ k }: { k: 'ug' | 'pg' }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [visible, setVisible] = useState(24);
  const list = useLoad(() => api.universities(EXAMS[k].code, q || undefined, type || undefined), [k, q, type]);
  const all = list.data?.total ?? 0;
  const filtered = list.data?.universities ?? [];
  const activeTypeCount = type ? list.data?.types.find((item) => item.type === type)?.count ?? 0 : all;
  return (
    <section aria-labelledby="uni-list" className="overflow-hidden rounded-[24px] border border-[#dce5b5] bg-surface shadow-[0_16px_38px_-30px_rgb(24_68_59/0.38)]" data-university-browser>
      <div className="relative overflow-hidden bg-gradient-to-br from-forest via-[#245548] to-[#456b51] px-5 py-5 text-white sm:px-6 sm:py-6">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-24 size-56 rounded-full border border-white/10 bg-white/[0.035]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-lime"><GraduationCap aria-hidden className="size-6" /></span>
            <div><h2 id="uni-list" className="text-lg font-bold tracking-tight sm:text-xl">Find a participating university</h2><p className="mt-1 max-w-xl text-sm text-white/75">Search NTA’s official list. Open a university for its sourced admissions information when available.</p></div>
          </div>
          {list.data && <div className="relative rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-2 text-right"><span className="num block text-2xl font-bold text-lime">{all}</span><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">listed by NTA</span></div>}
        </div>
        {list.data && <div className="relative mt-4 flex flex-wrap gap-2" aria-label="University groups">
          {list.data.types.map((t) => <button key={t.type} type="button" aria-pressed={type === t.type} onClick={() => { setType(type === t.type ? '' : t.type); setVisible(24); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${type === t.type ? 'border-lime bg-lime text-forest' : 'border-white/20 bg-white/[0.08] text-white/85 hover:bg-white/[0.16]'}`}>{t.type}<span className="ml-1.5 opacity-75">{t.count}</span></button>)}
        </div>}
      </div>
      <div className="border-b border-rule bg-[#fafaf4] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={q} onChange={(value) => { setQ(value); setVisible(24); }} placeholder="Search by university name" label="Search universities" />
          <label className="flex items-center gap-2 text-sm text-ink-2"><span>Type</span><select value={type} onChange={(ev) => { setType(ev.target.value); setVisible(24); }} className="h-10 rounded-xl border border-rule-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none">
            <option value="">All types ({all})</option>
            {list.data?.types.map((t) => <option key={t.type} value={t.type}>{t.type} ({t.count})</option>)}
          </select></label>
        </div>
        {list.data && <p className="mt-3 text-xs text-ink-3">Showing {filtered.length} {type ? `of ${activeTypeCount} ${type.toLowerCase()} universities` : `of ${all} participating universities`}{list.data.cycle ? ` · ${list.data.cycle} cycle` : ''}. NTA participation is not an admission guarantee.</p>}
      </div>
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <div className="px-5 py-6"><Loading /></div>}
      {list.data && (filtered.length === 0 ? <div className="p-4 sm:p-5"><Empty icon={<SearchX />}>No university matches. Try part of the name, such as a city.</Empty></div> : <>
        <ul className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
          {filtered.slice(0, visible).map((u) => <li key={u.name} className="group flex min-h-[124px] flex-col justify-between rounded-2xl border border-rule bg-[#fffefa] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#cfdc9a] hover:shadow-[0_12px_26px_-22px_rgb(24_68_59/0.45)]">
            <div className="flex items-start gap-3"><span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef2df] text-forest"><GraduationCap className="size-5" /></span><div className="min-w-0"><p className="text-sm font-semibold leading-snug text-ink">{u.hasAdmissionInfo ? <Link to={`/universities/${u.slug}`} className="hover:text-accent hover:underline" data-university-link>{u.name}</Link> : u.name}</p><span className="mt-1.5 inline-flex rounded-full bg-[#f2f3e8] px-2 py-0.5 text-[10px] font-semibold text-ink-2">{u.type}</span></div></div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-2.5"><span className={`text-[10px] font-medium ${u.hasAdmissionInfo ? 'text-correct' : 'text-ink-3'}`}>{u.hasAdmissionInfo ? 'Admission information checked' : 'NTA participant listing'}</span><a href={u.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent hover:underline">NTA source <ExternalLink aria-hidden className="size-3" /></a></div>
          </li>)}
        </ul>
        {filtered.length > visible && <div className="px-4 pb-5 text-center sm:px-5"><button type="button" onClick={() => setVisible((n) => n + 24)} className="rounded-xl border border-rule-strong bg-surface px-4 py-2 text-sm font-semibold text-forest transition hover:bg-paper">Show {Math.min(24, filtered.length - visible)} more universities</button></div>}
      </>)}
      <p className="border-t border-rule px-4 py-3 text-xs text-ink-3 sm:px-5">An NTA listing confirms participation only. Prepora’s admission details appear where an official admission source has been checked. <Link to="/updates" className="font-semibold text-accent hover:underline">Latest government updates</Link></p>
    </section>
  );
}
