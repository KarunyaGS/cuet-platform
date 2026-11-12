import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

/**
 * Create a Prisma client bound to a Cloudflare D1 database binding.
 *
 * Create one per request inside a Worker and disconnect it with
 * `ctx.waitUntil(prisma.$disconnect())` when the response is done.
 *
 * D1 has no interactive transactions. Use `env.DB.batch([...])` (atomic) for
 * multi-row writes that must succeed or fail together.
 */
export function createPrisma(d1: D1Database): PrismaClient {
  return new PrismaClient({ adapter: new PrismaD1(d1) });
}
