'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plane, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { leaveApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  leaveSubject,
  listOf,
  type LeaveRequest,
  type LeaveStatus,
} from '@/lib/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Segmented } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize } from '@/lib/utils';

const STATUS_TONE: Record<LeaveStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

/**
 * Leave requests.
 *
 * `apply` is the applicant's own view — parents requesting leave for a child,
 * teachers for themselves — where the only action is to withdraw a pending
 * request. `review` is the approver's queue, where each request can be
 * approved or rejected.
 */
export function LeaveScreen({
  mode,
  studentId,
  title = 'Leave',
}: {
  mode: 'apply' | 'review';
  /** Pre-fills the request for the parent's selected child. */
  studentId?: string;
  title?: string;
}) {
  const [status, setStatus] = useState<'all' | LeaveStatus>(
    mode === 'review' ? 'pending' : 'all',
  );
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const leavesQuery = useQuery({
    queryKey: ['leave', mode, status],
    queryFn: () => leaveApi.list(status === 'all' ? undefined : { status }),
  });

  // `/leave` paginates; listOf accepts either shape.
  const leaves = listOf(leavesQuery.data);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leave'] });

  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'approved' | 'rejected' }) =>
      leaveApi.review(id, { status: next }),
    onSuccess: (_data, variables) => {
      toast.success(variables.next === 'approved' ? 'Leave approved.' : 'Leave rejected.');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update that request.')),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      toast.success('Request withdrawn.');
      void invalidate();
      setCancelling(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not withdraw that request.')),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={mode === 'review' ? 'Requests awaiting your decision' : 'Your leave requests'}
        actions={
          mode === 'apply' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setApplying(true)}>
              Apply for leave
            </Button>
          )
        }
      />

      <Segmented
        value={status}
        onChange={(value) => setStatus(value as 'all' | LeaveStatus)}
        items={[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />

      {leavesQuery.isLoading ? (
        <ListSkeleton />
      ) : leavesQuery.error ? (
        <ErrorState
          message={errorMessage(leavesQuery.error)}
          onRetry={() => leavesQuery.refetch()}
        />
      ) : !leaves.length ? (
        <EmptyState
          icon={<Plane className="size-6" />}
          title="Nothing here"
          message={
            mode === 'review'
              ? 'No leave requests match this filter.'
              : "You haven't requested any leave."
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {leaves.map((leave) => {
            const id = entityId(leave);
            return (
              <Card key={id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold">{leaveSubject(leave)}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatDate(leave.fromDate)}
                      {leave.toDate && leave.toDate !== leave.fromDate
                        ? ` – ${formatDate(leave.toDate)}`
                        : ''}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[leave.status] ?? 'neutral'}>
                    {humanize(leave.status)}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  <span className="font-bold">{humanize(leave.type)}</span>
                  {leave.reason ? ` · ${leave.reason}` : ''}
                </p>
                {leave.reviewNote && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)] italic">
                    Note: {leave.reviewNote}
                  </p>
                )}

                {leave.status === 'pending' && (
                  <div className="mt-auto flex gap-2 pt-3">
                    {mode === 'review' ? (
                      <>
                        <Button
                          size="sm"
                          icon={<Check className="size-4" />}
                          onClick={() => review.mutate({ id, next: 'approved' })}
                          loading={review.isPending && review.variables?.id === id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<X className="size-4" />}
                          onClick={() => review.mutate({ id, next: 'rejected' })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setCancelling(leave)}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {mode === 'apply' && (
        <ApplyLeave open={applying} onClose={() => setApplying(false)} studentId={studentId} />
      )}

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(entityId(cancelling))}
        title="Withdraw this request?"
        message="The school will no longer see it as pending."
        confirmLabel="Withdraw"
        destructive
        loading={cancel.isPending}
      />
    </div>
  );
}

function ApplyLeave({
  open,
  onClose,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  studentId?: string;
}) {
  const [form, setForm] = useState({ type: 'sick', fromDate: '', toDate: '', reason: '' });
  const toast = useToast();
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: () =>
      leaveApi.apply({
        type: form.type,
        fromDate: form.fromDate,
        // A single-day request still needs both ends of the range.
        toDate: form.toDate || form.fromDate,
        reason: form.reason.trim() || undefined,
        ...(studentId ? { studentId } : {}),
      }),
    onSuccess: () => {
      toast.success('Leave requested.');
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      setForm({ type: 'sick', fromDate: '', toDate: '', reason: '' });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not submit that request.')),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => apply.mutate()}
            loading={apply.isPending}
            disabled={!form.fromDate}
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Type"
          value={form.type}
          onChange={(e) => set('type', e.target.value)}
          className="sm:col-span-2"
          options={[
            { value: 'sick', label: 'Sick leave' },
            { value: 'casual', label: 'Casual leave' },
            { value: 'vacation', label: 'Vacation' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Input
          label="From"
          type="date"
          value={form.fromDate}
          onChange={(e) => set('fromDate', e.target.value)}
          required
        />
        <Input
          label="To"
          type="date"
          value={form.toDate}
          min={form.fromDate || undefined}
          onChange={(e) => set('toDate', e.target.value)}
          hint="Leave blank for one day"
        />
        <Textarea
          label="Reason"
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
          rows={3}
          className="sm:col-span-2"
          placeholder="Anything the school should know"
        />
      </div>
    </Modal>
  );
}
