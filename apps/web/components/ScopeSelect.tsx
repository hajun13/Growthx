'use client';

import { Select } from './Select';
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
  const showRevert = autoDefault !== undefined && autoDefault !== value;
  return (
    <div className="flex flex-col gap-1">
      <Select
        label="가시 범위"
        value={value}
        disabled={disabled}
        error={error}
        options={SCOPES.map((s) => ({ value: s, label: SCOPE_LABEL[s] }))}
        onChange={(v) => onChange(v as VisibilityScope)}
      />
      {showRevert && autoDefault && (
        <p className="text-xs text-muted-foreground">
          자동값은 &quot;{SCOPE_LABEL[autoDefault]}&quot;이에요.{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => onChange(autoDefault)}
          >
            자동으로 되돌리기
          </button>
        </p>
      )}
    </div>
  );
}
