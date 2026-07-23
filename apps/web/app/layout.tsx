import type { Metadata } from 'next';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@energyx/ui/styles.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  // 페이지별 탭 제목 — 각 라우트의 `export const metadata = { title }` 가 %s 로 들어간다.
  // (클라이언트 페이지는 형제 layout.tsx 가 제공: (auth)/login, onboarding/password)
  title: {
    template: '%s · 에너지엑스 KPI 시스템',
    default: '에너지엑스 KPI 시스템',
  },
  description: '성과를 만든 사람이 평가받는 구조 — 에너지엑스 KPI 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
