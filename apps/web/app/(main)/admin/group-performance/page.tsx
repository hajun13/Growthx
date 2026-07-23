// 얇은 라우트 — 화면 구현은 features/admin-group-performance 슬라이스(새 아키텍처 표준 패턴).
import { GroupPerformanceView } from '@/features/admin-group-performance/ui/GroupPerformanceView';

export const metadata = { title: '등급풀 관리' };

export default function GroupPerformancePage() {
  return <GroupPerformanceView />;
}
