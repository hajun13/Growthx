'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Info, Save, Send, Check, LayoutTemplate } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpiCategoryAllowed } from '@/hooks/useKpiCategoryPolicy';
import { useKpiTemplates } from '@/hooks/useKpiTemplates';
import { useKpis, kpiCommands } from '@/hooks/useKpis';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeLabel } from '@/lib/ui';
import { T } from '@/lib/toss';
import type {
  Kpi,
  KpiGroup,
  KpiCategory,
  MeasureType,
  CreateKpiRequest,
} from '@/lib/types';

// 그룹별 허용 카테고리(domain-model §3) — payload 전송용 내부 매핑.
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};

// 측정방식 옵션(간소화).
const MEASURE_OPTIONS: { value: MeasureType; label: string }[] = [
  { value: 'amount', label: '금액달성률' },
  { value: 'rate', label: '달성률' },
  { value: 'count', label: '건수' },
  { value: 'qualitative', label: '정성' },
];

// 카테고리 컬럼(기존 그룹) — 파랑 vs 초록으로 명확히 구분.
const GROUP_CFG: Record<
  KpiGroup,
  { label: string; bg: string; hover: string; color: string }
> = {
  performance_core: { label: '성과중심', bg: '#1B64DA', hover: '#1255c0', color: '#fff' },
  collaboration_growth: { label: '협업·성장', bg: '#029359', hover: '#017a4a', color: '#fff' },
};

const GRID_COLS = '100px 1fr 1.5fr 100px 110px 64px 32px';

interface DraftKpi {
  id?: string;
  group: KpiGroup;
  category: KpiCategory;
  measureType: MeasureType;
  coreStrategy: string;
  csf: string;
  title: string;
  measureMethod: string;
  targetValue: string;
  weight: string;
  isQualitative: boolean;
}

function toDraft(k: Kpi): DraftKpi {
  return {
    id: k.id,
    group: k.group,
    category: k.category,
    measureType: k.measureType,
    coreStrategy: k.coreStrategy ?? '',
    csf: k.csf ?? '',
    title: k.title,
    measureMethod: k.measureMethod ?? '',
    targetValue: k.targetValue === null ? '' : String(k.targetValue),
    weight: String(k.weight),
    isQualitative: k.isQualitative,
  };
}

// employee는 revenue/construction/orders 작성 불가 → collaboration 그룹으로 시작.
function emptyDraft(role?: string): DraftKpi {
  const isEmployee = !role || role === 'employee';
  return {
    group: isEmployee ? 'collaboration_growth' : 'performance_core',
    category: isEmployee ? 'collaboration' : 'orders',
    measureType: 'count',
    coreStrategy: '',
    csf: '',
    title: '',
    measureMethod: '',
    targetValue: '',
    weight: '',
    isQualitative: false,
  };
}

function draftToPayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  return {
    cycleId,
    group: d.group,
    category: d.category,
    measureType: d.measureType,
    coreStrategy: d.coreStrategy || undefined,
    csf: d.csf || undefined,
    title: d.title,
    measureMethod: d.measureMethod || undefined,
    targetValue: d.targetValue === '' ? undefined : Number(d.targetValue),
    weight: Number(d.weight) || 0,
    isQualitative: d.measureType === 'qualitative' ? true : d.isQualitative,
  };
}

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};
const inputStyle: React.CSSProperties = {
  border: `1px solid ${T.grey200}`,
  padding: '8px 12px',
  fontSize: 13,
  color: T.grey900,
  background: '#fff',
  width: '100%',
  outline: 'none',
};

// 인라인 테이블 셀 스타일
const cellInput: React.CSSProperties = {
  border: `1px solid ${T.grey200}`,
  padding: '5px 8px',
  fontSize: 12,
  color: T.grey900,
  background: '#fff',
  width: '100%',
  outline: 'none',
};

