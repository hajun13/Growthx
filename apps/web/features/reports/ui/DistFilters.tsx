'use client';

// 필터 바 — image 14: 그룹/본부/팀/직급/등급 캐스케이드 + 정렬 + 필터 초기화.
import { RotateCcw } from 'lucide-react';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const ALL = '전체';

export interface DistFilterState {
  group: string;
  division: string;
  team: string;
  position: string;
  grade: string;
  sort: 'score' | 'name';
}

export const DIST_FILTER_DEFAULT: DistFilterState = {
  group: ALL, division: ALL, team: ALL, position: ALL, grade: ALL, sort: 'score',
};

export interface DistPositionOption {
  value: string;
  label: string;
}

export function DistFilters({
  state,
  onChange,
  groupOptions,
  divisionOptions,
  teamOptions,
  positionOptions,
}: {
  state: DistFilterState;
  onChange: (patch: Partial<DistFilterState>) => void;
  groupOptions: string[];
  divisionOptions: string[];
  teamOptions: string[];
  positionOptions: DistPositionOption[];
}) {
  return (
    <div className="gx-toolbar flex-wrap gap-2">
      <div className="w-36">
        <Select label="그룹" hideLabel value={state.group} options={[ALL, ...groupOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ group: v, division: ALL, team: ALL })} />
      </div>
      <div className="w-36">
        <Select label="본부" hideLabel value={state.division} options={[ALL, ...divisionOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ division: v, team: ALL })} />
      </div>
      <div className="w-32">
        <Select label="팀" hideLabel value={state.team} options={[ALL, ...teamOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ team: v })} />
      </div>
      <div className="w-32">
        <Select label="직급" hideLabel value={state.position} options={[{ value: ALL, label: ALL }, ...positionOptions]} onChange={(v) => onChange({ position: v })} />
      </div>
      <div className="flex items-center gap-1">
        {[ALL, ...GRADES].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange({ grade: g })}
            className={[
              'h-8 rounded-md px-2.5 text-[12px] font-semibold transition-colors',
              state.grade === g ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            ].join(' ')}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-36">
          <Select
            label="정렬"
            hideLabel
            value={state.sort}
            options={[{ value: 'score', label: '최종점수 순' }, { value: 'name', label: '이름 순' }]}
            onChange={(v) => onChange({ sort: v as DistFilterState['sort'] })}
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw size={13} aria-hidden />} onClick={() => onChange(DIST_FILTER_DEFAULT)}>
          필터 초기화
        </Button>
      </div>
    </div>
  );
}
