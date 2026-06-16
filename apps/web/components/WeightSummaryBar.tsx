'use client';

// ④-2 WeightSummaryBar — 가중치 합/정성 검증 표시(요청 핵심).
// 합=100 하드(미충족 → 호출부에서 저장 disabled), 정성≤30 소프트(경고만).
// 실시간 합산은 프론트 표시용, 최종 검증은 백엔드(저장 시 합≠100 → 400).
// 색+텍스트 병기, role=status aria-live 로 합 변경 안내.
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { T } from '@/lib/toss';

export interface WeightSummaryBarProps {
  totalWeight: number; // 모든 KPI 새 가중치 합
  qualitativeWeight: number; // 정성 KPI 새 가중치 합
  byGroup?: { performance_core: number; collaboration_growth: number };
  compact?: boolean; // 저장 바용 1줄 압축(막대 생략)
}

const SUCCESS = '#128240';
const SUCCESS_FILL = '#16a34a';
const DANGER = '#c8353a';
const DANGER_FILL = '#f9cfcf';
const WARNING = '#9a6103';

export function WeightSummaryBar({
  totalWeight,
  qualitativeWeight,
  byGroup,
  compact,
}: WeightSummaryBarProps) {
  const sumOk = totalWeight === 100;
  const qualOver = qualitativeWeight > 30;

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        <span style={{ color: sumOk ? SUCCESS : DANGER }}>
          가중치 합 {totalWeight}%{' '}
          {sumOk ? '✔' : `(100% 필요)`}
        </span>
        <span style={{ color: qualOver ? WARNING : T.grey600 }}>
          정성 {qualitativeWeight}%{qualOver ? ' 초과' : ''}
        </span>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* 가중치 합 */}
        <span
          className="flex items-center gap-1"
          style={{ fontSize: 12.5, fontWeight: 700, color: sumOk ? SUCCESS : DANGER }}
        >
          {sumOk ? (
            <CheckCircle2 size={14} aria-hidden />
          ) : (
            <AlertTriangle size={14} aria-hidden />
          )}
          가중치 합{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{totalWeight}%</span>
          {sumOk ? ' ✔' : ''}
        </span>
        {/* 정성 합 */}
        <span
          className="flex items-center gap-1"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: qualOver ? WARNING : T.grey600,
          }}
        >
          정성 KPI 합{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {qualitativeWeight}%
          </span>
          {qualOver ? ' ⚠' : ' ✔'}
        </span>
      </div>

      {/* 막대(0~100, 100 기준선 점선) */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          height: 8,
          background: T.grey200,
          width: '100%',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, totalWeight))}%`,
            background: sumOk ? SUCCESS_FILL : DANGER_FILL,
            transition: 'width 0.15s ease',
          }}
        />
        {/* 100% 기준선 */}
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            borderRight: `1px dashed ${T.grey500}`,
          }}
        />
      </div>

      {/* 인라인 검증 메시지(색+텍스트 병기) */}
      {!sumOk && (
        <p style={{ fontSize: 11.5, color: DANGER, fontWeight: 600 }}>
          합이 100%가 되어야 저장할 수 있어요 (현재 {totalWeight}%)
        </p>
      )}
      {qualOver && (
        <p style={{ fontSize: 11.5, color: WARNING, fontWeight: 600 }}>
          정성 KPI 합이 30%를 넘었어요 ({qualitativeWeight}%) — 권장 범위를 확인해 주세요.
        </p>
      )}

      {byGroup && (
        <p style={{ fontSize: 11, color: T.grey500 }}>
          성과중심 {byGroup.performance_core}% · 협업·성장{' '}
          {byGroup.collaboration_growth}%
        </p>
      )}
    </div>
  );
}
