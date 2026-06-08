'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Send, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useEvaluations,
  useEvaluationDetail,
  evaluationCommands,
} from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import {
  kpiCategoryLabel,
  measureTypeLabel,
  measureTypeUnit,
  fmtScore,
} from '@/lib/ui';
import { T, gradeChipColor } from '@/lib/toss';
import { GradeCriteriaPicker } from '@/components/GradeCriteriaPicker';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import type { Kpi, KpiGroup, KpiScore, Grade } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

interface AchInput {
  actualValue?: number;
  count?: number;
  qualitativeNote?: string;
  // 정성 KPI 자기 등급(directGrade) — 본인이 세운 기준에 따라 선택.
  directGrade?: Grade;
}

// 그룹별 섹션 색(KPI 작성 탭과 동일 — 성과중심 파랑 / 협업·성장 초록).
const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};

const cellInput: React.CSSProperties = {
  border: `1px solid ${T.grey200}`,
  padding: '8px 10px',
  fontSize: 13,
  color: T.grey900,
  background: '#fff',
  width: '100%',
  outline: 'none',
};

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  not_started: { label: '미시작', bg: T.grey500 },
  in_progress: { label: '진행중', bg: T.blue500 },
  submitted: { label: '제출 완료', bg: T.green500 },
  finalized: { label: '확정', bg: T.blue700 },
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
                className="px-3 py-1.5 text-white"
                style={{ fontSize: 11, fontWeight: 600, background: status.bg }}
              >
                {status.label}
              </span>
            )}
            {selfEval && !readOnly && (
              <>
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5 px-4 py-2"
                  style={{ fontSize: 13, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-60"
                  style={{ fontSize: 13, fontWeight: 600, background: canSubmit ? T.blue500 : T.grey400 }}
                >
                  <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
                </button>
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="p-4 border" style={{ background: T.grey100, borderColor: T.grey200 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.green500 }}>
            본인평가가 제출되었습니다. 부서장 평가가 진행돼요.
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '평가 대상자', value: user?.name ?? '나', accent: false },
          { label: '평가 기간', value: current.name, accent: false },
          { label: '진행률', value: `${progressPct}%`, accent: true },
          { label: '입력 현황', value: `${doneCount} / ${totalCount}건`, accent: false },
        ].map((c, i) => (
          <div key={i} className="px-4 py-3" style={card}>
            <div style={{ fontSize: 11, color: T.grey500 }}>{c.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.accent ? T.blue500 : T.grey900, marginTop: 2 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {!selfEval ? (
        <div className="px-5 py-10 text-center" style={card}>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>아직 본인평가를 시작하지 않았어요.</p>
          <p style={{ fontSize: 13, color: T.grey500, marginTop: 4, marginBottom: 16 }}>
            시작하면 KPI별 실적을 입력할 수 있어요.
          </p>
          <button
            onClick={handleCreateSelf}
            disabled={createBusy}
            className="px-5 py-2.5 text-white disabled:opacity-60"
            style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}
          >
            {createBusy ? '시작 중…' : '본인평가 시작하기'}
          </button>
        </div>
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        allKpis.length === 0 ? (
          // KPI 자체가 없음 — 작성·제출이 필요(정상 진입점).
          <div className="px-5 py-10 text-center" style={card}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>아직 작성한 KPI가 없어요.</p>
            <p style={{ fontSize: 13, color: T.grey500, marginTop: 4, marginBottom: 16 }}>
              KPI 작성에서 과제를 등록하고 제출해 주세요.
            </p>
            <Link href="/kpi">
              <span className="inline-block px-5 py-2.5 text-white" style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}>
                KPI 작성하기
              </span>
            </Link>
          </div>
        ) : (
          // KPI는 있으나 아직 확정 전 — 검토·확정 대기 단계 안내(막다른 동선 방지).
          <div className="px-5 py-10 text-center" style={card}>
            <p style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>KPI가 확정되면 본인평가를 입력할 수 있어요.</p>
            <p style={{ fontSize: 13, color: T.grey500, marginTop: 4, marginBottom: 4 }}>
              제출한 KPI는 <b style={{ color: T.grey700 }}>팀장·HR의 검토·확정</b> 후 본인평가 대상이 됩니다.
            </p>
            <p style={{ fontSize: 13, color: T.grey600, marginBottom: 16 }}>
              현재 상태 — <b style={{ color: T.grey700 }}>{pendingStatusLabel}</b>
            </p>
            <Link href="/kpi">
              <span
                className="inline-block px-5 py-2.5"
                style={{ fontSize: 13, fontWeight: 600, color: T.grey700, background: T.grey100, border: `1px solid ${T.grey200}` }}
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
            className="flex items-start gap-2 px-4 py-3"
            style={{ background: '#EEF4FF', border: `1px solid #D5E4FF` }}
          >
            <Info size={15} color={T.blue600} style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: T.grey700, lineHeight: 1.5 }}>
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
                  const liveGrade: Grade | undefined = isQual
                    ? inp.directGrade
                    : score?.grade ?? undefined;
                  const done = isComplete(kpi);
                  const targetStr = kpi.targetText?.trim()
                    ? kpi.targetText
                    : kpi.targetValue !== null
                      ? `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
                      : null;
                  return (
                    <div key={kpi.id} style={{ ...card, overflow: 'hidden' }}>
                      {/* 카드 헤더 */}
                      <div
                        className="flex items-start gap-3 px-4 py-3"
                        style={{ borderBottom: `1px solid ${T.grey100}` }}
                      >
                        <span
                          className="inline-block px-2 py-1"
                          style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', background: cfg.bg, flexShrink: 0 }}
                        >
                          {kpiCategoryLabel[kpi.category]}
                        </span>
                        <div className="flex-1" style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{kpi.title}</div>
                          <div
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                            style={{ fontSize: 11.5, color: T.grey500, marginTop: 3 }}
                          >
                            {kpi.csf && <span>{kpi.csf}</span>}
                            {kpi.csf && <span>·</span>}
                            <span>{measureTypeLabel[kpi.measureType]}</span>
                            {targetStr && <span>·</span>}
                            {targetStr && <span>목표 {targetStr}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5" style={{ flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: T.grey600 }} className="tabular-nums">
                            가중치 {kpi.weight}%
                          </span>
                          {liveGrade ? (
                            <div className="flex items-center gap-1.5">
                              {!isQual && (
                                <span className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: T.blue600 }}>
                                  {fmtScore(score?.score)}
                                </span>
                              )}
                              <GradeBadge grade={liveGrade} />
                            </div>
                          ) : (
                            <span
                              className="px-2 py-0.5"
                              style={{ fontSize: 11, fontWeight: 600, color: T.grey500, background: T.grey100 }}
                            >
                              {isQual ? '등급 미선택' : '실적 미입력'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 카드 본문 */}
                      <div className="px-4 py-3.5 space-y-3.5">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 하단 바 */}
          {!readOnly && (
            <div
              className="flex items-center justify-between flex-wrap gap-2"
              style={{ ...card, padding: '12px 16px' }}
            >
              <p style={{ fontSize: 13, color: T.grey600 }}>
                <span style={{ fontWeight: 700, color: T.grey900 }}>{doneCount}</span>/{totalCount}건 완료
                {missingCount > 0 ? ` · 미완료 ${missingCount}건` : ' · 모두 완료했어요'}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5 px-4 py-2"
                  style={{ fontSize: 13, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-60"
                  style={{ fontSize: 13, fontWeight: 600, background: canSubmit ? T.blue500 : T.grey400 }}
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
