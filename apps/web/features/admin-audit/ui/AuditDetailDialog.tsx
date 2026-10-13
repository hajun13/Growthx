'use client';

// 감사 로그 변경 내역 다이얼로그 — 선택된 로그의 before/after 비교.
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DiffViewer } from '@/components/DiffViewer';
import { auditActionText, auditFieldLabel, auditValueLabel } from '@/lib/ui';
import type { AuditLog } from '@/lib/types';

export function AuditDetailDialog({
  log,
  onClose,
  entityText,
  timestamp,
}: {
  log: AuditLog | null;
  onClose: () => void;
  entityText: (entity: string) => string;
  timestamp: (iso: string) => { time: string; date: string };
}) {
  return (
    <Dialog open={!!log} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>{`변경 내역 — ${log ? auditActionText(log.action) : ''}`}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">
          {log && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-4 py-3">
                <Badge variant="solid-dark" size="xs">
                  {entityText(log.entity)}
                </Badge>
                <span className="text-12 font-semibold text-foreground">
                  {log.actorName ?? '시스템'}
                </span>
                <span className="text-11h text-muted-foreground">
                  {timestamp(log.at).date} {timestamp(log.at).time}
                </span>
                <span className="text-11h text-muted-foreground ml-auto">
                  #{log.entityId.slice(0, 8)}
                </span>
              </div>
              <DiffViewer
                before={log.before}
                after={log.after}
                fieldLabels={auditFieldLabel}
                valueLabels={auditValueLabel}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
