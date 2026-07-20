// 현재 라우트·역할에 맞는 노션 매뉴얼 링크를 찾는다.
//
// 링크 데이터(MANUAL_LINKS)는 docs/manual/notion-map.json 에서 파생 생성된다
// (manualLinks.generated.ts). URL 이 채워진 대표 화면만 담기므로, 없으면 null →
// 헤더 버튼이 숨는다.

import { MANUAL_LINKS } from './manualLinks.generated';
import type { Role } from './types';

/**
 * 매뉴얼이 없는 역할이 어떤 역할의 매뉴얼을 대신 볼지.
 * 본부장(division_head)·대표이사/그룹대표(hr_admin, division_head[group])는 팀장과 같은
 * 평가 화면을 쓰므로 팀장 매뉴얼을 본다. 관리 전용 화면은 team_lead 매핑에 없어 버튼이 숨는다.
 */
const ROLE_FALLBACK: Record<Role, Role[]> = {
  employee: [],
  team_lead: [],
  division_head: ['team_lead'],
  hr_admin: ['team_lead'],
};

/**
 * (역할, 경로) → 노션 URL. 없으면 null.
 *
 * 자기 역할 매뉴얼을 먼저 찾고, 없으면 위 폴백 역할 순서로 찾는다.
 * 각 역할 안에서는 정확 일치 우선, 동적 세그먼트(예: `/eval/result/<id>`)는 가장 긴 상위
 * 경로(`/eval/result`)로 매칭한다 — 상세 페이지도 해당 화면 매뉴얼로 연결된다.
 */
export function resolveManualLink(role: Role, pathname: string): string | null {
  for (const r of [role, ...(ROLE_FALLBACK[role] ?? [])]) {
    const hit = lookupInRole(r, pathname);
    if (hit) return hit;
  }
  return null;
}

function lookupInRole(role: Role, pathname: string): string | null {
  const forRole = MANUAL_LINKS[role];
  if (!forRole) return null;

  if (forRole[pathname]) return forRole[pathname];

  let best: string | null = null;
  for (const key of Object.keys(forRole)) {
    if (pathname === key || pathname.startsWith(`${key}/`)) {
      if (best === null || key.length > best.length) best = key;
    }
  }
  return best ? forRole[best] : null;
}
