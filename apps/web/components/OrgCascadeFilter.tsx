'use client';

// 그룹 선택 → 본부 선택 → 팀 선택 캐스케이드 필터 (공용).
// 상위 선택 시 하위 옵션이 좁혀진다(그룹 바뀌면 본부·팀 리셋 등). 시안: Part/image 2.png.
// lib/org.ts 의 flattenOrg 로 만든 FlatNode 맵을 그대로 소비 — 신규 API 없음.
// 사용처: 권한 관리(사용자별 권한), 평가결과 목록.
import { useMemo } from 'react';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import type { FlatNode } from '@/lib/org';

export interface OrgCascadeValue {
  groupId: string; // '' = 전체
  divisionId: string; // '' = 전체
  teamId: string; // '' = 전체
}

interface Props {
  flat: Map<string, FlatNode>;
  value: OrgCascadeValue;
  onChange: (v: OrgCascadeValue) => void;
  /** 한 줄 툴바(검색·역할 칩과 동일 행)에 넣을 때 — 셀렉트 폭 축소. */
  compact?: boolean;
}

const ALL = '__all__';

export function OrgCascadeFilter({ flat, value, onChange, compact = false }: Props) {
  const nodes = useMemo(() => Array.from(flat.values()), [flat]);

  const groups = useMemo(
    () => nodes.filter((n) => n.type === 'group').sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [nodes],
  );
  const divisions = useMemo(
    () =>
      nodes
        .filter((n) => n.type === 'division' && (!value.groupId || n.parentId === value.groupId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [nodes, value.groupId],
  );
  // 팀은 본부 직속 또는(본부 없는 조직인 경우) 그룹 직속 모두 포함.
  const teams = useMemo(
    () =>
      nodes
        .filter((n) => {
          if (n.type !== 'team') return false;
          if (value.divisionId) return n.parentId === value.divisionId;
          if (value.groupId) {
            const parent = n.parentId ? flat.get(n.parentId) : undefined;
            return n.parentId === value.groupId || parent?.parentId === value.groupId;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [nodes, value.groupId, value.divisionId, flat],
  );

  const hasFilter = !!(value.groupId || value.divisionId || value.teamId);
  const selectWidth = compact ? 'w-[140px]' : 'w-[168px]';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={selectWidth}>
        <Select
          label="그룹"
          hideLabel
          value={value.groupId || ALL}
          options={[{ value: ALL, label: '전체 그룹' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          onChange={(v) => onChange({ groupId: v === ALL ? '' : v, divisionId: '', teamId: '' })}
        />
      </div>
      <div className={selectWidth}>
        <Select
          label="본부"
          hideLabel
          value={value.divisionId || ALL}
          options={[{ value: ALL, label: '전체 본부' }, ...divisions.map((d) => ({ value: d.id, label: d.name }))]}
          onChange={(v) => onChange({ ...value, divisionId: v === ALL ? '' : v, teamId: '' })}
          disabled={divisions.length === 0}
        />
      </div>
      <div className={selectWidth}>
        <Select
          label="팀"
          hideLabel
          value={value.teamId || ALL}
          options={[{ value: ALL, label: '전체 팀' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
          onChange={(v) => onChange({ ...value, teamId: v === ALL ? '' : v })}
          disabled={teams.length === 0}
        />
      </div>
      {hasFilter && (
        <Button variant="secondary" size="sm" onClick={() => onChange({ groupId: '', divisionId: '', teamId: '' })}>
          필터 초기화
        </Button>
      )}
    </div>
  );
}
