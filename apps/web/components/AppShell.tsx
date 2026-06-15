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
import { NavSearch } from './NavSearch';
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
  yoy: TrendingUp,
  appeals: MessageSquareWarning,
  midterm: Milestone,
  'cycle-ops': Calendar,
  'kpi-import': FileUp,
  rules: Percent,
  compensation: Calculator,
  settings: Settings,
};

// 목업 사이드바 토큰 — 다크 네이비-퍼플 그라데이션 + indigo 활성 박스.
const SIDEBAR = {
  // 목업 원안: linear-gradient(180deg, #1c133a 0%, #151128 100%)
  bg: 'linear-gradient(180deg, #1c133a 0%, #151128 100%)',
  activeBg: '#4338ca', // 목업 .active-menu-item
  border: 'rgba(255,255,255,0.10)',
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 관리자가 설정한 권한 레벨별 nav 가시성(서버 연동). 로딩 중엔 DEFAULT(전부 노출) 폴백.
  const { navVisibility } = usePermissions();
  // 가시성은 권한 레벨(PermLevel) 기준 — (role, scope)로 레벨을 도출.
  const level = useMemo(() => levelOf(role, scope), [role, scope]);
  const items = useMemo(
    () =>
      visibleNav(role).filter((item) => {
        const levelConfig = navVisibility[level];
        if (!levelConfig) return true;
        return levelConfig[item.key] !== false;
      }),
    [navVisibility, role, level],
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

  // ── 단일 네비게이션 항목 — 목업 원안 스타일 ──
  // 활성: #4338ca 단색 박스 + rounded-xl, 비활성: hover:bg-white/10
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
        key={item.key}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 transition-colors"
        style={{
          background: isActive ? SIDEBAR.activeBg : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {Icon && (
          <Icon
            className="h-5 w-5 shrink-0"
            style={{ color: '#ffffff', opacity: isActive ? 1 : 0.6 }}
            aria-hidden
          />
        )}
        <span
          className="min-w-0 flex-1 truncate text-sm"
          style={{
            color: '#ffffff',
            fontWeight: isActive ? 600 : 400,
            opacity: isActive ? 1 : 0.8,
          }}
        >
          {item.label}
        </span>
        {badge !== undefined && (
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center px-1 text-[9.5px] font-bold leading-none text-white"
            style={{ background: '#f04452', borderRadius: 999, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  // ── 사이드바 본문(데스크톱 + 모바일 드로어 공유) — 목업 원안 ──
  // 배경: linear-gradient(180deg, #1c133a 0%, #151128 100%)
  // 로고: p-8, 흰 이미지 필터(h-26px) + KPI PERFORMANCE SYSTEM 서브라벨
  // 그룹 구분: pt-8 border-t border-white/10 mt-8
  // 프로필 푸터: p-6 bg-black/20, 48px 아바타 border-indigo-400, 셰브론
  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => {
    const ungrouped = items.filter((i) => !i.group);
    return (
      <div className="flex h-full flex-col" style={{ background: SIDEBAR.bg }}>
        {/* 로고 블록 — 목업: p-8, 로고 h-26 흰 필터 + KPI PERFORMANCE SYSTEM */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex shrink-0 flex-col items-start p-8"
        >
          <img
            src="/energyx-logo.png"
            alt="에너지엑스"
            className="shrink-0"
            style={{ objectFit: 'contain', height: 26, filter: 'brightness(0) invert(1)' }}
          />
          <span
            className="mt-1 text-[10px] font-bold tracking-widest text-indigo-300"
          >
            KPI PERFORMANCE SYSTEM
          </span>
        </Link>

        {/* 네비게이션 */}
        <nav
          aria-label="주 메뉴"
          className="mt-4 flex-1 space-y-2 overflow-y-auto px-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* 그룹 없는 최상단 항목 — NavRow는 일반 함수 호출(컴포넌트 아님): 리렌더 시 리마운트 방지 */}
          {ungrouped.map((item) => NavRow({ item, onNavigate }))}

          {/* 그룹별 섹션 — 목업: pt-8 border-t border-white/10 mt-8 구분선 */}
          {NAV_GROUP_ORDER.map((groupLabel) => {
            const groupItems = items.filter((i) => i.group === groupLabel);
            if (groupItems.length === 0) return null;
            const isCollapsed = collapsed[groupLabel];
            return (
              <div key={groupLabel} className="mt-8 border-t border-white/10 pt-8">
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
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'rgba(165,180,252,0.6)' }}
                  >
                    {groupLabel}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight size={10} color="rgba(165,180,252,0.6)" />
                  ) : (
                    <ChevronDown size={10} color="rgba(165,180,252,0.6)" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {groupItems.map((item) => NavRow({ item, onNavigate }))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 프로필 푸터 — 목업: p-6 bg-black/20, 48px 원형 아바타 border-indigo-400.
            클릭 시 드롭다운(로그아웃) — 상단바 프로필을 제거하고 여기로 일원화. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full p-6 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-white/30"
              style={{ background: 'rgba(0,0,0,0.20)' }}
              aria-label="사용자 메뉴"
            >
              <div className="flex items-center space-x-3">
                {/* 이니셜 아바타 — 외부 이미지 금지, 48px 원형 */}
                <span
                  className="flex shrink-0 items-center justify-center text-sm font-bold text-white"
                  style={{
                    width: 48,
                    height: 48,
                    background: 'rgba(255,255,255,0.16)',
                    borderRadius: '50%',
                    border: '2px solid #818cf8', // indigo-400
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">
                    {user.name} {user.positionLabel}
                  </p>
                  <p className="truncate text-xs text-indigo-300">{user.departmentName}</p>
                </div>
                <ChevronRight size={16} color="rgba(255,255,255,0.60)" />
              </div>
            </button>
          </DropdownMenuTrigger>
          {/* 사이드바 옆(오른쪽)으로 열리는 다크 메뉴 — 사이드바와 동일 톤 */}
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={10}
            className="w-56 rounded-xl border-white/10 p-2 text-white shadow-xl"
            style={{ background: 'linear-gradient(180deg, #1c133a 0%, #151128 100%)' }}
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
              <span className="text-sm font-bold text-white">
                {user.name} {user.positionLabel}
              </span>
              <span className="text-xs font-normal text-indigo-300">
                {user.departmentName}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-white/80 focus:bg-white/10 focus:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      {/* 사이드바 (lg↑ 고정) — 목업 w-64 (256px) */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 lg:block"
        style={{ width: 256, minWidth: 256 }}
      >
        {/* 일반 함수 호출로 인라인 — 렌더마다 새 컴포넌트 타입이 생겨 nav DOM이
            리마운트(=스크롤 초기화)되던 문제 방지. 컴포넌트 표기(<SidebarBody/>) 금지. */}
        {SidebarBody({})}
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
              <SheetContent side="left" className="w-[256px] p-0">
                <SheetTitle className="sr-only">주 메뉴</SheetTitle>
                {SidebarBody({ onNavigate: () => setDrawerOpen(false) })}
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
            <NavSearch items={items} />

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
