'use client';

import { useQuery } from '@tanstack/react-query';
import { Bus, Phone, User } from 'lucide-react';
import { transportApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { routeDetails } from '@/lib/api/types';
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';

/** The route the parent's child rides, if the school has assigned one. */
export default function ParentTransportPage() {
  const transport = useQuery({
    queryKey: ['transport', 'mine'],
    queryFn: transportApi.mine,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Transport" subtitle="Your child's route" />

      {transport.isLoading ? (
        <ListSkeleton rows={2} />
      ) : transport.error ? (
        <ErrorState
          message={errorMessage(transport.error)}
          onRetry={() => transport.refetch()}
        />
      ) : !transport.data ? (
        <EmptyState
          icon={<Bus className="size-6" />}
          title="No transport assigned"
          message="Your child isn't on a school route. Contact the office if that looks wrong."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
                <Bus className="size-5" />
              </span>
              <p className="font-display text-lg font-bold">
                {transport.data.title ?? 'Route'}
              </p>
            </div>
            <dl>
              <DetailRow label="Vehicle" value={routeDetails(transport.data).vehicleNumber ?? '—'} />
              <DetailRow label="Driver" value={routeDetails(transport.data).driverName ?? '—'} />
              <DetailRow
                label="Driver phone"
                value={
                  routeDetails(transport.data).driverPhone ? (
                    <a
                      href={`tel:${routeDetails(transport.data).driverPhone}`}
                      className="inline-flex items-center gap-1.5 font-bold text-accent"
                    >
                      <Phone className="size-4" />
                      {routeDetails(transport.data).driverPhone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
            {transport.data.notes && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                {transport.data.notes}
              </p>
            )}
          </Card>

          {!!routeDetails(transport.data).stops?.length && (
            <Card>
              <p className="mb-3 font-display text-lg font-bold">Stops</p>
              <ol className="space-y-3">
                {routeDetails(transport.data).stops!.map((stop, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{stop.name}</span>
                      {stop.time && (
                        <span className="block text-xs text-[var(--color-text-muted)]">
                          {stop.time}
                        </span>
                      )}
                    </span>
                    <User className="size-4 shrink-0 text-[var(--color-hairline)]" />
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
