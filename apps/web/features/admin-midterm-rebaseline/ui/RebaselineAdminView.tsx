// 구 /admin/midterm/rebaseline (즉시 적용 페이지) — 2026-06-08 재조정 워크플로우 전환으로 폐기.
// 부서장 검토 큐는 /eval/midterm 의 DeptHeadMidterm 에 통합됨.
// 이 경로로 접근 시 /eval/midterm 으로 리다이렉트(동작 보존).
//
// 데이터 계층(api.ts·hooks.ts)은 생성 클라이언트(@growthx/contracts) 기반으로 슬라이스에
// 정비돼 있어, 추후 관리자용 재조정 화면을 복원할 때 그대로 재사용한다.
import { redirect } from 'next/navigation';

export function RebaselineAdminView(): never {
  redirect('/eval/midterm');
}
