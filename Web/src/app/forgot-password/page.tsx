'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { Suspense, useState, type FormEvent } from 'react';
import { authApi } from '@/lib/api/auth';
import { errorMessage, errorStatus } from '@/lib/api/client';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';

/**
 * Kicks off a password reset for the credential roles. The user completes it
 * in the browser via the emailed link.
 *
 * Reports success identically whether or not the address is registered, so
 * this page can't be used to discover which addresses have accounts.
 */
function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(trimmed);
      setSent(true);
    } catch (e) {
      setError(
        errorStatus(e) === 400
          ? "That doesn't look like a valid email."
          : errorStatus(e) === 503
            ? "We couldn't send the link just now. Please try again."
            : errorMessage(e, 'Could not send the reset link. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-[var(--color-success)]" />
        <h2 className="font-display text-xl font-bold">Check your email</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent it a link
          to set a new password. The link expires in an hour.
        </p>
        <Button variant="secondary" block onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <p className="text-sm text-[var(--color-text-muted)]">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.com"
        leading={<Mail className="size-4" />}
        required
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}

export default function ForgotPasswordPage() {
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
        <h1 className="mt-6 font-display text-2xl font-bold sm:text-3xl">Forgot password</h1>
        <Suspense fallback={null}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
