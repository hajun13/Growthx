// 얇은 라우트 — 화면 구현은 features/notifications 슬라이스(새 아키텍처 표준 패턴).
import { NotificationsView } from '@/features/notifications/ui/NotificationsView';

export const metadata = { title: '알림' };

export default function NotificationsPage() {
  return <NotificationsView />;
}
