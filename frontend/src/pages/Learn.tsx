import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type Block } from '../api';
import { DisplayMath, parseBody, Rich } from '../rich';
import { Badge, Button, ErrorBox, Loading, useAuth, useLoad } from '../ui';

const tone: Record<string, { label: string; cls: string }> = {
  CONCEPT: { label: 'Concept', cls: 'border-sky-200 bg-sky-50/70' },
  KEY_POINT: { label: 'Key point', cls: 'border-emerald-200 bg-emerald-50/70' },
  IMPORTANT_FACT: { label: 'Remember', cls: 'border-emerald-200 bg-emerald-50/70' },
  EXAMPLE: { label: 'Example', cls: 'border-amber-200 bg-amber-50/60' },
  CALLOUT: { label: 'Exam tip', cls: 'border-rose-200 bg-rose-50/60' },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Card({ label, cls, children }: { label: string; cls: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      {children}
    </div>
  );
}

function TableBlock({ body }: { body: string }) {
  const j = parseBody<{ caption?: string | null; columns: string[]; rows: string[][] } | string[][]>(body);
  if (!j) return <Rich text={body} />;
  const columns = Array.isArray(j) ? (j[0] ?? []) : j.columns;
  const rows = Array.isArray(j) ? j.slice(1) : j.rows;
  const caption = Array.isArray(j) ? null : j.caption;
  return (
    <figure className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      {caption && <figcaption className="border-b border-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">{caption}</figcaption>}
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50">
          <tr>{columns.map((c, i) => <th key={i} className="px-3 py-1.5 font-semibold"><Rich text={c} /></th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-zinc-100 align-top">
              {r.map((c, k) => <td key={k} className="px-3 py-1.5"><Rich text={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Solved({ body, n }: { body: string; n: number }) {
  const [open, setOpen] = useState(false);
  const j = parseBody<{ problem: string; solution: string; answer: string }>(body);
  if (!j) return <Card label="Solved problem" cls="border-amber-200 bg-amber-50/60"><Rich text={body} /></Card>;
  return (
    <div className="rounded-lg border border-amber-200 bg-white">
      <div className="flex items-start gap-2 px-3 py-2">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-amber-100 text-[11px] font-bold text-amber-800">{n}</span>
        <div className="min-w-0 flex-1 text-sm"><Rich text={j.problem} /></div>
      </div>
      <button onClick={() => setOpen(!open)} className="w-full border-t border-amber-100 px-3 py-1 text-left text-xs font-medium text-amber-800 hover:bg-amber-50">
        {open ? 'Hide solution' : 'Show worked solution'}
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-100 bg-amber-50/40 px-3 py-2 text-sm">
          <Rich text={j.solution} />
          <div className="rounded bg-white px-2 py-1 text-sm"><span className="font-semibold">Answer: </span><Rich text={j.answer} className="inline" /></div>
        </div>
      )}
    </div>
  );
}

function BlockView({ b, solvedNo }: { b: Block; solvedNo: number }) {
  switch (b.type) {
    case 'HEADING':
      return <h2 id={slug(b.body)} className="scroll-mt-16 pt-3 text-base font-semibold tracking-tight">{b.body}</h2>;
    case 'TEXT':
      return <Rich text={b.body} className="text-[15px]" />;
    case 'TABLE':
      return <TableBlock body={b.body} />;
    case 'SOLVED_PROBLEM':
      return <Solved body={b.body} n={solvedNo} />;
    case 'DEFINITION': {
      const j = parseBody<{ term: string; text: string }>(b.body);
      return (
        <Card label="Definition" cls="border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]">
          {j ? <Rich text={`**${j.term}** — ${j.text}`} className="text-sm" /> : <Rich text={b.body} className="text-sm" />}
        </Card>
      );
    }
    case 'FORMULA': {
      const j = parseBody<{ latex: string; text: string | null }>(b.body);
      return (
        <Card label="Formula" cls="border-violet-200 bg-violet-50/60">
          {j ? <DisplayMath tex={j.latex} /> : <pre className="whitespace-pre-wrap font-mono text-sm">{b.body}</pre>}
          {j?.text && <Rich text={j.text} className="text-xs text-zinc-700" />}
        </Card>
      );
    }
    case 'DIAGRAM':
    case 'IMAGE': {
      const src = b.media_asset_id ? `/api/learn/media/${b.media_asset_id}` : b.body;
      return (
        <figure className="rounded-lg border border-zinc-200 bg-white p-2">
          <img src={src} alt={b.alt_text ?? ''} loading="lazy" className="mx-auto max-h-[28rem] w-full object-contain" />
          <figcaption className="mt-1 text-center text-xs text-zinc-500">{b.caption ?? (b.media_asset_id ? b.body : '')}</figcaption>
        </figure>
      );
    }
    case 'OFFICIAL_TEXT': {
      const j = parseBody<{ text: string; page: number | null; paper: string }>(b.body);
      return (
        <div className="rounded-lg border border-zinc-300 bg-white px-3 py-2">
          <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Official syllabus{j?.page ? ` · page ${j.page}` : ''}
          </div>
          <p className="text-sm text-zinc-800">{j ? j.text : b.body}</p>
        </div>
      );
    }
    default: {
      const t = tone[b.type] ?? { label: b.type, cls: 'border-zinc-200 bg-white' };
      return (
        <Card label={t.label} cls={t.cls}>
          <Rich text={b.body} className="text-sm" />
        </Card>
      );
    }
  }
}

export function LearnPage() {
  const { resourceId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const r = useLoad(() => api.resource(resourceId), [resourceId]);
  const [starting, setStarting] = useState(false);
  const toc = useMemo(() => (r.data?.blocks ?? []).filter((b) => b.type === 'HEADING').map((b) => b.body), [r.data]);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  let solved = 0;
  const practise = async () => {
    if (!d.topic) return;
    if (!user) return navigate('/signin');
    setStarting(true);
    try {
      const s = await api.startPractice({ mode: 'PRACTICE', nodeId: d.topic.id, count: 10 });
      navigate(`/practice/${s.session.id}`);
    } finally {
      setStarting(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
      <article className="min-w-0 max-w-3xl">
        <div className="mb-3 border-b border-zinc-200 pb-3">
          {d.topic && (
            <Link to={`/topic/${d.topic.id}`} className="text-xs font-medium text-[var(--color-accent)] hover:underline">
              ← {d.topic.title.length > 80 ? `${d.topic.title.slice(0, 80)}…` : d.topic.title}
            </Link>
          )}
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{d.resource.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">Lesson</Badge>
            {d.resource.origin === 'AI_ASSISTED' && <Badge tone="amber" title="Written with AI assistance; a subject expert has not yet reviewed it.">AI-assisted draft · not expert-reviewed</Badge>}
            {d.resource.verification === 'VERIFIED' && <Badge tone="green">Expert-verified</Badge>}
            {d.resource.preview && <Badge tone="amber">Not published</Badge>}
          </div>
        </div>
        <div className="space-y-3">
          {d.blocks.map((b) => {
            if (b.type === 'SOLVED_PROBLEM') solved++;
            return <BlockView key={b.position} b={b} solvedNo={solved} />;
          })}
        </div>
        {d.topic && (
          <div className="mt-6 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <span className="text-sm text-zinc-600">Finished reading? Test yourself on this topic.</span>
            <Button onClick={practise} disabled={starting}>{starting ? 'Starting…' : 'Practise 10 questions'}</Button>
          </div>
        )}
      </article>
      {toc.length > 0 && (
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-16 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">On this page</div>
            <ol className="space-y-1 text-xs">
              {toc.map((h) => (
                <li key={h}><a href={`#${slug(h)}`} className="text-zinc-600 hover:text-[var(--color-accent)]">{h}</a></li>
              ))}
            </ol>
          </div>
        </nav>
      )}
    </div>
  );
}
