// 6월 중간점검 라우트 — 얇은 래퍼. 화면 로직은 features/eval-midterm 슬라이스(MidtermView)로 이관.
import { MidtermView } from '@/features/eval-midterm/ui/MidtermView';

export const metadata = { title: '중간 점검' };

export default function MidtermPage() {
  return <MidtermView />;
}
