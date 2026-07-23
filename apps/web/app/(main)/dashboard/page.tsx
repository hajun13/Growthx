import { DashboardView } from '@/features/dashboard/ui/DashboardView';

export const metadata = { title: '대시보드' };

// 라우트는 얇게 — 화면 로직은 features/dashboard 수직 슬라이스에 있다.
export default function DashboardPage() {
  return <DashboardView />;
}
