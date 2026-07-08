import type { Metadata } from 'next';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@energyx/ui/styles.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    template: '%s — 에너지엑스 인사 평가',
    default: '에너지엑스 인사 평가 시스템',
  },
  description: '성과를 만든 사람이 평가받는 구조 — 에너지엑스 인사 평가',
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
