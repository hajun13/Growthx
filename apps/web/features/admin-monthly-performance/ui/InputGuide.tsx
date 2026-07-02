'use client';

// 하단 입력 가이드 — image 11: 실적 입력 / 입력 기간 / 목표 달성 기준 / 저장 안내.
import { Building2, CalendarClock, Target, FileText } from 'lucide-react';

const ITEMS = [
  {
    icon: Building2,
    title: '실적 입력',
    body: '매출, 원가만 입력하면 매출총이익, 이익률은 자동 계산됩니다.',
  },
  {
    icon: CalendarClock,
    title: '입력 기간',
    body: '매월 마감 후 익월 5일까지 입력 부탁드립니다.',
  },
  {
    icon: Target,
    title: '목표 달성 기준',
    body: '100% 이상 양호 · 80~99% 주의 · 80% 미만 위험',
  },
  {
    icon: FileText,
    title: '저장 안내',
    body: '임시저장은 중간 저장이며, 최종저장을 해야 해당 월 실적이 확정됩니다.',
  },
];

export function InputGuide() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-elev-1">
      <div className="mb-3 text-[13px] font-bold text-foreground">입력 가이드</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <item.icon size={16} aria-hidden />
            </span>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">{item.title}</div>
              <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
