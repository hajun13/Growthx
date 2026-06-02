'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cx } from '@/lib/ui';
import type { Role } from '@/lib/types';
import { activeKeyForPath, visibleNav } from '@/lib/nav';
import { Button } from './Button';

export interface AppShellProps {
  role: Role;
  user: { name: string; positionLabel: string; departmentName: string };
  pathname: string;
  notificationCount?: number;
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
  onLogout,
  primaryAction,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = visibleNav(role);
  const activeKey = activeKeyForPath(pathname);

  const sidebar = (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <span key={item.key} className="contents">
            {item.divider && (
              <span
                aria-hidden
                className="my-2 border-t border-neutral-200"
              />
            )}
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => setDrawerOpen(false)}
              className={cx(
                'flex items-center rounded-md px-3 py-2 text-base outline-none transition-colors duration-fast focus-visible:shadow-focus',
                active
                  ? 'bg-primary-50 font-semibold text-primary-700'
                  : 'text-neutral-700 hover:bg-neutral-100',
              )}
            >
              {item.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 상단바 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-neutral-0 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="메뉴 열기"
            className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <Link href="/eval" className="flex items-center gap-2">
            <span className="text-md font-bold text-neutral-900">
              GrowthX 평가
            </span>
            <span className="hidden rounded-full bg-primary-50 px-2 py-[1px] text-xs font-medium text-primary-700 sm:inline">
              인사평가
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`알림 ${notificationCount}건`}
            className="relative rounded-md p-2 text-neutral-700 hover:bg-neutral-100"
          >
            🔔
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-neutral-0">
                {notificationCount}
              </span>
            )}
          </button>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-medium text-neutral-900">
              {user.name} {user.positionLabel}
            </span>
            <span className="text-xs text-neutral-500">
              {user.departmentName}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={onLogout}>
            로그아웃
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-content">
        {/* 사이드바 (lg↑ 고정) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[240px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-neutral-0 lg:block">
          {sidebar}
        </aside>

        {/* 드로어 (lg 미만) */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: 'rgba(25,31,40,0.48)' }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
          >
            <div className="h-full w-[240px] overflow-y-auto bg-neutral-0 shadow-lg">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <span className="text-md font-bold text-neutral-900">메뉴</span>
                <button
                  type="button"
                  aria-label="메뉴 닫기"
                  className="rounded-md p-1 text-neutral-700 hover:bg-neutral-100"
                  onClick={() => setDrawerOpen(false)}
                >
                  ✕
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        {/* 본문 */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:px-8">
          {children}
        </main>
      </div>

      {/* 우하단 고정 Primary (화면당 1개) */}
      {primaryAction && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-neutral-0 px-4 py-3 shadow-lg md:bottom-6 md:left-auto md:right-8 md:rounded-md md:border md:py-0">
          <div className="mx-auto flex max-w-content justify-end md:max-w-none">
            <Button
              size="lg"
              fullWidth
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
