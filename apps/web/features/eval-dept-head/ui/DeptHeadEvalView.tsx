'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  MessageSquare,
  Info,
  UserCheck,
  ChevronLeft,
  Paperclip,
  Eye,
  Download,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
import { useKpis } from '@/hooks/useKpis';
import { useGradePools } from '@/hooks/useGradePools';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import {
  fmtScore,
  fmtAmount,
  kpiTypeLabel,
  measureTypeUnit,
  tierLabel,
  kpiCategoryLabel,
} from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { T } from '@/lib/toss';
import { Modal } from '@/components/Modal';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import { RevenueGradeDisplay } from '@/components/KpiGradingDisplay';
import { gradeColor } from '@/lib/grade';
import type {
  Grade,
  GradePool,
  Evaluation,
  Kpi,
  KpiScore,
  KpiGroup,
  EvalStatus,
  EvaluationEvidence,
} from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import {
  useEvaluations,
  useEvaluationDetail,
  useEvaluationEvidence,
} from '../hooks';
import { deptHeadCommands } from '../api';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 다단계 평가 단계 라벨(round).
const ROUND_LABEL: Record<number, string> = {
  1: '1차 · 팀장',
  2: '2차 · 본부장',
  3: '최종 · 그룹대표',
};

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  primary: '#3f2c80',
  primaryContainer: '#564599',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

// 갭 #2 — 실제 매출 절대금액으로 등급을 매기는 KPI 판정(목표 대비 달성률 아님).
function isAbsoluteAmount(k: Kpi): boolean {
  return k.measureType === 'amount' && k.useAbsoluteAmount === true;
}

const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};

const statusCfg: Record<EvalStatus, { icon: typeof CheckCircle2; bg: string; label: string }> = {
  finalized: { icon: CheckCircle2, bg: K.tertiary, label: '확정' },
  submitted: { icon: CheckCircle2, bg: K.tertiary, label: '평가 완료' },
  in_progress: { icon: Clock, bg: K.secondary, label: '평가중' },
  not_started: { icon: AlertCircle, bg: '#f57800', label: '평가 대기' },
};

