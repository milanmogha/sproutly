'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationLink,
  notificationsApi,
  type AppNotification,
} from '@/lib/api/notifications';
import { IconButton } from '@/components/ui/primitives';
import type { Role } from '@/lib/auth/session';
import { cn, formatRelative } from '@/lib/utils';

const ROLE_PATH: Record<Role, string> = {
  parent: '/parent',
  teacher: '/teacher',
  admin: '/admin',
  super_admin: '/super-admin',
};

/**
 * The bell and its dropdown. Polls in the background so a notification that
 * arrives while the tab is open still shows up without a refresh — the app
 * gets this over its socket, which the web client doesn't hold open.
 */
export function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.mine,
    refetchInterval: 60_000,
  });

  const unread = data?.filter((n) => !n.read).length ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Click-outside and Escape both close the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openNotification(notification: AppNotification) {
    if (!notification.read) markRead.mutate(notification._id);
    const href = notificationLink(notification, ROLE_PATH[role]);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div ref={containerRef} className="relative">
      <IconButton label="Notifications" onClick={() => setOpen((v) => !v)}>
        <span className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </IconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 flex max-h-[70dvh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-sheet)]"
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--color-hairline)] px-4 py-3">
            <h2 className="font-display font-bold">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs font-bold text-accent"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!data?.length ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                You&apos;re all caught up.
              </p>
            ) : (
              data.slice(0, 12).map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={cn(
                    'flex w-full gap-3 border-b border-[var(--color-hairline)] px-4 py-3 text-left transition last:border-0 hover:bg-[var(--color-canvas)]',
                    !notification.read && 'bg-accent-tint/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      notification.read ? 'bg-transparent' : 'bg-accent',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {notification.title}
                    </span>
                    <span className="block line-clamp-2 text-xs text-[var(--color-text-muted)]">
                      {notification.body}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold text-[var(--color-text-muted)]">
                      {formatRelative(notification.sentAt ?? notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <Link
            href={`${ROLE_PATH[role]}/notifications`}
            onClick={() => setOpen(false)}
            className="border-t border-[var(--color-hairline)] px-4 py-3 text-center text-sm font-bold text-accent"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
}
