'use client';

// KPI별 자가점검 입력 카드.
//  - 등급 부여 기준(S~D 박스)·기본 점수구간 칩은 기본 숨김 → "등급 기준 보기" accordion.
//  - 정량 KPI: 수치 입력(주) + 자가점검 코멘트(선택). 텍스트 실적 입력 유지(정성 KPI에도 사용).
//  - 용어: "자가점검" / "자가점검 코멘트" (체크인/check-in 노출 없음).
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { MidtermSignalBadge } from '@/components/MidtermSignalBadge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { gradeColor } from '@/lib/grade';
import {
  kpiCategoryLabel,
  kpiTypeLabel,
  fmtPercent,
  fmtAmount,
  measureTypeUnit,
  progressSignalLabel,
} from '@/lib/ui';
import type { KpiProgress, Grade } from '@/lib/types';

// 그룹별 accent 색(EmployeeMidterm과 동일).
const GROUP_ACCENT: Record<string, string> = {
  performance_core: 'bg-primary',
  collaboration_growth: 'bg-success-500',
};

// 등급 기본 점수구간(ruleSet 없을 때 폴백).
const DEFAULT_GRADE_SCALE: { grade: Grade; label: string }[] = [
  { grade: 'S', label: '96~100점' },
  { grade: 'A', label: '91~95점' },
  { grade: 'B', label: '85~90점' },
  { grade: 'C', label: '80~84점' },
  { grade: 'D', label: '80점 미만' },
];

export interface CheckInInput {
  selfActualText: string;
  selfActualValue: string;
  selfNote: string;
  selfGrade: Grade | '';
}

export function defaultCheckIn(kpi: KpiProgress): CheckInInput {
  const ci = kpi.selfCheckIn;
  return {
    selfActualText: ci?.selfActualText ?? '',
    selfActualValue:
      ci?.selfActualValue !== null && ci?.selfActualValue !== undefined
        ? String(ci.selfActualValue)
        : '',
    selfNote: ci?.selfNote ?? '',
    selfGrade: (ci?.selfGrade as Grade) ?? '',
  };
}

