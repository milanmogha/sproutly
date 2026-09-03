'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, MapPin, PartyPopper, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { eventsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, listOf, type SchoolEvent } from '@/lib/api/types';
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
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Segmented } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime } from '@/lib/utils';

/**
 * School events. Parents can register for the ones that need it; staff with
 * `canManage` create and remove them.
 */
export function EventsScreen({
  canManage = false,
  canRegister = false,
}: {
  canManage?: boolean;
  canRegister?: boolean;
}) {
  const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SchoolEvent | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ['events', scope],
    queryFn: () => eventsApi.list(scope === 'upcoming' ? { upcoming: true } : undefined),
  });

  const myRegistrations = useQuery({
    queryKey: ['events', 'mine'],
    queryFn: eventsApi.myRegistrations,
    enabled: canRegister,
  });

  // `/events` paginates; `/events/registrations/mine` does not.
  const events = listOf(eventsQuery.data);
  const registeredIds = new Set(listOf(myRegistrations.data).map((event) => entityId(event)));

  const register = useMutation({
    mutationFn: (id: string) => eventsApi.register(id),
    onSuccess: () => {
      toast.success("You're registered.");
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not register you.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => {
      toast.success('Event removed.');
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that event.')),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        subtitle="Concerts, sports days, celebrations"
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New event
            </Button>
          )
        }
      />

      <Segmented
        value={scope}
        onChange={(value) => setScope(value as 'upcoming' | 'all')}
        items={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'all', label: 'All' },
        ]}
      />

      {eventsQuery.isLoading ? (
        <ListSkeleton />
      ) : eventsQuery.error ? (
        <ErrorState
          message={errorMessage(eventsQuery.error)}
          onRetry={() => eventsQuery.refetch()}
        />
      ) : !events.length ? (
        <EmptyState
          icon={<PartyPopper className="size-6" />}
          title={scope === 'upcoming' ? 'Nothing coming up' : 'No events yet'}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {events.map((event) => {
            const id = entityId(event);
            const registered = registeredIds.has(id);
            return (
              <Card key={id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">{event.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatDateTime(event.startDate)}
                      {event.endDate && event.endDate !== event.startDate
                        ? ` – ${formatDate(event.endDate)}`
                        : ''}
                    </p>
                  </div>
                  {canManage && (
                    <IconButton label="Delete event" onClick={() => setDeleting(event)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>

                {event.venue && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                    <MapPin className="size-4 shrink-0" />
                    {event.venue}
                  </p>
                )}
                {event.description && (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {event.description}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-3">
                  {canManage && event.registrationCount != null && (
                    <Badge tone="info">{event.registrationCount ?? 0} registered</Badge>
                  )}
                  {canRegister && (
                    registered ? (
                      <Badge tone="success">You&apos;re registered</Badge>
                    ) : (
                      <Button
                        size="sm"
                        icon={<CalendarPlus className="size-4" />}
                        onClick={() => register.mutate(id)}
                        loading={register.isPending && register.variables === id}
                      >
                        Register
                      </Button>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && <CreateEvent open={creating} onClose={() => setCreating(false)} />}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this event?"
        message={`"${deleting?.title}" will be removed, along with any registrations.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

function CreateEvent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    venue: '',
    audience: 'all',
  });
  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      eventsApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        // datetime-local gives a local string; the API wants ISO-8601.
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        venue: form.venue.trim() || undefined,
        audience: form.audience,
      }),
    onSuccess: () => {
      toast.success('Event created.');
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setForm({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        venue: '',
        audience: 'all',
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that event.')),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New event"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!form.title.trim() || !form.startDate}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Annual day"
          className="sm:col-span-2"
          required
        />
        <Input
          label="Starts"
          type="datetime-local"
          value={form.startDate}
          onChange={(e) => set('startDate', e.target.value)}
          required
        />
        <Input
          label="Ends"
          type="datetime-local"
          value={form.endDate}
          min={form.startDate || undefined}
          onChange={(e) => set('endDate', e.target.value)}
        />
        <Input
          label="Venue"
          value={form.venue}
          onChange={(e) => set('venue', e.target.value)}
          placeholder="School auditorium"
          className="sm:col-span-2"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={4}
          className="sm:col-span-2"
        />
        <Select
          label="Audience"
          value={form.audience}
          onChange={(e) => set('audience', e.target.value)}
          className="sm:col-span-2"
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'parents', label: 'Parents' },
            { value: 'teachers', label: 'Teachers' },
          ]}
        />
      </div>
    </Modal>
  );
}
