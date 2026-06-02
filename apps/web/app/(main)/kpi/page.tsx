'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useKpis, kpiCommands } from '@/hooks/useKpis';
import { useToast } from '@/components/Toast';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Select } from '@/components/Select';
import { WeightField } from '@/components/WeightField';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import {
  kpiGroupLabel,
  kpiCategoryLabel,
  measureTypeLabel,
  measureTypeUnit,
} from '@/lib/ui';
import type {
  Kpi,
  KpiGroup,
  KpiCategory,
  MeasureType,
  CreateKpiRequest,
} from '@/lib/types';

const GROUP_OPTIONS = [
  { value: 'performance_core', label: kpiGroupLabel.performance_core },
  { value: 'collaboration_growth', label: kpiGroupLabel.collaboration_growth },
];
// 그룹별 허용 카테고리(domain-model §3)
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};
const MEASURE_OPTIONS = (['amount', 'rate', 'count', 'qualitative'] as MeasureType[]).map(
  (m) => ({ value: m, label: measureTypeLabel[m] }),
);

interface DraftKpi {
  id?: string;
  group: KpiGroup;
  category: KpiCategory;
  measureType: MeasureType;
  coreStrategy: string;
  csf: string;
  title: string;
  measureMethod: string;
  targetValue: string;
  weight: string;
  isQualitative: boolean;
}

function toDraft(k: Kpi): DraftKpi {
  return {
    id: k.id,
    group: k.group,
    category: k.category,
    measureType: k.measureType,
    coreStrategy: k.coreStrategy ?? '',
    csf: k.csf ?? '',
    title: k.title,
    measureMethod: k.measureMethod ?? '',
    targetValue: k.targetValue === null ? '' : String(k.targetValue),
    weight: String(k.weight),
    isQualitative: k.isQualitative,
  };
}

function emptyDraft(): DraftKpi {
  return {
    group: 'performance_core',
    category: 'revenue',
    measureType: 'amount',
    coreStrategy: '',
    csf: '',
    title: '',
    measureMethod: '',
    targetValue: '',
    weight: '',
    isQualitative: false,
  };
}

function draftToPayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  return {
    cycleId,
    group: d.group,
    category: d.category,
    measureType: d.measureType,
    coreStrategy: d.coreStrategy || undefined,
    csf: d.csf || undefined,
    title: d.title,
    measureMethod: d.measureMethod || undefined,
    targetValue: d.targetValue === '' ? undefined : Number(d.targetValue),
    weight: Number(d.weight) || 0,
    isQualitative: d.measureType === 'qualitative' ? true : d.isQualitative,
  };
}

