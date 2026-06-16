import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * SectionHeader — 카드/섹션 내부 서브헤더.
 * PageHeader(페이지 최상위 h1) 와 구분되는 더 작은 위계.
 * 보통 Card 내부 또는 구획 구분선 상단에 사용.
 *
 * 사용 예:
 * <SectionHeader title="KPI 성과 요약" description="이번 분기 기준" actions={<Button size="sm">편집</Button>} />
 */
export function SectionHeader({
  title,
  description,
  actions,
  icon,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground leading-snug">
            {title}
          </p>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