export default function KpiWritePage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    current,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });
  const isLocked = phase?.isLocked ?? false;

  const isPositionHolder =
    user?.role === 'division_head' ||
    user?.role === 'team_lead' ||
    user?.role === 'hr_admin';

  const { data: allowedPolicy } = useKpiCategoryAllowed(
    { userId: user?.id },
    { enabled: !!user },
  );
  const allowedCategories = allowedPolicy?.allowed ?? null;
  const isCategoryAllowed = (c: KpiCategory) =>
    allowedCategories === null || allowedCategories.includes(c);
  // 그룹 단위 비활성 판단: 그룹 내 허용 카테고리가 하나도 없으면 비활성.
  const isGroupAllowed = (g: KpiGroup) =>
    CATEGORY_BY_GROUP[g].some((c) => isCategoryAllowed(c));

  // jobLevel별 KPI 양식 제안(선택 시 프리필). 양식 없으면 버튼 미노출.
  const { data: templateRes } = useKpiTemplates(
    { cycleId, jobLevel: user?.jobLevel },
    { enabled: !!cycleId && !!user?.jobLevel },
  );
  const template = templateRes?.data?.[0] ?? null;

  const { data, loading: kpiLoading, error, reload } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  const serverKpis = data?.data ?? [];
  const editableServer = serverKpis.filter((k) => k.status === 'draft');
  const lockedServer = serverKpis.filter((k) => k.status !== 'draft');

  const [drafts, setDrafts] = useState<DraftKpi[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const effectiveDrafts = useMemo(
    () => drafts ?? editableServer.map(toDraft),
    [drafts, editableServer],
  );

  // ── Info bar 값 ────────────────────────────────────────────
  const kpiDeadline = phase?.schedules?.find(
    (s) => s.phase === 'self' || s.phase === 'kpi',
  )?.dueDate;
  const deadlineStr = kpiDeadline
    ? new Date(kpiDeadline).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
      })
    : '미설정';

  const overallStatus =
    serverKpis.length === 0
      ? '작성중'
      : serverKpis.every((k) => k.status === 'confirmed')
        ? '확정'
        : serverKpis.some(
              (k) => k.status === 'submitted' || k.status === 'approved',
            )
          ? '제출완료'
          : serverKpis.some((k) => k.status === 'rejected')
            ? '반려'
            : '작성중';
  const statusColor =
    overallStatus === '확정'
      ? '#03b26c'
      : overallStatus === '제출완료'
        ? '#3182f6'
        : overallStatus === '반려'
          ? '#f04452'
          : '#4e5968';

  function updateDraft(idx: number, patch: Partial<DraftKpi>) {
    const base = drafts ?? editableServer.map(toDraft);
    const next = base.map((d, i) => {
      if (i !== idx) return d;
      const merged = { ...d, ...patch };
      if (patch.group && !CATEGORY_BY_GROUP[patch.group].includes(merged.category)) {
        merged.category = CATEGORY_BY_GROUP[patch.group][0];
      }
      if (patch.measureType === 'qualitative') merged.isQualitative = true;
      return merged;
    });
    setDrafts(next);
  }

  function addDraft() {
    const base = drafts ?? editableServer.map(toDraft);
    setDrafts([...base, emptyDraft(user?.role)]);
  }

  // 양식 불러오기 — 템플릿 항목을 빈 draft 행으로 프리필(허용 카테고리만).
  function loadTemplate() {
    if (!template) return;
    const base = drafts ?? editableServer.map(toDraft);
    const fromTemplate: DraftKpi[] = template.items
      .filter((it) => isCategoryAllowed(it.category))
      .map((it) => ({
        group: it.group,
        category: it.category,
        measureType: it.defaultMeasureType,
        coreStrategy: '',
        csf: it.sampleStrategy ?? '',
        title: '',
        measureMethod: '',
        targetValue: '',
        weight: it.defaultWeight ? String(it.defaultWeight) : '',
        isQualitative: it.isQualitative,
      }));
    if (fromTemplate.length === 0) {
      toast.show({ variant: 'danger', message: '적용 가능한 양식 항목이 없어요.' });
      return;
    }
    setDrafts([...base, ...fromTemplate]);
    toast.show({
      variant: 'success',
      message: `양식 ${fromTemplate.length}개 항목을 불러왔어요. 지표·목표를 입력해 주세요.`,
    });
  }

  const weightTotal = effectiveDrafts.reduce(
    (acc, d) => acc + (Number(d.weight) || 0),
    0,
  );
  const qualitativeTotal = effectiveDrafts
    .filter((d) => d.isQualitative || d.measureType === 'qualitative')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);

  const hasCore = effectiveDrafts.some((d) => d.group === 'performance_core');
  const hasGrowth = effectiveDrafts.some(
    (d) => d.group === 'collaboration_growth',
  );
  // 전사 공통 80/20 — 성과중심 80%, 협업·성장 20%.
  const coreTotal = effectiveDrafts
    .filter((d) => d.group === 'performance_core')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const growthTotal = effectiveDrafts
    .filter((d) => d.group === 'collaboration_growth')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const ratioOk = coreTotal === 80 && growthTotal === 20;
  // 모든 정량(비정성) KPI는 수치 목표값 필수.
  const missingTargets = effectiveDrafts.filter(
    (d) => d.measureType !== 'qualitative' && d.targetValue.trim() === '',
  ).length;

  function guardLocked(): boolean {
    if (isLocked) {
      toast.show({ variant: 'danger', message: '현재 KPI 작성 기간이 아닙니다.' });
      return true;
    }
    return false;
  }

  async function handleSaveAll(): Promise<boolean> {
    if (!cycleId || guardLocked()) return false;
    setSavingAll(true);
    let allOk = true;
    try {
      for (let i = 0; i < effectiveDrafts.length; i++) {
        const d = effectiveDrafts[i];
        if (!d.title.trim()) continue; // 빈 과제는 skip
        const payload = draftToPayload(cycleId, d);
        if (d.id) await kpiCommands.update(d.id, payload);
        else await kpiCommands.create(payload);
      }
      toast.show({ variant: 'success', message: '임시저장 완료' });
      setDrafts(null);
      reload();
    } catch (err) {
      allOk = false;
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장 실패',
      });
    } finally {
      setSavingAll(false);
    }
    return allOk;
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    const d = effectiveDrafts[deleteTarget];
    try {
      if (d.id) await kpiCommands.remove(d.id);
      const base = drafts ?? editableServer.map(toDraft);
      setDrafts(base.filter((_, i) => i !== deleteTarget));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSubmitAll() {
    if (!cycleId) return;
    if (guardLocked()) return;
    setSubmitting(true);
    try {
      for (const d of effectiveDrafts) {
        const payload = draftToPayload(cycleId, d);
        if (d.id) await kpiCommands.update(d.id, payload);
        else await kpiCommands.create(payload);
      }
      const { apiGetList } = await import('@/lib/api');
      const res = await apiGetList<Kpi>('/kpis', {
        cycleId,
        userId: user?.id,
        status: 'draft',
      });
      for (const k of res.data) await kpiCommands.submit(k.id);
      toast.show({ variant: 'success', message: 'KPI를 제출했어요.' });
      setDrafts(null);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message ||
              '가중치 합 100%, 성과중심 80%·협업·성장 20%, 정성 ≤30%, 정량 목표값을 확인해 주세요.'
            : err.code === 'CATEGORY_NOT_ALLOWED'
              ? '직급에서 허용하지 않는 카테고리가 있어요. 카테고리를 확인해 주세요.'
              : err.code === 'PERIOD_LOCKED'
                ? '현재 KPI 작성 기간이 아닙니다.'
                : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !isLocked &&
    overallStatus !== '확정' &&
    effectiveDrafts.length > 0 &&
    qualitativeTotal <= 30 &&
    hasCore &&
    hasGrowth &&
    ratioOk &&
    missingTargets === 0 &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  if (cyclesLoading || kpiLoading) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const weightColor =
    weightTotal === 100 ? T.green500 : weightTotal > 100 ? T.red500 : T.orange500;

  return (
    <div className="p-6 space-y-5" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>KPI 작성</h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>
            {current.name} · 성과중심 80%·협업·성장 20%, 정성 KPI ≤30%, 모든 정량 KPI 목표값 필수.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="px-3 py-1.5 text-white"
            style={{ fontSize: 11, fontWeight: 600, background: weightColor }}
          >
            합계 {weightTotal}%
          </span>
          {template && !isLocked && overallStatus !== '확정' && (
            <button
              onClick={loadTemplate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: 13,
                color: '#3182f6',
                border: '1px solid #c6dcff',
                background: '#f2f6ff',
                cursor: 'pointer',
              }}
            >
              <LayoutTemplate size={13} /> 양식 불러오기
            </button>
          )}
          <button
            onClick={() => void handleSaveAll()}
            disabled={savingAll || effectiveDrafts.length === 0 || isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 13,
              color: '#4e5968',
              border: '1px solid #e5e8eb',
              background: '#fff',
              cursor:
                savingAll || effectiveDrafts.length === 0 || isLocked
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                savingAll || effectiveDrafts.length === 0 || isLocked ? 0.6 : 1,
            }}
          >
            <Save size={13} /> {savingAll ? '저장 중…' : '임시저장'}
          </button>
          <button
            onClick={() => void handleSubmitAll()}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ fontSize: 13, fontWeight: 600, background: canSubmit ? T.blue500 : T.grey400 }}
          >
            <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
          </button>
        </div>
      </div>

      {/* 잠금 안내 */}
      {isLocked && (
        <div className="p-3 border flex items-center gap-2" style={{ background: T.blue50, borderColor: '#FED7AA' }}>
          <Info size={14} color={T.orange500} />
          <span style={{ fontSize: 12, color: '#f57800' }}>
            현재 KPI 작성 기간이 아닙니다. 작성 기간이 열리면 다시 수정할 수 있어요.
          </span>
        </div>
      )}

      {/* Info bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '평가 대상자', value: user?.name ?? '나', color: T.grey900 },
          { label: '평가 기간', value: current.name, color: T.grey900 },
          { label: '제출 기한', value: deadlineStr, color: T.grey900 },
          { label: '현재 상태', value: overallStatus, color: statusColor },
        ].map((info, i) => (
          <div key={i} className="px-4 py-3" style={card}>
            <div style={{ fontSize: 11, color: T.grey500, marginBottom: 2 }}>{info.label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: info.color }}>{info.value}</div>
          </div>
        ))}
      </div>

      {/* 제출·확정된 과제 */}
      {lockedServer.length > 0 && (
        <div className="overflow-hidden" style={card}>
          <div className="px-5 py-3 border-b" style={{ background: T.grey50, borderColor: T.grey200 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>제출·확정된 과제</h3>
          </div>
          <ul>
            {lockedServer.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b last:border-b-0"
                style={{ borderColor: T.grey200 }}
              >
                <div className="flex flex-col">
                  <span style={{ fontSize: 13.5, color: T.grey900 }}>{k.title}</span>
                  <span style={{ fontSize: 11.5, color: T.grey500 }}>
                    {kpiGroupLabel[k.group]} · {kpiCategoryLabel[k.category]} · {measureTypeLabel[k.measureType]}
                    {k.status === 'rejected' && k.rejectReason ? ` · 반려사유: ${k.rejectReason}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 12, color: T.grey600 }} className="tabular-nums">가중치 {k.weight}%</span>
                  <KpiStatusBadge status={k.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI 테이블 */}
      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
        {/* 테이블 헤더 */}
        <div
          style={{ padding: '10px 16px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>KPI 목록</h3>
        </div>

        {/* 컬럼 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            gap: 8,
            padding: '8px 16px',
            borderBottom: `1px solid ${T.grey200}`,
            background: T.grey50,
          }}
        >
          {[
            '카테고리',
            '전략 목표 (CSF)',
            '성과관리지표 (KPI)',
            '2026년 목표',
            '측정방식',
            '가중치',
            '',
          ].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
              {h}
            </div>
          ))}
        </div>

        {/* KPI 행들 */}
        {effectiveDrafts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
            첫 과제를 추가해 주세요.
          </div>
        ) : (
          effectiveDrafts.map((d, idx) => {
            const isQual = d.measureType === 'qualitative';
            const grp = GROUP_CFG[d.group];
            return (
              <div
                key={d.id ?? `new-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLS,
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderBottom: `1px solid ${T.grey200}`,
                }}
              >
                {/* 카테고리(그룹) select */}
                <select
                  value={d.group}
                  onChange={(e) =>
                    updateDraft(idx, {
                      group: e.target.value as KpiGroup,
                      category: CATEGORY_BY_GROUP[e.target.value as KpiGroup][0],
                    })
                  }
                  style={{
                    padding: '5px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    background: grp.bg,
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = grp.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = grp.bg)}
                  onFocus={(e) => (e.currentTarget.style.background = grp.hover)}
                  onBlur={(e) => (e.currentTarget.style.background = grp.bg)}
                >
                  <option
                    value="performance_core"
                    disabled={!isGroupAllowed('performance_core')}
                    style={{ background: '#1B64DA', color: '#fff' }}
                  >
                    성과중심{!isGroupAllowed('performance_core') ? ' (작성 불가)' : ''}
                  </option>
                  <option
                    value="collaboration_growth"
                    disabled={!isGroupAllowed('collaboration_growth')}
                    style={{ background: '#029359', color: '#fff' }}
                  >
                    협업·성장{!isGroupAllowed('collaboration_growth') ? ' (작성 불가)' : ''}
                  </option>
                </select>

                {/* 전략 목표 (CSF) */}
                <input
                  value={d.csf}
                  onChange={(e) => updateDraft(idx, { csf: e.target.value })}
                  placeholder="신규 시장 진출"
                  style={cellInput}
                />

                {/* 성과관리지표 (KPI) — 필수 */}
                <input
                  value={d.title}
                  onChange={(e) => updateDraft(idx, { title: e.target.value })}
                  placeholder="성과관리지표 입력 *"
                  style={cellInput}
                />

                {/* 2026년 목표 */}
                {isQual ? (
                  <div style={{ fontSize: 11, color: T.grey500, textAlign: 'center' }}>정성</div>
                ) : (
                  <input
                    type="number"
                    value={d.targetValue}
                    onChange={(e) => updateDraft(idx, { targetValue: e.target.value })}
                    placeholder="목표값"
                    style={{ ...cellInput, textAlign: 'right' }}
                  />
                )}

                {/* 측정방식 */}
                <select
                  value={d.measureType}
                  onChange={(e) => updateDraft(idx, { measureType: e.target.value as MeasureType })}
                  style={{ ...cellInput, fontSize: 11 }}
                >
                  {MEASURE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* 가중치 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={d.weight}
                    onChange={(e) => updateDraft(idx, { weight: e.target.value })}
                    style={{ ...cellInput, width: 44, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 11, color: T.grey500 }}>%</span>
                </div>

                {/* 삭제 */}
                <button
                  onClick={() => setDeleteTarget(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="과제 삭제"
                >
                  <Trash2 size={13} color={T.red500} />
                </button>
              </div>
            );
          })
        )}

        {/* 하단: 행 추가 + 가중치 합계 */}
        <div
          className="flex items-center justify-between"
          style={{ gap: 8, padding: '10px 16px', borderTop: `1px solid ${T.grey200}`, background: T.grey50 }}
        >
          <button
            onClick={addDraft}
            disabled={isLocked || overallStatus === '확정'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#3182f6',
              background: 'none',
              border: 'none',
              cursor: isLocked || overallStatus === '확정' ? 'not-allowed' : 'pointer',
              opacity: isLocked || overallStatus === '확정' ? 0.5 : 1,
              padding: '6px 0',
            }}
          >
            <Plus size={12} /> 항목 추가
          </button>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ fontSize: 12, color: T.grey600 }}>가중치 합계</span>
            <span
              className="tabular-nums"
              style={{ fontSize: 15, fontWeight: 700, color: weightTotal === 100 ? T.green500 : T.red500 }}
            >
              {weightTotal}%
            </span>
            <span style={{ fontSize: 11, color: T.grey500 }}>/ 100%</span>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5" style={{ fontSize: 12.5 }}>
        <ChecklistItem ok={qualitativeTotal <= 30}>
          정성 {qualitativeTotal}%{qualitativeTotal <= 30 ? '' : ' (≤30%)'}
        </ChecklistItem>
        <ChecklistItem ok={coreTotal === 80}>성과중심 {coreTotal}% (80%)</ChecklistItem>
        <ChecklistItem ok={growthTotal === 20}>협업·성장 {growthTotal}% (20%)</ChecklistItem>
        <ChecklistItem ok={missingTargets === 0}>
          목표값 {missingTargets === 0 ? '완료' : `미입력 ${missingTargets}개`}
        </ChecklistItem>
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="과제를 삭제할까요?"
        primaryAction={{ label: '삭제', variant: 'danger', onClick: () => void confirmDelete() }}
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
      >
        삭제하면 작성한 내용이 사라져요.
      </Modal>
    </div>
  );
}

function ChecklistItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? T.green500 : T.grey500 }}>
      {ok ? <Check size={14} /> : <span style={{ width: 14, textAlign: 'center' }}>·</span>}
      {children}
    </span>
  );
}

const KPI_STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  submitted: { label: '제출', bg: T.blue500 },
  approved: { label: '승인', bg: T.green500 },
  confirmed: { label: '확정', bg: T.blue700 },
  rejected: { label: '반려', bg: T.red500 },
  revision_requested: { label: '수정요청', bg: T.orange500 },
  draft: { label: '작성중', bg: T.grey500 },
};
function KpiStatusBadge({ status }: { status: string }) {
  const s = KPI_STATUS_LABEL[status] ?? KPI_STATUS_LABEL.draft;
  return (
    <span className="px-2.5 py-1 text-white" style={{ fontSize: 11, fontWeight: 600, background: s.bg }}>
      {s.label}
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
