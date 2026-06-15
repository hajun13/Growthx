'use client';

import React, { useMemo, useState } from 'react';
import { Trash2, Info, Save, Send, Check, LayoutTemplate, History, PlusCircle } from 'lucide-react';
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
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeLabel } from '@/lib/ui';
import { T } from '@/lib/toss';
import { gradeColor } from '@/lib/grade';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type {
  Kpi,
  Grade,
  KpiGroup,
  KpiCategory,
  MeasureType,
  CreateKpiRequest,
  KpiGradingCriteria,
  KpiDiffItem,
  KpiDiffField,
} from '@/lib/types';
import { useKpisData } from '../hooks';
import { kpiCommands, fetchKpisByStatus } from '../api';

// 그룹별 허용 카테고리(domain-model §3) — payload 전송용 내부 매핑.
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};

// 그룹별 기본 KPI 수(고정) + 추가 가능 최대 1개.
const KPI_GROUP_BASE: Record<KpiGroup, number> = {
  performance_core: 4,
  collaboration_growth: 2,
};
const KPI_GROUP_MAX_EXTRA = 1;

// 카테고리 컬럼(기존 그룹) — 파랑 vs 초록으로 명확히 구분.
const GROUP_CFG: Record<
  KpiGroup,
  { label: string; bg: string; hover: string; color: string }
> = {
  performance_core: { label: '성과중심', bg: '#1B64DA', hover: '#1255c0', color: '#fff' },
  collaboration_growth: { label: '협업·성장', bg: '#029359', hover: '#017a4a', color: '#fff' },
};

// 등급 부여 기준(S~D) 입력 — 빈 문자열 = 미작성.
interface GradingDraft {
  S: string;
  A: string;
  B: string;
  C: string;
  D: string;
}
const EMPTY_GRADING: GradingDraft = { S: '', A: '', B: '', C: '', D: '' };
const GRADE_KEYS: (keyof GradingDraft)[] = ['S', 'A', 'B', 'C', 'D'];

interface DraftKpi {
  id?: string;
  group: KpiGroup;
  category: KpiCategory;
  measureType: MeasureType;
  coreStrategy: string;
  csf: string;
  title: string;
  // 자유 텍스트 목표(엑셀 "2026 목표").
  targetText: string;
  // 측정방식 서술(measureType enum 과 별개).
  measureMethod: string;
  targetValue: string;
  weight: string;
  isQualitative: boolean;
  // 갭 #2 — 매출(revenue) 정량 KPI에서 "절대금액 기준 등급" 사용 여부. 켜면 measureType=amount로 전송.
  useAbsoluteAmount: boolean;
  // 등급 부여 기준 S/A/B/C/D 서술.
  gradingCriteria: GradingDraft;
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

// employee는 revenue/construction/orders 작성 불가 → collaboration 그룹으로 시작.
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

// 등급기준 draft → payload: 모든 칸이 비어 있으면 undefined(미전송), 아니면 null/문자열.
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

// 갭 #2 진입 조건 — 매출(revenue) 정량 KPI에서만 "절대금액 기준 등급"이 의미가 있다.
function canUseAbsoluteAmount(d: Pick<DraftKpi, 'category' | 'isQualitative'>): boolean {
  return d.category === 'revenue' && !d.isQualitative;
}

function draftToPayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  const useAbs = canUseAbsoluteAmount(d) && d.useAbsoluteAmount;
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

// 카드 공통 스타일
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid rgba(202,196,210,0.5)',
  boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
};

