'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, ChevronLeft, History } from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
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
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';

import { fmtScore } from '@/lib/ui';
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
} from '../hooks';
import { deptHeadCommands, fetchEvaluationHistory } from '../api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DeptHeadKpiGroupList } from './DeptHeadKpiGroupList';
import { SelfStatusBanner, GradePicker } from './DeptHeadHelpers';

// 다단계 평가 단계 라벨(round).
const ROUND_LABEL: Record<number, string> = {
  1: '1차 · 팀장',
  2: '2차 · 본부장',
  3: '최종 · 그룹대표',
};

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

  const allowed = !!user && canEvaluateDownward(user.role);

  const { data: evals, loading, error, reload } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');
  const [kpiOpenMap, setKpiOpenMap] = useState<Record<string, boolean>>({});

  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

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
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');
  // 본인평가 반려/수정요청 — 대상=구성원 selfEval, 게이트=본인평가 제출됨.
  const [sendBackKind, setSendBackKind] = useState<'revision' | 'reject' | null>(null);
  const [sendBackReason, setSendBackReason] = useState('');
  const [sendingBack, setSendingBack] = useState(false);
  // 평가 검토 이력(수정요청/반려/승인) — GET /evaluations/:id/history (selfEval 기준).
  const [history, setHistory] = useState<EvaluationReviewHistory[]>([]);

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
      restored[s.kpiId] = s.grade;
      if (s.reviewerNote) restoredNotes[s.kpiId] = s.reviewerNote;
    }
    setDirectGrades(restored);
    setReviewerNotes(restoredNotes);
    setComment('');
    setOverallGrade(activeEval?.overallGrade ?? null);
    setOverallReason(activeEval?.overallReason ?? '');
    // 피평가자 변경 시 KPI 펼침 상태 초기화.
    setKpiOpenMap({});
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

  // 본인평가 반려/수정요청 확정 — 사유 필수, 성공 시 구성원이 본인평가를 보완·재제출해야 한다.
  async function confirmSendBack() {
    if (!selfEval || !sendBackKind || !sendBackReason.trim()) return;
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
      setSendingBack(false);
    }
  }

  async function confirmSubmit() {
    if (!activeEval) return;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    try {
      const kpiScores = kpis.map((k) => {
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
      await deptHeadCommands.patch(activeEval.id, {
        kpiScores: kpiScores as never,
        ...(overallGrade !== null
          ? { overallGrade: overallGrade as never, overallReason: overallReason.trim() }
          : {}),
      });
      await deptHeadCommands.addComment(activeEval.id, {
        quarter: activeEval.round ?? 1,
        content: comment.trim(),
      });
      await deptHeadCommands.submit(activeEval.id);
      toast.show({ variant: 'success', message: '부서장 평가를 제출했어요.' });
      setComment('');
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
      setSubmitting(false);
    }
  }

  if (!allowed) return <Forbidden message="부서장 평가 권한이 없어요." />;
  if (cyclesLoading || (loading && !evals)) return <DeptHeadSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="지금은 부서장 평가 기간이 아니에요." />;

  const filtered = targets.filter((t) => {
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
    setSelectedId(id);
    setMobileView('panel');
  }

  return (
    <PageContainer>
      <PageHeader
        title="부서장 평가"
        subtitle="팀원이 제출한 본인평가 실적을 확인하고, 정성 과제 등급과 평가 코멘트를 작성하세요."
        right={
          <>
            <HeaderMetrics
              items={[
                { label: '전체 팀원', value: summary.total },
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

      {targets.length === 0 ? (
        <EmptyState
          title="평가할 팀원이 없어요."
          description="아직 부서장 평가가 배정되지 않았어요. HR이 배정을 완료하면 팀원이 표시돼요."
        />
      ) : (
        <div className="gx-master-detail">
          {/* ── 팀원 목록 ── */}
          <EvaluationSubjectPanel
            title="팀원"
            count={targets.length}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="이름 검색"
            emptyMessage="검색 결과가 없어요."
            items={subjectItems}
            className={mobileView === 'panel' ? 'hidden lg:block' : 'block'}
          />

          {/* ── 평가 패널 ── */}
          <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block', 'space-y-4')}>
            {!activeEval ? (
              <Card>
                <p className="py-10 text-center text-[13px] text-muted-foreground">
                  좌측에서 팀원을 선택하세요.
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
                    팀원 목록
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

                {/* 본인평가 상태 배너 */}
                <SelfStatusBanner loading={selfLoading} selfEval={selfEval} submitted={selfSubmitted} />

                {/* 과제별 성과 + 부서장 평가 */}
                {selfLoading || kpiLoading || detailLoading ? (
                  <Card><Skeleton className="h-48 w-full" /></Card>
                ) : kpis.length === 0 ? (
                  <Card>
                    <div className="px-5 py-10 text-center">
                      <p className="text-[13.5px] font-semibold text-foreground">확정된 KPI가 없어요.</p>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        이 팀원의 KPI가 확정되면 과제별 성과가 표시돼요.
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
                      onGrade={(kpiId, g) => setDirectGrades((p) => ({ ...p, [kpiId]: g }))}
                      onReviewerNote={(kpiId, v) => setReviewerNotes((p) => ({ ...p, [kpiId]: v }))}
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
                          onChange={(e) => setComment(e.target.value)}
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

                    {/* 종합등급 직접 부여(선택) */}
                    <details className="rounded-none border border-border bg-card overflow-hidden">
                      <summary className="flex items-center justify-between cursor-pointer px-5 py-4 bg-muted border-b border-border text-[13px] font-semibold text-foreground list-none">
                        <span>종합등급 직접 부여 <span className="text-muted-foreground font-normal">(선택)</span></span>
                        {overallGrade ? (
                          <GradeChip grade={overallGrade} />
                        ) : detail?.estimatedGrade ? (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                            자동 산정 예상등급
                            <GradeChip grade={detail.estimatedGrade} size="sm" />
                          </span>
                        ) : null}
                      </summary>
                      <div className="space-y-3 px-5 py-4 bg-card">
                        <p className="text-[11.5px] text-muted-foreground">
                          자동 산정 등급 대신 부서장이 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                        </p>
                        <div className="flex items-center gap-2">
                          <GradePicker value={overallGrade} onChange={(g) => setOverallGrade(g)} readOnly={readOnly} />
                          {overallGrade !== null && !readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setOverallGrade(null); setOverallReason(''); }}
                            >
                              자동 산정
                            </Button>
                          )}
                        </div>
                        {overallGrade !== null && (
                          <Textarea
                            value={overallReason}
                            onChange={(e) => setOverallReason(e.target.value)}
                            readOnly={readOnly}
                            placeholder="종합등급을 직접 정한 이유를 적어 주세요."
                            className={cn(
                              'min-h-[56px] resize-none text-[12.5px]',
                              !readOnly && overrideReasonMissing && 'border-danger-500',
                              readOnly && 'bg-muted',
                            )}
                          />
                        )}
                      </div>
                    </details>

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
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                                  style={
                                    h.kind === 'approved'
                                      ? { background: '#E3F7EC', color: '#0B7A47' }
                                      : h.kind === 'revision_requested'
                                        ? { background: '#FEF3E2', color: '#B45309' }
                                        : { background: '#FDEBEB', color: '#B91C1C' }
                                  }
                                >
                                  {h.kind === 'approved' ? '승인' : h.kind === 'revision_requested' ? '수정요청' : '반려'}
                                </span>
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

                    {/* 제출 */}
                    {!readOnly ? (
                      <EvaluationActionPanel
                        message={
                          !selfSubmitted
                            ? '팀원 본인평가 제출 후 부서장 평가를 제출할 수 있어요.'
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
                              disabled={!canSubmit || submitting}
                              onClick={handleSubmit}
                              size="lg"
                              className="w-full sm:w-auto sm:min-w-[176px]"
                            >
                              {submitting
                                ? '제출 중…'
                                : !selfSubmitted
                                  ? '본인평가 제출 후 평가할 수 있어요'
                                  : !qualitativeComplete
                                    ? '정성 과제 등급을 모두 부여해 주세요'
                                    : reviewerNotesMissing
                                      ? '모든 과제에 부서장 코멘트를 작성해 주세요'
                                      : feedbackMissing
                                        ? '종합 평가 코멘트를 작성해 주세요'
                                        : '부서장 평가 제출'}
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
        primaryAction={{ label: '제출', variant: 'primary', onClick: () => void confirmSubmit() }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmSubmitOpen(false) }}
        size="sm"
      >
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          제출하면 내용을 수정할 수 없어요.<br />
          <span className="text-primary font-semibold">{activeEval?.userName ?? '팀원'}</span>의 평가가 다음 단계로 넘어갑니다.
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
