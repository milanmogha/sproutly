'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { staffApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, listOf, staffDetails, staffName, type Staff } from '@/lib/api/types';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
} from '@/components/ui/primitives';
import { DataList, type Column } from '@/components/ui/data-list';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Input, SearchInput, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

/**
 * Teachers and support staff on the school's books.
 *
 * The API keeps these as generic records — the person's name is `title`, and
 * everything else rides in `metadata` — so this screen maps between that and
 * the fields a school actually cares about.
 */
export default function AdminStaffPage() {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() });

  const remove = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      toast.success('Staff member removed.');
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that staff member.')),
  });

  // The list endpoint has no search of its own, so filter what it returns.
  const term = search.trim().toLowerCase();
  const rows = listOf(staff.data).filter((member) => {
    if (!term) return true;
    const details = staffDetails(member);
    return [staffName(member), details.email, details.designation, details.employeeId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const columns: Array<Column<Staff>> = [
    {
      key: 'name',
      header: 'Name',
      hideOnCard: true,
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar name={staffName(member)} id={entityId(member)} size={36} />
          <div className="min-w-0">
            <p className="truncate font-bold">{staffName(member)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {staffDetails(member).employeeId ?? '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      hideOnCard: true, // already the card subtitle
      header: 'Designation',
      render: (member) => staffDetails(member).designation ?? '—',
    },
    {
      key: 'department',
      header: 'Department',
      secondary: true,
      render: (member) => staffDetails(member).department ?? '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (member) => {
        const phone = staffDetails(member).phone;
        return phone ? (
          <a href={`tel:${phone}`} className="font-bold text-accent">
            {phone}
          </a>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'joined',
      header: 'Joined',
      secondary: true,
      render: (member) => formatDate(staffDetails(member).joiningDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => (
        <Badge tone={member.isActive === false ? 'neutral' : 'success'}>
          {member.isActive === false ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        subtitle={staff.isLoading ? undefined : `${rows.length} on the books`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Add staff
          </Button>
        }
      />

      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search staff"
        className="sm:max-w-sm"
      />

      <DataList
        rows={rows}
        columns={columns}
        rowKey={entityId}
        loading={staff.isLoading}
        error={
          staff.error ? (
            <ErrorState message={errorMessage(staff.error)} onRetry={() => staff.refetch()} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<GraduationCap className="size-6" />}
            title={term ? 'No matches' : 'No staff yet'}
            action={
              <Button variant="secondary" onClick={() => setAdding(true)}>
                Add staff
              </Button>
            }
          />
        }
        cardTitle={staffName}
        cardSubtitle={(member) => staffDetails(member).designation ?? ''}
        cardLeading={(member) => <Avatar name={staffName(member)} id={entityId(member)} size={40} />}
        cardAction={(member) => (
          <IconButton label={`Remove ${staffName(member)}`} onClick={() => setDeleting(member)}>
            <Trash2 className="size-4" />
          </IconButton>
        )}
      />

      <AddStaff open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Remove this staff member?"
        message={`${deleting ? staffName(deleting) : 'They'} will be removed from the school's records.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

const EMPTY_STAFF = {
  name: '',
  email: '',
  phone: '',
  designation: 'Teacher',
  department: '',
  employeeId: '',
  joiningDate: '',
  notes: '',
};

function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_STAFF);
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      staffApi.create({
        // `title` is the API's only name field; the rest goes in `metadata`.
        title: form.name.trim(),
        notes: form.notes.trim() || undefined,
        metadata: {
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          designation: form.designation.trim() || undefined,
          department: form.department.trim() || undefined,
          employeeId: form.employeeId.trim() || undefined,
          joiningDate: form.joiningDate || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Staff member added.');
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      setForm(EMPTY_STAFF);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add that staff member.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff"
      description="Give them a login separately, under Users."
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
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="sm:col-span-2"
          required
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
        <Select
          label="Designation"
          value={form.designation}
          onChange={(e) => set('designation', e.target.value)}
          options={[
            { value: 'Teacher', label: 'Teacher' },
            { value: 'Assistant Teacher', label: 'Assistant teacher' },
            { value: 'Principal', label: 'Principal' },
            { value: 'Administrator', label: 'Administrator' },
            { value: 'Support Staff', label: 'Support staff' },
            { value: 'Driver', label: 'Driver' },
          ]}
        />
        <Input
          label="Department"
          value={form.department}
          onChange={(e) => set('department', e.target.value)}
        />
        <Input
          label="Employee ID"
          value={form.employeeId}
          onChange={(e) => set('employeeId', e.target.value)}
        />
        <Input
          label="Joining date"
          type="date"
          value={form.joiningDate}
          onChange={(e) => set('joiningDate', e.target.value)}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  );
}
