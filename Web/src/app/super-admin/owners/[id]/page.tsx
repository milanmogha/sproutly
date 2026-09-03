'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Crown, Link2Off, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ownersApi, schoolsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, type Paginated, type School } from '@/lib/api/types';
import {
  Badge,
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
import { Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize } from '@/lib/utils';

const PHASE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trial: 'info',
  grace: 'warning',
  expired: 'danger',
  suspended: 'danger',
  none: 'neutral',
};

/** One customer and every branch they run. */
export default function SuperAdminOwnerPage() {
  const { id } = useParams<{ id: string }>();
  const [attaching, setAttaching] = useState(false);
  const [detaching, setDetaching] = useState<School | null>(null);
  const [deletingOwner, setDeletingOwner] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const owner = useQuery({
    queryKey: ['owners', id],
    // `branches`, not `get`: only this endpoint returns { owner, branches }.
    queryFn: () => ownersApi.branches(id),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['owners'] });

  const detach = useMutation({
    mutationFn: (schoolId: string) => ownersApi.detachSchool(id, schoolId),
    onSuccess: () => {
      toast.success('Branch detached.');
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['schools'] });
      setDetaching(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not detach that branch.')),
  });

  const remove = useMutation({
    mutationFn: () => ownersApi.remove(id),
    onSuccess: () => {
      toast.success('Owner deleted.');
      void invalidate();
      router.replace('/super-admin/owners');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete that owner.')),
  });

  if (owner.isLoading) return <ListSkeleton rows={4} />;
  if (owner.error) {
    return <ErrorState message={errorMessage(owner.error)} onRetry={() => owner.refetch()} />;
  }
  if (!owner.data) return null;

  const { owner: details, branches } = owner.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={details.name}
        subtitle={`${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}`}
        actions={
          <>
            <Button icon={<Plus className="size-4" />} onClick={() => setAttaching(true)}>
              Attach branch
            </Button>
            <Button
              variant="secondary"
              icon={<Trash2 className="size-4" />}
              onClick={() => setDeletingOwner(true)}
            >
              Delete owner
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-accent-tint text-accent">
              <Crown className="size-5" />
            </span>
            <p className="font-display text-lg font-bold">{details.name}</p>
          </div>
          <dl>
            <DetailRow label="Contact person" value={details.contactPerson ?? '—'} />
            <DetailRow
              label="Email"
              value={
                details.email ? (
                  <a href={`mailto:${details.email}`} className="font-bold text-accent">
                    {details.email}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow
              label="Phone"
              value={
                details.phone ? (
                  <a href={`tel:${details.phone}`} className="font-bold text-accent">
                    {details.phone}
                  </a>
                ) : (
                  '—'
                )
              }
            />
          </dl>
          {details.notes && (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">{details.notes}</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Branches" />
          {!branches.length ? (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="No branches attached"
              message="Attach a school to group it under this owner."
            />
          ) : (
            <ul className="space-y-2">
              {branches.map((branch) => (
                <li
                  key={entityId(branch.school)}
                  className="flex items-center gap-3 border-b border-[var(--color-hairline)] py-2 last:border-0"
                >
                  <Link
                    href={`/super-admin/schools/${entityId(branch.school)}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate font-bold">{branch.school.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {branch.school.code}
                      {branch.periodEnd ? ` · ends ${formatDate(branch.periodEnd)}` : ''}
                    </span>
                  </Link>
                  <Badge tone={PHASE_TONE[branch.phase ?? 'none'] ?? 'neutral'}>
                    {humanize(branch.phase ?? 'none')}
                  </Badge>
                  <IconButton
                    label={`Detach ${branch.school.name}`}
                    onClick={() => setDetaching(branch.school)}
                  >
                    <Link2Off className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AttachBranch ownerId={id} open={attaching} onClose={() => setAttaching(false)} />

      <ConfirmDialog
        open={!!detaching}
        onClose={() => setDetaching(null)}
        onConfirm={() => detaching && detach.mutate(entityId(detaching))}
        title="Detach this branch?"
        message={`${detaching?.name} will become an independent school. It isn't deleted.`}
        confirmLabel="Detach"
        loading={detach.isPending}
      />

      <ConfirmDialog
        open={deletingOwner}
        onClose={() => setDeletingOwner(false)}
        onConfirm={() => remove.mutate()}
        title="Delete this owner?"
        message="Their branches become independent schools. No school data is deleted."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

function AttachBranch({
  ownerId,
  open,
  onClose,
}: {
  ownerId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [schoolId, setSchoolId] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const schools = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => schoolsApi.list(),
    enabled: open,
  });

  const payload = schools.data;
  const all = Array.isArray(payload) ? payload : ((payload as Paginated<School>)?.data ?? []);
  // Only schools that aren't already under an owner can be attached.
  const available = all.filter((school) => !school.ownerId);

  const attach = useMutation({
    mutationFn: () => ownersApi.attachSchool(ownerId, schoolId),
    onSuccess: () => {
      toast.success('Branch attached.');
      void queryClient.invalidateQueries({ queryKey: ['owners'] });
      void queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSchoolId('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not attach that school.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach a branch"
      description="Only schools without an owner are listed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => attach.mutate()} loading={attach.isPending} disabled={!schoolId}>
            Attach
          </Button>
        </>
      }
    >
      {schools.isLoading ? (
        <ListSkeleton rows={2} />
      ) : !available.length ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="Nothing to attach"
          message="Every school already belongs to an owner."
        />
      ) : (
        <Select
          label="School"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          placeholder="Choose a school"
          options={available.map((school) => ({
            value: entityId(school),
            label: `${school.name} · ${school.code}`,
          }))}
        />
      )}
    </Modal>
  );
}
