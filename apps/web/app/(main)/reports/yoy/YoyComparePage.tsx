'use client';

// /reports/yoy — 얇은 라우트 래퍼. 실제 로직·UI 는 features/reports-yoy 슬라이스로 이관.
// 데이터 소스는 생성 클라이언트(@growthx/contracts) 기반 훅을 사용한다.
export { YoyCompareView as YoyComparePage } from '@/features/reports-yoy/ui/YoyCompareView';
