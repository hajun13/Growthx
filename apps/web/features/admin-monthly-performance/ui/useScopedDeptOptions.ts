'use client';

// 부서 선택 옵션 — 그룹/본부/팀 통합 + visibilityScope 기준 하위 트리로 제한.
// MonthlyPerformanceView 에서 분리(파일당 ~200줄 상한).
import { useMemo } from 'react';
import { useDepartments } from '@/hooks/useDepartments';
import type { User } from '@/lib/types';

export interface DeptOption {
  value: string;
  label: string;
  type: 'group' | 'division' | 'team';
  parentId: string | null;
}

export function useScopedDeptOptions(user: User | null | undefined, allowed: boolean, isAdmin: boolean) {
  const { data: groupDepts } = useDepartments({ type: 'group' }, { enabled: allowed });
  const { data: divisionDepts } = useDepartments({ type: 'division' }, { enabled: allowed });
  const { data: teamDepts } = useDepartments({ type: 'team' }, { enabled: allowed });

  const deptOptions = useMemo<DeptOption[]>(() => {
    const groups = (groupDepts?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (그룹)`, type: 'group' as const, parentId: d.parentId }));
    const divisions = (divisionDepts?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (본부)`, type: 'division' as const, parentId: d.parentId }));
    const teams = (teamDepts?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (팀)`, type: 'team' as const, parentId: d.parentId }));
    const all = [...groups, ...divisions, ...teams];
    if (!user) return [];
    if (isAdmin || user.visibilityScope === 'company') return all;
    if (!user.departmentId) return [];

    const byId = new Map(all.map((dept) => [dept.value, dept]));
    const rootForScope = (() => {
      let cursor: string | null = user.departmentId;
      for (let depth = 0; cursor && depth < 10; depth += 1) {
        const dept = byId.get(cursor);
        if (!dept) return user.departmentId;
        if (user.visibilityScope === 'team' && dept.type === 'team') return dept.value;
        if (user.visibilityScope === 'division' && dept.type === 'division') return dept.value;
        if (user.visibilityScope === 'group' && dept.type === 'group') return dept.value;
        cursor = dept.parentId;
      }
      return user.departmentId;
    })();

    const isUnderRoot = (deptId: string) => {
      let cursor: string | null = deptId;
      for (let depth = 0; cursor && depth < 10; depth += 1) {
        if (cursor === rootForScope) return true;
        cursor = byId.get(cursor)?.parentId ?? null;
      }
      return false;
    };

    if (user.visibilityScope === 'team') return all.filter((dept) => dept.value === user.departmentId);
    return all.filter((dept) => isUnderRoot(dept.value));
  }, [groupDepts, divisionDepts, teamDepts, isAdmin, user]);

  return deptOptions;
}
