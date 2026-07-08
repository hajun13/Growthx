// 사용자 관리 라우트 — admin-users feature 슬라이스의 View 만 렌더하는 얇은 래퍼.
// 데이터·로직은 apps/web/features/admin-users 에 있다(생성 클라이언트 @growthx/contracts 기반).
import { AdminUsersView } from '@/features/admin-users/ui/AdminUsersView';

export const metadata = { title: '사용자 관리' };

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
