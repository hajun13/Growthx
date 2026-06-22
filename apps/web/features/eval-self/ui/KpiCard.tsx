'use client';

/**
 * KpiCard — 본인평가 개별 KPI 카드.
 * 정성(GradeCriteriaPicker) / 절대금액(RevenueGradeDisplay) / 수치(KpiGradingDisplay) 분기.
 * 증빙 첨부(EvidenceSection) 포함.
 */
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import {
  KpiGradingDisplay,
  RevenueGradeDisplay,
} from '@/components/KpiGradingDisplay';
import { EvidenceSection } from './EvidenceSection';
import { kpiTypeLabel, measureTypeUnit, fmtAmount, wonToEok, eokToWon } from '@/lib/ui';
import type { Kpi, KpiScore, Grade, EvaluationEvidence, RuleSet } from '@/lib/types';

interface AchInput {
  actualValue?: number;
  count?: number;
  actualAmount?: number;
  qualitativeNote?: string;
  directGrade?: Grade;
}

function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

interface Props {
  kpi: Kpi;
  score: KpiScore | null;
  inp: AchInput;
  readOnly: boolean;
  ruleSet: RuleSet | null | undefined;
  evaluationId: string;
  evidenceFiles: EvaluationEvidence[];
  onUpdateInput: (kpiId: string, patch: AchInput) => void;
  onEvidenceChanged: () => void;
}

export function KpiCard({
  kpi,
  score,
  inp,
  readOnly,
  ruleSet,
  evaluationId,
  evidenceFiles,
  onUpdateInput,
  onEvidenceChanged,
}: Props) {
  const isQual = kpi.measureType === 'qualitative';
  const isCount = kpi.measureType === 'count';
  const isAbsAmount = isAbsoluteAmount(kpi);
  const unit = measureTypeUnit[kpi.measureType];

  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const cellInputClass =
    'w-full border border-border rounded-none px-[11px] py-[9px] text-[13px] text-foreground bg-card outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:opacity-60';

  return (
    <div className="overflow-hidden bg-card">
      {(kpi.csf || targetStr) && (
        <div className="border-b border-border bg-card px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 bg-primary" aria-hidden />
            <div className="text-[12px] font-bold text-foreground">성과 내용</div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
            {kpi.csf && (
              <div className="border-t border-border/70 py-3 first:border-t-0 first:pt-0">
                <div className="mb-1 text-[11px] font-bold text-muted-foreground">CSF</div>
                <div className="text-[13.5px] leading-relaxed text-foreground break-keep">{kpi.csf}</div>
              </div>
            )}
            {targetStr && (
              <div className="border-t border-border/70 py-3 first:border-t-0 first:pt-0 xl:col-span-2">
                <div className="mb-1 text-[11px] font-bold text-muted-foreground">목표</div>
                <div className="text-[13.5px] leading-relaxed text-foreground break-keep">{targetStr}</div>
              </div>
            )}
            <div className="border-t border-border/70 py-3 first:border-t-0 first:pt-0">
              <div className="mb-1 text-[11px] font-bold text-muted-foreground">평가 방식</div>
              <div className="text-[13.5px] leading-relaxed text-foreground break-keep">{kpiTypeLabel(kpi)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="space-y-4 bg-card px-5 py-4">
        {isQual ? (
          <>
            <GradeCriteriaPicker
              kpi={kpi}
              value={inp.directGrade}
              onSelect={(g) => onUpdateInput(kpi.id, { directGrade: g })}
              readOnly={readOnly}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">
                성과 근거 · 메모{' '}
                <span className="text-muted-foreground">(선택)</span>
              </span>
              <textarea
                rows={2}
                value={inp.qualitativeNote ?? ''}
                onChange={(e) => onUpdateInput(kpi.id, { qualitativeNote: e.target.value })}
                placeholder="선택한 등급의 근거가 되는 성과를 적어두면 검토에 도움이 돼요."
                disabled={readOnly}
                className={`${cellInputClass} resize-y leading-[1.45]`}
              />
            </label>
          </>
        ) : isAbsAmount ? (
          <>
            <label className="flex flex-col gap-1.5" style={{ maxWidth: 280 }}>
              <span className="text-[11.5px] font-medium text-muted-foreground">
                실제 매출 금액
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  aria-label={`${kpi.title} 실제 매출 금액(억)`}
                  value={wonToEok(inp.actualAmount) ?? ''}
                  onChange={(e) => {
                    const won =
                      e.target.value === ''
                        ? undefined
                        : eokToWon(Number(e.target.value));
                    onUpdateInput(kpi.id, { actualAmount: won });
                  }}
                  placeholder="예) 10"
                  disabled={readOnly}
                  className={`${cellInputClass} text-right`}
                  style={{ maxWidth: 240 }}
                />
                <span className="text-[12px] text-muted-foreground whitespace-nowrap">억</span>
              </div>
              {inp.actualAmount !== undefined && (
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  = {fmtAmount(inp.actualAmount)} ({inp.actualAmount.toLocaleString('ko-KR')}원)
                </span>
              )}
            </label>
            <RevenueGradeDisplay
              scale={ruleSet?.weightPolicy.revenueGradeScale}
              inputAmount={score?.actualAmount ?? inp.actualAmount ?? undefined}
            />
            {!score && (
              <p className="text-[11.5px] text-muted-foreground">
                실제 매출 금액을 입력하면 위 절대금액 기준에 따라 등급이 자동 산정돼요.
              </p>
            )}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5" style={{ maxWidth: 240 }}>
              <span className="text-[11.5px] font-medium text-muted-foreground">
                {isCount ? '실적 건수' : '실적값'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={isCount ? inp.count ?? '' : inp.actualValue ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    onUpdateInput(kpi.id, isCount ? { count: v } : { actualValue: v });
                  }}
                  placeholder={isCount ? '건수' : '실적값'}
                  disabled={readOnly}
                  className={`${cellInputClass} text-right`}
                />
                {(unit || isCount) && (
                  <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                    {isCount ? '건' : unit}
                  </span>
                )}
              </div>
            </label>
            <KpiGradingDisplay
              kpi={kpi}
              scales={ruleSet ? ruleSet.gradingScales : undefined}
              highlightGrade={score?.grade ?? undefined}
            />
            {!score && (
              <p className="text-[11.5px] text-muted-foreground">
                실적을 입력하고 저장하면 위 기준에 따라 등급이 자동 산정돼요.
              </p>
            )}
          </>
        )}

        <EvidenceSection
          evaluationId={evaluationId}
          kpiId={kpi.id}
          files={evidenceFiles}
          readOnly={readOnly}
          onChanged={onEvidenceChanged}
        />
      </div>
    </div>
  );
}
