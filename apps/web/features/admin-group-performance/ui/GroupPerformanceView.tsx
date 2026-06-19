'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import { useGradePools, gradePoolCommands } from '@/hooks/useGradePools';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { InfoBanner } from '@/components/InfoBanner';
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type { Grade } from '@/lib/types';
import { useGroupPerformanceData } from '../hooks';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
type PoolRow = { grade: Grade; count: number };

export function GroupPerformanceView() {
  const { user } = useAuth();
  const toast = useToast();
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

  const [busy, setBusy] = useState(false);
  const [poolRows, setPoolRows] = useState<PoolRow[]>([]);
  const [poolDirty, setPoolDirty] = useState(false);

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

  async function applyPool() {
    if (!cycleId || groups.length === 0) return;
    setBusy(true);
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
      toast.show({
        variant: failed > 0 ? 'info' : 'success',
        message:
          failed > 0
            ? `전사 등급풀 ${ok}개 그룹 적용, ${failed}개 그룹은 월별 실적이 필요해요.`
            : '전사 등급풀을 적용했어요.',
      });
      reloadPools();
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '풀 적용에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function savePool() {
    if (pools.length === 0 || aggregatePool.headcount === 0) return;
    const sum = poolRows.reduce((total, row) => total + row.count, 0);
    if (sum !== aggregatePool.headcount) {
      toast.show({
        variant: 'danger',
        message: `등급풀 합계가 전사 모수와 같아야 해요. (현재 ${sum}명 / ${aggregatePool.headcount}명)`,
      });
      return;
    }

    const ratios = {} as Record<Grade, number>;
    let assignedRatio = 0;
    GRADES.forEach((grade, index) => {
      const count = poolRows.find((row) => row.grade === grade)?.count ?? 0;
      if (index === GRADES.length - 1) {
        ratios[grade] = Math.round((100 - assignedRatio) * 100) / 100;
      } else {
        const ratio = Math.round((count / aggregatePool.headcount) * 10000) / 100;
        ratios[grade] = ratio;
        assignedRatio += ratio;
      }
    });

    setBusy(true);
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
      toast.show({ variant: 'success', message: '전사 등급풀 설정을 저장했어요.' });
      setPoolDirty(false);
      reloadPools();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '등급풀 저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
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
        subtitle="그룹 월별 실적을 확인하고 전사 등급풀 상한을 바로 적용합니다."
        right={
          <HeaderMetrics
            items={[
              { label: '그룹', value: `${groups.length}개` },
              { label: '실적 저장', value: `${performanceSummary.count}개` },
              { label: '전사 모수', value: `${aggregatePool.headcount}명`, accent: 'text-primary' },
            ]}
          />
        }
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <>
          <section className="gx-panel grid gap-0 overflow-hidden md:grid-cols-[1fr_auto]">
            <div className="border-b border-border/80 px-5 py-4 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                <TrendingUp size={16} className="text-primary" aria-hidden />
                운영 컨텍스트
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Item label="전체 그룹" value={`${groups.length}개`} />
                <Item label="실적 저장 그룹" value={`${performanceSummary.count}개`} />
                <Item label="전사 풀 모수" value={`${aggregatePool.headcount}명`} />
                <Item
                  label="평균 달성률"
                  value={performanceSummary.avgRate === null ? '—' : fmtPercent(performanceSummary.avgRate)}
                />
              </dl>
            </div>
            <div className="flex min-w-[260px] flex-col justify-center gap-3 px-5 py-4">
              <p className="text-[12px] font-semibold text-foreground">즉시 처리</p>
              <p className="text-[12px] leading-5 text-muted-foreground">
                실적 저장 후 자동 적용을 실행하면 그룹별 RuleSet 기준으로 등급풀 상한이 계산됩니다.
              </p>
              {editable && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={busy}
                  disabled={groups.length === 0}
                  onClick={() => void applyPool()}
                >
                  자동 적용
                </Button>
              )}
            </div>
          </section>

          {performances.length === 0 && (
            <InfoBanner tone="warning" title="월별 실적이 필요해요">
              월별 실적 화면에서 그룹의 매출 목표와 실적을 저장한 뒤 등급풀을 적용해 주세요.
            </InfoBanner>
          )}

          <Card
            title={
              <span className="flex items-center gap-2">
                <Target size={18} className="text-primary" aria-hidden />
                전사 등급풀 설정
              </span>
            }
            action={
              editable ? (
                <div className="flex items-center gap-2">
                  {pools.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy}
                      disabled={!poolDirty || poolCountSum !== aggregatePool.headcount}
                      onClick={() => void savePool()}
                    >
                      저장
                    </Button>
                  )}
                </div>
              ) : null
            }
          >
            <p className="text-[12px] text-muted-foreground mb-3">
              전체 평가 대상자 기준으로 S/A/B/C/D 상한 인원을 직접 조정합니다. 합계는 전사 모수와 같아야 저장됩니다.
            </p>

            {perfLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : pools.length > 0 && poolRows.length > 0 ? (
              <div className="space-y-3">
                <div className={poolCountSum === aggregatePool.headcount ? 'text-[12px] text-muted-foreground' : 'text-[12px] font-semibold text-danger-600'}>
                  합계 {poolCountSum}명 / 전사 모수 {aggregatePool.headcount}명
                </div>
                {poolRows.map((row) => {
                  const gc = gradeColor(row.grade);
                  const pct =
                    aggregatePool.headcount > 0
                      ? Math.round((row.count / aggregatePool.headcount) * 1000) / 10
                      : 0;
                  return (
                    <div
                      key={row.grade}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <GradeChip grade={row.grade} />
                        <div className="min-w-[110px] text-[12px] text-muted-foreground">
                          상한 {row.count}명 · {pct}%
                        </div>
                        <div className="flex flex-1 items-center gap-2 min-w-[220px]">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => adjustPoolCount(row.grade, -1)}
                            className="h-8 w-8 rounded-md border border-border text-[16px] font-bold text-foreground disabled:opacity-40"
                            aria-label={`${row.grade}등급 1명 감소`}
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={aggregatePool.headcount}
                            value={row.count}
                            disabled={!editable}
                            onChange={(event) => setPoolCount(row.grade, Number(event.target.value))}
                            className="min-w-0 flex-1"
                            style={{ accentColor: gc.fg }}
                            aria-label={`${row.grade}등급 상한 인원`}
                          />
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => adjustPoolCount(row.grade, 1)}
                            className="h-8 w-8 rounded-md border border-border text-[16px] font-bold text-foreground disabled:opacity-40"
                            aria-label={`${row.grade}등급 1명 증가`}
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={aggregatePool.headcount}
                            value={row.count}
                            disabled={!editable}
                            onChange={(event) => setPoolCount(row.grade, Number(event.target.value))}
                            className="h-8 w-20 rounded-md border border-border bg-card px-2 text-right text-[13px] font-bold tabular-nums text-foreground"
                            aria-label={`${row.grade}등급 상한 인원 숫자 입력`}
                          />
                          <span className="text-[12px] text-muted-foreground">명</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="전사 등급풀이 아직 적용되지 않았어요."
                description="월별 실적을 저장한 뒤 자동 적용을 실행해 주세요."
              />
            )}
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] font-bold text-foreground">{value}</dd>
    </div>
  );
}
