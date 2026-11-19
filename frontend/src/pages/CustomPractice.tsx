import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type Difficulty, type QuestionTypeName } from '../api';
import { Button, ErrorBox, useAuth } from '../ui';

export const TYPE_LABEL: Record<string, string> = {
  MCQ_SINGLE: 'Multiple choice',
  MCQ_MULTI: 'More than one answer',
  ASSERTION_REASON: 'Assertion and reason',
  MATCH_THE_FOLLOWING: 'Match the following',
  STATEMENT_BASED: 'Statements',
  PASSAGE_BASED: 'Passage based',
  DIAGRAM_BASED: 'Figure based',
  NUMERICAL: 'Numerical answer',
};
const LEVELS: { id: Difficulty; label: string }[] = [
  { id: 'EASY', label: 'Easy' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HARD', label: 'Hard' },
];
const SIZES = [5, 10, 20, 30];

const toggle = <T,>(set: Set<T>, v: T) => {
  const next = new Set(set);
  if (!next.delete(v)) next.add(v);
  return next;
};

function MultiSelectDropdown({ label, placeholder, options, selected, onToggle }: {
  label: string;
  placeholder: string;
  options: { id: string; label: string; count?: number }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-[#cdd7c1] bg-white/75 open:border-forest/40 open:bg-white">
      <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden sm:px-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-ink-2">{label}</span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-forest">{selected.size ? `${selected.size} selected` : placeholder}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-forest transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="max-h-56 overflow-y-auto border-t border-forest/10 p-1.5">
        {options.map((option) => (
          <label key={option.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[13px] text-charcoal transition-colors hover:bg-[#edf2e4] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
            <input type="checkbox" checked={selected.has(option.id)} onChange={() => onToggle(option.id)} disabled={option.count === 0} className="size-4 shrink-0 accent-[#18443b]" />
            <span className="min-w-0 flex-1">{option.label}</span>
            {option.count !== undefined && <span className="num shrink-0 text-[11px] text-ink-3">{option.count}</span>}
          </label>
        ))}
      </div>
    </details>
  );
}

function SingleSelectDropdown({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { id: string; label: string; count?: number }[];
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value)?.label ?? 'Any difficulty';
  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-[#cdd7c1] bg-white/75 open:border-forest/40 open:bg-white">
      <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden sm:px-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-ink-2">{label}</span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-forest">{selected}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-forest transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-forest/10 p-1.5">
        <button type="button" aria-pressed={!value} onClick={(event) => { onChange(''); event.currentTarget.closest('details')?.removeAttribute('open'); }} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] transition-colors hover:bg-[#edf2e4] ${!value ? 'bg-[#edf2e4] font-semibold text-forest' : 'text-charcoal'}`}>
          <span className="flex-1">Any difficulty</span>
        </button>
        {options.map((option) => (
          <button key={option.id} type="button" aria-pressed={value === option.id} disabled={option.count === 0} onClick={(event) => { onChange(option.id); event.currentTarget.closest('details')?.removeAttribute('open'); }} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] transition-colors hover:bg-[#edf2e4] disabled:cursor-not-allowed disabled:opacity-40 ${value === option.id ? 'bg-[#edf2e4] font-semibold text-forest' : 'text-charcoal'}`}>
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && <span className="num text-[11px] text-ink-3">{option.count}</span>}
          </button>
        ))}
      </div>
    </details>
  );
}

/**
 * Practice with filters: pick chapters (or use the topic that is fixed), difficulty levels and question types, then start a
 * practice set. It uses the ordinary practice session, so scoring, explanations and progress are the ones students already have.
 * The panel shows how many questions match before starting.
 */
export function CustomPractice({ paperId, chapters, fixedNodeId, heading = 'Practise with filters' }: {
  paperId: string;
  chapters?: { id: string; title: string }[];
  fixedNodeId?: string;
  heading?: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Set<Difficulty>>(new Set());
  const [types, setTypes] = useState<Set<QuestionTypeName>>(new Set());
  const [size, setSize] = useState(10);
  const [expanded, setExpanded] = useState(false);
  const [counts, setCounts] = useState<{ total: number; matching: number; byDifficulty: Record<string, number>; byType: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  const nodeIds = fixedNodeId ? [fixedNodeId] : [...picked];
  const key = JSON.stringify([paperId, nodeIds, [...levels], [...types]]);
  useEffect(() => {
    let live = true;
    api
      .questionCounts({ paperId: nodeIds.length ? undefined : paperId, nodeIds, difficulty: [...levels], types: [...types] })
      .then((c) => live && setCounts(c))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const start = async () => {
    if (!user) return navigate('/signin');
    setBusy(true);
    setErr(null);
    try {
      const s = await api.startPractice({
        mode: 'PRACTICE',
        paperId: nodeIds.length ? undefined : paperId,
        nodeIds: nodeIds.length ? nodeIds : undefined,
        count: size,
        difficulty: levels.size ? [...levels] : undefined,
        types: types.size ? [...types] : undefined,
      });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(false);
    }
  };

  const typeList = counts ? Object.entries(counts.byType).filter(([, n]) => n > 0) : [];
  const matching = counts?.matching ?? 0;
  const hasChapters = !fixedNodeId && Boolean(chapters?.length);
  const hasTypes = typeList.length > 1;
  return (
    <section aria-labelledby="custom-practice" className="flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#d0d9c5] bg-[#eef2e4] shadow-[0_8px_22px_rgba(31,56,46,0.06)]" data-card="custom-practice">
      <button type="button" aria-expanded={expanded} aria-controls="custom-practice-options" onClick={() => setExpanded((value) => !value)} className="flex min-h-[116px] w-full flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-white/35 sm:px-4 sm:py-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-forest text-lime"><SlidersHorizontal className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span id="custom-practice" role="heading" aria-level={2} className="block font-display text-[15px] font-bold tracking-[-0.02em] text-forest">{heading}</span>
        </span>
        <span className="hidden shrink-0 rounded-full border border-forest/10 bg-white/55 px-3 py-1.5 text-[11px] font-semibold text-forest sm:inline-flex">{counts ? `${matching} questions` : 'Loading…'}</span>
        <ChevronDown aria-hidden className={`size-5 shrink-0 text-forest transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div id="custom-practice-options" aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`relative border-t border-forest/10 px-3 pb-3 pt-3 transition-opacity duration-200 sm:px-4 sm:pb-4 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`grid grid-cols-1 gap-2.5 ${hasChapters && hasTypes ? 'sm:grid-cols-[1.5fr_.8fr_1.2fr]' : hasChapters || hasTypes ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
      {hasChapters && chapters && (
        <MultiSelectDropdown label="Chapters" placeholder="All chapters" options={chapters.map((c) => ({ id: c.id, label: c.title }))} selected={picked} onToggle={(id) => setPicked(toggle(picked, id))} />
      )}

      <SingleSelectDropdown label="Difficulty" value={levels.values().next().value ?? ''} options={LEVELS.map((level) => ({ id: level.id, label: level.label, count: counts?.byDifficulty[level.id] ?? 0 }))} onChange={(value) => setLevels(value ? new Set([value as Difficulty]) : new Set())} />

      {hasTypes && (
        <MultiSelectDropdown label="Question type" placeholder="All question types" options={typeList.map(([type, count]) => ({ id: type, label: TYPE_LABEL[type] ?? type, count }))} selected={types} onToggle={(type) => setTypes(toggle(types, type as QuestionTypeName))} />
      )}

      <div className="mt-0.5 grid grid-cols-1 gap-2 rounded-xl border border-[#d4ddc8] bg-[#e5edda] p-3 sm:col-span-full sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3.5">
        <div aria-live="polite" className="min-w-0">
          <div className="label text-[8px] text-mute">READY TO PRACTISE</div>
          <div className="num mt-0.5 text-[13px] font-bold text-forest">{counts ? `${matching} question${matching === 1 ? '' : 's'} match` : 'Counting questions…'}</div>
        </div>
        <div className="flex items-end justify-between gap-2 sm:justify-end">
          <label className="flex items-center gap-2 text-[10px] font-semibold text-ink-2">
            Questions
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 rounded-lg border border-rule-strong bg-surface px-2 text-[12px] font-medium text-ink">
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={start} disabled={busy || matching === 0}>
            {busy ? 'Starting…' : 'Start practice'}
          </Button>
        </div>
      </div>
      {counts && matching === 0 && <p className="text-xs text-wrong sm:col-span-full">No questions match. Adjust difficulty or question type.</p>}
      {err && <div className="sm:col-span-full"><ErrorBox error={err} /></div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
