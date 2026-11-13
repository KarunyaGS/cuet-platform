/**
 * Reviewer API (signed-in people with reviewer permissions). Used by the syllabus reviewer screen.
 *   GET  /queue?exam=&year=          papers with review state and row counts
 *   GET  /papers/:paperId            workspace: version, rows with checks, page checks, people
 *   GET  /sources/:sourceId/file     the original PDF (private copy in R2)
 *   GET  /history?entityType=&entityId=
 *   POST /nodes/:id/edit | /nodes/:id/move | /versions/:id/rows | /decide | /versions/:id/sign-off
 */
import { Hono } from 'hono';
import { listMockPapersAdmin, mockActionSchema, mockPaperAdmin, setMockPaperStatus } from '../services/practice-centre';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { invalid } from '../lib/errors';
import { readJson } from '../lib/http';
import { reviewerAuth } from '../lib/reviewer';
import { contentPapers, contentQuery, listContent, reviewerDashboard } from '../services/admin-console';
import { getQuestionAdmin } from '../services/questions';
import { getResource } from '../services/resources';
import {
  addRows, addRowsSchema, decide, decideSchema, editRow, editSchema, history, moveRow, moveSchema, paperWorkspace, reviewQueue, signOff, signOffSchema, sourceFile,
  type Reviewer,
} from '../services/syllabus-review';

const review = new Hono<AppEnv>();
review.use('*', reviewerAuth);
const me = (c: { get(k: 'user'): AppEnv['Variables']['user'] }): Reviewer => {
  const u = c.get('user');
  return { id: u.id, displayName: u.displayName, permissions: u.permissions ?? [] };
};

review.get('/me', (c) => c.json(c.get('user')));
// Lessons and questions to review (decisions go through /decide; history through /history)
review.get('/dashboard', async (c) => c.json(await reviewerDashboard(c.env.DB, c.get('user').id)));
review.get('/content', async (c) => c.json(await listContent(c.env.DB, contentQuery.parse(Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== ''))))));
review.get('/content/papers', async (c) => c.json(await contentPapers(c.env.DB)));
review.get('/content/QUESTION/:id', async (c) => c.json(await getQuestionAdmin(c.get('prisma'), c.req.param('id'))));
review.get('/content/LEARNING_RESOURCE/:id', async (c) => c.json(await getResource(c.get('prisma'), c.req.param('id'))));
review.get('/queue', async (c) => {
  const exam = c.req.query('exam');
  const year = Number(c.req.query('year'));
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!Number.isInteger(year)) throw invalid('year is required');
  return c.json(await reviewQueue(c.env.DB, exam, year));
});
review.get('/papers/:paperId', async (c) => c.json(await paperWorkspace(c.env.DB, c.req.param('paperId'))));
review.get('/sources/:sourceId/file', async (c) => sourceFile(c.env.DB, c.env.MEDIA, c.req.param('sourceId')));
review.get('/history', async (c) => {
  const q = z.object({ entityType: z.string().max(40), entityId: z.string().max(100) }).parse({ entityType: c.req.query('entityType'), entityId: c.req.query('entityId') });
  return c.json(await history(c.env.DB, q.entityType, q.entityId));
});
review.post('/nodes/:id/edit', async (c) => c.json(await editRow(c.env.DB, c.req.param('id'), await readJson(c, editSchema), me(c))));
review.post('/nodes/:id/move', async (c) => c.json(await moveRow(c.env.DB, c.req.param('id'), await readJson(c, moveSchema), me(c))));
review.post('/versions/:id/rows', async (c) => c.json(await addRows(c.env.DB, c.req.param('id'), await readJson(c, addRowsSchema), me(c)), 201));
// Mock papers: a reviewer reads a draft paper as a whole and approves it (coverage, balance, answer keys).
review.get('/mock-papers', async (c) => c.json(await listMockPapersAdmin(c.env.DB)));
review.get('/mock-papers/:id', async (c) => c.json(await mockPaperAdmin(c.env.DB, c.req.param('id'))));
review.post('/mock-papers/:id/approve', async (c) => {
  const u = c.get('user');
  return c.json(await setMockPaperStatus(c.env.DB, c.req.param('id'), { action: 'APPROVE', note: (await readJson(c, mockActionSchema.pick({ note: true }))).note }, { id: u.id, permissions: u.permissions ?? [] }));
});
review.post('/decide', async (c) => c.json(await decide(c.env.DB, await readJson(c, decideSchema), me(c))));
review.post('/versions/:id/sign-off', async (c) => c.json(await signOff(c.env.DB, c.req.param('id'), await readJson(c, signOffSchema), me(c))));

export default review;
