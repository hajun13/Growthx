'use client';

// KPI 진척 표 — component-spec-midterm §3. C-1(본인)·C-2 상세·RES 진척 요약 공용.
// 계산 없이 표시만(달성률·추세·신호 모두 백엔드 산정값).
// 컬럼: 과제명(+group 칩) / 목표 / 현재실적 / 누적달성률 / 추세 / 신호.
// 재설계 2026-06-08: 그룹 섹션 헤더(4px 좌측 바 + 라벨) — eval/self GROUP_CFG와 동일.
import { fmtPercent, fmtAmount, kpiGroupLabel, measureTypeUnit, kpiTypeLabel } from '@/lib/ui';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MidtermSignalBadge } from './MidtermSignalBadge';
import { TrendIndicator } from './TrendIndicator';
import { EmptyState } from './MidtermStates';
import type { KpiProgress, KpiGroup } from '@/lib/types';

export interface MidtermProgressTableProps {
  items: KpiProgress[];
  // 'self' = 본인 맥락, 'review' = 부서장 읽기, 'result' = 결과 요약(추세 생략 가능).
  variant?: 'self' | 'review' | 'result';
  showTrend?: boolean;
}

// 그룹 순서(성과중심 → 협업·성장) — 행 정렬용. 섹션 헤더는 행별 그룹 칩과 중복이라 제거.
const GROUP_ORDER: KpiGroup[] = ['performance_core', 'collaboration_growth'];

// 그룹 칩 색(구 palette.groupChip: 흰 바탕+진한 글씨 / 연회색 바탕+중간 글씨).
const GROUP_CHIP_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  performance_core: 'outline',
  collaboration_growth: 'neutral',
};

// 측정방식별 "목표" 셀 텍스트. isQualitative가 진실 소스.
function targetCell(k: KpiProgress): string {
  if (k.isQualitative) {
    return k.targetText?.trim() ? k.targetText : '—';
  }
  if (k.targetValue === null) return k.targetText?.trim() ? k.targetText : '—';
  if (k.measureType === 'amount') return fmtAmount(k.targetValue);
  const unit = measureTypeUnit[k.measureType];
  return `${k.targetValue.toLocaleString('ko-KR')}${unit}`;
}

// 측정방식별 "현재실적" 셀 텍스트. isQualitative가 진실 소스.
function actualCell(k: KpiProgress): string {
  if (k.isQualitative) return '–';
  if (k.measureType === 'amount') return fmtAmount(k.cumulativeActual);
  const unit = measureTypeUnit[k.measureType];
  return `${k.cumulativeActual.toLocaleString('ko-KR')}${unit}`;
}

export function MidtermProgressTable({
  items,
  variant = 'self',
  showTrend = true,
}: MidtermProgressTableProps) {
  if (items.length === 0) {
    return <EmptyState title="표시할 KPI 진척이 없어요." />;
  }
  // review(구성원 점검) = 간결 모드 — 실적·달성률·추세·신호 없이 과제명/목표/가중치만(2026-07-02 사용자 피드백).
  // 자가점검 상세는 "상급자 중간 점검" 탭에서 확인한다.
  const compact = variant === 'review';
  const withTrend = !compact && showTrend && variant !== 'result';

  // 그룹별로 분리(섹션 헤더 표시를 위해).
  const byGroup: Partial<Record<KpiGroup, KpiProgress[]>> = {};
  for (const item of items) {
    const g = item.group as KpiGroup;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g]!.push(item);
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50">
      <Table className="min-w-160">
        <TableHeader>
          <TableRow plain>
            <Th>과제명</Th>
            <Th textAlign="right">목표</Th>
            {compact ? (
              <Th textAlign="right">가중치</Th>
            ) : (
              <>
                <Th textAlign="right">현재실적</Th>
                <Th textAlign="right">누적달성률</Th>
                {withTrend && <Th textAlign="right">추세</Th>}
                <Th textAlign="center">신호</Th>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {GROUP_ORDER.map((group) => {
            const groupItems = byGroup[group];
            if (!groupItems || groupItems.length === 0) return null;
            return groupItems.map((k) => {
              // isQualitative 필드가 정량/정성 진실 소스(measureType='qualitative' 상수만으로는 오판).
              const isQual = k.isQualitative;
              const typeLabel = kpiTypeLabel(k);
              return (
                <TableRow key={k.kpiId}>
                  {/* 과제명 */}
                  <TableCell className="align-top">
                    <div className="flex items-start gap-2">
                      {/* 그룹 칩 */}
                      <Badge
                        variant={GROUP_CHIP_VARIANT[k.group] ?? 'neutral'}
                        size="xs"
                        className="mt-0.5"
                      >
                        {kpiGroupLabel[k.group]}
                      </Badge>
                      <span className="text-13 font-semibold leading-snug text-foreground">
                        {k.title}
                        {/* 정성/정량 칩 */}
                        <Badge
                          variant={isQual ? 'warning' : 'info'}
                          shape="pill"
                          size="xs"
                          className="ml-1.5 align-middle"
                        >
                          {typeLabel}
                        </Badge>
                      </span>
                    </div>
                  </TableCell>

                  {/* 목표 */}
                  <TableCell
                    textAlign="right"
                    className="align-top text-12h tabular-nums text-muted-foreground"
                  >
                    {targetCell(k)}
                  </TableCell>

                  {compact ? (
                    /* 가중치 (간결 모드) */
                    <TableCell
                      textAlign="right"
                      className="align-top text-12h font-semibold tabular-nums text-foreground"
                    >
                      {k.weight}%
                    </TableCell>
                  ) : (
                    <>
                      {/* 현재실적 */}
                      <TableCell
                        textAlign="right"
                        className={`align-top text-12h tabular-nums ${isQual ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}
                      >
                        {actualCell(k)}
                      </TableCell>

                      {/* 누적달성률 */}
                      <TableCell
                        textAlign="right"
                        className="align-top text-12h font-semibold tabular-nums text-foreground"
                      >
                        {isQual ? (
                          <span className="font-normal text-muted-foreground">–</span>
                        ) : (
                          fmtPercent(k.cumulativeRate)
                        )}
                      </TableCell>

                      {/* 추세 */}
                      {withTrend && (
                        <TableCell textAlign="right" className="align-top">
                          {isQual ? (
                            <span className="text-12 text-muted-foreground">—</span>
                          ) : (
                            <TrendIndicator trend={k.trend} />
                          )}
                        </TableCell>
                      )}

                      {/* 신호 */}
                      <TableCell textAlign="center" className="align-top">
                        <MidtermSignalBadge signal={k.signal} size="sm" />
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
      {!compact && items.some((k) => k.isQualitative) && (
        <p className="border-t border-border/30 px-4 py-2 text-11 text-muted-foreground">
          정성 과제는 달성률을 자동 산출하지 않아요 — 신호는 진척·부서장 확인 기반이에요.
        </p>
      )}
    </div>
  );
}

function Th({
  children,
  textAlign = 'left',
}: {
  children: React.ReactNode;
  textAlign?: 'left' | 'right' | 'center';
}) {
  return (
    <TableHead
      tone="soft"
      textAlign={textAlign}
      className="text-11 font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </TableHead>
  );
}
