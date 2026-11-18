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

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-rule text-ink-2 hover:border-rule-strong hover:bg-paper'}`}
    >
      {children}
    </button>
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
  return (
    <section aria-labelledby="custom-practice" className="rounded-xl border border-rule bg-surface p-5" data-card="custom-practice">
      <h2 id="custom-practice" className="text-base font-semibold text-ink">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-ink-2">Choose what to practise. Leave a group empty to include everything in it.</p>

      {!fixedNodeId && chapters && chapters.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Chapters</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {chapters.map((c) => (
              <Chip key={c.id} on={picked.has(c.id)} onClick={() => setPicked(toggle(picked, c.id))}>
                {c.title}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink">Difficulty</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <Chip key={l.id} on={levels.has(l.id)} onClick={() => setLevels(toggle(levels, l.id))} disabled={(counts?.byDifficulty[l.id] ?? 0) === 0}>
              {l.label} <span className="num text-ink-3">{counts?.byDifficulty[l.id] ?? 0}</span>
            </Chip>
          ))}
        </div>
      </fieldset>

      {typeList.length > 1 && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Question type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeList.map(([t, n]) => (
              <Chip key={t} on={types.has(t as QuestionTypeName)} onClick={() => setTypes(toggle(types, t as QuestionTypeName))}>
                {TYPE_LABEL[t] ?? t} <span className="num text-ink-3">{n}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="text-sm font-medium text-ink">
          Number of questions
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1 block h-9 rounded-lg border border-rule bg-surface px-2 text-sm font-normal">
            {SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div aria-live="polite" className="num text-sm text-ink-2">
          {counts ? `${matching} question${matching === 1 ? '' : 's'} match` : 'Counting questions…'}
        </div>
        <Button onClick={start} disabled={busy || matching === 0}>
          {busy ? 'Starting…' : 'Start practice'}
        </Button>
      </div>
      {counts && matching === 0 && <p className="mt-2 text-sm text-wrong">No question matches these choices. Add a difficulty level or a question type.</p>}
      {err && <div className="mt-3"><ErrorBox error={err} /></div>}
    </section>
  );
}
