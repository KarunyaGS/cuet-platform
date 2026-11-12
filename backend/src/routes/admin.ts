import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { invalid, notFound } from '../lib/errors';
import { pagination, readJson } from '../lib/http';
import { examCoverage, paperCoverage, topicCoverage } from '../services/coverage';
import { editNode, listExams, listPapers, nodeEditSchema, overview, paperDetail, versionNodes } from '../services/curriculum';
import { importSyllabus, syllabusBundleSchema } from '../services/imports';
import {
  createQuestion, deleteQuestion, evaluateQuestion, evaluateSchema, getQuestionAdmin, listQuestions, questionInputSchema, updateQuestion,
} from '../services/questions';
import { jobReportSchema, paperRegistrySchema, registerPapers, reportJob } from '../services/registry';
import { createResource, deleteResource, getResource, listResources, resourceInputSchema, updateResource } from '../services/resources';
import { applyReview, reviewHistory, reviewSchema } from '../services/review';
import { storeObject } from '../services/storage';

const admin = new Hono<AppEnv>();
const examYear = (c: { req: { query(k: string): string | undefined } }) => {
  const exam = c.req.query('exam');
  const year = Number(c.req.query('year'));
  if (exam !== 'CUET_UG' && exam !== 'CUET_PG') throw invalid('exam must be CUET_UG or CUET_PG');
  if (!Number.isInteger(year)) throw invalid('year is required');
  return { exam, year };
};

// Overview and catalogue
admin.get('/overview', async (c) => c.json(await overview(c.env.DB)));
admin.get('/exams', async (c) => c.json(await listExams(c.get('prisma'))));
admin.get('/papers', async (c) => {
  const { exam, year } = examYear(c);
  return c.json(await listPapers(c.get('prisma'), exam, year, c.req.query('q'), pagination(c)));
});
admin.get('/papers/:id', async (c) => c.json(await paperDetail(c.get('prisma'), c.req.param('id'))));
admin.get('/syllabus-versions/:id/nodes', async (c) => c.json(await versionNodes(c.get('prisma'), c.req.param('id'))));
admin.patch('/nodes/:id', async (c) => c.json(await editNode(c.env.DB, c.req.param('id'), await readJson(c, nodeEditSchema), c.get('actor'))));

// Ingestion: official paper list, pipeline progress, source files, syllabus imports
admin.post('/registry/papers', async (c) => c.json(await registerPapers(c.get('prisma'), c.env.DB, await readJson(c, paperRegistrySchema), c.get('actor'))));
admin.post('/jobs/report', async (c) => c.json(await reportJob(c.env.DB, await readJson(c, jobReportSchema))));
admin.get('/jobs', async (c) => {
  const { exam, year } = examYear(c);
  const { results } = await c.env.DB.prepare('SELECT * FROM extraction_jobs WHERE exam_code = ? AND cycle_year = ? ORDER BY paper_code').bind(exam, year).all();
  return c.json(results);
});
admin.put('/files/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  if (prefix !== 'sources' && prefix !== 'media') throw invalid('prefix must be sources or media');
  const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim();
  return c.json(await storeObject(c.env.MEDIA, prefix, await c.req.arrayBuffer(), type, Number(c.env.MAX_UPLOAD_BYTES) || 26214400));
});
admin.get('/files/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/admin\/files\//, ''));
  if (!/^(sources|media)\/[0-9a-f]{64}\.\w+$/.test(key)) throw invalid('Unknown file key');
  const obj = await c.env.MEDIA.get(key);
  if (!obj) throw notFound('File');
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' } });
});
admin.post('/imports/syllabus', async (c) => c.json(await importSyllabus(c.get('prisma'), c.env.DB, await readJson(c, syllabusBundleSchema), c.get('actor'))));
admin.get('/sources', async (c) => {
  const page = pagination(c);
  const prisma = c.get('prisma');
  const [total, items] = await Promise.all([
    prisma.sourceDocument.count(),
    prisma.sourceDocument.findMany({ orderBy: { title: 'asc' }, skip: page.skip, take: page.pageSize, include: { usagePermission: { select: { code: true, name: true } } } }),
  ]);
  return c.json({ total, items });
});

// Coverage (source-driven)
admin.get('/coverage', async (c) => {
  const { exam, year } = examYear(c);
  return c.json(await examCoverage(c.env.DB, exam, year));
});
admin.get('/coverage/papers', async (c) => {
  const { exam, year } = examYear(c);
  return c.json(await paperCoverage(c.env.DB, exam, year));
});
admin.get('/coverage/papers/:id/topics', async (c) => c.json(await topicCoverage(c.env.DB, c.req.param('id'))));

// Review and publishing
admin.post('/review', async (c) => c.json(await applyReview(c.env.DB, await readJson(c, reviewSchema), c.get('actor'))));
admin.get('/review/history', async (c) => {
  const q = z.object({ entityType: z.string().max(40), entityId: z.string().max(100) }).parse({ entityType: c.req.query('entityType'), entityId: c.req.query('entityId') });
  return c.json(await reviewHistory(c.env.DB, q.entityType, q.entityId));
});

// Question bank (answer keys visible here only)
admin.get('/questions', async (c) =>
  c.json(await listQuestions(c.get('prisma'), {
    testPaperId: c.req.query('testPaperId'), nodeId: c.req.query('nodeId'), status: c.req.query('status'),
    verification: c.req.query('verification'), q: c.req.query('q'), exam: c.req.query('exam'),
  }, pagination(c))),
);
admin.post('/questions', async (c) => c.json(await createQuestion(c.env.DB, await readJson(c, questionInputSchema), c.get('actor')), 201));
admin.get('/questions/:id', async (c) => c.json(await getQuestionAdmin(c.get('prisma'), c.req.param('id'))));
admin.put('/questions/:id', async (c) => c.json(await updateQuestion(c.env.DB, c.req.param('id'), await readJson(c, questionInputSchema), c.get('actor'))));
admin.delete('/questions/:id', async (c) => c.json(await deleteQuestion(c.env.DB, c.req.param('id'), c.get('actor'))));
admin.post('/questions/:id/preview-evaluate', async (c) =>
  c.json(await evaluateQuestion(c.get('prisma'), c.req.param('id'), await readJson(c, evaluateSchema), { allowUnpublished: true })),
);

// Learning resources
admin.get('/resources', async (c) =>
  c.json(await listResources(c.get('prisma'), { nodeId: c.req.query('nodeId'), testPaperId: c.req.query('testPaperId'), status: c.req.query('status') }, pagination(c))),
);
admin.post('/resources', async (c) => c.json(await createResource(c.env.DB, await readJson(c, resourceInputSchema), c.get('actor')), 201));
admin.get('/resources/:id', async (c) => c.json(await getResource(c.get('prisma'), c.req.param('id'))));
admin.put('/resources/:id', async (c) => c.json(await updateResource(c.env.DB, c.req.param('id'), await readJson(c, resourceInputSchema), c.get('actor'))));
admin.delete('/resources/:id', async (c) => c.json(await deleteResource(c.env.DB, c.req.param('id'), c.get('actor'))));

export default admin;
