'use client';

import { useId } from 'react';
import { Card } from './Card';
import { Select } from './Select';
import { Button } from './Button';
import { auditActionLabel, auditEntityLabel } from '@/lib/ui';

export interface AuditFilterValue {
  actorId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
}

export interface AuditFilterBarProps {
  value: AuditFilterValue;
  actors: { id: string; name: string }[];
  onChange: (v: AuditFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
}

const ALL = '__all__';

export function AuditFilterBar({
  value,
  actors,
  onChange,
  onApply,
  onReset,
}: AuditFilterBarProps) {
  const fromId = useId();
  const toId = useId();
  const dateInvalid = !!value.from && !!value.to && value.from > value.to;

  const actorOptions = [
    { value: ALL, label: '전체 행위자' },
    ...actors.map((a) => ({ value: a.id, label: a.name })),
  ];
  const actionOptions = [
    { value: ALL, label: '전체 액션' },
    ...Object.entries(auditActionLabel).map(([k, l]) => ({
      value: k,
      label: l,
    })),
  ];
  const entityOptions = [
    { value: ALL, label: '전체 대상' },
    ...Object.entries(auditEntityLabel).map(([k, l]) => ({
      value: k,
      label: l,
    })),
  ];

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Select
            label="행위자"
            value={value.actorId ?? ALL}
            options={actorOptions}
            onChange={(v) =>
              onChange({ ...value, actorId: v === ALL ? undefined : v })
            }
          />
        </div>
        <div className="min-w-[180px]">
          <Select
            label="액션"
            value={value.action ?? ALL}
            options={actionOptions}
            onChange={(v) =>
              onChange({ ...value, action: v === ALL ? undefined : v })
            }
          />
        </div>
        <div className="min-w-[160px]">
          <Select
            label="대상"
            value={value.entity ?? ALL}
            options={entityOptions}
            onChange={(v) =>
              onChange({ ...value, entity: v === ALL ? undefined : v })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fromId} className="text-sm font-medium text-foreground">
            시작일
          </label>
          <input
            id={fromId}
            type="date"
            value={value.from ?? ''}
            onChange={(e) =>
              onChange({ ...value, from: e.target.value || undefined })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={toId} className="text-sm font-medium text-foreground">
            종료일
          </label>
          <input
            id={toId}
            type="date"
            value={value.to ?? ''}
            aria-invalid={dateInvalid || undefined}
            onChange={(e) =>
              onChange({ ...value, to: e.target.value || undefined })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            초기화
          </Button>
          <Button size="sm" onClick={onApply} disabled={dateInvalid}>
            적용
          </Button>
        </div>
      </div>
      {dateInvalid && (
        <p className="mt-2 text-sm text-destructive">
          시작일이 종료일보다 늦을 수 없어요.
        </p>
      )}
    </Card>
  );
}
