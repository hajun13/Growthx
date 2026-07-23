import { DeptHeadEvalView } from '@/features/eval-dept-head/ui/DeptHeadEvalView';

export const metadata = { title: '부서장 평가' };

// 부서장 평가 라우트 — 로직/데이터는 features/eval-dept-head 슬라이스로 이관됨.
export default function DeptHeadEvaluationPage() {
  return <DeptHeadEvalView />;
}
