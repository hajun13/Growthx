// 얇은 라우트 — 화면 구현은 features/eval-result 슬라이스(새 아키텍처 표준 패턴).
import { EvalResultView } from '@/features/eval-result/ui/EvalResultView';

export const metadata = { title: '평가결과' };

export default function EvalResultPage() {
  return <EvalResultView />;
}
