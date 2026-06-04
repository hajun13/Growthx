'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import {
  useMonthlyPerformance,
  useMonthlyPerformanceSummary,
  monthlyPerformanceCommands,
} from '@/hooks/useMonthlyPerformance';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { GradeChip } from '@/components/GradeChip';
import { AchievementGauge } from '@/components/AchievementGauge';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { kpiCategoryLabel, fmtAmount, monthLabel, fmtPercent } from '@/lib/ui';
import type {
  KpiCategory,
  MonthlyPerformance,
  MonthlyPerformanceInput,
} from '@/lib/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
// 월별 실적 입력은 성과중심 금액형 카테고리 대상.
const CATEGORY_OPTIONS: { value: KpiCategory; label: string }[] = [
  { value: 'revenue', label: kpiCategoryLabel.revenue },
  { value: 'construction', label: kpiCategoryLabel.construction },
  { value: 'orders', label: kpiCategoryLabel.orders },
];

interface CellDraft {
  id?: string;
  target: string;
  actual: string;
}

function rowKey(month: number, category: KpiCategory): string {
  return `${month}:${category}`;
}

export default function MonthlyPerformancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;
  const year = current?.year;

  const isAdmin = user?.role === 'hr_admin';
  const isDivisionHead = user?.role === 'division_head';
  // hr_admin·division_head 입력, team_lead 조회.
  const allowed =
    !!user &&
    (isAdmin || isDivisionHead || user.role === 'team_lead');
  const canEdit = isAdmin || isDivisionHead;

  // 그룹/본부 부서 목록(입력 단위). division_head 는 본인 본부만 후보.
  const { data: groupDepts } = useDepartments(
    { type: 'group' },
    { enabled: allowed },
  );
  const { data: divisionDepts } = useDepartments(
    { type: 'division' },
    { enabled: allowed },
  );

  const deptOptions = useMemo(() => {
    const groups = (groupDepts?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (그룹)`,
    }));
    let divisions = (divisionDepts?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (본부)`,
    }));
    // division_head 는 본인 소속 본부만(행 수준은 백엔드가 강제, 프론트는 UX 가드).
    if (isDivisionHead && user?.departmentId) {
      divisions = divisions.filter((o) => o.value === user.departmentId);
    }
    return isDivisionHead ? divisions : [...groups, ...divisions];
  }, [groupDepts, divisionDepts, isDivisionHead, user?.departmentId]);

  const [departmentId, setDepartmentId] = useState<string>('');
  const [category, setCategory] = useState<KpiCategory>('revenue');

  // 부서 후보가 로드되면 기본 선택.
  useEffect(() => {
    if (!departmentId && deptOptions.length > 0) {
      setDepartmentId(deptOptions[0].value);
    }
  }, [deptOptions, departmentId]);

  const {
    data: perfData,
    loading: perfLoading,
    error,
    reload,
  } = useMonthlyPerformance(
    { cycleId, departmentId, year },
    { enabled: allowed && !!cycleId && !!departmentId },
  );

  const {
    data: summary,
    reload: reloadSummary,
  } = useMonthlyPerformanceSummary(
    { cycleId, departmentId },
    { enabled: allowed && !!cycleId && !!departmentId },
  );

  // 서버 실적 → { "month:category": MonthlyPerformance } 맵.
  const serverMap = useMemo(() => {
    const m = new Map<string, MonthlyPerformance>();
    for (const p of perfData?.data ?? []) {
      m.set(rowKey(p.month, p.category), p);
    }
    return m;
  }, [perfData]);

  // 현재 카테고리의 12개월 드래프트.
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, CellDraft> = {};
    for (const month of MONTHS) {
      const existing = serverMap.get(rowKey(month, category));
      next[rowKey(month, category)] = {
        id: existing?.id,
        target: existing ? String(existing.targetAmount) : '',
        actual: existing ? String(existing.actualAmount) : '',
      };
    }
    setDrafts(next);
  }, [serverMap, category]);

  function updateCell(month: number, patch: Partial<CellDraft>) {
    const key = rowKey(month, category);
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function saveAll() {
    if (!cycleId || !departmentId || !year) return;
    setSaving(true);
    try {
      for (const month of MONTHS) {
        const key = rowKey(month, category);
        const cell = drafts[key];
        if (!cell) continue;
        const target = cell.target === '' ? null : Number(cell.target);
        const actual = cell.actual === '' ? null : Number(cell.actual);
        // 둘 다 비어있으면 스킵(미입력 월).
        if (target === null && actual === null) continue;
        const body: MonthlyPerformanceInput = {
          cycleId,
          departmentId,
          year,
          month,
          targetAmount: target ?? 0,
          actualAmount: actual ?? 0,
          category,
        };
        if (cell.id) {
          await monthlyPerformanceCommands.update(cell.id, body);
        } else {
          await monthlyPerformanceCommands.create(body);
        }
      }
      toast.show({ variant: 'success', message: '월별 실적을 저장했어요.' });
      reload();
      reloadSummary();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return <Forbidden message="월별 실적 입력은 HR·본부장만 접근할 수 있어요." />;
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="월별 실적 입력"
        subtitle="그룹·본부별 1~12월 목표/실적을 입력하면 누적 달성률과 현재 등급이 자동 계산돼요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <InfoBanner tone="info" title="입력 안내">
        매월 목표와 실적을 입력하면 누적 달성률(실적 합계 / 목표 합계)이 자동
        계산되고, 측정방식별 기준으로 현재 등급이 표시돼요. 입력 주기는 월 1회예요.
        {!canEdit && ' (조회 전용 — 입력은 HR·본부장만 가능해요.)'}
      </InfoBanner>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select
          label="대상 부서 (그룹/본부)"
          value={departmentId}
          options={deptOptions}
          onChange={setDepartmentId}
          placeholder="부서 선택"
        />
        <Select
          label="카테고리"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(v) => setCategory(v as KpiCategory)}
        />
        <div className="flex items-end">
          <span className="text-sm text-muted-foreground">
            기준 연도 {year}년
          </span>
        </div>
      </div>

      {/* 누적 요약 — 현재 등급 + 달성률 게이지 */}
      <Card title="누적 달성 현황">
        {summary ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">현재 등급</span>
              <GradeChip grade={summary.currentGrade} variant="solid" />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <span>
                목표 합계{' '}
                <span className="font-bold tabular-nums">
                  {fmtAmount(summary.targetAmount)}
                </span>
              </span>
              <span>
                실적 합계{' '}
                <span className="font-bold tabular-nums">
                  {fmtAmount(summary.actualAmount)}
                </span>
              </span>
            </div>
            <div className="min-w-[200px] flex-1">
              <AchievementGauge
                rate={summary.achievementRate}
                label="누적 달성률"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            실적을 입력하면 누적 달성률과 현재 등급이 표시돼요.
          </p>
        )}
      </Card>

      {/* 월별 입력 테이블 */}
      <Card
        title={`${kpiCategoryLabel[category]} 월별 목표/실적`}
        action={
          canEdit && (
            <Button size="sm" loading={saving} onClick={() => void saveAll()}>
              저장
            </Button>
          )
        }
      >
        {perfLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : !departmentId ? (
          <EmptyState title="대상 부서를 선택해 주세요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">월</th>
                  <th className="py-2 pr-3 font-medium">목표</th>
                  <th className="py-2 pr-3 font-medium">실적</th>
                  <th className="py-2 font-medium text-right">월 달성률</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((month) => {
                  const cell = drafts[rowKey(month, category)] ?? {
                    target: '',
                    actual: '',
                  };
                  const t = Number(cell.target) || 0;
                  const a = Number(cell.actual) || 0;
                  const rate = t > 0 ? (a / t) * 100 : null;
                  return (
                    <tr
                      key={month}
                      className="border-t border-border/60"
                    >
                      <td className="py-2 pr-3 font-medium text-foreground">
                        {monthLabel(month)}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={`${monthLabel(month)} 목표`}
                          value={cell.target}
                          readOnly={!canEdit}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateCell(month, { target: e.target.value })
                          }
                          className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={`${monthLabel(month)} 실적`}
                          value={cell.actual}
                          readOnly={!canEdit}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateCell(month, { actual: e.target.value })
                          }
                          className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums text-foreground">
                        {rate === null ? '–' : fmtPercent(rate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              월 달성률은 입력값 미리보기예요. 누적 달성률·등급은 저장 후 백엔드가
              산정해요.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
