// 얇은 라우트 — 화면 구현은 features/reports-summary 슬라이스(새 아키텍처 표준 패턴).
import { EvaluationSummaryView } from '@/features/reports-summary/ui/EvaluationSummaryView';

export const metadata = { title: '평가 결과표' };

export default function EvaluationSummaryPage() {
  return <EvaluationSummaryView />;
}
