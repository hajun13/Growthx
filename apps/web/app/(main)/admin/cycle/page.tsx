// 평가 운영(HR) 라우트 — 로직은 features/admin-cycle 슬라이스로 이관, 여기선 View 만 렌더.
import { CycleOpsView } from '@/features/admin-cycle/ui/CycleOpsView';

export default function CycleOpsPage() {
  return <CycleOpsView />;
}
