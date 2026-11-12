import { useParams } from 'react-router';
import { api, type Block } from '../api';
import { Badge, ErrorBox, Loading, PageHeader, PreviewBadge, useLoad } from '../ui';

const blockStyle: Record<string, { label: string; cls: string }> = {
  DEFINITION: { label: 'Definition', cls: 'border-l-[var(--color-accent)] bg-[var(--color-accent-soft)]' },
  CONCEPT: { label: 'Concept', cls: 'border-l-sky-500 bg-sky-50' },
  KEY_POINT: { label: 'Key point', cls: 'border-l-emerald-500 bg-emerald-50' },
  IMPORTANT_FACT: { label: 'Remember', cls: 'border-l-emerald-500 bg-emerald-50' },
  FORMULA: { label: 'Formula', cls: 'border-l-violet-500 bg-violet-50' },
  EXAMPLE: { label: 'Example', cls: 'border-l-amber-500 bg-amber-50' },
  SOLVED_PROBLEM: { label: 'Solved problem', cls: 'border-l-amber-500 bg-amber-50' },
  CALLOUT: { label: 'Note', cls: 'border-l-zinc-400 bg-zinc-50' },
  OFFICIAL_TEXT: { label: 'Official syllabus', cls: 'border-l-zinc-900 bg-zinc-50' },
};

function Text({ body }: { body: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {body.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

function Table({ body }: { body: string }) {
  let rows: string[][] = [];
  try {
    rows = JSON.parse(body) as string[][];
  } catch {
    return <Text body={body} />;
  }
  const [head, ...rest] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200">{head?.map((h, i) => <th key={i} className="px-2 py-1 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rest.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100">
              {r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.type === 'HEADING') return <h2 className="pt-2 text-base font-semibold">{b.body}</h2>;
  if (b.type === 'TEXT') return <Text body={b.body} />;
  if (b.type === 'TABLE') return <Table body={b.body} />;
  if (b.type === 'DIAGRAM' || b.type === 'IMAGE') {
    const src = b.media_asset_id ? `/api/learn/media/${b.media_asset_id}` : b.body;
    return (
      <figure className="rounded-lg border border-zinc-200 bg-white p-2">
        <img src={src} alt={b.alt_text ?? ''} loading="lazy" className="mx-auto max-h-96 w-auto" />
        {(b.caption || b.body) && <figcaption className="mt-1 text-center text-xs text-zinc-500">{b.caption ?? (b.media_asset_id ? b.body : '')}</figcaption>}
      </figure>
    );
  }
  const s = blockStyle[b.type] ?? { label: b.type, cls: 'border-l-zinc-300 bg-white' };
  return (
    <div className={`rounded-r-md border-l-4 px-3 py-2 ${s.cls}`}>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{s.label}</div>
      {b.type === 'FORMULA' ? <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm">{b.body}</pre> : <Text body={b.body} />}
    </div>
  );
}

export function LearnPage() {
  const { resourceId = '' } = useParams();
  const r = useLoad(() => api.resource(resourceId), [resourceId]);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data!;
  return (
    <article className="max-w-3xl">
      <PageHeader
        title={d.resource.title}
        subtitle={
          <span className="flex items-center gap-1.5">
            <Badge tone="accent">{d.resource.type.toLowerCase()}</Badge>
            {d.resource.origin === 'AI_ASSISTED' && <Badge tone="amber">AI-assisted draft</Badge>}
            {d.resource.preview && <PreviewBadge />}
          </span>
        }
      />
      <div className="space-y-3">{d.blocks.map((b) => <BlockView key={b.position} b={b} />)}</div>
    </article>
  );
}
