'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bus, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { transportApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, listOf, routeDetails, type TransportRoute } from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/modal';
import { RouteFormModal } from '@/components/admin/route-form';
import { useToast } from '@/components/ui/toast';
import { count } from '@/lib/utils';

/** Bus routes, their vehicles and drivers, and who rides them. */
export default function AdminTransportPage() {
  const [editing, setEditing] = useState<TransportRoute | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TransportRoute | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const routesQuery = useQuery({ queryKey: ['transport'], queryFn: transportApi.list });
  // `/transport` paginates; listOf accepts either shape.
  const routes = listOf(routesQuery.data);

  const openForm = (route: TransportRoute | null) => {
    setEditing(route);
    setFormOpen(true);
  };

  const remove = useMutation({
    mutationFn: (id: string) => transportApi.remove(id),
    onSuccess: () => {
      toast.success('Route removed.');
      void queryClient.invalidateQueries({ queryKey: ['transport'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that route.')),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transport"
        subtitle={routesQuery.isLoading ? undefined : count(routes.length, 'route')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => openForm(null)}>
            New route
          </Button>
        }
      />

      {routesQuery.isLoading ? (
        <ListSkeleton />
      ) : routesQuery.error ? (
        <ErrorState
          message={errorMessage(routesQuery.error)}
          onRetry={() => routesQuery.refetch()}
        />
      ) : !routes.length ? (
        <EmptyState
          icon={<Bus className="size-6" />}
          title="No routes yet"
          message="Add a route, then assign the children who ride it."
          action={
            <Button variant="secondary" onClick={() => openForm(null)}>
              New route
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {routes.map((route) => {
            const details = routeDetails(route);
            return (
              <Card key={entityId(route)} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">{route.title ?? 'Route'}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {details.vehicleNumber ?? 'No vehicle'} · {details.driverName ?? 'No driver'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Edit route" onClick={() => openForm(route)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label="Delete route" onClick={() => setDeleting(route)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="accent">
                    {count(route.assignedStudents?.length ?? 0, 'student')}
                  </Badge>
                  <Badge tone="neutral">
                    {count(route.assignedStaff?.length ?? 0, 'teacher')}
                  </Badge>
                  {!!details.stops?.length && (
                    <Badge tone="neutral">{count(details.stops.length, 'stop')}</Badge>
                  )}
                </div>

                {details.driverPhone && (
                  <a
                    href={`tel:${details.driverPhone}`}
                    className="mt-2 text-sm font-bold text-accent"
                  >
                    {details.driverPhone}
                  </a>
                )}

                <div className="mt-auto pt-3">
                  <Link
                    href={`/admin/more/transport/${entityId(route)}`}
                    className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline"
                  >
                    Students &amp; teachers
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RouteFormModal
        open={formOpen}
        existing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this route?"
        message="This removes the vehicle and all its assignments. Students on it will no longer show a route in their parents' portal."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}
