'use client';

import { useChild } from '@/lib/parent/child-context';
import { Avatar } from '@/components/ui/primitives';
import { useQuery } from '@tanstack/react-query';
import { classesApi } from '@/lib/api/endpoints';
import { className as classLabel, entityId, studentName } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * Switches between a parent's children. Renders nothing for the common case of
 * a single child — a picker with one option is just noise.
 */
export function ChildSwitcher() {
  const { children, selectedId, select } = useChild();
  // The class arrives as a bare id on the student record.
  const classes = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });
  if (children.length < 2) return null;

  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {children.map((child) => {
        const id = entityId(child);
        const active = id === selectedId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 transition',
              active
                ? 'bg-accent text-white shadow-[0_6px_14px_rgb(0_0_0/0.12)]'
                : 'bg-white text-[var(--color-text-muted)] hover:bg-accent-tint',
            )}
          >
            <Avatar name={studentName(child)} id={id} src={child.photoUrl} size={30} />
            <span className="text-left">
              <span className="block text-sm font-bold whitespace-nowrap">
                {studentName(child)}
              </span>
              <span
                className={cn(
                  'block text-[10px] font-semibold whitespace-nowrap',
                  active ? 'text-white/75' : 'text-[var(--color-text-muted)]',
                )}
              >
                {classLabel(child.classId, classes.data)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
