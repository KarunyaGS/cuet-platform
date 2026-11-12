import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api';
import { Badge, Button, ErrorBox, Loading, useLoad } from '../ui';
import { flagsOf, KINDS, parseCheck, reviewApi, type HistoryItem, type NewRow, type ReviewNode, type Workspace } from './api';
import { PdfPage } from './PdfPage';
import { ProgressBar } from './Queue';

const VTONE: Record<string, { label: string; cls: string }> = {
  UNVERIFIED: { label: 'Unverified', cls: 'bg-ink/5 text-ink-2' },
  MACHINE_VERIFIED: { label: 'Machine-verified', cls: 'bg-accent-soft text-accent' },
  VERIFIED: { label: 'Verified by a person', cls: 'bg-correct-soft text-correct' },
  NEEDS_CHANGES: { label: 'Flagged', cls: 'bg-marker-soft text-marker ring-1 ring-marker/30' },
  REJECTED: { label: 'Rejected', cls: 'bg-wrong-soft text-wrong line-through' },
};
const FLAG_LABEL: Record<string, { label: string; cls: string }> = {
  heading_inferred_from_formatting: { label: 'Guessed heading', cls: 'bg-marker-soft text-marker' },
  heading_found_inside_body: { label: 'Heading inside text', cls: 'bg-marker-soft text-marker' },
  ocr: { label: 'OCR text', cls: 'bg-violet-100 text-violet-800' },
  ocr_low_confidence: { label: 'Low OCR confidence', cls: 'bg-violet-100 text-violet-800' },
  symbols_lost_in_pdf_text: { label: 'Symbols lost', cls: 'bg-rose-100 text-rose-800' },
  formula_text_check_layout: { label: 'Formula layout', cls: 'bg-rose-100 text-rose-800' },
  manual_transcription: { label: 'Typed by a person', cls: 'bg-sky-100 text-sky-800' },
  manually_added: { label: 'Added by a person', cls: 'bg-sky-100 text-sky-800' },
  manually_corrected: { label: 'Corrected', cls: 'bg-sky-100 text-sky-800' },
};
const tokenKey = (w: string) => w.normalize('NFKC').toLowerCase();

/** Marks the words the automatic check could not find on the row's own PDF page. */
function Marked({ text, missing }: { text: string; missing: Set<string> }) {
  if (!missing.size) return <>{text}</>;
  return (
    <>
      {text.split(/([\p{L}\p{M}\p{N}]+)/u).map((part, i) =>
        missing.has(tokenKey(part)) ? <mark key={i} className="rounded bg-wrong-soft px-0.5 text-wrong" title="Not found on this row's page of the PDF">{part}</mark> : part,
      )}
    </>
  );
}

function Mini({ onClick, title, children, tone = 'zinc', disabled }: { onClick: () => void; title: string; children: ReactNode; tone?: 'zinc' | 'green' | 'amber' | 'red'; disabled?: boolean }) {
  const t = { zinc: 'text-ink-2 hover:bg-ink/5', green: 'text-correct hover:bg-correct-soft', amber: 'text-marker hover:bg-marker-soft', red: 'text-wrong hover:bg-wrong-soft' }[tone];
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`grid h-6 min-w-6 place-items-center rounded px-1 text-xs font-semibold disabled:opacity-30 ${t}`}>
      {children}
    </button>
  );
}

