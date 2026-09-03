'use client';

import { useQuery } from '@tanstack/react-query';
import { schoolsApi } from './endpoints';

/**
 * Whether the signed-in user's school takes online payments.
 *
 * The parent fees screen gates its "Pay" button on this — a school that has
 * turned Razorpay off still has the office as its payment channel. A failed
 * lookup degrades to `false` rather than showing a button that may not work;
 * the office is always a valid way to pay.
 */
export function useSchoolOnlinePayments() {
  const query = useQuery({
    queryKey: ['school', 'mine'],
    queryFn: schoolsApi.mine,
  });

  return {
    enabled: query.data?.onlinePaymentsEnabled ?? false,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
