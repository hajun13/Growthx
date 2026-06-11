'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, Info } from 'lucide-react';
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
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { kpiCategoryLabel, fmtAmount, monthLabel, fmtPercent } from '@/lib/ui';
import { T, gradeChipColor, categoryChip } from '@/lib/toss';
import type {
  Grade,
  KpiCategory,
  MonthlyPerformance,
  MonthlyPerformanceInput,
  MonthlyPerformanceSummaryCategory,
} from '@/lib/types';

// ── Kinetic Enterprise 팔레트 (루트 DESIGN.md SSOT) ──────────────
const K = {
  primary: '#3f2c80',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outlineVariant: '#cac4d2',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
// 월별 실적 입력은 성과중심 금액형 카테고리 대상.
const CATEGORY_OPTIONS: KpiCategory[] = ['revenue', 'construction', 'orders'];

interface CellDraft {
  id?: string;
  target: string;
  actual: string;
}

function rowKey(month: number, category: KpiCategory): string {
  return `${month}:${category}`;
}

// 달성률 → Kinetic 톤 색(100%↑ 틸 · 90%↑ 파랑 · 그 외 주황).
function rateColor(rate: number | null): string {
  if (rate === null) return K.outlineVariant;
  if (rate >= 100) return K.tertiary;   // tertiary teal — 성공/완료
  if (rate >= 90) return K.secondary;   // secondary blue — 진행
  return '#f57800';                      // warning amber
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
    !!user && (isAdmin || isDivisionHead || user.role === 'team_lead');
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

  const { data: summary, reload: reloadSummary } =
    useMonthlyPerformanceSummary(
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

  // 카테고리별 요약 맵(현황 카드용).
  const byCategory = useMemo(() => {
    const m = new Map<KpiCategory, MonthlyPerformanceSummaryCategory>();
    for (const c of summary?.byCategory ?? []) m.set(c.category, c);
    return m;
  }, [summary]);

  // 월별 누적 달성률 추이(차트용) — 데이터 있는 지점만.
  const trend = useMemo(
    () =>
      (summary?.monthlyTrend ?? []).map((p) => ({
        month: `${p.month}월`,
        rate: Math.round(p.achievementRate * 10) / 10,
        grade: p.grade,
      })),
    [summary],
  );

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

  // 입력 변경 여부(저장 버튼 활성/비활성).
  const dirty = useMemo(() => {
    for (const month of MONTHS) {
      const key = rowKey(month, category);
      const cell = drafts[key];
      if (!cell) continue;
      const existing = serverMap.get(key);
      const baseTarget = existing ? String(existing.targetAmount) : '';
      const baseActual = existing ? String(existing.actualAmount) : '';
      if (cell.target !== baseTarget || cell.actual !== baseActual) return true;
    }
    return false;
  }, [drafts, serverMap, category]);

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
    return (
      <Forbidden message="월별 실적 입력은 HR·본부장만 접근할 수 있어요." />
    );
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const filledMonths = MONTHS.filter((m) => {
    const c = drafts[rowKey(m, category)];
    return c && (c.target !== '' || c.actual !== '');
  }).length;

  return (
    <PageContainer>
      <PageHeader
        title="월별 실적 입력"
        subtitle="그룹·본부별 1~12월 목표/실적을 입력하면 누적 달성률과 현재 등급이 자동 계산됩니다."
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <span
            className="px-3 py-2"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: K.onSurfaceVariant,
              background: K.surfaceLow,
              border: `1px solid ${K.outlineVariant}`,
              borderRadius: 8,
            }}
          >
            기준 {year}년
          </span>
        }
      />

      {/* ── 부서 선택 + 안내 ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, fontWeight: 600, color: K.onSurfaceVariant }}>
            대상 부서
          </span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-lg"
            style={{
              fontSize: 13,
              color: K.onSurface,
              background: '#fff',
              border: `1px solid ${K.outlineVariant}`,
              padding: '8px 12px',
              minWidth: 200,
              outline: 'none',
            }}
          >
            {deptOptions.length === 0 && <option value="">부서 없음</option>}
            {deptOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(0,84,202,0.06)', border: `1px solid rgba(0,84,202,0.15)` }}
        >
          <Info size={13} color={K.secondary} />
          <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>
            매월 입력 시 누적 달성률(실적합/목표합)·측정방식별 등급이 자동 산정돼요.
            {!canEdit && ' (조회 전용 — 입력은 HR·본부장만)'}
          </span>
        </div>
      </div>

      {!departmentId ? (
        <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}>
          <EmptyState title="대상 부서를 선택해 주세요." />
        </div>
      ) : (
        <>
          {/* ── 누적 요약 스탯 카드 ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="누적 목표"
              value={summary ? fmtAmount(summary.targetAmount) : '–'}
            />
            <StatCard
              label="누적 실적"
              value={summary ? fmtAmount(summary.actualAmount) : '–'}
              valueColor={K.secondary}
            />
            <StatCard
              label="누적 달성률"
              value={summary ? fmtPercent(summary.achievementRate) : '–'}
              valueColor={summary ? rateColor(summary.achievementRate) : K.onSurface}
            />
            <StatCard label="현재 등급">
              {summary?.currentGrade ? (
                <span
                  className="inline-block px-3 py-1"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#fff',
                    background: gradeChipColor[summary.currentGrade].bg,
                    borderRadius: 999,
                  }}
                >
                  {summary.currentGrade}
                </span>
              ) : (
                <span style={{ fontSize: 22, fontWeight: 700, color: K.outlineVariant }}>
                  –
                </span>
              )}
            </StatCard>
          </div>

          {error ? (
            <ErrorState onRetry={reload} />
          ) : (
            <>
              {/* ── 카테고리별 현황(클릭 = 입력 카테고리 전환) ──── */}
              <div
                className="bg-white rounded-xl overflow-hidden"
                style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
              >
                <SectionHead
                  title="카테고리별 누적 현황"
                  desc="카드를 선택하면 아래 표에서 해당 카테고리의 월별 값을 입력할 수 있어요."
                />
                <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <CategoryCard
                      key={cat}
                      category={cat}
                      data={byCategory.get(cat) ?? null}
                      active={cat === category}
                      onSelect={() => setCategory(cat)}
                    />
                  ))}
                </div>
              </div>

              {/* ── 월별 누적 달성률 추이 차트 ──────────────────── */}
              {trend.length > 0 && (
                <div
                  className="bg-white rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
                >
                  <SectionHead
                    title="월별 누적 달성률 추이"
                    desc="부서 전체 누적 실적 기준 월별 달성률입니다."
                  />
                  <div className="p-5">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart
                        data={trend}
                        margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="rateFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor={K.secondary} stopOpacity={0.18} />
                            <stop offset="100%" stopColor={K.secondary} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(202,196,210,0.3)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: K.onSurfaceVariant }}
                          axisLine={{ stroke: K.outlineVariant }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: K.onSurfaceVariant }}
                          axisLine={false}
                          tickLine={false}
                          unit="%"
                          width={48}
                        />
                        <Tooltip
                          formatter={(v: number) => [`${v}%`, '누적 달성률']}
                          contentStyle={{
                            fontSize: 12,
                            border: `1px solid ${K.outlineVariant}`,
                            borderRadius: 8,
                            boxShadow: CARD_SHADOW,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke={K.secondary}
                          strokeWidth={2}
                          fill="url(#rateFill)"
                          dot={{ r: 3, fill: K.secondary, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── 월별 목표/실적 입력 표 ──────────────────────── */}
              <div
                className="bg-white rounded-xl overflow-hidden"
                style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
              >
                <div
                  className="flex items-center gap-3 px-5 py-3"
                  style={{
                    background: K.surfaceLow,
                    borderBottom: `1px solid rgba(202,196,210,0.4)`,
                  }}
                >
                  <span
                    className="px-2 py-0.5 rounded-md"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: categoryChip[category].color,
                      background: categoryChip[category].bg,
                    }}
                  >
                    {kpiCategoryLabel[category]}
                  </span>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface }}>
                      월별 목표 / 실적
                    </h3>
                    <p style={{ fontSize: 12, color: K.onSurfaceVariant, marginTop: 1 }}>
                      입력된 월 {filledMonths} / 12
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={saving || !dirty}
                      onClick={() => void saveAll()}
                      className="ml-auto flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50 rounded-lg"
                      style={{ fontSize: 13, fontWeight: 600, background: K.secondary }}
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      저장
                    </button>
                  )}
                </div>

                {perfLoading ? (
                  <div className="p-5">
                    <Skeleton className="h-72 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <MonthTable
                      category={category}
                      drafts={drafts}
                      canEdit={canEdit}
                      onChange={updateCell}
                    />
                  </div>
                )}
              </div>

              <p style={{ fontSize: 11.5, color: K.onSurfaceVariant }}>
                월 달성률은 입력값 미리보기입니다. 누적 달성률·등급은 저장 후
                백엔드가 산정해요. 입력 주기는 월 1회입니다.
              </p>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}

