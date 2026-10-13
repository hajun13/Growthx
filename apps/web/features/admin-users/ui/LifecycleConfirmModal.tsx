'use client';

/**
 * LifecycleConfirmModal — 퇴사·복직·삭제·완전삭제 확인 모달 (L1 Dialog 기반).
 */

import { Button } from '@/components/ui/button';
import { DialogShell } from './dialogs';

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

const VARIANT = { primary: 'default', danger: 'destructive', secondary: 'outline' } as const;

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

  return (
    <DialogShell
      title={title}
      onClose={onCancel}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>취소</Button>
          <Button
            variant={VARIANT[confirmVariant]}
            onClick={() => !blocked && onConfirm()}
            loading={busy}
            disabled={blocked}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5">{children}</div>
    </DialogShell>
  );
}
