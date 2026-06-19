'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useUsers } from '@/hooks/useUsers';
import { useYoyCompare } from '../hooks';
import { Select } from '@/components/Select';
import { Card } from '@/components/Card';
import { InfoBanner } from '@/components/InfoBanner';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import {
  YoyTimelineChart,
  type YoyTimelinePoint,
} from '@/components/yoy/YoyTimelineChart';
import { YearDetailCard } from '@/components/yoy/YearDetailCard';
import {
  CycleMultiSelect,
  type CycleOption,
} from '@/components/yoy/CycleMultiSelect';
import { UserSearch } from 'lucide-react';
import { legalEntityLabel, fmtScore } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import { StepLabel } from '@/components/yoy/StepLabel';
import type { LegalEntityValue } from '@/components/yoy/LegalEntityFilter';
import type { CompareTimelineEntry, Grade } from '@/lib/types';

const GRADE_RANK: Record<Grade, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

interface PanelProps {
  legalEntity: LegalEntityValue;
  includeResigned: boolean;
  search: ReadonlyURLSearchParams;
  pushQuery: (patch: Record<string, string | null>) => void;
}

// 법인 레이블 Pill — DS 시맨틱 클래스 사용
function LegalEntityPill({ value }: { value: string }) {
  const label = legalEntityLabel[value as keyof typeof legalEntityLabel] ?? value;
  return (
    <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
}

export function PersonTimelinePanel({
  includeResigned,
  search,
  pushQuery,
}: PanelProps) {
  // 딥링크 userId(평가결과 상세에서 진입). 없으면 미선택.
  const userIdParam = search.get('userId');

  // PersonPicker 후보 — 퇴사자 토글에 따라 비활성 포함.
  const { data: usersData, loading: usersLoading } = useUsers({
    includeInactive: includeResigned,
    pageSize: 500,
  });
  const users = usersData?.data ?? [];

  // 비교 사이클 선택(빈 배열 = 전 사이클). 응답에서 옵션 도출.
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[]>([]);

  const {
    data: compare,
    loading,
    error,
    reload,
  } = useYoyCompare(
    { userId: userIdParam, cycleIds: selectedCycleIds },
    { enabled: !!userIdParam },
  );

  // 응답 timeline → 사이클 멀티셀렉트 옵션(연도 오름차순, 전 사이클 기준).
  // 선택이 비어있을 때(전 사이클)만 옵션을 갱신해 안정적으로 유지.
  const [cycleOptions, setCycleOptions] = useState<CycleOption[]>([]);
  useEffect(() => {
    if (!compare) return;
    if (selectedCycleIds.length !== 0) return;
    setCycleOptions(
      compare.timeline.map((t) => ({
        cycleId: t.cycleId,
        year: t.year,
        name: t.cycleName,
      })),
    );
    // selectedCycleIds 의존 — 전 사이클 응답에서만 옵션 채움.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare]);

  // 선택이 있으면 그 사이클만, 없으면 전체 표시.
  const timeline: CompareTimelineEntry[] = useMemo(() => {
    const all = compare?.timeline ?? [];
    if (selectedCycleIds.length === 0) return all;
    return all.filter((t) => selectedCycleIds.includes(t.cycleId));
  }, [compare, selectedCycleIds]);

  // 차트 포인트 — reflected = 점수가 등급에 반영됐는지(역량 미반영 연도 등).
  const points: YoyTimelinePoint[] = useMemo(
    () =>
      timeline.map((t) => ({
        cycleId: t.cycleId,
        year: t.year,
        grade: t.finalGrade,
        score: t.finalScore,
        org: t.org,
        // 실적 기준 등급은 항상 반영. ruleSummary.competencyIncluded 는 역량 포함 여부일 뿐.
        // 점수 반영 여부 신호가 별도로 없으므로 등급 존재 = 반영으로 간주.
        reflected: t.finalGrade !== null,
      })),
    [timeline],
  );

  // 규칙 차이 배너 — 연도별 competencyIncluded 가 섞여 있으면 표시.
  const ruleDiff = useMemo(() => {
    const flags = timeline.map((t) => t.ruleSummary.competencyIncluded);
    const hasIncluded = flags.some((f) => f);
    const hasExcluded = flags.some((f) => !f);
    return { hasIncluded, mixed: hasIncluded && hasExcluded };
  }, [timeline]);

  // 전년 대비 조직 변경 표시(연도 오름차순 가정).
  const orgChangedByCycle = useMemo(() => {
    const map = new Map<
      string,
      { group: boolean; division: boolean; team: boolean }
    >();
    timeline.forEach((t, i) => {
      if (i === 0) {
        map.set(t.cycleId, { group: false, division: false, team: false });
        return;
      }
      const prev = timeline[i - 1];
      map.set(t.cycleId, {
        group: t.org.group !== prev.org.group,
        division: t.org.division !== prev.org.division,
        team: t.org.team !== prev.org.team,
      });
    });
    return map;
  }, [timeline]);

  // 전년 대비 최종점수 증감(연도 오름차순). 두 해 모두 점수가 있을 때만 산출.
  const scoreDeltaByCycle = useMemo(() => {
    const map = new Map<string, number | null>();
    timeline.forEach((t, i) => {
      if (i === 0) {
        map.set(t.cycleId, null);
        return;
      }
      const prev = timeline[i - 1];
      if (t.finalScore == null || prev.finalScore == null) {
        map.set(t.cycleId, null);
        return;
      }
      map.set(t.cycleId, t.finalScore - prev.finalScore);
    });
    return map;
  }, [timeline]);

  // 상단 요약 통계 — 평가 연수·최고 등급·최근 등급/점수·추세(등급 있는 연도만).
  const stats = useMemo(() => {
    const graded = timeline.filter((t) => t.finalGrade !== null);
    if (graded.length === 0) return null;
    const best = graded.reduce((a, b) =>
      GRADE_RANK[b.finalGrade as Grade] > GRADE_RANK[a.finalGrade as Grade] ? b : a,
    );
    const latest = graded[graded.length - 1];
    const first = graded[0];
    const delta =
      graded.length >= 2
        ? GRADE_RANK[latest.finalGrade as Grade] -
          GRADE_RANK[first.finalGrade as Grade]
        : 0;
    return {
      years: timeline.length,
      best: best.finalGrade as Grade,
      latest: latest.finalGrade as Grade,
      latestScore: latest.finalScore,
      delta,
    };
  }, [timeline]);

  const personOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.name}${u.isActive ? '' : ' (퇴사)'}`,
      })),
    [users],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 사람 선택 바 — 1단계(임직원) → 2단계(비교 사이클) 흐름 */}
      <Card padding="sm">
        <div className="flex flex-col gap-3">
          {/* 1단계: 임직원 선택 */}
          <div className="flex flex-wrap items-center gap-3">
            <StepLabel step={1} label="임직원 선택" done={!!userIdParam} />
            <div className="w-full sm:w-[260px]">
              <Select
                label="임직원 선택"
                hideLabel
                placeholder={
                  usersLoading ? '불러오는 중…' : '비교할 임직원을 골라 주세요'
                }
                value={userIdParam ?? ''}
                options={personOptions}
                onChange={(v) => {
                  setSelectedCycleIds([]);
                  pushQuery({ userId: v });
                }}
              />
            </div>
            {compare && (
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-foreground">
                  {compare.userName}
                </span>
                <LegalEntityPill value={compare.legalEntity} />
                {compare.employmentStatus === 'resigned' && (
                  <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    퇴사
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 2단계: 비교 사이클 멀티셀렉트 */}
          {userIdParam && cycleOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
              <StepLabel step={2} label="비교할 연도" done />
              <CycleMultiSelect
                options={cycleOptions}
                selected={
                  selectedCycleIds.length === 0
                    ? cycleOptions.map((o) => o.cycleId)
                    : selectedCycleIds
                }
                onChange={(ids) =>
                  // 전부 선택이면 '전 사이클'(빈 배열)로 정규화.
                  setSelectedCycleIds(
                    ids.length === cycleOptions.length ? [] : ids,
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
      {!userIdParam ? (
        <EmptyState
          title="비교할 임직원을 선택해 주세요"
          description="임직원을 고르면 평가 연도별 등급·점수 추이와 조직 이동 이력을 한눈에 비교할 수 있어요."
          action={
            <div className="flex flex-col items-center gap-2">
              <div
                aria-hidden
                className="flex items-center gap-2 text-muted-foreground"
              >
                <UserSearch size={16} />
                <span style={{ fontSize: 12 }}>위 1단계에서 임직원 선택</span>
              </div>
            </div>
          }
        />
      ) : error ? (
        error.isForbidden ? (
          <Forbidden message="열람 권한이 없는 임직원이에요." />
        ) : (
          <ErrorState onRetry={reload} />
        )
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      ) : timeline.length === 0 ? (
        <EmptyState title="이 임직원의 과거 평가 결과가 아직 없어요." />
      ) : (
        <>
          {/* 요약 통계 카드 */}
          {stats && (
            <section className="gx-panel grid gap-0 overflow-hidden md:grid-cols-4">
              {[
                { label: '평가 연수', value: `${stats.years}개년`, sub: '선택 연도 기준' },
                { label: '최고 등급', value: stats.best, sub: '누적 최고', accent: gradeColor(stats.best).fg },
                { label: '최근 등급', value: stats.latest, sub: `${fmtScore(stats.latestScore)}점`, accent: gradeColor(stats.latest).fg },
                {
                  label: '등급 추세',
                  value: stats.delta > 0 ? '상승' : stats.delta < 0 ? '하락' : '유지',
                  sub: stats.delta !== 0 ? `첫해 대비 ${Math.abs(stats.delta)}단계` : '첫해와 같음',
                  accent: stats.delta > 0 ? '#2563EB' : stats.delta < 0 ? '#E5484D' : undefined,
                },
              ].map((item, index) => (
                <div key={item.label} className="flex min-h-[92px] items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-[12px] font-semibold text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-[22px] font-extrabold tabular-nums text-foreground" style={{ color: item.accent }}>
                      {item.value}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-muted-foreground">{item.sub}</p>
                  </div>
                  {index < 3 && <div className="hidden h-12 w-px bg-border md:block" />}
                </div>
              ))}
            </section>
          )}

          <section className="gx-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">확인할 변화</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                조직 이동, 점수 증감, 역량 포함 여부가 달라진 연도를 먼저 확인하세요.
              </p>
            </div>
            <span className="rounded-lg bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
              {timeline.length}개 연도 비교
            </span>
          </section>

          {/* 등급 추이 차트(2개 미만이면 단일 카드만으로 충분 — 차트는 1점 렌더) */}
          <Card title="등급 추이">
            <p className="text-[12px] text-muted-foreground mb-3">
              세로축은 S~D 등급, 점선 테두리 점은 참고용(미반영) 연도예요. 점에
              올리면 점수·조직을 볼 수 있어요.
            </p>
            <YoyTimelineChart points={points} />
          </Card>

          {/* 연도별 상세 카드 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {timeline.map((t) => (
              <YearDetailCard
                key={t.cycleId}
                year={t.year}
                finalGrade={t.finalGrade}
                finalScore={t.finalScore}
                perfScore={t.perf}
                compScore={t.comp}
                org={t.org}
                orgChanged={orgChangedByCycle.get(t.cycleId)}
                scoreDelta={scoreDeltaByCycle.get(t.cycleId)}
                ruleSummary={{
                  competencyIncluded: t.ruleSummary.competencyIncluded,
                }}
              />
            ))}
          </div>

          {/* 규칙 차이 배너 */}
          {ruleDiff.mixed && (
            <InfoBanner tone="info" title="비교 연도의 규칙이 달라요">
              일부 연도는 역량평가를 포함했지만 점수·등급에는 미반영(참고용)이에요.
              등급은 S~D 공통 축으로 정규화해 표시했어요.
            </InfoBanner>
          )}
        </>
      )}
    </div>
  );
}
