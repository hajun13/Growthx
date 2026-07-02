'use client';

// 이의제기 신청 폼 — 결과 화면에서 resultId 쿼리와 함께 진입 시에만 노출.
import { Plus } from 'lucide-react';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
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
    <Card title="이의제기 신청">
      <div className="space-y-4">
        <InfoBanner tone="info" title="신청 전 확인사항">
          등급 통보일로부터 7일 이내에 신청 가능해요. 이의제기 사유를 구체적으로 작성할수록 검토에 도움이 돼요.
        </InfoBanner>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            이의제기 사유 <span className="ml-0.5 text-danger-500">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="평가 결과에 동의하지 않는 구체적인 사유를 작성해 주세요."
            className={reasonError ? 'border-danger-500 focus-visible:border-danger-500' : ''}
            rows={4}
          />
          {reasonError && <p className="mt-1.5 text-[11px] text-danger-600">{reasonError}</p>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] tabular-nums text-muted-foreground">{reason.length}자 입력</span>
          <Button
            variant="primary"
            size="sm"
            disabled={!reason.trim() || busy}
            loading={busy}
            leftIcon={<Plus size={14} aria-hidden />}
            onClick={onSubmit}
          >
            이의제기 신청
          </Button>
        </div>
      </div>
    </Card>
  );
}
