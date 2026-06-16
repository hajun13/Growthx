'use client';

import React, { useMemo, useState } from 'react';
import { Save, Send, Check, LayoutTemplate, PlusCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpiCategoryAllowed } from '@/hooks/useKpiCategoryPolicy';
import { useKpiTemplates } from '@/hooks/useKpiTemplates';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useKpiSnapshots, useKpiSnapshotDiff } from '@/hooks/useKpiSnapshots';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type {
  Kpi,
  KpiGroup,
  KpiCategory,
  MeasureType,
  CreateKpiRequest,
  KpiGradingCriteria,
} from '@/lib/types';
import { useKpisData } from '../hooks';
import { kpiCommands, fetchKpisByStatus } from '../api';
import { KpiLockedCard } from './KpiLockedCard';
import { KpiDraftCard } from './KpiDraftCard';
import { KpiDiffPanel } from './KpiDiffPanel';
import type { DraftKpi, GradingDraft } from './types';

// ── 도메인 상수 ────────────────────────────────────────────────────
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};

const KPI_GROUP_BASE: Record<KpiGroup, number> = {
  performance_core: 4,
  collaboration_growth: 2,
};
const KPI_GROUP_MAX_EXTRA = 1;

const GRADE_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;
const EMPTY_GRADING: GradingDraft = { S: '', A: '', B: '', C: '', D: '' };

// ── 헬퍼 함수 ────────────────────────────────────────────────────
function toDraft(k: Kpi): DraftKpi {
  return {
    id: k.id,
    group: k.group,
    category: k.category,
    measureType: k.measureType,
    coreStrategy: k.coreStrategy ?? '',
    csf: k.csf ?? '',
    title: k.title,
    targetText: k.targetText ?? '',
    measureMethod: k.measureMethod ?? '',
    targetValue: k.targetValue === null ? '' : String(k.targetValue),
    weight: String(k.weight),
    isQualitative: k.isQualitative,
    useAbsoluteAmount: k.useAbsoluteAmount ?? false,
    gradingCriteria: {
      S: k.gradingCriteria?.S ?? '',
      A: k.gradingCriteria?.A ?? '',
      B: k.gradingCriteria?.B ?? '',
      C: k.gradingCriteria?.C ?? '',
      D: k.gradingCriteria?.D ?? '',
    },
  };
}

function emptyDraft(role?: string): DraftKpi {
  const isEmployee = !role || role === 'employee';
  return {
    group: isEmployee ? 'collaboration_growth' : 'performance_core',
    category: isEmployee ? 'collaboration' : 'orders',
    measureType: 'qualitative',
    coreStrategy: '',
    csf: '',
    title: '',
    targetText: '',
    measureMethod: '',
    targetValue: '',
    weight: '',
    isQualitative: false,
    useAbsoluteAmount: false,
    gradingCriteria: { ...EMPTY_GRADING },
  };
}

function gradingToPayload(g: GradingDraft): KpiGradingCriteria | undefined {
  const hasAny = GRADE_KEYS.some((k) => g[k].trim() !== '');
  if (!hasAny) return undefined;
  return {
    S: g.S.trim() || null,
    A: g.A.trim() || null,
    B: g.B.trim() || null,
    C: g.C.trim() || null,
    D: g.D.trim() || null,
  };
}

function draftToPayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  const useAbs = d.category === 'revenue' && !d.isQualitative && d.useAbsoluteAmount;
  return {
    cycleId,
    group: d.group,
    category: d.category,
    measureType: useAbs ? 'amount' : 'qualitative',
    coreStrategy: d.coreStrategy || undefined,
    csf: d.csf || undefined,
    title: d.title,
    targetText: d.targetText.trim() || undefined,
    measureMethod: d.measureMethod.trim() || undefined,
    targetValue: undefined,
    weight: Number(d.weight) || 0,
    isQualitative: d.isQualitative,
    useAbsoluteAmount: useAbs,
    gradingCriteria: gradingToPayload(d.gradingCriteria),
  };
}

// ─── 제출 완료 모드 정보 스트립 ─────────────────────────────────
function CompletionInfoRow({
  userName,
  cycleName,
  deadlineStr,
  status,
}: {
  userName: string;
  cycleName: string;
  deadlineStr: string;
  status: string;
}) {
  const isFinalized = status === '확정';
  const isSubmitted = status === '제출완료';
  const statusAccent = isFinalized
    ? 'text-success-600'
    : isSubmitted
      ? 'text-info-600'
      : undefined;
  return (
    <HeaderMetrics
      items={[
        { label: '평가 대상자', value: userName },
        { label: '평가 기간', value: cycleName },
        { label: '제출 기한', value: deadlineStr },
        { label: '현재 상태', value: status, accent: statusAccent },
      ]}
    />
  );
}

