'use client';

import { className as classLabel, entityId, type SchoolClass } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * Picks the class a screen is showing.
 *
 * A rail of chips that scrolls sideways on phones, and a plain select once
 * there are enough classes that chips stop being scannable.
 */
export function ClassPicker({
  classes,
  selectedId,
  onSelect,
  className,
}: {
  classes: SchoolClass[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  if (classes.length < 2) return null;

  if (classes.length > 8) {
    return (
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Class"
        className={cn(
          'w-full rounded-[var(--radius-input)] border border-[var(--color-hairline)] bg-white px-3.5 py-2.5 text-sm font-bold sm:w-auto',
          className,
        )}
      >
        {classes.map((schoolClass) => (
          <option key={entityId(schoolClass)} value={entityId(schoolClass)}>
            {classLabel(schoolClass)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      {classes.map((schoolClass) => {
        const id = entityId(schoolClass);
        const active = id === selectedId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={active}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition',
              active
                ? 'bg-accent text-white shadow-[0_6px_14px_rgb(0_0_0/0.12)]'
                : 'bg-white text-[var(--color-text-muted)] hover:bg-accent-tint hover:text-accent',
            )}
          >
            {classLabel(schoolClass)}
          </button>
        );
      })}
    </div>
  );
}
