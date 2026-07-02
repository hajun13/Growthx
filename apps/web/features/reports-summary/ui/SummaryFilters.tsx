'use client';

// 필터 바 — image 12: 그룹/본부/팀/직급/등급/평가상태 + 검색 + 정렬.
import { SearchInput } from '@/components/SearchInput';
import { Select } from '@/components/Select';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const ALL = '전체';

export interface SummaryFilterState {
  search: string;
  group: string;
  division: string;
  team: string;
  position: string;
  grade: string;
  evalStatus: string;
}

export function SummaryFilters({
  state,
  onChange,
  groupOptions,
  divisionOptions,
  teamOptions,
  positionOptions,
}: {
  state: SummaryFilterState;
  onChange: (patch: Partial<SummaryFilterState>) => void;
  groupOptions: string[];
  divisionOptions: string[];
  teamOptions: string[];
  positionOptions: string[];
}) {
  return (
    <div className="gx-toolbar flex-wrap gap-2">
      <SearchInput
        value={state.search}
        onChange={(v) => onChange({ search: v })}
        placeholder="이름, 사번 검색"
        className="w-full md:w-56"
      />
      <div className="w-36">
        <Select
          label="그룹"
          hideLabel
          value={state.group}
          options={[ALL, ...groupOptions].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ group: v, division: ALL, team: ALL })}
        />
      </div>
      <div className="w-36">
        <Select
          label="본부"
          hideLabel
          value={state.division}
          options={[ALL, ...divisionOptions].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ division: v, team: ALL })}
        />
      </div>
      <div className="w-32">
        <Select
          label="팀"
          hideLabel
          value={state.team}
          options={[ALL, ...teamOptions].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ team: v })}
        />
      </div>
      <div className="w-32">
        <Select
          label="직급"
          hideLabel
          value={state.position}
          options={[ALL, ...positionOptions].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ position: v })}
        />
      </div>
      <div className="w-28">
        <Select
          label="등급"
          hideLabel
          value={state.grade}
          options={[ALL, ...GRADES].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ grade: v })}
        />
      </div>
      <div className="w-32">
        <Select
          label="평가상태"
          hideLabel
          value={state.evalStatus}
          options={[ALL, '평가완료', '미완료'].map((g) => ({ value: g, label: g }))}
          onChange={(v) => onChange({ evalStatus: v })}
        />
      </div>
    </div>
  );
}
