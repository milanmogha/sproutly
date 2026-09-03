'use client';

import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message) => toast(message, 'success'),
      error: (message) => toast(message, 'error'),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Bottom-centre on phones (above the nav), bottom-right on desktop. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, { bar: string; icon: ReactNode }> = {
  success: {
    bar: 'bg-[var(--color-success)]',
    icon: <CheckCircle2 className="size-5 text-[var(--color-success)]" />,
  },
  error: {
    bar: 'bg-[var(--color-danger)]',
    icon: <TriangleAlert className="size-5 text-[var(--color-danger)]" />,
  },
  info: {
    bar: 'bg-[var(--color-blue)]',
    icon: <Info className="size-5 text-[var(--color-blue)]" />,
  },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = KIND_STYLES[toast.kind];
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-[var(--radius-button)] bg-white pr-3 shadow-[var(--shadow-card)]',
        'animate-in',
      )}
      style={{ animation: 'toast-in 180ms ease-out' }}
    >
      <span className={cn('w-1.5 self-stretch', style.bar)} aria-hidden />
      <span className="pt-3">{style.icon}</span>
      <p className="flex-1 py-3 text-sm font-semibold text-[var(--color-text)]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-3 rounded-full p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-canvas)]"
      >
        <X className="size-4" />
      </button>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
