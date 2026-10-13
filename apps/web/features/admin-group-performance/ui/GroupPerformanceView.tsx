'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import { useGradePools, gradePoolCommands } from '@/hooks/useGradePools';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import { useGroupPerformanceData } from '../hooks';
import { EmptyState, ErrorState, Forbidden } from './StateBlocks';
import { ActionStep, Item, SectionCard, StatusNote } from './GroupParts';
import { PoolRowsEditor, type PoolRow } from './PoolRowsEditor';
import { GroupStatusTable } from './GroupStatusTable';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function GroupPerformanceView() {
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const { hasFeature } = usePermissions();
  const cycleId = current?.id;

  const allowed = !!user && user.role === 'hr_admin';
  const editable =
    !!user && isHrAdmin(user.role) && hasFeature('등급풀 수정');

  const { data: deptData } = useDepartments(
    { type: 'group' },
    { enabled: allowed },
  );
  const groups = deptData?.data ?? [];

  const {
    items: performances,
    loading: perfLoading,
    error,
    reload,
  } = useGroupPerformanceData(
    { cycleId },
    !!cycleId && allowed,
  );

  const { data: poolData, reload: reloadPools } = useGradePools(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );
  const pools = useMemo(() => poolData?.data ?? [], [poolData?.data]);

  // busy 를 액션별로 분리 — 저장/자동 적용 버튼이 서로의 로딩 스피너를 공유하지 않게.
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [poolRows, setPoolRows] = useState<PoolRow[]>([]);
  const [poolDirty, setPoolDirty] = useState(false);
  // 자동 적용 확인 모달 — 미저장 조정(poolDirty)이 있을 때 무확인 파기 방지.
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  const aggregatePool = useMemo(() => {
    const rawCaps: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    const headcount = pools.reduce((sum, pool) => {
      rawCaps.S += ((pool.sRatio ?? 0) / 100) * (pool.headcount ?? 0);
      rawCaps.A += ((pool.aRatio ?? 0) / 100) * (pool.headcount ?? 0);
      rawCaps.B += ((pool.bRatio ?? 0) / 100) * (pool.headcount ?? 0);
      rawCaps.C += ((pool.cRatio ?? 0) / 100) * (pool.headcount ?? 0);
      rawCaps.D += ((pool.dRatio ?? 0) / 100) * (pool.headcount ?? 0);
      return sum + (pool.headcount ?? 0);
    }, 0);
    const floors = GRADES.map((grade) => ({
      grade,
      count: Math.floor(rawCaps[grade]),
      remainder: rawCaps[grade] - Math.floor(rawCaps[grade]),
    }));
    let remaining = headcount - floors.reduce((sum, row) => sum + row.count, 0);
    const byRemainder = [...floors].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < byRemainder.length && remaining > 0; i += 1) {
      byRemainder[i].count += 1;
      remaining -= 1;
    }
    const rows = GRADES.map((grade) => ({
      grade,
      count: floors.find((row) => row.grade === grade)?.count ?? 0,
    }));
    return { headcount, rows };
  }, [pools]);

  useEffect(() => {
    setPoolRows(aggregatePool.rows);
    setPoolDirty(false);
  }, [aggregatePool]);

  const performanceSummary = useMemo(() => {
    const count = performances.length;
    const avgRate =
      count > 0
        ? performances.reduce((sum, perf) => sum + perf.achievementRate, 0) / count
        : null;
    return { count, avgRate };
  }, [performances]);

  const performanceByGroupId = useMemo(
    () => new Map(performances.map((perf) => [perf.groupId, perf])),
    [performances],
  );
  const poolByGroupId = useMemo(
    () => new Map(pools.map((pool) => [pool.groupId, pool])),
    [pools],
  );
  const missingPerformanceGroups = useMemo(
    () => groups.filter((group) => !performanceByGroupId.has(group.id)),
    [groups, performanceByGroupId],
  );
  const missingPoolGroups = useMemo(
    () => groups.filter((group) => performanceByGroupId.has(group.id) && !poolByGroupId.has(group.id)),
    [groups, performanceByGroupId, poolByGroupId],
  );
  const stalePoolGroups = useMemo(
    () =>
      groups.filter((group) => {
        const performance = performanceByGroupId.get(group.id);
        const pool = poolByGroupId.get(group.id);
        return !!performance && !!pool && performance.tier !== pool.tier;
      }),
    [groups, performanceByGroupId, poolByGroupId],
  );
  const groupStatusRows = useMemo(
    () =>
      groups
        .map((group) => ({
          group,
          performance: performanceByGroupId.get(group.id) ?? null,
          pool: poolByGroupId.get(group.id) ?? null,
        }))
        .sort((a, b) => {
          const aReady = a.performance ? 0 : 1;
          const bReady = b.performance ? 0 : 1;
          if (aReady !== bReady) return aReady - bReady;
          return a.group.name.localeCompare(b.group.name, 'ko');
        }),
    [groups, performanceByGroupId, poolByGroupId],
  );
  const latestPerformanceDate = useMemo(() => {
    const latest = performances
      .map((perf) => perf.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    return latest ? latest.slice(0, 10).replace(/-/g, '.') : '—';
  }, [performances]);

  async function applyPool() {
    if (!cycleId || groups.length === 0) return;
    setBusy('apply');
    let ok = 0;
    let failed = 0;
    try {
      for (const group of groups) {
        try {
          await gradePoolCommands.compute({ cycleId, groupId: group.id });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        toast(`전사 등급풀 ${ok}개 그룹 적용, ${failed}개 그룹은 월별 실적이 필요해요.`);
      } else {
        toast.success('전사 등급풀을 적용했어요.');
      }
      reloadPools();
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '풀 적용에 실패했어요.', { duration: 8000 });
    } finally {
      setBusy(null);
    }
  }

  /** 자동 적용 진입점 — 미저장 조정이 있으면 확인 모달을 경유한다. */
  function requestApplyPool() {
    if (poolDirty) setConfirmApplyOpen(true);
    else void applyPool();
  }

  async function savePool() {
    if (pools.length === 0 || aggregatePool.headcount === 0) return;
    const sum = poolRows.reduce((total, row) => total + row.count, 0);
    if (sum !== aggregatePool.headcount) {
      toast.error(`등급풀 합계가 전사 모수와 같아야 해요. (현재 ${sum}명 / ${aggregatePool.headcount}명)`, {
        duration: 8000,
      });
      return;
    }

    const ratios = {} as Record<Grade, number>;
    let assignedRatio = 0;
    GRADES.forEach((grade, index) => {
      const count = poolRows.find((row) => row.grade === grade)?.count ?? 0;
      if (index === GRADES.length - 1) {
        // 반올림 누적으로 100 을 초과해 마지막 등급이 음수가 되는 것을 방지(0 으로 클램프).
        ratios[grade] = Math.max(0, Math.round((100 - assignedRatio) * 100) / 100);
      } else {
        const ratio = Math.round((count / aggregatePool.headcount) * 10000) / 100;
        ratios[grade] = ratio;
        assignedRatio += ratio;
      }
    });

    setBusy('save');
    try {
      await Promise.all(
        pools.map((pool) =>
          gradePoolCommands.update(pool.id, {
            sRatio: ratios.S,
            aRatio: ratios.A,
            bRatio: ratios.B,
            cRatio: ratios.C,
            dRatio: ratios.D,
          }),
        ),
      );
      toast.success('전사 등급풀 설정을 저장했어요.');
      setPoolDirty(false);
      reloadPools();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '등급풀 저장에 실패했어요.', { duration: 8000 });
    } finally {
      setBusy(null);
    }
  }

  function setPoolCount(grade: Grade, value: number) {
    const nextValue = Number.isFinite(value) ? value : 0;
    setPoolRows((prev) =>
      prev.map((row) =>
        row.grade === grade
          ? { ...row, count: Math.max(0, Math.min(aggregatePool.headcount, Math.round(nextValue))) }
          : row,
      ),
    );
    setPoolDirty(true);
  }

  function adjustPoolCount(grade: Grade, delta: number) {
    const current = poolRows.find((row) => row.grade === grade)?.count ?? 0;
    setPoolCount(grade, current + delta);
  }

  const poolCountSum = poolRows.reduce((total, row) => total + row.count, 0);
  const poolCountDelta = aggregatePool.headcount - poolCountSum;

  if (!allowed) {
    return (
      <Forbidden message="등급풀 관리는 전체관리자만 볼 수 있어요." />
    );
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="등급풀 관리"
        subtitle="전사 평가 대상자를 하나의 모수로 묶어 S/A/B/C/D 상한을 확인합니다."
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <>
          <div className="gx-workbench-grid items-stretch">
            <SectionCard
              className="h-full"
              title="월별실적 기반 그룹 집계"
              action={
                <span className="text-12 text-muted-foreground">
                  최근 집계 {latestPerformanceDate}
                </span>
              }
            >
              <dl className="grid grid-cols-2 gap-px border border-border bg-border text-sm md:grid-cols-4">
                <Item label="전체 그룹" value={`${groups.length}개`} />
                <Item label="실적 저장" value={`${performanceSummary.count}개`} />
                <Item label="등급풀 적용" value={`${pools.length}개`} />
                <Item
                  label="평균 달성률"
                  value={performanceSummary.avgRate === null ? '—' : fmtPercent(performanceSummary.avgRate)}
                />
              </dl>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatusNote
                  title="바로 적용 가능"
                  value={`${missingPoolGroups.length + stalePoolGroups.length}개 그룹`}
                  description="월별 실적이 신규 입력되었거나 기존 등급풀과 달라졌습니다."
                />
                <StatusNote
                  title="실적 입력 필요"
                  value={`${missingPerformanceGroups.length}개 그룹`}
                  description="월별 실적을 저장해야 등급풀을 계산할 수 있습니다."
                  tone={missingPerformanceGroups.length > 0 ? 'warning' : 'default'}
                />
                <StatusNote
                  title="저장 전 상태"
                  value={poolDirty ? '수정됨' : '변경 없음'}
                  description={
                    poolDirty
                      ? poolCountDelta === 0
                        ? '저장하면 모든 그룹의 비율이 같은 기준으로 갱신됩니다.'
                        : `전사 모수와 ${Math.abs(poolCountDelta)}명 차이가 있습니다.`
                      : '자동 적용 후 필요한 경우 상한 인원을 조정하세요.'
                  }
                  tone={poolDirty && poolCountDelta !== 0 ? 'danger' : 'default'}
                />
              </div>
            </SectionCard>

            <SectionCard className="h-full" title="다음 작업">
              <ol className="space-y-3">
                <ActionStep
                  index={1}
                  title="월별 실적 저장"
                  done={missingPerformanceGroups.length === 0 && groups.length > 0}
                  text={
                    missingPerformanceGroups.length === 0
                      ? '모든 그룹의 실적 집계가 준비됐습니다.'
                      : `${missingPerformanceGroups.length}개 그룹의 월별 실적이 필요합니다.`
                  }
                />
                <ActionStep
                  index={2}
                  title="자동 적용"
                  done={pools.length > 0 && missingPoolGroups.length === 0 && stalePoolGroups.length === 0}
                  text={
                    missingPerformanceGroups.length > 0
                      ? '실적 입력이 끝난 그룹부터 적용할 수 있습니다.'
                      : stalePoolGroups.length > 0
                      ? `${stalePoolGroups.length}개 그룹은 최신 월별 실적 기준으로 재적용이 필요합니다.`
                      : missingPoolGroups.length === 0 && pools.length > 0
                      ? '실적 기준 등급풀이 생성되어 있습니다.'
                      : `${missingPoolGroups.length || groups.length}개 그룹에 적용이 필요합니다.`
                  }
                />
                <ActionStep
                  index={3}
                  title="합계 확인 후 저장"
                  done={!poolDirty || poolCountDelta === 0}
                  text={
                    poolDirty
                      ? poolCountDelta === 0
                        ? '저장 가능한 상태입니다.'
                        : `전사 모수와 ${Math.abs(poolCountDelta)}명 차이가 납니다.`
                      : '상한을 조정하면 저장 버튼이 활성화됩니다.'
                  }
                />
              </ol>
            </SectionCard>
          </div>

          <SectionCard
            title="전사 등급풀 설정"
            action={
              editable ? (
                <div className="flex items-center gap-2">
                  {pools.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busy === 'save'}
                      disabled={busy !== null || !poolDirty || poolCountSum !== aggregatePool.headcount}
                      onClick={() => void savePool()}
                    >
                      저장
                    </Button>
                  )}
                  <Button
                    size="sm"
                    loading={busy === 'apply'}
                    disabled={busy !== null || groups.length === 0}
                    onClick={requestApplyPool}
                  >
                    자동 적용
                  </Button>
                </div>
              ) : null
            }
          >
            <p className="mb-3 text-12 text-muted-foreground">
              전체 평가 대상자 기준으로 S/A/B/C/D 상한 인원을 직접 조정합니다. 합계는 전사 모수와 같아야 저장됩니다.
            </p>

            {perfLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : pools.length > 0 && poolRows.length > 0 ? (
              <PoolRowsEditor
                rows={poolRows}
                headcount={aggregatePool.headcount}
                countSum={poolCountSum}
                countDelta={poolCountDelta}
                editable={editable}
                onSet={setPoolCount}
                onAdjust={adjustPoolCount}
              />
            ) : (
              <EmptyState
                title="전사 등급풀이 아직 적용되지 않았어요."
                description="월별 실적을 저장한 뒤 자동 적용을 실행해 주세요."
              />
            )}
          </SectionCard>

          <SectionCard
            title="그룹별 적용 상태"
            action={
              <span className="text-12 text-muted-foreground">
                월별 실적 저장 → 등급풀 자동 적용 → 상한 검토 순서로 처리합니다.
              </span>
            }
          >
            <GroupStatusTable rows={groupStatusRows} />
            {groupStatusRows.length === 0 && (
              <p className="mt-3 text-13 text-muted-foreground">
                등록된 그룹이 없습니다. 조직 관리에서 그룹을 먼저 구성해 주세요.
              </p>
            )}
          </SectionCard>
        </>
      )}

      {/* 자동 적용 확인 — 미저장 조정이 월별 실적 기준값으로 초기화되는 것을 고지 */}
      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 조정이 있어요</AlertDialogTitle>
            <AlertDialogDescription>
              자동 적용을 실행하면 저장하지 않은 상한 인원 조정이 월별 실적 기준값으로 초기화돼요. 계속할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void applyPool()}>
              자동 적용
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
