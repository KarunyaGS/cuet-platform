import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { api, type DeckChapter } from '../api';
import { Badge, Button, Empty, ErrorBox, Loading, Meter, PageHeader, useAuth, useLoad } from '../ui';

function kinds(a: DeckChapter['available']) {
  return [
    a.definitions && `${a.definitions} definitions`,
    a.formulas && `${a.formulas} formulas`,
    a.concepts && `${a.concepts} key points`,
    a.figures && `${a.figures} figures`,
    a.comparisons && `${a.comparisons} comparisons`,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Ready-made flashcard decks, one per chapter, with due cards and mastery. Study now adds the chapter's cards, then opens the usual review. */
export function DecksPage() {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const q = useLoad(() => api.flashcardDecks(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  if (ready && !user) return <Navigate to="/signin" replace />;
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  const data = q.data!;

  const study = async (d: DeckChapter) => {
    setBusy(d.chapterId);
    setErr(null);
    try {
      if (d.added < d.available.total) await api.importCards({ nodeId: d.chapterId });
      nav(`/bookmarks/review?chapterId=${d.chapterId}`);
    } catch (e) {
      setErr(e as Error);
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ to: '/bookmarks', label: 'My bookmarks' }}
        title="Flashcard decks"
        subtitle={`${data.totals.available} ready-made cards. ${data.totals.due} due today. Made from the lessons, which a subject expert has not yet checked.`}
      />
      {err && <ErrorBox error={err} />}
      {data.subjects.length === 0 && <Empty>No decks yet.</Empty>}
      {data.subjects.map((s) => (
        <section key={s.paperId ?? 'other'} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">{s.paper}</h2>
          <ul className="grid gap-3">
            {s.chapters.map((d) => (
              <li key={d.chapterId} className="rounded-xl bg-surface p-4 ring-1 ring-inset ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{d.chapter}</h3>
                  {d.draft && <Badge tone="amber">Draft - unverified</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  {d.available.total} cards: {kinds(d.available)}
                </p>
                <div className="mt-3">
                  <Meter value={d.mastery} label={`${d.mastery}% mastered`} />
                  <p className="num mt-1 text-xs text-ink-3">
                    {d.mastery}% mastered, {d.added} added, {d.due} due today, {d.known} known
                  </p>
                </div>
                <div className="mt-3">
                  <Button onClick={() => study(d)} disabled={busy !== null}>
                    {busy === d.chapterId ? 'Getting ready' : d.due > 0 ? `Study now (${d.due} due)` : d.added < d.available.total ? 'Study now' : 'Nothing due'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
