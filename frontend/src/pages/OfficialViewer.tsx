/**
 * Viewer for one official document (a question paper or an answer key) inside CUET Prep: page navigation, zoom and
 * full screen. The document is always the exam body's original. Where the exam body's server lets other sites read
 * the file, the browser loads it straight from that server; where it does not, the document is shown here only if
 * the exam body's permission is on record, and otherwise it opens on the exam body's own site.
 */
import { ChevronLeft, ChevronRight, ExternalLink, Maximize, Minimize, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { api, type OfficialDocument } from '../api';
import { Badge, Button, ErrorBox, Loading, PageHeader, useLoad } from '../ui';

type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> };
type PdfPage = { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): { promise: Promise<void>; cancel(): void } };

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const iconButton = 'inline-flex size-9 items-center justify-center rounded-lg border border-rule-strong bg-surface text-ink hover:bg-ink/5 disabled:opacity-40';
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export function OfficialViewerPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const doc = useLoad(() => api.officialDocument(id), [id]);
  if (doc.loading && !doc.data) return <Loading />;
  if (doc.error) return <ErrorBox error={doc.error} onRetry={doc.reload} />;
  const d = doc.data!;
  const isKey = d.kind === 'ANSWER_KEY';
  const examName = d.exam === 'CUET_PG' ? 'CUET-PG' : 'CUET-UG';
  return (
    <div>
      <PageHeader
        title={d.title}
        subtitle={[examName, d.year, d.subjectName, d.session?.replace(/^(\d{4}-\d{2}-\d{2}) /, (_, x: string) => `${day(x)}, `)].filter(Boolean).join(' · ')}
        back={{ to: `/practice-centre?exam=${d.exam}`, label: 'Practice Centre' }}
      />
      <p className="-mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
        <Badge tone="accent">{isKey ? 'Official answer key' : 'Official previous-year paper'}</Badge>
        <span>
          Source: {d.publisher}. Checked on {day(d.checkedOn)}.
        </span>
        {!isKey && <span>This paper has no answers. The official answer key, where NTA published one, is listed separately.</span>}
      </p>
      {d.viewer === 'NEW_TAB' || !d.fileUrl ? (
        <div className="rounded-xl border border-rule bg-surface p-5">
          <p className="text-[15px] text-ink">{d.reason}</p>
          <a href={d.originalUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white">
            {isKey ? 'View key' : 'View paper'} on NTA's site <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      ) : (
        <PdfViewer doc={d} startPage={Math.max(1, Number(params.get('page')) || 1)} />
      )}
    </div>
  );
}

