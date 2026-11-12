import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';

export function pagination(c: Context<AppEnv>): { page: number; pageSize: number; skip: number } {
  const max = Number(c.env.MAX_PAGE_SIZE) || 100;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(max, Math.max(1, Number(c.req.query('pageSize')) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export async function readJson<T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = undefined;
  }
  return schema.parse(body);
}
