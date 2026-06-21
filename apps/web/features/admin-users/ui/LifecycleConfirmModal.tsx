'use client';

/**
 * LifecycleConfirmModal — 퇴사·복직·삭제·완전삭제 확인 모달.
 * createPortal + Button DS 컴포넌트. raw <button> → Button.
 */

import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';

interface Props {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'secondary';
  busy: boolean;
  disabled?: boolean;
}

export function LifecycleConfirmModal({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmVariant = 'danger',
  busy,
  disabled,
}: Props) {
  const blocked = busy || disabled;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay">
      <div className="w-[420px] rounded-none border border-border bg-card shadow-none">
        {/* 헤더 */}
        <div className="border-b border-border bg-muted px-6 py-4 rounded-t-xl">
          <span className="text-[15px] font-bold text-foreground">{title}</span>
        </div>
        {/* 본문 */}
        <div className="px-6 py-5">{children}</div>
        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>취소</Button>
          <Button
            variant={confirmVariant}
            onClick={() => !blocked && onConfirm()}
            loading={busy}
            disabled={blocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
