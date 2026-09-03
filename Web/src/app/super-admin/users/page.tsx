'use client';

import { useQuery } from '@tanstack/react-query';
import { UsersRound } from 'lucide-react';
import { useState } from 'react';
import { schoolsApi, usersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, refDoc, type Paginated, type School, type User } from '@/lib/api/types';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
} from '@/components/ui/primitives';
import { DataList, type Column } from '@/components/ui/data-list';
import { SearchInput, Select } from '@/components/ui/form';
import { formatRelative, humanize } from '@/lib/utils';

const ROLE_TONE: Record<string, 'accent' | 'info' | 'success' | 'danger' | 'neutral'> = {
  super_admin: 'danger',
  admin: 'accent',
  principal: 'accent',
  teacher: 'info',
  parent: 'success',
};

/** Every account on the platform, across all schools. */
export default function SuperAdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const schools = useQuery({ queryKey: ['schools', 'all'], queryFn: () => schoolsApi.list() });
  const schoolPayload = schools.data;
  const schoolList = Array.isArray(schoolPayload)
    ? schoolPayload
    : ((schoolPayload as Paginated<School>)?.data ?? []);

  const users = useQuery({
    queryKey: ['users', { search, role, schoolId }],
    queryFn: () =>
      usersApi.list({
        search: search.trim() || undefined,
        role: role || undefined,
        schoolId: schoolId || undefined,
      }),
  });

  const payload = users.data;
  const rows = Array.isArray(payload) ? payload : ((payload as Paginated<User>)?.data ?? []);

  const displayName = (user: User) =>
    user.name ?? [user.firstName, user.lastName].filter(Boolean).join(' ') ?? user.email;

  const schoolName = (user: User) => {
    const school = refDoc<School>(user.schoolId);
    if (school) return school.name;
    // Only the super admin has no school of their own.
    return user.role === 'super_admin' ? 'Platform' : '—';
  };

  const columns: Array<Column<User>> = [
    {
      key: 'name',
      header: 'User',
      hideOnCard: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={displayName(user)} id={entityId(user)} size={36} />
          <div className="min-w-0">
            <p className="truncate font-bold">{displayName(user)}</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      hideOnCard: true, // already in the card subtitle
      header: 'Role',
      render: (user) => (
        <Badge tone={ROLE_TONE[user.role] ?? 'neutral'}>{humanize(user.role)}</Badge>
      ),
    },
    // Also in the card subtitle on mobile.
    { key: 'school', header: 'School', hideOnCard: true, render: schoolName },
    {
      key: 'lastLogin',
      header: 'Last seen',
      secondary: true,
      render: (user) => (user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge tone={user.isActive === false ? 'neutral' : 'success'}>
          {user.isActive === false ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle={users.isLoading ? undefined : `${rows.length} accounts across the platform`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search by name or email" />
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          options={[
            { value: '', label: 'All roles' },
            { value: 'super_admin', label: 'Super admin' },
            { value: 'admin', label: 'Admin' },
            { value: 'principal', label: 'Principal' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'parent', label: 'Parent' },
          ]}
        />
        <Select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          aria-label="Filter by school"
          options={[
            { value: '', label: 'All schools' },
            ...schoolList.map((school) => ({
              value: entityId(school),
              label: school.name,
            })),
          ]}
        />
      </div>

      <DataList
        rows={rows}
        columns={columns}
        rowKey={entityId}
        loading={users.isLoading}
        error={
          users.error ? (
            <ErrorState message={errorMessage(users.error)} onRetry={() => users.refetch()} />
          ) : undefined
        }
        empty={<EmptyState icon={<UsersRound className="size-6" />} title="No users found" />}
        cardTitle={displayName}
        cardSubtitle={(user) => `${humanize(user.role)} · ${schoolName(user)}`}
        cardLeading={(user) => <Avatar name={displayName(user)} id={entityId(user)} size={40} />}
      />
    </div>
  );
}
