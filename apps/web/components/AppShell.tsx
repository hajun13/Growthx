'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  Bell,
  LogOut,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  ClipboardList,
  FileText,
  CheckSquare,
  UserCheck,
  Users,
  BarChart3,
  TrendingUp,
  CalendarDays,
  Calendar,
  PieChart,
  MessageSquareWarning,
  Calculator,
  Percent,
  Settings,
  ScrollText,
  Network,
  Shield,
  Brain,
  ClipboardCheck,
  FileCheck,
  FileUp,
  FileSpreadsheet,
  Table2,
  Milestone,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, Role, VisibilityScope } from '@/lib/types';
import {
  activeKeyForPath,
  visibleNav,
  NAV_GROUP_ORDER,
  type NavItem,
} from '@/lib/nav';
import { levelOf } from '@/lib/permConfig';
import { usePermissions } from '@/hooks/usePermissions';
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
  'eval-summary': Table2,
  appeals: MessageSquareWarning,
  midterm: Milestone,
  'cycle-ops': Calendar,
  'kpi-import': FileUp,
  'compensation-import': FileSpreadsheet,
  rules: Percent,
  compensation: Calculator,
  settings: Settings,
};

// Notion-low-color 사이드바 토큰 — 흰 표면 + 조용한 블루 활성 배경.
const SIDEBAR = {
  bg: '#ffffff',
  activeBg: '#EAF4FF',
  activeFg: '#0075DE',
  text: '#615D59',
  muted: '#9A948E',
  ink: '#111111',
  border: '#E6E2DE',
  hover: '#F0EFED',
  expandedWidth: 256,
  collapsedWidth: 76,
} as const;

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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

  // 단일 네비게이션 항목: 뉴트럴 기본, 활성 상태만 블루로 제한.
  const NavRow = ({
    item,
    onNavigate,
    compact = false,
  }: {
    item: NavItem;
    onNavigate?: () => void;
    compact?: boolean;
  }) => {
    const isActive = item.key === activeKey;
    const Icon = NAV_ICONS[item.key];
    const badge = badgeFor(item.key);
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        title={compact ? item.label : undefined}
        className={cn(
          'relative flex w-full items-center rounded-md py-2.5 transition-colors',
          compact ? 'justify-center px-0' : 'space-x-3 px-4',
        )}
        style={{
          background: isActive ? SIDEBAR.activeBg : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLElement).style.background = SIDEBAR.hover;
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0"
            style={{ color: isActive ? SIDEBAR.activeFg : SIDEBAR.text }}
            aria-hidden
          />
        )}
        {!compact && (
          <span
            className="min-w-0 flex-1 truncate text-[13px]"
            style={{
              color: isActive ? SIDEBAR.activeFg : SIDEBAR.text,
              fontWeight: isActive ? 700 : 600,
            }}
          >
            {item.label}
          </span>
        )}
        {badge !== undefined && (
          <span
            className={cn(
              'flex h-4 min-w-4 shrink-0 items-center justify-center px-1 text-[9.5px] font-bold leading-none text-white',
              compact && 'absolute ml-7 -mt-6',
            )}
            style={{ background: '#C23A3A', borderRadius: 999, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  // ── 사이드바 본문(데스크톱 + 모바일 드로어 공유) ──
  const SidebarBody = ({
    onNavigate,
    compact = false,
  }: {
    onNavigate?: () => void;
    compact?: boolean;
  }) => {
    const ungrouped = items.filter((i) => !i.group);
    return (
      <div
        className="flex h-full flex-col"
        style={{ background: SIDEBAR.bg }}
      >
        <div
          className={cn(
            'flex h-[60px] shrink-0 items-center border-b',
            compact ? 'justify-center px-0' : 'gap-3 px-5',
          )}
          style={{ borderColor: SIDEBAR.border }}
        >
          <button
            type="button"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors lg:inline-flex"
            style={{ color: SIDEBAR.ink }}
            aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            onClick={() => setSidebarCollapsed((v) => !v)}
            onMouseEnter={(e) => (e.currentTarget.style.background = SIDEBAR.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={cn('flex min-w-0 items-center', compact && 'hidden')}
            aria-label="대시보드로 이동"
          >
            <img
              src="/energyx-logo.png"
              alt="ENERGYX"
              className="block h-[28px] w-[126px] object-contain"
            />
          </Link>
        </div>
        <nav
          aria-label="주 메뉴"
          className={cn(
            'flex flex-1 flex-col gap-1 overflow-y-auto py-5',
            compact ? 'px-2' : 'px-4',
          )}
          style={{ scrollbarWidth: 'none' }}
        >
          {/* 그룹 없는 최상단 항목 — NavRow는 일반 함수 호출(컴포넌트 아님): 리렌더 시 리마운트 방지 */}
          {ungrouped.map((item) => NavRow({ item, onNavigate, compact }))}

          {/* 그룹별 섹션 — 목업: pt-8 border-t border-white/10 mt-8 구분선 */}
          {NAV_GROUP_ORDER.map((groupLabel) => {
            const groupItems = items.filter((i) => i.group === groupLabel);
            if (groupItems.length === 0) return null;
            const isCollapsed = collapsed[groupLabel];
            return (
              <div key={groupLabel} className={cn('border-t pt-4', compact ? 'mt-4' : 'mt-6')} style={{ borderColor: SIDEBAR.border }}>
                {!compact && (
                  <button
                    type="button"
                    className="mb-1 flex w-full items-center justify-between px-4 py-1 transition-colors"
                    style={{ background: 'transparent' }}
                    onClick={() =>
                      setCollapsed((p) => ({ ...p, [groupLabel]: !p[groupLabel] }))
                    }
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: SIDEBAR.muted }}
                    >
                      {groupLabel}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight size={12} color={SIDEBAR.muted} />
                    ) : (
                      <ChevronDown size={12} color={SIDEBAR.muted} />
                    )}
                  </button>
                )}
                {(compact || !isCollapsed) && (
                  <div className={cn('flex flex-col gap-1', !compact && 'gap-2')}>
                    {groupItems.map((item) => NavRow({ item, onNavigate, compact }))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 (lg↑ 고정) — 목업 w-64 (256px) */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 transition-[width,min-width] duration-200 lg:block"
        style={{
          width: sidebarCollapsed ? SIDEBAR.collapsedWidth : SIDEBAR.expandedWidth,
          minWidth: sidebarCollapsed ? SIDEBAR.collapsedWidth : SIDEBAR.expandedWidth,
        }}
      >
        {/* 일반 함수 호출로 인라인 — 렌더마다 새 컴포넌트 타입이 생겨 nav DOM이
            리마운트(=스크롤 초기화)되던 문제 방지. 컴포넌트 표기(<SidebarBody/>) 금지. */}
        {SidebarBody({ compact: sidebarCollapsed })}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 헤더 */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-5 lg:px-8"
          style={{ height: 60, minHeight: 60 }}
        >
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
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[256px] p-0">
                <SheetTitle className="sr-only">주 메뉴</SheetTitle>
                {SidebarBody({ onNavigate: () => setDrawerOpen(false) })}
              </SheetContent>
            </Sheet>
          </div>

          {/* 우: 알림 · 사용자 */}
          <div className="flex items-center gap-2">
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
                className="relative flex items-center justify-center rounded-none border border-border bg-card transition-colors hover:bg-muted"
                style={{ width: 32, height: 32 }}
                aria-label={`알림 ${notificationCount}건`}
              >
                <Bell size={14} color="#74747F" />
                {notificationCount > 0 && (
                  <span
                    className="absolute"
                    style={{
                      top: 7,
                      right: 7,
                      width: 6,
                      height: 6,
                      background: '#C23A3A',
                    }}
                  />
                )}
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden h-9 items-center gap-2 rounded-none border border-border bg-card px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted sm:flex"
                  aria-label="사용자 메뉴"
                >
                  <span className="max-w-[180px] truncate">{user.name} {user.positionLabel}</span>
                  <ChevronDown size={14} color="#565660" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-none p-2">
                <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="text-sm font-bold text-foreground">
                    {user.name} {user.positionLabel}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.departmentName}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer rounded-none px-3 py-2.5 text-sm"
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 본문 */}
        <main className="min-w-0 flex-1 px-5 py-6 pb-28 lg:px-8">{children}</main>
      </div>

      {/* 우하단 고정 Primary (화면당 1개) */}
      {primaryAction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background px-4 py-3 md:bottom-6 md:left-auto md:right-8 md:border md:px-3 md:py-2">
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
