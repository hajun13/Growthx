'use client';

/**
 * SelfEvaluationView — 본인평가 메인 뷰.
 * EnergyX DS 표준 패턴: PageContainer + PageHeader + InfoBanner + Card + StatCard.
 * const K/T 및 인라인 style 제거. raw button/input/textarea → DS Button/Input.
 * 파일 200줄 상한 준수 위해 KpiCard·EvidenceSection·SelfProgressCard 분리.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { SelfProgressCard } from './SelfProgressCard';
import { KpiGroupList, type AchInput } from './KpiGroupList';
import {
  EmptyBlock,
  ErrorBlock,
  LinkButton,
  PromptCard,
  SelfSkeleton,
  SentBackBanner,
  WindowClosedBanner,
} from './SelfStates';
import {
  useSelfEvaluations,
  useSelfEvaluationDetail,
  useSelfEvidence,
  useMyKpis,
  useSelfRuleSet,
} from '../hooks';
import { createSelfEvaluation, patchEvaluation, submitEvaluation, fetchSelfReviewHistory } from '../api';
import { evalWindow, formatEvalWindow } from '@/lib/evalWindow';
import type { Kpi, KpiScore, EvaluationEvidence } from '@/lib/types';

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

export function SelfEvaluationView() {
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  // 제출 기한 · 평가 기간(창) — 운영 일정(current-phase.schedules)에서 본인평가 창을 판정.
  // 전용 self 단계가 없으면 최종평가(final_review) 창을 적용(백엔드 assertEvalWindowOpen 과 동일).
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });
  const isHrAdmin = user?.role === 'hr_admin';
  const win = useMemo(() => evalWindow(phase?.schedules, 'self'), [phase?.schedules]);
  // 창 밖이면 작성·제출 차단(hr_admin 은 면제 — 대리·보정 상시 가능).
  const windowClosed = win.configured && !win.open && !isHrAdmin;
  const selfDeadline = win.due ? win.due.toISOString() : null;
  const deadlineStr = selfDeadline
    ? new Date(selfDeadline).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '미설정';
  const deadlineImminent =
    !!selfDeadline && new Date(selfDeadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

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
    if (allKpis.some((k) => k.status === 'approved')) return '결재 진행중 · 상위 결재자 승인 대기중';
    if (allKpis.some((k) => k.status === 'submitted')) return '제출 완료 · 1차 결재 대기중';
    // 백엔드 KPI reject 는 status 를 'draft' + rejectReason 으로 되돌린다('rejected' 상태 없음).
    if (
      allKpis.some(
        (k) =>
          k.status === 'rejected' ||
          k.status === 'revision_requested' ||
          (k.status === 'draft' && k.rejectReason != null),
      )
    )
      return '반려됨 · 보완 후 재제출이 필요해요';
    return '작성중 · 제출이 필요해요';
  }, [allKpis]);

  const readOnly = selfEval?.status === 'submitted' || selfEval?.status === 'finalized';
  // 상급자 반려/수정요청 상태 — 편집 가능(재제출 필요), 최신 사유를 배너로 노출.
  const sentBack = selfEval?.status === 'revision_requested' || selfEval?.status === 'rejected';
  const [sendBackReason, setSendBackReason] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, AchInput>>({});
  // 미저장 입력 여부 — 이탈(beforeunload) 경고용. 저장 성공 시 해제.
  const [dirty, setDirty] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 제출 재진입 락(동기) — 모달 '제출' 더블클릭이 리렌더보다 빨라 submitting 상태가
  // 아직 false 로 보이는 경합에서 PATCH(deleteMany+create)·submit 이 2회 나가는 것 차단.
  const submitLockRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!selfEval?.id || !sentBack) {
      setSendBackReason(null);
      return;
    }
    fetchSelfReviewHistory(selfEval.id)
      .then((rows) => {
        if (cancelled) return;
        const latest = rows.find((r) => r.kind === 'revision_requested' || r.kind === 'rejected');
        setSendBackReason(latest?.reason ?? null);
      })
      .catch(() => { if (!cancelled) setSendBackReason(null); });
    return () => { cancelled = true; };
  }, [selfEval?.id, sentBack]);

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
    const map = new Map<string, KpiScore>();
    for (const s of detail?.kpiScores ?? []) map.set(s.kpiId, s);
    return map;
  }, [detail?.kpiScores]);

  function updateInput(kpiId: string, patch: AchInput) {
    setInputs((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
    setDirty(true);
  }

  // 미저장 입력이 있으면 페이지 이탈(새로고침/닫기) 경고 — DeptHeadEvalView 와 동일 패턴.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, readOnly]);

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

  async function save(showSuccessToast = true): Promise<boolean> {
    if (!selfEval) return false;
    // KPI/상세 로딩 완료 전에는 저장 금지 — inputs/kpis 미적재 상태로 빈 kpiScores 를
    // 전송하면 백엔드 PATCH(deleteMany)가 저장된 실적을 전부 삭제한다.
    if (kpiLoading || detailLoading || saving) return false;
    // 평가 기간(창) 밖 — 버튼 disabled 와 별개로 함수 차원에서도 차단(DeptHeadEvalView 와 동일).
    // 안 막으면 호출이 그대로 나가 백엔드 403(EVAL_WINDOW_CLOSED)으로 떨어진다.
    if (windowClosed) {
      toast.error(`지금은 본인평가 기간이 아니에요. (${formatEvalWindow(win)})`, { duration: 8000 });
      return false;
    }
    const kpiScores = kpis.map((k) => {
      const inp = inputs[k.id] ?? {};
      if (k.measureType === 'qualitative') {
        const note = (inp.qualitativeNote ?? '').trim();
        // 등급 또는 근거 메모 중 하나라도 있으면 전송(메모만 있어도 저장되도록).
        if (!inp.directGrade && !note) return null;
        return {
          kpiId: k.id,
          ...(inp.directGrade ? { directGrade: inp.directGrade } : {}),
          selfNote: inp.qualitativeNote ?? '',
          weight: k.weight,
        };
      }
      if (isAbsoluteAmount(k)) {
        if (inp.actualAmount === undefined) return null;
        return { kpiId: k.id, actualAmount: inp.actualAmount, weight: k.weight };
      }
      const ach = k.measureType === 'count' ? inp.count : inp.actualValue;
      if (ach === undefined) return null;
      return { kpiId: k.id, achievementRate: ach, weight: k.weight };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    setSaving(true);
    try {
      await patchEvaluation(selfEval.id, { kpiScores });
      setDirty(false);
      reloadDetail();
      if (showSuccessToast) toast.success('임시저장했어요.');
      return true;
    } catch (err) {
      toast.error(errInfo(err).message ?? '저장에 실패했어요.', { duration: 8000 });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmSubmit() {
    if (!selfEval) return;
    // 평가 기간(창) 밖 — 제출 차단(DeptHeadEvalView confirmSubmit 과 동일 가드).
    if (windowClosed) {
      setConfirmOpen(false);
      toast.error(`지금은 본인평가 기간이 아니에요. (${formatEvalWindow(win)})`, { duration: 8000 });
      return;
    }
    if (submitLockRef.current) return; // 동기 재진입 차단(더블클릭).
    submitLockRef.current = true;
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const saved = await save(false);
      if (!saved) return;
      await submitEvaluation(selfEval.id);
      toast.success('본인평가를 제출했어요.');
      reloadEvals();
    } catch (err) {
      const { code, message } = errInfo(err);
      const msg =
        code === 'COMMENT_REQUIRED' ? '평가 코멘트를 작성해야 제출할 수 있어요.'
        : code === 'POOL_EXCEEDED' ? '전사 등급풀 상한을 초과했어요.'
        : message ?? '제출에 실패했어요.';
      toast.error(msg, { duration: 8000 });
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  async function handleCreateSelf() {
    if (!cycleId || !user) return;
    if (windowClosed) {
      toast.error(`지금은 본인평가 기간이 아니에요. (${formatEvalWindow(win)})`, { duration: 8000 });
      return;
    }
    setCreateBusy(true);
    try {
      await createSelfEvaluation(cycleId, user.id);
      toast.success('본인평가를 시작했어요.');
      reloadEvals();
    } catch (err) {
      toast.error(
        errInfo(err).code === 'ALREADY_EXISTS'
          ? '이미 시작한 본인평가가 있어요.'
          : '본인평가를 시작하지 못했어요.',
        { duration: 8000 },
      );
      reloadEvals();
    } finally {
      setCreateBusy(false);
    }
  }

  // ── 스켈레톤 / 에러 / 특수 상태 ──────────────────────────────
  if (cyclesLoading || (evalLoading && !selfEvals)) return <SelfSkeleton />;
  if (evalError) return <ErrorBlock onRetry={reloadEvals} />;
  if (user?.evaluationExempt)
    return (
      <EmptyBlock
        title="이번 평가 대상이 아니에요."
        description="하반기 입사 등으로 이번 주기 평가에서 제외되었어요. 자세한 내용은 인사팀에 문의해 주세요."
      />
    );
  if (!current) return <EmptyBlock title="지금은 본인평가 기간이 아니에요." />;

  return (
    <PageContainer>
      <PageHeader
        title="본인평가"
        subtitle="내가 세운 등급 기준에 따라 과제별로 달성 등급을 평가하세요. 수치 과제는 실적을 입력하면 등급이 자동 산정돼요."
        right={
          <>
            <HeaderMetrics
              items={[
                {
                  label: '제출 기한',
                  value: deadlineStr,
                  accent: deadlineImminent ? 'text-danger-600' : undefined,
                },
              ]}
            />
            {selfEval && kpis.length > 0 && (
              <SelfProgressCard
                totalCount={totalCount}
                doneCount={doneCount}
                progressPct={progressPct}
                missingCount={missingCount}
              />
            )}
            {selfEval && (
              <StatusBadge status={selfEval.status} />
            )}
            {selfEval && !readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void save()}
                  disabled={kpiLoading || detailLoading || saving || windowClosed}
                  loading={saving}
                >
                  {!saving && <Save aria-hidden />}
                  임시저장
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSubmit || windowClosed}
                  loading={submitting}
                >
                  {!submitting && <Send aria-hidden />}
                  제출하기
                </Button>
              </>
            )}
          </>
        }
      />

      {/* 평가 기간(창) 밖 — 작성·제출 차단 안내 */}
      {windowClosed && <WindowClosedBanner windowText={formatEvalWindow(win)} />}

      {/* 상급자 반려/수정요청 배너 — 사유 표시 + 보완 후 재제출 안내 */}
      {sentBack && (
        <SentBackBanner rejected={selfEval?.status === 'rejected'} reason={sendBackReason} />
      )}

      {/* 미시작 상태 */}
      {!selfEval ? (
        <PromptCard>
          <p className="text-15 font-bold text-foreground">아직 본인평가를 시작하지 않았어요.</p>
          <p className="mb-5 mt-1.5 text-13 text-muted-foreground">
            시작하면 KPI별 실적을 입력할 수 있어요.
          </p>
          <Button
            onClick={() => void handleCreateSelf()}
            loading={createBusy}
            disabled={windowClosed}
          >
            본인평가 시작하기
          </Button>
        </PromptCard>
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        allKpis.length === 0 ? (
          <PromptCard>
            <p className="text-15 font-bold text-foreground">아직 작성한 KPI가 없어요.</p>
            <p className="mb-5 mt-1.5 text-13 text-muted-foreground">
              KPI 작성에서 과제를 등록하고 제출해 주세요.
            </p>
            <LinkButton href="/kpi" variant="default">KPI 작성하기</LinkButton>
          </PromptCard>
        ) : (
          <PromptCard>
            <p className="text-15 font-bold text-foreground">KPI가 확정되면 본인평가를 입력할 수 있어요.</p>
            <p className="mb-1 mt-1.5 text-13 text-muted-foreground">
              제출한 KPI는 <b className="text-foreground">팀장·HR의 검토·확정</b> 후 본인평가 대상이 됩니다.
            </p>
            <p className="mb-5 text-13 text-muted-foreground">
              현재 상태 — <b className="text-primary">{pendingStatusLabel}</b>
            </p>
            <LinkButton href="/kpi" variant="outline">KPI 현황 보기</LinkButton>
          </PromptCard>
        )
      ) : (
        <>
          {/* 그룹별 KPI 카드 */}
          <KpiGroupList
            kpis={kpis}
            inputs={inputs}
            scoreByKpi={scoreByKpi}
            readOnly={readOnly}
            ruleSet={ruleSet}
            evaluationId={selfEval.id}
            evidenceByKpi={evidenceByKpi}
            isComplete={isComplete}
            isKpiOpen={isKpiOpen}
            onToggle={toggleKpi}
            onUpdateInput={updateInput}
            onEvidenceChanged={reloadEvidence}
          />

          {!readOnly && (
            <EvaluationActionPanel
              sticky
              message={
                missingCount > 0
                  ? `미완료 ${missingCount}건을 입력해야 제출할 수 있어요.`
                  : '모든 과제 입력이 완료됐어요.'
              }
              summary={
                <p className="text-12 text-muted-foreground">
                  <span className="font-bold text-foreground">{doneCount}</span>/{totalCount}건 완료
                  {missingCount > 0 ? (
                    <span className="ml-1.5 text-destructive">· 미완료 {missingCount}건</span>
                  ) : (
                    <span className="ml-1.5 text-success-700">· 모두 완료했어요</span>
                  )}
                </p>
              }
              actions={
                <>
                  {/* 헤더 버튼과 동일하게 평가 창 밖(windowClosed)이면 비활성 — 하단 패널만 살아 보이면 눌러도 403. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void save()}
                    disabled={kpiLoading || detailLoading || saving || windowClosed}
                    loading={saving}
                  >
                    {!saving && <Save aria-hidden />}
                    임시저장
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canSubmit || windowClosed}
                    loading={submitting}
                  >
                    {!submitting && <Send aria-hidden />}
                    제출하기
                  </Button>
                </>
              }
            />
          )}
        </>
      )}

      {/* 제출 확인 모달 */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent size="sm" layout="scroll-footer" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>본인평가를 제출할까요?</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto text-sm text-foreground">
            <p className="text-13 leading-relaxed text-muted-foreground">
              제출하면 부서장 검토가 시작돼요. 검토자가 반려하면 다시 수정할 수 있어요.<br />
              <span className="font-semibold text-primary">{doneCount}개</span> 과제 평가가 부서장에게 전달됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void confirmSubmit()}>제출</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
