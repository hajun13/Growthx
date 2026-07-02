'use client';

// draft(월별 손익 입력값) 기반 파생 계산 — 차트 데이터/년계 요약/선택월 4행/달성 현황.
// 저장값(매출·원가 목표·실적)만 백엔드에 보내고, 매출총이익·이익률·년계·달성률은 전부 여기서 라이브 계산한다.
// MonthlyPerformanceView 에서 분리(파일당 ~200줄 상한).
import { useMemo } from 'react';
import {
  MONTHS,
  type GridDraft,
  liveCell,
  liveGross,
  liveGrossYearTotal,
  liveMargin,
  liveYearTotal,
  parseNum,
  cellKey,
  type RowKey,
} from './FinancialGridHelpers';
import type { PerfChartDatum } from './PerfCharts';
import type { MonthRowValue } from './MonthInputTable';
import { formatTargetAmount, type AchievementRow } from './AchievementPanel';

export function usePerfDerived(draft: GridDraft, activeMonth: number) {
  const completeMonths = useMemo(() => {
    const set = new Set<number>();
    for (const m of MONTHS) {
      const rows: RowKey[] = ['revenueTarget', 'revenueActual', 'costTarget', 'costActual'];
      const filled = rows.every((rk) => {
        const raw = draft[cellKey(String(m), rk)] ?? '';
        return raw.trim() !== '' && parseNum(raw) !== null;
      });
      if (filled) set.add(m);
    }
    return set;
  }, [draft]);

  const chartData = useMemo<PerfChartDatum[]>(() => {
    return MONTHS.map((month) => {
      const key = String(month);
      return {
        month,
        label: `${month}월`,
        revenueTarget: liveCell(draft, key, 'revenueTarget'),
        revenueActual: liveCell(draft, key, 'revenueActual'),
        grossProfitActual: liveGross(draft, key, false),
        marginRate: liveMargin(draft, key, false),
      };
    });
  }, [draft]);

  const hasChartData = chartData.some((d) => d.revenueTarget !== null || d.revenueActual !== null || d.grossProfitActual !== null);

  const yearSummary = useMemo(() => {
    const revenueActualTotal = liveYearTotal(draft, 'revenueActual');
    const revenueTargetTotal = liveYearTotal(draft, 'revenueTarget');
    const costActualTotal = liveYearTotal(draft, 'costActual');
    const costTargetTotal = liveYearTotal(draft, 'costTarget');
    const grossActualTotal = liveGrossYearTotal(draft, false);
    const grossTargetTotal = liveGrossYearTotal(draft, true);
    const marginActualTotal =
      revenueActualTotal && revenueActualTotal > 0 && grossActualTotal !== null
        ? Math.round((grossActualTotal / revenueActualTotal) * 1000) / 10
        : null;
    const marginTargetTotal =
      revenueTargetTotal && revenueTargetTotal > 0 && grossTargetTotal !== null
        ? Math.round((grossTargetTotal / revenueTargetTotal) * 1000) / 10
        : null;
    const projectedAnnualRate =
      revenueTargetTotal && revenueTargetTotal > 0 && revenueActualTotal !== null && completeMonths.size > 0
        ? Math.round((((revenueActualTotal / completeMonths.size) * 12) / revenueTargetTotal) * 1000) / 10
        : null;
    return {
      revenueActualTotal, revenueTargetTotal, costActualTotal, costTargetTotal,
      grossActualTotal, grossTargetTotal, marginActualTotal, marginTargetTotal, projectedAnnualRate,
    };
  }, [draft, completeMonths]);

  // 선택 월의 4행(매출/원가/매출총이익/이익률) — 전년은 prevYear 컬럼(연간 단일값)을 그대로 사용.
  const monthRows = useMemo<MonthRowValue[]>(() => {
    const mk = String(activeMonth);
    const prevRevenue = liveCell(draft, 'prevYear', 'revenueActual');
    const prevCost = liveCell(draft, 'prevYear', 'costActual');
    const prevGross = prevRevenue !== null && prevCost !== null ? prevRevenue - prevCost : null;
    const prevMargin = prevRevenue && prevRevenue > 0 && prevGross !== null ? Math.round((prevGross / prevRevenue) * 1000) / 10 : null;
    return [
      { key: 'revenue', label: '매출', prevYear: prevRevenue, target: liveCell(draft, mk, 'revenueTarget'), actual: liveCell(draft, mk, 'revenueActual'), editable: true, isRate: false },
      { key: 'cost', label: '원가', prevYear: prevCost, target: liveCell(draft, mk, 'costTarget'), actual: liveCell(draft, mk, 'costActual'), editable: true, isRate: false },
      { key: 'gross', label: '매출총이익', prevYear: prevGross, target: liveGross(draft, mk, true), actual: liveGross(draft, mk, false), editable: false, isRate: false },
      { key: 'margin', label: '이익률', prevYear: prevMargin, target: liveMargin(draft, mk, true), actual: liveMargin(draft, mk, false), editable: false, isRate: true },
    ];
  }, [draft, activeMonth]);

  const achievementRows: AchievementRow[] = useMemo(() => {
    const revActual = liveCell(draft, String(activeMonth), 'revenueActual');
    const revTarget = liveCell(draft, String(activeMonth), 'revenueTarget');
    const revRate = revActual !== null && revTarget && revTarget > 0 ? Math.round((revActual / revTarget) * 1000) / 10 : null;
    const marginActual = liveMargin(draft, String(activeMonth), false);
    const marginTarget = liveMargin(draft, String(activeMonth), true);
    const marginRate = marginActual !== null && marginTarget && marginTarget > 0 ? Math.round((marginActual / marginTarget) * 1000) / 10 : null;
    const grossActual = liveGross(draft, String(activeMonth), false);
    const grossTarget = liveGross(draft, String(activeMonth), true);
    const grossRate = grossActual !== null && grossTarget && grossTarget > 0 ? Math.round((grossActual / grossTarget) * 1000) / 10 : null;
    return [
      { label: '매출 달성률', rate: revRate, targetDisplay: formatTargetAmount(revTarget) },
      { label: '이익률', rate: marginRate, targetDisplay: marginTarget === null ? '-' : `${marginTarget.toFixed(1)}%` },
      { label: '매출총이익', rate: grossRate, targetDisplay: formatTargetAmount(grossTarget) },
    ];
  }, [draft, activeMonth]);

  return { completeMonths, chartData, hasChartData, yearSummary, monthRows, achievementRows };
}
