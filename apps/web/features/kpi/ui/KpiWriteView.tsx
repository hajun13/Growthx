'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Send, Check, LayoutTemplate, PlusCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
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
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import type {
  Kpi,
  KpiGroup,
  KpiCategory,
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

const EMPTY_GRADING: GradingDraft = { S: '', A: '', B: '', C: '', D: '' };

// ── 헬퍼 함수 ────────────────────────────────────────────────────
function toDraft(k: Kpi): DraftKpi {
  return {
    id: k.id,
    rejectReason: k.rejectReason ?? null,
    group: k.group,
    category: k.category,
    coreStrategy: k.coreStrategy ?? '',
    csf: k.csf ?? '',
    title: k.title,
    targetText: k.targetText ?? '',
    measureMethod: k.measureMethod ?? '',
    weight: String(k.weight),
    isQualitative: k.isQualitative,
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
    coreStrategy: '',
    csf: '',
    title: '',
    targetText: '',
    measureMethod: '',
    weight: '',
    isQualitative: false,
    gradingCriteria: { ...EMPTY_GRADING },
  };
}

// BUG-A(클리어 불가): 전량 비워도 undefined(미전송=기존값 유지)가 아니라 5밴드 객체를
// 항상 전송한다 — "전송했지만 빈 값 = 클리어 의도". 백엔드가 전 밴드 빈 값이면 null 로 정규화.
function gradingToPayload(g: GradingDraft): KpiGradingCriteria {
  return {
    S: g.S.trim() || null,
    A: g.A.trim() || null,
    B: g.B.trim() || null,
    C: g.C.trim() || null,
    D: g.D.trim() || null,
  };
}

/**
 * create/update 공통 필드. **cycleId 는 넣지 않는다** — UpdateKpiDto 에 없어서
 * PATCH 에 실으면 whitelist 가 조용히 버린다(forbidNonWhitelisted 를 켜면 400).
 * 생성 시에는 draftToCreatePayload 가 cycleId 를 얹는다.
 */
function draftToPayload(d: DraftKpi): Omit<CreateKpiRequest, 'cycleId'> {
  // 제품 결정(2026-07-07): 전 KPI 서술형 — 절대금액 기준 등급(useAbsoluteAmount) 생성 경로 제거.
  // measureType 은 항상 qualitative, useAbsoluteAmount 는 항상 false 로 전송한다.
  return {
    group: d.group,
    category: d.category,
    measureType: 'qualitative',
    // BUG-A: 빈 값도 그대로 전송(`|| undefined` 로 미전송 처리하면 지운 값이 서버에서 부활).
    // 백엔드가 빈 문자열을 null(클리어)로 정규화한다.
    coreStrategy: d.coreStrategy,
    csf: d.csf,
    title: d.title,
    targetText: d.targetText.trim(),
    measureMethod: d.measureMethod.trim(),
    // BUG-A: 목표 금액 입력이 사라졌으므로 항상 null(클리어) 전송 — 잔존 값 부활 방지.
    // 계약 타입(number|undefined)에는 null 클리어 표현이 없어 국소 캐스트(백엔드 DTO 는 number|null 수용).
    targetValue: null as unknown as number | undefined,
    weight: Number(d.weight) || 0,
    isQualitative: d.isQualitative,
    useAbsoluteAmount: false,
    gradingCriteria: gradingToPayload(d.gradingCriteria),
  };
}

/** 생성 전용 — cycleId 는 CreateKpiDto 에만 있다. */
function draftToCreatePayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  return { cycleId, ...draftToPayload(d) };
}

