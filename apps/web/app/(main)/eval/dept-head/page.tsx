'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ClipboardList,
  MessageSquare,
  Info,
  UserCheck,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useEvaluations,
  useEvaluationDetail,
  evaluationCommands,
} from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { useGradePools } from '@/hooks/useGradePools';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import {
  fmtScore,
  measureTypeLabel,
  measureTypeUnit,
  tierLabel,
  kpiCategoryLabel,
} from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { T, gradeChipColor } from '@/lib/toss';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import type {
  Grade,
  GradePool,
  Evaluation,
  Kpi,
  KpiScore,
  KpiGroup,
  EvalStatus,
} from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};

const statusCfg: Record<EvalStatus, { icon: typeof CheckCircle2; bg: string; label: string }> = {
  finalized: { icon: CheckCircle2, bg: T.green500, label: '확정' },
  submitted: { icon: CheckCircle2, bg: '#059669', label: '평가 완료' },
  in_progress: { icon: Clock, bg: T.blue600, label: '평가중' },
  not_started: { icon: AlertCircle, bg: '#f57800', label: '평가 대기' },
};

export default function DeptHeadEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canEvaluateDownward(user.role);
  // 단일 캐스케이드: 각 피평가자는 직속 부서장 1명만 평가. 모두 round=1.
  const round = 1;

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

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');

  useEffect(() => {
    // 활성 피평가자 전환 시: 이미 부서장이 저장한 정성 등급이 있으면 복원.
    const restored: Record<string, Grade> = {};
    for (const s of detail?.kpiScores ?? []) restored[s.kpiId] = s.grade;
    setDirectGrades(restored);
    setComment('');
    setOverallGrade(activeEval?.overallGrade ?? null);
    setOverallReason(activeEval?.overallReason ?? '');
  }, [activeEval?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const t of targets) if (t.finalGrade) c[t.finalGrade] += 1;
    return c;
  }, [targets]);

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  const commentMissing = comment.trim().length === 0;
  const overrideReasonMissing =
    overallGrade !== null && overallReason.trim().length === 0;
  const canSubmit =
    !readOnly &&
    !!activeEval &&
    selfSubmitted &&
    qualitativeComplete &&
    !commentMissing &&
    !overrideReasonMissing;

  async function handleSubmit() {
    if (!activeEval) return;
    setSubmitting(true);
    try {
      // 정량 KPI 실적은 '본인평가'에서 입력한 값을 그대로 사용(부서장은 실적을 바꾸지 않음).
      // 정성 KPI 는 부서장이 직접 부여한 등급(directGrade)을 전송.
      const kpiScores = kpis.map((k) => {
        if (k.measureType === 'qualitative') {
          return { kpiId: k.id, directGrade: directGrades[k.id], weight: k.weight };
        }
        const selfScore = selfScoreByKpi.get(k.id);
        return { kpiId: k.id, achievementRate: selfScore?.achievementRate, weight: k.weight };
      });
      await evaluationCommands.patch(activeEval.id, {
        kpiScores,
        ...(overallGrade !== null
          ? { overallGrade, overallReason: overallReason.trim() }
          : {}),
      });
      await evaluationCommands.addComment(activeEval.id, {
        quarter: round,
        content: comment.trim(),
      });
      await evaluationCommands.submit(activeEval.id);
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
  if (cyclesLoading || loading) return <DeptHeadSkeleton />;
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

      {/* 진행 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체 팀원', value: summary.total, bg: T.blue500, Icon: UserCheck },
          { label: '평가 완료', value: summary.done, bg: '#059669', Icon: CheckCircle2 },
          { label: '평가중', value: summary.inprog, bg: T.blue600, Icon: Clock },
          { label: '평가 대기', value: summary.waiting, bg: '#f57800', Icon: AlertCircle },
        ].map((s, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3" style={card}>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: s.bg }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.value}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <s.Icon size={13} color={T.grey400} />
              <span style={{ fontSize: 12.5, color: T.grey700 }}>{s.label}</span>
            </div>
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
            className={`${mobileView === 'panel' ? 'hidden lg:block' : 'block'} overflow-hidden self-start`}
            style={card}
          >
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ background: T.grey50, borderColor: T.grey200 }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>팀원 {targets.length}명</h3>
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 ml-auto"
                style={{ border: `1px solid ${T.grey200}`, background: '#fff', minWidth: 130 }}
              >
                <Search size={12} color={T.grey500} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 검색"
                  className="outline-none"
                  style={{ fontSize: 12, background: 'transparent', color: T.grey900, width: 84 }}
                />
              </div>
            </div>
            <div className="max-h-[640px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center" style={{ fontSize: 12.5, color: T.grey500 }}>
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
                      className="flex items-center gap-3 w-full text-left border-b last:border-b-0 px-4 py-3 transition-colors"
                      style={{
                        borderColor: T.grey100,
                        background: active ? '#EEF4FF' : 'transparent',
                        borderLeft: `3px solid ${active ? T.blue500 : 'transparent'}`,
                      }}
                    >
                      <div
                        className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? T.blue500 : T.grey300, fontSize: 13, fontWeight: 700, color: '#fff' }}
                      >
                        {name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }} className="truncate">
                          {name}
                        </div>
                        {t.departmentName && (
                          <div style={{ fontSize: 11, color: T.grey500 }} className="truncate">
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
                <p style={{ fontSize: 13, color: T.grey500 }}>좌측에서 팀원을 선택하세요.</p>
              </div>
            ) : (
              <>
                {/* 모바일 뒤로 */}
                <button
                  onClick={() => setMobileView('list')}
                  className="lg:hidden flex items-center gap-1"
                  style={{ fontSize: 12.5, color: T.blue500, fontWeight: 600 }}
                >
                  <ChevronLeft size={14} /> 팀원 목록
                </button>

                {/* 피평가자 헤더 */}
                <div className="flex items-center gap-3 px-5 py-4" style={card}>
                  <div
                    className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                    style={{ background: T.blue500, fontSize: 17, fontWeight: 700, color: '#fff' }}
                  >
                    {(activeEval.userName ?? activeEval.evaluateeId).slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.grey900 }}>
                      {activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: 12, color: T.grey600 }}>
                      {activeEval.departmentName ?? '—'}
                    </div>
                  </div>
                  {/* 종합 점수(부서장 평가 제출 후 백엔드 산정) */}
                  <div className="text-right">
                    <div style={{ fontSize: 10.5, color: T.grey500 }}>종합 점수</div>
                    <div className="flex items-center gap-2 justify-end">
                      <span style={{ fontSize: 22, fontWeight: 800, color: T.blue600 }} className="tabular-nums">
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
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: T.grey800 }}>확정된 KPI가 없어요.</p>
                    <p style={{ fontSize: 12.5, color: T.grey500, marginTop: 4 }}>
                      이 팀원의 KPI가 확정되면 과제별 성과가 표시돼요.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 안내 */}
                    <div
                      className="flex items-start gap-2 px-4 py-3"
                      style={{ background: '#EEF4FF', border: `1px solid #D5E4FF` }}
                    >
                      <Info size={15} color={T.blue600} style={{ marginTop: 1, flexShrink: 0 }} />
                      <p style={{ fontSize: 12.5, color: T.grey700, lineHeight: 1.5 }}>
                        <b style={{ color: T.grey900 }}>수치 과제</b>의 실적·등급은 본인평가에서 자동 연동돼요(부서장이 바꾸지 않아요).
                        <b style={{ color: T.grey900 }}> 정성 과제</b>는 본인 등급을 참고해 부서장 등급을 직접 부여하세요.
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
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{cfg.label}</span>
                            <span style={{ fontSize: 12, color: T.grey500 }}>{rows.length}개 과제</span>
                          </div>

                          {rows.map((kpi) => (
                            <KpiEvalCard
                              key={kpi.id}
                              kpi={kpi}
                              cfgBg={cfg.bg}
                              selfScore={selfScoreByKpi.get(kpi.id) ?? null}
                              directGrade={directGrades[kpi.id] ?? null}
                              onGrade={(g) => setDirectGrades((p) => ({ ...p, [kpi.id]: g }))}
                              readOnly={readOnly}
                              soldOut={soldOutGrades}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {/* 평가 코멘트 */}
                    <div className="px-5 py-4 space-y-2" style={card}>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={14} color={T.grey700} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                          평가 코멘트 <span style={{ color: T.red500 }}>*</span>
                        </span>
                      </div>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        readOnly={readOnly}
                        placeholder="팀원에게 전달할 평가 의견을 작성해 주세요."
                        className="resize-none outline-none w-full"
                        style={{
                          border: `1px solid ${!readOnly && commentMissing ? T.red500 : T.grey200}`,
                          padding: '10px 12px',
                          fontSize: 13,
                          color: T.grey800,
                          minHeight: 88,
                          background: readOnly ? T.grey50 : '#fff',
                        }}
                      />
                      {!readOnly && commentMissing && (
                        <span style={{ fontSize: 11.5, color: T.red500 }}>코멘트를 작성해야 제출할 수 있어요.</span>
                      )}
                    </div>

                    {/* 종합등급 직접 부여(선택) */}
                    <details className="px-5 py-4" style={card}>
                      <summary
                        className="flex items-center justify-between cursor-pointer"
                        style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}
                      >
                        <span>종합등급 직접 부여 <span style={{ color: T.grey500, fontWeight: 400 }}>(선택)</span></span>
                        {overallGrade && <GradeBadge grade={overallGrade} />}
                      </summary>
                      <div className="space-y-3 mt-3">
                        <p style={{ fontSize: 11.5, color: T.grey500 }}>
                          자동 산정 등급 대신 부서장이 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                        </p>
                        <div className="flex items-center gap-2">
                          <GradePicker value={overallGrade} onChange={(g) => setOverallGrade(g)} readOnly={readOnly} />
                          {overallGrade !== null && !readOnly && (
                            <button
                              onClick={() => { setOverallGrade(null); setOverallReason(''); }}
                              style={{ fontSize: 11.5, color: T.blue500, whiteSpace: 'nowrap' }}
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
                            className="resize-none outline-none w-full"
                            style={{
                              border: `1px solid ${!readOnly && overrideReasonMissing ? T.red500 : T.grey200}`,
                              padding: '10px 12px',
                              fontSize: 12.5,
                              color: T.grey700,
                              minHeight: 56,
                              background: readOnly ? T.grey50 : '#fff',
                            }}
                          />
                        )}
                      </div>
                    </details>

                    {/* 풀 상한 경고 */}
                    {!readOnly && soldOutGrades.length > 0 && (
                      <div
                        className="flex items-start gap-2 px-4 py-3"
                        style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
                      >
                        <AlertCircle size={15} color="#f57800" style={{ marginTop: 1, flexShrink: 0 }} />
                        <p style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.5 }}>
                          풀 상한이 소진된 등급: <b>{soldOutGrades.join(', ')}</b> — 부여 시 제출이 거부될 수 있어요(캘리브레이션 필요).
                        </p>
                      </div>
                    )}

                    {/* 제출 */}
                    {!readOnly ? (
                      <div className="sticky bottom-0 z-10">
                        <button
                          onClick={() => void handleSubmit()}
                          disabled={!canSubmit || submitting}
                          className="w-full py-3 text-white transition-all hover:opacity-95 disabled:cursor-not-allowed"
                          style={{ background: canSubmit ? T.blue500 : T.grey400, fontSize: 14, fontWeight: 700 }}
                        >
                          {submitting
                            ? '제출 중…'
                            : !selfSubmitted
                              ? '본인평가 제출 후 평가할 수 있어요'
                              : !qualitativeComplete
                                ? '정성 과제 등급을 모두 부여해 주세요'
                                : commentMissing
                                  ? '평가 코멘트를 작성해 주세요'
                                  : '부서장 평가 제출'}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center gap-1.5 py-3"
                        style={{ background: '#E6F9F2', border: '1px solid #A7E8CE' }}
                      >
                        <CheckCircle2 size={15} color="#059669" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#047857' }}>평가 제출 완료</span>
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
        <div className="px-5 py-4" style={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>그룹 등급 풀 분포</h3>
            {pool && (
              <span className="px-2.5 py-1" style={{ fontSize: 11, fontWeight: 600, background: T.grey100, color: T.grey700 }}>
                {tierLabel[pool.tier]} 그룹
              </span>
            )}
          </div>
          {pool ? (
            <PoolBars counts={counts} caps={caps} targetsLen={targets.length} />
          ) : (
            <p style={{ fontSize: 13, color: T.grey500 }}>
              아직 그룹 등급 풀이 산정되지 않았어요. HR이 풀을 적용하면 상한이 표시돼요.
            </p>
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ── 본인평가 연동 + 부서장 등급 부여를 한 카드에서 ──
function KpiEvalCard({
  kpi,
  cfgBg,
  selfScore,
  directGrade,
  onGrade,
  readOnly,
  soldOut,
}: {
  kpi: Kpi;
  cfgBg: string;
  selfScore: KpiScore | null;
  directGrade: Grade | null;
  onGrade: (g: Grade) => void;
  readOnly?: boolean;
  soldOut: Grade[];
}) {
  const isQual = kpi.measureType === 'qualitative';
  const isCount = kpi.measureType === 'count';
  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${T.grey100}` }}>
        <span
          className="inline-block px-2 py-1"
          style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', background: cfgBg, flexShrink: 0 }}
        >
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{kpi.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ fontSize: 11.5, color: T.grey500, marginTop: 3 }}>
            {kpi.csf && <><span>{kpi.csf}</span><span>·</span></>}
            <span>{measureTypeLabel[kpi.measureType]}</span>
            {targetStr && <><span>·</span><span>목표 {targetStr}</span></>}
          </div>
        </div>
        <span style={{ fontSize: 11.5, color: T.grey600, flexShrink: 0 }} className="tabular-nums">
          가중치 {kpi.weight}%
        </span>
      </div>

      {/* 본인평가 연동 실적 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: T.grey50, borderBottom: isQual && !readOnly ? `1px solid ${T.grey100}` : 'none' }}
      >
        <UserCheck size={13} color={T.grey500} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: T.grey600 }}>본인평가</span>
        {selfScore ? (
          isQual ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span style={{ fontSize: 12, color: T.grey500 }}>선택 등급</span>
              <GradeBadge grade={selfScore.grade} />
              {selfScore.selfNote && (
                <span className="truncate" style={{ fontSize: 12, color: T.grey600 }} title={selfScore.selfNote}>
                  · {selfScore.selfNote}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                실적 {fmtScore(selfScore.achievementRate)}{isCount ? '건' : unit}
              </span>
              <span style={{ fontSize: 11.5, color: T.grey400 }}>자동 등급</span>
              <GradeBadge grade={selfScore.grade} />
              <span className="tabular-nums" style={{ fontSize: 11.5, color: T.blue600, marginLeft: 'auto' }}>
                {fmtScore(selfScore.score)}점
              </span>
            </div>
          )
        ) : (
          <span style={{ fontSize: 12, color: '#f57800' }}>아직 입력되지 않았어요</span>
        )}
      </div>

      {/* 부서장 등급 부여 (정성만) */}
      {isQual && (
        <div className="px-4 py-3.5 space-y-2">
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.grey700 }}>부서장 등급 부여</span>
          <GradeCriteriaPicker kpi={kpi} value={directGrade ?? undefined} onSelect={onGrade} readOnly={readOnly} />
          {!readOnly && directGrade && soldOut.includes(directGrade) && (
            <p style={{ fontSize: 11.5, color: '#f57800' }}>
              {directGrade} 등급은 풀 상한이 소진됐어요 — 제출이 거부될 수 있어요.
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
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#E6F9F2', border: '1px solid #A7E8CE' }}>
        <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#047857', fontWeight: 600 }}>
          팀원이 본인평가를 제출했어요. 실적이 아래에 연동돼요.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 px-4 py-2.5" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
      <Clock size={15} color="#f57800" style={{ marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.5 }}>
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
        const gc = gradeChipColor[g];
        return (
          <div key={g} className="flex items-center gap-3">
            <span style={{ width: 16, fontSize: 13, fontWeight: 700, color: T.grey800 }}>{g}</span>
            <div className="relative flex-1" style={{ height: 22, background: T.grey100 }}>
              <div style={{ height: 22, width: `${Math.min(100, widthPct)}%`, background: over ? T.red500 : gc.bg }} />
              {capPct !== null && (
                <div
                  className="absolute"
                  style={{ top: -3, bottom: -3, left: `${Math.min(100, capPct)}%`, borderLeft: `2px dashed ${T.grey400}` }}
                />
              )}
            </div>
            <span style={{ width: 80, textAlign: 'right', fontSize: 12.5, color: T.grey800 }} className="tabular-nums">
              {c}
              {cap !== undefined && <span style={{ color: T.grey500 }}> / {cap}</span>}
              {over && <span style={{ color: T.red500, marginLeft: 4, fontSize: 11 }}>초과</span>}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: T.grey500, marginTop: 4 }}>점선은 그룹 풀 상한이에요.</p>
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
        const gc = gradeChipColor[g];
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
              border: selected ? '2px solid transparent' : `2px solid ${T.grey200}`,
              background: selected ? gc.bg : '#fff',
              color: selected ? gc.color : T.grey700,
              cursor: readOnly ? 'not-allowed' : 'pointer',
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
  const c = gradeChipColor[grade];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        fontWeight: 700,
        fontSize: large ? 16 : 12,
        padding: large ? '6px 16px' : '3px 10px',
      }}
    >
      {grade}
    </span>
  );
}

function StatusPill({ status }: { status: EvalStatus }) {
  const s = statusCfg[status];
  return (
    <span className="px-3 py-1.5 text-white" style={{ fontSize: 11, fontWeight: 600, background: s.bg }}>
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
