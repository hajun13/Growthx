'use client';

// 조직도 화면 빈 상태 — L1 Empty 조합(레거시 States.EmptyState 대체).
import { FileSearch } from 'lucide-react';
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function OrgEmpty({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Empty className="min-h-32 gap-3 p-6 md:p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearch />
        </EmptyMedia>
        <EmptyTitle className="text-14 font-semibold text-foreground">{title}</EmptyTitle>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
