'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, Lock, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/client';
import { Button, Spinner } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';

/**
 * Sets a password from an emailed link.
 *
 * Two flows, one form: `invite` activates a brand-new account, `reset` changes
 * the password on an existing one. The token comes from the URL either way,
 * and neither endpoint issues a session — both end at "now sign in".
 */
export function SetPasswordForm({ mode }: { mode: 'invite' | 'reset' }) {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  // Check the link before showing the form, so an expired one says so up front
  // rather than after the person has typed a password twice.
  const check = useQuery({
    queryKey: ['auth', mode, token],
    queryFn: () =>
      mode === 'invite' ? authApi.getInvite(token) : authApi.verifyResetToken(token),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!token) setError('This link is missing its token. Please use the link from your email.');
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Neither endpoint issues tokens, so both land on the same "now sign in"
      // confirmation rather than dropping the user into a portal.
      if (mode === 'invite') await authApi.acceptInvite(token, password);
      else await authApi.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e, 'Could not set your password. The link may have expired.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (token && check.isLoading) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-sm text-[var(--color-text-muted)]">Checking your link…</p>
      </div>
    );
  }

  if (token && check.error) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <TriangleAlert className="mx-auto size-12 text-[var(--color-danger)]" />
        <h2 className="font-display text-xl font-bold">This link has expired</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {mode === 'invite'
            ? 'Ask your school to send you a fresh invitation.'
            : 'Request a new password reset link and try again.'}
        </p>
        <Button variant="secondary" block onClick={() => router.push('/forgot-password')}>
          {mode === 'invite' ? 'Back to sign in' : 'Request a new link'}
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-8 space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-[var(--color-success)]" />
        <h2 className="font-display text-xl font-bold">
          {mode === 'invite' ? 'Account activated' : 'Password updated'}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          You can now sign in with your new password.
        </p>
        <Link href="/">
          <Button block>Go to sign in</Button>
        </Link>
      </div>
    );
  }

  const email = check.data && 'email' in check.data ? check.data.email : undefined;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {email && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Setting the password for <strong>{email}</strong>.
        </p>
      )}

      <div className="relative">
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          leading={<Lock className="size-4" />}
          className="pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute top-[30px] right-3 text-[var(--color-text-muted)]"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <Input
        label="Confirm password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        leading={<Lock className="size-4" />}
        error={confirm && password !== confirm ? 'Those passwords don’t match.' : null}
        required
      />

      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={submitting} disabled={!token}>
        {mode === 'invite' ? 'Activate my account' : 'Set new password'}
      </Button>
    </form>
  );
}
