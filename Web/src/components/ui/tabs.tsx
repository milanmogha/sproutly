'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  /** Small count shown beside the label, e.g. unread messages. */
  badge?: number;
}

/**
 * A horizontal tab rail. Scrolls sideways on phones rather than wrapping or
 * shrinking the labels into unreadability.
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition',
              active
                ? 'bg-accent text-white shadow-[0_6px_14px_rgb(0_0_0/0.12)]'
                : 'bg-white text-[var(--color-text-muted)] hover:bg-accent-tint hover:text-accent',
            )}
          >
            {item.label}
            {item.badge ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-bold',
                  active ? 'bg-white/25' : 'bg-accent-tint text-accent',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Two-to-four exclusive choices in a single pill — filters, date ranges. */
export function Segmented({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex w-full gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-card)] sm:w-auto',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition sm:flex-none',
              active ? 'bg-accent text-white' : 'text-[var(--color-text-muted)]',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Section wrapper with a heading — groups fields inside long forms. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-base font-bold">{title}</h3>
        {description && (
          <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
