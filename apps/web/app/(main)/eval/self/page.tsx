'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Save, Send, Info, Paperclip, Download, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useEvaluations,
  useEvaluationDetail,
  useEvaluationEvidence,
  evaluationCommands,
  evidenceCommands,
  openEvidence,
} from '@/hooks/useEvaluations';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
import { Eye } from 'lucide-react';
import { useKpis } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import {
  kpiCategoryLabel,
  kpiTypeLabel,
  measureTypeUnit,
  fmtScore,
  fmtAmount,
  wonToEok,
  eokToWon,
} from '@/lib/ui';
import { T, gradeChipColor } from '@/lib/toss';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import {
  KpiGradingDisplay,
  RevenueGradeDisplay,
  matchRevenueGrade,
} from '@/components/KpiGradingDisplay';
import type { Kpi, KpiGroup, KpiScore, Grade, EvaluationEvidence } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

interface AchInput {
  actualValue?: number;
  count?: number;
  // 갭 #2 — 절대금액 모드 매출 KPI의 실제 매출 금액(원). 달성률 대신 이 값으로 등급 산정.
  actualAmount?: number;
  qualitativeNote?: string;
  // 정성 KPI 자기 등급(directGrade) — 본인이 세운 기준에 따라 선택.
  directGrade?: Grade;
}

// 갭 #2 — 목표 대비 달성률이 아니라 실제 매출 절대금액으로 등급을 매기는 KPI 판정.
function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

// 그룹별 섹션 색(KPI 작성 탭과 동일 — 성과중심 파랑 / 협업·성장 초록).
const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

// ── Kinetic Enterprise 팔레트 (루트 DESIGN.md) ──────────────────
const K = {
  primary: '#3f2c80',
  primaryContainer: '#564599',
  secondary: '#0054ca',
  secondaryDim: '#336fe5',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};

const cellInput: React.CSSProperties = {
  border: '1px solid rgba(202,196,210,0.6)',
  borderRadius: 6,
  padding: '9px 11px',
  fontSize: 13,
  color: T.grey900,
  background: '#fff',
  width: '100%',
  outline: 'none',
  transition: 'border-color .12s, box-shadow .12s',
};

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  not_started: { label: '미시작', bg: T.grey500 },
  in_progress: { label: '진행중', bg: K.secondary },
  submitted: { label: '제출 완료', bg: K.tertiary },
  finalized: { label: '확정', bg: K.primary },
};