export function DeptHeadEvalView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canEvaluateDownward(user.role);
  // 다단계: 평가자는 자기 단계(round)에 배정된 대상만 본다. round 는 평가행마다 다름
  // (팀장=1차, 본부장=2차, 그룹대표=최종). comment quarter 는 activeEval.round 를 쓴다.

  const { data: evals, loading, error, reload } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // 모바일: 목록 ↔ 패널 토글(좁은 화면에서 한 번에 하나).
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');

  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );

  // 부서장 평가 자신의 상세(제출 후 totalScore·finalGrade 표시용).
  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

  // ── 핵심: 피평가자의 '본인평가(self)' 실적을 연동 조회 ──
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

  // 본인평가 점수(KpiScore) 를 kpiId 로 인덱싱 — 실적·자동등급·메모 연동 소스.
  const selfScoreByKpi = useMemo(() => {
    const m = new Map<string, KpiScore>();
    for (const s of selfDetail?.kpiScores ?? []) m.set(s.kpiId, s);
    return m;
  }, [selfDetail?.kpiScores]);

  // 본인평가에 첨부된 문항별 증빙 — 부서장(검토자)이 사이트에서 바로 확인. (백엔드가 검토자 조회 허용)
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
  // 증빙 인라인 미리보기 — selfEval.id 기준으로 다운로드(부서장 조회 권한).
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

  const { data: pools } = useGradePools({ cycleId }, { enabled: !!cycleId && allowed });
  const pool: GradePool | null = pools?.data[0] ?? null;
  const caps = useMemo(() => (pool ? pool.caps : undefined), [pool]);

  // 갭 #2 — 절대금액 모드 KPI 등급기준(revenueGradeScale) 표시용 RuleSet.
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);
  const revenueGradeScale = ruleSet?.weightPolicy.revenueGradeScale;

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  // 문항별 부서장 코멘트(reviewerNote) 드래프트.
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');

  useEffect(() => {
    // 활성 피평가자 전환 시: 이미 부서장이 저장한 정성 등급·문항별 코멘트가 있으면 복원.
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
  }, [activeEval?.id, detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const t of targets) if (t.finalGrade) c[t.finalGrade] += 1;
    return c;
  }, [targets]);

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  // 종합 코멘트는 선택. 단, 종합 또는 문항별 코멘트 중 하나는 있어야 제출 가능(피드백 보장).
  const hasOverallComment = comment.trim().length > 0;
  const hasItemComment = Object.values(reviewerNotes).some((v) => v.trim().length > 0);
  const feedbackMissing = !hasOverallComment && !hasItemComment;
  const overrideReasonMissing =
    overallGrade !== null && overallReason.trim().length === 0;
  const canSubmit =
    !readOnly &&
    !!activeEval &&
    selfSubmitted &&
    qualitativeComplete &&
    !feedbackMissing &&
    !overrideReasonMissing;

  function handleSubmit() {
    // 제출 전 확인 모달을 열기만 한다.
    setConfirmSubmitOpen(true);
  }

  async function confirmSubmit() {
    if (!activeEval) return;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    try {
      // 정량 KPI 실적은 '본인평가'에서 입력한 값을 그대로 사용(부서장은 실적을 바꾸지 않음).
      // 정성 KPI 는 부서장이 직접 부여한 등급(directGrade)을 전송.
      const kpiScores = kpis.map((k) => {
        // 문항별 부서장 코멘트(있을 때만 전송 — 빈 값은 null 로 저장돼 게이트에 안 걸리게).
        const note = reviewerNotes[k.id]?.trim();
        const reviewerNote = note ? note : undefined;
        if (k.measureType === 'qualitative') {
          return { kpiId: k.id, directGrade: directGrades[k.id], weight: k.weight, reviewerNote };
        }
        const selfScore = selfScoreByKpi.get(k.id);
        if (isAbsoluteAmount(k)) {
          // 절대금액 모드: 본인평가의 실제 매출 금액(actualAmount)을 그대로 전달(부서장은 실적 미변경).
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
      // 종합 코멘트는 선택 — 작성된 경우에만 코멘트로 추가(문항별 코멘트는 kpiScores 에 포함됨).
      if (comment.trim().length > 0) {
        await deptHeadCommands.addComment(activeEval.id, {
          quarter: activeEval.round ?? 1,
          content: comment.trim(),
        });
      }
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
              ? '그룹 등급 풀 상한을 초과했어요. 등급을 조정해 주세요.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) return <Forbidden message="부서장 평가 권한이 없어요." />;
  // 스켈레톤은 첫 로딩에만 — 제출 후 reload 때 전체 교체되면 스크롤이 맨 위로 튐.
  if (cyclesLoading || (loading && !evals)) return <DeptHeadSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="지금은 부서장 평가 기간이 아니에요." />;

  const soldOutGrades: Grade[] = caps
    ? GRADES.filter((g) => counts[g] >= caps[g])
    : [];

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
        right={activeEval ? <StatusPill status={activeEval.status} /> : undefined}
      />

      {/* 진행 요약 카드 4장 — eval/my 패턴 숫자 강조형 + hover */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 팀원', value: summary.total, color: K.primary, Icon: UserCheck },
          { label: '평가 완료', value: summary.done, color: K.tertiary, Icon: CheckCircle2 },
          { label: '평가중', value: summary.inprog, color: K.secondary, Icon: Clock },
          { label: '평가 대기', value: summary.waiting, color: '#f57800', Icon: AlertCircle },
        ].map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-xl px-5 py-4 transition-transform hover:scale-[1.02] cursor-default"
            style={{ background: '#fff', border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <s.Icon size={13} color={s.color} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.label}
              </span>
            </div>
            <span
              className="tabular-nums"
              style={{ fontSize: 34, fontWeight: 800, color: s.color, lineHeight: 1.1, letterSpacing: '-0.02em' }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {targets.length === 0 ? (
        <EmptyState
          title="평가할 팀원이 없어요."
          description="아직 부서장 평가가 배정되지 않았어요. HR이 배정을 완료하면 팀원이 표시돼요."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* ── 팀원 목록 ── */}
          <div
            className={`${mobileView === 'panel' ? 'hidden lg:block' : 'block'} overflow-hidden self-start rounded-xl`}
            style={card}
          >
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: '#f8f9fd', borderBottom: '1px solid rgba(202,196,210,0.3)' }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>팀원 {targets.length}명</h3>
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 ml-auto rounded-lg"
                style={{ border: '1px solid rgba(202,196,210,0.6)', background: '#fff', minWidth: 130 }}
              >
                <Search size={12} color="#797582" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 검색"
                  className="outline-none"
                  style={{ fontSize: 12, background: 'transparent', color: '#191c1f', width: 84 }}
                />
              </div>
            </div>
            <div className="max-h-[640px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center" style={{ fontSize: 12.5, color: '#797582' }}>
                  검색 결과가 없어요.
                </div>
              ) : (
                filtered.map((t) => {
                  const sc = statusCfg[t.status];
                  const ScIcon = sc.icon;
                  const active = t.id === activeEval?.id;
                  const name = t.userName ?? t.evaluateeId.slice(0, 8);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTarget(t.id)}
                      className="flex items-center gap-3 w-full text-left px-4 py-3 transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(202,196,210,0.2)',
                        background: active ? 'rgba(0,84,202,0.05)' : 'transparent',
                        borderLeft: `3px solid ${active ? K.secondary : 'transparent'}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = '#f8f9fd';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div
                        className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full"
                        style={{ background: active ? K.secondary : '#cac4d2', fontSize: 13, fontWeight: 700, color: '#fff' }}
                      >
                        {name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }} className="truncate">
                          {name}
                        </div>
                        {t.departmentName && (
                          <div style={{ fontSize: 11, color: '#797582' }} className="truncate">
                            {t.departmentName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {t.finalGrade && <GradeBadge grade={t.finalGrade} />}
                        <span className="flex items-center gap-1" style={{ fontSize: 11, color: sc.bg, fontWeight: 600 }}>
                          <ScIcon size={12} color={sc.bg} />
                          {sc.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── 평가 패널 ── */}
          <div className={`${mobileView === 'list' ? 'hidden lg:block' : 'block'} space-y-4`}>
            {!activeEval ? (
              <div className="px-5 py-16 text-center" style={card}>
                <p style={{ fontSize: 13, color: '#797582' }}>좌측에서 팀원을 선택하세요.</p>
              </div>
            ) : (
              <>
                {/* 모바일 뒤로 */}
                <button
                  onClick={() => setMobileView('list')}
                  className="lg:hidden flex items-center gap-1"
                  style={{ fontSize: 12.5, color: K.secondary, fontWeight: 600 }}
                >
                  <ChevronLeft size={14} /> 팀원 목록
                </button>

                {/* 피평가자 헤더 */}
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={card}>
                  <div
                    className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-full"
                    style={{ background: K.secondary, fontSize: 17, fontWeight: 700, color: '#fff' }}
                  >
                    {(activeEval.userName ?? activeEval.evaluateeId).slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#191c1f' }}>
                        {activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                      </span>
                      {activeEval.round != null && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: K.secondary,
                            background: 'rgba(0,84,202,0.08)',
                            padding: '2px 10px',
                            borderRadius: 999,
                          }}
                        >
                          {ROUND_LABEL[activeEval.round] ?? `${activeEval.round}차`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#484551' }}>
                      {activeEval.departmentName ?? '—'}
                    </div>
                  </div>
                  {/* 종합 점수(부서장 평가 제출 후 백엔드 산정) */}
                  <div className="text-right">
                    <div style={{ fontSize: 10.5, color: '#797582' }}>종합 점수</div>
                    <div className="flex items-center gap-2 justify-end">
                      <span style={{ fontSize: 22, fontWeight: 800, color: K.secondary }} className="tabular-nums">
                        {fmtScore(detail?.totalScore ?? activeEval.totalScore)}
                      </span>
                      {(detail?.finalGrade ?? activeEval.finalGrade) && (
                        <GradeBadge grade={(detail?.finalGrade ?? activeEval.finalGrade)!} large />
                      )}
                    </div>
                  </div>
                </div>

                {/* 본인평가 상태 배너 */}
                <SelfStatusBanner loading={selfLoading} selfEval={selfEval} submitted={selfSubmitted} />

                {/* 과제별 성과 + 부서장 평가 */}
                {selfLoading || kpiLoading || detailLoading ? (
                  <div className="p-5" style={card}><Skeleton className="h-48 w-full" /></div>
                ) : kpis.length === 0 ? (
                  <div className="px-5 py-10 text-center" style={card}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#333d4b' }}>확정된 KPI가 없어요.</p>
                    <p style={{ fontSize: 12.5, color: '#797582', marginTop: 4 }}>
                      이 팀원의 KPI가 확정되면 과제별 성과가 표시돼요.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 안내 */}
                    <div
                      className="flex items-start gap-2.5 px-5 py-3.5 rounded-xl"
                      style={{ background: 'rgba(0,84,202,0.05)', border: '1px solid rgba(0,84,202,0.15)' }}
                    >
                      <Info size={15} color={K.secondary} style={{ marginTop: 1.5, flexShrink: 0 }} />
                      <p style={{ fontSize: 12.5, color: '#484551', lineHeight: 1.55 }}>
                        <b style={{ color: '#191c1f' }}>수치 과제</b>의 실적·등급은 본인평가에서 자동 연동돼요(부서장이 바꾸지 않아요).
                        <b style={{ color: '#191c1f' }}> 정성 과제</b>는 본인 등급을 참고해 부서장 등급을 직접 부여하세요.
                      </p>
                    </div>

                    {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
                      const rows = group === 'performance_core' ? coreKpis : growthKpis;
                      if (rows.length === 0) return null;
                      const cfg = GROUP_CFG[group];
                      return (
                        <div key={group} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span style={{ width: 4, height: 15, background: cfg.bg, display: 'inline-block' }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{cfg.label}</span>
                            <span style={{ fontSize: 12, color: '#797582' }}>{rows.length}개 과제</span>
                          </div>

                          {rows.map((kpi) => (
                            <KpiEvalCard
                              key={kpi.id}
                              kpi={kpi}
                              cfgBg={cfg.bg}
                              selfScore={selfScoreByKpi.get(kpi.id) ?? null}
                              directGrade={directGrades[kpi.id] ?? null}
                              onGrade={(g) => setDirectGrades((p) => ({ ...p, [kpi.id]: g }))}
                              reviewerNote={reviewerNotes[kpi.id] ?? ''}
                              onReviewerNote={(v) =>
                                setReviewerNotes((p) => ({ ...p, [kpi.id]: v }))
                              }
                              evidence={evidenceByKpi.get(kpi.id) ?? []}
                              onPreview={setPreviewFile}
                              readOnly={readOnly}
                              soldOut={soldOutGrades}
                              revenueGradeScale={revenueGradeScale}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {/* 종합 평가 코멘트 (선택) — 문항별 코멘트로 대체 가능 */}
                    {(!readOnly || comment.length > 0) && (
                      <div className="rounded-xl overflow-hidden" style={card}>
                        <div
                          className="flex items-center gap-2 px-5 py-3"
                          style={{ background: '#f8f9fd', borderBottom: '1px solid rgba(202,196,210,0.25)' }}
                        >
                          <MessageSquare size={14} color={K.secondary} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>
                            종합 평가 코멘트{' '}
                            <span style={{ color: '#797582', fontWeight: 400 }}>(선택)</span>
                          </span>
                        </div>
                        <div className="px-5 py-4 space-y-2">
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            readOnly={readOnly}
                            placeholder="전체 평가에 대한 의견을 남길 수 있어요. 문항별 코멘트만 작성해도 제출할 수 있어요."
                            className="resize-none w-full"
                            style={{
                              border: '1px solid rgba(202,196,210,0.6)',
                              borderRadius: 6,
                              padding: '10px 12px',
                              fontSize: 13,
                              color: '#333d4b',
                              minHeight: 88,
                              background: readOnly ? '#f8f9fd' : '#fff',
                              outline: 'none',
                              transition: 'border-color .12s',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; }}
                          />
                          {!readOnly && feedbackMissing && (
                            <span style={{ fontSize: 11.5, color: '#797582' }}>
                              종합 또는 문항별 코멘트를 하나 이상 작성해 주세요.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 종합등급 직접 부여(선택) */}
                    <details className="rounded-xl overflow-hidden" style={card}>
                      <summary
                        className="flex items-center justify-between cursor-pointer px-5 py-4"
                        style={{ fontSize: 13, fontWeight: 600, color: '#191c1f', background: '#f8f9fd', borderBottom: '1px solid rgba(202,196,210,0.25)' }}
                      >
                        <span>종합등급 직접 부여 <span style={{ color: '#797582', fontWeight: 400 }}>(선택)</span></span>
                        {overallGrade && <GradeBadge grade={overallGrade} />}
                      </summary>
                      <div className="space-y-3 px-5 py-4">
                        <p style={{ fontSize: 11.5, color: '#797582' }}>
                          자동 산정 등급 대신 부서장이 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                        </p>
                        <div className="flex items-center gap-2">
                          <GradePicker value={overallGrade} onChange={(g) => setOverallGrade(g)} readOnly={readOnly} />
                          {overallGrade !== null && !readOnly && (
                            <button
                              onClick={() => { setOverallGrade(null); setOverallReason(''); }}
                              style={{ fontSize: 11.5, color: K.secondary, whiteSpace: 'nowrap' }}
                            >
                              자동 산정
                            </button>
                          )}
                        </div>
                        {overallGrade !== null && (
                          <textarea
                            value={overallReason}
                            onChange={(e) => setOverallReason(e.target.value)}
                            readOnly={readOnly}
                            placeholder="종합등급을 직접 정한 이유를 적어 주세요."
                            className="resize-none w-full"
                            style={{
                              border: `1px solid ${!readOnly && overrideReasonMissing ? '#ba1a1a' : 'rgba(202,196,210,0.6)'}`,
                              borderRadius: 6,
                              padding: '10px 12px',
                              fontSize: 12.5,
                              color: '#4e5968',
                              minHeight: 56,
                              background: readOnly ? '#f8f9fd' : '#fff',
                              outline: 'none',
                            }}
                          />
                        )}
                      </div>
                    </details>

                    {/* 풀 상한 경고 */}
                    {!readOnly && soldOutGrades.length > 0 && (
                      <div
                        className="flex items-start gap-2.5 px-5 py-3.5 rounded-xl"
                        style={{ background: '#fff8f0', border: '1px solid rgba(245,120,0,0.3)' }}
                      >
                        <AlertCircle size={15} color="#f57800" style={{ marginTop: 1.5, flexShrink: 0 }} />
                        <p style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.55 }}>
                          풀 상한이 소진된 등급: <b>{soldOutGrades.join(', ')}</b> — 부여 시 제출이 거부될 수 있어요(캘리브레이션 필요).
                        </p>
                      </div>
                    )}

                    {/* 제출 */}
                    {!readOnly ? (
                      <div className="sticky bottom-0 z-10">
                        <button
                          onClick={handleSubmit}
                          disabled={!canSubmit || submitting}
                          className="w-full transition-all hover:opacity-95 disabled:cursor-not-allowed"
                          style={{
                            padding: '14px',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#fff',
                            background: canSubmit ? K.primary : T.grey400,
                            borderRadius: 10,
                            border: 'none',
                            boxShadow: canSubmit ? '0 4px 14px rgba(63,44,128,0.3)' : 'none',
                          }}
                        >
                          {submitting
                            ? '제출 중…'
                            : !selfSubmitted
                              ? '본인평가 제출 후 평가할 수 있어요'
                              : !qualitativeComplete
                                ? '정성 과제 등급을 모두 부여해 주세요'
                                : feedbackMissing
                                  ? '종합 또는 문항별 코멘트를 작성해 주세요'
                                  : '부서장 평가 제출'}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl"
                        style={{ background: 'rgba(14,154,160,0.06)', border: '1px solid rgba(14,154,160,0.25)' }}
                      >
                        <CheckCircle2 size={15} color={K.tertiary} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#007a7f' }}>평가 제출 완료</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 그룹 등급 풀 분포 — 하단 참고 */}
      {targets.length > 0 && (
        <div className="px-5 py-4 rounded-xl" style={card}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>그룹 등급 풀 분포</h3>
            {pool && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'rgba(63,44,128,0.08)',
                  color: K.primary,
                  padding: '3px 10px',
                  borderRadius: 999,
                }}
              >
                {tierLabel[pool.tier]} 그룹
              </span>
            )}
          </div>
          {pool ? (
            <PoolBars counts={counts} caps={caps} targetsLen={targets.length} />
          ) : (
            <p style={{ fontSize: 13, color: '#797582' }}>
              아직 그룹 등급 풀이 산정되지 않았어요. HR이 풀을 적용하면 상한이 표시돼요.
            </p>
          )}
        </div>
      )}

      {/* 증빙 인라인 미리보기 — 본인평가에 첨부된 파일을 사이트에서 바로 확인. */}
      <EvidencePreview
        evaluationId={previewFile?.evaluationId ?? ''}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* 부서장 평가 제출 확인 Modal */}
      <Modal
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        title="부서장 평가를 제출할까요?"
        primaryAction={{ label: '제출', variant: 'primary', onClick: () => void confirmSubmit() }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmSubmitOpen(false) }}
        size="sm"
      >
        <p style={{ fontSize: 13, color: '#484551', lineHeight: 1.6 }}>
          제출하면 내용을 수정할 수 없어요.<br />
          <span style={{ color: K.primary, fontWeight: 600 }}>{activeEval?.userName ?? '팀원'}</span>의 평가가 다음 단계로 넘어갑니다.
        </p>
      </Modal>
    </PageContainer>
  );
}

// 사람이 읽기 쉬운 파일 크기.
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

// ── 본인평가 연동 + 부서장 등급 부여를 한 카드에서 ──
function KpiEvalCard({
  kpi,
  cfgBg,
  selfScore,
  directGrade,
  onGrade,
  reviewerNote,
  onReviewerNote,
  evidence,
  onPreview,
  readOnly,
  soldOut,
  revenueGradeScale,
}: {
  kpi: Kpi;
  cfgBg: string;
  selfScore: KpiScore | null;
  directGrade: Grade | null;
  onGrade: (g: Grade) => void;
  reviewerNote: string;
  onReviewerNote: (v: string) => void;
  evidence: EvaluationEvidence[];
  onPreview: (f: EvaluationEvidence) => void;
  readOnly?: boolean;
  soldOut: Grade[];
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
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        ...card,
        borderColor: 'rgba(202,196,210,0.5)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(63,44,128,0.3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)'; }}
    >
      {/* 헤더 */}
      <div
        className="flex items-start gap-3 px-5 py-3.5"
        style={{ borderBottom: '1px solid rgba(202,196,210,0.25)', background: '#f8f9fd' }}
      >
        <span
          className="inline-block px-2 py-0.5 rounded-md"
          style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: cfgBg, flexShrink: 0, marginTop: 2 }}
        >
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{kpi.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ fontSize: 11.5, color: '#797582', marginTop: 3 }}>
            {kpi.csf && <><span>{kpi.csf}</span><span>·</span></>}
            <span>{kpiTypeLabel(kpi)}</span>
            {targetStr && <><span>·</span><span>목표 {targetStr}</span></>}
          </div>
        </div>
        <span style={{ fontSize: 11.5, color: '#484551', flexShrink: 0 }} className="tabular-nums">
          가중치 {kpi.weight}%
        </span>
      </div>

      {/* 본인평가 연동 실적 */}
      <div
        className="flex items-center gap-2 px-5 py-2.5"
        style={{ background: '#f2f3f7', borderBottom: isQual && !readOnly ? '1px solid rgba(202,196,210,0.2)' : 'none' }}
      >
        <UserCheck size={13} color="#797582" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: '#484551' }}>본인평가</span>
        {selfScore ? (
          isQual ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span style={{ fontSize: 12, color: '#797582' }}>선택 등급</span>
              <GradeBadge grade={selfScore.grade} />
              {selfScore.selfNote && (
                <span className="truncate" style={{ fontSize: 12, color: '#484551' }} title={selfScore.selfNote}>
                  · {selfScore.selfNote}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>
                {isAbsAmount
                  ? `매출 ${fmtAmount(selfScore.actualAmount)}`
                  : `실적 ${fmtScore(selfScore.achievementRate)}${isCount ? '건' : unit}`}
              </span>
              <span style={{ fontSize: 11.5, color: '#b3b0bb' }}>자동 등급</span>
              <GradeBadge grade={selfScore.grade} />
              <span className="tabular-nums" style={{ fontSize: 11.5, color: K.secondary, marginLeft: 'auto' }}>
                {fmtScore(selfScore.score)}점
              </span>
            </div>
          )
        ) : (
          <span style={{ fontSize: 12, color: '#f57800' }}>아직 입력되지 않았어요</span>
        )}
      </div>

      {/* 절대금액 모드: 백엔드 산정과 동일한 매출 절대금액 등급기준 표시(본인 입력 금액 강조). */}
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
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>부서장 등급 부여</span>
          <GradeCriteriaPicker kpi={kpi} value={directGrade ?? undefined} onSelect={onGrade} readOnly={readOnly} />
          {!readOnly && directGrade && soldOut.includes(directGrade) && (
            <p style={{ fontSize: 11.5, color: '#f57800' }}>
              {directGrade} 등급은 풀 상한이 소진됐어요 — 제출이 거부될 수 있어요.
            </p>
          )}
        </div>
      )}

      {/* 본인이 첨부한 증빙 — 사이트에서 바로 보기(PDF·이미지) 또는 다운로드. */}
      {evidence.length > 0 && (
        <div
          className="px-5 py-3 space-y-1.5"
          style={{ borderTop: '1px solid rgba(202,196,210,0.2)' }}
        >
          <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>
            <Paperclip size={12} /> 증빙 자료 <span style={{ color: '#b3b0bb', fontWeight: 400 }}>{evidence.length}개</span>
          </div>
          <ul className="space-y-1">
            {evidence.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 rounded-lg"
                  style={{ border: '1px solid rgba(202,196,210,0.4)', background: '#f8f9fd' }}
                  title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                >
                  {isEvidencePreviewable(f.mimeType) ? (
                    <Eye size={13} color={K.secondary} style={{ flexShrink: 0 }} />
                  ) : (
                    <Download size={13} color={K.secondary} style={{ flexShrink: 0 }} />
                  )}
                  <span className="truncate flex-1" style={{ fontSize: 12, color: '#333d4b' }}>
                    {f.filename}
                  </span>
                  <span style={{ fontSize: 10.5, color: '#b3b0bb', flexShrink: 0 }} className="tabular-nums">
                    {fmtBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 부서장 문항별 코멘트 (선택) */}
      {(!readOnly || reviewerNote.trim().length > 0) && (
        <div
          className="px-5 py-4 space-y-1.5"
          style={{ borderTop: '1px solid rgba(202,196,210,0.2)' }}
        >
          <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>
            <MessageSquare size={12} color={K.secondary} /> 부서장 코멘트{' '}
            <span style={{ color: '#b3b0bb', fontWeight: 400 }}>(선택)</span>
          </div>
          <textarea
            value={reviewerNote}
            onChange={(e) => onReviewerNote(e.target.value)}
            readOnly={readOnly}
            placeholder="이 과제에 대한 평가 의견을 남길 수 있어요."
            className="resize-none w-full"
            style={{
              border: '1px solid rgba(202,196,210,0.6)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 12.5,
              color: '#333d4b',
              minHeight: 56,
              background: readOnly ? '#f8f9fd' : '#fff',
              outline: 'none',
              transition: 'border-color .12s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; }}
          />
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
      <div
        className="flex items-center gap-2 px-5 py-3 rounded-xl"
        style={{ background: 'rgba(14,154,160,0.06)', border: '1px solid rgba(14,154,160,0.25)' }}
      >
        <CheckCircle2 size={15} color="#007a7f" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#007a7f', fontWeight: 600 }}>
          팀원이 본인평가를 제출했어요. 실적이 아래에 연동돼요.
        </span>
      </div>
    );
  }
  return (
    <div
      className="flex items-start gap-2 px-5 py-3 rounded-xl"
      style={{ background: '#fff8f0', border: '1px solid rgba(245,120,0,0.3)' }}
    >
      <Clock size={15} color="#f57800" style={{ marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.55 }}>
        {selfEval
          ? '팀원이 본인평가를 아직 제출하지 않았어요(작성 중). 제출되면 실적이 연동되고 부서장 평가를 제출할 수 있어요.'
          : '팀원이 아직 본인평가를 시작하지 않았어요. 제출 후 부서장 평가를 진행할 수 있어요.'}
      </span>
    </div>
  );
}

function PoolBars({
  counts,
  caps,
  targetsLen,
}: {
  counts: Record<Grade, number>;
  caps?: Record<Grade, number>;
  targetsLen: number;
}) {
  const maxScale = Math.max(
    targetsLen,
    ...GRADES.map((g) => counts[g]),
    caps ? Math.max(...GRADES.map((g) => caps[g])) : 0,
    1,
  );
  return (
    <div className="space-y-2">
      {GRADES.map((g) => {
        const c = counts[g];
        const cap = caps?.[g];
        const over = cap !== undefined && c > cap;
        const widthPct = (c / maxScale) * 100;
        const capPct = cap !== undefined ? (cap / maxScale) * 100 : null;
        const gc = gradeColor(g);
        return (
          <div key={g} className="flex items-center gap-3">
            <span style={{ width: 16, fontSize: 13, fontWeight: 700, color: '#191c1f' }}>{g}</span>
            <div className="relative flex-1 rounded" style={{ height: 22, background: '#f2f3f7' }}>
              <div className="rounded" style={{ height: 22, width: `${Math.min(100, widthPct)}%`, background: over ? '#ef4444' : gc.fg }} />
              {capPct !== null && (
                <div
                  className="absolute"
                  style={{ top: -3, bottom: -3, left: `${Math.min(100, capPct)}%`, borderLeft: '2px dashed rgba(121,117,130,0.5)' }}
                />
              )}
            </div>
            <span style={{ width: 80, textAlign: 'right', fontSize: 12.5, color: '#191c1f' }} className="tabular-nums">
              {c}
              {cap !== undefined && <span style={{ color: '#797582' }}> / {cap}</span>}
              {over && <span style={{ color: '#ef4444', marginLeft: 4, fontSize: 11 }}>초과</span>}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: '#797582', marginTop: 4 }}>점선은 그룹 풀 상한이에요.</p>
    </div>
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
        const gc = gradeColor(g);
        return (
          <button
            key={g}
            type="button"
            disabled={readOnly}
            onClick={() => onChange(g)}
            className="flex-1 transition-colors disabled:opacity-40"
            style={{
              minHeight: 40,
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              border: selected ? `2px solid ${gc.fg}` : '2px solid rgba(202,196,210,0.6)',
              background: selected ? gc.bg : '#fff',
              color: selected ? gc.fg : '#484551',
              cursor: readOnly ? 'not-allowed' : 'pointer',
              boxShadow: selected ? `0 4px 10px ${gc.fg}26` : 'none',
              transition: 'all .15s',
            }}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

function GradeBadge({ grade, large }: { grade: Grade; large?: boolean }) {
  const c = gradeColor(grade);
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontWeight: 700,
        fontSize: large ? 16 : 12,
        padding: large ? '6px 16px' : '3px 10px',
        borderRadius: large ? 10 : 8,
      }}
    >
      {grade}
    </span>
  );
}

function StatusPill({ status }: { status: EvalStatus }) {
  const s = statusCfg[status];
  return (
    <span className="px-3 py-1.5 text-white" style={{ fontSize: 11, fontWeight: 600, background: s.bg, borderRadius: 999 }}>
      {s.label}
    </span>
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
