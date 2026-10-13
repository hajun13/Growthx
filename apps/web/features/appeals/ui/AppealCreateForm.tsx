'use client';

// 이의제기 신청 폼 — 결과 화면에서 resultId 쿼리와 함께 진입 시에만 노출.
import { Plus } from 'lucide-react';
import { InfoBanner } from '@/components/InfoBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  reason: string;
  reasonError: string;
  busy: boolean;
  onReasonChange: (v: string) => void;
  onSubmit: () => void;
}

export function AppealCreateForm({ reason, reasonError, busy, onReasonChange, onSubmit }: Props) {
  return (
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">이의제기 신청</CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">
        <div className="space-y-4">
          <InfoBanner tone="info" title="신청 전 확인사항">
            등급 통보일로부터 7일 이내에 신청 가능해요. 이의제기 사유를 구체적으로 작성할수록 검토에 도움이 돼요.
          </InfoBanner>
          <div>
            <Label className="mb-1.5 block text-11 font-semibold uppercase tracking-wide text-muted-foreground">
              이의제기 사유 <span className="ml-0.5 text-danger-500">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="평가 결과에 동의하지 않는 구체적인 사유를 작성해 주세요."
              aria-invalid={reasonError ? true : undefined}
              rows={4}
            />
            {reasonError && <p className="mt-1.5 text-11 text-danger-600">{reasonError}</p>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-11h tabular-nums text-muted-foreground">{reason.length}자 입력</span>
            <Button size="sm" disabled={!reason.trim() || busy} loading={busy} onClick={onSubmit}>
              {!busy && <Plus size={14} aria-hidden />}
              이의제기 신청
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
