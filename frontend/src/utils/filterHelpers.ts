// Shared filter utilities for column filtering across all table views

/**
 * Check if a value matches a filter set
 * If the set is empty (None selected), nothing matches
 * If the value is in the set, it matches
 */
export function matchesFilter(selected: Set<string>, value: string | undefined): boolean {
  return selected.has(value || '');
}

/**
 * Check if a numeric value matches min/max range filter
 * - Both undefined = no filter, everything matches
 * - min defined = value must be >= min
 * - max defined = value must be <= max
 */
export function matchesNumericFilter(
  value: number | undefined,
  min: number | undefined,
  max: number | undefined
): boolean {
  if (min === undefined && max === undefined) return true;
  const numValue = value ?? 0;
  if (min !== undefined && numValue < min) return false;
  if (max !== undefined && numValue > max) return false;
  return true;
}

/**
 * Intersect persisted filter values with available options
 * - null/undefined = never set, default to all available
 * - [] = explicitly none selected, return empty set
 * - [...] = use these values, filtered to only those still available
 */
export function intersectFilter(
  persisted: string[] | null | undefined,
  available: string[]
): Set<string> {
  if (!Array.isArray(persisted)) return new Set(available);
  if (persisted.length === 0) return new Set();
  const availableSet = new Set(available);
  const valid = persisted.filter((v) => availableSet.has(v));
  return new Set(valid);
}
