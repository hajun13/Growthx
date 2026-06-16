'use client';

/**
 * KpiReview 서브 컴포넌트 — 200줄 상한으로 KpiReviewView.tsx에서 분리.
 * CheckText / ReviewHistory / KpiCard / ReviewSkeleton / BatchConfirmModal 포함.
 */

import { Check, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/textarea';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeUnit } from '@/lib/ui';
import { categoryChip } from '@/lib/toss';
import type { Kpi, KpiReview, GradingScaleEntry } from '@/lib/types';

type GradingScales = { amount: GradingScaleEntry[]; rate: GradingScaleEntry[] };

// ── CheckText ──────────────────────────────────────────────────────

export function CheckText({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${ok ? 'text-info-700' : 'text-muted-foreground'}`}>
      {ok
        ? <Check size={11} aria-hidden />
        : <span className="w-[11px] text-center text-[10px]" aria-hidden>·</span>}
      {children}
    </span>
  );
}

// ── ReviewHistory ──────────────────────────────────────────────────

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ReviewHistory({
  reviews,
  rejectReason,
}: {
  reviews: KpiReview[];
  rejectReason: string | null;
}) {
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground mb-2">
        <MessageSquare size={10} aria-hidden /> 검토 이력
      </div>
      <div className="space-y-1.5">
        {rejectReason && (
          <div className="px-3 py-2 rounded-md bg-danger-50 border border-danger-200">
            <div className="text-[11px] font-bold text-danger-700 mb-1">반려 사유</div>
            <div className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">{rejectReason}</div>
          </div>
        )}
        {reviews.map((r) => {
          const isImprovement = r.kind === 'improvement';
          return (
            <div
              key={r.id}
              className={`px-3 py-2 rounded-md border ${isImprovement ? 'bg-warning-50 border-warning-200' : 'bg-info-50 border-info-200'}`}
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className={`text-[11px] font-bold ${isImprovement ? 'text-warning-700' : 'text-info-700'}`}>
                  {isImprovement ? '보완 의견' : '승인 의견'}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {r.authorName}{r.authorPosition ? ` · ${r.authorPosition}` : ''}
                </span>
                <span className="ml-auto text-[10.5px] text-muted-foreground tabular-nums">{fmt(r.createdAt)}</span>
              </div>
              <div className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">{r.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KpiCard ────────────────────────────────────────────────────────

export interface KpiCardProps {
  kpi: Kpi;
  reviews: KpiReview[];
  scales?: GradingScales;
  busyId: string | null;
  batchBusy: boolean;
  canApprove: boolean;
  onApprove: (k: Kpi) => void;
  onConfirm: (k: Kpi) => void;
  onOpenReject: (kpiId: string, mode: 'reject' | 'revision') => void;
}

export function KpiCard({
  kpi: k,
  reviews: kpiReviews,
  scales,
  busyId,
  batchBusy,
  canApprove,
  onApprove,
  onConfirm,
  onOpenReject,
}: KpiCardProps) {
  const cc = categoryChip[k.category] ?? categoryChip.orders;
  const isBusy = busyId === k.id;
  const hasTarget = k.targetText || k.targetValue !== null;
  const hasInfo = hasTarget || !!k.measureMethod;
  const rejectReason = k.status === 'draft' ? k.rejectReason : null;
  const hasReviewHistory = kpiReviews.length > 0 || !!rejectReason;
  const canAct = canApprove && (k.status === 'submitted' || k.status === 'approved');

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-elev-1">
      {/* 카드 헤더 */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span
            className="text-[10.5px] font-semibold rounded px-1.5 py-0.5"
            style={{ background: cc.bg, color: cc.color }}
          >
            {kpiCategoryLabel[k.category]}
          </span>
          <span className="text-[10.5px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            {kpiGroupLabel[k.group]}
          </span>
          <span className="text-[10.5px] font-semibold bg-primary/[0.08] text-primary rounded px-1.5 py-0.5">
            {k.isQualitative ? '정성' : '정량'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="tabular-nums text-[11.5px] font-bold text-primary bg-primary/[0.07] rounded px-2 py-0.5">
              {k.weight}%
            </span>
            <StatusBadge status={k.status} />
          </div>
        </div>
        <div className="text-[14px] font-bold text-foreground leading-snug">{k.title}</div>
      </div>

      {/* 목표 · 측정방식 */}
      {hasInfo && (
        <div className="border-t border-border px-4 py-2 bg-muted">
          <dl className="grid gap-x-2.5 gap-y-0.5 m-0" style={{ gridTemplateColumns: '32px 1fr' }}>
            {hasTarget && (
              <>
                <dt className="text-[10.5px] font-bold text-muted-foreground pt-0.5 m-0">목표</dt>
                <dd className="text-[12.5px] text-foreground m-0 leading-relaxed">
                  {k.targetText ?? `${k.targetValue}${measureTypeUnit[k.measureType]}`}
                </dd>
              </>
            )}
            {k.measureMethod && (
              <>
                <dt className="text-[10.5px] font-bold text-muted-foreground pt-0.5 m-0">측정</dt>
                <dd className="text-[12.5px] text-foreground m-0 leading-relaxed">{k.measureMethod}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* 등급 기준 */}
      <div className="border-t border-border px-4 py-2">
        <KpiGradingDisplay kpi={k} scales={scales} />
      </div>

      {/* 검토 이력 */}
      {hasReviewHistory && (
        <ReviewHistory reviews={kpiReviews} rejectReason={rejectReason} />
      )}

      {/* 액션 바 */}
      {canAct && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-muted">
          {k.status === 'submitted' ? (
            <>
              <Button
                variant="danger"
                size="sm"
                disabled={busyId !== null || batchBusy}
                leftIcon={<X size={12} aria-hidden />}
                onClick={() => onOpenReject(k.id, 'reject')}
              >
                반려
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId !== null || batchBusy}
                leftIcon={<MessageSquare size={12} aria-hidden />}
                onClick={() => onOpenReject(k.id, 'revision')}
              >
                수정요청
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busyId !== null || batchBusy}
                loading={isBusy}
                leftIcon={<Check size={12} aria-hidden />}
                className="ml-auto"
                onClick={() => onApprove(k)}
              >
                승인
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={busyId !== null || batchBusy}
              loading={isBusy}
              leftIcon={<Check size={12} aria-hidden />}
              className="ml-auto"
              onClick={() => onConfirm(k)}
            >
              확정
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── RejectModal ────────────────────────────────────────────────────

export interface RejectModalProps {
  open: boolean;
  mode: 'reject' | 'revision' | null;
  reason: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function RejectModal({
  open,
  mode,
  reason,
  busy,
  onChange,
  onSubmit,
  onClose,
}: RejectModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'reject' ? '반려할까요?' : '수정요청할까요?'}
      primaryAction={{
        label: mode === 'reject' ? '반려' : '수정요청',
        variant: 'danger',
        loading: busy,
        disabled: reason.trim().length === 0,
        onClick: onSubmit,
      }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          {mode === 'reject'
            ? '반려하면 사유가 작성자에게 전달되고 해당 문항은 작성중으로 돌아가요.'
            : '수정요청하면 사유가 전달되고 작성자가 수정 후 재제출해야 해요.'}
        </p>
        <Textarea
          value={reason}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          placeholder={mode === 'reject' ? '반려 사유를 작성해 주세요.' : '수정 요청 사항을 작성해 주세요.'}
          rows={3}
        />
        {reason.trim().length === 0 && (
          <p className="text-[11px] text-danger-600">사유를 입력해야 처리할 수 있어요.</p>
        )}
      </div>
    </Modal>
  );
}

// ── ReviewSkeleton ─────────────────────────────────────────────────

export function ReviewSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
