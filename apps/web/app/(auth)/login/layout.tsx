// login/page.tsx 는 'use client' 라 metadata export 불가 — 레이아웃에서 탭 제목만 제공.
export const metadata = { title: '로그인' };

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
