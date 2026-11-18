/** Question stem with its structure: maths, List-I / List-II for match-the-following, and the question's diagram. */
import { Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Rich } from './rich';

interface Structure {
  left?: string[];
  right?: string[];
  mediaAssetId?: string;
  alt?: string | null;
}

export const mediaSrc = (id: string) => `/api/learn/media/${id}`;

/** The enlarged view of a figure: fits the screen, or shows at actual size inside a scrollable area. Esc, the close button or a tap outside closes it. */
function FigureDialog({ id, alt, onClose }: { id: string; alt: string; onClose: () => void }) {
  const [actual, setActual] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Enlarged figure" className="fixed inset-0 z-50 flex flex-col bg-black/75 p-3 sm:p-6" onClick={onClose}>
      <div className="mb-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setActual((a) => !a)} className="h-9 rounded-lg bg-surface px-3 text-sm font-medium text-ink">
          {actual ? 'Fit to screen' : 'Actual size'}
        </button>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg bg-surface text-ink">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white p-2" onClick={(e) => e.stopPropagation()}>
        <img src={mediaSrc(id)} alt={alt} className={actual ? 'max-w-none' : 'mx-auto max-h-full max-w-full object-contain'} style={actual ? { width: 'auto', minWidth: '900px' } : undefined} />
      </div>
    </div>
  );
}

/** A question figure that opens larger on a tap or click. */
export function Figure({ id, alt, className = '' }: { id: string; alt?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = alt || 'Figure for this question';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`group relative mx-auto block rounded border border-rule bg-white p-1 ${className}`} aria-label={`Enlarge figure: ${text}`}>
        <img src={mediaSrc(id)} alt={text} loading="lazy" className="mx-auto max-h-80 w-auto max-w-full object-contain" />
        <span aria-hidden className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
          <Maximize2 className="size-3" /> Enlarge
        </span>
      </button>
      {open && <FigureDialog id={id} alt={text} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A small button that enlarges the image of an answer option (placed beside the option, not inside it). */
export function EnlargeButton({ id, alt }: { id: string; alt?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Enlarge this option's figure" className="grid size-8 place-items-center rounded-lg border border-rule bg-surface text-ink-2 hover:text-ink">
          <Maximize2 aria-hidden className="size-4" />
      </button>
      {open && <FigureDialog id={id} alt={alt || 'Option figure'} onClose={() => setOpen(false)} />}
    </>
  );
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function QuestionStem({ stem, structure, compact = false }: { stem: string; structure: unknown; compact?: boolean }) {
  const s = (structure && typeof structure === 'object' ? structure : {}) as Structure;
  return (
    <div className={compact ? 'text-sm' : 'text-[15px]'}>
      <Rich text={stem} />
      {s.left && s.right && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-paper text-left">
                <th className="border border-rule px-2 py-1 font-semibold">List-I</th>
                <th className="border border-rule px-2 py-1 font-semibold">List-II</th>
              </tr>
            </thead>
            <tbody>
              {s.left.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="border border-rule px-2 py-1"><span className="mr-1 font-semibold">{String.fromCharCode(65 + i)}.</span><Rich text={l} inline /></td>
                  <td className="border border-rule px-2 py-1">{s.right![i] !== undefined && <><span className="mr-1 font-semibold">{ROMAN[i]}.</span><Rich text={s.right![i]!} inline /></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.mediaAssetId && <Figure id={s.mediaAssetId} alt={s.alt} className="mt-2" />}
    </div>
  );
}
