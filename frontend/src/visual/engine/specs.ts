import type { Spec } from './types';

/**
 * Every chapter lab in `visual/specs/` is picked up automatically: a spec file exports `spec` (one lab) or `specs` (several).
 * Adding a chapter lab never needs an edit to a shared file.
 */
const mods = import.meta.glob('../specs/*.{ts,tsx}', { eager: true }) as Record<string, { spec?: Spec; specs?: Spec[] }>;

export const SPECS: Spec[] = Object.values(mods).flatMap((m) => m.specs ?? (m.spec ? [m.spec] : []));
export const specById = (id: string) => SPECS.find((s) => s.id === id);
