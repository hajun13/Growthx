'use client';

// 목표 재조정 신청/수정 폼 — 모달 안 인라인 렌더(중첩 팝업·확인 다이얼로그 제거, 2026-07-02).
// 신규: 확정 KPI 조회로 행 구성 / 수정: 기존 상세(currentKpis+items)에서 복원.
import { useEffect, useMemo, useState } from 'react';
import { useKpis } from '@/hooks/useKpis';
import { rebaselineRequestCommands } from '@/hooks/useMidterm';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { EmptyState, Skeleton } from '@/components/States';
import { RebaselineTable, isRowChanged, type RebaselineRow } from '@/components/RebaselineTable';
import { WeightSummaryBar } from '@/components/WeightSummaryBar';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import type { Kpi, RebaselineRequestDetail } from '@/lib/types';

function kpiToRow(k: Kpi): RebaselineRow {
  return {
    kpiId: k.id,
    title: k.title,
    group: k.group,
    measureType: k.measureType,
    isQualitative: k.isQualitative,
    currentTargetValue: k.targetValue,
    currentTargetText: k.targetText,
    currentWeight: k.weight,
    nextTargetValue: k.targetValue,
    nextTargetText: k.targetText,
    nextWeight: k.weight,
  };
}

export function RebaselineInlineForm({
  cycleId,
  userId,
  editingId,
  existingDetail,
  onCancel,
  onSaved,
}: {
  cycleId: string;
  userId: string;
  editingId: string | null; // null=신규
  existingDetail: RebaselineRequestDetail | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { data: kpiData, loading: kpiLoading } = useKpis(
    { cycleId, userId, status: 'confirmed' },
    { enabled: !existingDetail },
  );

  const [rows, setRows] = useState<RebaselineRow[]>([]);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existingDetail) {
      setRows(
        existingDetail.currentKpis.map((k): RebaselineRow => {
          const item = existingDetail.items.find((i) => i.kpiId === k.id);
          return {
            kpiId: k.id,
            title: k.title,
            group: k.group as RebaselineRow['group'],
            measureType: k.measureType as RebaselineRow['measureType'],
            isQualitative: k.isQualitative,
            currentTargetValue: k.targetValue,
            currentTargetText: k.targetText,
            currentWeight: k.weight,
            nextTargetValue: item?.targetValue !== undefined ? (item.targetValue ?? k.targetValue) : k.targetValue,
            nextTargetText: item?.targetText !== undefined ? (item.targetText ?? k.targetText) : k.targetText,
            nextWeight: item?.weight !== undefined ? item.weight : k.weight,
          };
        }),
      );
      setReason(existingDetail.reason);
    } else {
      setRows((kpiData?.data ?? []).map(kpiToRow));
    }
  }, [existingDetail, kpiData]);

  function patchRow(kpiId: string, patch: Partial<RebaselineRow>) {
    setRows((prev) => prev.map((r) => (r.kpiId === kpiId ? { ...r, ...patch } : r)));
  }

  const changedRows = useMemo(() => rows.filter(isRowChanged), [rows]);
  const totalWeight = useMemo(
    () => rows.reduce((s, r) => s + (Number.isFinite(r.nextWeight) ? r.nextWeight : 0), 0),
    [rows],
  );
  const qualWeight = useMemo(
    () =>
      rows
        .filter((r) => r.isQualitative || r.measureType === 'qualitative')
        .reduce((s, r) => s + r.nextWeight, 0),
    [rows],
  );

  const sumOk = totalWeight === 100;
  const reasonOk = reason.trim().length > 0;
  const hasChange = changedRows.length > 0;
  const negativeTarget = rows.some(
    (r) =>
      !(r.isQualitative || r.measureType === 'qualitative') &&
      r.nextTargetValue !== null &&
      r.nextTargetValue < 0,
  );
  const canSubmit = sumOk && reasonOk && hasChange && !negativeTarget;

  async function handleSubmit() {
    const items = changedRows.map((r) => {
      const qual = r.isQualitative || r.measureType === 'qualitative';
      const item: { kpiId: string; weight?: number; targetValue?: number | null; targetText?: string | null } = { kpiId: r.kpiId };
      if (r.nextWeight !== r.currentWeight) item.weight = r.nextWeight;
      if (qual) {
        if (r.nextTargetText !== r.currentTargetText) item.targetText = r.nextTargetText;
      } else {
        if (r.nextTargetValue !== r.currentTargetValue) item.targetValue = r.nextTargetValue;
      }
      return item;
    });

    setSubmitting(true);
    try {
      if (editingId) {
        await rebaselineRequestCommands.update(editingId, { reason: reason.trim(), items });
        toast.show({ variant: 'success', message: '재조정 요청을 수정·재제출했어요.' });
      } else {
        await rebaselineRequestCommands.create({ cycleId, reason: reason.trim(), items });
        toast.show({ variant: 'success', message: '재조정 요청을 제출했어요. 부서장이 검토할 거예요.' });
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '제출에 실패했어요.';
      if (err instanceof ApiError && err.message.includes('미결')) {
        toast.show({ variant: 'danger', message: '이미 검토 중인 재조정 요청이 있어요. 기존 요청을 수정·재제출해 주세요.' });
      } else {
        toast.show({ variant: 'danger', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = !existingDetail && kpiLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="flex flex-col gap-3.5">
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isEmpty ? (
        <EmptyState title="확정된 KPI가 없어요." description="KPI가 확정(confirmed) 상태여야 재조정을 요청할 수 있어요." />
      ) : (
        <>
          <WeightSummaryBar totalWeight={totalWeight} qualitativeWeight={qualWeight} compact />
          <RebaselineTable rows={rows} onChange={patchRow} />
          <TextField
            label="재조정 사유"
            multiline
            rows={2}
            required
            value={reason}
            onChange={(v) => {
              setReason(v);
              if (!reasonTouched) setReasonTouched(true);
            }}
            placeholder="예: 상반기 시장 위축으로 매출 목표 하향, 수주 비중 상향"
            hint="부서장이 승인하면 반영돼요. 감사 로그·이력에 기록돼요."
            error={reasonTouched && !reasonOk ? '재조정 사유를 입력해 주세요.' : undefined}
          />
        </>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {hasChange ? `변경 ${changedRows.length}개 KPI · 가중치 합 ${totalWeight}%` : '목표·가중치를 수정하면 여기에 요약돼요.'}
          {!sumOk && hasChange && <span className="ml-1 font-semibold text-danger-700">— 합이 100%여야 해요.</span>}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" disabled={submitting} onClick={onCancel}>
            취소
          </Button>
          <Button variant="primary" size="sm" loading={submitting} disabled={!canSubmit || submitting} onClick={() => void handleSubmit()}>
            {editingId ? '수정·재제출' : '제출'}
          </Button>
        </div>
      </div>
    </div>
  );
}