function EditForm({ n, pages, onDone }: { n: ReviewNode; pages: number; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({ kind: n.kind, label: n.label ?? '', title: n.title, body: n.body ?? '', sourcePage: n.source_page ?? 1, reason: '' });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await reviewApi.edit(n.id, { kind: f.kind, label: f.label || null, title: f.title, body: f.body || null, sourcePage: f.sourcePage, reason: f.reason });
      onDone(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const input = 'rounded border border-rule-strong bg-surface px-2 py-1 text-sm';
  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-sky-200 bg-sky-50/50 p-2">
      <div className="flex flex-wrap gap-1.5">
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={input} aria-label="Kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Label" className={`${input} w-20`} aria-label="Label" />
        <label className="flex items-center gap-1 text-xs text-ink-2">Page <input type="number" min={1} max={pages || undefined} value={f.sourcePage} onChange={(e) => setF({ ...f, sourcePage: Number(e.target.value) })} className={`${input} w-16`} /></label>
      </div>
      <textarea dir="auto" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} rows={2} className={`${input} w-full`} aria-label="Title" />
      <textarea dir="auto" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={2} placeholder="Body (optional)" className={`${input} w-full`} aria-label="Body" />
      <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Why? e.g. 'Title continues on the next line of page 3'" className={`${input} w-full`} aria-label="Reason" />
      {err && <p className="text-xs text-wrong">{err}</p>}
      <div className="flex gap-1.5">
        <Button onClick={save} disabled={f.reason.trim().length < 3}>Save correction</Button>
        <Button kind="ghost" onClick={() => onDone(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function History({ id }: { id: string }) {
  const h = useLoad(() => reviewApi.history('CURRICULUM_NODE', id), [id]);
  if (h.loading) return <p className="mt-1 text-xs text-ink-3">Loading history…</p>;
  if (h.error) return <p className="mt-1 text-xs text-wrong">{h.error.message}</p>;
  const items = h.data as HistoryItem[];
  if (!items.length) return <p className="mt-1 text-xs text-ink-3">No changes yet: this row is exactly as extracted from the PDF.</p>;
  return (
    <ol className="mt-1.5 space-y-1 border-l-2 border-rule pl-2 text-xs">
      {items.map((x) => {
        const detail = x.checklist_json ? (JSON.parse(x.checklist_json) as { before?: Record<string, unknown>; after?: Record<string, unknown> }) : null;
        return (
          <li key={x.id}>
            <span className="font-medium">{x.action}</span> {x.from_status && `${x.from_status} → ${x.to_status}`} · {x.actorName} · {new Date(x.created_at).toLocaleString()}
            {x.comment && <div className="text-ink-2">“{x.comment}”</div>}
            {detail?.before && <div className="truncate text-ink-3" title={JSON.stringify(detail.before)}>before: {String(detail.before['title'] ?? JSON.stringify(detail.before)).slice(0, 140)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** Outline syntax for fast transcription: "# " level 1, "## " level 2, "### " level 3, "- " item, plain line = text of the previous row. */
function parseOutline(text: string): { rows: NewRow[]; errors: string[] } {
  const rows: NewRow[] = [];
  const errors: string[] = [];
  const stack: { ref: string; level: number }[] = [];
  const kindFor = ['UNIT', 'TOPIC', 'SUBTOPIC', 'ITEM'];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^(#{1,3})\s+(.+)$/.exec(line) ?? (/^[-•]\s+(.+)$/.test(line) ? ['', '####', line.replace(/^[-•]\s+/, '')] : null);
    if (!m) {
      const prev = rows.at(-1);
      if (!prev) errors.push(`Line ${i + 1}: text before any heading`);
      else prev.body = prev.body ? `${prev.body}\n${line}` : line;
      return;
    }
    const level = m[1]!.length;
    let title = m[2]!.trim();
    let label: string | null = null;
    const lm = /^(\(?[\p{L}\p{N}]{1,4}[.)]|[\p{L}]+\s+[\p{N}IVX]+[:.]?)\s+(.+)$/u.exec(title);
    if (lm && lm[1]!.length <= 12) {
      label = lm[1]!.replace(/[:.]$/, '');
      title = lm[2]!;
    }
    while (stack.length && stack.at(-1)!.level >= level) stack.pop();
    const ref = `r${rows.length + 1}`;
    rows.push({ ref, parentRef: stack.at(-1)?.ref ?? null, kind: kindFor[Math.min(level, 4) - 1]!, label, title, body: null });
    stack.push({ ref, level });
  });
  return { rows, errors };
}

function AddRows({ ws, page, under, transcription, onDone }: { ws: Workspace; page: number; under: ReviewNode | null; transcription: boolean; onDone: (saved: boolean) => void }) {
  const [text, setText] = useState('');
  const [reason, setReason] = useState(transcription ? `Typed from page ${page} of the official PDF` : '');
  const [err, setErr] = useState<string | null>(null);
  const parsed = useMemo(() => parseOutline(text), [text]);
  const save = async () => {
    try {
      await reviewApi.addRows(ws.version!.id, { parentId: under?.id ?? null, page, transcription, reason, rows: parsed.rows });
      onDone(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/40 p-2.5">
      <div className="text-sm font-medium">{transcription ? 'Transcribe' : 'Add rows'} · page {page}{under ? <> · under “{under.title.slice(0, 50)}”</> : ' · top level'}</div>
      <p className="text-xs text-ink-2">
        One row per line: <code># Unit</code>, <code>## Topic</code>, <code>### Subtopic</code>, <code>- item</code>; a line without a marker adds text to the row above. Labels such as <code>1.</code>, <code>(a)</code> or <code>Unit I:</code> are detected. Type exactly what the page shows, in its own script.
      </p>
      <textarea dir="auto" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded border border-rule-strong bg-surface px-2 py-1 font-[inherit] text-sm" style={{ fontFamily: "'Noto Nastaliq Urdu','Noto Sans Lepcha','Noto Sans',system-ui,sans-serif" }} placeholder={'# Unit I: …\n## …\n- …'} aria-label="Outline" />
      {parsed.rows.length > 0 && (
        <ul className="max-h-40 overflow-auto rounded border border-rule bg-surface p-1.5 text-xs">
          {parsed.rows.map((r) => {
            let d = 0;
            for (let p = r.parentRef; p; p = parsed.rows.find((x) => x.ref === p)?.parentRef ?? null) d++;
            return <li key={r.ref} dir="auto" style={{ paddingInlineStart: d * 14 }}><span className="text-ink-3">{r.kind}</span> {r.label && <b>{r.label} </b>}{r.title}{r.body && <span className="text-ink-3"> — {r.body}</span>}</li>;
          })}
        </ul>
      )}
      {parsed.errors.map((e) => <p key={e} className="text-xs text-wrong">{e}</p>)}
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="w-full rounded border border-rule-strong bg-surface px-2 py-1 text-sm" aria-label="Reason" />
      {err && <p className="text-xs text-wrong">{err}</p>}
      <div className="flex gap-1.5">
        <Button onClick={save} disabled={!parsed.rows.length || parsed.errors.length > 0 || reason.trim().length < 3}>Save {parsed.rows.length || ''} rows</Button>
        <Button kind="ghost" onClick={() => onDone(false)}>Cancel</Button>
      </div>
      {transcription && <p className="text-[11px] text-ink-3">Rows you type are marked “typed by a person”. Another reviewer must verify them.</p>}
    </div>
  );
}

export function ReviewWorkspace() {
  const { paperId = '' } = useParams();
  const ws = useLoad(() => Promise.all([reviewApi.paper(paperId), reviewApi.me()]), [paperId]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [scope, setScope] = useState<'page' | 'all' | 'attention'>('page');
  const [open, setOpen] = useState<{ id: string; mode: 'edit' | 'history' | 'flag' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [adding, setAdding] = useState<{ under: ReviewNode | null } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [checks, setChecks] = useState({ everyRowComparedWithPdf: false, hierarchyMatchesPdf: false, nothingMissingFromPdf: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const onPageCount = useCallback((n: number) => setPages(n), []);

  const w = ws.data?.[0];
  const me = ws.data?.[1];
  const byId = useMemo(() => new Map((w?.nodes ?? []).map((n) => [n.id, n])), [w]);
  // Rows in document order (depth-first by position), so the outline reads like the PDF.
  const ordered = useMemo(() => {
    const kids = new Map<string | null, ReviewNode[]>();
    for (const n of w?.nodes ?? []) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n]);
    const out: ReviewNode[] = [];
    const walk = (p: string | null) => (kids.get(p) ?? []).sort((a, b) => a.position - b.position).forEach((n) => (out.push(n), walk(n.id)));
    walk(null);
    return out;
  }, [w]);

  if (ws.loading && !w) return <Loading />;
  if (ws.error) {
    if (ws.error instanceof ApiError && (ws.error.status === 401 || ws.error.status === 403)) return <ErrorBox error={new Error('Reviewer access needed. Sign in with a reviewer account.')} />;
    return <ErrorBox error={ws.error} onRetry={ws.reload} />;
  }
  if (!w || !me) return null;
  const v = w.version;
  const canWrite = me.permissions.includes('curriculum:write');
  const canReview = me.permissions.includes('content:review');
  const transcriptionMode = w.paper.job_status === 'BLOCKED';
  const pageCheck = w.pageChecks.find((c) => c.page === page);
  const attention = (n: ReviewNode) => n.verification === 'NEEDS_CHANGES' || flagsOf(n).some((f) => FLAG_LABEL[f] && !f.startsWith('manually')) || parseCheck(n)?.ok === false;
  const rows = ordered.filter((n) => (scope === 'all' ? true : scope === 'page' ? n.source_page === page : attention(n)));
  const counts = {
    total: w.nodes.length,
    verified: w.nodes.filter((n) => n.verification === 'VERIFIED').length,
    machine: w.nodes.filter((n) => n.verification === 'MACHINE_VERIFIED').length,
    pending: w.nodes.filter((n) => n.verification === 'UNVERIFIED').length,
    flagged: w.nodes.filter((n) => n.verification === 'NEEDS_CHANGES').length,
    rejected: w.nodes.filter((n) => n.verification === 'REJECTED').length,
    guessedHeadings: 0, failingCheck: 0,
  };
  const open_ = counts.total - counts.verified - counts.rejected;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setOpen(null);
      setComment('');
      setSelected(new Set());
      ws.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const decide = (ids: string[], action: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED', c?: string) =>
    act(
      () => reviewApi.decide({ entityType: 'CURRICULUM_NODE', entityIds: ids, action, comment: c, checklist: action === 'VERIFIED' ? { matchesSourcePage: true, comparedWithOriginalPdf: true } : undefined }),
      `${ids.length} row(s): ${action === 'VERIFIED' ? 'verified' : action === 'REJECTED' ? 'rejected' : 'flagged'}`,
    );
  const cleanOnPage = rows.filter((n) => scope === 'page' && n.verification !== 'VERIFIED' && n.verification !== 'REJECTED' && !attention(n) && n.authored_by !== me.id);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-2.5">
        <div className="min-w-0">
          <Link to="/review" className="text-xs font-medium text-accent hover:underline">← Review queue</Link>
          <h1 className="truncate text-lg font-semibold tracking-tight"><span className="mr-1.5 font-mono text-sm text-ink-3">{w.paper.code}</span>{w.paper.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            <Badge tone={v?.verification === 'VERIFIED' ? 'green' : v?.verification === 'MACHINE_VERIFIED' ? 'accent' : 'amber'}>{v ? `v${v.version_number} · ${v.verification.replace('_', '-').toLowerCase()}` : 'no version'}</Badge>
            {transcriptionMode && <Badge tone="red">Manual transcription</Badge>}
            {v?.source_url && <a href={v.source_url} target="_blank" rel="noreferrer" className="underline">Official PDF (NTA)</a>}
            <span className="num">{counts.verified}/{counts.total} verified by a person · {counts.rejected} rejected · {counts.flagged} flagged</span>
          </div>
          <div className="mt-1 w-72"><ProgressBar r={counts} /></div>
        </div>
        {v && canReview && (
          <Button kind={open_ === 0 && counts.verified ? 'primary' : 'secondary'} onClick={() => setSigning(!signing)} disabled={open_ > 0 || !counts.verified}>
            {open_ > 0 ? `${open_} rows to decide` : 'Sign off paper'}
          </Button>
        )}
      </div>
      {v?.notes && <p className="mb-2 rounded-md bg-marker-soft px-2.5 py-1.5 text-xs text-marker">{v.notes}</p>}
      {signing && v && (
        <div className="mb-3 space-y-1.5 rounded-lg border border-correct/30 bg-correct-soft/60 p-3 text-sm">
          <div className="font-medium">Sign off {w.paper.code}: this paper's syllabus matches its official PDF</div>
          {(Object.keys(checks) as (keyof typeof checks)[]).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
              {{ everyRowComparedWithPdf: 'I compared every row with its page of the PDF', hierarchyMatchesPdf: 'Units, topics and subtopics are nested as in the PDF', nothingMissingFromPdf: 'Nothing on the PDF is missing (I checked the OCR warnings on every page)' }[k]}
            </label>
          ))}
          <Button disabled={!Object.values(checks).every(Boolean)} onClick={() => act(() => reviewApi.signOff(v.id, { checklist: checks }), 'Paper signed off')}>Confirm sign-off</Button>
        </div>
      )}
      {msg && <p className={`mb-2 rounded-md px-2.5 py-1.5 text-sm ${msg.ok ? 'bg-correct-soft text-correct' : 'bg-wrong-soft text-wrong'}`} role="status">{msg.text}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Original PDF */}
        <section aria-label="Original PDF" className="lg:sticky lg:top-14 lg:self-start">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm">
            <Button kind="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>‹</Button>
            <span className="num">Page {page}{pages ? ` of ${pages}` : ''}</span>
            <Button kind="secondary" onClick={() => setPage(Math.min(pages || page + 1, page + 1))} disabled={!!pages && page >= pages}>›</Button>
            <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="ml-auto rounded border border-rule-strong bg-surface px-1.5 py-1 text-xs" aria-label="Zoom">
              {[1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{z * 100}%</option>)}
            </select>
          </div>
          {pageCheck && (
            <div className={`mb-1.5 rounded-md px-2.5 py-1.5 text-xs ${pageCheck.status === 'CHECK' ? 'bg-wrong-soft text-wrong' : pageCheck.status === 'OK' ? 'bg-correct-soft text-correct' : 'bg-ink/5 text-ink-2'}`}>
              <b>Visual check (OCR of this page):</b>{' '}
              {pageCheck.status === 'OK' && `all ${pageCheck.ocr_words} words OCR read are in the extracted rows.`}
              {pageCheck.status === 'CHECK' && <>only {pageCheck.found_words} of {pageCheck.ocr_words} words OCR read are in the extracted rows ({pageCheck.found_pct}%). Missing: <span dir="auto" className="font-medium">{pageCheck.missing_sample}</span></>}
              {pageCheck.status === 'NO_TEXT' && 'OCR found no readable text on this page.'}
              {pageCheck.status === 'SKIPPED' && 'not possible for this script; compare by eye.'}
            </div>
          )}
          {v?.source_id ? <PdfPage url={reviewApi.sourceUrl(v.source_id)} page={page} zoom={zoom} onPageCount={onPageCount} /> : <p className="text-sm text-ink-3">No stored PDF.</p>}
        </section>

        {/* Extracted rows */}
        <section aria-label="Extracted syllabus rows" className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1 text-xs">
            {(['page', 'all', 'attention'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ${scope === s ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-rule-strong'}`}>
                {s === 'page' ? `Page ${page}` : s === 'all' ? `All rows ${counts.total}` : `Needs attention ${w.nodes.filter(attention).length}`}
              </button>
            ))}
            {canWrite && v && <Button kind="secondary" onClick={() => setAdding({ under: null })}>{transcriptionMode ? '+ Transcribe page' : '+ Add rows'}</Button>}
          </div>
          {canReview && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-rule bg-surface px-2 py-1.5 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I compare each row with the PDF page before verifying it
              </label>
              {selected.size > 0 && <Button disabled={!confirmed} onClick={() => decide([...selected], 'VERIFIED')}>Verify {selected.size} selected</Button>}
              {scope === 'page' && cleanOnPage.length > 0 && (
                <Button kind="secondary" disabled={!confirmed} onClick={() => decide(cleanOnPage.map((n) => n.id), 'VERIFIED')}>
                  Verify {cleanOnPage.length} clean rows on this page
                </Button>
              )}
            </div>
          )}
          {adding && <div className="mb-2"><AddRows ws={w} page={page} under={adding.under} transcription={transcriptionMode} onDone={(saved) => { setAdding(null); if (saved) ws.reload(); }} /></div>}
          {!rows.length && (
            <p className="rounded-md border border-dashed border-rule-strong px-3 py-4 text-sm text-ink-3">
              {transcriptionMode && !w.nodes.length ? 'Nothing has been transcribed yet. Read the page on the left and use “Transcribe page”.' : scope === 'page' ? 'No rows cite this page. Check the PDF: if it has syllabus text, add the missing rows.' : 'Nothing here.'}
            </p>
          )}
          <ol className="space-y-1">
            {rows.map((n) => {
              const check = parseCheck(n);
              const missing = new Set((check?.missingOnPage ?? []).map(tokenKey));
              const flags = flagsOf(n);
              const vt = VTONE[n.verification] ?? VTONE['UNVERIFIED']!;
              const own = n.authored_by === me.id;
              const isOpen = open?.id === n.id;
              const parentTitle = n.parent_id ? byId.get(n.parent_id)?.title : null;
              return (
                <li key={n.id} className={`rounded-md border bg-surface px-2 py-1.5 ${attention(n) ? 'border-marker/30' : 'border-rule'}`} style={{ marginInlineStart: scope === 'page' ? 0 : (n.depth - 1) * 14 }}>
                  <div className="flex items-start gap-1.5">
                    {canReview && <input type="checkbox" className="mt-1" checked={selected.has(n.id)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(n.id); else s.delete(n.id); setSelected(s); }} aria-label="Select row" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="rounded bg-ink px-1 font-semibold text-white">{n.kind}{n.label ? ` ${n.label}` : ''}</span>
                        <span className={`rounded px-1 ${vt.cls}`}>{vt.label}</span>
                        <button onClick={() => setPage(n.source_page ?? 1)} className="rounded bg-ink/5 px-1 text-ink-2 hover:bg-rule" title="Show this row's page">p.{n.source_page ?? '?'}</button>
                        {flags.map((f) => FLAG_LABEL[f] && <span key={f} className={`rounded px-1 ${FLAG_LABEL[f]!.cls}`}>{FLAG_LABEL[f]!.label}</span>)}
                        {check && !check.ok && check.secondExtractorAgreementPct < 98 && <span className="rounded bg-rose-100 px-1 text-rose-800">2nd extractor {check.secondExtractorAgreementPct}%</span>}
                        {n.authored_by && <span className="text-ink-3">typed by {w.people[n.authored_by] ?? 'someone'}</span>}
                        {n.edited_by && !n.authored_by && <span className="text-ink-3">edited by {w.people[n.edited_by] ?? 'someone'}</span>}
                      </div>
                      {scope === 'page' && parentTitle && <div className="truncate text-[11px] text-ink-3">under: {parentTitle}</div>}
                      <div dir="auto" className={`text-sm font-medium ${n.verification === 'REJECTED' ? 'text-ink-3 line-through' : ''}`}><Marked text={n.title} missing={missing} /></div>
                      {n.body && <div dir="auto" className="whitespace-pre-line text-[13px] text-ink-2"><Marked text={n.body} missing={missing} /></div>}
                      {missing.size > 0 && <div className="text-[11px] text-wrong">Not found on page {n.source_page}: {[...missing].join(', ')}</div>}
                      {n.last_review && n.verification === 'NEEDS_CHANGES' && <div className="text-[11px] text-marker">Flag: {n.last_review.split('|')[1]}</div>}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
                      {canReview && <Mini tone="green" title={own ? 'Another reviewer must verify rows you typed' : confirmed ? 'Verify: matches the PDF' : 'Tick “I compare each row…” first'} disabled={!confirmed || own || n.verification === 'VERIFIED'} onClick={() => decide([n.id], 'VERIFIED')}>✓</Mini>}
                      {canReview && <Mini tone="amber" title="Flag for correction" onClick={() => setOpen(isOpen && open.mode === 'flag' ? null : { id: n.id, mode: 'flag' })}>⚑</Mini>}
                      {canReview && <Mini tone="red" title="Reject: not in the official syllabus" onClick={() => setOpen(isOpen && open.mode === 'reject' ? null : { id: n.id, mode: 'reject' })}>✕</Mini>}
                      {canWrite && <Mini title="Edit text, kind, label or page" onClick={() => setOpen(isOpen && open.mode === 'edit' ? null : { id: n.id, mode: 'edit' })}>✎</Mini>}
                      {canWrite && <Mini title="Move up" onClick={() => act(() => reviewApi.move(n.id, 'up'), 'Moved')}>↑</Mini>}
                      {canWrite && <Mini title="Move down" onClick={() => act(() => reviewApi.move(n.id, 'down'), 'Moved')}>↓</Mini>}
                      {canWrite && <Mini title="Make it a child of the row above" onClick={() => act(() => reviewApi.move(n.id, 'indent'), 'Moved under the row above')}>→</Mini>}
                      {canWrite && <Mini title="Move one level up" onClick={() => act(() => reviewApi.move(n.id, 'outdent'), 'Moved one level up')}>←</Mini>}
                      {canWrite && <Mini title="Add rows under this row" onClick={() => setAdding({ under: n })}>＋</Mini>}
                      <Mini title={`History (${n.review_count})`} onClick={() => setOpen(isOpen && open.mode === 'history' ? null : { id: n.id, mode: 'history' })}>⟲</Mini>
                    </div>
                  </div>
                  {isOpen && open.mode === 'edit' && <EditForm n={n} pages={pages || w.version?.page_count || 0} onDone={(saved) => { setOpen(null); if (saved) ws.reload(); }} />}
                  {isOpen && open.mode === 'history' && <History id={n.id} />}
                  {isOpen && (open.mode === 'flag' || open.mode === 'reject') && (
                    <div className="mt-1.5 flex gap-1.5">
                      <input autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={open.mode === 'flag' ? 'What needs correcting?' : 'Why is it not part of the syllabus?'} className="flex-1 rounded border border-rule-strong px-2 py-1 text-sm" aria-label="Comment" />
                      <Button kind="secondary" disabled={comment.trim().length < 3} onClick={() => decide([n.id], open.mode === 'flag' ? 'CHANGES_REQUESTED' : 'REJECTED', comment)}>{open.mode === 'flag' ? 'Flag' : 'Reject'}</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
