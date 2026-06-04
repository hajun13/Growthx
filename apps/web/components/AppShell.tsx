'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  Bell,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  FileText,
  CheckSquare,
  UserCheck,
  Users,
  BarChart3,
  PieChart,
  MessageSquareWarning,
  Calculator,
  Settings,
  ScrollText,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, Role } from '@/lib/types';
import { activeKeyForPath, visibleNav } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { Button as DomainButton } from './Button';
import { NotificationBell } from './NotificationBell';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

// nav 항목 key → lucide 아이콘.
const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  org: Network,
  audit: ScrollText,
  eval: ClipboardList,
  kpi: FileText,
  'kpi-review': CheckSquare,
  self: UserCheck,
  'dept-head': Users,
  result: BarChart3,
  'group-performance': PieChart,
  reports: PieChart,
  appeals: MessageSquareWarning,
  compensation: Calculator,
  settings: Settings,
};

// nav 항목 key → 컬러 타일(연배경 + 컬러 아이콘)로 스캔성↑ (레퍼런스 사이드바 느낌).
const NAV_ICON_TINT: Record<string, string> = {
  dashboard: 'bg-[#EBF3FE] text-[#1B64DA]',
  org: 'bg-[#ECEBFB] text-[#4B43BD]',
  audit: 'bg-[#F2F4F6] text-[#4E5968]',
  eval: 'bg-[#EBF3FE] text-[#1B64DA]',
  kpi: 'bg-[#ECEBFB] text-[#4B43BD]',
  'kpi-review': 'bg-[#E7F8EF] text-[#0F9457]',
  self: 'bg-[#EBF3FE] text-[#1B64DA]',
  'dept-head': 'bg-[#FEF1E6] text-[#C2670E]',
  result: 'bg-[#E7F8EF] text-[#0F9457]',
  'group-performance': 'bg-[#ECEBFB] text-[#4B43BD]',
  reports: 'bg-[#FEF6E6] text-[#A66800]',
  appeals: 'bg-[#FDECEC] text-[#D6303D]',
  compensation: 'bg-[#E7F8EF] text-[#0F9457]',
  settings: 'bg-[#F2F4F6] text-[#4E5968]',
};

export interface AppShellProps {
  role: Role;
  user: { name: string; positionLabel: string; departmentName: string };
  pathname: string;
  notificationCount?: number;
  // 알림 슬롯 — 있으면 상단바 벨을 NotificationBell 로 렌더(미설정 시 기존 정적 벨).
  notifications?: {
    unreadCount: number;
    items: Notification[];
    loading?: boolean;
    onRead: (id: string) => void;
    onReadAll: () => void;
    onOpen?: () => void;
  };
  onLogout?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  children: React.ReactNode;
}

export function AppShell({
  role,
  user,
  pathname,
  notificationCount = 0,
  notifications,
  onLogout,
  primaryAction,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = visibleNav(role);
  const activeKey = activeKeyForPath(pathname);

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav aria-label="주 메뉴" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = NAV_ICONS[item.key];
        const tint = NAV_ICON_TINT[item.key] ?? 'bg-muted text-foreground';
        return (
          <span key={item.key} className="contents">
            {item.divider && <Separator className="my-2" />}
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-primary/[0.06] font-bold text-foreground ring-1 ring-primary/15'
                  : 'font-medium text-foreground hover:bg-muted',
              )}
            >
              {Icon && (
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                    tint,
                  )}
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );

  const initials = user.name.slice(0, 1);

  return (
    <div className="min-h-screen bg-background">
      {/* 상단바 — 흰 배경 + 하단 헤어라인 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          {/* 모바일 드로어 */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] p-0">
              <SheetHeader className="border-b px-4 py-3 text-left">
                <SheetTitle className="text-base font-bold">
                  에너지엑스 인사 평가
                </SheetTitle>
              </SheetHeader>
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link href="/eval" className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground">
              에너지엑스 인사 평가
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {notifications ? (
            <NotificationBell
              unreadCount={notifications.unreadCount}
              items={notifications.items}
              loading={notifications.loading}
              onRead={notifications.onRead}
              onReadAll={notifications.onReadAll}
              onOpenChange={(open) => {
                if (open) notifications.onOpen?.();
              }}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`알림 ${notificationCount}건`}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                  {notificationCount}
                </span>
              )}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full pl-1 pr-2 outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="사용자 메뉴"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden flex-col items-start sm:flex">
                  <span className="text-sm font-medium leading-tight text-foreground">
                    {user.name} {user.positionLabel}
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    {user.departmentName}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {user.name} {user.positionLabel}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user.departmentName}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl">
        {/* 사이드바 (lg↑ 고정) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[256px] shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
          <NavList />
        </aside>

        {/* 본문 */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:px-8">{children}</main>
      </div>

      {/* 우하단 고정 Primary (화면당 1개) */}
      {primaryAction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/90 px-4 py-3 backdrop-blur-md md:bottom-6 md:left-auto md:right-8 md:rounded-lg md:border md:px-3 md:py-2 md:shadow-md">
          <div className="mx-auto flex max-w-screen-2xl justify-end md:max-w-none">
            <DomainButton
              size="lg"
              fullWidth
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </DomainButton>
          </div>
        </div>
      )}
    </div>
  );
}
