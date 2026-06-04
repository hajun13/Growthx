'use client';

import { apiGet } from '@/lib/api';
import type { OrgChartNode, Meta } from '@/lib/types';
import { useAsync } from './useAsync';

// GET /org-chart → { data: OrgChartNode(회사 루트), meta }.
// 단건 봉투(루트 노드 1개)라 apiGet 으로 받는다(meta 는 무시 가능).
export function useOrgChart(options: { enabled?: boolean } = {}) {
  return useAsync<OrgChartNode>(
    () => apiGet<OrgChartNode>('/org-chart'),
    [],
    options,
  );
}

// (참고) meta.total 까지 필요하면 별도 호출. 현재 화면은 루트 totalCount 사용.
export type { Meta };
