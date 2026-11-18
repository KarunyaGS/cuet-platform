import { Download, Printer } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { api, type Sheet, type SheetSection } from '../api';
import { Figure } from '../question';
import { Badge, Button, Empty, ErrorBox, Loading, useAuth, useLoad } from '../ui';
import { BlockView, TableBlock } from './Learn';

const asBlock = (b: { type: string; body: string }, i: number) => ({ ...b, position: i, media_asset_id: null, alt_text: null, caption: null, media_kind: null });

function Section({ s, compact }: { s: SheetSection; compact: boolean }) {
  const notes = [...s.definitions, ...s.formulas, ...s.points];
  return (
    <section data-sheet-section className="mb-4 break-inside-avoid-page">
      <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 border-b border-rule pb-1 text-base font-semibold text-ink">
        <span>{s.title}</span>
        {s.practice && (
          <span className="num text-[13px] font-normal text-wrong" data-practice>
            Your practice: {s.practice.correct} of {s.practice.attempted} correct ({s.practice.accuracy}%)
          </span>
        )}
      </h2>
      <div className={`gap-x-6 text-[14px] leading-snug ${compact ? 'columns-1 sm:columns-2' : 'columns-1 md:columns-2'}`} data-sheet-notes>
        {notes.map((b, i) => (
          <div key={i} className="mb-2 min-w-0 max-w-full overflow-x-auto break-inside-avoid">
            <BlockView b={asBlock(b, i)} solvedNo={0} />
          </div>
        ))}
      </div>
      {(s.figures.length > 0 || s.tables.length > 0) && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {s.figures.map((f) => (
            <figure key={f.mediaAssetId} className="min-w-0 break-inside-avoid">
              <Figure id={f.mediaAssetId} alt={f.alt} className="mx-auto max-h-48 w-auto max-w-full" />
              <figcaption className="mt-1 text-[12px] text-ink-2">
                <span className="font-medium text-ink">{f.caption}</span>
                {f.learn ? `. ${f.learn}` : ''}
              </figcaption>
            </figure>
          ))}
          {s.tables.map((t, i) => (
            <div key={i} className="min-w-0 overflow-x-auto break-inside-avoid text-[13px]">
              <TableBlock body={JSON.stringify(t)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const fileName = (s: Sheet) => `Prepora ${s.title} (draft unverified)`.replace(/[^A-Za-z0-9 ,.()-]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The print view is this page itself (the print style hides the site chrome); "Download PDF" opens the browser's Save as PDF with a file name. */
function SheetView({ s }: { s: Sheet }) {
  const print = () => window.print();
  const download = () => {
    const old = document.title;
    document.title = fileName(s);
    window.print();
    setTimeout(() => (document.title = old), 1500);
  };
  const compact = s.kind !== 'CHAPTER';
  return (
    <div className="max-w-4xl" data-print-sheet data-sheet={s.kind} data-max-pages={s.maxPages}>
      <header className="mb-4">
        <div data-no-print className="mb-2">
          <Link to={s.kind === 'CHAPTER' && s.sections[0] ? `/topic/${s.sections[0].id}` : s.paperId ? `/subjects/${s.paperId}` : '/progress'} className="text-sm font-medium text-accent hover:underline">
            Back
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">{s.title}</h1>
          {s.draft && <Badge tone="amber">Draft - unverified</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-2">
          {s.paper && s.kind === 'CHAPTER' ? `${s.paper}. ` : ''}
          Made from {s.lessons} {s.lessons === 1 ? 'lesson' : 'lessons'}; it updates when they change (version <span className="num">{s.version}</span>).
          {s.draft ? ' These lessons have not been checked by a subject expert yet.' : ''}
        </p>
        <div data-no-print className="mt-3 flex flex-wrap gap-2">
          <Button onClick={download} icon={<Download aria-hidden />}>Download PDF</Button>
          <Button kind="secondary" onClick={print} icon={<Printer aria-hidden />}>Print</Button>
        </div>
      </header>
      {s.empty ? <Empty>{s.empty}</Empty> : s.sections.map((x) => <Section key={x.id} s={x} compact={compact} />)}
    </div>
  );
}

/** Quick revision sheets: /sheets/chapter/:nodeId, /sheets/subject/:paperId, /sheets/weak (optional ?paperId=). */
export function SheetPage({ mode }: { mode: 'chapter' | 'subject' | 'weak' }) {
  const { nodeId, paperId } = useParams();
  const [sp] = useSearchParams();
  const { user, ready } = useAuth();
  const q = useLoad(() => (mode === 'chapter' ? api.chapterSheet(nodeId!) : mode === 'subject' ? api.subjectSheet(paperId!) : api.weakSheet(sp.get('paperId') ?? undefined)), [mode, nodeId, paperId, sp.get('paperId')]);
  if (mode === 'weak' && ready && !user) return <Navigate to="/signin" replace />;
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  return <SheetView s={q.data!} />;
}
