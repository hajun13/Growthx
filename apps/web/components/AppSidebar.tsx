'use client';

import Link from 'next/link';
import {
  Menu,
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
import { NAV_GROUP_ORDER, type NavItem } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

// eslint-disable-next-line shadcn/no-arbitrary-values -- 사용자 요청(07-08): 사이드바 스크롤바 비표시. 테마에 scrollbar-none 유틸이 없어 속성 직접 지정(후보: theme.css @utility gx-scrollbar-none)
const NAV_SCROLL = 'flex flex-1 flex-col gap-1 overflow-y-auto py-5 [scrollbar-width:none]';

interface NavRowProps {
  item: NavItem;
  active: boolean;
  badge?: number;
  compact?: boolean;
  onNavigate?: () => void;
}

// 단일 네비게이션 항목: 사이드바 토큰 기반, 활성만 sidebar-active 배경.
function NavRow({ item, active, badge, compact = false, onNavigate }: NavRowProps) {
  const Icon = NAV_ICONS[item.key];
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={compact ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex w-full items-center rounded-md py-2.5 text-sidebar-foreground transition-colors',
        compact ? 'justify-center px-0' : 'gap-3 px-4',
        active
          ? 'bg-sidebar-active'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-foreground/8',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {!compact && (
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-13',
            active ? 'font-bold' : 'font-semibold',
          )}
        >
          {item.label}
        </span>
      )}
      {badge !== undefined && (
        <span
          className={cn(
            'flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-danger-500 px-1 text-9h leading-none font-bold text-white tabular-nums',
            compact && 'absolute -mt-6 ml-7',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
  if (!compact) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export interface SidebarBodyProps {
  items: NavItem[];
  activeKey: string;
  badgeFor: (key: string) => number | undefined;
  /** 데스크톱 접힘(아이콘 전용) 표시 */
  compact?: boolean;
  /** 접힘 토글 버튼 상태/핸들러(모바일 드로어에선 생략) */
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  /** 그룹 헤더 접힘 상태(그룹 라벨 → 접힘) */
  groupCollapsed: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
  onNavigate?: () => void;
}

// 사이드바 본문 — 데스크톱 aside 와 모바일 드로어가 공유. 모듈 최상위 컴포넌트라 리렌더 시 nav DOM 이 리마운트되지 않는다.
export function SidebarBody({
  items,
  activeKey,
  badgeFor,
  compact = false,
  sidebarCollapsed = false,
  onToggleSidebar,
  groupCollapsed,
  onToggleGroup,
  onNavigate,
}: SidebarBodyProps) {
  const ungrouped = items.filter((i) => !i.group);
  const row = (item: NavItem) => (
    <NavRow
      key={item.key}
      item={item}
      active={item.key === activeKey}
      badge={badgeFor(item.key)}
      compact={compact}
      onNavigate={onNavigate}
    />
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div
          className={cn(
            'flex h-15 shrink-0 items-center border-b border-sidebar-border',
            compact ? 'justify-center px-0' : 'gap-3 px-5',
          )}
        >
          <Button
            variant="sidebar"
            size="icon"
            className="hidden size-9 lg:inline-flex"
            aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            onClick={onToggleSidebar}
          >
            <Menu aria-hidden />
          </Button>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={cn('flex min-w-0 items-center py-1.5', compact && 'hidden')}
            aria-label="대시보드로 이동"
          >
            {/* 로고 원본이 어두운 색이라 보라 사이드바 위에서는 필터로 흰색 반전(칩 배경 제거). */}
            <img
              src="/energyx-logo.png"
              alt="ENERGYX"
              className="block h-5.5 w-25 object-contain brightness-0 invert"
            />
          </Link>
        </div>
        <nav
          aria-label="주 메뉴"
          className={cn(NAV_SCROLL, compact ? 'px-2' : 'px-4')}
        >
          {ungrouped.map(row)}

          {/* 그룹별 섹션 — 구분선 */}
          {NAV_GROUP_ORDER.map((groupLabel) => {
            const groupItems = items.filter((i) => i.group === groupLabel);
            if (groupItems.length === 0) return null;
            const isCollapsed = groupCollapsed[groupLabel];
            return (
              <div
                key={groupLabel}
                className={cn(
                  'border-t border-sidebar-border pt-4',
                  compact ? 'mt-4' : 'mt-6',
                )}
              >
                {!compact && (
                  <Button
                    variant="sidebar"
                    size="sidebar-group"
                    className="mb-1"
                    onClick={() => onToggleGroup(groupLabel)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="font-bold text-sidebar-foreground/55">
                      {groupLabel}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="size-3 text-sidebar-foreground/55" />
                    ) : (
                      <ChevronDown className="size-3 text-sidebar-foreground/55" />
                    )}
                  </Button>
                )}
                {(compact || !isCollapsed) && (
                  <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
                    {groupItems.map(row)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}
