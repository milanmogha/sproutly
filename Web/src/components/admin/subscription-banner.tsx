'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { subscriptionsApi } from '@/lib/api/endpoints';
import { cn, formatDate } from '@/lib/utils';

/**
 * Warns an admin that their school's Sproutly subscription needs attention.
 *
 * Silent while the subscription is healthy — the backend decides that with
 * `showWarning`, so this never second-guesses the billing rules. Once the
 * period lapses the API also starts rejecting writes, which is why the
 * read-only case is styled as an error rather than a nudge.
 */
export function SubscriptionBanner() {
  const subscription = useQuery({
    queryKey: ['subscription', 'mine'],
    queryFn: subscriptionsApi.mine,
    // Billing state changes rarely; don't re-ask on every screen change.
    staleTime: 5 * 60_000,
  });

  const state = subscription.data;
  if (!state?.showWarning && !state?.adminReadOnly) return null;

  const blocked = !!state.adminReadOnly || !!state.schoolReadOnly;

  return (
    <div
      role="status"
      className={cn(
        'mb-5 flex flex-col gap-2 rounded-[var(--radius-button)] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        blocked
          ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10'
          : 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/15',
      )}
    >
      <p
        className={cn(
          'inline-flex items-start gap-2 text-sm font-semibold',
          blocked ? 'text-[#c31f4c]' : 'text-[#8a6200]',
        )}
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {blocked
          ? 'Your Sproutly subscription has expired — the school is read-only until it is renewed.'
          : `Your subscription ends ${formatDate(state.periodEnd)}${
              state.daysRemaining !== undefined ? ` (${state.daysRemaining} days left)` : ''
            }.`}
      </p>
      <Link
        href="/admin/more/subscription"
        className="shrink-0 text-sm font-bold underline"
      >
        Manage subscription
      </Link>
    </div>
  );
}
