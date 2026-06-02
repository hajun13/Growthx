'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { GradeRadio } from '@/components/GradeRadio';
import { GradeChip } from '@/components/GradeChip';
import { ScoreCard } from '@/components/ScoreCard';
import {
  DistributionBarChart,
} from '@/components/DistributionBarChart';
import { PoolGauge } from '@/components/PoolGauge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import {
  cx,
  fmtScore,
  measureTypeLabel,
  measureTypeUnit,
} from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import type {
  Grade,
  GradePool,
  Evaluation,
  Kpi,
} from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export default function DeptHeadEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canEvaluateDownward(user.role);
  // round: 팀장=1, 본부장=2 (hr_admin 은 열람 — round 무관, 둘 다 노출)
  const round = user?.role === 'division_head' ? 2 : 1;

  const {
    data: evals,
    loading,
    error,
    reload,
  } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && allowed },
  );
  const targets: Evaluation[] = evals?.data ?? [];

  const [selectedId2, setSelectedId2] = useState<string | null>(null);
  const activeEval = useMemo(
    () => targets.find((t) => t.id === selectedId2) ?? targets[0] ?? null,
    [targets, selectedId2],
  );

  const { data: detail, loading: detailLoading, reload: reloadDetail } =
    useEvaluationDetail(activeEval?.id ?? null);

  // 대상자 확정 KPI (정성 등급 부여용)
  const { data: kpiData } = useKpis(
    { cycleId, userId: activeEval?.evaluateeId },
    { enabled: !!cycleId && !!activeEval },
  );
  const kpis: Kpi[] = (kpiData?.data ?? []).filter(
    (k) => k.status === 'confirmed',
  );

  // 그룹 등급 풀 (상한 표시)
  const { data: pools } = useGradePools(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );
  const pool: GradePool | null = pools?.data[0] ?? null;

  const readOnly =
    activeEval?.status === 'submitted' || activeEval?.status === 'finalized';

  // 정성 KPI 등급 부여 로컬 상태(kpiId → grade)
  const [directGrades, setDirectGrades] = useState<Record<string, Grade>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDirectGrades({});
    setComment('');
  }, [activeEval?.id]);

  // 팀 등급 분포(확정 finalGrade 집계) + 풀 상한
  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const t of targets) {
      if (t.finalGrade) c[t.finalGrade] += 1;
    }
    return c;
  }, [targets]);

  const caps = useMemo(() => {
    if (!pool) return undefined;
    const total = targets.length;
    const ratios: Record<Grade, number> = {
      S: pool.sRatio,
      A: pool.aRatio,
      B: pool.bRatio,
      C: pool.cRatio,
      D: pool.dRatio,
    };
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const g of GRADES) c[g] = Math.floor((ratios[g] / 100) * total);
    return c;
  }, [pool, targets.length]);

  const qualitativeKpis = kpis.filter((k) => k.measureType === 'qualitative');
  const qualitativeComplete = qualitativeKpis.every((k) => directGrades[k.id]);
  const commentMissing = comment.trim().length === 0;
  const canSubmit =
    !readOnly && !!activeEval && qualitativeComplete && !commentMissing;

  async function handleSubmit() {
    if (!activeEval) return;
    setSubmitting(true);
    try {
      // 정성 KPI 직접 등급 + 기존 자동 점수 weight 전달.
      const kpiScores = kpis.map((k) => {
        const existing = detail?.kpiScores.find((s) => s.kpiId === k.id);
        if (k.measureType === 'qualitative') {
          return {
            kpiId: k.id,
            directGrade: directGrades[k.id],
            weight: k.weight,
          };
        }
        return {
          kpiId: k.id,
          achievementRate: existing?.achievementRate,
          weight: k.weight,
        };
      });
      await evaluationCommands.patch(activeEval.id, { kpiScores });
      // 코멘트 필수 — 분기 0(평가 단계 코멘트).
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

  useSetPrimaryAction(
    activeEval && !readOnly
      ? {
          label: `${round}차 평가 제출`,
          onClick: () => void handleSubmit(),
          disabled: !canSubmit,
          loading: submitting,
        }
      : readOnly
        ? { label: '제출 완료', onClick: () => {}, disabled: true }
        : null,
    [activeEval?.id, readOnly, canSubmit, submitting, round],
  );

  if (!allowed) {
    return <Forbidden message="부서장 평가 권한이 없어요." />;
  }
  if (cyclesLoading || loading) return <DeptHeadSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="지금은 부서장 평가 기간이 아니에요." />;

  // 풀 상한 소진 등급(부여 차단)
  const soldOutGrades: Grade[] = caps
    ? GRADES.filter((g) => counts[g] >= caps[g])
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`부서장 평가 · ${round}차 (${round === 2 ? '본부장' : '팀장'})`}
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          activeEval && <StatusBadge status={activeEval.status} />
        }
      />

      {/* 그룹 등급 풀 분포 */}
      <Card title="그룹 등급 풀 분포">
        {pool ? (
          <div className="flex flex-col gap-4">
            <DistributionBarChart
              counts={counts}
              caps={caps}
              tier={pool.tier}
              total={targets.length}
            />
            {caps && (
              <div className="flex flex-wrap gap-4">
                {GRADES.map((g) => (
                  <PoolGauge key={g} grade={g} used={counts[g]} cap={caps[g]} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            아직 그룹 등급 풀이 산정되지 않았어요. HR이 풀을 적용하면 상한이
            표시돼요.
          </p>
        )}
      </Card>

      {targets.length === 0 ? (
        <EmptyState title="평가할 팀원이 없어요." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          {/* 팀원 목록 */}
          <Card title="팀원">
            <ul className="flex flex-col gap-1">
              {targets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId2(t.id)}
                    className={cx(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-base outline-none focus-visible:shadow-focus',
                      t.id === activeEval?.id
                        ? 'bg-primary-50 font-semibold text-primary-700'
                        : 'text-neutral-700 hover:bg-neutral-100',
                    )}
                  >
                    <span>{t.evaluateeId.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      {t.finalGrade && (
                        <GradeChip grade={t.finalGrade} size="sm" />
                      )}
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* 평가 패널 */}
          <Card title="평가 패널">
            {!activeEval || detailLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="flex flex-col gap-4">
                <ScoreCard
                  score={activeEval.totalScore ?? 0}
                  grade={activeEval.finalGrade ?? undefined}
                  label="종합 점수(백엔드 산정)"
                />

                {/* 과제별 점수(읽기) */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-neutral-700">
                    과제별 성과
                  </h3>
                  {(detail?.kpiScores ?? []).length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      본인평가 실적이 아직 입력되지 않았어요.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-sm text-neutral-700">
                      {(detail?.kpiScores ?? []).map((s) => {
                        const kpi = kpis.find((k) => k.id === s.kpiId);
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
                          >
                            <span>
                              {kpi?.title ?? s.kpiId.slice(0, 8)} ·{' '}
                              {kpi ? measureTypeLabel[kpi.measureType] : ''} ·
                              달성률 {fmtScore(s.achievementRate)}
                              {kpi ? measureTypeUnit[kpi.measureType] : ''}
                            </span>
                            <GradeChip grade={s.grade} size="sm" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* 정성 KPI 등급 부여 (GradeRadio) */}
                {qualitativeKpis.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      정성 KPI 등급 부여
                    </h3>
                    {qualitativeKpis.map((k) => (
                      <div key={k.id} className="flex flex-col gap-2">
                        <span className="text-base text-neutral-800">
                          {k.title} (가중치 {k.weight}%)
                        </span>
                        <GradeRadio
                          name={`grade-${k.id}`}
                          value={directGrades[k.id] ?? null}
                          onChange={(g) =>
                            setDirectGrades((prev) => ({ ...prev, [k.id]: g }))
                          }
                          readOnly={readOnly}
                          disabledGrades={soldOutGrades}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 코멘트 필수 */}
                <TextField
                  label="평가 코멘트 (필수)"
                  multiline
                  rows={3}
                  value={comment}
                  onChange={setComment}
                  readOnly={readOnly}
                  placeholder="평가 의견을 작성해 주세요."
                  required
                  error={
                    !readOnly && commentMissing
                      ? '코멘트를 작성해야 제출할 수 있어요.'
                      : undefined
                  }
                />

                {!readOnly && soldOutGrades.length > 0 && (
                  <p className="text-sm text-warning-700">
                    풀 상한이 소진된 등급: {soldOutGrades.join(', ')} — 부여할 수
                    없어요.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function DeptHeadSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
