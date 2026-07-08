'use client';

import { useMemo } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export interface ToastOptions {
  variant: 'success' | 'danger' | 'info';
  message: string;
  duration?: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
}

// 기존 호출부(toast.show({ variant, message }))를 그대로 유지하기 위한
// sonner 어댑터. 성공/에러/정보 의미를 sonner API 로 매핑.
function show({ variant, message, duration }: ToastOptions) {
  // 에러는 읽을 시간이 필요 — 명시 duration 이 없으면 8초(기본 4초 대비 연장).
  const effectiveDuration =
    duration ?? (variant === 'danger' ? 8000 : undefined);
  const opts = effectiveDuration ? { duration: effectiveDuration } : undefined;
  if (variant === 'success') {
    sonnerToast.success(message, opts);
  } else if (variant === 'danger') {
    sonnerToast.error(message, opts);
  } else {
    sonnerToast(message, opts);
  }
}

// 기존 <ToastProvider> 자리를 유지하되 내부는 sonner <Toaster/> 렌더.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}

export function useToast(): ToastApi {
  return useMemo<ToastApi>(() => ({ show }), []);
}
