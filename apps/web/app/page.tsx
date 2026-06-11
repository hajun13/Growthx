import { redirect } from 'next/navigation';

// 루트 진입 → 대시보드(인사평가 메인 흡수). 미인증이면 (main) 레이아웃이 로그인으로 보냄.
export default function RootPage() {
  redirect('/dashboard');
}
