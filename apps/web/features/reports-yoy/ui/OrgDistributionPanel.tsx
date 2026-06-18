'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useDepartments } from '@/hooks/useDepartments';
import { useYoyDistribution } from '../hooks';
import { Select } from '@/components/Select';
import { Card } from '@/components/Card';
import { InfoBanner } from '@/components/InfoBanner';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import {
  YoyDistributionGroup,
  type YoyDistRow,
} from '@/components/yoy/YoyDistributionGroup';
import { DistRatioTable } from '@/components/yoy/DistRatioTable';
import { YoyStatCard } from '@/components/yoy/YoyStatCard';
import {
  CycleMultiSelect,
  type CycleOption,
} from '@/components/yoy/CycleMultiSelect';
import { CalendarRange, Users, Award, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { gradeColor } from '@/lib/grade';
import { StepLabel } from '@/components/yoy/StepLabel';
import type { LegalEntityValue } from '@/components/yoy/LegalEntityFilter';
import type { DistributionScope, Grade } from '@/lib/types';

// 색 상수 — DESIGN.md 시맨틱 토큰 직접 참조. 인라인 style이 불가피한 곳에서만 사용.
const COLOR = {
  onSurface:        '#18181C', // neutral-950
  onSurfaceVariant: '#565660', // neutral-600
  outline:          '#74747F', // neutral-500
  surfaceLow:       '#EFEFF2', // neutral-100 / bg-muted
  purple:           '#7A37D8', // purple-500 (primary)
  blue:             '#2563EB', // info-500
  amber:            '#F59E0B', // warning-500
} as const;

interface PanelProps {
  legalEntity: LegalEntityValue;
  includeResigned: boolean;
  search: ReadonlyURLSearchParams;
  pushQuery: (patch: Record<string, string | null>) => void;
}

const SCOPE_LABEL: Record<DistributionScope, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};
// Radix Select 는 빈 문자열 value 를 허용하지 않는다(런타임 throw).
// "전체"(선택 해제) 항목은 빈 문자열 대신 sentinel 값을 쓰고 onChange 에서 null 로 환원.
const ALL_ORGS = '__ALL__';
const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function OrgDistributionPanel({
  legalEntity,
  search,
  pushQuery,
}: PanelProps) {
  // 쿼리 동기화: scope·orgId(딥링크). 기본 group.
  const scopeParam = (search.get('scope') as DistributionScope) || 'group';
  const scope: DistributionScope = ['group', 'division', 'team'].includes(
    scopeParam,
  )
    ? scopeParam
    : 'group';
  const deptId = search.get('orgId');

  // OrgPicker 후보 — scope 에 맞는 부서 타입.
  const { data: deptData, loading: deptLoading } = useDepartments({
    type: scope,
  });
  const depts = deptData?.data ?? [];

  const [selectedCycleIds, setSelectedCycleIds] = useState<string[]>([]);

  const { data, loading, error, reload } = useYoyDistribution({
    scope,
    deptId,
    cycleIds: selectedCycleIds,
    legalEntity,
  });

  // 응답 cycles → 사이클 멀티셀렉트 옵션(전 사이클일 때만 갱신).
  const [cycleOptions, setCycleOptions] = useState<CycleOption[]>([]);
  useEffect(() => {
    if (!data) return;
    if (selectedCycleIds.length !== 0) return;
    setCycleOptions(
      data.cycles.map((c) => ({
        cycleId: c.cycleId,
        year: c.year,
        name: c.cycleName,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 표시 대상 사이클(선택 필터 적용).
  const cycles = useMemo(() => {
    const all = data?.cycles ?? [];
    if (selectedCycleIds.length === 0) return all;
    return all.filter((c) => selectedCycleIds.includes(c.cycleId));
  }, [data, selectedCycleIds]);

  // YoY 비교 행 — 특정 조직(deptId) 선택 시 그 bucket, 아니면 overall(전체).
  const selectedDeptName = depts.find((d) => d.id === deptId)?.name;
  const hasDeptSelected = !!deptId && selectedDeptName != null;
  const rows: YoyDistRow[] = useMemo(() => {
    return cycles.map((c) => {
      // 특정 조직 선택 시: 그 조직의 해당 연도 버킷만 사용(overall 무단 대체 금지).
      // 미선택(전체 보기)일 때만 overall 사용.
      const bucket = hasDeptSelected
        ? c.buckets.find((b) => b.deptName === selectedDeptName)
        : undefined;

      // 조직을 골랐는데 그 연도 버킷이 없으면 → 빈 상태 행(해당 연도 데이터 없음).
      if (hasDeptSelected && !bucket) {
        const zero = {} as Record<Grade, number>;
        for (const g of GRADES) zero[g] = 0;
        return {
          cycleId: c.cycleId,
          year: c.year,
          total: 0,
          counts: zero,
          ratios: zero,
          missing: true,
        };
      }

      const counts = bucket
        ? bucket.counts
        : (c.overall.counts as Record<Grade, number>);
      const ratios = bucket
        ? bucket.ratios
        : (c.overall.ratios as Record<Grade, number>);
      const total = bucket ? bucket.total : c.overall.total;
      // 누락 등급 키 방어(0 채움).
      const safeCounts = {} as Record<Grade, number>;
      const safeRatios = {} as Record<Grade, number>;
      for (const g of GRADES) {
        safeCounts[g] = counts?.[g] ?? 0;
        safeRatios[g] = ratios?.[g] ?? 0;
      }
      return {
        cycleId: c.cycleId,
        year: c.year,
        total,
        counts: safeCounts,
        ratios: safeRatios,
      };
    });
  }, [cycles, selectedDeptName, hasDeptSelected]);

  const allCycleIds = cycleOptions.map((o) => o.cycleId);

  // 상단 요약 통계 — 비교 연도·최근 총원·최다 등급(최근)·우수(S+A) 비율 추세.
  const stats = useMemo(() => {
    const present = rows.filter((r) => !r.missing && r.total > 0);
    if (present.length === 0) return null;
    const latest = present[present.length - 1];
    const first = present[0];
    // 최근 연도 최다 등급.
    const top = (GRADES as Grade[]).reduce((a, b) =>
      latest.counts[b] > latest.counts[a] ? b : a,
    );
    const excellentOf = (r: (typeof present)[number]) =>
      r.total > 0 ? ((r.counts.S + r.counts.A) / r.total) * 100 : 0;
    const latestExc = excellentOf(latest);
    const excDelta = present.length >= 2 ? latestExc - excellentOf(first) : 0;
    return {
      years: rows.length,
      latestTotal: latest.total,
      latestYear: latest.year,
      top,
      latestExc,
      excDelta,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-5">
      {/* 범위 선택 바 — 1단계(조직 범위) → 2단계(비교 사이클) 흐름 */}
      <Card padding="sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StepLabel step={1} label="조직 범위" done />
            {/* 단위 토글(그룹/본부/팀) — DS SegmentedControl 대체(Pill 탭 패턴) */}
            <div
              role="tablist"
              aria-label="조직 단위"
              className="flex items-center gap-1 p-1 rounded-lg bg-muted"
            >
              {(['group', 'division', 'team'] as DistributionScope[]).map((s) => {
                const active = scope === s;
                return (
                  <Button
                    key={s}
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    role="tab"
                    aria-selected={active}
                    onClick={() => pushQuery({ scope: s, orgId: null })}
                    className={active
                      ? 'bg-white text-foreground shadow-elev-1 font-semibold'
                      : 'text-muted-foreground font-semibold'}
                  >
                    {SCOPE_LABEL[s]}
                  </Button>
                );
              })}
            </div>

            {/* OrgPicker */}
            <div className="w-full sm:w-[260px]">
              <Select
                label="대상 조직"
                hideLabel
                placeholder={
                  deptLoading
                    ? '불러오는 중…'
                    : `전체 ${SCOPE_LABEL[scope]}`
                }
                value={deptId ?? ALL_ORGS}
                options={[
                  { value: ALL_ORGS, label: `전체 ${SCOPE_LABEL[scope]}` },
                  ...depts.map((d) => ({ value: d.id, label: d.name })),
                ]}
                onChange={(v) =>
                  pushQuery({ orgId: v === ALL_ORGS ? null : v })
                }
              />
            </div>
          </div>

          {/* 비교 사이클 멀티셀렉트 */}
          {cycleOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
              <StepLabel step={2} label="비교할 연도" done />
              <CycleMultiSelect
                options={cycleOptions}
                selected={
                  selectedCycleIds.length === 0
                    ? allCycleIds
                    : selectedCycleIds
                }
                onChange={(ids) =>
                  setSelectedCycleIds(
                    ids.length === allCycleIds.length ? [] : ids,
                  )
                }
              />
              <span className="text-[11px] text-muted-foreground">
                연도를 눌러 비교 대상을 좁힐 수 있어요
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 본문 */}
      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="해당 조직의 평가 결과가 아직 없어요"
          description={`선택한 ${SCOPE_LABEL[scope]} 범위에 누적된 평가 결과가 없어요. 위에서 다른 조직 범위나 연도를 선택해 보세요.`}
        />
      ) : (
        <>
          {/* 요약 통계 카드 */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <YoyStatCard
                label="비교 연도"
                value={`${stats.years}개년`}
                accent={COLOR.onSurface}
                icon={CalendarRange}
              />
              <YoyStatCard
                label={`최근 인원 (${stats.latestYear})`}
                value={`${stats.latestTotal}명`}
                accent={COLOR.purple}
                icon={Users}
              />
              <YoyStatCard
                label="최다 등급 (최근)"
                value={stats.top}
                accent={gradeColor(stats.top).fg}
                icon={Award}
              />
              <YoyStatCard
                label="우수(S·A) 비율"
                value={`${Math.round(stats.latestExc)}%`}
                accent={
                  stats.excDelta > 0
                    ? COLOR.blue
                    : stats.excDelta < 0
                      ? COLOR.amber
                      : COLOR.onSurfaceVariant
                }
                icon={ArrowUpRight}
                trend={
                  stats.excDelta > 0
                    ? 'up'
                    : stats.excDelta < 0
                      ? 'down'
                      : 'flat'
                }
                hint={
                  stats.excDelta !== 0
                    ? `첫해 대비 ${stats.excDelta > 0 ? '+' : ''}${Math.round(
                        stats.excDelta,
                      )}%p`
                    : '첫해와 같아요'
                }
              />
            </div>
          )}

          <Card
            title={`등급 분포${
              selectedDeptName ? ` · ${selectedDeptName}` : ''
            }`}
          >
            <YoyDistributionGroup rows={rows} />
          </Card>

          <Card title="등급 비율">
            <DistRatioTable rows={rows} />
          </Card>

          <InfoBanner tone="info" title="분포는 당시 조직 스냅샷 기준이에요">
            연도별 분포는 평가 당시의 조직·인원 기준으로 집계했어요. 사이클별 등급
            기준이 다를 수 있으니 절대 비교 시 주의하세요.
          </InfoBanner>
        </>
      )}
    </div>
  );
}
