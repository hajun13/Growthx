'use client';

// 부서장 재조정 요청 — DeptHeadMidterm 에 섹션으로 통합.
// kpi/review 패턴(좌 목록·우 상세, 승인/반려 모달)을 그대로 차용.
// 계약: contract-midterm.md §7.
//  - GET /midterm/rebaseline-requests?forReview=true → 부서장 검토 큐.
//  - GET /midterm/rebaseline-requests/:id → 상세(proposedChanges·currentKpis·weightValid).
//  - PATCH /midterm/rebaseline-requests/:id/review { decision, comment } → 승인/반려.
import { useCallback, useMemo, useState } from 'react';
import { Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
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
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
import { ApiError } from '@/lib/api';
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
  const [queueSearch, setQueueSearch] = useState('');

  const filteredQueueItems = useMemo(() => {
    const keyword = queueSearch.trim();
    if (!keyword) return queueItems;
    return queueItems.filter((req) => {
      const name = req.evaluateeName ?? req.evaluateeId;
      return name.includes(keyword);
    });
  }, [queueItems, queueSearch]);

  const activeReq = useMemo(
    () => filteredQueueItems.find((r) => r.id === selectedId) ?? filteredQueueItems[0] ?? null,
    [filteredQueueItems, selectedId],
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

  const subjectItems = filteredQueueItems.map((req) => ({
    id: req.id,
    name: req.evaluateeName ?? req.evaluateeId.slice(0, 8),
    description: `${new Date(req.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 제출`,
    active: req.id === (activeReq?.id ?? null),
    accessory: <RebaselineStatusBadge status={req.status} size="sm" />,
    onSelect: () => setSelectedId(req.id),
  }));

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
      <Card>
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (queueItems.length === 0) {
    return (
      <Card title="재조정 검토 큐">
        <EmptyState
          title="검토 대기 중인 재조정 요청이 없어요."
          description="구성원이 목표 재조정을 요청하면 여기에 표시돼요."
        />
      </Card>
    );
  }

  return (
    <Card
      action={
        <span className="text-[12px] text-muted-foreground">
          검토 대기 <span className="font-semibold text-foreground">{queueItems.length}</span>건
        </span>
      }
    >
      <div className="gx-master-detail">
        <EvaluationSubjectPanel
          title="제안자"
          count={filteredQueueItems.length}
          countUnit="건"
          search={queueSearch}
          onSearch={setQueueSearch}
          searchPlaceholder="이름 검색"
          emptyMessage="검토할 요청이 없어요."
          items={subjectItems}
          maxHeightClassName="max-h-[560px]"
        />

        <div className="overflow-hidden border border-border bg-card">
          {activeReq && (
            <EvaluationDetailHeader
              name={activeReq.evaluateeName ?? activeReq.evaluateeId.slice(0, 8)}
              description="목표 재조정 요청"
              status={<RebaselineStatusBadge status={activeReq.status} size="sm" />}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reloadAll}
                  aria-label="새로고침"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw size={13} aria-hidden />
                </Button>
              }
              className="border-x-0 border-t-0"
            />
          )}

          {!activeReq ? (
            <div className="p-8 text-center text-[13px] text-muted-foreground">
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

      {/* 승인/반려 모달 */}
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
            <p className="text-[13px] text-muted-foreground">
              승인하면 KPI에 즉시 반영되고, 변경 전 값이 스냅샷으로 보관돼요.
              승인 후에는 취소할 수 없어요.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
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
            className="w-full resize-none rounded-none border border-border bg-muted px-[11px] py-[9px] text-[12.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            style={{ minHeight: 80 }}
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
    <div className="flex flex-col gap-3 p-4">
      {/* 가중치 검증 경고 */}
      {!detail.weightValid && (
        <div className="flex items-center gap-2 rounded-none border border-warning-100 bg-warning-50 px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 text-warning-700" aria-hidden />
          <span className="text-[12.5px] font-semibold text-warning-700">
            제안 가중치 합이 {detail.projectedWeightSum}%예요 — 100%가 아니면 승인할 수 없어요.
          </span>
        </div>
      )}

      {/* 재조정 사유 */}
      <div className="rounded-md bg-muted px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          재조정 사유
        </span>
        <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
          {detail.reason}
        </p>
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
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            variant="danger"
            size="sm"
            onClick={onReject}
            leftIcon={<X size={13} aria-hidden />}
          >
            반려
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onApprove}
            disabled={!detail.weightValid}
            title={
              !detail.weightValid
                ? `가중치 합이 ${detail.projectedWeightSum}%예요. 100%여야 승인할 수 있어요.`
                : undefined
            }
            leftIcon={<Check size={13} aria-hidden />}
          >
            승인·반영
          </Button>
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
