'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usersApi, type NotificationPrefs } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_LABEL } from '@/lib/auth/session';
import { Avatar, Button, Card, PageHeader, Skeleton } from '@/components/ui/primitives';
import { Input, Switch } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';

/**
 * The notification toggles, in the order they read best.
 *
 * These keys are the API's, exactly — it rejects any others — so this list is
 * the one place they are spelled out.
 */
const PREF_SWITCHES: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}> = [
  {
    key: 'messageNotifications',
    label: 'Messages',
    description: 'Replies in your conversations',
  },
  {
    key: 'attendanceAlerts',
    label: 'Attendance',
    description: 'Absences and late arrivals',
  },
  {
    key: 'homeworkNotifications',
    label: 'Homework',
    description: 'New work and due dates',
  },
  { key: 'feeReminders', label: 'Fees', description: 'New invoices and dues' },
  {
    key: 'eventReminders',
    label: 'Events',
    description: 'Upcoming events and holidays',
  },
];

/** The signed-in user's own details and contact preferences. Shared by all roles. */
export function ProfileScreen() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ['users', 'me'],
    // There is no `/users/me` read endpoint, so this reads the user's own record.
    queryFn: () => usersApi.get(session?.userId ?? ''),
    enabled: !!session?.userId,
  });

  const notificationPrefs = useQuery({
    queryKey: ['users', 'me', 'notification-prefs'],
    queryFn: usersApi.notificationPrefs,
  });

  useEffect(() => {
    if (me.data) {
      setName(me.data.name ?? '');
      setPhone(me.data.phone ?? '');
    }
  }, [me.data]);

  useEffect(() => {
    if (notificationPrefs.data) setPrefs(notificationPrefs.data);
  }, [notificationPrefs.data]);

  const saveProfile = useMutation({
    mutationFn: () => usersApi.updateMe({ name: name.trim(), phone: phone.trim() }),
    onSuccess: () => {
      toast.success('Profile saved.');
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save your profile.')),
  });

  const savePrefs = useMutation({
    mutationFn: (next: NotificationPrefs) => usersApi.updateNotificationPrefs(next),
    onSuccess: (data) => {
      setPrefs(data);
      toast.success('Preferences updated.');
    },
    onError: (error) => {
      // Put the toggle back — the server didn't take the change.
      setPrefs(notificationPrefs.data ?? {});
      toast.error(errorMessage(error, 'Could not update your preferences.'));
    },
  });

  function togglePref(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs.mutate(next);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My profile" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={name || session?.email} id={session?.userId} size={52} />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{name || 'Your name'}</p>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {session?.email}
                {session?.uiRole ? ` · ${ROLE_LABEL[session.uiRole]}` : ''}
              </p>
            </div>
          </div>

          {me.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
              <Input
                label="Phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                icon={<Save className="size-4" />}
                onClick={() => saveProfile.mutate()}
                loading={saveProfile.isPending}
              >
                Save changes
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-1 font-display text-lg font-bold">Notifications</p>
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">
            Choose how you&apos;d like to be reached.
          </p>
          {notificationPrefs.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-hairline)]">
              {PREF_SWITCHES.map(({ key, label, description }) => (
                <Switch
                  key={key}
                  label={label}
                  description={description}
                  // The API defaults every preference on, and treats a missing
                  // one as opted in, so an absent key reads as checked here too.
                  checked={prefs[key] ?? true}
                  onCheckedChange={(value) => togglePref(key, value)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