// ── 스탯 카드 ───────────────────────────────────────────────
function StatCard({
  label,
  value,
  valueColor = K.onSurface,
  children,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="bg-white px-5 py-4 rounded-xl"
      style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: K.onSurfaceVariant }}>{label}</div>
      <div className="mt-1 flex items-center" style={{ minHeight: 32 }}>
        {children ?? (
          <span
            className="tabular-nums"
            style={{ fontSize: 26, fontWeight: 800, color: valueColor, lineHeight: 1.1 }}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 섹션 헤더 ────────────────────────────────────────────────
function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div
      className="px-5 py-3"
      style={{ background: K.surfaceLow, borderBottom: `1px solid rgba(202,196,210,0.4)` }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface }}>{title}</h3>
      {desc && (
        <p style={{ fontSize: 12, color: K.onSurfaceVariant, marginTop: 2 }}>{desc}</p>
      )}
    </div>
  );
}

// ── 카테고리 현황 카드(선택 가능) ───────────────────────────
function CategoryCard({
  category,
  data,
  active,
  onSelect,
}: {
  category: KpiCategory;
  data: MonthlyPerformanceSummaryCategory | null;
  active: boolean;
  onSelect: () => void;
}) {
  const rate = data?.achievementRate ?? null;
  const bar = rate === null ? 0 : Math.max(0, Math.min(100, rate));
  const color = rateColor(rate);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="p-4 text-left transition-all rounded-xl"
      style={{
        border: active
          ? `2px solid ${K.secondary}`
          : `1px solid ${K.outlineVariant}`,
        background: active ? 'rgba(0,84,202,0.04)' : '#fff',
        boxShadow: active ? CARD_SHADOW : 'none',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded-md"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: categoryChip[category].color,
            background: categoryChip[category].bg,
          }}
        >
          {kpiCategoryLabel[category]}
        </span>
        {data?.currentGrade && (
          <span
            className="ml-auto px-2 py-0.5 rounded-full"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              background: gradeChipColor[data.currentGrade].bg,
            }}
          >
            {data.currentGrade}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color }}>
          {rate === null ? '–' : fmtPercent(rate)}
        </span>
        <span style={{ fontSize: 11, color: K.onSurfaceVariant }}>
          {data ? `${fmtAmount(data.actualAmount)} / ${fmtAmount(data.targetAmount)}` : '미입력'}
        </span>
      </div>
      <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 6, background: K.surfaceLow }}>
        <div className="h-full transition-all" style={{ width: `${bar}%`, background: color }} />
      </div>
    </button>
  );
}

