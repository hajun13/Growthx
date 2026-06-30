import { cn } from '@/lib/utils';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'wide' | 'form' | 'compact';
}

const sizeClass: Record<NonNullable<PageContainerProps['size']>, string> = {
  wide: 'max-w-none',
  form: 'max-w-[1180px]',
  compact: 'max-w-[960px]',
};

/**
 * 모든 (main) 페이지 루트 래퍼의 단일 출처.
 * 본문 패딩은 AppShell <main> 이 담당하므로 페이지는 추가 패딩을 주지 않는다.
 * 폰트는 전역 body(font-sans = Pretendard Variable)를 상속 — 인라인 fontFamily 금지.
 * 이로써 모든 페이지 콘텐츠가 동일한 x/y에서 시작한다.
 */
export function PageContainer({ children, className, size = 'wide' }: PageContainerProps) {
  return (
    <div
      className={cn(
        'gx-product-page mx-auto min-h-full w-full',
        sizeClass[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
