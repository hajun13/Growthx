'use client';

/**
 * DeptHeadEvalView.tsx에서 분리 (파일 200줄 상한).
 * KpiEvalCard — 본인평가 연동 실적 + 부서장 등급 부여를 한 카드에서 보여주는 컴포넌트.
 * 정보영역(CSF/목표/평가방식)은 본인평가(eval-self)와 동일한 muted 배경 컨셉(브리프 §8).
 */
import { MessageSquare, Paperclip, UserCheck, Eye, Download } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import { KpiGradingDisplay, RevenueGradeDisplay } from '@/components/KpiGradingDisplay';
import { isEvidencePreviewable } from '@/components/EvidencePreview';
import { Textarea } from '@/components/ui/textarea';
import { fmtScore, fmtAmount, measureTypeUnit, kpiTypeLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Grade, Kpi, KpiScore, EvaluationEvidence, RuleSet } from '@/lib/types';

function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function KpiInfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="break-keep text-[13px] font-medium leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

export function KpiEvalCard({
  kpi,
  selfScore,
  directGrade,
  onGrade,
  reviewerNote,
  onReviewerNote,
  noteMissing,
  evidence,
  onPreview,
  readOnly,
  gradingScales,
  revenueGradeScale,
}: {
  kpi: Kpi;
  selfScore: KpiScore | null;
  directGrade: Grade | null;
  onGrade: (g: Grade) => void;
  reviewerNote: string;
  onReviewerNote: (v: string) => void;
  noteMissing: boolean;
  evidence: EvaluationEvidence[];
  onPreview: (f: EvaluationEvidence) => void;
  readOnly?: boolean;
  gradingScales?: RuleSet['gradingScales'];
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
}) {
  const isQual = kpi.measureType === 'qualitative';
  const isCount = kpi.measureType === 'count';
  const isAbsAmount = isAbsoluteAmount(kpi);
  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  return (
    <div className="overflow-hidden bg-card">
      {(kpi.csf || targetStr || kpi.measureMethod) && (
        <div className="border-b border-border bg-neutral-50 px-5 py-4">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
            <KpiInfoCell label="CSF(전략목표)" value={kpi.csf || '—'} />
            <KpiInfoCell label="목표" value={targetStr || '—'} />
            <KpiInfoCell label="평가 방식" value={kpi.measureMethod || kpiTypeLabel(kpi)} />
          </div>
        </div>
      )}

      {/* 본인평가 연동 실적 */}
      <div className={cn('flex items-center gap-2 px-5 py-3.5', isQual && !readOnly ? 'border-b border-border' : 'border-b border-border/40')}>
        <UserCheck size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-[11.5px] font-bold text-muted-foreground">본인평가</span>
        {selfScore ? (
          isQual ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] text-muted-foreground">선택 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              {selfScore.selfNote && (
                <span className="truncate text-[12px] text-muted-foreground" title={selfScore.selfNote}>
                  · {selfScore.selfNote}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="tabular-nums text-[13px] font-semibold text-foreground">
                {isAbsAmount
                  ? `매출 ${fmtAmount(selfScore.actualAmount)}`
                  : `실적 ${fmtScore(selfScore.achievementRate)}${isCount ? '건' : unit}`}
              </span>
              <span className="text-[11.5px] text-muted-foreground">자동 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              <span className="tabular-nums text-[11.5px] text-primary ml-auto">
                {fmtScore(selfScore.score)}점
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-warning-600">아직 입력되지 않았어요</span>
        )}
      </div>

      {/* 절대금액 모드 */}
      {isAbsAmount && (
        <div className="border-b border-border/40 bg-muted px-5 py-4">
          <RevenueGradeDisplay
            scale={revenueGradeScale}
            inputAmount={selfScore?.actualAmount ?? undefined}
          />
        </div>
      )}

      {!isQual && !isAbsAmount && (
        <div className="border-b border-border/40 bg-muted px-5 py-4">
          <KpiGradingDisplay
            kpi={kpi}
            scales={gradingScales}
            highlightGrade={selfScore?.grade ?? undefined}
          />
        </div>
      )}

      {/* 부서장 등급 부여 (정성만) */}
      {isQual && (
        <div className="space-y-2 border-b border-border/40 px-5 py-4">
          <span className="text-[11.5px] font-semibold text-muted-foreground">부서장 등급 부여</span>
          <GradeCriteriaPicker kpi={kpi} value={directGrade ?? undefined} onSelect={onGrade} readOnly={readOnly} />
        </div>
      )}

      {/* 증빙 자료 */}
      {evidence.length > 0 && (
        <div className="space-y-1.5 border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <Paperclip size={12} aria-hidden /> 증빙 자료{' '}
            <span className="font-normal text-muted-foreground/60">{evidence.length}개</span>
          </div>
          <ul className="space-y-1">
            {evidence.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 rounded-md border border-border bg-muted transition-colors hover:bg-muted/70"
                  title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                >
                  {isEvidencePreviewable(f.mimeType) ? (
                    <Eye size={13} className="text-primary flex-shrink-0" />
                  ) : (
                    <Download size={13} className="text-primary flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 text-[12px] text-foreground">{f.filename}</span>
                  <span className="text-[10.5px] text-muted-foreground flex-shrink-0 tabular-nums">
                    {fmtBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 부서장 문항별 코멘트 (필수) */}
      {(!readOnly || reviewerNote.trim().length > 0) && (
        <div className="space-y-1.5 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <MessageSquare size={12} className="text-primary" aria-hidden /> 부서장 코멘트{' '}
            <span className="text-danger-500 font-bold">*</span>
          </div>
          <Textarea
            value={reviewerNote}
            onChange={(e) => onReviewerNote(e.target.value)}
            readOnly={readOnly}
            placeholder="이 과제에 대한 평가 의견을 작성해 주세요. (필수)"
            className={cn(
              'min-h-[56px] resize-none text-[12.5px]',
              noteMissing && 'border-danger-500',
              readOnly && 'bg-muted',
            )}
          />
          {noteMissing && (
            <p className="text-[11.5px] text-danger-600">
              부서장 코멘트는 필수 항목이에요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