// ── 하단 고정 액션 바 ────────────────────────────────────────────
function BottomActionBar({
  weightTotal,
  qualitativeTotal,
  canSubmit,
  savingAll,
  submitting,
  draftsEmpty,
  isLocked,
  onSave,
  onSubmit,
}: {
  weightTotal: number;
  qualitativeTotal: number;
  canSubmit: boolean;
  savingAll: boolean;
  submitting: boolean;
  draftsEmpty: boolean;
  isLocked: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  const qualitativeOver = qualitativeTotal > 30;
  const weightOk = weightTotal === 100;
  const weightColor = weightOk ? 'text-success-600' : weightTotal > 100 ? 'text-danger-600' : 'text-warning-600';

  return (
    <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-background/95 backdrop-blur-sm border-t border-border/50">
      {/* 좌측 통계 */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-[11px] text-muted-foreground mb-0.5">전체 가중치 합계</div>
          <div className="flex items-center gap-1.5">
            <span className={`tabular-nums text-[18px] font-bold ${weightColor}`}>{weightTotal}%</span>
            <span className="text-[12px] text-muted-foreground">/ 100%</span>
          </div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <div className="text-[11px] text-muted-foreground mb-0.5">정성 KPI 비중</div>
          <div className="flex items-center gap-1.5">
            <span className={`tabular-nums text-[18px] font-bold ${qualitativeOver ? 'text-warning-600' : 'text-muted-foreground'}`}>
              {qualitativeTotal}%
            </span>
            <span className="text-[11px] text-disabled">(권장 ≤ 30%)</span>
          </div>
        </div>
      </div>
      {/* 우측 버튼 */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={onSave}
          disabled={savingAll || draftsEmpty || isLocked}
          loading={savingAll}
          leftIcon={<Save size={14} aria-hidden />}
        >
          임시저장
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          leftIcon={<Send size={14} aria-hidden />}
        >
          최종 제출
        </Button>
      </div>
    </div>
  );
}

// ── 체크리스트 항목 ───────────────────────────────────────────────
function ChecklistItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-success-600' : 'text-muted-foreground'}`}>
      {ok ? <Check size={13} aria-hidden /> : <span className="w-3.5 text-center">·</span>}
      {children}
    </span>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function KpiWriteView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });
  const isLocked = phase?.isLocked ?? false;

  const { data: allowedPolicy } = useKpiCategoryAllowed(
    { userId: user?.id },
    { enabled: !!user },
  );
  const allowedCategories = allowedPolicy?.allowed ?? null;
  const isCategoryAllowed = (c: KpiCategory) =>
    allowedCategories === null || allowedCategories.includes(c);
  const isGroupAllowed = (g: KpiGroup) =>
    CATEGORY_BY_GROUP[g].some((c) => isCategoryAllowed(c));

  const { data: templateRes } = useKpiTemplates(
    { cycleId, jobLevel: user?.jobLevel },
    { enabled: !!cycleId && !!user?.jobLevel },
  );
  const template = templateRes?.data?.[0] ?? null;

  const { data, loading: kpiLoading, error, reload } = useKpisData(cycleId, user?.id);
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const { data: snapshotsRes } = useKpiSnapshots(
    cycleId,
    { userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const latestSnapshot = snapshotsRes?.data?.[0] ?? null;
  const { data: snapshotDiff } = useKpiSnapshotDiff(
    cycleId,
    latestSnapshot?.id,
    { enabled: !!cycleId && !!latestSnapshot },
  );

  const serverKpis = data?.data ?? [];
  const editableServer = serverKpis.filter((k) => k.status === 'draft');
  const lockedServer = serverKpis.filter((k) => k.status !== 'draft');

  const [drafts, setDrafts] = useState<DraftKpi[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 완료 KPI 펼침 상태 — 기본값 {} → 모두 접힘(collapsed). key = kpi.id
  const [expandedLocked, setExpandedLocked] = useState<Record<string, boolean>>({});

  function toggleLocked(id: string) {
    setExpandedLocked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const effectiveDrafts = useMemo(
    () => drafts ?? editableServer.map(toDraft),
    [drafts, editableServer],
  );

  const groupCount = useMemo<Record<KpiGroup, number>>(
    () => ({
      performance_core:
        effectiveDrafts.filter((d) => d.group === 'performance_core').length +
        lockedServer.filter((k) => k.group === 'performance_core').length,
      collaboration_growth:
        effectiveDrafts.filter((d) => d.group === 'collaboration_growth').length +
        lockedServer.filter((k) => k.group === 'collaboration_growth').length,
    }),
    [effectiveDrafts, lockedServer],
  );

  function canAddToGroup(g: KpiGroup): boolean {
    return groupCount[g] < KPI_GROUP_BASE[g] + KPI_GROUP_MAX_EXTRA;
  }

  const submissionComplete = lockedServer.length > 0 && effectiveDrafts.length === 0;

  const kpiDeadline = phase?.schedules?.find(
    (s) => s.phase === 'kpi_selection' || s.phase === 'self' || s.phase === 'kpi',
  )?.dueDate;
  const deadlineStr = kpiDeadline
    ? new Date(kpiDeadline).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '미설정';

  const overallStatus =
    serverKpis.length === 0
      ? '작성중'
      : serverKpis.every((k) => k.status === 'confirmed')
        ? '확정'
        : serverKpis.some((k) => k.status === 'submitted' || k.status === 'approved')
          ? '제출완료'
          : serverKpis.some((k) => k.status === 'rejected')
            ? '반려'
            : '작성중';

  const weightTotal = effectiveDrafts.reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const coreTotal = effectiveDrafts.filter((d) => d.group === 'performance_core').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const growthTotal = effectiveDrafts.filter((d) => d.group === 'collaboration_growth').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const qualitativeTotal = effectiveDrafts.filter((d) => d.isQualitative).reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const lockedWeightTotal = lockedServer.reduce((acc, k) => acc + (k.weight ?? 0), 0);

  function updateDraft(idx: number, patch: Partial<DraftKpi>) {
    const base = drafts ?? editableServer.map(toDraft);
    if (patch.group && patch.group !== base[idx].group) {
      const targetCountExcludingSelf =
        base.filter((d, i) => i !== idx && d.group === patch.group).length +
        lockedServer.filter((k) => k.group === patch.group).length;
      if (targetCountExcludingSelf >= KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA) {
        toast.show({
          variant: 'danger',
          message: `${patch.group === 'performance_core' ? '성과중심' : '협업·성장'} 그룹은 최대 ${KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA}개까지 작성할 수 있어요.`,
        });
        return;
      }
    }
    const next = base.map((d, i) => {
      if (i !== idx) return d;
      const merged = { ...d, ...patch };
      if (patch.group && !CATEGORY_BY_GROUP[patch.group].includes(merged.category)) {
        merged.category = CATEGORY_BY_GROUP[patch.group][0];
      }
      return merged;
    });
    setDrafts(next);
  }

  function addDraftForGroup(g: KpiGroup) {
    if (!canAddToGroup(g)) return;
    const base = drafts ?? editableServer.map(toDraft);
    const draft = { ...emptyDraft(user?.role), group: g, category: CATEGORY_BY_GROUP[g][0] };
    setDrafts([...base, draft]);
  }

  function loadTemplate() {
    if (!template) return;
    const base = drafts ?? editableServer.map(toDraft);
    const fromTemplate: DraftKpi[] = template.items
      .filter((it) => isCategoryAllowed(it.category))
      .map((it) => ({
        group: it.group,
        category: it.category,
        measureType: 'qualitative' as MeasureType,
        coreStrategy: '',
        csf: it.sampleStrategy ?? '',
        title: '',
        targetText: '',
        measureMethod: '',
        targetValue: '',
        weight: it.defaultWeight ? String(it.defaultWeight) : '',
        isQualitative: it.isQualitative ?? false,
        useAbsoluteAmount: false,
        gradingCriteria: { ...EMPTY_GRADING },
      }));
    if (fromTemplate.length === 0) {
      toast.show({ variant: 'danger', message: '적용 가능한 양식 항목이 없어요.' });
      return;
    }
    setDrafts([...base, ...fromTemplate]);
    toast.show({ variant: 'success', message: `양식 ${fromTemplate.length}개 항목을 불러왔어요. 지표·목표를 입력해 주세요.` });
  }

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
      for (const d of effectiveDrafts) {
        if (!d.title.trim()) continue;
        const payload = draftToPayload(cycleId, d);
        if (d.id) await kpiCommands.update(d.id, payload);
        else await kpiCommands.create(payload);
      }
      toast.show({ variant: 'success', message: '임시저장 완료' });
      setDrafts(null);
      reload();
    } catch (err) {
      allOk = false;
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장 실패' });
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
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSubmitAll() {
    if (!cycleId || guardLocked()) return;
    setSubmitting(true);
    try {
      for (const d of effectiveDrafts) {
        const payload = draftToPayload(cycleId, d);
        if (d.id) await kpiCommands.update(d.id, payload);
        else await kpiCommands.create(payload);
      }
      const draftKpis = await fetchKpisByStatus(cycleId, user!.id, 'draft');
      for (const k of draftKpis) await kpiCommands.submit(k.id);
      toast.show({ variant: 'success', message: 'KPI를 제출했어요.' });
      setDrafts(null);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message || '가중치 합이 100%인지 확인해 주세요.'
            : err.code === 'CATEGORY_NOT_ALLOWED'
              ? '직급에서 허용하지 않는 카테고리가 있어요.'
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
    weightTotal === 100 &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  if (cyclesLoading || (kpiLoading && !data)) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const isStatusFinalized = overallStatus === '확정';
  const isStatusSubmitted = overallStatus === '제출완료';
  const completionStatusAccent = isStatusFinalized
    ? 'text-success-600'
    : isStatusSubmitted
      ? 'text-info-600'
      : undefined;

  return (
    <PageContainer>
      <PageHeader
        title="KPI 작성"
        subtitle={`${current.name} · 2026 목표·측정방식을 서술형으로 작성하고, 각 KPI를 정성/정량으로 구분하세요. 가중치 합 100%는 필수, 정성 비중은 30% 이하를 권장해요.`}
        right={
          submissionComplete ? (
            <HeaderMetrics
              items={[
                { label: '평가 대상자', value: user?.name ?? '나' },
                { label: '평가 기간', value: current.name },
                { label: '제출 기한', value: deadlineStr },
                { label: '현재 상태', value: overallStatus, accent: completionStatusAccent },
              ]}
            />
          ) : (
            <>
              <HeaderMetrics
                items={[
                  { label: '평가 대상자', value: user?.name ?? '나' },
                  { label: '평가 기간', value: current.name },
                ]}
              />
              {template && !isLocked && overallStatus !== '확정' && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<LayoutTemplate size={14} aria-hidden />}
                  onClick={loadTemplate}
                >
                  양식 불러오기
                </Button>
              )}
            </>
          )
        }
      />

      {/* 잠금 안내 */}
      {isLocked && (
        <InfoBanner tone="tip" title="작성 기간이 아닙니다">
          현재 KPI 작성 기간이 아닙니다. 작성 기간이 열리면 다시 수정할 수 있어요.
        </InfoBanner>
      )}

      {/* 컨텍스트 카드 행 */}
      {!submissionComplete && (
        <>
          {/* 가중치 요약 카드 */}
          <div className="rounded-lg border border-border bg-card shadow-elev-1 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">전체 가중치 합계</p>
              <div className="flex items-end gap-2">
                <span className={`tabular-nums text-[28px] font-extrabold leading-none ${weightTotal === 100 ? 'text-success-600' : weightTotal > 100 ? 'text-danger-600' : 'text-primary'}`}>
                  {weightTotal}
                </span>
                <span className="text-[15px] text-muted-foreground pb-0.5">/ 100%</span>
              </div>
            </div>
            {/* 도넛 SVG */}
            <WeightDonut weight={weightTotal} />
          </div>
        </>
      )}

      {/* 제출 완료 모드: 확정 과제 섹션 */}
      {submissionComplete && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              제출·확정된 과제
            </span>
            <span className="text-[12px] text-muted-foreground">
              총 가중치: <span className="text-primary font-bold tabular-nums">{lockedWeightTotal}%</span> / 100%
            </span>
          </div>
          {lockedServer.map((k, idx) => (
            <KpiLockedCard
              key={k.id}
              kpi={k}
              index={idx}
              scales={ruleSet?.gradingScales}
              collapsed={!expandedLocked[k.id]}
              onToggle={() => toggleLocked(k.id)}
            />
          ))}
        </div>
      )}

      {/* 편집 모드: KPI 카드 목록 */}
      {!submissionComplete && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[14px] font-bold text-foreground">작성한 KPI</h3>
              <span className="text-[12px] text-muted-foreground">{effectiveDrafts.length}개 항목</span>
            </div>
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                <span className="text-muted-foreground">성과중심</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-success-600 inline-block" />
                <span className="text-muted-foreground">협업·성장</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {effectiveDrafts.length === 0 ? (
              <EmptyState
                title="아직 작성한 KPI가 없어요."
                description={`아래 '항목 추가'로 첫 KPI를 만들어 보세요${template ? '. 또는 상단 양식 불러오기로 시작할 수 있어요' : ''}.`}
              />
            ) : (
              effectiveDrafts.map((d, idx) => (
                <KpiDraftCard
                  key={d.id ?? `new-${idx}`}
                  index={idx}
                  draft={d}
                  isGroupAllowed={isGroupAllowed}
                  onChange={(patch) => updateDraft(idx, patch)}
                  onDelete={() => setDeleteTarget(idx)}
                />
              ))
            )}

            {/* 그룹별 추가 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((g) => {
                const cnt = groupCount[g];
                const maxCnt = KPI_GROUP_BASE[g] + KPI_GROUP_MAX_EXTRA;
                const label = g === 'performance_core' ? '성과중심' : '협업·성장';
                const accentCls = g === 'performance_core' ? 'border-primary/40 text-primary hover:border-primary' : 'border-success-500/40 text-success-700 hover:border-success-500';
                const blocked = isLocked || overallStatus === '확정' || !canAddToGroup(g) || !isGroupAllowed(g);
                return (
                  <button
                    key={g}
                    onClick={() => addDraftForGroup(g)}
                    disabled={blocked}
                    type="button"
                    className={`flex flex-col items-center justify-center gap-1.5 w-full rounded-xl border-2 border-dashed bg-card py-4 text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${blocked ? 'border-border text-muted-foreground' : accentCls}`}
                  >
                    <PlusCircle size={20} aria-hidden />
                    <span>{label} 추가</span>
                    <span className="text-[11px] text-muted-foreground">{cnt} / {maxCnt}개</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 하단 고정 액션 바 */}
          <BottomActionBar
            weightTotal={weightTotal}
            qualitativeTotal={qualitativeTotal}
            canSubmit={canSubmit}
            savingAll={savingAll}
            submitting={submitting}
            draftsEmpty={effectiveDrafts.length === 0}
            isLocked={isLocked}
            onSave={() => void handleSaveAll()}
            onSubmit={() => void handleSubmitAll()}
          />

          {/* 참고 체크리스트 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] pb-16">
            <ChecklistItem ok={weightTotal === 100}>
              가중치 합 {weightTotal}% (100%)
            </ChecklistItem>
            <span className="text-muted-foreground">· 참고: 성과중심 {coreTotal}% · 협업·성장 {growthTotal}%</span>
            <span className={qualitativeTotal > 30 ? 'text-warning-600' : 'text-muted-foreground'}>
              · 정성 비중 {qualitativeTotal}% (권장 ≤30%)
            </span>
          </div>
        </>
      )}

      {/* 스냅샷 diff 패널 */}
      {latestSnapshot && snapshotDiff && (
        <KpiDiffPanel
          label={snapshotDiff.label}
          createdAt={snapshotDiff.createdAt}
          added={snapshotDiff.added}
          removed={snapshotDiff.removed}
          changed={snapshotDiff.changed}
          unchangedCount={snapshotDiff.unchangedCount}
        />
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="과제를 삭제할까요?"
        primaryAction={{ label: '삭제', variant: 'danger', onClick: () => void confirmDelete() }}
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
      >
        삭제하면 작성한 내용이 사라져요.
      </Modal>
    </PageContainer>
  );
}

// ─── 가중치 도넛 SVG ─────────────────────────────────────────────
function WeightDonut({ weight }: { weight: number }) {
  const r = 18;
  const c = 22;
  const circumference = 2 * Math.PI * r;
  const fill = Math.min(weight, 100) / 100;
  const dash = fill * circumference;
  const color = weight === 100 ? '#16a34a' : weight > 100 ? '#e5484d' : '#7A37D8';
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#efeff2" strokeWidth={5} />
      <circle
        cx={c} cy={c} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="butt"
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text x={c} y={c + 4} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: color, fontFamily: 'inherit' }}>
        {weight}%
      </text>
    </svg>
  );
}

function KpiSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </PageContainer>
  );
}
