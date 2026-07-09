'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, ChevronLeft, History } from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { evalWindow, formatEvalWindow } from '@/lib/evalWindow';
import { EvidencePreview } from '@/components/EvidencePreview';
import { useKpis } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { Card } from '@/components/Card';
import { Collapsible } from '@/components/Collapsible';
import { DesignLabel } from '@/components/DesignLabel';
import { FilterChipBar } from '@/components/FilterChipBar';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';

import { fmtScore, getPositionLabel, STAGE_LABEL } from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { Modal } from '@/components/Modal';
import type {
  Grade,
  Evaluation,
  Kpi,
  KpiScore,
  EvaluationEvidence,
  EvaluationReviewHistory,
} from '@/lib/types';
import {
  useEvaluations,
  useEvaluationDetail,
  useEvaluationEvidence,
  useEvaluatorChain,
} from '../hooks';
import { deptHeadCommands, fetchEvaluationHistory } from '../api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DeptHeadKpiGroupList } from './DeptHeadKpiGroupList';
import { GradePicker } from './DeptHeadHelpers';

// 다단계 평가 단계 라벨(round) — lib/ui STAGE_LABEL 단일 소스(화면별 표기 분열 방지).
// 1·2차 평가자는 피평가자에 따라 다르다(직원=팀장·본부장 / 팀장=본부장·부그룹장 /
// 본부장=부그룹장) — 역할 고정 표기 금지.
const ROUND_LABEL: Record<number, string> = {
  1: STAGE_LABEL.d1,
  2: STAGE_LABEL.d2,
  3: STAGE_LABEL.d3,
};

// 좌측 목록 상태 필터(전체/대기/평가중/완료).
const STATUS_FILTER_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: 'waiting', label: '대기' },
  { value: 'inprog', label: '평가중' },
  { value: 'done', label: '완료' },
];

// 갭 #2 — 실제 매출 절대금액으로 등급을 매기는 KPI 판정.
function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

