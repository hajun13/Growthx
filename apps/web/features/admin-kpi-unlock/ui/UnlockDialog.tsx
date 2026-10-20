'use client';

// 확정 해제 확인 — 대상 요약 + 영향 안내 + 사유 입력(필수, 구성원 KPI 화면에 표시).
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InfoBanner } from '@/components/InfoBanner';

export const REASON_MAX = 500;

interface Props {
  open: boolean;
  userCount: number;
  kpiCount: number;
  /** 선택 KPI 중 평가 점수가 저장된 건수. */
  scoredCount: number;
  kpiLocked: boolean;
  reason: string;
  busy: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function UnlockDialog({
  open, userCount, kpiCount, scoredCount, kpiLocked, reason, busy, onReasonChange, onConfirm, onClose,
}: Props) {
  const reasonId = useId();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="md" layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>KPI 확정 해제</DialogTitle>
          <DialogDescription>
            구성원 {userCount}명의 확정 KPI {kpiCount}건을 &lsquo;작성중&rsquo;으로 되돌려요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <ul className="list-disc space-y-1 pl-5 text-12h text-muted-foreground">
            <li>구성원이 KPI를 수정해 다시 제출하면 결재선 1차부터 다시 결재해요. 기존 결재 이력은 감사 로그에 남아요.</li>
            <li>해제 사유는 구성원의 KPI 작성 화면에 표시되고, 구성원에게 알림이 가요.</li>
          </ul>
          {scoredCount > 0 && (
            <InfoBanner tone="tip" title={`평가 점수가 저장된 KPI ${scoredCount}건이 포함됐어요`}>
              다시 확정될 때까지 본인평가 화면에서 빠지고, 내용을 바꾸면 이미 매긴 점수와 어긋날 수 있어요.
              점수가 연결된 KPI는 삭제할 수 없어요.
            </InfoBanner>
          )}
          {kpiLocked && (
            <InfoBanner tone="warning" title="지금은 KPI 작성 기간이 잠겨 있어요">
              해제해도 구성원이 수정할 수 없어요. 평가 운영에서 KPI 작성 단계 잠금을 먼저 풀어 주세요.
            </InfoBanner>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>
              해제 사유<span className="ml-1 text-destructive">*</span>
            </Label>
            <Textarea
              id={reasonId}
              rows={3}
              value={reason}
              maxLength={REASON_MAX}
              aria-required
              placeholder="예) 조직 개편으로 목표 재설정 필요"
              onChange={(e) => onReasonChange(e.target.value)}
              className="resize-y"
            />
            <span className="self-end text-11 tabular-nums text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>취소</Button>
          <Button variant="destructive" loading={busy} disabled={!reason.trim()} onClick={onConfirm}>
            확정 해제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
