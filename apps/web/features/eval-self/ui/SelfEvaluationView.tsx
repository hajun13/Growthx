'use client';

/**
 * SelfEvaluationView — 본인평가 메인 뷰.
 * EnergyX DS 표준 패턴: PageContainer + PageHeader + InfoBanner + Card + StatCard.
 * const K/T 및 인라인 style 제거. raw button/input/textarea → DS Button/Input.
 * 파일 200줄 상한 준수 위해 KpiCard·EvidenceSection·SelfProgressCard 분리.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Send, Info } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { Collapsible } from '@/components/Collapsible';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { SelfProgressCard } from './SelfProgressCard';
import { KpiCard } from './KpiCard';
import {
  useSelfEvaluations,
  useSelfEvaluationDetail,
  useSelfEvidence,
  useMyKpis,
  useSelfRuleSet,
} from '../hooks';
import { createSelfEvaluation, patchEvaluation, submitEvaluation } from '../api';
import type { Kpi, KpiGroup, Grade, EvaluationEvidence } from '@/lib/types';

interface AchInput {
  actualValue?: number;
  count?: number;
  actualAmount?: number;
  qualitativeNote?: string;
  directGrade?: Grade;
}

function errInfo(err: unknown): { code?: string; message?: string } {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown };
    return {
      code: typeof e.code === 'string' ? e.code : undefined,
      message: typeof e.message === 'string' ? e.message : undefined,
    };
  }
  return {};
}

function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

const GROUP_CFG: Record<KpiGroup, { label: string; color: string }> = {
  performance_core: { label: '성과중심 지표', color: '#7A37D8' },
  collaboration_growth: { label: '협업·성장 지표', color: '#128240' },
};

export function SelfEvaluationView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const { data: selfEvals, loading: evalLoading, error: evalError, reload: reloadEvals } =
    useSelfEvaluations(cycleId, user?.id);
  const selfEval = selfEvals?.[0] ?? null;

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useSelfEvaluationDetail(selfEval?.id ?? null);

  const { data: evidenceData, reload: reloadEvidence } = useSelfEvidence(selfEval?.id ?? null);
  const evidenceByKpi = useMemo(() => {
    const map = new Map<string, EvaluationEvidence[]>();
    for (const e of evidenceData ?? []) {
      map.set(e.kpiId, [...(map.get(e.kpiId) ?? []), e]);
    }
    return map;
  }, [evidenceData]);

  const { data: myKpis, loading: kpiLoading } = useMyKpis(cycleId, user?.id);
  const { data: ruleSet } = useSelfRuleSet(current?.ruleSetId ?? null);
  const allKpis: Kpi[] = myKpis ?? [];
  const kpis = useMemo(() => allKpis.filter((k) => k.status === 'confirmed'), [allKpis]);

  const pendingStatusLabel = useMemo(() => {
    if (allKpis.some((k) => k.status === 'approved')) return '승인 완료 · HR 확정 대기중';
    if (allKpis.some((k) => k.status === 'submitted')) return '제출 완료 · 팀장·HR 검토 대기중';
    if (allKpis.some((k) => k.status === 'rejected' || k.status === 'revision_requested'))
      return '반려됨 · 보완 후 재제출이 필요해요';
    return '작성중 · 제출이 필요해요';
  }, [allKpis]);

  const readOnly = selfEval?.status === 'submitted' || selfEval?.status === 'finalized';
  const [inputs, setInputs] = useState<Record<string, AchInput>>({});
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!detail) return;
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));
    const next: Record<string, AchInput> = {};
    for (const s of detail.kpiScores) {
      const kpi = kpiMap.get(s.kpiId);
      if (!kpi) continue;
      if (kpi.measureType === 'count') next[s.kpiId] = { count: s.achievementRate ?? undefined };
      else if (kpi.measureType === 'qualitative') next[s.kpiId] = { qualitativeNote: s.selfNote ?? '', directGrade: s.grade ?? undefined };
      else if (isAbsoluteAmount(kpi)) next[s.kpiId] = { actualAmount: s.actualAmount ?? undefined };
      else next[s.kpiId] = { actualValue: s.achievementRate ?? undefined };
    }
    setInputs((prev) => ({ ...next, ...prev }));
  }, [detail?.id, kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreByKpi = useMemo(() => {
    const map = new Map();
    for (const s of detail?.kpiScores ?? []) map.set(s.kpiId, s);
    return map;
  }, [detail?.kpiScores]);

  function updateInput(kpiId: string, patch: AchInput) {
    setInputs((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  const isComplete = (k: Kpi): boolean => {
    const inp = inputs[k.id] ?? {};
    if (k.measureType === 'qualitative') return !!inp.directGrade;
    if (isAbsoluteAmount(k)) return inp.actualAmount !== undefined;
    const v = k.measureType === 'count' ? inp.count : inp.actualValue;
    return v !== undefined;
  };

  // 개별 KPI 카드 펼침 상태: 완료 항목은 기본 접힘, 미완료는 기본 펼침.
  // 제출 완료 상태면 모두 접힘(읽기 전용 요약만).
  function isKpiOpen(kpiId: string): boolean {
    if (kpiId in openMap) return openMap[kpiId];
    if (readOnly) return false;
    const kpi = kpis.find((k) => k.id === kpiId);
    return kpi ? !isComplete(kpi) : true;
  }
  function toggleKpi(kpiId: string) {
    setOpenMap((prev) => ({ ...prev, [kpiId]: !isKpiOpen(kpiId) }));
  }

  const totalCount = kpis.length;
  const doneCount = kpis.filter(isComplete).length;
  const missingCount = totalCount - doneCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const canSubmit = !readOnly && !!selfEval && kpis.length > 0 && missingCount === 0;

  async function save(): Promise<boolean> {
    if (!selfEval) return false;
    const kpiScores = kpis.map((k) => {
      const inp = inputs[k.id] ?? {};
      if (k.measureType === 'qualitative') {
        if (!inp.directGrade) return null;
        return { kpiId: k.id, directGrade: inp.directGrade, selfNote: inp.qualitativeNote ?? '', weight: k.weight };
      }
      if (isAbsoluteAmount(k)) {
        if (inp.actualAmount === undefined) return null;
        return { kpiId: k.id, actualAmount: inp.actualAmount, weight: k.weight };
      }
      const ach = k.measureType === 'count' ? inp.count : inp.actualValue;
      if (ach === undefined) return null;
      return { kpiId: k.id, achievementRate: ach, weight: k.weight };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    try {
      await patchEvaluation(selfEval.id, { kpiScores });
      reloadDetail();
      return true;
    } catch (err) {
      toast.show({ variant: 'danger', message: errInfo(err).message ?? '저장에 실패했어요.' });
      return false;
    }
  }

  async function confirmSubmit() {
    if (!selfEval) return;
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const saved = await save();
      if (!saved) return;
      await submitEvaluation(selfEval.id);
      toast.show({ variant: 'success', message: '본인평가를 제출했어요.' });
      reloadEvals();
    } catch (err) {
      const { code, message } = errInfo(err);
      const msg =
        code === 'COMMENT_REQUIRED' ? '평가 코멘트를 작성해야 제출할 수 있어요.'
        : code === 'POOL_EXCEEDED' ? '그룹 등급 풀 상한을 초과했어요.'
        : message ?? '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSelf() {
    if (!cycleId || !user) return;
    setCreateBusy(true);
    try {
      await createSelfEvaluation(cycleId, user.id);
      toast.show({ variant: 'success', message: '본인평가를 시작했어요.' });
      reloadEvals();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: errInfo(err).code === 'ALREADY_EXISTS'
          ? '이미 시작한 본인평가가 있어요.'
          : '본인평가를 시작하지 못했어요.',
      });
      reloadEvals();
    } finally {
      setCreateBusy(false);
    }
  }

  // ── 스켈레톤 / 에러 / 특수 상태 ──────────────────────────────
  if (cyclesLoading || (evalLoading && !selfEvals)) return <SelfSkeleton />;
  if (evalError) return <ErrorState onRetry={reloadEvals} />;
  if (user?.evaluationExempt)
    return (
      <EmptyState
        title="이번 평가 대상이 아니에요."
        description="하반기 입사 등으로 이번 주기 평가에서 제외되었어요. 자세한 내용은 인사팀에 문의해 주세요."
      />
    );
  if (!current) return <EmptyState title="지금은 본인평가 기간이 아니에요." />;

  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');

  return (
    <PageContainer>
      <PageHeader
        title="본인평가"
        subtitle="내가 세운 등급 기준에 따라 과제별로 달성 등급을 평가하세요. 수치 과제는 실적을 입력하면 등급이 자동 산정돼요."
        right={
          <>
            {selfEval && kpis.length > 0 && (
              <SelfProgressCard
                totalCount={totalCount}
                doneCount={doneCount}
                progressPct={progressPct}
                missingCount={missingCount}
              />
            )}
            {selfEval && (
              <StatusBadge status={selfEval.status as 'not_started' | 'in_progress' | 'submitted' | 'finalized'} />
            )}
            {selfEval && !readOnly && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void save()}
                  leftIcon={<Save size={14} aria-hidden />}
                >
                  임시저장
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSubmit}
                  loading={submitting}
                  leftIcon={<Send size={14} aria-hidden />}
                >
                  제출하기
                </Button>
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <InfoBanner tone="success" title="본인평가 제출 완료">
          본인평가가 제출되었습니다. 부서장 평가가 진행돼요.
        </InfoBanner>
      )}

      {/* 미시작 상태 */}
      {!selfEval ? (
        <div className="bg-card rounded-lg shadow-elev-1 border border-border px-6 py-12 text-center">
          <p className="text-[15px] font-bold text-foreground">아직 본인평가를 시작하지 않았어요.</p>
          <p className="text-[13px] text-muted-foreground mt-1.5 mb-5">
            시작하면 KPI별 실적을 입력할 수 있어요.
          </p>
          <Button
            variant="primary"
            onClick={() => void handleCreateSelf()}
            loading={createBusy}
          >
            본인평가 시작하기
          </Button>
        </div>
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        allKpis.length === 0 ? (
          <div className="bg-card rounded-lg shadow-elev-1 border border-border px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-foreground">아직 작성한 KPI가 없어요.</p>
            <p className="text-[13px] text-muted-foreground mt-1.5 mb-5">
              KPI 작성에서 과제를 등록하고 제출해 주세요.
            </p>
            <Link href="/kpi">
              <Button variant="primary" className="inline-flex">KPI 작성하기</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow-elev-1 border border-border px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-foreground">KPI가 확정되면 본인평가를 입력할 수 있어요.</p>
            <p className="text-[13px] text-muted-foreground mt-1.5 mb-1">
              제출한 KPI는 <b className="text-foreground">팀장·HR의 검토·확정</b> 후 본인평가 대상이 됩니다.
            </p>
            <p className="text-[13px] text-muted-foreground mb-5">
              현재 상태 — <b className="text-primary">{pendingStatusLabel}</b>
            </p>
            <Link href="/kpi">
              <Button variant="secondary" className="inline-flex">KPI 현황 보기</Button>
            </Link>
          </div>
        )
      ) : (
        <>
          {/* 안내 배너 */}
          <InfoBanner tone="info" title="등급 기준 안내">
            <span className="flex items-center gap-1">
              <Info size={13} aria-hidden />
              과제마다 내가 세운 <b>등급 부여 기준</b>이 함께 표시돼요. 정성 과제는 달성한 기준의 등급을 직접 선택하고, 수치 과제는 실적을 입력하면 등급이 자동 산정돼요.
            </span>
          </InfoBanner>

          {/* 그룹별 KPI 카드 */}
          {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
            const rows = group === 'performance_core' ? coreKpis : growthKpis;
            if (rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-1 h-[15px] rounded-sm"
                    style={{ background: cfg.color }}
                    aria-hidden
                  />
                  <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                  <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                </div>
                {rows.map((kpi) => {
                  const done = isComplete(kpi);
                  const score = scoreByKpi.get(kpi.id);
                  const liveGrade =
                    kpi.measureType === 'qualitative'
                      ? (inputs[kpi.id]?.directGrade ?? score?.grade)
                      : score?.grade;
                  return (
                    <Collapsible
                      key={kpi.id}
                      open={isKpiOpen(kpi.id)}
                      onToggle={() => toggleKpi(kpi.id)}
                      header={
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold text-white shrink-0"
                            style={{ background: cfg.color }}
                          >
                            {kpi.category}
                          </span>
                          <span className="text-[13.5px] font-semibold text-foreground truncate">
                            {kpi.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            가중치 {kpi.weight}%
                          </span>
                          {liveGrade ? (
                            <span
                              className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                              style={{ background: cfg.color }}
                            >
                              {liveGrade}등급
                            </span>
                          ) : done ? (
                            <span className="shrink-0 text-[11px] font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                              완료
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] font-semibold text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full">
                              미완료
                            </span>
                          )}
                        </div>
                      }
                      bodyClassName="p-0"
                    >
                      <KpiCard
                        kpi={kpi}
                        groupColor={cfg.color}
                        score={scoreByKpi.get(kpi.id) ?? null}
                        inp={inputs[kpi.id] ?? {}}
                        readOnly={readOnly}
                        ruleSet={ruleSet}
                        evaluationId={selfEval.id}
                        evidenceFiles={evidenceByKpi.get(kpi.id) ?? []}
                        onUpdateInput={updateInput}
                        onEvidenceChanged={reloadEvidence}
                      />
                    </Collapsible>
                  );
                })}
              </div>
            );
          })}

          {/* 하단 고정 바 */}
          {!readOnly && (
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex items-center justify-between flex-wrap gap-3 bg-background/90 backdrop-blur-sm border-t border-border px-6 py-3">
              <p className="text-[13px] text-muted-foreground">
                <span className="font-bold text-foreground">{doneCount}</span>/{totalCount}건 완료
                {missingCount > 0 ? (
                  <span className="text-[#C8353A] ml-1.5">· 미완료 {missingCount}건</span>
                ) : (
                  <span className="text-[#128240] ml-1.5">· 모두 완료했어요</span>
                )}
              </p>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void save()}
                  leftIcon={<Save size={14} aria-hidden />}
                >
                  임시저장
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSubmit}
                  loading={submitting}
                  leftIcon={<Send size={14} aria-hidden />}
                >
                  제출하기
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 제출 확인 모달 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="본인평가를 제출할까요?"
        primaryAction={{ label: '제출', variant: 'primary', onClick: () => void confirmSubmit() }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          제출하면 내용을 수정할 수 없어요.<br />
          <span className="text-primary font-semibold">{doneCount}개</span> 과제 평가가 부서장에게 전달됩니다.
        </p>
      </Modal>
    </PageContainer>
  );
}

function SelfSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </PageContainer>
  );
}
