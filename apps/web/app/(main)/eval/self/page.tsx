'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useEvaluations,
  useEvaluationDetail,
  evaluationCommands,
} from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { useToast } from '@/components/Toast';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { KpiCard } from '@/components/KpiCard';
import { AchievementField } from '@/components/AchievementField';
import { ScoreCard } from '@/components/ScoreCard';
import { Tabs } from '@/components/Tabs';
import { ProgressDonut } from '@/components/ProgressDonut';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { kpiGroupLabel, measureTypeUnit } from '@/lib/ui';
import type { Kpi, KpiGroup, KpiScore } from '@/lib/types';

type TabKey = KpiGroup;

// 실적 입력 로컬 상태(제출 전 임시) — kpiId → 입력값.
interface AchInput {
  actualValue?: number;
  count?: number;
  qualitativeNote?: string;
}

export default function SelfEvaluationPage() {
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

  // 내 확정 KPI(평가 대상). confirmed 만 평가.
  const { data: myKpis, loading: kpiLoading } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const allKpis: Kpi[] = myKpis?.data ?? [];
  const kpis = useMemo(
    () => allKpis.filter((k) => k.status === 'confirmed'),
    [allKpis],
  );

  const readOnly =
    selfEval?.status === 'submitted' || selfEval?.status === 'finalized';

  const [activeTab, setActiveTab] = useState<TabKey>('performance_core');
  const [inputs, setInputs] = useState<Record<string, AchInput>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // detail.kpiScores 로 기존 입력 초기화(달성률 표시용은 백엔드 값 사용).
  useEffect(() => {
    if (!detail) return;
    const next: Record<string, AchInput> = {};
    for (const s of detail.kpiScores) {
      next[s.kpiId] = { actualValue: undefined };
    }
    setInputs((prev) => ({ ...next, ...prev }));
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreByKpi = useMemo(() => {
    const map = new Map<string, KpiScore>();
    for (const s of detail?.kpiScores ?? []) map.set(s.kpiId, s);
    return map;
  }, [detail?.kpiScores]);

  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');
  const tabKpis = activeTab === 'performance_core' ? coreKpis : growthKpis;

  // 진행률: 입력된 KpiScore 수 / 전체 KPI 수 (정성은 부서장 등급이므로 실적 입력만 카운트)
  const doneCount = detail?.kpiScores.length ?? 0;
  const totalCount = kpis.length;

  function updateInput(kpiId: string, patch: AchInput) {
    setInputs((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  // 임시저장 = PATCH kpiScores. 백엔드가 측정방식·RuleSet 으로 등급·점수 산출.
  async function save(): Promise<boolean> {
    if (!selfEval) return false;
    const kpiScores = kpis
      .map((k) => {
        const inp = inputs[k.id] ?? {};
        // qualitative 는 self 가 등급을 부여하지 않음 — 서술만(점수 항목 미전송).
        if (k.measureType === 'qualitative') return null;
        const ach =
          k.measureType === 'count' ? inp.count : inp.actualValue;
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

  // 미입력(정성 제외) KPI 존재 시 제출 비활성.
  const measurable = kpis.filter((k) => k.measureType !== 'qualitative');
  const missingCount = measurable.filter((k) => {
    const inp = inputs[k.id] ?? {};
    const has =
      (k.measureType === 'count' ? inp.count : inp.actualValue) !== undefined ||
      scoreByKpi.has(k.id);
    return !has;
  }).length;
  const canSubmit = !readOnly && !!selfEval && kpis.length > 0 && missingCount === 0;

  useSetPrimaryAction(
    selfEval && !readOnly
      ? {
          label: '본인평가 제출',
          onClick: () => void handleSubmit(),
          disabled: !canSubmit,
          loading: submitting,
        }
      : readOnly
        ? { label: '제출 완료', onClick: () => {}, disabled: true }
        : null,
    [selfEval?.id, readOnly, canSubmit, submitting],
  );

  if (cyclesLoading || evalLoading) return <SelfSkeleton />;
  if (evalError) return <ErrorState onRetry={reloadEvals} />;
  if (!current) return <EmptyState title="지금은 본인평가 기간이 아니에요." />;

  const tabs = [
    {
      key: 'performance_core',
      label: kpiGroupLabel.performance_core,
      badge: coreKpis.length || undefined,
    },
    {
      key: 'collaboration_growth',
      label: kpiGroupLabel.collaboration_growth,
      badge: growthKpis.length || undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="본인평가"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-3">
            {selfEval && <StatusBadge status={selfEval.status} />}
            <ProgressDonut done={doneCount} total={totalCount || 1} size={48} />
          </div>
        }
      />

      <InfoBanner tone="tip" title="본인평가 작성 안내">
        과제별로 실적을 입력하면 측정방식에 따라 등급·점수가 자동 산정돼요.
        성과중심·협업·성장 탭을 모두 입력한 뒤 우측 하단에서 제출하세요.
      </InfoBanner>

      {!selfEval ? (
        <EmptyState
          title="아직 본인평가를 시작하지 않았어요."
          description="시작하면 KPI별 실적을 입력할 수 있어요."
          action={
            <Button onClick={handleCreateSelf} loading={createBusy}>
              본인평가 시작하기
            </Button>
          }
        />
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        <EmptyState
          title="아직 확정된 KPI가 없어요."
          description="KPI 작성에서 과제를 등록·확정해 주세요."
          action={
            <Link href="/kpi">
              <Button>KPI 작성하기</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Tabs
            items={tabs}
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as TabKey)}
          />

          {tabKpis.length === 0 ? (
            <EmptyState
              title={`${kpiGroupLabel[activeTab]}에 해당하는 KPI가 없어요.`}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {tabKpis.map((kpi) => {
                const score = scoreByKpi.get(kpi.id) ?? null;
                const inp = inputs[kpi.id] ?? {};
                const unit = measureTypeUnit[kpi.measureType];
                return (
                  <KpiCard
                    key={kpi.id}
                    mode="self"
                    data={{
                      id: kpi.id,
                      category: kpi.category,
                      group: kpi.group,
                      measureType: kpi.measureType,
                      coreStrategy: kpi.coreStrategy ?? '',
                      title: kpi.title,
                      csf: kpi.csf ?? undefined,
                      measureMethod: kpi.measureMethod ?? undefined,
                      targetValue: kpi.targetValue ?? undefined,
                      unit,
                      weight: kpi.weight,
                      isQualitative: kpi.isQualitative,
                      status: kpi.status,
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
                      <AchievementField
                        measureType={kpi.measureType}
                        targetValue={kpi.targetValue ?? undefined}
                        unit={unit}
                        actualValue={inp.actualValue}
                        count={inp.count}
                        achievementRate={score?.achievementRate}
                        autoGrade={score?.grade ?? null}
                        qualitativeNote={inp.qualitativeNote}
                        onChange={(v) => updateInput(kpi.id, v)}
                        readOnly={readOnly}
                      />
                      <div className="score-rail self-start">
                        <ScoreCard
                          prominent
                          label="과제 점수"
                          score={score?.score ?? 0}
                          measureType={kpi.measureType}
                          achievementRate={score?.achievementRate}
                          count={inp.count}
                          grade={score?.grade}
                          weight={kpi.weight}
                          hint="실적 입력 시 자동 산정"
                        />
                      </div>
                    </div>
                  </KpiCard>
                );
              })}
            </div>
          )}

          {!readOnly && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {missingCount > 0
                  ? `미입력 ${missingCount}건 — 모두 입력해야 제출할 수 있어요.`
                  : '모든 실적을 입력했어요. 제출할 수 있어요.'}
              </p>
              <Button variant="secondary" onClick={() => void save()}>
                임시저장
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SelfSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
