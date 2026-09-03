'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button, IconButton } from './primitives';

/**
 * A dialog that is a bottom sheet on phones and a centred modal from `sm` up —
 * the same component either way, so no screen maintains two variants.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  // Escape closes, and the page behind must not scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-white shadow-[var(--shadow-sheet)]',
          'rounded-t-[var(--radius-sheet)] sm:rounded-[var(--radius-card)]',
          width,
        )}
        style={{ animation: 'sheet-in 200ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* The grab handle reads as a sheet on touch; hidden on desktop. */}
        <span
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[var(--color-hairline)] sm:hidden"
          aria-hidden
        />
        <header className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{description}</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {/*
          `--safe-pad` is the footer's own bottom padding; `.safe-bottom` adds
          the home-indicator inset on top of it. A plain `pb-*` here would be
          overridden by that utility — see the note in globals.css.
        */}
        {footer && (
          <footer className="safe-bottom [--safe-pad:1rem] flex flex-col-reverse gap-2 border-t border-[var(--color-hairline)] px-5 pt-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
        <style>{`@keyframes sheet-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation before something destructive or hard to undo — deleting a
 * student, cancelling an invoice, logging out.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{message}</p>
    </Modal>
  );
}
