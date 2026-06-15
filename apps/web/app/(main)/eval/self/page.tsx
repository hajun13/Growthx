import { SelfEvaluationView } from '@/features/eval-self/ui/SelfEvaluationView';

// 라우트는 얇은 래퍼 — 화면·데이터 로직은 features/eval-self 슬라이스에.
export default function SelfEvaluationPage() {
  return <SelfEvaluationView />;
}
