'use client';

import { useEffect, useMemo, useState } from 'react';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, Role, VisibilityScope } from '@/lib/types';
import { activeKeyForPath, visibleNav } from '@/lib/nav';
import { levelOf } from '@/lib/permConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { ManualButton } from './ManualButton';
import { SidebarBody } from './AppSidebar';
import {
  Sheet,
  SheetContent,
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

export interface AppShellProps {
  role: Role;
  // 뷰어의 가시 범위 — role 과 함께 권한 레벨(PermLevel)을 결정한다.
  scope: VisibilityScope;
  user: { name: string; positionLabel: string; departmentName: string };
  pathname: string;
  notificationCount?: number;
  // 알림 슬롯 — 있으면 상단바 벨을 NotificationBell 로 렌더(미설정 시 기존 정적 벨).
  notifications?: {
    unreadCount: number;
    items: Notification[];
    navBadges?: Record<string, number>; // nav key → 해당 항목 미읽음 수
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
  scope,
  user,
  pathname,
  notificationCount = 0,
  notifications,
  onLogout,
  primaryAction,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 접힘 상태 복원은 마운트 후(SSR 하이드레이션 불일치 방지) — 저장은 토글 시점에.
  useEffect(() => {
    try {
      if (window.localStorage.getItem('gx.sidebarCollapsed') === '1') {
        setSidebarCollapsed(true);
      }
    } catch {
      /* localStorage 접근 불가 환경 무시 */
    }
  }, []);
  const toggleSidebarCollapsed = () =>
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem('gx.sidebarCollapsed', next ? '1' : '0');
      } catch {
        /* localStorage 접근 불가 환경 무시 */
      }
      return next;
    });
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (label: string) =>
    setGroupCollapsed((p) => ({ ...p, [label]: !p[label] }));

  // 관리자가 설정한 권한 레벨별 nav 가시성(서버 연동). 로딩 중엔 DEFAULT(전부 노출) 폴백.
  const { navVisibility } = usePermissions();
  // 가시성은 권한 레벨(PermLevel) 기준 — (role, scope)로 레벨을 도출.
  const level = useMemo(() => levelOf(role, scope), [role, scope]);
  const items = useMemo(
    () =>
      visibleNav(role).filter((item) => {
        if (item.key === 'group-performance' && role !== 'hr_admin') return false;
        const levelConfig = navVisibility[level];
        if (!levelConfig) return true;
        return levelConfig[item.key] !== false;
      }),
    [navVisibility, role, level],
  );
  const activeKey = activeKeyForPath(pathname);

  // 각 nav 항목에 해당 타입의 미읽음 알림 수를 뱃지로 표시.
  const badgeFor = (key: string): number | undefined => {
    if (!notifications?.navBadges) return undefined;
    const count = notifications.navBadges[key];
    return count && count > 0 ? count : undefined;
  };

  const sidebarCommon = { items, activeKey, badgeFor, groupCollapsed, onToggleGroup: toggleGroup };

  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 (lg↑ 고정) — 펼침 w-64(256px) / 접힘 w-19(76px) */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 transition-all duration-200 lg:block',
          sidebarCollapsed ? 'w-19' : 'w-64',
        )}
      >
        <SidebarBody
          {...sidebarCommon}
          compact={sidebarCollapsed}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapsed}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 헤더 — 높이는 theme.css --gx-header-h(60px)와 동기(h-15): 페이지 sticky 요소의 top 기준. */}
        <header className="sticky top-0 z-30 flex h-15 min-h-15 items-center justify-between border-b border-border bg-card px-5 lg:px-8">
          {/* 좌: 모바일 메뉴 */}
          <div className="flex items-center gap-5">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="메뉴 열기"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">주 메뉴</SheetTitle>
                <SidebarBody
                  {...sidebarCommon}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* 우: 매뉴얼 · 알림 · 사용자 */}
          <div className="flex items-center gap-2">
            <ManualButton role={role} pathname={pathname} />
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
                variant="outline"
                size="icon-sm"
                className="relative"
                aria-label={`알림 ${notificationCount}건`}
              >
                <Bell className="size-3.5 text-muted-foreground" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.75 right-1.75 size-1.5 rounded-full bg-danger-500" />
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-9 sm:flex"
                  aria-label="사용자 메뉴"
                >
                  <span className="max-w-45 truncate">
                    {user.name} {user.positionLabel}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuLabel>
                  <span className="block text-sm font-bold text-foreground">
                    {user.name} {user.positionLabel}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {user.departmentName}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-sm">
                  <LogOut aria-hidden />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 본문 */}
        <main className="min-w-0 flex-1 px-5 py-6 pb-10 lg:px-8">{children}</main>
      </div>

      {/* 우하단 고정 Primary (화면당 1개) */}
      {primaryAction && (
        <div className="fixed right-0 bottom-0 left-0 z-30 border-t bg-background px-4 py-3 md:right-8 md:bottom-6 md:left-auto md:border md:px-3 md:py-2">
          <div className="mx-auto flex max-w-screen-2xl justify-end md:max-w-none">
            <Button
              size="lg"
              className="w-full"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
