'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { holidaysApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, type Holiday } from '@/lib/api/types';
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
import { Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize } from '@/lib/utils';

/** The school holiday calendar; admins can add and remove entries. */
export function HolidaysScreen({ canManage = false }: { canManage?: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list({ year }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => holidaysApi.remove(id),
    onSuccess: () => {
      toast.success('Holiday removed.');
      void queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that holiday.')),
  });

  const sorted = [...(holidays.data ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const today = new Date().setHours(0, 0, 0, 0);

  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Holidays"
        subtitle="When the school is closed"
        actions={
          <>
            <Select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              aria-label="Year"
              className="w-28"
            />
            {canManage && (
              <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                Add holiday
              </Button>
            )}
          </>
        }
      />

      {holidays.isLoading ? (
        <ListSkeleton />
      ) : holidays.error ? (
        <ErrorState message={errorMessage(holidays.error)} onRetry={() => holidays.refetch()} />
      ) : !sorted.length ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title={`No holidays listed for ${year}`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((holiday) => {
            const past = new Date(holiday.date).setHours(0, 0, 0, 0) < today;
            return (
              <Card key={entityId(holiday)} className={past ? 'opacity-60' : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold">{holiday.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatDate(holiday.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {holiday.description && <Badge tone="accent">{humanize(holiday.description)}</Badge>}
                    {canManage && (
                      <IconButton label="Delete holiday" onClick={() => setDeleting(holiday)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && <AddHoliday open={adding} onClose={() => setAdding(false)} />}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this holiday?"
        message={`"${deleting?.title}" will be removed from the calendar.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

/**
 * A holiday is a single date.
 *
 * The API stores one row per day and has no end date, so this deliberately
 * does not offer a range — a week off is added as a day per row. Offering a
 * "To" field here just produced a 400 and lost the entry.
 */
function AddHoliday({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('public');
  const toast = useToast();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      holidaysApi.create({
        title: title.trim(),
        date,
        // No `type` field on the API, so the kind rides along as the
        // description — which is what the card shows anyway.
        ...(type ? { description: type } : {}),
      }),
    onSuccess: () => {
      toast.success('Holiday added.');
      void queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setTitle('');
      setDate('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add that holiday.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add holiday"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!title.trim() || !date}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Diwali"
          className="sm:col-span-2"
          required
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          hint="One row per day — add each day of a longer break separately"
          required
        />
        <Select
          label="Kind"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="sm:col-span-2"
          options={[
            { value: 'public', label: 'Public holiday' },
            { value: 'festival', label: 'Festival' },
            { value: 'vacation', label: 'Vacation' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </div>
    </Modal>
  );
}
