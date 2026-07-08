'use client';

// 우측 상세 패널 — 2026-07-02 목업 정렬: 단일 카드 안에
// [신청자 헤더 → 진행 스테퍼 → 신청/부서장답변/HR검토 행 → 첨부파일 → 답변 작성/최종 결정] 섹션.
import { CalendarDays, FileText, MessageSquare, Search, ShieldQuestion, UserRound } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/Button';
import type { Appeal, DecideAppealBody } from '../hooks';
import { AppealStepper } from './AppealStepper';
import { AppealDecisionForm, DECISION_TYPES } from './AppealDecisionForm';
import { AppealAttachmentsCard } from './AppealAttachmentsCard';
import { AppealStatusBadge } from './AppealListPanel';

// 'YYYY.MM.DD HH:MM' — 목업과 동일한 일시 표기.
export function fmtDateTime(iso: string): string {
  return `${iso.slice(0, 10).replaceAll('-', '.')} ${iso.slice(11, 16)}`;
}

interface Props {
  appeal: Appeal;
  isLeaderOrHr: boolean;
  isHr: boolean;
  /** 신청자 본인 여부 — 첨부 업로드 권한(본인 또는 HR). */
  isOwner: boolean;
  responseDraft: string;
  onResponseDraftChange: (v: string) => void;
  busy: boolean;
  onRespond: () => void;
  onDecide: (body: DecideAppealBody) => void;
}

export function AppealDetailPanel({
  appeal,
  isLeaderOrHr,
  isHr,
  isOwner,
  responseDraft,
  onResponseDraftChange,
  busy,
  onRespond,
  onDecide,
}: Props) {
  const name = appeal.userName ?? appeal.userId.slice(0, 8);
  const handler =
    appeal.status === 'closed'
      ? appeal.decidedByName ?? 'HR'
      : appeal.respondedByName ?? (appeal.respondedById ? '부서장' : '배정 대기');

  return (
    <div className="self-start overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* ── 신청자 헤더 ── */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar name={name} photoUrl={appeal.avatarUrl} size="md" />
          <span className="text-[16px] font-bold text-foreground">{name}</span>
          {appeal.departmentName && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
              {appeal.departmentName}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 rounded-md border border-border bg-muted/30">
          <HeaderInfo icon={CalendarDays} label="신청일">
            <span className="tabular-nums">{appeal.createdAt.slice(0, 10).replaceAll('-', '.')}</span>
          </HeaderInfo>
          <HeaderInfo icon={ShieldQuestion} label="현재 상태">
            <AppealStatusBadge appeal={appeal} />
          </HeaderInfo>
          <HeaderInfo icon={UserRound} label="처리 담당자">
            {handler}
          </HeaderInfo>
        </div>
      </div>

      {/* ── 진행 스테퍼 ── */}
      <div className="border-t border-border px-5 py-4">
        <AppealStepper appeal={appeal} />
      </div>

      {/* ── 처리 내용 ── */}
      <div className="divide-y divide-border/60 border-t border-border">
        <ContentRow icon={FileText} label="신청 내용" tone="primary" author={`${name} (신청자)`} date={appeal.createdAt}>
          {appeal.reason}
        </ContentRow>

        {appeal.response ? (
          <ContentRow
            icon={MessageSquare}
            label="부서장 답변"
            tone="warning"
            author={appeal.respondedByName ? `${appeal.respondedByName} (부서장)` : '부서장'}
            date={appeal.respondedAt ?? appeal.updatedAt}
          >
            {appeal.response}
          </ContentRow>
        ) : (
          <EmptyContentRow label="부서장 답변" />
        )}

        {appeal.decision ? (
          <ContentRow
            icon={Search}
            label={`HR 검토${appeal.decisionType ? ` — ${DECISION_TYPES.find((t) => t.value === appeal.decisionType)?.label ?? ''}` : ''}`}
            tone="success"
            author={appeal.decidedByName ? `${appeal.decidedByName} (HR)` : 'HR'}
            date={appeal.decidedAt ?? appeal.updatedAt}
          >
            {[
              appeal.decision,
              appeal.newScore != null ? `수정 점수: ${appeal.newScore}점` : null,
              appeal.newGrade ? `수정 등급: ${appeal.newGrade}` : null,
            ]
              .filter(Boolean)
              .join('\n')}
          </ContentRow>
        ) : appeal.status !== 'closed' ? (
          <EmptyContentRow label="HR 검토" />
        ) : null}
      </div>

      {/* ── 첨부파일 — 계약서·실적자료·증빙 ── */}
      <div className="border-t border-border p-5">
        <AppealAttachmentsCard appealId={appeal.id} canUpload={isOwner || isHr} />
      </div>

      {/* ── 부서장 답변 작성 ── */}
      {isLeaderOrHr && (appeal.status === 'submitted' || appeal.status === 'under_review') && (
        <div className="space-y-3 border-t border-border p-5">
          <div className="text-[13px] font-bold text-foreground">부서장 답변 작성</div>
          <Textarea
            value={responseDraft}
            onChange={(e) => onResponseDraftChange(e.target.value)}
            placeholder="이의제기에 대한 처리 의견을 입력하세요."
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={!responseDraft.trim() || busy}
              loading={busy}
              onClick={onRespond}
            >
              답변 등록
            </Button>
          </div>
        </div>
      )}

      {/* ── HR 최종 결정 ── */}
      {isHr && appeal.status === 'answered' && <AppealDecisionForm busy={busy} onSubmit={onDecide} />}
    </div>
  );
}

function HeaderInfo({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

type Tone = 'primary' | 'warning' | 'success';
const TONE_BOX: Record<Tone, { bg: string; color: string }> = {
  primary: { bg: '#EAF2FE', color: '#0257CE' },
  warning: { bg: '#FEF0E4', color: '#C2410C' },
  success: { bg: '#E3F7EC', color: '#0B7A47' },
};

function ContentRow({
  icon: Icon,
  label,
  tone,
  author,
  date,
  children,
}: {
  icon: typeof FileText;
  label: string;
  tone: Tone;
  author?: string;
  date: string;
  children: string;
}) {
  const t = TONE_BOX[tone];
  return (
    <div className="flex gap-3.5 px-5 py-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
        style={{ background: t.bg, color: t.color }}
      >
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-bold text-foreground">{label}</span>
          <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
            {author && <span className="block">{author}</span>}
            <span className="tabular-nums">{fmtDateTime(date)}</span>
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">{children}</p>
      </div>
    </div>
  );
}

function EmptyContentRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
        <MessageSquare size={16} aria-hidden />
      </span>
      <div>
        <div className="text-[12.5px] font-semibold text-muted-foreground">{label}</div>
        <p className="text-[12px] text-muted-foreground">아직 등록되지 않았어요.</p>
      </div>
    </div>
  );
}
