'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { usersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { entityId, type Paginated, type User } from '@/lib/api/types';
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
import { Input, SearchInput, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatRelative, humanize } from '@/lib/utils';

const ROLE_TONE: Record<string, 'accent' | 'info' | 'success' | 'neutral'> = {
  admin: 'accent',
  principal: 'accent',
  teacher: 'info',
  parent: 'success',
};

/** Login accounts for the school — invite, deactivate, remove. */
export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ['users', { search, role }],
    queryFn: () => usersApi.list({ search: search.trim() || undefined, role: role || undefined }),
  });

  const payload = users.data;
  const rows = Array.isArray(payload) ? payload : ((payload as Paginated<User>)?.data ?? []);

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => {
      toast.success('User updated.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update that user.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success('User removed.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that user.')),
  });

  const displayName = (user: User) =>
    user.name ?? [user.firstName, user.lastName].filter(Boolean).join(' ') ?? user.email;

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
      header: 'Role',
      render: (user) => (
        <Badge tone={ROLE_TONE[user.role] ?? 'neutral'}>{humanize(user.role)}</Badge>
      ),
    },
    { key: 'phone', header: 'Phone', secondary: true, render: (user) => user.phone ?? '—' },
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
        <button
          type="button"
          onClick={() =>
            toggleActive.mutate({ id: entityId(user), isActive: user.isActive === false })
          }
          title={user.isActive === false ? 'Activate' : 'Deactivate'}
        >
          <Badge tone={user.isActive === false ? 'neutral' : 'success'}>
            {user.isActive === false ? 'Inactive' : 'Active'}
          </Badge>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle={users.isLoading ? undefined : `${rows.length} accounts`}
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
            Add user
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search by name or email" />
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          options={[
            { value: '', label: 'All roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'principal', label: 'Principal' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'parent', label: 'Parent' },
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
        cardSubtitle={(user) => user.email}
        cardLeading={(user) => <Avatar name={displayName(user)} id={entityId(user)} size={40} />}
        cardAction={(user) => (
          <IconButton label={`Remove ${displayName(user)}`} onClick={() => setDeleting(user)}>
            <Trash2 className="size-4" />
          </IconButton>
        )}
      />

      <InviteUser open={inviting} onClose={() => setInviting(false)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Remove this user?"
        message={`${deleting ? displayName(deleting) : 'This user'} will lose access immediately.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}

/**
 * Creates an account. The set-password email goes out with it — there is no
 * second "send invite" step.
 *
 * The link is only put on screen when the email could not be delivered; in
 * that case it is the sole way the person gets in, so it must not be silently
 * swallowed.
 */
function InviteUser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'teacher' });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const invite = useMutation({
    mutationFn: () =>
      usersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role as User['role'],
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      const sentTo = form.email.trim();
      if (result.invited === false) {
        // Nobody was emailed — keep the dialog open on the link so it can be
        // passed on, rather than reporting a success that never arrived.
        toast.error(`Account created, but the invite to ${sentTo} could not be emailed.`);
        setInviteUrl(result.inviteUrl ?? null);
      } else {
        toast.success(`Account created. Invite emailed to ${sentTo}.`);
        onClose();
      }
      setForm({ name: '', email: '', phone: '', role: 'teacher' });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not create that account.')),
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        setInviteUrl(null);
        onClose();
      }}
      title="Add a user"
      description="They are emailed a link to set their own password as soon as you save."
      footer={
        inviteUrl ? (
          <Button
            onClick={() => {
              setInviteUrl(null);
              onClose();
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => invite.mutate()}
              loading={invite.isPending}
              disabled={!form.email.trim()}
            >
              Create
            </Button>
          </>
        )
      }
    >
      {inviteUrl ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            The email could not be sent, so this link is the only way in. Share it with
            them — it expires in a few days.
          </p>
          <Input value={inviteUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            leading={<Mail className="size-4" />}
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            className="sm:col-span-2"
            options={[
              { value: 'teacher', label: 'Teacher' },
              { value: 'admin', label: 'Admin' },
              { value: 'principal', label: 'Principal' },
              { value: 'parent', label: 'Parent' },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
