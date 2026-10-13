'use client';

// KPI 행 하단 판정 컨트롤 — 코멘트 한 줄 입력 + [수락|조정] 세그먼트(1차 검토·재조정 검토 공용).
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type KpiDecision = 'accepted' | 'rebaseline' | '';

export function DecisionControls({
  note,
  decision,
  onChange,
  placeholder,
  noteAriaLabel,
  rebaseLabel,
}: {
  note: string;
  decision: KpiDecision;
  onChange: (patch: { note?: string; decision?: 'accepted' | 'rebaseline' }) => void;
  placeholder: string;
  noteAriaLabel: string;
  rebaseLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
      <Input
        type="text"
        value={note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder={placeholder}
        aria-label={noteAriaLabel}
        className="h-8 min-w-0 flex-1 text-12h"
      />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={decision}
        onValueChange={(v) => {
          if (v === 'accepted' || v === 'rebaseline') onChange({ decision: v });
        }}
        aria-label="판정"
      >
        <ToggleGroupItem value="accepted">수락</ToggleGroupItem>
        <ToggleGroupItem value="rebaseline">{rebaseLabel}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
