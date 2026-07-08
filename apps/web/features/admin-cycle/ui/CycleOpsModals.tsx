'use client';

// 평가 운영 확인 모달 5종 — 재오픈 사유 입력 / 부서장 재배정 / 단계 전환 / 주기 삭제 / KPI 스냅샷
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronsRight } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { DesignLabel } from '@/components/DesignLabel';
import { InfoBanner } from '@/components/InfoBanner';
import { Textarea } from '@/components/ui/textarea';
import { cycleStatusText } from '@/lib/ui';
import type { CycleStatus, EvaluationCycle } from '@/lib/types';

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface ReopenModalProps {
  open: boolean;
  phase: string | null;
  reason: string;
  busy: boolean;
  phaseLabel: (p: string) => string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

interface ReassignModalProps {
  open: boolean;
  busy: boolean;
  cycle: EvaluationCycle | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

interface TransitionModalProps {
  open: boolean;
  busy: boolean;
  current: EvaluationCycle | undefined;
  nextStatus: CycleStatus | undefined;
  nextLabel: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

interface DeleteModalProps {
  open: boolean;
  busy: boolean;
  cycle: EvaluationCycle | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

const TRANSITION_DESC: Partial<Record<CycleStatus, { body: string; tone?: 'warning' | 'danger' }>> = {
  active:      { body: '평가를 시작합니다(진행중). 구성원 KPI 작성·본인평가가 열립니다.' },
  mid_review:  { body: '중간 점검 단계를 엽니다. 진척 점검·자가평가·부서장 피드백·보완 조치·목표 재조정이 가능해집니다. (등급·연봉 미반영)' },
  calibration: { body: '최종 조정 단계입니다. 등급·보상 산정이 활성화됩니다. 신중히 진행하세요.', tone: 'warning' },
  closed:      { body: '평가를 마감합니다. 이후 단계 진행·되돌리기가 불가합니다.', tone: 'danger' },
};

function statusTone(status: CycleStatus): 'green' | 'blue' | 'amber' | 'gray' {
  if (status === 'closed') return 'green';
  if (status === 'calibration') return 'amber';
  if (status === 'mid_review') return 'blue';
  if (status === 'active') return 'blue';
  return 'gray';
}

// ── 재오픈 사유 모달 ──────────────────────────────────────────────────────────
export function ReopenModal({ open, phase, reason, busy, phaseLabel, onReasonChange, onConfirm, onClose }: ReopenModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={`${phase ? phaseLabel(phase) : ''} 단계를 다시 열까요?`}
      primaryAction={{ label: '다시 열기', onClick: onConfirm, loading: busy, disabled: reason.trim().length === 0 || busy }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          잠긴 단계를 다시 열면 해당 기간 동안 KPI 작성·수정이 허용돼요. 재오픈 사유는 감사 로그에 기록돼요.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="재오픈 사유를 입력해 주세요. (예: 중간평가 목표 조정 반영)"
          rows={3}
          className="resize-y"
        />
        {reason.trim().length === 0 && reason.length > 0 && (
          <p className="text-[11px] text-destructive">사유를 입력해 주세요.</p>
        )}
        <Link
          href="/eval/midterm"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
        >
          KPI 목표를 조정하려면 → 중간 점검(목표 재조정) 화면 <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    </Modal>
  );
}

// ── 부서장 재배정 확인 모달 ───────────────────────────────────────────────────
export function ReassignModal({ open, busy, cycle, onConfirm, onClose }: ReassignModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="부서장 평가를 재배정할까요?"
      primaryAction={{ label: '재배정', onClick: onConfirm, loading: busy, disabled: busy }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">{cycle?.name}</strong> 주기에서 아직 시작하지 않은 부서장 평가 배정을 초기화하고,{' '}
          <strong className="text-foreground">현재 팀장·본부장 권한</strong> 기준으로 다시 배정해요.
          팀장·소속을 바꾼 뒤에 사용하세요.
        </p>
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-600" aria-hidden />
          <p className="text-[12px] text-muted-foreground">
            이미 진행중이거나 제출·확정된 평가는 <strong className="text-foreground">그대로 보존</strong>돼요.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── 단계 전환 확인 모달 ───────────────────────────────────────────────────────
export function TransitionModal({ open, busy, current, nextStatus, nextLabel, onConfirm, onClose }: TransitionModalProps) {
  const desc = nextStatus ? TRANSITION_DESC[nextStatus] : undefined;
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={
        nextStatus === 'active' ? '평가를 시작할까요?'
        : nextStatus === 'mid_review' ? '중간 점검 단계를 열까요?'
        : nextStatus === 'calibration' ? '최종 조정 단계로 진행할까요?'
        : '평가를 마감할까요?'
      }
      primaryAction={{
        label: nextLabel ?? '전환',
        variant: (desc?.tone === 'danger' || desc?.tone === 'warning') ? 'danger' : 'primary',
        onClick: onConfirm,
        loading: busy,
        disabled: busy,
      }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">{desc?.body}</p>

        {/* 현재 → 다음 상태 시각화 */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-4 py-3">
          <span className="text-[11px] font-semibold text-muted-foreground">현재</span>
          {current && <DesignLabel tone={statusTone(current.status)}>{cycleStatusText(current.status)}</DesignLabel>}
          <ChevronsRight size={14} className="text-muted-foreground" aria-hidden />
          <span className="text-[11px] font-semibold text-muted-foreground">이후</span>
          {nextStatus && <DesignLabel tone={statusTone(nextStatus)}>{cycleStatusText(nextStatus)}</DesignLabel>}
        </div>

        {(desc?.tone === 'warning' || desc?.tone === 'danger') && (
          <InfoBanner tone={desc.tone === 'danger' ? 'warning' : 'warning'}>
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={14} aria-hidden /> 이 작업은 되돌릴 수 없어요.
            </span>
          </InfoBanner>
        )}
      </div>
    </Modal>
  );
}

// ── KPI 스냅샷 생성 확인 모달 ────────────────────────────────────────────────
interface SnapshotModalProps {
  open: boolean;
  busy: boolean;
  cycle: EvaluationCycle | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

export function SnapshotModal({ open, busy, cycle, onConfirm, onClose }: SnapshotModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="1차 KPI 스냅샷을 생성할까요?"
      primaryAction={{ label: '스냅샷 생성', onClick: onConfirm, loading: busy, disabled: busy }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">{cycle?.name}</strong> 주기의 현재 확정 KPI를 ‘1차 확정’
        스냅샷으로 고정해요. 이미 생성했다면 최신 상태로 다시 만들어져요. 반복 클릭할 필요는 없어요.
      </p>
    </Modal>
  );
}

// ── 주기 삭제 확인 모달 ───────────────────────────────────────────────────────
export function DeleteCycleModal({ open, busy, cycle, onConfirm, onClose }: DeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="평가 주기를 삭제할까요?"
      primaryAction={{ label: '삭제', variant: 'danger', onClick: onConfirm, loading: busy, disabled: busy }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">{cycle?.name}</strong> 주기와 이 주기에 속한 모든 데이터(일정·KPI·평가·결과·보상 등)가 영구 삭제돼요.
        </p>
        <InfoBanner tone="warning">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} aria-hidden /> 이 작업은 되돌릴 수 없어요.
          </span>
        </InfoBanner>
      </div>
    </Modal>
  );
}
