'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn, colorFor, initials } from '@/lib/utils';
import { fileUrl } from '@/lib/api/config';

/* ── Button ─────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `bg-accent` reads the role tint set by RoleShell, so one button component
  // is grape for parents and green for admins without any per-portal props.
  primary: 'bg-accent text-white shadow-[0_8px_18px_rgb(0_0_0/0.14)] hover:brightness-105',
  secondary:
    'bg-white text-[var(--color-text)] border border-[var(--color-hairline)] hover:bg-[var(--color-canvas)]',
  ghost: 'bg-transparent text-[var(--color-text-muted)] hover:bg-black/5',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-105',
  ink: 'bg-[var(--color-ink)] text-[var(--color-on-ink)] hover:brightness-125',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Fills the row on phones, hugs its content from `sm` up. */
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-button)] font-bold whitespace-nowrap transition',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** A round icon-only button — toolbars, card corners, close affordances. */
export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-10 shrink-0 place-items-center rounded-full text-[var(--color-text-muted)] transition',
        'hover:bg-black/5 hover:text-[var(--color-text)] disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The bold dark card that anchors the maximalist look. */
export function InkCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-[var(--radius-card)] bg-[var(--color-ink)] p-5 text-[var(--color-on-ink)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/** Page heading with optional actions — sticks to the top of every screen. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ── Badge ──────────────────────────────────────────────────────────── */

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-canvas)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success)]/15 text-[#12855a]',
  warning: 'bg-[var(--color-gold)]/25 text-[#8a6200]',
  danger: 'bg-[var(--color-danger)]/15 text-[#c31f4c]',
  info: 'bg-[var(--color-blue)]/15 text-[#1c5fad]',
  accent: 'bg-accent-tint text-accent',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  src,
  size = 44,
  id,
  className,
}: {
  name?: string | null;
  src?: string | null;
  /** Pixel size; the component stays square. */
  size?: number;
  /** Seeds the fallback colour so a person keeps the same hue everywhere. */
  id?: string | null;
  className?: string;
}) {
  const resolved = fileUrl(src);
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-bold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(id ?? name),
        fontSize: Math.max(11, size * 0.36),
      }}
    >
      {resolved ? (
        <Image
          src={resolved}
          alt={name ?? ''}
          width={size}
          height={size}
          className="size-full object-cover"
          unoptimized
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ── Loading & empty states ─────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-input)] bg-[var(--color-hairline)]',
        className,
      )}
    />
  );
}

/** Placeholder shaped like the list it is standing in for. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="flex items-center gap-4">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-accent', className)} />;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] bg-white/70 px-6 py-12 text-center">
      {icon && (
        <span className="grid size-14 place-items-center rounded-full bg-accent-tint text-accent">
          {icon}
        </span>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {message && (
        <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{message}</p>
      )}
      {action}
    </div>
  );
}

/** Inline failure with a retry — every list uses this rather than a bare throw. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[var(--color-danger)]">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ── Stat tile ──────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  /** A CSS colour; defaults to the portal accent. */
  color?: string;
}) {
  const swatch = color ?? 'var(--accent)';
  return (
    <Card className="flex items-start gap-3">
      {/*
        The chip is always rendered, icon or not.
        These tiles sit in rows of four and only some of them have a natural
        icon — omitting the chip on the rest left every label in the row
        starting at a different x. Without an icon it falls back to a colour
        dot, which keeps the row aligned and still carries the colour coding.
      */}
      <span
        className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
        style={
          icon
            ? { backgroundColor: swatch }
            : { backgroundColor: `color-mix(in srgb, ${swatch} 15%, transparent)` }
        }
      >
        {icon ?? (
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: swatch }}
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
          {label}
        </p>
        <p className="font-display text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
      </div>
    </Card>
  );
}
