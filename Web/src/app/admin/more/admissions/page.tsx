'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Phone, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { admissionsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, listOf, type Inquiry, type InquiryStatus } from '@/lib/api/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  StatTile,
} from '@/components/ui/primitives';
import { DataList, TileGrid, type Column } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { academicYear, formatDate, humanize } from '@/lib/utils';

const STATUS_TONE: Record<InquiryStatus, 'warning' | 'info' | 'accent' | 'success' | 'neutral'> = {
  new: 'warning',
  contacted: 'info',
  visited: 'accent',
  converted: 'success',
  closed: 'neutral',
};

/** Admission inquiries, from first call to enrolled. */
export default function AdminAdmissionsPage() {
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Inquiry | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const inquiries = useQuery({
    queryKey: ['admissions', 'inquiries', status],
    queryFn: () => admissionsApi.inquiries({ status: status || undefined }),
  });

  const stats = useQuery({ queryKey: ['admissions', 'stats'], queryFn: admissionsApi.stats });
  const inquiryCounts = stats.data?.inquiries ?? { total: 0, byStatus: {} };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admissions'] });

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: InquiryStatus }) =>
      admissionsApi.updateInquiry(id, { status: next }),
    onSuccess: () => {
      toast.success('Inquiry updated.');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update that inquiry.')),
  });

  const convert = useMutation({
    // `academicYear` is required — the application has to be filed against a
    // session — and the API rejects the call without it.
    mutationFn: (id: string) =>
      admissionsApi.convertInquiry(id, { academicYear: academicYear() }),
    onSuccess: () => {
      toast.success('Converted to an application.');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not convert that inquiry.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => admissionsApi.removeInquiry(id),
    onSuccess: () => {
      toast.success('Inquiry removed.');
      void invalidate();
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that inquiry.')),
  });

  const columns: Array<Column<Inquiry>> = [
    {
      key: 'child',
      header: 'Child',
      hideOnCard: true,
      render: (inquiry) => (
        <div className="min-w-0">
          <p className="truncate font-bold">{inquiry.childName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {inquiry.gradeInterested ?? '—'}
          </p>
        </div>
      ),
    },
    // Already in the card subtitle on mobile.
    {
      key: 'parent',
      header: 'Parent',
      hideOnCard: true,
      render: (inquiry) => inquiry.parentName,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (inquiry) => (
        <a href={`tel:${inquiry.parentPhone}`} className="inline-flex items-center gap-1 font-bold text-accent">
          <Phone className="size-3.5" />
          {inquiry.parentPhone}
        </a>
      ),
    },
    {
      key: 'created',
      header: 'Received',
      secondary: true,
      render: (inquiry) => formatDate(inquiry.createdAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inquiry) => (
        <Select
          value={inquiry.status}
          onChange={(e) =>
            updateStatus.mutate({
              id: entityId(inquiry),
              next: e.target.value as InquiryStatus,
            })
          }
          aria-label={`Status for ${inquiry.childName}`}
          className="w-36"
          options={[
            { value: 'new', label: 'New' },
            { value: 'contacted', label: 'Contacted' },
            { value: 'visited', label: 'Visited' },
            { value: 'converted', label: 'Converted' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admissions"
        subtitle="Inquiries and applications"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            New inquiry
          </Button>
        }
      />

      {/*
        Inquiry counts, not application counts — the two pipelines have
        different statuses and this screen is the inquiry list.
      */}
      <TileGrid>
        <StatTile
          label="Total"
          value={inquiryCounts.total ?? listOf(inquiries.data).length}
          icon={<UserPlus className="size-5" />}
          color="var(--color-grape)"
        />
        <StatTile label="New" value={inquiryCounts.byStatus?.new ?? 0} color="var(--color-sunny)" />
        <StatTile
          label="Visited"
          value={inquiryCounts.byStatus?.visited ?? 0}
          color="var(--color-blue)"
        />
        <StatTile
          label="Converted"
          value={inquiryCounts.byStatus?.converted ?? 0}
          color="var(--color-success)"
        />
      </TileGrid>

      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="Filter by status"
        className="sm:max-w-52"
        options={[
          { value: '', label: 'All statuses' },
          { value: 'new', label: 'New' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'visited', label: 'Visited' },
          { value: 'converted', label: 'Converted' },
          { value: 'closed', label: 'Closed' },
        ]}
      />

      <DataList
        rows={listOf(inquiries.data)}
        columns={columns}
        rowKey={entityId}
        loading={inquiries.isLoading}
        error={
          inquiries.error ? (
            <ErrorState
              message={errorMessage(inquiries.error)}
              onRetry={() => inquiries.refetch()}
            />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<UserPlus className="size-6" />}
            title="No inquiries"
            message="Walk-ins and phone enquiries are logged here."
            action={
              <Button variant="secondary" onClick={() => setAdding(true)}>
                New inquiry
              </Button>
            }
          />
        }
        cardTitle={(inquiry) => inquiry.childName}
        // Status is left out here on purpose — it has its own column below,
        // where it is a live control rather than a label.
        cardSubtitle={(inquiry) => inquiry.parentName}
        cardAction={(inquiry) => (
          <div className="flex items-center gap-1">
            {inquiry.status !== 'converted' && (
              <IconButton
                label={`Convert ${inquiry.childName} to an application`}
                onClick={() => convert.mutate(entityId(inquiry))}
              >
                <ArrowRight className="size-4" />
              </IconButton>
            )}
            <IconButton
              label={`Remove ${inquiry.childName}`}
              onClick={() => setDeleting(inquiry)}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        )}
      />

      <AddInquiry open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Remove this inquiry?"
        message={`The inquiry for ${deleting?.childName} will be deleted.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

function AddInquiry({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    childName: '',
    childDateOfBirth: '',
    gender: '',
    parentName: '',
    parentPhone: '',
    gradeInterested: '',
    notes: '',
  });
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      admissionsApi.createInquiry({
        childName: form.childName.trim(),
        // Both are needed to turn this into an application later, and there is
        // nowhere else to collect them — so they are asked for up front.
        childDateOfBirth: form.childDateOfBirth,
        gender: form.gender,
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        gradeInterested: form.gradeInterested.trim() || undefined,
        notes: form.notes.trim() || undefined,
        // `status` is server-set (new on creation) and rejected if sent.
      }),
    onSuccess: () => {
      toast.success('Inquiry logged.');
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      setForm({
        childName: '',
        childDateOfBirth: '',
        gender: '',
        parentName: '',
        parentPhone: '',
        gradeInterested: '',
        notes: '',
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not log that inquiry.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New inquiry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={
              !form.childName.trim() ||
              !form.childDateOfBirth ||
              !form.gender ||
              !form.parentName.trim() ||
              !form.parentPhone.trim()
            }
          >
            Log inquiry
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Child's name"
          value={form.childName}
          onChange={(e) => set('childName', e.target.value)}
          required
        />
        <Input
          label="Interested in"
          value={form.gradeInterested}
          onChange={(e) => set('gradeInterested', e.target.value)}
          placeholder="Nursery"
        />
        <Input
          label="Date of birth"
          type="date"
          value={form.childDateOfBirth}
          onChange={(e) => set('childDateOfBirth', e.target.value)}
          required
        />
        <Select
          label="Gender"
          value={form.gender}
          onChange={(e) => set('gender', e.target.value)}
          placeholder="Choose"
          required
          options={[
            { value: 'female', label: 'Girl' },
            { value: 'male', label: 'Boy' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Input
          label="Parent's name"
          value={form.parentName}
          onChange={(e) => set('parentName', e.target.value)}
          required
        />
        <Input
          label="Parent's phone"
          type="tel"
          value={form.parentPhone}
          onChange={(e) => set('parentPhone', e.target.value)}
          required
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
