'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { CredentialLoginForm } from '@/components/auth/credential-login-form';
import { ParentOtpForm } from '@/components/auth/parent-otp-form';
import { ROLE_LABEL, type Role } from '@/lib/auth/session';

/** URL slug → the role it signs in. `super-admin` reads better than the enum. */
const SLUG_TO_ROLE: Record<string, Role> = {
  parent: 'parent',
  teacher: 'teacher',
  admin: 'admin',
  'super-admin': 'super_admin',
};

const ROLE_ACCENT: Record<Role, string> = {
  parent: 'var(--color-parent)',
  teacher: 'var(--color-teacher)',
  admin: 'var(--color-admin)',
  super_admin: 'var(--color-super)',
};

export default function LoginPage() {
  const params = useParams<{ role: string }>();
  const role = SLUG_TO_ROLE[params.role];
  if (!role) notFound();

  return (
    <main
      data-role={role}
      className="grid min-h-dvh lg:grid-cols-2"
      style={{ ['--accent' as string]: ROLE_ACCENT[role] }}
    >
      {/* The brand panel: decorative, and only worth the space on wide screens. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-hero p-10 text-white lg:flex">
        <Logo size={40} tone="light" />
        <div className="relative z-10">
          <h2 className="font-display text-4xl leading-tight font-bold">
            Everything for your preschool, in one place.
          </h2>
          <p className="mt-3 max-w-sm text-white/85">
            Attendance, fees, academics and daily updates — for parents, teachers and
            administrators alike.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/70">
          © {new Date().getFullYear()} Sproutly
        </p>
        {/* Soft blobs so the panel isn't a flat rectangle of green. */}
        <span className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
        <span className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5" />
      </aside>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="size-4" />
            All roles
          </Link>

          <div className="mb-7 lg:hidden">
            <Logo size={34} />
          </div>

          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {ROLE_LABEL[role]} sign in
          </h1>

          {role === 'parent' ? (
            <ParentOtpForm />
          ) : (
            <CredentialLoginForm role={role} />
          )}
        </div>
      </section>
    </main>
  );
}
