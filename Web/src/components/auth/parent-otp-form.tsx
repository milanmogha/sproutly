'use client';

import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authApi } from '@/lib/api/auth';
import { errorMessage, errorStatus } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_HOME, ROLE_LABEL } from '@/lib/auth/session';
import { Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';

/**
 * Parent sign-in: request a one-time code, then verify it.
 *
 * The code is delivered by email while the WhatsApp provider stands down —
 * matching the app, whose request endpoint takes an email either way.
 *
 * The request step always reports success, whether or not the address is
 * registered, so this form can't be used to discover which parents have
 * accounts.
 */
const RESEND_SECONDS = 30;

export function ParentOtpForm() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const { setSession } = useAuth();
  const router = useRouter();

  // Ticks the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Focus the code box the moment the second step appears, so a parent can
  // type straight from their email without reaching for the field.
  useEffect(() => {
    if (step === 'verify') codeRef.current?.focus();
  }, [step]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email registered with your school.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.requestOtp(trimmed);
      setStep('verify');
      setCooldown(RESEND_SECONDS);
      setNotice(`We sent a code to ${trimmed}. It expires shortly.`);
    } catch (e) {
      setError(
        errorStatus(e) === 503
          ? "We couldn't send the code just now. Please try again."
          : errorMessage(e, 'Could not send the code. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the code we sent you.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await authApi.verifyOtp(email.trim(), trimmed);
      if (session.role !== 'parent') {
        await authApi.logout();
        setError(`This login is for ${ROLE_LABEL.parent} accounts only.`);
        setLoading(false);
        return;
      }
      setSession(session);
      router.replace(ROLE_HOME.parent);
    } catch (e) {
      setError(
        errorStatus(e) === 401
          ? 'That code is incorrect or has expired.'
          : errorMessage(e, 'Could not verify the code. Try again.'),
      );
      setLoading(false);
    }
  }

  if (step === 'request') {
    return (
      <form onSubmit={requestCode} className="mt-6 space-y-4" noValidate>
        <p className="text-sm text-[var(--color-text-muted)]">
          Enter the email registered with your child&apos;s school and we&apos;ll send you a
          one-time code.
        </p>
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          leading={<Mail className="size-4" />}
          required
        />
        {error && (
          <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="mt-6 space-y-4" noValidate>
      {notice && <p className="text-sm text-[var(--color-text-muted)]">{notice}</p>}
      <Input
        ref={codeRef}
        label="One-time code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="text-center font-display text-2xl tracking-[0.4em]"
        required
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={loading}>
        Verify &amp; continue
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep('request');
            setCode('');
            setError(null);
            setNotice(null);
          }}
          className="font-bold text-[var(--color-text-muted)] underline"
        >
          Change email
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || loading}
          onClick={() => void requestCode()}
          className="font-bold text-accent underline disabled:text-[var(--color-text-muted)] disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
