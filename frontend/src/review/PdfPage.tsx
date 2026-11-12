/** Renders one page of the original PDF (our private R2 copy) with pdf.js, entirely in the browser. */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const docs = new Map<string, Promise<pdfjs.PDFDocumentProxy>>();
const open = (url: string) => {
  let p = docs.get(url);
  if (!p) {
    p = pdfjs.getDocument({ url, withCredentials: true }).promise;
    docs.set(url, p);
  }
  return p;
};

export function PdfPage({ url, page, zoom, onPageCount }: { url: string; page: number; zoom: number; onPageCount?: (n: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let task: pdfjs.RenderTask | null = null;
    setBusy(true);
    setError(null);
    open(url)
      .then(async (doc) => {
        onPageCount?.(doc.numPages);
        const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        if (cancelled || !canvas.current || !box.current) return;
        const base = p.getViewport({ scale: 1 });
        const width = box.current.clientWidth || 600;
        const scale = (width / base.width) * zoom * (window.devicePixelRatio || 1);
        const viewport = p.getViewport({ scale });
        canvas.current.width = Math.floor(viewport.width);
        canvas.current.height = Math.floor(viewport.height);
        canvas.current.style.width = `${Math.floor(viewport.width / (window.devicePixelRatio || 1))}px`;
        task = p.render({ canvas: canvas.current, viewport });
        await task.promise;
      })
      .catch((e: Error) => {
        if (!cancelled && e.name !== 'RenderingCancelledException') setError(e.message);
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [url, page, zoom, onPageCount]);
  return (
    <div ref={box} className="relative overflow-auto rounded-md border border-rule bg-ink/5">
      {busy && <div className="absolute inset-x-0 top-2 text-center text-xs text-ink-3">Rendering page {page}…</div>}
      {error && <div className="p-3 text-sm text-wrong">Could not render the PDF: {error}</div>}
      <canvas ref={canvas} className="mx-auto block bg-surface shadow-sm" aria-label={`Original PDF, page ${page}`} />
    </div>
  );
}
