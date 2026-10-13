'use client';

// 확인/입력 다이얼로그(L1 Dialog 조합) — 헤더/푸터 고정 + 본문만 내부 스크롤.
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md';
  primary: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean; destructive?: boolean };
  children: React.ReactNode;
}

export function ConfirmDialog({ open, onClose, title, size = 'sm', primary, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size={size} layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            variant={primary.destructive ? 'destructive' : 'default'}
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
