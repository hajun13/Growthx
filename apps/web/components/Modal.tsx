'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger';
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * @deprecated — L1(@/components/ui/dialog) 사용으로 이관 대상.
 * primaryAction/secondaryAction/size 시그니처를 유지하는 Dialog 호환 래퍼.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  primaryAction,
  secondaryAction,
  size = 'sm',
}: ModalProps) {
  const hasFooter = Boolean(primaryAction || secondaryAction);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* max-h(85vh, dialog.tsx) 안에서 헤더/푸터 고정 + 본문만 내부 스크롤.
          푸터 없으면 2행 템플릿 — 빈 트랙+gap 으로 하단 여백이 생기는 것 방지. */}
      <DialogContent size={size} layout={hasFooter ? 'scroll-footer' : 'scroll'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* 본문 기본 텍스트는 foreground — 설명 문단 muted 는 호출부에서 개별 처리 */}
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">{children}</div>
        {hasFooter && (
          <DialogFooter>
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant === 'danger' ? 'destructive' : 'default'}
                loading={primaryAction.loading}
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
