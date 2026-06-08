'use client';

import { apiGet } from '@/lib/api';
import type { SearchResults } from '@/lib/types';

// 전역 검색 — 상단바 검색창(NavSearch)에서 입력 디바운스 후 직접 호출.
// useAsync 훅을 쓰지 않는 이유: 검색은 입력마다 호출/취소가 필요해 명령형이 단순하다.
export function searchAll(q: string, limit = 8): Promise<SearchResults> {
  return apiGet<SearchResults>('/search', { q, limit });
}
