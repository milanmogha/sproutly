'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Logo size={34} />
        <h1 className="mt-6 font-display text-2xl font-bold sm:text-3xl">Reset your password</h1>
        {/* useSearchParams needs a Suspense boundary to prerender. */}
        <Suspense fallback={null}>
          <SetPasswordForm mode="reset" />
        </Suspense>
      </div>
    </main>
  );
}
