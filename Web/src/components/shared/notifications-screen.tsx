'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import {
  notificationGroup,
  notificationLink,
  notificationsApi,
  type AppNotification,
} from '@/lib/api/notifications';
import { errorMessage } from '@/lib/api/client';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn, formatRelative } from '@/lib/utils';

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier'];

/** The full notification history, grouped by how recent it is. */
export function NotificationsScreen({ rolePath }: { rolePath: string }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.mine,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const clearRead = useMutation({
    mutationFn: notificationsApi.clearRead,
    onSuccess: () => {
      toast.success('Cleared read notifications.');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;

  /** Bucketed by recency, in a fixed order so the page never reshuffles. */
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: (notifications.data ?? []).filter((n) => notificationGroup(n) === group),
  })).filter((section) => section.items.length > 0);

  function open(notification: AppNotification) {
    if (!notification.read) markRead.mutate(notification._id);
    const href = notificationLink(notification, rolePath);
    if (href) router.push(href);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={
          <>
            {unread > 0 && (
              <Button
                variant="secondary"
                icon={<CheckCheck className="size-4" />}
                onClick={() => markAllRead.mutate()}
                loading={markAllRead.isPending}
              >
                Mark all read
              </Button>
            )}
            {!!notifications.data?.some((n) => n.read) && (
              <Button
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                onClick={() => clearRead.mutate()}
                loading={clearRead.isPending}
              >
                Clear read
              </Button>
            )}
          </>
        }
      />

      {notifications.isLoading ? (
        <ListSkeleton />
      ) : notifications.error ? (
        <ErrorState
          message={errorMessage(notifications.error)}
          onRetry={() => notifications.refetch()}
        />
      ) : !grouped.length ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title="Nothing here"
          message="Notifications from your school will appear here."
        />
      ) : (
        grouped.map((section) => (
          <section key={section.group}>
            <h2 className="mb-2 text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
              {section.group}
            </h2>
            <div className="space-y-2">
              {section.items.map((notification) => (
                <Card
                  key={notification._id}
                  className={cn(
                    'flex items-start gap-3 p-3.5',
                    !notification.read && 'bg-accent-tint/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-2 size-2 shrink-0 rounded-full',
                      notification.read ? 'bg-[var(--color-hairline)]' : 'bg-accent',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-display font-bold">{notification.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{notification.body}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                      {formatRelative(notification.sentAt ?? notification.createdAt)}
                    </p>
                  </button>
                  <IconButton
                    label="Delete notification"
                    onClick={() => remove.mutate(notification._id)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
