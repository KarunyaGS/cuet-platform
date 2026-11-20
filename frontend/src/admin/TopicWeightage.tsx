import { useState } from 'react';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, inputClass, useLoad } from '../ui';
import { consoleApi, type AdminPastPaper, type TopicMappingQueue } from './api';

type Item = TopicMappingQueue['items'][number];
type Draft = { nodeId: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; evidenceNote: string; sourceChecked: boolean; method: 'MANUAL' | 'AI_ASSISTED' };

export function AdminTopicWeightage() {
  const [paperId, setPaperId] = useState('');
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const papers = useLoad(consoleApi.pastPapers, []);
  const queue = useLoad(() => consoleApi.topicMappingQueue({ paperId: paperId || undefined, page, pageSize: 30 }), [paperId, page]);
  const report = useLoad(() => consoleApi.topicWeightageReport({ exam: 'CUET_UG' }), []);

  const draftFor = (item: Item): Draft => drafts[item.entryId] ?? {
    nodeId: item.mapping?.nodeId ?? '', confidence: (item.mapping?.confidence as Draft['confidence']) ?? 'HIGH',
    evidenceNote: item.mapping?.evidenceNote ?? '', sourceChecked: false, method: (item.mapping?.method as Draft['method']) ?? 'MANUAL',
  };
  const changeDraft = (item: Item, part: Partial<Draft>) => setDrafts((all) => ({ ...all, [item.entryId]: { ...draftFor(item), ...part } }));
  const decide = async (item: Item, action: 'SUGGEST' | 'VERIFY' | 'UNRESOLVED' | 'REJECT') => {
    const d = draftFor(item);
    setBusy(item.entryId);
    setError(null);
    try {
      await consoleApi.saveTopicMapping(item.entryId, {
        action, curriculumNodeId: d.nodeId || null, confidence: d.confidence, evidenceNote: d.evidenceNote || null,
        sourceChecked: d.sourceChecked, method: d.method,
      });
      setDrafts((all) => { const copy = { ...all }; delete copy[item.entryId]; return copy; });
      queue.reload();
      report.reload();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Chapter & topic weightage"
        subtitle="Verify official past-paper questions against the syllabus version for that exam year. Only verified mappings from published papers appear in the frequency report."
      />
      <p className="mb-5 rounded-xl border border-marker/30 bg-marker-soft px-4 py-3 text-sm text-ink-2">
        AI-assisted and Prepora-written questions are excluded from official frequencies. Every count shows the paper sample and year coverage; different syllabus versions stay separate. Open the original paper page before verifying a mapping.
      </p>
      {error && <ErrorBox error={error} />}

      <section className="mb-10" aria-labelledby="mapping-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="mapping-title" className="text-base font-semibold text-ink">Question mapping review</h2>
            <p className="mt-1 text-sm text-ink-2">Question wording and page references come from the recorded official paper source.</p>
          </div>
          <label className="grid gap-1 text-xs text-ink-2">
            Filter paper
            <select className={inputClass} value={paperId} onChange={(e) => { setPaperId(e.target.value); setPage(1); }}>
              <option value="">All imported papers</option>
              {(papers.data ?? []).map((p: AdminPastPaper) => <option key={p.id} value={p.id}>{p.year} · {p.subjectName} · {p.title}</option>)}
            </select>
          </label>
        </div>
        {papers.error && <ErrorBox error={papers.error} onRetry={papers.reload} />}
        {queue.error && <ErrorBox error={queue.error} onRetry={queue.reload} />}
        {queue.loading && !queue.data && <Loading />}
        {queue.data && queue.data.items.length === 0 && <Empty>No official past-paper questions are available for mapping.</Empty>}
        {queue.data && queue.data.items.length > 0 && (
          <>
            <p className="mb-2 text-xs text-ink-3">{queue.data.total} questions · page {queue.data.page} of {Math.max(1, queue.data.pages)}. No automatic topic assignment is treated as verified.</p>
            <ol className="space-y-3">
              {queue.data.items.map((item) => {
                const d = draftFor(item);
                const canVerify = Boolean(item.syllabusVersionId && d.nodeId && d.confidence === 'HIGH' && d.sourceChecked && d.evidenceNote.trim().length >= 12);
                return (
                  <li key={item.entryId} className="rounded-xl border border-rule bg-surface p-4" data-mapping-entry={item.entryId}>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink-3">{item.exam.replace('_', '-')} {item.year} · {item.subjectName} · Question {item.position}{item.officialQuestionId ? ` · official ID ${item.officialQuestionId}` : ''}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{item.stem}</p>
                        {item.sourceUrl && <a className="mt-2 inline-block text-xs font-medium text-accent underline" href={`${item.sourceUrl}${item.sourcePage ? `#page=${item.sourcePage}` : ''}`} target="_blank" rel="noreferrer noopener">Open original question paper{item.sourcePage ? ` · page ${item.sourcePage}` : ''}</a>}
                      </div>
                      <Badge tone={item.mapping?.status === 'VERIFIED' ? 'green' : item.mapping?.status === 'UNRESOLVED' || item.mapping?.status === 'REJECTED' ? 'red' : 'zinc'}>{item.mapping?.status ?? 'UNMAPPED'}</Badge>
                    </div>

                    {!item.syllabusVersionId ? (
                      <p className="mt-3 rounded-lg bg-wrong-soft px-3 py-2 text-xs text-wrong">No syllabus version exists for this exact examination year and subject. Add/verify that version before mapping; this paper will not be cross-mapped to another year.</p>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs text-ink-2">
                          Matching syllabus topic · version {item.syllabusVersionNumber} ({item.year})
                          {item.syllabusUrl && <a className="text-accent underline" href={`${item.syllabusUrl}${d.nodeId ? `#page=${item.topics.find((t) => t.id === d.nodeId)?.sourcePage ?? 1}` : ''}`} target="_blank" rel="noreferrer noopener">Open this year’s official syllabus</a>}
                          <select className={inputClass} value={d.nodeId} onChange={(e) => changeDraft(item, { nodeId: e.target.value })}>
                            <option value="">Choose a topic or leave unmapped</option>
                            {item.topics.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-ink-2">
                          Mapping method
                          <select className={inputClass} value={d.method} onChange={(e) => changeDraft(item, { method: e.target.value as Draft['method'] })}>
                            <option value="MANUAL">Manual reviewer mapping</option>
                            <option value="AI_ASSISTED">AI-assisted suggestion · requires human verification</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-ink-2">
                          Confidence
                          <select className={inputClass} value={d.confidence} onChange={(e) => changeDraft(item, { confidence: e.target.value as Draft['confidence'] })}>
                            <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs text-ink-2 sm:col-span-2">
                          Evidence / reason
                          <textarea className={`${inputClass} min-h-16`} value={d.evidenceNote} onChange={(e) => changeDraft(item, { evidenceNote: e.target.value })} placeholder="Explain the concept tested and where it appears in the verified syllabus." />
                        </label>
                        <label className="flex items-start gap-2 text-xs text-ink-2 sm:col-span-2">
                          <input type="checkbox" checked={d.sourceChecked} onChange={(e) => changeDraft(item, { sourceChecked: e.target.checked })} />
                          I checked the original question-paper page and this topic mapping against the cited syllabus version.
                        </label>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button kind="secondary" size="sm" disabled={busy === item.entryId || !d.nodeId || !item.syllabusVersionId} onClick={() => void decide(item, 'SUGGEST')}>Save suggestion</Button>
                      <Button size="sm" disabled={busy === item.entryId || !canVerify} title={!canVerify ? 'Choose a topic, high confidence, evidence, and confirm the source check' : undefined} onClick={() => void decide(item, 'VERIFY')}>Verify mapping</Button>
                      <Button kind="ghost" size="sm" disabled={busy === item.entryId || !d.evidenceNote.trim()} onClick={() => void decide(item, 'UNRESOLVED')}>Mark unresolved</Button>
                      <Button kind="ghost" size="sm" disabled={busy === item.entryId || !d.evidenceNote.trim()} onClick={() => void decide(item, 'REJECT')}>Reject mapping</Button>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-3">Question verification: {item.questionVerification} · answer key: {item.keyVersion} · paper: {item.paperStatus} · syllabus: {item.syllabusVerification ?? 'missing'}{item.historyCount ? ` · prior review events: ${item.historyCount}` : ''}</p>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex justify-end gap-2">
              <Button kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button kind="secondary" disabled={page >= queue.data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="report-title">
        <h2 id="report-title" className="text-base font-semibold text-ink">Verified frequency report</h2>
        <p className="mb-3 mt-1 text-sm text-ink-2">This report stays separate by exact examination-year syllabus version. It does not combine incompatible syllabi.</p>
        {report.error && <ErrorBox error={report.error} onRetry={report.reload} />}
        {report.loading && !report.data && <Loading />}
        {report.data && report.data.length === 0 && <Empty>No frequency statistics are available yet. A statistic appears only after its paper, answer key, syllabus, and mappings have been verified and the paper is published.</Empty>}
        <div className="space-y-4">
          {(report.data ?? []).map((g) => (
            <article key={g.syllabusVersionId} className="overflow-hidden rounded-xl border border-rule bg-surface">
              <div className="border-b border-rule px-4 py-3">
                <h3 className="text-sm font-semibold text-ink">{g.exam.replace('_', '-')} {g.year} · {g.subjectName} · syllabus v{g.syllabusVersionNumber}</h3>
                <p className="mt-1 text-xs text-ink-2">Sample: {g.sampleSize} official questions across {g.paperCount} published paper{g.paperCount === 1 ? '' : 's'} · year coverage: {g.yearCoverage.join(', ')} · {g.mappedCount}/{g.sampleSize} questions mapped ({g.mappingCoveragePercent}% coverage)</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">{g.sourcePapers.map((p, i) => <a key={`${p.title}-${i}`} className="text-accent underline" href={p.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {p.year}{p.examDate ? ` ${p.examDate}` : ''}{p.shift ? ` ${p.shift}` : ''} · {p.title}</a>)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-rule text-left text-xs text-ink-2"><th className="px-4 py-2">Syllabus topic</th><th className="px-4 py-2 text-right">Questions</th><th className="px-4 py-2 text-right">Share of sample</th><th className="px-4 py-2 text-right">Sample / year</th></tr></thead>
                  <tbody>{g.topics.filter((t) => t.questionCount > 0).map((t) => <tr key={t.id} className="border-b border-rule last:border-0"><td className="px-4 py-2 text-ink">{t.title}</td><td className="num px-4 py-2 text-right">{t.questionCount}</td><td className="num px-4 py-2 text-right">{t.percentOfPaperSample}%</td><td className="num px-4 py-2 text-right text-ink-2">{g.sampleSize} · {g.yearCoverage.join(', ')}</td></tr>)}</tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
