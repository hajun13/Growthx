'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';
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
import { fmtScore, measureTypeLabel, measureTypeUnit, tierLabel } from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { T, gradeChipColor } from '@/lib/toss';
import type { Grade, GradePool, Evaluation, Kpi, EvalStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};

const statusCfg: Record<EvalStatus, { icon: typeof CheckCircle2; bg: string; label: string }> = {
  finalized: { icon: CheckCircle2, bg: T.green500, label: '확정' },
  submitted: { icon: CheckCircle2, bg: '#059669', label: '제출 완료' },
  in_progress: { icon: Clock, bg: T.blue600, label: '평가중' },
  not_started: { icon: AlertCircle, bg: '#f57800', label: '평가 대기' },
};

export default function DeptHeadEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canEvaluateDownward(user.role);
  // 단일 캐스케이드: 각 피평가자는 직속 부서장 1명만 평가. 1차/2차 구분 폐기 → 모두 round=1.
  const round = 1;

  const { data: evals, loading, error, reload } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = evals?.data ?? [];

  const [selectedId2, setSelectedId2] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId2) ?? targets[0] ?? null,
    [targets, selectedId2],
  );

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

  const { data: kpiData } = useKpis(
    { cycleId, userId: activeEval?.evaluateeId },
    { enabled: !!cycleId && !!activeEval },
  );
  const kpis: Kpi[] = (kpiData?.data ?? []).filter((k) => k.status === 'confirmed');

  const { data: pools } = useGradePools(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );
  const pool: GradePool | null = pools?.data[0] ?? null;

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overallGrade, setOverallGrade] = useState<Grade | null>(null);
  const [overallReason, setOverallReason] = useState('');

  useEffect(() => {
    setDirectGrades({});
    setComment('');
    setOverallGrade(activeEval?.overallGrade ?? null);
    setOverallReason(activeEval?.overallReason ?? '');
  }, [activeEval?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const t of targets) {
      if (t.finalGrade) c[t.finalGrade] += 1;
    }
    return c;
  }, [targets]);

  const caps = useMemo(() => (pool ? pool.caps : undefined), [pool]);

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  const commentMissing = comment.trim().length === 0;
  const overrideReasonMissing =
    overallGrade !== null && overallReason.trim().length === 0;
  const canSubmit =
    !readOnly &&
    !!activeEval &&
    qualitativeComplete &&
    !commentMissing &&
    !overrideReasonMissing;

  async function handleSubmit() {
    if (!activeEval) return;
    setSubmitting(true);
    try {
      const kpiScores = kpis.map((k) => {
        const existing = detail?.kpiScores.find((s) => s.kpiId === k.id);
        if (k.measureType === 'qualitative') {
          return { kpiId: k.id, directGrade: directGrades[k.id], weight: k.weight };
        }
        return { kpiId: k.id, achievementRate: existing?.achievementRate, weight: k.weight };
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
      toast.show({ variant: 'success', message: '평가를 제출했어요.' });
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

  const maxScale = Math.max(targets.length, ...GRADES.map((g) => counts[g]), caps ? Math.max(...GRADES.map((g) => caps[g])) : 0, 1);

  return (
    <PageContainer>
      <PageHeader
        title="부서장 평가"
        subtitle="직속 하위 구성원의 과제 성과를 확인하고 정성 KPI 등급과 평가 코멘트를 작성하세요. 그룹 등급 풀 상한을 확인하세요."
        right={activeEval ? <StatusPill status={activeEval.status} /> : undefined}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 팀원', value: summary.total, bg: T.blue500 },
          { label: '평가 완료', value: summary.done, bg: '#059669' },
          { label: '평가중', value: summary.inprog, bg: T.blue600 },
          { label: '평가 대기', value: summary.waiting, bg: '#f57800' },
        ].map((s, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3" style={card}>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: s.bg }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{s.value}</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.grey700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 그룹 등급 풀 분포 */}
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
                    <div
                      style={{ height: 22, width: `${Math.min(100, widthPct)}%`, background: over ? T.red500 : gc.bg }}
                    />
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
        ) : (
          <p style={{ fontSize: 13, color: T.grey500 }}>
            아직 그룹 등급 풀이 산정되지 않았어요. HR이 풀을 적용하면 상한이 표시돼요.
          </p>
        )}
      </div>

      {targets.length === 0 ? (
        <EmptyState title="평가할 팀원이 없어요." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
          {/* 팀원 목록 */}
          <div className="overflow-hidden" style={card}>
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: T.grey50, borderColor: T.grey200 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>팀원 목록</h3>
              <div
                className="flex items-center gap-2 px-3 py-1.5 ml-auto"
                style={{ border: `1px solid ${T.grey200}`, minWidth: 140 }}
              >
                <Search size={12} color={T.grey500} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 검색..."
                  className="outline-none"
                  style={{ fontSize: 12, background: 'transparent', color: T.grey900, width: 90 }}
                />
              </div>
            </div>
            <div className="grid border-b px-5 py-2.5" style={{ gridTemplateColumns: '1fr 90px 90px 40px', background: T.grey50, borderColor: T.grey200 }}>
              {['이름', '상태', '최종등급', ''].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>{h}</div>
              ))}
            </div>
            {filtered.map((t) => {
              const sc = statusCfg[t.status];
              const ScIcon = sc.icon;
              const active = t.id === activeEval?.id;
              const name = t.userName ?? t.evaluateeId.slice(0, 8);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId2(t.id)}
                  className="grid items-center w-full text-left border-b last:border-b-0 px-5 py-3.5 transition-colors"
                  style={{ gridTemplateColumns: '1fr 90px 90px 40px', borderColor: T.grey200, background: active ? T.grey50 : 'transparent' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 flex items-center justify-center" style={{ background: T.blue500, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                      {name.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{name}</div>
                      {t.departmentName && <div style={{ fontSize: 11, color: T.grey500 }}>{t.departmentName}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ScIcon size={13} color={sc.bg} />
                    <span style={{ fontSize: 11.5, color: sc.bg, fontWeight: 500 }}>{sc.label}</span>
                  </div>
                  <div>{t.finalGrade ? <GradeBadge grade={t.finalGrade} /> : <span style={{ fontSize: 13, color: T.grey400 }}>—</span>}</div>
                  <ChevronRight size={14} color={active ? T.blue500 : T.grey400} />
                </button>
              );
            })}
          </div>

          {/* 평가 패널 */}
          <div className="overflow-hidden" style={card}>
            {!activeEval || detailLoading ? (
              <div className="p-5"><Skeleton className="h-48 w-full" /></div>
            ) : (
              <>
                <div className="px-5 py-4 border-b" style={{ background: T.grey50, borderColor: T.grey200 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center" style={{ background: T.blue500, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {(activeEval.userName ?? activeEval.evaluateeId).slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>
                        {activeEval.userName ?? activeEval.evaluateeId.slice(0, 8)}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.grey600 }}>
                        {activeEval.departmentName ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* 종합 점수(백엔드 산정) */}
                  <div className="p-4 flex items-center justify-between" style={{ background: T.grey50, border: `1px solid ${T.grey200}` }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.grey500 }}>종합 점수 (백엔드 산정)</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: T.blue600 }} className="tabular-nums">
                        {fmtScore(activeEval.totalScore)}
                      </div>
                    </div>
                    {activeEval.finalGrade && <GradeBadge grade={activeEval.finalGrade} large />}
                  </div>

                  {/* 과제별 성과(읽기) */}
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: T.grey600, marginBottom: 8 }}>과제별 성과</div>
                    {(detail?.kpiScores ?? []).length === 0 ? (
                      <p style={{ fontSize: 12.5, color: T.grey500 }}>본인평가 실적이 아직 입력되지 않았어요.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {(detail?.kpiScores ?? []).map((s) => {
                          const kpi = kpis.find((k) => k.id === s.kpiId);
                          return (
                            <li key={s.id} className="flex items-center justify-between px-3 py-2 border" style={{ borderColor: T.grey200 }}>
                              <span style={{ fontSize: 12.5, color: T.grey800 }}>
                                {kpi?.title ?? s.kpiId.slice(0, 8)} · {kpi ? measureTypeLabel[kpi.measureType] : ''} · 달성률 {fmtScore(s.achievementRate)}
                                {kpi ? measureTypeUnit[kpi.measureType] : ''}
                              </span>
                              <GradeBadge grade={s.grade} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* 정성 KPI 등급 부여 */}
                  {qualitativeKpis.length > 0 && (
                    <div className="space-y-3">
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.grey600 }}>정성 KPI 등급 부여</div>
                      {qualitativeKpis.map((k) => (
                        <div key={k.id} className="space-y-1.5">
                          <span style={{ fontSize: 12.5, color: T.grey800 }}>{k.title} (가중치 {k.weight}%)</span>
                          <GradePicker
                            value={directGrades[k.id] ?? null}
                            onChange={(g) => setDirectGrades((prev) => ({ ...prev, [k.id]: g }))}
                            readOnly={readOnly}
                            soldOut={soldOutGrades}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 코멘트 */}
                  <label className="flex flex-col gap-1.5">
                    <span style={{ fontSize: 11.5, color: T.grey600, fontWeight: 600 }}>
                      평가 코멘트 <span style={{ color: T.red500 }}>*</span>
                    </span>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      readOnly={readOnly}
                      placeholder="평가 의견을 작성해 주세요."
                      className="resize-none outline-none"
                      style={{
                        border: `1px solid ${!readOnly && commentMissing ? T.red500 : T.grey200}`,
                        padding: '10px 12px',
                        fontSize: 12.5,
                        color: T.grey700,
                        minHeight: 80,
                        background: readOnly ? T.grey50 : '#fff',
                      }}
                    />
                    {!readOnly && commentMissing && (
                      <span style={{ fontSize: 11.5, color: T.red500 }}>코멘트를 작성해야 제출할 수 있어요.</span>
                    )}
                  </label>

                  {/* 종합등급 오버라이드(선택) */}
                  <div className="p-4 space-y-3" style={{ border: `1px solid ${T.grey200}` }}>
                    <div className="flex items-center justify-between">
                      <h4 style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>종합등급 직접 부여 (선택)</h4>
                      {overallGrade !== null && !readOnly && (
                        <button
                          onClick={() => { setOverallGrade(null); setOverallReason(''); }}
                          style={{ fontSize: 11.5, color: T.blue500 }}
                        >
                          자동 산정으로 되돌리기
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: T.grey500 }}>
                      자동 산정 등급 대신 평가자가 종합등급을 정할 수 있어요. 정하면 사유가 필요해요.
                    </p>
                    <GradePicker value={overallGrade} onChange={(g) => setOverallGrade(g)} readOnly={readOnly} />
                    {overallGrade !== null && (
                      <label className="flex flex-col gap-1.5">
                        <span style={{ fontSize: 11.5, color: T.grey600, fontWeight: 600 }}>
                          오버라이드 사유 <span style={{ color: T.red500 }}>*</span>
                        </span>
                        <textarea
                          value={overallReason}
                          onChange={(e) => setOverallReason(e.target.value)}
                          readOnly={readOnly}
                          placeholder="종합등급을 직접 정한 이유를 적어 주세요."
                          className="resize-none outline-none"
                          style={{
                            border: `1px solid ${!readOnly && overrideReasonMissing ? T.red500 : T.grey200}`,
                            padding: '10px 12px',
                            fontSize: 12.5,
                            color: T.grey700,
                            minHeight: 56,
                            background: readOnly ? T.grey50 : '#fff',
                          }}
                        />
                        {!readOnly && overrideReasonMissing && (
                          <span style={{ fontSize: 11.5, color: T.red500 }}>사유를 작성해야 제출할 수 있어요.</span>
                        )}
                      </label>
                    )}
                  </div>

                  {!readOnly && soldOutGrades.length > 0 && (
                    <p style={{ fontSize: 12.5, color: '#f57800' }}>
                      풀 상한이 소진된 등급: {soldOutGrades.join(', ')} — 부여할 수 없어요.
                    </p>
                  )}

                  {!readOnly && (
                    <button
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit || submitting}
                      className="w-full py-2.5 text-white transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: canSubmit ? T.blue500 : T.grey400, fontSize: 13, fontWeight: 600 }}
                    >
                      {submitting ? '제출 중…' : '부서장 평가 제출'}
                    </button>
                  )}
                  {readOnly && (
                    <div className="py-2.5 text-center" style={{ background: T.grey100, fontSize: 13, fontWeight: 600, color: T.grey600 }}>
                      제출 완료
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function GradePicker({
  value,
  onChange,
  readOnly,
  soldOut = [],
}: {
  value: Grade | null;
  onChange: (g: Grade) => void;
  readOnly?: boolean;
  soldOut?: Grade[];
}) {
  return (
    <div className="flex gap-2">
      {GRADES.map((g) => {
        const selected = value === g;
        const disabled = readOnly || (soldOut.includes(g) && !selected);
        const gc = gradeChipColor[g];
        return (
          <button
            key={g}
            type="button"
            disabled={disabled}
            onClick={() => onChange(g)}
            className="flex-1 transition-colors disabled:opacity-40"
            style={{
              minHeight: 40,
              fontSize: 14,
              fontWeight: 700,
              border: selected ? '2px solid transparent' : `2px solid ${T.grey200}`,
              background: selected ? gc.bg : '#fff',
              color: selected ? gc.color : T.grey700,
              cursor: disabled ? 'not-allowed' : 'pointer',
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
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
