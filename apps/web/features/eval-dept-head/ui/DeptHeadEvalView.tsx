'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  Info,
  UserCheck,
  ChevronLeft,
  Paperclip,
  Eye,
  Download,
} from 'lucide-react';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
import { useKpis } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { Button } from '@/components/Button';
import { SearchInput } from '@/components/SearchInput';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { Card } from '@/components/Card';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';

import {
  fmtScore,
  fmtAmount,
  measureTypeUnit,
  kpiCategoryLabel,
} from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { Modal } from '@/components/Modal';
import { Collapsible } from '@/components/Collapsible';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import { RevenueGradeDisplay } from '@/components/KpiGradingDisplay';
import { gradeColor } from '@/lib/grade';
import type {
  Grade,
  Evaluation,
  Kpi,
  KpiScore,
  KpiGroup,
  EvalStatus,
  EvaluationEvidence,
} from '@/lib/types';
import {
  useEvaluations,
  useEvaluationDetail,
  useEvaluationEvidence,
} from '../hooks';
import { deptHeadCommands } from '../api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

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

const GROUP_CFG: Record<KpiGroup, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-success-500' },
};

// 사람이 읽기 쉬운 파일 크기.
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
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

  const { data: selfEvals, loading: selfListLoading } = useEvaluations(
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* ── 팀원 목록 ── */}
          <div
            className={cn(
              mobileView === 'panel' ? 'hidden lg:block' : 'block',
              'overflow-hidden self-start rounded-lg border border-border bg-card shadow-elev-1',
            )}
          >
            <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
              <h3 className="text-[13px] font-semibold text-foreground">팀원 {targets.length}명</h3>
              <div className="ml-auto">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="이름 검색"
                  className="w-36"
                />
              </div>
            </div>
            <div className="max-h-[640px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                  검색 결과가 없어요.
                </div>
              ) : (
                filtered.map((t) => {
                  const active = t.id === activeEval?.id;
                  const name = t.userName ?? t.evaluateeId.slice(0, 8);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTarget(t.id)}
                      className={cn(
                        'flex items-center gap-3 w-full text-left px-4 py-3 transition-colors border-b border-border/20',
                        'border-l-[3px]',
                        active
                          ? 'bg-purple-50 border-l-primary'
                          : 'border-l-transparent hover:bg-accent',
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full text-[13px] font-bold text-white',
                          active ? 'bg-primary' : 'bg-muted-foreground/40',
                        )}
                      >
                        {name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground truncate">{name}</div>
                        {t.departmentName && (
                          <div className="text-[11px] text-muted-foreground truncate">{t.departmentName}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {t.finalGrade && <GradeChip grade={t.finalGrade} size="sm" />}
                        <StatusBadge status={t.status} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

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

                {/* 피평가자 헤더 */}
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-full bg-primary text-[17px] font-bold text-white">
                      {(activeEval.userName ?? activeEval.evaluateeId).slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-bold text-foreground">
                          {activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                        </span>
                        {activeEval.round != null && (
                          <span className="text-[10.5px] font-bold text-primary bg-purple-50 px-2.5 py-0.5 rounded-full">
                            {ROUND_LABEL[activeEval.round] ?? `${activeEval.round}차`}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {activeEval.departmentName ?? '—'}
                      </div>
                    </div>
                    {/* 종합 점수(백엔드 산정) */}
                    <div className="text-right">
                      <div className="text-[10.5px] text-muted-foreground">종합 점수</div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[22px] font-extrabold text-primary tabular-nums">
                          {fmtScore(detail?.totalScore ?? activeEval.totalScore)}
                        </span>
                        {(detail?.finalGrade ?? activeEval.finalGrade) && (
                          <GradeChip grade={(detail?.finalGrade ?? activeEval.finalGrade)!} />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

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
                    {/* 안내 */}
                    <InfoBanner tone="info">
                      <b className="text-foreground">수치 과제</b>의 실적·등급은 본인평가에서 자동 연동돼요(부서장이 바꾸지 않아요).
                      <b className="text-foreground"> 정성 과제</b>는 본인 등급을 참고해 부서장 등급을 직접 부여하세요.
                    </InfoBanner>

                    {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
                      const rows = group === 'performance_core' ? coreKpis : growthKpis;
                      if (rows.length === 0) return null;
                      const cfg = GROUP_CFG[group];
                      return (
                        <div key={group} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
                            <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                            <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                          </div>

                          {rows.map((kpi) => {
                            const done = isKpiDone(kpi);
                            const selfScore = selfScoreByKpi.get(kpi.id) ?? null;
                            const displayGrade =
                              kpi.measureType === 'qualitative'
                                ? (directGrades[kpi.id] ?? selfScore?.grade ?? null)
                                : (selfScore?.grade ?? null);
                            return (
                              <Collapsible
                                key={kpi.id}
                                open={isKpiOpen(kpi.id)}
                                onToggle={() => toggleKpi(kpi.id)}
                                header={
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={cn(
                                        'inline-block px-2 py-0.5 rounded text-[10.5px] font-bold text-white shrink-0',
                                        cfg.accent,
                                      )}
                                    >
                                      {kpiCategoryLabel[kpi.category]}
                                    </span>
                                    <span className="text-[13.5px] font-semibold text-foreground truncate">
                                      {kpi.title}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground shrink-0">
                                      가중치 {kpi.weight}%
                                    </span>
                                    {displayGrade && (
                                      <GradeChip grade={displayGrade} size="sm" />
                                    )}
                                    {done ? (
                                      <span className="shrink-0 text-[11px] font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                                        평가 완료
                                      </span>
                                    ) : (
                                      <span className="shrink-0 text-[11px] font-semibold text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full">
                                        미완료
                                      </span>
                                    )}
                                  </div>
                                }
                                className="shadow-none"
                                bodyClassName="bg-card p-0"
                              >
                                <KpiEvalCard
                                  kpi={kpi}
                                  selfScore={selfScore}
                                  directGrade={directGrades[kpi.id] ?? null}
                                  onGrade={(g) =>
                                    setDirectGrades((p) => ({ ...p, [kpi.id]: g }))
                                  }
                                  reviewerNote={reviewerNotes[kpi.id] ?? ''}
                                  onReviewerNote={(v) =>
                                    setReviewerNotes((p) => ({ ...p, [kpi.id]: v }))
                                  }
                                  noteMissing={
                                    !readOnly &&
                                    (reviewerNotes[kpi.id] ?? '').trim().length === 0
                                  }
                                  evidence={evidenceByKpi.get(kpi.id) ?? []}
                                  onPreview={setPreviewFile}
                                  readOnly={readOnly}
                                  revenueGradeScale={revenueGradeScale}
                                />
                              </Collapsible>
                            );
                          })}
                        </div>
                      );
                    })}

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
                    <details className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
                      <summary className="flex items-center justify-between cursor-pointer px-5 py-4 bg-muted border-b border-border text-[13px] font-semibold text-foreground list-none">
                        <span>종합등급 직접 부여 <span className="text-muted-foreground font-normal">(선택)</span></span>
                        {overallGrade && <GradeChip grade={overallGrade} />}
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

                    {/* 제출 */}
                    {!readOnly ? (
                      <div className="sticky bottom-0 z-10">
                        <Button
                          variant="primary"
                          fullWidth
                          loading={submitting}
                          disabled={!canSubmit || submitting}
                          onClick={handleSubmit}
                          size="lg"
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
                      </div>
                    ) : (
                      <InfoBanner tone="success">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 size={15} />
                          평가 제출 완료
                        </span>
                      </InfoBanner>
                    )}
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
    </PageContainer>
  );
}

// ── 본인평가 연동 + 부서장 등급 부여를 한 카드에서 ──
function KpiEvalCard({
  kpi,
  selfScore,
  directGrade,
  onGrade,
  reviewerNote,
  onReviewerNote,
  noteMissing,
  evidence,
  onPreview,
  readOnly,
  revenueGradeScale,
}: {
  kpi: Kpi;
  selfScore: KpiScore | null;
  directGrade: Grade | null;
  onGrade: (g: Grade) => void;
  reviewerNote: string;
  onReviewerNote: (v: string) => void;
  noteMissing: boolean;
  evidence: EvaluationEvidence[];
  onPreview: (f: EvaluationEvidence) => void;
  readOnly?: boolean;
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
}) {
  const isQual = kpi.measureType === 'qualitative';
  const isCount = kpi.measureType === 'count';
  const isAbsAmount = isAbsoluteAmount(kpi);
  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  return (
    <div className="overflow-hidden bg-card">
      {(kpi.csf || targetStr) && (
        <div className="border-b border-border/60 bg-muted/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
            {kpi.csf && <span className="font-medium text-foreground">{kpi.csf}</span>}
            {kpi.csf && targetStr && <span aria-hidden>·</span>}
            {targetStr && <span>목표 {targetStr}</span>}
          </div>
        </div>
      )}

      {/* 본인평가 연동 실적 */}
      <div className={cn('flex items-center gap-2 px-5 py-3', isQual && !readOnly ? 'border-b border-border/20' : '')}>
        <UserCheck size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-[11.5px] text-muted-foreground">본인평가</span>
        {selfScore ? (
          isQual ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] text-muted-foreground">선택 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              {selfScore.selfNote && (
                <span className="truncate text-[12px] text-muted-foreground" title={selfScore.selfNote}>
                  · {selfScore.selfNote}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="tabular-nums text-[13px] font-semibold text-foreground">
                {isAbsAmount
                  ? `매출 ${fmtAmount(selfScore.actualAmount)}`
                  : `실적 ${fmtScore(selfScore.achievementRate)}${isCount ? '건' : unit}`}
              </span>
              <span className="text-[11.5px] text-muted-foreground">자동 등급</span>
              <GradeChip grade={selfScore.grade} size="sm" />
              <span className="tabular-nums text-[11.5px] text-primary ml-auto">
                {fmtScore(selfScore.score)}점
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-warning-600">아직 입력되지 않았어요</span>
        )}
      </div>

      {/* 절대금액 모드 */}
      {isAbsAmount && (
        <div className="px-4 py-3">
          <RevenueGradeDisplay
            scale={revenueGradeScale}
            inputAmount={selfScore?.actualAmount ?? undefined}
          />
        </div>
      )}

      {/* 부서장 등급 부여 (정성만) */}
      {isQual && (
        <div className="px-4 py-3.5 space-y-2">
          <span className="text-[11.5px] font-semibold text-muted-foreground">부서장 등급 부여</span>
          <GradeCriteriaPicker kpi={kpi} value={directGrade ?? undefined} onSelect={onGrade} readOnly={readOnly} />
        </div>
      )}

      {/* 증빙 자료 */}
      {evidence.length > 0 && (
        <div className="px-5 py-3 space-y-1.5 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <Paperclip size={12} aria-hidden /> 증빙 자료{' '}
            <span className="font-normal text-muted-foreground/60">{evidence.length}개</span>
          </div>
          <ul className="space-y-1">
            {evidence.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 rounded-md border border-border bg-muted hover:bg-accent transition-colors"
                  title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                >
                  {isEvidencePreviewable(f.mimeType) ? (
                    <Eye size={13} className="text-primary flex-shrink-0" />
                  ) : (
                    <Download size={13} className="text-primary flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 text-[12px] text-foreground">{f.filename}</span>
                  <span className="text-[10.5px] text-muted-foreground flex-shrink-0 tabular-nums">
                    {fmtBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 부서장 문항별 코멘트 (필수) */}
      {(!readOnly || reviewerNote.trim().length > 0) && (
        <div className="px-5 py-4 space-y-1.5 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <MessageSquare size={12} className="text-primary" aria-hidden /> 부서장 코멘트{' '}
            <span className="text-danger-500 font-bold">*</span>
          </div>
          <Textarea
            value={reviewerNote}
            onChange={(e) => onReviewerNote(e.target.value)}
            readOnly={readOnly}
            placeholder="이 과제에 대한 평가 의견을 작성해 주세요. (필수)"
            className={cn(
              'min-h-[56px] resize-none text-[12.5px]',
              noteMissing && 'border-danger-500',
              readOnly && 'bg-muted',
            )}
          />
          {noteMissing && (
            <p className="text-[11.5px] text-danger-600">
              부서장 코멘트는 필수 항목이에요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SelfStatusBanner({
  loading,
  selfEval,
  submitted,
}: {
  loading: boolean;
  selfEval: Evaluation | null;
  submitted: boolean;
}) {
  if (loading) return <Skeleton className="h-12 w-full" />;
  if (submitted) {
    return (
      <InfoBanner tone="success">
        팀원이 본인평가를 제출했어요. 실적이 아래에 연동돼요.
      </InfoBanner>
    );
  }
  return (
    <InfoBanner tone="warning">
      {selfEval
        ? '팀원이 본인평가를 아직 제출하지 않았어요(작성 중). 제출되면 실적이 연동되고 부서장 평가를 제출할 수 있어요.'
        : '팀원이 아직 본인평가를 시작하지 않았어요. 제출 후 부서장 평가를 진행할 수 있어요.'}
    </InfoBanner>
  );
}

function GradePicker({
  value,
  onChange,
  readOnly,
}: {
  value: Grade | null;
  onChange: (g: Grade) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-2 flex-1">
      {GRADES.map((g) => {
        const selected = value === g;
        return (
          <button
            key={g}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(g)}
            className={cn(
              'flex-1 min-h-[40px] text-[14px] font-bold rounded-md border-2 transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              selected
                ? 'border-current'
                : 'border-border bg-card text-muted-foreground hover:border-border-strong',
            )}
            style={
              selected
                ? { background: gradeColor(g).fg, color: '#fff', borderColor: gradeColor(g).fg }
                : undefined
            }
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

function DeptHeadSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
