import { FilterQuery } from 'mongoose';

/**
 * Folds a tenant scope into a Mongoose filter. Pass `null` (super admin,
 * no schoolId on their token) to leave the filter unscoped across schools.
 */
export function scopeFilter<T>(
  filter: FilterQuery<T>,
  schoolId: string | null,
): FilterQuery<T> {
  if (schoolId) {
    (filter as Record<string, unknown>).schoolId = schoolId;
  }
  return filter;
}
