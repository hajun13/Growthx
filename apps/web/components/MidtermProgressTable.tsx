'use client';

// KPI 진척 표 — component-spec-midterm §3. C-1(본인)·C-2 상세·RES 진척 요약 공용.
// 계산 없이 표시만(달성률·추세·신호 모두 백엔드 산정값).
// 컬럼: 과제명(+group 칩) / 목표 / 현재실적 / 누적달성률 / 추세 / 신호.
// 재설계 2026-06-08: 그룹 섹션 헤더(4px 좌측 바 + 라벨) — eval/self GROUP_CFG와 동일.
import { fmtPercent, fmtAmount, kpiGroupLabel, measureTypeUnit } from '@/lib/ui';
import { T, groupChip } from '@/lib/toss';
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

// 그룹 섹션 색 — eval/self·kpi/page와 동일(GROUP_CFG).
const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

// 그룹 순서(성과중심 → 협업·성장)
const GROUP_ORDER: KpiGroup[] = ['performance_core', 'collaboration_growth'];

// 측정방식별 "목표" 셀 텍스트.
function targetCell(k: KpiProgress): string {
  if (k.measureType === 'qualitative') {
    return k.targetText?.trim() ? k.targetText : '—';
  }
  if (k.targetValue === null) return '—';
  if (k.measureType === 'amount') return fmtAmount(k.targetValue);
  const unit = measureTypeUnit[k.measureType];
  return `${k.targetValue.toLocaleString('ko-KR')}${unit}`;
}

// 측정방식별 "현재실적" 셀 텍스트.
function actualCell(k: KpiProgress): string {
  if (k.measureType === 'qualitative') return '–';
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
  const withTrend = showTrend && variant !== 'result';

  // 그룹별로 분리(섹션 헤더 표시를 위해).
  const byGroup: Partial<Record<KpiGroup, KpiProgress[]>> = {};
  for (const item of items) {
    const g = item.group as KpiGroup;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g]!.push(item);
  }

  // 섹션이 2개 이상인 경우에만 그룹 헤더 표시(단일 그룹이면 헤더 생략).
  const multiGroup = GROUP_ORDER.filter((g) => (byGroup[g]?.length ?? 0) > 0).length > 1;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 640, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.grey50 }} className="text-left">
            <Th>과제명</Th>
            <Th align="right">목표</Th>
            <Th align="right">현재실적</Th>
            <Th align="right">누적달성률</Th>
            {withTrend && <Th align="right">추세</Th>}
            <Th align="center">신호</Th>
          </tr>
        </thead>
        <tbody>
          {GROUP_ORDER.map((group) => {
            const groupItems = byGroup[group];
            if (!groupItems || groupItems.length === 0) return null;
            const cfg = GROUP_CFG[group];
            const colSpan = withTrend ? 6 : 5;
            return [
              // 그룹 섹션 헤더 — 다중 그룹일 때만
              multiGroup && (
                <tr key={`header-${group}`}>
                  <td
                    colSpan={colSpan}
                    style={{ padding: 0, borderTop: `1px solid ${T.grey200}` }}
                  >
                    <div
                      className="flex items-center gap-2"
                      style={{
                        borderLeft: `4px solid ${cfg.bg}`,
                        paddingLeft: 10,
                        paddingRight: 12,
                        paddingTop: 6,
                        paddingBottom: 6,
                        background: T.grey50,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: cfg.bg,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: T.grey500,
                        }}
                      >
                        {groupItems.length}건
                      </span>
                    </div>
                  </td>
                </tr>
              ),
              // 그룹 내 행들
              ...groupItems.map((k) => {
                const isQual = k.measureType === 'qualitative';
                const chip = groupChip[k.group];
                return (
                  <tr
                    key={k.kpiId}
                    className="transition-colors hover:bg-[#f9fafb]"
                    style={{ borderTop: `1px solid ${T.grey200}` }}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-block shrink-0 font-medium"
                          style={{
                            background: chip?.bg ?? T.grey200,
                            color: chip?.color ?? T.grey700,
                            fontSize: 10,
                            padding: '1px 6px',
                          }}
                        >
                          {kpiGroupLabel[k.group]}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                          {k.title}
                          {isQual && (
                            <span
                              className="ml-1.5 inline-block align-middle font-medium"
                              style={{
                                background: '#FEF6E6',
                                color: '#A66800',
                                fontSize: 10,
                                padding: '1px 5px',
                              }}
                            >
                              정성
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums align-top"
                      style={{ fontSize: 12.5, color: T.grey700 }}
                    >
                      {targetCell(k)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums align-top"
                      style={{
                        fontSize: 12.5,
                        color: isQual ? T.grey400 : T.grey900,
                        fontWeight: isQual ? 400 : 600,
                      }}
                    >
                      {actualCell(k)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums align-top"
                      style={{ fontSize: 12.5, color: T.grey900, fontWeight: 600 }}
                    >
                      {isQual ? '–' : fmtPercent(k.cumulativeRate)}
                    </td>
                    {withTrend && (
                      <td className="px-3 py-2.5 text-right align-top">
                        {isQual ? (
                          <span style={{ color: T.grey400, fontSize: 12 }}>—</span>
                        ) : (
                          <TrendIndicator trend={k.trend} />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center align-top">
                      <MidtermSignalBadge signal={k.signal} size="sm" />
                    </td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
      {items.some((k) => k.measureType === 'qualitative') && (
        <p style={{ fontSize: 11, color: T.grey500, marginTop: 8 }}>
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
      className="px-3 py-2 font-semibold"
      style={{
        fontSize: 11.5,
        color: T.grey600,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}
