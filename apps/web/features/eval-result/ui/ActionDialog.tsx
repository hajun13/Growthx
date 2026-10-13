'use client';

// 확인/입력 다이얼로그 — L1 Dialog 조합(구 components/Modal 의 primary/secondary 액션 시그니처 재현).
// ponytail: 평가 화면 공용 — 다른 그룹도 쓰면 공용 L2 로 승격.
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger';
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: { label: string; onClick: () => void };
}

export function ActionDialog({ open, onClose, title, children, size = 'sm', primaryAction, secondaryAction }: Props) {
  const hasFooter = Boolean(primaryAction || secondaryAction);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size={size} layout={hasFooter ? 'scroll-footer' : 'scroll'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
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