// 코멘트 작성 시각 표시(요일 생략, 분단위).
function fmtHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DeptHeadEvalView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  // 평가 기간(창) — 운영 일정의 부서장평가 단계(전용 downward 없으면 final_review) 창.
  // 창 밖이면 작성·제출 차단(hr_admin 면제). 백엔드 assertEvalWindowOpen 과 동일 규칙.
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });
  const win = useMemo(() => evalWindow(phase?.schedules, 'downward'), [phase?.schedules]);
  const windowClosed = win.configured && !win.open && user?.role !== 'hr_admin';

  const allowed = !!user && canEvaluateDownward(user.role);

  const { data: evals, loading, error, reload } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');
  const [kpiOpenMap, setKpiOpenMap] = useState<Record<string, boolean>>({});

  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

  // 평가 단계 체인(1차→2차→최종) — KPI 결재선·중간점검과 동일 원천. 표시 전용(순차 아님).
  const { data: chainData } = useEvaluatorChain(activeEval?.evaluateeId ?? null);
  const evaluatorChain = chainData ?? [];

  const { data: selfEvals, loading: selfListLoading, reload: reloadSelf } = useEvaluations(
    { cycleId, evaluateeId: activeEval?.evaluateeId, type: 'self' },
    { enabled: !!cycleId && !!activeEval?.evaluateeId },
  );
  const selfEval = selfEvals?.data[0] ?? null;
  const { data: selfDetail, loading: selfDetailLoading } = useEvaluationDetail(
    selfEval?.id ?? null,
  );
  const selfLoading = selfListLoading || selfDetailLoading;
  const selfSubmitted =
    selfEval?.status === 'submitted' || selfEval?.status === 'finalized';

  const selfScoreByKpi = useMemo(() => {
    const m = new Map<string, KpiScore>();
    for (const s of selfDetail?.kpiScores ?? []) m.set(s.kpiId, s);
    return m;
  }, [selfDetail?.kpiScores]);

  const { data: evidenceData } = useEvaluationEvidence(selfEval?.id ?? null);
  const evidenceByKpi = useMemo(() => {
    const m = new Map<string, EvaluationEvidence[]>();
    for (const e of evidenceData?.data ?? []) {
      const arr = m.get(e.kpiId) ?? [];
      arr.push(e);
      m.set(e.kpiId, arr);
    }
    return m;
  }, [evidenceData]);
  const [previewFile, setPreviewFile] = useState<EvaluationEvidence | null>(null);

  const { data: kpiData, loading: kpiLoading } = useKpis(
    { cycleId, userId: activeEval?.evaluateeId },
    { enabled: !!cycleId && !!activeEval },
  );
  const kpis: Kpi[] = useMemo(
    () => (kpiData?.data ?? []).filter((k) => k.status === 'confirmed'),
    [kpiData],
  );
  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');

  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);
  const revenueGradeScale = ruleSet?.weightPolicy.revenueGradeScale;

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');
  // 종합등급 직접 부여 섹션 펼침(제어형) — 피평가자 전환 시 초기화.
  const [overrideOpen, setOverrideOpen] = useState(false);
  // 미저장 상태에서 다른 피평가자 선택 시 확인 모달 대상 id.
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  // 본인평가 반려/수정요청 — 대상=구성원 selfEval, 게이트=본인평가 제출됨.
  const [sendBackKind, setSendBackKind] = useState<'revision' | 'reject' | null>(null);
  const [sendBackReason, setSendBackReason] = useState('');
  const [sendingBack, setSendingBack] = useState(false);
  // 평가 검토 이력(수정요청/반려/승인) — GET /evaluations/:id/history (selfEval 기준).
  const [history, setHistory] = useState<EvaluationReviewHistory[]>([]);
  // 미저장 변경 추적 — 피평가자 전환/페이지 이탈 시 작성 내용 유실 경고용(임시저장 미지원).
  const [dirty, setDirty] = useState(false);
  // 이중 전송 방지(연속 클릭이 state 반영보다 빠른 경우) + 재시도 시 코멘트 중복 등록 방지.
  const submitLockRef = useRef(false);
  const sendBackLockRef = useRef(false);
  const commentSentKeyRef = useRef<string | null>(null);

  // 미저장 변경이 있으면 페이지 이탈(새로고침/닫기) 경고.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, readOnly]);

  useEffect(() => {
    let cancelled = false;
    if (!selfEval?.id) {
      setHistory([]);
      return;
    }
    fetchEvaluationHistory(selfEval.id)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [selfEval?.id, selfEval?.status]);

  useEffect(() => {
    const restored: Record<string, Grade> = {};
    const restoredNotes: Record<string, string> = {};
    for (const s of detail?.kpiScores ?? []) {
      // 미평가(정성 등급 미선택) 항목은 grade 가 null — directGrades 에 넣지 않아 미선택 상태로 둔다.
      if (s.grade) restored[s.kpiId] = s.grade;
      if (s.reviewerNote) restoredNotes[s.kpiId] = s.reviewerNote;
    }
    setDirectGrades(restored);
    setReviewerNotes(restoredNotes);
    setComment('');
    setOverallGrade(activeEval?.overallGrade ?? null);
    setOverallReason(activeEval?.overallReason ?? '');
    // 피평가자 변경 시 KPI 펼침·종합등급 섹션 펼침 상태 초기화.
    setKpiOpenMap({});
    setOverrideOpen(false);
    setDirty(false);
  }, [activeEval?.id, detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  const hasOverallComment = comment.trim().length > 0;
  const feedbackMissing = !hasOverallComment;
  const reviewerNotesComplete = kpis.every(
    (k) => (reviewerNotes[k.id] ?? '').trim().length > 0,
  );
  const reviewerNotesMissing = kpis.length > 0 && !reviewerNotesComplete;
  const overrideReasonMissing =
    overallGrade !== null && overallReason.trim().length === 0;
  const canSubmit =
    !readOnly &&
    !!activeEval &&
    selfSubmitted &&
    qualitativeComplete &&
    !feedbackMissing &&
    !reviewerNotesMissing &&
    !overrideReasonMissing;

  // KPI 카드 완료 판정: 정성=directGrade 있음, 수치/절대금액은 점수 자동연동.
  // 공통 조건: reviewerNote 작성됨.
  function isKpiDone(kpi: Kpi): boolean {
    const noteOk = (reviewerNotes[kpi.id] ?? '').trim().length > 0;
    if (kpi.measureType === 'qualitative') return !!directGrades[kpi.id] && noteOk;
    return noteOk;
  }
  function isKpiOpen(kpiId: string): boolean {
    if (kpiId in kpiOpenMap) return kpiOpenMap[kpiId];
    if (readOnly) return false;
    const kpi = kpis.find((k) => k.id === kpiId);
    return kpi ? !isKpiDone(kpi) : true;
  }
  function toggleKpi(kpiId: string) {
    setKpiOpenMap((prev) => ({ ...prev, [kpiId]: !isKpiOpen(kpiId) }));
  }

  function handleSubmit() {
    setConfirmSubmitOpen(true);
  }

  // 임시저장/제출 공통 — 현재 입력값으로 kpiScores 페이로드 구성.
  // 정성 KPI 의 미선택 directGrade 는 undefined 전송(백엔드가 미평가 grade=null 처리).
  function buildKpiScores() {
    return kpis.map((k) => {
      const note = reviewerNotes[k.id]?.trim();
      const reviewerNote = note ? note : undefined;
      if (k.measureType === 'qualitative') {
        return { kpiId: k.id, directGrade: directGrades[k.id], weight: k.weight, reviewerNote };
      }
      const selfScore = selfScoreByKpi.get(k.id);
      if (isAbsoluteAmount(k)) {
        return { kpiId: k.id, actualAmount: selfScore?.actualAmount, weight: k.weight, reviewerNote };
      }
      return { kpiId: k.id, achievementRate: selfScore?.achievementRate, weight: k.weight, reviewerNote };
    });
  }

  // 임시저장 — 작성 중 내용(등급·과제 코멘트)을 PATCH 로 영속화해 피평가자 전환/이탈 시
  // 전량 유실되던 문제를 막는다(복원은 detail.kpiScores 재로딩 effect 가 담당).
  async function saveDraft() {
    if (!activeEval || readOnly || savingDraft || submitting) return;
    if (windowClosed) {
      toast.show({ variant: 'danger', message: `지금은 부서장 평가 기간이 아니에요. (${formatEvalWindow(win)})` });
      return;
    }
    // 수치 KPI 실적(selfScore) 미로딩 상태로 저장하면 achievementRate 가 undefined 로 전송된다.
    // 대상 전환 직후에는 detail 이 이전 대상의 stale 데이터라(useAsync 유지) 그대로 저장하면
    // 새 대상의 저장된 등급·코멘트가 undefined 로 덮여 소거된다 — 로딩·id 불일치 시 차단.
    if (selfLoading || detailLoading || (detail && detail.id !== activeEval.id)) {
      toast.show({ variant: 'info', message: '평가 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    if (kpis.length === 0) return;
    setSavingDraft(true);
    try {
      await deptHeadCommands.patch(activeEval.id, {
        kpiScores: buildKpiScores() as never,
        // 종합등급 오버라이드도 임시저장에 포함 — 제출 경로(confirmSubmit)와 동일 규칙.
        ...(overallGrade !== null
          ? { overallGrade: overallGrade as never, overallReason: overallReason.trim() }
          : activeEval.overallGrade != null
            ? ({ clearOverallGrade: true } as never)
            : {}),
      });
      toast.show({
        variant: 'success',
        message: hasOverallComment
          ? '임시저장했어요. 종합 코멘트는 제출 시에 등록돼요.'
          : '임시저장했어요.',
      });
      // 종합 코멘트는 저장 API 가 없어(제출 시 addComment) 코멘트 작성분이 있으면 dirty 유지 —
      // 전환/이탈 경고가 계속 뜨도록 해 무경고 유실을 막는다.
      setDirty(hasOverallComment);
      reloadDetail();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '임시저장에 실패했어요.',
      });
    } finally {
      setSavingDraft(false);
    }
  }

  // 본인평가 반려/수정요청 확정 — 사유 필수, 성공 시 구성원이 본인평가를 보완·재제출해야 한다.
  async function confirmSendBack() {
    if (!selfEval || !sendBackKind || !sendBackReason.trim()) return;
    if (sendBackLockRef.current) return; // 모달 더블클릭 이중 전송 차단
    sendBackLockRef.current = true;
    setSendingBack(true);
    try {
      const body = { reason: sendBackReason.trim() };
      if (sendBackKind === 'revision') await deptHeadCommands.requestRevision(selfEval.id, body);
      else await deptHeadCommands.reject(selfEval.id, body);
      toast.show({
        variant: 'success',
        message: sendBackKind === 'revision' ? '본인평가 수정을 요청했어요.' : '본인평가를 반려했어요.',
      });
      setSendBackKind(null);
      setSendBackReason('');
      reloadSelf();
      reloadDetail();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '처리에 실패했어요.' });
    } finally {
      sendBackLockRef.current = false;
      setSendingBack(false);
    }
  }

  async function confirmSubmit() {
    if (!activeEval) return;
    if (windowClosed) {
      setConfirmSubmitOpen(false);
      toast.show({ variant: 'danger', message: `지금은 부서장 평가 기간이 아니에요. (${formatEvalWindow(win)})` });
      return;
    }
    if (submitLockRef.current) return; // 모달 더블클릭 이중 전송 차단
    // 본인평가 실적(selfDetail)이 아직 로딩 중이면 제출을 막는다. 수치 KPI 의 실적은 selfScore
    // 에서 오는데, 미로딩 상태로 제출하면 achievementRate 가 undefined 로 전송되어 백엔드가
    // 해당 KPI 를 D 로 산정해 버린다(피평가자가 입력한 적 없는 등급이 총점에 산입).
    if (selfLoading) {
      toast.show({ variant: 'info', message: '본인평가 실적을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    submitLockRef.current = true;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    try {
      await deptHeadCommands.patch(activeEval.id, {
        kpiScores: buildKpiScores() as never,
        // 종합등급 오버라이드: 설정 시 등급·사유 전송, 해제(자동 산정 복귀) 시 clearOverallGrade.
        // 이전에 오버라이드가 있었을 때만 clear 를 보내 서버 저장값을 확실히 비운다(과거엔 해제해도
        // 키를 생략해 옛 오버라이드가 확정 시 최종등급으로 굳던 버그).
        ...(overallGrade !== null
          ? { overallGrade: overallGrade as never, overallReason: overallReason.trim() }
          : activeEval.overallGrade != null
            ? ({ clearOverallGrade: true } as never)
            : {}),
      });
      // patch→comment→submit 시퀀스에서 submit 만 실패한 뒤 재시도해도
      // 동일 코멘트가 중복 등록되지 않도록, 성공한 코멘트를 키로 기억한다.
      const commentKey = `${activeEval.id}:${activeEval.round ?? 1}:${comment.trim()}`;
      if (commentSentKeyRef.current !== commentKey) {
        await deptHeadCommands.addComment(activeEval.id, {
          quarter: activeEval.round ?? 1,
          content: comment.trim(),
        });
        commentSentKeyRef.current = commentKey;
      }
      await deptHeadCommands.submit(activeEval.id);
      commentSentKeyRef.current = null;
      setComment('');
      setDirty(false);
      // 연속 평가 동선 — 제출 직후 다음 미평가 대상(현재 다음 순서부터 순환 탐색)으로 자동 이동.
      const idx = targets.findIndex((t) => t.id === activeEval.id);
      const next = [...targets.slice(idx + 1), ...targets.slice(0, Math.max(idx, 0))].find(
        (t) => t.id !== activeEval.id && (t.status === 'not_started' || t.status === 'in_progress'),
      );
      if (next) {
        setSelectedId(next.id);
        toast.show({ variant: 'success', message: '제출 완료 — 다음 대상으로 이동했어요.' });
      } else {
        toast.show({ variant: 'success', message: '부서장 평가를 제출했어요. 모든 대상의 평가가 완료됐어요.' });
      }
      reload();
      reloadDetail();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'COMMENT_REQUIRED'
            ? '평가 코멘트를 작성해야 제출할 수 있어요.'
            : err.code === 'POOL_EXCEEDED'
              ? '전사 등급풀 상한을 초과했어요. 캘리브레이션이 필요해요.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  if (!allowed) return <Forbidden message="부서장 평가 권한이 없어요." />;
  if (cyclesLoading || (loading && !evals)) return <DeptHeadSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="지금은 부서장 평가 기간이 아니에요." />;

  const filtered = targets.filter((t) => {
    if (statusFilter === 'waiting' && t.status !== 'not_started') return false;
    if (statusFilter === 'inprog' && t.status !== 'in_progress') return false;
    if (statusFilter === 'done' && t.status !== 'submitted' && t.status !== 'finalized') return false;
    if (!search) return true;
    return (t.userName ?? t.evaluateeId).includes(search);
  });
  const subjectItems = filtered.map((t) => {
    const name = t.userName ?? t.evaluateeId.slice(0, 8);
    return {
      id: t.id,
      name,
      description: t.departmentName ?? null,
      active: t.id === activeEval?.id,
      onSelect: () => selectTarget(t.id),
      accessory: (
        <>
          {t.finalGrade && <GradeChip grade={t.finalGrade} size="sm" />}
          <StatusBadge status={t.status} />
        </>
      ),
    };
  });

  const summary = {
    total: targets.length,
    done: targets.filter((t) => t.status === 'submitted' || t.status === 'finalized').length,
    inprog: targets.filter((t) => t.status === 'in_progress').length,
    waiting: targets.filter((t) => t.status === 'not_started').length,
  };

  function selectTarget(id: string) {
    // 미저장 평가 내용이 있으면 전환 전 확인(공용 Modal) — 확인 없이 전환하면 유실된다.
    if (dirty && !readOnly && id !== activeEval?.id) {
      setPendingTargetId(id);
      return;
    }
    if (id !== activeEval?.id) setDirty(false);
    setSelectedId(id);
    setMobileView('panel');
  }

  // 전환 확인 모달의 "이동" — 미저장 내용을 버리고 대상 전환.
  function confirmSwitchTarget() {
    if (!pendingTargetId) return;
    setDirty(false);
    setSelectedId(pendingTargetId);
    setMobileView('panel');
    setPendingTargetId(null);
  }

  return (
    <PageContainer>
      <PageHeader
        title="부서장 평가"
        subtitle="구성원이 제출한 본인평가 실적을 확인하고, 정성 과제 등급과 평가 코멘트를 작성하세요."
        right={
          <>
            <HeaderMetrics
              items={[
                { label: '평가 대상', value: summary.total },
                { label: '평가 완료', value: summary.done },
                { label: '평가중', value: summary.inprog },
                {
                  label: '평가 대기',
                  value: summary.waiting,
                  accent: summary.waiting > 0 ? 'text-danger-600' : undefined,
                },
              ]}
            />
            {activeEval && <StatusBadge status={activeEval.status} />}
          </>
        }
      />

      {/* 평가 기간(창) 밖 — 작성·제출 차단 안내 */}
      {windowClosed && (
        <div
          className="rounded-md border px-4 py-3 text-[12.5px]"
          style={{ background: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}
          role="alert"
        >
          <b>지금은 부서장 평가 기간이 아니에요.</b> 평가 기간은 <b>{formatEvalWindow(win)}</b> 이에요. 이 기간에만 작성·제출할 수 있어요.
        </div>
      )}

      {targets.length === 0 ? (
        <EmptyState
          title="평가할 대상이 없어요."
          description="아직 부서장 평가가 배정되지 않았어요. HR이 배정을 완료하면 평가 대상이 표시돼요."
        />
      ) : (
        <div className="gx-master-detail">
          {/* ── 평가 대상 목록(상태 필터 + 검색) ── */}
          <div
            className={cn(
              mobileView === 'panel' ? 'hidden lg:block' : 'block',
              'space-y-2.5 self-start',
            )}
          >
            <FilterChipBar
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <EvaluationSubjectPanel
              title="평가 대상"
              count={targets.length}
              search={search}
              onSearch={setSearch}
              searchPlaceholder="이름 검색"
              emptyMessage="검색 결과가 없어요."
              items={subjectItems}
            />
          </div>

          {/* ── 평가 패널 ── */}
          <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block', 'space-y-4')}>
            {!activeEval ? (
              <Card>
                <p className="py-10 text-center text-[13px] text-muted-foreground">
                  좌측에서 평가 대상을 선택하세요.
                </p>
              </Card>
            ) : (
              <>
                {/* 모바일 뒤로 */}
                <div className="lg:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ChevronLeft size={14} />}
                    onClick={() => setMobileView('list')}
                  >
                    대상 목록
                  </Button>
                </div>

                <EvaluationDetailHeader
                  name={activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                  description={activeEval.departmentName ?? '—'}
                  meta={
                    activeEval.round != null ? (
                      <span className="rounded bg-primary/[0.07] px-2 py-0.5 text-[10.5px] font-bold text-primary">
                        {ROUND_LABEL[activeEval.round] ?? `${activeEval.round}차`}
                      </span>
                    ) : null
                  }
                  metric={{
                    label: '종합 점수',
                    value: (
                      <span className="inline-flex items-center gap-2">
                        <span>{fmtScore(detail?.totalScore ?? activeEval.totalScore)}</span>
                        {(detail?.finalGrade ?? activeEval.finalGrade) && (
                          <GradeChip grade={(detail?.finalGrade ?? activeEval.finalGrade)!} />
                        )}
                      </span>
                    ),
                  }}
                />

                {/* 평가 단계 — 이 피평가자를 누가 1·2·최종으로 평가하는지(본인 강조).
                    순차 결재가 아니라 각 단계가 독립 평가 후 가중 결합되므로 차례·완료 표시는 없다. */}
                {evaluatorChain.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-card px-3 py-2 text-[12px]">
                    <span className="font-semibold text-muted-foreground">평가 단계</span>
                    {evaluatorChain.map((s, i) => (
                      <span key={s.userId} className="inline-flex items-center gap-2">
                        {i > 0 && <span className="text-muted-foreground/60" aria-hidden>·</span>}
                        <span className={s.userId === user?.id ? 'font-bold text-primary' : 'text-foreground'}>
                          {s.stage === evaluatorChain.length ? '최종' : `${s.stage}차`} {s.name}
                          {s.position ? ` ${getPositionLabel(s.position)}` : ''}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* 과제별 성과 + 부서장 평가 */}
                {selfLoading || kpiLoading || detailLoading ? (
                  <Card><Skeleton className="h-48 w-full" /></Card>
                ) : kpis.length === 0 ? (
                  <Card>
                    <div className="px-5 py-10 text-center">
                      <p className="text-[13.5px] font-semibold text-foreground">확정된 KPI가 없어요.</p>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        이 구성원의 KPI가 확정되면 과제별 성과가 표시돼요.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <>
                    <DeptHeadKpiGroupList
                      coreKpis={coreKpis}
                      growthKpis={growthKpis}
                      allKpis={kpis}
                      selfScoreByKpi={selfScoreByKpi}
                      directGrades={directGrades}
                      reviewerNotes={reviewerNotes}
                      evidenceByKpi={evidenceByKpi}
                      isKpiOpen={isKpiOpen}
                      isKpiDone={isKpiDone}
                      toggleKpi={toggleKpi}
                      onGrade={(kpiId, g) => {
                        setDirectGrades((p) => ({ ...p, [kpiId]: g }));
                        setDirty(true);
                      }}
                      onReviewerNote={(kpiId, v) => {
                        setReviewerNotes((p) => ({ ...p, [kpiId]: v }));
                        setDirty(true);
                      }}
                      onPreview={setPreviewFile}
                      readOnly={readOnly}
                      gradingScales={ruleSet?.gradingScales}
                      revenueGradeScale={revenueGradeScale}
                    />

                    {/* 종합 평가 코멘트 */}
                    {(!readOnly || comment.length > 0) && (
                      <Card title={
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-primary" />
                          종합 평가 코멘트
                          <span className="text-danger-500 font-bold">*</span>
                        </span>
                      }>
                        <Textarea
                          value={comment}
                          onChange={(e) => {
                            setComment(e.target.value);
                            setDirty(true);
                          }}
                          readOnly={readOnly}
                          placeholder="제출 전 전체 평가에 대한 의견을 작성해 주세요. (필수)"
                          className={cn(
                            'min-h-[88px] resize-none',
                            !readOnly && feedbackMissing && 'border-danger-500',
                            readOnly && 'bg-muted',
                          )}
                        />
                        {!readOnly && feedbackMissing && (
                          <p className="text-[11.5px] text-danger-600 mt-1">
                            종합 평가 코멘트는 필수 항목이에요. (1차·2차·최종 모두)
                          </p>
                        )}
                      </Card>
                    )}

                    {/* 종합등급 직접 부여(선택) — 제어형 Collapsible(피평가자 전환 시 접힘 초기화) */}
                    <Collapsible
                      open={overrideOpen}
                      onToggle={() => setOverrideOpen((v) => !v)}
                      headerClassName="bg-muted"
                      header={
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-semibold text-foreground">
                            종합등급 직접 부여 <span className="text-muted-foreground font-normal">(선택)</span>
                          </span>
                          {overallGrade ? (
                            <GradeChip grade={overallGrade} />
                          ) : detail?.estimatedGrade ? (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                              자동 산정 예상등급
                              <GradeChip grade={detail.estimatedGrade} size="sm" />
                            </span>
                          ) : null}
                        </div>
                      }
                      bodyClassName="space-y-3"
                    >
                      <p className="text-[11.5px] text-muted-foreground">
                        자동 산정 등급 대신 부서장이 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                      </p>
                      <div className="flex items-center gap-2">
                        <GradePicker
                          value={overallGrade}
                          onChange={(g) => { setOverallGrade(g); setDirty(true); }}
                          readOnly={readOnly}
                        />
                        {overallGrade !== null && !readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setOverallGrade(null); setOverallReason(''); setDirty(true); }}
                          >
                            자동 산정
                          </Button>
                        )}
                      </div>
                      {overallGrade !== null && (
                        <Textarea
                          value={overallReason}
                          onChange={(e) => { setOverallReason(e.target.value); setDirty(true); }}
                          readOnly={readOnly}
                          placeholder="종합등급을 직접 정한 이유를 적어 주세요."
                          className={cn(
                            'min-h-[56px] resize-none text-[12.5px]',
                            !readOnly && overrideReasonMissing && 'border-danger-500',
                            readOnly && 'bg-muted',
                          )}
                        />
                      )}
                    </Collapsible>

                    {/* 평가 이력 — GET /evaluations/:id/history (수정요청/반려/승인, selfEval 기준) 실배선.
                        종합 코멘트(quarter=round) 기록도 함께 시간순 표시. */}
                    {(history.length > 0 || (detail?.comments?.length ?? 0) > 0) && (
                      <Card
                        title={
                          <span className="flex items-center gap-1.5">
                            <History size={14} className="text-muted-foreground" />
                            평가 이력
                          </span>
                        }
                      >
                        <ul className="space-y-2">
                          {history.map((h) => (
                            <li key={h.id} className="rounded-md border border-border bg-muted px-3 py-2.5">
                              <div className="mb-1 flex items-center gap-2">
                                {/* 인라인 hex 자체 배지 → 공용 DesignLabel tone 수렴 */}
                                <DesignLabel
                                  tone={
                                    h.kind === 'approved'
                                      ? 'green'
                                      : h.kind === 'revision_requested'
                                        ? 'amber'
                                        : 'red'
                                  }
                                >
                                  {h.kind === 'approved' ? '승인' : h.kind === 'revision_requested' ? '수정요청' : '반려'}
                                </DesignLabel>
                                <span className="text-[11px] font-semibold text-muted-foreground">{h.actorName ?? '검토자'}</span>
                                <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
                                  {fmtHistoryDate(h.createdAt)}
                                </span>
                              </div>
                              {h.reason && (
                                <p className="text-[12.5px] leading-relaxed text-foreground whitespace-pre-wrap">{h.reason}</p>
                              )}
                            </li>
                          ))}
                          {[...(detail?.comments ?? [])]
                            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                            .map((c) => (
                              <li
                                key={c.id}
                                className="rounded-md border border-border bg-muted px-3 py-2.5"
                              >
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground">
                                    {ROUND_LABEL[c.quarter] ?? `${c.quarter}차`} 코멘트
                                  </span>
                                  <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
                                    {fmtHistoryDate(c.createdAt)}
                                  </span>
                                </div>
                                <p className="text-[12.5px] leading-relaxed text-foreground whitespace-pre-wrap">
                                  {c.content}
                                </p>
                              </li>
                            ))}
                        </ul>
                      </Card>
                    )}

                    {/* 제출 — sticky(스크롤 중에도 액션 접근) + 미충족 사유는 message 로 일원화 */}
                    {!readOnly ? (
                      <EvaluationActionPanel
                        sticky
                        message={
                          !selfSubmitted
                            ? '구성원 본인평가 제출 후 부서장 평가를 제출할 수 있어요.'
                            : !qualitativeComplete
                              ? '정성 과제 등급을 모두 부여해야 제출할 수 있어요.'
                              : reviewerNotesMissing
                                ? '모든 과제에 부서장 코멘트를 작성해야 제출할 수 있어요.'
                                : feedbackMissing
                                  ? '종합 평가 코멘트를 작성해야 제출할 수 있어요.'
                                  : '모든 필수 항목이 입력됐어요.'
                        }
                        actions={
                          <>
                            {/* 임시저장 — 작성 중 내용 영속화(전환·이탈 유실 방지) */}
                            <Button
                              variant="secondary"
                              size="lg"
                              loading={savingDraft}
                              disabled={savingDraft || submitting || windowClosed}
                              onClick={() => void saveDraft()}
                              title="작성 중인 등급·코멘트를 저장해 두고 나중에 이어서 작성할 수 있어요."
                            >
                              임시저장
                            </Button>
                            {/* 본인평가 반려/수정요청 — 그레이(보조), 대상=구성원 selfEval */}
                            <Button
                              variant="secondary"
                              size="lg"
                              disabled={!selfSubmitted || selfEval?.status === 'finalized' || sendingBack}
                              onClick={() => { setSendBackKind('reject'); setSendBackReason(''); }}
                              title="구성원 본인평가를 반려해요 — 구성원이 보완 후 재제출해야 해요."
                            >
                              반려
                            </Button>
                            <Button
                              variant="secondary"
                              size="lg"
                              disabled={!selfSubmitted || selfEval?.status === 'finalized' || sendingBack}
                              onClick={() => { setSendBackKind('revision'); setSendBackReason(''); }}
                              title="구성원 본인평가에 수정을 요청해요 — 구성원이 보완 후 재제출해야 해요."
                            >
                              수정 요청
                            </Button>
                            <Button
                              variant="primary"
                              loading={submitting}
                              disabled={!canSubmit || submitting || windowClosed}
                              onClick={handleSubmit}
                              size="lg"
                              className="w-full sm:w-auto sm:min-w-[176px]"
                            >
                              {submitting ? '제출 중…' : '부서장 평가 제출'}
                            </Button>
                          </>
                        }
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <EvidencePreview
        evaluationId={previewFile?.evaluationId ?? ''}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <Modal
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        title="부서장 평가를 제출할까요?"
        primaryAction={{
          label: '제출',
          variant: 'primary',
          loading: submitting,
          disabled: submitting,
          onClick: () => void confirmSubmit(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmSubmitOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          제출하면 내용을 수정할 수 없어요.<br />
          <span className="text-primary font-semibold">{activeEval?.userName ?? '구성원'}</span>의 평가가 다음 단계로 넘어갑니다.
        </p>
      </Modal>

      {/* 미저장 상태에서 다른 평가 대상 선택 시 확인 — window.confirm 대신 공용 Modal */}
      <Modal
        open={pendingTargetId !== null}
        onClose={() => setPendingTargetId(null)}
        title="작성 중인 내용이 저장되지 않았어요"
        primaryAction={{ label: '이동', variant: 'primary', onClick: confirmSwitchTarget }}
        secondaryAction={{ label: '취소', onClick: () => setPendingTargetId(null) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          다른 대상으로 이동하면 작성 중인 평가 내용이 사라져요.<br />
          이어서 작성하려면 취소 후 <span className="font-semibold text-foreground">임시저장</span>을 먼저 눌러 주세요.
        </p>
      </Modal>

      {/* 본인평가 반려/수정요청 사유 모달 — 사유 필수(이력에 남고 구성원에게 노출) */}
      <Modal
        open={sendBackKind !== null}
        onClose={() => setSendBackKind(null)}
        title={sendBackKind === 'reject' ? '본인평가를 반려할까요?' : '본인평가 수정을 요청할까요?'}
        primaryAction={{
          label: sendBackKind === 'reject' ? '반려' : '수정 요청',
          variant: 'primary',
          loading: sendingBack,
          disabled: sendingBack || !sendBackReason.trim(),
          onClick: () => void confirmSendBack(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setSendBackKind(null) }}
        size="sm"
      >
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            <span className="text-primary font-semibold">{activeEval?.userName ?? '구성원'}</span>의 본인평가가
            {sendBackKind === 'reject' ? ' 반려되어' : ' 수정요청 상태가 되어'} 보완 후 재제출해야 해요.
            사유는 평가 이력에 남고 구성원에게 표시됩니다.
          </p>
          <Textarea
            value={sendBackReason}
            onChange={(e) => setSendBackReason(e.target.value)}
            placeholder="사유를 입력해 주세요. (필수)"
            className="min-h-[72px] resize-none text-[12.5px]"
          />
          {!sendBackReason.trim() && (
            <p className="text-[11.5px] text-danger-600">사유를 입력해야 처리할 수 있어요.</p>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}

function DeptHeadSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="gx-master-detail">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