// ── 12개월 입력 표 ──────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  height: 36,
  width: '100%',
  maxWidth: 180,
  border: `1px solid ${K.outlineVariant}`,
  background: '#fff',
  padding: '0 10px',
  fontSize: 13,
  outline: 'none',
  borderRadius: 6,
};

function MonthTable({
  category,
  drafts,
  canEdit,
  onChange,
}: {
  category: KpiCategory;
  drafts: Record<string, CellDraft>;
  canEdit: boolean;
  onChange: (month: number, patch: Partial<CellDraft>) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={{ background: K.surfaceLow }}>
          {['월', '목표', '실적', '월 달성률'].map((h, i) => (
            <th
              key={h}
              className="px-5 py-2.5"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: K.onSurfaceVariant,
                textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'left',
                borderBottom: `1px solid rgba(202,196,210,0.4)`,
                width: i === 0 ? 72 : i === 3 ? 160 : undefined,
              }}
            >
              {h}
            </th>
          ))}
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
          const color = rateColor(rate);
          const bar = rate === null ? 0 : Math.max(0, Math.min(100, rate));
          return (
            <tr
              key={month}
              style={{ borderBottom: `1px solid rgba(202,196,210,0.2)` }}
            >
              <td
                className="px-5 py-2"
                style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}
              >
                {monthLabel(month)}
              </td>
              <td className="px-5 py-2">
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`${monthLabel(month)} 목표`}
                  value={cell.target}
                  readOnly={!canEdit}
                  disabled={!canEdit}
                  onChange={(e) => onChange(month, { target: e.target.value })}
                  className="tabular-nums disabled:opacity-60"
                  style={INPUT_STYLE}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.outlineVariant; }}
                  placeholder="0"
                />
              </td>
              <td className="px-5 py-2">
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`${monthLabel(month)} 실적`}
                  value={cell.actual}
                  readOnly={!canEdit}
                  disabled={!canEdit}
                  onChange={(e) => onChange(month, { actual: e.target.value })}
                  className="tabular-nums disabled:opacity-60"
                  style={INPUT_STYLE}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.outlineVariant; }}
                  placeholder="0"
                />
              </td>
              <td className="px-5 py-2">
                <div className="flex items-center justify-end gap-2">
                  <div
                    className="hidden sm:block rounded-full overflow-hidden"
                    style={{ width: 56, height: 6, background: K.surfaceLow }}
                  >
                    <div className="h-full" style={{ width: `${bar}%`, background: color }} />
                  </div>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: rate === null ? K.outlineVariant : color,
                      minWidth: 52,
                      textAlign: 'right',
                    }}
                  >
                    {rate === null ? '–' : fmtPercent(rate)}
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
