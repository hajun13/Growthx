'use client';

// 이의제기 화면 공용 빈 상태 — L1 Empty 조합(구 States.EmptyState 외관: 점선 박스 + 아이콘 + 제목/설명/CTA).
import { FileSearch } from 'lucide-react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AppealEmpty({ title, description, action }: Props) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-5 py-6">
      <Empty className="p-0 md:p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}
