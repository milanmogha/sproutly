'use client';

import { ChevronDown, Search } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-[var(--radius-input)] border border-[var(--color-hairline)] bg-white px-3.5 py-2.5',
  'text-sm font-semibold text-[var(--color-text)] placeholder:font-medium placeholder:text-[var(--color-text-muted)]',
  'transition outline-none focus:border-accent focus:ring-2 focus:ring-accent/25',
  'disabled:cursor-not-allowed disabled:bg-[var(--color-canvas)] disabled:opacity-70',
);

/** Label + control + error, the wrapper every form field uses. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-bold tracking-wide text-[var(--color-text-muted)] uppercase"
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-semibold text-[var(--color-danger)]">{error}</p>
      ) : (
        hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Rendered inside the control, before the text. */
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, className, required, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const control = (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-muted)]">
          {leading}
        </span>
      )}
      <input
        {...props}
        id={inputId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          leading && 'pl-10',
          error && 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/25',
          className,
        )}
      />
    </div>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      {control}
    </Field>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    hint?: string;
    error?: string | null;
  }
>(function Textarea({ label, hint, error, className, required, id, ...props }, ref) {
  const generatedId = useId();
  const areaId = id ?? generatedId;
  const control = (
    <textarea
      {...props}
      id={areaId}
      ref={ref}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(
        CONTROL,
        'min-h-24 resize-y leading-relaxed',
        error && 'border-[var(--color-danger)]',
        className,
      )}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={areaId}>
      {control}
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Shown as a disabled first option when the value is empty. */
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, placeholder, options, className, required, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const control = (
    <div className="relative">
      <select
        {...props}
        id={selectId}
        ref={ref}
        required={required}
        className={cn(CONTROL, 'appearance-none pr-9', error && 'border-[var(--color-danger)]', className)}
      >
        {/*
          Only a required field locks its placeholder. On an optional one the
          empty option IS a choice — "Unassigned", "All classes", "Independent"
          — and disabling it means a user who picks a value can never take it
          back without reloading the page.
        */}
        {placeholder && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
    </div>
  );
  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      {control}
    </Field>
  );
});

/** The search box used above every list. */
export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      leading={<Search className="size-4" />}
      className={className}
      aria-label={placeholder}
    />
  );
}

/** A labelled on/off control — notification prefs, feature toggles. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 py-2',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {description && (
          <span className="block text-xs text-[var(--color-text-muted)]">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition',
          checked ? 'bg-accent' : 'bg-[var(--color-hairline)]',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
    </label>
  );
}
