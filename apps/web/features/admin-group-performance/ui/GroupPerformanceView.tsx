'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AlertCircle, Lock, Unlock, BarChart3, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import { useGradePools, gradePoolCommands } from '@/hooks/useGradePools';
import { useGradeDistribution } from '@/hooks/useEvaluations';
import { useToast } from '@/components/Toast';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type { Grade, GradePool } from '@/lib/types';
import { useGroupPerformanceData } from '../hooks';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 인터랙티브 등급풀 행 상태
type PoolRow = { grade: Grade; pct: number; count: number; locked: boolean };

export function GroupPerformanceView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const { hasFeature } = usePermissions();
  const cycleId = current?.id;

  const allowed =
    !!user && (user.role === 'hr_admin' || user.role === 'division_head');
  const editable =
    !!user && isHrAdmin(user.role) && hasFeature('등급풀 수정');

  const { data: deptData } = useDepartments(
    { type: 'group' },
    { enabled: allowed },
  );
  const groups = deptData?.data ?? [];
  const [groupId, setGroupId] = useState<string>('');
  const activeGroupId = groupId || groups[0]?.id || '';

  const {
    perf,
    loading: perfLoading,
    error,
    reload,
    upsert,
  } = useGroupPerformanceData(
    { cycleId, groupId: activeGroupId },
    !!cycleId && allowed && !!activeGroupId,
  );

  const { data: poolData, reload: reloadPools } = useGradePools(
    { cycleId, groupId: activeGroupId },
    { enabled: !!cycleId && allowed && !!activeGroupId },
  );
  const pool: GradePool | null = poolData?.data[0] ?? null;

  const { data: distData } = useGradeDistribution(
    { cycleId, groupId: activeGroupId },
    { enabled: !!cycleId && allowed && !!activeGroupId },
  );
  const distRows = distData?.data ?? [];

  const [revenue, setRevenue] = useState('');
  const [orders, setOrders] = useState('');
  const [profit, setProfit] = useState('');
  const [achievementRate, setAchievementRate] = useState('');
  const [busy, setBusy] = useState(false);

  const [poolRows, setPoolRows] = useState<PoolRow[]>([]);
  const [poolDirty, setPoolDirty] = useState(false);

  useEffect(() => {
    if (!pool) {
      setPoolRows([]);
      setPoolDirty(false);
      return;
    }
    const ratios: Record<Grade, number> = {
      S: pool.sRatio,
      A: pool.aRatio,
      B: pool.bRatio,
      C: pool.cRatio,
      D: pool.dRatio,
    };
    setPoolRows(
      GRADES.map((g) => ({
        grade: g,
        pct: Math.round(ratios[g] ?? 0),
        count: pool.caps?.[g] ?? 0,
        locked: false,
      })),
    );
    setPoolDirty(false);
  }, [pool]);

  const poolSum = poolRows.reduce((s, r) => s + r.pct, 0);
  const headcount = pool?.headcount ?? 0;

  function adjust(grade: Grade, delta: number) {
    setPoolRows((prev) =>
      prev.map((r) =>
        r.grade === grade && !r.locked
          ? { ...r, pct: Math.max(0, Math.min(100, r.pct + delta)) }
          : r,
      ),
    );
    setPoolDirty(true);
  }

  function toggleLock(grade: Grade) {
    setPoolRows((prev) =>
      prev.map((r) =>
        r.grade === grade ? { ...r, locked: !r.locked } : r,
      ),
    );
  }

  async function savePerformance() {
    if (!cycleId || !activeGroupId) return;
    setBusy(true);
    try {
      await upsert({
        groupId: activeGroupId,
        cycleId,
        revenue: revenue === '' ? undefined : Number(revenue),
        orders: orders === '' ? undefined : Number(orders),
        profit: profit === '' ? undefined : Number(profit),
        achievementRate: Number(achievementRate) || 0,
      });
      toast.show({ variant: 'success', message: '그룹 실적을 저장했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function savePool() {
    if (!pool) return;
    if (poolSum !== 100) {
      toast.show({
        variant: 'danger',
        message: '등급풀 합계가 100%가 되어야 저장할 수 있어요.',
      });
      return;
    }
    setBusy(true);
    try {
      const byGrade = Object.fromEntries(
        poolRows.map((r) => [r.grade, r.pct]),
      ) as Record<Grade, number>;
      await gradePoolCommands.update(pool.id, {
        sRatio: byGrade.S,
        aRatio: byGrade.A,
        bRatio: byGrade.B,
        cRatio: byGrade.C,
        dRatio: byGrade.D,
      });
      toast.show({ variant: 'success', message: '등급풀을 저장했어요.' });
      reloadPools();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function applyPool() {
    if (!cycleId || !activeGroupId) return;
    setBusy(true);
    try {
      await gradePoolCommands.compute({ cycleId, groupId: activeGroupId });
      toast.show({ variant: 'success', message: '등급 풀을 적용했어요.' });
      reloadPools();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? '그룹 실적을 먼저 입력해 주세요.'
          : err instanceof ApiError
            ? err.message
            : '풀 적용에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  useSetPrimaryAction(
    editable
      ? {
          label: pool ? '등급 풀 재적용' : '등급 풀 적용',
          onClick: () => void applyPool(),
          disabled: !perf,
          loading: busy,
        }
      : null,
    [editable, perf, pool, busy, activeGroupId],
  );

  const pieData = poolRows
    .map((r) => ({ name: r.grade, value: r.pct }))
    .filter((d) => d.value > 0);

  if (!allowed) {
    return (
      <Forbidden message="그룹 실적·등급 풀은 HR·본부장만 볼 수 있어요." />
    );
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="그룹실적 / 등급풀"
        subtitle="그룹 등급 분포 기준을 설정하고 부서별 실적을 관리합니다."
        right={
          groups.length > 0 ? (
            <Select value={activeGroupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-44 text-sm">
                <SelectValue placeholder="그룹 선택" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <>
          {/* 섹션 1: 그룹 실적 */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" aria-hidden />
                그룹 실적
              </span>
            }
            action={
              perf ? (
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  현재 tier <StatusBadge status={perf.tier} /> · 달성률{' '}
                  {fmtPercent(perf.achievementRate)}
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground">
                  아직 그룹 실적이 입력되지 않았어요.
                </span>
              )
            }
          >
            {!editable ? (
              perf ? (
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Item label="매출액" value={perf.revenue === null ? '—' : `${perf.revenue}억`} />
                  <Item label="수주" value={perf.orders === null ? '—' : `${perf.orders}억`} />
                  <Item label="이익률" value={perf.profit === null ? '—' : `${perf.profit}%`} />
                  <Item label="달성률" value={fmtPercent(perf.achievementRate)} />
                </dl>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  아직 그룹 실적이 입력되지 않았어요.
                </p>
              )
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <TextField label="매출액" type="number" value={revenue} onChange={setRevenue} suffix="억" />
                  <TextField label="수주" type="number" value={orders} onChange={setOrders} suffix="억" />
                  <TextField label="이익률" type="number" value={profit} onChange={setProfit} suffix="%" />
                  <TextField label="달성률" type="number" value={achievementRate} onChange={setAchievementRate} suffix="%" />
                </div>
                <div className="flex items-center justify-end">
                  <Button variant="secondary" loading={busy} onClick={() => void savePerformance()}>
                    실적 저장
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 섹션 2·3: 등급풀 편집 + 파이 */}
          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Target size={18} className="text-primary" aria-hidden />
                  등급풀 설정
                </span>
              }
              action={
                editable && pool ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    disabled={!poolDirty || poolSum !== 100}
                    onClick={() => void savePool()}
                  >
                    저장
                  </Button>
                ) : null
              }
            >
              {!pool && (
                <p className="text-[12px] text-muted-foreground mb-3">
                  {pool
                    ? `각 등급의 비율을 설정합니다. 합계: ${poolSum}%`
                    : '등급 풀을 적용하면 비율을 조정할 수 있어요.'}
                </p>
              )}

              {perfLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : pool && poolRows.length > 0 ? (
                <>
                  {poolSum !== 100 && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5">
                      <AlertCircle size={14} className="text-warning-600 shrink-0" aria-hidden />
                      <span className="text-[12px] text-warning-700">
                        등급풀 합계가 100%가 되어야 합니다. (현재 {poolSum}%)
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {poolRows.map((r) => {
                      const gc = gradeColor(r.grade);
                      return (
                        <div
                          key={r.grade}
                          className="rounded-xl border border-border p-4 transition-colors"
                          style={{ background: r.locked ? '#f7f7f9' : '#fff' }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <GradeChip grade={r.grade} />
                            <span className="text-[12px] text-muted-foreground">
                              현재 {r.count}명
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => toggleLock(r.grade)}
                                aria-label={r.locked ? '잠금 해제' : '잠금'}
                                className="ml-auto h-7 w-7 p-0 flex items-center justify-center rounded text-muted-foreground hover:bg-accent transition-colors"
                              >
                                {r.locked ? (
                                  <Lock size={13} aria-hidden />
                                ) : (
                                  <Unlock size={13} aria-hidden />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => adjust(r.grade, -5)}
                              disabled={!editable || r.locked}
                              aria-label={`${r.grade}등급 5% 감소`}
                              className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-base text-foreground disabled:opacity-40 transition-colors hover:bg-accent"
                            >
                              −
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className="tabular-nums text-[22px] font-extrabold leading-none"
                                  style={{ color: gc.fg }}
                                >
                                  {r.pct}%
                                </span>
                                <span className="text-[12px] text-muted-foreground">
                                  {Math.round((headcount * r.pct) / 100)}명 예상
                                </span>
                              </div>
                              <div className="w-full rounded-full overflow-hidden bg-muted" style={{ height: 8 }}>
                                <div
                                  className="h-full transition-all"
                                  style={{ width: `${r.pct}%`, background: gc.fg }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => adjust(r.grade, 5)}
                              disabled={!editable || r.locked}
                              aria-label={`${r.grade}등급 5% 증가`}
                              className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-base text-foreground disabled:opacity-40 transition-colors hover:bg-accent"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  title={
                    perf
                      ? '등급 풀이 아직 적용되지 않았어요.'
                      : '그룹 실적을 먼저 입력해 주세요.'
                  }
                />
              )}
            </Card>

            {/* 분포 비율 파이 */}
            <Card
              title={
                <span className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-primary" aria-hidden />
                  등급 분포 비율
                </span>
              }
            >
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={44}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={gradeColor(entry.name as Grade).fg} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [`${v}%`, '비율']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-5 gap-1.5 mt-2">
                    {poolRows.map((r) => {
                      const gc = gradeColor(r.grade);
                      return (
                        <div key={r.grade} className="text-center">
                          <div className="w-3 h-3 mx-auto mb-0.5 rounded-sm" style={{ background: gc.fg }} />
                          <div className="text-[11px] font-bold" style={{ color: gc.fg }}>{r.grade}</div>
                          <div className="tabular-nums text-[11px] text-muted-foreground">{r.pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 mt-3">
                  <AlertCircle size={14} className="text-warning-600 shrink-0" aria-hidden />
                  <span className="text-[12px] text-muted-foreground">
                    등급 풀을 적용하면 분포가 표시돼요.
                  </span>
                </div>
              )}
            </Card>
          </div>

          {/* 섹션 4: 부서별 등급 현황 */}
          <DeptGradeTable rows={distRows} />
        </>
      )}
    </PageContainer>
  );
}

const COLS = '1fr 60px 60px 60px 60px 60px 80px';

function DeptGradeTable({ rows }: { rows: import('@/lib/types').GradeDistributionRow[] }) {
  const [activeDept, setActiveDept] = useState('전체');
  const tabs = ['전체', ...rows.map((r) => r.deptName)];
  const visible =
    activeDept === '전체'
      ? rows
      : rows.filter((r) => r.deptName === activeDept);

  return (
    <Card
      title="부서별 등급 현황"
      action={
        rows.length > 0 ? (
          <div className="flex gap-1 flex-wrap justify-end">
            {tabs.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDept(d)}
                className={[
                  'rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  activeDept === d
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>
        ) : null
      }
      padding="sm"
    >
      {rows.length === 0 ? (
        <EmptyState title="아직 확정된 등급 현황이 없어요." />
      ) : (
        <>
          <div
            className="sticky top-0 z-10 grid px-4 py-2.5 bg-muted border-b border-border"
            style={{ gridTemplateColumns: COLS }}
          >
            {['부서', 'S', 'A', 'B', 'C', 'D', '전체'].map((h) => (
              <div
                key={h}
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ textAlign: h === '부서' ? 'left' : 'center' }}
              >
                {h}
              </div>
            ))}
          </div>
          {visible.map((d) => (
            <div
              key={d.deptId}
              className="grid items-center px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-b-0"
              style={{ gridTemplateColumns: COLS }}
            >
              <div className="text-[13px] font-semibold text-foreground">{d.deptName}</div>
              {GRADES.map((g) => {
                const gc = gradeColor(g);
                return (
                  <div key={g} className="text-center">
                    <span
                      className="tabular-nums inline-block min-w-[28px] px-1.5 py-0.5 text-[11px] font-bold rounded-full"
                      style={{ background: gc.bg, color: gc.fg }}
                    >
                      {d[g]}
                    </span>
                  </div>
                );
              })}
              <div className="text-center tabular-nums text-[12px] font-semibold text-foreground">
                {d.total}명
              </div>
            </div>
          ))}
        </>
      )}
    </Card>
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
