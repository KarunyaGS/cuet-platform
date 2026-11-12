import type { MiddlewareHandler } from 'hono';
import { createPrisma } from '@cuet/database';
import type { AppEnv } from '../types';

/** One Prisma client per request, bound to the D1 binding, disconnected after the response. */
export const prismaMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const prisma = createPrisma(c.env.DB);
  c.set('prisma', prisma);
  try {
    await next();
  } finally {
    const done = prisma.$disconnect();
    try {
      c.executionCtx.waitUntil(done);
    } catch {
      await done; // no execution context (e.g. some tests)
    }
  }
};
