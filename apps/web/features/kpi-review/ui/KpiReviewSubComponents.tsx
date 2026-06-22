'use client';

/**
 * KpiReview 서브 컴포넌트 — 200줄 상한으로 KpiReviewView.tsx에서 분리.
 * CheckText / ReviewHistory / KpiCard / ReviewSkeleton / BatchConfirmModal 포함.
 */

import { Check, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { Collapsible } from '@/components/Collapsible';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/textarea';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeLabel, measureTypeUnit } from '@/lib/ui';
import { categoryChip } from '@/lib/palette';
import type { Kpi, KpiReview, GradingScaleEntry } from '@/lib/types';

type GradingScales = { amount: GradingScaleEntry[]; rate: GradingScaleEntry[] };

function KpiDetailRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`border-t border-border/70 py-3 first:border-t-0 first:pt-0 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="mb-1 text-[11px] font-bold text-muted-foreground">{label}</div>
      <div className="text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap break-keep">
        {value}
      </div>
    </div>
  );
}

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
              className={`px-3 py-2 rounded-none border ${isImprovement ? 'bg-warning-50 border-warning-200' : 'bg-info-50 border-info-200'}`}
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
  index: number;
  kpi: Kpi;
  reviews: KpiReview[];
  scales?: GradingScales;
  busyId: string | null;
  batchBusy: boolean;
  canApprove: boolean;
  /** 현재 카드의 펼침 여부 (제어 컴포넌트). */
  collapsed: boolean;
  /** 헤더 클릭 시 펼침/접힘 토글. */
  onToggle: () => void;
  onApprove: (k: Kpi) => void;
  onConfirm: (k: Kpi) => void;
  onOpenReject: (kpiId: string, mode: 'reject' | 'revision') => void;
}

export function KpiCard({
  index,
  kpi: k,
  reviews: kpiReviews,
  scales,
  busyId,
  batchBusy,
  canApprove,
  collapsed,
  onToggle,
  onApprove,
  onConfirm,
  onOpenReject,
}: KpiCardProps) {
  const cc = categoryChip[k.category] ?? categoryChip.orders;
  const isBusy = busyId === k.id;
  const targetLabel = k.targetText?.trim()
    ? k.targetText
    : k.targetValue !== null
      ? `${k.targetValue.toLocaleString('ko-KR')}${measureTypeUnit[k.measureType]}`
      : null;
  const hasInfo = !!targetLabel || !!k.coreStrategy || !!k.csf || !!k.measureMethod;
  const rejectReason = k.status === 'draft' ? k.rejectReason : null;
  const hasReviewHistory = kpiReviews.length > 0 || !!rejectReason;
  const canAct = canApprove && (k.status === 'submitted' || k.status === 'approved');

  // 검토자는 접힌 상태에서도 성과의 핵심 문맥을 읽을 수 있어야 한다.
  const collapsibleHeader = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex h-5 min-w-5 items-center justify-center border border-border bg-foreground px-1 text-[10px] font-bold tabular-nums text-background">
          {index}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
          style={{ background: cc.bg, color: cc.color }}
        >
          {kpiCategoryLabel[k.category]}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
          {kpiGroupLabel[k.group]}
        </span>
        <span className="rounded bg-primary/[0.08] px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
          {k.isQualitative ? '정성' : '정량'}
        </span>
        <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
          {measureTypeLabel[k.measureType]}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="tabular-nums rounded bg-primary/[0.07] px-2 py-0.5 text-[11.5px] font-bold text-primary">
            {k.weight}%
          </span>
          <StatusBadge status={k.status} />
        </div>
      </div>
      <div className="text-[15.5px] font-bold leading-snug text-foreground break-keep">
        {k.title}
      </div>
      {(k.coreStrategy || k.csf || targetLabel) && (
        <div className="grid grid-cols-1 gap-1.5 text-[12px] leading-relaxed text-muted-foreground md:grid-cols-3">
          {k.coreStrategy && (
            <div className="min-w-0">
              <span className="font-bold text-foreground">전략</span>
              <span className="mx-1 text-border">|</span>
              <span className="break-keep">{k.coreStrategy}</span>
            </div>
          )}
          {k.csf && (
            <div className="min-w-0">
              <span className="font-bold text-foreground">CSF</span>
              <span className="mx-1 text-border">|</span>
              <span className="break-keep">{k.csf}</span>
            </div>
          )}
          {targetLabel && (
            <div className="min-w-0">
              <span className="font-bold text-foreground">목표</span>
              <span className="mx-1 text-border">|</span>
              <span className="break-keep">{targetLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Collapsible
      open={!collapsed}
      onToggle={onToggle}
      header={collapsibleHeader}
      headerClassName="px-4 py-4 bg-card hover:bg-accent/40"
      bodyClassName="p-0"
      className={[
        'rounded-none border-[#d1cbc4] border-l-4',
        collapsed ? 'border-l-[#9a948e]' : 'border-l-primary',
      ].join(' ')}
    >
      {/* 성과 내용 */}
      {hasInfo && (
        <div className="border-t border-border bg-card px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 bg-primary" aria-hidden />
            <div className="text-[12px] font-bold text-foreground">성과 내용</div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
            <KpiDetailRow label="핵심전략" value={k.coreStrategy} />
            <KpiDetailRow label="CSF" value={k.csf} />
            <KpiDetailRow label="목표" value={targetLabel} wide />
            <KpiDetailRow label="측정 방식" value={k.measureMethod} wide />
          </div>
        </div>
      )}

      {/* 등급 기준 */}
      <div className="border-t border-border bg-[#faf9f7] px-5 py-4">
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
    </Collapsible>
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
