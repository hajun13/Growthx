'use client';

// 중간점검 확인 모달 — L1 Dialog 조합(구 Modal 의 헤더/본문 스크롤/푸터 구조·문구 그대로).
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirm,
  cancel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirm: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    destructive?: boolean;
  };
  cancel: { label: string; onClick: () => void };
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={cancel.onClick}>
            {cancel.label}
          </Button>
          <Button
            variant={confirm.destructive ? 'destructive' : 'default'}
            loading={confirm.loading}
            disabled={confirm.disabled}
            onClick={confirm.onClick}
          >
            {confirm.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
