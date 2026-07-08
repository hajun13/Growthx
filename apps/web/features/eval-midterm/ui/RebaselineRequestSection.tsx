'use client';

// 본인 목표 재조정 — 단일 모달 흐름(2026-07-02 재구성, 사용자 피드백):
//  - 신청/수정은 같은 모달 안에서 인라인 폼으로 전환(중첩 팝업·확인 다이얼로그 제거).
//  - 요청이 없으면 진입 즉시 폼(클릭 한 번 절약). 있으면 상태·diff 표 → [수정] 시 폼 전환.
//  - 이력 패널·카드 중첩 제거로 모달을 가볍게.
// 상태값: submitted | approved | rejected (계약: contract-midterm.md §7).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useRebaselineRequests,
  useRebaselineRequestDetail,
} from '@/hooks/useMidterm';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { EmptyState, Skeleton } from '@/components/States';
import { RebaselineTable, type RebaselineRow } from '@/components/RebaselineTable';
import { WeightSummaryBar } from '@/components/WeightSummaryBar';
import { RebaselineStatusBadge } from '@/components/RebaselineStatusBadge';
import { RebaselineInlineForm } from './RebaselineInlineForm';
import type { RebaselineRequestDetail } from '@/lib/types';

interface Props {
  cycleId: string;
  userId: string;
  readOnly: boolean; // mid_review 아닌 단계 → 읽기전용
  /** 폼 취소 시 표시할 기존 요청이 없으면 모달을 닫는다. */
  onClose?: () => void;
  /** 폼 작성 중(미제출 변경) 여부 통지 — 모달 닫기 무확인 파기 방지용. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function RebaselineRequestSection({ cycleId, userId, readOnly, onClose, onDirtyChange }: Props) {
  const {
    data: reqList,
    loading: reqListLoading,
    reload: reloadList,
  } = useRebaselineRequests({ cycleId, evaluateeId: userId }, { enabled: !!cycleId });

  // 미결(submitted) 우선, 없으면 최신.
  const latestReq = useMemo(() => {
    const list = reqList?.data ?? [];
    return (
      list.find((r) => r.status === 'submitted') ??
      [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
      null
    );
  }, [reqList]);

  const {
    data: detail,
    loading: detailLoading,
    reload: reloadDetail,
  } = useRebaselineRequestDetail(latestReq?.id ?? null, { enabled: !!latestReq?.id });

  const reloadAll = useCallback(() => {
    reloadList();
    reloadDetail();
  }, [reloadList, reloadDetail]);

  // 화면 모드 — 로딩 후 1회 결정: 요청 없음 + 편집 가능 → 바로 폼.
  const [mode, setMode] = useState<'status' | 'form' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null=신규
  useEffect(() => {
    if (mode === null && !reqListLoading) {
      setMode(!latestReq && !readOnly ? 'form' : 'status');
    }
  }, [mode, reqListLoading, latestReq, readOnly]);

  if (reqListLoading || mode === null) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (mode === 'form') {
    return (
      <RebaselineInlineForm
        cycleId={cycleId}
        userId={userId}
        editingId={editingId}
        existingDetail={editingId && detail ? detail : null}
        onCancel={() => {
          onDirtyChange?.(false);
          if (latestReq) setMode('status');
          else onClose?.();
        }}
        onSaved={() => {
          onDirtyChange?.(false);
          reloadAll();
          setMode('status');
        }}
        onDirtyChange={onDirtyChange}
      />
    );
  }

  // ── 상태 보기 ──
  if (!latestReq) {
    return (
      <EmptyState
        title="아직 목표 재조정 요청이 없어요."
        description={
          readOnly
            ? '중간평가(mid_review) 단계에서만 목표 재조정을 요청할 수 있어요.'
            : "'재조정 신청' 버튼으로 확정 KPI의 목표·가중치 변경을 제안해 보세요."
        }
        action={
          !readOnly ? (
            <Button size="sm" onClick={() => { setEditingId(null); setMode('form'); }}>
              재조정 신청
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 상태 헤더 — 배지 + 수정/재제출/새 신청 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <RebaselineStatusBadge status={latestReq.status} />
        <span className="mr-auto text-[12px] text-muted-foreground">
          {latestReq.status === 'submitted'
            ? '부서장 검토를 기다리고 있어요. 검토 전에는 수정할 수 있어요.'
            : latestReq.status === 'approved'
              ? '승인되어 목표에 반영됐어요.'
              : '반려됐어요 — 사유 확인 후 수정해 재제출할 수 있어요.'}
        </span>
        {!readOnly && (
          <Button
            size="sm"
            variant={latestReq.status === 'submitted' ? 'secondary' : 'primary'}
            onClick={() => {
              setEditingId(latestReq.status === 'approved' ? null : latestReq.id);
              setMode('form');
            }}
          >
            {latestReq.status === 'submitted'
              ? '수정'
              : latestReq.status === 'rejected'
                ? '수정·재제출'
                : '새 재조정 신청'}
          </Button>
        )}
      </div>

      <RequestStatusPanel detail={detail ?? null} loading={detailLoading} onReload={reloadAll} />
    </div>
  );
}

// ── 상태 패널(기존 요청 표시) ──
function RequestStatusPanel({
  detail,
  loading,
  onReload,
}: {
  detail: RebaselineRequestDetail | null;
  loading: boolean;
  onReload: () => void;
}) {
  if (loading && !detail) return <Skeleton className="h-48 w-full" />;
  if (!detail) return null;

  const isRejected = detail.status === 'rejected';
  const isSubmitted = detail.status === 'submitted';
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '';

  return (
    <div className="flex flex-col gap-3">
      {isSubmitted && !detail.weightValid && (
        <InfoBanner tone="tip" title="가중치 합을 확인해 주세요.">
          현재 합 {detail.projectedWeightSum}% — 합이 100%여야 승인될 수 있어요.
        </InfoBanner>
      )}

      {/* 반려 사유 */}
      {isRejected && (
        <div className="flex items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-3.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-danger-700 leading-snug">
              반려됐어요
              {detail.reviewerName ? ` · ${detail.reviewerName}` : ''}
              {detail.reviewedAt ? ` · ${fmtDate(detail.reviewedAt)}` : ''}
            </p>
            {detail.reviewComment && (
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-danger-700/80">
                {detail.reviewComment}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 승인 정보 */}
      {detail.status === 'approved' && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success-100 bg-success-50 p-3">
          <CheckCircle2 size={15} className="shrink-0 text-success-700" aria-hidden />
          <p className="text-[13px] font-semibold text-success-700">
            승인·반영됐어요
            {detail.reviewerName && (
              <span className="ml-1.5 text-[12px] font-normal text-success-600">
                ({detail.reviewerName}
                {detail.reviewedAt ? ` · ${fmtDate(detail.reviewedAt)}` : ''})
              </span>
            )}
          </p>
        </div>
      )}

      {/* 재조정 사유 */}
      <div className="rounded-md bg-muted px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          재조정 사유
        </span>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
          {detail.reason}
        </p>
      </div>

      <WeightSummaryBar
        totalWeight={detail.projectedWeightSum}
        qualitativeWeight={
          detail.currentKpis
            .filter((k) => k.isQualitative)
            .reduce((s, k) => {
              const item = detail.items.find((i) => i.kpiId === k.id);
              return s + (item?.weight ?? k.weight);
            }, 0)
        }
        compact
      />

      {/* 제안 vs 현재 diff 표(읽기전용) */}
      {detail.proposedChanges.length > 0 ? (
        <ProposedChangesTable
          changes={detail.proposedChanges}
          currentKpis={detail.currentKpis}
          items={detail.items}
        />
      ) : (
        <p className="text-[12px] text-muted-foreground">변경 내용이 없어요.</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} aria-hidden /> 새로고침
        </button>
      </div>
    </div>
  );
}

// ── 제안 vs 현재 diff 표 (읽기전용 RebaselineTable 변형) ──
function ProposedChangesTable({
  changes,
  currentKpis,
  items,
}: {
  changes: RebaselineRequestDetail['proposedChanges'];
  currentKpis: RebaselineRequestDetail['currentKpis'];
  items: RebaselineRequestDetail['items'];
}) {
  const rows: RebaselineRow[] = currentKpis.map((k) => {
    const item = items.find((i) => i.kpiId === k.id);
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
  });

  return <RebaselineTable rows={rows} onChange={() => {}} readOnly />;
}
