'use client';

// 부서장 재조정 검토 큐 — DeptHeadMidterm 에 섹션으로 통합.
// kpi/review 패턴(좌 목록·우 상세, 승인/반려 모달)을 그대로 차용.
// 계약: contract-midterm.md §7.
//  - GET /midterm/rebaseline-requests?forReview=true → 부서장 검토 큐.
//  - GET /midterm/rebaseline-requests/:id → 상세(proposedChanges·currentKpis·weightValid).
//  - PATCH /midterm/rebaseline-requests/:id/review { decision, comment } → 승인/반려.
import { useCallback, useMemo, useState } from 'react';
import { Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useRebaselineRequests,
  useRebaselineRequestDetail,
  rebaselineRequestCommands,
} from '@/hooks/useMidterm';
import { Card } from '@/components/Card';
import { EmptyState, Skeleton } from '@/components/States';
import { Modal } from '@/components/Modal';
import { RebaselineTable, type RebaselineRow } from '@/components/RebaselineTable';
import { WeightSummaryBar } from '@/components/WeightSummaryBar';
import { RebaselineStatusBadge } from '@/components/RebaselineStatusBadge';
import { RebaselineHistory } from '@/components/RebaselineHistory';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { T } from '@/lib/toss';
import type { RebaselineRequestView, RebaselineRequestDetail } from '@/lib/types';

interface Props {
  cycleId: string;
  readOnly: boolean; // mid_review 아닌 단계 → 검토 버튼 비활성
}

