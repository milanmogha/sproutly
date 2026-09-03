'use client';

import { useQuery } from '@tanstack/react-query';
import { Bus, Phone } from 'lucide-react';
import { transportApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { routeDetails } from '@/lib/api/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';
import { count } from '@/lib/utils';

/**
 * The route this teacher rides.
 *
 * `/transport/mine` answers with the one route the signed-in user is attached
 * to — a teacher's is the one they are assigned to as staff, so a teacher who
 * is on no route sees the empty state rather than the whole fleet.
 */
export default function TeacherTransportPage() {
  const transport = useQuery({
    queryKey: ['transport', 'mine'],
    queryFn: transportApi.mine,
  });

  const route = transport.data;
  const details = routeDetails(route);

  return (
    <div className="space-y-5">
      <PageHeader title="Transport" subtitle="The route you ride" />

      {transport.isLoading ? (
        <ListSkeleton rows={2} />
      ) : transport.error ? (
        <ErrorState
          message={errorMessage(transport.error)}
          onRetry={() => transport.refetch()}
        />
      ) : !route ? (
        <EmptyState
          icon={<Bus className="size-6" />}
          title="No transport assigned"
          message="You aren't on a school route. Ask the office if that looks wrong."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
                <Bus className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">
                  {route.title ?? 'School transport'}
                </p>
                {details.routeName && (
                  <p className="text-sm text-[var(--color-text-muted)]">{details.routeName}</p>
                )}
              </div>
            </div>
            <dl>
              <DetailRow label="Vehicle" value={details.vehicleNumber ?? '—'} />
              <DetailRow label="Driver" value={details.driverName ?? '—'} />
              <DetailRow
                label="Driver phone"
                value={
                  details.driverPhone ? (
                    <a
                      href={`tel:${details.driverPhone}`}
                      className="inline-flex items-center gap-1.5 font-bold text-accent"
                    >
                      <Phone className="size-4" />
                      {details.driverPhone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="accent">
                {count(route.assignedStudents?.length ?? 0, 'student')}
              </Badge>
              <Badge tone="info">{count(route.assignedStaff?.length ?? 0, 'staff', 'staff')}</Badge>
            </div>

            {route.notes && (
              <p className="mt-3 border-t border-[var(--color-hairline)] pt-3 text-sm text-[var(--color-text-muted)]">
                {route.notes}
              </p>
            )}
          </Card>

          {!!details.stops?.length && (
            <Card>
              <p className="mb-2 font-display text-lg font-bold">Stops</p>
              <ol className="space-y-2">
                {details.stops.map((stop, index) => (
                  <li key={`${stop.name}-${index}`} className="flex items-baseline gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-bold">{stop.name}</span>
                    {stop.time && (
                      <span className="text-xs text-[var(--color-text-muted)]">{stop.time}</span>
                    )}
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