export default function KpiWriteView() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    current,
    loading: cyclesLoading,
  } = useCurrentCycle();
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

  const { data, loading: kpiLoading, error, reload } = useKpisData(
    cycleId,
    user?.id,
  );

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

  const effectiveDrafts = useMemo(
    () => drafts ?? editableServer.map(toDraft),
    [drafts, editableServer],
  );

  // 그룹별 현재 KPI 수(draft + locked 합산).
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

  // 제출/확정으로 더 이상 작성할 draft가 없는 상태
  const submissionComplete = lockedServer.length > 0 && effectiveDrafts.length === 0;

  // ── Info bar 값 ────────────────────────────────────────────
  const kpiDeadline = phase?.schedules?.find(
    (s) =>
      s.phase === 'kpi_selection' ||
      s.phase === 'self' ||
      s.phase === 'kpi',
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
        ? '#0054ca'
        : overallStatus === '반려'
          ? '#f04452'
          : '#4e5968';

  function updateDraft(idx: number, patch: Partial<DraftKpi>) {
    const base = drafts ?? editableServer.map(toDraft);

    // 그룹 변경 시 대상 그룹 한도 초과 방지.
    if (patch.group && patch.group !== base[idx].group) {
      const targetCountExcludingSelf =
        base.filter((d, i) => i !== idx && d.group === patch.group).length +
        lockedServer.filter((k) => k.group === patch.group).length;
      if (targetCountExcludingSelf >= KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA) {
        toast.show({
          variant: 'danger',
          message: `${GROUP_CFG[patch.group].label} 그룹은 최대 ${KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA}개까지 작성할 수 있어요.`,
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
    toast.show({
      variant: 'success',
      message: `양식 ${fromTemplate.length}개 항목을 불러왔어요. 지표·목표를 입력해 주세요.`,
    });
  }

  const weightTotal = effectiveDrafts.reduce(
    (acc, d) => acc + (Number(d.weight) || 0),
    0,
  );
  const coreTotal = effectiveDrafts
    .filter((d) => d.group === 'performance_core')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const growthTotal = effectiveDrafts
    .filter((d) => d.group === 'collaboration_growth')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const qualitativeTotal = effectiveDrafts
    .filter((d) => d.isQualitative)
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const qualitativeOver = qualitativeTotal > 30;

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
      const draftKpis = await fetchKpisByStatus(cycleId, user!.id, 'draft');
      for (const k of draftKpis) await kpiCommands.submit(k.id);
      toast.show({ variant: 'success', message: 'KPI를 제출했어요.' });
      setDrafts(null);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message ||
              '가중치 합이 100%인지 확인해 주세요.'
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
    weightTotal === 100 &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  // 스켈레톤은 첫 로딩에만 — 저장·제출 후 reload 때 전체 교체되면 스크롤이 맨 위로 튐.
  if (cyclesLoading || (kpiLoading && !data)) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const weightColor =
    weightTotal === 100 ? T.green500 : weightTotal > 100 ? T.red500 : T.orange500;

  // 가중치 도넛 SVG 파라미터
  const donutR = 18;
  const donutC = 22;
  const donutCircum = 2 * Math.PI * donutR;
  const donutFill = Math.min(weightTotal, 100) / 100;
  const donutDash = donutFill * donutCircum;
  const donutColor = weightTotal === 100 ? T.green500 : weightTotal > 100 ? T.red500 : '#0054ca';

  // 총 가중치(locked 기준)
  const lockedWeightTotal = lockedServer.reduce((acc, k) => acc + (k.weight ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="KPI 작성"
        subtitle={`${current.name} · 2026 목표·측정방식을 서술형으로 작성하고, 각 KPI를 정성/정량으로 구분하세요. 가중치 합 100%는 필수, 정성 비중은 30% 이하를 권장해요.`}
        right={submissionComplete ? undefined : (
          <>
            {template && !isLocked && overallStatus !== '확정' && (
              <button
                onClick={loadTemplate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  color: '#3182f6',
                  border: '1px solid #c6dcff',
                  background: '#f2f6ff',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <LayoutTemplate size={13} /> 양식 불러오기
              </button>
            )}
          </>
        )}
      />

      {/* 잠금 안내 */}
      {isLocked && (
        <div className="flex items-center gap-2 p-3" style={{ background: '#fff8ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
          <Info size={14} color={T.orange500} />
          <span style={{ fontSize: 12, color: '#f57800' }}>
            현재 KPI 작성 기간이 아닙니다. 작성 기간이 열리면 다시 수정할 수 있어요.
          </span>
        </div>
      )}

      {/* ─── 컨텍스트 카드 행 (4컬럼) ─── */}
      {submissionComplete ? (
        /* 제출 완료 모드: 연한 배경 컨테이너 안에 흰 카드 4장 */
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl"
          style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.5)' }}
        >
          {[
            { label: '평가 대상자', value: user?.name ?? '나' },
            { label: '평가 기간', value: current.name },
            { label: '제출 기한', value: deadlineStr },
            { label: '현재 상태', value: overallStatus, highlight: true },
          ].map((info, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 rounded-xl p-6"
              style={{ background: '#fff', border: '1px solid rgba(202,196,210,0.5)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <span
                style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {info.label}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: info.highlight ? statusColor : '#191c1f',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {info.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* 편집 모드: 4컬럼 카드 행 — 가중치 카드는 2컬럼 */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 평가 대상자 */}
          <div className="p-4 rounded-xl" style={cardStyle}>
            <div style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}>평가 대상자</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3f2c80' }}>{user?.name ?? '나'}</div>
          </div>
          {/* 평가 기간 */}
          <div className="p-4 rounded-xl" style={cardStyle}>
            <div style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}>평가 기간</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{current.name}</div>
          </div>
          {/* 전체 가중치 합계 — 2컬럼 폭 + 도넛 */}
          <div
            className="col-span-2 p-4 rounded-xl flex items-center justify-between"
            style={cardStyle}
          >
            <div>
              <div style={{ fontSize: 11, color: T.grey500, marginBottom: 4 }}>전체 가중치 합계</div>
              <div className="flex items-end gap-2">
                <span
                  className="tabular-nums"
                  style={{ fontSize: 28, fontWeight: 800, color: donutColor, lineHeight: 1 }}
                >
                  {weightTotal}
                </span>
                <span style={{ fontSize: 15, color: T.grey500, paddingBottom: 2 }}>/ 100%</span>
              </div>
            </div>
            {/* SVG 도넛 */}
            <svg width={44} height={44} viewBox="0 0 44 44">
              <circle cx={donutC} cy={donutC} r={donutR} fill="none" stroke="#f2f3f7" strokeWidth={5} />
              <circle
                cx={donutC} cy={donutC} r={donutR}
                fill="none"
                stroke={donutColor}
                strokeWidth={5}
                strokeDasharray={`${donutDash} ${donutCircum}`}
                strokeLinecap="butt"
                transform={`rotate(-90 ${donutC} ${donutC})`}
              />
              <text x={donutC} y={donutC + 4} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: donutColor, fontFamily: 'inherit' }}>
                {weightTotal}%
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* ─── 제출 완료 모드: 확정 과제 섹션 ─── */}
      {submissionComplete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between" style={{ paddingBottom: 8, borderBottom: '1px solid #cac4d2' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              제출·확정된 과제
            </span>
            <span style={{ fontSize: 12, color: T.grey500 }}>
              Total Weight:{' '}
              <span style={{ color: '#0054ca', fontWeight: 700 }} className="tabular-nums">
                {lockedWeightTotal}%
              </span>
              {' '}/ 100%
            </span>
          </div>

          {/* KPI 카드 목록 — 전부 상세형(Item 1 스타일) */}
          {lockedServer.map((k, idx) => (
            <LockedKpiCard key={k.id} kpi={k} index={idx} scales={ruleSet?.gradingScales} />
          ))}
        </div>
      )}

      {/* ─── 편집 모드: KPI 카드 목록 ─── */}
      {!submissionComplete && (
        <>
          {/* 섹션 헤더 + 그룹 범례 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>작성한 KPI</h3>
              <span style={{ fontSize: 12, color: T.grey500 }}>{effectiveDrafts.length}개 항목</span>
            </div>
            <div className="flex items-center gap-3" style={{ fontSize: 11.5 }}>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 9, height: 9, background: GROUP_CFG.performance_core.bg, borderRadius: 2, display: 'inline-block' }} />
                <span style={{ color: T.grey600 }}>성과중심</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 9, height: 9, background: GROUP_CFG.collaboration_growth.bg, borderRadius: 2, display: 'inline-block' }} />
                <span style={{ color: T.grey600 }}>협업·성장</span>
              </span>
            </div>
          </div>

          {/* 카드 목록 또는 빈 상태 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {effectiveDrafts.length === 0 ? (
              <div
                className="text-center rounded-xl"
                style={{ ...cardStyle, padding: '40px 24px' }}
              >
                <p style={{ fontSize: 13.5, fontWeight: 600, color: T.grey700 }}>아직 작성한 KPI가 없어요.</p>
                <p style={{ fontSize: 12.5, color: T.grey500, marginTop: 4 }}>
                  아래 &apos;항목 추가&apos;로 첫 KPI를 만들어 보세요
                  {template ? '. 또는 상단 &apos;양식 불러오기&apos;로 시작할 수 있어요' : ''}.
                </p>
              </div>
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

            {/* 새 KPI 추가 — 그룹별 점선 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((g) => {
                const cfg = GROUP_CFG[g];
                const cnt = groupCount[g];
                const maxCnt = KPI_GROUP_BASE[g] + KPI_GROUP_MAX_EXTRA;
                const blocked =
                  isLocked || overallStatus === '확정' || !canAddToGroup(g) || !isGroupAllowed(g);
                return (
                  <button
                    key={g}
                    onClick={() => addDraftForGroup(g)}
                    disabled={blocked}
                    className="flex flex-col items-center justify-center gap-1.5 w-full rounded-xl transition-all"
                    style={{
                      padding: '18px 0',
                      fontSize: 13,
                      fontWeight: 600,
                      color: blocked ? T.grey400 : cfg.bg,
                      background: '#fff',
                      border: `2px dashed ${blocked ? T.grey300 : 'rgba(202,196,210,0.6)'}`,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!blocked) {
                        e.currentTarget.style.borderColor = cfg.bg;
                        e.currentTarget.style.background = `${cfg.bg}08`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <PlusCircle size={20} />
                    <span>{cfg.label} 추가</span>
                    <span style={{ fontSize: 11, color: blocked && cnt >= maxCnt ? T.grey400 : T.grey500 }}>
                      {cnt} / {maxCnt}개
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 하단 고정 액션 바 — 뷰포트 하단 고정 (사이드바 폭 오프셋) */}
          <div
            className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex flex-wrap items-center justify-between gap-4"
            style={{
              background: 'rgba(248,249,253,0.92)',
              backdropFilter: 'blur(8px)',
              borderTop: '1px solid rgba(202,196,210,0.4)',
              padding: '14px 24px',
            }}
          >
            {/* 좌측: 통계 */}
            <div className="flex items-center gap-6">
              <div>
                <div style={{ fontSize: 11, color: T.grey500, marginBottom: 2 }}>전체 가중치 합계</div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="tabular-nums"
                    style={{ fontSize: 18, fontWeight: 700, color: weightColor }}
                  >
                    {weightTotal}%
                  </span>
                  <span style={{ fontSize: 12, color: T.grey500 }}>/ 100%</span>
                </div>
              </div>
              <div style={{ width: 1, height: 32, background: '#cac4d2' }} />
              <div>
                <div style={{ fontSize: 11, color: T.grey500, marginBottom: 2 }}>정성 KPI 비중</div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="tabular-nums"
                    style={{ fontSize: 18, fontWeight: 700, color: qualitativeOver ? T.orange500 : T.grey700 }}
                  >
                    {qualitativeTotal}%
                  </span>
                  <span style={{ fontSize: 11, color: T.grey400 }}>(권장 ≤ 30%)</span>
                </div>
              </div>
            </div>
            {/* 우측: 버튼 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleSaveAll()}
                disabled={savingAll || effectiveDrafts.length === 0 || isLocked}
                className="flex items-center gap-1.5"
                style={{
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#3f2c80',
                  background: '#fff',
                  border: '1px solid #3f2c80',
                  borderRadius: 8,
                  cursor: savingAll || effectiveDrafts.length === 0 || isLocked ? 'not-allowed' : 'pointer',
                  opacity: savingAll || effectiveDrafts.length === 0 || isLocked ? 0.55 : 1,
                }}
              >
                <Save size={14} /> {savingAll ? '저장 중…' : '임시저장'}
              </button>
              <button
                onClick={() => void handleSubmitAll()}
                disabled={!canSubmit || submitting}
                className="flex items-center gap-1.5"
                style={{
                  padding: '10px 28px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: canSubmit ? '#3f2c80' : T.grey400,
                  border: 'none',
                  borderRadius: 8,
                  cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                  boxShadow: canSubmit ? '0 4px 12px rgba(63,44,128,0.25)' : 'none',
                }}
              >
                <Send size={14} /> {submitting ? '제출 중…' : '최종 제출'}
              </button>
            </div>
          </div>

          {/* 참고 체크리스트 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5" style={{ fontSize: 12 }}>
            <ChecklistItem ok={weightTotal === 100}>
              가중치 합 {weightTotal}% (100%)
            </ChecklistItem>
            <span className="inline-flex items-center gap-1" style={{ color: T.grey500 }}>
              <span style={{ width: 14, textAlign: 'center' }}>·</span>
              참고: 성과중심 {coreTotal}% · 협업·성장 {growthTotal}%
            </span>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: qualitativeOver ? '#f57800' : T.grey500 }}
            >
              <span style={{ width: 14, textAlign: 'center' }}>·</span>
              정성 비중 {qualitativeTotal}% (권장 ≤30%)
            </span>
          </div>
        </>
      )}

      {/* Cycle Ops §4: 1차 확정 대비 변경 내역(스냅샷 있을 때만) */}
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

// ─── 제출 완료 모드: 상세형 KPI 카드 ───────────────────────────────
function LockedKpiCard({
  kpi: k,
  index,
  scales,
}: {
  kpi: Kpi;
  index: number;
  scales?: Parameters<typeof KpiGradingDisplay>[0]['scales'];
}) {
  const isQual = k.isQualitative;
  const badge = isQual
    ? { label: '정성', bg: 'rgba(0,67,70,0.1)', color: '#004346' }
    : { label: '정량', bg: 'rgba(0,84,202,0.1)', color: '#0054ca' };

  const gc = k.gradingCriteria;
  const hasCustomGrading = gc && GRADE_KEYS.some((g) => (gc[g] ?? '').trim() !== '');

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        ...cardStyle,
        borderColor: 'rgba(202,196,210,0.5)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.3)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)';
      }}
    >
      <div style={{ padding: '20px 24px' }}>
        {/* 카드 상단: 제목 + 뱃지 / 가중치 원형 */}
        <div className="flex items-start justify-between gap-4">
          {/* 좌측: 번호 + 제목 + 뱃지 + 메타 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
              <span
                className="inline-flex items-center justify-center tabular-nums"
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#3f2c80',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#3f2c80' }}>{k.title}</h4>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: badge.bg,
                  color: badge.color,
                  textTransform: 'uppercase',
                }}
              >
                {badge.label}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: T.grey500 }}>
              {kpiGroupLabel[k.group]} · {kpiCategoryLabel[k.category]}
              {k.status === 'rejected' && k.rejectReason ? ` · 반려사유: ${k.rejectReason}` : ''}
            </div>
          </div>
          {/* 우측: 가중치 원형 */}
          <div
            className="flex flex-col items-center justify-center flex-shrink-0"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '3px solid rgba(63,44,128,0.12)',
              background: 'rgba(63,44,128,0.04)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 600, color: '#3f2c80', textTransform: 'uppercase' }}>가중치</span>
            <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: '#3f2c80', lineHeight: 1.1 }}>
              {k.weight}%
            </span>
          </div>
        </div>

        {/* 2컬럼 정보 그리드 */}
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl"
          style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.5)', padding: '16px 20px', marginTop: 14 }}
        >
          {k.coreStrategy && (
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                핵심전략
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{k.coreStrategy}</span>
            </div>
          )}
          {k.csf && (
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                전략목표 (CSF)
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{k.csf}</span>
            </div>
          )}
          {k.targetText && (
            <div className="flex flex-col gap-1" style={{ borderTop: '1px solid #e7e8ec', paddingTop: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                2026년 목표
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{k.targetText}</span>
            </div>
          )}
          {k.measureMethod && (
            <div className="flex flex-col gap-1" style={{ borderTop: '1px solid #e7e8ec', paddingTop: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                측정방식
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{k.measureMethod}</span>
            </div>
          )}
        </div>
      </div>

      {/* 등급 부여 기준 섹션 */}
      <div style={{ borderTop: '1px solid #e7e8ec', padding: '16px 24px', background: '#fff' }}>
        {hasCustomGrading && gc ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(202,196,210,0.5)' }}
          >
            <div
              className="grid grid-cols-5"
              style={{ gap: 1, background: 'rgba(202,196,210,0.25)' }}
            >
              {GRADE_KEYS.map((g) => {
                const gcol = gradeColor(g as Grade);
                const text = (gc[g] ?? '').trim();
                return (
                  <div
                    key={g}
                    className="flex flex-col items-center gap-2"
                    style={{ background: '#fff', padding: '14px 8px' }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: gcol.fg,
                        background: gcol.bg,
                        padding: '3px 14px',
                        borderRadius: 8,
                      }}
                    >
                      {g}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: text ? '#191c1f' : T.grey400,
                        textAlign: 'center',
                        lineHeight: 1.55,
                        marginTop: 2,
                      }}
                    >
                      {text || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 공통 규칙 기준(rate/amount) 또는 건수 기준 표시 */
          <KpiGradingDisplay kpi={k} scales={scales} bare />
        )}
      </div>

      {/* 상태 뱃지 */}
      <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(202,196,210,0.2)', background: '#fff' }}>
        <KpiStatusBadge status={k.status} />
      </div>
    </div>
  );
}

// ─── 편집 모드: 필드 래퍼 ────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
        {label}
        {required && <span style={{ color: T.red500, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// 포커스 시 파란 테두리
function CardInput({
  style,
  onFocus,
  onBlur,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#0054ca';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
        e.currentTarget.style.boxShadow = 'none';
        onBlur?.(e);
      }}
      style={{
        border: '1px solid rgba(202,196,210,0.6)',
        padding: '9px 11px',
        fontSize: 13,
        color: T.grey900,
        background: '#fff',
        width: '100%',
        outline: 'none',
        borderRadius: 6,
        transition: 'border-color .12s, box-shadow .12s',
        ...style,
      }}
    />
  );
}

function CardTextarea({
  style,
  onFocus,
  onBlur,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#0054ca';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
        e.currentTarget.style.boxShadow = 'none';
        onBlur?.(e);
      }}
      style={{
        border: '1px solid rgba(202,196,210,0.6)',
        padding: '9px 11px',
        fontSize: 13,
        color: T.grey900,
        background: '#f8f9fd',
        width: '100%',
        outline: 'none',
        borderRadius: 6,
        resize: 'none',
        transition: 'border-color .12s, box-shadow .12s',
        lineHeight: 1.5,
        ...style,
      }}
    />
  );
}

// ─── 편집 모드: 단일 KPI 카드 ──────────────────────────────────
function KpiDraftCard({
  index,
  draft: d,
  isGroupAllowed,
  onChange,
  onDelete,
}: {
  index: number;
  draft: DraftKpi;
  isGroupAllowed: (g: KpiGroup) => boolean;
  onChange: (patch: Partial<DraftKpi>) => void;
  onDelete: () => void;
}) {
  const grp = GROUP_CFG[d.group];
  const showAbsolute = canUseAbsoluteAmount(d);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: '#fff',
        border: '1px solid rgba(202,196,210,0.5)',
        boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.25)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)';
      }}
    >
      {/* 헤더: 번호 칩 + 그룹 셀렉트 + 가중치 + 삭제 */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{ padding: '12px 16px', background: '#f2f3f7', borderBottom: '1px solid rgba(202,196,210,0.2)' }}
      >
        <span
          className="tabular-nums inline-flex items-center justify-center"
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: '#3f2c80',
            borderRadius: 6,
          }}
        >
          {index + 1}
        </span>
        <select
          value={d.group}
          onChange={(e) =>
            onChange({
              group: e.target.value as KpiGroup,
              category: CATEGORY_BY_GROUP[e.target.value as KpiGroup][0],
            })
          }
          style={{
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: grp.bg,
            border: 'none',
            borderRadius: 6,
            outline: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = grp.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = grp.bg)}
        >
          <option
            value="performance_core"
            disabled={!isGroupAllowed('performance_core')}
            style={{ background: '#fff', color: T.grey900 }}
          >
            성과중심{!isGroupAllowed('performance_core') ? ' (작성 불가)' : ''}
          </option>
          <option
            value="collaboration_growth"
            disabled={!isGroupAllowed('collaboration_growth')}
            style={{ background: '#fff', color: T.grey900 }}
          >
            협업·성장{!isGroupAllowed('collaboration_growth') ? ' (작성 불가)' : ''}
          </option>
        </select>

        <div style={{ flex: 1 }} />

        {/* 가중치 */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: T.grey500 }}>가중치</span>
          <CardInput
            type="number"
            min={0}
            max={100}
            value={d.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
            placeholder="0"
            style={{ width: 58, textAlign: 'center', padding: '6px 4px', fontWeight: 700, fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: T.grey500 }}>%</span>
        </div>

        <button
          onClick={onDelete}
          aria-label="KPI 삭제"
          className="flex items-center justify-center transition-colors"
          style={{
            width: 30,
            height: 30,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) (icon as SVGElement).style.color = T.red500;
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) (icon as SVGElement).style.color = T.grey400;
          }}
        >
          <Trash2 size={15} color={T.grey400} />
        </button>
      </div>

      {/* 본문: 2컬럼 필드 그리드 */}
      <div style={{ padding: '16px 18px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          <Field label="성과관리지표 (KPI)" required>
            <CardInput
              value={d.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="예) 신규 거래처 매출 달성"
            />
          </Field>
          <Field label="전략 목표 (CSF)">
            <CardInput
              value={d.csf}
              onChange={(e) => onChange({ csf: e.target.value })}
              placeholder="예) 신규 시장 진출"
            />
          </Field>
          <Field label="2026년 목표">
            <CardTextarea
              rows={2}
              value={d.targetText}
              onChange={(e) => onChange({ targetText: e.target.value })}
              placeholder="예) 신규 거래처 5곳 확보, 매출 120억 달성"
            />
          </Field>
          <Field label="측정방식">
            <CardTextarea
              rows={2}
              value={d.measureMethod}
              onChange={(e) => onChange({ measureMethod: e.target.value })}
              placeholder="예) 분기별 실적 합산, 목표 대비 달성률"
            />
          </Field>
        </div>

        {/* 성과 구분 정량/정성 토글 */}
        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.grey600, flexShrink: 0 }}>
            성과 구분
          </span>
          <QualToggle
            value={d.isQualitative}
            onChange={(v) => onChange({ isQualitative: v })}
          />
          <span style={{ fontSize: 11, color: T.grey400 }}>
            {d.isQualitative ? '서술형 평가 · 권장 비중 ≤30%' : '수치 실적 기반 평가'}
          </span>
        </div>
      </div>

      {/* 등급 부여 기준 — 항상 표시 */}
      <div style={{ borderTop: '1px solid rgba(202,196,210,0.2)' }}>
        <div style={{ padding: '10px 18px 4px', background: '#f8f9fd' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.grey700 }}>
            등급 부여 기준 (S / A / B / C / D)
          </span>
        </div>
        <div style={{ padding: '8px 18px 18px', background: '#f8f9fd' }}>
            {/* 갭 #2 — 매출 정량 KPI에서만 노출 */}
            {showAbsolute && (
              <AbsoluteAmountToggle
                value={d.useAbsoluteAmount}
                onChange={(v) => onChange({ useAbsoluteAmount: v })}
              />
            )}
            {/* S~D 5열 테이블 그리드 (헤더 행 + 텍스트에어리어 행) */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(202,196,210,0.5)' }}
            >
              {/* 헤더 행: 등급 뱃지 */}
              <div
                className="grid grid-cols-5"
                style={{ background: '#f2f3f7', borderBottom: '1px solid rgba(202,196,210,0.2)' }}
              >
                {GRADE_KEYS.map((g) => {
                  const gcol = gradeColor(g as Grade);
                  return (
                    <div
                      key={`hdr-${g}`}
                      className="flex items-center justify-center"
                      style={{
                        padding: '8px 4px',
                        borderRight: g !== 'D' ? '1px solid rgba(202,196,210,0.2)' : undefined,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: gcol.fg,
                          background: gcol.bg,
                          padding: '2px 12px',
                          borderRadius: 5,
                        }}
                      >
                        {g}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* 본문 행: 텍스트에어리어 */}
              <div
                className="grid grid-cols-5"
                style={{ background: '#fff' }}
              >
                {GRADE_KEYS.map((g) => (
                  <div
                    key={`body-${g}`}
                    style={{
                      padding: '8px',
                      borderRight: g !== 'D' ? '1px solid rgba(202,196,210,0.15)' : undefined,
                    }}
                  >
                    <textarea
                      value={d.gradingCriteria[g]}
                      onChange={(e) =>
                        onChange({
                          gradingCriteria: { ...d.gradingCriteria, [g]: e.target.value },
                        })
                      }
                      placeholder={`${g} 기준`}
                      rows={3}
                      style={{
                        width: '100%',
                        fontSize: 12,
                        color: T.grey800,
                        background: '#f8f9fd',
                        border: '1px solid rgba(202,196,210,0.3)',
                        borderRadius: 4,
                        padding: '6px 8px',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: 1.5,
                        transition: 'border-color .12s',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#0054ca'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.3)'; }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

// 정량/정성 세그먼트 토글(pill 그룹)
function QualToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const seg = (active: boolean, activeBg: string): React.CSSProperties => ({
    padding: '5px 16px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    background: active ? activeBg : 'transparent',
    color: active ? '#fff' : T.grey500,
    borderRadius: 0,
    transition: 'background 0.12s, color 0.12s',
  });
  return (
    <div
      role="group"
      aria-label="정성/정량 구분"
      style={{
        display: 'inline-flex',
        border: '1px solid rgba(202,196,210,0.6)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f2f3f7',
      }}
    >
      <button type="button" aria-pressed={!value} onClick={() => onChange(false)} style={seg(!value, '#0054ca')}>
        정량
      </button>
      <button type="button" aria-pressed={value} onClick={() => onChange(true)} style={{ ...seg(value, '#3f2c80'), borderLeft: '1px solid rgba(202,196,210,0.4)' }}>
        정성
      </button>
    </div>
  );
}

// 갭 #2 — 절대금액 기준 등급 토글
function AbsoluteAmountToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
        padding: '10px 12px',
        border: `1px solid ${value ? '#b1c5ff' : 'rgba(202,196,210,0.5)'}`,
        background: value ? '#f2f4ff' : '#fff',
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="절대금액 기준 등급 사용"
        onClick={() => onChange(!value)}
        style={{
          position: 'relative',
          width: 40,
          height: 22,
          flexShrink: 0,
          marginTop: 1,
          border: `1px solid ${value ? '#0054ca' : T.grey300}`,
          background: value ? '#0054ca' : T.grey200,
          borderRadius: 11,
          cursor: 'pointer',
          padding: 0,
          transition: 'background .15s ease, border-color .15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 20 : 2,
            width: 16,
            height: 16,
            background: '#fff',
            borderRadius: '50%',
            transition: 'left .15s ease',
          }}
        />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.grey900 }}>
          절대금액 기준 등급
          <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: value ? '#0054ca' : T.grey500 }}>
            {value ? '사용' : '미사용'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: T.grey600, marginTop: 3, lineHeight: 1.5 }}>
          {value
            ? '목표 대비 달성률 대신 실제 매출 절대금액으로 등급을 매겨요.'
            : '켜면 목표 대비 달성률 대신 실제 매출 절대금액으로 등급을 매겨요. 매출 정량 KPI에만 적용돼요.'}
        </p>
      </div>
    </div>
  );
}

function ChecklistItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: ok ? T.green500 : T.grey500 }}>
      {ok ? <Check size={13} /> : <span style={{ width: 14, textAlign: 'center' }}>·</span>}
      {children}
    </span>
  );
}

const KPI_STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  submitted: { label: '제출', bg: '#0054ca' },
  approved: { label: '승인', bg: T.green500 },
  confirmed: { label: '확정', bg: '#3f2c80' },
  rejected: { label: '반려', bg: T.red500 },
  revision_requested: { label: '수정요청', bg: T.orange500 },
  draft: { label: '작성중', bg: T.grey500 },
};
function KpiStatusBadge({ status }: { status: string }) {
  const s = KPI_STATUS_LABEL[status] ?? KPI_STATUS_LABEL.draft;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: s.bg,
        padding: '3px 10px',
        borderRadius: 4,
      }}
    >
      {s.label}
    </span>
  );
}

