'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  PrimaryActionProvider,
  usePrimaryActionSlot,
} from '@/hooks/usePrimaryAction';
import { useDepartments } from '@/hooks/useDepartments';
import {
  useNotifications,
  notificationCommands,
} from '@/hooks/useNotifications';
import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/States';
import { positionLabel, notificationHref, notificationNavKey } from '@/lib/ui';
import type { Notification } from '@/lib/types';

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navRouter = useRouter();
  const { user, logout } = useAuth();
  const primaryAction = usePrimaryActionSlot();
  // 부서명은 계약 User 에 없으므로 departments 조회로 해석(표시용).
  const { data: deptList } = useDepartments();
  // 상단 벨 — 전체 목록(드롭다운 미리보기 + 미읽음 뱃지). mount/open 시 갱신.
  const { data: notifs, reload: reloadNotifs } = useNotifications(
    {},
    { enabled: !!user },
  );

  // user 는 가드에서 보장됨.
  if (!user) return null;

  const departmentName =
    deptList?.data.find((d) => d.id === user.departmentId)?.name ?? '';

  const items: Notification[] = notifs?.data ?? [];
  const unreadItems = items.filter((n) => n.readAt === null);
  const unreadCount = unreadItems.length;

  // 타입별로 어느 nav 항목에 뱃지를 표시할지 집계.
  const navBadges: Record<string, number> = {};
  for (const n of unreadItems) {
    const key = notificationNavKey(n.type);
    if (key) navBadges[key] = (navBadges[key] ?? 0) + 1;
  }

  async function handleRead(id: string) {
    const n = items.find((x) => x.id === id);
    try {
      if (n && n.readAt === null) await notificationCommands.read(id);
    } finally {
      reloadNotifs();
      if (n) {
        const href = notificationHref(n.type);
        if (href) navRouter.push(href);
      }
    }
  }

  async function handleReadAll() {
    try {
      await notificationCommands.readAll();
    } finally {
      reloadNotifs();
    }
  }

  return (
    <AppShell
      role={user.role}
      pathname={pathname}
      user={{
        name: user.name,
        positionLabel: positionLabel[user.position],
        departmentName,
      }}
      notifications={{
        unreadCount,
        items: items.slice(0, 8),
        navBadges,
        onRead: (id) => void handleRead(id),
        onReadAll: () => void handleReadAll(),
        onOpen: () => reloadNotifs(),
      }}
      onLogout={logout}
      primaryAction={primaryAction ?? undefined}
    >
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </AppShell>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // 미인증 → 로그인 리다이렉트.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Item1: 초기 비밀번호 강제 변경 — 셸 진입 전 게이트로 차단.
  useEffect(() => {
    if (!loading && user?.mustChangePassword) {
      router.replace('/onboarding/password');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    // 리다이렉트 진행 중
    return null;
  }

  // 비밀번호 강제 변경 대상 — 셸 미렌더(게이트로 이동 중). 셸 데이터 호출(403) 차단.
  if (user.mustChangePassword) {
    return null;
  }

  return (
    <PrimaryActionProvider>
      <Shell>{children}</Shell>
    </PrimaryActionProvider>
  );
}
