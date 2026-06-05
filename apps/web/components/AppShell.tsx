'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  Bell,
  LogOut,
  Search,
  ChevronRight,
  ChevronDown,
  Zap,
  LayoutDashboard,
  ClipboardList,
  FileText,
  CheckSquare,
  UserCheck,
  Users,
  BarChart3,
  TrendingUp,
  CalendarDays,
  PieChart,
  MessageSquareWarning,
  Calculator,
  Settings,
  ScrollText,
  Network,
  Shield,
  Brain,
  ClipboardCheck,
  FileCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, Role } from '@/lib/types';
import {
  activeKeyForPath,
  visibleNav,
  NAV_GROUP_ORDER,
  type NavItem,
  type NavTone,
} from '@/lib/nav';
import { getNavConfig } from '@/lib/permConfig';
import { Button } from '@/components/ui/button';
import { Button as DomainButton } from './Button';
import { NotificationBell } from './NotificationBell';
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

// nav 항목 key → lucide 아이콘.
const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  'user-mgmt': Users,
  'perm-mgmt': Shield,
  org: Network,
  audit: ScrollText,
  eval: ClipboardList,
  'my-eval': FileCheck,
  kpi: FileText,
  'kpi-review': CheckSquare,
  'competency-items': Brain,
  'competency-eval': ClipboardCheck,
  self: UserCheck,
  'dept-head': Users,
  result: BarChart3,
  'group-performance': TrendingUp,
  'monthly-performance': CalendarDays,
  reports: PieChart,
  appeals: MessageSquareWarning,
  compensation: Calculator,
  settings: Settings,
};

