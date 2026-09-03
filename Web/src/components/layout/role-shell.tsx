'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NAV } from './nav-config';
import { NotificationBell } from './notification-bell';
import { Logo } from '@/components/brand/logo';
import { Avatar, IconButton } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/modal';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_LABEL, type Role } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

/**
 * The chrome every portal sits inside.
 *
 * One layout, two shapes: a persistent left sidebar from `md` up, and a
 * floating pill bottom-nav below it — the app's own navigation, kept intact on
 * phones. `data-role` sets the accent for the whole subtree, so the same
 * components come out grape for parents and green for admins.
 */
export function RoleShell({
  role,
  title,
  children,
}: {
  role: Role;
  /** Shown in the mobile top bar; the sidebar shows the portal name instead. */
  title?: string;
  children: ReactNode;
}) {
  const items = NAV[role];
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  /** Exact match for a portal root, prefix match for its sub-pages. */
  const isActive = (href: string) =>
    pathname === href || (href !== items[0].href && pathname.startsWith(`${href}/`));

  /**
   * Mirror the role onto <html> so content that portals to document.body —
   * dialogs, sheets, toasts — inherits `--accent` too. Without this a modal
   * renders outside the wrapper below and falls back to the brand green.
   */
  useEffect(() => {
    document.documentElement.dataset.role = role;
    return () => {
      delete document.documentElement.dataset.role;
    };
  }, [role]);

  return (
    <div data-role={role} className="min-h-dvh">
      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 z-30 hidden h-svh w-64 flex-col overflow-y-auto border-r border-[var(--color-hairline)] bg-white md:flex">
        <div className="px-5 py-6">
          <Logo size={32} />
          <p className="mt-3 text-xs font-bold tracking-wide text-accent uppercase">
            {ROLE_LABEL[role]}
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-bold transition',
                isActive(item.href)
                  ? 'bg-accent text-white shadow-[0_6px_14px_rgb(0_0_0/0.12)]'
                  : 'text-[var(--color-text-muted)] hover:bg-accent-tint hover:text-accent',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[var(--color-hairline)] p-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <Avatar name={session?.email} id={session?.userId} size={36} />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-text-muted)]">
              {session?.email || ROLE_LABEL[role]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="flex w-full items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-bold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
          >
            <LogOut className="size-5" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo size={28} showWordmark={false} />
        <span className="min-w-0 flex-1 truncate font-display text-lg font-bold">
          {title ?? ROLE_LABEL[role]}
        </span>
        <NotificationBell role={role} />
        <IconButton label="Log out" onClick={() => setConfirmingLogout(true)}>
          <LogOut className="size-5" />
        </IconButton>
      </header>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="md:pl-64">
        {/* Desktop header strip: the bell lives here, not in the sidebar. */}
        <div className="hidden items-center justify-end gap-2 px-6 pt-5 md:flex">
          <NotificationBell role={role} />
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 md:pt-2 md:pb-10">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────── */}
      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 md:hidden"
      >
        <div className="mx-3 mb-3 flex items-stretch justify-around rounded-[var(--radius-nav)] bg-[var(--color-ink)] px-1.5 py-1.5 shadow-[var(--shadow-nav)]">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[calc(var(--radius-nav)-8px)] px-1 py-2 transition',
                  active ? 'bg-accent text-white' : 'text-[var(--color-on-ink)]/65',
                )}
              >
                {item.icon}
                <span className="w-full truncate text-center text-[10px] font-bold">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ConfirmDialog
        open={confirmingLogout}
        onClose={() => setConfirmingLogout(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout();
        }}
        title="Log out?"
        message="You'll need to sign in again to get back into your portal."
        confirmLabel="Log out"
        destructive
        loading={loggingOut}
      />
    </div>
  );
}