export default function SelfEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const {
    data: selfEvals,
    loading: evalLoading,
    error: evalError,
    reload: reloadEvals,
  } = useEvaluations(
    { cycleId, evaluateeId: user?.id, type: 'self' },
    { enabled: !!cycleId && !!user },
  );
  const selfEval = selfEvals?.data[0] ?? null;

  const {
    data: detail,
    loading: detailLoading,
    reload: reloadDetail,
  } = useEvaluationDetail(selfEval?.id ?? null);

  // 문항별 증빙 첨부 — 평가 단위로 한 번 불러와 kpiId 별로 묶는다(업로드·삭제 후 reload).
  const { data: evidenceData, reload: reloadEvidence } = useEvaluationEvidence(
    selfEval?.id ?? null,
  );
  const evidenceByKpi = useMemo(() => {
    const map = new Map<string, EvaluationEvidence[]>();
    for (const e of evidenceData?.data ?? []) {
      const arr = map.get(e.kpiId) ?? [];
      arr.push(e);
      map.set(e.kpiId, arr);
    }
    return map;
  }, [evidenceData]);

  const { data: myKpis, loading: kpiLoading } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  // amount/rate 측정방식 KPI의 공통 등급표(RuleSet) — 자동 산정 등급 기준 표시에 사용.
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);
  const allKpis: Kpi[] = myKpis?.data ?? [];
  const kpis = useMemo(
    () => allKpis.filter((k) => k.status === 'confirmed'),
    [allKpis],
  );

  // 본인평가는 '확정(confirmed)' KPI만 대상. 확정 전(제출·승인·반려·작성중) KPI가
  // 있을 땐 "작성하기"로 되돌리지 말고 현재 단계를 안내한다(막다른 동선 방지).
  const pendingStatusLabel = useMemo(() => {
    if (allKpis.some((k) => k.status === 'approved'))
      return '승인 완료 · HR 확정 대기중';
    if (allKpis.some((k) => k.status === 'submitted'))
      return '제출 완료 · 팀장·HR 검토 대기중';
    if (allKpis.some((k) => k.status === 'rejected' || k.status === 'revision_requested'))
      return '반려됨 · 보완 후 재제출이 필요해요';
    return '작성중 · 제출이 필요해요';
  }, [allKpis]);

  const readOnly =
    selfEval?.status === 'submitted' || selfEval?.status === 'finalized';

  const [inputs, setInputs] = useState<Record<string, AchInput>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 저장된 KpiScore → measureType별로 입력값 복원.
  useEffect(() => {
    if (!detail) return;
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));
    const next: Record<string, AchInput> = {};
    for (const s of detail.kpiScores) {
      const kpi = kpiMap.get(s.kpiId);
      if (!kpi) continue;
      if (kpi.measureType === 'count') {
        next[s.kpiId] = { count: s.achievementRate ?? undefined };
      } else if (kpi.measureType === 'qualitative') {
        // 저장된 등급(grade)을 자기 선택값으로 복원.
        next[s.kpiId] = {
          qualitativeNote: s.selfNote ?? '',
          directGrade: s.grade ?? undefined,
        };
      } else if (isAbsoluteAmount(kpi)) {
        // 절대금액 모드: 저장된 실제 매출 금액(actualAmount)을 복원.
        next[s.kpiId] = { actualAmount: s.actualAmount ?? undefined };
      } else {
        next[s.kpiId] = { actualValue: s.achievementRate ?? undefined };
      }
    }
    setInputs((prev) => ({ ...next, ...prev }));
  }, [detail?.id, kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreByKpi = useMemo(() => {
    const map = new Map<string, KpiScore>();
    for (const s of detail?.kpiScores ?? []) map.set(s.kpiId, s);
    return map;
  }, [detail?.kpiScores]);

  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');

  // 과제 완료 판정: 정성=등급 선택, 건수=건수, 그 외=실적값 입력.
  const isComplete = (k: Kpi): boolean => {
    const inp = inputs[k.id] ?? {};
    if (k.measureType === 'qualitative') return !!inp.directGrade;
    if (isAbsoluteAmount(k)) return inp.actualAmount !== undefined;
    const v = k.measureType === 'count' ? inp.count : inp.actualValue;
    return v !== undefined;
  };

  const totalCount = kpis.length;
  const doneCount = kpis.filter(isComplete).length;

  function updateInput(kpiId: string, patch: AchInput) {
    setInputs((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  async function save(): Promise<boolean> {
    if (!selfEval) return false;
    const kpiScores = kpis
      .map((k) => {
        const inp = inputs[k.id] ?? {};
        if (k.measureType === 'qualitative') {
          // 정성: 본인이 선택한 등급(directGrade)을 전송. 미선택이면 기본 D로 잘못 저장되지 않게 skip.
          if (!inp.directGrade) return null;
          return {
            kpiId: k.id,
            directGrade: inp.directGrade,
            selfNote: inp.qualitativeNote ?? '',
            weight: k.weight,
          };
        }
        if (isAbsoluteAmount(k)) {
          // 절대금액 모드: 달성률 대신 실제 매출 금액(원)을 전송. 백엔드가 revenueGradeScale 로 등급 산정.
          if (inp.actualAmount === undefined) return null;
          return { kpiId: k.id, actualAmount: inp.actualAmount, weight: k.weight };
        }
        const ach = k.measureType === 'count' ? inp.count : inp.actualValue;
        if (ach === undefined) return null;
        return { kpiId: k.id, achievementRate: ach, weight: k.weight };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    try {
      await evaluationCommands.patch(selfEval.id, { kpiScores });
      reloadDetail();
      return true;
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
      return false;
    }
  }

  async function handleSubmit() {
    if (!selfEval) return;
    setSubmitting(true);
    try {
      const saved = await save();
      if (!saved) return;
      await evaluationCommands.submit(selfEval.id);
      toast.show({ variant: 'success', message: '본인평가를 제출했어요.' });
      reloadEvals();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'COMMENT_REQUIRED'
            ? '평가 코멘트를 작성해야 제출할 수 있어요.'
            : err.code === 'POOL_EXCEEDED'
              ? '그룹 등급 풀 상한을 초과했어요.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSelf() {
    if (!cycleId || !user) return;
    setCreateBusy(true);
    try {
      await evaluationCommands.create({
        cycleId,
        evaluateeId: user.id,
        type: 'self',
      });
      toast.show({ variant: 'success', message: '본인평가를 시작했어요.' });
      reloadEvals();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError && err.code === 'ALREADY_EXISTS'
            ? '이미 시작한 본인평가가 있어요.'
            : '본인평가를 시작하지 못했어요.',
      });
      reloadEvals();
    } finally {
      setCreateBusy(false);
    }
  }

  // 모든 과제 완료(정성=등급 선택, 수치=실적값) 시 제출 가능.
  const missingCount = totalCount - doneCount;
  const canSubmit =
    !readOnly && !!selfEval && kpis.length > 0 && missingCount === 0;

  if (cyclesLoading || evalLoading) return <SelfSkeleton />;
  if (evalError) return <ErrorState onRetry={reloadEvals} />;
  if (user?.evaluationExempt)
    return (
      <EmptyState
        title="이번 평가 대상이 아니에요."
        description="하반기 입사 등으로 이번 주기 평가에서 제외되었어요. 자세한 내용은 인사팀에 문의해 주세요."
      />
    );
  if (!current) return <EmptyState title="지금은 본인평가 기간이 아니에요." />;

  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const status = selfEval ? STATUS_LABEL[selfEval.status] ?? STATUS_LABEL.in_progress : null;

  return (
    <PageContainer>
      <PageHeader
        title="본인평가"
        subtitle="내가 세운 등급 기준에 따라 과제별로 달성 등급을 평가하세요. 수치 과제는 실적을 입력하면 등급이 자동 산정돼요."
        right={
          <>
            {status && (
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: status.bg,
                  color: '#fff',
                }}
              >
                {status.label}
              </span>
            )}
            {selfEval && !readOnly && (
              <>
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: K.primary,
                    border: `1px solid ${K.primary}`,
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 disabled:opacity-60"
                  style={{
                    padding: '8px 22px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    background: canSubmit ? K.primary : T.grey400,
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: canSubmit ? '0 4px 12px rgba(63,44,128,0.25)' : 'none',
                  }}
                >
                  <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
                </button>
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <div
          className="flex items-center gap-2 px-5 py-3.5"
          style={{
            background: 'rgba(14,154,160,0.06)',
            border: '1px solid rgba(14,154,160,0.25)',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#007a7f' }}>
            본인평가가 제출되었습니다. 부서장 평가가 진행돼요.
          </div>
        </div>
      )}

      {/* 요약 카드 4장 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '평가 대상자', value: user?.name ?? '나', color: K.primary },
          { label: '평가 기간', value: current.name, color: T.grey800 },
          { label: '진행률', value: `${progressPct}%`, color: K.secondary },
          { label: '입력 현황', value: `${doneCount} / ${totalCount}건`, color: T.grey800 },
        ].map((c, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-xl p-5"
            style={{ background: '#fff', border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {c.label}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.color, fontVariantNumeric: 'tabular-nums' }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>

      {!selfEval ? (
        <div className="px-6 py-12 text-center rounded-xl" style={card}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.grey900 }}>아직 본인평가를 시작하지 않았어요.</p>
          <p style={{ fontSize: 13, color: T.grey500, marginTop: 6, marginBottom: 20 }}>
            시작하면 KPI별 실적을 입력할 수 있어요.
          </p>
          <button
            onClick={handleCreateSelf}
            disabled={createBusy}
            className="inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{
              padding: '10px 28px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: K.primary,
              borderRadius: 8,
              border: 'none',
              boxShadow: '0 4px 12px rgba(63,44,128,0.25)',
            }}
          >
            {createBusy ? '시작 중…' : '본인평가 시작하기'}
          </button>
        </div>
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        allKpis.length === 0 ? (
          // KPI 자체가 없음 — 작성·제출이 필요(정상 진입점).
          <div className="px-6 py-12 text-center rounded-xl" style={card}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.grey900 }}>아직 작성한 KPI가 없어요.</p>
            <p style={{ fontSize: 13, color: T.grey500, marginTop: 6, marginBottom: 20 }}>
              KPI 작성에서 과제를 등록하고 제출해 주세요.
            </p>
            <Link href="/kpi">
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  background: K.secondary,
                  borderRadius: 8,
                }}
              >
                KPI 작성하기
              </span>
            </Link>
          </div>
        ) : (
          // KPI는 있으나 아직 확정 전 — 검토·확정 대기 단계 안내(막다른 동선 방지).
          <div className="px-6 py-12 text-center rounded-xl" style={card}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.grey900 }}>KPI가 확정되면 본인평가를 입력할 수 있어요.</p>
            <p style={{ fontSize: 13, color: T.grey500, marginTop: 6, marginBottom: 4 }}>
              제출한 KPI는 <b style={{ color: T.grey700 }}>팀장·HR의 검토·확정</b> 후 본인평가 대상이 됩니다.
            </p>
            <p style={{ fontSize: 13, color: '#484551', marginBottom: 20 }}>
              현재 상태 — <b style={{ color: K.primary }}>{pendingStatusLabel}</b>
            </p>
            <Link href="/kpi">
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  padding: '8px 22px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: K.primary,
                  background: '#fff',
                  border: `1px solid ${K.primary}`,
                  borderRadius: 8,
                }}
              >
                KPI 현황 보기
              </span>
            </Link>
          </div>
        )
      ) : (
        <>
          {/* 안내 배너 */}
          <div
            className="flex items-start gap-2.5 px-5 py-3.5 rounded-xl"
            style={{ background: 'rgba(0,84,202,0.05)', border: '1px solid rgba(0,84,202,0.15)' }}
          >
            <Info size={15} color={K.secondary} style={{ marginTop: 1.5, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: '#484551', lineHeight: 1.55 }}>
              과제마다 <b style={{ color: T.grey900 }}>내가 세운 등급 부여 기준</b>이 함께 표시돼요.
              정성 과제는 달성한 기준의 등급을 직접 선택하고, 수치 과제는 실적을 입력하면 등급이 자동 산정돼요.
            </p>
          </div>

          {/* 그룹별 카드 섹션 */}
          {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
            const rows = group === 'performance_core' ? coreKpis : growthKpis;
            if (rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} className="space-y-3">
                {/* 그룹 헤더 */}
                <div className="flex items-center gap-2">
                  <span style={{ width: 4, height: 15, background: cfg.bg, display: 'inline-block' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{cfg.label}</span>
                  <span style={{ fontSize: 12, color: T.grey500 }}>{rows.length}개 과제</span>
                </div>

                {/* KPI 카드 */}
                {rows.map((kpi) => {
                  const score = scoreByKpi.get(kpi.id) ?? null;
                  const inp = inputs[kpi.id] ?? {};
                  const unit = measureTypeUnit[kpi.measureType];
                  const isQual = kpi.measureType === 'qualitative';
                  const isCount = kpi.measureType === 'count';
                  const isAbsAmount = isAbsoluteAmount(kpi);
                  // 절대금액 KPI: 입력 금액으로 즉시 등급 미리보기(저장 전에도). 저장 후엔 백엔드 등급(score) 우선.
                  const absPreviewGrade = isAbsAmount
                    ? matchRevenueGrade(inp.actualAmount, ruleSet?.weightPolicy.revenueGradeScale)
                    : undefined;
                  const liveGrade: Grade | undefined = isQual
                    ? inp.directGrade
                    : score?.grade ?? absPreviewGrade;
                  const done = isComplete(kpi);
                  const targetStr = kpi.targetText?.trim()
                    ? kpi.targetText
                    : kpi.targetValue !== null
                      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
                      : null;
                  return (
                    <div
                      key={kpi.id}
                      className="rounded-xl overflow-hidden transition-all"
                      style={{
                        ...card,
                        borderColor: 'rgba(202,196,210,0.5)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.3)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)'; }}
                    >
                      {/* 카드 헤더 */}
                      <div
                        className="flex items-start gap-3 px-5 py-3.5"
                        style={{ borderBottom: '1px solid rgba(202,196,210,0.25)', background: '#f8f9fd' }}
                      >
                        <span
                          className="inline-block px-2 py-0.5 rounded-md"
                          style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: cfg.bg, flexShrink: 0, marginTop: 2 }}
                        >
                          {kpiCategoryLabel[kpi.category]}
                        </span>
                        <div className="flex-1" style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{kpi.title}</div>
                          <div
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                            style={{ fontSize: 11.5, color: '#797582', marginTop: 3 }}
                          >
                            {kpi.csf && <span>{kpi.csf}</span>}
                            {kpi.csf && <span>·</span>}
                            <span>{kpiTypeLabel(kpi)}</span>
                            {targetStr && <span>·</span>}
                            {targetStr && <span>목표 {targetStr}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5" style={{ flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: '#484551' }} className="tabular-nums">
                            가중치 {kpi.weight}%
                          </span>
                          {liveGrade ? (
                            <div className="flex items-center gap-1.5">
                              {!isQual && (
                                <span className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: K.secondary }}>
                                  {fmtScore(score?.score)}
                                </span>
                              )}
                              <GradeBadge grade={liveGrade} />
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#797582',
                                background: '#f2f3f7',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {isQual ? '등급 미선택' : '실적 미입력'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 카드 본문 */}
                      <div className="px-5 py-4 space-y-3.5" style={{ background: '#fff' }}>
                        {isQual ? (
                          <>
                            <GradeCriteriaPicker
                              kpi={kpi}
                              value={inp.directGrade}
                              onSelect={(g) => updateInput(kpi.id, { directGrade: g })}
                              readOnly={readOnly}
                            />
                            <label className="flex flex-col gap-1.5">
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: T.grey500 }}>
                                성과 근거 · 메모 <span style={{ color: T.grey400 }}>(선택)</span>
                              </span>
                              <textarea
                                rows={2}
                                value={inp.qualitativeNote ?? ''}
                                onChange={(e) => updateInput(kpi.id, { qualitativeNote: e.target.value })}
                                placeholder="선택한 등급의 근거가 되는 성과를 적어두면 검토에 도움이 돼요."
                                disabled={readOnly}
                                style={{ ...cellInput, resize: 'vertical', lineHeight: 1.45 }}
                              />
                            </label>
                          </>
                        ) : isAbsAmount ? (
                          <>
                            {/* 절대금액 모드: 달성률(%) 대신 실제 매출 금액(억 단위 입력 → 원 저장). */}
                            <label className="flex flex-col gap-1.5" style={{ maxWidth: 280 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: T.grey500 }}>
                                실제 매출 금액
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0}
                                  aria-label={`${kpi.title} 실제 매출 금액(억)`}
                                  value={wonToEok(inp.actualAmount) ?? ''}
                                  onChange={(e) => {
                                    const won =
                                      e.target.value === ''
                                        ? undefined
                                        : eokToWon(Number(e.target.value));
                                    updateInput(kpi.id, { actualAmount: won });
                                  }}
                                  placeholder="예) 10"
                                  disabled={readOnly}
                                  style={{ ...cellInput, textAlign: 'right' }}
                                />
                                <span style={{ fontSize: 12, color: T.grey500, whiteSpace: 'nowrap' }}>
                                  억
                                </span>
                              </div>
                              {inp.actualAmount !== undefined && (
                                <span style={{ fontSize: 11, color: T.grey400 }} className="tabular-nums">
                                  = {fmtAmount(inp.actualAmount)} ({inp.actualAmount.toLocaleString('ko-KR')}원)
                                </span>
                              )}
                            </label>
                            <RevenueGradeDisplay
                              scale={ruleSet?.weightPolicy.revenueGradeScale}
                              inputAmount={
                                score?.actualAmount ?? inp.actualAmount ?? undefined
                              }
                            />
                            {!score && (
                              <p style={{ fontSize: 11.5, color: T.grey400 }}>
                                실제 매출 금액을 입력하면 위 절대금액 기준에 따라 등급이 자동 산정돼요.
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <label className="flex flex-col gap-1.5" style={{ maxWidth: 240 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: T.grey500 }}>
                                {isCount ? '실적 건수' : '실적값'}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  value={isCount ? inp.count ?? '' : inp.actualValue ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                                    updateInput(kpi.id, isCount ? { count: v } : { actualValue: v });
                                  }}
                                  placeholder={isCount ? '건수' : '실적값'}
                                  disabled={readOnly}
                                  style={{ ...cellInput, textAlign: 'right' }}
                                />
                                {(unit || isCount) && (
                                  <span style={{ fontSize: 12, color: T.grey500, whiteSpace: 'nowrap' }}>
                                    {isCount ? '건' : unit}
                                  </span>
                                )}
                              </div>
                            </label>
                            <KpiGradingDisplay
                              kpi={kpi}
                              scales={ruleSet?.gradingScales}
                              highlightGrade={score?.grade ?? undefined}
                            />
                            {!score && (
                              <p style={{ fontSize: 11.5, color: T.grey400 }}>
                                실적을 입력하고 저장하면 위 기준에 따라 등급이 자동 산정돼요.
                              </p>
                            )}
                          </>
                        )}

                        {/* 문항별 증빙 첨부 — 모든 측정 유형 공통. */}
                        {selfEval && (
                          <EvidenceSection
                            evaluationId={selfEval.id}
                            kpiId={kpi.id}
                            files={evidenceByKpi.get(kpi.id) ?? []}
                            readOnly={readOnly}
                            onChanged={reloadEvidence}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 하단 바 — 뷰포트 하단 고정 */}
          {!readOnly && (
            <div
              className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex items-center justify-between flex-wrap gap-3"
              style={{
                background: 'rgba(248,249,253,0.92)',
                backdropFilter: 'blur(8px)',
                borderTop: '1px solid rgba(202,196,210,0.4)',
                padding: '12px 24px',
              }}
            >
              <p style={{ fontSize: 13, color: '#484551' }}>
                <span style={{ fontWeight: 700, color: '#191c1f' }}>{doneCount}</span>/{totalCount}건 완료
                {missingCount > 0 ? (
                  <span style={{ color: '#ba1a1a', marginLeft: 6 }}>· 미완료 {missingCount}건</span>
                ) : (
                  <span style={{ color: K.tertiary, marginLeft: 6 }}>· 모두 완료했어요</span>
                )}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: K.primary,
                    border: `1px solid ${K.primary}`,
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 disabled:opacity-60"
                  style={{
                    padding: '8px 24px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    background: canSubmit ? K.primary : T.grey400,
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: canSubmit ? '0 4px 12px rgba(63,44,128,0.25)' : 'none',
                  }}
                >
                  <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

// 사람이 읽기 쉬운 파일 크기.
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

// 문항별 증빙 첨부 — 목록(다운로드·삭제) + 업로드. readOnly(제출 후)면 보기·다운로드만.
function EvidenceSection({
  evaluationId,
  kpiId,
  files,
  readOnly,
  onChanged,
}: {
  evaluationId: string;
  kpiId: string;
  files: EvaluationEvidence[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // 인라인 미리보기 대상(PDF·이미지). 그 외 형식은 새 탭 다운로드로 처리.
  const [preview, setPreview] = useState<EvaluationEvidence | null>(null);

  function openFile(f: EvaluationEvidence) {
    if (isEvidencePreviewable(f.mimeType)) setPreview(f);
    else void handleDownload(f);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      // 다중 선택 시 순차 업로드(개별 실패 메시지 유지).
      for (const f of Array.from(fileList)) {
        await evidenceCommands.upload(evaluationId, kpiId, f);
      }
      toast.show({ variant: 'success', message: '증빙 자료를 첨부했어요.' });
      onChanged();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '첨부에 실패했어요.',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(e: EvaluationEvidence) {
    setDownloadingId(e.id);
    try {
      await openEvidence(evaluationId, e.id);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '파일을 열지 못했어요.',
      });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRemove(e: EvaluationEvidence) {
    setRemovingId(e.id);
    try {
      await evidenceCommands.remove(evaluationId, e.id);
      onChanged();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setRemovingId(null);
    }
  }

  // 제출 후(readOnly) 첨부가 하나도 없으면 섹션 자체를 숨겨 화면을 비우지 않는다.
  if (readOnly && files.length === 0) return null;

  return (
    <div className="pt-1">
      <div
        className="flex items-center gap-1.5"
        style={{ fontSize: 11.5, fontWeight: 600, color: T.grey600, marginBottom: 6 }}
      >
        <Paperclip size={12} /> 증빙 자료
        {files.length > 0 && (
          <span style={{ color: T.grey400, fontWeight: 400 }}>{files.length}개</span>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-1" style={{ marginBottom: readOnly ? 0 : 8 }}>
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ border: '1px solid rgba(202,196,210,0.5)', background: '#f8f9fd' }}
            >
              <button
                type="button"
                onClick={() => openFile(f)}
                disabled={downloadingId === f.id}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left disabled:opacity-50"
                title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
              >
                {downloadingId === f.id ? (
                  <Loader2 size={13} className="animate-spin" color={T.grey500} />
                ) : isEvidencePreviewable(f.mimeType) ? (
                  <Eye size={13} color={K.secondary} style={{ flexShrink: 0 }} />
                ) : (
                  <Download size={13} color={K.secondary} style={{ flexShrink: 0 }} />
                )}
                <span className="truncate" style={{ fontSize: 12, color: T.grey800 }}>
                  {f.filename}
                </span>
                <span style={{ fontSize: 10.5, color: T.grey400, flexShrink: 0 }} className="tabular-nums">
                  {fmtBytes(f.size)}
                </span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void handleRemove(f)}
                  disabled={removingId === f.id}
                  className="disabled:opacity-50"
                  title="삭제"
                  style={{ flexShrink: 0, color: '#ba1a1a' }}
                >
                  {removingId === f.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 disabled:opacity-60"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#484551',
              border: '1px solid rgba(202,196,210,0.6)',
              borderRadius: 6,
              background: '#fff',
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> 업로드 중…
              </>
            ) : (
              <>
                <Paperclip size={13} /> 파일 첨부
              </>
            )}
          </button>
          <p style={{ fontSize: 10.5, color: T.grey400, marginTop: 4 }}>
            문서·이미지·압축 파일, 1개당 10MB 이하
          </p>
        </>
      )}

      <EvidencePreview
        evaluationId={evaluationId}
        file={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const c = gradeChipColor[grade] ?? gradeChipColor.B;
  return (
    <span className="px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {grade}
    </span>
  );
}

function SelfSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </PageContainer>
  );
}
