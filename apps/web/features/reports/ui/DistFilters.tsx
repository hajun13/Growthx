'use client';

// 필터 바 — image 14: 검색 + 그룹/본부/팀/직급/등급 캐스케이드 + 정렬 + 필터 초기화(정렬 보존).
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterSearch, FilterSelect } from './FilterControls';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const ALL = '전체';

export interface DistFilterState {
  search: string;
  group: string;
  division: string;
  team: string;
  position: string;
  grade: string;
  sort: 'score' | 'name';
}

export const DIST_FILTER_DEFAULT: DistFilterState = {
  search: '', group: ALL, division: ALL, team: ALL, position: ALL, grade: ALL, sort: 'score',
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
      <FilterSearch
        value={state.search}
        onChange={(v) => onChange({ search: v })}
        placeholder="이름 검색"
        className="w-full md:w-56"
      />
      <div className="w-36">
        <FilterSelect label="그룹" value={state.group} options={[ALL, ...groupOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ group: v, division: ALL, team: ALL })} />
      </div>
      <div className="w-36">
        <FilterSelect label="본부" value={state.division} options={[ALL, ...divisionOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ division: v, team: ALL })} />
      </div>
      <div className="w-32">
        <FilterSelect label="팀" value={state.team} options={[ALL, ...teamOptions].map((g) => ({ value: g, label: g }))} onChange={(v) => onChange({ team: v })} />
      </div>
      <div className="w-32">
        <FilterSelect label="직급" value={state.position} options={[{ value: ALL, label: ALL }, ...positionOptions]} onChange={(v) => onChange({ position: v })} />
      </div>
      <div className="flex items-center gap-1">
        {[ALL, ...GRADES].map((g) => (
          <Button
            key={g}
            variant={state.grade === g ? 'default' : 'outline'}
            size="sm"
            aria-pressed={state.grade === g}
            onClick={() => onChange({ grade: g })}
          >
            {g}
          </Button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-36">
          <FilterSelect
            label="정렬"
            value={state.sort}
            options={[{ value: 'score', label: '최종점수 순' }, { value: 'name', label: '이름 순' }]}
            onChange={(v) => onChange({ sort: v as DistFilterState['sort'] })}
          />
        </div>
        {/* 초기화 — 필터만 리셋, 정렬은 사용자가 고른 값 보존. */}
        <Button variant="secondary" size="sm" onClick={() => onChange({ ...DIST_FILTER_DEFAULT, sort: state.sort })}>
          <RotateCcw aria-hidden />
          필터 초기화
        </Button>
      </div>
    </div>
  );
}
