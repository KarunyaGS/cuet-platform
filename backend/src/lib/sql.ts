/**
 * Helpers for raw D1 writes that must be atomic. D1 has no interactive transactions,
 * but `db.batch()` runs its statements as one transaction: all succeed or none do.
 */

/** D1 allows at most 100 bound parameters per statement. */
export const MAX_PARAMS = 100;

/** Timestamps written by raw SQL use the same ISO-8601 form Prisma writes. */
export const nowIso = (): string => new Date().toISOString();

export type Row = Record<string, string | number | null | boolean>;

/** Build multi-row INSERT statements, split so each stays under the parameter limit. */
export function insertRows(db: D1Database, table: string, rows: Row[], mode: 'INSERT' | 'INSERT OR IGNORE' = 'INSERT'): D1PreparedStatement[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]!);
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const values = chunk.flatMap((r) => columns.map((col) => normaliseValue(r[col])));
    statements.push(db.prepare(`${mode} INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`).bind(...values));
  }
  return statements;
}

function normaliseValue(v: Row[string] | undefined): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
