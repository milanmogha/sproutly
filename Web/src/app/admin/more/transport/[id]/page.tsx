'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  studentsApi,
  transportApi,
  usersApi,
  MAX_PAGE_LIMIT,
} from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  listOf,
  routeDetails,
  studentName,
} from '@/lib/api/types';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
  SectionTitle,
} from '@/components/ui/primitives';
import { DetailRow } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/form';
import { RouteFormModal } from '@/components/admin/route-form';
import { useToast } from '@/components/ui/toast';

/** Someone who can be put on a route — a child or a teacher. */
interface Rider {
  id: string;
  name: string;
  subtitle?: string;
}

/** Which list an assignment writes to. Matches the API's URL segment. */
type Kind = 'student' | 'staff';

/**
 * One bus route: its vehicle and driver, plus who rides it.
 *
 * The route stores its riders as bare ids, so the roll of students and of
 * teachers is fetched separately and matched up here — the same way the
 * picker knows who is still available to add.
 */
export default function AdminTransportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState<Kind | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const routeQuery = useQuery({
    queryKey: ['transport', id],
    queryFn: () => transportApi.get(id),
    enabled: !!id,
  });
  const route = routeQuery.data;

  const studentsQuery = useQuery({
    queryKey: ['students', 'roll'],
    queryFn: () => studentsApi.list({ limit: MAX_PAGE_LIMIT }),
  });
  const teachersQuery = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: () => usersApi.list({ role: 'teacher' }),
  });

  const students: Rider[] = listOf(studentsQuery.data).map((student) => ({
    id: entityId(student),
    name: studentName(student),
    subtitle: student.admissionNumber,
  }));
  const teachers: Rider[] = listOf(teachersQuery.data).map((teacher) => ({
    id: entityId(teacher),
    name: teacher.name?.trim() || teacher.email,
    subtitle: teacher.email,
  }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transport'] });

  const change = useMutation({
    mutationFn: ({ kind, memberId, add }: { kind: Kind; memberId: string; add: boolean }) => {
      if (kind === 'student') {
        return add
          ? transportApi.assignStudent(id, memberId)
          : transportApi.unassignStudent(id, memberId);
      }
      return add
        ? transportApi.assignStaff(id, memberId)
        : transportApi.unassignStaff(id, memberId);
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.add ? 'Added to the route.' : 'Removed from the route.');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update that assignment.')),
  });

  const remove = useMutation({
    mutationFn: () => transportApi.remove(id),
    onSuccess: () => {
      toast.success('Route deleted.');
      void invalidate();
      router.push('/admin/more/transport');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete that route.')),
  });

  const details = routeDetails(route);
  // Only the details the school actually filled in, the way parents see them.
  const rows = (
    [
      ['Route', details.routeName],
      ['Vehicle', details.vehicleNumber],
      ['Driver', details.driverName],
      ['Driver phone', details.driverPhone],
    ] as const
  ).filter(([, value]) => !!value);

  const section = (
    label: string,
    kind: Kind,
    assignedIds: string[],
    roll: Rider[],
    loading: boolean,
  ) => {
    const byId = new Map(roll.map((rider) => [rider.id, rider]));
    return (
      <Card>
        <SectionTitle
          title={`${label} (${assignedIds.length})`}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" />}
              onClick={() => setPicking(kind)}
            >
              Add
            </Button>
          }
        />
        {loading ? (
          <ListSkeleton rows={2} />
        ) : !assignedIds.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">None assigned yet.</p>
        ) : (
          <ul>
            {assignedIds.map((riderId) => {
              const rider = byId.get(riderId);
              return (
                <li
                  key={riderId}
                  className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2 last:border-0"
                >
                  <Avatar name={rider?.name ?? '?'} id={riderId} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {rider?.name ?? 'Unknown'}
                    </span>
                    {rider?.subtitle && (
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {rider.subtitle}
                      </span>
                    )}
                  </span>
                  <IconButton
                    label={`Remove ${rider?.name ?? 'this rider'} from the route`}
                    onClick={() => change.mutate({ kind, memberId: riderId, add: false })}
                  >
                    <X className="size-4" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    );
  };

  const pickerRoll = picking === 'staff' ? teachers : students;
  const pickerAssigned =
    picking === 'staff' ? (route?.assignedStaff ?? []) : (route?.assignedStudents ?? []);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/more/transport"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="size-4" />
        All routes
      </Link>

      <PageHeader
        title={route?.title ?? 'Transport'}
        subtitle={details.vehicleNumber ?? undefined}
        actions={
          route ? (
            <>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setDeleting(true)}
              >
                Delete
              </Button>
            </>
          ) : undefined
        }
      />

      {routeQuery.isLoading ? (
        <ListSkeleton />
      ) : routeQuery.error ? (
        <ErrorState message={errorMessage(routeQuery.error)} onRetry={() => routeQuery.refetch()} />
      ) : !route ? (
        <EmptyState icon={<Bus className="size-6" />} title="That route no longer exists" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(!!rows.length || !!route.notes) && (
            <Card className="lg:col-span-2">
              {!!rows.length && (
                <dl>
                  {rows.map(([label, value]) => (
                    <DetailRow key={label} label={label} value={value!} />
                  ))}
                </dl>
              )}
              {route.notes && (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">{route.notes}</p>
              )}
            </Card>
          )}

          {section(
            'Students',
            'student',
            route.assignedStudents ?? [],
            students,
            studentsQuery.isLoading,
          )}
          {section(
            'Teachers',
            'staff',
            route.assignedStaff ?? [],
            teachers,
            teachersQuery.isLoading,
          )}
        </div>
      )}

      <RiderPicker
        open={!!picking}
        title={picking === 'staff' ? 'Add a teacher' : 'Add a student'}
        roll={pickerRoll}
        assignedIds={pickerAssigned}
        loading={picking === 'staff' ? teachersQuery.isLoading : studentsQuery.isLoading}
        pendingId={change.isPending ? change.variables?.memberId : undefined}
        onPick={(memberId) =>
          picking && change.mutate({ kind: picking, memberId, add: true })
        }
        onClose={() => setPicking(null)}
      />

      <RouteFormModal
        open={editing}
        existing={route}
        onClose={() => setEditing(false)}
        onSaved={() => void routeQuery.refetch()}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        title={`Delete ${route?.title ?? 'this transport'}?`}
        message="This removes the vehicle and all its assignments."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

/**
 * Picks someone who is not already on the route.
 *
 * Offering an already-assigned rider would be a no-op on the server — the
 * assignment list is a set — so they are filtered out rather than shown and
 * silently ignored.
 */
function RiderPicker({
  open,
  title,
  roll,
  assignedIds,
  loading,
  pendingId,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  roll: Rider[];
  assignedIds: string[];
  loading: boolean;
  pendingId?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();

  const candidates = roll
    .filter((rider) => !assignedIds.includes(rider.id))
    .filter((rider) => !term || rider.name.toLowerCase().includes(term));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search"
        />
        {loading ? (
          <ListSkeleton rows={4} />
        ) : !candidates.length ? (
          <EmptyState
            title="No one left to add"
            message={term ? 'Nobody matches that search.' : 'Everyone is already assigned.'}
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {candidates.map((rider) => (
              <li
                key={rider.id}
                className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2 last:border-0"
              >
                <Avatar name={rider.name} id={rider.id} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{rider.name}</span>
                  {rider.subtitle && (
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {rider.subtitle}
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onPick(rider.id)}
                  loading={pendingId === rider.id}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
