'use client';

// 평가 주기 선택 바 — 주기 셀렉터 + 현재 상태 배지 + 단계 전환 버튼 + 새 주기 추가
import { ChevronsRight, Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { cycleStatusText, isCycleOngoing } from '@/lib/ui';
import type { EvaluationCycle, CycleStatus } from '@/lib/types';

interface Props {
  cycles: EvaluationCycle[];
  current: EvaluationCycle | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  creatingNew: boolean;
  onStartNew: () => void;
  nextStatus: CycleStatus | undefined;
  nextLabel: string | undefined;
  transitionBusy: boolean;
  onTransitionClick: () => void;
}

// 단계 전환 버튼 variant — 위험도별
function nextStatusVariant(status?: CycleStatus): 'danger' | 'secondary' {
  if (status === 'closed' || status === 'calibration') return 'danger';
  return 'secondary';
}

function currentStatusVariant(status: CycleStatus): 'success' | 'info' | 'neutral' {
  if (status === 'closed') return 'success';
  if (isCycleOngoing(status)) return 'info';
  return 'neutral';
}

export function CycleSelectorBar({
  cycles, current, selectedId, onSelect,
  creatingNew, onStartNew,
  nextStatus, nextLabel, transitionBusy, onTransitionClick,
}: Props) {
  if (cycles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 shadow-elev-1">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        평가 주기
      </span>

      <Select
        value={selectedId ?? ''}
        onValueChange={onSelect}
        disabled={creatingNew}
      >
        <SelectTrigger className={cn('w-[200px] text-[13px] font-semibold', creatingNew && 'opacity-50')}>
          <SelectValue placeholder="주기 선택" />
        </SelectTrigger>
        <SelectContent>
          {cycles.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 주기 상태 배지 */}
      {current && !creatingNew && (
        <Badge variant={currentStatusVariant(current.status)}>
          {cycleStatusText(current.status)}
        </Badge>
      )}

      {/* 단계 전환 버튼 */}
      {current && !creatingNew && nextStatus && nextLabel && (
        <Button
          variant={nextStatusVariant(nextStatus)}
          size="sm"
          leftIcon={<ChevronsRight size={14} />}
          loading={transitionBusy}
          disabled={transitionBusy}
          onClick={onTransitionClick}
        >
          {nextLabel}
        </Button>
      )}

      {!creatingNew ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={13} />}
          onClick={onStartNew}
        >
          새 평가 주기
        </Button>
      ) : (
        <Badge variant="default" className="ml-auto">
          새 평가 주기 작성 중
        </Badge>
      )}
    </div>
  );
}
