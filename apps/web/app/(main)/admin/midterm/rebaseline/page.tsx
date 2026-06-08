// 구 /admin/midterm/rebaseline (즉시 적용 페이지) — 2026-06-08 재조정 워크플로우 전환으로 폐기.
// 부서장 검토 큐는 /eval/midterm 의 DeptHeadMidterm 에 통합됨.
// 이 경로로 접근 시 /eval/midterm 으로 리다이렉트.
import { redirect } from 'next/navigation';

export default function DeprecatedRebaselinePage() {
  redirect('/eval/midterm');
}
