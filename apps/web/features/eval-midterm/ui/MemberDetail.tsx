'use client';

// 선택 구성원 상세 패널 — KPI 문항별 [수락/재조정] 판정 → 승인/재조정 요청(2026-07-02 재구성).
// 전 KPI 수락 → confirm, 하나라도 재조정 → request-revision(구성원이 목표 재조정 신청 후 재제출).
// 승인 완료 상태에서도 재조정 요청으로 되돌릴 수 있다(confirmed→revision_requested).
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMidtermProgress, midtermReviewCommands } from '../hooks';
import { EvaluationDetailHeader } from '@/components/EvaluationDetailHeader';
import { Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { fmtPercent } from '@/lib/ui';
import { ReviewSplitPanel } from './ReviewSplitPanel';
import type { Evaluation, MidtermReview, MidtermKpiReviewItem } from '@/lib/types';

export function MemberDetail({
  cycleId,
  evaluatee,
  review,
  readOnly,
  onConfirmed,
}: {
  cycleId: string;
  evaluatee: Evaluation;
  review: MidtermReview | null;
  readOnly: boolean;
  onConfirmed: () => void;
}) {
  const toast = useToast();
  const evaluateeId = evaluatee.evaluateeId;
  const { data: progress, loading: progLoading } = useMidtermProgress({
    cycleId,
    userId: evaluateeId,
  });

  const [saving, setSaving] = useState(false);

  const kpis = progress?.kpis ?? [];
  const kpiProgressPct = kpis.length > 0
    ? Math.round((kpis.filter((k) => !k.isQualitative ? (k.cumulativeRate ?? 0) >= 100 : k.currentGrade != null).length / kpis.length) * 100)
    : null;

  // 전 KPI 수락 → 승인(confirm). KPI별 판정·피드백을 함께 저장.
  async function handleConfirm(note: string, kpiReviews: MidtermKpiReviewItem[]) {
    if (!review || review.status !== 'self_done') {
      toast.show({ variant: 'danger', message: '자가점검 제출 상태에서만 승인할 수 있어요.' });
      return;
    }
    setSaving(true);
    try {
      await midtermReviewCommands.confirm(review.id, { reviewerNote: note, kpiReviews });
      toast.show({ variant: 'success', message: '중간 점검을 승인했어요.' });
      onConfirmed();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '승인 처리에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  // 재조정 요청(revision_requested) — self_done|confirmed 에서 가능.
  // 구성원이 목표 재조정을 신청하고 자가점검을 보완해 재제출하는 흐름.
  async function handleRequestRevision(note: string, kpiReviews: MidtermKpiReviewItem[]) {
    if (!review || (review.status !== 'self_done' && review.status !== 'confirmed')) {
      toast.show({ variant: 'danger', message: '자가점검 제출 또는 승인 완료 상태에서만 재조정을 요청할 수 있어요.' });
      return;
    }
    setSaving(true);
    try {
      await midtermReviewCommands.requestRevision(review.id, { reviewerNote: note, kpiReviews });
      toast.show({ variant: 'success', message: '재조정을 요청했어요. 구성원이 보완 후 재제출해요.' });
      onConfirmed();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  const name = evaluatee.userName ?? evaluateeId.slice(0, 8);

  return (
    <div className="flex flex-col gap-0">
      <EvaluationDetailHeader
        name={name}
        description={evaluatee.departmentName ?? null}
        metric={kpiProgressPct !== null ? { label: 'KPI 진행률', value: fmtPercent(kpiProgressPct) } : undefined}
        status={
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">자가점검</span>
            {(!review || review.status === 'pending') ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F4F5FA', color: '#6B6980' }}>
                미제출
              </span>
            ) : review.status === 'self_done' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>
                진행중
              </span>
            ) : review.status === 'revision_requested' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FEF3E2', color: '#B45309' }}>
                재조정 요청
              </span>
            ) : review.status === 'rejected' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FDEBEB', color: '#B91C1C' }}>
                반려
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>
                <CheckCircle2 size={11} />승인 완료
              </span>
            )}
          </span>
        }
        className="mb-3"
      />

      {/* ── 단일 흐름: KPI별 [정보+자기점검+수락/재조정] 카드 → 종합 의견·승인/재조정 요청 ── */}
      <div className="mt-4 flex flex-col gap-5">
        {progLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ReviewSplitPanel
            kpis={kpis}
            review={review}
            readOnly={readOnly}
            busy={saving}
            onConfirm={(note, kpiReviews) => void handleConfirm(note, kpiReviews)}
            onRequestRevision={(note, kpiReviews) => void handleRequestRevision(note, kpiReviews)}
          />
        )}
      </div>
    </div>
  );
}
