'use client';

// KPI 진척 표 — component-spec-midterm §3. C-1(본인)·C-2 상세·RES 진척 요약 공용.
// 계산 없이 표시만(달성률·추세·신호 모두 백엔드 산정값).
// 컬럼: 과제명(+group 칩) / 목표 / 현재실적 / 누적달성률 / 추세 / 신호.
// 재설계 2026-06-08: 그룹 섹션 헤더(4px 좌측 바 + 라벨) — eval/self GROUP_CFG와 동일.
import { fmtPercent, fmtAmount, kpiGroupLabel, measureTypeUnit, kpiTypeLabel } from '@/lib/ui';
import { groupChip, T } from '@/lib/palette';
import { MidtermSignalBadge } from './MidtermSignalBadge';
import { TrendIndicator } from './TrendIndicator';
import { EmptyState } from './States';
import type { KpiProgress, KpiGroup } from '@/lib/types';

export interface MidtermProgressTableProps {
  items: KpiProgress[];
  // 'self' = 본인 맥락, 'review' = 부서장 읽기, 'result' = 결과 요약(추세 생략 가능).
  variant?: 'self' | 'review' | 'result';
  showTrend?: boolean;
}

// 그룹 순서(성과중심 → 협업·성장) — 행 정렬용. 섹션 헤더는 행별 그룹 칩과 중복이라 제거.
const GROUP_ORDER: KpiGroup[] = ['performance_core', 'collaboration_growth'];

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
      <table className="w-full text-sm" style={{ minWidth: 640, borderCollapse: 'collapse' }}>
        <thead>
          <tr className="bg-muted/60 text-left border-b border-border/40">
            <Th>과제명</Th>
            <Th align="right">목표</Th>
            {compact ? (
              <Th align="right">가중치</Th>
            ) : (
              <>
                <Th align="right">현재실적</Th>
                <Th align="right">누적달성률</Th>
                {withTrend && <Th align="right">추세</Th>}
                <Th align="center">신호</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/25">
          {GROUP_ORDER.map((group) => {
            const groupItems = byGroup[group];
            if (!groupItems || groupItems.length === 0) return null;
            return groupItems.map((k) => {
                // isQualitative 필드가 정량/정성 진실 소스(measureType='qualitative' 상수만으로는 오판).
                const isQual = k.isQualitative;
                const typeLabel = kpiTypeLabel(k);
                const chip = groupChip[k.group];
                return (
                  <tr
                    key={k.kpiId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* 과제명 */}
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        {/* 그룹 칩 */}
                        <span
                          className="mt-0.5 inline-block shrink-0 rounded font-medium"
                          style={{
                            background: chip?.bg ?? 'rgba(204,204,212,0.4)',
                            color: chip?.color ?? '#565660',
                            fontSize: 10,
                            padding: '1px 6px',
                          }}
                        >
                          {kpiGroupLabel[k.group]}
                        </span>
                        <span className="text-[13px] font-semibold text-foreground leading-snug">
                          {k.title}
                          {/* 정성/정량 칩 */}
                          <span
                            className="ml-1.5 inline-block align-middle font-medium rounded-full"
                            style={{
                              background: isQual ? 'rgba(245,120,0,0.08)' : 'rgba(2,87,206,0.08)',
                              color: isQual ? T.orange500 : T.blue500,
                              fontSize: 10,
                              padding: '1px 6px',
                            }}
                          >
                            {typeLabel}
                          </span>
                        </span>
                      </div>
                    </td>

                    {/* 목표 */}
                    <td className="px-3 py-3 text-right tabular-nums align-top text-[12.5px] text-muted-foreground">
                      {targetCell(k)}
                    </td>

                    {compact ? (
                      /* 가중치 (간결 모드) */
                      <td className="px-3 py-3 text-right tabular-nums align-top text-[12.5px] font-semibold text-foreground">
                        {k.weight}%
                      </td>
                    ) : (
                      <>
                        {/* 현재실적 */}
                        <td className={`px-3 py-3 text-right tabular-nums align-top text-[12.5px] ${isQual ? 'text-muted-foreground' : 'text-foreground font-semibold'}`}>
                          {actualCell(k)}
                        </td>

                        {/* 누적달성률 */}
                        <td className="px-3 py-3 text-right tabular-nums align-top text-[12.5px] text-foreground font-semibold">
                          {isQual ? (
                            <span className="text-muted-foreground font-normal">–</span>
                          ) : (
                            fmtPercent(k.cumulativeRate)
                          )}
                        </td>

                        {/* 추세 */}
                        {withTrend && (
                          <td className="px-3 py-3 text-right align-top">
                            {isQual ? (
                              <span className="text-[12px] text-muted-foreground">—</span>
                            ) : (
                              <TrendIndicator trend={k.trend} />
                            )}
                          </td>
                        )}

                        {/* 신호 */}
                        <td className="px-3 py-3 text-center align-top">
                          <MidtermSignalBadge signal={k.signal} size="sm" />
                        </td>
                      </>
                    )}
                  </tr>
                );
            });
          })}
        </tbody>
      </table>
      {!compact && items.some((k) => k.isQualitative) && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/30">
          정성 과제는 달성률을 자동 산출하지 않아요 — 신호는 진척·부서장 확인 기반이에요.
        </p>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      className="px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}
