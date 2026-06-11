import { redirect } from 'next/navigation';

// 인사평가 메인은 대시보드(/dashboard)에 흡수됨 (2026-06-11).
// 북마크·딥링크 보호를 위해 페이지를 삭제하지 않고 영구 리다이렉트한다.
export default function EvalIndexPage() {
  redirect('/dashboard');
}
