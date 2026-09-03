'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, EmptyState, ListSkeleton } from './primitives';

export interface Column<T> {
  /** Stable key, also used as the React key for the cell. */
  key: string;
  header: string;
  /** Cell contents for a row. */
  render: (row: T) => ReactNode;
  /** Hidden on the mobile card, e.g. a redundant name already in the title. */
  hideOnCard?: boolean;
  /** Dropped on narrower desktops before the table starts to scroll. */
  secondary?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * The one list surface used across all four portals.
 *
 * Above `md` it renders a real table — scannable, dense, sortable-looking —
 * and below it each row becomes a card with the columns as labelled pairs.
 * Screens describe their data once and get both, which is what keeps every
 * list responsive without a second mobile implementation.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  error,
  empty,
  onRowClick,
  cardTitle,
  cardSubtitle,
  cardLeading,
  cardAction,
}: {
  rows: T[] | undefined;
  columns: Array<Column<T>>;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: ReactNode;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Headline on the mobile card — usually the name. */
  cardTitle?: (row: T) => ReactNode;
  cardSubtitle?: (row: T) => ReactNode;
  /** Avatar or icon shown at the start of the mobile card. */
  cardLeading?: (row: T) => ReactNode;
  /** Trailing control (menu, chevron) on both layouts. */
  cardAction?: (row: T) => ReactNode;
}) {
  if (loading) return <ListSkeleton />;
  if (error) return <>{error}</>;
  if (!rows?.length) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }

  return (
    <>
      {/* ── Desktop: a real table ───────────────────────────────── */}
      <Card className="hidden p-0 md:block">
        <div className="scroll-x">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-hairline)]">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-xs font-bold tracking-wide whitespace-nowrap text-[var(--color-text-muted)] uppercase',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {column.header}
                  </th>
                ))}
                {(cardAction || onRowClick) && <th className="w-12" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-[var(--color-hairline)] last:border-0',
                    onRowClick && 'cursor-pointer transition hover:bg-[var(--color-canvas)]',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        column.align === 'right' ? 'text-right' : 'text-left',
                        column.secondary && 'hidden lg:table-cell',
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {(cardAction || onRowClick) && (
                    <td className="px-2 py-3 text-right">
                      {cardAction?.(row) ??
                        (onRowClick && (
                          <ChevronRight className="inline size-4 text-[var(--color-text-muted)]" />
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Mobile: the same rows as cards ──────────────────────── */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const title = cardTitle?.(row);
          const detail = columns.filter((c) => !c.hideOnCard);
          return (
            <Card
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer active:scale-[0.99] transition')}
            >
              {(title || cardLeading) && (
                <div className="mb-3 flex items-center gap-3">
                  {cardLeading?.(row)}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-bold">{title}</div>
                    {cardSubtitle && (
                      <div className="truncate text-xs text-[var(--color-text-muted)]">
                        {cardSubtitle(row)}
                      </div>
                    )}
                  </div>
                  {cardAction?.(row) ??
                    (onRowClick && (
                      <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                    ))}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {detail.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-[10px] font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
                      {column.header}
                    </dt>
                    <dd className="truncate text-sm font-semibold">{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>
    </>
  );
}

/**
 * A labelled value, stacked on phones and side-by-side on desktop. Used all
 * over the profile and detail screens.
 */
export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border-b border-[var(--color-hairline)] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className,
      )}
    >
      <dt className="text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold sm:text-right">{value ?? '—'}</dd>
    </div>
  );
}

/** Responsive tile grid: 1 column on phones, up to 4 on wide screens. */
export function TileGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
  );
}
