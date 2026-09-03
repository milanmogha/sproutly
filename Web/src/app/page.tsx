'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Crown, GraduationCap, Users, ArrowRight } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { Splash } from '@/components/brand/splash';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_HOME, type Role } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

/**
 * Landing screen. Pick a role to open its login flow, then its portal.
 * Parents sign in with a one-time code; every other role with a password.
 *
 * A returning user with a live session never really sees this: the effect
 * below sends them straight to their portal.
 */
const ROLE_TILES: Array<{
  role: Role;
  icon: ReactNode;
  tagline: string;
  color: string;
  tint: string;
}> = [
  {
    role: 'parent',
    icon: <Users className="size-7" />,
    tagline: "View your child's day",
    color: 'var(--color-parent)',
    tint: 'var(--color-parent-tint)',
  },
  {
    role: 'teacher',
    icon: <GraduationCap className="size-7" />,
    tagline: 'Mark attendance, plan lessons',
    color: 'var(--color-teacher)',
    tint: 'var(--color-teacher-tint)',
  },
  {
    role: 'admin',
    icon: <Building2 className="size-7" />,
    tagline: 'Manage school operations',
    color: 'var(--color-admin)',
    tint: 'var(--color-admin-tint)',
  },
  {
    role: 'super_admin',
    icon: <Crown className="size-7" />,
    tagline: 'Oversee all schools & users',
    color: 'var(--color-super)',
    tint: 'var(--color-super-tint)',
  },
];

const LOGIN_PATH: Record<Role, string> = {
  parent: '/login/parent',
  teacher: '/login/teacher',
  admin: '/login/admin',
  super_admin: '/login/super-admin',
};

export default function RoleHubPage() {
  const { session, ready, expiredNotice, dismissExpiredNotice } = useAuth();
  const router = useRouter();

  // A restored session goes straight to its portal — the hub is only for
  // people who are actually signed out.
  useEffect(() => {
    if (ready && session?.uiRole) {
      router.replace(ROLE_HOME[session.uiRole]);
    }
  }, [ready, session, router]);

  return (
    <>
      <Splash />
      <main className="min-h-dvh px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-8 sm:mb-12">
            <Logo size={40} />
            <h1 className="mt-7 font-display text-3xl leading-tight font-bold sm:text-4xl">
              Welcome to Sproutly
            </h1>
            <p className="mt-2 max-w-md text-[var(--color-text-muted)]">
              Choose how you&apos;re signing in. Everything for your preschool — attendance,
              fees, academics and daily updates — in one place.
            </p>
          </header>

          {expiredNotice && (
            <div
              role="status"
              className="mb-6 flex items-start justify-between gap-3 rounded-[var(--radius-button)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/15 px-4 py-3"
            >
              <p className="text-sm font-semibold text-[#8a6200]">{expiredNotice}</p>
              <button
                type="button"
                onClick={dismissExpiredNotice}
                className="text-xs font-bold text-[#8a6200] underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {ROLE_TILES.map(({ role, icon, tagline, color, tint }) => (
              <Link
                key={role}
                href={LOGIN_PATH[role]}
                className={cn(
                  'group flex items-center gap-4 rounded-[var(--radius-card)] bg-white p-5 text-left shadow-[var(--shadow-card)]',
                  'transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5',
                )}
              >
                <span
                  className="grid size-14 shrink-0 place-items-center rounded-2xl"
                  style={{ backgroundColor: tint, color }}
                >
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold">
                    {role === 'super_admin'
                      ? 'Super Admin'
                      : role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                  <span className="block text-sm text-[var(--color-text-muted)]">
                    {tagline}
                  </span>
                </span>
                <ArrowRight
                  className="size-5 shrink-0 transition group-hover:translate-x-0.5"
                  style={{ color }}
                />
              </Link>
            ))}
          </div>

          <footer className="mt-10 text-center text-xs text-[var(--color-text-muted)]">
            <Link href="/privacy" className="font-semibold underline">
              Privacy policy
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}
