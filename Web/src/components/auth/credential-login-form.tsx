'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { authApi } from '@/lib/api/auth';
import { errorMessage, errorStatus } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_HOME, ROLE_LABEL, type Role } from '@/lib/auth/session';
import { Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';

/**
 * Email + password login, used by the roles that sign in with credentials:
 * Admin, Teacher and Super Admin. Parents use the one-time code flow instead.
 *
 * The account's real role comes from the issued token; if it doesn't match the
 * role picked on the hub, the session is rejected rather than silently opening
 * a different portal.
 */
export function CredentialLoginForm({ role }: { role: Role }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSession } = useAuth();
  const router = useRouter();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await authApi.login(trimmed, password);
      if (session.role !== role) {
        await authApi.logout();
        setError(`This login is for ${ROLE_LABEL[role]} accounts only.`);
        setLoading(false);
        return;
      }
      setSession(session);
      router.replace(ROLE_HOME[role]);
    } catch (e) {
      const status = errorStatus(e);
      setError(
        status === 401
          ? 'Invalid email or password.'
          : status === 403
            ? // A suspended school blocks its accounts — the API explains why.
              errorMessage(
                e,
                "This school's account has been suspended. Please contact the platform administrator.",
              )
            : errorMessage(e, 'Login failed. Try again.'),
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <Input
        label="Email"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.com"
        leading={<Mail className="size-4" />}
        required
      />

      <div className="relative">
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
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

      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={loading}>
        Sign in
      </Button>

      {/* Super admins are provisioned by the platform, not self-served — the
          reset flow is hidden for them, matching the app. */}
      {role !== 'super_admin' && (
        <p className="text-center text-sm">
          <Link
            href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
            className="font-bold text-accent underline"
          >
            Forgot password?
          </Link>
        </p>
      )}
    </form>
  );
}
