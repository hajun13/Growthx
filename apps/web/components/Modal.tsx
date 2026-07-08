'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from './Button';

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

const sizeClass = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[1040px]',
};

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
      <DialogContent
        className={cn(
          hasFooter
            ? 'grid-rows-[auto_minmax(0,1fr)_auto]'
            : 'grid-rows-[auto_minmax(0,1fr)]',
          sizeClass[size],
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* 본문 기본 텍스트는 foreground — 설명 문단 muted 는 호출부에서 개별 처리 */}
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">{children}</div>
        {(primaryAction || secondaryAction) && (
          <DialogFooter>
            {secondaryAction && (
              <Button variant="secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant ?? 'primary'}
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
