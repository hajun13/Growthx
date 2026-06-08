'use client';

import { Suspense } from 'react';
import { YoyComparePage } from './YoyComparePage';
import { Spinner } from '@/components/States';

// /reports/yoy — 연도 누적(YoY) 비교. 탭(person/org)·쿼리 동기화는 클라이언트.
// useSearchParams 사용 → Suspense 경계로 감싼다(Next.js App Router 요구).
export default function YoyRoutePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <YoyComparePage />
    </Suspense>
  );
}
