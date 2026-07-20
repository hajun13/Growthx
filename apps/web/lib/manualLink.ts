// 현재 라우트·역할에 맞는 노션 매뉴얼 링크를 찾는다.
//
// 링크 데이터(MANUAL_LINKS)는 docs/manual/notion-map.json 에서 파생 생성된다
// (manualLinks.generated.ts). URL 이 채워진 대표 화면만 담기므로, 없으면 null →
// 헤더 버튼이 숨는다.

import { MANUAL_LINKS } from './manualLinks.generated';
import type { Role } from './types';

/**
 * (역할, 경로) → 노션 URL. 없으면 null.
 *
 * 정적 경로는 정확히 일치로 찾고, 동적 세그먼트(예: `/eval/result/<id>`)는
 * 가장 긴 상위 경로(`/eval/result`)로 매칭한다 — 상세 페이지도 해당 화면 매뉴얼로 연결된다.
 */
export function resolveManualLink(role: Role, pathname: string): string | null {
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
