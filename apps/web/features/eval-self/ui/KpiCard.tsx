'use client';

/**
 * KpiCard — 본인평가 개별 KPI 카드.
 * 정성(GradeCriteriaPicker) / 절대금액(RevenueGradeDisplay) / 수치(KpiGradingDisplay) 분기.
 * 증빙 첨부(EvidenceSection) 포함.
 */
import { GradeChip } from '@/components/GradeChip';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import {
  KpiGradingDisplay,
  RevenueGradeDisplay,
  matchRevenueGrade,
} from '@/components/KpiGradingDisplay';
import { EvidenceSection } from './EvidenceSection';
import { kpiCategoryLabel, kpiTypeLabel, measureTypeUnit, fmtScore, fmtAmount, wonToEok, eokToWon } from '@/lib/ui';
import type { Kpi, KpiScore, Grade, EvaluationEvidence, KpiGroup, RuleSet } from '@/lib/types';

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

const GROUP_COLOR: Record<KpiGroup, string> = {
  performance_core: '#0075DE',
  collaboration_growth: '#128240',
};

interface Props {
  kpi: Kpi;
  groupColor: string;
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
  groupColor,
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

  const absPreviewGrade = isAbsAmount
    ? matchRevenueGrade(inp.actualAmount, ruleSet?.weightPolicy.revenueGradeScale)
    : undefined;

  const liveGrade: Grade | undefined = isQual
    ? inp.directGrade
    : score?.grade ?? absPreviewGrade;

  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const cellInputClass =
    'w-full border border-border rounded-none px-[11px] py-[9px] text-[13px] text-foreground bg-card outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:opacity-60';

  return (
    <div className="rounded-none overflow-hidden border border-border hover:border-primary/30 transition-colors">
      {/* 헤더 */}
      <div className="flex items-start gap-3 px-5 py-3.5 border-b border-border bg-muted">
        <span
          className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold text-white shrink-0 mt-0.5"
          style={{ background: groupColor }}
          aria-hidden
        >
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-foreground">{kpi.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground mt-0.5">
            {kpi.csf && <span>{kpi.csf}</span>}
            {kpi.csf && <span aria-hidden>·</span>}
            <span>{kpiTypeLabel(kpi)}</span>
            {targetStr && <span aria-hidden>·</span>}
            {targetStr && <span>목표 {targetStr}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="tabular-nums text-[11.5px] text-muted-foreground">
            가중치 {kpi.weight}%
          </span>
          {liveGrade ? (
            <div className="flex items-center gap-1.5">
              {!isQual && (
                <span className="tabular-nums text-[12.5px] font-bold text-primary">
                  {fmtScore(score?.score)}
                </span>
              )}
              <GradeChip grade={liveGrade} size="sm" />
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {isQual ? '등급 미선택' : '실적 미입력'}
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-5 py-4 space-y-3.5 bg-card">
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
