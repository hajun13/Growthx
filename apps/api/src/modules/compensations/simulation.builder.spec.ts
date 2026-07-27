import { describe, it, expect } from 'vitest';
import { DepartmentType } from '@prisma/client';
import { divisionNameOf, groupNameOf, teamNameOf } from './simulation.builder';

/** 테스트용 부서 노드(조상 체인) — Prisma include 로 채워지는 모양과 동일. */
type Dept = { name: string; type: DepartmentType; parent: Dept | null };

const group = (name: string): Dept => ({ name, type: DepartmentType.group, parent: null });
const division = (name: string, parent: Dept | null): Dept => ({
  name,
  type: DepartmentType.division,
  parent,
});
const team = (name: string, parent: Dept | null): Dept => ({
  name,
  type: DepartmentType.team,
  parent,
});

describe('groupNameOf — 보상 현황 그룹 분류', () => {
  const g = group('친환경기술그룹');
  const d = division('친환경CS1본부', g);

  it('그룹 소속(임원) → 자기 그룹', () => {
    expect(groupNameOf(g)).toBe('친환경기술그룹');
  });

  it('본부 소속 → 상위 그룹', () => {
    expect(groupNameOf(d)).toBe('친환경기술그룹');
  });

  it('팀 → 본부 → 그룹 3단계', () => {
    expect(groupNameOf(team('CS1본부 1팀', d))).toBe('친환경기술그룹');
  });

  it('본부를 건너뛴 그룹 직속 팀도 그룹으로 분류된다', () => {
    // 실제 조직(이노베이션그룹 IT개발팀·연구팀, 엔지니어링그룹 기술개발팀 등)은
    // 본부 없이 그룹 바로 아래 팀이 붙는다. 고정 조부모 탐색이면 여기서 null 이 됐다.
    const innovation = group('이노베이션그룹');
    expect(groupNameOf(team('IT개발팀', innovation))).toBe('이노베이션그룹');
  });

  it('부서 없음/체인에 그룹이 없으면 null', () => {
    expect(groupNameOf(null)).toBeNull();
    expect(groupNameOf(undefined)).toBeNull();
    expect(groupNameOf(division('무소속본부', null))).toBeNull();
  });

  it('본부/팀 라벨은 그룹 직속 팀에서도 오염되지 않는다', () => {
    const innovation = group('이노베이션그룹');
    const t = team('IT개발팀', innovation);
    expect(divisionNameOf(t)).toBeNull();
    expect(teamNameOf(t)).toBe('IT개발팀');
  });
});
