'use client';

// "내가 확인할 항목" — 시안: 2×2 카드(아이콘 타일 + 제목·설명 + 배지 + 링크 버튼).
import { useRouter } from 'next/navigation';
import { FileEdit, FileSearch, Megaphone, Users, ArrowRight } from 'lucide-react';
import type { TodoItem, TodoUrgency } from './buildTodoItems';

const ICONS = [FileEdit, FileSearch, Megaphone, Users];
const ICON_TONES = [
  'bg-[#EAF2FE] text-[#0257CE]',
  'bg-[#E4FBFB] text-[#0E7E85]',
  'bg-[#FEF3E2] text-[#B45309]',
  'bg-[#F1EDFB] text-[#564599]',
];

const BADGE: Record<TodoUrgency, string> = {
  urgent: 'bg-[#EAF2FE] text-[#0257CE]',
  active: 'bg-[#E4FBFB] text-[#0E7E85]',
  done: 'bg-[#E3F7EC] text-[#0B7A47]',
};

function badgeLabel(item: TodoItem, dDay: string | null): string {
  if (item.urgency === 'done') return '완료';
  if (item.urgency === 'urgent') return dDay ? `마감 ${dDay}` : '지금 처리';
  return '진행중';
}

export function ChecklistGrid({ items, dDay }: { items: TodoItem[]; dDay: string | null }) {
  const router = useRouter();
  return (
    <section className="flex h-full flex-col rounded-[10px] border border-[#E7E9F3] bg-white p-5 shadow-[0_1px_3px_rgba(22,19,38,0.06),0_1px_2px_rgba(22,19,38,0.04)]">
      <h2 className="mb-4 text-[14px] font-semibold text-[#161326]">내가 확인할 항목</h2>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <div key={item.key} className="flex flex-col rounded-[10px] border border-[#E7E9F3] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${ICON_TONES[i % ICON_TONES.length]}`}>
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13.5px] font-semibold text-[#161326]">{item.title}</h3>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#6B6980]">{item.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[item.urgency]}`}>
                  {badgeLabel(item, dDay)}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="inline-flex items-center gap-1 rounded-[8px] border border-[#E7E9F3] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0257CE] transition hover:bg-[#EAF2FE]"
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
