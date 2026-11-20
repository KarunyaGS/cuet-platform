import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import { ErrorBox, Loading } from '../ui';

/** Starts a practice set for one topic straight away (used by the study plan), then opens it. */
export function PracticeStartPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<Error | null>(null);
  const started = useRef(false);
  const nodeId = params.get('nodeId') ?? '';
  const count = Math.min(30, Math.max(1, Number(params.get('count')) || 10));
  useEffect(() => {
    if (started.current || !nodeId) return;
    started.current = true;
    api.startPractice({ mode: 'PRACTICE', nodeId, count }).then(
      (s) => navigate(`/practice/${s.session.id}`, { replace: true }),
      (e: Error) => setErr(e),
    );
  }, [nodeId, count, navigate]);
  if (!nodeId) return <ErrorBox error={new Error('No topic was chosen for this practice.')} />;
  return err ? (
    <div>
      <ErrorBox error={err} />
      <p className="mt-3 text-sm"><Link to="/planner" className="text-accent hover:underline">Back to your planner</Link></p>
    </div>
  ) : (
    <Loading />
  );
}