// Cycle Ops §4: diff
const DIFF_FIELD_LABEL: Record<string, string> = {
  title: '지표명',
  category: '카테고리',
  group: '지표 그룹',
  measureType: '측정방식',
  targetValue: '목표값',
  weight: '가중치',
  isQualitative: '정성 여부',
};
function diffFieldLabel(field: string): string {
  return DIFF_FIELD_LABEL[field] ?? field;
}
function diffValueText(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '–';
  if (field === 'measureType') {
    return measureTypeLabel[v as MeasureType] ?? String(v);
  }
  if (field === 'group') {
    return kpiGroupLabel[v as KpiGroup] ?? String(v);
  }
  if (field === 'category') {
    return kpiCategoryLabel[v as KpiCategory] ?? String(v);
  }
  if (field === 'isQualitative') return v ? '정성' : '정량';
  if (field === 'weight') return `${v}%`;
  return String(v);
}

function KpiDiffPanel({
  label,
  createdAt,
  added,
  removed,
  changed,
  unchangedCount,
}: {
  label: string;
  createdAt: string;
  added: KpiDiffItem[];
  removed: KpiDiffItem[];
  changed: KpiDiffItem[];
  unchangedCount: number;
}) {
  const createdStr = (() => {
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  })();
  const hasChanges = added.length + removed.length + changed.length > 0;

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, overflow: 'hidden' }}>
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        style={{ padding: '10px 16px', borderBottom: '1px solid #e7e8ec', background: '#f8f9fd' }}
      >
        <h3 className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
          <History size={14} color={T.grey600} /> {label} 대비 변경 내역
        </h3>
        <span style={{ fontSize: 11.5, color: T.grey500 }}>
          {createdStr && `기준 ${createdStr} · `}변경 없음 {unchangedCount}건
        </span>
      </div>

      <div style={{ padding: 16 }} className="space-y-4">
        {!hasChanges ? (
          <p style={{ fontSize: 12.5, color: T.grey500 }}>
            1차 확정 이후 변경된 KPI가 없어요.
          </p>
        ) : (
          <>
            {added.length > 0 && (
              <DiffSection title="신규" count={added.length} color="#03b26c">
                {added.map((it) => (
                  <li key={`add-${it.id}`} style={{ fontSize: 12.5, color: T.grey800 }}>
                    {it.title || '(제목 없음)'}
                  </li>
                ))}
              </DiffSection>
            )}
            {removed.length > 0 && (
              <DiffSection title="삭제" count={removed.length} color="#f04452">
                {removed.map((it) => (
                  <li
                    key={`rm-${it.id}`}
                    style={{ fontSize: 12.5, color: T.grey800, textDecoration: 'line-through' }}
                  >
                    {it.title || '(제목 없음)'}
                  </li>
                ))}
              </DiffSection>
            )}
            {changed.length > 0 && (
              <DiffSection title="변경" count={changed.length} color="#0054ca">
                {changed.map((it) => (
                  <li key={`ch-${it.id}`} style={{ fontSize: 12.5, color: T.grey800 }}>
                    <div style={{ fontWeight: 600 }}>{it.title || '(제목 없음)'}</div>
                    <ul style={{ marginTop: 2 }}>
                      {(it.fields ?? []).map((f: KpiDiffField, i: number) => (
                        <li key={i} style={{ fontSize: 12, color: T.grey600 }}>
                          {diffFieldLabel(f.field)}: {diffValueText(f.field, f.before)}
                          {' → '}
                          <span style={{ color: T.grey900, fontWeight: 600 }}>
                            {diffValueText(f.field, f.after)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </DiffSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiffSection({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
        <span
          style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: color, padding: '2px 8px', borderRadius: 4 }}
        >
          {title}
        </span>
        <span style={{ fontSize: 11.5, color: T.grey500 }}>{count}건</span>
      </div>
      <ul className="space-y-1.5" style={{ paddingLeft: 4 }}>
        {children}
      </ul>
    </div>
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
