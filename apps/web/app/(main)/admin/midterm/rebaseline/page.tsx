// 라우트 래퍼 — 슬라이스 features/admin-midterm-rebaseline 의 View 만 렌더.
import { RebaselineAdminView } from '@/features/admin-midterm-rebaseline/ui/RebaselineAdminView';

export const metadata = { title: '목표 재조정 검토' };

export default function AdminMidtermRebaselinePage() {
  return RebaselineAdminView();
}
