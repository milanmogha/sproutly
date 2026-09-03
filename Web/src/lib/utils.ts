import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class joiner: later classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** ₹ amounts, Indian digit grouping, no decimals for whole rupees. */
export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** Plain number with Indian grouping — for counts, not money. */
export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN').format(value ?? 0);
}

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** e.g. "12 Mar 2025" */
export function formatDate(input: string | number | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** e.g. "12 Mar 2025, 4:30 pm" */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '—';
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** e.g. "4:30 pm" */
export function formatTime(input: string | number | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '—';
  return date
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

/** `yyyy-MM-dd` in local time — the shape every date query param takes. */
export function toIsoDate(input: Date | string | number = new Date()): string {
  const date = toDate(input) ?? new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago", falling back to a date. */
export function formatRelative(input: string | number | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return formatDate(date);
}

/** "Aarav Sharma" → "AS"; used by the avatar fallback. */
export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Title-cases a backend enum, e.g. `half_day` → "Half Day". */
export function humanize(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * The academic year in the `2025-2026` form the API validates against.
 *
 * A school year runs across the calendar boundary, so it rolls over in June
 * rather than January.
 */
/**
 * "1 rider", "2 riders" — a count with its noun, pluralised.
 *
 * Pass `plural` for anything the trailing `s` gets wrong ("classes").
 */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

export function academicYear(now = new Date()): string {
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

/** The last few academic years, newest first — for a year picker. */
export function academicYearOptions(count = 3, now = new Date()): string[] {
  const current = Number(academicYear(now).slice(0, 4));
  return Array.from({ length: count }, (_, i) => `${current - i}-${current - i + 1}`);
}

/** Greeting that matches the time of day, as on the app's home screens. */
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * A stable, pleasant accent for a given id — used to colour student avatars
 * and class chips so a list doesn't read as a wall of one hue.
 */
const PALETTE = [
  'var(--color-grape)',
  'var(--color-coral)',
  'var(--color-teal)',
  'var(--color-blue)',
  'var(--color-pink)',
  'var(--color-sunny)',
  'var(--color-brand)',
  'var(--color-purple)',
];

export function colorFor(key?: string | null): string {
  if (!key) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