// ─── 제출·확정된 과제 섹션 (편집/완료 모드 공용) ─────────────────
function LockedKpiSection({
  kpis,
  weightTotal,
  scales,
  expanded,
  onToggle,
}: {
  kpis: Kpi[];
  weightTotal: number;
  scales?: Parameters<typeof KpiLockedCard>[0]['scales'];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          제출·확정된 과제
        </span>
        <span className="text-[12px] text-muted-foreground">
          총 가중치: <span className="text-primary font-bold tabular-nums">{weightTotal}%</span> / 100%
        </span>
      </div>
      <div className="space-y-4 rounded-lg bg-muted/40 p-4">
        {kpis.map((k, idx) => (
          <KpiLockedCard
            key={k.id}
            kpi={k}
            index={idx}
            scales={scales}
            collapsed={!expanded[k.id]}
            onToggle={() => onToggle(k.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── 하단 고정 액션 바 ────────────────────────────────────────────
function BottomActionBar({
  weightTotal,
  lockedWeightTotal,
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
  lockedWeightTotal: number;
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
  // 부분 반려 시나리오: 확정(locked) 가중치 + 작성중(draft) 가중치의 합이 제출 게이트.
  // draft 만 100%를 요구하면 확정 90% + 반려 10% 재작성 케이스에서 제출이 영구 불가해진다.
  const combinedTotal = weightTotal + lockedWeightTotal;
  const weightOk = combinedTotal === 100;
  const weightColor = weightOk ? 'text-success-600' : combinedTotal > 100 ? 'text-danger-600' : 'text-warning-600';

  return (
    <EvaluationActionPanel
      sticky
      message={
        weightOk
          ? '제출 가능한 가중치입니다.'
          : combinedTotal > 100
            ? '전체 가중치가 100%를 초과했어요.'
            : '전체 가중치를 100%로 맞춰야 제출할 수 있어요.'
      }
      summary={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
          <span>
            전체 가중치{' '}
            {lockedWeightTotal > 0 ? (
              <>
                <span className="tabular-nums">작성중 {weightTotal}%</span>
                <span> + </span>
                <span className="tabular-nums">확정 {lockedWeightTotal}%</span>
                <span> = </span>
                <b className={`tabular-nums ${weightColor}`}>{combinedTotal}%</b>
              </>
            ) : (
              <b className={`tabular-nums ${weightColor}`}>{weightTotal}%</b>
            )}
            <span className="text-muted-foreground"> / 100%</span>
          </span>
          <span>
            정성 KPI{' '}
            <b className={`tabular-nums ${qualitativeOver ? 'text-warning-600' : 'text-foreground'}`}>
              {qualitativeTotal}%
            </b>
            <span className="text-muted-foreground"> / 권장 30%</span>
          </span>
        </div>
      }
      actions={
        <>
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
        </>
      }
    />
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

function KpiBalancePanel({
  weightTotal,
  lockedWeightTotal,
  coreTotal,
  growthTotal,
  qualitativeTotal,
  draftCount,
  lockedCount,
}: {
  weightTotal: number;
  lockedWeightTotal: number;
  coreTotal: number;
  growthTotal: number;
  qualitativeTotal: number;
  draftCount: number;
  lockedCount: number;
}) {
  // 제출 게이트와 동일하게 확정(locked)+작성중(draft) 합산으로 검토한다.
  const combinedTotal = weightTotal + lockedWeightTotal;
  const weightColor = combinedTotal === 100 ? 'text-success-700' : combinedTotal > 100 ? 'text-danger-700' : 'text-foreground';
  const qualityColor = qualitativeTotal > 30 ? 'text-warning-700' : 'text-muted-foreground';
  const progressTone = combinedTotal === 100 ? 'bg-success-600' : combinedTotal > 100 ? 'bg-danger-600' : 'bg-primary';
  const progressWidth = `${Math.min(combinedTotal, 100)}%`;
  const weightMessage =
    combinedTotal === 100
      ? '제출 가능한 가중치입니다'
      : combinedTotal > 100
        ? `${combinedTotal - 100}% 초과되었습니다`
        : `${100 - combinedTotal}% 더 배분해야 합니다`;

  return (
    <section className="gx-panel overflow-hidden">
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-border px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="gx-muted-label">가중치 검토</p>
              <div className="mt-2 flex items-end gap-1.5">
                <span className={`text-[34px] font-bold leading-none tabular-nums ${weightColor}`}>
                  {combinedTotal}
                </span>
                <span className="pb-1 text-[13px] font-semibold text-muted-foreground">/ 100%</span>
              </div>
              {lockedWeightTotal > 0 && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground tabular-nums">
                  작성중 {weightTotal}% + 확정 {lockedWeightTotal}% = {combinedTotal}%
                </p>
              )}
            </div>
            <WeightDonut weight={combinedTotal} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${progressTone}`} style={{ width: progressWidth }} />
          </div>
          <p className={`mt-3 text-[12px] font-semibold ${weightColor}`}>{weightMessage}</p>
        </div>

        <div className="divide-y divide-border px-5 py-3">
          <KpiReviewLine
            label="그룹 구성"
            value={`${coreTotal}% / ${growthTotal}%`}
            description="성과중심 / 협업·성장"
          />
          <KpiReviewLine
            label="정성 비중"
            value={`${qualitativeTotal}%`}
            valueClassName={qualityColor}
            description="권장 30% 이하"
          />
          <KpiReviewLine
            label="작성 상태"
            value={`${draftCount}개 작성`}
            description={lockedCount > 0 ? `${lockedCount}개 제출·확정` : '제출 전'}
          />
        </div>
      </div>
    </section>
  );
}

function KpiReviewLine({
  label,
  value,
  description,
  valueClassName = 'text-foreground',
}: {
  label: string;
  value: string;
  description: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid min-h-[44px] grid-cols-1 gap-1 py-3 sm:grid-cols-[116px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <p className="gx-muted-label">{label}</p>
      <p className="truncate text-[12px] font-medium text-muted-foreground">{description}</p>
      <p className={`text-[15px] font-bold tabular-nums sm:text-right ${valueClassName}`}>{value}</p>
    </div>
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
  // 미저장 편집 여부 — 이탈(beforeunload) 경고용. 저장/제출 전량 성공 시 해제.
  const [dirty, setDirty] = useState(false);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);

  useEffect(() => {
    if (!dirty || isLocked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, isLocked]);

  // BUG-B(저장 직후 stale): 저장 성공 시 drafts 를 즉시 null 로 비우면 reload 응답 전까지
  // effectiveDrafts 가 저장 전 스냅샷(editableServer)으로 파생돼 방금 저장한 값이 사라져
  // 보이고, 그 창에서 재저장하면 stale draft 로 구값을 덮어쓴다. 저장본을 유지하다가
  // reload 응답(data 갱신)이 도착한 시점에, 그 사이 사용자가 편집하지 않았을 때만 정리한다.
  const clearDraftsOnReloadRef = useRef<DraftKpi[] | null>(null);
  useEffect(() => {
    const pending = clearDraftsOnReloadRef.current;
    if (!pending || !data) return;
    clearDraftsOnReloadRef.current = null;
    // reload 대기 중 편집이 있었으면(drafts 참조가 바뀜) 사용자 편집을 보존한다.
    setDrafts((prev) => (prev === pending ? null : prev));
  }, [data]);
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
  // 기한 임박(D-3 이내 또는 경과) 시 danger 강조.
  const deadlineImminent =
    !!kpiDeadline && new Date(kpiDeadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const overallStatus =
    serverKpis.length === 0
      ? '작성중'
      : serverKpis.every((k) => k.status === 'confirmed')
        ? '확정'
        : serverKpis.some((k) => k.status === 'submitted' || k.status === 'approved')
          ? '결재 진행중'
          : // 백엔드 reject 는 status 를 'draft' + rejectReason 으로 되돌린다('rejected' 상태 없음).
            serverKpis.some(
              (k) => k.status === 'rejected' || (k.status === 'draft' && k.rejectReason != null),
            )
            ? '반려'
            : '작성중';

  const weightTotal = effectiveDrafts.reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const coreTotal = effectiveDrafts.filter((d) => d.group === 'performance_core').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const growthTotal = effectiveDrafts.filter((d) => d.group === 'collaboration_growth').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const qualitativeTotal = effectiveDrafts.filter((d) => d.isQualitative).reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const lockedWeightTotal = lockedServer.reduce((acc, k) => acc + (k.weight ?? 0), 0);
  // 제출 게이트 = 확정(locked) + 작성중(draft) 가중치 합 — 백엔드 검증(siblings 전체 합산)과 정합.
  const combinedTotal = weightTotal + lockedWeightTotal;

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
    setDirty(true);
  }

  function addDraftForGroup(g: KpiGroup) {
    if (!canAddToGroup(g)) return;
    const base = drafts ?? editableServer.map(toDraft);
    const draft = { ...emptyDraft(user?.role), group: g, category: CATEGORY_BY_GROUP[g][0] };
    setDrafts([...base, draft]);
    setDirty(true);
  }

  // 양식 적용 — 그룹별 잔여 슬롯만큼만 추가(중복 적재로 상한 초과 방지), 초과분은 토스트 안내.
  function applyTemplate() {
    if (!template) return;
    setTemplateConfirmOpen(false);
    const base = drafts ?? editableServer.map(toDraft);
    const remaining: Record<KpiGroup, number> = {
      performance_core: Math.max(0, KPI_GROUP_BASE.performance_core + KPI_GROUP_MAX_EXTRA - groupCount.performance_core),
      collaboration_growth: Math.max(0, KPI_GROUP_BASE.collaboration_growth + KPI_GROUP_MAX_EXTRA - groupCount.collaboration_growth),
    };
    const accepted: DraftKpi[] = [];
    let skipped = 0;
    for (const it of template.items) {
      if (remaining[it.group] <= 0) {
        skipped++;
        continue;
      }
      remaining[it.group]--;
      accepted.push({
        group: it.group,
        category: it.category,
        coreStrategy: '',
        csf: it.sampleStrategy ?? '',
        title: '',
        targetText: '',
        measureMethod: '',
        weight: it.defaultWeight ? String(it.defaultWeight) : '',
        isQualitative: it.isQualitative ?? false,
        gradingCriteria: { ...EMPTY_GRADING },
      });
    }
    if (accepted.length === 0) {
      toast.show({
        variant: 'danger',
        message: skipped > 0 ? '그룹별 작성 상한이 이미 가득 차 양식을 추가할 수 없어요.' : '적용 가능한 양식 항목이 없어요.',
      });
      return;
    }
    setDrafts([...base, ...accepted]);
    setDirty(true);
    toast.show({
      variant: 'success',
      message:
        skipped > 0
          ? `양식 ${accepted.length}개 항목을 불러왔어요. 그룹 상한 초과 ${skipped}개는 제외했어요.`
          : `양식 ${accepted.length}개 항목을 불러왔어요. 지표·목표를 입력해 주세요.`,
    });
  }

  function loadTemplate() {
    if (!template) return;
    // 이미 작성 중인 드래프트가 있으면 확인 후 추가(무심코 중복 적재 방지).
    if (effectiveDrafts.length > 0) {
      setTemplateConfirmOpen(true);
      return;
    }
    applyTemplate();
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
    // create 성공분의 서버 id 를 즉시 반영 — 부분 실패 후 재시도해도 중복 생성되지 않는다.
    const base = effectiveDrafts.map((d) => ({ ...d }));
    const untitledCount = base.filter((d) => !d.title.trim()).length;
    let allOk = true;
    try {
      for (let i = 0; i < base.length; i++) {
        const d = base[i];
        if (!d.title.trim()) continue; // 미제목은 저장 skip — 화면에는 보존한다.
        if (d.id) {
          await kpiCommands.update(d.id, draftToPayload(d));
        } else {
          const created = await kpiCommands.create(draftToCreatePayload(cycleId, d));
          if (created?.id) base[i] = { ...d, id: created.id };
        }
      }
    } catch (err) {
      allOk = false;
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장 실패' });
    } finally {
      setSavingAll(false);
    }
    // 실패분·미제목(미저장) 드래프트를 화면에 보존 + 생성된 id 유지(재시도 시 update 경로).
    // BUG-B: 전량 성공 시에도 즉시 null 로 비우지 않고 저장본(base)을 유지 — reload 응답이
    // 도착하면 위 useEffect 가 정리한다(응답 전 재저장이 구값을 덮어쓰는 창 제거).
    setDrafts(base);
    if (allOk && untitledCount === 0) {
      clearDraftsOnReloadRef.current = base;
      setDirty(false);
    }
    if (allOk) {
      toast.show({
        variant: 'success',
        message:
          untitledCount > 0
            ? `임시저장 완료 — 제목 없는 ${untitledCount}개는 제목을 입력해야 저장돼요.`
            : '임시저장 완료',
      });
    }
    reload();
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
    // create 성공분의 서버 id 를 즉시 반영 — 중간 실패 후 재시도 시 중복 생성 방지.
    const base = effectiveDrafts.map((d) => ({ ...d }));
    try {
      for (let i = 0; i < base.length; i++) {
        const d = base[i];
        if (d.id) {
          await kpiCommands.update(d.id, draftToPayload(d));
        } else {
          const created = await kpiCommands.create(draftToCreatePayload(cycleId, d));
          if (created?.id) base[i] = { ...d, id: created.id };
        }
      }
      const draftKpis = await fetchKpisByStatus(cycleId, user!.id, 'draft');
      for (const k of draftKpis) await kpiCommands.submit(k.id);
      toast.show({ variant: 'success', message: 'KPI를 제출했어요.' });
      // BUG-B: 즉시 null 로 비우면 reload 전까지 저장 전 스냅샷이 보인다 — 제출본을 유지하고
      // reload 응답 도착 시 useEffect 가 정리(제출완료 모드로 전환)한다.
      setDrafts(base);
      clearDraftsOnReloadRef.current = base;
      setDirty(false);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message || '가중치 합이 100%인지 확인해 주세요.'
            : err.code === 'PERIOD_LOCKED'
              ? '현재 KPI 작성 기간이 아닙니다.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
      setDrafts(base); // 이미 생성된 KPI 의 id 를 보존해 재시도 시 재생성을 막는다.
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !isLocked &&
    overallStatus !== '확정' &&
    effectiveDrafts.length > 0 &&
    // 확정(locked) 가중치 포함 합산 100% — draft 만 100% 요구하면 부분 반려 후 재제출 불가.
    combinedTotal === 100 &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  if (cyclesLoading || (kpiLoading && !data)) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const isStatusFinalized = overallStatus === '확정';
  const isStatusSubmitted = overallStatus === '결재 진행중';
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
                  {
                    label: '제출 기한',
                    value: deadlineStr,
                    accent: deadlineImminent ? 'text-danger-600' : undefined,
                  },
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
          <KpiBalancePanel
            weightTotal={weightTotal}
            lockedWeightTotal={lockedWeightTotal}
            coreTotal={coreTotal}
            growthTotal={growthTotal}
            qualitativeTotal={qualitativeTotal}
            draftCount={effectiveDrafts.length}
            lockedCount={lockedServer.length}
          />
        </>
      )}

      {/* 제출 완료 모드: 확정 과제 섹션 */}
      {submissionComplete && (
        <LockedKpiSection
          kpis={lockedServer}
          weightTotal={lockedWeightTotal}
          scales={ruleSet?.gradingScales}
          expanded={expandedLocked}
          onToggle={toggleLocked}
        />
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
                <span className="inline-block size-2 rounded-sm bg-primary" />
                <span className="text-muted-foreground">성과중심</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-sm bg-foreground" />
                <span className="text-muted-foreground">협업·성장</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-4">
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
                const accentCls = 'border-border text-foreground hover:border-primary hover:bg-muted/60';
                const blocked = isLocked || overallStatus === '확정' || !canAddToGroup(g);
                return (
                  <button
                    key={g}
                    onClick={() => addDraftForGroup(g)}
                    disabled={blocked}
                    type="button"
                    className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-card py-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${blocked ? 'border-border text-muted-foreground' : accentCls}`}
                  >
                    <PlusCircle size={20} aria-hidden />
                    <span>{label} 추가</span>
                    <span className="text-[11px] text-muted-foreground">{cnt} / {maxCnt}개</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제출·확정된 과제 — 편집 모드에서도 접힌 카드로 상시 노출(전체 구성·가중치 파악용) */}
          {lockedServer.length > 0 && (
            <LockedKpiSection
              kpis={lockedServer}
              weightTotal={lockedWeightTotal}
              scales={ruleSet?.gradingScales}
              expanded={expandedLocked}
              onToggle={toggleLocked}
            />
          )}

          {/* 하단 고정 액션 바 */}
          <BottomActionBar
            weightTotal={weightTotal}
            lockedWeightTotal={lockedWeightTotal}
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
            <ChecklistItem ok={combinedTotal === 100}>
              가중치 합 {lockedWeightTotal > 0 ? `${weightTotal}% + 확정 ${lockedWeightTotal}% = ${combinedTotal}%` : `${weightTotal}%`} (100%)
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

      {/* 양식 불러오기 확인 — 드래프트 존재 시 중복 적재 방지 */}
      <Modal
        open={templateConfirmOpen}
        onClose={() => setTemplateConfirmOpen(false)}
        title="양식을 추가로 불러올까요?"
        primaryAction={{ label: '불러오기', variant: 'primary', onClick: applyTemplate }}
        secondaryAction={{ label: '취소', onClick: () => setTemplateConfirmOpen(false) }}
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          작성 중인 KPI {effectiveDrafts.length}개는 그대로 두고 양식 항목을 뒤에 추가해요.
          그룹별 작성 상한을 넘는 항목은 제외돼요.
        </p>
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
  const color = weight === 100 ? 'var(--gx-success)' : weight > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={5} />
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
