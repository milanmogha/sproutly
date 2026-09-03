'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { ownersApi, schoolsApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  listOf,
  schoolCity,
  schoolOwnerName,
  type Paginated,
  type School,
} from '@/lib/api/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
} from '@/components/ui/primitives';
import { DataList, type Column } from '@/components/ui/data-list';
import { Modal } from '@/components/ui/modal';
import { Input, SearchInput, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatDate, humanize } from '@/lib/utils';

const STATUS_TONE = {
  active: 'success',
  suspended: 'danger',
  inactive: 'neutral',
} as const;

/** Every school on the platform. */
export default function SuperAdminSchoolsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const schools = useQuery({
    queryKey: ['schools', { search, status }],
    queryFn: () =>
      schoolsApi.list({ search: search.trim() || undefined, status: status || undefined }),
  });

  const payload = schools.data;
  const rows = Array.isArray(payload) ? payload : ((payload as Paginated<School>)?.data ?? []);


  const columns: Array<Column<School>> = [
    {
      key: 'name',
      header: 'School',
      hideOnCard: true,
      render: (school) => (
        <div className="min-w-0">
          <p className="truncate font-bold">{school.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{school.code}</p>
        </div>
      ),
    },
    // Already in the card subtitle on mobile.
    { key: 'owner', header: 'Owner', hideOnCard: true, render: schoolOwnerName },
    { key: 'city', header: 'City', secondary: true, render: (school) => schoolCity(school) },
    {
      key: 'contact',
      header: 'Contact',
      secondary: true,
      render: (school) => school.contactEmail ?? school.contactPhone ?? '—',
    },
    {
      key: 'created',
      header: 'Added',
      secondary: true,
      render: (school) => formatDate(school.createdAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (school) => (
        <Badge tone={STATUS_TONE[school.status] ?? 'neutral'}>{humanize(school.status)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Schools"
        subtitle={schools.isLoading ? undefined : `${rows.length} on the platform`}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Add school
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search by name or code" />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      <DataList
        rows={rows}
        columns={columns}
        rowKey={entityId}
        loading={schools.isLoading}
        error={
          schools.error ? (
            <ErrorState message={errorMessage(schools.error)} onRetry={() => schools.refetch()} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<Building2 className="size-6" />}
            title={search || status ? 'No matches' : 'No schools yet'}
            action={
              <Button variant="secondary" onClick={() => setCreating(true)}>
                Add school
              </Button>
            }
          />
        }
        onRowClick={(school) => router.push(`/super-admin/schools/${entityId(school)}`)}
        cardTitle={(school) => school.name}
        cardSubtitle={(school) => `${school.code} · ${schoolOwnerName(school)}`}
      />

      <CreateSchool open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateSchool({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    city: '',
    contactEmail: '',
    contactPhone: '',
    ownerId: '',
    adminName: '',
    adminEmail: '',
  });
  const toast = useToast();
  const queryClient = useQueryClient();
  const owners = useQuery({ queryKey: ['owners'], queryFn: ownersApi.list, enabled: open });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      schoolsApi.create({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        // The API nests the city under `address`; there is no top-level field.
        ...(form.city.trim() ? { address: { city: form.city.trim() } } : {}),
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        ownerId: form.ownerId || undefined,
        // Creating the admin here is what sends their set-password email — the
        // school and the login that runs it are made in one request.
        admin: { name: form.adminName.trim(), email: form.adminEmail.trim() },
      }),
    onSuccess: (school) => {
      // The API reports whether the invite actually left. Saying "emailed"
      // when it bounced would strand an admin who is waiting for a link.
      toast.success(
        school?.adminInvited === false
          ? `School created, but the invite to ${form.adminEmail.trim()} could not be emailed.`
          : `School created. Invite emailed to ${form.adminEmail.trim()}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['schools'] });
      setForm({
        name: '', code: '', city: '', contactEmail: '', contactPhone: '',
        ownerId: '', adminName: '', adminEmail: '',
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that school.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a school"
      description="Its admin is created with it and emailed a link to set their password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={
              !form.name.trim() ||
              !form.code.trim() ||
              !form.adminName.trim() ||
              !form.adminEmail.trim()
            }
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
          className="sm:col-span-2"
          required
        />
        <Input
          label="Code"
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="SPR001"
          hint="Short, unique, uppercase"
          required
        />
        <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <Input
          label="Contact email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => set('contactEmail', e.target.value)}
        />
        <Input
          label="Contact phone"
          type="tel"
          value={form.contactPhone}
          onChange={(e) => set('contactPhone', e.target.value)}
        />
        <Select
          label="Owner"
          value={form.ownerId}
          onChange={(e) => set('ownerId', e.target.value)}
          placeholder="Independent"
          hint="Group branches under one owner"
          className="sm:col-span-2"
          options={listOf(owners.data).map((summary) => ({
            value: entityId(summary.owner),
            label: summary.owner.name,
          }))}
        />

        <div className="sm:col-span-2 mt-1 border-t border-[var(--color-hairline)] pt-4">
          <p className="font-display font-bold">School admin</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            They are emailed a link to set their own password. Nobody can sign in to the
            school until this account exists.
          </p>
        </div>
        <Input
          label="Admin name"
          value={form.adminName}
          onChange={(e) => set('adminName', e.target.value)}
          required
        />
        <Input
          label="Admin email"
          type="email"
          value={form.adminEmail}
          onChange={(e) => set('adminEmail', e.target.value)}
          hint="The invite goes here"
          required
        />
      </div>
    </Modal>
  );
}
