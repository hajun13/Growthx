'use client';

import {
  Clock,
  XCircle,
  CheckCircle2,
  MessageSquare,
  Bell,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationStyleFor, type NotificationTone } from '@/lib/ui';
import type { Notification } from '@/lib/types';

const toneIcon: Record<NotificationTone, LucideIcon> = {
  info: Clock,
  warning: XCircle,
  success: CheckCircle2,
  tip: MessageSquare,
  neutral: Bell,
};

// InfoBanner 팔레트 재사용(연배경 + 컬러 아이콘). 신규 색 0.
const toneTile: Record<NotificationTone, string> = {
  info: 'bg-[#EBF3FE] text-[#1B64DA]',
  warning: 'bg-[#FDECEC] text-[#D6303D]',
  success: 'bg-[#E7F8EF] text-[#0F9457]',
  tip: 'bg-[#FEF8EA] text-[#C2670E]',
  neutral: 'bg-[#F2F4F6] text-[#4E5968]',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export interface NotificationItemProps {
  data: Notification;
  onClick?: () => void;
  dense?: boolean;
}

export function NotificationItem({ data, onClick, dense }: NotificationItemProps) {
  const style = notificationStyleFor(data.type);
  const Icon = toneIcon[style.tone];
  const unread = data.readAt === null;
  const message =
    typeof data.payload?.message === 'string' ? data.payload.message : undefined;

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-label={`${unread ? '안읽음, ' : ''}${style.label}`}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        dense ? 'py-2.5' : 'py-3',
        unread && 'bg-primary/[0.04]',
      )}
    >
      {/* 좌측 unread 점 + 아이콘 타일 */}
      <span className="relative mt-0.5 shrink-0">
        {unread && (
          <span
            aria-hidden
            className="absolute -left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
          />
        )}
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md',
            toneTile[style.tone],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm text-foreground',
            unread ? 'font-semibold' : 'font-medium',
          )}
        >
          {style.label}
        </span>
        {message && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {message}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        {relativeTime(data.createdAt)}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}
