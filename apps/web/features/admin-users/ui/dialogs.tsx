'use client';

/**
 * admin-users 전용 다이얼로그 셸 — L1 Dialog 조합.
 * DialogShell: 헤더 밴드(bg-muted) + 스크롤 본문 + 푸터 (폼·확인 모달 공통).
 * ConfirmDialog: 헤더·본문·푸터가 한 덩어리인 단순 확인(구 Modal primaryAction/secondaryAction).
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShellProps {
  title: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'default';
  /** 헤더 우측 "닫기"(X) 버튼 노출. */
  closeButton?: boolean;
  /** 진행 중에는 오버레이/ESC 로 닫히지 않게. */
  busy?: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function DialogShell({ title, onClose, size = 'default', closeButton, busy, footer, children }: ShellProps) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        size={size}
        layout="scroll-footer"
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-0 p-0"
      >
        <div className="flex items-center justify-between rounded-t-lg border-b border-border bg-muted px-6 py-4">
          <DialogTitle className="text-15 font-bold tracking-normal text-foreground">{title}</DialogTitle>
          {closeButton && (
            <Button variant="ghost-muted" size="icon-2xs" aria-label="닫기" onClick={onClose}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primary: { label: string; onClick: () => void; danger?: boolean; loading?: boolean; disabled?: boolean };
  secondaryLabel?: string;
}

export function ConfirmDialog({ open, onClose, title, children, primary, secondaryLabel = '취소' }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="sm" layout="scroll-footer" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{secondaryLabel}</Button>
          <Button
            variant={primary.danger ? 'destructive' : 'default'}
            loading={primary.loading}
            disabled={primary.disabled}
            onClick={primary.onClick}
          >
            {primary.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
