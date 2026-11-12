/**
 * Student-facing endpoints. They read only PUBLISHED, non-demonstration records, never return answer
 * keys before an attempt, and evaluate answers from stored keys with deterministic code (no AI calls).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { readJson } from '../lib/http';
import { evaluateQuestion, evaluateSchema, getQuestionPublic } from '../services/questions';
import { getResource } from '../services/resources';

const pub = new Hono<AppEnv>();

pub.get('/questions/:id', async (c) => c.json(await getQuestionPublic(c.get('prisma'), c.req.param('id'))));
pub.post('/questions/:id/evaluate', async (c) => c.json(await evaluateQuestion(c.get('prisma'), c.req.param('id'), await readJson(c, evaluateSchema))));
pub.get('/resources/:id', async (c) => c.json(await getResource(c.get('prisma'), c.req.param('id'), true)));
pub.get('/topics/:id/content', async (c) => {
  const prisma = c.get('prisma');
  const id = c.req.param('id');
  const [resources, questions] = await Promise.all([
    prisma.learningResource.findMany({ where: { curriculumNodeId: id, status: 'PUBLISHED', isDemonstration: false }, select: { id: true, type: true, title: true, language: true } }),
    prisma.question.findMany({ where: { status: 'PUBLISHED', isDemonstration: false, topics: { some: { curriculumNodeId: id } } }, select: { id: true, type: true, difficulty: true }, take: 100 }),
  ]);
  return c.json({ topicId: id, resources, questions });
});

export default pub;
