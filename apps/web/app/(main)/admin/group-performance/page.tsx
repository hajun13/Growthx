'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import {
  useGroupPerformance,
  groupPerformanceCommands,
} from '@/hooks/useGroupPerformance';
import { useGradePools, gradePoolCommands } from '@/hooks/useGradePools';
import { useToast } from '@/components/Toast';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Select } from '@/components/Select';
import { StatusBadge } from '@/components/StatusBadge';
import { DistributionBarChart } from '@/components/DistributionBarChart';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent } from '@/lib/ui';
import type { Grade, GradePool } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export default function GroupPerformancePage() {
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

  const allowed =
    !!user && (user.role === 'hr_admin' || user.role === 'division_head');
  const editable = !!user && isHrAdmin(user.role);

  const { data: deptData } = useDepartments(
    { type: 'group' },
    { enabled: allowed },
  );
  const groups = deptData?.data ?? [];
  const [groupId, setGroupId] = useState<string>('');
  const activeGroupId = groupId || groups[0]?.id || '';

  const {
    data: perfData,
    loading: perfLoading,
    error,
    reload,
  } = useGroupPerformance(
    { cycleId, groupId: activeGroupId },
    { enabled: !!cycleId && allowed && !!activeGroupId },
  );
  const perf = perfData?.data[0] ?? null;

  const { data: poolData, reload: reloadPools } = useGradePools(
    { cycleId, groupId: activeGroupId },
    { enabled: !!cycleId && allowed && !!activeGroupId },
  );
  const pool: GradePool | null = poolData?.data[0] ?? null;

  const [revenue, setRevenue] = useState('');
  const [orders, setOrders] = useState('');
  const [profit, setProfit] = useState('');
  const [achievementRate, setAchievementRate] = useState('');
  const [busy, setBusy] = useState(false);

  async function savePerformance() {
    if (!cycleId || !activeGroupId) return;
    setBusy(true);
    try {
      await groupPerformanceCommands.upsert({
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
        message:
          err instanceof ApiError ? err.message : '저장에 실패했어요.',
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
          label: '등급 풀 적용',
          onClick: () => void applyPool(),
          disabled: !perf,
          loading: busy,
        }
      : null,
    [editable, perf, busy, activeGroupId],
  );

  // BE가 산정한 등급별 절대 인원 상한·그룹 정원을 그대로 사용.
  const caps = pool?.caps;
  const headcount = pool?.headcount ?? 0;

  if (!allowed) {
    return <Forbidden message="그룹 실적·등급 풀은 HR·본부장만 볼 수 있어요." />;
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="그룹 실적·등급 풀"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          groups.length > 0 && (
            <Select
              label="그룹"
              hideLabel
              value={activeGroupId}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              onChange={setGroupId}
            />
          )
        }
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <>
          <Card title="그룹 실적 입력">
            {!editable ? (
              perf ? (
                <PerfReadOnly
                  revenue={perf.revenue}
                  orders={perf.orders}
                  profit={perf.profit}
                  achievementRate={perf.achievementRate}
                  tier={perf.tier}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  아직 그룹 실적이 입력되지 않았어요.
                </p>
              )
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <TextField
                    label="매출액"
                    type="number"
                    value={revenue}
                    onChange={setRevenue}
                    suffix="억"
                  />
                  <TextField
                    label="수주"
                    type="number"
                    value={orders}
                    onChange={setOrders}
                    suffix="억"
                  />
                  <TextField
                    label="이익률"
                    type="number"
                    value={profit}
                    onChange={setProfit}
                    suffix="%"
                  />
                  <TextField
                    label="달성률"
                    type="number"
                    value={achievementRate}
                    onChange={setAchievementRate}
                    suffix="%"
                  />
                </div>
                <div className="flex items-center justify-between">
                  {perf && (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      현재 tier <StatusBadge status={perf.tier} />· 달성률{' '}
                      {fmtPercent(perf.achievementRate)}
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() => void savePerformance()}
                  >
                    실적 저장
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title={`적용 등급 풀 분포 (정원 ${headcount}명 기준 상한)`}>
            {pool && caps ? (
              <DistributionBarChart
                counts={{ S: 0, A: 0, B: 0, C: 0, D: 0 }}
                caps={caps}
                tier={pool.tier}
                total={headcount}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {perf
                  ? '등급 풀을 적용하면 부서장 평가에 상한이 반영돼요.'
                  : '그룹 실적을 먼저 입력해 주세요.'}
              </p>
            )}
            {pool && caps && (
              <p className="mt-3 text-xs text-muted-foreground">
                {GRADES.map((g) => `${g} ${caps[g]}명`).join(' · ')} / 정원{' '}
                {headcount}명
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function PerfReadOnly({
  revenue,
  orders,
  profit,
  achievementRate,
  tier,
}: {
  revenue: number | null;
  orders: number | null;
  profit: number | null;
  achievementRate: number;
  tier: GradePool['tier'];
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
      <Item label="매출액" value={revenue === null ? '—' : `${revenue}억`} />
      <Item label="수주" value={orders === null ? '—' : `${orders}억`} />
      <Item label="이익률" value={profit === null ? '—' : `${profit}%`} />
      <Item label="달성률" value={fmtPercent(achievementRate)} />
      <div className="flex items-center gap-2">
        <dt className="text-muted-foreground">tier</dt>
        <StatusBadge status={tier} />
      </div>
    </dl>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