/** The document viewer itself: pages, zoom, full screen. `site` names whose website the original is on. */
export function PdfViewer({ doc, startPage, site = 'NTA' }: { doc: Pick<OfficialDocument, 'fileUrl' | 'viewer' | 'originalUrl'>; startPage: number; site?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(startPage);
  const [typed, setTyped] = useState(String(startPage));
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [shown, setShown] = useState(100);
  const [full, setFull] = useState(false);
  const [drawing, setDrawing] = useState(true);
  const [width, setWidth] = useState(0);

  // Load the document. The reader is fetched only when a student opens a document.
  useEffect(() => {
    let dead = false;
    let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        lib.GlobalWorkerOptions.workerSrc = worker.default;
        const task = lib.getDocument({ url: doc.fileUrl!, withCredentials: doc.viewer === 'PROXY', rangeChunkSize: 262144 });
        loaded = (await task.promise) as unknown as PdfDoc;
        if (dead) return void loaded.destroy();
        setPdf(loaded);
        setPage((p) => Math.min(p, loaded!.numPages));
      } catch {
        if (!dead) setErr('The document could not be loaded here. You can open it on NTA\'s site instead.');
      }
    })();
    return () => {
      dead = true;
      void loaded?.destroy();
    };
  }, [doc.fileUrl, doc.viewer]);

  // Track the width available, for "fit width".
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [pdf]);

  // Draw the current page.
  useEffect(() => {
    if (!pdf || !canvas.current || !width) return;
    let cancelled = false;
    let task: { cancel(): void } | null = null;
    setDrawing(true);
    (async () => {
      const p = await pdf.getPage(page);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.max(0.3, (width - 16) / base.width) : zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: scale * ratio });
      const c = canvas.current!;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(vp.width / ratio)}px`;
      c.style.height = `${Math.floor(vp.height / ratio)}px`;
      setShown(Math.round(scale * 100));
      const r = p.render({ canvasContext: c.getContext('2d')!, viewport: vp, canvas: c });
      task = r;
      await r.promise.catch(() => undefined);
      if (!cancelled) setDrawing(false);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom, width]);

  useEffect(() => setTyped(String(page)), [page]);
  const total = pdf?.numPages ?? 0;
  const go = useCallback((n: number) => setPage((p) => (total ? Math.min(total, Math.max(1, n)) : p)), [total]);
  const step = (dir: 1 | -1) => {
    const cur = zoom === 'fit' ? shown / 100 : zoom;
    const next = dir === 1 ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01);
    if (next) setZoom(next);
  };

  // Full screen: the browser's own where it exists; otherwise the viewer fills the window.
  const toggleFull = async () => {
    const el = frame.current!;
    if (document.fullscreenElement) return void document.exitFullscreen();
    if (el.requestFullscreen) await el.requestFullscreen().catch(() => setFull((f) => !f));
    else setFull((f) => !f);
  };
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  // Keys: arrows and Page Up/Down turn pages, + and − zoom, Escape leaves the fill-the-window mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
      else if (e.key === '+' || e.key === '=') step(1);
      else if (e.key === '-') step(-1);
      else if (e.key === 'Escape' && full && !document.fullscreenElement) setFull(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const open = (
    <a href={`${doc.originalUrl}#page=${page}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rule-strong bg-surface px-3 text-sm font-medium text-accent hover:bg-accent-soft">
      Open on {site}'s site <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
  if (err)
    return (
      <div className="rounded-xl border border-rule bg-surface p-5">
        <p role="alert" className="text-[15px] text-ink">
          {err}
        </p>
        <div className="mt-4">{open}</div>
      </div>
    );
  return (
    <div ref={frame} className={`flex flex-col overflow-hidden rounded-xl border border-rule bg-paper ${full ? 'fixed inset-0 z-50 rounded-none border-0' : ''}`} style={full ? undefined : { height: 'min(78vh, 60rem)' }} aria-label="Document viewer">
      <div role="toolbar" aria-label="Viewer controls" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-surface px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className={iconButton} onClick={() => go(page - 1)} disabled={!pdf || page <= 1} aria-label="Previous page">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <form
            className="flex items-center gap-1.5 text-sm text-ink-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(Number(typed) || page);
            }}
          >
            <label className="flex items-center gap-1.5">
              <span>Page</span>
              <input className="num h-9 w-14 rounded-lg border border-rule-strong bg-surface px-2 text-center text-ink" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} onBlur={() => go(Number(typed) || page)} aria-label="Page number" />
            </label>
            <span className="num">of {total || '…'}</span>
          </form>
          <button type="button" className={iconButton} onClick={() => go(page + 1)} disabled={!pdf || page >= total} aria-label="Next page">
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={iconButton} onClick={() => step(-1)} disabled={!pdf || shown <= 50} aria-label="Zoom out">
            <ZoomOut aria-hidden className="size-4" />
          </button>
          <span className="num w-12 text-center text-sm text-ink-2" aria-live="polite">
            {shown}%
          </span>
          <button type="button" className={iconButton} onClick={() => step(1)} disabled={!pdf || shown >= 300} aria-label="Zoom in">
            <ZoomIn aria-hidden className="size-4" />
          </button>
          <button type="button" className={iconButton} onClick={() => setZoom('fit')} disabled={!pdf || zoom === 'fit'} aria-label="Fit to width" title="Fit to width">
            <MoveHorizontal aria-hidden className="size-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button kind="secondary" size="sm" onClick={() => void toggleFull()} icon={full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}>
            {full ? 'Exit full screen' : 'Full screen'}
          </Button>
          {open}
        </div>
      </div>
      <div ref={area} className="relative min-h-0 flex-1 overflow-auto p-2 text-center">
        {(!pdf || drawing) && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
            <span className="rounded-lg bg-surface px-3 py-1.5 text-sm text-ink-2 shadow-sm">{pdf ? `Loading page ${page}…` : 'Loading the document from NTA…'}</span>
          </div>
        )}
        <canvas ref={canvas} className="mx-auto inline-block bg-white shadow-sm" aria-label={`Page ${page} of ${total}`} />
      </div>
    </div>
  );
}
