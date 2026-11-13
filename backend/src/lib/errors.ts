import type { Context } from 'hono';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 422 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string, details?: unknown) => new ApiError(409, 'CONFLICT', message, details);
export const invalid = (message: string, details?: unknown) => new ApiError(422, 'INVALID', message, details);

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_FAILED', message: 'Request did not pass validation', details: err.issues } }, 400);
  }
  const code = (err as { code?: string }).code;
  if (code === 'P2002') return c.json({ error: { code: 'DUPLICATE', message: 'A record with the same unique value already exists' } }, 409);
  if (code === 'P2025') return c.json({ error: { code: 'NOT_FOUND', message: 'Record not found' } }, 404);
  if (code === 'P2003') return c.json({ error: { code: 'REFERENCE_FAILED', message: 'A referenced record does not exist' } }, 422);
  console.error('Unhandled error', err);
  return c.json({ error: { code: 'INTERNAL', message: 'Unexpected server error' } }, 500);
}
