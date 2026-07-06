'use client';

// "내가 확인할 항목" — 시안: 2×2 카드(아이콘 타일 + 제목·설명 + 배지 + 링크 버튼).
import { useRouter } from 'next/navigation';
import { FileEdit, FileSearch, Megaphone, Users, ArrowRight } from 'lucide-react';
import type { TodoItem, TodoUrgency } from './buildTodoItems';

const ICONS = [FileEdit, FileSearch, Megaphone, Users];
const ICON_TONES = [
  'bg-info-50 text-primary',
  'bg-brand-teal-subtle text-brand-teal-strong',
  'bg-status-revision-bg text-status-revision-fg',
  'bg-success-50 text-success-600',
];

const BADGE: Record<TodoUrgency, string> = {
  urgent: 'bg-info-50 text-primary',
  active: 'bg-brand-teal-subtle text-brand-teal-strong',
  done: 'bg-success-50 text-success-600',
};

function badgeLabel(item: TodoItem, dDay: string | null): string {
  if (item.urgency === 'done') return '완료';
  if (item.urgency === 'urgent') return dDay ? `마감 ${dDay}` : '지금 처리';
  return '진행중';
}

export function ChecklistGrid({ items, dDay }: { items: TodoItem[]; dDay: string | null }) {
  const router = useRouter();
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-white p-5 shadow-elev-1">
      <h2 className="mb-4 text-[14px] font-semibold text-foreground">내가 확인할 항목</h2>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <div key={item.key} className="flex flex-col rounded-lg border border-border bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[i % ICON_TONES.length]}`}>
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13.5px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[item.urgency]}`}>
                  {badgeLabel(item, dDay)}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-primary transition hover:bg-info-50"
                >
                  {item.actionLabel}
                  <ArrowRight size={12} aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
