/**
 * org feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값(OrgChartNode)만 넘긴다.
 */
import { orgChartControllerGetChart } from '@growthx/contracts';
import type { OrgChartNode } from '@/lib/types';

// 생성 DTO(OrgChartNodeDto)는 로컬 OrgChartNode 와 구조 동일(필드·타입 일치).
// 페이지 로직·공용 컴포넌트(OrgNodeModal·flattenOrg)는 로컬 타입을 쓰므로 그대로 반환한다.
export async function fetchOrgChart(): Promise<OrgChartNode> {
  const res = await orgChartControllerGetChart();
  return res.data.data as OrgChartNode;
}
