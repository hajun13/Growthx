'use client';

/**
 * KpiReview 서브 컴포넌트 — 200줄 상한으로 KpiReviewView.tsx에서 분리.
 * CheckText / ReviewHistory / KpiCard / ReviewSkeleton 포함.
 */

import { Check, ChevronDown, MessageSquare } from 'lucide-react';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/ui/textarea';
import { kpiCategoryLabel, measureTypeUnit } from '@/lib/ui';
import { categoryChip } from '@/lib/palette';
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

/** '[수정요청] 사유' 형태의 rejectReason 을 분해 — 프리픽스는 제목으로 승격하고 원문 노출을 막는다. */
export function parseRejectReason(raw: string): { isRevision: boolean; text: string } {
  const isRevision = raw.startsWith('[수정요청]');
  return { isRevision, text: isRevision ? raw.slice('[수정요청]'.length).trim() : raw };
}

export function ReviewHistory({
  reviews,
  rejectReason,
}: {
  reviews: KpiReview[];
  rejectReason: string | null;
}) {
  const parsed = rejectReason ? parseRejectReason(rejectReason) : null;
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-1 text-[10.5px] font-bold text-muted-foreground mb-2">
        <MessageSquare size={10} aria-hidden /> 검토 이력
      </div>
      <div className="space-y-1.5">
        {parsed && (
          <div
            className={`px-3 py-2 rounded-md border ${parsed.isRevision ? 'bg-warning-50 border-warning-200' : 'bg-danger-50 border-danger-200'}`}
          >
            <div className={`text-[11px] font-bold mb-1 ${parsed.isRevision ? 'text-warning-700' : 'text-danger-700'}`}>
              {parsed.isRevision ? '수정요청' : '반려 사유'}
            </div>
            <div className="text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">{parsed.text}</div>
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

/** 순차 결재선에서 이 KPI·현재 사용자에 대한 단계 정보(KpiReviewView.stageInfoFor). */
export interface KpiStageInfo {
  /** 결재선 총 단계 수(0=결재선 없음 → HR 결재). */
  total: number;
  /** 완료된 결재 단계 수(=다음 대기 단계 인덱스). */
  current: number;
  /** 지금 내가 승인할 차례인가 — 액션 버튼은 이때만 노출. */
  myTurn: boolean;
  /** 내 단계는 이미 승인 완료(상위 단계 진행 중). */
  myDone: boolean;
  /** 다음 결재자 이름(진행 중일 때만). */
  nextName: string | null;
  /** 이번 승인이 마지막 단계(=확정)인가. */
  finalStep: boolean;
}

export interface KpiCardProps {
  index: number;
  kpi: Kpi;
  reviews: KpiReview[];
  scales?: GradingScales;
  busyId: string | null;
  stage: KpiStageInfo;
  /** 현재 카드의 펼침 여부 (제어 컴포넌트). */
  collapsed: boolean;
  /** 헤더 클릭 시 펼침/접힘 토글. */
  onToggle: () => void;
  onApprove: (k: Kpi) => void;
  onOpenReject: (kpiId: string, mode: 'reject' | 'revision') => void;
}

// 시안(image 5) 표형 행 그리드 — KpiReviewView 의 컬럼 헤더와 동일해야 한다.
// 마지막 검토 열은 고정폭(236px): auto 로 두면 행마다 버튼 폭이 달라 가중치 열이 밀린다.
// "측정 방식" 별도 열은 제거(제목 셀 내 "측정" 줄과 중복) — 1366px 폭에서 제목 열이 0에 수렴하던 문제 해소.
export const KPI_ROW_GRID = 'grid items-center gap-4 grid-cols-[44px_minmax(0,1fr)_72px_236px]';

export function KpiCard({
  index,
  kpi: k,
  reviews: kpiReviews,
  scales,
  busyId,
  stage,
  collapsed,
  onToggle,
  onApprove,
  onOpenReject,
}: KpiCardProps) {
  const cc = categoryChip[k.category] ?? categoryChip.orders;
  const isBusy = busyId === k.id;
  const targetLabel = k.targetText?.trim()
    ? k.targetText
    : k.targetValue !== null
      ? `${k.targetValue.toLocaleString('ko-KR')}${measureTypeUnit[k.measureType]}`
      : null;
  const rejectReason = k.status === 'draft' ? k.rejectReason : null;
  const hasReviewHistory = kpiReviews.length > 0 || !!rejectReason;
  const inProgress = k.status === 'submitted' || k.status === 'approved';
  const approveLabel = stage.finalStep ? '최종 승인' : `${stage.current + 1}차 승인`;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* 행 전체 클릭 → 등급 부여 기준 펼침/접힘 (시안 image 5) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className={`${KPI_ROW_GRID} w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-accent/40`}
      >
        {/* No. — 그레이 사각 배지 */}
        <span className="inline-flex h-7 w-9 items-center justify-center rounded-sm bg-muted text-[12px] font-bold tabular-nums text-muted-foreground">
          {String(index).padStart(2, '0')}
        </span>

        {/* KPI 항목 — 좌측 칩 스택(정량 위 · 카테고리 아래) + 제목 / 목표 / 측정 */}
        <div className="flex min-w-0 items-start gap-2.5">
          {/* 칩 컬럼 고정 폭 — 가장 긴 카테고리(수주&업무수행) 기준. 가변 폭이면 카드마다 제목·목표·측정 시작점이 어긋난다. */}
          <div className="flex w-[86px] shrink-0 flex-col items-start gap-1 pt-0.5">
            <span className="rounded bg-primary/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {k.isQualitative ? '정성' : '정량'}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ background: cc.bg, color: cc.color }}
            >
              {kpiCategoryLabel[k.category]}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[14px] font-bold leading-snug text-foreground break-keep">{k.title}</p>
            {targetLabel && (
              <p className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">목표</span>
                <span className="truncate">{targetLabel}</span>
              </p>
            )}
            {k.measureMethod && (
              <p className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">측정</span>
                <span className="truncate">{k.measureMethod}</span>
              </p>
            )}
          </div>
        </div>

        {/* 가중치 — 숫자만 */}
        <span className="tabular-nums text-[15px] font-bold text-foreground">{k.weight}%</span>

        {/* 검토 — 순차 결재선: 액션(반려·수정요청·승인)은 **내 차례에만**.
            내 차례가 아니면 대기/완료 상태 칩만 표시(앞 단계 미완 건에 버튼 노출 금지 — 사용자 피드백). */}
        <div className="flex shrink-0 items-center justify-end gap-1.5" onClick={stop}>
          {stage.myTurn ? (
            <>
              <Button variant="secondary" size="sm" disabled={busyId !== null} onClick={() => onOpenReject(k.id, 'reject')}>
                반려
              </Button>
              <Button variant="secondary" size="sm" disabled={busyId !== null} onClick={() => onOpenReject(k.id, 'revision')}>
                수정요청
              </Button>
              <Button variant="primary" size="sm" disabled={busyId !== null} loading={isBusy} onClick={() => onApprove(k)}>
                {approveLabel}
              </Button>
            </>
          ) : inProgress && stage.total > 0 ? (
            <span
              className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold tabular-nums ${
                stage.myDone ? 'bg-info-50 text-info-700' : 'bg-muted text-muted-foreground'
              }`}
              title={stage.nextName ? `다음 결재: ${stage.nextName}` : undefined}
            >
              {stage.myDone
                ? `내 승인 완료 · ${stage.current}/${stage.total}`
                : `${stage.current + 1}차 결재 대기${stage.nextName ? ` · ${stage.nextName}` : ''}`}
            </span>
          ) : (
            <StatusBadge status={k.status} domain="kpi" />
          )}
          <button
            type="button"
            aria-label={collapsed ? '등급 부여 기준 펼치기' : '등급 부여 기준 접기'}
            onClick={onToggle}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* 펼침 영역 — 등급 부여 기준 + CSF + 검토 이력 */}
      {!collapsed && (
        <div className="border-t border-border">
          {k.csf && (
            <p className="bg-muted/60 px-5 pt-3 text-[12px] text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">CSF(전략목표)</span>
              {k.csf}
            </p>
          )}
          <div className="bg-muted/60 px-5 pt-3 pb-4">
            <KpiGradingDisplay kpi={k} scales={scales} />
          </div>
          {Array.isArray(k.approvalTrail) && k.approvalTrail.length > 0 && (
            <p className="border-t border-border px-5 py-2.5 text-[11.5px] text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">결재 이력</span>
              {k.approvalTrail.map((t) => `${t.stage}차 ${t.approverName} (${fmt(t.at)})`).join(' → ')}
              {k.status !== 'confirmed' && stage.nextName ? ` → 다음: ${stage.nextName}` : ''}
            </p>
          )}
          {hasReviewHistory && (
            <ReviewHistory reviews={kpiReviews} rejectReason={rejectReason} />
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
        // Modal.primaryAction.variant 는 'primary' | 'danger'만 허용(공용 컴포넌트, 수정 범위 밖).
        // 브리프 §4는 "보조 액션은 그레이"이나 이 모달은 확정 버튼 자체가 강조 액션이라 danger 유지 —
        // 리스트의 반려/수정요청 트리거 버튼(위 KpiCard)은 secondary로 이미 정리함. API 갭 문서에 기록.
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
      <div className="gx-master-detail">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageContainer>
  );
}
