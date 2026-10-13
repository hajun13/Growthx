'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCOPE_LABEL } from '@/lib/ui';
import type { VisibilityScope } from '@/lib/types';

export interface ScopeSelectProps {
  value: VisibilityScope;
  onChange: (v: VisibilityScope) => void;
  autoDefault?: VisibilityScope; // 직급 기준 자동값(되돌리기용)
  disabled?: boolean;
  error?: string;
}

const SCOPES: VisibilityScope[] = ['self', 'team', 'division', 'group', 'company'];

export function ScopeSelect({
  value,
  onChange,
  autoDefault,
  disabled,
  error,
}: ScopeSelectProps) {
  const id = useId();
  const showRevert = autoDefault !== undefined && autoDefault !== value;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>가시 범위</Label>
        <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as VisibilityScope)}>
          <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPES.map((s) => (
              <SelectItem key={s} value={s}>
                {SCOPE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {showRevert && autoDefault && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>자동값은 &quot;{SCOPE_LABEL[autoDefault]}&quot;이에요.</span>
          <Button variant="link" size="xs" onClick={() => onChange(autoDefault)}>
            자동으로 되돌리기
          </Button>
        </div>
      )}
    </div>
  );
}