export function KpiCheckInCard({
  kpi,
  checkIn,
  onChange,
  readOnly,
}: {
  kpi: KpiProgress;
  checkIn: CheckInInput;
  onChange: (patch: Partial<CheckInInput>) => void;
  readOnly: boolean;
}) {
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const accent = GROUP_ACCENT[kpi.group] ?? 'bg-primary';
  const isQual = kpi.isQualitative;
  const typeLabel = kpiTypeLabel(kpi);
  const unit = measureTypeUnit[kpi.measureType];
  const gradeOptions: Grade[] = ['S', 'A', 'B', 'C', 'D'];

  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? isQual
        ? kpi.targetText
        : kpi.measureType === 'amount'
          ? fmtAmount(kpi.targetValue)
          : `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const hasCriteria = Boolean(kpi.gradingCriteria);

  return (
    <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
      {/* 카드 헤더 */}
      <div className="flex items-start gap-3 px-5 py-3 border-b border-border bg-muted">
        <span
          className={cn(
            'inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold text-white flex-shrink-0',
            accent,
          )}
        >
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-foreground">{kpi.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground mt-0.5">
            {kpi.csf && <span>{kpi.csf}</span>}
            {kpi.csf && <span>·</span>}
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 font-semibold rounded-full',
                isQual ? 'bg-warning-50 text-warning-700' : 'bg-purple-50 text-purple-700',
              )}
            >
              {typeLabel}
            </span>
            {targetStr && (
              <>
                <span>·</span>
                <span>목표: {targetStr}</span>
              </>
            )}
            {kpi.measureMethod && (
              <>
                <span>·</span>
                <span>측정: {kpi.measureMethod}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[11.5px] text-muted-foreground tabular-nums">
            가중치 {kpi.weight}%
          </span>
          {kpi.currentGrade ? (
            <GradeChip grade={kpi.currentGrade} size="sm" />
          ) : kpi.signal !== 'on_track' ? (
            <MidtermSignalBadge signal={kpi.signal} size="sm" />
          ) : null}
        </div>
      </div>

      {/* 진척 정보 */}
      <div className="flex flex-wrap gap-4 px-5 py-2 bg-muted border-b border-border/20">
        <ProgressStat label="누적 달성률" value={isQual ? '–' : fmtPercent(kpi.cumulativeRate)} />
        <ProgressStat
          label="현재실적"
          value={
            isQual
              ? '–'
              : kpi.measureType === 'amount'
                ? fmtAmount(kpi.cumulativeActual)
                : `${kpi.cumulativeActual.toLocaleString('ko-KR')}${unit}`
          }
        />
        <ProgressStat label="신호" value={progressSignalLabel[kpi.signal]} />
      </div>

      {/* 등급 기준 — accordion(기본 숨김) */}
      {hasCriteria && (
        <div className="border-b border-border/20">
          <button
            type="button"
            onClick={() => setCriteriaOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-5 py-2 text-left hover:bg-muted/60 transition-colors"
          >
            {criteriaOpen ? (
              <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight size={13} className="text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-[11px] font-semibold text-muted-foreground">등급 기준 보기</span>
          </button>
          {criteriaOpen && (
            <div className="px-5 pb-3">
              <div className="grid grid-cols-1 gap-1 md:grid-cols-5">
                {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
                  const text = kpi.gradingCriteria?.[g];
                  if (!text) return null;
                  return (
                    <div
                      key={g}
                      className="flex items-start gap-1.5 rounded-md p-1.5 border border-border/30"
                    >
                      <span
                        className="w-[18px] h-[18px] text-[10px] font-bold rounded flex-shrink-0 flex items-center justify-center"
                        style={{ background: gradeColor(g).fg, color: '#fff' }}
                      >
                        {g}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-[1.4]">{text}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {DEFAULT_GRADE_SCALE.map((item) => (
                  <span
                    key={item.grade}
                    className="flex items-center gap-1 text-[10.5px] text-muted-foreground"
                  >
                    <span
                      className="w-3.5 h-3.5 text-[9px] font-bold rounded flex items-center justify-center"
                      style={{ background: gradeColor(item.grade).fg, color: '#fff' }}
                    >
                      {item.grade}
                    </span>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 자가점검 입력 */}
      <div className="flex flex-col gap-3 px-5 py-3">
        {/* 정량: 수치 입력(주) + 텍스트(선택). 정성: 텍스트(주) */}
        {!isQual ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-muted-foreground">
              수치 실적{unit && <span className="ml-1 font-normal text-muted-foreground/60">({unit})</span>}
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={checkIn.selfActualValue}
                onChange={(e) => onChange({ selfActualValue: e.target.value })}
                disabled={readOnly}
                placeholder={`수치 입력${unit ? ` (${unit})` : ''}`}
                className={cn('w-40', readOnly && 'bg-muted')}
              />
              {unit && (
                <span className="text-[12px] text-muted-foreground whitespace-nowrap">{unit}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-muted-foreground">
              상반기 실적 / 진척
            </label>
            <Textarea
              rows={2}
              value={checkIn.selfActualText}
              onChange={(e) => onChange({ selfActualText: e.target.value })}
              disabled={readOnly}
              placeholder="상반기 달성한 내용을 서술해 주세요."
              className={cn('resize-none', readOnly && 'bg-muted')}
            />
          </div>
        )}

        {/* 자가점검 코멘트 (선택) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11.5px] font-semibold text-muted-foreground">
            자가점검 코멘트{' '}
            <span className="font-normal text-muted-foreground/60">(선택)</span>
          </label>
          <Textarea
            rows={2}
            value={checkIn.selfNote}
            onChange={(e) => onChange({ selfNote: e.target.value })}
            disabled={readOnly}
            placeholder="달성 배경, 장애요인, 하반기 계획 등 자유롭게 작성하세요."
            className={cn('resize-none', readOnly && 'bg-muted')}
          />
        </div>

        {/* 자가 등급 선택 (정성 KPI 또는 gradingCriteria 있을 때) */}
        {(isQual || hasCriteria) && (
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              자가 등급 선택{' '}
              <span className="font-normal text-muted-foreground/60">(선택)</span>
            </span>
            <div className="flex gap-1.5">
              {gradeOptions.map((g) => {
                const isSelected = checkIn.selfGrade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ selfGrade: isSelected ? '' : g })}
                    className={cn(
                      'w-7 h-7 text-[12px] font-bold rounded border transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      isSelected
                        ? 'border-2'
                        : 'border bg-muted text-muted-foreground hover:border-border-strong',
                    )}
                    style={
                      isSelected
                        ? { background: gradeColor(g).fg, color: '#fff', borderColor: gradeColor(g).fg }
                        : undefined
                    }
                    title={`자가 등급 ${g}${isSelected ? ' (선택됨)' : ''}`}
                  >
                    {g}
                  </button>
                );
              })}
              {checkIn.selfGrade && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ selfGrade: '' })}
                  className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground px-1 disabled:opacity-40"
                >
                  해제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
