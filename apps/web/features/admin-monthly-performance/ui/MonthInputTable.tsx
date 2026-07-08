'use client';

// 선택된 월 1개월치 입력 표 — image 11: 구분 | 전년실적 | 당해목표(A) | 당해실적(B) | 달성률(B/A) | 전년대비증감 | 비고.
// 연도 라벨은 사이클 연도(year prop)에서 파생 — 하드코딩 금지(2026 사이클이면 전년=2025).
import type { LucideIcon } from 'lucide-react';
import { DollarSign, Percent, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatComma, sanitizeNumInput } from './FinancialGridHelpers';
import { fmtPct1, fmtDeltaPct, yoyDelta } from './perfFormat';

export interface MonthRowValue {
  key: 'revenue' | 'cost' | 'gross' | 'margin';
  label: string;
  prevYear: number | null;
  target: number | null;
  actual: number | null;
  editable: boolean;
  isRate: boolean;
}

const ROW_ICON: Record<MonthRowValue['key'], LucideIcon> = {
  revenue: DollarSign,
  cost: TrendingUp,
  gross: DollarSign,
  margin: Percent,
};

const ROW_ICON_CLASS: Record<MonthRowValue['key'], string> = {
  revenue: 'text-primary',
  cost: 'text-status-in-progress-fg',
  gross: 'text-grade-s',
  margin: 'text-status-finalized-fg',
};

interface Props {
  rows: MonthRowValue[];
  canEdit: boolean;
  /** 사이클 연도 — 헤더 연도 라벨 파생(전년 = year-1). */
  year: number;
  onChangeTarget: (key: string, value: string) => void;
  onChangeActual: (key: string, value: string) => void;
  /** 행별 비고(매출·원가만) — 서버 revenueNote/costNote 연동(bulk 저장 포함). */
  notes: Record<string, string>;
  onChangeNote: (key: string, value: string) => void;
}

// 열 구분선 — 마지막 열 제외 전 열에 세로선.
const CELL_DIVIDER = 'border-r border-border/60 last:border-r-0';

function achievementRate(actual: number | null, target: number | null): number | null {
  if (actual === null || target === null || target === 0) return null;
  return Math.round((actual / target) * 1000) / 10;
}

export function MonthInputTable({ rows, canEdit, year, onChangeTarget, onChangeActual, notes, onChangeNote }: Props) {
  const headers = [
    '구분',
    `전년 실적 (${year - 1}년)`,
    `${year}년 목표 (A)`,
    `${year}년 실적 (B)`,
    '달성률 (B/A)',
    '전년 대비 증감',
    '비고',
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* 단위 명시 — 금액 셀은 원 단위 입력(축약 없음), 이익률만 %. */}
      <div className="flex items-center justify-end border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
        단위: 원 (매출·원가·매출총이익) · 이익률: %
      </div>
      <table className="w-full border-collapse" style={{ minWidth: 760 }}>
        <thead>
          <tr className="bg-muted">
            {headers.map((h) => (
              <th key={h} className={`whitespace-nowrap border-b border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground ${CELL_DIVIDER}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rate = row.isRate ? null : achievementRate(row.actual, row.target);
            const delta = yoyDelta(row.actual, row.prevYear);
            // 원가 행은 감소가 긍정(비용 절감) — 증감 색 의미를 반전한다.
            const deltaPositive = delta !== null && (row.key === 'cost' ? delta <= 0 : delta >= 0);
            // 원가 달성률 100% 초과 = 목표 대비 초과 지출(부정) — 경고 색.
            const rateOver = row.key === 'cost' && rate !== null && rate > 100;
            const Icon = ROW_ICON[row.key];
            return (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className={`whitespace-nowrap px-3 py-2.5 ${CELL_DIVIDER}`}>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <Icon size={13} className={ROW_ICON_CLASS[row.key]} aria-hidden />
                    {row.label}
                  </span>
                </td>
                <td className={`px-3 py-2.5 text-right text-[13px] tabular-nums text-muted-foreground ${CELL_DIVIDER}`}>
                  {row.prevYear === null ? '-' : row.isRate ? fmtPct1(row.prevYear) : formatComma(String(row.prevYear))}
                </td>
                <td className={`px-3 py-2.5 text-right ${CELL_DIVIDER}`}>
                  {row.editable && canEdit ? (
                    <Input
                      value={row.target === null ? '' : formatComma(String(row.target))}
                      onChange={(e) => onChangeTarget(row.key, sanitizeNumInput(e.target.value))}
                      inputMode="numeric"
                      className="h-8 text-right text-[13px] tabular-nums"
                    />
                  ) : (
                    <span className="text-[13px] tabular-nums text-foreground">
                      {row.target === null ? '-' : row.isRate ? fmtPct1(row.target) : formatComma(String(row.target))}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2.5 text-right ${CELL_DIVIDER}`}>
                  {row.editable && canEdit ? (
                    <Input
                      value={row.actual === null ? '' : formatComma(String(row.actual))}
                      onChange={(e) => onChangeActual(row.key, sanitizeNumInput(e.target.value))}
                      inputMode="numeric"
                      className="h-8 text-right text-[13px] font-semibold tabular-nums"
                    />
                  ) : (
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {row.actual === null ? '-' : row.isRate ? fmtPct1(row.actual) : formatComma(String(row.actual))}
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums ${rateOver ? 'text-danger-600' : 'text-primary'} ${CELL_DIVIDER}`}
                  title={rateOver ? '원가가 목표를 초과했어요' : undefined}
                >
                  {row.isRate ? '-' : fmtPct1(rate)}
                </td>
                <td className={`px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums ${delta === null ? 'text-muted-foreground' : deltaPositive ? 'text-status-finalized-fg' : 'text-danger-600'} ${CELL_DIVIDER}`}>
                  {fmtDeltaPct(delta)}
                </td>
                {/* 비고 — 매출·원가만 입력 가능(자동계산 행은 '-'). 임시저장/최종저장 시 함께 저장. */}
                <td className={`px-3 py-2.5 ${CELL_DIVIDER}`}>
                  {row.editable && canEdit ? (
                    <Input
                      value={notes[row.key] ?? ''}
                      onChange={(e) => onChangeNote(row.key, e.target.value)}
                      placeholder="비고 입력 (선택)"
                      className="h-8 min-w-[120px] text-[12px]"
                    />
                  ) : (
                    <span className="block text-center text-[12px] text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        매출총이익 = 매출 − 원가 (자동 계산) · 이익률 = 이익 ÷ 매출 × 100 (자동 계산) · 집계: 입력된 1~12월 합계 (자동)
      </p>
    </div>
  );
}
