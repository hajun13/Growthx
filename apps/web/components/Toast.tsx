'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { cx } from '@/lib/ui';

export interface ToastOptions {
  variant: 'success' | 'danger' | 'info';
  message: string;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const variantBar: Record<ToastOptions['variant'], string> = {
  success: 'border-l-success-500',
  danger: 'border-l-danger-500',
  info: 'border-l-primary-500',
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((opts: ToastOptions) => {
    const id = ++counter;
    const duration = opts.duration ?? 3000;
    setItems((prev) => [...prev, { ...opts, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'danger' ? 'alert' : 'status'}
            className={cx(
              'min-w-[280px] max-w-[420px] rounded-md border-l-4 bg-neutral-900 px-4 py-3 text-base text-neutral-0 shadow-lg',
              variantBar[t.variant],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서만 사용해요.');
  return ctx;
}
