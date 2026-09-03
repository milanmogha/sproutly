'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus } from 'lucide-react';
import { useState } from 'react';
import { ownersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, listOf } from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { humanize } from '@/lib/utils';

const PHASE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trial: 'info',
  grace: 'warning',
  expired: 'danger',
  suspended: 'danger',
  none: 'neutral',
};

/**
 * Owners group a customer's branches, so a chain of preschools reads as one
 * account rather than a scatter of unrelated schools.
 */
export default function SuperAdminOwnersPage() {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const owners = useQuery({ queryKey: ['owners'], queryFn: ownersApi.list });
  // `/owners` paginates rather than returning a bare array — listOf takes either.
  const rows = listOf(owners.data);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Owners"
        subtitle={owners.isLoading ? undefined : `${rows.length} customers`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New owner
          </Button>
        }
      />

      {owners.isLoading ? (
        <ListSkeleton />
      ) : owners.error ? (
        <ErrorState message={errorMessage(owners.error)} onRetry={() => owners.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Crown className="size-6" />}
          title="No owners yet"
          message="Create an owner to group a customer's branches together."
          action={
            <Button variant="secondary" onClick={() => setCreating(true)}>
              New owner
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((summary) => (
            <button
              key={entityId(summary.owner)}
              type="button"
              onClick={() => router.push(`/super-admin/owners/${entityId(summary.owner)}`)}
              className="text-left"
            >
              <Card className="h-full transition hover:-translate-y-0.5">
                <div className="mb-2 flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent">
                    <Crown className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">
                      {summary.owner.name}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {summary.owner.contactPerson ?? summary.owner.email ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="accent">
                    {summary.branches} {summary.branches === 1 ? 'branch' : 'branches'}
                  </Badge>
                  {Object.entries(summary.phases ?? {}).map(([phase, count]) => (
                    <Badge key={phase} tone={PHASE_TONE[phase] ?? 'neutral'}>
                      {humanize(phase)} {count}
                    </Badge>
                  ))}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      <CreateOwner open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateOwner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    notes: '',
  });
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      ownersApi.create({
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Owner created.');
      void queryClient.invalidateQueries({ queryKey: ['owners'] });
      setForm({ name: '', contactPerson: '', email: '', phone: '', notes: '' });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that owner.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New owner"
      description="Group a customer's branches under one account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!form.name.trim()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Little Sprouts Group"
          className="sm:col-span-2"
          required
        />
        <Input
          label="Contact person"
          value={form.contactPerson}
          onChange={(e) => set('contactPerson', e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
