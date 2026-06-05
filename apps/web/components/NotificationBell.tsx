'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/States';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '@/lib/types';

export interface NotificationBellProps {
  unreadCount: number;
  items: Notification[];
  loading?: boolean;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onOpenChange?: (open: boolean) => void;
}

// 상단바 벨 + 드롭다운(미리보기 목록·모두읽음·전체보기). 기존 벨 스타일 유지.
export function NotificationBell({
  unreadCount,
  items,
  loading,
  onRead,
  onReadAll,
  onOpenChange,
}: NotificationBellProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`알림 ${unreadCount}건`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center bg-danger-500 px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] p-0"
        // 항목이 button 이라 메뉴 닫힘 후 라우팅이 자연스럽게 동작.
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-bold text-foreground">알림</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onReadAll();
            }}
            disabled={unreadCount === 0}
            className="text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            모두 읽음
          </button>
        </div>

        <ScrollArea className="max-h-[420px]">
          <div role="menu" className="flex flex-col p-1.5">
            {loading ? (
              <div className="flex flex-col gap-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                새 알림이 없어요.
              </p>
            ) : (
              items.map((n) => (
                <NotificationItem
                  key={n.id}
                  data={n}
                  dense
                  onClick={() => onRead(n.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border">
          <Link
            href="/notifications"
            className="block px-3 py-2.5 text-center text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            전체 보기
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