export function RebaselineReviewQueue({ cycleId, readOnly }: Props) {
  const toast = useToast();

  // forReview=true → 내가 부서장인 구성원들의 미결(submitted) 요청.
  const {
    data: queueData,
    loading: queueLoading,
    reload: reloadQueue,
  } = useRebaselineRequests(
    { cycleId, forReview: true },
    { enabled: !!cycleId },
  );

  const queueItems = queueData?.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeReq = useMemo(
    () => queueItems.find((r) => r.id === selectedId) ?? queueItems[0] ?? null,
    [queueItems, selectedId],
  );

  const {
    data: detail,
    loading: detailLoading,
    reload: reloadDetail,
  } = useRebaselineRequestDetail(activeReq?.id ?? null, { enabled: !!activeReq?.id });

  // 검토 모달 상태
  const [acting, setActing] = useState<{ mode: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reloadAll = useCallback(() => {
    reloadQueue();
    reloadDetail();
  }, [reloadQueue, reloadDetail]);

  function openModal(mode: 'approve' | 'reject') {
    setActing({ mode });
    setComment('');
  }

  function closeModal() {
    if (!submitting) {
      setActing(null);
      setComment('');
    }
  }

  async function handleReview() {
    if (!acting || !activeReq) return;
    setSubmitting(true);
    try {
      await rebaselineRequestCommands.review(activeReq.id, {
        decision: acting.mode,
        comment: comment.trim() || undefined,
      });
      const msg = acting.mode === 'approve'
        ? '승인·반영됐어요. KPI에 반영됐고 스냅샷이 캡처됐어요.'
        : '반려했어요. 구성원이 수정 후 재제출할 수 있어요.';
      toast.show({ variant: 'success', message: msg });
      closeModal();
      reloadAll();
      // 다음 미결 요청으로 자동 이동
      const remaining = queueItems.filter((r) => r.id !== activeReq.id);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '처리에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (queueLoading) {
    return (
      <Card title="재조정 검토 큐">
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (queueItems.length === 0) {
    return (
      <Card title="재조정 검토 큐">
        <EmptyState
          title="검토할 재조정 요청이 없어요."
          description="구성원이 목표 재조정을 요청하면 여기에 표시돼요."
        />
      </Card>
    );
  }

  return (
    <Card
      title="재조정 검토 큐"
      action={
        <span style={{ fontSize: 12, color: T.grey600 }}>
          검토 대기 {queueItems.length}건
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* 좌: 요청 목록 */}
        <div style={{ border: `1px solid ${T.grey200}` }}>
          <div
            className="px-3 py-2.5"
            style={{ background: T.grey50, borderBottom: `1px solid ${T.grey200}`, fontSize: 12, fontWeight: 600, color: T.grey700 }}
          >
            제안자 목록
          </div>
          <ul>
            {queueItems.map((req) => {
              const isActive = req.id === (activeReq?.id ?? null);
              return (
                <li key={req.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(req.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
                    style={{
                      borderBottom: `1px solid ${T.grey100}`,
                      borderLeft: `3px solid ${isActive ? T.blue500 : 'transparent'}`,
                      background: isActive ? '#EEF4FF' : 'transparent',
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center"
                      style={{
                        background: isActive ? T.blue500 : T.grey300,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {(req.evaluateeName ?? req.evaluateeId).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                        {req.evaluateeName ?? req.evaluateeId.slice(0, 8)}
                      </span>
                      <span className="block" style={{ fontSize: 11, color: T.grey500 }}>
                        {new Date(req.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 제출
                      </span>
                    </span>
                    <RebaselineStatusBadge status={req.status} size="sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 우: 상세 패널 */}
        <div style={{ border: `1px solid ${T.grey200}` }}>
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: T.grey50, borderBottom: `1px solid ${T.grey200}` }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>검토 상세</span>
              {activeReq && (
                <span style={{ fontSize: 12, color: T.grey500 }}>
                  · {activeReq.evaluateeName ?? activeReq.evaluateeId.slice(0, 8)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={reloadAll}
              style={{ fontSize: 11.5, color: T.grey400 }}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {!activeReq ? (
            <div className="p-8 text-center" style={{ fontSize: 13, color: T.grey500 }}>
              좌측에서 요청을 선택하세요.
            </div>
          ) : detailLoading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : detail ? (
            <ReviewDetailPanel
              req={activeReq}
              detail={detail}
              readOnly={readOnly}
              cycleId={cycleId}
              onApprove={() => openModal('approve')}
              onReject={() => openModal('reject')}
            />
          ) : null}
        </div>
      </div>

      {/* 승인/반려 모달 — kpi/review 패턴과 동일 */}
      <Modal
        open={acting !== null}
        onClose={closeModal}
        title={acting?.mode === 'approve' ? '승인할까요?' : '반려할까요?'}
        size="sm"
        primaryAction={{
          label: acting?.mode === 'approve' ? '승인·반영' : '반려',
          variant: acting?.mode === 'reject' ? 'danger' : undefined,
          loading: submitting,
          disabled: submitting,
          onClick: () => void handleReview(),
        }}
        secondaryAction={{ label: '취소', onClick: closeModal }}
      >
        <div className="space-y-3">
          {acting?.mode === 'approve' ? (
            <p style={{ fontSize: 13, color: T.grey700 }}>
              승인하면 KPI에 즉시 반영되고, 변경 전 값이 스냅샷으로 보관돼요.
              승인 후에는 취소할 수 없어요.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: T.grey700 }}>
              반려하면 구성원에게 반려 사유가 전달되고, 구성원이 수정 후 재제출할 수 있어요.
            </p>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
            placeholder={
              acting?.mode === 'approve'
                ? '승인 의견 (선택사항)'
                : '반려 사유를 입력해 주세요. (선택사항)'
            }
            className="w-full resize-none outline-none"
            style={{
              border: `1px solid ${T.grey200}`,
              padding: '10px 12px',
              fontSize: 12.5,
              color: T.grey700,
              minHeight: 80,
            }}
          />
        </div>
      </Modal>
    </Card>
  );
}

// ── 검토 상세 패널 ──
function ReviewDetailPanel({
  req,
  detail,
  readOnly,
  cycleId,
  onApprove,
  onReject,
}: {
  req: RebaselineRequestView;
  detail: RebaselineRequestDetail;
  readOnly: boolean;
  cycleId: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  // RebaselineTable readOnly 용 rows 조립 (currentKpis + items 기반).
  const rows: RebaselineRow[] = detail.currentKpis.map((k): RebaselineRow => {
    const item = detail.items.find((i) => i.kpiId === k.id);
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

  const qualWeight = detail.currentKpis
    .filter((k) => k.isQualitative)
    .reduce((s, k) => {
      const item = detail.items.find((i) => i.kpiId === k.id);
      return s + (item?.weight ?? k.weight);
    }, 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 가중치 검증 경고 */}
      {!detail.weightValid && (
        <div
          className="flex items-center gap-2 p-3"
          style={{ background: '#FEF9C3', border: `1px solid #FDE047` }}
        >
          <AlertTriangle size={14} style={{ color: '#A16207' }} />
          <span style={{ fontSize: 12.5, color: '#713F12', fontWeight: 600 }}>
            제안 가중치 합이 {detail.projectedWeightSum}%예요 — 100%가 아니면 승인할 수 없어요.
          </span>
        </div>
      )}

      {/* 사유 */}
      <div style={{ fontSize: 12.5, color: T.grey700 }}>
        <span style={{ fontWeight: 700, color: T.grey900 }}>재조정 사유:</span>{' '}
        <span style={{ whiteSpace: 'pre-wrap' }}>{detail.reason}</span>
      </div>

      {/* 가중치 요약 */}
      <WeightSummaryBar
        totalWeight={detail.projectedWeightSum}
        qualitativeWeight={qualWeight}
        compact
      />

      {/* 현재 vs 제안 diff 표 (readOnly) */}
      <RebaselineTable rows={rows} onChange={() => {}} readOnly />

      {/* 승인/반려 버튼 */}
      {!readOnly && req.status === 'submitted' && (
        <div
          className="flex justify-end gap-2 pt-3"
          style={{ borderTop: `1px dashed ${T.grey200}` }}
        >
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1.5 px-4 py-2 text-white"
            style={{ fontSize: 12.5, fontWeight: 600, background: T.red500 }}
          >
            <X size={13} /> 반려
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!detail.weightValid}
            className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
            style={{ fontSize: 12.5, fontWeight: 600, background: T.blue500 }}
            title={!detail.weightValid ? `가중치 합이 ${detail.projectedWeightSum}%예요. 100%여야 승인할 수 있어요.` : undefined}
          >
            <Check size={13} /> 승인·반영
          </button>
        </div>
      )}

      {/* 변경 이력(승인분) */}
      <RebaselineHistory
        cycleId={cycleId}
        userId={detail.evaluateeId}
      />
    </div>
  );
}
