'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AlertCircle, Lock, Unlock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import {
  useGroupPerformance,
  groupPerformanceCommands,
} from '@/hooks/useGroupPerformance';
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
import { isHrAdmin } from '@/lib/nav';
import { fmtPercent } from '@/lib/ui';
import { T, gradeChipColor } from '@/lib/toss';
import type { Grade, GradePool } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 인터랙티브 등급풀 행 상태(디자인 파일 GradePool).
type PoolRow = { grade: Grade; pct: number; count: number; locked: boolean };

export default function GroupPerformancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const { hasFeature } = usePermissions();
  const cycleId = current?.id;

  const allowed =
    !!user && (user.role === 'hr_admin' || user.role === 'division_head');
  // 쓰기(그룹실적 저장·등급풀 편집/적용) 게이트 — HR 관리자 + 권한 매트릭스 '등급풀 수정'(restrict-only).
  // 백엔드가 POST /grade-pools/compute · PATCH /grade-pools/:id 에 @RequireFeature('등급풀 수정') 강제하므로
  // feature 키 문자열은 백엔드와 정확히 동일해야 한다(불일치 시 403 FEATURE_DENIED).
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

  // 부서별 등급 현황(하단 테이블).
  const { data: distData } = useGradeDistribution(
    { cycleId, groupId: activeGroupId },
    { enabled: !!cycleId && allowed && !!activeGroupId },
  );
  const distRows = distData?.data ?? [];

  // ── 그룹 실적 입력(HR) ───────────────────────────────────────
  const [revenue, setRevenue] = useState('');
  const [orders, setOrders] = useState('');
  const [profit, setProfit] = useState('');
  const [achievementRate, setAchievementRate] = useState('');
  const [busy, setBusy] = useState(false);

  // ── 인터랙티브 등급풀 편집 상태 ──────────────────────────────
  // pool(서버) 로드 후 비율/상한으로 초기화. 사용자가 −/+/잠금으로 조정.
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

  // 파이 데이터 — 디자인은 비율(%) 기준.
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
            <select
              value={activeGroupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="shrink-0"
              style={{
                fontSize: 13,
                color: T.grey900,
                background: '#fff',
                border: `1px solid ${T.grey200}`,
                padding: '8px 12px',
                minWidth: 160,
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <>
          {/* 섹션 1: 그룹 실적(HR 편집) */}
          <div
            className="bg-white overflow-hidden"
            style={{ border: `1px solid ${T.grey200}` }}
          >
            <div
              className="px-5 py-3"
              style={{
                background: T.grey50,
                borderBottom: `1px solid ${T.grey200}`,
              }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
                그룹 실적
              </h3>
              <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 1 }}>
                {perf ? (
                  <span className="inline-flex items-center gap-1.5">
                    현재 tier <StatusBadge status={perf.tier} /> · 달성률{' '}
                    {fmtPercent(perf.achievementRate)}
                  </span>
                ) : (
                  '아직 그룹 실적이 입력되지 않았어요.'
                )}
              </p>
            </div>

            <div className="p-5">
              {!editable ? (
                perf ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <Item
                      label="매출액"
                      value={perf.revenue === null ? '—' : `${perf.revenue}억`}
                    />
                    <Item
                      label="수주"
                      value={perf.orders === null ? '—' : `${perf.orders}억`}
                    />
                    <Item
                      label="이익률"
                      value={perf.profit === null ? '—' : `${perf.profit}%`}
                    />
                    <Item
                      label="달성률"
                      value={fmtPercent(perf.achievementRate)}
                    />
                  </dl>
                ) : (
                  <p style={{ fontSize: 13, color: T.grey600 }}>
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
                  <div className="flex items-center justify-end">
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
            </div>
          </div>

          {/* 섹션 2·3: 등급풀 편집 + 파이 */}
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: '1fr 340px' }}
          >
            {/* 등급풀 설정(인터랙티브) */}
            <div
              className="bg-white overflow-hidden"
              style={{ border: `1px solid ${T.grey200}` }}
            >
              <div
                className="px-5 py-3 flex items-center"
                style={{
                  background: T.grey50,
                  borderBottom: `1px solid ${T.grey200}`,
                }}
              >
                <div>
                  <h3
                    style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}
                  >
                    등급풀 설정
                  </h3>
                  <p
                    style={{ fontSize: 11.5, color: T.grey600, marginTop: 1 }}
                  >
                    {pool
                      ? `각 등급의 비율을 설정합니다. 합계: ${poolSum}%`
                      : '등급 풀을 적용하면 비율을 조정할 수 있어요.'}
                  </p>
                </div>
                {editable && pool && (
                  <div className="ml-auto">
                    <Button
                      variant="secondary"
                      loading={busy}
                      disabled={!poolDirty || poolSum !== 100}
                      onClick={() => void savePool()}
                    >
                      저장
                    </Button>
                  </div>
                )}
              </div>

              {perfLoading ? (
                <div className="p-5">
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : pool && poolRows.length > 0 ? (
                <>
                  {poolSum !== 100 && (
                    <div
                      className="mx-5 mt-4 flex items-center gap-2 p-3"
                      style={{
                        background: T.grey100,
                        border: '1px solid #FED7AA',
                      }}
                    >
                      <AlertCircle size={14} color="#f57800" />
                      <span style={{ fontSize: 12, color: '#f57800' }}>
                        등급풀 합계가 100%가 되어야 합니다.
                      </span>
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    {poolRows.map((r) => {
                      const color = gradeChipColor[r.grade].bg;
                      return (
                        <div
                          key={r.grade}
                          className="p-4"
                          style={{
                            border: `1px solid ${T.grey200}`,
                            background: r.locked ? T.grey50 : '#fff',
                          }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span
                              className="px-3 py-1 font-bold"
                              style={{
                                fontSize: 12,
                                background: color,
                                color: '#fff',
                              }}
                            >
                              {r.grade}등급
                            </span>
                            <span
                              style={{ fontSize: 12, color: T.grey600 }}
                            >
                              현재 {r.count}명
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => toggleLock(r.grade)}
                                className="ml-auto p-1 transition-colors"
                                style={{ color: T.grey500 }}
                                aria-label={
                                  r.locked ? '잠금 해제' : '잠금'
                                }
                              >
                                {r.locked ? (
                                  <Lock size={13} color={T.grey500} />
                                ) : (
                                  <Unlock size={13} color={T.grey500} />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => adjust(r.grade, -5)}
                              disabled={!editable || r.locked}
                              className="w-7 h-7 flex items-center justify-center disabled:opacity-40 transition-colors"
                              style={{
                                fontSize: 16,
                                color: T.grey700,
                                border: `1px solid ${T.grey200}`,
                              }}
                            >
                              −
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color,
                                  }}
                                >
                                  {r.pct}%
                                </span>
                                <span
                                  style={{ fontSize: 11, color: T.grey500 }}
                                >
                                  {Math.round((headcount * r.pct) / 100)}명
                                  예상
                                </span>
                              </div>
                              <div
                                className="w-full"
                                style={{ height: 8, background: T.grey100 }}
                              >
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${r.pct}%`,
                                    background: color,
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => adjust(r.grade, 5)}
                              disabled={!editable || r.locked}
                              className="w-7 h-7 flex items-center justify-center disabled:opacity-40 transition-colors"
                              style={{
                                fontSize: 16,
                                color: T.grey700,
                                border: `1px solid ${T.grey200}`,
                              }}
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
                <div className="p-5">
                  <EmptyState
                    title={
                      perf
                        ? '등급 풀이 아직 적용되지 않았어요.'
                        : '그룹 실적을 먼저 입력해 주세요.'
                    }
                  />
                </div>
              )}
            </div>

            {/* 분포 비율 파이 */}
            <div
              className="bg-white p-5"
              style={{ border: `1px solid ${T.grey200}` }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.grey900,
                  marginBottom: 4,
                }}
              >
                등급 분포 비율
              </h3>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={gradeChipColor[entry.name as Grade].bg}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [`${v}%`, '비율']}
                        contentStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-5 gap-1.5 mt-2">
                    {poolRows.map((r) => (
                      <div key={r.grade} className="text-center">
                        <div
                          className="w-3 h-3 mx-auto mb-0.5"
                          style={{ background: gradeChipColor[r.grade].bg }}
                        />
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: gradeChipColor[r.grade].bg,
                          }}
                        >
                          {r.grade}
                        </div>
                        <div style={{ fontSize: 10, color: T.grey500 }}>
                          {r.pct}%
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div
                  className="flex items-center gap-2 p-3 mt-3"
                  style={{ background: T.grey100 }}
                >
                  <AlertCircle size={14} color={T.orange500} />
                  <span style={{ fontSize: 12, color: T.grey600 }}>
                    등급 풀을 적용하면 분포가 표시돼요.
                  </span>
                </div>
              )}
            </div>
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
    <div
      className="bg-white overflow-hidden"
      style={{ border: `1px solid ${T.grey200}` }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{
          background: T.grey50,
          borderBottom: `1px solid ${T.grey200}`,
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
          부서별 등급 현황
        </h3>
        {rows.length > 0 && (
          <div className="flex ml-auto gap-1 flex-wrap justify-end">
            {tabs.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDept(d)}
                className="px-2.5 py-1 transition-colors"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  background: activeDept === d ? T.blue500 : 'transparent',
                  color: activeDept === d ? '#fff' : T.grey600,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title="아직 확정된 등급 현황이 없어요." />
        </div>
      ) : (
        <>
          <div
            className="grid px-5 py-2.5"
            style={{
              gridTemplateColumns: COLS,
              background: T.grey50,
              borderBottom: `1px solid ${T.grey200}`,
            }}
          >
            {['부서', 'S', 'A', 'B', 'C', 'D', '전체'].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.grey600,
                  textAlign: h === '부서' ? 'left' : 'center',
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {visible.map((d) => (
            <div
              key={d.deptId}
              className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: COLS,
                borderBottom: `1px solid ${T.grey200}`,
              }}
            >
              <div
                style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}
              >
                {d.deptName}
              </div>
              {GRADES.map((g) => (
                <div key={g} className="text-center">
                  <span
                    className="px-1.5 py-0.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: gradeChipColor[g].bg,
                      color: gradeChipColor[g].color,
                    }}
                  >
                    {d[g]}
                  </span>
                </div>
              ))}
              <div
                className="text-center"
                style={{ fontSize: 12, fontWeight: 600, color: T.grey900 }}
              >
                {d.total}명
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt style={{ fontSize: 11, color: T.grey500 }}>{label}</dt>
      <dd style={{ fontSize: 14, fontWeight: 600, color: T.grey900 }}>
        {value}
      </dd>
    </div>
  );
}
