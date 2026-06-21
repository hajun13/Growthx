'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  Target,
  TrendingUp,
} from 'lucide-react';
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
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent, tierLabel } from '@/lib/ui';
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary" aria-hidden />
                  월별실적 기반 그룹 집계
                </span>
              }
              action={
                <span className="text-[12px] text-muted-foreground">
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
                  icon={<CheckCircle2 size={14} aria-hidden />}
                  title="바로 적용 가능"
                  value={`${missingPoolGroups.length}개 그룹`}
                  description="월별 실적은 있으나 등급풀이 아직 생성되지 않았습니다."
                />
                <StatusNote
                  icon={<AlertTriangle size={14} aria-hidden />}
                  title="실적 입력 필요"
                  value={`${missingPerformanceGroups.length}개 그룹`}
                  description="월별 실적을 저장해야 등급풀을 계산할 수 있습니다."
                  tone={missingPerformanceGroups.length > 0 ? 'warning' : 'default'}
                />
                <StatusNote
                  icon={<Clock size={14} aria-hidden />}
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
            </Card>

            <Card
              title={
                <span className="flex items-center gap-2">
                  <ListChecks size={18} className="text-primary" aria-hidden />
                  다음 작업
                </span>
              }
            >
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
                  done={pools.length > 0 && missingPoolGroups.length === 0}
                  text={
                    missingPerformanceGroups.length > 0
                      ? '실적 입력이 끝난 그룹부터 적용할 수 있습니다.'
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
            </Card>
          </div>

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
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busy}
                    disabled={groups.length === 0}
                    onClick={() => void applyPool()}
                  >
                    자동 적용
                  </Button>
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
                <div
                  className={
                    poolCountSum === aggregatePool.headcount
                      ? 'flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground'
                      : 'flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-danger-600'
                  }
                >
                  <span>합계 {poolCountSum}명 / 전사 모수 {aggregatePool.headcount}명</span>
                  <span>
                    {poolCountDelta === 0
                      ? '저장 가능'
                      : `${poolCountDelta > 0 ? '부족' : '초과'} ${Math.abs(poolCountDelta)}명`}
                  </span>
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
                      className="rounded-none border border-border bg-card p-3"
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
                            className="h-8 w-8 rounded-none border border-border text-[16px] font-bold text-foreground disabled:opacity-40"
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
                            className="h-8 w-8 rounded-none border border-border text-[16px] font-bold text-foreground disabled:opacity-40"
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
                            className="h-8 w-20 rounded-none border border-border bg-card px-2 text-right text-[13px] font-bold tabular-nums text-foreground"
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

          <Card
            title="그룹별 적용 상태"
            action={
              <span className="text-[12px] text-muted-foreground">
                월별 실적 저장 → 등급풀 자동 적용 → 상한 검토 순서로 처리합니다.
              </span>
            }
          >
            <div className="overflow-x-auto border border-border">
              <table className="min-w-[760px] w-full border-collapse text-left text-[12.5px]">
                <thead className="bg-muted text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-3 py-2 font-semibold">그룹</th>
                    <th className="border-b border-border px-3 py-2 font-semibold">월별 실적</th>
                    <th className="border-b border-border px-3 py-2 font-semibold">달성률</th>
                    <th className="border-b border-border px-3 py-2 font-semibold">등급풀</th>
                    <th className="border-b border-border px-3 py-2 font-semibold">모수</th>
                    <th className="border-b border-border px-3 py-2 font-semibold">다음 행동</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStatusRows.map(({ group, performance, pool }) => (
                    <tr key={group.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5 font-semibold text-foreground">{group.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {performance ? '저장됨' : '미입력'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">
                        {performance ? fmtPercent(performance.achievementRate) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {pool ? `${tierLabel[pool.tier]} 기준 적용` : '미적용'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {pool ? `${pool.headcount}명` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {!performance
                          ? '월별 실적 입력'
                          : !pool
                            ? '자동 적용 실행'
                            : '상한 검토'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {groupStatusRows.length === 0 && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                등록된 그룹이 없습니다. 조직 관리에서 그룹을 먼저 구성해 주세요.
              </p>
            )}
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] font-bold text-foreground">{value}</dd>
    </div>
  );
}

function StatusNote({
  icon,
  title,
  value,
  description,
  tone = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-danger-300 bg-danger-50 text-danger-700'
      : tone === 'warning'
        ? 'border-warning-300 bg-warning-50 text-warning-800'
        : 'border-border bg-muted text-foreground';
  return (
    <div className={`border px-3 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[12px] font-bold">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-[16px] font-bold tabular-nums">{value}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ActionStep({
  index,
  title,
  text,
  done,
}: {
  index: number;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? 'flex h-6 w-6 shrink-0 items-center justify-center border border-primary bg-primary text-[11px] font-bold text-primary-foreground'
            : 'flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-card text-[11px] font-bold text-muted-foreground'
        }
      >
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}