export default function KpiWritePage() {
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

  const { data, loading: kpiLoading, error, reload } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  const serverKpis = data?.data ?? [];
  const editableServer = serverKpis.filter((k) => k.status === 'draft');
  const lockedServer = serverKpis.filter((k) => k.status !== 'draft');

  const [drafts, setDrafts] = useState<DraftKpi[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveDrafts = useMemo(
    () => drafts ?? editableServer.map(toDraft),
    [drafts, editableServer],
  );

  function updateDraft(idx: number, patch: Partial<DraftKpi>) {
    const base = drafts ?? editableServer.map(toDraft);
    const next = base.map((d, i) => {
      if (i !== idx) return d;
      const merged = { ...d, ...patch };
      // 그룹 변경 시 카테고리를 그룹 허용값으로 보정.
      if (patch.group && !CATEGORY_BY_GROUP[patch.group].includes(merged.category)) {
        merged.category = CATEGORY_BY_GROUP[patch.group][0];
      }
      if (patch.measureType === 'qualitative') merged.isQualitative = true;
      return merged;
    });
    setDrafts(next);
  }

  function addDraft() {
    const base = drafts ?? editableServer.map(toDraft);
    setDrafts([...base, emptyDraft()]);
  }

  const weightTotal = effectiveDrafts.reduce(
    (acc, d) => acc + (Number(d.weight) || 0),
    0,
  );
  const qualitativeTotal = effectiveDrafts
    .filter((d) => d.isQualitative || d.measureType === 'qualitative')
    .reduce((acc, d) => acc + (Number(d.weight) || 0), 0);

  const hasCore = effectiveDrafts.some((d) => d.group === 'performance_core');
  const hasGrowth = effectiveDrafts.some(
    (d) => d.group === 'collaboration_growth',
  );

  async function saveDraft(idx: number): Promise<boolean> {
    if (!cycleId) return false;
    const d = effectiveDrafts[idx];
    if (!d.title.trim()) {
      toast.show({ variant: 'danger', message: '과제명을 입력해 주세요.' });
      return false;
    }
    setSavingIdx(idx);
    try {
      const payload = draftToPayload(cycleId, d);
      if (d.id) await kpiCommands.update(d.id, payload);
      else await kpiCommands.create(payload);
      toast.show({ variant: 'success', message: '저장했어요.' });
      setDrafts(null);
      reload();
      return true;
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
      return false;
    } finally {
      setSavingIdx(null);
    }
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    const d = effectiveDrafts[deleteTarget];
    try {
      if (d.id) await kpiCommands.remove(d.id);
      const base = drafts ?? editableServer.map(toDraft);
      setDrafts(base.filter((_, i) => i !== deleteTarget));
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSubmitAll() {
    if (!cycleId) return;
    setSubmitting(true);
    try {
      for (const d of effectiveDrafts) {
        const payload = draftToPayload(cycleId, d);
        if (d.id) await kpiCommands.update(d.id, payload);
        else await kpiCommands.create(payload);
      }
      const { apiGetList } = await import('@/lib/api');
      const res = await apiGetList<Kpi>('/kpis', {
        cycleId,
        userId: user?.id,
        status: 'draft',
      });
      for (const k of res.data) await kpiCommands.submit(k.id);
      toast.show({ variant: 'success', message: 'KPI를 제출했어요.' });
      setDrafts(null);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? '가중치 합 100%, 정성 KPI 30% 이하인지 확인해 주세요.'
            : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    effectiveDrafts.length > 0 &&
    weightTotal === 100 &&
    qualitativeTotal <= 30 &&
    hasCore &&
    hasGrowth &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  useSetPrimaryAction(
    {
      label: 'KPI 제출',
      onClick: () => void handleSubmitAll(),
      disabled: !canSubmit,
      loading: submitting,
    },
    [canSubmit, submitting, effectiveDrafts.length, weightTotal],
  );

  if (cyclesLoading || kpiLoading) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="KPI 작성"
        subtitle="가중치 합 100%, 정성 KPI 30% 이하. 성과중심·협업·성장 둘 다 포함해 주세요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <Button variant="secondary" onClick={addDraft}>
            과제 추가 +
          </Button>
        }
      />

      {lockedServer.length > 0 && (
        <Card title="제출·확정된 과제">
          <ul className="flex flex-col gap-2">
            {lockedServer.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-base text-neutral-800">{k.title}</span>
                  <span className="text-xs text-neutral-500">
                    {kpiGroupLabel[k.group]} · {kpiCategoryLabel[k.category]} ·{' '}
                    {measureTypeLabel[k.measureType]}
                    {k.status === 'draft' && k.rejectReason
                      ? ` · 반려사유: ${k.rejectReason}`
                      : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-neutral-500">
                    가중치 {k.weight}%
                  </span>
                  <StatusBadge status={k.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {effectiveDrafts.length === 0 ? (
        <EmptyState
          title="첫 과제를 추가해 주세요."
          action={<Button onClick={addDraft}>과제 추가</Button>}
        />
      ) : (
        effectiveDrafts.map((d, idx) => {
          const isQual = d.measureType === 'qualitative';
          return (
            <Card
              key={d.id ?? `new-${idx}`}
              title={`과제 #${idx + 1}`}
              action={
                <div className="flex items-center gap-2">
                  <StatusBadge status="draft" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(idx)}
                  >
                    삭제
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select
                  label="지표 그룹"
                  value={d.group}
                  options={GROUP_OPTIONS}
                  onChange={(v) => updateDraft(idx, { group: v as KpiGroup })}
                />
                <Select
                  label="카테고리"
                  value={d.category}
                  options={CATEGORY_BY_GROUP[d.group].map((c) => ({
                    value: c,
                    label: kpiCategoryLabel[c],
                  }))}
                  onChange={(v) =>
                    updateDraft(idx, { category: v as KpiCategory })
                  }
                />
                <Select
                  label="측정방식"
                  value={d.measureType}
                  options={MEASURE_OPTIONS}
                  onChange={(v) =>
                    updateDraft(idx, { measureType: v as MeasureType })
                  }
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="핵심전략"
                  value={d.coreStrategy}
                  onChange={(v) => updateDraft(idx, { coreStrategy: v })}
                  placeholder="신규 시장 진출"
                />
                <TextField
                  label="CSF (핵심성공요인)"
                  value={d.csf}
                  onChange={(v) => updateDraft(idx, { csf: v })}
                />
                <TextField
                  label="과제명"
                  value={d.title}
                  onChange={(v) => updateDraft(idx, { title: v })}
                  placeholder="신규 수주 20억 달성"
                  required
                />
                <TextField
                  label="측정방법"
                  value={d.measureMethod}
                  onChange={(v) => updateDraft(idx, { measureMethod: v })}
                  placeholder="분기별 수주 계약액"
                />
                {!isQual && (
                  <TextField
                    label="목표값"
                    type="number"
                    value={d.targetValue}
                    onChange={(v) => updateDraft(idx, { targetValue: v })}
                    suffix={measureTypeUnit[d.measureType] || undefined}
                  />
                )}
                <div className="flex items-end gap-4">
                  <WeightField
                    value={Number(d.weight) || 0}
                    onChange={(v) => updateDraft(idx, { weight: String(v) })}
                    groupTotal={weightTotal}
                    group={d.group}
                    isQualitative={d.isQualitative || isQual}
                    qualitativeTotal={qualitativeTotal}
                  />
                  {!isQual && (
                    <label className="mb-2 flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={d.isQualitative}
                        onChange={(e) =>
                          updateDraft(idx, { isQualitative: e.target.checked })
                        }
                      />
                      정성 KPI
                    </label>
                  )}
                </div>
              </div>

              {isQual && (
                <p className="mt-2 text-xs text-warning-700">
                  정성 KPI는 부서장 평가에서 등급을 부여해요. 목표는 서술로
                  작성해 주세요.
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={savingIdx === idx}
                  onClick={() => void saveDraft(idx)}
                >
                  과제 저장
                </Button>
              </div>
            </Card>
          );
        })
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
        <span>
          가중치 합계 {weightTotal}% {weightTotal === 100 ? '✓' : '(100%)'}
        </span>
        <span>
          정성 {qualitativeTotal}% {qualitativeTotal <= 30 ? '✓' : '(≤30%)'}
        </span>
        <span>성과중심 {hasCore ? '✓' : '미포함'}</span>
        <span>협업·성장 {hasGrowth ? '✓' : '미포함'}</span>
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="과제를 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          onClick: () => void confirmDelete(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
      >
        삭제하면 작성한 내용이 사라져요.
      </Modal>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