// 아이콘 타일 배경색(레퍼런스 Sidebar IC 규칙).
const TONE_BG: Record<NavTone, string> = {
  core: '#191f28',
  eval: '#3182f6',
  admin: '#4e5968',
  alert: '#d22030',
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
  user,
  pathname,
  notificationCount = 0,
  notifications,
  onLogout,
  primaryAction,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 관리자가 설정한 역할별 nav 가시성(localStorage) — SSR 안전 가드.
  const navConfig = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getNavConfig();
  }, []);
  const items = useMemo(
    () =>
      visibleNav(role).filter((item) => {
        if (!navConfig) return true; // SSR fallback
        const roleConfig = navConfig[role];
        if (!roleConfig) return true;
        return roleConfig[item.key] !== false;
      }),
    [navConfig, role],
  );
  const activeKey = activeKeyForPath(pathname);
  const activeItem = items.find((i) => i.key === activeKey);
  const initials = user.name.slice(0, 1);

  // 각 nav 항목에 해당 타입의 미읽음 알림 수를 뱃지로 표시.
  const badgeFor = (key: string): number | undefined => {
    if (!notifications?.navBadges) return undefined;
    const count = notifications.navBadges[key];
    return count && count > 0 ? count : undefined;
  };

  // ── 단일 네비게이션 항목(버튼 형태 Link) ──
  const NavRow = ({
    item,
    onNavigate,
  }: {
    item: NavItem;
    onNavigate?: () => void;
  }) => {
    const isActive = item.key === activeKey;
    const Icon = NAV_ICONS[item.key];
    const badge = badgeFor(item.key);
    return (
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'group relative flex w-full items-center gap-2.5 py-1.5 pl-3 pr-2.5 text-left outline-none transition-colors focus-visible:bg-toss-grey50',
          isActive ? 'bg-toss-grey100' : 'hover:bg-toss-grey50',
        )}
        style={{
          borderLeft: isActive
            ? '2px solid #3182f6'
            : '2px solid transparent',
          marginBottom: 1,
        }}
      >
        {Icon && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center"
            style={{ background: TONE_BG[item.tone] }}
            aria-hidden
          >
            <Icon size={13} color="#fff" strokeWidth={2} />
          </span>
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[12.5px]',
            isActive
              ? 'font-semibold text-toss-blue700'
              : 'font-normal text-toss-grey700',
          )}
        >
          {item.label}
        </span>
        {badge !== undefined && (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center px-1 text-[9.5px] font-bold text-white"
            style={{ background: '#f04452' }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  // ── 사이드바 본문(데스크톱 + 모바일 드로어 공유) ──
  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => {
    const ungrouped = items.filter((i) => !i.group);
    return (
      <div className="flex h-full flex-col bg-card">
        {/* 로고 */}
        <Link
          href="/eval"
          onClick={onNavigate}
          className="flex shrink-0 items-center gap-2.5 border-b border-border px-4"
          style={{ height: 52 }}
        >
          <span
            className="flex items-center justify-center"
            style={{ width: 26, height: 26, background: '#3182f6' }}
          >
            <Zap size={13} color="#fff" fill="#fff" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-bold leading-tight tracking-tight text-toss-grey900">
              에너지엑스
            </span>
            <span className="text-[10px] font-medium leading-tight text-toss-grey500">
              HR 평가 시스템
            </span>
          </span>
        </Link>

        {/* 네비게이션 */}
        <nav
          aria-label="주 메뉴"
          className="flex-1 overflow-y-auto py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* 그룹 없는 최상단 항목 */}
          {ungrouped.map((item) => (
            <NavRow key={item.key} item={item} onNavigate={onNavigate} />
          ))}

          {/* 그룹별 collapsible 섹션 */}
          {NAV_GROUP_ORDER.map((groupLabel) => {
            const groupItems = items.filter((i) => i.group === groupLabel);
            if (groupItems.length === 0) return null;
            const isCollapsed = collapsed[groupLabel];
            return (
              <div key={groupLabel} className="mt-0.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-1.5 transition-colors hover:bg-toss-grey50"
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [groupLabel]: !p[groupLabel] }))
                  }
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.7px] text-toss-grey400">
                    {groupLabel}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight size={10} color="#b0b8c1" />
                  ) : (
                    <ChevronDown size={10} color="#b0b8c1" />
                  )}
                </button>
                {!isCollapsed &&
                  groupItems.map((item) => (
                    <NavRow key={item.key} item={item} onNavigate={onNavigate} />
                  ))}
              </div>
            );
          })}
        </nav>

        {/* 사용자 카드 */}
        <div
          className="border-t border-border"
          style={{ padding: '12px 14px' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex shrink-0 items-center justify-center text-[11.5px] font-bold text-white"
              style={{
                width: 28,
                height: 28,
                background: '#3182f6',
                borderRadius: '50%',
              }}
            >
              {initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-toss-grey900">
                {user.name} {user.positionLabel}
              </span>
              <span className="truncate text-[10.5px] text-toss-grey500">
                {user.departmentName}
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── 브레드크럼(상위 그룹 + 현재 페이지) ──
  const breadcrumb: string[] = activeItem
    ? activeItem.group
      ? [activeItem.group, activeItem.label]
      : ['홈', activeItem.label]
    : ['홈'];

  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 (lg↑ 고정) */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 border-r border-border lg:block"
        style={{ width: 216, minWidth: 216 }}
      >
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 헤더 */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-5"
          style={{ height: 52, minHeight: 52 }}
        >
          {/* 좌: 모바일 메뉴 + 브레드크럼 */}
          <div className="flex items-center gap-2">
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
              <SheetContent side="left" className="w-[216px] p-0">
                <SheetTitle className="sr-only">주 메뉴</SheetTitle>
                <SidebarBody onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-1.5">
              {breadcrumb.map((crumb, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight size={12} color="#d1d6db" />}
                    <span
                      className={cn(
                        'text-[12.5px]',
                        isLast
                          ? 'font-semibold text-toss-grey900'
                          : 'font-normal text-toss-grey500',
                      )}
                    >
                      {crumb}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우: 검색 · 알림 · 사용자 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-2 border border-border bg-toss-grey100 px-3 transition-colors hover:bg-toss-grey200 sm:flex"
              style={{ height: 32, minWidth: 172 }}
              aria-label="검색"
            >
              <Search size={12} color="#8b95a1" />
              <span className="flex-1 text-left text-[12px] text-toss-grey400">
                검색
              </span>
              <kbd className="bg-toss-grey200 px-[5px] py-px font-[system-ui] text-[10px] text-toss-grey400">
                ⌘K
              </kbd>
            </button>

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
              <button
                type="button"
                className="relative flex items-center justify-center border border-border bg-toss-grey100 transition-colors hover:bg-toss-grey200"
                style={{ width: 32, height: 32 }}
                aria-label={`알림 ${notificationCount}건`}
              >
                <Bell size={14} color="#6b7684" />
                {notificationCount > 0 && (
                  <span
                    className="absolute"
                    style={{
                      top: 7,
                      right: 7,
                      width: 6,
                      height: 6,
                      background: '#f04452',
                    }}
                  />
                )}
              </button>
            )}

            <div
              style={{ width: 1, height: 18, background: '#e5e8eb', margin: '0 2px' }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-2 py-1 outline-none transition-colors hover:bg-toss-grey100 focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="사용자 메뉴"
                >
                  <span
                    className="flex shrink-0 items-center justify-center text-[11px] font-bold text-white"
                    style={{
                      width: 26,
                      height: 26,
                      background: '#3182f6',
                      borderRadius: '50%',
                    }}
                  >
                    {initials}
                  </span>
                  <span className="hidden flex-col items-start text-left sm:flex">
                    <span className="text-[12px] font-semibold leading-tight text-toss-grey900">
                      {user.name} {user.positionLabel}
                    </span>
                    <span className="text-[10px] leading-tight text-toss-grey500">
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

        {/* 본문 */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:px-8">{children}</main>
      </div>

      {/* 우하단 고정 Primary (화면당 1개) */}
      {primaryAction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/90 px-4 py-3 backdrop-blur-md md:bottom-6 md:left-auto md:right-8 md:border md:px-3 md:py-2 md:shadow-md">
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
