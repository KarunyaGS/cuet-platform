import { ChevronRight, PencilLine, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Button, Empty, ErrorBox, kindLabel, Loading, SectionTitle, useAuth, useLoad } from '../ui';

/**
 * The centre page of Subject → Mock Tests → chapter → topic: the practice that exists for one topic, started the same way as always
 * (the same session API, so counts, scoring and progress are the ones the practice screens already keep).
 */
export function MockTopicPage() {
  const { nodeId = '' } = useParams();
  const t = useLoad(() => api.topic(nodeId), [nodeId]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'PRACTICE' | 'TOPIC_TEST' | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  const start = async (mode: 'PRACTICE' | 'TOPIC_TEST') => {
    if (!user) return navigate('/signin');
    setErr(null);
    setBusy(mode);
    try {
      const s = await api.startPractice({ mode, nodeId });
      navigate(`/practice/${s.session.id}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(null);
    }
  };

  if (t.loading && !t.data) return <Loading />;
  if (t.error) return <ErrorBox error={t.error} onRetry={t.reload} />;
  const d = t.data!;
  const kl = kindLabel(d.topic.kind, d.topic.label);
  const none = d.questionCount === 0;
  const sets: { mode: 'PRACTICE' | 'TOPIC_TEST'; title: string; text: string; action: string; icon: React.ReactNode }[] = [
    { mode: 'PRACTICE', title: 'Practise with instant feedback', text: 'Questions one at a time, with the correct answer and the explanation shown straight after you answer.', action: 'Start practice', icon: <PencilLine aria-hidden className="size-4" /> },
    { mode: 'TOPIC_TEST', title: 'Timed topic test', text: 'The same questions against the clock. Your result and a review come at the end.', action: 'Start timed test', icon: <Timer aria-hidden className="size-4" /> },
  ];
  return (
    <div data-mock-topic>
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link to="/CUET_UG" className="hover:text-accent">
          CUET UG
        </Link>
        {d.paper && (
          <>
            <ChevronRight aria-hidden className="size-3.5" />
            <Link to={`/CUET_UG/subject/${d.paper.id}`} className="hover:text-accent">
              {d.paper.name}
            </Link>
          </>
        )}
        <ChevronRight aria-hidden className="size-3.5" />
        <span>Mock Tests</span>
        {d.breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3.5" />
            <span>{kindLabel(b.kind, b.label) || (b.title.length > 30 ? `${b.title.slice(0, 30)}…` : b.title)}</span>
          </span>
        ))}
        {kl && (
          <span className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3.5" />
            <span aria-current="page" className="font-medium text-ink-2">
              {kl}
            </span>
          </span>
        )}
      </nav>
      <header className="mb-4 border-b border-rule pb-2.5">
        <h1 className="max-w-[58rem] text-lg leading-snug font-semibold break-words text-ink sm:text-xl">{d.topic.title}</h1>
        <p className="num mt-0.5 text-sm text-ink-2">
          Topic-wise practice · {d.questionCount} {d.questionCount === 1 ? 'question' : 'questions'}
        </p>
      </header>

      <section aria-labelledby="mock-sets">
        <SectionTitle id="mock-sets">Question sets</SectionTitle>
        {none ? (
          <Empty>Questions for this topic are still being written.</Empty>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface">
            {sets.map((x) => (
              <li key={x.mode} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5" data-set={x.mode}>
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  {x.icon}
                </span>
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block text-[15px] font-medium text-ink">{x.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-2">{x.text}</span>
                </span>
                <Button onClick={() => start(x.mode)} disabled={busy !== null} kind={x.mode === 'PRACTICE' ? 'primary' : 'secondary'}>
                  {busy === x.mode ? 'Starting…' : x.action}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {err && <ErrorBox error={err} />}
      </section>

    </div>
  );
}
